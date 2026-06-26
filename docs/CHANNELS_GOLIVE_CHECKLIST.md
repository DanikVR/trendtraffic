# Go-Live чеклист: Instagram и TikTok (что сверить при получении доступа)

Коннекторы написаны и компилируются (`tsc=0`), но **дормантны** — оживают, когда:
1) получен доступ к API (Meta App Review / TikTok Messaging Partner),
2) заполнены `*_` переменные в `apps/backend/.env`,
3) сверены «best-effort» формы запросов (помечены `TODO(partner)` — особенно TikTok).

Принцип общий: **env → webhook в кабинете → сверить payload'ы по реальной доке → прогнать тест-чеклист.**

Оба канала переиспользуют один движок цепочек (`flows/runner.ts`) и анти-бан-слой (пейсинг, лимиты, спинтакс, handover). Различается только транспорт.

---

## INSTAGRAM (прямой Graph API)

Бóльшая часть сверена по докам Meta (май 2026), но при первом живом подключении проверить пункты ниже.

### 1. Что получить (один раз, на весь сервис)
- [ ] Meta-приложение (Business) + продукт **Instagram → API with Instagram Login**.
- [ ] **Бизнес-верификация** + **App Review** разрешений: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`. (Для своего тест-аккаунта — dev-режим без ревью.)
- [ ] Тестовый IG **Professional**-аккаунт добавлен как Tester.
- [ ] Живые **Privacy Policy / Terms** на `vibevox.pro` (для ревью) + демо-видео работы каждого разрешения.

### 2. .env (`apps/backend/.env`)
```
PUBLIC_BASE_URL=https://<публичный-адрес>      # ОБЯЗАТЕЛЕН для медиа (IG скачивает по url)
INSTAGRAM_VERIFY_TOKEN=<строка>                # та же в Meta dashboard
INSTAGRAM_APP_ID=<App ID>                      # для OAuth-самоподключения (IG-0.5)
INSTAGRAM_APP_SECRET=<App Secret>              # + проверка подписи вебхука
INSTAGRAM_OAUTH_REDIRECT=https://<домен>/api/instagram/oauth/callback
# Тест без OAuth (один аккаунт):
INSTAGRAM_ACCESS_TOKEN=<долгоживущий токен>
INSTAGRAM_BUSINESS_ID=<id IG-аккаунта>
INSTAGRAM_DEFAULT_TENANT_ID=<tenant VibeVox>
```

### 3. Webhook + OAuth в кабинете Meta
- [ ] Callback: `https://<PUBLIC_BASE_URL>/api/instagram/webhook`, Verify Token = `INSTAGRAM_VERIFY_TOKEN`.
- [ ] Подписать поля: **`messages`**, **`comments`**.
- [ ] OAuth Redirect URI = `INSTAGRAM_OAUTH_REDIRECT` (точное совпадение).
- [ ] Проверка: `GET /api/instagram/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=42` → вернёт `42`.

### 4. Что сверить в коде по реальной доке
| Файл / функция | Что проверить |
|---|---|
| `instagram/ig_client.ts` `igSend` | Send API: `POST graph.instagram.com/v25.0/{IG_ID}/messages`, заголовок `Authorization: Bearer`, тело `{recipient:{id\|comment_id}, message}`. |
| `ig_client.sendInstagramCarousel` | generic template: ≤10 карточек, ≤3 кнопки, title/subtitle ≤80. |
| `ig_client.getInstagramFollowStatus` | `GET /{igsid}?fields=is_user_follow_business` — требует Advanced Access; работает только для написавших. |
| `ig_client.setInstagramIceBreakers` | `POST/DELETE /me/messenger_profile` с `ice_breakers` (платформа='instagram'). |
| `instagram/ig_inbound.ts` парсеры | Формы вебхука: `entry[].messaging[].message{text,quick_reply.payload,attachments[].type,reply_to.story,is_echo}`; постбэки карусели приходят как `messaging[].postback.payload`. |
| `ig_inbound.processInstagramComment` | Коммент: `entry[].changes` поле `comments`, `value{id, from{id,username}, text, media{id}}`. Приватный ответ — `recipient:{comment_id}` (1 на коммент, окно 7 дней). |
| `ig_webhook.ts` `signatureOk` | Подпись `X-Hub-Signature-256` = HMAC(app secret) от raw body. |

### 5. Тест-чеклист (живой аккаунт, dev-режим)
- [ ] Написать боту в Директ слово → пришёл ответ цепочки/ИИ.
- [ ] Кнопки быстрых ответов → ветвление работает.
- [ ] Прислать фото → vision/пресет картинок отвечает.
- [ ] Карусель → приходит generic template; тап кнопки (postback) ведёт по ветке.
- [ ] Блок «Подписка» → подписан/не подписан разводит ветки.
- [ ] Коммент с ключевым словом под постом → публичный ответ + приватный DM (карусель/первое сообщение).
- [ ] Ice Breakers видны при первом открытии чата; тап запускает цепочку.
- [ ] OAuth: кнопка «Подключить Instagram» на странице Botflow → согласие → `?ig=connected`, статус «Подключён: @…».
- [ ] Анти-бан: между сообщениями есть «печатает…» + паузы; виральный коммент-поток не валит токен (≤200/час).

---

## TIKTOK (Business Messaging API)

⚠️ Формы запросов TikTok — **best-effort** (помечены `TODO(partner)`). При получении доступа сверить ВСЁ из таблицы §4.

### 1. Что получить
- [ ] Статус **TikTok Messaging Partner** (одобрение TikTok) — аналог Meta App Review.
- [ ] Аккаунт привязан к **TikTok for Business / Business Center** + **Advanced Access**.
- [ ] Тестовый бизнес-аккаунт.

### 2. .env (`apps/backend/.env`)
```
PUBLIC_BASE_URL=https://<публичный-адрес>      # для медиа
TIKTOK_VERIFY_TOKEN=<строка>                   # та же в TikTok dashboard
TIKTOK_ACCESS_TOKEN=<access token>
TIKTOK_BUSINESS_ID=<id бизнес-аккаунта>        # = business_id в вебхуке
TIKTOK_DEFAULT_TENANT_ID=<tenant VibeVox>
TIKTOK_USERNAME=<@ник>                          # для Ref-URL/QR
# TIKTOK_API_BASE=https://business-api.tiktok.com/open_api/v1.3   # если изменится
```

### 3. Webhook в кабинете TikTok
- [ ] Callback: `https://<PUBLIC_BASE_URL>/api/tiktok/webhook`, Verify Token = `TIKTOK_VERIFY_TOKEN`.
- [ ] Подписать события сообщений и комментариев.
- [ ] Проверка: `GET /api/tiktok/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=42` → `42` (если TikTok использует иную схему верификации — поправить `tt_webhook.ts` GET).

### 4. Что СВЕРИТЬ в коде (главное — это TODO(partner))
| Файл / точка | Что подтвердить по доке TikTok |
|---|---|
| `tiktok/tt_client.ts` `API` | Базовый URL (`TIKTOK_API_BASE`, дефолт `…/open_api/v1.3`). |
| `tt_client` заголовок | Авторизация: `Access-Token: <token>` (имя заголовка). |
| `tt_client` `EP_SEND` | Путь отправки (`/business/message/send/`) + тело `{business_id, recipient_id, message{type:'text', text, quick_replies}}` и для медиа `{type:'image'\|'video', image_url\|video_url}`. |
| `tt_client` `EP_AUTO_MESSAGES` | Путь авто-сообщений (`/business/message/automation/`) + формы `welcome_message{enabled,text}` и `suggested_questions{enabled,questions[]}`. |
| `tt_client.replyTikTokComment` | Путь публичного ответа на коммент (`/business/comment/reply/`) + тело `{comment_id, text}`. |
| `tt_client` обработка ответа | Соглашение об ошибках: `code !== 0` при HTTP 200. |
| `tiktok/tt_webhook.ts` `handleWebhook` | Форма вебхука: где `business_id`, `type/event`, батч `events[]`. |
| `tiktok/tt_inbound.ts` `extractUserId/extractText/fetchTtImages` | Поля входящего: `sender.id\|user_id`, `message.text`, `attachments[].type='image'`, `quick_reply.payload`. |
| `tt_webhook.ts` `/ref-url` | Реальный формат deep-link/ref TikTok (сейчас best-effort `https://www.tiktok.com/@user?ref=`). |
| `tiktok/tt_ratelimit.ts` | Константы: окно **48ч**, лимит **10/диалог**; сброс на входящем. Подтвердить значения. |

### 5. Тест-чеклист (живой аккаунт)
- [ ] Написать боту слово в Директ → ответ цепочки/ИИ (бот НЕ может писать первым — проверить, что без входящего не шлёт).
- [ ] Вертикальные кнопки → ветвление.
- [ ] Картинка/видео → доставляются (видео — нативное превью).
- [ ] Ссылка (свой ролик/звук) → мини-превью в чате.
- [ ] Коммент с ключевым словом → **только публичный ответ** (DM НЕ уходит автоматически — это и есть легально).
- [ ] Welcome Message + Suggested Questions (≤3) видны при первом открытии чата (карточка TikTok на странице Botflow → сохранить → проверить в приложении).
- [ ] Ref-URL из шапки профиля открывает Директ; Welcome/вопросы запускают сценарий. QR ведёт туда же.
- [ ] Лимит: после 10 сообщений подряд без ответа юзера бот замолкает; новое сообщение юзера обнуляет счётчик. По истечении 48ч без входящего — не шлёт.
- [ ] Карусель/Подписка-гейт на TikTok-цепочке **мигают как несовместимые** (их нет на TikTok).

---

## WHATSAPP (Cloud API)

Формы Cloud API точные (хорошо документированы) — но всё равно прогнать тест-чеклист.

### 1. Что получить
- [ ] WhatsApp Business аккаунт в Meta Business Manager + продукт **WhatsApp** в Meta-приложении.
- [ ] **Phone Number ID** + **permanent / system-user access token**.
- [ ] (Для рассылок/инициации) одобренные **шаблоны** — это фаза WA-1, сейчас НЕ строим.

### 2. .env (`apps/backend/.env`)
```
PUBLIC_BASE_URL=https://<публичный-адрес>      # медиа (WA скачивает по HTTPS)
WHATSAPP_VERIFY_TOKEN=<строка>                 # та же в Meta webhook
WHATSAPP_APP_SECRET=<App Secret>               # проверка подписи вебхука
WHATSAPP_ACCESS_TOKEN=<permanent token>
WHATSAPP_PHONE_NUMBER_ID=<id номера>           # = value.metadata.phone_number_id
WHATSAPP_DEFAULT_TENANT_ID=<tenant VibeVox>
# WHATSAPP_API_BASE=https://graph.facebook.com/v21.0
```

### 3. Webhook в Meta
- [ ] Callback: `https://<PUBLIC_BASE_URL>/api/whatsapp/webhook`, Verify Token = `WHATSAPP_VERIFY_TOKEN`.
- [ ] Подписать поле **`messages`**.
- [ ] Проверка: `GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=42` → `42`.
- [ ] С 1 января 2026: все URL в CTA/теле — валидный HTTPS (иначе отклонение шаблона).

### 4. Что сверить в коде (формы точные, но подтвердить)
| Файл / функция | Что проверить |
|---|---|
| `whatsapp/wa_client.ts` `waSend` | `POST graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`, тело `{messaging_product:'whatsapp', to, type, ...}`. |
| `wa_client` interactive | reply-кнопки (≤3), list (≤10 rows), cta_url (одна в сессии) — формы interactive. |
| `whatsapp/wa_inbound.ts` `fetchWaMedia` | media: `GET /{media-id}` → `{url}` → fetch с Bearer. |
| `wa_inbound` парсер | входящее: `messages[].text.body`, `interactive.button_reply.id`, `interactive.list_reply.id`. |
| `whatsapp/wa_window.ts` | окно **24ч** (вне — только шаблон). Подтвердить. |
| `wa_webhook.ts` `handleWebhook` | object=`whatsapp_business_account`, `entry[].changes[].value.{metadata.phone_number_id, messages[], contacts[]}`. |

### 5. Тест-чеклист
- [ ] Клиент пишет → ответ цепочки/ИИ (в окне 24ч — свободно, бесплатно).
- [ ] Reply-кнопки (≤3) → ветвление; >3 кнопок → авто-список.
- [ ] Блок «Список» (≤10) → выбор ведёт по ветке.
- [ ] CTA-ссылка (одна) → кнопка-ссылка; звонок/копи-код → пока текстом (полноценно — шаблоны WA-1).
- [ ] Картинка/документ → vision/пресет; медиа уходит.
- [ ] **Окно 24ч**: после паузы >24ч без входящего бот свободно НЕ пишет (нужен шаблон).
- [ ] **Opt-out**: «стоп»/«отписка» → бот замолкает + подтверждение.
- [ ] Карусель/Подписка-гейт на WA-цепочке мигают как несовместимые.

### Осталось (НЕ из текущего объёма)
- **Шаблоны (WA-1)** — создание + модерация Meta + блок «Отправить шаблон» ({{1}}). Нужно для инициации/вне 24ч.
- **Рассылки (WA-2)**, **каталог/мультипродукт** — отдельно.

---

## MESSENGER (Messenger Platform API)

Тот же API, что у Instagram → формы знакомые; сверить при подключении страницы.

### 1. Что получить
- [ ] FB-страница + Meta-приложение с продуктом **Messenger** + **page access token** (permanent).
- [ ] App Review разрешений: `pages_messaging` (+ `pages_manage_metadata` для webhook, `pages_read_engagement` для comment-to-DM).

### 2. .env
```
PUBLIC_BASE_URL=https://<публичный-адрес>
MESSENGER_VERIFY_TOKEN=<строка>
MESSENGER_APP_SECRET=<App Secret>
MESSENGER_PAGE_TOKEN=<page access token>
MESSENGER_PAGE_ID=<id страницы>            # = entry.id в вебхуке
MESSENGER_DEFAULT_TENANT_ID=<tenant>
MESSENGER_PAGE_USERNAME=<@страница>        # для m.me ref-ссылки
```

### 3. Webhook в Meta
- [ ] Callback: `https://<PUBLIC_BASE_URL>/api/messenger/webhook`, Verify Token = `MESSENGER_VERIFY_TOKEN`.
- [ ] Подписать поля: **`messages`**, **`messaging_postbacks`** (Get Started/меню), **`feed`** (Comment-to-DM).
- [ ] В Page settings включить подписку приложения на страницу.

### 4. Что сверить в коде
| Файл / функция | Что проверить |
|---|---|
| `messenger/msg_client.ts` `msgSend` | `POST graph.facebook.com/v21.0/{PAGE_ID}/messages`, `{recipient, message, messaging_type:'RESPONSE'}`. |
| `msg_client` carousel/QR | generic template (как IG); quick_replies ≤13. |
| `msg_client` comment | публичный `POST /{comment-id}/comments`; приватный `POST /{comment-id}/private_replies`. |
| `msg_client.setMessengerProfile` | `POST /{PAGE_ID}/messenger_profile` (get_started/greeting/ice_breakers/persistent_menu). |
| `messenger/msg_inbound.ts` | вебхук `entry[].messaging[]` (PSID, postback Get Started/меню), коммент `entry[].changes` field=`feed` value{item,verb,comment_id,message,from}. |
| `msg_webhook.ts` | object=`page`; подпись X-Hub-Signature-256. |

### 5. Тест-чеклист
- [ ] Сообщение в Messenger → ответ цепочки/ИИ.
- [ ] Быстрые ответы / карусель / медиа.
- [ ] Get Started + Greeting + Ice Breakers + Постоянное меню (карточка Messenger → сохранить → проверить в чате).
- [ ] Коммент под постом с ключевым словом → публичный ответ + приватный DM.
- [ ] m.me ref-ссылка/QR открывают чат.
- [ ] Окно 24ч соблюдается; Подписка-гейт мигает как несовместимый (нет у FB).

---

## Общие точки (все каналы)
- [ ] `PUBLIC_BASE_URL` публично доступен (ngrok в dev / домен в проде) — иначе медиа не уйдёт.
- [ ] Handover: узел «Действие → Передать оператору» → бот молчит (IG 24ч / поведение проверить) → **дожать CRM-notify** (TODO: переиспользовать owner-notify).
- [ ] Спинтакс `{привет|здравствуйте}` рандомизирует текст (антиспам) — проверить, что варианты чередуются.
- [ ] Канал в редакторе **залочен** после создания (под каждый канал свои блоки/лимиты).
- [ ] Аналитика (страница Botflow) наполняется на Postgres (на fallback — нули).

## Где править при расхождении
Вся HTTP-специфика изолирована: Instagram — `ig_client.ts`; TikTok — `tt_client.ts` (+ парсеры вебхука в `*_inbound.ts` / `*_webhook.ts`). Бизнес-логика (цепочки, лимиты, UI) от форм запросов **не зависит** — правки точечные.
