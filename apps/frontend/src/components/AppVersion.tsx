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
 */

export const APP_VERSION = '1.2.1';

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
