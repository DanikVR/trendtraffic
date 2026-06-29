/**
 * Планировщик авто-обновления отслеживаемых каналов (Фаза 2).
 *
 * Тик раз в час; внутри берёт каналы с enabled=true, не обновлявшиеся > 20ч (т.е.
 * фактически раз в сутки на канал), и пере-собирает их (новый снимок + дельты).
 * Паттерн — как startRolloverScheduler/startCrmTaskScheduler (нативный setInterval,
 * без внешних очередей). Стоимость щадим: пауза между каналами + потолок за тик.
 */

import { refreshDueChannels } from './watchlist.js';

let started = false;
let ticking = false;

export function startChannelSnapshotScheduler(): void {
  if (started) return;
  started = true;
  const TICK_MS = 60 * 60 * 1000;   // ежечасный тик; per-channel выходит раз в сутки (порог 20ч)
  const run = async () => {
    if (ticking) return;            // не наезжаем на ещё не завершившийся проход
    ticking = true;
    try { await refreshDueChannels(); }
    catch (err) { console.warn('[channels-scheduler] tick error:', (err as any)?.message || err); }
    finally { ticking = false; }
  };
  setTimeout(run, 90 * 1000);       // первый прогон через 90с после старта (дать серверу подняться)
  setInterval(run, TICK_MS);
  console.log('[channels-scheduler] запущен (тик/час, обновление канала раз в сутки)');
}
