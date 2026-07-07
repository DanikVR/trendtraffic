# HeyGen по подписке — рендер голов UGC через расширение

> **Дата:** 2026-07-07 · **База:** `origin/main` (`eb2cd97`, где Flow+NotebookLM уже сведены в единое расширение).
> **Идея:** головы UGC (говорящие лица Avatar IV/III) рендерить не через HeyGen **API** (x-api-key, pay-as-you-go ~$3/мин), а через веб-студию HeyGen по **подписке клиента** (Creator/Pro/Business ≈$1/мин — втрое дешевле). Кредиты подписки через API недоступны (пулы раздельны), поэтому единственный автоматический путь — расширение в браузере клиента, залогиненного в свою подписку: оно повторяет ровно те вызовы, что шлёт сама студия под своей сессией → списывается подписка.

## ✅ Статус реализации (2026-07-07, ветка `heygen-ext`, коммит `ea767a5`)

**РЕАЛИЗОВАНО как ТРЕТИЙ сервис единого расширения** `apps/trendtraffic-extension` (v1.0.0 → **1.1.0**), тем же паттерном «панель по хосту», что Flow и NotebookLM. **НЕ запушено на origin/main и НЕ задеплоено.**

- **Расширение** `apps/trendtraffic-extension/`:
  - `src/content-heygen.js` — панель + драйвер рендера головы под сессией (на `app.heygen.com`). По команде `render-head`: скачать фото (через background `fetch-bytes`) → `POST upload.heygen.com/v1/talking_photo` (session-Bearer) → `POST api.heygen.com/v2/video/generate` (`use_avatar_iv_model`, `voice:{type:'audio', audio_url}` = наше аудио) → poll `v1/video_status.get` → скачать mp4. Эндпоинты вынесены в `CONFIG` наверху файла — правятся по разведке.
  - `src/injected-heygen.js` — MAIN-world перехват `fetch/XHR` студии → разведка API (эндпоинты генерации/загрузки/статуса) + session-Bearer.
  - `src/background.js` — в общий `tick()` добавлен `tickHeygen` (рядом с `tickFlow`/`nlmLoop`, под тот же будильник `tt-poll`); `runHeygenTask`/`heygenIngest`/`heygenStatus`; сообщения `hg-bearer`/`hg-send-recon` (свои теги — чтобы не пересекаться с Flow `bearer`/`send-recon`).
  - `manifest.json` — +хосты HeyGen (`app.heygen.com`, `api.heygen.com`, `upload.heygen.com`, `*.heygen.com`, `*.heygen.ai`), +content-script `content-heygen.js`, +web_accessible `injected-heygen.js`. Имя → «TrendTraffic — помощник (Flow · NotebookLM · HeyGen)».
- **Бэкенд** `apps/backend/src/modules/heygen-ext/router.ts` — очередь голов (таблица `heygen_ext_tasks`): `GET /tasks` (атомарный захват queued→running), `POST /status`, `POST /ingest` (mp4 → `uploads/renders`, задача → done), `POST|GET /recon`. Внутренние хелперы `enqueueHeygenHeads`/`waitHeygenHeads` для пайплайна. JWT + Enterprise. Смонтирован в `server.ts` до глобального `express.json()` (200 МБ).
- **Рендер-пайплайн** `apps/backend/src/modules/render/router.ts` — единый хелпер `renderTalkingHeads({ provider: 'api'|'ext', ... })`: `'api'` = прямые вызовы HeyGen (как было), `'ext'` = `enqueueHeygenHeads`→`waitHeygenHeads` (очередь расширения). Все **три** ветки `/ugc/build` (Своё фото / Удержание / Диалоги) переведены на него; на `'ext'` ключ HeyGen не требуется.
- **Фронт** `MontageEditor.tsx` — поле `UgcSpec.faceProvider ('heygen_api'|'heygen_ext')` + переключатель «Рендер лица: HeyGen API / По подписке» (над «Положение», виден для всех режимов) + статус расширения (слушает общий тег `tt-flow-ext`, как FlowExtPanel/Hotebook) + ссылка на `/trendtraffic-extension.zip`. `TT_EXT_VERSION` → 1.1.0.

## ⚠️ Главный риск (подтверждается только живым прогоном)

Что генерация `api.heygen.com/v2/video/generate` под **session-Bearer** реально списывает **подписку**, а не требует API-ключ; и что загрузка talking_photo / генерация идут именно этими v2-эндпоинтами. Драйвер написан по документированному v2-контракту как первая ставка. Первый прогон + авто-разведка (`POST /api/heygen-ext/recon`) это подтвердят/поправят `CONFIG`. Если студия ходит НЕ в v2 — правим `CONFIG` по снимку разведки (как когда-то `SELECTORS` в `content-flow`/`content-notebook`).

## Проверки (2026-07-07)

- backend `tsc` — 0 ошибок; frontend `tsc` — только 4 **предсуществующие** (CommState/PodLine в `MontageEditor`, не связаны с HeyGen — сверено stash-тестом).
- 8 скриптов расширения `node --check` OK; `manifest.json` валиден (4 content-script по хостам); модули `heygen-ext`/`render` грузятся без циклов (tsx); `trendtraffic-extension.zip` пересобран (10 файлов).

## Осталось

1. **Пуш** `heygen-ext` → `origin/main` (предохранитель Claude не пускает в защищённую ветку — как с NotebookLM, пуш делает юзер из worktree) + **деплой** (`git reset --hard origin/main` + `vps-redeploy.sh` по SSH).
2. Юзер обновляет расширение (v1.1.0), подтверждает новое разрешение `app.heygen.com`, логинится в свою подписку HeyGen.
3. **Живой E2E** + подтверждение биллинга подписки + уточнение эндпоинтов разведкой.

Связано: [`GOOGLE_FLOW_INTEGRATION.md`](GOOGLE_FLOW_INTEGRATION.md), [`HOTEBOOK_EXTENSION.md`](HOTEBOOK_EXTENSION.md) (тот же паттерн, расширение общее). Прайс: см. память `heygen-pricing`.
