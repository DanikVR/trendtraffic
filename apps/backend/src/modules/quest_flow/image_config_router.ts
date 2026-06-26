/**
 * CRUD настроек преобразования изображений Quest Flow (JWT + Enterprise).
 * Монтируется в router.ts как /api/quest-flow/image.
 *
 *  GET  /api/quest-flow/image/config     — модель + пресеты + каталог функций + список моделей
 *  PUT  /api/quest-flow/image/model      — выбрать модель (одну на аккаунт)
 *  PUT  /api/quest-flow/image/presets    — сохранить список «блоков обработки»
 *  GET  /api/quest-flow/image/models     — модели, реально доступные ключу (ListModels ∩ курируемый список)
 *  POST /api/quest-flow/image/reference  — загрузить референс-картинку (multipart "file") → { url }
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { JWT_SECRET } from '../../config/secrets.js';
import {
  requireEnterprise,
  EnterpriseFeatureRequiredError,
  type UserRole,
} from '../billing/feature_gate.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { listImageFunctions } from './image_functions.js';
import {
  getTenantImageConfig,
  setTenantImageModel,
  setTenantImagePresets,
  sanitizePreset,
  IMAGE_CAPABLE_MODELS,
  DEFAULT_IMAGE_MODEL,
} from './image_presets.js';
import { runImagePresetTransform } from './image_transform.js';

// Тестовые картинки держим в памяти (не сохраняем — это пробный прогон).
const uploadTest = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 14 },
});

const router = Router();

// ── Reference image upload (та же папка uploads/enterprise-chat) ──────────────
const __ic_filename = fileURLToPath(import.meta.url);
const __ic_dirname = path.dirname(__ic_filename);
const REF_UPLOAD_DIR = path.resolve(__ic_dirname, '../../../../uploads/enterprise-chat');
try { fs.mkdirSync(REF_UPLOAD_DIR, { recursive: true }); } catch { /* best-effort */ }

const refStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, REF_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `qf-ref-${randomUUID()}${ext}`);
  },
});
const uploadRef = multer({
  storage: refStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 МБ — референсы не должны быть огромными
  fileFilter: (_req, file, cb) => cb(null, (file.mimetype || '').startsWith('image/')),
});

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: UserRole;
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

async function ensureEnterprise(req: AuthedRequest, res: Response, feature: string): Promise<boolean> {
  try {
    await requireEnterprise(req.tenantId, req.userRole, feature);
    return true;
  } catch (err) {
    if (err instanceof EnterpriseFeatureRequiredError) {
      res.status(402).json({ error: err.message, feature: err.feature });
      return false;
    }
    res.status(500).json({ error: (err as Error).message });
    return false;
  }
}

router.use(requireAuth);

// GET /config — всё для UI одним запросом (без сетевого ListModels).
router.get('/config', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-image'))) return;
  try {
    const cfg = await getTenantImageConfig(req.tenantId!);
    res.json({
      model: cfg.model,
      defaultModel: DEFAULT_IMAGE_MODEL,
      presets: cfg.presets,
      functions: listImageFunctions(),
      models: IMAGE_CAPABLE_MODELS,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

// PUT /model — { model }
router.put('/model', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-image'))) return;
  try {
    const model = String((req.body || {}).model || '');
    const saved = await setTenantImageModel(req.tenantId!, model);
    res.json({ ok: true, model: saved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения модели' });
  }
});

// PUT /presets — { presets: [...] }
router.put('/presets', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-image'))) return;
  try {
    const presets = (req.body || {}).presets;
    const saved = await setTenantImagePresets(req.tenantId!, presets);
    res.json({ ok: true, presets: saved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения пресетов' });
  }
});

// GET /models — модели, реально доступные ключу (пересечение с курируемым списком).
router.get('/models', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-image'))) return;
  try {
    const apiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!apiKey) {
      // Ключа нет — вернём курируемый список, но пометим hasKey:false (UI попросит задать ключ).
      return res.json({ hasKey: false, models: IMAGE_CAPABLE_MODELS });
    }
    let availableIds: Set<string> | null = null;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1000`;
      const resp = await fetch(url, { method: 'GET' });
      if (resp.ok) {
        const data = (await resp.json()) as any;
        const ids = (data?.models || [])
          .map((m: any) => String(m?.name || '').replace(/^models\//, ''))
          .filter(Boolean);
        availableIds = new Set<string>(ids);
      }
    } catch {
      availableIds = null; // сеть упала — отдадим курируемый список как есть
    }
    const models = availableIds
      ? IMAGE_CAPABLE_MODELS.filter((m) => availableIds!.has(m.id))
      : IMAGE_CAPABLE_MODELS;
    // Если пересечение пустое (ListModels не отдал image-моделей) — отдаём курируемый,
    // чтобы UI не оказался без вариантов (ключ мог не иметь доступа к preview-моделям).
    res.json({ hasKey: true, models: models.length ? models : IMAGE_CAPABLE_MODELS });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка получения списка моделей' });
  }
});

// POST /test — пробная генерация по пресету БЕЗ Telegram/комнаты (для проверки из настроек).
//   Поля (multipart): preset (JSON непосохранённого блока) ИЛИ preset_key; text; files[] (пробные фото).
//   Возвращает превью data-URL'ом (не зависит от /uploads и PUBLIC_BASE_URL).
router.post('/test', uploadTest.array('files', 14), async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-image'))) return;
  try {
    const body = req.body || {};
    const cfg = await getTenantImageConfig(req.tenantId!);

    // Пресет: inline (чтобы тестировать ещё не сохранённые правки) или по ключу из сохранённых.
    let preset = null;
    if (typeof body.preset === 'string' && body.preset.trim()) {
      try { preset = sanitizePreset(JSON.parse(body.preset)); } catch { preset = null; }
    }
    if (!preset && body.preset_key) {
      preset = cfg.presets.find((p) => p.presetKey === String(body.preset_key)) || null;
    }
    if (!preset) return res.status(400).json({ error: 'Передайте валидный preset или preset_key' });

    const apiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!apiKey) return res.status(402).json({ error: 'Gemini API ключ не задан (раздел «Gemini API»).' });

    const files = ((req as any).files as Express.Multer.File[] | undefined) || [];
    const clientImages = files.map((f) => ({
      base64: f.buffer.toString('base64'),
      mime: f.mimetype || 'image/jpeg',
    }));
    const clientRequest = typeof body.text === 'string' ? body.text : '';

    const { image, promptUsed } = await runImagePresetTransform({
      apiKey,
      model: cfg.model,
      preset,
      roomId: '', // тест — без комнаты
      clientImages,
      clientRequest,
    });

    // Превью отдаём data-URL'ом; сам тестовый файл не храним.
    let imageDataUrl: string | null = null;
    try {
      const buf = fs.readFileSync(image.filePath);
      imageDataUrl = `data:${image.mediaMime};base64,${buf.toString('base64')}`;
      fs.unlinkSync(image.filePath);
    } catch { /* если не прочитали — вернём относительный URL */ }

    res.json({ ok: true, imageDataUrl, imageUrl: image.mediaUrl, model: cfg.model, promptUsed });
  } catch (err: any) {
    // 200 + ok:false — чтобы UI показал причину прямо в блоке (а не как HTTP-ошибку).
    res.json({ ok: false, error: err?.message || 'Ошибка генерации' });
  }
});

// POST /reference — загрузка референс-картинки. Возвращает относительный URL.
router.post('/reference', uploadRef.single('file'), async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-image'))) return;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'Файл не передан (ожидается image в поле "file")' });
  try {
    const url = `/uploads/enterprise-chat/${path.basename(file.path)}`;
    res.status(201).json({ ok: true, url, size: file.size, mime: file.mimetype });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка загрузки референса' });
  }
});

export default router;
