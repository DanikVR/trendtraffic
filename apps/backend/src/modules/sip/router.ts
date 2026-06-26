import { Router, Request, Response, NextFunction } from 'express';
import { SipTrunkSchema } from '@vibevox/shared';
import {
  upsertSipTrunk, getSipTrunk, deleteSipTrunk,
  createSipInbound, getSipInbound, deleteSipInbound, setSipInboundBridgeActive,
  placeSipCall,
} from './service.js';

const sipRouter = Router();

/**
 * Промежуточное ПО для проверки заголовка "x-tenant-id".
 * Проверяет наличие заголовка и валидность UUID.
 * Если валидация не пройдена, возвращает 400 Bad Request.
 */
const checkTenantHeader = (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'];

  if (!tenantId || typeof tenantId !== 'string') {
    return res.status(400).json({
      error: 'Заголовок "x-tenant-id" обязателен для этого запроса'
    });
  }

  // Регулярное выражение для проверки UUID (v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    return res.status(400).json({
      error: 'Заголовок "x-tenant-id" должен содержать валидный UUID'
    });
  }

  // Сохраняем валидный tenantId в объекте запроса для контроллеров
  (req as any).tenantId = tenantId;
  next();
};

// Применяем валидацию заголовка ко всем эндпоинтам роутера
sipRouter.use(checkTenantHeader);

/**
 * POST /api/sip/trunk — Добавление или обновление настроек SIP-транка арендатора.
 * Валидирует параметры по схеме SipTrunkSchema и синхронизирует с LiveKit.
 */
sipRouter.post('/trunk', async (req: Request, res: Response) => {
  const parseResult = SipTrunkSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Некорректные параметры настроек SIP-транка',
      details: parseResult.error.flatten().fieldErrors
    });
  }

  try {
    const tenantId = (req as any).tenantId;
    const result = await upsertSipTrunk(tenantId, parseResult.data);

    return res.status(200).json({
      status: 'success',
      message: 'Настройки SIP-транка успешно сохранены и синхронизированы с LiveKit',
      trunk: {
        ...result,
        password: '********' // Пароль обязательно маскируется в ответе
      }
    });
  } catch (error) {
    console.error('[SIP Router] Ошибка сохранения транка:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка сервера при сохранении настроек SIP-транка',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/sip/trunk — Получение текущих настроек SIP-транка арендатора.
 * Маскирует пароль (password: '********') для предотвращения утечки учетных данных.
 */
sipRouter.get('/trunk', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const trunk = await getSipTrunk(tenantId);

    if (!trunk) {
      return res.status(404).json({
        error: 'Настройки SIP-транка не найдены для данного арендатора'
      });
    }

    return res.status(200).json({
      ...trunk,
      password: '********' // Пароль скрыт символами маскирования
    });
  } catch (error) {
    console.error('[SIP Router] Ошибка получения транка:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка сервера при получении настроек SIP-транка',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/sip/trunk — Удаление настроек SIP-транка и отзыв конфигурации из LiveKit.
 */
sipRouter.delete('/trunk', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const deleted = await deleteSipTrunk(tenantId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Настройки SIP-транка для удаления не найдены'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Настройки SIP-транка успешно удалены из СУБД и LiveKit'
    });
  } catch (error) {
    console.error('[SIP Router] Ошибка удаления транка:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка сервера при удалении SIP-транка',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================================
// SIP INBOUND — входящие звонки от внешних провайдеров
// ============================================================================================

/**
 * POST /api/sip/inbound — Создаёт inbound trunk + dispatch rule в LiveKit Cloud.
 * Если уже существует — перевыпускает credentials (rotate).
 * Body: пусто.
 * Response: SipInboundDetails со ВКЛЮЧЁННЫМ паролем (пользователь его копирует в Zadarma).
 */
sipRouter.post('/inbound', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const inbound = await createSipInbound(tenantId);
    return res.status(200).json({
      status: 'success',
      message: 'Входящий SIP-транк создан и зарегистрирован в LiveKit',
      inbound,
    });
  } catch (error) {
    console.error('[SIP Router] Ошибка создания inbound:', error);
    return res.status(500).json({
      error: 'Не удалось создать inbound trunk',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/sip/inbound — Возвращает текущий inbound-конфиг тенанта (или 404).
 */
sipRouter.get('/inbound', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const inbound = await getSipInbound(tenantId);
    if (!inbound) {
      return res.status(404).json({ error: 'Входящий SIP-транк не создан для данного арендатора' });
    }
    return res.status(200).json(inbound);
  } catch (error) {
    console.error('[SIP Router] Ошибка получения inbound:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/sip/inbound — Удаляет inbound trunk и dispatch rule.
 */
sipRouter.delete('/inbound', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const deleted = await deleteSipInbound(tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Входящий SIP-транк не найден' });
    }
    return res.status(200).json({
      status: 'success',
      message: 'Входящий SIP-транк удалён из СУБД и LiveKit',
    });
  } catch (error) {
    console.error('[SIP Router] Ошибка удаления inbound:', error);
    return res.status(500).json({
      error: 'Не удалось удалить inbound trunk',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/sip/inbound/activate — Запускает TranslationBridge в комнате tenant'а
 * (чтобы автоматически переводить голос, когда внешние SIP-абоненты позвонят).
 */
sipRouter.post('/inbound/activate', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const inbound = await getSipInbound(tenantId);
    if (!inbound) {
      return res.status(404).json({ error: 'Сначала создайте inbound trunk' });
    }

    // Запускаем bridge через тот же endpoint, что и для обычных комнат
    const startRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/translation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: inbound.roomName }),
    });

    if (startRes.ok || startRes.status === 409) {
      await setSipInboundBridgeActive(tenantId, true);
      return res.status(200).json({
        status: 'success',
        message: 'Приём входящих звонков активирован',
        roomName: inbound.roomName,
      });
    }

    const errBody = await startRes.text().catch(() => '');
    return res.status(502).json({
      error: 'Не удалось запустить переводчик в комнате входящих',
      details: errBody.slice(0, 300),
    });
  } catch (error) {
    console.error('[SIP Router] Ошибка активации inbound:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка при активации приёма',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/sip/inbound/deactivate — Останавливает TranslationBridge.
 */
sipRouter.post('/inbound/deactivate', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const inbound = await getSipInbound(tenantId);
    if (!inbound) {
      return res.status(404).json({ error: 'Inbound trunk не найден' });
    }

    // Stop bridge (404 = уже остановлен, тоже ок)
    await fetch(`http://localhost:${process.env.PORT || 3001}/api/translation/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: inbound.roomName }),
    }).catch(() => {});

    await setSipInboundBridgeActive(tenantId, false);
    return res.status(200).json({
      status: 'success',
      message: 'Приём входящих звонков остановлен',
    });
  } catch (error) {
    console.error('[SIP Router] Ошибка деактивации inbound:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка при деактивации',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/sip/call — Совершает исходящий звонок на телефонный номер.
 * Web-клиент после получения roomId должен подключиться к этой комнате (через /room/{roomId}),
 * и параллельно стартовать TranslationBridge через /api/translation/start.
 *
 * Body: { phoneNumber, calleeLanguage, callerName? }
 * Response: { status, roomId, roomName, sipParticipantId, sipCallStatus, phoneNumber }
 */
sipRouter.post('/call', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { phoneNumber, calleeLanguage, callerName } = req.body || {};

    if (!phoneNumber || typeof phoneNumber !== 'string' || !/^\+?[\d\s\-()]{7,20}$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Укажите корректный телефонный номер (например, +48225550100)' });
    }
    if (!calleeLanguage || typeof calleeLanguage !== 'string' || calleeLanguage.length !== 2) {
      return res.status(400).json({ error: 'Укажите код языка получателя (ISO-639-1, 2 символа, например "en")' });
    }

    const normalizedNumber = phoneNumber.replace(/[\s\-()]/g, '');
    const result = await placeSipCall(tenantId, normalizedNumber, calleeLanguage, callerName);

    // Параллельно стартуем bridge в этой комнате — best-effort, не блокируем ответ
    fetch(`http://localhost:${process.env.PORT || 3001}/api/translation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: result.roomId }),
    }).catch((err) => console.warn('[SIP Call] Не удалось стартовать bridge:', err?.message));

    return res.status(200).json({
      status: 'calling',
      ...result,
    });
  } catch (error) {
    console.error('[SIP Router] Ошибка исходящего звонка:', error);
    return res.status(500).json({
      error: 'Не удалось совершить звонок',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default sipRouter;
