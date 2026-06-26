# PWA Install — интеграция в VibeVox

Документ-референс по библиотеке `@khmyznikov/pwa-install` и план/реализация её интеграции в VibeVox.

- **GitHub:** https://github.com/khmyznikov/pwa-install
- **npm:** https://www.npmjs.com/package/@khmyznikov/pwa-install
- **Дата исследования:** 2026-05-28
- **Статус интеграции:** план составлен, реализация ожидает ассеты (см. §8)

---

## 1. Назначение

Web-component `<pwa-install>` (custom element). Показывает диалог установки PWA на всех платформах. Главное преимущество — единый UX, который:

- На Chromium перехватывает `beforeinstallprompt` и предлагает установку через нативный API.
- На iOS/iPadOS Safari (где API установки отсутствует) показывает **визуальные инструкции** «Поделиться → На экран Домой».
- На Firefox / Opera Desktop / macOS Safari < 17 — fallback-инструкции.
- Читает `/manifest.json`, использует оттуда `name`, `icons`, `description`, `screenshots`.

## 2. Поддержка платформ

| Платформа | Поведение |
|---|---|
| **Android Chrome / Edge / Samsung Internet / Opera / Brave** | Полноценная установка (`beforeinstallprompt` → диалог) |
| **Desktop Chrome / Edge / Brave / Opera / Arc** (Win/Mac/Linux/ChromeOS) | Иконка «Установить» в адресной строке + кастомный диалог |
| **iOS / iPadOS Safari 16+** | API нет — библиотека показывает инструкции со скриншотами |
| **macOS Safari 17+** | «Файл → Добавить в Dock» — библиотека показывает инструкции |
| **Firefox Desktop** | Установка не поддерживается; fallback-инструкции |
| **Firefox Android** | Ручное «Добавить на главный экран» через меню |
| **Telegram Mini App / WebView** | Установка недоступна — компонент нужно скрывать (`useAppStore().isMiniApp`) |

События `pwa-install-success-event` / `pwa-install-fail-event` / `pwa-user-choice-result-event` приходят только на Chromium. iOS их не отправляет.

## 3. HTML-атрибуты компонента

| Атрибут | Назначение |
|---|---|
| `manifest-url` | Путь до манифеста (default: `/manifest.json`) |
| `name` | Имя приложения (приоритетнее манифеста) |
| `description` | Описание (приоритетнее манифеста) |
| `icon` | Иконка (приоритетнее манифеста) |
| `install-description` | CTA-строка над кнопкой установки |
| `disable-install-description` | Скрыть CTA |
| `disable-screenshots` | Скрыть скриншоты везде |
| `disable-screenshots-apple` | Скрыть скриншоты только в Apple-диалоге |
| `disable-screenshots-chrome` | Скрыть скриншоты только в Chrome-диалоге |
| `disable-close` | Запретить закрытие диалога |
| `disable-chrome` | Отключить кастомный Chrome-UX, использовать встроенный |
| `disable-android-fallback` | Не показывать инструкции для не-Chrome Android-браузеров |
| `manual-apple` | Показывать Apple-диалог только через `showDialog()` |
| `manual-chrome` | Показывать Chrome-диалог только через `showDialog()` |
| `manual-how-to` | Сразу показывать инструкции (без скриншотов) |
| `use-local-storage` | Запоминать в localStorage отказ юзера |
| `styles` | JSON со стилями (на сейчас только `tint-color`) |

> Boolean-атрибуты работают как «true» при простом присутствии — для «false» атрибут нужно **удалить**, не выставлять `="false"`.

## 4. JS API (на экземпляре элемента)

**Методы:**

- `install()` — программно запустить установку
- `showDialog()` — открыть диалог
- `hideDialog()` — закрыть диалог
- `getInstalledRelatedApps()` — async (Chromium-only)

**Read-only свойства:**

- `userChoiceResult: string`
- `isDialogHidden: boolean`
- `isInstallAvailable: boolean`
- `isAppleMobilePlatform: boolean`
- `isAppleDesktopPlatform: boolean`
- `isApple26Plus: boolean`
- `isUnderStandaloneMode: boolean` ← полезно для скрытия UI после установки
- `isRelatedAppsInstalled: boolean`

**Особое свойство:**

- `externalPromptEvent` — позволяет «отдать» компоненту вручную пойманный `beforeinstallprompt` (нужно, если компонент монтируется асинхронно и событие уже произошло)

**Кастомные события:**

- `pwa-install-success-event`
- `pwa-install-fail-event`
- `pwa-install-available-event`
- `pwa-user-choice-result-event`
- `pwa-install-how-to-event`
- `pwa-install-gallery-event`

## 5. Встроенные переводы — ВАЖНОЕ ОГРАНИЧЕНИЕ

Библиотека шипится со **строго 28 локалями**:

> EN, RU, TR, DE, ES, NL, EL, FR, SR, PL, ZH-CN/ZH-HK, IT, UK, CS, NO/NB, PT, JA, SV, KO, KM, DA, VI, FA, HU, SK, CA-ES, HE

Локаль выбирается из `navigator.language`. **Механизма подгрузки кастомных локалей нет** (нет `translations-url`, нет `locale` атрибута). Для VibeVox (108 языков) это значит:

- **Наши строки** (`name`, `description`, `install-description`) — полностью под нашим контролем через атрибуты компонента → 108 языков покрываются нашим i18n.
- **Системные строки библиотеки** (кнопки «Install», «Cancel», заголовки секций iOS-инструкций) — для 28 встроенных языков, для остальных 80 → fallback на EN.

Варианты будущих улучшений:
1. PR в upstream с дополнительными локалями (Google Translate можно прогнать через тот же `scripts/translate-locales.mjs`).
2. Fork библиотеки с тем же содержимым плюс наши 80 локалей.
3. Свой минимальный диалог поверх `BeforeInstallPromptEvent` (отказ от библиотеки) — резерв, если требования вырастут.

## 6. Требуемые ассеты

### 6.1. Иконки

| Файл | Размер | Назначение |
|---|---|---|
| `icon-192.png` | 192×192 | Android home screen (минимум для установки) |
| `icon-512.png` | 512×512 | Android splash, Chrome Desktop |
| `icon-maskable-192.png` | 192×192 | Android adaptive (контент в центральных 80%) |
| `icon-maskable-512.png` | 512×512 | То же, больший размер |
| `apple-touch-icon-180.png` | 180×180 | iOS home screen (Safari читает напрямую) |
| `favicon-32.png` | 32×32 | Вкладка браузера |
| `favicon-16.png` | 16×16 | Вкладка браузера (legacy) |

Формат — PNG-32 (с альфой) или PNG-24 с фоном `#0A0A0A` (совпадает с `theme-color` в `index.html`).

Источник — один master-файл 1024×1024 PNG/SVG, из которого скриптом `sharp` или ImageMagick генерируются все размеры. Скрипт-генератор живёт в `apps/frontend/scripts/generate-pwa-icons.mjs` (создаётся при реализации).

### 6.2. Скриншоты (опционально)

- Mobile (form-factor: `narrow`): 750×1334 или 1080×1920, 2–5 PNG
- Desktop (form-factor: `wide`): 1280×800 или 1920×1080, 2–5 PNG

Пока ассетов нет — на компоненте выставляется `disable-screenshots`. По мере появления — заливаются в `public/screenshots/` и снимается флаг.

## 7. Минимальный `manifest.json`

```json
{
  "name": "VibeVox — AI Voice & Video Translator",
  "short_name": "VibeVox",
  "description": "Synchronous AI translator for voice and video calls in 100+ languages.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0A0A0A",
  "theme_color": "#0A0A0A",
  "lang": "en",
  "dir": "ltr",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`manifest.json` локализации не поддерживает на уровне браузера (Chrome игнорирует языковые варианты) — описание оставляем на EN. Локализованные строки в диалоге установки идут через атрибуты `<pwa-install>`.

## 8. План реализации в VibeVox

### Шаг 0 — необходимые ассеты от заказчика

- Master-icon 1024×1024 PNG/SVG (или согласие на апскейл из текущего 300×300)
- Опционально — отдельный maskable-вариант с безопасной зоной 80%
- Подтверждение текстов (см. §10)
- Решение по точке входа в UI (см. §9)

### Шаг 1 — статика

1. Создать `apps/frontend/public/manifest.json` (см. §7).
2. Положить иконки в `apps/frontend/public/icons/`.
3. Добавить в `apps/frontend/index.html`:
   - `<link rel="manifest" href="/manifest.json" />`
   - `<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />`
4. Создать минимальный `apps/frontend/public/sw.js` (no-op service worker — формальное требование Chrome для «Add to Home Screen»).
5. Регистрация SW в `apps/frontend/src/main.tsx` (только в `production`-сборке, чтобы не мешать Vite HMR).

### Шаг 2 — установка пакета

```
cd apps/frontend
npm i @khmyznikov/pwa-install
```

(`npm i` не входит в защищённый список — `i18n:*`, `predeploy`, `npm run build`)

### Шаг 3 — React-обёртка

`apps/frontend/src/components/PWAInstallPrompt.tsx` — обёртка над web-компонентом:

- Декларация типа для JSX (`pwa-install` custom element)
- Импорт сайд-эффектом `@khmyznikov/pwa-install`
- Локальный словарь `PWA_INSTALL_I18N` на 12 inline-языков (en, ru, de, es, fr, pl, it, pt, ar, he, zh, tr — совпадает с `INLINE_LANGUAGES` в `config/i18n.ts`). Остальные 96 → fallback на EN.
- Чтение текущей локали через `useTranslation()` (без обращений к `navigator.language` — см. правило из `memory/project_i18n_arch.md`).
- Скрытие в Telegram Mini App (`useAppStore().isMiniApp`).
- Скрытие при `isUnderStandaloneMode` (приложение уже установлено).
- Экспорт хука `usePWAInstall()` с методом `showInstallDialog()` для вызова из UI.

### Шаг 4 — интеграция в UI

Зависит от решения по точке входа (см. §9).

### Шаг 5 (после завершения работы Gemini над локалями) — миграция на i18n

Сейчас словарь живёт в файле компонента. После того как Gemini-прогон по 108 локалям закончится:

1. Добавить ключи в `apps/frontend/public/locales/ru/common.json` и `.../en/common.json`:
   ```
   pwaInstall.name
   pwaInstall.description
   pwaInstall.installCta
   ```
2. Прогнать `npm run i18n:propagate` (заполнит остальные 106 языков плейсхолдерами + пометит `_meta.needsRefresh: true`).
3. Прогнать `npm run translate:locales` (Google Translate API закроет 106 языков).
4. Заменить локальный словарь в `PWAInstallPrompt.tsx` на `useTranslation('common')`.
5. Удалить словарь из файла компонента.

## 9. Точка входа в UI (требует решения заказчика)

Варианты, не взаимоисключающие:

- **A. Пункт в `BottomTabBar` More-sheet** — «Установить приложение», виден на мобильных. По образцу других пунктов More-sheet.
- **B. Пункт в `MainLayout` desktop-сайдбаре** — для десктоп-юзеров, отдельная иконка.
- **C. Блок в `SettingsPage`** — «Установить как приложение» с кнопкой.
- **D. Бэйдж/баннер в шапке** при `isInstallAvailable === true` — заметнее, но навязчивее.

Рекомендация: **A + B + C** (один и тот же `usePWAInstall().showInstallDialog()` дёргается из трёх мест). Без авто-показа.

## 10. Готовые тексты

### `manifest.json` (EN, единая версия для всех браузеров)

- **name:** `VibeVox — AI Voice & Video Translator`
- **short_name:** `VibeVox` (лимит Android — 12 символов, помещается)
- **description:** `VibeVox is a synchronous AI translator for voice and video calls in 100+ languages. WebRTC and SIP telephony, AI assistant, real-time speech-to-speech — works on every device.`

### `install-description` (CTA в диалоге, ~120 символов)

- **EN:** `Install VibeVox to your home screen — one tap to launch translated calls, SIP and the AI assistant. Works offline-ready.`
- **RU:** `Установите VibeVox на главный экран — звонки с переводом, SIP и AI-ассистент в один тап. Работает как нативное приложение.`

(остальные 10 inline-языков — DE/ES/FR/PL/IT/PT/AR/HE/ZH/TR — заполняются при реализации; ещё 96 → fallback на EN до миграции на i18n в §8 шаге 5)

---

## 11. Текущая реализация в VibeVox

**Реализовано:** 2026-05-28 · **Версия пакета:** `@khmyznikov/pwa-install@0.6.3`

### 11.1. Созданные файлы

| Файл | Назначение |
|---|---|
| `apps/frontend/public/manifest.json` | PWA-манифест (name/short_name/description, 4 иконки, theme/background `#0A0A0A`, `display: standalone`) |
| `apps/frontend/public/sw.js` | No-op service worker (нужен Chrome для prompt'а установки, ничего не кэширует) |
| `apps/frontend/public/icons/icon-192.png` | 192×192 any-purpose |
| `apps/frontend/public/icons/icon-512.png` | 512×512 any-purpose |
| `apps/frontend/public/icons/icon-maskable-192.png` | 192×192 maskable (логотип 70% от стороны, фон `#0A0A0A`) |
| `apps/frontend/public/icons/icon-maskable-512.png` | 512×512 maskable |
| `apps/frontend/public/icons/apple-touch-icon-180.png` | 180×180 для iOS (логотип 85%, непрозрачный фон `#0A0A0A`) |
| `apps/frontend/public/icons/favicon-32.png` | 32×32 для вкладки браузера |
| `apps/frontend/public/icons/favicon-16.png` | 16×16 (legacy) |
| `apps/frontend/scripts/generate-pwa-icons.mjs` | Регенерация всех PNG из мастер-файла `Content/pwa-master-1024.png` через `sharp` |
| `apps/frontend/src/components/PWAInstallPrompt.tsx` | React-обёртка над `<pwa-install>` (импорт из `react-legacy`) + хук `usePWAInstall()` |

### 11.2. Изменённые файлы

| Файл | Что изменено |
|---|---|
| `apps/frontend/index.html` | Добавлены `<link rel="manifest">`, два `<link rel="icon">` на favicon-32/16, `<link rel="apple-touch-icon" sizes="180x180">`. Старая `/favicon.png` ссылка удалена. |
| `apps/frontend/src/main.tsx` | Регистрация `/sw.js` под флагом `import.meta.env.PROD` (в dev SW мешает Vite HMR) |
| `apps/frontend/src/layouts/MainLayout.tsx` | Импорт `PWAInstallPrompt, usePWAInstall`; монтаж `<PWAInstallPrompt />` рядом с `<BottomTabBar />`; плашка-кнопка между `</nav>` и user-card в desktop sidebar (`Download`-иконка lucide, оранжевая, под флагом `pwaInstallAvailable`) |
| `apps/frontend/src/components/BottomTabBar.tsx` | Импорт `VibeVoxIcon, usePWAInstall`; кнопка под Logout в More-sheet с фирменным `VibeVoxIcon` и подписью «Установить приложение / На главный экран — запуск в один тап» (стилизована в оранжевый акцент `rgba(255,115,0,0.06)`) |
| `apps/frontend/package.json` | Добавлена зависимость `"@khmyznikov/pwa-install": "^0.6.3"` |
| `apps/frontend/public/locales/ru/common.json` | Добавлен блок `pwaInstall.{name,description,installCta,buttonLabel,buttonSubtitle,buttonAria}` |
| `apps/frontend/public/locales/en/common.json` | То же на EN |
| `apps/frontend/public/locales/{106 langs}/common.json` | Через `i18n:propagate` + `translate:locales` (Google API) на все 108 языков |

### 11.3. Точки входа в UI

- **Desktop (`MainLayout.tsx`):** плашка в slim sidebar между навигацией и user-card. Узкая, иконка `Download` + двухстрочный текст. Резолюция §9 — вариант B.
- **Mobile (`BottomTabBar.tsx` → More-sheet):** последний пункт после Logout. Использует фирменный `VibeVoxIcon` (40×40, белая обводка) — даёт юзеру наглядное представление что именно «VibeVox» окажется на home screen. Резолюция §9 — вариант A.
- **Settings page (вариант C из §9):** не добавлено. При необходимости — просто дёрнуть `usePWAInstall().showInstallDialog()` из `SettingsPage.tsx`.

### 11.4. Поведение

- **Авто-показ ВКЛЮЧЁН:** атрибут `manualChrome`/`manualApple` НЕ установлены, библиотека сама перехватывает `beforeinstallprompt` (Chromium) и показывает диалог + сама показывает iOS-инструкции на Safari.
- **`useLocalStorage`** включён — повторный отказ юзера не вызывает диалог снова через тот же триггер. Кнопка ручного триггера вызывает `showDialog(true)` который форсирует показ даже если отказ запомнен (через флаг `forced=true`).
- **`disableScreenshots`** включён — скриншотов пока нет. Когда будут — положить в `public/screenshots/`, дописать в `manifest.json` секцию `screenshots`, снять флаг на компоненте.
- **Скрытие кнопок** — через `usePWAInstall().isAvailable`, который комбинирует:
  - `isStandalone` — `window.matchMedia('(display-mode: standalone)')` + iOS `navigator.standalone`
  - `isMiniApp` — `useAppStore.isMiniApp` (Telegram WebView)
- **Скрытие компонента** в Telegram WebView — `PWAInstallPrompt` возвращает `null` при `isMiniApp === true`, web-component вообще не монтируется.

### 11.5. i18n

Переведены через i18n-pipeline три строки на 108 языков:

- `pwaInstall.name` — имя приложения (используется в атрибуте `name` компонента)
- `pwaInstall.description` — описание (атрибут `description`)
- `pwaInstall.installCta` — CTA-плашка над кнопкой установки (атрибут `installDescription`)

Плюс три служебных строки для кнопок UI:

- `pwaInstall.buttonLabel` — «Установить приложение» / «Install app»
- `pwaInstall.buttonSubtitle` — подзаголовок («На главный экран — запуск в один тап»)
- `pwaInstall.buttonAria` — aria-label

**Лимит библиотеки:** системные строки (Install, Cancel, How to install, iOS step labels) локализованы только на 28 встроенных языков (§5). Для остальных 80 — английский fallback. Это известный компромисс; решение — PR в upstream или fork при необходимости.

### 11.6. Известные квирки

- **Vite HMR + SW:** регистрация SW обёрнута в `import.meta.env.PROD` — в dev SW не регистрируется. Если случайно зарегистрировать — пере-загрузки начнут перехватываться, придётся unregister через DevTools.
- **Chrome engagement heuristics:** на Chromium `beforeinstallprompt` НЕ срабатывает сразу после открытия сайта. Chrome требует, чтобы пользователь провёл на сайте какое-то время / совершил клики (engagement signals). До этого `isInstallAvailable === false` и кнопка `showInstallDialog()` покажет диалог, но без работающей кнопки «Install» — только инструкции. Это поведение Chrome, не баг библиотеки.
- **iOS:** на любой iOS-версии установка PWA — это всегда **ручной** flow через Share-меню Safari. Библиотека показывает инструкцию со скриншотами; никакой нативной кнопки нет в принципе.

### 11.7. Регенерация иконок

При смене мастер-файла:

1. Положить новый PNG/SVG ≥ 1024×1024 в `Content/pwa-master-1024.png`
2. `cd apps/frontend && node scripts/generate-pwa-icons.mjs`

Скрипт генерирует все 7 PNG из мастера в `public/icons/`.

### 11.8. Регенерация переводов

При изменении текстов `pwaInstall.*` (или любых других ключей):

1. Отредактировать `apps/frontend/public/locales/ru/common.json` (источник истины) и `.../en/common.json`
2. `npm run i18n:propagate` — добавит новые ключи во все 108 локалей с EN-плейсхолдером + пометит `_meta.needsRefresh: true`
3. `npm run translate:locales` — Google Translate API переведёт помеченные локали
4. Опционально: `npm run i18n:check` — проверить покрытие

### 11.9. Что осталось / следующие шаги

- Когда будут скриншоты — снять `disableScreenshots` с компонента и добавить секцию `screenshots` в `manifest.json` (см. §6.2).
- Добавить аналитику событий (`pwa-install-success-event`, `pwa-user-choice-result-event`) — повесить листенеры в `PWAInstallPrompt.tsx` и отправлять в нашу метрику.
- Опционально: форк библиотеки или upstream PR с дополнительными 80 локалями системных строк.
- Опционально: добавить пункт в `SettingsPage` (вариант C из §9).
