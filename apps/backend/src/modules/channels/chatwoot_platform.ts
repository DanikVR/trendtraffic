/**
 * OMNICHANNEL CW-SSO — бесшовный мост VibeVox → Chatwoot (Platform API).
 *
 * Идея: в Chatwoot НИКТО не регистрируется руками. Все аккаунты/пользователи
 * заводятся автоматически из VibeVox через Platform App token (супер-админ).
 * Вход — без пароля: одноразовая SSO-ссылка Platform API.
 *
 * Модель:
 *   1 tenant VibeVox      → 1 account Chatwoot     (tenants.chatwoot_account_id)
 *   1 email агента VibeVox → 1 user Chatwoot        (таблица chatwoot_users)
 *
 * Поток «нажал Чат»:
 *   ensureAccount → ensureAgentUser → (best-effort) ensureVideoConversation →
 *   getSsoLoginUrl → возвращаем ссылку, по которой агент уже залогинен в Chatwoot.
 *
 * Всё best-effort и изолировано: при любой ошибке возвращаем null, а вызыватель
 * откатывается на внутренний чат VibeVox (поведение до интеграции не ломается).
 *
 * Базовый origin и Platform-токен — глобальные (один инстанс Chatwoot на всю
 * платформу), берутся из systemConfig (супер-админка / env).
 */

import { randomBytes } from 'crypto';
import pool from '../../db/index.js';
import { encryptSecret, decryptSecret } from '../tenant_settings/encryption.js';
import { getChatwootPlatformToken, getChatwootPlatformBaseUrl } from '../../config/systemConfig.js';

const VIDEO_INBOX_NAME = 'VibeVox Видеозвонок';

export interface ChatwootEntry {
  /** SSO-ссылка: открыть в браузере → агент залогинен в Chatwoot. */
  ssoUrl: string;
  /** Прямая ссылка на диалог клиента (или дашборд аккаунта, если диалога нет). */
  deepLink: string;
  accountId: string;
  conversationId: string | null;
}

interface AgentUser {
  userId: string;
  accessToken: string | null;
}

/** Бесшовный мост включён только если задан Platform App token и базовый URL. */
export function isPlatformConfigured(): boolean {
  return !!getChatwootPlatformToken() && !!getChatwootPlatformBaseUrl();
}

function platformHeaders(): Record<string, string> {
  return { api_access_token: getChatwootPlatformToken(), 'Content-Type': 'application/json' };
}
function appHeaders(userToken: string): Record<string, string> {
  return { api_access_token: userToken, 'Content-Type': 'application/json' };
}

async function pfetch(path: string, init?: RequestInit): Promise<any | null> {
  const base = getChatwootPlatformBaseUrl();
  try {
    const resp = await fetch(`${base}${path}`, init);
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.warn(`[chatwoot/platform] ${init?.method || 'GET'} ${path} → HTTP ${resp.status}: ${body.slice(0, 200)}`);
      return null;
    }
    return await resp.json().catch(() => ({}));
  } catch (err) {
    console.warn(`[chatwoot/platform] ${init?.method || 'GET'} ${path} failed:`, (err as Error).message);
    return null;
  }
}

// ============================================================================
// Язык UI Chatwoot = язык, выбранный в VibeVox
// ============================================================================

/**
 * Локали, реально присутствующие в Chatwoot (UI их подгружает). VibeVox знает 108
 * языков — те, которых в Chatwoot пока нет, складываем в 'en'. Полный перевод чата
 * на все 107 — отдельная задача позже.
 */
const CHATWOOT_LOCALES: Record<string, string> = {
  en: 'en', ar: 'ar', az: 'az', bg: 'bg', ca: 'ca', cs: 'cs', da: 'da', de: 'de',
  el: 'el', es: 'es', et: 'et', eu: 'eu', fa: 'fa', fi: 'fi', fil: 'fil', fr: 'fr',
  he: 'he', hi: 'hi', hr: 'hr', hu: 'hu', id: 'id', it: 'it', ja: 'ja', ko: 'ko',
  lt: 'lt', lv: 'lv', ml: 'ml', nl: 'nl', no: 'no', pl: 'pl', pt: 'pt', ro: 'ro',
  ru: 'ru', sk: 'sk', sr: 'sr', sv: 'sv', ta: 'ta', th: 'th', tr: 'tr', uk: 'uk',
  vi: 'vi', pt_br: 'pt_BR', zh_cn: 'zh_CN', zh_tw: 'zh_TW',
};
const LOCALE_ALIASES: Record<string, string> = {
  zh: 'zh_CN', zh_hans: 'zh_CN', zh_hant: 'zh_TW', zh_hk: 'zh_TW',
  nb: 'no', nn: 'no', iw: 'he', in: 'id', tl: 'fil',
};

/** Маппит код языка VibeVox (i18next) на локаль Chatwoot; неизвестные → 'en'. */
export function mapToChatwootLocale(lang: string | null | undefined): string {
  if (!lang) return 'en';
  const n = lang.trim().toLowerCase().replace(/-/g, '_');
  if (CHATWOOT_LOCALES[n]) return CHATWOOT_LOCALES[n];
  if (LOCALE_ALIASES[n]) return LOCALE_ALIASES[n];
  const base = n.split('_')[0];                 // 'ru_ru' → 'ru'
  return CHATWOOT_LOCALES[base] || LOCALE_ALIASES[base] || 'en';
}

/** Ставит локаль аккаунта Chatwoot (UI-язык). Best-effort, не бросает. */
export async function setAccountLocale(accountId: string, locale: string): Promise<void> {
  await pfetch(`/platform/api/v1/accounts/${accountId}`, {
    method: 'PATCH', headers: platformHeaders(), body: JSON.stringify({ locale }),
  });
}

// ============================================================================
// Account: 1 tenant = 1 account Chatwoot
// ============================================================================

/** Возвращает (создавая при необходимости) chatwoot_account_id для tenant'а. */
export async function ensureTenantAccount(tenantId: string, displayName: string): Promise<string | null> {
  // 1. Уже привязан?
  try {
    const r = await pool.query(`SELECT chatwoot_account_id FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    const existing = (r.rows as any[])[0]?.chatwoot_account_id;
    if (existing) return String(existing);
  } catch { /* fallthrough to create */ }

  // 2. Создаём account через Platform API.
  const name = (displayName || `VibeVox ${tenantId.slice(0, 8)}`).slice(0, 120);
  const data = await pfetch('/platform/api/v1/accounts', {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({ name }),
  });
  const accountId = data?.id != null ? String(data.id) : null;
  if (!accountId) return null;

  try {
    await pool.query(`UPDATE tenants SET chatwoot_account_id = $1 WHERE id = $2`, [accountId, tenantId]);
  } catch (err) {
    console.warn('[chatwoot/platform] store account_id failed:', (err as Error).message);
  }
  return accountId;
}

// ============================================================================
// User: 1 email агента = 1 user Chatwoot (привязан к account'у tenant'а)
// ============================================================================

/** Возвращает (создавая при необходимости) пользователя Chatwoot для email агента. */
export async function ensureAgentUser(
  tenantId: string,
  email: string,
  displayName: string,
  accountId: string,
): Promise<AgentUser | null> {
  const normEmail = email.trim().toLowerCase();
  if (!normEmail) return null;

  // 1. Уже заведён?
  try {
    const r = await pool.query(
      `SELECT chatwoot_user_id, access_token_encrypted FROM chatwoot_users WHERE email = $1 LIMIT 1`,
      [normEmail],
    );
    const row = (r.rows as any[])[0];
    if (row?.chatwoot_user_id) {
      return { userId: String(row.chatwoot_user_id), accessToken: decryptSecret(row.access_token_encrypted) };
    }
  } catch { /* fallthrough to create */ }

  // 2. Создаём user через Platform API. Пароль случайный и нигде не показывается —
  //    вход всегда по SSO-ссылке.
  const password = randomBytes(24).toString('base64url') + 'Aa1!';
  const created = await pfetch('/platform/api/v1/users', {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({
      name: (displayName || normEmail).slice(0, 120),
      email: normEmail,
      password,
      custom_attributes: { vibevox_tenant_id: tenantId, source: 'VibeVox' },
    }),
  });
  const userId = created?.id != null ? String(created.id) : null;
  const accessToken: string | null = created?.access_token || null;
  if (!userId) {
    // Частый случай: email уже существует в Chatwoot, но нет в нашей таблице.
    // Platform API не даёт «найти user по email», поэтому требуется ручная сверка.
    console.warn(`[chatwoot/platform] create user failed for ${normEmail} (возможно email уже занят в Chatwoot)`);
    return null;
  }

  // 3. Привязываем user к account'у (роль администратора — это владелец tenant'а).
  await pfetch(`/platform/api/v1/accounts/${accountId}/account_users`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({ user_id: Number(userId), role: 'administrator' }),
  });

  // 4. Запоминаем маппинг + Application-токен (для создания контактов/диалогов).
  try {
    await pool.query(
      `INSERT INTO chatwoot_users (email, tenant_id, chatwoot_user_id, chatwoot_account_id, access_token_encrypted)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         chatwoot_user_id = EXCLUDED.chatwoot_user_id,
         chatwoot_account_id = EXCLUDED.chatwoot_account_id,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         updated_at = CURRENT_TIMESTAMP`,
      [normEmail, tenantId, userId, accountId, encryptSecret(accessToken)],
    );
  } catch (err) {
    console.warn('[chatwoot/platform] store chatwoot_user failed:', (err as Error).message);
  }

  return { userId, accessToken };
}

// ============================================================================
// SSO: одноразовая ссылка, по которой агент сразу залогинен
// ============================================================================

/** GET /platform/api/v1/users/:id/login → { url }. null при ошибке. */
export async function getSsoLoginUrl(userId: string): Promise<string | null> {
  const data = await pfetch(`/platform/api/v1/users/${userId}/login`, { headers: platformHeaders() });
  return data?.url ? String(data.url) : null;
}

// ============================================================================
// Видеозвонок → диалог Chatwoot (best-effort, через Application API агента)
// ============================================================================

/** Находит/создаёт API-инбокс «VibeVox Видеозвонок» в account'е. */
async function ensureVideoInbox(accountId: string, userToken: string): Promise<string | null> {
  const base = getChatwootPlatformBaseUrl();
  try {
    const listResp = await fetch(`${base}/api/v1/accounts/${accountId}/inboxes`, { headers: appHeaders(userToken) });
    if (listResp.ok) {
      const data: any = await listResp.json().catch(() => ({}));
      const found = (data?.payload || []).find((i: any) => i?.name === VIDEO_INBOX_NAME);
      if (found?.id != null) return String(found.id);
    }
    const createResp = await fetch(`${base}/api/v1/accounts/${accountId}/inboxes`, {
      method: 'POST',
      headers: appHeaders(userToken),
      body: JSON.stringify({ name: VIDEO_INBOX_NAME, channel: { type: 'api' } }),
    });
    if (createResp.ok) {
      const data: any = await createResp.json().catch(() => ({}));
      if (data?.id != null) return String(data.id);
    }
  } catch (err) {
    console.warn('[chatwoot/platform] ensureVideoInbox failed:', (err as Error).message);
  }
  return null;
}

/**
 * Создаёт (если ещё нет) диалог Chatwoot для видеозвонок-комнаты и сохраняет
 * rooms.chatwoot_conversation_id. Канал помечается как «видеозвонок» (отдельный
 * API-инбокс). Возвращает conversationId или null. Никогда не бросает.
 */
export async function ensureVideoConversationForRoom(
  accountId: string,
  userToken: string,
  room: { id: string; name: string; chatwoot_conversation_id?: string | null },
): Promise<string | null> {
  if (room.chatwoot_conversation_id) return String(room.chatwoot_conversation_id);
  if (!userToken) return null;

  const base = getChatwootPlatformBaseUrl();
  const inboxId = await ensureVideoInbox(accountId, userToken);
  if (!inboxId) return null;

  try {
    // Контакт по стабильному identifier комнаты.
    const identifier = `vibevox-room-${room.id}`;
    let contactId: string | null = null;
    const createContact = await fetch(`${base}/api/v1/accounts/${accountId}/contacts`, {
      method: 'POST',
      headers: appHeaders(userToken),
      body: JSON.stringify({
        name: room.name || 'Гость видеозвонка',
        identifier,
        custom_attributes: { vibevox_room_id: room.id, channel: 'video_call', source: 'VibeVox' },
      }),
    });
    if (createContact.ok) {
      const cd: any = await createContact.json().catch(() => ({}));
      contactId = cd?.payload?.contact?.id != null ? String(cd.payload.contact.id) : null;
    } else if (createContact.status === 422) {
      // Контакт с таким identifier уже есть — найдём поиском.
      const sr = await fetch(
        `${base}/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(identifier)}`,
        { headers: appHeaders(userToken) },
      );
      if (sr.ok) {
        const sd: any = await sr.json().catch(() => ({}));
        const found = (sd?.payload || []).find((c: any) => c?.identifier === identifier) || (sd?.payload || [])[0];
        if (found?.id != null) contactId = String(found.id);
      }
    }
    if (!contactId) return null;

    // Диалог.
    const convResp = await fetch(`${base}/api/v1/accounts/${accountId}/conversations`, {
      method: 'POST',
      headers: appHeaders(userToken),
      body: JSON.stringify({
        source_id: `vibevox-${room.id}`,
        inbox_id: Number(inboxId),
        contact_id: Number(contactId),
        status: 'open',
      }),
    });
    if (!convResp.ok) return null;
    const conv: any = await convResp.json().catch(() => ({}));
    const conversationId = conv?.id != null ? String(conv.id) : null;
    if (!conversationId) return null;

    try {
      await pool.query(`UPDATE rooms SET chatwoot_conversation_id = $1 WHERE id = $2`, [conversationId, room.id]);
    } catch (err) {
      console.warn('[chatwoot/platform] store room conversation_id failed:', (err as Error).message);
    }
    return conversationId;
  } catch (err) {
    console.warn('[chatwoot/platform] ensureVideoConversationForRoom failed:', (err as Error).message);
    return null;
  }
}

// ============================================================================
// Оркестратор: всё вместе для кнопки «Чат»
// ============================================================================

/**
 * Готовит бесшовный вход в Chatwoot для агента по конкретной комнате.
 * Возвращает null, если мост не настроен / провижининг не удался — тогда
 * вызыватель откатывается на внутренний чат VibeVox.
 */
export async function getChatwootEntryForRoom(
  tenantId: string,
  email: string,
  displayName: string,
  room: { id: string; name: string; kind?: string | null; chatwoot_conversation_id?: string | null } | null,
  lang?: string | null,
): Promise<ChatwootEntry | null> {
  if (!isPlatformConfigured()) return null;

  const accountId = await ensureTenantAccount(tenantId, displayName || email);
  if (!accountId) return null;

  // UI-язык Chatwoot = выбранный язык VibeVox (маппинг на ~40 локалей Chatwoot, иначе
  // 'en'). Best-effort, вход не блокирует. Полные 107 языков перевода чата — позже.
  if (lang) await setAccountLocale(accountId, mapToChatwootLocale(lang));

  const agent = await ensureAgentUser(tenantId, email, displayName || email, accountId);
  if (!agent) return null;

  // Видеозвонок-комната → создаём диалог (best-effort). Для каналов диалог уже есть.
  let conversationId: string | null = room?.chatwoot_conversation_id ? String(room.chatwoot_conversation_id) : null;
  if (!conversationId && room && (room.kind === 'video' || room.kind == null) && agent.accessToken) {
    conversationId = await ensureVideoConversationForRoom(accountId, agent.accessToken, room);
  }

  const ssoUrl = await getSsoLoginUrl(agent.userId);
  if (!ssoUrl) return null;

  const base = getChatwootPlatformBaseUrl();
  const deepLink = conversationId
    ? `${base}/app/accounts/${accountId}/conversations/${conversationId}`
    : `${base}/app/accounts/${accountId}/dashboard`;

  return { ssoUrl, deepLink, accountId, conversationId };
}
