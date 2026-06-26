#!/usr/bin/env node
/**
 * Разовый: создаёт свежий ТЕСТОВЫЙ Enterprise-аккаунт в Postgres (для проверки
 * CW-SSO моста). Email новый → Platform App сам заведёт юзера в Chatwoot.
 *
 *   cd apps/backend
 *   $env:PGPASSWORD='<postgres pw>'; node scripts/create-test-account.mjs
 *
 * Идемпотентно: если email уже есть — просто апгрейдит подписку до enterprise.
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const EMAIL = 'vibetest@vibevox.pro';
const PASSWORD = 'VibeTest2026!';

const client = new pg.Client({
  host: '127.0.0.1', port: 5432, user: 'postgres',
  password: process.env.PGPASSWORD, database: 'vibevox_db',
});

async function main() {
  await client.connect();

  let tenantId;
  const ex = await client.query('SELECT id, tenant_id FROM users WHERE lower(email)=lower($1) LIMIT 1', [EMAIL]);
  if (ex.rows[0]) {
    tenantId = ex.rows[0].tenant_id;
    console.log('Пользователь уже есть, tenant=' + tenantId);
  } else {
    tenantId = randomUUID();
    const userId = randomUUID();
    const hash = bcrypt.hashSync(PASSWORD, 10);
    await client.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [tenantId, 'Bridge Test']);
    await client.query(
      "INSERT INTO users (id, email, password_hash, role, tenant_id) VALUES ($1,$2,$3,'user',$4)",
      [userId, EMAIL, hash, tenantId]
    );
    console.log('Создан пользователь ' + EMAIL + ' tenant=' + tenantId);
  }

  const sub = await client.query('SELECT id FROM subscriptions WHERE tenant_id=$1 LIMIT 1', [tenantId]);
  if (sub.rows[0]) {
    await client.query(
      "UPDATE subscriptions SET tier='enterprise', status='active', translation_minutes_balance=99999, cancel_at_period_end=false, updated_at=now() WHERE tenant_id=$1",
      [tenantId]
    );
    console.log('Подписка обновлена → enterprise/active');
  } else {
    await client.query(
      "INSERT INTO subscriptions (id, tenant_id, tier, status, translation_minutes_balance, billing_period, rollover_seconds, cancel_at_period_end) VALUES ($1,$2,'enterprise','active',99999,'one_time',0,false)",
      [randomUUID(), tenantId]
    );
    console.log('Подписка создана → enterprise/active');
  }

  await client.end();
  console.log('DONE  email=' + EMAIL + '  password=' + PASSWORD + '  tenant=' + tenantId);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
