/**
 * Messenger (Messenger Platform API) — клиент отправки + account-level настройки.
 * Зеркало ig_client: те же формы (graph.facebook.com, page token, recipient.id/comment).
 * Свободные сообщения только в окне 24ч (msgWithinWindow); вне — Message Tags (позже).
 */

import type { MsgConfig } from './msg_config.js';
import type { CarouselCard } from '../../flows/runner.js';
import { msgWithinWindow } from './msg_window.js';

const GRAPH = (process.env.MESSENGER_API_BASE || 'https://graph.facebook.com/v21.0').replace(/\/+$/, '');
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');

export interface MsgSendResult { ok: boolean; error?: string }
export interface MsgQuickReply { title: string; payload?: string }

function toAbsoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!PUBLIC_BASE_URL) return null;
  return `${PUBLIC_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function chunkByBytes(text: string, maxBytes = 1800): string[] {
  const out: string[] = [];
  let cur = '';
  for (const ch of String(text)) {
    if (Buffer.byteLength(cur + ch, 'utf8') > maxBytes) { if (cur) out.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

function buildCarouselElements(cards: CarouselCard[]): any[] {
  return (cards || []).slice(0, 10).map((c) => {
    const el: any = { title: (c.title || ' ').slice(0, 80) };
    if (c.subtitle) el.subtitle = c.subtitle.slice(0, 80);
    const img = toAbsoluteMediaUrl(c.imageUrl);
    if (img) el.image_url = img;
    const btns = (c.buttons || []).slice(0, 3).map((b) =>
      b.url
        ? { type: 'web_url', url: b.url, title: (b.label || 'Открыть').slice(0, 20) }
        : { type: 'postback', title: (b.label || 'Выбрать').slice(0, 20), payload: String(b.value || b.label || '') }
    );
    if (btns.length) el.buttons = btns;
    return el;
  });
}

function quickReplyPayload(qr: MsgQuickReply[]): any[] {
  return qr.slice(0, 13).map((q, i) => ({ content_type: 'text', title: String(q.title || '').slice(0, 20), payload: String(q.payload ?? q.title ?? `qr${i}`) }));
}

/** recipient = { id: PSID } (DM, под окном 24ч) или { comment_id } (приватный ответ — без окна). */
async function msgSend(cfg: MsgConfig, recipient: Record<string, string>, message: any): Promise<MsgSendResult> {
  if (recipient.id && !msgWithinWindow(cfg.pageId, recipient.id)) return { ok: false, error: 'outside_24h_window' };
  try {
    const res = await fetch(`${GRAPH}/${cfg.pageId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ recipient, message, messaging_type: 'RESPONSE' }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); return { ok: false, error: `MSG ${res.status}: ${t.slice(0, 300)}` }; }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function sendMessengerText(cfg: MsgConfig, psid: string, text: string, quickReplies?: MsgQuickReply[]): Promise<MsgSendResult> {
  const chunks = chunkByBytes(text || '');
  let last: MsgSendResult = { ok: true };
  for (let i = 0; i < chunks.length; i++) {
    const body: any = { text: chunks[i] };
    if (i === chunks.length - 1 && quickReplies && quickReplies.length > 0) body.quick_replies = quickReplyPayload(quickReplies);
    last = await msgSend(cfg, { id: psid }, body);
    if (!last.ok) return last;
  }
  return last;
}

export async function sendMessengerMedia(cfg: MsgConfig, psid: string, media: { url?: string; type?: string }): Promise<MsgSendResult> {
  const abs = toAbsoluteMediaUrl(media.url);
  if (!abs) return { ok: false, error: 'Нет публичного URL медиа (задайте PUBLIC_BASE_URL).' };
  const t = media.type === 'video' || media.type === 'audio' ? media.type : media.type === 'file' ? 'file' : 'image';
  return msgSend(cfg, { id: psid }, { attachment: { type: t, payload: { url: abs, is_reusable: false } } });
}

export async function sendMessengerCarousel(cfg: MsgConfig, psid: string, cards: CarouselCard[]): Promise<MsgSendResult> {
  const elements = buildCarouselElements(cards);
  if (elements.length === 0) return { ok: false, error: 'Пустая карусель.' };
  return msgSend(cfg, { id: psid }, { attachment: { type: 'template', payload: { template_type: 'generic', elements } } });
}

export async function sendMessengerTypingOn(cfg: MsgConfig, psid: string): Promise<void> {
  try {
    await fetch(`${GRAPH}/${cfg.pageId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ recipient: { id: psid }, sender_action: 'typing_on' }),
    });
  } catch { /* не критично */ }
}

/** Публичный ответ на коммент под постом страницы (Comment-to-DM). */
export async function replyMessengerCommentPublic(cfg: MsgConfig, commentId: string, message: string): Promise<MsgSendResult> {
  try {
    const res = await fetch(`${GRAPH}/${commentId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ message: String(message || '').slice(0, 8000) }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); return { ok: false, error: `MSG ${res.status}: ${t.slice(0, 200)}` }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Приватный ответ на коммент (одно DM-сообщение комментатору). */
export async function sendMessengerPrivateReply(cfg: MsgConfig, commentId: string, text: string): Promise<MsgSendResult> {
  try {
    const res = await fetch(`${GRAPH}/${commentId}/private_replies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ message: chunkByBytes(text || ' ')[0] }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); return { ok: false, error: `MSG ${res.status}: ${t.slice(0, 200)}` }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Account-level: Get Started + Greeting + Ice Breakers (≤4) + Persistent Menu (≤3). */
export async function setMessengerProfile(cfg: MsgConfig, p: { greeting?: string; iceBreakers?: { question: string; payload?: string }[]; menu?: { title: string; payload: string }[] }): Promise<MsgSendResult> {
  const body: any = { get_started: { payload: 'GET_STARTED' } };
  if (p.greeting && p.greeting.trim()) body.greeting = [{ locale: 'default', text: p.greeting.trim().slice(0, 160) }];
  const ib = (p.iceBreakers || []).filter((i) => i?.question?.trim()).slice(0, 4);
  if (ib.length) body.ice_breakers = [{ call_to_actions: ib.map((i) => ({ question: i.question.trim().slice(0, 80), payload: String(i.payload || i.question).slice(0, 1000) })), locale: 'default' }];
  const menu = (p.menu || []).filter((m) => m?.title?.trim()).slice(0, 3);
  if (menu.length) body.persistent_menu = [{ locale: 'default', composer_input_disabled: false, call_to_actions: menu.map((m) => ({ type: 'postback', title: m.title.trim().slice(0, 30), payload: String(m.payload || m.title).slice(0, 1000) })) }];
  try {
    const res = await fetch(`${GRAPH}/${cfg.pageId}/messenger_profile`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); return { ok: false, error: `MSG ${res.status}: ${t.slice(0, 200)}` }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function getMessengerProfile(cfg: MsgConfig): Promise<{ greeting: string; iceBreakers: { question: string; payload: string }[]; menu: { title: string; payload: string }[] }> {
  try {
    const res = await fetch(`${GRAPH}/${cfg.pageId}/messenger_profile?fields=greeting,ice_breakers,persistent_menu&access_token=${encodeURIComponent(cfg.accessToken)}`);
    if (!res.ok) return { greeting: '', iceBreakers: [], menu: [] };
    const j: any = await res.json().catch(() => null);
    const d = j?.data?.[0] || {};
    const greeting = Array.isArray(d.greeting) ? String(d.greeting[0]?.text || '') : '';
    const ibCta = Array.isArray(d.ice_breakers) && d.ice_breakers[0]?.call_to_actions ? d.ice_breakers[0].call_to_actions : [];
    const menuCta = Array.isArray(d.persistent_menu) && d.persistent_menu[0]?.call_to_actions ? d.persistent_menu[0].call_to_actions : [];
    return {
      greeting,
      iceBreakers: ibCta.map((c: any) => ({ question: String(c?.question || ''), payload: String(c?.payload || '') })).filter((c: { question: string }) => c.question),
      menu: menuCta.map((c: any) => ({ title: String(c?.title || ''), payload: String(c?.payload || '') })).filter((c: { title: string }) => c.title),
    };
  } catch { return { greeting: '', iceBreakers: [], menu: [] }; }
}
