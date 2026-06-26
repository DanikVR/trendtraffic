/**
 * Мультимодальный Telegram REST-шлюз VibeVox.
 *
 * Обрабатывает асинхронные запросы от стороннего Telegram-бота:
 * - Принимает текст или base64-аудио на входе
 * - Генерирует текстовый или аудио-ответ через Gemini 2.5 Flash
 * - Списывает секунды с баланса арендатора при обработке аудио
 */

import { Modality } from '@google/genai';
import { VOICE_MAP, AUDIO_SAMPLE_RATE } from '../translation/config.js';
import { deductAudioBalance, InsufficientBalanceError, geminiProvider } from './service.js';

// ============================================================================================
// Конфигурация
// ============================================================================================

/** Модель Gemini для стандартной генерации */
const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash';

/** Фиксированная оценка длительности аудио-ответа (секунды) */
const AUDIO_RESPONSE_OVERHEAD_SECONDS = 10;

/** Количество байт на секунду аудио PCM 16kHz 16-bit mono */
const PCM_BYTES_PER_SECOND = AUDIO_SAMPLE_RATE * 2; // 16000 * 2 = 32000

// ============================================================================================
// Типы и интерфейсы
// ============================================================================================

/** Входные данные запроса от Telegram-бота */
export interface TelegramGatewayInput {
  text?: string;
  audio?: string; // Base64-encoded PCM аудио
  response_type: 'text' | 'audio';
  voice_gender: 'male' | 'female';
  language: string; // BCP-47 код языка
}

/** Ответ Telegram-шлюза */
export interface TelegramGatewayResponse {
  /** Тип ответа: текст или аудио */
  type: 'text' | 'audio';
  /** Текстовый ответ (если type === 'text') */
  text?: string;
  /** Base64-encoded аудио (если type === 'audio') */
  audio?: string;
  /** MIME-тип аудио */
  mimeType?: string;
  /** Оставшийся баланс секунд */
  balanceRemaining: number;
}

// ============================================================================================
// Вспомогательные функции
// ============================================================================================

/**
 * Рассчитывает длительность входящего аудио в секундах.
 * Формула: количество байт / PCM_BYTES_PER_SECOND (32000 байт/сек для PCM 16kHz 16-bit mono).
 */
export function calculateAudioDurationSeconds(base64Audio: string): number {
  const byteLength = Buffer.from(base64Audio, 'base64').length;
  return byteLength / PCM_BYTES_PER_SECOND;
}

/**
 * Рассчитывает общую стоимость запроса в секундах:
 * - Входящее аудио: byteLength / 32000
 * - Аудио-ответ: +10 секунд (фиксированная оценка)
 * - Текстовый запрос без аудио: 0 секунд (бесплатно)
 */
export function calculateRequestCost(input: TelegramGatewayInput): number {
  let cost = 0;

  // Стоимость входящего аудио
  if (input.audio) {
    cost += calculateAudioDurationSeconds(input.audio);
  }

  // Стоимость генерации аудио-ответа (фиксированная оценка)
  if (input.response_type === 'audio') {
    cost += AUDIO_RESPONSE_OVERHEAD_SECONDS;
  }

  return cost;
}

// ============================================================================================
// Основной метод обработки запроса Telegram-шлюза
// ============================================================================================

/**
 * Обрабатывает входящий запрос от Telegram-бота.
 *
 * Поддерживаемые сценарии:
 * 1. Текст → Текст (бесплатно)
 * 2. Текст → Аудио (списание за аудио-ответ)
 * 3. Аудио → Текст (списание за входящее аудио)
 * 4. Аудио → Аудио (списание за вход + выход)
 *
 * @param tenantId — UUID арендатора
 * @param input — входные данные запроса
 * @returns Ответ с текстом или base64-аудио
 */
export async function processTelegramRequest(
  tenantId: string,
  input: TelegramGatewayInput
): Promise<TelegramGatewayResponse> {
  // 1. Расчёт стоимости запроса
  const costSeconds = calculateRequestCost(input);
  let balanceRemaining = -1;

  // 2. Списание с баланса (если есть аудио-составляющая)
  if (costSeconds > 0) {
    balanceRemaining = await deductAudioBalance(tenantId, costSeconds);
  }

  // 3. Формирование запроса к Gemini через провайдер
  const parts: any[] = [];

  // Добавляем текстовый контент
  if (input.text) {
    parts.push({ text: input.text });
  }

  // Добавляем аудио-контент (Gemini нативно читает PCM-буфер)
  if (input.audio) {
    parts.push({
      inlineData: {
        data: input.audio,
        mimeType: `audio/pcm;rate=${AUDIO_SAMPLE_RATE}`,
      },
    });
  }

  // 4. Конфигурация ответа
  if (input.response_type === 'audio') {
    // Генерация нативного аудио-ответа с HD-голосом из VOICE_MAP
    const voiceName = VOICE_MAP[input.voice_gender];
    const response = await geminiProvider.generateContent({
      __tenantId: tenantId,
      model: GEMINI_FLASH_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
        },
      },
    });

    // Извлечение аудио из ответа Gemini
    const responseParts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of responseParts) {
      if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('audio/')) {
        return {
          type: 'audio',
          audio: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
          balanceRemaining,
        };
      }
    }

    // Если аудио не получено, возвращаем текст как fallback
    return {
      type: 'text',
      text: response.text ?? 'Не удалось сгенерировать аудио-ответ',
      balanceRemaining,
    };
  } else {
    // Генерация текстового ответа
    const response = await geminiProvider.generateContent({
      __tenantId: tenantId,
      model: GEMINI_FLASH_MODEL,
      contents: [{ role: 'user', parts }],
    });

    return {
      type: 'text',
      text: response.text ?? '',
      balanceRemaining,
    };
  }
}
