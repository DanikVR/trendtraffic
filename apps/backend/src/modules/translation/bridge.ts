/**
 * TranslationBridge — ядро двунаправленного аудиомоста между LiveKit WebRTC и Gemini Live API.
 *
 * Архитектура:
 * 1. Бот-участник подключается к LiveKit-комнате через @livekit/rtc-node
 * 2. При подключении каждого участника считываются его metadata (nativeLanguage, voiceGender)
 * 3. Для каждого говорящего создаётся отдельная Gemini Live Session с StreamTranslationConfig
 * 4. Аудио-фреймы PCM (16kHz, 16-bit, mono) пересылаются в Gemini в реальном времени
 * 5. Переведённый аудиоответ от Gemini публикуется обратно в LiveKit через AudioSource
 */

import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  AudioStream,
  AudioSource,
  AudioFrame,
  LocalAudioTrack,
  TrackPublishOptions,
  TrackSource,
  TrackKind,
  dispose,
} from '@livekit/rtc-node';
import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai';
import {
  VOICE_MAP,
  AUDIO_SAMPLE_RATE,
  AUDIO_CHANNELS,
  AUDIO_MIME_TYPE,
  TRANSLATOR_BOT_IDENTITY,
  isSupportedLanguage,
  buildTranslationInstruction,
} from './config.js';
import { getGeminiLiveModel, getVoiceName } from '../../config/systemConfig.js';
import pool from '../../db/index.js';
import { getTenantBalance, consumeSeconds, isUnlimitedTier } from '../billing/usage.js';
// ENTERPRISE v0.10.17: переводчик БОЛЬШЕ НЕ использует custom_prompt / knowledge_base.
// Эти поля (Раздел 2 «Подсказки») предназначены ТОЛЬКО для расшифровки сообщений в чате
// видео-комнаты (tone-explain с тоном «Согласно вашего промта»). См. enterprise_chat/tone_response.ts.
import { getEffectiveGeminiClientConfig, setTenantGeminiKeyStatus } from '../tenant_settings/gemini.js';
import { sendOwnerNotification } from '../tenant_settings/owner_telegram.js';
import { release as releaseAdmissionSlot } from './admission.js';
import { geminiPoolSize } from '../../config/gemini_key_pool.js';

// ============================================================================================
// Интерфейс метаданных участника (заложен на Шаге 4 в LiveKit токене)
// ============================================================================================

/** Структура метаданных, упакованных в поле metadata LiveKit-токена */
interface ParticipantMetadata {
  nativeLanguage: string;  // BCP-47 код языка участника (например: "ru", "en")
  voiceGender: 'male' | 'female'; // Предпочитаемый пол голоса переводчика
}

// ============================================================================================
// Контекст Gemini-сессии для одного участника
// ============================================================================================

/** Хранит все ресурсы, связанные с активной Gemini-сессией участника */
interface ParticipantSession {
  /** Уникальный идентификатор спикера в LiveKit (чью речь переводит эта сессия) */
  participantIdentity: string;
  /** Identity получателя перевода (язык которого == targetLanguage) */
  recipientIdentity?: string;
  /** Активная сессия Gemini Live API */
  geminiSession: Session;
  /** Источник аудио для публикации переведённого потока обратно в комнату */
  audioSource: AudioSource;
  /** Опубликованный аудио-трек бота для этого участника */
  audioTrack: LocalAudioTrack;
  /** Поток аудио от участника (для перехвата PCM-фреймов) */
  audioStream: AudioStream | null;
  /** Целевой язык перевода (для логирования и data-channel сообщений) */
  nativeLanguage: string;
  /** Исходный язык спикера */
  speakerLanguage?: string;
  /** Текущий пол голоса переводчика */
  currentGender?: 'male' | 'female';
  /** Накапливаемый текст текущей реплики (chunks от Gemini до turnComplete) */
  pendingText?: string;
}

// ============================================================================================
// Класс TranslationBridge — основной движок синхронного перевода
// ============================================================================================

/**
 * Создаёт двунаправленный аудиомост между участниками LiveKit-комнаты
 * и Gemini Live API для синхронного перевода в реальном времени.
 *
 * Один экземпляр TranslationBridge обслуживает одну LiveKit-комнату.
 * Для каждого участника создаётся отдельная Gemini Live Session
 * с индивидуальным targetLanguageCode.
 */
export class TranslationBridge {
  /** Комната LiveKit, к которой подключён бот */
  private room: Room;
  /** Карта активных Gemini-сессий: participantIdentity → ParticipantSession */
  private sessions: Map<string, ParticipantSession> = new Map();
  /** Экземпляр Google GenAI SDK (создаётся в connect() после async-загрузки ключа) */
  private ai!: GoogleGenAI;
  /** Имя комнаты */
  private roomName: string;
  /** Флаг активности моста */
  private isConnected: boolean = false;
  /** ID арендатора, владельца комнаты — для биллинга минут (null = не списываем) */
  private billingTenantId: string | null = null;
  /** Метка времени последнего списания минут */
  private lastBillingTickAt: number = 0;
  /** Был ли уже отправлен low_balance warning (чтобы не спамить) */
  private lowBalanceWarned: boolean = false;
  /** Публиковать ли субтитры в data channel (управляется creator'ом через PATCH /rooms/:id/settings) */
  private subtitlesEnabled: boolean = true;

  constructor(roomName: string, billingTenantId?: string) {
    this.roomName = roomName;
    this.billingTenantId = billingTenantId || null;
    this.room = new Room();
    // ai инициализируется в connect() через initGeminiClient() — нужен async для per-tenant ключа
  }

  /**
   * Инициализирует Google GenAI SDK с per-tenant ключом (если есть), иначе с глобальным.
   * Используется в connect() и при необходимости пересоздать клиент (например, после смены ключа).
   * Если per-tenant ключ невалидный — best-effort уведомляет владельца в Telegram.
   */
  private async initGeminiClient(): Promise<void> {
    // п.4+п.5: провайдер выбирается в gemini.ts — свой ключ тенанта (Developer API),
    // либо для глобального трафика Vertex AI (если включён), либо round-robin ключ из пула.
    const cfg = await getEffectiveGeminiClientConfig(this.billingTenantId);
    if (!cfg) {
      throw new Error('Критическая ошибка: Gemini не сконфигурирован (нет per-tenant ключа, пул пуст и Vertex выключен). Задайте ключ в /admin/config или у тенанта.');
    }
    if (cfg.mode === 'vertex') {
      // Vertex AI: авторизация через ADC / service account (GOOGLE_APPLICATION_CREDENTIALS).
      this.ai = new GoogleGenAI({ vertexai: true, project: cfg.project, location: cfg.location });
      console.log(`[TranslationBridge] Gemini-клиент: Vertex AI (project=${cfg.project}, location=${cfg.location})`);
    } else {
      this.ai = new GoogleGenAI({ apiKey: cfg.apiKey });
      const poolN = geminiPoolSize();
      if (!this.billingTenantId && poolN > 1) {
        console.log(`[TranslationBridge] Gemini-клиент: Developer API (round-robin из пула ${poolN} ключей)`);
      }
    }
  }

  // ============================================================================================
  // Публичные методы
  // ============================================================================================

  /**
   * Подключает бота-переводчика к LiveKit-комнате и начинает прослушивание событий.
   * @param livekitUrl — URL LiveKit-сервера (например: ws://localhost:7880)
   * @param token — JWT-токен для подключения бота к комнате
   */
  async connect(livekitUrl: string, token: string): Promise<void> {
    console.log(`[TranslationBridge] Подключение к комнате "${this.roomName}"...`);

    // ENTERPRISE v0.10.0: загружаем Gemini ключ ленивее, с учётом per-tenant override.
    await this.initGeminiClient();

    // Загружаем настройки комнаты (subtitlesEnabled) — НЕ блокирует подключение если БД недоступна.
    try {
      const r = await pool.query('SELECT settings FROM rooms WHERE id = $1 LIMIT 1', [this.roomName]);
      const raw = (r.rows as any[])[0]?.settings;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
      this.subtitlesEnabled = parsed.subtitlesEnabled !== false;
      console.log(`[Bridge.settings] init: subtitlesEnabled=${this.subtitlesEnabled}`);
    } catch (e) {
      console.warn('[Bridge.settings] init failed (default subtitlesEnabled=true):', (e as Error).message);
    }

    this.room
      .on(RoomEvent.TrackSubscribed, this.onTrackSubscribed.bind(this))
      .on(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected.bind(this))
      .on(RoomEvent.Disconnected, this.onRoomDisconnected.bind(this));

    // Подключение к комнате
    await this.room.connect(livekitUrl, token, {
      autoSubscribe: true,
      dynacast: true,
    });

    this.isConnected = true;
    console.log(`[TranslationBridge] Бот "${TRANSLATOR_BOT_IDENTITY}" подключён к комнате "${this.roomName}"`);

    // Обработка участников, которые уже находились в комнате до подключения бота
    for (const participant of this.room.remoteParticipants.values()) {
      await this.processExistingParticipant(participant);
    }
  }

  /**
   * Корректно отключает бота от комнаты и завершает все Gemini-сессии.
   */
  async disconnect(): Promise<void> {
    console.log(`[TranslationBridge] Отключение от комнаты "${this.roomName}"...`);

    // Закрытие всех Gemini-сессий
    for (const [identity, session] of this.sessions) {
      try {
        session.geminiSession.close();
        console.log(`[TranslationBridge] Gemini-сессия для "${identity}" закрыта`);
      } catch (err) {
        console.error(`[TranslationBridge] Ошибка закрытия Gemini-сессии для "${identity}":`, err);
      }
    }
    this.sessions.clear();

    // Отключение от комнаты LiveKit
    await this.room.disconnect();
    this.isConnected = false;

    console.log(`[TranslationBridge] Мост для комнаты "${this.roomName}" полностью остановлен`);
  }

  /** Возвращает true, если мост активен */
  get active(): boolean {
    return this.isConnected;
  }

  /** Возвращает количество активных Gemini-сессий */
  get sessionCount(): number {
    return this.sessions.size;
  }

  // ============================================================================================
  // Обработчики событий LiveKit
  // ============================================================================================

  /**
   * Обработчик подписки на трек участника.
   * Вызывается когда бот получает доступ к аудио-треку удалённого участника.
   */
  private async onTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ): Promise<void> {
    // Обрабатываем только аудио-треки
    if (track.kind !== TrackKind.KIND_AUDIO) return;

    const identity = participant.identity;
    console.log(`[TranslationBridge] Подписка на аудио-трек участника "${identity}"`);

    // Если для этого участника уже есть сессия — пропускаем
    if (this.sessions.has(identity)) {
      console.log(`[TranslationBridge] Сессия для "${identity}" уже существует, пропускаем`);
      return;
    }

    // Парсинг metadata участника
    const metadata = this.parseParticipantMetadata(participant.metadata);
    if (!metadata) {
      console.warn(`[TranslationBridge] Невозможно считать metadata участника "${identity}", пропускаем`);
      return;
    }

    // Определяем целевой язык + кому отправлять перевод
    const { language: targetLanguage, recipientIdentity } = this.determineTarget(identity, metadata.nativeLanguage);

    try {
      // Создание Gemini Live Session для этого участника
      const participantSession = await this.createParticipantSession(
        identity,
        targetLanguage,
        metadata.voiceGender,
        recipientIdentity,
        metadata.nativeLanguage
      );

      // Запуск пайплайна перехвата аудио → Gemini
      const audioStream = new AudioStream(track, AUDIO_SAMPLE_RATE, AUDIO_CHANNELS);
      participantSession.audioStream = audioStream;

      // Асинхронный запуск передачи аудио (не блокирующий)
      this.pipeAudioToGemini(audioStream, participantSession.geminiSession, identity)
        .catch(err => console.error(`[TranslationBridge] Ошибка пайплайна аудио для "${identity}":`, err));

      console.log(`[TranslationBridge] Пайплайн перевода запущен: "${identity}" (${metadata.nativeLanguage} → ${targetLanguage})`);
    } catch (err) {
      console.error(`[TranslationBridge] Ошибка создания сессии для "${identity}":`, err);
    }
  }

  /**
   * Обработчик отключения участника — закрывает его Gemini-сессию и освобождает ресурсы.
   */
  private async onParticipantDisconnected(participant: RemoteParticipant): Promise<void> {
    const identity = participant.identity;
    const session = this.sessions.get(identity);

    if (session) {
      console.log(`[TranslationBridge] Участник "${identity}" отключился, закрываем Gemini-сессию`);
      try {
        session.geminiSession.close();
      } catch (err) {
        console.error(`[TranslationBridge] Ошибка закрытия сессии для "${identity}":`, err);
      }
      this.sessions.delete(identity);
    }

    // Admission control: освобождаем слот участника (точное освобождение, не дожидаясь TTL).
    releaseAdmissionSlot(this.roomName, identity);
  }

  /**
   * Обработчик отключения от комнаты — аварийная очистка всех ресурсов.
   */
  private onRoomDisconnected(): void {
    console.warn('[TranslationBridge] Соединение с комнатой разорвано');
    this.isConnected = false;
    // Закрытие всех сессий
    for (const [identity, session] of this.sessions) {
      try {
        session.geminiSession.close();
      } catch { /* игнорируем ошибки при аварийном отключении */ }
    }
    this.sessions.clear();
  }

  // ============================================================================================
  // Создание Gemini Live Session
  // ============================================================================================

  /**
   * Создаёт Gemini Live Session с нативным StreamTranslationConfig для конкретного участника.
   * @param identity — идентификатор участника
   * @param targetLanguage — код целевого языка BCP-47
   * @param voiceGender — предпочитаемый пол голоса переводчика
   */
  private async createParticipantSession(
    identity: string,
    targetLanguage: string,
    voiceGender: 'male' | 'female',
    recipientIdentity?: string,
    speakerLanguage?: string
  ): Promise<ParticipantSession> {
    // Создание AudioSource для публикации переведённого аудио обратно в комнату
    const audioSource = new AudioSource(AUDIO_SAMPLE_RATE, AUDIO_CHANNELS);
    const audioTrack = LocalAudioTrack.createAudioTrack(`translation-${identity}`, audioSource);
    const publishOptions = new TrackPublishOptions();
    publishOptions.source = TrackSource.SOURCE_MICROPHONE;

    // Публикация трека бота в комнату
    await this.room.localParticipant!.publishTrack(audioTrack, publishOptions);

    // Загрузка скомпилированной инструкции диалекта (AI Learning Hub Pro v0.2.0)
    let dialectInstruction: string | null = null;
    try {
      const dialectRes = await pool.query(
        `SELECT compiled_instruction FROM dialect_rules
         WHERE language_code = $1 AND is_active = TRUE AND compiled_instruction != ''
         ORDER BY updated_at DESC LIMIT 1`,
        [targetLanguage]
      );
      if (dialectRes.rows.length > 0) {
        dialectInstruction = dialectRes.rows[0].compiled_instruction;
        console.log(`[TranslationBridge] Загружена инструкция диалекта для "${targetLanguage}"`);
      }
    } catch (err) {
      console.warn(`[TranslationBridge] Не удалось загрузить инструкцию диалекта для "${targetLanguage}":`, err);
    }

    // Создание Gemini Live Session с нативной потоковой трансляцией
    // v0.8.2: voice читается из systemConfig (admin может выбрать в Admin Config).
    // Дефолт = VOICE_MAP[voiceGender] из config.ts (Aoede / Charon).
    const voiceName = getVoiceName(voiceGender) || VOICE_MAP[voiceGender];

    // ENTERPRISE v0.10.17: переводчик использует только базовый промт + диалект-правила
    // из AI Learning Hub Pro (суперадминка). custom_prompt владельца БОЛЬШЕ НЕ подмешивается —
    // Раздел 2 «Подсказки» работает только в чате видео-комнаты (tone-explain).
    const translationInstruction = buildTranslationInstruction(targetLanguage, dialectInstruction, {
      customPrompt: '',
      knowledgeBase: '',
    });
    const modelName = getGeminiLiveModel();

    const geminiSession = await this.ai.live.connect({
      model: modelName,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [{ text: translationInstruction }],
        },
      },
      callbacks: {
        onopen: () => {
          console.log(`[Gemini:${modelName}] Сессия открыта для "${identity}" → перевод на "${targetLanguage}" голосом "${voiceName}"`);
        },
        onmessage: (msg: LiveServerMessage) => {
          this.handleGeminiMessage(msg, identity, audioSource);
        },
        onerror: (e: ErrorEvent) => {
          console.error(`[Gemini] Ошибка в сессии "${identity}":`, e);
        },
        onclose: (e: CloseEvent) => {
          console.log(`[Gemini] Сессия закрыта для "${identity}" code=${e?.code} reason="${e?.reason || ''}"`);
        },
      },
    });

    const participantSession: ParticipantSession = {
      participantIdentity: identity,
      recipientIdentity,
      geminiSession,
      audioSource,
      audioTrack,
      audioStream: null,
      nativeLanguage: targetLanguage,
      speakerLanguage,
      currentGender: voiceGender,
      pendingText: '',
    };

    this.sessions.set(identity, participantSession);
    return participantSession;
  }

  // ============================================================================================
  // Пайплайн: LiveKit AudioStream → Gemini Live API
  // ============================================================================================

  /**
   * Асинхронный пайплайн: перехватывает PCM-фреймы из LiveKit AudioStream,
   * выполняет эвристический анализ пола голоса спикера на лету
   * и отправляет PCM-данные в активную Gemini Live сессию.
   */
  private async pipeAudioToGemini(
    audioStream: AudioStream,
    geminiSession: Session,
    identity: string
  ): Promise<void> {
    console.log(`[Bridge→Gemini] Запуск передачи аудио от "${identity}" в Gemini`);

    // ── Оптимизация CPU (п.2/п.3): автокорреляция detectVoiceGender — самая дорогая
    // операция на горячем пути (~80K оп/фрейм). Раньше она вызывалась на КАЖДОМ фрейме
    // (50/сек на сессию → при 50 сессиях ~2500 автокорреляций/сек душили event-loop).
    // Теперь:
    //   • дешёвый VAD по энергии (hasVoiceEnergy) — на каждом фрейме (нужен для биллинга);
    //   • дорогой gender-детект — РЕДКО: пока пол не зафиксирован, раз в GENDER_STRIDE_UNLOCKED
    //     фреймов; после фиксации (genderLocked) — раз в GENDER_STRIDE_LOCKED (~1 сек), только
    //     чтобы поймать смену говорящего. Итог: в установившемся режиме ~1 автокорреляция/сек
    //     вместо 50 — снижение CPU в ~50 раз без потери качества детекции.
    const GENDER_STRIDE_UNLOCKED = 4;  // ~12 проверок/сек пока определяем пол
    const GENDER_STRIDE_LOCKED = 50;   // ~1 проверка/сек после фиксации (ловим смену спикера)
    const GENDER_DECISION_SAMPLES = 6; // сколько распознанных тонов набрать для решения

    const genderCount = { male: 0, female: 0 };
    let genderLocked = false;
    let framesSinceGenderCheck = 0;
    let activeSpeechFrames = 0; // фреймы с речью (по энергии); ~50/сек = 1 сек речи

    for await (const frame of audioStream) {
      const session = this.sessions.get(identity);
      if (!session) break;

      // ── Дешёвый VAD (энергия) — каждый фрейм. Нужен для биллинга активной речи. ──
      const voiced = hasVoiceEnergy(frame.data);
      if (voiced) activeSpeechFrames++;

      // ── Биллинг минут: раз в ~1 сек активной речи списываем у tenant'а ──
      if (activeSpeechFrames >= 50 && this.billingTenantId) {
        activeSpeechFrames = 0;
        this.consumeBillingSecond().catch((err) =>
          console.warn('[Bridge.billing] Ошибка списания:', err?.message || err)
        );
      }

      // ── Gender-детект (дорогой) — throttled. Только на фреймах с речью. ──
      framesSinceGenderCheck++;
      const stride = genderLocked ? GENDER_STRIDE_LOCKED : GENDER_STRIDE_UNLOCKED;
      if (voiced && framesSinceGenderCheck >= stride) {
        framesSinceGenderCheck = 0;
        const detected = detectVoiceGender(frame.data);
        if (detected) {
          genderCount[detected]++;
          const total = genderCount.male + genderCount.female;
          if (total >= GENDER_DECISION_SAMPLES) {
            const targetGender = genderCount.male > genderCount.female ? 'male' : 'female';
            if (targetGender !== session.currentGender) {
              console.log(`[GenderDetector] Смена пола говорящего "${identity}": ${session.currentGender} -> ${targetGender}`);
              session.currentGender = targetGender;
              this.recreateGeminiSession(identity, targetGender).catch(err => {
                console.error(`[GenderDetector] Ошибка смены голоса для "${identity}":`, err);
              });
            }
            genderLocked = true; // пол определён — дальше проверяем редко
            genderCount.male = 0;
            genderCount.female = 0;
          }
        }
      }

      // Всегда берем актуальную сессию из Map, так как она может пересоздаться на лету
      const activeSession = this.sessions.get(identity);
      if (!activeSession) break;

      const pcmBuffer = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
      const base64Audio = pcmBuffer.toString('base64');

      try {
        activeSession.geminiSession.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: AUDIO_MIME_TYPE,
          },
        });
      } catch (err) {
        console.error(`[Bridge→Gemini] Ошибка отправки аудио от "${identity}":`, err);
        break;
      }
    }

    console.log(`[Bridge→Gemini] Передача аудио от "${identity}" завершена`);
  }

  /**
   * Динамически пересоздает Gemini Live Session с новым голосом перевода на лету.
   */
  private async recreateGeminiSession(identity: string, voiceGender: 'male' | 'female'): Promise<void> {
    const session = this.sessions.get(identity);
    if (!session) return;

    // v0.8.2: voice читается из systemConfig (admin может выбрать в Admin Config).
    // Дефолт = VOICE_MAP[voiceGender] из config.ts (Aoede / Charon).
    const voiceName = getVoiceName(voiceGender) || VOICE_MAP[voiceGender];
    const targetLanguage = session.nativeLanguage;

    console.log(`[TranslationBridge] Пересоздаем сессию Gemini для "${identity}" (Голос: ${voiceName})...`);

    try {
      session.geminiSession.close();
    } catch (err) {
      console.warn('[TranslationBridge] Ошибка при закрытии старой сессии:', err);
    }

    // Загрузка инструкции диалекта (AI Learning Hub Pro v0.2.0)
    let dialectInstruction: string | null = null;
    try {
      const dialectRes = await pool.query(
        `SELECT compiled_instruction FROM dialect_rules
         WHERE language_code = $1 AND is_active = TRUE AND compiled_instruction != ''
         ORDER BY updated_at DESC LIMIT 1`,
        [targetLanguage]
      );
      if (dialectRes.rows.length > 0) {
        dialectInstruction = dialectRes.rows[0].compiled_instruction;
      }
    } catch (err) {
      console.warn(`[TranslationBridge] Не удалось загрузить инструкцию диалекта:`, err);
    }

    const translationInstruction = buildTranslationInstruction(targetLanguage, dialectInstruction);
    const modelName = getGeminiLiveModel();

    const geminiSession = await this.ai.live.connect({
      model: modelName,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [{ text: translationInstruction }],
        },
      },
      callbacks: {
        onopen: () => {
          console.log(`[Gemini:${modelName}] Динамическая сессия обновлена для "${identity}" (Голос: ${voiceName})`);
        },
        onmessage: (msg: LiveServerMessage) => {
          this.handleGeminiMessage(msg, identity, session.audioSource);
        },
        onerror: (e: ErrorEvent) => {
          console.error(`[Gemini] Ошибка в динамической сессии "${identity}":`, e);
        },
        onclose: () => {
          console.log(`[Gemini] Динамическая сессия закрыта для "${identity}"`);
        },
      },
    });

    session.geminiSession = geminiSession;
    console.log(`[TranslationBridge] Сессия Gemini успешно обновлена для "${identity}"`);
  }

  // ============================================================================================
  // Пайплайн: Gemini Live API → LiveKit AudioSource
  // ============================================================================================

  /**
   * Обработчик входящих сообщений от Gemini Live API.
   *
   * Источники данных в одной сессии:
   *  - serverContent.modelTurn.parts[].inlineData — переведённое аудио (PCM)
   *  - serverContent.outputTranscription.text — текст переведённой реплики (наши субтитры для получателя)
   *  - serverContent.inputTranscription.text — текст того, что услышал спикер (для логов/полигона, не публикуем сейчас)
   *  - serverContent.turnComplete — конец реплики
   */
  private handleGeminiMessage(
    msg: LiveServerMessage,
    identity: string,
    audioSource: AudioSource
  ): void {
    const session = this.sessions.get(identity);
    const content: any = msg.serverContent;

    // 1. Аудио-перевод → публикуем в LiveKit
    const modelTurn = content?.modelTurn;
    if (modelTurn?.parts) {
      for (const part of modelTurn.parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('audio/')) {
          this.publishTranslatedAudio(part.inlineData.data, audioSource, identity);
        }
      }
    }

    // 2. Текст перевода (что Gemini синтезирует получателю) → стримим как субтитр
    const outChunk: string | undefined = content?.outputTranscription?.text;
    if (outChunk && session) {
      session.pendingText = (session.pendingText || '') + outChunk;
      this.publishSubtitleData(session, outChunk, false);
    }

    // 3. turnComplete → финализируем накопленный текст
    if (content?.turnComplete && session && session.pendingText) {
      this.publishSubtitleData(session, '', true);
      console.log(`[Bridge→DataCh] Финал реплики "${identity}" → "${session.recipientIdentity || 'broadcast'}": ${session.pendingText.slice(0, 80)}...`);
      session.pendingText = '';
    }
  }

  /**
   * Биллинг минут: списывает одну секунду у tenant'а при активной речи.
   * При остатке < 5 мин — отправляет low_balance уведомление в комнату.
   * При балансе = 0 — паузит bridge.
   */
  private async consumeBillingSecond(): Promise<void> {
    if (!this.billingTenantId) return;

    // Throttle — не чаще раз в секунду
    const now = Date.now();
    if (now - this.lastBillingTickAt < 950) return;
    this.lastBillingTickAt = now;

    const balance = await getTenantBalance(this.billingTenantId);
    if (!balance) return;
    if (isUnlimitedTier(balance.tier)) return; // Enterprise не списываем

    const remaining = await consumeSeconds(this.billingTenantId, 1);

    // Низкий баланс — 5 минут (300 сек) или меньше — однократное уведомление
    if (remaining >= 0 && remaining <= 300 && !this.lowBalanceWarned) {
      this.lowBalanceWarned = true;
      this.publishBillingEvent({
        type: 'billing',
        kind: 'low_balance',
        remainingSeconds: remaining,
        remainingMinutes: Math.floor(remaining / 60),
      });
    }

    // Баланс исчерпан — broadcast quota_exhausted
    if (remaining === 0) {
      this.publishBillingEvent({
        type: 'billing',
        kind: 'quota_exhausted',
        remainingSeconds: 0,
        remainingMinutes: 0,
      });
    }
  }

  /** Шлёт событие биллинга в data channel — широковещательно всем участникам комнаты. */
  private publishBillingEvent(payload: object): void {
    try {
      const data = new TextEncoder().encode(JSON.stringify(payload));
      this.room.localParticipant?.publishData(data, {
        reliable: true,
        topic: 'billing',
      }).catch((err) => console.warn('[Bridge.billing] publishData error:', err?.message));
    } catch { /* ignore */ }
  }

  /**
   * Публикует кусок субтитра в data channel LiveKit-комнаты адресно получателю.
   * Тип сообщения: subtitle. На фронте RoomPage парсит и складывает в feed.
   */
  /** Внешнее обновление настроек комнаты — вызывается роутером при PATCH /rooms/:id/settings. */
  public setSubtitlesEnabled(enabled: boolean): void {
    this.subtitlesEnabled = enabled;
    console.log(`[Bridge.settings] subtitlesEnabled=${enabled}`);
  }

  private publishSubtitleData(session: ParticipantSession, deltaText: string, isFinal: boolean): void {
    if (!this.subtitlesEnabled) return;
    try {
      const payload = {
        type: 'subtitle',
        speakerIdentity: session.participantIdentity,
        speakerLanguage: session.speakerLanguage || '',
        targetLanguage: session.nativeLanguage,
        deltaText,
        fullText: session.pendingText || '',
        isFinal,
        timestamp: Date.now(),
      };
      const data = new TextEncoder().encode(JSON.stringify(payload));

      // Адресная доставка: только получателю перевода (если знаем), иначе всем
      const destination_identities = session.recipientIdentity ? [session.recipientIdentity] : undefined;
      this.room.localParticipant?.publishData(data, {
        reliable: true,
        destination_identities,
        topic: 'subtitle',
      }).catch((err) => {
        console.warn(`[Bridge→DataCh] publishData error для "${session.participantIdentity}":`, err);
      });
    } catch (err) {
      console.warn('[Bridge→DataCh] Сериализация субтитра не удалась:', err);
    }
  }

  /**
   * Публикует переведённый PCM-аудиофрагмент обратно в LiveKit-комнату.
   * captureFrame ASYNC — обязательно ловим ошибки, иначе unhandled promise rejection
   * валит весь процесс (RtcError InvalidState случается если трек закрыт/недоступен).
   */
  private publishTranslatedAudio(
    base64Audio: string,
    audioSource: AudioSource,
    identity: string
  ): void {
    let frame: AudioFrame;
    try {
      const buffer = Buffer.from(base64Audio, 'base64');
      const samples = new Int16Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength / 2
      );
      frame = new AudioFrame(samples, AUDIO_SAMPLE_RATE, AUDIO_CHANNELS, samples.length);
    } catch (err) {
      console.error(`[Gemini→Bridge] Ошибка подготовки фрейма для "${identity}":`, err);
      return;
    }

    // ВАЖНО: captureFrame возвращает Promise — обязательно .catch, иначе процесс падает
    audioSource.captureFrame(frame).catch((err: Error) => {
      // InvalidState — нормально при закрытии комнаты, не спамим в лог
      const msg = err?.message || String(err);
      if (!msg.includes('InvalidState')) {
        console.error(`[Gemini→Bridge] Ошибка captureFrame для "${identity}":`, msg);
      }
    });
  }

  // ============================================================================================
  // Вспомогательные методы
  // ============================================================================================

  /**
   * Парсит JSON-строку metadata участника из LiveKit-токена.
   * Метаданные были заложены на Шаге 4 в generateLiveKitToken().
   */
  private parseParticipantMetadata(metadataStr: string | undefined): ParticipantMetadata | null {
    if (!metadataStr) return null;

    try {
      const parsed = JSON.parse(metadataStr);

      if (!parsed.nativeLanguage) {
        console.warn('[TranslationBridge] metadata участника не содержит обязательного поля nativeLanguage');
        return null;
      }

      if (!isSupportedLanguage(parsed.nativeLanguage)) {
        console.warn(`[TranslationBridge] Язык "${parsed.nativeLanguage}" не поддерживается`);
        return null;
      }

      return {
        nativeLanguage: parsed.nativeLanguage,
        voiceGender: parsed.voiceGender || 'female',
      };
    } catch (err) {
      console.error('[TranslationBridge] Ошибка парсинга metadata участника:', err);
      return null;
    }
  }

  /**
   * Определяет целевой язык перевода + identity получателя.
   *
   * Логика: находим первого другого участника в комнате с отличающимся языком,
   * используем его язык как целевой и сохраняем его identity (для адресной доставки субтитров).
   * Если другие участники не найдены, используем дефолт.
   */
  private determineTarget(speakerIdentity: string, speakerLanguage: string): { language: string; recipientIdentity?: string } {
    for (const participant of this.room.remoteParticipants.values()) {
      if (participant.identity === speakerIdentity) continue;

      const metadata = this.parseParticipantMetadata(participant.metadata);
      if (metadata && metadata.nativeLanguage !== speakerLanguage) {
        return { language: metadata.nativeLanguage, recipientIdentity: participant.identity };
      }
    }

    // Дефолт: если не нашли собеседника с другим языком — переводим на английский (или русский)
    return { language: speakerLanguage === 'en' ? 'ru' : 'en' };
  }

  /**
   * Обрабатывает участников, которые уже были в комнате до подключения бота.
   */
  private async processExistingParticipant(participant: RemoteParticipant): Promise<void> {
    for (const publication of participant.trackPublications.values()) {
      if (publication.track && publication.track.kind === TrackKind.KIND_AUDIO) {
        await this.onTrackSubscribed(
          publication.track as RemoteTrack,
          publication as RemoteTrackPublication,
          participant
        );
      }
    }
  }
}

/**
 * Дешёвый VAD по энергии сигнала (без автокорреляции). Используется на КАЖДОМ фрейме
 * для биллинга активной речи — на порядок дешевле detectVoiceGender (нет цикла по лагам).
 * Порог и окно совпадают с detectVoiceGender, чтобы поведение «есть речь» было согласованным.
 */
function hasVoiceEnergy(samples: Int16Array): boolean {
  const len = Math.min(samples.length, 640); // те же 40 мс
  if (len < 320) return false;
  let energy = 0;
  for (let i = 0; i < len; i++) {
    const val = samples[i] / 32768.0;
    energy += val * val;
  }
  return energy >= 0.05;
}

/**
 * Эвристический детектор пола по частоте основного тона F0 с использованием метода автокорреляции.
 *
 * Параметры частот F0:
 * - Мужской голос: ~85-155 Гц
 * - Женский голос: ~160-255 Гц
 */
function detectVoiceGender(samples: Int16Array): 'male' | 'female' | null {
  const sampleRate = 16000;
  const len = Math.min(samples.length, 640); // Анализируем первые 40 мс для экономии ресурсов
  if (len < 320) return null;

  const minLag = 60;  // ~266 Гц
  const maxLag = 188; // ~85 Гц

  let bestLag = -1;
  let maxCorrelation = -Infinity;

  // Рассчитываем энергию сигнала для отсечения тишины
  let energy = 0;
  for (let i = 0; i < len; i++) {
    const val = samples[i] / 32768.0;
    energy += val * val;
  }

  // Если тишина — пропускаем анализ
  if (energy < 0.05) {
    return null;
  }

  // Считаем автокорреляцию
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    const limit = len - lag;
    
    for (let i = 0; i < limit; i++) {
      const s1 = samples[i] / 32768.0;
      const s2 = samples[i + lag] / 32768.0;
      correlation += s1 * s2;
    }

    if (correlation > maxCorrelation) {
      maxCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag === -1) return null;

  const f0 = sampleRate / bestLag;

  if (f0 >= 85 && f0 < 160) {
    return 'male';
  } else if (f0 >= 160 && f0 <= 255) {
    return 'female';
  }

  return null;
}

// ============================================================================================
// Экспорт для использования в router.ts
// ============================================================================================

export { ParticipantMetadata };
