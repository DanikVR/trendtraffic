#!/usr/bin/env node
/**
 * Разовый импорт данных из db_fallback.json в реальный PostgreSQL.
 *
 *   cd apps/backend
 *   $env:PGPASSWORD='<postgres superuser pw>'; node scripts/import-fallback.mjs
 *
 * Безопасно/идемпотентно:
 *  - берём ТОЛЬКО колонки, которые реально есть в целевой таблице (intersection),
 *  - объекты/массивы → JSON (для jsonb-колонок),
 *  - ON CONFLICT DO NOTHING (повторный прогон не дублирует),
 *  - session_replication_role='replica' — отключает FK/триггеры на время загрузки,
 *  - пропускаем синтетический tenant id='global_admin' (не UUID).
 */
import pg from 'pg';
import fs from 'fs';

const FALLBACK = 'C:/GOOGLEDISK/VibeVox/apps/backend/db_fallback.json';
const d = JSON.parse(fs.readFileSync(FALLBACK, 'utf8'));
const isUuid = (s) => typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

const TABLES = [
  'tenants', 'users', 'user_profiles', 'subscriptions', 'rooms', 'room_messages',
  'tenant_quest_flow_keys', 'tenant_mcp_keys', 'tenant_need_tags', 'client_tag_assignments',
  'dialect_rules', 'partners', 'referral_clicks', 'referrals', 'flows', 'flow_sessions',
  'channel_inboxes', 'promo_codes', 'account_blocklist',
];

const client = new pg.Client({
  host: '127.0.0.1', port: 5432, user: 'postgres',
  password: process.env.PGPASSWORD, database: 'vibevox_db',
});

async function pgColumns(table) {
  const r = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
    [table]
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function insertRow(table, pgCols, row) {
  const cols = Object.keys(row).filter((k) => pgCols.has(k) && row[k] !== undefined);
  if (cols.length === 0) return 'skip';
  const vals = cols.map((k) => {
    const v = row[k];
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
  });
  const ph = cols.map((_, i) => '$' + (i + 1)).join(',');
  const sql = `INSERT INTO ${table} (${cols.map((c) => '"' + c + '"').join(',')}) VALUES (${ph}) ON CONFLICT DO NOTHING`;
  const r = await client.query(sql, vals);
  return r.rowCount > 0 ? 'ins' : 'dup';
}

async function main() {
  await client.connect();
  await client.query("SET session_replication_role = 'replica'");

  for (const t of TABLES) {
    const rows = d[t];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const pgCols = await pgColumns(t);
    if (pgCols.size === 0) { console.log(`${t}: таблицы нет — пропуск`); continue; }
    let ins = 0, dup = 0, err = 0;
    for (const row of rows) {
      if (t === 'tenants' && !isUuid(row.id)) continue; // global_admin — пропуск
      try {
        const r = await insertRow(t, pgCols, row);
        if (r === 'ins') ins++; else if (r === 'dup') dup++;
      } catch (e) {
        err++;
        console.log(`  [${t}] ${String(e.message).slice(0, 110)}`);
      }
    }
    console.log(`${t}: вставлено=${ins} дубль=${dup} ошибок=${err}`);
  }

  // singleton
  const pps = d.partner_program_settings;
  if (pps && typeof pps === 'object' && !Array.isArray(pps)) {
    const pgCols = await pgColumns('partner_program_settings');
    try { await insertRow('partner_program_settings', pgCols, pps); console.log('partner_program_settings: ok'); }
    catch (e) { console.log('partner_program_settings: ' + String(e.message).slice(0, 110)); }
  }

  await client.query("SET session_replication_role = 'origin'");
  await client.end();
  console.log('DONE');
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
