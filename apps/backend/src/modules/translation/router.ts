/**
 * Роутер модуля синхронного перевода.
 *
 * Предоставляет REST-эндпоинты для управления жизненным циклом
 * TranslationBridge (запуск и остановка перевода в комнатах LiveKit).
 */

import { Router, Request, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { TranslationBridge } from './bridge.js';
import { TRANSLATOR_BOT_IDENTITY } from './config.js';
import { getLiveKitUrl, getLiveKitKey, getLiveKitSecret } from '../../config/systemConfig.js';
import { releaseRoom, snapshot as admissionSnapshot, startReconcileLoop } from './admission.js';
import pool from '../../db/index.js';

// Запускаем reconcile-цикл admission control при первом импорте роутера (один раз на процесс).
startReconcileLoop();

const translationRouter = Router();

// ============================================================================================
// Реестр активных мостов: roomName → TranslationBridge
// ============================================================================================

/** Хранилище активных экземпляров TranslationBridge */
const activeBridges: Map<string, TranslationBridge> = new Map();

// ============================================================================================
// Проверка обязательных переменных окружения
// ============================================================================================

// Ключи загружаются динамически через systemConfig (см. POST /start)

// ============================================================================================
// POST /api/translation/start — запуск моста перевода для указанной комнаты
// ============================================================================================

/**
 * Запускает TranslationBridge для указанной комнаты.
 * Создаёт бота-переводчика, генерирует для него токен и подключает к комнате.
 *
 * Body: { roomName: string }
 * Response: { status: 'started', roomName: string, botIdentity: string }
 */
translationRouter.post('/start', async (req: Request, res: Response) => {
  const { roomName } = req.body;

  // Валидация входных данных
  if (!roomName || typeof roomName !== 'string') {
    return res.status(400).json({
      error: 'Поле "roomName" обязательно и должно быть строкой',
    });
  }

  // Динамическая загрузка ключей из systemConfig
  const LIVEKIT_URL = getLiveKitUrl();
  const LIVEKIT_API_KEY = getLiveKitKey();
  const LIVEKIT_API_SECRET = getLiveKitSecret();

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return res.status(500).json({
      error: 'LIVEKIT_API_KEY и LIVEKIT_API_SECRET должны быть заданы в системных настройках',
    });
  }

  // Проверка: мост для этой комнаты уже запущен?
  if (activeBridges.has(roomName)) {
    return res.status(409).json({
      error: `Мост перевода для комнаты "${roomName}" уже запущен`,
      roomName,
    });
  }

  try {
    // Генерация JWT-токена для бота-переводчика
    const botToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: TRANSLATOR_BOT_IDENTITY,
    });

    botToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const tokenJwt = await botToken.toJwt();

    // Определяем tenant-владельца комнаты для биллинга минут
    let billingTenantId: string | undefined;
    try {
      const r = await pool.query('SELECT creator_tenant_id FROM rooms WHERE id = $1 LIMIT 1', [roomName]);
      billingTenantId = r.rows[0]?.creator_tenant_id || undefined;
    } catch { /* fallback может не знать комнату — это норм */ }

    // Создание и запуск TranslationBridge с биллингом
    const bridge = new TranslationBridge(roomName, billingTenantId);
    await bridge.connect(LIVEKIT_URL, tokenJwt);

    // Регистрация моста в реестре
    activeBridges.set(roomName, bridge);

    console.log(`[Translation Router] Мост запущен для комнаты "${roomName}"`);

    return res.status(200).json({
      status: 'started',
      roomName,
      botIdentity: TRANSLATOR_BOT_IDENTITY,
    });
  } catch (err) {
    console.error(`[Translation Router] Ошибка запуска моста для "${roomName}":`, err);
    return res.status(500).json({
      error: 'Внутренняя ошибка при запуске моста перевода',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// ============================================================================================
// POST /api/translation/stop — остановка моста перевода для указанной комнаты
// ============================================================================================

/**
 * Останавливает TranslationBridge для указанной комнаты.
 * Закрывает все Gemini-сессии и отключает бота от комнаты.
 *
 * Body: { roomName: string }
 * Response: { status: 'stopped', roomName: string }
 */
translationRouter.post('/stop', async (req: Request, res: Response) => {
  const { roomName } = req.body;

  // Валидация входных данных
  if (!roomName || typeof roomName !== 'string') {
    return res.status(400).json({
      error: 'Поле "roomName" обязательно и должно быть строкой',
    });
  }

  const bridge = activeBridges.get(roomName);
  if (!bridge) {
    return res.status(404).json({
      error: `Мост перевода для комнаты "${roomName}" не найден`,
      roomName,
    });
  }

  try {
    await bridge.disconnect();
    activeBridges.delete(roomName);
    // Освобождаем все admission-слоты комнаты (hangup / выкл. перевода / удаление).
    releaseRoom(roomName);

    console.log(`[Translation Router] Мост остановлен для комнаты "${roomName}"`);

    return res.status(200).json({
      status: 'stopped',
      roomName,
    });
  } catch (err) {
    console.error(`[Translation Router] Ошибка остановки моста для "${roomName}":`, err);
    return res.status(500).json({
      error: 'Внутренняя ошибка при остановке моста перевода',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// ============================================================================================
// GET /api/translation/status — статус всех активных мостов (для мониторинга)
// ============================================================================================

translationRouter.get('/status', (_req: Request, res: Response) => {
  const bridges: Array<{ roomName: string; active: boolean; sessions: number }> = [];

  for (const [roomName, bridge] of activeBridges) {
    bridges.push({
      roomName,
      active: bridge.active,
      sessions: bridge.sessionCount,
    });
  }

  return res.status(200).json({
    totalBridges: bridges.length,
    bridges,
    // Admission control: глобальная загрузка слотов перевода и текущий лимит.
    admission: admissionSnapshot(),
  });
});

export default translationRouter;
