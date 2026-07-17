#!/usr/bin/env node
/**
 * scripts/sitemap.mjs
 *
 * Генерирует public/sitemap.xml для TrendTraffic.
 *
 * Модель URL (с 17.07.2026): БЕЗ языковых префиксов. Приложение — одно-URL
 * SPA: язык выбирается i18next-детектором по браузеру, отдельных /{lang}/-роутов
 * в роутере НЕТ (маркетинговый catch-all редиректит на «/»). Поэтому sitemap
 * перечисляет только реальные канонические URL, а не 108 языковых зеркал.
 *
 * Два хоста (nginx отдаёт один и тот же dist):
 *   https://trendtraffic.pro      — лендинг + легалки (MARKETING_ROUTES)
 *   https://app.trendtraffic.pro  — публичные страницы приложения (/billing, /auth/*)
 * Кросс-хост URL в одном sitemap валидны: robots.txt на ОБОИХ хостах ссылается
 * на этот файл (cross submission, sitemaps.org).
 *
 * Запуск:  npm run sitemap
 * Оверрайды: MARKETING_ORIGIN / APP_ORIGIN (env).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT, 'public', 'sitemap.xml');

const MARKETING_ORIGIN = (process.env.MARKETING_ORIGIN || 'https://trendtraffic.pro').replace(/\/+$/, '');
const APP_ORIGIN = (process.env.APP_ORIGIN || 'https://app.trendtraffic.pro').replace(/\/+$/, '');

// Публичные страницы. Защищённые JWT-роуты приложения не включаем.
const ROUTES = [
  // Маркетинговый хост (MARKETING_ROUTES в router.tsx)
  { origin: MARKETING_ORIGIN, path: '/',         priority: 1.0, changefreq: 'weekly' },
  { origin: MARKETING_ORIGIN, path: '/about',    priority: 0.3, changefreq: 'monthly' },
  { origin: MARKETING_ORIGIN, path: '/wiki',     priority: 0.3, changefreq: 'monthly' },
  { origin: MARKETING_ORIGIN, path: '/privacy',  priority: 0.3, changefreq: 'yearly' },
  { origin: MARKETING_ORIGIN, path: '/terms',    priority: 0.3, changefreq: 'yearly' },
  { origin: MARKETING_ORIGIN, path: '/cookies',  priority: 0.3, changefreq: 'yearly' },
  // Публичные страницы приложения
  { origin: APP_ORIGIN, path: '/billing',       priority: 0.8, changefreq: 'weekly' },
  { origin: APP_ORIGIN, path: '/auth/register', priority: 0.7, changefreq: 'monthly' },
  { origin: APP_ORIGIN, path: '/auth/login',    priority: 0.5, changefreq: 'monthly' },
];

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function generate() {
  const today = new Date().toISOString().slice(0, 10);
  const urlEntries = ROUTES.map((r) => `  <url>
    <loc>${escapeXml(`${r.origin}${r.path === '/' ? '/' : r.path}`)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>
`;

  await fs.writeFile(OUTPUT_FILE, xml, 'utf-8');
  console.log(`✅ sitemap.xml: ${ROUTES.length} URL → ${path.relative(ROOT, OUTPUT_FILE)}`);
}

generate().catch((e) => {
  console.error('❌ sitemap generation failed:', e);
  process.exit(1);
});
