/**
 * Управление per-tenant API-ключами Quest Flow.
 *
 * Каждый tenant может иметь несколько ключей (для разных QF-цепочек / проектов).
 * Сам сырой ключ показывается пользователю ОДИН раз при создании; в БД хранится
 * только SHA-256 хэш. На каждом входящем запросе от QF мы хэшируем переданный
 * Bearer-токен и ищем по хэшу.
 *
 * Префикс ключа (`vbvx_qf_<8 рандомных символов>`) показывается всегда —
 * нужен для UI чтобы пользователь мог идентифицировать ключ позже.
 */

import crypto from 'crypto';
import pool from '../../db/index.js';

export interface QuestFlowKey {
  id: string;
  tenantId: string;
  apiKeyPrefix: string; // "vbvx_qf_abc12..."
  label: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreatedQuestFlowKey extends QuestFlowKey {
  /** Сырой ключ — показывается только при создании, в БД хранится только хэш. */
  rawKey: string;
}

function mapRow(row: any): QuestFlowKey {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    apiKeyPrefix: row.api_key_prefix,
    label: row.label || null,
    createdAt: new Date(row.created_at),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  };
}

/** Хэш ключа. Используется и при создании, и при проверке. */
export function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/** Префикс для отображения в UI: первые 12 символов raw ключа. */
function makePrefix(rawKey: string): string {
  return rawKey.slice(0, 12) + '…';
}

/**
 * Создаёт новый API-ключ для tenant'а. Возвращает raw-ключ (показать пользователю
 * один раз) + метаданные. В БД хранится только хэш.
 */
export async function createKey(tenantId: string, label?: string): Promise<CreatedQuestFlowKey> {
  // 36 байт base64url ≈ 48 символов плюс префикс
  const rawBytes = crypto.randomBytes(36).toString('base64url');
  const rawKey = `vbvx_qf_${rawBytes}`;
  const hash = hashKey(rawKey);
  const prefix = makePrefix(rawKey);

  const res = await pool.query(
    `INSERT INTO tenant_quest_flow_keys (tenant_id, api_key_hash, api_key_prefix, label)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [tenantId, hash, prefix, label?.slice(0, 255) || null]
  );
  const row = (res.rows as any[])[0];
  return { ...mapRow(row), rawKey };
}

export async function listKeys(tenantId: string): Promise<QuestFlowKey[]> {
  const res = await pool.query(
    `SELECT * FROM tenant_quest_flow_keys
     WHERE tenant_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return (res.rows as any[]).map(mapRow);
}

/**
 * Проверяет переданный raw-ключ. Возвращает tenantId если ключ валидный
 * (существует + не отозван). Также обновляет last_used_at.
 */
export async function verifyKey(rawKey: string): Promise<{ tenantId: string; keyId: string } | null> {
  if (!rawKey || !rawKey.startsWith('vbvx_qf_')) return null;
  const hash = hashKey(rawKey);
  const res = await pool.query(
    `SELECT id, tenant_id FROM tenant_quest_flow_keys
     WHERE api_key_hash = $1 AND revoked_at IS NULL
     LIMIT 1`,
    [hash]
  );
  const row = (res.rows as any[])[0];
  if (!row) return null;

  // Идём в БД обновить last_used_at (best-effort)
  try {
    await pool.query(
      `UPDATE tenant_quest_flow_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [row.id]
    );
  } catch {}

  return { tenantId: row.tenant_id, keyId: row.id };
}

/**
 * Отзывает (revoke) ключ — он больше не сможет аутентифицировать запросы.
 * Не удаляет запись — для аудита last_used_at сохраняется.
 */
export async function revokeKey(tenantId: string, keyId: string): Promise<boolean> {
  // Сначала проверим что ключ принадлежит этому tenant'у
  const check = await pool.query(
    'SELECT tenant_id FROM tenant_quest_flow_keys WHERE id = $1',
    [keyId]
  );
  const owner = (check.rows as any[])[0];
  if (!owner || owner.tenant_id !== tenantId) return false;

  const res = await pool.query(
    `UPDATE tenant_quest_flow_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [keyId]
  );
  return (res.rowCount || 0) > 0;
}

/**
 * Полное удаление ключа из БД (hard delete). Используется редко — обычно достаточно revoke.
 */
export async function deleteKey(tenantId: string, keyId: string): Promise<boolean> {
  const check = await pool.query(
    'SELECT tenant_id FROM tenant_quest_flow_keys WHERE id = $1',
    [keyId]
  );
  const owner = (check.rows as any[])[0];
  if (!owner || owner.tenant_id !== tenantId) return false;

  const res = await pool.query(
    `DELETE FROM tenant_quest_flow_keys WHERE id = $1`,
    [keyId]
  );
  return (res.rowCount || 0) > 0;
}
