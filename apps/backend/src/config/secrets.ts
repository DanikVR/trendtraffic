/**
 * Централизованные секреты приложения (Блок 1 — фиксы аудита C3/C5).
 *
 * Зачем: раньше `process.env.JWT_SECRET || 'vibevox_secret_key_2026'` был
 * продублирован в 15 файлах. Это (а) хардкод публично-известного секрета в git,
 * (б) при незаданном JWT_SECRET в проде сервис молча подписывал токены этой
 * известной строкой → любой мог подделать токен суперадмина.
 *
 * Теперь:
 *  - единый источник JWT_SECRET;
 *  - в production секрет ОБЯЗАН быть в env (иначе fail-fast на старте — лучше
 *    явная ошибка, чем тихая небезопасность);
 *  - в dev (NODE_ENV != production) допускается фолбэк для удобства локалки
 *    (то же значение, что и раньше — чтобы локальные сессии не инвалидировались).
 */

const isProd = process.env.NODE_ENV === 'production';

function getSecret(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v && v.trim()) return v;
  if (isProd) {
    throw new Error(
      `[FATAL] Переменная окружения ${name} не задана — обязательна в production. ` +
      `Сгенерируйте ключ: openssl rand -hex 32 и пропишите ${name} в apps/backend/.env`,
    );
  }
  console.warn(`[secrets] ${name} не задан — DEV-фолбэк (НЕБЕЗОПАСНО, только для локальной разработки).`);
  return devFallback;
}

/** Единый секрет подписи JWT. Dev-фолбэк намеренно прежний (локальные сессии живы). */
export const JWT_SECRET = getSecret('JWT_SECRET', 'vibevox_secret_key_2026');

// В production требуем и ключ шифрования секретов tenant'ов (AES-256-GCM для
// SIP/Gemini/Chatwoot). Сам crypto-модуль тоже бросает при использовании без ключа —
// здесь это ранний, понятный fail прямо на старте.
if (isProd && !process.env.SIP_ENCRYPTION_KEY?.trim()) {
  throw new Error(
    '[FATAL] SIP_ENCRYPTION_KEY не задан — обязателен в production ' +
    '(шифрование SIP/Gemini/Chatwoot секретов). Сгенерируйте: openssl rand -hex 32',
  );
}
