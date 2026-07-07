/**
 * background.js — service-worker (MV3), координатор режима «оставь на ночь».
 *
 * Поток: SPA TrendTraffic передаёт JWT через content-bridge → сюда. Дальше SW
 * САМ периодически опрашивает бэкенд (`GET /api/flow-ext/tasks`), и для каждой
 * задачи: находит/открывает вкладку Google Flow → шлёт content-flow команду
 * `run-task` → ждёт готовое видео → заливает его обратно (`POST /api/flow-ext/ingest`).
 * Не зависит от открытой вкладки SPA — поэтому и работает «на ночь».
 *
 * MV3 SW засыпает — поэтому НИЧЕГО важного не держим только в памяти: токен и
 * состояние в chrome.storage.local, тайминг — на chrome.alarms. STATE ниже —
 * лишь кэш на время активности, восстанавливается из storage.
 *
 * Анти-бот пейсинг (обязателен при полной автоматизации): между задачами —
 * рандомная пауза PACE_MIN..PACE_MAX; при сигнале троттлинга от Flow —
 * длинная пауза THROTTLE_PAUSE. Иначе Flow быстро даёт «unusual activity».
 */

const POLL_ALARM = 'tt-flow-poll';
const POLL_PERIOD_MIN = 1;         // как часто спрашивать бэкенд про новые задачи
const PACE_MIN_MS = 25_000;        // мин. пауза между генерациями (человекоподобно)
const PACE_MAX_MS = 70_000;        // макс. пауза между генерациями
const THROTTLE_PAUSE_MS = 20 * 60_000; // пауза при «unusual activity»
const TASK_TIMEOUT_MS = 8 * 60_000;    // потолок ожидания одной генерации

const STATE = { token: null, apiBase: null, flowTabId: null, busy: false, pausedUntil: 0 };

// ---------- утилиты ----------
const jitter = (min, max) => Math.floor(min + Math.random() * (max - min));
const log = (...a) => console.log('[tt-flow bg]', ...a);

async function loadState() {
  const s = await chrome.storage.local.get(['token', 'apiBase', 'pausedUntil']);
  STATE.token = s.token || null;
  STATE.apiBase = s.apiBase || null;
  STATE.pausedUntil = s.pausedUntil || 0;
}
async function saveState() {
  await chrome.storage.local.set({
    token: STATE.token, apiBase: STATE.apiBase, pausedUntil: STATE.pausedUntil,
  });
}

function api(path) {
  const base = (STATE.apiBase || '').replace(/\/+$/, '');
  return `${base}${path}`;
}
function authHeaders(extra) {
  return { Authorization: `Bearer ${STATE.token}`, ...(extra || {}) };
}

// ---------- подключение / отключение ----------
async function connect(token, apiBase) {
  STATE.token = token;
  STATE.apiBase = apiBase;
  STATE.pausedUntil = 0;
  await saveState();
  await chrome.alarms.create(POLL_ALARM, { periodInMinutes: POLL_PERIOD_MIN });
  log('подключено к', apiBase);
  tick(); // не ждём первого будильника
}
async function disconnect() {
  STATE.token = null; STATE.apiBase = null;
  await saveState();
  await chrome.alarms.clear(POLL_ALARM);
  log('отключено');
}

// ---------- вкладка Flow ----------
async function ensureFlowTab() {
  // Переиспользуем уже открытую вкладку Flow, если есть.
  const tabs = await chrome.tabs.query({ url: 'https://labs.google/fx/tools/flow*' });
  if (tabs.length) { STATE.flowTabId = tabs[0].id; return tabs[0].id; }
  const tab = await chrome.tabs.create({ url: 'https://labs.google/fx/tools/flow', active: false });
  STATE.flowTabId = tab.id;
  // Ждём, пока content-flow просигналит готовность.
  await waitForFlowReady(tab.id);
  return tab.id;
}
function waitForFlowReady(tabId, timeoutMs = 40_000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const iv = setInterval(async () => {
      try {
        const r = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
        if (r && r.ready) { clearInterval(iv); resolve(true); return; }
      } catch { /* content ещё не поднялся */ }
      if (Date.now() - started > timeoutMs) { clearInterval(iv); resolve(false); }
    }, 1500);
  });
}

// ---------- главный цикл ----------
async function tick() {
  if (STATE.busy) return;
  if (!STATE.token || !STATE.apiBase) return;
  if (Date.now() < STATE.pausedUntil) { log('на паузе (троттлинг) ещё', Math.round((STATE.pausedUntil - Date.now()) / 1000), 'с'); return; }

  STATE.busy = true;
  try {
    const res = await fetch(api('/api/flow-ext/tasks?limit=1'), { headers: authHeaders() });
    if (res.status === 401) { log('токен протух — отключаюсь'); await disconnect(); return; }
    if (!res.ok) { log('tasks HTTP', res.status); return; }
    const data = await res.json().catch(() => ({}));
    const task = (data.tasks || [])[0];
    if (!task) return; // очередь пуста — ждём следующего будильника

    await runOneTask(task);

    // Человекоподобная пауза перед тем, как забрать следующую задачу.
    const pause = jitter(PACE_MIN_MS, PACE_MAX_MS);
    log('пауза перед следующей задачей', Math.round(pause / 1000), 'с');
    await new Promise((r) => setTimeout(r, pause));
  } catch (e) {
    log('ошибка цикла:', e && e.message);
  } finally {
    STATE.busy = false;
  }
}

async function runOneTask(task) {
  await reportStatus(task.id, 'running');
  const tabId = await ensureFlowTab();
  if (!tabId) { await reportStatus(task.id, 'failed', 'не удалось открыть Flow'); return; }

  let result;
  try {
    result = await withTimeout(
      chrome.tabs.sendMessage(tabId, { type: 'run-task', task }),
      TASK_TIMEOUT_MS,
    );
  } catch (e) {
    await reportStatus(task.id, 'failed', String(e && e.message || e));
    return;
  }

  if (result && result.throttled) {
    STATE.pausedUntil = Date.now() + THROTTLE_PAUSE_MS;
    await saveState();
    await reportStatus(task.id, 'retry', 'Flow: unusual activity — пауза');
    return;
  }
  if (!result || !result.ok) {
    await reportStatus(task.id, 'failed', (result && result.reason) || 'нет результата');
    return;
  }

  // Забираем видео (content отдал blob-URL или прямую CDN-ссылку) и заливаем в сервис.
  try {
    await ingestResult(task, result);
    await reportStatus(task.id, 'done');
  } catch (e) {
    await reportStatus(task.id, 'failed', 'ingest: ' + (e && e.message));
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('таймаут задачи')), ms)),
  ]);
}

// ---------- заливка результата обратно в TrendTraffic ----------
async function ingestResult(task, result) {
  // content-flow кладёт видео в result.blobUrl (blob: внутри вкладки Flow нам недоступен
  // из SW), поэтому сам контент присылает уже как dataUrl ЛИБО как sourceUrl (CDN).
  const body = {
    taskId: task.id,
    prompt: task.prompt,
    sourceUrl: result.sourceUrl || null,   // прямая ссылка Flow/CDN (бэкенд стянет сам)
    dataUrl: result.dataUrl || null,       // base64 (если контент сумел прочитать blob)
    meta: result.meta || {},
  };
  const res = await fetch(api('/api/flow-ext/ingest'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `HTTP ${res.status}`);
  }
}

async function reportStatus(taskId, status, note) {
  try {
    await fetch(api('/api/flow-ext/status'), {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ taskId, status, note: note || null }),
    });
  } catch { /* статус — best-effort */ }
}

// ---------- двусторонняя связь Flow ↔ Галерея (кнопки в панели Flow) ----------
/** Ручная заливка видео из Flow в Галерею (кнопка «В галерею»). */
async function manualIngest(payload) {
  if (!STATE.token || !STATE.apiBase) return { ok: false, error: 'не подключено' };
  try {
    const res = await fetch(api('/api/flow-ext/ingest-manual'), {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ sourceUrl: payload.sourceUrl || null, dataUrl: payload.dataUrl || null, title: payload.title || 'Flow', kind: payload.kind || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: d.error || ('HTTP ' + res.status) };
    return { ok: true, fileUrl: d.fileUrl, assetId: d.assetId };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
/** Список видео Галереи для кнопки «Из Галереи». */
async function galleryList() {
  if (!STATE.token || !STATE.apiBase) return { ok: false, error: 'не подключено' };
  try {
    const res = await fetch(api('/api/flow-ext/gallery'), { headers: authHeaders() });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: d.error || ('HTTP ' + res.status) };
    return { ok: true, items: Array.isArray(d.items) ? d.items : [] };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
/** Скачать байты видео в КОНТЕКСТЕ РАСШИРЕНИЯ (обход CORS страницы Flow) → dataURL.
 *  В service worker нет FileReader — кодируем arrayBuffer→base64 чанками через btoa. */
async function fetchBytes(url) {
  if (!url) return { ok: false, error: 'нет url' };
  if (url.startsWith('/') && STATE.apiBase) url = STATE.apiBase.replace(/\/+$/, '') + url; // относительный → абсолютный
  try {
    // Пробуем С cookie (CDN за Google-сессией) и БЕЗ (подписанные URL, которые куки отвергают).
    const tryFetch = async (opts) => { try { const r = await fetch(url, opts); return r.ok ? r : null; } catch { return null; } };
    const res = (await tryFetch({ credentials: 'include' })) || (await tryFetch({}));
    if (!res) return { ok: false, error: 'скачивание не удалось (CDN отклонил запрос)' };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 64 * 1024 * 1024) return { ok: false, error: 'видео >64МБ — велико для заливки в Flow' };
    const bytes = new Uint8Array(buf);
    let binary = ''; const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    const mime = res.headers.get('content-type') || 'video/mp4';
    return { ok: true, dataUrl: `data:${mime};base64,${btoa(binary)}`, mime, size: buf.byteLength };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
/** Снимок разведки вёрстки Flow → бэкенд (авто-recon). */
async function sendRecon(payload) {
  if (!STATE.token || !STATE.apiBase) return { ok: false, error: 'не подключено' };
  try {
    const res = await fetch(api('/api/flow-ext/recon'), {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ data: payload.data || {}, url: payload.url || null }),
    });
    return { ok: res.ok };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

// ---------- разведка эндпоинтов (от injected через content-flow) ----------
async function saveRecon(entry) {
  const { recon = [] } = await chrome.storage.local.get('recon');
  recon.push({ ...entry, at: Date.now() });
  // держим последние 200 записей
  await chrome.storage.local.set({ recon: recon.slice(-200) });
}

// ---------- сообщения ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case 'tt-connect':
        await connect(msg.token, msg.apiBase);
        sendResponse({ ok: true });
        break;
      case 'tt-disconnect':
        await disconnect();
        sendResponse({ ok: true });
        break;
      case 'tt-status':
        await loadState();
        sendResponse({
          connected: !!(STATE.token && STATE.apiBase),
          apiBase: STATE.apiBase,
          pausedUntil: STATE.pausedUntil,
        });
        break;
      case 'api-recon':
        await saveRecon(msg.data);
        sendResponse({ ok: true });
        break;
      case 'bearer':
        // Токен сессии Flow — понадобится, если перейдём на прямые API-вызовы.
        await chrome.storage.local.set({ flowBearer: msg.token, flowBearerAt: Date.now() });
        sendResponse({ ok: true });
        break;
      case 'flow-throttled':
        STATE.pausedUntil = Date.now() + THROTTLE_PAUSE_MS;
        await saveState();
        sendResponse({ ok: true });
        break;
      case 'manual-ingest':
        sendResponse(await manualIngest(msg.payload || {}));
        break;
      case 'gallery-list':
        sendResponse(await galleryList());
        break;
      case 'fetch-bytes':
        sendResponse(await fetchBytes(msg.url));
        break;
      case 'send-recon':
        sendResponse(await sendRecon(msg.payload || {}));
        break;
      default:
        sendResponse({ ok: false, error: 'unknown message' });
    }
  })();
  return true; // ответ асинхронный
});

chrome.alarms.onAlarm.addListener((a) => { if (a.name === POLL_ALARM) tick(); });
chrome.runtime.onStartup.addListener(() => loadState());
chrome.runtime.onInstalled.addListener(() => loadState());
loadState();
