# VibeVox — Фич-флаги (включение/выключение функций)

Проект — «заготовка». Чтобы отключить целую функцию (видеозвонки, SIP, диалекты,
партнёрку, демо) **не нужно удалять код по кускам** — достаточно переключить флаг.

---

## Где флаги (2 файла-зеркала)

| Файл | Роль |
|---|---|
| `apps/backend/src/config/features.ts` | **КАНОНИЧЕСКИЙ источник.** Гейтит монтирование роутеров в `server.ts`. |
| `apps/frontend/src/config/features.ts` | **Зеркало (build-time).** Гейтит роуты (`router.tsx`) и пункты меню. |

⚠️ **Держи оба в синхроне.** Сверка вживую: `GET /api/features` отдаёт серверные значения.

---

## Текущие флаги (v1)

| Ключ | Что выключает | Backend (роутеры) | Frontend (роуты/меню) |
|---|---|---|---|
| `video` | видеозвонки-перевод | `livekit`, `translation`, `coach` | `/` (RoomPage), `/room/:id`, FAB + CTA «создать комнату» |
| `sip` | SIP-телефония | `sip` | `/sip` + ссылки в навигации |
| `learnHub` | правила обучения / диалекты | `admin/dialects` | `/admin/dialects` |
| `partners` | партнёрская программа | `partners` (public+admin) | `/admin/partners` |
| `publicDemo` | аудио-песочница лендинга | `demo` | — |

**Ядро (НЕ гейтится, всегда вкл):** `auth`, `rooms`, `billing`, `admin` (config/users/
promocodes), `settings`, `tenant-settings`, `notifications`, Enterprise-подсистема
(`insights`/`need-tags`/`tenant-prompt`/`enterprise-chat`/`quest-flow`) — она и так
закрыта тарифом. Причина: `rooms`/`billing`/`auth` — общий субстрат, его удаление
каскадит (см. docs/ — анализ связности).

---

## Как ВЫКЛЮЧИТЬ функцию

**Способ 1 — в коде (для своей сборки-варианта):** поставь `false` в **ОБОИХ** файлах.
```ts
// apps/backend/src/config/features.ts  и  apps/frontend/src/config/features.ts
video: false,   // ← выключили видеозвонки
```
Пересобери (`npm run build`). Результат: эндпоинты `/api/livekit|translation|coach`
не монтируются, роуты `/` и `/room/:id` исчезают, домашняя падает на
`HOME_ROUTE_WHEN_NO_VIDEO` (`/settings`), FAB/CTA скрыты.

**Способ 2 — env-оверрайд на backend (без правки кода):**
```ini
FEATURE_VIDEO=off      # off | false | 0 | no = выключено
```
Имя переменной: `FEATURE_<КЛЮЧ_В_ВЕРХНЕМ_РЕГИСТРЕ>` (`FEATURE_SIP`, `FEATURE_LEARNHUB`, …).
⚠️ env влияет только на backend (API). Меню/роуты фронта правятся флагом в зеркале.

---

## Почему гейтинг безопасен (важно)

Гейтим **монтирование роутера** (`if (FEATURES.x) app.use(...)`), а не сам модуль.
Соседние модули импортируют друг у друга **СЕРВИСЫ** (функции вроде
`getEffectiveGeminiKey`, `listMessages`), а **не роутеры**. Поэтому отключение
монтирования убирает HTTP-эндпоинты фичи, но импортируемые сервисы остаются — у
соседей ничего не ломается.

---

## Как вызывать (паттерн)

```ts
// Backend (server.ts):
if (FEATURES.video) app.use('/api/livekit', livekitRouter);

// Frontend — роут (router.tsx), условный спред:
...(FEATURES.sip ? [{ path: 'sip', element: <SipPage /> }] : []),

// Frontend — пункт меню / кнопка:
{FEATURES.video && <button>…</button>}
```

---

## Как ДОБАВИТЬ новый флаг (например, `liveKids`)

1. **Backend** `config/features.ts`: добавь `liveKids: boolean` в `FeatureFlags`,
   в `DEFAULTS`, в `FEATURES` (`liveKids: fromEnv('liveKids', DEFAULTS.liveKids)`).
2. **Frontend** `config/features.ts`: добавь `liveKids: true` в `FEATURES`.
3. Оберни монтаж роутера (`server.ts`), роут (`router.tsx`) и пункт меню в
   `FEATURES.liveKids`.

Готово — новая функция управляется одним флагом.

---

## Полное удаление (когда уверен, что фича больше не нужна)

Флаг = «мягкое» выключение (код ещё в репозитории). Чтобы выпилить совсем:
1. Выключи флаг, убедись что всё зелёное (`tsc` + сборка).
2. Удали модуль `apps/backend/src/modules/<feature>/`, его импорт/монтаж в `server.ts`,
   страницу+роут на фронте, ключ из обоих `features.ts`.
3. `npx tsc --noEmit` для обоих app — компилятор покажет все оборванные ссылки.

*Создано 2026-05-30 в рамках превращения проекта в переиспользуемую заготовку.*
