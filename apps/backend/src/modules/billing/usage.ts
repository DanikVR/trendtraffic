/**
 * Учёт минут перевода — billing/usage.ts
 *
 * Списывает секунды у tenant'а во время активной речи в комнате.
 * Используется bridge.ts: на каждую секунду активного перевода у спикера
 * мы тратим минуту тенанта-владельца комнаты (creator_tenant_id).
 *
 * Логика "сначала тратим rollover, потом основной баланс" реализована тут.
 */

import pool from '../../db/index.js';

interface BalanceState {
  tenantId: string;
  totalSeconds: number;  // balance + rollover
  status: 'ok' | 'low_balance' | 'exhausted';
  tier: string;
}

/** Узнать баланс tenant'а (используется в bridge перед каждым tick). */
export async function getTenantBalance(tenantId: string): Promise<BalanceState | null> {
  try {
    const res = await pool.query(
      `SELECT tier, status, translation_minutes_balance, rollover_seconds
       FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    const balance = Number(r.translation_minutes_balance || 0);
    const rollover = Number(r.rollover_seconds || 0);
    const total = balance + rollover;

    let status: BalanceState['status'] = 'ok';
    if (total <= 0) status = 'exhausted';
    else if (total <= 300) status = 'low_balance'; // < 5 минут

    return {
      tenantId,
      totalSeconds: total,
      status,
      tier: r.tier || 'unknown',
    };
  } catch (err) {
    console.warn('[Billing.usage] Не удалось получить баланс:', (err as Error).message);
    return null;
  }
}

/**
 * Списать N секунд с баланса tenant'а.
 * Сначала «съедает» rollover_seconds, потом основной баланс.
 *
 * @returns новый суммарный остаток (баланс + rollover) после списания
 */
export async function consumeSeconds(tenantId: string, secondsToConsume: number): Promise<number> {
  if (secondsToConsume <= 0) return -1;
  try {
    const cur = await getTenantBalance(tenantId);
    if (!cur) return -1;

    let rollover = 0;
    let balance = 0;
    try {
      const r = await pool.query(
        'SELECT translation_minutes_balance, rollover_seconds FROM subscriptions WHERE tenant_id = $1',
        [tenantId]
      );
      rollover = Number(r.rows[0]?.rollover_seconds || 0);
      balance = Number(r.rows[0]?.translation_minutes_balance || 0);
    } catch { /* fallback дозволяет null */ }

    let remaining = secondsToConsume;
    if (rollover > 0) {
      const used = Math.min(rollover, remaining);
      rollover -= used;
      remaining -= used;
    }
    if (remaining > 0) {
      const used = Math.min(balance, remaining);
      balance -= used;
      remaining -= used;
    }

    await pool.query(
      `UPDATE subscriptions
       SET translation_minutes_balance = $1, rollover_seconds = $2, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $3`,
      [balance, rollover, tenantId]
    );

    return balance + rollover;
  } catch (err) {
    console.warn('[Billing.usage] Не удалось списать секунды:', (err as Error).message);
    return -1;
  }
}

/** Тарифы с безлимитом (Premium/Enterprise) — баланс символический и не списывается. */
export function isUnlimitedTier(tier: string): boolean {
  return tier === 'enterprise' || tier === 'premium';
}
