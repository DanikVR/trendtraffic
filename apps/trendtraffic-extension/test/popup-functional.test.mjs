/**
 * ФУНКЦИОНАЛЬНЫЙ прогон popup: грузим настоящие popup.html и popup.js в настоящий DOM (jsdom),
 * подставляем заглушку chrome.* и дёргаем кнопки, как это делал бы человек. Проверяется ПОВЕДЕНИЕ,
 * а не разметка: какое сообщение ушло в фон, что показано в статусе, что заблокировано.
 *
 * ⚠️ В отличие от popup-wiring.test.mjs и nlm-text.test.mjs, этому тесту НУЖЕН jsdom, а он не
 * является зависимостью проекта. Запуск:
 *
 *     mkdir -p /tmp/h && cd /tmp/h && npm i jsdom
 *     TT_JSDOM=/tmp/h node apps/trendtraffic-extension/test/popup-functional.test.mjs
 *
 * Именно TT_JSDOM, а не NODE_PATH: ESM-резолвер его игнорирует, поэтому jsdom (он CJS)
 * подтягивается через createRequire от указанного каталога.
 * Держим тест отдельно нарочно: два других должны гоняться где угодно без установки пакетов.
 *
 * Проверено, что тест дискриминирует (мутациями popup.js):
 *   отключить проверку страницы NotebookLM  → 4 провала
 *   убрать схлопывание дублей в пакете      → 2 провала
 *   не передавать windowId в пульт Booster  → 1 провал
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const jsdomBase = process.env.TT_JSDOM || process.cwd();
let JSDOM;
try {
  ({ JSDOM } = createRequire(pathToFileURL(jsdomBase + '/'))('jsdom'));
} catch {
  console.error('jsdom не найден. Установите его и укажите каталог:\n'
    + '  mkdir -p /tmp/h && cd /tmp/h && npm i jsdom\n'
    + '  TT_JSDOM=/tmp/h node apps/trendtraffic-extension/test/popup-functional.test.mjs');
  process.exit(2);
}

const EXT = 'C:/GOOGLEDISK/trendtraffic/worktrees/wt-origins/apps/trendtraffic-extension/src';
const html = readFileSync(EXT + '/popup.html', 'utf8');
const code = readFileSync(EXT + '/popup.js', 'utf8');

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) pass++; else fails.push(name); };
const eq = (name, a, b) => { if (a === b) pass++; else fails.push(`${name}: ждали ${JSON.stringify(b)}, получили ${JSON.stringify(a)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NOTEBOOKS = [
  { id: 'nb-1', title: 'BAZE: Empowering and Protecting Uzbek Builders', icon: '' },
  { id: 'nb-2', title: 'Блокнот без названия', icon: '' },
];

/** Поднять popup с заданной активной вкладкой. Возвращает окно и журнал сообщений к фону. */
async function boot(activeTab, opts = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'chrome-extension://test/popup.html' });
  const { window } = dom;
  const sent = [];
  const listeners = [];                              // чтобы уметь слать popup сообщения от «фона»

  window.chrome = {
    i18n: { getMessage: () => '' },                 // без локалей → сработают фолбэки из кода
    runtime: {
      lastError: null,
      onMessage: { addListener: (fn) => listeners.push(fn) },
      sendMessage: (msg, cb) => {
        sent.push(msg);
        const reply = { ok: true };
        if (msg.type === 'tt-popup-state') {
          Object.assign(reply, { nlmReady: true, account: 'infra@bazegroups.com', notebooks: opts.notebooks ?? NOTEBOOKS }, opts.state || {});
        }
        // свежий скрейп по ⟳: по умолчанию список БЕЗ nb-2 — так проверяется откат селекта,
        // когда выбранный блокнот исчез из NotebookLM
        if (msg.type === 'tt-popup-refresh-notebooks') reply.notebooks = opts.refreshNotebooks ?? [NOTEBOOKS[0]];
        if (msg.type === 'tt-popup-tabs') reply.tabs = opts.tabs ?? [];
        if (msg.type === 'tt-popup-add') Object.assign(reply, opts.addReply ?? { added: (msg.items || []).length, failed: 0 });
        if (msg.type === 'tt-popup-create') Object.assign(reply, { notebookId: 'nb-new', title: 'Новый' });
        if (cb) setTimeout(() => cb(reply), 0);
      },
    },
    tabs: { query: (q, cb) => setTimeout(() => cb([activeTab]), 0) },
    sidePanel: { open: (o) => { sent.push({ type: 'sidePanel.open', o }); } },
  };
  window.close = () => { sent.push({ type: 'window.close' }); };

  window.eval(code);
  await sleep(40);                                   // дать init() отработать
  const fire = (msg) => { for (const fn of listeners) fn(msg); };
  return { window, doc: window.document, sent, fire, $: (id) => window.document.getElementById(id) };
}

const ARTICLE = { id: 1, url: 'https://example.com/article', title: 'Как растут тренды', favIconUrl: '', windowId: 7 };
const NLM_PAGE = { id: 2, url: 'https://notebook.google.com/notebook/e683d5e5', title: 'BAZE', favIconUrl: '', windowId: 7 };
const CHROME_PAGE = { id: 3, url: 'chrome://extensions', title: 'Расширения', favIconUrl: '', windowId: 7 };

// ── 1. обычная статья: список наполнен, кнопка активна ──────────────────────
{
  const { $, sent } = await boot(ARTICLE);
  eq('1 заголовок страницы', $('pageTitle').textContent, 'Как растут тренды');
  eq('1 хост', $('pageHost').textContent, 'example.com');
  eq('1 блокнотов в списке', $('nb').options.length, 2);
  eq('1 первый блокнот', $('nb').options[0].value, 'nb-1');
  ok('1 кнопка «Добавить» активна', $('add').disabled === false);
  ok('1 индикатор зелёный', $('dot').className.includes('on'));
  ok('1 состояние запрошено у фона', sent.some((m) => m.type === 'tt-popup-state'));
}

// ── 2. страница самого NotebookLM: добавлять нечего ─────────────────────────
{
  const { $ } = await boot(NLM_PAGE);
  ok('2 кнопка «Добавить» заблокирована', $('add').disabled === true);
  ok('2 объяснение показано', !$('status').hidden && /NotebookLM/i.test($('status').textContent));
}

// ── 3. служебная страница chrome:// ─────────────────────────────────────────
{
  const { $ } = await boot(CHROME_PAGE);
  ok('3 кнопка заблокирована', $('add').disabled === true);
  ok('3 подсказка про http/https', /http/i.test($('status').textContent));
}

// ── 4. добавление текущей страницы уходит в фон правильным сообщением ───────
{
  const { $, sent, window } = await boot(ARTICLE);
  $('add').dispatchEvent(new window.Event('click'));
  await sleep(30);
  const add = sent.find((m) => m.type === 'tt-popup-add');
  ok('4 сообщение отправлено', !!add);
  eq('4 выбран блокнот', add && add.notebookId, 'nb-1');
  eq('4 одна ссылка', add && add.items.length, 1);
  eq('4 верный url', add && add.items[0].url, 'https://example.com/article');
  ok('4 отчёт об успехе', /1/.test($('status').textContent));
  ok('4 предложено открыть блокнот', !!$('status').querySelector('button'));
}

// ── 5. массовый импорт ссылками: мусор отсеивается, дубли схлопываются ──────
{
  const { $, sent, window } = await boot(ARTICLE);
  $('toBulk').dispatchEvent(new window.Event('click'));
  ok('5 экран массового импорта открыт', $('view-bulk').hidden === false && $('view-page').hidden === true);

  $('links').value = [
    'https://a.example.com/1',
    '   https://a.example.com/1   ',            // дубль с пробелами
    'ftp://nope.example.com/x',                 // не http(s)
    'https://notebook.google.com/notebook/zzz', // сам NotebookLM
    'просто текст',
    'https://b.example.com/2',
  ].join('\n');
  $('addBulk').dispatchEvent(new window.Event('click'));
  await sleep(30);

  const bulk = sent.find((m) => m.type === 'tt-popup-add');
  ok('5 сообщение отправлено', !!bulk);
  eq('5 осталось ссылок', bulk && bulk.items.length, 2);
  eq('5 первая', bulk && bulk.items[0].url, 'https://a.example.com/1');
  eq('5 вторая', bulk && bulk.items[1].url, 'https://b.example.com/2');
}

// ── 6. массовый импорт из вкладок: выбор всех и снятие ──────────────────────
{
  const tabs = [
    { id: 11, url: 'https://x.example.com/', title: 'Икс' },
    { id: 12, url: 'https://y.example.com/', title: 'Игрек' },
  ];
  const { $, sent, window, doc } = await boot(ARTICLE, { tabs });
  $('toBulk').dispatchEvent(new window.Event('click'));
  [...doc.querySelectorAll('.tab')].find((t) => t.dataset.tab === 'tabs').dispatchEvent(new window.Event('click'));
  await sleep(30);

  eq('6 вкладок в списке', $('tabList').querySelectorAll('input[type=checkbox]').length, 2);
  eq('6 счётчик', $('tabsCount').textContent, '2');

  $('selAll').dispatchEvent(new window.Event('click'));
  eq('6 выбраны все', $('tabList').querySelectorAll('input:checked').length, 2);
  $('selAll').dispatchEvent(new window.Event('click'));
  eq('6 повтор снимает выбор', $('tabList').querySelectorAll('input:checked').length, 0);

  $('selAll').dispatchEvent(new window.Event('click'));
  $('addBulk').dispatchEvent(new window.Event('click'));
  await sleep(30);
  const bulk = sent.find((m) => m.type === 'tt-popup-add');
  eq('6 отправлено вкладок', bulk && bulk.items.length, 2);
}

// ── 7. пустой массовый импорт не дёргает фон ────────────────────────────────
{
  const { $, sent, window } = await boot(ARTICLE);
  $('toBulk').dispatchEvent(new window.Event('click'));
  $('links').value = 'мусор без ссылок';
  $('addBulk').dispatchEvent(new window.Event('click'));
  await sleep(30);
  ok('7 фон не дёрнут', !sent.some((m) => m.type === 'tt-popup-add'));
  ok('7 сказано почему', !$('status').hidden && $('status').textContent.length > 0);
}

// ── 8. частичный успех показывается честно ──────────────────────────────────
{
  const { $, window } = await boot(ARTICLE, { addReply: { added: 2, failed: 3 } });
  $('add').dispatchEvent(new window.Event('click'));
  await sleep(30);
  const txt = $('status').textContent;
  ok('8 видно и успех, и провал', /2/.test(txt) && /3/.test(txt));
  ok('8 помечено как предупреждение', $('status').className.includes('warn'));
}

// ── 9. пустой список блокнотов: добавление не уходит вникуда ────────────────
{
  const { $, sent, window } = await boot(ARTICLE, { notebooks: [] });
  ok('9 предупреждение показано', !$('status').hidden);
  $('add').dispatchEvent(new window.Event('click'));
  await sleep(30);
  ok('9 фон не дёрнут', !sent.some((m) => m.type === 'tt-popup-add'));
}

// ── 10. вход в пульт Flow Booster ───────────────────────────────────────────
{
  const { $, sent, window } = await boot(ARTICLE);
  $('booster').dispatchEvent(new window.Event('click'));
  await sleep(10);
  const call = sent.find((m) => m.type === 'sidePanel.open');
  ok('10 пульт открыт', !!call);
  eq('10 передан windowId активной вкладки', call && call.o.windowId, 7);
  ok('10 popup закрылся', sent.some((m) => m.type === 'window.close'));
}

// ── 11. создание блокнота выбирает его сразу ────────────────────────────────
{
  const { $, window } = await boot(ARTICLE);
  $('create').dispatchEvent(new window.Event('click'));
  await sleep(30);
  eq('11 новый блокнот выбран', $('nb').value, 'nb-new');
  ok('11 он первый в списке', $('nb').options[0].value === 'nb-new');
  eq('11 продублирован во второй селект', $('nb2').value, 'nb-new');
}

// ── 12. навигация назад возвращает первый экран ─────────────────────────────
{
  const { $, window } = await boot(ARTICLE);
  $('toBulk').dispatchEvent(new window.Event('click'));
  $('back').dispatchEvent(new window.Event('click'));
  ok('12 вернулись на первый экран', $('view-page').hidden === false && $('view-bulk').hidden === true);
}

// ── 13. пакет из ПРОШЛОГО окна: popup подхватывает прогресс и закрывает кнопки ──
{
  const dom0 = await boot(ARTICLE, { state: { adding: { notebookId: 'nb-1', done: 7, total: 20 } } });
  const { $ } = dom0;
  ok('13 кнопки закрыты', $('add').disabled === true && $('addBulk').disabled === true && $('refresh').disabled === true);
  ok('13 показан прогресс', /7\/20/.test($('status').textContent));
}

// ── 14. итог пакета приходит широковещательно и разблокирует интерфейс ──────
{
  const { $, window, fire } = await boot(ARTICLE, { state: { adding: { notebookId: 'nb-1', done: 19, total: 20 } } });
  ok('14 до итога закрыто', $('add').disabled === true);
  fire({ type: 'tt-popup-done', notebookId: 'nb-1', added: 18, failed: 2 });
  await sleep(10);
  ok('14 интерфейс отпущен', $('add').disabled === false);
  ok('14 итог показан', /18/.test($('status').textContent) && /2/.test($('status').textContent));
  ok('14 полоса убрана', $('bar').hidden === true);
  ok('14 есть «Открыть блокнот»', !!$('status').querySelector('button'));
}

// ── 15. на странице NotebookLM ⟳ не оживляет «Добавить» ─────────────────────
{
  const { $, window } = await boot(NLM_PAGE);
  ok('15 изначально закрыта', $('add').disabled === true);
  $('refresh').dispatchEvent(new window.Event('click'));
  await sleep(40);
  ok('15 после ⟳ осталась закрытой', $('add').disabled === true);
}

// ── 16. выбор блокнота переносится на экран массового импорта ───────────────
{
  const { $, window } = await boot(ARTICLE);
  $('nb').value = 'nb-2';
  $('toBulk').dispatchEvent(new window.Event('click'));
  eq('16 nb2 унаследовал выбор', $('nb2').value, 'nb-2');
  $('back').dispatchEvent(new window.Event('click'));
  eq('16 и обратно', $('nb').value, 'nb-2');
}

// ── 17. исчезнувший блокнот: селект откатывается, а не пустеет ──────────────
{
  const { $, window } = await boot(ARTICLE);
  $('nb').value = 'nb-2';
  // ⟳ вернёт список, где nb-2 больше нет
  $('refresh').dispatchEvent(new window.Event('click'));
  await sleep(40);
  ok('17 селект не пустой', $('nb').selectedIndex >= 0);
}

// ── 18. отброшенные строки и дубли названы числом ───────────────────────────
{
  const { $, window } = await boot(ARTICLE);
  $('toBulk').dispatchEvent(new window.Event('click'));
  $('links').value = [
    'https://a.example.com/1',
    'https://a.example.com/1',                  // дубль
    'не ссылка',                                // мусор
    'https://notebook.google.com/notebook/z',   // сам NotebookLM
  ].join('\n');
  $('addBulk').dispatchEvent(new window.Event('click'));
  await sleep(40);
  const t = $('status').textContent;
  ok('18 пропущенные названы', /пропущено/i.test(t) || /skipped/i.test(t));
  ok('18 дубли названы', /дубл/i.test(t) || /duplicat/i.test(t));
}

// ── 19. причина блокировки не затирается подсказкой про пустой список ───────
{
  const { $ } = await boot(NLM_PAGE, { notebooks: [] });
  ok('19 объяснена именно страница', /NotebookLM/i.test($('status').textContent));
}

console.log(`\npopup-functional: пройдено ${pass}, провалено ${fails.length}`);
if (fails.length) {
  console.error('\nПРОВАЛЫ:');
  for (const f of fails) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('✓ popup ведёт себя как задумано\n');
