/**
 * СТОРИБОРД — программный движок монтажа (ffmpeg на бэкенде, паттерн video_edit).
 *
 * Всё видео приводится к рабочей копии 1080×1920@30 (work.mp4), дальше каждый
 * кусок рендерится ПО ПАНЕЛЯМ: спикер (наезд zoompan), титр (подложка+drawtext),
 * врезка (картинка cover+кен-бёрнс), сплит (vstack видео+картинка), мокап
 * (картинка на подложке), финал (спикер+CTA-плашка). Панели склеиваются в кусок,
 * поверх возвращается ОРИГИНАЛЬНЫЙ звук куска; куски склеиваются в ролик с
 * бейджем и (опц.) субтитрами. Титры рисуются drawtext'ом — текст не «плывёт»,
 * как у генеративных движков.
 *
 * Деградация мягкая: нет шрифта → панели с текстом рендерятся как «спикер»;
 * нет картинки → врезка/сплит/мокап рендерятся из видео с другим наездом.
 */

import { spawn } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import ffmpegStatic from 'ffmpeg-static';
import type { SbChunk, SbPanel, SbTranscriptSeg } from './types.js';
import { PANEL_LABEL_RU } from './types.js';

const FFMPEG_BIN: string = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || 'ffmpeg';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
// src/modules/storyboard → apps/uploads (та же база, что у статики /uploads в server.ts)
export const UPLOADS_ROOT = path.resolve(__dirname_local, '../../../../uploads');
export const SB_ROOT = path.join(UPLOADS_ROOT, 'storyboard');
try { fs.mkdirSync(SB_ROOT, { recursive: true }); } catch { /* best-effort */ }

/** Каталог проекта сториборда (uploads/storyboard/<id>). */
export function sbDir(sbId: string): string {
  const dir = path.join(SB_ROOT, sbId);
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* best-effort */ }
  return dir;
}

/** abs-путь → /uploads/... URL (для фронта). */
export function toUploadsUrl(absPath: string): string {
  const rel = path.relative(UPLOADS_ROOT, absPath).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

/** /uploads/... → абсолютный путь (с защитой от выхода за uploads).
 *  Хвост ?v=… (cache-buster превью) отбрасывается — на диске его нет. */
export function fromUploadsUrl(fileUrl: string): string | null {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return null;
  const clean = fileUrl.split(/[?#]/)[0];
  const abs = path.resolve(UPLOADS_ROOT, clean.slice('/uploads/'.length));
  if (abs !== UPLOADS_ROOT && !abs.startsWith(UPLOADS_ROOT + path.sep)) return null;
  return abs;
}

/** Запуск ffmpeg с массивом аргументов (реджект — хвост stderr). */
export function runFfmpeg(args: string[], timeoutMs = 300_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch {} reject(new Error('ffmpeg: таймаут')); }, timeoutMs);
    ff.stderr?.on('data', (d) => { if (err.length < 6000) err += String(d); });
    ff.on('error', (e) => { clearTimeout(timer); reject(new Error(`ffmpeg недоступен (${FFMPEG_BIN}): ${e.message}`)); });
    ff.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg код ${code}: ${err.slice(-500)}`)); });
  });
}

/** Длительность файла, сек — парсим stderr `ffmpeg -i` (без ffprobe: его нет в ffmpeg-static). */
export function probeDuration(file: string): Promise<number | null> {
  return new Promise((resolve) => {
    const ff = spawn(FFMPEG_BIN, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch {} resolve(null); }, 20_000);
    ff.stderr?.on('data', (d) => { if (err.length < 20000) err += String(d); });
    ff.on('error', () => { clearTimeout(timer); resolve(null); });
    ff.on('close', () => {
      clearTimeout(timer);
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) return resolve(null);
      resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
    });
  });
}

// ── шрифт для drawtext ────────────────────────────────────────────────────────
const FONT_CANDIDATES = [
  process.env.FFMPEG_FONT || '',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  'C:\\Windows\\Fonts\\arialbd.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
].filter(Boolean);

export function findFont(): string | null {
  for (const f of FONT_CANDIDATES) { try { if (fs.existsSync(f)) return f; } catch { /* дальше */ } }
  return null;
}

/** Путь для фильтров ffmpeg: прямые слэши + экранированное двоеточие (Windows-dev). */
function ffPath(p: string): string {
  return p.split(path.sep).join('/').replace(/:/g, '\\:');
}

/** Перенос строк для титров (drawtext не умеет word-wrap). */
export function wrapText(text: string, maxChars = 16, maxLines = 5): string {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.join('\n');
}

/** Временный textfile для drawtext (UTF-8, кириллица ок). */
function writeTextFile(dir: string, text: string): string {
  const p = path.join(dir, `txt-${randomUUID()}.txt`);
  fs.writeFileSync(p, text, 'utf8');
  return p;
}

export interface StyleColors { bg: string; fg: string; accent: string }

/** Цвета стиль-пресетов (подложки титров/мокапов). */
export function styleColors(style?: string): StyleColors {
  switch (style) {
    case 'neon':     return { bg: '0x0a0018', fg: 'white', accent: '0x22d3ee' };
    case 'paper':    return { bg: '0xf5f0e6', fg: '0x1a1a1a', accent: '0xd97706' };
    case 'terminal': return { bg: '0x02120a', fg: '0x34d399', accent: '0x34d399' };
    case 'bold':     return { bg: '0x18040a', fg: 'white', accent: '0xfb7185' };
    default:         return { bg: '0x0b0e1a', fg: 'white', accent: '0x818cf8' };
  }
}

const OUT_V = ['-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an'];

/** drawtext-блок по центру (титры). */
function drawTitle(textFile: string, font: string, fg: string, size = 76): string {
  return `drawtext=textfile='${ffPath(textFile)}':fontfile='${ffPath(font)}':fontsize=${size}:fontcolor=${fg}`
    + `:line_spacing=20:x=(w-text_w)/2:y=(h-text_h)/2`;
}

/** drawtext-плашка снизу (CTA финала). */
function drawCta(textFile: string, font: string): string {
  return `drawtext=textfile='${ffPath(textFile)}':fontfile='${ffPath(font)}':fontsize=58:fontcolor=white`
    + `:line_spacing=14:box=1:boxcolor=black@0.45:boxborderw=26:x=(w-text_w)/2:y=h-h/4-text_h/2`;
}

/** Медленный наезд на видео (панель «спикер» и фолбэки). */
function zoomFilter(startZoom = 1.0, rate = 0.0011, cap = 1.22): string {
  return `zoompan=z='min(${startZoom}+${rate}*on,${cap})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30`;
}

/**
 * Рендер ОДНОЙ панели куска → mp4 без звука (1080×1920@30).
 * work — нормализованная рабочая копия; chunkStart — секунда начала куска в work.
 */
export async function renderPanel(
  work: string, chunkStart: number, p: SbPanel, outPath: string,
  opts: { font: string | null; colors: StyleColors; dir: string; isLastChunk?: boolean }
): Promise<void> {
  const dur = Math.max(0.3, p.end - p.start);
  const absStart = Math.max(0, chunkStart + p.start);
  const D = dur.toFixed(3);
  const vidIn = ['-ss', absStart.toFixed(3), '-t', D, '-i', work];
  const { font, colors } = opts;
  const img = p.imageUrl ? fromUploadsUrl(p.imageUrl) : null;
  const imgOk = img && fs.existsSync(img);

  const coverImg = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1`;

  switch (imgOk || font ? p.type : 'speaker') {
    case 'title': {
      if (!font) break; // ниже — фолбэк «спикер»
      const tf = writeTextFile(opts.dir, wrapText(p.text || '', 14, 6));
      if (imgOk) {
        // титр на картинке-фоне (гибрид): кен-бёрнс + затемнение, чтобы текст читался
        await runFfmpeg(['-y', '-loglevel', 'error',
          '-loop', '1', '-framerate', '30', '-t', D, '-i', img!,
          '-vf', `${coverImg},${zoomFilter(1.0, 0.0012, 1.18)},`
            + `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.45:t=fill,${drawTitle(tf, font, 'white')},format=yuv420p`,
          ...OUT_V, '-t', D, outPath]);
        return;
      }
      await runFfmpeg(['-y', '-loglevel', 'error',
        '-f', 'lavfi', '-t', D, '-i', `color=c=${colors.bg}:s=1080x1920:r=30`,
        '-vf', `drawbox=x=80:y=h/2-260:w=14:h=520:color=${colors.accent}@0.9:t=fill,${drawTitle(tf, font, colors.fg)}`,
        ...OUT_V, '-t', D, outPath]);
      return;
    }
    case 'cutaway': {
      if (!imgOk) { // из видео, но с более сильным наездом (визуально другой план)
        await runFfmpeg(['-y', '-loglevel', 'error', ...vidIn,
          '-vf', zoomFilter(1.14, 0.0013, 1.38), ...OUT_V, '-t', D, outPath]);
        return;
      }
      await runFfmpeg(['-y', '-loglevel', 'error',
        '-loop', '1', '-framerate', '30', '-t', D, '-i', img!,
        '-vf', `${coverImg},${zoomFilter(1.0, 0.0012, 1.18)},format=yuv420p`,
        ...OUT_V, '-t', D, outPath]);
      return;
    }
    case 'split': {
      const top = `[0:v]crop=1080:960:0:480,setsar=1[top]`;
      if (imgOk) {
        await runFfmpeg(['-y', '-loglevel', 'error', ...vidIn,
          '-loop', '1', '-framerate', '30', '-t', D, '-i', img!,
          '-filter_complex', `${top};[1:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,setsar=1[bot];[top][bot]vstack=inputs=2,fps=30,format=yuv420p[v]`,
          '-map', '[v]', ...OUT_V, '-t', D, outPath]);
        return;
      }
      if (font) {
        const tf = writeTextFile(opts.dir, wrapText(p.text || '', 18, 4));
        await runFfmpeg(['-y', '-loglevel', 'error', ...vidIn,
          '-f', 'lavfi', '-t', D, '-i', `color=c=${colors.bg}:s=1080x960:r=30`,
          '-filter_complex', `${top};[1:v]drawtext=textfile='${ffPath(tf)}':fontfile='${ffPath(font)}':fontsize=54:fontcolor=${colors.fg}:line_spacing=14:x=(w-text_w)/2:y=(h-text_h)/2[bot];[top][bot]vstack=inputs=2,fps=30,format=yuv420p[v]`,
          '-map', '[v]', ...OUT_V, '-t', D, outPath]);
        return;
      }
      break; // фолбэк «спикер»
    }
    case 'mockup': {
      if (!imgOk) break; // фолбэк «спикер»
      await runFfmpeg(['-y', '-loglevel', 'error',
        '-f', 'lavfi', '-t', D, '-i', `color=c=${colors.bg}:s=1080x1920:r=30`,
        '-loop', '1', '-framerate', '30', '-t', D, '-i', img!,
        '-filter_complex', `[1:v]scale=920:1560:force_original_aspect_ratio=decrease,pad=iw+20:ih+20:10:10:color=white@0.92[m];[0:v][m]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p[v]`,
        '-map', '[v]', ...OUT_V, '-t', D, outPath]);
      return;
    }
    case 'final': {
      if (!font) break;
      const tf = writeTextFile(opts.dir, wrapText(p.text || 'Подпишись — дальше больше', 18, 4));
      await runFfmpeg(['-y', '-loglevel', 'error', ...vidIn,
        '-vf', `${zoomFilter(1.0, 0.0009, 1.16)},${drawCta(tf, font)}`,
        ...OUT_V, '-t', D, outPath]);
      return;
    }
  }
  // «Спикер» и все фолбэки: живое видео с медленным наездом.
  await runFfmpeg(['-y', '-loglevel', 'error', ...vidIn,
    '-vf', zoomFilter(1.0, 0.0011, 1.22), ...OUT_V, '-t', D, outPath]);
}

/** Склейка файлов concat-демуксером (copy; фолбэк — перекод). */
async function concatFiles(parts: string[], out: string, reencodeAudio = false): Promise<void> {
  const listPath = path.join(path.dirname(out), `concat-${randomUUID()}.txt`);
  fs.writeFileSync(listPath, parts.map((p) => `file '${p.split(path.sep).join('/').replace(/'/g, "'\\''")}'`).join('\n'));
  const base = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listPath];
  try {
    await runFfmpeg([...base, '-c', 'copy', '-movflags', '+faststart', out]);
  } catch {
    await runFfmpeg([...base, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      ...(reencodeAudio ? ['-c:a', 'aac'] : ['-an']), '-movflags', '+faststart', out], 900_000);
  } finally {
    try { fs.unlinkSync(listPath); } catch {}
  }
}

/**
 * Нормализация исходника → work.mp4 (1080×1920@30, yuv420p, AAC 44.1k stereo).
 * Горизонтальное видео НЕ кропаем — паддинг чёрным (v1).
 */
export async function normalizeSource(input: string, out: string): Promise<void> {
  const vf = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p';
  try {
    await runFfmpeg(['-y', '-loglevel', 'error', '-i', input, '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-c:a', 'aac', '-ar', '44100', '-ac', '2', '-movflags', '+faststart', out], 900_000);
  } catch {
    // клип без аудиодорожки (или битый звук) — рабочая копия без звука
    await runFfmpeg(['-y', '-loglevel', 'error', '-i', input, '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an', '-movflags', '+faststart', out], 900_000);
  }
}

/**
 * Рендер куска: панели → склейка видео → поверх ОРИГИНАЛЬНЫЙ звук куска.
 * Возвращает абсолютный путь chunk-<idx>.mp4.
 */
export async function renderChunkProgram(
  work: string, chunk: SbChunk, dir: string,
  opts: { style?: string; isLastChunk?: boolean }
): Promise<string> {
  const font = findFont();
  const colors = styleColors(opts.style);
  const D = Math.max(0.5, chunk.end - chunk.start);
  const tmp: string[] = [];
  const outPath = path.join(dir, `chunk-${chunk.idx}.mp4`);
  try {
    const parts: string[] = [];
    for (let i = 0; i < chunk.panels.length; i++) {
      const part = path.join(dir, `part-${chunk.idx}-${i}-${randomUUID().slice(0, 8)}.mp4`);
      tmp.push(part);
      await renderPanel(work, chunk.start, chunk.panels[i], part, { font, colors, dir, isLastChunk: opts.isLastChunk });
      parts.push(part);
    }
    const videoOnly = path.join(dir, `video-${chunk.idx}-${randomUUID().slice(0, 8)}.mp4`);
    tmp.push(videoOnly);
    await concatFiles(parts, videoOnly);

    // поверх — оригинальный звук куска (речь сохраняется)
    await muxChunkAudio(videoOnly, work, chunk, outPath, dir);
    return outPath;
  } finally {
    for (const p of tmp) { try { fs.unlinkSync(p); } catch {} }
  }
}

/** .srt из транскрипта (для прожига субтитров). */
export function makeSrt(segs: SbTranscriptSeg[]): string {
  const fmt = (s: number) => {
    const ms = Math.max(0, Math.round(s * 1000));
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    const sec = Math.floor((ms % 60000) / 1000), rest = ms % 1000;
    const p = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${p(h)}:${p(m)}:${p(sec)},${String(rest).padStart(3, '0')}`;
  };
  return segs.map((s, i) => `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`).join('\n');
}

/**
 * Финальная сборка: склейка кусков → бейдж (drawtext) + опц. субтитры (один перекод).
 */
export async function assembleFinal(
  chunkFiles: string[], outPath: string, dir: string,
  opts: { badgeText?: string; subtitles?: SbTranscriptSeg[]; chunkOffsets?: number[] }
): Promise<void> {
  const joined = path.join(dir, `joined-${randomUUID().slice(0, 8)}.mp4`);
  await concatFiles(chunkFiles, joined, true);
  const font = findFont();
  const filters: string[] = [];

  if (opts.subtitles && opts.subtitles.length) {
    // Пересчёт таймкодов: куски могли идти не подряд → офсеты начала кусков в готовом ролике
    const srtPath = path.join(dir, `subs-${randomUUID().slice(0, 8)}.srt`);
    fs.writeFileSync(srtPath, makeSrt(opts.subtitles), 'utf8');
    filters.push(`subtitles='${ffPath(srtPath)}':force_style='FontSize=15,Outline=1,MarginV=60'`);
  }
  if (opts.badgeText && font) {
    const tf = writeTextFile(dir, String(opts.badgeText).slice(0, 40));
    filters.push(`drawtext=textfile='${ffPath(tf)}':fontfile='${ffPath(font)}':fontsize=34:fontcolor=white@0.9`
      + `:box=1:boxcolor=black@0.35:boxborderw=14:x=w-text_w-44:y=h-text_h-52`);
  }

  if (!filters.length) {
    fs.copyFileSync(joined, outPath);
    try { fs.unlinkSync(joined); } catch {}
    return;
  }
  try {
    await runFfmpeg(['-y', '-loglevel', 'error', '-i', joined, '-vf', filters.join(','),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'copy', '-movflags', '+faststart', outPath], 900_000);
  } catch {
    // субтитры могли не прожечься (нет libass) — пробуем только бейдж, затем чистую склейку
    const df = filters.filter((f) => f.startsWith('drawtext'));
    if (df.length) {
      try {
        await runFfmpeg(['-y', '-loglevel', 'error', '-i', joined, '-vf', df.join(','),
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'copy', '-movflags', '+faststart', outPath], 900_000);
        try { fs.unlinkSync(joined); } catch {}
        return;
      } catch { /* ниже — чистая склейка */ }
    }
    fs.copyFileSync(joined, outPath);
  }
  try { fs.unlinkSync(joined); } catch {}
}

/** Полноразмерный jpg-кадр 1080×1920 (стартовый кадр для Omni image-to-video). */
export async function extractFrameFull(work: string, ts: number, out: string): Promise<void> {
  await runFfmpeg(['-y', '-loglevel', 'error', '-ss', Math.max(0, ts).toFixed(3), '-i', work,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-frames:v', '1', '-q:v', '3', out], 60_000);
}

/** Точная вырезка куска из work (перекод, со звуком) — исходник для Flow/референсов. */
export async function cutChunkExact(work: string, chunk: SbChunk, out: string): Promise<void> {
  const D = Math.max(0.5, chunk.end - chunk.start);
  try {
    await runFfmpeg(['-y', '-loglevel', 'error', '-ss', chunk.start.toFixed(3), '-t', D.toFixed(3), '-i', work,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart', out], 300_000);
  } catch {
    await runFfmpeg(['-y', '-loglevel', 'error', '-ss', chunk.start.toFixed(3), '-t', D.toFixed(3), '-i', work,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an', '-movflags', '+faststart', out], 300_000);
  }
}

/** Привести произвольный клип к формату куска: 1080×1920@30, длительность ровно D, без звука. */
export async function fitClipToChunk(input: string, durSec: number, out: string): Promise<void> {
  const vf = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p';
  await runFfmpeg(['-y', '-loglevel', 'error', '-i', input, '-t', durSec.toFixed(3),
    '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-an', '-movflags', '+faststart', out], 600_000);
}

/** Поверх видео-дорожки куска — ОРИГИНАЛЬНЫЙ звук этого куска из work (речь сохраняется). */
export async function muxChunkAudio(videoOnly: string, work: string, chunk: SbChunk, outPath: string, dir: string): Promise<void> {
  const D = Math.max(0.5, chunk.end - chunk.start);
  const audio = path.join(dir, `audio-${chunk.idx}-${randomUUID().slice(0, 8)}.m4a`);
  let hasAudio = true;
  try {
    await runFfmpeg(['-y', '-loglevel', 'error', '-ss', chunk.start.toFixed(3), '-t', D.toFixed(3),
      '-i', work, '-vn', '-c:a', 'aac', '-b:a', '160k', audio]);
  } catch { hasAudio = false; }
  try {
    if (hasAudio) {
      await runFfmpeg(['-y', '-loglevel', 'error', '-i', videoOnly, '-i', audio,
        '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-shortest', '-movflags', '+faststart', outPath]);
    } else {
      fs.copyFileSync(videoOnly, outPath);
    }
  } finally {
    try { fs.unlinkSync(audio); } catch {}
  }
}

/** Jpg-кадр превью панели 270×480 (для карточек студии; input-seek — быстро). */
export async function extractPanelFrame(work: string, ts: number, out: string): Promise<void> {
  await runFfmpeg(['-y', '-loglevel', 'error', '-ss', Math.max(0, ts).toFixed(3), '-i', work,
    '-vf', 'scale=270:480:force_original_aspect_ratio=increase,crop=270:480',
    '-frames:v', '1', '-q:v', '4', out], 60_000);
}

/**
 * Филмстрип куска: горизонтальный спрайт кадров (~каждые 0.7с, 6–16 кадров,
 * ячейка 90×160). Один jpg — фронт кликом по X переводит позицию в секунду.
 */
export async function buildFilmstrip(work: string, chunk: SbChunk, out: string): Promise<number> {
  const D = Math.max(0.5, chunk.end - chunk.start);
  const n = Math.max(6, Math.min(16, Math.round(D / 0.7)));
  const fps = n / D;
  await runFfmpeg(['-y', '-loglevel', 'error', '-ss', chunk.start.toFixed(3), '-t', D.toFixed(3), '-i', work,
    '-vf', `fps=${fps.toFixed(4)},scale=90:160:force_original_aspect_ratio=increase,crop=90:160,tile=${n}x1`,
    '-frames:v', '1', '-q:v', '5', out], 90_000);
  return n;
}

/** Кадр 450×800 из work (или картинки панели) + подпись типа → png. */
async function panelFramePng(
  work: string, p: SbPanel, idx: number, dir: string, font: string | null, chunkStart: number
): Promise<string> {
  const out = path.join(dir, `f-${idx}-${randomUUID().slice(0, 8)}.png`);
  const label = `${idx + 1} · ${PANEL_LABEL_RU[p.type] || p.type}`;
  const lbl = font
    ? `,drawtext=text='${label.replace(/[\\':]/g, ' ')}':fontfile='${ffPath(font)}':fontsize=28:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=10:x=12:y=h-th-12`
    : '';
  const img = p.imageUrl ? fromUploadsUrl(p.imageUrl) : null;
  if (img && fs.existsSync(img)) {
    await runFfmpeg(['-y', '-loglevel', 'error', '-i', img,
      '-vf', `scale=450:800:force_original_aspect_ratio=increase,crop=450:800${lbl}`, '-frames:v', '1', out]);
    return out;
  }
  const ts = Math.max(0, p.frameTs != null ? p.frameTs : chunkStart + (p.start + p.end) / 2);
  await runFfmpeg(['-y', '-loglevel', 'error', '-ss', ts.toFixed(3), '-i', work,
    '-vf', `scale=450:800:force_original_aspect_ratio=increase,crop=450:800${lbl}`, '-frames:v', '1', out]);
  return out;
}

/** PNG-сетка сториборда куска (2 колонки × N строк, ячейка 450×800). */
export async function buildChunkPng(work: string, chunk: SbChunk, dir: string): Promise<string> {
  const font = findFont();
  const n = Math.min(8, Math.max(1, chunk.panels.length));
  const frames: string[] = [];
  try {
    for (let i = 0; i < n; i++) frames.push(await panelFramePng(work, chunk.panels[i], i, dir, font, chunk.start));
    const cells = [...frames];
    if (cells.length % 2 === 1) {
      const filler = path.join(dir, `fill-${randomUUID().slice(0, 8)}.png`);
      await runFfmpeg(['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x11131f:s=450x800', '-frames:v', '1', filler]);
      cells.push(filler);
      frames.push(filler);
    }
    const rows = cells.length / 2;
    const layout = cells.map((_, i) => `${(i % 2) * 450}_${Math.floor(i / 2) * 800}`).join('|');
    const ins: string[] = [];
    cells.forEach((f) => ins.push('-i', f));
    const out = path.join(dir, `sb-${chunk.idx}.png`);
    await runFfmpeg(['-y', '-loglevel', 'error', ...ins,
      '-filter_complex', `xstack=inputs=${cells.length}:layout=${layout}[v]`, '-map', '[v]', '-frames:v', '1', out]);
    return out;
  } finally {
    for (const f of frames) { try { fs.unlinkSync(f); } catch {} }
  }
}
