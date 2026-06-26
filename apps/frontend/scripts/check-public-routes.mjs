#!/usr/bin/env node
/**
 * check-public-routes.mjs
 *
 * Pre-deploy guard #2: вытаскивает все `path: '...'` из src/router.tsx и сверяет
 * со списком PUBLIC_ROUTES в scripts/prerender.mjs (и scripts/sitemap.mjs).
 * Отчитывается, какие маршруты:
 *   • есть в роутере, отсутствуют в PUBLIC_ROUTES → потенциальные кандидаты на
 *     индексирование (warn, не fail — это решение разработчика);
 *   • есть в PUBLIC_ROUTES, но удалены из роутера → почистить, иначе сгенерим
 *     404-HTML (fail).
 *
 * Пропускает динамические сегменты (:id), защищённые роуты под RequireAuth и
 * админский /admin/*.
 *
 * Опции:
 *   --warn-only   не падать
 *   --json        машинно-читаемый вывод
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ROUTER_FILE = path.join(ROOT, 'src', 'router.tsx');
const PRERENDER_FILE = path.join(ROOT, 'scripts', 'prerender.mjs');
const SITEMAP_FILE = path.join(ROOT, 'scripts', 'sitemap.mjs');

const args = new Set(process.argv.slice(2));
const WARN_ONLY = args.has('--warn-only');
const JSON_OUT = args.has('--json');

/** Достаёт публичные роуты из роутера: path: '/...', не под RequireAuth. */
function extractPublicRoutes(source) {
  const routes = [];
  // Делим на блоки по RequireAuth — всё после первого RequireAuth внутри объекта
  // считаем «защищённой ветвью» и игнорируем.
  const requireAuthIdx = source.indexOf('<RequireAuth />');
  const publicSection = requireAuthIdx > 0 ? source.slice(0, requireAuthIdx) : source;

  const re = /path:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(publicSection))) {
    const p = m[1];
    if (p.includes(':')) continue;      // динамические /room/:roomId
    if (p === '*') continue;             // 404 fallback
    if (p.includes('callback')) continue; // /auth/google/callback — техн.
    routes.push(p);
  }
  return [...new Set(routes)];
}

/** Достаёт PUBLIC_ROUTES из prerender.mjs / sitemap.mjs. */
function extractPrerenderRoutes(source) {
  const routes = [];
  // PUBLIC_ROUTES = [ { path: '/...', ... }, ... ]
  // или просто массив строк
  const block = source.match(/PUBLIC_ROUTES\s*=\s*\[([\s\S]*?)\]/);
  if (!block) return routes;
  const re = /path:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(block[1]))) {
    routes.push(m[1]);
  }
  return [...new Set(routes)];
}

async function main() {
  const routerSrc = await fs.readFile(ROUTER_FILE, 'utf-8');
  const prerenderSrc = await fs.readFile(PRERENDER_FILE, 'utf-8');
  const sitemapSrc = await fs.readFile(SITEMAP_FILE, 'utf-8');

  const routerPublic = extractPublicRoutes(routerSrc);
  const prerenderPublic = extractPrerenderRoutes(prerenderSrc);
  const sitemapPublic = extractPrerenderRoutes(sitemapSrc);

  const inRouter = new Set(routerPublic);
  const inPrerender = new Set(prerenderPublic);
  const inSitemap = new Set(sitemapPublic);

  const missingInPrerender = [...inRouter].filter((r) => !inPrerender.has(r));
  const missingInSitemap = [...inRouter].filter((r) => !inSitemap.has(r));
  const orphanInPrerender = [...inPrerender].filter((r) => !inRouter.has(r));
  const orphanInSitemap = [...inSitemap].filter((r) => !inRouter.has(r));

  if (JSON_OUT) {
    console.log(JSON.stringify({
      routerPublic, prerenderPublic, sitemapPublic,
      missingInPrerender, missingInSitemap,
      orphanInPrerender, orphanInSitemap,
    }, null, 2));
  } else {
    console.log(`📊 Public routes coverage`);
    console.log(`   • В роутере (public):     ${routerPublic.length} — ${routerPublic.join(', ')}`);
    console.log(`   • В prerender.PUBLIC_ROUTES: ${prerenderPublic.length}`);
    console.log(`   • В sitemap.PUBLIC_ROUTES:   ${sitemapPublic.length}`);
    if (missingInPrerender.length === 0 && missingInSitemap.length === 0 &&
        orphanInPrerender.length === 0 && orphanInSitemap.length === 0) {
      console.log(`   ✅ Все списки синхронизированы.`);
    } else {
      if (missingInPrerender.length) {
        console.log(`\n   ⚠ Есть в роутере, нет в prerender.mjs (не будут SEO-индексироваться):`);
        for (const r of missingInPrerender) console.log(`       - ${r}`);
      }
      if (missingInSitemap.length) {
        console.log(`\n   ⚠ Есть в роутере, нет в sitemap.mjs:`);
        for (const r of missingInSitemap) console.log(`       - ${r}`);
      }
      if (orphanInPrerender.length) {
        console.log(`\n   ❌ Есть в prerender.mjs, нет в роутере (сгенерируется 404-HTML):`);
        for (const r of orphanInPrerender) console.log(`       - ${r}`);
      }
      if (orphanInSitemap.length) {
        console.log(`\n   ❌ Есть в sitemap.mjs, нет в роутере (битая ссылка для бота):`);
        for (const r of orphanInSitemap) console.log(`       - ${r}`);
      }
      console.log(`\nКак править: scripts/prerender.mjs и scripts/sitemap.mjs — массивы PUBLIC_ROUTES.`);
    }
  }

  const hasErrors = orphanInPrerender.length > 0 || orphanInSitemap.length > 0;
  if (hasErrors && !WARN_ONLY) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(2);
});
