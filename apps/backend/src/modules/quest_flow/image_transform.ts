/**
 * Оркестратор преобразования изображений по пресету (Фаза 1).
 *
 * Вызывается из inbound, когда кнопка Quest Flow прислала preset_key. Собирает входные
 * картинки в правильном порядке (динамическая картинка клиента/последняя сгенерированная →
 * затем фикс. референсы владельца), строит финальный промт и зовёт движок generateImage.
 *
 * Здесь НЕТ записи в чат и формирования ответа QF — это делает inbound (у него есть room,
 * insertMessage и т.д.). Сюда вынесена только «сборка входов + генерация».
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listMessages } from '../rooms/messages.js';
import { buildFinalImagePrompt, IMAGE_FUNCTIONS } from './image_functions.js';
import { generateImage, type GenInputImage, type GeneratedImage } from './image_gen.js';
import type { ImagePreset } from './image_presets.js';

const __it_filename = fileURLToPath(import.meta.url);
const __it_dirname = path.dirname(__it_filename);
const UPLOADS_ROOT = path.resolve(__it_dirname, '../../../../uploads');

/** Резолвит относительный /uploads/... URL в абсолютный путь на диске (или null). */
function resolveUploadPath(mediaUrl: string | null | undefined): string | null {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null;
  const m = mediaUrl.match(/^\/uploads\/(.+)$/);
  if (!m) return null;
  // Защита от path traversal — только внутри uploads.
  const rel = m[1].replace(/\\/g, '/');
  if (rel.includes('..')) return null;
  return path.join(UPLOADS_ROOT, rel);
}

function imageMimeForExt(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

/** Читает картинку с диска по /uploads-URL и возвращает base64-вход (или null). */
function readUploadAsInput(mediaUrl: string | null | undefined): GenInputImage | null {
  const fp = resolveUploadPath(mediaUrl);
  if (!fp) return null;
  try {
    if (!fs.existsSync(fp)) return null;
    const buf = fs.readFileSync(fp);
    if (buf.length === 0) return null;
    return { base64: buf.toString('base64'), mime: imageMimeForExt(fp) };
  } catch {
    return null;
  }
}

export interface RunTransformParams {
  apiKey: string;
  model: string;
  preset: ImagePreset;
  roomId: string;
  /** Картинки, присланные клиентом в этом запросе (уже base64). */
  clientImages: GenInputImage[];
  /** Текст клиента (подпись к фото / текст с кнопки). */
  clientRequest: string;
}

export interface RunTransformResult {
  image: GeneratedImage;
  promptUsed: string;
}

/**
 * Собирает входы согласно функции пресета и генерирует изображение.
 * Порядок входов важен (базовые промты ссылаются на «FIRST image … FOLLOWING image(s)»):
 *   [динамическая картинка] + [референсы владельца].
 */
export async function runImagePresetTransform(p: RunTransformParams): Promise<RunTransformResult> {
  const fn = IMAGE_FUNCTIONS[p.preset.function];
  const inputs: GenInputImage[] = [];

  // 1. Динамическая картинка.
  if (p.preset.imageSource === 'client') {
    inputs.push(...p.clientImages);
  } else if (p.preset.imageSource === 'last_generated') {
    // Берём последнюю картинку AI в этой комнате (итеративная правка «ещё синее»).
    // p.roomId пуст в режиме теста из настроек — тогда сразу используем присланные картинки.
    try {
      const msgs = p.roomId ? await listMessages(p.roomId, 200) : [];
      const lastAiImage = [...msgs].reverse().find((m) => m.sender === 'ai' && m.kind === 'image' && m.mediaUrl);
      const inp = lastAiImage ? readUploadAsInput(lastAiImage.mediaUrl) : null;
      if (inp) inputs.push(inp);
    } catch { /* fail-soft: продолжим без неё */ }
    // Если истории нет, но клиент всё же прислал картинку — используем её.
    if (inputs.length === 0 && p.clientImages.length) inputs.push(...p.clientImages);
  }
  // 'none' — динамическую картинку не добавляем (генерация с нуля).

  // 2. Фикс. референсы владельца (лого/товар/стиль) — после динамической.
  if (fn.needsReference && p.preset.referenceImages.length) {
    for (const url of p.preset.referenceImages) {
      const inp = readUploadAsInput(url);
      if (inp) inputs.push(inp);
    }
  }

  const promptUsed = buildFinalImagePrompt(fn, p.preset.promptExtra, p.clientRequest);

  const image = await generateImage({
    apiKey: p.apiKey,
    model: p.model,
    prompt: promptUsed,
    inputImages: inputs,
  });

  return { image, promptUsed };
}
