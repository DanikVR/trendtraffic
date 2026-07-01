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
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { generateImage } from '../quest_flow/image_gen.js';
import { createAsset } from '../media/assets.js';
import { createPodcastJob, createRenderJob, getRenderJob, listRenderJobs } from './service.js';
import { generatePodcastDialogue } from './director.js';
import { diarizeWithGemini } from './audio_diarize.js';

const router = Router();

// ── AI-ракурсы студии (Gemini Nano Banana Pro, image-to-image) ────────────────
/** Топовая image-модель Gemini (Nano Banana Pro) — макс. качество, сохранение лиц/студии. */
const PODCAST_ANGLE_MODEL = 'gemini-3-pro-image';
const ANGLE_PROMPTS: Record<string, string> = {
  left: 'с камеры, смещённой влево (вид немного слева)',
  right: 'с камеры, смещённой вправо (вид немного справа)',
  up: 'с более высокой точки (лёгкий верхний ракурс, камера сверху)',
  down: 'с более низкой точки (лёгкий нижний ракурс, камера снизу)',
  back: 'из-за спин ведущих (вид со спины/сбоку, видно студию перед ними)',
  closeup: 'более крупным планом обоих ведущих',
  wide: 'общим широким планом всей студии',
};
function anglePrompt(preset: string, custom: string): string {
  // Свой промт — основная инструкция от пользователя + сохранение личности/студии.
  if (preset === 'custom') {
    return 'На фото — студия и те же люди. '
      + (custom || 'Покажи сцену с другого ракурса') + '. '
      + 'Сохрани те же лица, причёски, одежду, студию, освещение и цветовую гамму. '
      + 'Фотореалистично, высокое качество. Верни только изображение.';
  }
  const a = ANGLE_PROMPTS[preset] || 'с другого ракурса';
  return `На фото — студия подкаста и два ведущих. Перерисуй ЭТУ ЖЕ сцену ${a}, как другой ракурс той же съёмки. `
    + 'Строго сохрани те же лица, причёски, одежду, телосложение, студию, мебель, технику, освещение и цветовую гамму. '
    + 'Фотореалистично, высокое качество, кинематографично. Верни только изображение.'
    + (custom ? ` Дополнительно: ${custom}.` : '');
}
async function fetchImageBase64(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get('content-type') || 'image/jpeg';
    return { base64: Buffer.from(await r.arrayBuffer()).toString('base64'), mime };
  } catch { return null; }
}

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

/** POST /podcast/diarize — разобрать запись подкаста на 2 голоса.
 *  Приоритет: Gemini (аудио-понимание тенант-ключом, качественно, с подсказкой пола) →
 *  воркер (акустическая кластеризация / pyannote при HF-ключе / паузы). */
router.post('/podcast/diarize', async (req: AuthedRequest, res: Response) => {
  try {
    const recordingUrl = typeof req.body?.recordingUrl === 'string' ? req.body.recordingUrl : '';
    if (!recordingUrl) return res.status(400).json({ error: 'Не указана запись (recordingUrl).' });
    const hostAVoice = typeof req.body?.hostAVoice === 'string' ? req.body.hostAVoice : undefined;
    const hostBVoice = typeof req.body?.hostBVoice === 'string' ? req.body.hostBVoice : undefined;
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const absUrl = /^https?:\/\//i.test(recordingUrl)
      ? recordingUrl
      : (base ? base + (recordingUrl.startsWith('/') ? recordingUrl : '/' + recordingUrl) : recordingUrl);

    // 1) Gemini — качественная диаризация тенант-ключом (тот же, что и AI-ракурсы).
    const geminiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (geminiKey && /^https?:\/\//i.test(absUrl)) {
      try {
        const g = await diarizeWithGemini({ apiKey: geminiKey, audioUrl: absUrl, hostAVoice, hostBVoice });
        if (g.lines.length) return res.json({ lines: g.lines, tracks: [], note: g.note });
      } catch (e: any) {
        console.warn('[podcast/diarize] Gemini не справился, фолбэк на воркер:', e?.message || e);
      }
    }

    // 2) Фолбэк — рендер-воркер (кластеризация / pyannote / паузы).
    const worker = getRenderGpuWorkerUrl() || getRenderWorkerUrl();
    if (!worker) {
      return res.status(503).json({ error: geminiKey
        ? 'Gemini не смог разобрать запись, а рендер-воркер не подключён.'
        : 'Подключите Gemini-ключ (Настройки → Gemini API) для точного разбора, либо рендер-воркер.' });
    }
    const hfToken = await getEffectiveProviderKey(req.tenantId!, 'hf');
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

/** POST /podcast/angle — AI-ракурс студии (Gemini Nano Banana Pro, image-to-image).
 *  body: { imageUrl, preset?, prompt? } → { mediaUrl, assetId }. */
router.post('/podcast/angle', async (req: AuthedRequest, res: Response) => {
  try {
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
    const preset = typeof req.body?.preset === 'string' ? req.body.preset : 'left';
    const custom = typeof req.body?.prompt === 'string' ? req.body.prompt.slice(0, 400) : '';
    if (!imageUrl) return res.status(400).json({ error: 'Не указано исходное фото (imageUrl).' });
    const apiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!apiKey) return res.status(400).json({ error: 'Подключите свой Gemini-ключ (Настройки → Gemini API) — ракурсы рисует Gemini.' });
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const abs = /^https?:\/\//i.test(imageUrl) ? imageUrl : (base ? base + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl) : imageUrl);
    const img = await fetchImageBase64(abs);
    if (!img) return res.status(400).json({ error: 'Не удалось загрузить исходное фото.' });
    const gen = await generateImage({
      apiKey, model: PODCAST_ANGLE_MODEL,
      prompt: anglePrompt(preset, custom),
      inputImages: [{ base64: img.base64, mime: img.mime }],
    });
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: 'image', originalName: `Ракурс студии (${preset})`,
      fileUrl: gen.mediaUrl, filePath: gen.filePath, mime: gen.mediaMime, size: gen.mediaSize,
    });
    res.json({ mediaUrl: gen.mediaUrl, assetId: asset?.id || null });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка генерации ракурса' });
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
