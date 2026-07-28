/**
 * ad_compose.ts — сборка РЕКЛАМНОГО РОЛИКА из пакета клипов Flow Booster («Сценарий → пакет»).
 *
 * Вход — спека пакета (сцены с таймкодами) + скачанные клипы Flow из Галереи. Выход — один mp4:
 *   • посценная нормализация (fit в кадр, fps 30, короткий клип держится стоп-кадром tpad);
 *   • сплит-скрин сценой из ДВУХ клипов (hstack половинок кадра) — надёжнее, чем просить Veo;
 *   • конкат сегментов → ASS-титры по таймкодам сцен (движок buildUgcAss, как в UGC/Иллюстраторе);
 *   • аудио: звук клипов (дакинг при голосе) + дорожка голоса + синтетический SFX-«дзинь»
 *     на заданных секундах (aevalsrc-колокол — никаких внешних сэмплов);
 *   • QR-код оверлеем на финале (пакет `qrcode`; если модуль не установлен — честный warning,
 *     сборка НЕ падает).
 *
 * Уроки UGC учтены: каждый вход нормализуется (aresample+aformat), сегменты рендерятся
 * ПО ОДНОМУ (надёжнее мега-фильтра), длительность держит tpad-стоп-кадр (не -stream_loop).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  ffmpeg, hasAudioStream, buildUgcAss, subFilterPath,
  UGC_FORMATS, type UgcFormatKey, type UgcCaption,
} from './podcast_compose.js';

const __d = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__d, '../../../../uploads');
const RENDERS_DIR = path.join(UPLOADS_ROOT, 'renders');
const nodeRequire = createRequire(import.meta.url);

/** Один монтажный сегмент таймлайна: 1 клип (single) или 2 (split-скрин, L+R). */
export interface AdSegment {
  t0: number;
  t1: number;
  clipPaths: string[];
}

export interface AdComposeOpts {
  segments: AdSegment[];
  /** Титры по таймкодам (обычно по сценам сценария). */
  captions?: UgcCaption[];
  format?: UgcFormatKey;              // дефолт '9x16'
  voicePath?: string | null;          // дорожка голоса за кадром (wav/mp3/m4a)
  /** Громкость родного звука клипов 0..1; дефолт 0.25 при голосе, 1 без него. */
  clipVolume?: number;
  sfxTimes?: number[];                // секунды «дзиня» (например стык трансформации)
  qrText?: string | null;             // содержимое QR; рисуется на финальном отрезке
  qrFromSec?: number | null;          // с какой секунды показывать QR (дефолт — начало последнего сегмента)
  capPos?: 'bottom' | 'center' | 'top';
}

export interface AdComposeResult {
  fileUrl: string;
  filePath: string;
  duration: number;
  warnings: string[];
}

/** PNG с QR-кодом. false — модуль qrcode не установлен/упал (сборка продолжается без QR). */
async function makeQrPng(text: string, px: number, dest: string): Promise<boolean> {
  try {
    const QR: any = nodeRequire('qrcode');
    await QR.toFile(dest, text, { width: px, margin: 1, errorCorrectionLevel: 'M' });
    return fs.existsSync(dest);
  } catch {
    return false;
  }
}

/** Синтетический «дзинь» (двухтоновый колокол с затуханием) — без внешних сэмплов. */
async function makeChirpWav(dest: string): Promise<void> {
  const e = '0.34*sin(2*PI*1568*t)*exp(-6*t)+0.22*sin(2*PI*2093*t)*exp(-3.5*t)';
  await ffmpeg(['-y', '-f', 'lavfi', '-i', `aevalsrc=${e}|${e}:s=44100:d=0.9`, '-c:a', 'pcm_s16le', dest], 60_000);
}

/** Отрендерить один нормализованный сегмент (fit, fps30, tpad до длительности, звук всегда есть). */
async function renderSegment(seg: AdSegment, W: number, H: number, outPath: string): Promise<void> {
  const D = Math.min(60, Math.max(0.5, seg.t1 - seg.t0));
  const paths = seg.clipPaths.filter((p) => p && fs.existsSync(p)).slice(0, 2);
  if (!paths.length) throw new Error(`сегмент ${seg.t0}–${seg.t1}с: клип не найден на диске`);
  const split = paths.length === 2;
  const halfW = Math.max(2, Math.floor(W / 4) * 2); // чётная половина кадра
  const fitFull = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30`;
  const fitHalf = `scale=${halfW}:${H}:force_original_aspect_ratio=increase,crop=${halfW}:${H},setsar=1,fps=30`;
  const anorm = 'aresample=async=1:first_pts=0,aformat=sample_rates=44100:channel_layouts=stereo,apad';
  const tail = `tpad=stop_mode=clone:stop_duration=${Math.ceil(D) + 2},format=yuv420p`;

  const audio: boolean[] = [];
  for (const p of paths) audio.push(await hasAudioStream(p));

  const inputs: string[] = [];
  paths.forEach((p) => inputs.push('-i', p));
  const silenceIdx = paths.length;
  inputs.push('-f', 'lavfi', '-t', D.toFixed(2), '-i', 'anullsrc=r=44100:cl=stereo');

  let fc = '';
  if (!split) {
    fc += `[0:v]${fitFull},${tail}[v];`;
    fc += audio[0] ? `[0:a]${anorm}[a];` : `[${silenceIdx}:a]apad[a];`;
  } else {
    fc += `[0:v]${fitHalf}[l];[1:v]${fitHalf}[r];[l][r]hstack=inputs=2,${tail}[v];`;
    const aParts: string[] = [];
    paths.forEach((_, i) => { if (audio[i]) { fc += `[${i}:a]${anorm}[sa${i}];`; aParts.push(`[sa${i}]`); } });
    if (aParts.length >= 2) fc += `${aParts.join('')}amix=inputs=${aParts.length}:duration=first:normalize=0,apad[a];`;
    else if (aParts.length === 1) fc += `${aParts[0]}anull[a];`;
    else fc += `[${silenceIdx}:a]apad[a];`;
  }

  await ffmpeg(['-y', ...inputs, '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
    '-t', D.toFixed(2), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath], 240_000);
}

export async function composeAdVideo(opts: AdComposeOpts): Promise<AdComposeResult> {
  const warnings: string[] = [];
  const segments = (opts.segments || [])
    .filter((s) => Number.isFinite(s.t0) && Number.isFinite(s.t1) && s.t1 > s.t0 && s.clipPaths?.length)
    .sort((a, b) => a.t0 - b.t0)
    .slice(0, 24);
  if (!segments.length) throw new Error('нет сегментов для сборки');
  const { W, H } = UGC_FORMATS[opts.format || '9x16'] || UGC_FORMATS['9x16'];

  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const jobId = randomUUID().slice(0, 8);
  const tmpDir = path.join(RENDERS_DIR, `adjob-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // 1) посценные сегменты
    const segFiles: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const f = path.join(tmpDir, `seg-${String(i).padStart(2, '0')}.mp4`);
      await renderSegment(segments[i], W, H, f);
      segFiles.push(f);
    }
    const total = segments.reduce((s, x) => s + (Math.min(60, Math.max(0.5, x.t1 - x.t0))), 0);

    // 2) подготовка титров/QR/SFX
    const captions = (opts.captions || []).filter((c) => c.text && c.t1 > c.t0);
    let assPath = '';
    if (captions.length) {
      assPath = path.join(tmpDir, 'captions.ass');
      fs.writeFileSync(assPath, buildUgcAss({ W, H, captions, style: 'plain', pos: opts.capPos || 'top', wish: null }), 'utf8');
    }
    let qrPath = '';
    if (opts.qrText && String(opts.qrText).trim()) {
      const p = path.join(tmpDir, 'qr.png');
      const ok = await makeQrPng(String(opts.qrText).trim(), Math.round(W * 0.24), p);
      if (ok) qrPath = p;
      else warnings.push('QR пропущен: модуль qrcode недоступен на сервере');
    }
    const sfxTimes = (opts.sfxTimes || []).filter((t) => Number.isFinite(t) && t >= 0 && t < total).slice(0, 6);
    let chirpPath = '';
    if (sfxTimes.length) {
      chirpPath = path.join(tmpDir, 'chirp.wav');
      try { await makeChirpWav(chirpPath); } catch { chirpPath = ''; warnings.push('SFX пропущен: не собрался синтетический звук'); }
    }
    const voicePath = opts.voicePath && fs.existsSync(opts.voicePath) ? opts.voicePath : '';
    if (opts.voicePath && !voicePath) warnings.push('дорожка голоса не найдена на диске — собрано без голоса');
    const clipVol = Number.isFinite(opts.clipVolume) ? Math.max(0, Math.min(1, opts.clipVolume as number)) : (voicePath ? 0.25 : 1);

    // 3) финальный проход: конкат → титры → QR → микс аудио
    const inputs: string[] = [];
    segFiles.forEach((f) => inputs.push('-i', f));
    const n = segFiles.length;
    let idx = n;
    const voiceIdx = voicePath ? idx++ : -1;
    if (voicePath) inputs.push('-i', voicePath);
    const chirpIdx = chirpPath && sfxTimes.length ? idx++ : -1;
    if (chirpIdx >= 0) inputs.push('-i', chirpPath);
    const qrIdx = qrPath ? idx++ : -1;
    if (qrPath) inputs.push('-i', qrPath);

    let fc = '';
    for (let i = 0; i < n; i++) fc += `[${i}:v][${i}:a]`;
    fc += `concat=n=${n}:v=1:a=1[vcat][acat];`;
    let vLabel = 'vcat';
    if (assPath) { fc += `[${vLabel}]subtitles=filename='${subFilterPath(assPath)}'[vsub];`; vLabel = 'vsub'; }
    if (qrIdx >= 0) {
      const qrFrom = Number.isFinite(opts.qrFromSec as number) ? Math.max(0, opts.qrFromSec as number) : segments[segments.length - 1].t0 - segments[0].t0;
      fc += `[${vLabel}][${qrIdx}:v]overlay=x=W-w-40:y=H-h-220:enable='gte(t,${qrFrom.toFixed(2)})'[vqr];`;
      vLabel = 'vqr';
    }
    const mixIns: string[] = [];
    fc += `[acat]volume=${clipVol.toFixed(2)}[a0];`; mixIns.push('[a0]');
    if (voiceIdx >= 0) { fc += `[${voiceIdx}:a]aresample=async=1:first_pts=0,aformat=sample_rates=44100:channel_layouts=stereo,apad[av];`; mixIns.push('[av]'); }
    if (chirpIdx >= 0) {
      fc += `[${chirpIdx}:a]asplit=${sfxTimes.length}${sfxTimes.map((_, k) => `[c${k}]`).join('')};`;
      sfxTimes.forEach((t, k) => {
        const ms = Math.round(t * 1000);
        fc += `[c${k}]adelay=${ms}|${ms},apad[cd${k}];`;
        mixIns.push(`[cd${k}]`);
      });
    }
    if (mixIns.length > 1) fc += `${mixIns.join('')}amix=inputs=${mixIns.length}:duration=first:normalize=0[aout]`;
    else fc += `[a0]anull[aout]`;

    const name = `ad-${jobId}.mp4`;
    const outPath = path.join(RENDERS_DIR, name);
    await ffmpeg(['-y', ...inputs, '-filter_complex', fc, '-map', `[${vLabel}]`, '-map', '[aout]',
      '-t', total.toFixed(2), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outPath], 300_000 + n * 60_000);

    return { fileUrl: `/uploads/renders/${name}`, filePath: outPath, duration: total, warnings };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
