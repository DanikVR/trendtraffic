/**
 * Rate limiting (Блок 3 — фикс аудита H2).
 *
 * Защита auth-эндпоинтов от брутфорса/спама. ВАЖНО: за nginx нужен
 * `app.set('trust proxy', 1)` в server.ts — иначе все клиенты видятся под одним
 * IP (адрес nginx) и делят общий лимит (зарейтлимитит всех разом).
 *
 * Лимиты намеренно мягкие, чтобы не мешать легитимным пользователям.
 */

import rateLimit from 'express-rate-limit';

// Логин: считаем ТОЛЬКО неуспешные попытки (skipSuccessfulRequests). Брутфорс —
// это поток 401, он упрётся в лимит; а успешные входы счётчик не тратят.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много неудачных попыток входа. Повторите через 15 минут.' },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много регистраций с этого адреса. Повторите позже.' },
});

// Один лимитер на forgot + reset password (защита от спама SMTP и перебора токенов).
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов сброса пароля. Повторите позже.' },
});
