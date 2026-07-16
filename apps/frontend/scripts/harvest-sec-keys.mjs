#!/usr/bin/env node
/**
 * harvest-sec-keys.mjs
 *
 * Ground-truth harvester. После i18n-извлечения компоненты содержат вызовы
 * вида  t('sec.foo.bar', 'Русский текст')  (второй аргумент — русский фолбэк).
 * Скрипт сканирует src/, вытаскивает ВСЕ пары (ключ sec.* → русский default)
 * прямо из исходников и мёржит недостающие в public/locales/ru/common.json
 * (источник истины для перевода). Существующие ключи не перезаписывает, если
 * не передан --overwrite.
 *
 * Опции:
 *   --overwrite   обновлять русское значение существующих sec.* ключей
 *   --dry         только показать, что будет добавлено
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const RU = path.join(ROOT, 'public', 'locales', 'ru', 'common.json');

const args = new Set(process.argv.slice(2));
const OVERWRITE = args.has('--overwrite');
const DRY = args.has('--dry');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

// t('sec.x.y', 'default')  |  t("sec.x.y", "default")  — default may contain escaped quotes
// Также ловим i18n.t('common:sec.x.y', '…') из не-компонентного кода (префикс отбрасываем).
const RE = /\bt\(\s*(['"])(?:common:)?(sec\.[A-Za-z0-9_.]+)\1\s*,\s*(['"])((?:\\.|(?!\3)[\s\S])*?)\3/g;

function unescape(s, q) {
  return s.replace(new RegExp(`\\\\${q}`, 'g'), q).replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}

function setByPath(obj, dotted, value, overwrite) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  const leaf = parts[parts.length - 1];
  if (leaf in cur && !overwrite) return false;
  cur[leaf] = value;
  return true;
}

async function main() {
  const files = await walk(SRC);
  const found = new Map(); // key -> ru default
  const dupMismatch = [];
  for (const f of files) {
    const src = await fs.readFile(f, 'utf-8');
    let m;
    while ((m = RE.exec(src))) {
      const key = m[2];
      const val = unescape(m[4], m[3]);
      if (found.has(key) && found.get(key) !== val) dupMismatch.push({ key, a: found.get(key), b: val, file: path.relative(ROOT, f) });
      found.set(key, val);
    }
  }
  console.log(`🔎 Harvested ${found.size} unique sec.* keys from ${files.length} source files.`);
  if (dupMismatch.length) {
    console.log(`⚠ ${dupMismatch.length} key(s) used with DIFFERENT Russian defaults (kept last seen):`);
    for (const d of dupMismatch.slice(0, 15)) console.log(`   ${d.key}\n     - ${JSON.stringify(d.a)}\n     - ${JSON.stringify(d.b)}  (${d.file})`);
  }

  const ru = JSON.parse(await fs.readFile(RU, 'utf-8'));
  let added = 0, updated = 0;
  const sorted = [...found.keys()].sort();
  for (const key of sorted) {
    const exists = key.split('.').reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), ru) !== undefined;
    const ok = setByPath(ru, key, found.get(key), OVERWRITE);
    if (ok) { if (exists) updated++; else added++; }
  }
  console.log(`➕ ${added} new keys, 🔁 ${updated} updated (overwrite=${OVERWRITE}).`);

  if (DRY) { console.log('(dry run — ru/common.json not written)'); return; }
  await fs.writeFile(RU, JSON.stringify(ru, null, 2) + '\n', 'utf-8');
  console.log(`💾 Wrote ${path.relative(ROOT, RU)}`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
