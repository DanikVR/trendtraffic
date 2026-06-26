/**
 * TikTok анти-бан: «Правило 48 часов» + «Лимит 10 сообщений» (жёсткие лимиты TikTok 2026).
 *
 *  • Окно взаимодействия — 48 ч с последнего сообщения/действия пользователя.
 *  • ≤10 сообщений бота подряд в рамках окна, если пользователь не отвечает/не жмёт.
 *  • Любое входящее/действие пользователя ОБНУЛЯЕТ счётчик и перезапускает окно.
 *
 * Лимит — НА ДИАЛОГ (accountId:userId), in-memory. Сверх лимита/окна — skip.
 */

const WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_PER_WINDOW = 10;

interface Convo { count: number; windowStart: number }
const convos = new Map<string, Convo>();

function key(accountId: string, userId: string): string {
  return `${accountId}:${userId}`;
}

/** Входящее/действие пользователя → сброс счётчика и перезапуск окна. */
export function ttResetWindow(accountId: string, userId: string): void {
  convos.set(key(accountId, userId), { count: 0, windowStart: Date.now() });
}

/**
 * Можно ли боту отправить сообщение в этот диалог сейчас.
 * false — окно истекло (юзер не писал >48ч) ИЛИ исчерпан лимит 10. Инкрементит при true.
 */
export function ttCanSend(accountId: string, userId: string): boolean {
  const now = Date.now();
  const c = convos.get(key(accountId, userId));
  if (!c) return false;                                  // окна нет (бот не может писать первым)
  if (now - c.windowStart > WINDOW_MS) return false;     // окно 48ч истекло
  if (c.count >= MAX_PER_WINDOW) return false;           // исчерпан лимит 10
  c.count++;
  return true;
}
