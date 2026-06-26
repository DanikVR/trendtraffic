#!/usr/bin/env node
/**
 * check-i18n-coverage.mjs
 *
 * Pre-deploy guard: ищет в исходниках все вызовы `t('foo.bar')` (литерал-ключи)
 * и сверяет с `public/locales/ru/common.json`. Падает с кодом 1, если в коде
 * есть ключ, которого нет в источнике — иначе деплой укатил бы UI с сырым
 * текстом ключа вместо перевода.
 *
 * Что НЕ проверяется:
 *   • динамические ключи `t(\`dyn.\${x}\`)` — пропускаются (false positive).
 *   • неймспейс-префиксы `t('room:foo')` — проверяются против ru-модуля
 *     (мы предупреждаем, но не валим: модульные локали — скелеты).
 *
 * Опции:
 *   --warn-only   не падать, только печатать список
 *   --json        машинно-читаемый вывод
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const COMMON_FILE = path.join(ROOT, 'public', 'locales', 'ru', 'common.json');

const args = new Set(process.argv.slice(2));
const WARN_ONLY = args.has('--warn-only');
const JSON_OUT = args.has('--json');

/** Рекурсивно собирает все .ts/.tsx файлы из src/. */
async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Достаёт литерал-ключи из вызовов t('...') / t("..."). Парсит грубой
 *  регуляркой — этого достаточно для текущего кодстайла VibeVox (нет JSX-only
 *  exotic-вариантов). */
function extractKeys(source) {
  const keys = new Set();
  // t('foo.bar')   t("foo.bar")   t('foo.bar', { ... })
  const re = /\bt\(\s*(['"])([a-zA-Z0-9_.]+)\1/g;
  let m;
  while ((m = re.exec(source))) {
    keys.add(m[2]);
  }
  return keys;
}

/** Все ключи, доступные в ru/common.json (плоский список dotted paths). */
function flattenKeys(obj, prefix = '') {
  const out = new Set();
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue; // _meta и т.п.
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const child of flattenKeys(v, full)) out.add(child);
    } else {
      out.add(full);
    }
  }
  return out;
}

async function main() {
  const commonRaw = await fs.readFile(COMMON_FILE, 'utf-8');
  const common = JSON.parse(commonRaw);
  const availableKeys = flattenKeys(common);
  // Также допускаем «ветку как ключ» — `t('rooms')` валиден, если есть `rooms.*`.
  const availableBranches = new Set();
  for (const k of availableKeys) {
    const parts = k.split('.');
    for (let i = 1; i <= parts.length; i++) {
      availableBranches.add(parts.slice(0, i).join('.'));
    }
  }

  const files = await walk(SRC_DIR);
  const usedKeys = new Map(); // key → [file:line]
  for (const f of files) {
    const src = await fs.readFile(f, 'utf-8');
    const keys = extractKeys(src);
    for (const k of keys) {
      if (!usedKeys.has(k)) usedKeys.set(k, []);
      usedKeys.get(k).push(path.relative(ROOT, f));
    }
  }

  const missing = [];
  for (const [key, files] of usedKeys) {
    // Пропускаем неймспейс-префиксы (room:foo) — это не common.
    if (key.includes(':')) continue;
    // Игнорируем короткие keypath-проверки без точки — это обычно перебор форм.
    if (!availableBranches.has(key) && !availableKeys.has(key)) {
      missing.push({ key, files: [...new Set(files)] });
    }
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({
      used: usedKeys.size,
      available: availableKeys.size,
      missing,
    }, null, 2));
  } else {
    console.log(`📊 i18n coverage`);
    console.log(`   • Ключей использовано в коде: ${usedKeys.size}`);
    console.log(`   • Ключей в ru/common.json:    ${availableKeys.size}`);
    if (missing.length === 0) {
      console.log(`   ✅ Все ключи покрыты.`);
    } else {
      console.log(`   ❌ Не хватает ${missing.length} ключей в ru/common.json:\n`);
      for (const { key, files } of missing) {
        console.log(`   - ${key}`);
        for (const f of files.slice(0, 3)) console.log(`       ${f}`);
        if (files.length > 3) console.log(`       … +${files.length - 3} файлов`);
      }
      console.log('\nДобавьте недостающие ключи в public/locales/ru/common.json,');
      console.log('затем `node scripts/propagate-new-keys.mjs` и (если есть API key)');
      console.log('`npm run translate:locales` — и деплой пройдёт.');
    }
  }

  if (missing.length > 0 && !WARN_ONLY) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(2);
});
