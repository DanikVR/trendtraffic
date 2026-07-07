/**
 * content-heygen.js — работает на https://app.heygen.com (изолированный мир расширения).
 * Три роли:
 *   1) Инжектит injected.js (MAIN-world перехват fetch/XHR студии) и релеит его разведданные
 *      + session-Bearer в background.
 *   2) Рисует панель поверх студии (Shadow DOM): статус, текущая голова, лог, разведка.
 *   3) По команде background `render-head` генерит говорящую голову ПОД СЕССИЕЙ клиента
 *      (= его подписка): загрузка фото → talking_photo → v2/video/generate (Avatar IV/III на
 *      наше аудио) → poll video_status → скачивает mp4 → отдаёт назад.
 *
 * ПОЧЕМУ прямые вызовы API, а не клики по студии: студия HeyGen сама общается с api.heygen.com
 * этими же эндпоинтами. Из контекста страницы (Origin app.heygen.com, её cookies + session-Bearer)
 * те же вызовы проходят CORS и авторизацию, но списывают ПОДПИСКУ (не API-кошелёк). Это стабильнее
 * DOM-кликов (не зависит от вёрстки). Точные эндпоинты подтверждает разведка (injected.js) — если
 * студия сменит API, правим CONFIG ниже по свежему снимку /api/heygen-ext/recon.
 *
 * ВАЖНО (проверяется живым прогоном на аккаунте клиента): что генерация под сессией реально
 * списывает подписку, а не требует API-ключ. Первый прогон + разведка это подтверждают.
 */
(() => {
  'use strict';
  if (window.__ttHeygenContent) return;
  window.__ttHeygenContent = true;

  // ── Эндпоинты HeyGen (первая ставка = документированный v2 API; правим по разведке) ──
  const CONFIG = {
    UPLOAD_TALKING_PHOTO: 'https://upload.heygen.com/v1/talking_photo',
    GENERATE: 'https://api.heygen.com/v2/video/generate',
    STATUS: 'https://api.heygen.com/v1/video_status.get',
    POLL_MS: 5000,
    POLL_MAX_MS: 22 * 60_000,
  };

  const log = (...a) => console.log('[tt-heygen]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (m) => { try { return chrome.runtime.sendMessage(m); } catch { return Promise.resolve(); } };
  const reconApis = [];

  // ---------- 1. инжект MAIN-world перехватчика ----------
  function injectInterceptor() {
    try {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('src/injected-heygen.js');
      s.onload = () => s.remove();
      (document.head || document.documentElement).appendChild(s);
    } catch (e) { log('инжект injected.js не удался', e); }
  }
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.source !== 'tt-heygen-injected') return;
    if (d.kind === 'bearer') send({ type: 'hg-bearer', token: d.token });
    else if (d.kind === 'api') {
      reconApis.push({ url: String(d.url || '').slice(0, 160), method: d.method, status: d.status });
      if (reconApis.length > 60) reconApis.shift();
      send({ type: 'api-recon', data: d }); ui.recon();
    }
  });

  // ---------- session-Bearer (перехвачен injected → storage) ----------
  async function getBearer() {
    try {
      const s = await chrome.storage.local.get(['heygenBearer', 'heygenBearerAt']);
      // токен живёт недолго — старше 30 мин не используем (студия к тому времени обновила)
      if (s.heygenBearer && Date.now() - (s.heygenBearerAt || 0) < 30 * 60_000) return s.heygenBearer;
    } catch { /* */ }
    return null;
  }
  async function hgHeaders(extra) {
    const b = await getBearer();
    return { ...(b ? { Authorization: b } : {}), ...(extra || {}) };
  }

  // ---------- 2. панель (Shadow DOM) ----------
  const ui = (() => {
    let root, els = {}, reconCount = 0, reconSent = false;
    function mount() {
      const host = document.createElement('div');
      host.id = 'tt-heygen-host';
      host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;';
      const sh = host.attachShadow({ mode: 'open' });
      sh.innerHTML = `
        <style>
          *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif}
          .card{width:290px;background:#14181F;color:#EAECEF;border:1px solid #2A303B;
            border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.45);overflow:hidden}
          .hd{display:flex;align-items:center;gap:8px;padding:11px 13px;background:#1B2029;
            border-bottom:1px solid #2A303B;cursor:move;user-select:none;touch-action:none}
          .logo{width:9px;height:9px;border-radius:50%;background:#22D3A6;box-shadow:0 0 8px #22D3A6}
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
          button:hover{background:#2A303B} button.pri{background:#0E9E77;border-color:#0E9E77}
          button.pri:hover{background:#0c8a68}
          .wire{position:relative;height:3px;border-radius:3px;background:#242B37;overflow:hidden}
          .wire::before{content:'';position:absolute;top:0;left:-45%;width:45%;height:100%;
            background:linear-gradient(90deg,transparent,#22D3A6,transparent);opacity:0}
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
            <span class="logo"></span><span class="ttl">TrendTraffic → HeyGen</span>
            <span class="sub" id="ver"></span>
          </div>
          <div class="bd" id="bd">
            <div class="row"><span>Состояние</span><span class="pill off" id="st">не подключено</span></div>
            <div class="wire" id="wire"></div>
            <div class="task" id="task">Держите эту вкладку открытой — головы отрендерятся сами по вашей подписке.</div>
            <div class="lg" id="lg"></div>
            <div class="btns">
              <button class="pri" id="open">Открыть TrendTraffic</button>
            </div>
            <div class="foot">
              <span class="mini" id="reconc" style="font-size:10px;color:#6B7280">разведка: 0 вызовов студии</span>
              <button class="rec" id="recBtn" title="Снять текущее API студии и прислать нам (для подстройки)">разведка API</button>
            </div>
          </div>
        </div>`;
      document.documentElement.appendChild(host);
      els = {
        st: sh.getElementById('st'), task: sh.getElementById('task'), lg: sh.getElementById('lg'),
        ver: sh.getElementById('ver'), open: sh.getElementById('open'), bd: sh.getElementById('bd'),
        hd: sh.getElementById('hd'), reconc: sh.getElementById('reconc'), wire: sh.getElementById('wire'),
      };
      els.ver.textContent = 'v' + chrome.runtime.getManifest().version;
      makeDraggable(host, els.hd, () => els.bd.classList.toggle('hide'));
      els.open.addEventListener('click', () => window.open('https://app.trendtraffic.pro/flow', '_blank'));
      sh.getElementById('recBtn').addEventListener('click', () => runRecon(false));
      refreshStatus();
      setInterval(refreshStatus, 5000);
      root = sh;
    }
    function savePanelPos(left, top) { try { chrome.storage.local.set({ hgPanelPos: { left, top } }); } catch { /* */ } }
    function makeDraggable(host, handle, onTap) {
      try {
        chrome.storage.local.get('hgPanelPos', (d) => {
          const p = d && d.hgPanelPos;
          if (!p || typeof p.left !== 'number' || typeof p.top !== 'number') return;
          const w = host.offsetWidth || 290, h = host.offsetHeight || 120;
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
    function recon() { reconCount++; if (els.reconc) els.reconc.textContent = `разведка: ${reconCount} вызовов студии`; }
    async function refreshStatus() {
      const r = await send({ type: 'tt-status' });
      if (!r) return;
      if (r.connected) status('on', 'работает'); else status('off', 'войдите в аккаунт');
      if (els.st) {
        const off = !r.connected;
        els.st.style.cursor = off ? 'pointer' : 'default';
        els.st.style.textDecoration = off ? 'underline' : 'none';
        els.st.title = off ? 'Открыть TrendTraffic и войти — подключится само' : '';
        els.st.onclick = off ? () => window.open('https://app.trendtraffic.pro/flow', '_blank') : null;
      }
      if (els.wire) els.wire.classList.toggle('on', !!r.connected);
      if (r.connected && !reconSent) { reconSent = true; setTimeout(() => runRecon(true), 2000); }
    }
    return { mount, line, status, task, recon };
  })();

  // ---------- 3. драйвер рендера головы (прямые вызовы под сессией) ----------
  function dataUrlToBlob(dataUrl) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
    const mime = m ? m[1] : 'application/octet-stream';
    const bin = atob(m ? m[2] : '');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /** Загрузить фото как talking_photo → talking_photo_id (под сессией). */
  async function uploadTalkingPhoto(photoUrl) {
    const b = await send({ type: 'fetch-bytes', url: photoUrl });
    if (!b || !b.ok || !b.dataUrl) throw new Error('фото не скачалось' + (b && b.error ? ': ' + b.error : ''));
    const blob = dataUrlToBlob(b.dataUrl);
    const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
    const res = await fetch(CONFIG.UPLOAD_TALKING_PHOTO, {
      method: 'POST', credentials: 'include',
      headers: await hgHeaders({ 'Content-Type': mime }), body: blob,
    });
    const d = await res.json().catch(() => ({}));
    const id = d && d.data && d.data.talking_photo_id;
    if (!id) throw new Error(`upload talking_photo: ${(d && (d.message || (d.error && d.error.message))) || 'HTTP ' + res.status}`);
    return id;
  }

  /** Поставить генерацию говорящей головы → video_id (Avatar IV/III на наше аудио). */
  async function submitGenerate(task, talkingPhotoId) {
    const character = { type: 'talking_photo', talking_photo_id: talkingPhotoId };
    if (task.expressive !== false) { character.talking_style = 'expressive'; character.expression = 'default'; }
    const voice = { type: 'audio', audio_url: task.audioUrl };
    const videoInput = { character, voice };
    if (task.bgColor) videoInput.background = { type: 'color', value: task.bgColor };
    const body = {
      video_inputs: [videoInput],
      dimension: { width: task.width || 1080, height: task.height || 1920 },
    };
    if (task.useIV !== false) body.use_avatar_iv_model = true;
    const res = await fetch(CONFIG.GENERATE, {
      method: 'POST', credentials: 'include',
      headers: await hgHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    const vid = d && d.data && d.data.video_id;
    if (!vid) throw new Error(`generate: ${(d && (d.error && d.error.message || d.message)) || 'HTTP ' + res.status}`);
    return vid;
  }

  /** Дождаться готовности → video_url. */
  async function pollStatus(videoId) {
    const started = Date.now();
    while (Date.now() - started < CONFIG.POLL_MAX_MS) {
      const res = await fetch(`${CONFIG.STATUS}?video_id=${encodeURIComponent(videoId)}`, {
        credentials: 'include', headers: await hgHeaders(),
      });
      const d = await res.json().catch(() => ({}));
      const x = (d && d.data) || {};
      if (x.status === 'completed' && x.video_url) return x.video_url;
      if (x.status === 'failed' || x.status === 'error') {
        throw new Error(x.error ? (x.error.message || JSON.stringify(x.error)) : 'HeyGen: рендер не удался');
      }
      ui.task(`генерация: ${x.status || 'ждём'}…`);
      await sleep(CONFIG.POLL_MS);
    }
    throw new Error('HeyGen не отдал видео вовремя');
  }

  /** Скачать готовый mp4 → dataUrl (или отдать прямую ссылку, если большое). */
  async function grabResult(videoUrl) {
    // 1) пробуем из страницы (её сессия/CORS), 2) через background (extension). Иначе — sourceUrl.
    try {
      const r = await fetch(videoUrl, { credentials: 'include' });
      if (r.ok) {
        const blob = await r.blob();
        if (blob.size > 1024 && blob.size < 200 * 1024 * 1024) {
          const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(blob); });
          return { dataUrl };
        }
      }
    } catch { /* → фолбэк */ }
    const b = await send({ type: 'fetch-bytes', url: videoUrl });
    if (b && b.ok && b.dataUrl) return { dataUrl: b.dataUrl };
    return { sourceUrl: videoUrl };
  }

  async function renderHead(task) {
    ui.task('▶ голова #' + (task.id || '').slice(0, 6) + (task.useIV !== false ? ' · Avatar IV' : ' · Avatar III'));
    ui.line('фото → talking_photo…');
    let tpId;
    try { tpId = await uploadTalkingPhoto(task.photoUrl); }
    catch (e) { ui.line('⚠ ' + (e && e.message)); return { ok: false, reason: String(e && e.message || e) }; }
    ui.line('запускаю генерацию (' + (task.useIV !== false ? 'IV' : 'III') + ')…');
    let videoId;
    try { videoId = await submitGenerate(task, tpId); }
    catch (e) { ui.line('⚠ ' + (e && e.message)); return { ok: false, reason: String(e && e.message || e) }; }
    let videoUrl;
    try { videoUrl = await pollStatus(videoId); }
    catch (e) { ui.line('⚠ ' + (e && e.message)); return { ok: false, reason: String(e && e.message || e) }; }
    ui.line('✓ голова готова, забираю mp4…');
    const out = await grabResult(videoUrl);
    ui.line('✓ отправляю в TrendTraffic');
    return { ok: true, ...out };
  }

  // ---------- разведка API студии ----------
  function collectRecon() {
    return { url: location.href, ts: Date.now(), endpoints: reconApis.slice(-40) };
  }
  async function runRecon(silent) {
    const r = await send({ type: 'hg-send-recon', payload: { data: collectRecon(), url: location.href } });
    if (!silent) ui.line(r && r.ok ? '✓ разведка API отправлена' : ('⚠ разведка: ' + ((r && r.error) || 'нет подключения')));
  }

  // ---------- команды от background ----------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'ping') { sendResponse({ ready: true }); return; }
    if (msg.type === 'render-head') {
      renderHead(msg.task).then(sendResponse).catch((e) => sendResponse({ ok: false, reason: String(e && e.message || e) }));
      return true; // async
    }
  });

  // ---------- старт ----------
  injectInterceptor();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ui.mount());
  else ui.mount();
  log('content-heygen готов');
})();
