/**
 * Каналы — анализ ВСЕХ видео канала/профиля по публичной ссылке (Фаза 1, on-demand).
 *
 * Вставляешь ссылку на профиль (TikTok / Instagram / YouTube) → backend определяет
 * платформу + хэндл, тянет профиль И постранично ВСЕ видео канала (пагинация по
 * курсору) НАШИМ эффективным ключом TikHub, возвращает {profile, videos[]}.
 *
 * Пагинация курсора у TikHub различается по площадке (имя параметра/поля); читаем
 * курсор оборонительно (deepFind по типовым ключам) и шлём в известном для площадки
 * параметре. Если курсор не распознан/не двигается — корректно останавливаемся
 * (в худшем случае отдаём первую страницу, не падаем). Диагностика — в console.log
 * [CHANNELS] (видно в pm2-логах для пост-деплой настройки имён курсора).
 *
 * История/дельты НЕ здесь — это Фаза 2 (watchlist + снимки + планировщик).
 */

import { tikhubGet, normalizeVideos, type NormalizedVideo } from '../tikhub/tikhub_client.js';
import { genericNormalize, normalizeYoutube } from '../tikhub/providers.js';
import { detectUrl } from '../trends/analytics.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';

export type ChannelPlatform = 'tiktok' | 'instagram' | 'youtube';
const SUPPORTED: ChannelPlatform[] = ['tiktok', 'instagram', 'youtube'];
const enc = encodeURIComponent;

export interface ChannelProfile {
  platform: ChannelPlatform;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  followers?: number;
  verified?: boolean;
  url?: string;
}
/** Видео без тяжёлого сырого ответа TikHub (raw не шлём на фронт). isShort — для YouTube
 *  (Shorts vs обычные ролики, чтобы развести по вкладкам). */
export type ChannelVideo = Omit<NormalizedVideo, 'raw'> & { isShort?: boolean };
export interface ChannelAnalysis {
  profile: ChannelProfile;
  videos: ChannelVideo[];
  count: number;
  hasMore: boolean;
  pagesFetched: number;
  note?: string;
}

// ── Оборонительные хелперы (локальные копии — общие не экспортируются) ──
function deepFind(obj: any, keys: string[], depth = 0): any {
  if (obj == null || depth > 9) return undefined;
  if (Array.isArray(obj)) { for (const it of obj) { const r = deepFind(it, keys, depth + 1); if (r !== undefined) return r; } return undefined; }
  if (typeof obj === 'object') {
    for (const k of keys) { const v = obj[k]; if (v != null && (typeof v === 'number' || typeof v === 'string')) return v; }
    for (const kk of Object.keys(obj)) { const r = deepFind(obj[kk], keys, depth + 1); if (r !== undefined) return r; }
  }
  return undefined;
}
function num(v: any): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}
/** Парсит счётчик, который площадка может отдать строкой: "505M subscribers", "1.2K", "104,402,180". */
function parseCount(v: any): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v).trim().replace(/,/g, '');
  const m = s.match(/([\d.]+)\s*([kKmMbB])?/);
  if (!m) return undefined;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const suf = (m[2] || '').toLowerCase();
  if (suf === 'k') n *= 1e3; else if (suf === 'm') n *= 1e6; else if (suf === 'b') n *= 1e9;
  return Math.round(n);
}
/**
 * Достаёт поле пагинации (курсор/флаг «есть ещё») с КОРНЯ ответа и обёртки `.data`
 * (TikHub: `{ code, data:{ aweme_list, max_cursor, has_more } }`), НЕ уходя в массивы-
 * элементы — иначе можно подхватить одноимённое поле ВНУТРИ отдельного видео и сломать
 * пагинацию. Фолбэк — ограниченный deepFind (на случай нестандартной обёртки).
 */
function pickField(resp: any, keys: string[]): any {
  const roots = [resp, resp?.data, resp?.data?.data].filter((x) => x && typeof x === 'object' && !Array.isArray(x));
  for (const r of roots) {
    for (const k of keys) { const v = r[k]; if (v != null && (typeof v === 'number' || typeof v === 'string')) return v; }
  }
  return deepFind(resp, keys);
}
function str(v: any): string | undefined { return typeof v === 'string' && v.trim() ? v.trim() : undefined; }
function clip(v: string | undefined, n: number): string | undefined { return v ? v.slice(0, n) : undefined; }
function truthy(v: any): boolean { return v === true || v === 1 || v === '1' || v === 'true'; }
function isFalse(v: any): boolean { return v === false || v === 0 || v === '0' || v === 'false'; }
function urlFrom(v: any, depth = 0): string | undefined {
  if (v == null || depth > 5) return undefined;
  if (typeof v === 'string') return /^https?:\/\//.test(v) ? v.replace(/&amp;/g, '&') : undefined;
  if (Array.isArray(v)) { for (const x of v) { const u = urlFrom(x, depth + 1); if (u) return u; } return undefined; }
  if (typeof v === 'object') return urlFrom(v.url_list, depth + 1) || urlFrom(v.url, depth + 1) || urlFrom(v.uri, depth + 1) || urlFrom(v.src, depth + 1);
  return undefined;
}
function findUrl(obj: any, keys: string[], depth = 0): string | undefined {
  if (obj == null || depth > 7) return undefined;
  if (Array.isArray(obj)) { for (const it of obj) { const r = findUrl(it, keys, depth + 1); if (r) return r; } return undefined; }
  if (typeof obj === 'object') {
    for (const k of keys) { if (obj[k] != null) { const u = urlFrom(obj[k]); if (u) return u; } }
    for (const kk of Object.keys(obj)) { const r = findUrl(obj[kk], keys, depth + 1); if (r) return r; }
  }
  return undefined;
}

/** Лёгкий ретрай транзиентных сбоев TikHub (его скрапер иногда отвечает 400 "please retry"). */
async function getWithRetry(key: string, path: string, tries = 2): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  let last = { ok: false, status: 0, error: 'нет попытки' } as any;
  for (let i = 0; i < tries; i++) {
    // eslint-disable-next-line no-await-in-loop
    last = await tikhubGet(key, path, { timeoutMs: 30000 });
    if (last.ok) return last;
    const e = (last.error || '').toLowerCase();
    const transient = last.status === 429 || last.status >= 500 || last.status === 0 || /please retry|request failed|try again|timeout/.test(e);
    if (!transient) return last;
    // eslint-disable-next-line no-await-in-loop
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  return last;
}

// ── Конфиг постранички по площадке ──
interface PageCfg {
  profilePath: (h: string) => string;
  postsPath: (h: string, cursor?: string) => string;
  normalize: (raw: any) => NormalizedVideo[];
  cursorKeys: string[];   // где искать курсор следующей страницы
  hasMoreKeys: string[];  // явные флаги «есть ещё»
}
const PAGE: Record<ChannelPlatform, PageCfg> = {
  tiktok: {
    profilePath: (h) => `/api/v1/tiktok/web/fetch_user_profile?uniqueId=${enc(h)}`,
    postsPath: (h, c) => `/api/v1/tiktok/app/v3/fetch_user_post_videos?unique_id=${enc(h)}&count=30${c ? `&max_cursor=${enc(c)}` : ''}`,
    normalize: (raw) => normalizeVideos(raw),
    cursorKeys: ['max_cursor', 'maxCursor', 'cursor'],
    hasMoreKeys: ['has_more', 'hasMore'],
  },
  instagram: {
    profilePath: (h) => `/api/v1/instagram/v2/fetch_user_info?username=${enc(h)}`,
    postsPath: (h, c) => `/api/v1/instagram/v2/fetch_user_posts?username=${enc(h)}${c ? `&pagination_token=${enc(c)}` : ''}`,
    normalize: (raw) => genericNormalize('instagram', raw),
    cursorKeys: ['pagination_token', 'next_max_id', 'max_id', 'end_cursor', 'next_cursor', 'cursor'],
    hasMoreKeys: ['has_more', 'more_available', 'has_next_page'],
  },
  youtube: {
    profilePath: (h) => `/api/v1/youtube/web/get_channel_info?channel_id=${enc(h)}`,
    // Пагинация YouTube — параметр continuation_token (param `continuation` ИГНОРИРУЕТСЯ и
    // отдаёт ту же страницу); токен лежит в data.continuation_token (сверено вживую).
    postsPath: (h, c) => `/api/v1/youtube/web/get_channel_videos?channel_id=${enc(h)}${c ? `&continuation_token=${enc(c)}` : ''}`,
    normalize: (raw) => normalizeYoutube(raw),
    cursorKeys: ['continuation_token', 'continuation', 'next_page_token', 'nextPageToken', 'token'],
    hasMoreKeys: [],
  },
};

// YouTube Shorts — отдельный список (get_channel_short_videos), пагинация как у видео.
const YT_SHORTS: PageCfg = {
  profilePath: (h) => PAGE.youtube.profilePath(h),
  postsPath: (h, c) => `/api/v1/youtube/web/get_channel_short_videos?channel_id=${enc(h)}${c ? `&continuation_token=${enc(c)}` : ''}`,
  normalize: (raw) => normalizeYoutube(raw),
  cursorKeys: ['continuation_token', 'continuation', 'next_page_token', 'nextPageToken', 'token'],
  hasMoreKeys: [],
};

function channelUrl(platform: ChannelPlatform, handle: string): string {
  switch (platform) {
    case 'tiktok': return `https://www.tiktok.com/@${handle.replace(/^@/, '')}`;
    case 'instagram': return `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
    case 'youtube': return /^UC[\w-]{10,}$/.test(handle) ? `https://www.youtube.com/channel/${handle}` : `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}`;
  }
}

/** Ссылка на канал → {платформа, хэндл}. Поддержка TikTok/IG/YouTube (вкл. @handle/c/user для YT). */
export function detectChannel(url: string): { platform: ChannelPlatform; handle: string } | null {
  const u = (url || '').trim();
  const d = detectUrl(u);
  if (d && d.type === 'account' && d.username && (SUPPORTED as string[]).includes(d.platform)) {
    return { platform: d.platform as ChannelPlatform, handle: d.username };
  }
  // YouTube хэндл/кастом-URL, которые detectUrl не ловит (он знает только /channel/UC…).
  if (/youtube\.com/i.test(u)) {
    let m: RegExpMatchArray | null;
    if ((m = u.match(/youtube\.com\/@([\w.\-]+)/i))) return { platform: 'youtube', handle: '@' + m[1] };
    if ((m = u.match(/youtube\.com\/(?:c|user)\/([\w.\-]+)/i))) return { platform: 'youtube', handle: m[1] };
  }
  return null;
}

async function fetchProfile(key: string, platform: ChannelPlatform, handle: string): Promise<ChannelProfile> {
  const r = await getWithRetry(key, PAGE[platform].profilePath(handle));
  const root = r.ok ? r.data : {};
  return {
    platform,
    handle,
    displayName: str(deepFind(root, ['nickname', 'full_name', 'channel_name', 'title', 'name', 'display_name', 'fullname'])),
    avatarUrl: findUrl(root, ['avatar_larger', 'avatar_medium', 'avatar_thumb', 'avatar_168x168', 'avatar', 'profile_pic_url_hd', 'profile_pic_url', 'avatar_url', 'thumbnail']),
    bio: clip(str(deepFind(root, ['signature', 'biography', 'bio', 'description'])), 300),
    followers: parseCount(deepFind(root, ['follower_count', 'followerCount', 'followers', 'fans', 'subscriber_count', 'subscribers', 'subscriberCount', 'edge_followed_by'])),
    verified: !!deepFind(root, ['is_verified', 'verified', 'custom_verify', 'enterprise_verify_reason']),
    url: channelUrl(platform, handle),
  };
}

interface PostsResult { videos: NormalizedVideo[]; hasMore: boolean; pages: number; error?: string }
async function fetchAllPosts(key: string, cfg: PageCfg, platform: ChannelPlatform, handle: string, maxVideos: number): Promise<PostsResult> {
  const MAX_PAGES = 13;                  // потолок вызовов TikHub (защита ключа); хватает на
                                         // ~120 видео даже у площадок с мелкой страницей (TikTok ~10/стр)
  const out: NormalizedVideo[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;
  let hasMore = false;
  let firstError: string | undefined;
  for (let i = 0; i < MAX_PAGES && out.length < maxVideos; i++) {
    // eslint-disable-next-line no-await-in-loop
    const r = await getWithRetry(key, cfg.postsPath(handle, cursor));
    pages++;
    if (!r.ok) { if (i === 0) firstError = r.error; break; }
    const batch = cfg.normalize(r.data);
    // TikTok: static cover/origin_cover приходят в HEIC (браузер не рендерит в <img>) —
    // берём dynamic_cover (jpeg). Подписанный CDN-URL всё равно идёт через cover-прокси.
    if (platform === 'tiktok') {
      for (const v of batch) {
        const dyn = (v.raw?.video?.dynamic_cover || v.raw?.video?.dynamicCover)?.url_list?.[0];
        if (typeof dyn === 'string' && /^https?:/.test(dyn)) v.coverUrl = dyn;
      }
    }
    let added = 0;
    for (const v of batch) {
      const k = v.externalId;
      if (!k || seen.has(k)) continue;
      seen.add(k); out.push(v); added++;
      if (out.length >= maxVideos) break;
    }
    // Курсор/флаг берём С КОРНЯ ответа (pickField), а не deepFind по всему дереву.
    const nextCursorRaw = pickField(r.data, cfg.cursorKeys);
    const nextCursor = nextCursorRaw == null || nextCursorRaw === '' ? undefined : String(nextCursorRaw);
    const moreRaw = cfg.hasMoreKeys.length ? pickField(r.data, cfg.hasMoreKeys) : undefined;
    // eslint-disable-next-line no-console
    console.log(`[CHANNELS] ${platform} @${handle} page=${i + 1} added=${added} total=${out.length} cursor=${nextCursor ? 'yes' : 'no'} hasMore=${moreRaw}`);
    if (out.length >= maxVideos) { hasMore = true; break; }
    if (added === 0) { hasMore = false; break; }            // страница без новых видео
    if (isFalse(moreRaw)) { hasMore = false; break; }       // явное «больше нет»
    if (!nextCursor || nextCursor === cursor) {             // курсор не распознан/не двигается → стоп
      hasMore = cfg.hasMoreKeys.length ? truthy(moreRaw) : false;
      break;
    }
    cursor = nextCursor;
    hasMore = true;
  }
  return { videos: out.slice(0, maxVideos), hasMore, pages, error: firstError };
}

/** Главная точка Фазы 1: ссылка на канал → профиль + все видео (постранично). */
export async function analyzeChannel(
  tenantId: string,
  url: string,
  opts?: { maxVideos?: number }
): Promise<ChannelAnalysis> {
  const det = detectChannel(url);
  if (!det) {
    throw new Error('Не распознал ссылку на канал. Вставьте ссылку на профиль: TikTok (tiktok.com/@user), Instagram (instagram.com/user) или YouTube (youtube.com/channel/UC… либо /@handle).');
  }
  const key = await getEffectiveTikHubKey(tenantId);
  if (!key) throw new Error('Ключ Trend не задан. Укажите свой ключ в настройках Enterprise или платформенный в админке.');

  const maxVideos = Math.min(Math.max(opts?.maxVideos ?? 120, 1), 300);
  // raw не отдаём на фронт (он огромный); isShort проставляем для YouTube.
  const strip = (v: NormalizedVideo, isShort?: boolean): ChannelVideo => { const { raw, ...rest } = v; return isShort == null ? rest : { ...rest, isShort }; };

  // YouTube: тянем И обычные ролики (get_channel_videos), И Shorts (get_channel_short_videos)
  // — отдельными списками; помечаем isShort, чтобы фронт развёл по вкладкам.
  if (det.platform === 'youtube') {
    const [profile, reg, shorts] = await Promise.all([
      fetchProfile(key, 'youtube', det.handle),
      fetchAllPosts(key, PAGE.youtube, 'youtube', det.handle, maxVideos),
      fetchAllPosts(key, YT_SHORTS, 'youtube', det.handle, maxVideos),
    ]);
    const seen = new Set<string>();
    const videos: ChannelVideo[] = [];
    for (const v of reg.videos) { if (v.externalId && !seen.has(v.externalId)) { seen.add(v.externalId); videos.push(strip(v, false)); } }
    for (const v of shorts.videos) { if (v.externalId && !seen.has(v.externalId)) { seen.add(v.externalId); videos.push(strip(v, true)); } }
    let note: string | undefined;
    if (videos.length === 0) note = (reg.error || shorts.error) ? `Не удалось получить видео: ${reg.error || shorts.error}` : 'Видео не найдены. Для YouTube надёжнее ссылка вида youtube.com/channel/UC…';
    return { profile, videos, count: videos.length, hasMore: reg.hasMore || shorts.hasMore, pagesFetched: reg.pages + shorts.pages, note };
  }

  const [profile, posts] = await Promise.all([
    fetchProfile(key, det.platform, det.handle),
    fetchAllPosts(key, PAGE[det.platform], det.platform, det.handle, maxVideos),
  ]);
  const videos: ChannelVideo[] = posts.videos.map((v) => strip(v));
  let note: string | undefined;
  if (videos.length === 0) {
    note = posts.error ? `Не удалось получить видео: ${posts.error}` : 'Видео не найдены — возможно, профиль приватный или ссылка неверна.';
  }
  return { profile, videos, count: videos.length, hasMore: posts.hasMore, pagesFetched: posts.pages, note };
}
