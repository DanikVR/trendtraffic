/**
 * Messenger (Messenger Platform API) — обработка входящего. Зеркало ig_inbound.
 * Те же цепочки + свободный ИИ + пресеты + теги. Карусель поддержана (как IG).
 * Comment-to-DM: публичный ответ + приватный ответ на коммент страницы.
 * Окно 24ч (openMsgWindow на входящем). Без follow-gate (нет у FB-страниц).
 */

import type { MsgConfig } from './msg_config.js';
import { sendMessengerText, sendMessengerMedia, sendMessengerCarousel, sendMessengerTypingOn, replyMessengerCommentPublic, sendMessengerPrivateReply, type MsgQuickReply } from './msg_client.js';
import { openMsgWindow } from './msg_window.js';
import { findOrCreateChannelRoom } from '../../rooms/service.js';
import { insertMessage } from '../../rooms/messages.js';
import { respondToClient } from '../../quest_flow/responder.js';
import { detectNeedTags, applyDetectedTags } from '../../need_tags/detector.js';
import { getChannelCaps } from '../capabilities.js';
import { getActiveFlowForChannel } from '../../flows/service.js';
import { getActiveSession, createSession } from '../../flows/sessions.js';
import { runFlow, type FlowRunContext, type CarouselCard } from '../../flows/runner.js';
import { findPreset, getTenantImageConfig } from '../../quest_flow/image_presets.js';
import { IMAGE_FUNCTIONS, type ImageFunctionKey } from '../../quest_flow/image_functions.js';
import { getEffectiveGeminiKey } from '../../tenant_settings/gemini.js';
import { runImagePresetTransform } from '../../quest_flow/image_transform.js';

const CHANNEL = 'messenger';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface MsgInboundResult { ok: boolean; roomId?: string; replied?: boolean; skipped?: string; error?: string }

async function fetchMsgImages(ev: any): Promise<{ base64: string; mime: string; url: string }[]> {
  const atts = ev?.message?.attachments;
  if (!Array.isArray(atts)) return [];
  const imgs = atts.filter((a: any) => a?.type === 'image' && a?.payload?.url).slice(0, 14);
  const out: { base64: string; mime: string; url: string }[] = [];
  for (const a of imgs) {
    try {
      const r = await fetch(a.payload.url);
      if (!r.ok) continue;
      const ab = await r.arrayBuffer();
      out.push({ base64: Buffer.from(ab).toString('base64'), mime: r.headers.get('content-type') || 'image/jpeg', url: a.payload.url });
    } catch (e) { console.warn('[msg/inbound] image fetch failed:', (e as Error).message); }
  }
  return out;
}

function matchKeywords(keywords: any, text: string): boolean {
  const t = String(text || '').toLowerCase();
  return (Array.isArray(keywords) ? keywords : []).some((k: any) => { const kk = String(k || '').trim().toLowerCase(); return kk && t.includes(kk); });
}

function msgAdaptIntent(intent: { text?: string; options?: { label: string; value: string; url?: string }[] }, caps: { maxButtons: number }): { content: string; quickReplies?: MsgQuickReply[] } {
  let content = intent.text || '';
  const all = intent.options || [];
  const link = all.filter((o) => o.url);
  const reply = all.filter((o) => !o.url);
  let quickReplies: MsgQuickReply[] | undefined;
  if (reply.length > 0 && caps.maxButtons > 0 && reply.length <= caps.maxButtons) quickReplies = reply.map((o) => ({ title: o.label, payload: o.value }));
  else if (reply.length > 0) content = `${content}\n${reply.map((o, i) => `${i + 1}. ${o.label}`).join('\n')}`;
  if (link.length > 0) content = `${content}\n${link.map((o) => `🔗 ${o.label}: ${o.url}`).join('\n')}`;
  return { content, quickReplies };
}

function buildMsgCtx(cfg: MsgConfig, psid: string, room: { id: string }, images: { base64: string; mime: string }[]): FlowRunContext {
  const tenantId = cfg.tenantId;
  const caps = getChannelCaps(CHANNEL);
  let first = true; let lastLen = 0;
  const pace = async (nextLen: number) => {
    if (!first) await sleep(lastLen > 300 ? 4500 : 2500);
    first = false;
    await sendMessengerTypingOn(cfg, psid);
    await sleep(1500);
    lastLen = nextLen;
  };
  const save = (content: string) => insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content, metadata: { channel: CHANNEL, msg_psid: psid } }).catch(() => {});
  return {
    channelType: CHANNEL,
    send: async (intent) => {
      if (intent.cards && intent.cards.length > 0) {
        await pace(0);
        const rc = await sendMessengerCarousel(cfg, psid, intent.cards as CarouselCard[]);
        if (!rc.ok) console.error('[msg/flow] carousel failed:', rc.error);
        save('[карусель]'); return;
      }
      const { content, quickReplies } = msgAdaptIntent(intent, caps);
      await pace(content.length);
      const r = await sendMessengerText(cfg, psid, content, quickReplies);
      if (!r.ok) console.error('[msg/flow] send failed:', r.error);
      save(content);
    },
    ai: async (userText: string) => {
      try { const r = await respondToClient({ tenantId, roomId: room.id, latestClientMessage: userText || undefined }); return (r?.text || '').trim(); }
      catch (e) { console.error('[msg/flow] ai node failed:', (e as Error).message); return ''; }
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
      } catch (e) { console.error('[msg/preset] run failed:', (e as Error).message); return { ok: false, error: 'Не получилось обработать изображение. Попробуйте ещё раз.' }; }
    },
    sendMedia: async (media) => {
      await pace(0);
      const r = await sendMessengerMedia(cfg, psid, { url: media.url, type: 'image' });
      if (!r.ok) console.error('[msg/preset] media send failed:', r.error);
      if (media.caption) { await pace(media.caption.length); await sendMessengerText(cfg, psid, media.caption); }
      insertMessage({ roomId: room.id, sender: 'ai', source: 'media', kind: 'image', content: media.caption || null, mediaUrl: media.url || null, mediaMime: media.mime || null, metadata: { channel: CHANNEL, msg_psid: psid } }).catch(() => {});
    },
  };
}

export async function processMessengerEntry(cfg: MsgConfig, ev: any): Promise<MsgInboundResult> {
  const tenantId = cfg.tenantId;
  const psid = ev?.sender?.id != null ? String(ev.sender.id) : null;
  const msg = ev?.message;
  const postback = ev?.postback; // Get Started, постоянное меню, кнопки карусели
  if (!psid) return { ok: false, skipped: 'no_sender' };
  if (msg?.is_echo === true) return { ok: false, skipped: 'echo' };
  if (!msg && !postback) return { ok: false, skipped: 'no_message' };
  if (String(psid) === String(cfg.pageId)) return { ok: false, skipped: 'self' };

  const text = String(msg?.quick_reply?.payload ?? postback?.payload ?? msg?.text ?? '').trim();
  const images = await fetchMsgImages(ev);
  const image = images[0] || null;
  if (!text && images.length === 0) return { ok: false, skipped: 'no_text_no_media' };

  openMsgWindow(cfg.pageId, psid);
  const room = await findOrCreateChannelRoom(tenantId, CHANNEL, { accountId: cfg.pageId, conversationId: psid, username: null, displayName: null });

  const activeFlow = await getActiveFlowForChannel(tenantId, CHANNEL);
  if (activeFlow) {
    try { await insertMessage({ roomId: room.id, sender: 'client', source: image ? 'media' : 'chat', kind: image ? 'image' : 'text', content: text || null, mediaUrl: image ? image.url : null, mediaMime: image ? image.mime : null, metadata: { channel: CHANNEL, msg_psid: psid, msg_page_id: cfg.pageId } }); } catch { /* */ }
    let session = await getActiveSession(room.id);
    if (!session) session = await createSession({ roomId: room.id, tenantId, flowId: activeFlow.id });
    if (session) {
      if (session.variables?.__handoffUntil && Date.now() < Number(session.variables.__handoffUntil)) return { ok: true, roomId: room.id, replied: false, skipped: 'handoff' };
      await runFlow(activeFlow, session, text, buildMsgCtx(cfg, psid, room, images));
      return { ok: true, roomId: room.id, replied: true };
    }
  }

  // Нет цепочки → свободный ИИ.
  let replyText = '';
  let aiError: string | null = null;
  try {
    const result = await respondToClient({ tenantId, roomId: room.id, latestClientMessage: text || undefined, imageBase64: image ? image.base64 : null, imageMime: image ? image.mime : null });
    replyText = (result?.text || '').trim();
  } catch (err) { aiError = (err as Error).message; console.error('[msg/inbound] respondToClient failed:', aiError); }

  let clientMsgId: string | null = null;
  try {
    const cm = await insertMessage({ roomId: room.id, sender: 'client', source: image ? 'media' : 'chat', kind: image ? 'image' : 'text', content: text || null, mediaUrl: image ? image.url : null, mediaMime: image ? image.mime : null, metadata: { channel: CHANNEL, msg_psid: psid, msg_page_id: cfg.pageId } });
    clientMsgId = cm.id;
  } catch (err) { console.warn('[msg/inbound] save client msg failed:', (err as Error).message); }

  if (aiError) return { ok: false, roomId: room.id, error: 'ai_failed' };
  if (!replyText) return { ok: true, roomId: room.id, replied: false, skipped: 'empty_ai_reply' };

  try { await insertMessage({ roomId: room.id, sender: 'ai', source: 'chat', kind: 'text', content: replyText, metadata: { channel: CHANNEL, msg_psid: psid } }); } catch { /* */ }
  const sent = await sendMessengerText(cfg, psid, replyText);
  if (!sent.ok) { console.error('[msg/inbound] reply send failed:', sent.error); return { ok: false, roomId: room.id, replied: false, error: sent.error }; }

  try {
    const matches = await detectNeedTags(tenantId, `CLIENT: ${text || '(media)'}\nAI: ${replyText}`);
    if (matches.length > 0) await applyDetectedTags(room.id, clientMsgId, matches);
  } catch (err) { console.warn('[msg/inbound] tag detection failed (continuing):', (err as Error).message); }

  return { ok: true, roomId: room.id, replied: true };
}

/** Comment-to-DM на FB: коммент под постом страницы → публичный ответ + приватный DM. */
export async function processMessengerComment(cfg: MsgConfig, change: any): Promise<MsgInboundResult> {
  const v = change?.value || {};
  if (v?.item !== 'comment' || v?.verb !== 'add') return { ok: false, skipped: 'not_comment_add' };
  const commentId = v?.comment_id != null ? String(v.comment_id) : null;
  const text = String(v?.message || '');
  const postId = v?.post_id != null ? String(v.post_id) : '';
  const fromId = v?.from?.id != null ? String(v.from.id) : null;
  if (!commentId) return { ok: false, skipped: 'no_comment' };
  if (fromId && String(fromId) === String(cfg.pageId)) return { ok: false, skipped: 'self_comment' };

  const flow = await getActiveFlowForChannel(cfg.tenantId, CHANNEL);
  if (!flow) return { ok: false, skipped: 'no_flow' };
  const triggers = Array.isArray(flow.graph?.triggers) ? flow.graph.triggers : [];
  const trig = triggers.find((t: any) => t && t.enabled !== false && t.type === 'comment' && matchKeywords(t.keywords, text) && (!t.postId || String(t.postId) === postId));
  if (!trig) return { ok: false, skipped: 'no_trigger_match' };

  const reply = String(trig.publicReply || 'Отправил вам в личные! 😉');
  const rp = await replyMessengerCommentPublic(cfg, commentId, reply);
  if (!rp.ok) console.warn('[msg/comment] public reply failed:', rp.error);
  const pr = await sendMessengerPrivateReply(cfg, commentId, reply);
  if (!pr.ok) console.warn('[msg/comment] private reply failed:', pr.error);
  return { ok: true, replied: pr.ok };
}
