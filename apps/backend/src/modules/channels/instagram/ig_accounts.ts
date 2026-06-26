/**
 * Instagram IG-0.5 — хранилище подключённых аккаунтов (per-tenant, SaaS).
 *
 * Каждый магазин подключает свой IG через OAuth → токен (зашифрованный) лежит
 * в instagram_accounts, привязанный к ig_id (для резолва входящего вебхука) и
 * tenant_id. Прод — Postgres; локально (fallback) таблицы нет → graceful null
 * → ig_config откатывается на env (наш тестовый аккаунт).
 */

import pool from '../../../db/index.js';
import { encryptSecret, decryptSecret } from '../../tenant_settings/encryption.js';

export interface IgAccount {
  tenantId: string;
  igId: string;
  username: string | null;
  accessToken: string;
  tokenExpiresAt: string | null;
  enabled: boolean;
}

function mapRow(row: any): IgAccount | null {
  if (!row) return null;
  const token = decryptSecret(row.access_token_encrypted) || '';
  return {
    tenantId: row.tenant_id,
    igId: String(row.ig_id),
    username: row.username || null,
    accessToken: token,
    tokenExpiresAt: row.token_expires_at || null,
    enabled: row.enabled !== false,
  };
}

const COLS = 'tenant_id, ig_id, username, access_token_encrypted, token_expires_at, enabled';

/** Резолв по IG account id (из вебхука entry.id). */
export async function getIgAccountByIgId(igId: string): Promise<IgAccount | null> {
  try {
    const r = await pool.query(`SELECT ${COLS} FROM instagram_accounts WHERE ig_id = $1 LIMIT 1`, [String(igId)]);
    return mapRow((r.rows as any[])[0]);
  } catch {
    return null;
  }
}

/** Подключённый аккаунт арендатора (для статуса в UI). */
export async function getIgAccountByTenant(tenantId: string): Promise<IgAccount | null> {
  try {
    const r = await pool.query(
      `SELECT ${COLS} FROM instagram_accounts WHERE tenant_id = $1 AND enabled = TRUE ORDER BY updated_at DESC LIMIT 1`,
      [tenantId]
    );
    return mapRow((r.rows as any[])[0]);
  } catch {
    return null;
  }
}

/** Создаёт/обновляет подключение (по ig_id). Токен шифруется. */
export async function upsertIgAccount(input: {
  tenantId: string;
  igId: string;
  username?: string | null;
  accessToken: string;
  tokenExpiresAt?: Date | string | null;
}): Promise<boolean> {
  const enc = encryptSecret(input.accessToken);
  if (!enc) return false;
  try {
    await pool.query(
      `INSERT INTO instagram_accounts (tenant_id, ig_id, username, access_token_encrypted, token_expires_at, enabled, connected_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (ig_id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         username = EXCLUDED.username,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         token_expires_at = EXCLUDED.token_expires_at,
         enabled = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
      [input.tenantId, String(input.igId), input.username || null, enc, input.tokenExpiresAt || null]
    );
    return true;
  } catch (e) {
    console.error('[ig/accounts] upsert failed:', (e as Error).message);
    return false;
  }
}
