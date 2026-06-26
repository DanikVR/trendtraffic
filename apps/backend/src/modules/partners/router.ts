/**
 * Partners router — Партнёрская программа VibeVox (v1.0.6).
 *
 * Public (user):
 *   POST /api/partners/track-click      — fire-and-forget трекер ?Vibe=CODE
 *   GET  /api/partners/program          — публичные условия + WhatsApp контакт
 *   GET  /api/partners/me               — мои метрики + ссылка (auto-create на первом запросе)
 *
 * Admin (superadmin):
 *   GET  /api/admin/partners            — список партнёров с агрегатами
 *   PATCH /api/admin/partners/:id       — статус (active/disabled) + notes
 *   GET  /api/admin/partners/program    — текущие глобальные условия
 *   PUT  /api/admin/partners/program    — обновить условия + WhatsApp
 *
 * Хелперы:
 *   attributeRegistration(userId, code, source) — экспортируется для использования в auth/router.ts
 *   creditReferralPayment(tenantId, minutesAdded) — экспортируется для billing/webhook.ts
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../../db/index.js';

import { JWT_SECRET } from '../../config/secrets.js';

// ─── База: хелперы ────────────────────────────────────────────────────────────

const REF_QUERY_PARAM = 'Vibe';
const REF_COOKIE_NAME = 'vbvx_ref';

/** Генерируем 8-символьный код из crypto.randomBytes (base62-like). */
function generatePartnerCode(): string {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Хешируем IP для приватности (не храним сырой IP). */
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`vbvx-salt-${ip}`).digest('hex').slice(0, 32);
}

/** Получаем или создаём profile партнёра для текущего user_id. RLS не мешает: pool используется напрямую. */
async function ensurePartnerForUser(userId: string): Promise<{ id: string; code: string; status: string }> {
  // Сначала пытаемся найти
  const existing = await pool.query(
    'SELECT id, code, status FROM partners WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  // Создаём с retry на коллизию кода (вероятность ничтожна, но защищаемся)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePartnerCode();
    try {
      const inserted = await pool.query(
        `INSERT INTO partners (user_id, code) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
         RETURNING id, code, status`,
        [userId, code]
      );
      return inserted.rows[0];
    } catch (err: any) {
      // unique violation на code → пробуем другой
      if (err?.code === '23505' && err?.constraint?.includes('code')) continue;
      throw err;
    }
  }
  throw new Error('Не удалось сгенерировать уникальный код партнёра после 5 попыток');
}

/** Агрегаты по партнёру: переходы, регистрации, оплаты (чел / минуты). */
async function getPartnerStats(partnerId: string, code: string) {
  const [clicks, refs] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS n FROM referral_clicks WHERE partner_code = $1`,
      [code]
    ),
    pool.query(
      `SELECT
         COUNT(*)::int                                   AS registrations,
         COUNT(*) FILTER (WHERE first_paid_at IS NOT NULL)::int AS paid_users,
         COALESCE(SUM(total_paid_minutes), 0)::int      AS paid_minutes
       FROM referrals WHERE partner_id = $1`,
      [partnerId]
    ),
  ]);
  return {
    clicks: clicks.rows[0]?.n ?? 0,
    registrations: refs.rows[0]?.registrations ?? 0,
    paidUsers: refs.rows[0]?.paid_users ?? 0,
    paidMinutes: refs.rows[0]?.paid_minutes ?? 0,
  };
}

// ─── Экспортируемые хелперы для интеграции в auth + billing ──────────────────

/**
 * Записывает атрибуцию регистрации.
 * Вызывается из auth/router.ts: после успешной регистрации email+пароль ИЛИ Google OAuth.
 *
 * @param userId        — UUID нового пользователя (users.id)
 * @param partnerCode   — значение из cookie/headers (?Vibe=CODE)
 * @param source        — 'email' | 'google' — для аналитики канала
 *
 * Безопасно: при невалидном или disabled коде просто ничего не делает (молча).
 */
export async function attributeRegistration(
  userId: string,
  partnerCode: string | null | undefined,
  source: 'email' | 'google'
): Promise<void> {
  if (!partnerCode || typeof partnerCode !== 'string') return;
  const code = partnerCode.trim();
  if (!code || code.length > 32) return;

  try {
    // Найдём активного партнёра по коду
    const partnerRes = await pool.query(
      `SELECT p.id FROM partners p
       JOIN users u ON u.id = p.user_id
       WHERE p.code = $1 AND p.status = 'active' AND u.id <> $2
       LIMIT 1`,
      [code, userId]
    );
    if (partnerRes.rows.length === 0) return;
    const partnerId = partnerRes.rows[0].id;

    await pool.query(
      `INSERT INTO referrals (partner_id, referred_user_id, source)
       VALUES ($1, $2, $3)
       ON CONFLICT (referred_user_id) DO NOTHING`,
      [partnerId, userId, source]
    );
    console.log(`[Partners] Атрибуция регистрации: user=${userId} ← partner=${partnerId} (code=${code}, source=${source})`);
  } catch (err: any) {
    // Не блокируем регистрацию из-за сбоев атрибуции
    console.warn('[Partners] attributeRegistration failed (non-blocking):', err?.message || err);
  }
}

/**
 * Кредитует партнёру оплату приглашённого: обновляет referrals.total_paid_minutes
 * и проставляет first_paid_at, если ещё пуст.
 *
 * Вызывается из billing/webhook.ts при успешном subscription/topup-платеже.
 *
 * @param tenantId       — арендатор (один user = один tenant)
 * @param minutesAdded   — сколько минут добавлено в этом платеже
 */
export async function creditReferralPayment(tenantId: string, minutesAdded: number): Promise<void> {
  if (!tenantId || !minutesAdded || minutesAdded <= 0) return;
  try {
    // Найти любого пользователя этого tenant'а (1 tenant = 1 user)
    const userRow = await pool.query(
      `SELECT id FROM users WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    if (userRow.rows.length === 0) return;
    const userId = userRow.rows[0].id;

    await pool.query(
      `UPDATE referrals
       SET total_paid_minutes = total_paid_minutes + $1,
           first_paid_at = COALESCE(first_paid_at, CURRENT_TIMESTAMP)
       WHERE referred_user_id = $2`,
      [minutesAdded, userId]
    );
  } catch (err: any) {
    console.warn('[Partners] creditReferralPayment failed (non-blocking):', err?.message || err);
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireUser(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    (req as any).userId = decoded.id;
    (req as any).userEmail = decoded.email;
    (req as any).userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

function requireSuperAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ error: 'Только суперадмин' });
    }
    (req as any).adminId = decoded.id;
    (req as any).adminEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

// ─── PUBLIC ROUTER (/api/partners/*) ─────────────────────────────────────────

export const partnersPublicRouter = Router();

/**
 * POST /api/partners/track-click
 * Body: { code: string }
 * Без авторизации. Fire-and-forget.
 */
partnersPublicRouter.post('/track-click', async (req: Request, res: Response) => {
  const code = String(req.body?.code || '').trim();
  if (!code || code.length > 32) {
    return res.status(200).json({ ok: true, tracked: false });
  }

  try {
    // Лёгкая проверка: код существует и активен — иначе игнорируем шум
    const exists = await pool.query(
      `SELECT 1 FROM partners WHERE code = $1 AND status = 'active' LIMIT 1`,
      [code]
    );
    if (exists.rows.length === 0) {
      return res.status(200).json({ ok: true, tracked: false });
    }

    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '0.0.0.0';
    const ua = String(req.headers['user-agent'] || '').slice(0, 500);
    const referer = String(req.headers['referer'] || '').slice(0, 500);

    await pool.query(
      `INSERT INTO referral_clicks (partner_code, ip_hash, user_agent, referer)
       VALUES ($1, $2, $3, $4)`,
      [code, hashIp(ip), ua, referer]
    );

    return res.status(200).json({ ok: true, tracked: true });
  } catch (err: any) {
    console.warn('[Partners] track-click failed:', err?.message || err);
    // Не возвращаем ошибку клиенту — это fire-and-forget трекер
    return res.status(200).json({ ok: true, tracked: false });
  }
});

/**
 * GET /api/partners/program
 * Публичные условия программы + WhatsApp контакт.
 * Без авторизации (используется на странице настроек пользователя).
 */
partnersPublicRouter.get('/program', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT terms_text, whatsapp_contact, updated_at FROM partner_program_settings WHERE id = 1 LIMIT 1`
    );
    if (r.rows.length === 0) {
      return res.json({ termsText: '', whatsappContact: '', updatedAt: null });
    }
    return res.json({
      termsText: r.rows[0].terms_text || '',
      whatsappContact: r.rows[0].whatsapp_contact || '',
      updatedAt: r.rows[0].updated_at,
    });
  } catch (err: any) {
    console.error('[Partners] GET /program failed:', err?.message || err);
    return res.status(500).json({ error: 'Не удалось загрузить условия программы' });
  }
});

/**
 * GET /api/partners/me
 * Возвращает: { code, link, clicks, registrations, paidUsers, paidMinutes, queryParam }.
 * Лениво создаёт партнёра для текущего пользователя, если ещё нет.
 * Суперадмин (без user_id в БД) получит пустой ответ — у него нет своего tenant'а.
 */
partnersPublicRouter.get('/me', requireUser, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;

  // Суперадмин с hardcoded id='admin-1' — отдаём пустой пейлоад
  if (!userId || userId === 'admin-1' || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return res.json({
      enabled: false,
      reason: 'Суперадмин не участвует в партнёрской программе',
    });
  }

  try {
    const partner = await ensurePartnerForUser(userId);
    const stats = await getPartnerStats(partner.id, partner.code);

    // Базовый URL: возьмём из заголовка origin, иначе из env, иначе fallback
    const origin =
      (req.headers['origin'] as string | undefined) ||
      process.env.PUBLIC_APP_URL ||
      'https://vibevox.pro';
    const link = `${origin.replace(/\/+$/, '')}/?${REF_QUERY_PARAM}=${partner.code}`;

    return res.json({
      enabled: true,
      code: partner.code,
      status: partner.status,
      link,
      queryParam: REF_QUERY_PARAM,
      cookieName: REF_COOKIE_NAME,
      ...stats,
    });
  } catch (err: any) {
    console.error('[Partners] GET /me failed:', err?.message || err);
    return res.status(500).json({ error: 'Не удалось загрузить данные партнёра' });
  }
});

// ─── ADMIN ROUTER (/api/admin/partners/*) ────────────────────────────────────

export const partnersAdminRouter = Router();
partnersAdminRouter.use(requireSuperAdmin);

/**
 * GET /api/admin/partners
 * Список партнёров с агрегатами для таблицы суперадминки.
 */
partnersAdminRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(`
      SELECT
        p.id,
        p.code,
        p.status,
        p.notes,
        p.created_at,
        u.id              AS user_id,
        u.email,
        u.tenant_id,
        COALESCE(clicks.n, 0)::int          AS clicks,
        COALESCE(refs.registrations, 0)::int AS registrations,
        COALESCE(refs.paid_users, 0)::int    AS paid_users,
        COALESCE(refs.paid_minutes, 0)::int  AS paid_minutes
      FROM partners p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN (
        SELECT partner_code, COUNT(*)::int AS n
        FROM referral_clicks GROUP BY partner_code
      ) clicks ON clicks.partner_code = p.code
      LEFT JOIN (
        SELECT partner_id,
               COUNT(*)::int                                   AS registrations,
               COUNT(*) FILTER (WHERE first_paid_at IS NOT NULL)::int AS paid_users,
               COALESCE(SUM(total_paid_minutes), 0)::int      AS paid_minutes
        FROM referrals GROUP BY partner_id
      ) refs ON refs.partner_id = p.id
      ORDER BY p.created_at DESC
      LIMIT 1000
    `);

    return res.json({
      partners: r.rows.map((row: any) => ({
        id: row.id,
        code: row.code,
        status: row.status,
        notes: row.notes,
        createdAt: row.created_at,
        userId: row.user_id,
        email: row.email,
        tenantId: row.tenant_id,
        clicks: row.clicks,
        registrations: row.registrations,
        paidUsers: row.paid_users,
        paidMinutes: row.paid_minutes,
      })),
      total: r.rows.length,
    });
  } catch (err: any) {
    console.error('[Partners admin] GET / failed:', err?.message || err);
    return res.status(500).json({ error: 'Не удалось загрузить список партнёров' });
  }
});

/**
 * PATCH /api/admin/partners/:id
 * Body: { status?: 'active'|'disabled', notes?: string }
 */
partnersAdminRouter.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const status = req.body?.status;
  const notes = req.body?.notes;

  if (status && !['active', 'disabled'].includes(status)) {
    return res.status(400).json({ error: 'status должен быть active или disabled' });
  }

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (status !== undefined) { fields.push(`status = $${i++}`); values.push(status); }
    if (notes !== undefined)  { fields.push(`notes = $${i++}`);  values.push(notes); }
    if (fields.length === 0) return res.status(400).json({ error: 'Нечего обновлять' });

    values.push(id);
    const r = await pool.query(
      `UPDATE partners SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, code, status, notes`,
      values
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Партнёр не найден' });
    return res.json({ status: 'success', partner: r.rows[0] });
  } catch (err: any) {
    console.error('[Partners admin] PATCH /:id failed:', err?.message || err);
    return res.status(500).json({ error: 'Не удалось обновить партнёра' });
  }
});

/**
 * POST /api/admin/partners/:id/reset
 * Сбрасывает статистику партнёра в 0 (переходы / регистрации / оплаты): удаляет его
 * referral_clicks (по коду) и referrals (по partner_id). САМ партнёр остаётся активным.
 * Применение: после выплаты партнёру — обнулить накопленный счётчик.
 */
partnersAdminRouter.post('/:id/reset', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pr = await pool.query('SELECT code FROM partners WHERE id = $1', [id]);
    if (pr.rows.length === 0) return res.status(404).json({ error: 'Партнёр не найден' });
    const code = pr.rows[0].code;
    await pool.query('DELETE FROM referral_clicks WHERE partner_code = $1', [code]);
    await pool.query('DELETE FROM referrals WHERE partner_id = $1', [id]);
    return res.json({ status: 'success' });
  } catch (err: any) {
    console.error('[Partners admin] POST /:id/reset failed:', err?.message || err);
    return res.status(500).json({ error: 'Не удалось сбросить статистику партнёра' });
  }
});

/**
 * DELETE /api/admin/partners/:id
 * Полностью удаляет партнёра: referral_clicks (по коду), referrals (по partner_id, на PG
 * каскадом FK / в fallback — handler) и сам профиль. Нужно для зачистки «осиротевших»
 * партнёров (пользователь уже удалён) и ручного удаления вообще.
 * NB: если у партнёра ещё ЕСТЬ живой пользователь — тот при следующем заходе в /settings
 * снова лениво получит партнёрский профиль (с новым кодом). Это ожидаемо.
 */
partnersAdminRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pr = await pool.query('SELECT code FROM partners WHERE id = $1', [id]);
    if (pr.rows.length === 0) return res.status(404).json({ error: 'Партнёр не найден' });
    const code = pr.rows[0].code;
    // referral_clicks без FK → чистим явно (и на PG, и в fallback). partners → каскадит referrals.
    await pool.query('DELETE FROM referral_clicks WHERE partner_code = $1', [code]);
    await pool.query('DELETE FROM partners WHERE id = $1', [id]);
    return res.json({ status: 'success' });
  } catch (err: any) {
    console.error('[Partners admin] DELETE /:id failed:', err?.message || err);
    return res.status(500).json({ error: 'Не удалось удалить партнёра' });
  }
});

/** GET /api/admin/partners/program — то же что public, но через admin-роутер для удобства. */
partnersAdminRouter.get('/program', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT terms_text, whatsapp_contact, updated_at FROM partner_program_settings WHERE id = 1 LIMIT 1`
    );
    if (r.rows.length === 0) {
      return res.json({ termsText: '', whatsappContact: '', updatedAt: null });
    }
    return res.json({
      termsText: r.rows[0].terms_text || '',
      whatsappContact: r.rows[0].whatsapp_contact || '',
      updatedAt: r.rows[0].updated_at,
    });
  } catch (err: any) {
    console.error('[Partners admin] GET /program failed:', err?.message || err);
    return res.status(500).json({ error: 'Не удалось загрузить условия' });
  }
});

/**
 * PUT /api/admin/partners/program
 * Body: { termsText?: string, whatsappContact?: string }
 */
partnersAdminRouter.put('/program', async (req: Request, res: Response) => {
  const termsText = typeof req.body?.termsText === 'string' ? req.body.termsText : null;
  const whatsapp = typeof req.body?.whatsappContact === 'string'
    ? req.body.whatsappContact.trim().slice(0, 64)
    : null;
  const adminId = (req as any).adminId || null;
  // adminId может быть 'admin-1' для хардкод-суперадмина — но колонка UUID,
  // поэтому в этом случае пишем NULL и просто сохраняем без авторства.
  const updaterUuid = (adminId && /^[0-9a-f-]{36}$/i.test(adminId)) ? adminId : null;

  try {
    await pool.query(
      `INSERT INTO partner_program_settings (id, terms_text, whatsapp_contact, updated_at, updated_by)
       VALUES (1, COALESCE($1, ''), COALESCE($2, ''), CURRENT_TIMESTAMP, $3)
       ON CONFLICT (id) DO UPDATE SET
         terms_text = COALESCE(EXCLUDED.terms_text, partner_program_settings.terms_text),
         whatsapp_contact = COALESCE(EXCLUDED.whatsapp_contact, partner_program_settings.whatsapp_contact),
         updated_at = CURRENT_TIMESTAMP,
         updated_by = EXCLUDED.updated_by`,
      [termsText, whatsapp, updaterUuid]
    );
    return res.json({ status: 'success' });
  } catch (err: any) {
    console.error('[Partners admin] PUT /program failed:', err?.message || err);
    return res.status(500).json({ error: 'Не удалось сохранить условия' });
  }
});

// Default export: legacy-friendly (если кто-то импортирует router без named)
export default partnersPublicRouter;
