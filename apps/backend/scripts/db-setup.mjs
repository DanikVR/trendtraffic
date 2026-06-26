#!/usr/bin/env node
/**
 * Однократная инициализация схемы PostgreSQL (VPS / хостинг).
 *
 *   cd apps/backend
 *   # заполните .env (DATABASE_URL ИЛИ DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME, + DB_SSL=true для удалённой БД)
 *   npm run db:setup
 *
 * Использует ТЕ ЖЕ переменные окружения, что и сервер.
 * Безопасно: если таблица `tenants` уже есть — данные НЕ трогаются, init.sql пропускается.
 * ALTER-миграции (новые колонки) применяются автоматически при старте сервера.
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

function resolveSsl() {
  const v = (process.env.DB_SSL || '').toLowerCase();
  const fromUrl = !!process.env.DATABASE_URL && /sslmode=require/i.test(process.env.DATABASE_URL);
  if (!(v === 'true' || v === 'require' || v === '1' || fromUrl)) return false;
  return { rejectUnauthorized: (process.env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() === 'true' };
}

function buildConfig() {
  const ssl = resolveSsl();
  const common = { connectionTimeoutMillis: 15000, ...(ssl ? { ssl } : {}) };
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL, ...common };
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'vibevox_admin',
    password: process.env.DB_PASSWORD || 'vibevox_secure_pass',
    database: process.env.DB_NAME || 'vibevox_db',
    ...common,
  };
}

function describeTarget() {
  if (process.env.DATABASE_URL) {
    // Прячем пароль в логе
    return process.env.DATABASE_URL.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
  }
  return `${process.env.DB_USER || 'vibevox_admin'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'vibevox_db'}`;
}

async function main() {
  console.log('[db-setup] Цель:', describeTarget(), resolveSsl() ? '(SSL on)' : '(SSL off)');
  const client = new Client(buildConfig());
  console.log('[db-setup] Подключаюсь к PostgreSQL…');
  await client.connect();
  console.log('[db-setup] ✓ Подключение успешно.');

  const exists = await client.query(`SELECT to_regclass('public.tenants') AS t`);
  if (exists.rows[0].t) {
    console.log('[db-setup] Таблица "tenants" уже существует — схема инициализирована. init.sql пропущен (данные не тронуты).');
  } else {
    const sqlPath = path.resolve(__dirname, '../src/db/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    console.log(`[db-setup] Загружаю схему из ${sqlPath} …`);
    await client.query(sql);
    console.log('[db-setup] ✓ Схема создана (init.sql выполнен).');
  }

  const tables = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  );
  console.log(`[db-setup] Таблиц в БД: ${tables.rows.length}`);
  for (const r of tables.rows) console.log('   •', r.tablename);

  await client.end();
  console.log('\n[db-setup] ✓ Готово. Запустите сервер: npm start (или npm run dev) — ALTER-миграции применятся сами.');
  console.log('[db-setup] Не забудьте в .env: DB_DISABLE_FALLBACK=true (чтобы прод не уходил в JSON-fallback).');
}

main().catch((e) => {
  console.error('\n[db-setup] ОШИБКА:', e?.message || e);
  if (e?.code) console.error('[db-setup] code:', e.code);
  console.error('[db-setup] Проверьте .env (DATABASE_URL или DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME),');
  console.error('           SSL (DB_SSL=true для удалённой БД) и что IP сервера в whitelist хостинга.');
  process.exit(1);
});
