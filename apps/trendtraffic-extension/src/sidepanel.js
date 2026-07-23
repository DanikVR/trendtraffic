/**
 * sidepanel.js — «пульт» пакетного движка Flow Booster. Работает БЕЗ входа в TrendTraffic:
 * промпты → генерация в живом Flow (через content-flow) → авто-скачивание на диск. Отправка
 * результатов в Галерею TrendFlow — опциональна (только если расширение подключено к аккаунту).
 *
 * Модель submit/collect: панель ЗАПУСКАЕТ генерации (flow-submit) и по одной СОБИРАЕТ (flow-collect),
 * поэтому умеет держать НЕСКОЛЬКО генераций Flow в полёте одновременно (Parallel N). Атрибуция
 * готовых тайлов к промптам — FIFO (в content-flow через batchClaimed). Прогресс приходит
 * широковещательным flow-batch-progress (слушатель ниже).
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const bg = (m) => { try { return chrome.runtime.sendMessage(m); } catch { return Promise.resolve(null); } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = (key, fallback) => { try { const m = chrome.i18n.getMessage(key); return m || fallback; } catch { return fallback; } };
  const jitter = (base) => Math.max(6000, Math.round((base || 30) * 1000 * (0.75 + Math.random() * 0.6)));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ---------- элементы ----------
  const els = {};
  ['ver', 'ttLink', 'ttDot', 'ttState', 'openFlow', 'flowChip', 'mode', 'model', 'aspect', 'count',
   'resolution', 'length', 'refBox', 'refInput', 'refs', 'charMode', 'useMention', 'chain', 'prompts',
   'promptCount', 'folder', 'prefix', 'autoDl', 'hiRes', 'ttSend', 'ttSendWrap', 'ttSignin', 'pace',
   'concurrency', 'start', 'pause', 'stop', 'clear', 'queue', 'log', 'clearLog'].forEach((id) => (els[id] = $(id)));

  let characters = [];       // [{id, name, dataUrl}] — референс-персонажи (в памяти)
  let queue = [];            // [{id, prompt, status, note, pct}]
  let running = false, paused = false, stopFlag = false;
  let ttConnected = false;
  let lastChainImage = null; // dataURL последнего img-результата (для «Chain»)

  const SETTINGS_KEYS = ['mode', 'model', 'aspect', 'count', 'resolution', 'length', 'folder', 'prefix', 'pace', 'concurrency', 'charMode'];
  const FLAG_KEYS = ['autoDl', 'hiRes', 'ttSend', 'chain', 'useMention'];

  // ---------- persistence ----------
  function saveSettings() {
    const s = {};
    for (const k of SETTINGS_KEYS) if (els[k]) s[k] = els[k].value;
    for (const k of FLAG_KEYS) if (els[k]) s[k] = els[k].checked;
    s.promptsText = els.prompts.value;
    try { chrome.storage.local.set({ flowBooster: s }); } catch { /* */ }
  }
  function loadSettings() {
    try {
      chrome.storage.local.get('flowBooster', (d) => {
        const s = (d && d.flowBooster) || {};
        for (const k of SETTINGS_KEYS) if (s[k] != null && els[k]) els[k].value = s[k];
        for (const k of FLAG_KEYS) if (s[k] != null && els[k]) els[k].checked = !!s[k];
        if (s.promptsText != null) els.prompts.value = s.promptsText;
        updatePromptCount(); syncModeUI();
      });
    } catch { /* */ }
  }

  // ---------- helpers ----------
  const log = (t) => {
    const ts = new Date().toLocaleTimeString();
    els.log.textContent = `${ts}  ${t}\n` + els.log.textContent;
    els.log.textContent = els.log.textContent.split('\n').slice(0, 120).join('\n');
  };
  const parsePrompts = () => els.prompts.value.split('\n').map((s) => s.trim()).filter(Boolean);
  const updatePromptCount = () => { els.promptCount.textContent = String(parsePrompts().length); };
  const isImageMode = () => ['imageToVideo', 'components', 'imageToImage'].includes(els.mode.value);
  const syncModeUI = () => { els.refBox.hidden = !isImageMode(); };

  // ---------- персонажи (референсы) ----------
  const fileToDataUrl = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(file); });
  const baseName = (n) => String(n || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 24);
  async function addCharacters(files) {
    for (const f of files) {
      if (!/^image\//.test(f.type)) continue;
      if (characters.length >= 10) break;
      try { characters.push({ id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6), name: baseName(f.name) || ('Character ' + (characters.length + 1)), dataUrl: await fileToDataUrl(f) }); } catch { /* */ }
    }
    renderCharacters();
  }
  function renderCharacters() {
    els.refs.innerHTML = '';
    characters.forEach((c) => {
      const row = document.createElement('div'); row.className = 'charrow';
      const img = document.createElement('img'); img.src = c.dataUrl; row.appendChild(img);
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = c.name; inp.placeholder = 'name (used in prompts)';
      inp.addEventListener('input', () => { c.name = inp.value; });
      row.appendChild(inp);
      const x = document.createElement('span'); x.className = 'x'; x.textContent = '×';
      x.onclick = () => { characters = characters.filter((k) => k.id !== c.id); renderCharacters(); };
      row.appendChild(x); els.refs.appendChild(row);
    });
  }
  // Какие персонажи прикрепить к промпту: все, либо только те, чьё ИМЯ встречается в тексте (auto-scan).
  function resolveCharacters(prompt) {
    if (!characters.length) return [];
    if (els.charMode.value === 'all') return characters.slice();
    const p = prompt || '';
    return characters.filter((c) => {
      if (!c.name) return false;
      try { return new RegExp('(^|[^\\p{L}])' + escapeRegex(c.name) + '([^\\p{L}]|$)', 'iu').test(p); }
      catch { return p.toLowerCase().includes(c.name.toLowerCase()); }
    });
  }

  // ---------- статусы (Flow tab + TrendFlow) ----------
  async function refreshFlowStatus() {
    const r = await bg({ type: 'flow-status' });
    const chip = els.flowChip;
    if (!r || !r.present) { chip.className = 'chip off'; chip.textContent = T('fb_noFlowTab', 'no Flow tab'); return; }
    if (!r.ready) { chip.className = 'chip wait'; chip.textContent = T('fb_flowLoading', 'Flow loading…'); return; }
    chip.className = 'chip on';
    chip.textContent = r.inProject ? T('fb_flowInProject', 'Flow · in project') : T('fb_flowReady', 'Flow ready');
  }
  async function refreshTtStatus() {
    const r = await bg({ type: 'tt-status' });
    ttConnected = !!(r && r.connected);
    els.ttDot.className = 'tt-dot' + (ttConnected ? ' on' : '');
    els.ttState.textContent = ttConnected ? T('fb_ttConnected', 'TrendFlow ✓') : 'TrendFlow';
    els.ttSignin.hidden = ttConnected;
    if (!ttConnected && els.ttSend.checked) els.ttSend.checked = false;
    els.ttSend.disabled = !ttConnected;
  }

  // ---------- очередь (рендер) ----------
  function renderQueue() {
    els.queue.innerHTML = '';
    for (const it of queue) {
      const box = document.createElement('div'); box.className = 'qi ' + it.status;
      const top = document.createElement('div'); top.className = 'top';
      const st = document.createElement('span'); st.className = 'st';
      const txt = document.createElement('div'); txt.className = 'txt'; txt.textContent = it.prompt;
      const meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = it.note || it.status;
      top.append(st, txt, meta); box.appendChild(top);
      if (it.status === 'running') {
        const prog = document.createElement('div'); prog.className = 'prog';
        const i = document.createElement('i'); i.style.width = (it.pct || 0) + '%'; prog.appendChild(i);
        box.appendChild(prog);
      }
      els.queue.appendChild(box);
    }
  }

  // ---------- скачивание + отправка результата ----------
  async function handleResults(prompt, results) {
    let idx = 0;
    for (const r of results) {
      const kind = r.kind || 'video';
      if (els.autoDl.checked && !r.native) {
        const spec = { folder: els.folder.value.trim(), prefix: els.prefix.value.trim(), name: prompt, index: idx, kind, sourceUrl: r.sourceUrl, dataUrl: r.dataUrl };
        const dl = await bg({ type: 'flow-download', spec });
        if (dl && dl.ok) log('💾 ' + dl.filename); else log('⚠ download: ' + ((dl && dl.error) || 'failed'));
      } else if (r.native) { log('💾 saved via Flow menu (hi-res)'); }
      if (els.ttSend.checked && ttConnected) {
        const ing = await bg({ type: 'manual-ingest', payload: { sourceUrl: r.sourceUrl, dataUrl: r.dataUrl, kind, title: prompt.slice(0, 80) } });
        if (ing && ing.ok) log('⬆ TrendFlow Gallery ✓'); else log('⚠ TrendFlow: ' + ((ing && ing.error) || 'failed'));
      }
      if (els.chain.checked && kind === 'image' && r.dataUrl) lastChainImage = r.dataUrl;
      idx++;
    }
  }

  function handleThrottle() {
    log('⏸ Flow throttling — pausing 20 min');
    paused = true; els.pause.textContent = '▶ Resume';
    setTimeout(() => { paused = false; els.pause.textContent = '⏸ Pause'; }, 20 * 60_000);
  }

  // ---------- главный цикл: пул параллельных генераций ----------
  async function runQueue() {
    let fs = await bg({ type: 'flow-status' });
    if (!fs || !fs.present) { log(T('fb_openingFlow', 'opening Google Flow…')); await bg({ type: 'flow-open' }); await sleep(1500); }
    await bg({ type: 'flow-reset' });

    let conc = clamp(Number(els.concurrency.value) || 1, 1, 4);
    if (els.chain.checked) conc = 1; // «chain» требует последовательности (результат → референс следующего)
    const hiRes = () => els.hiRes.checked && !!els.resolution.value;
    const inFlight = []; // [{item, submitId}]
    let qi = 0;
    const nextQueued = () => { while (qi < queue.length && queue[qi].status !== 'queued') qi++; return qi < queue.length ? queue[qi] : null; };

    while (!stopFlag) {
      // 1) наполнить пул до conc
      while (inFlight.length < conc && !paused && !stopFlag) {
        const item = nextQueued();
        if (!item) break;
        item.status = 'running'; item.note = 'submit…'; item.pct = 0; renderQueue();
        const refs = [];
        if (isImageMode()) {
          if (els.chain.checked && lastChainImage) refs.push({ name: 'previous', dataUrl: lastChainImage });
          refs.push(...resolveCharacters(item.prompt));
        }
        const payload = {
          id: item.id, prompt: item.prompt, title: item.prompt.slice(0, 60),
          mode: els.mode.value, model: els.model.value, aspectRatio: els.aspect.value,
          outputCount: Number(els.count.value) || 1, resolution: els.resolution.value,
          videoLength: els.length.value ? Number(els.length.value) : null,
          characters: refs.map((c) => ({ name: c.name, dataUrl: c.dataUrl })), useMention: els.useMention.checked,
        };
        if (hiRes() && els.autoDl.checked) await bg({ type: 'flow-arm-rename', spec: { folder: els.folder.value.trim(), prefix: els.prefix.value.trim(), name: item.prompt, kind: (els.mode.value === 'imageToImage' || els.mode.value === 'textToImage') ? 'image' : 'video' } });
        qi++;
        let sub;
        try { sub = await bg({ type: 'flow-submit', item: payload }); } catch (e) { sub = { ok: false, reason: String(e && e.message || e) }; }
        if (hiRes() && els.autoDl.checked) await bg({ type: 'flow-disarm-rename' });
        if (sub && sub.throttled) { item.status = 'queued'; item.note = 'throttled'; qi--; renderQueue(); handleThrottle(); break; }
        if (!sub || !sub.ok) {
          item.status = 'failed'; item.note = (sub && sub.reason) || 'submit failed'; renderQueue();
          log('✕ submit: ' + item.note);
          if (item.note === 'no-flow-tab' || item.note === 'flow-not-ready') { log(T('fb_pressOpenFlow', 'press "Open Google Flow" and sign in')); stopFlag = true; }
          continue;
        }
        inFlight.push({ item, submitId: sub.submitId });
        // человекоподобный интервал между запусками (в параллели короче, чем полный «delay»)
        const stagger = conc > 1 ? jitter(Math.min(12, Number(els.pace.value) || 8)) : 0;
        if (stagger) await sleep(stagger);
      }

      if (!inFlight.length && !nextQueued()) break; // всё сделано
      if (!inFlight.length) { await sleep(500); continue; } // на паузе, ждём

      // 2) собрать готовые тайлы — СТРОГО в порядке запуска (FIFO-атрибуция тайлов к промптам)
      const still = [];
      let throttledNow = false;
      for (const f of inFlight) {
        if (stopFlag || throttledNow) { still.push(f); continue; }
        let r;
        try { r = await bg({ type: 'flow-collect', payload: { submitId: f.submitId, itemId: f.item.id, autoDownload: els.autoDl.checked, viaNativeMenu: hiRes(), resolution: els.resolution.value } }); }
        catch (e) { r = { ok: false, reason: String(e && e.message || e) }; }
        if (r && r.throttled) { handleThrottle(); throttledNow = true; still.push(f); continue; }
        if (!r || !r.ok) { f.item.status = 'failed'; f.item.note = (r && r.reason) || 'collect failed'; renderQueue(); continue; } // выбывает
        if (r.done) {
          const n = (r.results || []).length;
          f.item.status = n ? 'done' : 'failed';
          f.item.note = n ? ('✓ ' + n + (r.timeout ? ' (timeout)' : '')) : (r.timeout ? 'timeout' : 'no result');
          renderQueue();
          await handleResults(f.item.prompt, r.results || []);
          // «delay между промптами» — только последовательно (в параллели интервал задаёт стаггер запусков)
          if (conc === 1 && nextQueued()) { const d = jitter(Number(els.pace.value) || 30); log(`⏳ pacing ${Math.round(d / 1000)}s…`); await sleep(d); }
        } else { still.push(f); } // ещё генерится — оставляем в полёте
      }
      inFlight.length = 0; inFlight.push(...still);
      if (stopFlag) break;
      await sleep(4000); // цикл опроса готовности
    }
    finishRun();
  }

  function startRun() {
    const prompts = parsePrompts();
    if (!prompts.length) { log(T('fb_addPrompts', 'add at least one prompt')); return; }
    queue = prompts.map((p, i) => ({ id: 'q' + Date.now() + '_' + i, prompt: p, status: 'queued', note: '', pct: 0 }));
    lastChainImage = null;
    running = true; paused = false; stopFlag = false;
    els.start.disabled = true; els.pause.disabled = false; els.stop.disabled = false; els.pause.textContent = '⏸ Pause';
    renderQueue();
    log(`▶ batch started — ${prompts.length} prompts, parallel ${clamp(Number(els.concurrency.value) || 1, 1, 4)}`);
    runQueue();
  }
  function finishRun() {
    running = false; paused = false; stopFlag = false;
    els.start.disabled = false; els.pause.disabled = true; els.stop.disabled = true; els.pause.textContent = '⏸ Pause';
    for (const q of queue) if (q.status === 'running') { q.status = 'failed'; q.note = 'stopped'; }
    renderQueue();
    const done = queue.filter((q) => q.status === 'done').length;
    const failed = queue.filter((q) => q.status === 'failed').length;
    log(`■ finished — ${done} done, ${failed} failed`);
  }
  function togglePause() { if (!running) return; paused = !paused; els.pause.textContent = paused ? '▶ Resume' : '⏸ Pause'; log(paused ? '⏸ paused' : '▶ resumed'); }
  function stopRun() { if (!running) return; stopFlag = true; paused = false; log('■ stopping after current…'); }
  function clearAll() { if (running) return; queue = []; renderQueue(); els.prompts.value = ''; updatePromptCount(); saveSettings(); }

  // ---------- прогресс от content-flow ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'flow-batch-progress') return;
    const it = queue.find((q) => q.id === msg.itemId);
    if (!it) return;
    if (msg.total) it.pct = Math.min(100, Math.round((msg.ready / msg.total) * 100));
    it.note = msg.note || msg.phase || it.note;
    renderQueue();
  });

  // ---------- события UI ----------
  function wire() {
    els.ver.textContent = 'v' + chrome.runtime.getManifest().version;
    els.openFlow.onclick = async () => { els.openFlow.disabled = true; log(T('fb_openingFlow', 'opening Google Flow…')); await bg({ type: 'flow-open' }); setTimeout(() => { els.openFlow.disabled = false; refreshFlowStatus(); }, 1500); };
    els.prompts.addEventListener('input', () => { updatePromptCount(); saveSettings(); });
    els.mode.addEventListener('change', () => { syncModeUI(); saveSettings(); });
    for (const k of SETTINGS_KEYS) if (els[k]) els[k].addEventListener('change', saveSettings);
    for (const k of FLAG_KEYS) if (els[k]) els[k].addEventListener('change', saveSettings);
    els.refInput.addEventListener('change', (e) => { addCharacters([...e.target.files]); e.target.value = ''; });
    els.start.onclick = startRun;
    els.pause.onclick = togglePause;
    els.stop.onclick = stopRun;
    els.clear.onclick = clearAll;
    els.clearLog.onclick = () => { els.log.textContent = ''; };
  }

  // ---------- старт ----------
  wire();
  loadSettings();
  refreshFlowStatus(); refreshTtStatus();
  setInterval(refreshFlowStatus, 4000);
  setInterval(refreshTtStatus, 6000);
})();
