/**
 * Склейка двух говорящих голов (HeyGen) в вертикальный сплит-скрин + фоновая музыка.
 *
 * Видео: две головы бок-о-бок в кадре 1080×1920 (каждая вписана в 540×1920, letterbox).
 * Аудио: если есть исходная запись — берём её (правильный тайминг реплик); иначе микс речи
 * обеих голов. Фоновая музыка подмешивается на заданной громкости и обрезается по длине видео.
 * Результат — mp4 в uploads/renders (публичный URL), затем сохраняется в Галерею вызывающим.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import ffmpegStatic from 'ffmpeg-static';

const __d = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__d, '../../../../uploads');
const RENDERS_DIR = path.join(UPLOADS_ROOT, 'renders');
const FFMPEG_BIN: string = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || 'ffmpeg';
const FFPROBE_BIN: string = (process.env.FFMPEG_PATH && process.env.FFMPEG_PATH.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1')) || 'ffprobe';

function ffmpeg(args: string[], timeoutMs = 600_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => { err += d.toString(); });
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } reject(new Error('ffmpeg: таймаут')); }, timeoutMs);
    ff.on('error', (e) => { clearTimeout(timer); reject(new Error(`ffmpeg недоступен: ${e.message}`)); });
    ff.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg код ${code}: ${err.slice(-350)}`)); });
  });
}

/** Длительность медиа (сек) через ffprobe, 0 при ошибке. */
function probeDuration(input: string): Promise<number> {
  return new Promise((resolve) => {
    const ff = spawn(FFPROBE_BIN, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    ff.stdout.on('data', (d) => { out += d.toString(); });
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } resolve(0); }, 30_000);
    ff.on('error', () => { clearTimeout(timer); resolve(0); });
    ff.on('close', () => { clearTimeout(timer); resolve(parseFloat(out.trim()) || 0); });
  });
}

/** Собрать сплит-скрин из двух голов (+ опц. запись как аудио, + опц. фоновая музыка). → fileUrl. */
export async function composeHeads(opts: {
  headA: string; headB: string; audioUrl?: string; musicUrl?: string; musicVolume?: number;
}): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });

  // Целевая длина = длина записи (если задана) иначе длиннейшей головы. Жёстко ограничиваем -t,
  // иначе tpad-клон кадра уводит рендер в бесконечность.
  const [dA, dB, dAudio] = await Promise.all([
    probeDuration(opts.headA), probeDuration(opts.headB), opts.audioUrl ? probeDuration(opts.audioUrl) : Promise.resolve(0),
  ]);
  let target = opts.audioUrl && dAudio > 0.2 ? dAudio : Math.max(dA, dB);
  if (!(target > 0.2)) target = Math.max(dA, dB, dAudio, 3);
  target = Math.min(target, 1800); // потолок 30 мин — защита от патологии
  const T = target.toFixed(2);

  const inputs: string[] = ['-i', opts.headA, '-i', opts.headB];
  let idx = 2;
  let audioIdx = -1; let musicIdx = -1;
  if (opts.audioUrl) { inputs.push('-i', opts.audioUrl); audioIdx = idx++; }
  if (opts.musicUrl) { inputs.push('-i', opts.musicUrl); musicIdx = idx++; }
  const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolume) ? (opts.musicVolume as number) : 20) / 100));

  const HALF = 540; const H = 1920;
  // tpad клонирует последний кадр до target — короткая голова не исчезает, обе видны всю длину.
  const pad = `scale=${HALF}:${H}:force_original_aspect_ratio=decrease,pad=${HALF}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${T}`;
  let fc = `[0:v]${pad}[la];[1:v]${pad}[lb];[la][lb]hstack=inputs=2[v];`;

  // Речь: исходная запись (правильный тайминг) или микс аудио обеих голов.
  let speechLabel: string;
  if (audioIdx >= 0) { fc += `[${audioIdx}:a]aresample=async=1[sp];`; speechLabel = '[sp]'; }
  else { fc += `[0:a][1:a]amix=inputs=2:duration=longest[sp];`; speechLabel = '[sp]'; }

  let mapAudio: string;
  if (musicIdx >= 0) {
    // музыка на громкости + обрезка по длине видео (duration=first = речь)
    fc += `[${musicIdx}:a]volume=${vol.toFixed(2)}[bg];${speechLabel}[bg]amix=inputs=2:duration=first:dropout_transition=0[aout];`;
    mapAudio = '[aout]';
  } else {
    mapAudio = speechLabel;
  }

  const out = `podfinal-${randomUUID().slice(0, 8)}.mp4`;
  const outPath = path.join(RENDERS_DIR, out);
  await ffmpeg([
    '-y', ...inputs, '-filter_complex', fc,
    '-map', '[v]', '-map', mapAudio, '-t', T,
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', outPath,
  ]);
  return `/uploads/renders/${out}`;
}

/** Собрать ролик: две ЗЕЛЁНЫЕ головы (chroma-key) поверх ФОТО СТУДИИ (оба ведущих на фоне студии).
 *  Каждая голова — talking_photo, снятый на зелёном (человек вырезан Nano ДО HeyGen). → fileUrl. */
export async function composeOnStudio(opts: {
  studioUrl: string; headA: string; headB: string;
  audioUrl?: string; musicUrl?: string; musicVolume?: number; chromaColor?: string;
}): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const [dA, dB, dAudio] = await Promise.all([
    probeDuration(opts.headA), probeDuration(opts.headB), opts.audioUrl ? probeDuration(opts.audioUrl) : Promise.resolve(0),
  ]);
  let target = opts.audioUrl && dAudio > 0.2 ? dAudio : Math.max(dA, dB);
  if (!(target > 0.2)) target = Math.max(dA, dB, dAudio, 3);
  target = Math.min(target, 1800);
  const T = target.toFixed(2);
  const key = opts.chromaColor || '0x00FF00';

  const inputs: string[] = ['-loop', '1', '-i', opts.studioUrl, '-i', opts.headA, '-i', opts.headB];
  let idx = 3; let audioIdx = -1; let musicIdx = -1;
  if (opts.audioUrl) { inputs.push('-i', opts.audioUrl); audioIdx = idx++; }
  if (opts.musicUrl) { inputs.push('-i', opts.musicUrl); musicIdx = idx++; }
  const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolume) ? (opts.musicVolume as number) : 20) / 100));

  const W = 1080, H = 1920, PW = 620; // фон 1080×1920, каждая вырезанная голова ~620 шириной
  // Фон-студия (картинка, loop), обрезка в кадр 9:16.
  const bg = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30[bg];`;
  // Chroma-key зелёнки + despill (уводим зелёный из краёв), масштаб, tpad-клон до T.
  const keyf = (i: number, label: string) =>
    `[${i}:v]chromakey=${key}:0.30:0.12,despill=type=green:mix=0.5:expand=0,scale=${PW}:-1:force_original_aspect_ratio=decrease,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${T}[${label}];`;
  let fc = bg + keyf(1, 'ka') + keyf(2, 'kb');
  // A — низ-лево, B — низ-право (сидят на фоне студии).
  fc += `[bg][ka]overlay=x=-40:y=H-h:shortest=0[b1];[b1][kb]overlay=x=W-w+40:y=H-h:shortest=0[v];`;

  let speechLabel: string;
  if (audioIdx >= 0) { fc += `[${audioIdx}:a]aresample=async=1[sp];`; speechLabel = '[sp]'; }
  else { fc += `[1:a][2:a]amix=inputs=2:duration=longest[sp];`; speechLabel = '[sp]'; }
  let mapAudio: string;
  if (musicIdx >= 0) {
    fc += `[${musicIdx}:a]volume=${vol.toFixed(2)}[bgm];${speechLabel}[bgm]amix=inputs=2:duration=first:dropout_transition=0[aout];`;
    mapAudio = '[aout]';
  } else { mapAudio = speechLabel; }

  const out = `podstudio-${randomUUID().slice(0, 8)}.mp4`;
  const outPath = path.join(RENDERS_DIR, out);
  await ffmpeg([
    '-y', ...inputs, '-filter_complex', fc,
    '-map', '[v]', '-map', mapAudio, '-t', T,
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', outPath,
  ]);
  return `/uploads/renders/${out}`;
}

/** Скачать видео по URL в uploads/renders (для сохранения головы HeyGen в Галерею). → fileUrl. */
export async function downloadToRenders(url: string, prefix = 'podhead'): Promise<{ fileUrl: string; filePath: string; size: number }> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`видео не скачалось (HTTP ${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  const name = `${prefix}-${randomUUID().slice(0, 8)}.mp4`;
  const filePath = path.join(RENDERS_DIR, name);
  fs.writeFileSync(filePath, buf);
  return { fileUrl: `/uploads/renders/${name}`, filePath, size: buf.length };
}
