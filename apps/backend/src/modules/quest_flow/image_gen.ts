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

/** Признак ВРЕМЕННОЙ ошибки модели/сети — такие повторяем: перегрузка (503 «high demand»/429),
 *  транзиентные 5xx Google и сетевые сбои fetch/undici («fetch failed», обрывы соединения).
 *  Экспортирован: фоновые пайплайны (GPU-студия) поверх него строят свой длинный ретрай. */
export function isTransientGenError(err: any): boolean {
  const code = Number((err as any)?.status ?? (err as any)?.code);
  if ([429, 500, 502, 503, 504].includes(code)) return true;
  const msg = String(err?.message || err || '');
  return /\b(429|500|502|503|504)\b/.test(msg)
    || /UNAVAILABLE|high demand|overloaded|rate.?limit|RESOURCE_EXHAUSTED|INTERNAL|DEADLINE_EXCEEDED/i.test(msg)
    || /fetch failed|network|socket|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|UND_ERR|terminated/i.test(msg);
}

/** Ретрай транзиентных ошибок. Спайки «high demand» живут секунды–десятки секунд, поэтому бэкофф
 *  растёт экспоненциально (≈1.8с→3.6с→7.2с→14.4с + джиттер, суммарно ~30с) — старые 0.9с/1.8с
 *  сгорали за 3 секунды внутри одного спайка и ошибка уходила пользователю.
 *
 *  ЖЁСТКИЙ ТАЙМАУТ попытки (90с) обязателен: generateContent иногда ВИСНЕТ на сетевом уровне
 *  без ответа — дефолтные таймауты undici (300с) × 5 попыток давали 25+ минут молчания
 *  (прогон юзера 06.07: вырезка «зависла» на 16+ мин без единой ошибки в логах). Таймаут
 *  считается транзиентным (свежее соединение обычно живое) + общий бюджет вызова 4 мин. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5, attemptTimeoutMs = 90_000, totalBudgetMs = 240_000): Promise<T> {
  const started = Date.now();
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const attemptPromise = fn();
      attemptPromise.catch(() => { /* поздний reject после гонки таймаута — не unhandled */ });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          attemptPromise,
          new Promise<never>((_, rej) => {
            timer = setTimeout(() => rej(new Error(`ETIMEDOUT: Gemini не ответил за ${Math.round(attemptTimeoutMs / 1000)}с`)), attemptTimeoutMs);
          }),
        ]);
      } finally { clearTimeout(timer); }
    } catch (err: any) {
      lastErr = err;
      const spent = Date.now() - started;
      if (attempt < maxAttempts && spent < totalBudgetMs && isTransientGenError(err)) {
        const delay = Math.min(15_000, 1800 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 1000);
        console.warn(`[image_gen] попытка ${attempt}/${maxAttempts} не удалась (${String(err?.message || err).slice(0, 120)}) — ретрай через ${Math.round(delay / 1000)}с`);
        await new Promise((r) => setTimeout(r, delay));
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
