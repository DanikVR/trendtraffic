/**
 * content-notebook.js — работает на https://notebooklm.google.com (изолированный
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
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (m) => { try { return chrome.runtime.sendMessage(m); } catch { return Promise.resolve(); } };
  const reconApis = [];

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
  const elText = (el) => norm((el && (el.getAttribute && el.getAttribute('aria-label'))) || '') + ' ' + norm((el && el.textContent) || '');

  /** Найти видимый кликабельный элемент, чей текст/aria содержит одно из слов (первый — лучший). */
  function findByText(words, opts = {}) {
    const cands = (opts.roots || queryAllDeep(opts.sel || 'button,[role="button"],[role="menuitem"],[role="option"],[role="tab"],a,label,div[tabindex]'))
      .filter(visible);
    const ws = words.map(norm).filter(Boolean);
    // Приоритет точному совпадению, затем вхождению.
    for (const exact of [true, false]) {
      for (const el of cands) {
        const t = elText(el);
        for (const w of ws) {
          if (exact ? (t === w || norm(el.textContent) === w) : t.includes(w)) return el;
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
  const onNotebookLM = () => location.host === 'notebooklm.google.com';
  function isLoggedIn() {
    if (!onNotebookLM()) return false;
    if (/accounts\.google\.com/.test(location.href)) return false;
    if (/\/notebook\//.test(location.href)) return true;
    // Есть плитки блокнотов / кнопка «создать» / аватар аккаунта → вошли.
    if (findByText(['create', 'создать', 'new notebook', 'создать блокнот', 'новый блокнот'])) return true;
    if (queryAllDeep('a[href*="/notebook/"]').some(visible)) return true;
    if (queryAllDeep('[aria-label*="Account" i],[aria-label*="аккаунт" i],img[src*="googleusercontent"]').some(visible)) return true;
    // Явная страница входа?
    if (findByText(['sign in', 'войти', 'log in'])) return false;
    return false;
  }
  const notebookIdFromUrl = () => { const m = /\/notebook\/([a-z0-9-]+)/i.exec(location.href); return m ? m[1] : null; };

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
    }
  });

  // ═══════════════════ 2. панель (Shadow DOM) ═══════════════════
  const ui = (() => {
    let root, els = {}, reconCount = 0, reconSent = false, lastLoggedIn = null;
    function mount() {
      const host = document.createElement('div');
      host.id = 'tt-nlm-host';
      host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;';
      const sh = host.attachShadow({ mode: 'open' });
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
          .hide{display:none}
        </style>
        <div class="card">
          <div class="hd" id="hd">
            <span class="logo"></span><span class="ttl">TrendTraffic → Hotebook</span>
            <span class="sub" id="ver"></span>
          </div>
          <div class="bd" id="bd">
            <div class="row"><span>Состояние</span><span class="pill off" id="st">не подключено</span></div>
            <div class="wire" id="wire"></div>
            <div class="task" id="task">Ожидаю задачи из TrendTraffic…</div>
            <div class="lg" id="lg"></div>
            <div class="btns">
              <button class="pri" id="open">Открыть TrendTraffic</button>
            </div>
            <div class="foot">
              <span class="rec" id="verlbl"></span>
              <button class="rec" id="recBtn" title="Снять текущую вёрстку NotebookLM и прислать нам (для подстройки селекторов)">разведка вёрстки</button>
            </div>
          </div>
        </div>`;
      document.documentElement.appendChild(host);
      els = {
        st: sh.getElementById('st'), task: sh.getElementById('task'), lg: sh.getElementById('lg'),
        ver: sh.getElementById('ver'), open: sh.getElementById('open'), bd: sh.getElementById('bd'),
        hd: sh.getElementById('hd'), wire: sh.getElementById('wire'), verlbl: sh.getElementById('verlbl'),
      };
      els.ver.textContent = 'v' + chrome.runtime.getManifest().version;
      els.verlbl.textContent = 'NotebookLM';
      makeDraggable(host, els.hd, () => els.bd.classList.toggle('hide'));
      els.open.addEventListener('click', () => window.open('https://app.trendtraffic.pro/flow', '_blank'));
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
      // Сообщаем background о входе (влияет на поллинг + плашку в приложении).
      if (loggedIn !== lastLoggedIn) { lastLoggedIn = loggedIn; send({ type: 'nlm-presence', loggedIn }); }
      if (!r.connected) { status('off', 'войдите в TrendTraffic'); toggleWire(false); armAutoRecon(false); return; }
      if (!loggedIn) { status('wait', 'войдите в Google'); toggleWire(false); armAutoRecon(false); return; }
      status('on', 'работает'); toggleWire(true); armAutoRecon(true);
    }
    function toggleWire(on) { if (els.wire) els.wire.classList.toggle('on', !!on); }
    function armAutoRecon(ok) { if (ok && !reconSent) { reconSent = true; setTimeout(() => runRecon(true), 1500); } }
    return { mount, line, status, task, recon };
  })();

  // ═══════════════════ 3. автоматизация NotebookLM ═══════════════════

  // Тип артефакта → плитки студии, тип захвата, расширение, mime. Тексты уточняются разведкой.
  const GEN_UI = {
    audio:       { tiles: ['audio overview', 'аудиообзор', 'аудиопересказ', 'deep dive', 'аудио'], kind: 'media', ext: '.mp3', mime: 'audio/mpeg' },
    video:       { tiles: ['video overview', 'видеообзор', 'видео'],                                 kind: 'media', ext: '.mp4', mime: 'video/mp4' },
    report:      { tiles: ['reports', 'report', 'отчёт', 'отчёты'],                                  kind: 'doc',   ext: '.md',  mime: 'text/markdown' },
    quiz:        { tiles: ['quiz', 'тест'],                                                          kind: 'json',  ext: '.json', mime: 'application/json' },
    table:       { tiles: ['data table', 'таблица', 'table'],                                        kind: 'csv',   ext: '.csv', mime: 'text/csv' },
    infographic: { tiles: ['infographic', 'инфографика'],                                            kind: 'media', ext: '.png', mime: 'image/png' },
    flashcards:  { tiles: ['flashcards', 'карточки'],                                                kind: 'json',  ext: '.json', mime: 'application/json' },
    mindmap:     { tiles: ['mind map', 'mindmap', 'ментальная карта'],                               kind: 'json',  ext: '.json', mime: 'application/json' },
    slides:      { tiles: ['slides', 'презентация', 'slide deck'],                                   kind: 'doc',   ext: '.pdf', mime: 'application/pdf' },
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

  // Кандидаты полей ввода/кнопок (уточняются разведкой).
  const SEL = {
    sourceUrlInput: ['input[type="url"]', 'input[placeholder*="url" i]', 'input[placeholder*="ссылк" i]', 'textarea[placeholder*="url" i]'],
    sourceTextArea: ['textarea[placeholder*="text" i]', 'textarea[placeholder*="текст" i]', 'textarea'],
    fileInput: ['input[type="file"]'],
    chatInput: ['textarea[placeholder*="ask" i]', 'textarea[placeholder*="спрос" i]', 'div[contenteditable="true"][role="textbox"]', 'textarea'],
    instructions: ['textarea[placeholder*="focus" i]', 'textarea[placeholder*="акцент" i]', 'textarea[placeholder*="instruction" i]', 'textarea'],
  };
  function pickDeep(cands) {
    for (const s of cands) { const list = queryAllDeep(s).filter(visible); if (list.length) return list[list.length - 1]; }
    return null;
  }

  // ── создать блокнот ──
  async function createNotebook(title) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    ui.task('Создаю блокнот: ' + (title || ''));
    // На главной жмём «создать». Если уже в блокноте — считаем текущий (редко, но безопасно).
    if (!/\/notebook\//.test(location.href)) {
      const ok = await clickByText(['create new', 'create notebook', 'создать блокнот', 'новый блокнот', 'create', 'создать', 'new']);
      if (!ok) return { ok: false, reason: 'selector:create-notebook' };
    }
    const nbId = await waitFor(() => notebookIdFromUrl(), 30_000, 700);
    if (!nbId) return { ok: false, reason: 'selector:create-notebook (нет /notebook/<id> в URL)' };
    // Переименовать (best-effort): найти поле заголовка и вписать имя.
    if (title) {
      try {
        const t = queryAllDeep('input[aria-label*="title" i],input[aria-label*="назван" i],[contenteditable="true"][aria-label*="title" i]').filter(visible)[0];
        if (t) { typeInto(t, title); await sleep(300); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }
      } catch { /* имя не критично */ }
    }
    ui.line('✓ блокнот создан: ' + nbId);
    // Через background — переживает возможную перезагрузку страницы.
    send({ type: 'nlm-create-done', actionId: currentActionId, notebookId: nbId, title: title || null });
    return { ok: true, notebookId: nbId, title: title || null };
  }

  // ── источники ──
  async function openAddSource() {
    // Кнопка «Add source / Добавить источник / +».
    await clickByText(['add source', 'добавить источник', 'add sources', 'источники', 'sources', 'добавить']);
    await sleep(600);
  }
  async function addSource(a) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    const kind = a.srcKind;
    ui.task('Добавляю источник (' + kind + ')');
    await openAddSource();
    if (kind === 'url') {
      await clickByText(['website', 'link', 'url', 'ссылк', 'сайт', 'youtube']);
      await sleep(400);
      const inp = pickDeep(SEL.sourceUrlInput);
      if (!inp) return { ok: false, reason: 'selector:sourceUrlInput' };
      typeInto(inp, a.url || '');
      await sleep(200);
      if (!await clickByText(['insert', 'add', 'вставить', 'добавить', 'submit'])) inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else if (kind === 'text') {
      await clickByText(['paste text', 'copied text', 'вставить текст', 'текст', 'text']);
      await sleep(400);
      const ta = pickDeep(SEL.sourceTextArea);
      if (!ta) return { ok: false, reason: 'selector:sourceTextArea' };
      typeInto(ta, a.content || '');
      await sleep(200);
      await clickByText(['insert', 'add', 'вставить', 'добавить', 'submit']);
    } else if (kind === 'file') {
      // Файл из Галереи: скачиваем байты в background (обход CORS) → File → в input[type=file].
      const b = await send({ type: 'fetch-bytes', url: a.fileUrl });
      if (!b || !b.ok) return { ok: false, reason: 'не скачался файл из Галереи' + (b && b.error ? ': ' + b.error : '') };
      const inp = pickDeep(SEL.fileInput);
      if (!inp) return { ok: false, reason: 'selector:fileInput' };
      try {
        const file = dataUrlToFile(b.dataUrl, a.fileName || ('source' + (b.mime && b.mime.includes('video') ? '.mp4' : '')));
        const dt = new DataTransfer(); dt.items.add(file);
        inp.files = dt.files;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
    } else {
      return { ok: false, reason: 'неизвестный тип источника' };
    }
    // Дождаться, что источник появился в списке (best-effort), вернуть свежий список.
    await sleep(2500);
    const sources = listSourcesDom();
    ui.line('✓ источник добавлен (' + kind + ')');
    return { ok: true, source: { title: a.title || (a.url || 'источник'), kind }, sources };
  }
  function listSourcesDom() {
    // Кандидаты элементов-источников в панели слева. Уточняется разведкой.
    const items = queryAllDeep('[role="listitem"],[data-source-id],[class*="source" i] [role="button"]').filter(visible);
    const out = [];
    const seen = new Set();
    for (const el of items) {
      const id = el.getAttribute('data-source-id') || el.getAttribute('id') || '';
      const title = norm(el.textContent).slice(0, 80);
      if (!title || seen.has(title)) continue;
      seen.add(title);
      out.push({ id: id || title, title, source_id: id || undefined });
      if (out.length > 60) break;
    }
    return out;
  }
  async function listSources() {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    return { ok: true, sources: listSourcesDom() };
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

  // ── чат ──
  async function chat(question) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    ui.task('Спрашиваю: ' + String(question || '').slice(0, 60));
    const inp = pickDeep(SEL.chatInput);
    if (!inp) return { ok: false, reason: 'selector:chatInput' };
    typeInto(inp, question || '');
    await sleep(200);
    const before = chatAnswersDom().length;
    if (!await clickByText(['send', 'отправить', 'ask', 'спросить', 'submit'])) inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // Ждём новый ответ + «тихое окно» (стриминг закончился).
    const ans = await waitFor(() => {
      const arr = chatAnswersDom();
      return arr.length > before ? arr[arr.length - 1] : null;
    }, 4 * 60_000, 800);
    if (!ans) return { ok: false, reason: 'timeout' };
    // Стабилизация: ждём, пока текст перестанет расти.
    let last = ''; let stable = 0;
    for (let i = 0; i < 40; i++) {
      const cur = norm(ans.el ? ans.el.textContent : '');
      if (cur === last) { stable++; if (stable >= 2) break; } else { stable = 0; last = cur; }
      await sleep(700);
    }
    ui.line('✓ ответ получен');
    return { ok: true, answer: ans.text, citations: ans.citations || [] };
  }
  function chatAnswersDom() {
    const nodes = queryAllDeep('[class*="response" i],[class*="answer" i],[data-message-author="assistant"],[role="article"]').filter(visible);
    return nodes.map((el) => ({ el, text: (el.textContent || '').trim(), citations: [] })).filter((x) => x.text.length > 1);
  }

  // ── генерация артефакта ──
  async function openStudio() { await clickByText(['studio', 'студия', 'create', 'создать']); await sleep(500); }
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
    if (!spec) return { ok: false, reason: 'неизвестный тип: ' + gtype };
    ui.task('Генерирую: ' + gtype);
    await openStudio();
    // 1) плитка артефакта
    if (!await clickByText(spec.tiles)) return { ok: false, reason: 'selector:tile:' + gtype };
    await sleep(700);
    // 2) «Настроить» (если есть) → опции
    await clickByText(['customize', 'настроить', 'options', 'настройки', 'more options']);
    await sleep(400);
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
    // 4) фокус/инструкции + свёрнутые опции
    const focusText = [String((params && params.focus) || '').trim(), folded.join('. ')].filter(Boolean).join('. ');
    if (focusText) { const box = pickDeep(SEL.instructions); if (box) typeInto(box, focusText); }
    // 5) запуск
    await sleep(300);
    if (!await clickByText(['generate', 'create', 'сгенерировать', 'создать', 'go'])) return { ok: false, reason: 'selector:generate:' + gtype };
    ui.line('генерация запущена (' + gtype + '), жду артефакт…');
    // 6) ждать артефакт и захватить
    const captured = await captureArtifact(gtype, spec);
    if (!captured) return { ok: false, reason: 'timeout' };
    if (captured.reason) return { ok: false, reason: captured.reason };
    ui.line('✓ артефакт готов (' + gtype + ')');
    return { ok: true, ...captured, fileName: (baseName(params) || gtype) + spec.ext, mime: spec.mime };
  }
  const baseName = (p) => (p && p.__name) ? String(p.__name).slice(0, 80) : '';

  // Захват результата по типу. media → <audio>/<video>/<img>; doc/json/csv → ссылка на файл или скрейп.
  async function captureArtifact(gtype, spec) {
    const started = Date.now();
    const MAXW = { audio: 20 * 60_000, video: 30 * 60_000, infographic: 12 * 60_000 }[gtype] || 10 * 60_000;
    while (Date.now() - started < MAXW) {
      if (spec.kind === 'media') {
        const el = pickMedia(gtype);
        if (el) { const got = await grabMediaData(el); if (got && (got.dataUrl || got.sourceUrl)) return got; }
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
    if (!silent) ui.line(r && r.ok ? '✓ разведка вёрстки отправлена' : ('⚠ разведка: ' + ((r && r.error) || 'нет подключения')));
  }

  // ── команды от background ──
  let currentActionId = null;
  async function runAction(a) {
    currentActionId = a.id || null;
    switch (a.kind) {
      case 'create-notebook': return createNotebook(a.payload && a.payload.title);
      case 'add-source':      return addSource(a.payload || a);
      case 'list-sources':    return listSources();
      case 'delete-source':   return deleteSource((a.payload && a.payload.sourceId) || a.sourceId);
      case 'chat':            return chat((a.payload && a.payload.question) || a.question);
      case 'generate':        return generate(a.gtype, { ...(a.params || {}), __name: (a.params && a.params.__name) || (a.payload && a.payload.name) });
      default: return { ok: false, reason: 'неизвестное действие: ' + a.kind };
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
