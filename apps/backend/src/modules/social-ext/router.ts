/**
 * Social Media Extension — прозрачный прокси к TikHub API + медиа-прокси для скачивания.
 *
 * Вкладка «Social Media Extension» — это рехостинг открытого TikHub-расширения
 * (его собственные sidepanel+background) внутри приложения. Расширение делает
 * запросы на https://api.tikhub.io и тянет медиа с CDN; chrome-polyfill в iframe
 * переписывает их сюда и проставляет JWT приложения. Здесь мы:
 *   1) проверяем JWT;
 *   2) лимитируем частоту (защита платформенного ключа от runaway-циклов);
 *   3) пропускаем ТОЛЬКО Enterprise (+superadmin) — каждый запрос биллится на наш
 *      платформенный ключ TikHub (pay-as-you-go);
 *   4) подставляем серверный ключ и ПРОЗРАЧНО проксируем метод/путь/query/тело,
 *      возвращая upstream как есть, чтобы поведение расширения совпадало 1:1.
 *
 * Экспортирует два роутера (монтируются в server.ts):
 *   default       → /api/social-ext/proxy   (TikHub API)
 *   mediaRouter   → /api/social-ext/media    (скачивание видео/обложек с CDN)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { Readable } from 'node:stream';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { getTikHubApiKey, getGeminiApiKey } from '../../config/systemConfig.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { analyzeUrl, detectUrl } from '../trends/analytics.js';
import { extractDownloadUrls } from '../tikhub/tikhub_client.js';
import { downloadVideoToDisk } from '../media/store_video.js';
import { createAsset } from '../media/assets.js';

const TIKHUB_BASE = (process.env.TIKHUB_BASE_URL || 'https://api.tikhub.io').replace(/\/+$/, '');
const UA = 'TrendTraffic/1.0';

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: any;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

/** Доступ к расширению — только Enterprise (+superadmin-bypass внутри hasEnterpriseAccess). */
async function requireEnterprise(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole)) return next();
  } catch (err) {
    console.warn('[social-ext] enterprise-гейт:', err);
  }
  return res.status(403).json({ error: 'Доступно только на тарифе Enterprise' });
}

/**
 * Частотный лимит — потолок на платформенный ключ (каждый вызов биллится).
 * Ключ — tenantId (после requireAuth всегда есть). Расширение тратит ~4–8 вызовов
 * на один анализ; 120/мин с запасом для легитимной работы, но рубит циклы-скрейперы.
 */
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).tenantId || 'social-ext-anon',
  message: { error: 'Слишком много запросов к TikHub. Подождите минуту.' },
});

// ============================================================================
// TikHub API-прокси  →  /api/social-ext/proxy/*
// ============================================================================
const router = Router();
router.use(requireAuth);
router.use(proxyLimiter);   // лимит ДО enterprise-гейта: даже авторизованный не «качает» сверх потолка
router.use(requireEnterprise);

router.all('/*', async (req: AuthedRequest, res: Response) => {
  // req.url внутри роутера = путь+query ПОСЛЕ /api/social-ext/proxy («/api/v1/...?x=1»).
  const upstreamPath = req.url || '/';
  // Allow-list: TikHub — только пути /api/... (не открытый прокси к произвольным путям хоста).
  if (!upstreamPath.startsWith('/api/')) {
    return res.status(400).json({ error: 'Недопустимый путь' });
  }
  const upstreamUrl = `${TIKHUB_BASE}${upstreamPath}`;

  const key = (await getEffectiveTikHubKey(req.tenantId)) || getTikHubApiKey();
  if (!key) {
    return res.status(400).json({ error: 'TikHub API key не настроен на платформе' });
  }

  const method = (req.method || 'GET').toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD' && req.body && Object.keys(req.body).length > 0;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
    'User-Agent': UA,
  };
  let body: string | undefined;
  if (hasBody) {
    body = JSON.stringify(req.body);
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const upstream = await fetch(upstreamUrl, { method, headers, body, signal: controller.signal });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.status(upstream.status).send(buf);
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({ error: aborted ? 'Таймаут запроса к TikHub' : (err?.message || 'Proxy error') });
  } finally {
    clearTimeout(timer);
  }
});

export default router;

// ============================================================================
// Медиа-прокси  →  /api/social-ext/media?url=...&filename=...
// ----------------------------------------------------------------------------
// Расширение скачивает видео/обложки с CDN TikTok/Douyin/IG/X. Из веб-страницы это
// падает на CORS/Referer (403) и теряет имя файла. Здесь — серверный стрим с нужным
// Referer и Content-Disposition. Хосты строго по allow-list (не открытый прокси).
// ============================================================================

// Суффиксы доменов CDN/площадок (из host_permissions расширения).
const MEDIA_HOST_SUFFIXES = [
  'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'tiktokv.us', 'tiktokv.com',
  'ibyteimg.com', 'byteimg.com', 'muscdn.com', 'bytecdntp.com', 'bytedance.com', 'bdstatic.com',
  'zjcdn.com', 'snssdk.com', 'tiktok.com',
  'douyinpic.com', 'douyincdn.com', 'douyinstatic.com', 'douyin.com',
  'cdninstagram.com', 'fbcdn.net', 'instagram.com',
  'twimg.com', 'x.com', 'twitter.com',
  'hdslb.com', 'biliimg.com', 'bilivideo.com', 'bilibili.com',
];

function refererFor(host: string): string {
  if (/douyin/.test(host)) return 'https://www.douyin.com/';
  if (/instagram|cdninstagram|fbcdn/.test(host)) return 'https://www.instagram.com/';
  if (/twimg|twitter|x\.com/.test(host)) return 'https://x.com/';
  if (/hdslb|biliimg|bilivideo|bilibili/.test(host)) return 'https://www.bilibili.com/';
  return 'https://www.tiktok.com/';
}

function hostAllowed(host: string): boolean {
  host = host.toLowerCase();
  return MEDIA_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
}

const mediaRouter = Router();
mediaRouter.use(requireAuth);
mediaRouter.use(proxyLimiter);
mediaRouter.use(requireEnterprise);

mediaRouter.get('/', async (req: AuthedRequest, res: Response) => {
  const raw = typeof req.query.url === 'string' ? req.query.url : '';
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'Некорректный url' });
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return res.status(400).json({ error: 'Недопустимый протокол' });
  }
  if (!hostAllowed(target.hostname)) {
    return res.status(400).json({ error: 'Хост не разрешён' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': UA, Referer: refererFor(target.hostname), Accept: '*/*' },
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      clearTimeout(timer);
      return res.status(upstream.status || 502).json({ error: `Источник вернул HTTP ${upstream.status}` });
    }
    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    const cl = upstream.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    const fname = typeof req.query.filename === 'string' ? req.query.filename.replace(/[^\w.\-]+/g, '_').slice(0, 120) : '';
    if (fname) res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    // Стрим без буферизации (видео бывают крупные).
    Readable.fromWeb(upstream.body as any).pipe(res).on('finish', () => clearTimeout(timer));
    res.on('close', () => { clearTimeout(timer); try { controller.abort(); } catch { /* noop */ } });
  } catch (err: any) {
    clearTimeout(timer);
    const aborted = err?.name === 'AbortError';
    if (!res.headersSent) res.status(aborted ? 504 : 502).json({ error: aborted ? 'Таймаут источника' : (err?.message || 'Media proxy error') });
  }
});

export { mediaRouter };

// ============================================================================
// AI-прокси  →  /api/social-ext/ai-proxy/<host>/<path>?<query>
// ----------------------------------------------------------------------------
// AI-функции расширения (промпт из обложки, разборы видео/профиля/виральности,
// сводка отчёта) ходят к gemini/openai/anthropic. Polyfill переписывает их сюда,
// а мы подставляем ключ из настроек Enterprise (cloud) — браузеру ключ не виден.
// По умолчанию провайдер gemini → ключ getEffectiveGeminiKey (тенант → платформа).
// ============================================================================

const AI_HOSTS = new Set(['generativelanguage.googleapis.com', 'api.openai.com', 'api.anthropic.com']);

const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.use(proxyLimiter);
aiRouter.use(requireEnterprise);

aiRouter.all('/*', async (req: AuthedRequest, res: Response) => {
  // req.url = «/<host>/<rest>?<query>». Первый сегмент — хост провайдера.
  const raw = (req.url || '/').replace(/^\/+/, '');
  const slash = raw.indexOf('/');
  const host = slash === -1 ? raw.split('?')[0] : raw.slice(0, slash);
  let rest = slash === -1 ? '' : raw.slice(slash); // начинается с «/», включает query
  if (!AI_HOSTS.has(host)) return res.status(400).json({ error: 'Недопустимый AI-хост' });

  // Подбор ключа + заголовка авторизации по провайдеру.
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': UA };
  let key: string | null = null;
  if (host === 'generativelanguage.googleapis.com') {
    // Ключ Gemini с учётки тенанта (Enterprise → Генерация), иначе платформенный.
    key = (await getEffectiveGeminiKey(req.tenantId)) || getGeminiApiKey() || null;
    if (key) {
      headers['x-goog-api-key'] = key;
      // Убираем возможный ?key=<placeholder> из расширения, чтобы не перебил наш ключ.
      const qIdx = rest.indexOf('?');
      if (qIdx !== -1) {
        const qs = new URLSearchParams(rest.slice(qIdx + 1));
        qs.delete('key');
        const q = qs.toString();
        rest = rest.slice(0, qIdx) + (q ? `?${q}` : '');
      }
    }
  } else if (host === 'api.openai.com') {
    key = await getEffectiveProviderKey(req.tenantId, 'openai');
    if (key) headers['Authorization'] = `Bearer ${key}`;
  } else if (host === 'api.anthropic.com') {
    key = await getEffectiveProviderKey(req.tenantId, 'anthropic');
    if (key) {
      headers['x-api-key'] = key;
      headers['anthropic-version'] = (req.headers['anthropic-version'] as string) || '2023-06-01';
    }
  }
  if (!key) {
    return res.status(400).json({ error: 'AI-ключ не настроен. Задайте ключ Gemini в Enterprise → Генерация.' });
  }

  const method = (req.method || 'GET').toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD' && req.body && Object.keys(req.body).length > 0;
  let body: string | undefined;
  if (hasBody) { body = JSON.stringify(req.body); headers['Content-Type'] = 'application/json'; }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const upstream = await fetch(`https://${host}${rest}`, { method, headers, body, signal: controller.signal });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.status(upstream.status).send(buf);
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    res.status(aborted ? 504 : 502).json({ error: aborted ? 'Таймаут запроса к AI' : (err?.message || 'AI proxy error') });
  } finally {
    clearTimeout(timer);
  }
});

export { aiRouter };

// ============================================================================
// «Добавить в галерею»  →  POST /api/social-ext/to-gallery { url }
// ----------------------------------------------------------------------------
// Разбирает ссылку (TikHub нашим ключом), качает видео на диск и заводит запись
// в Галерее (media_assets, kind=reference). JWT + rate-limit + Enterprise.
// ============================================================================

const REFERER_BY_PLATFORM: Record<string, string> = {
  tiktok: 'https://www.tiktok.com/', douyin: 'https://www.douyin.com/',
  instagram: 'https://www.instagram.com/', twitter: 'https://x.com/', bilibili: 'https://www.bilibili.com/',
};

const galleryRouter = Router();
galleryRouter.use(requireAuth);
galleryRouter.use(proxyLimiter);
galleryRouter.use(requireEnterprise);

galleryRouter.post('/', async (req: AuthedRequest, res: Response) => {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  if (!url) return res.status(400).json({ error: 'Передайте ссылку в поле url.' });
  try {
    const det = detectUrl(url);
    const result: any = await analyzeUrl(req.tenantId!, url);
    const dlUrls = extractDownloadUrls(result?.blocks?.video?.data);
    if (!dlUrls.length) {
      return res.status(422).json({ error: 'Не удалось получить прямую ссылку на видео для этой платформы.' });
    }
    const platform = result?.detected?.platform || det?.platform || 'tiktok';
    const stored: any = await downloadVideoToDisk(dlUrls, { referer: REFERER_BY_PLATFORM[platform] || REFERER_BY_PLATFORM.tiktok });
    const vid = result?.detected?.videoId || det?.videoId || 'video';
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: 'video',
      originalName: `${platform}-${vid}.mp4`,
      fileUrl: stored.fileUrl, filePath: stored.filePath, mime: stored.mime, size: stored.size,
    });
    res.json({ ok: true, fileUrl: stored.fileUrl, asset });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Не удалось добавить в галерею' });
  }
});

export { galleryRouter };
