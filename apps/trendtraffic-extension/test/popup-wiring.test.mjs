/**
 * Проверка проводки popup — без браузера:
 *   node apps/trendtraffic-extension/test/popup-wiring.test.mjs
 *
 * Ловит класс ошибок, который в рантайме проявляется молчаливым падением на null:
 *   • $('id') в popup.js, которого нет в popup.html;
 *   • data-i18n / data-i18n-title / data-i18n-ph, которых нет в _locales/en и _locales/ru;
 *   • ключ T('...') в popup.js, которого нет в локалях;
 *   • тип сообщения, который popup шлёт, а background не обрабатывает.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ext = join(here, '..');
const read = (p) => readFileSync(join(ext, p), 'utf8');

const html = read('src/popup.html');
const js = read('src/popup.js');
const bg = read('src/background.js');
const en = JSON.parse(read('_locales/en/messages.json'));
const ru = JSON.parse(read('_locales/ru/messages.json'));

const all = (src, re) => [...src.matchAll(re)].map((m) => m[1]);
const uniq = (a) => [...new Set(a)];

const fails = [];
let pass = 0;
const must = (cond, msg) => { if (cond) pass++; else fails.push(msg); };

// ── 1. каждый $('id') существует в разметке ────────────────────────────────
const htmlIds = new Set(all(html, /\bid="([^"]+)"/g));
for (const id of uniq(all(js, /\$\('([^']+)'\)/g))) {
  must(htmlIds.has(id), `popup.js обращается к #${id}, которого нет в popup.html`);
}

// ── 2. ключи i18n из разметки есть в en и ru ───────────────────────────────
const markupKeys = uniq([
  ...all(html, /data-i18n="([^"]+)"/g),
  ...all(html, /data-i18n-title="([^"]+)"/g),
  ...all(html, /data-i18n-ph="([^"]+)"/g),
]);
for (const k of markupKeys) {
  must(k in en, `ключ ${k} из разметки отсутствует в _locales/en`);
  must(k in ru, `ключ ${k} из разметки отсутствует в _locales/ru`);
}

// ── 3. ключи T('...') из кода есть в локалях ───────────────────────────────
const codeKeys = uniq(all(js, /\bT\('([a-z0-9_]+)'/gi));
for (const k of codeKeys) {
  must(k in en, `ключ ${k} из popup.js отсутствует в _locales/en`);
  must(k in ru, `ключ ${k} из popup.js отсутствует в _locales/ru`);
}

// ── 4. каждое отправляемое сообщение обрабатывается фоном ──────────────────
// tt-popup-progress шлёт САМ фон в popup — его обработка на стороне popup, это не дыра.
const SENT_BY_BG = new Set(['tt-popup-progress']);
const sentTypes = uniq(all(js, /type:\s*'(tt-popup-[a-z-]+|nlm-[a-z-]+)'/g));
for (const t of sentTypes) {
  if (SENT_BY_BG.has(t)) continue;
  must(bg.includes(`case '${t}'`), `popup шлёт '${t}', но в background.js нет case для него`);
}

// ── 5. манифест указывает на popup ─────────────────────────────────────────
const mf = JSON.parse(read('manifest.json'));
must(mf.action && mf.action.default_popup === 'src/popup.html', 'manifest.action.default_popup не указывает на src/popup.html');
must((mf.permissions || []).includes('tabs'), 'нет права tabs — список вкладок браузера не соберётся');

// ── 6. локали не разъехались по составу ────────────────────────────────────
const popKeys = Object.keys(en).filter((k) => k.startsWith('pop_'));
must(popKeys.length >= 30, `ожидали ≥30 ключей pop_*, нашли ${popKeys.length}`);
for (const loc of readdirSync(join(ext, '_locales'))) {
  const data = JSON.parse(read(`_locales/${loc}/messages.json`));
  const missing = popKeys.filter((k) => !(k in data));
  must(missing.length === 0, `в локали ${loc} нет ключей: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`);
}

console.log(`\npopup-wiring: пройдено ${pass}, провалено ${fails.length}`);
if (fails.length) {
  console.error('\nПРОВАЛЫ:');
  for (const f of fails) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('✓ проводка popup целая\n');
