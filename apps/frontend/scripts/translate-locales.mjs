#!/usr/bin/env node
/**
 * translate-locales.mjs
 *
 * Берёт public/locales/ru/common.json (источник истины), переводит все строковые
 * значения на все языки из SUPPORTED_LANGUAGES через Google Cloud Translation API
 * (v2 endpoint, не требует client библиотеки — простой fetch).
 *
 * Пропускает языки, у которых файл уже существует и не помечен флагом
 * `"_meta": { "needsRefresh": true }`.
 *
 * Запуск:
 *   GOOGLE_TRANSLATE_API_KEY=xxx npm run translate:locales
 *   (или поместить ключ в apps/frontend/.env.local — переменная GOOGLE_TRANSLATE_API_KEY)
 *
 * Стоимость: ~$20 за 1M символов. Один прогон common.json по ~100 языкам
 * примерно укладывается в $0.5–$2.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');

// Загрузим ключ из process.env или из .env.local рядом с package.json.
async function loadApiKey() {
  let key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (key) return key;
  try {
    const envText = await fs.readFile(path.join(ROOT, '.env.local'), 'utf-8');
    const match = envText.match(/^GOOGLE_TRANSLATE_API_KEY\s*=\s*(.+)$/m);
    if (match) return match[1].trim();
  } catch { /* нет файла — ок */ }
  return null;
}

// Соответствие наших кодов и кодов Google Translate (некоторые отличаются).
const GOOGLE_CODE_MAP = {
  zh: 'zh-CN',
  he: 'iw',     // Google историчесси использует iw для иврита (принимает he тоже)
  jv: 'jw',
  // остальные совпадают
};

// Языки для генерации. Берётся из этого же списка, что в config/i18n.ts.
const TARGET_LANGUAGES = [
  'af','sq','am','ar','hy','az','eu','be','bn','bs','bg','ca','ceb','zh','co','hr',
  'cs','da','nl','en','eo','et','fi','fr','fy','gl','ka','de','el','gu','ht','ha',
  'haw','he','hi','hmn','hu','is','ig','id','ga','it','ja','jv','kn','kk','km',
  'rw','ko','ku','ky','lo','la','lv','lt','lb','mk','mg','ms','ml','mt','mi','mr',
  'mn','my','ne','no','ny','or','ps','fa','pl','pt','pa','ro','ru','sm','gd','sr',
  'st','sn','sd','si','sk','sl','so','es','su','sw','sv','tl','tg','ta','tt','te',
  'th','tr','tk','uk','ur','ug','uz','vi','cy','xh','yi','yo','zu',
];

const SOURCE_LANG = 'ru';
const SOURCE_FILE = path.join(LOCALES_DIR, SOURCE_LANG, 'common.json');

/** Рекурсивно собирает все строковые значения из объекта в плоский массив (с путями). */
function collectStrings(obj, prefix = '') {
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result.push({ key: fullKey, value });
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...collectStrings(value, fullKey));
    }
  }
  return result;
}

/** Восстанавливает вложенный объект из плоских пар [key, translatedValue]. */
function rebuildObject(originalShape, flatTranslations) {
  function walk(srcNode, prefix = '') {
    if (typeof srcNode === 'string') {
      const k = prefix;
      return flatTranslations[k] ?? srcNode;
    }
    if (srcNode && typeof srcNode === 'object' && !Array.isArray(srcNode)) {
      const out = {};
      for (const [k, v] of Object.entries(srcNode)) {
        out[k] = walk(v, prefix ? `${prefix}.${k}` : k);
      }
      return out;
    }
    return srcNode;
  }
  return walk(originalShape);
}

/** Batch-перевод через Google v2 endpoint. */
async function translateBatch(apiKey, texts, targetLang, sourceLang) {
  const googleTarget = GOOGLE_CODE_MAP[targetLang] || targetLang;
  const googleSource = GOOGLE_CODE_MAP[sourceLang] || sourceLang;
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const body = {
    q: texts,
    target: googleTarget,
    source: googleSource,
    format: 'text',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data?.data?.translations?.map((t) => t.translatedText) || [];
}

// Сохраняет интерполяционные плейсхолдеры {{xxx}} от переводчика.
function protectPlaceholders(str) {
  // Защищаем {{xxx}} как __VV0__, __VV1__ ...
  const map = [];
  const protectedStr = str.replace(/\{\{[^}]+\}\}/g, (m) => {
    const placeholder = `__VV${map.length}__`;
    map.push(m);
    return placeholder;
  });
  return { protectedStr, map };
}

function restorePlaceholders(translatedStr, map) {
  let out = translatedStr;
  map.forEach((original, idx) => {
    // ловим разные варианты, как Google может переписать
    const variants = [`__VV${idx}__`, `__vv${idx}__`, `_VV${idx}_`, `__ VV${idx} __`];
    for (const v of variants) {
      out = out.split(v).join(original);
    }
  });
  return out;
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error('❌ GOOGLE_TRANSLATE_API_KEY не найден (env или apps/frontend/.env.local)');
    process.exit(1);
  }

  let sourceText;
  try {
    sourceText = await fs.readFile(SOURCE_FILE, 'utf-8');
  } catch (e) {
    console.error(`❌ Не нашёл источник ${SOURCE_FILE}:`, e.message);
    process.exit(1);
  }
  const source = JSON.parse(sourceText);
  const flat = collectStrings(source);
  console.log(`📖 Источник ${SOURCE_LANG}/common.json — ${flat.length} строк.`);

  for (const lang of TARGET_LANGUAGES) {
    if (lang === SOURCE_LANG) continue;
    const targetPath = path.join(LOCALES_DIR, lang, 'common.json');
    try {
      // Проверим — если уже есть и не помечен needsRefresh — пропускаем.
      const existingRaw = await fs.readFile(targetPath, 'utf-8').catch(() => null);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        if (!existing?._meta?.needsRefresh) {
          // Уже переведено — пропускаем (чтобы не тратить квоту). Чтобы пересоздать,
          // удали файл или поставь "_meta": { "needsRefresh": true }.
          console.log(`⏭  ${lang}: уже существует (skip)`);
          continue;
        }
      }

      // Защищаем placeholders {{var}}.
      const protectedItems = flat.map((it) => protectPlaceholders(it.value));
      const protectedStrings = protectedItems.map((p) => p.protectedStr);

      // Google допускает массив, но ограничен ~128 элементов и 30000 символов на запрос.
      // Делим на чанки по 50 элементов.
      const translated = [];
      const CHUNK = 50;
      for (let i = 0; i < protectedStrings.length; i += CHUNK) {
        const chunk = protectedStrings.slice(i, i + CHUNK);
        const chunkTranslated = await translateBatch(apiKey, chunk, lang, SOURCE_LANG);
        translated.push(...chunkTranslated);
      }

      // Восстанавливаем placeholders.
      const flatTranslations = {};
      flat.forEach((it, idx) => {
        flatTranslations[it.key] = restorePlaceholders(translated[idx], protectedItems[idx].map);
      });

      const result = rebuildObject(source, flatTranslations);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
      console.log(`✅ ${lang}: переведено ${flat.length} строк → ${path.relative(ROOT, targetPath)}`);
    } catch (e) {
      console.error(`❌ ${lang}: ошибка перевода —`, e.message);
    }
  }

  console.log('\n🎉 Готово.');
}

main();
