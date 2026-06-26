# Instagram — прямое подключение (омниканал, фазы IG)

## Зачем напрямую, а не через Chatwoot
Ростовые фичи Instagram — **Comment-to-DM**, **карусель**, **гейт подписки**,
**Ice Breakers**, **Story-триггеры** — Chatwoot **не поддерживает** (он отдаёт в IG
только текст + ≤3 быстрых ответа + медиа). Поэтому Instagram подключается
**напрямую к Meta Graph API** (*Instagram API with Instagram Login*). Движок цепочек
(`flows/runner.ts`) и свободный ИИ (`responder.ts`) переиспользуются как есть —
новые только адаптеры приёма/отправки (`modules/channels/instagram/`).

| Фича | Через Chatwoot | Прямой Graph API |
|---|---|---|
| DM текст / медиа | ✅ | ✅ |
| Быстрые ответы | ≤3 | **≤13** |
| Карусель / CTA-url кнопки | ❌ | ✅ (generic template) |
| Comment-to-DM | ❌ | ✅ |
| Гейт подписки (`is_user_follow_business`) | ❌ | ✅ |
| Ice Breakers / Story-триггеры | ❌ | ✅ |

## Что уже сделано — IG-0 (фундамент, в коде)
- `modules/channels/instagram/ig_config.ts` — резолв аккаунта (MVP: из `.env`).
- `ig_client.ts` — Send API: текст (авто-нарезка по 1000 байт), быстрые ответы (≤13), медиа по url.
- `ig_inbound.ts` — приём DM → комната → **активная IG-цепочка** (раннер) либо свободный ИИ (vision по фото) + теги; пресеты картинок работают.
- `ig_webhook.ts` — `GET/POST /api/instagram/webhook` (верификация + события, подпись X-Hub-Signature-256).
- Mount в `server.ts`; IG-возможности подняты до 13 кнопок (`capabilities.ts`, `channels.tsx`).

## Что нужно от владельца (чтобы IG-0 заработал вживую)
1. **Meta-приложение** (developers.facebook.com → Create App → тип «Business»).
2. Подключить **Instagram Professional**-аккаунт (через *Instagram API with Instagram Login* — **без Facebook-страницы**).
3. Сгенерировать **долгоживущий Instagram user access token** + узнать **IG business account id**.
4. В Meta → Webhooks подписать продукт Instagram на поля `messages` (и `comments` — для фазы IG-1).

## Настройка `.env` (apps/backend/.env)
```
PUBLIC_BASE_URL=https://<ваш-публичный-адрес>     # ngrok в dev; обязателен для медиа
INSTAGRAM_VERIFY_TOKEN=<любая-строка>             # её же ввести в Meta dashboard
INSTAGRAM_APP_SECRET=<App Secret приложения>      # для проверки подписи вебхука
INSTAGRAM_ACCESS_TOKEN=<долгоживущий токен>
INSTAGRAM_BUSINESS_ID=<id IG business-аккаунта>
INSTAGRAM_DEFAULT_TENANT_ID=<tenant VibeVox>      # MVP-резолвер (как dev-Chatwoot)
```

## Callback URL для Meta
```
https://<PUBLIC_BASE_URL>/api/instagram/webhook
Verify Token: <INSTAGRAM_VERIFY_TOKEN>
```
Meta дёрнет `GET` с `hub.challenge` — сервер вернёт challenge, если verify_token совпал.

## Проверка локально (без реального IG)
- Верификация: `GET /api/instagram/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=42` → должно вернуть `42`.
- Событие: `POST /api/instagram/webhook` с телом
  `{"object":"instagram","entry":[{"id":"<INSTAGRAM_BUSINESS_ID>","messaging":[{"sender":{"id":"123"},"recipient":{"id":"<IG_ID>"},"message":{"text":"привет"}}]}]}`
  (если `INSTAGRAM_APP_SECRET` задан — нужна корректная подпись; для локалки можно временно его не задавать).

## Дорожная карта фаз IG
- **IG-0 — фундамент** ✅ (этот документ): OAuth/токен, вебхук, приём/отправка DM, реюз раннера.
- **IG-1 — триггеры**: Comment-to-DM (вебхук `comments` → публичный ответ + приватный DM, 1 на коммент, 7 дней) + DM-keyword + UI-раздел «Триггеры» в редакторе цепочки.
- **IG-2 — богатое**: блок **«Карусель»** (2–10 карточек × ≤3 кнопки) + блок **«Подписка»** (гейт по `is_user_follow_business`, 2 выхода) + **Ice Breakers** (≤4) + Story reply/mention.
- **IG-3 — эмодзи-пикер + аналитика/полировка.**

## Лимиты Meta (на май 2026)
- Текст ≤1000 байт (длинное режется на части). Быстрые ответы ≤13 (title ≤20).
- Карусель: 2–10 карточек, ≤3 кнопки/карточка, title/subtitle ≤80.
- 200 DM/час; окно ответа 24ч от последнего сообщения юзера.
- Comment-to-DM: 1 приватное сообщение на комментарий, в течение 7 дней.

## App Review (для работы с чужими аккаунтами)
Permissions: `instagram_business_basic`, `instagram_business_manage_messages`,
`instagram_business_manage_comments` + **бизнес-верификация** (одна на сервис,
покрывает IG и FB). Для нашего тестового аккаунта хватает dev-режима приложения.

## Источники (Meta docs, май 2026)
- Messaging / Send API: developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
- User Profile (follow-status): .../messaging-api/user-profile/
- Quick Replies / Generic Template: .../messaging-api/quick-replies/ , .../button-template/
- Ice Breakers: .../messaging-api/ice-breakers/
