/**
 * Генерация видео через Gemini Omni Flash (`gemini-omni-flash-preview`) — движок блока «Omni Flash».
 *
 * ВАЖНО (проверено вживую на боевом Gemini-ключе 2026-07-01):
 *  - Модель НЕ работает через generateContent (возвращает 400 «This model only supports
 *    Interactions API»). Единственный путь — Interactions API: POST /v1beta/interactions.
 *  - SDK @google/genai v2.6 этот endpoint не оборачивает → шлём сырым fetch.
 *  - Запрос: { model, input:[{type:'text',text}|{type:'image',data,mime_type}],
 *    response_format:{type:'video', aspect_ratio:'16:9'|'9:16', delivery:'uri'},
 *    generation_config:{ video_config:{ task:'text_to_video'|'image_to_video' } } }.
 *  - Ответ СИНХРОННЫЙ: { id, status:'completed', usage, steps:[{type:'thought'},
 *    {type:'model_output', content:[{type:'video', mime_type:'video/mp4', uri}]}] }.
 *  - Видео качаем по uri (в нём уже ?alt=media) добавив &key=..., fetch САМ идёт по 302-редиректу.
 *    На выходе — 720p H.264 + AAC (видео СО ЗВУКОМ), ~10с, ~38с настенного времени.
 *  - Цена (проверено usage): ~5792 токенов/с 720p × $17.5/1M ≈ $0.101/с видео.
 *  - Правка (чат-редактирование): тот же endpoint + previous_interaction_id + task:'edit'.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __vg_dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDERS_DIR = path.resolve(__vg_dirname, '../../../../uploads/renders');
try { fs.mkdirSync(RENDERS_DIR, { recursive: true }); } catch { /* best-effort */ }

const GLA_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const OMNI_VIDEO_MODEL = 'gemini-omni-flash-preview';
export const OMNI_VIDEO_USD_PER_SEC = 5792 * 17.5 / 1_000_000; // ≈ 0.10136 (проверено usage/pricing)

export interface OmniInputImage { base64: string; mime: string }
export interface GeneratedVideo {
  fileUrl: string; filePath: string; size: number; mime: string;
  interactionId?: string;   // для последующих чат-правок
  seconds?: number;         // оценка длины по видео-токенам (usage)
  costUsd?: number;
}

function stripDataPrefix(b64: string): string { return b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64; }

function saveMp4(buf: Buffer): { fileUrl: string; filePath: string; size: number } {
  if (buf.length < 1024) throw new Error('Omni вернул пустое/битое видео');
  const name = `omni-${randomUUID()}.mp4`;
  const filePath = path.join(RENDERS_DIR, name);
  fs.writeFileSync(filePath, buf);
  return { fileUrl: `/uploads/renders/${name}`, filePath, size: buf.length };
}

/** Достать видео (uri или inline data) из ответа Interactions. */
function extractVideo(resp: any): { uri?: string; data?: string; mime?: string } {
  const steps = Array.isArray(resp?.steps) ? resp.steps : [];
  for (const s of steps) {
    if (s?.type !== 'model_output') continue;
    const content = Array.isArray(s.content) ? s.content : (s.content ? [s.content] : []);
    for (const c of content) {
      if (c?.type === 'video' && (c?.uri || c?.data)) {
        return { uri: c.uri, data: c.data, mime: c.mime_type || c.mimeType || 'video/mp4' };
      }
    }
  }
  return {};
}

/** Длина видео (сек) по usage.output_tokens_by_modality (modality=video). */
function videoSecondsFromUsage(resp: any): number | undefined {
  const arr = resp?.usage?.output_tokens_by_modality;
  if (!Array.isArray(arr)) return undefined;
  const v = arr.find((x: any) => x?.modality === 'video');
  const tok = Number(v?.tokens);
  return Number.isFinite(tok) && tok > 0 ? Math.round(tok / 5792) : undefined;
}

/** Скачать видео из Files API по uri (в uri уже ?alt=media → добавляем &key=; fetch идёт по 302). */
async function downloadVideo(uri: string, apiKey: string): Promise<Buffer> {
  const sep = uri.includes('?') ? '&' : '?';
  const r = await fetch(`${uri}${sep}key=${encodeURIComponent(apiKey)}`);
  if (!r.ok) throw new Error(`видео Omni не скачалось (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

async function callInteractions(apiKey: string, body: any): Promise<any> {
  const r = await fetch(`${GLA_BASE}/interactions?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Omni Interactions HTTP ${r.status}: ${d?.error?.message || 'ошибка'}`);
  if (d?.status && d.status !== 'completed') {
    // На практике ответ синхронный (completed). Если preview начнёт возвращать pending — здесь понадобится поллинг по d.id.
    throw new Error(`Omni вернул статус «${d.status}» (ожидался completed)`);
  }
  return d;
}

export interface GenerateOmniVideoInput {
  apiKey: string; model?: string; prompt: string;
  inputImage?: OmniInputImage;      // image_to_video
  aspect?: '16:9' | '9:16';
}

/** Сгенерировать видео (текст→видео или кадр→видео) через Omni Flash. */
export async function generateOmniVideo(input: GenerateOmniVideoInput): Promise<GeneratedVideo> {
  if (!input.apiKey) throw new Error('нет Gemini-ключа для Omni Flash');
  const parts: any[] = [];
  const isImg = !!input.inputImage?.base64;
  if (isImg) parts.push({ type: 'image', data: stripDataPrefix(input.inputImage!.base64), mime_type: input.inputImage!.mime || 'image/jpeg' });
  parts.push({ type: 'text', text: input.prompt });

  const resp = await callInteractions(input.apiKey, {
    model: input.model || OMNI_VIDEO_MODEL,
    input: parts,
    response_format: { type: 'video', aspect_ratio: input.aspect || '9:16', delivery: 'uri' },
    generation_config: { video_config: { task: isImg ? 'image_to_video' : 'text_to_video' } },
  });

  const { uri, data, mime } = extractVideo(resp);
  const buf = uri ? await downloadVideo(uri, input.apiKey) : data ? Buffer.from(stripDataPrefix(data), 'base64') : null;
  if (!buf) throw new Error('Omni не вернул видео (проверьте доступ к модели / фильтр безопасности)');
  const saved = saveMp4(buf);
  const seconds = videoSecondsFromUsage(resp);
  return {
    ...saved, mime: mime || 'video/mp4',
    interactionId: typeof resp?.id === 'string' ? resp.id : undefined,
    seconds, costUsd: seconds ? +(seconds * OMNI_VIDEO_USD_PER_SEC).toFixed(3) : undefined,
  };
}

export interface EditOmniVideoInput {
  apiKey: string; model?: string; previousInteractionId: string; prompt: string; aspect?: '16:9' | '9:16';
}

/** Чат-правка ранее сгенерированного видео (та же сессия Interactions). Видео НЕ перезаливаем. */
export async function editOmniVideo(input: EditOmniVideoInput): Promise<GeneratedVideo> {
  if (!input.apiKey) throw new Error('нет Gemini-ключа');
  if (!input.previousInteractionId) throw new Error('нет previous_interaction_id для правки');
  // generation_config/response_format — interaction-scoped: дублируем каждый ход (наследуется только история).
  const resp = await callInteractions(input.apiKey, {
    model: input.model || OMNI_VIDEO_MODEL,
    previous_interaction_id: input.previousInteractionId,
    input: [{ type: 'text', text: input.prompt }],
    response_format: { type: 'video', aspect_ratio: input.aspect || '9:16', delivery: 'uri' },
    generation_config: { video_config: { task: 'edit' } },
  });
  const { uri, data, mime } = extractVideo(resp);
  const buf = uri ? await downloadVideo(uri, input.apiKey) : data ? Buffer.from(stripDataPrefix(data), 'base64') : null;
  if (!buf) throw new Error('Omni не вернул правленое видео');
  const saved = saveMp4(buf);
  const seconds = videoSecondsFromUsage(resp);
  return {
    ...saved, mime: mime || 'video/mp4',
    interactionId: typeof resp?.id === 'string' ? resp.id : undefined,
    seconds, costUsd: seconds ? +(seconds * OMNI_VIDEO_USD_PER_SEC).toFixed(3) : undefined,
  };
}
