#!/usr/bin/env node
/**
 * scripts/lighthouse-audit.mjs
 *
 * Прогоняет Lighthouse для нескольких ключевых страниц и пишет JSON-репорт.
 *
 * Требует:
 *   - запущенный preview-сервер (vite preview) на http://localhost:4173
 *     ИЛИ задать LIGHTHOUSE_URL=http://localhost:3000
 *   - установленный lighthouse + chrome-launcher как devDependency
 *     (npm install -D lighthouse chrome-launcher)
 *
 * Запуск:
 *   npm run lighthouse
 *
 * Результат: reports/lighthouse-<timestamp>.json + краткая сводка в консоль.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');

const BASE_URL = process.env.LIGHTHOUSE_URL || 'http://localhost:4173';

// Страницы для аудита.
// Главное: публичные роуты + один защищённый (увидим что бот видит).
const TARGETS = [
  { name: 'home',           url: '/' },
  { name: 'login',          url: '/auth/login' },
  { name: 'register',       url: '/auth/register' },
  { name: 'forgot',         url: '/auth/forgot-password' },
  { name: 'home-es',        url: '/es' },
  { name: 'login-zh',       url: '/zh/auth/login' },
];

async function runLighthouse() {
  let lighthouse, launchChromeAndRunLighthouse;
  try {
    lighthouse = (await import('lighthouse')).default;
    launchChromeAndRunLighthouse = (await import('chrome-launcher')).launch;
  } catch (e) {
    console.error('❌ lighthouse / chrome-launcher не установлены.');
    console.error('   Установи: npm install -D lighthouse chrome-launcher');
    process.exit(1);
  }

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T.]/g, '-').slice(0, 19);
  const summary = [];

  const chrome = await launchChromeAndRunLighthouse({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });

  try {
    for (const target of TARGETS) {
      const fullUrl = `${BASE_URL}${target.url}`;
      console.log(`\n🔍 ${target.name} → ${fullUrl}`);

      const runnerResult = await lighthouse(fullUrl, {
        logLevel: 'error',
        output: 'json',
        port: chrome.port,
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      });

      const lhr = runnerResult.lhr;
      const scores = {
        performance: Math.round((lhr.categories.performance?.score || 0) * 100),
        accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
        bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
        seo: Math.round((lhr.categories.seo?.score || 0) * 100),
      };

      summary.push({ name: target.name, url: target.url, ...scores });

      // Сохраняем полный JSON отчёт
      const reportFile = path.join(REPORTS_DIR, `lighthouse-${stamp}-${target.name}.json`);
      await fs.writeFile(reportFile, runnerResult.report, 'utf-8');
      console.log(
        `   📊 perf=${scores.performance}  a11y=${scores.accessibility}  bp=${scores.bestPractices}  seo=${scores.seo}`,
      );
    }
  } finally {
    await chrome.kill();
  }

  // Сводка
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`📋 LIGHTHOUSE SUMMARY (${stamp})`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('Page'.padEnd(20), 'Perf', 'A11y', 'BP', 'SEO');
  for (const r of summary) {
    console.log(
      r.name.padEnd(20),
      String(r.performance).padStart(4),
      String(r.accessibility).padStart(4),
      String(r.bestPractices).padStart(3),
      String(r.seo).padStart(4),
    );
  }

  const avgSeo = summary.reduce((s, r) => s + r.seo, 0) / summary.length;
  console.log(`\n→ Avg SEO score: ${avgSeo.toFixed(1)}`);

  // Сохраняем сводку отдельно
  await fs.writeFile(
    path.join(REPORTS_DIR, `lighthouse-${stamp}-summary.json`),
    JSON.stringify({ stamp, baseUrl: BASE_URL, results: summary }, null, 2),
    'utf-8',
  );
  console.log(`\n📁 Reports: ${path.relative(ROOT, REPORTS_DIR)}/`);
}

runLighthouse().catch((e) => {
  console.error('❌ lighthouse run failed:', e);
  process.exit(1);
});
