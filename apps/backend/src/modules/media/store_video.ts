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
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

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
    const ext = ct.includes('webm') ? 'webm' : ct.includes('quicktime') ? 'mov' : 'mp4';
    const filename = `tt-${randomUUID()}.${ext}`;
    const filePath = path.join(OUTPUT_DIR, filename);
    await pipeline(Readable.fromWeb(resp.body as any), fs.createWriteStream(filePath));
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
