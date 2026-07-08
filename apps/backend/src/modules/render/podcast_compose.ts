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

/**
 * «Комментатор» (Г1): единая загруженная дорожка = финальный голос, на каждый диаризованный
 * сегмент — полноэкранный ВИЗУАЛ (Ken Burns по картинке ИЛИ немой видео/Omni-клип), склейка
 * в один трек, сверху — исходная дорожка (+ опц. музыка). Локальный ffmpeg.
 *
 * Инвариант синка: клип строки i занимает [start_i, start_{i+1}] (последний — до конца аудио),
 * поэтому паузы между репликами «держатся» текущим кадром, а суммарная длина == длине аудио.
 * Каждый клип рендерится отдельно (надёжнее мега-фильтра) → concat → мукс с аудио.
 */
/** ASS с одним титром ПО ЦЕНТРУ кадра на всю длительность клипа — для сегментов «Комментатора»
 *  без визуала: тёмный фон + текст реплики, чтобы ролик без картинок был читаемым, а не чёрным. */
function centeredCaptionAss(text: string, W: number, H: number, durSec: number): string {
  const vertical = H > W;
  const capFs = vertical ? 66 : 54;
  const mh = Math.round(W * 0.1);
  const head = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Mid,DejaVu Sans,${capFs},&H00FFFFFF,&H00FFFFFF,&H00141414,&H64000000,-1,0,0,0,100,100,0,0,1,3,2,5,${mh},${mh},0,1`,
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  return head.concat([`Dialogue: 0,${assTime(0)},${assTime(Math.max(0.4, durSec))},Mid,,0,0,0,,${assEsc(text)}`]).join('\n') + '\n';
}

export async function composeCommentator(opts: {
  audioUrl: string;
  format?: '9:16' | '16:9';
  lines: { start: number; end?: number; visualUrl?: string; isVideo?: boolean; text?: string }[];
  musicUrl?: string; musicVolume?: number;
}): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const portrait = opts.format !== '16:9';
  const W = portrait ? 1080 : 1920;
  const H = portrait ? 1920 : 1080;

  const audioDur = await probeDuration(opts.audioUrl);
  if (!(audioDur > 0.2)) throw new Error('Аудио не читается или пустое.');
  const lines = [...(opts.lines || [])]
    .filter((l) => l && Number.isFinite(l.start))
    .sort((a, b) => a.start - b.start);
  if (!lines.length) throw new Error('Нет строк для сборки.');

  const work = fs.mkdtempSync(path.join(RENDERS_DIR, 'comm-'));
  try {
    const clips: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const segEnd = i < lines.length - 1 ? lines[i + 1].start : audioDur;
      const dur = Math.max(0.4, Math.min(600, segEnd - l.start));
      const D = dur.toFixed(2);
      const clip = path.join(work, `c${String(i).padStart(3, '0')}.mp4`);
      const fadeD = Math.min(0.4, dur / 3);
      const fade = `fade=t=in:st=0:d=${fadeD.toFixed(2)},fade=t=out:st=${Math.max(0, dur - fadeD).toFixed(2)}:d=${fadeD.toFixed(2)}`;

      if (l.visualUrl && l.isVideo) {
        // Omni-клип / видео из Галереи: cover, немой (звук отбрасываем — голос только ваш), обрезка по dur.
        await ffmpeg([
          '-y', '-t', D, '-i', l.visualUrl,
          '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,fps=30,${fade}`,
          '-an', '-t', D, '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', clip,
        ], 300_000);
      } else if (l.visualUrl) {
        // Картинка: Ken Burns (пре-скейл ×2 — анти-дёрганье; наезд/отъезд чередуются).
        const frames = Math.max(2, Math.round(dur * 30) + 1);
        const inc = (0.12 / frames).toFixed(6);
        // Запятые внутри z='...' защищены одинарными кавычками ffmpeg — как в проверенном _kenburns (Python).
        const z = i % 2 === 0
          ? `min(zoom+${inc},1.12)`
          : `if(lte(on,1),1.12,max(zoom-${inc},1.0))`;
        const kb = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},setsar=1,`
          + `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=30,${fade}`;
        await ffmpeg([
          '-y', '-loop', '1', '-t', D, '-i', l.visualUrl,
          '-vf', kb, '-an', '-t', D, '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', clip,
        ], 300_000);
      } else {
        // Без визуала — тёмный «дизайн-фон». Если у сегмента есть текст реплики, вжигаем его
        // по центру (титр): ролик даже без единой картинки остаётся смотрибельным, а не чёрным.
        const cap = String(l.text || '').trim();
        let vf = fade;
        if (cap) {
          const assPath = path.join(work, `t${String(i).padStart(3, '0')}.ass`);
          fs.writeFileSync(assPath, centeredCaptionAss(cap, W, H, dur), 'utf8');
          vf = `subtitles=filename='${subFilterPath(assPath)}',${fade}`;
        }
        await ffmpeg([
          '-y', '-f', 'lavfi', '-i', `color=c=0x10141b:s=${W}x${H}:r=30:d=${D}`,
          '-vf', vf, '-an', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', clip,
        ], 120_000);
      }
      clips.push(clip);
    }

    // Склейка визуалов встык (одинаковые параметры → безопасно; re-encode на всякий случай).
    const listFile = path.join(work, 'list.txt');
    fs.writeFileSync(listFile, clips.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
    const visual = path.join(work, 'visual.mp4');
    await ffmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', visual,
    ], Math.max(600_000, Math.round(audioDur * 6000) + 120_000));

    // Мукс: визуал + ваша дорожка (+ опц. музыка с дакингом), длина = длине аудио.
    const inputs = ['-i', visual, '-i', opts.audioUrl];
    let fc = ''; let mapA = '1:a';
    if (opts.musicUrl) {
      inputs.push('-i', opts.musicUrl);
      const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolume) ? (opts.musicVolume as number) : 20) / 100));
      fc = `[2:a]volume=${vol.toFixed(2)}[bg];[1:a][bg]amix=inputs=2:normalize=0:duration=first:dropout_transition=0[aout]`;
      mapA = '[aout]';
    }
    const out = `commentator-${randomUUID().slice(0, 8)}.mp4`;
    const outPath = path.join(RENDERS_DIR, out);
    const args = ['-y', ...inputs];
    if (fc) args.push('-filter_complex', fc);
    args.push('-map', '0:v', '-map', mapA, '-t', audioDur.toFixed(2), '-c:v', 'copy', '-c:a', 'aac', '-shortest', outPath);
    await ffmpeg(args, Math.max(300_000, Math.round(audioDur * 3000) + 120_000));

    return `/uploads/renders/${out}`;
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* */ }
  }
}

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

// ── ASS-титры: помощники времени/экранирования (используются UGC/диалог/комментатор) ──

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

/** Путь для фильтра subtitles: прямые слэши + экранированные ':' ',' '\''. */
function subFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/,/g, '\\,').replace(/'/g, "\\'");
}

/** Скачать видео по URL в uploads/renders (для сохранения головы HeyGen в Галерею). → fileUrl.
 *  Локальный /uploads/…-URL (наш же файл) не гоняем через HTTP — КОПИРУЕМ на диске
 *  (работает и без PUBLIC_BASE_URL). Именно копия, не ссылка на оригинал: удаление
 *  ассета из Галереи мид-джоб стирает файл с диска — снимок переживает это, как и
 *  прежняя HTTP-загрузка. */
export async function downloadToRenders(url: string, prefix = 'podhead'): Promise<{ fileUrl: string; filePath: string; size: number }> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const localRel = url.replace(/^https?:\/\/[^/]+/i, '');
  if (localRel.startsWith('/uploads/')) {
    const localPath = path.resolve(UPLOADS_ROOT, localRel.slice('/uploads/'.length).split('?')[0].split('#')[0]);
    // против ../-обхода: путь обязан остаться внутри uploads (с разделителем)
    if (localPath.startsWith(UPLOADS_ROOT + path.sep) && fs.existsSync(localPath)) {
      const name = `${prefix}-${randomUUID().slice(0, 8)}${path.extname(localPath) || '.mp4'}`;
      const filePath = path.join(RENDERS_DIR, name);
      fs.copyFileSync(localPath, filePath);
      return { fileUrl: `/uploads/renders/${name}`, filePath, size: fs.statSync(filePath).size };
    }
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`видео не скачалось (HTTP ${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  const name = `${prefix}-${randomUUID().slice(0, 8)}.mp4`;
  const filePath = path.join(RENDERS_DIR, name);
  fs.writeFileSync(filePath, buf);
  return { fileUrl: `/uploads/renders/${name}`, filePath, size: buf.length };
}

/** Длительность медиа (сек) — публичная обёртка probeDuration. */
export function mediaDuration(input: string): Promise<number> { return probeDuration(input); }

/**
 * Слайдшоу из изображений → mp4-клип для «Видеоряда» UGC: одно фото = статичный кадр
 * (6с), несколько = перелистывание с кроссфейдом по кругу (дальше конвейер зациклит/
 * обрежет клип под длину голоса, как обычное видео). Кадры вписываются cover-ом
 * (масштаб до заполнения + кроп по центру), без звука.
 *
 * Тайминг xfade-цепочки: каждый вход длиной per+fade; переход k стартует на
 * (k+1)*per выходного потока → итог = N*per + fade.
 */
export async function composeSlideshow(opts: {
  imagePaths: string[];
  dims: FrameDims;
  perImageSec?: number;   // сколько держится каждое фото (дефолт 3)
  fadeSec?: number;       // длительность кроссфейда (дефолт 0.5)
}): Promise<{ fileUrl: string; filePath: string; durationSec: number }> {
  const imgs = (opts.imagePaths || []).filter((p) => p && fs.existsSync(p)).slice(0, 12);
  if (!imgs.length) throw new Error('слайдшоу: нет изображений');
  const { W, H } = opts.dims;
  const per = Math.min(10, Math.max(1.5, Number(opts.perImageSec) || 3));
  const fade = Math.min(1.2, Math.max(0.2, Number(opts.fadeSec) || 0.5));
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const name = `slide-${randomUUID().slice(0, 8)}.mp4`;
  const outPath = path.join(RENDERS_DIR, name);

  const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=30,format=yuv420p`;

  if (imgs.length === 1) {
    const dur = 6;
    await ffmpeg(['-y', '-loop', '1', '-t', String(dur), '-i', imgs[0],
      '-vf', fit, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', outPath], 180_000);
    return { fileUrl: `/uploads/renders/${name}`, filePath: outPath, durationSec: dur };
  }

  const inputs: string[] = [];
  const parts: string[] = [];
  const inLen = per + fade;
  imgs.forEach((p, i) => {
    inputs.push('-loop', '1', '-t', inLen.toFixed(2), '-i', p);
    parts.push(`[${i}:v]${fit}[v${i}]`);
  });
  let cur = '[v0]';
  for (let k = 1; k < imgs.length; k++) {
    const out = k === imgs.length - 1 ? '[vo]' : `[x${k}]`;
    parts.push(`${cur}[v${k}]xfade=transition=fade:duration=${fade.toFixed(2)}:offset=${(k * per).toFixed(2)}${out}`);
    cur = out;
  }
  await ffmpeg(['-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[vo]',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', outPath], 300_000);
  return { fileUrl: `/uploads/renders/${name}`, filePath: outPath, durationSec: imgs.length * per + fade };
}

/** Нарезать кусок аудио [t0,t1] в WAV в uploads/renders (публичный URL для HeyGen). */
export async function sliceAudioToRenders(inputPath: string, t0: number, t1: number, prefix = 'ugcseg'): Promise<{ fileUrl: string; filePath: string }> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const name = `${prefix}-${randomUUID().slice(0, 8)}.wav`;
  const filePath = path.join(RENDERS_DIR, name);
  const dur = Math.max(0.2, t1 - t0);
  await ffmpeg(['-y', '-ss', t0.toFixed(2), '-t', dur.toFixed(2), '-i', inputPath, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', filePath], 120_000);
  return { fileUrl: `/uploads/renders/${name}`, filePath };
}

// ── UGC: аватар (webm с альфой) + видео → кадр 9:16 (vstack ИЛИ оверлей) + титры ──

export interface UgcCaption { t0: number; t1: number; text: string }

/** ASS для UGC: стили титров «Обычные» (строка), «По словам» (слово за словом крупно),
 *  «Караоке» (строка с заливкой слов фиолетовым по мере речи). Позиция: низ/центр/верх. */
function buildUgcAss(opts: {
  W: number; H: number;
  captions: UgcCaption[];
  style: 'word' | 'karaoke' | 'plain';
  pos: 'bottom' | 'center' | 'top';
}): string {
  const align = opts.pos === 'bottom' ? 2 : opts.pos === 'center' ? 5 : 8;
  const marginV = opts.pos === 'bottom' ? 170 : opts.pos === 'top' ? 140 : 0;
  const fs1 = opts.style === 'word' ? 92 : 62;
  // Фиолетовый акцент UGC #a855f7 → ASS BBGGRR = F755A8.
  const head = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${opts.W}`, `PlayResY: ${opts.H}`,
    'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Cap,DejaVu Sans,${fs1},&H00FFFFFF,&H00FFFFFF,&H00141414,&H7A000000,-1,0,0,0,100,100,0,0,1,4,1,${align},60,60,${marginV},1`,
    `Style: Kar,DejaVu Sans,62,&H00F755A8,&H00FFFFFF,&H00141414,&H7A000000,-1,0,0,0,100,100,0,0,1,4,1,${align},60,60,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const ev: string[] = [];
  const wordsOf = (t: string) => String(t || '').trim().split(/\s+/).filter(Boolean);
  for (const c of opts.captions) {
    if (!(c.t1 > c.t0) || !String(c.text || '').trim()) continue;
    if (opts.style === 'plain') {
      ev.push(`Dialogue: 0,${assTime(c.t0)},${assTime(c.t1)},Cap,,0,0,0,,${assEsc(c.text)}`);
    } else {
      const words = wordsOf(c.text);
      if (!words.length) continue;
      const total = words.reduce((s, w) => s + w.length + 1, 0);
      if (opts.style === 'word') {
        // Слово за словом: длительность слова пропорциональна его длине.
        let t = c.t0;
        for (const w of words) {
          const d = (c.t1 - c.t0) * ((w.length + 1) / total);
          ev.push(`Dialogue: 0,${assTime(t)},${assTime(Math.min(c.t1, t + d))},Cap,,0,0,0,,${assEsc(w)}`);
          t += d;
        }
      } else {
        // Караоке: {\kNN} в сотых секунды на каждое слово.
        const durCs = Math.max(1, Math.round((c.t1 - c.t0) * 100));
        let acc = 0;
        const parts = words.map((w, i) => {
          const k = i === words.length - 1 ? Math.max(1, durCs - acc) : Math.max(1, Math.round(durCs * ((w.length + 1) / total)));
          acc += k;
          return `{\\k${k}}${assEsc(w)}`;
        });
        ev.push(`Dialogue: 0,${assTime(c.t0)},${assTime(c.t1)},Kar,,0,0,0,,${parts.join(' ')}`);
      }
    }
  }
  return head.concat(ev).join('\n') + '\n';
}

/** Есть ли аудио-дорожка (для опц. подмешивания звука клипа). */
function hasAudioStream(input: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ff = spawn(FFPROBE_BIN, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', input], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    ff.stdout.on('data', (d) => { out += d.toString(); });
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } resolve(false); }, 30_000);
    ff.on('error', () => { clearTimeout(timer); resolve(false); });
    ff.on('close', () => { clearTimeout(timer); resolve(/audio/.test(out)); });
  });
}

// ── Ориентация кадра (9:16 портрет ИЛИ 16:9 ландшафт) — общие помощники для UGC-композиторов ──
export interface FrameDims { W: number; H: number }
export type UgcFormatKey = '9x16' | '16x9' | '1x1' | '4x5';
export const UGC_FORMATS: Record<UgcFormatKey, FrameDims> = {
  '9x16': { W: 1080, H: 1920 },   // TikTok / Reels / Shorts
  '16x9': { W: 1920, H: 1080 },   // YouTube
  '1x1':  { W: 1080, H: 1080 },   // лента Instagram (квадрат; W==H → vstack, как портрет)
  '4x5':  { W: 1080, H: 1350 },   // Instagram/Facebook лента
};

/** Разложить кадр на 2 ячейки: портрет → верх/низ (vstack), ландшафт → лево/право (hstack).
 *  Ячейки всегда ЧЁТНЫЕ (yuv420p: crop нечётной высоты молча режет пиксель — 4:5 выходил 1348
 *  вместо 1350). Если сумма чётных ячеек < кадра (H/2 нечётно, как у 1080×1350) — stack
 *  донормализует результат scale'ом до точного W×H (растяжка на 2px невидима). */
function orientCells(W: number, H: number): { landscape: boolean; cw: number; ch: number; stack: (a: string, b: string, out: string) => string } {
  const landscape = W > H;
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  const cw = landscape ? even(W / 2) : W;
  const ch = landscape ? H : even(H / 2);
  const needFix = landscape ? cw * 2 !== W : ch * 2 !== H;
  const stack = (a: string, b: string, out: string) => {
    const dir = landscape ? 'hstack' : 'vstack';
    return needFix
      ? `[${a}][${b}]${dir}=inputs=2[${out}_s];[${out}_s]scale=${W}:${H}:flags=lanczos,setsar=1[${out}]`
      : `[${a}][${b}]${dir}=inputs=2[${out}]`;
  };
  return { landscape, cw, ch, stack };
}

// ── Оверлеи поверх собранного кадра (ПОД субтитрами): врезки → верхний слой → полоса прогресса ──
/** Врезка: медиа во весь кадр на время реплики (t0..t1). Изображение — loop, видео — со сдвигом PTS. */
export interface UgcInsert { path: string; isVideo: boolean; t0: number; t1: number }

/** Собирает inputs+фильтры для: врезок (overlay enable=between), верхнего PNG-слоя (растянут точно
 *  в кадр — полотно готовится под формат) и полосы прогресса (drawbox, ширина растёт с t).
 *  Порядок: контент → слой → прогресс; субтитры вжигаются ПОЗЖЕ и остаются поверх слоя. */
function overlayExtras(o: {
  startIdx: number; W: number; H: number; D: number; Ds: string;
  inserts?: UgcInsert[] | null; layerPath?: string | null; progressBar?: boolean;
  vIn: string;   // '[vmain]' / '[0:v]'
}): { inputs: string[]; parts: string[]; vOut: string; nextIdx: number } {
  const inputs: string[] = []; const parts: string[] = [];
  let idx = o.startIdx; let cur = o.vIn; let step = 0;
  const next = () => { step++; return `[vx${step}]`; };
  for (const ins of (o.inserts || []).slice(0, 12)) {
    const t0 = Math.max(0, ins.t0); const t1 = Math.min(o.D + 0.2, ins.t1);
    if (!(t1 > t0 + 0.15)) continue;
    const segDur = (t1 - t0 + 0.2).toFixed(2);
    if (ins.isVideo) inputs.push('-stream_loop', '-1', '-t', segDur, '-i', ins.path);
    else inputs.push('-loop', '1', '-t', segDur, '-i', ins.path);
    const tag = `ins${idx}`;
    parts.push(`[${idx}:v]scale=${o.W}:${o.H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${o.W}:${o.H},setsar=1,fps=30,setpts=PTS-STARTPTS+${t0.toFixed(2)}/TB[${tag}]`);
    const out = next();
    parts.push(`${cur}[${tag}]overlay=0:0:enable='between(t,${t0.toFixed(2)},${t1.toFixed(2)})':eof_action=pass${out}`);
    cur = out; idx++;
  }
  if (o.layerPath) {
    inputs.push('-loop', '1', '-t', o.Ds, '-i', o.layerPath);
    parts.push(`[${idx}:v]scale=${o.W}:${o.H}:flags=lanczos,setsar=1,format=rgba[lyr]`);
    const out = next();
    parts.push(`${cur}[lyr]overlay=0:0:eof_action=pass${out}`);
    cur = out; idx++;
  }
  if (o.progressBar) {
    // drawbox НЕ анимируется (её `t` — толщина рамки, не время). Анимация — полоса-источник во всю
    // ширину, выезжающая слева направо: overlay пересчитывает x покадрово (eval=frame по умолчанию).
    const dur = Math.max(0.5, o.D).toFixed(2);
    parts.push(`color=c=0xA855F7@0.9:s=${o.W}x8:r=30:d=${o.Ds}[pbar]`);
    const out = next();
    parts.push(`${cur}[pbar]overlay=x='-${o.W}+${o.W}*min(t/${dur}\\,1)':y=0:eof_action=pass${out}`);
    cur = out;
  }
  return { inputs, parts, vOut: cur, nextIdx: idx };
}

/** Приклеить заставки как есть (нормализация только кадра/фпс/аудио-формата): интро + ролик + аутро.
 *  Перекодировка одним проходом concat-фильтром; у заставок без звука подставляется тишина. */
export async function concatBumpers(opts: {
  mainPath: string; introPath?: string | null; outroPath?: string | null; dims?: FrameDims;
}): Promise<string> {
  const { introPath, outroPath } = opts;
  if (!introPath && !outroPath) return opts.mainPath;
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  // mainPath принимает и локальный путь, и URL-путь '/uploads/renders/…' (результат композеров).
  const mainPath = opts.mainPath.startsWith('/uploads/renders/')
    ? path.join(RENDERS_DIR, path.basename(opts.mainPath))
    : opts.mainPath;
  const W = opts.dims?.W || 1080, H = opts.dims?.H || 1920;
  const segs = [introPath, mainPath, outroPath].filter((p): p is string => !!p);
  const inputs: string[] = []; const parts: string[] = []; const refs: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    inputs.push('-i', segs[i]);
    const dur = await probeDuration(segs[i]);
    parts.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,fps=30,format=yuv420p[v${i}]`);
    if (await hasAudioStream(segs[i])) {
      // apad+atrim: аудио сегмента точно = длине его видео — иначе разница длин дорожек
      // сдвигала бы синхрон всего, что идёт после бампера.
      parts.push(`[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=0:${Math.max(0.2, dur).toFixed(2)}[a${i}]`);
    } else {
      parts.push(`anullsrc=r=44100:cl=stereo,atrim=0:${Math.max(0.2, dur).toFixed(2)}[a${i}]`);
    }
    refs.push(`[v${i}][a${i}]`);
  }
  parts.push(`${refs.join('')}concat=n=${segs.length}:v=1:a=1[vc][ac]`);
  const out = `ugc-bmp-${randomUUID().slice(0, 8)}.mp4`;
  const outPath = path.join(RENDERS_DIR, out);
  await ffmpeg(['-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[vc]', '-map', '[ac]',
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', outPath], 900_000);
  return `/uploads/renders/${out}`;
}

/** Вписать вход [idx] в w×h: аспект близок к целевому → cover (заполнить, кроп); иначе центр +
 *  размытый фон (полоса) — работает и для 16:9-в-9:16, и для 9:16-в-16:9. freeze — tpad для видео. */
function placeFilter(idx: number, w: number, h: number, ratio: number, out: string, freeze = ''): string {
  const targetR = w / h;
  const fr = freeze ? `${freeze},` : '';
  const near = ratio >= targetR * 0.85 && ratio <= targetR * 1.18;
  if (near) return `[${idx}:v]${fr}scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},setsar=1,fps=30[${out}]`;
  return `[${idx}:v]${fr}split=2[${out}s0][${out}s1];[${out}s0]scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},boxblur=24:2[${out}bg];[${out}s1]scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos[${out}fg];[${out}bg][${out}fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30[${out}]`;
}

/**
 * Собрать UGC-ролик (портрет 1080×1920 или ландшафт 1920×1080 по dims):
 *  - placement 'top'/'bottom' — кадр из двух ячеек: аватар отдельным блоком (тёмная подложка,
 *    альфа сохраняет силуэт) + видео во второй половине (cover/contain по clipFit);
 *  - placement 'overlay-left'/'overlay-right' — видео во весь кадр, аватар МАЛЕНЬКИМ поверх
 *    (прозрачный фон — виден только человек), снизу слева/справа.
 * Звук: голос аватара (+ звук клипа, если !clipMuted и он есть; + музыка с volumePct).
 * Титры — buildUgcAss. Длительность = длине голосовой дорожки. → fileUrl.
 */
export async function composeUgc(opts: {
  avatarPath: string;           // альфа-webm (sr-capture) ИЛИ непрозрачный mp4 (HeyGen Avatar IV)
  avatarKind?: 'alpha' | 'opaque'; // alpha=прозрачный силуэт; opaque=готовое видео с фоном (HeyGen)
  voicePath: string;            // голосовая дорожка (для длины/аудио); для HeyGen = сам его mp4
  clipPath?: string | null;
  clipFit: 'cover' | 'contain';
  clipMuted: boolean;
  placement: 'top' | 'bottom' | 'overlay-left' | 'overlay-right';
  musicPath?: string | null; musicVolumePct?: number;
  musicDurationSec?: number | null;   // играть только первые N сек (null/0 = весь ролик); хвост — afade
  captions: UgcCaption[];
  capStyle: 'none' | 'word' | 'karaoke' | 'plain';
  capPos: 'bottom' | 'center' | 'top';
  dims?: FrameDims;             // 9:16 (портрет, деф.) или 16:9 (ландшафт)
  inserts?: UgcInsert[] | null; // врезки медиа реплик во весь кадр (по таймкодам разбора)
  layerPath?: string | null;    // верхний PNG-слой (лого/рамка), под субтитрами
  progressBar?: boolean;        // полоса прогресса сверху кадра
}): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const W = opts.dims?.W || 1080, H = opts.dims?.H || 1920;
  const opaque = opts.avatarKind === 'opaque';
  const D = await probeDuration(opts.voicePath);
  if (!(D > 0.3)) throw new Error('Голосовая дорожка пустая.');
  const Ds = (D + 0.2).toFixed(2);

  const overlayMode = opts.placement === 'overlay-left' || opts.placement === 'overlay-right';
  const clipAudio = !!opts.clipPath && !opts.clipMuted && await hasAudioStream(opts.clipPath);

  // Входы. Для альфа-webm: -c:v libvpx-vp9 ДО -i (нативный vp9-декодер роняет альфу).
  // Для непрозрачного mp4 (HeyGen) — обычный декод.
  const inputs: string[] = opaque ? ['-i', opts.avatarPath] : ['-c:v', 'libvpx-vp9', '-i', opts.avatarPath];
  let idx = 1;
  let clipIdx = -1;
  if (opts.clipPath) { inputs.push('-stream_loop', '-1', '-t', Ds, '-i', opts.clipPath); clipIdx = idx++; }
  const voiceIdx = idx++; inputs.push('-i', opts.voicePath);
  let musicIdx = -1;
  // Музыка: зациклена; играет весь ролик ЛИБО первые musicDurationSec (короче ролика), хвост гасим afade.
  const musT = Math.min(
    Number(opts.musicDurationSec) > 0 ? (opts.musicDurationSec as number) : Number.POSITIVE_INFINITY,
    D + 0.2,
  );
  if (opts.musicPath) { inputs.push('-stream_loop', '-1', '-t', musT.toFixed(2), '-i', opts.musicPath); musicIdx = idx++; }

  const fit = (w: number, h: number) => opts.clipFit === 'contain'
    ? `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0d0f16`
    : `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`;

  const parts: string[] = [];
  let vTag = '[vmain]';
  if (overlayMode) {
    // Фон: клип во весь кадр (или тёмный фон), аватар маленьким поверх снизу слева/справа.
    if (clipIdx >= 0) parts.push(`[${clipIdx}:v]${fit(W, H)},setsar=1,fps=30[bg]`);
    else parts.push(`color=c=0x0d0f16:s=${W}x${H}:r=30:d=${Ds}[bg]`);
    const x = opts.placement === 'overlay-left' ? '32' : `W-w-32`;
    if (opaque) {
      // HeyGen: непрозрачный PiP-бокс (со своим фоном), cover-кроп в вертикальный прямоугольник.
      const bw = 360, bh = 640;
      parts.push(`[0:v]scale=${bw}:${bh}:force_original_aspect_ratio=increase:flags=lanczos,crop=${bw}:${bh},setsar=1,fps=30[av]`);
      parts.push(`[bg][av]overlay=${x}:H-h-48:eof_action=pass[vmain]`);
    } else {
      // sr-capture: прозрачный силуэт (виден только человек).
      const aH = 720;
      parts.push(`[0:v]scale=-2:${aH}:flags=lanczos,format=yuva420p[av]`);
      parts.push(`[bg][av]overlay=${x}:H-h-48:eof_action=pass[vmain]`);
    }
  } else {
    // Две ячейки: аватар + клип. Портрет → верх/низ (vstack), ландшафт → лево/право (hstack).
    const { cw, ch, stack } = orientCells(W, H);
    if (opaque) {
      // HeyGen: непрозрачное видео заполняет свою ячейку (cover).
      parts.push(`[0:v]${fit(cw, ch)},setsar=1,fps=30[ahalf]`);
    } else {
      // sr-capture: прозрачный силуэт на тёмной подложке.
      parts.push(`color=c=0x0d0f16:s=${cw}x${ch}:r=30:d=${Ds}[abg]`);
      parts.push(`[0:v]scale=-2:${ch}:flags=lanczos,format=yuva420p[av]`);
      parts.push(`[abg][av]overlay=(W-w)/2:0:eof_action=pass[ahalf]`);
    }
    if (clipIdx >= 0) parts.push(`[${clipIdx}:v]${fit(cw, ch)},setsar=1,fps=30[chalf]`);
    else parts.push(`color=c=0x161a24:s=${cw}x${ch}:r=30:d=${Ds}[chalf]`);
    parts.push(opts.placement === 'top' ? stack('ahalf', 'chalf', 'vmain') : stack('chalf', 'ahalf', 'vmain'));
  }

  // Врезки медиа реплик + верхний слой + полоса прогресса — ПОД субтитрами.
  const extras = overlayExtras({ startIdx: idx, W, H, D, Ds, inserts: opts.inserts, layerPath: opts.layerPath, progressBar: opts.progressBar, vIn: vTag });
  inputs.push(...extras.inputs); parts.push(...extras.parts); vTag = extras.vOut; idx = extras.nextIdx;

  // Титры
  let assPath: string | null = null;
  if (opts.capStyle !== 'none' && opts.captions.some((c) => c.t1 > c.t0 && String(c.text || '').trim())) {
    assPath = path.join(RENDERS_DIR, `ugc-${randomUUID().slice(0, 8)}.ass`);
    fs.writeFileSync(assPath, buildUgcAss({ W, H, captions: opts.captions, style: opts.capStyle, pos: opts.capPos }), 'utf8');
    parts.push(`${vTag}subtitles='${subFilterPath(assPath)}'[vout]`);
    vTag = '[vout]';
  }

  // Звук: голос + опц. клип + опц. музыка (normalize=0 — без выравнивания громкостей).
  const aIns: string[] = [`[${voiceIdx}:a]anull[a_v]`];
  const mixTags: string[] = ['[a_v]'];
  if (clipAudio) { aIns.push(`[${clipIdx}:a]volume=0.9[a_c]`); mixTags.push('[a_c]'); }
  if (musicIdx >= 0) {
    const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolumePct) ? (opts.musicVolumePct as number) : 20) / 100));
    const fadeSt = Math.max(0, musT - 1.2);
    aIns.push(`[${musicIdx}:a]volume=${vol.toFixed(2)},afade=t=out:st=${fadeSt.toFixed(2)}:d=1.2[a_m]`); mixTags.push('[a_m]');
  }
  let aTag = '[a_v]';
  if (mixTags.length > 1) { aIns.push(`${mixTags.join('')}amix=inputs=${mixTags.length}:normalize=0:duration=first:dropout_transition=0[aout]`); aTag = '[aout]'; }
  parts.push(...aIns.slice(mixTags.length > 1 ? 0 : 1)); // anull нужен только при миксе

  const fc = parts.join(';');
  const out = `ugc-${randomUUID().slice(0, 8)}.mp4`;
  const outPath = path.join(RENDERS_DIR, out);
  const args = ['-y', ...inputs, '-filter_complex', fc,
    '-map', vTag, '-map', mixTags.length > 1 ? aTag : `${voiceIdx}:a`,
    '-t', Ds, '-r', '30', '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-c:a', 'aac', '-b:a', '192k',
    outPath];
  try {
    await ffmpeg(args, Math.max(600_000, Math.round(D * 9000) + 180_000));
  } finally {
    if (assPath) { try { fs.unlinkSync(assPath); } catch { /* */ } }
  }
  return `/uploads/renders/${out}`;
}

/**
 * «Без аватара — озвучка»: базовый видеоряд во весь кадр (зациклен на длину голоса) + голос
 * (своя запись как есть или TTS) + врезки медиа по таймкодам реплик + верхний слой + полоса
 * прогресса + субтитры + музыка. HeyGen не участвует — цена ролика ≈ только озвучка.
 * Композиция повторяет composeUgc без аватара; loudnorm выравнивает громкость своей записи.
 */
export async function composeVoiceover(opts: {
  clipPath?: string | null;
  clipFit: 'cover' | 'contain';
  clipMuted: boolean;
  voicePath: string;
  loudnorm?: boolean;
  musicPath?: string | null; musicVolumePct?: number; musicDurationSec?: number | null;
  captions: UgcCaption[];
  capStyle: 'none' | 'word' | 'karaoke' | 'plain';
  capPos: 'bottom' | 'center' | 'top';
  dims?: FrameDims;
  inserts?: UgcInsert[] | null;
  layerPath?: string | null;
  progressBar?: boolean;
}): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const W = opts.dims?.W || 1080, H = opts.dims?.H || 1920;
  const D = await probeDuration(opts.voicePath);
  if (!(D > 0.3)) throw new Error('Голосовая дорожка пустая.');
  const Ds = (D + 0.2).toFixed(2);
  const clipAudio = !!opts.clipPath && !opts.clipMuted && await hasAudioStream(opts.clipPath);

  const inputs: string[] = [];
  let idx = 0; let clipIdx = -1;
  if (opts.clipPath) { inputs.push('-stream_loop', '-1', '-t', Ds, '-i', opts.clipPath); clipIdx = idx++; }
  const voiceIdx = idx++; inputs.push('-i', opts.voicePath);
  let musicIdx = -1;
  const musT = Math.min(Number(opts.musicDurationSec) > 0 ? (opts.musicDurationSec as number) : Number.POSITIVE_INFINITY, D + 0.2);
  if (opts.musicPath) { inputs.push('-stream_loop', '-1', '-t', musT.toFixed(2), '-i', opts.musicPath); musicIdx = idx++; }

  const fit = (w: number, h: number) => opts.clipFit === 'contain'
    ? `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0d0f16`
    : `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`;

  const parts: string[] = [];
  let vTag = '[vmain]';
  if (clipIdx >= 0) parts.push(`[${clipIdx}:v]${fit(W, H)},setsar=1,fps=30[vmain]`);
  else parts.push(`color=c=0x0d0f16:s=${W}x${H}:r=30:d=${Ds}[vmain]`);

  const extras = overlayExtras({ startIdx: idx, W, H, D, Ds, inserts: opts.inserts, layerPath: opts.layerPath, progressBar: opts.progressBar, vIn: vTag });
  inputs.push(...extras.inputs); parts.push(...extras.parts); vTag = extras.vOut; idx = extras.nextIdx;

  let assPath: string | null = null;
  if (opts.capStyle !== 'none' && opts.captions.some((c) => c.t1 > c.t0 && String(c.text || '').trim())) {
    assPath = path.join(RENDERS_DIR, `ugc-${randomUUID().slice(0, 8)}.ass`);
    fs.writeFileSync(assPath, buildUgcAss({ W, H, captions: opts.captions, style: opts.capStyle, pos: opts.capPos }), 'utf8');
    parts.push(`${vTag}subtitles='${subFilterPath(assPath)}'[vout]`);
    vTag = '[vout]';
  }

  // Звук: голос (опц. loudnorm — ровная громкость своей записи) + звук клипа + музыка.
  const voiceF = opts.loudnorm ? 'loudnorm=I=-16:TP=-1.5:LRA=11' : 'anull';
  const aIns: string[] = [`[${voiceIdx}:a]${voiceF}[a_v]`];
  const mixTags: string[] = ['[a_v]'];
  if (clipAudio) { aIns.push(`[${clipIdx}:a]volume=0.9[a_c]`); mixTags.push('[a_c]'); }
  if (musicIdx >= 0) {
    const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolumePct) ? (opts.musicVolumePct as number) : 20) / 100));
    aIns.push(`[${musicIdx}:a]volume=${vol.toFixed(2)},afade=t=out:st=${Math.max(0, musT - 1.2).toFixed(2)}:d=1.2[a_m]`); mixTags.push('[a_m]');
  }
  let aTag = '[a_v]';
  if (mixTags.length > 1) { aIns.push(`${mixTags.join('')}amix=inputs=${mixTags.length}:normalize=0:duration=first:dropout_transition=0[aout]`); aTag = '[aout]'; }
  // loudnorm требует прогона голоса через фильтр даже без микса.
  parts.push(...(mixTags.length > 1 || opts.loudnorm ? aIns : []));
  const mapA = mixTags.length > 1 ? aTag : (opts.loudnorm ? '[a_v]' : `${voiceIdx}:a`);

  const fc = parts.join(';');
  const out = `ugc-vo-${randomUUID().slice(0, 8)}.mp4`;
  const outPath = path.join(RENDERS_DIR, out);
  const args = ['-y', ...inputs, '-filter_complex', fc,
    '-map', vTag, '-map', mapA,
    '-t', Ds, '-r', '30', '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-c:a', 'aac', '-b:a', '192k',
    outPath];
  try {
    await ffmpeg(args, Math.max(600_000, Math.round(D * 9000) + 180_000));
  } finally {
    if (assPath) { try { fs.unlinkSync(assPath); } catch { /* */ } }
  }
  return `/uploads/renders/${out}`;
}

// ── UGC-удержание: склейка сегментов (техники показа) в один ролик 1080×1920 ──
export interface RetComposeSeg {
  dur: number;
  layout: 'split' | 'closeup' | 'broll' | 'pip';
  placement: 'top' | 'bottom';          // куда аватар в split
  avatarPath: string | null;            // HeyGen mp4 (непрозрачный) для лицевых сегментов; null → broll
}

/**
 * Собрать ролик удержания: каждый сегмент рендерится своей техникой (crux — единый непрерывный
 * звук поверх всего). Аватар HeyGen синхронен сам; каждый сегмент режется РОВНО в свою длину
 * (tpad клонирует последний кадр, если видео короче), поэтому склейка не уплывает от голоса.
 * Порядок сегментов = порядок таймлайна; их суммарная длина = длине голоса.
 */
export async function composeRetentionVideo(opts: {
  segments: RetComposeSeg[];
  brollPath?: string | null;
  voicePath: string;
  clipFit: 'cover' | 'contain';
  musicPath?: string | null; musicVolumePct?: number;
  musicDurationSec?: number | null;
  layerPath?: string | null; progressBar?: boolean;   // верхний PNG-слой + полоса прогресса (под субтитрами)
  captions: UgcCaption[];
  capStyle: 'none' | 'word' | 'karaoke' | 'plain';
  capPos: 'bottom' | 'center' | 'top';
  dims?: FrameDims;             // 9:16 (портрет, деф.) или 16:9 (ландшафт)
}): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const W = opts.dims?.W || 1080, H = opts.dims?.H || 1920;
  const { landscape, cw, ch, stack } = orientCells(W, H);
  const AVR = 1080 / 1920; // аватар HeyGen всегда портрет
  const D = await probeDuration(opts.voicePath);
  if (!(D > 0.3)) throw new Error('Голосовая дорожка пустая.');
  if (!opts.segments.length) throw new Error('Нет сегментов для склейки.');
  const broll = opts.brollPath || null;
  const cover = (w: number, h: number) => `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},setsar=1`;
  const fitClip = (w: number, h: number) => opts.clipFit === 'contain'
    ? `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0d0f16,setsar=1`
    : cover(w, h);

  const work = fs.mkdtempSync(path.join(RENDERS_DIR, 'ret-'));
  try {
    const clips: string[] = [];
    for (let i = 0; i < opts.segments.length; i++) {
      const s = opts.segments[i];
      const Ds = Math.max(0.3, s.dur).toFixed(2);
      const clip = path.join(work, `s${String(i).padStart(3, '0')}.mp4`);
      const enc = ['-an', '-t', Ds, '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', clip];
      const freeze = `tpad=stop_mode=clone:stop_duration=${Ds}`; // добить длину клоном последнего кадра

      if (s.layout === 'broll' || !s.avatarPath) {
        if (broll) await ffmpeg(['-y', '-stream_loop', '-1', '-t', Ds, '-i', broll, '-vf', `${fitClip(W, H)},fps=30`, ...enc], 300_000);
        else await ffmpeg(['-y', '-f', 'lavfi', '-t', Ds, '-i', `color=0x0d0f16:s=${W}x${H}:r=30`, '-vf', 'fps=30', ...enc], 120_000);
      } else if (s.layout === 'closeup') {
        // портрет: аватар заполняет кадр (cover); ландшафт: портретный аватар по центру + размытый фон
        if (!landscape) await ffmpeg(['-y', '-i', s.avatarPath, '-vf', `${cover(W, H)},fps=30,${freeze}`, ...enc], 300_000);
        else await ffmpeg(['-y', '-i', s.avatarPath, '-filter_complex', placeFilter(0, W, H, AVR, 'v', freeze), '-map', '[v]', ...enc], 300_000);
      } else if (s.layout === 'split') {
        // портрет → верх/низ (vstack), ландшафт → лево/право (hstack)
        const ins = ['-i', s.avatarPath];
        if (broll) ins.push('-stream_loop', '-1', '-t', Ds, '-i', broll);
        const avf = `[0:v]${cover(cw, ch)},fps=30,${freeze}[a]`;
        const clf = broll ? `[1:v]${fitClip(cw, ch)},fps=30[c]` : `color=0x161a24:s=${cw}x${ch}:r=30:d=${Ds}[c]`;
        const st = s.placement === 'bottom' ? stack('c', 'a', 'v') : stack('a', 'c', 'v');
        await ffmpeg(['-y', ...ins, '-filter_complex', `${avf};${clf};${st}`, '-map', '[v]', ...enc], 300_000);
      } else { // pip
        const ins: string[] = [];
        let bg: string;
        if (broll) { ins.push('-stream_loop', '-1', '-t', Ds, '-i', broll); bg = `[0:v]${fitClip(W, H)},fps=30[bg]`; }
        else bg = `color=0x0d0f16:s=${W}x${H}:r=30:d=${Ds}[bg]`;
        ins.push('-i', s.avatarPath);
        const avIdx = broll ? 1 : 0;
        const pv = `[${avIdx}:v]${cover(360, 640)},fps=30,${freeze}[pv]`;
        await ffmpeg(['-y', ...ins, '-filter_complex', `${bg};${pv};[bg][pv]overlay=W-w-32:H-h-48[v]`, '-map', '[v]', ...enc], 300_000);
      }
      clips.push(clip);
    }

    // склейка сегментов (одинаковые параметры → concat demuxer, re-encode для надёжности)
    const listFile = path.join(work, 'list.txt');
    fs.writeFileSync(listFile, clips.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
    const visual = path.join(work, 'visual.mp4');
    await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', visual],
    Math.max(600_000, Math.round(D * 6000) + 120_000));

    // титры на всю длину + непрерывный голос (+ музыка)
    let assPath: string | null = null;
    if (opts.capStyle !== 'none' && opts.captions.some((c) => c.t1 > c.t0 && String(c.text || '').trim())) {
      assPath = path.join(RENDERS_DIR, `ret-${randomUUID().slice(0, 8)}.ass`);
      fs.writeFileSync(assPath, buildUgcAss({ W, H, captions: opts.captions, style: opts.capStyle, pos: opts.capPos }), 'utf8');
    }
    const inputs = ['-i', visual, '-i', opts.voicePath];
    let musicIdx = -1;
    const musT = Math.min(Number(opts.musicDurationSec) > 0 ? (opts.musicDurationSec as number) : Number.POSITIVE_INFINITY, D + 0.2);
    if (opts.musicPath) { inputs.push('-stream_loop', '-1', '-t', musT.toFixed(2), '-i', opts.musicPath); musicIdx = 2; }
    // Верхний слой + полоса прогресса — до субтитров (титры остаются поверх слоя).
    const extras = overlayExtras({ startIdx: musicIdx >= 0 ? 3 : 2, W, H, D, Ds: (D + 0.2).toFixed(2), layerPath: opts.layerPath, progressBar: opts.progressBar, vIn: '[0:v]' });
    inputs.push(...extras.inputs);
    let fc = extras.parts.join(';'); let vTag = extras.parts.length ? extras.vOut : '0:v'; let aTag = '1:a';
    if (assPath) { fc += `${fc ? ';' : ''}${vTag.startsWith('[') ? vTag : `[${vTag}]`}subtitles='${subFilterPath(assPath)}'[vv]`; vTag = '[vv]'; }
    if (musicIdx >= 0) {
      const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolumePct) ? (opts.musicVolumePct as number) : 20) / 100));
      fc += `${fc ? ';' : ''}[${musicIdx}:a]volume=${vol.toFixed(2)},afade=t=out:st=${Math.max(0, musT - 1.2).toFixed(2)}:d=1.2[bg];[1:a][bg]amix=inputs=2:normalize=0:duration=first:dropout_transition=0[aa]`;
      aTag = '[aa]';
    }
    const out = `ugc-ret-${randomUUID().slice(0, 8)}.mp4`;
    const outPath = path.join(RENDERS_DIR, out);
    const args = ['-y', ...inputs];
    if (fc) args.push('-filter_complex', fc);
    args.push('-map', vTag, '-map', aTag, '-t', D.toFixed(2),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', outPath);
    try {
      await ffmpeg(args, Math.max(600_000, Math.round(D * 9000) + 180_000));
    } finally {
      if (assPath) { try { fs.unlinkSync(assPath); } catch { /* */ } }
    }
    return `/uploads/renders/${out}`;
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* */ }
  }
}

// ── Режим «Диалоги»: два аватара + умные раскладки + растяжка медиа ────────────

export type DlgComposeLayout = 'closeup' | 'twoshot' | 'media-full' | 'media-bg-left' | 'media-bg-right' | 'media-split';

/** Сегмент диалога для склейки. */
export interface DlgComposeSeg {
  dur: number;
  layout: DlgComposeLayout;
  avatarPath: string | null;   // лицо говорящего (HeyGen mp4, непрозрачный)
  avatar2Path: string | null;  // второе лицо (реакция) — для twoshot; обычно СТАТИЧНОЕ фото (бесплатно)
  avatar2IsImage?: boolean;    // avatar2Path — картинка (нужен -loop), а не видео
  avatarChroma?: string | null; // hex-цвет фона аватара для вырезки (напр. '0x00FF00') — силуэт поверх медиа
  mediaPath: string | null;    // медиа реплики (локальный файл)
  isVideo: boolean;
  mediaFromSec: number;        // с какой секунды медиа проигрывать (растяжка/держание)
}

/** Один аудио-кусок собираемой мастер-дорожки. */
export interface DlgVoicePart {
  dur: number;
  srcT0: number | null; srcT1: number | null; // окно в записи (речь); null → тишина/медиа
  kind: 'speech' | 'hold';
  mediaPath: string | null; isVideo: boolean; mediaFromSec: number; // для держания видео = свой звук
}

const escFF = (p: string): string => p.replace(/'/g, "'\\''");

/**
 * Собрать НЕПРЕРЫВНУЮ мастер-дорожку голоса диалога с учётом растяжки медиа: речь = срез записи
 * (докладывается тишиной до длины сегмента), держание видео = его собственный звук (иначе тишина).
 * Каждый кусок форсится РОВНО в свою длину (apad + -t) — сумма = сумме видео-сегментов, губы не плывут.
 */
export async function buildDialogueVoice(opts: { recordingPath: string; parts: DlgVoicePart[] }): Promise<{ filePath: string; total: number }> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const work = fs.mkdtempSync(path.join(RENDERS_DIR, 'dlgv-'));
  try {
    const files: string[] = [];
    let total = 0;
    const AENC = ['-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le'];
    const silence = async (p: string, dur: number) => ffmpeg(['-y', '-f', 'lavfi', '-t', dur.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo', ...AENC, p], 60_000);
    for (let i = 0; i < opts.parts.length; i++) {
      const s = opts.parts[i];
      const dur = Math.max(0.05, s.dur);
      const p = path.join(work, `a${String(i).padStart(3, '0')}.wav`);
      if (s.kind === 'speech' && s.srcT0 != null && s.srcT1 != null) {
        const srcDur = Math.max(0.05, s.srcT1 - s.srcT0);
        // срез записи [srcT0 : +srcDur] → apad до dur → трим -t dur (ровно длина сегмента)
        await ffmpeg(['-y', '-ss', s.srcT0.toFixed(3), '-t', srcDur.toFixed(3), '-i', opts.recordingPath, '-af', 'apad', '-t', dur.toFixed(3), ...AENC, p], 120_000)
          .catch(() => silence(p, dur));
      } else if (s.kind === 'hold' && s.isVideo && s.mediaPath) {
        await ffmpeg(['-y', '-ss', Math.max(0, s.mediaFromSec).toFixed(3), '-t', dur.toFixed(3), '-i', s.mediaPath, '-vn', '-af', 'apad', '-t', dur.toFixed(3), ...AENC, p], 120_000)
          .catch(() => silence(p, dur)); // видео без звука → тишина
      } else {
        await silence(p, dur);
      }
      files.push(p); total += dur;
    }
    const listFile = path.join(work, 'list.txt');
    fs.writeFileSync(listFile, files.map((f) => `file '${escFF(f)}'`).join('\n'), 'utf8');
    const out = path.join(RENDERS_DIR, `dlg-voice-${randomUUID().slice(0, 8)}.wav`);
    await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, ...AENC, out], 300_000);
    return { filePath: out, total: Math.round(total * 100) / 100 };
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* */ }
  }
}

/**
 * Склейка ролика-диалога: каждый сегмент — своя техника (крупный план / оба в кадре верх-низ /
 * медиа во весь кадр / медиа-фон + лицо сбоку / медиа+лицо поровну). 16:9-медиа кладётся полосой
 * по центру с размытым фоном (TikTok). Поверх — единый непрерывный голос (voicePath от
 * buildDialogueVoice) + титры + музыка. Длины сегментов форсятся (tpad клонирует кадр).
 */
export async function composeDialogueVideo(opts: {
  segments: DlgComposeSeg[];
  voicePath: string;
  musicPath?: string | null; musicVolumePct?: number;
  musicDurationSec?: number | null;
  layerPath?: string | null; progressBar?: boolean;   // верхний PNG-слой + полоса прогресса (под субтитрами)
  captions: UgcCaption[];
  capStyle: 'none' | 'word' | 'karaoke' | 'plain';
  capPos: 'bottom' | 'center' | 'top';
  dims?: FrameDims;             // 9:16 (портрет, деф.) или 16:9 (ландшафт)
}): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const W = opts.dims?.W || 1080, H = opts.dims?.H || 1920;
  const { landscape, cw, ch, stack } = orientCells(W, H);
  const AVR = 1080 / 1920; // аватар HeyGen всегда портрет
  const D = await probeDuration(opts.voicePath);
  if (!(D > 0.3)) throw new Error('Голосовая дорожка пустая.');
  if (!opts.segments.length) throw new Error('Нет сегментов для склейки.');

  // кэш аспекта медиа
  const ratioCache = new Map<string, number>();
  const mediaRatio = async (p: string): Promise<number> => {
    if (ratioCache.has(p)) return ratioCache.get(p)!;
    const sz = await probeImageSize(p);
    const r = sz && sz.h > 0 ? sz.w / sz.h : 0.5625;
    ratioCache.set(p, r); return r;
  };

  const work = fs.mkdtempSync(path.join(RENDERS_DIR, 'dlg-'));
  try {
    const clips: string[] = [];
    for (let i = 0; i < opts.segments.length; i++) {
      const s = opts.segments[i];
      const Ds = Math.max(0.3, s.dur).toFixed(2);
      const clip = path.join(work, `s${String(i).padStart(3, '0')}.mp4`);
      const enc = ['-an', '-t', Ds, '-r', '30', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', clip];
      const freeze = `tpad=stop_mode=clone:stop_duration=${Ds}`;
      const faceCover = (fi: number, w: number, h: number, out: string) =>
        `[${fi}:v]scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},setsar=1,fps=30,${freeze}[${out}]`;
      const mediaIn = (): string[] => !s.mediaPath ? []
        : s.isVideo ? ['-stream_loop', '-1', '-ss', Math.max(0, s.mediaFromSec).toFixed(3), '-t', Ds, '-i', s.mediaPath]
          : ['-loop', '1', '-t', Ds, '-i', s.mediaPath];

      const hasFace = !!s.avatarPath;
      if (s.layout === 'closeup' || (!s.mediaPath && s.layout !== 'twoshot')) {
        // портрет → аватар заполняет кадр; ландшафт → портретный аватар по центру + размытый фон
        if (hasFace && !landscape) await ffmpeg(['-y', '-i', s.avatarPath!, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,fps=30,${freeze}`, ...enc], 300_000);
        else if (hasFace) await ffmpeg(['-y', '-i', s.avatarPath!, '-filter_complex', placeFilter(0, W, H, AVR, 'v', freeze), '-map', '[v]', ...enc], 300_000);
        else await ffmpeg(['-y', '-f', 'lavfi', '-t', Ds, '-i', `color=0x0d0f16:s=${W}x${H}:r=30`, '-vf', 'fps=30', ...enc], 120_000);
      } else if (s.layout === 'twoshot' && s.avatarPath && s.avatar2Path) {
        // говорящий (видео HeyGen) + реакция второго (обычно СТАТИЧНОЕ фото — бесплатно); портрет=верх/низ, ландшафт=лево/право
        const in2 = s.avatar2IsImage ? ['-loop', '1', '-t', Ds, '-i', s.avatar2Path] : ['-i', s.avatar2Path];
        await ffmpeg(['-y', '-i', s.avatarPath, ...in2, '-filter_complex', `${faceCover(0, cw, ch, 'a')};${faceCover(1, cw, ch, 'b')};${stack('a', 'b', 'v')}`, '-map', '[v]', ...enc], 300_000);
      } else if (s.layout === 'twoshot' && hasFace) {
        // нет второго лица — падаем в крупный план
        if (!landscape) await ffmpeg(['-y', '-i', s.avatarPath!, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,fps=30,${freeze}`, ...enc], 300_000);
        else await ffmpeg(['-y', '-i', s.avatarPath!, '-filter_complex', placeFilter(0, W, H, AVR, 'v', freeze), '-map', '[v]', ...enc], 300_000);
      } else if (s.layout === 'media-full' || !hasFace) {
        const r = s.mediaPath ? await mediaRatio(s.mediaPath) : 0.5625;
        if (s.mediaPath) await ffmpeg(['-y', ...mediaIn(), '-filter_complex', placeFilter(0, W, H, r, 'v'), '-map', '[v]', ...enc], 300_000);
        else await ffmpeg(['-y', '-f', 'lavfi', '-t', Ds, '-i', `color=0x0d0f16:s=${W}x${H}:r=30`, '-vf', 'fps=30', ...enc], 120_000);
      } else if (s.layout === 'media-split' && s.mediaPath) {
        const r = await mediaRatio(s.mediaPath); // медиа в одной ячейке, лицо в другой (портрет=верх/низ, ландшафт=лево/право)
        await ffmpeg(['-y', ...mediaIn(), '-i', s.avatarPath!, '-filter_complex', `${placeFilter(0, cw, ch, r, 'm')};${faceCover(1, cw, ch, 'a')};${stack('m', 'a', 'v')}`, '-map', '[v]', ...enc], 300_000);
      } else if ((s.layout === 'media-bg-left' || s.layout === 'media-bg-right') && s.mediaPath) {
        const r = await mediaRatio(s.mediaPath);
        const x = s.layout === 'media-bg-left' ? '48' : 'W-w-48';
        // Вырезка фона: если аватар отрендерен на однотонном фоне (avatarChroma) — chroma-key + despill →
        // силуэт человека поверх медиа; иначе непрозрачный бокс со своим фоном (как раньше).
        const key = s.avatarChroma ? `,chromakey=${s.avatarChroma}:0.16:0.06,despill=type=green:mix=0.5:expand=0` : '';
        await ffmpeg(['-y', ...mediaIn(), '-i', s.avatarPath!, '-filter_complex', `${placeFilter(0, W, H, r, 'bg')};[1:v]scale=360:640:force_original_aspect_ratio=increase:flags=lanczos,crop=360:640,setsar=1,fps=30,${freeze}${key}[pv];[bg][pv]overlay=${x}:H-h-140[v]`, '-map', '[v]', ...enc], 300_000);
      } else {
        // фолбэк: тёмный кадр
        await ffmpeg(['-y', '-f', 'lavfi', '-t', Ds, '-i', `color=0x0d0f16:s=${W}x${H}:r=30`, '-vf', 'fps=30', ...enc], 120_000);
      }
      clips.push(clip);
    }

    // склейка + непрерывный голос + титры + музыка (как в composeRetentionVideo)
    const listFile = path.join(work, 'list.txt');
    fs.writeFileSync(listFile, clips.map((p) => `file '${escFF(p)}'`).join('\n'), 'utf8');
    const visual = path.join(work, 'visual.mp4');
    await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '30', visual],
      Math.max(600_000, Math.round(D * 6000) + 120_000));

    let assPath: string | null = null;
    if (opts.capStyle !== 'none' && opts.captions.some((c) => c.t1 > c.t0 && String(c.text || '').trim())) {
      assPath = path.join(RENDERS_DIR, `dlg-${randomUUID().slice(0, 8)}.ass`);
      fs.writeFileSync(assPath, buildUgcAss({ W, H, captions: opts.captions, style: opts.capStyle, pos: opts.capPos }), 'utf8');
    }
    const inputs = ['-i', visual, '-i', opts.voicePath];
    let musicIdx = -1;
    const musT = Math.min(Number(opts.musicDurationSec) > 0 ? (opts.musicDurationSec as number) : Number.POSITIVE_INFINITY, D + 0.2);
    if (opts.musicPath) { inputs.push('-stream_loop', '-1', '-t', musT.toFixed(2), '-i', opts.musicPath); musicIdx = 2; }
    // Верхний слой + полоса прогресса — до субтитров (титры остаются поверх слоя).
    const extras = overlayExtras({ startIdx: musicIdx >= 0 ? 3 : 2, W, H, D, Ds: (D + 0.2).toFixed(2), layerPath: opts.layerPath, progressBar: opts.progressBar, vIn: '[0:v]' });
    inputs.push(...extras.inputs);
    let fc = extras.parts.join(';'); let vTag = extras.parts.length ? extras.vOut : '0:v'; let aTag = '1:a';
    if (assPath) { fc += `${fc ? ';' : ''}${vTag.startsWith('[') ? vTag : `[${vTag}]`}subtitles='${subFilterPath(assPath)}'[vv]`; vTag = '[vv]'; }
    if (musicIdx >= 0) {
      const vol = Math.max(0, Math.min(1.5, (Number.isFinite(opts.musicVolumePct) ? (opts.musicVolumePct as number) : 20) / 100));
      fc += `${fc ? ';' : ''}[${musicIdx}:a]volume=${vol.toFixed(2)},afade=t=out:st=${Math.max(0, musT - 1.2).toFixed(2)}:d=1.2[bg];[1:a][bg]amix=inputs=2:normalize=0:duration=first:dropout_transition=0[aa]`;
      aTag = '[aa]';
    }
    const out = `ugc-dlg-${randomUUID().slice(0, 8)}.mp4`;
    const outPath = path.join(RENDERS_DIR, out);
    const args = ['-y', ...inputs];
    if (fc) args.push('-filter_complex', fc);
    args.push('-map', vTag, '-map', aTag, '-t', D.toFixed(2), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', outPath);
    try {
      await ffmpeg(args, Math.max(600_000, Math.round(D * 9000) + 180_000));
    } finally {
      if (assPath) { try { fs.unlinkSync(assPath); } catch { /* */ } }
    }
    return `/uploads/renders/${out}`;
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* */ }
  }
}

