#!/usr/bin/env node
/**
 * VibeVox — генератор прод-секретов (Критичные пункты 1+2: env + ротация).
 *
 * Печатает готовые строки для apps/backend/.env. Запускайте НА СЕРВЕРЕ при деплое
 * (и при ротации — просто запустите снова, получите новые значения).
 *
 *   node deploy/gen-secrets.mjs                          # печать в консоль
 *   node deploy/gen-secrets.mjs >> apps/backend/.env     # дописать в .env
 *
 * ВАЖНО:
 *   - Эти значения НИКОГДА не коммитьте (apps/backend/.env под .gitignore).
 *   - JWT_SECRET/SIP_ENCRYPTION_KEY — 32 байта hex. SUPERADMIN_DEFAULT_PASSWORD —
 *     случайный, .env- и shell-безопасный (base64url, без кавычек/$/#).
 *   - После первого входа суперадмином СМЕНИТЕ пароль в /admin/config (тогда он
 *     ляжет bcrypt-хэшем в superadmin-auth.json, а дефолт перестанет действовать).
 */
import crypto from 'crypto';

const hex32 = () => crypto.randomBytes(32).toString('hex');
const pw = () => crypto.randomBytes(18).toString('base64url'); // 24 симв., A-Za-z0-9-_

const out = [
  `JWT_SECRET=${hex32()}`,
  `SIP_ENCRYPTION_KEY=${hex32()}`,
  `SUPERADMIN_DEFAULT_PASSWORD=${pw()}`,
];

console.log('# --- VibeVox secrets — сгенерировано на этой машине, НЕ коммитить ---');
console.log('# Вставьте в apps/backend/.env. Для ротации запустите скрипт снова.');
console.log(out.join('\n'));
