# Hotebook → NotebookLM Chrome-расширение (замена воркера)

> **Дата:** 2026-07-07 · **База:** `origin/main`.
> **Идея:** зеркалим Google-Flow-расширение → NotebookLM работает в **реальном Chrome юзера** (реальный вход Google, жилой IP). Убивает `notebooklm-worker/` (Playwright/FastAPI), домашний ПК/VPS-воркер, `storage_state`, keepalive, auth-плашку и датацентр-детект Google.

## ✅ Статус реализации (2026-07-07, ветка `feat/notebooklm-extension`)

**РЕАЛИЗОВАНО как ЕДИНОЕ расширение** (по просьбе юзера — один установочный файл на Flow и NotebookLM):
- **`apps/trendtraffic-extension/`** — единое MV3-расширение. Flow-скрипты (`content-flow.js`,
  `content-bridge.js`, `injected.js`) скопированы из старого `apps/flow-extension` **байт-в-байт**
  (Flow-логика не тронута). Новое: `content-notebook.js` (панель + командный роутер + студия
  9 артефактов), `injected-nlm.js` (recon NotebookLM), `background.js` — **ОБЪЕДИНЁННЫЙ**
  (Flow-очередь + NotebookLM `/poll`/actions/tasks/ingest). Старый `apps/flow-extension` удалён.
- **`apps/backend/src/modules/notebooklm/ext_bridge.ts`** — общий слой: очередь действий
  (`notebooklm_ext_actions`), клейм джоб, присутствие (`notebooklm_ext_presence`), справочники.
- **`apps/backend/src/modules/notebooklm-ext/router.ts`** — приёмник расширения:
  `GET /poll` (long-poll: действие ИЛИ джоба), `POST /action-result`, `POST /status`,
  `POST /ingest` (→ Галерея `hotebook`), `GET /gallery`, `POST|GET /recon`. Смонтирован в
  `server.ts` до глобального `express.json()` (700 МБ, base64-артефакты).
- **`modules/notebooklm/router.ts`** — REWIRED: `wfetch(воркер)` → очередь расширения
  (`enqueueAction`+`waitAction`); генерация → джоба; `/jobs/:id` = чистый select; `/status` =
  присутствие расширения (`ext_offline`/`ext_login`); **все `/auth/*` + `wfetch`/`loginSids` УДАЛЕНЫ**.
  Публичный контракт `/api/notebooklm/*` СОХРАНЁН — фронт (`MontageEditor` hb*) почти не изменился.
- **Фронт:** карточка «Скачать расширение» в Настройки → «Генерация» (`Section7OpenMontage`,
  единая, `/trendtraffic-extension.zip` + `TT_EXT_VERSION`); `Section8Hotebook` переписан
  (без стриминг-логина/`storage_state`/окна воркера → «установите расширение + войдите в
  notebooklm.google.com»); плашки узла под `ext_offline`/`ext_login`.

**Осталось / доказать вживую:** селекторы `content-notebook.js` (`SELECTORS`/`LABELS`/`GEN_UI`)
написаны best-effort и **уточняются разведкой** с живой страницы (кнопка «разведка вёрстки» +
авто-`POST /recon`) — как когда-то `content-flow.js`. Живой E2E (создать блокнот → источник →
чат → артефакт в Галерею) на аккаунте юзера НЕ гонялся. Воркер `notebooklm-worker/` физически
ещё не выключен (systemd/данные — §9), но код на него больше не ходит.

---

## 0. Почему поверхность БОЛЬШЕ, чем у Flow (читать первым)

Flow автоматизирует **одно** действие: промпт→видео. Остальное (очередь, обмен с Галереей) — общая обвязка.

NotebookLM — **stateful CRUD-приложение**, а не one-shot генератор. Воркер (`notebooklm-worker/main.py`) отдаёт ~15 групп маршрутов = **7 классов взаимодействий**, которые сейчас крутятся на сервере и должны переехать в `content-notebook.js`:

| Класс | Роут воркера | Роут бэкенда `notebooklm/router.ts` |
|---|---|---|
| Создать/открыть блокнот | `POST/GET /notebooks` | `ensureNotebook` |
| Источник — URL/YouTube | `POST /notebooks/{nb}/sources` (kind:url) | `POST /flow/:flowId/sources` |
| Источник — текст | тот же (kind:text) | тот же |
| Источник — файл (из Галереи) | `POST .../sources/file` | `POST /flow/:flowId/sources/asset` |
| Список источников | `GET .../sources` | `GET /flow/:flowId/overview` |
| Удалить источник | `DELETE .../sources/{sid}` | `DELETE /flow/:flowId/sources/:sourceId` |
| Чат + цитаты | `POST .../chat` | `POST /flow/:flowId/chat` |
| Генерация (9 типов) + скачивание | `POST .../generate` + `GET /tasks/{id}` + `GET /files/{name}` | `POST /flow/:flowId/generate` → `GET /jobs/:id` |

**Следствие:** расширение — не fire-and-forget. Оно держит **дескриптор блокнота на flow** (в мире DOM нет `notebook_id` из API — выцарапываем из URL), обрабатывает **синхронные** действия (источник/чат/удаление — юзер ждёт) и **длинные async-джобы** (генерация). → два режима диспатча.

---

## 1. Архитектура

**Новое расширение `apps/notebooklm-extension/`** (копия `flow-extension`):
- `background.js` — service-worker, поллинг очереди (переиспоём, ретаргет алярма/эндпоинтов).
- `content-bridge.js` — мост на `app.trendtraffic.pro` (читает `vibevox_token`) — **без изменений**.
- `injected.js` — перехват fetch/XHR + recon вёрстки — переиспоём, меняем список интересных RPC.
- **`content-notebook.js`** — НОВЫЙ: автоматизация `notebooklm.google.com`.

**Новый бэкенд `apps/backend/src/modules/notebooklm-ext/router.ts`** (зеркало `flow-ext`: `enqueue/tasks/status/ingest/recon`) — **переиспользует** существующие `notebooklm_jobs` + `notebooklm_state` + Галерею `folder='hotebook'` + `uploads/hotebook`. Новую таблицу джобов НЕ плодим.

**Отдельное расширение**, не второй скрипт в Flow (независимая установка/версии). `content-bridge.js` дублируется (origin-scoped, stateless).

---

## 2. `manifest.json` (диф от Flow)

```jsonc
{
  "manifest_version": 3,
  "name": "TrendTraffic ↔ Google NotebookLM",
  "permissions": ["storage", "downloads", "scripting", "tabs", "alarms"],
  // downloads — ОБЯЗАТЕЛЕН (крупные артефакты mp3/mp4/pdf)
  "host_permissions": [
    "https://notebooklm.google.com/*",      // + NEW (цель)
    "https://*.googleusercontent.com/*",    // CDN аудио/картинок
    "https://*.googleapis.com/*",           // internal RPC (recon)
    "https://*.google.com/*",
    "https://app.trendtraffic.pro/*", "http://localhost:*/*", "http://127.0.0.1:*/*"
  ],
  "content_scripts": [
    { "matches": ["https://notebooklm.google.com/*"], "js": ["src/content-notebook.js"], "run_at": "document_idle" },
    { "matches": ["https://app.trendtraffic.pro/*", "http://localhost:*/*"], "js": ["src/content-bridge.js"], "run_at": "document_idle" }
  ],
  "web_accessible_resources": [{ "resources": ["src/injected.js"], "matches": ["https://notebooklm.google.com/*"] }]
}
```
Диф: убрать `labs.google/*`/`ggpht.com`, добавить `notebooklm.google.com/*`. `content-bridge.js` — идентичен. `downloads` — теперь несущий.

---

## 3. `content-notebook.js` (по образцу `content-flow.js`)

Тот же скелет: (1) инжект `injected.js` (recon+bearer), (2) Shadow-DOM панель, (3) автоматизация. Отличия:

**Командный роутер** (вместо одного `run-task`):
```js
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (msg.type === 'ping') { send({ ready: onNotebookLM() }); return; }
  if (msg.type === 'run-action') { runAction(msg.action).then(send).catch(e => send({ ok:false, reason:String(e?.message||e) })); return true; }
});
async function runAction(a) {
  switch (a.kind) {
    case 'create-notebook': return createNotebook(a.title);
    case 'open-notebook':   return openNotebook(a.notebookId);
    case 'add-source':      return addSource(a);      // {srcKind:'url'|'text'|'file', ...}
    case 'list-sources':    return listSources();
    case 'delete-source':   return deleteSource(a.sourceId);
    case 'chat':            return chat(a.question);
    case 'generate':        return generate(a.gtype, a.params);
  }
}
```
Каждый хендлер возвращает форму, нужную бэкенду для замены роута (`create-notebook`→`{ok,notebookId,title}`, `chat`→`{ok,answer,citations}`, `generate`→`{ok,remoteState}` + файл через ingest).

**`SELECTORS`** — по действию, с фолбэками; NotebookLM тяжело на Angular/Material + shadow DOM → `queryAllDeep()` (из Flow) обязателен везде. Селекторы — role/aria/text (не классы), уточняются recon. Хелпер `findByText(candidates, words)` (обобщение Flow `findGenerateButton`).

**Recon** (`injected.js`) — почти без изменений; меняем `INTERESTING` на `notebooklm.google.com/_/`, `batchexecute`. `collectRecon` снимает контролы + добавить `<audio>` и source-chips. Постит в `POST /api/notebooklm-ext/recon`.

**Жизненный цикл:** синхронные действия (create/add/delete/list/chat) — background шлёт `run-action`, ждёт инлайн (таймауты 30с / 4мин add-source / 4мин chat). Генерация — очередь как Flow (`tick`→`/tasks`→`run-action`→`ingest`).

---

## 4. `background.js` (изменения)

- **Ретаргет поллинга:** `POLL_ALARM='tt-nlm-poll'`, `tick()` бьёт `/api/notebooklm-ext/tasks`. Остальное (`401→disconnect`, пейсинг, throttle) переиспоём. NLM толерантнее Flow → пейсинг мягче (`8–20с`), throttle → мягкий retry по тексту ошибки `quota`.
- **Таб NotebookLM:** `ensureNotebookTab` (query `notebooklm.google.com/*`, reuse/create, ping-ready). Навигация в блокнот — **SPA-навигация/клик по тайлу**, НЕ hard-reload (иначе холодная загрузка на каждое действие).
- **Синхронный RPC (нового у Flow нет):** create/add/delete/list/chat вызываются с сайта on-demand. **Option A (рекоменд.):** SPA зовёт существующий бэкенд-роут → бэкенд кладёт строку в `notebooklm_ext_actions` и long-poll'ит (в рамках своего 180с-бюджета), пока расширение не отрапортует. Фронт-контракт не меняется, `externally_connectable` не нужен. SW опустошает очередь действий (приоритетнее генерации).
- **Ingest:** результат генерации = скачанный файл. Мелкие — dataUrl (blob→base64, Flow `blobToDataUrl`); крупные (mp3/mp4/pdf) — через `chrome.downloads` (лимит сообщений 64МБ). Для json-типов (quiz/flashcards/mindmap/table) content-script ещё и парсит `payload` инлайном → вьюверы панели работают как сейчас.

---

## 5. Бэкенд `modules/notebooklm-ext/router.ts` (зеркало flow-ext)

Копия скелета `flow-ext/router.ts` (`requireAuth`/`requireEnterprise`/`pollLimiter`/`absUrl`). Монтаж `/api/notebooklm-ext`.

| Роут | Зеркалит | Поведение |
|---|---|---|
| `GET /tasks?limit=1` | flow-ext `/tasks` | Атомарно забрать **генерацию**: `UPDATE notebooklm_jobs SET status='running' ... FOR UPDATE SKIP LOCKED RETURNING *`. Отдать `{id,type,params,notebookId,focus}`. Нужен `notebook_id` в задаче (join `notebooklm_state`). |
| `GET /actions?limit=1` | (Option A) | Забрать **синхронные** действия из `notebooklm_ext_actions`. |
| `POST /status` | flow-ext `/status` | queued/running/done/failed, retry→queued. |
| `POST /action-result` | (новый) | Результат синхронного действия → разблокирует long-poll. Для `create-notebook`: **пишет `notebooklm_state`** (tenant/flow/notebook_id). |
| `POST /ingest` | flow-ext `/ingest` | Байты артефакта → `uploads/hotebook` → `createAsset(folder:'hotebook')` → job `done`. Переиспоём `EXT_MEDIA`/`EXT_MIME`/имя-файла из `notebooklm/router.ts`. |
| `POST /recon`, `GET /recon` | flow-ext | recon/дебаг. |
| `GET /gallery` | flow-ext `/gallery` | Список файлов Галереи для источника-из-файла (абс. URL для `fetch-bytes`). |

**Проблема `notebook_id` (ключевой момент):** в мире DOM API его не отдаёт. Расширение создаёт/открывает блокнот, выцарапывает `/notebook/<uuid>` из URL, `POST /action-result` пишет в `notebooklm_state`. `ensureNotebook` = проверить state; если нет — enqueue-and-wait `create-notebook`. Каждое действие несёт `notebook_id`.

**Файл из Галереи → источник:** переиспоём механизм Flow (`content-flow.js` `injectFileIntoFlow`/`fetch-bytes` → `DataTransfer` в `input[type=file]`).

---

## 6. Стык с текущим Hotebook: STAYS / REWIRED / REMOVED

**Решение:** фронт-контракт `/api/notebooklm/*` СОХРАНЯЕТСЯ; переписываем только тела (с `wfetch(воркер)` на очередь расширения). `MontageEditor`/`Section8Hotebook` почти не меняются.

**STAYS (без изменений):** `notebooklm_jobs`/`notebooklm_state`, Галерея `folder='hotebook'`, `finalizeJob`-логика (минус скачивание с воркера), `HB_TYPES` UI (9 типов), поллинг джоб (`hbPollLoop`/`GET /jobs/:id`/`mapJob`), Enterprise-гейт, `todayCounters`/`GET /counters`, owner-Telegram-алерт.

**REWIRED (URL те же, нутро: wfetch → очередь):** `ensureNotebook`, add-source (url/text/file), delete-source, chat, generate-trigger, job-finalize (→ `POST /ingest`), `GET /status` (= «расширение недавно поллило и залогинено в NotebookLM», из heartbeat/recon-строки). `GET /jobs/:id` больше не зовёт воркер — читает Postgres. `refreshJob` упрощается до select.
Caveat: `chat` (`hbAsk`) сейчас синхронный (240с) — станет long-poll/мини-джоб (единственный хендлер, реально меняющий форму). Add-source безопасен: `hbAfterAdd → hbLoadOverview(true)` уже перечитывает авторитетный список.

**REMOVED (заменяет модель auth):**
- Бэкенд `notebooklm/router.ts`: все `/auth/*` (login-window, login-remote/start|frame|input|poll|stop, import storage_state) + `wfetchRaw`/`loginSids`/`ownsSid`/`adopt-default`.
- Фронт `Section8Hotebook.tsx`: вся стриминг-логин-модалка + вставка `storage_state.json` + superadmin-карточка «открыть Chromium на воркере» → заменить статичной карточкой **«установи расширение Hotebook и войди в notebooklm.google.com в своём браузере»**. Бейдж коннекта остаётся (питается heartbeat расширения). **Бонус: платформа больше не хранит Google-куки юзеров.**
- `MontageEditor.tsx`: текст `not_configured`/`offline` панели («включите машину воркера / задайте NOTEBOOKLM_WORKER_URL») → «подключите расширение».

---

## 7. Артефакты: DOM-поток по каждому `HB_TYPE`

Опции идут из `HB_TYPES` → `params` → расширение. Воркер `build_gen_kwargs` + `GEN_SPEC` дают семантику; расширение воспроизводит как клики в Studio.

**Общий скелет:** открыть блокнот → Studio → плитка артефакта → применить опции → язык → focus/инструкции → Generate → ждать (таймаут по типу) → захватить файл.

| Тип | Опции (`HB_TYPES`) | Контролы NotebookLM | Захват |
|---|---|---|---|
| **audio** | format{deep_dive/brief/critique/debate}, length{short/default/long}, lang, focus | Audio Overview → Customize → формат-карточки → длина → focus | **.mp3** (download/`<audio>`) |
| **video** | format{explainer/brief/cinematic}, style(9), lang, focus | Video Overview → формат (Cinematic=Veo, Ultra) → стиль-дропдаун → focus | **.mp4** (длинное, cinematic — минуты) |
| **report** | format{briefing_doc/study_guide/blog_post/custom}, lang, focus | Reports → шаблон-карточки → focus | **.md** |
| **quiz** | count{standard/fewer}, difficulty{easy/medium/hard}, lang, focus | Quiz → #вопросов → сложность → focus | **.json** (payload) |
| **table** | lang, focus | Data table → focus | **.csv** (payload {headers,rows}) |
| **infographic** | orientation(3), detail(3), style(10), lang, focus | Infographic → ориентация → детализация → стиль → focus | **.png** |
| **flashcards** | count{standard/fewer}, lang, focus | Flashcards → #карточек → focus | **.json** (payload) |
| **mindmap** | lang, focus | Mind map → focus (результат сразу, без задачи) | **.json** (payload) |
| **slides** | format{detailed_deck/presenter_slides}, length{short/default}, lang, focus | Slides → формат-карточки → длина → focus | **.pdf**/**.pptx** |

**Захват:** (a) DOM/blob для audio/video/image (`<audio>/<video>/<img>` src → blob→dataUrl или `googleusercontent` → page-fetch); (b) `chrome.downloads` для pdf/pptx/крупных бинарников (лимит 64МБ форсирует downloads-путь для mp3/mp4). Для json/csv — ещё `payload` инлайном (вьюверы `HbPayloadView`).

**Перевод значений:** значения UI (`deep_dive`, `bento_grid`…) уже = ожидаемые NotebookLM; таблица `LABELS[gtype][field][value]=['English','Русский']` (язык UI зависит от аккаунта), матч через `findByText`. Не нашли контрол → **сворачиваем опцию в текст-инструкцию** (паритет с воркером), не падаем.

---

## 8. Тяжёлые места + митигации

1. **Длинные джобы (браузер открыт).** Ждём на `chrome.alarms` (переживает сон SW), не setTimeout; при крахе `GET /tasks` перезабирает `running`>15мин, а **NotebookLM хранит артефакт на сервере** → расширение переоткрывает блокнот и добирает готовое (преимущество над Flow). UI: «держите это окно Chrome открытым».
2. **9 типов × опции — больше DOM, чем у Flow.** Митигация: `LABELS`+`findByText`+deep-query + fold-to-instructions. Recon снимает контролы Studio на коннекте. Катим по типам: audio+report+quiz → video/slides/infographic → table/flashcards/mindmap.
3. **Стриминг чата.** Стоп-кнопка исчезла + `MutationObserver` тихое окно ~1.2с → читаем финальный текст + цитаты. Таймаут 4мин.
4. **Захват по типам.** §7 (DOM/blob vs chrome.downloads). Файл может осесть в Downloads — документировать/чистить.
5. **Дрейф DOM** (Google-SPA, shadow DOM, обфускация). Митигация: весь recon-конвейер + role/aria/text-селекторы + deep-query + fold-fallback. Каждое действие на промахе возвращает `reason:'selector:<name>'` → бэкенд показывает «Hotebook: нужен апдейт селекторов».
6. **Идентичность блокнота в DOM** (§5) — главный не-Flow риск. Скрейп `/notebook/<uuid>` из URL — единственный дескриптор; recon снимает `location.href`, чтобы поймать смену схемы URL.
7. **Синхронно-vs-async** (§4): action-queue + long-poll (Option A) — единственная новая backend-сложность, которой у Flow не было.

---

## 9. Вывод воркера (только ПОСЛЕ доказательства расширения на audio+video)

1. Systemd на хосте воркера: `disable --now trendtraffic-notebooklm.service` + `...-refresh.timer/.service` + `rm` юниты + `daemon-reload`.
2. Данные `/opt/tt-hotebook/` (`home/` профили-куки, `out/` артефакты уже в Галерее, `.venv/`, `refresh-all.sh`).
3. Репо `notebooklm-worker/` (`git rm -r`).
4. Env/config: `NOTEBOOKLM_WORKER_URL` + `getNotebookWorkerUrl`/`notebookWorkerUrl` в `systemConfig.ts` + admin-UI.
5. В `notebooklm/router.ts`: удалить `workerBase/wfetch/wfetchRaw`, `finalizeJob`-скачивание с воркера, `refreshJob` `/tasks/:id`, `connectionStatus` `/auth/status`, док-хедер про Tailscale.

**Выживает** (сливается с `notebooklm-ext`): публичный `/api/notebooklm/*` контракт, таблицы `notebooklm_jobs`/`notebooklm_state`, Галерея-финализация (минус скачивание), auth/гейт, + новое из flow-ext (`GET /tasks`, `POST /status`, `POST /ingest`, recon/heartbeat).

---

## 10. Порядок (единый, с чисткой)

1. ✅ Архив `archive/full-homepc-2026-07-07`.
2. **Чистка** (`TRENDFLOW_CULL.md`) — `notebooklm-worker` НЕ трогаем, Hotebook живёт.
3. **Скелет** `apps/notebooklm-extension/` из flow-extension + бэкенд `modules/notebooklm-ext`.
4. `content-notebook.js`: recon+панель → детект входа → создать/открыть блокнот → список источников.
5. Источники (url/text/file/удаление) + чат (Option A long-poll).
6. Генерация по типам: **audio → report → quiz** → бинарники (video/slides/infographic) → payload (table/flashcards/mindmap).
7. **Доказать вживую на audio + video** → артефакт в Галерею «Hotebook».
8. **Ретайр воркера** (§9). → домашний ПК полностью свободен, ноль серверной Google-автоматизации.

### Прочитанные файлы (для сверки при исполнении)
`apps/flow-extension/{manifest.json, src/*}`, `apps/backend/src/modules/flow-ext/router.ts`, `apps/backend/src/modules/notebooklm/router.ts`, `notebooklm-worker/main.py` (GEN_SPEC/build_gen_kwargs/run_generation/login-remote), `apps/frontend/src/pages/flow/MontageEditor.tsx` (HB_TYPES/hbDefaults/HbPayloadView), `apps/frontend/src/pages/enterprise/Section8Hotebook.tsx`.
