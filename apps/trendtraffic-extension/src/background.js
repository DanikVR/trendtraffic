/**
 * background.js — единый service-worker (MV3) расширения TrendTraffic для Google.
 * Обслуживает СРАЗУ два сервиса одним входом (JWT из content-bridge):
 *
 *   • Google Flow  (labs.google/fx/tools/flow)  — очередь промптов «оставь на ночь»,
 *     авто-генерация Veo, обмен видео/картинками с Галереей. Ветка ниже — БАЙТ-в-БАЙТ
 *     как в отдельном flow-extension (её трогать нельзя: работает в проде).
 *
 *   • Google NotebookLM (notebooklm.google.com, блок «Hotebook») — источники/чат/
 *     удаление (синхронные действия, юзер ждёт) + генерация артефактов (аудио/видео/
 *     отчёты/тесты…). Синхронные действия и генерации приходят одним long-poll
 *     `GET /api/notebooklm-ext/poll`, выполняются во вкладке NotebookLM, результат
 *     уходит в `POST /action-result` или `POST /ingest` (артефакт → Галерея 'hotebook').
 *
 * MV3 SW засыпает — ничего важного не держим только в памяти: токен в
 * chrome.storage.local, тайминг — на chrome.alarms. STATE — кэш на время активности.
 */

const POLL_ALARM = 'tt-poll';
const POLL_PERIOD_MIN = 1;          // как часто будильник пере-запускает циклы

// ── Flow (не менять — прод) ───────────────────────────────────────────────────
const PACE_MIN_MS = 25_000;         // мин. пауза между генерациями Flow (человекоподобно)
const PACE_MAX_MS = 70_000;         // макс. пауза между генерациями Flow
const THROTTLE_PAUSE_MS = 20 * 60_000; // пауза при «unusual activity» Flow
const TASK_TIMEOUT_MS = 8 * 60_000;    // потолок ожидания одной генерации Flow

// ── NotebookLM ────────────────────────────────────────────────────────────────
const NLM_TASK_TIMEOUT_MS = 12 * 60_000; // потолок ожидания одной генерации артефакта
const NLM_CREATE_WAIT_MS = 45_000;       // ожидание появления /notebook/<uuid> после «создать»

// ── HeyGen (рендер говорящих голов по подписке; вкладка app.heygen.com) ─────────
const HG_PACE_MIN_MS = 8_000;            // мин. пауза между головами
const HG_PACE_MAX_MS = 20_000;           // макс. пауза между головами
const HG_TASK_TIMEOUT_MS = 25 * 60_000;  // генерация головы + скачивание

const STATE = {
  token: null, apiBase: null,
  flowTabId: null, busyFlow: false, pausedUntil: 0,
  nlmLooping: false, nlmLoggedIn: false, nlmBusy: false, // nlmBusy: идёт генерация артефакта (вкладка занята)
  nlmAccount: null, // email аккаунта Google, под которым сейчас открыт NotebookLM (для плашки «переподключить»)
  nlmTabId: null,   // id вкладки NotebookLM, где юзер РЕАЛЬНО работает (активная+залогинена) — все операции туда, чтобы не уехать в другой Google-аккаунт при мультиаккаунте
  hgBusy: false,
};

// ---------- утилиты ----------
const jitter = (min, max) => Math.floor(min + Math.random() * (max - min));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[tt-ext bg]', ...a);

async function loadState() {
  const s = await chrome.storage.local.get(['token', 'apiBase', 'pausedUntil', 'nlmAccount']);
  STATE.token = s.token || null;
  STATE.apiBase = s.apiBase || null;
  STATE.pausedUntil = s.pausedUntil || 0;
  STATE.nlmAccount = s.nlmAccount || null;
}
async function saveState() {
  await chrome.storage.local.set({ token: STATE.token, apiBase: STATE.apiBase, pausedUntil: STATE.pausedUntil, nlmAccount: STATE.nlmAccount });
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

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('таймаут задачи')), ms))]);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GOOGLE FLOW  (перенесено из flow-extension без изменений логики)
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureFlowTab(allowCreate = false) {
  const tabs = await chrome.tabs.query({ url: 'https://labs.google/fx/tools/flow*' });
  if (tabs.length) { STATE.flowTabId = tabs[0].id; return tabs[0].id; }
  // Авто-режим (опрос очереди): НЕ открываем Flow сами — иначе вкладка «выскакивает».
  if (!allowCreate) { STATE.flowTabId = null; return null; }
  const tab = await chrome.tabs.create({ url: 'https://labs.google/fx/tools/flow', active: false });
  STATE.flowTabId = tab.id;
  await waitForTabReady(tab.id);
  return tab.id;
}
function waitForTabReady(tabId, timeoutMs = 40_000) {
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

async function tickFlow() {
  if (STATE.busyFlow) return;
  if (!STATE.token || !STATE.apiBase) return;
  if (Date.now() < STATE.pausedUntil) return;

  STATE.busyFlow = true;
  try {
    const res = await fetch(api('/api/flow-ext/tasks?limit=1'), { headers: authHeaders() });
    if (res.status === 401) { log('токен протух — отключаюсь'); await disconnect(); return; }
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    const task = (data.tasks || [])[0];
    if (!task) return;
    await runFlowTask(task);
    const pause = jitter(PACE_MIN_MS, PACE_MAX_MS);
    log('Flow: пауза перед следующей задачей', Math.round(pause / 1000), 'с');
    await sleep(pause);
  } catch (e) {
    log('Flow: ошибка цикла:', e && e.message);
  } finally {
    STATE.busyFlow = false;
  }
}

async function runFlowTask(task) {
  const tabId = await ensureFlowTab(false);
  if (!tabId) { await flowStatus(task.id, 'retry', 'Откройте вкладку Google Flow — задача выполнится сама'); return; }
  await flowStatus(task.id, 'running');
  let result;
  try {
    result = await withTimeout(chrome.tabs.sendMessage(tabId, { type: 'run-task', task }), TASK_TIMEOUT_MS);
  } catch (e) {
    await flowStatus(task.id, 'failed', String(e && e.message || e));
    return;
  }
  if (result && result.throttled) {
    STATE.pausedUntil = Date.now() + THROTTLE_PAUSE_MS;
    await saveState();
    await flowStatus(task.id, 'retry', 'Flow: unusual activity — пауза');
    return;
  }
  if (!result || !result.ok) { await flowStatus(task.id, 'failed', (result && result.reason) || 'нет результата'); return; }
  try {
    await flowIngest(task, result);
    await flowStatus(task.id, 'done');
  } catch (e) {
    await flowStatus(task.id, 'failed', 'ingest: ' + (e && e.message));
  }
}

async function flowIngest(task, result) {
  const body = {
    taskId: task.id, prompt: task.prompt,
    sourceUrl: result.sourceUrl || null, dataUrl: result.dataUrl || null, meta: result.meta || {},
  };
  const res = await fetch(api('/api/flow-ext/ingest'), {
    method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
}

async function flowStatus(taskId, status, note) {
  try {
    await fetch(api('/api/flow-ext/status'), {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ taskId, status, note: note || null }),
    });
  } catch { /* статус — best-effort */ }
}

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
/** Список видео Галереи для кнопки «Из Галереи» (Flow). */
async function galleryList() {
  if (!STATE.token || !STATE.apiBase) return { ok: false, error: 'не подключено' };
  try {
    const res = await fetch(api('/api/flow-ext/gallery'), { headers: authHeaders() });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: d.error || ('HTTP ' + res.status) };
    return { ok: true, items: Array.isArray(d.items) ? d.items : [] };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
/** Снимок разведки вёрстки Flow → бэкенд. */
async function sendReconFlow(payload) {
  if (!STATE.token || !STATE.apiBase) return { ok: false, error: 'не подключено' };
  try {
    const res = await fetch(api('/api/flow-ext/recon'), {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ data: payload.data || {}, url: payload.url || null }),
    });
    return { ok: res.ok };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
/** Из Галереи TrendTraffic: открыть/сфокусировать вкладку Flow и залить туда медиа по URL. */
async function pushToFlow(url, title, kind) {
  const tabId = await ensureFlowTab(true);
  if (!tabId) return { ok: false, error: 'не удалось открыть Flow' };
  try {
    await chrome.tabs.update(tabId, { active: true });
    const t = await chrome.tabs.get(tabId);
    if (t && t.windowId != null) await chrome.windows.update(t.windowId, { focused: true });
  } catch { /* фокус — best-effort */ }
  try {
    const r = await chrome.tabs.sendMessage(tabId, { type: 'inject-url', url, title, kind });
    return r || { ok: true };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

/**
 * Живой список ГОТОВЫХ ПРОЕКТОВ Flow — для вкладки «Google Flow» в Галерее.
 * НЕ трогает очередь генераций (tickFlow/runFlowTask). Логика:
 *   1) если уже открыта вкладка на ГЛАВНОЙ Flow (без /project/) — снимаем с неё
 *      (не мешаем юзеру, если он внутри проекта);
 *   2) иначе — временная фоновая вкладка на главную: снять карточки и закрыть.
 * Клик по карточке в Галерее открывает проект «проектором» сам (window.open) — тут только список.
 */
async function listFlowProjects() {
  // 1) Существующая вкладка на главной Flow (URL без /project/).
  let grid = null;
  try {
    const tabs = await chrome.tabs.query({ url: ['https://labs.google/fx/tools/flow*', 'https://labs.google/fx/*/tools/flow*'] });
    grid = tabs.find((t) => t.url && !/\/project\//.test(t.url)) || null;
  } catch { /* query best-effort */ }
  if (grid && grid.id != null) {
    try {
      const r = await withTimeout(chrome.tabs.sendMessage(grid.id, { type: 'list-projects' }), 45_000);
      if (r && r.ok) return r;
    } catch { /* упадём во временную вкладку ниже */ }
  }
  // 2) Временная фоновая вкладка на главную Flow → снять и закрыть. Фоновая вкладка отрисовывает
  //    сетку Flow с задержкой (тяжёлый SPA + троттлинг фона), поэтому при пустом результате
  //    ждём и повторяем скрейп ещё раз (иначе «Проектов: 0», хотя проекты есть).
  let tab;
  try { tab = await chrome.tabs.create({ url: 'https://labs.google/fx/tools/flow', active: false }); }
  catch (e) { return { ok: false, error: 'не удалось открыть Flow: ' + (e && e.message || e) }; }
  const ready = await waitForTabReady(tab.id, 45_000);
  let r = null;
  if (!ready) r = { ok: false, error: 'Flow не загрузился — войдите в labs.google/flow' };
  else {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { r = await withTimeout(chrome.tabs.sendMessage(tab.id, { type: 'list-projects' }), 45_000); }
      catch (e) { r = { ok: false, error: String(e && e.message || e) }; }
      if (r && r.ok && Array.isArray(r.projects) && r.projects.length) break; // проекты получены
      if (attempt === 0) await sleep(4000); // сетка ещё не отрисовалась → подождём и повторим
    }
  }
  try { await chrome.tabs.remove(tab.id); } catch { /* закрытие best-effort */ }
  return r || { ok: false, error: 'нет ответа от Flow' };
}

/** Скачать байты медиа в КОНТЕКСТЕ РАСШИРЕНИЯ (обход CORS страницы) → dataURL.
 *  Общий помощник для Flow (референсы) и NotebookLM (файл-источник из Галереи). */
async function fetchBytes(url) {
  if (!url) return { ok: false, error: 'нет url' };
  if (url.startsWith('/') && STATE.apiBase) url = STATE.apiBase.replace(/\/+$/, '') + url;
  try {
    const tryFetch = async (opts) => { try { const r = await fetch(url, opts); return r.ok ? r : null; } catch { return null; } };
    const res = (await tryFetch({ credentials: 'include' })) || (await tryFetch({}));
    if (!res) return { ok: false, error: 'скачивание не удалось (CDN отклонил запрос)' };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 500 * 1024 * 1024) return { ok: false, error: 'медиа >500МБ — слишком большое' };
    const bytes = new Uint8Array(buf);
    let binary = ''; const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    const mime = res.headers.get('content-type') || 'application/octet-stream';
    return { ok: true, dataUrl: `data:${mime};base64,${btoa(binary)}`, mime, size: buf.byteLength };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

async function saveReconLocal(entry) {
  const { recon = [] } = await chrome.storage.local.get('recon');
  recon.push({ ...entry, at: Date.now() });
  await chrome.storage.local.set({ recon: recon.slice(-200) });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GOOGLE NOTEBOOKLM  (Hotebook)
// ═══════════════════════════════════════════════════════════════════════════════
// authuser вкладки НЕЛЬЗЯ терять при навигации: голый https://notebooklm.google.com/ уводит
// Chrome в аккаунт по умолчанию (authuser=0), а юзер может работать во втором Google (authuser=1).
function nlmUrl(path, fromUrl) {
  let au = null;
  try { au = new URL(fromUrl || '').searchParams.get('authuser'); } catch { /* */ }
  return 'https://notebooklm.google.com' + path + (au ? (path.includes('?') ? '&' : '?') + 'authuser=' + encodeURIComponent(au) : '');
}
async function findNotebookTab() {
  // 1) Закреплённая вкладка активного юзера (где он реально залогинен и работает) — приоритет,
  //    чтобы список блокнотов/генерация шли под ТЕМ аккаунтом, что перед глазами, а не под случайным.
  if (STATE.nlmTabId != null) {
    try {
      const t = await chrome.tabs.get(STATE.nlmTabId);
      if (t && /^https:\/\/notebooklm\.google\.com\//.test(t.url || '')) return t;
    } catch { STATE.nlmTabId = null; }
  }
  const tabs = await chrome.tabs.query({ url: 'https://notebooklm.google.com/*' });
  if (!tabs.length) return null;
  // 2) Активная вкладка NotebookLM (перед глазами) > любая фоновая.
  return tabs.find((t) => t.active) || tabs[0];
}
/** Найти/открыть вкладку NotebookLM и (если задан notebookId) навести её на нужный блокнот. */
async function ensureNotebookTab(notebookId, allowCreate = true) {
  let tab = await findNotebookTab();
  if (!tab) {
    if (!allowCreate) return null;
    const url = notebookId ? `https://notebooklm.google.com/notebook/${notebookId}` : 'https://notebooklm.google.com/';
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabReady(tab.id);
    return tab.id;
  }
  // Есть вкладка. Если нужен конкретный блокнот и мы не на нём — навести (сохраняя authuser).
  if (notebookId && !(tab.url || '').includes(`/notebook/${notebookId}`)) {
    await chrome.tabs.update(tab.id, { url: nlmUrl(`/notebook/${notebookId}`, tab.url) });
    await waitForTabReady(tab.id);
  } else {
    await waitForTabReady(tab.id, 20_000);
  }
  return tab.id;
}

// Ожидание follow-up сообщения от content (для действий, переживающих перезагрузку — «создать блокнот»).
const nlmWaiters = new Map(); // key `${type}:${id}` → { resolve, timer }
function waitForNlmEvent(type, id, ms) {
  return new Promise((resolve) => {
    const key = `${type}:${id}`;
    const timer = setTimeout(() => { nlmWaiters.delete(key); resolve(null); }, ms);
    nlmWaiters.set(key, { resolve, timer });
  });
}
function resolveNlmEvent(type, id, value) {
  const key = `${type}:${id}`;
  const w = nlmWaiters.get(key);
  if (w) { clearTimeout(w.timer); nlmWaiters.delete(key); w.resolve(value); }
}

/** Главный цикл NotebookLM: long-poll очереди (действие ИЛИ генерация) → выполнить → повторить. */
async function nlmLoop() {
  if (STATE.nlmLooping) return;
  if (!STATE.token || !STATE.apiBase) return;
  STATE.nlmLooping = true;
  try {
    while (STATE.token && STATE.apiBase) {
      let data;
      try {
        const nlmTab = await findNotebookTab();
        const q = new URLSearchParams({ wait: '20', loggedIn: STATE.nlmLoggedIn ? '1' : '0', open: nlmTab ? '1' : '0' });
        const res = await fetch(api('/api/notebooklm-ext/poll?' + q.toString()), { headers: authHeaders() });
        if (res.status === 401) { await disconnect(); break; }
        if (res.status === 403) { break; } // не Enterprise — тихо выходим
        if (!res.ok) { await sleep(3000); continue; }
        data = await res.json().catch(() => ({}));
      } catch { await sleep(3000); continue; }

      if (data && data.kind === 'action' && data.action) {
        await runNlmAction(data.action);
      } else if (data && data.kind === 'task' && data.task) {
        await runNlmTask(data.task);
      }
      // иначе: /poll уже подождал ~20с на сервере — крутим дальше без busy-spin
    }
  } catch (e) {
    log('NLM: ошибка цикла:', e && e.message);
  } finally {
    STATE.nlmLooping = false;
  }
}

async function nlmActionResult(actionId, ok, result, error) {
  try {
    await fetch(api('/api/notebooklm-ext/action-result'), {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ actionId, ok: !!ok, result: result || null, error: error || null }),
    });
  } catch { /* best-effort — фронт отвалится по таймауту long-poll */ }
}

/** Выполнить синхронное действие (create/open/add-source/list/delete/chat). */
async function runNlmAction(action) {
  // «Создать блокнот» — особый случай: клик «создать» уводит на /notebook/<uuid> (SPA или полный
  // reload), поэтому результат ждём отдельным событием от content (переживает перезагрузку).
  if (action.kind === 'create-notebook') {
    const tabId = await ensureNotebookTab(null, true);
    if (!tabId) { await nlmActionResult(action.id, false, null, 'не удалось открыть NotebookLM'); return; }
    await chrome.storage.local.set({ ttNlmPendingCreate: { actionId: action.id, title: action.payload?.title || '', at: Date.now() } });
    try { await chrome.tabs.sendMessage(tabId, { type: 'run-action', action }); } catch { /* мог перезагрузиться */ }
    const ev = await waitForNlmEvent('create-done', action.id, NLM_CREATE_WAIT_MS);
    await chrome.storage.local.remove('ttNlmPendingCreate');
    if (ev && ev.notebookId) await nlmActionResult(action.id, true, { notebookId: ev.notebookId, title: ev.title || action.payload?.title || null });
    else await nlmActionResult(action.id, false, null, 'блокнот не создался (нужна разведка селекторов «создать»)');
    return;
  }

  // «Список блокнотов» — плитки есть ТОЛЬКО на главной NotebookLM. Наводим вкладку на главную.
  if (action.kind === 'list-notebooks') {
    // ВАЖНО: во время генерации артефакта вкладка занята блокнотом. НЕ навигируем её на главную —
    // иначе прервём генерацию И вернём 0 блокнотов. Отвечаем «занят», фронт оставит прежний список.
    if (STATE.nlmBusy) { await nlmActionResult(action.id, false, null, 'busy-generating'); return; }
    const tabId = await ensureNotebookTab(null, true);
    if (!tabId) { await nlmActionResult(action.id, false, null, 'не удалось открыть NotebookLM'); return; }
    try {
      const t = await chrome.tabs.get(tabId);
      if (/\/notebook\//.test(t.url || '')) { await chrome.tabs.update(tabId, { url: nlmUrl('/', t.url) }); await waitForTabReady(tabId); }
    } catch { /* навигация best-effort */ }
    let result;
    try { result = await withTimeout(chrome.tabs.sendMessage(tabId, { type: 'run-action', action }), 60_000); }
    catch (e) { await nlmActionResult(action.id, false, null, String(e && e.message || e)); return; }
    if (result && result.ok) await nlmActionResult(action.id, true, result);
    else {
      if (result && result.reason === 'not-logged-in') { try { await chrome.tabs.update(tabId, { active: true }); } catch { /* */ } }
      await nlmActionResult(action.id, false, null, (result && result.reason) || 'не удалось получить список');
    }
    return;
  }

  // Прочие действия — в контексте уже открытого нужного блокнота (навигация — в ensureNotebookTab).
  const tabId = await ensureNotebookTab(action.notebookId || null, true);
  if (!tabId) { await nlmActionResult(action.id, false, null, 'не удалось открыть NotebookLM'); return; }
  let result;
  try {
    result = await withTimeout(chrome.tabs.sendMessage(tabId, { type: 'run-action', action }), 4 * 60_000);
  } catch (e) {
    await nlmActionResult(action.id, false, null, String(e && e.message || e));
    return;
  }
  if (result && result.ok) await nlmActionResult(action.id, true, result);
  else {
    // Не залогинен → сфокусировать вкладку, чтобы юзер вошёл.
    if (result && result.reason === 'not-logged-in') { try { await chrome.tabs.update(tabId, { active: true }); } catch { /* */ } }
    await nlmActionResult(action.id, false, null, (result && result.reason) || 'действие не выполнено');
  }
}

/** Выполнить генерацию артефакта (async-джоба) → ingest в Галерею. */
/**
 * Перехват загрузки, инициированной кликом «Скачать» на артефакте NotebookLM (аудио/видео —
 * у них нет <audio> для чтения src, плеер на MSE). Ловим URL в chrome.downloads, ОТМЕНЯЕМ
 * браузерную загрузку (чтобы не мусорить в «Загрузки») и сами стягиваем байты в фоне.
 */
function armDownloadCapture(timeoutMs) {
  let resolveFn; let done = false; let timer;
  const p = new Promise((res) => { resolveFn = res; });
  const finish = (val) => { if (done) return; done = true; clearTimeout(timer); try { chrome.downloads.onCreated.removeListener(listener); } catch { /* */ } resolveFn(val); };
  const listener = (item) => {
    if (done) return;
    const url = item.url || item.finalUrl || '';
    // Подписанный URL медиа NotebookLM без расширения/маски → берём ЛЮБУЮ http(s)-загрузку, что
    // стартовала пока перехватчик взведён (взводим строго вокруг генерации медиа = это наш артефакт).
    if (!url || !/^https?:/i.test(url)) return; // blob/data в фоне не стянуть
    try { chrome.downloads.cancel(item.id); } catch { /* */ }
    try { chrome.downloads.erase({ id: item.id }); } catch { /* */ }
    finish({ url, mime: item.mime || '' });
  };
  chrome.downloads.onCreated.addListener(listener);
  timer = setTimeout(() => finish(null), timeoutMs);
  p.cancel = () => finish(null);
  return p;
}

// nlmBusy на всё время генерации: пока идёт — list-notebooks не навигирует вкладку (не рвёт генерацию).
async function runNlmTask(task) {
  STATE.nlmBusy = true;
  try { await _runNlmTask(task); }
  finally { STATE.nlmBusy = false; }
}
async function _runNlmTask(task) {
  const tabId = await ensureNotebookTab(task.notebookId || null, true);
  if (!tabId) { await nlmTaskStatus(task.id, 'retry', 'Откройте NotebookLM — генерация выполнится сама'); return; }
  await nlmTaskStatus(task.id, 'running');
  // Аудио/видео качаются через меню «Скачать» → ставим перехватчик ДО генерации.
  const isMedia = (task.type === 'audio' || task.type === 'video');
  const dl = isMedia ? armDownloadCapture(NLM_TASK_TIMEOUT_MS) : null;
  const action = { kind: 'generate', gtype: task.type, params: task.params || {}, notebookId: task.notebookId };
  const runOnce = () => withTimeout(chrome.tabs.sendMessage(tabId, { type: 'run-action', action }), NLM_TASK_TIMEOUT_MS);
  let result;
  try {
    result = await runOnce();
  } catch (e) {
    const msg = String((e && e.message) || e);
    // «Receiving end does not exist» = контент-скрипт ещё не поднялся (вкладка навигировалась).
    // Ждём готовности вкладки и повторяем ОДИН раз — иначе генерация зря падала на гонке загрузки.
    if (/Receiving end does not exist|Could not establish connection/i.test(msg)) {
      await waitForTabReady(tabId, 30_000);
      try { result = await runOnce(); }
      catch (e2) { if (dl) dl.cancel(); await nlmTaskStatus(task.id, 'failed', String((e2 && e2.message) || e2)); return; }
    } else {
      if (dl) dl.cancel();
      await nlmTaskStatus(task.id, 'failed', msg);
      return;
    }
  }
  if (result && result.reason === 'not-logged-in') { if (dl) dl.cancel(); await nlmTaskStatus(task.id, 'retry', 'Войдите в NotebookLM'); return; }
  if (!result || !result.ok) { if (dl) dl.cancel(); await nlmTaskStatus(task.id, 'failed', (result && result.reason) || 'нет результата'); return; }
  // Захват через загрузку (аудио/видео): дождаться перехваченного URL и стянуть байты в фоне.
  if (result.viaDownload) {
    const got = dl ? await dl : null;
    if (!got || !got.url) { await nlmTaskStatus(task.id, 'failed', 'не удалось перехватить скачивание артефакта'); return; }
    const b = await fetchBytes(got.url);
    if (!b || !b.ok) { await nlmTaskStatus(task.id, 'failed', 'не скачался артефакт: ' + (b && b.error || '')); return; }
    result.dataUrl = b.dataUrl;
    result.mime = result.mime || b.mime || got.mime || '';
  } else if (dl) { dl.cancel(); }
  try {
    await nlmIngest(task, result);
  } catch (e) {
    await nlmTaskStatus(task.id, 'failed', 'ingest: ' + (e && e.message));
  }
}

async function nlmTaskStatus(taskId, status, note) {
  try {
    await fetch(api('/api/notebooklm-ext/status'), {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ taskId, status, note: note || null }),
    });
  } catch { /* best-effort */ }
}

async function nlmIngest(task, result) {
  const body = {
    taskId: task.id,
    dataUrl: result.dataUrl || null,       // мелкие артефакты (base64)
    sourceUrl: result.sourceUrl || null,   // прямая CDN-ссылка (бэкенд стянет сам)
    fileName: result.fileName || null,     // подсказка расширения (.mp3/.mp4/.pdf…)
    mime: result.mime || null,
    payload: result.payload != null ? result.payload : null, // json/csv для вьюверов панели
  };
  const res = await fetch(api('/api/notebooklm-ext/ingest'), {
    method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
}

/** Снимок разведки вёрстки NotebookLM → бэкенд. */
async function sendReconNlm(payload) {
  if (!STATE.token || !STATE.apiBase) return { ok: false, error: 'не подключено' };
  try {
    const res = await fetch(api('/api/notebooklm-ext/recon'), {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ data: payload.data || {}, url: payload.url || null }),
    });
    return { ok: res.ok };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

// ==================== HeyGen (третий сервис) ====================
// Рендер «говорящих голов» по подписке клиента: очередь /api/heygen-ext → вкладка app.heygen.com →
// content-heygen делает генерацию под сессией → mp4 обратно. Независимо от Flow/NotebookLM.
async function hgFindTab() {
  const tabs = await chrome.tabs.query({ url: 'https://app.heygen.com/*' });
  return tabs.length ? tabs[0].id : null;
}
function hgWaitReady(tabId, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const iv = setInterval(async () => {
      try { const r = await chrome.tabs.sendMessage(tabId, { type: 'ping' }); if (r && r.ready) { clearInterval(iv); resolve(true); return; } }
      catch { /* content ещё не поднялся */ }
      if (Date.now() - started > timeoutMs) { clearInterval(iv); resolve(false); }
    }, 1200);
  });
}
async function heygenStatus(taskId, status, note) {
  try {
    await fetch(api('/api/heygen-ext/status'), {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ taskId, status, note: note || null }),
    });
  } catch { /* best-effort */ }
}
async function heygenIngest(task, result) {
  const res = await fetch(api('/api/heygen-ext/ingest'), {
    method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ taskId: task.id, sourceUrl: result.sourceUrl || null, dataUrl: result.dataUrl || null }),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
}
async function runHeygenTask(task) {
  const tabId = await hgFindTab();
  if (!tabId) { await heygenStatus(task.id, 'retry', 'Откройте вкладку студии app.heygen.com — голова отрендерится сама'); return; }
  const ready = await hgWaitReady(tabId);
  if (!ready) { await heygenStatus(task.id, 'retry', 'Студия HeyGen ещё грузится — повторю позже'); return; }
  await heygenStatus(task.id, 'running');
  let result;
  try { result = await withTimeout(chrome.tabs.sendMessage(tabId, { type: 'render-head', task }), HG_TASK_TIMEOUT_MS); }
  catch (e) { await heygenStatus(task.id, 'failed', String(e && e.message || e)); return; }
  if (result && result.retry) { await heygenStatus(task.id, 'retry', result.reason || 'повтор'); return; }
  if (!result || !result.ok) { await heygenStatus(task.id, 'failed', (result && result.reason) || 'нет результата'); return; }
  try { await heygenIngest(task, result); await heygenStatus(task.id, 'done'); }
  catch (e) { await heygenStatus(task.id, 'failed', 'ingest: ' + (e && e.message)); }
}
async function tickHeygen() {
  if (STATE.hgBusy || !STATE.token || !STATE.apiBase) return;
  STATE.hgBusy = true;
  try {
    const res = await fetch(api('/api/heygen-ext/tasks?limit=1'), { headers: authHeaders() });
    if (res.status === 401) { log('HeyGen: токен протух'); await disconnect(); return; }
    if (!res.ok) { log('HeyGen tasks HTTP', res.status); return; }
    const data = await res.json().catch(() => ({}));
    const task = (data.tasks || [])[0];
    if (!task) return;
    await runHeygenTask(task);
    await sleep(jitter(HG_PACE_MIN_MS, HG_PACE_MAX_MS));
  } catch (e) { log('HeyGen ошибка цикла:', e && e.message); }
  finally { STATE.hgBusy = false; }
}
async function sendReconHeygen(payload) {
  if (!STATE.token || !STATE.apiBase) return { ok: false, error: 'не подключено' };
  try {
    const res = await fetch(api('/api/heygen-ext/recon'), {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ data: payload.data || {}, url: payload.url || null }),
    });
    return { ok: res.ok };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

// ---------- главный цикл ----------
function tick() {
  if (!STATE.token || !STATE.apiBase) return;
  void tickFlow();    // Flow: одна задача за тик + пейсинг
  void nlmLoop();     // NotebookLM: свой long-poll цикл (no-op, если уже крутится)
  void tickHeygen();  // HeyGen: одна голова за тик + пейсинг
}

// ---------- сообщения ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      // — общие / мост —
      case 'tt-connect': await connect(msg.token, msg.apiBase); sendResponse({ ok: true }); break;
      case 'tt-disconnect': await disconnect(); sendResponse({ ok: true }); break;
      case 'tt-status':
        await loadState();
        sendResponse({ connected: !!(STATE.token && STATE.apiBase), apiBase: STATE.apiBase, pausedUntil: STATE.pausedUntil, nlmAccount: STATE.nlmAccount });
        break;
      case 'fetch-bytes': sendResponse(await fetchBytes(msg.url)); break;

      // — Flow —
      case 'api-recon': await saveReconLocal(msg.data); sendResponse({ ok: true }); break;
      case 'bearer': await chrome.storage.local.set({ flowBearer: msg.token, flowBearerAt: Date.now() }); sendResponse({ ok: true }); break;
      case 'flow-throttled': STATE.pausedUntil = Date.now() + THROTTLE_PAUSE_MS; await saveState(); sendResponse({ ok: true }); break;
      case 'manual-ingest': sendResponse(await manualIngest(msg.payload || {})); break;
      case 'gallery-list': sendResponse(await galleryList()); break;
      case 'send-recon': sendResponse(await sendReconFlow(msg.payload || {})); break;
      case 'push-to-flow': sendResponse(await pushToFlow(msg.url, msg.title, msg.kind)); break;
      case 'list-flow-projects': sendResponse(await listFlowProjects()); break;

      // — NotebookLM —
      case 'nlm-status':
        sendResponse({ connected: !!(STATE.token && STATE.apiBase), loggedIn: STATE.nlmLoggedIn, apiBase: STATE.apiBase });
        break;
      case 'nlm-presence':
        STATE.nlmLoggedIn = !!msg.loggedIn;
        // Закрепляем рабочую вкладку: активная (перед глазами) залогиненная вкладка — источник истины.
        // Все операции (список блокнотов, генерация) пойдут ИМЕННО на неё → не уедем в другой Google.
        if (msg.loggedIn && sender && sender.tab && sender.tab.id != null) {
          if (msg.active || STATE.nlmTabId == null) STATE.nlmTabId = sender.tab.id;
          // Аккаунт активной вкладки — приоритетный (её видит юзер); фоновой — только если ещё пусто.
          if (msg.account && (msg.active || !STATE.nlmAccount) && msg.account !== STATE.nlmAccount) { STATE.nlmAccount = msg.account; void saveState(); }
        } else if (msg.account && msg.account !== STATE.nlmAccount) {
          STATE.nlmAccount = msg.account; void saveState();
        }
        if (STATE.token && !STATE.nlmLooping) void nlmLoop(); // юзер открыл NotebookLM → сразу крутим
        sendResponse({ ok: true });
        break;
      case 'nlm-create-done':
        resolveNlmEvent('create-done', msg.actionId, { notebookId: msg.notebookId, title: msg.title });
        sendResponse({ ok: true });
        break;
      case 'nlm-send-recon': sendResponse(await sendReconNlm(msg.payload || {})); break;

      // — HeyGen —
      case 'hg-bearer': await chrome.storage.local.set({ heygenBearer: msg.token, heygenBearerAt: Date.now() }); sendResponse({ ok: true }); break;
      case 'hg-send-recon': sendResponse(await sendReconHeygen(msg.payload || {})); break;

      default: sendResponse({ ok: false, error: 'unknown message' });
    }
  })();
  return true; // ответ асинхронный
});

chrome.alarms.onAlarm.addListener((a) => { if (a.name === POLL_ALARM) tick(); });
chrome.runtime.onStartup.addListener(() => loadState().then(tick));
chrome.runtime.onInstalled.addListener((details) => {
  loadState().then(tick);
  // После УСТАНОВКИ/ОБНОВЛЕНИЯ переинжектим свежие content-scripts в уже открытые вкладки
  // приложения: иначе там до ручного F5 крутится СТАРЫЙ content-bridge (без новых кнопок —
  // напр. «Переподключить» молчит). NotebookLM/Flow НЕ трогаем — там reload может оборвать
  // идущую генерацию; их скрипты обновятся при следующем открытии.
  if (details && (details.reason === 'update' || details.reason === 'install')) {
    const appUrls = ['https://app.trendtraffic.pro/*', 'http://localhost/*', 'http://127.0.0.1/*'];
    try {
      chrome.tabs.query({ url: appUrls }, (tabs) => {
        for (const t of (tabs || [])) { try { chrome.tabs.reload(t.id, { bypassCache: false }); } catch { /* */ } }
      });
    } catch { /* tabs может быть недоступен — не критично */ }
  }
});
loadState().then(tick);
