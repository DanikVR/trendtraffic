#!/usr/bin/env node
/**
 * predeploy.mjs
 *
 * Orchestrator: всё, что нужно сделать перед `npm run deploy` (или git push в
 * прод-ветку CI/CD). Цепочка:
 *
 *   1. check-i18n-coverage   — найти `t('foo.bar')` в коде без ключа в ru/common.json (fail).
 *   2. check-public-routes   — сверить router.tsx ↔ prerender.PUBLIC_ROUTES ↔ sitemap.PUBLIC_ROUTES (fail на orphan).
 *   3. propagate-new-keys    — добавить новые ключи во все 108 локалей с EN placeholder + needsRefresh.
 *   4. translate-locales     — Google API дотранслирует помеченные (если GOOGLE_TRANSLATE_API_KEY есть; иначе skip).
 *   5. review-locales-with-gemini  — Gemini-ревью локалей, исправляет КЛАССИЧЕСКИЕ ошибки
 *                                    Google Translate (контекст, бренды). С --skip-if-fresh
 *                                    гоняет только языки, где источник менялся → быстро/дёшево.
 *   6. patch-bundled-translations  — восстановить ручные переводы 10 bundled языков (pl/de/es/
 *                                    fr/ar/he/zh/pt/it/tr), если Gemini их затронул.
 *   7. sitemap               — пересобрать XML-карту сайта (4 route × 108 lang = 432 entries).
 *   8. vite build            — продакшн-сборка фронта.
 *   9. prerender             — 432 локализованных HTML с SEO в dist/.
 *
 * Опции:
 *   --skip-translate    пропустить шаг #4 (Google Translate)
 *   --skip-gemini       пропустить шаг #5 (Gemini review)
 *   --check-only        запустить только шаги #1 и #2, не менять файлы
 *   --no-build          пропустить шаги #7–#9 (только перевод и ревью)
 *
 * Возвращает exit code != 0 на любой fail — CI-friendly.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const SKIP_TRANSLATE = args.has('--skip-translate');
const SKIP_GEMINI = args.has('--skip-gemini');
const CHECK_ONLY = args.has('--check-only');
const NO_BUILD = args.has('--no-build');

function runStep(label, cmd, cmdArgs, { allowFail = false, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    console.log(`\n━━━ ${label} ━━━`);
    const child = spawn(cmd, cmdArgs, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...env },
    });
    child.on('exit', (code) => {
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (code === 0) {
        console.log(`✓ ${label} (${dt}s)`);
        resolve();
      } else {
        const msg = `✗ ${label} → exit ${code} (${dt}s)`;
        if (allowFail) { console.warn(msg); resolve(); }
        else reject(new Error(msg));
      }
    });
    child.on('error', reject);
  });
}

async function main() {
  console.log('🚀 VibeVox predeploy chain');
  console.log(`   • skip-translate: ${SKIP_TRANSLATE}`);
  console.log(`   • check-only:     ${CHECK_ONLY}`);
  console.log(`   • no-build:       ${NO_BUILD}`);

  // ── Шаг 1: i18n coverage ──────────────────────────────────────────────────
  await runStep('1/7  i18n coverage check', 'node', ['scripts/check-i18n-coverage.mjs']);

  // ── Шаг 2: public routes ──────────────────────────────────────────────────
  await runStep('2/7  public routes check', 'node', ['scripts/check-public-routes.mjs']);

  if (CHECK_ONLY) {
    console.log('\n✅ Check-only прошёл успешно. Файлы не менялись.');
    return;
  }

  // ── Шаг 3: propagate новые ключи во все 108 локалей ───────────────────────
  await runStep('3/7  propagate new keys → 108 locales', 'node', ['scripts/propagate-new-keys.mjs']);

  // .env.local fallback для GOOGLE_TRANSLATE_API_KEY / GEMINI_API_KEY:
  // скрипты сами читают .env.local, тут просто эвристика для skip-сообщений.
  const hasGoogleKey = !!process.env.GOOGLE_TRANSLATE_API_KEY || (await hasKeyInEnvLocal('GOOGLE_TRANSLATE_API_KEY'));
  const hasGeminiKey = !!process.env.GEMINI_API_KEY || (await hasKeyInEnvLocal('GEMINI_API_KEY')) || hasGoogleKey;

  // ── Шаг 4: translate (Google API) ─────────────────────────────────────────
  if (SKIP_TRANSLATE) {
    console.log('\n━━━ 4/9  translate-locales — SKIPPED (--skip-translate) ━━━');
  } else if (!hasGoogleKey) {
    console.log('\n━━━ 4/9  translate-locales — SKIPPED (GOOGLE_TRANSLATE_API_KEY не задан) ━━━');
    console.log('   Языки с needsRefresh останутся с English placeholder.');
  } else {
    await runStep('4/9  translate-locales (Google API)', 'node', ['scripts/translate-locales.mjs']);
  }

  // ── Шаг 5: Gemini-ревью локалей ───────────────────────────────────────────
  // С --skip-if-fresh — гоняет только языки, где source ru/common.json менялся
  // с момента последнего ревью (hash в _meta.geminiSourceHash). На деплое
  // без изменений в локалях этот шаг ~бесплатный.
  if (SKIP_GEMINI) {
    console.log('\n━━━ 5/9  gemini-review — SKIPPED (--skip-gemini) ━━━');
  } else if (!hasGeminiKey) {
    console.log('\n━━━ 5/9  gemini-review — SKIPPED (GEMINI_API_KEY не задан) ━━━');
    console.log('   Чтобы исправить классические ошибки Google Translate, добавьте');
    console.log('   GEMINI_API_KEY=… в apps/frontend/.env.local (получить: https://aistudio.google.com/).');
  } else {
    await runStep('5/9  gemini-review (skip-if-fresh)', 'node',
      ['scripts/review-locales-with-gemini.mjs', '--apply', '--skip-if-fresh', '--concurrency=4']);
  }

  // ── Шаг 6: восстановить ручные переводы 10 bundled языков ─────────────────
  // Patch-script — источник правды для качественных ручных переводов в pl, de,
  // es, fr, ar, he, zh, pt, it, tr. После Gemini-ревью он перекатывает наши
  // переводы поверх. Если Gemini не трогал эти языки (skip-if-fresh) —
  // patch тоже no-op, не страшно.
  await runStep('6/9  patch bundled translations (10 langs)', 'node',
    ['scripts/patch-bundled-translations.mjs']);

  if (NO_BUILD) {
    console.log('\n✅ Перевод и ревью обновлены. Build пропущен (--no-build).');
    return;
  }

  // ── Шаг 7: sitemap ────────────────────────────────────────────────────────
  await runStep('7/9  generate sitemap', 'node', ['scripts/sitemap.mjs']);

  // ── Шаг 8: vite build ─────────────────────────────────────────────────────
  await runStep('8/9  vite build', 'npx', ['vite', 'build']);

  // ── Шаг 9: prerender HTML × 108 языков ────────────────────────────────────
  await runStep('9/9  prerender × 108 lang', 'node', ['scripts/prerender.mjs']);

  console.log('\n🎉 predeploy завершён. dist/ готов к деплою.');
}

async function hasKeyInEnvLocal(varName) {
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const envText = await fs.readFile(path.join(ROOT, '.env.local'), 'utf-8');
    return new RegExp(`^${varName}\\s*=\\s*.+$`, 'm').test(envText);
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
