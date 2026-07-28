/**
 * sidepanel.js — «пульт» пакетного движка Flow Booster. Работает БЕЗ входа в TrendTraffic:
 * промпты → генерация в живом Flow (через content-flow) → авто-скачивание на диск. Отправка
 * результатов в Галерею TrendFlow — опциональна (только если расширение подключено к аккаунту).
 *
 * Модель submit/collect: панель ЗАПУСКАЕТ генерации (flow-submit) и по одной СОБИРАЕТ (flow-collect),
 * поэтому умеет держать НЕСКОЛЬКО генераций Flow в полёте одновременно (Parallel N). Атрибуция
 * готовых тайлов к промптам — FIFO (в content-flow через batchClaimed). Прогресс приходит
 * широковещательным flow-batch-progress (слушатель ниже).
 *
 * i18n: ВСЕ видимые тексты — T('fb_*', 'русский фолбэк'); статичную вёрстку локализует applyI18n().
 * Ключи харвестит apps/frontend/scripts/translate-ext-runtime.mjs (sidepanel.js в SRC_FILES),
 * фолбэки ОБЯЗАНЫ быть русскими — они источник локали ru при полном регене переводов.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const bg = (m) => { try { return chrome.runtime.sendMessage(m); } catch { return Promise.resolve(null); } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = (key, fallback) => { try { const m = chrome.i18n.getMessage(key); return m || fallback; } catch { return fallback; } };
  const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? String(vars[k]) : '{' + k + '}'));
  const jitter = (base) => Math.max(6000, Math.round((base || 30) * 1000 * (0.75 + Math.random() * 0.6)));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ---------- элементы ----------
  const els = {};
  ['ver', 'ttLink', 'ttDot', 'ttState', 'openFlow', 'flowChip', 'mode', 'model', 'aspect', 'count',
   'resolution', 'length', 'refBox', 'refInput', 'refs', 'charMode', 'useMention', 'chain', 'prompts',
   'promptCount', 'folder', 'prefix', 'autoDl', 'hiRes', 'ttSend', 'ttSendWrap', 'ttSignin', 'pace',
   'concurrency', 'start', 'pause', 'stop', 'clear', 'queue', 'log', 'clearLog',
   'scenario', 'scenPlan', 'scenToggle', 'scenBody', 'scenInfo'].forEach((id) => (els[id] = $(id)));

  // Часто используемые подписи (кнопка «Пауза» переключается в 5 местах).
  const LBL_PAUSE = T('fb_pause', '⏸ Пауза');
  const LBL_RESUME = T('fb_resume', '▶ Продолжить');
  // Подписи статусов очереди (сами значения статусов не переводим — это ещё и css-классы).
  const ST_LBL = {
    queued: T('fb_stQueued', 'в очереди'),
    running: T('fb_stRunning', 'генерится'),
    done: T('fb_stDone', 'готово'),
    failed: T('fb_stFailed', 'ошибка'),
  };

  let characters = [];       // [{id, name, dataUrl}] — референс-персонажи (в памяти)
  let queue = [];            // [{id, prompt, status, note, pct}]
  let running = false, paused = false, stopFlag = false;
  let ttConnected = false;
  let lastChainImage = null; // dataURL последнего img-результата (для «Chain»)
  let throttleTimer = null;  // один таймер паузы по троттлингу (не плодим)
  let renameArmed = false;   // взведено ли переименование родных hi-res загрузок на весь пакет

  const SETTINGS_KEYS = ['mode', 'model', 'aspect', 'count', 'resolution', 'length', 'folder', 'prefix', 'pace', 'concurrency', 'charMode'];
  const FLAG_KEYS = ['autoDl', 'hiRes', 'ttSend', 'chain', 'useMention'];

  // ---------- локализация статичной вёрстки ----------
  function applyI18n() {
    const setTxt = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
    const setOpt = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
    setTxt('openFlow', T('fb_openFlow', 'Открыть Google Flow'));
    setTxt('lMode', T('fb_mode', 'Режим'));
    setTxt('lModel', T('fb_model', 'Модель'));
    setTxt('lAspect', T('fb_aspect', 'Формат'));
    setTxt('lCount', T('fb_perPrompt', 'На промпт'));
    setTxt('lResolution', T('fb_resolution', 'Разрешение'));
    setTxt('lLength', T('fb_lengthS', 'Длина (сек)'));
    setOpt('#mode option[value="textToVideo"]', T('fb_modeT2V', 'Текст → Видео'));
    setOpt('#mode option[value="imageToVideo"]', T('fb_modeI2V', 'Картинка → Видео'));
    setOpt('#mode option[value="components"]', T('fb_modeIngr', 'Ингредиенты → Видео'));
    setOpt('#mode option[value="textToImage"]', T('fb_modeT2I', 'Текст → Картинка'));
    setOpt('#mode option[value="imageToImage"]', T('fb_modeI2I', 'Картинка → Картинка'));
    setOpt('#model option[value=""]', T('fb_modelAuto', 'Авто (как выбрано в Flow)'));
    setOpt('#resolution option[value=""]', T('fb_resPreview', 'Превью (как показывает Flow)'));
    setOpt('#length option[value=""]', T('fb_lenAuto', 'Авто'));
    setTxt('lChars', T('fb_characters', 'Персонажи'));
    setTxt('lCharsEm', T('fb_consistency', '(консистентность)'));
    setTxt('lAddRef', T('fb_addRef', '+ добавить'));
    setTxt('lAttach', T('fb_attachTo', 'Прикреплять к промптам'));
    setOpt('#charMode option[value="mentioned"]', T('fb_charMentioned', 'Только персонажей, названных в промпте'));
    setOpt('#charMode option[value="all"]', T('fb_charAll', 'Всех персонажей, к каждому промпту'));
    setTxt('lUseMention', T('fb_useMention', 'Через @упоминание Flow (иначе — загрузка референсом)'));
    setTxt('lChain', T('fb_chain', 'Цепочка: последний результат — референс следующего (последовательно)'));
    setTxt('lPrompts', T('fb_prompts', 'Промпты'));
    setTxt('lPromptsEm', T('fb_onePerLine', '(один на строку)'));
    setTxt('lQueued', T('fb_queued', 'в очереди'));
    els.prompts.placeholder = T('fb_promptsPh', 'Неоновая улица ночью, кинематографично…\nКот сёрфит на гигантской волне, слоу-мо…\n…');
    setTxt('lFolder', T('fb_folder', 'Папка'));
    setTxt('lPrefix', T('fb_prefix', 'Префикс имени'));
    setTxt('lAutoDl', T('fb_autoDl', 'Авто-скачивание результатов на диск'));
    setTxt('lHiRes', T('fb_hiRes', 'Hi-res через меню Flow (честные 2K/4K, медленнее)'));
    setTxt('lTtSend', T('fb_ttSend', 'Также отправлять в Галерею TrendFlow'));
    setTxt('ttSignin', T('fb_signIn', '(войти)'));
    setTxt('lDelay', T('fb_delayS', 'Пауза (сек)'));
    setTxt('lParallel', T('fb_parallel', 'Параллель'));
    setTxt('start', T('fb_start', '▶ Старт'));
    setTxt('pause', LBL_PAUSE);
    setTxt('stop', T('fb_stop', '■ Стоп'));
    setTxt('clear', T('fb_clear', 'Очистить'));
    setTxt('lLog', T('fb_log', 'Лог'));
    setTxt('clearLog', T('fb_clearLog', 'очистить'));
    setTxt('fbFoot', T('fb_footer', 'Бесплатно · вход не нужен. Результаты скачиваются на ваш компьютер. TrendFlow — опционально.'));
    setTxt('lScen', T('fb_scenTitle', 'Сценарий → пакет'));
    setTxt('scenPlan', T('fb_scenBtn', 'Разбить на промпты'));
    setTxt('scenToggle', els.scenBody && !els.scenBody.hidden ? T('fb_collapse', 'свернуть') : T('fb_expand', 'развернуть'));
    setTxt('scenHint', T('fb_scenHint', 'Вставьте сценарный план с таймкодами («0:00 – 0:08 | Хук»…) — нарежется на клипы ≤8с, сплит-сцены (Слева:/Справа:) станут парой промптов, титры и QR уйдут в спеку. Подключён TrendFlow — нарезает ИИ с EN-промптами, а в Галерее появится «Собрать ролик».'));
    if (els.scenario) els.scenario.placeholder = T('fb_scenPh', '0:00 – 0:08 | Хук\nВизуал: Слева: герой прощается с коровой… Справа: он же на стройке…\nТекст на экране: ГЛАВНЫЙ ТИТР\n\n0:08 – 0:20 | Проблема\nВизуал: …');
  }

  // ---------- persistence ----------
  function saveSettings() {
    const s = {};
    for (const k of SETTINGS_KEYS) if (els[k]) s[k] = els[k].value;
    for (const k of FLAG_KEYS) if (els[k]) s[k] = els[k].checked;
    s.promptsText = els.prompts.value;
    s.scenarioText = els.scenario ? els.scenario.value : '';
    try { chrome.storage.local.set({ flowBooster: s }); } catch { /* */ }
  }
  function loadSettings() {
    try {
      chrome.storage.local.get('flowBooster', (d) => {
        const s = (d && d.flowBooster) || {};
        for (const k of SETTINGS_KEYS) if (s[k] != null && els[k]) els[k].value = s[k];
        for (const k of FLAG_KEYS) if (s[k] != null && els[k]) els[k].checked = !!s[k];
        if (s.promptsText != null) els.prompts.value = s.promptsText;
        if (s.scenarioText != null && els.scenario) els.scenario.value = s.scenarioText;
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

  // ---------- «Сценарий → пакет»: нарезка сценарного плана ----------
  let plan = null; // { batchId, spec, items } — активный пакет (переживает переоткрытие панели)
  const savePlan = () => { try { chrome.storage.local.set({ flowBoosterPlan: plan }); } catch { /* */ } };
  const loadPlan = () => {
    try {
      chrome.storage.local.get('flowBoosterPlan', (d) => {
        if (d && d.flowBoosterPlan && d.flowBoosterPlan.items) {
          plan = d.flowBoosterPlan;
          if (els.scenInfo) els.scenInfo.textContent = plan.items.length + ' × ≤8s';
        }
      });
    } catch { /* */ }
  };

  const TC_RE = /(\d{1,3}):(\d{2})\s*[–—-]{1,2}\s*(\d{1,3}):(\d{2})/;
  const toSec = (m, s) => Number(m) * 60 + Number(s);
  const stripMd = (s) => String(s || '').replace(/[*_`#]+/g, '').replace(/^\s*[-•|]\s*/, '').trim();

  /** Локальная (без ИИ) нарезка: сцены по таймкодам, титры «Текст на экране», сплит «Слева/Справа»,
   *  куски ≤8с. Язык промптов — как в сценарии. Умная EN-нарезка — через TrendFlow (runScenarioPlan). */
  function parseScenarioLocal(text) {
    const lines = String(text || '').split('\n');
    const marks = [];
    lines.forEach((ln, i) => { const m = TC_RE.exec(ln); if (m) marks.push({ i, start: toSec(m[1], m[2]), end: toSec(m[3], m[4]) }); });
    if (!marks.length) return null;
    const scenes = [];
    marks.forEach((mk, k) => {
      if (!(mk.end > mk.start)) return;
      const body = lines.slice(mk.i + 1, k + 1 < marks.length ? marks[k + 1].i : lines.length).join('\n');
      const cap = /(?:Текст на экране|Text on screen)[^:：]*[:：]\s*([^\n]+)/i.exec(body);
      const voi = /(?:Аудио|Голос за кадром|Voice-?over|Audio)[^:：]*[:：]\s*([^\n]+)/i.exec(body);
      let visual = body;
      const vm = /(?:Визуал|Visual)[^:：]*[:：]\s*/i.exec(body);
      if (vm) {
        visual = body.slice(vm.index + vm[0].length);
        const cut = visual.search(/(?:Аудио|Текст на экране|Text on screen|Audio|Voice|Голос)[^:：]*[:：]/i);
        if (cut > 0) visual = visual.slice(0, cut);
      }
      const wantSplit = /сплит|split|разделён|разделен|две части/i.test(body);
      let left = '', right = '';
      if (wantSplit) {
        const lm = /(?:Слева|Left)[^:：]*[:：]\s*([\s\S]*?)(?=(?:Справа|Right)[^:：]*[:：]|$)/i.exec(visual);
        const rm = /(?:Справа|Right)[^:：]*[:：]\s*([\s\S]*?)$/i.exec(visual);
        left = stripMd((lm && lm[1] || '').replace(/\n+/g, ' ')).slice(0, 700);
        right = stripMd((rm && rm[1] || '').replace(/\n+/g, ' ')).slice(0, 700);
      }
      const vis = stripMd(visual.replace(/\n+/g, ' ')).slice(0, 800);
      if (!vis && !(left && right)) return;
      scenes.push({
        start: mk.start, end: mk.end,
        caption: cap ? stripMd(cap[1]).slice(0, 200) : '', voice: voi ? stripMd(voi[1]).slice(0, 400) : '',
        split: !!(wantSplit && left && right), vis, left, right,
      });
    });
    if (!scenes.length) return null;

    const noText = T('fb_noTextSuffix', ', без надписей, логотипов и текста в кадре');
    const outScenes = []; let g = 1;
    scenes.forEach((s, idx) => {
      const dur = Math.max(1, s.end - s.start);
      const n = Math.max(1, Math.ceil(dur / 8 - 1e-6));
      const cd = dur / n;
      const clips = [];
      for (let k = 0; k < n; k++) {
        const t0 = s.start + k * cd;
        const t1 = k === n - 1 ? s.end : s.start + (k + 1) * cd;
        const cont = n > 1 ? ' ' + fmt(T('fb_contPart', '(часть {k} из {n}, продолжение действия)'), { k: k + 1, n }) : '';
        if (s.split) {
          clips.push({ index: g++, t0, t1, side: 'L', prompt: s.left + cont + noText });
          clips.push({ index: g++, t0, t1, side: 'R', prompt: s.right + cont + noText });
        } else {
          clips.push({ index: g++, t0, t1, prompt: s.vis + cont + noText });
        }
      }
      outScenes.push({ idx, start: s.start, end: s.end, caption: s.caption, voice: s.voice, layout: s.split ? 'split' : 'single', clips });
    });
    const bot = /@([A-Za-z0-9_]{4,32}bot)/i.exec(text);
    const url = /(https?:\/\/[^\s)»"']+)/.exec(text);
    const sfxTimes = [];
    const sfxm = /(?:SFX|Звуков)[\s\S]{0,400}?\((\d{1,3}):(\d{2})\)/i.exec(text);
    if (sfxm) sfxTimes.push(toSec(sfxm[1], sfxm[2]));
    const firstLine = stripMd(lines.find((l) => stripMd(l)) || '').slice(0, 100);
    const spec = {
      title: firstLine || 'Flow batch', format: '9x16',
      qrText: bot ? 'https://t.me/' + bot[1] : (url ? url[1] : ''),
      sfxTimes, totalClips: g - 1, scenes: outScenes,
    };
    const items = outScenes.flatMap((sc) => sc.clips.map((c) => ({
      index: c.index, prompt: c.prompt, sceneIdx: sc.idx, side: c.side || null,
      len: Math.min(8, Math.max(1, Math.round(c.t1 - c.t0))),
    })));
    return { spec, items };
  }

  /** Применить план: промпты в textarea, длина 8с, 1 результат/промпт, персонажи «все». */
  function applyPlan(p, sourceLbl) {
    plan = { batchId: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), spec: p.spec, items: p.items };
    els.prompts.value = p.items.map((i) => i.prompt).join('\n');
    if (els.length) els.length.value = '8';
    if (els.count) els.count.value = '1'; // мета пакета однозначна при 1 результате на промпт
    if (!els.folder.value.trim()) els.folder.value = 'FlowAd';
    if (characters.length && els.charMode) els.charMode.value = 'all';
    updatePromptCount(); saveSettings(); savePlan();
    if (els.scenInfo) els.scenInfo.textContent = p.items.length + ' × ≤8s';
    log(fmt(T('fb_scenDone', '🎬 нарезано: {n} промптов из {s} сцен — {src}'), { n: p.items.length, s: p.spec.scenes.length, src: sourceLbl }));
    if (p.spec.qrText) log('QR: ' + p.spec.qrText);
  }

  /** Спека пакета → TrendFlow (Галерея покажет пакет и «Собрать ролик»). */
  async function sendSpec() {
    if (!ttConnected || !plan) return;
    const r = await bg({ type: 'batch-spec', batchId: plan.batchId, spec: plan.spec });
    log(r && r.ok
      ? T('fb_scenSpecSent', '📦 спека пакета в TrendFlow — в Галерее появится «Собрать ролик»')
      : T('fb_scenSpecFail', '⚠ спека не отправилась (клипы всё равно соберутся в пакет)'));
  }

  async function runScenarioPlan() {
    const text = (els.scenario ? els.scenario.value : '').trim();
    if (text.length < 30) { log(T('fb_scenShort', 'вставьте сценарный план с таймкодами (пример: 0:00 – 0:08)')); return; }
    els.scenPlan.disabled = true;
    try {
      if (ttConnected) {
        log(T('fb_scenAsking', '🧠 ИИ-нарезка через TrendFlow…'));
        const r = await bg({ type: 'scenario-plan', scenario: text });
        if (r && r.ok && Array.isArray(r.items) && r.items.length) {
          applyPlan(r, T('fb_scenSmart', 'ИИ (EN-промпты)'));
          await sendSpec();
          return;
        }
        log(((r && r.error) ? r.error + ' — ' : '') + T('fb_scenFallback', 'нарезаю локально'));
      }
      const p = parseScenarioLocal(text);
      if (!p) { log(T('fb_scenNone', 'не нашёл сцен с таймкодами (пример: 0:00 – 0:08)')); return; }
      applyPlan(p, T('fb_scenLocal', 'локально, без перевода'));
      await sendSpec();
    } finally { els.scenPlan.disabled = false; }
  }

  // ---------- персонажи (референсы) ----------
  const fileToDataUrl = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(file); });
  const baseName = (n) => String(n || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 24);
  async function addCharacters(files) {
    for (const f of files) {
      if (!/^image\//.test(f.type)) continue;
      if (characters.length >= 10) break;
      try { characters.push({ id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6), name: baseName(f.name) || (T('fb_characterN', 'Персонаж') + ' ' + (characters.length + 1)), dataUrl: await fileToDataUrl(f) }); } catch { /* */ }
    }
    renderCharacters();
  }
  function renderCharacters() {
    els.refs.innerHTML = '';
    characters.forEach((c) => {
      const row = document.createElement('div'); row.className = 'charrow';
      const img = document.createElement('img'); img.src = c.dataUrl; row.appendChild(img);
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = c.name; inp.placeholder = T('fb_charName', 'имя (используется в промптах)');
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
    if (!r || !r.present) { chip.className = 'chip off'; chip.textContent = T('fb_noFlowTab', 'нет вкладки Flow'); return; }
    if (!r.ready) { chip.className = 'chip wait'; chip.textContent = T('fb_flowLoading', 'Flow грузится…'); return; }
    chip.className = 'chip on';
    chip.textContent = r.inProject ? T('fb_flowInProject', 'Flow · в проекте') : T('fb_flowReady', 'Flow готов');
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
      const meta = document.createElement('span'); meta.className = 'meta'; meta.textContent = it.note || ST_LBL[it.status] || it.status;
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
  async function handleResults(item, results) {
    const prompt = item.prompt;
    let idx = 0;
    for (const r of results) {
      const kind = r.kind || 'video';
      if (els.autoDl.checked && !r.native) {
        // Пакет сценария: номер клипа в начале имени файла — порядок монтажа виден в папке.
        const nm = (item.batchIndex ? String(item.batchIndex).padStart(2, '0') + ' ' : '') + prompt;
        const spec = { folder: els.folder.value.trim(), prefix: els.prefix.value.trim(), name: nm, index: idx, kind, sourceUrl: r.sourceUrl, dataUrl: r.dataUrl };
        const dl = await bg({ type: 'flow-download', spec });
        if (dl && dl.ok) log('💾 ' + dl.filename); else log(T('fb_dlFail', '⚠ скачивание: ') + ((dl && dl.error) || T('fb_failed', 'не удалось')));
      } else if (r.native) { log(T('fb_savedNative', '💾 сохранено через меню Flow (hi-res)')); }
      if (els.ttSend.checked && ttConnected) {
        const payload = { sourceUrl: r.sourceUrl, dataUrl: r.dataUrl, kind, title: prompt.slice(0, 80) };
        // Мета пакета — только у первого результата промпта (реестр клипов: index → один ассет).
        if (item.batchIndex && idx === 0 && plan) {
          payload.batch = { id: plan.batchId, index: item.batchIndex, total: plan.spec.totalClips, title: plan.spec.title };
        }
        const ing = await bg({ type: 'manual-ingest', payload });
        if (ing && ing.ok) log(T('fb_ttSent', '⬆ в Галерею TrendFlow ✓')); else log(T('fb_ttFail', '⚠ TrendFlow: ') + ((ing && ing.error) || T('fb_failed', 'не удалось')));
      }
      if (els.chain.checked && kind === 'image' && r.dataUrl) lastChainImage = r.dataUrl;
      idx++;
    }
  }

  function handleThrottle() {
    if (throttleTimer) return; // уже на паузе по троттлингу — второй таймер обрезал бы её раньше времени
    log(T('fb_throttlePause', '⏸ Flow троттлит — пауза 20 мин'));
    paused = true; els.pause.textContent = LBL_RESUME;
    throttleTimer = setTimeout(() => { throttleTimer = null; paused = false; els.pause.textContent = LBL_PAUSE; }, 20 * 60_000);
  }

  // ---------- главный цикл: пул параллельных генераций ----------
  async function runQueue() {
    let fs = await bg({ type: 'flow-status' });
    if (!fs || !fs.present) { log(T('fb_openingFlow', 'открываю Google Flow…')); await bg({ type: 'flow-open' }); await sleep(1500); }
    await bg({ type: 'flow-reset' });
    const hiRes = () => els.hiRes.checked && !!els.resolution.value;
    // Переименование родных hi-res загрузок Flow — взводим ОДИН раз на весь пакет: сама загрузка
    // происходит ПОЗЖЕ (во время сбора), поэтому арм вокруг submit не срабатывал. Имя общее + uniquify
    // (onDeterminingFilename не знает, какой промпт инициировал загрузку); папка/префикс — как заданы.
    if (hiRes() && els.autoDl.checked) {
      await bg({ type: 'flow-arm-rename', spec: { folder: els.folder.value.trim(), prefix: els.prefix.value.trim(), name: 'flow', kind: (els.mode.value === 'imageToImage' || els.mode.value === 'textToImage') ? 'image' : 'video', ttlMs: 6 * 3600 * 1000 } });
      renameArmed = true;
    }

    let conc = clamp(Number(els.concurrency.value) || 1, 1, 4);
    if (els.chain.checked) conc = 1; // «chain» требует последовательности (результат → референс следующего)
    const inFlight = []; // [{item, submitId}]
    let qi = 0;
    const nextQueued = () => { while (qi < queue.length && queue[qi].status !== 'queued') qi++; return qi < queue.length ? queue[qi] : null; };

    while (!stopFlag) {
      // 1) наполнить пул до conc
      while (inFlight.length < conc && !paused && !stopFlag) {
        const item = nextQueued();
        if (!item) break;
        item.status = 'running'; item.note = T('fb_submitting', 'запуск…'); item.pct = 0; renderQueue();
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
        qi++;
        let sub;
        try { sub = await bg({ type: 'flow-submit', item: payload }); } catch (e) { sub = { ok: false, reason: String(e && e.message || e) }; }
        if (sub && sub.throttled) { item.status = 'queued'; item.note = T('fb_throttled', 'троттлинг'); qi--; renderQueue(); handleThrottle(); break; }
        if (!sub || !sub.ok) {
          item.status = 'failed'; item.note = (sub && sub.reason) || T('fb_submitFailed', 'запуск не удался'); renderQueue();
          log(T('fb_submitErrPrefix', '✕ запуск: ') + item.note);
          if (item.note === 'no-flow-tab' || item.note === 'flow-not-ready') { log(T('fb_pressOpenFlow', 'нажми «Open Google Flow» и войди')); stopFlag = true; }
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
        if (!r || !r.ok) { f.item.status = 'failed'; f.item.note = (r && r.reason) || T('fb_collectFailed', 'сбор не удался'); renderQueue(); continue; } // выбывает
        if (r.done) {
          const n = (r.results || []).length;
          f.item.status = n ? 'done' : 'failed';
          f.item.note = n ? ('✓ ' + n + (r.timeout ? ' (' + T('fb_timeout', 'таймаут') + ')' : '')) : (r.timeout ? T('fb_timeout', 'таймаут') : T('fb_noResult', 'нет результата'));
          renderQueue();
          await handleResults(f.item, r.results || []);
          // «delay между промптами» — только последовательно (в параллели интервал задаёт стаггер запусков)
          if (conc === 1 && nextQueued()) { const d = jitter(Number(els.pace.value) || 30); log(fmt(T('fb_pacing', '⏳ пауза {s}с…'), { s: Math.round(d / 1000) })); await sleep(d); }
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
    if (!prompts.length) { log(T('fb_addPrompts', 'добавь хотя бы один промпт')); return; }
    queue = prompts.map((p, i) => ({ id: 'q' + Date.now() + '_' + i, prompt: p, status: 'queued', note: '', pct: 0 }));
    // Пакет сценария: мета клипов по ПОЗИЦИИ строки (строка i = items[i]); строки менялись — без меты.
    if (plan && plan.items && plan.items.length === queue.length) {
      queue.forEach((q, i) => { q.batchIndex = plan.items[i].index; });
      log(T('fb_scenMeta', '📦 пакет активен: клипы уйдут с метой сцен'));
    } else if (plan) {
      log(T('fb_scenMismatch', '⚠ число строк не совпадает с планом — клипы уйдут без меты пакета'));
    }
    lastChainImage = null;
    running = true; paused = false; stopFlag = false;
    els.start.disabled = true; els.pause.disabled = false; els.stop.disabled = false; els.pause.textContent = LBL_PAUSE;
    renderQueue();
    log(fmt(T('fb_batchStarted', '▶ пакет запущен — {n} промптов, параллель {p}'), { n: prompts.length, p: clamp(Number(els.concurrency.value) || 1, 1, 4) }));
    runQueue();
  }
  function finishRun() {
    running = false; paused = false; stopFlag = false;
    if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
    if (renameArmed) { bg({ type: 'flow-disarm-rename' }); renameArmed = false; }
    bg({ type: 'flow-reset' }); // сброс состояния пакета в content + разморозка вотчера (flowTaskBusy=false)
    els.start.disabled = false; els.pause.disabled = true; els.stop.disabled = true; els.pause.textContent = LBL_PAUSE;
    for (const q of queue) if (q.status === 'running') { q.status = 'failed'; q.note = T('fb_stopped', 'остановлено'); }
    renderQueue();
    const done = queue.filter((q) => q.status === 'done').length;
    const failed = queue.filter((q) => q.status === 'failed').length;
    log(fmt(T('fb_finished', '■ готово — {d} успешно, {f} с ошибкой'), { d: done, f: failed }));
  }
  function togglePause() { if (!running) return; paused = !paused; els.pause.textContent = paused ? LBL_RESUME : LBL_PAUSE; log(paused ? T('fb_pausedLog', '⏸ пауза') : T('fb_resumedLog', '▶ продолжаю')); }
  function stopRun() { if (!running) return; stopFlag = true; paused = false; log(T('fb_stopping', '■ останавливаю после текущих…')); }
  function clearAll() {
    if (running) return;
    queue = []; renderQueue(); els.prompts.value = ''; updatePromptCount();
    plan = null; savePlan();
    if (els.scenInfo) els.scenInfo.textContent = '';
    saveSettings();
  }

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
    applyI18n();
    els.ver.textContent = 'v' + chrome.runtime.getManifest().version;
    els.openFlow.onclick = async () => { els.openFlow.disabled = true; log(T('fb_openingFlow', 'открываю Google Flow…')); await bg({ type: 'flow-open' }); setTimeout(() => { els.openFlow.disabled = false; refreshFlowStatus(); }, 1500); };
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
    if (els.scenToggle) {
      els.scenToggle.onclick = () => {
        const wasHidden = els.scenBody.hidden;
        els.scenBody.hidden = !wasHidden;
        els.scenToggle.textContent = wasHidden ? T('fb_collapse', 'свернуть') : T('fb_expand', 'развернуть');
      };
    }
    if (els.scenPlan) els.scenPlan.onclick = runScenarioPlan;
    if (els.scenario) els.scenario.addEventListener('input', saveSettings);
  }

  // ---------- старт ----------
  wire();
  loadSettings();
  loadPlan();
  refreshFlowStatus(); refreshTtStatus();
  setInterval(refreshFlowStatus, 4000);
  setInterval(refreshTtStatus, 6000);
})();
