/**
 * Идемпотентные миграции схемы PostgreSQL.
 *
 * Запускаются на старте сервера. Каждая использует `IF NOT EXISTS`/похожие конструкции,
 * чтобы быть безопасными при повторном запуске и не падать, если БД недоступна.
 *
 * Для fallback-режима (db_fallback.json) миграции пропускаются — там схема динамическая.
 */

import pool from './index.js';

interface Migration {
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: 'subscriptions.cancel_at_period_end',
    sql: `ALTER TABLE subscriptions
          ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE`,
  },
  // Чёрный список удалённых аккаунтов — чтобы удалённый пользователь не мог
  // зарегистрироваться/войти заново (в т.ч. через Google auto-register).
  {
    name: 'account_blocklist.table',
    sql: `CREATE TABLE IF NOT EXISTS account_blocklist (
            email VARCHAR(255) PRIMARY KEY,
            google_id VARCHAR(255),
            reason TEXT,
            blocked_by VARCHAR(255),
            blocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )`,
  },
  {
    name: 'subscriptions.canceled_by',
    sql: `ALTER TABLE subscriptions
          ADD COLUMN IF NOT EXISTS canceled_by VARCHAR(255)`,
  },
  {
    name: 'subscriptions.canceled_at',
    sql: `ALTER TABLE subscriptions
          ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE`,
  },

  // ============================================================================
  // ENTERPRISE v0.10.0 — Tariff Enterprise: per-tenant integrations,
  // Quest Flow auto-rooms, chat для каждой комнаты, теги потребностей.
  // ============================================================================

  // tenants — per-tenant Gemini ключ
  {
    name: 'tenants.gemini_api_key_encrypted',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gemini_api_key_encrypted TEXT`,
  },
  {
    name: 'tenants.gemini_api_key_status',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gemini_api_key_status VARCHAR(32)`,
  },
  {
    name: 'tenants.gemini_api_key_last_check',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gemini_api_key_last_check TIMESTAMP WITH TIME ZONE`,
  },

  // tenants — per-tenant TikHub ключ (TrendTraffic: Enterprise BYO для скана трендов)
  {
    name: 'tenants.tikhub_api_key_encrypted',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tikhub_api_key_encrypted TEXT`,
  },
  {
    name: 'tenants.tikhub_api_key_status',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tikhub_api_key_status VARCHAR(32)`,
  },
  {
    name: 'tenants.tikhub_api_key_last_check',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tikhub_api_key_last_check TIMESTAMP WITH TIME ZONE`,
  },

  // tenants — per-tenant Chatwoot
  {
    name: 'tenants.chatwoot_url_encrypted',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS chatwoot_url_encrypted TEXT`,
  },
  {
    name: 'tenants.chatwoot_token_encrypted',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS chatwoot_token_encrypted TEXT`,
  },
  {
    name: 'tenants.chatwoot_enabled',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS chatwoot_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
  },

  // tenants — Telegram владельца (для уведомлений)
  {
    name: 'tenants.owner_telegram_id',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_telegram_id VARCHAR(128)`,
  },
  {
    name: 'tenants.owner_telegram_bot_token_encrypted',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_telegram_bot_token_encrypted TEXT`,
  },
  {
    name: 'tenants.owner_telegram_subscribers',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_telegram_subscribers JSONB DEFAULT '[]'::jsonb`,
  },

  // tenants — Quest Flow специфичный prompt + KB
  {
    name: 'tenants.questflow_prompt',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS questflow_prompt TEXT`,
  },
  {
    name: 'tenants.questflow_knowledge_base',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS questflow_knowledge_base TEXT`,
  },
  {
    name: 'tenants.questflow_kb_filename',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS questflow_kb_filename VARCHAR(255)`,
  },

  // tenants — преобразование изображений Quest Flow (Фаза 1: только картинки, Nano Banana).
  //   questflow_image_model   — ОДНА модель на аккаунт (выбор в Настройках → Gemini API).
  //   questflow_image_presets — JSON-массив «блоков обработки» (функция+промт+референсы).
  {
    name: 'tenants.questflow_image_model',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS questflow_image_model VARCHAR(64)`,
  },
  {
    name: 'tenants.questflow_image_presets',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS questflow_image_presets JSONB DEFAULT '[]'::jsonb`,
  },

  // rooms — тип комнаты и координаты Telegram-клиента
  {
    name: 'rooms.kind',
    sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS kind VARCHAR(32) NOT NULL DEFAULT 'video'`,
  },
  {
    name: 'rooms.telegram_user_id',
    sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS telegram_user_id VARCHAR(128)`,
  },
  {
    name: 'rooms.telegram_bot_id',
    sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS telegram_bot_id VARCHAR(128)`,
  },
  {
    name: 'rooms.telegram_username',
    sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255)`,
  },
  {
    name: 'rooms.telegram_display_name',
    sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS telegram_display_name VARCHAR(255)`,
  },
  {
    name: 'rooms.idx_tg_client',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_tg_client
          ON rooms(creator_tenant_id, telegram_bot_id, telegram_user_id)
          WHERE kind = 'telegram_chat'`,
  },

  // room_messages — чат внутри комнаты
  {
    name: 'room_messages.create',
    sql: `CREATE TABLE IF NOT EXISTS room_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      sender VARCHAR(16) NOT NULL,
      source VARCHAR(16) NOT NULL DEFAULT 'chat',
      kind VARCHAR(16) NOT NULL DEFAULT 'text',
      content TEXT,
      media_url TEXT,
      media_mime VARCHAR(64),
      media_size INTEGER,
      language_detected VARCHAR(16),
      dialect_detected VARCHAR(64),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'room_messages.idx_room_id',
    sql: `CREATE INDEX IF NOT EXISTS idx_room_messages_room_id
          ON room_messages(room_id, created_at)`,
  },

  // tenant_quest_flow_keys — API-ключи Quest Flow
  {
    name: 'tenant_quest_flow_keys.create',
    sql: `CREATE TABLE IF NOT EXISTS tenant_quest_flow_keys (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      api_key_hash VARCHAR(128) NOT NULL UNIQUE,
      api_key_prefix VARCHAR(16) NOT NULL,
      label VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP WITH TIME ZONE,
      revoked_at TIMESTAMP WITH TIME ZONE
    )`,
  },
  {
    name: 'tenant_quest_flow_keys.idx_tenant_id',
    sql: `CREATE INDEX IF NOT EXISTS idx_tenant_quest_flow_keys_tenant_id
          ON tenant_quest_flow_keys(tenant_id)`,
  },
  {
    name: 'tenant_quest_flow_keys.idx_hash',
    sql: `CREATE INDEX IF NOT EXISTS idx_tenant_quest_flow_keys_hash
          ON tenant_quest_flow_keys(api_key_hash) WHERE revoked_at IS NULL`,
  },

  // tenant_mcp_keys — per-tenant MCP API-ключи (синхронизация с внешними агентами/CRM).
  //   По образцу tenant_quest_flow_keys + столбец scopes (права ключа).
  {
    name: 'tenant_mcp_keys.create',
    sql: `CREATE TABLE IF NOT EXISTS tenant_mcp_keys (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      api_key_hash VARCHAR(128) NOT NULL UNIQUE,
      api_key_prefix VARCHAR(24) NOT NULL,
      label VARCHAR(255),
      scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP WITH TIME ZONE,
      revoked_at TIMESTAMP WITH TIME ZONE
    )`,
  },
  {
    name: 'tenant_mcp_keys.idx_tenant_id',
    sql: `CREATE INDEX IF NOT EXISTS idx_tenant_mcp_keys_tenant_id ON tenant_mcp_keys(tenant_id)`,
  },
  {
    name: 'tenant_mcp_keys.idx_hash',
    sql: `CREATE INDEX IF NOT EXISTS idx_tenant_mcp_keys_hash
          ON tenant_mcp_keys(api_key_hash) WHERE revoked_at IS NULL`,
  },

  // tenant_need_tags — теги потребностей
  {
    name: 'tenant_need_tags.create',
    sql: `CREATE TABLE IF NOT EXISTS tenant_need_tags (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(64) NOT NULL,
      description TEXT,
      color VARCHAR(16),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'tenant_need_tags.idx_tenant_id',
    sql: `CREATE INDEX IF NOT EXISTS idx_tenant_need_tags_tenant_id
          ON tenant_need_tags(tenant_id)`,
  },

  // client_tag_assignments — присвоенные теги
  {
    name: 'client_tag_assignments.create',
    sql: `CREATE TABLE IF NOT EXISTS client_tag_assignments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tag_id UUID NOT NULL REFERENCES tenant_need_tags(id) ON DELETE CASCADE,
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      detected_in_message_id UUID REFERENCES room_messages(id) ON DELETE SET NULL,
      confidence REAL,
      detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      sent_to_crm BOOLEAN NOT NULL DEFAULT FALSE
    )`,
  },
  {
    name: 'client_tag_assignments.idx_unique',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_client_tag_unique
          ON client_tag_assignments(tag_id, room_id)`,
  },
  {
    name: 'client_tag_assignments.idx_room',
    sql: `CREATE INDEX IF NOT EXISTS idx_client_tag_room
          ON client_tag_assignments(room_id)`,
  },

  // ============================================================================
  // v1.0.6 — Партнёрская программа (рефералки).
  // partners        — профиль партнёра (1:1 к users) с кодом ?Vibe=
  // partner_program_settings — синглтон-настройки (условия + WhatsApp контакт)
  // referral_clicks — лог переходов по ссылке (легковесные события)
  // referrals       — долговременная атрибуция: кто кого привёл (зарегистрировал/оплатил)
  // ============================================================================
  {
    name: 'partners.create',
    sql: `CREATE TABLE IF NOT EXISTS partners (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      code VARCHAR(32) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'partners.idx_code',
    sql: `CREATE INDEX IF NOT EXISTS idx_partners_code ON partners(code) WHERE status = 'active'`,
  },
  {
    name: 'partner_program_settings.create',
    sql: `CREATE TABLE IF NOT EXISTS partner_program_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      terms_text TEXT,
      whatsapp_contact VARCHAR(64),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_by UUID
    )`,
  },
  {
    name: 'partner_program_settings.seed',
    sql: `INSERT INTO partner_program_settings (id, terms_text, whatsapp_contact)
          VALUES (1, '', '+380637610482')
          ON CONFLICT (id) DO NOTHING`,
  },
  {
    name: 'referral_clicks.create',
    sql: `CREATE TABLE IF NOT EXISTS referral_clicks (
      id BIGSERIAL PRIMARY KEY,
      partner_code VARCHAR(32) NOT NULL,
      ip_hash VARCHAR(64),
      user_agent TEXT,
      referer TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'referral_clicks.idx_code',
    sql: `CREATE INDEX IF NOT EXISTS idx_referral_clicks_code
          ON referral_clicks(partner_code, created_at)`,
  },
  {
    name: 'referrals.create',
    sql: `CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      source VARCHAR(32) NOT NULL DEFAULT 'email',
      registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      first_paid_at TIMESTAMP WITH TIME ZONE,
      total_paid_minutes INTEGER NOT NULL DEFAULT 0
    )`,
  },
  {
    name: 'referrals.idx_partner',
    sql: `CREATE INDEX IF NOT EXISTS idx_referrals_partner ON referrals(partner_id)`,
  },

  // ============================================================================
  // OMNICHANNEL Фаза 0 (2026-05-31) — канало-агностичное ядро.
  // Аддитивно: kind и telegram_* остаются рабочими; channel_* — канонический
  // дискриминатор. Telegram = частный случай (channel_type='telegram',
  // channel_account_id=telegram_bot_id, channel_conversation_id=telegram_user_id).
  // ============================================================================

  { name: 'rooms.channel_type', sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS channel_type VARCHAR(32)` },
  { name: 'rooms.channel_account_id', sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS channel_account_id VARCHAR(128)` },
  { name: 'rooms.channel_conversation_id', sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS channel_conversation_id VARCHAR(128)` },
  { name: 'rooms.channel_username', sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS channel_username VARCHAR(255)` },
  { name: 'rooms.channel_display_name', sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS channel_display_name VARCHAR(255)` },
  { name: 'rooms.chatwoot_conversation_id', sql: `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS chatwoot_conversation_id VARCHAR(255)` },

  // Разрешаем kind='channel_chat' (комнаты не-Telegram каналов). Идемпотентно (drop+add).
  {
    name: 'rooms.kind_check_channel',
    sql: `ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_kind_check;
          ALTER TABLE rooms ADD CONSTRAINT rooms_kind_check CHECK (kind IN ('video', 'telegram_chat', 'channel_chat'))`,
  },

  // Бэкфилл существующих комнат в generic-поля (только где channel_type ещё пуст).
  {
    name: 'rooms.backfill_channel',
    sql: `UPDATE rooms SET
            channel_type = CASE WHEN kind = 'telegram_chat' THEN 'telegram' ELSE 'video' END,
            channel_account_id = CASE WHEN kind = 'telegram_chat' THEN telegram_bot_id ELSE channel_account_id END,
            channel_conversation_id = CASE WHEN kind = 'telegram_chat' THEN telegram_user_id ELSE channel_conversation_id END,
            channel_username = CASE WHEN kind = 'telegram_chat' THEN telegram_username ELSE channel_username END,
            channel_display_name = CASE WHEN kind = 'telegram_chat' THEN telegram_display_name ELSE channel_display_name END
          WHERE channel_type IS NULL`,
  },

  // generic «1 диалог = 1 комната» для любого канала с координатами.
  {
    name: 'rooms.idx_channel_client',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_channel_client
          ON rooms(creator_tenant_id, channel_type, channel_account_id, channel_conversation_id)
          WHERE channel_account_id IS NOT NULL AND channel_conversation_id IS NOT NULL`,
  },
  {
    name: 'rooms.idx_chatwoot_conv',
    sql: `CREATE INDEX IF NOT EXISTS idx_rooms_chatwoot_conv
          ON rooms(creator_tenant_id, chatwoot_conversation_id)
          WHERE chatwoot_conversation_id IS NOT NULL`,
  },

  // flow_sessions — состояние раннера цепочек на диалог-комнату.
  {
    name: 'flow_sessions.create',
    sql: `CREATE TABLE IF NOT EXISTS flow_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      flow_id UUID,
      current_node_id VARCHAR(128),
      status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'aborted')),
      variables JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'flow_sessions.idx_room', sql: `CREATE INDEX IF NOT EXISTS idx_flow_sessions_room ON flow_sessions(room_id)` },
  {
    name: 'flow_sessions.idx_active_room',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_sessions_active_room
          ON flow_sessions(room_id) WHERE status = 'active'`,
  },

  // channel_inboxes — связка «канал арендатора ↔ инбокс Chatwoot».
  {
    name: 'channel_inboxes.create',
    sql: `CREATE TABLE IF NOT EXISTS channel_inboxes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      channel_type VARCHAR(32) NOT NULL,
      external_id VARCHAR(255),
      chatwoot_inbox_id VARCHAR(64),
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'channel_inboxes.idx_tenant', sql: `CREATE INDEX IF NOT EXISTS idx_channel_inboxes_tenant ON channel_inboxes(tenant_id)` },
  {
    name: 'channel_inboxes.idx_chatwoot_inbox',
    sql: `CREATE INDEX IF NOT EXISTS idx_channel_inboxes_cw
          ON channel_inboxes(chatwoot_inbox_id) WHERE chatwoot_inbox_id IS NOT NULL`,
  },

  // ============================================================================
  // OMNICHANNEL Фаза 2 — конструктор цепочек: таблица flows (граф nodes+edges
  // в формате React Flow). flow_sessions (Фаза 0) ссылается на flows.id.
  // ============================================================================
  {
    name: 'flows.create',
    sql: `CREATE TABLE IF NOT EXISTS flows (
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
    )`,
  },
  { name: 'flows.idx_tenant', sql: `CREATE INDEX IF NOT EXISTS idx_flows_tenant ON flows(tenant_id)` },
  { name: 'flows.idx_active', sql: `CREATE INDEX IF NOT EXISTS idx_flows_active ON flows(tenant_id, status) WHERE status = 'active'` },
  { name: 'flows.idx_inbox', sql: `CREATE INDEX IF NOT EXISTS idx_flows_inbox ON flows(chatwoot_inbox_id) WHERE chatwoot_inbox_id IS NOT NULL` },

  // ============================================================================
  // OMNICHANNEL IG-0.5 — прямое подключение Instagram (OAuth, токен per-tenant).
  // Webhook резолвит tenant по ig_id; токен зашифрован (SIP_ENCRYPTION_KEY).
  // ============================================================================
  {
    name: 'instagram_accounts.create',
    sql: `CREATE TABLE IF NOT EXISTS instagram_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      ig_id VARCHAR(64) NOT NULL UNIQUE,
      username VARCHAR(255),
      access_token_encrypted TEXT NOT NULL,
      token_expires_at TIMESTAMP WITH TIME ZONE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'instagram_accounts.idx_tenant', sql: `CREATE INDEX IF NOT EXISTS idx_instagram_accounts_tenant ON instagram_accounts(tenant_id)` },

  // ============================================================================
  // OMNICHANNEL CW-SSO — бесшовный мост VibeVox ↔ Chatwoot.
  //
  // Модель: 1 tenant VibeVox = 1 account Chatwoot; агенты VibeVox = users Chatwoot,
  // заводятся автоматически через Platform API (никто не регистрируется в Chatwoot
  // напрямую). Вход без пароля — по одноразовой SSO-ссылке Platform API.
  //
  //  - tenants.chatwoot_account_id        — какой account Chatwoot обслуживает tenant
  //  - chatwoot_users                     — маппинг (email агента VibeVox → user Chatwoot)
  //                                         + его Application API token (для создания
  //                                         контактов/диалогов от его имени).
  // ============================================================================
  {
    name: 'tenants.chatwoot_account_id',
    sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS chatwoot_account_id VARCHAR(64)`,
  },
  {
    name: 'chatwoot_users.create',
    sql: `CREATE TABLE IF NOT EXISTS chatwoot_users (
      email VARCHAR(255) PRIMARY KEY,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      chatwoot_user_id VARCHAR(64) NOT NULL,
      chatwoot_account_id VARCHAR(64),
      access_token_encrypted TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'chatwoot_users.idx_tenant', sql: `CREATE INDEX IF NOT EXISTS idx_chatwoot_users_tenant ON chatwoot_users(tenant_id)` },

  // ============================================================================
  // CRM-ЗАДАЧИ — модуль «двойные задачи + авто-сообщения» (docs/KANBAN_CRM_MODULE.md).
  //  - internal_notification = напоминание ОПЕРАТОРУ (WS-тост + позже FCM);
  //  - client_message = авто-сообщение КЛИЕНТУ в срок через Chatwoot API.
  // Планировщик — БД-таймер (раз в минуту): WHERE status='todo' AND fired_at IS NULL
  // AND due_at <= now(). Изоляция по tenant_id.
  // ============================================================================
  {
    name: 'crm_tasks.create',
    sql: `CREATE TABLE IF NOT EXISTS crm_tasks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      chatwoot_account_id VARCHAR(64) NOT NULL,
      chatwoot_contact_id VARCHAR(64) NOT NULL,
      chatwoot_conversation_id VARCHAR(64),
      assigned_operator_id VARCHAR(64) NOT NULL,
      type VARCHAR(24) NOT NULL CHECK (type IN ('internal_notification', 'client_message')),
      body TEXT NOT NULL,
      due_at TIMESTAMP WITH TIME ZONE NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'completed', 'failed')),
      fired_at TIMESTAMP WITH TIME ZONE,
      error TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'crm_tasks.idx_contact', sql: `CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact ON crm_tasks(tenant_id, chatwoot_contact_id, status)` },
  {
    name: 'crm_tasks.idx_due',
    sql: `CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON crm_tasks(due_at) WHERE status = 'todo' AND fired_at IS NULL`,
  },

  // ============================================================================
  // TRENDTRAFFIC — анализатор трендов (TikHub).
  //  trends         — журнал сканов (запрос + сырой ответ).
  //  source_videos  — найденные исходные видео (дедуп по tenant+platform+external_id),
  //                   статус жизненного цикла: discovered → downloading → downloaded/failed.
  // Только PostgreSQL (в fallback-режиме модуль деградирует, см. modules/trends).
  // ============================================================================
  {
    name: 'trends.create',
    sql: `CREATE TABLE IF NOT EXISTS trends (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      platform VARCHAR(32) NOT NULL DEFAULT 'tiktok',
      query_kind VARCHAR(32) NOT NULL,
      query_value VARCHAR(255),
      region VARCHAR(8),
      result_count INT NOT NULL DEFAULT 0,
      payload JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'trends.idx_tenant', sql: `CREATE INDEX IF NOT EXISTS idx_trends_tenant ON trends(tenant_id, created_at DESC)` },
  {
    name: 'source_videos.create',
    sql: `CREATE TABLE IF NOT EXISTS source_videos (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      trend_id UUID REFERENCES trends(id) ON DELETE SET NULL,
      platform VARCHAR(32) NOT NULL DEFAULT 'tiktok',
      external_id VARCHAR(128) NOT NULL,
      author VARCHAR(255),
      author_name VARCHAR(255),
      description TEXT,
      cover_url TEXT,
      video_url TEXT,
      web_url TEXT,
      duration_sec INT,
      play_count BIGINT,
      like_count BIGINT,
      comment_count BIGINT,
      share_count BIGINT,
      status VARCHAR(24) NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered','downloading','downloaded','failed')),
      file_url TEXT,
      file_path TEXT,
      error TEXT,
      payload JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  { name: 'source_videos.idx_uniq', sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_source_videos_uniq ON source_videos(tenant_id, platform, external_id)` },
  { name: 'source_videos.idx_tenant', sql: `CREATE INDEX IF NOT EXISTS idx_source_videos_tenant ON source_videos(tenant_id, created_at DESC)` },
];

export async function runStartupMigrations(): Promise<void> {
  for (const m of MIGRATIONS) {
    try {
      await pool.query(m.sql);
      console.log(`[Migrations] ✓ ${m.name}`);
    } catch (err: any) {
      // Падать не имеем права — пользователь мог быть в fallback-режиме.
      console.warn(`[Migrations] ⚠ ${m.name} пропущена: ${err?.message || err}`);
    }
  }
}
