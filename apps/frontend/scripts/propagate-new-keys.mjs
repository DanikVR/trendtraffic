#!/usr/bin/env node
/**
 * propagate-new-keys.mjs
 *
 * Сравнивает public/locales/ru/common.json (источник истины) с каждой целевой
 * локалью и добавляет ОТСУТСТВУЮЩИЕ ключи. Ничего не перезаписывает: если
 * перевод уже есть, он сохраняется. Новые ключи появляются с английским
 * значением (placeholder), а файл помечается `_meta.needsRefresh: true`,
 * чтобы translate-locales.mjs позднее перетранслировал их через Google API.
 *
 * Зачем нужен: когда мы расширяем common.json новыми ключами (sidebar,
 * moreSheet, call, coach, roomActions и т.п.), 100+ языковых файлов
 * остаются без них и фронтенд показывает английский fallback. Этот скрипт
 * физически добавляет ключи во все файлы, чтобы строки рендерились
 * хотя бы по-английски, а не как сырой ключ типа "coach.tones.neutral".
 *
 * Запуск:
 *   node scripts/propagate-new-keys.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const SOURCE_LANG = 'ru';
const EN_LANG = 'en';

async function readJson(file) {
  const raw = await fs.readFile(file, 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(file, obj) {
  await fs.writeFile(file, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

/**
 * Глубокое слияние: для каждого ключа из source, если в target его НЕТ —
 * берём значение из fallback (английский). Возвращает true, если что-то
 * было добавлено.
 */
function mergeMissing(source, target, fallback) {
  let changed = false;
  for (const [key, srcVal] of Object.entries(source)) {
    if (typeof srcVal === 'object' && srcVal !== null && !Array.isArray(srcVal)) {
      if (typeof target[key] !== 'object' || target[key] === null || Array.isArray(target[key])) {
        target[key] = {};
        changed = true;
      }
      const fbBranch = (fallback && typeof fallback[key] === 'object') ? fallback[key] : {};
      if (mergeMissing(srcVal, target[key], fbBranch)) changed = true;
    } else {
      if (!(key in target)) {
        // Берём английский placeholder, если есть; иначе — русский (чтобы было хоть что-то).
        target[key] = (fallback && key in fallback) ? fallback[key] : srcVal;
        changed = true;
      }
    }
  }
  return changed;
}

async function main() {
  const sourceFile = path.join(LOCALES_DIR, SOURCE_LANG, 'common.json');
  const enFile = path.join(LOCALES_DIR, EN_LANG, 'common.json');

  const source = await readJson(sourceFile);
  const enSource = await readJson(enFile);

  const entries = await fs.readdir(LOCALES_DIR);
  const langs = entries.filter((e) => !e.startsWith('.') && !e.startsWith('_'));

  let touched = 0;
  let untouched = 0;
  const refreshed = [];

  for (const lang of langs) {
    if (lang === SOURCE_LANG || lang === EN_LANG) continue;
    const targetFile = path.join(LOCALES_DIR, lang, 'common.json');
    let target;
    try {
      target = await readJson(targetFile);
    } catch {
      // Нет файла — создаём пустой и заполняем английским.
      target = {};
    }

    const changed = mergeMissing(source, target, enSource);
    if (changed) {
      // Помечаем для будущего ре-перевода (translate-locales.mjs учитывает это поле).
      target._meta = { ...(target._meta || {}), needsRefresh: true };
      await writeJson(targetFile, target);
      touched++;
      refreshed.push(lang);
    } else {
      untouched++;
    }
  }

  console.log(`✅ Обновлено языков: ${touched}`);
  console.log(`⏭  Без изменений: ${untouched}`);
  if (refreshed.length) {
    console.log(`📌 needsRefresh: ${refreshed.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
