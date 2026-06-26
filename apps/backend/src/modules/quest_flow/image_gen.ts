/**
 * Движок генерации/преобразования изображений для Quest Flow (Фаза 1).
 *
 * Единый примитив: промт + массив входных картинок (0..N). По числу/роли картинок
 * это автоматически становится генерацией с нуля, правкой, композицией или коллажем —
 * отдельных веток в API нет (так устроена линейка Gemini «Nano Banana»).
 *
 *  - Nano Banana (gemini-*-image*)  → ai.models.generateContent с responseModalities:[IMAGE];
 *    принимает входные картинки → умеет правку/композицию/коллаж. Несколько картинок:
 *    при небольшом суммарном объёме шлём inline (base64); при крупном — заливаем через
 *    Files API (fileUri), чтобы не упереться в ~20 МБ лимит размера запроса.
 *  - Imagen (imagen-*)              → ai.models.generateImages; ТОЛЬКО генерация с нуля.
 *
 * Лимит по числу входов: MAX_TOTAL_INPUT_IMAGES (= потолок Nano Banana Pro). Лишние входы
 * отбрасываются с предупреждением в лог (без «тихого» усечения).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __ig_filename = fileURLToPath(import.meta.url);
const __ig_dirname = path.dirname(__ig_filename);
const OUTPUT_DIR = path.resolve(__ig_dirname, '../../../../uploads/enterprise-chat');
try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch { /* best-effort */ }

/** Жёсткий потолок числа входных картинок (= лимит Nano Banana Pro, gemini-3-pro-image). */
export const MAX_TOTAL_INPUT_IMAGES = 14;

/** Порог суммарного объёма входов, выше которого переключаемся с inline на Files API. */
const INLINE_TOTAL_LIMIT_BYTES = 14 * 1024 * 1024;

/** Картинка на входе модели (правка/композиция/референс/коллаж). */
export interface GenInputImage {
  /** base64 (допускается префикс data:). */
  base64: string;
  mime: string;
}

export interface GeneratedImage {
  /** Относительный URL (/uploads/enterprise-chat/...). */
  mediaUrl: string;
  mediaMime: string;
  mediaSize: number;
  filePath: string;
}

function extForImageMime(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('png')) return '.png';
  if (m.includes('webp')) return '.webp';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  return '.png';
}

/** Сохраняет base64-картинку на диск, возвращает media-метаданные. */
export function saveGeneratedImage(base64: string, mime: string): GeneratedImage {
  const cleaned = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const buf = Buffer.from(cleaned, 'base64');
  if (buf.length === 0) throw new Error('Модель вернула пустое изображение');
  const filename = `qf-gen-${randomUUID()}${extForImageMime(mime)}`;
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, buf);
  return {
    mediaUrl: `/uploads/enterprise-chat/${filename}`,
    mediaMime: mime || 'image/png',
    mediaSize: buf.length,
    filePath,
  };
}

/** Признак временной перегрузки модели (503/429) — повторяем. */
function isTransient(err: any): boolean {
  const msg = String(err?.message || err || '');
  return /\b(503|429)\b/.test(msg) || /UNAVAILABLE|high demand|overloaded|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isTransient(err)) {
        await new Promise((r) => setTimeout(r, 900 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/** Декодированный вход: буфер + mime. */
interface DecodedInput {
  buf: Buffer;
  mime: string;
}

/**
 * Заливает картинку через Files API и возвращает Part(fileUri) + путь временного файла
 * (для последующей очистки). Картинки обычно становятся ACTIVE сразу, но на всякий случай
 * ждём недолго.
 */
async function uploadInputViaFilesApi(
  ai: any,
  input: DecodedInput
): Promise<{ part: any; tempPath: string }> {
  const { createPartFromUri } = await import('@google/genai');
  const tempPath = path.join(os.tmpdir(), `qf-up-${randomUUID()}${extForImageMime(input.mime)}`);
  fs.writeFileSync(tempPath, input.buf);
  try {
    let file = await ai.files.upload({ file: tempPath, config: { mimeType: input.mime || 'image/jpeg' } });
    const deadline = Date.now() + 30_000;
    while (file?.state === 'PROCESSING' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      file = await ai.files.get({ name: file.name });
    }
    if (!file || file.state !== 'ACTIVE' || !file.uri) {
      throw new Error('Files API: входное изображение не готово к использованию');
    }
    return { part: createPartFromUri(file.uri, file.mimeType || input.mime || 'image/jpeg'), tempPath };
  } catch (err) {
    try { fs.unlinkSync(tempPath); } catch { /* best-effort */ }
    throw err;
  }
}

export interface GenerateImageInput {
  apiKey: string;
  model: string;
  prompt: string;
  /** Входные картинки (клиент + референсы), в нужном порядке. */
  inputImages?: GenInputImage[];
}

/**
 * Генерирует/преобразует одно изображение. Бросает ошибку, если модель не вернула картинку.
 */
export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  const { apiKey, model, prompt } = input;
  let inputs = (input.inputImages || []).filter((i) => i && i.base64);

  // Жёсткий кап числа входов (потолок Pro). Без «тихого» усечения — логируем.
  if (inputs.length > MAX_TOTAL_INPUT_IMAGES) {
    console.warn(`[image_gen] входных картинок ${inputs.length} > лимита ${MAX_TOTAL_INPUT_IMAGES} — беру первые ${MAX_TOTAL_INPUT_IMAGES}`);
    inputs = inputs.slice(0, MAX_TOTAL_INPUT_IMAGES);
  }

  const { GoogleGenAI, Modality } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  // Imagen — отдельный API, только text-to-image (входные картинки игнорируются).
  if (/^imagen/i.test(model)) {
    const resp: any = await withRetry(() =>
      (ai as any).models.generateImages({ model, prompt, config: { numberOfImages: 1 } })
    );
    const bytes = resp?.generatedImages?.[0]?.image?.imageBytes;
    if (!bytes) throw new Error('Imagen не вернул изображение (возможно, сработал фильтр безопасности)');
    return saveGeneratedImage(bytes, 'image/png');
  }

  // Nano Banana — мультимодальный generateContent. Декодируем входы и решаем inline / Files API.
  const decoded: DecodedInput[] = inputs.map((im) => {
    const cleaned = im.base64.includes(',') ? im.base64.slice(im.base64.indexOf(',') + 1) : im.base64;
    return { buf: Buffer.from(cleaned, 'base64'), mime: im.mime || 'image/jpeg' };
  });
  const totalBytes = decoded.reduce((s, d) => s + d.buf.length, 0);
  const useFilesApi = totalBytes > INLINE_TOTAL_LIMIT_BYTES;

  const parts: any[] = [{ text: prompt }];
  const tempFiles: string[] = [];
  try {
    if (useFilesApi) {
      // Крупный суммарный объём (напр. коллаж из многих фото) — грузим через Files API.
      for (const d of decoded) {
        const { part, tempPath } = await uploadInputViaFilesApi(ai, d);
        parts.push(part);
        tempFiles.push(tempPath);
      }
    } else {
      for (const d of decoded) {
        parts.push({ inlineData: { data: d.buf.toString('base64'), mimeType: d.mime } });
      }
    }

    const resp: any = await withRetry(() =>
      (ai as any).models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        // Офиц. дока требует обе модальности для image-вывода; картинку извлекаем из inlineData.
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
      })
    );

    const candParts = resp?.candidates?.[0]?.content?.parts ?? [];
    for (const p of candParts) {
      const data = p?.inlineData?.data;
      const mime = p?.inlineData?.mimeType || '';
      if (data && mime.startsWith('image/')) {
        return saveGeneratedImage(data, mime);
      }
    }
    throw new Error('Модель не вернула изображение (возможно, сработал фильтр безопасности или выбрана не image-модель)');
  } finally {
    for (const tmp of tempFiles) {
      try { fs.unlinkSync(tmp); } catch { /* best-effort */ }
    }
  }
}
