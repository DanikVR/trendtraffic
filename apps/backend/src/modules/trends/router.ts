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
import { scanTrends, listRecentVideos, getVideo, setVideoStatus, type TrendKind } from './service.js';
import { downloadVideoToDisk } from '../media/store_video.js';

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
    if (kind === 'keyword' && !query?.trim()) {
      return res.status(400).json({ error: 'Для поиска по ключевому слову передайте query.' });
    }
    const result = await scanTrends(req.tenantId!, { kind, query, count });
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
    const videos = await listRecentVideos(req.tenantId!, limit);
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
    if (!row.video_url) {
      return res.status(400).json({ error: 'У видео нет прямой ссылки (CDN-URL пуст). Возможно, потребуется fetch_one_video — добавим в следующем шаге.' });
    }
    await setVideoStatus(req.tenantId!, req.params.id, { status: 'downloading', error: null });
    try {
      const file = await downloadVideoToDisk(row.video_url, { referer: row.web_url || undefined });
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

export default router;
