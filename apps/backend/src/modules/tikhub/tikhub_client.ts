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
/**
 * Разворачивает цепочку err.cause в одну читаемую строку. Node/undici почти всегда
 * кладёт НАСТОЯЩУЮ причину сетевого сбоя в cause: верхний уровень — бесполезное
 * «TypeError: terminated» или «fetch failed», а внутри — «SocketError: other side
 * closed» / «ConnectTimeoutError» / ECONNRESET. Без разворота в логах и в UI
 * оставалось одно слово, по которому диагностировать нечего.
 */
function describeFetchError(err: any): string {
  const chain: string[] = [];
  let e: any = err;
  for (let depth = 0; e && depth < 4; depth++) {
    const name = e.name && e.name !== 'Error' ? `${e.name}: ` : '';
    const msg = typeof e.message === 'string' && e.message ? e.message : String(e);
    chain.push(`${name}${msg}${e.code ? ` [${e.code}]` : ''}`);
    e = e.cause;
  }
  return chain.join(' ← ');
}

export async function tikhubGet<T = any>(
  apiKey: string,
  pathAndQuery: string,
  opts?: { timeoutMs?: number }
): Promise<TikHubResult<T>> {
  const url = pathAndQuery.startsWith('http') ? pathAndQuery : `${TIKHUB_BASE}${pathAndQuery}`;
  const timeoutMs = opts?.timeoutMs ?? 20000;
  const controller = new AbortController();
  // Свой флаг таймаута обязателен: по имени ошибки таймаут НЕ опознаётся, если
  // abort() пришёл уже на чтении тела ответа (см. catch ниже).
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
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
        // Тело не разобралось как JSON (бывает при обрыве/HTML-заглушке прокси) — в текст
        // ошибки идёт короткая выжимка, а не 400 символов сырого мусора.
        apiMsg = `неразборчивый ответ: ${data.replace(/\s+/g, ' ').slice(0, 120)}`;
      }
      return { ok: false, status: resp.status, error: (apiMsg || `HTTP ${resp.status}`).slice(0, 200) };
    }
    return { ok: true, status: resp.status, data: data as T };
  } catch (err: any) {
    // ГРАБЛИ: сработавший AbortController виден как AbortError только если сигнал пришёл
    // ДО заголовков. Если он рвёт уже идущее тело ответа (`await resp.text()`), undici
    // бросает «TypeError: terminated» — и раньше этот таймаут уходил пользователю как
    // загадочное «Trend вернул ошибку: terminated». Поэтому таймаут определяем ФЛАГОМ.
    if (timedOut || err?.name === 'AbortError') {
      return { ok: false, status: 0, error: `Trend не ответил за ${Math.round(timeoutMs / 1000)}с (таймаут)` };
    }
    const detail = describeFetchError(err);
    console.warn(`[tikhub] сетевой сбой ${pathAndQuery.split('?')[0]} → ${detail}`);
    return { ok: false, status: 0, error: `обрыв связи с Trend (${detail})`.slice(0, 400) };
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
      return { ok: false, status: 'invalid', message: 'Аккаунт Trend отключён или ключ неактивен.', error: 'account_disabled' };
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
    return { ok: false, status: 'invalid', message: `Trend отверг ключ (HTTP ${r.status})${r.error ? ': ' + r.error : ''}.`, error: r.error };
  }
  if (r.status === 402 || r.status === 429) {
    return { ok: false, status: 'quota_exceeded', message: `Недостаточно баланса или превышен лимит Trend (HTTP ${r.status}).`, error: r.error };
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
  /** Unix-время публикации (сек). Нужно для клиентской сортировки «Новее». */
  createTime?: number;
  /** YouTube: это Shorts (вертикальный) — чтобы при поиске «Видео» отфильтровать. */
  isShort?: boolean;
  stats: { play?: number; like?: number; comment?: number; share?: number };
  raw: any;
}

/**
 * Ретрай транзиентных сбоев TikHub. Их скрапер периодически отвечает
 * 400 «Request failed. Please retry … You won't be charged for this request»
 * — это НЕ ошибка параметров, а временный сбой апстрима, лечится повтором.
 * Сюда же обрывы соединения (status 0) и «terminated» самого скрапера.
 * Попыток немного (запрос платный), зато каждая пишется в лог — молчаливые
 * ретраи скрывали, что скан вообще боролся с апстримом.
 */
async function withTikhubRetry<T>(fn: () => Promise<TikHubResult<T>>, tries = 3): Promise<TikHubResult<T>> {
  let last: TikHubResult<T> = { ok: false, status: 0, error: 'нет попытки' };
  for (let i = 0; i < tries; i++) {
    last = await fn();
    if (last.ok) return last;
    const e = (last.error || '').toLowerCase();
    const transient =
      last.status === 429 || last.status >= 500 || last.status === 0 ||
      /please retry|request failed|try again|timeout|rate limit|временно/.test(e) ||
      /terminated|обрыв|таймаут|socket|econnreset|epipe|und_err|fetch failed/.test(e);
    if (!transient) return last;
    if (i < tries - 1) {
      const delay = 800 * 2 ** i; // 0.8с → 1.6с: обрыв соединения не лечится мгновенно
      console.warn(`[tikhub] попытка ${i + 1}/${tries} не удалась (${(last.error || '').slice(0, 160)}) — повтор через ${delay}мс`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return last;
}

export type SearchMode = 'video' | 'general' | 'app';
export type SortType = 0 | 1 | 2;                       // 0 релевантность, 1 больше лайков, 2 новее
export type PublishTime = 0 | 1 | 7 | 30 | 90 | 180;   // 0 всё время, 1 24ч, 7 неделя, 30 месяц, 90 3мес, 180 6мес

/**
 * Нормализует код региона к ISO-3166 alpha-2 в ВЕРХНЕМ регистре (RU, US, UZ…).
 * Возвращает undefined для пустого/невалидного значения — тогда вызывающий не
 * добавляет параметр вовсе (эндпоинт применит свой дефолт). Единый канонический
 * формат в пайплайне; каждый провайдер приводит его к своему виду (TikTok — UPPER,
 * YouTube — lower для country_code).
 */
export function normalizeRegion(v?: string | null): string | undefined {
  if (!v) return undefined;
  const s = String(v).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : undefined;
}

/**
 * ГРАБЛИ APP V3 (замерено 29.07.2026, воспроизводится 100% на любом ключевике):
 * `app/v3/fetch_video_search_result` отдаёт 200 и заголовки, а потом РВЁТ тело ответа,
 * если запросить много — count=30 и count=20 стабильно падают на ~4-й секунде
 * «TypeError: terminated ← SocketError: other side closed [UND_ERR_SOCKET]», а count=15
 * проходит. Сырой aweme весит ~70 КБ, то есть апстрим (Cloudflare у TikHub) обрывает
 * отдачу где-то за ~1.2 МБ: 15 → ~1.05 МБ ok, 20 → ~1.4 МБ обрыв.
 * Поэтому app-режим НИКОГДА не просит больше APP_MAX_COUNT, а если тело оборвалось
 * всё равно (апстрим ужмёт лимит ещё) — спускаемся по лестнице.
 */
export const TIKTOK_APP_MAX_COUNT = 15;
const APP_MAX_COUNT = TIKTOK_APP_MAX_COUNT;
const APP_COUNT_LADDER = [10, 6];

/** Обрыв ТЕЛА ответа (не сети): повтор тем же запросом даст тот же обрыв — нужен меньший count. */
function isTruncatedBody(r: TikHubResult<any>): boolean {
  return r.status === 0 && /terminated|und_err_socket|other side closed/i.test(r.error || '');
}

export async function searchVideos(
  apiKey: string,
  keyword: string,
  opts?: { count?: number; offset?: number; mode?: SearchMode; publishTime?: PublishTime; region?: string }
): Promise<TikHubResult<any>> {
  const count = Math.min(Math.max(opts?.count ?? 20, 1), 30);
  const offset = Math.max(opts?.offset ?? 0, 0);
  const kw = encodeURIComponent(keyword);
  const mode: SearchMode = opts?.mode || 'app';
  const region = normalizeRegion(opts?.region);

  if (mode === 'app') {
    // ВАЖНО: всегда sort_type=0 (по релевантности). У TikTok только этот режим даёт
    // ИНТЕЛЛЕКТУАЛЬНЫЙ, устойчивый к опечаткам topical-матч ("wordpres" → WordPress).
    // sort_type=1/2 матчат строго: при опечатке/широком запросе отдают свежий мусор,
    // не относящийся к теме. Поэтому «Новее»/«Больше лайков» применяем как клиентскую
    // пересортировку relevance-набора (см. service.scanTrends). publish_time с sort_type=0
    // работает корректно — даёт «релевантные за период».
    //
    // region (default 'US' у API) — единственный поисковый эндпоинт TikTok с гео:
    // подсказывает алгоритму, контент какого региона приоритизировать в выдаче.
    const pub = opts?.publishTime ?? 0;
    const appPath = (c: number) =>
      `/api/v1/tiktok/app/v3/fetch_video_search_result?keyword=${kw}&count=${c}&offset=${offset}` +
      `&sort_type=0&publish_time=${pub}${region ? `&region=${region}` : ''}`;
    const first = Math.min(count, APP_MAX_COUNT);
    if (count > APP_MAX_COUNT) {
      console.warn(`[tikhub] app-поиск: count ${count} → ${APP_MAX_COUNT} (выше апстрим рвёт тело ответа)`);
    }
    let last: TikHubResult<any> = { ok: false, status: 0, error: 'нет попытки' };
    for (const c of [first, ...APP_COUNT_LADDER.filter((x) => x < first)]) {
      last = await withTikhubRetry(() => tikhubGet(apiKey, appPath(c), { timeoutMs: 30000 }));
      if (last.ok || !isTruncatedBody(last)) return last;
      console.warn(`[tikhub] app-поиск: тело оборвано на count=${c} — пробую меньше`);
    }
    return last;
  }

  let path: string;
  if (mode === 'general') {
    // Общий поиск (Web API не принимает count/region).
    path = `/api/v1/tiktok/web/fetch_general_search?keyword=${kw}&offset=${offset}`;
  } else {
    // Web «Поиск по слову» (fetch_search_video) — region не поддерживает.
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

// ============================================================================
// Заземление ключевиков РЕАЛЬНЫМИ данными запросов (для «Таргет на ЦА», Фаза 2).
//   TikTok:  get_query_suggestions (Creative Center — реальные запросы, ЕСТЬ country_code)
//            + fetch_search_keyword_suggest (автокомплит, фолбэк без региона)
//   YouTube: get_search_suggestions (автокомплит, ЕСТЬ region+language)
//   TikTok:  get_trends_hashtag_list (трендовые хэштеги по стране — для подсева ниш)
// Ответы TikHub слабо типизированы ({code,data:…}) и форма варьируется — парсим
// ОБОРОНИТЕЛЬНО (собираем строки-подсказки из известных текстовых полей/массивов).
// ============================================================================

/** Достаёт строки-подсказки из ответа TikHub (форма разная у разных эндпоинтов). */
export function extractSuggestions(payload: any, max = 20): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Ключи, под которыми у ads/suggest/hashtag-эндпоинтов лежит сам текст запроса/хэштега.
  const TEXT_KEYS = ['query', 'keyword', 'suggestion', 'word', 'hashtag_name', 'hashtag', 'cid_name', 'value', 'name', 'title', 'text'];
  const push = (s: any) => {
    if (typeof s !== 'string') return;
    const v = s.trim().replace(/^#/, '');
    if (v.length < 2 || v.length > 60) return;         // отсекаем мусор/слишком длинное
    if (/^https?:\/\//i.test(v)) return;                // не URL
    const k = v.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k); out.push(v);
  };
  const walk = (o: any, depth = 0): void => {
    if (o == null || depth > 6 || out.length >= max) return;
    if (Array.isArray(o)) { for (const it of o) { if (typeof it === 'string') push(it); else walk(it, depth + 1); } return; }
    if (typeof o === 'object') {
      for (const k of TEXT_KEYS) if (typeof o[k] === 'string') push(o[k]);
      for (const kk of Object.keys(o)) walk(o[kk], depth + 1);
    }
  };
  walk(payload && typeof payload === 'object' && payload.data !== undefined ? payload.data : payload);
  return out.slice(0, max);
}

/** TikTok Creative Center: реальные подсказки запросов по стране (country_code — ISO alpha-2). */
export async function fetchTiktokQuerySuggestions(
  apiKey: string, query: string, opts?: { countryCode?: string; count?: number }
): Promise<TikHubResult<any>> {
  const q = encodeURIComponent(query);
  const cc = encodeURIComponent(opts?.countryCode || 'US');
  const count = Math.min(Math.max(opts?.count ?? 50, 1), 100);
  return withTikhubRetry(() =>
    tikhubGet(apiKey, `/api/v1/tiktok/ads/get_query_suggestions?query=${q}&count=${count}&scenario=1&country_code=${cc}`, { timeoutMs: 20000 })
  );
}

/** TikTok автокомплит поиска по ключевику (фолбэк; региона нет). */
export async function fetchTiktokKeywordSuggest(apiKey: string, keyword: string): Promise<TikHubResult<any>> {
  return withTikhubRetry(() =>
    tikhubGet(apiKey, `/api/v1/tiktok/web/fetch_search_keyword_suggest?keyword=${encodeURIComponent(keyword)}`, { timeoutMs: 20000 })
  );
}

/** YouTube автокомплит поиска (region + language — ISO alpha-2 / BCP-47). */
export async function fetchYoutubeSuggestions(
  apiKey: string, keyword: string, opts?: { region?: string; language?: string }
): Promise<TikHubResult<any>> {
  const kw = encodeURIComponent(keyword);
  const region = encodeURIComponent(opts?.region || 'US');
  const language = encodeURIComponent(opts?.language || 'en');
  return withTikhubRetry(() =>
    tikhubGet(apiKey, `/api/v1/youtube/web_v2/get_search_suggestions?keyword=${kw}&region=${region}&language=${language}`, { timeoutMs: 20000 })
  );
}

/** TikTok Creative Center: трендовые хэштеги по стране (для подсева ниш). */
export async function fetchTiktokTrendingHashtags(
  apiKey: string, opts?: { countryCode?: string; timeRange?: number; limit?: number }
): Promise<TikHubResult<any>> {
  const cc = encodeURIComponent(opts?.countryCode || 'US');
  const tr = [7, 30, 120].includes(Number(opts?.timeRange)) ? Number(opts?.timeRange) : 7;
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
  return withTikhubRetry(() =>
    tikhubGet(apiKey, `/api/v1/tiktok/ads/get_trends_hashtag_list?time_range=${tr}&country_code=${cc}&page=1&limit=${limit}`, { timeoutMs: 20000 })
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
      // 1) НЕПУСТОЙ массив-кандидат. Важно: App V3 search кладёт ПУСТОЙ aweme_list
      //    рядом с непустым search_item_list — нельзя хватать первый попавшийся.
      for (const k of CANDIDATE_KEYS) {
        if (Array.isArray(node[k]) && node[k].length > 0) return node[k];
      }
      // 2) глубже (массив может быть вложен в объект).
      for (const k of CANDIDATE_KEYS) {
        if (node[k] && typeof node[k] === 'object' && !Array.isArray(node[k])) {
          const found = visit(node[k], depth + 1);
          if (found && found.length > 0) return found;
        }
      }
      // 3) легитимно пустой результат — отдаём первый найденный массив.
      for (const k of CANDIDATE_KEYS) {
        if (Array.isArray(node[k])) return node[k];
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

  // Время публикации (App V3 — create_time сек; web — createTime). Для сортировки «Новее».
  const ctRaw = N(it.create_time) ?? N(it.createTime) ?? N(it.create_time_str);
  const createTime = ctRaw == null ? undefined : (ctRaw > 1e12 ? Math.round(ctRaw / 1000) : ctRaw);

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
    createTime,
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

// ============================================================================
// Скачивание: одно видео по aweme_id через App V3 (даёт ПРЯМУЮ ссылку без
// водяного знака, не требующую cookie tt_chain_token — в отличие от web-CDN).
// ============================================================================

export async function fetchOneVideo(apiKey: string, awemeId: string): Promise<TikHubResult<any>> {
  return withTikhubRetry(() =>
    tikhubGet(apiKey, `/api/v1/tiktok/app/v3/fetch_one_video?aweme_id=${encodeURIComponent(awemeId)}`, { timeoutMs: 30000 })
  );
}

/** Достаёт сам aweme из ответа fetch_one_video (несколько возможных форм обёртки). */
function pickAweme(payload: any): any {
  let root = payload;
  if (root && typeof root === 'object' && root.data !== undefined) root = root.data;
  if (!root || typeof root !== 'object') return null;
  return (
    root.aweme_detail ||
    (Array.isArray(root.aweme_details) ? root.aweme_details[0] : null) ||
    root.aweme_info ||
    (Array.isArray(root.aweme_list) ? root.aweme_list[0] : null) ||
    root
  );
}

/** Список прямых ссылок-кандидатов для скачивания (no-watermark play_addr — первыми). */
export function extractDownloadUrls(payload: any): string[] {
  const aw = pickAweme(payload);
  const v = (aw && aw.video) || {};
  const urls: string[] = [];
  const push = (x: any) => {
    if (typeof x === 'string' && x.startsWith('http')) urls.push(x);
    else if (x && Array.isArray(x.url_list)) for (const u of x.url_list) if (typeof u === 'string' && u.startsWith('http')) urls.push(u);
  };
  push(v.play_addr);
  push(v.playAddr);
  if (Array.isArray(v.bit_rate)) for (const b of v.bit_rate) push(b && b.play_addr);
  push(v.download_addr);
  push(v.downloadAddr);
  return Array.from(new Set(urls));
}

/** url из строки или TikTok-объекта {url_list:[…]} (первая https-ссылка). */
function coverUrlOf(x: any): string | undefined {
  if (typeof x === 'string' && x.startsWith('http')) return x;
  if (x && Array.isArray(x.url_list)) {
    for (const u of x.url_list) if (typeof u === 'string' && u.startsWith('http')) return u;
  }
  return undefined;
}

/**
 * Свежая обложка из ответа fetch_one_video — для «воскрешения» протухших обложек ленты.
 * dynamic_cover ПЕРВЫМ: статические cover/origin_cover у TikTok — HEIC, который <img>
 * не рендерит (та же причина, что в providers.genericNormalize).
 */
export function extractOneVideoCover(payload: any): string | undefined {
  const aw = pickAweme(payload);
  if (!aw || typeof aw !== 'object') return undefined;
  const v = aw.video || {};
  return coverUrlOf(v.dynamic_cover) || coverUrlOf(v.dynamicCover)
    || coverUrlOf(v.cover) || coverUrlOf(v.origin_cover) || coverUrlOf(v.originCover)
    || coverUrlOf(aw.cover) || coverUrlOf(aw.thumbnail);
}

/** Метаданные одного TikTok-видео из fetch_one_video — для добавления по прямой ссылке. */
export function extractOneVideoMeta(payload: any): {
  author?: string; authorName?: string; description?: string; durationSec?: number;
  play?: number; like?: number; comment?: number; share?: number;
} {
  const aw = pickAweme(payload);
  if (!aw || typeof aw !== 'object') return {};
  const num = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : undefined);
  const st = aw.statistics || aw.stats || {};
  const durMs = num(aw.video && aw.video.duration);
  return {
    author: (aw.author && (aw.author.unique_id || aw.author.uniqueId)) || undefined,
    authorName: (aw.author && (aw.author.nickname || aw.author.nick_name)) || undefined,
    description: typeof aw.desc === 'string' ? aw.desc : undefined,
    // duration у TikTok в миллисекундах (иногда уже в секундах — эвристика по величине)
    durationSec: durMs !== undefined ? (durMs > 1000 ? Math.round(durMs / 1000) : durMs) : undefined,
    play: num(st.play_count), like: num(st.digg_count ?? st.like_count),
    comment: num(st.comment_count), share: num(st.share_count),
  };
}

/** Инфо об одном IG-посте по shortcode (тот же эндпоинт, что в аналитике/social-ext). */
export async function fetchInstagramPostInfo(apiKey: string, code: string): Promise<TikHubResult<any>> {
  return withTikhubRetry(() =>
    tikhubGet(apiKey, `/api/v1/instagram/v3/get_post_info_by_code?code=${encodeURIComponent(code)}`, { timeoutMs: 30000 })
  );
}

/** Обложка IG-поста из ответа get_post_info_by_code (candidates[0] = максимальный размер). */
export function extractInstagramCover(payload: any): string | undefined {
  const seen = new Set<any>();
  const walk = (node: any, depth: number): string | undefined => {
    if (!node || typeof node !== 'object' || depth > 6 || seen.has(node)) return undefined;
    seen.add(node);
    const cand = node.image_versions2?.candidates?.[0]?.url;
    if (typeof cand === 'string' && cand.startsWith('http')) return cand;
    for (const k of ['thumbnail_url', 'display_url', 'cover_url']) {
      const u = node[k];
      if (typeof u === 'string' && u.startsWith('http')) return u;
    }
    for (const k of Object.keys(node)) {
      const r = walk(node[k], depth + 1);
      if (r) return r;
    }
    return undefined;
  };
  return walk(payload, 0);
}

/** Метаданные IG-поста из get_post_info_by_code — для добавления по прямой ссылке.
 *  Обход оборонительный (формы ответов слабо типизированы, как extractInstagramCover). */
export function extractInstagramMeta(payload: any): {
  author?: string; authorName?: string; description?: string; videoUrl?: string;
  durationSec?: number; play?: number; like?: number; comment?: number;
} {
  const out: any = {};
  const num = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : undefined);
  const seen = new Set<any>();
  const walk = (node: any, depth: number): void => {
    if (!node || typeof node !== 'object' || depth > 7 || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { for (const it of node) walk(it, depth + 1); return; }
    if (!out.author && node.user && typeof node.user === 'object') {
      out.author = node.user.username || undefined;
      out.authorName = node.user.full_name || node.user.fullName || undefined;
    }
    if (!out.description && node.caption && typeof node.caption === 'object' && typeof node.caption.text === 'string') out.description = node.caption.text;
    if (!out.videoUrl && Array.isArray(node.video_versions) && node.video_versions[0] && typeof node.video_versions[0].url === 'string') out.videoUrl = node.video_versions[0].url;
    if (!out.videoUrl && typeof node.video_url === 'string' && node.video_url.startsWith('http')) out.videoUrl = node.video_url;
    if (out.durationSec === undefined) out.durationSec = num(node.video_duration);
    if (out.play === undefined) out.play = num(node.play_count ?? node.view_count);
    if (out.like === undefined) out.like = num(node.like_count);
    if (out.comment === undefined) out.comment = num(node.comment_count);
    for (const k of Object.keys(node)) walk(node[k], depth + 1);
  };
  walk(payload, 0);
  if (out.durationSec !== undefined) out.durationSec = Math.round(out.durationSec);
  return out;
}

/** Метаданные YouTube-видео из ответа streams (get_video_streams): заголовок/канал/длительность.
 *  Формы разные (videoDetails / плоские поля) — берём первое похожее. */
export function extractYoutubeMeta(payload: any): {
  authorName?: string; description?: string; durationSec?: number; play?: number;
} {
  let root = payload;
  if (root && typeof root === 'object' && root.data !== undefined) root = root.data;
  const vd = (root && typeof root === 'object' && (root.videoDetails || root.video_details)) || root || {};
  const num = (x: any) => (Number.isFinite(Number(x)) ? Number(x) : undefined);
  return {
    authorName: (typeof vd.author === 'string' && vd.author) || (typeof vd.channel_title === 'string' && vd.channel_title) || undefined,
    description: (typeof vd.title === 'string' && vd.title) || undefined,
    durationSec: num(vd.lengthSeconds ?? vd.length_seconds ?? vd.duration),
    play: num(vd.viewCount ?? vd.view_count),
  };
}

/** Деталь твита (X) для скачивания видео — структура иная, чем у TikTok. */
export async function fetchTweetDetail(apiKey: string, tweetId: string): Promise<TikHubResult<any>> {
  return withTikhubRetry(() =>
    tikhubGet(apiKey, `/api/v1/twitter/web/fetch_tweet_detail?tweet_id=${encodeURIComponent(tweetId)}`, { timeoutMs: 30000 })
  );
}

/** Прямые mp4-ссылки твита, МАКСИМАЛЬНЫЙ битрейт первым. Глубокий обход payload:
 *  любые массивы `variants` с content_type video/mp4 (у X/Twitter медиа лежат в
 *  extended_entities.media[].video_info.variants[], путь варьируется). */
export function extractTwitterVideoUrls(payload: any): string[] {
  const out: { url: string; bitrate: number }[] = [];
  const seen = new Set<string>();
  const walk = (o: any, depth = 0): void => {
    if (!o || typeof o !== 'object' || depth > 12) return;
    if (Array.isArray(o)) { for (const it of o) walk(it, depth + 1); return; }
    if (Array.isArray(o.variants)) {
      for (const v of o.variants) {
        const u = v && typeof v.url === 'string' ? v.url : '';
        const isMp4 = v?.content_type === 'video/mp4' || /\.mp4(?:\?|$)/i.test(u);
        if (u && /^https?:/.test(u) && isMp4 && !seen.has(u)) {
          seen.add(u);
          out.push({ url: u, bitrate: Number(v.bitrate || 0) });
        }
      }
    }
    for (const k of Object.keys(o)) walk(o[k], depth + 1);
  };
  walk(payload);
  out.sort((a, b) => b.bitrate - a.bitrate);
  return out.map((x) => x.url);
}

// ── YouTube: скачивание (потоки + подписанные ссылки) ───────────────────────
// get_video_streams_v2 отдаёт список форматов (itag/качество), но СЫРЫЕ url
// IP-привязаны к серверам TikHub → с нашего IP отдают 403. get_signed_stream_url
// по itag возвращает ссылку, которая реально качается с нашего сервера (проверено).
// Прогрессив (formats[]) даёт audio+video одним файлом (обычно ≤360p); 1080p —
// только раздельными adaptive-потоками (видео H.264 + аудио AAC) под склейку ffmpeg.

export async function fetchYoutubeStreams(apiKey: string, videoId: string): Promise<TikHubResult<any>> {
  return withTikhubRetry(() =>
    tikhubGet(apiKey, `/api/v1/youtube/web_v2/get_video_streams_v2?video_id=${encodeURIComponent(videoId)}`, { timeoutMs: 30000 })
  );
}

/** Подписанная (скачиваемая с нашего IP) ссылка на конкретный itag. Эндпоинт изредка
 *  флапает 400 «please retry» → withTikhubRetry (3 попытки с бэкоффом, как у всех вызовов
 *  клиента). '' если не получилось. */
export async function fetchYoutubeSignedUrl(apiKey: string, videoId: string, itag: number): Promise<string> {
  const r = await withTikhubRetry(() =>
    tikhubGet<any>(apiKey, `/api/v1/youtube/web_v2/get_signed_stream_url?video_id=${encodeURIComponent(videoId)}&itag=${itag}`, { timeoutMs: 30000 })
  );
  const u = r.ok ? (r.data?.data?.url ?? r.data?.data?.signed_url ?? '') : '';
  return typeof u === 'string' && /^https?:/.test(u) ? u : '';
}

export interface YoutubePick { videoItag?: number; audioItag?: number; progItag?: number; height?: number }

/** Выбор itag'ов из get_video_streams_v2: лучший H.264-видео ≤1080p (avc1) + лучшее
 *  AAC-аудио (mp4a) для склейки в совместимый mp4 (-c copy); прогрессивный mp4
 *  (audio+video одним файлом) — для фолбэка. */
export function pickYoutubeItags(streamsData: any): YoutubePick {
  const d = streamsData?.data ?? streamsData ?? {};
  const prog: any[] = Array.isArray(d.formats) ? d.formats : [];
  const adap: any[] = Array.isArray(d.adaptive_formats) ? d.adaptive_formats : [];
  const H = (f: any) => Number(f?.height || 0);
  const mime = (f: any) => String(f?.mime_type || '');
  const itag = (f: any) => (f && f.itag != null && Number.isFinite(Number(f.itag)) ? Number(f.itag) : undefined);
  const vids = adap.filter((f) => /avc1/i.test(mime(f)) && H(f) <= 1080 && itag(f) != null).sort((a, b) => H(b) - H(a));
  const auds = adap.filter((f) => /mp4a/i.test(mime(f)) && itag(f) != null).sort((a, b) => Number(b?.bitrate || 0) - Number(a?.bitrate || 0));
  const progs = prog.filter((f) => /mp4/i.test(mime(f)) && itag(f) != null).sort((a, b) => H(b) - H(a));
  return {
    videoItag: vids[0] ? itag(vids[0]) : undefined,
    audioItag: auds[0] ? itag(auds[0]) : undefined,
    progItag: progs[0] ? itag(progs[0]) : undefined,
    height: vids[0] ? H(vids[0]) : (progs[0] ? H(progs[0]) : undefined),
  };
}
