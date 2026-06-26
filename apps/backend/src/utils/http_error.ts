/**
 * HTTP-error helpers.
 *
 * Зачем: до этого по всему backend'у было `res.status(500).json({ error: err?.message || String(err) })`.
 * Это утекает в API: stack traces, тексты ошибок Postgres (со SCHEMA, именами таблиц/колонок),
 * пути файлов, иногда — содержимое запросов. Information disclosure.
 *
 * Правило:
 *  - 5xx ошибки → клиенту generic `"Internal server error"` (или localized public message),
 *    полные детали — только в server-логи.
 *  - 4xx ошибки с осмысленным message (валидация, payment, quota) — можно оставлять как есть.
 */

import type { Response } from 'express';

/**
 * Generic error response.
 * @param res         Express Response
 * @param status      HTTP status (обычно 500)
 * @param publicMsg   То, что увидит клиент — без внутренних деталей
 * @param err         Полная ошибка для server-логов (необязательно)
 * @param ctx         Префикс лога (имя модуля/роута)
 */
function sendError(
  res: Response,
  status: number,
  publicMsg: string,
  err?: unknown,
  ctx?: string,
): Response {
  if (err !== undefined) {
    console.error(`[${ctx ?? 'API'}] ${publicMsg}:`, err);
  }
  return res.status(status).json({ error: publicMsg });
}

/** Самый частый кейс — 500 Internal Server Error. */
export function send500(res: Response, err: unknown, ctx?: string): Response {
  return sendError(res, 500, 'Internal server error', err, ctx);
}
