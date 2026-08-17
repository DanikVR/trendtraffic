/**
 * content-notebook.js — работает на https://notebook.google.com (и на старом
 * https://notebooklm.google.com, пока Google его редиректит) — изолированный
 * мир расширения). Зеркало content-flow.js, но NotebookLM — не one-shot генератор,
 * а stateful-CRUD, поэтому вместо одного `run-task` здесь КОМАНДНЫЙ РОУТ�ер `run-action`:
 *   create-notebook / add-source / list-sources / delete-source / chat / generate.
 *
 * Роли:
 *   1) инжект injected-nlm.js (перехват fetch/XHR → разведка эндпоинтов + bearer);
 *   2) панель поверх NotebookLM (Shadow DOM, бирюзовая — «TrendTraffic → Hotebook»);
 *   3) автоматизация как «обычный пользователь»: источники, чат, студия артефактов.
 *
 * ВАЖНО про селекторы: DOM NotebookLM тяжёлый (Angular/Material + shadow DOM) и
 * меняется. Поэтому: элементы ищем по НЕСКОЛЬКИМ кандидатам (role/aria/ТЕКСТ) через
 * deep-query сквозь shadow DOM; неизвестную опцию НЕ роняем, а сворачиваем в
 * текст-инструкцию (NotebookLM её уважает); при жёстком промахе честно возвращаем
 * reason:'selector:<name>' (не притворяемся, что сработало). Всё уточняется РАЗВЕДКОЙ
 * с живой страницы (кнопка «разведка вёрстки» в панели + авто-снимок при подключении).
 */
(() => {
  'use strict';
  if (window.__ttNlmContent) return;
  window.__ttNlmContent = true;

  const log = (...a) => console.log('[tt-nlm]', ...a);
  // i18n: перевод строк НАШЕЙ панели/статусов. Фолбэк — русский (как было).
  // ВАЖНО: матчеры NotebookLM (GEN_UI/LABELS/SRC_DLG_RE/findByText-кандидаты) НЕ переводятся.
  const T = (key, fallback) => { try { const m = chrome.i18n.getMessage(key); return m || fallback; } catch (e) { return fallback; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (m) => { try { return chrome.runtime.sendMessage(m); } catch { return Promise.resolve(); } };
  const reconApis = [];
  // Последний перехваченный (в MAIN-мире, injected-nlm) файл артефакта — байты аудио/видео.
  // Захват blob прямо на странице надёжнее chrome.downloads (blob фон не стянет).
  let lastArtifact = null;
  let lastOpenUrl = null; // {url,ts} — window.open с подписанным URL скачивания (см. dl-open)

  // ── deep-query сквозь shadow DOM (NotebookLM рендерит части в web-components) ──
  function queryAllDeep(sel) {
    const out = []; const seen = new Set();
    const walk = (root) => {
      let list; try { list = root.querySelectorAll(sel); } catch { list = []; }
      for (const e of list) if (!seen.has(e)) { seen.add(e); out.push(e); }
      let all; try { all = root.querySelectorAll('*'); } catch { all = []; }
      for (const e of all) if (e.shadowRoot) walk(e.shadowRoot);
    };
    walk(document);
    return out;
  }
  const visible = (el) => { try { return !!(el && el.offsetParent !== null && el.getClientRects().length); } catch { return false; } };
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim(); // как norm, но БЕЗ lowercase (для названий)
  // Чистые текстовые матчеры вынесены в src/nlm-text.js (грузится ПЕРВЫМ, см. manifest) —
  // так их можно прогнать в node без браузера: test/nlm-text.test.mjs.
  const TXT = globalThis.TT_NLM_TEXT || null;
  if (!TXT) console.warn('[tt-nlm] nlm-text.js не загрузился — матчеры работают в упрощённом режиме');
  // Фолбэк на случай, если файл не подгрузился: обычное вхождение без учёта обрезки.
  const looseIncludes = TXT ? TXT.looseIncludes : ((hay, needle) => norm(hay).includes(norm(needle)));
  // Пункт ⋮ «Скачать» (но НЕ «Скачать блокнот»). Матчим по aria-label/title тоже — у иконочных
  // пунктов меню видимый текст бывает одной лигатурой Material вроде «save_alt».
  const isDownloadItem = TXT ? TXT.isDownloadItem
    : ((t) => /скачать|save_alt|download/i.test(norm(t)) && !/блокнот|notebook/i.test(norm(t)));

  // Текст элемента для матчинга. ВАЖНО: aria-label и title несут ПОЛНУЮ подпись даже тогда,
  // когда CSS обрезал видимый текст многоточием, поэтому они идут в общий котёл к textContent.
  const elText = (el) => {
    const at = (n) => norm((el && el.getAttribute && el.getAttribute(n)) || '');
    return [at('aria-label'), at('title'), at('data-title'), norm((el && el.textContent) || '')]
      .filter(Boolean).join(' ');
  };

  /** Найти видимый кликабельный элемент, чей текст/aria содержит одно из слов (первый — лучший). */
  function findByText(words, opts = {}) {
    const cands = (opts.roots || queryAllDeep(opts.sel || 'button,[role="button"],[role="menuitem"],[role="option"],[role="tab"],a,label,div[tabindex]'))
      .filter(visible);
    const ws = words.map(norm).filter(Boolean);
    // Приоритет точному совпадению, затем вхождению (вхождение — с поправкой на обрезку «…»).
    for (const exact of [true, false]) {
      for (const el of cands) {
        const t = elText(el);
        for (const w of ws) {
          if (exact ? (t === w || norm(el.textContent) === w) : looseIncludes(t, w)) return el;
        }
      }
    }
    return null;
  }
  function clickEl(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: 'center' }); } catch { /* */ }
    try { el.click(); return true; } catch { /* */ }
    try { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; } catch { return false; }
  }
  async function clickByText(words, opts) { const el = findByText(words, opts); return el ? clickEl(el) : false; }

  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function typeInto(el, text) {
    if (!el) return false;
    try { el.focus(); } catch { /* */ }
    if (el.isContentEditable) { el.textContent = text; el.dispatchEvent(new InputEvent('input', { bubbles: true })); }
    else setNativeValue(el, text);
    return true;
  }
  async function waitFor(fn, ms, step = 500) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch { /* */ } await sleep(step); }
    return null;
  }

  // ── статус входа в Google ─────────────────────────────────────────────────────
  // Google переехал на notebook.google.com («Gemini Notebook»); старый хост пока редиректит.
  const onNotebookLM = () => location.host === 'notebook.google.com' || location.host === 'notebooklm.google.com';
  function isLoggedIn() {
    if (!onNotebookLM()) return false;
    if (/accounts\.google\.com/.test(location.href)) return false; // редирект на вход = не залогинен
    if (/\/notebook\//.test(location.href)) return true;
    if (queryAllDeep('a[href*="/notebook/"]').some(visible)) return true;
    if (queryAllDeep('[aria-label*="Account" i],[aria-label*="аккаунт" i],img[src*="googleusercontent"]').some(visible)) return true;
    // Явная форма входа Google → НЕ залогинен. Список слов — в nlm-text.js: под брендом
    // «Gemini Notebook» подпись стала «Sign in to Notebook», старая «…to NotebookLM» покрывается
    // тем же вхождением (сравнение по substring, не по равенству).
    if (findByText(TXT ? TXT.SIGNIN_WORDS : ['sign in with google', 'войдите в аккаунт', 'sign in to notebook', 'войти в google'])) return false;
    // Иначе (загрузка, /accessrequest, промежуточные страницы notebooklm БЕЗ формы входа) — считаем
    // залогиненным. Иначе мигало «нужен вход» при навигации/загрузке во время генерации (баг «оборвалось»).
    return true;
  }
  const notebookIdFromUrl = () => { const m = /\/notebook\/([a-z0-9-]+)/i.exec(location.href); return m ? m[1] : null; };

  // Email аккаунта Google, под которым открыт NotebookLM. Кнопка аккаунта у Google несёт
  // aria-label вида «Аккаунт Google: Имя (mail@gmail.com)» / «Google Account: Name (mail@…)».
  const EMAIL_RE = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;
  function accountEmail() {
    try {
      // Сначала — узлы, где явно упомянут аккаунт (точнее, чем любой email на странице).
      const acct = queryAllDeep('a[aria-label*="ccount" i],a[aria-label*="ккаунт" i],[aria-label*="ccount" i],[aria-label*="ккаунт" i]');
      for (const n of acct) {
        const m = EMAIL_RE.exec((n.getAttribute && n.getAttribute('aria-label')) || '');
        if (m) return m[1].toLowerCase();
      }
      // Фолбэк 1: любой email в aria-label или title (аватар аккаунта почти всегда его несёт).
      for (const n of queryAllDeep('[aria-label],[title]')) {
        const m = EMAIL_RE.exec((n.getAttribute('aria-label') || '') + ' ' + (n.getAttribute('title') || ''));
        if (m) return m[1].toLowerCase();
      }
      // Фолбэк 2: у нового аккаунт-виджета почта бывает обычным текстом в листовом узле.
      for (const n of queryAllDeep('a,button,div,span')) {
        if (!visible(n) || (n.childElementCount || 0) > 0) continue;
        const t = clean(n.textContent);
        if (t.length > 80) continue;
        const m = EMAIL_RE.exec(t);
        if (m) return m[1].toLowerCase();
      }
    } catch { /* */ }
    return null;
  }

  // ═══════════════════ 1. инжект MAIN-world перехватчика ═══════════════════
  function injectInterceptor() {
    try {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('src/injected-nlm.js');
      s.onload = () => s.remove();
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { log('инжект injected-nlm.js не удался', e); }
  }
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.source !== 'tt-nlm-injected') return;
    if (d.kind === 'api') {
      reconApis.push({ url: String(d.url || '').slice(0, 160), method: d.method, status: d.status });
      if (reconApis.length > 60) reconApis.shift();
      ui.recon();
    } else if (d.kind === 'artifact-blob' && d.dataUrl) {
      // Перехвачены байты готового артефакта (аудио/видео) прямо на странице.
      lastArtifact = { dataUrl: d.dataUrl, mime: d.mime || '', fileName: d.fileName || '', size: d.size || 0, ts: Date.now() };
      try { ui.line(T('nlm_artifactCapturedPre', 'перехвачен файл артефакта (') + Math.round((d.size || 0) / 1024) + T('nlm_kbComma', ' КБ, ') + (d.via || '') + ')'); } catch { /* */ }
    } else if (d.kind === 'artifact-blob-error') {
      try { ui.line(T('nlm_captureFailed', 'перехват файла не удался: ') + d.error); } catch { /* */ }
    } else if (d.kind === 'dl-probe') {
      // Диагностика механизма скачивания (что реально делает «Скачать») — видно в логе виджета.
      try { ui.line(T('nlm_dlProbe', 'скачивание? ') + d.at + (d.mime ? ' ' + d.mime : '') + (d.size ? ' ' + Math.round(d.size / 1024) + T('nlm_kb', 'КБ') : '') + (d.href ? ' ' + d.href : '')); } catch { /* */ }
    } else if (d.kind === 'dl-open' && d.url) {
      // NotebookLM попытался открыть подписанный URL скачивания через window.open (Chrome мог
      // ЗАБЛОКИРОВАТЬ попап — не важно: URL мы уже перехватили, фон скачает байты сам).
      lastOpenUrl = { url: String(d.url), ts: Date.now() };
      try { ui.line(T('nlm_openUrlCaptured', 'перехвачен URL скачивания (window.open)')); } catch { /* */ }
    }
  });

  // ═══════════════════ 2. панель (Shadow DOM) ═══════════════════
  const ui = (() => {
    let root, els = {}, reconCount = 0, reconSent = false, lastLoggedIn = null, lastAccount = null, lastActive = null;
    function mount() {
      const host = document.createElement('div');
      host.id = 'tt-nlm-host';
      host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;';
      const sh = host.attachShadow({ mode: 'open' });
      // Видимые тексты панели — через T() (структуру/классы шаблона не меняем).
      const TXT = {
        state: T('nlm_state', 'Состояние'),
        notConnected: T('nlm_notConnected', 'не подключено'),
        account: T('nlm_account', 'Аккаунт'),
        accountTitle: T('nlm_accountTitle', 'Аккаунт Google, под которым открыт NotebookLM'),
        waitingTask: T('nlm_waitingTask', 'Ожидаю задачи из TrendTraffic…'),
        grabTitle: T('nlm_grabTitle', 'Показать готовые работы студии — клик по работе загружает её в Галерею TrendTraffic'),
        grabBtn: T('nlm_grabBtn', '⬇ В галерею'),
        openTT: T('nlm_openTT', 'Открыть TrendTraffic'),
        reconBtnTitle: T('nlm_reconBtnTitle', 'Снять текущую вёрстку NotebookLM и прислать нам (для подстройки селекторов)'),
        reconBtn: T('nlm_reconBtn', 'разведка вёрстки'),
      };
      sh.innerHTML = `
        <style>
          *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif}
          .card{width:300px;background:#0E1720;color:#EAF2F5;border:1px solid #1E3038;
            border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.45);overflow:hidden}
          .hd{display:flex;align-items:center;gap:8px;padding:11px 13px;background:#122029;
            border-bottom:1px solid #1E3038;cursor:move;user-select:none;touch-action:none}
          .logo{width:9px;height:9px;border-radius:50%;background:#22D3EE;box-shadow:0 0 8px #22D3EE}
          .ttl{font-size:12.5px;font-weight:700;letter-spacing:.02em}
          .sub{font-size:10.5px;color:#7C93A0;margin-left:auto;font-family:ui-monospace,Consolas,monospace}
          .bd{padding:12px 13px;display:flex;flex-direction:column;gap:9px}
          .row{display:flex;align-items:center;gap:8px;font-size:12px}
          .pill{font-family:ui-monospace,Consolas,monospace;font-size:10px;font-weight:700;
            padding:2px 7px;border-radius:5px;text-transform:uppercase;letter-spacing:.03em}
          .pill.on{background:#0E3A34;color:#3DD6C0} .pill.off{background:#3A2530;color:#F27289}
          .pill.wait{background:#12303A;color:#49C6E9}
          .acct{margin-left:auto;font-family:ui-monospace,Consolas,monospace;font-size:10.5px;
            color:#7C93A0;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:right}
          .task{font-size:11.5px;color:#B7C6CE;background:#122029;border:1px solid #1E3038;
            border-radius:8px;padding:8px;min-height:34px;line-height:1.4;word-break:break-word}
          .lg{font-family:ui-monospace,Consolas,monospace;font-size:10px;color:#7C93A0;
            max-height:110px;overflow:auto;white-space:pre-wrap;line-height:1.5}
          .btns{display:flex;gap:7px}
          button{flex:1;font-size:11.5px;font-weight:600;padding:7px 9px;border-radius:8px;
            border:1px solid #1E3038;background:#182833;color:#EAF2F5;cursor:pointer}
          button:hover{background:#1E3038} button.pri{background:#0891B2;border-color:#0891B2}
          button.pri:hover{background:#0b7f9c}
          .wire{position:relative;height:3px;border-radius:3px;background:#182833;overflow:hidden}
          .wire::before{content:'';position:absolute;top:0;left:-45%;width:45%;height:100%;
            background:linear-gradient(90deg,transparent,#22D3EE,transparent);opacity:0}
          .wire.on::before{opacity:1;animation:ttrun 1.25s linear infinite}
          @keyframes ttrun{from{left:-45%}to{left:100%}}
          .foot{display:flex;align-items:center;justify-content:space-between;gap:8px}
          .rec{flex:0 0 auto;width:auto;font-size:10px;color:#7C93A0;background:none;
            border:none;cursor:pointer;text-decoration:underline;padding:0}
          .rec:hover{color:#B7C6CE;background:none}
          .pick{display:flex;flex-direction:column;gap:4px;max-height:170px;overflow:auto;
            background:#122029;border:1px solid #1E3038;border-radius:8px;padding:7px}
          .prow{display:flex;align-items:center;gap:6px;font-size:10.5px;color:#B7C6CE}
          .prow .pt{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .prow button{flex:0 0 auto;width:auto;padding:2px 9px;font-size:10px;border-radius:6px}
          .pfoot{display:flex;gap:10px;justify-content:flex-end;margin-top:2px}
          .hide{display:none}
        </style>
        <div class="card">
          <div class="hd" id="hd">
            <span class="logo"></span><span class="ttl">TrendTraffic → Hotebook</span>
            <span class="sub" id="ver"></span>
          </div>
          <div class="bd" id="bd">
            <div class="row"><span>${TXT.state}</span><span class="pill off" id="st">${TXT.notConnected}</span></div>
            <div class="row"><span>${TXT.account}</span><span class="acct" id="acct" title="${TXT.accountTitle}">—</span></div>
            <div class="wire" id="wire"></div>
            <div class="task" id="task">${TXT.waitingTask}</div>
            <div class="lg" id="lg"></div>
            <div class="btns">
              <button class="pri" id="grab" title="${TXT.grabTitle}">${TXT.grabBtn}</button>
              <button id="open">${TXT.openTT}</button>
            </div>
            <div class="pick hide" id="pick"></div>
            <div class="foot">
              <span class="rec" id="verlbl"></span>
              <button class="rec" id="recBtn" title="${TXT.reconBtnTitle}">${TXT.reconBtn}</button>
            </div>
          </div>
        </div>`;
      document.documentElement.appendChild(host);
      els = {
        st: sh.getElementById('st'), task: sh.getElementById('task'), lg: sh.getElementById('lg'),
        ver: sh.getElementById('ver'), open: sh.getElementById('open'), bd: sh.getElementById('bd'),
        hd: sh.getElementById('hd'), wire: sh.getElementById('wire'), verlbl: sh.getElementById('verlbl'),
        acct: sh.getElementById('acct'), grab: sh.getElementById('grab'), pick: sh.getElementById('pick'),
      };
      els.ver.textContent = 'v' + chrome.runtime.getManifest().version;
      els.verlbl.textContent = 'NotebookLM';
      makeDraggable(host, els.hd, () => els.bd.classList.toggle('hide'));
      // «Открыть TrendTraffic»: с главной → вкладка Hotebook; изнутри блокнота → сразу открыть
      // ЭТОТ блокнот в приложении (?openNotebook=<id>&title=… — фронт создаст/привяжет сценарий).
      els.open.addEventListener('click', () => {
        const base = 'https://app.trendtraffic.pro/gallery?tab=hotebook';
        const nbId = notebookIdFromUrl();
        let url = base;
        if (nbId) {
          const title = clean(document.title).replace(/\s*[-–—]\s*NotebookLM\s*$/i, '').slice(0, 120);
          url = base + '&openNotebook=' + encodeURIComponent(nbId) + (title ? '&title=' + encodeURIComponent(title) : '');
        }
        window.open(url, '_blank');
      });
      // «⬇ В галерею» → ПЕРЕЧЕНЬ готовых работ студии (решение юзера: не автоматом и не всё сразу,
      // а список — клик по работе загружает именно её; сервер дедуплит уже залитое → «✓ уже»).
      const renderPicker = () => {
        els.pick.innerHTML = '';
        const nbId = notebookIdFromUrl();
        const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
        if (!nbId) { els.pick.appendChild(mk('div', 'prow', T('nlm_openNotebookFirst', 'откройте блокнот — покажу его работы студии'))); return; }
        const cards = studioArtifactCards();
        if (!cards.length) { els.pick.appendChild(mk('div', 'prow', T('nlm_noReadyWorks', 'нет готовых работ студии (или ещё генерятся)'))); }
        for (const c of cards) {
          const row = mk('div', 'prow');
          row.appendChild(mk('span', 'pt', (c.kind === 'media' ? '▶ ' : '📄 ') + c.title));
          const b = mk('button', '', '⬇');
          b.title = T('nlm_loadTitlePre', 'Загрузить «') + c.title.slice(0, 60) + T('nlm_loadTitleSuf', '» в Галерею');
          b.addEventListener('click', async () => {
            if (b.disabled) return;
            b.disabled = true; b.textContent = '…';
            let r = null;
            try {
              for (const t0 = Date.now(); (watcherBusy || actionBusy) && Date.now() - t0 < 45_000;) await sleep(300);
              watcherBusy = true;
              try {
                // пересканируем: DOM мог перерисоваться с момента открытия перечня
                const fresh = studioArtifactCards().find((x) => norm(x.title) === norm(c.title));
                r = fresh ? await captureCardToGallery(fresh) : { ok: false };
              } finally { watcherBusy = false; }
            } catch { /* */ }
            b.disabled = false;
            b.textContent = r && r.ok ? (r.dedup ? T('nlm_alreadyShort', '✓ уже') : '✓') : '⚠';
          });
          row.appendChild(b);
          els.pick.appendChild(row);
        }
        const foot = mk('div', 'pfoot');
        const refresh = mk('button', 'rec', T('nlm_refresh', 'обновить')); refresh.addEventListener('click', renderPicker);
        const close = mk('button', 'rec', T('nlm_close', 'закрыть')); close.addEventListener('click', () => els.pick.classList.add('hide'));
        foot.appendChild(refresh); foot.appendChild(close);
        els.pick.appendChild(foot);
      };
      els.grab.addEventListener('click', () => {
        if (!els.pick.classList.contains('hide')) { els.pick.classList.add('hide'); return; }
        renderPicker();
        els.pick.classList.remove('hide');
      });
      sh.getElementById('recBtn').addEventListener('click', () => runRecon(false));
      refreshStatus();
      setInterval(refreshStatus, 5000);
      root = sh;
    }
    function savePanelPos(left, top) { try { chrome.storage.local.set({ nlmPanelPos: { left, top } }); } catch { /* */ } }
    function makeDraggable(host, handle, onTap) {
      try {
        chrome.storage.local.get('nlmPanelPos', (d) => {
          const p = d && d.nlmPanelPos;
          if (!p || typeof p.left !== 'number' || typeof p.top !== 'number') return;
          const w = host.offsetWidth || 300, h = host.offsetHeight || 120;
          host.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, p.left)) + 'px';
          host.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, p.top)) + 'px';
          host.style.right = 'auto'; host.style.bottom = 'auto';
        });
      } catch { /* */ }
      let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
      handle.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        dragging = true; moved = false;
        const r = host.getBoundingClientRect();
        ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
        host.style.left = ox + 'px'; host.style.top = oy + 'px';
        host.style.right = 'auto'; host.style.bottom = 'auto';
        try { handle.setPointerCapture(e.pointerId); } catch { /* */ }
      });
      handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        const w = host.offsetWidth, h = host.offsetHeight;
        host.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, ox + dx)) + 'px';
        host.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, oy + dy)) + 'px';
      });
      const end = (e) => {
        if (!dragging) return;
        dragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch { /* */ }
        if (moved) savePanelPos(parseInt(host.style.left, 10) || 0, parseInt(host.style.top, 10) || 0);
        else if (typeof onTap === 'function') onTap();
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
      window.addEventListener('resize', () => {
        const w = host.offsetWidth, h = host.offsetHeight;
        const l = parseInt(host.style.left, 10), t = parseInt(host.style.top, 10);
        if (Number.isFinite(l)) host.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, l)) + 'px';
        if (Number.isFinite(t)) host.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, t)) + 'px';
      });
    }
    function line(t) {
      if (!els.lg) return;
      const ts = new Date().toLocaleTimeString();
      els.lg.textContent = `${ts}  ${t}\n` + els.lg.textContent;
      els.lg.textContent = els.lg.textContent.split('\n').slice(0, 40).join('\n');
    }
    function status(kind, text) { if (els.st) { els.st.className = 'pill ' + kind; els.st.textContent = text; } }
    function task(t) { if (els.task) els.task.textContent = t; }
    function recon() { reconCount++; }
    async function refreshStatus() {
      const r = await send({ type: 'nlm-status' });
      if (!r) return;
      const loggedIn = isLoggedIn();
      const acct = loggedIn ? accountEmail() : null;
      // Аккаунт на плашке расширения (NotebookLM всегда справа снизу).
      if (els.acct) { els.acct.textContent = acct || (loggedIn ? '…' : '—'); els.acct.title = acct || T('nlm_accountTitle', 'Аккаунт Google, под которым открыт NotebookLM'); }
      // Сообщаем background о входе + аккаунте + видима ли вкладка. active=true → это та вкладка,
      // что перед глазами у юзера → background закрепляет ЕЁ как рабочую (иначе при мультиаккаунте
      // Google операции/список блокнотов уезжали в другой аккаунт из случайной фоновой вкладки).
      const active = !document.hidden;
      if (loggedIn !== lastLoggedIn || (acct && acct !== lastAccount) || active !== lastActive) {
        lastLoggedIn = loggedIn; if (acct) lastAccount = acct; lastActive = active;
        send({ type: 'nlm-presence', loggedIn, account: acct || undefined, active });
      }
      if (!r.connected) { status('off', T('nlm_loginTT', 'войдите в TrendTraffic')); toggleWire(false); armAutoRecon(false); return; }
      if (!loggedIn) { status('wait', T('nlm_loginGoogle', 'войдите в Google')); toggleWire(false); armAutoRecon(false); return; }
      status('on', T('nlm_working', 'работает')); toggleWire(true); armAutoRecon(true);
    }
    function toggleWire(on) { if (els.wire) els.wire.classList.toggle('on', !!on); }
    function armAutoRecon(ok) { if (ok && !reconSent) { reconSent = true; setTimeout(() => runRecon(true), 1500); } }
    return { mount, line, status, task, recon };
  })();

  // ═══════════════════ 3. автоматизация NotebookLM ═══════════════════

  // Тип артефакта → плитки студии, ПАНЕЛЬ настройки («Настроить X» → там опции + «Сгенерировать»),
  // тип захвата, расширение, mime. Разведано вживую (RU NotebookLM).
  // Подписи плиток вёрстка обрезает многоточием («Аудиопе…»), поэтому findByText сравнивает
  // через looseIncludes (nlm-text.js), а здесь перечислены ПОЛНЫЕ варианты — RU и EN, включая
  // старые названия. Добавлять новые синонимы сюда, а не чинить матчер.
  const GEN_UI = {
    audio:       { tiles: ['аудиопересказ', 'audio overview', 'аудиообзор'], customize: ['настроить аудиопересказ', 'customize audio overview', 'customize audio'], kind: 'media', ext: '.mp3', mime: 'audio/mpeg' },
    video:       { tiles: ['видеопересказ', 'video overview', 'видеообзор'], customize: ['настроить видеопересказ', 'customize video overview', 'customize video'],   kind: 'media', ext: '.mp4', mime: 'video/mp4' },
    report:      { tiles: ['отчеты', 'отчёты', 'reports', 'report'],         customize: ['настроить отчет', 'настроить отчёт', 'customize report'],            kind: 'doc',   ext: '.md',  mime: 'text/markdown' },
    quiz:        { tiles: ['тест', 'quiz'],                                  customize: ['настроить тест', 'customize quiz'],              kind: 'json',  ext: '.json', mime: 'application/json' },
    table:       { tiles: ['таблица данных', 'data table', 'таблица'],       customize: ['настроить таблицу данных', 'настроить таблицу', 'customize data table'], kind: 'csv',   ext: '.csv', mime: 'text/csv' },
    infographic: { tiles: ['инфографика', 'infographic'],                    customize: ['настроить инфографику', 'customize infographic'],                         kind: 'media', ext: '.png', mime: 'image/png' },
    flashcards:  { tiles: ['карточки', 'flashcards', 'flash cards'],         customize: ['настроить карточки', 'customize flashcards'],                            kind: 'json',  ext: '.json', mime: 'application/json' },
    mindmap:     { tiles: ['ментальная карта', 'mind map', 'mindmap'],       customize: ['настроить ментальную карту', 'customize mind map'],                    kind: 'json',  ext: '.json', mime: 'application/json' },
    slides:      { tiles: ['презентация', 'slides', 'slide deck'],           customize: ['настроить презентацию', 'customize slide deck'],                         kind: 'doc',   ext: '.pdf', mime: 'application/pdf' },
  };
  // Значение опции UI → кандидаты текста в NotebookLM (EN + RU). Ненайденное сворачивается в инструкцию.
  const LABELS = {
    format: {
      deep_dive: ['deep dive', 'подробный анализ'], brief: ['brief', 'краткий'], critique: ['critique', 'рецензия'], debate: ['debate', 'дебаты'],
      explainer: ['explainer', 'объясняющий'], cinematic: ['cinematic', 'кинематографичный'],
      briefing_doc: ['briefing', 'брифинг'], study_guide: ['study guide', 'учебное'], blog_post: ['blog', 'блог'], custom: ['custom', 'свой'],
      detailed_deck: ['detailed', 'подробные'], presenter_slides: ['presenter', 'для выступления'],
    },
    length: { short: ['shorter', 'короче', 'маленькая'], default: ['default', 'по умолчанию'], long: ['longer', 'длиннее', 'длинная'] },
    difficulty: { easy: ['easy', 'лёгкий', 'легкий'], medium: ['medium', 'средний'], hard: ['hard', 'сложный'] },
    count: { standard: ['standard', 'стандарт'], fewer: ['fewer', 'поменьше', 'меньше'] },
    orientation: { portrait: ['portrait', 'вертикаль'], landscape: ['landscape', 'горизонталь'], square: ['square', 'квадрат'] },
    detail: { standard: ['standard', 'стандарт'], concise: ['concise', 'минимум'], detailed: ['detailed', 'максимум', 'подробн'] },
  };
  const FIELD_RU = { format: 'формат', length: 'длина', style: 'стиль', difficulty: 'сложность', count: 'количество', orientation: 'ориентация', detail: 'детализация' };

  // Кандидаты полей ввода/кнопок. Уточнено разведкой живой вёрстки (RU NotebookLM, 07.2026):
  //   URL  = <textarea aria-label="Введите URL" placeholder="Вставьте ссылки">
  //   текст = <textarea aria-label="Вставленный текст" placeholder="Вставьте текст">
  // Поэтому первыми идут ТОЧНЫЕ aria/placeholder, потом общие фолбэки.
  const SEL = {
    sourceUrlInput: ['textarea[aria-label*="url" i]', 'textarea[placeholder*="ссылк" i]', 'input[type="url"]', 'input[placeholder*="url" i]', 'input[placeholder*="ссылк" i]', 'textarea[placeholder*="url" i]'],
    sourceTextArea: ['textarea[aria-label*="вставленн" i]', 'textarea[placeholder*="вставьте текст" i]', 'textarea[placeholder*="paste" i]', 'textarea[placeholder*="text" i]', 'textarea[placeholder*="текст" i]', 'textarea'],
    fileInput: ['input[type="file"]'],
    chatInput: ['textarea[placeholder*="введите текст" i]', 'textarea[aria-label*="поле для запрос" i]', 'textarea[placeholder*="ask" i]', 'textarea[placeholder*="спрос" i]', 'div[contenteditable="true"][role="textbox"]', 'textarea'],
    instructions: ['textarea[aria-label*="акцент" i]', 'textarea[aria-label*="на чем" i]', 'textarea[aria-label*="на чём" i]', 'textarea[placeholder*="focus" i]', 'textarea[placeholder*="акцент" i]', 'textarea[placeholder*="instruction" i]', 'textarea[aria-label*="focus" i]'],
  };
  function pickDeep(cands) {
    for (const s of cands) { const list = queryAllDeep(s).filter(visible); if (list.length) return list[list.length - 1]; }
    return null;
  }

  // ── создать блокнот ──
  async function createNotebook(title) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    ui.task(T('nlm_creatingNotebook', 'Создаю блокнот: ') + (title || ''));
    // ВАЖНО: кнопка «Создать блокнот» (aria) есть И на главной, И внутри блокнота.
    // Раньше код, будучи уже на /notebook/<id>, НЕ жал «создать», а «усыновлял» открытый
    // блокнот (часто чужой/рекомендованный → потом запрос доступа). Теперь жмём ВСЕГДА и
    // ждём НОВЫЙ id, отличный от текущего.
    const before = notebookIdFromUrl();
    const ok = await clickByText(['создать блокнот', 'create new notebook', 'create notebook', 'new notebook']);
    if (!ok) return { ok: false, reason: 'selector:create-notebook' };
    const nbId = await waitFor(() => { const id = notebookIdFromUrl(); return (id && id !== before) ? id : null; }, 30_000, 700);
    if (!nbId) return { ok: false, reason: 'selector:create-notebook (нет нового /notebook/<id> в URL)' };
    // Переименовать (best-effort): найти поле заголовка и вписать имя.
    if (title) {
      try {
        const t = queryAllDeep('input[aria-label*="title" i],input[aria-label*="назван" i],[contenteditable="true"][aria-label*="title" i]').filter(visible)[0];
        if (t) { typeInto(t, title); await sleep(300); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
      } catch { /* имя не критично */ }
    }
    ui.line(T('nlm_notebookCreated', '✓ блокнот создан: ') + nbId);
    // Через background — переживает возможную перезагрузку страницы.
    send({ type: 'nlm-create-done', actionId: currentActionId, notebookId: nbId, title: title || null });
    return { ok: true, notebookId: nbId, title: title || null };
  }

  // ── источники ──
  async function openAddSource() {
    // Кнопка «Добавить источники» (aria «Добавить источник»). Не открываем повторно, если
    // диалог выбора типа уже на экране (есть «Сайты»/«Загрузить файлы»).
    if (findByText(['сайты', 'загрузить файлы', 'скопированный текст'])) return;
    await clickByText(['добавить источник', 'add source', 'add sources']);
    await sleep(700);
  }
  async function addSource(a) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    const kind = a.srcKind;
    ui.task(T('nlm_addingSource', 'Добавляю источник (') + kind + ')');
    await openAddSource();
    if (kind === 'url') {
      // Под-вкладка «Сайты» (иконки link+youtube). Затем поле URL и кнопка «Добавить».
      await clickByText(['сайты', 'website', 'сайт', 'link', 'url', 'youtube', 'ссылк']);
      await sleep(500);
      const inp = pickDeep(SEL.sourceUrlInput);
      if (!inp) return { ok: false, reason: 'selector:sourceUrlInput' };
      typeInto(inp, a.url || '');
      await sleep(500);
      // Кнопка отправки — РОВНО «Добавить» (findByText приоритезирует точное совпадение,
      // поэтому «Добавить источники» не перехватит). Enter в textarea даёт перенос — не жмём.
      if (!await clickByText(['добавить', 'вставить', 'insert', 'submit'])) return { ok: false, reason: 'selector:add-source-submit' };
    } else if (kind === 'text') {
      await clickByText(['скопированный текст', 'copied text', 'paste text', 'вставить текст', 'текст']);
      await sleep(500);
      const ta = pickDeep(SEL.sourceTextArea);
      if (!ta) return { ok: false, reason: 'selector:sourceTextArea' };
      typeInto(ta, a.content || '');
      await sleep(500);
      if (!await clickByText(['добавить', 'вставить', 'insert', 'submit'])) return { ok: false, reason: 'selector:add-source-submit' };
    } else if (kind === 'file') {
      // Файл из Галереи: скачиваем байты в background (обход CORS).
      const b = await send({ type: 'fetch-bytes', url: a.fileUrl });
      if (!b || !b.ok) return { ok: false, reason: T('nlm_fileDlFailed', 'не скачался файл из Галереи') + (b && b.error ? ': ' + b.error : '') };
      // ВАЖНО (разведано вживую): загрузить файл в NotebookLM из расширения НАДЁЖНО НЕЛЬЗЯ:
      // в DOM нет input[type=file] («Загрузить файлы» открывает нативное окно ОС), а синтетический
      // drag-drop NotebookLM игнорирует (isTrusted=false — проверено, источник не добавляется).
      // Поэтому файл-путь = короткая попытка drag-drop + БЫСТРЫЙ честный отказ с подсказкой, а не зависание.
      const suggest = /^video\//i.test(b.mime || '')
        ? T('nlm_videoNotAccepted', 'NotebookLM не принимает видео-файлы. Для ролика добавьте «Анализ» текстом или ссылку (YouTube).')
        : T('nlm_fileUploadUnavailable', 'Загрузка файлов в NotebookLM недоступна из расширения (нативное окно). Используйте «Анализ»/«Вставить текст» или ссылку (сайт/YouTube).');
      if (/^video\//i.test(b.mime || '')) return { ok: false, reason: suggest };
      const dz = pickDeep(['.xap-uploader-dropzone.drop-zone', '.xap-uploader-dropzone', '.drop-zone-container', '[class*="drop-zone" i]', '[class*="dropzone" i]']);
      const beforeN = listSourcesDom().length;
      if (dz) {
        try {
          const file = dataUrlToFile(b.dataUrl, a.fileName || 'source');
          const dt = new DataTransfer(); dt.items.add(file);
          for (const evName of ['dragenter', 'dragover', 'drop']) {
            dz.dispatchEvent(new DragEvent(evName, { bubbles: true, cancelable: true, dataTransfer: dt }));
            await sleep(200);
          }
        } catch { /* синтетический drop мог не пройти — упадём в отказ ниже */ }
      }
      const appeared = await waitFor(() => (listSourcesDom().length > beforeN ? true : null), 8000, 1000);
      if (!appeared) return { ok: false, reason: suggest };
      ui.line(T('nlm_fileSourceAdded', '✓ файл-источник добавлен'));
      return { ok: true, source: { title: a.title || a.fileName || 'файл', kind }, sources: listSourcesDom() };
    } else {
      return { ok: false, reason: T('nlm_unknownSourceKind', 'неизвестный тип источника') };
    }
    // URL/текст: дождаться, что источник появился (best-effort), вернуть свежий список.
    await sleep(2500);
    const sources = listSourcesDom();
    ui.line(T('nlm_sourceAdded', '✓ источник добавлен (') + kind + ')');
    return { ok: true, source: { title: a.title || (a.url || 'источник'), kind }, sources };
  }
  function listSourcesDom() {
    // Строки источников слева = <div class="single-source-container">; текст = «<иконка-лигатура><Название>».
    const items = queryAllDeep('.single-source-container, single-source-container, [class*="single-source-container" i]').filter(visible);
    const out = [];
    const seen = new Set();
    for (const el of items) {
      // Убрать ведущий material-icon токен, приклеенный к названию (video_youtubeFable… → Fable…) и «more_vert».
      const title = clean(el.textContent).replace(/\bmore_vert\b/g, '').replace(/^[a-z_]+(?=[A-ZА-ЯЁ0-9«"'(])/, '').trim().slice(0, 100);
      if (!title || seen.has(title)) continue;
      seen.add(title);
      out.push({ id: title, title, source_id: undefined });
      if (out.length > 80) break;
    }
    return out;
  }
  async function listSources() {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    // После навигации в блокнот панель источников рендерится не сразу — ждём появления строк (кап 7с).
    await waitFor(() => (queryAllDeep('.single-source-container').filter(visible).length ? true : null), 7000, 500);
    await waitLastAnswerStable(10000); // дать последнему ответу дорисоваться, чтобы не поймать плейсхолдер
    // Заодно отдаём историю чата + подсказки (чтобы открытый блокнот сразу показал прошлый диалог).
    return { ok: true, sources: listSourcesDom(), chat: chatHistoryDom(), suggestions: chatSuggestionsDom() };
  }

  // ── список ВСЕХ блокнотов (для карточек на стороне TrendTraffic) ──
  // Плитка = <project-button> → <a href="/notebook/<uuid>"> + .project-button-title +
  // .project-button-subtitle («дата · N источников») + .project-button-box-icon (эмодзи).
  // background наводит вкладку на главную перед этим действием (плитки живут только там).
  async function listNotebooks() {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    ui.task(T('nlm_readingNotebooks', 'Читаю список блокнотов…'));
    const collected = new Map();
    // Плитки ищем по СОБСТВЕННОМУ тегу Google, а если он переименован при редизайне — по любой
    // ссылке на /notebook/<id> (это единственный признак, который не может исчезнуть: без него
    // плитка перестала бы открывать блокнот). Второй путь заодно ловит вёрстку без project-button.
    const tileNodes = () => {
      const own = queryAllDeep('project-button, .project-button').filter(visible);
      if (own.length) return own;
      const byLink = [];
      const seenHost = new Set();
      for (const a of queryAllDeep('a[href*="/notebook/"]').filter(visible)) {
        // поднимаемся к контейнеру плитки: там, кроме ссылки, лежат название/подпись/эмодзи
        let host = a;
        for (let i = 0; i < 3 && host && host.parentElement; i++) {
          if (clean(host.textContent).length > 8) break;
          host = host.parentElement;
        }
        if (host && !seenHost.has(host)) { seenHost.add(host); byLink.push(host); }
      }
      return byLink;
    };
    const scrapeVisible = () => {
      for (const pb of tileNodes()) {
        const a = pb.querySelector ? (pb.querySelector('a[href*="/notebook/"]') || (pb.matches && pb.matches('a[href*="/notebook/"]') ? pb : null)) : null;
        const m = a ? /notebook\/([a-z0-9-]+)/i.exec(a.getAttribute('href') || '') : null;
        const id = m ? m[1] : null;
        if (!id || collected.has(id)) continue;
        const titleEl = pb.querySelector('.project-button-title') || pb.querySelector('[class*="title" i]');
        const subEl = pb.querySelector('.project-button-subtitle') || pb.querySelector('[class*="subtitle" i]');
        const iconEl = pb.querySelector('.project-button-box-icon') || pb.querySelector('[class*="icon" i]');
        // Без узла названия берём первую строку текста плитки — лучше, чем «Без названия».
        const fallbackTitle = clean(pb.textContent).split(/·|\s{2,}/)[0];
        collected.set(id, {
          id,
          title: (clean(titleEl && titleEl.textContent) || fallbackTitle || 'Без названия').slice(0, 120),
          subtitle: clean(subEl && subEl.textContent).slice(0, 60),
          icon: clean(iconEl && iconEl.textContent).slice(0, 4),
        });
        if (collected.size > 250) break;
      }
    };
    // Клик по вкладке-фильтру (mat-button-toggle) по точному тексту.
    const clickFilter = async (label) => {
      const t = queryAllDeep('mat-button-toggle, [role="tab"], button, [class*="toggle" i]').filter(visible)
        .find((e) => norm(e.textContent) === label);
      if (!t) return false;
      clickEl(t);
      await waitFor(() => (tileNodes().length ? true : null), 6000, 400);
      await sleep(700);
      return true;
    };
    // ТОЛЬКО «Мои блокноты» + «Доступные мне» (исключаем «Рекомендуемые блокноты»).
    const gotMine = await clickFilter('мои блокноты');
    scrapeVisible();
    const gotShared = await clickFilter('доступные мне');
    if (gotShared) scrapeVisible();
    // Фолбэк: вкладок нет / ничего не собрали → берём видимое, но выкидываем плитки из секции «Рекомендуемые».
    if (!gotMine && !gotShared && !collected.size) {
      for (const pb of tileNodes()) {
        let sec = ''; let n = pb;
        for (let i = 0; i < 10 && n; i++) { if (/recommend|featured|рекоменд/i.test(String(n.className || ''))) { sec = 'rec'; break; } n = n.parentElement; }
        if (sec === 'rec') continue;
        const a = pb.querySelector ? (pb.querySelector('a[href*="/notebook/"]') || (pb.matches && pb.matches('a[href*="/notebook/"]') ? pb : null)) : null;
        const m = a ? /notebook\/([a-z0-9-]+)/i.exec(a.getAttribute('href') || '') : null;
        if (!m || collected.has(m[1])) continue;
        const titleEl = pb.querySelector('.project-button-title') || pb.querySelector('[class*="title" i]');
        collected.set(m[1], {
          id: m[1],
          title: (clean(titleEl && titleEl.textContent) || clean(pb.textContent).split(/·|\s{2,}/)[0] || 'Без названия').slice(0, 120),
          subtitle: clean((pb.querySelector('.project-button-subtitle') || {}).textContent).slice(0, 60),
          icon: clean((pb.querySelector('.project-button-box-icon') || {}).textContent).slice(0, 4),
        });
      }
    }
    const out = [...collected.values()].slice(0, 200);
    ui.line(T('nlm_notebooksCount', '✓ блокнотов (мои+доступные): ') + out.length);
    return { ok: true, notebooks: out };
  }
  async function deleteSource(sourceId) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    // Найти строку источника по id/тексту → меню ⋮ → «Удалить».
    const rows = queryAllDeep('[role="listitem"],[data-source-id]').filter(visible);
    const row = rows.find((r) => (r.getAttribute('data-source-id') === sourceId) || norm(r.textContent).includes(norm(sourceId)));
    if (!row) return { ok: false, reason: 'selector:source-row' };
    const menu = row.querySelector('[aria-label*="more" i],[aria-label*="ещё" i],button');
    if (menu) clickEl(menu);
    await sleep(500);
    if (!await clickByText(['delete', 'remove', 'удалить', 'убрать'])) return { ok: false, reason: 'selector:delete-source' };
    await sleep(1000);
    return { ok: true, sources: listSourcesDom() };
  }

  // Загрузочные плейсхолдеры NotebookLM в пузыре ответа («Scanning your sources…», «Assessing
  // relevance…», «Reading sources…» и т.п.) — их НЕ считаем ответом и НЕ переносим в историю.
  const CHAT_LOADING = /scanning your sources|assessing relevance|reading (full )?(chapters|sources)|analyz(ing|e)|searching|generating|thinking|reviewing|processing|looking through/i;
  function isLoadingText(t) {
    const s = clean(t);
    if (!s || s.length < 2) return true;
    // ВАЖНО: загрузочные фразы NotebookLM КОРОТКИЕ (<60). Длинный ответ, даже со словом
    // «analyze»/«searching» внутри, — НЕ загрузка. Поэтому весь детект гейтим по длине.
    if (s.length >= 60) return false;
    if (CHAT_LOADING.test(s)) return true;
    // Общая форма: короткая фраза, заканчивающаяся на «…»/«...» («Reading full chapters…» и пр.).
    if (/(…|\.\.\.)\s*$/.test(s)) return true;
    return false;
  }
  // Подсказки-продолжения (кликабельные чипы снизу чата) → массив строк.
  function chatSuggestionsDom() {
    return queryAllDeep('.follow-up-chip, [class*="follow-up-chip" i]').filter(visible)
      .map((e) => clean(e.textContent)).filter((t) => t.length > 3 && t.length < 300).slice(0, 8);
  }
  // Дождаться, пока ПОСЛЕДНИЙ ответ перестанет быть плейсхолдером и стабилизируется (при свежем
  // открытии блокнота ответ дорисовывается — иначе в историю попадёт «Assessing relevance…»).
  async function waitLastAnswerStable(maxMs) {
    if (!chatAnswersDom().length) return;
    let prev = null; let stable = 0; const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const a = chatAnswersDom();
      const cur = a.length ? a[a.length - 1].text : '';
      if (cur && !isLoadingText(cur) && cur === prev) { stable++; if (stable >= 2) return; } else stable = 0;
      prev = cur;
      await sleep(700);
    }
  }

  // ── чат ──
  // Разведано вживую: чат живёт в <chat-panel>; ввод = textarea[placeholder="Введите текст…"]
  // (aria «Поле для запросов»); кнопка отправки чата = иконка arrow_forward (у поиска источников
  // ДРУГАЯ кнопка «Отправить» с иконкой search — раньше кликали её → чат не слался → зависание);
  // ответ ассистента = .to-user-container (реплика юзера = .from-user-container).
  // ТОЧНО поле чата (не путать с полем ПОИСКА ИСТОЧНИКОВ): placeholder «Введите текст…» /
  // aria «Поле для запросов» / mat-mdc-autocomplete-trigger. Поиск источников исключаем по
  // aria/placeholder + классу РОВНО query-box-textarea: у САМОГО поля чата класс
  // query-box-input (живой DOM 10.07.2026), общий токен query-box выкидывал и его →
  // findChatInput возвращал null и chat() всегда падал с selector:chatInput.
  function findChatInput() {
    const isSearch = (el) => /найдите нов|источник|на основе введ/i.test(
      norm((el.getAttribute && el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute && el.getAttribute('placeholder') || '')))
      || /query-box-textarea/i.test(String(el.className || ''));
    const exact = queryAllDeep('textarea[placeholder*="введите текст" i],textarea[aria-label*="поле для запрос" i],textarea.mat-mdc-autocomplete-trigger,div[contenteditable="true"][role="textbox"]')
      .filter(visible).filter((e) => !isSearch(e));
    if (exact.length) return exact[exact.length - 1];
    const any = queryAllDeep('textarea').filter(visible).filter((e) => !isSearch(e));
    return any.length ? any[any.length - 1] : null;
  }
  async function chat(question) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    ui.task(T('nlm_asking', 'Спрашиваю: ') + String(question || '').slice(0, 60));
    // Поле чата рендерится не мгновенно (после прошлого ответа панель перерисовывается, стриминг) —
    // ждём его до ~15с, а не падаем сразу (частая ошибка selector:chatInput = гонка, 2-й вопрос).
    let inp = null;
    const inpT0 = Date.now();
    while (Date.now() - inpT0 < 15_000) { inp = findChatInput(); if (inp) break; await sleep(600); }
    if (!inp) return { ok: false, reason: 'selector:chatInput' };
    typeInto(inp, question || '');
    await sleep(400);
    const before = chatAnswersDom().length;
    // Кнопка чата — arrow_forward (НЕ «Отправить»-поиск источников с иконкой search).
    const sendBtn = queryAllDeep('button,[role="button"]').filter(visible)
      .find((e) => /arrow_forward/i.test(norm(e.textContent)) || norm(e.getAttribute('aria-label') || '') === 'отправить сообщение');
    if (sendBtn) clickEl(sendBtn);
    else inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // Ждём появления нового ответа ассистента (.to-user-container).
    const appeared = await waitFor(() => (chatAnswersDom().length > before ? true : null), 4 * 60_000, 800);
    if (!appeared) return { ok: false, reason: 'timeout' };
    // Стабилизация: КАЖДУЮ итерацию перезапрашиваем последний ответ и берём его АКТУАЛЬНЫЙ текст.
    // (Баг v1.2.1: возвращали текст, пойманный в момент появления пузыря = плейсхолдер
    // «Scanning your sources…» — стриминг ещё не начался.) Пропускаем плейсхолдер и ждём стабилизацию.
    let lastText = ''; let stable = 0; let finalText = '';
    for (let i = 0; i < 110; i++) { // до ~77с ожидания стриминга
      const arr = chatAnswersDom();
      const cur = arr.length ? arr[arr.length - 1].text : '';
      const ready = cur && cur.length > 2 && !isLoadingText(cur);
      if (ready && cur === lastText) { stable++; if (stable >= 2) { finalText = cur; break; } } else { stable = 0; }
      lastText = cur;
      await sleep(700);
    }
    if (!finalText) finalText = (lastText && !isLoadingText(lastText)) ? lastText : '';
    if (!finalText) return { ok: false, reason: T('nlm_answerIncomplete', 'ответ не дочитался') };
    ui.line(T('nlm_answerReceived', '✓ ответ получен'));
    // + подсказки-продолжения (чипы) — фронт покажет их кнопками.
    return { ok: true, answer: finalText, citations: [], suggestions: chatSuggestionsDom() };
  }
  // Ответ → Markdown (сохраняем ВЁРСТКУ: **жирный**, списки, абзацы) БЕЗ цитат-маркеров.
  // Разведано вживую: жирный = <b>/<strong>, списки = <ol>/<ul>+<li>, абзац = paragraph-element-view,
  // цитаты = <button class="citation-marker">. Проверено: «…Figma12.» → «…Figma.», заголовки в **…**.
  function cleanAnswerText(el) {
    if (!el) return '';
    try {
      const root = el.cloneNode(true);
      root.querySelectorAll('sup, button, mat-icon, [role="button"], [class*="citation" i], [class*="marker" i], [class*="footnote" i], [class*="chip" i], [class*="source-ref" i], [class*="ref-" i]').forEach((e) => e.remove());
      const inline = (node) => {
        let s = '';
        for (const c of node.childNodes) {
          if (c.nodeType === 3) { s += c.textContent; continue; }
          if (c.nodeType !== 1) continue;
          const t = c.tagName.toLowerCase();
          if (t === 'b' || t === 'strong') { const inner = inline(c).trim(); s += inner ? ('**' + inner + '**') : ''; }
          else if (t === 'i' || t === 'em') { const inner = inline(c).trim(); s += inner ? ('_' + inner + '_') : ''; }
          else if (t === 'br') s += '\n';
          else s += inline(c);
        }
        return s;
      };
      const blocks = [];
      const walk = (node) => {
        for (const c of node.childNodes) {
          if (c.nodeType === 3) { const tx = c.textContent.trim(); if (tx) blocks.push(tx); continue; }
          if (c.nodeType !== 1) continue;
          const t = c.tagName.toLowerCase();
          if (t === 'li') { const tx = inline(c).replace(/[ \t]+/g, ' ').trim(); if (tx) blocks.push('- ' + tx); }
          else if (t === 'p' || /paragraph-element-view/.test(t)) { const tx = inline(c).replace(/[ \t]+/g, ' ').trim(); if (tx) blocks.push(tx); }
          else if (/^h[1-6]$/.test(t)) { const tx = inline(c).replace(/\s+/g, ' ').trim(); if (tx) blocks.push('**' + tx + '**'); }
          else walk(c);
        }
      };
      walk(root);
      const md = blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
      return md || clean(root.textContent);
    } catch { return clean(el.textContent); }
  }
  // Ответ ассистента = .to-user-container; текст из внутреннего .message-content, БЕЗ цитат/кнопок.
  function chatAnswersDom() {
    const nodes = queryAllDeep('.to-user-container, [class*="to-user-container" i]').filter(visible);
    return nodes.map((el) => {
      const inner = el.querySelector('.message-content, [class*="message-content" i], [class*="to-user-message-inner" i]') || el;
      return { el, text: cleanAnswerText(inner), citations: [] };
    }).filter((x) => x.text.length > 1);
  }
  // История чата (для загрузки при открытии блокнота): пары user/assistant по порядку.
  // Ответы-плейсхолдеры («Assessing relevance…») пропускаем — иначе в историю попадёт загрузка.
  function chatHistoryDom() {
    const out = [];
    for (const cm of queryAllDeep('chat-message').filter(visible)) {
      const u = cm.querySelector('.from-user-container, [class*="from-user-container" i]');
      const b = cm.querySelector('.to-user-container, [class*="to-user-container" i]');
      const role = u ? 'user' : (b ? 'assistant' : '?');
      if (role === '?') continue;
      const inner = cm.querySelector('.message-content, .message-text-content, [class*="message-content" i]') || (u || b);
      // Ответы чистим от цитат; вопрос юзера — как есть.
      const text = (role === 'assistant' ? cleanAnswerText(inner) : clean(inner && inner.textContent)).slice(0, 4000);
      if (!text) continue;
      if (role === 'assistant' && isLoadingText(text)) continue;
      out.push({ role, text });
      if (out.length > 60) break;
    }
    return out;
  }
  async function listChat() {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    // Дать чат-панели прогрузить историю после навигации.
    await waitFor(() => (queryAllDeep('chat-message').filter(visible).length || queryAllDeep('.chat-panel-empty-state').filter(visible).length ? true : null), 8000, 500);
    await waitLastAnswerStable(12000); // дождаться, пока последний ответ дорисуется (не плейсхолдер)
    return { ok: true, chat: chatHistoryDom(), suggestions: chatSuggestionsDom() };
  }

  // ── генерация артефакта ──
  // Панель «Студия» всегда справа — отдельно открывать НЕ нужно. РАНЬШЕ клик по 'создать' попадал в
  // «Создать блокнот» → создавался новый пустой блокнот. Теперь no-op.
  async function openStudio() { await sleep(150); }
  function applyOption(field, value, folded) {
    if (value == null || value === '') return;
    const cands = (LABELS[field] && LABELS[field][value]) || [String(value)];
    const el = findByText(cands);
    if (el) clickEl(el);
    else folded.push(`${FIELD_RU[field] || field}: ${value}`); // не нашли контрол → в инструкцию
  }
  async function generate(gtype, params) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    const spec = GEN_UI[gtype];
    if (!spec) return { ok: false, reason: T('nlm_unknownType', 'неизвестный тип: ') + gtype };
    ui.task(T('nlm_generatingTask', 'Генерирую: ') + gtype);
    await openStudio();
    // 1) Открываем ПАНЕЛЬ НАСТРОЙКИ типа («Настроить аудиопересказ» и т.п.) — там опции + «Сгенерировать».
    //    Студия поднимается НЕ сразу (после навигации в блокнот) → ждём плитку до ~14с, не падаем сразу
    //    (частая ошибка selector:tile:audio была именно гонкой — плитки ещё нет на момент клика).
    let opened = false, tileClicked = false;
    const tileT0 = Date.now();
    while (Date.now() - tileT0 < 14_000) {
      if (await clickByText(spec.customize || [])) { opened = true; break; }
      if (await clickByText(spec.tiles)) { tileClicked = true; break; }
      await sleep(700);
    }
    if (!opened) {
      // Плитку тоже не нашли за отведённое время → студия не отрисовалась/не тот экран.
      if (!tileClicked) return { ok: false, reason: 'selector:tile:' + gtype };
      // Клик по самой плитке = генерация с дефолтами (без опций/фокуса).
      ui.line(T('nlm_genStartedPre', 'генерация запущена (') + gtype + T('nlm_genStartedDefaultSuf', ', дефолт), жду артефакт…'));
      const cap0 = await captureArtifact(gtype, spec);
      if (!cap0) return { ok: false, reason: 'timeout' };
      if (cap0.reason) return { ok: false, reason: cap0.reason };
      ui.line(T('nlm_artifactReadyPre', '✓ артефакт готов (') + gtype + ')');
      void markAllStudioSeen(); // наша джоба сама зальёт файл — вотчер не должен дублировать
      return { ok: true, ...cap0, fileName: (baseName(params) || gtype) + spec.ext, mime: spec.mime };
    }
    await sleep(1000);
    // 2) опции (format/length/…): найденное кликаем, ненайденное сворачиваем в фокус-инструкцию.
    const folded = [];
    for (const f of ['format', 'length', 'style', 'difficulty', 'count', 'orientation', 'detail']) {
      if (params && params[f] != null && params[f] !== '') applyOption(f, params[f], folded);
    }
    // 3) язык (best-effort; иначе — в инструкцию)
    if (params && params.language) {
      const langEl = findByText(['language', 'язык']);
      if (langEl) { clickEl(langEl); await sleep(300); if (!await clickByText([String(params.language)])) folded.push('язык: ' + params.language); }
      else folded.push('язык: ' + params.language);
    }
    // 4) фокус/инструкции (поле «На чём сделать акцент») + свёрнутые опции
    const focusText = [String((params && params.focus) || '').trim(), folded.join('. ')].filter(Boolean).join('. ');
    if (focusText) { const box = pickDeep(SEL.instructions); if (box) typeInto(box, focusText); }
    // 5) ЗАПУСК — РОВНО «Сгенерировать» (НЕ «создать» → это «Создать блокнот»!).
    await sleep(300);
    if (!await clickByText(['сгенерировать', 'generate', 'запустить генерацию'])) return { ok: false, reason: 'selector:generate:' + gtype };
    ui.line(T('nlm_genStartedPre', 'генерация запущена (') + gtype + T('nlm_genStartedSuf', '), жду артефакт…'));
    // 6) ждать артефакт и захватить
    const captured = await captureArtifact(gtype, spec);
    if (!captured) return { ok: false, reason: 'timeout' };
    if (captured.reason) return { ok: false, reason: captured.reason };
    ui.line(T('nlm_artifactReadyPre', '✓ артефакт готов (') + gtype + ')');
    void markAllStudioSeen(); // наша джоба сама зальёт файл — вотчер не должен дублировать
    return { ok: true, ...captured, fileName: (baseName(params) || gtype) + spec.ext, mime: spec.mime };
  }
  const baseName = (p) => (p && p.__name) ? String(p.__name).slice(0, 80) : '';

  // Захват результата по типу. media → <audio>/<video>/<img>; doc/json/csv → ссылка на файл или скрейп.
  async function captureArtifact(gtype, spec) {
    const started = Date.now();
    const MAXW = { audio: 20 * 60_000, video: 30 * 60_000, infographic: 12 * 60_000 }[gtype] || 10 * 60_000;
    while (Date.now() - started < MAXW) {
      const stillGen = () => queryAllDeep('*').filter(visible).some((e) => /создаём (аудио|видео)|создаем (аудио|видео)|вернитесь через|generating|создаётся|создается/i.test(norm(e.textContent)) && norm(e.textContent).length < 60);
      if (spec.kind === 'media') {
        // Инфографика — обычный <img>, читаем напрямую.
        if (gtype === 'infographic') {
          const el = pickMedia('infographic');
          if (el) { const got = await grabMediaData(el); if (got && (got.dataUrl || got.sourceUrl)) return got; }
        } else if (!stillGen()) {
          // Аудио/видео: <audio>/<video> у NotebookLM НЕ создаётся (плеер на MSE). Готовый артефакт
          // качаем через меню карточки (⋮ → «Скачать»). Приоритет — перехват BLOB на самой странице
          // (injected-nlm: надёжно для blob/data, что chrome.downloads в фоне не стянет); фолбэк —
          // background chrome.downloads (для http-скачиваний).
          lastArtifact = null;
          if (await triggerArtifactDownload(gtype)) {
            ui.line(T('nlm_dlRequested', 'запросил скачивание артефакта…'));
            const t0 = Date.now();
            while (Date.now() - t0 < 15_000) {
              if (lastArtifact && lastArtifact.dataUrl) return { dataUrl: lastArtifact.dataUrl, mime: lastArtifact.mime || spec.mime };
              await sleep(500);
            }
            return { viaDownload: true }; // blob не перехватили → пусть ловит background (http)
          }
        }
      } else {
        // doc/json/csv: сперва ссылка на файл (download-якорь/CDN), иначе скрейп текста.
        const url = findArtifactUrl();
        if (url) { try { const d = await pageFetchDataUrl(url); const p = parsePayload(spec, d); return { dataUrl: d, payload: p }; } catch { /* → скрейп */ } }
        const scraped = scrapeArtifactText(gtype);
        if (scraped) return scraped;
      }
      await sleep(4000);
    }
    return null;
  }
  // Готовый аудио/видео артефакт: найти его ⋮ (меню карточки) → «Скачать». Проверено вживую:
  // у карточки («19:44 · Подробный анализ …») есть ⋮ → «save_alt Скачать» → RPC → загрузка файла.
  async function triggerArtifactDownload(gtype) {
    const near = (b) => { let n = b; for (let i = 0; i < 6 && n; i++) { if (/\d+:\d\d|подробный анализ|аудиопересказ|видеопересказ|краткий обзор/i.test(clean(n.textContent))) return true; n = n.parentElement; } return false; };
    const more = queryAllDeep('button,[role="button"]').filter(visible)
      .filter((b) => /more_vert|^ещё$/i.test(norm(b.getAttribute('aria-label') || b.textContent)))
      .find(near);
    if (!more) return false;
    clickEl(more);
    await sleep(1000);
    // Пункт меню «Скачать» (save_alt) — НЕ «Скачать блокнот».
    const item = queryAllDeep('[role="menuitem"],button,a').filter(visible)
      .find((e) => isDownloadItem(elText(e)));
    if (!item) { closeOpenMenu(); return false; }
    clickEl(item);
    await sleep(1500);
    return true;
  }
  // Закрыть зависшее ⋮-меню (клик по backdrop CDK-оверлея; фолбэк — Escape), чтобы оно не
  // оставалось поверх UI юзера и не ловилось следующим сканом.
  function closeOpenMenu() {
    try {
      const bd = document.querySelector('.cdk-overlay-backdrop');
      if (bd) { bd.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    } catch { /* */ }
  }

  // ── УЖЕ ГОТОВЫЕ работы студии в открытом блокноте (не наши джобы) ──
  // Разведано: карточка готовой работы = контейнер с длительностью m:ss / типом + кнопки
  // «Воспроизвести» (▶) и «Ещё» (⋮). Собираем их, чтобы показать в приложении с кнопкой «Загрузить».
  // Оба из nlm-text.js: ARTKIND_RE матчит ОСНОВАМИ («аудиопе», «инфогра»), чтобы переживать
  // обрезку подписей многоточием, и знает EN-названия под брендом Gemini Notebook.
  const DUR_RE = TXT ? TXT.DUR_RE : /\b\d{1,2}:\d\d\b/;
  const ARTKIND_RE = TXT ? TXT.ARTKIND_RE : /аудиопе|видеопе|инфогра|менталь|презент|таблиц|карточк|отч[её]т|тест|обзор/i;
  // el внутри root с учётом shadow DOM (Node.contains не пересекает shadow-границы).
  function withinDeep(el, root) {
    let n = el;
    while (n) { if (n === root) return true; n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null; }
    return false;
  }
  const isMoreBtn = (b) => /more_vert|^ещё$/i.test(norm(b.getAttribute('aria-label') || b.textContent));
  function studioArtifactCards() {
    // ТОЛЬКО панель «Студия»: раньше сканили ВСЮ страницу, и ⋮ ИСТОЧНИКА, поднимаясь по DOM,
    // дорастал до контейнера со всей страницей (в нём есть m:ss из студии) → «карточкой» становилась
    // склейка источников, клик по ней уносил на главную NotebookLM (живой инцидент 10.07).
    const scope = studioPanelRoot();
    const scoped = collectStudioCards(scope);
    // скоуп нашёлся, но пуст (заголовок «Студия» мог сидеть в мелком контейнере) → скан без скоупа:
    // лимит 400 симв. + «ровно одна ⋮» сами отсекают источники и контейнеры-«гиганты».
    return (scope && !scoped.length) ? collectStudioCards(null) : scoped;
  }
  function collectStudioCards(scope) {
    const cards = [];
    const seen = new Set();
    const moreBtns = queryAllDeep('button,[role="button"]').filter(visible).filter(isMoreBtn)
      .filter((b) => !scope || withinDeep(b, scope));
    for (const mb of moreBtns) {
      // поднимаемся к карточке артефакта (где рядом длительность/тип); разрослись — значит проскочили
      let card = mb;
      for (let i = 0; i < 7 && card; i++) {
        const txt = clean(card.textContent);
        if (txt.length > 400) { card = null; break; } // это уже панель/страница, не карточка
        if (DUR_RE.test(txt) || ARTKIND_RE.test(txt)) break;
        card = card.parentElement;
      }
      if (!card) continue;
      const full = clean(card.textContent);
      if (full.length > 400) continue;
      if (!(DUR_RE.test(full) || ARTKIND_RE.test(full))) continue; // не карточка артефакта (напр. ⋮ источника)
      if (isGeneratingText(full)) continue; // ещё ГЕНЕРИТСЯ («Создаю аудиопересказ, вернитесь через…») — не готовая
      // настоящая карточка содержит РОВНО одну ⋮ (несколько ⋮ = список/панель целиком)
      if ([...(card.querySelectorAll ? card.querySelectorAll('button,[role="button"]') : [])].filter(isMoreBtn).length > 1) continue;
      // ОТКРЫТАЯ работа (плеер видео/аудио с ползунком) — не карточка списка: её «заголовок» =
      // мусор из иконок share/download + чипов, нестабилен между сканами → плодил дубликаты (4 копии).
      if (card.querySelector && (card.querySelector('[role="slider"],input[type="range"],video') || null)) continue;
      if (seen.has(card)) continue; seen.add(card);
      // заголовок = текст ДО длительности/типа; чистим служебное (вкл. НАШУ инжект-кнопку «⬇TT» и её
      // состояния — иначе на следующем цикле заголовок «Название ⬇TT» не совпадёт с базлайном → дубликаты)
      // + ЛЮБЫЕ snake_case-лигатуры Material-иконок (cards_star, save_alt…) — они попадают в textContent.
      const title = TXT ? TXT.cardTitle(full) : (full.split(/·|\s{2,}/)[0].replace(DUR_RE, '').trim() || 'Артефакт NotebookLM');
      const hasPlay = [...(card.querySelectorAll ? card.querySelectorAll('button,[role="button"]') : [])]
        .some((b) => /play_arrow|воспроизвести/i.test(norm(b.getAttribute('aria-label') || b.textContent)));
      cards.push({ el: card, more: mb, title, kind: hasPlay ? 'media' : 'doc' });
    }
    return cards;
  }
  async function listStudioArtifacts() {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    // студия рендерится не сразу после навигации — ждём карточки до ~10с
    let cards = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 10_000) { cards = studioArtifactCards(); if (cards.length) break; await sleep(700); }
    return { ok: true, artifacts: cards.map((c, i) => ({ index: i, title: c.title, kind: c.kind })) };
  }
  async function downloadStudioArtifact(payload) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    let cards = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 10_000) { cards = studioArtifactCards(); if (cards.length) break; await sleep(700); }
    const idx = (typeof payload.index === 'number') ? payload.index : -1;
    const card = (idx >= 0 && idx < cards.length) ? cards[idx]
      : cards.find((c) => payload.title && norm(c.title).includes(norm(String(payload.title).slice(0, 40))));
    if (!card) return { ok: false, reason: 'artifact-not-found' };
    lastArtifact = null;
    clickEl(card.more);
    await sleep(1000);
    const item = queryAllDeep('[role="menuitem"],button,a').filter(visible)
      .find((e) => isDownloadItem(elText(e)));
    if (!item) { closeOpenMenu(); return { ok: false, reason: 'selector:download-item' }; }
    clickEl(item);
    await sleep(1500);
    // ждём перехваченные байты (injected-nlm) до ~30с
    const wt0 = Date.now();
    while (Date.now() - wt0 < 30_000) {
      if (lastArtifact && lastArtifact.dataUrl) return { ok: true, dataUrl: lastArtifact.dataUrl, mime: lastArtifact.mime || '', fileName: card.title };
      await sleep(500);
    }
    return { ok: false, reason: T('nlm_dlCaptureFailed', 'не удалось перехватить скачивание артефакта') };
  }

  // ── ВОТЧЕР СТУДИИ: юзер работает ПРЯМО в NotebookLM ─────────────────────────
  // Каждые ~20с: (1) карточки «генерируется…» → индикаторы в приложении; (2) НОВЫЕ готовые
  // работы (нет в базлайне) → авто-скачивание в Галерею; (3) кнопка «в Галерею» у каждой готовой.
  function detectGtype(text) {
    const t = norm(text);
    if (/видео|video/.test(t)) return 'video';
    if (/презентац|slide/.test(t)) return 'slides';
    if (/отч[её]т|report|брифинг|учебное|блог/.test(t)) return 'report';
    if (/тест|quiz/.test(t)) return 'quiz';
    if (/таблиц|table/.test(t)) return 'table';
    if (/инфографик|infographic/.test(t)) return 'infographic';
    if (/карточк|flashcard/.test(t)) return 'flashcards';
    if (/ментальн|mind\s?map/.test(t)) return 'mindmap';
    return 'audio'; // m:ss / подробный анализ / дебаты / краткий обзор
  }
  // ВАЖНО: NotebookLM показывает плейсхолдер незавершённой работы как «Создаю аудиопересказ,
  // вернитесь через несколько минут» — глагол «Создаю» (1-е лицо), а НЕ «создаётся». Без него
  // плейсхолдер не считался генерацией (нет спиннера) И попадал в «готовые» (совпадал
  // «аудиопересказ») → вотчер качал пустышку → «не перехватил файл». Ловим все формы + «вернитесь».
  // ГЕНЕРАЦИЯ (не просто совпадение слова): либо явный плейсхолдер NotebookLM «…вернитесь через…»/
  // «generating/preparing», либо глагол создания РЯДОМ С ТИПОМ артефакта (аудиопересказ/видео/…).
  // Гейт !DUR_RE: у ГОТОВОЙ работы ВСЕГДА есть длительность m:ss, у плейсхолдера — нет. Так карточка
  // с глаголом в НАЗВАНИИ («Создаю бренд 6:46») не ловится ложно, а текст чата/источников — тоже нет.
  // «это может занять» — плейсхолдер ВИДЕОпересказа: «Генерация поясняющего видео. Это может занять
  // некоторое время.» (сущ. «Генерация», а не глагол — глагольная ветка его не ловила, живой баг 10.07).
  // Реализация — в nlm-text.js (там же расширенный список плейсхолдеров: Google переписал их
  // вместе с редизайном студии, добавлены «вернитесь позже», «check back», «this may take»).
  const isGeneratingText = TXT ? TXT.isGeneratingText : ((t) => !DUR_RE.test(t) && (
    /вернитесь через|это может занять|\bgenerating\b|\bpreparing\b|генериру[ею]тся/i.test(t)
    || (/(генераци|создаю|создаё?тся|создаё?м|создается|готовлю|обрабатыва|creating)/i.test(t) && ARTKIND_RE.test(t))));
  // Панель «Студия» справа: сканим ТОЛЬКО её (по заголовку «Студия»/Studio) — не чат, не источники.
  function studioPanelRoot() {
    // Заголовок панели тоже может приехать обрезанным («Студи…») — снимаем многоточие перед сверкой.
    const isStudioHead = (e) => /^(студия|studio)$/i.test(TXT ? TXT.stripEllipsis(clean(e.textContent)) : clean(e.textContent));
    const head = queryAllDeep('h1,h2,h3,[role="heading"],[aria-label],span,div').filter(visible)
      .find((e) => isStudioHead(e) || /^(студия|studio)$/i.test(clean((e.getAttribute && e.getAttribute('aria-label')) || '')));
    if (!head) return null;
    let n = head; for (let i = 0; i < 6 && n; i++) { if (n.parentElement && n.parentElement.querySelectorAll && n.parentElement.querySelectorAll('button,[role="button"]').length > 3) return n.parentElement; n = n.parentElement; }
    return head.parentElement || null;
  }
  function studioGeneratingCards() {
    // блоки с текстом плейсхолдера — КОРОТКИЕ листовые контейнеры В ПАНЕЛИ СТУДИИ (если нашли её)
    const hits = [];
    const scope = studioPanelRoot();
    const pool = scope ? [...scope.querySelectorAll('div,span,section,li')] : queryAllDeep('div,span,section,li');
    for (const el of pool) {
      if (!visible(el)) continue;
      try { const rh = el.getRootNode && el.getRootNode().host; if (rh && rh.id === 'tt-nlm-host') continue; } catch { /* */ }
      try { if (el.closest && el.closest('chat-panel,.chat-panel,[data-testid*="chat" i]')) continue; } catch { /* */ }
      const t = clean(el.textContent);
      if (!t || t.length > 160 || !isGeneratingText(t)) continue;
      if ([...(el.children || [])].some((c) => isGeneratingText(clean(c.textContent)))) continue; // не листовой
      hits.push(t);
      if (hits.length >= 8) break;
    }
    // заголовок = часть до «генерируется»; тип — по нему же
    return [...new Set(hits)].map((t) => {
      // «Создаю аудиопересказ, вернитесь через…» → берём часть ДО глагола создания как заголовок,
      // если пусто — сам текст (тип определяем по «аудиопересказ»/«видео»/… внутри).
      let title = t.split(/генерир|создаю|создаё?м|создаётся|создается|готовлю|обрабат|generating|creating/i)[0].trim();
      if (title.length < 3) title = t.replace(/,?\s*вернитесь через.*$/i, '').trim();
      return { title: (title || 'Генерация NotebookLM').slice(0, 120), gtype: detectGtype(t) };
    });
  }
  const seenKey = (nbId) => 'nlmSeen:' + nbId;
  const storageGet = (k) => new Promise((res) => { try { chrome.storage.local.get(k, (d) => res(d && d[k])); } catch { res(undefined); } });
  const storageSet = (k, v) => new Promise((res) => { try { chrome.storage.local.set({ [k]: v }, () => res()); } catch { res(); } });
  async function markAllStudioSeen() {
    const nbId = notebookIdFromUrl();
    if (!nbId) return;
    // МЕРЖ, не замена: пустой/частичный снимок (студия перерисовывается) не должен стереть базлайн —
    // иначе следующий цикл вотчера сочтёт все старые работы «новыми» и массово зальёт их.
    const titles = studioArtifactCards().map((c) => norm(c.title));
    if (!titles.length) return;
    const prev = await storageGet(seenKey(nbId));
    await storageSet(seenKey(nbId), [...new Set([...(Array.isArray(prev) ? prev : []), ...titles])].slice(-500));
  }
  // Кнопка «в Галерею» рядом с готовой работой студии (инжект в саму страницу NotebookLM).
  function injectGalleryButtons(cards) {
    for (const c of cards) {
      try {
        if (!c.more || !c.more.parentElement) continue;
        if (c.more.parentElement.querySelector('.tt-dl-btn')) continue;
        const btn = document.createElement('button');
        btn.className = 'tt-dl-btn';
        btn.type = 'button';
        btn.title = T('nlm_dlToGalleryTitle', 'Скачать в Галерею TrendTraffic');
        btn.textContent = '⬇TT';
        btn.style.cssText = 'margin:0 4px;padding:2px 7px;border:none;border-radius:8px;background:#22d3ee;color:#083344;font:700 10px ui-sans-serif,system-ui;cursor:pointer;vertical-align:middle;';
        btn.addEventListener('click', async (e) => {
          e.preventDefault(); e.stopPropagation();
          // мьютекс с вотчером/командами: одновременные захваты делят lastArtifact и ⋮-меню
          if (btn.dataset.busy || watcherBusy || actionBusy) return;
          btn.dataset.busy = '1'; watcherBusy = true; btn.textContent = '…'; btn.style.opacity = '0.7';
          let r = null;
          try { r = await captureCardToGallery(c); }
          finally { watcherBusy = false; btn.dataset.busy = ''; btn.style.opacity = '1'; }
          btn.textContent = r && r.ok ? '✓' : '⚠';
          setTimeout(() => { btn.textContent = '⬇TT'; }, 4000);
        });
        c.more.insertAdjacentElement('beforebegin', btn);
      } catch { /* карточка перерисовалась */ }
    }
  }
  // (Батч-заливка «все сразу» удалена 10.07 по решению юзера: загрузка ТОЛЬКО по клику из перечня
  // «⬇ В галерею» в виджете или кнопкой ⬇TT у карточки; сервер дедуплит уже залитое.)

  // Скачать конкретную карточку (⋮→Скачать→blob) и отдать в Галерею через background.
  let watcherBusy = false;
  async function captureCardToGallery(card) {
    const nbId = notebookIdFromUrl();
    const gtype = detectGtype((card.el && card.el.textContent) || card.title);
    lastArtifact = null;
    lastOpenUrl = null;
    // ВЗВОДИМ фоновый перехват браузерной загрузки ДО клика «Скачать»: аудио/видео NotebookLM часто
    // качаются прямой подписанной ссылкой (не blob) — MAIN-хук их не видит, фон ловит в chrome.downloads.
    const arm = await send({ type: 'nlm-arm-download', notebookId: nbId, title: card.title, gtype });
    const capId = arm && arm.capId;
    // ВСЕГДА снимаем фоновый перехват на выходе (blob-путь / текст-фолбэк / фейл) — иначе он ещё до 40с
    // поймал бы загрузку СЛЕДУЮЩЕЙ карточки и залил её под ЭТИМ заголовком. Если фон уже поймал — no-op.
    try {
      clickEl(card.more);
      await sleep(1000);
      const item = queryAllDeep('[role="menuitem"],button,a').filter(visible)
        .find((e) => isDownloadItem(elText(e)));
      if (!item) {
        // У части типов (карточки/тест/ментальная карта…) в ⋮ НЕТ «Скачать» — файл не предусмотрен.
        // Фолбэк: открываем работу кликом по карточке, снимаем видимый текст и заливаем как .md.
        closeOpenMenu();
        ui.line(T('nlm_noDownloadPre', 'у «') + card.title.slice(0, 30) + T('nlm_noDownloadSuf', '» нет «Скачать» — снимаю текстом…'));
        return await captureCardAsText(card);
      }
      clickEl(item);
      // Ждём ЛЮБОЙ из трёх источников файла: (1) blob из MAIN-хука; (2) URL из window.open —
      // «Скачать» аудио часто открывает подписанный URL новой вкладкой, Chrome блокирует попап без
      // юзер-жеста, но URL мы перехватили ДО блокировки; (3) фоновый перехват chrome.downloads.
      const wt0 = Date.now();
      let bg = null;
      while (Date.now() - wt0 < 40_000) {
        if (lastArtifact && lastArtifact.dataUrl) break;
        if (lastOpenUrl && lastOpenUrl.ts >= wt0 - 2000) break;
        bg = await send({ type: 'nlm-download-result', capId });
        if (bg && bg.done) break;
        await sleep(700);
      }
      if (lastArtifact && lastArtifact.dataUrl) {
        const r = await send({
          type: 'nlm-observed-artifact', notebookId: nbId, title: card.title,
          gtype, dataUrl: lastArtifact.dataUrl, mime: lastArtifact.mime || '',
        });
        if (r && r.ok) ui.line(T('nlm_okQuote', '✓ «') + card.title.slice(0, 40) + T('nlm_toGallerySuf', '» → Галерея') + (r.dedup ? T('nlm_alreadyWas', ' (уже была)') : ''));
        else ui.line(T('nlm_notSaved', '⚠ не сохранилось: ') + ((r && r.error) || T('nlm_noConnection', 'нет подключения')));
        return r || { ok: false };
      }
      if (lastOpenUrl && lastOpenUrl.ts >= wt0 - 2000) {
        // Фон скачает байты по перехваченному URL (сессия та же — host_permissions) и зальёт сам.
        const r = await send({ type: 'nlm-ingest-url', url: lastOpenUrl.url, notebookId: nbId, title: card.title, gtype });
        if (r && r.ok) ui.line(T('nlm_okQuote', '✓ «') + card.title.slice(0, 40) + T('nlm_toGallerySuf', '» → Галерея') + (r.dedup ? T('nlm_alreadyWas', ' (уже была)') : ''));
        else ui.line(T('nlm_urlDlFailed', '⚠ не скачалось по URL: ') + ((r && r.error) || T('nlm_noConnection', 'нет подключения')));
        return r || { ok: false };
      }
      // blob не пришёл — но фон мог поймать прямую загрузку и уже залить.
      if (bg && bg.done && bg.ok) { ui.line(T('nlm_okQuote', '✓ «') + card.title.slice(0, 40) + T('nlm_toGallerySuf', '» → Галерея') + (bg.dedup ? T('nlm_alreadyWas', ' (уже была)') : '')); return { ok: true, dedup: bg.dedup }; }
      ui.line(T('nlm_fileCaptureFailedPre', '⚠ не перехватил файл «') + card.title.slice(0, 30) + '»' + (bg && bg.error ? ': ' + bg.error : ''));
      return { ok: false };
    } finally {
      try { await send({ type: 'nlm-disarm-download', capId }); } catch { /* */ }
    }
  }
  // Фолбэк-захват «текстом»: открыть работу кликом → снять видимый текст → назад → залить .md.
  // Для типов без файла (карточки/тест/ментальная карта/таблица) — лучше текст, чем ничего.
  async function captureCardAsText(card) {
    const nbId = notebookIdFromUrl();
    try { clickEl(card.el); } catch { return { ok: false }; }
    await sleep(2500);
    // Клик увёл СО СТРАНИЦЫ БЛОКНОТА (на главную/другой блокнот — попали в ссылку, не в карточку)?
    // Возвращаемся и прерываемся — иначе наскрейпим главную и зальём мусор под заголовком карточки.
    if (notebookIdFromUrl() !== nbId) {
      ui.line(T('nlm_clickLeftNotebook', '⚠ клик увёл со страницы блокнота — возвращаюсь'));
      try { history.back(); } catch { /* */ }
      await sleep(2000);
      return { ok: false };
    }
    const scraped = scrapeArtifactText('report'); // видимый текст открытой работы → markdown
    // назад к студии: кнопка «Назад»/arrow_back, иначе Escape (оверлей), иначе history.back()
    const back = queryAllDeep('button,[role="button"]').filter(visible)
      .find((b) => /arrow_back|^назад$|^back$/i.test(norm(b.getAttribute('aria-label') || b.textContent)));
    if (back) clickEl(back);
    else { closeOpenMenu(); try { history.back(); } catch { /* */ } }
    await sleep(1200);
    if (!scraped || !scraped.dataUrl) { ui.line(T('nlm_textNotCapturedPre', '⚠ текст «') + card.title.slice(0, 30) + T('nlm_textNotCapturedSuf', '» не снялся')); return { ok: false }; }
    const r = await send({
      type: 'nlm-observed-artifact', notebookId: nbId, title: card.title,
      gtype: detectGtype((card.el && card.el.textContent) || card.title), dataUrl: scraped.dataUrl, mime: 'text/markdown',
    });
    if (r && r.ok) ui.line(T('nlm_okQuote', '✓ «') + card.title.slice(0, 40) + T('nlm_toGalleryTextSuf', '» → Галерея (текстом)') + (r.dedup ? T('nlm_alreadyWas', ' (уже была)') : ''));
    else ui.line(T('nlm_notSaved', '⚠ не сохранилось: ') + ((r && r.error) || T('nlm_noConnection', 'нет подключения')));
    return r || { ok: false };
  }

  async function studioWatcher() {
    if (watcherBusy || actionBusy) return; // не мешаем идущей команде (generate/chat кликают в DOM)
    const nbId = notebookIdFromUrl();
    if (!nbId || !isLoggedIn()) return;
    watcherBusy = true;
    try {
      const ready = studioArtifactCards();
      const gen = studioGeneratingCards();
      injectGalleryButtons(ready);
      // индикаторы в приложении (спиннер на карточке блокнота/вкладке/сайдбаре)
      send({ type: 'nlm-observed', notebookId: nbId, generating: gen });
      // АВТОЗАГРУЗКИ БОЛЬШЕ НЕТ (решение юзера 10.07): готовые работы заливаются ТОЛЬКО вручную —
      // кнопкой ⬇TT у карточки или через перечень «⬇ В галерею» в виджете (клик по работе = загрузка).
      // Дедуп на сервере: то, что уже в Галерее, повторно не зальётся.
    } catch { /* не мешаем работе юзера */ }
    finally { watcherBusy = false; }
  }
  setInterval(() => { void studioWatcher(); }, 20_000);
  setTimeout(() => { void studioWatcher(); }, 4000);

  // ── Кнопка «9:16» в диалогах настройки студии ────────────────────────────────
  // Юзер открыл «Настройка видеообзора / инфографики / презентации / отчёта» → над полем
  // инструкций появляется чип «📱 9:16»: клик ДОПИСЫВАЕТ (не затирая введённое) английский
  // промпт вертикального формата — управляющие инструкции NotebookLM понимает лучше на англ.
  // Правила — в nlm-text.js (основы вместо полных слов: заголовок диалога тоже обрезается).
  const V916 = TXT ? TXT.V916 : [];
  // Диалог «Добавить источники» — НЕ наш: его заголовок-реклама «Создавайте аудиопересказы и
  // ВИДЕООБЗОРЫ…» матчился V916, textarea поиска источников сходила за поле инструкций → чип
  // «9:16» вставлялся в поле поиска и ломал его (баг 15.07, «не могу добавить источники»).
  // Узнаём его по УНИКАЛЬНЫМ контролам загрузки (в диалогах настройки студии их не бывает).
  const SRC_DLG_RE = TXT ? TXT.SRC_DLG_RE
    : /перетащить файлы|загрузить файлы|скопированный текст|найдите новые источники|добавьте источник|drag (and|&) drop|upload (a )?file|copied text|discover sources/i;
  function inject916() {
    try {
      // Диалоги Angular CDK живут в overlay-контейнере В СВЕТЛОМ DOM → обычный querySelectorAll дешёв.
      const dialogs = [...document.querySelectorAll('[role="dialog"], mat-dialog-container')].filter(visible);
      for (const dlg of dialogs) {
        if (dlg.querySelector('.tt-916-btn')) continue;
        const full = clean(dlg.textContent);
        if (SRC_DLG_RE.test(full)) continue; // «Добавить источники» — не трогаем вовсе
        const ta = [...dlg.querySelectorAll('textarea')].filter(visible)[0];
        if (!ta) continue;
        // Поле должно быть про инструкции, а не ПОИСК источников (второй предохранитель;
        // нарочно узкий — плейсхолдер поля инструкций может упоминать «источники» легально).
        const taHint = clean((ta.getAttribute('placeholder') || '') + ' ' + (ta.getAttribute('aria-label') || ''));
        if (/найдите|поиск|search|discover/i.test(taHint)) continue;
        const head = full.slice(0, 160);
        const hit = V916.find((v) => v.re.test(head));
        if (!hit) continue; // аудио и прочие типы без вертикальной вёрстки — не предлагаем
        const btn = document.createElement('button');
        btn.className = 'tt-916-btn';
        btn.type = 'button';
        btn.textContent = T('nlm_916Btn', '📱 9:16 вертикально');
        btn.title = T('nlm_916Title', 'Дописать промпт вертикального формата 9:16 (Shorts/Reels/TikTok). Промпт на английском — так NotebookLM понимает инструкции лучше всего.');
        btn.style.cssText = 'display:inline-block;margin:0 0 8px;padding:4px 10px;border:none;border-radius:8px;background:#22d3ee;color:#083344;font:700 12px ui-sans-serif,system-ui;cursor:pointer;';
        btn.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          const cur = ta.value || '';
          if (/9:16/.test(cur)) btn.textContent = T('nlm_916Already', '✓ уже добавлено');
          else { typeInto(ta, cur.trim() ? cur.trim() + '\n' + hit.prompt : hit.prompt); btn.textContent = T('nlm_916Added', '✓ добавлено'); }
          setTimeout(() => { btn.textContent = T('nlm_916Btn', '📱 9:16 вертикально'); }, 2500);
        });
        // над полем инструкций (вместе с обёрткой mat-form-field, чтобы не ломать вёрстку поля)
        const anchor = ta.closest('mat-form-field, [class*="form-field"]') || ta;
        anchor.insertAdjacentElement('beforebegin', btn);
      }
    } catch { /* диалог перерисовался — вставим на следующем тике */ }
  }
  setInterval(inject916, 2000);

  function pickMedia(gtype) {
    if (gtype === 'infographic') return queryAllDeep('img').filter(visible).filter((i) => i.clientWidth >= 200 && i.clientHeight >= 200).sort(byArea)[0] || null;
    const tag = gtype === 'video' ? 'video' : 'audio';
    const list = queryAllDeep(tag).filter((m) => (m.currentSrc || m.src || (m.querySelector && m.querySelector('source') && m.querySelector('source').src)));
    return list[list.length - 1] || null;
  }
  const byArea = (a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight);
  const usableSrc = (el) => (el.currentSrc || el.src || (el.querySelector && el.querySelector('source') ? el.querySelector('source').src : '') || '');
  function findArtifactUrl() {
    const a = queryAllDeep('a[download],a[href*="googleusercontent"],a[href$=".pdf"],a[href$=".md"],a[href$=".csv"],a[href$=".pptx"]').filter(visible)[0];
    return a ? a.href : '';
  }
  function scrapeArtifactText(gtype) {
    // Крайний фолбэк: собрать видимый текст последнего артефакта как markdown.
    const cont = queryAllDeep('[class*="artifact" i],[class*="report" i],[role="article"],[class*="studio" i] [class*="content" i]').filter(visible).sort(byArea)[0];
    const text = cont ? (cont.innerText || cont.textContent || '').trim() : '';
    if (text.length < 20) return null;
    const dataUrl = 'data:text/markdown;base64,' + b64(text);
    return { dataUrl, payload: null };
  }
  function parsePayload(spec, dataUrl) {
    try {
      const m = /^data:[^;]+;base64,(.*)$/s.exec(dataUrl); if (!m) return null;
      const text = decodeURIComponent(escape(atob(m[1])));
      if (spec.kind === 'json') return JSON.parse(text);
      if (spec.kind === 'csv') { const rows = text.split(/\r?\n/).map((r) => r.split(',')); return rows.length ? { headers: rows[0], rows: rows.slice(1, 200) } : null; }
    } catch { /* */ }
    return null;
  }

  // ── общие медиа-хелперы (как в content-flow) ──
  function blobToDataUrl(blob) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(blob); });
  }
  async function pageFetchDataUrl(url) {
    const tryF = async (opts) => { try { const r = await fetch(url, opts); return r.ok ? r : null; } catch { return null; } };
    const res = (await tryF({})) || (await tryF({ credentials: 'include' }));
    if (!res) throw new Error('page fetch fail');
    const blob = await res.blob();
    if (blob.size < 32) throw new Error('пусто');
    if (blob.size > 200 * 1024 * 1024) throw new Error('слишком большое (>200МБ)');
    return await blobToDataUrl(blob);
  }
  async function grabMediaData(el) {
    const src = usableSrc(el);
    if (!src) return {};
    if (src.startsWith('data:')) return { dataUrl: src };
    if (src.startsWith('blob:')) { try { return { dataUrl: await blobToDataUrl(await (await fetch(src)).blob()) }; } catch { return { sourceUrl: src }; } }
    try { return { dataUrl: await pageFetchDataUrl(src) }; } catch { /* */ }
    try { const b = await send({ type: 'fetch-bytes', url: src }); if (b && b.ok && b.dataUrl) return { dataUrl: b.dataUrl }; } catch { /* */ }
    return { sourceUrl: src };
  }
  function dataUrlToFile(dataUrl, name) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
    const mime = m ? m[1] : 'application/octet-stream';
    const bin = atob(m ? m[2] : '');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name || 'file', { type: mime });
  }
  const b64 = (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch { return btoa(s); } };

  // ── разведка ──
  function collectRecon() {
    const vis = (el) => visible(el);
    const tag = (el) => ({
      tag: el.tagName, id: el.id || '', cls: String(el.className || '').slice(0, 100),
      ph: (el.getAttribute && el.getAttribute('placeholder')) || '', aria: (el.getAttribute && el.getAttribute('aria-label')) || '',
      text: norm(el.textContent).slice(0, 44), vis: vis(el),
    });
    return {
      url: location.href, ts: Date.now(), loggedIn: isLoggedIn(), notebookId: notebookIdFromUrl(),
      buttons: queryAllDeep('button,[role="button"],[role="menuitem"],[role="tab"]').slice(0, 200).map(tag),
      inputs: queryAllDeep('input,textarea,[contenteditable="true"]').slice(0, 40).map(tag),
      fileInputs: queryAllDeep('input[type="file"]').map((i) => ({ accept: i.accept || '', hidden: !vis(i) })),
      media: queryAllDeep('audio,video,img').slice(0, 20).map((m) => ({ t: m.tagName, src: String(usableSrc(m)).slice(0, 120), w: m.clientWidth, h: m.clientHeight })),
      endpoints: reconApis.slice(-30),
    };
  }
  async function runRecon(silent) {
    const r = await send({ type: 'nlm-send-recon', payload: { data: collectRecon(), url: location.href } });
    if (!silent) ui.line(r && r.ok ? T('nlm_reconSent', '✓ разведка вёрстки отправлена') : (T('nlm_reconFail', '⚠ разведка: ') + ((r && r.error) || T('nlm_noConnection', 'нет подключения'))));
  }

  // ── команды от background ──
  let currentActionId = null;
  let actionBusy = false; // пока выполняется команда — вотчер студии не трогает DOM (не рвёт клики)
  async function runAction(a) {
    currentActionId = a.id || null;
    // Если вотчер сейчас качает артефакт (⋮-меню открыто, ждёт blob/загрузку) — дождёмся (макс ~45с,
    // captureCardToGallery держит watcherBusy до 40с), иначе команда кликнет в чужое меню / lastArtifact.
    for (const t0 = Date.now(); watcherBusy && Date.now() - t0 < 45_000;) await sleep(300);
    actionBusy = true;
    try { return await runActionInner(a); }
    finally { actionBusy = false; }
  }
  async function runActionInner(a) {
    switch (a.kind) {
      case 'create-notebook': return createNotebook(a.payload && a.payload.title);
      case 'list-notebooks':  return listNotebooks();
      case 'list-studio-artifacts': return listStudioArtifacts();
      case 'download-studio-artifact': return downloadStudioArtifact(a.payload || {});
      case 'add-source':      return addSource(a.payload || a);
      case 'list-sources':    return listSources();
      case 'list-chat':       return listChat();
      case 'delete-source':   return deleteSource((a.payload && a.payload.sourceId) || a.sourceId);
      case 'chat':            return chat((a.payload && a.payload.question) || a.question);
      case 'generate': {
        const gr = await generate(a.gtype, { ...(a.params || {}), __name: (a.params && a.params.__name) || (a.payload && a.payload.name) });
        // Резервный ингест: если поймали байты (dataUrl) — будим SW отдельным сообщением с taskId,
        // чтобы файл залился, даже если SW умер за время генерации и awaited-ответ пропал (idem-ingest).
        if (gr && gr.ok && gr.dataUrl && a.taskId) {
          try { send({ type: 'nlm-artifact-ready', taskId: a.taskId, dataUrl: gr.dataUrl, mime: gr.mime || '', fileName: gr.fileName || null }); } catch { /* */ }
        }
        return gr;
      }
      default: return { ok: false, reason: T('nlm_unknownAction', 'неизвестное действие: ') + a.kind };
    }
  }
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'ping') { sendResponse({ ready: onNotebookLM(), loggedIn: isLoggedIn() }); return; }
    if (msg.type === 'run-action') {
      runAction(msg.action).then(sendResponse).catch((e) => sendResponse({ ok: false, reason: String(e && e.message || e) }));
      return true; // async
    }
  });

  // При загрузке: если ждали создание блокнота и мы уже на /notebook/<id> — дорапортовать.
  function resumePendingCreate() {
    try {
      chrome.storage.local.get('ttNlmPendingCreate', (d) => {
        const p = d && d.ttNlmPendingCreate;
        if (!p || !p.actionId) return;
        const nbId = notebookIdFromUrl();
        if (nbId && Date.now() - (p.at || 0) < 90_000) {
          chrome.storage.local.remove('ttNlmPendingCreate');
          send({ type: 'nlm-create-done', actionId: p.actionId, notebookId: nbId, title: p.title || null });
        }
      });
    } catch { /* */ }
  }

  // ── старт ──
  injectInterceptor();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ui.mount());
  else ui.mount();
  resumePendingCreate();
  log('content-notebook готов');
})();
