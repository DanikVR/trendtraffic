# Подключение VibeVox к PostgreSQL на VPS / хостинге

Пошаговый перевод сервиса с локального JSON-fallback на настоящую базу PostgreSQL.
После этого пропадают «магические» баги fallback-режима — все SQL-запросы идут в реальную БД.

---

## 0. Зачем

Сейчас (без Postgres) backend работает в режиме `db_fallback.json` — это эмулятор БД для
локальной разработки. Каждый SQL-запрос там обрабатывается вручную, и любой новый запрос,
для которого нет обработчика, «молча» возвращает пусто. На настоящем PostgreSQL такого нет.

---

## 1. Создайте БД на хостинге

В панели хостинга (Hostinger и т.п.) создайте:
- базу данных (например `vibevox_db`),
- пользователя с паролем и полными правами на эту БД,
- запишите: **host, port (обычно 5432), user, password, db name**.
- Если есть «Remote MySQL/PostgreSQL» / whitelist — **добавьте IP вашего сервера** (или `%` на время настройки).

> Managed-PostgreSQL почти всегда требует **SSL** — это учтено (`DB_SSL=true`).

---

## 2. Заполните `apps/backend/.env`

Скопируйте `apps/backend/.env.example` → `apps/backend/.env` и задайте БД одним из способов.

**Способ A — строка подключения (рекомендуется):**
```
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/vibevox_db?sslmode=require
DB_SSL=true
DB_DISABLE_FALLBACK=true
```

**Способ B — по полям:**
```
DB_HOST=ваш-хост
DB_PORT=5432
DB_USER=ваш-пользователь
DB_PASSWORD=ваш-пароль
DB_NAME=vibevox_db
DB_SSL=true
DB_DISABLE_FALLBACK=true
```

> `DB_DISABLE_FALLBACK=true` — **обязательно в проде**: если БД недоступна, сервис
> упадёт с понятной ошибкой, а не уйдёт тихо в JSON-файл.

Заодно задайте публичный адрес (для медиа через Quest Flow):
```
PUBLIC_BASE_URL=https://impeditive-jeneva-overambitiously.ngrok-free.dev   # сейчас (ngrok)
# на проде: PUBLIC_BASE_URL=https://ваш-домен
```

---

## 3. Создайте схему (один раз)

```
cd apps/backend
npm run db:setup
```

Скрипт подключится к БД, создаст таблицы из `src/db/init.sql` и выведет список таблиц.
Если таблицы уже есть — данные не трогаются.

> Если `CREATE EXTENSION "uuid-ossp"` выдаёт ошибку прав — выполните один раз под
> админом БД: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`, затем повторите `npm run db:setup`.

---

## 4. Запустите сервер

```
cd apps/backend
npm run build && npm start      # прод
# или для разработки:
npm run dev
```

При старте автоматически применятся ALTER-миграции (новые колонки). В логах НЕ должно быть
плашки `[VibeVox Auto-DB] PostgreSQL недоступен`. Если она есть — значит креды/SSL неверны
(а с `DB_DISABLE_FALLBACK=true` сервер просто не отдаст данные и покажет ошибку).

---

## 5. Проверьте

```
curl -s http://localhost:3001/api/health
```
Ответ `{"status":"ok","database":"connected"}` — БД подключена.

---

## 6. Перенос данных из db_fallback.json (если нужно)

Если в локальном `db_fallback.json` есть нужные аккаунты/комнаты — их можно перенести
вручную (это JSON со всеми таблицами). Обычно для прод-старта это не требуется —
регистрируетесь заново уже на настоящей БД. Скажите, если нужен скрипт миграции данных.

---

## Переменные окружения (сводка)

| Переменная                  | Назначение                                              |
|-----------------------------|--------------------------------------------------------|
| `DATABASE_URL`              | Строка подключения целиком (приоритетнее DB_*)         |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | Параметры БД по отдельности                        |
| `DB_SSL`                    | `true` для удалённой БД (SSL)                           |
| `DB_SSL_REJECT_UNAUTHORIZED`| `true` — строгая проверка сертификата (по умолч. false) |
| `DB_DISABLE_FALLBACK`       | `true` в проде — запрет тихого JSON-fallback           |
| `DB_POOL_MAX`               | размер пула (по умолч. 20)                             |
| `DB_CONNECT_TIMEOUT_MS`     | таймаут коннекта (по умолч. 10000)                    |
| `PUBLIC_BASE_URL`           | публичный https-адрес backend (для медиа Quest Flow)   |
