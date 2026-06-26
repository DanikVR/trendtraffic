/**
 * Rollover-планировщик для минут.
 *
 * Логика по согласованным правилам:
 *  - Неиспользованные минуты переносятся на ОДИН следующий цикл (месяц).
 *  - На втором цикле без расхода — сгорают.
 *
 * Реализация:
 *  - Каждый час (cron-like setInterval) пробегаем подписки, у которых current_period_end в прошлом.
 *  - При переносе:
 *      previous_balance = current balance
 *      new rollover_seconds = previous_balance  (старый rollover сгорает, его место занимает новый)
 *      new translation_minutes_balance = TIER_SECONDS_MAP[tier]  (новый цикл, новый пакет)
 *      current_period_end = now + 30 days (или 365, для yearly)
 *      last_rollover_at = now
 *
 * Внимание: для Stripe-подписок периоды устанавливает сам Stripe через webhooks subscription.updated.
 * Этот rollover работает только для записей БЕЗ stripe_subscription_id (внутренние/тестовые),
 * либо как страховка если webhook не пришёл вовремя.
 */

import pool from '../../db/index.js';
import { TIER_SECONDS_MAP } from '@vibevox/shared';

const ROLLOVER_INTERVAL_MS = 60 * 60 * 1000; // 1 час
let rolloverTimer: ReturnType<typeof setInterval> | null = null;
// Счётчик подряд неудачных проходов — для эскалации в Telegram при систематических сбоях.
let consecutiveFailures = 0;
const FAILURE_ALERT_THRESHOLD = 5;

export async function performRolloverPass(): Promise<{ rolled: number; expired: number }> {
  let rolled = 0;
  let expired = 0;
  const now = new Date();

  try {
    // Берём все подписки с истёкшим current_period_end
    const res = await pool.query(
      `SELECT tenant_id, tier, status, billing_period,
              translation_minutes_balance, rollover_seconds, current_period_end
       FROM subscriptions
       WHERE status = 'active' AND current_period_end IS NOT NULL AND current_period_end < $1`,
      [now]
    );

    for (const sub of res.rows) {
      const tier = sub.tier;
      const balance = Number(sub.translation_minutes_balance || 0);
      // Новый rollover = текущий неиспользованный балансовый остаток (но НЕ старый rollover — он сгорает)
      const newRollover = balance;
      // Новый balance = свежий пакет тарифа
      const fresh = TIER_SECONDS_MAP[tier] ?? 0;
      // Период: monthly → +30 дней, yearly → +365 дней
      const isYearly = sub.billing_period === 'yearly' || tier === 'standard_yearly';
      const newPeriodEnd = new Date(now.getTime() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000);

      await pool.query(
        `UPDATE subscriptions
         SET translation_minutes_balance = $1,
             rollover_seconds = $2,
             current_period_end = $3,
             last_rollover_at = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $5`,
        [fresh, newRollover, newPeriodEnd, now, sub.tenant_id]
      );
      rolled += 1;
      // Если предыдущий rollover был > 0 — это значит мы его потеряли (сгорел)
      if (Number(sub.rollover_seconds || 0) > 0) expired += 1;
    }

    if (rolled > 0) {
      console.log(`[Billing.rollover] Pass: ${rolled} rolled, ${expired} burned`);
    }
  } catch (err) {
    console.warn('[Billing.rollover] Ошибка прохода:', (err as Error).message);
  }

  return { rolled, expired };
}

/**
 * Запускает rollover-проход и логирует любую необработанную ошибку.
 * Считает подряд идущие сбои; при достижении порога — отправляет алерт админам в Telegram.
 * Никогда не бросает наружу: scheduler не должен падать из-за одного плохого прохода.
 */
async function safeRolloverPass(trigger: 'startup' | 'interval'): Promise<void> {
  try {
    await performRolloverPass();
    consecutiveFailures = 0;
  } catch (err) {
    consecutiveFailures += 1;
    console.error(
      `[Billing.rollover] ${trigger} pass failed (streak=${consecutiveFailures}):`,
      err
    );
    if (consecutiveFailures === FAILURE_ALERT_THRESHOLD) {
      // Динамический импорт, чтобы не создавать цикл и работать даже если notifications недоступен.
      import('../notifications/telegram.js')
        .then(({ sendTelegramAdminMessage }) =>
          sendTelegramAdminMessage(
            `⚠️ <b>Billing rollover</b>: ${FAILURE_ALERT_THRESHOLD} подряд неудачных проходов. Проверь логи backend.`,
            'HTML'
          )
        )
        .catch((alertErr) =>
          console.error('[Billing.rollover] Не удалось отправить алерт админу:', alertErr)
        );
    }
  }
}

export function startRolloverScheduler(): void {
  if (rolloverTimer) return;
  // Первый прогон через 30 сек после старта, затем каждый час
  setTimeout(() => {
    void safeRolloverPass('startup');
  }, 30 * 1000);
  rolloverTimer = setInterval(() => {
    void safeRolloverPass('interval');
  }, ROLLOVER_INTERVAL_MS);
  console.log('[Billing.rollover] Планировщик запущен (раз в час)');
}

export function stopRolloverScheduler(): void {
  if (rolloverTimer) {
    clearInterval(rolloverTimer);
    rolloverTimer = null;
  }
}
