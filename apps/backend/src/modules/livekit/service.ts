import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { LiveKitTokenRequest } from '@vibevox/shared';
import { getLiveKitKey, getLiveKitSecret, getLiveKitUrl } from '../../config/systemConfig.js';

/** Максимум живых не-bot участников в одной комнате. */
export const MAX_PARTICIPANTS_PER_ROOM = 2;
/** Identity, которые не учитываются в лимите (боты). */
const BOT_IDENTITIES = new Set(['vibevox-translator']);

/**
 * Возвращает количество живых не-bot участников в LiveKit-комнате.
 * Возвращает 0 если комнаты ещё нет (никто не подключался).
 */
export async function countLiveParticipants(roomName: string): Promise<number> {
  const apiKey = getLiveKitKey();
  const apiSecret = getLiveKitSecret();
  const wsUrl = getLiveKitUrl();
  if (!apiKey || !apiSecret || !wsUrl) return 0;
  // RoomServiceClient ожидает HTTP(S) URL, не WSS — конвертируем.
  const httpUrl = wsUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
  const client = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  try {
    const list = await client.listParticipants(roomName);
    return list.filter((p) => !BOT_IDENTITIES.has(p.identity)).length;
  } catch (err: any) {
    // 404 = комната не существует (никого нет). Это норма для новой комнаты.
    const msg = String(err?.message || err);
    if (msg.includes('not found') || msg.includes('404')) return 0;
    console.warn('[LiveKit.countParticipants] error:', msg);
    return 0;
  }
}

/**
 * Возвращает множество имён комнат, в которых СЕЙЧАС есть живые участники.
 * Используется admission control'ом для reconcile (самоисцеление от утечек слотов:
 * если комнаты больше нет в LiveKit — её слоты можно освободить).
 * При ошибке/недоступности LiveKit возвращает null (reconcile тогда пропускается).
 */
export async function listActiveRoomNames(): Promise<Set<string> | null> {
  const apiKey = getLiveKitKey();
  const apiSecret = getLiveKitSecret();
  const wsUrl = getLiveKitUrl();
  if (!apiKey || !apiSecret || !wsUrl) return null;
  const httpUrl = wsUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
  const client = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  try {
    const rooms = await client.listRooms();
    return new Set(rooms.map((r) => r.name));
  } catch (err: any) {
    console.warn('[LiveKit.listActiveRoomNames] error:', String(err?.message || err));
    return null;
  }
}

/**
 * Генерирует подписанный JWT AccessToken для подключения пользователя к комнате LiveKit.
 * Метаданные языка и пола голоса упаковываются в поле metadata токена в формате JSON-строки,
 * чтобы переводческий воркер (Gemini Live API bridge) мог считать их в реальном времени.
 */
export const generateLiveKitToken = async (params: LiveKitTokenRequest): Promise<string> => {
  const { roomName, identity, nativeLanguage, voiceGender } = params;

  const apiKey = getLiveKitKey();
  const apiSecret = getLiveKitSecret();
  if (!apiKey || !apiSecret) {
    throw new Error('Критическая ошибка: LIVEKIT_API_KEY и LIVEKIT_API_SECRET должны быть заданы!');
  }

  // Метаданные участника — считываются агентом-переводчиком при входе в комнату
  const metadata = JSON.stringify({
    nativeLanguage, // Код языка ISO-639-1 (например: "ru", "en", "ar")
    voiceGender     // Предпочтительный пол голоса переводчика ("male" | "female")
  });

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    metadata
  });

  // Разрешения участника в комнате WebRTC
  token.addGrant({
    roomJoin: true,       // Разрешить подключение к комнате
    room: roomName,       // Ограничение — только конкретная комната
    canPublish: true,     // Разрешить публикацию аудио/видео треков
    canSubscribe: true,   // Разрешить получение треков других участников
    canPublishData: true  // Разрешить передачу данных (чат, служебные сообщения)
  });

  return await token.toJwt();
};
