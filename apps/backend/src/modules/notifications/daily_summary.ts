/**
 * Daily Summary Scheduler — отправляет утреннюю сводку в Telegram админам в 09:00 Europe/Warsaw.
 *
 * Реализация без зависимостей от tzdata-пакета: используем `Intl.DateTimeFormat` для расчёта
 * текущего часа/минуты в нужной зоне (DST учитывается автоматически).
 *
 * Чекаем раз в минуту. В момент когда часы:минуты совпадают с 09:00 — собираем сводку и шлём.
 * Защита от двойной отправки: храним последнюю отправленную дату (YYYY-MM-DD в зоне Warsaw).
 */

import pool from '../../db/index.js';
import { sendTelegramAdminMessage } from './telegram.js';

const TARGET_TZ = 'Europe/Warsaw';
const TARGET_HOUR = 9;
const TARGET_MINUTE = 0;
const CHECK_INTERVAL_MS = 60_000; // раз в минуту

let lastSentYmd: string | null = null;
let timer: NodeJS.Timeout | null = null;

/** "2026-05-27", "09", "00" в Europe/Warsaw. */
function nowInWarsaw(): { ymd: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TARGET_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  return {
    ymd: `${map.year}-${map.month}-${map.day}`,
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
  };
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Собирает данные за последние 24 часа: новые регистрации, активные оплаты, последние докупки. */
async function buildSummary(): Promise<string> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Все пользователи + подписки — fallback handler уже умеет.
  const all = await pool.query(
    `SELECT u.id AS user_id, u.email AS email, u.created_at AS user_created_at,
            t.id AS tenant_id, t.name AS tenant_name,
            s.tier AS tier, s.status AS sub_status,
            s.translation_minutes_balance AS translation_minutes_balance,
            s.rollover_seconds AS rollover_seconds,
            s.total_paid_minutes AS total_paid_minutes,
            s.last_payment_minutes AS last_payment_minutes,
            s.last_payment_at AS last_payment_at
     FROM users u
     LEFT JOIN tenants t       ON t.id = u.tenant_id
     LEFT JOIN subscriptions s ON s.tenant_id = u.tenant_id`,
    []
  );
  const rows = all.rows as any[];

  const newUsers = rows.filter(r => r.user_created_at && new Date(r.user_created_at) >= since);
  const recentPaid = rows.filter(r => r.last_payment_at && new Date(r.last_payment_at) >= since);
  const totalUsers = rows.length;
  const totalPaid = rows.filter(r => Number(r.total_paid_minutes || 0) > 0).length;

  // Топ-5 активных по балансу — для наглядности «у кого есть минуты»
  const topByBalance = [...rows]
    .map(r => ({
      email: r.email || '—',
      tier: r.tier || 'trial',
      minutesLeft: Math.floor(((Number(r.translation_minutes_balance) || 0) + (Number(r.rollover_seconds) || 0)) / 60),
    }))
    .filter(r => r.minutesLeft > 0)
    .sort((a, b) => b.minutesLeft - a.minutesLeft)
    .slice(0, 5);

  const lines: string[] = [];
  lines.push(`🌅 <b>Сводка VibeVox за сутки</b>`);
  lines.push(``);
  lines.push(`<b>Зарегистрировались (24ч):</b> ${newUsers.length}`);
  if (newUsers.length > 0) {
    for (const u of newUsers.slice(0, 10)) {
      lines.push(`  • ${escapeHtml(u.email || '—')}`);
    }
    if (newUsers.length > 10) lines.push(`  …и ещё ${newUsers.length - 10}`);
  }
  lines.push(``);
  lines.push(`<b>Оплатили / докупили (24ч):</b> ${recentPaid.length}`);
  if (recentPaid.length > 0) {
    for (const u of recentPaid.slice(0, 10)) {
      const m = u.last_payment_minutes != null ? `${u.last_payment_minutes} мин` : '—';
      lines.push(`  • ${escapeHtml(u.email || '—')} → ${escapeHtml(u.tier || '—')}: ${m}`);
    }
    if (recentPaid.length > 10) lines.push(`  …и ещё ${recentPaid.length - 10}`);
  }
  lines.push(``);
  lines.push(`<b>Всего в сервисе:</b>`);
  lines.push(`  • Пользователей: ${totalUsers}`);
  lines.push(`  • Платящих когда-либо: ${totalPaid}`);
  if (topByBalance.length > 0) {
    lines.push(``);
    lines.push(`<b>Топ-5 по балансу:</b>`);
    for (const x of topByBalance) {
      lines.push(`  • ${escapeHtml(x.email)} (${escapeHtml(x.tier)}) — ${x.minutesLeft} мин`);
    }
  }

  return lines.join('\n');
}

/** Внутренняя проверка: если время совпало и сегодня ещё не отправляли — собрать и отправить. */
async function tick(): Promise<void> {
  try {
    const { ymd, hour, minute } = nowInWarsaw();
    if (hour !== TARGET_HOUR || minute !== TARGET_MINUTE) return;
    if (lastSentYmd === ymd) return; // уже отправляли сегодня

    const text = await buildSummary();
    const { sent, total } = await sendTelegramAdminMessage(text, 'HTML');
    lastSentYmd = ymd;
    console.log(`[DailySummary] ${ymd} 09:00 ${TARGET_TZ}: отправлено ${sent}/${total} получателям.`);
  } catch (err) {
    console.warn('[DailySummary] tick error (продолжаю работать):', err);
  }
}

export function startDailySummaryScheduler(): void {
  if (timer) return;
  timer = setInterval(tick, CHECK_INTERVAL_MS);
  // Подсказка в лог в момент старта — чтобы видеть, что scheduler жив.
  const { hour, minute } = nowInWarsaw();
  console.log(`[DailySummary] Scheduler запущен. Сейчас в ${TARGET_TZ}: ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}. Целевое время: 09:00.`);
}

/** Остановить планировщик (для graceful shutdown / тестов). */
export function stopDailySummaryScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Ручной запуск (для админского endpoint «отправить сводку прямо сейчас»). */
export async function sendDailySummaryNow(): Promise<{ sent: number; total: number; text: string }> {
  const text = await buildSummary();
  const { sent, total } = await sendTelegramAdminMessage(text, 'HTML');
  return { sent, total, text };
}
