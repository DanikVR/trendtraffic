/**
 * Outbox для исходящих admin/AI-сообщений → Telegram через Quest Flow.
 *
 * Поскольку VibeVox не общается с Telegram-ботом напрямую (это делает Quest Flow),
 * для доставки сообщений ОТ владельца (а не AI) клиенту в Telegram используется
 * polling-механизм:
 *
 *  1. Владелец в чате VibeVox пишет сообщение → оно сохраняется в room_messages
 *     с sender='admin' и metadata.outbox_status='pending'
 *  2. На стороне Quest Flow настраивается trigger «каждые N секунд»:
 *     GET /api/quest-flow/outbox → список pending сообщений для этого tenant'а
 *  3. Для каждого QF отправляет сообщение в Telegram (используя свой Telegram-блок)
 *  4. QF делает POST /api/quest-flow/outbox/:msgId/ack чтобы пометить как доставленное
 *
 * Это работает без необходимости поднимать webhook-сервер у клиента.
 */

import pool from '../../db/index.js';

/**
 * Публичный базовый URL, по которому облачный Quest Flow сможет СКАЧАТЬ медиа,
 * отправленное владельцем. Файлы лежат на backend'е (`/uploads/...`), и
 * относительный путь облаку недоступен — нужен абсолютный https-URL.
 *
 * Задайте PUBLIC_BASE_URL (или APP_BASE_URL) в .env:
 *   - сейчас (ngrok):  PUBLIC_BASE_URL=https://impeditive-jeneva-overambitiously.ngrok-free.dev
 *   - на VPS (прод):   PUBLIC_BASE_URL=https://ваш-домен
 * Если не задан — отдаём относительный URL (для облачного QF медиа не скачается).
 */
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL ||
  process.env.APP_BASE_URL ||
  ''
).replace(/\/+$/, '');

/** Делает относительный `/uploads/...` URL абсолютным (если задан PUBLIC_BASE_URL). */
function toAbsoluteMediaUrl(mediaUrl: string | null): string | null {
  if (!mediaUrl) return null;
  if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl; // уже абсолютный
  if (!PUBLIC_BASE_URL) return mediaUrl;               // back-compat: отдаём как есть
  return `${PUBLIC_BASE_URL}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
}

export interface OutboxMessage {
  id: string;
  roomId: string;
  telegramBotId: string;
  telegramUserId: string;
  kind: 'text' | 'audio' | 'image' | 'video' | 'file';
  content: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  createdAt: Date;
}

/**
 * Возвращает все pending исходящие сообщения для tenant'а (admin → клиент).
 * Quest Flow вызывает этот endpoint в polling-режиме.
 */
export async function getPendingOutbox(tenantId: string, limit = 50): Promise<OutboxMessage[]> {
  // Сообщения от admin'а в telegram_chat-комнатах этого tenant'а,
  // у которых metadata.outbox_status = 'pending' (или поле отсутствует — pending по умолчанию).
  const res = await pool.query(
    `SELECT m.id, m.room_id, m.kind, m.content, m.media_url, m.media_mime, m.metadata, m.created_at,
            r.telegram_bot_id, r.telegram_user_id
     FROM room_messages m
     JOIN rooms r ON r.id = m.room_id
     WHERE r.creator_tenant_id = $1
       AND r.kind = 'telegram_chat'
       AND m.sender = 'admin'
       AND (
         m.metadata IS NULL
         OR (m.metadata->>'outbox_status') IS NULL
         OR (m.metadata->>'outbox_status') = 'pending'
       )
     ORDER BY m.created_at ASC
     LIMIT ${Math.max(1, Math.min(200, limit))}`,
    [tenantId]
  );

  return (res.rows as any[]).map((row) => ({
    id: row.id,
    roomId: row.room_id,
    telegramBotId: row.telegram_bot_id || '',
    telegramUserId: row.telegram_user_id || '',
    kind: row.kind || 'text',
    content: row.content || null,
    mediaUrl: toAbsoluteMediaUrl(row.media_url || null),
    mediaMime: row.media_mime || null,
    createdAt: new Date(row.created_at),
  }));
}

/**
 * Помечает сообщение как доставленное. Quest Flow вызывает после успешной отправки в Telegram.
 */
export async function ackOutboxMessage(tenantId: string, messageId: string): Promise<boolean> {
  // Проверка принадлежности: ищем сообщение через JOIN с rooms.creator_tenant_id
  const check = await pool.query(
    `SELECT m.id, m.metadata
     FROM room_messages m JOIN rooms r ON r.id = m.room_id
     WHERE m.id = $1 AND r.creator_tenant_id = $2`,
    [messageId, tenantId]
  );
  const row = (check.rows as any[])[0];
  if (!row) return false;

  const currentMeta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
  currentMeta.outbox_status = 'sent';
  currentMeta.sent_at = new Date().toISOString();

  await pool.query(
    `UPDATE room_messages SET metadata = $1 WHERE id = $2`,
    [JSON.stringify(currentMeta), messageId]
  );
  return true;
}
