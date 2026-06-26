#!/usr/bin/env node
/**
 * translate-new-keys.mjs
 *
 * ХИРУРГИЧЕСКИЙ переводчик: переводит ТОЛЬКО перечисленные в KEY_PATHS ключи
 * во все локали public/locales/<lang>/common.json, НЕ трогая остальные ключи
 * и НЕ перетранслируя весь файл (в отличие от translate-locales.mjs, который
 * переписывает файл целиком и затирает ручные правки).
 *
 * Источник значений — английский (en/common.json) как удобный пивот.
 * При ошибке API для языка ключ заполняется английским значением (fallback),
 * чтобы во фронте не торчал сырой ключ.
 *
 * Запуск:
 *   node scripts/translate-new-keys.mjs
 *   (ключ берётся из GOOGLE_TRANSLATE_API_KEY env или apps/frontend/.env.local)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const SOURCE_LANG = 'en';

// ── Ключи для перевода (ТЕКУЩИЙ БАТЧ: разделитель дней в ленте чата комнаты) ──
// Прошлые батчи (settings.changePwd.*, auth.reset.*) уже переведены во всех локалях —
// их повторно гонять не нужно. Перед новым прогоном замени список на свежие ключи.
const KEY_PATHS = [
  'chat.empty',
  'chat.newMessages',
  'chat.fromTranscript',
  'chat.audioMessage',
  'chat.queued',
  'chat.delivered',
  'chat.fileFallback',
  'chat.openImage',
  'chat.explainTone',
];

// Наши коды → коды Google Translate (некоторые отличаются).
const GOOGLE_CODE_MAP = { zh: 'zh-CN', he: 'iw', jv: 'jw' };

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf-8'));
}
async function writeJson(file, obj) {
  await fs.writeFile(file, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

async function loadApiKey() {
  let key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (key) return key;
  try {
    const envText = await fs.readFile(path.join(ROOT, '.env.local'), 'utf-8');
    const m = envText.match(/^GOOGLE_TRANSLATE_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* нет файла — ок */ }
  return null;
}

function getByPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}
function setByPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof node[k] !== 'object' || node[k] === null || Array.isArray(node[k])) node[k] = {};
    node = node[k];
  }
  node[parts[parts.length - 1]] = value;
}

// Защищаем ведущие глифы (✓ ✔ ← →) — Google иногда их съедает/двигает.
function protectPrefix(s) {
  const m = s.match(/^([✓✔←→»«\s]+)/u);
  if (m) return { prefix: m[1], rest: s.slice(m[1].length) };
  return { prefix: '', rest: s };
}

async function translateBatch(apiKey, texts, targetLang) {
  const googleTarget = GOOGLE_CODE_MAP[targetLang] || targetLang;
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, target: googleTarget, source: 'en', format: 'text' }),
  });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.data?.translations?.map((t) => t.translatedText) || [];
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error('❌ GOOGLE_TRANSLATE_API_KEY не найден (env или apps/frontend/.env.local)');
    process.exit(1);
  }

  const enSource = await readJson(path.join(LOCALES_DIR, SOURCE_LANG, 'common.json'));
  const enValues = KEY_PATHS.map((k) => {
    const v = getByPath(enSource, k);
    if (typeof v !== 'string') throw new Error(`В en/common.json нет строки для ключа: ${k}`);
    return v;
  });

  const entries = await fs.readdir(LOCALES_DIR);
  // Только директории-языки; исключаем служебные (_glossary.json и т.п.) и источники.
  const langs = [];
  for (const e of entries) {
    if (e.startsWith('.') || e.startsWith('_')) continue;
    if (e === 'en' || e === 'ru') continue; // источники уже заполнены вручную
    const stat = await fs.stat(path.join(LOCALES_DIR, e)).catch(() => null);
    if (stat?.isDirectory()) langs.push(e);
  }

  console.log(`📖 Переводим ${KEY_PATHS.length} ключей на ${langs.length} языков (источник: en).`);

  let ok = 0, fellBack = 0, skipped = 0;
  for (const lang of langs) {
    const file = path.join(LOCALES_DIR, lang, 'common.json');
    let target;
    try {
      target = await readJson(file);
    } catch {
      console.warn(`⏭  ${lang}: нет common.json — пропуск (запусти i18n:propagate)`);
      skipped++;
      continue;
    }

    let translated;
    try {
      // Защищаем ведущие глифы, переводим, восстанавливаем.
      const parts = enValues.map(protectPrefix);
      const out = await translateBatch(apiKey, parts.map((p) => p.rest), lang);
      translated = parts.map((p, i) => p.prefix + (out[i] ?? p.rest));
      ok++;
    } catch (e) {
      // API не справился для языка — кладём английский, чтобы ключ существовал.
      console.warn(`⚠️  ${lang}: API ошибка (${e.message}) — английский fallback`);
      translated = enValues.slice();
      fellBack++;
    }

    KEY_PATHS.forEach((k, i) => setByPath(target, k, translated[i]));
    await writeJson(file, target);
  }

  console.log(`\n✅ Переведено: ${ok} · 🟡 fallback(en): ${fellBack} · ⏭ пропущено: ${skipped}`);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
