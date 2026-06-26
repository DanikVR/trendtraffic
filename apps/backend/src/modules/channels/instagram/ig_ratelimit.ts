/**
 * Instagram анти-бан: лимитер отправок на аккаунт (правило Meta 2026).
 *
 *  • ≤200 автоматических сообщений в ЧАС на аккаунт (скользящее окно). Сверх — skip.
 *  • Минимальный интервал между отправками ~350 мс (≈3/сек) — очередь через nextAt.
 *
 * In-memory (на процесс). Для горизонтального масштабирования позже — Redis.
 * Сбрасывается при рестарте (приемлемо: окно — час, риск кратковременный).
 */

const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 200;
const MIN_GAP_MS = 350; // ≈ 3 сообщения/сек на аккаунт

interface Bucket { times: number[]; nextAt: number }
const buckets = new Map<string, Bucket>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Пропускает отправку с соблюдением интервала; false — если превышен часовой лимит
 * (вызывающий должен пропустить отправку, не падая). При успехе может «подождать»
 * свой слот (до ~секунд при всплеске), чтобы держать ≤3/сек.
 */
export async function igRateGate(igId: string): Promise<boolean> {
  const key = String(igId);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) { b = { times: [], nextAt: 0 }; buckets.set(key, b); }

  // Часовой лимит (скользящее окно).
  b.times = b.times.filter((t) => now - t < HOUR_MS);
  if (b.times.length >= MAX_PER_HOUR) return false;

  // Очередь: каждый следующий слот — не раньше nextAt.
  const slot = Math.max(now, b.nextAt);
  b.nextAt = slot + MIN_GAP_MS;
  b.times.push(slot);
  const wait = slot - now;
  if (wait > 0) await sleep(Math.min(wait, 60_000)); // кап ожидания 60с (защита от зависания)
  return true;
}
