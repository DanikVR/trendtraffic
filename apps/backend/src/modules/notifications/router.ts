/**
 * Admin Notifications router — управление Telegram-получателями.
 *
 * Все эндпоинты требуют JWT суперадмина.
 *
 * Поток первичной настройки:
 *  1. Юзер вводит TELEGRAM_BOT_TOKEN через /admin/config (он там уже есть).
 *  2. Юзер пишет боту в Telegram любое сообщение, либо добавляет бота в группу/канал.
 *  3. Юзер нажимает «Синхронизировать получателей» — мы дёргаем Telegram getUpdates,
 *     извлекаем chat_id и сохраняем в systemConfig.telegramAdminChatIds.
 *  4. «Отправить тест» — рассылает короткое тестовое сообщение всем.
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  sendTelegramAdminMessage,
  discoverChatIdsFromUpdates,
  getBotInfo,
  getTelegramAdminChatIds,
  saveTelegramAdminChatIds,
} from './telegram.js';
import { sendDailySummaryNow } from './daily_summary.js';
import { send500 } from '../../utils/http_error.js';

const notificationsRouter = Router();
import { JWT_SECRET } from '../../config/secrets.js';

function requireSuperAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован: отсутствует заголовок Authorization. Перелогиньтесь.' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ error: 'Только суперадмин может выполнять это действие.' });
    }
    next();
  } catch (err: any) {
    const name = err?.name || 'Error';
    if (name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Сессия истекла. Выйдите и войдите снова.' });
    }
    return res.status(401).json({ error: `Невалидный токен (${name}). Попробуйте перелогиниться.` });
  }
}

notificationsRouter.use(requireSuperAdmin);

/**
 * GET /api/admin/notifications/status
 * Возвращает: { botUsername, chatIds: string[], details: [{chatId, type, title}] }
 */
notificationsRouter.get('/status', async (_req: Request, res: Response) => {
  const bot = await getBotInfo();
  const chatIds = getTelegramAdminChatIds();
  return res.json({
    botConfigured: !!bot,
    botUsername: bot?.username || null,
    botFirstName: bot?.firstName || null,
    chatIds,
    chatIdsCount: chatIds.length,
  });
});

/**
 * POST /api/admin/notifications/sync
 * Подтягивает свежие chat_id через Telegram getUpdates и сохраняет в config.
 * mode: 'replace' (по умолчанию) или 'merge'.
 */
notificationsRouter.post('/sync', async (req: Request, res: Response) => {
  const mode = (req.body?.mode === 'merge' ? 'merge' : 'replace') as 'merge' | 'replace';
  try {
    const { chatIds: discovered, rawCount, details } = await discoverChatIdsFromUpdates();
    if (discovered.length === 0) {
      return res.status(200).json({
        status: 'empty',
        message: rawCount === 0
          ? 'Telegram не вернул ни одного апдейта. Напишите боту любое сообщение и попробуйте снова.'
          : 'В апдейтах нет идентификаторов чатов. Если бот в канале — добавьте его как админа и отправьте туда хотя бы одно сообщение.',
        chatIds: getTelegramAdminChatIds(),
        details: [],
      });
    }

    let nextIds: string[];
    if (mode === 'merge') {
      nextIds = Array.from(new Set([...getTelegramAdminChatIds(), ...discovered]));
    } else {
      nextIds = discovered;
    }
    saveTelegramAdminChatIds(nextIds);

    return res.json({
      status: 'success',
      mode,
      message: `Найдено ${discovered.length} получателей, сохранено ${nextIds.length}.`,
      chatIds: nextIds,
      details,
    });
  } catch (err: any) {
    return send500(res, err, 'notifications');
  }
});

/**
 * POST /api/admin/notifications/test
 * Отправляет тестовое сообщение всем настроенным админам.
 */
notificationsRouter.post('/test', async (_req: Request, res: Response) => {
  // Если получателей ещё нет — попробуем автоматически подтянуть через getUpdates.
  if (getTelegramAdminChatIds().length === 0) {
    try {
      const discovered = await discoverChatIdsFromUpdates();
      if (discovered.chatIds.length > 0) {
        saveTelegramAdminChatIds(discovered.chatIds);
      }
    } catch { /* ignore */ }
  }
  if (getTelegramAdminChatIds().length === 0) {
    const bot = await getBotInfo();
    return res.status(400).json({
      error: 'Бот пока не получил ни одного сообщения. Telegram запрещает боту писать первым. Откройте бота и нажмите /start.',
      botUsername: bot?.username || null,
      botLink: bot?.username ? `https://t.me/${bot.username}` : null,
      hint: 'После /start вернитесь и снова нажмите «Отправить тест».',
    });
  }
  const text = `<b>VibeVox</b> — тестовое уведомление.\nЕсли вы это видите — Telegram-уведомления настроены корректно ✅`;
  const { sent, total } = await sendTelegramAdminMessage(text, 'HTML');
  return res.json({
    status: sent === total ? 'success' : 'partial',
    message: `Отправлено ${sent} из ${total} получателям.`,
    sent,
    total,
  });
});

/**
 * POST /api/admin/notifications/test-all
 * Прогоняет примеры всех типов уведомлений, заложенных в системе.
 * Отправляет 5 сообщений подряд (между ними небольшая задержка, чтобы Telegram не сёл из-за rate limit).
 * Полезно чтобы один раз увидеть, как выглядят все уведомления, не дожидаясь реальных событий.
 */
notificationsRouter.post('/test-all', async (_req: Request, res: Response) => {
  // Если получателей нет — пробуем подтянуть их сразу через getUpdates.
  // Это убирает требование «сначала Sync, потом Test» — пользователь нажимает один раз.
  if (getTelegramAdminChatIds().length === 0) {
    try {
      const discovered = await discoverChatIdsFromUpdates();
      if (discovered.chatIds.length > 0) {
        saveTelegramAdminChatIds(discovered.chatIds);
      }
    } catch { /* игнорируем — мы вернём осмысленную ошибку ниже */ }
  }
  if (getTelegramAdminChatIds().length === 0) {
    const bot = await getBotInfo();
    return res.status(400).json({
      error: 'Бот пока не получил ни одного сообщения. Telegram запрещает боту писать первым. Откройте бота и нажмите /start.',
      botUsername: bot?.username || null,
      botLink: bot?.username ? `https://t.me/${bot.username}` : null,
      hint: 'После /start вернитесь и снова нажмите «ТЕСТ всех уведомлений» — chat_id подтянется автоматически.',
    });
  }

  const samples: { label: string; text: string }[] = [
    {
      label: 'registration',
      text:
        `🧪 <b>ТЕСТ — новая регистрация</b>\n` +
        `<b>Email:</b> test.user@example.com\n` +
        `<b>Организация:</b> Test Org Ltd\n` +
        `<b>Баланс:</b> 0 минут (нужно оформить тариф)\n` +
        `<b>Tenant:</b> <code>00000000-0000-0000-0000-000000000001</code>`,
    },
    {
      label: 'subscription',
      text:
        `🧪 <b>ТЕСТ — оплачена подписка</b>\n` +
        `<b>Email:</b> test.user@example.com\n` +
        `<b>Тариф:</b> standard (monthly)\n` +
        `<b>Минут начислено:</b> 120\n` +
        `<b>Статус:</b> active`,
    },
    {
      label: 'topup',
      text:
        `🧪 <b>ТЕСТ — докупка минут</b>\n` +
        `<b>Email:</b> test.user@example.com\n` +
        `<b>Добавлено:</b> 60 мин`,
    },
    {
      label: 'admin-credit',
      text:
        `🧪 <b>ТЕСТ — админ-кредит минут</b>\n` +
        `<b>Кому:</b> test.user@example.com\n` +
        `<b>Минут:</b> 100\n` +
        `<b>Кто:</b> superadmin\n` +
        `<b>Комментарий:</b> компенсация (тестовое сообщение)`,
    },
  ];

  const results: { label: string; sent: number; total: number }[] = [];
  for (const s of samples) {
    const r = await sendTelegramAdminMessage(s.text, 'HTML');
    results.push({ label: s.label, ...r });
    await new Promise(resolve => setTimeout(resolve, 350)); // anti-flood
  }

  // Утренняя сводка — формат как у реального scheduler, только с префиксом
  try {
    const { sent, total, text } = await sendDailySummaryNow();
    results.push({ label: 'daily-summary', sent, total });
    void text; // не возвращаем preview наружу — он уже ушёл получателю
  } catch (err) {
    results.push({ label: 'daily-summary', sent: 0, total: 0 });
  }

  const totalSent = results.reduce((a, r) => a + r.sent, 0);
  const totalAttempted = results.reduce((a, r) => a + r.total, 0);
  return res.json({
    status: 'success',
    message: `Отправлено ${totalSent} сообщений (${results.length} типов × ${getTelegramAdminChatIds().length} получателей).`,
    results,
    totalSent,
    totalAttempted,
  });
});

/**
 * POST /api/admin/notifications/summary-now
 * Собирает текущую сводку и отправляет всем получателям. Полезно для проверки.
 */
notificationsRouter.post('/summary-now', async (_req: Request, res: Response) => {
  try {
    const { sent, total, text } = await sendDailySummaryNow();
    if (total === 0) {
      return res.status(400).json({ error: 'Нет настроенных получателей.' });
    }
    return res.json({ status: 'success', sent, total, preview: text });
  } catch (err: any) {
    return send500(res, err, 'notifications');
  }
});

/**
 * DELETE /api/admin/notifications/chat/:chatId
 * Удалить одного получателя.
 */
notificationsRouter.delete('/chat/:chatId', (req: Request, res: Response) => {
  const target = String(req.params.chatId);
  const remaining = getTelegramAdminChatIds().filter(x => x !== target);
  saveTelegramAdminChatIds(remaining);
  return res.json({ status: 'success', chatIds: remaining });
});

export default notificationsRouter;
