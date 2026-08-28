/**
 * Проверка проводки Flow Booster (side-panel) + пресетов Omni 1.1 и keyframe-переходов — без браузера:
 *   node apps/trendtraffic-extension/test/sidepanel-wiring.test.mjs
 *
 * Ловит класс ошибок, который в рантайме проявляется молчаливым падением на null:
 *   • id из els-массива sidepanel.js, которого нет в sidepanel.html;
 *   • ключ T('...') из sidepanel.js/content-flow.js, которого нет в _locales/en и _locales/ru
 *     (лейблы пресетов — литеральные T(), иначе харвестер translate-ext-runtime их не видит);
 *   • тип сообщения, который панель шлёт, а background не обрабатывает;
 *   • пресет с русским/многострочным текстом промпта (промпты моделям — EN, одна строка);
 *   • потерянные токены слотов кадров / 'omni' в modelHint / frames в цепочке submit.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ext = join(here, '..');
const read = (p) => readFileSync(join(ext, p), 'utf8');

const html = read('src/sidepanel.html');
const js = read('src/sidepanel.js');
const flow = read('src/content-flow.js');
const bg = read('src/background.js');
const en = JSON.parse(read('_locales/en/messages.json'));
const ru = JSON.parse(read('_locales/ru/messages.json'));

const all = (src, re) => [...src.matchAll(re)].map((m) => m[1]);
const uniq = (a) => [...new Set(a)];

const fails = [];
let pass = 0;
const must = (cond, msg) => { if (cond) pass++; else fails.push(msg); };

// ── 1. каждый id из els-массива существует в разметке ──────────────────────
const htmlIds = new Set(all(html, /\bid="([^"]+)"/g));
const elsBlock = (/const els = \{\};\s*\[([\s\S]*?)\]\.forEach/.exec(js) || [])[1] || '';
const elsIds = uniq(all(elsBlock, /'([A-Za-z0-9]+)'/g));
must(elsIds.length > 30, 'els-массив sidepanel.js не распарсился (регэксп в тесте устарел)');
for (const id of elsIds) {
  must(htmlIds.has(id), `sidepanel.js ждёт #${id}, которого нет в sidepanel.html`);
}

// ── 2. ключи T() из панели и content-flow есть в en и ru ───────────────────
for (const [name, src] of [['sidepanel.js', js], ['content-flow.js', flow]]) {
  for (const k of uniq(all(src, /\bT\(\s*'([a-zA-Z0-9_]+)'/g))) {
    must(k in en, `ключ ${k} из ${name} отсутствует в _locales/en`);
    must(k in ru, `ключ ${k} из ${name} отсутствует в _locales/ru`);
  }
}

// ── 3. каждый тип сообщения панели обрабатывается background ───────────────
const bgCases = new Set(all(bg, /case '([a-z-]+)'/g));
for (const t of uniq(all(js, /\bbg\(\{\s*type:\s*'([a-z-]+)'/g))) {
  must(bgCases.has(t), `панель шлёт '${t}', а background.js его не обрабатывает`);
}

// ── 4. пресеты Omni: лейбл — литеральный T(), промпты — EN в одну строку ───
const presetsBlock = (/const OMNI_PRESETS = \[([\s\S]*?)\n {2}\];/.exec(js) || [])[1] || '';
const labels = all(presetsBlock, /label: \(\) => T\('([a-zA-Z0-9_]+)'/g);
must(labels.length >= 8, `пресетов Omni меньше 8 (${labels.length}) — блок распарсился не весь?`);
const lines = all(presetsBlock, /line: "([^"]+)"/g);
const suffixes = all(presetsBlock, /suffix: "([^"]+)"/g);
must(lines.length === labels.length, `у ${labels.length} пресетов ${lines.length} line — где-то потерян`);
must(suffixes.length === labels.length, `у ${labels.length} пресетов ${suffixes.length} suffix — где-то потерян`);
for (const [what, arr] of [['line', lines], ['suffix', suffixes]]) {
  for (const s of arr) {
    must(!/[Ѐ-ӿ]/.test(s), `пресет ${what} содержит кириллицу (промпты моделям — EN): «${s.slice(0, 50)}…»`);
    must(!s.includes('\\n'), `пресет ${what} многострочный (textarea — один промпт на строку): «${s.slice(0, 50)}…»`);
  }
}

// ── 5. разметка: модель Omni и элементы новых секций ───────────────────────
must(html.includes('value="Omni 1.1 Flash"'), 'в #model нет опции «Omni 1.1 Flash»');
must(/id="omniChips"/.test(html) && /id="kfPairs"/.test(html), 'нет контейнеров omniChips/kfPairs в разметке');

// ── 6. content-flow: токены слотов, 'omni' в modelHint, frames в submit ────
must(/modelHint:\s*\[[^\]]*'omni'/.test(flow), "в BATCH.modelHint нет токена 'omni'");
const slotBlock = (/frameSlotTokens:\s*\{([\s\S]*?)\},/.exec(flow) || [])[1] || '';
must(/first:\s*\[[^\]]*'first frame'/.test(slotBlock), 'BATCH.frameSlotTokens.first пуст или без «first frame»');
must(/last:\s*\[[^\]]*'last frame'/.test(slotBlock), 'BATCH.frameSlotTokens.last пуст или без «last frame»');
must(/async function attachFrames\(/.test(flow), 'в content-flow.js нет attachFrames()');
must(/it\.frames/.test(flow), 'flowSubmit не читает it.frames — кадры не дойдут до Flow');
must(/frames:\s*item\.frames \|\| null/.test(js), 'панель не кладёт frames в payload flow-submit');

// ── итог ───────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`✗ ${fails.length} провалов (ок: ${pass})`);
  for (const f of fails) console.error('  • ' + f);
  process.exit(1);
}
console.log(`✓ sidepanel-wiring: ${pass} проверок ок`);
