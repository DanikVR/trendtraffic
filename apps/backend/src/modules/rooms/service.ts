import pool, { removeRoomFromFallback, renameRoomInFallback } from '../../db/index.js';
import { randomUUID } from 'crypto';

export interface RoomSettings {
  translationEnabled: boolean;
  subtitlesEnabled: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  translationEnabled: true,
  subtitlesEnabled: true,
};

export interface RoomData {
  id: string;
  name: string;
  creator_tenant_id: string | null;
  settings?: RoomSettings;
  created_at: Date;
  expires_at: Date;
  // ENTERPRISE v0.10.0
  kind?: 'video' | 'telegram_chat' | 'channel_chat';
  telegram_bot_id?: string | null;
  telegram_user_id?: string | null;
  telegram_username?: string | null;
  telegram_display_name?: string | null;
  // OMNICHANNEL Фаза 0 — канало-агностичные координаты (любой канал)
  channel_type?: string | null;
  channel_account_id?: string | null;
  channel_conversation_id?: string | null;
  channel_username?: string | null;
  channel_display_name?: string | null;
  chatwoot_conversation_id?: string | null;
}

// In-memory хранилище для демо-режима (при отключенной БД)
export const inMemoryRooms = new Map<string, RoomData>();

/**
 * Создает новую комнату на 24 часа.
 */
/** v0.9.0: TTL комнат — 5 лет вместо 24h. Реально удалить может только creator через DELETE. */
const ROOM_TTL_MS = 5 * 365 * 24 * 60 * 60 * 1000;

export async function createRoom(name: string, tenantId: string | null = null): Promise<RoomData> {
  const roomId = randomUUID();
  const expiresAt = new Date(Date.now() + ROOM_TTL_MS); // 5 лет

  const room: RoomData = {
    id: roomId,
    name,
    creator_tenant_id: tenantId,
    created_at: new Date(),
    expires_at: expiresAt,
  };

  try {
    const query = `
      INSERT INTO rooms (id, name, creator_tenant_id, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, creator_tenant_id, created_at, expires_at
    `;
    const res = await pool.query(query, [roomId, name, tenantId, expiresAt]);
    
    if (res.rows[0]) {
      const dbRoom = res.rows[0];
      const parsedCreatedAt = dbRoom.created_at ? new Date(dbRoom.created_at) : new Date();
      const parsedExpiresAt = dbRoom.expires_at ? new Date(dbRoom.expires_at) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      return {
        id: dbRoom.id,
        name: dbRoom.name,
        creator_tenant_id: dbRoom.creator_tenant_id,
        created_at: isNaN(parsedCreatedAt.getTime()) ? new Date() : parsedCreatedAt,
        expires_at: isNaN(parsedExpiresAt.getTime()) ? new Date(Date.now() + 24 * 60 * 60 * 1000) : parsedExpiresAt,
      };
    }
  } catch (err) {
    console.warn('[RoomsService] БД недоступна, сохраняем в in-memory:', (err as Error).message);
  }

  // Fallback на in-memory
  inMemoryRooms.set(roomId, room);
  return room;
}

/**
 * Проверяет существование и срок годности комнаты.
 */
export interface ValidationResult {
  valid: boolean;
  name?: string;
  creatorTenantId?: string | null;
  settings?: RoomSettings;
  error?: string;
}

function parseSettings(raw: any): RoomSettings {
  if (!raw) return { ...DEFAULT_ROOM_SETTINGS };
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return { ...DEFAULT_ROOM_SETTINGS }; }
  }
  return {
    translationEnabled: raw.translationEnabled !== false,
    subtitlesEnabled: raw.subtitlesEnabled !== false,
  };
}

export async function validateRoom(roomId: string): Promise<ValidationResult> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(roomId)) {
    return { valid: false, error: 'Неверный формат идентификатора комнаты' };
  }

  try {
    const res = await pool.query(
      'SELECT id, name, creator_tenant_id, settings, expires_at FROM rooms WHERE id = $1',
      [roomId]
    );
    if (res.rows[0]) {
      const room = res.rows[0];
      const expiresAt = new Date(room.expires_at);
      if (expiresAt.getTime() > Date.now()) {
        return {
          valid: true,
          name: room.name,
          creatorTenantId: room.creator_tenant_id || null,
          settings: parseSettings(room.settings),
        };
      } else {
        return { valid: false, error: 'Срок действия ссылки на комнату истек (24 часа)' };
      }
    }
  } catch (err) {
    console.warn('[RoomsService] БД недоступна при валидации, ищем в in-memory:', (err as Error).message);
  }

  const localRoom = inMemoryRooms.get(roomId);
  if (localRoom) {
    if (localRoom.expires_at.getTime() > Date.now()) {
      return {
        valid: true,
        name: localRoom.name,
        creatorTenantId: localRoom.creator_tenant_id,
        settings: localRoom.settings || { ...DEFAULT_ROOM_SETTINGS },
      };
    } else {
      return { valid: false, error: 'Срок действия ссылки на комнату истек (24 часа)' };
    }
  }

  return { valid: false, error: 'Комната не найдена' };
}

/** Обновить settings конкретной комнаты. Возвращает обновлённую запись или null. */
export async function updateRoomSettings(roomId: string, partial: Partial<RoomSettings>): Promise<RoomSettings | null> {
  try {
    const current = await pool.query('SELECT settings FROM rooms WHERE id = $1', [roomId]);
    const merged: RoomSettings = { ...DEFAULT_ROOM_SETTINGS, ...parseSettings(current.rows[0]?.settings), ...partial };
    await pool.query('UPDATE rooms SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(merged), roomId]);
    return merged;
  } catch (err) {
    const local = inMemoryRooms.get(roomId);
    if (local) {
      local.settings = { ...DEFAULT_ROOM_SETTINGS, ...(local.settings || {}), ...partial };
      return local.settings;
    }
    return null;
  }
}

/** Список комнат, созданных tenant'ом. Hard-deleted не возвращаются. */
export async function listRoomsByCreator(tenantId: string): Promise<RoomData[]> {
  try {
    const r = await pool.query(
      `SELECT id, name, creator_tenant_id, settings, kind,
              telegram_bot_id, telegram_user_id, telegram_username, telegram_display_name,
              created_at, expires_at
       FROM rooms WHERE creator_tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return (r.rows as any[]).map((row) => ({
      id: row.id,
      name: row.name,
      creator_tenant_id: row.creator_tenant_id || null,
      settings: parseSettings(row.settings),
      kind: (row.kind as 'video' | 'telegram_chat') || 'video',
      telegram_bot_id: row.telegram_bot_id || null,
      telegram_user_id: row.telegram_user_id || null,
      telegram_username: row.telegram_username || null,
      telegram_display_name: row.telegram_display_name || null,
      created_at: new Date(row.created_at),
      expires_at: new Date(row.expires_at),
    }));
  } catch {
    return Array.from(inMemoryRooms.values()).filter((r) => r.creator_tenant_id === tenantId);
  }
}

/** Переименовать комнату. Только creator может. */
export async function renameRoom(roomId: string, name: string): Promise<boolean> {
  const trimmed = name.trim().slice(0, 200);
  if (!trimmed) return false;
  try {
    await pool.query('UPDATE rooms SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [trimmed, roomId]);
  } catch { /* */ }
  const local = inMemoryRooms.get(roomId);
  if (local) local.name = trimmed;
  // v0.9.2: ВСЕГДА синхронизируем JSON, даже если pool.query ушёл в реальный PG.
  renameRoomInFallback(roomId, trimmed);
  return true;
}

/** Hard delete комнаты вместе со всеми связанными данными (transcripts/insights). */
export async function deleteRoom(roomId: string): Promise<boolean> {
  try {
    await pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
  } catch { /* fallback */ }
  inMemoryRooms.delete(roomId);
  // v0.9.2: ВСЕГДА синхронизируем JSON. Иначе после рестарта удалённая комната «воскреснет»,
  // потому что fallback читает db_fallback.json, который не обновлялся, пока был жив PG.
  removeRoomFromFallback(roomId);
  return true;
}

/** Получить полную запись комнаты включая creator. */
export async function getRoomById(roomId: string): Promise<RoomData | null> {
  try {
    const r = await pool.query('SELECT id, name, creator_tenant_id, settings, created_at, expires_at FROM rooms WHERE id = $1', [roomId]);
    if (r.rows[0]) {
      const row = r.rows[0];
      return {
        id: row.id,
        name: row.name,
        creator_tenant_id: row.creator_tenant_id || null,
        settings: parseSettings(row.settings),
        created_at: new Date(row.created_at),
        expires_at: new Date(row.expires_at),
      };
    }
  } catch { /* fallback */ }
  return inMemoryRooms.get(roomId) || null;
}

// ============================================================================
// ENTERPRISE v0.10.0 — telegram_chat комнаты для Quest Flow
// ============================================================================

export interface TelegramChatRoomData extends RoomData {
  kind: 'telegram_chat';
  telegram_bot_id: string;
  telegram_user_id: string;
  telegram_username: string | null;
  telegram_display_name: string | null;
}

interface TelegramClientIdentity {
  telegramBotId: string;
  telegramUserId: string;
  telegramUsername?: string | null;
  telegramDisplayName?: string | null;
}

function formatTelegramRoomName(id: TelegramClientIdentity): string {
  if (id.telegramUsername) return `@${id.telegramUsername} (TG)`;
  if (id.telegramDisplayName) return `${id.telegramDisplayName} (TG)`;
  return `Клиент TG #${id.telegramUserId.slice(0, 8)}`;
}

/**
 * Find-or-create telegram_chat комнаты для пары (tenant_id, telegram_bot_id, telegram_user_id).
 *
 * Семантика: один клиент = одна комната НАВСЕГДА. Если комната уже есть — обновляем
 * метаданные (username/display_name могли поменяться) и возвращаем её.
 * Если её удалили в прошлом — создаётся новая.
 */
export async function findOrCreateTelegramChatRoom(
  tenantId: string,
  identity: TelegramClientIdentity
): Promise<TelegramChatRoomData> {
  // 1. Try find
  try {
    const found = await pool.query(
      `SELECT id, name, creator_tenant_id, settings, kind,
              telegram_bot_id, telegram_user_id, telegram_username, telegram_display_name,
              created_at, expires_at
       FROM rooms
       WHERE creator_tenant_id = $1
         AND telegram_bot_id = $2
         AND telegram_user_id = $3
         AND kind = 'telegram_chat'
       LIMIT 1`,
      [tenantId, identity.telegramBotId, identity.telegramUserId]
    );
    const row = (found.rows as any[])[0];
    if (row) {
      // Best-effort: обновим метаданные если они изменились
      const newUsername = identity.telegramUsername || row.telegram_username || null;
      const newDisplayName = identity.telegramDisplayName || row.telegram_display_name || null;
      if (newUsername !== row.telegram_username || newDisplayName !== row.telegram_display_name) {
        try {
          await pool.query(
            `UPDATE rooms SET telegram_username = $1, telegram_display_name = $2,
                              updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [newUsername, newDisplayName, row.id]
          );
        } catch {}
        row.telegram_username = newUsername;
        row.telegram_display_name = newDisplayName;
      }
      return {
        id: row.id,
        name: row.name,
        creator_tenant_id: row.creator_tenant_id,
        kind: 'telegram_chat',
        telegram_bot_id: row.telegram_bot_id,
        telegram_user_id: row.telegram_user_id,
        telegram_username: row.telegram_username || null,
        telegram_display_name: row.telegram_display_name || null,
        settings: parseSettings(row.settings),
        created_at: new Date(row.created_at),
        expires_at: new Date(row.expires_at),
      };
    }
  } catch (err) {
    console.warn('[rooms/telegram_chat] find failed, falling back to create:', (err as Error).message);
  }

  // 2. Create new
  const roomId = randomUUID();
  const name = formatTelegramRoomName(identity);
  const expiresAt = new Date(Date.now() + ROOM_TTL_MS);

  try {
    await pool.query(
      `INSERT INTO rooms (
         id, name, creator_tenant_id, expires_at,
         kind, telegram_user_id, telegram_bot_id, telegram_username, telegram_display_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        roomId,
        name,
        tenantId,
        expiresAt,
        'telegram_chat',
        identity.telegramUserId,
        identity.telegramBotId,
        identity.telegramUsername || null,
        identity.telegramDisplayName || null,
      ]
    );
  } catch (err) {
    console.warn('[rooms/telegram_chat] create failed:', (err as Error).message);
  }

  return {
    id: roomId,
    name,
    creator_tenant_id: tenantId,
    kind: 'telegram_chat',
    telegram_bot_id: identity.telegramBotId,
    telegram_user_id: identity.telegramUserId,
    telegram_username: identity.telegramUsername || null,
    telegram_display_name: identity.telegramDisplayName || null,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    created_at: new Date(),
    expires_at: expiresAt,
  };
}

// ============================================================================
// OMNICHANNEL Фаза 0 — обобщённый channel-room (любой канал, не только Telegram).
// Telegram делегируется в findOrCreateTelegramChatRoom БЕЗ изменений; прочие
// каналы идут generic-путём (kind='channel_chat', channel_* координаты).
// ============================================================================

export type ChannelType = 'telegram' | 'whatsapp' | 'instagram' | 'facebook' | 'messenger' | 'web' | 'email' | 'tiktok';

export interface ChannelClientIdentity {
  accountId: string;        // ID аккаунта-приёмника на стороне канала (бот/номер/страница)
  conversationId: string;   // ID собеседника/диалога на стороне канала
  username?: string | null;
  displayName?: string | null;
  chatwootConversationId?: string | null;
}

export interface ChannelRoomData extends RoomData {
  kind: 'telegram_chat' | 'channel_chat';
  channel_type: string;
  channel_account_id: string;
  channel_conversation_id: string;
  channel_username: string | null;
  channel_display_name: string | null;
  chatwoot_conversation_id: string | null;
}

function formatChannelRoomName(channelType: ChannelType, id: ChannelClientIdentity): string {
  const tag = channelType.toUpperCase().slice(0, 4);
  if (id.username) return `@${id.username} (${tag})`;
  if (id.displayName) return `${id.displayName} (${tag})`;
  return `Client ${tag} #${id.conversationId.slice(0, 8)}`;
}

function mapChannelRow(row: any, channelType: ChannelType): ChannelRoomData {
  return {
    id: row.id,
    name: row.name,
    creator_tenant_id: row.creator_tenant_id,
    kind: (row.kind as 'telegram_chat' | 'channel_chat') || 'channel_chat',
    channel_type: row.channel_type || channelType,
    channel_account_id: row.channel_account_id,
    channel_conversation_id: row.channel_conversation_id,
    channel_username: row.channel_username || null,
    channel_display_name: row.channel_display_name || null,
    chatwoot_conversation_id: row.chatwoot_conversation_id || null,
    settings: parseSettings(row.settings),
    created_at: new Date(row.created_at),
    expires_at: new Date(row.expires_at),
  };
}

/**
 * Find-or-create комнаты для диалога ЛЮБОГО канала.
 * channelType='telegram' → делегирует в findOrCreateTelegramChatRoom (без изменений).
 * Остальные каналы → generic (kind='channel_chat', channel_* координаты).
 */
export async function findOrCreateChannelRoom(
  tenantId: string,
  channelType: ChannelType,
  identity: ChannelClientIdentity
): Promise<ChannelRoomData> {
  // Telegram — частный случай: переиспользуем рабочую функцию без изменений.
  if (channelType === 'telegram') {
    const tg = await findOrCreateTelegramChatRoom(tenantId, {
      telegramBotId: identity.accountId,
      telegramUserId: identity.conversationId,
      telegramUsername: identity.username,
      telegramDisplayName: identity.displayName,
    });
    return {
      ...tg,
      channel_type: 'telegram',
      channel_account_id: tg.telegram_bot_id,
      channel_conversation_id: tg.telegram_user_id,
      channel_username: tg.telegram_username,
      channel_display_name: tg.telegram_display_name,
      chatwoot_conversation_id: tg.chatwoot_conversation_id ?? null,
    };
  }

  // 1. find
  try {
    const found = await pool.query(
      `SELECT id, name, creator_tenant_id, settings, kind,
              channel_type, channel_account_id, channel_conversation_id,
              channel_username, channel_display_name, chatwoot_conversation_id,
              created_at, expires_at
       FROM rooms
       WHERE creator_tenant_id = $1
         AND channel_type = $2
         AND channel_account_id = $3
         AND channel_conversation_id = $4
         AND kind = 'channel_chat'
       LIMIT 1`,
      [tenantId, channelType, identity.accountId, identity.conversationId]
    );
    const row = (found.rows as any[])[0];
    if (row) {
      const newUsername = identity.username || row.channel_username || null;
      const newDisplayName = identity.displayName || row.channel_display_name || null;
      if (newUsername !== row.channel_username || newDisplayName !== row.channel_display_name) {
        try {
          await pool.query(
            `UPDATE rooms SET channel_username = $1, channel_display_name = $2,
                              updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [newUsername, newDisplayName, row.id]
          );
        } catch {}
        row.channel_username = newUsername;
        row.channel_display_name = newDisplayName;
      }
      return mapChannelRow(row, channelType);
    }
  } catch (err) {
    console.warn('[rooms/channel] find failed, falling back to create:', (err as Error).message);
  }

  // 2. create
  const roomId = randomUUID();
  const name = formatChannelRoomName(channelType, identity);
  const expiresAt = new Date(Date.now() + ROOM_TTL_MS);
  try {
    await pool.query(
      `INSERT INTO rooms (
         id, name, creator_tenant_id, expires_at,
         kind, channel_type, channel_account_id, channel_conversation_id,
         channel_username, channel_display_name, chatwoot_conversation_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        roomId, name, tenantId, expiresAt,
        'channel_chat', channelType, identity.accountId, identity.conversationId,
        identity.username || null, identity.displayName || null,
        identity.chatwootConversationId || null,
      ]
    );
  } catch (err) {
    console.warn('[rooms/channel] create failed:', (err as Error).message);
  }

  return {
    id: roomId,
    name,
    creator_tenant_id: tenantId,
    kind: 'channel_chat',
    channel_type: channelType,
    channel_account_id: identity.accountId,
    channel_conversation_id: identity.conversationId,
    channel_username: identity.username || null,
    channel_display_name: identity.displayName || null,
    chatwoot_conversation_id: identity.chatwootConversationId || null,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    created_at: new Date(),
    expires_at: expiresAt,
  };
}
