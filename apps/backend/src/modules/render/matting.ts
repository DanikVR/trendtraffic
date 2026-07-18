/**
 * ИИ-вырезка фона видео-аватара: клиент матинг-воркера (RobustVideoMatting на GPU-ПК
 * по Tailscale, см. matting-worker/README.md). Хромакей режет только однотонный фон —
 * матинг вырезает ЛЮБОЙ (комната, улица). Веб-VPS без GPU, поэтому считает воркер.
 *
 * Протокол — async job+poll (инференс идёт минуты, длинное HTTP-соединение рвётся
 * по таймаутам fetch/undici/форвардера — урок старого GPU-/avatar):
 *   POST /matting {video_url} → {job_id}; GET /matting/status?job=; GET /files/<name>.
 * Результат — webm VP9 с альфа-каналом → composeUgc как avatarKind='alpha'
 * (тот же контракт, что sr-capture-webm). Звук остаётся из исходника (voicePath).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { getMattingWorkerUrl } from '../../config/systemConfig.js';

const __d = path.dirname(fileURLToPath(import.meta.url));
const RENDERS_DIR = path.resolve(__d, '../../../../uploads/renders');

const POLL_MS = 5000;
const POLL_MAX_MS = 40 * 60_000; // как workerAvatar: долгие клипы + очередь на GPU-локе

/** Вырезать фон видео на матинг-воркере → путь к локальному webm с альфой (uploads/renders).
 *  videoUrl — АБСОЛЮТНЫЙ URL исходника (воркер скачивает его сам, ему нужен PUBLIC_BASE_URL).
 *  onStatus — прогресс для статуса джоба («ИИ-вырезка фона 43%»). Ошибки — человеческие. */
export async function mattingCutout(opts: { videoUrl: string; onStatus?: (s: string) => void }): Promise<string> {
  const base = getMattingWorkerUrl();
  if (!base) {
    throw new Error('ИИ-вырезка не настроена: укажите mattingWorkerUrl (адрес GPU-воркера) в system-config, либо выберите вырезку хромакеем.');
  }
  if (!/^https?:\/\//i.test(opts.videoUrl)) {
    throw new Error('ИИ-вырезка: нужен публичный URL видео (PUBLIC_BASE_URL не настроен?).');
  }

  // 1) запуск джоба
  let jobId = '';
  try {
    const r = await fetch(`${base}/matting`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ video_url: opts.videoUrl }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json() as { job_id?: string };
    jobId = String(j.job_id || '');
  } catch (e: any) {
    throw new Error(`ИИ-вырезка: GPU-воркер недоступен (${String(e?.message || e).slice(0, 120)}). Проверьте, что домашний ПК включён, либо выберите хромакей.`);
  }
  if (!jobId) throw new Error('ИИ-вырезка: воркер не вернул job_id.');

  // 2) поллинг (сетевые сбои единичного опроса не валят джоб — воркер продолжает считать)
  const t0 = Date.now();
  let outputName = '';
  while (Date.now() - t0 < POLL_MAX_MS) {
    await new Promise((res) => setTimeout(res, POLL_MS));
    let st: { status?: string; progress?: number; output_name?: string; error?: string } | null = null;
    try {
      const r = await fetch(`${base}/matting/status?job=${encodeURIComponent(jobId)}`, { signal: AbortSignal.timeout(20_000) });
      if (r.ok) st = await r.json() as any;
    } catch { /* транзиентный сбой сети/форвардера — опросим ещё раз */ }
    if (!st) continue;
    if (st.status === 'done' && st.output_name) { outputName = String(st.output_name); break; }
    if (st.status === 'failed') throw new Error(`ИИ-вырезка не удалась: ${String(st.error || 'ошибка воркера').slice(0, 200)}`);
    if (st.status === 'not_found') throw new Error('ИИ-вырезка: воркер потерял задачу (рестарт?). Попробуйте ещё раз.');
    opts.onStatus?.(`ИИ-вырезка фона ${Math.max(0, Math.min(99, Number(st.progress) || 0))}%`);
  }
  if (!outputName) throw new Error('ИИ-вырезка: не дождались результата (таймаут 40 мин).');

  // 3) скачать webm (расширение сохраняем — composeUgc декодит его как vp9-альфу)
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const filePath = path.join(RENDERS_DIR, `ugcmat-${randomUUID().slice(0, 8)}.webm`);
  const r = await fetch(`${base}/files/${encodeURIComponent(outputName)}`, { signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`ИИ-вырезка: результат не скачался (HTTP ${r.status}).`);
  fs.writeFileSync(filePath, Buffer.from(await r.arrayBuffer()));
  return filePath;
}
