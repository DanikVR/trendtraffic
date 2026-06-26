/**
 * Telegram-уведомления Enterprise — модель подписчиков.
 *
 * Концепция (v0.10.10): Enterprise-владелец вставляет токен своего бота → backend
 * через /getUpdates находит ВСЕХ кто написал боту /start (или был в группе/канале) →
 * сохраняет их chat_id'ы в БД → рассылает каждому уведомления при событиях.
 *
 * Это позволяет:
 *  - Владельцу не возиться с chat_id, не искать у @userinfobot.
 *  - Несколько человек могут подписаться на уведомления одного аккаунта
 *    (напр. админ + второй сотрудник — оба пишут боту /start, оба получают).
 *  - Бот можно добавить в группу/канал — туда тоже придут уведомления.
 *
 * Глобальный VibeVox-бот НЕ используется для Enterprise — он только для суперадминских
 * broadcast'ов через notifications/telegram.ts.
 */

import pool from '../../db/index.js';
import { encryptSecret, decryptSecret } from './encryption.js';

const TELEGRAM_API = 'https://api.telegram.org';

// ============================================================================
// Типы
// ============================================================================

export interface Subscriber {
  chatId: string;
  type: 'private' | 'group' | 'supergroup' | 'channel' | 'unknown';
  title: string;          // username / first_name / название группы
  addedAt: string;        // ISO timestamp когда добавлен
}

export interface BotInfo {
  ok: boolean;
  username?: string;
  firstName?: string;
  id?: number;
  error?: string;
}

// ============================================================================
// Bot token владельца
// ============================================================================

export async function getOwnerBotToken(tenantId: string): Promise<string | null> {
  try {
    const res = await pool.query(
      'SELECT owner_telegram_bot_token_encrypted FROM tenants WHERE id = $1',
      [tenantId]
    );
    return decryptSecret(res.rows[0]?.owner_telegram_bot_token_encrypted || null);
  } catch (err) {
    console.warn('[owner_telegram] Ошибка чтения bot_token:', err);
    return null;
  }
}

export async function setOwnerBotToken(tenantId: string, rawToken: string | null): Promise<void> {
  const encrypted = encryptSecret(rawToken);
  await pool.query(
    'UPDATE tenants SET owner_telegram_bot_token_encrypted = $1 WHERE id = $2',
    [encrypted, tenantId]
  );
  // Если токен удаляется — чистим и подписчиков (они от старого бота)
  if (!rawToken) {
    await pool.query(
      'UPDATE tenants SET owner_telegram_subscribers = $1 WHERE id = $2',
      [JSON.stringify([]), tenantId]
    );
  }
}

// ============================================================================
// Подписчики
// ============================================================================

export async function getSubscribers(tenantId: string): Promise<Subscriber[]> {
  try {
    const res = await pool.query(
      'SELECT owner_telegram_subscribers FROM tenants WHERE id = $1',
      [tenantId]
    );
    const raw = res.rows[0]?.owner_telegram_subscribers;
    if (!raw) return [];
    if (typeof raw === 'string') return JSON.parse(raw);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function saveSubscribers(tenantId: string, subscribers: Subscriber[]): Promise<void> {
  await pool.query(
    'UPDATE tenants SET owner_telegram_subscribers = $1 WHERE id = $2',
    [JSON.stringify(subscribers), tenantId]
  );
}

// ============================================================================
// Проверка токена через /getMe
// ============================================================================

export async function checkBotToken(token: string): Promise<BotInfo> {
  if (!token || !token.includes(':')) {
    return { ok: false, error: 'Невалидный формат токена (ожидается «123456:ABC-DEF…»)' };
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getMe`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data: any = await res.json();
    if (!data.ok) return { ok: false, error: data.description || 'unknown' };
    return {
      ok: true,
      username: data.result?.username,
      firstName: data.result?.first_name,
      id: data.result?.id,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ============================================================================
// Refresh подписчиков через /getUpdates
// ============================================================================

export interface RefreshResult {
  ok: boolean;
  total: number;          // всего подписчиков после refresh
  added: number;          // сколько НОВЫХ добавлено
  subscribers: Subscriber[];
  error?: string;
}

/**
 * Тянет /getUpdates у бота, добавляет всех найденных chat'ов в БД (без дубликатов).
 * Существующие подписчики сохраняются — это аддитивная операция.
 *
 * НЮАНСЫ Telegram Bot API:
 *  1. Если у бота установлен webhook (через setWebhook), getUpdates ВСЕГДА возвращает
 *     пустой массив — мы перед вызовом делаем deleteWebhook для надёжности.
 *  2. getUpdates имеет внутренний offset: после вызова с offset=N+1 предыдущие
 *     updates больше не возвращаются. Чтобы не терять данные — используем offset=-100
 *     (получить последние 100 апдейтов и acknowledge'нуть их). Все полученные chat'ы
 *     сохраняются в нашу БД, поэтому потеря Telegram-state некритична.
 *  3. Telegram хранит updates ~24 часа. Если пользователь подписался давно и больше
 *     не писал — он может выпасть из updates. Но если он уже в нашей БД — остаётся там.
 */
export async function refreshSubscribers(tenantId: string): Promise<RefreshResult> {
  const token = await getOwnerBotToken(tenantId);
  if (!token) return { ok: false, total: 0, added: 0, subscribers: [], error: 'Бот не подключён' };

  try {
    // 1. Best-effort: отключаем webhook (на случай если он был установлен — иначе getUpdates не работает).
    //    drop_pending_updates=false — не теряем уже накопленные сообщения.
    try {
      await fetch(`${TELEGRAM_API}/bot${token}/deleteWebhook?drop_pending_updates=false`, { method: 'POST' });
    } catch {}

    // 2. getUpdates с offset=-100 — получаем последние 100 апдейтов и acknowledge'ним их.
    //    Это безопасно потому что мы сохраняем chat'ов в свою БД, не зависим от Telegram state.
    const url = `${TELEGRAM_API}/bot${token}/getUpdates?offset=-100&limit=100&allowed_updates=${encodeURIComponent(
      JSON.stringify(['message', 'my_chat_member', 'channel_post', 'edited_message'])
    )}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, total: 0, added: 0, subscribers: [], error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data: any = await res.json();
    if (!data.ok) {
      return { ok: false, total: 0, added: 0, subscribers: [], error: data.description || 'unknown' };
    }
    const updates: any[] = Array.isArray(data.result) ? data.result : [];

    // Текущие подписчики (по chatId для дедупа)
    const existing = await getSubscribers(tenantId);
    const map = new Map<string, Subscriber>();
    for (const s of existing) map.set(s.chatId, s);

    let added = 0;
    for (const u of updates) {
      const chat = u.message?.chat || u.channel_post?.chat || u.my_chat_member?.chat || u.edited_message?.chat;
      if (chat?.id === undefined) continue;
      const id = String(chat.id);
      if (map.has(id)) continue; // уже есть
      const sub: Subscriber = {
        chatId: id,
        type: (chat.type as Subscriber['type']) || 'unknown',
        title: chat.title || chat.username || chat.first_name || `chat #${id}`,
        addedAt: new Date().toISOString(),
      };
      map.set(id, sub);
      added++;
    }

    const merged = Array.from(map.values());
    if (added > 0) await saveSubscribers(tenantId, merged);

    return { ok: true, total: merged.length, added, subscribers: merged };
  } catch (err: any) {
    return { ok: false, total: 0, added: 0, subscribers: [], error: err?.message || String(err) };
  }
}

/**
 * Удалить одного подписчика (например, если владелец хочет исключить кого-то).
 */
export async function removeSubscriber(tenantId: string, chatId: string): Promise<void> {
  const list = await getSubscribers(tenantId);
  const filtered = list.filter((s) => s.chatId !== chatId);
  if (filtered.length !== list.length) await saveSubscribers(tenantId, filtered);
}

// ============================================================================
// Отправка уведомлений — РАССЫЛКА ВСЕМ ПОДПИСЧИКАМ
// ============================================================================

export interface BroadcastResult {
  sent: number;
  failed: number;
  total: number;
}

/**
 * Рассылает сообщение всем подписчикам бота этого tenant'а. Best-effort:
 * ошибка одного получателя не блокирует остальных.
 *
 * @returns статистика {sent, failed, total}
 */
export async function sendOwnerNotification(
  tenantId: string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<BroadcastResult> {
  const token = await getOwnerBotToken(tenantId);
  if (!token) return { sent: 0, failed: 0, total: 0 };

  const subscribers = await getSubscribers(tenantId);
  if (subscribers.length === 0) return { sent: 0, failed: 0, total: 0 };

  let sent = 0;
  let failed = 0;
  await Promise.all(subscribers.map(async (sub) => {
    try {
      const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: sub.chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });
      if (res.ok) sent++; else failed++;
    } catch {
      failed++;
    }
  }));

  return { sent, failed, total: subscribers.length };
}

// ============================================================================
// Тестовая рассылка (для кнопки «Отправить тест»)
// ============================================================================

export interface TestSendResult {
  ok: boolean;
  bot?: { username: string; id: number };
  broadcast?: BroadcastResult;
  error?: string;
}

export async function sendTestMessage(tenantId: string): Promise<TestSendResult> {
  const token = await getOwnerBotToken(tenantId);
  if (!token) return { ok: false, error: 'Сначала сохраните токен бота.' };

  const info = await checkBotToken(token);
  if (!info.ok) return { ok: false, error: `Токен невалидный: ${info.error}` };

  // ВАЖНО: каждый раз перед тестом делаем refresh — собираем тех кто только что нажал /start.
  // Это позволяет не показывать пользователю отдельную кнопку «Обновить подписчиков».
  await refreshSubscribers(tenantId);

  const subscribers = await getSubscribers(tenantId);
  if (subscribers.length === 0) {
    return {
      ok: false,
      bot: { username: info.username!, id: info.id! },
      error: `У бота @${info.username} нет подписчиков. Откройте бота https://t.me/${info.username}, напишите /start, потом снова нажмите «Выслать тест».`,
    };
  }

  const text =
    `<b>✅ Тест VibeVox</b>\n\n` +
    `Это тестовое сообщение от вашего бота <b>@${info.username}</b>.\n` +
    `Подписчиков: <b>${subscribers.length}</b>.\n\n` +
    `Сюда будут приходить:\n` +
    `• 🆕 Новые клиенты через Quest Flow\n` +
    `• 🏷 Выявленные потребности (теги)\n` +
    `• ⚠️ Ошибки Gemini-ключа / квоты`;

  const broadcast = await sendOwnerNotification(tenantId, text);
  return {
    ok: broadcast.sent > 0,
    bot: { username: info.username!, id: info.id! },
    broadcast,
  };
}
