/**
 * CRUD для room_messages (чат внутри комнаты).
 *
 * Используется:
 *  - quest_flow/inbound — запись сообщений клиента (text/audio) и AI-ответов
 *  - enterprise_chat — чтение истории + запись сообщений админа
 *  - bridge.ts (Этап 6) — копирование транскриптов video-комнаты в чат
 *
 * Отдельный модуль (не в rooms/service.ts) чтобы не утяжелять и дать чёткие границы.
 */

import pool, { addMessageToFallback } from '../../db/index.js';

export type MessageSender = 'client' | 'admin' | 'ai' | 'system';
export type MessageSource = 'chat' | 'transcript' | 'media' | 'system';
export type MessageKind = 'text' | 'audio' | 'image' | 'video' | 'file';

export interface RoomMessage {
  id: string;
  roomId: string;
  sender: MessageSender;
  source: MessageSource;
  kind: MessageKind;
  content: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaSize: number | null;
  languageDetected: string | null;
  dialectDetected: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface NewMessageInput {
  roomId: string;
  sender: MessageSender;
  source?: MessageSource;
  kind?: MessageKind;
  content?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaSize?: number | null;
  languageDetected?: string | null;
  dialectDetected?: string | null;
  metadata?: Record<string, any> | null;
}

function mapRow(row: any): RoomMessage {
  return {
    id: row.id,
    roomId: row.room_id,
    sender: row.sender,
    source: row.source || 'chat',
    kind: row.kind || 'text',
    content: row.content || null,
    mediaUrl: row.media_url || null,
    mediaMime: row.media_mime || null,
    mediaSize: row.media_size != null ? Number(row.media_size) : null,
    languageDetected: row.language_detected || null,
    dialectDetected: row.dialect_detected || null,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || null),
    createdAt: new Date(row.created_at),
  };
}

export async function insertMessage(input: NewMessageInput): Promise<RoomMessage> {
  const res = await pool.query(
    `INSERT INTO room_messages
      (room_id, sender, source, kind, content, media_url, media_mime, media_size,
       language_detected, dialect_detected, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      input.roomId,
      input.sender,
      input.source || 'chat',
      input.kind || 'text',
      input.content || null,
      input.mediaUrl || null,
      input.mediaMime || null,
      input.mediaSize != null ? Number(input.mediaSize) : null,
      input.languageDetected || null,
      input.dialectDetected || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  const row = (res.rows as any[])[0];
  const mapped = mapRow(row);

  // ENTERPRISE v0.10.3: ВСЕГДА синхронизируем fallback JSON, даже если запрос ушёл в PG.
  // Иначе после рестарта (если PG недоступен) сообщения «исчезают».
  try {
    addMessageToFallback({
      id: row.id,
      room_id: row.room_id,
      sender: row.sender,
      source: row.source,
      kind: row.kind,
      content: row.content,
      media_url: row.media_url,
      media_mime: row.media_mime,
      media_size: row.media_size,
      language_detected: row.language_detected,
      dialect_detected: row.dialect_detected,
      metadata: row.metadata,
      created_at: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
    });
  } catch (err) {
    console.warn('[rooms/messages] fallback sync failed (non-fatal):', (err as Error).message);
  }

  return mapped;
}

export async function listMessages(roomId: string, limit = 500): Promise<RoomMessage[]> {
  const res = await pool.query(
    `SELECT * FROM room_messages WHERE room_id = $1 ORDER BY created_at ASC LIMIT ${Math.max(1, Math.min(1000, limit))}`,
    [roomId]
  );
  return (res.rows as any[]).map(mapRow);
}

/**
 * Возвращает короткую сводку последних N сообщений для подачи в Gemini
 * как контекст диалога. Формат: "<sender>: <content>" на строке.
 *
 * Игнорирует сообщения source='transcript' если в скобках уже видели то же содержимое
 * (там часто дублируется).
 */
export async function getConversationContext(roomId: string, lastN = 30): Promise<string> {
  const msgs = await listMessages(roomId, lastN * 2);
  const recent = msgs.slice(-lastN);
  const lines: string[] = [];
  for (const m of recent) {
    if (!m.content) continue;
    const role = m.sender === 'ai' ? 'AI' : m.sender === 'admin' ? 'ADMIN' : m.sender === 'client' ? 'CLIENT' : 'SYSTEM';
    lines.push(`${role}: ${m.content}`);
  }
  return lines.join('\n');
}
