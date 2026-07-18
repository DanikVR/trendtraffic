/**
 * ИИ-вырезка фона видео-аватара через Replicate (arielreplicate/robust_video_matting).
 * Хромакей режет только однотонный фон — матинг вырезает ЛЮБОЙ (комната, улица).
 * Считает облако по BYO-ключу тенанта (Настройки → Генерация → Replicate) — домашний
 * GPU-ПК не нужен (локальный matting-worker/ остался в репо как standalone-запасной путь,
 * прод им НЕ пользуется).
 *
 * Схема: POST /v1/predictions {version, input:{input_video, output_type:'alpha-mask'}}
 * → поллинг /v1/predictions/{id} (кап 20 мин — модель бывает холодной) → маска (видео,
 * белое=человек) → локальный alphamerge с ИСХОДНИКОМ → webm VP9 с альфа-каналом →
 * composeUgc как avatarKind='alpha' (тот же контракт, что sr-capture). Маска накладывается
 * на оригинал без хромакея — нет зелёных ореолов; звук остаётся в исходнике (voicePath).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import ffmpegStatic from 'ffmpeg-static';
import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';

const __d = path.dirname(fileURLToPath(import.meta.url));
const RENDERS_DIR = path.resolve(__d, '../../../../uploads/renders');
const FFMPEG_BIN: string = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || 'ffmpeg';

const API = 'https://api.replicate.com/v1';
const MODEL = 'arielreplicate/robust_video_matting';
const POLL_MS = 5000;
const POLL_MAX_MS = 20 * 60_000; // модель «Cold» — первый прогон грузит веса минутами

/** Сообщение «не подключено» — UI ведёт кнопкой в Настройки → Генерация. */
export const MATTING_NO_KEY_MSG =
  'Для ИИ-вырезки фона подключите Replicate: Настройки → Генерация → Replicate (API-токен), либо выберите вырезку хромакеем.';

// Версия модели резолвится по API и кэшируется (хардкод-хэш протухает при обновлении модели).
let versionCache: { id: string; ts: number } | null = null;

async function resolveVersion(key: string): Promise<string> {
  if (versionCache && Date.now() - versionCache.ts < 3600_000) return versionCache.id;
  const r = await fetch(`${API}/models/${MODEL}`, {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`Replicate: модель недоступна (HTTP ${r.status})`);
  const j = await r.json() as { latest_version?: { id?: string } };
  const id = String(j.latest_version?.id || '');
  if (!id) throw new Error('Replicate: у модели нет версии (ответ без latest_version)');
  versionCache = { id, ts: Date.now() };
  return id;
}

function ffmpeg(args: string[], timeoutMs = 900_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => { err += d.toString(); });
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } reject(new Error('ffmpeg: таймаут alphamerge')); }, timeoutMs);
    ff.on('error', (e) => { clearTimeout(timer); reject(new Error(`ffmpeg недоступен: ${e.message}`)); });
    ff.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg код ${code}: ${err.slice(-350)}`)); });
  });
}

/** Вырезать фон видео через Replicate → путь к локальному webm с альфой (uploads/renders).
 *  videoUrl — АБСОЛЮТНЫЙ URL исходника (Replicate скачивает его сам, нужен PUBLIC_BASE_URL);
 *  origPath — локальный путь ТОГО ЖЕ исходника (на него накладывается маска).
 *  Ошибки — человеческие (нет ключа / модель упала / таймаут). */
export async function mattingCutout(opts: {
  tenantId: string;
  videoUrl: string;
  origPath: string;
  onStatus?: (s: string) => void;
}): Promise<string> {
  const key = await getEffectiveProviderKey(opts.tenantId, 'replicate');
  if (!key) throw new Error(MATTING_NO_KEY_MSG);
  if (!/^https?:\/\//i.test(opts.videoUrl)) {
    throw new Error('ИИ-вырезка: нужен публичный URL видео (PUBLIC_BASE_URL не настроен?).');
  }

  // 1) создать предсказание (alpha-mask: видео-маска, белое = человек)
  opts.onStatus?.('ИИ-вырезка фона (Replicate)…');
  const version = await resolveVersion(key);
  let predId = '';
  {
    const r = await fetch(`${API}/predictions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, input: { input_video: opts.videoUrl, output_type: 'alpha-mask' } }),
      signal: AbortSignal.timeout(30_000),
    });
    const j = await r.json().catch(() => ({})) as any;
    if (r.status === 401 || r.status === 403) throw new Error('Replicate: токен невалиден — проверьте ключ в Настройки → Генерация.');
    if (r.status === 402) throw new Error('Replicate: нет баланса на аккаунте — пополните биллинг Replicate.');
    if (!r.ok || !j?.id) throw new Error(`Replicate: задача не создалась (HTTP ${r.status}${j?.detail ? `: ${String(j.detail).slice(0, 160)}` : ''})`);
    predId = String(j.id);
  }

  // 2) поллинг (единичный сетевой сбой не валит джоб)
  const t0 = Date.now();
  let outputUrl = '';
  while (Date.now() - t0 < POLL_MAX_MS) {
    await new Promise((res) => setTimeout(res, POLL_MS));
    let p: any = null;
    try {
      const r = await fetch(`${API}/predictions/${predId}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) });
      if (r.ok) p = await r.json();
    } catch { /* транзиентный сбой — опросим ещё раз */ }
    if (!p) continue;
    const st = String(p.status || '');
    if (st === 'succeeded') {
      const out = Array.isArray(p.output) ? p.output[0] : p.output;
      outputUrl = String(out || '');
      break;
    }
    if (st === 'failed' || st === 'canceled') {
      throw new Error(`ИИ-вырезка не удалась (Replicate): ${String(p.error || st).slice(0, 200)}`);
    }
    const sec = Math.round((Date.now() - t0) / 1000);
    opts.onStatus?.(st === 'starting' ? `ИИ-вырезка: модель прогревается (${sec}с)…` : `ИИ-вырезка фона (Replicate, ${sec}с)…`);
  }
  if (!outputUrl) throw new Error('ИИ-вырезка: не дождались Replicate (таймаут 20 мин). Попробуйте ещё раз.');

  // 3) скачать маску
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const maskPath = path.join(RENDERS_DIR, `ugcmask-${randomUUID().slice(0, 8)}.mp4`);
  const r = await fetch(outputUrl, { signal: AbortSignal.timeout(180_000) });
  if (!r.ok) throw new Error(`ИИ-вырезка: маска не скачалась (HTTP ${r.status}).`);
  fs.writeFileSync(maskPath, Buffer.from(await r.arrayBuffer()));

  // 4) alphamerge: исходник + маска → webm VP9 с альфой (без звука — voicePath отдельно).
  // shortest: страховка от лишнего хвоста, если длина маски разойдётся на кадр.
  opts.onStatus?.('ИИ-вырезка: собираю прозрачное видео…');
  const outPath = path.join(RENDERS_DIR, `ugcmat-${randomUUID().slice(0, 8)}.webm`);
  try {
    await ffmpeg(['-y', '-i', opts.origPath, '-i', maskPath,
      '-filter_complex', '[1:v]format=gray[a];[0:v][a]alphamerge,format=yuva420p[v]',
      '-map', '[v]', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
      '-crf', '32', '-b:v', '0', '-cpu-used', '6', '-row-mt', '1', '-an', '-shortest',
      outPath]);
  } finally {
    try { fs.unlinkSync(maskPath); } catch { /* */ }
  }
  return outPath;
}
