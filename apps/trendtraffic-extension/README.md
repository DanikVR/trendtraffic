# TrendTraffic для Google — единое Chrome-расширение (Flow + NotebookLM)

Одно расширение, один установочный `.zip`. Работает сразу на двух сервисах Google
в **реальном браузере** пользователя (его живой вход в Google, жилой IP):

| Сервис | Сайт | Блок в TrendFlow | Что делает |
|--------|------|------------------|------------|
| **Google Flow** (Veo) | `labs.google/fx/tools/flow` | «Google Flow» | очередь промптов → авто-генерация клипов → Галерея `folder='flow'`; обмен видео/картинками «⬆ В галерею»/«⬇ Из Галереи» |
| **Google NotebookLM** | `notebooklm.google.com` | «Hotebook» | источники (URL/текст/файл из Галереи, в т.ч. видео+анализ), чат, генерация 9 артефактов → Галерея `folder='hotebook'` |

Панель поверх сайта выглядит по-разному: **индиго** «TrendTraffic → Flow» на Flow,
**бирюзовая** «TrendTraffic → Hotebook» на NotebookLM. Один вход по JWT (берётся из
`localStorage['vibevox_token']` на app.trendtraffic.pro) обслуживает обе очереди.

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
| `src/content-bridge.js` | наш домен | `window.postMessage` ↔ background (передача JWT, авто-подключение) |

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
# форвард-слэши в путях (Chrome и unzip читают одинаково):
zip -r -X ../frontend/public/trendtraffic-extension.zip manifest.json README.md src
```

Версию (`manifest.json` → `version`) бампать вместе с `TT_EXT_VERSION` в
`apps/frontend/src/components/AppVersion.tsx` — она показывается на карточке «Скачать».
