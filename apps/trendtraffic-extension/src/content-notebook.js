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
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim(); // как norm, но БЕЗ lowercase (для названий)
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

  // Тип артефакта → плитки студии, ПАНЕЛЬ настройки («Настроить X» → там опции + «Сгенерировать»),
  // тип захвата, расширение, mime. Разведано вживую (RU NotebookLM).
  const GEN_UI = {
    audio:       { tiles: ['аудиопересказ', 'audio overview', 'аудиообзор'], customize: ['настроить аудиопересказ', 'customize audio'], kind: 'media', ext: '.mp3', mime: 'audio/mpeg' },
    video:       { tiles: ['видеопересказ', 'video overview', 'видеообзор'], customize: ['настроить видеопересказ', 'customize video'],   kind: 'media', ext: '.mp4', mime: 'video/mp4' },
    report:      { tiles: ['отчеты', 'отчёты', 'reports', 'report'],         customize: ['настроить отчет', 'настроить отчёт'],            kind: 'doc',   ext: '.md',  mime: 'text/markdown' },
    quiz:        { tiles: ['тест', 'quiz'],                                  customize: ['настроить тест', 'customize quiz'],              kind: 'json',  ext: '.json', mime: 'application/json' },
    table:       { tiles: ['таблица данных', 'data table', 'таблица'],       customize: ['настроить таблицу данных', 'настроить таблицу'], kind: 'csv',   ext: '.csv', mime: 'text/csv' },
    infographic: { tiles: ['инфографика', 'infographic'],                    customize: ['настроить инфографику'],                         kind: 'media', ext: '.png', mime: 'image/png' },
    flashcards:  { tiles: ['карточки', 'flashcards'],                        customize: ['настроить карточки'],                            kind: 'json',  ext: '.json', mime: 'application/json' },
    mindmap:     { tiles: ['ментальная карта', 'mind map', 'mindmap'],       customize: ['настроить ментальную карту'],                    kind: 'json',  ext: '.json', mime: 'application/json' },
    slides:      { tiles: ['презентация', 'slides', 'slide deck'],           customize: ['настроить презентацию'],                         kind: 'doc',   ext: '.pdf', mime: 'application/pdf' },
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
    ui.task('Создаю блокнот: ' + (title || ''));
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
    ui.line('✓ блокнот создан: ' + nbId);
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
    ui.task('Добавляю источник (' + kind + ')');
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
      if (!b || !b.ok) return { ok: false, reason: 'не скачался файл из Галереи' + (b && b.error ? ': ' + b.error : '') };
      // ВАЖНО (разведано вживую): загрузить файл в NotebookLM из расширения НАДЁЖНО НЕЛЬЗЯ:
      // в DOM нет input[type=file] («Загрузить файлы» открывает нативное окно ОС), а синтетический
      // drag-drop NotebookLM игнорирует (isTrusted=false — проверено, источник не добавляется).
      // Поэтому файл-путь = короткая попытка drag-drop + БЫСТРЫЙ честный отказ с подсказкой, а не зависание.
      const suggest = /^video\//i.test(b.mime || '')
        ? 'NotebookLM не принимает видео-файлы. Для ролика добавьте «Анализ» текстом или ссылку (YouTube).'
        : 'Загрузка файлов в NotebookLM недоступна из расширения (нативное окно). Используйте «Анализ»/«Вставить текст» или ссылку (сайт/YouTube).';
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
      ui.line('✓ файл-источник добавлен');
      return { ok: true, source: { title: a.title || a.fileName || 'файл', kind }, sources: listSourcesDom() };
    } else {
      return { ok: false, reason: 'неизвестный тип источника' };
    }
    // URL/текст: дождаться, что источник появился (best-effort), вернуть свежий список.
    await sleep(2500);
    const sources = listSourcesDom();
    ui.line('✓ источник добавлен (' + kind + ')');
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
    ui.task('Читаю список блокнотов…');
    const collected = new Map();
    const scrapeVisible = () => {
      for (const pb of queryAllDeep('project-button, .project-button').filter(visible)) {
        const a = pb.querySelector('a[href*="/notebook/"]');
        const m = a ? /notebook\/([a-z0-9-]+)/i.exec(a.getAttribute('href') || '') : null;
        const id = m ? m[1] : null;
        if (!id || collected.has(id)) continue;
        const titleEl = pb.querySelector('.project-button-title') || pb.querySelector('[class*="title" i]');
        const subEl = pb.querySelector('.project-button-subtitle');
        const iconEl = pb.querySelector('.project-button-box-icon');
        collected.set(id, {
          id,
          title: (clean(titleEl && titleEl.textContent) || 'Без названия').slice(0, 120),
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
      await waitFor(() => (queryAllDeep('project-button, .project-button').filter(visible).length ? true : null), 6000, 400);
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
      for (const pb of queryAllDeep('project-button, .project-button').filter(visible)) {
        let sec = ''; let n = pb;
        for (let i = 0; i < 10 && n; i++) { if (/recommend|featured|рекоменд/i.test(String(n.className || ''))) { sec = 'rec'; break; } n = n.parentElement; }
        if (sec === 'rec') continue;
        const a = pb.querySelector('a[href*="/notebook/"]');
        const m = a ? /notebook\/([a-z0-9-]+)/i.exec(a.getAttribute('href') || '') : null;
        if (!m || collected.has(m[1])) continue;
        const titleEl = pb.querySelector('.project-button-title');
        collected.set(m[1], { id: m[1], title: (clean(titleEl && titleEl.textContent) || 'Без названия').slice(0, 120), subtitle: clean((pb.querySelector('.project-button-subtitle') || {}).textContent).slice(0, 60), icon: clean((pb.querySelector('.project-button-box-icon') || {}).textContent).slice(0, 4) });
      }
    }
    const out = [...collected.values()].slice(0, 200);
    ui.line('✓ блокнотов (мои+доступные): ' + out.length);
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
  async function chat(question) {
    if (!isLoggedIn()) return { ok: false, reason: 'not-logged-in' };
    ui.task('Спрашиваю: ' + String(question || '').slice(0, 60));
    const inp = pickDeep(SEL.chatInput);
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
    if (!finalText) return { ok: false, reason: 'ответ не дочитался' };
    ui.line('✓ ответ получен');
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
    if (!spec) return { ok: false, reason: 'неизвестный тип: ' + gtype };
    ui.task('Генерирую: ' + gtype);
    await openStudio();
    // 1) Открываем ПАНЕЛЬ НАСТРОЙКИ типа («Настроить аудиопересказ» и т.п.) — там опции + «Сгенерировать».
    const opened = await clickByText(spec.customize || []);
    if (!opened) {
      // Фолбэк: клик по самой плитке = генерация с дефолтами (без опций/фокуса).
      if (!await clickByText(spec.tiles)) return { ok: false, reason: 'selector:tile:' + gtype };
      ui.line('генерация запущена (' + gtype + ', дефолт), жду артефакт…');
      const cap0 = await captureArtifact(gtype, spec);
      if (!cap0) return { ok: false, reason: 'timeout' };
      if (cap0.reason) return { ok: false, reason: cap0.reason };
      ui.line('✓ артефакт готов (' + gtype + ')');
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
    let played = false;
    while (Date.now() - started < MAXW) {
      if (spec.kind === 'media') {
        let el = pickMedia(gtype);
        // Аудио/видео: <audio>/<video> появляется ТОЛЬКО при воспроизведении. Пока генерируется —
        // на карточке крутится статус; когда готово — есть кнопка play. Кликаем play, чтобы
        // NotebookLM загрузил медиа-элемент, затем берём его src.
        if (!el && gtype !== 'infographic' && !played) {
          const gen = queryAllDeep('*').filter(visible).some((e) => /создаём аудио|создаем аудио|вернитесь через|создаём видео|создаем видео|generating/i.test(norm(e.textContent)) && norm(e.textContent).length < 60);
          if (!gen) {
            const play = queryAllDeep('button,[role="button"]').filter(visible).find((b) => /play_arrow|play_circle|воспроизвести|^play$/i.test(norm(b.getAttribute('aria-label') || b.textContent)));
            if (play) { clickEl(play); played = true; await sleep(3000); el = pickMedia(gtype); }
          }
        }
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
      case 'list-notebooks':  return listNotebooks();
      case 'add-source':      return addSource(a.payload || a);
      case 'list-sources':    return listSources();
      case 'list-chat':       return listChat();
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
