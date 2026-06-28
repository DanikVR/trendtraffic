/**
 * Провайдеры трендов по площадкам (поиск + «горячее»).
 *
 * TikTok — реюз существующих searchVideos/fetchTrending/normalizeVideos.
 * Instagram / YouTube / X / Reddit — точные эндпоинты TikHub (сверены с openapi.json)
 * + оборонительный generic-нормализатор (ищет массив постов и тянет типовые поля),
 * приводящий ответ к общему NormalizedVideo (как у TikTok).
 */

import { tikhubGet, searchVideos, fetchTrending, normalizeVideos, type NormalizedVideo, type TikHubResult } from './tikhub_client.js';

export type TrendPlatform = 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'reddit';
export const TREND_PLATFORMS: TrendPlatform[] = ['tiktok', 'instagram', 'youtube', 'twitter', 'reddit'];
export function isTrendPlatform(x: any): x is TrendPlatform { return typeof x === 'string' && (TREND_PLATFORMS as string[]).includes(x); }

// ── Оборонительные хелперы (как в trends/analytics.ts) ──
function deepFind(obj: any, keys: string[], depth = 0): any {
  if (obj == null || depth > 7) return undefined;
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
function urlFrom(v: any, depth = 0): string | undefined {
  if (v == null || depth > 5) return undefined;
  if (typeof v === 'string') return /^https?:\/\//.test(v) ? v.replace(/&amp;/g, '&') : undefined;
  if (Array.isArray(v)) { for (const x of v) { const u = urlFrom(x, depth + 1); if (u) return u; } return undefined; }
  if (typeof v === 'object') {
    return urlFrom(v.url_list, depth + 1) || urlFrom(v.url, depth + 1) || urlFrom(v.uri, depth + 1) || urlFrom(v.src, depth + 1)
      || urlFrom(v.media_url_https, depth + 1) || urlFrom(v.source, depth + 1) || urlFrom(v.images, depth + 1)
      || urlFrom(v.candidates, depth + 1) || urlFrom(v.thumbnails, depth + 1);
  }
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
function findArrayOfObjects(obj: any, keys: string[], depth = 0): any[] | null {
  if (obj == null || depth > 7) return null;
  if (Array.isArray(obj)) {
    const hit = obj.some((it) => it && typeof it === 'object' && keys.some((k) => it[k] != null));
    if (obj.length && hit) return obj;
    for (const it of obj) { const r = findArrayOfObjects(it, keys, depth + 1); if (r) return r; }
    return null;
  }
  if (typeof obj === 'object') { for (const kk of Object.keys(obj)) { const r = findArrayOfObjects(obj[kk], keys, depth + 1); if (r) return r; } }
  return null;
}
function str(v: any): string | undefined { return typeof v === 'string' && v.trim() ? v : undefined; }
function pickText(it: any): string | undefined {
  return str(it?.desc) || str(it?.caption?.text) || str(typeof it?.caption === 'string' ? it.caption : undefined)
    || str(it?.title) || str(it?.full_text) || str(it?.text) || str(it?.selftext) || str(it?.content?.message);
}

function webUrlFor(platform: TrendPlatform, id: string, handle: string | undefined, item: any): string | undefined {
  switch (platform) {
    case 'instagram': { const code = deepFind(item, ['code', 'shortcode']); return code ? `https://www.instagram.com/p/${code}/` : undefined; }
    case 'youtube': return id ? `https://www.youtube.com/watch?v=${id}` : undefined;
    case 'twitter': { const sn = handle || deepFind(item, ['screen_name']); return sn && id ? `https://x.com/${sn}/status/${id}` : (id ? `https://x.com/i/status/${id}` : undefined); }
    case 'reddit': { const pl = deepFind(item, ['permalink']); return pl ? `https://www.reddit.com${pl}` : undefined; }
    default: return undefined;
  }
}

/** Generic-нормализатор: ответ площадки → NormalizedVideo[] (оборонительно). */
export function genericNormalize(platform: TrendPlatform, raw: any): NormalizedVideo[] {
  const arr = findArrayOfObjects(raw, ['aweme_id', 'video_id', 'id_str', 'rest_id', 'tweet_id', 'pk', 'code', 'id', 'permalink', 'desc', 'caption', 'title', 'full_text']) || [];
  const out: NormalizedVideo[] = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const externalId = String(deepFind(it, ['aweme_id', 'video_id', 'id_str', 'rest_id', 'tweet_id', 'pk', 'code', 'id']) ?? '');
    if (!externalId) continue;
    const handle = str(deepFind(it, ['unique_id', 'username', 'screen_name', 'channel_handle']))
      || (typeof it.author === 'string' ? it.author : str(deepFind(it.author, ['name', 'username'])))
      || str(deepFind(it, ['author_fullname']));
    const authorName = str(deepFind(it, ['nickname', 'full_name', 'name', 'channel', 'author_name', 'channel_name']));
    out.push({
      externalId,
      platform,
      author: handle || authorName || '',
      authorName,
      description: pickText(it),
      coverUrl: findUrl(it, ['cover', 'origin_cover', 'dynamic_cover', 'thumbnail_url', 'display_url', 'thumbnail', 'image_versions2', 'preview', 'media_url_https', 'images', 'source']),
      videoUrl: findUrl(it, ['play_addr', 'download_addr', 'video_url', 'video_versions', 'play_url', 'contentUrl']),
      webUrl: webUrlFor(platform, externalId, handle, it),
      durationSec: num(deepFind(it, ['duration', 'length_seconds', 'video_duration'])),
      createTime: num(deepFind(it, ['create_time', 'createTime', 'taken_at', 'created_at', 'timestamp', 'published_time', 'created_utc'])),
      stats: {
        play: num(deepFind(it, ['play_count', 'playCount', 'view_count', 'viewCount', 'views'])),
        like: num(deepFind(it, ['digg_count', 'like_count', 'favorite_count', 'likeCount', 'score', 'ups', 'likes'])),
        comment: num(deepFind(it, ['comment_count', 'commentCount', 'reply_count', 'num_comments', 'comments'])),
        share: num(deepFind(it, ['share_count', 'forward_count', 'retweet_count', 'shareCount', 'shares'])),
      },
      raw: it,
    });
  }
  return out;
}

export type SearchFilters = Record<string, string>;
// Собирает все вложенные объекты по ключу (для renderer-деревьев YouTube).
function collectByKey(obj: any, keys: string[], out: any[], depth = 0): void {
  if (obj == null || depth > 14) return;
  if (Array.isArray(obj)) { for (const it of obj) collectByKey(it, keys, out, depth + 1); return; }
  if (typeof obj === 'object') {
    for (const k of keys) { if (obj[k] && typeof obj[k] === 'object') out.push(obj[k]); }
    for (const kk of Object.keys(obj)) collectByKey(obj[kk], keys, out, depth + 1);
  }
}
// YouTube innertube текст: {simpleText} | {runs:[{text}]} | строка.
function ytText(v: any): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v.simpleText === 'string') return v.simpleText;
  if (Array.isArray(v.runs)) return v.runs.map((r: any) => r?.text || '').join('');
  return undefined;
}
/** YouTube: достаём videoRenderer/reelItemRenderer из дерева contents. */
export function normalizeYoutube(raw: any): NormalizedVideo[] {
  const renderers: any[] = [];
  collectByKey(raw, ['videoRenderer', 'reelItemRenderer', 'compactVideoRenderer', 'gridVideoRenderer'], renderers);
  const out: NormalizedVideo[] = [];
  const seen = new Set<string>();
  for (const r of renderers) {
    const id = String(r.videoId || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const author = ytText(r.ownerText) || ytText(r.longBylineText) || ytText(r.shortBylineText);
    const thumbs = r.thumbnail?.thumbnails;
    const cover = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1]?.url : undefined;
    const lenTxt = ytText(r.lengthText);
    let durationSec: number | undefined;
    if (lenTxt && /\d/.test(lenTxt)) durationSec = lenTxt.split(':').map((x) => parseInt(x, 10) || 0).reduce((a, b) => a * 60 + b, 0);
    out.push({
      externalId: id, platform: 'youtube',
      author: author || '', authorName: author,
      description: ytText(r.title) || ytText(r.headline),
      coverUrl: typeof cover === 'string' ? cover : undefined,
      videoUrl: undefined,
      webUrl: `https://www.youtube.com/watch?v=${id}`,
      durationSec, createTime: undefined,
      stats: { play: num(ytText(r.viewCountText) || ytText(r.shortViewCountText)) },
      raw: r,
    });
  }
  return out;
}
// X/Twitter: собираем объекты-твиты (есть legacy.full_text + rest_id/id_str).
function collectTweets(obj: any, out: any[], depth = 0): void {
  if (obj == null || depth > 16) return;
  if (Array.isArray(obj)) { for (const it of obj) collectTweets(it, out, depth + 1); return; }
  if (typeof obj === 'object') {
    const lg = obj.legacy;
    if (lg && typeof lg === 'object' && typeof lg.full_text === 'string' && (obj.rest_id || lg.id_str)) out.push(obj);
    for (const kk of Object.keys(obj)) collectTweets(obj[kk], out, depth + 1);
  }
}
/** X/Twitter: твиты из GraphQL-таймлайна. */
export function normalizeTwitter(raw: any): NormalizedVideo[] {
  const tweets: any[] = [];
  collectTweets(raw, tweets);
  const out: NormalizedVideo[] = [];
  const seen = new Set<string>();
  for (const t of tweets) {
    const lg = t.legacy || {};
    const id = String(t.rest_id || lg.id_str || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const user = t.core?.user_results?.result?.legacy || t.core?.user_results?.result?.core || {};
    const screen = str(user.screen_name) || str(user.username);
    const media = (lg.extended_entities?.media || lg.entities?.media || [])[0];
    const variants: any[] = media?.video_info?.variants || [];
    const mp4 = variants.filter((v) => v?.content_type === 'video/mp4').sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    let createTime: number | undefined;
    if (lg.created_at) { const ts = Date.parse(lg.created_at); if (Number.isFinite(ts)) createTime = Math.floor(ts / 1000); }
    out.push({
      externalId: id, platform: 'twitter',
      author: screen || str(user.name) || '', authorName: str(user.name),
      description: lg.full_text,
      coverUrl: urlFrom(media?.media_url_https) || urlFrom(media),
      videoUrl: mp4?.url,
      webUrl: screen ? `https://x.com/${screen}/status/${id}` : `https://x.com/i/status/${id}`,
      durationSec: media?.video_info?.duration_millis ? Math.round(media.video_info.duration_millis / 1000) : undefined,
      createTime,
      stats: { play: num(t.views?.count ?? lg.view_count), like: num(lg.favorite_count), comment: num(lg.reply_count), share: num(lg.retweet_count) },
      raw: t,
    });
  }
  return out;
}

export interface TrendProvider {
  /** Есть ли у площадки лента «горячее»/explore (иначе только поиск по ключевику). */
  hasTrending: boolean;
  search(key: string, query: string, opts: { count: number; filters?: SearchFilters }): Promise<TikHubResult<any>>;
  trending(key: string, opts: { count: number }): Promise<TikHubResult<any>>;
  normalize(raw: any): NormalizedVideo[];
}

const enc = encodeURIComponent;
/** Собирает query-string из базовых пар + непустых фильтров (whitelist ключей). */
function qs(base: Record<string, string>, filters: SearchFilters | undefined, allow: string[]): string {
  const parts = Object.entries(base).map(([k, v]) => `${k}=${enc(v)}`);
  for (const k of allow) { const v = filters?.[k]; if (v != null && String(v).trim()) parts.push(`${k}=${enc(String(v))}`); }
  return parts.join('&');
}

export const TREND_PROVIDERS: Record<TrendPlatform, TrendProvider> = {
  tiktok: {
    hasTrending: true,
    search: (k, q, o) => searchVideos(k, q, { count: o.count, mode: 'app' }),
    trending: (k, o) => fetchTrending(k, { count: o.count }),
    normalize: (raw) => normalizeVideos(raw),
  },
  instagram: {
    hasTrending: true,
    // Instagram-поиск принимает только keyword — фильтров у API нет.
    search: (k, q) => tikhubGet(k, `/api/v1/instagram/v2/search_reels?keyword=${enc(q)}`, { timeoutMs: 30000 }),
    trending: (k) => tikhubGet(k, `/api/v1/instagram/v3/get_explore`, { timeoutMs: 30000 }),
    normalize: (raw) => genericNormalize('instagram', raw),
  },
  youtube: {
    hasTrending: true,
    // get_general_search: sort_by / upload_time / duration.
    search: (k, q, o) => tikhubGet(k, `/api/v1/youtube/web/get_general_search?${qs({ search_query: q }, o.filters, ['sort_by', 'upload_time', 'duration'])}`, { timeoutMs: 30000 }),
    trending: (k) => tikhubGet(k, `/api/v1/youtube/web/get_trending_videos?section=Now`, { timeoutMs: 30000 }),
    normalize: (raw) => normalizeYoutube(raw),
  },
  twitter: {
    hasTrending: false, // fetch_trending отдаёт ТЕМЫ, а не посты — ленту постов даём только через поиск
    // search_type: Top / Latest / Media.
    search: (k, q, o) => tikhubGet(k, `/api/v1/twitter/web/fetch_search_timeline?${qs({ keyword: q, search_type: o.filters?.search_type || 'Top' }, undefined, [])}`, { timeoutMs: 30000 }),
    trending: (k) => tikhubGet(k, `/api/v1/twitter/web/fetch_trending?country=UnitedStates`, { timeoutMs: 30000 }),
    normalize: (raw) => normalizeTwitter(raw),
  },
  reddit: {
    hasTrending: true,
    // fetch_dynamic_search: sort / time_range.
    search: (k, q, o) => tikhubGet(k, `/api/v1/reddit/app/fetch_dynamic_search?${qs({ query: q, search_type: 'post' }, o.filters, ['sort', 'time_range'])}`, { timeoutMs: 30000 }),
    trending: (k) => tikhubGet(k, `/api/v1/reddit/app/fetch_popular_feed`, { timeoutMs: 30000 }),
    normalize: (raw) => genericNormalize('reddit', raw),
  },
};
