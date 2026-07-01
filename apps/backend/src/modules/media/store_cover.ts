/**
 * TrendTraffic — локальное кэширование обложек трендов.
 *
 * TikTok/Instagram отдают ПОДПИСАННЫЕ CDN-обложки (…-sign.tiktokcdn-eu.com/…?x-expires=…),
 * подпись которых истекает через часы-сутки. Если хранить саму ссылку (как раньше), то на
 * следующий день CDN отдаёт 403 → cover-прокси возвращает 404 → <img> прячется → обложка
 * пропадает. Поэтому СРАЗУ после скана качаем картинку к себе в uploads/covers и подменяем
 * cover_url на стабильный локальный URL — тогда обложка живёт столько же, сколько запись видео.
 *
 * Формат сохраняем как отдал CDN (jpeg/webp/png). Мелкие файлы (~10–50 КБ), чистятся при
 * удалении видео (deleteCachedCover). Статика uploads/ смонтирована в server.ts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

const __dir = path.dirname(fileURLToPath(import.meta.url));
// src/modules/media → apps/uploads/covers (та же база, что у /uploads static).
const COVERS_DIR = path.resolve(__dir, '../../../../uploads/covers');
try { fs.mkdirSync(COVERS_DIR, { recursive: true }); } catch { /* best-effort */ }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Истекающие подписанные CDN площадок — их и кэшируем. ytimg (YouTube) стабилен и не
// истекает → его не трогаем (лишний диск). Тот же список, что в белом списке cover-прокси.
const EXPIRING_CDN = /(?:^|\.)(?:tiktokcdn(?:-eu|-us|-in)?\.com|ibyteimg\.com|byteimg\.com|muscdn\.com|tiktokv\.com|pstatp\.com|cdninstagram\.com|fbcdn\.net)$/i;

/** true, если это подписанная (истекающая) обложка площадки, которую стоит закэшировать локально. */
export function isExpiringCover(url?: string | null): boolean {
  if (!url || !/^https:/i.test(url)) return false;
  try { return EXPIRING_CDN.test(new URL(url).hostname); } catch { return false; }
}

function refererFor(host: string): string {
  if (/tiktok|byteimg|muscdn|pstatp/i.test(host)) return 'https://www.tiktok.com/';
  if (/instagram|fbcdn/i.test(host)) return 'https://www.instagram.com/';
  return 'https://www.google.com/';
}

function extFor(ct: string): string {
  if (/png/i.test(ct)) return 'png';
  if (/webp/i.test(ct)) return 'webp';
  if (/gif/i.test(ct)) return 'gif';
  return 'jpg';
}

export interface StoredCover { mediaUrl: string; filePath: string }

/**
 * Скачивает обложку (с правильным Referer площадки) в uploads/covers и возвращает
 * стабильный локальный URL. Бросает при не-изображении/ошибке — вызывающий ловит best-effort.
 */
export async function cacheCoverToDisk(url: string): Promise<StoredCover> {
  const u = new URL(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const resp = await fetch(url, {
      headers: { Referer: refererFor(u.hostname), 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*' },
      signal: controller.signal,
    });
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);
    const ct = resp.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//i.test(ct)) throw new Error(`не изображение (${ct})`);
    const filename = `cov-${randomUUID()}.${extFor(ct)}`;
    const filePath = path.join(COVERS_DIR, filename);
    try {
      await pipeline(Readable.fromWeb(resp.body as any), fs.createWriteStream(filePath));
    } catch (e) {
      try { fs.unlinkSync(filePath); } catch { /* noop */ }
      throw e;
    }
    const size = fs.statSync(filePath).size;
    if (size < 256) { try { fs.unlinkSync(filePath); } catch { /* noop */ } throw new Error('файл слишком мал (CDN отдал ошибку)'); }
    return { mediaUrl: `/uploads/covers/${filename}`, filePath };
  } finally {
    clearTimeout(timer);
  }
}

/** Удаляет локально закэшированную обложку по её URL (только наш /uploads/covers/…). */
export function deleteCachedCover(coverUrl?: string | null): void {
  if (!coverUrl || !coverUrl.startsWith('/uploads/covers/')) return;
  try { fs.unlinkSync(path.join(COVERS_DIR, path.basename(coverUrl))); } catch { /* файла может не быть */ }
}
