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

/** Собрать сплит-скрин из двух голов (+ опц. запись как аудио, + опц. фоновая музыка). → fileUrl. */
export async function composeHeads(opts: {
  headA: string; headB: string; audioUrl?: string; musicUrl?: string; musicVolume?: number;
}): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const inputs: string[] = ['-i', opts.headA, '-i', opts.headB];
  let idx = 2;
  let audioIdx = -1; let musicIdx = -1;
  if (opts.audioUrl) { inputs.push('-i', opts.audioUrl); audioIdx = idx++; }
  if (opts.musicUrl) { inputs.push('-i', opts.musicUrl); musicIdx = idx++; }
  const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolume) ? (opts.musicVolume as number) : 20) / 100));

  const HALF = 540; const H = 1920;
  // tpad клонирует последний кадр — короткая голова не исчезает, обе видны на всю длину звука.
  const pad = `scale=${HALF}:${H}:force_original_aspect_ratio=decrease,pad=${HALF}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=3600`;
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
    '-map', '[v]', '-map', mapAudio,
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-shortest', outPath,
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
