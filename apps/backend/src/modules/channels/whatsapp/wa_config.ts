/**
 * WhatsApp (прямой Cloud API) — конфиг подключения.
 *
 * Зеркалит ig/tt_config: движок цепочек переиспользуется, новое — только транспорт.
 * MVP: один номер через .env. Шаблоны (вне окна 24ч) — отдельная фаза WA-1.
 *
 * Cloud API: POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
 * Webhook: общая инфраструктура Meta (hub.challenge + X-Hub-Signature-256).
 */

export interface WaConfig {
  tenantId: string;
  /** Phone Number ID (из вебхука value.metadata.phone_number_id и путь Send API). */
  phoneNumberId: string;
  accessToken: string;
}

export function getVerifyToken(): string {
  return process.env.WHATSAPP_VERIFY_TOKEN || '';
}

/** Резолв по phone_number_id из вебхука. MVP: единственный номер из .env. */
export async function resolveWaConfigByPhoneId(phoneNumberId: string): Promise<WaConfig | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const tenantId = process.env.WHATSAPP_DEFAULT_TENANT_ID || process.env.CHATWOOT_DEFAULT_TENANT_ID;
  if (!accessToken || !tenantId) return null;
  const envPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (envPhone && String(envPhone) !== String(phoneNumberId)) return null;
  return { tenantId, phoneNumberId: String(phoneNumberId), accessToken };
}
