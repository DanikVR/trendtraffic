/**
 * Instagram (прямой Graph API) — IG-0. Клиент Send API.
 *
 * Эндпоинт (Instagram API with Instagram Login):
 *   POST https://graph.instagram.com/v25.0/<IG_ID>/messages
 *   Authorization: Bearer <ACCESS_TOKEN>
 *   body: { recipient: { id: <IGSID> }, message: { text | quick_replies | attachments } }
 *
 * Лимиты: текст ≤1000 байт (длинное режем на части по байтам), быстрых
 * ответов ≤13 (title ≤20). Медиа IG скачивает по ПУБЛИЧНОМУ url → делаем
 * относительный /uploads/... абсолютным через PUBLIC_BASE_URL (как QuestFlow).
 */

import type { IgConfig } from './ig_config.js';
import type { CarouselCard } from '../../flows/runner.js';
import { igRateGate } from './ig_ratelimit.js';

const GRAPH = 'https://graph.instagram.com/v25.0';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');

export interface IgSendResult { ok: boolean; error?: string }
export interface IgQuickReply { title: string; payload?: string }

/** Относительный `/uploads/...` → абсолютный (IG скачивает медиа по url). */
function toAbsoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!PUBLIC_BASE_URL) return null; // без публичного адреса IG не скачает — лучше не слать битый
  return `${PUBLIC_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** Делит текст на части ≤maxBytes (UTF-8), чтобы не упереться в лимит 1000 байт IG. */
function chunkByBytes(text: string, maxBytes = 900): string[] {
  const out: string[] = [];
  let cur = '';
  for (const ch of String(text)) {
    if (Buffer.byteLength(cur + ch, 'utf8') > maxBytes) {
      if (cur) out.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

/** Низкоуровневая отправка. recipient = { id: IGSID } (обычный DM) или { comment_id } (приватный ответ). */
async function igSend(cfg: IgConfig, recipient: Record<string, string>, body: any): Promise<IgSendResult> {
  if (!(await igRateGate(cfg.igId))) return { ok: false, error: 'rate_limited_hourly' };
  try {
    const res = await fetch(`${GRAPH}/${cfg.igId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ recipient, message: body }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: `IG ${res.status}: ${t.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Элементы generic template из карточек карусели (общее для DM-карусели и приватного ответа). */
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

function quickReplyPayload(quickReplies: IgQuickReply[]): any[] {
  return quickReplies.slice(0, 13).map((q, idx) => ({
    content_type: 'text',
    title: String(q.title || '').slice(0, 20),
    payload: String(q.payload ?? q.title ?? `qr${idx}`),
  }));
}

/**
 * Текст (+ опционально быстрые ответы). Длинный текст уходит несколькими
 * сообщениями; quick replies прикрепляются к ПОСЛЕДНЕМУ.
 */
export async function sendInstagramText(
  cfg: IgConfig,
  igsid: string,
  text: string,
  quickReplies?: IgQuickReply[]
): Promise<IgSendResult> {
  const chunks = chunkByBytes(text || '');
  let last: IgSendResult = { ok: true };
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const body: any = { text: chunks[i] };
    if (isLast && quickReplies && quickReplies.length > 0) body.quick_replies = quickReplyPayload(quickReplies);
    last = await igSend(cfg, { id: igsid }, body);
    if (!last.ok) return last;
  }
  return last;
}

/** Медиа по url (изображение/видео/аудио). IG скачает по публичному адресу. */
export async function sendInstagramMedia(
  cfg: IgConfig,
  igsid: string,
  media: { url?: string; type?: string }
): Promise<IgSendResult> {
  const abs = toAbsoluteMediaUrl(media.url);
  if (!abs) return { ok: false, error: 'Нет публичного URL медиа (задайте PUBLIC_BASE_URL).' };
  const t = media.type === 'video' || media.type === 'audio' ? media.type : 'image';
  return igSend(cfg, { id: igsid }, { attachments: { type: t, payload: { url: abs } } });
}

/** Карусель (generic template): 1–10 карточек, ≤3 кнопки/карточка (web_url или postback). */
export async function sendInstagramCarousel(cfg: IgConfig, igsid: string, cards: CarouselCard[]): Promise<IgSendResult> {
  const elements = buildCarouselElements(cards);
  if (elements.length === 0) return { ok: false, error: 'Пустая карусель.' };
  return igSend(cfg, { id: igsid }, { attachments: { type: 'template', payload: { template_type: 'generic', elements } } });
}

/** Подписан ли клиент на бизнес-аккаунт (User Profile API). null = не удалось определить. */
export async function getInstagramFollowStatus(cfg: IgConfig, igsid: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${GRAPH}/${igsid}?fields=is_user_follow_business`, {
      headers: { Authorization: `Bearer ${cfg.accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return typeof data?.is_user_follow_business === 'boolean' ? data.is_user_follow_business : null;
  } catch {
    return null;
  }
}

/** Индикатор «печатает…» (имитация человека перед текстом). Лёгкое действие — без rate-gate. */
export async function sendInstagramTypingOn(cfg: IgConfig, igsid: string): Promise<void> {
  try {
    await fetch(`${GRAPH}/${cfg.igId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ recipient: { id: igsid }, sender_action: 'typing_on' }),
    });
  } catch { /* индикатор не критичен */ }
}

/** Публичный ответ на комментарий (Comment-to-DM): POST /{comment-id}/replies. */
export async function replyToInstagramComment(cfg: IgConfig, commentId: string, message: string): Promise<IgSendResult> {
  if (!(await igRateGate(cfg.igId))) return { ok: false, error: 'rate_limited_hourly' };
  try {
    const res = await fetch(`${GRAPH}/${commentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ message: String(message || '').slice(0, 2000) }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); return { ok: false, error: `IG ${res.status}: ${t.slice(0, 300)}` }; }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Приватный ответ на комментарий (первое сообщение в Директ): recipient = { comment_id }.
 *  Одно сообщение: карусель ЛИБО текст (+ быстрые ответы). */
export async function sendInstagramPrivateReply(
  cfg: IgConfig,
  commentId: string,
  intent: { text?: string; quickReplies?: IgQuickReply[]; cards?: CarouselCard[] }
): Promise<IgSendResult> {
  if (intent.cards && intent.cards.length > 0) {
    const elements = buildCarouselElements(intent.cards);
    if (elements.length > 0) return igSend(cfg, { comment_id: commentId }, { attachments: { type: 'template', payload: { template_type: 'generic', elements } } });
  }
  const body: any = { text: chunkByBytes(intent.text || ' ')[0] }; // приватный ответ = одно сообщение
  if (intent.quickReplies && intent.quickReplies.length > 0) body.quick_replies = quickReplyPayload(intent.quickReplies);
  return igSend(cfg, { comment_id: commentId }, body);
}

/** Ice Breakers (≤4 приветственных вопроса, на аккаунт). Пустой список → удаляет. */
export async function setInstagramIceBreakers(cfg: IgConfig, items: { question: string; payload?: string }[]): Promise<IgSendResult> {
  try {
    const clean = (items || [])
      .filter((i) => i?.question && i.question.trim())
      .slice(0, 4)
      .map((i) => ({ question: i.question.trim().slice(0, 80), payload: String(i.payload || i.question).slice(0, 1000) }));
    if (clean.length === 0) {
      const dr = await fetch(`${GRAPH}/me/messenger_profile`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
        body: JSON.stringify({ fields: ['ice_breakers'] }),
      });
      if (!dr.ok) { const t = await dr.text().catch(() => ''); return { ok: false, error: `IG ${dr.status}: ${t.slice(0, 200)}` }; }
      return { ok: true };
    }
    const res = await fetch(`${GRAPH}/me/messenger_profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ platform: 'instagram', ice_breakers: [{ call_to_actions: clean, locale: 'default' }] }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); return { ok: false, error: `IG ${res.status}: ${t.slice(0, 200)}` }; }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Текущие Ice Breakers аккаунта. */
export async function getInstagramIceBreakers(cfg: IgConfig): Promise<{ question: string; payload: string }[]> {
  try {
    const res = await fetch(`${GRAPH}/me/messenger_profile?fields=ice_breakers&access_token=${encodeURIComponent(cfg.accessToken)}`);
    if (!res.ok) return [];
    const j: any = await res.json().catch(() => null);
    const arr = j?.data?.[0]?.ice_breakers || j?.ice_breakers || [];
    const cta = Array.isArray(arr) && arr[0]?.call_to_actions ? arr[0].call_to_actions : [];
    return (cta || []).map((c: any) => ({ question: String(c?.question || ''), payload: String(c?.payload || '') })).filter((c: { question: string }) => c.question);
  } catch {
    return [];
  }
}
