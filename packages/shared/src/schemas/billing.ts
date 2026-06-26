import { z } from 'zod';

// Карта тарифов — количество секунд перевода, доступных на каждом тарифном плане.
// Соответствует SPEC.md и финальным ценам, согласованным в этапе 2:
//   Plus     — 60 минут/мес  (€19)
//   Standard — 120 минут/мес (€29) или 1440 минут/год (€289)
//   Enterprise — не лимитируется ('∞' в UI, технически 999999 сек = 16к минут)
export const TIER_SECONDS_MAP: Record<string, number> = {
  plus:               60  * 60,    // 60 мин
  standard:           120 * 60,    // 120 мин
  standard_yearly:    1440 * 60,   // 1440 мин — годовой план Standard
  enterprise:         999999,      // практически безлимит
  // Обратная совместимость со старыми значениями (если в БД где-то остались)
  trial:              60 * 60,
  monthly:            120 * 60,
  annual:             1440 * 60,
};

// Цены — для генерации Stripe Products/Prices через /api/billing/sync-products
export interface TierPriceConfig {
  tier: string;
  name: string;          // отображаемое имя (Plus / Standard / Standard Yearly)
  description: string;
  amountEur: number;     // в евроцентах
  amountUsd: number;     // в центах
  billingPeriod: 'monthly' | 'yearly' | 'one_time';
  minutes: number;       // включённых минут
  productKey: string;    // ключ для metadata.tier продукта Stripe
}

export const TIER_PRICES: TierPriceConfig[] = [
  {
    tier: 'plus',
    name: 'VibeVox Plus',
    description: '60 минут перевода в месяц. 100+ языков, HD-голоса, видео, AI-помощник, SIP-телефония.',
    amountEur: 1900,
    amountUsd: 2100,
    billingPeriod: 'monthly',
    minutes: 60,
    productKey: 'plus',
  },
  {
    tier: 'standard',
    name: 'VibeVox Standard',
    description: '120 минут перевода в месяц. Всё из Plus + расширенная аналитика, брендирование.',
    amountEur: 2900,
    amountUsd: 3200,
    billingPeriod: 'monthly',
    minutes: 120,
    productKey: 'standard',
  },
  {
    tier: 'standard_yearly',
    name: 'VibeVox Standard (год)',
    description: '1 440 минут на год (−17%, экономия €59). Все возможности Standard.',
    amountEur: 28900,
    amountUsd: 31900,
    billingPeriod: 'yearly',
    minutes: 1440,
    productKey: 'standard',  // тот же product, разные prices
  },
];

// Top-up — докупка минут пакетами. Цена €0.17/мин.
export const TOPUP_PRICE_PER_MINUTE_EUR_CENTS = 17;  // €0.17 = 17 центов
export const TOPUP_MIN_MINUTES = 60;
export const TOPUP_MAX_MINUTES = 600;  // 10 часов

// Схема валидации входящего запроса на генерацию LiveKit AccessToken
export const LiveKitTokenRequestSchema = z.object({
  roomName: z
    .string({ required_error: 'Название комнаты обязательно' })
    .min(1, 'Название комнаты не может быть пустым'),
  identity: z
    .string({ required_error: 'Идентификатор пользователя обязателен' })
    .min(1, 'Идентификатор пользователя не может быть пустым'),
  nativeLanguage: z
    .string({ required_error: 'Родной язык пользователя обязателен' })
    .length(2, 'Код языка должен быть в формате ISO-639-1 (2 символа), например: "ru", "en"'),
  voiceGender: z.enum(['male', 'female']).optional()
});

// TypeScript-тип, выведенный из схемы
export type LiveKitTokenRequest = z.infer<typeof LiveKitTokenRequestSchema>;
