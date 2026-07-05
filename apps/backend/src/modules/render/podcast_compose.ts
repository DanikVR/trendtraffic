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
    // -crf 18: дефолтный crf 23 при veryfast заметно мылил финал и добавлял блочность у движения
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', outPath,
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

/** Похожесть ОБЛАСТИ (рамка в долях кадра) двух картинок: SSIM по яркости, 0..1; null при
 *  ошибке. Используется для валидации clean plate: если область, где сидел ведущий, почти не
 *  изменилась (высокий SSIM) — Gemini не удалил человека, а «растворил» до полупрозрачного
 *  призрака, и такой фон нельзя брать в склейку. */
export function regionSimilarity(inputA: string, inputB: string, r: NormRect): Promise<number | null> {
  return new Promise((resolve) => {
    const crop = `crop=iw*${r.w.toFixed(4)}:ih*${r.h.toFixed(4)}:iw*${r.x.toFixed(4)}:ih*${r.y.toFixed(4)},scale=256:256,format=gray`;
    const ff = spawn(FFMPEG_BIN, [
      '-v', 'info', '-i', inputA, '-i', inputB,
      '-filter_complex', `[0:v]${crop}[a];[1:v]${crop}[b];[a][b]ssim`,
      '-frames:v', '1', '-f', 'null', '-',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => { err += d.toString(); });
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } resolve(null); }, 60_000);
    ff.on('error', () => { clearTimeout(timer); resolve(null); });
    ff.on('close', () => {
      clearTimeout(timer);
      const m = err.match(/SSIM.*?All:\s*([\d.]+)/) || err.match(/SSIM.*?Y:\s*([\d.]+)/);
      const v = m ? Number(m[1]) : NaN;
      resolve(Number.isFinite(v) ? v : null);
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
export function greenBgRatio(input: string, region?: NormRect): Promise<number | null> {
  return new Promise((resolve) => {
    // region — считать долю зелёного только ВНУТРИ области (рамка ведущего): у плотного
    // человека внутри рамки зелёного мало, у «растворённого» призрака зелёный просвечивает
    // сквозь всё тело — так ловим полупрозрачные вырезки до HeyGen.
    const crop = region ? `crop=iw*${region.w.toFixed(4)}:ih*${region.h.toFixed(4)}:iw*${region.x.toFixed(4)}:ih*${region.y.toFixed(4)},` : '';
    const ff = spawn(FFMPEG_BIN, ['-v', 'error', '-i', input, '-vf', `${crop}scale=64:64`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { stdio: ['ignore', 'pipe', 'ignore'] });
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

/** Медиа реплики поверх студийной сцены: показывается в свой интервал таймлайна.
 *  mode: 'card' — карточка 62% по центру (как раньше); 'full' — во весь кадр (новостной b-roll).
 *  fx (для фото в full): 'kb_in'/'kb_out' — Ken Burns наезд/отъезд, 'none' — статично;
 *  без fx направление чередуется. title — текст плашки-заголовка (lower third) на время показа. */
export interface StudioOverlay { url: string; tStart: number; dur: number; video?: boolean; mode?: 'card' | 'full'; fx?: 'kb_in' | 'kb_out' | 'none'; title?: string }

/** Титр реплики (для вжигания субтитров стиля «Новости»). */
export interface CaptionLine { t0: number; t1: number; text: string }

// ── ASS-титры «как новости»: караоке-титры + плашки-заголовки (lower third) ──

function assTime(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

/** Экранирование текста для ASS: фигурные скобки открывают override-блоки, \n → \N. */
function assEsc(text: string): string {
  return String(text).replace(/\{/g, '(').replace(/\}/g, ')').replace(/\r?\n/g, '\\N').trim();
}

/**
 * Построить ASS с двумя стилями: Cap — титры реплик (белый с тёмной обводкой, снизу по центру),
 * LT — плашка-заголовок в фирменном индиго (BorderStyle=3 = непрозрачный бокс), слева снизу.
 * capMarginV подбирается по раскладке (в 9:16-дуэте титры сидят НАД лентой ведущих).
 */
export function buildNewsAss(opts: {
  W: number; H: number; capMarginV: number;
  captions: CaptionLine[];
  lower: Array<{ t0: number; t1: number; text: string }>;
}): string {
  const vertical = opts.H > opts.W;
  const capFs = vertical ? 58 : 54;
  const ltFs = vertical ? 44 : 46;
  // Цвета ASS = &HAABBGGRR. Индиго #4F46E5 → BBGGRR = E5464F (акцент дизайн-системы).
  const head = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${opts.W}`,
    `PlayResY: ${opts.H}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Cap,DejaVu Sans,${capFs},&H00FFFFFF,&H00FFFFFF,&H00141414,&H7A000000,-1,0,0,0,100,100,0,0,1,3,1,2,60,60,${Math.round(opts.capMarginV)},1`,
    `Style: LT,DejaVu Sans,${ltFs},&H00FFFFFF,&H00FFFFFF,&H00E5464F,&H00E5464F,-1,0,0,0,100,100,0,0,3,14,0,1,56,56,56,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const ev: string[] = [];
  for (const c of opts.captions) {
    if (!(c.t1 > c.t0) || !String(c.text || '').trim()) continue;
    ev.push(`Dialogue: 0,${assTime(c.t0)},${assTime(c.t1)},Cap,,0,0,0,,${assEsc(c.text)}`);
  }
  for (const l of opts.lower) {
    if (!(l.t1 > l.t0) || !String(l.text || '').trim()) continue;
    ev.push(`Dialogue: 1,${assTime(l.t0)},${assTime(l.t1)},LT,,0,0,0,,${assEsc(l.text).toUpperCase()}`);
  }
  return head.concat(ev).join('\n') + '\n';
}

/** Путь для фильтра subtitles: прямые слэши + экранированные ':' ',' '\''. */
function subFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/,/g, '\\,').replace(/'/g, "\\'");
}

/** Ken Burns по фото: пре-скейл ×2 (анти-дёргание сабпиксельного зума) + zoompan до кадра W×H.
 *  dir: наезд (in) или отъезд (out); zoom 1.0↔1.12 за всю длительность показа. */
function kenBurnsChain(W: number, H: number, durSec: number, dir: 'kb_in' | 'kb_out'): string {
  const frames = Math.max(2, Math.round(durSec * 30) + 1);
  const inc = (0.12 / frames).toFixed(6);
  const z = dir === 'kb_in'
    ? `min(zoom+${inc},1.12)`
    : `if(lte(on,1),1.12,max(zoom-${inc},1.0))`;
  return `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},setsar=1,`
    + `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=30`;
}

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
  /** Титры реплик (стиль «Новости») — вжигаются вместе с плашками overlays[].title. */
  captions?: CaptionLine[] | null;
  // Рамки ведущих (доли кадра исходного фото) — ДЕТЕРМИНИРОВАННАЯ обрезка по сторонам:
  // каждый ведущий берётся ТОЛЬКО со своей половины (разрез в промежутке между рамками),
  // поэтому если в вырезке остался второй человек — он отсекается тут, без зависимости от Gemini.
  boxA?: NormRect | null; boxB?: NormRect | null;
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
    .slice(0, 24);

  // Канвас = аспект фото студии (однотипный, предсказуемый размер выхода).
  // Фолбэк — аспект головы (она рендерится в формате фото): не даём канвасу «уехать» в 9:16.
  const size = (await probeImageSize(opts.studioUrl)) || (await probeImageSize(opts.headA));
  const ar = size && size.h > 0 ? size.w / size.h : 9 / 16;
  const [W, H] = ar >= 1.2 ? [1920, 1080] : ar <= 0.83 ? [1080, 1920] : [1080, 1080];

  const inputs: string[] = ['-loop', '1', '-i', opts.studioUrl];
  for (const h of heads) inputs.push('-i', h);
  let idx = 1 + heads.length; let audioIdx = -1; let musicIdx = -1;
  if (opts.audioUrl) { inputs.push('-i', opts.audioUrl); audioIdx = idx++; }
  if (opts.musicUrl) { inputs.push('-i', opts.musicUrl); musicIdx = idx++; }
  const ovStart = idx;
  for (const o of ovs) {
    // видео нельзя подавать с -loop (опция image2-демаксера); картинку зацикливаем.
    // Вход обрезаем по длительности показа (+запас): иначе Ken Burns/декодирование
    // молотит весь ролик ради нескольких секунд показа.
    const dcap = (Math.max(0.2, o.dur) + 0.6).toFixed(3);
    if (o.video) inputs.push('-t', dcap, '-i', o.url);
    else inputs.push('-loop', '1', '-t', dcap, '-i', o.url);
    idx++;
  }
  const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolume) ? (opts.musicVolume as number) : 20) / 100));

  // Фон clean plate — тот же аспект, что канвас → scale+crop без потерь композиции.
  const bg = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30[bg];`;
  // Chroma-key + despill + мягкий край альфа-маски.
  // similarity=0.18 (было 0.36 — БАГ: съедало сам объект). Проверено на синтетике (ffmpeg 6.1):
  // при 0.36 пиксели с зелёным ПОДСВЕТОМ (spill на тёмном костюме, полутона кожи) попадали под
  // порог и вырезались → ведущий в ролике полупрозрачный/исчезал. 0.18 убирает и чистый, и
  // неравномерный H.264-зелёный (запас до 0x22DD2A), но сохраняет объект даже с сильным spill;
  // подъедать человека начинает лишь с ~0.26. «Плёнку» (остаточный зелёный по краям) убирает
  // despill (снимает зелёный КАСТ, не трогая альфу) — это его работа, а не задирание similarity.
  const keyBase = `chromakey=${key}:0.18:0.08,despill=type=green:mix=0.5:expand=0,`;
  const keyTail = `avgblur=sizeX=2:sizeY=2:planes=8,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${T}`;
  // ВПИСЫВАЕМ (decrease + прозрачный pad), а не кроем кропом: если аспект головы вдруг не
  // совпал с канвасом (HeyGen отрендерил в другом формате), кроп раньше отрезал человека и
  // оставлял одну зелёнку — голова «исчезала» из ролика. Letterbox прозрачный (black@0).
  const keyf = (i: number, label: string) =>
    `[${i}:v]${keyBase}scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black@0,${keyTail}[${label}];`;
  // РАЗМЕЩЕНИЕ двух ведущих ПО СТОРОНАМ. Вырезка (v1.6.74) = человек ПО ЦЕНТРУ квадрата, поэтому
  // старый «разрез по центру» давал нахлёст (пол-женщины+пол-мужчины в середине). Теперь каждую
  // голову масштабируем в квадрат и кладём A/B в ЛЕВУЮ/ПРАВУЮ половину — люди разнесены, не режутся.
  // Сторона — из рамок (кто левее по центру), иначе A слева.
  let place2: { x: number; y: number; hs: number }[] | null = null;
  if (heads.length === 2) {
    const hs = Math.min(H, Math.floor(W / 2 / 2) * 2);       // квадрат = половина ширины (или высота), чётный
    const yPos = H - hs;                                      // низ головы у низа кадра (за столом)
    const half = W / 2;
    const xL = Math.round((half - hs) / 2 / 2) * 2;           // центр левой половины
    const xR = Math.round((half + (half - hs) / 2) / 2) * 2;  // центр правой половины
    let aLeft = true;
    if (opts.boxA && opts.boxB) aLeft = (opts.boxA.x + opts.boxA.w / 2) <= (opts.boxB.x + opts.boxB.w / 2);
    place2 = aLeft
      ? [{ x: xL, y: yPos, hs }, { x: xR, y: yPos, hs }]      // индекс 0=A(слева),1=B(справа)
      : [{ x: xR, y: yPos, hs }, { x: xL, y: yPos, hs }];
  }
  let fc = bg;
  let lastV = 'bg';
  heads.forEach((_, k) => {
    const lbl = `k${k}`;
    if (place2) {
      const p = place2[k];
      // голову — в квадрат hs×hs (человек по центру), затем в свою половину кадра
      fc += `[${1 + k}:v]${keyBase}scale=${p.hs}:${p.hs}:force_original_aspect_ratio=decrease,`
        + `pad=${p.hs}:${p.hs}:(ow-iw)/2:(oh-ih)/2:color=black@0,${keyTail}[${lbl}];`;
      fc += `[${lastV}][${lbl}]overlay=x=${p.x}:y=${p.y}:shortest=0[hv${k}];`;
    } else {
      fc += keyf(1 + k, lbl);                                  // соло-режим: голова во весь кадр
      fc += `[${lastV}][${lbl}]overlay=x=0:y=0:shortest=0[hv${k}];`;
    }
    lastV = `hv${k}`;
  });
  // Медиа реплик: 'full' — во весь кадр (новостной b-roll: фото с Ken Burns, видео фрагментом),
  // 'card' — карточка 62% по центру (как раньше). Вход/выход — мягкие альфа-фейды.
  // Все оверлеи собираются в ЛОКАЛЬНОМ времени (pts от 0) и сдвигаются setpts на t0 —
  // так фейды и Ken Burns не зависят от позиции на таймлайне; enable прячет края.
  const SIDE = Math.round(Math.min(W, H) * 0.62);
  const FADE = 0.4;
  let kbFlip = 0;
  ovs.forEach((o, k) => {
    const i = ovStart + k;
    const t0 = Math.max(0, o.tStart); const dur = Math.max(0.2, o.dur); const t1 = t0 + dur;
    const full = o.mode === 'full';
    const fade = `format=yuva420p,fade=in:st=0:d=${FADE}:alpha=1,fade=out:st=${Math.max(0, dur - FADE).toFixed(3)}:d=${FADE}:alpha=1`;
    const coverFull = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30`;
    const coverCard = `scale=${SIDE}:${SIDE}:force_original_aspect_ratio=increase,crop=${SIDE}:${SIDE},setsar=1,fps=30`;
    let chain: string;
    if (!o.video && full && o.fx !== 'none') {
      // фото во весь кадр = Ken Burns (наезд/отъезд чередуются, если направление не задано)
      const dir: 'kb_in' | 'kb_out' = o.fx === 'kb_out' ? 'kb_out' : o.fx === 'kb_in' ? 'kb_in' : (kbFlip++ % 2 === 0 ? 'kb_in' : 'kb_out');
      chain = `${kenBurnsChain(W, H, dur, dir)},${fade}`;
    } else {
      chain = `${full ? coverFull : coverCard},setpts=PTS-STARTPTS,${fade}`;
    }
    chain += `,setpts=PTS+${t0.toFixed(3)}/TB`;
    const pos = full ? 'overlay=0:0' : 'overlay=(W-w)/2:(H-h)/2';
    fc += `[${i}:v]${chain}[ov${k}];`
      + `[${lastV}][ov${k}]${pos}:enable='between(t\,${t0.toFixed(3)}\,${t1.toFixed(3)})'[vo${k}];`;
    lastV = `vo${k}`;
  });
  // Стиль «Новости»: титры реплик + индиго-плашки заголовков (lower third) — вжигаются libass.
  const caps = (opts.captions || [])
    .filter((c) => c && Number.isFinite(c.t0) && Number.isFinite(c.t1) && c.t1 > c.t0 && String(c.text || '').trim())
    .slice(0, 400);
  const lower = ovs
    .filter((o) => o.title && String(o.title).trim())
    .map((o) => ({ t0: Math.max(0, o.tStart), t1: Math.max(0, o.tStart) + Math.max(0.2, o.dur), text: String(o.title) }));
  if (caps.length || lower.length) {
    // в 9:16-дуэте низ кадра занят лентой ведущих — титры поднимаем над ней
    const capMarginV = H > W ? (heads.length === 2 ? 620 : 320) : 90;
    const ass = buildNewsAss({ W, H, capMarginV, captions: caps, lower });
    const assPath = path.join(RENDERS_DIR, `podass-${randomUUID().slice(0, 8)}.ass`);
    fs.writeFileSync(assPath, ass, 'utf8');
    fc += `[${lastV}]subtitles=filename='${subFilterPath(assPath)}'[vsub];`;
    lastV = 'vsub';
  }
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
  // Таймаут масштабируем по длине: chromakey+оверлеи на CPU могут идти медленнее реального
  // времени. ~4× длительности + 2 мин запаса (для 15-мин ролика ≈ 55 мин), не меньше 10 мин.
  const composeTimeout = Math.max(600_000, Math.min(3_300_000, Math.round(target * 4000) + 120_000));
  await ffmpeg([
    '-y', ...inputs, '-filter_complex', fc,
    '-map', '[v]', '-map', mapAudio, '-t', T,
    // -crf 18: дефолтный crf 23 при veryfast заметно мылил финал и добавлял блочность у движения
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', outPath,
  ], composeTimeout);
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
