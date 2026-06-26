# Интеграция VibeVox ↔ Quest Flow

Документация по подключению VibeVox AI к Telegram-боту через сервис Quest Flow.

**Версия:** актуально на 2026-05-28 (синхронизировано с кодом `apps/backend/src/modules/quest_flow/*`).
**Аудитория:** разработчики Quest Flow, которые строят HTTP-узлы в цепочках для общения с VibeVox.

**Цель:** в Telegram-боте (одном или нескольких), которым управляет ваш Quest Flow,
клиент пишет (или говорит) → AI VibeVox отвечает в контексте его персональной комнаты →
ответ возвращается в Telegram. Все диалоги сохраняются и при желании передаются в CRM.

---

## 1. Простыми словами — что вообще происходит

У клиента (того, кто оплатил Enterprise на VibeVox) есть один или несколько **Telegram-ботов**, которыми управляет ваша платформа **Quest Flow**. VibeVox играет роль **AI-мозга** этих ботов.

1. Пользователь пишет (или говорит голосом) в Telegram-бот.
2. Quest Flow ловит сообщение и **дёргает наш HTTP-эндпойнт** с API-ключом этого аккаунта VibeVox в `Authorization`.
3. VibeVox:
   - Узнаёт по API-ключу, к какому аккаунту относится бот.
   - Находит (или создаёт) персональную «комнату» для этого Telegram-пользователя — одну на пару (`bot_id`, `user_id`).
   - Если был голос — расшифровывает аудио (Gemini), определяет язык/диалект, списывает секунды с баланса.
   - Собирает системный промпт (дефолтный VibeVox + промпт владельца + база знаний + заметки админа) и зовёт Gemini.
   - Сохраняет реплику клиента и ответ AI в БД.
   - **Возвращает ответ Quest Flow в JSON** — в `response.text` готовый текст.
   - В фоне (не блокируя ответ) ищет теги потребностей в диалоге и шлёт уведомление владельцу в Telegram.
4. Quest Flow подставляет `response.text` в узел **Send Message** и отправляет клиенту обратно в Telegram.

**API-ключ** — это «пароль вашего аккаунта VibeVox для Quest Flow». Один аккаунт может иметь несколько ключей (например, отдельный для каждой цепочки/бота). Ключ создаётся в UI один раз, показывается один раз, в БД хранится только SHA-256 хэш. При удалении ключ **физически удаляется** из БД — восстановить нельзя.

**Что нужно реализовать вашей стороне (Quest Flow):**

- (обязательно) HTTP-узел, который ходит на `POST /api/quest-flow/inbound` с Bearer-токеном.
- (опционально, для двусторонней связи) поллинг `GET /api/quest-flow/outbox` + квитанция `POST /api/quest-flow/outbox/:id/ack`, чтобы доставлять сообщения от владельца клиенту обратно в Telegram.

---

## 2. Подготовка на стороне VibeVox (что делает владелец аккаунта)

1. Войти в Enterprise-аккаунт VibeVox.
2. **Настройки → Quest Flow** (третья вкладка).
3. **Создать API-ключ** (кнопка «Создать ключ»):
   - Появится секрет вида `vbvx_qf_AbCd...EfGh` — **сохранить сразу**, показывается один раз.
   - Опционально дать метку (например «Прод-бот клиники Здоровье+»).
4. **Заполнить промт** для общения с клиентами (или оставить пустым — будет использован дефолтный промт VibeVox).
5. **Загрузить базу знаний** (TXT/Word/Excel/CSV) — если хочется, чтобы AI отвечал по конкретному материалу.
6. **Добавить теги потребностей** — AI будет искать их в диалогах и присваивать клиентам.

Кнопка «🗑» рядом с ключом **полностью удаляет ключ** из БД. Quest Flow перестанет работать через него — потребуется создать новый и заменить в цепочке.

---

## 3. Архитектура потока сообщений

```
                 ┌─────────────────────────────┐
   клиент TG ───►│  Telegram Bot API           │
   (голос/текст) │  (бот владельца VibeVox)    │
                 └────────────┬────────────────┘
                              │ webhook
                              ▼
                 ┌─────────────────────────────┐
                 │  Quest Flow                 │
                 │  цепочка с HTTP Request     │
                 └────────────┬────────────────┘
                              │ POST /api/quest-flow/inbound
                              │ Authorization: Bearer vbvx_qf_***
                              ▼
                 ┌─────────────────────────────┐
                 │  VibeVox Backend            │
                 │  - verifyKey() (хэш+revoke) │
                 │  - findOrCreateRoom()       │
                 │  - transcribe (if audio)    │
                 │  - respondToClient (Gemini) │
                 │  - detectNeedTags (async)   │
                 │  - sendOwnerNotification    │
                 └────────────┬────────────────┘
                              │ JSON { response: { text }, … }
                              ▼
                 ┌─────────────────────────────┐
                 │  Quest Flow                 │
                 │  Send Message в TG          │
                 └────────────┬────────────────┘
                              ▼
                          клиент TG

ОБРАТНОЕ направление (опционально, admin→client):
                 ┌─────────────────────────────┐
                 │  Quest Flow (поллинг)       │
                 │  GET  /api/quest-flow/outbox│
                 │  POST /api/quest-flow/      │
                 │       outbox/:id/ack        │
                 └─────────────────────────────┘
```

---

## 4. Эндпойнты, которые вы будете звать

Все три эндпойнта аутентифицируются **одним и тем же API-ключом** (заголовок `Authorization: Bearer vbvx_qf_…`).

| # | Метод | Путь                                | Назначение                                     |
|---|-------|-------------------------------------|------------------------------------------------|
| 1 | POST  | `/api/quest-flow/inbound`           | **Главный.** Клиент → AI → ответ.              |
| 2 | GET   | `/api/quest-flow/outbox`            | (Опц.) Забрать сообщения от админа → клиенту.  |
| 3 | POST  | `/api/quest-flow/outbox/:id/ack`    | (Опц.) Подтвердить доставку сообщения.         |

**Base URL:** `https://<ваш-домен-vibevox>` (продакшен) или `http://localhost:3001` (dev backend) / `http://localhost:3000/api/...` через Vite proxy (dev frontend).

---

## 5. `POST /api/quest-flow/inbound` — главный вебхук

**Исходник:** `apps/backend/src/modules/quest_flow/router.ts:41-76`, обработчик — `apps/backend/src/modules/quest_flow/inbound.ts:96-254`.

### 5.1. Заголовки

```http
POST /api/quest-flow/inbound HTTP/1.1
Host: vibevox.example.com
Content-Type: application/json
Authorization: Bearer vbvx_qf_<48 символов base64url>
```

### 5.2. Тело запроса

```jsonc
{
  // ─── ОБЯЗАТЕЛЬНЫЕ ───
  "telegram_bot_id": "7012345678",         // ID бота (как строка)
  "telegram_user_id": "123456789",          // chat_id клиента в TG (как строка)

  // ─── ОПЦИОНАЛЬНЫЕ, для отображения в UI VibeVox ───
  "telegram_username": "ivan_petrov",       // @username, без @
  "telegram_display_name": "Иван Петров",   // first_name + last_name

  // ─── ХОТЯ БЫ ОДНО ИЗ ДВУХ: text ИЛИ audio ───
  "text": "Сколько стоит услуга X?",        // текст от клиента
  "audio": "T2dnUwACAAAA…",                 // base64-аудио (без префикса data:)
  "audio_mime": "audio/ogg",                // MIME аудио. По умолчанию 'audio/ogg'.
                                            // Поддерживается: audio/ogg, audio/mpeg, audio/wav, audio/webm

  // ─── МЕДИА ОТ КЛИЕНТА (фото/видео/документ) — base64, опционально ───
  "media": "/9j/4AAQSkZJRg…",               // base64 файла (без префикса data:). До 30 МБ.
  "media_mime": "image/jpeg",               // MIME: image/*, video/*, application/pdf и т.д.
  "media_kind": "image",                    // опц.: image | video | audio | file (иначе по MIME)

  // ─── ОПЦИОНАЛЬНО, для отладки на нашей стороне ───
  "metadata": {
    "chain_id": "qf-chain-42",
    "node_id": "vibevox-ai-node-1",
    "qf_message_id": "abc-123"
  }
}
```

**Правила валидации (исходник `inbound.ts:100-106`):**

- `telegram_bot_id` и `telegram_user_id` — обязательны, иначе **400**.
- Должно быть либо `text`, либо `audio` (хоть одно непустое), иначе **400**.

### 5.3. Тело ответа (200 OK)

```jsonc
{
  "ok": true,
  "roomId": "550e8400-e29b-41d4-a716-446655440000",  // UUID комнаты в VibeVox
  "response": {
    "text": "Услуга X стоит 5000 руб. Записать вас на консультацию?"
  },
  "language": "ru",                  // ISO-639-1, заполнен только если был audio
  "dialect": null,                   // строка-описание диалекта или null
  "transcription": "Сколько стоит услуга X?",   // только если был audio
  "detectedTags": [                  // массив, может быть пустой
    { "tagId": "uuid", "tagName": "Юрист", "confidence": 0.87 }
  ],
  "balanceRemaining": 38912          // секунд минут на балансе после списания.
                                     // -1 если audio не передавался
}
```

**Что важно подставлять обратно в Telegram:** только `response.text`. Остальное — для логирования / роутинга на вашей стороне (например, по `detectedTags`).

### 5.4. Коды ошибок

| Код | Когда возвращается                                                                              | Что делать в QF                                          |
|-----|--------------------------------------------------------------------------------------------------|----------------------------------------------------------|
| 200 | OK                                                                                               | Парсить `response.text`                                  |
| 400 | Не передан `telegram_bot_id` / `telegram_user_id` / нет ни text ни audio                         | Лог; не ретраить (payload плохой)                        |
| 401 | Нет `Authorization`, или ключ не начинается с `vbvx_qf_`, или ключ **удалён/невалиден**          | Не ретраить. Уведомить владельца — ключ надо пересоздать |
| 402 | (a) аккаунт не на Enterprise тарифе; (b) не хватило секунд на балансе для аудио                  | Не ретраить. Уведомить владельца — пополнить баланс/тариф|
| 500 | Внутренняя ошибка (упал Gemini API, БД)                                                          | Можно один раз ретраить с задержкой 3-5 сек              |

Тело ошибки:

```json
{ "error": "человекочитаемое описание", "feature": "quest-flow" /* опц. */ }
```

### 5.5. Идемпотентность и ретраи

- Эндпойнт **НЕ идемпотентен**: каждый вызов записывает реплику клиента в `room_messages`, списывает деньги (если аудио) и зовёт Gemini.
- При сетевых ошибках / 5xx **ретраить максимум 1 раз через 3-5 секунд**, и только если уверены, что предыдущий запрос не дошёл. Иначе клиент получит два ответа AI и будет два списания.
- При 4xx — НЕ ретраить.

### 5.6. Тайминги

- Без аудио: **~1.5–4 сек** (Gemini Flash latency).
- С аудио: **~3–8 сек** (транскрипция + ответ).
- Рекомендуемый таймаут на стороне QF: **30 секунд**.

---

## 6. `GET /api/quest-flow/outbox` — забрать сообщения от владельца клиенту

**Исходник:** `apps/backend/src/modules/quest_flow/router.ts:175-187`.

Нужно, чтобы владелец VibeVox мог писать клиенту в Telegram **из веб-интерфейса VibeVox** (раздел «Чат комнаты»). VibeVox кладёт такое сообщение в очередь, а Quest Flow её регулярно поллит и доставляет в Telegram.

### 6.1. Запрос

```http
GET /api/quest-flow/outbox HTTP/1.1
Authorization: Bearer vbvx_qf_<тот же ключ>
```

Без параметров. Возвращает **до 50** свежих pending-сообщений по всем ботам/клиентам аккаунта.

### 6.2. Ответ (200)

```jsonc
{
  "messages": [
    {
      "id": "msg-uuid-1",                       // ← запомните, передадите в /ack
      "roomId": "room-uuid",
      "telegramBotId": "7012345678",
      "telegramUserId": "123456789",
      "kind": "text",                            // text | audio | image | video | file
      "content": "Здравствуйте! Готовы записаться?",
      "mediaUrl": null,                          // если kind != text — URL файла
      "mediaMime": null,
      "createdAt": "2026-05-28T10:15:22.000Z"
    }
  ]
}
```

### 6.3. Что делает Quest Flow

1. Для каждого `message`:
   - Если `kind == "text"` — отправить `content` в Telegram бота `telegramBotId` пользователю `telegramUserId`.
   - Иначе — скачать `mediaUrl` и отправить соответствующим методом TG API (`sendVoice`, `sendPhoto`, `sendVideo`, `sendDocument`).
2. После успешной доставки — позвать `POST /api/quest-flow/outbox/:id/ack`.

### 6.4. Рекомендуемый интервал поллинга

- **10–30 секунд** на аккаунт.
- Не чаще раза в 5 секунд (нагрузка на нашу БД).

---

## 7. `POST /api/quest-flow/outbox/:id/ack` — подтвердить доставку

**Исходник:** `apps/backend/src/modules/quest_flow/router.ts:189-202`.

```http
POST /api/quest-flow/outbox/msg-uuid-1/ack HTTP/1.1
Authorization: Bearer vbvx_qf_<тот же ключ>
```

Тело — пустое.

**Ответ:**

```json
{ "ok": true }
```

После ack сообщение перестаёт возвращаться в `/outbox` (метка `outbox_status: 'sent'` в `room_messages.metadata`).

**Если не позвать ack** — сообщение будет всплывать в поллинге снова и снова → клиент получит дубль. **Всегда квитируйте.**

---

## 8. Формат API-ключа и его жизненный цикл

### 8.1. Генерация

**Исходник:** `apps/backend/src/modules/quest_flow/keys.ts:57-71`.

```text
vbvx_qf_<48 символов base64url>

Пример:
vbvx_qf_tyBZkw3p_aN9Q-PXLrM8vK2sRgH7eUdYwCx5tFnVmJ4o0iLp
```

- Префикс `vbvx_qf_` обязателен — по нему мы сразу отбрасываем мусор.
- В базе хранится **только SHA-256(rawKey)** в hex, и первые 12 символов raw-ключа как `api_key_prefix` (для отображения в UI: `vbvx_qf_tyBZ…`).
- Сырой ключ показывается пользователю **один раз** при создании. Восстановить невозможно — если потеряли, надо удалить и создать новый.

### 8.2. Жизненный цикл

1. **Создать ключ:** UI Настройки → Quest Flow → «Создать ключ» (опц. метка).
2. **Скопировать и вставить в HTTP-узел Quest Flow.** Один раз.
3. **(Опц.) Создать ещё ключи** для других цепочек / отдельных ботов — каждой цепочке свой ключ удобнее (легче отозвать одну, не сломав остальные).
4. **Удалить ключ:** UI «🗑» рядом с ключом. Ключ удаляется из БД **навсегда**, Quest Flow перестаёт через него аутентифицироваться (получит 401).

### 8.3. Проверка ключа на каждом запросе

**Исходник:** `keys.ts:85-107`.

```ts
verifyKey(rawKey):
  if (!rawKey.startsWith('vbvx_qf_')) return null;
  hash = SHA-256(rawKey)
  row = SELECT id, tenant_id FROM tenant_quest_flow_keys
        WHERE api_key_hash = hash AND revoked_at IS NULL
        LIMIT 1
  if (!row) return null;
  UPDATE … SET last_used_at = NOW() WHERE id = row.id;
  return { tenantId: row.tenant_id, keyId: row.id }
```

Удалённые ключи (или legacy-ключи с проставленным `revoked_at`) не аутентифицируются → 401.

### 8.4. Безопасность

- Ключ передаётся **только по HTTPS**.
- **Никогда не логировать сырой ключ** на стороне Quest Flow — только префикс `vbvx_qf_…`.
- `last_used_at` обновляется на каждом валидном запросе → владелец видит в UI «ключ активен».

---

## 9. Минимальный шаблон цепочки в Quest Flow

```
[Trigger: Telegram message]
        │
        ▼
[Branch: voice or text?] ──┐
   │                       │
   │ text                  │ voice
   ▼                       ▼
[HTTP Request VibeVox]   [Download voice]
   url: POST {{vibevox}}/api/quest-flow/inbound      ──▶ [Base64 encode]
   headers:                                                     │
     Authorization: Bearer {{secret.vbvx_key}}                  ▼
     Content-Type: application/json                       [HTTP Request VibeVox]
   body: {                                                   url: same
     telegram_bot_id: "{{bot.id}}",                          body: {
     telegram_user_id: "{{from.id}}",                          telegram_bot_id, telegram_user_id,
     telegram_username: "{{from.username}}",                   audio: "{{base64}}",
     telegram_display_name: "{{from.first_name}} {{from.last_name}}",
     text: "{{message.text}}"                                  audio_mime: "audio/ogg"
   }                                                       }
        │                       │
        └───────────┬───────────┘
                    ▼
        [Send Telegram message]
            text: {{response.body.response.text}}
                    │
                    ▼
        [Optional: route by detectedTags]
            if response.body.detectedTags[0].tagName == "Юрист" → notify legal-team chat
```

Параллельно — **отдельная цепочка-демон** (запускается по таймеру каждые 15-30 сек):

```
[Trigger: every 20 sec]
        ▼
[HTTP Request: GET {{vibevox}}/api/quest-flow/outbox]
   headers: Authorization: Bearer {{secret.vbvx_key}}
        ▼
[For each message in response.messages]
   ├─► [Send to Telegram via bots[telegramBotId]]
   │        chat_id: telegramUserId
   │        if kind==text → sendMessage(content)
   │        if kind==audio → download(mediaUrl) → sendVoice
   │        … и т.д.
   └─► [HTTP Request: POST {{vibevox}}/api/quest-flow/outbox/{{message.id}}/ack]
```

---

## 10. Семантика «1 клиент = 1 комната»

VibeVox автоматически создаёт **одну комнату на пару (telegram_bot_id, telegram_user_id)**.
Диалог накапливается в этой комнате на протяжении всего времени общения.

- Если клиент пишет тому же боту повторно — продолжается **та же** комната, со всей историей.
- Если клиент пишет **другому** боту вашего аккаунта — создаётся **новая** комната (другой контекст).
- Если владелец удалил комнату в VibeVox UI — при следующем сообщении создастся новая (без истории).

---

## 11. Аудио

- Если передаёте `audio` — VibeVox **транскрибирует** его через Gemini (с авто-определением языка), применяет правила диалектов из «AI Learning Hub» (если для этого языка есть rules в суперадминке) и подмешивает их в ответ.
- За транскрипцию аудио **списываются секунды** с баланса аккаунта (как и за обычный перевод).
- Если баланс < длительности аудио — VibeVox вернёт `402 Payment Required`.
- Поддерживаемые форматы: PCM 16 kHz mono (предпочтительно), OGG (Telegram voice по умолчанию), MP3, WAV, WebM.

---

## 11.1. Изображения и распознавание (vision)

- Если в `inbound` передать `media` (base64) с `media_mime: "image/jpeg"` (или другим `image/*`),
  VibeVox **передаёт картинку в Gemini** вместе с системным промтом.
- **Что сделать с изображением — задаёт владелец в промте Quest Flow** (Настройки → Quest Flow → «Промт для Telegram-диалогов»).
  Пример промта: «Если клиент прислал фото паспорта — распознай фамилию и имя и повтори их для подтверждения».
- Картинка также сохраняется в чат комнаты — владелец видит её сам.
- Лимит на vision-картинку — до ~18 МБ (после — изображение сохранится, но в распознавание не уйдёт).
- Видео и файлы (`video/*`, `application/pdf` и т.д.) пока сохраняются и видны владельцу, но в модель НЕ передаются (только факт вложения).

Пример тела запроса с фото:

```jsonc
{
  "telegram_bot_id": "7012345678",
  "telegram_user_id": "123456789",
  "text": "Вот мой паспорт",        // опционально
  "media": "/9j/4AAQSkZJRg…",        // base64 фото (без префикса data:)
  "media_mime": "image/jpeg"
}
```

---

## 12. Что приходит в CRM (Раздел 4 настроек)

Если владелец подключил Chatwoot per-tenant в Настройках (Раздел 4), VibeVox отправит туда:

- Контакт по `telegram_user_id` (создаст, если не существует).
- Заметку с полной историей диалога.
- Все присвоенные клиенту теги потребностей (как `custom_attributes`).

Делается асинхронно после диалога или вручную из чата комнаты («Отправить в CRM»).

---

## 13. Что происходит на стороне VibeVox «под капотом» (для понимания)

Для каждого `POST /inbound` VibeVox:

1. **Auth** — берёт `Bearer`, SHA-256, ищет в `tenant_quest_flow_keys` (с фильтром `revoked_at IS NULL`). Получает `tenantId`.
2. **Enterprise-gate** — проверяет, что у `tenantId` тариф Enterprise. Иначе 402.
3. **Find-or-create room** — ищет комнату по `(tenant_id, telegram_bot_id, telegram_user_id, kind='telegram_chat')`. Если нет — создаёт.
4. **Если audio:**
   - Считает длительность по байтам base64 → списывает секунды через `deductAudioBalance`.
   - Зовёт `transcribeAudio(...)` → получает `text, language, dialect, dialectInstruction` (Gemini Flash multimodal).
5. **Сохраняет реплику клиента** в `room_messages` (sender=`client`).
6. **Зовёт AI:** `respondToClient` (`responder.ts`).
   - Собирает system prompt из 4 слоёв: дефолтный VibeVox-промпт + `tenants.questflow_prompt` + `tenants.questflow_knowledge_base` + заметки админа из чата комнаты (высший приоритет).
   - Берёт последние 30 сообщений как контекст.
   - Зовёт `gemini-3.5-flash` (env `GEMINI_FLASH_MODEL`).
7. **Сохраняет ответ AI** в `room_messages` (sender=`ai`).
8. **Параллельно (не блокируя ответ):**
   - Запускает `detectNeedTags` — отдельный Gemini-вызов, который проверяет соответствие диалога каждому тегу владельца. Результаты с confidence ≥ 0.5 записывает в `client_tag_assignments`.
   - Шлёт уведомление владельцу в его Telegram — если это новая комната («🆕 Новый клиент») или если присвоились новые теги («🏷 Выявлены потребности»).
9. **Возвращает JSON** Quest Flow.

---

## 14. Лимиты и квоты

| Ресурс                                  | Лимит                              | Где задаётся                                 |
|-----------------------------------------|------------------------------------|----------------------------------------------|
| Длина промта владельца                  | 40 000 символов                    | `responder.ts:22` MAX_PROMPT                 |
| Длина базы знаний                       | 500 000 символов                   | `responder.ts:23` MAX_KB                     |
| Размер файла базы знаний                | 50 MB                              | `prompt.ts:27` MAX_UPLOAD_BYTES              |
| Форматы базы знаний                     | TXT, DOCX, XLSX, CSV               | `tenant_prompt/parsers/`                     |
| Контекст диалога для AI                 | последние 30 сообщений             | `responder.ts:155`                           |
| Outbox poll                             | до 50 сообщений за запрос          | `enterprise_chat/outbox.ts`                  |
| Метка ключа                             | 255 символов                       | `keys.ts:67`                                 |
| Тегов потребностей                      | без лимита, но рекомендуем ≤ 20    | UI-рекомендация                              |

---

## 15. Чек-лист для разработчика Quest Flow

- [ ] Сохранять секрет `vbvx_qf_…` per-проект/per-цепочка (как secret env, не в открытом JSON цепочки).
- [ ] Реализовать HTTP-узел `POST /api/quest-flow/inbound` с body как в §5.2.
- [ ] Поддержать передачу аудио (если бот принимает голосовые) — base64, MIME `audio/ogg`.
- [ ] Таймаут на узел: **30 секунд**.
- [ ] Ретраи: только на сетевых ошибках и 5xx, **максимум 1 раз**, с дельтой 3-5 сек. На 4xx — НЕ ретраить.
- [ ] Парсить `response.body.response.text` и подставлять в узел Send Telegram Message.
- [ ] (Опц.) Парсить `detectedTags` для условного роутинга (например, тег «Юрист» → переслать в чат отдела).
- [ ] (Опц., но желательно) Реализовать «демон-цепочку» с поллингом `GET /api/quest-flow/outbox` каждые 15-30 сек + квитанцией `POST /…/:id/ack`.
- [ ] Логирование: писать `metadata.qf_message_id` и/или `chain_id` в каждом запросе — упростит дебаг.
- [ ] **Никогда** не логировать сырой `vbvx_qf_…` ключ — только префикс или замаскированный.

---

## 16. Быстрая проверка работоспособности

```bash
curl -i -X POST https://<vibevox-host>/api/quest-flow/inbound \
  -H "Authorization: Bearer vbvx_qf_ВАШ_КЛЮЧ" \
  -H "Content-Type: application/json" \
  -d '{"telegram_bot_id":"test","telegram_user_id":"test","text":"ping"}'
```

- **401** → ключ невалиден / удалён.
- **402** → ключ ок, но аккаунт не Enterprise или нет баланса.
- **200** с `response.text` → всё работает.

---

## 17. Изменения API

| Дата       | Изменение                                                                                                |
|------------|-----------------------------------------------------------------------------------------------------------|
| 2026-05-29 | **Распознавание изображений (vision).** Если клиент прислал `media` с `image/*` — картинка передаётся в Gemini, и AI анализирует её согласно промту владельца (например «распознай ФИО с паспорта»). Действие задаётся в промте Quest Flow (Раздел 3 настроек). |
| 2026-05-29 | **Inbound принимает медиа от клиента** (`media` base64 + `media_mime` + опц. `media_kind`). Фото/видео/файлы сохраняются и видны владельцу в чате комнаты. Лимит тела поднят до 30 МБ. |
| 2026-05-29 | **Outbox отдаёт АБСОЛЮТНЫЙ `mediaUrl`** (по `PUBLIC_BASE_URL`) — облачный Quest Flow теперь может скачать медиа владельца. Задайте `PUBLIC_BASE_URL` в `.env` (ngrok сейчас / домен на VPS). |
| 2026-05-28 | `verifyKey` теперь фильтрует `revoked_at IS NULL` — удалённые/отозванные ключи возвращают 401.            |
| 2026-05-28 | UI-кнопка «удалить ключ» делает **hard delete** (раньше делала soft-revoke и ключ оставался в списке).   |
| 2026-05-28 | Лимиты промта/KB: 4 000 → **40 000** символов, 50 000 → **500 000** символов. Размер файла KB: 50 MB.    |
| 2026-05-28 | Добавлены outbox-эндпойнты для admin→client сообщений.                                                    |

---

**Конец документа.**
