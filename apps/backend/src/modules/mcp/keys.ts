/**
 * Per-tenant MCP API-ключи. По образцу Quest Flow-ключей (SHA-256 хэш в БД, сырой
 * ключ показывается ОДИН раз), плюс набор скоупов на каждом ключе.
 *
 * Префикс ключа: `vbvx_mcp_<рандом>`. На каждом MCP-запросе хэшируем Bearer-токен и
 * ищем по хэшу → получаем tenantId + scopes.
 */

import crypto from 'crypto';
import pool from '../../db/index.js';
import { sanitizeScopes, DEFAULT_SCOPES, type McpScope } from './scopes.js';

export interface McpKey {
  id: string;
  tenantId: string;
  apiKeyPrefix: string;
  label: string | null;
  scopes: McpScope[];
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface CreatedMcpKey extends McpKey {
  /** Сырой ключ — только при создании; в БД лежит лишь хэш. */
  rawKey: string;
}

function parseScopes(raw: any): McpScope[] {
  if (Array.isArray(raw)) return sanitizeScopes(raw);
  if (typeof raw === 'string' && raw.trim()) {
    try { return sanitizeScopes(JSON.parse(raw)); } catch { return []; }
  }
  return [];
}

function mapRow(row: any): McpKey {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    apiKeyPrefix: row.api_key_prefix,
    label: row.label || null,
    scopes: parseScopes(row.scopes),
    createdAt: new Date(row.created_at),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  };
}

export function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function makePrefix(rawKey: string): string {
  return rawKey.slice(0, 16) + '…';
}

/** Создаёт MCP-ключ. Возвращает сырой ключ (показать 1 раз) + метаданные. */
export async function createKey(
  tenantId: string,
  label?: string,
  scopes?: unknown
): Promise<CreatedMcpKey> {
  const rawBytes = crypto.randomBytes(36).toString('base64url');
  const rawKey = `vbvx_mcp_${rawBytes}`;
  const hash = hashKey(rawKey);
  const prefix = makePrefix(rawKey);
  const clean = sanitizeScopes(scopes);
  const finalScopes = clean.length ? clean : DEFAULT_SCOPES;

  const res = await pool.query(
    `INSERT INTO tenant_mcp_keys (tenant_id, api_key_hash, api_key_prefix, label, scopes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [tenantId, hash, prefix, label?.slice(0, 255) || null, JSON.stringify(finalScopes)]
  );
  const row = (res.rows as any[])[0];
  // В fallback scopes сохранён строкой — гарантируем массив в ответе.
  return { ...mapRow({ ...row, scopes: row.scopes ?? finalScopes }), rawKey };
}

export async function listKeys(tenantId: string): Promise<McpKey[]> {
  const res = await pool.query(
    `SELECT * FROM tenant_mcp_keys
     WHERE tenant_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return (res.rows as any[]).map(mapRow);
}

/** Проверяет сырой ключ → tenantId + scopes (если валиден и не отозван). */
export async function verifyKey(
  rawKey: string
): Promise<{ tenantId: string; keyId: string; scopes: McpScope[] } | null> {
  if (!rawKey || !rawKey.startsWith('vbvx_mcp_')) return null;
  const hash = hashKey(rawKey);
  const res = await pool.query(
    `SELECT id, tenant_id, scopes FROM tenant_mcp_keys
     WHERE api_key_hash = $1 AND revoked_at IS NULL
     LIMIT 1`,
    [hash]
  );
  const row = (res.rows as any[])[0];
  if (!row) return null;

  try {
    await pool.query(`UPDATE tenant_mcp_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`, [row.id]);
  } catch { /* best-effort */ }

  return { tenantId: row.tenant_id, keyId: row.id, scopes: parseScopes(row.scopes) };
}

export async function revokeKey(tenantId: string, keyId: string): Promise<boolean> {
  const check = await pool.query('SELECT tenant_id FROM tenant_mcp_keys WHERE id = $1', [keyId]);
  const owner = (check.rows as any[])[0];
  if (!owner || owner.tenant_id !== tenantId) return false;
  const res = await pool.query(`UPDATE tenant_mcp_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`, [keyId]);
  return (res.rowCount || 0) > 0;
}

export async function deleteKey(tenantId: string, keyId: string): Promise<boolean> {
  const check = await pool.query('SELECT tenant_id FROM tenant_mcp_keys WHERE id = $1', [keyId]);
  const owner = (check.rows as any[])[0];
  if (!owner || owner.tenant_id !== tenantId) return false;
  const res = await pool.query(`DELETE FROM tenant_mcp_keys WHERE id = $1`, [keyId]);
  return (res.rowCount || 0) > 0;
}
