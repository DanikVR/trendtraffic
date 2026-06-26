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

export async function downloadVideoToDisk(url: string, opts?: { referer?: string }): Promise<StoredFile> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000); // 60с на скачивание — чтобы провал виделся быстрее
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Referer: opts?.referer || 'https://www.tiktok.com/',
        Accept: '*/*',
      },
      signal: controller.signal,
    });
    if (!resp.ok || !resp.body) {
      throw new Error(`HTTP ${resp.status} при скачивании видео`);
    }
    const ct = resp.headers.get('content-type') || 'video/mp4';
    const ext = ct.includes('webm') ? 'webm' : ct.includes('quicktime') ? 'mov' : 'mp4';
    const filename = `tt-${randomUUID()}.${ext}`;
    const filePath = path.join(OUTPUT_DIR, filename);
    await pipeline(Readable.fromWeb(resp.body as any), fs.createWriteStream(filePath));
    const size = fs.statSync(filePath).size;
    if (size < 1024) {
      // Подозрительно мелкий файл — вероятно отдали HTML-ошибку, а не видео.
      try { fs.unlinkSync(filePath); } catch {}
      throw new Error('Скачанный файл слишком мал (вероятно, CDN отдал ошибку, а не видео).');
    }
    return { mediaUrl: `/uploads/source-videos/${filename}`, filePath, size, mime: ct };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    throw new Error(aborted ? 'Таймаут скачивания видео' : (err?.message || String(err)));
  } finally {
    clearTimeout(timer);
  }
}
