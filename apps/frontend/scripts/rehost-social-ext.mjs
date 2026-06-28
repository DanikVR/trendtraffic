#!/usr/bin/env node
/**
 * rehost-social-ext.mjs — генератор статики вкладки «Social Media Extension».
 *
 * Копирует собранную сборку открытого TikHub-расширения в
 * apps/frontend/public/social-ext и адаптирует её для запуска внутри iframe
 * приложения (а не как Chrome-расширение):
 *   • переписывает абсолютные пути ассетов /chunks//assets//fonts/ → /social-ext/...
 *     ТОЛЬКО в .html и .css (в .js абсолютных ассет-путей нет; единственный
 *     /fonts/ в js — аргумент chrome.runtime.getURL(), которому /social-ext/
 *     добавит сам polyfill, иначе вышел бы двойной префикс);
 *   • вставляет chrome-polyfill.js (наш мост chrome.*→web) и background.js
 *     перед module-бандлом в sidepanel.html / options.html.
 *
 * chrome-polyfill.js НЕ пересоздаётся (он наш, лежит в public/social-ext и
 * сохраняется между прогонами).
 *
 * ИСТОЧНИК (SRC) — распакованная сборка расширения, путь машинно-зависимый.
 * Переопредели переменной окружения SOCIAL_EXT_SRC при повторной генерации:
 *   SOCIAL_EXT_SRC=/path/to/unpacked node scripts/rehost-social-ext.mjs
 *
 * После прогона ОБЯЗАТЕЛЬНО закоммить apps/frontend/public/social-ext (иначе на
 * чистом clone вкладка отдаёт SPA вместо расширения — см. predeploy шаг 0/7).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.SOCIAL_EXT_SRC || 'C:/Users/pl761/Downloads/0.8.18_0';
const DEST = path.resolve(__dirname, '../public/social-ext');

const COPY_DIRS = ['chunks', 'assets', 'fonts', '_locales'];
// options.html НЕ копируем: настройки (ключ TikHub) дублируются нашим прокси, а
// «Конфигурация ИИ» вынесена в модалку приложения (SocialExtensionPage). Шестерёнка
// внутри расширения открывает её через postMessage (см. chrome-polyfill openOptionsPage).
const COPY_FILES = ['sidepanel.html', 'background.js',
  'icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-128.png', 'logo.jpeg', 'favicon.ico'];

// Переписываем абсолютные пути ТОЛЬКО в .html и .css (см. шапку — .js не трогаем).
const REWRITE_EXT = new Set(['.html', '.css']);
const REPLACEMENTS = [
  [/\/chunks\//g, '/social-ext/chunks/'],
  [/\/assets\//g, '/social-ext/assets/'],
  [/\/fonts\//g, '/social-ext/fonts/'],
  [/\/_locales\//g, '/social-ext/_locales/'],
];

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function ensure(p) { fs.mkdirSync(p, { recursive: true }); }
function rewrite(buf) { let s = buf.toString('utf8'); for (const [re, to] of REPLACEMENTS) s = s.replace(re, to); return s; }

function copyTree(srcDir, destDir) {
  ensure(destDir);
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const sp = path.join(srcDir, e.name), dp = path.join(destDir, e.name);
    if (e.isDirectory()) { copyTree(sp, dp); continue; }
    if (REWRITE_EXT.has(path.extname(e.name).toLowerCase())) fs.writeFileSync(dp, rewrite(fs.readFileSync(sp)));
    else fs.copyFileSync(sp, dp);
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`SRC не найден: ${SRC}\nУкажи путь: SOCIAL_EXT_SRC=/path/to/unpacked node scripts/rehost-social-ext.mjs`);
  process.exit(1);
}

// Сохраняем наш chrome-polyfill.js через пересоздание каталога.
const POLY = path.join(DEST, 'chrome-polyfill.js');
const polySaved = fs.existsSync(POLY) ? fs.readFileSync(POLY) : null;
rmrf(DEST); ensure(DEST);
if (polySaved) fs.writeFileSync(POLY, polySaved);

for (const d of COPY_DIRS) { const s = path.join(SRC, d); if (fs.existsSync(s)) copyTree(s, path.join(DEST, d)); }
for (const f of COPY_FILES) {
  const s = path.join(SRC, f);
  if (!fs.existsSync(s)) { console.warn('skip missing', f); continue; }
  if (REWRITE_EXT.has(path.extname(f).toLowerCase())) fs.writeFileSync(path.join(DEST, f), rewrite(fs.readFileSync(s)));
  else fs.copyFileSync(s, path.join(DEST, f));
}

// Вставляем polyfill + background перед первым module-скриптом (порядок важен).
for (const html of ['sidepanel.html']) {
  const p = path.join(DEST, html);
  if (!fs.existsSync(p)) continue;
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('chrome-polyfill.js')) {
    const inject = '<script src="/social-ext/chrome-polyfill.js"></script>\n    <script src="/social-ext/background.js"></script>\n    ';
    s = s.replace(/(<script\s+type="module")/, inject + '$1');
    fs.writeFileSync(p, s);
  }
}

if (!polySaved) console.warn('⚠ chrome-polyfill.js отсутствовал — создай его (мост chrome.*). Без него расширение не стартует.');
console.log('✓ social-ext сгенерирован →', DEST);
