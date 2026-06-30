/**
 * Billing admin router — управление Stripe-сущностями из админки.
 *
 * Эти эндпоинты НЕ требуют raw-body (в отличие от webhook).
 * Монтируется на /api/billing (без /webhook).
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { syncStripeProducts, listSyncedProducts, getStripe } from './service.js';
import pool from '../../db/index.js';
import { TOPUP_PRICE_PER_MINUTE_EUR_CENTS, TOPUP_MIN_MINUTES, TOPUP_MAX_MINUTES, TIER_PRICES } from '@vibevox/shared';
import { send500 } from '../../utils/http_error.js';

/** Тарифы, которые считаются «активной подпиской» — не требуют автодобавления Plus. */
const ACTIVE_PAID_TIERS = new Set(['premium', 'plus', 'standard', 'standard_yearly', 'enterprise']);
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

/** Получить запись текущей подписки tenant'а (или null). */
async function getTenantSubscription(tenantId: string): Promise<any | null> {
  try {
    const r = await pool.query(
      `SELECT tier, status FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    return (r.rows as any[])[0] || null;
  } catch {
    return null;
  }
}

/** Активна ли платящая подписка у tenant'а? */
function isPaidActive(sub: { tier?: string | null; status?: string | null } | null): boolean {
  if (!sub) return false;
  if (!sub.tier || !sub.status) return false;
  return ACTIVE_PAID_TIERS.has(String(sub.tier)) && ACTIVE_STATUSES.has(String(sub.status));
}

/** Найти конфиг тарифа Plus (для авто-подмешивания при отсутствии подписки). */
function getPlusTierConfig() {
  return TIER_PRICES.find(t => t.tier === 'plus')!;
}

/**
 * v0.9.4: Получаем валидный Stripe Customer ID для tenant'а.
 *  - Читаем stripe_customer_id из tenants.
 *  - Если начинается на 'cus_mock_' — игнорируем (это артефакт старого mock-режима).
 *  - Если есть — проверяем `stripe.customers.retrieve`. Если deleted=true или 404 — игнорируем.
 *  - Если валидного ID нет — создаём нового customer'а и сохраняем в БД.
 */
async function resolveStripeCustomer(
  stripe: import('stripe').default,
  tenantId: string,
  userEmail: string,
  source: string
): Promise<string> {
  let storedId: string | null = null;
  try {
    const rows = await pool.query('SELECT stripe_customer_id FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
    storedId = rows.rows[0]?.stripe_customer_id || null;
  } catch { /* */ }

  if (storedId && storedId.startsWith('cus_mock_')) {
    storedId = null; // фейковый id из старого mock-режима — игнорируем
  }

  if (storedId) {
    try {
      const cust = await stripe.customers.retrieve(storedId);
      // Если customer существует и не удалён — используем
      if (cust && !(cust as any).deleted) {
        return storedId;
      }
    } catch (err: any) {
      // 404 / No such customer — пересоздадим
      console.warn(`[Billing.resolveStripeCustomer] Stored customer ${storedId} недействителен (${err?.message || err}). Создаём нового.`);
    }
  }

  // Создаём нового customer'а
  const customer = await stripe.customers.create({
    email: userEmail,
    metadata: { tenant_id: tenantId, source },
  });
  try {
    await pool.query('UPDATE tenants SET stripe_customer_id = $1 WHERE id = $2', [customer.id, tenantId]);
  } catch (err) {
    console.warn('[Billing.resolveStripeCustomer] Не удалось сохранить stripe_customer_id:', err);
  }
  return customer.id;
}

const billingAdminRouter = Router();
import { JWT_SECRET } from '../../config/secrets.js';

/** Middleware: извлекает tenantId из JWT в заголовке Authorization. */
function requireTenant(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    if (!decoded.tenantId) return res.status(401).json({ error: 'tenantId отсутствует в токене' });
    (req as any).tenantId = decoded.tenantId;
    (req as any).userEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

/** Middleware: только суперадмин (role='superadmin') — для админских billing-операций. */
function requireSuperAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as { role?: string };
    if (decoded?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Доступ только для суперадмина' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

/**
 * POST /api/billing/sync-products
 * Создаёт в Stripe Products и Prices, соответствующие TIER_PRICES.
 * Идемпотентно: повторный вызов не создаёт дубликаты.
 *
 * Body: { currency?: 'eur' | 'usd' }  — default 'eur'
 */
billingAdminRouter.post('/sync-products', requireSuperAdmin, async (req: Request, res: Response) => {
  const currency = (req.body?.currency === 'usd' ? 'usd' : 'eur') as 'eur' | 'usd';
  try {
    const synced = await syncStripeProducts(currency);
    const created = synced.filter(s => !s.alreadyExisted).length;
    const existed = synced.filter(s => s.alreadyExisted).length;
    return res.status(200).json({
      status: 'success',
      message: `Синхронизация завершена: создано ${created}, уже было ${existed}.`,
      currency,
      products: synced,
    });
  } catch (err) {
    console.error('[Billing] sync-products error:', err);
    return send500(res, err, 'billing');
  }
});

/**
 * GET /api/billing/products?currency=eur — список созданных в Stripe Products + Prices.
 * Используется фронтом BillingPage для построения карточек тарифов с корректными Price-ID.
 */
billingAdminRouter.get('/products', requireSuperAdmin, async (req: Request, res: Response) => {
  const currency = (req.query?.currency === 'usd' ? 'usd' : 'eur') as 'eur' | 'usd';
  try {
    const products = await listSyncedProducts(currency);
    return res.status(200).json({
      currency,
      products,
    });
  } catch (err) {
    // Если Stripe не настроен — возвращаем пустой список, не 500
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('не настроен')) {
      return res.status(200).json({
        currency,
        products: [],
        warning: msg,
      });
    }
    console.error('[Billing] products list error:', err);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/billing/checkout
 * Создаёт Stripe Checkout Session для подписки на выбранный тариф.
 *
 * Body: { tier: 'plus' | 'standard' | 'standard_yearly', currency?: 'eur' | 'usd' }
 * Response: { checkoutUrl }
 */
billingAdminRouter.post('/checkout', requireTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const userEmail = (req as any).userEmail;
  const { tier, currency = 'eur', promotionCodeId } = req.body || {};

  const allowedTiers = ['premium', 'plus', 'standard', 'standard_yearly'];
  if (!tier || !allowedTiers.includes(tier)) {
    return res.status(400).json({ error: `tier должен быть одним из: ${allowedTiers.join(', ')}` });
  }

  try {
    const stripe = getStripe();
    const lookupKey = `vibevox_${tier}_${currency}`;
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1, expand: ['data.product'] });
    const price = prices.data[0];
    if (!price) {
      return res.status(404).json({
        error: `Stripe Price '${lookupKey}' не найден. Запустите синхронизацию тарифов в админ-панели.`,
      });
    }

    // Ищем или создаём Stripe Customer для tenant — с проверкой существования в Stripe.
    const customerId = await resolveStripeCustomer(stripe, tenantId, userEmail, 'vibevox');

    // Определяем где живёт фронт (для success/cancel URLs)
    const origin = req.headers.origin || `http://localhost:${process.env.PORT === '3001' ? '3000' : '3000'}`;

    const sessionParams: any = {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?canceled=1`,
      metadata: {
        tenant_id: tenantId,
        tier,
        billing_period: tier === 'standard_yearly' ? 'yearly' : 'monthly',
      },
      subscription_data: {
        metadata: { tenant_id: tenantId, tier },
      },
    };
    // Если юзер уже применил промокод на /billing — передаём его как discount.
    // Иначе оставляем allow_promotion_codes:true чтобы юзер мог ввести в самом Stripe Checkout.
    if (promotionCodeId) {
      sessionParams.discounts = [{ promotion_code: promotionCodeId }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }
    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[Billing.checkout] error:', err);
    return send500(res, err, 'billing');
  }
});

/**
 * POST /api/billing/portal
 * Создаёт Stripe Billing Portal Session — пользователь может менять платёжку,
 * отменять подписку, смотреть инвойсы.
 */
billingAdminRouter.post('/portal', requireTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  try {
    const stripe = getStripe();
    const rows = await pool.query('SELECT stripe_customer_id FROM tenants WHERE id = $1', [tenantId]);
    const customerId = rows.rows[0]?.stripe_customer_id;
    if (!customerId) {
      return res.status(404).json({ error: 'Сначала оформите подписку' });
    }
    const origin = req.headers.origin || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });
    return res.status(200).json({ portalUrl: session.url });
  } catch (err) {
    return send500(res, err, 'billing');
  }
});

/**
 * POST /api/billing/promo-validate
 * Проверяет промокод в Stripe и возвращает info о скидке.
 * Body: { code: string, tier?: 'plus' | 'standard' | 'standard_yearly' }
 * Если tier указан — проверяем, что промокод применим к этому тарифу (через Coupon.applies_to.products).
 *
 * Response: { valid, percentOff?, amountOff?, currency?, promotionCodeId?, summary? } или { valid: false, error }
 */
billingAdminRouter.post('/promo-validate', requireTenant, async (req: Request, res: Response) => {
  const codeRaw = String(req.body?.code || '').trim().toUpperCase();
  const tierFilter = String(req.body?.tier || '').trim();
  if (!codeRaw) return res.status(400).json({ valid: false, error: 'Введите промокод' });

  try {
    const stripe = getStripe();
    const list = await stripe.promotionCodes.list({ code: codeRaw, active: true, limit: 1, expand: ['data.coupon', 'data.coupon.applies_to'] });
    const pc = list.data[0];
    if (!pc) return res.json({ valid: false, error: 'Промокод не найден или деактивирован' });
    if (pc.expires_at && pc.expires_at * 1000 < Date.now()) {
      return res.json({ valid: false, error: 'Срок действия промокода истёк' });
    }
    if (pc.max_redemptions && pc.times_redeemed >= pc.max_redemptions) {
      return res.json({ valid: false, error: 'Промокод исчерпал лимит активаций' });
    }

    const coupon = (typeof pc.coupon === 'object' ? pc.coupon : null) as any;
    const appliesToProducts: string[] | undefined = coupon?.applies_to?.products;

    // Если в промокоде ограничены products и юзер указал tier — проверяем совместимость
    let appliesToTiers: string[] | null = null;
    if (appliesToProducts && appliesToProducts.length > 0) {
      try {
        const products = await stripe.products.list({ active: true, limit: 100 });
        if (tierFilter) {
          const targetProduct = products.data.find((p) => p.metadata?.vibevox_key === (tierFilter === 'standard_yearly' ? 'standard' : tierFilter));
          if (!targetProduct || !appliesToProducts.includes(targetProduct.id)) {
            return res.json({ valid: false, error: `Промокод не применим к тарифу ${tierFilter}` });
          }
        }
        // Обратный маппинг product → vibevox tier keys
        const tiers = new Set<string>();
        for (const prodId of appliesToProducts) {
          const prod = products.data.find((p) => p.id === prodId);
          const key = prod?.metadata?.vibevox_key;
          if (key === 'premium') tiers.add('premium');
          if (key === 'plus') tiers.add('plus');
          if (key === 'standard') { tiers.add('standard'); tiers.add('standard_yearly'); }
        }
        appliesToTiers = Array.from(tiers);
      } catch { /* fallback: пропустим проверку */ }
    }

    const percentOff = coupon?.percent_off ?? null;
    const amountOff = coupon?.amount_off ?? null;
    const currency = coupon?.currency ?? 'eur';

    let summary = '';
    if (percentOff) summary = `Скидка ${percentOff}%`;
    else if (amountOff) summary = `Скидка ${(amountOff / 100).toFixed(2)} ${String(currency).toUpperCase()}`;

    return res.json({
      valid: true,
      promotionCodeId: pc.id,
      code: pc.code,
      percentOff,
      amountOff,
      currency,
      duration: coupon?.duration ?? null,
      appliesToProducts,
      appliesToTiers,
      summary,
    });
  } catch (err: any) {
    console.error('[Billing.promo-validate] error:', err);
    return res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/billing/topup-preview
 * Возвращает breakdown стоимости для UI БЕЗ создания Stripe сессии.
 * Используется на пейволле, чтобы показать «вам автоматически добавится Plus».
 *
 * Body: { minutes: number, currency?: 'eur' | 'usd' }
 */
billingAdminRouter.post('/topup-preview', requireTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const minutes = parseInt(String(req.body?.minutes || '0'), 10);
  const currency = (req.body?.currency === 'usd' ? 'usd' : 'eur') as 'eur' | 'usd';

  if (!minutes || minutes < TOPUP_MIN_MINUTES || minutes > TOPUP_MAX_MINUTES) {
    return res.status(400).json({
      error: `minutes должно быть от ${TOPUP_MIN_MINUTES} до ${TOPUP_MAX_MINUTES}`,
    });
  }

  const sub = await getTenantSubscription(tenantId);
  const hasPaidActive = isPaidActive(sub);

  const plus = getPlusTierConfig();
  const plusPriceCents = currency === 'usd' ? plus.amountUsd : plus.amountEur;
  const plusMinutes = plus.minutes;

  // Цена «обычной» докупки (без авто-подписки)
  const pureTopupCents = minutes * TOPUP_PRICE_PER_MINUTE_EUR_CENTS;

  if (hasPaidActive) {
    return res.json({
      needsSubscription: false,
      subscriptionTier: null,
      subscriptionMinutes: 0,
      subscriptionPriceCents: 0,
      topupMinutes: minutes,
      topupPriceCents: pureTopupCents,
      totalPriceCents: pureTopupCents,
      freeMinutesFromSubscription: 0,
      currency,
      summary: `Докупка ${minutes} мин по €${(TOPUP_PRICE_PER_MINUTE_EUR_CENTS / 100).toFixed(2)}/мин = €${(pureTopupCents / 100).toFixed(2)}.`,
    });
  }

  // У юзера нет платной подписки → автоматически добавляется Plus.
  // Первые plusMinutes идут бесплатно, остальные — обычной докупкой.
  const overflowMinutes = Math.max(0, minutes - plusMinutes);
  const overflowCents = overflowMinutes * TOPUP_PRICE_PER_MINUTE_EUR_CENTS;
  const totalCents = plusPriceCents + overflowCents;
  const freeMinutes = Math.min(minutes, plusMinutes);

  return res.json({
    needsSubscription: true,
    subscriptionTier: 'plus',
    subscriptionMinutes: plusMinutes,
    subscriptionPriceCents: plusPriceCents,
    topupMinutes: overflowMinutes,
    topupPriceCents: overflowCents,
    totalPriceCents: totalCents,
    freeMinutesFromSubscription: freeMinutes,
    currency,
    summary: overflowMinutes > 0
      ? `Plus €${(plusPriceCents / 100).toFixed(0)} (${plusMinutes} мин включено) + докупка ${overflowMinutes} мин €${(overflowCents / 100).toFixed(2)} = €${(totalCents / 100).toFixed(2)}.`
      : `Plus €${(plusPriceCents / 100).toFixed(0)} (${plusMinutes} мин включено). Дополнительная оплата за минуты не требуется.`,
  });
});

/**
 * POST /api/billing/topup
 * Создаёт Stripe Checkout Session на докупку N минут — с учётом наличия подписки.
 *
 * Если у tenant'а нет активной платной подписки → создаём mixed Subscription Checkout:
 *   line 1: recurring price Plus (€19/мес, дают 60 мин)
 *   line 2: one-time price на (minutes − 60) × €0.17, если minutes > 60
 *
 * Если есть активная подписка → старая логика one-time mode='payment'.
 *
 * Body: { minutes: number, currency?: 'eur' | 'usd', returnUrl?: string }
 */
billingAdminRouter.post('/topup', requireTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const userEmail = (req as any).userEmail;
  const minutes = parseInt(String(req.body?.minutes || '0'), 10);
  const currency = (req.body?.currency === 'usd' ? 'usd' : 'eur') as 'eur' | 'usd';
  const returnUrl = String(req.body?.returnUrl || '');
  const promotionCodeId = req.body?.promotionCodeId ? String(req.body.promotionCodeId) : null;

  if (!minutes || minutes < TOPUP_MIN_MINUTES || minutes > TOPUP_MAX_MINUTES) {
    return res.status(400).json({
      error: `minutes должно быть от ${TOPUP_MIN_MINUTES} до ${TOPUP_MAX_MINUTES}`,
    });
  }

  try {
    const stripe = getStripe();
    const sub = await getTenantSubscription(tenantId);
    const hasPaidActive = isPaidActive(sub);

    // Ищем / создаём customer — с проверкой существования в Stripe.
    const customerId = await resolveStripeCustomer(stripe, tenantId, userEmail, 'vibevox_topup');

    const origin = req.headers.origin || 'http://localhost:3000';
    const success = returnUrl
      ? returnUrl + (returnUrl.includes('?') ? '&' : '?') + 'topup=success'
      : `${origin}/billing?topup=success`;
    const cancel = returnUrl
      ? returnUrl + (returnUrl.includes('?') ? '&' : '?') + 'topup=cancel'
      : `${origin}/billing?topup=cancel`;

    // ── Сценарий А: подписка есть → старая логика (one-time payment) ──
    if (hasPaidActive) {
      const amountCents = minutes * TOPUP_PRICE_PER_MINUTE_EUR_CENTS;
      const topupSessionParams: any = {
        mode: 'payment',
        customer: customerId,
        line_items: [{
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: `VibeVox — ${minutes} минут перевода`,
              description: 'Дополнительный пакет минут (одноразовая покупка). Зачисляется на ваш баланс сразу после оплаты.',
            },
          },
          quantity: 1,
        }],
        success_url: success,
        cancel_url: cancel,
        payment_intent_data: {
          metadata: { type: 'overtime_topup', tenant_id: tenantId, minutes: String(minutes) },
        },
        metadata: { type: 'overtime_topup', tenant_id: tenantId, minutes: String(minutes) },
      };
      if (promotionCodeId) {
        topupSessionParams.discounts = [{ promotion_code: promotionCodeId }];
      } else {
        topupSessionParams.allow_promotion_codes = true;
      }
      const session = await stripe.checkout.sessions.create(topupSessionParams);
      return res.json({
        checkoutUrl: session.url,
        sessionId: session.id,
        mode: 'pure_topup',
        minutes,
        amountCents,
        currency,
      });
    }

    // ── Сценарий Б: подписки нет → mixed subscription + (optional) topup ──
    // Берём Stripe Price для Plus через lookup_key.
    const lookupKey = `vibevox_plus_${currency}`;
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const plusPrice = prices.data[0];
    if (!plusPrice) {
      return res.status(404).json({
        error: `Stripe Price '${lookupKey}' не найден. Запустите синхронизацию тарифов в админ-панели.`,
      });
    }

    const plus = getPlusTierConfig();
    const plusMinutes = plus.minutes; // 60
    const overflowMinutes = Math.max(0, minutes - plusMinutes);
    const overflowCents = overflowMinutes * TOPUP_PRICE_PER_MINUTE_EUR_CENTS;

    const lineItems: any[] = [
      { price: plusPrice.id, quantity: 1 },
    ];
    if (overflowMinutes > 0) {
      lineItems.push({
        price_data: {
          currency,
          unit_amount: overflowCents,
          product_data: {
            name: `VibeVox — докупка ${overflowMinutes} мин`,
            description: 'Дополнительные минуты сверх тарифа Plus. Зачисляются сразу после оплаты.',
          },
        },
        quantity: 1,
      });
    }

    const mixedSessionParams: any = {
      mode: 'subscription',
      customer: customerId,
      line_items: lineItems,
      success_url: success,
      cancel_url: cancel,
      metadata: {
        type: 'auto_subscription_with_topup',
        tenant_id: tenantId,
        tier: 'plus',
        billing_period: 'monthly',
        auto_topup_minutes: String(overflowMinutes),
      },
      subscription_data: {
        metadata: { tenant_id: tenantId, tier: 'plus' },
      },
    };
    if (promotionCodeId) {
      mixedSessionParams.discounts = [{ promotion_code: promotionCodeId }];
    } else {
      mixedSessionParams.allow_promotion_codes = true;
    }
    const session = await stripe.checkout.sessions.create(mixedSessionParams);

    return res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      mode: 'auto_subscription_with_topup',
      tier: 'plus',
      subscriptionMinutes: plusMinutes,
      overflowMinutes,
      minutes,
      currency,
    });
  } catch (err) {
    console.error('[Billing.topup] error:', err);
    return send500(res, err, 'billing');
  }
});

/**
 * GET /api/billing/me
 * Возвращает текущее состояние подписки tenant'а: tier, остаток минут, период.
 */
billingAdminRouter.get('/me', requireTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  try {
    const rows = await pool.query(
      `SELECT tier, status, billing_period, translation_minutes_balance, rollover_seconds,
              current_period_end, stripe_subscription_id, cancel_at_period_end, canceled_at
       FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    if (rows.rows.length === 0) {
      return res.status(200).json({ subscription: null });
    }
    const r = rows.rows[0];
    const rolloverSec = Number(r.rollover_seconds || 0);
    const balanceSec = Number(r.translation_minutes_balance || 0);
    return res.status(200).json({
      subscription: {
        tier: r.tier,
        status: r.status,
        billingPeriod: r.billing_period,
        balanceSeconds: balanceSec,
        balanceMinutes: Math.floor(balanceSec / 60),
        rolloverSeconds: rolloverSec,
        rolloverMinutes: Math.floor(rolloverSec / 60),
        totalMinutes: Math.floor((balanceSec + rolloverSec) / 60),
        currentPeriodEnd: r.current_period_end,
        hasActiveStripeSub: !!r.stripe_subscription_id,
        cancelAtPeriodEnd: !!r.cancel_at_period_end,
        canceledAt: r.canceled_at || null,
      },
    });
  } catch (err) {
    return send500(res, err, 'billing');
  }
});

/**
 * POST /api/billing/cancel-subscription
 * v0.9.5: пользователь сам отменяет автопродление своей подписки.
 *  - Деньги не возвращаются.
 *  - Подписка остаётся active до current_period_end.
 *  - В этот период минуты доступны и можно докупать дополнительные.
 *  - В конце периода Stripe закрывает подписку, webhook ставит status='canceled'.
 */
billingAdminRouter.post('/cancel-subscription', requireTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const userEmail = (req as any).userEmail;
  try {
    const r = await pool.query(
      `SELECT stripe_subscription_id, cancel_at_period_end, current_period_end
       FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const row = (r.rows as any[])[0];
    if (!row || !row.stripe_subscription_id) {
      return res.status(400).json({ error: 'У вас нет активной Stripe-подписки' });
    }
    if (row.cancel_at_period_end) {
      return res.status(200).json({
        status: 'already',
        message: 'Подписка уже отменена и закроется в конце периода',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: row.current_period_end,
      });
    }

    const stripe = getStripe();
    const updated = await stripe.subscriptions.update(row.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Локальный апдейт — webhook всё равно прилетит и поверх перепишет.
    try {
      await pool.query(
        `UPDATE subscriptions
         SET cancel_at_period_end = TRUE,
             canceled_by = $1,
             canceled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $2`,
        ['user:' + userEmail, tenantId]
      );
    } catch { /* webhook поправит */ }

    const periodEnd = updated.current_period_end
      ? new Date(updated.current_period_end * 1000).toISOString()
      : (row.current_period_end || null);

    return res.json({
      status: 'success',
      message: 'Подписка будет закрыта в конце текущего периода. Деньги не возвращаются. До этой даты вы можете пользоваться минутами и докупать дополнительные.',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd,
    });
  } catch (err: any) {
    console.error('[Billing.cancel-subscription] error:', err);
    return send500(res, err, 'billing');
  }
});

/**
 * POST /api/billing/resume-subscription
 * Откатывает cancel_at_period_end — автопродление возобновляется.
 */
billingAdminRouter.post('/resume-subscription', requireTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  try {
    const r = await pool.query(
      `SELECT stripe_subscription_id, cancel_at_period_end
       FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const row = (r.rows as any[])[0];
    if (!row || !row.stripe_subscription_id) {
      return res.status(400).json({ error: 'У вас нет Stripe-подписки' });
    }
    if (!row.cancel_at_period_end) {
      return res.status(200).json({ status: 'already', message: 'Подписка уже активна с автопродлением' });
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: false });

    try {
      await pool.query(
        `UPDATE subscriptions
         SET cancel_at_period_end = FALSE,
             canceled_by = NULL,
             canceled_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $1`,
        [tenantId]
      );
    } catch { /* */ }

    return res.json({
      status: 'success',
      message: 'Автопродление подписки возобновлено.',
    });
  } catch (err: any) {
    console.error('[Billing.resume-subscription] error:', err);
    return send500(res, err, 'billing');
  }
});

export default billingAdminRouter;
