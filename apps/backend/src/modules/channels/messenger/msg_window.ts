/**
 * Messenger — окно 24ч (Standard Messaging). Свободные сообщения только в течение
 * 24ч с последнего входящего; вне окна — лишь Message Tags (разрешённые типы) —
 * фаза позже. Здесь свободные отправки вне окна блокируем.
 *
 * Скорость не банит — защита = окно + качество. In-memory; ключ = pageId:psid.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;
const lastInbound = new Map<string, number>();

const key = (pageId: string, psid: string) => `${pageId}:${psid}`;

export function openMsgWindow(pageId: string, psid: string): void {
  lastInbound.set(key(pageId, psid), Date.now());
}

export function msgWithinWindow(pageId: string, psid: string): boolean {
  const t = lastInbound.get(key(pageId, psid));
  return !!t && Date.now() - t < WINDOW_MS;
}
