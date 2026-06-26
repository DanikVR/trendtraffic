/**
 * Telegram Notifications — отправка админских уведомлений в Telegram.
 *
 * Бот-токен берётся из systemConfig (`telegramToken`), список получателей — из
 * `telegramAdminChatIds` (массив строк: приватные chat_id, group_id, channel_id).
 *
 * Используется хуками регистрации, биллинга и ежедневной сводки. Отправка best-effort —
 * никакая ошибка Telegram не должна валить бизнес-логику.
 */

import { getTelegramToken, getTelegramAdminChatIds, saveTelegramAdminChatIds } from '../../config/systemConfig.js';

const TELEGRAM_API = 'https://api.telegram.org';

/** Отправить одно сообщение в один chat. */
async function sendOne(token: string, chatId: string, text: string, parseMode: 'Markdown' | 'HTML' = 'HTML'): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[Telegram] sendMessage to ${chatId} failed: HTTP ${res.status} ${body.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[Telegram] sendMessage to ${chatId} threw:`, err);
    return false;
  }
}

/**
 * Шлёт сообщение всем настроенным админам.
 * Возвращает {sent, total} — сколько успешно ушло и сколько всего получателей.
 * Никогда не бросает: ошибка Telegram не должна валить бизнес-логику.
 */
export async function sendTelegramAdminMessage(text: string, parseMode: 'Markdown' | 'HTML' = 'HTML'): Promise<{ sent: number; total: number }> {
  const token = getTelegramToken();
  const chatIds = getTelegramAdminChatIds();
  if (!token || chatIds.length === 0) {
    return { sent: 0, total: chatIds.length };
  }
  let sent = 0;
  for (const id of chatIds) {
    const ok = await sendOne(token, id, text, parseMode);
    if (ok) sent++;
  }
  return { sent, total: chatIds.length };
}

/**
 * Подтянуть свежие chat_id через Telegram getUpdates.
 * Возвращает уникальный список chat_id, обнаруженный в недавних апдейтах бота
 * (приватные сообщения, добавления в группы/каналы).
 *
 * Слитие со старым списком — на стороне sync роута, чтобы решить mode (replace/merge).
 */
export async function discoverChatIdsFromUpdates(): Promise<{
  chatIds: string[];
  rawCount: number;
  details: Array<{ chatId: string; type: string; title?: string }>;
}> {
  const token = getTelegramToken();
  if (!token) throw new Error('Telegram Bot Token не настроен в /admin/config.');

  // offset=0 + limit=100 — Telegram отдаёт неподтверждённые апдейты за последние 24ч.
  const url = `${TELEGRAM_API}/bot${token}/getUpdates?limit=100&allowed_updates=${encodeURIComponent(JSON.stringify(['message','my_chat_member','channel_post']))}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram getUpdates HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data: any = await res.json();
  if (!data.ok) throw new Error(`Telegram getUpdates error: ${data.description}`);

  const updates: any[] = Array.isArray(data.result) ? data.result : [];
  const map = new Map<string, { chatId: string; type: string; title?: string }>();

  for (const u of updates) {
    // Источники chat: message, channel_post, my_chat_member, edited_message
    const chat = u.message?.chat || u.channel_post?.chat || u.my_chat_member?.chat || u.edited_message?.chat;
    if (chat?.id !== undefined) {
      const id = String(chat.id);
      if (!map.has(id)) {
        map.set(id, {
          chatId: id,
          type: chat.type || 'unknown',
          title: chat.title || chat.username || chat.first_name || undefined,
        });
      }
    }
  }

  return {
    chatIds: Array.from(map.keys()),
    rawCount: updates.length,
    details: Array.from(map.values()),
  };
}

/**
 * Получить информацию о боте (username) — для отображения в UI «вот ссылка t.me/<bot>».
 * Возвращает null, если токен не задан/невалиден.
 */
export async function getBotInfo(): Promise<{ username: string; firstName: string; id: number } | null> {
  const token = getTelegramToken();
  if (!token) return null;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getMe`);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data.ok) return null;
    return {
      username: data.result.username,
      firstName: data.result.first_name,
      id: data.result.id,
    };
  } catch {
    return null;
  }
}

// Реэкспорт saveTelegramAdminChatIds для удобства роутов
export { getTelegramAdminChatIds, saveTelegramAdminChatIds };
