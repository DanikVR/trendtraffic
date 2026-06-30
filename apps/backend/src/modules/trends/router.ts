/**
 * TrendTraffic — HTTP-роутер анализатора трендов.
 *
 *  POST /api/trends/scan              — сканировать тренды (keyword|trending) → сохранить видео
 *  GET  /api/trends/videos            — список найденных видео тенанта
 *  POST /api/trends/videos/:id/download — скачать исходник на диск
 *
 * Все эндпоинты требуют JWT (tenant_id из токена). Изоляция — по tenant_id.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { JWT_SECRET } from '../../config/secrets.js';
import { scanTrends, listRecentVideos, getVideo, setVideoStatus, deleteVideo, deleteVideos, type TrendKind } from './service.js';
import { analyzeUrl, detectUrl, analyzeCommentsSentiment, analyzeBulk } from './analytics.js';
import { generateTrendDNA, saveTrendDNA, getTrendDNAByAsset } from './dna.js';
import { downloadVideoToDisk } from '../media/store_video.js';
import { fetchOneVideo, extractDownloadUrls, fetchTweetDetail, extractTwitterVideoUrls } from '../tikhub/tikhub_client.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { listAssets, listFolder, createAsset, deleteAsset, deleteAssets, ANALYZED_FOLDER, type MediaKind } from '../media/assets.js';

const router = Router();

// Загрузка референс-медиа/аудио в Галерею → отдельные папки uploads/reference и uploads/audio.
const __tr_dir = path.dirname(fileURLToPath(import.meta.url));
const REFERENCE_DIR = path.resolve(__tr_dir, '../../../../uploads/reference');
const AUDIO_DIR = path.resolve(__tr_dir, '../../../../uploads/audio');
try { fs.mkdirSync(REFERENCE_DIR, { recursive: true }); } catch { /* best-effort */ }
try { fs.mkdirSync(AUDIO_DIR, { recursive: true }); } catch { /* best-effort */ }
const kindFromReq = (req: Request): MediaKind => (req.query.kind === 'audio' ? 'audio' : 'reference');
/** Имя файла из multipart приходит в latin1 (busboy) → кириллица «кракозяблится». Восстанавливаем UTF-8. */
function fixUploadName(name: string | undefined | null): string {
  if (!name) return '';
  try {
    const utf8 = Buffer.from(name, 'latin1').toString('utf8');
    return utf8.includes('�') ? name : utf8; // невалидный UTF-8 (имя реально было latin1) → оставляем как есть
  } catch { return name; }
}
const uploadMedia = multer({
  storage: multer.diskStorage({
    // kind берём из query (?kind=audio|reference) — query доступен ДО парсинга тела.
    destination: (req, _file, cb) => cb(null, kindFromReq(req) === 'audio' ? AUDIO_DIR : REFERENCE_DIR),
    filename: (_req, file, cb) => cb(null, `med-${randomUUID()}${path.extname(file.originalname) || ''}`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 МБ — видео-референсы бывают крупные
});

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: string;
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

/** Полный доступ (Премиум/Энтерпрайз/триал/superadmin). Без него — 402: неоплаченный
 *  пользователь не должен дёргать платные API напрямую (защита нашего TikHub-бюджета). */
async function requireFullAccess(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole as any)) return next();
  } catch { /* ниже 402 */ }
  return res.status(402).json({ error: 'Доступно на тарифе Премиум или Энтерпрайз. Оформите подписку.' });
}

router.use(requireAuth);
router.use(requireFullAccess);

/** POST /analyze — { url } → аналитика по ссылке (видео/аккаунт) для TikTok/Douyin/IG/X/Bilibili. */
// YouTube: аналитика и скачивание отключены (TikHub не отдаёт надёжных потоков —
// подпись get_signed_stream_url ненадёжна). YouTube остаётся только для ПОИСКА трендов.
const YT_OFF = 'Анализ YouTube недоступен — YouTube доступен только для поиска трендов.';

router.post('/analyze', async (req: AuthedRequest, res: Response) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    if (!url.trim()) return res.status(400).json({ error: 'Передайте ссылку в поле url.' });
    if (detectUrl(url)?.platform === 'youtube') return res.status(400).json({ error: YT_OFF });
    const result = await analyzeUrl(req.tenantId!, url);
    res.json(result);
  } catch (err: any) {
    const msg = err?.message || 'Ошибка анализа';
    const code = /распозн|ключ|Укажите/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/** GET /analyze/detect?url= — только распознавание платформы/типа (без вызовов TikHub). */
router.get('/analyze/detect', (req: AuthedRequest, res: Response) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  res.json({ detected: detectUrl(url) });
});

/** POST /analyze/sentiment — { comments: string[] } → ИИ-анализ тональности (Claude). */
router.post('/analyze/sentiment', async (req: AuthedRequest, res: Response) => {
  try {
    const comments = Array.isArray(req.body?.comments) ? req.body.comments : [];
    const result = await analyzeCommentsSentiment(req.tenantId!, comments);
    res.json(result);
  } catch (err: any) {
    const msg = err?.message || 'Ошибка анализа тональности';
    const code = /ключ|комментари|Укажите/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/**
 * POST /analyze/breakdown — нативный «рецепт успеха» тренда (TrendDNA).
 *   Принимает либо { url } (тогда сам соберёт данные через analyzeUrl),
 *   либо уже готовые { summary, comments, keywords, platform } (без повторных вызовов TikHub).
 */
router.post('/analyze/breakdown', async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    let summary = body.summary;
    let comments = Array.isArray(body.comments) ? body.comments : undefined;
    let keywords = Array.isArray(body.keywords) ? body.keywords : undefined;
    let platform: string | undefined = typeof body.platform === 'string' ? body.platform : undefined;
    const url = typeof body.url === 'string' ? body.url : '';
    if (!summary) {
      if (!url.trim()) return res.status(400).json({ error: 'Передайте url или summary.' });
      const a = await analyzeUrl(req.tenantId!, url);
      summary = a.summary;
      comments = a.normalized.comments;
      keywords = a.normalized.keywords;
      platform = a.detected.platform;
    }
    const dna = await generateTrendDNA(req.tenantId!, { summary, comments, keywords, platform, sourceUrl: url || undefined });
    res.json({ dna });
  } catch (err: any) {
    const msg = err?.message || 'Ошибка разбора';
    const code = /ключ|распозн|Передайте|Укажите|неразборч/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/** POST /analyze/bulk — { urls: string[] } → массовая сводка (по одному вызову на ссылку). */
router.post('/analyze/bulk', async (req: AuthedRequest, res: Response) => {
  try {
    const urls: string[] = Array.isArray(req.body?.urls) ? req.body.urls : [];
    if (urls.length === 0) return res.status(400).json({ error: 'Передайте urls[].' });
    // YouTube не анализируем (без вызова TikHub) — сразу строка-ошибка; остальное как обычно.
    const isYt = (u: string) => detectUrl(u)?.platform === 'youtube';
    const okUrls = urls.filter((u) => !isYt(u));
    const okRows = okUrls.length ? await analyzeBulk(req.tenantId!, okUrls) : [];
    const byUrl = new Map(okRows.map((r: any) => [r.url, r]));
    const rows = urls.map((u) => isYt(u) ? { url: u, platform: 'youtube', summary: {}, error: YT_OFF } : (byUrl.get(u) || { url: u, platform: 'unknown', summary: {}, error: 'не обработано' }));
    res.json({ rows });
  } catch (err: any) {
    const msg = err?.message || 'Ошибка массового анализа';
    res.status(/ключ|Укажите/i.test(msg) ? 400 : 502).json({ error: msg });
  }
});

/** POST /analyze/save — { url } → скачать проанализированное видео в Галерею.
 *  TikTok — no-watermark play_addr; X/Twitter — лучший mp4-вариант твита;
 *  YouTube — потоки get_video_streams_v2 + подпись + склейка ffmpeg (1080p H.264+AAC). */
router.post('/analyze/save', async (req: AuthedRequest, res: Response) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    const d = detectUrl(url);
    if (!d || d.type !== 'video') return res.status(400).json({ error: 'Нужна ссылка на видео/пост.' });
    const key = await getEffectiveTikHubKey(req.tenantId!);
    if (!key) return res.status(400).json({ error: 'Ключ Trend не задан.' });

    // Скачиваем по площадке: TikTok/X — прямой mp4; YouTube — потоки+склейка ffmpeg.
    let file;
    if (d.platform === 'tiktok' || d.platform === 'twitter') {
      let urls: string[] = [];
      let referer = url;
      if (d.platform === 'tiktok') {
        const one = await fetchOneVideo(key, String(d.videoId));
        urls = one.ok ? extractDownloadUrls(one.data) : [];
      } else {
        const one = await fetchTweetDetail(key, String(d.videoId));
        urls = one.ok ? extractTwitterVideoUrls(one.data) : [];
        referer = 'https://x.com/';
      }
      if (urls.length === 0) return res.status(502).json({ error: 'Не удалось получить прямую ссылку на видео (для постов-картинок без видео скачивание недоступно).' });
      file = await downloadVideoToDisk(urls, { referer });
    } else if (d.platform === 'youtube') {
      // YouTube-скачивание отключено (подпись потоков TikHub ненадёжна, см. YT_OFF).
      return res.status(400).json({ error: 'Скачивание YouTube недоступно.' });
    } else {
      return res.status(400).json({ error: 'Скачивание в Галерею пока поддержано для TikTok и X.' });
    }
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: 'video', originalName: `${d.platform}-${d.videoId}.mp4`,
      fileUrl: file.mediaUrl, filePath: file.filePath, mime: file.mime || 'video/mp4', size: file.size,
      folder: ANALYZED_FOLDER, // сохранено из аналитики → папка «Из анализа»
    });
    if (!asset) return res.status(500).json({ error: 'Не удалось сохранить в Галерею.' });

    // ДНК тренда едет ВМЕСТЕ с видео: в фоне собираем рецепт и кладём в video_analyses,
    // привязав к этому ассету. Best-effort — скачивание уже успешно, анализ не должен его ронять.
    const tId = req.tenantId!, assetId = asset.id, dPlatform = d.platform, dVideoId = String(d.videoId);
    void (async () => {
      try {
        const a = await analyzeUrl(tId, url);
        const dna = await generateTrendDNA(tId, {
          summary: a.summary, comments: a.normalized.comments, keywords: a.normalized.keywords,
          platform: a.detected.platform, sourceUrl: url,
        });
        await saveTrendDNA(tId, { mediaAssetId: assetId, platform: dPlatform, externalId: dVideoId, sourceUrl: url, dna });
      } catch (e) {
        console.warn('[trends] save→DNA:', (e as Error).message);
      }
    })();

    res.json({ ok: true, asset, fileUrl: file.mediaUrl, analyzing: true });
  } catch (err: any) {
    res.status(err?.status || 502).json({ error: err?.message || 'Ошибка скачивания' });
  }
});

/** POST /scan — { kind: 'keyword'|'trending', query?, count? } */
router.post('/scan', async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const kind: TrendKind = body.kind === 'trending' ? 'trending' : 'keyword';
    const platform = ['tiktok', 'instagram', 'youtube', 'twitter', 'reddit'].includes(body.platform) ? body.platform : 'tiktok';
    const filters: Record<string, string> = {};
    if (body.filters && typeof body.filters === 'object') {
      for (const [k, v] of Object.entries(body.filters)) {
        if (typeof v === 'string' && v && /^[\w-]{1,30}$/.test(k) && v.length <= 40) filters[k] = v;
      }
    }
    const query = typeof body.query === 'string' ? body.query : undefined;
    const count = Number.isFinite(body.count) ? Number(body.count) : undefined;
    const mode = ['video', 'general', 'app'].includes(body.mode) ? body.mode : 'app';
    const sortType = [0, 1, 2].includes(Number(body.sortType)) ? (Number(body.sortType) as 0 | 1 | 2) : 0;
    const publishTime = [0, 1, 7, 30, 90, 180].includes(Number(body.publishTime))
      ? (Number(body.publishTime) as 0 | 1 | 7 | 30 | 90 | 180) : 0;
    if (kind === 'keyword' && !query?.trim()) {
      return res.status(400).json({ error: 'Для поиска по ключевому слову передайте query.' });
    }
    const result = await scanTrends(req.tenantId!, { kind, query, count, mode, sortType, publishTime, platform, filters });
    res.json(result);
  } catch (err: any) {
    const msg = err?.message || 'Ошибка сканирования';
    // Нет ключа / ошибка TikHub — клиентская (400), прочее — 502.
    const code = /ключ|query|Укажите/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/** GET /videos?limit=60 — последние найденные видео тенанта. */
router.get('/videos', async (req: AuthedRequest, res: Response) => {
  try {
    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 60;
    const downloaded = req.query.downloaded === '1' || req.query.downloaded === 'true';
    const videos = await listRecentVideos(req.tenantId!, limit, downloaded);
    res.json({ videos });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

// Реестр идущих скачиваний для отмены (ключ tenant:id → AbortController).
const downloadRegistry = new Map<string, AbortController>();

/** POST /videos/:id/download — ФОНОВОЕ скачивание исходника на диск + в Галерею. */
router.post('/videos/:id/download', async (req: AuthedRequest, res: Response) => {
  try {
    const tId = req.tenantId!, vId = req.params.id;
    const row = await getVideo(tId, vId);
    if (!row) return res.status(404).json({ error: 'Видео не найдено' });
    if (row.platform === 'youtube') return res.status(400).json({ error: 'Скачивание YouTube недоступно.' });

    const key = `${tId}:${vId}`;
    if (downloadRegistry.has(key)) return res.json({ ok: true, status: 'downloading' }); // уже качается

    // Свежие ПРЯМЫЕ ссылки через App V3 (no-watermark, без cookie tt_chain_token).
    let urls: string[] = [];
    try {
      const apiKey = await getEffectiveTikHubKey(tId);
      if (apiKey && row.external_id) {
        const one = await fetchOneVideo(apiKey, String(row.external_id));
        if (one.ok) urls = extractDownloadUrls(one.data);
      }
    } catch { /* падаем на сохранённую ссылку ниже */ }
    if (urls.length === 0 && row.video_url) urls = [row.video_url];
    if (urls.length === 0) {
      return res.status(400).json({ error: 'Не удалось получить прямую ссылку (App V3 не вернул url).' });
    }

    await setVideoStatus(tId, vId, { status: 'downloading', error: null });
    const ctrl = new AbortController();
    downloadRegistry.set(key, ctrl);
    const referer = row.web_url || undefined, platform = row.platform, extId = row.external_id;

    // Скачивание продолжается на сервере, даже если клиент ушёл со страницы.
    // По завершении — статус 'downloaded' + запись в Галерею (media_assets).
    void (async () => {
      try {
        const file = await downloadVideoToDisk(urls, { referer, signal: ctrl.signal });
        await setVideoStatus(tId, vId, { status: 'downloaded', fileUrl: file.mediaUrl, filePath: file.filePath, error: null });
        try {
          await createAsset(tId, { kind: 'reference', mediaType: 'video', originalName: `${platform}-${extId || vId}.mp4`, fileUrl: file.mediaUrl, filePath: file.filePath, mime: file.mime, size: file.size });
        } catch (e) { console.warn('[trends] download→gallery createAsset:', (e as Error).message); }
      } catch (dlErr: any) {
        const aborted = dlErr?.name === 'AbortError';
        await setVideoStatus(tId, vId, { status: aborted ? 'discovered' : 'failed', error: aborted ? null : (dlErr?.message || 'download error') });
      } finally {
        downloadRegistry.delete(key);
      }
    })();

    res.json({ ok: true, status: 'downloading' }); // отвечаем сразу — идёт в фоне
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка' });
  }
});

/** POST /videos/:id/download/cancel — отменить идущее фоновое скачивание. */
router.post('/videos/:id/download/cancel', async (req: AuthedRequest, res: Response) => {
  const key = `${req.tenantId}:${req.params.id}`;
  const ctrl = downloadRegistry.get(key);
  if (ctrl) ctrl.abort();
  try { await setVideoStatus(req.tenantId!, req.params.id, { status: 'discovered', error: null }); } catch { /* noop */ }
  res.json({ ok: true, canceled: !!ctrl });
});

/** DELETE /videos/:id — удалить одно видео (файл + строку). */
router.delete('/videos/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await deleteVideo(req.tenantId!, req.params.id);
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

/** POST /videos/delete-bulk { ids: string[] } — массовое удаление. */
router.post('/videos/delete-bulk', async (req: AuthedRequest, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: any) => typeof x === 'string') : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Передайте ids[]' });
    const deleted = await deleteVideos(req.tenantId!, ids);
    res.json({ ok: true, deleted });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

// ── Медиа-ассеты Галереи (референс/аудио) ──────────────────────────────────

/** GET /media?kind=reference|audio  ИЛИ  ?folder=analyzed — список загруженных медиа. */
router.get('/media', async (req: AuthedRequest, res: Response) => {
  try {
    const folder = typeof req.query.folder === 'string' ? req.query.folder.trim() : '';
    const assets = folder
      ? await listFolder(req.tenantId!, folder)
      : await listAssets(req.tenantId!, kindFromReq(req));
    res.json({ assets });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** GET /media/:id/analysis — сохранённая ДНК тренда по видео Галереи (для автозаполнения TrendFlow). */
router.get('/media/:id/analysis', async (req: AuthedRequest, res: Response) => {
  try {
    const rec = await getTrendDNAByAsset(req.tenantId!, req.params.id);
    if (!rec) return res.status(404).json({ error: 'Анализ для этого видео не найден.' });
    res.json({ analysis: rec });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** POST /media/upload?kind=reference|audio (multipart "file") — загрузить медиа. */
router.post('/media/upload', uploadMedia.single('file'), async (req: AuthedRequest, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'Файл не передан' });
    const kind = kindFromReq(req);
    const mime = file.mimetype || 'application/octet-stream';
    const mediaType = mime.startsWith('image/') ? 'image'
      : mime.startsWith('video/') ? 'video'
      : mime.startsWith('audio/') ? 'audio' : 'file';
    const subdir = kind === 'audio' ? 'audio' : 'reference';
    const fileUrl = `/uploads/${subdir}/${path.basename(file.path)}`;
    const asset = await createAsset(req.tenantId!, {
      kind, mediaType, originalName: fixUploadName(file.originalname), fileUrl, filePath: file.path, mime, size: file.size,
    });
    if (!asset) {
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(500).json({ error: 'Не удалось сохранить ассет' });
    }
    res.status(201).json({ ok: true, asset });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка загрузки' });
  }
});

/** DELETE /media/:id — удалить ассет (файл + строку). */
router.delete('/media/:id', async (req: AuthedRequest, res: Response) => {
  try {
    res.json({ ok: await deleteAsset(req.tenantId!, req.params.id) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

/** POST /media/delete-bulk { ids: string[] } — массовое удаление ассетов. */
router.post('/media/delete-bulk', async (req: AuthedRequest, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: any) => typeof x === 'string') : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Передайте ids[]' });
    res.json({ ok: true, deleted: await deleteAssets(req.tenantId!, ids) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

export default router;
