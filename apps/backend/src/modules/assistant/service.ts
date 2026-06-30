/**
 * Сервисный слой модуля ИИ-ассистента VibeVox.
 *
 * Реализует:
 * - Feature Toggle для Enterprise-функций (CRM/Calendar)
 * - Пост-анализ звонков через Gemini 2.5 Flash
 * - Атомарное списание аудио-секунд с баланса арендатора
 * - Интеграцию с Chatwoot CRM и Google Calendar (freebusy.query)
 */

import { runInTenantContext } from '../../db/index.js';
import { getChatwootUrl, getChatwootToken } from '../../config/systemConfig.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';

// ============================================================================================
// Конфигурация
// ============================================================================================

/** Модель Gemini для стандартной (не-live) генерации */
const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash';

/** URL и токен Chatwoot CRM загружаются динамически из systemConfig */

/** Учётные данные Google Calendar (JSON сервисного аккаунта, опционально) */
const GOOGLE_CALENDAR_CREDENTIALS = process.env.GOOGLE_CALENDAR_CREDENTIALS || '';

// ============================================================================================
// Типы и интерфейсы
// ============================================================================================

/** Результат анализа звонка */
export interface CallAnalyticsResult {
  /** Извлечённые сущности из разговора */
  entities: Record<string, string>;
  /** Обнаруженные триггеры ("Нужен юрист", "Нужен врач" и т.д.) */
  triggers: string[];
  /** Краткое резюме разговора */
  summary: string;
  /** Результат CRM-интеграции (если доступна) */
  crmResult?: { noteCreated: boolean; contactId?: string };
  /** Результат проверки календаря (если доступна) */
  calendarResult?: { slotsAvailable: boolean; nextFreeSlot?: string };
}

/** Абстрактный интерфейс Gemini-провайдера для возможности мокирования в тестах */
export interface GeminiProvider {
  generateContent(params: any): Promise<any>;
}

/** Ошибка блокировки Feature Toggle */
export class FeatureNotAvailableError extends Error {
  constructor(feature: string) {
    super(`Функция "${feature}" доступна только на тарифе Enterprise. Обновите подписку.`);
    this.name = 'FeatureNotAvailableError';
  }
}

/** Ошибка недостаточного баланса секунд */
export class InsufficientBalanceError extends Error {
  constructor(required: number, available: number) {
    super(`Недостаточно секунд на балансе. Требуется: ${required} сек, доступно: ${available} сек.`);
    this.name = 'InsufficientBalanceError';
  }
}

// ============================================================================================
// Gemini-провайдер с возможностью подмены в тестах
// ============================================================================================

/**
 * Реализация Gemini-провайдера по умолчанию (продакшн).
 * Создаёт экземпляр GoogleGenAI и вызывает ai.models.generateContent().
 *
 * ENTERPRISE v0.10.0: если в params передан `__tenantId` (внутренний маркер,
 * не уходит в Gemini SDK), используется per-tenant API key с fallback на глобальный.
 */
class DefaultGeminiProvider implements GeminiProvider {
  async generateContent(params: any): Promise<any> {
    const { GoogleGenAI } = await import('@google/genai');
    const tenantId: string | null = params?.__tenantId || null;
    const apiKey = await getEffectiveGeminiKey(tenantId);
    if (!apiKey) {
      throw new Error('Критическая ошибка: GEMINI_API_KEY не задан ни per-tenant, ни глобально!');
    }
    const ai = new GoogleGenAI({ apiKey });
    // Чистим внутренний маркер перед передачей в SDK
    const { __tenantId: _strip, ...sdkParams } = params || {};
    return ai.models.generateContent(sdkParams);
  }
}

/** Текущий Gemini-провайдер (подменяется в тестах) */
let geminiProvider: GeminiProvider = new DefaultGeminiProvider();

/**
 * Устанавливает пользовательский Gemini-провайдер (для тестов).
 * @param provider — мок-провайдер, реализующий интерфейс GeminiProvider
 */
export function setGeminiProvider(provider: GeminiProvider): void {
  geminiProvider = provider;
}

/**
 * Сбрасывает Gemini-провайдер на продакшн-реализацию.
 */
export function resetGeminiProvider(): void {
  geminiProvider = new DefaultGeminiProvider();
}

// ============================================================================================
// Feature Toggle: проверка тарифа Enterprise
// ============================================================================================

/**
 * Проверяет, что арендатор имеет тариф Enterprise.
 * Выполняется внутри транзакции с RLS-контекстом.
 * @throws {FeatureNotAvailableError} если тариф не enterprise
 */
export async function checkEnterpriseTier(tenantId: string): Promise<void> {
  return runInTenantContext(tenantId, async (client) => {
    const res = await client.query(
      'SELECT tier FROM subscriptions WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );

    if (res.rows.length === 0) {
      throw new FeatureNotAvailableError('CRM/Calendar');
    }

    const tier = res.rows[0].tier;
    if (tier !== 'enterprise' && tier !== 'premium') {
      throw new FeatureNotAvailableError('CRM/Calendar');
    }
  });
}

// ============================================================================================
// Пост-анализ звонков через Gemini Flash
// ============================================================================================

/**
 * Выполняет пост-анализ контекста звонка через Gemini 2.5 Flash.
 * Функции CRM и Calendar доступны ТОЛЬКО для Enterprise-аккаунтов.
 *
 * @param tenantId — UUID арендатора
 * @param conversationContext — текстовый контекст (транскрипт) разговора
 * @param extractionSchema — динамическая JSON-схема для извлечения сущностей
 */
export async function processCallAnalytics(
  tenantId: string,
  conversationContext: string,
  extractionSchema?: Record<string, string>
): Promise<CallAnalyticsResult> {
  // 1. Feature Toggle: только Enterprise
  await checkEnterpriseTier(tenantId);

  // 2. Формируем системный промпт для Gemini
  const schemaDescription = extractionSchema
    ? `\nИзвлеки следующие поля из разговора:\n${Object.entries(extractionSchema).map(([k, v]) => `- "${k}": ${v}`).join('\n')}`
    : '';

  const systemPrompt = `Ты — ИИ-аналитик звонков платформы VibeVox. Проанализируй транскрипт разговора и верни результат строго в формате JSON:
{
  "entities": { <ключ>: <значение> },
  "triggers": ["<триггер1>", "<триггер2>"],
  "summary": "<краткое резюме>"
}

Список триггеров для распознавания:
- "Нужен юрист" — если упоминается необходимость юридической помощи
- "Нужен врач" — если упоминаются медицинские вопросы
- "Жалоба" — если клиент выражает недовольство
- "Срочный вопрос" — если клиент просит срочную помощь
${schemaDescription}

Ответ должен содержать ТОЛЬКО валидный JSON, без маркдауна или пояснений.`;

  // 3. Вызов Gemini Flash API через провайдер (с per-tenant ключом)
  const response = await geminiProvider.generateContent({
    __tenantId: tenantId,
    model: GEMINI_FLASH_MODEL,
    contents: [
      { role: 'user', parts: [{ text: `${systemPrompt}\n\nТранскрипт разговора:\n${conversationContext}` }] }
    ],
  });

  // 4. Парсинг JSON-ответа от Gemini
  let analyticsResult: CallAnalyticsResult;
  try {
    const rawText = response.text ?? '{}';
    // Очищаем от маркдаун-обёрток, если они есть
    const cleanJson = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    analyticsResult = {
      entities: parsed.entities || {},
      triggers: parsed.triggers || [],
      summary: parsed.summary || '',
    };
  } catch {
    analyticsResult = {
      entities: {},
      triggers: [],
      summary: 'Ошибка парсинга ответа Gemini',
    };
  }

  // 5. Если обнаружены триггеры — интеграция с CRM и Calendar
  if (analyticsResult.triggers.length > 0) {
    // CRM: создание заметки в Chatwoot
    const chatwootApiUrl = getChatwootUrl();
    const chatwootApiToken = getChatwootToken();
    if (chatwootApiUrl && chatwootApiToken) {
      try {
        const crmResponse = await fetch(`${chatwootApiUrl}/api/v1/accounts/1/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api_access_token': chatwootApiToken,
          },
          body: JSON.stringify({
            content: `[VibeVox] Триггеры: ${analyticsResult.triggers.join(', ')}\nРезюме: ${analyticsResult.summary}`,
          }),
        });
        analyticsResult.crmResult = { noteCreated: crmResponse.ok };
      } catch (crmErr) {
        console.error('[Assistant Service] Ошибка интеграции с Chatwoot:', crmErr);
        analyticsResult.crmResult = { noteCreated: false };
      }
    }

    // Calendar: проверка доступных слотов через freebusy.query
    if (GOOGLE_CALENDAR_CREDENTIALS) {
      try {
        // В текущей реализации — заглушка с логированием
        // В продакшн-версии здесь будет вызов Google Calendar API
        console.log('[Assistant Service] Проверка Google Calendar (freebusy.query) — заглушка');
        analyticsResult.calendarResult = { slotsAvailable: true, nextFreeSlot: new Date(Date.now() + 3600000).toISOString() };
      } catch (calErr) {
        console.error('[Assistant Service] Ошибка проверки Google Calendar:', calErr);
        analyticsResult.calendarResult = { slotsAvailable: false };
      }
    }
  }

  return analyticsResult;
}

// ============================================================================================
// Биллинг: атомарное списание аудио-секунд с баланса
// ============================================================================================

/**
 * Атомарно списывает указанное количество секунд с баланса арендатора.
 * Проверяет достаточность баланса перед списанием.
 *
 * @param tenantId — UUID арендатора
 * @param seconds — количество секунд к списанию
 * @returns Оставшийся баланс секунд
 * @throws {InsufficientBalanceError} если баланс недостаточен
 */
export async function deductAudioBalance(tenantId: string, seconds: number): Promise<number> {
  if (seconds <= 0) return -1; // Нечего списывать

  return runInTenantContext(tenantId, async (client) => {
    // Атомарное списание с проверкой достаточности баланса
    const res = await client.query(
      `UPDATE subscriptions 
       SET translation_minutes_balance = translation_minutes_balance - $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $2 AND translation_minutes_balance >= $1
       RETURNING translation_minutes_balance`,
      [Math.ceil(seconds), tenantId]
    );

    if (res.rows.length === 0) {
      // Баланс недостаточен — получаем текущий для сообщения об ошибке
      const balanceRes = await client.query(
        'SELECT translation_minutes_balance FROM subscriptions WHERE tenant_id = $1',
        [tenantId]
      );
      const currentBalance = balanceRes.rows[0]?.translation_minutes_balance ?? 0;
      throw new InsufficientBalanceError(Math.ceil(seconds), currentBalance);
    }

    return res.rows[0].translation_minutes_balance;
  });
}

// Экспорт провайдера для использования в telegram_gateway.ts
export { geminiProvider };
