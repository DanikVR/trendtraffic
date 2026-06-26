/**
 * TikHub.io API клиент (TrendTraffic).
 *
 * TikHub — единый сторонний REST API для сканирования трендов и скачивания видео
 * (TikTok, Douyin, Instagram, YouTube и др.). Авторизация — Bearer-токен; биллинг
 * pay-as-you-go. Один платформенный ключ на весь аккаунт ИЛИ собственный ключ
 * Enterprise-тенанта (см. systemConfig.getTikHubApiKey / tenant_settings/tikhub.ts).
 *
 * Здесь — низкоуровневый GET + РЕАЛЬНАЯ проверка ключа (эндпоинт get_user_info).
 * Методы скана трендов/скачивания добавятся в блоке «Анализатор трендов».
 *
 * Эндпоинт проверки (сверено по openapi.json):
 *   GET /api/v1/tikhub/user/get_user_info  (Bearer)
 *   200 → { code, api_key_data:{ api_key_name, api_key_scopes, api_key_status, expires_at },
 *           user_data:{ email, balance, free_credit, email_verified, account_disabled, is_active } }
 */

const TIKHUB_BASE = (process.env.TIKHUB_BASE_URL || 'https://api.tikhub.io').replace(/\/+$/, '');

export interface TikHubResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Низкоуровневый авторизованный GET к TikHub. Никогда не бросает — возвращает
 * типизированный результат (по образцу channels/instagram/ig_client.ts).
 */
export async function tikhubGet<T = any>(
  apiKey: string,
  pathAndQuery: string,
  opts?: { timeoutMs?: number }
): Promise<TikHubResult<T>> {
  const url = pathAndQuery.startsWith('http') ? pathAndQuery : `${TIKHUB_BASE}${pathAndQuery}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 20000);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'User-Agent': 'TrendTraffic/1.0',
      },
      signal: controller.signal,
    });
    const text = await resp.text();
    let data: any = undefined;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!resp.ok) {
      let apiMsg = '';
      if (data && typeof data === 'object') {
        const m = (data as any).detail ?? (data as any).message ?? (data as any).error ?? (data as any).status_msg;
        // detail у FastAPI-валидации — массив объектов; объект сериализуем в JSON, а не String() → "[object Object]".
        apiMsg = m == null ? '' : (typeof m === 'string' ? m : JSON.stringify(m));
      } else if (typeof data === 'string') {
        apiMsg = data;
      }
      return { ok: false, status: resp.status, error: (apiMsg || `HTTP ${resp.status}`).slice(0, 400) };
    }
    return { ok: true, status: resp.status, data: data as T };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return { ok: false, status: 0, error: aborted ? 'Таймаут запроса к TikHub' : (err?.message || String(err)) };
  } finally {
    clearTimeout(timer);
  }
}

export type TikHubKeyStatus = 'active' | 'invalid' | 'quota_exceeded';

export interface TikHubKeyInfo {
  ok: boolean;
  /** Готовый текст для UI: email + баланс, либо причина ошибки. */
  message: string;
  status: TikHubKeyStatus;
  email?: string;
  balance?: number;
  freeCredit?: number;
  apiKeyName?: string;
  scopes?: string[];
  expiresAt?: string | null;
  error?: string;
}

/**
 * РЕАЛЬНАЯ проверка ключа против TikHub (GET get_user_info — самый дешёвый
 * account-эндпоинт; отдаёт статус ключа + баланс). Используется кнопкой
 * «Проверить» в админке и в Enterprise-настройках тенанта.
 */
export async function validateTikHubKey(apiKey: string): Promise<TikHubKeyInfo> {
  const key = (apiKey || '').trim();
  if (!key) return { ok: false, status: 'invalid', message: 'Ключ не задан', error: 'empty' };

  const r = await tikhubGet<any>(key, '/api/v1/tikhub/user/get_user_info');

  if (r.ok && r.data && typeof r.data === 'object') {
    const u = r.data.user_data || {};
    const k = r.data.api_key_data || {};
    const disabled = u.account_disabled === true || u.is_active === false;
    if (disabled) {
      return { ok: false, status: 'invalid', message: 'Аккаунт TikHub отключён или ключ неактивен.', error: 'account_disabled' };
    }
    const balance = typeof u.balance === 'number' ? u.balance : undefined;
    const freeCredit = typeof u.free_credit === 'number' ? u.free_credit : undefined;
    const email = typeof u.email === 'string' ? u.email : undefined;
    const balStr = balance != null ? `$${balance.toFixed(4)}` : '—';
    const freeStr = freeCredit != null ? `$${freeCredit.toFixed(4)}` : '—';
    return {
      ok: true,
      status: 'active',
      message: `Ключ валиден${email ? ` (${email})` : ''}. Баланс: ${balStr}, бесплатный кредит: ${freeStr}.`,
      email,
      balance,
      freeCredit,
      apiKeyName: typeof k.api_key_name === 'string' ? k.api_key_name : undefined,
      scopes: Array.isArray(k.api_key_scopes) ? k.api_key_scopes : undefined,
      expiresAt: k.expires_at ?? null,
    };
  }

  // 401/403 — невалидный ключ; 402/429 — недостаточно баланса / лимит; иначе сетевая ошибка.
  if (r.status === 401 || r.status === 403) {
    return { ok: false, status: 'invalid', message: `TikHub отверг ключ (HTTP ${r.status})${r.error ? ': ' + r.error : ''}.`, error: r.error };
  }
  if (r.status === 402 || r.status === 429) {
    return { ok: false, status: 'quota_exceeded', message: `Недостаточно баланса или превышен лимит TikHub (HTTP ${r.status}).`, error: r.error };
  }
  return { ok: false, status: 'invalid', message: `Не удалось проверить ключ: ${r.error || `HTTP ${r.status}`}.`, error: r.error };
}

// ============================================================================
// Сканирование трендов (TikTok web-эндпоинты — стабильнее, чем app v3)
//   keyword:  GET /api/v1/tiktok/web/fetch_search_video?keyword=&count=&offset=
//   trending: GET /api/v1/tiktok/web/fetch_explore_post?count=&categoryType=
// Ответ оборачивается TikHub в { code, data: {...} }; форма items различается по
// эндпоинту/версии, поэтому нормализуем максимально оборонительно и храним raw.
// ============================================================================

export interface NormalizedVideo {
  externalId: string;
  platform: string;
  author: string;
  authorName?: string;
  description?: string;
  coverUrl?: string;
  videoUrl?: string;
  webUrl?: string;
  durationSec?: number;
  stats: { play?: number; like?: number; comment?: number; share?: number };
  raw: any;
}

/**
 * Ретрай транзиентных сбоев TikHub. Их скрапер периодически отвечает
 * 400 «Request failed. Please retry … You won't be charged for this request»
 * — это НЕ ошибка параметров, а временный сбой апстрима, лечится повтором.
 */
async function withTikhubRetry<T>(fn: () => Promise<TikHubResult<T>>, tries = 3): Promise<TikHubResult<T>> {
  let last: TikHubResult<T> = { ok: false, status: 0, error: 'нет попытки' };
  for (let i = 0; i < tries; i++) {
    last = await fn();
    if (last.ok) return last;
    const e = (last.error || '').toLowerCase();
    const transient =
      last.status === 429 || last.status >= 500 || last.status === 0 ||
      /please retry|request failed|try again|timeout|rate limit|временно/.test(e);
    if (!transient) return last;
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  return last;
}

export type SearchMode = 'video' | 'general' | 'app';
export type SortType = 0 | 1 | 2;                       // 0 релевантность, 1 больше лайков, 2 новее
export type PublishTime = 0 | 1 | 7 | 30 | 90 | 180;   // 0 всё время, 1 24ч, 7 неделя, 30 месяц, 90 3мес, 180 6мес

export async function searchVideos(
  apiKey: string,
  keyword: string,
  opts?: { count?: number; offset?: number; mode?: SearchMode; sortType?: SortType; publishTime?: PublishTime }
): Promise<TikHubResult<any>> {
  const count = Math.min(Math.max(opts?.count ?? 20, 1), 30);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const kw = encodeURIComponent(keyword);
  const mode: SearchMode = opts?.mode || 'video';

  let path: string;
  if (mode === 'general') {
    // Общий поиск (Web API не принимает count).
    path = `/api/v1/tiktok/web/fetch_general_search?keyword=${kw}&offset=${offset}`;
  } else if (mode === 'app') {
    // App V3 — поддерживает фильтры sort_type/publish_time.
    const sort = opts?.sortType ?? 0;
    const pub = opts?.publishTime ?? 0;
    path = `/api/v1/tiktok/app/v3/fetch_video_search_result?keyword=${kw}&count=${count}&offset=${offset}&sort_type=${sort}&publish_time=${pub}`;
  } else {
    path = `/api/v1/tiktok/web/fetch_search_video?keyword=${kw}&count=${count}&offset=${offset}`;
  }
  return withTikhubRetry(() => tikhubGet(apiKey, path, { timeoutMs: 30000 }));
}

export async function fetchTrending(
  apiKey: string,
  opts?: { count?: number; category?: string }
): Promise<TikHubResult<any>> {
  const count = Math.min(Math.max(opts?.count ?? 16, 1), 30);
  const category = opts?.category || '120';
  return withTikhubRetry(() =>
    tikhubGet(apiKey, `/api/v1/tiktok/web/fetch_explore_post?count=${count}&categoryType=${encodeURIComponent(category)}`, { timeoutMs: 30000 })
  );
}

// ── Нормализация ответа ──────────────────────────────────────────────────

const N = (v: any): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const firstStr = (...vals: any[]): string | undefined => {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0].trim();
    if (v && typeof v === 'object' && Array.isArray(v.url_list) && v.url_list[0]) return String(v.url_list[0]);
  }
  return undefined;
};

/** Достаёт массив «сырых» элементов-видео из обёртки TikHub (несколько форм). */
export function extractRawItems(payload: any): any[] {
  if (!payload) return [];
  let root = payload;
  // TikHub оборачивает в { code, router, data: {...} }.
  if (root && typeof root === 'object' && root.data !== undefined) root = root.data;
  // И snake_case, и camelCase: web-эндпоинты TikTok отдают itemList (тренды), search — data[]/item_list.
  const CANDIDATE_KEYS = [
    'aweme_list', 'awemeList', 'item_list', 'itemList', 'items', 'videos', 'video_list', 'videoList',
    'business_list', 'businessList', 'search_item_list', 'searchItemList', 'aweme_info', 'data',
  ];
  const visit = (node: any, depth: number): any[] | null => {
    if (!node || depth > 4) return null;
    if (Array.isArray(node)) return node;
    if (typeof node === 'object') {
      for (const k of CANDIDATE_KEYS) {
        if (Array.isArray(node[k])) return node[k];
      }
      for (const k of CANDIDATE_KEYS) {
        if (node[k] && typeof node[k] === 'object') {
          const found = visit(node[k], depth + 1);
          if (found) return found;
        }
      }
    }
    return null;
  };
  return visit(root, 0) || [];
}

/** Разворачивает обёртку элемента (web-search кладёт aweme в .item/.aweme_info). */
function unwrapItem(el: any): any {
  if (!el || typeof el !== 'object') return el;
  return el.aweme_info || el.aweme || el.item || el.itemStruct || el;
}

export function normalizeVideoItem(el: any): NormalizedVideo | null {
  const it = unwrapItem(el);
  if (!it || typeof it !== 'object') return null;

  const externalId = firstStr(it.aweme_id, it.id, it.itemId, it.item_id, it.aweme_id_str);
  if (!externalId) return null;

  const author = it.author || it.authorInfo || {};
  const authorUser = firstStr(author.unique_id, author.uniqueId, author.sec_uid, author.uid, author.id);
  const authorName = firstStr(author.nickname, author.nick_name, author.name);

  const stat = it.statistics || it.stats || it.statisticsV2 || {};
  const video = it.video || it.videoData || {};
  const dRaw = N(video.duration) ?? N(it.duration);
  const durationSec = dRaw == null ? undefined : (dRaw > 1000 ? Math.round(dRaw / 1000) : dRaw);

  const coverUrl = firstStr(
    video.cover, video.origin_cover, video.originCover, video.dynamic_cover, video.dynamicCover,
    it.cover, it.thumbnail
  );
  const videoUrl = firstStr(
    video.play_addr, video.playAddr, video.play_url, video.playApi,
    video.download_addr, video.downloadAddr, video.bit_rate?.[0]?.play_addr
  );

  const webUrl = authorUser ? `https://www.tiktok.com/@${authorUser}/video/${externalId}` : undefined;

  return {
    externalId,
    platform: 'tiktok',
    author: authorUser || 'unknown',
    authorName,
    description: firstStr(it.desc, it.description, it.title),
    coverUrl,
    videoUrl,
    webUrl,
    durationSec,
    stats: {
      play: N(stat.play_count) ?? N(stat.playCount) ?? N(stat.play),
      like: N(stat.digg_count) ?? N(stat.diggCount) ?? N(stat.like_count) ?? N(stat.likeCount),
      comment: N(stat.comment_count) ?? N(stat.commentCount),
      share: N(stat.share_count) ?? N(stat.shareCount),
    },
    raw: it,
  };
}

/** Нормализует весь ответ в список видео (best-effort). */
export function normalizeVideos(payload: any): NormalizedVideo[] {
  return extractRawItems(payload)
    .map(normalizeVideoItem)
    .filter((v): v is NormalizedVideo => !!v);
}
