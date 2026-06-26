/**
 * WhatsApp (Cloud API) — клиент отправки. Свободные сообщения только в окне 24ч
 * (waWithinWindow); вне окна — нужен шаблон (фаза WA-1), здесь блокируем.
 *
 * Cloud API: POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
 *   Authorization: Bearer <ACCESS_TOKEN>
 *   body: { messaging_product:'whatsapp', to, type, ... }
 *
 * В сессии доступно: text, interactive button (≤3 reply), interactive list (≤10),
 * single cta_url, media (image/video/document/audio по публичному HTTPS-url).
 * Микс url+call+copy-code кнопок = только шаблоны (WA-1).
 */

import type { WaConfig } from './wa_config.js';
import { waWithinWindow } from './wa_window.js';

const API = (process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v21.0').replace(/\/+$/, '');
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');

export interface WaSendResult { ok: boolean; error?: string }
export interface WaButton { id: string; title: string }
export interface WaRow { id: string; title: string; description?: string }

function toAbsoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!PUBLIC_BASE_URL) return null;
  return `${PUBLIC_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function chunkByChars(text: string, max = 3500): string[] {
  const s = String(text);
  if (s.length <= max) return [s || ''];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
  return out;
}

async function waSend(cfg: WaConfig, waId: string, payload: any): Promise<WaSendResult> {
  if (!waWithinWindow(cfg.phoneNumberId, waId)) return { ok: false, error: 'outside_24h_window' };
  try {
    const res = await fetch(`${API}/${cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.accessToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: waId, ...payload }),
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); return { ok: false, error: `WA ${res.status}: ${t.slice(0, 300)}` }; }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Текст (длинный режется на части по 3500 симв.; превью ссылок включено). */
export async function sendWaText(cfg: WaConfig, waId: string, text: string): Promise<WaSendResult> {
  const chunks = chunkByChars(text || '');
  let last: WaSendResult = { ok: true };
  for (const c of chunks) {
    last = await waSend(cfg, waId, { type: 'text', text: { body: c, preview_url: true } });
    if (!last.ok) return last;
  }
  return last;
}

/** Интерактивные reply-кнопки (≤3, title ≤20). */
export async function sendWaButtons(cfg: WaConfig, waId: string, text: string, buttons: WaButton[]): Promise<WaSendResult> {
  const btns = buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: String(b.id).slice(0, 256), title: String(b.title || '').slice(0, 20) } }));
  return waSend(cfg, waId, { type: 'interactive', interactive: { type: 'button', body: { text: String(text || ' ').slice(0, 1024) }, action: { buttons: btns } } });
}

/** Список выбора (≤10 пунктов). */
export async function sendWaList(cfg: WaConfig, waId: string, text: string, menuLabel: string, rows: WaRow[]): Promise<WaSendResult> {
  const r = rows.slice(0, 10).map((x) => ({ id: String(x.id).slice(0, 200), title: String(x.title || '').slice(0, 24), description: x.description ? String(x.description).slice(0, 72) : undefined }));
  return waSend(cfg, waId, { type: 'interactive', interactive: { type: 'list', body: { text: String(text || ' ').slice(0, 1024) }, action: { button: String(menuLabel || 'Выбрать').slice(0, 20), sections: [{ rows: r }] } } });
}

/** Одна CTA-кнопка-ссылка (в сессии доступна одна; больше — через шаблон WA-1). */
export async function sendWaCtaUrl(cfg: WaConfig, waId: string, text: string, displayText: string, url: string): Promise<WaSendResult> {
  return waSend(cfg, waId, { type: 'interactive', interactive: { type: 'cta_url', body: { text: String(text || ' ').slice(0, 1024) }, action: { name: 'cta_url', parameters: { display_text: String(displayText || 'Открыть').slice(0, 20), url } } } });
}

/** Медиа по публичному HTTPS-url (изображение/видео/документ/аудио). */
export async function sendWaMedia(cfg: WaConfig, waId: string, media: { url?: string; type?: string; caption?: string }): Promise<WaSendResult> {
  const abs = toAbsoluteMediaUrl(media.url);
  if (!abs) return { ok: false, error: 'Нет публичного URL медиа (задайте PUBLIC_BASE_URL).' };
  const t = media.type === 'video' ? 'video' : media.type === 'audio' ? 'audio' : media.type === 'file' || media.type === 'document' ? 'document' : 'image';
  const obj: any = { link: abs };
  if (media.caption && t !== 'audio') obj.caption = String(media.caption).slice(0, 1024);
  return waSend(cfg, waId, { type: t, [t]: obj });
}
