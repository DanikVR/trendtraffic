/**
 * TikTok (прямой Business Messaging API) — конфиг подключения.
 *
 * Зеркалит ig_config: движок цепочек переиспользуется, новое — только транспорт.
 * MVP: один аккаунт через .env (как IG-0). OAuth-самоподключение магазинов (как
 * IG-0.5) — отдельная фаза TT-0.5.
 *
 * ⚠️ Доступ к TikTok Business Messaging API требует статуса Messaging Partner +
 * привязки аккаунта к TikTok for Business / Business Center (аналог Meta App Review).
 */

export interface TtConfig {
  tenantId: string;
  /** TikTok business account id — приходит в вебхуке и используется в Send API. */
  accountId: string;
  accessToken: string;
}

/** verify_token для GET-проверки вебхука (TikTok dashboard ↔ .env). */
export function getVerifyToken(): string {
  return process.env.TIKTOK_VERIFY_TOKEN || '';
}

/** Резолв по id аккаунта из вебхука. MVP: единственный аккаунт из .env. */
export async function resolveTtConfigByAccountId(accountId: string): Promise<TtConfig | null> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const tenantId = process.env.TIKTOK_DEFAULT_TENANT_ID || process.env.CHATWOOT_DEFAULT_TENANT_ID;
  if (!accessToken || !tenantId) return null;
  const envAcc = process.env.TIKTOK_BUSINESS_ID;
  if (envAcc && String(envAcc) !== String(accountId)) return null;
  return { tenantId, accountId: String(accountId), accessToken };
}

/** Конфиг аккаунта арендатора (account-level операции: welcome, suggested, ref-url). */
export async function resolveTtConfigByTenant(tenantId: string): Promise<TtConfig | null> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const envTenant = process.env.TIKTOK_DEFAULT_TENANT_ID || process.env.CHATWOOT_DEFAULT_TENANT_ID;
  const envAcc = process.env.TIKTOK_BUSINESS_ID || '';
  if (accessToken && envTenant && String(envTenant) === String(tenantId)) {
    return { tenantId, accountId: String(envAcc), accessToken };
  }
  return null;
}
