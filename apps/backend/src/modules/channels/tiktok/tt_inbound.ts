/**
 * TikTok (Business Messaging API) — обработка входящего.
 *
 * Зеркалит ig_inbound: тот же раннер цепочек + свободный ИИ + пресеты + теги.
 * Отличия TikTok: нет follow-gate; нет карусели; Comment-to-DM = ТОЛЬКО публичный
 * ответ в комментарии (авто-DM из коммента запрещён); лимит 48ч/10 (tt_ratelimit),
 * каждое входящее обнуляет окно.
 */

import type { TtConfig } from './tt_config.js';
import { sendTikTokText, sendTikTokMedia, replyTikTokComment, type TtQuickReply } from './tt_client.js';
import { ttResetWindow } from './tt_ratelimit.js';
import { findOrCreateChannelRoom } from '../../rooms/service.js';
import { insertMessage } from '../../rooms/messages.js';
import { respondToClient } from '../../quest_flow/responder.js';
import { detectNeedTags, applyDetectedTags } from '../../need_tags/detector.js';
import { getChannelCaps } from '../capabilities.js';
import { getActiveFlowForChannel } from '../../flows/service.js';
import { getActiveSession, createSession } from '../../flows/sessions.js';
import { runFlow, type FlowRunContext } from '../../flows/runner.js';
import { findPreset, getTenantImageConfig } from '../../quest_flow/image_presets.js';
import { IMAGE_FUNCTIONS, type ImageFunctionKey } from '../../quest_flow/image_functions.js';
import { getEffectiveGeminiKey } from '../../tenant_settings/gemini.js';
import { runImagePresetTransform } from '../../quest_flow/image_transform.js';

const CHANNEL = 'tiktok';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface TtInboundResult { ok: boolean; roomId?: string; replied?: boolean; skipped?: string; error?: string }

function extractUserId(ev: any): string | null {
  const id = ev?.sender?.id ?? ev?.user_id ?? ev?.from_user_id ?? ev?.from?.id;
  return id != null ? String(id) : null;
}
function extractText(ev: any): string {
  return String(ev?.message?.text ?? ev?.content?.text ?? ev?.text ?? ev?.message?.quick_reply?.payload ?? '').trim();
}
async function fetchTtImages(ev: any): Promise<{ base64: string; mime: string; url: string }[]> {
  const atts = ev?.message?.attachments || ev?.attachments || [];
  if (!Array.isArray(atts)) return [];
  const imgs = atts.filter((a: any) => (a?.type === 'image' || a?.media_type === 'image') && (a?.url || a?.payload?.url)).slice(0, 14);
  const out: { base64: string; mime: string; url: string }[] = [];
  for (const a of imgs) {
    const url = a.url || a.payload?.url;
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const ab = await r.arrayBuffer();
      out.push({ base64: Buffer.from(ab).toString('base64'), mime: r.headers.get('content-type') || 'image/jpeg', url });
    } catch (e) { console.warn('[tt/inbound] image fetch failed:', (e as Error).message); }
  }
  return out;
}

/** Адаптация SendIntent под TikTok: текст + вертикальные быстрые ответы (url-кнопки → текстом). */
function ttAdaptIntent(intent: { text?: string; options?: { label: string; value: string; url?: string }[] }, caps: { maxButtons: number }): { content: string; quickReplies?: TtQuickReply[] } {
  let content = intent.text || '';
  const allOpts = intent.options || [];
  const linkOpts = allOpts.filter((o) => o.url);
  const replyOpts = allOpts.filter((o) => !o.url);
  let quickReplies: TtQuickReply[] | undefined;
  if (replyOpts.length > 0 && caps.maxButtons > 0 && replyOpts.length <= caps.maxButtons) {
    quickReplies = replyOpts.map((o) => ({ title: o.label, payload: o.value }));
  } else if (replyOpts.length > 0) {
    content = `${content}\n${replyOpts.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}`;
  }
  if (linkOpts.length > 0) content = `${content}\n${linkOpts.map((o) => `🔗 ${o.label}: ${o.url}`).join('\n')}`;
  return { content, quickReplies };
}

function buildTtCtx(cfg: TtConfig, userId: string, room: { id: string }, images: { base64: string; mime: string }[]): FlowRunContext {
  const tenantId = cfg.tenantId;
  const caps = getChannelCaps(CHANNEL);
  // Анти-бан пейсинг: пауза «на чтение» между сообщениями (TikTok без typing-индикатора API).
  let firstSend = true;
  let lastLen = 0;
  const pace = async (nextLen: number) => {
    if (!firstSend) await sleep(lastLen > 300 ? 4500 : 2500);
    firstSend = false;
    lastLen = nextLen;
  };
  return {
    channelType: CHANNEL,
    send: async (intent) => {
      // Карусель TikTok не поддерживает → деградируем (картинки + текст).
      if (intent.cards && intent.cards.length > 0) {
        for (const c of intent.cards) {
          await pace(0);
          if (c.imageUrl) await sendTikTokMedia(cfg, userId, { url: c.imageUrl, type: 'image' });
          const cap = [c.title, c.subtitle].filter(Boolean).join('\n');
          const links = (c.buttons || []).filter((b) => b.url).map((b) => `🔗 ${b.label}: ${b.url}`).join('\n');
          const body = [cap, links].filter(Boolean).join('\n');
          if (body) { await pace(body.length); await sendTikTokText(cfg, userId, body); }
        }
        return;
      }
      const { content, quickReplies } = ttAdaptIntent(intent, caps);
      await pace(content.length);
      const r = await sendTikTokText(cfg, userId, content, quickReplies);
      if (!r.ok) console.error('[tt/flow] send failed:', r.error);
      try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content, metadata: { channel: CHANNEL, tt_user_id: userId } }); } catch { /* best-effort */ }
    },
    ai: async (userText: string) => {
      try { const r = await respondToClient({ tenantId, roomId: room.id, latestClientMessage: userText || undefined }); return (r?.text || '').trim(); }
      catch (e) { console.error('[tt/flow] ai node failed:', (e as Error).message); return ''; }
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
      } catch (e) { console.error('[tt/preset] run failed:', (e as Error).message); return { ok: false, error: 'Не получилось обработать изображение. Попробуйте ещё раз.' }; }
    },
    sendMedia: async (media) => {
      await pace(0);
      const r = await sendTikTokMedia(cfg, userId, { url: media.url, type: 'image' });
      if (!r.ok) console.error('[tt/preset] media send failed:', r.error);
      if (media.caption) { await pace(media.caption.length); await sendTikTokText(cfg, userId, media.caption); }
      try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'media', kind: 'image', content: media.caption || null, mediaUrl: media.url || null, mediaMime: media.mime || null, metadata: { channel: CHANNEL, tt_user_id: userId } }); } catch { /* best-effort */ }
    },
  };
}

function matchKeywords(keywords: any, text: string): boolean {
  const t = String(text || '').toLowerCase();
  const list = Array.isArray(keywords) ? keywords : [];
  return list.some((k: any) => { const kk = String(k || '').trim().toLowerCase(); return kk.length > 0 && t.includes(kk); });
}

export async function processTikTokEntry(cfg: TtConfig, ev: any): Promise<TtInboundResult> {
  const tenantId = cfg.tenantId;
  const userId = extractUserId(ev);
  if (!userId) return { ok: false, skipped: 'no_sender' };
  if (String(userId) === String(cfg.accountId)) return { ok: false, skipped: 'self' };

  const text = extractText(ev);
  const images = await fetchTtImages(ev);
  const image = images[0] || null;
  if (!text && images.length === 0) return { ok: false, skipped: 'no_text_no_media' };

  // Входящее пользователя → обнуляем окно/счётчик (правило 48ч/10).
  ttResetWindow(cfg.accountId, userId);

  const room = await findOrCreateChannelRoom(tenantId, CHANNEL, { accountId: cfg.accountId, conversationId: userId, username: null, displayName: null });

  const activeFlow = await getActiveFlowForChannel(tenantId, CHANNEL);
  if (activeFlow) {
    try {
      await insertMessage({ roomId: room.id, sender: 'client', source: image ? 'media' : 'chat', kind: image ? 'image' : 'text', content: text || null, mediaUrl: image ? image.url : null, mediaMime: image ? image.mime : null, metadata: { channel: CHANNEL, tt_user_id: userId, tt_account_id: cfg.accountId } });
    } catch { /* best-effort */ }

    let session = await getActiveSession(room.id);
    if (!session) session = await createSession({ roomId: room.id, tenantId, flowId: activeFlow.id });
    if (session) {
      if (session.variables?.__handoffUntil && Date.now() < Number(session.variables.__handoffUntil)) {
        return { ok: true, roomId: room.id, replied: false, skipped: 'handoff' };
      }
      await runFlow(activeFlow, session, text, buildTtCtx(cfg, userId, room, images));
      return { ok: true, roomId: room.id, replied: true };
    }
  }

  // Нет цепочки → свободный ИИ.
  let replyText = '';
  let aiError: string | null = null;
  try {
    const result = await respondToClient({ tenantId, roomId: room.id, latestClientMessage: text || undefined, imageBase64: image ? image.base64 : null, imageMime: image ? image.mime : null });
    replyText = (result?.text || '').trim();
  } catch (err) { aiError = (err as Error).message; console.error('[tt/inbound] respondToClient failed:', aiError); }

  let clientMsgId: string | null = null;
  try {
    const cm = await insertMessage({ roomId: room.id, sender: 'client', source: image ? 'media' : 'chat', kind: image ? 'image' : 'text', content: text || null, mediaUrl: image ? image.url : null, mediaMime: image ? image.mime : null, metadata: { channel: CHANNEL, tt_user_id: userId, tt_account_id: cfg.accountId } });
    clientMsgId = cm.id;
  } catch (err) { console.warn('[tt/inbound] save client msg failed:', (err as Error).message); }

  if (aiError) return { ok: false, roomId: room.id, error: 'ai_failed' };
  if (!replyText) return { ok: true, roomId: room.id, replied: false, skipped: 'empty_ai_reply' };

  try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content: replyText, metadata: { channel: CHANNEL, tt_user_id: userId } }); } catch { /* best-effort */ }

  const sent = await sendTikTokText(cfg, userId, replyText);
  if (!sent.ok) { console.error('[tt/inbound] reply send failed:', sent.error); return { ok: false, roomId: room.id, replied: false, error: sent.error }; }

  try {
    const matches = await detectNeedTags(tenantId, `CLIENT: ${text || '(media)'}\nAI: ${replyText}`);
    if (matches.length > 0) await applyDetectedTags(room.id, clientMsgId, matches);
  } catch (err) { console.warn('[tt/inbound] tag detection failed (continuing):', (err as Error).message); }

  return { ok: true, roomId: room.id, replied: true };
}

/**
 * Comment-to-DM в TikTok: авто-DM из комментария ЗАПРЕЩЁН → бот только публично
 * отвечает в комментарии (например «напиши мне ГАЙД в Директ»). Дальше пользователь
 * пишет сам → срабатывает обычный DM-триггер.
 */
export async function processTikTokComment(cfg: TtConfig, change: any): Promise<TtInboundResult> {
  const v = change?.value || change || {};
  const commentId = v?.comment_id ?? v?.id;
  const text = String(v?.text ?? v?.content ?? '');
  const videoId = v?.video_id != null ? String(v.video_id) : (v?.item_id != null ? String(v.item_id) : '');
  if (!commentId) return { ok: false, skipped: 'no_comment' };

  const flow = await getActiveFlowForChannel(cfg.tenantId, CHANNEL);
  if (!flow) return { ok: false, skipped: 'no_flow' };
  const triggers = Array.isArray(flow.graph?.triggers) ? flow.graph.triggers : [];
  const trig = triggers.find((t: any) => t && t.enabled !== false && t.type === 'comment' && matchKeywords(t.keywords, text) && (!t.postId || String(t.postId) === videoId));
  if (!trig) return { ok: false, skipped: 'no_trigger_match' };

  const reply = String(trig.publicReply || 'Напишите нам в Директ — и я всё пришлю!');
  const r = await replyTikTokComment(cfg, String(commentId), reply);
  if (!r.ok) { console.warn('[tt/comment] public reply failed:', r.error); return { ok: false, error: r.error }; }
  return { ok: true, replied: true };
}
