/**
 * TikTok (Business Messaging API) — клиент отправки + авто-сообщения.
 *
 * ⚠️ ВАЖНО: точные пути/формы запросов TikTok Business Messaging API (v1.3) сверяются
 * при получении partner-доступа — здесь best-effort по докам 2026. Вся HTTP-специфика
 * изолирована в ttApiPost/ttApiGet, чтобы правка при интеграции была в одном месте.
 *
 * Возможности: текст + вертикальные быстрые ответы, изображение/видео (нативные превью
 * своих роликов), Welcome Message + Suggested Questions (≤3) через auto-messages,
 * публичный ответ на комментарий. Карусели НЕ поддержаны (см. capabilities).
 *
 * Лимиты соблюдаются через tt_ratelimit (48ч/10 на диалог) ДО фактической отправки.
 */

import type { TtConfig } from './tt_config.js';
import { ttCanSend } from './tt_ratelimit.js';

const API = (process.env.TIKTOK_API_BASE || 'https://business-api.tiktok.com/open_api/v1.3').replace(/\/+$/, '');
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');

// TODO(partner): сверить точные эндпоинты при получении доступа Messaging Partner.
const EP_SEND = '/business/message/send/';
const EP_AUTO_MESSAGES = '/business/message/automation/';

export interface TtSendResult { ok: boolean; error?: string }
export interface TtQuickReply { title: string; payload?: string }

function toAbsoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!PUBLIC_BASE_URL) return null;
  return `${PUBLIC_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function chunkByBytes(text: string, maxBytes = 900): string[] {
  const out: string[] = [];
  let cur = '';
  for (const ch of String(text)) {
    if (Buffer.byteLength(cur + ch, 'utf8') > maxBytes) { if (cur) out.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

async function ttApiPost(cfg: TtConfig, path: string, body: any): Promise<TtSendResult> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': cfg.accessToken },
      body: JSON.stringify({ business_id: cfg.accountId, ...body }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); return { ok: false, error: `TT ${res.status}: ${t.slice(0, 300)}` }; }
    // TikTok возвращает code!=0 при логических ошибках даже на HTTP 200.
    const j: any = await res.json().catch(() => null);
    if (j && typeof j.code === 'number' && j.code !== 0) return { ok: false, error: `TT code ${j.code}: ${String(j.message || '').slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function ttApiGet(cfg: TtConfig, path: string, params: Record<string, string> = {}): Promise<any> {
  try {
    const q = new URLSearchParams({ business_id: cfg.accountId, ...params }).toString();
    const res = await fetch(`${API}${path}?${q}`, { headers: { 'Access-Token': cfg.accessToken } });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

/** Текст (+ вертикальные быстрые ответы). Уважает лимит 48ч/10 на диалог. */
export async function sendTikTokText(cfg: TtConfig, userId: string, text: string, quickReplies?: TtQuickReply[]): Promise<TtSendResult> {
  const chunks = chunkByBytes(text || '');
  let last: TtSendResult = { ok: true };
  for (let i = 0; i < chunks.length; i++) {
    if (!ttCanSend(cfg.accountId, userId)) return { ok: false, error: 'tt_window_or_limit' };
    const isLast = i === chunks.length - 1;
    const message: any = { type: 'text', text: chunks[i] };
    if (isLast && quickReplies && quickReplies.length > 0) {
      message.quick_replies = quickReplies.slice(0, 10).map((q, idx) => ({ title: String(q.title || '').slice(0, 24), payload: String(q.payload ?? q.title ?? `qr${idx}`) }));
    }
    last = await ttApiPost(cfg, EP_SEND, { recipient_id: userId, message });
    if (!last.ok) return last;
  }
  return last;
}

/** Медиа по url (изображение/видео). */
export async function sendTikTokMedia(cfg: TtConfig, userId: string, media: { url?: string; type?: string }): Promise<TtSendResult> {
  const abs = toAbsoluteMediaUrl(media.url);
  if (!abs) return { ok: false, error: 'Нет публичного URL медиа (задайте PUBLIC_BASE_URL).' };
  if (!ttCanSend(cfg.accountId, userId)) return { ok: false, error: 'tt_window_or_limit' };
  const t = media.type === 'video' ? 'video' : 'image';
  return ttApiPost(cfg, EP_SEND, { recipient_id: userId, message: { type: t, [`${t}_url`]: abs } });
}

/** Публичный ответ на комментарий под видео (Comment-to-DM в TikTok = только публичный ответ). */
export async function replyTikTokComment(cfg: TtConfig, commentId: string, text: string): Promise<TtSendResult> {
  return ttApiPost(cfg, '/business/comment/reply/', { comment_id: commentId, text: String(text || '').slice(0, 500) });
}

/** Welcome Message (авто-приветствие при первом открытии чата). Пустой текст → выключить. */
export async function setTikTokWelcome(cfg: TtConfig, text: string): Promise<TtSendResult> {
  return ttApiPost(cfg, EP_AUTO_MESSAGES, { welcome_message: { enabled: !!text.trim(), text: String(text || '').slice(0, 500) } });
}

/** Suggested Questions (≤3 фиксированных вопроса при первом входе). Пустой список → выключить. */
export async function setTikTokSuggestedQuestions(cfg: TtConfig, items: string[]): Promise<TtSendResult> {
  const clean = (items || []).map((s) => String(s || '').trim()).filter(Boolean).slice(0, 3);
  return ttApiPost(cfg, EP_AUTO_MESSAGES, { suggested_questions: { enabled: clean.length > 0, questions: clean } });
}

/** Текущие авто-сообщения аккаунта (welcome + suggested). */
export async function getTikTokAutoMessages(cfg: TtConfig): Promise<{ welcome: string; suggested: string[] }> {
  const j = await ttApiGet(cfg, EP_AUTO_MESSAGES);
  const data = j?.data || j || {};
  const welcome = String(data?.welcome_message?.text || '');
  const suggested = Array.isArray(data?.suggested_questions?.questions) ? data.suggested_questions.questions.map((q: any) => String(q)) : [];
  return { welcome, suggested };
}
