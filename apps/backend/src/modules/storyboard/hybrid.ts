/**
 * СТОРИБОРД — движок «Спикер + ИИ-врезки» (гибрид, ключ Gemini тенанта).
 *
 * Отличие от Omni: спикер НЕ генерируется. Панели «спикер» и «финал» остаются
 * живым видео из исходника — лицо настоящее, губы попадают в речь. ИИ рисует
 * только ВРЕЗКИ (врезка/сплит/мокап/фон титра) — по одной картинке на панель
 * (Nano Banana), поверх которых программный движок делает кен-бёрнс и рисует
 * титры drawtext'ом (текст не «плывёт»). Звук — оригинальный, как везде.
 *
 * Цена: ~$0.04 за картинку (2–4 врезки на кусок ≈ $0.1/кусок против ~$1 у Omni).
 *
 * Сгенерированные картинки пишутся в план (panel.imageUrl + imageGen=true) —
 * они видны в раскадровке и их можно заменить своими из Галереи. При повторной
 * генерации куска ИИ-картинки перерисовываются, пользовательские не трогаются.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { generateImage } from '../quest_flow/image_gen.js';
import { toUploadsUrl, fromUploadsUrl, renderChunkProgram } from './ffmpeg.js';
import type { SbChunk, SbPanel, SbTranscriptSeg } from './types.js';

/** Nano Banana 2 — быстрая и опрятная; фолбэк на 2.5, если превью недоступно ключу. */
const IMAGE_MODEL = 'gemini-3.1-flash-image';
const IMAGE_MODEL_FALLBACK = 'gemini-2.5-flash-image';

/** Типы панелей, которым ИИ рисует картинку (у «спикера» и «финала» — живое видео). */
const ILLUSTRATED: SbPanel['type'][] = ['cutaway', 'split', 'mockup', 'title'];

const STYLE_HINT: Record<string, string> = {
  clean: 'чистая минималистичная подача, мягкий студийный свет, спокойная палитра',
  neon: 'неоновый киберпанк, цианово-фиолетовая подсветка, ночной город',
  paper: 'тёплый бумажный коллаж, крафт-текстуры, рукописные акценты',
  terminal: 'хакерский терминал, зелёный монохром, сетка и код',
  bold: 'дерзкая контрастная подача, крупные формы, красные акценты',
};

/** Речь, попадающая в окно панели (контекст для картинки). */
function speechFor(chunk: SbChunk, p: SbPanel, transcript?: SbTranscriptSeg[]): string {
  if (!transcript?.length) return '';
  const a = chunk.start + p.start;
  const b = chunk.start + p.end;
  return transcript
    .filter((s) => s.end > a && s.start < b)
    .map((s) => s.text)
    .join(' ')
    .trim()
    .slice(0, 400);
}

/** Промпт картинки-врезки. Текст в кадре ЗАПРЕЩЁН — титры рисует ffmpeg. */
export function buildPanelImagePrompt(
  chunk: SbChunk, p: SbPanel, style: string | undefined, transcript?: SbTranscriptSeg[]
): string {
  const speech = speechFor(chunk, p, transcript);
  const lines: string[] = [];
  lines.push('Вертикальный кадр 9:16 для короткого видео (Reels/Shorts).');
  lines.push(`Стиль: ${STYLE_HINT[style || 'clean'] || STYLE_HINT.clean}.`);

  if (p.prompt?.trim()) {
    lines.push(`Сюжет кадра: ${p.prompt.trim()}`);
  } else {
    switch (p.type) {
      case 'mockup':
        lines.push('Сюжет кадра: экран смартфона крупным планом с интерфейсом приложения по теме реплики.');
        break;
      case 'split':
        lines.push('Сюжет кадра: наглядная иллюстрация к реплике — она пойдёт нижней половиной сплит-экрана, спикер сверху.');
        break;
      case 'title':
        lines.push('Сюжет кадра: атмосферный ФОН под крупный титр — без объектов в центре, композиция с пустым центром.');
        break;
      default:
        lines.push('Сюжет кадра: иллюстративная врезка, буквально показывающая то, о чём идёт речь.');
    }
  }
  if (speech) lines.push(`Реплика в этот момент (контекст, не переносить в кадр буквально): «${speech}»`);
  lines.push('БЕЗ какого-либо текста, надписей, субтитров, логотипов и водяных знаков в кадре.');
  lines.push('Фотореалистично, кинематографичный свет, высокая детализация.');
  return lines.join('\n');
}

/** Одна картинка панели → файл в каталоге проекта. Возвращает /uploads/... URL. */
async function drawPanelImage(
  apiKey: string, chunk: SbChunk, p: SbPanel, dir: string, pi: number,
  style: string | undefined, transcript?: SbTranscriptSeg[]
): Promise<string> {
  const prompt = buildPanelImagePrompt(chunk, p, style, transcript);
  let gen;
  try {
    gen = await generateImage({ apiKey, model: IMAGE_MODEL, prompt });
  } catch (e: any) {
    // превью-модель может быть недоступна ключу — падаем на проверенную 2.5
    console.warn(`[storyboard] ${IMAGE_MODEL} не сработала (${e?.message || e}) — пробую ${IMAGE_MODEL_FALLBACK}`);
    gen = await generateImage({ apiKey, model: IMAGE_MODEL_FALLBACK, prompt });
  }

  // переносим картинку в каталог проекта: живёт и удаляется вместе со сторибордом
  const ext = path.extname(gen.filePath) || '.png';
  const dest = path.join(dir, `ai-${chunk.idx}-${pi}-${randomUUID().slice(0, 8)}${ext}`);
  fs.copyFileSync(gen.filePath, dest);
  try { fs.unlinkSync(gen.filePath); } catch { /* best-effort */ }

  // Каталог вне uploads → fromUploadsUrl вернёт null, и монтаж МОЛЧА скатится
  // в программные фолбэки при уже потраченных деньгах. Лучше честно упасть.
  const url = toUploadsUrl(dest);
  if (fromUploadsUrl(url) !== dest) throw new Error(`картинка сохранена вне uploads (${dest}) — врезка не подхватится`);
  return url;
}

/**
 * Рендер куска гибридом. МУТИРУЕТ chunk.panels (imageUrl/imageGen) — вызывающий
 * сохраняет план, чтобы картинки были видны в студии и переиспользовались.
 * Возвращает путь chunk-<idx>.mp4 (как остальные движки).
 */
export async function renderChunkHybrid(
  tenantId: string, work: string, chunk: SbChunk, dir: string,
  opts: { style?: string; isLastChunk?: boolean; transcript?: SbTranscriptSeg[] }
): Promise<string> {
  const apiKey = await getEffectiveGeminiKey(tenantId);
  if (!apiKey) throw new Error('Для движка «Спикер + ИИ-врезки» нужен ключ Gemini — добавьте его в Настройки → Ключи провайдеров.');

  // какие панели рисуем: иллюстрируемые и не занятые ПОЛЬЗОВАТЕЛЬСКОЙ картинкой
  const targets = chunk.panels
    .map((p, pi) => ({ p, pi }))
    .filter(({ p }) => ILLUSTRATED.includes(p.type) && (p.imageGen || !p.imageUrl));

  if (targets.length) {
    const drawn = await Promise.all(targets.map(({ p, pi }) =>
      drawPanelImage(apiKey, chunk, p, dir, pi, opts.style, opts.transcript)
        .then((url) => ({ pi, url, err: null as any }))
        .catch((e) => ({ pi, url: null as string | null, err: e }))
    ));

    const failed = drawn.filter((d) => !d.url);
    if (failed.length === drawn.length) {
      // ни одной картинки — честная ошибка вместо тихого скатывания в программный движок
      throw new Error(`ИИ не нарисовал врезки: ${String(failed[0]?.err?.message || failed[0]?.err).slice(0, 160)}`);
    }
    for (const d of drawn) {
      if (!d.url) { console.warn('[storyboard] врезка не нарисована:', d.err?.message || d.err); continue; }
      const p = chunk.panels[d.pi];
      // старую ИИ-картинку с диска убираем, чтобы каталог проекта не пух
      if (p.imageGen && p.imageUrl) {
        const old = fromUploadsUrl(p.imageUrl);
        if (old) { try { fs.unlinkSync(old); } catch { /* best-effort */ } }
      }
      p.imageUrl = d.url;
      p.imageGen = true;
    }
  }

  // дальше — обычный программный монтаж: спикер/финал из живого видео,
  // врезки на свежих ИИ-картинках, титры drawtext'ом, поверх оригинальный звук
  return renderChunkProgram(work, chunk, dir, { style: opts.style, isLastChunk: opts.isLastChunk });
}
