/**
 * TrendTraffic — серверная обрезка/нарезка видео (движок редактора-просмотрщика).
 *
 *  POST /api/video-edit  — применить операции к видео и вернуть НОВЫЙ файл.
 *
 * Философия как у LosslessCut: всё lossless через ffmpeg `-c copy` (без перекодирования),
 * поэтому операции почти мгновенны даже на длинных роликах → синхронный ответ, без очереди.
 * Рез прилипает к ближайшему ключевому кадру (это нормальное поведение lossless-резки).
 *
 * Операции (передаются как список «сегментов, которые ОСТАВИТЬ» + поворот):
 *   - обрезать начало/конец  → один сегмент [start..end]
 *   - вырезать куски из середины → несколько сегментов → склейка concat-демуксером
 *   - повернуть → метаданные контейнера (rotate), тоже без перекодирования
 *
 * Сохранение неразрушающее: исходник не трогаем, создаём новый файл в uploads/renders
 * и регистрируем media_asset → видео сразу появляется в Галерее.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import ffmpegStatic from 'ffmpeg-static';
import { JWT_SECRET } from '../../config/secrets.js';
import { createAsset } from '../media/assets.js';

const router = Router();

// ── ffmpeg ───────────────────────────────────────────────────────────────────
// На web-VPS обычно /usr/bin/ffmpeg (FFMPEG_PATH), иначе бинарь из пакета ffmpeg-static.
const FFMPEG_BIN: string = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || 'ffmpeg';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
// src/modules/video_edit → apps/uploads (та же база, что у статики /uploads в server.ts)
const UPLOADS_ROOT = path.resolve(__dirname_local, '../../../../uploads');
const RENDERS_DIR = path.join(UPLOADS_ROOT, 'renders');
try { fs.mkdirSync(RENDERS_DIR, { recursive: true }); } catch { /* best-effort */ }

/** Запуск ffmpeg с массивом аргументов. Реджектит понятной ошибкой (хвост stderr). */
function runFfmpeg(args: string[], timeoutMs = 600_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch {} reject(new Error('ffmpeg: таймаут')); }, timeoutMs);
    ff.stderr?.on('data', (d) => { if (err.length < 4000) err += String(d); });
    ff.on('error', (e) => { clearTimeout(timer); reject(new Error(`ffmpeg недоступен (${FFMPEG_BIN}): ${e.message}`)); });
    ff.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg код ${code}: ${err.slice(-400)}`)); });
  });
}

/** Аудиофайлы, для которых редактор работает как аудио-резак (выход .m4a/AAC). */
const AUDIO_RE = /\.(mp3|m4a|aac|wav|ogg|opus|weba|flac)$/i;

/** Вырезать сегмент [start..end] из АУДИО → AAC/m4a (перекод — универсально для mp3/wav/ogg…). */
async function cutSegmentAudio(input: string, start: number, end: number, out: string): Promise<void> {
  const dur = Math.max(0.05, end - start);
  const args = ['-y', '-loglevel', 'error'];
  if (start > 0.001) args.push('-ss', start.toFixed(3));
  args.push('-i', input, '-t', dur.toFixed(3), '-vn', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out);
  await runFfmpeg(args);
}

/** Вырезать один сегмент [start..end] без перекодирования (ключевой кадр ≤ start). */
async function cutSegment(input: string, start: number, end: number, out: string, rotate?: number): Promise<void> {
  const dur = Math.max(0.05, end - start);
  const args = ['-y', '-loglevel', 'error'];
  if (start > 0.001) args.push('-ss', start.toFixed(3));     // input-seek: быстро + прилипает к кейфрейму
  args.push('-i', input, '-t', dur.toFixed(3), '-c', 'copy');
  if (rotate) args.push('-metadata:s:v:0', `rotate=${rotate}`);
  args.push('-movflags', '+faststart', out);
  await runFfmpeg(args);
}

/** Склейка сегментов concat-демуксером (copy; фолбэк — перекод, если контейнеры не сошлись). */
async function concatSegments(parts: string[], out: string, rotate?: number): Promise<void> {
  const listPath = path.join(RENDERS_DIR, `concat-${randomUUID()}.txt`);
  fs.writeFileSync(listPath, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  const base = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listPath];
  const meta = rotate ? ['-metadata:s:v:0', `rotate=${rotate}`] : [];
  try {
    await runFfmpeg([...base, '-c', 'copy', ...meta, '-movflags', '+faststart', out]);
  } catch {
    // редкий случай — стримы сегментов не склеиваются copy: перекодируем
    await runFfmpeg([...base, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', ...meta, '-movflags', '+faststart', out]);
  } finally {
    try { fs.unlinkSync(listPath); } catch {}
  }
}

/**
 * Склейка РАЗНЫХ файлов с нормализацией под общий кадр W×H (concat-фильтр + перекод).
 * Cross-file `-c copy` обычно не сходится (разные кодеки/размеры) → приводим всё к
 * одному размеру/fps/аудио. Фолбэк — видео-склейка без звука (клип без аудиодорожки).
 */
async function mergeNormalized(inputs: string[], out: string, W: number, H: number, rotate?: number): Promise<void> {
  const n = inputs.length;
  const ins: string[] = [];
  inputs.forEach((p) => ins.push('-i', p));
  const meta = rotate ? ['-metadata:s:v:0', `rotate=${rotate}`] : [];
  const vchain = (i: number) =>
    `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p[v${i}];`;

  // 1) с аудио
  let fc = '';
  for (let i = 0; i < n; i++) {
    fc += vchain(i);
    fc += `[${i}:a]aresample=async=1:first_pts=0,aformat=sample_rates=44100:channel_layouts=stereo[a${i}];`;
  }
  let pairs = '';
  for (let i = 0; i < n; i++) pairs += `[v${i}][a${i}]`;
  fc += `${pairs}concat=n=${n}:v=1:a=1[vout][aout]`;
  try {
    await runFfmpeg(['-y', '-loglevel', 'error', ...ins, '-filter_complex', fc,
      '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac',
      ...meta, '-movflags', '+faststart', out], 1_800_000);
    return;
  } catch { /* фолбэк ниже */ }

  // 2) видео-only (если у какого-то клипа нет аудиодорожки)
  let fcv = '';
  for (let i = 0; i < n; i++) fcv += vchain(i);
  let vs = '';
  for (let i = 0; i < n; i++) vs += `[v${i}]`;
  fcv += `${vs}concat=n=${n}:v=1:a=0[vout]`;
  await runFfmpeg(['-y', '-loglevel', 'error', ...ins, '-filter_complex', fcv,
    '-map', '[vout]', '-c:v', 'libx264', '-preset', 'veryfast',
    ...meta, '-movflags', '+faststart', out], 1_800_000);
}

// ── auth (как в render/trends) ────────────────────────────────────────────────
interface AuthedRequest extends Request { tenantId?: string; userRole?: string; }

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

router.use(express.json({ limit: '256kb' }));
router.use(requireAuth);

// ── валидация запроса ─────────────────────────────────────────────────────────
const EditSchema = z.object({
  inputUrl: z.string().min(1),
  // Сегменты, которые ОСТАВИТЬ (в секундах). 1 сегмент = обрезка, несколько = нарезка+склейка.
  segments: z.array(z.object({ start: z.number().min(0), end: z.number().positive() })).max(100).optional(),
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  name: z.string().max(200).optional(),
});

/** /uploads/... → абсолютный путь на диске (с защитой от выхода за uploads). */
function resolveLocalInput(fileUrl: string): string | null {
  if (!fileUrl.startsWith('/uploads/')) return null;
  const abs = path.resolve(UPLOADS_ROOT, fileUrl.slice('/uploads/'.length));
  if (abs !== UPLOADS_ROOT && !abs.startsWith(UPLOADS_ROOT + path.sep)) return null;
  if (!fs.existsSync(abs)) return null;
  return abs;
}

/**
 * POST /api/video-edit
 * body: { inputUrl, segments?: [{start,end}], rotate?: 0|90|180|270, name? }
 * resp: { fileUrl, assetId }
 */
router.post('/', async (req: AuthedRequest, res: Response) => {
  const parsed = EditSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные параметры обрезки' });
  const { inputUrl, rotate, name } = parsed.data;

  const input = resolveLocalInput(inputUrl);
  if (!input) {
    return res.status(400).json({ error: 'Редактировать можно только медиа из сервиса (сначала добавьте его в Галерею).' });
  }

  // Аудио? Тогда работаем как аудио-резак: поворот неприменим, выход .m4a (AAC).
  const isAudio = AUDIO_RE.test(inputUrl);
  const effRotate = isAudio ? undefined : rotate;

  // Сегменты: чистим, сортируем; пустой список = весь файл целиком.
  const segments = (parsed.data.segments || [])
    .filter((s) => s.end - s.start > 0.05)
    .sort((a, b) => a.start - b.start);

  const nothingToCut = segments.length === 0;
  if (nothingToCut && !effRotate) {
    return res.status(400).json({ error: isAudio ? 'Нет изменений для применения (для аудио доступна только обрезка).' : 'Нет изменений для применения.' });
  }

  const ext = isAudio ? 'm4a' : 'mp4';
  const outName = `edited-${randomUUID()}.${ext}`;
  const outPath = path.join(RENDERS_DIR, outName);
  const tmp: string[] = [];

  try {
    if (isAudio) {
      // Аудио: обрезка/нарезка → AAC/m4a (одиночный сегмент или склейка кусков).
      if (segments.length === 1) {
        await cutSegmentAudio(input, segments[0].start, segments[0].end, outPath);
      } else {
        for (const s of segments) {
          const part = path.join(RENDERS_DIR, `part-${randomUUID()}.m4a`);
          tmp.push(part);
          await cutSegmentAudio(input, s.start, s.end, part);
        }
        await concatSegments(tmp, outPath);
      }
    } else if (nothingToCut) {
      // только поворот — копия с метаданными
      await runFfmpeg(['-y', '-loglevel', 'error', '-i', input, '-c', 'copy', '-metadata:s:v:0', `rotate=${effRotate}`, '-movflags', '+faststart', outPath]);
    } else if (segments.length === 1) {
      await cutSegment(input, segments[0].start, segments[0].end, outPath, effRotate);
    } else {
      for (const s of segments) {
        const part = path.join(RENDERS_DIR, `part-${randomUUID()}.mp4`);
        tmp.push(part);
        await cutSegment(input, s.start, s.end, part); // поворот применим на склейке
      }
      await concatSegments(tmp, outPath, effRotate);
    }

    const stat = fs.statSync(outPath);
    if (stat.size < 1024) throw new Error('результат пустой');

    const fileUrl = `/uploads/renders/${outName}`;
    const asset = await createAsset(req.tenantId!, {
      // Аудио кладём в папку «Аудио» (kind='audio'), видео — в «Референс». Иначе обрезанное
      // аудио (kind='reference'+mediaType='audio') не попадало ни в одну вкладку Галереи.
      kind: isAudio ? 'audio' : 'reference',
      mediaType: isAudio ? 'audio' : 'video',
      originalName: name || (isAudio ? 'Обрезанное аудио' : 'Обрезанное видео'),
      fileUrl,
      filePath: outPath,
      mime: isAudio ? 'audio/mp4' : 'video/mp4',
      size: stat.size,
    });

    res.status(201).json({ fileUrl, assetId: asset?.id || null });
  } catch (err: any) {
    try { fs.unlinkSync(outPath); } catch {}
    res.status(500).json({ error: err?.message || 'Не удалось обработать видео' });
  } finally {
    for (const p of tmp) { try { fs.unlinkSync(p); } catch {} }
  }
});

// ── склейка нескольких видео ───────────────────────────────────────────────────
const MergeSchema = z.object({
  clips: z.array(z.object({
    inputUrl: z.string().min(1),
    segments: z.array(z.object({ start: z.number().min(0), end: z.number().positive() })).max(100).optional(),
  })).min(2).max(20),
  width: z.number().int().positive().max(7680).optional(),
  height: z.number().int().positive().max(7680).optional(),
  rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  name: z.string().max(200).optional(),
});

const evenUp = (n: number | undefined, def: number): number => {
  const v = n && n > 0 ? Math.round(n) : def;
  return v % 2 === 0 ? v : v + 1; // libx264 требует чётные размеры
};

/**
 * POST /api/video-edit/merge
 * body: { clips:[{inputUrl, segments?}], width?, height?, rotate?, name? }
 * Каждый клип (с опц. обрезкой) → нормализация под W×H → склейка. Новый файл в Галерею.
 */
router.post('/merge', async (req: AuthedRequest, res: Response) => {
  const parsed = MergeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные параметры склейки' });
  const { rotate, name } = parsed.data;
  const W = evenUp(parsed.data.width, 1080);
  const H = evenUp(parsed.data.height, 1920);

  const prepared: string[] = [];
  const tmp: string[] = [];
  const outName = `merged-${randomUUID()}.mp4`;
  const outPath = path.join(RENDERS_DIR, outName);

  try {
    for (const c of parsed.data.clips) {
      const input = resolveLocalInput(c.inputUrl);
      if (!input) return res.status(400).json({ error: 'Склеивать можно только видео из сервиса (добавьте их в Галерею).' });
      const segs = (c.segments || []).filter((s) => s.end - s.start > 0.05).sort((a, b) => a.start - b.start);
      if (segs.length === 0) { prepared.push(input); continue; }
      if (segs.length === 1) {
        const p = path.join(RENDERS_DIR, `clip-${randomUUID()}.mp4`); tmp.push(p);
        await cutSegment(input, segs[0].start, segs[0].end, p);
        prepared.push(p);
      } else {
        const parts: string[] = [];
        for (const s of segs) {
          const pp = path.join(RENDERS_DIR, `seg-${randomUUID()}.mp4`); tmp.push(pp); parts.push(pp);
          await cutSegment(input, s.start, s.end, pp);
        }
        const merged = path.join(RENDERS_DIR, `clip-${randomUUID()}.mp4`); tmp.push(merged);
        await concatSegments(parts, merged);
        prepared.push(merged);
      }
    }

    await mergeNormalized(prepared, outPath, W, H, rotate);
    const stat = fs.statSync(outPath);
    if (stat.size < 1024) throw new Error('результат пустой');

    const fileUrl = `/uploads/renders/${outName}`;
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: 'video', originalName: name || 'Склейка видео',
      fileUrl, filePath: outPath, mime: 'video/mp4', size: stat.size,
    });
    res.status(201).json({ fileUrl, assetId: asset?.id || null });
  } catch (err: any) {
    try { fs.unlinkSync(outPath); } catch {}
    res.status(500).json({ error: err?.message || 'Не удалось склеить видео' });
  } finally {
    for (const p of tmp) { try { fs.unlinkSync(p); } catch {} }
  }
});

export default router;
