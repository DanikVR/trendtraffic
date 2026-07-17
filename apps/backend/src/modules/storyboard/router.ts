/**
 * СТОРИБОРД — HTTP API (/api/storyboard).
 *
 * Гейт: JWT + полный доступ (Премиум/Энтерпрайз/триал/superadmin) — раздел входит
 * в подписку целиком, отдельных платных ступеней нет; генерации идут на BYO-ключах
 * тенанта (Gemini/Anthropic из Настроек).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { fromUploadsUrl } from './ffmpeg.js';
import {
  listStoryboards, createStoryboard, getStoryboard, updateStoryboard, deleteStoryboard,
  startAnalyze, startPlan, startRenderChunk, startAssemble, makeChunkPng, setPanelFrame,
  maybeBackfillPreviews, prepareFlowChunk, attachRenderChunk, queueFlowChunks, getFlowQueueMap,
} from './service.js';

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

/** Полный доступ (Премиум/Энтерпрайз/триал/superadmin) — как в trends. */
async function requireFullAccess(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole as any)) return next();
  } catch { /* ниже 402 */ }
  return res.status(402).json({ error: 'Доступно по подписке (Премиум). Оформите её в разделе «Тарифы».' });
}

router.use(express.json({ limit: '2mb' }));
router.use(requireAuth);
router.use(requireFullAccess);

/** GET / — список проектов (карточки). */
router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    res.json({ items: await listStoryboards(req.tenantId!) });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось загрузить список' });
  }
});

const CreateSchema = z.object({
  name: z.string().max(200).optional(),
  sourceUrl: z.string().min(1),
  sourceAssetId: z.string().uuid().optional(),
});

/** POST / — создать проект из видео Галереи ({sourceUrl:'/uploads/...'}). */
router.post('/', async (req: AuthedRequest, res: Response) => {
  const p = CreateSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Некорректные параметры' });
  const abs = fromUploadsUrl(p.data.sourceUrl);
  if (!abs) return res.status(400).json({ error: 'Источник должен быть видео из Галереи (/uploads/...).' });
  try {
    const doc = await createStoryboard(req.tenantId!, p.data);
    res.status(201).json(doc);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось создать проект' });
  }
});

/** GET /:id — документ проекта (+busy). Фронт поллит его во время операций. */
router.get('/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const doc = await getStoryboard(req.tenantId!, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Проект не найден' });
    // проекты, созданные до фичи превью, получают кадры/филмстрип фоном при открытии
    maybeBackfillPreviews(req.tenantId!, req.params.id, doc);
    // Flow-автомат: статусы задач очереди по кускам (для бейджей студии)
    const flowQueue = (doc.settings as any)?.engine === 'flow'
      ? await getFlowQueueMap(req.tenantId!, req.params.id)
      : undefined;
    res.json(flowQueue ? { ...doc, flowQueue } : doc);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Ошибка чтения проекта' });
  }
});

/** PUT /:id — сохранить имя/план/настройки (автосейв студии). */
router.put('/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const doc = await updateStoryboard(req.tenantId!, req.params.id, {
      name: req.body?.name, plan: req.body?.plan, settings: req.body?.settings,
    });
    if (!doc) return res.status(404).json({ error: 'Проект не найден' });
    res.json(doc);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось сохранить' });
  }
});

router.delete('/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await deleteStoryboard(req.tenantId!, req.params.id);
    res.json({ ok });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось удалить' });
  }
});

/** POST /:id/analyze — шаг 2: нормализация+расшифровка+нарезка+панели (фон). */
router.post('/:id/analyze', async (req: AuthedRequest, res: Response) => {
  try {
    const doc = await getStoryboard(req.tenantId!, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Проект не найден' });
    const ok = startAnalyze(req.tenantId!, req.params.id, { skipAi: req.body?.skipAi === true });
    if (!ok) return res.status(409).json({ error: 'Проект уже обрабатывается — дождитесь завершения.' });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось запустить анализ' });
  }
});

/** POST /:id/plan — пере-план панелей Claude-режиссёром (фон). */
router.post('/:id/plan', async (req: AuthedRequest, res: Response) => {
  const ok = startPlan(req.tenantId!, req.params.id);
  if (!ok) return res.status(409).json({ error: 'Проект уже обрабатывается — дождитесь завершения.' });
  res.json({ ok: true });
});

/** POST /:id/png {chunk} — собрать PNG-сториборд куска (синхронно). */
router.post('/:id/png', async (req: AuthedRequest, res: Response) => {
  const chunk = Number(req.body?.chunk);
  if (!Number.isInteger(chunk) || chunk < 0) return res.status(400).json({ error: 'Укажите номер куска' });
  try {
    const doc = await makeChunkPng(req.tenantId!, req.params.id, chunk);
    res.json(doc);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Не удалось собрать сториборд-PNG' });
  }
});

/** POST /:id/panel-frame {chunk, panel, ts} — сменить кадр панели (клик по филмстрипу). */
router.post('/:id/panel-frame', async (req: AuthedRequest, res: Response) => {
  const chunk = Number(req.body?.chunk);
  const panel = Number(req.body?.panel);
  const ts = Number(req.body?.ts);
  if (!Number.isInteger(chunk) || !Number.isInteger(panel) || !Number.isFinite(ts)) {
    return res.status(400).json({ error: 'Укажите кусок, панель и секунду кадра' });
  }
  try {
    res.json(await setPanelFrame(req.tenantId!, req.params.id, chunk, panel, ts));
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Не удалось сменить кадр' });
  }
});

/** POST /:id/render {chunk} — рендер куска программным движком (фон). */
router.post('/:id/render', async (req: AuthedRequest, res: Response) => {
  const chunk = Number(req.body?.chunk);
  if (!Number.isInteger(chunk) || chunk < 0) return res.status(400).json({ error: 'Укажите номер куска' });
  const ok = startRenderChunk(req.tenantId!, req.params.id, chunk);
  if (!ok) return res.status(409).json({ error: 'Уже идёт операция — дождитесь завершения.' });
  res.json({ ok: true });
});

/** POST /:id/prepare-flow {chunk} — материалы для Flow: mp4 куска + PNG + промпт. */
router.post('/:id/prepare-flow', async (req: AuthedRequest, res: Response) => {
  const chunk = Number(req.body?.chunk);
  if (!Number.isInteger(chunk) || chunk < 0) return res.status(400).json({ error: 'Укажите номер куска' });
  try {
    res.json(await prepareFlowChunk(req.tenantId!, req.params.id, chunk));
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Не удалось подготовить материалы' });
  }
});

/** POST /:id/flow-queue {chunks: number[]|'all'} — Flow-АВТОМАТ: поставить куски в очередь
 *  расширения (оно само зальёт референсы, вставит промпт, сгенерит и вернёт клип). */
router.post('/:id/flow-queue', async (req: AuthedRequest, res: Response) => {
  try {
    const doc = await getStoryboard(req.tenantId!, req.params.id);
    if (!doc) return res.status(404).json({ error: 'Проект не найден' });
    const all = (doc.plan?.chunks || []).filter((c) => c.enabled && c.status !== 'done').map((c) => c.idx);
    const chunks: number[] = req.body?.chunks === 'all'
      ? all
      : (Array.isArray(req.body?.chunks) ? req.body.chunks.map(Number).filter(Number.isInteger) : []);
    if (!chunks.length) return res.status(400).json({ error: 'Нет кусков для отправки (все уже готовы?).' });
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || req.protocol || 'https';
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || `${proto}://${req.get('host')}`);
    const r = await queueFlowChunks(req.tenantId!, req.params.id, chunks, base);
    res.json({ ok: true, ...r });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Не удалось поставить в очередь Flow' });
  }
});

/** POST /:id/attach-render {chunk, fileUrl} — прикрепить готовый клип (Flow) как рендер куска. */
router.post('/:id/attach-render', async (req: AuthedRequest, res: Response) => {
  const chunk = Number(req.body?.chunk);
  const fileUrl = typeof req.body?.fileUrl === 'string' ? req.body.fileUrl : '';
  if (!Number.isInteger(chunk) || chunk < 0 || !fileUrl) return res.status(400).json({ error: 'Укажите кусок и файл из Галереи' });
  try {
    res.json(await attachRenderChunk(req.tenantId!, req.params.id, chunk, fileUrl));
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Не удалось прикрепить клип' });
  }
});

/** POST /:id/assemble — финальная склейка готовых кусков → Галерея (фон). */
router.post('/:id/assemble', async (req: AuthedRequest, res: Response) => {
  const ok = startAssemble(req.tenantId!, req.params.id);
  if (!ok) return res.status(409).json({ error: 'Уже идёт операция — дождитесь завершения.' });
  res.json({ ok: true });
});

export default router;
