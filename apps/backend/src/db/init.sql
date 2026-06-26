-- Включение расширения для генерации UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- ТАБЛИЦА: tenants (Арендаторы)
-- Хранит глобальную информацию об аккаунтах клиентов (SaaS-арендаторов)
-- =========================================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    stripe_customer_id VARCHAR(255) UNIQUE,
    -- Кастомный prompt владельца — добавляется к systemInstruction Gemini Live, чтобы
    -- задать тематику разговора (терминологию, стиль). Используется с приоритетом перед дефолтом.
    custom_prompt TEXT,
    -- База знаний (raw text). Подмешивается к systemInstruction после custom_prompt,
    -- ограничено 50000 символов (≈ 12k токенов), всё что больше — обрезается.
    knowledge_base TEXT,
    knowledge_base_filename VARCHAR(255),
    -- ENTERPRISE v0.10.0: персональный Gemini API ключ (AES-256-GCM, формат cipher:iv:authTag).
    -- Если задан и validation_status='active' — используется ВМЕСТО глобального ключа для этого tenant.
    gemini_api_key_encrypted TEXT,
    gemini_api_key_status VARCHAR(32),       -- 'active' | 'invalid' | 'quota_exceeded' | NULL
    gemini_api_key_last_check TIMESTAMP WITH TIME ZONE,
    -- ENTERPRISE: персональные настройки Chatwoot (cipher:iv:authTag для url и token).
    chatwoot_url_encrypted TEXT,
    chatwoot_token_encrypted TEXT,
    chatwoot_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- ENTERPRISE: Telegram ID владельца аккаунта (legacy — один chat_id).
    -- В v0.10.10+ заменено на owner_telegram_subscribers (массив всех подписчиков бота).
    owner_telegram_id VARCHAR(128),
    -- ENTERPRISE: ОПЦИОНАЛЬНЫЙ персональный токен Telegram-бота владельца (AES-256-GCM).
    -- Если задан — уведомления отправляются ОТ ЕГО ИМЕНИ всем подписчикам бота.
    owner_telegram_bot_token_encrypted TEXT,
    -- ENTERPRISE v0.10.10: список chat_id'ов всех, кто написал /start этому боту.
    -- Уведомления рассылаются КАЖДОМУ. Обновляется при сохранении токена и по кнопке «Обновить».
    -- Структура: [{ chatId, type: 'private'|'group'|'supergroup'|'channel', title, addedAt }]
    owner_telegram_subscribers JSONB DEFAULT '[]'::jsonb,
    -- ENTERPRISE: отдельный promt и KB для Quest Flow-чатов (Telegram-диалогов с AI).
    -- Не путать с custom_prompt/knowledge_base — те для видео-комнат перевода.
    questflow_prompt TEXT,
    questflow_knowledge_base TEXT,
    questflow_kb_filename VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ТАБЛИЦА: users (Пользователи)
-- Учетные записи пользователей с привязкой к конкретному арендатору
-- =========================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255),
    telegram_id VARCHAR(255) UNIQUE,
    google_id VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'tenant_admin', 'user')),
    password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ТАБЛИЦА: account_blocklist (Чёрный список удалённых аккаунтов)
-- Когда суперадмин удаляет пользователя, его email (и google_id) попадают сюда,
-- чтобы он НЕ мог зарегистрироваться/войти заново — в т.ч. через Google
-- auto-register (иначе при следующем входе создаётся новый пустой аккаунт).
-- Разблокировка — удаление строки (DELETE /api/admin/users/blocklist).
-- =========================================================================
CREATE TABLE account_blocklist (
    email VARCHAR(255) PRIMARY KEY,
    google_id VARCHAR(255),
    reason TEXT,
    blocked_by VARCHAR(255),
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ТАБЛИЦА: subscriptions (Подписки и Баланс)
-- Информация о тарифе и лимите минут перевода (в секундах) арендатора
-- =========================================================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255), -- Stripe customer для checkout/portal
    tier VARCHAR(50) NOT NULL DEFAULT 'plus' CHECK (
      tier IN ('plus', 'standard', 'standard_yearly', 'enterprise', 'trial', 'monthly', 'annual')
    ),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'canceled', 'past_due', 'incomplete')),
    billing_period VARCHAR(50) DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly', 'one_time')),
    translation_minutes_balance INTEGER NOT NULL DEFAULT 0, -- баланс в секундах, 0 для не-активных
    rollover_seconds INTEGER NOT NULL DEFAULT 0, -- неиспользованный остаток с прошлого периода (сгорит ещё через цикл)
    current_period_end TIMESTAMP WITH TIME ZONE,
    last_rollover_at TIMESTAMP WITH TIME ZONE, -- когда последний раз переносили остаток
    -- v0.9.5: cancel_at_period_end = пользователь нажал «Отмена», деньги не возвращаются,
    -- подписка остаётся active до current_period_end, потом Stripe сам её закроет.
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_by VARCHAR(255), -- 'user' | 'superadmin' | NULL — кто инициировал отмену
    canceled_at TIMESTAMP WITH TIME ZONE,
    -- Статистика для админской панели «Пользователи»
    total_paid_minutes INTEGER NOT NULL DEFAULT 0, -- суммарно начислено минут (подписки + докупки + ручные кредиты)
    last_payment_minutes INTEGER, -- сколько минут в последнем платеже (subscription renew / topup / admin credit)
    last_payment_at TIMESTAMP WITH TIME ZONE, -- когда был последний платёж
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ТАБЛИЦА: promo_codes (Промокоды)
-- Глобальная таблица скидок и лимитов для привлечения клиентов
-- =========================================================================
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL,
    max_redemptions INTEGER, -- NULL означает бесконечное использование
    redemptions_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ТАБЛИЦА: sip_trunks (Настройки SIP-телефонии)
-- Конфигурационные данные SIP-подключений для исходящих звонков
-- Пароль хранится в зашифрованном виде (AES-256-GCM) в паре с IV
-- =========================================================================
CREATE TABLE sip_trunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sip_server VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    encrypted_password TEXT NOT NULL,
    iv VARCHAR(255) NOT NULL,
    caller_id VARCHAR(255),
    transport VARCHAR(50) NOT NULL DEFAULT 'udp' CHECK (transport IN ('udp', 'tcp', 'tls')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ТАБЛИЦА: rooms (Комнаты звонков)
-- =========================================================================
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    creator_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    -- ENTERPRISE v0.10.0: тип комнаты.
    --   'video'         — обычная комната перевода 1-на-1 (как было раньше).
    --   'telegram_chat' — авто-созданная Quest Flow комната для диалога AI ↔ Telegram-клиент.
    --                     Без видео, без транскрипции; только текст/аудио-сообщения в room_messages.
    kind VARCHAR(32) NOT NULL DEFAULT 'video' CHECK (kind IN ('video', 'telegram_chat', 'channel_chat')),
    -- ENTERPRISE: для kind='telegram_chat' — координаты клиента в Telegram через Quest Flow.
    -- Уникальная пара (creator_tenant_id, telegram_bot_id, telegram_user_id) — одна комната навсегда.
    telegram_user_id VARCHAR(128),
    telegram_bot_id VARCHAR(128),
    telegram_username VARCHAR(255),
    telegram_display_name VARCHAR(255),
    -- ──────────────────────────────────────────────────────────────────────
    -- OMNICHANNEL (Фаза 0): канало-агностичные координаты. Telegram — частный
    -- случай (channel_type='telegram', channel_account_id=telegram_bot_id,
    -- channel_conversation_id=telegram_user_id). Новые каналы (whatsapp/instagram/
    -- facebook/web/email…) используют ТОЛЬКО channel_* + kind='channel_chat'.
    channel_type VARCHAR(32),
    channel_account_id VARCHAR(128),
    channel_conversation_id VARCHAR(128),
    channel_username VARCHAR(255),
    channel_display_name VARCHAR(255),
    -- Связь с диалогом Chatwoot (Agent Bot): room ↔ conversation (Вариант А, Chatwoot=зеркало).
    chatwoot_conversation_id VARCHAR(255),
    -- Настройки комнаты, управляемые ТОЛЬКО creator'ом. Сохраняются для всех новых сессий.
    -- translationEnabled: бот запущен и переводит. subtitlesEnabled: текстовая дорожка идёт в data channel.
    settings JSONB DEFAULT '{"translationEnabled": true, "subtitlesEnabled": true}'::jsonb,
    -- Накопленные субтитры за весь звонок (для post-call Enterprise-аналитики).
    transcripts JSONB DEFAULT '[]'::jsonb,
    -- Результат пост-анализа (sentiment, engagement, tags, lead_score) для Enterprise.
    insights JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- ENTERPRISE v0.10.0: уникальный индекс по (tenant, bot, user) для telegram_chat комнат.
-- Гарантирует "1 клиент = 1 комната навсегда".
CREATE UNIQUE INDEX idx_rooms_tg_client ON rooms(creator_tenant_id, telegram_bot_id, telegram_user_id)
    WHERE kind = 'telegram_chat';

-- OMNICHANNEL (Фаза 0): generic «1 диалог = 1 комната» для любого канала с координатами.
CREATE UNIQUE INDEX idx_rooms_channel_client
    ON rooms(creator_tenant_id, channel_type, channel_account_id, channel_conversation_id)
    WHERE channel_account_id IS NOT NULL AND channel_conversation_id IS NOT NULL;
-- Поиск комнаты по диалогу Chatwoot (вебхук Agent Bot).
CREATE INDEX idx_rooms_chatwoot_conv ON rooms(creator_tenant_id, chatwoot_conversation_id)
    WHERE chatwoot_conversation_id IS NOT NULL;

-- =========================================================================
-- ТАБЛИЦА: room_messages (Сообщения чата в комнате) [ENTERPRISE v0.10.0]
-- Используется И для telegram_chat комнат (полноценный чат с клиентом),
-- И для video комнат (read-only зеркало транскриптов + ручные заметки владельца).
-- =========================================================================
CREATE TABLE room_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    -- Кто отправил сообщение
    sender VARCHAR(16) NOT NULL CHECK (sender IN ('client', 'admin', 'ai', 'system')),
    -- Источник сообщения:
    --   'chat'       — обычное сообщение от участника (клиент через QF / админ через UI / AI ответ)
    --   'transcript' — авто-добавлено из транскриптов video-комнаты (read-only)
    --   'media'      — медиа-сообщение (image/video/file/audio)
    --   'system'     — системное (например, "клиент сменил язык на en")
    source VARCHAR(16) NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'transcript', 'media', 'system')),
    -- Тип контента
    kind VARCHAR(16) NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'audio', 'image', 'video', 'file')),
    -- Текстовое содержимое (для kind='text' — само сообщение, для audio — транскрипция)
    content TEXT,
    -- Ссылка на медиа (для kind != 'text'). Может быть путь на нашем сервере /media/xxx
    media_url TEXT,
    media_mime VARCHAR(64),
    media_size INTEGER,
    -- Метаданные транскрипции для audio (если sender='client' и kind='audio')
    language_detected VARCHAR(16),
    dialect_detected VARCHAR(64),
    -- Дополнительные метаданные (например, message_id из Telegram, response_to_message_id и т.д.)
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_room_messages_room_id ON room_messages(room_id, created_at);

-- =========================================================================
-- ТАБЛИЦА: tenant_quest_flow_keys [ENTERPRISE v0.10.0]
-- Per-tenant API ключи для аутентификации входящих запросов от Quest Flow.
-- Несколько ключей возможны (для разных Quest Flow цепочек / разных проектов одного владельца).
-- =========================================================================
CREATE TABLE tenant_quest_flow_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- SHA-256 хэш ключа (raw ключ показывается пользователю ОДИН раз при создании)
    api_key_hash VARCHAR(128) NOT NULL UNIQUE,
    -- Префикс ключа для отображения в UI (например, "vbvx_abc...***")
    api_key_prefix VARCHAR(16) NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tenant_quest_flow_keys_tenant_id ON tenant_quest_flow_keys(tenant_id);
CREATE INDEX idx_tenant_quest_flow_keys_hash ON tenant_quest_flow_keys(api_key_hash) WHERE revoked_at IS NULL;

-- =========================================================================
-- ТАБЛИЦА: tenant_need_tags [ENTERPRISE v0.10.0]
-- Теги потребностей, определяемые владельцем Enterprise-аккаунта.
-- AI пытается распознать совпадение потребности при общении с клиентом и присваивает тег.
-- =========================================================================
CREATE TABLE tenant_need_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    -- Описание-промт: как AI должен понимать что потребность совпала
    description TEXT,
    color VARCHAR(16),  -- hex color для UI, опционально
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_need_tags_tenant_id ON tenant_need_tags(tenant_id);

-- =========================================================================
-- ТАБЛИЦА: client_tag_assignments [ENTERPRISE v0.10.0]
-- Присвоенные теги конкретному клиенту (через комнату).
-- Используется для отображения на карточке комнаты + передачи в Chatwoot CRM.
-- =========================================================================
CREATE TABLE client_tag_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id UUID NOT NULL REFERENCES tenant_need_tags(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    detected_in_message_id UUID REFERENCES room_messages(id) ON DELETE SET NULL,
    confidence REAL,  -- 0.0..1.0 — насколько AI уверен в совпадении
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_to_crm BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX idx_client_tag_unique ON client_tag_assignments(tag_id, room_id);
CREATE INDEX idx_client_tag_room ON client_tag_assignments(room_id);

-- =========================================================================
-- ТАБЛИЦА: flow_sessions [OMNICHANNEL Фаза 0]
-- Состояние раннера цепочек (React Flow) для одного диалога-комнаты:
-- текущий узел + накопленные переменные. «1 диалог = 1 активная сессия».
-- =========================================================================
CREATE TABLE flow_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    flow_id UUID,                          -- какая цепочка выполняется (NULL = ещё не назначена)
    current_node_id VARCHAR(128),          -- текущий узел
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'aborted')),
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,  -- переменные диалога
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flow_sessions_room ON flow_sessions(room_id);
CREATE UNIQUE INDEX idx_flow_sessions_active_room ON flow_sessions(room_id) WHERE status = 'active';

-- =========================================================================
-- ТАБЛИЦА: channel_inboxes [OMNICHANNEL Фаза 0]
-- Связка «канал арендатора ↔ инбокс Chatwoot». У одного tenant'а может быть
-- несколько каналов (WhatsApp-номер, IG-аккаунт, веб-виджет…), каждый = инбокс.
-- =========================================================================
CREATE TABLE channel_inboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel_type VARCHAR(32) NOT NULL,     -- 'whatsapp'|'instagram'|'facebook'|'web'|'email'…
    external_id VARCHAR(255),              -- ID на стороне канала (номер/страница/аккаунт)
    chatwoot_inbox_id VARCHAR(64),         -- ID инбокса в Chatwoot
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_channel_inboxes_tenant ON channel_inboxes(tenant_id);
CREATE INDEX idx_channel_inboxes_cw ON channel_inboxes(chatwoot_inbox_id) WHERE chatwoot_inbox_id IS NOT NULL;

-- =========================================================================
-- ТАБЛИЦА: flows [OMNICHANNEL Фаза 2]
-- Граф цепочки (nodes+edges в формате React Flow). flow_sessions ссылается на flows.id.
-- =========================================================================
CREATE TABLE flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Без названия',
    status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    graph JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
    channel_type VARCHAR(32),
    chatwoot_inbox_id VARCHAR(64),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flows_tenant ON flows(tenant_id);
CREATE INDEX idx_flows_active ON flows(tenant_id, status) WHERE status = 'active';
CREATE INDEX idx_flows_inbox ON flows(chatwoot_inbox_id) WHERE chatwoot_inbox_id IS NOT NULL;

-- =========================================================================
-- СОЗДАНИЕ ИНДЕКСОВ ДЛЯ ОПТИМИЗАЦИИ
-- =========================================================================
-- Индексы по tenant_id для ускорения работы RLS-политик
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX idx_sip_trunks_tenant_id ON sip_trunks(tenant_id);
CREATE INDEX idx_rooms_creator_tenant_id ON rooms(creator_tenant_id);

-- Индексы по Stripe-идентификаторам для обработки вебхуков
CREATE INDEX idx_tenants_stripe_customer ON tenants(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

-- Индексы для авторизации
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_email ON users(email);

-- =========================================================================
-- АВТОМАТИЗАЦИЯ СМЕНЫ ВРЕМЕНИ ОБНОВЛЕНИЯ (updated_at)
-- =========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sip_trunks_updated_at BEFORE UPDATE ON sip_trunks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- НАСТРОЙКА БЕЗОПАСНОСТИ СТРОК (Row-Level Security - RLS)
-- =========================================================================
-- Включение RLS для таблиц с данными арендаторов
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_trunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Создание политик изоляции на основе переменной сессии 'app.current_tenant_id'
-- Если переменная не установлена или пуста, доступ к записям запрещен.

CREATE POLICY users_tenant_isolation ON users
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY subscriptions_tenant_isolation ON subscriptions
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY sip_trunks_tenant_isolation ON sip_trunks
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

CREATE POLICY rooms_tenant_isolation ON rooms
    FOR ALL
    USING (creator_tenant_id IS NULL OR creator_tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (creator_tenant_id IS NULL OR creator_tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
