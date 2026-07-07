# TrendFlow — план чистки (удаление неиспользуемого кода)

> **Дата:** 2026-07-07 · **База:** `origin/main` (аудит делался на `ab81414`; origin/main с тех пор ушёл на `9378a42` — **номера строк ниже пересверять при исполнении**).
> **Ветка чистки:** `refactor/trendflow-cull` (от origin/main). Локальный `C:\GOOGLEDISK\trendtraffic` main — **СТАЛЫЙ** (110 коммитов позади, разошёлся) — чистить только на ветке от origin/main.
> **Обратимость:** полный код ДО чистки сохранён неизменяемо в ветке **`archive/full-homepc-2026-07-07`** (origin, `6bb1d44`). Вернуть = `git checkout archive/full-homepc-2026-07-07`.
> Верифицировано многоagentным аудитом + adversarial build-breaker sweep (0 необнаруженных поломок в остающихся путях).

---

## 1. Что оставляем и что удаляем

TrendFlow — радиальный редактор «облаков» (`apps/frontend/src/pages/flow/MontageEditor.tsx`). 7 облаков + легаси линейный «монтаж» (OpenMontage через `POST /api/render/flow/:flowId`).

| Облако / подсистема | Судьба | Движок |
|---|---|---|
| **flow** — Google Flow (+ Комментатор) | ✅ KEEP | расширение Veo + Omni (Google API) |
| **omni** — Omni Flash | ✅ KEEP | Google API (`gemini-omni-flash-preview`) на Gemini-ключе |
| **ugc** — UGC | ✅ KEEP | галерея→HeyGen + ElevenLabs + запись/диаризация (Gemini) |
| **hotebook** — Hotebook | ✅ KEEP | notebooklm-worker (позже → расширение, см. `HOTEBOOK_EXTENSION.md`) |
| **editor** — Редактор | ✅ KEEP | ffmpeg в процессе на VPS |
| **plan** — Контент-план | ✅ KEEP (заглушка, доделать) | — |
| **podcast** — Подкаст-студия | ❌ DROP | GPU EchoMimic/RVM (домашний ПК) |
| линейный **«монтаж»** (OpenMontage) | ❌ DROP | render-worker + executor |
| **домашний ПК** (render-worker GPU + sr-capture) | ❌ DROP | — |
| **SpatialReal** (весь) | ❌ DROP | заменяется галерея→HeyGen |

**Принцип:** убрать «генерацию на домашнем ПК» и «OpenMontage». Omni/Комментатор — чистое облако Google (не ПК), поэтому остаются. UGC-компоновка и Редактор гоняют ffmpeg **в процессе на VPS** (`ffmpeg-static`), не на ПК → домашний ПК свободен полностью.

---

## 2. Удалить целиком (backend-файлы)

Проверено грепом: вне модуля `render` их импортирует только `server.ts` (обвязка воркера).

```
apps/backend/src/modules/render/service.ts        createRenderJob/createPodcastJob (очередь монтажа)
apps/backend/src/modules/render/planner.ts        граф монтажа → шаги
apps/backend/src/modules/render/store.ts          таблица render_jobs
apps/backend/src/modules/render/worker.ts         поллер render_jobs
apps/backend/src/modules/render/executor.ts
apps/backend/src/modules/render/executor_http.ts  отправка шагов на Python render-worker
apps/backend/src/modules/render/executor_director.ts
apps/backend/src/modules/render/news_fetch.ts     нода «Новости»
apps/backend/src/modules/render/broll.ts          нода «broll» (единств. потребитель pexels/pixabay)
apps/backend/src/modules/render/avatar_step.ts    обёртка монтажной ноды «Аватар»
apps/backend/src/modules/render/illustrate.ts     подкаст-«Иллюстратор» (единств. потребитель asset_captions)
apps/backend/src/modules/render/gpu_studio_store.ts   таблица gpu_studio_jobs
apps/backend/src/modules/render/types.ts          удалять ПОСЛЕДНИМ
```

**НЕ удалять** (Omni/UGC): `video_gen.ts`, `frame_extract.ts` (Omni), `avatar.ts`, `retention.ts`, `audio_diarize.ts`.

`server.ts`: убрать импорты строк ~50–54 + блок `.finally(() => {…})` ~266–275 (обвязка `startRenderWorker`/executor). Планировщики ниже (`.finally` — не трогать).

---

## 3. Хирургия (файл остаётся, режем часть)

### `render/router.ts`
**Режем маршруты:** студийные `/podcast/*` (animate, compose(+status), angle, illustrate, heygen-studio, compose-studio, gpu-studio(+status), omni-animate(+status)) + `/podcast/:flowId` + `/flow/:flowId` + **`GET /`** + **`GET /:id`** + `GET /config/gpu` + петля реанимации gpu-studio + sr-ветка `/ugc/build` (~764–853) + блок SpatialReal-библиотеки `GET /ugc/avatars/spatialreal` (~368–522) + sr-хелперы (`srMakeSessionToken`/`srAppIdFromToken`/`srFetch`/`srParse`/`srCachePreview` ~546–565).

> ⚠️ **Не-очевидный build-breaker:** `GET /` и `GET /:id` импортят `listRenderJobs`/`getRenderJob` из удаляемого `service.ts` — их легко проглядеть (короткие хвостовые роуты). Резать вместе с импортом строки 24.

**Оставляем:** `/ugc/*`, `/omni/*`, `/commentator/*`, `/podcast/dialogue` (переиспоёт UGC), `/podcast/diarize` (только Gemini-путь `diarizeWithGemini`; фолбэк на render-worker ~183–205 убрать). Хелпер `linesForRetention` и `ugcJobs` — **не трогать**.

**Импорты:** режем строки 18(частично: `getRenderGpuTarget/getRenderWorkerUrl/getRenderGpuWorkerUrl/getSrCaptureUrl/getSrAppId`), 24 (service), 31 (illustrate), 32 (gpu_studio_store); из строки 29 убрать `composeHeads/composeOnStudio/regionSimilarity/greenBgRatio/probeImageSize/downloadToRendersExt/StudioOverlay/CaptionLine/NormRect`.

### `render/podcast_compose.ts`
**KEEP:** `composeUgc`, `composeRetentionVideo`, `composeCommentator`, `sliceAudioToRenders`, `mediaDuration`, `downloadToRenders`, типы `UgcCaption`/`RetComposeSeg` + приватные ffmpeg-хелперы (`ffmpeg`/`probeDuration`/`buildUgcAss`/`centeredCaptionAss`/`assTime`/`assEsc`/`subFilterPath`/`hasAudioStream`/`kenBurnsChain`—орфан можно убрать).
**CUT:** `composeHeads`, `composeOnStudio`, `regionSimilarity`, `probeImageSize`, `greenBgRatio`, `cropImageTo916`, `cropImageToRect`, `buildNewsAss`, `downloadToRendersExt`, типы `StudioOverlay`/`CaptionLine`/`NormRect`.
(Проверено: KEEP-функции не зовут ни одной CUT-функции.)

### `render/director.ts` — ⚠️ НЕ удалять весь файл
`trends/dna.ts:22` и `trends/analytics.ts:19` импортят `resolveAnthropicKey`/`DEFAULT_DIRECTOR_MODEL`.
**KEEP:** `resolveAnthropicKey`, `DEFAULT_DIRECTOR_MODEL`, `tagUgcRetention`, `generatePodcastDialogue`.
**CUT:** `generateVoiceoverScript`, `runResearch`, `writeNews`, `pickBrollKeywords`, `pickBestMoment` + приватный `fetchTranscript` + импорт `getRenderWorkerUrl` (стр. 20).

### `render/podcast_voice.ts`
**KEEP:** `elevenTTS` (озвучка UGC — 11 Labs), `buildHostAudio`. Опционально переименовать в `media/tts.ts`.

### `config/systemConfig.ts`
**CUT:** `getRenderWorkerUrl`, `getRenderGpuWorkerUrl`, `getSrCaptureUrl`, `getSrAppId`, `getRenderGpuTarget` + поля интерфейса + строки `getSettingsForClient` + записи fieldMap.
**KEEP:** `getNotebookWorkerUrl` (нужен Hotebook до вывода воркера).

### `tenant_settings/provider_keys.ts` — массив `PROVIDERS`
**KEEP:** `anthropic`, `heygen`, `elevenlabs`, `fal`, `openai` (+ `gemini`/`tikhub` — в своих файлах `gemini.ts`/`tikhub.ts`).
**REMOVE** (0 потребителей, грепом): `runway`, `suno`, `xai`, `doubao`, `google`, `google_omni`, `unsplash`, `pexels`, `pixabay`, `hf`, `spatialreal`.
UI (Section7) строится по ответу бэкенда → сам ужмётся.

---

## 4. Фронтенд

### `MontageEditor.tsx` — облако podcast + попап пресетов + редактор монтажа
**Вердикт (проверено грепом):** `nodes`/`META`/`PRESET_GROUPS`/`applyPreset` — ТОЛЬКО линейный монтаж; НИ ОДНО из 6 облаков их не читает. Единственная общая связь — пикер исходника (Omni читает `sourceUrl`/`openSourcePicker`), его сохраняем.

**Удалить (строки на `ab81414`, пересверить):**
- Облако podcast: из `CloudId`(108)/`CLOUD`(112)/`cloud`-state(722)/пикера(3520)/busy-ring(3524) + панель + все `fetch` к студийным `/podcast/*`.
- Типы `MKind/Choice/Meta/MNode` (31–51), `META`/`KIND_ORDER`/`DIR_HINT` (53–105).
- `PRESET_GROUPS` + пресеты (Новости/Клип-фабрика/Кинематик/Дубляж/Объяснитель…) + `NEWS_CHAIN` (518–554); `newNode`/`hydrate`/`nodeSummary` + все DNA→монтаж-хелперы (556–670).
- Состояния: `nodes`(679), `showPresets`(686), `attachFor`/`attachSlot`(687–688), батч `picked/batchJobs/batchRunning/showBatch/batchMinimized/batchNote`(715–720), `building/buildJob/buildMinimized`(698–700), `showDnaPanel`(713), `lenSel`(1073), `exporting/exportPct`(1074–1076).
- Функции: `build()`(1538–1572), `runBatch()`(2795–2843), `applyPreset/addNode/removeNode/patchNode/setChoice`(2603–2624), `uploadMediaFiles`(2678–2714), `applyDna/fetchDna`(2761–2784), `toClock/parseRange/writeLenRange/startExport`(1502–1535).
- JSX: кнопка «Собрать»(3377–3384), плюс-веер(3392–3410), FAB «Собрать видео»(3412–3423), spider-line SVG(3425–3433), рендер узлов + empty-state пресетов(3466–3492), панель выбранного узла(3556–3718), «Добавить процесс»(3720–3735), **модалка «Выберите пресет сценария»(3737–3762)**, montage-attach picker(3765–3793), панель DNA «Заполнить из тренда»(3997–4065), модалки прогресса сборки + пилюли + батч(5895–6034).
- UGC SpatialReal-коллапс: `avatarProvider` → только `'gallery'`(452/474/1161); удалить `ugcSrAvatars/ugcSrLoading/ugcSrNote`(808–811), `loadUgcSrAvatars`(907–917), `pickUgcSrAvatar`(918–919), вызов в effect(935), SpatialReal-грид(4999–5030), гейт(974–975), перетексты HeyGen(5078/5348/5355).
- Снять глушилку `plan` на строке 1114 (plan остаётся).

**ОСТАВИТЬ (общее — НЕ трогать):** `sourceUrl/sourceName/sourceAssetId`, `srcDuration/srcVideoRef`, пикер исходника `loadSources/openSourcePicker/uploadSourceVideo/selectSource(без fetchDna)/clearSource` + модалка `showSource`(3848–3949, вырезать только `togglePick`/`picked`-бейджи/«Собрать пакет»3938–3945/«Без исходника»3924–3931); раскладку облаков (`CLOUD`/`cloud`/`cloudEdges`/drag-connect/диспетчер панелей); `uploadToGallery` + `GalleryPicker` (нужны всем облакам); `DialogueTimeline` (общий с UGC).

### `FlowPage.tsx` (53–66)
Убрать бейджи `podcast` и `montage`; **`omni`-бейдж оставить**; из импорта убрать `Mic`/`Film`, `Cloud` оставить.

### `AdminConfigPage.tsx`
Убрать стейт/хендлеры/пейлоад/строки конфига render-GPU-цель + GPU-воркер + CPU-воркер + sr-capture (~52/107/250/876). Строку notebook-воркера оставить.

---

## 5. Обязательные доводки (не удаление — новый код)

1. **Галерея → HeyGen.** В `/ugc/build` завести ветку: выбранный аватар из Галереи (`avatarUrl`) идёт в существующий HeyGen-путь `uploadTalkingPhoto → submitTalkingPhotoVideo` (копия `isPhoto`-ветки 700–762, `avatarUrl` вместо `photoUrl`). Без этого «Коллекция» выбирается, но «Собрать» нечем.
2. **ElevenLabs на ветке «Своё фото».** Сейчас озвучка встроенным HeyGen-TTS (`voiceId + text` на 718/722). Заменить: получить `getEffectiveProviderKey(tenantId,'elevenlabs')` → `elevenTTS()` → отдать `audioUrl` в `submitTalkingPhotoVideo` (как retention на 614). Запись/диаризация (Gemini) остаётся второй опцией.

---

## 6. Инфраструктура (гасим домашний ПК)

- ❌ **`render-worker/`** целиком (main.py, echomimic_natural.py, pose_director.py, install*.sh, requirements.txt, README + веса `models/RealESRGAN_x2plus.pth` ~64МБ, докачиваются по релиз-URL). Systemd: `trendtraffic-render`(VPS:8800) + `trendtraffic-render-gpu`(дом:8801) → disable+rm.
- ❌ **`sr-capture/`** целиком (server.mjs, page/, package*) — домашний :8803. Автозапуска в systemd нет → убить процесс + `start-gpu.bat`. Runtime-кэш `uploads/sr-avatars/` на VPS.
- ❌ Деплой: `deploy/vps-openmontage.sh` + `/opt/openmontage`; из `deploy/vps-redeploy.sh` вырезать только строки RENDER_*/SR_* (файл оставить). Env убрать: `RENDER_WORKER_URL`, `RENDER_GPU_WORKER_URL`, `RENDER_GPU_TARGET`, `SR_CAPTURE_URL`, `SR_APP_ID`.
- ✅ **`notebooklm-worker/` пока оставляем** (Hotebook живёт). Позже — заменяется расширением (см. `HOTEBOOK_EXTENSION.md`). Если гасим ПК ДО расширения — воркер надо перенести на VPS (env `NOTEBOOKLM_WORKER_URL`, headless: Xvfb; при датацентр-IP — резидентный прокси через `HTTP_PROXY`).
- **`uploads/renders/`** — НЕ удалять папку (общий вывод UGC/Комментатора/Редактора/Omni), только старые файлы дропнутых фич.

---

## 7. БД (migrations.ts)

`DROP TABLE IF EXISTS` (идемпотентно): `render_jobs`, `gpu_studio_jobs`, `asset_captions`.
**НЕ трогать:** `media_assets`, `video_analyses`, `notebooklm_state`/`notebooklm_jobs`, `flow_ext_tasks`/`flow_ext_recon`, `tenant_provider_keys`. FK в удаляемые таблицы нет.

---

## 8. Порядок работ (компилируется на каждом шаге)

1. **Фронт** (не зависит от backend-типов): `MontageEditor.tsx` (podcast + попап + редактор монтажа + UGC-коллапс) → `FlowPage.tsx` → `AdminConfigPage.tsx`.
2. **`router.ts`** — режем маршруты вместе с импортами 18/24/31/32 (иначе битый импорт удаляемого файла).
3. **`server.ts`** (50–54 + 266–275).
4. **`director.ts`** (CUT-экспорты + `getRenderWorkerUrl`).
5. **`podcast_compose.ts`** (CUT-экспорты).
6. **`systemConfig.ts`** (5 геттеров + поля).
7. **`provider_keys.ts`** (11 провайдеров).
8. **Удалить 13 файлов** целиком (см. §2).
9. **`migrations.ts`** (3 таблицы).
10. **Доводки** (§5): галерея→HeyGen + ElevenLabs.
11. `tsc --noEmit` backend+frontend → выполоть лишние lucide-иконки по выводу компилятора.
12. Смоук 6 облаков (flow enqueue→ingest, ugc build HeyGen+ElevenLabs, hotebook артефакт, editor обрезка, omni gen, plan) → **curl с самого VPS** → деплой с ветки от origin/main.

---

## 9. Провайдеры Enterprise после чистки

Останутся секции: **Gemini** (`gemini.ts`), **TikHub** (`tikhub.ts`), и ключи **Anthropic + HeyGen + ElevenLabs + fal + openai** (`provider_keys.ts`). Всё, что использует хотя бы одно из 6 облаков + лента трендов.
