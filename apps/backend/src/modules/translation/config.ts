/**
 * Конфигурация модуля синхронного перевода VibeVox.
 *
 * Содержит маппинг нативных HD-голосов Gemini Live API,
 * список поддерживаемых языков (BCP-47) и константы аудиоформата.
 */

// ============================================================================================
// Маппинг нативных HD-голосов Gemini по полу
// Доступные голоса: Aoede, Kore, Leda, Zephyr (женские), Charon, Fenrir, Orus, Puck (мужские)
// ============================================================================================

/** Маппинг пола голоса на имя нативного HD-голоса Gemini */
export const VOICE_MAP: Record<'male' | 'female', string> = {
  female: 'Aoede',  // Женский HD-голос — мягкий, естественный тембр
  male: 'Charon',   // Мужской HD-голос — глубокий, выразительный тембр
};

// ============================================================================================
// Список поддерживаемых языков (12 языков из технического задания)
// Формат: BCP-47 (ISO 639-1 двухбуквенные коды)
// ============================================================================================

export const SUPPORTED_LANGUAGES: readonly string[] = [
  'en', 'pl', 'ru', 'de', 'es', 'fr', 'ar', 'he', 'zh', 'pt', 'it', 'tr', 'ja', 'uz', 'ko', 'nl', 'uk', 'vi', 'th', 'hi', 'id', 'ro', 'mr', 'bn', 'ta', 'te',
  'cs', 'da', 'fi', 'el', 'hu', 'no', 'sv', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'sr', 'kk', 'az', 'ka', 'hy', 'fa', 'ur', 'pa', 'gu', 'ml', 'kn',
  'am', 'sq', 'eu', 'be', 'bs', 'ca', 'eo', 'gl', 'is', 'ga', 'mk', 'ms', 'mt', 'sw', 'cy', 'af', 'mn', 'ne', 'si', 'km', 'lo', 'my', 'fil', 'haw', 'mg', 'so', 'yo', 'zu', 'tl'
] as const;

/** Тип поддерживаемого языка */
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Проверяет, поддерживается ли указанный код языка.
 * @param code — двухбуквенный код языка BCP-47
 * @returns true, если язык поддерживается
 */
export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(code);
}

// ============================================================================================
// Константы модели и аудиоформата
// ============================================================================================

/**
 * Имена кодов языков → English для построения системного промпта перевода.
 * Минимальный набор — для большего охвата фронт может прислать ISO-код любой;
 * если он не в списке, используется сам код (Gemini его поймёт).
 */
const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Russian', en: 'English', de: 'German', fr: 'French', es: 'Spanish',
  it: 'Italian', pt: 'Portuguese', pl: 'Polish', tr: 'Turkish', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', ar: 'Arabic', he: 'Hebrew', hi: 'Hindi',
  uk: 'Ukrainian', nl: 'Dutch', sv: 'Swedish', uz: 'Uzbek', kk: 'Kazakh',
};

/**
 * Системный промпт для синхронного перевода через Gemini Live.
 *
 * Раз `streamTranslationConfig` не поддерживается реальным API
 * (Google's REST API возвращает 1007 «Unknown name "streamTranslationConfig"»),
 * перевод делаем «классически» — через system instruction.
 *
 * @param targetLanguage — код целевого языка (на который переводим)
 * @param dialectInstruction — опциональное правило диалекта из AI Learning Hub Pro
 */
export function buildTranslationInstruction(
  targetLanguage: string,
  dialectInstruction?: string | null,
  options?: {
    customPrompt?: string | null;
    knowledgeBase?: string | null;
  },
): string {
  const targetName = LANGUAGE_NAMES[targetLanguage?.toLowerCase()] || targetLanguage;
  let prompt = `You are a real-time simultaneous interpreter. The speaker may use any language. Translate everything they say into ${targetName}, immediately, as the speech arrives.

CRITICAL RULES:
- Output ONLY the translation as spoken audio. No commentary. No greetings. No "Here is the translation".
- Translate every utterance — questions, statements, jokes, fragments. Even short ones.
- Match the speaker's tone, register and emotion in the translation.
- If the speaker is already speaking ${targetName}, repeat it verbatim.
- Do not add information that wasn't in the source. Do not summarize.

PACE:
- Speak the translation at a natural, even pace. Do not draw out vowels or consonants.`;
  // NOTE v0.8.2: дальше упростили QUALITY RULES — оставили только «natural even pace».
  // Все остальные правила (no filler words, speak to end, never repeat, wait for finish)
  // влияли на Gemini Live как давление «думать дольше» → он начинал тянуть звуки или молчать.
  // Базовая инструкция "Translate every utterance" уже достаточно сильная.

  if (dialectInstruction) {
    prompt += `\n\nDIALECT GUIDELINES (apply when relevant):\n${dialectInstruction}`;
  }

  // Кастомный prompt владельца — приоритет выше дефолта
  if (options?.customPrompt && options.customPrompt.trim()) {
    prompt += `\n\nCONTEXT FROM ROOM OWNER (high priority — apply to terminology, style, named entities):\n${options.customPrompt.trim()}`;
  }

  // База знаний — самый низкий приоритет (контекст-only, не директивы)
  if (options?.knowledgeBase && options.knowledgeBase.trim()) {
    const kb = options.knowledgeBase.trim().slice(0, 50_000);
    prompt += `\n\nKNOWLEDGE BASE (use ONLY for translating named entities, terms, product names; do not quote verbatim, do not announce its existence):\n${kb}`;
  }

  return prompt;
}

/** Частота дискретизации аудио (Гц) — 16kHz стандарт для потокового перевода */
export const AUDIO_SAMPLE_RATE = 16000;

/** Количество аудиоканалов — моно (1 канал) */
export const AUDIO_CHANNELS = 1;

/** MIME-тип аудио для передачи в Gemini Live API */
export const AUDIO_MIME_TYPE = 'audio/pcm;rate=16000';

/** Имя бота-переводчика, которое отображается в LiveKit-комнате */
export const TRANSLATOR_BOT_IDENTITY = 'vibevox-translator';
