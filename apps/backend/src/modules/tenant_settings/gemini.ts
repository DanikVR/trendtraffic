/**
 * Per-tenant Google Gemini API key (ENTERPRISE v0.10.0).
 *
 * Логика:
 *  - Enterprise-владелец может задать СВОЙ Gemini API key в Настройках.
 *  - Этот ключ хранится зашифрованным (AES-256-GCM, ключ — SIP_ENCRYPTION_KEY).
 *  - Все вызовы Gemini ОТ ИМЕНИ ЭТОГО tenant'а (bridge, insights, coach,
 *    assistant, quest_flow) используют его per-tenant key вместо глобального.
 *  - Если per-tenant ключ невалидный (401 / quota) — статус выставляется
 *    'invalid' / 'quota_exceeded' и владельцу шлётся уведомление в Telegram
 *    (если у него подключен owner_telegram_id). Fallback: НЕ переключаемся
 *    автоматически на глобальный — иначе биллинг и квоты "поедут".
 *    Владелец должен починить ключ или явно его удалить.
 *
 * Endpoints (в router.ts) дают CRUD + validate.
 */

import pool from '../../db/index.js';
import { getGeminiUseVertex, getVertexProject, getVertexLocation } from '../../config/systemConfig.js';
import { pickGeminiKey } from '../../config/gemini_key_pool.js';
import { encryptSecret, decryptSecret } from './encryption.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';

export type GeminiKeyStatus = 'active' | 'invalid' | 'quota_exceeded' | null;

export interface TenantGeminiKeyInfo {
  hasKey: boolean;
  status: GeminiKeyStatus;
  lastCheckAt: string | null;
  /** Короткий префикс ключа для UI ("AIzaSyA...***"). НЕ возвращаем сам ключ. */
  prefix: string | null;
}

// ============================================================================
// Чтение
// ============================================================================

/**
 * Возвращает per-tenant Gemini API key (расшифрованный) или null если не задан.
 * НЕ возвращает глобальный fallback — для этого есть getEffectiveGeminiKey.
 */
export async function getTenantGeminiKey(tenantId: string): Promise<{
  key: string | null;
  status: GeminiKeyStatus;
  lastCheckAt: Date | null;
}> {
  const res = await pool.query(
    `SELECT gemini_api_key_encrypted, gemini_api_key_status, gemini_api_key_last_check
     FROM tenants WHERE id = $1`,
    [tenantId]
  );
  const row = res.rows[0];
  if (!row) return { key: null, status: null, lastCheckAt: null };
  return {
    key: decryptSecret(row.gemini_api_key_encrypted),
    status: (row.gemini_api_key_status as GeminiKeyStatus) || null,
    lastCheckAt: row.gemini_api_key_last_check ? new Date(row.gemini_api_key_last_check) : null,
  };
}

/**
 * Возвращает "эффективный" Gemini-ключ. ⚠️ ПРАВИЛО РАЗДЕЛЕНО ПО ТАРИФУ:
 *
 *  • Enterprise-тенант → ТОЛЬКО собственный ключ. На глобальный ключ суперадмина
 *    НЕ падаем: Enterprise оплачивает Gemini сам, своим ключом и квотой. Если своего
 *    ключа нет / он invalid / quota_exceeded — возвращаем NULL, и caller обязан вернуть
 *    юзеру ошибку «задайте свой ключ» (НЕ молча использовать ключ суперадмина).
 *  • Не-Enterprise (free/trial/standard/plus) → собственный ключ если задан и валиден,
 *    иначе глобальный ключ из systemConfig (freemium-режим).
 *
 * NULL означает "использовать нечего" — caller должен вернуть ошибку юзеру.
 */
export async function getEffectiveGeminiKey(tenantId: string | null | undefined): Promise<string | null> {
  // 1. Собственный валидный ключ тенанта — приоритет на ЛЮБОМ тарифе.
  if (tenantId) {
    try {
      const tenantInfo = await getTenantGeminiKey(tenantId);
      if (tenantInfo.key && tenantInfo.status !== 'invalid' && tenantInfo.status !== 'quota_exceeded') {
        return tenantInfo.key;
      }
    } catch (err) {
      console.warn('[tenant_settings/gemini] Ошибка чтения per-tenant ключа:', err);
    }
  }

  // 2. Своего валидного ключа нет. Решаем по тарифу, можно ли упасть на глобальный.
  //    Enterprise — НЕЛЬЗЯ (свой ключ обязателен), иначе биллинг/квоты суперадмина «поедут».
  if (tenantId) {
    try {
      if (await hasEnterpriseAccess(tenantId)) {
        return null;
      }
    } catch (err) {
      console.warn('[tenant_settings/gemini] Ошибка чтения тарифа (решение о fallback):', err);
    }
  }

  // 3. Не-Enterprise (или нет tenantId) — глобальный fallback из пула ключей суперадмина
  //    (round-robin по нескольким ключам/проектам, п.4). При одном ключе ведёт себя как раньше.
  return pickGeminiKey();
}

/**
 * Конфиг для инициализации GoogleGenAI-клиента переводчиком (bridge), п.4+п.5.
 * Расширяет getEffectiveGeminiKey возможностью отдать Vertex-режим для ГЛОБАЛЬНОГО трафика.
 *
 * Приоритет:
 *   1. Свой валидный ключ тенанта (Enterprise платит своим ключом) → Developer API.
 *   2. Enterprise без валидного ключа → null (нельзя падать на глобальный — биллинг «поедет»).
 *   3. Глобальный/freemium трафик:
 *        • если включён Vertex AI и задан project → Vertex-режим (1000 concurrent/проект);
 *        • иначе round-robin ключ из пула → Developer API.
 *   null = использовать нечего (caller вернёт ошибку юзеру).
 */
export type GeminiClientConfig =
  | { mode: 'apikey'; apiKey: string }
  | { mode: 'vertex'; project: string; location: string };

export async function getEffectiveGeminiClientConfig(
  tenantId: string | null | undefined
): Promise<GeminiClientConfig | null> {
  // 1. Свой валидный ключ тенанта — приоритет (Developer API).
  if (tenantId) {
    try {
      const tenantInfo = await getTenantGeminiKey(tenantId);
      if (tenantInfo.key && tenantInfo.status !== 'invalid' && tenantInfo.status !== 'quota_exceeded') {
        return { mode: 'apikey', apiKey: tenantInfo.key };
      }
    } catch (err) {
      console.warn('[tenant_settings/gemini] Ошибка чтения per-tenant ключа (clientConfig):', err);
    }
  }

  // 2. Enterprise без своего ключа — нельзя на глобальный.
  if (tenantId) {
    try {
      if (await hasEnterpriseAccess(tenantId)) return null;
    } catch (err) {
      console.warn('[tenant_settings/gemini] Ошибка чтения тарифа (clientConfig):', err);
    }
  }

  // 3. Глобальный трафик: Vertex (если включён и сконфигурирован) или пул ключей.
  if (getGeminiUseVertex()) {
    const project = getVertexProject();
    if (project) {
      return { mode: 'vertex', project, location: getVertexLocation() || 'us-central1' };
    }
    console.warn('[tenant_settings/gemini] Vertex включён, но vertexProject не задан — падаем на API-key пул.');
  }
  const apiKey = pickGeminiKey();
  return apiKey ? { mode: 'apikey', apiKey } : null;
}

/**
 * Info-метаданные о per-tenant ключе для UI (без самого ключа).
 */
export async function getTenantGeminiKeyInfo(tenantId: string): Promise<TenantGeminiKeyInfo> {
  const info = await getTenantGeminiKey(tenantId);
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

/**
 * Сохраняет per-tenant Gemini ключ (шифруя его). Сразу сбрасывает статус
 * на NULL (валидировать должен caller вызовом validateTenantGeminiKey).
 */
export async function setTenantGeminiKey(tenantId: string, rawKey: string | null): Promise<void> {
  const encrypted = encryptSecret(rawKey);
  await pool.query(
    `UPDATE tenants
     SET gemini_api_key_encrypted = $1, gemini_api_key_status = $2
     WHERE id = $3`,
    [encrypted, null, tenantId]
  );
}

/**
 * Удаляет per-tenant Gemini ключ — tenant возвращается на глобальный fallback.
 */
export async function clearTenantGeminiKey(tenantId: string): Promise<void> {
  await pool.query(
    `UPDATE tenants
     SET gemini_api_key_encrypted = $1, gemini_api_key_status = $2
     WHERE id = $3`,
    [null, null, tenantId]
  );
}

/**
 * Записывает статус ключа после валидации (или после неуспешного вызова Gemini).
 * Используется и эндпоинтом /validate, и observability'ом из bridge/insights
 * когда они получили 401/quota от Gemini с per-tenant ключом.
 */
export async function setTenantGeminiKeyStatus(
  tenantId: string,
  status: GeminiKeyStatus
): Promise<void> {
  await pool.query(
    `UPDATE tenants
     SET gemini_api_key_status = $1
     WHERE id = $2`,
    [status, tenantId]
  );
  // Note: gemini_api_key_last_check автоматически выставляется в fallback;
  // для PG пишем явно ниже отдельным запросом, чтобы не плодить ветки.
  try {
    await pool.query(
      `UPDATE tenants SET gemini_api_key_last_check = NOW() WHERE id = $1`,
      [tenantId]
    );
  } catch {
    // в fallback это noop
  }
}

// ============================================================================
// Валидация ключа
// ============================================================================

export interface ValidateResult {
  ok: boolean;
  status: GeminiKeyStatus;
  error?: string;
}

/**
 * Делает реальный лёгкий запрос к Gemini API, чтобы проверить работоспособность
 * per-tenant ключа. Использует listModels — самый дешёвый ping.
 */
export async function validateTenantGeminiKey(tenantId: string): Promise<ValidateResult> {
  const info = await getTenantGeminiKey(tenantId);
  if (!info.key) {
    return { ok: false, status: null, error: 'Ключ не задан' };
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(info.key)}`;
    const resp = await fetch(url, { method: 'GET' });
    if (resp.ok) {
      await setTenantGeminiKeyStatus(tenantId, 'active');
      return { ok: true, status: 'active' };
    }
    // 429 — превышена квота
    if (resp.status === 429) {
      await setTenantGeminiKeyStatus(tenantId, 'quota_exceeded');
      return { ok: false, status: 'quota_exceeded', error: 'Превышена квота Gemini API' };
    }
    // 400/401/403 — невалидный ключ
    await setTenantGeminiKeyStatus(tenantId, 'invalid');
    const body = await resp.text().catch(() => '');
    return {
      ok: false,
      status: 'invalid',
      error: `Gemini API вернул ${resp.status}${body ? ': ' + body.slice(0, 200) : ''}`,
    };
  } catch (err: any) {
    await setTenantGeminiKeyStatus(tenantId, 'invalid');
    return { ok: false, status: 'invalid', error: err?.message || String(err) };
  }
}
