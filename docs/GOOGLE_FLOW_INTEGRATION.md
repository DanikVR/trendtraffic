# Google Flow ↔ Chrome-расширение — интеграция

Полная документация блока **«Google Flow»** в TrendFlow и Chrome-расширения
`TrendTraffic ↔ Google Flow`, которое связывает наш сервис с **настоящим**
Google Flow (Veo) на `labs.google/fx/tools/flow`.

Актуальные версии на момент документа: **приложение v1.6.135**, **расширение v0.2.8**.

---

## 1. Цель

Дать пользователю (Enterprise-тенанту) работать с Google Flow **в его собственном
Google-аккаунте и подписке**, но не выходя из логики TrendTraffic:

- ставить промпты в очередь и получать готовые Veo-клипы обратно в Галерею;
- обмениваться медиа между нашей Галереей и Flow в обе стороны;
- локально собирать «Комментатор»-ролики (аудио → сегменты → визуалы) без Flow.

**Пер-тенантно по своей природе:** расширение крутится под Google-аккаунтом клиента,
Veo оплачивается его подпиской, а не нами (API Veo — $0.10/сек, поэтому отвергнут).

---

## 2. Почему расширение, а не API / iframe

- **API Veo дорогой** ($0.10/сек) — платить за каждого клиента невыгодно.
- **iframe невозможен:** `accounts.google.com` шлёт `X-Frame-Options: DENY`,
  storage partitioning и блокировка OAuth в webview делают встраивание тупиком
  (проверено и отклонено).
- **Официального API у Flow нет.**

→ Единственный рабочий путь — **Chrome-расширение (MV3)**, которое работает как
«обычный пользователь» прямо на живой странице Flow в браузере клиента.

Раздаётся **приватно** (`.zip` → *Load unpacked*), без Chrome Web Store.

---

## 3. Архитектура (компоненты)

```
┌─────────────────── Браузер клиента ───────────────────┐
│                                                        │
│  Вкладка app.trendtraffic.pro (наш SPA)                │
│    • блок «Google Flow» (FlowExtPanel)                 │
│    • Галерея (GalleryPage) — кнопка «→ Flow»           │
│    • content-bridge.js  ← content-script расширения    │
│                    │ window.postMessage                │
│                    ▼                                    │
│  Service Worker расширения (background.js)             │
│    • хранит JWT+apiBase, поллит очередь, ingest,       │
│      fetch-bytes, push-to-flow                         │
│                    ▲ chrome.runtime.sendMessage        │
│                    │                                   │
│  Вкладка labs.google/.../flow (живой Flow)             │
│    • content-flow.js — панель + автоматизация          │
│    • injected.js (MAIN-world) — перехват fetch/XHR     │
│                                                        │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS (JWT + Enterprise)
                           ▼
                 Бэкенд /api/flow-ext/* (наш VPS)
                 • очередь задач (Postgres flow_ext_tasks)
                 • приём медиа → Галерея (folder='flow')
                 • список медиа Галереи, recon
```

**Файлы расширения** (`apps/trendtraffic-extension/` — ЕДИНОЕ расширение Flow + NotebookLM;
раньше был отдельный `apps/flow-extension`, удалён — Flow-скрипты перенесены байт-в-байт):

| Файл | Мир | Роль |
|------|-----|------|
| `manifest.json` | — | MV3, права, host_permissions, content-scripts (Flow + NotebookLM + наш домен) |
| `src/background.js` | service-worker | ОБЕ очереди: Flow (`/api/flow-ext/*`) + NotebookLM (`/api/notebooklm-ext/*`) |
| `src/content-flow.js` | Flow (isolated) | панель поверх Flow + вся автоматизация (заливка/забор медиа) |
| `src/injected.js` | Flow (MAIN) | перехват `fetch/XHR` Flow → разведка эндпоинтов + bearer |
| `src/content-notebook.js` | NotebookLM (isolated) | панель + командный роутер + студия артефактов |
| `src/injected-nlm.js` | NotebookLM (MAIN) | перехват `fetch/XHR` NotebookLM → разведка + bearer |
| `src/content-bridge.js` | наш домен | мост SPA ↔ background (авто-передача JWT, обслуживает обе очереди) |
| `README.md` | — | краткая инструкция установки |

> Про NotebookLM-часть и бэкенд `/api/notebooklm-ext` — отдельный документ `docs/HOTEBOOK_EXTENSION.md`.

**Наш код:**

| Область | Файлы |
|---------|-------|
| Бэкенд | `apps/backend/src/modules/flow-ext/router.ts`, регистрация в `server.ts` |
| Блок в сценарии | `apps/frontend/src/pages/flow/FlowExtPanel.tsx`, `CommentatorPanel.tsx`, `DialogueTimeline.tsx`, `dialogueTypes.ts`, узел `'flow'` в `MontageEditor.tsx` |
| Галерея | `apps/frontend/src/pages/GalleryPage.tsx` (кнопка «→ Flow») |
| Карточка скачивания | `apps/frontend/src/pages/enterprise/Section7OpenMontage.tsx` (вкладка «Генерация») |
| Версия расширения | `TT_EXT_VERSION` в `apps/frontend/src/components/AppVersion.tsx` |
| Раздача `.zip` | `apps/frontend/public/trendtraffic-extension.zip` (Vite → dist → nginx `/trendtraffic-extension.zip`) |

---

## 4. Протокол сообщений

**SPA → расширение** (через `window.postMessage`, метка `source:'trendtraffic'`):

- `connect { token, apiBase }` — ручное «Подключить» (фолбэк).
- `disconnect`
- `status` — запрос статуса.
- `push-to-flow { url, title, kind }` — из Галереи: залить медиа в Flow.

**Расширение → SPA** (метка `source:'tt-flow-ext'`):

- `present { version }` — расширение установлено.
- `connected { ok, apiBase }` / `disconnected`
- `status { connected, apiBase, pausedUntil }`
- `push-to-flow-result { ok, error }`

**content-flow / content-bridge → background** (`chrome.runtime.sendMessage`):

- `tt-connect / tt-disconnect / tt-status`
- `bearer { token }` — перехваченный bearer Flow (на будущее).
- `api-recon { data }` — сетевой запрос Flow (разведка).
- `manual-ingest { sourceUrl|dataUrl, title, kind }` — «В галерею».
- `gallery-list` — список видео/картинок Галереи.
- `fetch-bytes { url }` — скачать байты в контексте расширения (обход CORS страницы).
- `send-recon { data, url }` — снимок вёрстки Flow.
- `push-to-flow { url, title, kind }` — открыть Flow и залить медиа.

**background → content-flow:**

- `ping` / `run-task { task }` / `inject-url { url, title, kind }`

**Авто-подключение (v0.2.2+):** `content-bridge` сам читает JWT из
`localStorage['vibevox_token']` SPA (на загрузке / focus / раз в 15 с) и отдаёт его в
background — кнопку «Подключить» жать не нужно, пока клиент залогинен в TrendTraffic.
Токен персистится в `chrome.storage`, поэтому держится даже с закрытой вкладкой SPA.

---

## 5. Бэкенд: `/api/flow-ext/*`

Роутер: `apps/backend/src/modules/flow-ext/router.ts`. Гейт: `requireAuth` (JWT) +
`requireEnterprise`. Таблицы `flow_ext_tasks`, `flow_ext_recon` (inline-init).

> **ВАЖНО (баг HTTP 413):** роутер смонтирован **ДО глобального `express.json()`** в
> `server.ts` со своим лимитом `express.json({ limit: '700mb' })`. Если смонтировать
> после — глобальный парсер (~100 КБ) режет тело и отдаёт 413 на «В галерею». Любой
> роут с base64-телом монтировать выше `app.use(express.json())`.

| Метод | Путь | Кто | Назначение |
|-------|------|-----|------------|
| POST | `/enqueue` | узел TrendFlow | положить промпты в очередь `{items:[{prompt,title?,references?,settings?}], flowId}` |
| GET  | `/tasks` | расширение | атомарно захватить queued→running (реанимация «зависших» >15 мин) |
| POST | `/status` | расширение | обновить статус задачи (`running/retry/failed`; `retry`→`queued`) |
| POST | `/ingest` | расширение | готовый клип задачи → Галерея `folder='flow'`, задача→done |
| POST | `/ingest-manual` | расширение | произвольное медиа (В галерею), без taskId; `kind=image` → картинка |
| GET  | `/gallery` | расширение | список ВИДЕО+КАРТИНОК тенанта (абсолютные URL, `type`) для «Из Галереи» |
| POST/GET | `/recon` | расширение | снимок вёрстки Flow (1 запись/тенант) для подстройки селекторов |
| GET  | `/list` | узел TrendFlow | статусы задач для UI |
| POST | `/clear` | узел TrendFlow | убрать done/failed |

**Сохранение входящего медиа:** `storeIncomingVideo` (CDN-ссылка → `downloadVideoToDisk`
с referer `labs.google`, либо base64 dataUrl) и `storeIncomingImage`/`downloadImageToDisk`
(картинки, `mediaType='image'`, расширение по mime). Всё в `uploads/source-videos/`,
ассет `kind='reference'`, `folder='flow'` → попадает в Галерею на вкладку «Google Flow».

---

## 6. Два режима блока «Google Flow»

Панель `FlowExtPanel` — две вкладки:

### 6.1 «Клипы» (расширение → живой Flow)
1. Установка/подключение расширения (или авто-подключение).
2. Промпты (по строке = клип) или «Взять из Omni» → «Отправить в Flow» (`/enqueue`).
3. `background` поллит `/tasks`, для каждой задачи открывает/находит вкладку Flow →
   `content-flow` печатает промпт, жмёт «Генерировать», ждёт клип.
4. Готовый клип → `/ingest` → Галерея «Google Flow». Статусы в очереди (авто-поллинг 5 с).
5. **Анти-бот пейсинг** (обязателен): пауза 25–70 с между генерациями, при баннере
   «unusual activity» — пауза 20 мин. Значения в начале `background.js`, не убирать.

### 6.2 «Комментатор» (локально, без Flow) — путь Г1
Загруженное аудио = финальный голос, на каждый диаризованный сегмент — визуал
(картинка Ken Burns / Omni-клип / текст на тёмном фоне). Собирается локальным ffmpeg
(`composeCommentator` в `podcast_compose.ts`), падает в Галерею «Google Flow».
Редактор сегментов — общий с подкастом компонент `DialogueTimeline`. Состояние живёт
в `graph.flow.commentator`, сборка идёт в фоне (кольцо у узла), результат — в панели.
Аудио выбирается через единый `GalleryPicker` (+ удаление со сбросом таймлайна/реплик).

---

## 7. Двусторонний обмен Галерея ↔ Flow

Кнопки прямо в панели расширения на Flow + кнопка в нашей Галерее.

- **⬆ «В галерею»** (Flow → нас): забрать текущее медиа из Flow в Галерею.
  Выбор: кликнул медиа в Flow ≤12 с → берётся оно; несколько на экране → **пикер
  превьюшек** в панели (клик по миниатюре) + подсветка выбранного. Байты качаются
  в браузере (страница/`fetch-bytes`), → `/ingest-manual`.
- **⬇ «Из Галереи»** (нас → Flow): список медиа Галереи (`/gallery`) → выбор →
  `fetch-bytes` → File → в поле загрузки Flow. Есть ссылка «Открыть полную Галерею».
- **Кнопка «→ Flow» в нашей Галерее** (`GalleryPage`) на каждом видео/фото:
  - расширение установлено → медиа отправляется в Flow (`push-to-flow`);
  - не установлено → поп-ап «Скачать расширение» + инструкция.
- **Авто-открытие проекта:** поле загрузки в Flow есть **только внутри проекта**
  (`/project/...`), а не на списке. Если картинку шлют со списка — `openProject()`
  сам кликает «Создать проект»/карточку, ждёт SPA-роут и вставляет. Устойчивость к
  перезагрузке: `pendingInject` в `chrome.storage` + `resumePendingInject` доводит
  вставку при загрузке в проект (одна попытка, без циклов).

---

## 8. Ключевые проблемы и решения (журнал)

Хроника реальных багов, найденных на живом Flow, и как решены — чтобы не наступать снова.

1. **iframe невозможен** → путь B (расширение). Отчёт честный: DENY / partitioning / OAuth.
2. **Панель пропадала после логина** — Flow редиректит на `/fx/ru/tools/flow` (локаль) →
   в manifest добавлен матч `/fx/*/tools/flow*`. Требует перезагрузки расширения (↻).
3. **rate-limiter IPv6 ValidationError** — `keyGenerator: (req)=>req.tenantId||'anon'` (не `req.ip`).
4. **Хрупкое рукопожатие «Подключить»** → **авто-подключение** из `localStorage['vibevox_token']`.
5. **HTTP 401 при «В галерею»** — видео Flow на `flow-content.google` (редирект от
   `labs.google/fx/api/trpc/media.getMediaUrlRedirect`) за авторизацией Google; наш
   сервер их скачать не мог. → байты качает **само расширение** в браузере клиента
   (`pageFetchDataUrl` из страницы — CDN отдаёт `Access-Control-Allow-Origin: *`, берём
   БЕЗ credentials; фолбэк `background fetch-bytes` с/без cookie) → dataUrl → на сервер.
6. **HTTP 413** — `/api/flow-ext` стоял ПОСЛЕ глобального `express.json()` (~100 КБ) →
   тот резал тело. Перенесён ВЫШЕ + лимит `700mb`; **nginx `client_max_body_size` 210M→700M**.
7. **Видео не встраивалось** — разведка (`/recon`) показала: у Flow одно поле
   `input accept="image/*"` (только внутри проекта). → заливка **умная по типу**
   (`findFileInput(kind)`): картинку в image-поле; **видео НЕ втыкаем** в image-поле
   (иначе ошибка «Графический формат не поддерживается»).
8. **Видео → Flow** решено обходом: на видео кнопка «→ Flow» **скачивает файл + поп-ап**
   со стрелкой «Скачано ➜ Flow «Загрузки»» (Flow принимает видео только вручную).
9. **«Поле не найдено» на списке проектов** — поле только внутри проекта → `openProject()`.
10. **«В галерею» брала не то** — было «крупнейшее»; теперь клик-приоритет + пикер превью.
11. **Панель уезжала в моб-режиме** — прижимаем к вьюпорту при `resize`.

---

## 9. Лимиты и ограничения

**Лимиты веса медиа:** расширение качает до **500 МБ**, сервер `INGEST_JSON_LIMIT='700mb'`
(base64 ×1.37 ≈ 500 МБ реального файла), nginx `client_max_body_size 700M`.

**Чего НЕЛЬЗЯ (ограничения самого Flow/Veo, не обойти расширением):**
- **Video-to-video** — у Veo нет переработки видео нейросетью. Залитое видео можно только
  положить в проект/продлить. Настоящая переработка видео = Runway/Kling (роадмап, ключ fal.ai есть).
- **Deep-link прямо в диалог загрузки** — Google такого URL не даёт; ведём на страницу проектов.
- **Точные селекторы Flow нестабильны** — держимся на эвристиках + авто-разведке (`/recon`).

**Итог двустороннего обмена:** картинки ходят в обе стороны (нас↔Flow); видео Flow→нас
(«В галерею») работает; видео нас→Flow = скачать + ручная загрузка в «Загрузки».

---

## 10. Авто-разведка (`/recon`)

Как только расширение подключено, оно **само** снимает вёрстку Flow (кандидаты поля
промпта, кнопки генерации, `input[type=file]` + их `accept`, video-элементы, виденные
эндпоинты) и шлёт `POST /api/flow-ext/recon` (1 запись/тенант). Кнопка «разведка вёрстки»
в панели — снять вручную. Читать: `GET /api/flow-ext/recon` или прямо в БД:

```sql
-- на VPS: sudo -u postgres psql -d vibevox_db
SELECT jsonb_pretty(data->'fileInputs') FROM flow_ext_recon ORDER BY updated_at DESC LIMIT 1;
SELECT url, updated_at FROM flow_ext_recon ORDER BY updated_at DESC LIMIT 1;
```

Именно так найдено, что поле загрузки Flow — `image/*` и только внутри проекта.

---

## 11. Обслуживание

**Обновление расширения у клиента (unpacked):**
`chrome://extensions` → удалить старую карточку → скачать свежий `.zip`
(Настройки → Генерация → «Скачать расширение», или `app.trendtraffic.pro/trendtraffic-extension.zip`)
→ распаковать в новую папку → «Загрузить распакованное». В шапке панели — номер версии.
Обновить вкладку `app.trendtraffic.pro` (F5), чтобы подхватился новый `content-bridge`.

**Дисциплина версий (важно!):** при каждом релизе расширения бампать **обе**:
`manifest.json` `version` **и** `TT_EXT_VERSION` в `AppVersion.tsx` (иначе карточка
«Скачать» покажет старую версию), + пересобрать `apps/frontend/public/trendtraffic-extension.zip`.

Пересборка zip (Windows, `tar.exe`=bsdtar даёт форвард-слэши — читают и Chrome, и `unzip`):
```powershell
cd apps\trendtraffic-extension
tar.exe -a -c -f ..\frontend\public\trendtraffic-extension.zip manifest.json README.md src
```
> Альтернатива `Compress-Archive` пишет пути с обратными слэшами — Windows/Chrome читают,
> но Linux `unzip` их не находит. `tar.exe -a` этого лишён → предпочтительнее.

**Деплой:** `git push origin <branch>:main` → SSH `root@72.62.0.184`
`git reset --hard origin/main && bash deploy/vps-redeploy.sh`. При изменении лимитов —
поднять `client_max_body_size` в `/etc/nginx/sites-available/trendtraffic` + `nginx -s reload`.
Проверка: версия в бандле, размер раздаваемого `/trendtraffic-extension.zip` == локального,
`/api/flow-ext/*` и `/api/notebooklm-ext/*`→401 (роуты живы), публичный HTTPS→200.

---

## 12. История версий расширения

- **0.1.0** — каркас: очередь/поллинг/пейсинг, панель, MAIN-world разведчик, оба content-script.
- **0.2.0** — двусторонний обмен: «В галерею»/«Из Галереи» + авто-разведка (`/recon`).
- **0.2.1** — «В галерею» берёт и картинки (не только видео); клик-приоритет.
- **0.2.2** — авто-подключение из `localStorage`; бегущая лента-индикатор; «Открыть TrendTraffic»→/flow.
- **0.2.3** — фикс 401: байты качает расширение (credentials); host_permissions расширены.
- **0.2.4** — глубокий поиск медиа (shadow-DOM), 3-путёвая закачка, моб-панель, кликабельный статус.
- **0.2.5** — кнопка «→ Flow» в Галерее (push-to-flow/inject-url), «Из Галереи»→полная Галерея.
- **0.2.6** — умная заливка по типу (видео vs image-поле), чистые имена файлов, лимит 500 МБ.
- **0.2.7** — выбор «В галерею» превьюшками + подсветка; подсказки «открой проект».
- **0.2.8** — авто-открытие проекта для картинки + `pendingInject`/resume при перезагрузке.

Пофичевый разбор по версиям приложения — в чейнджлоге `AppVersion.tsx` (1.6.90…1.6.135,
искать «Google Flow»/«Комментатор»/«flow»).
