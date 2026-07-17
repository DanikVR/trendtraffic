/**
 * СКИЛЛЫ — HTTP API (/api/skills): найди-виралку / антиклише / формула-подписи.
 * Ядро — в service.ts (общее с MCP-тулзами). Всё входит в подписку (гейт полного
 * доступа как в trends); Claude и TikHub — BYO-ключи тенанта из Настроек.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { NoAnthropicKeyError } from './claude.js';
import { runFindViral, runAnticliche, runCaption } from './service.js';

const router = Router();

interface AuthedRequest extends Request { tenantId?: string; userRole?: string }

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const d = jwt.verify(h.substring(7), JWT_SECRET) as any;
    req.tenantId = d.tenantId;
    req.userRole = d.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

async function requireFullAccess(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole as any)) return next();
  } catch { /* ниже 402 */ }
  return res.status(402).json({ error: 'Доступно по подписке (Премиум). Оформите её в разделе «Тарифы».' });
}

router.use(express.json({ limit: '1mb' }));
router.use(requireAuth);
router.use(requireFullAccess);

const FindViralSchema = z.object({
  topic: z.string().min(2).max(200),
  minViews: z.number().int().min(0).max(1_000_000_000).optional(),
  days: z.number().int().min(1).max(365).optional(),
  region: z.string().max(4).optional(),
  limit: z.number().int().min(1).max(30).optional(),
});

/** POST /find-viral — find-only поиск виральных роликов (таблица + сноска охвата). */
router.post('/find-viral', async (req: AuthedRequest, res: Response) => {
  const p = FindViralSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Укажите тему поиска (2–200 символов).' });
  try {
    res.json(await runFindViral(req.tenantId!, p.data));
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Поиск не удался' });
  }
});

const AnticlicheSchema = z.object({ text: z.string().min(20).max(12_000) });

/** POST /anticliche — {text} → {cleaned, changes[], verdict, questions[]}. */
router.post('/anticliche', async (req: AuthedRequest, res: Response) => {
  const p = AnticlicheSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Вставьте текст (от 20 символов).' });
  try {
    res.json(await runAnticliche(req.tenantId!, p.data.text));
  } catch (e: any) {
    const code = e instanceof NoAnthropicKeyError ? 400 : 500;
    res.status(code).json({ error: e?.message || 'Не удалось обработать текст' });
  }
});

const CaptionSchema = z.object({
  topic: z.string().min(3).max(1500),
  codeWord: z.string().max(24).optional(),
  link: z.string().max(300).optional(),
  language: z.string().max(12).optional(),
});

/** POST /caption — {topic, codeWord?, link?} → {caption, hooks[3], hashtags[], codeWord}. */
router.post('/caption', async (req: AuthedRequest, res: Response) => {
  const p = CaptionSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Опишите тему поста (от 3 символов).' });
  try {
    res.json(await runCaption(req.tenantId!, p.data));
  } catch (e: any) {
    const code = e instanceof NoAnthropicKeyError ? 400 : 500;
    res.status(code).json({ error: e?.message || 'Не удалось сгенерировать подпись' });
  }
});

export default router;
