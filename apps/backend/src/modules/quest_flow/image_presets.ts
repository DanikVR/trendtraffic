/**
 * Пресеты («блоки обработки изображений») и выбор модели — хранятся per-tenant.
 *
 *  - tenants.questflow_image_model   — ОДНА модель на весь аккаунт (выбирается в Настройках,
 *    раздел Gemini API). Используется ТОЛЬКО для генерации/преобразования картинок; перевод,
 *    распознавание и видео-анализ продолжают работать на своей текстовой модели.
 *  - tenants.questflow_image_presets — JSON-массив пресетов. Каждый пресет = один «блок»:
 *    функция из каталога + дополнение к промту + (опц.) референс-картинки + intake-текст.
 *
 * Пресет вызывается ЖЁСТКО по presetKey: кнопка Quest Flow шлёт этот ключ в /inbound(-media),
 * VibeVox берёт ровно этот пресет — ИИ ничего не выбирает.
 */

import pool from '../../db/index.js';
import {
  IMAGE_FUNCTIONS,
  isImageFunctionKey,
  type ImageFunctionKey,
  type ImageSourceMode,
} from './image_functions.js';

/**
 * Курируемый список image-генерящих моделей Gemini (на май 2026). Пересекается с тем,
 * что реально доступно ключу (ListModels) — владелец не сможет выбрать модель, которая
 * НЕ умеет генерировать изображения. Imagen — только генерация с нуля (правка/композиция
 * НЕ работают), поэтому помечен editing:false и не должен ставиться для функций с входом.
 */
export interface ImageModelDef {
  id: string;
  label: string;
  /** Грубый ценовой/качественный тир — для подсказки в UI. */
  tier: 'fast' | 'balanced' | 'pro';
  /** Поддерживает ли правку/композицию (вход = картинка). Imagen — нет. */
  editing: boolean;
}

export const IMAGE_CAPABLE_MODELS: ImageModelDef[] = [
  { id: 'gemini-2.5-flash-image', label: 'Nano Banana (2.5 Flash Image)', tier: 'fast', editing: true },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2 (3.1 Flash Image, 4K)', tier: 'balanced', editing: true },
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro (3 Pro Image)', tier: 'pro', editing: true },
  { id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast (генерация с нуля)', tier: 'fast', editing: false },
  { id: 'imagen-4.0-generate-001', label: 'Imagen 4 (генерация с нуля)', tier: 'balanced', editing: false },
  { id: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4 Ultra (генерация с нуля)', tier: 'pro', editing: false },
];

export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';

export function isKnownImageModel(id: string): boolean {
  return IMAGE_CAPABLE_MODELS.some((m) => m.id === id);
}

/** Один «блок обработки изображения». */
export interface ImagePreset {
  /** Стабильный ключ — вставляется в кнопку Quest Flow. */
  presetKey: string;
  /** Подпись (для кнопки и для UI). */
  label: string;
  /** Функция из каталога. */
  function: ImageFunctionKey;
  /** Дополнение владельца к базовому промту функции. */
  promptExtra: string;
  /** Текст, которым бот просит у клиента нужные входы (intake). */
  intakePrompt: string;
  /** Относительные URL референс-картинок (/uploads/...). */
  referenceImages: string[];
  /** Откуда брать динамическую картинку (переопределяет дефолт функции). */
  imageSource: ImageSourceMode;
  /** Подпись к результату, уходящая клиенту (опц.). */
  replyCaption: string;
  /** Включён ли блок. */
  enabled: boolean;
}

const MAX_PRESETS = 50;
const MAX_PROMPT_EXTRA = 8000;
// До 14 референсов — потолок Nano Banana Pro (gemini-3-pro-image). Для flash-моделей
// в UI подсказываем меньше (~5), но жёсткий кап общий. См. MAX_TOTAL_INPUT_IMAGES в image_gen.ts.
const MAX_REFERENCES = 14;

/** Нормализует presetKey: латиница/цифры/подчёркивание, нижний регистр. */
export function normalizePresetKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

/**
 * Стабильный авто-ключ, когда явный ключ пуст и название НЕ латиницей (кириллица и т.п.).
 * Раньше такой пресет ронялся (пустой ключ → null) — теперь получает свой ключ.
 * Детерминирован по содержимому → одинаковый ключ при тех же полях (ссылки из цепочек живут).
 */
function autoPresetKey(raw: any, fnKey: string): string {
  const seed = `${raw?.label || ''}|${fnKey}|${raw?.promptExtra || ''}|${raw?.intakePrompt || ''}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return `${fnKey}_${Math.abs(h).toString(36)}`;
}

/** Приводит произвольный объект к валидному ImagePreset (или null, если негоден). */
export function sanitizePreset(raw: any): ImagePreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const fnKey = isImageFunctionKey(raw.function) ? (raw.function as ImageFunctionKey) : null;
  if (!fnKey) return null;
  // Ключ: явный → из латиницы названия → стабильный авто-ключ. Кириллическое название
  // с пустым ключом больше НЕ роняет пресет.
  const key = normalizePresetKey(raw.presetKey) || normalizePresetKey(raw.label) || autoPresetKey(raw, fnKey);
  if (!key) return null;

  const fn = IMAGE_FUNCTIONS[fnKey];
  const source: ImageSourceMode =
    raw.imageSource === 'client' || raw.imageSource === 'last_generated' || raw.imageSource === 'none'
      ? raw.imageSource
      : fn.defaultSource;

  const refs = Array.isArray(raw.referenceImages)
    ? raw.referenceImages
        .filter((u: any) => typeof u === 'string' && u.trim())
        .map((u: string) => u.trim())
        .slice(0, MAX_REFERENCES)
    : [];

  return {
    presetKey: key,
    label: String(raw.label || fn.label).slice(0, 120),
    function: fnKey,
    promptExtra: String(raw.promptExtra || '').slice(0, MAX_PROMPT_EXTRA),
    intakePrompt: String(raw.intakePrompt || fn.defaultIntake).slice(0, 2000),
    referenceImages: refs,
    imageSource: source,
    replyCaption: String(raw.replyCaption || '').slice(0, 1000),
    enabled: raw.enabled !== false,
  };
}

/** Дедуплицирует пресеты по presetKey (последний выигрывает) и обрезает по лимиту. */
export function sanitizePresetList(rawList: any): ImagePreset[] {
  const arr = Array.isArray(rawList) ? rawList : [];
  const byKey = new Map<string, ImagePreset>();
  for (const raw of arr) {
    const p = sanitizePreset(raw);
    if (p) byKey.set(p.presetKey, p);
  }
  return Array.from(byKey.values()).slice(0, MAX_PRESETS);
}

function parsePresetsColumn(value: any): ImagePreset[] {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return sanitizePresetList(parsed);
  } catch {
    return [];
  }
}

export interface TenantImageConfig {
  model: string;
  presets: ImagePreset[];
}

/** Читает модель + пресеты tenant'а. */
export async function getTenantImageConfig(tenantId: string): Promise<TenantImageConfig> {
  try {
    const r = await pool.query(
      `SELECT questflow_image_model, questflow_image_presets FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );
    const row = (r.rows as any[])[0] || {};
    const model = isKnownImageModel(row.questflow_image_model) ? row.questflow_image_model : DEFAULT_IMAGE_MODEL;
    return { model, presets: parsePresetsColumn(row.questflow_image_presets) };
  } catch {
    return { model: DEFAULT_IMAGE_MODEL, presets: [] };
  }
}

/** Находит включённый пресет по ключу (или null). */
export async function findPreset(tenantId: string, presetKey: string): Promise<ImagePreset | null> {
  const key = normalizePresetKey(presetKey);
  if (!key) return null;
  const { presets } = await getTenantImageConfig(tenantId);
  return presets.find((p) => p.presetKey === key && p.enabled) || null;
}

/** Сохраняет выбранную модель (валидирует по курируемому списку). */
export async function setTenantImageModel(tenantId: string, model: string): Promise<string> {
  const safe = isKnownImageModel(model) ? model : DEFAULT_IMAGE_MODEL;
  await pool.query(
    `UPDATE tenants SET questflow_image_model = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [safe, tenantId]
  );
  return safe;
}

/** Сохраняет список пресетов (после санитайза). Возвращает сохранённый список. */
export async function setTenantImagePresets(tenantId: string, rawList: any): Promise<ImagePreset[]> {
  const clean = sanitizePresetList(rawList);
  await pool.query(
    `UPDATE tenants SET questflow_image_presets = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [JSON.stringify(clean), tenantId]
  );
  return clean;
}
