/**
 * popup.js — окно у иконки расширения: «страница, которую я читаю → в блокнот».
 *
 * Зачем: добавить источник можно было только изнутри приложения, по URL, руками. Человек читает
 * статью и не может закинуть её в работу одним кликом — это единственная дыра, которую наш
 * Hotebook не закрывал (остальные десять действий у расширения уже есть).
 *
 * Вся работа с NotebookLM делается ФОНОМ (он владеет вкладкой и знает про authuser/мультиаккаунт),
 * popup — только интерфейс. Наш бэкенд здесь не участвует: импорт работает, даже если
 * app.trendtraffic.pro не открыт.
 */
(() => {
  'use strict';

  const T = (k, d) => { try { return chrome.i18n.getMessage(k) || d; } catch { return d; } };
  const $ = (id) => document.getElementById(id);
  const send = (msg) => new Promise((res) => {
    try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; res(r || null); }); }
    catch { res(null); }
  });

  // ── i18n разметки ──────────────────────────────────────────────────────────
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = T(el.dataset.i18n, el.textContent);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = T(el.dataset.i18nTitle, el.title);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = T(el.dataset.i18nPh, el.placeholder);

  // ── состояние ──────────────────────────────────────────────────────────────
  let current = null;   // вкладка, из которой открыли popup
  let notebooks = [];
  // Стартуем с false намеренно: обработчики навешиваются синхронно, а init() асинхронна, и
  // lock(false) мог сработать РАНЬШЕ проверки страницы — при дефолте true кнопка ожила бы
  // на chrome:// или на самом NotebookLM.
  let canAddCurrent = false;
  let importRunning = false;   // идёт пакет (свой или чужой, начатый в прошлом окне)

  const setStatus = (text, cls) => {
    const s = $('status');
    if (!text) { s.hidden = true; s.textContent = ''; return; }
    s.hidden = false;
    s.className = 'status ' + (cls || '');
    s.textContent = text;
  };
  const setProgress = (done, total) => {
    const b = $('bar');
    if (!total) { b.hidden = true; return; }
    b.hidden = false;
    $('barFill').style.width = Math.round((done / total) * 100) + '%';
  };
  const lock = (on) => {
    for (const id of ['add', 'create', 'addBulk', 'refresh', 'nb', 'nb2']) {
      const e = $(id);
      if (e) e.disabled = on;
    }
    // «Добавить» отпускаем только если текущую страницу вообще можно добавить: раньше lock(false)
    // после ⟳ безусловно оживлял кнопку на chrome:// и на странице самого NotebookLM.
    const add = $('add');
    if (add) add.disabled = on || !canAddCurrent;
  };

  const hostOf = (url) => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; } };
  const isImportable = (url) => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
  // Сам NotebookLM источником не добавляем: положить страницу блокнота внутрь этого же блокнота —
  // бессмыслица. В списке вкладок такие отфильтрованы фоном, здесь фильтруем одиночный импорт
  // и вставленные руками ссылки, чтобы поведение было одинаковым везде.
  const isNlmUrl = (url) => /^https:\/\/notebook(lm)?\.google\.com\//i.test(String(url || ''));
  const canImport = (url) => isImportable(url) && !isNlmUrl(url);

  // ── наполнение селектов блокнотов ──────────────────────────────────────────
  function fillNotebooks() {
    for (const id of ['nb', 'nb2']) {
      const sel = $(id);
      const keep = sel.value;
      sel.textContent = '';
      if (!notebooks.length) {
        const o = document.createElement('option');
        o.value = '';
        o.textContent = T('pop_noNotebooks', 'Список пуст — нажмите ⟳');
        sel.appendChild(o);
        continue;
      }
      for (const nb of notebooks) {
        const o = document.createElement('option');
        o.value = nb.id;
        o.textContent = (nb.icon ? nb.icon + ' ' : '') + (nb.title || nb.id);
        sel.appendChild(o);
      }
      if (keep) sel.value = keep;
      // Сохранённого блокнота может не быть в свежем списке (удалили в NotebookLM) — тогда
      // select уходит в selectedIndex = -1 и показывает ПУСТОЕ поле, а «Добавить» ругается
      // «выберите блокнот». Честно откатываемся на первый.
      if (sel.selectedIndex < 0) sel.selectedIndex = 0;
    }
  }

  // ── старт ──────────────────────────────────────────────────────────────────
  async function init() {
    const tabs = await new Promise((r) => chrome.tabs.query({ active: true, currentWindow: true }, r));
    current = (tabs && tabs[0]) || null;

    if (current) {
      $('pageTitle').textContent = current.title || current.url || '';
      $('pageHost').textContent = hostOf(current.url || '');
      if (current.favIconUrl) $('fav').src = current.favIconUrl;
    }
    const url = current && current.url;
    canAddCurrent = canImport(url);
    // Причину блокировки запоминаем: она важнее подсказки про пустой список и не должна ею затираться.
    let blockedReason = '';
    if (isNlmUrl(url)) blockedReason = T('pop_notImportableNlm', 'Это страница NotebookLM. Откройте статью, которую хотите добавить, и нажмите иконку там.');
    else if (!isImportable(url)) blockedReason = T('pop_notImportable', 'Эту страницу добавить нельзя — откройте обычный сайт (http/https).');
    $('add').disabled = !canAddCurrent;
    if (blockedReason) setStatus(blockedReason, 'warn');

    const st = await send({ type: 'tt-popup-state' });
    const dot = $('dot');
    if (st && st.nlmReady) { dot.className = 'dot on'; dot.title = st.account || ''; }
    else { dot.className = 'dot off'; dot.title = T('pop_nlmOffline', 'NotebookLM не открыт'); }

    notebooks = (st && st.notebooks) || [];
    fillNotebooks();
    if (!notebooks.length && !blockedReason) {
      setStatus(T('pop_needRefresh', 'Список блокнотов пуст. Нажмите ⟳ — расширение прочитает его в NotebookLM.'), 'warn');
    }

    // Пакет мог быть запущен в прошлом окне popup и всё ещё идти в фоне: показываем прогресс и
    // держим кнопки закрытыми, иначе окно выглядит чистым и человек запускает второй импорт.
    if (st && st.adding) {
      importRunning = true;
      lock(true);
      setProgress(st.adding.done, st.adding.total);
      setStatus(T('pop_addingN', 'Добавляю: ') + st.adding.done + '/' + st.adding.total, '');
    }
  }

  // ── действия ───────────────────────────────────────────────────────────────
  $('refresh').addEventListener('click', async () => {
    lock(true);
    setStatus(T('pop_refreshing', 'Читаю список блокнотов…'), '');
    const r = await send({ type: 'tt-popup-refresh-notebooks' });
    lock(false);
    if (r && r.ok) {
      notebooks = r.notebooks || [];
      fillNotebooks();
      setStatus(notebooks.length
        ? T('pop_refreshed', 'Список обновлён: ') + notebooks.length
        : T('pop_refreshEmpty', 'Блокнотов не найдено. Войдите в NotebookLM в этом браузере.'),
      notebooks.length ? 'ok' : 'warn');
    } else {
      setStatus((r && r.error) || T('pop_refreshFail', 'Не получилось прочитать список.'), 'err');
    }
  });

  $('add').addEventListener('click', async () => {
    if (!canAddCurrent) return;                    // покрывает и current === null
    const notebookId = $('nb').value;
    if (!notebookId) { setStatus(T('pop_pickNotebook', 'Сначала выберите блокнот.'), 'warn'); return; }
    importRunning = true;
    lock(true);
    setStatus(T('pop_adding', 'Добавляю…'), '');
    try {
      const r = await send({ type: 'tt-popup-add', notebookId, items: [{ url: current.url, title: current.title || '' }] });
      setProgress(0, 0);                           // фон шлёт прогресс и для одной ссылки — убираем полосу
      finish(r, notebookId);
    } finally { importRunning = false; lock(false); }
  });

  $('create').addEventListener('click', async () => {
    lock(true);
    setStatus(T('pop_creating', 'Создаю блокнот…'), '');
    const r = await send({ type: 'tt-popup-create', title: (current && current.title) || '' });
    lock(false);
    if (r && r.ok && r.notebookId) {
      notebooks = [{ id: r.notebookId, title: r.title || T('pop_untitled', 'Без названия'), icon: '' }].concat(notebooks);
      fillNotebooks();
      $('nb').value = r.notebookId;
      $('nb2').value = r.notebookId;
      setStatus(T('pop_created', 'Блокнот создан — теперь «Добавить в блокнот».'), 'ok');
    } else {
      setStatus((r && r.error) || T('pop_createFail', 'Не получилось создать блокнот.'), 'err');
    }
  });

  // Пульт Flow Booster. Раньше открывался кликом по иконке расширения
  // (setPanelBehavior openPanelOnActionClick), но default_popup этот клик перехватил —
  // вне страниц Flow пульт стал бы недостижим, поэтому вход возвращён сюда.
  // ВАЖНО: sidePanel.open требует живой пользовательский жест, поэтому windowId берётся
  // заранее (в init) и вызов идёт ПЕРВЫМ, без единого await перед ним.
  $('booster').addEventListener('click', () => {
    const wid = current && current.windowId;
    try {
      if (wid == null || !chrome.sidePanel || !chrome.sidePanel.open) throw new Error('no sidePanel');
      chrome.sidePanel.open({ windowId: wid });
      window.close();
    } catch {
      setStatus(T('pop_boosterFail', 'Не удалось открыть пульт. Откройте его кнопкой на странице Google Flow.'), 'err');
    }
  });

  // ── массовый импорт ────────────────────────────────────────────────────────
  // Селекты на двух экранах синхронизируем: выбрал «Ресёрч» на первом, ушёл в массовый импорт —
  // и 20 источников уезжали в первый по списку блокнот, потому что nb2 остался на нём.
  $('toBulk').addEventListener('click', () => {
    if ($('nb').value) $('nb2').value = $('nb').value;
    $('view-page').hidden = true; $('view-bulk').hidden = false; setStatus('');
  });
  $('back').addEventListener('click', () => {
    if ($('nb2').value) $('nb').value = $('nb2').value;
    $('view-bulk').hidden = true; $('view-page').hidden = false; setStatus('');
  });

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', async () => {
      for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t === tab);
      const links = tab.dataset.tab === 'links';
      $('pane-links').hidden = !links;
      $('pane-tabs').hidden = links;
      if (!links) await loadTabs();
    });
  }

  async function loadTabs() {
    const list = $('tabList');
    list.textContent = '';
    const r = await send({ type: 'tt-popup-tabs' });
    const items = (r && r.tabs) || [];
    $('tabsCount').textContent = String(items.length);
    for (const t of items) {
      const row = document.createElement('label');
      row.className = 'item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = t.url;
      cb.dataset.title = t.title || '';
      const span = document.createElement('span');
      span.className = 't';
      span.textContent = t.title || t.url;
      span.title = t.url;
      row.appendChild(cb);
      row.appendChild(span);
      list.appendChild(row);
    }
  }

  $('selAll').addEventListener('click', () => {
    const boxes = [...$('tabList').querySelectorAll('input[type=checkbox]')];
    const target = boxes.some((b) => !b.checked);   // есть невыбранные → выбираем все, иначе снимаем
    for (const b of boxes) b.checked = target;
  });

  $('addBulk').addEventListener('click', async () => {
    const notebookId = $('nb2').value;
    if (!notebookId) { setStatus(T('pop_pickNotebook', 'Сначала выберите блокнот.'), 'warn'); return; }

    const onLinks = !$('pane-links').hidden;
    let items = [];
    let badLines = 0;
    if (onLinks) {
      // Считаем именно НЕПУСТЫЕ строки: хвостовой перевод строки приезжает почти всегда при
      // вставке из буфера и давал бы вечное «пропущено: 1». Дубли считаются отдельно, ниже.
      const lines = $('links').value.split('\n').map((s) => s.trim()).filter(Boolean);
      badLines = lines.filter((s) => !canImport(s)).length;
      items = lines.filter(canImport).map((url) => ({ url, title: '' }));
    } else {
      items = [...$('tabList').querySelectorAll('input:checked')].map((b) => ({ url: b.value, title: b.dataset.title || '' }));
    }
    // дубли внутри одного пакета бессмысленны — NotebookLM положит две одинаковые ссылки
    const seen = new Set();
    const beforeDedup = items.length;
    items = items.filter((i) => {
      if (seen.has(i.url)) return false;
      seen.add(i.url);
      return true;
    });
    const dupes = beforeDedup - items.length;

    if (!items.length) { setStatus(T('pop_nothingToAdd', 'Нечего добавлять: нет корректных ссылок.'), 'warn'); return; }

    importRunning = true;
    lock(true);
    setProgress(0, items.length);
    setStatus(T('pop_addingN', 'Добавляю: ') + '0/' + items.length, '');
    try {
      const r = await send({ type: 'tt-popup-add', notebookId, items });
      setProgress(0, 0);
      finish(r, notebookId, { badLines, dropped: dupes });
    } finally { importRunning = false; lock(false); }
  });

  // Фон шлёт прогресс по мере добавления — popup показывает его, пока открыт.
  // Закрыли popup — добавление всё равно доедет: цикл живёт в фоне.
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'tt-popup-progress') {
      // Прогресс может прийти и от пакета, начатого в ПРОШЛОМ окне: тогда закрываем кнопки,
      // иначе отсюда можно запустить второй импорт.
      if (!importRunning) { importRunning = true; lock(true); }
      setProgress(msg.done, msg.total);
      setStatus(T('pop_addingN', 'Добавляю: ') + msg.done + '/' + msg.total, '');
      return;
    }
    // Итог пакета приходит ещё и широковещательно: ответ на sendMessage адресован окну, которое
    // операцию начало, а оно могло закрыться — без этого переоткрытый popup вис на «20/20».
    if (msg.type === 'tt-popup-done') {
      importRunning = false;
      lock(false);
      setProgress(0, 0);
      finish({ ok: true, added: msg.added, failed: msg.failed, aborted: msg.aborted }, msg.notebookId);
    }
  });

  function finish(r, notebookId, extra) {
    if (!r || !r.ok) { setStatus((r && r.error) || T('pop_addFail', 'Не получилось добавить.'), 'err'); return; }
    const okN = r.added || 0;
    const failN = r.failed || 0;
    let text = failN
      ? T('pop_addedPartial', 'Добавлено: ') + okN + T('pop_addedFailSuf', ', не вышло: ') + failN
      : T('pop_added', 'Добавлено в блокнот: ') + okN;
    // Молча выброшенные строки — потерянный материал: человек уверен, что добавились все.
    if (extra && extra.badLines) text += ' · ' + T('pop_skippedBad', 'пропущено строк: ') + extra.badLines;
    if (extra && extra.dropped) text += ' · ' + T('pop_skippedDup', 'дублей: ') + extra.dropped;
    if (r.aborted === 'busy') text += ' · ' + T('pop_abortedBusy', 'остановлено: началась генерация');
    if (r.aborted === 'failing') text += ' · ' + T('pop_abortedFailing', 'остановлено: три ошибки подряд');
    setStatus(text, (failN || (extra && extra.badLines) || r.aborted) ? 'warn' : 'ok');

    if (!notebookId) return;
    const open = document.createElement('button');
    open.className = 'link';
    open.textContent = ' ' + T('pop_openNotebook', 'Открыть блокнот');
    open.addEventListener('click', () => send({ type: 'nlm-open-notebook', notebookId }));
    $('status').appendChild(open);
  }

  init();
})();
