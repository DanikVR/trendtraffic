/**
 * OMNICHANNEL — матрица возможностей каналов. ТОЧКА РАСШИРЕНИЯ.
 *
 * Принцип «храним богато — шлём адаптировано»: узел цепочки хранит полную форму
 * (текст + массив опций-кнопок), а раннер при отправке адаптирует её под то, что
 * канал РЕАЛЬНО умеет доставить через Chatwoot СЕЙЧАС.
 *
 * "Заложено на потом отдельно для каждого сервиса": когда допилим транслятор
 * Chatwoot под конкретный сервис (списки/карусели/CTA WhatsApp/IG/Messenger),
 * повышаем соответствующие флаги ЗДЕСЬ — и все цепочки автоматически начинают
 * слать богаче, без переделки самих цепочек.
 *
 * Текущая реальность (через Chatwoot, см. анализ май-2026): надёжно — текст +
 * до 3 быстрых кнопок (content_type=input_select → WhatsApp reply buttons).
 * list/cards = false везде, пока не расширим Chatwoot для сервиса.
 */

export interface ChannelCapabilities {
  /** Макс. число быстрых кнопок. 0 = кнопки не поддержаны → деградация в нумерованный текст. */
  maxButtons: number;
  /** Список/меню (WhatsApp list ≤10). Пока false — включим при патче транслятора Chatwoot. */
  list: boolean;
  /** Карусель/карточки (generic template). */
  cards: boolean;
  /** CTA-URL кнопки. */
  ctaUrl: boolean;
  /** Отправка медиа (изображения/файлы). */
  media: boolean;
}

const DEFAULT_CAPS: ChannelCapabilities = { maxButtons: 0, list: false, cards: false, ctaUrl: false, media: false };

export const CHANNEL_CAPS: Record<string, ChannelCapabilities> = {
  // Meta-каналы: через Chatwoot надёжно — текст + ≤3 кнопки (input_select). Остальное — позже.
  // WhatsApp — ПРЯМОЙ Cloud API: reply-кнопки ≤3 (>3 → авто-промоушн в список),
  // список ≤10, одна CTA-url в сессии. Микс url/звонок/копи-код кнопок = шаблоны (WA-1).
  whatsapp:  { maxButtons: 3, list: true, cards: false, ctaUrl: true, media: true },
  // Messenger — ПРЯМОЙ Messenger Platform API (как IG): быстрые ответы ≤13 + карусель (generic template).
  messenger: { maxButtons: 13, list: false, cards: true, ctaUrl: true, media: true },
  facebook:  { maxButtons: 3, list: false, cards: false, ctaUrl: false, media: true },
  // Instagram — ПРЯМОЙ Graph API (не Chatwoot): быстрые ответы до 13 + карусель (generic
  // template, cards/ctaUrl). Списки (list) — позже.
  instagram: { maxButtons: 13, list: false, cards: true, ctaUrl: true, media: true },
  // TikTok (прямой Business Messaging API): вертикальные быстрые ответы, медиа (видео —
  // нативные превью), ссылки (внутренние = мини-превью). Карусель НЕ поддержана.
  tiktok:    { maxButtons: 6, list: false, cards: false, ctaUrl: true, media: true },
  // Веб-виджет Chatwoot — самый богатый (cards/form работают именно тут).
  web:       { maxButtons: 10, list: true, cards: true, ctaUrl: true, media: true },
  email:     { maxButtons: 0, list: false, cards: false, ctaUrl: false, media: true },
  // Telegram остаётся на QuestFlow; для полноты матрицы.
  telegram:  { maxButtons: 3, list: false, cards: false, ctaUrl: false, media: true },
};

export function getChannelCaps(channelType: string | null | undefined): ChannelCapabilities {
  if (!channelType) return DEFAULT_CAPS;
  return CHANNEL_CAPS[channelType.toLowerCase()] || DEFAULT_CAPS;
}
