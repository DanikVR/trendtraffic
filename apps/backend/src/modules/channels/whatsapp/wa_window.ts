/**
 * WhatsApp анти-бан/анти-стоимость: «24-часовое диалоговое окно».
 *
 * Свободные сообщения (текст/медиа/интерактив) бот может слать ТОЛЬКО в течение
 * 24 ч с последнего входящего клиента. Вне окна — ТОЛЬКО одобренные шаблоны
 * (фаза WA-1). Поэтому свободные отправки вне окна блокируем.
 *
 * Скорость WhatsApp НЕ банит (Cloud API ~250–1000/сек) — банят жалобы юзеров,
 * поэтому пер-секундный лимитер не нужен; ключевая защита = это окно + opt-out.
 *
 * In-memory; ключ = phoneNumberId:waId.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;
const lastInbound = new Map<string, number>();

function key(phoneNumberId: string, waId: string): string {
  return `${phoneNumberId}:${waId}`;
}

/** Входящее клиента → открыть/продлить окно 24ч. */
export function openWaWindow(phoneNumberId: string, waId: string): void {
  lastInbound.set(key(phoneNumberId, waId), Date.now());
}

/** Внутри ли 24ч-окна (можно слать свободные сообщения). */
export function waWithinWindow(phoneNumberId: string, waId: string): boolean {
  const t = lastInbound.get(key(phoneNumberId, waId));
  return !!t && Date.now() - t < WINDOW_MS;
}
