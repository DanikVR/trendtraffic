/**
 * Admin Users router — суперадминская панель «Пользователи».
 *
 * Endpoints:
 *   GET    /api/admin/users                     — список с фильтрами/поиском
 *   POST   /api/admin/users/:userId/credit      — зачислить минуты руками
 *
 * Доступ: только superadmin (JWT с role='superadmin').
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { removeUserFromFallback } from '../../db/index.js';
import { sendTelegramAdminMessage } from '../notifications/telegram.js';
import { TIER_SECONDS_MAP } from '@vibevox/shared';
import { getStripe } from '../billing/service.js';
import { send500 } from '../../utils/http_error.js';
import { blockAccount, unblockAccount, listBlockedAccounts } from '../auth/account_blocklist.js';

// Папка загруженных медиа (та же, что у enterprise_chat / quest_flow) — чистим файлы удаляемого tenant'а.
const __au_filename = fileURLToPath(import.meta.url);
const __au_dirname = path.dirname(__au_filename);
const UPLOADS_DIR = path.resolve(__au_dirname, '../../../../uploads/enterprise-chat');

const ALLOWED_TIERS = ['premium', 'plus', 'standard', 'standard_yearly', 'enterprise', 'trial'] as const;
type AllowedTier = typeof ALLOWED_TIERS[number];

const adminUsersRouter = Router();
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
    (req as any).adminEmail = decoded.email;
    next();
  } catch (err: any) {
    const name = err?.name || 'Error';
    if (name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Сессия истекла. Выйдите и войдите снова.' });
    }
    return res.status(401).json({ error: `Невалидный токен (${name}). Попробуйте перелогиниться.` });
  }
}

adminUsersRouter.use(requireSuperAdmin);

// ============================================================================
// BLOCKLIST (чёрный список удалённых аккаунтов)
// ВАЖНО: регистрируем ДО маршрутов '/:userId', иначе Express примет 'blocklist'
// за userId. Разблокировка нужна на случай ошибочного удаления.
// ============================================================================

/** GET /api/admin/users/blocklist — список заблокированных (удалённых) email'ов. */
adminUsersRouter.get('/blocklist', async (_req: Request, res: Response) => {
  try {
    const blocked = await listBlockedAccounts();
    return res.json({ status: 'success', blocked });
  } catch (err: any) {
    console.error('[AdminUsers] blocklist list error:', err);
    return send500(res, err, 'admin.users');
  }
});

/** DELETE /api/admin/users/blocklist — разблокировать email (body или query: { email }). */
adminUsersRouter.delete('/blocklist', async (req: Request, res: Response) => {
  const email = String((req.body && req.body.email) || req.query.email || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Укажите email для разблокировки' });
  }
  try {
    const removed = await unblockAccount(email);
    if (!removed) {
      return res.status(404).json({ error: 'Этот email не в чёрном списке' });
    }
    const adminEmail = (req as any).adminEmail || 'superadmin';
    sendTelegramAdminMessage(
      `♻️ <b>Разблокирован аккаунт</b>\n` +
      `<b>Email:</b> ${escapeHtml(email)}\n` +
      `<b>Кто:</b> ${escapeHtml(adminEmail)}`
    ).catch(() => {});
    return res.json({ status: 'success', message: `Email ${email} разблокирован — снова можно зарегистрироваться.` });
  } catch (err: any) {
    console.error('[AdminUsers] unblock error:', err);
    return send500(res, err, 'admin.users');
  }
});

/**
 * Гарантирует, что у tenant'а есть запись в subscriptions.
 * Если нет — создаёт пустую (trial, inactive, balance=0).
 * Это нужно, потому что у старых пользователей (до v0.7.x) подписка могла не создаться,
 * и `UPDATE subscriptions ... WHERE tenant_id` будет тихо отказывать.
 */
async function ensureSubscription(tenantId: string): Promise<void> {
  await pool.query(
    `INSERT INTO subscriptions (tenant_id, tier, status, translation_minutes_balance)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId, 'trial', 'incomplete', 0]
  );
}

/**
 * Best-effort: удаляет с диска файлы медиа всех комнат tenant'а (uploads/enterprise-chat).
 * Вызывать ДО удаления записей — после удаления media_url уже не узнать.
 */
async function deleteTenantMediaFiles(tenantId: string): Promise<void> {
  let roomIds: string[] = [];
  try {
    const r = await pool.query(`SELECT id FROM rooms WHERE creator_tenant_id = $1`, [tenantId]);
    roomIds = (r.rows as any[]).map((x) => x.id).filter(Boolean);
  } catch {
    return;
  }
  for (const roomId of roomIds) {
    let urls: string[] = [];
    try {
      const m = await pool.query(`SELECT media_url FROM room_messages WHERE room_id = $1`, [roomId]);
      urls = (m.rows as any[])
        .map((x) => x.media_url)
        .filter((u) => typeof u === 'string' && u.startsWith('/uploads/enterprise-chat/'));
    } catch {
      continue;
    }
    for (const url of urls) {
      try {
        const fp = path.join(UPLOADS_DIR, path.basename(url));
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch {
        /* best-effort */
      }
    }
  }
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * GET /api/admin/users
 * Query: ?search=<email or name>&paidOnly=1&limit=200
 */
adminUsersRouter.get('/', async (req: Request, res: Response) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const paidOnly = req.query.paidOnly === '1' || req.query.paidOnly === 'true';
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '200'), 10) || 200, 1), 1000);
  const fromIso = String(req.query.from || '').trim();
  const toIso = String(req.query.to || '').trim();
  const tierFilter = String(req.query.tier || '').trim();
  const fromTs = fromIso ? Date.parse(fromIso) : NaN;
  const toTs = toIso ? Date.parse(toIso) : NaN;

  try {
    // Один запрос, который маршрутизатор fallback ловит по маркеру "FROM users u LEFT JOIN tenants".
    // На реальной PostgreSQL — обычный JOIN; в fallback — собирает плоскую таблицу из in-memory.
    const result = await pool.query(
      `SELECT
         u.id              AS user_id,
         u.email           AS email,
         u.role            AS role,
         u.google_id       AS google_id,
         u.created_at      AS user_created_at,
         t.id              AS tenant_id,
         t.name            AS tenant_name,
         t.status          AS tenant_status,
         t.stripe_customer_id AS stripe_customer_id,
         s.tier            AS tier,
         s.status          AS sub_status,
         s.billing_period  AS billing_period,
         s.translation_minutes_balance AS translation_minutes_balance,
         s.rollover_seconds AS rollover_seconds,
         s.current_period_end AS current_period_end,
         s.total_paid_minutes AS total_paid_minutes,
         s.last_payment_minutes AS last_payment_minutes,
         s.last_payment_at AS last_payment_at,
         s.stripe_subscription_id AS stripe_subscription_id,
         s.cancel_at_period_end AS cancel_at_period_end,
         s.canceled_by AS canceled_by,
         s.canceled_at AS canceled_at
       FROM users u
       LEFT JOIN tenants t       ON t.id = u.tenant_id
       LEFT JOIN subscriptions s ON s.tenant_id = u.tenant_id
       ORDER BY u.created_at DESC NULLS LAST`,
      []
    );

    let rows = (result.rows as any[]).map((r) => {
      const balanceSec = Number(r.translation_minutes_balance || 0);
      const rolloverSec = Number(r.rollover_seconds || 0);
      const remainingMinutes = Math.floor((balanceSec + rolloverSec) / 60);
      const totalPaidMinutes = Number(r.total_paid_minutes || 0);
      return {
        userId: r.user_id,
        email: r.email,
        role: r.role,
        googleId: r.google_id || null,
        registeredAt: r.user_created_at,
        tenantId: r.tenant_id || null,
        tenantName: r.tenant_name,
        tenantStatus: r.tenant_status,
        stripeCustomerId: r.stripe_customer_id || null,
        tier: r.tier || null,
        subStatus: r.sub_status || null,
        billingPeriod: r.billing_period || null,
        balanceSeconds: balanceSec,
        rolloverSeconds: rolloverSec,
        remainingMinutes,
        currentPeriodEnd: r.current_period_end || null,
        totalPaidMinutes,
        lastPaymentMinutes: r.last_payment_minutes != null ? Number(r.last_payment_minutes) : null,
        lastPaymentAt: r.last_payment_at || null,
        hasPaid: totalPaidMinutes > 0,
        stripeSubscriptionId: r.stripe_subscription_id || null,
        cancelAtPeriodEnd: !!r.cancel_at_period_end,
        canceledBy: r.canceled_by || null,
        canceledAt: r.canceled_at || null,
      };
    });

    if (paidOnly) {
      rows = rows.filter(r => r.hasPaid);
    }
    if (tierFilter) {
      rows = rows.filter(r => r.tier === tierFilter);
    }
    if (!isNaN(fromTs)) {
      rows = rows.filter(r => r.registeredAt && Date.parse(String(r.registeredAt)) >= fromTs);
    }
    if (!isNaN(toTs)) {
      // toIso interpretation: включаем весь день — добавляем 24ч
      const endOfDay = toTs + 24 * 60 * 60 * 1000;
      rows = rows.filter(r => r.registeredAt && Date.parse(String(r.registeredAt)) < endOfDay);
    }
    if (search) {
      rows = rows.filter(r =>
        (r.email || '').toLowerCase().includes(search) ||
        (r.tenantName || '').toLowerCase().includes(search) ||
        (r.tenantId || '').toLowerCase().includes(search) ||
        (r.stripeCustomerId || '').toLowerCase().includes(search)
      );
    }

    rows = rows.slice(0, limit);
    const totalRegistered = (result.rows as any[]).length;
    const totalPaid = (result.rows as any[]).filter(r => Number(r.total_paid_minutes || 0) > 0).length;

    return res.json({
      status: 'success',
      users: rows,
      stats: {
        totalRegistered,
        totalPaid,
        returned: rows.length,
      },
    });
  } catch (err: any) {
    console.error('[AdminUsers] list error:', err);
    return send500(res, err, 'admin.users');
  }
});

/**
 * POST /api/admin/users/:userId/credit
 * Body: { minutes: number, note?: string }
 *
 * Зачисляет минуты в translation_minutes_balance подписки tenant'а
 * И обновляет total_paid_minutes / last_payment_*.
 */
adminUsersRouter.post('/:userId/credit', async (req: Request, res: Response) => {
  const userId = req.params.userId;
  const minutes = parseInt(String(req.body?.minutes || '0'), 10);
  const note = String(req.body?.note || '').slice(0, 200);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return res.status(400).json({ error: 'minutes должно быть положительным числом' });
  }
  if (minutes > 100000) {
    return res.status(400).json({ error: 'Слишком много минут за раз (>100000)' });
  }

  try {
    // Найдём tenant_id и email через единый JOIN — fallback handler уже умеет это.
    const lookup = await pool.query(
      `SELECT u.id AS user_id, u.email AS email, u.tenant_id AS tenant_id, t.name AS tenant_name
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN subscriptions s ON s.tenant_id = u.tenant_id`,
      []
    );
    const row = (lookup.rows as any[]).find((r) => r.user_id === userId);
    if (!row || !row.tenant_id) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const tenantId = row.tenant_id;
    const email = row.email;

    // Гарантируем что подписка существует, иначе UPDATE тихо ничего не сделает.
    await ensureSubscription(tenantId);

    const seconds = minutes * 60;
    await pool.query(
      `UPDATE subscriptions
       SET translation_minutes_balance = translation_minutes_balance + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $2`,
      [seconds, tenantId]
    );
    await pool.query(
      `UPDATE subscriptions
       SET total_paid_minutes = total_paid_minutes + $1,
           last_payment_minutes = $2,
           last_payment_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $3`,
      [minutes, minutes, tenantId]
    );

    const adminEmail = (req as any).adminEmail || 'superadmin';
    sendTelegramAdminMessage(
      `🎁 <b>Админ-кредит минут</b>\n` +
      `<b>Кому:</b> ${escapeHtml(email || '—')}\n` +
      `<b>Минут:</b> ${minutes}\n` +
      `<b>Кто:</b> ${escapeHtml(adminEmail)}` +
      (note ? `\n<b>Комментарий:</b> ${escapeHtml(note)}` : '')
    ).catch(() => {});

    return res.json({
      status: 'success',
      message: `Зачислено ${minutes} мин пользователю ${email}.`,
      tenantId,
      minutes,
    });
  } catch (err: any) {
    console.error('[AdminUsers] credit error:', err);
    return send500(res, err, 'admin.users');
  }
});

/**
 * PATCH /api/admin/users/:userId/tier
 * Body: { tier: 'plus' | 'standard' | 'standard_yearly' | 'enterprise' | 'trial', addMinutes?: boolean }
 *
 * Меняет тариф. Если addMinutes !== false — добавляет минуты по TIER_SECONDS_MAP
 * к translation_minutes_balance, обновляет total_paid_minutes / last_payment.
 */
adminUsersRouter.patch('/:userId/tier', async (req: Request, res: Response) => {
  const userId = req.params.userId;
  const tier = String(req.body?.tier || '') as AllowedTier;
  const addMinutes = req.body?.addMinutes !== false; // по умолчанию true

  if (!ALLOWED_TIERS.includes(tier)) {
    return res.status(400).json({ error: `tier должен быть одним из: ${ALLOWED_TIERS.join(', ')}` });
  }

  try {
    const lookup = await pool.query(
      `SELECT u.id AS user_id, u.email AS email, u.tenant_id AS tenant_id
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN subscriptions s ON s.tenant_id = u.tenant_id`,
      []
    );
    const row = (lookup.rows as any[]).find((r) => r.user_id === userId);
    if (!row || !row.tenant_id) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const tenantId = row.tenant_id;
    const email = row.email;

    const status = tier === 'trial' ? 'inactive' : 'active';
    const billingPeriod = tier === 'standard_yearly' ? 'yearly' : (tier === 'enterprise' ? 'one_time' : 'monthly');
    const secondsForTier = TIER_SECONDS_MAP[tier] ?? 0;
    const minutesForTier = Math.round(secondsForTier / 60);

    // Гарантируем что подписка существует, иначе UPDATE тихо ничего не сделает.
    await ensureSubscription(tenantId);

    // Меняем тариф + статус. translation_minutes_balance: если addMinutes — обнуляем и заполняем по тарифу,
    // иначе оставляем как есть (только меняем tier/status). Для enterprise всегда заполняем "безлимит".
    if (addMinutes) {
      await pool.query(
        `UPDATE subscriptions
         SET tier = $1, status = $2, billing_period = $3,
             translation_minutes_balance = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $5`,
        [tier, status, billingPeriod, secondsForTier, tenantId]
      );
      await pool.query(
        `UPDATE subscriptions
         SET total_paid_minutes = total_paid_minutes + $1,
             last_payment_minutes = $2,
             last_payment_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $3`,
        [minutesForTier, minutesForTier, tenantId]
      );
    } else {
      await pool.query(
        `UPDATE subscriptions
         SET tier = $1, status = $2, billing_period = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $4`,
        [tier, status, billingPeriod, tenantId]
      );
    }

    const adminEmail = (req as any).adminEmail || 'superadmin';
    sendTelegramAdminMessage(
      `🔧 <b>Админ изменил тариф</b>\n` +
      `<b>Кому:</b> ${escapeHtml(email || '—')}\n` +
      `<b>Новый тариф:</b> ${escapeHtml(tier)} (${escapeHtml(billingPeriod)})\n` +
      (addMinutes ? `<b>Минут начислено:</b> ${minutesForTier}\n` : `<b>Баланс не изменён</b>\n`) +
      `<b>Кто:</b> ${escapeHtml(adminEmail)}`
    ).catch(() => {});

    return res.json({ status: 'success', tier, addMinutes, minutesAdded: addMinutes ? minutesForTier : 0 });
  } catch (err: any) {
    console.error('[AdminUsers] tier change error:', err);
    return send500(res, err, 'admin.users');
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Удаляет учётную запись пользователя, связанный tenant и подписку.
 * Tenant в схеме привязан к user через FK, поэтому удаляем tenant (CASCADE снесёт остальное).
 */
adminUsersRouter.delete('/:userId', async (req: Request, res: Response) => {
  const userId = req.params.userId;

  try {
    const lookup = await pool.query(
      `SELECT u.id AS user_id, u.email AS email, u.google_id AS google_id,
              u.tenant_id AS tenant_id, t.name AS tenant_name
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN subscriptions s ON s.tenant_id = u.tenant_id`,
      []
    );
    const row = (lookup.rows as any[]).find((r) => r.user_id === userId);
    if (!row) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const tenantId = row.tenant_id;
    const email = row.email;
    const googleId = row.google_id || null;
    const adminEmail = (req as any).adminEmail || 'superadmin';

    // 1. БЛОКИРОВКА email/google_id — ПЕРВЫМ делом, до сноса данных. Иначе человек зайдёт
    //    заново через Google (тот авто-создаст новый пустой аккаунт) — и удаление выглядит
    //    «не сработавшим». Если блокировка упала — прерываемся, ничего не удалив.
    if (email) {
      try {
        await blockAccount(email, googleId, `superadmin:${adminEmail}`, 'Удалён суперадмином');
      } catch (blockErr: any) {
        console.error('[AdminUsers] blockAccount failed, aborting delete:', blockErr?.message || blockErr);
        return res.status(500).json({ error: 'Не удалось заблокировать email — удаление отменено, повторите.' });
      }
    }

    // 2. Файлы медиа комнат tenant'а с диска (best-effort, до удаления записей).
    if (tenantId) {
      await deleteTenantMediaFiles(tenantId).catch(() => {});
    }

    // 3. Данные пользователя ВНЕ tenant'а (user-scoped) — всегда.
    //    Партнёрка привязана к user_id (не к tenant), поэтому чистим отдельно:
    //      (а) его атрибуция как ПРИВЛЕЧЁННОГО — referrals.referred_user_id;
    //      (б) его собственный профиль партнёра — partners.user_id (каскадит его
    //          referrals по partner_id + referral_clicks по коду).
    //    На PG это снесёт и каскад FK (ON DELETE CASCADE), но в fallback каскадов нет.
    await pool.query(`DELETE FROM user_profiles WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM referrals WHERE referred_user_id = $1`, [userId]);
    await pool.query(`DELETE FROM partners WHERE user_id = $1`, [userId]);

    // 4. Сносим ВСЕ данные/ключи/привязки tenant'а. На PG большинство FK = ON DELETE
    //    CASCADE (от tenants), НО rooms.creator_tenant_id = ON DELETE SET NULL → комнаты
    //    сносим ЯВНО. Явные DELETE по ключам/привязкам нужны для fallback (там каскадов
    //    нет) — иначе Quest Flow-ключи / SIP-транки «осиротеют», а QF-ключ продолжит
    //    аутентифицировать входящие запросы по хэшу (verifyKey ищет по хэшу глобально).
    if (tenantId) {
      await pool.query(`DELETE FROM tenant_quest_flow_keys WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM tenant_need_tags WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM sip_trunks WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM rooms WHERE creator_tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM subscriptions WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM users WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
    } else {
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    }
    // ВСЕГДА синхронизируем JSON-фоллбэк, иначе после рестарта удалённый юзер «воскресает».
    removeUserFromFallback(userId);

    sendTelegramAdminMessage(
      `🗑 <b>Удалён пользователь (полностью)</b>\n` +
      `<b>Email:</b> ${escapeHtml(email || '—')}${email ? ' <i>(заблокирован)</i>' : ''}\n` +
      `<b>Tenant:</b> <code>${escapeHtml(tenantId || '—')}</code>\n` +
      `<b>Кто:</b> ${escapeHtml(adminEmail)}`
    ).catch(() => {});

    return res.json({
      status: 'success',
      message: `Пользователь ${email || userId} удалён полностью и заблокирован — войти заново нельзя.`,
      tenantId,
      blocked: !!email,
    });
  } catch (err: any) {
    console.error('[AdminUsers] delete error:', err);
    return send500(res, err, 'admin.users');
  }
});

/**
 * POST /api/admin/users/:userId/cancel-subscription
 * Отменяет Stripe-подписку с `cancel_at_period_end=true`.
 *  - Деньги не возвращаются.
 *  - Подписка остаётся активной до конца текущего периода (минуты доступны, можно докупить).
 *  - В конце периода Stripe сам её закрывает, webhook ставит status='canceled'.
 *
 * v0.9.5
 */
adminUsersRouter.post('/:userId/cancel-subscription', async (req: Request, res: Response) => {
  const userId = req.params.userId;
  try {
    const lookup = await pool.query(
      `SELECT u.id AS user_id, u.email AS email, u.tenant_id AS tenant_id,
              s.stripe_subscription_id AS stripe_subscription_id,
              s.cancel_at_period_end AS cancel_at_period_end,
              s.current_period_end AS current_period_end
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN subscriptions s ON s.tenant_id = u.tenant_id`,
      []
    );
    const row = (lookup.rows as any[]).find((r) => r.user_id === userId);
    if (!row || !row.tenant_id) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (!row.stripe_subscription_id) {
      return res.status(400).json({ error: 'У пользователя нет активной Stripe-подписки' });
    }
    if (row.cancel_at_period_end) {
      return res.status(200).json({
        status: 'already',
        message: 'Подписка уже помечена на отмену в конце периода',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: row.current_period_end,
      });
    }

    // Просим Stripe отменить в конце периода (без возврата денег).
    const stripe = getStripe();
    const updated = await stripe.subscriptions.update(row.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Webhook customer.subscription.updated всё равно прилетит и обновит cancel_at_period_end в БД.
    // Но на всякий случай — обновляем сразу, чтобы UI не мигал.
    const adminEmail = (req as any).adminEmail || 'superadmin';
    try {
      await pool.query(
        `UPDATE subscriptions
         SET cancel_at_period_end = TRUE,
             canceled_by = $1,
             canceled_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $2`,
        ['superadmin:' + adminEmail, row.tenant_id]
      );
    } catch (e) {
      console.warn('[AdminUsers] cancel-subscription: локальный апдейт упал, ждём webhook:', (e as Error).message);
    }

    const periodEnd = updated.current_period_end
      ? new Date(updated.current_period_end * 1000).toISOString()
      : (row.current_period_end || null);

    sendTelegramAdminMessage(
      `🛑 <b>Админ отменил подписку</b>\n` +
      `<b>Кому:</b> ${escapeHtml(row.email || '—')}\n` +
      `<b>Stripe sub:</b> <code>${escapeHtml(row.stripe_subscription_id)}</code>\n` +
      `<b>Будет закрыта:</b> ${periodEnd ? new Date(periodEnd).toLocaleString('ru-RU') : '—'}\n` +
      `<b>Кто:</b> ${escapeHtml(adminEmail)}`
    ).catch(() => {});

    return res.json({
      status: 'success',
      message: 'Подписка будет отменена в конце текущего периода. Деньги не возвращаются.',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEnd,
    });
  } catch (err: any) {
    console.error('[AdminUsers] cancel-subscription error:', err);
    return send500(res, err, 'admin.users');
  }
});

/**
 * POST /api/admin/users/:userId/resume-subscription
 * Откатывает cancel_at_period_end (если ещё period не закончился).
 * v0.9.5
 */
adminUsersRouter.post('/:userId/resume-subscription', async (req: Request, res: Response) => {
  const userId = req.params.userId;
  try {
    const lookup = await pool.query(
      `SELECT u.id AS user_id, u.email AS email, u.tenant_id AS tenant_id,
              s.stripe_subscription_id AS stripe_subscription_id,
              s.cancel_at_period_end AS cancel_at_period_end
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN subscriptions s ON s.tenant_id = u.tenant_id`,
      []
    );
    const row = (lookup.rows as any[]).find((r) => r.user_id === userId);
    if (!row || !row.tenant_id) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (!row.stripe_subscription_id) {
      return res.status(400).json({ error: 'У пользователя нет Stripe-подписки' });
    }
    if (!row.cancel_at_period_end) {
      return res.status(200).json({ status: 'already', message: 'Подписка уже активна без отмены' });
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: false });

    const adminEmail = (req as any).adminEmail || 'superadmin';
    try {
      await pool.query(
        `UPDATE subscriptions
         SET cancel_at_period_end = FALSE,
             canceled_by = NULL,
             canceled_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $1`,
        [row.tenant_id]
      );
    } catch (e) {
      console.warn('[AdminUsers] resume-subscription: локальный апдейт упал, ждём webhook');
    }

    sendTelegramAdminMessage(
      `▶️ <b>Админ восстановил подписку</b>\n` +
      `<b>Кому:</b> ${escapeHtml(row.email || '—')}\n` +
      `<b>Кто:</b> ${escapeHtml(adminEmail)}`
    ).catch(() => {});

    return res.json({ status: 'success', message: 'Подписка снова продлевается автоматически.' });
  } catch (err: any) {
    console.error('[AdminUsers] resume-subscription error:', err);
    return send500(res, err, 'admin.users');
  }
});

export default adminUsersRouter;
