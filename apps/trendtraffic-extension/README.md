# TrendTraffic — единое Chrome-расширение (Flow · NotebookLM · HeyGen)

Одно расширение, один установочный `.zip`. Работает сразу на трёх сервисах в
**реальном браузере** пользователя (его живой вход, жилой IP):

| Сервис | Сайт | Блок в TrendFlow | Что делает |
|--------|------|------------------|------------|
| **Google Flow** (Veo) | `labs.google/fx/tools/flow` | «Google Flow» | очередь промптов → авто-генерация клипов → Галерея `folder='flow'`; обмен видео/картинками «⬆ В галерею»/«⬇ Из Галереи» |
| **Google NotebookLM** | `notebooklm.google.com` | «Hotebook» | источники (URL/текст/файл из Галереи, в т.ч. видео+анализ), чат, генерация 9 артефактов → Галерея `folder='hotebook'` |
| **HeyGen** (Avatar IV/III) | `app.heygen.com` | «UGC / Аватары» | рендер говорящих голов по **вашей подписке** HeyGen (втрое дешевле API) → mp4 в пайплайн UGC |

Панель поверх сайта включается **по хосту**: «TrendTraffic → Flow» на Flow,
«TrendTraffic → Hotebook» на NotebookLM, «TrendTraffic → HeyGen» на HeyGen — каждый
content-script грузится только на своём домене. Один вход по JWT (берётся из
`localStorage['vibevox_token']` на app.trendtraffic.pro) обслуживает все очереди.

Раздаётся приватно (`.zip` → *Load unpacked*), без Chrome Web Store.

## Установка (Enterprise)

1. Настройки → вкладка **«Генерация»** → «Скачать расширение» → распаковать `.zip` в папку.
2. `chrome://extensions` → включить **«Режим разработчика»** → **«Загрузить распакованное»** → выбрать папку.
3. Если раньше стояло **старое** отдельное расширение «Google Flow» — **удалите его**
   (иначе два расширения будут дублировать задачи Flow).
4. Откройте нужный сайт и войдите в свой Google:
   - `labs.google/flow` — для блока «Google Flow»;
   - `notebooklm.google.com` — для блока «Hotebook».
   Справа снизу появится панель. «Бежит лента» = подключено и работает.
5. Подключение **автоматическое**, пока вы залогинены в TrendTraffic.

## Файлы

| Файл | Мир | Роль |
|------|-----|------|
| `manifest.json` | — | MV3, права, content-scripts на Flow, NotebookLM и нашем домене |
| `src/background.js` | service-worker | обе очереди: Flow (`/api/flow-ext/*`) + NotebookLM (`/api/notebooklm-ext/*`) |
| `src/content-flow.js` | Flow (isolated) | панель + автоматизация генерации Veo |
| `src/injected.js` | Flow (MAIN) | перехват `fetch/XHR` Flow → разведка + bearer |
| `src/content-notebook.js` | NotebookLM (isolated) | панель + командный роутер (источники/чат/студия артефактов) |
| `src/injected-nlm.js` | NotebookLM (MAIN) | перехват `fetch/XHR` NotebookLM → разведка + bearer |
| `src/content-heygen.js` | HeyGen (isolated) | панель + драйвер рендера головы под сессией (`render-head`) |
| `src/injected-heygen.js` | HeyGen (MAIN) | перехват `fetch/XHR` студии → разведка API + session-bearer |
| `src/content-bridge.js` | наш домен | `window.postMessage` ↔ background (передача JWT, авто-подключение) |

## HeyGen: как устроен рендер по подписке

UGC-сборка с провайдером «По подписке» кладёт задачи-«головы» (фото + аудио-сегмент +
Avatar IV/III) в `POST /api/render/ugc/build` → очередь `heygen_ext_tasks`. Расширение
забирает их (`GET /api/heygen-ext/tasks`), повторяет ровно те вызовы, что делает сама
студия под сессией клиента (upload talking_photo → `v2/video/generate` на наше аудио →
poll → скачивание mp4), и шлёт результат в `POST /api/heygen-ext/ingest`. Пайплайн UGC
ждёт готовые головы и собирает финальный ролик. Эндпоинты — в `CONFIG` начале
`content-heygen.js`, правятся по снимку разведки (`/api/heygen-ext/recon`).

## NotebookLM: как устроен обмен

NotebookLM — stateful-CRUD, поэтому две очереди:

- **Синхронные действия** (юзер ждёт): `POST /api/notebooklm/flow/:id/{sources,chat,…}`
  на бэкенде кладёт действие в `notebooklm_ext_actions` и **long-poll'ит** результат.
  Расширение long-poll'ит `GET /api/notebooklm-ext/poll`, выполняет действие во вкладке
  NotebookLM и рапортует `POST /action-result`. Задержка ~секунды.
- **Генерация артефактов** (async): `POST /generate` кладёт джобу в `notebooklm_jobs`;
  расширение забирает её тем же `/poll`, автоматизирует студию, шлёт готовый файл в
  `POST /ingest` → Галерея `folder='hotebook'`.

`notebook_id` в DOM нет — расширение выцарапывает `/notebook/<uuid>` из URL при создании
блокнота и рапортует его в `POST /action-result` (пишется в `notebooklm_state`).

## Анти-бот пейсинг (Flow — важно)

Между генерациями Flow — рандомная пауза **25–70 с**, при «unusual activity» — **20 мин**.
Значения в начале `background.js`. Не убирать. NotebookLM толерантнее — жёсткого пейсинга нет.

## Разведка вёрстки (перед точной автоматизацией)

DOM обоих сервисов нестабилен, поэтому селекторы **снимаются с живой страницы**:
как только расширение подключено, оно само шлёт снимок вёрстки на бэкенд
(`POST /api/flow-ext/recon` и `POST /api/notebooklm-ext/recon`, по одной записи на тенант,
читать `GET …/recon`). Кнопка «разведка вёрстки» в панели — снять вручную немедленно.
По этим данным уточняются `SELECTORS`/`LABELS`/`GEN_UI` в content-скриптах.

## Сборка `.zip`

```bash
cd apps/trendtraffic-extension
# ОБЯЗАТЕЛЬНО с icons/ — манифест ссылается на них, без папки Chrome не грузит манифест
# («Could not load icon 'icons/icon-16.png'», грабли v1.3.29 15.07.2026).
# Форвард-слэши в путях (Chrome и unzip читают одинаково):
zip -r -X ../frontend/public/trendtraffic-extension.zip manifest.json README.md icons src
# Если бинаря zip нет (Windows): python zipfile с путями через '/' — см. deployment-state.
```

Версию (`manifest.json` → `version`) бампать вместе с `TT_EXT_VERSION` в
`apps/frontend/src/components/AppVersion.tsx` — она показывается на карточке «Скачать».

## v1.3.0 — список проектов Flow

Вкладка «Google Flow» в Галерее показывает ГОТОВЫЕ ПРОЕКТЫ Flow. Приложение шлёт
`window.postMessage({source:'trendtraffic', type:'list-flow-projects'})`; `content-bridge`
пробрасывает в `background.listFlowProjects()`, тот находит/открывает вкладку главной Flow
и вызывает в `content-flow` действие `list-projects` (скрейп `a[href*="/tools/flow/project/"]`).
Ответ уходит на страницу как `{source:'tt-flow-ext', type:'flow-projects', projects:[…]}`.
Клик по карточке открывает проект «проектором» сам (обычный `window.open`) — расширение тут
только отдаёт список. Очередь генераций (`tickFlow`) не затронута.
