/**
 * AppVersion — плашка версии в левом нижнем углу.
 *
 * ПРАВИЛО: После каждого визуального изменения — увеличивать APP_VERSION
 * с десятичным переносом разрядов (а НЕ semver):
 *
 *   1.0.0 → 1.0.1 → … → 1.0.9 → 1.1.0 → … → 1.9.9 → 2.0.0 → …
 *
 * Каждый разряд максимум 9 (не более 9 в одном столбике). При достижении
 * 10 — обнуляется и +1 к старшему разряду. То есть номер ведёт себя как
 * обычное трёхзначное десятичное число, где каждая цифра — от 0 до 9.
 *
 * Формат: MAJOR.MINOR.PATCH, но MAJOR/MINOR/PATCH ∈ [0..9].
 *
 * Старая история (0.0.1–0.10.17) ведена в semver-стиле, на этом этапе
 * фиксируем 1.0.0 как стабильный полный i18n-релиз и переходим на новое
 * правило для последующих изменений.
 *
 * История:
 * 0.0.1 — Первый редизайн Abyss Aurora (violet/cyan palette)
 * 0.0.2 — Deep Space palette (Electric Blue + Indigo)
 * 0.0.3 — Полностью убран фиолетовый. Только чистый синий #3B82F6 + Cyan.
 * 0.0.4 — Контраст v2: Hero всегда тёмный. StatusPill темо-адаптивный.
 * 0.0.5 — Carbon & Silver: ультра-минималистичный дизайн, полностью убран синий цвет.
 * 0.0.6 — Адаптация Hero-карточки и быстрых действий под Light Mode.
 * 0.0.7 — BillingPage: перенос баланса на Carbon-стиль, замена розового на оранжевый.
 * 0.0.8 — Внедрено inline-редактирование имени пользователя на Dashboard и синхронизация с RoomPage.
 * 0.0.9 — Улучшены отступы, рамочка и кнопки в inline-редакторе имени.
 * 0.1.0 — Обновлен дизайн страниц авторизации под тему Carbon & Silver, исправлен баг кнопки входа и переключателя видимости пароля.
 * 0.1.1 — Исправлено падение бэкенда на Node v24 из-за ESM hoisting и отсутствия .env, настроен параллельный запуск dev серверов.
 * 0.1.2 — Добавлена навигация в Админ-панель для суперадмина и интерактивные консоли тестирования соединений API.
 * 0.1.3 — Добавлен раздел Google OAuth авторизации пользователей (Client ID / Client Secret) с консолью проверки подключения.
 * 0.1.4 — Добавлен визуальный блок с Redirect URIs для Google OAuth и проведена верификация.
 * 0.1.5 — Заменен блок Google Service Account JSON на форму ввода Google Gemini API Key с проверкой соединения.
 * 0.2.0 — AI Learning Hub Pro: страница обучения диалектам (/admin/dialects), CRUD правил, CSV-импорт глоссариев, компиляция промпта для Gemini, улучшенные субтитры с glassmorphism.
 * 0.2.1 — Добавлен левый сайдбар (AdminLayout) для навигации суперадмина, мобильная верхняя панель и бесшовный возврат на основной сайт без выхода из аккаунта.
 * 0.2.2 — Добавлена полноценная интеграция Google OAuth: включена кнопка авторизации, добавлена кнопка быстрой регистрации через Google и создан красивый обработчик колбэков GoogleCallbackPage.
 * 0.2.3 — Удалены дубликаты роутов /upload-sample, /test-sample, /save-correction в dialects/router.ts (мёртвый код).
 * 0.2.4 — Исправлена опечатка в GOOGLE_CLIENT_SECRET (.env), приведена к правильному значению из system-config.json, подтверждена валидность через Google OAuth API.
 * 0.2.5 — Реальный LiveKit + Gemini bridge в RoomPage: подключение к LiveKit Cloud, mic/camera, реальные видео-элементы, авто-запуск бота-переводчика, индикатор статуса перевода. /api/livekit/token возвращает {token,url}. Убран хардкод localhost.
 * 0.2.6 — Убран индикатор «Gemini Live» из верхнего бара по запросу пользователя.
 * 0.3.0 — Текстовые субтитры через outputAudioTranscription, AI Coach со streaming (Gemini Flash, цветовая разметка приватных подсказок 🟡), индикатор слабой связи (Wifi/WifiOff), Vite готов к ngrok. Версия видна в углу — теперь можно отличать итерации.
 * 0.3.1 — Диагностический лог в bridge.ts: первые 12 сообщений Gemini печатают свою структуру (без аудио), чтобы понять, где модель держит текст транскрипции при активном streamTranslationConfig. Также добавлен fallback на inputTranscription и parts[].text.
 * 0.3.2 — НАЙДЕНА И ИСПРАВЛЕНА КОРНЕВАЯ ПРИЧИНА молчания субтитров: модель 'gemini-live-2.5-flash-preview' НЕ существует (404), и 'streamTranslationConfig' НЕ поддерживается реальным API (1007). Дефолтная Live-модель → gemini-3.1-flash-live-preview. Перевод теперь через systemInstruction. В админке селектор из 4 Live-моделей: 3.1 Live, 2.5 native-audio latest/12-2025/09-2025. Текстовые задачи (AI Coach, dialects/test-sample, verify-google, assistant) → gemini-3.5-flash (новейшая non-Live).
 * 0.3.3 — UX-фикс кнопки «Проверить подключение» в админке: вместо generic «Ошибка сети: Unexpected end of JSON input» теперь показываем точный код HTTP и rawText сервера. Корень бага: при перезагрузке бэкенда через tsx watch (которая происходит на каждое сохранение файла во время разработки) ответ обрывался с пустым телом, await res.json() падал на парсинге.
 * 0.3.4 — КРИТ-фикс: бэкенд падал с RtcError InvalidState из AudioSource.captureFrame, потому что метод асинхронный (Promise), а мой try/catch был синхронный → unhandled rejection валил весь Node.js процесс. Теперь .catch на Promise + глобальные process.on('unhandledRejection') и process.on('uncaughtException') для страховки. Параллельно подтвердил: Gemini 3.1 Flash Live Preview ПЕРЕВОДИТ — на скриншоте пользователя видны субтитры «Hello. Hello.» (бот услышал «Привет. Привет.» по-русски и перевёл).
 * 0.3.5 — SIP Итерация А: реальная связка SipPage ↔ /api/sip/trunk. Загрузка через GET, сохранение через POST (создание + обновление), удаление через DELETE. x-tenant-id из user.tenantId. Toast'ы успеха/ошибки. Защита для суперадмина (без UUID tenantId — показываем заглушку «настраивается на уровне арендатора»). В db/index.ts добавлены fallback-обработчики sip_trunks, чтобы UI работал и без PostgreSQL.
 * 0.3.6 — Удаление SIP-транка теперь подтверждается через внутренний стилизованный модал (вместо нативного браузерного confirm). Красная градиентная кнопка «Удалить», ghost-кнопка «Отмена», blur backdrop, клик вне модала — закрывает.
 * 0.4.0 — SIP Итерация Б: входящие звонки. Создание inbound trunk + dispatch rule в LiveKit Cloud, генерация уникальных auth username/password per tenant. Уникальный SIP-хост на основе livekitUrl. UI: данные для копирования (sip-сервер, логин, пароль, комната) с кнопками копировать + show/hide пароля, активация/остановка bridge переводчика по требованию, перевыпуск credentials, удаление. Подсказка по настройке Zadarma. На стороне БД новая таблица sip_inbound + fallback handlers.
 * 0.4.1 — SIP Итерация В: исходящий звонок Web → телефон. POST /api/sip/call: бэк находит outbound-trunk пользователя в LiveKit, создаёт комнату с UUID, вызывает SipClient.createSipParticipant с метаданными языка получателя (bridge подхватит и переведёт), параллельно стартует TranslationBridge. UI: форма «Исходящий звонок» с полем номера и LanguagePicker для языка получателя — после нажатия «Позвонить» автоматический redirect в /room/{uuid}, где пользователь подключается голосом, а SIP-абонент уже в этой комнате.
 * 0.6.0 — Stripe-биллинг (10 этапов). Тарифы: Plus €19/мес (60 мин), Standard €29/мес (120 мин) или €289/год (1440 мин, −17%), Enterprise (контакт). Этапы: (1) Stripe ключи в Admin Config + verify; (2) кнопки «Синхронизировать тарифы EUR/USD» создают Products/Prices в Stripe (идемпотентно через lookup_key); (3) маркетинговая BillingPage без эмодзи, toggle Месячно/Ежегодно, FAQ, список 100+ языков; (4) /api/billing/checkout создаёт Subscription Checkout, /portal — Stripe Customer Portal, /me — состояние подписки; (5) bridge.ts списывает 1 секунду в БД на каждую секунду активной речи (через billing/usage.ts), Enterprise = unlimited; (6) rollover.ts — раз в час переносит остаток на следующий цикл (на третий — сгорает); (7) bridge публикует low_balance / quota_exhausted в data channel topic=billing, в RoomPage баннер с кнопками «+60/+120/+300 мин» (Stripe Checkout без выхода из комнаты); (8) BillingPage TopupCalculator со слайдером 60→600 мин × €0.17; (9) /admin/promocodes — Stripe Coupons + Promotion Codes (percent_off 1-100, once/repeating/forever, max_redemptions, expires_at, 100% = бесплатная активация); (10) Standard yearly со скидкой 17% (€289 vs €348). Также: webhook слушает customer.subscription.* + checkout.session.completed (subscription и one-time topup) + invoice.paid. Fallback handlers в db/index.ts для subscriptions, promo_codes, tenants.stripe_customer_id.
 * 0.9.2 — КРИТ-фикс «удалил → перезагрузил → вернулось». Корень: pool.query(DELETE) уходит в реальный Postgres когда тот доступен, но db_fallback.json при этом не обновляется. После рестарта backend'а (если PG временно недоступен) fallback читает старый JSON и «воскрешает» удалённые записи. Решение: новые helper-функции removeRoomFromFallback / renameRoomInFallback / removeUserFromFallback в db/index.ts, которые ВСЕГДА синхронизируют JSON, независимо от того, в pg запрос ушёл или в mock. Вызываются из rooms/service.ts deleteRoom + renameRoom и admin/users.ts DELETE. Также почищены 40 stale-комнат из db_fallback.json.
 * 0.10.0 — Тариф Enterprise (4 блока). Подробно — раздел 5.М в PROJECT_NOTES.md. (1) Чат-диалог в каждой Enterprise-комнате: новая страница /room/:id/chat с MessageList/Composer/Tone-popover/Insights-modal, поддержка медиа (image/video/audio/file), кнопка «Чат» и теги потребностей на карточке. (2) Новая страница «Настройки Enterprise» (/settings/enterprise) — 4 секции в табах: per-tenant Gemini API ключ (с AES-256-GCM, привязка Telegram владельца), расширение Tenant Prompt (Word/Excel/CSV + кнопки тонов), Quest Flow + Telegram-боты (API ключи, отдельный promt, KB, теги, инструкция), Chatwoot per-tenant. (3) Quest Flow Inbound API: POST /api/quest-flow/inbound с Bearer vbvx_qf_*, find-or-create telegram_chat комнаты по (tenant, bot_id, user_id) — 1 клиент = 1 комната навсегда, транскрипция аудио + детекция языка/диалекта, AI-ответ с приоритетными заметками админа, детекция тегов, polling outbox для outbound. (4) Chatwoot per-tenant: encrypt-CRUD + test connection + push истории и тегов в conversation как приватная заметка. Новые БД-объекты: rooms.kind+telegram_*, room_messages, tenant_quest_flow_keys, tenant_need_tags, client_tag_assignments. Все миграции идемпотентные + fallback-handlers для in-memory. v0.10.0-фиксы: useIsEnterprise теперь читает и subscriptionTierName (бейдж работал, пункт меню — нет), плашка composer не обрезается, заметки админа в video-комнатах помечены ⚠️ ПРИОРИТЕТНЫМ контекстом и в insights, и в responder (для повторных обращений того же клиента). Пустые transcript-bubble отфильтрованы.
 * 0.10.1 — Чат-комната v2: (1) Vite proxy теперь прокидывает /uploads → backend:3001 (без этого медиа загружались на :3000 и 404). (2) Плашка «Видео-комната» переоформлена: rounded-xl, отступы mx-3 my-3, padding py-2.5, акцент жирным «Видео-комната.» и «с приоритетом» — теперь читабельная и не «прижата к краю». (3) DELETE /api/enterprise-chat/:roomId/messages/:messageId — creator может удалить любое сообщение из чата (текст, медиа, transcript-зеркало). Физический файл из /uploads/enterprise-chat/* тоже удаляется. (4) В MessageBubble добавлена hover-кнопка 🗑 справа от time-метки (рядом с «Тон»). RoomChatPage прокидывает handleDeleteMessage в MessageList → MessageBubble.
 * 0.10.2 — Фиксы удаления и сайдбара: (1) В db/index.ts добавлены fallback-handlers SELECT FROM room_messages WHERE id = $1 и DELETE FROM room_messages WHERE id = $1 — без них в режиме без PostgreSQL удаление падало с «Сообщение не найдено» (preflight SELECT возвращал пусто). (2) Заменили нативный browser confirm() на стилизованный ConfirmModal (Aurora-стиль, danger-вариант с красной кнопкой). (3) Иконка 🗑 теперь всегда видна (не на hover) — пользователю очевидно что можно удалить ЛЮБОЕ сообщение (текст, медиа, transcript-запись). (4) Sidebar теперь читает state напрямую через useAppStore() без селекторов и без useIsEnterprise hook — устойчиво к Vite HMR (раньше hook терял подписку при горячей перезагрузке и пункт «Настройки Enterprise» не появлялся).
 * 0.10.3 — Жёсткий sync fallback + страховка Sidebar. КРИТ-фикс «удалил → F5 → сообщение вернулось»: причина та же что была с rooms в v0.9.2 — pool.query(DELETE) уходит в реальный Postgres, но db_fallback.json не обновляется. После рестарта (если PG временно недоступен) fallback читает старый JSON и удалённое сообщение «воскресает». Решение: новые helpers addMessageToFallback / removeMessageFromFallback в db/index.ts, которые ВСЕГДА синхронизируют JSON, независимо от того, в pg запрос ушёл или в mock. (1) insertMessage в rooms/messages.ts теперь после pool.query всегда зовёт addMessageToFallback. (2) DELETE endpoint в enterprise_chat/router.ts теперь после pool.query всегда зовёт removeMessageFromFallback и возвращает 404 только если ни PG, ни fallback не имели записи. (3) Sidebar: страховочный useEffect — если token есть, а subscriptionTierName=null, явно дёргаем refreshBilling. Сравнение тарифа теперь case-insensitive (Enterprise / ENTERPRISE / enterprise — всё работает). Опциональный debug-лог через window.__VV_DEBUG_SIDEBAR=true для диагностики.
 * 0.10.4 — Аудит навигации + удаление dead code. Корень багa «пункт не появлялся»: в проекте было ДВА навигационных компонента — components/Sidebar.tsx (мёртвый — нигде не импортируется) и inline-навигация в layouts/MainLayout.tsx (живая). Все 3 предыдущие версии правили Sidebar.tsx и удивлялись почему ничего не меняется. (1) Sidebar.tsx **полностью удалён** как dead code. (2) Пункт «Настройки Enterprise» добавлен в MainLayout.tsx после Тарифов и до Админ-панели (условный NavLink, видимость по isEnterprise=role||tierName||tier). (3) То же в BottomTabBar.tsx в More-sheet (mobile). (4) В PROJECT_NOTES.md добавлен новый раздел «0. КАНОНИЧЕСКИЕ КОМПОНЕНТЫ — НЕ ПЛОДИТЬ ДУБЛИ» с таблицей канонических файлов (MainLayout/BottomTabBar/AdminLayout/feature_gate/encryption/ConfirmModal). Правило: перед редактированием похожего компонента — сверяться со списком, иначе можно править dead code.
 * 0.10.5 — Полноценные Telegram-уведомления Enterprise + персональный бот. (1) Новое поле в БД `tenants.owner_telegram_bot_token_encrypted` (AES-256-GCM) — опциональный персональный токен бота владельца. Если задан — уведомления идут ОТ ЕГО ИМЕНИ (например @MyClinicBot). Если NULL — fallback на глобальный VibeVox-бот. (2) owner_telegram.ts расширен: getOwnerBotToken/setOwnerBotToken, getEffectiveBotToken (per-tenant→global fallback), checkBotToken (через Telegram /getMe), sendTestMessage (end-to-end проверка). (3) Новый endpoint POST /api/tenant-settings/owner-telegram/test — отправляет реальное тестовое сообщение, можно тестировать значения ДО сохранения. (4) Section1Gemini переоформлен: два отдельных поля (Bot token / chat_id), кнопка «Отправить тест» с подробным результатом (бот username, статус доставки), показ ✓ для сохранённых значений. (5) quest_flow/inbound.ts: при создании НОВОЙ telegram_chat комнаты (свежий клиент) — уведомление «🆕 Новый клиент через Quest Flow» с ссылкой на чат. При успешной детекции тегов — уведомление «🏷 Выявлены потребности» с тегами и ссылкой. Уведомления async, не блокируют ответ QF.
 * 0.10.6 — Добавлены SIP-телефония и ИИ-Ассистент в desktop sidebar. До этого они были ДОСТУПНЫ (роуты, страницы, бэкенд) но видны только в мобильной нижней панели (BottomTabBar → More-sheet). desktopNav в MainLayout.tsx содержал только Главная/Комнаты/Тарифы. Добавлены пункты Phone (SIP-телефония) и Bot (ИИ-Ассистент) после Тарифов — теперь видны на десктопе всем пользователям. Mobile-меню уже содержит их корректно.
 * 0.10.7 — Удаление UI-демки «ИИ-Ассистент» (AssistantPage). Аудит показал: страница была UI-заглушкой с захардкоженным mock-ответом «Анализирую ваш запрос…», без реальных API-вызовов. Реальный функционал ПОЛНОСТЬЮ реализован в Enterprise-фичах: чат с клиентом → RoomChatPage (/room/:id/chat); анализ диалога → InsightsModal + /api/insights/analyze; Telegram-интеграция → Quest Flow + /api/quest-flow/inbound. (1) Удалена страница apps/frontend/src/pages/AssistantPage.tsx. (2) Убран роут /assistant из router.tsx. (3) Убран пункт меню из MainLayout (desktopNav) и BottomTabBar (moreItems). (4) Backend модуль apps/backend/src/modules/assistant/ ОСТАВЛЕН как библиотека — экспортирует deductAudioBalance, InsufficientBalanceError, FeatureNotAvailableError, geminiProvider которые критически используются в quest_flow/inbound.ts и quest_flow/router.ts. (5) Endpoints /api/assistant/call-analytics и /api/assistant/telegram-gateway тоже оставлены работающими (обратная совместимость), хотя их функционал перекрыт более продвинутыми /api/insights/analyze и /api/quest-flow/inbound. (6) В PROJECT_NOTES.md в раздел канонических компонентов добавлена строка про backend assistant/ как библиотеку — чтобы будущие разработчики не пытались его трогать.
 * 0.10.8 — Auto-discovery chat_id для персонального бота. Сценарий: пользователь создал бота в @BotFather, вставил токен — не нужно вручную узнавать chat_id у @userinfobot. Backend сам через /getUpdates находит первое сообщение от пользователя и привязывает его chat_id (приоритет приватный чат → группа → канал). (1) Новая функция discoverChatIdsFromBotToken(token) в owner_telegram.ts — берёт getUpdates у произвольного токена. (2) autoDiscoverAndSaveChatId(tenantId) — найти + автосохранить, с понятным hint если ничего не нашёл. (3) PUT /owner-telegram: при сохранении только токена (без chat_id) сразу пытается auto-discover. Если найдено — возвращает autoDiscover.savedChatId, фронт показывает «✓ Привязан автоматически». Если нет — autoDiscover.hint типа «Напишите боту https://t.me/MyBot, потом нажмите «Получить chat_id»». (4) Новый endpoint POST /owner-telegram/discover-chat-id — ручная разовая попытка. (5) sendTestMessage расширен: если chat_id не задан, пытается auto-discover внутри теста (если нашёл — сразу сохраняет + шлёт + добавляет autoDiscovered в response). (6) Section1Gemini UI: новая кнопка «Получить chat_id из бота» (видна когда токен сохранён), янтарный hint-блок с инструкциями, обновлена подсказка возле chat_id (опционально, можно оставить пустым).
 * 0.10.9 — Упрощение Telegram-уведомлений до single-field UX. (1) Поле chat_id ПОЛНОСТЬЮ убрано из UI — пользователь вводит ТОЛЬКО токен бота, всё остальное автоматически. (2) Глобальный VibeVox-бот больше НЕ используется как fallback для Enterprise-уведомлений (он только для суперадминских broadcast'ов через notifications/telegram.ts). Если у Enterprise-владельца нет персонального бота — уведомления просто не приходят. Это сознательное решение: глобальный бот @vibevoxinfo_bot принадлежит суперадмину и его не должно быть в Telegram клиента — у каждого Enterprise свой бот для брендирования. (3) PUT /owner-telegram теперь принимает ТОЛЬКО botToken (без telegramId): валидирует токен через /getMe ДО сохранения, сохраняет, auto-discoverит chat_id через getUpdates, если нашёл — отправляет welcome-сообщение через ЭТОТ ЖЕ бот (без отдельной кнопки «Отправить тест» при первом сохранении). (4) UI: только поле токена + одна кнопка «Сохранить и подключить». Если бот сохранён но чат не найден (юзер не успел написать /start) — кнопка «Привязать снова». Если всё привязано — кнопка «Отправить тест» (повторно). Статус-блок показывает: ✓ Бот @username + ✓ Чат привязан / ⚠️ напишите /start.
 * 0.10.10 — Telegram-уведомления = РАССЫЛКА всем подписчикам бота (а не одному chat_id). Новая модель: владелец вставляет токен → backend через /getUpdates собирает ВСЕХ кто написал /start этому боту (или был в группе/канале куда бота добавили) → сохраняет в tenants.owner_telegram_subscribers JSONB → при любом событии (новый клиент, тег, ошибка) рассылает каждому. Это позволяет подписать нескольких сотрудников или группу. (1) Новое поле в БД owner_telegram_subscribers JSONB DEFAULT '[]' — массив {chatId, type, title, addedAt}. (2) owner_telegram.ts полностью переписан: getSubscribers / refreshSubscribers (через getUpdates) / removeSubscriber / sendOwnerNotification теперь BROADCAST всем. (3) PUT /owner-telegram: validate токен → save → refresh подписчиков → welcome-broadcast всем найденным. (4) Новые endpoints: POST /refresh — найти новых подписчиков; DELETE /subscribers/:chatId — исключить из рассылки. (5) UI: карточка «Бот подключён @username» с активной ссылкой t.me/<username> и кнопкой ❌ отвязать, список подписчиков (личный/группа/канал с цветными бейджами и удалением), кнопки «Заменить токен» / «Обновить подписчиков» / «Отправить тест (N)». Если 0 подписчиков — подсказка «Откройте @bot, напишите /start, потом обновите».
 * 0.10.11 — Максимальное упрощение Telegram-блока. (1) sendTestMessage теперь сам внутри делает refreshSubscribers — пользователю не нужна отдельная кнопка «Обновить подписчиков». Каждое нажатие «Выслать ботом тестовое извещение» автоматически подтягивает новых подписавшихся. (2) Кнопка «Заменить токен» переименована в просто «Сохранить» — пользователю было непонятно почему она не «Сохранить». (3) Полностью убрана секция со списком подписчиков и DELETE-кнопками по каждому — это техническая деталь, владельцу не нужно её видеть. (4) Убрана кнопка «Обновить подписчиков» — её работа теперь автоматически делается перед каждым тестом и при сохранении токена. (5) UI = поле токена + Сохранить + (если бот подключён) карточка «Бот подключён @username» с активной ссылкой + кнопка «Выслать тест». Всё.
 * 0.10.12 — КРИТ-фикс fallback handlers (Gemini ключ и Telegram-бот пропадали после save). КОРНЕВАЯ ПРИЧИНА: в db/index.ts handler #16 был задан общим regex `/UPDATE tenants SET/i` — он перехватывал ВСЕ UPDATE'ы tenants (gemini, telegram, chatwoot, questflow, и т.д. v0.10.0+) и возвращал пустой ответ, не давая моим точным enterprise-handler'ам отработать. Ничего не сохранялось в fallback JSON. Дополнительно: handler для `UPDATE tenants SET gemini_api_key` был тоже слишком общим — он матчил И полный save (3 values), И status-only update (2 values), И last_check-only (1 value), затирая encrypted-поле значением 'active' при валидации. (1) Handler #16 теперь требует явное упоминание stripe_subscription_id / stripe_price_id / subscription_status. (2) Gemini handler разбит на 3 точных по конкретности (full save / status only / last_check only). (3) Очищен мусор «gemini_api_key_encrypted: active» из db_fallback.json. После рестарта backend всё должно сохраняться корректно — введите ключ Gemini и токен бота заново.
 * 0.10.13 — Фикс «У бота нет подписчиков» хотя /start был отправлен. Причина: Telegram /getUpdates имеет внутренний offset. Если уже acknowledge'нули предыдущим вызовом (например при save), следующий вызов без offset возвращает пусто. Плюс если у бота установлен webhook, getUpdates вообще не работает. (1) Перед каждым getUpdates вызываем deleteWebhook?drop_pending_updates=false (best-effort) — отключаем webhook если был. (2) getUpdates теперь с offset=-100 — забираем последние 100 апдейтов независимо от acknowledged state. Безопасно: chat'и сохраняются в нашу БД, мы не зависим от Telegram-стейта. (3) Расширены allowed_updates до 4 типов (включая edited_message). Теперь /start всегда подтянется.
 * 0.10.14 — Лимиты Section2 ×10 + удаление избыточной «Синхронизации». Технических причин для прежних лимитов не было (Gemini 2.5 Flash context = 1M токенов = ≈4M символов). Решено дать владельцу Enterprise гибкость: (1) MAX_PROMPT_LEN: 4000 → 40 000 символов (≈10k токенов). (2) MAX_KB_LEN: 50 000 → 500 000 символов (≈125k токенов). (3) MAX_UPLOAD_BYTES: 5 МБ → 50 МБ. Поднято и в tenant_prompt/router.ts, и в quest_flow/prompt.ts, и в quest_flow/responder.ts. Компромисс: больший промт = больший расход токенов на каждый Gemini-вызов и медленнее ответы; но это выбор владельца. (4) Удалена секция «Синхронизация» из Section2Prompt — она была no-op'ом дублирующим то что делает «Сохранить промт». Текст «Сохранён ✓» от save и так подтверждает что данные в БД. (5) Backend endpoint POST /api/tenant-prompt/sync-check остался работать (для будущих интеграций), но UI на него больше не ссылается. Также в PROJECT_NOTES.md добавлены два новых правила: «Правило точности SQL-handler'ов в fallback» и «Telegram Bot API quirks» — чтобы избежать повторения v0.10.12/13 багов.
 * 0.10.15 — Чёткое разделение зон ответственности «Подсказки» (Раздел 2) и «Quest Flow» (Раздел 3). РАНЬШЕ: questflow_prompt пустой → fallback на custom_prompt из Раздела 2; questflow_kb пустой → fallback на knowledge_base из Раздела 2. Это путало пользователей. ТЕПЕРЬ строгое разделение: (1) tenant.custom_prompt + tenant.knowledge_base используются ТОЛЬКО для расшифровки сообщений в чате видео-комнаты (кнопка «Согласно вашего промта» в ToneMenuPopover). (2) tenant.questflow_prompt + tenant.questflow_knowledge_base используются ТОЛЬКО для AI-ответов клиентам через Quest Flow. (3) Если поле в QF пустое — используется DEFAULT_QUEST_FLOW_SYSTEM_PROMPT (экспортирован из responder.ts). Аналогично для tone='custom' — DEFAULT_CUSTOM_TONE_PROMPT (tone_response.ts). (4) Новые endpoints GET /api/tenant-prompt/default-system-prompt и GET /api/quest-flow/prompt/default-system-prompt — отдают дефолты в UI. (5) UI Section2: переименована в «Подсказки», подзаголовок объясняет что это только для расшифровки в видео-комнатах с big warning «Не путать с Quest Flow». Добавлен сворачиваемый блок «Что использует AI по умолчанию» — показывает дефолтный промт. Описание контекста: «можно дополнить своими правилами, они объединятся с дефолтным». (6) UI Section3: переименована в «Quest Flow» (было «Quest Flow + Telegram-боты»). Та же фича с разворотом дефолта. Лимиты увеличены до 40_000 в textarea. Описание fallback изменено: «общий промт VibeVox» вместо «общий промт из Раздела 2». (7) Удалён блок «Как подключить в Quest Flow» — длинная инструкция теперь только в docs/QUEST_FLOW_INTEGRATION.md и в энциклопедии (PROJECT_NOTES). (8) Tab labels в EnterpriseSettingsPage обновлены.
 * 0.9.1 — UX уточнения: (1) **Сценарий «копируй и закрой»** на лобби: блок share-link переоформлен — read-only input с URL отдельной строкой, под ним крупная пилюля «Скопировать ссылку», после успешного copy появляется зелёная подсказка «✓ Ссылка скопирована. Отправьте собеседнику. Можете закрыть страницу — ссылка работает всегда». (2) **Карандашик переехал в шапку карточки комнаты** — рядом с названием (как в Notion), вместо нижней actions-row. (3) **Modal «Новая комната»** вместо instant create: поле для названия с дефолтом «Комната X · 25 мая, 13:18» (с **датой и временем**, не только время), Enter для submit, подсказка «можно переименовать позже». (4) **Suggestion «У вас уже есть пустые комнаты»** при создании — если у юзера есть пустые комнаты, в модале сверху показывается янтарная плашка с быстрым переходом, чтобы не плодить дубликаты с одинаковыми названиями.
 * 0.9.0 — Управление комнатами + промокод-applicator. **Комнаты**: (1) /api/rooms GET — список моих комнат с participantsCount/isLive; PATCH :id — rename; DELETE :id — hard delete (transcripts/insights удаляются); TTL увеличен с 24h до 5 лет (≈persistent). (2) Frontend RoomPage: список — реальные данные через polling каждые 8 сек, inline rename (карандашик), кнопка-корзина с confirm-модалом, copy-link, кнопка «Войти». Live-badge с пульсацией. При появлении нового участника (count 0→1+) — toast «Кто-то вошёл», звук (Web Audio API beep 880Hz, 300ms) + green glow вокруг карточки на 4 сек. (3) В bottom-sheet «Действия» внутри комнаты добавлены «Скопировать ссылку» (всем) и «Удалить комнату» (только creator). **Промокоды**: (1) /admin/promocodes — multiselect «На какие тарифы» (Plus / Standard / Standard Yearly / Все). На Stripe-стороне coupon.applies_to.products. (2) /billing — поле «Активировать промокод» с кнопкой Применить. POST /api/billing/promo-validate проверяет код в Stripe (active, не истёк, лимиты, applies_to). При успехе показывается зелёная плашка с code + summary; промокод передаётся в /api/billing/checkout как discounts.promotion_code. (3) Если юзер не применил промокод — Checkout всё равно `allow_promotion_codes: true` (можно ввести прямо в Stripe).
 * 0.8.3 — Call duration timer в верхнем правом углу. Тикает раз в секунду с момента успешного room.connect(). Format: HH:MM:SS (≥1ч) или MM:SS (<1ч). Красная пульсирующая точка (как «recording» индикатор). Сбрасывается при hangup/cleanup. Каждый участник видит свой таймер (от своего подключения).
 * 0.8.2 — Полная итерация комнаты: (A) фикс «тянущихся звуков» — убран autoGainControl: true (он усиливал тишину между словами, Gemini трактовал как continuous input и тянул); упрощены QUALITY RULES до одного «natural pace». (B) Hard limit 2 участника на комнату — в /api/livekit/token проверяется RoomServiceClient.listParticipants, при ≥2 не-bot участниках возвращается 403 room_full; фронт показывает «🚫 Комната занята». (C) Focus mode UX — клик по своей плитке = развернуть собеседника на весь экран (своё становится floating PiP), клик по PiP = вернуться. (D) Mobile call-controls: max 5 primary кнопок в pill (Mic / Camera / ScreenShare / More / Hangup), всё остальное (Languages toggle / Subtitles toggle / Focus mode) — в bottom-sheet «Ещё» с handle и aurora-стилем. (E) AI Coach: на десктопе ≥1024px стал right side-panel 380px (как Zoom/Teams), на мобильном остался overlay снизу. (F) Voice selector в /admin/config: dropdown «Голос Ж» (Aoede/Kore/Leda/Zephyr) и «Голос М» (Charon/Puck/Fenrir/Orus); bridge читает getVoiceName() на каждом подключении. Все etapy исследованы через анализ Zoom AI Companion 2026, Google Meet+Gemini, Teams Copilot, Otter, Read.ai — паттерны 2026 соблюдены.
 * 0.8.1 — КРИТ-фикс регрессии перевода: убраны 2 правила в systemInstruction, конфликтующие с природой синхронного перевода — «WAIT for speaker to finish» (заставляло Gemini молчать вместо перевода частичных фраз) и «NEVER repeat the same phrase twice» (мешало естественным повторам). Базовая инструкция «Translate every utterance — questions, statements, jokes, fragments» снова работает в полную силу. Оставлены только мягкие правила: natural pace, no filler words, speak to the end.
 * 0.8.0 — Видеовстреча v2: (1) кнопка «На полигон» только для superadmin; (2) creator detection через расширенный GET /api/rooms/validate/:id (теперь возвращает creatorTenantId + settings); (3) Screen Share через LiveKit setScreenShareEnabled — кнопка Monitor в нижней панели для ВСЕХ участников, при включении центральная Glassmorphism-плитка + горизонтальный скролл миниатюр участников; (4) Toggle перевода и Toggle субтитров — только для creator'а, PATCH /api/rooms/:id/settings, перевод выкл → bridge останавливается → минуты не списываются (гости видят status-баннер «Перевод выключен организатором»); (5) AI Coach — premium-фича только для creator'а (клик на субтитр у гостя не открывает янтарную панель); (6) Качество: echoCancellation + noiseSuppression + autoGainControl в setMicrophoneEnabled, расширенный Quality-Rules блок в systemInstruction (не растягивай слоги, не повторяй фразы, дождись завершения, не обрезай хвост); (7) Enterprise Insights — post-call анализ через gemini-3.5-flash, JSON с sentiment/engagement/leadScore/tags/summary/nextSteps, модал после hangup для creator на Enterprise; (8) Custom Prompt + Knowledge Base — новая страница /assistant-prompt, поле prompt 4000 символов + загрузка .txt 50k символов, подмешивается в systemInstruction Gemini Live. Новые таблицы: rooms.settings/transcripts/insights, tenants.custom_prompt/knowledge_base.
 * 0.7.6 — Lobby UI: (1) LanguagePicker стал адаптивным — на десктопе (≥640px) рендерится как центрированный модал (max-w-2xl, scale-in анимация), на мобильных остался bottom-sheet с slide-up. Хук useIsDesktop() слушает matchMedia. Грид языков grid-cols-2 sm:grid-cols-3. (2) Блок «Скопировать ссылку» переделан: вместо серой кнопки с текстом «Скопировать ссылку» теперь иконка Share2 + UPPERCASE-заголовок «Поделитесь ссылкой» + подсказка «Скопируйте и отправьте собеседнику…» + видимый URL в read-only input (моноширинный, select-all on focus) + копи-кнопка справа с текстом «Копировать» (sm:inline только на десктопе). При успехе кнопка зеленеет и показывает «Скопировано». Все 9 локалей обновлены: copyLink → «Поделитесь ссылкой / Share the link / Havolani ulashing / …», новое поле shareHint для подсказки.
 * 0.7.5 — (1) КРИТ: «Rendered more hooks than during the previous render» в PaywallModal — useEffect для body scroll lock стоял после `if (!open) return null`, что нарушает Rules of Hooks. Перенесён выше early return, внутри проверяет `if (!open) return`. (2) /billing список языков: убрана строка «и ещё 20+ языков», теперь полный список из SUPPORTED_LANGUAGES (107 шт. с флагами) рендерится чипами. Добавлен поиск с typeahead — match по name (родной), nameEn (английский) и code (ISO). Если ничего не найдено — красная плашка «Язык не найден». Padding модалов: добавлен явный p-5 sm:p-6 ко всем 4 модальным карточкам (AuroraCard CSS не задаёт padding, попап выглядел обрезанным).
 * 0.7.4 — КРИТ-фикс баланса: (1) `subscriptions` теперь создаются параметризованным INSERT с ON CONFLICT DO NOTHING — fallback handler корректно сохраняет tier/status/balance, а не undefined (раньше fallback парсил `values[1]` как tier, но в SQL значения были хардкод → в db_fallback.json не появлялось ни одной подписки → все UPDATE balance тихо не работали); (2) admin/users `/credit` и `/tier` теперь вызывают `ensureSubscription(tenantId)` перед UPDATE — для старых юзеров без подписки она автоматически создаётся; (3) store получил `refreshBilling()` action и поле `subscriptionTierName` (raw из БД для красивого «Plus/Standard/Yearly»); MainLayout дёргает её на mount; UsersPage после credit/tier change — тоже; (4) MainLayout sidebar объединил user-card + balance + tier в одну карточку с разделителем — клик на user → /settings, клик на balance → /billing, цветной бейдж с тарифом; (5) UsersPage модалы: lock body scroll, max-h-screen, scroll внутри, `items-start sm:items-center` для нормальной работы на телефонах; (6) фильтры /admin/users получили `border-medium` (видимые рамки), grid responsive 1/2/4 колонки, hover:bg.
 * 0.7.3 — Paywall-модал вместо browser alert + smart top-up: (1) PaywallModal с 3 тарифами и слайдером докупки, открывается из RoomPage при 402 от /api/rooms/create; (2) /api/billing/topup-preview — live-расчёт breakdown без создания Stripe-сессии; (3) /api/billing/topup переписан: если у юзера нет активной платной подписки, создаётся mixed subscription checkout (Plus €19 = 60 мин включено + если N>60 — overflow строка с (N−60)×€0.17). Webhook checkout.session.completed читает metadata.auto_topup_minutes и дозачисляет overflow после активации подписки. UI показывает breakdown: «Plus €19 (60 мин включено) + Докупка 60 мин = €29.20» и сообщение «↳ 60 мин бесплатно с тарифом».
 * 0.7.2 — Admin /users получил вторую волну фич: (1) кнопка-корзина → DELETE /api/admin/users/:userId каскадно сносит user + tenant + subscription с подтверждением в красном модале; (2) кнопка-карта → PATCH /:userId/tier позволяет назначить любой план (trial/plus/standard/standard_yearly/enterprise), опционально с авто-начислением минут по TIER_SECONDS_MAP — все три действия идут в Telegram; (3) фильтр-секция переоформлена в две строки: search+«Только оплатившие» + tier-dropdown / from-date / to-date / пресеты 7д·30д·сброс; (4) GET /api/admin/users расширен query: from, to, tier; (5) три модала (Add Minutes / Change Tier / Delete) переведены на единые компоненты Modal + ModalHeader — фирменный стиль Aurora, blur backdrop, цветные иконки-плашки, animate-fade-in; (6) inline-действия в таблице — три иконки 32×32 с tooltip'ами вместо «Минуты» текстовой кнопки; (7) fallback handlers в db/index.ts: UPDATE subscriptions SET tier, DELETE FROM users/tenants/subscriptions.
 * 0.7.1 — Hard paywall: 0 минут при регистрации (бесплатные минуты отменены). Guard в POST /api/rooms/create: tenants без баланса получают 402 + редирект на /billing. JWT_SECRET унифицирован в rooms/router.ts (был test_jwt_secret_key, стал vibevox_secret_key — теперь optionalAuth реально читает tenantId). JWT TTL увеличен 24h → 30d. В AdminConfigPage баннер ошибки auth получил кнопку «🔐 Войти заново». Кнопки ТЕСТ всегда активны: бэк сам делает getUpdates если получателей нет, при пустом результате возвращает botLink для деплинка в Telegram. Поправлен текст уведомления о регистрации (был «Триал: 30 минут», стал «Баланс: 0 минут (нужно оформить тариф)»).
 * 0.7.0 — Раздел «Пользователи» в админке + Telegram-уведомления. (1) /admin/users: таблица всех пользователей с поиском (email/организация/tenant_id/Stripe Customer ID), фильтр «только оплатившие», колонки «осталось мин / последний платёж / всего оплачено / тариф / зарегистрирован». Кнопка «Минуты» открывает модал «Добавить минуты» с пресетами 30/60/120/300/600 — зачисляет в основной translation_minutes_balance + обновляет total_paid_minutes. (2) Telegram-helper sendTelegramAdminMessage(text) + getUpdates discovery → /api/admin/notifications/{status,sync,test,summary-now,chat/:id}. В Admin Config под Telegram-карточкой: список chat_id'ов, кнопки «Синхронизировать получателей» (берёт chat.id из недавних сообщений боту) и «Отправить тест». Поддерживает приватные чаты, группы и каналы. (3) Хуки: при регистрации (auth/router.ts), при subscription.created/updated (active|trialing), при overtime_topup (через invoice.paid и checkout.session.completed) — летит уведомление администратору. (4) Daily summary scheduler в 09:00 Europe/Warsaw: новые регистрации за 24ч, оплаты за 24ч, всего пользователей/платящих, топ-5 по балансу. Защита от дублей — храним lastSentYmd. (5) Расширены subscriptions: total_paid_minutes, last_payment_minutes, last_payment_at (init.sql + fallback handlers). Добавлены SELECT * FROM tenants WHERE id, FROM users u LEFT JOIN tenants для админских отчётов.
 * 1.0.0 — Полная миграция UI на i18n: убраны хардкод-словари CALL_UI и
 *         COACH_PRESETS в RoomPage (читали navigator.language вместо i18next),
 *         все строки сайдбара/мини-меню/звонка/AI-чипов/paywall/тостов теперь
 *         через t('common:…'). Расширен public/locales/ru|en/common.json
 *         ~90 новыми ключами, ручные качественные переводы на 12 bundled
 *         языков (pl/de/es/fr/ar/he/zh/pt/it/tr), Google Translate на
 *         остальные 96. Унифицирован hreflang `/:lang/` во всех трёх местах
 *         (SeoMeta, prerender, sitemap). Pre-deploy цепочка: check-i18n /
 *         routes / propagate / translate / sitemap / build / prerender —
 *         `npm run predeploy`. Стартовый стабильный релиз перед публикой.
 * 1.0.1 — Единица «минут» в balance-карточке теперь рендерится через
 *         Intl.NumberFormat({style:'unit', unit:'minute'}) — CLDR-данные
 *         браузера для всех 108 языков. Решает баг ja=«ミニ»/ko=«최소»
 *         (Google Translate путал короткое «мин» с прилагательными), а
 *         заодно правильно ставит порядок числа/единицы в RTL. Новый
 *         компонент MinutesDisplay с formatToParts для двух-стилевого
 *         отображения (большое число + маленькая единица). Используется в
 *         MainLayout sidebar+mobile и BottomTabBar.
 * 1.0.2 — Большой батч i18n: SipPage, EnterpriseSettingsPage + 4 секции +
 *         ApiKeyField, RoomChatPage, InsightsModal, PaywallModal, и остатки
 *         RoomPage (search placeholder, tabs, действия карточек, paywall-
 *         тексты). Добавлено ~400 новых ключей в common.json (sip.*,
 *         enterprise.*, chat.*, insights.*, paywall.*, lobby.*, confirmModal.*,
 *         defaultRoom.*); Google Translate прогнан повторно — общий объём
 *         596 строк × 108 языков. Восстановлены ручные переводы для 10
 *         bundled языков (pl/de/es/fr/ar/he/zh/pt/it/tr) после Google API.
 *         Новый компонент RoomNameDisplay + helpers formatRoomName/
 *         buildDefaultRoomNameToken: дефолтные имена комнат теперь хранятся
 *         как токен `__DEFAULT_ROOM__|userName|ISO` и рендерятся локалью
 *         просматривающего через Intl.DateTimeFormat.
 * 1.0.3 — Финальный батч customer-facing i18n + первый-визит детектор:
 *         (1) Detection-order: `navigator` теперь ПЕРЕД `htmlTag` — на
 *         первом визите без localStorage язык приложения подхватывается
 *         из браузера, а не из prerendered <html lang="en">.
 *         (2) Рефакторинг: BillingPage (79→0 кириллицы, 126 t-вызовов),
 *         RoomLobbyPage (38→0 — убран UI_TRANSLATIONS словарь), SettingsPage,
 *         LoginPage, RegisterPage, ForgotPassword, GoogleCallbackPage,
 *         post-call InsightsModal в RoomPage.
 *         (3) Новые секции в common.json: postCallInsights.*, settingsMore.*,
 *         billingPage.* (расширенная маркетинговая копия + FAQ + поиск
 *         языков + topup + cancel/resume), auth.* (login/register/forgot/
 *         googleCallback + auth.common.*). Общий объём — 810 ключей ×
 *         108 языков.
 * 1.0.4 — (1) Tier-бейдж в sidebar MainLayout теперь через t('tier.*').
 *         (2) RoomLobbyPage: дефолтный язык перевода = язык UI.
 *         (3) Удалена страница /assistant-prompt (TenantPromptPage.tsx).
 *         (4) Админские страницы намеренно НЕ переводятся.
 * 1.0.5 — Gemini-2.5-flash ревью переводов: исправляет классические провалы
 *         Google Translate (контекст, бренды, неверный смысл слова).
 *         Новые артефакты:
 *         • public/locales/_glossary.json — список preserve-терминов (VibeVox,
 *           VibeAdd, Quest Flow, Stripe, Aoede/Charon/Kore, …) + описание
 *           типичных провалов Google Translate для prompt-инженерии.
 *         • scripts/review-locales-with-gemini.mjs — safe-mode ревью с
 *           structured output (responseSchema), валидацией плейсхолдеров,
 *           глоссарием, флагом --skip-if-fresh (hash источника в _meta),
 *           параллельностью.
 *         • reports/llm-review/<lang>.md — отчёт по каждому языку для аудита.
 *         • Интеграция в predeploy (новые шаги 5 gemini-review + 6 patch-
 *           bundled, --skip-gemini для пропуска).
 *         Результат прогона на gemini-2.5-flash free tier:
 *         • 34 языка отревьюено, 3579 фиксов применено
 *         • Примеры фиксов: az `Zibilxanaya→Təlim meydançasına` («полигон» был
 *           «свалкой»), de `Zölle→Tarife` («тарифы» были «таможенными
 *           пошлинами»), ja `関税→料金プラン` (та же ошибка), de
 *           `Versuch→Testversion` («Trial» был «попыткой/судом»), de
 *           `Gleichgewicht→Guthaben` («Balance» был физикой), ar/he/tr/ko
 *           подобные исправления.
 *         • 74 языка осталось не отревьюено — упёрлись в дневной лимит free
 *           tier Gemini (250 RPD). При следующем `npm run predeploy` через
 *           24ч с --skip-if-fresh подхватит остаток (hash источника не
 *           менялся, обработаются только не-отревьюенные ранее).
 *         • Bundled 10 языков (pl/de/es/fr/ar/he/zh/pt/it/tr) восстановлены
 *           патчем — patch-bundled-translations.mjs всегда запускается после
 *           Gemini в predeploy chain.
 * 1.0.6 — Партнёрская программа (рефералки). (1) SuperAdmin /admin/partners:
 *         редактируемые условия программы (plain text), поле WhatsApp для
 *         связи, таблица всех партнёров с агрегатами (переходы / регистрации /
 *         оплатили N чел / куплено мин). Кнопка вкл/выкл по каждому партнёру.
 *         (2) В настройках обычного юзера новая карточка «Партнёрская
 *         программа» с автогенерируемой ссылкой `vibevox.pro/?Vibe=<8 chars>`,
 *         тремя плитками-индикаторами и кнопками «Условия сотрудничества» +
 *         «Связаться» (открывает WhatsApp). (3) Глобальный ReferralTracker в
 *         App.tsx — читает `?Vibe=CODE` из URL, шлёт fire-and-forget POST
 *         /api/partners/track-click, сохраняет в cookie `vbvx_ref` на 90 дней,
 *         чистит URL через history.replaceState. (4) Атрибуция работает в
 *         обоих auth-флоу: email/password (POST /api/auth/register) И
 *         Google OAuth (POST /api/auth/google-login, только при первом авто-
 *         создании юзера, не при повторном логине). (5) Атрибуция оплат:
 *         creditReferralPayment вызывается из billing/webhook.ts на реальных
 *         платежах (subscription initial/renewal + invoice.paid top-up), не
 *         на mid-cycle обновлениях. (6) 4 новые таблицы (идемпотентная
 *         миграция): partners (1:1 к users), partner_program_settings
 *         (синглтон с условиями + WhatsApp), referral_clicks (лог переходов
 *         с sha256-хешем IP), referrals (атрибуция кто кого привёл). (7) Фикс
 *         предсуществующей ошибки `ChevronForward is not defined` в RoomPage —
 *         забытый импорт. (8) i18n: ключи partner.* в ru/en common.json,
 *         108 языков подхватятся через `npm run i18n:propagate` +
 *         `npm run translate:locales`. (9) Fallback handlers в db/index.ts для
 *         режима без PostgreSQL — все 4 партнёрские таблицы сохраняются в
 *         db_fallback.json. БЕЗ этих хендлеров карточка партнёрки не появлялась
 *         у пользователей в fallback-режиме (ensurePartnerForUser молча
 *         возвращал пусто). Заодно сужен генерик-хендлер `SELECT COUNT(*)` —
 *         раньше он перехватывал ВСЕ COUNT-запросы (включая COUNT(*) FROM
 *         referral_clicks) и возвращал длину dialect_rules вместо реального
 *         значения. Теперь требует явное `FROM dialect_rules`.
 * 1.3.6 — TrendFlow + Тренды + Галерея, пачка правок: (1) лента связи идёт от
 *         точки соединения 🔗 (верх-правый край узла), а не из центра. (2) Под
 *         каждым узлом — мелкая подпись выбранных параметров (напр. Экспорт →
 *         «TikTok, Reels, Shorts», Формат → «9:16», ✨ИИ). (3) В Галерее у видео
 *         без обложки показывается ПЕРВЫЙ КАДР (#t=0.1, preload=metadata) — превью
 *         сгенерированных роликов. (4) Типы поиска переименованы: «Умный поиск»
 *         (App V3), «Поиск по слову» (video), «Около-тематика» (general).
 * 1.3.5 — Тексты Enterprise: заголовок «Ключи генерации (OpenMontage)» → «Ключи
 *         генерации» (убран технический «OpenMontage»). В карточке TikHub убрана
 *         приписка «для сканирования трендов и скачивания видео» — осталось «Ваш
 *         собственный ключ TikHub. Получить — на tikhub.io».
 * 1.3.4 — TrendFlow: связи теперь как во всех редакторах — ПЕРЕТЯГИВАНИЕМ.
 *         Тянешь от точки 🔗 на узле — оранжевая линия следует за курсором —
 *         отпускаешь на другом узле → связь создаётся (drag-to-connect через
 *         pointer + elementFromPoint/data-node-id). Click-режим убран. Узлы Omni/
 *         Контент-план двигаются как раньше; × на середине стрелки удаляет связь.
 * 1.3.3 — TrendFlow: связи понятнее. У центрального «Видео из галереи» появилась
 *         кнопка 🔗 (раньше начать стрелку ОТ видео было нельзя). Подсказка режима
 *         связывания переписана: «кликните, КУДА вести стрелку». Теперь цепочка
 *         Видео → Google Omni → Контент-план собирается кликами 🔗→цель.
 * 1.3.2 — TrendFlow граф-конструктор, фаза A (каркас). На холст добавлены два
 *         перетаскиваемых «облачных» узла: «Google Omni» (генерация видео) и
 *         «Контент-план» — двигаются мышью (pointer-drag), позиции сохраняются.
 *         Связи-стрелки: кнопка 🔗 на узле → клик по цели (видео/Omni/план) рисует
 *         пунктирную стрелку (×-кнопка на середине удаляет); связи сохраняются в
 *         graph.cloudEdges. Клик по облачному узлу → панель-каркас (что будет на
 *         этапах B/C). Кнопка «Скачать видео» на готовом результате сборки. Бэкенд:
 *         FlowGraph/parseGraph хранят cloud + cloudEdges. Генерация Omni и публикация
 *         Контент-плана — следующие этапы (B/C), сейчас заглушки.
 * 1.3.1 — Enterprise → Генерация: добавлен ключ «Google Omni / Gemini (генерация
 *         видео, Veo/Omni)» (provider google_omni). Тот же Gemini API-ключ
 *         (AIzaSy…), проверка через generativelanguage models. Фундамент под
 *         будущую ноду «Google Omni» в TrendFlow (генерация/преобразование видео).
 * 1.3.0 — Редактор TrendFlow: добавление процессов переосмыслено. Убраны
 *         верхние чипы-палитра (дублировали добавление) и «+ Добавить» на узлах.
 *         Вместо нижней полосы — ПЛАВАЮЩАЯ «+» в левом верхнем углу холста: клик
 *         → веером выезжают иконки всех процессов (без подписей, тултип на ховере),
 *         клик по иконке → добавляет узел и открывает его настройку; «+»
 *         поворачивается в «×». Удаление узла переехало в кнопку «Удалить» в
 *         панели узла (рядом с «Готово»).
 * 1.2.9 — Редактор TrendFlow по референсу: (1) нижнее поле «Добавить» теперь
 *         СВЁРНУТО (пилюля), клик → раскрывается полосой (пружинка). (2) Узлы
 *         придвинуты ближе к центру (радиус 33/36→27/30); при наведении на узел
 *         всплывает кнопка «+ Добавить» (открывает список процессов). (3) Список
 *         процессов теперь ВЫЕЗЖАЕТ снизу пружинкой (me-grow, transform-origin
 *         bottom, ~0.26с) вместо резкого появления.
 * 1.2.8 — Анимации редактора TrendFlow + ФОНОВЫЙ рендер. (1) «Собрать»: модалку
 *         прогресса можно СВЕРНУТЬ (кнопка/клик по фону) → рендер идёт в фоне,
 *         внизу справа — плавающая пилюля «Собираю… N%» (клик разворачивает),
 *         по готовности — «Ролик готов». (2) Профессиональная анимация обработки:
 *         центральный узел пульсирует + вращающееся кольцо, прогресс-бар с
 *         шиммером, подпись «Собираю… N%». (3) Узлы появляются со staggered-
 *         анимацией (spring). (4) Нижнее поле «Добавить процесс» — мягкое
 *         поднятие+свечение при наведении.
 * 1.2.7 — UI: (1) Левый сайдбар теперь по умолчанию СВЁРНУТ (только иконки),
 *         раскрывается кнопкой (PanelLeftOpen/Close); состояние в localStorage.
 *         В свёрнутом — иконки навигации (подписи скрыты CSS), компактная нижняя
 *         карточка (аватар + тариф), PWA-плашка скрыта. (2) MontageEditor: верхние
 *         чипы стали ПАЛИТРОЙ всех процессов — активные (в сценарии) с карандашом
 *         (редактировать) и ✕ (убрать), недостающие — пунктирные с «+» (клик →
 *         добавить узел). (3) Кнопка в панели узла «Удалить» → «Закрыть» (✕);
 *         удаление узла теперь через ✕ на чипе.
 * 1.2.6 — Фикс «Failed to fetch dynamically imported module» (TrendFlow/Тренды/
 *         Галерея/Publisher). После деплоя открытая вкладка ссылалась на старый
 *         хеш-чанк (его в новой сборке нет → 404 → краш страницы). Добавлен
 *         lazyWithRetry в router.tsx: при ошибке загрузки чанка один раз
 *         перезагружает страницу за свежим билдом (защита от цикла — раз в 10с).
 *         Плюс дружелюбный errorElement (вместо dev «Hey developer») с кнопкой
 *         «Обновить».
 * 1.2.5 — Понятное сообщение при проверке Google-ключа (Imagen/Cloud TTS). Раньше
 *         403 от Google показывался как общий «невалиден». Теперь verify читает
 *         тело ответа: при API_KEY_SERVICE_BLOCKED / PERMISSION_DENIED сообщает,
 *         что ключ распознан, но Generative Language API заблокирован/не включён —
 *         с подсказкой включить API и снять ограничения ключа. Плюс .trim() ключа.
 * 1.2.4 — Фикс ложного попапа «ошибка регистрации» при ПЕРВОМ входе через Google.
 *         Google-код одноразовый, а эффект колбэка мог сработать дважды
 *         (StrictMode в dev / смена identity у t-i18n) → повторный POST
 *         /google-login с уже использованным кодом давал ошибку, которая мелькала
 *         поп-апом перед редиретом (хотя регистрация+вход проходили). Добавлен
 *         ranRef-гард + пустые deps → строго один запуск processLogin в
 *         GoogleCallbackPage. Первый вход через Google теперь чистый.
 * 1.2.3 — Google OAuth «The OAuth client was not found»: client_id сохранялся
 *         с ХВОСТОВЫМ ПРОБЕЛОМ (копипаст из Google Console) → Google не узнавал
 *         клиент. Добавлен `.trim()` для clientId/secret: бэкенд auth/router.ts
 *         (loadGoogleOAuthSettings на чтении, POST /google-settings на сохранении,
 *         /verify-google-oauth на проверке) + фронт AdminConfigPage (runConnectionTest).
 *         Теперь пробелы срезаются автоматически, ретроактивно чинит уже
 *         сохранённое значение (трим на чтении).
 * 1.2.2 — КРИТ-фикс «Failed to fetch» при входе/регистрации. LoginPage,
 *         RegisterPage, ForgotPassword слали запрос на ЗАХАРДКОЖЕННЫЙ
 *         `http://localhost:3001/api/auth/...` (остаток локальной разработки) —
 *         браузер на app.trendtraffic.pro стучался в localhost:3001 НА МАШИНЕ
 *         ПОЛЬЗОВАТЕЛЯ (+ mixed-content https→http) → «Failed to fetch», вообще
 *         никто не мог войти/зарегистрироваться. Заменено на относительные
 *         `/api/auth/login|register|forgot-password` (тот же origin → nginx-прокси
 *         → backend). DialectPlayground/DialectsPage уже были защищены `port===3000`.
 * 1.2.1 — Google OAuth: убран захардкоженный redirect_uri `vibevox.pro` (остаток
 *         шаблона) → теперь динамический `${window.location.origin}/auth/google/
 *         callback`, т.е. на app.trendtraffic.pro редирект идёт на свой домен.
 *         Исправлено в LoginPage, RegisterPage, GoogleCallbackPage (initial-запрос
 *         и token-exchange совпадают, как требует Google) + подсказка Redirect URIs
 *         в AdminConfigPage стала динамической. Для Google Console: Authorized
 *         JavaScript origins = https://app.trendtraffic.pro; Authorized redirect
 *         URIs = https://app.trendtraffic.pro/auth/google/callback. Client ID/Secret
 *         нового клиента — в Админ → Конфигурация → Google OAuth.
 * 1.2.0 — КРИТ-фикс: регистрация падала с 500 («Failed to fetch» в браузере).
 *         Причина: при регистрации создавалась подписка со status='inactive',
 *         а CHECK-констрейнт `subscriptions_status_check` разрешает только
 *         ('active','trialing','canceled','past_due','incomplete'). В dev не
 *         всплывало (JSON-fallback не проверяет констрейнты), в проде с реальным
 *         Postgres — нарушение → транзакция откат → 500. Исправлено на 'incomplete'
 *         во всех 3 местах: auth/register (email), auth google-login, admin
 *         ensureSubscription. Теперь человек может зарегистрироваться.
 * 1.1.9 — Фикс «401-шторма» в консоли при истёкшей сессии. Стор восстанавливал
 *         сессию из localStorage без проверки токена → RequireAuth пускал по
 *         наличию токена, а каждый /api-запрос ловил 401 (десятки в консоли,
 *         сломанная страница). Добавлен глобальный перехватчик fetch
 *         (lib/authInterceptor.ts, ставится в main.tsx до рендера): /api-ответ
 *         401 (кроме /api/auth/*) при наличии токена → logout() + переход на
 *         /auth/login?expired=1. Срабатывает один раз, сам fetch не ломает.
 * 1.1.8 — GPU-рендер: переключатель в админке + домашний GPU-воркер.
 *         (1) Карточка «Рендер: GPU и воркеры» в AdminConfigPage — тумблер
 *         Дом/Облако/Выкл (renderGpuTarget) + адреса CPU- и GPU-воркеров
 *         (renderWorkerUrl/renderGpuWorkerUrl). Бэкенд: getSettingsForClient
 *         отдаёт render-поля, saveSettings принимает оба URL (renderGpuTarget уже
 *         был). Раньше управлялось только через .env/system-config.json без UI.
 *         (2) Домашний GPU-воркер: render-worker/main.py получил точный диспетчер
 *         GPU-шагов — upscale (Real-ESRGAN, scale 2/4) и talking_head (аватар:
 *         фото+piper-озвучка→SadTalker), по реальным input_schema OpenMontage.
 *         install-gpu.sh (Linux/WSL2 NVIDIA): клон OpenMontage + make install/
 *         install-gpu (torch/CUDA) + systemd trendtraffic-render-gpu на
 *         100.122.182.97:8801 (Tailscale). README обновлён. Запустить/проверить —
 *         на домашнем ПК с RTX 5080 (torch из песочницы не проверить).
 * 1.1.7 — ИИ-режиссёр заработал (director-сервис). Умные ✨ЛЛМ-узлы на Claude
 *         (Anthropic SDK, динамический импорт; ключ tenant 'anthropic' → fallback
 *         системный ANTHROPIC_API_KEY; модель по умолчанию claude-opus-4-8):
 *         (1) Озвучка — Claude пишет сценарий по брифу → Piper озвучивает;
 *         (2) Ресёрч/Новости — Claude + web_search собирает материал/новость в
 *         ctx.scratchpad → озвучка берёт как опору; (3) Длина — Claude по
 *         транскрипту (новый /transcribe в рендер-воркере) выбирает лучший момент
 *         → video_trimmer режет именно его. Реализация: render/director.ts +
 *         executor_director.ts (decorator над базовым исполнителем), StepContext
 *         получил scratchpad (worker.ts прокидывает один на задачу), server.ts
 *         оборачивает базовый исполнитель в DirectorExecutor. Мягкая деградация:
 *         нет ключа/ошибка → passthrough с заметкой. UI MontageEditor: подсказка
 *         под ✨ЛЛМ что именно сделает режиссёр для узла. Все шаги уже были в
 *         редакторе (тумблер ЛЛМ + бриф) — UI почти не менялся.
 * 1.1.6 — ИИ-режиссёр: первый кирпич — Claude-ключ в Enterprise → «Генерация».
 *         Новый провайдер `anthropic` (группа `llm`) в provider_keys.ts с реальной
 *         кнопкой «Проверить» (бесплатный пинг GET https://api.anthropic.com/v1/models,
 *         headers x-api-key + anthropic-version). Хранится в той же таблице
 *         tenant_provider_keys (AES-256-GCM), доступен рендеру через
 *         getEffectiveProviderKey(tenantId, 'anthropic'). UI Section7OpenMontage:
 *         новая секция «ИИ-режиссёр (ЛЛМ)» над платными провайдерами — «мозг» умных
 *         шагов (ресёрч, выбор момента, сценарий, новости), модель по умолчанию
 *         Claude Opus 4.8. Базовый CPU-монтаж ключа не требует. Это фундамент:
 *         сами ✨ЛЛМ-узлы (director-сервис) — следующий шаг.
 * 1.1.5 — Точный маппинг инструментов OpenMontage в рендер-воркере (render-worker/main.py).
 *         По реальным input_schema (сверены из репо calesthio/OpenMontage): video_trimmer
 *         (operation=cut, start/end из диапазона/длительности), auto_reframe (target_aspect),
 *         silence_cutter (mode remove/speed_up), subtitle_gen как композит
 *         transcriber→subtitle_gen→video_compose(burn_subtitles), audio_mixer (segmented_music),
 *         tts→piper_tts→video_compose(encode audio), video_compose (encode export). Выход
 *         читается из ToolResult.artifacts. news/research/broll/avatar/upscale → корректный
 *         passthrough. Простая цепочка (Формат+Экспорт) должна давать ролик без калибровки.
 * 1.1.4 — Выбор исходного видео для рендера. Центральный узел «Видео из галереи»
 *         в MontageEditor теперь кликабелен → пикер (скачанные тренды + видео-референсы
 *         Галереи). Источник сохраняется в flows.graph.source (FlowGraph.source +
 *         parseGraph) и передаётся в «Собрать» как inputUrl (createRenderJob берёт явный
 *         inputUrl, иначе graph.source.url). Без источника шаги идут passthrough.
 * 1.1.3 — Рендер «Собрать» подключён к OpenMontage. (1) Python FastAPI-воркер
 *         render-worker/ (на рендер-VPS): registry.get(tool).execute(inputs), вход/выход
 *         через /uploads, слушает только Tailscale; install.sh = systemd-сервис. (2) Реальный
 *         executor_http.ts вместо симуляции: CPU-шаги → RENDER_WORKER_URL, GPU → RENDER_GPU_WORKER_URL
 *         (с учётом getRenderGpuTarget); результат скачивается в uploads/renders. (3) worker.ts:
 *         готовый ролик регистрируется в Галерею (media_assets, kind=reference). (4) Кнопка
 *         «Собрать» в MontageEditor: сохранение → POST /api/render/flow/:id → поллинг прогресса
 *         с модалкой по шагам. Конфиг getRenderWorkerUrl/getRenderGpuWorkerUrl. Без RENDER_WORKER_URL
 *         — режим симуляции (конвейер работает, файла нет).
 * 1.1.2 — Enterprise: новая вкладка «Генерация» — BYO-ключи провайдеров OpenMontage
 *         (FAL, OpenAI, ElevenLabs, HeyGen, Runway, Suno, xAI, Doubao, Google +
 *         сток Pexels/Pixabay/Unsplash + HF), каждый с реальной кнопкой «Проверить»
 *         (пинг API провайдера). Единая таблица tenant_provider_keys (tenant_id
 *         VARCHAR(64), AES-256-GCM). Удалены вкладки «Подсказки» (Section2Prompt) и
 *         «CRM/Chatwoot» (Section4Chatwoot) + per-tenant CRM-эндпоинты — наследие
 *         VibeVox-омниканала, не нужны TrendTraffic. Глубокий Chatwoot-backend
 *         (омниканальный вебхук, crm-tasks) оставлен инактивным: он сцеплен с
 *         Quest Flow и чатом видео-комнат (их оставляем).
 * 1.3.7 — Дизайн-проход + чистки. (1) Вкладка «Тренды» переоформлена: сегмент-
 *         контрол «По ключевику / Горячее», поиск и кнопка в одну строку (на
 *         телефоне — стопкой), параметры (количество/тип/сортировка/период) в
 *         аккуратный ряд с одинаковой высотой, длинная справка свёрнута в
 *         «Чем отличаются типы поиска?». Карточки крупнее (2 кол. на телефоне,
 *         3/4 на десктопе), нижний скрим + просмотры поверх обложки, hover-lift +
 *         подсветка выбранной, плашки notice/error на фон. Обе темы + мобайл.
 *         (2) TrendFlow: подписи узлов (название + мелкая сводка выбранных
 *         параметров, центр «Видео из галереи», облачные Omni/Контент-план)
 *         получили НЕПРОЗРАЧНЫЙ фон под цвет холста — линии-связи больше НИКОГДА
 *         не перечёркивают текст. (3) Публикатор: убраны все упоминания
 *         «Ayrshare» (название интеграции не светим в UI) — тексты переписаны
 *         нейтрально, смысл сохранён.
 * 1.3.8 — Omni: лента преобразования видео (узел «Google Omni»). Клик по узлу →
 *         панель с превью исходника и таймлайн-лентой. Режимы: «Всё видео» /
 *         «Часть» / «2–3 вставки». Для каждого куска: движок «Сгенерировать (Omni,
 *         Veo 3.1, 4/6/8с, опц. кадр-старт)» или «Ре-стайл (V2V: Runway Gen-4 /
 *         Kling)», поле «как преобразовать», диапазон по ленте (ползунки начало/
 *         конец), сводка длины + ориентир стоимости. Спецификация сохраняется в
 *         graph.omni (бэкенд FlowGraph/parseGraph). Анализ лимитов Veo 3.1: 1 клип
 *         4/6/8с, удлинение до 148с (720p), V2V по произвольному видео Omni НЕ
 *         делает — для ре-стайла реального футажа используется Runway/Kling.
 *         Реальный вызов Veo/Runway и склейка в монтаж — следующий деплой.
 * 1.3.9 — Редактор TrendFlow — крупный UX-проход по блокам (по трём пожеланиям).
 *         (1) Медиа в узлах (Аудио/B-roll/Аватар/Цветокор/Озвучка): кроме выбора
 *         из Галереи — загрузка с устройства (телефон/ПК) и drag-and-drop прямо в
 *         окно; загруженное сразу попадает в Галерею и привязывается к узлу
 *         (POST /api/trends/media/upload). (2) Субтитры: добавлено поле пожеланий
 *         (шрифт, интервалы, обводка, цвет, тень). (3) Цветокор: поле описания
 *         цвета + LUT/референс с устройства. (4) Длина: визуальная нарезка по
 *         ленте (превью + ползунки С/По) → пишет диапазон m:ss–m:ss. (5) Экспорт:
 *         кнопки «Подключить <площадка>» + «Начать экспорт» с таймингом передачи.
 *         (6) «Собрать видео» — плавающая кнопка на холсте (правый низ), всегда под
 *         рукой; убрана из верхней панели. (7) Главный промт «Сценарий ролика» —
 *         кнопка в шапке → общий замысел ролика; сохраняется в graph.brief и
 *         прокидывается ИИ-режиссёру во ВСЕ ЛЛМ-шаги (research/news/voiceover).
 *         (8) Enterprise: вкладка/ключ «TikHub» → «Trend» (ссылка на tikhub.io).
 * 1.3.10 — Экспорт: кнопки «Подключить площадку» теперь переключают статус
 *         подключения (мок до этапа C) вместо выхода из редактора.
 * 1.3.11 — Enterprise → Trend: убрана внешняя ссылка на tikhub.io (не светим
 *         поставщика в UI), лид-текст нейтральный.
 * 1.4.0 — Тренды → «Аналитика по ссылке» (порт расширения TikHub Toolkit в веб).
 *         Вставляешь публичную ссылку на видео/пост или аккаунт (TikTok, Douyin,
 *         Instagram, X, Bilibili) → backend определяет платформу/тип и дёргает
 *         нужные эндпоинты TikHub НАШИМ ключом (analytics/fetch_video_metrics,
 *         fetch_comment_keywords, fetch_one_video, профиль, лента, комментарии —
 *         пути и параметры сверены с openapi.json). Показываем сводку (просмотры/
 *         лайки/комменты/шеры + engagement-rate), статусы вызовов и сырые данные
 *         с экспортом JSON. Backend: trends/analytics.ts + POST /api/trends/analyze.
 * 1.4.1 — «Аналитика по ссылке» — полный набор как в расширении: (1) нормализаторы
 *         по 5 платформам (список комментариев/постов/ключевых слов — оборонительно).
 *         (2) Экспорт CSV комментариев (BOM для Excel). (3) ИИ-анализ тональности
 *         комментариев (Claude: %позитив/нейтрал/негатив + темы + топ-цитаты),
 *         POST /api/trends/analyze/sentiment. (4) Облако слов + топ-комментарии по
 *         лайкам. (5) Скачивание самодостаточного HTML-отчёта (обзор, ER, облако
 *         слов, распределение лайков, топ-комментарии, тональность, брендинг TT).
 * 1.4.2 — Вайтлейбл: все ВИДИМЫЕ упоминания «TikHub» → «Trend» (подсказка аналитики,
 *         HTML-отчёт, тексты Enterprise/Trend, карточка в Админ → «Настройки
 *         системных API», тексты ошибок и проверки ключа на бэкенде). Поставщика
 *         в интерфейсе больше не светим. Внутренние имена/пути API не трогали.
 * 1.4.3 — Аналитика: кнопка «Аналитика» на каждой карточке тренда → видео сразу
 *         открывается во вкладке «Аналитика» и анализ запускается автоматически
 *         (initialUrl + авто-запуск). Результат больше НЕ «коды»: карточка поста/
 *         профиля (обложка, аватар, автор @handle ✓, подпись, хэштеги, музыка,
 *         длительность, дата, регион), метрик-плитки, чипсы ключевых слов, облако
 *         слов, тональность, топ-комментарии — оформлено как в расширении (адапт.
 *         под нашу тему). Сырые JSON свёрнуты в «Сырые данные» (по клику). Бэкенд:
 *         buildSummary достаёт обложку/аватар/музыку/дату/хэштеги (urlFrom/findUrl).
 * 1.4.4 — Аналитика: (1) обложка видео в карточке берётся с карточки тренда
 *         (грузится надёжно) → больше не пустая. (2) Убраны блоки «Сырые данные» —
 *         только визуал (карточка поста, метрики, ключевые слова, облако слов,
 *         тональность, топ-комментарии); при сбое источника — короткая заметка.
 *         (3) Кнопка «Скачать» в карточке → видео уходит в Галерею (no-watermark,
 *         POST /analyze/save). (4) Тренды: «Анализировать выбранные» рядом со
 *         «Скачать выбранные» → массовая сводка по выбранным → таблица-сравнение
 *         CSV (POST /analyze/bulk, 1 вызов на ссылку — дёшево).
 * 1.4.5 — Мультиисточник трендов: в «Поиск трендов» добавлен переключатель
 *         «Источник» с логотипами — TikTok / Instagram / YouTube / X / Reddit.
 *         Бэкенд: слой «провайдер на платформу» (tikhub/providers.ts) — у каждой
 *         площадки свои эндпоинты поиска и «горячего» (сверены с openapi.json) +
 *         оборонительный generic-нормализатор → общий вид карточки. У X нет ленты
 *         «Горячее» (только поиск) — таб отключается. TikTok-фильтры (тип/сорт/
 *         период) показываются только для TikTok. platform прокинут scan→провайдер,
 *         в БД пишется реальная площадка (trends/source_videos).
 * 1.4.6 — Расширенный поиск теперь не только у TikTok: по выбранной площадке
 *         показываются её фильтры — YouTube (сортировка / период загрузки /
 *         длительность), X (тип: Топ/Свежие/С медиа), Reddit (сортировка /
 *         период). Instagram-API фильтров не даёт — честно подписано. Фильтры
 *         прокинуты scan→провайдер (whitelist-параметры на бэке, providers.ts).
 * 1.4.7 — Мультиисточник, доработки. (1) Нормализаторы YouTube (innertube
 *         videoRenderer-дерево) и X (GraphQL legacy: обложки media_url_https,
 *         лайки/репосты/ответы, длительность из video_info) — отдельные функции;
 *         Reddit/Instagram-обложки через preview/images/candidates. Исправляет
 *         «YouTube ничего не нашёл» и пустые обложки/статистику/кривую длительность
 *         в X и Reddit. (2) Память по площадке: переключаешь источник — лента и
 *         ключевик восстанавливаются для неё. (3) Лента НАКАПЛИВАЕТ всё найденное
 *         (дедуп, новые сверху) + пагинация «Показать ещё».
 * 1.4.8 — Нормализаторы под РЕАЛЬНЫЕ форматы TikHub: X — плоский timeline[]
 *         (обложки/лайки/репосты/длительность), YouTube — и renderer-дерево
 *         (поиск), и плоский videos[] (тренды/«Горячее»), Reddit — need_format=true.
 *         YouTube: карточки 16:9 (Shorts — 9:16) + переключатель «Формат: Видео/
 *         Shorts» (get_shorts_search). «Анализировать выбранные» больше НЕ скачивает
 *         CSV — открывает «Аналитику» и показывает выбранные списком со сводкой,
 *         «Подробно» → полная аналитика, «← К списку».
 * 1.4.9 — (1) Аналитика по ссылке теперь понимает YouTube и Reddit (раньше —
 *         только TikTok/Douyin/IG/X/Bilibili), поэтому «Подробно» и «Анализировать
 *         выбранные» по YouTube/Reddit больше не «не распознано»: get_video_info/
 *         get_video_comments (YT), fetch_post_details/comments (Reddit), профили/
 *         ленты. (2) YouTube Shorts: разбор нового рендера shortsLockupViewModel —
 *         «Горячее»/Shorts больше не пустые.
 * 1.5.0 — Диагностика разбора: и аналитика (по блокам video/account/comments),
 *         и поиск трендов (при 0 распознанных) возвращают СКЕЛЕТ структуры ответа
 *         площадки (имена полей + типы, без значений) — раскрывашка «🔧 Структура
 *         ответа». По нему точно настраиваются нормализаторы вместо угадывания
 *         имён полей. backend: shapeOf() в trends/analytics.ts.
 * 1.5.1 — Разбор полей усилен: buildSummary понимает Reddit (score/ups→лайки,
 *         num_comments→комменты, author, selftext), глубина поиска 7→11. Reddit-
 *         карточки получают ссылку (webUrl из id) → появляется кнопка «Аналитика».
 *         Бэкенд логирует скелет ответа ([TREND_SHAPE]) для точечной донастройки.
 * 1.5.2 — Новая вкладка «Social Media Extension» (только Enterprise/superadmin):
 *         рехостинг открытого TikHub-расширения один-в-один внутри iframe — его
 *         собственные sidepanel+background в /social-ext/, мост chrome-polyfill.js
 *         (chrome.*→web + fetch на api.tikhub.io переписывается на наш прокси с JWT
 *         приложения). Backend: /api/social-ext/proxy (TikHub API) + /api/social-ext/media
 *         (скачивание с CDN), оба JWT+rate-limit+Enterprise, ключ TikHub подставляется
 *         на сервере (в браузер не попадает). URL для анализа вводится в строке (в вебе
 *         нет «активного таба»). Роут /social-extension, пункт меню после «Тренды».
 * 1.5.3 — «Social Media Extension» = две секции (как «Тренды»): (1) «Поиск горячих
 *         видео» — переиспользуемый TrendSearch (вынесен из TrendsPage; Reddit убран,
 *         X оставлен); (2) «Аналитика» — расширение в iframe. Клик «Аналитика» на
 *         карточке (или «Анализировать выбранные» массово → чипы) ведёт во вкладку
 *         аналитики и скармливает ссылку расширению. AI-функции расширения (промпт
 *         из обложки, разборы) идут через новый ai-прокси на ключе Enterprise
 *         (модалка «Конфигурация ИИ»: облако или свой ключ). Обложки/скачивание —
 *         через медиа-прокси (Referer на сервере). options.html удалён (дублировал).
 * 1.5.4 — Доработки «Social Media Extension» по фидбэку: лента трендов 6 в ряд +
 *         кнопка «Удалить» рядом с «Выбрать всё»; в аналитике скрыта верхняя
 *         панель расширения (логотип/кэш/язык/шестерёнка), вкладки Info/Comments/
 *         Analysis липкие, блоки Metrics и Fake Views Detection перенесены сразу
 *         после Music (custom.js в iframe). AI-разборы (Viral/Video) теперь реально
 *         работают: засев ai.apiKeys.gemini/geminiVideoKey + ai-прокси с ключом
 *         Gemini из учётки Enterprise (фолбэк на платформенный). «Конфигурация ИИ»
 *         убрана, вместо неё «Добавить в галерею» (POST /api/social-ext/to-gallery).
 * 1.5.5 — «Тренды» консолидированы: старый пункт меню «Тренды» убран, вкладка
 *         расширения переименована в «Тренды» (иконка TrendingUp), маршрут по
 *         тарифу (Enterprise → /social-extension, остальные → /trends). В самой
 *         вкладке убрана внутренняя шапка. В «Аналитике» вместо экрана расширения
 *         «Open a supported platform» — плитка недавних видео (клик → анализ).
 *         Фикс «Анализ видеоконтента» 413 Payload Too Large: ai-прокси смонтирован
 *         с json-лимитом 64mb (видео уходит inline base64 в Gemini). Убран
 *         невалидный allow="downloads" у iframe (лишний warning в консоли).
 */

/* 1.5.6 — Правки трендов по фидбэку: удаление через внутреннюю модалку (не браузерный
 *         confirm), удаление теперь надёжно (deleteVideo: SELECT file_path и DELETE
 *         разделены — сбой чтения больше не отменяет удаление) + UI после удаления
 *         перечитывает список с сервера (источник истины, без «воскрешения»). На
 *         карточках: кнопка «Аналитика» только иконкой + иконка удаления одного видео.
 *         Скачивание стало ФОНОВЫМ (продолжается, даже если уйти со страницы) и
 *         попадает в Галерею (media_assets); можно отменить (X на индикаторе). Лента
 *         вкладок Info/Comments/Analysis закреплена жёстче (sticky !important). */

/* 1.5.7 — Глобальный редизайн «1:1 с панелью аналитики»: дизайн-система переведена на
 *         палитру Geist/панели — шрифт Geist Sans (+ Geist Mono), светлая (#F9FAFB фон /
 *         #FFFFFF карточки / #E2E8F0 бордер) и тёмная (#0E0E0D / #1A1A18 / #2A2A27) темы,
 *         primary = почти-чёрный/почти-белый, бренд-акцент сменён с оранжевого на индиго
 *         (var(--brand): #6366F1 / #818CF8). Перепрошиты токены и общие классы index.css
 *         (.aurora-card, .btn-*, .aurora-input, focus-ring, скроллбар, .tab-fab и др.),
 *         добавлен .btn-accent. Зачищено 221 хардкод-цвет в ~35 файлах (ретрированный
 *         оранжевый + легаси сине-фиолетовый акцент → var(--brand)); категориальные
 *         тир-цвета, статусы, платформенные бренд-цвета и графики сохранены. Экран звонка
 *         (RoomPage) намеренно не тронут. */

/* 1.5.8 — Контраст активных кнопок: подсвеченные переключатели и акцентные кнопки больше не
 *         моно-белые/чёрные. Счётчик 10/20/30 и кнопка скачивания в «Трендах», сегменты
 *         субтитров и длины, «+/×»-кнопка холста, «Готово»/«Сохранить сценарий»/«Сохранить
 *         преобразование»/«Начать экспорт»/«Скачать видео» в TrendFlow, табы секций, GPU-
 *         таргет в админке и «Скачать в Галерею» переведены с моно-primary (--btn-primary-bg)
 *         на брендовый индиго (var(--brand)/--brand-contrast, как .btn-accent) — одинаково
 *         красиво и читаемо в светлой и тёмной темах. */
/* 1.5.9 — Доработки «Тренды» (Social Ext): (1) X/Twitter — анализ X ведётся в нашей
 *         нативной панели (TrendAnalyticsPanel, проп hideSearch), а не в iframe-расширении
 *         (оно требует обложку и падает «Ошибкой» на твитах); в normalizeTwitter добавлены
 *         фолбэки обложек (медиа + аватар автора для текстовых твитов) и лайков/просмотров.
 *         (2) Music: «Скачать музыку» реально скачивает трек НА УСТРОЙСТВО (бэкенд
 *         /api/social-ext/music action=download стримит audio как attachment + заголовок
 *         X-Music-Url), «Перейти к музыке» → «Скачать и посмотреть» (скачать + открыть).
 *         (3) Лента вкладок Info/Comments/Analysis закреплена жёстче (z-index 40).
 *         (4) Галерея: новая папка «Из анализа» — видео, сохранённые из аналитики
 *         (media_assets.folder='analyzed'), больше не смешиваются с «Референс». */

/* 1.5.10 — «Тренды», правки по фидбэку: (1) YouTube «Формат» (Видео/Shorts) — сегмент-
 *         кнопки вместо выпадашки (фильтры с ≤2 вариантами); (2) строка вкладок
 *         «Поиск горячих видео / Аналитика» убрана из самого верха: в режиме «Поиск» она
 *         под карточкой фильтров (перед лентой видео), в «Аналитике» — над строкой URL.
 *         Реализовано слотом sectionTabs у TrendSearch + общий renderTabs() в
 *         SocialExtensionPage (одна разметка вкладок на оба режима). */
/* 1.5.11 — Удалена старая страница /trends (TrendsPage): «Тренды» у всех ведут на
 *         /social-extension. Роут /trends и его пункты меню (MainLayout, BottomTabBar)
 *         убраны, файл TrendsPage.tsx удалён. RequireEnterprise для не-Enterprise теперь
 *         редиректит на /billing (Тарифы) вместо /trends (иначе была бы петля, т.к.
 *         HOME_ROUTE_WHEN_NO_VIDEO=/social-extension). */
/* 1.5.12 — Галерея переделана «1:1 с разделом Тренды (social-extension)»: сегмент-вкладки
 *         папок с индиго-заливкой активной (вместо зелёных bottom-border табов), плотная
 *         сетка карточек до 6 в ряд с обложкой+оверлеями (чекбокс, просмотры, длительность),
 *         hover-lift + ring выбранной, тулбар «Найдено · Выбрать всё · Удалить · Скачать
 *         выбранные». На карточке кнопки: открыть оригинал/файл, удалить, скачать на
 *         устройство (индиго). Логика (папки, загрузка, поиск, выбор, удаление) сохранена. */

/* 1.5.13 — Новый раздел «Каналы» (отдельный пункт меню /channels, Enterprise): вставляешь
 *         ссылку на канал (TikTok/Instagram/YouTube) → backend тянет профиль и ВСЕ видео
 *         канала постранично (новый channels-модуль: пагинация по курсору с оборонительным
 *         распознаванием + cost-cap + graceful fallback на первую страницу), показываем
 *         шапку канала, агрегаты (видео/просмотры/лайки/комменты/ER) и ленту видео.
 *         Фаза 1 (on-demand, без истории). Фаза 2 — watchlist + ночные снимки + дельты. */

/* 1.5.14 — «Каналы» Фаза 2: история метрик + дельты «было→стало». Отслеживаемые каналы
 *         (watchlist): кнопка «Отслеживать» добавляет канал, метрики авто-обновляются раз
 *         в сутки (планировщик startChannelSnapshotScheduler, тик/час, порог 20ч) + кнопка
 *         «Обновить сейчас». При обновлении текущие метрики канала и каждого видео сдвигаются
 *         в prev_* и пишется снимок дня (новые таблицы watched_channels / channel_videos /
 *         channel_metric_snapshots / video_metric_snapshots). Рядом с цифрами — дельта
 *         (зелёным рост / красным спад). Детали канала — лента видео с дельтами по каждому
 *         показателю. «Разовый разбор» (Фаза 1) сохранён + кнопка «Отслеживать» из него.
 *         Эндпоинты /api/channels/watch[/:id[/refresh]] (CRUD + ручное обновление). Дельты
 *         появляются со 2-го снимка (1-й — база; историю копим только с момента старта). */

/* 1.5.15 — Тренды → Аналитика (рехостнутое расширение), вкладка Info: кнопку «Download
 *         video» перехватываем и качаем БЕЗ водяного знака через бэкенд (App V3 play_addr,
 *         новый POST /api/social-ext/download). В строку скачивания добавлена кнопка
 *         «Скачать аудио». В разделе Music — одна кнопка «Скачать» (аудио-дорожка на
 *         устройство; «Скачать музыку»/«Скачать и посмотреть» убраны). «Cover variants»
 *         перенесён ПЕРЕД блоком скачивания, «Metrics» (+«Fake Views Detection») — сразу
 *         ПОСЛЕ него (правки в public/social-ext/custom.js + SocialExtensionPage). */

/* 1.5.16 — «Каналы»: карточки видео — один-в-один с «Трендами» (social-extension),
 *         соотношение сторон зависит от площадки/типа: YouTube-ролики горизонтальные 16:9,
 *         YouTube Shorts (вертикаль ≤60с) и TikTok/Instagram — 9:16 (helper cardAspect по
 *         platform+durationSec). Раньше все карточки были жёстко 9:16 → YouTube обрезался. */

/* 1.5.17 — «Каналы»: (1) обложки/аватары TikTok и Instagram теперь видны — подписанные
 *         CDN-ссылки браузер блокировал при прямой <img>-загрузке, гоним их через бэкенд-
 *         прокси /api/channels/cover (белый список CDN-хостов + нужный Referer, публичный,
 *         rate-limit). (2) Лента «Каналов» расширена на всю ширину (как «Тренды»): /channels
 *         сделан full-bleed в MainLayout, контейнер до 1760px, до 7 карточек в ряд на широких
 *         экранах. */

/* 1.5.18 — «Каналы»: TikTok-обложки реально видны. Static cover/origin_cover у TikTok
 *         приходят в HEIC (Chrome/Yandex не рендерят <img>), а формат залочен подписью
 *         URL (rewrite на .jpeg → 403). Решение: для TikTok берём dynamic_cover (jpeg) и
 *         гоним через cover-прокси. */

/* 1.5.19 — «Каналы», правки по фидбэку: (1) Instagram больше не падает —
 *         «invalid input syntax for type integer» (IG отдавал дробную длительность 70.008…);
 *         все числа приводятся к целому на границе БД (хелпер I()). (2) YouTube: появились
 *         просмотры по видео — нормализатор читал view_count, а поле зовётся number_of_views
 *         (+ длительность video_length). (3) YouTube Shorts: тянем отдельным списком
 *         (get_channel_short_videos), помечаем isShort (новая колонка channel_videos.is_short)
 *         — в ленте канала появился переключатель «Видео / Shorts». Лайки/комменты по видео
 *         YouTube в списке канала не отдаёт (ограничение API) — показываем просмотры. */

/* 1.5.20 — «Каналы»: YouTube Shorts наполняются корректно (раньше отбрасывались дедупом —
 *         get_channel_videos уже включает Shorts; теперь isShort ставится по членству в
 *         shortIds). Карточки Shorts вертикальные 9:16 (по флагу isShort, а не длительности —
 *         у Shorts её часто нет). */

/* 1.5.21 — Аналитика Instagram: кнопки «Скачать». Под галереей MEDIA — «Скачать медиа
 *         (макс. качество)»: качает ТЕКУЩИЙ элемент карусели (видео — video_versions,
 *         фото — image_versions2.candidates наибольшего размера); листаешь карусель →
 *         качается тот, что виден. В разделе AUDIO — «Скачать аудио» (оригинальный звук;
 *         лицензионный трек без файла → понятное сообщение). Прямые ссылки собирает новый
 *         POST /api/social-ext/ig-manifest (один вызов TikHub на пост, кэш по ссылке),
 *         стрим — через существующий медиа-прокси /api/social-ext/media. UI добавлен в
 *         custom.js (DOM-инъекция в рехостнутый бандл, секции MEDIA/AUDIO). */

/* 1.5.22 — «Каналы», правки по фидбэку: (1) у YouTube-видео скрыты лайки/комментарии
 *         (API их в списке канала не отдаёт) — остаются только просмотры. (2) Просмотры —
 *         точным числом с разделителями (38 000 000), без сокращения «1K». (3) Сортировка
 *         «Больше/Меньше просмотров». (4) Фильтр по периоду публикации: день/неделя/месяц/
 *         45 дней/всё время (для YouTube published_time «3 days ago» парсится в дату). */

/* 1.5.23 — Аналитика, правки по фидбэку: (1) Скачивание в Галерею теперь работает для
 *         X/Twitter (кнопка «Скачать» больше не падает «поддержано только для TikTok») —
 *         `/analyze/save` берёт лучший mp4-вариант твита (макс. битрейт, fetch_tweet_detail).
 *         (2) YouTube/Reddit-ссылки больше НЕ упираются в заглушку «Open a supported
 *         platform» расширения — ведём их в нашу нативную панель аналитики сразу (как X);
 *         iframe-расширение оставлено для TikTok/Douyin/Instagram/Bilibili. */

/* 1.5.24 — Аналитика YouTube: (1) метрики больше не пустые — нормализатор сводки
 *         (`buildSummary`) читал только TikTok-имена полей; добавлены YouTube-варианты
 *         number_of_views/likes/comments/subscribers, video_title, video_length,
 *         thumbnails (deepFind берёт первое совпадение → у других площадок без регрессий).
 *         (2) Кнопка «Скачать» в нативной панели теперь показывается только для TikTok/X
 *         (где скачивание в Галерею реально работает) — для YouTube/Reddit её нет, чтобы
 *         не упираться в ошибку «поддержано для TikTok и X». */
/* 1.5.25 — TrendFlow «ДНК тренда» (мост Аналитика→TrendFlow, Фазы 2–3): выбор
 *         проанализированного видео (папка «Из анализа», бейдж ✨) раскладывает анализ
 *         по блокам сценария + общий «Сценарий» (brief). Глубокий маппинг: тайм-коды
 *         сцен → реальный диапазон нарезки + тайминг B-roll; quality-метрики (LUFS/
 *         яркость/VQ/origin) → таргеты Аудио/Цвет + авто-апскейл 2× при <1080p; бенчмарк
 *         тренда (ER/лайки/сохранения) показывается как цель. Чип «Из тренда» в топбаре,
 *         панель подтверждения замены блоков. Бэкенд (Фаза 1) уже в проде: `video_analyses`,
 *         `POST /analyze/breakdown`, ДНК сохраняется к видео при «Добавить в галерею». */

/* 1.5.26 — Метрики YouTube в аналитике РЕАЛЬНО заполняются (сверено по живому ответу
 *         TikHub get_video_info): числовые view_count/like_count приходят ПУСТЫМИ, данные —
 *         в view_count_text/like_count_text («185,955次观看», «3585»). (1) deepFind теперь
 *         пропускает пустые строки (раньше '' считался «найдено» и обрывал поиск — поэтому
 *         просмотры/лайки были «—», а comment_count «102» проходил). (2) В списки добавлены
 *         view_count_text/like_count_text (short_view_count НЕ берём — сокращён «18万»→18).
 *         NB: часть видео TikHub отдаёт пустым стабом (нефетчабельны) — тогда метрик нет, это
 *         ограничение TikHub. Скачивание YouTube недоступно: get_video_info?need_format=true
 *         не возвращает ссылок на потоки (0 format/googlevideo URL). */

/* 1.5.27 — Скачивание YouTube в Галерею РАБОТАЕТ (до 1080p). Путь сверен по живому API:
 *         get_video_streams_v2 даёт форматы, но сырые url IP-привязаны к TikHub (403 у нас);
 *         get_signed_stream_url по itag отдаёт ссылку, качаемую с нашего IP. Берём лучший
 *         H.264-видео ≤1080p + AAC-аудио (раздельные потоки) и склеиваем ffmpeg -c copy
 *         (на web-VPS есть ffmpeg 6.1); фолбэк — прогрессивный mp4 одним файлом (~360p).
 *         Подключено к «Скачать» (/trends/analyze/save) и «Добавить в галерею»
 *         (/social-ext/to-gallery, заодно +X/Twitter и фикс fileUrl→mediaUrl). Кнопка
 *         «Скачать» снова видна для YouTube. NB: длинные видео крупные — могут упереться
 *         в таймаут nginx, но ассет дозапишется и появится в Галерее после обновления.
 *         Защита (по адверсариал-ревью): потолок 700МБ на поток (Content-Length + счётчик
 *         байт, обрыв+чистка), лимит 3 параллельных склейки (503 при перегрузе), реальная
 *         причина сбоя вместо общей ошибки, ffmpeg по FFMPEG_PATH, подпись через
 *         withTikhubRetry, чистка недокачанных файлов при обрыве. */

/* 1.5.28 — Ребрендинг VibeVox → TrendTraffic (визуал). (1) Новый фавикон (Content/falicon.png)
 *         во всех размерах: favicon-16/32, apple-touch-180, icon-192/512, maskable-192/512,
 *         favicon.png, vibevox-icon.png (maskable/apple-touch на белом фоне — iOS/Android не
 *         поддерживают прозрачность). (2) Логотипы: тёмная тема vibevox-logo-dark.png ← «LOGO
 *         SMART VIDE MARKETING DARK», светлая vibevox-logo-light.png ← «LOGO SMART VIDE
 *         MARKETING» (ужаты до 420×120); публичная шапка vibevox-logo.png — тёмный вариант.
 *         (3) Брендовые PNG-иконки разделов в сайдбаре (MainLayout) и мобильном меню
 *         (BottomTabBar): Тренды/Галерея/Публикатор/TrendFlow/Каналы → /icons/nav-*.png.
 *         (4) Раздел «Тренды» (SocialExtensionPage) получил заголовок «иконка + название +
 *         строка-пояснение», как у других разделов. (5) PWA-баннер: имя «TrendTraffic — Умный
 *         видео маркетинг» + текст «Сканируют тренды в соцсетях…» (ru/common.json pwaInstall +
 *         manifest.json name/short_name/description); иконка баннера = новый фавикон. */

/* 1.5.29 — Доводка ребрендинга. (1) Логотип в сайдбаре больше не зажат справа
 *         контролами: в развёрнутом режиме лого вынесено на ОТДЕЛЬНУЮ строку (на всю
 *         ширину), под ним — строка язык/тема/сворачивание; высота лого 30→44.
 *         Логотипы перегенерированы 420×120 → 700×200 (чёткость при увеличении +
 *         retina). Мобильная шапка 26→30. (2) Брендовые PNG-иконки разделов теперь
 *         и в ШАПКЕ каждой страницы (как у «Трендов»): Галерея/Публикатор/TrendFlow/
 *         Каналы/Тренды — градиентный бокс с lucide заменён на /icons/nav-*.png
 *         (objectFit contain). Убраны ставшие неиспользуемыми импорты Send/Workflow/
 *         TrendingUp. */

/* 1.5.30 — Иконки навигации: брендовые PNG (/icons/nav-*.png) оставлены ТОЛЬКО в шапках
 *         разделов; боковые иконки сайдбара (MainLayout) и мобильного меню (BottomTabBar)
 *         возвращены на стандартные lucide (TrendingUp/Image/Send/Workflow/Users) — как
 *         было до ребрендинга. Текст PWA-баннера заменён: «Автоматический поиск и
 *         публикация вирусных видео из соцсетей. Генерируйте массовые просмотры, используя
 *         чужой популярный контент.» (ru/common.json pwaInstall.description/installCta +
 *         manifest.json description). Имя баннера без изменений. */

/* 1.5.31 — «Тренды», правки по фидбэку: (1) на карточках поиска лайки/комменты/шеры
 *         показываем только если есть значение — у YouTube их нет в списке, иконки с «—»
 *         убраны (TrendSearch). (2) Поиск YouTube «Видео» больше НЕ подмешивает Shorts:
 *         get_general_search отдаёт их вместе с видео (reelItemRenderer/shortsLockupViewModel)
 *         — помечаем isShort в normalizeYoutube и фильтруем в scanTrends при yt_kind != shorts.
 *         Это же чинило «анализируется не тот ролик» (выбор сбивался подмешанными шортами). */

/* 1.5.32 — Редизайн кнопок-источников в «Трендах» (TrendSearch): сплошные брендовые
 *         круги (чёрный/градиент/красный) выбивались из indigo/light-стиля. Стало:
 *         брендовый глиф (currentColor) в мягком тонированном «app-icon» чипе
 *         (rounded-[9px], tint-фон) + indigo-выделение активной пилюли (как у вкладок).
 *         TikTok/X монохромны (var(--text-primary) на --bg-elevated), Instagram #E1306C,
 *         YouTube #FF0000 на лёгкой подложке; SVG переведены на currentColor, у YouTube —
 *         нормальный логотип (скруг. прямоугольник + play вместо голого треугольника). */

/* 1.5.33 — YouTube: аналитика и скачивание ОТКЛЮЧЕНЫ (решение по фидбэку — подпись
 *         потоков TikHub `get_signed_stream_url` ненадёжна, падает на части видео).
 *         YouTube остаётся ТОЛЬКО для поиска трендов. При попытке анализа/скачивания —
 *         сообщение «Анализ YouTube недоступен — YouTube доступен только для поиска
 *         трендов». Гарды: фронт TrendAnalyticsPanel.analyze (без вызова бэка) + бэк
 *         /trends/analyze, /analyze/bulk (строка-ошибка на YT, без вызова TikHub),
 *         /analyze/save, /videos/:id/download, /social-ext/to-gallery → «Скачивание
 *         YouTube недоступно». Кнопка «Скачать» в панели снова только tiktok/twitter. */

/* 1.5.34 — Тарифы переделаны под TrendTraffic: ДВА тарифа вместо трёх легаси VibeVox.
 *         Премиум (€120/мес, Stripe) — полный доступ ко ВСЕМ функциям; Энтерпрайз
 *         (по запросу) — то же + индивидуальная настройка и ведение соцсетей «под ключ».
 *         Функции идентичны: новый тариф `premium` в FULL_ACCESS_TIERS (feature_gate) +
 *         расширены все прямые проверки (checkout/usage/rooms/assistant/insights/admin) +
 *         фронт useIsEnterprise/store. BillingPage переписана (реальные функции, блок
 *         «генерация через подключённые API», FAQ), удалено легаси (языки, докупка минут,
 *         баланс минут в сайдбаре). Адверсариал-ревью → 6 правок, в т.ч. КРИТ: миграция
 *         CHECK subscriptions.tier += 'premium' (иначе оплата Премиума падала бы), sentinel
 *         реф-минут для безлимита, SettingsPage-лейбл, promo-маппинг premium, aria-label.
 *         NB ДЕПЛОЙ: после выката запустить синк тарифов Stripe (создаёт vibevox_premium_eur). */

/* 1.5.35 — Тренды (Instagram) + Аналитика «Quality variants», по фидбэку: (1) на карточке
 *         Instagram убрано «мусорное» число — это была длительность видео, которую IG отдаёт
 *         дробными секундами («0:32.972…»); dur() теперь округляет → чистое «0:33» (фикс и
 *         визуального наложения на счётчик просмотров). (2) Чекбокс выбора теперь на КАЖДОЙ
 *         карточке: ключ выбора keyOf() = БД-id, а для несохранённых (Instagram) — externalId;
 *         массовая аналитика работает по webUrl. Скачивание/удаление по-прежнему требуют БД-id.
 *         (3) В разделе «Quality variants» (рехостнутое расширение, IG/X) сам длинный URL и
 *         нативная «копировать» скрыты, вместо них тройка кнопок: открыть по ссылке · скачать
 *         (стрим через /api/social-ext/media) · скопировать ссылку. Реализация — custom.js
 *         (DOM-инъекция) + новый postMessage social-ext:media-url в SocialExtensionPage. */

/* 1.5.36 — Тарифы, правки по фидбэку: (1) иконки в карточках Premium/Enterprise приведены
 *         к ОДНОМУ стилю (убран цветной highlight у «strong»-строк — все muted). (2) Названия
 *         тарифов НЕ переводятся — «Premium»/«Enterprise» на английском на всех языках
 *         (BillingPage, сайдбар MainLayout, SettingsPage; больше не через t('tier.*')).
 *         (3) Premium: добавлена строка про бесплатные API (Pexels, Pixabay, Unsplash,
 *         HuggingFace) + в строку генерации дописаны провайдеры (Anthropic Claude, FAL.ai,
 *         OpenAI, ElevenLabs, HeyGen и др.). (4) Enterprise: добавлено «Подключение ваших API
 *         для генерации (платные и бесплатные)». */
/* 1.5.37 — Ребрендинг вкладки браузера VibeVox → TrendTraffic: (1) заголовок и мета —
 *         SeoMeta теперь отдаёт фиксированный «TrendTraffic — умный видео-маркетинг» на
 *         ВСЕХ языках (раньше брал i18n seo.* = легаси VibeVox-перевод в 108 локалях);
 *         index.html static <title>/og/twitter/JSON-LD/author → TrendTraffic. (2) Фавиконы
 *         перегенерированы из Content/falicon.png (favicon-16/32, favicon.png корневой —
 *         он оставался старым VibeVox-значком! — apple-touch на белом, vibevox-icon.png) +
 *         cache-bust ?v=tt2 в index.html. (3) Заголовки публичных Landing/Legal → TrendTraffic. */
/* 1.5.38 — TrendFlow: подкаст-сцена (2 ведущих, сплит-скрин). Облачный узел «Подкаст»
 *         в MontageEditor: два ведущих (фото→аватар), сплит-скрин (A слева, B справа) с
 *         картинкой между ними, две голосовые дорожки. Источник дорожек — генерация диалога
 *         (Claude + Piper TTS на 2 голоса) или разбор готовой записи на 2 спикера (pyannote
 *         3.1 через HF при наличии ключа, иначе разбивка по паузам — реальный голос режется
 *         по таймкодам). Воркер podcast_compose собирает сплит-скрин 1080×1920 через ffmpeg
 *         (talking_head/SadTalker на GPU либо статичные фото), картинка overlay/topbar, склейка
 *         сегментов; результат → Галерея. Бэкенд: MKind podcast, /api/render/podcast/*. */
/* 1.5.39 — Подкаст, Фаза 1 «Студия лиц»: вместо двух слотов фото — одно общее фото
 *         ведущих. Детекция лиц (браузерный FaceDetector, если доступен) ИЛИ ручная
 *         обводка рамкой (до 4), назначение спикерам A/B. «Сделать кадры» — canvas-кроп
 *         крупных планов ведущих (→ фото A/B) + общий план в картинки-вставки. Чистый
 *         фронт; кормит существующий podcast_compose (сплит-скрин). Дальше — таймлайн
 *         голосов и cloud-аватары (lip-sync). */
/* 1.5.40 — Платный гейт + 7-дн триал + защита от затрат + чистка тарифов в админке.
 *         ГЕЙТ: RequirePaid (router.tsx) — неоплаченному открыты только /billing и /settings,
 *         остальное → /billing; флаг billingLoaded + refreshBilling при восстановлении сессии
 *         (анти-deadlock на перезагрузке). ТРИАЛ: кнопка «7 дней бесплатно» на Premium, /checkout
 *         trial_period_days=7 + payment_method_collection:'always' + trial_settings cancel; webhook
 *         триал-aware (не платит рефералке/статистике). НОЛЬ ЗАТРАТ в триал: trends-API 402 для
 *         неоплаченных, resolveAnthropicKey full-access→null, закрыты 5 утечек платформенного ключа
 *         в social-ext (proxy/ai-proxy/music/download/ig-manifest). АДМИНКА: «Сменить тариф» — только
 *         Premium / Enterprise + «Без тарифа» (revoke→status=canceled, НЕ inactive — его нет в CHECK);
 *         промокоды — Premium + «На все тарифы»; легаси VibeVox убраны. ГЕЙТ=ЗЕРКАЛО БЭКА:
 *         useIsEnterprise требует status∈{active,trialing}. STRIPE-ОПЕРАЦИИ: sync создаёт только
 *         Premium и показывает реальную ошибку Stripe (не «Internal server error»); страница промокодов
 *         не блокируется при неподключённом Stripe (мягкое уведомление, форма доступна). */
/* 1.5.41 — Подкаст, Фаза 1 доведена: (1) только ДВА персонажа, роли A/B взаимоисключающие
 *         (назначил A — второй автоматически B). (2) Надёжное распознавание лиц — MediaPipe
 *         (CDN) с фолбэком на браузерный FaceDetector → ручную обводку; берём 2 крупнейших,
 *         слева→направо = A,B. (3) Панель очищена от старого (убраны «картинки между ведущими»,
 *         раскладка, превью). (4) НОВОЕ: картинка к фразе — у каждой реплики кнопка 🖼, картинка
 *         «выезжает» в этот момент; выбор анимации (слева/справа/снизу/зум/проявление/авто).
 *         Воркер рендерит картинку на сегменте реплики с анимацией (ffmpeg overlay). */
/* 1.5.42 — Подкаст, фиксы по фидбэку: (1) авто-перезагрузка при устаревшем lazy-чанке
 *         после деплоя (RouteErrorElement) — больше нет белого экрана «Что-то пошло не так».
 *         (2) Удаление группового фото и кадров ведущих. (3) Кнопка «Собрать подкаст»
 *         дизейблится с подсказкой, чего не хватает (вместо ошибки). (4) Плавающая пилюля
 *         прогресса пульсирует по готовности (видно «мигание»). */
/* 1.5.43 — Вход/регистрация: фикс «зависшего спиннера» после входа через Google + чистка UI.
 *         (1) КОРЕНЬ ЗАВИСАНИЯ — deadlock гейта оплаты: после входа navigate('/') показывал
 *         PaidGateLoader, пока не загружен статус тарифа (billingLoaded), а обновлял его только
 *         MainLayout, который сам за гейтом → спиннер крутился вечно. Фикс: refreshBilling()
 *         теперь вызывается до перехода во всех точках входа (Login/Register/GoogleCallback),
 *         плюс самолечение в RequirePaid (router.tsx, уехало в 1.5.42). (2) Убраны подписи
 *         «Войдите в аккаунт VibeVox» и «Бесплатная регистрация на VibeVox». (3) Логотип на
 *         auth-страницах: пропорции жёстко зафиксированы (aspect-ratio 700/200 + object-fit),
 *         высота 48→60 — больше не «сплющен». (4) Кнопка Google (вход и регистрация) — белая по
 *         гайдлайну Google Sign-In (.btn-google) вместо прозрачной btn-ghost, которая терялась
 *         на тёмной карточке. (5) Захардкоженный фолбэк Google Client ID обновлён на актуальный
 *         (813706901561-…, был устаревший 806003116741-…). */
/* 1.5.44 — Подкаст, фикс «fetch failed» на длинных записях: синхронный рендер не успевал
 *         за таймаут (whisper по всей записи + десятки сегментов). Теперь запись режется до
 *         180с и ≤40 реплик (MVP), склейка сегментов через stream-copy (быстро), таймаут
 *         запроса к воркеру поднят до 20 мин. Полная длина — позже через async-рендер. */
/* 1.5.45 — Подкаст: AI-ракурсы студии (Gemini Nano Banana Pro, gemini-3-pro-image,
 *         image-to-image). В студии лиц — поле своего промта + 6 кнопок ракурсов
 *         (←левее/правее→/↑сверху/↓снизу/сзади/крупнее): перерисовывают то же фото
 *         студии с теми же ведущими под другим видом камеры. Результат → Галерея,
 *         прикрепляется к фразам через 🖼. Бэкенд: POST /api/render/podcast/angle. */
/* 1.5.46 — Подкаст/редактор по фидбэку: (1) карандашик — инлайн-переименование сценария
 *         в редакторе (сохраняется). (2) AI-ракурсы: кнопка «Применить свой промт»
 *         (preset=custom — текст пользователя как основная инструкция); поле промта
 *         авто-растёт по тексту; убрано «(Gemini)»; добавлен ВВОД своей картинки с диска
 *         как базы для перерисовки. */
/* 1.5.47 — Подкаст/TrendFlow по фидбэку: (1) на обложках карточек сценариев —
 *         иконки-бейджи содержимого (подкаст/Omni/монтаж, по графу). (2) AI-ракурсы:
 *         своя картинка показывается миниатюрой «вход» в полосе ракурсов (убрано
 *         текст-имя файла), «своё фото» — кнопкой к ракурсам; вход применяется дальше. */
/* 1.5.48 — Подкаст, Фаза 2: ТАЙМЛАЙН с наложением голосов. Кнопка «Включить таймлайн»;
 *         две дорожки A/B, реплики-клипы по времени, перетаскивание по таймлайну (tStart),
 *         наложение клипов = перебивание. Сборка (pod.timeline) микширует дорожки в воркере
 *         (adelay по tStart + amix) поверх сплит-скрина на всю длину; картинки реплик —
 *         во время своего клипа. Смоук-тест микса на воркере пройден. */
/* 1.5.49 — Подкаст, таймлайн по фидбэку: (1) масштаб −/+ (зум шкалы). (2) ножницы ✂ —
 *         режут клип пополам на две реплики (к разрезу можно прикрепить картинку).
 *         (3) «Разобрать запись» авто-раскладывает клипы на реальные времена (tStart=start)
 *         и сразу включает таймлайн; диаризация дробная (клипы ≤7с, реальная смена реплик).
 *         (4) По завершении разбора на узле «Подкаст» — мигающий зелёный кружок. */
/* 1.5.50 — Редактор TrendFlow: Undo/Redo (Назад/Вперёд) — кнопки в шапке + Ctrl+Z /
 *         Ctrl+Shift+Z. История снимков «документа» (имя/бриф/узлы/подкаст/Omni/облака/
 *         источник), дебаунс 350мс, до 120 шагов; не мешает вводу в полях. */
/* 1.6.0 — Аналитика+TrendFlow: (1) АВТО-РАЗБОР вирусности в панели аналитики — после
 *         анализа видео в фоне дёргается /analyze/breakdown (без кнопки), показывается
 *         секция «Разбор вирусности (ИИ)» = Viral Breakdown + Контент-анализ (хук,
 *         аудитория, факторы, готовый скрипт озвучки, сцены, как повторить); пока не
 *         готово — крутилка, при ошибке (напр. нет ключа Claude) — понятное сообщение +
 *         «Пересобрать». Аккаунты пропускаются. (2) ПАКЕТНАЯ сборка TrendFlow (приехала в
 *         1.5.50): в пикере «Исходное видео» отметить N видео → по ролику на каждое через
 *         одну цепочку блоков (последовательная очередь рендера) + панель прогресса. */
/* 1.6.1 — Видео-редактор/просмотрщик (как LosslessCut, наш ffmpeg). (1) Единый компонент
 *         VideoViewer = плеер + обрезка: выделение IN/OUT (ручки на таймлайне), «Оставить»/
 *         «Вырезать» (нарезка из середины → автосклейка), поворот 90°, «Отменить» (история)
 *         и «Сброс»; lossless `-c copy`, сохранение НЕРАЗРУШАЮЩЕЕ — результат в Галерею.
 *         (2) Подключён в Галерее: клик по видео открывает просмотрщик. (3) Новое облако
 *         «Редактор» в TrendFlow-монтаже: выбрать видео из Галереи → открыть редактор;
 *         несколько роликов → «Склеить» (нормализация под общий кадр). Бэкенд:
 *         POST /api/video-edit (+ /merge) на ffmpeg-static, файлы → uploads/renders. */
/* 1.6.2 — Подкаст-таймлайн по фидбэку: (1) переливающийся контур узла «Подкаст» во время
 *         генерации/разбора. (2) Таймлайн поднят над списком реплик; список реплик свёрнут,
 *         открывается; клик по клипу подсвечивает и открывает реплику. (3) Линейка mm:ss +
 *         показ времени (бегунок/всего); жёлтый бегунок-плейхед — ведёшь и ✂ режет по нему
 *         (splitLineAt). (4) Зум −/+ и «вместить» (минимальный масштаб — всё на экране).
 *         (5) Воркер: клип без текста (после разреза) не отбрасывается; тайминг наложения
 *         подтверждён. NB: точное разделение 2 голосов — нужен pyannote (сейчас по паузам). */
/* 1.6.3 — Облако «Редактор»: пикер медиа перестал быть пустым + аудио. (1) Загрузчик
 *         галереи теперь тянет и папку «Из анализа» (folder=analyzed), и аудио (kind=audio),
 *         а не только downloaded-тренды + reference-видео — раньше проанализированные видео
 *         (лежат в analyzed) не показывались → «Видео не найдены». Дедуп по url. (2) АУДИО
 *         можно выбрать и обрезать: элементы аудио с иконкой/бейджем «АУДИО»; VideoViewer
 *         получил kind='audio' (без картинки/поворота, только обрезка/нарезка по дорожке);
 *         бэкенд /api/video-edit определяет аудио по расширению → выход .m4a (AAC), mediaType
 *         audio. Склейка осталась только для видео (аудио — по одному). */
/* 1.6.4 — Подкаст-таймлайн, батч по фидбэку: (1) контур узла во время генерации теперь
 *         ПЕРЕЛИВАЕТСЯ на месте (hue-rotate), а не крутится. (2) Кнопка ▶ Play в таймлайне —
 *         воспроизведение записи с жёлтого бегунка (плейхед едет, тянешь бегунок — перемотка).
 *         (3) Реплики можно ОБЪЕДИНИТЬ (кнопка «слить со следующей»); разрез ножницами уже даёт
 *         новую реплику. (4) К реплике можно привязать не только фото, но и ВИДЕО — пикер открывает
 *         всю галерею (+папка «Из анализа»), видео проигрывается на экране во время этой реплики
 *         (воркер: overlay видео с setpts, звук клипа — голос). (5) На мелком зуме клипы —
 *         чистые градиентные плашки без «некрасивых» подписей; бейдж ▶ на видео-клипах.
 *         (6) РАСПОЗНАВАНИЕ 2 ГОЛОСОВ переписано: бестокенная акустическая кластеризация
 *         (высота голоса F0 + тембр, numpy k-means) по ВСЕЙ записи — больше не «всё второму
 *         диктору после 15 секунд». pyannote (если есть HF-ключ) → кластеризация → паузы. */
/* 1.6.5 — Чистка админки суперадмина от мёртвого легаси видеоперевода/диалектов:
 *         (1) убран раздел «AI Learning Hub — Обучение диалектам» — пункт сайдбара (десктоп+моб),
 *         роут /admin/dialects, карточка-баннер в «Настройках API», удалены сиротские файлы
 *         DialectsPage.tsx и DialectPlayground.tsx. (2) Убрана карточка «LiveKit WebRTC Server»
 *         (URL/key/secret + тест) из «Настроек API». (3) Убрана карточка «Масштабирование
 *         видеоперевода» (лимит одновременных Gemini Live-сессий + Vertex AI + пул доп. Gemini-ключей).
 *         Всё это — заготовки эпохи VibeVox-видеоперевода, в TrendTraffic не используются. Вычищен
 *         связанный state/load/save/test-код и неиспользуемые импорты иконок. */
/* 1.6.6 — Доделан переливающийся контур узла «Подкаст» во время генерации: правка из 1.6.4
 *         была затёрта reset'ом общего рабочего дерева параллельной сессией и не попала в сборку.
 *         Теперь .me-busyring анимируется meShine (hue-rotate на месте) — цвета переливаются,
 *         кольцо НЕ крутится (как и просил пользователь). */
/* 1.6.7 — TrendFlow: пресеты сценария больше НЕ всплывают при открытии УЖЕ созданного
 *         сценария — только при создании нового. FlowPage прокидывает isNew (openedNew:
 *         true при «Создать сценарий», false при клике по карточке), MontageEditor
 *         показывает пикер пресетов только если сценарий пуст И isNew. */
/* 1.6.8 — Подкаст: КАЧЕСТВЕННОЕ распознавание 2 голосов + загрузка диалога. (1) «Разобрать
 *         на 2 голоса» теперь идёт через GEMINI (аудио-понимание тенант-ключом): реальная
 *         диаризация с подсказкой пола («Ведущий A — женщина, B — мужчина» из выбора голоса),
 *         возвращает {speaker,start,end,text}; фолбэк — воркер (акустика/pyannote/паузы).
 *         Чинит главную жалобу: неверное разделение речи двух дикторов. (2) Кнопка «Загрузить
 *         диалог»: вставить текст («A: … / B: …») или JSON [{speaker,text}], либо взять текст
 *         из блока «Исследование»/«Новости» сценария → парсер раскладывает на реплики A/B.
 *         Бэкенд: render/audio_diarize.ts (Files API + responseSchema), router /podcast/diarize
 *         (Gemini→воркер), FE шлёт hostAVoice/hostBVoice. */
/* 1.6.9 — Облако «Редактор»: пикер медиа теперь ПОВТОРЯЕТ Галерею. Вкладки-папки
 *         Тренды/Референс/Аудио/Из анализа (со счётчиками, авто-открытие первой непустой,
 *         приоритет «Из анализа») + поиск по имени + «Найдено: N». Карточки крупнее
 *         (сетка 3-в-ряд, квадратные превью с именем снизу, аудио — крупная иконка+бейдж
 *         «АУДИО»); панель «Редактора» расширена до 680px. Логика загрузки: элементы
 *         помечаются категорией (loadEditorGallery), фильтр по вкладке+поиску. */
/* 1.6.10 — Пикер «Редактора»: добавлены кнопки загрузки «Медиа» (видео/изображение →
 *         Референс) и «Аудио» — как на странице «Галерея» (тот же эндпоинт
 *         /api/trends/media/upload). После загрузки список перезагружается и
 *         открывается нужная вкладка. Теперь своё видео/аудио можно добавить в редактор,
 *         не уходя из сценария. */
/* 1.6.11 — Подкаст, батч по фидбэку: (1) контур генерации ПОД иконкой (z-index:-1, не
 *         перекрывает 🔗) и циклически «дышит» (mePulse scale) + переливается (meShine).
 *         (2) Таймлайн Play теперь МИКШИРУЕТ клипы через Web Audio: наложенные реплики
 *         (перебивание) звучат ОДНОВРЕМЕННО (каждый клип — свой отрезок записи в позиции
 *         tStart), а не по очереди — база для аниматора аватаров. (3) Пикер медиа подкаста
 *         повторяет Галерею: вкладки-папки (Тренды/Референс/Аудио/Из анализа) + поиск,
 *         тянет и скачанные тренды. (4) У «Загрузить диалог» — иконка ⓘ с инструкцией
 *         по формату (текст «A:/B:» и JSON) на наведении. */
/* 1.6.12 — Подкаст: аниматор ведущих (говорящие головы) — выбор провайдера. В панели
 *         селектор HeyGen (v3/4/5, премиум) / D-ID·Hedra (дешевле) / наш GPU·SadTalker
 *         (бесплатно) + оценка стоимости по суммарной длине диалога + кнопка «Анимировать
 *         ведущих». Бэкенд POST /podcast/animate валидирует выбранного провайдера вживую
 *         (ключ HeyGen через remaining_quota → остаток кредитов; GPU — наличие воркера) и
 *         возвращает готовность+смету. Сам рендер голов — фоновая генерация (следующий шаг,
 *         вынесен из-за таймаута прокси). spec.avatar={provider,heygenVersion}. */
/* 1.6.13 — Редактор видео/аудио (VideoViewer): (1) имя файла вверху РЕДАКТИРУЕМОЕ —
 *         карандаш → инлайн-инпут; новое имя идёт в сохранённый файл. (2) Кнопка
 *         «Сохранить» переехала ВВЕРХ (шапка, рядом со Скачать/Закрыть). (3) МУЛЬТИ-обрезка:
 *         «Отметить» добавляет текущее выделение как ещё один промежуток (красный на
 *         дорожке), можно сколько угодно; «Вырезать»/«Оставить» применяют ко ВСЕМ
 *         отмеченным сразу; двойной клик по красному — снять, «Отметки» — очистить.
 *         Нет отметок — работают по текущему выделению (как раньше). */
/* 1.6.14 — Редактор (VideoViewer): (1) СКРАБ — при перетаскивании ручек IN/OUT и по
 *         дорожке видео сверху перематывается на позицию (видно кадр, где именно режешь);
 *         на время скраба воспроизведение ставится на паузу. (2) Кнопка ЗВУК/без звука в
 *         транспорте (по умолчанию со звуком) — теперь слышно видео при воспроизведении. */
/* 1.6.15 — Подкаст, Фаза 2 аниматора: РЕАЛЬНЫЙ рендер говорящих голов через HeyGen.
 *         Кнопка «Анимировать ведущих» грузит фото каждого ведущего → talking_photo →
 *         video/generate (текст его реплик, голос по полу — есть русские, эмоция-пресет)
 *         → фронт опрашивает /podcast/animate/status до готовности, показывает превью
 *         двух голов (9:16, controls). HeyGen рендерит голову+плечи/жесты+мимику. Топ-
 *         пресеты подачи/эмоции (Дружелюбно/Уверенно/Восторженно/Спокойно/Серьёзно →
 *         эмоция голоса HeyGen). Бэкенд render/avatar.ts (upload/pickVoice/submit/status),
 *         /podcast/animate (submit) + /podcast/animate/status (poll). Проверено вживую на
 *         ключе тенанта (talking_photo→completed ~24с). D-ID/Hedra — пока без ключей.
 *         Дальше: реальный голос из записи (audio-driven) + склейка сплит-скрина. */
/* 1.6.16 — Монетизация TrendTraffic (сводно; детали — PROJECT_NOTES.md «## 5.У»).
 *         ПЛАТНЫЙ ГЕЙТ: RequirePaid — неоплаченному только /billing и /settings; billingLoaded +
 *         само-лечение (refreshBilling из гейта) против deadlock; useIsEnterprise теперь требует
 *         status∈{active,trialing} (зеркало feature_gate). 7-ДН ТРИАЛ: /checkout trial_period_days=7
 *         + payment_method_collection:always + trial_settings cancel; webhook не платит рефералке/
 *         статистике в триал. НОЛЬ ЗАТРАТ: trends 402, resolveAnthropicKey full-access→null, закрыты
 *         5 утечек платформенного ключа в social-ext (убран `getEffective*Key()||getPlatformKey()`).
 *         АДМИНКА: «Сменить тариф» → Premium/Enterprise/«Без тарифа» (revoke→status=canceled, НЕ
 *         inactive — CHECK его не допускает); промокоды → Premium+«На все тарифы»; удалён легаси
 *         видеоперевода/диалектов (AI Learning Hub, LiveKit, Масштабирование) и минутные столбцы.
 *         IMPERSONATION: «войти в аккаунт пользователя» (12ч-токен, кастомный ConfirmModal, баннер
 *         возврата в MainLayout). STRIPE: корень пустого ключа (жали «Проверить», не «Сохранить») +
 *         авто-сейв перед sync + sync только Premium + реальные ошибки. ОБЛОЖКИ ленты: cover-proxy +
 *         dynamic_cover (HEIC-фикс). Плавный ввод «Сколько видео». */
/* 1.6.17 — Аниматор ведущих, апгрейд: (1) убраны косметические v3/4/5 → реальный переключатель
 *         движка HeyGen: «Стандарт» / «Avatar IV» (use_avatar_iv_model — выразительнее жесты/мимика).
 *         (2) ВЫБОР ГОЛОСА: «Из записи (реальные)» — режем сегменты каждого ведущего из записи
 *         (ffmpeg atrim+concat → mp3 в uploads/renders) и отдаём HeyGen как audio_url (аудио-драйв,
 *         синхрон губ по реальному голосу); «HeyGen TTS» (текст, эмоция); «ElevenLabs» (TTS
 *         мультиязычным голосом → mp3 → audio_url). Suno — это музыка, не речь (примечание).
 *         Бэкенд: render/podcast_voice.ts (buildHostAudio/elevenTTS), avatar.submit (audioUrl+useIV),
 *         /podcast/animate (mode+voiceSource). Проверено вживую: audio_url и use_avatar_iv_model
 *         HeyGen принимает (video_id). Дальше: склейка сплит-скрина + сохранение в Галерею по порядку. */
/* 1.6.18 — Аниматор, финал HeyGen-конвейера: (1) СКЛЕЙКА СПЛИТ-СКРИНА — кнопка «Склеить
 *         сплит-скрин + музыка»: две головы бок-о-бок в 1080×1920 (ffmpeg hstack+letterbox),
 *         аудио = запись (если «Из записи», верный тайминг) или микс голов; фон-музыка на
 *         громкости, обрезается по длине. Идёт фоновой задачей (/podcast/compose + poll), результат
 *         → превью + Галерея. render/podcast_compose.ts (composeHeads/downloadToRenders). (2)
 *         СОХРАНЕНИЕ В ГАЛЕРЕЮ по порядку — готовые головы качаются с HeyGen → uploads/renders →
 *         createAsset (не по временной ссылке). (3) ФОНОВАЯ МУЗЫКА на весь ролик: загрузка/из
 *         галереи + слайдер громкости % + обрезка по длине. Suno-генерация музыки — следующим шагом. */
/* 1.6.19 — Фикс «пропадающих обложек трендов»: обложки TikTok/IG — подписанные CDN-ссылки,
 *         истекающие через часы-сутки (назавтра CDN → 403 → обложка исчезала). Теперь при скане
 *         картинка СРАЗУ кэшируется к нам на диск (uploads/covers) и cover_url подменяется на
 *         стабильный локальный URL → обложка живёт столько же, сколько запись видео. Фоново (не
 *         тормозит скан), пере-скан не затирает локальную копию, при удалении видео файл чистится.
 *         media/store_cover.ts + trends/service.ts. Старые (уже протухшие) обложки — по пере-скану. */
/* 1.6.20 — Аниматор/подкаст, фиксы по фидбэку: (1) АВТО-СОХРАНЕНИЕ спеки «Подкаста» (дебаунс 1.6с +
 *         сохранение на «Назад») — вышел/зашёл в сценарий, всё на месте (раньше терялось → пустой
 *         диалог → HeyGen делал 3-сек заглушку). Это корень «3 секунд». (2) «Из записи»: дорожка
 *         каждого ведущего теперь ПОЛНОВРЕМЕННАЯ (сегменты на реальных временах + тишина, длина =
 *         весь диалог) → голова на всю длину и синхрон губ ИМЕННО когда он говорит (buildHostAudio
 *         anullsrc+adelay+amix). (3) Склейка: обе головы tpad-клонируют последний кадр → видны всю
 *         длину (не «застывшая картинка» после короткой). (4) По умолчанию движок Avatar IV (живее,
 *         жесты/мимика). (5) Контур узла крутится при ЛЮБОМ фоне (аниматор/склейка тоже). */
/* 1.6.21 — КРИТ-фикс склейки сплит-скрина: `tpad=stop_duration=3600` + `-shortest` не ограничивал
 *         длину → ffmpeg уходил рендерить ~час (склейка «висела»). Теперь ffprobe-ом меряем целевую
 *         длину (запись, иначе длиннейшая голова), tpad до неё и ЖЁСТКИЙ `-t target` (потолок 30 мин).
 *         Проверено на VPS: склейка 5с → 1080×1920 за секунды. */
/* 1.6.22 — Редактор (облако «Редактор»): (1) ОБРЕЗАННОЕ АУДИО теперь попадает в Галерею — бэкенд
 *         сохранял его с kind='reference' (mediaType='audio'), а Галерея ищет аудио по kind='audio',
 *         референс — только видео → файл исчезал. Теперь аудио уходит с kind='audio' (video_edit/
 *         router.ts). (2) При открытии «Редактора» Галерея-пикер показывается СРАЗУ (авто-загрузка),
 *         убрана лишняя кнопка «Выбрать видео / аудио» и «Закрыть» — добавляем кликом по превью;
 *         после сохранения обрезки пикер обновляется и открывает вкладку файла (MontageEditor.tsx). */
/* 1.6.23 — Блок «Google Omni» переименован в «Omni Flash» (лейбл узла, описание панели, кнопка
 *         движка, оценка стоимости ~$0.10/с, комментарии). Внутренние ключи `omni`/OmniSpec НЕ
 *         тронуты (совместимость сохранённых сценариев). Бэкенд-исполнение на Gemini Omni Flash —
 *         следующим шагом, ПОСЛЕ проверки реального API на живом Gemini-ключе (SDK @google/genai
 *         v2.6 модель/Interactions API не подтверждает — не пишем вслепую). */
/* 1.6.24 — Omni Flash РАБОТАЕТ: реальная генерация видео в блоке «Omni Flash». Проверил API вживую
 *         на боевом Gemini-ключе: модель `gemini-omni-flash-preview` РЕАЛЬНА, вызывается через
 *         Interactions API (POST /v1beta/interactions; generateContent даёт 400), ответ синхронный
 *         (~38с), отдаёт 720p H.264 + AAC (видео СО ЗВУКОМ, ~10с), видео качается по files-uri (+&key,
 *         fetch идёт по 302). Кнопка «Сгенерировать (Omni Flash)» на сегменте → фоновая задача
 *         /omni/generate + poll /omni/status → превью 9:16 + сохранение в Галерею. Плюс ЧАТ-ПРАВКА
 *         (/omni/edit, previous_interaction_id) — «поменяй цвет машины». render/video_gen.ts
 *         (generateOmniVideo/editOmniVideo). Цена ~$0.10/с (проверено usage). Дальше: раскадровка
 *         Nano Banana 2 Lite → выбор → Omni; кадр-из-видео как seedFrame (image_to_video). */
/* 1.6.25 — Omni Flash: РАСКАДРОВКА через Nano Banana 2 Lite перед видео. Кнопка «Раскадровка (Nano)»
 *         на сегменте → 3 дешёвых кадра (~$0.10, ~4с каждый, gemini-3.1-flash-lite-image via
 *         generateContent — наш image_gen роутит сам) → выбираешь лучший → «Оживить выбранный кадр»
 *         запускает Omni Flash image_to_video ИМЕННО по нему (первый кадр видео = выбранный).
 *         Так видно результат ДО дорогой генерации. Бэкенд /omni/storyboard (generateImage×N параллельно,
 *         в Галерею). Проверено вживую: Nano Lite отдаёт jpeg за 3.8с. */
/* 1.6.26 — Omni Flash, редактор: (1) Пикер ИСХОДНОГО видео = полная Галерея — вкладки-папки
 *         (Все/Из анализа/Тренды/Референс) + поиск + «Найдено: N» (фильтр по type). (2) Окно ленты
 *         для Omni Flash — МАКС 10с (за проход): визуальная полоска-таймлайн с выделенным окном,
 *         показ «Xс из макс 10с» (красным если больше), ползунки автоматически держат ≤10с (при
 *         известной длине исходника). V2V — свободный диапазон как раньше. Дальше: старт-кадр над
 *         полоской (кадр из видео/загрузка/промт+картинка) + конечный кадр (оставить/редактировать). */
/* 1.6.27 — Omni Flash, лента-редактор по лучшим практикам монтажа: окно преобразования тянется
 *         прямо на полоске ЛКМ/пальцем — тело = сдвиг по ролику, края = начало/конец (= длина),
 *         Omni держит макс 10с. Во время перетаскивания превью исходника синхронно перематывается
 *         на кадр под курсором (живой seek). «+» добавляет ещё одно окно на ленту (до 6, без
 *         перекрытий). Убраны лишние настройки: режимы «Всё видео/Часть/2–3 вставки», кнопки
 *         длины 4/6/8с и дублирующие ползунки — всё задаётся окном. Дальше: старт-кадр (кадр из
 *         видео/загрузка/промт+картинка) и конечный кадр (оставить/редактировать) для kadr→видео. */
/* 1.6.28 — Подкаст «Omni-студия» (гибрид): Omni Flash оживляет фото КАЖДОГО ведущего
 *         (image_to_video) → 2 клипа с ИИ-голосом; склейка сплит-скрина через composeHeads;
 *         диалоговое редактирование каждого клипа чатом (/omni/edit по interactionId). Реальный
 *         голос из записи — ветка HeyGen. Проверено вживую на боевом ключе: аудио-вход Omni НЕ
 *         поддерживается, 2 реальных лица в одном кадре блокируются фильтром → по ведущему отдельно.
 *         BE /podcast/omni-animate (+/status); FE провайдер 'omni' + runOmniAnimate/HostEdit. */
/* 1.6.29 — Omni-студия: ПРИОРИТЕТ общего фото студии. Если есть groupPhotoUrl → один image_to_video
 *         оживляет ЦЕЛУЮ сцену (оба ведущих в одном кадре — проверено: single-image НЕ блокируется,
 *         в отличие от reference_to_video двух разных фото) → без кропов/сплит-скрина/микса голосов.
 *         Нет общего фото → фолбэк по ведущему (2 клипа). omniScenePrompt; правки чатом как раньше. */
/* 1.6.30 — Omni Flash, старт-кадр и продолжение (kadr→видео). #3 СТАРТ-КАДР на каждое окно: «из
 *         кадра видео» (ffmpeg-извлечение исходника в позиции окна), «загрузить своё», «промт+картинка»
 *         (Nano img2img) → первый кадр для image_to_video; превью+сброс, персист в сегменте. #4
 *         ПРОДОЛЖЕНИЕ: «последний кадр → новое окно» — берём последний кадр клипа (ffmpeg -sseof) как
 *         старт следующего окна (сшивка). BE: frame_extract.ts (+SSRF/traversal-guard, чистка временных
 *         файлов) + POST /omni/frame; /omni/storyboard теперь принимает imageUrl (img2img). Прошло
 *         адверсариал-ревью (3 линзы): last-frame без ffprobe, SSRF-guard, addSegment без гонки id. */
/* 1.6.31 — Подкаст: генерация аниматора ПЕРЕЖИВАЕТ выход/вход в сценарий. Раньше animJobs/omni были
 *         только в React-state (терялись при размонтировании),хотя клипы уже сохранялись в Галерею
 *         (Omni — на бэке сам; HeyGen — при опросе). Теперь результат + активная задача пишутся в
 *         spec (animResult/animActive, авто-сейв). На возврате: гидрация превью + ВОЗОБНОВЛЕНИЕ опроса
 *         (контур снова крутится). 404 задачи (рестарт сервера) → мягкое сообщение «ищите в Галерее». */
/* 1.6.32 — Omni Flash, пикер «Исходное видео» = полная Галерея: обложки (кадр-превью видео там, где
 *         нет готовой обложки, вместо чёрного плейсхолдера — <video #t=0.1>), кнопка «Добавить видео»
 *         (загрузка в Референс → перечитываем список → вкладка «Референс»). loadSources() вынесен;
 *         стабильный key={s.url} (не индекс — иначе тайлы залипали на прошлом кадре после фильтра/загрузки). */
/* 1.6.33 — Фикс диаризации подкаста: 33с-запись «схлопывалась» в <1с (Gemini возвращал крошечные
 *         таймкоды). Теперь бэк ffprobe-ит реальную длительность → ЯКОРИТ промт («покрой всю запись
 *         ~Nс, не сжимай в начало») + ВАЛИДИРУЕТ: если maxEnd < половины длины → бросаем, падаем на
 *         воркер (whisper даёт реальные таймкоды по всей длине). «Не ломается»: таймлайн = вся запись. */
/* 1.6.34 — Omni Flash, старт-кадр: кнопка «Загрузить» теперь открывает ГАЛЕРЕЮ своих картинок
 *         (сетка reference-изображений + поиск + «Загрузить новую») — можно выбрать свой предмет/фон
 *         или загрузить новый, клик = старт-кадр окна. Плюс понятное предупреждение вместо сырого
 *         «Omni Interactions HTTP 400: Input blocked…» (friendlyOmniError: фильтр контента → мягкий
 *         промт; один реальный кадр-лицо сам по себе проходит). imgPick-модалка, uploadStartFrame→bool. */
/* 1.6.35 — Omni Flash: КОНТЕКСТ выделенного фрагмента по умолчанию. «Сгенерировать» без явного
 *         старт-кадра теперь сам берёт кадр из позиции окна (POST /omni/frame, transient) и оживляет
 *         РЕАЛЬНУЮ сцену по промту (image_to_video) — «бутылка→роза» рисуется в кадре видео, а не с нуля.
 *         Кадр берётся под текущее окно (не персистится, всегда актуальный). Fallback на текст→видео,
 *         если кадр не вышел. Подпись поясняет: полная покадровая перерисовка — это «Ре-стайл (V2V)». */
/* 1.6.36 — Omni Flash: узел на холсте АНИМИРУЕТСЯ во время генерации/подготовки кадра (переливающийся
 *         контур .me-busyring, как у «Подкаста»). omniBusy = любой omniGen busy/fbBusy. Панель можно
 *         закрыть — генерация продолжается в фоне (poll на omniPollRef живёт, пока смонтирован сценарий;
 *         чистится только при выходе из сценария), а бэкенд-задача всё равно сохраняет клип в Галерею. */
/* 1.6.37 — Omni Flash: генерация ПЕРЕЖИВАЕТ выход/вход в сценарий (как подкаст-аниматор). Сегмент
 *         хранит genJobId/genUrl/genInteractionId (в omniSpec, авто-сейв); при загрузке гидрируем превью
 *         готовых клипов и ВОЗОБНОВЛЯЕМ поллинг активных задач (узел снова светится). 404 (рестарт
 *         сервера) → мягко «клип в Галерее». Правка тоже сбрасывает старый результат → возобновляется.
 *         removeSeg чистит поллинг; volatile gen-поля исключены из undo-истории (не плодят шаги Ctrl+Z). */
/* 1.6.38 — Подкаст HeyGen «НА СТУДИИ»: вырезаем ЛЮДЕЙ (целиком, не лица) из общего фото → на студию.
 *         Проверено вживую ключом HeyGen: talking_photo нельзя вырезать (transparent отклоняется, green
 *         игнорируется) → маттинг делаем ДО HeyGen. Пайплайн: Nano (gemini-3-pro-image img2img) вырезает
 *         каждого ведущего из общего фото на зелёный #00FF00 → HeyGen анимирует (Avatar IV, тело/руки) на
 *         зелёном → ffmpeg chromakey+despill накладывает обоих на ФОТО СТУДИИ (composeOnStudio, A слева/B
 *         справа). BE: /podcast/heygen-studio (вырезка+submit, параллельно по ведущему) + /podcast/compose-studio
 *         (фон-задача). FE: кнопка «Оживить НА студии» (heygen+есть общее фото) → pollAnimate → «Собрать НА
 *         студии». Голос — реальный (из записи)/HeyGen TTS/ElevenLabs. Валидировано тест-рендерами end-to-end. */
/* 1.6.39 — Большая чистка багов ПОДКАСТА (глубокое ревью, 25+ фиксов). Воркер: F0=0 больше не ломает
 *         кластеризацию 2 голосов (сегменты без питча исключаются); TTS не озвучивает слово «None»;
 *         видео-вставка к реплике не роняет сегмент (-loop только для картинок); SSRF-гард схем URL;
 *         TTL-очистка WORK_DIR/out (диск не забивается); явная заметка при деградации таймлайн→последовательно.
 *         BE: amix normalize=0 (речь была тише в 2 раза в сплит-скрине/студии); подготовка обоих ведущих ДО
 *         сабмита HeyGen (нет осиротевших платных рендеров); дедуп скачивания голов (дубликаты в Галерее);
 *         таймаут Gemini-диаризации 240с → фолбэк на воркер; TTL+tenant-скоуп in-memory задач; предупреждение
 *         об обрезке длинного текста TTS. FE: гонка Play на таймлайне (токен поколения); опросы статусов не
 *         «воскресают» после выхода из сценария (+потолок 30 мин); ✂ режет по реальной позиции клипа (lineT);
 *         объединение реплик — по ВРЕМЕНИ (не по индексу, без end<start); перемотка останавливает и raf-режим;
 *         подсветка выбранной реплики не съезжает после split/merge/delete; и др. мелочи. */
/* 1.6.40 — Подкаст «НА студии» = бесшовная сцена (clean plate + посадка на свои места).
 *         (1) CLEAN PLATE: Nano убирает людей с общего фото и дорисовывает студию — это фон
 *         compose-studio (раньше фоном шло исходное фото, и за аватарами выглядывали статичные
 *         «двойники»); фолбэк на исходное фото с предупреждением. (2) ПОЗИЦИОНИРОВАНИЕ: вырезка
 *         ведущего сохраняет композицию кадра 1:1 (не перемещать/не приближать) + серверный кроп
 *         в тот же 9:16, что фон (cropImageTo916, PNG) → в склейке оверлей 0:0 — аватары садятся
 *         РОВНО на свои места (fullFrame-режим composeOnStudio; легаси-раскладка сохранена).
 *         (3) БЕСШОВНОСТЬ: despill + мягкий край маски (avgblur только альфа-плоскости, planes=8).
 *         (4) МЕДИА РЕПЛИК в студийном пути: картинки/видео реплик показываются по своим
 *         интервалам таймлайна поверх сцены (overlays в compose-studio, до 12). Фон студии
 *         (clean plate) сохраняется в спеку (studioBgUrl) — «Собрать НА студии» переживает
 *         выход/вход. Фильтр-граф проверен end-to-end на синтетике (ffmpeg-static). */
/* 1.6.41 — OpenMontage-конвейер ДОДЕЛАН (тренд → рецепт → цепочка → ролик без дыр):
 *         (1) «Новости» честные: news_fetch.ts читает RSS/@tg-канал (t.me/s)/сайт (OpenGraph) → текст+фото
 *         последней записи; ✨Claude переписывает материал для озвучки (веб-поиск только для «темы»);
 *         фото новости уходит первой перебивкой в B-roll. (2) B-roll реальный: бэкенд подбирает клипы в
 *         стоках (broll.ts, Pexels→Pixabay, ключ тенанта или PEXELS_API_KEY; ✨Claude придумывает EN-запрос),
 *         воркер вставляет перебивки поверх исходника (_broll_insert: cover-кроп, тайминги DNA или равномерно,
 *         звук не трогаем). (3) «Аватар» без GPU: движок HeyGen (avatar_step.ts: talking_photo→Avatar IV→poll;
 *         выбор голоса М/Ж) — пресеты «Аватар-спикер»/«UGC-отзыв» ожили; SadTalker остаётся для GPU-воркера.
 *         (4) Апскейл всегда работает: без GPU — CPU-фолбэк lanczos+unsharp на воркере. DNA-рецепт: broll
 *         src=stock. Env (опц.): PEXELS_API_KEY/PIXABAY_API_KEY как платформенный фолбэк стоков. */
/* 1.6.42 — БОЛЬШОЙ АУДИТ TrendFlow (workflow, 9 агентов): пресеты/узлы/UX «Собрать» приведены к реально
 *         работающему. ВОРКЕР: (1) Формат чинён — auto_reframe получал «9:16»-строки, НЕ входящие в его
 *         enum, и молча падал в portrait: «16:9»/«1:1» всегда давали вертикаль; теперь portrait/landscape/
 *         square/vertical_4_5/cinematic (все 5 кнопок честные). (2) Цветокор чинён — слал preset/look,
 *         а схема ждёт profile/lut_path/custom_vf → шаг был passthrough; теперь warm→cinematic_warm,
 *         cold→cinematic_cool, cinema→moody_dark, vivid→bright_clean, Ч/Б через custom_vf hue=s=0
 *         (+фолбэк high_contrast), LUT .cube из Галереи → lut_path. (3) Аудио: дакинг реализован
 *         (sidechaincompress+amix, музыка зациклена; duck=off → segmented_music). (4) Озвучка: голос М/Ж
 *         из узла доходит до piper (_tts). (5) Экспорт: платформы → реальные media-profiles (tiktok/
 *         instagram_reels/youtube_shorts/youtube_landscape/instagram_feed), note честно про общий формат.
 *         ФРОНТ: пресеты с оверрайдами (choices/text/✨ на узел) — news-пресеты ставят type и ✨,
 *         «Лучший момент → шортс» (length=best+✨), «Кинематик» 21:9+cinema, «Документалка» 16:9,
 *         «Аватар-спикер»/«UGC-отзыв» через avatar+✨ (порядок был сломан: voiceover ПОСЛЕ avatar
 *         перекрывал липсинк-голос); везде Формат ДО титров (кроп резал вшитые субтитры). Убраны мёртвые
 *         контролы: subtitles pos/текст/✨ (воркер читает только стиль), voiceover «референс голоса»,
 *         color текст (LUT работает!). «Контент-план» скрыт (пустой стаб), «Редактор» — иконка Film,
 *         хинты Длина/Аватар различают авто-нарезку/Редактор и монолог/Подкаст. «Собрать» продублирована
 *         в ШАПКЕ (плавающую перекрывали модалки — жалоба юзера), без источника — открывает пикер с
 *         русской подсказкой. Удалён легаси omnichannel (FlowCanvas/flowNodes/channels + @xyflow/react).
 *         DNA-рецепт: broll до титров, без мусорных text. */
/* 1.6.43 — по фидбэку юзера после первого сквозного прогона: (1) НОВОСТИ «С НУЛЯ» — цепочка с Новостями/
 *         Озвучкой собирается БЕЗ исходного видео: воркер строит базовый ролик под длину озвучки из фото
 *         новости (Ken Burns 1080×1920, zoompan) или тёмного фона, B-roll добавляет стоковые перебивки;
 *         DirectorExecutor передаёт scratch.newsImage в params.images; tts убран из needs_video; фронт:
 *         гейт «Собрать» пропускает такие цепочки, кнопка «Без исходника» в пикере, подпись центрального
 *         узла. (2) Липкая панель действий в пикере источника (кнопки Выбрать/Собрать пакет видны без
 *         прокрутки — жалоба «листал в конец»). (3) Анимация сборки: импульсы бегут по линиям к центру
 *         (stroke-dash + meLineFlow), узел исполняемого прямо сейчас шага светится кольцом me-busyring
 *         (runningKind из buildJob.steps). */
/* 1.6.44 — Студия лиц: рамки = ВЕДУЩИЕ ЦЕЛИКОМ (фикс UX по жалобе юзера). (1) «Сделать кадры»
 *         больше не раздувает крупную рамку в 2.4×3.3 раза (это было для рамок-ЛИЦ) — большая
 *         рамка кропится почти как есть (cropBox адаптивный); (2) «Найти ведущих (авто)» (бывш.
 *         «Распознать лица») строит рамки сразу вокруг ведущего целиком (лицо→расширение);
 *         (3) рамки A/B теперь УЧАСТВУЮТ в «Оживить НА студии»: personCutoutGreen получает
 *         область рамки в процентах кадра — вырезается именно обведённый человек (а не «левый/
 *         правый»); (4) подписи объясняют: рамка = кого вырезаем на студию; кадры — опциональные
 *         крупные планы для обычного аниматора/сплит-скрина. */
/* 1.6.45 — Фикс «HeyGen: No face detected» на ШИРОКИХ фото студии (16:9): центральный 9:16-кроп
 *         вырезки резал ведущих по краям — HeyGen получал зелёнку без лица. Теперь: (1) вырезка
 *         кропится ОКНОМ 9:16 вокруг рамки ведущего (cropImageToRect; probeImageSize по фото),
 *         лицо всегда в кадре; (2) координаты окон едут в compose-studio (place A/B, persist
 *         studioPlace в спеке) — composeOnStudio пере-кадрирует фон по горизонтали так, чтобы
 *         ОБА ведущих влезли в вертикальный 1080×1920 (недостающая высота — блюр-подложка,
 *         стандарт вертикального рекадра), и сажает головы на вычисленные пиксельные координаты.
 *         Фолбэки: нет рамок → окна по половинам кадра; probe не удался → старый центральный
 *         кроп + предупреждение. Фильтр-граф проверен на синтетике 16:9 (ffmpeg-static). */
/* 1.6.46 — по фидбэку юзера: (1) окно прогресса сборки переехало в ПРАВЫЙ НИЖНИЙ УГОЛ без тёмной подложки —
 *         паутина, центральный узел, импульсы и кольцо активного блока видны во время рендера. (2) B-roll:
 *         новый источник «Кадры источника» — перебивки ТОЛЬКО из фото блока «Новости» (без стоков);
 *         news_fetch отдаёт ВСЕ фото поста (Telegram-альбом до 4), scratch.newsImages. (3) Галерея:
 *         вкладка «Тренды» убрана (тренды — на своей странице), «Референс» переименована в «TrendFlow» —
 *         там всё, что произвёл TrendFlow (ролики/склейки/головы/кадры/Omni) + свои загрузки. */
/* 1.6.47 — Студия: гарантия зелёного фона вырезки + живее движение. По прогону юзера: Gemini
 *         вырезал мужчину на зелёный, а женщину вернул СО студийным фоном (chromakey нечего
 *         убирать → вклейка прямоугольником). Теперь: greenBgRatio (ffmpeg rawvideo 64×64,
 *         доля зелёных пикселей) проверяет КАЖДУЮ вырезку ДО HeyGen; <22% зелёного → повторная
 *         вырезка со строгим промтом; снова мимо → понятная ошибка (кредиты HeyGen не тратятся,
 *         prepare-first). Плюс talking_style='expressive' у talking_photo (заметнее движение
 *         головы/тела, а не только губы) с фолбэком без него, если движок/аккаунт не принял. */
/* 1.6.48 — по фидбэку юзера: (1) пилюля «Сценарий» ВЫНЕСЕНА НА КАНВАС над центральным узлом (главный
 *         промт всегда на виду; пустая — пунктир с подсказкой, заполненная — превью текста). (2) Узел
 *         B-roll переименован в «МЕДИАФАЙЛЫ» и принимает НЕСКОЛЬКО файлов из Галереи: node.medias[],
 *         чипы с корзинкой-удалением, пикер в мульти-режиме (клик добавляет/убирает, счётчик в шапке,
 *         «Готово»), загрузка с устройства добавляет ВСЕ файлы; planner передаёт medias, executor
 *         подхватывает их в «Свои файлы» и «Кадры источника»; воркер ставит до 6 перебивок. */
/* 1.6.49 — обложки трендов «должны быть всегда»: самолечение при чтении ленты. Кэш обложки при
 *         скане был одной fire-and-forget попыткой — рестарт pm2 (каждый деплой) убивал её молча, в БД
 *         оставалась подписанная CDN-ссылка, которая назавтра протухала («вчера были — сегодня чёрные»).
 *         Теперь listRecentVideos фоном докачивает живые CDN-обложки на диск, а уже протухшие
 *         ВОСКРЕШАЕТ свежей обложкой через TikHub (fetch_one_video / get_post_info_by_code; потолок
 *         12 за проход + кулдауны — бережём кредиты) + лог результата вместо молчаливого catch.
 *         Заодно: обложки во вкладке «Аналитика» тоже идут через cover-прокси (раньше прямой CDN). */
export const APP_VERSION = '1.6.49';

export function AppVersion() {
  return (
    <div
      id="app-version"
      className="select-none pointer-events-none"
      style={{
        fontSize: '10px',
        fontFamily: 'Inter, monospace',
        letterSpacing: '0.04em',
        color: 'var(--text-disabled)',
        padding: '4px 0 2px 0',
        textAlign: 'center',
        width: '100%',
      }}
    >
      © TrendTraffic.pro&nbsp;&nbsp;v{APP_VERSION}
    </div>
  );
}
