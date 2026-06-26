/**
 * Express router для Quest Flow интеграции.
 *
 * Два набора эндпоинтов:
 *
 * 1. Inbound webhook (Bearer API key — авторизация ключом, без JWT)
 *    POST /api/quest-flow/inbound
 *    Принимает запрос от Quest Flow при срабатывании цепочки Telegram-бота.
 *
 * 2. Управление API-ключами (требует JWT + Enterprise)
 *    GET    /api/quest-flow/keys           — список ключей tenant'а
 *    POST   /api/quest-flow/keys           — создать новый (returns raw key один раз)
 *    DELETE /api/quest-flow/keys/:id       — отозвать (revoke) ключ
 *    DELETE /api/quest-flow/keys/:id/hard  — полное удаление из БД
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { verifyKey, createKey, listKeys, revokeKey, deleteKey } from './keys.js';
import {
  processQuestFlowInbound,
  processQuestFlowInboundMedia,
  mediaExtForMime,
  QuestFlowAuthError,
  QuestFlowBadRequestError,
} from './inbound.js';
import questFlowPromptRouter from './prompt.js';
import questFlowImageRouter from './image_config_router.js';
import { getPendingOutbox, ackOutboxMessage } from '../enterprise_chat/outbox.js';
import {
  requireEnterprise,
  EnterpriseFeatureRequiredError,
  type UserRole,
} from '../billing/feature_gate.js';
import { InsufficientBalanceError, FeatureNotAvailableError } from '../assistant/service.js';

const router = Router();
import { JWT_SECRET } from '../../config/secrets.js';

// ── Multipart upload (inbound-media: видео/документы от клиента) ──────────────
// Та же папка, что и enterprise_chat upload — её раздаёт express.static('/uploads').
const __qf_filename = fileURLToPath(import.meta.url);
const __qf_dirname = path.dirname(__qf_filename);
const QF_UPLOAD_DIR = path.resolve(__qf_dirname, '../../../../uploads/enterprise-chat');
try { fs.mkdirSync(QF_UPLOAD_DIR, { recursive: true }); } catch { /* best-effort */ }

const QF_MEDIA_MAX_BYTES = 50 * 1024 * 1024; // 50 МБ

const inboundMediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, QF_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // qf-<uuid><ext>; если у имени нет расширения — берём по MIME (иначе <video> не проиграется).
    const ext = path.extname(file.originalname) || mediaExtForMime(file.mimetype || '');
    cb(null, `qf-${randomUUID()}${ext}`);
  },
});
const uploadInboundMedia = multer({ storage: inboundMediaStorage, limits: { fileSize: QF_MEDIA_MAX_BYTES } });

/** Запускает multer-middleware как промис (чтобы ловить ошибки лимита размера). */
function runMulterSingle(field: string, req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadInboundMedia.single(field)(req, res, (err: any) => (err ? reject(err) : resolve()));
  });
}

// ============================================================================
// 1. INBOUND WEBHOOK (Bearer API key auth)
// ============================================================================

router.post('/inbound', async (req: Request, res: Response) => {
  // 1. Auth
  const auth = req.headers.authorization || '';
  const rawKey = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!rawKey) {
    return res.status(401).json({ error: 'Authorization: Bearer <vbvx_qf_...> обязателен' });
  }
  const ident = await verifyKey(rawKey);
  if (!ident) {
    return res.status(401).json({ error: 'Невалидный или отозванный ключ' });
  }

  // 2. Process
  try {
    const result = await processQuestFlowInbound(ident.tenantId, req.body || {});
    return res.json(result);
  } catch (err: any) {
    if (err instanceof QuestFlowAuthError) {
      return res.status(401).json({ error: err.message });
    }
    if (err instanceof QuestFlowBadRequestError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof EnterpriseFeatureRequiredError) {
      return res.status(402).json({ error: err.message, feature: err.feature });
    }
    if (err instanceof FeatureNotAvailableError) {
      return res.status(402).json({ error: err.message });
    }
    if (err instanceof InsufficientBalanceError) {
      return res.status(402).json({ error: err.message });
    }
    console.error('[quest_flow/router] inbound failed:', err);
    return res.status(500).json({ error: err?.message || 'Внутренняя ошибка' });
  }
});

// ============================================================================
// 1b. INBOUND MEDIA (видео/документы) — multipart/form-data, Bearer API key
// ============================================================================
// Quest Flow скачивает файл из Telegram и шлёт его сюда (поле "file" + telegram_*).
// Используется для крупных вложений (видео/файлы), которые не влезают в JSON-тело.
//
// Поля формы (multipart/form-data):
//   file                 — сам файл (обязательно)
//   telegram_bot_id      — обязательно
//   telegram_user_id     — обязательно
//   telegram_username    — опционально
//   telegram_display_name— опционально
//   text | caption       — опционально (подпись к файлу)
//   metadata             — опционально (JSON-строка)
router.post('/inbound-media', async (req: Request, res: Response) => {
  // 1. Auth (тот же Bearer API key, что и у /inbound)
  const auth = req.headers.authorization || '';
  const rawKey = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!rawKey) {
    return res.status(401).json({ error: 'Authorization: Bearer <vbvx_qf_...> обязателен' });
  }
  const ident = await verifyKey(rawKey);
  if (!ident) {
    return res.status(401).json({ error: 'Невалидный или отозванный ключ' });
  }

  // 2. Parse multipart (file + текстовые поля). Ловим превышение лимита размера.
  try {
    await runMulterSingle('file', req, res);
  } catch (err: any) {
    // diskStorage мог успеть записать частичный файл до ошибки — чистим его.
    const partial = (req as any).file as Express.Multer.File | undefined;
    if (partial?.path) { try { fs.unlinkSync(partial.path); } catch { /* best-effort */ } }
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Файл превышает лимит ${Math.round(QF_MEDIA_MAX_BYTES / 1024 / 1024)} МБ` });
    }
    return res.status(400).json({ error: err?.message || 'Не удалось прочитать файл' });
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ error: 'Файл не передан (ожидается multipart-поле "file")' });
  }

  // metadata может прийти JSON-строкой (multipart-поля — строки).
  let metadata: Record<string, any> | undefined;
  const rawMeta = (req.body || {}).metadata;
  if (typeof rawMeta === 'string' && rawMeta.trim()) {
    try { metadata = JSON.parse(rawMeta); } catch { metadata = { raw: rawMeta.slice(0, 2000) }; }
  } else if (rawMeta && typeof rawMeta === 'object') {
    metadata = rawMeta;
  }

  const body = req.body || {};
  const caption = body.text != null ? String(body.text) : (body.caption != null ? String(body.caption) : undefined);

  // 3. Process — общий хвост (запись реплики → AI-ответ → теги → уведомления).
  try {
    const result = await processQuestFlowInboundMedia(ident.tenantId, {
      telegram_bot_id: String(body.telegram_bot_id || ''),
      telegram_user_id: String(body.telegram_user_id || ''),
      telegram_username: body.telegram_username ? String(body.telegram_username) : undefined,
      telegram_display_name: body.telegram_display_name ? String(body.telegram_display_name) : undefined,
      text: caption,
      // Явный тип от QF ('video'/'document'/…) — приоритетнее MIME при распознавании.
      kind: body.kind ? String(body.kind) : undefined,
      // Жёсткая привязка функции преобразования изображения (кнопка QF).
      preset_key: body.preset_key ? String(body.preset_key) : undefined,
      metadata,
      file: {
        filename: path.basename(file.path),
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        originalname: file.originalname,
      },
    });
    return res.json(result);
  } catch (err: any) {
    if (err instanceof QuestFlowAuthError) {
      return res.status(401).json({ error: err.message });
    }
    if (err instanceof QuestFlowBadRequestError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof EnterpriseFeatureRequiredError) {
      return res.status(402).json({ error: err.message, feature: err.feature });
    }
    if (err instanceof FeatureNotAvailableError) {
      return res.status(402).json({ error: err.message });
    }
    if (err instanceof InsufficientBalanceError) {
      return res.status(402).json({ error: err.message });
    }
    console.error('[quest_flow/router] inbound-media failed:', err);
    return res.status(500).json({ error: err?.message || 'Внутренняя ошибка' });
  }
});

// ============================================================================
// 2. KEY MANAGEMENT (JWT + Enterprise)
// ============================================================================

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: UserRole;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  // Скип для inbound — уже обработан выше
  if (req.path === '/inbound') return next();
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный JWT токен' });
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

// Применяем requireAuth ТОЛЬКО к /keys/* (не к /inbound)
router.use('/keys', requireAuth);

router.get('/keys', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-keys'))) return;
  try {
    const keys = await listKeys(req.tenantId!);
    res.json({ keys });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

router.post('/keys', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-keys'))) return;
  try {
    const { label } = req.body || {};
    const created = await createKey(req.tenantId!, typeof label === 'string' ? label : undefined);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка создания ключа' });
  }
});

router.delete('/keys/:id', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-keys'))) return;
  try {
    const ok = await revokeKey(req.tenantId!, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Ключ не найден' });
    res.json({ ok: true, revoked: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка отзыва ключа' });
  }
});

router.delete('/keys/:id/hard', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-keys'))) return;
  try {
    const ok = await deleteKey(req.tenantId!, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Ключ не найден' });
    res.json({ ok: true, deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

// Подключаем prompt-роутер на /prompt
router.use('/prompt', questFlowPromptRouter);

// Настройки преобразования изображений (модель + пресеты «блоков обработки») на /image
router.use('/image', questFlowImageRouter);

// ============================================================================
// 3. OUTBOX (polling pending admin-сообщений для отправки в Telegram через QF)
// ============================================================================
// Аутентификация теми же per-tenant API ключами что и /inbound (Bearer).
//
// GET  /api/quest-flow/outbox            — список pending сообщений (admin → клиент)
// POST /api/quest-flow/outbox/:id/ack    — пометить сообщение как доставленное

router.get('/outbox', async (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const rawKey = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!rawKey) return res.status(401).json({ error: 'Authorization: Bearer обязателен' });
  const ident = await verifyKey(rawKey);
  if (!ident) return res.status(401).json({ error: 'Невалидный ключ' });
  try {
    const messages = await getPendingOutbox(ident.tenantId);
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения outbox' });
  }
});

router.post('/outbox/:id/ack', async (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const rawKey = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!rawKey) return res.status(401).json({ error: 'Authorization: Bearer обязателен' });
  const ident = await verifyKey(rawKey);
  if (!ident) return res.status(401).json({ error: 'Невалидный ключ' });
  try {
    const ok = await ackOutboxMessage(ident.tenantId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Сообщение не найдено' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка ack' });
  }
});

export default router;
