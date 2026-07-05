# TrendTraffic ↔ Google Flow — Chrome-расширение

Мост между TrendTraffic и **настоящим** Google Flow (`labs.google/fx/tools/flow`).
Человек работает в Flow как обычный пользователь, а расширение:

1. забирает задачи (промпты/референсы) из TrendTraffic;
2. подставляет их в Flow и автоматически запускает генерацию (Veo 3.1);
3. дожидается готового клипа и возвращает его в Галерею TrendTraffic (`folder='flow'`).

Работает **пер-тенантно**: под тем Google-аккаунтом и подпиской Flow, в которые
залогинен браузер клиента. Раздаётся приватно (`.zip` → *Load unpacked*), без
Chrome Web Store.

> Статус: **Фаза 1, каркас.** Готовы: манифест, service-worker (очередь/поллинг/
> пейсинг/мост), панель поверх Flow, MAIN-world разведчик эндпоинтов, оба
> content-script. Автоматизация ввода работает по эвристическим селекторам —
> точные селекторы Flow снимаются «разведкой» (см. ниже). Бэкенд-ручки
> `/api/flow-ext/*` и узел «Google Flow» в TrendFlow — следующий шаг.

## Установка (для разработки/Enterprise)

1. Chrome → `chrome://extensions` → включить **Developer mode**.
2. **Load unpacked** → указать папку `apps/flow-extension`.
3. Открыть `https://labs.google/fx/tools/flow` — справа снизу появится панель
   «TrendTraffic → Flow».
4. Открыть TrendTraffic → блок **Google Flow** → «Подключить расширение»
   (передаёт JWT; появится после реализации бэкенда — Фаза 1, шаг 2).

## Как устроено

| Файл | Мир | Роль |
|------|-----|------|
| `manifest.json` | — | MV3, права, content-scripts на Flow и на нашем домене |
| `src/background.js` | service-worker | очередь, поллинг `/tasks`, пейсинг, заливка `/ingest`, мост |
| `src/content-flow.js` | Flow (isolated) | панель + автоматизация генерации |
| `src/injected.js` | Flow (MAIN) | перехват `fetch/XHR` Flow → разведка эндпоинтов + bearer |
| `src/content-bridge.js` | наш домен | `window.postMessage` ↔ background (передача JWT) |

Поток: `граф TrendFlow → /api/flow-ext/tasks → background → content-flow (Flow) →
готовый клип → /api/flow-ext/ingest → Галерея folder='flow'`.

## Анти-бот пейсинг (важно)

При полной автоматизации Flow быстро показывает «unusual activity». Поэтому:
между генерациями рандомная пауза **25–70 с**, при детекте баннера троттлинга —
пауза **20 мин**. Значения — в начале `background.js`. Не убирать.

## Разведка эндпоинтов (перед точной автоматизацией)

Точные селекторы полей и API-эндпоинты Flow нестабильны и **снимаются с живой
страницы**, а не выдумываются:

- `injected.js` логирует все запросы Flow к его API (старт генерации, история
  галереи, конфиг моделей) и складывает в `chrome.storage.local` ключ `recon`;
- счётчик виден внизу панели («разведка: N запросов Flow»).

Чтобы снять данные: открыть Flow, сгенерировать 1 клип вручную, затем в консоли
service-worker (`chrome://extensions` → *service worker* → Console):

```js
chrome.storage.local.get('recon', (d) => console.table(d.recon))
```

По этим URL/телам уточняются `SELECTORS` в `content-flow.js` и (опционально)
прямой API-режим вместо DOM-кликов.

## Дальше (Фаза 1, шаг 2 и Фаза 2)

- Бэкенд `apps/backend/src/modules/flow-ext/router.ts`: `/tasks`, `/ingest`,
  `/status` (гейты и медиа-заливка — по образцу `modules/social-ext`).
- Узел «Google Flow» в `MontageEditor` (`graph.flow`) + кнопка «Подключить
  расширение» и индикатор.
- Загрузка референсов/кадров и выбор формата/модели в Flow (по разведке).
- Ретраи, устойчивость к рестарту, опц. публикация в Chrome Web Store.
