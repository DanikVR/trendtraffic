#!/usr/bin/env node
/**
 * scripts/prerender.mjs
 *
 * Head-injection prerender для SEO.
 *
 * Что делает:
 *   1. Берёт dist/index.html (результат vite build).
 *   2. Для каждой пары (язык, публичный роут) подставляет:
 *      - <title> на нужном языке (из public/locales/{lang}/common.json → seo.title)
 *      - <meta description, keywords, content-language>
 *      - Open Graph (og:title/description/locale/url)
 *      - Twitter Card
 *      - canonical
 *      - <link rel="alternate" hreflang> для всех 108 языков + x-default
 *      - <html lang/dir>
 *   3. Сохраняет в dist/{lang}/{path}/index.html.
 *
 * Зачем:
 *   Бот, который НЕ рендерит JS (Bing, Yandex, соц-сети), получает правильно
 *   локализованный HEAD сразу при visit URL `/es/billing`. Google рендерит JS,
 *   но и для него ускоряем первичную индексацию.
 *
 * Запуск:
 *   npm run prerender   (запускается автоматически в build:full)
 *
 * Конфигурация:
 *   SITE_ORIGIN  → process.env.SITE_ORIGIN (default: https://vibevox.app)
 *   PUBLIC_ROUTES — массив роутов ниже.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const SOURCE_HTML = path.join(DIST_DIR, 'index.html');

const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://vibevox.app').replace(/\/+$/, '');
const DEFAULT_LANG = 'en';

// Языки с письмом справа налево
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi']);

// Публичные роуты, для которых имеет смысл генерировать локализованные HTML.
// Защищённые JWT-роуты сюда не входят — бот их не индексирует.
//
// Каждый роут получает свой набор meta (title/description). Если нет специфичных
// ключей в common.json — используется глобальный seo.title/description.
const PUBLIC_ROUTES = [
  { path: '/',                       titleKey: 'seo.title',                descKey: 'seo.description' },
  { path: '/auth/login',             titleKey: 'seo.title',                descKey: 'seo.description' },
  { path: '/auth/register',          titleKey: 'seo.title',                descKey: 'seo.description' },
  { path: '/auth/forgot-password',   titleKey: 'seo.title',                descKey: 'seo.description' },
];

function getKey(obj, dottedKey, fallback = '') {
  return dottedKey.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj) ?? fallback;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function urlWithLang(routePath, lang) {
  if (lang === DEFAULT_LANG) return `${SITE_ORIGIN}${routePath}`;
  const cleanPath = routePath === '/' ? '' : routePath;
  return `${SITE_ORIGIN}/${lang}${cleanPath}`;
}

/** Рендерит блок <link rel="alternate" hreflang> для всех языков. */
function renderHreflangs(routePath, langs) {
  const lines = langs.map(
    (l) => `<link rel="alternate" hreflang="${l}" href="${escapeHtml(urlWithLang(routePath, l))}">`,
  );
  lines.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(urlWithLang(routePath, DEFAULT_LANG))}">`);
  return lines.join('\n    ');
}

/** Заменяет meta-теги в HTML на локализованные. */
function injectSeo(html, { lang, dir, title, description, keywords, canonical, hreflangBlock, ogImage }) {
  let out = html;

  // <html lang/dir>
  out = out.replace(/<html[^>]*>/, `<html lang="${escapeHtml(lang)}" dir="${dir}" class="dark">`);

  // <title>
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);

  // <meta name="description"> (заменяем существующий)
  out = out.replace(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}">`,
  );
  // если не было — добавим
  if (!/<meta\s+name="description"/i.test(out)) {
    out = out.replace(/<\/head>/, `  <meta name="description" content="${escapeHtml(description)}">\n  </head>`);
  }

  // <meta name="keywords">
  out = out.replace(
    /<meta\s+name="keywords"[^>]*>/i,
    `<meta name="keywords" content="${escapeHtml(keywords)}">`,
  );

  // <meta http-equiv="content-language">
  if (/<meta\s+http-equiv="content-language"/i.test(out)) {
    out = out.replace(
      /<meta\s+http-equiv="content-language"[^>]*>/i,
      `<meta http-equiv="content-language" content="${escapeHtml(lang)}">`,
    );
  } else {
    out = out.replace(/<\/head>/, `  <meta http-equiv="content-language" content="${escapeHtml(lang)}">\n  </head>`);
  }

  // <link rel="canonical">
  if (/<link\s+rel="canonical"/i.test(out)) {
    out = out.replace(
      /<link\s+rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    );
  } else {
    out = out.replace(/<\/head>/, `  <link rel="canonical" href="${escapeHtml(canonical)}">\n  </head>`);
  }

  // Open Graph
  const ogTags = [
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:locale" content="${escapeHtml(lang)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="VibeVox">`,
  ];
  // вырезаем старые og:* и twitter:*
  out = out.replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, '');
  out = out.replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, '');

  const twitterTags = [
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}">`,
  ];

  // Вставляем все теги вместе перед </head>
  const seoBlock = [
    ...ogTags,
    ...twitterTags,
    hreflangBlock,
  ].join('\n    ');

  out = out.replace(/<\/head>/, `    ${seoBlock}\n  </head>`);

  return out;
}

async function listLocales() {
  const entries = await fs.readdir(LOCALES_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

async function loadCommon(lang) {
  try {
    const raw = await fs.readFile(path.join(LOCALES_DIR, lang, 'common.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  let sourceHtml;
  try {
    sourceHtml = await fs.readFile(SOURCE_HTML, 'utf-8');
  } catch (e) {
    console.error(`❌ Не нашёл ${SOURCE_HTML}. Сначала запусти 'npm run build'.`);
    process.exit(1);
  }

  const langs = await listLocales();
  const enCommon = await loadCommon('en');
  const ogImage = `${SITE_ORIGIN}/vibevox-logo-light.png`;

  let generated = 0;
  for (const lang of langs) {
    const common = (await loadCommon(lang)) || enCommon;
    if (!common) continue;
    const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';

    for (const route of PUBLIC_ROUTES) {
      const title = getKey(common, route.titleKey, getKey(enCommon, route.titleKey, 'VibeVox'));
      const description = getKey(common, route.descKey, getKey(enCommon, route.descKey, ''));
      const keywords = getKey(common, 'seo.keywords', getKey(enCommon, 'seo.keywords', ''));
      const canonical = urlWithLang(route.path, lang);
      const hreflangBlock = renderHreflangs(route.path, langs);

      const html = injectSeo(sourceHtml, {
        lang,
        dir,
        title,
        description,
        keywords,
        canonical,
        hreflangBlock,
        ogImage,
      });

      // Выходной путь:
      //   /         → dist/{lang}/index.html
      //   /auth/login → dist/{lang}/auth/login/index.html
      // Для DEFAULT_LANG копируем index.html в dist/index.html (там уже есть).
      // Для остальных языков создаём подпапку.
      const langDir =
        route.path === '/'
          ? path.join(DIST_DIR, lang)
          : path.join(DIST_DIR, lang, ...route.path.split('/').filter(Boolean));
      await fs.mkdir(langDir, { recursive: true });
      await fs.writeFile(path.join(langDir, 'index.html'), html, 'utf-8');
      generated++;
    }
  }

  console.log(`✅ prerender: ${generated} HTML файлов (${langs.length} языков × ${PUBLIC_ROUTES.length} роутов) → dist/{lang}/...`);
}

main().catch((e) => {
  console.error('❌ prerender failed:', e);
  process.exit(1);
});
