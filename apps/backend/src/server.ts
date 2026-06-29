import dotenv from 'dotenv';
// Загрузка переменных окружения должна происходить в самом верху точки входа
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pool from './db/index.js';
import { FEATURES } from './config/features.js';
import billingWebhookRouter from './modules/billing/webhook.js';
import billingAdminRouter from './modules/billing/router.js';
import promoRouter from './modules/billing/promo.js';
import { startRolloverScheduler } from './modules/billing/rollover.js';
import { runStartupMigrations } from './db/migrations.js';
import livekitRouter from './modules/livekit/router.js';
import translationRouter from './modules/translation/router.js';
import demoRouter from './modules/demo/router.js';
import sipRouter from './modules/sip/router.js';
import assistantRouter from './modules/assistant/router.js';
import authRouter from './modules/auth/router.js';
import roomsRouter from './modules/rooms/router.js';
import dialectsRouter from './modules/dialects/router.js';
import coachRouter from './modules/coach/router.js';
import notificationsRouter from './modules/notifications/router.js';
import { startDailySummaryScheduler } from './modules/notifications/daily_summary.js';
import adminUsersRouter from './modules/admin/users.js';
import tenantPromptRouter from './modules/tenant_prompt/router.js';
import insightsRouter from './modules/insights/router.js';
import tenantSettingsRouter from './modules/tenant_settings/router.js';
import needTagsRouter from './modules/need_tags/router.js';
import questFlowRouter from './modules/quest_flow/router.js';
import chatwootRouter from './modules/channels/chatwoot_router.js';
import chatwootBridgeRouter from './modules/channels/chatwoot_bridge_router.js';
import crmTasksRouter from './modules/crm_tasks/router.js';
import { startCrmTaskScheduler } from './modules/crm_tasks/service.js';
import instagramRouter from './modules/channels/instagram/ig_webhook.js';
import tiktokRouter from './modules/channels/tiktok/tt_webhook.js';
import whatsappRouter from './modules/channels/whatsapp/wa_webhook.js';
import messengerRouter from './modules/channels/messenger/msg_webhook.js';
import flowsRouter from './modules/flows/router.js';
import trendsRouter from './modules/trends/router.js';
import channelsRouter from './modules/channels/router.js';
import channelsCoverRouter from './modules/channels/cover_proxy.js';
import { startChannelSnapshotScheduler } from './modules/channels/scheduler.js';
import socialExtProxyRouter, { mediaRouter as socialExtMediaRouter, aiRouter as socialExtAiRouter, galleryRouter as socialExtGalleryRouter, musicRouter as socialExtMusicRouter, videoRouter as socialExtVideoRouter, manifestRouter as socialExtManifestRouter } from './modules/social-ext/router.js';
import renderRouter from './modules/render/router.js';
import { startRenderWorker, setRenderExecutor } from './modules/render/worker.js';
import { HttpWorkerExecutor } from './modules/render/executor_http.js';
import { SimulationExecutor } from './modules/render/executor.js';
import { DirectorExecutor } from './modules/render/executor_director.js';
import { getRenderWorkerUrl } from './config/systemConfig.js';
import enterpriseChatRouter from './modules/enterprise_chat/router.js';
import mcpRouter from './modules/mcp/router.js';
import { partnersPublicRouter, partnersAdminRouter } from './modules/partners/router.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Глобальные страховочные обработчики — чтобы одна забытая ошибка
// (например, RtcError от LiveKit при закрытии трека) не валила весь сервер.
process.on('unhandledRejection', (reason: any) => {
  console.error('[Process] unhandledRejection:', reason?.message || reason);
});
process.on('uncaughtException', (err: Error) => {
  console.error('[Process] uncaughtException:', err?.message || err);
});

// Инициализация Express-приложения
const app = express();
// За nginx/reverse-proxy: доверяем X-Forwarded-For от ПЕРВОГО прокси, чтобы
// express-rate-limit (Блок 3) видел реальный IP клиента, а не адрес nginx —
// иначе все клиенты делят один лимит. Значение 1 (не true) безопасно.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// 1. Подключение базовых middleware безопасности
// helmet настраивает заголовки HTTP для защиты от распространенных уязвимостей
app.use(helmet());
// CORS (Блок 4 / M4): в проде — только origins из CORS_ORIGINS (через запятую);
// в dev — всё (фронт :3000 → backend :3001). Auth у нас Bearer-токеном (не cookie),
// credentials не нужны. Если CORS_ORIGINS в проде не задан — не блокируем
// (one-domain nginx и так same-origin), но предупреждаем.
const corsAllowed = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && corsAllowed.length === 0) {
  console.warn('[CORS] CORS_ORIGINS не задан — кросс-origin запросы не ограничены. ' +
    'Для split-деплоя (api на отдельном домене) задайте CORS_ORIGINS=https://ваш-домен.');
}
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);                              // curl / same-origin / S2S
    if (process.env.NODE_ENV !== 'production') return callback(null, true); // dev — всё
    if (corsAllowed.length === 0) return callback(null, true);             // не настроено — не ломаем
    if (corsAllowed.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} запрещён`));
  },
}));

/**
 * 2. РЕШЕНИЕ ПРОБЛЕМЫ STRIPE (Критически важно):
 * Порядок подключения middleware имеет фундаментальное значение.
 * СНАЧАЛА мы монтируем роутер биллинга строго с сырым парсером тела запроса (express.raw),
 * так как для проверки подписи вебхуков Stripe требуется оригинальный, неизмененный Buffer тела запроса.
 * И ТОЛЬКО ПОСЛЕ ЭТОГО мы подключаем глобальный парсер express.json() для всех остальных роутов.
 */
app.use(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingWebhookRouter
);

// 2.1 Публичное демо аудио-песочницы (лендинг). Свой JSON-парсер с увеличенным
// лимитом — записанный аудио-клип приходит base64 и не влезает в дефолт ~100КБ.
if (FEATURES.publicDemo) app.use('/api/demo', express.json({ limit: '12mb' }), demoRouter);

// 2.2 Quest Flow inbound принимает base64-медиа (фото/видео/голос) от клиента —
// нужен увеличенный лимит тела ДО глобального express.json() (дефолт ~100 КБ
// иначе режет любое медиа и даже длинные голосовые).
app.use('/api/quest-flow', express.json({ limit: '30mb' }), questFlowRouter);

// 2.2.1 OMNICHANNEL Фаза 1: вебхук Chatwoot Agent Bot (входящие из каналов → ИИ →
// ответ). Свой 30mb json-лимит ДО глобального (медиа из каналов придут base64).
// Авторизация — секрет в пути /webhook/<секрет> внутри роутера.
app.use('/api/chatwoot', express.json({ limit: '30mb' }), chatwootRouter);

// 2.2.2 OMNICHANNEL IG-0: вебхук Instagram (ПРЯМОЙ Graph API, не через Chatwoot).
// verify захватывает raw body для проверки подписи X-Hub-Signature-256 (HMAC app secret).
app.use('/api/instagram', express.json({ limit: '30mb', verify: (req, _res, buf) => { (req as any).rawBody = buf; } }), instagramRouter);

// 2.2.3 OMNICHANNEL TikTok: вебхук TikTok Business Messaging API (прямой, не Chatwoot).
app.use('/api/tiktok', express.json({ limit: '30mb', verify: (req, _res, buf) => { (req as any).rawBody = buf; } }), tiktokRouter);

// 2.2.4 OMNICHANNEL WhatsApp: вебхук WhatsApp Cloud API (прямой, не Chatwoot).
app.use('/api/whatsapp', express.json({ limit: '30mb', verify: (req, _res, buf) => { (req as any).rawBody = buf; } }), whatsappRouter);

// 2.2.5 OMNICHANNEL Messenger: вебхук Messenger Platform API (прямой, не Chatwoot).
app.use('/api/messenger', express.json({ limit: '30mb', verify: (req, _res, buf) => { (req as any).rawBody = buf; } }), messengerRouter);

// 2.3 MCP — tools/call может нести base64-картинку (generate_image), поэтому свой
// увеличенный json-лимит ДО глобального express.json(). Авторизация — внутри роутера
// (Bearer MCP-ключ для протокола, JWT+Enterprise для управления ключами).
app.use('/api/mcp', express.json({ limit: '30mb' }), mcpRouter);

// 2.4 AI-прокси «Social Media Extension» — «Анализ видеоконтента» отправляет видео
// inline base64 в Gemini, поэтому свой большой json-лимит ДО глобального (иначе 413).
app.use('/api/social-ext/ai-proxy', express.json({ limit: '64mb' }), socialExtAiRouter);

// 3. Подключение глобального парсера JSON-данных для остальных эндпоинтов
app.use(express.json());

// 3.1 Админский биллинг (sync-products, products) — после json парсера
app.use('/api/billing', billingAdminRouter);

// 4. Подключение остальных роутеров приложения.
//    Фич-флаги (config/features.ts): целые функции вкл/выкл здесь. Гейтим МОНТАЖ —
//    безопасно, т.к. соседние модули импортируют СЕРВИСЫ, а не роутеры.
if (FEATURES.video) {
  app.use('/api/livekit', livekitRouter);
  app.use('/api/translation', translationRouter);
}
if (FEATURES.sip) app.use('/api/sip', sipRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
if (FEATURES.learnHub) app.use('/api/admin/dialects', dialectsRouter);
app.use('/api/admin/promocodes', promoRouter);
app.use('/api/admin/notifications', notificationsRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/tenant-prompt', tenantPromptRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/tenant-settings', tenantSettingsRouter);
app.use('/api/need-tags', needTagsRouter);
// OMNICHANNEL Фаза 2: конструктор цепочек (JWT + Enterprise внутри роутера)
app.use('/api/flows', flowsRouter);
// TRENDTRAFFIC: анализатор трендов (TikHub) — JWT внутри роутера
app.use('/api/trends', trendsRouter);
// TRENDTRAFFIC: «Каналы» — прокси обложек/аватаров (публичный, белый список CDN) —
// ДО auth-роутера /api/channels, чтобы <img src> грузился без JWT.
app.use('/api/channels/cover', channelsCoverRouter);
// TRENDTRAFFIC: «Каналы» — анализ всех видео канала по ссылке (JWT внутри роутера)
app.use('/api/channels', express.json({ limit: '1mb' }), channelsRouter);
// TRENDTRAFFIC: прозрачный прокси для вкладки «Social Media Extension» (рехостинг
// TikHub-расширения) — JWT + Enterprise-гейт + rate-limit внутри роутера, ключ на сервере
app.use('/api/social-ext/proxy', socialExtProxyRouter);
// Медиа-прокси расширения (скачивание видео/обложек с CDN с нужным Referer) — те же гейты
app.use('/api/social-ext/media', socialExtMediaRouter);
// AI-прокси расширения смонтирован ВЫШЕ (до глобального json, с лимитом 64mb —
// «Анализ видеоконтента» шлёт видео inline base64, иначе 413 Payload Too Large).
// «Добавить в галерею» из расширения — разбор ссылки + скачивание + media_assets
app.use('/api/social-ext/to-gallery', socialExtGalleryRouter);
// Музыкальная дорожка (раздел Music): перейти по play_url / скачать аудио в Галерею
app.use('/api/social-ext/music', socialExtMusicRouter);
// Скачать видео БЕЗ водяного знака (кнопка «Download video»): App V3 play_addr → стрим
app.use('/api/social-ext/download', socialExtVideoRouter);
// Манифест медиа Instagram (кнопки «Скачать» в IG-аналитике): прямые ссылки макс. качества
app.use('/api/social-ext/ig-manifest', socialExtManifestRouter);
// TRENDTRAFFIC: рендер «Собрать» (очередь сборки роликов) — JWT внутри роутера
app.use('/api/render', renderRouter);
// /api/quest-flow смонтирован выше (с увеличенным json-лимитом для base64-медиа)
app.use('/api/enterprise-chat', enterpriseChatRouter);
app.use('/api/chatwoot-bridge', express.json(), chatwootBridgeRouter);
app.use('/api/crm-tasks', express.json(), crmTasksRouter);
if (FEATURES.partners) {
  app.use('/api/partners', partnersPublicRouter);
  app.use('/api/admin/partners', partnersAdminRouter);
}

// ENTERPRISE v0.10.0: статическая раздача медиа из enterprise_chat upload
const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const uploadsRoot = path.resolve(__dirname_local, '../../uploads');
app.use('/uploads', express.static(uploadsRoot, { maxAge: '7d', etag: true }));
if (FEATURES.video) app.use('/api/coach', coachRouter);

// Публичный список включённых фич — фронт сверяется с этим (его build-time зеркало
// должно совпадать). Полезно для диагностики «почему функция недоступна».
app.get('/api/features', (_req, res) => res.json(FEATURES));

/**
 * 5. Простой health-check эндпоинт GET /api/health
 * Проверяет работоспособность сервера Express и активность соединения с базой данных PostgreSQL.
 */
app.get('/api/health', async (req, res) => {
  try {
    // Выполняем легкий тестовый запрос для проверки пула подключений к БД
    await pool.query('SELECT 1');
    
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Health Check] Ошибка при проверке здоровья бэкенда:', err);
    
    return res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString()
    });
  }
});

// 6. Запуск прослушивания входящих запросов
const server = app.listen(PORT, () => {
  console.log(`[Backend] Сервер успешно запущен и слушает порт ${PORT}`);
  // 6.0 Миграции БД (идемпотентные ALTER TABLE)
  runStartupMigrations()
    .catch((err) => {
      console.warn('[Backend] Миграции прошли с предупреждениями:', err?.message || err);
    })
    .finally(() => {
      // 6.0.1 Рендер «Собрать»: базовый исполнитель — реальный OpenMontage-воркер
      // (если задан RENDER_WORKER_URL — рендер-VPS по Tailscale), иначе симуляция.
      // Поверх — ИИ-режиссёр (умные ЛЛМ-шаги: сценарий/ресёрч/новости/выбор момента).
      const renderWorkerUrl = getRenderWorkerUrl();
      const renderBase = renderWorkerUrl ? new HttpWorkerExecutor() : new SimulationExecutor();
      setRenderExecutor(new DirectorExecutor(renderBase));
      console.log('[render] исполнитель:', renderBase.constructor.name, '+ ИИ-режиссёр',
        renderWorkerUrl ? `→ ${renderWorkerUrl}` : '(симуляция)');
      // поллер очереди (после миграций — таблица render_jobs создана)
      startRenderWorker();
    });
  // 6.1 Биллинг: планировщик rollover минут
  startRolloverScheduler();
  // 6.2 Notifications: ежедневная сводка в Telegram (09:00 Europe/Warsaw)
  startDailySummaryScheduler();
  // 6.3 CRM-задачи: планировщик авто-сообщений/напоминаний (БД-таймер, раз в минуту)
  startCrmTaskScheduler();
  // 6.4 «Каналы»: авто-обновление отслеживаемых каналов (тик/час, снимок раз в сутки)
  startChannelSnapshotScheduler();
});

export { app, server };
