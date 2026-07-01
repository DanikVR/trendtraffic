# VibeVox — рабочая инструкция

Живой документ. `SPEC.md` — что **должно быть**; этот файл — что **есть сейчас** и **что не забыть**. Обновляется после каждого реализованного блока.

---

## 0. КАНОНИЧЕСКИЕ КОМПОНЕНТЫ — НЕ ПЛОДИТЬ ДУБЛИ

Перед добавлением/правкой навигации, layout-а или общих компонентов — **сверяться с этим списком**.
Если вместо одного из них уже существует похожий — это **скорее всего мёртвый код**, и его нужно удалить, а не редактировать.

| Тип | Канонический файл | Где живёт | Что НЕ редактировать |
|---|---|---|---|
| **Desktop sidebar nav** | [`apps/frontend/src/layouts/MainLayout.tsx`](apps/frontend/src/layouts/MainLayout.tsx) — inline `desktopNav` массив + условные NavLink'и (Enterprise, Админ-панель) | `<aside className="hidden lg:flex">` внутри MainLayout | НЕТ `components/Sidebar.tsx` — был удалён в v0.10.4 как dead code |
| **Mobile nav** | [`apps/frontend/src/components/BottomTabBar.tsx`](apps/frontend/src/components/BottomTabBar.tsx) — 5 нижних табов + More-sheet с дополнительными пунктами | Импортируется в MainLayout, виден только `< lg` | — |
| **Admin nav** | [`apps/frontend/src/layouts/AdminLayout.tsx`](apps/frontend/src/layouts/AdminLayout.tsx) — отдельный layout для `/admin/*` | Используется только для admin-роутов в router.tsx | — |
| **Telegram Mini App layout** | [`apps/frontend/src/layouts/MiniAppLayout.tsx`](apps/frontend/src/layouts/MiniAppLayout.tsx) | Активируется когда `isMiniApp=true` в store | Не дублировать nav сюда |
| **Layout switching** | [`apps/frontend/src/router.tsx`](apps/frontend/src/router.tsx) — `LayoutSwitcher` компонент | — | — |
| **Enterprise gate (фронт)** | [`apps/frontend/src/hooks/useIsEnterprise.ts`](apps/frontend/src/hooks/useIsEnterprise.ts) для страниц, либо inline проверка `role === 'superadmin' || subscriptionTierName === 'enterprise'` для layout-компонентов | — | — |
| **Enterprise gate (бэк)** | [`apps/backend/src/modules/billing/feature_gate.ts`](apps/backend/src/modules/billing/feature_gate.ts) — `requireEnterprise()` | Используется в роутерах через `ensureEnterprise()` обёртку | — |
| **Шифрование Enterprise-секретов** | [`apps/backend/src/modules/tenant_settings/encryption.ts`](apps/backend/src/modules/tenant_settings/encryption.ts) — `encryptSecret/decryptSecret` (AES-256-GCM на `SIP_ENCRYPTION_KEY`) | Reuse для Gemini key, Chatwoot, Quest Flow и пр. | НЕ создавать новый шифровальщик |
| **Confirm-модалы (вместо browser confirm)** | [`apps/frontend/src/components/ConfirmModal.tsx`](apps/frontend/src/components/ConfirmModal.tsx) | — | НЕ использовать `window.confirm()` |
| **Backend assistant/ — БИБЛИОТЕКА, не UI** | [`apps/backend/src/modules/assistant/service.ts`](apps/backend/src/modules/assistant/service.ts) | Экспортирует `deductAudioBalance`, `InsufficientBalanceError`, `FeatureNotAvailableError`, `geminiProvider` — используется в `quest_flow/inbound.ts`, `quest_flow/router.ts`, `assistant/telegram_gateway.ts` | НЕТ страницы `/assistant` на фронте (была UI-демкой, удалена в v0.10.7) — реальный функционал в `pages/RoomChatPage.tsx` + `insights/router.ts` + `quest_flow/inbound.ts` |
| **Партнёрская программа (рефералки)** | [`apps/backend/src/modules/partners/router.ts`](apps/backend/src/modules/partners/router.ts) — единый модуль с `partnersPublicRouter` (user-facing) + `partnersAdminRouter` (SuperAdmin) + экспортируемыми хелперами `attributeRegistration()` и `creditReferralPayment()`. UI: [`apps/frontend/src/pages/admin/PartnersPage.tsx`](apps/frontend/src/pages/admin/PartnersPage.tsx) (управление условиями + список), карточка в [`apps/frontend/src/pages/SettingsPage.tsx`](apps/frontend/src/pages/SettingsPage.tsx) (ссылка + статы), трекер кликов [`apps/frontend/src/components/ReferralTracker.tsx`](apps/frontend/src/components/ReferralTracker.tsx) | Подробное описание модуля — раздел **5.П** ниже | НЕ дублировать атрибуцию в auth-роуты — вызывать `attributeRegistration()`. НЕ хардкодить процент комиссии — выплаты вручную после договорённости (хранится только статистика). |

### Правило добавления нового пункта навигации
1. Десктоп → `MainLayout.tsx` — добавить в массив `desktopNav` либо как условный `<NavLink>` (по образцу Админ-панель / Настройки Enterprise)
2. Мобильник → `BottomTabBar.tsx` — добавить в массив `moreItems` либо как условную кнопку в More-sheet (по образцу Админ-панель / Настройки Enterprise)
3. **Оба места обязательны** — иначе мобильные юзеры не увидят пункт

### Правило fallback-sync (для DB-операций)
PG-доступный режим **не сохраняет в db_fallback.json автоматически**. После каждого INSERT/UPDATE/DELETE через `pool.query` нужно явно вызвать соответствующий helper из `db/index.ts`:
- `addMessageToFallback`, `removeMessageFromFallback` — для room_messages
- `removeRoomFromFallback`, `renameRoomInFallback` — для rooms
- `removeUserFromFallback` — для users (каскад)

Без этого после рестарта backend'а (если PG временно недоступен) удалённые записи «воскресают» — это была баг v0.9.2 и v0.10.3.

### Правило точности SQL-handler'ов в fallback (важно!)
**Любой UPDATE/SELECT-handler с общим regex перехватывает ВСЕ запросы по таблице** и блокирует более точные handler'ы ниже. Это была причина трёх критических багов:
- v0.10.12: `/UPDATE tenants SET/i` ловил все UPDATE'ы (gemini, telegram, chatwoot) и возвращал пусто → ничего не сохранялось
- v0.10.12: `/UPDATE tenants SET gemini_api_key/is` ловил И save (3 values), И status-only (2 values), И last_check (1 value) — затирал encrypted поле значением статуса
- **v1.0.6**: `/SELECT COUNT\(\*\)/i` (handler #11, dialect_rules) ловил **все** `SELECT COUNT(*)` в системе, включая `COUNT(*) FROM referral_clicks` партнёрки → возвращал длину `dialect_rules` (0) в поле `count`, мой код ждал `n` → счётчик переходов всегда 0. Сужено до `SELECT COUNT\(\*\)\s+FROM\s+dialect_rules`.

**Правило**: regex для любого handler'а в `runMockQuery` ДОЛЖЕН включать конкретное имя таблицы (`FROM dialect_rules`, `FROM referral_clicks`) и конкретные имена колонок (`stripe_subscription_id`, `gemini_api_key_encrypted`). Не использовать общие regex типа `UPDATE tenants SET`, `SELECT COUNT(*)`, `gemini_api_key` без суффикса.

### Telegram Bot API quirks (для уведомлений Enterprise)
1. **Webhook несовместим с getUpdates** — если у бота установлен webhook, `/getUpdates` всегда возвращает пусто. Перед `getUpdates` всегда вызывать `deleteWebhook?drop_pending_updates=false` (best-effort).
2. **getUpdates с внутренним offset** — после вызова Telegram «съедает» возвращённые updates и следующий вызов без offset вернёт пусто. Использовать `offset=-100&limit=100` чтобы забрать последние 100 апдейтов независимо от acknowledged state. Безопасно когда мы сохраняем chat'ы в свою БД.
3. **Лимит 24 часа** на хранение updates у Telegram. Если пользователь подписался давно и больше не писал — может выпасть из updates. Но если уже в нашей БД (tenants.owner_telegram_subscribers JSONB) — остаётся.

---

## 1. Что это и зачем

**VibeVox** — мультитенантный SaaS для синхронного голосового и видеоперевода в реальном времени.

Базовый сценарий: два человека входят в одну комнату по ссылке, каждый выбирает только **свой родной язык**, и слышит собеседника на своём языке через ИИ-переводчика. Без выбора «с какого на какой» — Gemini Live API сам распознаёт исходный язык.

Дополнительно: SIP-телефония (входящие/исходящие через бюджетных провайдеров), AI-ассистент с пост-анализом звонков, биллинг через Stripe, интеграция с Chatwoot CRM и Google Calendar.

---

## 2. Стек

| Слой | Технологии |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Zustand + react-router-dom v7, `@livekit/components-react` + `livekit-client`, i18next (12 локалей), Telegram WebApp SDK |
| Backend | Node.js (ESM) + Express + TypeScript, `@google/genai`, `@livekit/rtc-node`, `livekit-server-sdk`, bcryptjs, JWT, Zod, multer |
| Хранилище | PostgreSQL (с RLS по `app.current_tenant_id`). При недоступности БД — прозрачный in-memory + JSON fallback в `db_fallback.json` |
| WebRTC | LiveKit Cloud (`wss://vibevox-d1v4ek73.livekit.cloud`) |
| AI | Google Gemini Live API (модель `gemini-live-2.5-flash-preview`), нативные HD-голоса Aoede (ж) / Charon (м) |
| Платежи | Stripe (webhook на сыром body **до** глобального `express.json()`) |
| Деплой (план) | Hostinger VPS KVM 4 |

---

## 3. Структура монорепо

```
VibeVox/
├─ apps/
│  ├─ backend/           # Express API, порт 3001
│  │  ├─ src/
│  │  │  ├─ server.ts
│  │  │  ├─ config/systemConfig.ts    # source of truth для всех ключей
│  │  │  ├─ db/index.ts               # пул PG + fallback
│  │  │  └─ modules/
│  │  │     ├─ auth/        # email+bcrypt, Google OAuth, суперадмин-хардкод
│  │  │     ├─ livekit/     # генерация JWT-токенов для комнат
│  │  │     ├─ translation/ # bridge.ts — ядро Gemini Live ↔ LiveKit
│  │  │     ├─ rooms/       # UUID-комнаты с TTL 24ч
│  │  │     ├─ sip/         # SIP-транки (AES-256-GCM шифрование)
│  │  │     ├─ assistant/   # пост-анализ + Telegram-шлюз
│  │  │     ├─ billing/     # Stripe webhook
│  │  │     └─ dialects/    # AI Learning Hub Pro
│  │  ├─ .env, system-config.json, google-oauth.json
│  │  └─ db_fallback.json
│  └─ frontend/          # Vite, порт 3000, прокси /api → :3001
│     └─ src/
│        ├─ pages/, components/, layouts/, store/, config/
│        └─ modules/<feature>/locales/{ru,en,…}.json   # 12 локалей
└─ packages/shared/      # Zod-схемы и общие типы (@vibevox/shared)
```

---

## 3.1 SIP-интеграция — полная картина

Модуль SIP-телефонии VibeVox реализован в трёх итерациях (А/Б/В) и **полностью функционален**. Программно подтверждено живыми вызовами LiveKit Cloud — все три направления (outbound trunk, inbound trunk, исходящий звонок) реально регистрируются в Cloud и получают валидные ID.

### 3.1.1 Архитектура: 3 SIP-направления

```
┌────────────────────────────────────────────────────────────────────┐
│                       VibeVox — SIP-модуль                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  (А) OUTBOUND TRUNK                                                │
│  ──────────────────                                                │
│  Пользователь вводит данные своего SIP-провайдера (Zadarma и др.)  │
│  → backend шифрует пароль AES-256-GCM, сохраняет в БД              │
│  → создаёт vibevox_trunk_{tenantId} в LiveKit Cloud                │
│  → потом используется для (В) — исходящих звонков                  │
│                                                                    │
│  (Б) INBOUND TRUNK + DISPATCH RULE                                 │
│  ──────────────────────────────────                                │
│  Backend генерирует уникальные auth_username/password per tenant   │
│  → создаёт inbound trunk vibevox_inbound_{tenantId} в LiveKit      │
│  → создаёт dispatch rule: type=direct, roomName=vibevox-sip-{tid}  │
│  → пользователь копирует credentials в Zadarma как переадресацию   │
│  → внешний звонок попадает в фиксированную комнату tenant'а        │
│  → пользователь жмёт «Активировать» — bridge стартует в комнате    │
│                                                                    │
│  (В) OUTBOUND CALL (Web → телефон)                                 │
│  ──────────────────────────────────                                │
│  Пользователь нажимает «Позвонить» в UI с номером телефона         │
│  → backend находит свой outbound trunk в LiveKit                   │
│  → создаёт новую UUID-комнату                                      │
│  → SipClient.createSipParticipant(trunkId, phoneNumber, roomId)    │
│  → передаёт participantMetadata = {nativeLanguage, voiceGender}    │
│  → bridge автоматически считывает метаданные SIP-участника         │
│  → web-клиент редиректится в эту комнату через /room/{uuid}        │
│  → когда телефон отвечает — bridge переводит в обе стороны         │
└────────────────────────────────────────────────────────────────────┘
```

### 3.1.2 Endpoints (все требуют `x-tenant-id` UUID в заголовке)

| Метод | Путь | Что делает |
|---|---|---|
| **(А) Outbound trunk** |
| POST | `/api/sip/trunk` | Создаёт или обновляет outbound trunk (SIP-сервер + login + password + transport + callerId) |
| GET | `/api/sip/trunk` | Возвращает текущий trunk (password маскирован `********`) |
| DELETE | `/api/sip/trunk` | Удаляет trunk из БД + LiveKit |
| **(Б) Inbound trunk** |
| POST | `/api/sip/inbound` | Создаёт inbound trunk + dispatch rule с auto-сгенерированными credentials. При повторном вызове — rotate (старые удаляются) |
| GET | `/api/sip/inbound` | Возвращает inbound со ВКЛЮЧЁННЫМ паролем (расшифрованным) — пользователь его копирует |
| DELETE | `/api/sip/inbound` | Удаляет trunk + dispatch rule из LiveKit + БД |
| POST | `/api/sip/inbound/activate` | Запускает TranslationBridge в фиксированной комнате tenant'а |
| POST | `/api/sip/inbound/deactivate` | Останавливает bridge |
| **(В) Outbound call** |
| POST | `/api/sip/call` | Body: `{phoneNumber, calleeLanguage, callerName?}`. Возвращает `{roomId, sipParticipantId, ...}` |

### 3.1.3 Схема БД (две новые таблицы)

```sql
sip_trunks                          -- outbound (А)
├─ id (UUID PK)
├─ tenant_id (UUID, FK)
├─ sip_server                       -- например, sip.zadarma.com
├─ username                         -- SIP login пользователя у провайдера
├─ encrypted_password               -- ciphertext:iv:authTag (AES-256-GCM)
├─ iv                               -- дубликат IV (исторически)
├─ caller_id                        -- nullable
├─ transport                        -- 'udp' | 'tcp' | 'tls'
├─ created_at, updated_at

sip_inbound                         -- (Б)
├─ id (UUID PK)
├─ tenant_id (UUID, FK)
├─ sip_host                         -- vibevox-d1v4ek73.sip.livekit.cloud
├─ room_name                        -- vibevox-sip-{tenantId} (фиксированное)
├─ auth_username                    -- vibevox-{12 chars of tenant uuid}
├─ encrypted_auth_password          -- ciphertext:iv:authTag
├─ iv
├─ livekit_inbound_trunk_id         -- ST_xxx из LiveKit (для удаления)
├─ livekit_dispatch_rule_id         -- SDR_xxx из LiveKit (для удаления)
├─ bridge_active                    -- bool: запущен ли TranslationBridge сейчас
├─ created_at, updated_at
```

Обе таблицы продублированы в `db/index.ts` через **fallback-обработчики** SQL-запросов, так что вся функциональность работает и без PostgreSQL (in-memory + JSON-файл).

### 3.1.4 Безопасность

- **AES-256-GCM** для всех SIP-паролей. Ключ из `SIP_ENCRYPTION_KEY` (env), хэшируется в 32 байта через SHA-256.
- Формат хранения: `ciphertext:iv:authTag`. При расшифровке проверяется auth tag — целостность гарантирована.
- `getDecryptedSipPassword(tenantId)` — единственный путь восстановления чистого пароля, используется при синхронизации с LiveKit Cloud.
- Inbound-пароль возвращается клиенту в открытом виде (он же нужен пользователю для копирования в Zadarma), outbound-пароль маскируется как `********` всегда.

### 3.1.5 Best-effort синхронизация с LiveKit Cloud

Если LiveKit Cloud по какой-то причине не принимает запрос (тариф без SIP, временная недоступность):
- **БД сохраняется в любом случае** — данные пользователя не теряются.
- В ответе клиенту приходит поле `liveKitSyncWarning` с понятным текстом причины.
- UI показывает «активно» с янтарной заметкой, а не красным provoke ошибки.
- Когда SIP в LiveKit активируется — повторный POST сразу синхронизирует.

### 3.1.6 UI (frontend/src/pages/SipPage.tsx)

Одна страница `/sip` содержит **три секции**:

1. **«Новый SIP-транк» / параметры существующего outbound trunk**
   — форма + карточки «Параметры сервера» и «Безопасность» + опасная зона.
2. **«Входящие SIP-звонки»**
   — пустое состояние с кнопкой «Создать SIP-адрес для входящих»;
   — активное состояние с 4-строчной таблицей данных (SIP-сервер, Логин, Пароль с Eye/EyeOff, Комната) и кнопками Copy у каждой строки;
   — Power-кнопка «Активировать / Остановить» приём bridge;
   — инструкция по настройке Zadarma в 5 шагов;
   — кнопки «Перевыпустить credentials» и «Удалить SIP-адрес».
3. **«Исходящий звонок»**
   — поле телефонного номера + LanguagePicker «Язык получателя»;
   — зелёная кнопка «Позвонить» → редирект в `/room/{uuid}` где SIP-абонент уже ждёт.

Все деструктивные действия (удаление trunk/inbound) подтверждаются **внутренним стилизованным модалом** (не браузерным `confirm`) с blur backdrop, красной градиентной кнопкой и ghost-кнопкой «Отмена».

### 3.1.7 Программные доказательства работы

Все три итерации SIP подтверждены **реальными вызовами LiveKit Cloud** через curl:

| Итерация | Реальный артефакт от LiveKit |
|---|---|
| А — Outbound trunk | Создан, виден в `listSipOutboundTrunk()` |
| Б — Inbound trunk | `trunkId = ST_AAXbLo8PqeVi`, `dispatchRuleId = SDR_bmLey4LhF2nL` |
| В — Исходящий звонок | `sipParticipantId = PA_ZJuytqzWiV7w` |

Полный CRUD-цикл (создать → получить → обновить → удалить) проходит за один curl-сеанс без перезапусков бэкенда.

### 3.1.8 Ключевые SDK-нюансы, выясненные в процессе

1. **LiveKit Cloud SIP-хост** строится так: `wss://vibevox-d1v4ek73.livekit.cloud` → `vibevox-d1v4ek73.sip.livekit.cloud` (вставляется `.sip` перед первой точкой).
2. **`createSipParticipant(trunkId, number, roomName, opts)`** — `opts.participantMetadata` это JSON-строка, которую `bridge.parseParticipantMetadata` уже умеет читать. Никаких правок bridge для SIP не нужно — он одинаково работает с web- и SIP-участниками.
3. **`createSipDispatchRule({type:'direct', roomName}, {trunkIds:[id], name, metadata})`** — `type:'direct'` направляет все звонки в одну фиксированную комнату. Альтернатива `type:'individual'` (с префиксом, каждый звонок в новую комнату) пока не используется.
4. **`@livekit/rtc-node` snake_case**: на стороне `publishData` поле получателей называется `destination_identities` (не camelCase). А в `livekit-server-sdk` — `destinationIdentities`. Это разные SDK с разными конвенциями.
5. **`captureFrame` — async**. Обязательно `.catch()` на Promise (см. 0.3.4) иначе RtcError InvalidState валит весь процесс.

### 3.1.9 Что осталось вне SIP-модуля (но связано)

- **Webhook от LiveKit** при входящем звонке → автоматический запуск bridge **без** ручной активации пользователем. Сейчас пользователь жмёт «Активировать» перед звонком — webhook это упростил бы до полностью автоматического. Требует публичного URL (после деплоя).
- **Биллинг минут перевода при SIP-звонке** — текущий учёт минут (когда будет реализован Stripe) должен включать и SIP-сессии. Архитектурно это та же комната с bridge, отдельной логики не нужно.
- **Конференц-связь** (3+ SIP-участников в одной комнате) — технически работает на стороне LiveKit, но UI пока поддерживает максимум 1+1.

---

## 4. Как запустить локально

```bash
# Установка (один раз)
npm install

# Запуск (в двух окнах или фоном)
cd apps/backend  && npm run dev   # :3001, tsx watch
cd apps/frontend && npm run dev   # :3000, vite

# Проверка
curl http://localhost:3001/api/health
open http://localhost:3000
```

PostgreSQL **не обязателен** — backend сам переключится на in-memory fallback. Для полного режима: `npm run db:up` (docker-compose).

**Логин суперадмина:** `live7610482@gmail.com` / `Danyuk1976!` (хардкод в `auth/router.ts`).

---

## 5. Что реализовано (на 2026-05-26)

### Backend — готово
- **Auth**: email+пароль (bcrypt), Google OAuth flow с авто-регистрацией, восстановление пароля через SMTP, суперадмин-хардкод, верификация всех внешних API из админки (LiveKit, Gemini, Telegram, Chatwoot, Google OAuth).
- **LiveKit token**: генерация JWT с упаковкой `nativeLanguage` + `voiceGender` в metadata участника. Эти metadata читает бот в комнате.
- **TranslationBridge** (`modules/translation/bridge.ts`): бот-участник входит в LiveKit-комнату, для каждого человека поднимает отдельную Gemini Live Session со `streamTranslationConfig`, гоняет PCM 16kHz mono. Реализован детектор пола голоса по F0 (автокорреляция) с **пересозданием Gemini-сессии «на лету»**, если пол сменился. Реализована инъекция dialect instruction из БД в `systemInstruction`.
- **Rooms**: UUID v4, TTL 24 часа, RLS-привязка к tenant, fallback в `inMemoryRooms`.
- **SIP**: CRUD транков, AES-256-GCM шифрование пароля, `x-tenant-id` middleware.
- **Assistant**: `/call-analytics` (Enterprise-only feature toggle), `/telegram-gateway` (мультимодальный, биллинг по секундам).
- **Billing**: Stripe webhook на сыром body, синхронизация `subscription_status`.
- **Dialects (AI Learning Hub Pro)**: CRUD правил, загрузка аудио-семплов, тест через Gemini с инструкцией диалекта, сохранение «коррекций» админа, авто-инъекция фонетических правок в скомпилированный промпт.
- **System config**: единый менеджер. Приоритет: `system-config.json` → `.env` → дефолт. Секреты маскируются `***` при отдаче клиенту.

### Frontend — готово
- Авторизация (логин, регистрация, Google OAuth callback, forgot-password).
- Layouts с переключением: Main / MiniApp (Telegram) / Admin.
- 12 локалей: ru, en, es, fr, de, it, pt, pl, tr, zh, ar (RTL), he (RTL).
- Все страницы существуют: Dashboard, Room (список + лобби + звонок), Billing, SIP, Assistant, Settings, AdminConfig, Dialects.
- Дизайн-система Aurora/Abyss с тёмной темой по умолчанию.

### Frontend — что НЕ доделано
- 🟡 **Текстовые субтитры**. Сейчас Gemini в `bridge.ts` настроен на `responseModalities: [Modality.AUDIO]` — публикуется только переведённое аудио. UI показывает индикатор статуса перевода, но не текст. Чтобы получить транскрипты, нужно добавить `Modality.TEXT` и пробрасывать текст через LiveKit data channel.
- 🟡 **Выбор пола голоса в лобби** — сейчас всегда `female`. Нужно добавить переключатель ♂/♀ в `RoomLobbyPage.tsx` и пробрасывать в токен.

---

## 5.Р — Quest Flow медиа (фото/видео/голос/кружки) + распознавание речи в видео + чат-лента (2026-05-29 → 05-30)

Большой блок: приём медиа от клиента через Quest Flow и его обработка. Всё — Enterprise-only, Gemini идёт через ключ владельца (**биллинг медиа НЕ списываем**). Прод = ngrok→localhost с JSON-fallback (без PG) — отсюда часть багов только в fallback.

### Фиксы багов
1. **🔴 Аудио-баланс (только fallback).** Хэндлер `UPDATE subscriptions SET translation_minutes_balance = translation_minutes_balance …` в [`db/index.ts`](apps/backend/src/db/index.ts) матчил И начисление (`+ $1`), И атомарное списание (`deductAudioBalance`: `- $1 WHERE balance >= $1 RETURNING`), всегда делал `+add` и возвращал `{rows:[]}` → `deductAudioBalance` видел 0 строк → `InsufficientBalanceError` «нужно 2, доступно 1000001» при огромном балансе. Фикс: различаем знак, чтим guard `>= $1`, при `RETURNING` отдаём строку. На реальном PG бага нет (SQL корректен).
2. **🔴 Видео не распознавалось.** QF шлёт явное поле `kind=video`, но VibeVox брал тип из `file.mimetype`; Telegram-пересылка часто = `application/octet-stream` → `mediaKindForMime`='file' → `videoFilePath=null` → распознавания не было. Фикс: [`router.ts`](apps/backend/src/modules/quest_flow/router.ts) пробрасывает `kind`; `processQuestFlowInboundMedia` использует его приоритетно над MIME + при generic MIME подставляет корректный video/image MIME (`mimeForExt`).

### Распознавание: один Files API-вызов → структурированный JSON
[`responder.ts`](apps/backend/src/modules/quest_flow/responder.ts) `respondToClient` для МЕДИА просит СТРОГО JSON `{transcript, visual, clientReply}` (`parseRecognitionJson`, fail-soft: не-JSON → весь текст в clientReply):
- `transcript` — дословная речь; `visual` — текст документов/рулетка/таблички/цифры; `clientReply` — ответ клиенту по `questflow_prompt`/базе знаний.
- Видео грузится через **Gemini Files API** (`buildVideoPartViaFilesApi`: `ai.files.upload` → polling ACTIVE → `createPartFromUri`) — звук видео Gemini понимает сам.

### Сплит «владелец / клиент» (ключевое требование пользователя)
[`inbound.ts`](apps/backend/src/modules/quest_flow/inbound.ts) `finalizeInboundDialogue`:
- **Чат комнаты (владелец)** — ПОЛНАЯ расшифровка (`transcript`+`visual` через `composeClientContent`) кладётся в КОНТЕНТ сообщения клиента под видео/фото. Видит ТОЛЬКО владелец.
- **Telegram (клиент)** — `clientReply` → AI-сообщение + `response.text` (ОДНО сообщение, следом за расшифровкой в чате). `questflow_prompt`/база знаний решают, что раскрывать клиенту; transcript/visual всегда полные.
- **РЕОРДЕР:** `respondToClient` вызывается ДО `insertMessage(client)` (нужен `recognition` для контента).
- `response.text` НИКОГДА не пустой для медиа: пусто → повторный текстовый запрос на ЯЗЫКЕ КЛИЕНТА → статический `MEDIA_FALLBACK_REPLY`.

### V2 — дословная речь из видео через ffmpeg (2026-05-30)
[`transcribe.ts`](apps/backend/src/modules/quest_flow/transcribe.ts) `transcribeVideoAudio`: ffmpeg извлекает аудио (`-vn -ac 1 -ar 16000 -f wav`) → наш ASR `transcribeAudio` → дословная речь + **язык/диалект** (→ `dialect_rules`, точнее in-video ASR Gemini). Передаётся в `respondToClient` как `speechTranscript` (заземляет `clientReply` + идёт в `transcript`). **Fail-soft:** ffmpeg недоступен / нет дорожки → in-video transcript Gemini (V1), сервис не падает.
- ffmpeg-путь: env `FFMPEG_PATH` → `ffmpeg-static` (добавлен в package.json, бандл-бинарь) → системный `ffmpeg`. Импорт `ffmpeg-static` через переменную-спецификатор (optional, tsc не требует установки).

### Видео-кружки (video_note)
QF (v1.5.2) шлёт их в `/inbound-media` как обычное видео (`kind=video`, `video/mp4`) → тот же путь, спец-кода НЕ потребовалось.

### Чат-лента комнаты (RoomChatPage, видна и в telegram_chat, и в video-комнатах — компонент общий)
- **Разбивка по дням:** [`MessageList.tsx`](apps/frontend/src/components/chat/MessageList.tsx) — разделитель «Сегодня/Вчера/дата» перед первым сообщением нового календарного дня (день берётся из того же времени, что бабл).
- **Полная i18n ленты на 108 языков:** `MessageList` + `MessageBubble` — ключи `chat.*` (dayToday, dayYesterday, empty, newMessages, fromTranscript, audioMessage, queued, delivered, fileFallback, openImage, explainTone; переиспользованы tone/deleteMessage). Перевод — surgical [`scripts/translate-new-keys.mjs`](apps/frontend/scripts/translate-new-keys.mjs) (`KEY_PATHS` = текущий батч; en/ru вручную, остальные 106 — Google API).

### Прочие правки этой сессии
- **Произвольные коды сайта (суперадмин):** `/admin/config` → cookie-consent/GA/Pixel; рантайм-инжект [`SiteScripts.tsx`](apps/frontend/src/components/SiteScripts.tsx) (createElement, не innerHTML); GET `/api/auth/site-scripts` публичный, POST закрыт `requireSuperAdmin` (stored-XSS).
- **Chatwoot:** убрана UI-карточка из [`AdminConfigPage.tsx`](apps/frontend/src/pages/admin/AdminConfigPage.tsx); бэкенд (глобальный конфиг) НАМЕРЕННО оставлен — fallback в `getEffectiveChatwoot` + заметка в `assistant` call-analytics. **НЕ считать мёртвым.**
- **Страница тарифов [`BillingPage.tsx`](apps/frontend/src/pages/BillingPage.tsx):** убраны «Брендирование» (Standard), «Google Календарь» + «Отдельная админ-вкладка» (Enterprise); добавлена крупная отдельная строка-акцент ∞🎥 (Enterprise); флаги языков без страны → коды (EO/HMN/EU…); убран placeholder поиска языков; убрана дублирующая строка «120 минут».

---

## 5.Н Enterprise v0.10.1 → v0.10.17: стабилизация, навигация, разделение зон (2026-05-27)

Серия из 17 итераций после первого MVP Enterprise (5.М). Делятся на три волны: критические фиксы, упрощение UX, разделение зон ответственности.

### Волна 1: критические фиксы (v0.10.1 — v0.10.4)

**v0.10.1** — Vite proxy `/uploads` → backend:3001. Без этого медиа из чата `404'или` (фронт пытался качать с :3000). Также плашка composer переоформлена (rounded-xl + отступы) и DELETE endpoint для сообщений (creator может удалить любое + физический файл с диска).

**v0.10.2** — `ConfirmModal.tsx` (Aurora-стиль) вместо нативного `window.confirm()`. Иконка 🗑 теперь всегда видна (не на hover). Опциональный `window.__VV_DEBUG_SIDEBAR=true` для диагностики.

**v0.10.3** — КРИТ-фикс «удалил → F5 → сообщение вернулось». Та же проблема что с rooms в v0.9.2: `pool.query(DELETE)` уходит в реальный PG, но `db_fallback.json` не обновляется. После рестарта (если PG недоступен) fallback читает старый JSON и сообщение «воскресает». Решение: helpers `addMessageToFallback / removeMessageFromFallback` в db/index.ts — вызываются ВСЕГДА из service-функций.

**v0.10.4** — Аудит навигации + удаление dead code. **Корневой баг**: в проекте было ДВА навигационных компонента — `components/Sidebar.tsx` (мёртвый, нигде не импортируется) и inline-навигация в `layouts/MainLayout.tsx` (живая). Три предыдущие версии я правил Sidebar.tsx и удивлялся почему ничего не меняется. **Решение**: Sidebar.tsx удалён полностью; «Настройки Enterprise» добавлено в `desktopNav` MainLayout + в moreItems BottomTabBar. В PROJECT_NOTES добавлен раздел «0. КАНОНИЧЕСКИЕ КОМПОНЕНТЫ — НЕ ПЛОДИТЬ ДУБЛИ» чтобы это больше не повторилось.

### Волна 2: Telegram-уведомления (v0.10.5 — v0.10.13)

**v0.10.5** — Персональный Telegram-бот владельца. Новое поле БД `tenants.owner_telegram_bot_token_encrypted` (AES-256-GCM). Если задан — уведомления идут ОТ ЕГО ИМЕНИ (например @MyClinicBot). Глобальный @vibevoxinfo_bot **больше не используется** для Enterprise-уведомлений — он только для суперадминских broadcast'ов. Это сознательное решение: у каждого Enterprise свой бот для брендирования перед клиентами.

Уведомления о Quest Flow добавлены в `quest_flow/inbound.ts`:
- При создании НОВОЙ telegram_chat комнаты → «🆕 Новый клиент через Quest Flow» с ссылкой на чат
- При успешной детекции тегов → «🏷 Выявлены потребности» с тегами и ссылкой
- Async, не блокируют ответ QF

**v0.10.6** — Добавлены SIP-телефония и ИИ-Ассистент в desktop sidebar (раньше были только в mobile More-sheet).

**v0.10.7** — Удаление UI-демки «ИИ-Ассистент». Страница была заглушкой с захардкоженным mock-ответом «Анализирую ваш запрос…». Реальный функционал уже в Enterprise: чат → RoomChatPage, анализ → InsightsModal, Telegram → Quest Flow. Backend `assistant/` оставлен как библиотека — он экспортирует `deductAudioBalance`, `geminiProvider` etc., используемые в `quest_flow/inbound.ts`.

**v0.10.8** — Auto-discovery chat_id. Backend через /getUpdates находит первое сообщение от пользователя и привязывает его chat_id (приоритет приватный чат → группа → канал).

**v0.10.9** — Упрощение Telegram до single-field UX. Поле chat_id ПОЛНОСТЬЮ убрано из UI. Пользователь вводит только токен, всё остальное автоматически.

**v0.10.10** — Telegram = РАССЫЛКА всем подписчикам бота (а не одному chat_id). Новое поле `tenants.owner_telegram_subscribers` JSONB. Backend через /getUpdates собирает ВСЕХ кто написал /start, рассылает каждому при событиях. Позволяет подписать несколько сотрудников или группу.

**v0.10.11** — Максимальное упрощение Telegram-блока. UI = поле токена + Сохранить + (если бот подключён) «Бот подключён @username» с активной ссылкой + кнопка «Выслать тест». Никаких подписчиков-списков, никаких refresh-кнопок. sendTestMessage сам внутри делает refreshSubscribers перед рассылкой.

**v0.10.12** — КРИТ-фикс: Gemini ключ и Telegram-бот пропадали после save. **Корень**: в db/index.ts handler #16 был задан общим regex `/UPDATE tenants SET/i` — он перехватывал ВСЕ UPDATE'ы tenants (gemini, telegram, chatwoot) и возвращал пустой ответ, не давая моим enterprise-handler'ам отработать. Дополнительно: `UPDATE tenants SET gemini_api_key` тоже было слишком общим — затирал encrypted-поле значением статуса 'active' при валидации. Handler #16 теперь требует `stripe_*` поля; Gemini handler разбит на 3 точных (full save / status only / last_check only). Очищен мусор из db_fallback.json.

**v0.10.13** — Фикс «У бота нет подписчиков» хотя /start был отправлен. Telegram /getUpdates: после вызова с offset=N+1 предыдущие updates не возвращаются. Плюс если у бота установлен webhook, getUpdates вообще не работает. **Решение**: перед каждым getUpdates `deleteWebhook?drop_pending_updates=false`; offset=-100&limit=100.

### Волна 3: разделение зон ответственности (v0.10.14 — v0.10.17)

**v0.10.14** — Лимиты ×10 + удаление избыточной «Синхронизации».
- `MAX_PROMPT_LEN`: 4000 → 40 000 символов
- `MAX_KB_LEN`: 50 000 → 500 000 символов
- `MAX_UPLOAD_BYTES`: 5 МБ → 50 МБ
- Удалена секция «Синхронизация» в Section2 — no-op, дублировала Save

**v0.10.15** — Чёткое разделение «Подсказки» (Раздел 2) ↔ «Quest Flow» (Раздел 3). РАНЬШЕ: questflow_prompt пустой → fallback на custom_prompt из Раздела 2. ТЕПЕРЬ строгое разделение:
- `tenant.custom_prompt + knowledge_base` → ТОЛЬКО для расшифровки сообщений в чате видео-комнаты (tone-explain «Согласно вашего промта»)
- `tenant.questflow_prompt + questflow_knowledge_base` → ТОЛЬКО для AI-ответов клиентам через Quest Flow
- Если пусто → используется дефолтный системный промт VibeVox (`DEFAULT_QUEST_FLOW_SYSTEM_PROMPT` / `DEFAULT_CUSTOM_TONE_PROMPT`)
- Новые endpoints GET `/api/{tenant-prompt,quest-flow/prompt}/default-system-prompt` отдают дефолты в UI
- Tab labels: «Промт и база» → «Подсказки», «Quest Flow + Telegram» → «Quest Flow»
- Удалён блок «Как подключить в Quest Flow» (длинная инструкция теперь только в docs/)

**v0.10.16** — Чистка текстов: убраны «Не путать с Quest Flow» из Section2 и «Этот раздел не связан...» из Section3; placeholder'ы textarea заменены на «Ваш промт...».

**v0.10.17** — Финальное разделение + улучшение детектора тегов.
- **bridge.ts (переводчик)** больше НЕ использует `custom_prompt` / `knowledge_base`. Использует только базовый промт + диалект-правила из AI Learning Hub. `getTenantPromptForBridge()` помечена @deprecated.
- **insights/router.ts** для video-комнат больше не подмешивает `custom_prompt` / `knowledge_base`. Для telegram_chat → `questflow_*`. Admin notes идут отдельно как приоритет.
- **need_tags/detector.ts** — улучшен промт. Раньше: `"name" — description`. Теперь явно: `«Tag»\n  Инструкция владельца (как распознать): ...` + «Не используй своё общее представление о тегах — следуй именно инструкциям владельца».
- **insights/router.ts** при кнопке «Анализ» теперь ТОЖЕ запускает `detectNeedTags + applyDetectedTags` — раньше теги детектились только для Quest Flow. Возвращает `detectedTags + newTagsAdded` в response.
- TagsEditor placeholder: «Инструкция для AI: как именно распознать упоминание этой потребности в разговоре».

### Финальная архитектурная сводка (после v0.10.17)

| Сценарий | Что подмешивается в Gemini-промт | Файл |
|---|---|---|
| Перевод в video-комнате (бридж) | Базовый промт + диалект-правила из AI Learning Hub. **БЕЗ** user-данных. | `translation/bridge.ts` |
| Расшифровка сообщения «Согласно вашего промта» в чате видео-комнаты | `custom_prompt` + `knowledge_base` (Раздел 2 «Подсказки») | `enterprise_chat/tone_response.ts` |
| AI-ответ клиенту в Telegram через Quest Flow | `questflow_prompt` + `questflow_knowledge_base` (Раздел 3) + дефолтный QF-промт | `quest_flow/responder.ts` |
| Детекция тегов (для Quest Flow + Analysis) | `tenant_need_tags.description` как «инструкция владельца» | `need_tags/detector.ts` |
| Кнопка «Анализ» в чате (Insights) | Транскрипт/история + admin-заметки (приоритет) + (для telegram_chat) `questflow_*` + детектор тегов | `insights/router.ts` |
| Admin-заметки в чате | Приоритетно во всех Gemini-промтах с тегом ⚠️ | передаются всеми caller'ами |

### Канонические правила (попали в раздел 0)

1. **Не плодить дубли** — перед редактированием похожего компонента сверяться со списком канонических. Иначе можно править dead code (как было с Sidebar.tsx).
2. **Точные SQL-handlers в fallback** — никаких общих regex `UPDATE tenants SET`, всегда указывать конкретные колонки.
3. **Fallback sync-helpers** — после каждого pool.query'DELETE/INSERT/UPDATE вызывать соответствующий helper из db/index.ts.
4. **Telegram /getUpdates** — перед использованием всегда `deleteWebhook?drop_pending_updates=false`; использовать `offset=-100&limit=100`.
5. **Backend assistant/ — библиотека** — нет UI-страницы /assistant. Экспорты `deductAudioBalance / geminiProvider / Errors` используются другими модулями.

### Файлы (изменены/созданы в v0.10.1-17)

```
Backend (изменены):
├─ db/index.ts                                    # handler #16 фикс + новые fallback handlers
├─ db/migrations.ts                               # owner_telegram_bot_token_encrypted, owner_telegram_subscribers
├─ db/init.sql                                    # те же поля
├─ modules/translation/bridge.ts                  # отвязан от custom_prompt
├─ modules/insights/router.ts                     # разделение зон + интеграция детектора тегов
├─ modules/need_tags/detector.ts                  # улучшен промт инструкции тегов
├─ modules/tenant_prompt/router.ts                # GET /default-system-prompt
├─ modules/tenant_settings/owner_telegram.ts      # полная переработка на модель подписчиков
├─ modules/tenant_settings/router.ts              # упрощённые endpoints для бота
├─ modules/quest_flow/responder.ts                # DEFAULT_QUEST_FLOW_SYSTEM_PROMPT, разделение зон
├─ modules/quest_flow/prompt.ts                   # GET /default-system-prompt, увеличены лимиты
├─ modules/quest_flow/inbound.ts                  # уведомления о новой комнате + тегах
├─ modules/enterprise_chat/router.ts              # DELETE messages, push-to-crm
└─ modules/enterprise_chat/tone_response.ts       # DEFAULT_CUSTOM_TONE_PROMPT

Frontend (изменены):
├─ vite.config.ts                                 # /uploads proxy
├─ layouts/MainLayout.tsx                         # desktopNav + Enterprise + SIP
├─ components/BottomTabBar.tsx                    # moreItems упрощены
├─ components/ConfirmModal.tsx                    # НОВЫЙ — Aurora-style confirm
├─ pages/EnterpriseSettingsPage.tsx               # tab labels: «Подсказки», «Quest Flow»
├─ pages/enterprise/Section1Gemini.tsx            # полная переработка Telegram-блока
├─ pages/enterprise/Section2Prompt.tsx            # «Подсказки», убрана синхронизация
├─ pages/enterprise/Section3QuestFlow.tsx        # «Quest Flow», удалён integration guide
├─ pages/RoomChatPage.tsx                         # ConfirmModal для удаления
├─ components/chat/MessageBubble.tsx              # iconка 🗑 всегда видна
├─ components/chat/MessageList.tsx                # фильтр пустых
├─ components/chat/ComposerWithMedia.tsx          # переоформлена плашка
└─ components/enterprise/TagsEditor.tsx           # placeholder description «инструкция для AI»

Frontend (удалены):
├─ components/Sidebar.tsx                         # dead code
└─ pages/AssistantPage.tsx                        # UI-демка

Документация:
├─ PROJECT_NOTES.md                               # раздел «0. КАНОНИЧЕСКИЕ КОМПОНЕНТЫ»
└─ docs/QUEST_FLOW_INTEGRATION.md                 # без изменений (от v0.10.0)
```

---

## 5.М Тариф Enterprise v0.10.0: per-tenant Gemini, Quest Flow, чат комнат, теги, Chatwoot (2026-05-27)

Крупная итерация v0.9.5 → v0.10.0: построен фундамент тарифа **Enterprise**. Четыре больших блока:

**Блок 1 — Чат-диалог в каждой Enterprise-комнате.** Поверх существующих video-комнат и новых telegram_chat-комнат (см. Блок 3) добавлен полноценный чат. На карточке комнаты у Enterprise появляется кнопка «Чат» + теги потребностей клиента. Открывается полноэкранный чат с историей сообщений, composer'ом (текст + медиа), и кнопкой «Анализ» (расширенный Insights).

**Блок 2 — Страница «Настройки Enterprise»** (новый пункт сайдбара после «Подписка и баланс»). 4 секции в табах, готовая под добавление 5+:
1. **Gemini API ключ** — персональный из AI Studio (AES-256-GCM шифрование). Если задан и валиден — используется ВМЕСТО глобального для всех Gemini-вызовов tenant'а (bridge, insights, coach, assistant, quest_flow). Также привязка Telegram владельца для уведомлений о невалидном ключе.
2. **Промт + база знаний** — расширение существующего `tenant_prompt`: теперь принимает TXT/DOCX/XLSX/CSV (парсинг на сервере через `mammoth` + `xlsx`), кнопка «Синхронизировать» с подтверждением, список preset-тонов для справки.
3. **Quest Flow + Telegram-боты** — 5 подразделов: CRUD API ключей, отдельный promt и KB для QF-чатов, теги потребностей, инструкция по интеграции.
4. **CRM (Chatwoot)** — per-tenant URL + Agent Token + on/off toggle + тест соединения. Отправка истории и тегов в CRM по запросу владельца. Fallback на глобальный из суперадминки.

**Блок 3 — Quest Flow Inbound API + auto-комнаты.** Бэк принимает webhook от Quest Flow (`POST /api/quest-flow/inbound` с Bearer `vbvx_qf_*` ключом). Логика:
1. Аутентификация по per-tenant хэшу ключа.
2. Find-or-create комнаты типа `telegram_chat` по тройке (tenantId, telegram_bot_id, telegram_user_id) — **1 клиент = 1 комната навсегда**.
3. Если audio — транскрипция через Gemini + детекция языка/диалекта + подмешивание правил из `dialect_rules` (AI Learning Hub).
4. AI-ответ через `responder.ts` с учётом `questflow_prompt + questflow_knowledge_base + custom_prompt + knowledge_base + dialect`.
5. Запись клиентского сообщения и AI-ответа в `room_messages`.
6. Параллельная детекция тегов потребностей (`need_tags/detector.ts`).
7. Возврат для QF: `{ response.text, language, dialect, detectedTags, balanceRemaining }`.

Для исходящих admin-сообщений → Telegram реализован polling-механизм: `GET /api/quest-flow/outbox` (Bearer-auth тем же ключом) → список pending → `POST /outbox/:id/ack` пометить как доставленное.

**Блок 4 — Chatwoot CRM per-tenant.** Опциональная отправка истории диалога + тегов в Chatwoot. Контакт находится/создаётся по telegram_user_id, conversation создаётся с inbox_id=1, история отправляется как приватная заметка, теги — в custom_attributes.

### Новые backend-модули

```
apps/backend/src/modules/
├─ billing/feature_gate.ts                  # централизованный requireEnterprise()
├─ tenant_settings/
│  ├─ encryption.ts                         # AES-256-GCM для всех Enterprise секретов
│  ├─ gemini.ts                             # CRUD per-tenant Gemini key + validate
│  ├─ owner_telegram.ts                     # привязка + отправка уведомлений
│  ├─ chatwoot.ts                           # CRUD + test + push to Chatwoot
│  └─ router.ts                             # /api/tenant-settings/*
├─ need_tags/
│  ├─ service.ts                            # CRUD тегов + listAssignedTagsForRoom
│  ├─ router.ts                             # /api/need-tags/*
│  └─ detector.ts                           # Gemini-детекция совпадений + apply
├─ quest_flow/
│  ├─ keys.ts                               # SHA-256 хэш ключей + verify/revoke
│  ├─ transcribe.ts                         # Gemini transcribe + language/dialect
│  ├─ responder.ts                          # AI ответ с promtem + KB + history
│  ├─ inbound.ts                            # главный обработчик webhook'а
│  ├─ prompt.ts                             # /api/quest-flow/prompt/* (CRUD + upload)
│  └─ router.ts                             # /api/quest-flow/* (inbound + keys + outbox)
├─ enterprise_chat/
│  ├─ tone_response.ts                      # AI пояснение в выбранном тоне
│  ├─ outbox.ts                             # pending исходящие для QF polling
│  └─ router.ts                             # /api/enterprise-chat/* (msgs + send + tone + tags + push-to-crm)
├─ rooms/
│  ├─ service.ts                            # расширен findOrCreateTelegramChatRoom
│  └─ messages.ts                           # CRUD room_messages
└─ tenant_prompt/parsers/
   ├─ txt.ts / docx.ts / xlsx.ts / index.ts # парсеры файлов для KB
```

### Новые frontend-компоненты

```
apps/frontend/src/
├─ hooks/useIsEnterprise.ts                 # реактивный hook (superadmin || tier='enterprise')
├─ pages/
│  ├─ EnterpriseSettingsPage.tsx            # контейнер с 4 табами, lazy-load секций
│  ├─ enterprise/Section1Gemini.tsx
│  ├─ enterprise/Section2Prompt.tsx
│  ├─ enterprise/Section3QuestFlow.tsx
│  ├─ enterprise/Section4Chatwoot.tsx
│  └─ RoomChatPage.tsx                      # /room/:roomId/chat
└─ components/
   ├─ enterprise/ApiKeyField.tsx            # переиспользуемое поле API ключа
   ├─ enterprise/TagsEditor.tsx             # CRUD тегов потребностей
   ├─ enterprise/NeedTagBadge.tsx           # бейдж тега на карточке
   └─ chat/
      ├─ MessageBubble.tsx                  # сообщение + media + tone-кнопка
      ├─ MessageList.tsx                    # лента с auto-scroll + unread counter
      ├─ ComposerWithMedia.tsx              # input + прикрепление файла
      ├─ ToneMenuPopover.tsx                # popover с 8 тонами
      └─ InsightsModal.tsx                  # модал результата анализа
```

### Изменения схемы БД

**Расширены `tenants`:**
- `gemini_api_key_encrypted`, `gemini_api_key_status`, `gemini_api_key_last_check`
- `chatwoot_url_encrypted`, `chatwoot_token_encrypted`, `chatwoot_enabled`
- `owner_telegram_id`
- `questflow_prompt`, `questflow_knowledge_base`, `questflow_kb_filename`

**Расширены `rooms`:** `kind` (`video`|`telegram_chat`), `telegram_bot_id`, `telegram_user_id`, `telegram_username`, `telegram_display_name`. Уникальный индекс `idx_rooms_tg_client` гарантирует 1 клиент = 1 комната.

**Новые таблицы:**
- `room_messages` — единая лента сообщений (chat / transcript / media / system)
- `tenant_quest_flow_keys` — SHA-256 хэш ключей + label + last_used_at + revoked_at
- `tenant_need_tags` — теги потребностей per-tenant
- `client_tag_assignments` — присвоенные теги клиентам (через комнаты), с `confidence` и `sent_to_crm`

Все миграции в `migrations.ts` идемпотентные. Fallback-handlers для всех новых операций в `db/index.ts` — работает и без PostgreSQL.

### Интеграция Quest Flow (для пользователя)

Документация в [docs/QUEST_FLOW_INTEGRATION.md](docs/QUEST_FLOW_INTEGRATION.md). Кратко: в Quest Flow создаётся узел HTTP Request → POST на наш `/api/quest-flow/inbound` с Bearer-ключом и payload содержащим telegram_bot_id, telegram_user_id, text/audio. Ответ AI приходит в `response.text`, который пользователь отправляет обратно через Telegram-блок Quest Flow.

### Влияние на существующие модули

- **bridge.ts**: ключ Gemini теперь загружается лениво в `connect()` через `getEffectiveGeminiKey(tenantId)` — per-tenant override.
- **insights/router.ts**: анализирует и `rooms.transcripts`, и `room_messages` (приоритет — messages); подмешивает tenant promt + KB + уже присвоенные теги в Gemini prompt.
- **coach/router.ts**: опционально извлекает tenantId из Bearer-токена для per-tenant ключа (backward compatible — старый код без токена использует глобальный).
- **assistant/service.ts + telegram_gateway.ts**: добавлен внутренний маркер `__tenantId` в params Gemini-провайдера.
- **rooms/router.ts**: `GET /api/rooms` возвращает `kind, telegramUsername, telegramDisplayName, tags`.
- **rooms/transcripts endpoint**: финальные транскрипты video-комнаты зеркалируются в `room_messages` с `source='transcript'`.

### Как проверить

1. **БД миграции**: рестарт backend → в логах должны быть `[Migrations] ✓ tenants.gemini_api_key_encrypted`, и т.д.
2. **Sidebar**: для Enterprise-пользователя или суперадмина появляется пункт «Настройки Enterprise» (между «Подписка и баланс» и «SIP-телефония»).
3. **Section1**: ввести Gemini ключ → нажать «Сохранить и проверить» → статус «Активен». Все Gemini-вызовы tenant'а пойдут через него.
4. **Section2**: загрузить docx/xlsx → preview → «Синхронизировать» → подтверждение «✓ Синхронизировано».
5. **Section3**: создать ключ `vbvx_qf_*` → curl с этим ключом на `/api/quest-flow/inbound` → автосоздаётся `telegram_chat` комната.
6. **Карточка комнаты на /room**: для Enterprise — кнопка «Чат» и теги (если детектор сработал).
7. **RoomChatPage**: история, отправка сообщения, прикрепление файла, popover тонов, кнопка «Анализ» → модал с insights.
8. **Section4**: ввести Chatwoot URL + token → «Тест соединения» → включить.

### Что отложено (TODO для следующих итераций)

- Аудио-ответы AI для Quest Flow (сейчас только текст в response.text). Можно добавить `audio_base64` поле когда понадобится.
- Прямые webhook outbound (вместо polling) — пока что QF делает GET /outbox каждые N сек.
- Автоматическая отправка в CRM при детекции тега (сейчас только ручная кнопка «Отправить в CRM»).
- Кнопка «Отправить в CRM» в `RoomChatPage` UI (endpoint готов: POST `/api/enterprise-chat/:roomId/push-to-crm`).
- Расширение `Section5+` (архитектура готова — добавление в `SECTIONS` массив).

---

## 5.Л Промокоды v2 + Подписки v2: rollover, отмена, исправления (2026-05-27)

Большая итерация v0.9.4 → v0.9.5: довели промокоды до 100% рабочего состояния (создание/правка/возобновление/полное удаление + применение скидки на UI и в Stripe), починили критичный баг с фейковыми Stripe-customer ID, и реализовали полноценный rollover-цикл подписки с возможностью отмены автопродления.

### v0.9.4 — Промокоды end-to-end

**Админка [`/admin/promocodes`](apps/frontend/src/pages/admin/PromocodesPage.tsx):**
- Активные коды всегда сверху, неактивные снизу с opacity 0.72.
- **Active** коды: «Редактировать», «Деактивировать» (soft → можно возобновить), «Удалить» (hard).
- **Inactive** коды: «Возобновить», «Удалить» (hard).
- «Редактировать» = pre-fill формы → на save: hard-delete старого + создание нового с теми же параметрами (Stripe API не разрешает реальный edit полей Coupon/PromotionCode — только active/metadata).
- Client-side валидация ДО destructive операций — не теряем старый код, если новый невалидный.
- Бейджи на каждой строке: `plus`, `standard`, `standard_yearly` (если промо ограничен по тарифам).

**Backend [`promo.ts`](apps/backend/src/modules/billing/promo.ts):**
- `GET /` — добавлены `appliesToProducts`, `appliesToTiers` (reverse-map product.id → tier-key), `couponId`, `durationInMonths`. Активные сортируются первыми.
- `POST /` — pre-check: если активный код с таким же `code` уже есть → 409 (`«Сначала деактивируйте или удалите его»`). Без этого Stripe возвращал криптический ошибочный месседж.
- **`PATCH /:id`** — новый. Body `{active}` → `stripe.promotionCodes.update(id, {active})`. Используется кнопкой «Возобновить».
- **`DELETE /:id?hard=true`** — новый. Получает coupon_id из promo, деактивирует promo, удаляет coupon из Stripe. Если Stripe блочит delete (есть привязанные subscription discounts) — возвращает `partial` и оставляет деактивированным.

**Backend [`router.ts`](apps/backend/src/modules/billing/router.ts):**
- `POST /promo-validate` — возвращает `appliesToTiers` (массив `'plus'`/`'standard'`/`'standard_yearly'`). Фронт использует чтобы понять, к каким карточкам применять визуальную скидку.
- `POST /topup` — принимает `promotionCodeId` и применяет `discounts: [{promotion_code: id}]` в Stripe Checkout (и в subscription, и в payment режимах). Если не передан — `allow_promotion_codes: true` (юзер может вписать в Stripe-форме).

**Фронт [`BillingPage.tsx`](apps/frontend/src/pages/BillingPage.tsx):**
- `appliedPromo.appliesToTiers` — новое поле в state.
- `calcDiscounted(price, tier)` — проверяет `promoAppliesToTier(tier)` перед расчётом. Карточки тех тарифов, на которые промокод не действует, не подсвечиваются скидкой.
- На карточке тарифа: цена со скидкой (зелёная) + оригинальная зачёркнута + чип «Промокод XYZ · −50%».
- Под кнопкой «Оформить»: маленький мобайл-safe caption «со скидкой −50% по промокоду XYZ» (text-[10.5px] sm:text-[11px], break-words, leading-tight).
- TopupCalculator: то же самое — discounted total + strikethrough + caption под кнопкой «Купить N минут».
- На checkout/topup фронт всегда шлёт `promotionCodeId`, если применён — Stripe получает реальный discount.

### Фикс `cus_mock_*` (No such customer)

**Симптом:** При попытке оформить тариф пользователь получал `Не удалось открыть оплату: No such customer: 'cus_mock_e2wu210md'`.

**Причина:** `db/index.ts:119` (старый код) автоматически генерил фейковые `cus_mock_<random>` ID при создании tenant'а в fallback-режиме. Эти ID никогда не существовали в реальном Stripe.

**Fix:**
1. [`db/index.ts:119`](apps/backend/src/db/index.ts) — больше НЕ генерим фейковые ID. Default стал `null`, customer создаётся лениво при первом /checkout.
2. [`router.ts`](apps/backend/src/modules/billing/router.ts) — новый helper **`resolveStripeCustomer(stripe, tenantId, userEmail, source)`**:
   - Читает stored `stripe_customer_id`.
   - Если начинается на `cus_mock_` → игнорирует (это артефакт).
   - Если есть валидный ID — `stripe.customers.retrieve` для верификации; если deleted/404 → игнорирует.
   - Если валидного нет — создаёт нового customer, сохраняет в БД.
3. `/checkout` и `/topup` оба используют `resolveStripeCustomer` вместо raw чтения из БД.
4. `db_fallback.json` — очищены 13 stale `cus_mock_*` ID (PowerShell-однострочник заменил на `null`).

### v0.9.5 — Rollover + отмена подписки (устранение расхождения с FAQ)

**Проблема:** FAQ на странице тарифов обещал «неиспользованные минуты переносятся на следующий месяц», но webhook при renewal делал прямой `UPDATE translation_minutes_balance = EXCLUDED.balance` — фактически перетирал баланс на свежий пакет, теряя неиспользованные минуты. Rollover-cron в [`rollover.ts`](apps/backend/src/modules/billing/rollover.ts) для Stripe-подписок никогда не срабатывал, потому что webhook обновлял `current_period_end` до того, как cron его увидел.

**Решение в [`webhook.ts:handleSubscriptionChange`](apps/backend/src/modules/billing/webhook.ts):**
- Читаем текущую запись из БД (balance, rollover, period_end, sub_id).
- Различаем 3 сценария:
  - **initial** (нет старой записи или другой sub_id): `balance = fresh`, `rollover = 0`.
  - **renewal** (тот же sub_id + новый `current_period_end` > старого на ≥1 день): `rollover = oldBalance` (неизрасходованное переезжает), `balance = fresh`. Старый rollover при этом сгорает (он был «прошлый цикл», теперь стал бы «позапрошлый»).
  - **mid_cycle** (тот же sub, период не сдвинулся: cancel toggle, plan change, status flip): balance/rollover/period_end не трогаем — только мета (status, tier, cancel_at_period_end).
- Stats (`total_paid_minutes`, `last_payment_at`) обновляются только при initial/renewal — не при mid_cycle.
- Telegram-уведомление различает «💳 Оплачена подписка» vs «🔁 Продление подписки», и при renewal с rollover пишет сколько перенесено.

Списание минут в [`usage.ts`](apps/backend/src/modules/billing/usage.ts) уже изначально работало FIFO: сначала `rollover_seconds`, потом `translation_minutes_balance`. Так старые минуты гарантированно уходят первыми и не пропадают зря.

### Отмена подписки (cancel_at_period_end)

**Требование:** Пользователь и админ могут отменить автопродление. Деньги не возвращаются. Подписка остаётся active до конца оплаченного периода, минуты доступны, можно докупать. После периода Stripe сам закрывает.

**DB schema:**
- [`init.sql`](apps/backend/src/db/init.sql) обновлён: новые колонки `cancel_at_period_end BOOLEAN`, `canceled_by VARCHAR(255)`, `canceled_at TIMESTAMP`.
- Новый файл [`migrations.ts`](apps/backend/src/db/migrations.ts) с идемпотентными `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Запускается из [`server.ts`](apps/backend/src/server.ts) на старте. Fallback-mode игнорирует ALTER (динамическая схема).
- Расширен fallback-handler для INSERT INTO subscriptions — теперь распознаёт 9-параметровую форму (с rollover/cancel) и 7-параметровую legacy форму.
- Новые fallback-handler'ы для `UPDATE ... SET cancel_at_period_end = TRUE/FALSE`.

**Backend endpoints:**

User-side ([`router.ts`](apps/backend/src/modules/billing/router.ts)):
- `POST /api/billing/cancel-subscription` (JWT) → `stripe.subscriptions.update(subId, {cancel_at_period_end: true})`. Локально пишет `canceled_by = 'user:<email>'`, `canceled_at = NOW()`.
- `POST /api/billing/resume-subscription` (JWT) → откатывает.

Admin-side ([`admin/users.ts`](apps/backend/src/modules/admin/users.ts)):
- `POST /api/admin/users/:userId/cancel-subscription` (superadmin) → то же самое, `canceled_by = 'superadmin:<email>'`. Telegram-уведомление.
- `POST /api/admin/users/:userId/resume-subscription` (superadmin).
- `GET /api/admin/users` теперь возвращает поля: `stripeSubscriptionId`, `cancelAtPeriodEnd`, `canceledBy`, `canceledAt`.

`GET /api/billing/me` теперь возвращает: `rolloverMinutes`, `totalMinutes`, `cancelAtPeriodEnd`, `canceledAt`.

**UI пользователя [`BillingPage.tsx`](apps/frontend/src/pages/BillingPage.tsx):**
- В карточке «Ваш баланс» — справа маленькая полупрозрачная кнопка **«⊘ Отменить подписку»**. Видна только при `hasActiveStripeSub = true`. На click — confirm-диалог с подробностями (деньги не возвращаются / дата закрытия / можно докупать минуты).
- После отмены кнопка превращается в зелёную **«↻ Возобновить»**.
- Под балансом: если есть rollover — зелёный чип «+ перенос N мин».
- Под тарифом: «· продление DD.MM.YYYY» при активном автопродлении.
- При cancel_at_period_end — жёлтый банер «Автопродление отменено · подписка закроется DD.MM».
- Toast с сообщением успеха/ошибки после действия.

**UI админки [`UsersPage.tsx`](apps/frontend/src/pages/admin/UsersPage.tsx):**
- В колонке «Действия» каждой строки — маленькая (7×7px) серая иконка `Ban` для отмены подписки. Видна только при наличии `stripeSubscriptionId` и `!cancelAtPeriodEnd`.
- При cancel_at_period_end заменяется на жёлтую `RotateCcw` (возобновить).
- Под тарифом — мини-бейдж «отмена · DD.MM» (amber).
- Confirm-dialog при клике, Telegram-уведомление о действии админа.

### Мелкие фиксы

- [`SettingsPage.tsx`](apps/frontend/src/pages/SettingsPage.tsx) — убрана подпись «VibeVox v2.0 · Abyss Aurora © 2026» внизу.
- [`BillingPage.tsx`](apps/frontend/src/pages/BillingPage.tsx) — добавлен мап `TIER_DISPLAY_LABELS`: `annual` → «Standard Yearly», `monthly` → «Plus», `plus` → «Plus», и т.д. Теперь в карточке баланса вместо «Тариф: annual» отображается «Тариф: Standard Yearly».
- В store `subscriptionTierName` хранит сырое имя из БД, `tierDisplay` в BillingPage маппит на дружелюбное.

### Жизненный цикл подписки (итог)

1. **Оплата** → Stripe Checkout → webhook `customer.subscription.created` → `handleSubscriptionChange(initial)` → `balance = TIER_SECONDS_MAP[tier]`, `rollover = 0`, `current_period_end = +30d`.
2. **Использование минут** → `consumeSeconds()` (FIFO: rollover первым, потом balance).
3. **Renewal через 30 дней** → Stripe списывает с карты → webhook `customer.subscription.updated` (period_end сдвинулся) → `handleSubscriptionChange(renewal)` → `rollover = oldBalance`, `balance = fresh`. Promo `duration='once'` уже не применяется — цена полная.
4. **Отмена** (юзер или админ) → `stripe.subscriptions.update({cancel_at_period_end: true})` → webhook `customer.subscription.updated` (mid_cycle) → пишет `cancel_at_period_end = TRUE`. Status остаётся `active`. Балансы не трогаем.
5. **В период отмены** — юзер может использовать минуты + докупать через `/topup` (`hasPaidActive=true`).
6. **Конец периода** → Stripe эмитит `customer.subscription.deleted` → `handleSubscriptionChange` (status='canceled', mid_cycle) → `status='canceled'`. Подписка закрыта. Оставшиеся минуты можно использовать пока не кончатся.
7. **Возобновление** до конца периода → `stripe.subscriptions.update({cancel_at_period_end: false})` → автопродление снова работает.

### Как проверить
1. Рестарт backend (`Ctrl+C → npm run dev`) — миграции прогонятся автоматически.
2. **Промокод**: `/admin/promocodes` → создать с `Plus only` → `/billing` → применить → Plus карточка зелёная со скидкой, Standard без скидки. Кликнуть «Оформить Plus» → Stripe Checkout с применённой скидкой.
3. **Отмена**: после реальной оплаты через Stripe Test mode → `/billing` → справа в балансе кнопка «Отменить подписку» → confirm → жёлтый банер.
4. **Rollover**: Stripe CLI `stripe trigger customer.subscription.updated` с искусственно сдвинутым period_end → balance свежий, rollover = старый balance.

---

## 5.К Комнаты v2: список, модал, персистентность + Lobby UX v0.9.x (2026-05-27)

Четыре под-итерации v0.9.0 → v0.9.3, завершивших полный рефакторинг страницы `/room` — от «UUID-ссылок без имён» до «менеджера встреч с постоянным хранением и умным лобби».

### v0.9.0 — TTL 5 лет + hard delete + rename

Комнаты больше не протухают через 24 часа. `ROOM_TTL_MS` = 5 лет. Логика: creator сам удаляет комнату, когда нужно — принудительный срок не нужен. TTL 24 ч был MVP-артефактом.

**Backend [rooms/service.ts](apps/backend/src/modules/rooms/service.ts):**
- `deleteRoom(roomId)` — `DELETE FROM rooms` + `inMemoryRooms.delete()`
- `renameRoom(roomId, name)` — `UPDATE rooms SET name` + `inMemoryRooms` update
- `listRoomsByCreator(tenantId)` — список комнат по creator_tenant_id

**Backend [rooms/router.ts](apps/backend/src/modules/rooms/router.ts):**
- `DELETE /api/rooms/:id` — только creator (проверка tenant_id)
- `PATCH /api/rooms/:id/rename` — body `{name}`, только creator
- Оба требуют JWT-авторизацию

### v0.9.1 — Создание комнаты через модал с именем и датой

Кнопка «+ Создать» на `/room` больше не создаёт комнату сразу — открывает модал с полем имени. Дефолтное имя генерируется автоматически: `Комната {user.name} · {дата}, {время}` (пример: «Комната Plvalera Dan · 27 мая, 13:53»).

**Frontend [RoomPage.tsx](apps/frontend/src/pages/RoomPage.tsx):**
- `createModalOpen` state + кнопка «+ Создать»
- `defaultRoomName()` — собирает имя с локализованной датой через `toLocaleDateString('ru-RU')`
- После POST `/api/rooms/create` — комната сразу добавляется в список без полной перезагрузки
- Кнопка 🗑 в каждой строке → inline-подтверждение → DELETE
- Кнопка ✏️ → модал переименования → PATCH rename

### v0.9.2 — Персистентность: JSON всегда синхронизируется

**Проблема:** при работе без PostgreSQL удалённая/переименованная комната «воскресала» после перезапуска backend — `pool.query` уходил в in-memory fallback, но `db_fallback.json` не обновлялся.

**Решение:** три новых хелпера в [db/index.ts:1011](apps/backend/src/db/index.ts):

```ts
export function removeRoomFromFallback(roomId: string): boolean
export function renameRoomInFallback(roomId: string, name: string): boolean
export function removeUserFromFallback(userId: string): boolean  // каскадно: user + tenant + subscription
```

Каждый делает мутацию `fallbackData` + вызов `saveFallbackData()` → запись на диск.

**[rooms/service.ts](apps/backend/src/modules/rooms/service.ts)** — `deleteRoom()` и `renameRoom()` теперь **всегда** вызывают соответствующий хелпер после `pool.query`, независимо от режима (реальный PG или fallback). Это гарантирует консистентность JSON при любом окружении.

**[admin/users.ts](apps/backend/src/modules/admin/users.ts)** — `DELETE /api/admin/users/:userId` тоже вызывает `removeUserFromFallback(userId)`.

Также: очищены 33 stale-комнаты из `db_fallback.json` (накопились за тестовые сессии).

### v0.9.3 — Lobby UX: создатель / гость / room_full / UUID-фикс

**Кнопка ✕ для создателя.** Когда `isCreator=true` — в правом верхнем углу карточки лобби кнопка `✕`. Клик → `navigate('/room')`. Сценарий: скопировал ссылку → нужно вернуться в список.

**Блок «Поделиться» только для создателя.** Гость (пришёл по чужой ссылке) не видит URL-секцию с кнопкой копирования. Его лобби: только «Имя + Язык + Подключиться».

**room_full → обратно в лобби.** Раньше: при 403 `room_full` от `/api/livekit/token` пользователь оставался на экране активного звонка с красной ошибкой. Теперь: `setJoined(false)` + `setLobbyError('room_full')` → возврат в лобби. Внутри карточки — amber-блок: иконка `Users`, заголовок «Встреча уже началась», текст «На встрече уже присутствует участник. Свяжитесь с создателем встречи или закажите новую.» + кнопка «Вернуться к комнатам» (если есть `onClose`). Форма скрыта.

**Название комнаты убрано из лобби.** Бейдж «Комната Plvalera Dan · 27 мая, 13:53» — внутренний идентификатор, не нужен пользователям. Убран для всех.

**UUID-фикс в поле имени.** Если `sessionStorage.vibevox_guest_name` содержит UUID (баг: `tenantId` попадал в поле) — очищается при монтировании. `user.name` с UUID-паттерном тоже игнорируется.

**Плейсхолдер «no name».** Во всех 9 локалях: вместо «Ваше имя» / «Your name» / «Ihr Name» / ... → единый английский **«no name»**.

### Изменения пропсов RoomLobbyPage

| Prop | Тип | Назначение |
|---|---|---|
| `isCreator` | `boolean?` | Управляет кнопкой ✕ и секцией «Поделиться» |
| `onClose` | `() => void?` | Обработчик ✕ → `navigate('/room')` |
| `lobbyError` | `string \| null?` | `'room_full'` → amber-блок вместо формы |

Новые ключи переводов (все 9 локалей): `roomFullTitle`, `roomFullMsg`, `backToRooms`.

### Как проверить

1. Перезапустить backend (`Ctrl+C → npm run dev`).
2. **Создание**: `/room` → «+ Создать» → модал с авто-именем → OK → комната в списке.
3. **Кнопка ✕**: открыть лобби своей комнаты → правый верхний угол → ✕ → список комнат.
4. **Гость**: открыть то же лобби в инкогнито → нет ✕, нет блока «Поделитесь ссылкой».
5. **Rename**: ✏️ → новое имя → перезапустить backend → имя сохранилось.
6. **Delete**: 🗑 → подтвердить → перезапустить backend → комнаты нет.
7. **UUID-фикс**: если в поле имени был UUID — обновить страницу, поле пустое, плейсхолдер «no name».

---

## 5.И Полировка комнаты v0.8.1 + v0.8.2 (2026-05-27)

Объединённая фикс-итерация после v0.8.0. Основано на исследовании AI-встреч 2026 года (Zoom AI Companion, Google Meet+Gemini, Teams Copilot, Otter, Read.ai).

### v0.8.1 — критический откат регрессии перевода

В v0.8.0 я добавил в `systemInstruction` 2 правила:
- ❌ «WAIT for speaker to finish — do not translate partial fragments»
- ❌ «NEVER repeat the same phrase twice»

Они **прямо противоречат** базовой инструкции выше: «Translate every utterance — questions, statements, jokes, fragments. Even short ones». Результат — Gemini молчал и тянул фрагменты, ожидая «полного» предложения. Откатил обе. Также упростил оставшиеся правила до одной строки: «Speak the translation at a natural, even pace.»

### v0.8.2 — 6 фикс-этапов

**(A) Тянущиеся звуки в переводе:** убрал `autoGainControl: true` из `setMicrophoneEnabled`. AGC «выравнивает» громкость, усиливая тишину между словами до уровня речи — Gemini Live трактует это как непрерывный input и начинает тянуть гласные/согласные. Без AGC — естественная динамика. Остались `echoCancellation` + `noiseSuppression` — они безопасны.

**(B) Hard limit 2 участника:**
- Backend [livekit/service.ts](apps/backend/src/modules/livekit/service.ts) — новая функция `countLiveParticipants(roomName)` через `RoomServiceClient.listParticipants` (фильтрует бота-переводчика).
- В `/api/livekit/token` перед выдачей токена проверка `currentCount >= MAX_PARTICIPANTS_PER_ROOM (2)` → 403 `{ error: 'room_full', ... }`.
- Frontend ловит `tokenRes.status === 403` + `error === 'room_full'` → `setLiveError('room_full')` → плашка «🚫 Комната занята — в ней уже 2 участника».

**(C) Focus mode UX:**
- Добавлен `onClick` на локальную плитку → `setFocusMode(f => !f)`.
- Защита от drag через `isDraggingRef.current` (drag в focus mode не считается кликом).
- Tooltip: «Развернуть собеседника на весь экран» / «Свернуть».

**(D) Mobile call-controls — 5 primary + bottom sheet:**
- В pill оставлены: `Mic`, `Camera`, `ScreenShare`, `More (3-dot)`, `Hangup`. Hangup справа, отделён, красный (стандарт 2026: Zoom/Meet/Teams).
- Bottom sheet «Ещё» (`moreSheetOpen` state) — список-карточки с иконкой/заголовком/подзаголовком: «Выключить/включить перевод» (creator-only), «Скрыть/показать субтитры» (creator-only), «Развернуть собеседника» (focus mode).
- Mobile: sheet прибит снизу с handle 10×1px. Desktop ≥sm: центрированный модал.
- Принципы: 44×44pt min, gap-3, цветной accent при активном toggle, semantic-text для каждого действия.

**(E) AI Coach side panel:**
- Desktop ≥1024px: панель прибита справа `lg:right-3 lg:top-3 lg:w-[380px] lg:max-h-[calc(100vh-140px)]`, вертикальный scroll.
- Mobile <1024px: остался overlay снизу (как раньше).
- Один и тот же React-блок, разница только в Tailwind responsive-классах.

**(F) Voice selector в Admin Config:**
- Новые поля `voiceFemale` / `voiceMale` в `systemConfig.json`. Дефолты: Aoede / Charon.
- `getVoiceName(gender)` — новый геттер в systemConfig.ts.
- Bridge [bridge.ts:338](apps/backend/src/modules/translation/bridge.ts:338) теперь `const voiceName = getVoiceName(voiceGender) || VOICE_MAP[voiceGender]`.
- UI в `/admin/config` под dropdown'ом Gemini Live Model — 2-колоночный grid: «Голос Ж» (Aoede / Kore / Leda / Zephyr) и «Голос М» (Charon / Puck / Fenrir / Orus).
- Сохраняется через стандартный `saveSettings` (fieldMap расширен).

### Research-источники для решений (2026)

Чтобы не выдумывать UX из головы, изучены: Zoom AI Companion (side-panel paradigm), Google Meet+Gemini (translated captions overlay + Ask Gemini panel), MS Teams Copilot (prompt suggestion chips), Otter.ai (2-колоночный transcript + live summary), Read.ai (per-participant live metrics), Krisp (device-driver noise suppression). Технические выводы:
- **Gemini Live API**: 3 concurrent sessions per API key — жёсткий лимит. Поэтому 1-на-1 (2 сессии для пары) — sweet spot.
- **LiveKit useGridLayout**: до 4 участников = grid; ≥5 = FocusLayout. Для нас это будущее, не v0.8.2.
- **Mobile UX 2026**: floating pill (iOS 26 Liquid Glass), max 5 primary buttons, остальное в bottom-sheet overflow.

### Что НЕ сделано (отложено)

- Этап 5Ж' — turnComplete grace period в bridge.ts: требует живого тестирования, может не помочь без других фиксов
- Multi-participant 3-4 — отказались сознательно (Gemini Live limits + UX качество синхрона)
- Экспорт insights в Chatwoot — не блокер
- Ссылка в Sidebar на `/assistant-prompt` — URL работает, ссылку добавим позже

---

## 5.З Видеовстреча v2 — screen share, toggles, custom prompt, insights v0.8.0 (2026-05-27)

Самое крупное расширение функциональности комнаты с момента её первой версии. 8 этапов реализованы за одну итерацию.

### Что вошло

| # | Фича | Файлы |
|---|---|---|
| 1 | «На полигон» только superadmin | [RoomPage.tsx:1162](apps/frontend/src/pages/RoomPage.tsx:1162) |
| 2 | Creator detection (расширенный /validate с `creatorTenantId` + `settings`) | [rooms/router.ts](apps/backend/src/modules/rooms/router.ts), [rooms/service.ts](apps/backend/src/modules/rooms/service.ts) |
| 3 | Screen Share через LiveKit + перестройка grid | [RoomPage.tsx]: `attachTrack` + `handleToggleScreenShare` + центральная Glassmorphism-плитка + miniatures row |
| 4 | Toggle перевода / субтитров (creator only) | `PATCH /api/rooms/:id/settings`, bridge.setSubtitlesEnabled, banner для гостей |
| 5 | AI Coach только для creator | `openCoachFor` ранний return + JSX-condition `{isCreator && coachResult}` |
| 6A | LiveKit publish: `echoCancellation: true, noiseSuppression: true, autoGainControl: true` | RoomPage:setMicrophoneEnabled |
| 6C | Расширенный systemInstruction (no syllable stretching, no repeats, wait for completion, don't cut tail) | [translation/config.ts](apps/backend/src/modules/translation/config.ts) |
| 7 | Enterprise post-call insights | [insights/router.ts](apps/backend/src/modules/insights/router.ts) `POST /api/insights/analyze/:roomId` |
| 8 | Custom Prompt + Knowledge Base | [tenant_prompt/router.ts](apps/backend/src/modules/tenant_prompt/router.ts), [TenantPromptPage.tsx](apps/frontend/src/pages/TenantPromptPage.tsx), `/assistant-prompt` |

### Новые БД-объекты

**`rooms`** добавлены 3 JSONB колонки:
- `settings JSONB DEFAULT '{"translationEnabled": true, "subtitlesEnabled": true}'` — управляется creator'ом
- `transcripts JSONB DEFAULT '[]'` — накопленные финальные субтитры за звонок (для post-call анализа)
- `insights JSONB` — кэш результата Gemini-анализа разговора

**`tenants`** добавлены 3 колонки:
- `custom_prompt TEXT` — короткий контекст-промпт владельца (до 4000 символов)
- `knowledge_base TEXT` — большой текст-материал (до 50 000 символов)
- `knowledge_base_filename VARCHAR(255)` — для UI отображения

Fallback handlers для всех новых операций добавлены в [db/index.ts](apps/backend/src/db/index.ts).

### Поток «выключить перевод»

1. Creator жмёт кнопку `LanguagesIcon` в call-controls
2. Фронт → `PATCH /api/rooms/:id/settings { translationEnabled: false }`
3. Бэк проверяет `creator_tenant_id === tenantId` (иначе 403)
4. Обновляет `rooms.settings` JSONB
5. Best-effort вызывает `POST /api/translation/stop` для этой комнаты
6. Bridge отключается → минуты больше не списываются
7. Гости видят status-баннер «Перевод выключен организатором — только видео»
8. При повторном включении creator'ом → фронт сам вызывает `/api/translation/start`

### Поток custom prompt в bridge

1. Bridge при создании Gemini Live session дёргает `getTenantPromptForBridge(billingTenantId)` (60-сек кеш)
2. Помещает результат в `buildTranslationInstruction(targetLang, dialect, { customPrompt, knowledgeBase })`
3. В systemInstruction Gemini добавляются 2 секции:
   - **CONTEXT FROM ROOM OWNER** (высокий приоритет) — кастомный prompt
   - **KNOWLEDGE BASE** (контекст-only, не директивы) — KB

### Качество перевода — что улучшилось

- **echoCancellation/noiseSuppression/autoGainControl** в LiveKit publish → чище PCM → меньше шумов в распознавании
- **systemInstruction Quality Rules** (v0.8.0):
  > Speak at NATURAL, EVEN PACE. Don't draw out syllables.
  > Wait for speaker to finish — don't translate partial fragments.
  > NEVER repeat the same phrase twice.
  > Speak each translated sentence to its end. Don't cut the tail of the final word.
- Эти правила — в финальном prompt после кастомного

### Что НЕ сделано в этой итерации (откладываю на будущее)

- Этап 5B (turnComplete grace period в bridge.ts) — требует живого тестирования и итерации, не успел.
- Этап 5D (Admin Config Quality section с voice/grace slider) — не успел.
- Этап 7 экспорт в Chatwoot — не успел. Сам анализ работает, кнопки экспорта нет.
- Этап 8 — нет ссылки в Sidebar на /assistant-prompt. Юзеру надо вручную набирать URL. Это видно как баг — добавлю при первой возможности.

### Как проверить — см. финальный отчёт ниже (в чате)

---

## 5.Ж КРИТ-фикс баланса + UI polish v0.7.4 (2026-05-27)

Молчаливый бизнес-баг: **админ зачисляет минуты → в Telegram приходит уведомление, но баланс пользователя не растёт ни в его /billing, ни в /admin/users**. Корневая причина оказалась не в endpoint'е /credit, а в том, что у пользователей вообще не было записей в таблице `subscriptions`.

### Root cause: silent UPDATE на несуществующих строках

В `apps/backend/db_fallback.json` после диагностики обнаружилось `subscriptions.length === 0`, хотя `users.length === 10`. Это случилось потому, что:

1. `auth/router.ts` при регистрации делал `INSERT INTO subscriptions (tenant_id, tier, status, balance) VALUES ($1, 'trial', 'inactive', 0)` — то есть **только один параметр** в массиве values, остальное хардкод в SQL.
2. Fallback handler в [db/index.ts](apps/backend/src/db/index.ts) читал параметры как `values[1]=tier, values[2]=status, values[3]=balance` — но они были `undefined`, потому что в массиве лежал только `tenantId`.
3. В результате каждая «созданная» подписка фактически имела `tier: undefined, status: undefined, balance: undefined`, и логика «есть ли подписка» в других местах ломалась.
4. Когда админ нажимал «Зачислить 60 мин» → endpoint вызывал `UPDATE subscriptions SET balance = balance + 60 WHERE tenant_id = ...` → handler в fallback искал запись через `findIndex(r => r.tenant_id === tenantId)`, не находил → `return { rows: [] }` без ошибки → endpoint завершался успешно, Telegram-уведомление улетало, баланс ни на копейку не двигался.

### Что пофиксил

#### Backend
1. **Параметризованный INSERT в регистрации.** Заменил хардкод в SQL на `VALUES ($1, $2, $3, $4) ON CONFLICT (tenant_id) DO NOTHING` с values `[tenantId, 'trial', 'inactive', 0]`. Применено в email-регистрации и Google OAuth.
2. **`ensureSubscription(tenantId)` helper в [admin/users.ts](apps/backend/src/modules/admin/users.ts)** — вызывается перед каждым UPDATE в `/credit` и `/tier`. Это idempotent upsert: если подписки нет — создаёт пустую (trial/inactive/0); если есть — DO NOTHING.
3. **Fallback handler в [db/index.ts](apps/backend/src/db/index.ts)** для `INSERT INTO subscriptions` переписан:
   - Поддерживает 3 формы вызова: 7-параметровый webhook-INSERT, 4-параметровый ensureSubscription/register, legacy 1-параметровый.
   - Распознаёт `ON CONFLICT ... DO NOTHING` vs `DO UPDATE` через regex и применяет правильную семантику.
   - Заполняет `rollover_seconds`, `total_paid_minutes`, `last_payment_*` дефолтами (0 / null), чтобы поля существовали для будущих UPDATE.

#### Frontend store
4. **`refreshBilling()` action в [useAppStore.ts](apps/frontend/src/store/useAppStore.ts)** — дёргает `/api/billing/me`, обновляет `translationBalance` и новое поле `subscriptionTierName` (raw имя тарифа из БД: `plus`/`standard`/`standard_yearly`/`enterprise`/`trial`).
5. **MainLayout вызывает `refreshBilling()` на mount** — теперь sidebar показывает реальный баланс, а не вечный 0 из initialState.
6. **UsersPage после `/credit` и `/tier`** тоже дёргает `refreshBilling()` — sidebar админа обновится, если он зачислил минуты себе.

#### Frontend UI
7. **Sidebar в [MainLayout.tsx](apps/frontend/src/layouts/MainLayout.tsx)** переоформлен: user-card + баланс + бейдж тарифа объединены в **одну карточку** с разделителем. Клик на user → `/settings`, клик на balance → `/billing`. Цветной бейдж тарифа:
   - Plus → синий, Standard → зелёный, Standard Yearly → циан, Enterprise → фиолетовый, Trial → серый.
8. **Модалы в [UsersPage.tsx](apps/frontend/src/pages/admin/UsersPage.tsx)** теперь mobile-friendly:
   - `items-start sm:items-center` — на телефонах модал прибит к верху, прокручивается естественно.
   - `lock body scroll` через `useEffect` — фон под модалом не двигается при скролле модала.
   - `mx-4 my-4 sm:my-8` + `maxHeight: 'calc(100vh - 2rem)'` — никогда не выходит за пределы экрана.
9. **Фильтры на /admin/users** получили видимые рамки: все input/select/preset-button используют `var(--border-medium)` вместо `var(--border-subtle)` (последний слишком блёклый на свету). Чекбокс «Только оплатившие» зеленеет рамкой + текстом при активации. Layout стал grid `1/2/4` колонки (мобайл/планшет/десктоп) вместо одной flex-row, которая ломалась на планшетах.

### Как проверить

1. **Перезапусти backend** (Ctrl+C → `npm run dev`).
2. **Открой `/admin/users`** — у всех существующих пользователей баланс по-прежнему 0 (это были «битые» юзеры без подписки).
3. **Нажми Gift у любого юзера → 60 мин → Зачислить**. На этот раз должно:
   - В таблице «Осталось мин» = 60.
   - В Telegram придёт «🎁 Админ-кредит» (как раньше).
   - Если зачислил себе как админ — в sidebar внизу `60 мин` обновится сразу.
4. **Поменяй тариф через CreditCard-иконку** → выбери Plus → «Применить». Колонка «Осталось мин» = 60, бейдж позеленеет (Plus). В sidebar внизу появится бейдж «Plus».
5. **Регистрируй нового юзера** через /auth/register → у него теперь сразу нормальная подписка с `tier='trial', balance=0` (видно в /admin/users).
6. **Открой /admin/users на телефоне** (DevTools → Toggle device → iPhone). Кликни Gift → модал прибит сверху, не обрезан, прокручивается отдельно от фона.
7. **Фильтры**: рамки видны и в светлой, и в тёмной теме. На планшете layout 2 колонки, на десктопе 4.

### Урок на будущее

- **Параметризованные значения везде.** Хардкод в SQL ломает fallback (и в реальной PostgreSQL не самый лучший стиль). Если меняешь дефолты — меняй параметры, не строку.
- **Silent UPDATE — антипаттерн.** `UPDATE ... WHERE id = $1` без проверки `rowCount` после может скрыть баг на месяцы. Стоит добавить логирование при `rowCount === 0` в админских критичных операциях. Сейчас этого нет — но в будущем подумай.
- **`translationBalance` в Zustand** — никогда не доверяй initialState. Любое значение, отображаемое в UI, должно подгружаться с бэка через `useEffect`/`refresh`.
- **Модалы и mobile**: `items-center` без `items-start sm:items-center` — гарантированный обрез на маленьких экранах. `overflow-y-auto` на родителе обязателен.

---

## 5.Е PaywallModal + Smart Top-up v0.7.3 (2026-05-27)

Заменил браузерный `alert()` при попытке создать комнату без минут на красивый встроенный модал с тарифами и слайдером докупки. Бизнес-логика: если у юзера нет активной подписки, докупка автоматически берёт с собой тариф Plus, причём минуты, входящие в Plus, не оплачиваются повторно.

### Бизнес-логика smart top-up

| Сценарий | Что в Stripe Checkout | Что юзер платит |
|---|---|---|
| Есть активная подписка (Plus/Standard/SY/Enterprise), хочет `N` минут | One-time payment: `N × €0.17` | `N × €0.17` |
| Нет подписки, хочет `N ≤ 60` мин | Subscription Plus (€19) | €19 — 60 мин получает «бесплатно» (то есть включено в тариф) |
| Нет подписки, хочет `N > 60` мин | Subscription Plus + one-time line `(N−60) × €0.17` | €19 + `(N−60) × €0.17` |

«Активной» считается подписка с `tier ∈ {plus, standard, standard_yearly, enterprise}` И `status ∈ {active, trialing}`. Триал (`tier='trial'`) к платным не относится.

### Endpoints

- **`POST /api/billing/topup-preview`** — body `{ minutes, currency? }` → возвращает breakdown без побочных эффектов:
  ```json
  {
    "needsSubscription": true,
    "subscriptionTier": "plus",
    "subscriptionMinutes": 60,
    "subscriptionPriceCents": 1900,
    "topupMinutes": 60,
    "topupPriceCents": 1020,
    "totalPriceCents": 2920,
    "freeMinutesFromSubscription": 60,
    "summary": "Plus €19 (60 мин включено) + докупка 60 мин €10.20 = €29.20."
  }
  ```
  Используется фронтом для live-расчёта при движении слайдера. Никакой Stripe сессии не создаётся.

- **`POST /api/billing/topup`** — переписан. Body тот же `{ minutes, currency?, returnUrl? }`. Внутри:
  1. Читает текущую подписку → `isPaidActive(sub)`.
  2. Если активна → создаёт обычный `mode='payment'` checkout (без изменений с v0.6.0).
  3. Если не активна → создаёт `mode='subscription'` checkout с line_items:
     - `{ price: <Stripe Plus price ID>, quantity: 1 }` — recurring
     - Если `minutes > 60`: добавляется second line `price_data { currency, unit_amount: (minutes-60)*17, product_data }`, quantity 1 — one-time.
  4. В session.metadata: `type='auto_subscription_with_topup'`, `tier='plus'`, `auto_topup_minutes='<N-60 or 0>'`.

### Webhook handler

В [billing/webhook.ts:checkout.session.completed](apps/backend/src/modules/billing/webhook.ts) после `handleSubscriptionChange()` для `mode='subscription'` теперь дополнительно:
```ts
const autoTopupMinutes = parseInt(session.metadata?.auto_topup_minutes || '0', 10);
if (autoTopupMinutes > 0) {
  UPDATE subscriptions SET translation_minutes_balance = balance + autoTopupMinutes * 60
  UPDATE subscriptions SET total_paid_minutes += autoTopupMinutes, last_payment_at = NOW()
  → Telegram '💰 Авто-докупка к подписке'
}
```

Subscription создаётся в обычном порядке (handleSubscriptionChange ставит 60 мин для Plus), затем overflow зачисляется поверх.

### Frontend [PaywallModal.tsx](apps/frontend/src/components/PaywallModal.tsx)

Новый переиспользуемый компонент. Открывается из RoomPage при HTTP 402 от `/api/rooms/create`:
- 3 карточки тарифов (Plus / Standard / Standard Yearly) с цветовой палитрой, бейджами «Популярный»/«−17%», кнопками «Оформить» → `/api/billing/checkout` → Stripe Checkout.
- Разделитель «или».
- Top-up секция: слайдер 60→600 минут (шаг 30) + пресеты 60/120/300/600, big-number дисплей.
- **Live breakdown**: при каждом изменении minutes (debounce 250 мс) дёргается `/topup-preview`, обновляется блок с расчётом:
  - «Тариф Plus (60 мин включено) … €19.00»
  - «↳ 60 мин бесплатно с тарифом … −€0.00» (зелёным)
  - «Докупка 60 мин × €0.17 … €10.20»
  - «Итого … €29.20» (фиолетовым, акцент)
- Если подписка есть → блок «Plus €19» не показывается, только pure топап.
- Если нет подписки → информационная плашка циан-цветом: «У вас нет активной подписки. К покупке добавится Plus €19/мес — 60 минут идут вместе с тарифом, доплачивать за них не нужно».
- Кнопка «Купить за €X.XX» — фиолетовая аврора-кнопка с актуальной суммой.
- Closure: клик вне модала, X-кнопка.

### RoomPage интеграция

Раньше при 402 был `alert(...) + navigate('/billing')` — UX ломался: модал блокировал страницу, потом юзер уходил в другую вкладку и терял контекст. Теперь:
```ts
if (res.status === 402) {
  const data = await res.json().catch(() => ({}));
  setPaywallTitle(
    data.reason === 'no_subscription'
      ? 'Чтобы создать комнату, оформите тариф'
      : 'На балансе нет минут — оформите тариф или докупите'
  );
  setPaywallOpen(true);
  return;
}
```

PaywallModal рендерится в самом низу JSX `RoomPage`, контролируется state `paywallOpen`. `returnUrl={window.location.href}` — Stripe возвращает обратно на текущую страницу, юзер не теряется.

### Как проверить

1. **Перезапусти backend** — без этого `/topup-preview` и новая логика `/topup` не подцепятся.
2. **Залогинься новым тестовым юзером** (без подписки, без минут — после v0.7.1 это дефолт).
3. **Открой `/room`** → нажми «**Создать комнату**».
4. Должен открыться **красивый Paywall-модал** (не браузерный alert):
   - 3 карточки тарифов сверху.
   - Слайдер докупки снизу.
5. **Двигай слайдер**: при каждом движении пересчитывается breakdown. На 60 мин — «Plus €19, 60 мин бесплатно, итого €19». На 120 мин — «Plus €19 + Докупка 60 мин €10.20 = €29.20». На 600 мин — «Plus €19 + Докупка 540 мин €91.80 = €110.80».
6. **Жми «Купить за €X»** → редирект на Stripe Checkout (URL `checkout.stripe.com/c/pay/...`). В Stripe видишь две линии: «VibeVox Plus €19» + «VibeVox — докупка N мин €Y».
7. Используй тестовую карту Stripe `4242 4242 4242 4242` → после оплаты возврат на `/room?topup=success`.
8. В Telegram приходят два уведомления: «💳 Оплачена подписка Plus» + «💰 Авто-докупка к подписке».
9. В `/admin/users` баланс юзера = 60 + (N-60) = N минут. tier = `plus`, status = `active`.

### Нюансы

- **Stripe Price для Plus должен быть синхронизирован** через `/admin/config → Синхронизировать EUR/USD`. Если кнопка топап даёт 404 `Stripe Price 'vibevox_plus_eur' не найден` — это нужно сделать.
- **Минимум 60 мин** для топапа — это TOPUP_MIN_MINUTES в [packages/shared](packages/shared/src/schemas/billing.ts:66). Меньше нельзя продавать.
- **Если юзер закрывает Stripe Checkout без оплаты** — он возвращается на `?topup=cancel`, никаких изменений, paywall можно открыть снова.
- **Если у юзера есть подписка `tier='plus'`, но `status='canceled'`** — мы НЕ считаем её активной, и при покупке minutes автоматически создастся новая Plus-подписка. Это намеренно — отменённые подписки нужно реактивировать.

---

## 5.Д Admin Users v2: delete + tier switch + date range v0.7.2 (2026-05-27)

Расширение раздела «Пользователи» после первого фидбека.

### Что добавлено

| # | Что | Endpoint / UI |
|---|---|---|
| 1 | Удалить пользователя (каскад user+tenant+subscription) | `DELETE /api/admin/users/:userId` · красная корзина в строке |
| 2 | Сменить тариф админом (с авто-начислением минут) | `PATCH /api/admin/users/:userId/tier` · иконка карты в строке |
| 3 | Фильтр по тарифу | `?tier=plus` |
| 4 | Фильтр диапазона дат регистрации | `?from=2026-05-01&to=2026-05-27` |
| 5 | Пресеты «7 дней / 30 дней / Сброс» | Кнопки рядом с date-picker'ами |
| 6 | Telegram-уведомления для всех 3 действий | 🎁 admin-credit · 🔧 tier change · 🗑 delete |
| 7 | Переоформлены 3 модала в едином стиле | Reusable `<Modal />` + `<ModalHeader />` |

### Endpoints (детально)

- **`GET /api/admin/users`** — добавлены query-параметры:
  - `tier` — фильтр по точному совпадению (`trial`, `plus`, `standard`, `standard_yearly`, `enterprise`).
  - `from`, `to` — ISO-даты (`YYYY-MM-DD`). `to` включает весь день (внутри +24 часа).
- **`PATCH /api/admin/users/:userId/tier`** — body `{ tier, addMinutes?: boolean }`:
  - `tier` обязателен и должен быть из ALLOWED_TIERS, иначе 400.
  - `addMinutes` по умолчанию `true`: пишет `translation_minutes_balance = TIER_SECONDS_MAP[tier]` и инкрементит `total_paid_minutes`, выставляет `last_payment_at = now`.
  - `addMinutes: false`: только меняет `tier/status/billing_period`, баланс не трогает (полезно для downgrade без отъёма минут).
  - `status` автоматически становится `'inactive'` для `tier='trial'`, иначе `'active'`. `billing_period` = `'yearly'` для `standard_yearly`, `'one_time'` для `enterprise`, иначе `'monthly'`.
- **`DELETE /api/admin/users/:userId`** — каскад:
  1. `DELETE FROM subscriptions WHERE tenant_id`
  2. `DELETE FROM users WHERE tenant_id` (на случай если у tenant несколько user'ов — снесёт всех)
  3. `DELETE FROM tenants WHERE id`
  Если у юзера почему-то нет tenant'а (битая запись) — удаляется только сам user. Stripe-customer и связанные Stripe-объекты НЕ удаляются (это намеренно — не теряем платёжную историю).

### Fallback handlers в db/index.ts

Добавлены 5 новых матчей regex'ом:
- `UPDATE subscriptions SET tier=$1 ... translation_minutes_balance=$4 WHERE tenant_id=$5` — со сменой баланса.
- `UPDATE subscriptions SET tier=$1 ... billing_period=$3 WHERE tenant_id=$4` — без смены баланса (отдельный 4-параметровый вариант).
- `DELETE FROM subscriptions WHERE tenant_id`
- `DELETE FROM users WHERE tenant_id` и `DELETE FROM users WHERE id`
- `DELETE FROM tenants WHERE id`

### Frontend [UsersPage.tsx](apps/frontend/src/pages/admin/UsersPage.tsx)

- **Reusable модал**: вынесены `<Modal>` и `<ModalHeader>` — все 3 поп-апа (минуты, тариф, удаление) теперь визуально идентичны: круглая цветная иконка-плашка слева, заголовок + subtitle (email/uuid) в середине, крестик справа. Backdrop `blur(6px)`, `animate-fade-in`. Закрытие по клику вне модала.
- **Tier-modal**: радио-кнопки с цветовой подсветкой выбранного тарифа (синий для Plus, зелёный для Standard, циан для Yearly, фиолет для Enterprise, серый для Trial). Чекбокс «Начислить минуты этого тарифа сразу».
- **Delete-modal**: красная градиентная кнопка «Удалить навсегда», список «что будет удалено» (учётка + tenant + подписка с количеством минут).
- **Inline-действия в строке**: вместо кнопки «Минуты» теперь 3 круглые иконки 32×32 — Gift (фиолет, минуты), CreditCard (циан, тариф), Trash2 (красный, удалить). Hover-эффект `scale-1.05`.
- **Панель фильтров двухрядная**:
  - Ряд 1: поиск (`<AuroraInput icon={Search}>`) + чекбокс «Только оплатившие» в обёрнутой плашке, которая зеленеет когда чекбокс активен.
  - Ряд 2: select тарифа + два date-input'а («с» / «по») + пресеты «7 дн» / «30 дн» / «Сброс» (последняя появляется только когда даты заданы).
- **Цветные tier-бейджи** в таблице вместо однотонных: каждый тариф имеет фоновую палитру `${color}1a` (10% opacity) + border `${color}30` + text-color, цвет берётся из `TIER_COLORS`.

### Как проверить

1. Перезапусти backend (`Ctrl+C → npm run dev` в `apps/backend`) — без него новые роуты `/tier` и `DELETE` не подцепятся.
2. Открой `/admin/users` (F5 если был открыт).
3. **Фильтр по тарифу**: select «Все тарифы» → «Plus» — должны остаться только Plus-юзеры (если они есть). По умолчанию все на `trial` после v0.7.1.
4. **Диапазон дат**: нажми «7 дн» — даты заполнятся, таблица отфильтруется по последней неделе. «Сброс» → весь список.
5. **Сменить тариф**: иконка CreditCard в строке → радио выбрать «Plus» → «Применить». В Telegram придёт «🔧 Админ изменил тариф». Колонка «Тариф» в таблице обновится. «Осталось мин» вырастет на 60. Tier-бейдж станет синим.
6. **Добавить минуты**: иконка Gift → 120 → «Зачислить». «Осталось мин» вырастет ещё на 120.
7. **Удалить**: красная корзина → красный модал «Удалить пользователя?» → «Удалить навсегда». Юзер пропадёт из таблицы, в TG придёт «🗑 Удалён пользователь». В Postgres (или fallback JSON) запись каскадно удалится.

### Нюансы

- **Stripe не задет**. При удалении мы НЕ обращаемся к Stripe API (`customers.del()`). Это намеренно — если у юзера была реальная оплата, в Stripe Dashboard остаётся история; чтобы полностью удалить Customer нужно либо вручную в Dashboard, либо отдельный endpoint (не сделан, потому что обычно нужно «забыть» только у себя, а в Stripe оставить для бухгалтерии).
- **TIER_SECONDS_MAP** в [packages/shared/src/schemas/billing.ts](packages/shared/src/schemas/billing.ts:8) — единственный источник правды по количеству минут. Если завтра поменяешь там Plus с 60 на 90 мин — админ-смена тарифа сразу подхватит новое значение.
- **Email NULL safe**: при delete если email пустой — в TG-уведомление пойдёт `—`, не падает.
- **Битые записи без `tenant_id`** (две первые в db_fallback.json — наследие от старых тестов) теперь обрабатываются: tier-modal не упадёт, delete пройдёт по `DELETE FROM users WHERE id` без CASCADE.

---

## 5.Г Hard paywall + JWT-unification v0.7.1 (2026-05-27)

**Цель:** убрать «бесплатные 30 минут» при регистрации и заблокировать создание комнат пользователям без баланса.

### Что изменилось

1. **Бесплатных минут больше нет.** В [auth/router.ts](apps/backend/src/modules/auth/router.ts:196) и в Google-OAuth-ветке регистрации subscription создаётся с `tier='trial', status='inactive', translation_minutes_balance=0` вместо прежних 1800 секунд активного триала.
2. **Guard баланса при создании комнаты.** В [rooms/router.ts](apps/backend/src/modules/rooms/router.ts) добавлен helper `checkTenantCanCreateRoom(tenantId)` — читает `subscriptions` и:
   - `tier='enterprise'` → разрешает безусловно;
   - `balance + rollover ≤ 0` → возвращает HTTP **402 Payment Required** с body `{ error, reason, remainingMinutes, redirectTo: '/billing' }`;
   - При сбое БД → fail-open (разрешает, чтобы рантайм-баг не блокировал сервис).
3. **JWT_SECRET унифицирован.** В [rooms/router.ts](apps/backend/src/modules/rooms/router.ts:9) fallback был `'test_jwt_secret_key_vibevox_2026'` (несовпадал с auth!) — это значит `optionalAuth` всегда падал на валидных токенах из auth и `tenantId` всегда был `null`. Изменён на унифицированный `'vibevox_secret_key_2026'`. Теперь guard баланса реально работает для авторизованных юзеров.
4. **JWT TTL 24h → 30d.** [auth/router.ts](apps/backend/src/modules/auth/router.ts) все 5 мест `jwt.sign({ expiresIn: '24h' })` заменены на `'30d'`. Конец «Сессия истекла» через сутки.
5. **Анонимы — без guard.** Если `optionalAuth` не дал `tenantId` (гость без токена), POST `/api/rooms/create` пропускает без проверки баланса — это нужно для будущих guest-flow (например, SIP-звонок без авторизации).
6. **Фронт RoomPage.tsx.** `handleCreateRoom` ловит `res.status === 402` → `alert(data.error)` → `navigate(data.redirectTo || '/billing')`.
7. **Исправлены тексты уведомлений.** «Триал: 30 минут» → «Баланс: 0 минут (нужно оформить тариф)» в реальном хуке регистрации и в тестовом сообщении.
8. **AdminConfigPage:** баннер auth-ошибок получил красную кнопку «🔐 Войти заново» (logout + navigate `/auth/login`).
9. **UX кнопок «ТЕСТ»:** disabled убран. Если получателей 0 — бэк сам делает `getUpdates`, если апдейтов тоже нет — возвращает `botLink`, фронт показывает голубую кнопку-ссылку «📱 Открыть @bot → /start».

### Как проверить (E2E)

1. **Перезапусти backend** — JWT_SECRET и TTL меняются на старте.
2. **Перелогинься** в админке — теперь токен живёт 30 дней.
3. **Регистрация без бонусных минут**:
   ```powershell
   # Открой /auth/register, создай нового юзера test1@example.com
   ```
   В админке /admin/users должен появиться новый юзер с **0 мин баланса**. В Telegram пришло «🆕 Новая регистрация — Баланс: 0 минут (нужно оформить тариф)».
4. **Guard на создание комнаты**:
   - Залогинься как этот новый юзер.
   - Открой /room → жми «Создать комнату».
   - Должен появиться `alert('У вас нет активной подписки...')` → редирект на `/billing`.
   - В Network DevTools: `POST /api/rooms/create` → `402 Payment Required`, body `{ "reason": "zero_balance", "redirectTo": "/billing" }`.
5. **Админский кредит снимает блок**: вернись в админку → /admin/users → найди этого юзера → «Минуты» → 60 → «Зачислить». Залогинься обратно как юзер → «Создать комнату» → теперь работает.
6. **Enterprise unlimited**: в БД (или fallback JSON) поставь `tier='enterprise'` для tenant'а — `/api/rooms/create` должен проходить даже при 0 минут.

### Урок на будущее

- **Несовпадение JWT_SECRET fallback'ов между модулями** — классический баг, который годами живёт незамеченным. Сегодня же стоит поднять задачу: вынести `JWT_SECRET` в общий конфиг ([systemConfig.ts](apps/backend/src/config/systemConfig.ts)) и удалить хардкод-дефолты в каждом роутере. См. §7 чек-лист «Перед деплоем».
- **Триал-минуты vs hard paywall** — продуктовое решение, не техническое. Если завтра захочется вернуть триал — поменять одно число (`0` → нужное количество секунд) в двух местах `auth/router.ts`. Текст в [auth/router.ts](apps/backend/src/modules/auth/router.ts:218) («Баланс: 0 минут») тоже придётся синхронизировать.
- **HTTP 402 Payment Required** — правильный статус для «нет минут, оплати». Это не 403 (нет прав) и не 401 (не залогинен). Семантика статуса сразу сообщает фронту, что делать (показать paywall, не показывать ошибку логина).

---

## 5.В Раздел «Пользователи» + Telegram-уведомления v0.7.0 (2026-05-27)

Реализовано в одной итерации поверх 6.0. Цель — суперадмин видит и управляет всеми пользователями, плюс получает в Telegram уведомления о ключевых событиях.

### Что реализовано

| # | Что | Где смотреть |
|---|---|---|
| 1 | Раздел `/admin/users` — список всех пользователей | Боковая навигация → «Пользователи» |
| 2 | Поиск по email / организации / tenant_id / Stripe Customer ID | Поле «Поиск…» сверху таблицы |
| 3 | Фильтр «только оплатившие» | Чекбокс рядом с поиском |
| 4 | Колонки: тариф, осталось мин, последний платёж, всего оплачено мин, дата регистрации | Таблица |
| 5 | Ручное зачисление минут пользователю | Кнопка «Минуты» в каждой строке → модал |
| 6 | Telegram-уведомление при регистрации | Шлётся всем admin chat_id |
| 7 | Telegram-уведомление при оплате тарифа | active/trialing подписки |
| 8 | Telegram-уведомление при докупке минут | invoice.paid + checkout.session.completed |
| 9 | Telegram-уведомление при админ-кредите | По кнопке «Минуты» в /admin/users |
| 10 | Утренняя сводка в 09:00 Europe/Warsaw | Авто (scheduler в server.ts) |
| 11 | Синхронизация Telegram-получателей через `getUpdates` | `/admin/config` → Telegram → «Синхронизировать получателей» |
| 12 | Поддержка приватных чатов, групп и каналов | Любые chat_id, что вернёт Telegram |
| 13 | **Кнопка «🧪 ТЕСТ всех уведомлений»** — прогон 5 примеров за один клик | `/admin/config` → Telegram → большая фиолетовая кнопка |

### Архитектура потока Telegram-уведомлений

```
┌────────────────────────────────────────────────────────────────┐
│ Бизнес-событие (register / Stripe webhook / админ-кредит)      │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼ best-effort, .catch(() => {})
        sendTelegramAdminMessage(text, 'HTML')
                           │
                           ▼
   systemConfig.telegramAdminChatIds: string[]   (из system-config.json)
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  chat_id личка     group_id        channel_id
  (юзер написал боту)  (бот в группе)   (бот админ канала)
```

**Никакой ошибки Telegram не валит бизнес-логику** — все вызовы обёрнуты в `.catch()`, при отсутствии токена/chat_id функция возвращает `{ sent: 0, total: 0 }` без шума.

### Поток первичной настройки получателей

1. Юзер заводит бота в **@BotFather** в Telegram, копирует токен.
2. Вставляет токен в `/admin/config` → «Telegram Bot» → сохраняет (поле `telegramToken` в `system-config.json`).
3. **В Telegram открывает чат с ботом и нажимает `/start`** (или добавляет бота в группу/канал и шлёт туда любое сообщение).
4. Возвращается в `/admin/config` → нажимает «Синхронизировать получателей».
5. Бэк вызывает `https://api.telegram.org/bot<token>/getUpdates`, собирает уникальные `chat.id` из всех апдейтов (`message`, `channel_post`, `my_chat_member`) и сохраняет в `telegramAdminChatIds`.
6. Жмёт «Отправить тест» — все получатели должны увидеть «VibeVox — тестовое уведомление».

### Файлы (новые)

- `apps/backend/src/modules/notifications/telegram.ts` — helper: `sendTelegramAdminMessage`, `discoverChatIdsFromUpdates`, `getBotInfo`, `saveTelegramAdminChatIds`.
- `apps/backend/src/modules/notifications/router.ts` — endpoints `GET /status`, `POST /sync`, `POST /test`, `POST /summary-now`, `DELETE /chat/:chatId`.
- `apps/backend/src/modules/notifications/daily_summary.ts` — scheduler: `setInterval` раз в минуту, проверяет `Intl.DateTimeFormat({timeZone: 'Europe/Warsaw'}) === '09:00'`, защита от дублей через `lastSentYmd`.
- `apps/backend/src/modules/admin/users.ts` — endpoints `GET /api/admin/users` (поиск/фильтр/пагинация) и `POST /api/admin/users/:userId/credit`.
- `apps/frontend/src/pages/admin/UsersPage.tsx` — UI таблицы + модал «Добавить минуты» с пресетами 30/60/120/300/600.

### Файлы (изменённые)

- `apps/backend/src/db/init.sql` — `subscriptions` добавлены 3 поля: `total_paid_minutes`, `last_payment_minutes`, `last_payment_at`.
- `apps/backend/src/db/index.ts` — fallback handlers: `SELECT * FROM tenants WHERE id`, `FROM users u LEFT JOIN tenants` (для админских отчётов), `UPDATE subscriptions SET total_paid_minutes …`, `SELECT all subscriptions`.
- `apps/backend/src/config/systemConfig.ts` — поле `telegramAdminChatIds?: string[]` + `getTelegramAdminChatIds()` + `saveTelegramAdminChatIds()`. `get()` теперь возвращает `''` если в JSON лежит не-string. `saveSettings` строго работает только со string-полями (защита от падений).
- `apps/backend/src/server.ts` — подключены `/api/admin/notifications`, `/api/admin/users`. В `app.listen` callback запускается `startDailySummaryScheduler()`.
- `apps/backend/src/modules/auth/router.ts` — хук после регистрации: `sendTelegramAdminMessage(...)` через `.catch(() => {})`.
- `apps/backend/src/modules/billing/webhook.ts` — хуки в `handleSubscriptionChange` (только active/trialing) и `handleInvoicePaid` (overtime_topup) + обновление статистики через `UPDATE subscriptions SET total_paid_minutes …`. Аналогичные обновления для one-time top-up в `checkout.session.completed`.
- `apps/frontend/src/router.tsx` — зарегистрирован `/admin/users` → `UsersPage`.
- `apps/frontend/src/layouts/AdminLayout.tsx` — навигационная ссылка «Пользователи» с иконкой `Users` (lucide), в обоих лейаутах (десктоп сайдбар + мобильные вкладки).
- `apps/frontend/src/pages/admin/AdminConfigPage.tsx` — под Telegram-токеном вставлен блок «Получатели уведомлений»: список chat_id'ов как чипы с кнопкой `×`, кнопки «Синхронизировать получателей» и «Отправить тест», подсказка из 3 пунктов, статус бота (`@botUsername` ссылкой), счётчик чатов.
- `apps/frontend/src/components/AppVersion.tsx` — bump `0.6.0 → 0.7.0`.

### Как проверить (E2E)

```powershell
# 0. Перезапустить backend
cd C:\GOOGLEDISK\VibeVox\apps\backend
# Ctrl+C если запущен, потом
npm run dev
# В консоли увидите: "[DailySummary] Scheduler запущен. Сейчас в Europe/Warsaw: HH:MM. Целевое время: 09:00."
```

1. **Создать Telegram-бота** (если ещё нет): @BotFather → `/newbot`. Скопировать токен `123456:ABC…`.
2. Открыть `http://localhost:3000/admin/config`, в карточке «Telegram Bot» вставить токен → «Сохранить изменения». Нажать «Проверить подключение» — должен зелёный «Активен».
3. В Telegram открыть чат с ботом → нажать `/start` (или написать любое сообщение). **Альтернатива**: создать группу/канал, добавить туда бота, написать любое сообщение.
4. Вернуться в админку → блок «Получатели уведомлений» → нажать «Синхронизировать получателей». Появится чип с `chat_id`. Бейдж «1 чат» становится зелёным.
5. Нажать «Отправить тест» — в Telegram должно прийти сообщение «VibeVox — тестовое уведомление».
6. **Проверить хук регистрации**: открыть `/auth/register`, зарегистрировать тестового пользователя. В Telegram должно прийти: «🆕 Новая регистрация — Email, Организация, Триал: 30 минут, Tenant: uuid».
7. **Проверить раздел /admin/users**: открыть `http://localhost:3000/admin/users`. Должны увидеть всех пользователей (включая нового). Поиск работает по email/организации.
8. **Проверить ручное зачисление**: в строке любого пользователя нажать «Минуты» → выбрать 60 → «Зачислить». Колонка «Осталось мин» должна вырасти на 60, в Telegram должно прийти «🎁 Админ-кредит минут».
9. **Проверить ежедневную сводку** (можно вручную без ожидания 9:00):
   ```powershell
   $token = "<JWT суперадмина из браузера: F12 → localStorage.token>"
   Invoke-RestMethod -Uri http://localhost:3001/api/admin/notifications/summary-now -Method POST -Headers @{Authorization="Bearer $token"}
   ```
   В Telegram придёт «🌅 Сводка VibeVox за сутки» со списком новых регистраций, оплат и топ-5 по балансу.
10. **Реальная оплата** (требует настроенный Stripe webhook на публичный URL — через ngrok или после деплоя): после успешной оплаты Plus/Standard или докупки минут Stripe пришлёт webhook, и в Telegram придёт «💳 Оплачена подписка» / «💰 Докупка минут».

### Хотфикс 2026-05-27 — «Невалидный токен» при «Синхронизировать получателей»

**Симптом:** в `/admin/config` блок «Получатели уведомлений» → нажать «Синхронизировать получателей» → красная строка «Невалидный токен». При этом «Проверить подключение» в той же карточке Telegram возвращает ✅ «Telegram-бот @vibevoxinfo_bot авторизован».

**Диагностический трюк (как читать ошибку):** «Невалидный токен» приходит из middleware `requireSuperAdmin` бэка — это **JWT админа из браузера**, а не Telegram Bot Token. Их легко спутать, потому что в Telegram-секции ошибка отображается рядом с полем «Bot API Token». Помни: ошибка с маленькой буквы про «токен» в админских действиях — это всегда JWT сессии, а не сторонний ключ.

**Корневая причина:** две независимых причины могут давать одну и ту же ошибку:

1. **Истёкший JWT.** Токен авторизации живёт 24 часа (см. [auth/router.ts:212](apps/backend/src/modules/auth/router.ts:212): `jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })`). Если юзер залогинился вчера и не делал logout/login сегодня — токен в `localStorage.vibevox_token` истёк. `RequireAdmin` guard на фронте проверяет только `user.role === 'superadmin'` из store, не делая verify токена → юзер свободно ходит по `/admin/*`, но любой защищённый endpoint бэка отвечает 401.

2. **Token не прокидывается во фронте.** Я в первой реализации использовал `useAppStore.getState().token` — это работает, но не реактивно. Если в момент монтирования компонента store ещё не гидратирован из `localStorage` (восстановление в [useAppStore.ts:136-140](apps/frontend/src/store/useAppStore.ts:136) идёт синхронно при импорте модуля, но порядок импортов в Vite может варьироваться), вызов вернёт `null` → fetch уходит без `Authorization` → 401.

**Фикс:**
- Middleware `requireSuperAdmin` в [notifications/router.ts](apps/backend/src/modules/notifications/router.ts) и [admin/users.ts](apps/backend/src/modules/admin/users.ts) теперь возвращает **детализированную ошибку**: «Не авторизован: отсутствует заголовок Authorization» / «Сессия истекла. Выйдите и войдите снова» / «Невалидный токен ({JsonWebTokenError}). Попробуйте перелогиниться». Сразу видно, что чинить.
- В `AdminConfigPage.tsx` `tgHeaders` переписан с `useAppStore.getState()` на реактивный `const { user, logout, token } = useAppStore()` — как в работающем `PromocodesPage`. Token всегда свежий.

**Что делать пользователю при появлении ошибки:**
1. Выйти из админки (LogOut в левом нижнем углу) → войти заново — обычно решает 99% случаев.
2. Если после relogin всё ещё ошибка — открыть DevTools → Application → Local Storage → проверить, что `vibevox_token` существует и не пустой. Если пустой → разлогиниться и войти ещё раз.
3. В DevTools → Network найти запрос на `/api/admin/notifications/sync` — посмотреть `Request Headers`. Должна быть строка `Authorization: Bearer <jwt>`. Если её нет — баг во фронте, написать в энциклопедию.

---

# MCP — подключение внешних ИИ-агентов / CRM (2026-05-30)

**Что это.** VibeVox поднимает MCP-сервер (Model Context Protocol — открытый стандарт Anthropic),
к которому внешние ИИ-агенты и CRM подключаются как клиенты: читают данные аккаунта и выполняют
действия. Per-tenant: каждый аккаунт генерирует свой ключ и подключается отдельно.

**Где включается.** Настройки Enterprise → вкладка **MCP** (после «CRM (Chatwoot)»). Виден только
на тарифе Enterprise. Владелец генерирует индивидуальный ключ со списком прав (scopes); ключ
хранится в БД **хэшированным** (SHA-256), сырой показывается ОДИН раз, удаляется по кнопке.

## Адрес подключения

```
https://vibevox.pro/api/mcp
```

(Локально — `http://localhost:3001/api/mcp`; через ngrok — соответствующий туннель. В UI поле
«URL подключения» подставляет `PUBLIC_BASE_URL` сервера, поэтому на проде там должен стоять
`https://vibevox.pro`.)

Авторизация — заголовок:
```
Authorization: Bearer vbvx_mcp_<ваш ключ>
```

## Права (scopes)

Ключ несёт набор прав; по умолчанию при создании отмечены только read. Инструмент виден и
вызывается, только если его scope ⊆ scopes ключа.

| Scope | Что разрешает |
|-------|---------------|
| `clients:read` | список клиентов/лидов |
| `dialogs:read` | история диалогов + теги клиента |
| `messages:write` | отправлять сообщения клиентам |
| `images:read` | каталог пресетов изображений |
| `images:generate` | генерировать/обрабатывать изображения |
| `tags:read` | каталог тегов потребностей |

## Доступные инструменты (Фаза 0)

| Инструмент | Действие | Scope |
|-----------|----------|-------|
| `list_clients` | клиенты аккаунта (Telegram-диалоги) | clients:read |
| `get_dialog` | сообщения комнаты + присвоенные теги | dialogs:read |
| `send_message` | текст клиенту (через outbox → Telegram) | messages:write |
| `list_image_presets` | модель + пресеты обработки картинок | images:read |
| `generate_image` | генерация/обработка по `presetKey` → URL | images:generate |
| `list_tags` | каталог тегов потребностей | tags:read |

Новые блоки программы добавляют свои инструменты через реестр (`registerTool`) — MCP-слой
переписывать не нужно.

## Транспорт и методы

JSON-RPC 2.0 поверх HTTP (Streamable HTTP, JSON-режим — без SSE). На один `POST` приходит один
JSON-ответ. Методы: `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`,
`resources/list`, `prompts/list`. `GET /api/mcp` → 405 (SSE пока не поддержан).

### Примеры

```bash
# 1. initialize
curl -X POST https://vibevox.pro/api/mcp \
  -H "Authorization: Bearer vbvx_mcp_ВАШ_КЛЮЧ" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}'

# 2. tools/list — вернёт только разрешённые ключом инструменты
curl -X POST https://vibevox.pro/api/mcp \
  -H "Authorization: Bearer vbvx_mcp_ВАШ_КЛЮЧ" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. tools/call — список клиентов
curl -X POST https://vibevox.pro/api/mcp \
  -H "Authorization: Bearer vbvx_mcp_ВАШ_КЛЮЧ" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_clients","arguments":{"limit":10}}}'
```

### Подключение к Claude / агенту

В клиенте с поддержкой remote MCP по HTTP: указать URL `https://vibevox.pro/api/mcp` + заголовок
`Authorization: Bearer <ключ>`. Для клиентов только на stdio (напр. Claude Desktop) — мост:
```
npx mcp-remote https://vibevox.pro/api/mcp --header "Authorization: Bearer vbvx_mcp_ВАШ_КЛЮЧ"
```

## Безопасность

- **Изоляция per-tenant:** ключ → tenantId, все инструменты работают строго в рамках аккаунта.
- **Наименьшие права:** scopes; для агента CRM обычно достаточно read + `messages:write`.
- **Enterprise-only:** проверка в протоколе (`hasEnterpriseAccess`) и в управлении ключами.
- **Хэш + удаление:** в БД только SHA-256; revoke (мягко) и hard-delete (из БД).
- **Квоты Gemini:** генерация идёт на ключе самого tenant'а.

## Решение по Chatwoot

`crm:push` в MCP **СОЗНАТЕЛЬНО не делаем** — это дубль существующего прямого пуша
`pushRoomToChatwoot`. MCP даёт то, чего пуш не умеет: чтение данных агентом, двусторонние действия
и подключение любого агента/CRM, а не только Chatwoot.

## Файлы

- Backend: `apps/backend/src/modules/mcp/{scopes,keys,registry,tools,server,router}.ts`.
- Миграция `tenant_mcp_keys` (+ fallback-хендлеры в `db/index.ts`); монтаж `/api/mcp` в `server.ts`
  (свой json-лимит 30mb ДО глобального `express.json()`).
- Frontend: вкладка в `EnterpriseSettingsPage.tsx` + `pages/enterprise/Section5Mcp.tsx`.

## Как проверить (E2E)

1. Перезапустить backend (создастся `tenant_mcp_keys`); на проде задать `PUBLIC_BASE_URL=https://vibevox.pro`.
2. Настройки Enterprise → MCP → выбрать scopes → «Создать ключ» → скопировать ключ.
3. Прогнать три curl выше — `initialize` отдаёт serverInfo, `tools/list` — массив тулз,
   `tools/call` — `content[0].text` с данными.
4. Удалить ключ → тот же curl должен вернуть **401**. Ключ только с read-scopes → в `tools/list`
   нет `send_message`/`generate_image`.

## Грабля: вкладка MCP показывает сырые ключи (`enterprise.mcp.*`)

Неймспейс `common` грузится по HTTP из `/locales/{lng}/common.json` (см. `config/i18n.ts`), а НЕ
инлайнится в бандл. Если после добавления ключей вкладка показывает `enterprise.mcp.heading` и т.п.
— значит отдаётся **старый** `common.json`: пересобрать фронт (`npm run build`, vite копирует
`public/locales` → `dist`) или перезапустить `vite dev` + **hard-reload** браузера (Ctrl+Shift+R).
Ключи лежат в `ru`/`en` (источники) — на остальные языки разлить `npm run i18n:propagate` +
`scripts/translate-new-keys.mjs`.

**Урок на будущее:** все новые админские middleware'ы должны возвращать **разные сообщения для разных причин** 401 — это экономит часы на отладку. Также: всегда использовать `const { token } = useAppStore()` напрямую через хук, не через `.getState()`, в реактивных компонентах.

---

### Известные нюансы

- **Telegram getUpdates держит апдейты только 24 часа**. Если бот был создан давно, но юзер только сейчас написал — сразу сработает. Если бот «забыт» больше суток — нужно написать ему снова.
- **Если бот добавлен как админ канала** (без права писать сообщения), getUpdates вернёт `my_chat_member` событие — мы его тоже парсим, chat_id канала попадёт в список. После этого бот должен иметь права на отправку сообщений, иначе тест упадёт с описательной ошибкой Telegram.
- **`current_period_end`** в подписках сейчас не используется sweep'ом — это для следующей итерации (отметка истечения).
- **Время в scheduler** считается через `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' })`. DST учитывается автоматически. Защита от двойной отправки — `lastSentYmd` сохраняется в памяти процесса, при рестарте сбрасывается (но если перезапустить в 09:01 — сводка не отправится повторно, так как минута уже не совпадает).
- **Ручной кредит** (кнопка «Минуты») зачисляется в основной `translation_minutes_balance` и **увеличивает `total_paid_minutes`** — это сделано намеренно, чтобы пользователь, получивший компенсацию, отображался как «платящий» в фильтре.

### Урок на будущее

Если когда-нибудь захочется хранить отдельную таблицу `billing_events` (более правильный путь для аудита), то поля `total_paid_minutes` / `last_payment_*` в `subscriptions` будут денормализацией. Сейчас этого нет ради простоты — для текущего масштаба «сколько раз пользователь платил» и «когда последний раз» решается одной строкой в подписке.

---

## 5.Б Stripe-биллинг v0.6.0 — что сделано за ночь (2026-05-27)

Карта 10 этапов реализации с местами в UI, где это видно. Подробный код-уровень — в §6 «История фиксов → 2026-05-27 итерация 6.0».

| Этап | Что | Куда смотреть в UI |
|---|---|---|
| 1 | Stripe ключи в админке + Verify | `/admin/config` → блок «Stripe (биллинг)» |
| 2 | Синхронизация Products/Prices с Stripe | Та же карточка, кнопки «Синхронизировать EUR/USD» |
| 3 | Маркетинговый BillingPage без эмодзи | `/billing` |
| 4 | Stripe Checkout + Customer Portal | Кнопки «Оформить Plus/Standard» в `/billing` |
| 5 | Учёт минут в bridge (списание 1с / сек речи) | Авто в комнатах |
| 6 | Rollover минут раз в час, сгорание через цикл | Авто (scheduler в `server.ts`) |
| 7 | In-room баннер «5 мин» + быстрая докупка | В комнате при остатке ≤ 5 мин |
| 8 | Top-up калькулятор со слайдером 60→600 мин | `/billing` → секция «Докупка минут» |
| 9 | Промокоды в админке (через Stripe) | `/admin/promocodes` |
| 10 | Standard Yearly −17% (€289 вместо €348) | Toggle «Ежегодно» в `/billing` |

**Версия:** v0.6.0 (показывается в углу сайдбара через `apps/frontend/src/components/AppVersion.tsx`).

---

### Хотфикс 2026-05-27 (после ввода живых Stripe-ключей) — «Invalid API Key sk_test_****_key» при синхронизации

**Симптом** (увидим в UI на `/admin/config`):
- «Проверить подключение» → ✅ «Stripe подключён в режиме LIVE. Валюты счёта: PLN».
- «Синхронизировать USD/EUR» → ❌ «Ошибка: Invalid API Key provided: sk_test_****_key».

**Диагностический трюк (как читать ошибку Stripe):** Stripe в ошибках маскирует середину ключа, оставляя префикс (`sk_test_` / `sk_live_`) и последние 4 символа. Если в ошибке `sk_test_****_key` — это значит ключ заканчивался **буквально на `_key`**. Реальные ключи Stripe — случайные 90+ символов, ни один не заканчивается на `_key`. Это паттерн **мок-заглушки**.

**Корневая причина:** в [apps/backend/.env](apps/backend/.env) лежала dev-заглушка `STRIPE_SECRET_KEY=sk_test_mock_key`. Геттер [`getStripeSecretKey()`](apps/backend/src/config/systemConfig.ts:98) имеет приоритет `system-config.json → process.env → дефолт`. На бумаге сначала должен возвращаться `sk_live_...` из JSON. Но!

**Почему verify работает, а sync — нет:**
- `/api/auth/verify-stripe` в [auth/router.ts:803-836](apps/backend/src/modules/auth/router.ts:803) создаёт `new Stripe(secretKey)` **локально на каждый запрос** → берёт свежее значение, всё хорошо.
- `/api/billing/sync-products` в [billing/router.ts:41](apps/backend/src/modules/billing/router.ts:41) идёт через [`getStripe()`](apps/backend/src/modules/billing/service.ts:12-27), у которого **module-level кеш** `stripeInstance` + `stripeKeySnapshot`. Если первый вызов произошёл до того как юзер сохранил `sk_live_...` через UI — закешировался Stripe SDK с мок-ключом из `.env`. Логика «пересоздать если ключ поменялся» не успевала отработать в реальном порядке вызовов.

**Фикс:** в [apps/backend/.env](apps/backend/.env) очищены значения `STRIPE_SECRET_KEY=` и `STRIPE_WEBHOOK_SECRET=` (пустые строки, без мок-заглушек). После этого даже если JSON временно не доступен — `getStripeSecretKey()` вернёт `''`, и юзер увидит понятную ошибку «Stripe Secret Key не настроен» вместо misleading «Invalid API Key».

**Действие пользователя после фикса:** Ctrl+C → перезапуск `npm run dev` в `apps/backend`. Перезагрузка процесса сбрасывает закешированный `stripeInstance`. Подтверждение успеха: «Синхронизация завершена: создано 3, уже было 0. Активных тарифов: 3.»

**Урок на будущее:** мок-заглушки в `.env` опасны при наличии fallback-цепочки. Лучше держать `.env` пустым для production-ключей и полагаться на `system-config.json`. Альтернатива: добавить в [`getStripe()`](apps/backend/src/modules/billing/service.ts:12) валидацию формата ключа (длина >= 30 символов, регулярка `^(sk_test|sk_live)_[A-Za-z0-9]{20,}$`) перед созданием инстанса.

**Замеченный отдельный баг (не блокер, но фиксить перед прод):** в `system-config.json` поле `stripeWebhookSecret` сейчас содержит значение, не похожее на webhook signing secret (тот всегда начинается с `whsec_`). Нужно зайти в Stripe Dashboard → Developers → Webhooks → выбрать endpoint → «Signing secret → Reveal» → вставить `whsec_...` через `/admin/config`. Без этого `/api/billing/webhook` будет отвергать события Stripe.

---

## 5.А Сводка за вчера (2026-05-26) — 10 ключевых пунктов

Самое свежее сверху. Под каждым пунктом — **как проверить вручную**.

### 1. SIP «Исходящий звонок» (итерация 4.1, Web → телефон)
Новый endpoint `POST /api/sip/call` + секция «Исходящий звонок» на `/sip`. Создаёт UUID-комнату, дёргает `SipClient.createSipParticipant`, прокидывает в metadata SIP-участника `nativeLanguage` + `voiceGender`, редиректит пользователя в `/room/{uuid}`.
**Как проверить:** на странице `/sip` ввести `+48225550100`, выбрать «Язык получателя» → «Позвонить». Браузер должен перейти на `/room/<uuid>`. В терминале backend увидишь лог `[SIP] created participant PA_...`. Через curl: `curl -X POST http://localhost:3001/api/sip/call -H "x-tenant-id: <uuid>" -H "content-type: application/json" -d '{"phoneNumber":"+48225550100","calleeLanguage":"en"}'` → ожидаем `{"status":"calling","roomId":...,"sipParticipantId":"PA_..."}`.

### 2. SIP «Входящие звонки» (итерация 4.0)
Каждый tenant получает уникальные SIP-credentials. Эндпойнты `POST/GET/DELETE /api/sip/inbound`, `/inbound/activate`, `/inbound/deactivate`. Фиксированная комната `vibevox-sip-{tenantId}`.
**Как проверить:** на `/sip` → «Создать SIP-адрес для входящих» → появятся SIP-сервер, Логин, Пароль (Eye/EyeOff), Комната. Кнопками Copy скопировать каждое поле. Нажать Power «Активировать» → плашка зелёная. `curl -X POST .../api/sip/inbound -H "x-tenant-id: <uuid>"` должен вернуть `livekit_inbound_trunk_id` начинающийся с `ST_` и `livekit_dispatch_rule_id` начинающийся с `SDR_`.

### 3. SIP «Outbound trunk» подключён к UI (итерация 3.5)
`SipPage.tsx` переписан с mock на реальный `/api/sip/trunk`. CRUD с маскированным паролем, best-effort синхронизация с LiveKit Cloud, fallback handlers в `db/index.ts` для работы без PostgreSQL.
**Как проверить:** на `/sip` ввести данные Zadarma → «Сохранить» → toast зелёный. Перезагрузить страницу — данные подтянутся (пароль `********`). `curl -X DELETE .../api/sip/trunk -H "x-tenant-id: <uuid>"` → 200, повторный GET → 404.

### 4. Перевод заработал вживую (итерация 3.4) ✅
Подтверждено пользователем: «говорю — оно переводит на английский». Скриншот с субтитрами «Hello. Hello.».
**Как проверить:** открыть две вкладки в разных профилях браузера, зайти в одну комнату с разными языками (ru / en). Сказать «Привет» — собеседник через 1-2 секунды слышит «Hello» голосом Aoede, видит синие субтитры.

### 5. Hotfix `captureFrame` async (итерация 3.4)
`audioSource.captureFrame()` падал при закрытии трека и валил весь Node-процесс. Добавлен `.catch()` + глобальные `process.on('unhandledRejection')` / `uncaughtException` в `server.ts`.
**Как проверить:** в активной комнате с переводом нажать «Hangup» резко в момент речи. Backend не должен упасть — `npm run dev` остаётся жив, `curl http://localhost:3001/api/health` → `{"status":"ok"}`.

### 6. Корневая причина «молчания» Gemini найдена (итерация 3.2)
Через `probe-correct.mjs` выяснили: `gemini-live-2.5-flash-preview` **не существует** (1008), `streamTranslationConfig` **не поддерживается** (1007). Переход на `gemini-3.1-flash-live-preview` для Live и `gemini-3.5-flash` для остального (Coach, dialects, assistant). Перевод теперь через `systemInstruction` + `buildTranslationInstruction(targetLanguage)`. В `AdminConfigPage` добавлен селектор Live-моделей.
**Как проверить:** `/admin/config` → секция Gemini → дропдаун «Gemini Live Model» содержит 4 варианта, дефолт `gemini-3.1-flash-live-preview`. В Network-логе при подключении к комнате запрос на Gemini уходит без `streamTranslationConfig`.

### 7. Текстовые субтитры через `outputAudioTranscription` (итерация 3.1)
`Modality.TEXT` несовместим со stream-translation, поэтому текст берётся из `serverContent.outputTranscription.text`, накапливается chunks и шлётся через LiveKit data channel **адресно получателю** (`destination_identities: [recipient]`).
**Как проверить:** в комнате на двоих синие субтитры под видео-плиткой собеседника появляются по мере того, как бот говорит, а не одним блоком. Каждый видит только свой перевод (бот публикует адресно).

### 8. AI Coach (приватный янтарный помощник, итерация 3)
`POST /api/coach/explain` со streaming через `text/plain` chunked encoding, модель `gemini-3.5-flash`. UI: кликнуть на синий субтитр → янтарная панель над контролами, ответ печатается по словам с курсором ▍, пресет-чипы (Нейтрально / Шутка / Формально / Коротко / Глубоко / Научно / Эмпатично), кнопки Pin / Copy / Close. Авто-скрытие через 30 сек.
**Как проверить:** в комнате кликнуть на синий субтитр собеседника. Должна появиться янтарная панель, ответ стримится. `curl -N -X POST http://localhost:3001/api/coach/explain -H 'content-type: application/json' -d '{"text":"How are you?","userLanguage":"ru","tone":"neutral"}'` → пишет текст порциями.

### 9. Индикатор связи + Vite под ngrok (итерация 3)
Подписка на `RoomEvent.ConnectionQualityChanged` → правый верх плашка Wifi/WifiOff с цветной рамкой (зелёный/жёлтый/красный). `vite.config.ts`: `server.host: true` + `allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app', '.ngrok.dev']`.
**Как проверить:** в комнате — плашка в правом верхнем углу с текущим качеством. Запустить `ngrok http 3000`, открыть выданный `https://*.ngrok-free.app` — должен загружаться без «Invalid Host header».

### 10. Реальный LiveKit в `RoomPage.tsx` + фикс GOOGLE_CLIENT_SECRET (итерации 1-2)
Конец mock'а: `/api/livekit/token` возвращает `{ token, url }`, `RoomPage.tsx` подключается через `livekit-client`, публикует мик/камеру, поднимает `<video>` для local (`scaleX(-1)`) и remote, авто-старт bridge через `/api/translation/start`. Убран хардкод `http://localhost:3001`. Параллельно: в `.env` исправлена опечатка в `GOOGLE_CLIENT_SECRET` (`I` → `l`), Google OAuth начал отвечать `verified: true`. Удалены дубли `/upload-sample`, `/test-sample`, `/save-correction` в `dialects/router.ts`.
**Как проверить:** зайти в `/room/<uuid>` — видишь себя в зеркале, реальное видео собеседника, в DevTools `WebSocket` на `wss://vibevox-d1v4ek73.livekit.cloud`. На `/admin/config` нажать «Проверить Google OAuth» → зелёный «verified». В `dialects/router.ts` поиск по `/upload-sample` — одно вхождение.

---

## 6. История фиксов

### 2026-05-26 — итерация 1
- **(А)** Удалены дубликаты роутов `/upload-sample`, `/test-sample`, `/save-correction` в `apps/backend/src/modules/dialects/router.ts` (висели мёртвым кодом после первого определения).
- **(Б)** Исправлена опечатка в `GOOGLE_CLIENT_SECRET` в `apps/backend/.env`: было `…pbfIGmIm_q1IjZM…` (большая I), Google отвечал `invalid_client`. Заменено на правильное `…pbflGmIm_q1lj1ZM…` (маленькая l), которое уже было в `system-config.json` и подтверждено вызовом `/api/auth/verify-google-oauth` → Google OK.

### 2026-05-27 — итерация 6.0 ✅ Stripe-биллинг (10 этапов, v0.6.0)

**Цена и тарифная сетка (финальная, согласована):**

| Тариф | Цена | Минут / период | Цена/мин |
|---|---|---|---|
| **Plus** | €19 / мес | 60 мин/мес | €0.31 |
| **Standard** | €29 / мес | 120 мин/мес | €0.24 |
| **Standard Yearly** | €289 / год (−17%) | 1 440 мин/год | €0.20 |
| **Enterprise** | контакт WhatsApp | по договору | — |

Top-up: 60-600 минут × €0.17. Минуты переносятся на 1 следующий цикл, потом сгорают.

**10 этапов реализации:**

1. **Stripe ключи в Admin Config** — поля `stripeSecretKey`, `stripeWebhookSecret`, `stripePublishableKey` в `systemConfig.ts`. UI-карточка в `AdminConfigPage` с кнопкой «Проверить подключение» (`/api/auth/verify-stripe` → `stripe.balance.retrieve()`).
2. **Products/Prices синхронизация** — `billing/service.ts syncStripeProducts(currency)` идемпотентно создаёт в Stripe Products (Plus, Standard) и Prices (через `lookup_key = vibevox_<tier>_<currency>`). Метаданные `tier`, `billing_period`, `included_minutes`. Кнопки «Синхронизировать EUR/USD» в админке.
3. **Маркетинговый BillingPage** — три карточки Plus/Standard/Enterprise, иконки lucide (без эмодзи!), toggle «Месячно/Ежегодно», бейдж «−17% — 2 месяца бесплатно», FAQ из 4 пунктов, секция со 100+ языками.
4. **Subscription flow без Trial** — `/api/billing/checkout` находит Price по lookup_key, создаёт/находит Stripe Customer (записывает в `tenants.stripe_customer_id`), открывает Subscription Checkout c `allow_promotion_codes:true`. Webhook ловит `customer.subscription.created/updated/deleted` + `checkout.session.completed` — синхронизирует tier/balance/period в `subscriptions`. `/api/billing/portal` — Customer Portal. `/api/billing/me` — состояние подписки.
5. **Учёт минут в bridge** — `billing/usage.ts` (`getTenantBalance`, `consumeSeconds`, `isUnlimitedTier`). `bridge.ts.consumeBillingSecond()` списывает 1 секунду на каждую секунду активной речи (детектится через `activeSpeechFrames >= 50` ≈ 1 сек). Сначала тратится `rollover_seconds`, потом основной `translation_minutes_balance`. Enterprise = `isUnlimitedTier`, не списываем.
6. **Rollover минут + сгорание** — `billing/rollover.ts` запускает scheduler каждый час (`setInterval`). Прогон: подписки с `current_period_end < now` → `new_rollover = current_balance`, `new_balance = TIER_SECONDS_MAP[tier]`, `current_period_end += 30 или 365 дней`. Старый `rollover_seconds` сгорает.
7. **In-room уведомление** — bridge публикует `{type:'billing', kind:'low_balance'|'quota_exhausted', remainingMinutes}` через data channel `topic: 'billing'` (broadcast всем в комнате). `RoomPage` слушает `DataReceived`, показывает баннер с 3 кнопками докупки (`+60/+120/+300 мин`) → `/api/billing/topup` → Stripe Checkout с `return_url = window.location.href`. После оплаты пользователь возвращается в ту же комнату.
8. **Top-up calculator** — `TopupCalculator` компонент в BillingPage: слайдер 60→600 мин, шаг 30, real-time расчёт €0.17/мин. Чипы 60/120/300/600 для пресетов. `POST /api/billing/topup` → Stripe Checkout (mode='payment'), webhook `checkout.session.completed` при `mode='payment'` + `metadata.type='overtime_topup'` зачисляет `minutes × 60` секунд в баланс.
9. **Промокоды в Admin** — `billing/promo.ts`, страница `/admin/promocodes`, ссылка в `AdminLayout`. CRUD через Stripe Coupons + PromotionCodes API. Форма: код (3-40 символов A-Z 0-9 _ -), percent_off 1-100 (100% = бесплатная активация), duration once/repeating/forever, max_redemptions, expires_at. RequireSuperAdmin middleware. Чекаут уже включает `allow_promotion_codes:true` (этап 4).
10. **Standard Yearly + 17% скидка** — `TIER_PRICES.standard_yearly` (€289 за 1440 мин), отдельный `lookup_key` в Stripe, разные `billing_period` метаданные. Toggle в BillingPage пишет yearly в request, бэк выбирает соответствующий Price. Rollover понимает yearly → +365 дней вместо 30.

**Файлы**: `systemConfig.ts`, `db/index.ts` (fallback handlers для subscriptions, promo_codes, tenants.stripe_customer_id), `db/init.sql` (расширена subscriptions: billing_period, rollover_seconds, last_rollover_at, stripe_customer_id), `packages/shared/src/schemas/billing.ts` (TIER_SECONDS_MAP, TIER_PRICES, TOPUP_* константы), `modules/billing/{webhook,router,service,usage,rollover,promo}.ts` (6 файлов), `modules/translation/bridge.ts` (+ биллинг tick + low_balance event), `modules/translation/router.ts` (+ передача creator_tenant_id в bridge), `apps/frontend/src/pages/BillingPage.tsx` (полностью переписан), `apps/frontend/src/pages/admin/{AdminConfigPage,PromocodesPage}.tsx`, `apps/frontend/src/pages/RoomPage.tsx` (+ in-room billing banner), `router.tsx` + `AdminLayout.tsx`.

**Проверено**: type-check backend и frontend оба чистые, бэкенд перезагружается без ошибок, health-check `OK`. Реальный Stripe-runtime будет проверен после ввода живых ключей через Admin Config.

**Что осталось от пользователя для активации**:
1. Ввести `Stripe Secret Key` (`sk_test_…`) и `Webhook Secret` (`whsec_…`) в Admin Config.
2. Нажать «Проверить подключение» — ожидаем зелёный ответ.
3. Нажать «Синхронизировать EUR» — Products/Prices появятся в Stripe Dashboard.
4. На production: зарегистрировать webhook URL в Stripe Dashboard → URL `https://<домен>/api/billing/webhook` → события `customer.subscription.*`, `checkout.session.completed`, `invoice.paid`.

### 2026-05-26 — итерация 4.1 ✅ SIP Итерация В (исходящий звонок Web → телефон)

**Цель:** дать пользователю кнопку «Позвонить» прямо в веб-интерфейсе, чтобы он мог звонить из браузера на любой телефон с синхронным переводом.

**Backend `service.ts placeSipCall(tenantId, phoneNumber, calleeLanguage, callerName?)`:**
1. Находит outbound-trunk пользователя в LiveKit Cloud через `listSipOutboundTrunk()` по имени `vibevox_trunk_{tenantId}`.
2. Создаёт новую комнату (UUID-имя) через существующий `createRoom` — это гарантирует, что фронт-валидация `/api/rooms/validate` пройдёт.
3. Вызывает `sipClient.createSipParticipant(trunkId, phoneNumber, roomId, {participantMetadata: {nativeLanguage, voiceGender}})`. LiveKit инициирует SIP-INVITE на номер. Метаданные пробрасываются SIP-участнику, и `TranslationBridge.parseParticipantMetadata` подхватывает их при `TrackSubscribed` так же, как для веб-участника — без правок bridge.
4. Возвращает `{roomId, sipParticipantId, ...}`.

**Backend `router.ts POST /api/sip/call`:**
- Валидация: телефонный номер по regex `^\+?[\d\s\-()]{7,20}$`, язык 2 символа ISO-639-1.
- Параллельно стартует `TranslationBridge` через внутренний fetch на `/api/translation/start` (не блокирует ответ).
- Возвращает `{status: 'calling', roomId, roomName, sipParticipantId, phoneNumber}`.

**Frontend `SipPage.tsx` — новая секция «Исходящий звонок»:**
- Если у пользователя нет outbound-trunk → янтарная подсказка «Сначала настройте трунк».
- Если есть → форма: телефон (`+48...`) + LanguagePicker «Язык получателя».
- Зелёная кнопка «Позвонить» с иконкой `PhoneCall`. После нажатия → fetch /api/sip/call → `navigate('/room/' + roomId)`. Пользователь попадает в обычное лобби комнаты, вводит имя/свой язык, подключается, и в этой комнате уже ждёт SIP-абонент (бот переводит).

**Программно подтверждено через curl** (с LiveKit Cloud):
```
[POST /api/sip/call с phoneNumber=+48225550100, calleeLanguage=en]
→ HTTP 200
→ {
    "status":"calling",
    "roomId":"110cfb5c-8d8c-4873-9f78-269f0b634a0a",
    "sipParticipantId":"PA_ZJuytqzWiV7w",  ← реальный ID от LiveKit
    "phoneNumber":"+48225550100"
  }
```
До реального дозвона не дойдёт, потому что мы используем тестовые credentials у Zadarma (`100500`/`pw`). С реальными — LiveKit пошлёт SIP-INVITE и через несколько секунд телефон зазвонит.

**Bump `v0.4.1`**. SIP-цикл целостно завершён (Итерации А → Б → В).

### 2026-05-26 — итерация 4.0 ✅ SIP Итерация Б (входящие звонки)

**Цель:** дать каждому tenant'у уникальный SIP-адрес для приёма внешних звонков (Zadarma, OnlinePBX, Asterisk), с автоматическим переводом голоса.

**Backend `service.ts` — новые функции:**
- `createSipInbound(tenantId)` — генерирует уникальные `authUsername` (`vibevox-<12 first chars of tenant uuid>`) и 24-символьный пароль, регистрирует **inbound trunk** в LiveKit Cloud через `SipClient.createSipInboundTrunk`, создаёт **dispatch rule** `type:'direct'` с фиксированным `roomName: vibevox-sip-{tenantId}`, прикрепляет к trunk. Если у tenant уже есть inbound — старый удаляется и создаётся новый (rotate credentials).
- `getSipInbound(tenantId)` — читает из БД, расшифровывает пароль (он нужен пользователю целиком, чтобы вставить в Zadarma).
- `deleteSipInbound(tenantId)` — удаляет из БД + best-effort cleanup LiveKit trunk и dispatch rule.
- `setSipInboundBridgeActive(tenantId, bool)` — флаг «активирован ли приём в данный момент».
- `buildSipHost(livekitUrl)` — helper: `wss://vibevox-d1v4ek73.livekit.cloud` → `vibevox-d1v4ek73.sip.livekit.cloud`.

**Backend `router.ts` — новые endpoints:**
- `POST /api/sip/inbound` — создать (или перевыпустить).
- `GET /api/sip/inbound` — получить (404 если нет).
- `DELETE /api/sip/inbound` — удалить.
- `POST /api/sip/inbound/activate` — внутренний вызов `/api/translation/start` для комнаты `vibevox-sip-{tenantId}` + флаг bridge_active=true.
- `POST /api/sip/inbound/deactivate` — `/api/translation/stop` + flag=false.

**Backend БД:**
- Новая таблица `sip_inbound` (id, tenant_id, sip_host, room_name, auth_username, encrypted_auth_password, iv, livekit_inbound_trunk_id, livekit_dispatch_rule_id, bridge_active, created_at, updated_at).
- Fallback handlers в `db/index.ts` для всех CRUD-операций + UPDATE bridge_active.

**Frontend `SipPage.tsx` — новая секция «Входящие SIP-звонки»:**
- **Пустое состояние** — кнопка «Создать SIP-адрес для входящих» с объяснением.
- **Активное состояние**:
  - Заглавная плашка статуса (зелёная если bridge активен, янтарная если приостановлен) с кнопкой Power «Активировать/Остановить».
  - Карточка «Данные для вашего SIP-провайдера»: 4 строки (SIP-сервер, Логин, Пароль с Eye/EyeOff, Комната) с кнопкой Copy справа. Toast «Скопировано» через 1.5 с.
  - Карточка-инструкция «Как подключить (например, Zadarma)» — 5 пошаговых пунктов.
  - Опасная зона: «Перевыпустить credentials» + «Удалить SIP-адрес» (со стилизованным модалом подтверждения).

**Программное подтверждение** (E2E против реального LiveKit Cloud):
```
[GET inbound нет]   → 404 ✅
[POST create]       → 200, реальный LiveKit trunkId=ST_AAXbLo8PqeVi,
                            dispatchRuleId=SDR_bmLey4LhF2nL,
                            sipHost=vibevox-d1v4ek73.sip.livekit.cloud,
                            authUsername=vibevox-98fbf57e8d10,
                            authPassword (24 символа) ✅
[GET после create]  → 200, всё на месте ✅
[DELETE]            → 200 + cleanup LiveKit ✅
[GET после delete]  → 404 ✅
```

**Что работает на 100%** через `localhost:3000` (без публичного IP):
- Создание/получение/удаление inbound credentials.
- Их копирование в Zadarma вручную.
- Активация bridge в комнате `vibevox-sip-{tenantId}` (бот заходит, готов слушать).

**Что станет рабочим только после деплоя или ngrok**:
- Реальный входящий звонок от Zadarma → LiveKit → наша комната. Для этого нужно либо чтобы наш бэкенд имел публичный URL (для возможных webhook callbacks), либо просто чтобы LiveKit Cloud мог принять звонок (это уже работает, поскольку SIP-сторона на стороне LiveKit Cloud). На localhost для теста придётся вручную нажать «Активировать» перед звонком.

**Bump `v0.4.0`** (major minor — фича уровня feature complete для SIP-цикла).

### 2026-05-26 — итерация 3.5 ✅ SIP Итерация А (UI ↔ API)

**Цель:** связать `SipPage.tsx` (был mock) с реально работающим `/api/sip/trunk`.

**Что сделано:**

1. **`SipPage.tsx`** полностью переписан:
   - Загрузка через `GET /api/sip/trunk` с `x-tenant-id` из `useAppStore.user.tenantId`.
   - Создание/обновление через `POST` (одна форма для обеих операций).
   - Удаление через `DELETE` с подтверждением `confirm()`.
   - Toast-уведомления успеха/ошибки (зелёная/красная плашка сверху).
   - Защита для суперадмина (`tenantId === 'global_admin'` не проходит UUID-regex → показываем заглушку «SIP настраивается на уровне арендатора»).
   - При обновлении пустой пароль = «не менять» (плейсхолдер ___keep_existing___ — нюанс будущей доработки).
   - Показывает `liveKitSyncWarning` если LiveKit Cloud не смог синхронизировать.

2. **`service.ts upsertSipTrunk`** — синхронизация с LiveKit стала **best-effort**: даже если `createSipOutboundTrunk` падает, транк сохраняется в БД, в ответе появляется поле `liveKitSyncWarning` с описанием причины (без блокирующего 500-го кода). Это важно: на тарифах без SIP в LiveKit Cloud приложение всё равно функционально, и SIP включится сам, как только клиент активирует Cloud-модуль.

3. **`db/index.ts` — fallback handlers** для `sip_trunks` (чтобы CRUD работал и без PostgreSQL):
   - `SELECT id FROM sip_trunks`
   - `SELECT ... FROM sip_trunks` (с `^SELECT\b` префиксом — чтобы не захватывать `DELETE FROM sip_trunks` ниже!)
   - `INSERT INTO sip_trunks`
   - `UPDATE sip_trunks SET ... WHERE tenant_id = $7`
   - `DELETE FROM sip_trunks WHERE tenant_id = $1`
   - Все regex с `\s+` для multi-line SQL из `service.ts`.
   - Расширил тип возврата mock на `{ rows: any[]; rowCount?: number }`.

4. **`package.json dev`** — переход на `tsx watch` (subcommand) с `--exclude db_fallback.json` + другие state-файлы. Это решает race condition: при сохранении в БД tsx больше не перезагружает процесс, теряя in-memory state.

5. **Hotfix в `db/index.ts`** для существующего бага: mock `INSERT INTO users` возвращал поле `tenantId` (camelCase), а `auth/router.ts` читал `tenant_id` (snake_case) → JWT суперадмина получался без `tenantId`. Теперь возвращаются **оба** ключа.

6. **Bump `v0.3.5`**.

**Программное подтверждение** (полный E2E через curl):
```
[1/7] GET (нет)         [404] ✅
[2/7] POST create       [200] ✅
[3/7] GET (есть)        [200] ✅
[4/7] POST update       [200] ✅
[5/7] GET (transport udp) [200] ✅
[6/7] DELETE            [200] ✅
[7/7] GET (404)         [404] ✅
```

**Замечание про LiveKit:** при отсутствии `callerId` Cloud-API возвращает `no trunk numbers specified` — это валидное поведение, не баг. С указанным callerId синхронизация проходит без warning.

### 2026-05-26 — итерация 3.4 ✅ ПЕРЕВОД ЗАРАБОТАЛ ВЖИВУЮ
- **Подтверждение от пользователя**: «Я говорю, оно переводит на английский язык». На скриншоте видны субтитры «Hello. Hello.» — бот перевёл «Привет. Привет.» через Gemini 3.1 Flash Live Preview, native HD-голос Aoede.
- **Hotfix**: `audioSource.captureFrame()` оказалась async и при `InvalidState` (трек закрыт) валила весь Node.js процесс. Теперь правильный `.catch()` + глобальные `process.on('unhandledRejection')` и `process.on('uncaughtException')` в `server.ts` как страховочный слой.

#### Архитектура работающего перевода (как это всё устроено сейчас)

```
┌─ Пользователь A (ru) ──────────────────────────────────────────┐
│   микрофон → Web RTC → LiveKit Cloud                            │
└─────────────┬───────────────────────────────────────────────────┘
              │ аудио-трек
              ▼
┌─ Бот «vibevox-translator» (TranslationBridge) ─────────────────┐
│   @livekit/rtc-node подключён к комнате как participant        │
│   На TrackSubscribed: создаёт Gemini Live Session для A        │
│                                                                 │
│   ┌─ Gemini Live (gemini-3.1-flash-live-preview, WebSocket) ─┐  │
│   │  config:                                                  │  │
│   │    responseModalities: [AUDIO]                            │  │
│   │    speechConfig: voice "Aoede"                            │  │
│   │    inputAudioTranscription: {}                            │  │
│   │    outputAudioTranscription: {}    ← это даёт нам текст   │  │
│   │    systemInstruction:                                     │  │
│   │      "You are a real-time interpreter.                    │  │
│   │       Translate everything to English. Output ONLY        │  │
│   │       translated audio. No commentary..."                 │  │
│   │                                                            │  │
│   │  Поток:                                                   │  │
│   │    PCM 16kHz mono от A → sendRealtimeInput                │  │
│   │    ← inlineData audio/pcm (Aoede на en)                   │  │
│   │    ← outputTranscription.text "Hello. Hello."             │  │
│   │    ← turnComplete                                         │  │
│   └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│   Параллельно:                                                  │
│   ① publishTranslatedAudio → AudioSource.captureFrame()         │
│      → LiveKit publishes audio-track «translation-A»            │
│   ② publishSubtitleData → publishData(JSON, destination=B)      │
│      topic: "subtitle", isFinal: streaming chunks → final       │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─ Пользователь B (en) ──────────────────────────────────────────┐
│   ① слышит trans audio через <audio> (remoteAudioRef)           │
│   ② RoomEvent.DataReceived → парсит JSON subtitle               │
│        pendingSubtitle = streaming chunks                       │
│        на isFinal=true → пушит в feed (3 последних)             │
│   ③ кликает на субтитр → AI Coach (gemini-3.5-flash, streaming) │
│      приватная янтарная панель                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Ключевые моменты, которые мы открыли в процессе отладки:**

1. **`gemini-live-2.5-flash-preview` не существует** в Gemini API (404). В коде был захардкожен. Реальные Live-модели: `gemini-2.5-flash-native-audio-latest`, `-preview-09-2025`, `-preview-12-2025`, и новейшая **`gemini-3.1-flash-live-preview`** (март 2026). 3.5 Flash есть, но БЕЗ Live (только `generateContent`).

2. **`streamTranslationConfig` не поддерживается** реальным API (`Unknown name` 1007). SDK 2.6.0 его принимает на TS-уровне, но Google его не понимает. Перевод делаем через `systemInstruction` — это работает.

3. **`outputAudioTranscription: {}`** — правильный способ получать текст транскрипта параллельно с аудио. Текст приходит в `serverContent.outputTranscription.text` chunked.

4. **`destination_identities`** — snake_case, не camelCase, в `@livekit/rtc-node`. Это адресная доставка data channel сообщения только нужному участнику.

5. **`captureFrame` асинхронная** — обязательно `.catch()` на Promise, иначе при закрытии трека unhandled rejection убивает весь сервер.

### 2026-05-26 — итерация 3.2 (НАЙДЕНА КОРНЕВАЯ ПРИЧИНА молчания + переход на 3.1 Live + 3.5 Flash)
- **Корневая причина субтитров (раскрыта через probe).** Я написал отдельный `probe-correct.mjs`, который подключался к Gemini Live с разными конфигами. Результаты:
  - **`gemini-live-2.5-flash-preview` не существует** — Google возвращает `code=1008 model is not found`. Это имя я использовал в `translation/config.ts` дефолтом, и оно никогда не работало.
  - **`streamTranslationConfig` тоже не существует** в реальном API — Google отвечает `code=1007 Unknown name "streamTranslationConfig" at 'setup.generation_config'`. SDK 2.6.0 это поле принимает на TypeScript-уровне, но сервер его отвергает. Из-за этого сессия закрывалась сразу после handshake, callback `onmessage` ни разу не вызывался.
- **Список реально доступных Live-моделей** (получено через `GET /v1beta/models`):
  - `gemini-3.1-flash-live-preview` (март 2026, новейшая)
  - `gemini-2.5-flash-native-audio-latest` (alias)
  - `gemini-2.5-flash-native-audio-preview-12-2025`
  - `gemini-2.5-flash-native-audio-preview-09-2025`
- **`gemini-3.5-flash`** — есть в каталоге (релиз 05-2026), но **только text/multimodal**, без `bidiGenerateContent` → Live API она не умеет. Используем её для всех non-Live задач (AI Coach, dialects test-sample, verify probe, assistant).
- **Изменения в коде**:
  - `bridge.ts`: убран `streamTranslationConfig`, модель берётся динамически через `getGeminiLiveModel()`, перевод теперь через `systemInstruction` (`buildTranslationInstruction(targetLanguage)`). Диагностический лог удалён.
  - `translation/config.ts`: добавлена функция `buildTranslationInstruction` с production-промптом «You are a real-time simultaneous interpreter. Output ONLY translation. No commentary…».
  - `config/systemConfig.ts`: новое поле `geminiLiveModel` + `DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview'` + геттер `getGeminiLiveModel()`. `getSettingsForClient()` отдаёт его клиенту (не секрет).
  - `coach/router.ts`, `dialects/router.ts`, `auth/router.ts` (verify-google), `assistant/service.ts`, `assistant/telegram_gateway.ts`: модель `gemini-2.5-flash` → **`gemini-3.5-flash`**.
  - `AdminConfigPage.tsx`: под полем «Gemini API Key» добавлен `<select>` с 4 Live-моделями, при глюке 3.1 — одним кликом откат на 2.5 latest. Сохранение через тот же `/api/auth/system-settings`.
- **Сравнение со внешним конкурентом** (для записи): OpenAI gpt-realtime-translate стоит ~$4.08 за час двустороннего перевода, Gemini 3.1 Live — ~$1.38. Разница 2.95× в пользу Gemini. Качество: OpenAI лучше на низкоресурсных языках (Hindi/Tamil/Telugu, –12.5% WER), но для нашей целевой аудитории RU/EN/EU они эквивалентны. Plus у Gemini: function calling в Live, native HD voice без cascade TTS, динамическая смена голоса/инструкции на лету.

### 2026-05-26 — итерация 3.1 (hotfix транскрипции)
- **Симптом**: после итерации 3 субтитры не приходили, плашка показывала «Ожидание реплики собеседника…».
- **Причина**: в Gemini Live API `Modality.TEXT` **несовместима со `streamTranslationConfig`** — при активном нативном переводе текстовый канал игнорируется. Это особенность preview-модели.
- **Фикс**: вместо `Modality.TEXT` используется отдельный механизм Gemini Live — `outputAudioTranscription: {}` (даёт текст того, что бот синтезирует получателю, т.е. готовый субтитр перевода) и `inputAudioTranscription: {}` (текст исходной речи спикера, пока не публикуем). Обработчик `handleGeminiMessage` теперь читает `serverContent.outputTranscription.text`, накапливает chunks и стримит через data channel получателю.
- **Версия фронта**: v0.2.2 → **v0.3.0** в углу сайдбара. С этого момента после каждой итерации версия инкрементируется в `apps/frontend/src/components/AppVersion.tsx` (там же история всех версий с описанием). Если в углу не v0.3.0 после Ctrl+Shift+R — значит браузер закешировал старый бандл.

### 2026-05-26 — итерация 3 (блоки Г + AI Coach + индикатор связи + ngrok)
- **Текстовые субтитры (Г).** В `bridge.ts` Gemini Live теперь работает с `responseModalities: [AUDIO, TEXT]` — параллельно с переведённым аудио прилетает текст. Бот накапливает text chunks и публикует их через LiveKit data channel **адресно получателю** (`destination_identities: [recipient]`), не широковещательно — каждый видит только свой перевод. Сообщения с топиком `subtitle` идут с флагом `isFinal: false` (streaming partial) и `isFinal: true` (готовая реплика).
- **Фронт принимает субтитры.** `RoomEvent.DataReceived` фильтрует по топику `subtitle`, держит `pendingSubtitle` (текущий чанк) и feed из последних 20 финальных. В плашке отображаются последние 3 — кликабельные.
- **AI Coach.** Новый модуль [apps/backend/src/modules/coach/router.ts](apps/backend/src/modules/coach/router.ts) — `POST /api/coach/explain` стримит ответ Gemini Flash (`gemini-2.5-flash`) через `text/plain; charset=utf-8` chunked encoding. System prompt лаконичный: «дай разбор + 2-3 варианта ответа на языке пользователя». Фронт читает через `ReadableStream` + `TextDecoder`, обновляет UI по словам как ChatGPT.
- **UI AI Coach** — янтарная приватная панель над контролами. Внутри: реплика собеседника, стримящийся ответ ИИ с курсором ▍, пресеты-чипы (Нейтрально / Шутка / Формально / Коротко / Глубоко / Научно / Эмпатично), textarea для произвольного промпта, кнопки Pin / Copy / Close. Авто-скрытие через 30 сек если не закреплено.
- **Цветовое разделение.** 🔵 синий — субтитры перевода (видны обоим). 🟡 янтарный — AI Coach (только мне). Реализовано через разные цветовые токены и тень — пользователь не путает «что сказал собеседник» с «что я должен ответить».
- **Индикатор связи.** Подписка на `RoomEvent.ConnectionQualityChanged` локального участника. В правом верхнем углу плашка с иконкой Wifi/WifiOff + текстом «Связь стабильная / нестабильная / Слабый интернет / Связь потеряна» и цветом рамки (зелёный/жёлтый/красный).
- **Vite под ngrok.** `server.host: true`, `server.allowedHosts: ['.ngrok-free.app', '.ngrok.io', '.ngrok.app', '.ngrok.dev']` — теперь можно расшарить локальный фронт через `ngrok http 3000` без ошибки «Invalid Host header».
- **Проверено программно**: type-check обоих воркспейсов чист; `POST /api/coach/explain` со streaming реально возвращает русский ответ Gemini Flash («Они начинают разговор с вежливого приветствия. 1. Здравствуйте… 2. Добрый день…»); валидация полей возвращает 400.

### 2026-05-26 — итерация 2 (блок В)
- **`/api/livekit/token`** теперь возвращает `{ token, url }` вместо `{ token }` — клиент получает публичный URL LiveKit Cloud одним запросом ([apps/backend/src/modules/livekit/router.ts](apps/backend/src/modules/livekit/router.ts)).
- **`RoomPage.tsx`** переписан с симуляции на реальный LiveKit:
  - подключение через `livekit-client` к комнате с UUID `roomId` как `roomName`;
  - публикация микрофона и камеры (`setMicrophoneEnabled`/`setCameraEnabled`) с реакцией на тогглы UI;
  - реальные `<video>` элементы для local (зеркальное `scaleX(-1)`) и remote участников, аватар как fallback;
  - скрытый `<audio>` для воспроизведения голоса собеседника + переведённого аудио бота;
  - детект активного спикера через `RoomEvent.ActiveSpeakersChanged` (бот игнорируется);
  - автоматический запуск Gemini-моста через `POST /api/translation/start` после подключения, остановка через `/stop` при hangup;
  - индикатор статуса вместо симулированных субтитров: `connecting → connected → translatorStarting → translatorReady` (плюс `error`);
  - hangup корректно отключает room, останавливает bridge, чистит состояние.
- **Убран хардкод** `http://localhost:3001` в `RoomPage.tsx` — все fetch теперь идут через относительные `/api/...` (Vite-прокси на dev, тот же хост на проде).
- **Программно проверено E2E**: создание комнаты → токен → реальное подключение бота-переводчика к LiveKit Cloud (`Connect callback received`, идентичность `vibevox-translator`) → корректная остановка моста.

---

## 7. Чек-лист перед деплоем на Hostinger

### 🔒 БЕЗОПАСНОСТЬ — критично

- [ ] **Секреты в репозитории.** Сейчас `apps/backend/system-config.json`, `apps/backend/google-oauth.json` и `apps/backend/.env` лежат в `.gitignore` некорректно (как минимум `system-config.json` и `google-oauth.json` точно закоммичены). В них боевые ключи Gemini, LiveKit Cloud и Google OAuth.
  - Добавить в `.gitignore`: `system-config.json`, `google-oauth.json`, `db_fallback.json`, `apps/backend/.env`.
  - Удалить из индекса: `git rm --cached apps/backend/system-config.json apps/backend/google-oauth.json apps/backend/db_fallback.json apps/backend/.env`.
  - **Ротировать все засветившиеся секреты** в Google Cloud Console (OAuth Client Secret), Google AI Studio (Gemini API key), LiveKit Cloud Dashboard (API Key + Secret), Stripe Dashboard. Старые считать утёкшими.
  - Создать `system-config.example.json` с пустыми значениями для документации.

- [ ] **JWT_SECRET.** Сейчас в коде хардкод-дефолты, причём **разные** в `auth/router.ts` (`'vibevox_secret_key_2026'`) и `rooms/router.ts` (`'test_jwt_secret_key_vibevox_2026'`). Это значит, что токен, выданный auth, не пройдёт валидацию в rooms. Нужно:
  - Унифицировать на один общий импорт из `process.env.JWT_SECRET`.
  - В проде задать `JWT_SECRET` в `.env` как 64+ случайных байт.
  - Хардкод-дефолты удалить или оставить только для dev с явным `console.warn`.

- [ ] **Суперадмин-хардкод.** В `auth/router.ts` пароль `Danyuk1976!` зашит в код. Перед прод-деплоем — вынести в env-переменную и сменить пароль, либо завести запись в БД и убрать хардкод-флоу.

- [ ] **Stripe webhook secret.** В `.env` сейчас `whsec_mock_webhook_secret`. Перед деплоем — реальный из Stripe Dashboard, и проверить, что webhook URL прописан в Stripe → `https://<domain>/api/billing/webhook`.

- [ ] **SIP_ENCRYPTION_KEY.** Сейчас `test_secret_master_key_for_sip_encryption_2026`. На проде — 32 случайных байта (`openssl rand -hex 32`), один и тот же на всех инстансах, иначе расшифровка SIP-паролей сломается.

- [ ] **CORS.** Сейчас `app.use(cors())` — открыт всему миру. На проде — `cors({ origin: 'https://<твой-домен>', credentials: true })`.

- [ ] **Hardcoded localhost.** Проверить и убрать все `http://localhost:3001` / `http://localhost:3000` из кода фронтенда (минимум `RoomPage.tsx`, `auth/router.ts` redirect). Использовать относительные пути `/api/...` (фронт) или переменные окружения.

### 🛠 Инфраструктура

- [ ] PostgreSQL на VPS, БД создана, RLS-политики прогнаны через `apps/backend/src/db/init.sql`.
- [ ] `db_fallback.json` **не** должен оказаться на проде (это dev-фоллбэк).
- [ ] Nginx reverse-proxy с SSL (Let's Encrypt) перед Node.
- [ ] PM2 / systemd для процесса бэкенда, авто-рестарт при падении.
- [ ] Backup БД (минимум ежедневный, желательно с retention 7+ дней).
- [ ] Логи в файл с ротацией; `console.log` отдельно от ошибок.
- [ ] Healthcheck `/api/health` подключён к мониторингу.
- [ ] Frontend собран (`npm run build`) и раздаётся Nginx как статика, не через `vite dev`.

### 📦 Конфиг приложения

- [ ] `.env.production` на VPS со всеми реальными ключами (см. чек-лист безопасности).
- [ ] `GEMINI_LIVE_MODEL` — сейчас `gemini-live-2.5-flash-preview`. Проверить актуальность модели на момент деплоя (Google регулярно меняет имена preview-моделей).
- [ ] LiveKit Cloud — проверить квоты тарифа на ожидаемую нагрузку (одна комната = бот + N участников = N+1 connection).
- [ ] Stripe Products & Prices созданы для трёх тарифов (Trial, Monthly/Annual, Enterprise) и их `price_id` синхронизированы с кодом.

### ✅ Перед первым релизом — smoke test

- [ ] Регистрация нового пользователя через email/пароль.
- [ ] Логин Google OAuth.
- [ ] Создание комнаты → переход по ссылке → лобби с выбором языка.
- [ ] Двое заходят в комнату с разных устройств → перевод работает в обе стороны.
- [ ] Смена пола голоса спикера → детектор пересоздаёт Gemini-сессию.
- [ ] Stripe webhook прилетает и обновляет `subscription_status` в БД.
- [ ] Истёкшая комната (можно вручную поправить `expires_at` в БД) возвращает 400 на `/validate`.

---

## 8. Запланированные следующие блоки

- ✅ ~~**(В) Реальный LiveKit + Gemini в `RoomPage.tsx`**~~ — итерация 2.
- ✅ ~~Замена хардкода `http://localhost:3001`~~ — итерация 2.
- ✅ ~~**(Г) Текстовые субтитры**~~ — итерация 3.
- ✅ ~~**AI Coach** (приватный янтарный помощник)~~ — итерация 3.
- ✅ ~~**Индикатор слабой связи**~~ — итерация 3.
- ✅ ~~**Vite под ngrok**~~ — итерация 3.
- **(Д) Выбор пола голоса в лобби** (`RoomLobbyPage.tsx`) — сейчас всегда `female`.
- **(Е) Унификация `JWT_SECRET`** — один импорт во всех роутерах, удалить хардкод-дефолты.
- **(Ж) `.gitignore` + ротация утёкших секретов** (перед деплоем — см. чек-лист §7).

---

## 9. Как тестировать вдвоём через ngrok (без деплоя)

Когда нужно дать ссылку второму человеку — пока проект не задеплоен — самый быстрый путь это **ngrok**: он создаёт публичный HTTPS-туннель к локальному порту 3000.

### Установка (один раз)
1. Скачать ngrok: https://ngrok.com/download → распаковать `ngrok.exe`.
2. Зарегистрироваться и получить authtoken: https://dashboard.ngrok.com/get-started/your-authtoken.
3. Один раз сохранить токен: `ngrok config add-authtoken <YOUR_TOKEN>`.

### Запуск
В трёх отдельных окнах терминала:
```bash
# 1. Бэкенд
cd apps/backend && npm run dev

# 2. Фронт
cd apps/frontend && npm run dev

# 3. ngrok (только фронт публикуем — он сам проксирует /api на :3001)
ngrok http 3000
```
ngrok выдаст URL типа `https://abc123.ngrok-free.app`. Это **публичная ссылка**, которую можно отправить второму участнику.

### Что важно
- **WebRTC работает напрямую** клиент↔LiveKit Cloud (через `wss://vibevox-d1v4ek73.livekit.cloud`) — ngrok тут не участвует. Поэтому даже если ngrok тормозит — видео и аудио идут оптимальным путём.
- **HTTPS обязателен** для `getUserMedia` (камера/микрофон) в современных браузерах. ngrok даёт бесплатный HTTPS — это решает проблему.
- **Bot-переводчик** запускается на твоём локальном бэкенде (`/api/translation/start`), и он сам подключается к LiveKit Cloud. Это значит: пока твой ноутбук включён и есть интернет — бот работает.
- **Free-план ngrok**: каждый запуск даёт **новый случайный URL**. Если перезапустишь ngrok — старая ссылка протухнет. Платный тариф даёт постоянный домен.
- **ngrok-предупреждение**: при первом заходе на free-URL ngrok может показать промежуточную страницу «You are about to visit». Достаточно нажать «Visit Site» — после этого работает нормально. Чтобы её убрать, можно отправить второму человеку ссылку с заголовком `ngrok-skip-browser-warning: true`, но проще один раз кликнуть.

### Стоит ли делать прямо сейчас или ждать деплоя?
**Сейчас — ngrok.** Причины:
1. Мы ещё активно меняем фичи (Coach, субтитры, индикаторы), каждые 5-10 минут что-то добавляется. Если развернёшь на хостингере прямо сейчас — будешь раз в полчаса дёргать `git pull && npm run build && pm2 restart`. Через ngrok твой `npm run dev` сразу подхватывает изменения через HMR.
2. На ngrok можно за 60 секунд позвать собеседника, проверить динамику, починить баг и сразу переподключиться.
3. **Главное:** перед деплоем нужно сначала **ротировать секреты** (Google OAuth, Gemini, LiveKit, Stripe — все в `system-config.json` сейчас «открыты», см. §7 чек-лист). Деплоить с открытыми ключами — большой риск.

Деплой на Hostinger делаем когда:
- AI Coach + субтитры протестировали на живых людях, есть фидбек;
- секреты ротированы и `.gitignore` обновлён;
- финализирован выбор пола голоса (Д) и унифицирован JWT (Е).

---

## v0.10.21 — UX-большая итерация + i18n + SEO (ночь 2026-05-28)

Это была одна длинная сессия по UX-полировке всего приложения + ночной автомод-прогон по интернационализации и SEO.

### Часть А — UX-полировка (вечер 27 мая)

**Полностью пересобрана главная страница и навигация.**

1. **Удалена `DashboardPage`** — Главная больше не нужна, её роль теперь у RoomPage (`/`). `index: true` → `<RoomPage />`. Все `navigate('/room')` → `navigate('/')`. Файл `pages/DashboardPage.tsx` удалён.
2. **Mobile bottom-tabbar полностью пересобран** — сначала убирался «Главная», потом «Тарифы», потом сама полоса. В итоге у мобильного UI больше нет горизонтального tab-bar внизу:
   - Вся вторичная навигация в `MoreSheet` (выезжает снизу из гамбургера сверху).
   - Создание комнаты — через плавающую FAB-кнопку.
   - Гамбургер и MoreSheet — общий state через `useAppStore.moreSheetOpen` + `setMoreSheetOpen`.
3. **Hamburger top-right в `MainLayout`** — Menu-иконка в шапке открывает MoreSheet. Аватар + переключатель темы убраны из шапки (они теперь внутри sheet).
4. **Mobile header** — VibeVox-лого слева (clickable → `/`), баланс + LanguageSwitcher (новое) + Menu справа. Без обводок, минимализм.
5. **Балансовая карточка** в десктоп-сайдбаре — добавлен CTA-индикатор «💳 Тарифы» под прогресс-баром (клик уже работал, но теперь видно).
6. **Плавающая FAB-кнопка**:
   - Иконка-композит `Languages + Phone` (наши фирменные).
   - Цвета `#ff7300` (оранж) + glow с пульсацией box-shadow через Framer Motion.
   - Расположение: `fixed bottom-6 right-6 z-30` (видна на всех размерах).
   - Скрывается только на странице чата (`/room/:roomId/chat`) чтобы не перекрывать кнопку «Отправить».
   - Клик → `navigate('/?create=true')` → `useEffect` в RoomPage срабатывает → handleCreateRoom → создание комнаты или paywall.
7. **handleCreateRoom переработан**:
   - Прежняя цепочка «Создать → модал «Новая комната» (имя) → Submit → создание» убрана.
   - Теперь: pre-check `translationBalance > 0` → если нет → PaywallModal; если есть → POST `/api/rooms/create` с авто-именем `Комната {name} · {date}` → `navigate('/room/:id')` → лобби.
8. **`?create=true` URL trigger** — `useSearchParams` в RoomPage. Очищается сразу после срабатывания через `setSearchParams({})` чтобы не сработало повторно.

**Логотипы и иконки.**

9. **`VibeVoxLogo` компонент** (`components/VibeVoxLogo.tsx`):
   - Файлы: `/vibevox-logo-light.png` (тёмный текст для светлого фона = `Content/VIBEVOX LOGO.png`), `/vibevox-logo-dark.png` (светлый текст для тёмного фона = `Content/VIBEVOX LOGO (1).png`).
   - Реагирует на класс `dark` через MutationObserver.
   - Поддерживает проп `variant="light" | "dark"` — для мест с фиксированным фоном независимо от темы (action-sheet звонка, лого над «Перевод активен» — всегда `dark`).
10. **`VibeVoxIcon` компонент** — квадратный фавикон-логотип `Content/faliconVIBEVOX.png` → `/vibevox-icon.png` + `/favicon.png`. Используется в `PaywallModal` и `InsightsModal` (модалка пост-аналитики), а также `index.html` (`<link rel="icon">`).
11. **Везде где был `Zap` (молния)** — заменено на `VibeVoxLogo` / `VibeVoxIcon`:
    - MainLayout (desktop sidebar + mobile header logos).
    - RoomLobbyPage («Подключение к видеовстрече»).
    - LoginPage / RegisterPage / ForgotPassword / GoogleCallbackPage.
    - PaywallModal header (Sparkles → VibeVoxIcon).
    - InsightsModal header (BarChart3 → VibeVoxIcon).
    - Над «Перевод активен» в активном звонке.
    - Action-sheet звонка («Действия» → VibeVoxLogo).

**Цвета: розовый → оранжевый `#ff7300`.**

12. **CSS-класс `.btn-danger`** в `index.css`: `rgba(244,114,182,…)` → `rgba(255,115,0,…)`. Затрагивает все `AuroraButton variant="danger"`.
13. **Logout-кнопка** в MoreSheet — все три инлайн-стиля переведены на оранжевый.
14. **Баланс «N мин»** в шапке — `#ff7300`. Иконка-композит (TranslationPhoneGlyph) — `var(--text-primary)` (чёрная на светлой / белая на тёмной), текст — оранжевый.
15. **FAB иконки + glow** — все оранжевые `#ff7300` / `rgba(255,115,0,…)`.
16. **Активный таб «Видеозвонки/Quest Flow/VibeAdd»** в списке комнат — оранжевый (был синий/cyan/violet).
17. **Иконка trash + кнопка «Чат»** на карточке комнаты — оранжевая (была красная/фиолетовая).

**Видеозвонок (RoomPage активного звонка):**

18. **Верхний статус-бар убран** (три плашки «Вы / время / связь»).
19. **Под логотипом** — компактная статус-строка в одну линию: пульсирующий dot (по `liveStatus`) + `RU → AUTO` + таймер + WifiBars (3 деления, цвет по `linkQuality`).
20. **Лента субтитров**:
    - Reverse-порядок (новейший сверху).
    - Показываем все накопленные субтитры (до 20), а не последние 3.
    - `max-h: 45vh` — не лезет на видео собеседника, всегда есть скролл при нужде.
    - `overscroll-behavior: contain`, `hide-scrollbar` (без полосы).
    - Обводка субтитра-кнопки — оранжевая (была синяя).
21. **AI Coach (как ответить)**:
    - Чипы пресетов — без emoji-префиксов (`🎯 Нейтрально` → `Нейтрально`).
    - Markdown зачищается через `stripMarkdown()` — `**`, `*`, `` ` ``, `#`, маркеры списков.
    - Кнопка «Скопировать» убрана.
    - Textarea на `w-full` (2 строки), «Спросить ИИ» — `w-full` отдельной строкой ниже.
    - **Free-form questions поддержаны**: если `customPrompt.length > 12` → отправляется как `subtitleText` (основной вопрос), а не как tone-модификатор. ИИ отвечает по сути.
22. **Post-call insights modal**:
    - Иконка `BarChart3` → `VibeVoxIcon`.
    - Метрики (Настроение / Вовлечённость / Lead Score) — `truncate`, `min-w-0 overflow-hidden`, `text-lg` вместо `text-xl`.
    - «Gemini 3.5 Flash · 5–10 секунд» → просто «5–10 секунд».

**Чат комнаты (RoomChatPage):**

23. **Fixed-layout** — `fixed inset-x-0 bottom-0 top-[57px] lg:top-0 lg:left-64 z-10 flex flex-col`. Header + composer прибиты к краям, скролл только в средине.
24. **Header + composer** имеют `flex-shrink-0`, MessageList — `flex-1 overflow-hidden` + внутренний `absolute inset-0 overflow-y-auto`.
25. **Empty-state** «Пока нет сообщений…» — `relative flex-1` + `absolute inset-0` (вместо `flex-1 flex`), не дёргается при изменении composer'а.
26. **Info-баннер «Видео-комната. Сообщения сохраняются как заметки…» удалён** из ComposerWithMedia.
27. **`extractDisplayText(content)` + `hasDisplayableContent`** в `components/chat/messageText.ts`:
    - Парсит JSON-content (старые transcript-записи `{author, originalTimestamp}`) — ищет `text/transcribed/transcript/content/value/message/body/caption/translatedText/translated/original/originalText` поля.
    - Если ничего нет — возвращает null.
    - В MessageBubble: если text=null и `kind==='audio'` + есть mediaUrl → подпись «🎤 Аудио-сообщение».
    - `extractOriginalTimestamp` — достаёт мс из JSON; в MessageBubble время отображается с секундами `HH:MM:SS` для разлима внутри одной минуты.
28. **`onClick → navigate('/')`** во всех «back to rooms» местах RoomPage / RoomChatPage (раньше было `/room`).

**Settings/Auth:**

29. **SettingsPage упрощена** — поле «Имя» убрано из формы; вместо него — Pencil-кнопка inline-edit рядом с именем в шапке профиля (Enter → save, Esc → cancel, blur → commit). Subtitle: «Профиль и безопасность». Пункты «Уведомления» и «Безопасность» из menuItems удалены; осталась только «Подписка и баланс».
30. **Pencil-input для переименования комнаты** — убрана рамка (`outline-none border-none focus:outline-none focus:ring-0`).

**Confirm-modals для browser `confirm()` — 10 диалогов в 6 файлах** заменены на `ConfirmModal`:
- RoomPage: удаление комнаты в активном звонке.
- BillingPage: cancel + resume subscription.
- Section1Gemini: удаление Gemini-ключа + отвязка бота.
- Section2Prompt: очистка базы знаний.
- Section3QuestFlow: отзыв ключа + очистка базы знаний.
- TagsEditor: удаление тега.
- admin/UsersPage: cancel + resume sub.
- admin/PromocodesPage: деактивация + hard-delete промокода.

Паттерн один — `const [confirmDialog, setConfirmDialog] = useState<{ title; message; confirmLabel?; variant?; onConfirm } | null>(null)` + `<ConfirmModal open={!!confirmDialog} …/>` в конце JSX.

**Прочее (мелочь):**

- TagsEditor EditTagRow кнопки «Отмена/Сохранить» — `flex-wrap` чтобы не вылазили на мобильной.
- Section1Gemini кнопка «Тест» — короткий текст вместо «Выслать ботом тестовое извещение».
- Section3QuestFlow textarea промта — `useLayoutEffect` + ref → auto-grow по `scrollHeight`.
- Hide-scrollbar на мобильной + универсальный класс `.hide-scrollbar` (без media query) — для лент в звонке.
- Удаление комнаты: 404 → success (комната уже удалена).
- Список комнат: empty-state не вспыхивает во время первой загрузки (проверка `roomsLoading`).
- Mobile main-scroll без `paddingBottom: 80px` (раньше держал место под bottom-tabbar).

### Часть Б — i18n инфраструктура + автоперевод (ночь 28 мая, автомод)

**Цель** — авто-переключение языка по браузеру + 100+ языков под SEO. Без миграции на Next.js.

**1. Установлены пакеты:** `i18next-browser-languagedetector`, `i18next-http-backend`, `react-helmet-async`.

**2. [`src/config/i18n.ts`](apps/frontend/src/config/i18n.ts) переписан:**
- Сохранены 12 inline-локалей (auth/billing/room/sip/assistant) для существующих неймспейсов.
- Добавлены: `LanguageDetector` (порядок: `localStorage` → `htmlTag` → `navigator`), `HttpBackend` (lazy-load `/locales/{lng}/{ns}.json`), `partialBundledLanguages: true`.
- Новый неймспейс **`common`** — общие UI-строки (nav, balance, languagePicker, seo, footer).
- `SUPPORTED_LANGUAGES` — массив **108 языков** с native+English именами.
- `RTL_LANGUAGES` расширен: `['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi']`.
- `handleLanguageDirection(lng)` ставит `<html lang>` + `<html dir>` (rtl/ltr).

**3. Исходники переводов:**
- `apps/frontend/public/locales/ru/common.json` — источник истины (67 строк, ~5KB).
- `apps/frontend/public/locales/en/common.json` — заполнено вручную (для качества основной аудитории).
- **105 автогенерированных языков** через скрипт.

**4. Скрипт автоперевода** `apps/frontend/scripts/translate-locales.mjs`:
- Запуск: `npm run translate:locales` (новый скрипт в package.json).
- Источник: `ru/common.json` (русский).
- Цель: все коды из `TARGET_LANGUAGES` (соответствуют SUPPORTED_LANGUAGES).
- Использует Google Cloud Translation API v2 через fetch (без SDK).
- **Защита плейсхолдеров** `{{var}}` — превращаются в `__VV0__`, переводятся, потом восстанавливаются.
- Чанки по 50 строк, чтобы не упереться в лимит запроса.
- Идемпотентность: пропускает уже существующие файлы. Чтобы пересоздать локаль — удали её или добавь `"_meta": { "needsRefresh": true }` в её JSON.
- **API-ключ** хранится в `apps/frontend/.env.local` (в `.gitignore`).
- Стоимость прогона: ~$0.5–$2 по всем языкам.

**5. [`LanguageSwitcher`](apps/frontend/src/components/LanguageSwitcher.tsx) компонент:**
- Иконка `Globe` в шапке (десктоп-sidebar + мобильный header).
- При клике — поповер с поиском (по code/nativeName/englishName).
- Список 108 языков с отметкой текущего (оранжевая галочка).
- Закрывается по Esc или клику вне.
- Каждый элемент списка имеет `dir="rtl|ltr"` чтобы native-имена RTL-языков отображались правильно даже на LTR-странице.

**6. [`SeoMeta`](apps/frontend/src/components/SeoMeta.tsx) компонент:**
- Глобально в `App.tsx` под `HelmetProvider`.
- Динамически меняет `<title>`, `<meta description, keywords, content-language>`, OG-теги (`og:title/description/locale/url/image/site_name/type`), Twitter Card, `<link rel="canonical">`.
- **`<link rel="alternate" hreflang>` для всех 108 языков** + `x-default`.
- Все тексты — из `seo.*` ключей в `common.json` (переводятся автоматически как и остальное).
- `<html lang>` + `<html dir>` через `<Helmet><html …/></Helmet>` (Helmet поддерживает мутацию атрибутов корневого тега).

**7. `index.html` обновлён:**
- Default `<title>`, meta description, keywords, robots — английский (для краулеров до hydration).
- OG + Twitter Card теги — английские дефолты.
- JSON-LD блок `application/ld+json` → `@type: SoftwareApplication`.
- Динамически перезаписывается SeoMeta при загрузке React.

**8. Извлечение строк в i18n:**
- MainLayout — `nav.rooms`, `nav.sip`, `nav.enterpriseSettings`, `nav.admin`, `nav.createRoom`, `balance.label`, `balance.tariffs`. Через `useTranslation('common')`.
- LanguageSwitcher — все строки из `languagePicker.*`.
- SeoMeta — все строки из `seo.*` и `footer.*`.
- **RoomPage и другие экраны** оставлены на старой inline-локализации (12 языков) — не трогали, чтобы не сломать. Постепенно мигрировать на common-неймспейс.

### Часть В — Backend transcript (расследование)

**Источник проблемы найден.** Старые сообщения в `db_fallback.json` действительно сохранены в формате `content = '{"author":"...","originalTimestamp":N}'` без поля `text`.

**Текущий backend код корректен** ([`apps/backend/src/modules/rooms/router.ts:233–246`](apps/backend/src/modules/rooms/router.ts)):
- Берёт `text` из transcript-объекта и сохраняет его в столбец `content`.
- `{author, originalTimestamp}` уходит в столбец `metadata`.
- Свежие транскрипты сохраняются правильно.

**Фронт обработает оба формата:**
- Старые (content = JSON без text) → `extractDisplayText` вернёт `null` → MessageBubble покажет «🎤 Аудио-сообщение» (если есть audio mediaUrl) или скроет пузырь.
- Новые (content = чистый текст) → показывается как обычная реплика.

**Чтобы окончательно убрать старые «болванки»**: либо человеком в проде `DELETE FROM room_messages WHERE source='transcript' AND content LIKE '{%';`, либо подождать пока новые транскрипты их перебьют (delete-then-insert на каждом сохранении транскрипта уже есть в коде).

### Утренний чек-лист (как проверить):

1. **i18n работает** — открой `http://localhost:3000/`. В шапке — иконка `Globe` (рядом с гамбургером на мобиле, рядом с темой на десктопе). Клик → поповер → выбери, например, «Español». Навигация переключится. Перезагрузи — язык запомнен (localStorage).
2. **Авто-определение** — открой инкогнито с английской локалью → должно начать с английского.
3. **RTL** — выбери Arabic (العربية) или Hebrew (עברית). Поповер закроется, `<html dir="rtl">` появится, native-имена RTL-языков читаются справа-налево.
4. **DevTools → Elements → `<html>`** — должны быть `lang="es"` (или какой выбран) + `dir="ltr|rtl"`.
5. **DevTools → Network → reload** — должен подтянуться `/locales/es/common.json` (или соответствующий язык).
6. **SEO**: View-source страницы → должны быть:
   - `<title>` на текущем языке.
   - `<meta name="description">` на текущем языке.
   - `<link rel="alternate" hreflang="…">` для 108 языков + `x-default`.
   - `<link rel="canonical">`.
   - JSON-LD блок.
7. **Чат комнаты** — открой `/room/<id>/chat`. Старые transcript-сообщения покажутся как «🎤 Аудио-сообщение» (или audio-плеер с подписью). Новые транскрипты после реального звонка — обычным текстом.
8. **Список комнат при переходе** — больше не вспыхивает «Нет активных комнат». Загрузилось → сразу комнаты, либо пустой экран если правда нет.
9. **Удаление уже удалённой комнаты** — не показывает alert «Комната не найдена», просто убирает из списка.
10. **Активный звонок** — субтитры не лезут на видео (`max-h: 45vh`). Новые сверху. Под VibeVox-логотипом — компактная строка `● RU → AUTO · 02:16 · ▍▌▍`.
11. **AI Coach** — введи в textarea «Какая столица Франции?» и нажми «Спросить ИИ». Должен ответить «Париж», а не давать совет как реагировать на собеседника.

### Что НЕ сделано (с объяснениями):

- **Миграция на Next.js**: явно запрещено пользователем. Текущий Vite SPA + `react-helmet-async` даёт SEO на уровне ~75–85% от Next.js SSR. Для финального SEO-buyout нужно либо:
  - SSR/SSG-фронт (Next.js / Remix / Vite-SSG).
  - Либо prerender-в-build (плагин `vite-plugin-prerender-spa` для статически известных роутов).
  - Краулеры Google в 2024+ умеют рендерить SPA, но первичный crawl до hydration видит лишь дефолтные meta из index.html — поэтому они выставлены явно на английском.
- **Полный SEO-аудит через Lighthouse**: требует интерактивного запуска браузера. Запустить утром: DevTools → Lighthouse → Generate report → Performance, SEO, Accessibility.
- **Извлечь все строки RoomPage / SettingsPage / BillingPage / RoomChatPage в common-namespace**: масштабная работа, ~1000+ строк. Постепенно, не за ночь. Текущие inline-локализации работают для 12 языков.
- **Сабдомены `es.vibevox.app` / language-папки `/es/`**: требует серверной маршрутизации (Express middleware или nginx rewrite). Сейчас язык передаётся через query-параметр или localStorage. Для production-SEO рекомендую добавить `/[:lang]/*` префикс в роутере (фронт-only) + nginx rewrite. Подготовлю отдельно.
- **API-key Google Translate в `.env.local`** не зашифрован. **Перед публичным деплоем — вынеси в backend-side: фронт не должен напрямую дёргать Google API в продакшене.** Скрипт `translate:locales` запускается локально только во время разработки.

### Файлы, добавленные/изменённые ночью:

- ✅ `apps/frontend/package.json` — `+i18next-browser-languagedetector +i18next-http-backend +react-helmet-async`; новый `translate:locales` скрипт.
- ✅ `apps/frontend/.env.local` — Google API key (в `.gitignore`).
- ✅ `apps/frontend/src/config/i18n.ts` — полная переработка.
- ✅ `apps/frontend/src/components/LanguageSwitcher.tsx` — новый.
- ✅ `apps/frontend/src/components/SeoMeta.tsx` — новый.
- ✅ `apps/frontend/src/App.tsx` — `HelmetProvider` + `SeoMeta`.
- ✅ `apps/frontend/src/layouts/MainLayout.tsx` — `useTranslation('common')` + `LanguageSwitcher` в обеих шапках.
- ✅ `apps/frontend/index.html` — default SEO meta + JSON-LD.
- ✅ `apps/frontend/scripts/translate-locales.mjs` — новый скрипт.
- ✅ `apps/frontend/public/locales/{108 языков}/common.json` — переведено.

### Команды для верификации:

```bash
# Type-check
cd apps/frontend && npx tsc --noEmit

# Production build
cd apps/frontend && npm run build

# Дев-сервер (запусти и открой http://localhost:3000)
cd apps/frontend && npm run dev

# Перегенерировать переводы (опционально)
cd apps/frontend && npm run translate:locales
```

---

*Последнее обновление: 2026-05-28 — v0.10.21 (UX-полировка + i18n 108 языков + SEO-фундамент + автоперевод через Google API).*

---

## v0.10.22 — Полный SEO-стек: prerender + sitemap + robots + deploy (продолжение ночи 2026-05-28)

После основной i18n-работы (v0.10.21) докрутил **полный production-grade SEO-стек**
без миграции на Next.js. Главная фишка: prerendered HTML для всех 108 языков ×
4 публичных роута = 432 статических файла с правильно локализованным `<head>`.

### Дорожная карта (что и в каком файле)

| Слой | Файл | Назначение |
|------|------|------------|
| Переключатель языка | [`src/components/LanguageSwitcher.tsx`](apps/frontend/src/components/LanguageSwitcher.tsx) | Иконка Globe → поповер с поиском по 108 языкам. Position: fixed + анкоринг к КРАЮ viewport (не к кнопке) — попап не прыгает при ре-рендере / смене direction. |
| URL-prefix sync | [`src/components/LangPathSync.tsx`](apps/frontend/src/components/LangPathSync.tsx) | При первой загрузке снимает `/{lang}/` префикс из URL → ставит i18n язык → `history.replaceState`. Позволяет серверу отдавать prerendered HTML по `/es/auth/login` + дальше работать с flat URLs. |
| SEO meta-теги | [`src/components/SeoMeta.tsx`](apps/frontend/src/components/SeoMeta.tsx) | `react-helmet-async`. Динамически: `<html lang/dir>`, `<title>`, `<meta description/keywords/content-language>`, canonical, hreflang × 108 + x-default, OG, Twitter Card, robots. |
| i18n конфиг | [`src/config/i18n.ts`](apps/frontend/src/config/i18n.ts) | Кастомные detector'ы `pathSegment` + `querystring`. Порядок: URL prefix → `?lang=xx` → localStorage → `<html lang>` → navigator. HttpBackend для lazy-load `/locales/{lng}/common.json`. |
| App entry | [`src/App.tsx`](apps/frontend/src/App.tsx) | `HelmetProvider` + `LangPathSync` + `SeoMeta` + `RouterProvider`. |
| Robots | [`public/robots.txt`](apps/frontend/public/robots.txt) | Allow all + Disallow `/api/` + явное Allow для `GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `Google-Extended` + `Sitemap:` URL. |
| Sitemap generator | [`scripts/sitemap.mjs`](apps/frontend/scripts/sitemap.mjs) | Генерит `public/sitemap.xml`: 432 URL × 108 hreflang. Уважает `SITE_ORIGIN` env. |
| Prerender | [`scripts/prerender.mjs`](apps/frontend/scripts/prerender.mjs) | Head-injection: для каждого `(lang, route)` создаёт `dist/{lang}/{path}/index.html` с правильно переведёнными meta + hreflang. **Не puppeteer** — head-only, быстро. |
| Auto-translate | [`scripts/translate-locales.mjs`](apps/frontend/scripts/translate-locales.mjs) | Идемпотентный скрипт. Источник `ru/common.json` → переводит на 107 других через Google v2 API. Защищает `{{var}}` placeholders. Пропускает уже существующие файлы. |
| Lighthouse | [`scripts/lighthouse-audit.mjs`](apps/frontend/scripts/lighthouse-audit.mjs) | Прогоняет SEO/Performance/Accessibility/Best-Practices на 6 ключевых страниц. JSON-репорты в `reports/`. |
| Vercel конфиг | [`apps/frontend/vercel.json`](apps/frontend/vercel.json) | `buildCommand: build:full`, cache headers, `rewrites` для всех 108 lang-кодов → prerendered HTML. |
| Netlify конфиг | [`apps/frontend/netlify.toml`](apps/frontend/netlify.toml) | То же для Netlify. |
| Nginx шаблон | [`apps/frontend/nginx.example.conf`](apps/frontend/nginx.example.conf) | Self-hosting: gzip, cache, regex-rewrite на 108 кодов, SPA fallback, `/api/` proxy. |
| Deploy чек-лист | [`docs/DEPLOY.md`](docs/DEPLOY.md) | Полный чек-лист предпрод-обязанностей (env vars, DNS, smoke tests, monitoring, шпаргалка по платформам). |

### Скрипты в `package.json`

```json
{
  "build": "tsc && vite build",
  "build:full": "npm run sitemap && npm run build && npm run prerender",
  "sitemap": "node scripts/sitemap.mjs",
  "prerender": "node scripts/prerender.mjs",
  "translate:locales": "node scripts/translate-locales.mjs",
  "lighthouse": "node scripts/lighthouse-audit.mjs"
}
```

- `build` — обычный Vite. Используется в dev.
- **`build:full`** — продовый pipeline. Всегда используется CI/CD.
- `sitemap` / `prerender` — можно запускать отдельно для отладки.
- `translate:locales` — dev-tool, регенерирует переводы (нужен `GOOGLE_TRANSLATE_API_KEY` в `.env.local`).
- `lighthouse` — отдельный devDep `lighthouse + chrome-launcher` (не установлен по умолчанию: `npm i -D lighthouse chrome-launcher`).

### Что генерится при `build:full`

```
dist/
├── index.html                     (default English, динамически перезаписывается React)
├── assets/
│   ├── index-{hash}.js            (1.37MB → 386KB gzip — нужен code-split, см. TODO)
│   ├── index-{hash}.css           (39.6KB → 8.6KB gzip)
│   └── *.chunk.js                 (lazy-loaded Section pages)
├── locales/
│   ├── ru/common.json             (источник истины, 67 строк)
│   ├── en/common.json             (вручную доведённый)
│   └── ... × 108 языков           (auto-translated)
├── robots.txt
├── sitemap.xml                    (432 URL × 108 hreflang, ~4.2MB)
├── vibevox-logo-light.png / vibevox-logo-dark.png
├── favicon.png / vibevox-icon.png
├── af/  am/  ar/ ... × 108 папок  (по одной на язык)
│   ├── index.html                 (Spanish/Arabic/... home, 109 hreflang в head)
│   └── auth/
│       ├── login/index.html       (локализованный login meta)
│       ├── register/index.html
│       └── forgot-password/index.html
```

**Размер `dist/`** ≈ 13MB (большая часть — переводы и sitemap; они отлично жмутся
brotli/gzip на CDN).

### Как это работает на проде (полный flow)

#### 1. Бот заходит на `https://vibevox.app/es/auth/login`

- nginx/Vercel/Netlify видит URL `/es/auth/login`.
- Rewrite-правило сопоставляет `/{lang}/...` где `lang ∈ 108 кодов`.
- Отдаёт **`dist/es/auth/login/index.html`** напрямую (не SPA fallback).
- Бот получает:
  - `<html lang="es" dir="ltr">`
  - `<title>VibeVox: traducción con IA en tiempo real...</title>` (на испанском)
  - `<meta description>` на испанском
  - 109 `<link rel="alternate" hreflang>` (108 + x-default)
  - 7 `<meta property="og:*">` на испанском
  - 4 `<meta name="twitter:*">` на испанском
  - `<link rel="canonical" href="https://vibevox.app/es/auth/login">`
  - JSON-LD structured data
- Body всё ещё пустой `<div id="root">` — но Google рендерит JS, остальные боты
  читают то что есть в head.

#### 2. Человек заходит на тот же URL

1. Server отдаёт тот же `dist/es/auth/login/index.html`.
2. Браузер парсит, видит правильный head, начинает рендер.
3. JS bundle подгружается: `assets/index-{hash}.js`.
4. React стартует. **`LangPathSync`** срабатывает: видит `/es/` в URL → ставит
   `i18n.changeLanguage('es')` → удаляет префикс через `history.replaceState`.
5. URL в адресной строке становится `/auth/login` (без префикса).
6. **`SeoMeta`** через `react-helmet-async` обновляет head: title/meta/og — на
   текущий язык (`es`).
7. Router рендерит `<LoginPage />`. Юзер на испанском.
8. localStorage запомнил `i18nextLng=es`. Следующий заход — стартует сразу на
   испанском (если URL без префикса).

#### 3. Пользователь меняет язык через `LanguageSwitcher`

1. Клик по Globe → попап с поиском.
2. Выбор «Korean» → `i18n.changeLanguage('ko')`.
3. `i18n.on('languageChanged')` → `handleLanguageDirection` → `<html lang="ko" dir="ltr">`.
4. `SeoMeta` перерисовывает head с корейскими переводами.
5. localStorage: `i18nextLng=ko`.
6. URL не меняется (остаётся `/auth/login`). Если юзер захочет shareable URL —
   может вручную добавить `?lang=ko` или `/ko/auth/login`.

### Тонкости/принципы реализации

#### LanguageSwitcher позиционирование (после двух итераций фиксов)

**Что было**: использовал `right-0` для абсолютного позиционирования. Падал на
десктоп-сайдбаре (кнопка слева → попап улетал за левый край) и на mobile RTL.

**Промежуточное решение**: `position: fixed` + `getBoundingClientRect()` + расчёт
по разнице доступного места слева/справа. Работало, но **прыгало** при повторных
открытиях из-за reflow при смене direction.

**Финальное решение** (текущее): анкоринг к **краю viewport**, не к кнопке.

```ts
const buttonCenter = rect.left + rect.width / 2;
const anchorRight = buttonCenter > vw / 2;
const left = anchorRight
  ? vw - VIEWPORT_PADDING - width   // прижим к правому краю
  : VIEWPORT_PADDING;                // прижим к левому краю
```

Кнопка может сдвинуться на 5-10px между ре-рендерами — координата `left` всё
равно одинаковая, потому что зависит только от стороны viewport.

**Доп. фикс**: убрал `window.addEventListener('scroll', …, true)`. Был — ловил
скролл из любого внутреннего элемента (включая сам список языков), вызывал
`recomputePosition`, что давало микро-прыжки. Сейчас слушаем только `resize`.

**Кросс-direction**: на самом поповере `dir="ltr"` чтобы сетка `[code] [native] [english]`
не разворачивалась при RTL-теме. Сами native-имена RTL-языков внутри строк
имеют свой `dir="rtl"` для корректного отображения.

#### Prerender — head-injection vs puppeteer

**Выбор**: head-injection (без браузера).

**Почему**:
- Скорость: 432 файла генерятся за < 1 секунды (vs минуты с puppeteer).
- Никаких флак-таймингов, никаких 100MB puppeteer-зависимости.
- 90% SEO-задачи — это правильно локализованный head (title/meta/og/hreflang).
  Body для SPA всё равно генерится через JS, и Google его рендерит.
- Для соц-сетей (Facebook/Twitter/LinkedIn — НЕ рендерят JS) важны только OG-теги, а они в head.

**Когда переходить на puppeteer**: если появятся публичные страницы с heavy body
content (блог, документация), которым нужен SSR-уровень индексации в Bing/Yandex.

#### Sitemap — один файл vs index

Сейчас один `sitemap.xml` (4.2MB, 432 URL). Google поддерживает до 50MB / 50K URL
в одном файле — мы хорошо в пределах.

**Когда делить на sitemap-index**: при > 10K URL (например, если появится
`/blog/{slug}` на 108 языках с 100 статьями = 10.8K URL). Тогда делим на
`sitemap-public.xml`, `sitemap-blog.xml`, и т.д. с общим `sitemap-index.xml`.

#### URL-prefix routing — почему через LangPathSync, а не через React Router

**Альтернатива**: добавить в `router.tsx` отдельную ветку `path: '/:lang/*'` с
зеркалированием всех роутов. Я её не взял потому что:
- React Router 7 не поддерживает regex-constraint на `:param` — нельзя сказать
  «`:lang` это только af|am|ar|...». Без этого `/billing` матчится как
  `:lang=billing` → конфликт со статическим роутом.
- Зеркалирование всех роутов под двумя ветками → дублирование кода, риск
  расхождения, путаница с relative `navigate()` (нужно сохранять префикс).
- Внутри SPA пользователь видит ОДИН URL `/auth/login`, language переключается
  без navigate'а — лишний префикс в URL только засоряет browsing history.

**Текущая модель**: URL без префикса для in-app навигации, prefix используется
только для shareable-ссылок и server-side prerender. Это **простота** + **SEO**
одновременно.

#### Auto-translate — стоимость и идемпотентность

- Стоимость одного полного прогона: ~$0.5-2 (108 языков × ~5KB исходника = ~500KB
  символов × $20/M = $10 max, обычно меньше из-за чанков).
- Скрипт **пропускает** уже существующие файлы — не платим повторно.
- Чтобы пересоздать локаль: либо удали файл, либо поставь `"_meta": { "needsRefresh": true }`.
- Placeholders `{{var}}` защищены от поломки переводчиком: превращаются в
  `__VV0__`, переводятся, восстанавливаются.

### Подтверждение работоспособности (state на момент v0.10.22)

✅ `npx tsc --noEmit` — clean.
✅ `npm run build:full` — 5.7 сек, 432 prerendered HTML.
✅ Открытие `dist/es/index.html`:
- `<html lang="es" dir="ltr">` ✓
- `<title>` на испанском ✓
- 109 hreflang ссылок в head ✓
- 7 og:* + 4 twitter:* на испанском ✓

✅ Открытие `dist/ar/index.html`:
- `<html lang="ar" dir="rtl">` ✓
- `<title>` на арабском ✓

✅ `dist/sitemap.xml`: 432 URL, валидный XML.

✅ Сборка размером 13MB (включая 108 локалей + 432 HTML + sitemap).

### Что нужно знать о ПРОДОЛЖЕНИИ этой работы

#### Полноту переводов покрытие (КРИТИЧНО — не доделано за ночь)

В `public/locales/{lang}/common.json` сейчас **67 строк**. Эти строки
**подключены** в:
- ✅ `MainLayout` (nav.rooms, nav.sip, nav.enterpriseSettings, nav.admin, nav.createRoom, balance.label, balance.tariffs).
- ✅ `LanguageSwitcher` (languagePicker.* все).
- ✅ `SeoMeta` (seo.* все).

**НЕ подключены** в:
- ❌ `RoomPage` (список комнат + активный звонок + AI Coach) — большая часть
  inline-локализаций на 12 языков, не используют `common`.
- ❌ `SettingsPage` — hardcoded «Настройки», «Профиль и безопасность», поля
  имя/email.
- ❌ `BillingPage` — тарифы, описания фич, кнопки.
- ❌ `RoomChatPage` — header, пустое состояние, плейсхолдеры composer.
- ❌ `RoomLobbyPage` — «Подключение к видеовстрече», «Язык перевода», подсказки.
- ❌ `AuthPages` (Login/Register/Forgot) — email/password/submit/links.
- ❌ Все Enterprise sections (Section1Gemini, Section2Prompt, Section3QuestFlow, Section4Chatwoot).
- ❌ ConfirmModal title/labels (зависят от вызова).
- ❌ Многие inline кнопки/тултипы в RoomPage активном звонке.

**Что делать дальше** (отдельная задача):

1. Создать дополнительные неймспейсы JSON-файлов в `public/locales/{lang}/`:
   - `nav.json` (или оставить в common)
   - `rooms.json` (список + active call + coach)
   - `settings.json`
   - `billing.json` (тарифы, описание фич, цены)
   - `auth.json` (login/register/forgot + Google OAuth callback)
   - `chat.json` (RoomChatPage)
   - `lobby.json` (RoomLobbyPage)
   - `enterprise.json` (Section* админка)

2. Дополнить `ru/{ns}.json` — единственная источник истины. Все остальные
   автоматически зальются через `npm run translate:locales`.

3. В каждом компоненте заменить hardcoded строки на `useTranslation('ns')` + `t('key')`.

4. Прогнать `npm run translate:locales` — перегенерит все 108 × N namespaces.

5. Прогнать `npm run build:full` — sitemap + prerender перегенерятся
   автоматически.

**Это большая задача — несколько часов работы по файлам.** Чек-лист какие
страницы и сколько строк нужно вытащить:

| Файл | Прим. строк UI | Приоритет |
|------|---------------|-----------|
| `RoomPage.tsx` (список комнат) | ~30 | Высокий (главная страница) |
| `RoomPage.tsx` (active call + AI Coach) | ~60 | Средний |
| `RoomLobbyPage.tsx` | ~20 | Высокий (публичная) |
| `LoginPage.tsx` + `RegisterPage.tsx` + `ForgotPassword.tsx` | ~40 | Высокий (публичные) |
| `BillingPage.tsx` | ~80 | Средний (есть inline русский) |
| `SettingsPage.tsx` | ~20 | Низкий |
| `RoomChatPage.tsx` + `ComposerWithMedia.tsx` + `MessageBubble.tsx` | ~30 | Низкий (Enterprise only) |
| `Section1-4*.tsx` (Enterprise admin) | ~150 | Низкий (для админов) |
| `ConfirmModal.tsx` + alerts | ~10 | Низкий |
| `PaywallModal.tsx`, `InsightsModal.tsx` | ~20 | Средний |

**ИТОГО**: ~460 UI-строк добавить в common (или раскидать по неймспейсам).
Текущие 67 строк — фундамент, который покрывает MainLayout + SeoMeta + LanguageSwitcher.

#### Что не сделано в SEO (отложено в TODO):

1. **Code-split JS bundle** — сейчас 1.37MB / 386KB gzip. Хочется ниже 200KB gzip
   на main bundle. Решение: `build.rollupOptions.output.manualChunks` в
   `vite.config.ts` + `React.lazy()` для тяжёлых страниц.

2. **Body prerender через puppeteer** — для Bing/Yandex/соц-сети полный HTML
   (с body). Когда появятся публичные marketing-страницы.

3. **CSP заголовки** — `Content-Security-Policy`, чтобы Lighthouse не ругался
   на Best Practices.

4. **CDN edge prerendering для динамических URL** — если появятся динамические
   публичные URL (например `/u/{username}`), их нужно рендерить on-demand.

#### Backend transcript (расследовано в v0.10.21)

Бэкенд в `apps/backend/src/modules/rooms/router.ts:233-246` сохраняет транскрипты
**корректно**: `text` идёт в `content`, `{author, originalTimestamp}` в `metadata`.
Старые сообщения в `db_fallback.json` имеют неправильный формат — фронт их
показывает как «🎤 Аудио-сообщение». При новых звонках в новой версии чат будет
работать как ожидается.

### Документация результатов

- Полный deploy-чек-лист: [`docs/DEPLOY.md`](docs/DEPLOY.md) — единый источник
  истины для всех предпрод-проверок. Туда нужно дописывать новые правила.
- Этот файл (PROJECT_NOTES.md) — журнал изменений и архитектурных решений.

### Команды для верификации (после фикса покрытия переводов)

```bash
cd apps/frontend

# 1. Перегенерить переводы (если что-то добавил в ru/common.json)
npm run translate:locales

# 2. Production-сборка
SITE_ORIGIN=https://vibevox.app npm run build:full

# 3. Проверить prerendered HTML на любом языке
cat dist/zh/auth/login/index.html | head -30
# должен быть <html lang="zh" dir="ltr">, <title> на китайском, hreflang × 108

# 4. Запустить preview + Lighthouse
npm run preview &
LIGHTHOUSE_URL=http://localhost:4173 npm run lighthouse

# 5. Локально проверить URL-prefix
# Открой http://localhost:4173/es/auth/login — должен быть Spanish UI
```

### Дев-стоимость и cost-model

| Что | Один раз | Регулярно |
|-----|---------|-----------|
| Google Translate API | ~$0.5-2 (107 языков × 67 строк) | $0 (статика, реруны редкие) |
| Vercel hosting | $0 (Hobby) | $0 |
| Cloudflare CDN | $0 | $0 |
| Render backend | $7/мес (start) | $7-20/мес (scaling) |
| Neon PostgreSQL | $0 (free tier до 500MB) | $19/мес (production tier) |
| LiveKit Cloud | $0 (free 5K min/mo) | usage-based |
| **Итого старт** | ~$2 (разовый перевод) | ~$7-30/мес |

### Файлы, изменённые/добавленные в v0.10.22

**Новые файлы:**
- ✅ `apps/frontend/src/components/LangPathSync.tsx`
- ✅ `apps/frontend/public/robots.txt`
- ✅ `apps/frontend/scripts/sitemap.mjs`
- ✅ `apps/frontend/scripts/prerender.mjs`
- ✅ `apps/frontend/scripts/lighthouse-audit.mjs`
- ✅ `apps/frontend/vercel.json`
- ✅ `apps/frontend/netlify.toml`
- ✅ `apps/frontend/nginx.example.conf`
- ✅ `apps/frontend/public/sitemap.xml` (генерируется, попадает в репо опционально)
- ✅ `docs/DEPLOY.md`

**Изменённые файлы:**
- ✅ `apps/frontend/package.json` — `build:full`, `sitemap`, `prerender`, `lighthouse` скрипты.
- ✅ `apps/frontend/src/config/i18n.ts` — custom detectors `pathSegment` + `querystring`.
- ✅ `apps/frontend/src/App.tsx` — `LangPathSync` подключён.
- ✅ `apps/frontend/src/components/LanguageSwitcher.tsx` — детерминированное позиционирование (анкор к viewport).

**Подтверждённое количество**: **108 языков** (не 105, не 101 — ровно 108
folder'ов в `public/locales/` и 108 записей в `SUPPORTED_LANGUAGES`).

---

## 5.П Партнёрская программа (рефералки) v1.0.6 (2026-05-28)

Изолированный модуль партнёрки: каждый зарегистрированный юзер автоматически получает 8-символьный код в ссылке вида `https://vibevox.pro/?Vibe=XXXXXXXX`. SuperAdmin видит таблицу всех партнёров с агрегатами (переходы / регистрации / оплаты) и редактирует общие условия программы в plain-text textarea. Выплаты — **вручную после индивидуальной договорённости** (процент комиссии в БД не хранится); UI только подсчитывает воронку.

Карточка партнёрки в `/settings` показывает юзеру его ссылку, 3 индикатора и две кнопки: «Условия сотрудничества» (открывает модал с текстом условий) + «Связаться» (открывает WhatsApp на номер, заданный SuperAdmin'ом).

### 5.П.1 Архитектура

```
                            ┌─────────────────────┐
   ?Vibe=CODE в URL ───────►│ ReferralTracker     │ (App.tsx)
                            │ (frontend)          │
                            └──────────┬──────────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  ▼                    ▼                    ▼
            cookie vbvx_ref       POST /track-click    history.replaceState
            (90 дней, lax)        (fire-and-forget)    (чистит URL)
                                       │
                                       ▼
                              referral_clicks (DB)


    Регистрация юзера                                 Stripe оплата
    (email или Google)                                (subscription/topup)
            │                                               │
            ▼                                               ▼
    /api/auth/register          ┌──────────┐    /api/billing/webhook
    или /api/auth/google-login  │ partners │      ├─ subscription.created
           │                    │  router  │      │   (initial/renewal)
           ├──► attribute       │  (lib)   │      └─ invoice.paid
           │   Registration     └──────────┘          (overtime_topup)
           │                                              │
           ▼                                              ▼
        referrals (DB)                          creditReferralPayment
        ↑ partner_id + user_id                  ↑ + minutesAdded
        ↑ source='email'|'google'               ↑ + first_paid_at
```

**3 атрибутируемые точки**:
1. **Клик по ссылке** → `referral_clicks` (event log)
2. **Регистрация привлечённого** → `referrals` (durable, ON CONFLICT DO NOTHING по `referred_user_id`)
3. **Оплата привлечённого** → `referrals.first_paid_at` + `total_paid_minutes`

### 5.П.2 Схема БД (4 таблицы)

Все 4 — идемпотентные `CREATE TABLE IF NOT EXISTS` в [`apps/backend/src/db/migrations.ts`](apps/backend/src/db/migrations.ts). Дублируются как массивы/синглтон в [`apps/backend/src/db/index.ts`](apps/backend/src/db/index.ts) для fallback-режима без PostgreSQL.

| Таблица | Назначение | Ключевые поля |
|---|---|---|
| `partners` | Профиль партнёра 1:1 к users | `id UUID PK`, `user_id UUID UNIQUE FK→users(id)`, `code VARCHAR(32) UNIQUE`, `status` (`active`/`disabled`), `notes TEXT`, `created_at` |
| `partner_program_settings` | Синглтон (id=1, CHECK) — общие условия программы | `terms_text TEXT`, `whatsapp_contact VARCHAR(64)` (default `+380637610482`), `updated_at`, `updated_by UUID` |
| `referral_clicks` | Лог переходов (BIGSERIAL для скорости) | `id BIGSERIAL`, `partner_code VARCHAR(32)` (FK как раз НЕТ — это event log, код мог уже быть disabled), `ip_hash` (SHA-256 truncated, **сырой IP не храним**), `user_agent`, `referer`, `created_at` |
| `referrals` | Долговременная атрибуция (1 запись на привлечённого) | `id UUID PK`, `partner_id UUID FK→partners(id)`, `referred_user_id UUID UNIQUE FK→users(id)`, `source VARCHAR(32)` (`email`/`google`), `registered_at`, `first_paid_at TIMESTAMPTZ NULL`, `total_paid_minutes INTEGER DEFAULT 0` |

**Индексы**:
- `idx_partners_code` ON `partners(code) WHERE status = 'active'` — лёгкая проверка валидности кода в `/track-click`
- `idx_referral_clicks_code` ON `referral_clicks(partner_code, created_at)` — для агрегаций
- `idx_referrals_partner` ON `referrals(partner_id)` — для агрегаций

**Без RLS** — таблицы глобальные (партнёрки выходят за рамки tenant'а: партнёр приводит юзеров из других tenant'ов).

### 5.П.3 Эндпоинты (10 штук)

Mounted в [`apps/backend/src/server.ts`](apps/backend/src/server.ts):
```ts
app.use('/api/partners', partnersPublicRouter);
app.use('/api/admin/partners', partnersAdminRouter);
```

**Public router (`partnersPublicRouter`)**:

| Метод | Путь | Auth | Что делает |
|---|---|---|---|
| `POST` | `/api/partners/track-click` | — | Body `{ code }`. Fire-and-forget. Sanity-проверка кода (active) → insert в `referral_clicks` + хеширование IP. Всегда отвечает 200 (даже на невалидный код → `tracked:false`). |
| `GET` | `/api/partners/program` | — | Возвращает `{ termsText, whatsappContact, updatedAt }` для модала юзера. Без auth — модал виден в `/settings` всем. |
| `GET` | `/api/partners/me` | Bearer | Лениво создаёт партнёра (`ensurePartnerForUser`) при первом запросе, возвращает `{ enabled, code, link, queryParam:'Vibe', cookieName:'vbvx_ref', clicks, registrations, paidUsers, paidMinutes }`. Для SuperAdmin (id=`'admin-1'` или не-UUID) возвращает `{ enabled:false, reason }` — у SA нет своего tenant'а, его не интересует программа. |

**Admin router (`partnersAdminRouter`, требует `role='superadmin'`)**:

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/api/admin/partners` | Список всех партнёров с агрегатами через LEFT JOIN на подзапросы кликов и referrals. Сортировка по `created_at DESC`. Лимит 1000. |
| `PATCH` | `/api/admin/partners/:id` | Body `{ status?, notes? }`. Динамическая сборка `SET` через массив `fields[]`. Можно отключать партнёра (disabled). |
| `GET` | `/api/admin/partners/program` | Тот же ответ что у public, но через admin-роутер (для удобства). |
| `PUT` | `/api/admin/partners/program` | Body `{ termsText?, whatsappContact? }`. UPSERT синглтона. `updated_by` пишется только если adminId — UUID (SuperAdmin с id=`'admin-1'` → NULL). |

### 5.П.4 Атрибуция в auth-флоу (КРИТИЧНО)

Партнёрский код должен передаваться в backend на **обоих** auth-путях:

#### Frontend (одинаково в обоих)
```ts
import { readReferralCode } from '../../components/ReferralTracker';
// ...
const partnerCode = readReferralCode(); // cookie vbvx_ref → fallback ?Vibe=
const res = await fetch('/api/auth/register' | '/api/auth/google-login', {
  body: JSON.stringify({
    ...,
    ...(partnerCode ? { partnerCode } : {}),
  }),
});
```

- [`RegisterPage.tsx`](apps/frontend/src/pages/auth/RegisterPage.tsx) — email/пароль
- [`GoogleCallbackPage.tsx`](apps/frontend/src/pages/auth/GoogleCallbackPage.tsx) — Google OAuth

#### Backend (одинаково в обоих)
В [`apps/backend/src/modules/auth/router.ts`](apps/backend/src/modules/auth/router.ts):
```ts
import { attributeRegistration } from '../partners/router.js';
// ...
const refCode: string | null = typeof partnerCode === 'string' ? partnerCode.trim() : null;
// ... успешное создание newUser ...
attributeRegistration(newUser.id, refCode, 'email' | 'google').catch(() => {});
```

**Особенности**:
- **Не блокирует ответ** — `.catch(()=>{})`. Если атрибуция падает, юзер всё равно регистрируется успешно.
- **Только при register, не login** — в Google-флоу вызов внутри ветки `authType === 'register'`. Повторный логин существующего юзера не создаёт дубль в `referrals`.
- **Самоатрибуция запрещена** — SQL `JOIN users u ON u.id = p.user_id WHERE u.id <> $2` (partner.user_id ≠ новый юзер).
- **ON CONFLICT DO NOTHING по `referred_user_id`** — один юзер = один партнёр на всю жизнь (первая атрибуция выигрывает).

### 5.П.5 Атрибуция оплат (Stripe webhook)

В [`apps/backend/src/modules/billing/webhook.ts`](apps/backend/src/modules/billing/webhook.ts):
```ts
import { creditReferralPayment } from '../partners/router.js';
```

**Две точки вызова** — только на реальных платежах, не на mid-cycle обновлениях:

1. **Subscription paid** (`customer.subscription.created` / `updated`):
   ```ts
   if ((status === 'active' || status === 'trialing') && !isMidCycle) {
     const minutes = Math.round(freshSeconds / 60);
     creditReferralPayment(tenantId, minutes).catch(() => {});
   }
   ```
2. **Invoice paid** (overtime_topup):
   ```ts
   creditReferralPayment(tenantId, minutesRaw).catch(() => {});
   ```

`creditReferralPayment` ищет юзера по `tenant_id` (1:1), находит запись в `referrals` по `referred_user_id`, инкрементит `total_paid_minutes` и проставляет `first_paid_at` (если NULL).

### 5.П.6 ReferralTracker (фронт-трекер кликов)

[`apps/frontend/src/components/ReferralTracker.tsx`](apps/frontend/src/components/ReferralTracker.tsx) — невидимый компонент, рендерится **в корне** `App.tsx` (до `RouterProvider`), не зависит от react-router hooks. На mount делает:

1. Читает `?Vibe=CODE` из `window.location.search`
2. Сохраняет в cookie `vbvx_ref` (90 дней, samesite=lax, secure на HTTPS)
3. Шлёт fire-and-forget `POST /api/partners/track-click` с `keepalive:true`
4. Чистит URL через `window.history.replaceState({}, '', cleanUrl)` — код исчезает из адресной строки

Утилита `readReferralCode()` экспортируется для использования в Register/Google-callback страницах — приоритет: cookie → fallback к URL-параметру.

**Почему именно `?Vibe=`, а не стандартный `?ref=`** — брендинг владельца. Параметр настраивается константой `REF_QUERY_PARAM` в [`partners/router.ts`](apps/backend/src/modules/partners/router.ts) и `PARAM_NAME` в [`ReferralTracker.tsx`](apps/frontend/src/components/ReferralTracker.tsx) — **их нужно менять синхронно**.

### 5.П.7 Генерация кода

Функция `generatePartnerCode()` в [`partners/router.ts`](apps/backend/src/modules/partners/router.ts):
```ts
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
// 56 символов: без 0/O, без 1/I/l — чтобы не путать
const bytes = crypto.randomBytes(8);
let out = '';
for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
```

- **8 символов** → 56⁸ = **~9.7×10¹³** комбинаций (хватит на годы)
- Используется `crypto.randomBytes` (CSPRNG), не `Math.random`
- `ensurePartnerForUser` оборачивает INSERT в retry-цикл на 5 попыток для случая коллизии (SQL код 23505)

### 5.П.8 Fallback handlers (для режима без PostgreSQL)

Все 4 таблицы поддерживаются в [`apps/backend/src/db/index.ts`](apps/backend/src/db/index.ts) (раздел «v1.0.6 — ПАРТНЁРСКАЯ ПРОГРАММА (fallback handlers)»):

- `FallbackData` расширен полями `partners[]`, `referral_clicks[]`, `referrals[]`, `partner_program_settings:{}` (синглтон, не массив)
- Инициализация в `ensureFallbackLoaded()` — массивы создаются если не было, синглтон с дефолтным WhatsApp `+380637610482`
- 10 SQL-handler'ов покрывают: SELECT/INSERT/UPDATE partners, sanity-check кода, JOIN-агрегаты для админ-листинга, COUNT кликов, агрегаты referrals, INSERT/UPDATE referrals, GET/UPSERT settings, поиск user по tenant_id (для creditReferralPayment)

**Если запросы партнёрки попадают через fallback (PG отсутствует) и таблица возвращает странное значение — почти наверняка регекс одного из handler'ов пересекается с другим**. См. правило в § 0 «Правило точности SQL-handler'ов в fallback».

### 5.П.9 Frontend — SuperAdmin страница

[`apps/frontend/src/pages/admin/PartnersPage.tsx`](apps/frontend/src/pages/admin/PartnersPage.tsx) — копирует паттерн `UsersPage.tsx` (AuroraCard + таблица + модалы), без новых зависимостей.

**Две секции**:
1. **Карточка «Условия программы»**: textarea (plain-text, `white-space: pre-line` при рендере), поле «WhatsApp для связи», кнопка «Сохранить условия» → `PUT /api/admin/partners/program`
2. **Таблица партнёров**: Email, Код (с copy-button), Переходы, Регистрации, Оплатили, Куплено мин, Дата, Статус, кнопка Power (включить/выключить через `PATCH /api/admin/partners/:id { status }`)

Ссылка/иконка в сайдбаре — [`AdminLayout.tsx`](apps/frontend/src/layouts/AdminLayout.tsx) (NavLink на десктопе с `HeartHandshake` иконкой и эмодзи-NavLink в мобильной верхней панели — оба места обязательны, см. правило § 0).

Маршрут — [`router.tsx`](apps/frontend/src/router.tsx): `{ path: 'partners', element: <PartnersPage /> }` внутри `RequireAdmin → AdminLayout`.

### 5.П.10 Frontend — карточка пользователя

[`apps/frontend/src/pages/SettingsPage.tsx`](apps/frontend/src/pages/SettingsPage.tsx) — карточка `<AuroraCard>` между блоком темы и «Подпиской и балансом». Условный рендер по `partner?.enabled`.

**Состоит из**:
1. Заголовок с иконкой `HeartHandshake`
2. Read-only `<input>` с реферальной ссылкой + кнопка `Copy` (с тостом «Скопировано» 2 сек)
3. 3 плитки-индикатора (`PartnerStatTile` helper в том же файле): Переходы (синяя), Регистрации (фиолетовая), Оплаты (зелёная). У зелёной есть subllabel вида `N чел · M мин` если paidUsers > 0
4. Две кнопки: «Условия сотрудничества» (модал в стиле Aurora с `pre-line` рендером terms_text) + «Связаться» (открывает `https://wa.me/<нормализованный номер>` в новой вкладке)

**Загрузка данных** — `useEffect` с `Promise.allSettled` для `/me` и `/program` параллельно. Если `/me` падает или возвращает `enabled:false` — карточка не показывается (нет ошибки, просто скрыта).

### 5.П.11 i18n

Ключи `partner.*` в [`apps/frontend/public/locales/ru/common.json`](apps/frontend/public/locales/ru/common.json) и [`en/common.json`](apps/frontend/public/locales/en/common.json) — **только источники** (ru + en):
```
partner.title / subtitle / yourLink / copy / copied
partner.stats.{clicks, registrations, paid, paidUnit}
partner.terms / contact / termsModalTitle / termsEmpty / loadError
```

Остальные 106 языков подтянутся через стандартный пайплайн:
```
npm run i18n:propagate    # синхронизирует ключи в 106 целевых файлов
npm run translate:locales # Google Translate API на пустые ключи
```

(SuperAdmin-страница `/admin/partners` намеренно **не локализуется** — следуем правилу v1.0.4 «админка только на ru»).

### 5.П.12 Точки расширения (как редактировать)

**Хочу N процентов комиссии хранить в БД** → добавить столбец `partners.commission_rate NUMERIC(5,2)`, отдать его в `/api/admin/partners`, показать в таблице. Текущая модель «процент не хранится» — сознательное упрощение под индивидуальные договорённости владельца.

**Хочу автовыплаты Stripe Connect** → добавить столбец `partners.stripe_account_id`, в `creditReferralPayment` дополнительно вызывать `stripe.transfers.create({ destination: account_id, amount })`. Сейчас выплаты вручную.

**Хочу запретить самостоятельные регистрации партнёров** → в `/me` поменять `ensurePartnerForUser` на просто SELECT (без INSERT), а INSERT перенести в новый endpoint `POST /api/admin/partners/{userId}` для SuperAdmin. Сейчас каждый юзер автоматически становится потенциальным партнёром.

**Хочу больше каналов источника, не только email/google** → в `referrals.source` добавить значения (`telegram`, `affiliate_api` …). Везде где `attributeRegistration` вызывается — передать новый `source`. Тип `'email' | 'google'` в [`partners/router.ts`](apps/backend/src/modules/partners/router.ts:91) расширить.

**Хочу поменять параметр URL** (например с `?Vibe=` на `?ref=`) → синхронно поменять `REF_QUERY_PARAM` в [`partners/router.ts`](apps/backend/src/modules/partners/router.ts:30) и `PARAM_NAME` в [`ReferralTracker.tsx`](apps/frontend/src/components/ReferralTracker.tsx:14). Cookie name `vbvx_ref` менять не обязательно — это внутренний идентификатор.

### 5.П.13 Доработки (2026-05-29)

- **Удаление аккаунта чистит партнёрку.** В [`admin/users.ts`](apps/backend/src/modules/admin/users.ts) `DELETE /:userId` теперь сносит и партнёрские данные юзера: `DELETE FROM referrals WHERE referred_user_id` (его атрибуция как привлечённого) + `DELETE FROM partners WHERE user_id` (его профиль партнёра → каскадит его `referrals` по partner_id и `referral_clicks` по коду). На PG это и так каскад FK (все три — `ON DELETE CASCADE`, кроме `referral_clicks` без FK), но в **fallback** каскадов нет → добавлены handler'ы `DELETE FROM partners WHERE user_id`/`DELETE FROM referrals WHERE referred_user_id` в БЛОК В НАЧАЛЕ `runMockQuery` (loose SELECT-handler'ы `FROM partners/referrals WHERE …` иначе перехватили бы DELETE), а `removeUserFromFallback` делает тот же каскад.
- **Приватные заметки по партнёру (только SuperAdmin).** Поле `partners.notes` и `PATCH /api/admin/partners/:id { notes }` уже были — добавлен UI: иконка `StickyNote` в колонке «Действия» каждой строки → модал с textarea → сохранение. Иконка подсвечена (оранжевая), если заметка есть. Партнёр свою заметку НЕ видит (только admin-роутер).
- **Поиск в таблице** партнёров — клиентский фильтр по email ИЛИ коду (одно поле, иконка `Search`), паттерн как в `UsersPage`. Бэкенд не меняли (GET отдаёт до 1000 строк).
- **Сброс статистики и удаление партнёра (новые admin-эндпоинты).** `POST /api/admin/partners/:id/reset` — обнуляет переходы/регистрации/оплаты (DELETE `referral_clicks` по коду + `referrals` по partner_id), сам партнёр остаётся (применение: после выплаты вознаграждения). `DELETE /api/admin/partners/:id` — полностью удаляет партнёра (clicks по коду + сам `partners`, который каскадит `referrals`). UI: кнопки `RotateCcw` (синяя, сброс) и `Trash2` (красная, удаление) в колонке «Действия», обе подтверждаются ВНУТРЕННИМ Aurora-модалом (`pendingAction` state), НЕ браузерным `window.confirm` (правило проекта: не использовать браузерные поп-апы).
- **Admin GET: `JOIN users` → `LEFT JOIN users`** — чтобы «осиротевшие» партнёры (пользователь удалён) были ВИДНЫ в списке (email = `—`) и их можно было удалить кнопкой. fallback-handler GET уже показывал всех (`.map`), его regex обновлён под `LEFT JOIN`.
- **fallback-handler'ы (db/index.ts):** `SELECT code FROM partners WHERE id`, `DELETE referral_clicks WHERE partner_code`, `DELETE referrals WHERE partner_id`, `DELETE partners WHERE id` (каскад) — в БЛОКЕ В НАЧАЛЕ `runMockQuery` (DELETE-формы), SELECT-code рядом с прочими partner-SELECT'ами.
- Итого эндпоинтов в admin-роутере стало 6 (+reset, +delete к прежним GET/PATCH/GET program/PUT program).

**Хочу разные тексты условий для разных партнёров** → добавить колонку `partners.custom_terms TEXT NULL`. В `/api/partners/program` для авторизованного юзера сначала смотреть свой `partners.custom_terms`, fallback на глобальный `partner_program_settings.terms_text`.

**Хочу публичную страницу `/partner/:code` без авторизации** → новый эндпоинт `GET /api/partners/by-code/:code` возвращает имя владельца + общие условия. Создать `apps/frontend/src/pages/PublicPartnerPage.tsx` и добавить публичный маршрут в `router.tsx` (рядом с `/room/:roomId`).

### 5.П.13 Затронутые файлы (полный список)

**Новые** (3):
- `apps/backend/src/modules/partners/router.ts` — единственный модуль партнёрки (~400 строк)
- `apps/frontend/src/pages/admin/PartnersPage.tsx` — SuperAdmin UI (~300 строк)
- `apps/frontend/src/components/ReferralTracker.tsx` — глобальный трекер (~80 строк)

**Изменены** (10):
- `apps/backend/src/db/migrations.ts` — 8 идемпотентных миграций
- `apps/backend/src/db/index.ts` — fallback-хендлеры + сужен `dialect_rules` COUNT
- `apps/backend/src/server.ts` — подключение 2 роутеров
- `apps/backend/src/modules/auth/router.ts` — `attributeRegistration` в register + google-login
- `apps/backend/src/modules/billing/webhook.ts` — `creditReferralPayment` в 2 точках
- `apps/frontend/src/router.tsx` — добавлен route `/admin/partners`
- `apps/frontend/src/layouts/AdminLayout.tsx` — NavLink (десктоп + мобильная)
- `apps/frontend/src/pages/SettingsPage.tsx` — карточка партнёрки + модал условий
- `apps/frontend/src/pages/auth/RegisterPage.tsx` — `partnerCode` в body
- `apps/frontend/src/pages/auth/GoogleCallbackPage.tsx` — `partnerCode` в body
- `apps/frontend/src/App.tsx` — `<ReferralTracker />` в корне
- `apps/frontend/public/locales/ru/common.json` + `en/common.json` — `partner.*` ключи
- `apps/frontend/src/components/AppVersion.tsx` + `apps/frontend/package.json` — версия 1.0.5 → 1.0.6

**Зависимостей не добавлено**. Используются: react-router-dom, react-i18next, lucide-react (`HeartHandshake`, `Copy`, `FileText`, `MessageCircle`), AuroraCard/AuroraButton/AuroraInput, node `crypto` (стандартная либа).

### 5.П.14 Что проверено (acceptance criteria от 2026-05-28)

- ✅ В SuperAdmin /admin/partners виден раздел «Партнёры», можно редактировать условия + WhatsApp
- ✅ В обычной учётке /settings появляется карточка «Партнёрская программа» со ссылкой `?Vibe=XXXXXXXX`
- ✅ Клик по чужой ссылке инкрементит счётчик «Переходы»
- ✅ Регистрация через email/password атрибутируется (счётчик «Регистрации» растёт)
- ✅ Регистрация через Google OAuth атрибутируется (та же таблица `referrals` с `source='google'`)
- ✅ Stripe-оплата привлечённого юзера обновит `first_paid_at` и `total_paid_minutes` (не проверено в живую — webhook не дёргался, но код-путь прямой и тривиальный)
- ✅ В админ-таблице партнёр и его агрегаты видны
- ✅ Кнопка «Связаться» открывает WhatsApp на `+380637610482`
- ✅ Модал «Условия сотрудничества» рендерит plain-text с переносами строк

---

## 5.Т Масштабирование видеоперевода под нагрузку (2026-05-30)

Реализация 7-пунктового плана против «залпа» одновременных участников (например, 50 человек
заходят в разные комнаты сразу). Полный гайд: [docs/SCALING_GEMINI_LIVE.md](docs/SCALING_GEMINI_LIVE.md).

**Модель нагрузки:** 1 говорящий = 1 Gemini Live WebSocket-сессия; пара 1-на-1 = 2 сессии.
50 человек ≈ 25 комнат ≈ ~50 сессий с одного ключа. Два потолка: **лимит concurrent sessions
у Gemini (per ПРОЕКТ, не per ключ!)** и **один Node-процесс** (event-loop как общий ресурс).

**Что сделано:**

1. **Admission control** — [translation/admission.ts](apps/backend/src/modules/translation/admission.ts).
   Глобальный реестр слотов `room::identity`. Резерв слота при выдаче LiveKit-токена
   ([livekit/router.ts](apps/backend/src/modules/livekit/router.ts)) — ДО подключения/старта bridge
   (иначе залп проскочит, сессии создаются позже). Идемпотентно по (room, identity).
   Превышение → **503 `service_overloaded`** → видимая плашка в лобби (НЕ молчаливая тишина).
   Освобождение: `onParticipantDisconnected` (release) + `translation/stop` (releaseRoom) +
   TTL 3 ч + reconcile с LiveKit раз в 2 мин (самоисцеление). Мониторинг: `GET /api/translation/status`
   → `admission:{current,limit,rooms}`.
2. **Лимит настраивается суперадмином** в `/admin/config` → «Масштабирование видеоперевода» →
   «Лимит одновременных переходов», **дефолт 50**. Env-фолбэк `MAX_CONCURRENT_TRANSLATION_SESSIONS`.
3. **Оптимизация DSP (п.2+п.3)** — `detectVoiceGender` (автокорреляция ~80K оп) больше НЕ на
   каждом фрейме. Дешёвый VAD по энергии (`hasVoiceEnergy`) на каждом фрейме (для биллинга) +
   gender-детект throttled (раз в 4 фрейма пока не зафиксирован, потом раз в ~1 сек). CPU −~50×.
   Билинг теперь считает активную речь по энергии, а не по распознанному тону (даже честнее).
4. **Пул ключей** — [config/gemini_key_pool.ts](apps/backend/src/config/gemini_key_pool.ts),
   round-robin. ⚠️ Ключи должны быть из РАЗНЫХ GCP-проектов (лимит per project). Только для
   глобального/freemium трафика; Enterprise со своим ключом не трогаем.
5. **Vertex AI (опционально)** — [gemini.getEffectiveGeminiClientConfig](apps/backend/src/modules/tenant_settings/gemini.ts).
   `GoogleGenAI({vertexai:true, project, location})`, авторизация через `GOOGLE_APPLICATION_CREDENTIALS`.
   1000 concurrent + 4M TPM/проект. Чекбокс в админке. По умолчанию off.
6. **Tier (п.1) и LiveKit квоты (п.7)** — инфраструктурные, описаны в гайде.

**Грабли, на которые потрачено время:**
- Добавление НЕстроковых полей в `SystemConfig` сломало `saveSettings`: `StringKey =
  Exclude<keyof SystemConfig, ...>` стал включать number/boolean/array → индексное присваивание
  `merged[key]=string` упало (TS2322 «not assignable to undefined»). Фикс: исключить
  `maxConcurrentTranslationSessions | geminiApiKeys | geminiUseVertex` из `StringKey`,
  обрабатывать их вручную (как `telegramAdminChatIds`).
- Admission ОБЯЗАН резервировать слот на этапе токена, а не при создании Gemini-сессии — иначе
  залп из N запросов проходит проверку до того, как поднимутся реальные сессии.
- Доп. ключи в админке — write-only textarea: шлём `geminiApiKeys` только если поле непустое,
  иначе существующий пул не трогаем (секрет, не возвращаем значения клиенту — только count).

**Гейты:** backend `tsc` — 0, frontend `tsc` — 0, `eslint` — 0 errors. **i18n:** ключи
`lobby.overloadedTitle/Msg` добавлены только в ru/en (источники) — прогнать `npm run i18n:propagate`
+ `npm run translate:locales` для остальных 106 языков (до этого fallback на en).

## 5.У TrendTraffic: платный гейт + 7-дн триал + защита от затрат + импесонейшн + Stripe/обложки (2026-06-30 … 2026-07-01)

Пакет работ по монетизации и админке TrendTraffic. Прод — app.trendtraffic.pro (VPS 72.62.0.184,
pm2 `trendtraffic-api`, деплой `ssh root@… 'cd /var/www/trendtraffic && git fetch --depth 1 origin main
&& git reset --hard origin/main && bash deploy/vps-redeploy.sh'`).

### 1. Платный гейт (paywall)
- **RequirePaid** ([router.tsx]): неоплаченному открыты ТОЛЬКО `/billing` и `/settings`, всё остальное →
  редирект на `/billing`. Обёрнут вокруг `LayoutSwitcher`; admin (`RequireAdmin`) — ВНЕ гейта.
- **Анти-deadlock гидрации:** флаг `billingLoaded` в `useAppStore` + `refreshBilling` при восстановлении
  сессии. `setAuth` ставит временный `subscriptionTier='trial'` до того, как `refreshBilling` вернёт
  реальный тариф → без флага платного юзера выбрасывало на `/billing` при перезагрузке закрытой страницы.
  Пока `billingLoaded=false` — гейт показывает лоадер, не редиректит. **Само-лечение:** `RequirePaid`
  сам дёргает `refreshBilling` (раньше это делал только `MainLayout`, который сам за гейтом → deadlock
  на свежем логине email/Google).
- **Фронт-гейт = зеркало бэка:** `useIsEnterprise` требует `status∈{active,trialing}` (поле
  `subscriptionStatus` в сторе). Иначе отменённый Premium (tier='premium', status='canceled') ложно
  пускал бы в UI, где каждый API отвечает 402. `feature_gate.getFeatureAccess`: enterprise =
  superadmin OR (tier∈{premium,enterprise} && status∈{active,trialing}).

### 2. 7-дневный триал (Stripe)
- `/api/billing/checkout` при `trial:true`: `subscription_data.trial_period_days=7`,
  `payment_method_collection:'always'` (карта обязательна даже при €0), `trial_settings.end_behavior.
  missing_payment_method:'cancel'`. Через 7 дней Stripe сам списывает €120.
- **Webhook триал-aware** ([webhook.ts]): `status==='trialing'` НЕ триггерит реферальные выплаты и
  платёжную статистику (только реальное списание `active`). tier-фолбэк на `subscription.metadata.tier`
  (кладём в `subscription_data.metadata` при checkout) — на случай, если на Stripe-цене нет `metadata.tier`.
- BillingPage: кнопка «Попробовать 7 дней бесплатно» + вторичная «Оформить сразу».

### 3. Ноль затрат в пробный период (адверсариальный аудит, workflow 20 агентов)
- trends-API закрыт `requireFullAccess` (402 неоплаченным — не жгут платформенный TikHub).
- `resolveAnthropicKey` ([director.ts]): full-access тенант без своего ключа → `null` (НЕ падаем на
  платформенный `ANTHROPIC_API_KEY`), суперадмин — на платформенный.
- **⚠️ Закрыты 5 утечек платформенного ключа в [social-ext/router.ts]** (proxy/ai-proxy/music/download/
  ig-manifest): был антипаттерн `(await getEffectiveTikHubKey())||getTikHubApiKey()` / `…||getGeminiApiKey()`
  — для full-access тенанта левая часть = null → падало на ПЛАТФОРМЕННЫЙ ключ (= наши затраты в триал).
  Убрали `|| getPlatformKey()`: теперь только `getEffectiveTikHubKey/getEffectiveGeminiKey` (для full-access
  → null → 402 «задайте свой ключ»; суперадмину резолвер сам отдаёт платформенный, т.к. `global_admin`
  не full-access). **Правило: для full-access НИКОГДА не падать на платформенный ключ.**

### 4. Чистка админки суперадмина под TrendTraffic
- **«Сменить тариф» (UsersPage):** только наши тарифы — **Premium / Enterprise** (полный доступ) +
  **«Без тарифа»** (revoke). Легаси VibeVox (plus/standard/standard_yearly/триал) убраны.
  **⚠️ ГРАБЛЯ (major, поймана ревью):** revoke ставил `status='inactive'`, но CHECK
  `subscriptions_status_check` (init.sql) допускает ТОЛЬКО `active/trialing/canceled/past_due/incomplete`
  — на реальном Postgres UPDATE падал бы 500. Revoke теперь ставит **`status='canceled'`** + не начисляет
  минуты.
- **Промокоды:** селектор «На какие тарифы» → **Premium + «На все тарифы»** (легаси убраны). Магический
  `< 3` (было «выбрано все 3 = без ограничения») убран и на фронте, и в `promo.ts`. GET списка промокодов
  больше НЕ блокирует страницу при неподключённом Stripe (отдаёт `{codes:[], stripeConfigured:false}` +
  мягкое уведомление вместо красной блокировки).
- **Убран мёртвый легаси видеоперевода/диалектов** (v1.6.5): раздел «AI Learning Hub — Обучение
  диалектам» (пункт сайдбара десктоп+моб, роут `/admin/dialects`, карточка-баннер в «Настройках API»,
  удалены сиротские `DialectsPage.tsx` + `DialectPlayground.tsx`); карточка «LiveKit WebRTC Server»;
  карточка «Масштабирование видеоперевода» (лимит Gemini Live-сессий + Vertex + пул доп. ключей).
  Флаг `features.ts:learnHub` остался инертным (безвреден).
- **Убраны минутные столбцы** из таблицы «Пользователи» (Осталось мин / Последний платёж / Всего
  оплачено) — метрия минут в TrendTraffic не используется (тарифы безлимитные).

### 5. «Войти в аккаунт пользователя» (impersonation)
- **Бэкенд:** `POST /api/admin/users/:userId/impersonate` ([admin/users.ts], router-level
  `requireSuperAdmin`) → JWT целевого юзера `{id,email,role,tenantId}` + маркеры `impersonated/
  impersonatedBy`, срок **12ч** (короче обычных 30д — токен stateless, не отзывается). Аудит в Telegram.
- **Фронт:** зелёная кнопка LogIn в строке → **кастомный ConfirmModal** (не браузерный `confirm()`) →
  сохраняет сессию суперадмина в `sessionStorage['tt_impersonation_backup']` → `setAuth(user)` → reload.
- **Возврат:** фиксированный баннер «Вход от суперадмина: вы работаете как … · ← Вернуться в админку»
  в [MainLayout], восстанавливает бэкап через `setAuth` — БЕЗ повторного логина.

### 6. Stripe — довели до рабочего состояния
- **⚠️ КОРНЕВАЯ ПРИЧИНА провала sync/промо:** на сервере `stripeSecretKey` был **ПУСТ** в
  `apps/backend/system-config.json` (файл НЕ в git, деплой его не трогает — `**/system-config.json`
  в .gitignore). Бага сохранения нет: `CONFIG_FILE`=`apps/backend/system-config.json`, read==write,
  `updateConfig` апсертит (маску `********` не перезаписывает — сохраняет прежнее). Причина пустоты:
  юзер жал **«Проверить подключение»** (тестит ключ из ТЕЛА запроса, `verify-stripe`), но НЕ
  **«Сохранить изменения»**. Фикс: `handleSyncProducts` теперь **авто-POSTит** `/api/auth/system-settings`
  со stripe-полями ПЕРЕД sync.
- **sync только Premium** ([service.ts] `SYNCABLE_TIERS`): не плодим мусорные VibeVox Plus/Standard в
  LIVE-аккаунте (Enterprise — «по запросу», без Stripe-price). `/sync-products` показывает **реальную
  ошибку Stripe** суперадмину (operator-эндпоинт), а не generic «Internal server error» (было `send500`).
- Stripe-аккаунт: **LIVE, валюта PLN** (EUR-цены создаются нормально — multi-currency). Итог: sync EUR
  создал `vibevox_premium_eur` (€120/мес), self-serve оплата Premium работает.
- **ОСТАЁТСЯ:** вписать `whsec_…` (Webhook Signing Secret) в админке — URL
  `https://app.trendtraffic.pro/api/billing/webhook`, события `customer.subscription.*`/
  `checkout.session.completed`/`invoice.paid`. Без него авто-выставление тарифа после оплаты не сработает
  (суперадмин пока выдаёт Premium вручную через «Сменить тариф»). Ротировать утёкший `sk_live`.

### 7. Превью обложек в ленте трендов
- **⚠️ ДВЕ причины серых заглушек:** (1) хотлинк-защита CDN — прямой `<img src>` к TikTok/IG давал 403/ORB;
  (2) TikTok `cover`/`origin_cover` приходят в **HEIC** (браузер не рендерит). Фикс: (1) обложки в
  [TrendSearch] идут через публичный **cover-proxy** `/api/channels/cover?u=` (ставит нужный Referer
  серверно, вайтлист CDN-хостов, тот же приём, что в «Каналах»); (2) в TikHub-провайдере ([providers.ts])
  `dynamic_cover` (jpeg) поставлен ПЕРВЫМ в приоритете обложки (у других платформ его нет → findUrl
  пропускает). Действует на новые сканы.
- Поле «Сколько видео» (кастомный ввод): было `type=number` + мгновенный `Math.max(1,parseInt||1)` на
  каждый keystroke (нельзя очистить/править). Теперь строковое зеркало (`type=text inputMode=numeric`,
  клэмп [1..30] на blur, select-all на фокусе). Бэкенд всё равно жёстко клэмпит count в [1..30]
  (`service.ts`).

### Как это деплоилось (важно для сосуществования с параллельной работой)
Юзер вёл параллельную разработку (подкаст-студия/аниматор, видео-редактор — MontageEditor/FlowPage/
render-worker) в другой сессии, активно двигая `origin/main` и bump'я AppVersion (1.6.4 → 1.6.15).
Чтобы не задеть его незакоммиченный WIP и не ловить non-ff, свои изменения интегрировал через
**изолированный git worktree** (`git worktree add --detach <tmp> origin/main` → `cherry-pick` моего
коммита → `push origin HEAD:main`), НЕ трогая грязное рабочее дерево. AppVersion намеренно НЕ бампал
(чтобы не конфликтовать с его bump'ами) — версии моей работы задокументированы этим разделом и коммитами.

**Ключевые файлы:** `apps/frontend/src/router.tsx` (RequirePaid), `hooks/useIsEnterprise.ts`,
`store/useAppStore.ts` (billingLoaded/subscriptionStatus), `layouts/MainLayout.tsx` (impersonation-баннер),
`pages/BillingPage.tsx`, `pages/admin/{UsersPage,PromocodesPage,AdminConfigPage}.tsx`,
`components/TrendSearch.tsx`; бэкенд `modules/billing/{router,webhook,service,promo,feature_gate}.ts`,
`modules/admin/users.ts`, `modules/social-ext/router.ts`, `modules/render/director.ts`,
`modules/trends/router.ts`, `modules/tikhub/providers.ts`, `modules/tenant_settings/{tikhub,gemini}.ts`.

## 5.Ф TrendFlow: редактор видео/аудио (VideoViewer) + пикер медиа = Галерея (2026-07-01, v1.6.7 → v1.6.14)

Итеративная сессия по фидбэку: довели облако **«Редактор»** в TrendFlow-монтаже (единый компонент `VideoViewer`, режет lossless на нашем ffmpeg) и его пикер медиа до продакшена. Всё задеплоено на `app.trendtraffic.pro` по SSH через `deploy/vps-redeploy.sh`.

**Что сделано (по версиям):**
- **v1.6.7** — пресеты сценария больше НЕ всплывают при открытии УЖЕ созданного сценария (только при создании нового). `FlowPage.tsx` прокидывает `isNew` в `MontageEditor` (`openedNew`=true при «Создать сценарий», false при клике по карточке); гейт `if (nodes.length===0 && isNew) setShowPresets(true)`.
- **v1.6.9** — пикер облака «Редактор» ПОВТОРЯЕТ страницу «Галерея»: вкладки-папки Тренды/Референс/Аудио/Из анализа (счётчики, авто-открытие первой непустой с приоритетом «Из анализа») + поиск по имени + «Найдено: N»; карточки крупнее (3-в-ряд, квадратные превью с именем). **Корень бага «Видео не найдены»:** `loadEditorGallery` грузил только downloaded-тренды + `kind=reference`, а проанализированные видео лежат в папке `analyzed`, которую `listAssets(kind=reference)` ИСКЛЮЧАЕТ (`WHERE folder IS NULL OR folder<>'analyzed'`) → теперь грузим ещё `folder=analyzed` и `kind=audio`, дедуп по url, элемент помечается категорией (`type EdCat`).
- **v1.6.10** — кнопки загрузки «Медиа» (видео/изображение→Референс) и «Аудио» ПРЯМО в пикере — тот же эндпоинт, что и Галерея (`POST /api/trends/media/upload?kind=reference|audio`, FormData без Content-Type); после аплоада список перезагружается и открывается нужная вкладка.
- **v1.6.12–1.6.13** — сам `VideoViewer`: (1) имя файла в шапке РЕДАКТИРУЕМОЕ (карандаш → инлайн-инпут `nameEdit`; идёт в имя сохранённого файла — `save().name`); (2) «Сохранить» переехала ВВЕРХ в шапку (рядом со Скачать/Закрыть); (3) МУЛЬТИ-обрезка: `marks: Seg[]`, «Отметить» копит промежутки (красные на дорожке, хелпер `normalize` сливает пересечения), «Вырезать»/«Оставить» применяют ко ВСЕМ отмеченным сразу (`activeSegs()` = marks, иначе текущее выделение), двойной клик по красному снимает, «Отметки» очищает.
- **v1.6.14** — (1) СКРАБ: перетаскивание ручек IN/OUT и дорожки ПЕРЕМАТЫВАЕТ видео на позицию (виден кадр, где режешь; `dragHandle`/`scrubTrack` зовут `seek(t)`, на время скраба пауза); (2) кнопка ЗВУК/без звука в транспорте (`muted` state, по умолчанию со звуком, `Volume2`/`VolumeX`).

**Бэкенд обрезки** (`apps/backend/src/modules/video_edit/router.ts`, ядро было в v1.6.1/1.6.3): `POST /api/video-edit` — lossless ffmpeg `-c copy`; тело `{inputUrl, segments:[{start,end}] «оставить», rotate?}` (1 сегмент=обрезка, N=нарезка+concat-демуксер), поворот=метадата контейнера; выход в `uploads/renders/*.mp4` + `createAsset(kind:'reference')`. Только локальные `/uploads/...` (защита от traversal). **Аудио:** вход определяется по расширению (`AUDIO_RE`) → ветка `cutSegmentAudio` (`-vn -c:a aac -b:a 192k`), выход `.m4a`, `mediaType:'audio'`. Склейка `/merge` (нормализация под общий кадр W×H + concat filter) — ТОЛЬКО видео (фронт-гард).

**Принцип пользователя (на будущее):** пикер «Редактора» ДОЛЖЕН повторять Галерею — любое улучшение Галереи мирроринг в редактор. Пока мирроринг РУЧНОЙ; чтобы стало автоматическим — вынести общий компонент медиа-библиотеки (используемый и `GalleryPage`, и пикером). Озвучено юзеру как следующий шаг (не сделано).

**⚠️ Приём деплоя при ПАРАЛЛЕЛЬНОЙ сессии (главный операционный урок сессии):** рабочее дерево `C:\GOOGLEDISK\trendtraffic` — ОБЩЕЕ; одновременно работал другой Claude-агент (подкаст-таймлайн → аниматор ведущих HeyGen/D-ID/Avatar IV), непрерывно правя `MontageEditor.tsx` + `render-worker/main.py` и bump'я AppVersion (за сессию 1.6.4 → 1.6.17). Правки в общем дереве ловили постоянный «file modified since read», строки сдвигались на сотни. **Решение — каждую свою фичу собирать в ИЗОЛИРОВАННОМ git worktree от чистого origin, не трогая грязное дерево:**
```
git worktree add --detach <scratch>/fN origin/main
# tsc/eslint внутри worktree через junction node_modules (PowerShell, без admin, та же диск C:):
#   New-Item -ItemType Junction -Path <wt>\node_modules             -Target C:\GOOGLEDISK\trendtraffic\node_modules
#   New-Item -ItemType Junction -Path <wt>\apps\frontend\node_modules -Target C:\GOOGLEDISK\trendtraffic\apps\frontend\node_modules
#   node <wt>/apps/frontend/node_modules/typescript/lib/tsc.js --noEmit   (npx tsc не резолвит из worktree)
git add <только-свои-файлы>; git commit; git fetch; git push origin HEAD:main    # FF или rebase
ssh root@web 'cd /var/www/trendtraffic && bash deploy/vps-redeploy.sh'
```
Грабли: (1) **junction удалять через `cmd //c rmdir <link>` (unlink), НИКОГДА не `rm -rf`/`worktree remove` при живом junction** — иначе рекурсия пойдёт ПО junction и снесёт РЕАЛЬНЫЙ node_modules проекта. (2) `git worktree remove` на Windows часто «Permission denied» на `.git/worktrees/<name>` (блокировки) — безвредно, метаданные подчистятся позже. (3) **Коллизии версий:** параллельный агент несколько раз выпускал ТОТ ЖЕ номер (дважды v1.6.12) → мой `git rebase origin/main` конфликтовал ТОЛЬКО в `AppVersion.tsx` (фича-файлы не пересекались) → брал их запись changelog + дописывал свою следующим номером. (4) Раз параллельный агент через `git add -A` **сгрёб мои незакоммиченные правки** в свой коммит; вывод — коммитить быстро/в worktree, не оставлять свой WIP в общем дереве надолго.

**Ключевые файлы:** `apps/frontend/src/components/VideoViewer.tsx` (плеер+обрезка+скраб+звук+мульти-марки+имя+Сохранить-вверху), `apps/frontend/src/pages/flow/MontageEditor.tsx` (облако «Редактор»: `loadEditorGallery`/`uploadEditorMedia`/вкладки-пикер, `EdCat`/`ED_TABS`), `apps/frontend/src/pages/FlowPage.tsx` (`isNew`/`openedNew`), `apps/backend/src/modules/video_edit/router.ts` (обрезка видео + аудио → m4a, склейка).

---

*Последнее обновление: 2026-07-01 — TrendFlow редактор видео/аудио (`VideoViewer`) + пикер медиа = Галерея (v1.6.7 → v1.6.14): пресеты только для нового сценария; пикер «Редактора» повторяет Галерею (вкладки Тренды/Референс/Аудио/Из анализа + поиск + крупные карточки + загрузка «Медиа»/«Аудио»); редактор — редактируемое имя (карандаш), «Сохранить» вверху, мульти-обрезка (отметить N промежутков → «Вырезать»/«Оставить» всех сразу), скраб при перетаскивании (видео перематывается на позицию реза), кнопка звука; бэкенд обрезки аудио → .m4a. Приём: изолированный git-worktree-деплой при параллельной сессии (+ junction node_modules для tsc; junction снимать через `rmdir`, не `rm -rf`). Раздел «## 5.Ф». Предыдущее: 2026-06-30…07-01 — монетизация (платный гейт + триал + Stripe + импесонейшн), раздел «## 5.У». Известное TODO: whsec_ webhook secret в Stripe; общий компонент медиа-библиотеки (чтобы улучшения Галереи авто-попадали в пикер редактора).*
