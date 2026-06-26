/**
 * Instagram (прямой Graph API) — IG-0. Обработка входящего DM.
 *
 * Зеркалит processChatwootInbound, но транспорт — Send API напрямую (ig_client),
 * а не Chatwoot. Мозг переиспользуется полностью: цепочки (runFlow), свободный
 * ИИ (respondToClient + vision), пресеты картинок, теги потребностей.
 *
 * Вебхук-событие messaging[]:
 *   { sender:{id:<IGSID>}, recipient:{id:<IG_ID>}, message:{ mid, text,
 *     quick_reply:{payload}, attachments:[{type,payload:{url}}], is_echo } }
 */

import type { IgConfig } from './ig_config.js';
import { sendInstagramText, sendInstagramMedia, sendInstagramCarousel, getInstagramFollowStatus, replyToInstagramComment, sendInstagramPrivateReply, sendInstagramTypingOn, type IgQuickReply } from './ig_client.js';
import type { CarouselCard, FlowRunContext } from '../../flows/runner.js';
import { findOrCreateChannelRoom } from '../../rooms/service.js';
import { insertMessage } from '../../rooms/messages.js';
import { respondToClient } from '../../quest_flow/responder.js';
import { detectNeedTags, applyDetectedTags } from '../../need_tags/detector.js';
import { getChannelCaps } from '../capabilities.js';
import { getActiveFlowForChannel } from '../../flows/service.js';
import { getActiveSession, createSession } from '../../flows/sessions.js';
import { runFlow } from '../../flows/runner.js';
import { findPreset, getTenantImageConfig } from '../../quest_flow/image_presets.js';
import { IMAGE_FUNCTIONS, type ImageFunctionKey } from '../../quest_flow/image_functions.js';
import { getEffectiveGeminiKey } from '../../tenant_settings/gemini.js';
import { runImagePresetTransform } from '../../quest_flow/image_transform.js';

const CHANNEL = 'instagram';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Все изображения из вложений события → base64 (vision + входы пресета, до 14). */
async function fetchIgImages(ev: any): Promise<{ base64: string; mime: string; url: string }[]> {
  const atts = ev?.message?.attachments;
  if (!Array.isArray(atts)) return [];
  const imgs = atts
    .filter((a: any) => (a?.type === 'image' || a?.type === 'story_mention') && a?.payload?.url)
    .slice(0, 14);
  const out: { base64: string; mime: string; url: string }[] = [];
  for (const a of imgs) {
    try {
      const r = await fetch(a.payload.url);
      if (!r.ok) continue;
      const ab = await r.arrayBuffer();
      out.push({
        base64: Buffer.from(ab).toString('base64'),
        mime: r.headers.get('content-type') || 'image/jpeg',
        url: a.payload.url,
      });
    } catch (e) {
      console.warn('[ig/inbound] image fetch failed:', (e as Error).message);
    }
  }
  return out;
}

export interface IgInboundResult { ok: boolean; roomId?: string; replied?: boolean; skipped?: string; error?: string }

/** Адаптирует SendIntent под IG: текст + быстрые ответы (url-кнопки → текстом). */
function igAdaptIntent(intent: { text?: string; options?: { label: string; value: string; url?: string }[] }, caps: { maxButtons: number }): { content: string; quickReplies?: IgQuickReply[] } {
  let content = intent.text || '';
  const allOpts = intent.options || [];
  const linkOpts = allOpts.filter((o) => o.url);
  const replyOpts = allOpts.filter((o) => !o.url);
  let quickReplies: IgQuickReply[] | undefined;
  if (replyOpts.length > 0 && caps.maxButtons > 0 && replyOpts.length <= caps.maxButtons) {
    quickReplies = replyOpts.map((o) => ({ title: o.label, payload: o.value }));
  } else if (replyOpts.length > 0) {
    content = `${content}\n${replyOpts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}`;
  }
  if (linkOpts.length > 0) content = `${content}\n${linkOpts.map((o) => `🔗 ${o.label}: ${o.url}`).join('\n')}`;
  return { content, quickReplies };
}

/** Контекст раннера для IG (DM и comment-to-DM используют общий). */
function buildIgCtx(cfg: IgConfig, igsid: string, room: { id: string }, images: { base64: string; mime: string }[]): FlowRunContext {
  const tenantId = cfg.tenantId;
  const caps = getChannelCaps(CHANNEL);
  // Анти-бан пейсинг (правило Meta): пауза «на чтение» + «печатает…» перед каждым сообщением.
  let firstSend = true;
  let lastLen = 0;
  const pace = async (nextLen: number) => {
    if (!firstSend) await sleep(lastLen > 300 ? 4500 : 2500);
    firstSend = false;
    await sendInstagramTypingOn(cfg, igsid);
    await sleep(1500);
    lastLen = nextLen;
  };
  return {
    channelType: CHANNEL,
    send: async (intent) => {
      if (intent.cards && intent.cards.length > 0) {
        await pace(0);
        const rc = await sendInstagramCarousel(cfg, igsid, intent.cards);
        if (!rc.ok) console.error('[ig/flow] carousel failed:', rc.error);
        try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content: '[карусель]', metadata: { channel: CHANNEL, ig_user_id: igsid } }); } catch { /* best-effort */ }
        return;
      }
      const { content, quickReplies } = igAdaptIntent(intent, caps);
      await pace(content.length);
      const r = await sendInstagramText(cfg, igsid, content, quickReplies);
      if (!r.ok) console.error('[ig/flow] send failed:', r.error);
      try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content, metadata: { channel: CHANNEL, ig_user_id: igsid } }); } catch { /* best-effort */ }
    },
    ai: async (userText: string) => {
      try {
        const r = await respondToClient({ tenantId, roomId: room.id, latestClientMessage: userText || undefined });
        return (r?.text || '').trim();
      } catch (e) {
        console.error('[ig/flow] ai node failed:', (e as Error).message);
        return '';
      }
    },
    inboundImages: images.map((im) => ({ base64: im.base64, mime: im.mime })),
    checkFollow: () => getInstagramFollowStatus(cfg, igsid),
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
        console.error('[ig/preset] run failed:', (e as Error).message);
        return { ok: false, error: 'Не получилось обработать изображение. Попробуйте ещё раз.' };
      }
    },
    sendMedia: async (media) => {
      await pace(0);
      const r = await sendInstagramMedia(cfg, igsid, { url: media.url, type: 'image' });
      if (!r.ok) console.error('[ig/preset] media send failed:', r.error);
      if (media.caption) await sendInstagramText(cfg, igsid, media.caption);
      try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'media', kind: 'image', content: media.caption || null, mediaUrl: media.url || null, mediaMime: media.mime || null, metadata: { channel: CHANNEL, ig_user_id: igsid } }); } catch { /* best-effort */ }
    },
  };
}

/** Совпадение текста с любым из ключевых слов (вхождение, регистронезависимо). */
function matchKeywords(keywords: any, text: string): boolean {
  const t = String(text || '').toLowerCase();
  const list = Array.isArray(keywords) ? keywords : [];
  return list.some((k: any) => { const kk = String(k || '').trim().toLowerCase(); return kk.length > 0 && t.includes(kk); });
}

export async function processInstagramEntry(cfg: IgConfig, ev: any): Promise<IgInboundResult> {
  const tenantId = cfg.tenantId;
  const igsid = ev?.sender?.id != null ? String(ev.sender.id) : null;
  const msg = ev?.message;
  const postback = ev?.postback; // нажатие кнопки карусели/шаблона (generic template)

  if (!igsid) return { ok: false, skipped: 'no_sender' };
  if (msg?.is_echo === true) return { ok: false, skipped: 'echo' };
  if (!msg && !postback) return { ok: false, skipped: 'no_message' }; // delivery/read/reaction — пропуск
  // Наш же аккаунт как отправитель — пропуск (на всякий случай).
  if (String(igsid) === String(cfg.igId)) return { ok: false, skipped: 'self' };

  // Текст: тап быстрого ответа / кнопки карусели → payload (= value кнопки) для точного матча.
  const text = String(msg?.quick_reply?.payload ?? postback?.payload ?? msg?.text ?? '').trim();
  const images = await fetchIgImages(ev);
  const image = images[0] || null;
  // Story-контекст: упоминание в сторис (attachment) / ответ на нашу сторис (reply_to.story).
  const isStoryMention = Array.isArray(msg?.attachments) && msg.attachments.some((a: any) => a?.type === 'story_mention');
  const isStoryReply = !!msg?.reply_to?.story;
  const storyKind: string | null = isStoryMention ? 'story_mention' : (isStoryReply ? 'story_reply' : null);
  if (!text && images.length === 0 && !storyKind) return { ok: false, skipped: 'no_text_no_media' };

  // 1 IG-пользователь = 1 диалог = 1 комната VibeVox.
  const room = await findOrCreateChannelRoom(tenantId, CHANNEL, {
    accountId: cfg.igId,
    conversationId: igsid,
    username: null,
    displayName: null,
  });

  // ── Есть активная IG-цепочка → ведём по раннеру. ──
  const activeFlow = await getActiveFlowForChannel(tenantId, CHANNEL);
  if (activeFlow) {
    try {
      await insertMessage({
        roomId: room.id,
        sender: 'client',
        source: image ? 'media' : 'chat',
        kind: image ? 'image' : 'text',
        content: text || null,
        mediaUrl: image ? image.url : null,
        mediaMime: image ? image.mime : null,
        metadata: { channel: CHANNEL, ig_user_id: igsid, ig_account_id: cfg.igId },
      });
    } catch { /* best-effort */ }

    // Story-вход с настроенным триггером → СВЕЖАЯ сессия + переменная `entry` для ветвления узлом «Условие».
    let storyEntry: string | null = null;
    if (storyKind) {
      const trigs = Array.isArray(activeFlow.graph?.triggers) ? activeFlow.graph.triggers : [];
      const st = trigs.find((t: any) => t && t.enabled !== false && t.type === storyKind
        && (storyKind === 'story_mention' || !Array.isArray(t.keywords) || t.keywords.length === 0 || matchKeywords(t.keywords, text)));
      if (st) storyEntry = storyKind;
    }
    let session = storyEntry ? null : await getActiveSession(room.id);
    if (!session) session = await createSession({ roomId: room.id, tenantId, flowId: activeFlow.id });
    if (session) {
      // Handover Protocol: после передачи оператору бот молчит 24 ч (входящее уже сохранено для него).
      if (!storyEntry && session.variables?.__handoffUntil && Date.now() < Number(session.variables.__handoffUntil)) {
        return { ok: true, roomId: room.id, replied: false, skipped: 'handoff' };
      }
      if (storyEntry) { session.variables = session.variables || {}; session.variables.entry = storyEntry; }
      await runFlow(activeFlow, session, text || storyEntry || '', buildIgCtx(cfg, igsid, room, images));
      return { ok: true, roomId: room.id, replied: true };
    }
  }

  // ── Нет цепочки → свободный ИИ-ответ (с vision по фото). ──
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
    console.error('[ig/inbound] respondToClient failed:', aiError);
  }

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
      metadata: { channel: CHANNEL, ig_user_id: igsid, ig_account_id: cfg.igId, ig_message_id: msg?.mid ?? null },
    });
    clientMsgId = cm.id;
  } catch (err) {
    console.warn('[ig/inbound] save client msg failed:', (err as Error).message);
  }

  if (aiError) return { ok: false, roomId: room.id, error: 'ai_failed' };
  if (!replyText) return { ok: true, roomId: room.id, replied: false, skipped: 'empty_ai_reply' };

  try {
    await insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content: replyText, metadata: { channel: CHANNEL, ig_user_id: igsid } });
  } catch { /* best-effort */ }

  const sent = await sendInstagramText(cfg, igsid, replyText);
  if (!sent.ok) {
    console.error('[ig/inbound] reply send failed:', sent.error);
    return { ok: false, roomId: room.id, replied: false, error: sent.error };
  }

  try {
    const matches = await detectNeedTags(tenantId, `CLIENT: ${text || '(media)'}\nAI: ${replyText}`);
    if (matches.length > 0) await applyDetectedTags(room.id, clientMsgId, matches);
  } catch (err) {
    console.warn('[ig/inbound] tag detection failed (continuing):', (err as Error).message);
  }

  return { ok: true, roomId: room.id, replied: true };
}

/**
 * Comment-to-DM: комментарий под постом/Reels с ключевым словом → публичный ответ
 * в комментарии + запуск цепочки в Директ (первое сообщение = приватный ответ по comment_id).
 * Триггеры берутся из flow.graph.triggers (type='comment').
 */
export async function processInstagramComment(cfg: IgConfig, change: any): Promise<IgInboundResult> {
  const v = change?.value || {};
  const commentId = v?.id != null ? String(v.id) : null;
  const from = v?.from || {};
  const commenter = from?.id != null ? String(from.id) : null;
  const text = String(v?.text || '');
  const mediaId = v?.media?.id != null ? String(v.media.id) : '';
  if (!commentId || !commenter) return { ok: false, skipped: 'no_comment' };
  if (String(commenter) === String(cfg.igId)) return { ok: false, skipped: 'self_comment' };

  const flow = await getActiveFlowForChannel(cfg.tenantId, CHANNEL);
  if (!flow) return { ok: false, skipped: 'no_flow' };
  const triggers = Array.isArray(flow.graph?.triggers) ? flow.graph.triggers : [];
  const trig = triggers.find((t: any) =>
    t && t.enabled !== false && t.type === 'comment' && matchKeywords(t.keywords, text) && (!t.postId || String(t.postId) === mediaId)
  );
  if (!trig) return { ok: false, skipped: 'no_trigger_match' };

  // 1. Публичный ответ в комментарии.
  if (trig.publicReply) {
    const rp = await replyToInstagramComment(cfg, commentId, String(trig.publicReply));
    if (!rp.ok) console.warn('[ig/comment] public reply failed:', rp.error);
  }

  // 2. Запуск цепочки в Директ; первое сообщение — приватный ответ (recipient.comment_id).
  const room = await findOrCreateChannelRoom(cfg.tenantId, CHANNEL, {
    accountId: cfg.igId, conversationId: commenter, username: from?.username || null, displayName: from?.username || null,
  });
  const session = await createSession({ roomId: room.id, tenantId: cfg.tenantId, flowId: flow.id });
  if (!session) return { ok: false, roomId: room.id, skipped: 'no_session' };

  const caps = getChannelCaps(CHANNEL);
  const ctx = buildIgCtx(cfg, commenter, room, []);
  const baseSend = ctx.send;
  let firstSend = true;
  ctx.send = async (intent: any) => {
    if (firstSend) {
      firstSend = false;
      const { content, quickReplies } = igAdaptIntent(intent, caps);
      const r = await sendInstagramPrivateReply(cfg, commentId, { text: content, quickReplies, cards: intent.cards });
      if (!r.ok) console.error('[ig/comment] private reply failed:', r.error);
      try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content: content || '[карусель]', metadata: { channel: CHANNEL, ig_user_id: commenter, ig_comment_id: commentId } }); } catch { /* best-effort */ }
      return;
    }
    await baseSend(intent);
  };

  await runFlow(flow, session, String((trig.keywords && trig.keywords[0]) || text || ''), ctx);
  return { ok: true, roomId: room.id, replied: true };
}
