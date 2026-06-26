/**
 * OMNICHANNEL Фаза 1 — обработка входящего сообщения от Chatwoot Agent Bot.
 *
 * Поток (зеркалит processQuestFlowInbound, переиспользует тот же ИИ-мозг):
 *   клиент написал в канал → Chatwoot шлёт webhook message_created →
 *   находим/создаём комнату (1 диалог = 1 комната) → ИИ-ответ (respondToClient,
 *   с vision по фото) → сохраняем сообщения → постим ответ обратно в Chatwoot →
 *   детект тегов потребностей (как в QuestFlow).
 *
 * Полировка: поддержка изображений (vision) + теги. Голос/видео — следующий шаг
 * (responder это умеет — нужно лишь скачать вложение и прокинуть транскрипт).
 */

import { findOrCreateChannelRoom, ChannelType } from '../rooms/service.js';
import { insertMessage } from '../rooms/messages.js';
import { respondToClient } from '../quest_flow/responder.js';
import { getEffectiveChatwoot, sendChatwootReply, sendChatwootMedia } from '../tenant_settings/chatwoot.js';
import { detectNeedTags, applyDetectedTags } from '../need_tags/detector.js';
import type { ChannelInbox } from './inboxes.js';
import { getChannelCaps } from './capabilities.js';
import { getActiveFlowForInbox } from '../flows/service.js';
import { getActiveSession, createSession } from '../flows/sessions.js';
import { runFlow } from '../flows/runner.js';
import { findPreset, getTenantImageConfig } from '../quest_flow/image_presets.js';
import { IMAGE_FUNCTIONS, type ImageFunctionKey } from '../quest_flow/image_functions.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { runImagePresetTransform } from '../quest_flow/image_transform.js';

export interface ChatwootInboundResult {
  ok: boolean;
  roomId?: string;
  replied?: boolean;
  skipped?: string;   // причина пропуска
  error?: string;
}

const KNOWN_CHANNELS = new Set(['telegram', 'whatsapp', 'instagram', 'facebook', 'web', 'email']);
function asChannelType(s: string | null | undefined): ChannelType {
  const v = (s || 'web').toLowerCase();
  return (KNOWN_CHANNELS.has(v) ? v : 'web') as ChannelType;
}

function extractText(payload: any): string {
  return (payload?.content ?? payload?.message?.content ?? '').toString();
}

/** Все изображения из вложений Chatwoot → base64 (vision + входы пресета, до 14). */
async function fetchImages(payload: any): Promise<{ base64: string; mime: string; url: string }[]> {
  const atts = payload?.attachments || payload?.message?.attachments || [];
  if (!Array.isArray(atts)) return [];
  const imgs = atts.filter((a: any) => a?.file_type === 'image' && a?.data_url).slice(0, 14);
  const out: { base64: string; mime: string; url: string }[] = [];
  for (const img of imgs) {
    try {
      const r = await fetch(img.data_url);
      if (!r.ok) continue;
      const ab = await r.arrayBuffer();
      out.push({
        base64: Buffer.from(ab).toString('base64'),
        mime: r.headers.get('content-type') || 'image/jpeg',
        url: img.data_url,
      });
    } catch (e) {
      console.warn('[chatwoot/inbound] image fetch failed:', (e as Error).message);
    }
  }
  return out;
}

export async function processChatwootInbound(inbox: ChannelInbox, payload: any): Promise<ChatwootInboundResult> {
  const tenantId = inbox.tenant_id;

  const conversation = payload?.conversation || {};
  const conversationId = payload?.conversation_id ?? conversation?.id ?? payload?.conversation?.id;
  const accountId = payload?.account?.id ?? payload?.account_id ?? conversation?.account_id ?? 1;
  const inboxId = inbox.chatwoot_inbox_id ?? conversation?.inbox_id ?? payload?.inbox?.id;
  const sender = payload?.sender || {};
  const senderName: string | null = sender?.name || sender?.available_name || null;
  const senderId = sender?.id != null ? String(sender.id) : null;

  if (conversationId == null) return { ok: false, skipped: 'no_conversation_id' };

  const text = extractText(payload).trim();
  const images = await fetchImages(payload);
  const image = images[0] || null;
  if (!text && images.length === 0) return { ok: false, skipped: 'no_text_no_media' };

  // 1. Комната: 1 диалог Chatwoot = 1 комната VibeVox.
  const room = await findOrCreateChannelRoom(tenantId, asChannelType(inbox.channel_type), {
    accountId: String(inboxId ?? accountId),
    conversationId: String(conversationId),
    username: senderName,
    displayName: senderName,
    chatwootConversationId: String(conversationId),
  });

  // 1.5 OMNICHANNEL Фаза 2: если у инбокса есть АКТИВНАЯ цепочка — ведём диалог
  //     по ней (раннер). Иначе — свободный ИИ-ответ (Фаза 1, ниже без изменений).
  const activeFlow = await getActiveFlowForInbox(
    tenantId,
    inbox.chatwoot_inbox_id || (inboxId != null ? String(inboxId) : null)
  );
  if (activeFlow) {
    // Входящее клиента — в историю (контекст для AI-узлов).
    try {
      await insertMessage({
        roomId: room.id,
        sender: 'client',
        source: image ? 'media' : 'chat',
        kind: image ? 'image' : 'text',
        content: text || null,
        mediaUrl: image ? image.url : null,
        mediaMime: image ? image.mime : null,
        metadata: {
          channel: inbox.channel_type,
          chatwoot_conversation_id: String(conversationId),
          chatwoot_account_id: String(accountId),
        },
      });
    } catch { /* best-effort */ }

    let session = await getActiveSession(room.id);
    if (!session) session = await createSession({ roomId: room.id, tenantId, flowId: activeFlow.id });
    if (session) {
      // Handover Protocol: после передачи оператору бот молчит 24 ч (входящее сохранено для него).
      if (session.variables?.__handoffUntil && Date.now() < Number(session.variables.__handoffUntil)) {
        return { ok: true, roomId: room.id, replied: false, skipped: 'handoff' };
      }
      const cfg = await getEffectiveChatwoot(tenantId);
      const caps = getChannelCaps(inbox.channel_type);
      const sendAdapted = async (intent: { text: string; options?: { label: string; value: string; url?: string }[]; cards?: { imageUrl?: string; title?: string; subtitle?: string; buttons?: { label: string; url?: string; value?: string }[] }[] }) => {
        // Карусель (приходит из IG-цепочки, перенаправленной на не-IG канал): деградируем
        // в последовательность «картинка + подпись + ссылки», ветвящие кнопки — input_select.
        if (intent.cards && intent.cards.length > 0) {
          for (const c of intent.cards) {
            const cap = [c.title, c.subtitle].filter(Boolean).join('\n');
            if (c.imageUrl) await sendChatwootMedia(cfg, accountId, conversationId, { url: c.imageUrl, caption: cap || undefined });
            else if (cap) await sendChatwootReply(cfg, accountId, conversationId, cap);
            const links = (c.buttons || []).filter((b) => b.url);
            if (links.length) await sendChatwootReply(cfg, accountId, conversationId, links.map((b) => `🔗 ${b.label}: ${b.url}`).join('\n'));
          }
          const branch = intent.cards.flatMap((c) => c.buttons || []).filter((b) => !b.url);
          if (branch.length > 0) {
            if (caps.maxButtons > 0 && branch.length <= caps.maxButtons) {
              await sendChatwootReply(cfg, accountId, conversationId, 'Выберите вариант:', { contentType: 'input_select', contentAttributes: { items: branch.map((b) => ({ title: b.label, value: b.value || b.label })) } });
            } else {
              await sendChatwootReply(cfg, accountId, conversationId, `Выберите вариант:\n${branch.map((b, i) => `${i + 1}. ${b.label}`).join('\n')}`);
            }
          }
          try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content: '[карусель]', metadata: { channel: inbox.channel_type, chatwoot_conversation_id: String(conversationId) } }); } catch { /* best-effort */ }
          return;
        }
        let content = intent.text;
        let contentType: string | undefined;
        let contentAttributes: any;
        const allOpts = intent.options || [];
        const linkOpts = allOpts.filter((o) => o.url);    // кнопки-ссылки → текстом (Chatwoot не умеет CTA-url)
        const replyOpts = allOpts.filter((o) => !o.url);  // обычные → быстрые ответы
        if (replyOpts.length > 0 && caps.maxButtons > 0 && replyOpts.length <= caps.maxButtons) {
          // Канал поддерживает кнопки и опций ≤ лимита → быстрые кнопки.
          contentType = 'input_select';
          contentAttributes = { items: replyOpts.map((o) => ({ title: o.label, value: o.value })) };
        } else if (replyOpts.length > 0) {
          // Деградация: нумерованный список текстом (бедный канал / опций больше лимита).
          content = `${content}\n${replyOpts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}`;
        }
        if (linkOpts.length > 0) {
          // Ссылки-кнопки уходят текстом (на прямом Meta станут CTA-url-кнопками).
          content = `${content}\n${linkOpts.map((o) => `🔗 ${o.label}: ${o.url}`).join('\n')}`;
        }
        await sendChatwootReply(cfg, accountId, conversationId, content, { contentType, contentAttributes });
        try {
          await insertMessage({
            roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content,
            metadata: { channel: inbox.channel_type, chatwoot_conversation_id: String(conversationId) },
          });
        } catch { /* best-effort */ }
      };
      await runFlow(activeFlow, session, text, {
        channelType: inbox.channel_type,
        send: sendAdapted,
        ai: async (userText: string) => {
          try {
            const r = await respondToClient({ tenantId, roomId: room.id, latestClientMessage: userText || undefined });
            return (r?.text || '').trim();
          } catch (e) {
            console.error('[chatwoot/flow] ai node failed:', (e as Error).message);
            return '';
          }
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
            const { image: out } = await runImagePresetTransform({
              apiKey, model, preset, roomId: room.id,
              clientImages: imgs.map((i) => ({ base64: i.base64, mime: i.mime })),
              clientRequest: reqText,
            });
            return { ok: true, filePath: out.filePath, url: out.mediaUrl, mime: out.mediaMime, caption: preset.replyCaption || '' };
          } catch (e) {
            console.error('[chatwoot/preset] run failed:', (e as Error).message);
            return { ok: false, error: 'Не получилось обработать изображение. Попробуйте ещё раз.' };
          }
        },
        sendMedia: async (media) => {
          const r = await sendChatwootMedia(cfg, accountId, conversationId, media);
          if (!r.ok) console.error('[chatwoot/preset] media send failed:', r.error);
          try {
            await insertMessage({
              roomId: room.id, sender: 'ai', source: 'media', kind: 'image',
              content: media.caption || null, mediaUrl: media.url || null, mediaMime: media.mime || null,
              metadata: { channel: inbox.channel_type, chatwoot_conversation_id: String(conversationId) },
            });
          } catch { /* best-effort */ }
        },
      });
      return { ok: true, roomId: room.id, replied: true };
    }
  }

  // 2. ИИ-ответ ПЕРЕД сохранением входящего (как в QuestFlow): текущее сообщение —
  //    явно (текст + фото для vision), история = предыдущие сообщения комнаты.
  let replyText = '';
  let aiError: string | null = null;
  try {
    const result = await respondToClient({
      tenantId,
      roomId: room.id,
      latestClientMessage: text || undefined,
      imageBase64: image ? image.base64 : null,
      imageMime: image ? image.mime : null,
    });
    replyText = (result?.text || '').trim();
  } catch (err) {
    aiError = (err as Error).message;
    console.error('[chatwoot/inbound] respondToClient failed:', aiError);
  }

  // 3. Сохраняем входящее сообщение клиента (всегда, даже если ИИ упал).
  let clientMsgId: string | null = null;
  try {
    const cm = await insertMessage({
      roomId: room.id,
      sender: 'client',
      source: image ? 'media' : 'chat',
      kind: image ? 'image' : 'text',
      content: text || null,
      mediaUrl: image ? image.url : null,
      mediaMime: image ? image.mime : null,
      metadata: {
        channel: inbox.channel_type,
        chatwoot_conversation_id: String(conversationId),
        chatwoot_account_id: String(accountId),
        chatwoot_message_id: payload?.id ?? null,
        chatwoot_contact_id: senderId,
      },
    });
    clientMsgId = cm.id;
  } catch (err) {
    console.warn('[chatwoot/inbound] save client msg failed:', (err as Error).message);
  }

  if (aiError) return { ok: false, roomId: room.id, error: 'ai_failed' };
  if (!replyText) return { ok: true, roomId: room.id, replied: false, skipped: 'empty_ai_reply' };

  // 4. Сохраняем ответ ИИ.
  try {
    await insertMessage({
      roomId: room.id,
      sender: 'ai',
      source: 'chat',
      kind: 'text',
      content: replyText,
      metadata: { channel: inbox.channel_type, chatwoot_conversation_id: String(conversationId) },
    });
  } catch { /* best-effort */ }

  // 5. Постим ответ обратно в диалог Chatwoot.
  const cfg = await getEffectiveChatwoot(tenantId);
  const sent = await sendChatwootReply(cfg, accountId, conversationId, replyText);
  if (!sent.ok) {
    console.error('[chatwoot/inbound] reply send failed:', sent.error);
    return { ok: false, roomId: room.id, replied: false, error: sent.error };
  }

  // 6. Теги потребностей — best-effort, не блокируют ответ (паритет с QuestFlow).
  try {
    const matches = await detectNeedTags(tenantId, `CLIENT: ${text || '(media)'}\nAI: ${replyText}`);
    if (matches.length > 0) await applyDetectedTags(room.id, clientMsgId, matches);
  } catch (err) {
    console.warn('[chatwoot/inbound] tag detection failed (continuing):', (err as Error).message);
  }

  return { ok: true, roomId: room.id, replied: true };
}
