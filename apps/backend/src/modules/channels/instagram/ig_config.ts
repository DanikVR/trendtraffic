/**
 * Instagram (прямой Graph API) — IG-0. Конфиг подключения аккаунта.
 *
 * В отличие от Chatwoot-каналов, Instagram подключаем НАПРЯМУЮ к Graph API
 * (Instagram API with Instagram Login), т.к. ростовые фичи (Comment-to-DM,
 * карусель, подписка-гейт, Ice Breakers, Story-триггеры) Chatwoot не умеет.
 *
 * MVP (IG-0): один аккаунт через .env (как dev-Chatwoot). Позже — таблица
 * на tenant с OAuth-подключением, резолв по ig_id из вебхука.
 */

export interface IgConfig {
  tenantId: string;
  /** IG business account id — это `entry.id` во входящем вебхуке и путь Send API. */
  igId: string;
  /** Долгоживущий Instagram user access token. */
  accessToken: string;
  /** App Secret — для проверки подписи X-Hub-Signature-256 (если задан). */
  appSecret?: string;
}

/** verify_token для GET-проверки вебхука (Meta dashboard ↔ .env). */
export function getVerifyToken(): string {
  return process.env.INSTAGRAM_VERIFY_TOKEN || '';
}

import { getIgAccountByIgId, getIgAccountByTenant } from './ig_accounts.js';

/**
 * Резолв конфигурации IG-аккаунта по его id из вебхука.
 *  1) Подключённый через OAuth аккаунт (per-tenant, токен в БД) — основной путь (прод).
 *  2) .env (наш тестовый аккаунт, IG-0) — если в БД нет и заданы INSTAGRAM_ACCESS_TOKEN +
 *     tenant. INSTAGRAM_BUSINESS_ID (если задан) ограничивает env-резолв одним аккаунтом.
 */
export async function resolveIgConfigByIgId(igId: string): Promise<IgConfig | null> {
  // 1) OAuth-подключение в БД.
  try {
    const acc = await getIgAccountByIgId(igId);
    if (acc && acc.enabled && acc.accessToken) {
      return { tenantId: acc.tenantId, igId: acc.igId, accessToken: acc.accessToken, appSecret: process.env.INSTAGRAM_APP_SECRET || undefined };
    }
  } catch { /* БД недоступна — пробуем env */ }

  // 2) env-фолбэк (dev/тест).
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const tenantId = process.env.INSTAGRAM_DEFAULT_TENANT_ID || process.env.CHATWOOT_DEFAULT_TENANT_ID;
  if (!accessToken || !tenantId) return null;
  const envIgId = process.env.INSTAGRAM_BUSINESS_ID;
  if (envIgId && String(envIgId) !== String(igId)) return null;
  return {
    tenantId,
    igId: String(igId),
    accessToken,
    appSecret: process.env.INSTAGRAM_APP_SECRET || undefined,
  };
}

/** Конфиг IG-аккаунта арендатора (для account-level операций: Ice Breakers, статус). */
export async function resolveIgConfigByTenant(tenantId: string): Promise<IgConfig | null> {
  try {
    const acc = await getIgAccountByTenant(tenantId);
    if (acc && acc.enabled && acc.accessToken) {
      return { tenantId: acc.tenantId, igId: acc.igId, accessToken: acc.accessToken, appSecret: process.env.INSTAGRAM_APP_SECRET || undefined };
    }
  } catch { /* БД недоступна — пробуем env */ }
  // env-тестовый аккаунт — только если этот tenant = env-tenant.
  const envTenant = process.env.INSTAGRAM_DEFAULT_TENANT_ID || process.env.CHATWOOT_DEFAULT_TENANT_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const envIgId = process.env.INSTAGRAM_BUSINESS_ID;
  if (accessToken && envTenant && envIgId && String(envTenant) === String(tenantId)) {
    return { tenantId, igId: String(envIgId), accessToken, appSecret: process.env.INSTAGRAM_APP_SECRET || undefined };
  }
  return null;
}
