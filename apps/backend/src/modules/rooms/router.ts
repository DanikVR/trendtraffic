import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createRoom, validateRoom, updateRoomSettings, getRoomById, listRoomsByCreator, renameRoom, deleteRoom } from './service.js';
import { countLiveParticipants } from '../livekit/service.js';
import pool from '../../db/index.js';
import { send500 } from '../../utils/http_error.js';

const roomsRouter = Router();
// ВАЖНО: используем тот же дефолт, что и в auth/router.ts, иначе токены из auth не пройдут verify здесь.
import { JWT_SECRET } from '../../config/secrets.js';

/** Тарифы, у которых минуты не ограничены — им guard баланса не нужен. */
const UNLIMITED_TIERS = new Set(['enterprise', 'premium']);

/**
 * Проверка баланса минут tenant'а перед созданием комнаты.
 * Возвращает {allow:true} если можно создавать (есть минуты или unlimited tier),
 * иначе {allow:false, reason} с описанием для UI.
 */
async function checkTenantCanCreateRoom(tenantId: string): Promise<{ allow: boolean; reason?: string; remainingMinutes?: number; tier?: string }> {
  try {
    const result = await pool.query(
      `SELECT tier, status, translation_minutes_balance, rollover_seconds FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const sub = (result.rows as any[])[0];
    if (!sub) {
      // Нет подписки — считаем что минут нет.
      return { allow: false, reason: 'no_subscription', remainingMinutes: 0 };
    }
    const tier = String(sub.tier || 'trial');
    if (UNLIMITED_TIERS.has(tier)) return { allow: true, tier };

    const seconds = Number(sub.translation_minutes_balance || 0) + Number(sub.rollover_seconds || 0);
    const minutes = Math.floor(seconds / 60);
    if (seconds <= 0) {
      return { allow: false, reason: 'zero_balance', remainingMinutes: 0, tier };
    }
    return { allow: true, remainingMinutes: minutes, tier };
  } catch (err) {
    console.warn('[Rooms] checkTenantCanCreateRoom error:', err);
    // При сбое БД — лучше разрешить, чтобы не блокировать сервис из-за рантайма.
    return { allow: true };
  }
}

/**
 * Опциональный парсер JWT токена.
 * Если токен предоставлен и валиден — извлекает tenantId пользователя для связывания с комнатой.
 * Не прерывает запрос при отсутствии токена.
 */
function optionalAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { tenantId?: string };
      if (decoded && decoded.tenantId) {
        (req as any).tenantId = decoded.tenantId;
      }
    } catch {
      // Игнорируем ошибку валидации токена для опционального гостевого режима
    }
  }
  next();
}

/**
 * POST /api/rooms/create
 * Генерирует уникальную UUID-комнату со сроком действия 24 часа.
 */
roomsRouter.post('/create', optionalAuth, async (req: Request, res: Response) => {
  const { name } = req.body;
  const roomName = name || `Комната ${new Date().toLocaleDateString('ru-RU')}`;
  const tenantId = (req as any).tenantId || null;

  // Guard баланса: если пользователь авторизован — проверяем подписку.
  // Анонимные гости (без tenantId) — пропускаем, они присоединяются к существующим комнатам.
  if (tenantId) {
    const check = await checkTenantCanCreateRoom(tenantId);
    if (!check.allow) {
      return res.status(402).json({
        error: check.reason === 'no_subscription'
          ? 'У вас нет активной подписки. Оформите тариф, чтобы создавать комнаты.'
          : 'На балансе закончились минуты перевода. Оформите тариф или докупите минуты.',
        reason: check.reason,
        remainingMinutes: check.remainingMinutes ?? 0,
        tier: check.tier,
        redirectTo: '/billing',
      });
    }
  }

  try {
    const room = await createRoom(roomName, tenantId);
    
    // Гарантируем корректность формата даты для фронтенда
    const expiresAtDate = room.expires_at && !isNaN(new Date(room.expires_at).getTime())
      ? new Date(room.expires_at)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    return res.status(201).json({
      roomId: room.id,
      name: room.name,
      expiresAt: expiresAtDate.toISOString()
    });
  } catch (err) {
    console.error('[RoomsRouter] Ошибка создания комнаты:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера при создании комнаты' });
  }
});

/**
 * GET /api/rooms/validate/:roomId
 * Публичная валидация комнаты (UUID) и проверка срока жизни (24 часа).
 */
roomsRouter.get('/validate/:roomId', async (req: Request, res: Response) => {
  const { roomId } = req.params;

  try {
    const validation = await validateRoom(roomId);
    if (validation.valid) {
      return res.status(200).json({
        valid: true,
        roomName: validation.name,
        creatorTenantId: validation.creatorTenantId,
        settings: validation.settings,
      });
    } else {
      return res.status(400).json({
        valid: false,
        error: validation.error
      });
    }
  } catch (err) {
    console.error('[RoomsRouter] Ошибка валидации комнаты:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера при валидации комнаты' });
  }
});

/**
 * PATCH /api/rooms/:roomId/settings
 * Обновить настройки комнаты (translation/subtitles enabled). Доступно ТОЛЬКО creator'у.
 * Body: { translationEnabled?: boolean, subtitlesEnabled?: boolean }
 *
 * При изменении translationEnabled:
 *   false → если bridge активен, инициируем его остановку через /api/translation/stop (best-effort)
 *   true → НЕ запускаем автоматически — клиент сам дёрнет /start (он знает targetLanguage, voiceGender).
 */
roomsRouter.patch('/:roomId/settings', optionalAuth, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { roomId } = req.params;
  const { translationEnabled, subtitlesEnabled } = req.body || {};

  if (!tenantId) {
    return res.status(401).json({ error: 'Только авторизованный creator комнаты может менять настройки.' });
  }
  const room = await getRoomById(roomId);
  if (!room) return res.status(404).json({ error: 'Комната не найдена.' });
  if (room.creator_tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Менять настройки комнаты может только её создатель.' });
  }

  const patch: any = {};
  if (typeof translationEnabled === 'boolean') patch.translationEnabled = translationEnabled;
  if (typeof subtitlesEnabled === 'boolean') patch.subtitlesEnabled = subtitlesEnabled;
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'Нужно передать translationEnabled или subtitlesEnabled.' });
  }

  const newSettings = await updateRoomSettings(roomId, patch);
  if (!newSettings) return res.status(500).json({ error: 'Не удалось сохранить настройки.' });

  // Если перевод выключили — best-effort останавливаем bridge.
  if (patch.translationEnabled === false) {
    const origin = req.headers.origin || `http://localhost:${process.env.PORT === '3001' ? '3000' : '3001'}`;
    const internal = `http://localhost:${process.env.PORT || '3001'}`;
    fetch(`${internal}/api/translation/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: roomId }),
    }).catch(() => {});
    void origin;
  }

  return res.json({ status: 'success', settings: newSettings });
});

/**
 * POST /api/rooms/:roomId/transcripts
 * Сохранить накопленные субтитры (вызывается фронтом при hangup для post-call insights).
 * Body: { transcripts: Array<{ author, text, ts, isFinal }> }
 *
 * ENTERPRISE v0.10.0: также копируем финальные транскрипты в room_messages
 * с source='transcript' — чтобы они появились в чат-ленте Enterprise-комнаты
 * (для последующего анализа). Старые записи с source='transcript' удаляются перед
 * вставкой новых (т.к. фронт всегда шлёт ПОЛНЫЙ массив транскриптов комнаты).
 * Сообщения source='chat' (ручные заметки владельца) не трогаем.
 */
roomsRouter.post('/:roomId/transcripts', optionalAuth, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { roomId } = req.params;
  const { transcripts } = req.body || {};
  if (!Array.isArray(transcripts)) return res.status(400).json({ error: 'transcripts must be array' });

  const room = await getRoomById(roomId);
  if (!room) return res.status(404).json({ error: 'Комната не найдена' });
  // H6: требуем валидный токен creator'а и совпадение tenant. Без токена (гость)
  // tenantId === undefined → 403. Раньше при отсутствии токена проверка пропускалась,
  // и кто угодно по известному roomId мог перезаписать транскрипт / влить в чат.
  if (!tenantId || room.creator_tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Только creator комнаты сохраняет транскрипт.' });
  }

  const trimmed = transcripts.slice(0, 5000);

  try {
    await pool.query('UPDATE rooms SET transcripts = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [JSON.stringify(trimmed), roomId]);
  } catch { /* in-memory вариант — не сохраняем, аналитика для тех, у кого PG */ }

  // ENTERPRISE v0.10.0: зеркалируем в room_messages для чата
  try {
    // Удаляем старые transcript-сообщения
    await pool.query(`DELETE FROM room_messages WHERE room_id = $1 AND source = 'transcript'`, [roomId]);
    // Вставляем финальные
    let inserted = 0;
    for (const t of trimmed) {
      if (!t || typeof t !== 'object') continue;
      const text = String((t as any).text || '').trim();
      if (!text) continue;
      const author = String((t as any).author || 'unknown');
      const isFinal = (t as any).isFinal !== false; // по умолчанию финальные
      if (!isFinal) continue;
      // Тех. эвристика: если author === 'translator' / 'bot' / 'vibevox' — это AI; иначе client
      const isAi = /bot|translator|vibevox|ai/i.test(author);
      await pool.query(
        `INSERT INTO room_messages
          (room_id, sender, source, kind, content, language_detected, metadata, created_at)
         VALUES ($1, $2, 'transcript', 'text', $3, $4, $5, $6)`,
        [
          roomId,
          isAi ? 'ai' : 'client',
          text.slice(0, 4000),
          (t as any).speakerLanguage || null,
          JSON.stringify({ author, originalTimestamp: (t as any).ts || null }),
          (t as any).ts ? new Date(Number((t as any).ts)) : new Date(),
        ]
      );
      inserted++;
    }
    if (inserted > 0) {
      console.log(`[rooms/transcripts] mirrored ${inserted} transcript-rows to room_messages for room ${roomId}`);
    }
  } catch (err) {
    console.warn('[rooms/transcripts] mirroring to room_messages failed (non-fatal):', (err as Error).message);
  }

  return res.json({ status: 'success', count: transcripts.length });
});

/**
 * GET /api/rooms
 * Список комнат текущего tenant'а с участником-count для каждой (live).
 * Доступно только авторизованным.
 */
roomsRouter.get('/', optionalAuth, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) return res.status(401).json({ error: 'Не авторизован' });

  try {
    const rooms = await listRoomsByCreator(tenantId);
    // Параллельно дёргаем participantsCount + assigned tags для каждой.
    const enriched = await Promise.all(rooms.map(async (r) => {
      let participantsCount = 0;
      // Для telegram_chat-комнат counts нет — это не LiveKit-комната.
      if (r.kind !== 'telegram_chat') {
        try { participantsCount = await countLiveParticipants(r.id); } catch { /* */ }
      }
      // Теги (best-effort, не блокируем при ошибке)
      let tags: Array<{ id: string; name: string; color: string | null; confidence: number | null }> = [];
      try {
        const tr = await pool.query(
          `SELECT a.id, a.confidence, t.name, t.color
           FROM client_tag_assignments a
           LEFT JOIN tenant_need_tags t ON t.id = a.tag_id
           WHERE a.room_id = $1`,
          [r.id]
        );
        tags = (tr.rows as any[]).map((row) => ({
          id: row.id,
          name: row.name || '?',
          color: row.color || null,
          confidence: row.confidence != null ? Number(row.confidence) : null,
        }));
      } catch { /* */ }

      return {
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        settings: r.settings || { translationEnabled: true, subtitlesEnabled: true },
        participantsCount,
        isLive: participantsCount > 0,
        // ENTERPRISE v0.10.0
        kind: r.kind || 'video',
        telegramUsername: r.telegram_username || null,
        telegramDisplayName: r.telegram_display_name || null,
        tags,
      };
    }));
    return res.json({ rooms: enriched });
  } catch (err: any) {
    console.error('[Rooms] list error:', err);
    return send500(res, err, 'rooms');
  }
});

/**
 * PATCH /api/rooms/:roomId
 * Переименовать комнату. Только creator может.
 * Body: { name: string }
 */
roomsRouter.patch('/:roomId', optionalAuth, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { roomId } = req.params;
  const name = String(req.body?.name || '').trim().slice(0, 200);
  if (!tenantId) return res.status(401).json({ error: 'Не авторизован' });
  if (!name) return res.status(400).json({ error: 'Имя обязательно' });

  const room = await getRoomById(roomId);
  if (!room) return res.status(404).json({ error: 'Комната не найдена' });
  if (room.creator_tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Переименовать может только создатель' });
  }

  await renameRoom(roomId, name);
  return res.json({ status: 'success', name });
});

/**
 * DELETE /api/rooms/:roomId
 * Hard delete: комната + все связанные данные (transcripts, insights) удаляются из БД.
 * Только creator может. Если в комнате есть участники — они будут выкинуты при следующем reconnect.
 */
roomsRouter.delete('/:roomId', optionalAuth, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { roomId } = req.params;
  if (!tenantId) return res.status(401).json({ error: 'Не авторизован' });

  const room = await getRoomById(roomId);
  if (!room) return res.status(404).json({ error: 'Комната не найдена' });
  if (room.creator_tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Удалить может только создатель' });
  }

  // Best-effort останавливаем bridge и отключаем участников через LiveKit
  try {
    const internal = `http://localhost:${process.env.PORT || '3001'}`;
    fetch(`${internal}/api/translation/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: roomId }),
    }).catch(() => {});
  } catch { /* */ }

  await deleteRoom(roomId);
  return res.json({ status: 'success', deleted: roomId });
});

export default roomsRouter;
