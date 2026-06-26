import { z } from 'zod';

// ============================================================================================
// Схема запроса на пост-анализ завершённого звонка (WebRTC-комнаты)
// ============================================================================================

export const CallAnalyticsRequestSchema = z.object({
  /** Имя комнаты LiveKit, в которой состоялся звонок */
  roomName: z.string().min(1, 'Имя комнаты обязательно'),

  /** Контекст разговора (транскрипт или текстовая выжимка) */
  conversationContext: z.string().min(1, 'Контекст разговора обязателен'),

  /** Динамическая JSON-схема для извлечения сущностей (ключ → описание поля) */
  extractionSchema: z.record(z.string()).optional(),
});

/** TypeScript-тип, выведенный из схемы анализа звонков */
export type CallAnalyticsRequest = z.infer<typeof CallAnalyticsRequestSchema>;

// ============================================================================================
// Схема запроса мультимодального Telegram-шлюза
// ============================================================================================

export const TelegramGatewayRequestSchema = z.object({
  /** Текстовое сообщение от пользователя (необязательно, если передано аудио) */
  text: z.string().optional(),

  /** Base64-encoded аудио (PCM 16kHz 16-bit mono) от пользователя */
  audio: z.string().optional(),

  /** Формат требуемого ответа: текст или аудио */
  response_type: z.enum(['text', 'audio'], {
    required_error: 'Поле response_type обязательно',
    message: 'Допустимые значения: "text" или "audio"',
  }),

  /** Предпочитаемый пол голоса для аудио-ответа */
  voice_gender: z.enum(['male', 'female']).default('female'),

  /** Код языка для ответа (BCP-47 / ISO 639-1, 2 символа) */
  language: z.string().length(2, 'Код языка должен быть 2 символа (например: "ru")').default('ru'),
}).refine(data => data.text || data.audio, {
  message: 'Необходимо указать хотя бы одно из полей: text или audio',
});

/** TypeScript-тип, выведенный из схемы Telegram-шлюза */
export type TelegramGatewayRequest = z.infer<typeof TelegramGatewayRequestSchema>;
