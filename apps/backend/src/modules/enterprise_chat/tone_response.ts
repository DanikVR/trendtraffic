/**
 * AI tone explainer — пояснение к выделенному сообщению в одном из 8 тонов.
 *
 * Используется через popover в чате Enterprise-комнаты (Блок 1).
 * Не отправляется клиенту — это приватная подсказка владельцу.
 */

import { TONE_PRESETS, type ToneKey } from '../tenant_prompt/presets.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import pool from '../../db/index.js';

const MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash';

/**
 * Дефолтный системный промт для tone='custom' в расшифровке сообщений видео-комнаты.
 * Используется когда у tenant'а пусто в custom_prompt (Раздел 2 «Подсказки»).
 * Экспортируется для отображения в UI Section2 ("вот как AI расшифровывает по умолчанию").
 */
export const DEFAULT_CUSTOM_TONE_PROMPT = `Объясни сообщение подробно и по делу, в спокойном профессиональном тоне.

Учитывай:
• Контекст переговоров и цель собеседника.
• Возможный подтекст или скрытые намерения.
• Стиль речи (формальный / неформальный / напряжённый).
• Культурные особенности (если язык не русский).

Дай 2-4 предложения. Не пересказывай дословно — объясняй смысл и помогай понять, что хотел сказать собеседник.`;

export interface ToneExplainInput {
  tenantId: string;
  /** Сообщение, к которому нужно пояснение */
  messageText: string;
  /** Опциональный контекст (предыдущие 3-5 сообщений) */
  context?: string;
  /** Какой тон применить */
  tone: ToneKey;
  /** Язык владельца — на нём вернуть ответ */
  language?: string;
}

export interface ToneExplainResult {
  explanation: string;
  tone: ToneKey;
  modelUsed: string;
}

/**
 * Возвращает пояснение к сообщению в выбранном тоне.
 * Для tone='custom' использует tenant.custom_prompt как системный промт.
 */
export async function explainInTone(input: ToneExplainInput): Promise<ToneExplainResult> {
  const preset = TONE_PRESETS.find((p) => p.key === input.tone);
  if (!preset) {
    throw new Error(`Неизвестный тон: ${input.tone}`);
  }

  // Определяем системную инструкцию
  let systemPrompt: string;
  if (preset.key === 'custom') {
    // Подгружаем custom_prompt владельца из Раздела 2 «Подсказки»
    let custom = '';
    try {
      const r = await pool.query('SELECT custom_prompt FROM tenants WHERE id = $1', [input.tenantId]);
      custom = (r.rows as any[])[0]?.custom_prompt || '';
    } catch {}
    systemPrompt = custom.trim() || DEFAULT_CUSTOM_TONE_PROMPT;
  } else {
    systemPrompt = preset.systemPrompt!;
  }

  const apiKey = await getEffectiveGeminiKey(input.tenantId);
  if (!apiKey) {
    throw new Error('Gemini API ключ не задан (ни per-tenant, ни глобально)');
  }

  const fullPrompt = `${systemPrompt}

Отвечай на языке: ${input.language || 'ru'}.

${input.context ? `Контекст предыдущих сообщений:\n${input.context}\n\n` : ''}Сообщение для пояснения:
"${input.messageText}"

Дай пояснение:`;

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const resp = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
  });

  return {
    explanation: ((resp as any).text || '').trim(),
    tone: input.tone,
    modelUsed: MODEL,
  };
}
