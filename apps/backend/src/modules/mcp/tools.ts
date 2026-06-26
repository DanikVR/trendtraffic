/**
 * Набор MCP-инструментов Фазы 0 (read + базовые действия). Всё переиспользует
 * существующие сервисы и строго привязано к tenantId из ctx — никакой кросс-аккаунт
 * утечки. Новые блоки добавляют свои тулзы тем же registerTool().
 */

import pool from '../../db/index.js';
import { listMessages, insertMessage } from '../rooms/messages.js';
import { listTags, listAssignedTagsForRoom } from '../need_tags/service.js';
import { getTenantImageConfig } from '../quest_flow/image_presets.js';
import { runImagePresetTransform } from '../quest_flow/image_transform.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { registerTool, type McpToolContext } from './registry.js';

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
function toAbsoluteUrl(u: string | null): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (!PUBLIC_BASE_URL) return u;
  return `${PUBLIC_BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}

/** Проверяет, что комната принадлежит этому tenant'у. Возвращает row или null. */
async function getOwnedRoom(tenantId: string, roomId: string): Promise<any | null> {
  if (!roomId) return null;
  const r = await pool.query(
    `SELECT id, creator_tenant_id, kind, telegram_username, telegram_display_name, telegram_user_id
     FROM rooms WHERE id = $1 LIMIT 1`,
    [roomId]
  );
  const row = (r.rows as any[])[0];
  if (!row || row.creator_tenant_id !== tenantId) return null;
  return row;
}

// ── clients:read — список клиентов/лидов (telegram_chat-комнаты) ──────────────
registerTool({
  name: 'list_clients',
  title: 'Список клиентов',
  description: 'Возвращает клиентов/лидов аккаунта (Telegram-диалоги Quest Flow): id комнаты, имя, username, дата создания.',
  requiredScopes: ['clients:read'],
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Сколько вернуть (по умолчанию 100, макс 500).' },
    },
  },
  handler: async (ctx: McpToolContext, args) => {
    const limit = Math.max(1, Math.min(500, Number(args?.limit) || 100));
    const r = await pool.query(`SELECT * FROM rooms WHERE creator_tenant_id = $1`, [ctx.tenantId]);
    const rooms = (r.rows as any[])
      .filter((x) => x.kind === 'telegram_chat')
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limit)
      .map((x) => ({
        roomId: x.id,
        username: x.telegram_username || null,
        displayName: x.telegram_display_name || null,
        telegramUserId: x.telegram_user_id || null,
        createdAt: x.created_at,
      }));
    return { count: rooms.length, clients: rooms };
  },
});

// ── dialogs:read — история диалога + присвоенные теги ─────────────────────────
registerTool({
  name: 'get_dialog',
  title: 'История диалога',
  description: 'Возвращает сообщения комнаты (клиент/AI/админ) и присвоенные клиенту теги потребностей.',
  requiredScopes: ['dialogs:read'],
  inputSchema: {
    type: 'object',
    properties: {
      roomId: { type: 'string', description: 'ID комнаты (из list_clients).' },
      limit: { type: 'number', description: 'Сколько последних сообщений (по умолчанию 50).' },
    },
    required: ['roomId'],
  },
  handler: async (ctx: McpToolContext, args) => {
    const roomId = String(args?.roomId || '');
    const room = await getOwnedRoom(ctx.tenantId, roomId);
    if (!room) throw new Error('Комната не найдена или не принадлежит аккаунту');
    const limit = Math.max(1, Math.min(500, Number(args?.limit) || 50));
    const msgs = await listMessages(roomId, limit);
    const tags = await listAssignedTagsForRoom(roomId).catch(() => []);
    return {
      roomId,
      messages: msgs.map((m) => ({
        sender: m.sender,
        kind: m.kind,
        content: m.content,
        mediaUrl: toAbsoluteUrl(m.mediaUrl),
        createdAt: m.createdAt,
      })),
      tags,
    };
  },
});

// ── messages:write — отправить текст клиенту (через outbox → Telegram) ─────────
registerTool({
  name: 'send_message',
  title: 'Отправить сообщение клиенту',
  description: 'Ставит текстовое сообщение в исходящую очередь клиенту (доставит Quest Flow в Telegram).',
  requiredScopes: ['messages:write'],
  inputSchema: {
    type: 'object',
    properties: {
      roomId: { type: 'string', description: 'ID комнаты клиента.' },
      text: { type: 'string', description: 'Текст сообщения.' },
    },
    required: ['roomId', 'text'],
  },
  handler: async (ctx: McpToolContext, args) => {
    const roomId = String(args?.roomId || '');
    const text = String(args?.text || '').trim();
    if (!text) throw new Error('text обязателен');
    const room = await getOwnedRoom(ctx.tenantId, roomId);
    if (!room) throw new Error('Комната не найдена или не принадлежит аккаунту');
    if (room.kind !== 'telegram_chat') throw new Error('Отправка возможна только в Telegram-диалоги');
    const msg = await insertMessage({
      roomId,
      sender: 'admin',
      source: 'chat',
      kind: 'text',
      content: text.slice(0, 4000),
      metadata: { outbox_status: 'pending', via: 'mcp' },
    });
    return { ok: true, messageId: msg.id };
  },
});

// ── images:read — каталог пресетов изображений ───────────────────────────────
registerTool({
  name: 'list_image_presets',
  title: 'Пресеты изображений',
  description: 'Возвращает выбранную модель и список пресетов («блоков обработки») с их preset_key и функцией.',
  requiredScopes: ['images:read'],
  inputSchema: { type: 'object', properties: {} },
  handler: async (ctx: McpToolContext) => {
    const cfg = await getTenantImageConfig(ctx.tenantId);
    return {
      model: cfg.model,
      presets: cfg.presets.map((p) => ({
        presetKey: p.presetKey,
        label: p.label,
        function: p.function,
        needsClientImage: p.imageSource === 'client',
        enabled: p.enabled,
      })),
    };
  },
});

// ── images:generate — сгенерировать/обработать картинку по пресету ────────────
registerTool({
  name: 'generate_image',
  title: 'Сгенерировать изображение',
  description: 'Запускает пресет обработки изображения по preset_key и возвращает абсолютный URL результата.',
  requiredScopes: ['images:generate'],
  inputSchema: {
    type: 'object',
    properties: {
      presetKey: { type: 'string', description: 'Ключ пресета (из list_image_presets).' },
      text: { type: 'string', description: 'Текст-запрос / описание (опц.).' },
      imageBase64: { type: 'string', description: 'Входное фото base64 (для функций правки, опц.).' },
      imageMime: { type: 'string', description: 'MIME входного фото, напр. image/jpeg.' },
    },
    required: ['presetKey'],
  },
  handler: async (ctx: McpToolContext, args) => {
    const presetKey = String(args?.presetKey || '');
    const cfg = await getTenantImageConfig(ctx.tenantId);
    const preset = cfg.presets.find((p) => p.presetKey === presetKey && p.enabled);
    if (!preset) throw new Error(`Пресет "${presetKey}" не найден или выключен`);
    const apiKey = await getEffectiveGeminiKey(ctx.tenantId);
    if (!apiKey) throw new Error('Gemini API ключ не задан (раздел «Gemini API»).');

    const clientImages: Array<{ base64: string; mime: string }> = [];
    if (typeof args?.imageBase64 === 'string' && args.imageBase64.trim()) {
      const raw = args.imageBase64;
      const cleaned = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
      clientImages.push({ base64: cleaned, mime: String(args?.imageMime || 'image/jpeg') });
    }

    const { image } = await runImagePresetTransform({
      apiKey,
      model: cfg.model,
      preset,
      roomId: '',
      clientImages,
      clientRequest: String(args?.text || ''),
    });
    return { imageUrl: toAbsoluteUrl(image.mediaUrl), imageMime: image.mediaMime };
  },
});

// ── tags:read — каталог тегов потребностей ───────────────────────────────────
registerTool({
  name: 'list_tags',
  title: 'Теги потребностей',
  description: 'Возвращает каталог тегов потребностей аккаунта (CRM-сигналы).',
  requiredScopes: ['tags:read'],
  inputSchema: { type: 'object', properties: {} },
  handler: async (ctx: McpToolContext) => {
    const tags = await listTags(ctx.tenantId);
    return { count: tags.length, tags };
  },
});
