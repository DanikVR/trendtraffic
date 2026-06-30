/**
 * Промокоды через Stripe.
 *
 * Создаём:
 *  - Coupon (Stripe объект скидки — percent_off + duration='forever' или 'once'/'repeating')
 *  - PromotionCode (поверх Coupon — даёт человеко-читаемый код, лимиты, expires_at)
 *
 * 100% скидка = бесплатная активация тарифа (Stripe принимает percent_off=100).
 *
 * v0.9.4: PATCH (reactivate / edit-by-replace), DELETE ?hard=true (full removal),
 * GET возвращает appliesToTiers (reverse-mapping product → tier key) для фронта.
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { getStripe } from './service.js';
import pool from '../../db/index.js';

const promoRouter = Router();
import { JWT_SECRET } from '../../config/secrets.js';

/** Middleware: только суперадмин может управлять промокодами. */
function requireSuperAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ error: 'Только суперадмин может управлять промокодами' });
    }
    (req as any).adminEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

promoRouter.use(requireSuperAdmin);

/**
 * Маппинг Stripe product.id → vibevox tier-keys.
 * Один product 'standard' покрывает оба tier'а: 'standard' (мес) и 'standard_yearly'.
 */
async function buildProductToTiersMap(): Promise<Map<string, string[]>> {
  const stripe = getStripe();
  const out = new Map<string, string[]>();
  try {
    const products = await stripe.products.list({ active: true, limit: 100 });
    for (const p of products.data) {
      const key = p.metadata?.vibevox_key;
      if (!key) continue;
      const tiers: string[] = [];
      if (key === 'premium') tiers.push('premium');
      if (key === 'plus') tiers.push('plus');
      if (key === 'standard') tiers.push('standard', 'standard_yearly');
      out.set(p.id, tiers);
    }
  } catch (e) {
    console.warn('[Promo] buildProductToTiersMap failed:', e);
  }
  return out;
}

/**
 * GET /api/admin/promocodes — список промокодов (из Stripe + БД).
 * Активные коды идут первыми, затем неактивные.
 */
promoRouter.get('/', async (_req: Request, res: Response) => {
  // Stripe ещё не настроен — НЕ блокируем страницу промокодов. Отдаём пустой список и флаг,
  // чтобы фронт показал мягкое уведомление, а форма создания осталась доступной.
  let stripe;
  try {
    stripe = getStripe();
  } catch (e: any) {
    return res.status(200).json({ codes: [], stripeConfigured: false, notice: e?.message || 'Stripe не подключён.' });
  }
  try {
    const codes = await stripe.promotionCodes.list({ limit: 100, expand: ['data.coupon', 'data.coupon.applies_to'] });
    const productToTiers = await buildProductToTiersMap();

    const items = codes.data.map((p) => {
      const coupon = (typeof p.coupon === 'object' ? p.coupon : null) as any;
      const appliesToProducts: string[] | null = coupon?.applies_to?.products ?? null;
      let appliesToTiers: string[] | null = null;
      if (Array.isArray(appliesToProducts) && appliesToProducts.length > 0) {
        const tiers = new Set<string>();
        for (const prodId of appliesToProducts) {
          const ts = productToTiers.get(prodId);
          if (ts) ts.forEach((t) => tiers.add(t));
        }
        appliesToTiers = Array.from(tiers);
      }

      return {
        id: p.id,
        code: p.code,
        active: p.active,
        percentOff: coupon?.percent_off ?? null,
        amountOff: coupon?.amount_off ?? null,
        currency: coupon?.currency ?? null,
        duration: coupon?.duration ?? null,
        durationInMonths: coupon?.duration_in_months ?? null,
        maxRedemptions: p.max_redemptions ?? null,
        timesRedeemed: p.times_redeemed ?? 0,
        expiresAt: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
        createdAt: new Date(p.created * 1000).toISOString(),
        couponId: coupon?.id ?? null,
        appliesToProducts,
        appliesToTiers,
      };
    });

    // Активные первыми, среди равных — по дате создания (новые сверху)
    items.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return res.status(200).json({ codes: items, stripeConfigured: true });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * POST /api/admin/promocodes — создать промокод.
 *
 * Body: {
 *   code: string,                  // VIBEVOX25, SUMMER, ...
 *   percentOff: number,            // 1..100 (100 = бесплатно)
 *   duration?: 'forever' | 'once' | 'repeating',
 *   durationInMonths?: number,     // только для duration='repeating'
 *   maxRedemptions?: number,       // null = без лимита
 *   expiresAt?: string             // ISO datetime
 *   tiers?: string[]               // на какие тарифы (по умолчанию — на все)
 * }
 */
promoRouter.post('/', async (req: Request, res: Response) => {
  const { code, percentOff, duration = 'once', durationInMonths, maxRedemptions, expiresAt, tiers } = req.body || {};

  if (!code || typeof code !== 'string' || !/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return res.status(400).json({ error: 'Код должен быть 3-40 символов латиницы/цифр/дефиса/подчёркивания, заглавный' });
  }
  if (!percentOff || percentOff < 1 || percentOff > 100) {
    return res.status(400).json({ error: 'percentOff должен быть от 1 до 100' });
  }
  if (!['forever', 'once', 'repeating'].includes(duration)) {
    return res.status(400).json({ error: 'duration: forever | once | repeating' });
  }
  if (duration === 'repeating' && (!durationInMonths || durationInMonths < 1)) {
    return res.status(400).json({ error: 'Для repeating нужен durationInMonths >= 1' });
  }

  try {
    const stripe = getStripe();

    // 0. Если уже есть АКТИВНЫЙ промокод с таким же code → конфликт. Подскажем юзеру.
    const existing = await stripe.promotionCodes.list({ code: code.toUpperCase(), active: true, limit: 1 });
    if (existing.data.length > 0) {
      return res.status(409).json({
        error: `Активный промокод '${code.toUpperCase()}' уже существует. Сначала деактивируйте или удалите его.`,
      });
    }

    // 1. Coupon (скидка)
    const couponParams: any = {
      percent_off: percentOff,
      duration,
      metadata: { source: 'vibevox' },
    };
    if (duration === 'repeating') couponParams.duration_in_months = durationInMonths;

    // Ограничение на тарифы через applies_to.products. Непустой список tiers = ограничить
    // купон этими продуктами; пусто = на все тарифы (фронт шлёт только ['premium'] либо ничего).
    if (Array.isArray(tiers) && tiers.length > 0) {
      try {
        const products = await stripe.products.list({ active: true, limit: 100 });
        const wantedKeys = new Set(tiers.map((t: string) => (t === 'standard_yearly' ? 'standard' : t)));
        const productIds = products.data
          .filter((p) => wantedKeys.has(p.metadata?.vibevox_key || ''))
          .map((p) => p.id);
        if (productIds.length > 0) {
          couponParams.applies_to = { products: productIds };
        } else {
          // Тариф(ы) выбран(ы), но соответствующий Stripe-продукт не найден (sync EUR/USD
          // ещё не запускался) → купон создаётся БЕЗ ограничения = действует на все продукты.
          console.warn(`[Promo] applies_to: продукт(ы) для тарифов [${tiers.join(', ')}] не найдены в Stripe — купон будет без ограничения по тарифу. Запустите «Синхронизировать EUR/USD».`);
        }
      } catch (e) {
        console.warn('[Promo] applies_to: не удалось получить products:', e);
      }
    }

    const coupon = await stripe.coupons.create(couponParams);

    // 2. PromotionCode (человеко-читаемый код)
    const promoParams: any = {
      coupon: coupon.id,
      code: code.toUpperCase(),
      active: true,
      metadata: { source: 'vibevox' },
    };
    if (maxRedemptions && maxRedemptions > 0) promoParams.max_redemptions = maxRedemptions;
    if (expiresAt) promoParams.expires_at = Math.floor(new Date(expiresAt).getTime() / 1000);

    const promotionCode = await stripe.promotionCodes.create(promoParams);

    // Сохраняем в БД (best-effort)
    try {
      await pool.query(
        `INSERT INTO promo_codes (code, discount_type, discount_value, max_redemptions, expires_at, stripe_coupon_id, stripe_promotion_code_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [code, 'percentage', percentOff, maxRedemptions ?? null, expiresAt ?? null, coupon.id, promotionCode.id]
      );
    } catch (e) {
      console.warn('[Promo] Не удалось сохранить в БД (Stripe-запись создана):', e);
    }

    return res.status(200).json({
      status: 'success',
      message: `Промокод ${code.toUpperCase()} создан (${percentOff}% скидка, ${duration}).`,
      code: code.toUpperCase(),
      couponId: coupon.id,
      promotionCodeId: promotionCode.id,
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * PATCH /api/admin/promocodes/:id
 * Меняет state промокода. Поля, разрешённые Stripe для PromotionCode: только active, metadata.
 *
 * Body: { active?: boolean }
 */
promoRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { active } = req.body || {};

  if (active !== undefined && typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active должен быть boolean' });
  }

  try {
    const stripe = getStripe();
    const updateParams: any = {};
    if (typeof active === 'boolean') updateParams.active = active;
    if (Object.keys(updateParams).length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }
    const pc = await stripe.promotionCodes.update(id, updateParams);
    return res.status(200).json({
      status: 'success',
      message: pc.active ? 'Промокод активирован' : 'Промокод деактивирован',
      active: pc.active,
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * DELETE /api/admin/promocodes/:id[?hard=true]
 *  - default → soft (active=false). Использовать клиенты не смогут, но запись остаётся.
 *  - ?hard=true → пытаемся удалить Coupon из Stripe (PromotionCode удалится каскадно).
 *    Stripe позволяет удалять Coupon, если он не был использован.
 */
promoRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const hard = String(req.query?.hard || '') === 'true';

  try {
    const stripe = getStripe();

    if (!hard) {
      await stripe.promotionCodes.update(id, { active: false });
      return res.status(200).json({ status: 'success', message: 'Промокод деактивирован' });
    }

    // Hard delete: нужен couponId — получаем сначала.
    const pc = await stripe.promotionCodes.retrieve(id);
    // Стрипу нужно деактивировать coupon — сам promotion_code удалить нельзя API.
    // Но удаление coupon делает все связанные promotion codes недействительными.
    const couponId = typeof pc.coupon === 'string' ? pc.coupon : pc.coupon?.id;
    if (!couponId) {
      return res.status(404).json({ error: 'Coupon для этого промокода не найден' });
    }

    // Сначала деактивируем promotion_code (на случай, если delete coupon упадёт)
    try { await stripe.promotionCodes.update(id, { active: false }); } catch { /* */ }

    try {
      await stripe.coupons.del(couponId);
    } catch (e: any) {
      // Stripe иногда блокирует удаление coupon (например, при существующих subscription discounts).
      // В этом случае оставляем promotion_code деактивированным.
      console.warn('[Promo] Hard-delete coupon failed:', e?.message || e);
      return res.status(200).json({
        status: 'partial',
        message: 'Промокод деактивирован. Полностью удалить из Stripe не получилось (' + (e?.message || 'unknown') + '), но клиенты больше не смогут им воспользоваться.',
      });
    }

    // Чистим запись из БД (best-effort)
    try {
      await pool.query('DELETE FROM promo_codes WHERE stripe_promotion_code_id = $1', [id]);
    } catch { /* */ }

    return res.status(200).json({ status: 'success', message: 'Промокод полностью удалён из Stripe' });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default promoRouter;
