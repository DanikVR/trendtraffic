/**
 * WhatsApp (Cloud API) — обработка входящего.
 *
 * Зеркалит ig/tt_inbound: тот же раннер + свободный ИИ + пресеты + теги.
 * WA-специфика: окно 24ч (openWaWindow на входящем; вне окна свободные отправки
 * блокируются — нужен шаблон, фаза WA-1); reply-кнопки ≤3 → авто-промоушн в список
 * при >3; CTA-url(1)/звонок/копи-код в сессии = текстом (полноценно — шаблоны WA-1);
 * obработка opt-out (стоп/отписка → бот замолкает). Скорость WA не банит — пейсинга нет.
 */

import type { WaConfig } from './wa_config.js';
import { sendWaText, sendWaButtons, sendWaList, sendWaCtaUrl, sendWaMedia } from './wa_client.js';
import { openWaWindow } from './wa_window.js';
import { findOrCreateChannelRoom } from '../../rooms/service.js';
import { insertMessage } from '../../rooms/messages.js';
import { respondToClient } from '../../quest_flow/responder.js';
import { detectNeedTags, applyDetectedTags } from '../../need_tags/detector.js';
import { getActiveFlowForChannel } from '../../flows/service.js';
import { getActiveSession, createSession, saveSession } from '../../flows/sessions.js';
import { runFlow, type FlowRunContext } from '../../flows/runner.js';
import { findPreset, getTenantImageConfig } from '../../quest_flow/image_presets.js';
import { IMAGE_FUNCTIONS, type ImageFunctionKey } from '../../quest_flow/image_functions.js';
import { getEffectiveGeminiKey } from '../../tenant_settings/gemini.js';
import { runImagePresetTransform } from '../../quest_flow/image_transform.js';

const CHANNEL = 'whatsapp';
const API = (process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v21.0').replace(/\/+$/, '');
const OPT_OUT = ['стоп', 'stop', 'отписаться', 'отписка', 'unsubscribe', 'отпишись', 'не писать'];

export interface WaInboundResult { ok: boolean; roomId?: string; replied?: boolean; skipped?: string; error?: string }

/** Скачивает медиа WhatsApp по media-id (2 шага: метаданные → файл, оба с Bearer). */
async function fetchWaMedia(cfg: WaConfig, mediaId: string): Promise<{ base64: string; mime: string; url: string } | null> {
  try {
    const m = await fetch(`${API}/${mediaId}`, { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
    if (!m.ok) return null;
    const meta: any = await m.json().catch(() => null);
    if (!meta?.url) return null;
    const f = await fetch(meta.url, { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
    if (!f.ok) return null;
    const ab = await f.arrayBuffer();
    return { base64: Buffer.from(ab).toString('base64'), mime: meta.mime_type || f.headers.get('content-type') || 'image/jpeg', url: meta.url };
  } catch (e) {
    console.warn('[wa/inbound] media fetch failed:', (e as Error).message);
    return null;
  }
}

function actionsToText(actions: { label: string; url?: string; phone?: string; code?: string }[]): string {
  return actions
    .map((a) => (a.url ? `🔗 ${a.label}: ${a.url}` : a.phone ? `📞 ${a.label}: ${a.phone}` : a.code ? `🏷 ${a.label}: ${a.code}` : ''))
    .filter(Boolean)
    .join('\n');
}

function buildWaCtx(cfg: WaConfig, waId: string, room: { id: string }, images: { base64: string; mime: string }[]): FlowRunContext {
  const tenantId = cfg.tenantId;
  const save = (content: string) => insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content, metadata: { channel: CHANNEL, wa_id: waId } }).catch(() => {});
  return {
    channelType: CHANNEL,
    send: async (intent) => {
      // Список выбора.
      if (intent.list && intent.list.rows.length > 0) {
        const r = await sendWaList(cfg, waId, intent.text || ' ', intent.list.menuLabel || 'Выбрать', intent.list.rows);
        if (!r.ok) console.error('[wa/flow] list failed:', r.error);
        save('[список]'); return;
      }
      // Карусель (IG-only блок) на WA не поддержана → деградируем в картинки+подписи.
      if (intent.cards && intent.cards.length > 0) {
        for (const c of intent.cards) {
          if (c.imageUrl) await sendWaMedia(cfg, waId, { url: c.imageUrl, type: 'image', caption: [c.title, c.subtitle].filter(Boolean).join('\n') || undefined });
          const links = (c.buttons || []).filter((b) => b.url).map((b) => `🔗 ${b.label}: ${b.url}`).join('\n');
          if (links) await sendWaText(cfg, waId, links);
        }
        save('[карусель→медиа]'); return;
      }
      const text = intent.text || '';
      const reply = (intent.options || []).filter((o) => !o.url && !o.phone && !o.code);
      const actions = (intent.options || []).filter((o) => o.url || o.phone || o.code);
      if (reply.length > 0) {
        // ≤3 → кнопки; >3 → авто-промоушн в список.
        if (reply.length <= 3) await sendWaButtons(cfg, waId, text || ' ', reply.map((o) => ({ id: o.value, title: o.label })));
        else await sendWaList(cfg, waId, text || ' ', 'Выбрать', reply.map((o) => ({ id: o.value, title: o.label })));
        if (actions.length) await sendWaText(cfg, waId, actionsToText(actions));
      } else if (actions.length === 1 && actions[0].url) {
        await sendWaCtaUrl(cfg, waId, text || ' ', actions[0].label, actions[0].url);
      } else {
        const body = [text, actions.length ? actionsToText(actions) : ''].filter(Boolean).join('\n');
        if (body) await sendWaText(cfg, waId, body);
      }
      save(text);
    },
    ai: async (userText: string) => {
      try { const r = await respondToClient({ tenantId, roomId: room.id, latestClientMessage: userText || undefined }); return (r?.text || '').trim(); }
      catch (e) { console.error('[wa/flow] ai node failed:', (e as Error).message); return ''; }
    },
    inboundImages: images.map((im) => ({ base64: im.base64, mime: im.mime })),
    getPresetMeta: async (presetKey: string) => {
      const p = await findPreset(tenantId, presetKey);
      if (!p) return null;
      const fn = IMAGE_FUNCTIONS[p.function as ImageFunctionKey];
      return { clientImages: fn?.clientImages ?? 1, intake: p.intakePrompt || fn?.defaultIntake || '' };
    },
    runPreset: async (presetKey, imgs, reqText) => {
      try {
        const preset = await findPreset(tenantId, presetKey);
        if (!preset) return { ok: false, error: 'Пресет не найден.' };
        const apiKey = await getEffectiveGeminiKey(tenantId);
        if (!apiKey) return { ok: false, error: 'ИИ-ключ не настроен (раздел Gemini API).' };
        const { model } = await getTenantImageConfig(tenantId);
        const { image: out } = await runImagePresetTransform({ apiKey, model, preset, roomId: room.id, clientImages: imgs.map((i) => ({ base64: i.base64, mime: i.mime })), clientRequest: reqText });
        return { ok: true, filePath: out.filePath, url: out.mediaUrl, mime: out.mediaMime, caption: preset.replyCaption || '' };
      } catch (e) { console.error('[wa/preset] run failed:', (e as Error).message); return { ok: false, error: 'Не получилось обработать изображение. Попробуйте ещё раз.' }; }
    },
    sendMedia: async (media) => {
      const r = await sendWaMedia(cfg, waId, { url: media.url, type: 'image', caption: media.caption });
      if (!r.ok) console.error('[wa/preset] media send failed:', r.error);
      insertMessage({ roomId: room.id, sender: 'ai', source: 'media', kind: 'image', content: media.caption || null, mediaUrl: media.url || null, mediaMime: media.mime || null, metadata: { channel: CHANNEL, wa_id: waId } }).catch(() => {});
    },
  };
}

/** Один inbound-message WhatsApp (value.messages[i]) + contacts для имени. */
export async function processWhatsAppMessage(cfg: WaConfig, msg: any, contact: any): Promise<WaInboundResult> {
  const tenantId = cfg.tenantId;
  const waId = msg?.from != null ? String(msg.from) : null;
  if (!waId) return { ok: false, skipped: 'no_from' };

  // Текст: кнопка/список → их id (= value опции) для точного матча.
  const text = String(
    msg?.text?.body ??
    msg?.interactive?.button_reply?.id ??
    msg?.interactive?.list_reply?.id ??
    msg?.button?.payload ??
    ''
  ).trim();

  // Медиа (image/video/document — берём image для vision/пресетов).
  const images: { base64: string; mime: string; url: string }[] = [];
  const mediaId = msg?.image?.id || msg?.video?.id || msg?.document?.id;
  if (msg?.image?.id) { const im = await fetchWaMedia(cfg, msg.image.id); if (im) images.push(im); }
  const image = images[0] || null;
  if (!text && !mediaId) return { ok: false, skipped: 'no_text_no_media' };

  // Входящее → открыть/продлить окно 24ч.
  openWaWindow(cfg.phoneNumberId, waId);

  const room = await findOrCreateChannelRoom(tenantId, CHANNEL, { accountId: cfg.phoneNumberId, conversationId: waId, username: contact?.profile?.name || null, displayName: contact?.profile?.name || null });

  // Opt-out: клиент просит не писать → бот замолкает (анти-жалоба), одно подтверждение.
  if (text && OPT_OUT.includes(text.toLowerCase())) {
    try { await insertMessage({ roomId: room.id, sender: 'client', source: 'chat', kind: 'text', content: text, metadata: { channel: CHANNEL, wa_id: waId, opt_out: true } }); } catch { /* */ }
    const session = await getActiveSession(room.id); // пауза персистится, если есть активная цепочка
    if (session) {
      session.variables = session.variables || {};
      session.variables.__handoffUntil = Date.now() + 365 * 24 * 60 * 60 * 1000;
      try { await saveSession(session); } catch { /* */ }
    }
    await sendWaText(cfg, waId, 'Окей, больше не пишу. Если что — напишите сами 🙌');
    return { ok: true, roomId: room.id, replied: true, skipped: 'opt_out' };
  }

  const activeFlow = await getActiveFlowForChannel(tenantId, CHANNEL);
  if (activeFlow) {
    try { await insertMessage({ roomId: room.id, sender: 'client', source: image ? 'media' : 'chat', kind: image ? 'image' : 'text', content: text || null, mediaUrl: image ? image.url : null, mediaMime: image ? image.mime : null, metadata: { channel: CHANNEL, wa_id: waId, wa_phone_id: cfg.phoneNumberId } }); } catch { /* */ }
    let session = await getActiveSession(room.id);
    if (!session) session = await createSession({ roomId: room.id, tenantId, flowId: activeFlow.id });
    if (session) {
      if (session.variables?.__handoffUntil && Date.now() < Number(session.variables.__handoffUntil)) {
        return { ok: true, roomId: room.id, replied: false, skipped: 'handoff' };
      }
      await runFlow(activeFlow, session, text, buildWaCtx(cfg, waId, room, images));
      return { ok: true, roomId: room.id, replied: true };
    }
  }

  // Нет цепочки → свободный ИИ.
  let replyText = '';
  let aiError: string | null = null;
  try {
    const result = await respondToClient({ tenantId, roomId: room.id, latestClientMessage: text || undefined, imageBase64: image ? image.base64 : null, imageMime: image ? image.mime : null });
    replyText = (result?.text || '').trim();
  } catch (err) { aiError = (err as Error).message; console.error('[wa/inbound] respondToClient failed:', aiError); }

  let clientMsgId: string | null = null;
  try {
    const cm = await insertMessage({ roomId: room.id, sender: 'client', source: image ? 'media' : 'chat', kind: image ? 'image' : 'text', content: text || null, mediaUrl: image ? image.url : null, mediaMime: image ? image.mime : null, metadata: { channel: CHANNEL, wa_id: waId, wa_phone_id: cfg.phoneNumberId } });
    clientMsgId = cm.id;
  } catch (err) { console.warn('[wa/inbound] save client msg failed:', (err as Error).message); }

  if (aiError) return { ok: false, roomId: room.id, error: 'ai_failed' };
  if (!replyText) return { ok: true, roomId: room.id, replied: false, skipped: 'empty_ai_reply' };

  try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content: replyText, metadata: { channel: CHANNEL, wa_id: waId } }); } catch { /* */ }
  const sent = await sendWaText(cfg, waId, replyText);
  if (!sent.ok) { console.error('[wa/inbound] reply send failed:', sent.error); return { ok: false, roomId: room.id, replied: false, error: sent.error }; }

  try {
    const matches = await detectNeedTags(tenantId, `CLIENT: ${text || '(media)'}\nAI: ${replyText}`);
    if (matches.length > 0) await applyDetectedTags(room.id, clientMsgId, matches);
  } catch (err) { console.warn('[wa/inbound] tag detection failed (continuing):', (err as Error).message); }

  return { ok: true, roomId: room.id, replied: true };
}
