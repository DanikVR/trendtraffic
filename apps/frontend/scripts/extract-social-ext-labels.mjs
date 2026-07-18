#!/usr/bin/env node
/**
 * extract-social-ext-labels.mjs — вытаскивает ВСЕ подписи UI рехостнутого
 * TikHub-расширения из его же бандла в локали приложения.
 *
 * Зачем: бандл переведён только на en/ja/ko/zh-CN/zh-TW, а приложение — на 108
 * языков. Бандл мы не правим (правило проекта), поэтому custom.js подменяет
 * подписи в DOM, а переводы берёт из public/locales/<lng>/social-ext.json.
 *
 * Что делает:
 *   • находит в chunks/permissions-*.js объект ресурсов i18next (`cn={en:{…}}`);
 *   • пишет en/social-ext.json — ИСТОЧНИК для пивот-переводчика;
 *   • ja/ko/zh берёт из САМОГО бандла (родные переводы — точнее машинных и бесплатно).
 *
 * Остальные языки добираются потом:
 *   node scripts/translate-pivot.mjs --source=en --file=social-ext.json
 *
 * Ключи — родные точечные (common.save, video.metrics.…). custom.js грузит en +
 * целевой язык и строит карту «английская строка → перевод».
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHUNKS_DIR = path.join(ROOT, 'public', 'social-ext', 'chunks');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const OUT_NAME = 'social-ext.json';

/** Языки бандла → папки локалей приложения. */
const BUNDLE_TO_APP = { en: 'en', ja: 'ja', ko: 'ko', 'zh-CN': 'zh' };

/**
 * Подписи кнопок, которые дорисовывает НАШ custom.js (в бандле их нет).
 * Префикс tt.* — чтобы не столкнуться с ключами расширения; custom.js берёт их
 * по ключу через tr(). Пишем только в en — остальные языки доберёт пивот.
 */
const OUR_LABELS = {
  'tt.ownDownload': 'Download',
  'tt.ownDownloadAudio': 'Download audio',
  'tt.ownDownloadMedia': 'Download media (max quality)',
  'tt.ownOpenLink': 'Open link',
  'tt.ownCopyLink': 'Copy link',
};

/** Вырезает сбалансированный объектный литерал, начиная с позиции `{`. */
function sliceObjectLiteral(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  throw new Error('не нашёл закрывающую скобку объекта ресурсов');
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object') flatten(v, key, out);
  }
  return out;
}

/** Строки, бесполезные для подмены текста в DOM. */
function usable(value) {
  const s = String(value).trim();
  if (s.length < 2) return false;          // «0», «—» — заденут данные
  if (/\{\{/.test(s)) return false;        // шаблоны i18next: в DOM уже с подставленным значением
  if (/^[\d\s.,:%+-]+$/.test(s)) return false; // чистые числа
  return true;
}

const files = (await fs.readdir(CHUNKS_DIR)).filter((f) => /^permissions-.*\.js$/.test(f));
if (!files.length) throw new Error(`не нашёл chunks/permissions-*.js в ${CHUNKS_DIR}`);
const src = await fs.readFile(path.join(CHUNKS_DIR, files[0]), 'utf-8');

const marker = src.indexOf('cn={en:{translation:');
if (marker === -1) throw new Error('не нашёл объект ресурсов i18next (cn={en:{translation:)');
const literal = sliceObjectLiteral(src, src.indexOf('{', marker));
// Литерал — чистые данные (строки в backtick-кавычках), кода внутри нет.
const resources = eval(`(${literal})`);

console.log(`📦 ${files[0]}: языки бандла — ${Object.keys(resources).join(', ')}`);

let wrote = 0;
for (const [bundleLng, appLng] of Object.entries(BUNDLE_TO_APP)) {
  const tree = resources[bundleLng]?.translation;
  if (!tree) { console.log(`  ⚠️  ${bundleLng} — нет в бандле, пропускаю`); continue; }

  const enFlat = flatten(resources.en.translation);
  const flat = flatten(tree);
  // Берём только ключи, полезные в английском источнике (в переводе строка может
  // отличаться формой, но ключ тот же) — так все файлы имеют одинаковый набор.
  const out = {};
  for (const key of Object.keys(enFlat)) {
    if (!usable(enFlat[key])) continue;
    const v = flat[key];
    if (typeof v === 'string' && v.trim()) out[key] = v;
  }

  if (bundleLng === 'en') Object.assign(out, OUR_LABELS); // наши кнопки — источник для пивота

  const dir = path.join(LOCALES_DIR, appLng);
  await fs.mkdir(dir, { recursive: true });
  // Не затираем уже переведённые ключи (напр. tt.* от прошлого прогона пивота).
  let prev = {};
  try { prev = JSON.parse(await fs.readFile(path.join(dir, OUT_NAME), 'utf-8')); } catch { /* новый файл */ }
  for (const [k, v] of Object.entries(prev)) if (!(k in out)) out[k] = v;
  await fs.writeFile(path.join(dir, OUT_NAME), JSON.stringify(out, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ ${appLng}/${OUT_NAME}: ${Object.keys(out).length} строк${bundleLng === 'en' ? ' (источник для пивота)' : ' (родной перевод бандла)'}`);
  wrote++;
}

console.log(`\n🎉 Записано ${wrote} файлов. Остальные языки:\n   node scripts/translate-pivot.mjs --source=en --file=${OUT_NAME}`);
