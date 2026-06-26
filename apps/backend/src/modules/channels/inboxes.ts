/**
 * OMNICHANNEL Фаза 1 — реестр каналов (channel_inboxes).
 *
 * Связывает «инбокс на стороне Chatwoot» с tenant'ом VibeVox и типом канала.
 * Вебхук Chatwoot приходит без нашего API-ключа, поэтому tenant определяется
 * по chatwoot_inbox_id из payload'а (аналог verifyKey для Quest Flow).
 *
 * В V1 (один наш Chatwoot, аккаунты на tenant через Platform API) для каждого
 * подключённого канала заводится строка channel_inboxes.
 */

import pool from '../../db/index.js';
import { randomUUID } from 'crypto';

export interface ChannelInbox {
  id: string;
  tenant_id: string;
  channel_type: string;            // 'web' | 'whatsapp' | 'instagram' | 'facebook' | 'email' | …
  external_id: string | null;      // ID на стороне канала (номер/страница/аккаунт)
  chatwoot_inbox_id: string | null;
  config: Record<string, any>;
  enabled: boolean;
}

function mapRow(row: any): ChannelInbox {
  let cfg: any = row.config;
  if (typeof cfg === 'string') {
    try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
  }
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    channel_type: row.channel_type,
    external_id: row.external_id != null ? String(row.external_id) : null,
    chatwoot_inbox_id: row.chatwoot_inbox_id != null ? String(row.chatwoot_inbox_id) : null,
    config: cfg || {},
    enabled: row.enabled !== false,
  };
}

/** Резолвит привязку канала по Chatwoot inbox_id (из вебхука). null — если не привязан. */
export async function resolveInboxByChatwootId(chatwootInboxId: string | number): Promise<ChannelInbox | null> {
  try {
    const r = await pool.query(
      `SELECT id, tenant_id, channel_type, external_id, chatwoot_inbox_id, config, enabled
       FROM channel_inboxes WHERE chatwoot_inbox_id = $1 AND enabled = TRUE LIMIT 1`,
      [String(chatwootInboxId)]
    );
    const row = (r.rows as any[])[0];
    return row ? mapRow(row) : null;
  } catch (err) {
    console.warn('[channels] resolveInboxByChatwootId failed:', (err as Error).message);
    return null;
  }
}

/** Регистрирует (или возвращает существующую) привязку канала к инбоксу Chatwoot. */
export async function registerChannelInbox(input: {
  tenantId: string;
  channelType: string;
  externalId?: string | null;
  chatwootInboxId?: string | null;
  config?: Record<string, any>;
}): Promise<ChannelInbox | null> {
  // Идемпотентность: если такой chatwoot_inbox_id уже привязан — вернём его.
  if (input.chatwootInboxId) {
    const existing = await resolveInboxByChatwootId(input.chatwootInboxId);
    if (existing) return existing;
  }
  const id = randomUUID();
  try {
    const r = await pool.query(
      `INSERT INTO channel_inboxes (id, tenant_id, channel_type, external_id, chatwoot_inbox_id, config, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, tenant_id, channel_type, external_id, chatwoot_inbox_id, config, enabled`,
      [
        id,
        input.tenantId,
        input.channelType,
        input.externalId || null,
        input.chatwootInboxId || null,
        JSON.stringify(input.config || {}),
      ]
    );
    const row = (r.rows as any[])[0];
    return row ? mapRow(row) : null;
  } catch (err) {
    console.warn('[channels] registerChannelInbox failed:', (err as Error).message);
    return null;
  }
}

/** Список каналов арендатора (для будущей вкладки настроек). */
export async function listChannelInboxes(tenantId: string): Promise<ChannelInbox[]> {
  try {
    const r = await pool.query(
      `SELECT id, tenant_id, channel_type, external_id, chatwoot_inbox_id, config, enabled
       FROM channel_inboxes WHERE tenant_id = $1`,
      [tenantId]
    );
    return (r.rows as any[]).map(mapRow);
  } catch {
    return [];
  }
}

/**
 * Резолв привязки с DEV-фолбэком. Если строки channel_inboxes нет, но задан
 * CHATWOOT_DEFAULT_TENANT_ID (одно-tenant локальная/демо-среда) — синтезируем
 * привязку на лету, БЕЗ записи в БД. В проде переменную не задают → строгий резолв.
 */
export async function resolveInboxOrEnvDefault(chatwootInboxId: string | number): Promise<ChannelInbox | null> {
  const found = await resolveInboxByChatwootId(chatwootInboxId);
  if (found) return found;
  const defTenant = process.env.CHATWOOT_DEFAULT_TENANT_ID;
  if (defTenant) {
    return {
      id: 'env-default',
      tenant_id: defTenant,
      channel_type: process.env.CHATWOOT_DEFAULT_CHANNEL || 'web',
      external_id: null,
      chatwoot_inbox_id: String(chatwootInboxId),
      config: {},
      enabled: true,
    };
  }
  return null;
}
