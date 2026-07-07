/**
 * content-flow.js — работает на https://labs.google/fx/tools/flow (изолированный
 * мир расширения). Три роли:
 *   1) Инжектит injected.js в MAIN-мир (перехват fetch/XHR Flow) и релеит его
 *      разведданные + bearer в background.
 *   2) Рисует нашу панель поверх Flow (Shadow DOM — не конфликтует со стилями Flow):
 *      статус, текущая задача, лог, пауза, ссылка в TrendTraffic.
 *   3) По команде background `run-task` автоматизирует генерацию как «обычный
 *      пользователь»: подставляет промпт → жмёт «Генерировать» → ждёт клип →
 *      отдаёт ссылку/данные обратно.
 *
 * ВАЖНО про селекторы: точный DOM Flow меняется и на этом этапе снимается
 * «разведкой», поэтому ввод/кнопки ищем по НЕСКОЛЬКИМ кандидатам + эвристикам,
 * а если не нашли — честно возвращаем reason:'selector' (не притворяемся, что
 * сработало). Кандидаты собраны в SELECTORS — их правим по реальному Flow.
 */
(() => {
  'use strict';
  if (window.__ttFlowContent) return;
  window.__ttFlowContent = true;

  // ---- кандидаты селекторов Flow (уточняются по разведке на живой странице) ----
  const SELECTORS = {
    promptInput: [
      'textarea[placeholder*="prompt" i]',
      'textarea[aria-label*="prompt" i]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea',
    ],
    generateBtn: [
      'button[aria-label*="generate" i]',
      'button[type="submit"]',
    ],
    generateBtnText: ['generate', 'создать', 'сгенерировать', 'создать видео'],
    resultVideo: ['video[src]', 'video source[src]'],
    throttleBanner: ['unusual activity', 'необычн', 'подтвердите', 'suspicious'],
    // Поле загрузки видео/фото в Flow (для «Из Галереи»). file-input часто скрыт — по visible НЕ фильтруем.
    uploadInput: ['input[type="file"][accept*="video" i]', 'input[type="file"][accept*="image" i]', 'input[type="file"]'],
    // Тексты кнопки «добавить медиа/загрузить/ингредиент/кадр», по которой раскрывается file-input.
    addMediaText: ['upload', 'загруз', 'добав', 'add media', 'media', 'изображ', 'референс', 'reference', 'frames', 'ingredient', 'ингредиент', 'кадр'],
  };
  const RESULT_POLL_MS = 4000;
  const RESULT_MAX_MS = 7 * 60_000;

  const log = (...a) => console.log('[tt-flow]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (m) => { try { return chrome.runtime.sendMessage(m); } catch { return Promise.resolve(); } };
  const reconApis = []; // последние виденные эндпоинты Flow (для авто-разведки)

  // ---------- 1. инжект MAIN-world перехватчика ----------
  function injectInterceptor() {
    try {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('src/injected.js');
      s.onload = () => s.remove();
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { log('инжект injected.js не удался', e); }
  }
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.source !== 'tt-flow-injected') return;
    if (d.kind === 'bearer') send({ type: 'bearer', token: d.token });
    else if (d.kind === 'api') {
      reconApis.push({ url: String(d.url || '').slice(0, 160), method: d.method, status: d.status });
      if (reconApis.length > 60) reconApis.shift();
      send({ type: 'api-recon', data: d }); ui.recon(d);
    }
  });

  // ---------- 2. панель (Shadow DOM) ----------
  const ui = (() => {
    let root, els = {}, reconCount = 0, reconSent = false;
    function mount() {
      const host = document.createElement('div');
      host.id = 'tt-flow-host';
      host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;';
      const sh = host.attachShadow({ mode: 'open' });
      sh.innerHTML = `
        <style>
          *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif}
          .card{width:300px;background:#14181F;color:#EAECEF;border:1px solid #2A303B;
            border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.45);overflow:hidden}
          .hd{display:flex;align-items:center;gap:8px;padding:11px 13px;background:#1B2029;
            border-bottom:1px solid #2A303B;cursor:move;user-select:none;touch-action:none}
          .logo{width:9px;height:9px;border-radius:50%;background:#6366F1;box-shadow:0 0 8px #6366F1}
          .ttl{font-size:12.5px;font-weight:700;letter-spacing:.02em}
          .sub{font-size:10.5px;color:#8A919C;margin-left:auto;font-family:ui-monospace,Consolas,monospace}
          .bd{padding:12px 13px;display:flex;flex-direction:column;gap:9px}
          .row{display:flex;align-items:center;gap:8px;font-size:12px}
          .pill{font-family:ui-monospace,Consolas,monospace;font-size:10px;font-weight:700;
            padding:2px 7px;border-radius:5px;text-transform:uppercase;letter-spacing:.03em}
          .pill.on{background:#0E3A28;color:#3DD68C} .pill.off{background:#3A2530;color:#F27289}
          .pill.wait{background:#3A3320;color:#E9B949}
          .task{font-size:11.5px;color:#C6CCD5;background:#1B2029;border:1px solid #2A303B;
            border-radius:8px;padding:8px;min-height:34px;line-height:1.4;word-break:break-word}
          .lg{font-family:ui-monospace,Consolas,monospace;font-size:10px;color:#8A919C;
            max-height:96px;overflow:auto;white-space:pre-wrap;line-height:1.5}
          .btns{display:flex;gap:7px}
          button{flex:1;font-size:11.5px;font-weight:600;padding:7px 9px;border-radius:8px;
            border:1px solid #2A303B;background:#222836;color:#EAECEF;cursor:pointer}
          button:hover{background:#2A303B} button.pri{background:#4F46E5;border-color:#4F46E5}
          button.pri:hover{background:#4038c7}
          .mini{font-size:10px;color:#6B7280}
          .pick{max-height:150px;overflow:auto;display:flex;flex-direction:column;gap:5px;
            border:1px solid #2A303B;border-radius:8px;padding:6px;background:#0F131A}
          .pick .it{padding:6px 7px;border-radius:6px;background:#1B2029;cursor:pointer;
            font-size:11px;color:#C6CCD5;word-break:break-word}
          .pick .it:hover{background:#242B37}
          .pick .ph{font-size:10.5px;color:#8A919C;text-align:center;padding:8px}
          .wire{position:relative;height:3px;border-radius:3px;background:#242B37;overflow:hidden}
          .wire::before{content:'';position:absolute;top:0;left:-45%;width:45%;height:100%;
            background:linear-gradient(90deg,transparent,#6366F1,transparent);opacity:0}
          .wire.on::before{opacity:1;animation:ttrun 1.25s linear infinite}
          @keyframes ttrun{from{left:-45%}to{left:100%}}
          .foot{display:flex;align-items:center;justify-content:space-between;gap:8px}
          .rec{flex:0 0 auto;width:auto;font-size:10px;color:#8A919C;background:none;
            border:none;cursor:pointer;text-decoration:underline;padding:0}
          .rec:hover{color:#C6CCD5;background:none}
          .hide{display:none}
        </style>
        <div class="card">
          <div class="hd" id="hd">
            <span class="logo"></span><span class="ttl">TrendTraffic → Flow</span>
            <span class="sub" id="ver"></span>
          </div>
          <div class="bd" id="bd">
            <div class="row"><span>Состояние</span><span class="pill off" id="st">не подключено</span></div>
            <div class="wire" id="wire"></div>
            <div class="task" id="task">Ожидаю задачи из TrendTraffic…</div>
            <div class="lg" id="lg"></div>
            <div class="btns">
              <button id="pause">Пауза</button>
              <button class="pri" id="open">Открыть TrendTraffic</button>
            </div>
            <div class="btns">
              <button id="toGal" title="Отправить готовый клип из Flow в Галерею TrendTraffic">⬆ В галерею</button>
              <button id="fromGal" title="Взять видео из Галереи и залить в Flow на переработку">⬇ Из Галереи</button>
            </div>
            <div class="pick hide" id="pick"></div>
            <div class="foot">
              <span class="mini" id="reconc">разведка: 0 запросов Flow</span>
              <button class="rec" id="recBtn" title="Снять текущую вёрстку Flow и прислать нам (для подстройки)">разведка вёрстки</button>
            </div>
          </div>
        </div>`;
      document.documentElement.appendChild(host);
      els = {
        st: sh.getElementById('st'), task: sh.getElementById('task'), lg: sh.getElementById('lg'),
        ver: sh.getElementById('ver'), pause: sh.getElementById('pause'),
        open: sh.getElementById('open'), bd: sh.getElementById('bd'),
        hd: sh.getElementById('hd'), reconc: sh.getElementById('reconc'), pick: sh.getElementById('pick'),
        wire: sh.getElementById('wire'),
      };
      els.ver.textContent = 'v' + chrome.runtime.getManifest().version;
      makeDraggable(host, els.hd, () => els.bd.classList.toggle('hide'));
      els.open.addEventListener('click', () => window.open('https://app.trendtraffic.pro/flow', '_blank'));
      els.pause.addEventListener('click', () => send({ type: 'flow-throttled' }).then(() => line('Пауза включена вручную')));
      sh.getElementById('toGal').addEventListener('click', () => sendToGallery());
      sh.getElementById('fromGal').addEventListener('click', () => openGalleryPicker());
      sh.getElementById('recBtn').addEventListener('click', () => runRecon(false));
      refreshStatus();
      setInterval(refreshStatus, 5000);
      root = sh;
    }
    function savePanelPos(left, top) {
      try { chrome.storage.local.set({ panelPos: { left, top } }); } catch { /* noop */ }
    }
    // Перетаскивание панели за шапку (+ запоминание позиции). Клик без движения = свернуть/развернуть.
    function makeDraggable(host, handle, onTap) {
      try {
        chrome.storage.local.get('panelPos', (d) => {
          const p = d && d.panelPos;
          if (!p || typeof p.left !== 'number' || typeof p.top !== 'number') return;
          const w = host.offsetWidth || 300, h = host.offsetHeight || 120;
          host.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, p.left)) + 'px';
          host.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, p.top)) + 'px';
          host.style.right = 'auto'; host.style.bottom = 'auto';
        });
      } catch { /* noop */ }
      let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
      handle.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        dragging = true; moved = false;
        const r = host.getBoundingClientRect();
        ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
        host.style.left = ox + 'px'; host.style.top = oy + 'px';
        host.style.right = 'auto'; host.style.bottom = 'auto';
        try { handle.setPointerCapture(e.pointerId); } catch { /* noop */ }
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
        try { handle.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        if (moved) savePanelPos(parseInt(host.style.left, 10) || 0, parseInt(host.style.top, 10) || 0);
        else if (typeof onTap === 'function') onTap();
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    }
    function line(t) {
      if (!els.lg) return;
      const ts = new Date().toLocaleTimeString();
      els.lg.textContent = `${ts}  ${t}\n` + els.lg.textContent;
      els.lg.textContent = els.lg.textContent.split('\n').slice(0, 40).join('\n');
    }
    function status(kind, text) {
      if (!els.st) return;
      els.st.className = 'pill ' + kind;
      els.st.textContent = text;
    }
    function task(t) { if (els.task) els.task.textContent = t; }
    function recon() { reconCount++; if (els.reconc) els.reconc.textContent = `разведка: ${reconCount} запросов Flow`; }
    async function refreshStatus() {
      const r = await send({ type: 'tt-status' });
      if (!r) return;
      const paused = r.connected && Date.now() < (r.pausedUntil || 0);
      if (paused) status('wait', 'пауза');
      else if (r.connected) status('on', 'работает');
      else status('off', 'войдите в аккаунт');
      // Бегущая лента горит, когда «работает» (подключено и не на паузе).
      if (els.wire) els.wire.classList.toggle('on', !!r.connected && !paused);
      // Первый раз, как только подключились, — молча снимаем вёрстку Flow (авто-разведка).
      if (r.connected && !reconSent) { reconSent = true; setTimeout(() => runRecon(true), 1500); }
    }
    // Список видео Галереи внутри панели (пикер «Из Галереи»).
    function showPicker(placeholder, items) {
      if (!els.pick) return;
      els.pick.classList.remove('hide');
      els.pick.innerHTML = '';
      if (placeholder) { const p = document.createElement('div'); p.className = 'ph'; p.textContent = placeholder; els.pick.appendChild(p); }
      for (const it of (items || [])) {
        const row = document.createElement('div'); row.className = 'it';
        row.textContent = (it.type === 'image' ? '🖼 ' : '🎬 ') + (it.title || 'файл') + (it.folder ? '  ·  ' + it.folder : '');
        row.title = it.fileUrl || '';
        row.addEventListener('click', () => pickGalleryItem(it));
        els.pick.appendChild(row);
      }
    }
    function hidePicker() { if (els.pick) { els.pick.classList.add('hide'); els.pick.innerHTML = ''; } }
    return { mount, line, status, task, recon, showPicker, hidePicker };
  })();

  // ---------- 3. автоматизация генерации ----------
  const visible = (el) => !!(el && el.offsetParent !== null && el.getClientRects().length);
  function pick(cands) {
    for (const sel of cands) {
      const list = [...document.querySelectorAll(sel)].filter(visible);
      if (list.length) return list[list.length - 1]; // обычно нужный — последний/нижний
    }
    return null;
  }
  function findGenerateButton() {
    const direct = pick(SELECTORS.generateBtn);
    if (direct) return direct;
    // fallback: кнопка с подходящим текстом
    const btns = [...document.querySelectorAll('button')].filter(visible);
    return btns.find((b) => {
      const t = (b.textContent || '').trim().toLowerCase();
      return SELECTORS.generateBtnText.some((k) => t.includes(k));
    }) || null;
  }
  function detectThrottle() {
    const body = (document.body.innerText || '').toLowerCase();
    return SELECTORS.throttleBanner.some((k) => body.includes(k));
  }
  function setNativeValue(el, value) {
    // React перехватывает setter — пишем через прототип и шлём input-событие.
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) setter.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function setPrompt(text) {
    const input = pick(SELECTORS.promptInput);
    if (!input) return false;
    input.focus();
    if (input.isContentEditable) {
      input.textContent = text;
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    } else {
      setNativeValue(input, text);
    }
    return true;
  }
  async function waitForResult(sinceTs) {
    const started = Date.now();
    while (Date.now() - started < RESULT_MAX_MS) {
      if (detectThrottle()) return { throttled: true };
      const v = pick(SELECTORS.resultVideo);
      const src = v && (v.currentSrc || v.src || (v.querySelector('source') || {}).src);
      if (src && !src.startsWith('blob:')) return { sourceUrl: src };
      if (src && src.startsWith('blob:')) {
        // blob виден только во вкладке — читаем и отдаём как dataUrl
        try {
          const buf = await (await fetch(src)).blob();
          const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(buf); });
          return { dataUrl };
        } catch { return { sourceUrl: src }; }
      }
      await sleep(RESULT_POLL_MS);
    }
    return { timeout: true };
  }

  async function runTask(task) {
    ui.task('▶ ' + (task.prompt || '(без промпта)'));
    ui.line('Задача #' + task.id);

    if (detectThrottle()) { send({ type: 'flow-throttled' }); return { ok: false, throttled: true }; }

    const okPrompt = await setPrompt(task.prompt || '');
    if (!okPrompt) { ui.line('⚠ поле промпта не найдено — нужна разведка селекторов'); return { ok: false, reason: 'selector:promptInput' }; }
    ui.line('промпт подставлен');

    // Референсы из Галереи → заливаем в Flow (video-to-video / кадры) ДО генерации. Best-effort.
    if (task.references && task.references.length) {
      for (const url of task.references.slice(0, 4)) {
        try {
          const b = await send({ type: 'fetch-bytes', url });
          if (b && b.ok) {
            const up = await injectFileIntoFlow(dataUrlToFile(b.dataUrl, 'ref' + guessExt(b.mime)));
            ui.line(up.ok ? 'референс залит в Flow' : ('референс: поле загрузки не найдено'));
            await sleep(700);
          } else { ui.line('референс не скачался' + (b && b.error ? ': ' + b.error : '')); }
        } catch { /* референс best-effort */ }
      }
    }

    await sleep(600);
    const btn = findGenerateButton();
    if (!btn) { ui.line('⚠ кнопка генерации не найдена — нужна разведка'); return { ok: false, reason: 'selector:generateBtn' }; }
    btn.click();
    ui.line('генерация запущена, жду клип…');

    const r = await waitForResult(Date.now());
    if (r.throttled) { send({ type: 'flow-throttled' }); ui.line('⏸ Flow: unusual activity'); return { ok: false, throttled: true }; }
    if (r.timeout) { ui.line('⌛ таймаут ожидания клипа'); return { ok: false, reason: 'timeout' }; }
    ui.line('✓ клип готов');
    return { ok: true, sourceUrl: r.sourceUrl || null, dataUrl: r.dataUrl || null, meta: { title: task.title || null } };
  }

  // ---------- 4. двусторонняя связь Flow ↔ Галерея ----------
  function blobToDataUrl(blob) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(blob); });
  }
  // Последнее медиа (видео/картинка), кликнутое юзером в Flow — приоритетный кандидат для «В галерею».
  let lastClickedMedia = null;
  document.addEventListener('click', (e) => {
    try { const m = e.target && e.target.closest && e.target.closest('video,img'); if (m) lastClickedMedia = m; } catch { /* */ }
  }, true);
  const usableMediaSrc = (el) => (el.tagName === 'VIDEO'
    ? (el.currentSrc || el.src || (el.querySelector('source') || {}).src || '')
    : (el.currentSrc || el.src || ''));
  const byArea = (a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight);
  // Лучший результат в Flow (видео ИЛИ картинка): приоритет — что кликнул юзер; иначе крупнейшее
  // видимое видео; иначе крупнейшая видимая картинка (мелкие иконки < 160px отсекаем).
  function findResultMedia() {
    const vids = [...document.querySelectorAll('video')].filter(visible).filter(usableMediaSrc);
    if (vids.length) { vids.sort(byArea); return (lastClickedMedia && vids.includes(lastClickedMedia)) ? lastClickedMedia : vids[0]; }
    const imgs = [...document.querySelectorAll('img')].filter(visible).filter(usableMediaSrc)
      .filter((i) => i.clientWidth >= 160 && i.clientHeight >= 160);
    if (!imgs.length) return null;
    imgs.sort(byArea);
    return (lastClickedMedia && imgs.includes(lastClickedMedia)) ? lastClickedMedia : imgs[0];
  }
  async function grabMediaData(el) {
    const kind = el.tagName === 'VIDEO' ? 'video' : 'image';
    const src = usableMediaSrc(el);
    if (!src) return {};
    if (src.startsWith('data:')) return { dataUrl: src, kind };
    if (src.startsWith('blob:')) {
      try { return { dataUrl: await blobToDataUrl(await (await fetch(src)).blob()), kind }; }
      catch { return { sourceUrl: src, kind }; }
    }
    // http(s): CDN Google-Flow требует авторизацию (наш сервер ловит HTTP 401). Качаем байты
    // в браузере юзера — background с его Google-cookie (credentials) → dataUrl. Фолбэк — sourceUrl.
    try {
      const b = await send({ type: 'fetch-bytes', url: src });
      if (b && b.ok && b.dataUrl) return { dataUrl: b.dataUrl, kind };
    } catch { /* фолбэк ниже */ }
    return { sourceUrl: src, kind };
  }
  // «В галерею»: забрать текущий результат (видео ИЛИ картинку) из Flow → наша Галерея (folder='flow').
  async function sendToGallery() {
    const el = findResultMedia();
    if (!el) { ui.line('⚠ видео/картинка не найдены — кликни нужный результат в Flow и повтори'); return; }
    const what = el.tagName === 'VIDEO' ? 'клип' : 'картинку';
    ui.line('забираю ' + what + ' из Flow…');
    const data = await grabMediaData(el);
    if (!data.sourceUrl && !data.dataUrl) { ui.line('⚠ не удалось прочитать медиа'); return; }
    const r = await send({ type: 'manual-ingest', payload: { ...data, title: (document.title || 'Flow').slice(0, 80) } });
    if (r && r.ok) ui.line('✓ ' + what + ' в Галерее → вкладка «Google Flow»');
    else ui.line('⚠ ' + ((r && r.error) || 'нет подключения — нажми «Подключить» в TrendTraffic'));
  }
  // Поле загрузки Flow (часто скрыто — по visible НЕ фильтруем); при отсутствии кликаем «добавить медиа».
  function findFileInput() {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    return inputs.find((i) => /video/i.test(i.accept || '')) || inputs.find((i) => !i.accept || /image|video|\*/i.test(i.accept)) || inputs[0] || null;
  }
  async function revealFileInput() {
    let inp = findFileInput();
    if (inp) return inp;
    const btns = [...document.querySelectorAll('button,[role="button"],[aria-label]')].filter(visible);
    const add = btns.find((b) => {
      const t = ((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase();
      return SELECTORS.addMediaText.some((k) => t.includes(k));
    });
    if (add) { add.click(); await sleep(800); inp = findFileInput(); }
    return inp;
  }
  async function injectFileIntoFlow(file) {
    const inp = await revealFileInput();
    if (!inp) return { ok: false, reason: 'upload-input не найден' };
    try {
      const dt = new DataTransfer(); dt.items.add(file);
      inp.files = dt.files;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
  }
  function dataUrlToFile(dataUrl, name) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
    const mime = m ? m[1] : 'video/mp4';
    const bin = atob(m ? m[2] : '');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  }
  const guessExt = (mime) => (/webm/i.test(mime || '') ? '.webm' : /quicktime|mov/i.test(mime || '') ? '.mov' : '.mp4');
  // «Из Галереи»: список видео → пикер в панели.
  async function openGalleryPicker() {
    ui.showPicker('загрузка списка…', []);
    const r = await send({ type: 'gallery-list' });
    if (!r || !r.ok) { ui.showPicker('⚠ ' + ((r && r.error) || 'нет подключения — нажми «Подключить»'), []); return; }
    if (!r.items || !r.items.length) { ui.showPicker('в Галерее нет видео', []); return; }
    ui.showPicker(null, r.items);
  }
  // Выбор видео из Галереи → скачиваем байты в фоне (обход CORS) → File → в поле загрузки Flow.
  async function pickGalleryItem(item) {
    ui.hidePicker();
    ui.line('качаю «' + (item.title || 'видео') + '»…');
    const b = await send({ type: 'fetch-bytes', url: item.fileUrl });
    if (!b || !b.ok) { ui.line('⚠ ' + ((b && b.error) || 'ошибка загрузки')); return; }
    const name = (item.title || 'gallery').replace(/[^\w.-]+/g, '_').slice(0, 60).replace(/\.(mp4|webm|mov)$/i, '') + guessExt(b.mime);
    const res = await injectFileIntoFlow(dataUrlToFile(b.dataUrl, name));
    if (res.ok) ui.line('✓ видео вставлено в Flow — выбери его как исходное/референс и генерируй');
    else ui.line('⚠ поле загрузки Flow не найдено (' + res.reason + ') — жму «разведка вёрстки»');
  }
  // Авто-разведка: снимок вёрстки Flow (кандидаты полей/кнопок/загрузки/видео + эндпоинты) → бэкенд.
  function collectRecon() {
    const vis = (el) => { try { return visible(el); } catch { return false; } };
    const tag = (el) => ({
      tag: el.tagName, id: el.id || '', cls: String(el.className || '').slice(0, 120),
      ph: (el.getAttribute && el.getAttribute('placeholder')) || '', aria: (el.getAttribute && el.getAttribute('aria-label')) || '',
      text: (el.textContent || '').trim().slice(0, 40), vis: vis(el),
    });
    return {
      url: location.href, ts: Date.now(),
      buttons: [...document.querySelectorAll('button,[role="button"]')].slice(0, 140).map(tag),
      textareas: [...document.querySelectorAll('textarea,[contenteditable="true"]')].slice(0, 30).map(tag),
      fileInputs: [...document.querySelectorAll('input[type="file"]')].map((i) => ({ accept: i.accept || '', cls: String(i.className || '').slice(0, 90), hidden: !vis(i) })),
      videos: [...document.querySelectorAll('video')].slice(0, 20).map((v) => ({ src: String(v.currentSrc || v.src || '').slice(0, 120), w: v.clientWidth, h: v.clientHeight, vis: vis(v) })),
      endpoints: reconApis.slice(-30),
    };
  }
  async function runRecon(silent) {
    const r = await send({ type: 'send-recon', payload: { data: collectRecon(), url: location.href } });
    if (!silent) ui.line(r && r.ok ? '✓ разведка вёрстки отправлена' : ('⚠ разведка: ' + ((r && r.error) || 'нет подключения')));
  }

  // ---------- команды от background ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'ping') { sendResponse({ ready: true }); return; }
    if (msg.type === 'run-task') {
      runTask(msg.task).then(sendResponse).catch((e) => sendResponse({ ok: false, reason: String(e && e.message || e) }));
      return true; // async
    }
  });

  // ---------- старт ----------
  injectInterceptor();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ui.mount());
  else ui.mount();
  log('content-flow готов');
})();
