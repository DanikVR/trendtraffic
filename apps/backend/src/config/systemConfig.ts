/**
 * Централизованный менеджер системной конфигурации VibeVox.
 *
 * - Читает/пишет в `apps/backend/system-config.json`
 * - Если файл конфигурации отсутствует или поле не задано — возвращает значение из process.env (fallback)
 * - При сохранении: если секретный ключ пришёл как "***", сервер сохраняет его текущее значение
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================================
// Пути
// ============================================================================================

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const CONFIG_FILE = path.resolve(__dirname_local, '..', '..', 'system-config.json');

// ============================================================================================
// Интерфейс конфигурации
// ============================================================================================

export interface SystemConfig {
  livekitUrl?: string;
  livekitKey?: string;
  livekitSecret?: string;
  geminiApiKey?: string;
  geminiLiveModel?: string; // имя модели Gemini Live (см. AVAILABLE_LIVE_MODELS на фронте)
  telegramToken?: string;
  chatwootUrl?: string;
  chatwootToken?: string;
  /**
   * Chatwoot Platform App access token (СУПЕР-АДМИН уровень, не agent-токен).
   * Один на всю платформу VibeVox — даёт право создавать accounts/users и выдавать
   * SSO-ссылки (Platform API). Базовый URL берётся из chatwootUrl (тот же инстанс).
   * Заводится в Chatwoot: Super Admin → Platform Apps. СЕКРЕТ.
   */
  chatwootPlatformToken?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  stripeSecretKey?: string;       // sk_test_... или sk_live_...
  stripeWebhookSecret?: string;   // whsec_...
  stripePublishableKey?: string;  // pk_test_... или pk_live_... (для фронтенда)
  /**
   * TikHub.io API key (ПЛАТФОРМЕННЫЙ, pay-as-you-go) — скан трендов + скачивание
   * видео. Один на весь аккаунт платформы; Enterprise-тенанты могут задать свой
   * (tenant_settings/tikhub.ts). Bearer-токен. СЕКРЕТ.
   */
  tikhubApiKey?: string;
  /** Список chat_id Telegram (приватные / группы / каналы), куда слать уведомления админу.
   *  Хранится массивом строк; в форме админки редактируется кнопкой «Синхронизировать получателей». */
  telegramAdminChatIds?: string[];
  /** Имя голоса Gemini для женского варианта (Aoede / Kore / Leda / Zephyr). */
  voiceFemale?: string;
  /** Имя голоса Gemini для мужского варианта (Charon / Puck / Fenrir / Orus). */
  voiceMale?: string;
  /**
   * Произвольный HTML/JS-код суперадмина, внедряемый в <head> на ВСЕХ страницах
   * сайта: cookie-consent (cookie-script.com / Cookiebot), Google Analytics (gtag),
   * метатеги верификации, базовый код Meta Pixel и т.п.
   * НЕ секрет (попадает в публичный HTML). Менять может только суперадмин.
   */
  customHeadCode?: string;
  /** Произвольный HTML/JS-код, внедряемый в КОНЕЦ <body> (виджеты чата, отложенные скрипты). */
  customBodyCode?: string;

  // ── Масштабирование видеоперевода (Gemini Live) ──────────────────────────
  /**
   * Admission control: максимум одновременных активных слотов перевода
   * (≈ участников видео-перевода ≈ Gemini Live сессий) во всём процессе.
   * При достижении — новый вход в комнату получает 503 service_overloaded.
   * Дефолт 50 (см. DEFAULT_MAX_CONCURRENT_SESSIONS). Суперадмин крутит в /admin/config.
   */
  maxConcurrentTranslationSessions?: number;
  /**
   * Дополнительные Gemini API ключи для round-robin ротации (freemium/глобальный трафик).
   * ВАЖНО: лимит concurrent sessions у Gemini — per PROJECT, поэтому ключи должны быть
   * из РАЗНЫХ GCP-проектов, иначе ротация не повышает потолок. Хранятся как есть (секрет).
   */
  geminiApiKeys?: string[];
  /** Использовать Vertex AI вместо Gemini Developer API (1000 concurrent + 4M TPM на проект). */
  geminiUseVertex?: boolean;
  /** GCP project id для Vertex AI режима (если geminiUseVertex=true). */
  vertexProject?: string;
  /** Регион Vertex AI (например us-central1). Дефолт us-central1. */
  vertexLocation?: string;

  /**
   * Куда маршрутизировать GPU-шаги рендера (апскейл/аватар/ген):
   *  'home'  — домашний воркер RTX 5080 по Tailscale (бесплатно, дефолт);
   *  'cloud' — облачный GPU-фолбэк (Modal/RunPod) по ключу;
   *  'off'   — GPU-шаги пропускаются (только бесплатная CPU-цепочка на VPS).
   * Переключатель в Админ-панели (см. рендер «Собрать»).
   */
  renderGpuTarget?: 'home' | 'cloud' | 'off';

  /** URL CPU-воркера OpenMontage (рендер-VPS по Tailscale, напр. http://100.81.35.75:8800). */
  renderWorkerUrl?: string;
  /** URL GPU-воркера (домашний RTX 5080 по Tailscale). */
  renderGpuWorkerUrl?: string;
}

/** Дефолтная модель Gemini Live (используется, если в админке ничего не выбрано). */
export const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

/** Дефолтный лимит одновременных слотов перевода (admission control). */
export const DEFAULT_MAX_CONCURRENT_SESSIONS = 50;

/** Маска для секретных полей, возвращаемая клиенту */
const SECRET_MASK = '********************************';

/** Список полей, содержащих секретные значения */
const SECRET_FIELDS: (keyof SystemConfig)[] = [
  'livekitSecret',
  'geminiApiKey',
  'telegramToken',
  'chatwootToken',
  'chatwootPlatformToken',
  'googleClientSecret',
  'stripeSecretKey',
  'stripeWebhookSecret',
  'tikhubApiKey',
];

// ============================================================================================
// Чтение / Запись конфигурационного файла
// ============================================================================================

/**
 * Загружает конфигурацию из JSON-файла.
 * При ошибке или отсутствии файла — возвращает пустой объект.
 */
function loadConfigFile(): SystemConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw) as SystemConfig;
    }
  } catch (err) {
    console.warn('[SystemConfig] Не удалось загрузить system-config.json:', err);
  }
  return {};
}

/**
 * Атомарная запись конфигурации в JSON-файл.
 * Сначала записывает во временный файл, затем переименовывает — защита от повреждения данных.
 */
function writeConfigFile(config: SystemConfig): void {
  try {
    const tmpPath = CONFIG_FILE + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmpPath, CONFIG_FILE);
    console.log('[SystemConfig] Конфигурация сохранена в', CONFIG_FILE);
  } catch (err) {
    console.error('[SystemConfig] Ошибка сохранения конфигурации:', err);
    throw err;
  }
}

// ============================================================================================
// Динамические геттеры (config → process.env fallback)
// ============================================================================================

function get(field: keyof SystemConfig, envVar: string, defaultValue = ''): string {
  const config = loadConfigFile();
  const val = config[field];
  if (typeof val === 'string' && val) return val;
  return process.env[envVar] || defaultValue;
}

/** LiveKit WebRTC Server URL */
export function getLiveKitUrl(): string {
  return get('livekitUrl', 'LIVEKIT_URL', 'ws://localhost:7880');
}

/** LiveKit API Key */
export function getLiveKitKey(): string {
  return get('livekitKey', 'LIVEKIT_API_KEY');
}

/** LiveKit API Secret */
export function getLiveKitSecret(): string {
  return get('livekitSecret', 'LIVEKIT_API_SECRET');
}

/** Google Gemini API Key */
export function getGeminiApiKey(): string {
  return get('geminiApiKey', 'GEMINI_API_KEY');
}

/** Имя выбранной модели Gemini Live. Дефолт: gemini-3.1-flash-live-preview. */
export function getGeminiLiveModel(): string {
  return get('geminiLiveModel', 'GEMINI_LIVE_MODEL', DEFAULT_GEMINI_LIVE_MODEL);
}

/** Имя голоса Gemini Live: 'female' | 'male'. Возвращает дефолт, если не настроено. */
export function getVoiceName(gender: 'female' | 'male'): string {
  const key: keyof SystemConfig = gender === 'female' ? 'voiceFemale' : 'voiceMale';
  const fallback = gender === 'female' ? 'Aoede' : 'Charon';
  return get(key, gender === 'female' ? 'GEMINI_VOICE_FEMALE' : 'GEMINI_VOICE_MALE', fallback);
}

/**
 * Лимит одновременных слотов перевода (admission control). Источник:
 * system-config.json → env MAX_CONCURRENT_TRANSLATION_SESSIONS → дефолт 50.
 * Невалидные/нулевые значения игнорируются (возвращаем дефолт), отрицательные → дефолт.
 */
export function getMaxConcurrentSessions(): number {
  const config = loadConfigFile();
  const raw = config.maxConcurrentTranslationSessions;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
  const env = Number(process.env.MAX_CONCURRENT_TRANSLATION_SESSIONS);
  if (Number.isFinite(env) && env >= 1) return Math.floor(env);
  return DEFAULT_MAX_CONCURRENT_SESSIONS;
}

/**
 * Пул Gemini API ключей для round-robin (глобальный/freemium трафик).
 * Возвращает [основной ключ, ...дополнительные] — уникальные, непустые.
 * ВАЖНО: для реального повышения потолка concurrent sessions ключи должны быть
 * из РАЗНЫХ GCP-проектов (лимит per project, не per key).
 */
export function getGeminiApiKeyPool(): string[] {
  const config = loadConfigFile();
  const pool: string[] = [];
  const primary = getGeminiApiKey();
  if (primary) pool.push(primary);
  if (Array.isArray(config.geminiApiKeys)) {
    for (const k of config.geminiApiKeys) {
      if (typeof k === 'string' && k.trim()) pool.push(k.trim());
    }
  }
  // env-фолбэк: GEMINI_API_KEYS=key1,key2 (через запятую)
  const envKeys = (process.env.GEMINI_API_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
  pool.push(...envKeys);
  return Array.from(new Set(pool));
}

/** Использовать ли Vertex AI вместо Gemini Developer API. */
export function getGeminiUseVertex(): boolean {
  const config = loadConfigFile();
  if (typeof config.geminiUseVertex === 'boolean') return config.geminiUseVertex;
  return /^(1|true|yes|on)$/i.test(process.env.GEMINI_USE_VERTEX || '');
}

/** GCP project id для Vertex AI режима. */
export function getVertexProject(): string {
  return get('vertexProject', 'GOOGLE_CLOUD_PROJECT');
}

/** Регион Vertex AI. Дефолт us-central1. */
export function getVertexLocation(): string {
  return get('vertexLocation', 'GOOGLE_CLOUD_LOCATION', 'us-central1');
}

/** Stripe Secret Key (sk_test_... или sk_live_...) */
export function getStripeSecretKey(): string {
  return get('stripeSecretKey', 'STRIPE_SECRET_KEY');
}

/** Stripe Webhook Signing Secret (whsec_...) */
export function getStripeWebhookSecret(): string {
  return get('stripeWebhookSecret', 'STRIPE_WEBHOOK_SECRET');
}

/** Stripe Publishable Key (pk_...) — отдаётся клиенту для Stripe.js */
export function getStripePublishableKey(): string {
  return get('stripePublishableKey', 'STRIPE_PUBLISHABLE_KEY');
}

/** TikHub.io API key (платформенный). Источник: system-config.json → env TIKHUB_API_KEY. */
export function getTikHubApiKey(): string {
  return get('tikhubApiKey', 'TIKHUB_API_KEY');
}

/**
 * Цель маршрутизации GPU-шагов рендера: 'home' | 'cloud' | 'off'.
 * Источник: system-config.json → env RENDER_GPU_TARGET → дефолт 'home'.
 * Невалидные значения нормализуются к 'home'.
 */
export function getRenderGpuTarget(): 'home' | 'cloud' | 'off' {
  const v = get('renderGpuTarget', 'RENDER_GPU_TARGET', 'home');
  return v === 'cloud' || v === 'off' ? v : 'home';
}

/**
 * URL CPU-воркера OpenMontage (рендер-VPS по Tailscale, напр. http://100.81.35.75:8800).
 * Пусто → рендер идёт в режиме симуляции (executor не подключён). Источник:
 * system-config.json → env RENDER_WORKER_URL.
 */
export function getRenderWorkerUrl(): string {
  return String(get('renderWorkerUrl', 'RENDER_WORKER_URL', '') || '').trim().replace(/\/+$/, '');
}

/** URL GPU-воркера (домашний RTX 5080 по Tailscale). Пусто → GPU-шаги пропускаются. */
export function getRenderGpuWorkerUrl(): string {
  return String(get('renderGpuWorkerUrl', 'RENDER_GPU_WORKER_URL', '') || '').trim().replace(/\/+$/, '');
}

/** Telegram Bot API Token */
export function getTelegramToken(): string {
  return get('telegramToken', 'TELEGRAM_BOT_TOKEN');
}

/** Список chat_id для админских уведомлений (приватные/группы/каналы). */
export function getTelegramAdminChatIds(): string[] {
  const config = loadConfigFile();
  const arr = config.telegramAdminChatIds;
  if (Array.isArray(arr)) return arr.filter(x => typeof x === 'string' && x.trim().length > 0);
  // Fallback: переменная окружения с запятыми
  const envVal = process.env.TELEGRAM_ADMIN_CHAT_IDS || '';
  return envVal.split(',').map(s => s.trim()).filter(Boolean);
}

/** Сохранить список admin chat_id. */
export function saveTelegramAdminChatIds(chatIds: string[]): void {
  const current = loadConfigFile();
  const unique = Array.from(new Set(chatIds.map(x => String(x).trim()).filter(Boolean)));
  current.telegramAdminChatIds = unique;
  writeConfigFile(current);
}

/** Chatwoot CRM API URL */
export function getChatwootUrl(): string {
  return get('chatwootUrl', 'CHATWOOT_API_URL');
}

/** Chatwoot Agent Access Token */
export function getChatwootToken(): string {
  return get('chatwootToken', 'CHATWOOT_API_TOKEN');
}

/**
 * Chatwoot Platform App access token (супер-админ). Пусто → бесшовный мост/SSO
 * выключен (фронт откатывается на внутренний чат). Базовый URL = getChatwootUrl().
 */
export function getChatwootPlatformToken(): string {
  return get('chatwootPlatformToken', 'CHATWOOT_PLATFORM_TOKEN');
}

/** Базовый origin Chatwoot для Platform API / SSO / deep-link (тот же инстанс, что и API URL). */
export function getChatwootPlatformBaseUrl(): string {
  return getChatwootUrl().replace(/\/+$/, '');
}

/** Google OAuth Client ID */
export function getGoogleClientId(): string {
  const config = loadConfigFile();
  if (config.googleClientId) return config.googleClientId;

  try {
    const oauthPath = path.resolve(CONFIG_FILE, '..', 'google-oauth.json');
    if (fs.existsSync(oauthPath)) {
      const data = JSON.parse(fs.readFileSync(oauthPath, 'utf-8'));
      if (data.clientId) return data.clientId;
    }
  } catch {}

  return process.env.GOOGLE_CLIENT_ID || '';
}

/** Google OAuth Client Secret */
export function getGoogleClientSecret(): string {
  const config = loadConfigFile();
  if (config.googleClientSecret) return config.googleClientSecret;

  try {
    const oauthPath = path.resolve(CONFIG_FILE, '..', 'google-oauth.json');
    if (fs.existsSync(oauthPath)) {
      const data = JSON.parse(fs.readFileSync(oauthPath, 'utf-8'));
      if (data.clientSecret) return data.clientSecret;
    }
  } catch {}

  return process.env.GOOGLE_CLIENT_SECRET || '';
}

// ============================================================================================
// Произвольные коды суперадмина (аналитика / cookie-consent / пиксели)
// ============================================================================================

/** Код для <head> (аналитика, cookie-consent, верификация). Пустая строка если не задан. */
export function getCustomHeadCode(): string {
  const config = loadConfigFile();
  return typeof config.customHeadCode === 'string' ? config.customHeadCode : '';
}

/** Код для конца <body> (виджеты, отложенные скрипты). Пустая строка если не задан. */
export function getCustomBodyCode(): string {
  const config = loadConfigFile();
  return typeof config.customBodyCode === 'string' ? config.customBodyCode : '';
}

/** Пара кодов для публичного инжектора на фронтенде (GET /api/auth/site-scripts). */
export function getSiteScripts(): { headCode: string; bodyCode: string } {
  return { headCode: getCustomHeadCode(), bodyCode: getCustomBodyCode() };
}

/**
 * Сохранить произвольные коды (head/body). Пустая строка = очистить поле.
 * Отдельно от saveSettings: запись закрыта ролью суперадмина в роутере, т.к.
 * это вектор stored-XSS на весь сайт (а GET /system-settings/POST — публичны).
 */
export function saveSiteScripts(headCode: string, bodyCode: string): void {
  const current = loadConfigFile();
  current.customHeadCode = typeof headCode === 'string' ? headCode : '';
  current.customBodyCode = typeof bodyCode === 'string' ? bodyCode : '';
  writeConfigFile(current);
}

// ============================================================================================
// Публичные методы: получение / сохранение / маскирование
// ============================================================================================

/**
 * Возвращает текущую конфигурацию для отображения на фронтенде.
 * Секретные поля маскируются символами "***", если они заданы.
 * Возвращаются также булевы флаги (hasXxxKey: true/false).
 */
export function getSettingsForClient(): Record<string, any> {
  return {
    livekitUrl: getLiveKitUrl(),
    livekitKey: getLiveKitKey(),
    livekitSecret: getLiveKitSecret() ? SECRET_MASK : '',
    hasLivekitSecret: !!getLiveKitSecret(),

    geminiApiKey: getGeminiApiKey() ? SECRET_MASK : '',
    hasGeminiKey: !!getGeminiApiKey(),
    geminiLiveModel: getGeminiLiveModel(),
    voiceFemale: getVoiceName('female'),
    voiceMale: getVoiceName('male'),

    // Масштабирование видеоперевода
    maxConcurrentTranslationSessions: getMaxConcurrentSessions(),
    // Доп. ключи — не отдаём сами значения (секрет), только количество.
    geminiApiKeysCount: Math.max(0, getGeminiApiKeyPool().length - (getGeminiApiKey() ? 1 : 0)),
    geminiUseVertex: getGeminiUseVertex(),
    vertexProject: getVertexProject(),
    vertexLocation: getVertexLocation(),

    telegramToken: getTelegramToken() ? SECRET_MASK : '',
    hasTelegramToken: !!getTelegramToken(),
    telegramAdminChatIds: getTelegramAdminChatIds(),
    telegramAdminChatIdsCount: getTelegramAdminChatIds().length,

    chatwootUrl: getChatwootUrl(),
    chatwootToken: getChatwootToken() ? SECRET_MASK : '',
    hasChatwootToken: !!getChatwootToken(),
    chatwootPlatformToken: getChatwootPlatformToken() ? SECRET_MASK : '',
    hasChatwootPlatformToken: !!getChatwootPlatformToken(),

    googleClientId: getGoogleClientId(),
    googleClientSecret: getGoogleClientSecret() ? SECRET_MASK : '',
    hasGoogleClientSecret: !!getGoogleClientSecret(),

    stripeSecretKey: getStripeSecretKey() ? SECRET_MASK : '',
    hasStripeSecretKey: !!getStripeSecretKey(),
    stripeWebhookSecret: getStripeWebhookSecret() ? SECRET_MASK : '',
    hasStripeWebhookSecret: !!getStripeWebhookSecret(),
    stripePublishableKey: getStripePublishableKey(), // не секрет — публичный ключ Stripe

    tikhubApiKey: getTikHubApiKey() ? SECRET_MASK : '',
    hasTikhubKey: !!getTikHubApiKey(),
  };
}

/**
 * Сохраняет настройки, полученные от админа.
 * Если секретное поле содержит "***" — сохраняет текущее значение (не перезаписывает).
 */
export function saveSettings(incoming: Partial<SystemConfig>): void {
  const current = loadConfigFile();

  const merged: SystemConfig = { ...current };

  // Обрабатываем каждое поле: если "***" — сохраняем текущее значение.
  // ВАЖНО: telegramAdminChatIds (массив) обрабатывается отдельным эндпоинтом
  // /api/admin/notifications, поэтому здесь не упоминается.
  // Исключаем массив telegramAdminChatIds (свой эндпоинт) и нестроковые поля масштабирования
  // (обрабатываются вручную ниже) — иначе merged[key] = string ломает типы.
  type StringKey = Exclude<
    keyof SystemConfig,
    'telegramAdminChatIds' | 'maxConcurrentTranslationSessions' | 'geminiApiKeys' | 'geminiUseVertex' | 'renderGpuTarget'
  >;
  const fieldMap: Array<{ key: StringKey; envFallback: string }> = [
    { key: 'livekitUrl', envFallback: 'LIVEKIT_URL' },
    { key: 'livekitKey', envFallback: 'LIVEKIT_API_KEY' },
    { key: 'livekitSecret', envFallback: 'LIVEKIT_API_SECRET' },
    { key: 'geminiApiKey', envFallback: 'GEMINI_API_KEY' },
    { key: 'geminiLiveModel', envFallback: 'GEMINI_LIVE_MODEL' },
    { key: 'telegramToken', envFallback: 'TELEGRAM_BOT_TOKEN' },
    { key: 'chatwootUrl', envFallback: 'CHATWOOT_API_URL' },
    { key: 'chatwootToken', envFallback: 'CHATWOOT_API_TOKEN' },
    { key: 'chatwootPlatformToken', envFallback: 'CHATWOOT_PLATFORM_TOKEN' },
    { key: 'googleClientId', envFallback: 'GOOGLE_CLIENT_ID' },
    { key: 'googleClientSecret', envFallback: 'GOOGLE_CLIENT_SECRET' },
    { key: 'stripeSecretKey', envFallback: 'STRIPE_SECRET_KEY' },
    { key: 'stripeWebhookSecret', envFallback: 'STRIPE_WEBHOOK_SECRET' },
    { key: 'stripePublishableKey', envFallback: 'STRIPE_PUBLISHABLE_KEY' },
    { key: 'tikhubApiKey', envFallback: 'TIKHUB_API_KEY' },
    { key: 'voiceFemale', envFallback: 'GEMINI_VOICE_FEMALE' },
    { key: 'voiceMale', envFallback: 'GEMINI_VOICE_MALE' },
  ];

  for (const { key, envFallback } of fieldMap) {
    const value = incoming[key];
    if (value === undefined || value === null) {
      // Поле не передано — не трогаем
      continue;
    }
    if (typeof value !== 'string') continue; // не строка → пропускаем (защита от случайных типов с фронта)
    if ((value === SECRET_MASK || value === '***') && (SECRET_FIELDS as string[]).includes(key)) {
      // Секретное поле не менялось — сохраняем текущее
      const cur = current[key];
      merged[key] = (typeof cur === 'string' && cur) ? cur : (process.env[envFallback] || '');
    } else {
      merged[key] = value;
    }
  }

  // ── Нестроковые поля масштабирования (обрабатываем вручную, т.к. fieldMap — только string) ──
  // Лимит admission control: число ≥1, иначе игнорируем (оставляем прежнее).
  if (incoming.maxConcurrentTranslationSessions !== undefined) {
    const n = Number(incoming.maxConcurrentTranslationSessions);
    if (Number.isFinite(n) && n >= 1) merged.maxConcurrentTranslationSessions = Math.floor(n);
  }
  // Доп. Gemini ключи: массив строк. Пустой/из одних масок → НЕ трогаем (как секрет).
  if (Array.isArray(incoming.geminiApiKeys)) {
    const cleaned = incoming.geminiApiKeys
      .filter((k): k is string => typeof k === 'string')
      .map((k) => k.trim())
      .filter((k) => k && k !== SECRET_MASK && k !== '***');
    // Заменяем пул только если пришли реальные значения. Пустой массив = очистить.
    const allMasksOrEmpty = incoming.geminiApiKeys.every(
      (k) => typeof k !== 'string' || !k.trim() || k === SECRET_MASK || k === '***'
    );
    if (incoming.geminiApiKeys.length === 0) {
      merged.geminiApiKeys = [];
    } else if (!allMasksOrEmpty) {
      merged.geminiApiKeys = Array.from(new Set(cleaned));
    }
  }
  // Vertex
  if (typeof incoming.geminiUseVertex === 'boolean') merged.geminiUseVertex = incoming.geminiUseVertex;
  if (typeof incoming.vertexProject === 'string') merged.vertexProject = incoming.vertexProject.trim();
  if (typeof incoming.vertexLocation === 'string') merged.vertexLocation = incoming.vertexLocation.trim();
  // Переключатель GPU рендера: только из фиксированного набора, иначе игнор (оставляем прежнее).
  if (typeof incoming.renderGpuTarget === 'string' && ['home', 'cloud', 'off'].includes(incoming.renderGpuTarget)) {
    merged.renderGpuTarget = incoming.renderGpuTarget as 'home' | 'cloud' | 'off';
  }

  writeConfigFile(merged);

  // Синхронизируем с google-oauth.json
  if (merged.googleClientId || merged.googleClientSecret) {
    try {
      const oauthPath = path.resolve(CONFIG_FILE, '..', 'google-oauth.json');
      const oauthData = {
        clientId: merged.googleClientId || '',
        clientSecret: merged.googleClientSecret || '',
      };
      fs.writeFileSync(oauthPath, JSON.stringify(oauthData, null, 2), 'utf-8');
    } catch {}
  }
}
