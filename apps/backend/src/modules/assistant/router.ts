/**
 * Express-роутер модуля ИИ-ассистента.
 *
 * Предоставляет REST-эндпоинты:
 * - POST /api/assistant/call-analytics — пост-анализ завершённых звонков (только Enterprise)
 * - POST /api/assistant/telegram-gateway — мультимодальный Telegram-шлюз (текст/аудио)
 *
 * Все эндпоинты требуют валидного UUID в заголовке x-tenant-id.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CallAnalyticsRequestSchema, TelegramGatewayRequestSchema } from '@vibevox/shared';
import { processCallAnalytics, FeatureNotAvailableError, InsufficientBalanceError } from './service.js';
import { processTelegramRequest } from './telegram_gateway.js';

const assistantRouter = Router();

// ============================================================================================
// Middleware: проверка заголовка x-tenant-id (UUID)
// ============================================================================================

/**
 * Промежуточное ПО для валидации заголовка x-tenant-id.
 * Проверяет наличие заголовка и корректность формата UUID.
 * При нарушении возвращает 400 Bad Request.
 */
const checkTenantHeader = (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId || typeof tenantId !== 'string') {
    return res.status(400).json({
      error: 'Заголовок "x-tenant-id" обязателен для этого запроса',
    });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    return res.status(400).json({
      error: 'Заголовок "x-tenant-id" должен содержать валидный UUID',
    });
  }

  (req as any).tenantId = tenantId;
  next();
};

// Применяем валидацию заголовка ко всем эндпоинтам роутера
assistantRouter.use(checkTenantHeader);

// ============================================================================================
// POST /api/assistant/call-analytics — пост-анализ звонков
// ============================================================================================

/**
 * Анализирует контекст завершённого звонка через Gemini Flash.
 * Извлекает JSON-сущности по динамическим схемам, проверяет триггеры.
 * При обнаружении триггеров — интегрируется с Chatwoot CRM и Google Calendar.
 *
 * Доступно ТОЛЬКО для тарифа Enterprise (Feature Toggle).
 *
 * Body: { roomName, conversationContext, extractionSchema? }
 */
assistantRouter.post('/call-analytics', async (req: Request, res: Response) => {
  // Валидация входных данных через Zod
  const parseResult = CallAnalyticsRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Некорректные параметры запроса анализа звонка',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  try {
    const tenantId = (req as any).tenantId;
    const { conversationContext, extractionSchema } = parseResult.data;

    const result = await processCallAnalytics(tenantId, conversationContext, extractionSchema);

    return res.status(200).json({
      status: 'success',
      analytics: result,
    });
  } catch (error) {
    // Feature Toggle: CRM/Calendar недоступны для не-Enterprise аккаунтов
    if (error instanceof FeatureNotAvailableError) {
      return res.status(403).json({
        error: error.message,
        code: 'FEATURE_NOT_AVAILABLE',
      });
    }

    console.error('[Assistant Router] Ошибка анализа звонка:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка при анализе звонка',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// ============================================================================================
// POST /api/assistant/telegram-gateway — мультимодальный Telegram-шлюз
// ============================================================================================

/**
 * Универсальный эндпоинт для обработки запросов от стороннего Telegram-бота.
 * Поддерживает текстовый и аудио-ввод, генерирует текстовый или аудио-ответ.
 *
 * При обработке аудио списывает секунды с баланса арендатора.
 * При недостаточном балансе возвращает 402 Payment Required.
 *
 * Body: { text?, audio?, response_type, voice_gender?, language? }
 */
assistantRouter.post('/telegram-gateway', async (req: Request, res: Response) => {
  // Валидация входных данных через Zod
  const parseResult = TelegramGatewayRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Некорректные параметры запроса Telegram-шлюза',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  try {
    const tenantId = (req as any).tenantId;
    const result = await processTelegramRequest(tenantId, parseResult.data);

    return res.status(200).json(result);
  } catch (error) {
    // Биллинг: недостаточно секунд на балансе
    if (error instanceof InsufficientBalanceError) {
      return res.status(402).json({
        error: error.message,
        code: 'INSUFFICIENT_BALANCE',
      });
    }

    console.error('[Assistant Router] Ошибка Telegram-шлюза:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка при обработке запроса Telegram-шлюза',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default assistantRouter;
