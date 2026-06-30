/**
 * TrendTraffic — стримовое сохранение видео на диск.
 *
 * Качаем исходник из CDN потоком (fetch → stream.pipeline → файл), НЕ буферизуя
 * в память (видео большое). Файл кладётся в uploads/source-videos и сразу доступен
 * по относительному URL /uploads/... (статика смонтирована в server.ts).
 *
 * ⚠️ CDN-ссылки TikTok часто требуют Referer/UA и могут быстро истекать —
 * качать нужно сразу после обнаружения. На 403/ошибку бросаем понятную ошибку.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import { randomUUID } from 'crypto';
import { spawn } from 'node:child_process';
import { fetchYoutubeStreams, fetchYoutubeSignedUrl, pickYoutubeItags } from '../tikhub/tikhub_client.js';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
// src/modules/media → apps/uploads/source-videos (та же база, что у /uploads static).
const OUTPUT_DIR = path.resolve(__dirname_local, '../../../../uploads/source-videos');
try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch { /* best-effort */ }

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface StoredFile {
  mediaUrl: string;
  filePath: string;
  size: number;
  mime: string;
}

async function downloadOne(url: string, opts?: { referer?: string; signal?: AbortSignal }): Promise<StoredFile> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000); // 60с на ссылку
  // Внешний сигнал отмены (фоновое скачивание/«отменить»): пробрасываем в наш controller.
  const onExtAbort = () => controller.abort();
  if (opts?.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onExtAbort, { once: true });
  }
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Referer: opts?.referer || 'https://www.tiktok.com/',
        Accept: '*/*',
      },
      signal: controller.signal,
    });
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
    const ct = resp.headers.get('content-type') || 'video/mp4';
    const ext = /audio|mpeg|mp3/.test(ct) ? 'mp3' : ct.includes('webm') ? 'webm' : ct.includes('quicktime') ? 'mov' : 'mp4';
    const filename = `tt-${randomUUID()}.${ext}`;
    const filePath = path.join(OUTPUT_DIR, filename);
    try {
      await pipeline(Readable.fromWeb(resp.body as any), fs.createWriteStream(filePath));
    } catch (e) {
      // Обрыв/таймаут посреди стрима — не оставляем недокачанный файл на диске.
      try { fs.unlinkSync(filePath); } catch { /* noop */ }
      throw e;
    }
    const size = fs.statSync(filePath).size;
    if (size < 1024) {
      try { fs.unlinkSync(filePath); } catch {}
      throw new Error('файл слишком мал (CDN отдал ошибку, а не видео)');
    }
    return { mediaUrl: `/uploads/source-videos/${filename}`, filePath, size, mime: ct };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      // отличаем отмену пользователем от таймаута
      const e: any = new Error(opts?.signal?.aborted ? 'отменено' : 'таймаут');
      e.name = opts?.signal?.aborted ? 'AbortError' : 'TimeoutError';
      throw e;
    }
    throw new Error(err?.message || String(err));
  } finally {
    clearTimeout(timer);
    if (opts?.signal) opts.signal.removeEventListener('abort', onExtAbort);
  }
}

/**
 * Пробует список ссылок-кандидатов по очереди (no-watermark play_addr первыми) —
 * первая успешная побеждает. На 403/таймаут переходит к следующей.
 */
export async function downloadVideoToDisk(urls: string | string[], opts?: { referer?: string; signal?: AbortSignal }): Promise<StoredFile> {
  const list = (Array.isArray(urls) ? urls : [urls]).filter((u): u is string => !!u && /^https?:/.test(u));
  if (list.length === 0) throw new Error('Нет прямых ссылок для скачивания');
  let lastErr = 'не удалось';
  for (const url of list) {
    try { return await downloadOne(url, opts); }
    catch (e: any) { lastErr = e?.message || String(e); }
  }
  throw new Error(`Скачивание не удалось (перебрал ${list.length} ссыл.): ${lastErr}`);
}

// ── YouTube: скачивание со склейкой ─────────────────────────────────────────
// YouTube отдаёт 1080p только раздельными потоками (видео H.264 + аудио AAC) —
// качаем оба по подписанным ссылкам и склеиваем ffmpeg (-c copy, без перекодирования).
// Файлы крупные → отдельный таймаут + потолок размера (защита диска) + лимит
// одновременных склеек. Фолбэк — прогрессивный mp4 одним файлом.

const YT_TIMEOUT_MS = 240_000;
const YT_MAX_BYTES = 700 * 1024 * 1024;     // потолок на ОДИН поток (видео/аудио)
const YT_MAX_CONCURRENT = 3;                 // одновременных YouTube-скачиваний на инстанс
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg'; // на web-VPS — /usr/bin/ffmpeg
let ytActive = 0;

/** Скачать URL в КОНКРЕТНЫЙ файл (временные video/audio потоки перед склейкой), с
 *  потолком размера: превентивно по Content-Length и на лету по счётчику байт. */
async function fetchStreamToFile(url: string, filePath: string, timeoutMs = YT_TIMEOUT_MS): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const mb = (n: number) => Math.round(n / (1024 * 1024));
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: controller.signal });
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
    const clen = Number(resp.headers.get('content-length') || 0);
    if (clen && clen > YT_MAX_BYTES) throw new Error(`поток слишком большой (${mb(clen)}МБ > ${mb(YT_MAX_BYTES)}МБ)`);
    // Content-Length может отсутствовать/занижаться → режем по фактическим байтам.
    let written = 0;
    const cap = new Transform({
      transform(chunk, _enc, cb) {
        written += chunk.length;
        if (written > YT_MAX_BYTES) { cb(new Error(`поток превысил лимит ${mb(YT_MAX_BYTES)}МБ`)); return; }
        cb(null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(resp.body as any), cap, fs.createWriteStream(filePath));
    } catch (e) {
      try { fs.unlinkSync(filePath); } catch { /* noop */ }
      throw e;
    }
    const size = fs.statSync(filePath).size;
    if (size < 1024) { try { fs.unlinkSync(filePath); } catch { /* noop */ } throw new Error('поток слишком мал'); }
    return size;
  } finally { clearTimeout(timer); }
}

/** ffmpeg -c copy: склейка видеопотока и аудиопотока в mp4 (без перекодирования). */
function ffmpegMux(videoPath: string, audioPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, ['-y', '-loglevel', 'error', '-i', videoPath, '-i', audioPath, '-c', 'copy', '-movflags', '+faststart', outPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr?.on('data', (d) => { if (err.length < 2000) err += String(d); });
    ff.on('error', (e) => reject(new Error(`ffmpeg недоступен (${FFMPEG_BIN}): ${e.message}`)));
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg код ${code}: ${err.slice(0, 300)}`))));
  });
}

/**
 * Скачать YouTube-видео в Галерею: get_video_streams_v2 → лучший H.264 ≤1080p + AAC
 * (подписанные ссылки) → склейка ffmpeg. Фолбэк — прогрессивный mp4 одним файлом
 * (обычно 360p), если adaptive/подпись/ffmpeg не сработали. Причина сбоя склейки не
 * проглатывается, а пробрасывается наверх, если фолбэк тоже недоступен.
 */
export async function downloadYoutubeToDisk(apiKey: string, videoId: string): Promise<StoredFile> {
  if (ytActive >= YT_MAX_CONCURRENT) {
    const e: any = new Error('Сейчас идёт слишком много скачиваний YouTube — попробуйте через минуту.');
    e.status = 503;
    throw e;
  }
  ytActive++;
  try {
    const streams = await fetchYoutubeStreams(apiKey, videoId);
    if (!streams.ok) throw new Error(streams.error || 'Не удалось получить потоки YouTube');
    const pick = pickYoutubeItags(streams.data);
    let muxErr: Error | undefined;

    // 1) Склейка лучшего H.264-видео + AAC-аудио (1080p).
    if (pick.videoItag != null && pick.audioItag != null) {
      const [vUrl, aUrl] = await Promise.all([
        fetchYoutubeSignedUrl(apiKey, videoId, pick.videoItag),
        fetchYoutubeSignedUrl(apiKey, videoId, pick.audioItag),
      ]);
      if (vUrl && aUrl) {
        const id = randomUUID();
        const vTmp = path.join(OUTPUT_DIR, `yt-${id}.vtmp`);
        const aTmp = path.join(OUTPUT_DIR, `yt-${id}.atmp`);
        const outName = `yt-${id}.mp4`;
        const outPath = path.join(OUTPUT_DIR, outName);
        try {
          await fetchStreamToFile(vUrl, vTmp);
          await fetchStreamToFile(aUrl, aTmp);
          await ffmpegMux(vTmp, aTmp, outPath);
          const size = fs.statSync(outPath).size;
          if (size < 1024) throw new Error('склейка дала пустой файл');
          return { mediaUrl: `/uploads/source-videos/${outName}`, filePath: outPath, size, mime: 'video/mp4' };
        } catch (e) {
          muxErr = e as Error; // запомнили реальную причину (ffmpeg/HTTP/лимит) для фолбэка
          try { fs.unlinkSync(outPath); } catch { /* noop */ }
        } finally {
          try { fs.unlinkSync(vTmp); } catch { /* noop */ }
          try { fs.unlinkSync(aTmp); } catch { /* noop */ }
        }
      } else {
        muxErr = new Error('подписанная ссылка YouTube не получена (video/audio)');
      }
    }

    // 2) Фолбэк: прогрессивный mp4 одним файлом.
    if (pick.progItag != null) {
      const pUrl = await fetchYoutubeSignedUrl(apiKey, videoId, pick.progItag);
      if (pUrl) return await downloadVideoToDisk([pUrl], { referer: 'https://www.youtube.com/' });
    }
    throw new Error(muxErr ? `Склейка YouTube не удалась: ${muxErr.message}` : 'Совместимый поток YouTube для скачивания не найден');
  } finally {
    ytActive--;
  }
}
