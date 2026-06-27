# TrendTraffic — Энциклопедия проекта

> Единый справочник: что это, что реализовано, как работает, что дальше. Живой документ —
> обновляй после каждого блока. Версия приложения — в `apps/frontend/src/components/AppVersion.tsx`
> (`APP_VERSION`), футер «© TrendTraffic.pro v…». **Правило: бампать версию при каждом изменении**
> (перенос при 10: 1.0.9 → 1.1.0). Текущая: **v1.1.0**.

---

## 0. Что это

**TrendTraffic** — multi-tenant SaaS «контент-завод»: конвейер **тренд → готовый ролик → публикация**.
Построен поверх готового шаблона **VibeVox** (тот же стек: React+TS+Tailwind фронт, Node+TS+PostgreSQL
бэк, модульная архитектура, Stripe-биллинг, multi-tenant, AES-256-GCM шифрование секретов, фич-флаги,
i18n ~100 локалей, PWA). Репозиторий: `C:\GOOGLEDISK\trendtraffic`, git remote
`origin = https://github.com/DanikVR/trendtraffic.git` (ветка `main`).

**Конвейер:**
```
[1] TikHub.io        → сканируем тренды (ключевик/тренды/фильтры), скачиваем видео
       ↓
[2] OpenMontage      → производство ролика. Управление = визуальный редактор TrendFlow
   (calesthio)         (радиальная «паутина» узлов-процессов). На базе ffmpeg-инструментов.
       ↓
[3] Галерея / Контент-план → готовый ролик в Галерею, потом в календарь публикаций
       ↓
[4] Ayrshare         → публикация. Тариф Launch ($299/мес) = 10 профилей бренда.
                        Enterprise-тенант может подключить свой ключ Ayrshare.
```

**Меню приложения (после ребрендинга):** Тренды · Галерея · Публикатор · TrendFlow · Настройки
Enterprise · Админ-панель. Комнаты/видеоперевод и SIP **выключены** (`FEATURES.video=false`,
`FEATURES.sip=false`), домашняя `/` → редирект на `/trends`.

---

## 1. Окружение и КРИТИЧЕСКИЕ конвенции (читать первым делом)

- **Песочница ассистента БЕЗ исходящей сети** (curl/git push → HTTP 000). Поэтому: **код пишется и
  коммитится локально, пользователь сам пушит** (`git push -u origin main`) и запускает. Кнопки
  «Проверить»/health, скачивание, рендер — работают на машине пользователя, где сеть есть.
  WebFetch/WebSearch у ассистента работают (отдельный канал).
- **Суперадмин ходит с `tenantId = "global_admin"` — это НЕ UUID.** Многие per-tenant таблицы
  шаблона имеют `tenant_id UUID` → запросы суперадмина падают с `invalid input syntax for type uuid`
  (500). **Фикс-паттерн: новым таблицам ставим `tenant_id VARCHAR(64)` без FK на `tenants`.** Уже
  поправлено: `trends`, `source_videos`, `media_assets`, `flows` (ALTER + drop FK). Для BYO-ключей
  (tikhub.ts) — guard `isUuid(tenantId)`. **Остались 500 в консоли** у суперадмина на `billing/me`,
  `tenant-settings/gemini|chatwoot`, `mcp`, `quest-flow` — это тот же `global_admin`, не блокирует,
  «уборка консоли» отложена (предлагалось навесить UUID-guard).
- **Dev-запуск:** backend `cd apps/backend && npm run dev` (tsx watch, :3001), frontend
  `cd apps/frontend && npm run dev` (vite, :3000). Vite проксирует `/api` и `/uploads` → :3001.
  `JWT_SECRET` не задан → DEV-фолбэк (норм для локалки). Uploads лежат в `apps/uploads/...`.
- **workspace `@vibevox/shared`:** `node_modules/@vibevox/shared` мог прийти ПУСТЫМ (Google Drive sync)
  → backend не стартует (`Cannot find package …/index.js`). Фикс: собрать `packages/shared`
  (`npm run build -w @vibevox/shared`) и скопировать в `node_modules/@vibevox/shared` (package.json+dist).
- **tsx watch + порт:** при множественных перезапусках бывает `EADDRINUSE :3001` — убить залипшие
  node-процессы (`tsx`/`server.ts`) и поднять один чистый.
- **LF→CRLF warnings** при коммите на Windows — безвредны.
- **Версия:** бампать `APP_VERSION` при каждом изменении (правило выше).

---

## 2. Реализовано (по фичам — файлы и логика)

Коммиты (новые→старые): `40cce2c` baseline → `16eae87` TikHub key → `8d9e9e9` trends → `58736e8`
parse fix → `2c0fd44` retry+modes → `e6eccab` uuid guard → `ec86b2f` App V3 parse → `3710b46`
persist+icon → `d586fbf` 403 fix+bulk+TrendFlow → `9718251` nav drop rooms/add gallery → `b98375c`
gallery media library → `abc1b1b` TrendFlow card grid → `875f02a` montage editor v1 → `e692c26`
flows VARCHAR → `dba12c6` News preset → `779e9d2` button node config → `0a934f3` brand+version.

### 2.1. TikHub API-ключ (платформенный + Enterprise BYO + «Проверить»)
- `apps/backend/src/modules/tikhub/tikhub_client.ts` — типизированный Bearer-клиент. `tikhubGet`,
  `validateTikHubKey` (GET `/api/v1/tikhub/user/get_user_info` → статус+баланс), `searchVideos`,
  `fetchTrending`, `fetchOneVideo`, `extractDownloadUrls`, `normalizeVideos` (оборонительный разбор),
  `withTikhubRetry` (повтор транзиентного 400 «Request failed. Please retry»).
- Платформенный ключ — в `config/systemConfig.ts` (`tikhubApiKey`, маска, `getTikHubApiKey`). Проверка
  в админке: `POST /api/auth/verify-tikhub` (`auth/router.ts`) + карточка в `AdminConfigPage.tsx`.
- Enterprise BYO — `tenant_settings/tikhub.ts` (клон gemini-паттерна, AES-256-GCM, правило
  «Enterprise — только свой ключ»), роуты `/api/tenant-settings/tikhub*`, UI `enterprise/Section6TikHub.tsx`.
  Колонки `tenants.tikhub_api_key_encrypted/_status/_last_check` (миграции).
- **Подтверждено пользователем: ключ валиден, «Проверить» реально пингует.**

### 2.2. Анализатор трендов (страница «Тренды»)
- `apps/backend/src/modules/trends/{service.ts,router.ts}` + `modules/media/store_video.ts`.
- Таблицы `trends`, `source_videos` (`tenant_id VARCHAR`, дедуп unique `tenant+platform+external_id`).
- `POST /api/trends/scan` (kind keyword|trending; mode video|general|**app**; sortType; publishTime;
  count). **App V3 — рабочий режим по умолчанию** (web `fetch_search_video` стабильно отдаёт 400).
  Парсер берёт **непустой** массив (`search_item_list`, не пустой `aweme_list`). Сортировка «Новее»/
  «Лайки» — клиентская поверх relevance-набора (по `createTime`/likes; пользователь это доработал).
  Кол-во честное (slice до count).
- Скачивание: `POST /api/trends/videos/:id/download` → **свежий прямой URL через App V3
  `fetch_one_video`** (no-watermark, без cookie) + перебор кандидатов → стрим на диск
  `uploads/source-videos`. Фикс 403. UI — иконка загрузки (idle/спиннер/✓/ошибка), массовый выбор+скачать.
- `GET /api/trends/videos?downloaded=1` — для Галереи.
- Фронт: `pages/TrendsPage.tsx` (поиск/тренды, тип поиска кнопками, сортировка/период, грид, скачивание).

### 2.3. Галерея — медиа-библиотека
- `pages/GalleryPage.tsx` — **3 вкладки-папки**: **Тренды** (скачанные `source_videos`), **Референс**
  (загружаемые изображения/видео), **Аудио** (загружаемые аудио). Встроенный плеер, поиск, выбор,
  массовое удаление (ConfirmModal). Две иконки загрузки рядом с «Обновить» (Медиа/Аудио).
- Backend: таблица `media_assets` (kind reference|audio), `modules/media/assets.ts` (list/create/delete/
  bulk), роуты в `trends/router.ts`: `GET /api/trends/media?kind=`, `POST /media/upload?kind=` (multer →
  `uploads/reference` и `uploads/audio`, 200МБ), `DELETE /media/:id`, `POST /media/delete-bulk`.

### 2.4. Навигация / ребрендинг
- `config/features.ts` (фронт+бэк): `video=false, sip=false`; добавлены `trends, gallery, publisher`.
  `HOME_ROUTE_WHEN_NO_VIDEO='/trends'`. Убраны Комнаты/СИП + кнопка «Создать комнату»/FAB.
- Нав в `layouts/MainLayout.tsx` (desktopNav) **и** `components/BottomTabBar.tsx` (moreItems) — оба места.
- Роуты в `router.tsx` (lazy): `/trends`, `/gallery`, `/publisher`.
- `PublisherPage.tsx` — заглушка под этап Ayrshare.
- Футер `components/AppVersion.tsx` → «© TrendTraffic.pro v…»; **Botflow → TrendFlow** везде.

### 2.5. TrendFlow — список сценариев карточками
- `pages/FlowPage.tsx` — форк бот-флоу страницы в **карточную сетку** (как Higgsfield). Карточка
  «Создать сценарий» (+) → создаёт flow и сразу открывает редактор. Карточка сценария: брендовый
  герой (`public/trendflow-hero.svg` локальный фолбэк + higgsfield-кадр по CDN-URL), инлайн-
  переименование (✎), дата, статус-пилюля, **⋯-меню** (дублировать клиентски / черновик↔активен /
  удалить с ConfirmModal). Клик по карточке → редактор. Бот-канальные карточки (IG/TikTok/Messenger/
  аналитика) убраны. CRUD — через существующий `/api/flows` (Enterprise-gated, суперадмин bypass).

### 2.6. Редактор монтажа TrendFlow (радиальная «паутина»)
- `pages/flow/MontageEditor.tsx` — открывается из карточки сценария (заменил старый `FlowCanvas`).
- В центре светящееся «Видео из галереи», вокруг по лучам — **узлы-процессы** с линиями и hover-
  анимацией; **цепочка вокруг центра** (порядок узлов = порядок применения, без свободных связей).
- **Типы узлов (MKind):** news, research, length, format, silence, subtitles, audio, voiceover, color,
  broll, avatar, upscale, export — маппятся на инструменты OpenMontage (см. §4).
- **Настройка узла = КНОПКИ** (с умными дефолтами «не задумываясь»): Формат=9:16, Экспорт=
  TikTok+Reels+Shorts (мультивыбор), Длина=30с, Паузы=вырезать, Субтитры=по словам/низ, Аудио=
  средне/дакинг, Озвучка=женский и т.д. Опц. текстовое поле + 📎 «Прикрепить из Галереи» (только где
  нужно: аудио/озвучка/цветокор/b-roll/аватар) + ✨ЛЛМ-тумблер (платный шаг, по умолч. выкл) +
  кнопка **«Готово»**. На узле значки 📎/✨.
- **Применённые процессы — чипами сверху** (название + ✎, открывает узел).
- **Нижняя строка «Добавить параметр или процесс»** + «+» → диалог выбора процесса (добавляет узел).
- **Пресеты (витрина при пустом сценарии):** группы × 3 — **Новости** (RSS/Telegram/сайт), Короткие
  ролики, Говорящие, Постановочные, Сервисные. Выбор → паутина заполняется узлами с дефолтами.
- **Узел «Новости»** (источник RSS/Telegram/сайт/рубрика → текст+фото). Сама выборка текста+фото из
  источников — **отдельный блок, делаем позже** (RSS-парсер/Telegram/скрапер + пакетная генерация).
- **Хранение:** граф в `flows.graph.nodes` (JSONB), узел = `{id,type:'montage',data:{kind,text,
  mediaUrl,mediaName,useLlm,choices}}`. Сохранение `PUT /api/flows/:id`, кнопка «Сохранить».
- **«Собрать»** — пока заглушка (рендер — этап деплоя, см. §5).

---

## 3. Внешние сервисы — ключевые факты (сверено по докам)

- **TikHub.io:** один Bearer-ключ, pay-as-you-go ($0.001–0.01/запрос), синхронный. Ссылки на видео
  **истекают** (качать сразу). Web-поиск нестабилен (400), **App V3 `fetch_video_search_result` —
  рабочий**, есть фильтры sort_type/publish_time. Скачивание без вотермарка — через App V3
  `fetch_one_video`. Юр. ответственность за перезалив — на нас.
- **Ayrshare:** тариф **Launch $299/мес = 10 User Profiles (= 10 брендов)**; профиль подключает много
  соцсетей. `POST /api/post` (publish/schedule, `scheduleDate` UTC ISO `Z`), Profile-Key на тенанта,
  `generateJWT` для подключения соцсетей (SSO-ссылка, TTL 5 мин), вебхуки статусов. Модель: единый
  наш аккаунт + профиль на тенанта; Enterprise — может свой ключ. **Ещё не реализовано** (этап
  «Публикатор» + контент-план).
- **Контент-календарь:** выбран **FullCalendar** (MIT, drag&drop, таймзоны). **Ещё не реализовано.**

---

## 4. OpenMontage — как устроен и как мы его оборачиваем

- **Агентный, без оркестратора и без API/CLI.** ИИ-ассистент по программированию читает «скиллы» и сам
  вызывает Python-инструменты (`from tools.tool_registry import registry; tool.execute(inputs)→ToolResult`).
  Лицензия **AGPLv3** (юр-флаг при сетевом доступе тенантов — решение: запускать как отдельный
  процесс/сервис, быть готовым открыть исходники обёртки).
- **МЫ заменяем их агента детерминированным графом** (узлы TrendFlow) + опц. **ЛЛМ-директором** для
  умных шагов (ресёрч, выбор момента, сценарий). Каждый узел = вызов `tool.execute(параметры узла)`.
- **52 инструмента** (48 python). **Бесплатная CPU-цепочка** ($0, без ключей, ffmpeg):
  `video_downloader`(yt-dlp) → `transcriber`(faster-whisper, CPU int8) → `video_trimmer`/`silence_cutter`
  → `auto_reframe`(MediaPipe/OpenCV, без GPU) → `subtitle_gen` → `audio_mixer`/`piper_tts` →
  `color_grade` → `video_compose`/`video_stitch`. Remotion/HyperFrames (Node) — опц. для анимир.
  субтитров, иначе ffmpeg-фолбэк.
- **Узел → инструмент (карта):** Длина→`video_trimmer` (start/end/speed) [+ЛЛМ выбор момента по
  транскрипту]; Формат→`auto_reframe` (target_aspect portrait/landscape/square/4:5/cinematic) +
  `video_compose.profile` (media-profiles: tiktok/reels/shorts 1080×1920, youtube 1920×1080, …);
  Паузы→`silence_cutter`; Субтитры→`subtitle_gen`/`remotion_caption_burn`; Аудио→`audio_mixer`
  (tracks/ducking/volume); Озвучка→TTS selector (ElevenLabs/OpenAI/Google; **Piper локально бесплатно**);
  Цветокор→`color_grade` (profile/LUT); B-roll→`clip_search`/overlay; Аватар→talking-head
  (HeyGen облако / SadTalker-Wav2Lip локально GPU); Апскейл→`upscale` (Real-ESRGAN, GPU); Экспорт→
  `video_compose` (media profile, мультиплатформа).
- **Длина ролика** задаётся явными in/out таймкодами (не единый target). **Формат** — media-profile +
  auto_reframe. **12 пайплайнов** (clip-factory, animated-explainer, podcast-repurpose, talking-head,
  avatar-spokesperson, cinematic, documentary, screen-demo, localization-dub, hybrid, animation,
  character-animation) — у нас это **пресеты** (выбор кнопкой / ЛЛМ-подсказка).
- **Выбор нейросети:** в OpenMontage — авто-скоринг (7 измерений) + подтверждение агентом. **У нас —
  явный выпадающий список провайдера в генеративном узле + рекомендованный дефолт; ключ из админки/
  Enterprise BYO.**
- **Бюджет:** `cost_tracker` (лимит $10, одобрение > $0.50, estimate→reserve→reconcile). **У нас —
  оценка стоимости на платном узле + счётчик «потрачено/лимит» + запрос одобрения.**
- **Веб-ресёрч** — «first-class stage» (агент ищет в YouTube/Reddit/HN/новостях, цитирует источники).
  **У нас — узел «Исследование»** (ЛЛМ + веб-поиск с источниками).
- **Аватар/UGC:** HeyGen (облако) / SadTalker/MuseTalk + Wav2Lip (локально GPU); опц. Higgsfield Soul.

---

## 5. План деплоя / инфраструктуры (двухуровневая)

- **VPS Hostinger KVM2** ($8.99 · 2vCPU/8GB/80GB, Ubuntu 24.04) = веб-приложение + оркестратор +
  очередь **pg-boss** (на Postgres) + **бесплатный CPU-монтаж** (ffmpeg-цепочка). KVM-планы CPU-only,
  GPU нет. (KVM4 — если параллель/large-v3 Whisper.)
- **GPU-воркер = домашний ПК пользователя: RTX 5080 16GB, 64GB RAM, Win11.** Только тяжёлое:
  апскейл, аватар, локальная видео/картинка-ген, быстрый Whisper. Бесплатно локально. Нужен CUDA 12.8+
  и PyTorch cu128 (Blackwell), рекомендуется WSL2+Docker. Тянет 16GB: Whisper large-v3, Real-ESRGAN,
  SadTalker/Wav2Lip, SD/FLUX, LTX-Video/CogVideoX-5B/WAN-1.3B; WAN-14B/Hunyuan — только с offload.
- **Связь дом↔VPS — Tailscale** (бесплатная mesh-VPN, без проброса портов/публичного IP). Воркер берёт
  GPU-задачи из очереди по `100.x` адресу. Файлы — через `/uploads` API.
- **Облачный GPU-фолбэк** (когда дом выключен): Modal / RunPod serverless (посекундно), Vast.ai
  (дешевле), Replicate (проще). 
- **Переключатель GPU** в админке: `Дом (RTX 5080)` / `Облако` / `Выкл` — роутер рендера шлёт GPU-шаги
  туда, куда выбрано (дом недоступен → фолбэк облако). **Встраивать сразу при стройке рендера.**
- **OpenMontage на VPS — только CPU-цепочка:** `apt install ffmpeg` + `pip install -r requirements.txt`
  + `pip install yt-dlp faster-whisper mediapipe opencv-python piper-tts` (эти НЕ в requirements!).
  **НЕ ставить torch / `make install-gpu`.** Диск ~2–3 ГБ. Гейтить инструменты по
  `ResourceProfile.vram_mb == 0`, чтобы GPU-tools не попали на CPU-VPS.
- **«Собрать» → поток:** `flows.graph` → задача в pg-boss → маршрут шагов (CPU на VPS / GPU на воркер /
  платные облачные по ключу) → `tool.execute(params)` → `output_path→input_path` → готовый ролик в
  Галерею → контент-план/публикатор.
- Деплой приложения — по `docs/DEPLOY_HOSTINGER_VPS.md` (Node 20, локальный Postgres, nginx, `.env`,
  `npm run db:setup`, бэкап `deploy/pg-backup.sh`). Домен **trendtraffic.pro** → A-запись на VPS IP.

**Статус инфры:** VPS Hostinger развёрнут (`72.62.0.184`, скрипт `deploy/vps-bootstrap.sh` — веб+Postgres+nginx+ffmpeg+python venv, БЕЗ torch/OpenMontage); Tailscale **ещё не настроен** (план — отдельная инструкция). Код Этапа D начат: **скелет очереди рендера готов** (см. ниже), Python-обёртка OpenMontage и GPU-воркер — следующие.

**Скелет очереди рендера (готово, v1.1.0):** модуль `modules/render/*` — лёгкая Postgres-очередь
(`render_jobs`, `tenant_id VARCHAR`, атомарный claim `FOR UPDATE SKIP LOCKED`, БЕЗ внешних зависимостей;
тонкий слой, заменяется на pg-boss при деплое). Поток: `planner` (граф flow → `RenderStep[]`, карта
kind→инструмент OpenMontage + cpu/gpu) → `store.insertJob` → `worker` (поллер, single-flight) →
`executor` (seam: сейчас `SimulationExecutor`-скелет, реальный OpenMontage-HTTP — следующий блок) →
финал в `render_jobs`. Маршрут GPU-шагов (avatar/upscale) по переключателю `getRenderGpuTarget()`
(`home|cloud|off`, в `systemConfig`); при `off` GPU-шаги пропускаются. Эндпоинты `/api/render/*`
(POST `/flow/:flowId`, GET `/`, GET `/:id`, GET `/config/gpu`). **Проверено сквозным тестом** (план →
очередь → воркер → done; GPU-шаг при `off` корректно skipped). **Осталось:** фронт-привязка кнопки
«Собрать» + статус, карточка переключателя GPU в админке, вкладка «Готовые» в Галерее, затем Python-
воркер OpenMontage (FastAPI CPU) на VPS и GPU-воркер на RTX 5080.

---

## 6. Что осталось построить (roadmap)

1. **Рендер «Собрать»** (этап D/E): pg-boss очередь в backend; Python-обёртка OpenMontage (FastAPI-
   воркер, CPU-цепочка) на VPS; GPU-воркер на RTX 5080; переключатель GPU в админке; маршрутизация
   шагов; «Собрать» → очередь → готовый ролик в Галерею.
2. **Контент-план (календарь)** на FullCalendar: таблицы `content_items`/`scheduled_posts`, drag&drop,
   «лучшее время», статусы.
3. **Публикатор (Ayrshare):** модуль `ayrshare/*` (config/client/ratelimit, клон ig-триады); профили
   (`social_profiles`), JWT-связка соцсетей; `POST /api/post` (publish/schedule); вебхуки статусов;
   кнопки «Опубликовать во все» / «В контент-план»; Enterprise BYO-ключ Ayrshare.
4. **RSS-новости (отдельный блок):** источник RSS/Telegram/сайт/рубрика → текст+фото → пакетная
   генерация видео-новостей; автоматизация по расписанию.
5. **Стили и Профили вывода** — две управляемые библиотеки-пресета (субтитры/цвет/лого + форматы площадок).
6. **Уборка консоли:** UUID-guard на оставшиеся per-tenant эндпоинты суперадмина (billing/me, gemini,
   chatwoot, mcp, quest-flow).

---

## 7. Карта новых файлов

- Backend: `modules/tikhub/tikhub_client.ts`, `modules/tenant_settings/tikhub.ts`,
  `modules/trends/{service.ts,router.ts}`, `modules/media/{assets.ts,store_video.ts}`,
  `modules/render/{types,planner,store,executor,service,worker,router}.ts` (скелет очереди рендера);
  правки в `config/{systemConfig.ts,features.ts}` (+`renderGpuTarget`/`getRenderGpuTarget`),
  `modules/auth/router.ts`, `modules/tenant_settings/router.ts`, `db/migrations.ts` (+`render_jobs`),
  `server.ts` (+mount `/api/render`, +`startRenderWorker`).
- Frontend: `pages/{TrendsPage,GalleryPage,PublisherPage}.tsx`, `pages/flow/MontageEditor.tsx`,
  `pages/enterprise/Section6TikHub.tsx`, `public/trendflow-hero.svg`; правки в
  `pages/{FlowPage,admin/AdminConfigPage,EnterpriseSettingsPage}.tsx`, `layouts/MainLayout.tsx`,
  `components/{BottomTabBar,AppVersion}.tsx`, `config/features.ts`, `router.tsx`.
- Эта энциклопедия: `docs/TRENDTRAFFIC.md`. Деплой: `docs/DEPLOY_HOSTINGER_VPS.md`.

---

## 8. Git

Remote `origin = github.com/DanikVR/trendtraffic` (ветка `main`). Коммиты локальные, **пушит
пользователь** (`git push -u origin main`). Каждое изменение — отдельный коммит + бамп версии.
