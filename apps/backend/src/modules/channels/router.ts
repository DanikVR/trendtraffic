/**
 * TrendTraffic — HTTP-роутер «Каналы» (анализ всех видео канала по ссылке).
 *
 *  POST /api/channels/analyze  — { url, maxVideos? } → { profile, videos[], count, hasMore }
 *
 * Защита (как у /api/social-ext/proxy): JWT → rate-limit (потолок на ключ TikHub,
 * каждый разбор = до ~11 вызовов) → Enterprise-гейт (фича только для Enterprise).
 * Эффективный ключ TikHub — по тенанту. Фаза 1: on-demand, без БД/истории.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { analyzeChannel } from './service.js';

const router = Router();

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

/** Доступ — только Enterprise (+superadmin-bypass внутри hasEnterpriseAccess). */
async function requireEnterprise(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole)) return next();
  } catch (err) {
    console.warn('[channels] enterprise-гейт:', err);
  }
  return res.status(403).json({ error: 'Доступно только на тарифе Enterprise' });
}

// Один разбор канала = до ~11 вызовов TikHub (профиль + страницы). 30/мин на тенанта —
// с запасом для нормальной работы, но рубит runaway-циклы/скрейперы (защита ключа).
const channelsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).tenantId || 'channels-anon',
  message: { error: 'Слишком много запросов к анализу каналов. Подождите минуту.' },
});

router.use(requireAuth);
router.use(channelsLimiter);   // лимит ДО enterprise-гейта — потолок на ключ при любом раскладе
router.use(requireEnterprise);

/** POST /analyze — { url, maxVideos? } → профиль канала + все его видео. */
router.post('/analyze', async (req: AuthedRequest, res: Response) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!url) return res.status(400).json({ error: 'Передайте ссылку на канал в поле url.' });
    if (url.length > 2048) return res.status(400).json({ error: 'Слишком длинная ссылка.' });
    const maxVideos = Number.isFinite(Number(req.body?.maxVideos)) ? Number(req.body.maxVideos) : undefined;
    const result = await analyzeChannel(req.tenantId!, url, { maxVideos });
    res.json(result);
  } catch (err: any) {
    const msg = err?.message || 'Ошибка анализа канала';
    const code = /распозн|ключ|задайте|укажите/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

export default router;
