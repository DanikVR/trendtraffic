# VibeVox — Чек-лист деплоя

Живой документ. Всё, что нужно **проверить и сделать ПЕРЕД** выкаткой на прод —
сюда. Не забываем дописывать новые пункты по мере появления.

> **Принцип**: если ты узнал про какую-то предпрод-обязанность дважды — она тут.

---

## 0. TL;DR — быстрая команда перед каждым деплоем

```bash
cd apps/frontend

# 1. Установить вспомогательные dev-пакеты (один раз на машине)
npm install -D lighthouse chrome-launcher

# 2. Прод-сборка с prerender + sitemap
SITE_ORIGIN=https://yourdomain.com npm run build:full

# 3. Локально проверить prerendered HTML
npm run preview
# открой http://localhost:4173/es/auth/login — должен быть Spanish title в <head>

# 4. Lighthouse audit (минимум: SEO 90+, Performance 70+)
LIGHTHOUSE_URL=http://localhost:4173 npm run lighthouse
```

---

## 1. Перед каждым деплоем фронта (обязательно)

### 1.1. SITE_ORIGIN

Сейчас в скриптах **`sitemap.mjs`** и **`prerender.mjs`** дефолт — `https://vibevox.app`.

**Перед деплоем на прод** обязательно прогнать `build:full` с переменной `SITE_ORIGIN`,
которая указывает на реальный домен:

```bash
SITE_ORIGIN=https://vibevox.com npm run build:full
```

Иначе в `sitemap.xml`, `canonical`, `og:url`, hreflang будут ссылки на `vibevox.app`,
а Google проиндексирует не наш домен.

### 1.2. Google Translate API key

Файл `apps/frontend/.env.local` лежит **только локально**, под `.gitignore`. Используется
исключительно скриптом `npm run translate:locales` (генерирует переводы один раз).

- На прод-сервер этот файл **НЕ кладём**.
- Vercel/Netlify/nginx не должны видеть этот ключ — он не нужен в рантайме.
- При публичном репо или подозрении на утечку — **ротировать ключ** в
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → APIs & Services → Credentials → Restrict the key или Regenerate.
- Если другой разработчик подключится — он создаёт **свой собственный** ключ для скрипта.

### 1.3. Build + prerender

Обязательная команда сборки на прод — **`npm run build:full`**, не `npm run build`.

`build:full` это: `sitemap → vite build → prerender`.

После этой команды в `dist/` появляется:

```
dist/
├── index.html                     (default, English)
├── assets/                        (hashed JS/CSS bundles)
├── locales/                       (108 JSON файлов с переводами)
├── robots.txt
├── sitemap.xml                    (432 URL × hreflang)
├── vibevox-logo-light.png         (для светлого фона)
├── vibevox-logo-dark.png          (для тёмного фона)
├── favicon.png
├── vibevox-icon.png
├── af/  am/  ar/ ... 108 папок    (по одной на язык)
│   ├── index.html                 (Spanish/Arabic/... home)
│   └── auth/
│       ├── login/index.html
│       ├── register/index.html
│       └── forgot-password/index.html
```

Все 432 prerendered HTML — статика. Заливаются на CDN/static host. Никакого Node.js
на проде для фронта не нужно.

### 1.4. Cache headers

Должны соответствовать одному из шаблонов:
- **Vercel**: автоматически из `apps/frontend/vercel.json`.
- **Netlify**: автоматически из `apps/frontend/netlify.toml`.
- **Свой nginx**: используй `apps/frontend/nginx.example.conf` как шаблон.

Ключевые правила:
- `/assets/*` → `max-age=31536000, immutable` (хеши в именах гарантируют свежесть).
- `/locales/*.json` → `max-age=86400, stale-while-revalidate=604800`.
- HTML (включая `index.html`) → `no-cache, no-store, must-revalidate`.
- Картинки/шрифты → `max-age=31536000, immutable`.
- `sitemap.xml` → `max-age=3600`.

### 1.5. URL-rewrites для `/{lang}/...`

Если разворачиваешь **на свой сервер**, обязательно настрой rewrite-правила,
чтобы:

- `/es/auth/login` → `dist/es/auth/login/index.html` (prerendered).
- `/es/` → `dist/es/index.html`.
- `/{что_угодно_не_lang}/...` → `dist/index.html` (SPA fallback).

Для Vercel — в `vercel.json` (`rewrites` секция) уже всё есть.
Для Netlify — в `netlify.toml` (`redirects` секция) уже всё есть.
Для nginx — `nginx.example.conf` содержит шаблон.

### 1.6. SPA fallback

Все НЕ-prerendered, НЕ-статические URL должны падать на `dist/index.html` (SPA).
Иначе при F5 на любой странице приложения юзер получает 404.

В Vercel/Netlify-конфигах последний `rewrite` это catch-all `/(.*) → /index.html`.

### 1.7. Lighthouse audit

Перед мажорным релизом — прогоняем:

```bash
npm run preview &              # фоном
LIGHTHOUSE_URL=http://localhost:4173 npm run lighthouse
```

**Минимально допустимые скоры** на главных страницах (home, login, register):
- SEO: **≥ 90**.
- Accessibility: **≥ 90**.
- Performance: **≥ 70** (mobile), **≥ 90** (desktop).
- Best Practices: **≥ 90**.

Если что-то падает — починить до выкатки. Репорты в `apps/frontend/reports/`.

---

## 2. Перед каждым деплоем бэкенда (обязательно)

### 2.1. Environment variables

Проверь, что на проде установлены:

| Переменная | Зачем | Где взять |
|---|---|---|
| `DATABASE_URL` | PostgreSQL | Provider (Neon/Supabase/Render) |
| `JWT_SECRET` | подпись токенов | минимум 32 случайных байта (`openssl rand -hex 32`) |
| `SIP_ENCRYPTION_KEY` | шифрование Enterprise-секретов (AES-256-GCM) | минимум 32 байта (`openssl rand -hex 32`) |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | WebRTC переводчик | [LiveKit Cloud](https://cloud.livekit.io/) |
| `GEMINI_API_KEY` | глобальный AI ключ (fallback для не-Enterprise) | [Google AI Studio](https://aistudio.google.com/) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | биллинг | [Stripe dashboard](https://dashboard.stripe.com/apikeys) |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth логин | [Google Cloud](https://console.cloud.google.com/apis/credentials) |
| `CHATWOOT_BASE_URL` | (опц.) интеграция CRM | если используем |
| `NODE_ENV=production` | отключает dev-логи | — |

**НЕ кладём** в env:
- `GOOGLE_TRANSLATE_API_KEY` — он dev-only (для скрипта `translate:locales`).

### 2.2. CORS / Origin

Проверь, что в `apps/backend/src/server.ts` `cors()` middleware пускает только наш
прод-домен:

```js
app.use(cors({
  origin: ['https://vibevox.com', 'https://www.vibevox.com'],
  credentials: true,
}));
```

Wildcard `*` в проде **запрещён** (CSRF риск).

### 2.3. Webhook signatures

Stripe webhook должен валидироваться через `STRIPE_WEBHOOK_SECRET`. Без этого
любой может стрельнуть `/api/billing/webhook` фейковыми событиями.

### 2.4. Rate limiting

Перед прод-деплоем убедись, что:
- `/api/auth/login` — rate-limited (max 5 попыток / 15 мин / IP).
- `/api/auth/register` — rate-limited (max 3 регистрации / час / IP).
- `/api/coach/explain` — rate-limited (защита от bot-абуза, max 60/мин/user).

Если ratelimit пока не написан — это **блокер** для прода (записать в TODO).

### 2.5. Backup БД

Перед мажорными миграциями:
- `pg_dump` текущей prod-БД в безопасное место.
- Тестировать миграции на staging-копии.

### 2.6. Health check endpoint

`GET /api/health` должен возвращать 200 и пинговать БД + LiveKit.
Используется monitoring (Render/Cloudflare/UptimeRobot).

---

## 3. Однократно при первом деплое

### 3.1. DNS

- `vibevox.com` (apex) + `www.vibevox.com` → A/CNAME на CDN (Vercel/Cloudflare/Netlify).
- `api.vibevox.com` → CNAME на бэкенд (Render/Fly/AWS).
- TXT-запись для верификации Google Search Console.

### 3.2. HTTPS

- Vercel/Netlify — автоматически.
- Cloudflare — флипни «Full (strict)» SSL.
- Свой nginx — Let's Encrypt через certbot.

### 3.3. Google Search Console

1. Добавь сайт `https://vibevox.com`.
2. Подтверди владение (DNS TXT или HTML-файл).
3. Submit sitemap: `https://vibevox.com/sitemap.xml`.
4. В разделе **International targeting** проверь, что hreflang-ссылки увидены.

### 3.4. Bing Webmaster Tools

То же самое, но в [bing.com/webmasters](https://www.bing.com/webmasters/).
Особенно важно: Bing **не рендерит JavaScript** так же хорошо как Google,
prerendered HTML критичен.

### 3.5. Yandex Webmaster

[webmaster.yandex.ru](https://webmaster.yandex.ru/). Для русскоязычного рынка —
обязательно. Аналогично: добавить сайт + sitemap.

### 3.6. OpenGraph дебаггеры

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — проверь как Facebook видит наш сайт.
- [Twitter Card Validator](https://cards-dev.twitter.com/validator) — проверь Twitter превью.
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/).

Эти боты **НЕ рендерят JS** — поэтому для них критично что у нас есть
prerendered `og:*` и `twitter:*` мета-теги.

### 3.7. Monitoring / Alerts

- **Uptime**: UptimeRobot / BetterStack — пинг `https://api.vibevox.com/api/health` каждую минуту.
- **Errors**: Sentry (frontend + backend). Алерт в Telegram/Slack при > 10 errors/min.
- **Stripe**: webhook на свой Telegram-бот для критических событий (failed payment, subscription cancelled).

---

## 4. После каждого деплоя — smoke tests

Список того, что **проверяем вручную** после выкатки (можно автоматизировать
через Playwright/Cypress попозже):

### 4.1. Frontend

- [ ] Открой `https://vibevox.com/` — главная грузится без 5xx.
- [ ] Открой `https://vibevox.com/es/` — испанская версия + правильные мета (View Source).
- [ ] Открой `https://vibevox.com/ar/` — арабский, `<html dir="rtl">`.
- [ ] Открой `https://vibevox.com/sitemap.xml` — 432 URL, не 404.
- [ ] Открой `https://vibevox.com/robots.txt` — Sitemap-строка указывает на нас.
- [ ] DevTools → Network → reload `/` — `/locales/en/common.json` грузится с `Cache-Control: max-age=86400`.
- [ ] LanguageSwitcher работает — выбери Korean → UI перевелся.
- [ ] localStorage запомнил `i18nextLng=ko`.
- [ ] Полная регистрация → лобби → создание комнаты — без ошибок.

### 4.2. Backend

- [ ] `GET /api/health` → 200 + JSON `{ status: "ok", db: "connected", livekit: "connected" }`.
- [ ] Логин с тестовым аккаунтом → JWT приходит.
- [ ] `POST /api/rooms/create` → создаётся, появляется в БД (`SELECT * FROM rooms ORDER BY created_at DESC LIMIT 5`).
- [ ] Stripe тест-карта `4242 4242 4242 4242` оплачивает тариф → webhook приходит → подписка активирована.
- [ ] LiveKit-сессия запускается (звонок).

### 4.3. SEO

- [ ] [PageSpeed Insights](https://pagespeed.web.dev/) на `https://vibevox.com/` — green-зона.
- [ ] Google Search Console → URL Inspection → request indexing для главных страниц.
- [ ] Через 1-7 дней проверь `site:vibevox.com` в Google — индексируется ли.

---

## 5. Известные ограничения / TODO для будущих деплоев

### 5.1. JS bundle size: 1.37MB

Vite предупреждает: основной bundle 1.37MB (386KB gzip). Это **многовато** для
оптимального Lighthouse Performance score. Будущая задача:

- Code-split через `manualChunks` в `vite.config.ts` (разделить React Router,
  framer-motion, livekit-client, lucide-react в отдельные chunks).
- Lazy-load роутов через `React.lazy()` + `Suspense`.

### 5.2. Полная SSR

Текущий prerender работает только для HEAD (title/meta/og/hreflang).
Body остаётся пустой `<div id="root">` до hydration. Для 90% краулеров этого
достаточно (Google рендерит JS), но:

- Bing, Yandex, соц-сети видят пустой body.
- Если в будущем появится marketing-блог — переходить на **Vike** (Vite SSR) или
  написать puppeteer-prerender (body тоже сгенерится).

### 5.3. Rate limiting

Если ещё нет — **БЛОКЕР для прода**. Auth endpoints без rate limit — рай для
брутфорса. Использовать `express-rate-limit` или Cloudflare WAF.

### 5.4. Backup стратегия

Сейчас БД на `db_fallback.json` в dev. На проде должен быть managed PostgreSQL
(Neon/Supabase/Render) с автобэкапами + point-in-time recovery.

### 5.5. URL prefix /{lang}/ на прод-уровне

Сейчас:
- Bot заходит на `/es/billing` → сервер отдаёт `dist/es/auth/login/index.html` ✓
- User заходит на `/es/billing` → SPA bootstraps → `LangPathSync` снимает префикс → URL становится `/billing`.

**Если хочется чтобы URL ОСТАВАЛСЯ `/es/billing` после hydration** (для real
language-routing) — нужно расширить роутер React Router 7 с mirror-routes под
`/:lang/*`. Это отдельная задача (см. `PROJECT_NOTES.md` v0.10.21 →
«Что НЕ сделано»).

### 5.6. Cookies for OAuth

Google OAuth callback использует cookies — на проде должны быть **SameSite=Lax**
или **None+Secure**. Проверить в коде `apps/backend/src/modules/auth/google.ts`.

### 5.7. CSP (Content Security Policy)

Сейчас CSP не настроена. На проде надо добавить:
- `default-src 'self'`
- `script-src 'self' 'unsafe-inline' https://telegram.org https://*.stripe.com`
- `connect-src 'self' wss://*.livekit.cloud https://api.openai.com ...`
- `img-src 'self' data: blob: https:`

Чтобы не XSS-нули, и Lighthouse Best Practices не ругался.

---

## 6. Шпаргалка: deploy-целевые платформы

| Платформа | Frontend | Backend | DB | Стоимость (старт) |
|---|---|---|---|---|
| **Vercel** | ✅ (статика + edge fn) | ❌ (нужно отдельно) | — | Hobby бесплатно |
| **Netlify** | ✅ (статика) | ✅ (functions) | — | Free 100GB/мес |
| **Cloudflare Pages** | ✅ (статика) | ✅ (Workers) | D1 | бесплатно |
| **Render** | ✅ | ✅ (Node services) | PostgreSQL | от $7/мес |
| **Fly.io** | ✅ (через Docker) | ✅ (Docker) | PostgreSQL | от $1.94/мес |
| **AWS Amplify** | ✅ | Lambda | RDS | pay-per-use |
| **Self-host nginx + PG** | ✅ | ✅ | local PG | VPS $5/мес |

**Текущая рекомендация**: **Vercel (frontend) + Render (backend) + Neon
(serverless PG)**. Всё бесплатно/дёшево на старте, легко скалится.

---

## 7. VibeVox ↔ Chatwoot мост (CW-SSO) — деплой по-правильному

Кнопка «Чат» в комнате ведёт бесшовно в Chatwoot (форк на `app.vibevox.pro`), а не во
внутренний `RoomChatPage`. Регистрация только в VibeVox; аккаунты/юзеры Chatwoot
заводятся автоматически (Platform API), вход без пароля (SSO-ссылка). Ветка
`feat/omnichannel-chatwoot`. Код: `modules/channels/chatwoot_platform.ts` (провижн+SSO),
`chatwoot_bridge_router.ts` (`GET /api/chatwoot-bridge/open`), `RoomPage.openChat`.

### 7.1. Обязательно для прода (иначе костыли/баги)

- **Реальный PostgreSQL, НЕ fallback-JSON.** `DB_DISABLE_FALLBACK=true`, `NODE_ENV=production`.
  Один раз `npm run db:setup`; ALTER-миграции (`tenants.chatwoot_account_id`, таблица
  `chatwoot_users`) применяются на старте сервера. Без БД маппинги account/user НЕ
  персистятся → плодятся аккаунты, 2-й клик падает в внутренний чат.
- **Глобальный конфиг Chatwoot** (один инстанс на платформу; `systemConfig`/env):

  | Переменная | Зачем |
  |---|---|
  | `CHATWOOT_API_URL=https://app.vibevox.pro` | база для Platform API / SSO / deep-link |
  | `CHATWOOT_PLATFORM_TOKEN` | Platform App token (super_admin → Platform Apps). Создаёт accounts/users + SSO-ссылки. Пусто → мост выключен (фронт откат на внутренний чат) |
  | `CHATWOOT_API_TOKEN`, `CHATWOOT_WEBHOOK_SECRET` | inbound Agent Bot (уже было) |

### 7.2. Модель аккаунтов (важно)

- **ВСЕ аккаунты Chatwoot создаёт Platform App.** Platform App видит ТОЛЬКО то, что
  создал сам → аккаунты/юзеры, заведённые вручную через UI, ему невидимы (SSO им не выдать).
- Ручной bootstrap-аккаунт **#2** (владелец, web-виджет) Platform App'ом НЕ управляется.
  Решить перед продом: мигрировать его в API-аккаунт ИЛИ оставить #2 под супер-админ-ручное,
  а владельца-как-тенанта провижинить заново.
- Email агента VibeVox не должен совпадать с уже существующим вручную Chatwoot-юзером
  (иначе создание юзера = 422 → мягкий откат на внутренний чат).

### 7.3. SSO / бесшовность

- Вход = одноразовая ссылка `GET /platform/api/v1/users/:id/login` (НЕ cookie-sharing:
  домены разные, `vibevox.pro` ≠ `app.vibevox.pro`).
- ⚠️ SSO приземляет на **дашборд аккаунта**, не на конкретный диалог. Deep-link на диалог
  клиента = Фаза 3.
- ⚠️ Chatwoot отдаёт `X-Frame-Options: SAMEORIGIN` + cookie `SameSite=Lax` → встроить его
  в iframe с чужого origin НЕЛЬЗЯ. Для seamless-iframe нужен reverse-proxy под тем же origin
  ЛИБО (это наш форк) патч заголовка.

### 7.4. Кнопка «← VibeVox» в Chatwoot

Лучшее место — **патч UI нашего форка Chatwoot** (компонент шапки/сайдбара), ссылка на URL
VibeVox. Не iframe (см. 7.3).

### 7.5. Провижининг

В проде вешать на **активацию/оплату Enterprise** (где tenant становится Enterprise), а не
лениво на 1-й клик «Чат».

### 7.6. TODO до полного качества

- **Фаза 2** — зеркалить реплики видеозвонка В диалог Chatwoot (сейчас создаётся только
  контейнер диалога «VibeVox Видеозвонок»).
- **Фаза 3** — deep-link на диалог + кнопка «← VibeVox».
- Пока мост не готов — держать за фич-флагом (`config/features.ts`).
- Фикс легаси `pushRoomToChatwoot` (хардкод `accountId=1`) → брать провижиненный account.

---

*Последнее обновление: 2026-05-31 — добавлен §7: Chatwoot-мост (CW-SSO) — требования к прод-деплою. (2026-05-28 — полный SEO-стек.)*
