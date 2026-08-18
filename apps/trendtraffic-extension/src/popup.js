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
  };

  const hostOf = (url) => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; } };
  const isImportable = (url) => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));

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
    if (!isImportable(current && current.url)) {
      $('add').disabled = true;
      setStatus(T('pop_notImportable', 'Эту страницу добавить нельзя — откройте обычный сайт (http/https).'), 'warn');
    }

    const st = await send({ type: 'tt-popup-state' });
    const dot = $('dot');
    if (st && st.nlmReady) { dot.className = 'dot on'; dot.title = st.account || ''; }
    else { dot.className = 'dot off'; dot.title = T('pop_nlmOffline', 'NotebookLM не открыт'); }

    notebooks = (st && st.notebooks) || [];
    fillNotebooks();
    if (!notebooks.length) {
      setStatus(T('pop_needRefresh', 'Список блокнотов пуст. Нажмите ⟳ — расширение прочитает его в NotebookLM.'), 'warn');
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
    const notebookId = $('nb').value;
    if (!notebookId) { setStatus(T('pop_pickNotebook', 'Сначала выберите блокнот.'), 'warn'); return; }
    lock(true);
    setStatus(T('pop_adding', 'Добавляю…'), '');
    const r = await send({ type: 'tt-popup-add', notebookId, items: [{ url: current.url, title: current.title || '' }] });
    lock(false);
    finish(r, notebookId);
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
  $('toBulk').addEventListener('click', () => { $('view-page').hidden = true; $('view-bulk').hidden = false; setStatus(''); });
  $('back').addEventListener('click', () => { $('view-bulk').hidden = true; $('view-page').hidden = false; setStatus(''); });

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
    if (onLinks) {
      items = $('links').value.split('\n').map((s) => s.trim()).filter(isImportable).map((url) => ({ url, title: '' }));
    } else {
      items = [...$('tabList').querySelectorAll('input:checked')].map((b) => ({ url: b.value, title: b.dataset.title || '' }));
    }
    // дубли внутри одного пакета бессмысленны — NotebookLM положит две одинаковые ссылки
    const seen = new Set();
    items = items.filter((i) => {
      if (seen.has(i.url)) return false;
      seen.add(i.url);
      return true;
    });

    if (!items.length) { setStatus(T('pop_nothingToAdd', 'Нечего добавлять: нет корректных ссылок.'), 'warn'); return; }

    lock(true);
    setProgress(0, items.length);
    setStatus(T('pop_addingN', 'Добавляю: ') + '0/' + items.length, '');
    const r = await send({ type: 'tt-popup-add', notebookId, items });
    lock(false);
    setProgress(0, 0);
    finish(r, notebookId);
  });

  // Фон шлёт прогресс по мере добавления — popup показывает его, пока открыт.
  // Закрыли popup — добавление всё равно доедет: цикл живёт в фоне.
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'tt-popup-progress') return;
    setProgress(msg.done, msg.total);
    setStatus(T('pop_addingN', 'Добавляю: ') + msg.done + '/' + msg.total, '');
  });

  function finish(r, notebookId) {
    if (!r || !r.ok) { setStatus((r && r.error) || T('pop_addFail', 'Не получилось добавить.'), 'err'); return; }
    const okN = r.added || 0;
    const failN = r.failed || 0;
    setStatus(failN
      ? T('pop_addedPartial', 'Добавлено: ') + okN + T('pop_addedFailSuf', ', не вышло: ') + failN
      : T('pop_added', 'Добавлено в блокнот: ') + okN,
    failN ? 'warn' : 'ok');

    const open = document.createElement('button');
    open.className = 'link';
    open.textContent = ' ' + T('pop_openNotebook', 'Открыть блокнот');
    open.addEventListener('click', () => send({ type: 'nlm-open-notebook', notebookId }));
    $('status').appendChild(open);
  }

  init();
})();
