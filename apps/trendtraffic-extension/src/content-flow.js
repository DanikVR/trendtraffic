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

  // ── Пакетный движок (CROM-паритет): токены для выбора режима/модели/формата/кол-ва/длины/
  //    разрешения. Flow ЛОКАЛИЗОВАН и меняет вёрстку → матчим по ТЕКСТУ/aria на многих языках, а не
  //    по хрупким CSS. Любую группу можно переопределить точным CSS-селектором через
  //    chrome.storage.local['flowSelectors'] (правка без пересборки — как remote-config у CROM). ──
  const BATCH = {
    // Переключатель режима генерации (Текст→Видео / Кадры→Видео / Ингредиенты→Видео и картиночные).
    modeTokens: {
      textToVideo: ['text to video', 'текст в видео', 'text-to-video', 'テキストから動画', '文本转视频', 'texto a video', 'texte en vidéo'],
      imageToVideo: ['frames to video', 'image to video', 'first frame', 'кадры в видео', 'изображение в видео', 'フレーム', '图像转视频', 'imagen a video'],
      components: ['ingredients to video', 'ingredients', 'components', 'ингредиенты', 'компоненты', '要素', '元素', 'ingredientes'],
      textToImage: ['text to image', 'текст в изображение', '文本转图像', 'texto a imagen', 'texte en image'],
      imageToImage: ['image to image', 'изображение в изображение', '图像转图像', 'imagen a imagen'],
    },
    // Значения групп-переключателей — по ним же находим САМ переключатель (элемент, показывающий
    // текущее значение группы = и есть её кнопка). target добавляем к группе при матче.
    aspectValues: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    aspectAlias: { '16:9': ['landscape', 'горизонт', '横', '16:9'], '9:16': ['portrait', 'вертикал', '縦', '9:16'], '1:1': ['square', 'квадрат', '正方', '1:1'] },
    modelHint: ['veo', 'omni', 'model', 'модель', 'モデル', '模型', 'modelo', 'banana', 'imagen'],
    // Слоты кадров режима «Кадры → Видео» (первый/последний кадр — кейфреймы Omni 1.1). Точный CSS
    // можно задать без релиза: chrome.storage.local['flowSelectors'] = {batchCss:{frameFirst,frameLast}}.
    frameSlotTokens: {
      first: ['first frame', 'start frame', 'starting frame', 'первый кадр', 'начальный кадр', 'primer fotograma', 'première image', '最初のフレーム', '首帧'],
      last: ['last frame', 'final frame', 'end frame', 'последний кадр', 'конечный кадр', 'último fotograma', 'dernière image', '最後のフレーム', '尾帧'],
    },
    countHint: ['output', 'count', 'quantity', 'videos', 'images', 'кол-во', 'количество', 'выход', '数量', '出力', 'cantidad', 'sorties'],
    lengthHint: ['length', 'duration', 'длит', 'секунд', 'sec', '秒', 'durée', 'duración'],
    // Скачивание готового тайла в нужном разрешении.
    downloadTokens: ['download', 'скачать', 'загрузить файл', 'télécharger', 'descargar', 'ダウンロード', '下载', 'حفظ'],
    resolutionTokens: {
      '720p': ['720p', '720', 'sd'], '1080p': ['1080p', '1080', 'hd', 'full hd'],
      '2k': ['2k', '1440', 'qhd'], '4k': ['4k', '2160', 'uhd'], '1k': ['1k', '1024'],
    },
    // Явные CSS-оверрайды (заполняются из storage; пусто = матчим эвристикой по тексту).
    css: {},
  };
  // Подтянуть оверрайды селекторов из storage (правка вживую без релиза). Мержим неглубоко.
  function loadSelectorOverrides() {
    try {
      chrome.storage.local.get('flowSelectors', (d) => {
        const o = d && d.flowSelectors;
        if (!o || typeof o !== 'object') return;
        for (const k of Object.keys(o)) {
          if (Array.isArray(o[k]) && Array.isArray(SELECTORS[k])) SELECTORS[k] = o[k];
          else if (k === 'batchCss' && o[k] && typeof o[k] === 'object') BATCH.css = { ...BATCH.css, ...o[k] };
          else if (BATCH[k] !== undefined) BATCH[k] = o[k];
        }
        log('оверрайды селекторов применены');
      });
    } catch { /* нет доступа к storage — работаем на дефолтах */ }
  }
  const RESULT_POLL_MS = 4000;
  const RESULT_MAX_MS = 7 * 60_000;

  const log = (...a) => console.log('[tt-flow]', ...a);
  // i18n: перевод строк НАШЕЙ панели/статусов. Фолбэк — русский (как было). Матчеры Flow не трогаем.
  const T = (key, fallback) => { try { const m = chrome.i18n.getMessage(key); return m || fallback; } catch (e) { return fallback; } };
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
      // Видимые тексты панели — через T() (структуру/классы шаблона не меняем).
      const TXT = {
        state: T('flow_state', 'Состояние'),
        notConnected: T('flow_notConnected', 'не подключено'),
        waitingTask: T('flow_waitingTask', 'Ожидаю задачи из TrendTraffic…'),
        pauseBtn: T('flow_pauseBtn', 'Пауза'),
        openTT: T('flow_openTT', 'Открыть TrendTraffic'),
        boosterBtn: T('flow_boosterBtn', '⚡ Flow Booster — пакет промптов'),
        boosterTitle: T('flow_boosterTitle', 'Открыть пульт пакетной генерации (боковая панель Chrome)'),
        boosterHint: T('flow_boosterHint', 'Панель не открылась — кликните иконку расширения TrendTraffic на панели Chrome'),
        toGalBtn: T('flow_toGalleryBtn', '⬆ В галерею'),
        toGalTitle: T('flow_toGalleryTitle', 'Отправить готовый клип из Flow в Галерею TrendTraffic'),
        fromGalBtn: T('flow_fromGalleryBtn', '⬇ Из Галереи'),
        fromGalTitle: T('flow_fromGalleryTitle', 'Взять видео из Галереи и залить в Flow на переработку'),
        reconPrefix: T('flow_reconPrefix', 'разведка: '),
        reconSuffix: T('flow_reconSuffix', ' запросов Flow'),
        reconBtn: T('flow_reconBtn', 'разведка вёрстки'),
        reconBtnTitle: T('flow_reconBtnTitle', 'Снять текущую вёрстку Flow и прислать нам (для подстройки)'),
      };
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
            <div class="btns"><button class="pri" id="boost" title="${TXT.boosterTitle}">${TXT.boosterBtn}</button></div>
            <div class="row"><span>${TXT.state}</span><span class="pill off" id="st">${TXT.notConnected}</span></div>
            <div class="wire" id="wire"></div>
            <div class="task" id="task">${TXT.waitingTask}</div>
            <div class="lg" id="lg"></div>
            <div class="btns">
              <button id="pause">${TXT.pauseBtn}</button>
              <button class="pri" id="open">${TXT.openTT}</button>
            </div>
            <div class="btns">
              <button id="toGal" title="${TXT.toGalTitle}">${TXT.toGalBtn}</button>
              <button id="fromGal" title="${TXT.fromGalTitle}">${TXT.fromGalBtn}</button>
            </div>
            <div class="pick hide" id="pick"></div>
            <div class="foot">
              <span class="mini" id="reconc">${TXT.reconPrefix}0${TXT.reconSuffix}</span>
              <button class="rec" id="recBtn" title="${TXT.reconBtnTitle}">${TXT.reconBtn}</button>
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
      // «Открыть TrendTraffic» → вкладка «Google Flow» Галереи (там — готовые проекты + генерация).
      els.open.addEventListener('click', () => window.open('https://app.trendtraffic.pro/gallery?tab=flow', '_blank'));
      els.pause.addEventListener('click', () => send({ type: 'flow-throttled' }).then(() => line(T('flow_pauseManual', 'Пауза включена вручную'))));
      // «Flow Booster» → открыть боковую панель Chrome (пульт пакета). Открывает background:
      // sidePanel.open доступен только там и требует пользовательский жест (клик доносится с сообщением).
      sh.getElementById('boost').addEventListener('click', () => {
        send({ type: 'open-booster' }).then((r) => { if (!r || !r.ok) line(TXT.boosterHint); });
      });
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
      // Прижать панель в видимую область при смене размеров окна (моб. режим/резайз) — иначе уезжает за экран.
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
    function status(kind, text) {
      if (!els.st) return;
      els.st.className = 'pill ' + kind;
      els.st.textContent = text;
    }
    function task(t) { if (els.task) els.task.textContent = t; }
    function recon() { reconCount++; if (els.reconc) els.reconc.textContent = T('flow_reconPrefix', 'разведка: ') + reconCount + T('flow_reconSuffix', ' запросов Flow'); }
    async function refreshStatus() {
      const r = await send({ type: 'tt-status' });
      if (!r) return;
      const paused = r.connected && Date.now() < (r.pausedUntil || 0);
      if (paused) status('wait', T('flow_statusPause', 'пауза'));
      else if (r.connected) status('on', T('flow_statusWorking', 'работает'));
      else status('off', T('flow_statusLogin', 'войдите в аккаунт'));
      // «Войдите в аккаунт» — кликабельно: открывает TrendTraffic (там авто-подключение).
      if (els.st) {
        const off = !r.connected && !paused;
        els.st.style.cursor = off ? 'pointer' : 'default';
        els.st.style.textDecoration = off ? 'underline' : 'none';
        els.st.title = off ? T('flow_stTitleOpen', 'Открыть TrendTraffic и войти — подключится само') : '';
        els.st.onclick = off ? () => window.open('https://app.trendtraffic.pro/gallery?tab=flow', '_blank') : null;
      }
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
      // Ссылка на ПОЛНУЮ Галерею (выбор как в редакторе: превью/поиск/папки + кнопка «→ Flow»).
      const full = document.createElement('div');
      full.className = 'it'; full.style.fontWeight = '700';
      full.textContent = T('flow_openFullGallery', '📂 Открыть полную Галерею →');
      full.title = T('flow_fullGalleryTitle', 'Галерея TrendTraffic — выбор как в редакторе, на каждом файле кнопка «→ Flow»');
      full.addEventListener('click', () => window.open('https://app.trendtraffic.pro/gallery', '_blank'));
      els.pick.appendChild(full);
      if (placeholder) { const p = document.createElement('div'); p.className = 'ph'; p.textContent = placeholder; els.pick.appendChild(p); }
      for (const it of (items || [])) {
        const row = document.createElement('div'); row.className = 'it';
        row.textContent = (it.type === 'image' ? '🖼 ' : '🎬 ') + (it.title || T('flow_fileFallback', 'файл')) + (it.folder ? '  ·  ' + it.folder : '');
        row.title = it.fileUrl || '';
        row.addEventListener('click', () => pickGalleryItem(it));
        els.pick.appendChild(row);
      }
    }
    function hidePicker() { if (els.pick) { els.pick.classList.add('hide'); els.pick.innerHTML = ''; } }
    // Выбор ИЗ МЕДИА НА ЭКРАНЕ Flow (превьюшки) → onPick(element).
    function showMediaPicker(mediaEls, onPick) {
      if (!els.pick) return;
      els.pick.classList.remove('hide');
      els.pick.innerHTML = '';
      const hint = document.createElement('div'); hint.className = 'ph'; hint.textContent = T('flow_pickHint', 'Кликни нужное — заберётся в Галерею');
      els.pick.appendChild(hint);
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:5px';
      for (const el of mediaEls) {
        const src = el.currentSrc || el.src || '';
        const cell = document.createElement('div');
        cell.style.cssText = 'aspect-ratio:1;border-radius:6px;overflow:hidden;cursor:pointer;background:#000;border:1px solid #2A303B';
        let thumb;
        if (el.tagName === 'VIDEO') { thumb = document.createElement('video'); thumb.muted = true; thumb.preload = 'metadata'; thumb.src = src; }
        else { thumb = document.createElement('img'); thumb.src = src; }
        thumb.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none';
        cell.appendChild(thumb);
        cell.addEventListener('click', () => { hidePicker(); onPick(el); });
        grid.appendChild(cell);
      }
      els.pick.appendChild(grid);
    }
    return { mount, line, status, task, recon, showPicker, hidePicker, showMediaPicker };
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
    ui.task('▶ ' + (task.prompt || T('flow_noPrompt', '(без промпта)')));
    ui.line(T('flow_taskNum', 'Задача #') + task.id);

    if (detectThrottle()) { send({ type: 'flow-throttled' }); return { ok: false, throttled: true }; }

    const okPrompt = await setPrompt(task.prompt || '');
    if (!okPrompt) { ui.line(T('flow_promptNotFound', '⚠ поле промпта не найдено — нужна разведка селекторов')); return { ok: false, reason: 'selector:promptInput' }; }
    ui.line(T('flow_promptSet', 'промпт подставлен'));

    // Референсы из Галереи → заливаем в Flow (video-to-video / кадры) ДО генерации. Best-effort.
    if (task.references && task.references.length) {
      for (const url of task.references.slice(0, 4)) {
        try {
          const b = await send({ type: 'fetch-bytes', url });
          if (b && b.ok) {
            const k = kindOfMime(b.mime);
            const up = await injectFileIntoFlow(dataUrlToFile(b.dataUrl, 'flow-' + k + extFor(b.mime, k)), k);
            ui.line(up.ok ? T('flow_refUploaded', 'референс залит в Flow') : (T('flow_refPrefix', 'референс: ') + up.reason));
            await sleep(700);
          } else { ui.line(T('flow_refDlFailed', 'референс не скачался') + (b && b.error ? ': ' + b.error : '')); }
        } catch { /* референс best-effort */ }
      }
    }

    await sleep(600);
    const btn = findGenerateButton();
    if (!btn) { ui.line(T('flow_genBtnNotFound', '⚠ кнопка генерации не найдена — нужна разведка')); return { ok: false, reason: 'selector:generateBtn' }; }
    btn.click();
    ui.line(T('flow_genStarted', 'генерация запущена, жду клип…'));

    const r = await waitForResult(Date.now());
    if (r.throttled) { send({ type: 'flow-throttled' }); ui.line('⏸ Flow: unusual activity'); return { ok: false, throttled: true }; }
    if (r.timeout) { ui.line(T('flow_timeoutClip', '⌛ таймаут ожидания клипа')); return { ok: false, reason: 'timeout' }; }
    ui.line(T('flow_clipReady', '✓ клип готов'));
    return { ok: true, sourceUrl: r.sourceUrl || null, dataUrl: r.dataUrl || null, meta: { title: task.title || null } };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ПАКЕТНЫЙ ДВИЖОК (CROM-паритет) — работает БЕЗ входа в аккаунт TrendTraffic.
  //  Панель side-panel шлёт по одному item; здесь: режим → параметры → референсы →
  //  промпт → генерация → ожидание N тайлов с % → (скачивание/в Галерею).
  // ═══════════════════════════════════════════════════════════════════════════
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const elText = (el) => norm((el.textContent || '') + ' ' + (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-value') || '')));
  // «Человеческий» клик: часть меню Flow не реагирует на голый .click() (нужны pointer/mouse события).
  function realClick(el) {
    try { el.scrollIntoView({ block: 'center' }); } catch { /* */ }
    const opts = { bubbles: true, cancelable: true, view: window };
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      try { el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, opts)); } catch { try { el.dispatchEvent(new MouseEvent('click', opts)); } catch { /* */ } }
    }
  }
  // Видимые интерактивные элементы (кнопки/пункты меню/опции).
  function interactives() {
    return queryAllDeep('button,[role="button"],[role="option"],[role="menuitem"],[role="tab"],[role="radio"],a,li,label').filter(visible);
  }
  // Найти видимый элемент, чей текст/aria содержит любой из токенов.
  function findByTokens(tokens, pool) {
    const list = pool || interactives();
    for (const el of list) { const t = elText(el); if (tokens.some((k) => t.includes(norm(k)))) return el; }
    return null;
  }
  // Выбор из группы-переключателя: элемент, показывающий ТЕКУЩЕЕ значение группы, и есть её кнопка.
  // Кликаем её → в раскрывшемся меню ищем пункт с целевым токеном. Уже стоит нужное — ничего не делаем.
  async function selectFromGroup(groupTokens, targetTokens, label) {
    // 1) уже выбрано?
    const already = interactives().find((el) => { const t = elText(el); return targetTokens.some((k) => t.includes(norm(k))); });
    // 2) кнопка группы = показывает любое значение группы
    const opener = findByTokens(groupTokens);
    if (already && (!opener || elText(opener).includes(norm(targetTokens[0])))) { return true; }
    if (!opener) { ui.line(`⚠ ${label}: контрол не найден`); return false; }
    realClick(opener);
    await sleep(500);
    // 3) пункт меню с целевым значением
    const item = findByTokens(targetTokens);
    if (item && item !== opener) { realClick(item); await sleep(350); return true; }
    // меню могло не раскрыться — если нужное значение уже показано, считаем ок
    if (already) return true;
    ui.line(`⚠ ${label}: вариант не найден`);
    return false;
  }
  async function selectMode(mode) {
    const tokens = BATCH.modeTokens[mode];
    if (!tokens) return true; // неизвестный режим — оставляем как есть
    const el = findByTokens(tokens);
    if (!el) { ui.line(`⚠ режим «${mode}» не найден`); return false; }
    realClick(el); await sleep(500); return true;
  }
  async function selectAspect(aspect) {
    if (!aspect) return true;
    const targets = [aspect, ...((BATCH.aspectAlias[aspect]) || [])];
    return selectFromGroup(BATCH.aspectValues, targets, `формат ${aspect}`);
  }
  async function selectModel(model) {
    if (!model) return true;
    // токены модели: сам ярлык + части («veo 3.1», «fast»/«quality»)
    const targets = [model, ...model.split(/[-\s]+/).filter((p) => p.length > 1)];
    return selectFromGroup(BATCH.modelHint, targets, `модель ${model}`);
  }
  async function selectCount(count) {
    if (!count || count < 1) return true;
    const opener = findByTokens(BATCH.countHint);
    if (opener) { realClick(opener); await sleep(400); }
    const targets = [String(count), count + 'x', count + ' '];
    const item = findByTokens(targets, interactives().filter((el) => /^\s*\d+\s*x?\s*$/.test(el.textContent || '')));
    if (item) { realClick(item); await sleep(300); return true; }
    return false; // не критично — Flow сгенерит дефолтное число
  }
  async function selectLength(seconds) {
    if (!seconds) return true;
    const opener = findByTokens(BATCH.lengthHint);
    if (opener) { realClick(opener); await sleep(400); }
    const targets = [seconds + 's', seconds + ' s', seconds + ' сек', seconds + '秒'];
    const item = findByTokens(targets);
    if (item) { realClick(item); await sleep(300); return true; }
    return false;
  }
  // Скачать тайл в нужном разрешении ЧЕРЕЗ РОДНОЕ меню Flow (истинный 4K/2K, не превью).
  // Наводимся на тайл → ищем кнопку «скачать» → пункт нужного разрешения. Не нашли → false
  // (панель скачает src напрямую как фолбэк). background.js переименует загрузку Flow в нашу папку.
  async function triggerNativeDownload(tileEl, resolution) {
    try { tileEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); tileEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); } catch { /* */ }
    await sleep(300);
    // кнопка скачивания рядом с тайлом (в его контейнере) либо глобальная
    const container = tileEl.closest('[class*="tile" i],[class*="result" i],[class*="card" i],figure,li') || document;
    let dl = [...(container.querySelectorAll ? container.querySelectorAll('button,[role="button"],a') : [])].filter(visible).find((b) => BATCH.downloadTokens.some((k) => elText(b).includes(norm(k))));
    if (!dl) dl = findByTokens(BATCH.downloadTokens);
    if (!dl) return { ok: false, reason: 'no-download-btn' };
    realClick(dl);
    await sleep(600);
    const resTokens = BATCH.resolutionTokens[String(resolution || '').toLowerCase()] || [];
    if (resTokens.length) {
      const item = findByTokens(resTokens);
      if (item) { realClick(item); await sleep(500); return { ok: true }; }
      // меню разрешений не появилось — но клик по «скачать» мог уже запустить загрузку дефолта
      return { ok: true, reason: 'default-res' };
    }
    return { ok: true, reason: 'no-res-menu' };
  }
  function emitProgress(itemId, phase, ready, total, note) {
    try { chrome.runtime.sendMessage({ type: 'flow-batch-progress', itemId, phase, ready: ready || 0, total: total || 0, note: note || '' }); } catch { /* панель могла закрыться */ }
  }

  // ── ПЕРСОНАЖИ / КОНСИСТЕНТНОСТЬ (auto-scan) ──
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'ref';
  // @-упоминание уже загруженного в Flow персонажа: печатаем «@Имя» и кликаем первую подсказку.
  async function mentionReference(name) {
    const input = pick(SELECTORS.promptInput);
    if (!input || !name) return false;
    input.focus();
    const cur = input.isContentEditable ? (input.textContent || '') : (input.value || '');
    const add = (cur && !/\s$/.test(cur) ? ' ' : '') + '@' + name;
    if (input.isContentEditable) { input.textContent = cur + add; input.dispatchEvent(new InputEvent('input', { bubbles: true })); }
    else setNativeValue(input, cur + add);
    await sleep(800);
    const opt = queryAllDeep('[role="option"],[role="menuitem"],li,[class*="mention" i] *').filter(visible)
      .find((e) => norm(e.textContent).includes(norm(name)) && (e.textContent || '').length < 60);
    if (opt) { realClick(opt); await sleep(350); return true; }
    return false;
  }
  // Прикрепить персонажей к текущему промпту: сперва @-упоминание (если в библиотеке Flow),
  // иначе загрузка картинки как референса (надёжный путь). chars = [{name?, dataUrl|url}] | [string].
  async function attachCharacters(chars, useMention) {
    if (!chars || !chars.length) return;
    for (let i = 0; i < Math.min(chars.length, 8); i++) {
      const c = chars[i];
      const name = (c && typeof c === 'object' ? c.name : '') || ('character_' + (i + 1));
      const src = (c && typeof c === 'object') ? (c.dataUrl || c.url) : c;
      let done = false;
      if (useMention && name) { try { done = await mentionReference(name); } catch { /* */ } }
      if (done) { ui.line(`персонаж «${name}» через @mention`); continue; }
      try {
        let file = null;
        if (typeof src === 'string' && src.startsWith('data:')) file = dataUrlToFile(src, 'flow-' + slug(name) + guessExt((/^data:([^;]+)/.exec(src) || [])[1] || ''));
        else if (typeof src === 'string' && src) { const b = await send({ type: 'fetch-bytes', url: src }); if (b && b.ok) file = dataUrlToFile(b.dataUrl, 'flow-' + slug(name) + extFor(b.mime, 'image')); }
        if (!file) { ui.line(`⚠ персонаж «${name}» не готов`); continue; }
        const up = await injectFileIntoFlow(file, 'image');
        ui.line(up.ok ? `персонаж «${name}» залит` : `персонаж «${name}»: ${up.reason}`);
        await sleep(900);
      } catch { ui.line(`⚠ персонаж «${name}» не залился`); }
    }
  }
  // ── КАДРЫ ПЕРЕХОДА (кейфреймы Omni 1.1): первый/последний кадр режима «Кадры → Видео» ──
  const frameFile = (slot, frame) => dataUrlToFile(frame.dataUrl || '', 'flow-' + slot + '-frame' + guessExt((/^data:([^;]+)/.exec(frame.dataUrl || '') || [])[1] || 'image/jpeg'));
  // Пул поиска слотов шире interactives(): плитки слотов у Flow бывают div с aria-label/title.
  const framePool = () => [...interactives(), ...queryAllDeep('[aria-label],[title]').filter(visible)];
  // Прикрепить кадр в слот: точный CSS-оверрайд → токены текста/aria → {ok:false, reason:'no-slot'}.
  async function attachFrame(slot, frame) {
    let opener = null;
    const cssSel = BATCH.css && BATCH.css[slot === 'first' ? 'frameFirst' : 'frameLast'];
    if (cssSel) { try { opener = [...document.querySelectorAll(cssSel)].filter(visible)[0] || null; } catch { /* кривой оверрайд — токены ниже */ } }
    if (!opener) opener = findByTokens(BATCH.frameSlotTokens[slot] || [], framePool());
    if (!opener) return { ok: false, reason: 'no-slot' };
    const before = new Set(document.querySelectorAll('input[type="file"]'));
    realClick(opener);
    await sleep(700);
    // Клик по слоту мог раскрыть попап с «upload» — дожимаем, потом ищем СВЕЖИЙ image-input.
    const freshInput = () => [...document.querySelectorAll('input[type="file"]')].find((i) => !before.has(i) && acceptsKind(i, 'image'));
    let inp = freshInput();
    if (!inp) {
      const up = findByTokens(SELECTORS.addMediaText);
      if (up) { realClick(up); await sleep(600); }
      inp = freshInput() || findFileInput('image');
    }
    if (!inp) return { ok: false, reason: 'no-file-input' };
    return setInputFiles(inp, frameFile(slot, frame));
  }
  // Оба кадра по очереди. Слоты не нашлись токенами → фолбэк: общее поле загрузки по порядку
  // (Flow кладёт файлы в следующий пустой слот). Провал любого кадра = провал item (честный reason).
  async function attachFrames(frames) {
    ui.line(T('flow_kfAttaching', 'прикрепляю кадры перехода…'));
    // Панель шлёт кадры строками dataURL; принимаем и {dataUrl} на вырост.
    const asFrame = (f) => (typeof f === 'string' ? { dataUrl: f } : (f && f.dataUrl ? f : null));
    const seq = [];
    const first = asFrame(frames.first), last = asFrame(frames.last);
    if (first) seq.push(['first', first]);
    if (last) seq.push(['last', last]);
    if (!seq.length) return { ok: true };
    let fellBack = false;
    for (const [slot, frame] of seq) {
      let r = await attachFrame(slot, frame);
      if (!r.ok && r.reason === 'no-slot') {
        if (!fellBack) { ui.line(T('flow_kfFallback', 'слоты кадров не найдены — заливаю по порядку')); fellBack = true; }
        r = await injectFileIntoFlow(frameFile(slot, frame), 'image');
      }
      if (!r.ok) return { ok: false, reason: slot + ':' + (r.reason || 'fail') };
      await sleep(1300); // Flow дорисовывает превью слота перед следующей заливкой
    }
    ui.line(T('flow_kfDone', '✓ кадры перехода на месте'));
    return { ok: true };
  }
  // Применить параметры генерации (идемпотентно — no-op, если уже стоит нужное).
  async function applyParams(it) {
    if (it.mode) await selectMode(it.mode);
    if (it.aspectRatio) await selectAspect(it.aspectRatio);
    if (it.model) await selectModel(it.model);
    if (it.outputCount) await selectCount(it.outputCount);
    if (it.videoLength) await selectLength(it.videoLength);
  }

  // ── SUBMIT/COLLECT: разделяем ЗАПУСК и СБОР → параллельная генерация (несколько в полёте) ──
  // ВАЖНО: идентичность тайлов — по ССЫЛКЕ НА DOM-ЭЛЕМЕНТ (WeakSet), НЕ по контент-ключу.
  // Контент-ключ (videoKey) коллизит: у картинок duration/videoWidth=undefined → один ключ на все,
  // у клипов одинаковой длины/размера — тоже; из-за этого собирался только ПЕРВЫЙ результат.
  const batchSubmits = new Map(); // submitId → { baseline:WeakSet<el>, expected, collected:[], item, startedAt }
  let batchSeq = 0;
  let batchClaimedEls = new WeakSet(); // элементы-тайлы, уже отданные какому-то submit (без двойного захвата)
  function flowResetBatch() { batchSubmits.clear(); batchClaimedEls = new WeakSet(); return { ok: true }; }
  // Элемент внутри НАШЕЙ панели (#tt-flow-host)? — превью в пикере не считать за результат.
  function inOurPanel(el) { try { const r = el.getRootNode && el.getRootNode(); return !!(r && r.host && r.host.id === 'tt-flow-host'); } catch { return false; } }
  // Кандидаты-результаты на экране (видео + крупные картинки), кроме нашей панели.
  function batchMediaEls() {
    return queryAllDeep('video,img').filter(visible).filter(usableMediaSrc)
      .filter((el) => el.tagName === 'VIDEO' || (el.clientWidth >= 120 && el.clientHeight >= 120))
      .filter((el) => !inOurPanel(el));
  }

  // Запустить ОДНУ генерацию (не ждём результата). Возвращает { ok, submitId }.
  async function flowSubmit(item) {
    const it = item || {};
    ui.task('▶ ' + (it.prompt || '(без промпта)').slice(0, 120));
    if (detectThrottle()) { send({ type: 'flow-throttled' }); return { ok: false, throttled: true }; }
    if (!/\/project\//.test(location.href)) { try { await openProject(); } catch { /* best-effort */ } }
    await applyParams(it);
    const imageDriven = it.mode === 'imageToVideo' || it.mode === 'components' || it.mode === 'imageToImage';
    // Переход по кадрам (первый → последний): кадры занимают слоты Flow — персонажи для таких
    // item не прикрепляются (панель их и не шлёт). Провал прикрепления = провал item, не генерим текстом.
    const hasFrames = !!(it.mode === 'imageToVideo' && it.frames && (it.frames.first || it.frames.last));
    if (hasFrames) {
      emitProgress(it.id, 'frames', 0, 0, '');
      const fr = await attachFrames(it.frames);
      if (!fr.ok) { ui.line(T('flow_kfFail', '⚠ кадры перехода: ') + fr.reason); return { ok: false, reason: 'frames:' + fr.reason }; }
    }
    if (imageDriven && !hasFrames && it.characters && it.characters.length) { emitProgress(it.id, 'refs', 0, 0, ''); await attachCharacters(it.characters, it.useMention); }
    const okPrompt = await setPrompt(it.prompt || '');
    if (!okPrompt) { ui.line('⚠ поле промпта не найдено'); return { ok: false, reason: 'selector:promptInput' }; }
    await sleep(400);
    const baseline = new WeakSet(batchMediaEls()); // медиа, СУЩЕСТВОВАВШИЕ до этой генерации (по ссылке)
    const btn = findGenerateButton();
    if (!btn) { ui.line('⚠ кнопка генерации не найдена'); return { ok: false, reason: 'selector:generateBtn' }; }
    realClick(btn);
    const submitId = ++batchSeq;
    batchSubmits.set(submitId, { baseline, expected: Math.max(1, it.outputCount || 1), collected: [], item: it, startedAt: Date.now() });
    ui.line(`▶ #${submitId} запущена: ${(it.prompt || '').slice(0, 40)}`);
    emitProgress(it.id, 'submit', 0, it.outputCount || 1, '');
    return { ok: true, submitId };
  }

  // Собрать готовые НОВЫЕ тайлы этого submit (FIFO-атрибуция по ссылке на элемент). Возвращает
  // { ok, done, results?, ready, expected }. Панель поллит, пока done не станет true.
  async function flowCollect(payload) {
    const p = payload || {};
    const s = batchSubmits.get(p.submitId);
    if (!s) return { ok: false, reason: 'no-submit' };
    if (detectThrottle()) { send({ type: 'flow-throttled' }); return { ok: false, throttled: true }; }
    for (const el of batchMediaEls()) {
      if (s.collected.length >= s.expected) break;
      if (s.baseline.has(el) || batchClaimedEls.has(el)) continue; // был до генерации ИЛИ уже отдан
      const src = usableMediaSrc(el);
      const ready = src && (!src.startsWith('blob:') || el.tagName !== 'VIDEO' || (el.readyState >= 1 && Number.isFinite(el.duration)));
      if (!ready) continue;
      batchClaimedEls.add(el);
      const kind = el.tagName === 'VIDEO' ? 'video' : 'image';
      let native = false;
      if (p.autoDownload && p.viaNativeMenu) { const d = await triggerNativeDownload(el, p.resolution); native = !!(d && d.ok); await sleep(600); }
      // http(s) CDN-ссылку НЕ инлайним в dataUrl (крупный клип → >60с в канале сообщений и таймаут):
      // отдаём sourceUrl, а байты качает фон (downloads.download / fetchBytes с cookie). blob/data → инлайн.
      let out;
      if (/^https?:/i.test(src)) out = { sourceUrl: src, kind };
      else out = await grabMediaData(el); // blob/data → dataUrl (иначе фон не скачает)
      s.collected.push({ kind, native, dataUrl: out.dataUrl || null, sourceUrl: out.sourceUrl || null });
      ui.line(`✓ тайл ${s.collected.length}/${s.expected} (#${p.submitId})`);
    }
    emitProgress(p.itemId, 'generating', s.collected.length, s.expected, Math.round((s.collected.length / s.expected) * 100) + '%');
    if (s.collected.length >= s.expected) { batchSubmits.delete(p.submitId); return { ok: true, done: true, results: s.collected }; }
    if (Date.now() - s.startedAt > RESULT_MAX_MS) { batchSubmits.delete(p.submitId); return { ok: true, done: true, results: s.collected, timeout: true }; }
    return { ok: true, done: false, ready: s.collected.length, expected: s.expected };
  }

  // ---------- 4. двусторонняя связь Flow ↔ Галерея ----------
  function blobToDataUrl(blob) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(blob); });
  }
  // Последнее медиа (видео/картинка), кликнутое юзером в Flow — приоритетный кандидат для «В галерею».
  let lastClickedMedia = null;
  let lastClickedAt = 0;
  document.addEventListener('click', (e) => {
    try {
      const path = (e.composedPath && e.composedPath()) || [];
      const m = path.find((n) => n && (n.tagName === 'VIDEO' || n.tagName === 'IMG')) || (e.target && e.target.closest && e.target.closest('video,img'));
      if (m) { lastClickedMedia = m; lastClickedAt = Date.now(); }
    } catch { /* */ }
  }, true);
  const usableMediaSrc = (el) => (el.tagName === 'VIDEO'
    ? (el.currentSrc || el.src || (el.querySelector('source') || {}).src || '')
    : (el.currentSrc || el.src || ''));
  const byArea = (a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight);
  // Глубокий querySelectorAll — сквозь shadow-DOM (Flow рендерит части в web-components).
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
  // Лучший результат в Flow (видео ИЛИ картинка): приоритет — что кликнул юзер; иначе крупнейшее
  // видимое видео; иначе крупнейшая видимая картинка (мелкие иконки < 120px отсекаем).
  function findResultMedia() {
    const vids = queryAllDeep('video').filter(visible).filter(usableMediaSrc);
    if (vids.length) { vids.sort(byArea); return (lastClickedMedia && vids.includes(lastClickedMedia)) ? lastClickedMedia : vids[0]; }
    const imgs = queryAllDeep('img').filter(visible).filter(usableMediaSrc)
      .filter((i) => i.clientWidth >= 120 && i.clientHeight >= 120);
    if (!imgs.length) return null;
    imgs.sort(byArea);
    return (lastClickedMedia && imgs.includes(lastClickedMedia)) ? lastClickedMedia : imgs[0];
  }
  // Скачать медиа ИЗ СТРАНИЦЫ (её cookie/Referer/Origin) → dataUrl. С cookie и без (подписанные URL их отвергают).
  async function pageFetchDataUrl(url) {
    const tryF = async (opts) => { try { const r = await fetch(url, opts); return r.ok ? r : null; } catch { return null; } };
    // Сначала БЕЗ credentials (CDN Flow отдаёт ACAO:* — так CORS не ругается в консоли), потом с cookie.
    const res = (await tryF({})) || (await tryF({ credentials: 'include' }));
    if (!res) throw new Error('page fetch fail');
    const blob = await res.blob();
    if (blob.size < 64) throw new Error('пусто');
    if (blob.size > 500 * 1024 * 1024) throw new Error('слишком большое (>500МБ)');
    return await blobToDataUrl(blob);
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
    // http(s): CDN Flow за авторизацией (сервер ловит 401). 3 пути → dataUrl:
    // 1) из СТРАНИЦЫ (её сессия), 2) background (extension, cookie хоста, обход CORS), 3) фолбэк sourceUrl.
    try { return { dataUrl: await pageFetchDataUrl(src), kind }; } catch { /* → дальше */ }
    try {
      const b = await send({ type: 'fetch-bytes', url: src });
      if (b && b.ok && b.dataUrl) return { dataUrl: b.dataUrl, kind };
    } catch { /* фолбэк ниже */ }
    return { sourceUrl: src, kind };
  }
  // Кратко подсветить выбранный элемент (юзер видит, что ИМЕННО берём).
  function flashHighlight(el) {
    try {
      const so = el.style.outline, sf = el.style.outlineOffset;
      el.style.outline = '3px solid #6366f1'; el.style.outlineOffset = '2px';
      setTimeout(() => { try { el.style.outline = so; el.style.outlineOffset = sf; } catch { /* */ } }, 1800);
    } catch { /* */ }
  }
  // Все видимые медиа на экране (видео+картинки, крупные первыми).
  function collectVisibleMedia() {
    const vids = queryAllDeep('video').filter(visible).filter(usableMediaSrc);
    const imgs = queryAllDeep('img').filter(visible).filter(usableMediaSrc).filter((i) => i.clientWidth >= 120 && i.clientHeight >= 120);
    return [...vids, ...imgs].sort(byArea).slice(0, 12);
  }
  // Забрать КОНКРЕТНЫЙ элемент → Галерея.
  async function grabAndSend(el) {
    flashHighlight(el);
    const what = el.tagName === 'VIDEO' ? T('flow_kindClip', 'клип') : T('flow_kindPicture', 'картинку');
    ui.line(T('flow_grabPre', 'забираю ') + what + T('flow_grabSuf', ' из Flow…'));
    const data = await grabMediaData(el);
    if (!data.sourceUrl && !data.dataUrl) { ui.line(T('flow_mediaReadFailed', '⚠ не удалось прочитать медиа')); return; }
    if (data.sourceUrl && !data.dataUrl) { try { ui.line(T('flow_cdnAuthPre', 'CDN за авторизацией: ') + new URL(data.sourceUrl).host + T('flow_cdnAuthSuf', ' — пробую через сервер')); } catch { /* */ } }
    const r = await send({ type: 'manual-ingest', payload: { ...data, title: (document.title || 'Flow').slice(0, 80) } });
    if (r && r.ok) ui.line('✓ ' + what + T('flow_inGallerySuf', ' в Галерее → вкладка «Google Flow»'));
    else ui.line('⚠ ' + ((r && r.error) || T('flow_noConnConnect', 'нет подключения — нажми «Подключить» в TrendTraffic')));
  }
  // «В галерею»: (1) кликнул медиа ≤12с — берём ЕГО; (2) одно на экране — его; (3) несколько — ВЫБОР превьюшками.
  async function sendToGallery() {
    if (lastClickedMedia && (Date.now() - lastClickedAt < 12000) && document.contains(lastClickedMedia) && visible(lastClickedMedia) && usableMediaSrc(lastClickedMedia)) {
      return grabAndSend(lastClickedMedia);
    }
    const cands = collectVisibleMedia();
    if (!cands.length) { ui.line(T('flow_clickMediaFirst', '⚠ кликни нужное фото/видео в Flow, потом «В галерею»')); return; }
    if (cands.length === 1) return grabAndSend(cands[0]);
    ui.line(T('flow_multipleMedia', 'несколько медиа — выбери, что забрать ↓'));
    ui.showMediaPicker(cands, (el) => grabAndSend(el));
  }
  // Подходит ли input[type=file] под тип (image/video). Пустой accept или */* — принимает всё.
  function acceptsKind(inp, kind) {
    const a = String(inp.accept || '').toLowerCase().trim();
    if (!a || a === '*' || a.includes('*/*')) return true;
    return kind === 'video' ? a.includes('video') : a.includes('image');
  }
  // Поле загрузки Flow под нужный ТИП (скрытые тоже). Для видео НЕ берём image-only поле —
  // иначе Flow ругается «Графический формат не поддерживается» (у Flow тут одно поле image/*).
  function findFileInput(kind) {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    const ok = inputs.filter((i) => acceptsKind(i, kind));
    return ok.find((i) => String(i.accept || '').toLowerCase().includes(kind === 'video' ? 'video' : 'image')) || ok[0] || null;
  }
  // Кликнуть «добавить медиа/загрузки/upload», чтобы Flow отрисовал поле загрузки.
  async function revealUploadUI() {
    const btns = [...document.querySelectorAll('button,[role="button"],[aria-label]')].filter(visible);
    const add = btns.find((b) => {
      const t = ((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase();
      return SELECTORS.addMediaText.some((k) => t.includes(k));
    });
    if (add) { add.click(); await sleep(800); }
  }
  // Открыть ПРОЕКТ, если мы на списке/главной (там поля загрузки нет — оно только внутри проекта).
  // Клик «Создать проект»/карточку → ждём SPA-роут в /project/ + появление image-поля. Flow = SPA,
  // поэтому content-script переживает переход (без полной перезагрузки).
  async function openProject() {
    if (/\/project\//.test(location.href)) return true;
    const clickable = [...document.querySelectorAll('button,[role="button"],a')].filter(visible);
    const create = clickable.find((b) => /создать проект|create project|new project/i.test(((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase()));
    const card = clickable.find((b) => b.tagName === 'A' && /\/project\//.test(b.getAttribute('href') || ''));
    const target = create || card;
    if (!target) return false;
    ui.line(T('flow_openingProject', 'открываю проект в Flow…'));
    target.click();
    for (let i = 0; i < 14; i++) { await sleep(700); if (/\/project\//.test(location.href) && findFileInput('image')) return true; }
    return /\/project\//.test(location.href) && !!findFileInput('image');
  }
  async function injectFileIntoFlow(file, kind) {
    let inp = findFileInput(kind);
    if (!inp) { await revealUploadUI(); inp = findFileInput(kind); }
    // Картинка, поля нет и мы НЕ в проекте (на списке/главной) → сами откроем проект и повторим.
    if (!inp && kind === 'image' && !/\/project\//.test(location.href)) {
      if (await openProject()) { await revealUploadUI(); inp = findFileInput(kind); }
    }
    if (!inp) {
      // Для видео есть только image-поле → честно сообщаем (не втыкаем видео в image → ошибка Flow).
      const imageOnly = [...document.querySelectorAll('input[type="file"]')].some((i) => /image/i.test(i.accept || '') && !/video|\*/i.test(i.accept || ''));
      if (kind === 'video' && imageOnly) return { ok: false, reason: T('flow_onlyImagesHere', 'Flow здесь принимает только картинки — видео залей через раздел «Загрузки» Flow') };
      return { ok: false, reason: T('flow_uploadFieldNotFound', 'поле загрузки не найдено — открой ПРОЕКТ в Flow (не главную): внутри проекта есть загрузка (+/«Загрузки»)') };
    }
    return setInputFiles(inp, file);
  }
  // Подложить файл в конкретный input[type=file] (реактовский change — как при ручном выборе).
  function setInputFiles(inp, file) {
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
    const mime = m ? m[1] : 'application/octet-stream';
    const bin = atob(m ? m[2] : '');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  }
  const kindOfMime = (mime) => (/^image\//i.test(mime || '') ? 'image' : 'video');
  // Стандартное расширение под тип — чистое имя файла в Flow (без «своего формата»).
  const extFor = (mime, kind) => {
    const m = String(mime || '').toLowerCase();
    if ((kind || kindOfMime(m)) === 'image') return m.includes('png') ? '.png' : m.includes('webp') ? '.webp' : m.includes('gif') ? '.gif' : '.jpg';
    return m.includes('webm') ? '.webm' : (m.includes('quicktime') || m.includes('mov')) ? '.mov' : '.mp4';
  };
  const guessExt = (mime) => extFor(mime, kindOfMime(mime));
  // «Из Галереи»: список видео → пикер в панели.
  async function openGalleryPicker() {
    ui.showPicker(T('flow_loadingList', 'загрузка списка…'), []);
    const r = await send({ type: 'gallery-list' });
    if (!r || !r.ok) { ui.showPicker('⚠ ' + ((r && r.error) || T('flow_noConnConnectShort', 'нет подключения — нажми «Подключить»')), []); return; }
    if (!r.items || !r.items.length) { ui.showPicker(T('flow_galleryEmpty', 'в Галерее нет медиа'), []); return; }
    ui.showPicker(null, r.items);
  }
  // Выбор медиа из Галереи → скачиваем в фоне (обход CORS) → File → в поле загрузки Flow (+ авто-открытие проекта).
  async function pickGalleryItem(item) {
    ui.hidePicker();
    await injectUrlCore(item.fileUrl, item.type, item.title, false);
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
    if (!silent) ui.line(r && r.ok ? T('flow_reconSent', '✓ разведка вёрстки отправлена') : (T('flow_reconFail', '⚠ разведка: ') + ((r && r.error) || T('flow_noConnection', 'нет подключения'))));
  }

  // ── список ГОТОВЫХ ПРОЕКТОВ Flow (карточки главной labs.google/fx/…/tools/flow) ──
  // Для вкладки «Google Flow» в Галерее: снимаем плитки проектов, чтобы открывать их
  // «проектором» (клик по карточке → новая вкладка на /project/<id>). Flow — SPA +
  // web-components, поэтому ищем ссылки на проекты сквозь shadow DOM.
  const cleanText = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  // Обложка карточки: <img> (в т.ч. lazy data-src/srcset) → <video> poster/src → CSS background-image.
  function thumbOf(a, card) {
    const pickImg = (root) => {
      const im = root && root.querySelector && root.querySelector('img');
      if (im) return im.currentSrc || im.src || im.getAttribute('data-src') || (im.getAttribute('srcset') || '').split(' ')[0] || '';
      return '';
    };
    let t = pickImg(a) || pickImg(card);
    if (!t) {
      const v = (a && a.querySelector && a.querySelector('video')) || (card && card.querySelector && card.querySelector('video'));
      if (v) t = v.poster || v.currentSrc || v.src || '';
    }
    if (!t) {
      // background-image на ссылке/карточке/её потомках (Flow часто рисует превью фоном div-а).
      const roots = [a, card].filter(Boolean);
      for (const root of roots) {
        const els = [root, ...Array.from(root.querySelectorAll ? root.querySelectorAll('*') : []).slice(0, 60)];
        for (const el of els) {
          let bg = '';
          try { bg = getComputedStyle(el).backgroundImage || ''; } catch { /* */ }
          const m = /url\(["']?(.*?)["']?\)/.exec(bg);
          if (m && m[1] && !/^data:image\/svg/i.test(m[1])) { t = m[1]; break; }
        }
        if (t) break;
      }
    }
    try { return t ? new URL(t, location.href).href : ''; } catch { return t || ''; }
  }
  // Обложка → data URL (контент-скрипт на labs.google имеет Google-сессию → обходит 401/CORS,
  // картинка гарантированно покажется в приложении). Мелкие обложки инлайним, крупные оставляем ссылкой.
  async function thumbDataUrl(url, cap) {
    if (!url || url.startsWith('data:')) return url || '';
    const tryF = async (opts) => { try { const r = await fetch(url, opts); return r.ok ? r : null; } catch { return null; } };
    const res = (await tryF({})) || (await tryF({ credentials: 'include' }));
    if (!res) return '';
    const blob = await res.blob();
    if (!blob.size || blob.size > (cap || 500 * 1024)) return '';
    if (blob.type && !/^image\//i.test(blob.type)) return '';
    try { return await blobToDataUrl(blob); } catch { return ''; }
  }
  async function listProjects() {
    // Flow — тяжёлый SPA: карточки проектов появляются НЕ сразу после загрузки страницы.
    // Ждём, пока в DOM (сквозь shadow) появятся ссылки на проекты — до ~18с, иначе вернём пусто.
    const findLinks = () => queryAllDeep('a[href*="/tools/flow/project/"]').filter(visible);
    let links = findLinks();
    if (!links.length) {
      const t0 = Date.now();
      while (Date.now() - t0 < 22000) {
        await sleep(700);
        links = findLinks();
        if (links.length) break;
      }
    }
    const out = [];
    const seen = new Set();
    for (const a of links) {
      const raw = a.getAttribute('href') || a.href || '';
      const m = /\/project\/([a-z0-9-]+)/i.exec(raw);
      const id = m ? m[1] : null;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      let url = raw;
      try { url = new URL(raw, location.href).href; } catch { /* оставим как есть */ }
      // Карточка = ссылка или ближайший контейнер-плитка (обложка/подпись живут там).
      const card = a.closest('[class*="project" i], li, article') || a.parentElement || a;
      const thumb = thumbOf(a, card);
      // Название: aria-label ссылки → видимый текст плитки (дата). Обрезаем подписи кнопок карточки
      // Flow (иконки-лигатуры edit/delete + тултипы «Изменить проект»/«Удалить»), приклеенные к дате.
      let title = cleanText(a.getAttribute('aria-label') || a.getAttribute('title') || '');
      if (!title && card && card !== a) {
        title = cleanText(card.textContent).split(/\s*(?:edit|delete|more_vert|content_copy|Изменить|Удалить|Открыть|Дублировать|Переименовать)/i)[0].trim();
      }
      if (!title) title = 'Проект Flow';
      out.push({ id, url, title: title.slice(0, 80), thumb: (thumb || '').slice(0, 800) });
      if (out.length > 120) break;
    }
    // Дотягиваем обложки как data URL (сессия labs.google) — иначе кросс-доменная картинка
    // на app.trendtraffic.pro часто не грузится (401/приватный CDN Flow). Мелкие инлайним.
    await Promise.all(out.map(async (p) => {
      if (!p.thumb || p.thumb.startsWith('data:')) return;
      try { const d = await thumbDataUrl(p.thumb, 450 * 1024); if (d) p.thumb = d; } catch { /* оставим ссылку */ }
    }));
    // Признак входа: если ссылок нет, но мы на странице входа/аккаунтов — залогиниться надо.
    const loggedOut = out.length === 0 && /accounts\.google\.com|\/signin|ServiceLogin/i.test(location.href);
    return { ok: true, projects: out, loggedIn: !loggedOut };
  }

  // Скачать медиа Галереи (background) → File → залить в Flow. isRetry — повтор после открытия проекта.
  // Пока НЕ в проекте, сохраняем «отложенную вставку» в storage: если Flow перезагрузит страницу при
  // открытии проекта, при следующей загрузке (уже в /project/) вставка доведётся сама.
  async function injectUrlCore(url, kind, title, isRetry) {
    if (!isRetry && !/\/project\//.test(location.href)) {
      try { chrome.storage.local.set({ pendingInject: { url, kind, title, ts: Date.now() } }); } catch { /* */ }
    }
    ui.line(T('flow_gettingMedia', 'получаю медиа из Галереи…'));
    const b = await send({ type: 'fetch-bytes', url });
    if (!b || !b.ok) { ui.line(T('flow_galleryDlFailed', '⚠ не скачалось из Галереи') + (b && b.error ? ': ' + b.error : '')); try { chrome.storage.local.remove('pendingInject'); } catch { /* */ } return { ok: false, error: b && b.error }; }
    const k = (kind === 'image' || kind === 'video') ? kind : kindOfMime(b.mime);
    const res = await injectFileIntoFlow(dataUrlToFile(b.dataUrl, 'flow-' + k + extFor(b.mime, k)), k);
    ui.line(res.ok ? ('✓ ' + (k === 'image' ? T('flow_insertedImage', 'картинка') : T('flow_insertedVideo', 'видео')) + T('flow_insertedSuf', ' вставлено в Flow из Галереи')) : ('⚠ ' + res.reason));
    if (res.ok) { try { chrome.storage.local.remove('pendingInject'); } catch { /* */ } }
    return res;
  }
  // При загрузке content-script: если есть свежая «отложенная вставка» и мы уже в проекте — довести.
  function resumePendingInject() {
    try {
      chrome.storage.local.get('pendingInject', (d) => {
        const p = d && d.pendingInject;
        if (!p || !p.url) return;
        chrome.storage.local.remove('pendingInject'); // одна попытка — без циклов
        if (Date.now() - (p.ts || 0) < 90000 && /\/project\//.test(location.href)) {
          setTimeout(() => injectUrlCore(p.url, p.kind, p.title, true), 2500);
        }
      });
    } catch { /* */ }
  }

  // ---------- команды от background ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'ping') { sendResponse({ ready: true }); return; }
    if (msg.type === 'list-projects') {
      // Список готовых проектов Flow (для вкладки «Google Flow» Галереи). Async: ждём отрисовки карточек.
      listProjects().then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
      return true; // ответ асинхронный
    }
    if (msg.type === 'run-task') {
      flowTaskBusy = true; // вотчер проектов не трогает страницу, пока идёт задача очереди
      runTask(msg.task)
        .then((r) => { flowTaskBusy = false; sendResponse(r); })
        .catch((e) => { flowTaskBusy = false; sendResponse({ ok: false, reason: String(e && e.message || e) }); });
      return true; // async
    }
    if (msg.type === 'inject-url') {
      // Из Галереи TrendTraffic: скачать медиа (background, обход CORS) → залить в поле загрузки Flow.
      injectUrlCore(msg.url, msg.kind, msg.title, false).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
      return true; // async
    }
    if (msg.type === 'flow-reset') { flowTaskBusy = false; sendResponse(flowResetBatch()); return; }
    if (msg.type === 'flow-submit') {
      // Пакетный движок (side-panel, без входа): ЗАПУСК одной генерации (не ждём результата).
      flowTaskBusy = true; // вотчер проектов не мешает, пока идёт пакет
      // busy сверяем с реальным числом в полёте: если submit упал (селектор не найден) и в полёте
      // ничего нет — НЕ оставляем busy=true навсегда (иначе вотчер авто-ингеста заморожен до reset).
      flowSubmit(msg.item)
        .then((r) => { flowTaskBusy = batchSubmits.size > 0; sendResponse(r); })
        .catch((e) => { flowTaskBusy = batchSubmits.size > 0; sendResponse({ ok: false, reason: String(e && e.message || e) }); });
      return true; // async
    }
    if (msg.type === 'flow-collect') {
      // СБОР готовых тайлов запущенной генерации (панель поллит до done).
      flowCollect(msg.payload)
        .then((r) => { flowTaskBusy = batchSubmits.size > 0; sendResponse(r); })
        .catch((e) => { flowTaskBusy = batchSubmits.size > 0; sendResponse({ ok: false, reason: String(e && e.message || e) }); });
      return true; // async
    }
  });

  // ── ВОТЧЕР ПРОЕКТА FLOW: юзер генерит ПРЯМО в Flow ─────────────────────────
  // Каждые ~25с на странице /project/<id>: (1) идёт генерация → индикатор на карточке проекта в
  // Галерее; (2) НОВЫЕ готовые клипы (появились после наблюдавшейся генерации) → авто-заливка в
  // Галерею → «Видео». Старые клипы (домотал страницу) в Галерею НЕ тянем — только в базлайн.
  let flowTaskBusy = false;
  let flowWatcherBusy = false;
  let sawGeneratingAt = 0;
  const flowIngestFails = new Map(); // videoKey → число неудачных заливок (3 → сдаёмся)
  // Формы «генерируется/generating» — НЕ ловим кнопки «Сгенерировать»/«Регенерировать» (те в
  // button) и наш собственный виджет (#tt-flow-host).
  const FLOW_GEN_RE = /(generating|генериру(?:ется|ются)|создаётся|создается|создаём|создаем)/i;
  const flowProjectId = () => { const m = /\/project\/([a-z0-9-]+)/i.exec(location.href); return m ? m[1] : null; };
  function flowGeneratingCount() {
    let n = 0;
    for (const el of queryAllDeep('div,span,p')) {
      if (!visible(el)) continue;
      const t = (el.textContent || '').trim();
      if (!t || t.length > 80) continue;
      const leaf = ![...(el.children || [])].some((c) => (c.textContent || '').trim().length > 0);
      if (!leaf) continue;
      try {
        if (el.closest && el.closest('button,[role="button"],[role="slider"]')) continue; // подписи кнопок/слайдеров
        const rootHost = el.getRootNode && el.getRootNode().host;
        if (rootHost && rootHost.id === 'tt-flow-host') continue; // наш виджет
      } catch { /* */ }
      if (FLOW_GEN_RE.test(t) || /^\d{1,3}\s?%$/.test(t)) { n++; if (n >= 20) break; }
    }
    return n;
  }
  const videoKey = (el) => {
    const src = usableMediaSrc(el) || '';
    if (/^https?:/i.test(src)) { try { const u = new URL(src); return u.origin + u.pathname; } catch { return src.slice(0, 200); } }
    // blob: ключ ТОЛЬКО из внутренних свойств (duration/videoWidth) — clientWidth зависит от
    // раскладки и «плавает». Видео без метаданных отфильтровываются до вызова (см. вотчер).
    const d = Math.round((el.duration || 0) * 10);
    return 'blob:' + d + ':' + (el.videoWidth || 0) + 'x' + (el.videoHeight || 0);
  };
  const flowStorageGet = (k) => new Promise((res) => { try { chrome.storage.local.get(k, (d) => res(d && d[k])); } catch { res(undefined); } });
  const flowStorageSet = (k, v) => new Promise((res) => { try { chrome.storage.local.set({ [k]: v }, () => res()); } catch { res(); } });
  async function flowProjectWatcher() {
    if (flowWatcherBusy || flowTaskBusy) return;
    const pid = flowProjectId();
    if (!pid) return;
    flowWatcherBusy = true;
    try {
      const gen = flowGeneratingCount();
      if (gen > 0) { sawGeneratingAt = Date.now(); void flowStorageSet('flowGenAt:' + pid, sawGeneratingAt); }
      else if (!sawGeneratingAt) {
        // после перезагрузки страницы окно «недавно генерилось» восстанавливаем из storage
        const saved = await flowStorageGet('flowGenAt:' + pid);
        if (typeof saved === 'number') sawGeneratingAt = saved;
      }
      // индикатор на карточке проекта в Галерее (сброс в 0 гасит спиннер)
      send({ type: 'flow-observed', projectId: pid, title: (document.title || 'Flow').slice(0, 80), generating: gen });
      // blob-видео БЕЗ метаданных пропускаем до следующего тика (ключ был бы нестабильным —
      // NaN-duration/0-размер → старые клипы «оживали» бы как новые после перезагрузки).
      const vids = queryAllDeep('video').filter(visible).filter(usableMediaSrc)
        .filter((v) => !/^blob:/i.test(usableMediaSrc(v)) || (v.readyState >= 1 && Number.isFinite(v.duration) && v.videoWidth > 0));
      const key = 'flowSeen:' + pid;
      const seen = await flowStorageGet(key);
      const keys = vids.map(videoKey);
      if (!Array.isArray(seen)) {
        if (keys.length || gen > 0) await flowStorageSet(key, keys.slice(0, 300)); // пустой снимок до отрисовки не сохраняем
        return;
      }
      // fresh = нет в базлайне И ключ ещё не встречался в ЭТОМ цикле (у клипов Flow ключи часто
      // совпадают — одинаковая длительность/размер; иначе один клип залился бы 2× за цикл).
      const cycleSeen = new Set();
      const freshIdx = keys.map((k, i) => ((seen.includes(k) || cycleSeen.has(k)) ? -1 : (cycleSeen.add(k), i))).filter((i) => i >= 0);
      const recentlyGenerated = Date.now() - sawGeneratingAt < 6 * 60_000;
      if (freshIdx.length && recentlyGenerated) {
        // Появились НОВЫЕ клипы в окне «недавно генерилось» → сразу в Галерею → «Видео».
        // НЕ ждём gen===0: клип может стать готовым, пока СЛЕДУЮЩАЯ генерация ещё крутится —
        // раньше такой клип молча уходил в базлайн и автозаливка «не срабатывала» (баг по фидбэку).
        for (const i of freshIdx.slice(0, 2)) {
          const el = vids[i];
          const fails = flowIngestFails.get(keys[i]) || 0;
          if (fails >= 3) { seen.push(keys[i]); continue; } // 3 неудачи → сдаёмся (не качаем 500МБ каждые 25с)
          ui.line(T('flow_newClipReady', 'новый клип готов — заливаю в Галерею…'));
          const data = await grabMediaData(el);
          if (!data.dataUrl && !data.sourceUrl) { flowIngestFails.set(keys[i], fails + 1); continue; }
          const r = await send({ type: 'manual-ingest', payload: { ...data, title: (document.title || 'Flow').slice(0, 80) } });
          if (r && r.ok) { seen.push(keys[i]); ui.line(T('flow_clipInGallery', '✓ клип в Галерее → «Видео»')); }
          else { flowIngestFails.set(keys[i], fails + 1); ui.line(T('flow_clipNotSaved', '⚠ клип не сохранился: ') + ((r && r.error) || T('flow_noConnection', 'нет подключения'))); }
        }
      } else if (freshIdx.length) {
        // вне окна генерации (скролл/ленивая подгрузка старых) — просто запоминаем, НЕ заливаем
        for (const i of freshIdx) seen.push(keys[i]);
      }
      await flowStorageSet(key, seen.slice(-300));
    } catch { /* не мешаем работе юзера */ }
    finally { flowWatcherBusy = false; }
  }
  setInterval(() => { void flowProjectWatcher(); }, 25_000);
  setTimeout(() => { void flowProjectWatcher(); }, 5000);

  // ---------- старт ----------
  loadSelectorOverrides(); // оверрайды селекторов из storage (правка вживую без релиза)
  injectInterceptor();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ui.mount());
  else ui.mount();
  resumePendingInject(); // довести вставку, если Flow перезагрузился при открытии проекта
  log('content-flow готов');
})();
