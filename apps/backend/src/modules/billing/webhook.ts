/**
 * Stripe Webhook handler.
 *
 * ВАЖНО: монтируется отдельно в server.ts с `express.raw({ type: 'application/json' })`,
 * потому что для проверки подписи stripe-signature нужно неизменённое тело запроса.
 *
 * Ключи читаются динамически через systemConfig — суперадмин может ввести их через UI.
 * Если ключи не настроены — возвращаем 503, не падаем.
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import pool, { runInTenantContext } from '../../db/index.js';
import { TIER_SECONDS_MAP } from '@vibevox/shared';
import { getStripeSecretKey, getStripeWebhookSecret } from '../../config/systemConfig.js';
import { sendTelegramAdminMessage } from '../notifications/telegram.js';
import { creditReferralPayment } from '../partners/router.js';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Email пользователя по tenant_id для красивых уведомлений. Возвращает null при ошибке. */
async function getTenantPrimaryEmail(tenantId: string): Promise<string | null> {
  try {
    const r = await pool.query(
      `SELECT email FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.tenant_id = $1 AND u.role IN ('tenant_admin','user') LIMIT 1`,
      [tenantId]
    );
    return (r.rows as any[])[0]?.email || null;
  } catch {
    return null;
  }
}

const billingRouter = Router();

function getStripeClient(): Stripe | null {
  const key = getStripeSecretKey();
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2023-10-16' as any });
}

/** Найти tenant_id по Stripe Customer ID (вне tenant context — общая таблица). */
async function findTenantByStripeCustomer(customerId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT id FROM tenants WHERE stripe_customer_id = $1 LIMIT 1',
    [customerId]
  );
  const rows = result.rows as { id: string }[];
  return rows[0]?.id ?? null;
}

/**
 * customer.subscription.created/updated — синхронизируем тариф, статус, минуты.
 *
 * v0.9.5: при ренью (то же stripe_subscription_id + новый current_period_end > старого)
 * НЕ теряем неиспользованные минуты — они уезжают в rollover_seconds. Старый rollover
 * сгорает в этот же момент. Это соответствует FAQ-обещанию «перенос на месяц, потом сгорают».
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const tenantId = await findTenantByStripeCustomer(customerId);
  if (!tenantId) {
    console.warn(`[Billing] Tenant not found for Stripe Customer: ${customerId}`);
    return;
  }

  // Из metadata продукта или цены берём tier
  const priceItem = subscription.items.data[0];
  const product = priceItem?.price?.product;
  const productMeta = (typeof product === 'object' && product !== null)
    ? (product as Stripe.Product).metadata
    : {};
  const priceMeta = priceItem?.price?.metadata || {};
  // Фолбэк на subscription.metadata.tier — его кладём в subscription_data.metadata при
  // /checkout, поэтому tier определится верно даже если на цене нет metadata.tier.
  const tier = productMeta?.tier || priceMeta?.tier || subscription.metadata?.tier || 'plus';
  const billingPeriod = priceMeta?.billing_period || productMeta?.billing_period || 'monthly';

  const freshSeconds = TIER_SECONDS_MAP[tier] ?? TIER_SECONDS_MAP['plus'] ?? 3600;
  const stripeSubId = subscription.id;
  const status = subscription.status;
  const periodEnd = new Date(subscription.current_period_end * 1000);
  const cancelAtPeriodEnd = !!subscription.cancel_at_period_end;

  // Читаем текущую запись, чтобы понять: это первая подписка / renewal / mid-cycle.
  let oldBalance = 0;
  let oldRollover = 0;
  let oldPeriodEnd: Date | null = null;
  let oldSubId: string | null = null;
  try {
    const r = await pool.query(
      `SELECT translation_minutes_balance, rollover_seconds, current_period_end, stripe_subscription_id
       FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const row = (r.rows as any[])[0];
    if (row) {
      oldBalance = Number(row.translation_minutes_balance || 0);
      oldRollover = Number(row.rollover_seconds || 0);
      oldPeriodEnd = row.current_period_end ? new Date(row.current_period_end) : null;
      oldSubId = row.stripe_subscription_id || null;
    }
  } catch (e) {
    console.warn('[Billing] handleSubscriptionChange: не удалось прочитать старую запись', (e as Error).message);
  }

  // Renewal: тот же Stripe sub + новый period_end заметно позже (≥1 день).
  const isRenewal = !!(
    oldSubId === stripeSubId &&
    oldPeriodEnd &&
    periodEnd.getTime() - oldPeriodEnd.getTime() > 24 * 60 * 60 * 1000
  );
  const isInitial = !oldSubId || oldSubId !== stripeSubId;
  const isMidCycle = !isRenewal && !isInitial;

  // v0.9.5: rollover-логика.
  //  - initial (первая подписка для этого sub_id): balance=fresh, rollover=0.
  //  - renewal (новый цикл): balance=fresh, rollover=oldBalance — неизрасходованные переносим.
  //    Старый rollover сгорает (стал «прошлым прошлым»).
  //  - mid_cycle (тот же sub, период не сдвинулся: cancel toggle, plan change, status flip):
  //    баланс/rollover/period_end не трогаем — пишем те же значения.
  let newBalance: number;
  let newRollover: number;
  let newPeriodEnd: Date;
  if (isRenewal) {
    newBalance = freshSeconds;
    newRollover = oldBalance;
    newPeriodEnd = periodEnd;
  } else if (isInitial) {
    newBalance = freshSeconds;
    newRollover = 0;
    newPeriodEnd = periodEnd;
  } else {
    // mid_cycle — сохраняем существующие значения
    newBalance = oldBalance;
    newRollover = oldRollover;
    newPeriodEnd = oldPeriodEnd || periodEnd;
  }

  await runInTenantContext(tenantId, async (client) => {
    await client.query(
      `INSERT INTO subscriptions
         (tenant_id, stripe_subscription_id, tier, status,
          translation_minutes_balance, rollover_seconds,
          current_period_end, billing_period, cancel_at_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tenant_id) DO UPDATE SET
         stripe_subscription_id      = EXCLUDED.stripe_subscription_id,
         tier                        = EXCLUDED.tier,
         status                      = EXCLUDED.status,
         translation_minutes_balance = EXCLUDED.translation_minutes_balance,
         rollover_seconds            = EXCLUDED.rollover_seconds,
         current_period_end          = EXCLUDED.current_period_end,
         billing_period              = EXCLUDED.billing_period,
         cancel_at_period_end        = EXCLUDED.cancel_at_period_end,
         last_rollover_at            = CASE WHEN $10 THEN CURRENT_TIMESTAMP ELSE subscriptions.last_rollover_at END,
         updated_at                  = CURRENT_TIMESTAMP`,
      [tenantId, stripeSubId, tier, status, newBalance, newRollover, newPeriodEnd, billingPeriod, cancelAtPeriodEnd, isRenewal]
    );

    // Статистика оплат — только при РЕАЛЬНОМ списании (status='active'), не на старте
    // триала (trialing → денег ещё нет) и не mid-cycle.
    if (status === 'active' && !isMidCycle) {
      // Безлимитные тарифы (premium/enterprise) держат символические 999999с — в
      // статистику «оплаченных минут» кладём 1 (факт оплаты), без инфляции отчётов.
      const minutes = (tier === 'enterprise' || tier === 'premium') ? 1 : Math.round(freshSeconds / 60);
      await client.query(
        `UPDATE subscriptions
         SET total_paid_minutes = total_paid_minutes + $1,
             last_payment_minutes = $2,
             last_payment_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $3`,
        [minutes, minutes, tenantId]
      );
    }
  });

  // Партнёрская атрибуция: кредитуем партнёру оплату ТОЛЬКО при реальном списании
  // (status='active'), НЕ на старте триала — иначе платим комиссию за бесплатный триал.
  if (status === 'active' && !isMidCycle) {
    const minutes = (tier === 'enterprise' || tier === 'premium') ? 1 : Math.round(freshSeconds / 60);
    creditReferralPayment(tenantId, minutes).catch(() => {});
  }

  const reason = isRenewal ? 'renewal' : (isInitial ? 'initial' : 'mid_cycle_update');
  console.log(`[Billing] Subscription synced: tenant=${tenantId}, tier=${tier}, period=${billingPeriod}, reason=${reason}, balance=${newBalance}s, rollover=${newRollover}s, cancel_at_period_end=${cancelAtPeriodEnd}`);

  // Telegram-уведомление: на старте триала, реальной оплате и продлении (не mid-cycle).
  if ((status === 'active' || status === 'trialing') && !isMidCycle) {
    const email = await getTenantPrimaryEmail(tenantId);
    const isUnlimited = tier === 'premium' || tier === 'enterprise';
    const headline = status === 'trialing'
      ? '🆓 <b>Начался пробный период (7 дней)</b>'
      : isRenewal ? '🔁 <b>Продление подписки</b>' : '💳 <b>Оплачена подписка</b>';
    sendTelegramAdminMessage(
      `${headline}\n` +
      `<b>Email:</b> ${escapeHtml(email || '—')}\n` +
      `<b>Тариф:</b> ${escapeHtml(tier)} (${escapeHtml(billingPeriod)})` +
      (isUnlimited ? '' : `\n<b>Минут начислено:</b> ${Math.round(freshSeconds / 60)}`) +
      `\n<b>Статус:</b> ${escapeHtml(status)}` +
      (status === 'trialing' ? `\n<i>Спишется €120 ${periodEnd.toLocaleDateString('ru-RU')} (если не отменит)</i>` : '') +
      (cancelAtPeriodEnd ? `\n⚠️ <i>Будет отменена ${periodEnd.toLocaleDateString('ru-RU')}</i>` : '')
    ).catch(() => {});
  }
}

/** invoice.paid — top-up минут (если metadata.type === 'overtime_topup'). */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (invoice.metadata?.type !== 'overtime_topup') return;

  const minutesRaw = parseInt(invoice.metadata?.minutes ?? '0', 10);
  if (!minutesRaw || minutesRaw <= 0) {
    console.warn('[Billing] invoice.paid: overtime_topup без minutes, пропуск.');
    return;
  }

  const additionalSeconds = minutesRaw * 60;
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id ?? null;
  if (!customerId) return;

  const tenantId = await findTenantByStripeCustomer(customerId);
  if (!tenantId) return;

  await runInTenantContext(tenantId, async (client) => {
    await client.query(
      `UPDATE subscriptions
       SET translation_minutes_balance = translation_minutes_balance + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $2`,
      [additionalSeconds, tenantId]
    );
    await client.query(
      `UPDATE subscriptions
       SET total_paid_minutes = total_paid_minutes + $1,
           last_payment_minutes = $2,
           last_payment_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $3`,
      [minutesRaw, minutesRaw, tenantId]
    );
  });

  // Партнёрская атрибуция: если этого юзера привёл партнёр — кредитуем top-up.
  creditReferralPayment(tenantId, minutesRaw).catch(() => {});

  console.log(`[Billing] Top-up: tenant=${tenantId}, +${additionalSeconds}s (+${minutesRaw} min)`);

  const email = await getTenantPrimaryEmail(tenantId);
  sendTelegramAdminMessage(
    `💰 <b>Докупка минут</b>\n` +
    `<b>Email:</b> ${escapeHtml(email || '—')}\n` +
    `<b>Добавлено:</b> ${minutesRaw} мин`
  ).catch(() => {});
}

/**
 * POST /api/billing/webhook — Stripe webhook receiver.
 * Раз в день Stripe также шлёт `invoice.paid` для рекаррент-платежей подписок,
 * но реакция на них уже выполнена через `customer.subscription.*`.
 */
billingRouter.post('/', async (req: Request, res: Response) => {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();

  if (!stripe || !webhookSecret) {
    console.warn('[Billing] Webhook вызван, но Stripe ключи не настроены в SuperAdmin');
    return res.status(503).json({ error: 'Stripe не настроен. Свяжитесь с администратором.' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Отсутствует заголовок stripe-signature' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error('[Billing] Подпись webhook не прошла проверку:', (err as Error).message);
    return res.status(400).json({ error: `Webhook signature failed: ${(err as Error).message}` });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        // Подписка отменена — статус canceled, минут больше не начисляем
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantIdFromMeta = session.metadata?.tenant_id;
        const customerIdRaw = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id;

        if (session.mode === 'subscription' && session.subscription) {
          const subId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
          const fullSub = await stripe.subscriptions.retrieve(subId, {
            expand: ['items.data.price.product'],
          });
          await handleSubscriptionChange(fullSub as Stripe.Subscription);

          // auto_subscription_with_topup: после активации подписки добавляем overflow-минуты.
          const autoTopupMinutes = parseInt(session.metadata?.auto_topup_minutes || '0', 10);
          if (autoTopupMinutes > 0 && tenantIdFromMeta) {
            try {
              await pool.query(
                `UPDATE subscriptions
                 SET translation_minutes_balance = translation_minutes_balance + $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE tenant_id = $2`,
                [autoTopupMinutes * 60, tenantIdFromMeta]
              );
              await pool.query(
                `UPDATE subscriptions
                 SET total_paid_minutes = total_paid_minutes + $1,
                     last_payment_minutes = $2,
                     last_payment_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE tenant_id = $3`,
                [autoTopupMinutes, autoTopupMinutes, tenantIdFromMeta]
              );
              console.log(`[Billing.webhook] Auto-topup after subscription: tenant=${tenantIdFromMeta}, +${autoTopupMinutes} мин`);
              const email = await getTenantPrimaryEmail(tenantIdFromMeta);
              sendTelegramAdminMessage(
                `💰 <b>Авто-докупка к подписке</b>\n` +
                `<b>Email:</b> ${escapeHtml(email || '—')}\n` +
                `<b>Тариф Plus активирован</b> (+60 мин)\n` +
                `<b>Дополнительно добавлено:</b> ${autoTopupMinutes} мин`
              ).catch(() => {});
            } catch (e) {
              console.warn('[Billing.webhook] Не удалось начислить auto-topup:', e);
            }
          }
        }

        // One-time top-up: zachislyaem секунды в баланс tenant'а
        if (session.mode === 'payment' && session.metadata?.type === 'overtime_topup') {
          const minutes = parseInt(session.metadata.minutes || '0', 10);
          if (minutes > 0 && tenantIdFromMeta) {
            try {
              await pool.query(
                `UPDATE subscriptions
                 SET translation_minutes_balance = translation_minutes_balance + $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE tenant_id = $2`,
                [minutes * 60, tenantIdFromMeta]
              );
              await pool.query(
                `UPDATE subscriptions
                 SET total_paid_minutes = total_paid_minutes + $1,
                     last_payment_minutes = $2,
                     last_payment_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE tenant_id = $3`,
                [minutes, minutes, tenantIdFromMeta]
              );
              console.log(`[Billing.webhook] Top-up: tenant=${tenantIdFromMeta}, +${minutes} мин`);
              const email = await getTenantPrimaryEmail(tenantIdFromMeta);
              sendTelegramAdminMessage(
                `💰 <b>Докупка минут</b>\n` +
                `<b>Email:</b> ${escapeHtml(email || '—')}\n` +
                `<b>Добавлено:</b> ${minutes} мин`
              ).catch(() => {});
            } catch (e) {
              console.warn('[Billing.webhook] Не удалось начислить top-up:', e);
            }
          }
        }

        if (tenantIdFromMeta && customerIdRaw) {
          try {
            await pool.query(
              'UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2',
              [customerIdRaw, tenantIdFromMeta]
            );
          } catch (e) {
            console.warn('[Billing.webhook] Не удалось обновить stripe_customer_id:', e);
          }
        }
        break;
      }
      default:
        console.log(`[Billing] Событие проигнорировано: ${event.type}`);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[Billing] Ошибка обработки события ${event.type}:`, err);
    return res.status(500).json({ error: 'Внутренняя ошибка при обработке webhook' });
  }
});

export default billingRouter;
