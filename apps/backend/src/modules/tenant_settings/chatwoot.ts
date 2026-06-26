/**
 * Per-tenant Chatwoot интеграция (Раздел 4 EnterpriseSettings).
 *
 * Каждый Enterprise-tenant может задать СВОИ Chatwoot URL + access token, и
 * отправлять туда:
 *  - историю диалога с клиентом (manual: кнопка «Отправить в CRM» в чате)
 *  - присвоенные теги потребностей (как custom_attributes к контакту)
 *
 * Fallback: если у tenant'а нет per-tenant настроек, используются глобальные
 * из суперадминки (для обратной совместимости с до-Enterprise периодом).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../db/index.js';
import { encryptSecret, decryptSecret } from './encryption.js';
import { getChatwootUrl as getGlobalChatwootUrl, getChatwootToken as getGlobalChatwootToken } from '../../config/systemConfig.js';
import { listMessages } from '../rooms/messages.js';
import { listAssignedTagsForRoom } from '../need_tags/service.js';

const __cw_dir = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__cw_dir, '../../../../uploads');

export interface ChatwootConfig {
  url: string | null;
  token: string | null;
  enabled: boolean;
}

export interface ChatwootInfo {
  hasConfig: boolean;
  enabled: boolean;
  urlPreview: string | null;
  hasToken: boolean;
}

// ============================================================================
// Чтение per-tenant
// ============================================================================

export async function getTenantChatwoot(tenantId: string): Promise<ChatwootConfig> {
  try {
    const r = await pool.query(
      `SELECT chatwoot_url_encrypted, chatwoot_token_encrypted, chatwoot_enabled
       FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );
    const row = (r.rows as any[])[0];
    if (!row) return { url: null, token: null, enabled: false };
    return {
      url: decryptSecret(row.chatwoot_url_encrypted),
      token: decryptSecret(row.chatwoot_token_encrypted),
      enabled: !!row.chatwoot_enabled,
    };
  } catch {
    return { url: null, token: null, enabled: false };
  }
}

/** Effective config: per-tenant если задан + enabled, иначе глобальный из суперадминки. */
export async function getEffectiveChatwoot(tenantId: string): Promise<ChatwootConfig> {
  const t = await getTenantChatwoot(tenantId);
  if (t.url && t.token && t.enabled) return t;
  // Fallback на глобальный
  const globalUrl = getGlobalChatwootUrl();
  const globalToken = getGlobalChatwootToken();
  if (globalUrl && globalToken) {
    return { url: globalUrl, token: globalToken, enabled: true };
  }
  return { url: null, token: null, enabled: false };
}

export async function getTenantChatwootInfo(tenantId: string): Promise<ChatwootInfo> {
  const c = await getTenantChatwoot(tenantId);
  return {
    hasConfig: !!(c.url && c.token),
    enabled: c.enabled,
    urlPreview: c.url ? c.url.slice(0, 50) + (c.url.length > 50 ? '…' : '') : null,
    hasToken: !!c.token,
  };
}

// ============================================================================
// Запись per-tenant
// ============================================================================

/**
 * Анти-SSRF (M5): запрещаем не-https и приватные/локальные адреса для Chatwoot URL.
 * Закрывает очевидные векторы (http://169.254.169.254 метаданные облака, localhost,
 * приватные диапазоны). DNS-rebinding это не покрывает — для полной защиты нужна
 * проверка на резолве, но для tenant-задаваемого URL это уже отсекает основное.
 */
function assertSafeChatwootUrl(url: string | null): void {
  if (!url) return;
  let u: URL;
  try { u = new URL(url); } catch { throw new Error('Chatwoot URL некорректен'); }
  if (u.protocol !== 'https:') throw new Error('Chatwoot URL должен использовать https://');
  const host = u.hostname.toLowerCase();
  const blocked =
    host === 'localhost' || host === '0.0.0.0' || host.endsWith('.local') ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd');
  if (blocked) throw new Error('Chatwoot URL не может указывать на локальный/приватный адрес');
}

export async function setTenantChatwoot(
  tenantId: string,
  url: string | null,
  token: string | null,
  enabled?: boolean
): Promise<void> {
  assertSafeChatwootUrl(url); // M5: анти-SSRF (https-only, без приватных адресов)
  const encUrl = encryptSecret(url);
  const encToken = encryptSecret(token);
  // 3-param + 1-trail tenant_id = 4 значения. Если enabled передан — обновляем и его.
  if (enabled !== undefined) {
    await pool.query(
      `UPDATE tenants
       SET chatwoot_url_encrypted = $1, chatwoot_token_encrypted = $2, chatwoot_enabled = $3
       WHERE id = $4`,
      [encUrl, encToken, !!enabled, tenantId]
    );
  } else {
    await pool.query(
      `UPDATE tenants
       SET chatwoot_url_encrypted = $1, chatwoot_token_encrypted = $2
       WHERE id = $3`,
      [encUrl, encToken, tenantId]
    );
  }
}

export async function setTenantChatwootEnabled(tenantId: string, enabled: boolean): Promise<void> {
  await pool.query(
    `UPDATE tenants SET chatwoot_enabled = $1 WHERE id = $2`,
    [!!enabled, tenantId]
  );
}

// ============================================================================
// Test connection
// ============================================================================

export interface ChatwootTestResult {
  ok: boolean;
  error?: string;
  detail?: string;
}

/**
 * Простой ping: GET /api/v1/profile с токеном. Если 200 — токен валидный.
 */
export async function testChatwootConnection(config: ChatwootConfig): Promise<ChatwootTestResult> {
  if (!config.url || !config.token) {
    return { ok: false, error: 'URL и token обязательны' };
  }
  try {
    const url = config.url.replace(/\/+$/, '') + '/api/v1/profile';
    const resp = await fetch(url, {
      headers: { 'api_access_token': config.token, 'Content-Type': 'application/json' },
    });
    if (resp.ok) return { ok: true };
    const body = await resp.text().catch(() => '');
    return { ok: false, error: `HTTP ${resp.status}`, detail: body.slice(0, 200) };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ============================================================================
// Push to Chatwoot
// ============================================================================

/**
 * Отправляет историю диалога + теги клиента в Chatwoot.
 *
 * Стратегия:
 *  1. Ищем контакт по telegram_user_id в custom_attributes.
 *  2. Если нет — создаём (используя telegram_username / display_name).
 *  3. Создаём conversation (или находим существующий по контакту).
 *  4. Шлём в conversation outgoing-сообщение с историей.
 *  5. Обновляем custom_attributes контакта тегами потребностей.
 *
 * Возвращает {ok, contactId, conversationId, sentTagCount, error?}.
 */
export interface PushResult {
  ok: boolean;
  contactId?: number;
  conversationId?: number;
  sentTagCount?: number;
  error?: string;
}

export async function pushRoomToChatwoot(tenantId: string, roomId: string): Promise<PushResult> {
  const cfg = await getEffectiveChatwoot(tenantId);
  if (!cfg.url || !cfg.token || !cfg.enabled) {
    return { ok: false, error: 'Chatwoot не настроен или отключён для этого аккаунта.' };
  }

  // Подгружаем room metadata
  const roomRes = await pool.query(
    `SELECT id, name, kind, telegram_user_id, telegram_username, telegram_display_name
     FROM rooms WHERE id = $1 LIMIT 1`,
    [roomId]
  );
  const room = (roomRes.rows as any[])[0];
  if (!room) return { ok: false, error: 'Комната не найдена' };

  const messages = await listMessages(roomId, 500);
  const tags = await listAssignedTagsForRoom(roomId);

  const baseUrl = cfg.url.replace(/\/+$/, '');
  const headers = { 'api_access_token': cfg.token, 'Content-Type': 'application/json' };

  // Account ID — простой подход: 1 (для большинства self-hosted). Можно вынести в settings.
  const accountId = 1;

  try {
    // 1. Найти контакт по telegram_user_id (через search)
    let contactId: number | null = null;
    if (room.telegram_user_id) {
      const searchUrl = `${baseUrl}/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(String(room.telegram_user_id))}`;
      const sr = await fetch(searchUrl, { headers });
      if (sr.ok) {
        const sd: any = await sr.json();
        const found = sd?.payload?.find((c: any) =>
          c.custom_attributes?.telegram_user_id === String(room.telegram_user_id)
        );
        if (found) contactId = found.id;
      }
    }

    // 2. Создать контакт если не существует
    if (!contactId) {
      const name = room.telegram_display_name ||
                   (room.telegram_username ? `@${room.telegram_username}` : `Клиент ${room.telegram_user_id || roomId.slice(0, 8)}`);
      const createUrl = `${baseUrl}/api/v1/accounts/${accountId}/contacts`;
      const cr = await fetch(createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          identifier: room.telegram_user_id || roomId,
          custom_attributes: {
            telegram_user_id: room.telegram_user_id || null,
            telegram_username: room.telegram_username || null,
            vibevox_room_id: roomId,
            source: 'VibeVox',
          },
        }),
      });
      if (cr.ok) {
        const cd: any = await cr.json();
        contactId = cd?.payload?.contact?.id || cd?.id || null;
      }
    }
    if (!contactId) return { ok: false, error: 'Не удалось создать/найти контакт в Chatwoot' };

    // 3. Создаём conversation (inbox_id = 1 — простой self-hosted default)
    const convCreateUrl = `${baseUrl}/api/v1/accounts/${accountId}/conversations`;
    const convRes = await fetch(convCreateUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source_id: `vibevox-${roomId}`,
        inbox_id: 1,
        contact_id: contactId,
        status: 'open',
      }),
    });
    let conversationId: number | null = null;
    if (convRes.ok) {
      const cd: any = await convRes.json();
      conversationId = cd?.id || null;
    }

    // 4. Отправляем сводное сообщение с историей
    if (conversationId) {
      const historyLines = messages
        .filter((m) => m.content)
        .map((m) => `[${m.sender.toUpperCase()}]: ${m.content}`)
        .join('\n');
      const tagsBlock = tags.length > 0
        ? `\n\n📌 Теги потребностей:\n${tags.map((t) => `• ${t.name}${t.confidence ? ` (${Math.round(t.confidence * 100)}%)` : ''}`).join('\n')}`
        : '';
      const noteContent = `## История диалога VibeVox\n\n${historyLines || '(пусто)'}${tagsBlock}`;

      const msgUrl = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
      await fetch(msgUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: noteContent.slice(0, 12000),
          message_type: 'outgoing',
          private: true, // приватная заметка — не уходит клиенту
        }),
      });
    }

    // 5. Обновляем custom_attributes контакта тегами
    if (tags.length > 0) {
      const updateUrl = `${baseUrl}/api/v1/accounts/${accountId}/contacts/${contactId}`;
      const attrPatch: any = {
        vibevox_tags: tags.map((t) => t.name).join(', '),
        vibevox_last_sync: new Date().toISOString(),
      };
      await fetch(updateUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ custom_attributes: attrPatch }),
      });

      // Помечаем все теги как sent_to_crm
      for (const t of tags) {
        try {
          await pool.query(`UPDATE client_tag_assignments SET sent_to_crm = TRUE WHERE id = $1`, [t.id]);
        } catch {}
      }
    }

    return {
      ok: true,
      contactId,
      conversationId: conversationId || undefined,
      sentTagCount: tags.length,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ============================================================================
// OMNICHANNEL Фаза 1 — ответ Agent Bot в диалог Chatwoot.
// Webhook-обработчик: клиент написал → ИИ сгенерировал ответ → постим его сюда.
// ============================================================================

export interface ChatwootSendResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Отправляет исходящее сообщение в существующий диалог Chatwoot.
 * @param config         Chatwoot URL + token (getEffectiveChatwoot)
 * @param accountId      ID аккаунта Chatwoot (из payload вебхука)
 * @param conversationId ID диалога (из payload вебхука)
 * @param content        текст ответа
 * @param opts.private   приватная заметка (по умолчанию false — уходит клиенту)
 */
export async function sendChatwootReply(
  config: ChatwootConfig,
  accountId: number | string,
  conversationId: number | string,
  content: string,
  opts: { private?: boolean; contentType?: string; contentAttributes?: any } = {}
): Promise<ChatwootSendResult> {
  if (!config.url || !config.token) {
    return { ok: false, error: 'Chatwoot URL/token не заданы' };
  }
  if (!content || !content.trim()) {
    return { ok: false, error: 'Пустой текст ответа' };
  }
  const baseUrl = config.url.replace(/\/+$/, '');
  const headers = { 'api_access_token': config.token, 'Content-Type': 'application/json' };
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
  try {
    const body: Record<string, any> = {
      content: content.slice(0, 12000),
      message_type: 'outgoing',
      private: opts.private === true,
    };
    // Интерактив (кнопки): content_type='input_select' + items в content_attributes.
    if (opts.contentType) body.content_type = opts.contentType;
    if (opts.contentAttributes) body.content_attributes = opts.contentAttributes;
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return { ok: false, error: `HTTP ${resp.status}: ${body.slice(0, 200)}` };
    }
    const data: any = await resp.json().catch(() => ({}));
    return { ok: true, messageId: data?.id };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Отправляет ИЗОБРАЖЕНИЕ (вложение) в диалог Chatwoot — multipart с attachments[].
 * Байты берём с диска (filePath, приоритет) или скачиваем по url.
 * Используется блоком-пресетом конструктора для доставки сгенерированной картинки.
 */
export async function sendChatwootMedia(
  config: ChatwootConfig,
  accountId: number | string,
  conversationId: number | string,
  media: { filePath?: string; url?: string; mime?: string; caption?: string }
): Promise<ChatwootSendResult> {
  if (!config.url || !config.token) {
    return { ok: false, error: 'Chatwoot URL/token не заданы' };
  }
  const baseUrl = config.url.replace(/\/+$/, '');
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;
  try {
    let buf: Buffer | null = null;
    let mime = media.mime || 'image/png';
    // Локальный файл: явный filePath ИЛИ относительный /uploads/... (загруженное медиа) → читаем с диска.
    let diskPath: string | null = media.filePath || null;
    if (!diskPath && media.url && media.url.startsWith('/uploads/')) {
      diskPath = path.join(UPLOADS_ROOT, media.url.replace(/^\/uploads\//, ''));
    }
    if (diskPath) {
      try { buf = fs.readFileSync(diskPath); } catch { buf = null; }
    }
    if (!buf && media.url && /^https?:\/\//i.test(media.url)) {
      const r = await fetch(media.url);
      if (r.ok) { buf = Buffer.from(await r.arrayBuffer()); mime = r.headers.get('content-type') || mime; }
    }
    if (!buf) return { ok: false, error: 'Не удалось прочитать файл' };

    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const form = new FormData();
    form.append('message_type', 'outgoing');
    if (media.caption && media.caption.trim()) form.append('content', media.caption.slice(0, 4000));
    form.append('attachments[]', new Blob([new Uint8Array(buf)], { type: mime }), `vibevox-image.${ext}`);

    // Content-Type НЕ ставим — fetch сам выставит boundary для multipart.
    const resp = await fetch(url, { method: 'POST', headers: { 'api_access_token': config.token }, body: form });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return { ok: false, error: `HTTP ${resp.status}: ${t.slice(0, 200)}` };
    }
    const data: any = await resp.json().catch(() => ({}));
    return { ok: true, messageId: data?.id };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
