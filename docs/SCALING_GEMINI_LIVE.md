# Масштабирование видеоперевода (Gemini Live) под нагрузку

Документ описывает, что происходит при «залпе» одновременных участников видеоперевода
(например, 50 человек заходят в разные комнаты сразу), где возникают узкие места и какие
механизмы внедрены для их устранения. Это реализация 7-пунктового плана.

---

## TL;DR — как устроена нагрузка

- **1 говорящий участник = 1 Gemini Live WebSocket-сессия.** В диалоге 1-на-1 это 2 сессии на комнату.
- **50 человек ≈ 25 комнат ≈ ~50 одновременных Gemini Live сессий** с одного API-ключа.
- Два физических потолка:
  1. **Лимит concurrent sessions у Gemini** — считается **per GCP-проект**, не per ключ.
  2. **Один Node-процесс** обслуживает все комнаты + REST API (event-loop как общий ресурс).

| Tier Gemini Developer API | Concurrent Live sessions (ориентир) |
|---|---|
| Free | ~3 |
| Tier 1 | ~50 |
| Tier 2 | ~1000 |
| Tier 3 | ~1000 |
| **Vertex AI** | **1000 + 4M TPM на проект** |

> Точные цифры зависят от аккаунта и модели — сверяйтесь в [AI Studio → Rate limits](https://aistudio.google.com/rate-limit).

---

## Что внедрено (7 пунктов)

### 1. Поднять tier Gemini до Tier 2+ (инфраструктура, ручное действие)

Самый дешёвый способ снять потолок concurrent sessions — повысить usage tier проекта:
подключить billing в Google Cloud, накопить историю трат → проект автоматически
поднимается до Tier 2 (~1000 concurrent). **Это действие в консоли Google, не в коде.**

Проверить текущий лимит: https://aistudio.google.com/rate-limit

### 2. Снятие CPU с event-loop (оптимизация DSP)

Главный CPU-edрес — автокорреляционный детектор пола `detectVoiceGender` в
[bridge.ts](../apps/backend/src/modules/translation/bridge.ts). Раньше он считался на **каждом**
аудио-фрейме (50/сек на сессию → при 50 сессиях ~2500 тяжёлых автокорреляций/сек душили
один event-loop).

Сделано:
- дешёвый **VAD по энергии** (`hasVoiceEnergy`) — на каждом фрейме (нужен для биллинга);
- дорогой **gender-детект — throttled**: пока пол не зафиксирован — раз в 4 фрейма; после
  фиксации (`genderLocked`) — раз в ~50 фреймов (~1 сек), только чтобы поймать смену говорящего.

Итог: в установившемся режиме ~**1 автокорреляция/сек на сессию вместо 50** — снижение CPU
примерно в 50 раз без потери качества. После этой оптимизации отдельный процесс для DSP
не нужен вплоть до сотен сессий.

### 3. (см. п.2 — оптимизация и троттлинг детектора объединены)

### 4. Пул Gemini-ключей с round-robin

[gemini_key_pool.ts](../apps/backend/src/config/gemini_key_pool.ts) +
[systemConfig.getGeminiApiKeyPool](../apps/backend/src/config/systemConfig.ts).

- Основной ключ + дополнительные ключи (админка `/admin/config` → «Масштабирование видеоперевода»
  → «Доп. Gemini-ключи», либо env `GEMINI_API_KEYS=key1,key2`).
- Ротация по новой Gemini-сессии/мосту распределяет комнаты по ключам.
- ⚠️ **Ключи должны быть из РАЗНЫХ GCP-проектов.** Лимит concurrent — per project: несколько
  ключей одного проекта делят один потолок, ротация не поможет.
- Применяется к глобальному/freemium трафику. Enterprise-тенанты со своим ключом не затрагиваются.

### 5. Vertex AI как опциональный провайдер

[gemini.getEffectiveGeminiClientConfig](../apps/backend/src/modules/tenant_settings/gemini.ts) +
[bridge.initGeminiClient](../apps/backend/src/modules/translation/bridge.ts).

- Включается в админке (чекбокс «Использовать Vertex AI») или env `GEMINI_USE_VERTEX=1`.
- Требует **service account** на сервере: переменная окружения
  `GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json` (Application Default Credentials).
- Поля: `vertexProject` (env `GOOGLE_CLOUD_PROJECT`), `vertexLocation` (env `GOOGLE_CLOUD_LOCATION`,
  дефолт `us-central1`).
- Даёт 1000 concurrent + 4M TPM на проект из коробки. Применяется к глобальному трафику;
  Enterprise со своим API-ключом остаются на Developer API.

Настройка SA:
1. В GCP включить **Vertex AI API**.
2. Создать service account с ролью **Vertex AI User**.
3. Скачать JSON-ключ, положить на сервер, указать путь в `GOOGLE_APPLICATION_CREDENTIALS`.
4. В админке включить Vertex + указать project/location. Перезапустить процесс (pm2 restart).

### 6. Admission control + видимый отказ (настраивается в админке)

Ядро — [admission.ts](../apps/backend/src/modules/translation/admission.ts).

- **Глобальный лимит** одновременных слотов перевода (≈ участников ≈ Gemini-сессий).
  Настраивается суперадмином в `/admin/config` → «Лимит одновременных переводов».
  Дефолт **50**. Env-фолбэк `MAX_CONCURRENT_TRANSLATION_SESSIONS`.
- **Резерв слота на входе.** При выдаче LiveKit-токена ([livekit/router.ts](../apps/backend/src/modules/livekit/router.ts))
  вызывается `tryAcquire(room, identity)` — ещё ДО подключения и старта bridge (иначе залп
  проскочит, т.к. сессии создаются с задержкой). Идемпотентно по `(room, identity)`.
- При превышении — **HTTP 503 `service_overloaded`**, фронт показывает плашку
  «Сервис временно перегружен» (RoomLobbyPage), форма входа скрыта. Это **видимый** отказ,
  а не молчаливая тишина без перевода.
- **Освобождение слота** (без утечек):
  1. `bridge.onParticipantDisconnected` → `release(room, identity)`;
  2. `translation/stop` (hangup / удаление комнаты / выкл. перевода) → `releaseRoom(room)`;
  3. TTL-страховка (3 ч) — на случай пропущенных событий;
  4. `reconcileWithLiveKit` раз в 2 мин — снимает слоты «мёртвых» комнат (LiveKit — источник истины).
- Мониторинг: `GET /api/translation/status` → поле `admission: { current, limit, rooms }`.

### 7. Квоты LiveKit Cloud (инфраструктура)

Отдельный потолок: одна комната = N участников + 1 бот-переводчик = **N+1 connection**.
50 человек = ~25 комнат = ~75 connection к LiveKit. Проверьте лимиты вашего тарифа LiveKit
Cloud (concurrent participants / minutes). Хард-лимит 2 участника на комнату
(`MAX_PARTICIPANTS_PER_ROOM`) + admission control ограничивают суммарную нагрузку и на LiveKit.

---

## Multi-instance (когда упрёмся в один процесс)

Сейчас деплой однопроцессный (см. [DEPLOY_HOSTINGER_VPS.md](DEPLOY_HOSTINGER_VPS.md)). После
оптимизации DSP (п.2) одного процесса хватает на сотни сессий. Когда понадобится больше:

1. Запустить несколько инстансов backend (pm2 cluster / несколько контейнеров за LiveKit).
2. **Admission-реестр сейчас живёт в памяти процесса** ([admission.ts](../apps/backend/src/modules/translation/admission.ts)) —
   при нескольких инстансах вынести в общий стор (Redis) **или** считать нагрузку через
   LiveKit (он глобален: `listActiveRoomNames` / суммарный participant count).
3. `activeBridges` (реестр мостов) тоже per-process — нужен sticky-routing «комната → инстанс»
   или общий координатор, чтобы `start`/`stop` попадали в тот же инстанс.

---

## Переменные окружения (сводка)

| Переменная | Назначение | Дефолт |
|---|---|---|
| `MAX_CONCURRENT_TRANSLATION_SESSIONS` | лимит admission control | 50 |
| `GEMINI_API_KEYS` | пул доп. ключей через запятую (РАЗНЫЕ проекты!) | — |
| `GEMINI_USE_VERTEX` | включить Vertex AI (`1`/`true`) | off |
| `GOOGLE_CLOUD_PROJECT` | project id для Vertex | — |
| `GOOGLE_CLOUD_LOCATION` | регион Vertex | us-central1 |
| `GOOGLE_APPLICATION_CREDENTIALS` | путь к JSON service account (для Vertex) | — |

Большинство этих параметров дублируются в админке `/admin/config` (system-config.json имеет
приоритет над env).
