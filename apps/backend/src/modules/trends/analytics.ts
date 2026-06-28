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
import { resolveAnthropicKey, DEFAULT_DIRECTOR_MODEL } from '../render/director.js';

export type Platform = 'tiktok' | 'douyin' | 'instagram' | 'twitter' | 'bilibili' | 'youtube' | 'reddit';
export type ContentType = 'video' | 'account';

export interface Detected {
  platform: Platform;
  type: ContentType;
  videoId?: string;   // aweme_id / tweet_id / BV-id / instagram-code
  username?: string;  // uniqueId / screen_name / ig-username / douyin sec_user_id / bili uid
}

const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok', douyin: 'Douyin', instagram: 'Instagram', twitter: 'X (Twitter)', bilibili: 'Bilibili',
  youtube: 'YouTube', reddit: 'Reddit',
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
  if (/youtube\.com/i.test(u) || /youtu\.be/i.test(u)) {
    if ((m = u.match(/[?&]v=([\w-]{8,})/))) return { platform: 'youtube', type: 'video', videoId: m[1] };
    if ((m = u.match(/\/(?:shorts|embed|live)\/([\w-]{8,})/))) return { platform: 'youtube', type: 'video', videoId: m[1] };
    if ((m = u.match(/youtu\.be\/([\w-]{8,})/))) return { platform: 'youtube', type: 'video', videoId: m[1] };
    if ((m = u.match(/\/channel\/(UC[\w-]+)/))) return { platform: 'youtube', type: 'account', username: m[1] };
  }
  if (/reddit\.com/i.test(u) || /redd\.it/i.test(u)) {
    if ((m = u.match(/\/comments\/([a-z0-9]+)/i))) return { platform: 'reddit', type: 'video', videoId: m[1] };
    if ((m = u.match(/redd\.it\/([a-z0-9]+)/i))) return { platform: 'reddit', type: 'video', videoId: m[1] };
    if ((m = u.match(/\/(?:user|u)\/([\w\-]+)/i))) return { platform: 'reddit', type: 'account', username: m[1] };
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
      case 'youtube': return [
        { label: 'video', path: `/api/v1/youtube/web_v2/get_video_info?video_id=${enc(v)}&need_format=true` },
        { label: 'comments', path: `/api/v1/youtube/web_v2/get_video_comments?video_id=${enc(v)}&need_format=true` },
      ];
      case 'reddit': return [
        { label: 'video', path: `/api/v1/reddit/app/fetch_post_details?post_id=${enc(v)}&need_format=true` },
        { label: 'comments', path: `/api/v1/reddit/app/fetch_post_comments?post_id=${enc(v)}&need_format=true` },
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
      case 'youtube': return [
        { label: 'account', path: `/api/v1/youtube/web/get_channel_info?channel_id=${enc(u)}` },
        { label: 'posts', path: `/api/v1/youtube/web/get_channel_videos?channel_id=${enc(u)}` },
      ];
      case 'reddit': return [
        { label: 'account', path: `/api/v1/reddit/app/fetch_user_profile?username=${enc(u)}&need_format=true` },
        { label: 'posts', path: `/api/v1/reddit/app/fetch_user_posts?username=${enc(u)}&need_format=true` },
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

// Достаёт URL из значения (строка-http / {url_list:[]} / {url} / {uri}).
function urlFrom(v: any, depth = 0): string | undefined {
  if (v == null || depth > 4) return undefined;
  if (typeof v === 'string') return /^https?:\/\//.test(v) ? v : undefined;
  if (Array.isArray(v)) { for (const x of v) { const u = urlFrom(x, depth + 1); if (u) return u; } return undefined; }
  if (typeof v === 'object') return urlFrom(v.url_list, depth + 1) || urlFrom(v.url, depth + 1) || urlFrom(v.uri, depth + 1) || urlFrom(v.src, depth + 1);
  return undefined;
}
// Глубокий поиск первого поля из keys, значение которого превращается в URL.
function findUrl(obj: any, keys: string[], depth = 0): string | undefined {
  if (obj == null || depth > 7) return undefined;
  if (Array.isArray(obj)) { for (const it of obj) { const r = findUrl(it, keys, depth + 1); if (r) return r; } return undefined; }
  if (typeof obj === 'object') {
    for (const k of keys) { if (obj[k] != null) { const u = urlFrom(obj[k]); if (u) return u; } }
    for (const kk of Object.keys(obj)) { const r = findUrl(obj[kk], keys, depth + 1); if (r) return r; }
  }
  return undefined;
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
  const handle = deepFind(root, ['unique_id', 'uniqueId', 'screen_name', 'username']);
  // Визуальные поля для «карточки поста» (как в расширении).
  const cover = findUrl(root, ['cover', 'origin_cover', 'dynamic_cover', 'thumbnail_url', 'display_url', 'thumbnail', 'pic', 'first_frame']);
  const avatar = findUrl(root, ['avatar_thumb', 'avatar_medium', 'avatar_larger', 'avatar_168x168', 'avatar', 'profile_pic_url', 'face']);
  const music = deepFind(root, ['music_title']) ?? (root?.music && typeof root.music === 'object' ? deepFind(root.music, ['title']) : undefined);
  const createTime = num(deepFind(root, ['create_time', 'createTime', 'taken_at', 'created_at', 'timestamp', 'pubdate', 'ctime']));
  const duration = num(deepFind(root, ['duration']));
  const region = deepFind(root, ['region', 'create_country', 'location']);
  const verified = !!deepFind(root, ['is_verified', 'verified', 'custom_verify', 'enterprise_verify_reason']);
  const bio = deepFind(root, ['signature', 'biography', 'bio', 'description']);
  const descStr = typeof desc === 'string' ? desc : '';
  const hashtags = (descStr.match(/#[\p{L}\p{N}_]+/gu) || []).slice(0, 12);
  const er = views && views > 0
    ? Number((((likes || 0) + (comments || 0) + (shares || 0)) / views * 100).toFixed(2))
    : undefined;
  return {
    author, handle, desc: descStr.slice(0, 600), views, likes, comments, shares, followers, engagementRate: er,
    cover, avatar, music, createTime, duration, region, verified,
    bio: typeof bio === 'string' ? bio.slice(0, 300) : undefined, hashtags,
  };
}

// ── Нормализаторы (кросс-платформенные, оборонительные) ──
// Ищем первый массив объектов, у элементов которого есть одно из текстовых полей
// (text / content.message / full_text …) — это и есть список комментариев/постов.
function findArrayOfObjects(obj: any, keys: string[], depth = 0): any[] | null {
  if (obj == null || depth > 7) return null;
  if (Array.isArray(obj)) {
    const hit = obj.some((it) => it && typeof it === 'object' &&
      keys.some((k) => k.split('.').reduce((o: any, p) => (o == null ? o : o[p]), it) != null));
    if (obj.length && hit) return obj;
    for (const it of obj) { const r = findArrayOfObjects(it, keys, depth + 1); if (r) return r; }
    return null;
  }
  if (typeof obj === 'object') {
    for (const kk of Object.keys(obj)) { const r = findArrayOfObjects(obj[kk], keys, depth + 1); if (r) return r; }
  }
  return null;
}
function pickText(c: any): string {
  const cands = [c?.text, c?.content?.message, typeof c?.content === 'string' ? c.content : undefined,
    c?.full_text, c?.message, c?.comment, c?.caption?.text, c?.desc, c?.title];
  const v = cands.find((x) => typeof x === 'string' && x.trim());
  return v ? String(v).trim() : '';
}
function authorOf(c: any): string | undefined {
  const u = c?.user || c?.member || c?.author || c?.owner || c;
  const v = deepFind(u, ['nickname', 'unique_id', 'uniqueId', 'username', 'uname', 'screen_name', 'name']);
  return typeof v === 'string' ? v : undefined;
}

export interface NormComment { author?: string; text: string; likes?: number; replies?: number; }
function extractComments(blocks: Record<string, AnalyzeBlock>): NormComment[] {
  const data = blocks.comments?.data;
  if (!data) return [];
  const arr = findArrayOfObjects(data, ['text', 'content.message', 'full_text', 'message', 'comment']) || [];
  return arr.map((c: any) => ({
    author: authorOf(c),
    text: pickText(c),
    likes: num(c?.digg_count ?? c?.like_count ?? c?.like ?? c?.favorite_count ?? c?.likes),
    replies: num(c?.reply_comment_total ?? c?.reply_count ?? c?.rcount ?? c?.child_comment_count ?? c?.total),
  })).filter((c) => c.text).slice(0, 200);
}
export interface NormPost { desc?: string; views?: number; likes?: number; comments?: number; shares?: number; }
function extractPosts(blocks: Record<string, AnalyzeBlock>): NormPost[] {
  const data = blocks.posts?.data;
  if (!data) return [];
  const arr = findArrayOfObjects(data, ['desc', 'title', 'caption', 'aweme_id', 'full_text', 'id']) || [];
  return arr.map((p: any) => ({
    desc: (pickText(p) || String(deepFind(p, ['desc', 'title', 'caption']) || '')).slice(0, 200),
    views: num(deepFind(p, ['play_count', 'playCount', 'view_count', 'viewCount', 'play'])),
    likes: num(deepFind(p, ['digg_count', 'like_count', 'favorite_count', 'likes'])),
    comments: num(deepFind(p, ['comment_count', 'commentCount', 'reply_count'])),
    shares: num(deepFind(p, ['share_count', 'shareCount', 'forward_count', 'retweet_count'])),
  })).slice(0, 60);
}
function extractKeywords(blocks: Record<string, AnalyzeBlock>): { word: string; count?: number }[] {
  const data = blocks.commentKeywords?.data;
  if (!data) return [];
  const arr = findArrayOfObjects(data, ['keyword', 'word', 'term', 'text']) || [];
  return arr.map((k: any) => ({
    word: String(k?.keyword ?? k?.word ?? k?.term ?? k?.text ?? '').trim(),
    count: num(k?.count ?? k?.freq ?? k?.frequency ?? k?.weight),
  })).filter((k) => k.word).slice(0, 60);
}

interface AnalyzeBlock { ok: boolean; error?: string; data?: any; }
export interface AnalyzeResult {
  detected: Detected & { platformLabel: string };
  blocks: Record<string, AnalyzeBlock>;
  summary: Record<string, any>;
  normalized: { comments: NormComment[]; posts: NormPost[]; keywords: { word: string; count?: number }[] };
}

/** Главная точка: ссылка → аналитика. Бросает понятную ошибку при проблемах ключа/распознавания. */
export async function analyzeUrl(tenantId: string, url: string): Promise<AnalyzeResult> {
  const detected = detectUrl(url);
  if (!detected) {
    throw new Error('Не распознал ссылку. Вставьте ссылку на видео/пост или аккаунт: TikTok, Douyin, Instagram, X, YouTube, Reddit или Bilibili.');
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
    normalized: {
      comments: extractComments(blocks),
      posts: extractPosts(blocks),
      keywords: extractKeywords(blocks),
    },
  };
}

// ── Массовый анализ: по каждой ссылке ОДИН вызов (video/account) → сводка. Дёшево. ──
export interface BulkRow { url: string; platform?: string; type?: string; summary: Record<string, any>; error?: string; }
export async function analyzeBulk(tenantId: string, urls: string[]): Promise<BulkRow[]> {
  const key = await getEffectiveTikHubKey(tenantId);
  if (!key) throw new Error('Ключ Trend не задан.');
  const list = (urls || []).filter((u) => typeof u === 'string' && u.trim()).slice(0, 40);
  const out: BulkRow[] = [];
  for (const url of list) {
    const d = detectUrl(url);
    if (!d) { out.push({ url, summary: {}, error: 'не распознано' }); continue; }
    const call = planCalls(d)[0];
    if (!call) { out.push({ url, platform: d.platform, type: d.type, summary: {}, error: 'нет вызова' }); continue; }
    // eslint-disable-next-line no-await-in-loop
    const r = await tikhubGet(key, call.path, { timeoutMs: 25000 });
    const blocks: Record<string, AnalyzeBlock> = { [call.label]: r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error } };
    out.push({ url, platform: d.platform, type: d.type, summary: r.ok ? buildSummary(blocks) : {}, error: r.ok ? undefined : r.error });
  }
  return out;
}

// ── ИИ-анализ тональности комментариев (Claude) ──
export interface SentimentResult {
  positive: number; negative: number; neutral: number;
  overall: string; themes: string[]; topPositive: string[]; topNegative: string[];
}
function parseJsonLoose(txt: string): any {
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
export async function analyzeCommentsSentiment(tenantId: string, comments: string[]): Promise<SentimentResult> {
  const clean = (comments || []).map((c) => String(c || '').trim()).filter(Boolean).slice(0, 150);
  if (clean.length === 0) throw new Error('Нет комментариев для анализа.');
  const apiKey = await resolveAnthropicKey(tenantId);
  if (!apiKey) throw new Error('Ключ Claude не задан (Enterprise → Генерация → ИИ-режиссёр).');
  const mod: any = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default || mod.Anthropic || mod;
  const client = new Anthropic({ apiKey });
  const sample = clean.map((c, i) => `${i + 1}. ${c.slice(0, 200)}`).join('\n');
  const system =
    'Ты — аналитик аудитории соцсетей. По списку комментариев оцени тональность и темы. ' +
    'Отвечай СТРОГО одним JSON-объектом без пояснений и без markdown.';
  const user =
    `Комментарии (${clean.length}):\n${sample}\n\n` +
    'Верни JSON: {"positive": <0-100>, "negative": <0-100>, "neutral": <0-100>, ' +
    '"overall": "<1-2 предложения вывода на русском>", ' +
    '"themes": ["<3-6 ключевых тем/запросов аудитории>"], ' +
    '"topPositive": ["<до 3 ярких позитивных комментариев дословно>"], ' +
    '"topNegative": ["<до 3 ярких негативных/критичных комментариев дословно>"]}. ' +
    'positive+negative+neutral должны давать 100.';
  const res = await client.messages.create({
    model: DEFAULT_DIRECTOR_MODEL, max_tokens: 2000, thinking: { type: 'adaptive' },
    system, messages: [{ role: 'user', content: user }],
  });
  const txt = (res.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('');
  const j = parseJsonLoose(txt);
  if (!j) throw new Error('ИИ вернул неразборчивый ответ — повторите.');
  const n = (x: any) => Math.max(0, Math.min(100, Math.round(Number(x) || 0)));
  return {
    positive: n(j.positive), negative: n(j.negative), neutral: n(j.neutral),
    overall: String(j.overall || '').slice(0, 600),
    themes: Array.isArray(j.themes) ? j.themes.map((t: any) => String(t)).slice(0, 8) : [],
    topPositive: Array.isArray(j.topPositive) ? j.topPositive.map((t: any) => String(t)).slice(0, 3) : [],
    topNegative: Array.isArray(j.topNegative) ? j.topNegative.map((t: any) => String(t)).slice(0, 3) : [],
  };
}
