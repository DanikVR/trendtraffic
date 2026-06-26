/**
 * Express router для чата Enterprise-комнаты (Блок 1).
 *
 * Endpoints (все требуют JWT + Enterprise):
 *  - GET    /api/enterprise-chat/:roomId/messages       — список сообщений
 *  - POST   /api/enterprise-chat/:roomId/send           — отправить от админа (text)
 *  - POST   /api/enterprise-chat/:roomId/upload         — отправить медиа от админа
 *  - POST   /api/enterprise-chat/:roomId/tone-explain   — AI-пояснение в тоне (приватно)
 *  - POST   /api/enterprise-chat/:roomId/analyze        — расширенный insights анализ (Этап 7)
 *  - GET    /api/enterprise-chat/:roomId/tags           — присвоенные теги
 *
 * Outbound (для Quest Flow):
 *  - GET    /api/quest-flow/outbox                      — polling pending сообщений
 *  - POST   /api/quest-flow/outbox/:messageId/ack       — пометить как доставленное
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool, { removeMessageFromFallback } from '../../db/index.js';
import { insertMessage, listMessages } from '../rooms/messages.js';
import { explainInTone } from './tone_response.js';
import { listAssignedTagsForRoom } from '../need_tags/service.js';
import { pushRoomToChatwoot } from '../tenant_settings/chatwoot.js';
import {
  requireEnterprise,
  EnterpriseFeatureRequiredError,
  type UserRole,
} from '../billing/feature_gate.js';
import type { ToneKey } from '../tenant_prompt/presets.js';

const router = Router();
import { JWT_SECRET } from '../../config/secrets.js';

// ── Media storage ──────────────────────────────────────────────────
const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const uploadsDir = path.resolve(__dirname_local, '../../../../uploads/enterprise-chat');
fs.mkdirSync(uploadsDir, { recursive: true });

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniq = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, uniq + path.extname(file.originalname));
  },
});
// M3: блокируем потенциально исполняемые/скриптовые расширения. Файлы отдаются
// статикой с того же origin (/uploads) → .html/.svg/.js дали бы stored-XSS. Имя на
// диске берёт расширение из originalname, поэтому фильтруем именно расширение
// (mime подделывается клиентом).
const BLOCKED_UPLOAD_EXT = new Set(['.html', '.htm', '.xhtml', '.shtml', '.svg', '.js', '.mjs', '.xml', '.php', '.phtml']);
const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_UPLOAD_EXT.has(ext)) {
      cb(new Error('Тип файла запрещён по соображениям безопасности.'));
    } else {
      cb(null, true);
    }
  },
});

// ── Auth ───────────────────────────────────────────────────────────
interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: UserRole;
  userEmail?: string;
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
    req.userEmail = decoded.email;
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

/**
 * Проверяет что комната принадлежит этому tenant'у. Возвращает room row или null.
 */
async function ensureRoomAccess(tenantId: string, roomId: string, res: Response): Promise<any | null> {
  try {
    const r = await pool.query(
      `SELECT id, name, creator_tenant_id, kind, telegram_bot_id, telegram_user_id,
              telegram_username, telegram_display_name
       FROM rooms WHERE id = $1 LIMIT 1`,
      [roomId]
    );
    const row = (r.rows as any[])[0];
    if (!row) {
      res.status(404).json({ error: 'Комната не найдена' });
      return null;
    }
    if (row.creator_tenant_id !== tenantId) {
      res.status(403).json({ error: 'Нет доступа к этой комнате' });
      return null;
    }
    return row;
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка проверки доступа' });
    return null;
  }
}

router.use(requireAuth);

// ============================================================================
// Messages
// ============================================================================

router.get('/:roomId/messages', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'enterprise-chat'))) return;
  const room = await ensureRoomAccess(req.tenantId!, req.params.roomId, res);
  if (!room) return;
  try {
    const messages = await listMessages(req.params.roomId, 500);
    res.json({
      room: {
        id: room.id,
        name: room.name,
        kind: room.kind,
        telegramUsername: room.telegram_username,
        telegramDisplayName: room.telegram_display_name,
      },
      messages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

router.post('/:roomId/send', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'enterprise-chat'))) return;
  const room = await ensureRoomAccess(req.tenantId!, req.params.roomId, res);
  if (!room) return;
  try {
    const { text } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text обязателен' });
    }
    // Для video-комнат outbox-механизм не используется — это просто заметка
    const isTelegramChat = room.kind === 'telegram_chat';
    const msg = await insertMessage({
      roomId: room.id,
      sender: 'admin',
      source: 'chat',
      kind: 'text',
      content: text.trim().slice(0, 4000),
      metadata: isTelegramChat ? { outbox_status: 'pending', author_email: req.userEmail } : { author_email: req.userEmail },
    });
    res.status(201).json(msg);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка отправки' });
  }
});

router.post('/:roomId/upload', uploadMedia.single('file'), async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'enterprise-chat'))) return;
  const room = await ensureRoomAccess(req.tenantId!, req.params.roomId, res);
  if (!room) return;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'Файл не передан' });
  try {
    const isTelegramChat = room.kind === 'telegram_chat';
    // URL вида /uploads/enterprise-chat/<filename>
    const mediaUrl = `/uploads/enterprise-chat/${path.basename(file.path)}`;
    const mime = file.mimetype || 'application/octet-stream';
    const kind: 'image' | 'video' | 'audio' | 'file' =
      mime.startsWith('image/') ? 'image' :
      mime.startsWith('video/') ? 'video' :
      mime.startsWith('audio/') ? 'audio' : 'file';
    const caption = (req.body?.caption || '').toString().slice(0, 1000) || null;

    const msg = await insertMessage({
      roomId: room.id,
      sender: 'admin',
      source: 'media',
      kind,
      content: caption,
      mediaUrl,
      mediaMime: mime,
      mediaSize: file.size,
      metadata: isTelegramChat
        ? { outbox_status: 'pending', author_email: req.userEmail, original_name: file.originalname }
        : { author_email: req.userEmail, original_name: file.originalname },
    });
    res.status(201).json(msg);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка загрузки' });
  }
});

router.post('/:roomId/tone-explain', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'enterprise-chat'))) return;
  const room = await ensureRoomAccess(req.tenantId!, req.params.roomId, res);
  if (!room) return;
  try {
    const { messageText, tone, language, context } = req.body || {};
    if (typeof messageText !== 'string' || !messageText.trim()) {
      return res.status(400).json({ error: 'messageText обязателен' });
    }
    if (!tone) return res.status(400).json({ error: 'tone обязателен' });

    const result = await explainInTone({
      tenantId: req.tenantId!,
      messageText: messageText.trim(),
      tone: tone as ToneKey,
      language: language || 'ru',
      context: typeof context === 'string' ? context : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка генерации' });
  }
});

router.get('/:roomId/tags', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'enterprise-chat'))) return;
  const room = await ensureRoomAccess(req.tenantId!, req.params.roomId, res);
  if (!room) return;
  try {
    const tags = await listAssignedTagsForRoom(req.params.roomId);
    res.json({ tags });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения тегов' });
  }
});

/**
 * POST /api/enterprise-chat/:roomId/push-to-crm
 * Отправляет историю диалога + теги клиента в Chatwoot (per-tenant настройки).
 */
router.post('/:roomId/push-to-crm', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'enterprise-chat'))) return;
  const room = await ensureRoomAccess(req.tenantId!, req.params.roomId, res);
  if (!room) return;
  try {
    const result = await pushRoomToChatwoot(req.tenantId!, req.params.roomId);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка отправки в CRM' });
  }
});

/**
 * DELETE /api/enterprise-chat/:roomId/messages/:messageId
 * Удаляет сообщение из чата. Доступно creator'у Enterprise-комнаты.
 * Может удалить любое сообщение (своё / клиента / AI / transcript).
 *
 * Если у сообщения была привязка media_url из /uploads/enterprise-chat/* —
 * физический файл также удаляется с диска (best-effort).
 */
router.delete('/:roomId/messages/:messageId', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'enterprise-chat'))) return;
  const room = await ensureRoomAccess(req.tenantId!, req.params.roomId, res);
  if (!room) return;
  try {
    // Сначала достанем сообщение, чтобы (a) проверить принадлежность к этой комнате,
    // (b) узнать media_url для физического удаления файла.
    let row: any = null;
    try {
      const r = await pool.query(
        'SELECT room_id, media_url FROM room_messages WHERE id = $1 LIMIT 1',
        [req.params.messageId]
      );
      row = (r.rows as any[])[0];
    } catch (err) {
      console.warn('[enterprise_chat] SELECT preflight failed:', (err as Error).message);
    }

    // Если SELECT не нашёл — проверим напрямую в fallback. Если и там нет — 404.
    if (!row) {
      // Полагаемся на removeMessageFromFallback ниже; в DELETE-handler уже идёт row check
    } else {
      if (row.room_id !== req.params.roomId) {
        return res.status(403).json({ error: 'Сообщение принадлежит другой комнате' });
      }
    }

    // Удаляем запись из PG (best-effort)
    try {
      await pool.query('DELETE FROM room_messages WHERE id = $1', [req.params.messageId]);
    } catch (err) {
      console.warn('[enterprise_chat] DELETE in PG failed:', (err as Error).message);
    }

    // ENTERPRISE v0.10.3: ВСЕГДА синхронизируем fallback JSON.
    // Иначе после рестарта (если PG недоступен) удалённое сообщение «воскреснет».
    const removedFromFallback = removeMessageFromFallback(req.params.messageId);

    // Best-effort: чистим физический файл, если он лежал в uploads/enterprise-chat
    if (row && row.media_url && typeof row.media_url === 'string' && row.media_url.startsWith('/uploads/enterprise-chat/')) {
      try {
        const filename = path.basename(row.media_url);
        const filepath = path.join(uploadsDir, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch (err) {
        console.warn('[enterprise_chat] media delete failed (non-fatal):', (err as Error).message);
      }
    }

    // Если ни PG, ни fallback не вернули row — 404. Иначе ok.
    if (!row && !removedFromFallback) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }

    res.json({ ok: true, removedFromFallback });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

export default router;
