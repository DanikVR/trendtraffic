/**
 * СТОРИБОРД — движок «Omni Flash API» (генеративный, ключ Gemini тенанта).
 *
 * Interactions API умеет text→video и image→video (V2V нет), поэтому механика:
 * ОДНА генерация на кусок — стартовый кадр куска (реальный спикер, 1080×1920)
 * «оживает» по посекундному промпту, собранному из панелей раскадровки; выход
 * (~10с 720p) приводится к 1080×1920@30, режется до длины куска, и ПОВЕРХ
 * кладётся ОРИГИНАЛЬНЫЙ звук куска — речь сохраняется дословно (формат
 * «голос оригинала + генеративный визуал»). Стоимость ≈ $0.10/с (~$1/кусок).
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { generateOmniVideo } from '../render/video_gen.js';
import { extractFrameFull, fitClipToChunk, muxChunkAudio } from './ffmpeg.js';
import type { SbChunk, SbPanel } from './types.js';
import { PANEL_LABEL_RU } from './types.js';

const STYLE_HINT: Record<string, string> = {
  clean: 'чистый минималистичный стиль, мягкий студийный свет',
  neon: 'неоновый киберпанк-стиль, цианово-фиолетовая подсветка, ночной город',
  paper: 'тёплый бумажный коллаж, крафт-текстуры, рукописные акценты',
  terminal: 'хакерский терминал, зелёный монохром, сетка и код на фоне',
  bold: 'дерзкий контрастный стиль, крупная типографика, красные акценты',
};

/** Посекундный промпт видеогенератору из панелей куска (правило конвейера). */
export function buildChunkPrompt(chunk: SbChunk, style?: string, ctaWord?: string): string {
  const lines: string[] = [];
  lines.push('Вертикальное видео 9:16. Первый кадр — реальный спикер: сохрани его внешность и продолжи сцену.');
  lines.push(`Стиль: ${STYLE_HINT[style || 'clean'] || STYLE_HINT.clean}.`);
  lines.push('Посекундная режиссура (смена плана каждые 1–2.5 секунды, динамичный монтаж):');
  for (const p of chunk.panels) {
    const t = `${p.start.toFixed(1)}–${p.end.toFixed(1)}с`;
    const base = p.prompt?.trim()
      || (p.type === 'speaker' ? 'спикер крупным планом, медленный наезд камеры'
        : p.type === 'title' ? `полноэкранный титр «${(p.text || '').replace(/[«»]/g, '')}» на стильной подложке`
        : p.type === 'cutaway' ? 'иллюстративная врезка по теме речи'
        : p.type === 'split' ? `сплит-экран: спикер и иллюстрация${p.text ? ` с подписью «${p.text}»` : ''}`
        : p.type === 'mockup' ? 'мокап телефона с приложением крупным планом'
        : `финальный кадр с призывом «${p.text || (ctaWord ? `Пиши ${ctaWord.toUpperCase()} в комментариях` : 'Подпишись')}»`);
    lines.push(`${t} — ${PANEL_LABEL_RU[p.type] || p.type}: ${base}.`);
  }
  lines.push('Без чужих логотипов и водяных знаков. Текст в кадре — только из режиссуры выше, на русском, без ошибок.');
  return lines.join('\n');
}

/**
 * Рендер куска движком Omni. Возвращает путь chunk-<idx>.mp4 (как программный).
 * Бросает понятные ошибки: нет ключа / генерация не удалась.
 */
export async function renderChunkOmni(
  tenantId: string, work: string, chunk: SbChunk, dir: string,
  opts: { style?: string; ctaWord?: string }
): Promise<string> {
  const apiKey = await getEffectiveGeminiKey(tenantId);
  if (!apiKey) throw new Error('Для движка Omni нужен ключ Gemini — добавьте его в Настройки → Ключи провайдеров.');

  const D = Math.max(0.5, chunk.end - chunk.start);
  const tmp: string[] = [];
  const outPath = path.join(dir, `chunk-${chunk.idx}.mp4`);
  try {
    // 1) стартовый кадр куска (реальный спикер)
    const framePath = path.join(dir, `omni-seed-${chunk.idx}-${randomUUID().slice(0, 8)}.jpg`);
    tmp.push(framePath);
    await extractFrameFull(work, chunk.start + 0.05, framePath);
    const base64 = fs.readFileSync(framePath).toString('base64');

    // 2) генерация (~10с 720p со своим звуком — звук заменим оригинальным)
    const gen = await generateOmniVideo({
      apiKey,
      prompt: buildChunkPrompt(chunk, opts.style, opts.ctaWord),
      inputImage: { base64, mime: 'image/jpeg' },
      aspect: '9:16',
    });
    tmp.push(gen.filePath);

    // 3) формат куска: 1080×1920@30, ровно D секунд, без ген-звука
    const fitted = path.join(dir, `omni-fit-${chunk.idx}-${randomUUID().slice(0, 8)}.mp4`);
    tmp.push(fitted);
    await fitClipToChunk(gen.filePath, D, fitted);

    // 4) поверх — оригинальный звук куска (речь дословно)
    await muxChunkAudio(fitted, work, chunk, outPath, dir);
    return outPath;
  } finally {
    for (const p of tmp) { try { fs.unlinkSync(p); } catch { /* best-effort */ } }
  }
}
