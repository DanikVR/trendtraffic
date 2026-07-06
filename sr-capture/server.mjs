/**
 * TrendTraffic sr-capture — рендер говорящего SpatialReal-аватара в видеофайл С АЛЬФОЙ.
 *
 * Схема (доказана смоуком Фазы-0 + экспериментами 06.07.2026):
 *   POST /render {sessionToken, appId, avatarId, audioUrl}
 *     → скачиваем аудио → PCM16 mono 16кГц
 *     → headless Chromium: страница с @spatialwalk/avatarkit (аватар на ПРОЗРАЧНОМ фоне)
 *     → стримим PCM в их облако (реальное время, клип N сек ≈ N сек рендера)
 *     → кадры PNG с альфой → ffmpeg → VP9 webm (yuva420p, альфа живая)
 *   GET /status?job= → {status, frames, fps, output_name}
 *   GET /files/<name> → готовый webm
 *
 * Два режима захвата (авто):
 *   fast     — полный Chrome, new headless (+GPU d3d11): rAF не тротлится → rAF-захват
 *              canvas.toDataURL ~15fps. Требует запуска в логин-сессии пользователя.
 *   beginframe — headless shell + --enable-begin-frame-control (+GPU): сами качаем
 *              компоновщик, скриншот на каждый кадр (~8-9fps). Работает из любого окружения.
 *
 * Запуск: node server.mjs (порт SR_CAPTURE_PORT, деф. 8803). Прод ходит по Tailscale.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SR_CAPTURE_PORT || 8803);
const PAGE_PORT = Number(process.env.SR_PAGE_PORT || 5209);
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const JOBS_DIR = path.join(__dir, 'jobs');
const CAPTURE_FPS = Number(process.env.SR_CAPTURE_FPS || 15);
const MAX_CLIP_SEC = Number(process.env.SR_MAX_CLIP_SEC || 240);
fs.mkdirSync(JOBS_DIR, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function ffmpeg(args, timeoutMs = 300_000) {
  return new Promise((resolve, reject) => {
    const p = execFile(FFMPEG, args, { windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, (err, _o, stderr) => {
      clearTimeout(t);
      if (err) reject(new Error(`ffmpeg: ${String(stderr || err.message).slice(-400)}`)); else resolve();
    });
    const t = setTimeout(() => { try { p.kill(); } catch { /* */ } reject(new Error('ffmpeg: таймаут')); }, timeoutMs);
  });
}
function ffprobeDuration(file) {
  return new Promise((resolve) => {
    execFile(FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
      { windowsHide: true }, (err, out) => resolve(err ? 0 : Number(String(out).trim()) || 0));
  });
}

/** Огибающая громкости аудио по КАДРОВЫМ бинам (RMS каждого 1/fps окна). PCM s16le mono 16кГц. */
function audioEnvelope(pcmPath, nBins, fps) {
  const A = new Array(nBins).fill(0);
  try {
    const buf = fs.readFileSync(pcmPath);
    const N = Math.floor(buf.length / 2);
    const per = Math.max(1, Math.round(16000 / fps));
    for (let k = 0; k < nBins; k++) {
      let sum = 0; let cnt = 0; const s0 = k * per;
      for (let i = 0; i < per && (s0 + i) < N; i++) { const s = buf.readInt16LE((s0 + i) * 2); sum += s * s; cnt++; }
      A[k] = cnt ? Math.sqrt(sum / cnt) : 0;
    }
  } catch { /* нули */ }
  return A;
}

/** Покадровый сигнал движения РТА (разница соседних кадров в зоне рта, сглажено окном 3).
 *  Длина = count (mo[0]=0). Возвращает массив ИЛИ null. */
function motionSignal(framesDir, count) {
  return new Promise((resolve) => {
    if (count < 8) { resolve(null); return; }
    // Зона рта (центр-низ лица head-and-shoulders). Idle-движение головы/плеч сюда почти не
    // попадает, а что попадёт — отсеет кросс-корреляция с аудио (не коррелирует со звуком).
    const ff = spawn(FFMPEG, ['-i', path.join(framesDir, 'f%05d.png'),
      '-vf', 'crop=iw*0.34:ih*0.20:iw*0.33:ih*0.50,format=gray,tblend=all_mode=difference,signalstats,metadata=print',
      '-f', 'null', '-'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
    let buf = '';
    ff.stderr.on('data', (d) => { buf += d.toString(); });
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } resolve(null); }, 120_000);
    ff.on('error', () => { clearTimeout(timer); resolve(null); });
    ff.on('close', () => {
      clearTimeout(timer);
      const raw = [];
      const re = /lavfi\.signalstats\.YAVG=([\d.]+)/g; let m;
      while ((m = re.exec(buf)) !== null) raw.push(parseFloat(m[1]));
      if (raw.length < 4) { resolve(null); return; }
      // раскладка: raw[i] = разница кадров i↔i+1 → движение НА кадре i+1
      const mo = new Array(count).fill(0);
      for (let i = 0; i < raw.length; i++) mo[i + 1] = raw[i];
      // сглаживание окном 3
      const sm = mo.map((_, i) => ((mo[i - 1] ?? mo[i]) + mo[i] + (mo[i + 1] ?? mo[i])) / 3);
      resolve(sm);
    });
  });
}

/** Лаг видео относительно аудио (кадры) через кросс-корреляцию огибающих: движение рта mo[k]
 *  соответствует звуку A[k−L]. Ищем L∈[0,maxLag], максимизирующий корреляцию (сигналы
 *  центрируем — убираем постоянную составляющую idle-движения). 0 при слабом сигнале. */
function bestLagFrames(mo, A, maxLag) {
  const n = Math.min(mo.length, A.length);
  if (n < 8) return 0;
  const mean = (arr, len) => { let s = 0; for (let i = 0; i < len; i++) s += arr[i]; return s / len; };
  const mMo = mean(mo, n); const mA = mean(A, n);
  const mc = mo.slice(0, n).map((v) => v - mMo);
  const ac = A.slice(0, n).map((v) => v - mA);
  const energy = (arr) => Math.sqrt(arr.reduce((s, v) => s + v * v, 0)) || 1;
  const eA = energy(ac);
  let best = 0; let bestScore = -Infinity;
  for (let L = 0; L <= maxLag; L++) {
    let s = 0; let cnt = 0;
    for (let k = L; k < n; k++) { s += mc[k] * ac[k - L]; cnt++; }
    if (cnt < 8) break;
    // нормируем на энергию окна mc, чтобы длина окна не смещала выбор к малым L
    let em = 0; for (let k = L; k < n; k++) em += mc[k] * mc[k];
    const score = s / ((Math.sqrt(em) || 1) * eA);
    if (score > bestScore) { bestScore = score; best = L; }
  }
  // слабая корреляция → не доверяем, не режем
  return bestScore > 0.12 ? best : 0;
}

// ── Vite: страница с avatarkit (exclude обязателен — pre-bundle ломает WASM-загрузку) ──
let viteReady = null;
async function ensureVite() {
  if (!viteReady) {
    viteReady = (async () => {
      const server = await createViteServer({
        root: path.join(__dir, 'page'),
        logLevel: 'error',
        server: { port: PAGE_PORT, host: '127.0.0.1', strictPort: true },
        optimizeDeps: { exclude: ['@spatialwalk/avatarkit'] },
      });
      await server.listen();
      log(`vite page on :${PAGE_PORT}`);
      return server;
    })();
  }
  return viteReady;
}

// ── Браузер: fast (new headless, GPU) → фолбэк beginframe (headless shell, GPU) ──
async function launchBrowser() {
  const gpu = ['--use-angle=d3d11', '--use-gl=angle', '--enable-gpu'];
  if (process.env.SR_FORCE_BEGINFRAME !== '1') {
    try {
      const b = await chromium.launch({
        headless: true, channel: 'chromium',
        args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', ...gpu],
      });
      return { browser: b, mode: 'fast' };
    } catch (e) { log('fast-режим недоступен (' + String(e.message || e).slice(0, 80) + ') → beginframe'); }
  }
  const b = await chromium.launch({
    headless: true,
    args: ['--enable-begin-frame-control', '--autoplay-policy=no-user-gesture-required',
      '--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout', ...gpu],
  });
  return { browser: b, mode: 'beginframe' };
}

// ── Задачи ──
const jobs = new Map(); // id → {status, error?, outputName?, frames?, fps?, mode?, ts}
let busy = Promise.resolve(); // single-flight: браузер+GPU — по одному рендеру за раз

async function runJob(id, { sessionToken, appId, avatarId, audioUrl }) {
  const j = jobs.get(id);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'srcap-'));
  const framesDir = path.join(work, 'frames');
  fs.mkdirSync(framesDir);
  let browser = null;
  try {
    // 1. Аудио → wav + pcm16 mono 16k
    j.status = 'audio';
    const src = path.join(work, 'in.bin');
    const r = await fetch(audioUrl);
    if (!r.ok) throw new Error(`аудио не скачалось (HTTP ${r.status})`);
    fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
    const pcm = path.join(work, 'in.pcm');
    await ffmpeg(['-y', '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-f', 's16le', pcm], 120_000);
    const dur = (fs.statSync(pcm).size / 2) / 16000;
    if (!(dur > 0.3)) throw new Error('аудио пустое');
    if (dur > MAX_CLIP_SEC) throw new Error(`аудио ${Math.round(dur)}с > лимита ${MAX_CLIP_SEC}с`);
    const pcmB64 = fs.readFileSync(pcm).toString('base64');

    // 2. Браузер + страница
    j.status = 'browser';
    await ensureVite();
    const { browser: b, mode } = await launchBrowser();
    browser = b; j.mode = mode;
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
    page.on('console', (m) => { const t = m.text(); if (t.includes('[sr]')) log(`[${id.slice(0, 6)}]`, t.slice(0, 120)); });
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attrs) {
        if (type === 'webgl' || type === 'webgl2') attrs = { ...(attrs || {}), preserveDrawingBuffer: true };
        return orig.call(this, type, attrs);
      };
    });
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }).catch(() => {});

    // beginframe: пампер нужен уже на этапе загрузки (иначе страница не рисуется вовсе)
    let pumping = mode === 'beginframe'; let saving = false; let saved = 0; let lastShotAt = 0;
    let firstShotAt = 0;
    const pump = mode === 'beginframe' ? (async () => {
      while (pumping) {
        const t0 = Date.now();
        try {
          // Кадры пишем только с первого аудио-чанка (__speaking) — синхрон губ и дорожки.
          const speaking = saving && await page.evaluate(() => !!window.__speaking).catch(() => false);
          const wantShot = speaking && t0 - lastShotAt >= 1000 / CAPTURE_FPS - 5;
          const res = await client.send('HeadlessExperimental.beginFrame', wantShot ? { screenshot: { format: 'png' } } : {});
          if (wantShot && res.screenshotData) {
            fs.writeFileSync(path.join(framesDir, `f${String(saved++).padStart(5, '0')}.png`), Buffer.from(res.screenshotData, 'base64'));
            lastShotAt = t0; if (!firstShotAt) firstShotAt = t0;
          }
        } catch { await new Promise((rr) => setTimeout(rr, 150)); }
        const wait = Math.max(0, Math.round(1000 / CAPTURE_FPS) - (Date.now() - t0));
        if (wait) await new Promise((rr) => setTimeout(rr, wait));
      }
    })() : null;

    j.status = 'avatar';
    await page.goto(`http://127.0.0.1:${PAGE_PORT}/?appId=${encodeURIComponent(appId)}&avatarId=${encodeURIComponent(avatarId)}&token=${encodeURIComponent(sessionToken)}`, { waitUntil: 'load', timeout: 60_000 });
    let rendered = false;
    for (let i = 0; i < 120; i++) {
      if (await page.evaluate(() => window.__rendered)) { rendered = true; break; }
      const err = await page.evaluate(() => window.__error);
      if (err) throw new Error('avatarkit: ' + String(err).slice(0, 300));
      await new Promise((rr) => setTimeout(rr, 1000));
    }
    if (!rendered) throw new Error('аватар не отрисовался за 120с');

    // 3. Драйв аудио + захват
    j.status = 'render';
    if (mode === 'fast') { await page.evaluate((fps) => window.startCapture(fps), CAPTURE_FPS); }
    saving = true;
    await page.evaluate((b64) => { window.driveAudio(b64); }, pcmB64);

    const deadline = Date.now() + Math.round(dur * 1500) + 60_000;
    const drain = async () => {
      if (mode !== 'fast') return;
      const batch = await page.evaluate(() => { const f = window.__frames; window.__frames = []; return f; });
      for (const f of batch) {
        if (typeof f !== 'string' || f.startsWith('ERR:')) continue;
        fs.writeFileSync(path.join(framesDir, `f${String(saved++).padStart(5, '0')}.png`), Buffer.from(f.slice(f.indexOf(',') + 1), 'base64'));
      }
    };
    // ВАЖНО про синхрон: их облако отвечает движением губ с ЗАДЕРЖКОЙ (буфер ~секунды).
    // → первые кадры = закрытый рот, а «хвост» губ идёт ПОСЛЕ конца аудио. Поэтому
    // капчурим ещё TAIL_MS после __audioDone (ловим хвост), а простой в начале/конце
    // потом срежем по детекции движения (detectActiveRange) — так первый активный кадр
    // ляжет на звук[0].
    const TAIL_MS = 7000;
    let audioDoneAt = 0;
    while (Date.now() < deadline) {
      await drain();
      j.frames = saved;
      if (!audioDoneAt && await page.evaluate(() => window.__audioDone)) audioDoneAt = Date.now();
      if (audioDoneAt && Date.now() - audioDoneAt >= TAIL_MS) { await drain(); break; }
      await new Promise((rr) => setTimeout(rr, 200));
    }
    saving = false; pumping = false;
    if (pump) await pump.catch(() => {});
    // Честный fps: интервал между ПЕРВЫМ и ПОСЛЕДНИМ реально снятым кадром.
    let capSpanMs = lastShotAt - firstShotAt;
    if (mode === 'fast') {
      await page.evaluate(() => { window.__capStop = true; }).catch(() => {});
      const span = await page.evaluate(() => (window.__capT0 && window.__capLast ? window.__capLast - window.__capT0 : 0)).catch(() => 0);
      if (span > 0) capSpanMs = span;
    }
    await browser.close().catch(() => {}); browser = null;
    if (saved < 3) throw new Error(`захвачено кадров: ${saved} — рендер не пошёл`);
    const fps = Math.max(1, Math.min(30, capSpanMs > 200 ? (saved - 1) / (capSpanMs / 1000) : CAPTURE_FPS));
    j.frames = saved; j.fps = Math.round(fps * 100) / 100;

    // 4a. Синхрон через КРОСС-КОРРЕЛЯЦИЮ: их облако двигает губы с задержкой L. Находим L как
    //     сдвиг, при котором движение рта совпадает с громкостью аудио (idle-движение головы/
    //     моргание НЕ коррелирует со звуком → не мешает). Срезаем L кадров с начала — тогда
    //     первый кадр ляжет на звук[0]. Реальная тишина в записи сохраняется (в неё рот закрыт,
    //     и корреляция это учитывает). Конец не режем — composeUgc caps по длине голоса.
    const mo = await motionSignal(framesDir, saved);
    const env = audioEnvelope(pcm, saved, fps);
    const maxLag = Math.max(1, Math.round(Math.min(8, dur * 0.5) * fps));
    const lag = mo ? bestLagFrames(mo, env, maxLag) : 0;
    const startN = Math.max(0, Math.min(saved - 4, lag));
    const endN = saved - 1;
    const nFrames = endN - startN + 1;
    log(`job ${id.slice(0, 6)} синхрон: лаг ${lag} кадр. (~${(lag / fps).toFixed(2)}с) → срез начала ${startN}; итог ${nFrames}/${saved} @${fps.toFixed(2)}fps`);

    // 4b. Кадры → VP9 webm С АЛЬФОЙ (auto-alt-ref=0 обязателен для альфы)
    j.status = 'encode';
    const outName = `sr-${id.slice(0, 8)}.webm`;
    await ffmpeg(['-y', '-framerate', fps.toFixed(3), '-start_number', String(startN), '-i', path.join(framesDir, 'f%05d.png'),
      '-frames:v', String(nFrames),
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '2M', '-deadline', 'realtime', '-cpu-used', '8',
      '-auto-alt-ref', '0', '-r', fps.toFixed(3), path.join(JOBS_DIR, outName)],
    Math.max(300_000, Math.round(dur * 8000) + 120_000));
    const outDur = await ffprobeDuration(path.join(JOBS_DIR, outName));
    j.outputName = outName; j.outDur = Math.round(outDur * 100) / 100;
    j.status = 'done';
    log(`job ${id.slice(0, 6)} DONE: ${saved} кадров @${j.fps}fps, ${outName} (${outDur.toFixed(1)}с, режим ${mode})`);
  } catch (e) {
    j.status = 'failed'; j.error = String(e?.message || e).slice(0, 500);
    log(`job ${id.slice(0, 6)} FAILED:`, j.error);
  } finally {
    if (browser) await browser.close().catch(() => {});
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* */ }
  }
}

// TTL-очистка готовых файлов/джобов (6ч)
setInterval(() => {
  const cutoff = Date.now() - 6 * 3600_000;
  for (const [k, v] of jobs) if (v.ts < cutoff) { if (v.outputName) { try { fs.unlinkSync(path.join(JOBS_DIR, v.outputName)); } catch { /* */ } } jobs.delete(k); }
}, 600_000).unref();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/health', (_q, res) => res.json({ ok: true, service: 'sr-capture', fps: CAPTURE_FPS, jobs: jobs.size }));
app.post('/render', (req, res) => {
  const { sessionToken, appId, avatarId, audioUrl } = req.body || {};
  if (!sessionToken || !appId || !avatarId || !audioUrl) return res.status(400).json({ error: 'нужны sessionToken, appId, avatarId, audioUrl' });
  const id = randomUUID();
  jobs.set(id, { status: 'queued', ts: Date.now() });
  busy = busy.then(() => runJob(id, { sessionToken, appId, avatarId, audioUrl })).catch(() => {});
  res.json({ job_id: id });
});
app.get('/status', (req, res) => {
  const j = jobs.get(String(req.query.job || ''));
  if (!j) return res.status(404).json({ error: 'job не найден' });
  res.json({ status: j.status, error: j.error, output_name: j.outputName, frames: j.frames, fps: j.fps, mode: j.mode, out_dur: j.outDur });
});
app.get('/files/:name', (req, res) => {
  const name = String(req.params.name || '').replace(/[^a-z0-9._-]/gi, '');
  const p = path.join(JOBS_DIR, name);
  if (!name || !fs.existsSync(p)) return res.status(404).end();
  res.sendFile(p);
});
app.listen(PORT, '0.0.0.0', () => log(`sr-capture on :${PORT} (fps=${CAPTURE_FPS})`));
