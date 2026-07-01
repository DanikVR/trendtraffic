/**
 * Извлечение одного кадра из видео (ffmpeg) — для блока «Omni Flash».
 *
 * Зачем: (#3) взять СТАРТ-кадр из исходника в позиции окна (→ image_to_video seed);
 *        (#4) взять ПОСЛЕДНИЙ кадр сгенерированного клипа → старт следующего окна (сшивка-продолжение).
 *
 * Вход — публичный /uploads/... путь ИЛИ http(s)-URL (ffmpeg читает http сам). Выход — JPEG в
 * uploads/renders (публичный URL), затем вызывающий кладёт его в Галерею через createAsset.
 *
 * Безопасность: локальный вход не выходит за uploads/ (traversal-guard); http-хост не может быть
 *   приватным/loopback/metadata (SSRF-guard). Последний кадр берём end-relative seek (-sseof),
 *   без ffprobe — ffmpeg-static не поставляет ffprobe, полагаться на него нельзя.
 * Точность seek — по ближайшему кадру (юзер согласился, что кадро-точность не нужна).
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

/** Публичный /uploads/... путь или http-URL → вход, читаемый ffmpeg. */
function resolveInput(videoUrl: string, publicBase: string): string {
  if (/^https?:\/\//i.test(videoUrl)) return videoUrl;               // ffmpeg читает http напрямую
  const rel = videoUrl.replace(/^\/+/, '');
  if (rel.startsWith('uploads/')) return path.join(UPLOADS_ROOT, rel.slice('uploads/'.length));
  if (publicBase && videoUrl.startsWith('/')) return publicBase.replace(/\/+$/, '') + videoUrl;
  return videoUrl;
}

/** Приватный/loopback/link-local/metadata хост — блокируем (SSRF). Публичные CDN разрешены. */
function isPrivateHost(hostRaw: string): boolean {
  const host = hostRaw.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local')) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;          // 172.16.0.0/12
  if (/^(fc|fd)[0-9a-f]{2}:/.test(host) || host.startsWith('fe80:')) return true; // ULA / link-local IPv6
  return false;
}

/** Проверить, что вход безопасен: локальный — внутри uploads; http — не приватный хост. */
function assertSafeInput(input: string): void {
  if (/^https?:\/\//i.test(input)) {
    let host = '';
    try { host = new URL(input).hostname; } catch { throw new Error('битый URL видео'); }
    if (isPrivateHost(host)) throw new Error('недопустимый адрес видео (внутренний хост)');
    return;
  }
  const root = path.resolve(UPLOADS_ROOT);
  const resolved = path.resolve(input);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('недопустимый путь к видео');
}

export interface ExtractedFrame { fileUrl: string; filePath: string; mime: string; size: number; }

/** Извлечь кадр: в момент timeSec, либо последний кадр (last=true). → JPEG в uploads/renders. */
export async function extractFrame(opts: { videoUrl: string; timeSec?: number; last?: boolean; publicBase?: string }): Promise<ExtractedFrame> {
  if (!opts.videoUrl) throw new Error('нет видео для извлечения кадра');
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const input = resolveInput(opts.videoUrl, opts.publicBase || '');
  assertSafeInput(input);

  const name = `frame-${randomUUID()}.jpg`;
  const filePath = path.join(RENDERS_DIR, name);
  const cleanup = () => { try { fs.unlinkSync(filePath); } catch { /* нет файла — ок */ } };

  // last: end-relative seek (-sseof) — без ffprobe. Иначе fast-seek по времени (-ss до -i).
  const t = Math.max(0, Number(opts.timeSec) || 0);
  const seekArgs = opts.last ? ['-sseof', '-0.5'] : ['-ss', t.toFixed(3)];
  const args = [...seekArgs, '-i', input, '-frames:v', '1', '-q:v', '3', '-y', filePath];

  try {
    await new Promise<void>((resolve, reject) => {
      const ff = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      ff.stderr.on('data', (d) => { err += d.toString(); });
      const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } reject(new Error('ffmpeg: таймаут извлечения кадра')); }, 60_000);
      ff.on('error', (e) => { clearTimeout(timer); reject(new Error(`ffmpeg недоступен: ${e.message}`)); });
      ff.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg код ${code}: ${err.slice(-300)}`)); });
    });
    let size = 0;
    try { size = fs.statSync(filePath).size; } catch { /* */ }
    if (!size) { cleanup(); throw new Error('кадр не извлёкся (пустой файл) — проверьте позицию/доступ к видео'); }
    return { fileUrl: `/uploads/renders/${name}`, filePath, mime: 'image/jpeg', size };
  } catch (e) {
    cleanup();                 // не оставляем битый/пустой jpg в публичной папке
    throw e;
  }
}
