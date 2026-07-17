#!/usr/bin/env node
/**
 * scripts/seo-marketing.mjs
 *
 * Пер-страничная SEO/соц-мета для МАРКЕТИНГОВЫХ роутов trendtraffic.pro.
 *
 * Проблема: SPA отдаёт ОДИН dist/index.html на все роуты, поэтому соц-скрейперы
 * (Telegram/WhatsApp/Facebook/X/LinkedIn — JS НЕ исполняют) на /wiki, /about,
 * /privacy… видят мета ЛЕНДИНГА. Google рендерит JS и берёт per-page Helmet, а
 * скрейперы — нет.
 *
 * Решение: для каждого роута пишем ПЛОСКИЙ dist/{route}.html с подменённым HEAD
 * (title/description/canonical/OG/Twitter + per-page JSON-LD). Внутри — тот же
 * JS-бандл: SPA грузится и рендерит нужный роут как обычно.
 *
 * Активация в nginx (одна строка, БЕЗ редиректа и слэша):
 *   try_files $uri $uri.html $uri/ /index.html;
 * Тогда /wiki отдаёт dist/wiki.html (свою мета), а не общий index.html.
 * Пока строку не добавили — файлы просто лежат, поведение сайта не меняется
 * (fallback на /index.html как сейчас) — нулевой риск.
 *
 * Запуск: npm run seo:pages  (после vite build; входит в build:seo).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const ORIGIN = 'https://trendtraffic.pro';
const OG_IMAGE = `${ORIGIN}/og-image.png`;

/** Роут → уникальные заголовок/описание (EN — база; соц-скрейперы читают её). */
const PAGES = {
  '/wiki': {
    name: 'Wiki',
    type: 'article',
    title: 'TrendTraffic Wiki — Guides & Documentation',
    desc: 'Step-by-step guides for TrendTraffic: first launch and keys, finding viral trends, the UGC studio (4 video modes), storyboard auto-edit, Google Flow, NotebookLM, media files and the publisher.',
  },
  '/about': {
    name: 'About',
    type: 'website',
    title: 'About TrendTraffic — the AI content engine',
    desc: 'TrendTraffic finds viral trends on TikTok, Instagram and YouTube, turns them into UGC videos with AI avatars, and auto-publishes them on a schedule — in 108 languages, with up to 4× cheaper AI.',
  },
  '/privacy': {
    name: 'Privacy Policy',
    type: 'website',
    title: 'Privacy Policy — TrendTraffic',
    desc: 'How TrendTraffic collects, uses and protects your data. A GDPR-compliant privacy policy for the TrendTraffic platform.',
  },
  '/terms': {
    name: 'Terms of Service',
    type: 'website',
    title: 'Terms of Service — TrendTraffic',
    desc: 'The terms that govern the use of the TrendTraffic platform: subscriptions, acceptable use and your rights.',
  },
  '/cookies': {
    name: 'Cookie Policy',
    type: 'website',
    title: 'Cookie Policy — TrendTraffic',
    desc: 'How TrendTraffic uses cookies and similar technologies, and how you can manage or withdraw your consent at any time.',
  },
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Заменяет/вставляет один тег по regex. */
function replaceTag(html, re, tag) {
  return re.test(html) ? html.replace(re, tag) : html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function buildJsonLd(routePath, page) {
  const url = `${ORIGIN}${routePath}`;
  const webPage = {
    '@type': page.type === 'article' ? 'TechArticle' : 'WebPage',
    '@id': `${url}#page`,
    name: page.title,
    headline: page.title,
    description: page.desc,
    url,
    inLanguage: 'en',
    isPartOf: { '@id': `${ORIGIN}/#site` },
    publisher: { '@id': `${ORIGIN}/#org` },
    primaryImageOfPage: OG_IMAGE,
  };
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: page.name, item: url },
    ],
  };
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': [webPage, breadcrumb] });
}

function injectSeo(baseHtml, routePath, page) {
  const url = `${ORIGIN}${routePath}`;
  const title = esc(page.title);
  const desc = esc(page.desc);
  let out = baseHtml;

  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  out = replaceTag(out, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${desc}">`);
  out = replaceTag(out, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${url}">`);

  out = replaceTag(out, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${title}">`);
  out = replaceTag(out, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${desc}">`);
  out = replaceTag(out, /<meta\s+property="og:type"[^>]*>/i, `<meta property="og:type" content="${page.type}">`);
  // og:url в базовом index.html нет (общий для двух хостов) — вставим свой.
  out = replaceTag(out, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${url}">`);

  out = replaceTag(out, /<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${title}">`);
  out = replaceTag(out, /<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${desc}">`);

  // Per-page JSON-LD (WebPage/TechArticle + BreadcrumbList) — В ДОПОЛНЕНИЕ к
  // глобальному @graph (SoftwareApplication/Organization/WebSite) из index.html.
  const ld = `<script type="application/ld+json">${buildJsonLd(routePath, page)}</script>`;
  out = out.replace(/<\/head>/i, `    ${ld}\n  </head>`);

  return out;
}

async function main() {
  const baseHtml = await fs.readFile(path.join(DIST, 'index.html'), 'utf-8');
  let n = 0;
  for (const [routePath, page] of Object.entries(PAGES)) {
    // Плоский файл: /wiki → dist/wiki.html (nginx try_files $uri.html).
    const rel = routePath.replace(/^\//, '');
    await fs.writeFile(path.join(DIST, `${rel}.html`), injectSeo(baseHtml, routePath, page), 'utf-8');
    n++;
  }
  console.log(`✅ seo-marketing: ${n} per-route HTML (dist/{route}.html) для соц-скрейперов`);
}

main().catch((e) => { console.error('❌ seo-marketing failed:', e); process.exit(1); });
