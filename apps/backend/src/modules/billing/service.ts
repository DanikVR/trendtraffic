/**
 * Billing service — управление Stripe-сущностями (Products, Prices, Coupons).
 *
 * Используется этапами 2 (sync products), 4 (checkout sessions), 8 (top-up),
 * 9 (promo codes), 10 (yearly price).
 */

import Stripe from 'stripe';
import { TIER_PRICES, type TierPriceConfig } from '@vibevox/shared';
import { getStripeSecretKey } from '../../config/systemConfig.js';

let stripeInstance: Stripe | null = null;
let stripeKeySnapshot = '';

/** Получаем актуальный экземпляр Stripe SDK (с проверкой ключа на каждом запросе). */
export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error('Stripe Secret Key не настроен в SuperAdmin (Admin Config → Stripe).');
  }
  // Пересоздаём экземпляр если ключ поменялся в админке на лету
  if (!stripeInstance || stripeKeySnapshot !== key) {
    stripeInstance = new Stripe(key, { apiVersion: '2023-10-16' as any });
    stripeKeySnapshot = key;
  }
  return stripeInstance;
}

export interface SyncedProductInfo {
  tier: string;
  productId: string;
  priceId: string;
  priceLookupKey: string;
  amount: number;
  currency: string;
  billingPeriod: string;
  minutes: number;
  alreadyExisted: boolean;
}

/**
 * Синхронизирует Products и Prices в Stripe, чтобы соответствовать TIER_PRICES.
 * Идемпотентно: при повторном вызове использует существующие Products/Prices через lookup_key.
 *
 * @param currency  — 'eur' (по умолчанию) или 'usd'
 */
export async function syncStripeProducts(currency: 'eur' | 'usd' = 'eur'): Promise<SyncedProductInfo[]> {
  const stripe = getStripe();
  const results: SyncedProductInfo[] = [];

  // Группируем по productKey: Standard month + Standard yearly = один Product, два Price.
  const productKeys = Array.from(new Set(TIER_PRICES.map(t => t.productKey)));

  for (const productKey of productKeys) {
    const tiersForProduct = TIER_PRICES.filter(t => t.productKey === productKey);
    const firstTier = tiersForProduct[0];

    // Ищем существующий Product по metadata.vibevox_key
    const existingProducts = await stripe.products.list({ active: true, limit: 100 });
    let product = existingProducts.data.find(p => p.metadata?.vibevox_key === productKey);

    if (!product) {
      product = await stripe.products.create({
        name: firstTier.name,
        description: firstTier.description,
        metadata: {
          vibevox_key: productKey,
          tier: firstTier.tier,
        },
      });
      console.log(`[Billing.sync] Создан Product: ${product.id} (${productKey})`);
    }

    // Для каждого tier этого product создаём/находим Price
    for (const tierCfg of tiersForProduct) {
      const lookupKey = `vibevox_${tierCfg.tier}_${currency}`;
      const amount = currency === 'usd' ? tierCfg.amountUsd : tierCfg.amountEur;

      // Ищем по lookup_key
      const existingPrices = await stripe.prices.list({
        lookup_keys: [lookupKey],
        active: true,
        limit: 1,
      });

      let price: Stripe.Price | undefined = existingPrices.data[0];
      let alreadyExisted = false;

      if (price) {
        alreadyExisted = true;
      } else {
        const priceParams: Stripe.PriceCreateParams = {
          product: product.id,
          currency,
          unit_amount: amount,
          lookup_key: lookupKey,
          metadata: {
            tier: tierCfg.tier,
            billing_period: tierCfg.billingPeriod,
            included_minutes: String(tierCfg.minutes),
          },
        };

        if (tierCfg.billingPeriod === 'monthly') {
          priceParams.recurring = { interval: 'month' };
        } else if (tierCfg.billingPeriod === 'yearly') {
          priceParams.recurring = { interval: 'year' };
        }
        // one_time = просто отсутствие recurring

        price = await stripe.prices.create(priceParams);
        console.log(`[Billing.sync] Создан Price: ${price.id} (${lookupKey}) = ${amount/100} ${currency}`);
      }

      results.push({
        tier: tierCfg.tier,
        productId: product.id,
        priceId: price.id,
        priceLookupKey: lookupKey,
        amount,
        currency,
        billingPeriod: tierCfg.billingPeriod,
        minutes: tierCfg.minutes,
        alreadyExisted,
      });
    }
  }

  return results;
}

/** Список тарифов с их Stripe Price-ID (для фронта — после синхронизации). */
export async function listSyncedProducts(currency: 'eur' | 'usd' = 'eur'): Promise<SyncedProductInfo[]> {
  const stripe = getStripe();
  const results: SyncedProductInfo[] = [];

  const products = await stripe.products.list({ active: true, limit: 100 });

  for (const tierCfg of TIER_PRICES) {
    const product = products.data.find(p => p.metadata?.vibevox_key === tierCfg.productKey);
    if (!product) continue;

    const lookupKey = `vibevox_${tierCfg.tier}_${currency}`;
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) continue;

    results.push({
      tier: tierCfg.tier,
      productId: product.id,
      priceId: price.id,
      priceLookupKey: lookupKey,
      amount: tierCfg.amountEur,
      currency,
      billingPeriod: tierCfg.billingPeriod,
      minutes: tierCfg.minutes,
      alreadyExisted: true,
    });
  }

  return results;
}
