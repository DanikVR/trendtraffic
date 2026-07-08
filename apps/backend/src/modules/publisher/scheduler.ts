/**
 * Планировщик Публикатора (Ф4/Ф5). Паттерн — как channels/scheduler.ts:
 * нативный setInterval, без внешних очередей; guard от наезда тиков.
 *
 * Каждый тик (60с):
 *  1) авто-цепочки: свежие НЕопубликованные ролики автопилота (auto-ugc) → подпись
 *     Пост-движком (фолбэк без ИИ) → ближайший свободный слот «Моего расписания»
 *     (dailyCap; автопауза цепочки после 3 фейлов подряд);
 *  2) авторетраи упавших сабмитов (бэкофф 2→4→8 мин, до 3 попыток, ≤5 строк/тик).
 * Каждый 5-й тик:
 *  3) фоновый статус-синк «в полёте» по тенантам — статусы обновляются, даже когда
 *     лента Публикатора ни у кого не открыта.
 */

import { tickAutoChains, tickRetries, tickStatusSync } from './service.js';

let started = false;
let ticking = false;
let tickNo = 0;

export function startPublisherScheduler(): void {
  if (started) return;
  started = true;
  const TICK_MS = 60_000;
  const run = async () => {
    if (ticking) return;
    ticking = true;
    tickNo++;
    try {
      await tickAutoChains();
      await tickRetries();
      if (tickNo % 5 === 0) await tickStatusSync();
    } catch (err) {
      console.warn('[publisher-scheduler] tick error:', (err as any)?.message || err);
    } finally {
      ticking = false;
    }
  };
  setTimeout(run, 75 * 1000); // первый прогон — дать серверу подняться
  setInterval(run, TICK_MS);
  console.log('[publisher-scheduler] запущен (тик/мин: авто-цепочки, ретраи; синк статусов каждые 5 мин)');
}
