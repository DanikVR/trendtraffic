# Pre-deploy: перевод и SEO

Зачем нужна цепочка: добавил `t('newKey')` или новую публичную страницу — без
проверки деплой укатил бы UI с сырым ключом вместо перевода, или новую страницу
без локализованного HTML/sitemap (Google её просто не увидит).

## Команды

Из `apps/frontend/`:

| Команда | Что делает |
|---|---|
| `npm run i18n:check` | Сканирует `src/**/*.{ts,tsx}` на `t('...')`, сверяет с `public/locales/ru/common.json`. Падает на отсутствующие ключи. |
| `npm run routes:check` | Сверяет роуты из `src/router.tsx` с `PUBLIC_ROUTES` в `scripts/prerender.mjs` и `scripts/sitemap.mjs`. |
| `npm run i18n:propagate` | Добавляет новые ключи в 106 не-исходных языков (EN placeholder + `_meta.needsRefresh: true`). |
| `npm run translate:locales` | Прогоняет Google Translate API по всем файлам с `needsRefresh: true`. Нужен `GOOGLE_TRANSLATE_API_KEY`. |
| `npm run i18n:review` | **Dry-run** Gemini-ревью локалей — пишет отчёты в `reports/llm-review/<lang>.md`, файлы не меняет. |
| `npm run i18n:review:apply` | Gemini-ревью **с применением фиксов** ко всем 108 локалям. |
| `npm run i18n:review:fresh` | То же + `--skip-if-fresh` — гоняет только языки, где источник `ru/common.json` менялся с предыдущего ревью (хэш в `_meta.geminiSourceHash`). Дешёвый и быстрый для CI/CD. |
| `npm run predeploy:check` | Только шаги 1–2 (проверки). Файлы не меняет. |
| `npm run predeploy` | Полная цепочка: check → propagate → translate → **gemini-review** → patch-bundled → sitemap → build → prerender. |
| `npm run predeploy:offline` | То же, но без вызова Google/Gemini API. |

## Полный pipeline

```
1. i18n:check                ─►  ru/common.json содержит все t('...') из кода?
2. routes:check              ─►  router.tsx ↔ prerender.PUBLIC_ROUTES синхронизированы?
3. i18n:propagate            ─►  Новые ключи раскатать на 108 локалей (EN placeholder).
4. translate-locales         ─►  Google API: needsRefresh языки → родной язык.
5. review-locales-with-gemini ─►  Gemini-2.5-flash правит классические косяки Google
                                  (Trial→суд, bag→trunk, brands→preserved, …).
                                  --skip-if-fresh: пропускает уже отревьюенные.
6. patch-bundled-translations ─►  Восстановить ручные переводы 10 bundled langs.
7. sitemap                   ─►  Сгенерить sitemap.xml (432 URL × hreflang).
8. vite build                ─►  Продакшн-бандл в dist/.
9. prerender                 ─►  432 локализованных HTML с SEO в dist/{lang}/.../index.html.
```

## Как работает Gemini-ревью

Файл [scripts/review-locales-with-gemini.mjs](../apps/frontend/scripts/review-locales-with-gemini.mjs) на каждом языке:

1. Загружает `public/locales/<lang>/common.json` + `ru/common.json` + `_glossary.json`.
2. Строит promt с глоссарием брендов (VibeVox, Quest Flow, Stripe, …) и описанием
   типичных провалов Google Translate (`Trial→юриспруденция`, `Plus→брэнд!=прилаг.`).
3. Шлёт в `gemini-2.5-flash` с `responseSchema` (структурированный JSON-вывод).
4. Получает `{fixes: [{path, current, proposed, reason}]}`.
5. Валидирует: пропускает фиксы, ломающие плейсхолдеры `{{count}}` / `{{room}}`.
6. Применяет фиксы (если `--apply`); пишет отчёт в `reports/llm-review/<lang>.md`.
7. В `_meta` сохраняет `geminiReviewedAt`, `geminiModel`, `geminiFixCount`, `geminiSourceHash`.

**Skip-if-fresh:** скрипт сравнивает хэш текущего `ru/common.json` с `_meta.geminiSourceHash`
в целевом файле. Если совпадает — пропускает (источник не менялся, повторять нечего).
Если в коде добавили новые ключи → propagate → translate → Gemini увидит несовпадение хэша
и переревьюит только эти языки. На стабильной кодовой базе деплой проходит без Gemini-затрат.

## Когда что запускать

### Добавил `t('newKey')` в код

```bash
# 1. Положи ключ в источник
vim public/locales/ru/common.json
vim public/locales/en/common.json   # необязательно, но желательно

# 2. Раскатать на все 108 языков
npm run i18n:propagate

# 3. Прогнать Google Translate (нужен ключ)
GOOGLE_TRANSLATE_API_KEY=… npm run translate:locales

# 4. Убедиться, что код тоже видит ключ
npm run i18n:check
```

### Добавил новую публичную страницу (`/pricing`, например)

```bash
# 1. Добавь маршрут в src/router.tsx (вне <RequireAuth />)
# 2. Зарегистрируй её для SEO:
#    scripts/prerender.mjs  → PUBLIC_ROUTES.push({ path: '/pricing', ... })
#    scripts/sitemap.mjs    → PUBLIC_ROUTES.push({ path: '/pricing', ... })
# 3. Если у страницы свои meta — добавь ключи в common.json и сошлись на них:
#    PUBLIC_ROUTES = [{ path: '/pricing', titleKey: 'pricing.seoTitle', descKey: 'pricing.seoDesc' }]
# 4. Проверь синхронизацию:
npm run routes:check
```

### Деплой

```bash
# Локально (или в CI):
npm run predeploy                    # с переводами
# или
npm run predeploy:offline            # без Google API (EN placeholder на неизвестных языках)

# После — деплой dist/:
#   • dist/index.html              ─ английский (без префикса)
#   • dist/{ru,es,…}/index.html    ─ 107 других языков
#   • dist/sitemap.xml             ─ 432 URL для бота
#   • dist/assets/*.js             ─ React bundle
```

## CI рекомендации

GitHub Actions / GitLab CI: на `push` в main-ветку:

```yaml
- run: cd apps/frontend && npm ci
- run: cd apps/frontend && npm run predeploy:check       # быстрый прогон без побочек
- run: cd apps/frontend && npm run predeploy             # полный pipeline
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
- run: # деплой dist/ — Netlify/Vercel/S3/…
```

Если CI без секретов (PR от форков): используй `predeploy:offline` — деплой
всё равно соберётся, просто новые ключи на 96 неосновных языках останутся
английским placeholder'ом до следующего прогона с ключом.

## Каноничный формат URL

Согласовано во всех трёх местах (`SeoMeta.tsx`, `scripts/prerender.mjs`,
`scripts/sitemap.mjs`):

- `en` — без префикса: `https://vibevox.app/auth/login`
- остальные 107 — с префиксом: `https://vibevox.app/{lang}/auth/login`
- `x-default` hreflang всегда указывает на английскую (без префикса) версию.

После hydratation на клиенте `LangPathSync` срезает `/{lang}/` префикс, и
React Router работает с короткими путями. Бот видит длинные локализованные URL,
пользователь — короткие.
