/**
 * Чёрный список удалённых аккаунтов.
 *
 * Когда суперадмин удаляет пользователя (admin/users.ts), его email и google_id
 * попадают сюда. Иначе человек заходит заново через Google — и тот авто-создаёт
 * новый пустой аккаунт (см. /google-login), и удаление выглядит «не сработавшим».
 *
 * Проверка вызывается в /login, /register, /google-login. Разблокировка —
 * удаление строки (admin/users.ts: DELETE /api/admin/users/blocklist).
 *
 * Хранилище: таблица account_blocklist (PG) ИЛИ fallbackData.account_blocklist
 * (db_fallback.json) — обработчики обеих форм есть в db/index.ts.
 */

import pool from '../../db/index.js';

/** Хардкод-суперадмины (auth/router.ts) — их НИКОГДА не блокируем. */
const HARDCODED_SUPERADMIN_EMAILS = new Set([
  'live7610482@gmail.com',
  'life7610482@gmail.com',
]);

export function isHardcodedSuperadmin(email: string | null | undefined): boolean {
  return !!email && HARDCODED_SUPERADMIN_EMAILS.has(email.trim().toLowerCase());
}

function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

/**
 * true, если email в чёрном списке. Хардкод-суперадмины — всегда false.
 * fail-open: при ошибке чтения возвращаем false (не запираем всех из-за сбоя БД).
 */
export async function isAccountBlocked(email: string | null | undefined): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e || isHardcodedSuperadmin(e)) return false;
  try {
    const r = await pool.query('SELECT email FROM account_blocklist WHERE email = $1', [e]);
    return (r.rows as any[]).length > 0;
  } catch (err) {
    console.warn('[account_blocklist] проверка не удалась (fail-open):', (err as Error).message);
    return false;
  }
}

/**
 * Добавляет email (+ google_id) в чёрный список. Идемпотентно (upsert).
 * Хардкод-суперадминов игнорирует — их случайно не заблокируем.
 */
export async function blockAccount(
  email: string | null | undefined,
  googleId: string | null | undefined,
  blockedBy: string | null | undefined,
  reason: string | null | undefined
): Promise<void> {
  const e = normalizeEmail(email);
  if (!e || isHardcodedSuperadmin(e)) return;
  await pool.query(
    `INSERT INTO account_blocklist (email, google_id, reason, blocked_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET google_id = EXCLUDED.google_id,
           reason = EXCLUDED.reason,
           blocked_by = EXCLUDED.blocked_by,
           blocked_at = CURRENT_TIMESTAMP`,
    [e, googleId || null, reason || null, blockedBy || null]
  );
}

/** Снимает блокировку с email. Возвращает true, если строка была удалена. */
export async function unblockAccount(email: string | null | undefined): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e) return false;
  const r = await pool.query('DELETE FROM account_blocklist WHERE email = $1', [e]);
  return Number((r as any).rowCount || 0) > 0;
}

/** Список заблокированных аккаунтов (для суперадмин-UI / разблокировки). */
export async function listBlockedAccounts(): Promise<Array<{
  email: string;
  googleId: string | null;
  reason: string | null;
  blockedBy: string | null;
  blockedAt: string | null;
}>> {
  try {
    const r = await pool.query(
      'SELECT email, google_id, reason, blocked_by, blocked_at FROM account_blocklist',
      []
    );
    return (r.rows as any[]).map((row) => ({
      email: row.email,
      googleId: row.google_id || null,
      reason: row.reason || null,
      blockedBy: row.blocked_by || null,
      blockedAt: row.blocked_at ? new Date(row.blocked_at).toISOString() : null,
    }));
  } catch (err) {
    console.warn('[account_blocklist] список не удалось прочитать:', (err as Error).message);
    return [];
  }
}
