#!/usr/bin/env node
/**
 * scripts/sitemap.mjs
 *
 * Генерирует public/sitemap.xml — список ВСЕХ публичных URL × 108 локалей,
 * с правильными <xhtml:link rel="alternate" hreflang> для каждой записи.
 *
 * URL-формат: https://vibevox.app/{lang}/{path}  (path-prefix вариант)
 * Также добавляем x-default → / (без префикса = английский по умолчанию).
 *
 * Запуск:
 *   npm run sitemap
 *
 * Источник конфига:
 *   SITE_ORIGIN  → process.env.SITE_ORIGIN (default: https://vibevox.app)
 *   список языков → /public/locales/<lang>/ (берётся из ФС)
 *
 * Результат: public/sitemap.xml (попадает в финальную сборку как статика).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const OUTPUT_FILE = path.join(ROOT, 'public', 'sitemap.xml');

const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://vibevox.app').replace(/\/+$/, '');

// Публичные роуты, которые есть смысл индексировать.
// Защищённые JWT-роуты (/, /billing, /sip, /settings, /admin/*) сюда не входят —
// для бота они вернут 401/редирект на login.
const PUBLIC_ROUTES = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/auth/login', priority: 0.8, changefreq: 'monthly' },
  { path: '/auth/register', priority: 0.9, changefreq: 'monthly' },
  { path: '/auth/forgot-password', priority: 0.5, changefreq: 'yearly' },
];

const DEFAULT_LANG = 'en';

async function listLocales() {
  const entries = await fs.readdir(LOCALES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlWithLang(routePath, lang) {
  // Для дефолтного языка отдаём «голый» URL без префикса.
  if (lang === DEFAULT_LANG) {
    return `${SITE_ORIGIN}${routePath}`;
  }
  // Путь-префикс: /es/auth/login и т.д.
  const cleanPath = routePath === '/' ? '' : routePath;
  return `${SITE_ORIGIN}/${lang}${cleanPath || ''}`.replace(/\/+$/, '') || `${SITE_ORIGIN}/${lang}`;
}

async function generate() {
  const langs = await listLocales();
  const today = new Date().toISOString().slice(0, 10);

  const urlEntries = [];
  for (const route of PUBLIC_ROUTES) {
    for (const lang of langs) {
      const loc = urlWithLang(route.path, lang);
      // alternates — на все 108 + x-default
      const alts = langs.map((l) => {
        const href = escapeXml(urlWithLang(route.path, l));
        return `    <xhtml:link rel="alternate" hreflang="${l}" href="${href}" />`;
      });
      // x-default ведёт на дефолтную (английскую) версию
      alts.push(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(urlWithLang(route.path, DEFAULT_LANG))}" />`,
      );
      urlEntries.push(
        `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority.toFixed(1)}</priority>
${alts.join('\n')}
  </url>`,
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries.join('\n')}
</urlset>
`;

  await fs.writeFile(OUTPUT_FILE, xml, 'utf-8');
  const totalUrls = urlEntries.length;
  const sizeKb = (Buffer.byteLength(xml, 'utf-8') / 1024).toFixed(1);
  console.log(`✅ sitemap.xml: ${totalUrls} URL (${langs.length} языков × ${PUBLIC_ROUTES.length} роутов) — ${sizeKb} KB → ${path.relative(ROOT, OUTPUT_FILE)}`);
}

generate().catch((e) => {
  console.error('❌ sitemap generation failed:', e);
  process.exit(1);
});
