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

/** Медиа реплики поверх студийной сцены: показывается в свой интервал таймлайна. */
export interface StudioOverlay { url: string; tStart: number; dur: number; video?: boolean }

/** Собрать ролик: две ЗЕЛЁНЫЕ головы (chroma-key) поверх ФОТО СТУДИИ (оба ведущих на фоне студии).
 *  Каждая голова — talking_photo, снятый на зелёном (человек вырезан Nano ДО HeyGen).
 *  placeA/placeB — окна ведущих в долях ИСХОДНОГО кадра: фон пере-кадрируется по горизонтали
 *  так, чтобы ОБА окна попали в вертикальный 1080×1920 (широкое фото студии в 9:16 целиком не
 *  влезает), недостающая высота — блюр-подложка; головы сажаются на вычисленные координаты.
 *  fullFrame=true (без place) — вырезки в композиции центрального 9:16-кропа → оверлей 0:0.
 *  overlays — медиа реплик (картинка/видео) по таймкодам поверх сцены. → fileUrl. */
export async function composeOnStudio(opts: {
  studioUrl: string; headA: string; headB: string;
  audioUrl?: string; musicUrl?: string; musicVolume?: number; chromaColor?: string;
  fullFrame?: boolean; overlays?: StudioOverlay[];
  placeA?: NormRect | null; placeB?: NormRect | null;
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
  const ovs = (opts.overlays || [])
    .filter((o) => o && typeof o.url === 'string' && o.url && Number.isFinite(o.tStart) && Number.isFinite(o.dur) && o.dur > 0.1)
    .slice(0, 12);

  const inputs: string[] = ['-loop', '1', '-i', opts.studioUrl, '-i', opts.headA, '-i', opts.headB];
  let idx = 3; let audioIdx = -1; let musicIdx = -1;
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

  const W = 1080, H = 1920, PW = 620; // выход 1080×1920; PW — ширина головы в легаси-раскладке
  const ev = (n: number) => Math.max(2, 2 * Math.round(n / 2)); // чётные размеры для yuv420p

  // Геометрия посадки по окнам ведущих (если заданы и удалось узнать размер фона).
  let geom: { bgChain: string; A: { w: number; h: number; x: number; y: number }; B: { w: number; h: number; x: number; y: number } } | null = null;
  if (opts.placeA && opts.placeB) {
    const size = await probeImageSize(opts.studioUrl);
    if (size && size.w > 1 && size.h > 1) {
      const pA = opts.placeA; const pB = opts.placeB;
      // Горизонтальный регион, покрывающий оба окна (+2% запас) — его растягиваем на всю ширину.
      const cx0 = Math.max(0, Math.min(pA.x, pB.x) - 0.02);
      const cx1 = Math.min(1, Math.max(pA.x + pA.w, pB.x + pB.w) + 0.02);
      const cw = Math.max(0.05, cx1 - cx0);
      const cropW = ev(cw * size.w); const cropX = Math.round(cx0 * size.w);
      const s = W / cropW;                       // масштаб источник→выход
      const Hs = ev(size.h * s);                 // высота сцены после масштабирования
      const yShift = Hs >= H
        ? Math.max(0, Math.min(Hs - H, Math.round(((pA.y + pA.h / 2 + pB.y + pB.h / 2) / 2) * Hs - H / 2)))
        : 0;                                     // Hs>=H: вертикальный кроп с центром на ведущих
      const top = Hs >= H ? 0 : Math.round((H - Hs) / 2); // Hs<H: сцена лентой по центру
      const sharp = `crop=${cropW}:${size.h}:${cropX}:0,scale=${W}:${Hs},setsar=1`;
      const bgChain = Hs >= H
        ? `[0:v]${sharp},crop=${W}:${H}:0:${yShift},fps=30[bg];`
        // недостающую высоту заполняет блюр всей студии — стандарт вертикального рекадра
        : `[0:v]split[bgs][bgb];[bgb]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:2,setsar=1[blf];`
          + `[bgs]${sharp}[shp];[blf][shp]overlay=0:${top},fps=30[bg];`;
      const place = (p: NormRect) => {
        const w = ev(p.w * size.w * s); const h = ev(p.h * size.h * s);
        const x = Math.round((p.x - cx0) * size.w * s);
        const y = Math.round(p.y * size.h * s) - yShift + top;
        return { w, h, x, y };
      };
      geom = { bgChain, A: place(pA), B: place(pB) };
    }
  }

  // Chroma-key зелёнки + despill (увод зелёного с краёв) + мягкий край маски (avgblur только
  // альфа-плоскости, planes=8) — контур вырезки не читается на фоне студии.
  const keyBase = `chromakey=${key}:0.30:0.12,despill=type=green:mix=0.5:expand=0,`;
  const keyTail = `avgblur=sizeX=2:sizeY=2:planes=8,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${T}`;
  const keyf = (i: number, label: string) => {
    if (geom) {
      const g = i === 1 ? geom.A : geom.B;
      return `[${i}:v]${keyBase}scale=${g.w}:${g.h},${keyTail}[${label}];`;
    }
    return opts.fullFrame
      ? `[${i}:v]${keyBase}scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${keyTail}[${label}];`
      : `[${i}:v]${keyBase}scale=${PW}:-1:force_original_aspect_ratio=decrease,${keyTail}[${label}];`;
  };
  const bg = geom ? geom.bgChain : `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30[bg];`;
  let fc = bg + keyf(1, 'ka') + keyf(2, 'kb');
  if (geom) {
    // Каждое окно-голова садится на свои координаты в пере-кадрированной сцене.
    fc += `[bg][ka]overlay=x=${geom.A.x}:y=${geom.A.y}:shortest=0[b1];[b1][kb]overlay=x=${geom.B.x}:y=${geom.B.y}:shortest=0[v0];`;
  } else if (opts.fullFrame) {
    // Кадр вырезки = кадр фона → оверлей 0:0: каждый аватар ровно на своём месте в студии.
    fc += `[bg][ka]overlay=x=0:y=0:shortest=0[b1];[b1][kb]overlay=x=0:y=0:shortest=0[v0];`;
  } else {
    // Легаси-раскладка (головы вырезаны отдельными кадрами): A — низ-лево, B — низ-право.
    fc += `[bg][ka]overlay=x=-40:y=H-h:shortest=0[b1];[b1][kb]overlay=x=W-w+40:y=H-h:shortest=0[v0];`;
  }
  // Медиа реплик: карточка по центру, видима в свой интервал (как в воркерном таймлайне).
  let lastV = 'v0';
  const SIDE = Math.round(W * 0.62);
  ovs.forEach((o, k) => {
    const i = ovStart + k;
    const t0 = Math.max(0, o.tStart); const t1 = t0 + o.dur;
    // видео сдвигаем по времени, чтобы играло с начала своего интервала; картинка статична
    const pts = o.video ? `,setpts=PTS-STARTPTS+${t0.toFixed(3)}/TB` : '';
    fc += `[${i}:v]scale=${SIDE}:${SIDE}:force_original_aspect_ratio=increase,crop=${SIDE}:${SIDE},setsar=1,fps=30${pts}[ov${k}];`
      + `[${lastV}][ov${k}]overlay=(W-w)/2:(H-h)/2:enable='between(t\\,${t0.toFixed(3)}\\,${t1.toFixed(3)})'[vo${k}];`;
    lastV = `vo${k}`;
  });
  fc += `[${lastV}]null[v];`;

  let speechLabel: string;
  if (audioIdx >= 0) { fc += `[${audioIdx}:a]aresample=async=1[sp];`; speechLabel = '[sp]'; }
  // normalize=0 — иначе amix делит громкость на число входов (речь тише в 2 раза)
  else { fc += `[1:a][2:a]amix=inputs=2:normalize=0:duration=longest[sp];`; speechLabel = '[sp]'; }
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
