/**
 * Per-tenant TikHub.io API key (TrendTraffic).
 *
 * Аналог tenant_settings/gemini.ts:
 *  - Enterprise-владелец может задать СВОЙ ключ TikHub в настройках.
 *  - Ключ хранится зашифрованным (AES-256-GCM, ключ — SIP_ENCRYPTION_KEY).
 *  - Скан трендов/скачивание ОТ ИМЕНИ этого tenant'а используют его ключ.
 *  - Если ключ невалиден — статус 'invalid' / 'quota_exceeded'. Fallback:
 *    Enterprise НЕ падает на платформенный ключ (иначе биллинг TikHub «поедет»);
 *    остальные тарифы падают на платформенный ключ из systemConfig.
 *
 * Endpoints (в router.ts) дают CRUD + validate.
 */

import pool from '../../db/index.js';
import { getTikHubApiKey } from '../../config/systemConfig.js';
import { encryptSecret, decryptSecret } from './encryption.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { validateTikHubKey, type TikHubKeyInfo, type TikHubKeyStatus } from '../tikhub/tikhub_client.js';

export type TikHubKeyStatusDb = TikHubKeyStatus | null;

/**
 * tenants.id — UUID. Суперадмин ходит с tenantId='global_admin' (служебный sentinel,
 * не UUID), у него нет строки в tenants → per-tenant ключ к нему неприменим.
 * Проверяем формат, чтобы не ловить сырую ошибку PostgreSQL "invalid input syntax for uuid".
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): boolean { return !!v && UUID_RE.test(v); }

const NOT_TENANT_MSG =
  'Собственный ключ Trend доступен только Enterprise-тенантам. Вы вошли как суперадмин — задайте ПЛАТФОРМЕННЫЙ ключ в Админ-панели → «Настройки системных API».';

export interface TenantTikHubKeyInfo {
  hasKey: boolean;
  status: TikHubKeyStatusDb;
  lastCheckAt: string | null;
  /** Короткий префикс ключа для UI ("abc123...***"). Сам ключ не возвращаем. */
  prefix: string | null;
}

// ============================================================================
// Чтение
// ============================================================================

export async function getTenantTikHubKey(tenantId: string): Promise<{
  key: string | null;
  status: TikHubKeyStatusDb;
  lastCheckAt: Date | null;
}> {
  if (!isUuid(tenantId)) return { key: null, status: null, lastCheckAt: null };
  try {
    const res = await pool.query(
      `SELECT tikhub_api_key_encrypted, tikhub_api_key_status, tikhub_api_key_last_check
       FROM tenants WHERE id = $1`,
      [tenantId]
    );
    const row = res.rows[0];
    if (!row) return { key: null, status: null, lastCheckAt: null };
    return {
      key: decryptSecret(row.tikhub_api_key_encrypted),
      status: (row.tikhub_api_key_status as TikHubKeyStatusDb) || null,
      lastCheckAt: row.tikhub_api_key_last_check ? new Date(row.tikhub_api_key_last_check) : null,
    };
  } catch {
    // Таблица/колонки отсутствуют в fallback-режиме — деградируем тихо.
    return { key: null, status: null, lastCheckAt: null };
  }
}

/**
 * "Эффективный" ключ TikHub. ⚠️ ПРАВИЛО РАЗДЕЛЕНО ПО ТАРИФУ (как у Gemini):
 *  • Enterprise → ТОЛЬКО собственный валидный ключ; иначе null (НЕ падаем на
 *    платформенный — Enterprise платит TikHub сам своим ключом/балансом).
 *  • Не-Enterprise → собственный валидный ключ если есть, иначе платформенный
 *    ключ из systemConfig (общий аккаунт платформы).
 * null = «использовать нечего», caller должен вернуть ошибку «задайте ключ».
 */
export async function getEffectiveTikHubKey(tenantId: string | null | undefined): Promise<string | null> {
  if (tenantId) {
    try {
      const info = await getTenantTikHubKey(tenantId);
      if (info.key && info.status !== 'invalid' && info.status !== 'quota_exceeded') return info.key;
    } catch (err) {
      console.warn('[tenant_settings/tikhub] Ошибка чтения per-tenant ключа:', err);
    }
  }
  if (tenantId) {
    try {
      if (await hasEnterpriseAccess(tenantId)) return null;
    } catch (err) {
      console.warn('[tenant_settings/tikhub] Ошибка чтения тарифа (fallback):', err);
    }
  }
  return getTikHubApiKey() || null;
}

export async function getTenantTikHubKeyInfo(tenantId: string): Promise<TenantTikHubKeyInfo> {
  const info = await getTenantTikHubKey(tenantId);
  const prefix = info.key ? `${info.key.slice(0, 6)}...***` : null;
  return {
    hasKey: !!info.key,
    status: info.status,
    lastCheckAt: info.lastCheckAt ? info.lastCheckAt.toISOString() : null,
    prefix,
  };
}

// ============================================================================
// Запись
// ============================================================================

/** Сохраняет per-tenant ключ (шифруя). Сбрасывает статус на NULL — валидирует caller. */
export async function setTenantTikHubKey(tenantId: string, rawKey: string | null): Promise<void> {
  if (!isUuid(tenantId)) throw new Error(NOT_TENANT_MSG);
  const encrypted = encryptSecret(rawKey);
  await pool.query(
    `UPDATE tenants SET tikhub_api_key_encrypted = $1, tikhub_api_key_status = $2 WHERE id = $3`,
    [encrypted, null, tenantId]
  );
}

/** Удаляет per-tenant ключ — tenant возвращается на платформенный fallback (если не Enterprise). */
export async function clearTenantTikHubKey(tenantId: string): Promise<void> {
  if (!isUuid(tenantId)) throw new Error(NOT_TENANT_MSG);
  await pool.query(
    `UPDATE tenants SET tikhub_api_key_encrypted = $1, tikhub_api_key_status = $2 WHERE id = $3`,
    [null, null, tenantId]
  );
}

/** Записывает статус ключа после валидации (или после неуспешного вызова TikHub). */
export async function setTenantTikHubKeyStatus(tenantId: string, status: TikHubKeyStatusDb): Promise<void> {
  if (!isUuid(tenantId)) return;
  await pool.query(
    `UPDATE tenants SET tikhub_api_key_status = $1 WHERE id = $2`,
    [status, tenantId]
  );
  try {
    await pool.query(`UPDATE tenants SET tikhub_api_key_last_check = NOW() WHERE id = $1`, [tenantId]);
  } catch {
    /* в fallback — noop */
  }
}

// ============================================================================
// Валидация
// ============================================================================

export interface TenantTikHubValidateResult {
  ok: boolean;
  status: TikHubKeyStatusDb;
  message: string;
  error?: string;
}

/**
 * РЕАЛЬНО проверяет per-tenant ключ против TikHub и сохраняет статус.
 * Если передан rawKey — проверяет именно его (для проверки ДО сохранения),
 * иначе — текущий сохранённый ключ тенанта.
 */
export async function validateTenantTikHubKey(
  tenantId: string,
  rawKey?: string | null
): Promise<TenantTikHubValidateResult> {
  let key = (rawKey || '').trim();
  if (!key) {
    const info = await getTenantTikHubKey(tenantId);
    key = info.key || '';
  }
  if (!key) return { ok: false, status: null, message: 'Ключ не задан' };

  const result: TikHubKeyInfo = await validateTikHubKey(key);
  await setTenantTikHubKeyStatus(tenantId, result.status);
  return { ok: result.ok, status: result.status, message: result.message, error: result.error };
}
