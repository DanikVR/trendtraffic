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
import { JWT_SECRET } from '../../config/secrets.js';
import { scanTrends, listRecentVideos, getVideo, setVideoStatus, deleteVideo, deleteVideos, type TrendKind } from './service.js';
import { downloadVideoToDisk } from '../media/store_video.js';
import { fetchOneVideo, extractDownloadUrls } from '../tikhub/tikhub_client.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';

const router = Router();

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

/** POST /scan — { kind: 'keyword'|'trending', query?, count? } */
router.post('/scan', async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const kind: TrendKind = body.kind === 'trending' ? 'trending' : 'keyword';
    const query = typeof body.query === 'string' ? body.query : undefined;
    const count = Number.isFinite(body.count) ? Number(body.count) : undefined;
    const mode = ['video', 'general', 'app'].includes(body.mode) ? body.mode : 'video';
    const sortType = [0, 1, 2].includes(Number(body.sortType)) ? (Number(body.sortType) as 0 | 1 | 2) : 0;
    const publishTime = [0, 1, 7, 30, 90, 180].includes(Number(body.publishTime))
      ? (Number(body.publishTime) as 0 | 1 | 7 | 30 | 90 | 180) : 0;
    if (kind === 'keyword' && !query?.trim()) {
      return res.status(400).json({ error: 'Для поиска по ключевому слову передайте query.' });
    }
    const result = await scanTrends(req.tenantId!, { kind, query, count, mode, sortType, publishTime });
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

export default router;
