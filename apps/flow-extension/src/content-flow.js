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
  };
  const RESULT_POLL_MS = 4000;
  const RESULT_MAX_MS = 7 * 60_000;

  const log = (...a) => console.log('[tt-flow]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (m) => { try { return chrome.runtime.sendMessage(m); } catch { return Promise.resolve(); } };

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
    else if (d.kind === 'api') { send({ type: 'api-recon', data: d }); ui.recon(d); }
  });

  // ---------- 2. панель (Shadow DOM) ----------
  const ui = (() => {
    let root, els = {}, reconCount = 0;
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
            border-bottom:1px solid #2A303B;cursor:pointer}
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
          .mini{font-size:10px;color:#6B7280;text-align:center}
          .hide{display:none}
        </style>
        <div class="card">
          <div class="hd" id="hd">
            <span class="logo"></span><span class="ttl">TrendTraffic → Flow</span>
            <span class="sub" id="ver"></span>
          </div>
          <div class="bd" id="bd">
            <div class="row"><span>Состояние</span><span class="pill off" id="st">не подключено</span></div>
            <div class="task" id="task">Ожидаю задачи из TrendTraffic…</div>
            <div class="lg" id="lg"></div>
            <div class="btns">
              <button id="pause">Пауза</button>
              <button class="pri" id="open">Открыть TrendTraffic</button>
            </div>
            <div class="mini" id="reconc">разведка: 0 запросов Flow</div>
          </div>
        </div>`;
      document.documentElement.appendChild(host);
      els = {
        st: sh.getElementById('st'), task: sh.getElementById('task'), lg: sh.getElementById('lg'),
        ver: sh.getElementById('ver'), pause: sh.getElementById('pause'),
        open: sh.getElementById('open'), bd: sh.getElementById('bd'),
        hd: sh.getElementById('hd'), reconc: sh.getElementById('reconc'),
      };
      els.ver.textContent = 'v' + chrome.runtime.getManifest().version;
      els.hd.addEventListener('click', () => els.bd.classList.toggle('hide'));
      els.open.addEventListener('click', () => window.open('https://app.trendtraffic.pro', '_blank'));
      els.pause.addEventListener('click', () => send({ type: 'flow-throttled' }).then(() => line('Пауза включена вручную')));
      refreshStatus();
      setInterval(refreshStatus, 5000);
      root = sh;
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
      if (r.connected && Date.now() < (r.pausedUntil || 0)) status('wait', 'пауза');
      else if (r.connected) status('on', 'подключено');
      else status('off', 'не подключено');
    }
    return { mount, line, status, task, recon };
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

    // Референсы/кадры/формат — следующий этап (нужен живой DOM Flow для их полей).
    if (task.references && task.references.length) ui.line(`референсов ${task.references.length} — загрузка на следующем этапе`);

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
