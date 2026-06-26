import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../db/index.js';
import {
  getSettingsForClient, saveSettings,
  getSiteScripts, saveSiteScripts,
  getLiveKitUrl, getLiveKitKey, getLiveKitSecret,
  getGeminiApiKey, getTelegramToken,
  getChatwootUrl, getChatwootToken,
  getGoogleClientId, getGoogleClientSecret,
  getStripeSecretKey,
  getTikHubApiKey,
} from '../../config/systemConfig.js';
import { validateTikHubKey } from '../tikhub/tikhub_client.js';
import { RoomServiceClient } from 'livekit-server-sdk';
import { sendTelegramAdminMessage } from '../notifications/telegram.js';
import { attributeRegistration } from '../partners/router.js';
import { isAccountBlocked } from './account_blocklist.js';

const router = Router();
import { JWT_SECRET } from '../../config/secrets.js';
import { loginLimiter, registerLimiter, passwordResetLimiter } from '../../config/rate_limit.js';

// ============================================================================================
// Серверное хранилище Google OAuth настроек (Client ID + Client Secret)
// Хранится в файле google-oauth.json рядом с бэкендом, НЕ на клиенте.
// ============================================================================================
const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const GOOGLE_OAUTH_FILE = path.resolve(__dirname_local, '..', '..', '..', 'google-oauth.json');

interface GoogleOAuthSettings {
  clientId: string;
  clientSecret: string;
}

function loadGoogleOAuthSettings(): GoogleOAuthSettings {
  try {
    if (fs.existsSync(GOOGLE_OAUTH_FILE)) {
      const raw = fs.readFileSync(GOOGLE_OAUTH_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Google OAuth Settings]: Не удалось загрузить google-oauth.json:', err);
  }
  return { clientId: '', clientSecret: '' };
}

function saveGoogleOAuthSettings(settings: GoogleOAuthSettings): void {
  try {
    fs.writeFileSync(GOOGLE_OAUTH_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[Google OAuth Settings]: Настройки сохранены в', GOOGLE_OAUTH_FILE);
  } catch (err) {
    console.error('[Google OAuth Settings]: Ошибка сохранения:', err);
  }
}

// ============================================================================================
// Серверное хранилище пароля СУПЕР-АДМИНА (superadmin-auth.json рядом с бэкендом).
// Зачем: супер-админ — это хардкод-личность БЕЗ строки в БД (id 'admin-1'). Чтобы его
// пароль можно было МЕНЯТЬ и ВОССТАНАВЛИВАТЬ по email (а не только хардкодом), храним
// bcrypt-хэш в файле. Файла нет → действует дефолтный пароль ниже (первый вход).
// После смены/сброса в файле лежит хэш, и вход идёт по нему.
// ============================================================================================
const SUPERADMIN_FILE = path.resolve(__dirname_local, '..', '..', '..', 'superadmin-auth.json');
const SUPERADMIN_EMAILS = ['live7610482@gmail.com', 'life7610482@gmail.com'];
const SUPERADMIN_CANONICAL_EMAIL = 'live7610482@gmail.com';
// Блок 5 (H1): дефолтный пароль для ПЕРВОГО входа суперадмина (пока нет
// superadmin-auth.json). Литерал-фолбэк есть в git-истории — в проде ОБЯЗАТЕЛЬНО
// переопределите env SUPERADMIN_DEFAULT_PASSWORD и/или смените пароль в /admin/config.
const SUPERADMIN_DEFAULT_PASSWORD = process.env.SUPERADMIN_DEFAULT_PASSWORD || 'Danyuk1976!';
if (process.env.NODE_ENV === 'production'
    && !process.env.SUPERADMIN_DEFAULT_PASSWORD
    && !fs.existsSync(SUPERADMIN_FILE)) {
  console.warn(
    '[SuperAdmin Auth] ⚠️  PRODUCTION: действует ДЕФОЛТНЫЙ пароль суперадмина из исходников ' +
    '(он в git!). Задайте SUPERADMIN_DEFAULT_PASSWORD в .env ИЛИ смените пароль в /admin/config ' +
    'сразу после первого входа.',
  );
}

/** true, если email принадлежит супер-админу (регистронезависимо). */
function isSuperAdminEmail(email: string): boolean {
  return SUPERADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

/** Текущий bcrypt-хэш пароля супер-админа из файла, либо null (значит — дефолтный пароль). */
function loadSuperAdminHash(): string | null {
  try {
    if (fs.existsSync(SUPERADMIN_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SUPERADMIN_FILE, 'utf-8'));
      return typeof raw.passwordHash === 'string' && raw.passwordHash ? raw.passwordHash : null;
    }
  } catch (err) {
    console.warn('[SuperAdmin Auth]: не удалось прочитать superadmin-auth.json:', err);
  }
  return null;
}

/** Сохраняет новый bcrypt-хэш пароля супер-админа в файл. */
function saveSuperAdminHash(passwordHash: string): void {
  fs.writeFileSync(
    SUPERADMIN_FILE,
    JSON.stringify({ passwordHash, updatedAt: new Date().toISOString() }, null, 2),
    'utf-8'
  );
  console.log('[SuperAdmin Auth]: пароль супер-админа обновлён в', SUPERADMIN_FILE);
}

/** Проверяет пароль супер-админа: по хэшу из файла, либо по дефолту (если файла нет). */
async function verifySuperAdminPassword(password: string): Promise<boolean> {
  const hash = loadSuperAdminHash();
  if (hash) return bcrypt.compare(password, hash);
  return password === SUPERADMIN_DEFAULT_PASSWORD;
}

/**
 * Материал для подписи reset-токена супер-админа. Меняется при смене пароля
 * (хэш в файле меняется) → старые ссылки сброса перестают валидироваться (одноразовость).
 */
function superAdminTokenMaterial(): string {
  return loadSuperAdminHash() || `default:${SUPERADMIN_DEFAULT_PASSWORD}`;
}

/** JWT-payload супер-админа (единая личность для обоих email). */
function superAdminPayload() {
  return { id: 'admin-1', email: SUPERADMIN_CANONICAL_EMAIL, role: 'superadmin', tenantId: 'global_admin' };
}

/**
 * POST /api/auth/login
 * Авторизация пользователя.
 * Поддерживает жесткий хардкод для суперадмина и проверку паролей через bcryptjs для обычных пользователей.
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  // 1. Супер-администратор: пароль хранится в superadmin-auth.json (изменяемый),
  //    либо дефолтный, если файла ещё нет. Минует БД и RLS.
  if (isSuperAdminEmail(email)) {
    if (await verifySuperAdminPassword(password)) {
      const payload = superAdminPayload();
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
      return res.json({
        status: 'success',
        token,
        user: payload,
      });
    }
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  // Блокировка: удалённый администратором аккаунт не может войти.
  if (await isAccountBlocked(email)) {
    return res.status(403).json({ error: 'Этот аккаунт был удалён администратором. Вход недоступен.' });
  }

  // 2. Обычная авторизация пользователей (через БД)
  let loginClient;
  try {
    loginClient = await pool.connect();

    // ВАЖНО: SET LOCAL работает ТОЛЬКО внутри транзакции.
    // Обходим RLS для поиска пользователя по email.
    // Без этого RLS-политика фильтрует все записи, т.к. app.current_tenant_id не задан.
    await loginClient.query('BEGIN');
    await loginClient.query("SET LOCAL row_security TO off");

    const result = await loginClient.query('SELECT * FROM users WHERE email = $1', [email]);
    await loginClient.query('COMMIT');
    loginClient.release();
    loginClient = null;
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден. Зарегистрируйтесь.' });
    }

    const user = result.rows[0];
      
    // Проверка хэша пароля через bcryptjs
    let passwordMatch = false;
    if (user.password_hash) {
      const isBcrypt = user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$');
      if (isBcrypt) {
        passwordMatch = await bcrypt.compare(password, user.password_hash);
      } else {
        passwordMatch = user.password_hash === password;
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      tenantId: user.tenant_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
    return res.json({
      status: 'success',
      token,
      user: payload,
    });

  } catch (error: any) {
    if (loginClient) loginClient.release();
    console.error('[Auth Login Error]:', error.message || error);
    return res.status(500).json({ error: 'Ошибка сервера при авторизации. Попробуйте позже.' });
  }
});

/**
 * POST /api/auth/register
 * Регистрация нового пользователя (арендатора) с триал-балансом 30 минут.
 * Использует транзакцию в PostgreSQL для создания tenants, users и subscriptions.
 */
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  const { email, password, companyName, partnerCode } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  // Блокировка: удалённый администратором email не может зарегистрироваться заново.
  if (await isAccountBlocked(email)) {
    return res.status(403).json({ error: 'Этот email заблокирован администратором. Регистрация недоступна.' });
  }

  const finalCompanyName = companyName || `Организация ${email}`;
  // partnerCode: фронт прокидывает из cookie vbvx_ref или из ?Vibe= в URL.
  // Может быть пустым/невалидным — это нормально, attributeRegistration отфильтрует.
  const refCode: string | null = typeof partnerCode === 'string' ? partnerCode.trim() : null;

  // Инициализируем клиент транзакции
  let client;
  try {
    // Хешируем пароль через bcryptjs
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    client = await pool.connect();
    
    // Начинаем транзакцию
    await client.query('BEGIN');

    // ВАЖНО: Обходим RLS чтобы проверить, существует ли пользователь с таким email
    await client.query("SET LOCAL row_security TO off");
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован. Войдите в аккаунт.' });
    }

    // 1. Создаем нового арендатора (tenant)
    const tenantResult = await client.query(
      'INSERT INTO tenants (name, status) VALUES ($1, \'active\') RETURNING id',
      [finalCompanyName]
    );
    const tenantId = tenantResult.rows[0].id;

    // 2. Создаем администратора арендатора (user) c ролью 'tenant_admin' c RLS контекстом
    // Для обхода RLS на запись мы отключаем проверку для этой транзакции, задав app.current_tenant_id
    await client.query('SELECT set_config(\'app.current_tenant_id\', $1, true)', [tenantId]);

    const userResult = await client.query(
      'INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1, $2, $3, \'tenant_admin\') RETURNING id, email, role, tenant_id',
      [tenantId, email, passwordHash]
    );
    const newUser = userResult.rows[0];

    // 3. Создаём пустую подписку (tier=trial, balance=0). Бесплатные минуты НЕ начисляем.
    // Чтобы создать комнату пользователю надо оформить тариф через /billing.
    // ВАЖНО: параметризованный INSERT — fallback handler рассчитывает на типизированные values.
    await client.query(
      `INSERT INTO subscriptions (tenant_id, tier, status, translation_minutes_balance)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, 'trial', 'inactive', 0]
    );

    // Завершаем транзакцию
    await client.query('COMMIT');
    client.release();

    const payload = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      tenantId: newUser.tenant_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
    console.log(`[Register Success]: Зарегистрирован новый арендатор ${finalCompanyName} для ${email}`);

    // Партнёрская атрибуция: если был ?Vibe= в URL или cookie — связываем юзера с партнёром.
    // Не блокирует ответ; ошибки логируются внутри.
    attributeRegistration(newUser.id, refCode, 'email').catch(() => {});

    // Best-effort Telegram-уведомление администратору. Не блокирует ответ.
    sendTelegramAdminMessage(
      `🆕 <b>Новая регистрация</b>\n` +
      `<b>Email:</b> ${escapeHtml(email)}\n` +
      `<b>Организация:</b> ${escapeHtml(finalCompanyName)}\n` +
      `<b>Баланс:</b> 0 минут (нужно оформить тариф)\n` +
      `<b>Tenant:</b> <code>${tenantId}</code>` +
      (refCode ? `\n<b>Реф-код:</b> <code>${escapeHtml(refCode)}</code>` : '')
    ).catch(() => {});

    return res.json({
      status: 'success',
      token,
      user: payload,
    });

  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }

    console.error('[Auth Register Error]:', error.message || error);
    return res.status(500).json({ error: 'Ошибка при регистрации. Попробуйте позже.' });
  }
});

/** Безопасное экранирование HTML в Telegram (теги <b>, <code> и <i> разрешены, остальное эскейпим). */
function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================================================
// Восстановление / смена пароля
// ============================================================================================

// Базовый адрес ФРОНТЕНДА (куда ведёт ссылка из письма). НЕ путать с PUBLIC_BASE_URL/
// APP_BASE_URL — те указывают на backend (ngrok-туннель к :3001). Письмо-сброс должно
// вести на SPA, которая постит /api/auth/reset-password.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/** Проверка, что строка — это UUID (реальный пользователь БД, а не хардкод-админ 'admin-1'). */
function isUuid(v: any): boolean {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Секрет подписи reset-токена, ПРИВЯЗАННЫЙ к текущему хэшу пароля пользователя.
 * Как только пароль меняется, hash меняется → старые ссылки сброса перестают
 * проходить verify(). Это даёт «одноразовость» без хранения токенов в БД.
 */
function resetTokenSecret(passwordHash: string | null | undefined): string {
  return `${JWT_SECRET}:pwreset:${passwordHash || 'nopw'}`;
}

/** Ищет пользователя по email в обход RLS (как делает /login). Возвращает row или null. */
async function findUserByEmailBypassRls(email: string): Promise<any | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL row_security TO off');
    const r = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    await client.query('COMMIT');
    return r.rows[0] || null;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Собирает SMTP-транспорт из переменных окружения. null — если SMTP не настроен. */
function createSmtpTransport() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpHost || !smtpUser || !smtpPass) return null;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // 465 → SSL/TLS (Hostinger); 587 → STARTTLS
    auth: { user: smtpUser, pass: smtpPass },
  });
}

/** Middleware: требует валидный JWT в заголовке Authorization. Кладёт payload в req.auth. */
function requireAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован', code: 'UNAUTHORIZED' });
  }
  try {
    (req as any).auth = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен', code: 'UNAUTHORIZED' });
  }
}

/** HTML-шаблон письма сброса (стиль VibeVox Midnight Emerald). */
function resetEmailHtml(resetUrl: string): string {
  return `
    <div style="background-color: #020617; color: #f8fafc; padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #10b981; border-radius: 12px;">
      <h2 style="color: #10b981; text-align: center; font-size: 24px; margin-bottom: 20px;">Восстановление пароля VibeVox</h2>
      <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Здравствуйте!</p>
      <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Вы получили это письмо, потому что запросили сброс пароля для вашей учётной записи в системе синхронного перевода <strong>VibeVox</strong>.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}"
           style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 12px 30px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
          Сбросить пароль
        </a>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.6;">Или скопируйте ссылку в браузер:<br/><span style="color:#10b981; word-break: break-all;">${resetUrl}</span></p>
      <p style="font-size: 14px; color: #64748b; line-height: 1.6;">Ссылка действует 1 час. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
      <hr style="border: 0; border-top: 1px solid #1e293b; margin: 30px 0;" />
      <p style="font-size: 12px; color: #64748b; text-align: center;">VibeVox Team &copy; 2026. Midnight Emerald Glass System</p>
    </div>
  `;
}

/**
 * Отправляет письмо со ссылкой сброса. Если SMTP не настроен — DEV-режим:
 * возвращает ссылку в поле debug.resetUrl. Всегда отвечает одинаковым genericOk
 * при успехе (anti-enumeration). Возвращает Response.
 */
async function deliverResetLink(res: Response, toEmail: string, resetUrl: string, genericOk: object) {
  const transporter = createSmtpTransport();
  if (!transporter) {
    console.warn('[SMTP Warning]: SMTP не настроен. DEV-ссылка для сброса:', resetUrl);
    return res.json({ ...genericOk, debug: { info: 'SMTP не настроен — ссылка выведена в консоль сервера', resetUrl } });
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"VibeVox" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'Восстановление пароля VibeVox',
      html: resetEmailHtml(resetUrl),
    });
    console.log(`[SMTP Success]: Письмо сброса отправлено на ${toEmail}`);
    return res.json(genericOk);
  } catch (error: any) {
    console.error('[SMTP Error]: Ошибка отправки письма через SMTP:', error?.message || error);
    return res.status(500).json({ error: 'Не удалось отправить письмо. Попробуйте позже.', code: 'MAIL_FAILED' });
  }
}

/**
 * POST /api/auth/forgot-password
 * Шлёт письмо со ссылкой сброса пароля через Hostinger SMTP.
 * Anti-enumeration: всегда отвечает 200 (не раскрываем, есть ли аккаунт);
 * письмо уходит ТОЛЬКО если пользователь реально существует.
 */
router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email обязателен', code: 'EMAIL_REQUIRED' });
  }
  const cleanEmail = String(email).trim();

  // Один и тот же ответ независимо от существования аккаунта.
  const genericOk = {
    status: 'success',
    message: 'Если аккаунт с таким email существует, мы отправили на него ссылку для сброса пароля.',
  };

  // Супер-админ: записи в БД нет — токен привязываем к материалу из файла/дефолта.
  if (isSuperAdminEmail(cleanEmail)) {
    const token = jwt.sign(
      { id: 'admin-1', email: SUPERADMIN_CANONICAL_EMAIL, purpose: 'pwreset', scope: 'superadmin' },
      resetTokenSecret(superAdminTokenMaterial()),
      { expiresIn: '1h' }
    );
    const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
    return deliverResetLink(res, cleanEmail, resetUrl, genericOk);
  }

  let user: any;
  try {
    user = await findUserByEmailBypassRls(cleanEmail);
  } catch (e: any) {
    console.error('[ForgotPassword] Ошибка БД:', e?.message || e);
    return res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже.', code: 'SERVER_ERROR' });
  }

  // Нет пользователя — тихо выходим (не раскрываем существование аккаунта).
  if (!user) {
    console.warn('[ForgotPassword] Сброс запрошен для несуществующего email:', cleanEmail);
    return res.json(genericOk);
  }

  // Одноразовый токен на 1 час, привязанный к текущему хэшу пароля.
  const token = jwt.sign(
    { id: user.id, email: user.email, purpose: 'pwreset' },
    resetTokenSecret(user.password_hash),
    { expiresIn: '1h' }
  );
  const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
  return deliverResetLink(res, user.email, resetUrl, genericOk);
});

/**
 * POST /api/auth/reset-password
 * Принимает { token, newPassword }, проверяет одноразовый токен из письма
 * и устанавливает новый пароль. Токен бьётся об текущий хэш → повторно не сработает.
 */
router.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Токен и новый пароль обязательны', code: 'FIELDS_REQUIRED' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Пароль должен быть минимум 8 символов', code: 'TOO_SHORT' });
  }

  // Достаём email из токена БЕЗ проверки подписи (секрет зависит от текущего пароля).
  let payload: any = null;
  try { payload = jwt.decode(token); } catch { payload = null; }
  if (!payload || payload.purpose !== 'pwreset' || !payload.email) {
    return res.status(400).json({ error: 'Ссылка недействительна или устарела.', code: 'INVALID_LINK' });
  }

  // Супер-админ: сбрасываем пароль в файле superadmin-auth.json, а не в БД.
  if (payload.scope === 'superadmin' || isSuperAdminEmail(payload.email)) {
    try {
      jwt.verify(token, resetTokenSecret(superAdminTokenMaterial()));
    } catch {
      return res.status(400).json({
        error: 'Ссылка недействительна или устарела. Запросите сброс пароля заново.',
        code: 'INVALID_LINK',
      });
    }
    saveSuperAdminHash(await bcrypt.hash(String(newPassword), 10));
    console.log('[ResetPassword] Пароль супер-админа обновлён через ссылку сброса');
    return res.json({ status: 'success', message: 'Пароль успешно обновлён. Войдите с новым паролем.' });
  }

  let user: any;
  try {
    user = await findUserByEmailBypassRls(String(payload.email).trim());
  } catch (e: any) {
    console.error('[ResetPassword] Ошибка БД:', e?.message || e);
    return res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже.', code: 'SERVER_ERROR' });
  }
  if (!user) {
    return res.status(400).json({ error: 'Ссылка недействительна или устарела.', code: 'INVALID_LINK' });
  }

  // Проверяем подпись секретом, привязанным к ТЕКУЩЕМУ хэшу (=> одноразовость + срок 1ч).
  try {
    jwt.verify(token, resetTokenSecret(user.password_hash));
  } catch {
    return res.status(400).json({
      error: 'Ссылка недействительна или устарела. Запросите сброс пароля заново.',
      code: 'INVALID_LINK',
    });
  }

  const client = await pool.connect();
  try {
    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await client.query('BEGIN');
    await client.query('SET LOCAL row_security TO off');
    await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, user.id]);
    await client.query('COMMIT');
    console.log(`[ResetPassword] Пароль обновлён для ${user.email}`);
    return res.json({ status: 'success', message: 'Пароль успешно обновлён. Войдите с новым паролем.' });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[ResetPassword] Ошибка обновления:', e?.message || e);
    return res.status(500).json({ error: 'Не удалось сбросить пароль. Попробуйте позже.', code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/auth/change-password  (требует авторизации)
 * Меняет пароль текущего пользователя: проверяет текущий пароль и ставит новый.
 * Хардкод-суперадмин и Google-аккаунты (без password_hash) обрабатываются явно.
 */
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const auth = (req as any).auth;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Текущий и новый пароль обязательны', code: 'FIELDS_REQUIRED' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Новый пароль должен быть минимум 8 символов', code: 'TOO_SHORT' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'Новый пароль совпадает со старым', code: 'SAME_AS_OLD' });
  }

  // Супер-админ ('admin-1', tenantId 'global_admin') не имеет строки в БД —
  // меняем его пароль в файле superadmin-auth.json (проверяем текущий по файлу/дефолту).
  if (auth.role === 'superadmin' || auth.tenantId === 'global_admin' || !isUuid(auth.id)) {
    if (!(await verifySuperAdminPassword(currentPassword))) {
      return res.status(400).json({ error: 'Неверный текущий пароль', code: 'WRONG_CURRENT' });
    }
    saveSuperAdminHash(await bcrypt.hash(String(newPassword), 10));
    console.log('[ChangePassword] Пароль супер-админа изменён');
    return res.json({ status: 'success', message: 'Пароль успешно изменён.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL row_security TO off');
    const result = await client.query('SELECT id, password_hash FROM users WHERE id = $1', [auth.id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Пользователь не найден', code: 'NOT_FOUND' });
    }
    const user = result.rows[0];

    // Google-аккаунт без пароля: текущего пароля нет — менять нечего.
    if (!user.password_hash) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Для этого аккаунта смена пароля недоступна (вход через Google).',
        code: 'NO_PASSWORD',
      });
    }

    // Проверяем текущий пароль (bcrypt-хэш или legacy-плейн).
    const isBcrypt = user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$');
    const match = isBcrypt
      ? await bcrypt.compare(currentPassword, user.password_hash)
      : user.password_hash === currentPassword;
    if (!match) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Неверный текущий пароль', code: 'WRONG_CURRENT' });
    }

    const newHash = await bcrypt.hash(String(newPassword), 10);
    await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, auth.id]);
    await client.query('COMMIT');
    console.log(`[ChangePassword] Пароль изменён для пользователя ${auth.email || auth.id}`);
    return res.json({ status: 'success', message: 'Пароль успешно изменён.' });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[ChangePassword] Ошибка:', e?.message || e);
    return res.status(500).json({ error: 'Не удалось изменить пароль. Попробуйте позже.', code: 'SERVER_ERROR' });
  } finally {
    client.release();
  }
});

// ============================================================================================
// Google OAuth серверные настройки
// ============================================================================================

/**
 * POST /api/auth/google-settings
 * Сохраняет Google Client ID и Client Secret на СЕРВЕРЕ.
 * Вызывается из AdminConfigPage при нажатии «Сохранить настройки».
 */
router.post('/google-settings', requireSuperAdmin, (req: Request, res: Response) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Client ID и Client Secret обязательны.' });
  }
  saveGoogleOAuthSettings({ clientId, clientSecret });
  return res.json({ status: 'success', message: 'Google OAuth настройки сохранены на сервере.' });
});

/**
 * GET /api/auth/google-settings
 * Возвращает ТОЛЬКО Client ID (без Secret — он серверный).
 * Используется фронтендом для отображения текущих настроек.
 */
router.get('/google-settings', (req: Request, res: Response) => {
  const settings = loadGoogleOAuthSettings();
  return res.json({
    clientId: settings.clientId,
    hasSecret: !!settings.clientSecret, // Показываем только флаг «есть ли секрет»
  });
});

/**
 * POST /api/auth/verify-google-oauth
 * Проверяет валидность Client ID и Client Secret, делая тестовый запрос к Google OAuth API.
 */
router.post('/verify-google-oauth', requireSuperAdmin, async (req: Request, res: Response) => {
  let { clientId, clientSecret } = req.body;

  // Если не передано в body, пробуем загрузить из сохраненных настроек
  if (!clientId || !clientSecret) {
    const saved = loadGoogleOAuthSettings();
    clientId = clientId || saved.clientId || getGoogleClientId();
    clientSecret = clientSecret || saved.clientSecret || getGoogleClientSecret();
  }

  if (clientId === '***' || clientId === '********************************') {
    clientId = getGoogleClientId() || loadGoogleOAuthSettings().clientId;
  }
  if (clientSecret === '***' || clientSecret === '********************************') {
    clientSecret = getGoogleClientSecret() || loadGoogleOAuthSettings().clientSecret;
  }

  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: 'Client ID и Client Secret обязательны.' });
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: 'test_dummy_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'http://localhost:3000',
        grant_type: 'authorization_code',
      }),
    });

    const text = await response.text();
    let isSecretValid = true;
    let errorDescription = '';

    try {
      const data = JSON.parse(text);
      if (data.error === 'invalid_client') {
        isSecretValid = false;
        errorDescription = data.error_description || 'The provided client secret is invalid.';
      }
    } catch {}

    if (isSecretValid) {
      return res.json({ status: 'success', message: 'Настройки Google OAuth верны! Google подтвердил валидность пары ключей.' });
    } else {
      return res.status(400).json({ error: `Проверка провалилась: ${errorDescription}` });
    }
  } catch (err: any) {
    return res.status(500).json({ error: `Ошибка связи с Google API: ${err.message}` });
  }
});

/**
 * GET /api/auth/callback/google
 * Перехватывает редирект от Google на localhost (через Vite прокси) 
 * и перенаправляет на фронтенд-роут колбэка.
 */
router.get('/callback/google', (req: Request, res: Response) => {
  const { code } = req.query;
  console.log('[Google OAuth Callback]: Получен код авторизации от Google');
  // Перенаправляем пользователя на фронтенд-страницу обработки
  res.redirect(`http://localhost:3000/auth/google/callback?code=${code}`);
});

/**
 * POST /api/auth/google-login
 * Обменивает code на токен, запрашивает профиль у Google
 * и авторизует или автоматически регистрирует пользователя в системе.
 */
router.post('/google-login', async (req: Request, res: Response) => {
  const { code, clientId, clientSecret, redirectUri, partnerCode } = req.body;
  // partnerCode (?Vibe=...) прокидывается фронтом — используется только при первой автозаписи в БД.
  const refCode: string | null = typeof partnerCode === 'string' ? partnerCode.trim() : null;

  if (!code || !redirectUri) {
    return res.status(400).json({ error: 'Необходимые параметры (code, redirectUri) отсутствуют.' });
  }

  // Приоритет источников Client Secret:
  // 1. Серверное хранилище (google-oauth.json)
  // 2. Тело запроса с фронтенда (localStorage)
  // 3. Переменная окружения
  const savedSettings = loadGoogleOAuthSettings();
  const finalClientId = savedSettings.clientId || clientId || process.env.GOOGLE_CLIENT_ID || '';
  const finalClientSecret = savedSettings.clientSecret || clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';

  // Если секрет пришёл с фронтенда, но не сохранён на сервере — сохраняем автоматически
  if (!savedSettings.clientSecret && clientSecret && clientId) {
    saveGoogleOAuthSettings({ clientId, clientSecret });
    console.log('[Google OAuth]: Автоматически сохранили настройки на сервер из запроса фронтенда.');
  }

  if (!finalClientSecret) {
    console.error('[Google OAuth]: Client Secret не найден ни на сервере, ни в запросе!');
    return res.status(500).json({ error: 'Google Client Secret не настроен. Сохраните настройки в панели администратора.' });
  }

  try {
    console.log('[Google OAuth Login]: Запрос обмена кода на токены...');
    // 1. Обмен кода на access_token в Google API
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: finalClientId,
        client_secret: finalClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('[Google OAuth Token Exchange Error]:', errText);
      let googleErrorMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        googleErrorMsg = errJson.error_description || errJson.error || errText;
      } catch {}
      throw new Error(`Ошибка Google OAuth при обмене кода: ${googleErrorMsg}`);
    }

    const tokenData = await tokenResponse.json() as any;
    const accessToken = tokenData.access_token;

    // 2. Получение данных профиля пользователя из Google
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      const errText = await profileResponse.text();
      console.error('[Google OAuth UserInfo Error]:', errText);
      throw new Error(`Ошибка Google API при получении профиля: ${errText}`);
    }

    const profile = await profileResponse.json() as any;
    const email = profile.email;
    const name = profile.name || email.split('@')[0];
    const googleId = profile.sub;

    if (!email) {
      throw new Error('Google не предоставил email пользователя.');
    }

    console.log(`[Google OAuth Profile]: Пользователь ${name} (${email}), Google ID: ${googleId}`);

    // Проверяем хардкод суперадмина
    const isSuperAdminEmail = email === 'live7610482@gmail.com' || email === 'life7610482@gmail.com';
    if (isSuperAdminEmail) {
      const payload = {
        id: 'admin-1',
        email: 'live7610482@gmail.com',
        role: 'superadmin',
        tenantId: 'global_admin',
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
      return res.json({
        status: 'success',
        token,
        user: payload,
        type: 'login'
      });
    }

    // Блокировка: удалённый администратором аккаунт не может войти/зарегистрироваться
    // заново через Google (иначе авто-регистрация ниже создаст новый пустой аккаунт).
    if (await isAccountBlocked(email)) {
      return res.status(403).json({ error: 'Этот аккаунт был удалён администратором. Вход и повторная регистрация недоступны.' });
    }

    // 3. Авторизация / Регистрация в БД
    let userPayload: any = null;
    let authType = 'login';

    let dbClient;
    try {
      dbClient = await pool.connect();
      
      // ВАЖНО: SET LOCAL работает ТОЛЬКО внутри транзакции.
      // Обходим RLS для поиска пользователя по email.
      // Без этого RLS-политика фильтрует ВСЕ записи, т.к. app.current_tenant_id не задан,
      // и пользователь никогда не находится → при каждом входе создаётся дубликат.
      await dbClient.query('BEGIN');
      await dbClient.query("SET LOCAL row_security TO off");

      // Ищем существующего пользователя (теперь RLS не мешает)
      const userCheck = await dbClient.query('SELECT * FROM users WHERE email = $1', [email]);
      
      if (userCheck.rows.length > 0) {
        // Пользователь существует -> Логин!
        const existingUser = userCheck.rows[0];
        
        // Привязываем google_id, если он не был привязан ранее
        if (!existingUser.google_id) {
          await dbClient.query('UPDATE users SET google_id = $1, updated_at = NOW() WHERE id = $2', [googleId, existingUser.id]);
        }

        userPayload = {
          id: existingUser.id,
          email: existingUser.email,
          role: existingUser.role || 'user',
          tenantId: existingUser.tenant_id,
          name: name, // Передаем имя из профиля Google
        };
        authType = 'login';
        await dbClient.query('COMMIT');
        dbClient.release();
        dbClient = null;
      } else {
        // Пользователя нет -> Автоматическая регистрация!
        authType = 'register';
        // Транзакция уже открыта (BEGIN выше) — продолжаем в ней

        // Создаем арендатора
        const companyName = `Компания ${name} (Google)`;
        const tenantResult = await dbClient.query(
          'INSERT INTO tenants (name, status) VALUES ($1, \'active\') RETURNING id',
          [companyName]
        );
        const tenantId = tenantResult.rows[0].id;

        // Устанавливаем tenant_id для RLS-контекста записи
        await dbClient.query('SELECT set_config(\'app.current_tenant_id\', $1, true)', [tenantId]);
        const userResult = await dbClient.query(
          'INSERT INTO users (tenant_id, email, google_id, role) VALUES ($1, $2, $3, \'tenant_admin\') RETURNING id, email, role, tenant_id',
          [tenantId, email, googleId]
        );
        const newUser = userResult.rows[0];

        // Пустая подписка: бесплатные минуты НЕ даём, для комнат нужно оформить тариф.
        await dbClient.query(
          `INSERT INTO subscriptions (tenant_id, tier, status, translation_minutes_balance)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id) DO NOTHING`,
          [tenantId, 'trial', 'inactive', 0]
        );

        await dbClient.query('COMMIT');
        dbClient.release();
        dbClient = null;

        userPayload = {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          tenantId: newUser.tenant_id,
          name: name, // Передаем имя из профиля Google
        };

        // Best-effort Telegram-уведомление администратору. Не блокирует ответ.
        // Зеркалит уведомление из /register (email-флоу), плюс пометка способа.
        sendTelegramAdminMessage(
          `🆕 <b>Новая регистрация</b>\n` +
          `<b>Email:</b> ${escapeHtml(email)}\n` +
          `<b>Имя:</b> ${escapeHtml(name)}\n` +
          `<b>Организация:</b> ${escapeHtml(companyName)}\n` +
          `<b>Способ:</b> Google OAuth\n` +
          `<b>Баланс:</b> 0 минут (нужно оформить тариф)\n` +
          `<b>Tenant:</b> <code>${tenantId}</code>` +
          (refCode ? `\n<b>Реф-код:</b> <code>${escapeHtml(refCode)}</code>` : '')
        ).catch(() => {});
      }
    } catch (dbErr: any) {
      if (dbClient) {
        await dbClient.query('ROLLBACK').catch(() => {});
        dbClient.release();
      }
      console.error('[Google OAuth DB Error]:', dbErr.message);
      return res.status(500).json({ error: 'Ошибка базы данных при авторизации через Google. Попробуйте позже.' });
    }

    // Партнёрская атрибуция: только при реальной регистрации (не при login существующего).
    // Это не блокирует ответ; ошибки логируются внутри хелпера.
    if (authType === 'register' && userPayload?.id) {
      attributeRegistration(userPayload.id, refCode, 'google').catch(() => {});
    }

    // Генерируем JWT токен
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      status: 'success',
      token,
      user: userPayload,
      type: authType,
    });

  } catch (error: any) {
    // Полные детали — только в server-логи: тексты Google API могут содержать
    // redirect_uri_mismatch, токены, scope-listы и т.п.
    console.error('[Google OAuth Login Error]:', error?.message || error);
    return res.status(401).json({
      error: 'Ошибка во время авторизации через Google'
    });
  }
});


// ============================================================================================
// Системные настройки API (Dynamic Config Manager)
// ============================================================================================

/**
 * GET /api/auth/system-settings
 * Возвращает текущую конфигурацию для панели администратора.
 * Секретные поля маскированы символами "***".
 */
router.get('/system-settings', requireSuperAdmin, (req: Request, res: Response) => {
  try {
    const settings = getSettingsForClient();
    return res.json(settings);
  } catch (err: any) {
    console.error('[SystemSettings] Ошибка чтения конфигурации:', err);
    return res.status(500).json({ error: 'Ошибка чтения системной конфигурации' });
  }
});

/**
 * POST /api/auth/system-settings
 * Сохраняет системные настройки из панели администратора.
 */
router.post('/system-settings', requireSuperAdmin, (req: Request, res: Response) => {
  try {
    saveSettings(req.body);
    return res.json({ status: 'success', message: 'Системные настройки успешно сохранены.' });
  } catch (err: any) {
    console.error('[SystemSettings] Ошибка сохранения конфигурации:', err);
    return res.status(500).json({ error: 'Ошибка сохранения конфигурации' });
  }
});

// ============================================================================================
// Произвольные коды сайта (cookie-consent / аналитика / пиксели)
// ============================================================================================

/**
 * Middleware: требует валидный JWT СУПЕР-АДМИНА (role === 'superadmin').
 * Чтение кодов публично (их и так видно в HTML), а вот запись — это вектор
 * stored-XSS на весь сайт, поэтому она закрыта ролью суперадмина.
 */
function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    if (decoded?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Доступ только для суперадмина' });
    }
    (req as any).auth = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

/**
 * GET /api/auth/site-scripts — ПУБЛИЧНЫЙ.
 * Отдаёт произвольные коды суперадмина (head/body) для инжектора на фронте:
 * cookie-consent, Google Analytics, Meta Pixel и т.п. Возвращает ТОЛЬКО эти
 * два поля (не весь системный конфиг).
 */
router.get('/site-scripts', (_req: Request, res: Response) => {
  try {
    return res.json(getSiteScripts());
  } catch (err: any) {
    console.error('[SiteScripts] Ошибка чтения:', err);
    // Фейлим мягко: отсутствие кодов не должно ломать загрузку сайта.
    return res.json({ headCode: '', bodyCode: '' });
  }
});

/**
 * POST /api/auth/site-scripts — ТОЛЬКО СУПЕРАДМИН.
 * Сохраняет произвольный код head/body. Пустая строка очищает поле.
 */
router.post('/site-scripts', requireSuperAdmin, (req: Request, res: Response) => {
  try {
    const { headCode, bodyCode } = req.body || {};
    if ((headCode != null && typeof headCode !== 'string') || (bodyCode != null && typeof bodyCode !== 'string')) {
      return res.status(400).json({ error: 'headCode/bodyCode должны быть строками' });
    }
    saveSiteScripts(typeof headCode === 'string' ? headCode : '', typeof bodyCode === 'string' ? bodyCode : '');
    return res.json({ status: 'success', ...getSiteScripts() });
  } catch (err: any) {
    console.error('[SiteScripts] Ошибка сохранения:', err);
    return res.status(500).json({ error: 'Ошибка сохранения кодов' });
  }
});

/**
 * POST /api/auth/verify-livekit
 * Проверяет подключение к LiveKit WebRTC серверу.
 * Создаёт RoomServiceClient и вызывает listRooms() для валидации ключей.
 */
router.post('/verify-livekit', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    let { url, key, secret } = req.body;
    url = url || getLiveKitUrl();
    if (!key || key === '***' || key === '********************************') key = getLiveKitKey();
    if (!secret || secret === '***' || secret === '********************************') secret = getLiveKitSecret();

    if (!key || !secret) {
      return res.status(400).json({ error: 'LiveKit API Key и API Secret не настроены.' });
    }

    // Преобразуем ws:// → http:// для RoomServiceClient (Twirp RPC)
    const httpUrl = url.replace(/^ws/, 'http');
    const roomService = new RoomServiceClient(httpUrl, key, secret);
    const rooms = await roomService.listRooms();

    return res.json({
      status: 'success',
      message: `Подключение успешно! WebRTC-сервер LiveKit отвечает корректно. Активных комнат: ${rooms.length}.`,
      activeRooms: rooms.length,
    });
  } catch (err: any) {
    console.error('[Verify LiveKit] Ошибка:', err);
    return res.status(502).json({
      error: `Ошибка подключения к LiveKit: ${err.message || String(err)}`,
    });
  }
});

/**
 * POST /api/auth/verify-telegram
 * Проверяет валидность токена Telegram-бота через getMe API.
 */
router.post('/verify-telegram', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    let { token } = req.body;
    if (!token || token === '***' || token === '********************************') token = getTelegramToken();

    if (!token) {
      return res.status(400).json({ error: 'Telegram Bot Token не настроен.' });
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json() as any;

    if (!data.ok) {
      return res.status(401).json({
        error: `Telegram API отклонил токен: ${data.description || 'Unknown error'}`,
      });
    }

    return res.json({
      status: 'success',
      message: `Успешно! Telegram-бот @${data.result.username} авторизован и готов к работе.`,
      botUsername: data.result.username,
      botId: data.result.id,
    });
  } catch (err: any) {
    console.error('[Verify Telegram] Ошибка:', err);
    return res.status(502).json({
      error: `Ошибка подключения к Telegram API: ${err.message || String(err)}`,
    });
  }
});

/**
 * POST /api/auth/verify-google
 * Проверяет валидность API-ключа Google Gemini через тестовый вызов generateContent.
 */
router.post('/verify-google', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    let { apiKey } = req.body;
    if (!apiKey || apiKey === '***' || apiKey === '********************************') apiKey = getGeminiApiKey();

    if (!apiKey) {
      return res.status(400).json({ error: 'Google Gemini API Key не настроен.' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    // Проверка ключа быстрым стабильным generateContent. НЕ берём 3.5-flash —
    // это «думающая» preview-модель, на тривиальный «Hello» она зависает/рвёт
    // соединение (HTTP 000) → ложный «невалидный токен». gemini-2.5-flash
    // отвечает мгновенно и подтверждает валидность ключа (рантайм-перевод
    // использует свою Live-модель из настроек, эта проба её не трогает).
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello',
    });

    const responseText = result.text ?? '';

    return res.json({
      status: 'success',
      message: 'Успешно! API-ключ Google Gemini подтверждён. Модель gemini-2.5-flash доступна.',
      probe: responseText.substring(0, 100),
    });
  } catch (err: any) {
    console.error('[Verify Google] Ошибка:', err);
    const msg = err.message || String(err);
    const isInvalidKey = msg.includes('API_KEY_INVALID') || msg.includes('INVALID_ARGUMENT');
    return res.status(isInvalidKey ? 401 : 502).json({
      error: `Ошибка проверки Google Gemini API: ${msg}`,
    });
  }
});

/**
 * POST /api/auth/verify-chatwoot
 * Проверяет подключение к Chatwoot CRM через запрос к профилю агента.
 */
router.post('/verify-chatwoot', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    let { url, token } = req.body;
    url = url || getChatwootUrl();
    if (!token || token === '***' || token === '********************************') token = getChatwootToken();

    if (!url || !token) {
      return res.status(400).json({ error: 'Chatwoot URL и Token не настроены.' });
    }

    const response = await fetch(`${url}/api/v1/profile`, {
      headers: { api_access_token: token },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: `Chatwoot отклонил запрос (HTTP ${response.status}): ${text.substring(0, 200)}`,
      });
    }

    const profile = await response.json() as any;
    return res.json({
      status: 'success',
      message: `Успешно! Соединение с CRM установлено. Агент: ${profile.name || profile.email || 'Unknown'}.`,
      agentName: profile.name || profile.email,
    });
  } catch (err: any) {
    console.error('[Verify Chatwoot] Ошибка:', err);
    return res.status(502).json({
      error: `Ошибка подключения к Chatwoot: ${err.message || String(err)}`,
    });
  }
});

/**
 * POST /api/auth/verify-stripe
 * Проверяет валидность Stripe Secret Key через stripe.balance.retrieve()
 */
router.post('/verify-stripe', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    let { secretKey } = req.body;
    if (!secretKey || secretKey === '***' || secretKey === '********************************') {
      secretKey = getStripeSecretKey();
    }
    if (!secretKey) {
      return res.status(400).json({ error: 'Stripe Secret Key не настроен.' });
    }
    if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
      return res.status(400).json({ error: 'Stripe Secret Key должен начинаться с sk_test_ или sk_live_' });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' as any });
    const balance = await stripe.balance.retrieve();
    const mode = secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE';
    const currencies = balance.available.map(b => b.currency.toUpperCase()).join(', ') || 'нет данных';

    return res.json({
      status: 'success',
      message: `Stripe подключён в режиме ${mode}. Валюты счёта: ${currencies}.`,
      mode,
      currencies,
    });
  } catch (err: any) {
    console.error('[Verify Stripe] Ошибка:', err);
    const msg = err.message || String(err);
    const isInvalidKey = msg.includes('Invalid API Key') || msg.includes('No such');
    return res.status(isInvalidKey ? 401 : 502).json({
      error: `Ошибка подключения к Stripe: ${msg}`,
    });
  }
});

/**
 * POST /api/auth/verify-tikhub
 * РЕАЛЬНО проверяет ПЛАТФОРМЕННЫЙ ключ TikHub через GET get_user_info.
 * Принимает { apiKey } из тела — проверяет именно его (можно до сохранения);
 * если поле пустое/маска — берёт сохранённый платформенный ключ.
 */
router.post('/verify-tikhub', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    let { apiKey } = req.body || {};
    if (!apiKey || apiKey === '***' || apiKey === '********************************') {
      apiKey = getTikHubApiKey();
    }
    if (!apiKey) {
      return res.status(400).json({ error: 'Ключ TikHub не настроен.' });
    }
    const result = await validateTikHubKey(String(apiKey).trim());
    if (result.ok) {
      return res.json({ status: 'success', message: result.message, balance: result.balance, email: result.email });
    }
    // Невалидный ключ → 401; нехватка баланса/лимит → 402; иначе 502.
    const httpCode = result.status === 'invalid' ? 401 : result.status === 'quota_exceeded' ? 402 : 502;
    return res.status(httpCode).json({ error: result.message });
  } catch (err: any) {
    console.error('[Verify TikHub] Ошибка:', err);
    return res.status(502).json({ error: `Ошибка подключения к TikHub: ${err?.message || String(err)}` });
  }
});

/**
 * POST /api/auth/send-to-playground
 * Принимает фразу из субтитров звонка для разбора на полигоне диалектов.
 */
router.post('/send-to-playground', async (req: Request, res: Response) => {
  try {
    const { subtitleText, languageCode, audioBase64 } = req.body;

    if (!subtitleText) {
      return res.status(400).json({ error: 'subtitleText обязателен' });
    }

    // Если есть аудио — сохраняем на диск
    let audioFilename = '';
    if (audioBase64) {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename_local = fileURLToPath(import.meta.url);
      const __dirname_local = path.dirname(__filename_local);
      const uploadsDir = path.resolve(__dirname_local, '../../../../uploads/dialects/audio');
      fs.mkdirSync(uploadsDir, { recursive: true });
      audioFilename = `playground-${Date.now()}.wav`;
      const buffer = Buffer.from(audioBase64, 'base64');
      fs.writeFileSync(path.join(uploadsDir, audioFilename), buffer);
    }

    // Пишем в БД как черновик (без привязки к правилу)
    try {
      await pool.query(
        `INSERT INTO dialect_audio_samples (dialect_rule_id, audio_filename, expected_transcript)
         VALUES (NULL, $1, $2)`,
        [audioFilename || `text-${Date.now()}`, subtitleText]
      );
    } catch (dbErr) {
      console.warn('[Playground] БД недоступна при сохранении черновика:', dbErr);
    }

    return res.json({
      status: 'success',
      message: 'Фраза отправлена на полигон обучения ИИ!',
      languageCode,
    });
  } catch (err: any) {
    console.error('[Playground] Ошибка POST /send-to-playground:', err);
    return res.status(500).json({ error: 'Ошибка отправки на полигон' });
  }
});

export default router;
