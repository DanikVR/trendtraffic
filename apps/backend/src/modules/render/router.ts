/**
 * TrendTraffic — HTTP-роутер рендера «Собрать».
 *
 *  POST /api/render/flow/:flowId  — поставить сборку сценария в очередь
 *  GET  /api/render               — список задач рендера тенанта
 *  GET  /api/render/:id           — одна задача (для поллинга статуса)
 *  GET  /api/render/config/gpu    — текущая цель GPU (для подписи в UI)
 *
 * Все эндпоинты требуют JWT. Изоляция — по tenant_id из токена (как в trends).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { getRenderGpuTarget, getRenderWorkerUrl, getRenderGpuWorkerUrl } from '../../config/systemConfig.js';
import { getFlow } from '../flows/service.js';
import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';
import { createPodcastJob, createRenderJob, getRenderJob, listRenderJobs } from './service.js';
import { generatePodcastDialogue } from './director.js';

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

/** POST /flow/:flowId — собрать сценарий → задача в очередь. body: { inputUrl? } */
router.post('/flow/:flowId', async (req: AuthedRequest, res: Response) => {
  try {
    const flow = await getFlow(req.tenantId!, req.params.flowId);
    if (!flow) return res.status(404).json({ error: 'Сценарий не найден' });
    const inputUrl = typeof req.body?.inputUrl === 'string' ? req.body.inputUrl : null;
    const { job, error } = await createRenderJob(req.tenantId!, { flow, inputUrl });
    if (error) return res.status(400).json({ error });
    res.status(201).json({ job });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка постановки в очередь' });
  }
});

// ── Подкаст-сцена (2 ведущих) ─────────────────────────────────────────────────
// Спец-роуты ('/podcast/dialogue', '/podcast/diarize') регистрируем ДО '/podcast/:flowId',
// иначе параметрический маршрут перехватит их (flowId='dialogue').

/** POST /podcast/dialogue — сгенерировать диалог двух ведущих по брифу. */
router.post('/podcast/dialogue', async (req: AuthedRequest, res: Response) => {
  try {
    const { brief, nameA, nameB, turns } = req.body || {};
    const r = await generatePodcastDialogue({
      tenantId: req.tenantId!,
      brief: typeof brief === 'string' ? brief : '',
      nameA: typeof nameA === 'string' ? nameA : undefined,
      nameB: typeof nameB === 'string' ? nameB : undefined,
      turns: Number.isFinite(Number(turns)) ? Number(turns) : undefined,
    });
    res.json({ lines: r.lines, note: r.note });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка генерации диалога' });
  }
});

/** POST /podcast/diarize — разобрать запись подкаста на 2 голоса (через воркер + HuggingFace). */
router.post('/podcast/diarize', async (req: AuthedRequest, res: Response) => {
  try {
    const recordingUrl = typeof req.body?.recordingUrl === 'string' ? req.body.recordingUrl : '';
    if (!recordingUrl) return res.status(400).json({ error: 'Не указана запись (recordingUrl).' });
    // pyannote требует torch → предпочитаем GPU-воркер (там есть torch), фолбэк — CPU-воркер.
    const worker = getRenderGpuWorkerUrl() || getRenderWorkerUrl();
    if (!worker) return res.status(503).json({ error: 'Рендер-воркер не подключён — разбор недоступен.' });
    const hfToken = await getEffectiveProviderKey(req.tenantId!, 'hf');
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 600_000);
    try {
      const r = await fetch(`${worker}/diarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_url: recordingUrl, base_url: base, hf_token: hfToken || null }),
        signal: ctrl.signal,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(502).json({ error: (d as any)?.error || `воркер вернул HTTP ${r.status}` });
      res.json({ lines: (d as any)?.lines || [], tracks: (d as any)?.tracks || [], note: (d as any)?.note || null });
    } finally {
      clearTimeout(t);
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка разбора записи' });
  }
});

/** POST /podcast/:flowId — собрать подкаст-сцену → задача в очередь. body: { spec? } */
router.post('/podcast/:flowId', async (req: AuthedRequest, res: Response) => {
  try {
    const flow = await getFlow(req.tenantId!, req.params.flowId);
    if (!flow) return res.status(404).json({ error: 'Сценарий не найден' });
    const spec = req.body?.spec && typeof req.body.spec === 'object' ? req.body.spec : null;
    const { job, error } = await createPodcastJob(req.tenantId!, { flow, spec });
    if (error) return res.status(400).json({ error });
    res.status(201).json({ job });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка постановки в очередь' });
  }
});

/** GET / — последние задачи рендера тенанта. */
router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 50;
    res.json({ jobs: await listRenderJobs(req.tenantId!, limit), gpuTarget: getRenderGpuTarget() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** GET /config/gpu — текущая цель GPU (home|cloud|off). */
router.get('/config/gpu', (_req: AuthedRequest, res: Response) => {
  res.json({ gpuTarget: getRenderGpuTarget() });
});

/** GET /:id — одна задача (поллинг статуса). */
router.get('/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const job = await getRenderJob(req.tenantId!, req.params.id);
    if (!job) return res.status(404).json({ error: 'Задача не найдена' });
    res.json({ job });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

export default router;
