import { Router, Request, Response } from 'express';
import { LiveKitTokenRequestSchema } from '@vibevox/shared';
import { generateLiveKitToken, countLiveParticipants, MAX_PARTICIPANTS_PER_ROOM } from './service.js';
import { getLiveKitUrl } from '../../config/systemConfig.js';
import { tryAcquire } from '../translation/admission.js';

const livekitRouter = Router();

/**
 * POST /api/livekit/token
 * Валидирует параметры запроса и возвращает подписанный JWT-токен + публичный URL
 * сервера LiveKit, чтобы клиент мог подключиться одним обращением.
 */
livekitRouter.post('/token', async (req: Request, res: Response) => {
  // Валидация входящего тела запроса через Zod-схему
  const parseResult = LiveKitTokenRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Некорректные параметры запроса',
      details: parseResult.error.flatten().fieldErrors
    });
  }

  try {
    // Hard limit 2 живых участника на комнату (без учёта бота-переводчика).
    // Это бизнес-решение: синхронный перевод оптимизирован для 1-на-1.
    const currentCount = await countLiveParticipants(parseResult.data.roomName);
    if (currentCount >= MAX_PARTICIPANTS_PER_ROOM) {
      return res.status(403).json({
        error: 'room_full',
        message: `В комнате уже ${currentCount} участника. Лимит: ${MAX_PARTICIPANTS_PER_ROOM} человека на комнату.`,
        limit: MAX_PARTICIPANTS_PER_ROOM,
        current: currentCount,
      });
    }

    // Admission control: глобальный лимит одновременных слотов перевода (≈ Gemini Live сессий).
    // Резервируем слот ЗДЕСЬ (до подключения и старта bridge), иначе залп из N человек
    // проскочит — реальные сессии создаются позже. Идемпотентно по (room, identity):
    // переподключение того же участника слот не задваивает.
    const admit = tryAcquire(parseResult.data.roomName, parseResult.data.identity);
    if (!admit.ok) {
      return res.status(503).json({
        error: 'service_overloaded',
        message: `Сервис перевода временно перегружен (${admit.current}/${admit.limit} одновременных переводов). Попробуйте через минуту.`,
        limit: admit.limit,
        current: admit.current,
      });
    }

    const token = await generateLiveKitToken(parseResult.data);
    const url = getLiveKitUrl();
    return res.status(200).json({ token, url });
  } catch (err) {
    console.error('[LiveKit] Ошибка генерации токена:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера при генерации токена' });
  }
});

export default livekitRouter;
