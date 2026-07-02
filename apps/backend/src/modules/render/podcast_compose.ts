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
  // normalize=0: дефолтный amix делит громкость каждого входа на их число — речь играла на 50%
  else { fc += `[0:a][1:a]amix=inputs=2:normalize=0:duration=longest[sp];`; speechLabel = '[sp]'; }

  let mapAudio: string;
  if (musicIdx >= 0) {
    // музыка на громкости + обрезка по длине видео (duration=first = речь)
    fc += `[${musicIdx}:a]volume=${vol.toFixed(2)}[bg];${speechLabel}[bg]amix=inputs=2:normalize=0:duration=first:dropout_transition=0[aout];`;
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

/** Кадрировать картинку в 9:16 (1080×1920, центральная область — ТА ЖЕ, что берёт фон при
 *  scale=increase+crop). Нужен для вырезок ведущих: тогда «вырезка» и «clean plate» — один и
 *  тот же кадр, и оверлей 0:0 сажает аватара ровно на его место. PNG — без jpeg-артефактов
 *  по краям зелёнки (важно для chromakey). → fileUrl. */
export async function cropImageTo916(input: string): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const out = `podcut-${randomUUID().slice(0, 8)}.png`;
  const outPath = path.join(RENDERS_DIR, out);
  await ffmpeg([
    '-y', '-i', input,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1',
    '-frames:v', '1', outPath,
  ], 120_000);
  return `/uploads/renders/${out}`;
}

/** Прямоугольник в долях кадра (0..1). */
export interface NormRect { x: number; y: number; w: number; h: number }

/** Размеры картинки/видео (px) через ffprobe; null при ошибке. Понимает и http(s)-URL. */
export function probeImageSize(input: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const ff = spawn(FFPROBE_BIN, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', input], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    ff.stdout.on('data', (d) => { out += d.toString(); });
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } resolve(null); }, 30_000);
    ff.on('error', () => { clearTimeout(timer); resolve(null); });
    ff.on('close', () => {
      clearTimeout(timer);
      const m = out.trim().match(/^(\d+)x(\d+)/);
      resolve(m ? { w: Number(m[1]), h: Number(m[2]) } : null);
    });
  });
}

/** Вырезать из картинки ОКНО (прямоугольник в долях кадра, строится 9:16 вокруг ведущего)
 *  → 1080×1920 PNG. Именно это окно едет в HeyGen: ведущий в нём крупный (лицо детектится),
 *  а его координаты в исходном кадре знаем — при склейке сажаем окно обратно на место. */
export async function cropImageToRect(input: string, r: NormRect): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const out = `podwin-${randomUUID().slice(0, 8)}.png`;
  const outPath = path.join(RENDERS_DIR, out);
  const vf = `crop=floor(iw*${r.w.toFixed(5)}/2)*2:floor(ih*${r.h.toFixed(5)}/2)*2:iw*${r.x.toFixed(5)}:ih*${r.y.toFixed(5)},`
    + 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1';
  await ffmpeg(['-y', '-i', input, '-vf', vf, '-frames:v', '1', outPath], 120_000);
  return `/uploads/renders/${out}`;
}

/** Доля «зелёных» пикселей картинки (0..1) или null при ошибке. Gemini иногда игнорирует
 *  инструкцию хромакея и возвращает кадр со студийным фоном — такой нельзя пускать в HeyGen:
 *  chromakey потом нечего убирать, и ведущий вклеивается прямоугольником со своим фоном. */
export function greenBgRatio(input: string): Promise<number | null> {
  return new Promise((resolve) => {
    const ff = spawn(FFMPEG_BIN, ['-v', 'error', '-i', input, '-vf', 'scale=64:64', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    ff.stdout.on('data', (d) => { chunks.push(d as Buffer); });
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } resolve(null); }, 60_000);
    ff.on('error', () => { clearTimeout(timer); resolve(null); });
    ff.on('close', () => {
      clearTimeout(timer);
      const buf = Buffer.concat(chunks);
      const n = 64 * 64;
      if (buf.length < n * 3) return resolve(null);
      let green = 0;
      for (let i = 0; i < n; i++) {
        const r = buf[i * 3]; const g = buf[i * 3 + 1]; const b = buf[i * 3 + 2];
        if (g > 100 && g > r * 1.6 && g > b * 1.6) green++;
      }
      resolve(green / n);
    });
  });
}

/** Медиа реплики поверх студийной сцены: показывается в свой интервал таймлайна. */
export interface StudioOverlay { url: string; tStart: number; dur: number; video?: boolean }

/** Собрать ролик «на студии»: зелёные головы (chroma-key) поверх clean plate.
 *  ПРИНЦИП (решение юзера): аспект ВЫХОДА = аспект исходного фото студии — 16:9 фото →
 *  ролик 1920×1080, 9:16 → 1080×1920, ~квадрат → 1080×1080. Вырезка ведущего сохраняет
 *  композицию ПОЛНОГО кадра, поэтому фон и головы кладутся во весь кадр (оверлей 0:0) —
 *  никакой координатной математики/пере-кадрирования. headB опционален: одна рамка в
 *  «студии лиц» = соло-режим с одним ведущим. overlays — медиа реплик по таймкодам. → fileUrl. */
export async function composeOnStudio(opts: {
  studioUrl: string; headA: string; headB?: string | null;
  audioUrl?: string; musicUrl?: string; musicVolume?: number; chromaColor?: string;
  overlays?: StudioOverlay[];
  // легаси-поля старого API — игнорируются (совместимость)
  fullFrame?: boolean; placeA?: NormRect | null; placeB?: NormRect | null;
  focusA?: NormRect | null; focusB?: NormRect | null;
}): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const heads = [opts.headA, opts.headB].filter((h): h is string => typeof h === 'string' && !!h);
  const durs = await Promise.all([
    ...heads.map((h) => probeDuration(h)),
    opts.audioUrl ? probeDuration(opts.audioUrl) : Promise.resolve(0),
  ]);
  const dAudio = durs[durs.length - 1];
  const headDur = Math.max(...durs.slice(0, heads.length));
  let target = opts.audioUrl && dAudio > 0.2 ? dAudio : headDur;
  if (!(target > 0.2)) target = Math.max(headDur, dAudio, 3);
  target = Math.min(target, 1800);
  const T = target.toFixed(2);
  const key = opts.chromaColor || '0x00FF00';
  const ovs = (opts.overlays || [])
    .filter((o) => o && typeof o.url === 'string' && o.url && Number.isFinite(o.tStart) && Number.isFinite(o.dur) && o.dur > 0.1)
    .slice(0, 12);

  // Канвас = аспект фото студии (однотипный, предсказуемый размер выхода).
  const size = await probeImageSize(opts.studioUrl);
  const ar = size && size.h > 0 ? size.w / size.h : 9 / 16;
  const [W, H] = ar >= 1.2 ? [1920, 1080] : ar <= 0.83 ? [1080, 1920] : [1080, 1080];

  const inputs: string[] = ['-loop', '1', '-i', opts.studioUrl];
  for (const h of heads) inputs.push('-i', h);
  let idx = 1 + heads.length; let audioIdx = -1; let musicIdx = -1;
  if (opts.audioUrl) { inputs.push('-i', opts.audioUrl); audioIdx = idx++; }
  if (opts.musicUrl) { inputs.push('-i', opts.musicUrl); musicIdx = idx++; }
  const ovStart = idx;
  for (const o of ovs) {
    // видео нельзя подавать с -loop (опция image2-демаксера); картинку зацикливаем
    if (o.video) inputs.push('-i', o.url);
    else inputs.push('-loop', '1', '-i', o.url);
    idx++;
  }
  const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolume) ? (opts.musicVolume as number) : 20) / 100));

  // Фон clean plate — тот же аспект, что канвас → scale+crop без потерь композиции.
  const bg = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30[bg];`;
  // Chroma-key + despill + мягкий край альфа-маски. 0.36/0.10 — H.264-зелёный HeyGen неравномерен:
  // слабее оставалась «плёнка», сильнее начинает есть полутона.
  const keyBase = `chromakey=${key}:0.36:0.10,despill=type=green:mix=0.5:expand=0,`;
  const keyTail = `avgblur=sizeX=2:sizeY=2:planes=8,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${T}`;
  const keyf = (i: number, label: string) =>
    `[${i}:v]${keyBase}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${keyTail}[${label}];`;
  let fc = bg;
  let lastV = 'bg';
  heads.forEach((_, k) => {
    const lbl = `k${k}`;
    fc += keyf(1 + k, lbl);
    fc += `[${lastV}][${lbl}]overlay=x=0:y=0:shortest=0[hv${k}];`;
    lastV = `hv${k}`;
  });
  // Медиа реплик: карточка по центру, видима в свой интервал (как в воркерном таймлайне).
  const SIDE = Math.round(Math.min(W, H) * 0.62);
  ovs.forEach((o, k) => {
    const i = ovStart + k;
    const t0 = Math.max(0, o.tStart); const t1 = t0 + o.dur;
    // видео сдвигаем по времени, чтобы играло с начала своего интервала; картинка статична
    const pts = o.video ? `,setpts=PTS-STARTPTS+${t0.toFixed(3)}/TB` : '';
    fc += `[${i}:v]scale=${SIDE}:${SIDE}:force_original_aspect_ratio=increase,crop=${SIDE}:${SIDE},setsar=1,fps=30${pts}[ov${k}];`
      + `[${lastV}][ov${k}]overlay=(W-w)/2:(H-h)/2:enable='between(t\,${t0.toFixed(3)}\,${t1.toFixed(3)})'[vo${k}];`;
    lastV = `vo${k}`;
  });
  fc += `[${lastV}]null[v];`;

  let speechLabel: string;
  if (audioIdx >= 0) { fc += `[${audioIdx}:a]aresample=async=1[sp];`; speechLabel = '[sp]'; }
  // normalize=0 — иначе amix делит громкость на число входов (речь тише в 2 раза)
  else if (heads.length === 2) { fc += `[1:a][2:a]amix=inputs=2:normalize=0:duration=longest[sp];`; speechLabel = '[sp]'; }
  else { fc += `[1:a]anull[sp];`; speechLabel = '[sp]'; }
  let mapAudio: string;
  if (musicIdx >= 0) {
    fc += `[${musicIdx}:a]volume=${vol.toFixed(2)}[bgm];${speechLabel}[bgm]amix=inputs=2:normalize=0:duration=first:dropout_transition=0[aout];`;
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
