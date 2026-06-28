/**
 * Аналитика по ссылке (порт расширения «TikHub Social Media Toolkit» в веб).
 *
 * Вставляешь публичную ссылку на видео/пост или аккаунт → backend определяет
 * платформу и тип, дёргает соответствующие эндпоинты TikHub НАШИМ ключом
 * (getEffectiveTikHubKey) и возвращает:
 *   • blocks — сырые ответы TikHub по каждому вызову (для экспорта JSON, как в
 *     расширении — «raw data»);
 *   • summary — лёгкая оборонительная сводка (просмотры/лайки/комменты/шеры +
 *     engagement-rate), извлечённая глубоким поиском по ключам (shape у каждой
 *     платформы свой, поэтому ищем по типовым именам полей).
 *
 * Поддержка: TikTok, Douyin, Instagram, X (Twitter), Bilibili.
 * Точные пути и параметры эндпоинтов сверены с OpenAPI-спеком TikHub.
 */

import { tikhubGet } from '../tikhub/tikhub_client.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';

export type Platform = 'tiktok' | 'douyin' | 'instagram' | 'twitter' | 'bilibili';
export type ContentType = 'video' | 'account';

export interface Detected {
  platform: Platform;
  type: ContentType;
  videoId?: string;   // aweme_id / tweet_id / BV-id / instagram-code
  username?: string;  // uniqueId / screen_name / ig-username / douyin sec_user_id / bili uid
}

const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok', douyin: 'Douyin', instagram: 'Instagram', twitter: 'X (Twitter)', bilibili: 'Bilibili',
};

/** Разбирает публичную ссылку → платформа + тип (видео/аккаунт) + идентификатор. */
export function detectUrl(input: string): Detected | null {
  const u = (input || '').trim();
  let m: RegExpMatchArray | null;
  if (/tiktok\.com/i.test(u)) {
    if ((m = u.match(/\/video\/(\d+)/))) return { platform: 'tiktok', type: 'video', videoId: m[1] };
    if ((m = u.match(/@([\w.\-]+)/))) return { platform: 'tiktok', type: 'account', username: m[1] };
  }
  if (/douyin\.com/i.test(u)) {
    if ((m = u.match(/\/video\/(\d+)/))) return { platform: 'douyin', type: 'video', videoId: m[1] };
    if ((m = u.match(/\/user\/([\w\-]+)/))) return { platform: 'douyin', type: 'account', username: m[1] };
  }
  if (/instagram\.com/i.test(u)) {
    if ((m = u.match(/\/(?:p|reel|tv)\/([\w\-]+)/))) return { platform: 'instagram', type: 'video', videoId: m[1] };
    if ((m = u.match(/instagram\.com\/([\w.\-]+)\/?(?:\?.*)?$/))) return { platform: 'instagram', type: 'account', username: m[1] };
  }
  if (/(?:twitter|x)\.com/i.test(u)) {
    if ((m = u.match(/\/status\/(\d+)/))) return { platform: 'twitter', type: 'video', videoId: m[1] };
    if ((m = u.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]+)\/?(?:\?.*)?$/))) return { platform: 'twitter', type: 'account', username: m[1] };
  }
  if (/bilibili\.com/i.test(u) || /b23\.tv/i.test(u)) {
    if ((m = u.match(/\/video\/(BV[\w]+)/i))) return { platform: 'bilibili', type: 'video', videoId: m[1] };
    if ((m = u.match(/space\.bilibili\.com\/(\d+)/))) return { platform: 'bilibili', type: 'account', username: m[1] };
  }
  return null;
}

const enc = encodeURIComponent;

/** Карта вызовов TikHub по (платформа, тип). Параметры сверены с openapi.json. */
function planCalls(d: Detected): { label: string; path: string }[] {
  const v = d.videoId || '';
  const u = d.username || '';
  if (d.type === 'video') {
    switch (d.platform) {
      case 'tiktok': return [
        { label: 'video', path: `/api/v1/tiktok/app/v3/fetch_one_video?aweme_id=${enc(v)}` },
        { label: 'metrics', path: `/api/v1/tiktok/analytics/fetch_video_metrics?item_id=${enc(v)}` },
        { label: 'comments', path: `/api/v1/tiktok/app/v3/fetch_video_comments?aweme_id=${enc(v)}&count=30` },
        { label: 'commentKeywords', path: `/api/v1/tiktok/analytics/fetch_comment_keywords?item_id=${enc(v)}` },
      ];
      case 'douyin': return [
        { label: 'video', path: `/api/v1/douyin/app/v3/fetch_one_video?aweme_id=${enc(v)}` },
        { label: 'comments', path: `/api/v1/douyin/app/v3/fetch_video_comments?aweme_id=${enc(v)}&count=30` },
      ];
      case 'instagram': return [
        { label: 'video', path: `/api/v1/instagram/v3/get_post_info_by_code?code=${enc(v)}` },
        { label: 'comments', path: `/api/v1/instagram/v3/get_post_comments?code=${enc(v)}` },
      ];
      case 'twitter': return [
        { label: 'video', path: `/api/v1/twitter/web/fetch_tweet_detail?tweet_id=${enc(v)}` },
        { label: 'comments', path: `/api/v1/twitter/web/fetch_post_comments?tweet_id=${enc(v)}` },
      ];
      case 'bilibili': return [
        { label: 'video', path: `/api/v1/bilibili/app/fetch_one_video?bv_id=${enc(v)}` },
        { label: 'comments', path: `/api/v1/bilibili/app/fetch_video_comments?bv_id=${enc(v)}` },
      ];
    }
  } else {
    switch (d.platform) {
      case 'tiktok': return [
        { label: 'account', path: `/api/v1/tiktok/web/fetch_user_profile?uniqueId=${enc(u)}` },
        { label: 'posts', path: `/api/v1/tiktok/app/v3/fetch_user_post_videos?unique_id=${enc(u)}&count=20` },
      ];
      case 'douyin': return [
        { label: 'account', path: `/api/v1/douyin/app/v3/handler_user_profile?sec_user_id=${enc(u)}` },
        { label: 'posts', path: `/api/v1/douyin/app/v3/fetch_user_post_videos?sec_user_id=${enc(u)}&count=20` },
      ];
      case 'instagram': return [
        { label: 'account', path: `/api/v1/instagram/v2/fetch_user_info?username=${enc(u)}` },
        { label: 'posts', path: `/api/v1/instagram/v2/fetch_user_posts?username=${enc(u)}` },
      ];
      case 'twitter': return [
        { label: 'account', path: `/api/v1/twitter/web/fetch_user_profile?screen_name=${enc(u)}` },
        { label: 'posts', path: `/api/v1/twitter/web/fetch_user_post_tweet?screen_name=${enc(u)}` },
      ];
      case 'bilibili': return [
        { label: 'account', path: `/api/v1/bilibili/app/fetch_user_info?user_id=${enc(u)}` },
        { label: 'posts', path: `/api/v1/bilibili/app/fetch_user_videos?user_id=${enc(u)}` },
      ];
    }
  }
  return [];
}

// ── Оборонительная сводка: глубокий поиск типовых полей по ответу ──
function deepFind(obj: any, keys: string[], depth = 0): any {
  if (obj == null || depth > 7) return undefined;
  if (Array.isArray(obj)) {
    for (const it of obj) { const r = deepFind(it, keys, depth + 1); if (r !== undefined) return r; }
    return undefined;
  }
  if (typeof obj === 'object') {
    for (const k of keys) { const val = obj[k]; if (val != null && (typeof val === 'number' || typeof val === 'string')) return val; }
    for (const kk of Object.keys(obj)) { const r = deepFind(obj[kk], keys, depth + 1); if (r !== undefined) return r; }
  }
  return undefined;
}
function num(v: any): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

function buildSummary(blocks: Record<string, AnalyzeBlock>): Record<string, any> {
  const root = blocks.video?.data ?? blocks.account?.data;
  if (!root) return {};
  const views = num(deepFind(root, ['play_count', 'playCount', 'view_count', 'viewCount', 'views', 'stat_view_count', 'play']));
  const likes = num(deepFind(root, ['digg_count', 'diggCount', 'like_count', 'likeCount', 'favorite_count', 'favoriteCount', 'likes']));
  const comments = num(deepFind(root, ['comment_count', 'commentCount', 'reply_count', 'comments']));
  const shares = num(deepFind(root, ['share_count', 'shareCount', 'forward_count', 'retweet_count', 'shares']));
  const followers = num(deepFind(root, ['follower_count', 'followerCount', 'followers', 'fans', 'total']));
  const desc = deepFind(root, ['desc', 'title', 'caption', 'full_text', 'content', 'text', 'signature']);
  const author = deepFind(root, ['nickname', 'unique_id', 'uniqueId', 'screen_name', 'username', 'name']);
  const er = views && views > 0
    ? Number((((likes || 0) + (comments || 0) + (shares || 0)) / views * 100).toFixed(2))
    : undefined;
  return { author, desc: typeof desc === 'string' ? desc.slice(0, 400) : desc, views, likes, comments, shares, followers, engagementRate: er };
}

interface AnalyzeBlock { ok: boolean; error?: string; data?: any; }
export interface AnalyzeResult {
  detected: Detected & { platformLabel: string };
  blocks: Record<string, AnalyzeBlock>;
  summary: Record<string, any>;
}

/** Главная точка: ссылка → аналитика. Бросает понятную ошибку при проблемах ключа/распознавания. */
export async function analyzeUrl(tenantId: string, url: string): Promise<AnalyzeResult> {
  const detected = detectUrl(url);
  if (!detected) {
    throw new Error('Не распознал ссылку. Вставьте ссылку на видео/пост или аккаунт: TikTok, Douyin, Instagram, X (Twitter) или Bilibili.');
  }
  const key = await getEffectiveTikHubKey(tenantId);
  if (!key) throw new Error('Ключ Trend не задан. Укажите свой ключ в настройках Enterprise или платформенный в админке.');

  const calls = planCalls(detected);
  const blocks: Record<string, AnalyzeBlock> = {};
  for (const c of calls) {
    // eslint-disable-next-line no-await-in-loop
    const r = await tikhubGet(key, c.path, { timeoutMs: 30000 });
    blocks[c.label] = r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error };
  }
  return {
    detected: { ...detected, platformLabel: PLATFORM_LABEL[detected.platform] },
    blocks,
    summary: buildSummary(blocks),
  };
}
