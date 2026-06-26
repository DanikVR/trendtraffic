/**
 * Facebook Messenger (Messenger Platform API) — конфиг подключения.
 *
 * Тот же API, что у Instagram (graph.facebook.com, page access token, object='page').
 * Движок цепочек и почти весь IG-клиент переиспользуются. MVP: одна страница через .env.
 */

export interface MsgConfig {
  tenantId: string;
  /** Facebook Page ID (из вебхука entry.id и путь Send API). */
  pageId: string;
  accessToken: string;
}

export function getVerifyToken(): string {
  return process.env.MESSENGER_VERIFY_TOKEN || '';
}

export async function resolveMsgConfigByPageId(pageId: string): Promise<MsgConfig | null> {
  const accessToken = process.env.MESSENGER_PAGE_TOKEN;
  const tenantId = process.env.MESSENGER_DEFAULT_TENANT_ID || process.env.CHATWOOT_DEFAULT_TENANT_ID;
  if (!accessToken || !tenantId) return null;
  const envPage = process.env.MESSENGER_PAGE_ID;
  if (envPage && String(envPage) !== String(pageId)) return null;
  return { tenantId, pageId: String(pageId), accessToken };
}

export async function resolveMsgConfigByTenant(tenantId: string): Promise<MsgConfig | null> {
  const accessToken = process.env.MESSENGER_PAGE_TOKEN;
  const envTenant = process.env.MESSENGER_DEFAULT_TENANT_ID || process.env.CHATWOOT_DEFAULT_TENANT_ID;
  const envPage = process.env.MESSENGER_PAGE_ID || '';
  if (accessToken && envTenant && String(envTenant) === String(tenantId)) {
    return { tenantId, pageId: String(envPage), accessToken };
  }
  return null;
}
