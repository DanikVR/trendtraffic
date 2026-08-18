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

// ── 7. защита единственной вкладки NotebookLM ──────────────────────────────
// Фон в node не исполнить (он весь на chrome.*), поэтому здесь СТРУКТУРНЫЕ проверки: они не
// доказывают поведение, но не дают молча снести защиту. Сам сценарий разобран в ревью: два
// импорта параллельно уводили вкладку, а источник кладётся в ТОТ блокнот, что открыт, — остаток
// пакета уезжал в чужой блокнот. Это порча данных, поэтому три рубежа, и все три под охраной.
{
  const cn = read('src/content-notebook.js');

  // рубеж 1: второй импорт отбивается ДО навигации вкладки
  const addFn = bg.slice(bg.indexOf('async function popupAddSources'), bg.indexOf('async function popupBrowserTabs'));
  must(addFn.includes('tabLockedNow()'), 'popupAddSources не проверяет замок вкладки');
  // сверяем с местом ВЫЗОВА, а не с любым упоминанием: в комментарии рядом слово встречается выше
  must(addFn.indexOf('tabLockedNow()') < addFn.indexOf('ensureNotebookTab('),
    'проверка замка стоит ПОСЛЕ ensureNotebookTab() — вкладку уведёт раньше отказа');
  must(addFn.includes('await lockTab()'), 'popupAddSources не берёт замок');
  must(addFn.includes('unlockTab'), 'popupAddSources не снимает замок');
  must(/finally\s*{[^}]*unlockTab/.test(addFn), 'замок снимается не в finally — исключение оставит вкладку запертой');

  // рубеж 2: серверный цикл уважает замок
  must(/async function runNlmAction[\s\S]{0,400}tabLockedNow\(\)/.test(bg), 'runNlmAction не проверяет замок');
  must(/async function _runNlmTask[\s\S]{0,400}tabLockedNow\(\)/.test(bg), '_runNlmTask не проверяет замок');

  // рубеж 3: сам add-source отказывается класть материал в чужой блокнот
  const addSrc = cn.slice(cn.indexOf('async function addSource'), cn.indexOf('async function addSource') + 900);
  must(addSrc.includes('wrong-notebook'), 'addSource не сверяет открытый блокнот с запрошенным');

  // замок обязан протухать сам, иначе смерть service worker запрёт вкладку навсегда
  must(bg.includes('TAB_LOCK_MS'), 'у замка нет дедлайна');
  must(/tabBusyUntil:\s*STATE\.tabBusyUntil/.test(bg), 'tabBusyUntil не сохраняется в saveState');
  must(bg.includes("'tabBusyUntil'"), 'tabBusyUntil не восстанавливается в loadState');
  // а прогресс, наоборот, восстанавливать НЕЛЬЗЯ: цикл жил в памяти и умер вместе с воркером
  must(!/STATE\.popupAdding\s*=\s*s\.popupAdding/.test(bg), 'popupAdding восстанавливается из storage — покажет пакет, которого нет');

  // итог пакета уходит широковещательно: ответ адресован окну, которое могло закрыться
  must(addFn.includes("'tt-popup-done'"), 'нет широковещательного итога — переоткрытый popup зависнет на N/N');
  must(js.includes("msg.type === 'tt-popup-done'"), 'popup не слушает итог пакета');
}

// ── 8. клик по иконке обязан открывать popup, а не боковую панель ──────────
// setPanelBehavior запоминается в ПРОФИЛЕ и переживает обновление расширения: у всех,
// кто ставил версии до 1.6.4, там лежало openPanelOnActionClick:true, и popup был недостижим.
// Флаг обязан явно выключаться, иначе старое значение так и останется у людей.
{
  must(/openPanelOnActionClick:\s*false/.test(bg), 'openPanelOnActionClick не выключается — клик по иконке уйдёт в боковую панель');
  must(!/openPanelOnActionClick:\s*true/.test(bg), 'где-то остался openPanelOnActionClick: true — он перебьёт popup');
  must(bg.includes('enableSidePanelOnClick()'), 'сброс поведения иконки не вызывается на старте');
}

console.log(`\npopup-wiring: пройдено ${pass}, провалено ${fails.length}`);
if (fails.length) {
  console.error('\nПРОВАЛЫ:');
  for (const f of fails) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('✓ проводка popup целая\n');
