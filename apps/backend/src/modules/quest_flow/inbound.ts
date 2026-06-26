/**
 * Главный обработчик входящих запросов от Quest Flow.
 *
 * Flow:
 *  1. Аутентификация — Bearer-токен в заголовке Authorization → tenantId
 *  2. Enterprise-gating — если у tenant'а уже не Enterprise тариф, возвращаем 402
 *  3. Find-or-create telegram_chat комнаты по (tenantId, bot_id, user_id)
 *  4. Если audio — транскрибируем (transcribe.ts), детектируем язык/диалект
 *  5. Списываем секунды с баланса (если аудио)
 *  6. Сохраняем сообщение клиента в room_messages
 *  7. Генерируем AI-ответ через responder.ts
 *  8. Сохраняем AI-ответ в room_messages
 *  9. Запускаем детекцию тегов (асинхронно, не блокирует ответ)
 * 10. Возвращаем ответ для QF: { text, language, dialect, detectedTags, roomId, balanceRemaining }
 */

import { findOrCreateTelegramChatRoom } from '../rooms/service.js';
import { insertMessage } from '../rooms/messages.js';
import { transcribeAudio, transcribeVideoAudio } from './transcribe.js';
import { respondToClient } from './responder.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { getTenantImageConfig, normalizePresetKey } from './image_presets.js';
import { runImagePresetTransform } from './image_transform.js';
import type { GenInputImage } from './image_gen.js';
import { detectNeedTags, applyDetectedTags } from '../need_tags/detector.js';
import { deductAudioBalance, InsufficientBalanceError } from '../assistant/service.js';
import {
  requireEnterprise,
  EnterpriseFeatureRequiredError,
  type UserRole,
} from '../billing/feature_gate.js';
import { sendOwnerNotification } from '../tenant_settings/owner_telegram.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

// Абсолютный публичный URL для медиа, которое Quest Flow отдаёт клиенту (как в outbox.ts).
// Сгенерированную картинку облачный QF может скачать только по абсолютному https-URL.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
function toAbsoluteMediaUrl(u: string | null): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (!PUBLIC_BASE_URL) return u;
  return `${PUBLIC_BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}

/** Запасной ответ, если генерация картинки по пресету не удалась (фильтр/ошибка модели). */
const IMAGE_GEN_FAILED_REPLY =
  'Не удалось обработать изображение. Пришлите, пожалуйста, другое фото или опишите задачу подробнее.';

// Куда сохраняем входящие медиа от клиента (фото/видео/файлы). Та же папка,
// что и для исходящих медиа владельца — её раздаёт express.static('/uploads').
const __qf_filename = fileURLToPath(import.meta.url);
const __qf_dirname = path.dirname(__qf_filename);
const INBOUND_UPLOAD_DIR = path.resolve(__qf_dirname, '../../../../uploads/enterprise-chat');
try { fs.mkdirSync(INBOUND_UPLOAD_DIR, { recursive: true }); } catch { /* best-effort */ }

const MAX_INBOUND_MEDIA_BYTES = 30 * 1024 * 1024; // 30 МБ

/**
 * Запасной ответ, если модель вернула ПУСТОЙ текст на медиа/голос. Без него Quest Flow
 * получит response.text="" → решит «просто сохранено» → игроку НИЧЕГО не отправит.
 * Срабатывает в редком крае (напр. safety-фильтр Gemini на фото/видео).
 */
const MEDIA_FALLBACK_REPLY =
  'Спасибо, вложение получено! Опишите, пожалуйста, ваш вопрос текстом — так я смогу ответить точнее.';

export function mediaExtForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
    'image/gif': '.gif', 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
    'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/webm': '.weba',
    'application/pdf': '.pdf',
  };
  return map[mime.toLowerCase()] || '';
}

function mediaKindForMime(mime: string): 'image' | 'video' | 'audio' | 'file' {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'file';
}

/**
 * Угадывает MIME по расширению файла — для случая, когда Quest Flow прислал медиа с
 * generic MIME (Telegram при пересылке часто отдаёт application/octet-stream). Корректный
 * video/image MIME нужен Gemini для распознавания (Files API для видео / inline vision для фото).
 */
function mimeForExt(nameOrPath: string): string | null {
  const ext = path.extname(nameOrPath || '').toLowerCase();
  const map: Record<string, string> = {
    '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.3gp': 'video/3gpp',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  };
  return map[ext] || null;
}

/**
 * Сохраняет base64-медиа от клиента на диск. Возвращает относительный URL —
 * его раздаёт express.static('/uploads'); владелец видит файл в чате комнаты.
 * Экспортируется для unit-проверок.
 */
export interface SavedInboundMedia {
  mediaUrl: string;
  mediaMime: string;
  mediaSize: number;
  kind: 'image' | 'video' | 'audio' | 'file';
  /** Очищенный (без префикса data:) base64 — для передачи в Gemini vision (фото). */
  base64: string;
  /** Абсолютный путь к файлу на диске — для загрузки видео в Gemini Files API. */
  filePath: string;
}

export function saveInboundMedia(
  base64: string,
  mime: string,
  kindHint?: 'image' | 'video' | 'audio' | 'file'
): SavedInboundMedia {
  // Срезаем возможный префикс data:...;base64,
  const cleaned = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const buf = Buffer.from(cleaned, 'base64');
  if (buf.length === 0) throw new QuestFlowBadRequestError('Пустое медиа (base64 не распознан)');
  if (buf.length > MAX_INBOUND_MEDIA_BYTES) {
    throw new QuestFlowBadRequestError(`Медиа превышает лимит ${Math.round(MAX_INBOUND_MEDIA_BYTES / 1024 / 1024)} МБ`);
  }
  const filename = `qf-${randomUUID()}${mediaExtForMime(mime)}`;
  const filePath = path.join(INBOUND_UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, buf);
  return {
    mediaUrl: `/uploads/enterprise-chat/${filename}`,
    mediaMime: mime,
    mediaSize: buf.length,
    kind: kindHint || mediaKindForMime(mime),
    base64: cleaned,
    filePath,
  };
}

/** Escape для HTML в Telegram-сообщениях (только базовые символы). */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const AUDIO_SAMPLE_RATE = 16000;
const BYTES_PER_SECOND = AUDIO_SAMPLE_RATE * 2; // 16-bit mono PCM

export interface QuestFlowInboundInput {
  /** Telegram bot ID (целое число как строка) */
  telegram_bot_id: string;
  /** Telegram user ID (chat_id клиента) */
  telegram_user_id: string;
  /** Опционально — username клиента в Telegram (для отображения) */
  telegram_username?: string;
  /** Опционально — first_name + last_name клиента (если нет username) */
  telegram_display_name?: string;
  /** Текстовое сообщение от клиента (если передано) */
  text?: string;
  /** Base64-закодированное аудио (PCM 16kHz mono — желательно, либо OGG/MP3) */
  audio?: string;
  /** MIME-тип аудио. По умолчанию 'audio/ogg' (Telegram голосовые) */
  audio_mime?: string;
  /** Base64 медиа от клиента (фото/видео/документ). Без префикса data:. */
  media?: string;
  /** MIME-тип медиа, напр. 'image/jpeg', 'video/mp4', 'application/pdf'. */
  media_mime?: string;
  /** Явный тип медиа (если не передан — определяется по media_mime). */
  media_kind?: 'image' | 'video' | 'audio' | 'file';
  /**
   * Совместимость с Quest Flow v1.5.0: фото клиента приходит полем `image`
   * (base64, без префикса data:). Трактуется как `media` с kind=image.
   */
  image?: string;
  /** Совместимость с QF v1.5.0: MIME фото — синоним media_mime. */
  image_mime?: string;
  /**
   * ЖЁСТКАЯ привязка функции преобразования изображения — ключ пресета (раздел Quest Flow).
   * Кнопка Telegram-бота в QF шлёт этот ключ. Если пресет найден и включён — VibeVox
   * генерит/правит картинку именно этим пресетом и возвращает её в response.imageUrl
   * (ИИ ничего не выбирает). Если не задан/не найден — обычный AI-диалог как раньше.
   */
  preset_key?: string;
  /** Доп. картинки клиента (base64) для функций с двумя входами (напр. перенос стиля A+B). */
  images?: Array<{ data: string; mime?: string }>;
  /** Опциональные метаданные от QF (название цепочки, узла и т.д.) — для логов */
  metadata?: Record<string, any>;
}

export interface QuestFlowInboundResult {
  ok: boolean;
  roomId: string;
  /** Что ответил AI */
  response: {
    text: string;
    /**
     * Абсолютный URL сгенерированной/преобразованной картинки — если сработал preset_key.
     * Quest Flow должен отправить её клиенту как фото (sendPhoto), а text — как подпись.
     */
    imageUrl?: string | null;
    imageMime?: string | null;
  };
  /** Распознанный язык клиента (если был audio) */
  language?: string | null;
  /** Распознанный диалект (если есть) */
  dialect?: string | null;
  /** Транскрипция аудио (для отладки на стороне QF) */
  transcription?: string;
  /** Совпавшие теги потребностей (отправь в CRM на своей стороне если хочешь) */
  detectedTags?: Array<{ tagId: string; tagName: string; confidence: number }>;
  /** Остаток секунд на балансе (если был аудио — иначе -1) */
  balanceRemaining: number;
}

export class QuestFlowAuthError extends Error {
  public readonly statusCode = 401;
  constructor(message: string) { super(message); this.name = 'QuestFlowAuthError'; }
}

export class QuestFlowBadRequestError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) { super(message); this.name = 'QuestFlowBadRequestError'; }
}

/**
 * Главный обработчик. Caller — quest_flow/router.ts (Express endpoint).
 *
 * tenantId должен быть уже резолвлен из API ключа в роуте.
 */
export async function processQuestFlowInbound(
  tenantId: string,
  input: QuestFlowInboundInput
): Promise<QuestFlowInboundResult> {
  // 1. Validate input
  if (!input.telegram_bot_id || !input.telegram_user_id) {
    throw new QuestFlowBadRequestError('Обязательные поля: telegram_bot_id, telegram_user_id');
  }
  // Telegram user/bot IDs — всегда целые числа (возможно отрицательные для супергрупп/каналов).
  // Не-числовые значения — синтетические/тестовые ID Quest Flow; комнату не создаём.
  if (!/^-?\d+$/.test(String(input.telegram_user_id).trim())) {
    throw new QuestFlowBadRequestError(
      `telegram_user_id должен быть числом (реальный Telegram chat_id). Получено: "${String(input.telegram_user_id).slice(0, 32)}"`
    );
  }
  if (!/^-?\d+$/.test(String(input.telegram_bot_id).trim())) {
    throw new QuestFlowBadRequestError(
      `telegram_bot_id должен быть числом (реальный Telegram bot ID). Получено: "${String(input.telegram_bot_id).slice(0, 32)}"`
    );
  }
  // QF v1.5.0 шлёт фото полем `image`/`image_mime` — принимаем его наравне с обобщённым
  // `media`/`media_mime` (kind=image), чтобы фото распознавалось vision-моделью независимо
  // от того, какое имя поля использует Quest Flow.
  const mediaBase64 = input.media || input.image;
  const mediaMime = input.media_mime || input.image_mime;
  const mediaKind: SavedInboundMedia['kind'] | undefined =
    input.media_kind || (input.image && !input.media ? 'image' : undefined);
  const hasImagesArray = Array.isArray(input.images) && input.images.length > 0;
  if (!input.text && !input.audio && !mediaBase64 && !hasImagesArray) {
    throw new QuestFlowBadRequestError('Передайте text, audio, image, media или images');
  }

  // 2. Enterprise gating
  try {
    // userRole не передаём — superadmin-bypass здесь не нужен, проверяем именно тариф
    await requireEnterprise(tenantId, undefined as UserRole | undefined, 'quest-flow');
  } catch (err) {
    if (err instanceof EnterpriseFeatureRequiredError) {
      throw new EnterpriseFeatureRequiredError('quest-flow');
    }
    throw err;
  }

  // 3. Find-or-create room. Запоминаем, была ли комната новой — для уведомления владельцу.
  const roomCreatedAtMs = Date.now();
  const room = await findOrCreateTelegramChatRoom(tenantId, {
    telegramBotId: input.telegram_bot_id,
    telegramUserId: input.telegram_user_id,
    telegramUsername: input.telegram_username || null,
    telegramDisplayName: input.telegram_display_name || null,
  });
  // Если created_at в пределах 5 сек — это свежесозданная комната (1-й контакт с этим клиентом)
  const isFreshRoom = Math.abs(roomCreatedAtMs - new Date(room.created_at).getTime()) < 5000;

  // 4. Process audio (transcribe + billing)
  let transcription: string | undefined;
  let language: string | null = null;
  let dialect: string | null = null;
  let dialectInstruction: string | null = null;
  let balanceRemaining = -1;

  if (input.audio) {
    // Биллинг — best-effort расчёт длительности аудио по байтам PCM 16kHz
    // (для не-PCM форматов это грубая оценка; в проде стоит распарсить контейнер)
    const audioBytes = Math.ceil((input.audio.length * 3) / 4); // base64 → bytes
    const seconds = Math.max(1, Math.round(audioBytes / BYTES_PER_SECOND));
    try {
      balanceRemaining = await deductAudioBalance(tenantId, seconds);
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        // Возвращаем дружественную ошибку для QF
        throw new QuestFlowBadRequestError(err.message);
      }
      throw err;
    }

    const tr = await transcribeAudio(tenantId, input.audio, input.audio_mime || 'audio/ogg');
    transcription = tr.text;
    language = tr.language;
    dialect = tr.dialect;
    dialectInstruction = tr.dialectInstruction;
  }

  // 4.5 Save non-audio media (image/video/file) from client to disk.
  let inboundMedia: SavedInboundMedia | null = null;
  if (mediaBase64) {
    inboundMedia = saveInboundMedia(mediaBase64, mediaMime || 'application/octet-stream', mediaKind);
  }

  const effectiveText = (input.text || transcription || '').trim();

  // Жёсткое преобразование изображения по кнопке Quest Flow (preset_key). Если пресет найден
  // — генерим/правим картинку именно им и возвращаем её; обычный AI-диалог НЕ запускается.
  if (input.preset_key) {
    const transformed = await maybeRunImagePreset({
      tenantId,
      roomId: room.id,
      presetKey: input.preset_key,
      clientImages: collectClientImages(input.images, inboundMedia),
      clientRequest: effectiveText,
      inboundMedia,
      messageMetadata: {
        telegram_bot_id: input.telegram_bot_id,
        telegram_user_id: input.telegram_user_id,
        ...(input.metadata || {}),
      },
    });
    if (transformed) return transformed;
  }

  // 5–10. Общий хвост (запись реплики → AI-ответ → теги → уведомления → результат)
  // вынесен в finalizeInboundDialogue — его же использует multipart-эндпоинт inbound-media.
  return finalizeInboundDialogue({
    tenantId,
    room,
    isFreshRoom,
    effectiveText,
    inboundMedia,
    hasAudio: !!input.audio,
    language,
    dialect,
    dialectInstruction,
    transcription,
    balanceRemaining,
    client: {
      username: input.telegram_username,
      displayName: input.telegram_display_name,
      userId: input.telegram_user_id,
    },
    messageMetadata: {
      telegram_bot_id: input.telegram_bot_id,
      telegram_user_id: input.telegram_user_id,
      ...(input.metadata || {}),
    },
  });
}

/** Текстовый плейсхолдер для AI/уведомлений, когда у медиа нет подписи. */
function mediaPlaceholder(kind: SavedInboundMedia['kind']): string {
  switch (kind) {
    case 'image': return '[Клиент отправил изображение]';
    case 'video': return '[Клиент отправил видео]';
    case 'audio': return '[Клиент отправил аудио]';
    default: return '[Клиент отправил файл]';
  }
}

/**
 * Контент сообщения клиента для чата ВЛАДЕЛЬЦА. К подписи добавляем ПОЛНУЮ расшифровку медиа
 * (дословная речь + извлечённый визуал), если она есть. Эта расшифровка видна только владельцу
 * в чате комнаты — клиенту в Telegram она НЕ уходит (клиенту — только clientReply).
 */
function composeClientContent(
  caption: string,
  recognition: { transcript: string; visual: string } | null | undefined
): string {
  if (!recognition || (!recognition.transcript && !recognition.visual)) {
    return caption;
  }
  const blocks: string[] = [];
  if (caption) blocks.push(caption);
  if (recognition.transcript) blocks.push(`🎤 Расшифровка речи:\n${recognition.transcript}`);
  if (recognition.visual) blocks.push(`👁 На видео/фото:\n${recognition.visual}`);
  return blocks.join('\n\n');
}

interface FinalizeInboundParams {
  tenantId: string;
  /** Комната клиента (нужен только id). */
  room: { id: string };
  /** true, если комната только что создана (1-й контакт) — триггерит уведомление владельцу. */
  isFreshRoom: boolean;
  /** Уже извлечённый текст реплики (подпись к медиа или транскрипция голоса). */
  effectiveText: string;
  /** Сохранённое медиа клиента (фото/видео/файл) или null. */
  inboundMedia: SavedInboundMedia | null;
  /** Было ли это голосовое (аудио не сохраняем как media — только транскрибируем). */
  hasAudio: boolean;
  language: string | null;
  dialect: string | null;
  dialectInstruction: string | null;
  transcription?: string;
  /** Остаток секунд на балансе (-1, если аудио не было). */
  balanceRemaining: number;
  /** Поля для подписи клиента в уведомлениях владельцу. */
  client: { username?: string | null; displayName?: string | null; userId: string };
  /** metadata записываемого сообщения клиента (telegram ids + произвольные поля от QF). */
  messageMetadata: Record<string, any>;
}

/**
 * Общий «хвост» обработки входящего сообщения, единый для JSON-эндпоинта (/inbound)
 * и multipart-эндпоинта (/inbound-media):
 *  5. Запись реплики клиента в room_messages
 *  6. Генерация AI-ответа (с vision, если пришло изображение)
 *  7. Запись AI-ответа
 *  8. Детекция тегов потребностей
 *  9. Уведомления владельцу (новая комната / новые теги)
 * 10. Формирование ответа для Quest Flow
 */
async function finalizeInboundDialogue(p: FinalizeInboundParams): Promise<QuestFlowInboundResult> {
  const {
    tenantId, room, isFreshRoom, effectiveText, inboundMedia, hasAudio,
    language, dialect, dialectInstruction, transcription, balanceRemaining,
    client, messageMetadata,
  } = p;

  // 5. Распознавание медиа + ответ клиенту.
  // ИЗОБРАЖЕНИЕ → inline base64. ВИДЕО (вкл. video_note-кружки) → Gemini Files API (визуал + clientReply).
  const isImage = inboundMedia?.kind === 'image';
  const isVideo = inboundMedia?.kind === 'video';
  const aiPromptText =
    effectiveText || (inboundMedia ? mediaPlaceholder(inboundMedia.kind) : '');

  // V2: для ВИДЕО извлекаем аудиодорожку (ffmpeg) и прогоняем через наш ASR (transcribeAudio) —
  // ДОСЛОВНАЯ речь + язык/диалект (точнее in-video ASR Gemini, плюс подмешивается dialect_rules).
  // Fail-soft: ffmpeg недоступен / нет дорожки → videoSpeech=null → используется in-video transcript (V1).
  let effLanguage = language;
  let effDialect = dialect;
  let effDialectInstruction = dialectInstruction;
  let videoSpeech: string | null = null;
  if (isVideo && inboundMedia) {
    try {
      const va = await transcribeVideoAudio(tenantId, inboundMedia.filePath);
      if (va && va.text && va.text.trim()) {
        videoSpeech = va.text.trim();
        effLanguage = va.language || effLanguage;
        effDialect = va.dialect || effDialect;
        effDialectInstruction = va.dialectInstruction || effDialectInstruction;
      }
    } catch (err) {
      console.warn('[quest_flow/inbound] видео-ASR (ffmpeg) не удался, продолжаем с in-video Gemini:', (err as Error).message);
    }
  }

  const aiResponse = await respondToClient({
    tenantId,
    roomId: room.id,
    latestClientMessage: aiPromptText,
    dialectInstruction: effDialectInstruction,
    // base64 для vision может быть пустым (видео/файл или слишком большое фото) — тогда не передаём.
    imageBase64: isImage && inboundMedia!.base64 ? inboundMedia!.base64 : null,
    imageMime: isImage ? inboundMedia!.mediaMime : null,
    // видео распознаётся через Files API (по пути файла на диске).
    videoFilePath: isVideo ? inboundMedia!.filePath : null,
    videoMime: isVideo ? inboundMedia!.mediaMime : null,
    // V2: точная расшифровка речи (если получили) — заземляет clientReply и попадёт в transcript.
    speechTranscript: videoSpeech,
  });

  // Ответ КЛИЕНТУ (уходит в Telegram — одно сообщение по промту). Гарантия непустоты для медиа/голоса.
  let clientReply = (aiResponse.text || '').trim();
  if (!clientReply && (inboundMedia || hasAudio)) {
    clientReply = MEDIA_FALLBACK_REPLY;
  }

  // 6. Сообщение клиента в чат комнаты. ПОЛНАЯ расшифровка (речь + визуал) — видит ТОЛЬКО владелец;
  //    клиенту она НЕ уходит. transcript = точный ASR (V2) если есть, иначе in-video Gemini (V1).
  const mergedRecognition = aiResponse.recognition
    ? { transcript: videoSpeech || aiResponse.recognition.transcript, visual: aiResponse.recognition.visual }
    : (videoSpeech ? { transcript: videoSpeech, visual: '' } : null);
  const clientContent = composeClientContent(effectiveText, mergedRecognition);
  const clientMsg = await insertMessage({
    roomId: room.id,
    sender: 'client',
    source: (hasAudio || inboundMedia) ? 'media' : 'chat',
    kind: inboundMedia ? inboundMedia.kind : (hasAudio ? 'audio' : 'text'),
    content: clientContent || null,
    mediaUrl: inboundMedia ? inboundMedia.mediaUrl : null,
    mediaMime: inboundMedia ? inboundMedia.mediaMime : null,
    mediaSize: inboundMedia ? inboundMedia.mediaSize : null,
    languageDetected: effLanguage,
    dialectDetected: effDialect,
    metadata: messageMetadata,
  });

  // 7. Ответ AI — это сообщение, что уходит клиенту в Telegram (следом за расшифровкой в чате владельца).
  const aiMsg = await insertMessage({
    roomId: room.id,
    sender: 'ai',
    source: 'chat',
    kind: 'text',
    content: clientReply,
    metadata: { model: aiResponse.modelUsed },
  });

  // 7. Detect tags — асинхронно, не блокирует ответ QF
  let detectedTags: QuestFlowInboundResult['detectedTags'] = [];
  let newlyAssignedTagCount = 0;
  try {
    const matches = await detectNeedTags(tenantId, `CLIENT: ${clientContent || effectiveText}\nAI: ${clientReply}`);
    if (matches.length > 0) {
      newlyAssignedTagCount = await applyDetectedTags(room.id, clientMsg.id, matches);
      detectedTags = matches.map((m) => ({
        tagId: m.tagId,
        tagName: m.tagName,
        confidence: m.confidence,
      }));
    }
  } catch (err) {
    console.warn('[quest_flow/inbound] tag detection failed (continuing):', (err as Error).message);
  }

  void aiMsg; // мы возвращаем text напрямую, объект сохранён в БД

  // 8. ENTERPRISE v0.10.5: уведомления владельцу в Telegram (best-effort, async).
  // Не блокируют ответ QF — летят параллельно. Условия:
  //   (a) новая комната → «Новый клиент через Quest Flow» с ссылкой на чат
  //   (b) новые теги были присвоены → «Выявлена потребность» с тегом, клиентом и ссылкой
  const clientLabel =
    client.username ? `@${client.username}` :
    client.displayName ? client.displayName :
    `TG #${client.userId}`;
  const chatUrl = `${APP_BASE_URL}/room/${room.id}/chat`;
  // Превью для уведомления: подпись клиента, иначе пометка о типе вложения.
  const previewText = clientContent || effectiveText || (inboundMedia ? mediaPlaceholder(inboundMedia.kind) : '');

  if (isFreshRoom) {
    const msg =
      `🆕 <b>Новый клиент через Quest Flow</b>\n\n` +
      `👤 ${escapeHtml(clientLabel)}\n` +
      (effLanguage ? `🌐 Язык: <code>${effLanguage}</code>${effDialect ? ` (${escapeHtml(effDialect)})` : ''}\n` : '') +
      `💬 ${escapeHtml(previewText.slice(0, 140))}${previewText.length > 140 ? '…' : ''}\n\n` +
      `<a href="${chatUrl}">Открыть чат →</a>`;
    sendOwnerNotification(tenantId, msg).catch(() => {});
  }

  if (newlyAssignedTagCount > 0 && detectedTags) {
    const tagLines = detectedTags
      .map((t) => `• <b>${escapeHtml(t.tagName)}</b> (${Math.round(t.confidence * 100)}%)`)
      .join('\n');
    const msg =
      `🏷 <b>Выявлены потребности клиента</b>\n\n` +
      `👤 ${escapeHtml(clientLabel)}\n\n` +
      `${tagLines}\n\n` +
      `<a href="${chatUrl}">Открыть чат с клиентом →</a>`;
    sendOwnerNotification(tenantId, msg).catch(() => {});
  }

  return {
    ok: true,
    roomId: room.id,
    response: { text: clientReply },
    language: effLanguage,
    dialect: effDialect,
    transcription: videoSpeech || transcription,
    detectedTags,
    balanceRemaining,
  };
}

// ============================================================================
// ПРЕОБРАЗОВАНИЕ ИЗОБРАЖЕНИЙ ПО ПРЕСЕТУ (жёстко, по кнопке Quest Flow).
//   Фаза 1 — только изображения (Nano Banana). Видео не реализуем.
// ============================================================================

/** Собирает картинки клиента (base64) из JSON-поля images[] или из сохранённого вложения. */
function collectClientImages(
  images: Array<{ data: string; mime?: string }> | undefined,
  inboundMedia: SavedInboundMedia | null
): GenInputImage[] {
  const out: GenInputImage[] = [];
  if (Array.isArray(images)) {
    for (const im of images) {
      if (im && typeof im.data === 'string' && im.data.trim()) {
        const cleaned = im.data.includes(',') ? im.data.slice(im.data.indexOf(',') + 1) : im.data;
        out.push({ base64: cleaned, mime: im.mime || 'image/jpeg' });
      }
    }
  }
  if (out.length === 0 && inboundMedia && inboundMedia.kind === 'image') {
    let b64 = inboundMedia.base64;
    if (!b64 && inboundMedia.filePath) {
      try { b64 = fs.readFileSync(inboundMedia.filePath).toString('base64'); } catch { /* best-effort */ }
    }
    if (b64) out.push({ base64: b64, mime: inboundMedia.mediaMime });
  }
  return out;
}

interface MaybeImagePresetParams {
  tenantId: string;
  roomId: string;
  presetKey: string;
  clientImages: GenInputImage[];
  clientRequest: string;
  inboundMedia: SavedInboundMedia | null;
  messageMetadata: Record<string, any>;
}

/**
 * Если preset_key соответствует включённому пресету — генерит/правит картинку и возвращает
 * результат для Quest Flow. Возвращает null, если пресет не найден (caller продолжит обычный
 * AI-диалог). Сама генерация fail-soft: при ошибке клиенту уходит текст, а не 500.
 */
async function maybeRunImagePreset(p: MaybeImagePresetParams): Promise<QuestFlowInboundResult | null> {
  const cfg = await getTenantImageConfig(p.tenantId);
  const key = normalizePresetKey(p.presetKey);
  const preset = cfg.presets.find((x) => x.presetKey === key && x.enabled) || null;
  if (!preset) {
    console.warn(`[quest_flow/inbound] preset_key="${p.presetKey}" не найден/выключен — обычный AI-диалог`);
    return null;
  }

  const apiKey = await getEffectiveGeminiKey(p.tenantId);
  if (!apiKey) {
    // Quest Flow — Enterprise-only: глобальный ключ суперадмина не используется.
    throw new Error('Gemini API ключ не задан. На тарифе Enterprise укажите собственный ключ в Настройках (раздел «Gemini API»).');
  }

  // 1. Реплика клиента (фото/текст) → чат комнаты (владелец видит, что прислал клиент).
  await insertMessage({
    roomId: p.roomId,
    sender: 'client',
    source: p.inboundMedia ? 'media' : 'chat',
    kind: p.inboundMedia ? p.inboundMedia.kind : 'text',
    content: p.clientRequest || null,
    mediaUrl: p.inboundMedia ? p.inboundMedia.mediaUrl : null,
    mediaMime: p.inboundMedia ? p.inboundMedia.mediaMime : null,
    mediaSize: p.inboundMedia ? p.inboundMedia.mediaSize : null,
    metadata: { ...p.messageMetadata, preset_key: preset.presetKey },
  });

  // 2. Генерация. Fail-soft: при ошибке — пометка владельцу + дружелюбный текст клиенту.
  try {
    const { image } = await runImagePresetTransform({
      apiKey,
      model: cfg.model,
      preset,
      roomId: p.roomId,
      clientImages: p.clientImages,
      clientRequest: p.clientRequest,
    });

    // 3. Результат → сообщение AI (история + видно владельцу + уходит клиенту по URL).
    await insertMessage({
      roomId: p.roomId,
      sender: 'ai',
      source: 'media',
      kind: 'image',
      content: preset.replyCaption || null,
      mediaUrl: image.mediaUrl,
      mediaMime: image.mediaMime,
      mediaSize: image.mediaSize,
      metadata: { generated_by: 'ai', preset_key: preset.presetKey, function: preset.function, model: cfg.model },
    });

    return {
      ok: true,
      roomId: p.roomId,
      response: {
        text: preset.replyCaption || '',
        imageUrl: toAbsoluteMediaUrl(image.mediaUrl),
        imageMime: image.mediaMime,
      },
      language: null,
      dialect: null,
      detectedTags: [],
      balanceRemaining: -1,
    };
  } catch (err) {
    console.error('[quest_flow/inbound] генерация изображения не удалась:', (err as Error).message);
    await insertMessage({
      roomId: p.roomId,
      sender: 'system',
      source: 'system',
      kind: 'text',
      content: `⚠️ Не удалось сгенерировать изображение по пресету «${preset.label}»: ${(err as Error).message}`,
      metadata: { preset_key: preset.presetKey },
    });
    return {
      ok: true,
      roomId: p.roomId,
      response: { text: IMAGE_GEN_FAILED_REPLY, imageUrl: null, imageMime: null },
      language: null,
      dialect: null,
      detectedTags: [],
      balanceRemaining: -1,
    };
  }
}

// ============================================================================
// VARIANT A — приём видео/документов от клиента через multipart/form-data.
//   Эндпоинт: POST /api/quest-flow/inbound-media (см. router.ts)
// Quest Flow скачивает файл из Telegram и заливает его сюда multipart-полем "file".
// Файл уже записан на диск (uploads/enterprise-chat) через multer.diskStorage —
// здесь мы лишь строим SavedInboundMedia и прогоняем общий хвост (запись реплики →
// AI-ответ → теги → уведомления). Владелец видит файл в веб-аппе «Чат комнаты».
// ============================================================================

export interface QuestFlowInboundMediaInput {
  telegram_bot_id: string;
  telegram_user_id: string;
  telegram_username?: string;
  telegram_display_name?: string;
  /** Подпись к файлу (caption из Telegram), если была. */
  text?: string;
  metadata?: Record<string, any>;
  /**
   * Явный тип медиа от Quest Flow: 'video' | 'document' | 'image' | 'audio' | 'file'.
   * ПРИОРИТЕТНЕЕ MIME файла: Telegram при пересылке часто отдаёт generic
   * application/octet-stream, и без этой подсказки видео свелось бы к 'file' и НЕ
   * распозналось бы. 'document' трактуем как внутренний 'file'.
   */
  kind?: string;
  /** Жёсткая привязка функции преобразования изображения — ключ пресета (см. /inbound). */
  preset_key?: string;
  /** Файл, уже сохранённый multer.diskStorage. */
  file: {
    /** basename файла на диске (внутри uploads/enterprise-chat). */
    filename: string;
    /** Абсолютный путь на диске (для чтения base64 при vision-распознавании фото). */
    path: string;
    mimetype: string;
    size: number;
    originalname: string;
  };
}

/** Максимальный размер фото для inline-vision (совпадает с лимитом запроса в responder.ts). */
const VISION_INLINE_MAX_BYTES = 18_000_000;

export async function processQuestFlowInboundMedia(
  tenantId: string,
  input: QuestFlowInboundMediaInput
): Promise<QuestFlowInboundResult> {
  // 1. Validate
  if (!input.telegram_bot_id || !input.telegram_user_id) {
    throw new QuestFlowBadRequestError('Обязательные поля: telegram_bot_id, telegram_user_id');
  }
  if (!/^-?\d+$/.test(String(input.telegram_user_id).trim())) {
    throw new QuestFlowBadRequestError(
      `telegram_user_id должен быть числом (реальный Telegram chat_id). Получено: "${String(input.telegram_user_id).slice(0, 32)}"`
    );
  }
  if (!/^-?\d+$/.test(String(input.telegram_bot_id).trim())) {
    throw new QuestFlowBadRequestError(
      `telegram_bot_id должен быть числом (реальный Telegram bot ID). Получено: "${String(input.telegram_bot_id).slice(0, 32)}"`
    );
  }
  if (!input.file || !input.file.filename) {
    throw new QuestFlowBadRequestError('Файл не передан (multipart-поле "file")');
  }

  // 2. Enterprise gating (как в /inbound)
  try {
    await requireEnterprise(tenantId, undefined as UserRole | undefined, 'quest-flow');
  } catch (err) {
    if (err instanceof EnterpriseFeatureRequiredError) {
      throw new EnterpriseFeatureRequiredError('quest-flow');
    }
    throw err;
  }

  // 3. Find-or-create room
  const roomCreatedAtMs = Date.now();
  const room = await findOrCreateTelegramChatRoom(tenantId, {
    telegramBotId: input.telegram_bot_id,
    telegramUserId: input.telegram_user_id,
    telegramUsername: input.telegram_username || null,
    telegramDisplayName: input.telegram_display_name || null,
  });
  const isFreshRoom = Math.abs(roomCreatedAtMs - new Date(room.created_at).getTime()) < 5000;

  // 4. Строим SavedInboundMedia из уже записанного на диск файла.
  const rawMime = input.file.mimetype || 'application/octet-stream';
  // Явный kind от Quest Flow приоритетнее MIME (Telegram-пересылка часто = octet-stream).
  // 'document' → внутренний 'file'.
  const hintKind: SavedInboundMedia['kind'] | undefined =
    input.kind === 'document' ? 'file'
    : input.kind === 'video' ? 'video'
    : input.kind === 'image' ? 'image'
    : input.kind === 'audio' ? 'audio'
    : input.kind === 'file' ? 'file'
    : undefined;
  const kind: SavedInboundMedia['kind'] = hintKind || mediaKindForMime(rawMime);
  // Для видео/фото с generic MIME подставляем корректный MIME — иначе Gemini не распознает.
  let mime = rawMime;
  if (kind === 'video' && !mime.startsWith('video/')) {
    mime = mimeForExt(input.file.originalname || input.file.filename) || 'video/mp4';
  } else if (kind === 'image' && !mime.startsWith('image/')) {
    mime = mimeForExt(input.file.originalname || input.file.filename) || 'image/jpeg';
  }
  // Для изображения подгружаем base64 → vision (как в base64-пути /inbound).
  // Видео/файлы в память НЕ читаем: модель «видит» только факт вложения, а владелец
  // смотрит сам файл в веб-аппе.
  let base64 = '';
  if (kind === 'image' && input.file.size > 0 && input.file.size <= VISION_INLINE_MAX_BYTES) {
    try {
      base64 = fs.readFileSync(input.file.path).toString('base64');
    } catch (err) {
      console.warn('[quest_flow/inbound-media] read image for vision failed (continuing):', (err as Error).message);
    }
  }
  const inboundMedia: SavedInboundMedia = {
    mediaUrl: `/uploads/enterprise-chat/${input.file.filename}`,
    mediaMime: mime,
    mediaSize: input.file.size,
    kind,
    base64,
    filePath: input.file.path,
  };

  const effectiveText = (input.text || '').trim();

  // Жёсткое преобразование изображения по кнопке Quest Flow (preset_key).
  if (input.preset_key) {
    const transformed = await maybeRunImagePreset({
      tenantId,
      roomId: room.id,
      presetKey: input.preset_key,
      clientImages: collectClientImages(undefined, inboundMedia),
      clientRequest: effectiveText,
      inboundMedia,
      messageMetadata: {
        telegram_bot_id: input.telegram_bot_id,
        telegram_user_id: input.telegram_user_id,
        original_name: input.file.originalname,
        ...(input.metadata || {}),
      },
    });
    if (transformed) return transformed;
  }

  // 5–10. Общий хвост — тот же, что у JSON-эндпоинта /inbound.
  return finalizeInboundDialogue({
    tenantId,
    room,
    isFreshRoom,
    effectiveText,
    inboundMedia,
    hasAudio: false,
    language: null,
    dialect: null,
    dialectInstruction: null,
    transcription: undefined,
    balanceRemaining: -1,
    client: {
      username: input.telegram_username,
      displayName: input.telegram_display_name,
      userId: input.telegram_user_id,
    },
    messageMetadata: {
      telegram_bot_id: input.telegram_bot_id,
      telegram_user_id: input.telegram_user_id,
      // Имя файла → подпись в UI «Чат комнаты» (MessageBubble читает metadata.original_name).
      original_name: input.file.originalname,
      ...(input.metadata || {}),
    },
  });
}
