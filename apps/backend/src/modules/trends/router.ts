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
import { downloadVideoToDisk } from '../media/store_video.js';
import { fetchOneVideo, extractDownloadUrls } from '../tikhub/tikhub_client.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';
import { listAssets, createAsset, deleteAsset, deleteAssets, type MediaKind } from '../media/assets.js';

const router = Router();

// Загрузка референс-медиа/аудио в Галерею → отдельные папки uploads/reference и uploads/audio.
const __tr_dir = path.dirname(fileURLToPath(import.meta.url));
const REFERENCE_DIR = path.resolve(__tr_dir, '../../../../uploads/reference');
const AUDIO_DIR = path.resolve(__tr_dir, '../../../../uploads/audio');
try { fs.mkdirSync(REFERENCE_DIR, { recursive: true }); } catch { /* best-effort */ }
try { fs.mkdirSync(AUDIO_DIR, { recursive: true }); } catch { /* best-effort */ }
const kindFromReq = (req: Request): MediaKind => (req.query.kind === 'audio' ? 'audio' : 'reference');
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

router.use(requireAuth);

/** POST /analyze — { url } → аналитика по ссылке (видео/аккаунт) для TikTok/Douyin/IG/X/Bilibili. */
router.post('/analyze', async (req: AuthedRequest, res: Response) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    if (!url.trim()) return res.status(400).json({ error: 'Передайте ссылку в поле url.' });
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

/** POST /analyze/bulk — { urls: string[] } → массовая сводка (по одному вызову на ссылку). */
router.post('/analyze/bulk', async (req: AuthedRequest, res: Response) => {
  try {
    const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
    if (urls.length === 0) return res.status(400).json({ error: 'Передайте urls[].' });
    const rows = await analyzeBulk(req.tenantId!, urls);
    res.json({ rows });
  } catch (err: any) {
    const msg = err?.message || 'Ошибка массового анализа';
    res.status(/ключ|Укажите/i.test(msg) ? 400 : 502).json({ error: msg });
  }
});

/** POST /analyze/save — { url } → скачать проанализированное видео в Галерею (TikTok, no-watermark). */
router.post('/analyze/save', async (req: AuthedRequest, res: Response) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    const d = detectUrl(url);
    if (!d || d.type !== 'video') return res.status(400).json({ error: 'Нужна ссылка на видео/пост.' });
    if (d.platform !== 'tiktok') return res.status(400).json({ error: 'Скачивание в Галерею пока поддержано для TikTok.' });
    const key = await getEffectiveTikHubKey(req.tenantId!);
    if (!key) return res.status(400).json({ error: 'Ключ Trend не задан.' });
    const one = await fetchOneVideo(key, String(d.videoId));
    const urls = one.ok ? extractDownloadUrls(one.data) : [];
    if (urls.length === 0) return res.status(502).json({ error: 'Не удалось получить прямую ссылку на видео.' });
    const file = await downloadVideoToDisk(urls, { referer: url });
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: 'video', originalName: `tiktok-${d.videoId}.mp4`,
      fileUrl: file.mediaUrl, filePath: file.filePath, mime: 'video/mp4', size: file.size,
    });
    if (!asset) return res.status(500).json({ error: 'Не удалось сохранить в Галерею.' });
    res.json({ ok: true, asset, fileUrl: file.mediaUrl });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Ошибка скачивания' });
  }
});

/** POST /scan — { kind: 'keyword'|'trending', query?, count? } */
router.post('/scan', async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const kind: TrendKind = body.kind === 'trending' ? 'trending' : 'keyword';
    const platform = ['tiktok', 'instagram', 'youtube', 'twitter', 'reddit'].includes(body.platform) ? body.platform : 'tiktok';
    const query = typeof body.query === 'string' ? body.query : undefined;
    const count = Number.isFinite(body.count) ? Number(body.count) : undefined;
    const mode = ['video', 'general', 'app'].includes(body.mode) ? body.mode : 'app';
    const sortType = [0, 1, 2].includes(Number(body.sortType)) ? (Number(body.sortType) as 0 | 1 | 2) : 0;
    const publishTime = [0, 1, 7, 30, 90, 180].includes(Number(body.publishTime))
      ? (Number(body.publishTime) as 0 | 1 | 7 | 30 | 90 | 180) : 0;
    if (kind === 'keyword' && !query?.trim()) {
      return res.status(400).json({ error: 'Для поиска по ключевому слову передайте query.' });
    }
    const result = await scanTrends(req.tenantId!, { kind, query, count, mode, sortType, publishTime, platform });
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

/** POST /videos/:id/download — скачать исходник на диск (стримом). */
router.post('/videos/:id/download', async (req: AuthedRequest, res: Response) => {
  try {
    const row = await getVideo(req.tenantId!, req.params.id);
    if (!row) return res.status(404).json({ error: 'Видео не найдено' });

    // Свежие ПРЯМЫЕ ссылки через App V3 (no-watermark, без cookie tt_chain_token) —
    // play_addr из поиска/трендов часто истекает или требует cookie → 403.
    let urls: string[] = [];
    try {
      const key = await getEffectiveTikHubKey(req.tenantId!);
      if (key && row.external_id) {
        const one = await fetchOneVideo(key, String(row.external_id));
        if (one.ok) urls = extractDownloadUrls(one.data);
      }
    } catch { /* падаем на сохранённую ссылку ниже */ }
    if (urls.length === 0 && row.video_url) urls = [row.video_url];
    if (urls.length === 0) {
      return res.status(400).json({ error: 'Не удалось получить прямую ссылку (App V3 не вернул url).' });
    }

    await setVideoStatus(req.tenantId!, req.params.id, { status: 'downloading', error: null });
    try {
      const file = await downloadVideoToDisk(urls, { referer: row.web_url || undefined });
      await setVideoStatus(req.tenantId!, req.params.id, { status: 'downloaded', fileUrl: file.mediaUrl, filePath: file.filePath, error: null });
      res.json({ ok: true, fileUrl: file.mediaUrl, size: file.size });
    } catch (dlErr: any) {
      await setVideoStatus(req.tenantId!, req.params.id, { status: 'failed', error: dlErr?.message || 'download error' });
      res.status(502).json({ error: dlErr?.message || 'Не удалось скачать видео' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка' });
  }
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

/** GET /media?kind=reference|audio — список загруженных медиа. */
router.get('/media', async (req: AuthedRequest, res: Response) => {
  try {
    const assets = await listAssets(req.tenantId!, kindFromReq(req));
    res.json({ assets });
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
      kind, mediaType, originalName: file.originalname, fileUrl, filePath: file.path, mime, size: file.size,
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
