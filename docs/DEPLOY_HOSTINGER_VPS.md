# VibeVox — Деплой на Hostinger VPS + локальный PostgreSQL (Вариант A)

> Главный вопрос, на который отвечает этот документ: **как устроена БД при деплое и
> почему обновления программы НИКОГДА не перезаписывают данные пользователей.**
>
> Сценарий: **self-host на Hostinger VPS** (root-доступ), **PostgreSQL стоит локально
> на том же VPS** (Вариант A). Данные БД физически живут в `/var/lib/postgresql` —
> отдельно от папки приложения, поэтому любые выкатки кода их не трогают.
>
> Связанные доки: [VPS_DB_SETUP.md](VPS_DB_SETUP.md) (общая БД-инструкция),
> [DEPLOY.md](DEPLOY.md) (общий чек-лист, фронт/SEO/безопасность).

---

## 0. TL;DR

1. БД создаётся **один раз** командой `npm run db:setup` (выполняет `init.sql`).
2. При **каждом старте** сервера применяются только **аддитивные** миграции
   (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) — никаких `DROP`/`TRUNCATE`.
3. Поэтому **обновление = `git pull → build → pm2 restart`**, и данные остаются на месте.
4. `db:setup` при обновлениях **НЕ запускают** — только при самой первой установке.
5. В `NODE_ENV=production` тихий JSON-fallback **запрещён жёстко в коде** — данные
   никогда не уйдут в эфемерный `db_fallback.json`.

---

## 1. Архитектура (Вариант A)

```
Hostinger VPS (Ubuntu 22/24)
├─ PostgreSQL 16           ← данные в /var/lib/postgresql  (НЕ в папке приложения!)
│     localhost:5432, БД vibevox_db, юзер vibevox_admin
├─ /var/www/vibevox        ← git-репозиторий приложения (сюда git pull; данных БД тут НЕТ)
│   ├─ apps/backend/dist   → node dist/server.js  (pm2, порт 3001)
│   └─ apps/frontend/dist  → статика (npm run build:full)
├─ nginx                   → :443 → статика фронта + reverse-proxy /api → 127.0.0.1:3001
└─ /backups                ← pg_dump по cron
```

Ключевой принцип неразрушаемости: **код и данные физически разделены.**
Деплой переписывает только `/var/www/vibevox`. Postgres в `/var/lib/postgresql`
живёт своей жизнью и не пересоздаётся никогда.

---

## 2. Как создаётся БД — жизненный цикл

Схему БД формируют ТРИ источника, и только **первый** создаёт таблицы:

### ① Один раз при установке — `npm run db:setup`
Скрипт [apps/backend/scripts/db-setup.mjs](../apps/backend/scripts/db-setup.mjs):
- подключается к Postgres по `.env`;
- проверяет `SELECT to_regclass('public.tenants')`;
- **если `tenants` уже есть → `init.sql` ПРОПУСКАЕТСЯ (данные не тронуты);**
- если нет → выполняет [apps/backend/src/db/init.sql](../apps/backend/src/db/init.sql):
  создаёт таблицы `tenants, users, subscriptions, promo_codes, sip_trunks, rooms,
  room_messages, tenant_quest_flow_keys, tenant_need_tags, client_tag_assignments,
  account_blocklist, partners, …`, индексы, триггеры `updated_at`, RLS-политики.

### ② При КАЖДОМ старте сервера — `runStartupMigrations()`
[apps/backend/src/db/migrations.ts](../apps/backend/src/db/migrations.ts):
- ~40 миграций, **все аддитивные и идемпотентные**:
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`;
- при ошибке **не падают** (пишут warning) — добавляют только недостающее.

### ③ Бутстрап в коде (`db/index.ts`)
`CREATE TABLE IF NOT EXISTS rooms …` на старте — тоже идемпотентный.

---

## 3. Почему обновления НЕ перезаписывают данные (гарантии)

Проверено: **`DROP TABLE` / `TRUNCATE` нет ни в `init.sql`, ни в миграциях, ни в коде.**

| Источник схемы | Что будет при повторном запуске на существующей БД |
|---|---|
| `npm run db:setup` | Guard по `tenants` → `init.sql` **не выполняется** вообще |
| `init.sql` (если запустить напрямую) | Голый `CREATE TABLE tenants` → **ошибка «relation already exists» и остановка**, данные НЕ перезаписываются |
| Миграции (на каждом старте) | Только `IF NOT EXISTS` / `ADD COLUMN` / `ON CONFLICT DO NOTHING` → **чистое дополнение** |

**Итог:** цикл обновления `git pull → npm run build → pm2 restart` прогоняет миграции
вхолостую, и **все пользователи / подписки / комнаты / сообщения остаются нетронутыми.**
Это поведение заложено в архитектуру — отдельных действий не требуется, кроме одного:
данные должны жить в **настоящем Postgres**, а не в fallback-файле (см. §4).

---

## 4. Защита от потери данных

### 4.1. Тихий JSON-fallback (главная и единственная реальная угроза)
В dev-режиме при недоступности Postgres backend молча переключается на эмулятор
`db_fallback.json` (файл в папке приложения). В проде это опасно: кратковременный
обрыв Postgres → данные пишутся в эфемерный файл → теряются при рестарте/деплое.

**Защита (двойная):**
- ✅ **В коде** ([db/index.ts](../apps/backend/src/db/index.ts), `FALLBACK_DISABLED`):
  при `NODE_ENV=production` fallback **запрещён всегда**, даже если забыть env-флаг.
  При недоступности БД сервис отдаст явную ошибку, а не уйдёт тихо в JSON.
- ✅ **В `.env`**: `DB_DISABLE_FALLBACK=true` (дублирует защиту явно).

Признак беды в логах: плашка `[VibeVox Auto-DB] PostgreSQL недоступен`. В проде её быть
не должно.

### 4.2. Бэкапы (настоящая страховка) — cron `pg_dump`
```bash
sudo mkdir -p /backups && sudo chown postgres:postgres /backups
sudo -u postgres crontab -e
# ежедневно в 3:00, хранить 14 дней:
0 3 * * * pg_dump vibevox_db | gzip > /backups/vibevox_$(date +\%F).sql.gz
0 4 * * * find /backups -name 'vibevox_*.sql.gz' -mtime +14 -delete
```
Восстановление: `gunzip -c /backups/vibevox_YYYY-MM-DD.sql.gz | psql vibevox_db`.
Желательно копировать дампы и за пределы VPS (S3 / другой хост).

---

## 5. `.env` для backend (Вариант A) — `apps/backend/.env`

Шаблон: [apps/backend/.env.example](../apps/backend/.env.example).

```ini
# ── База данных: локальный Postgres на этом же VPS ──
DB_HOST=localhost
DB_PORT=5432
DB_USER=vibevox_admin
DB_PASSWORD=<СИЛЬНЫЙ_ПАРОЛЬ>          # НЕ дефолтный 'vibevox_secure_pass'!
DB_NAME=vibevox_db
# DB_SSL не нужен для localhost.
DB_DISABLE_FALLBACK=true              # запрет JSON-fallback (код уже дублирует это в prod)

# ── Режим ──
NODE_ENV=production                   # важно: и для fallback-гейта, и для логов
PORT=3001

# ── Секреты (ОБЯЗАТЕЛЬНО — иначе хардкод-фолбэки, см. аудит C3/C5) ──
JWT_SECRET=<openssl rand -hex 32>
SIP_ENCRYPTION_KEY=<openssl rand -hex 32>

# ── Публичный адрес backend (для медиа Quest Flow) ──
PUBLIC_BASE_URL=https://api.твой-домен

# ── Внешние сервисы (см. docs/DEPLOY.md §2.1) ──
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
GEMINI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
```

Полная сводка переменных БД — в [VPS_DB_SETUP.md](VPS_DB_SETUP.md#переменные-окружения-сводка).

---

## 6. Первый деплой (один раз, пошагово)

### 6.1. Системные пакеты
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib nginx git
# Node 20 LTS (nodesource):
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

### 6.2. Создание БД и пользователя (под postgres)
```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE vibevox_db;
CREATE USER vibevox_admin WITH ENCRYPTED PASSWORD 'СИЛЬНЫЙ_ПАРОЛЬ';
GRANT ALL PRIVILEGES ON DATABASE vibevox_db TO vibevox_admin;
\c vibevox_db
-- расширение uuid требует прав суперюзера — ставим заранее:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- PostgreSQL 15+: дать права на схему public:
GRANT ALL ON SCHEMA public TO vibevox_admin;
SQL
```
> Если позже `npm run db:setup` ругается на `CREATE EXTENSION` (нет прав) — значит
> расширение не создано под postgres; повторите строку выше и запустите db:setup снова.

### 6.3. Код приложения
```bash
sudo mkdir -p /var/www && cd /var/www
sudo git clone <repo> vibevox && cd vibevox
sudo chown -R $USER:$USER /var/www/vibevox
npm ci                                   # ставит все workspaces

cd apps/backend
cp .env.example .env && nano .env        # заполнить по §5
npm run db:setup                         # ← СОЗДАЁТ СХЕМУ ОДИН РАЗ
npm run build                            # tsc → dist/
pm2 start npm --name vibevox-api -- start # запускает: node --env-file=.env dist/server.js
pm2 save && pm2 startup                   # автозапуск после ребута VPS
```

### 6.4. Фронтенд (статика)
```bash
cd /var/www/vibevox/apps/frontend
SITE_ORIGIN=https://твой-домен npm run build:full   # sitemap + vite build + prerender → dist/
```

### 6.5. nginx
Шаблон: `apps/frontend/nginx.example.conf`. Минимум:
```nginx
server {
  server_name твой-домен;
  root /var/www/vibevox/apps/frontend/dist;

  location /api/ { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
  location /uploads/ { proxy_pass http://127.0.0.1:3001; }
  location / { try_files $uri $uri/ /index.html; }   # SPA fallback
}
```
HTTPS — через `sudo certbot --nginx` (Let's Encrypt).

### 6.6. Проверка
```bash
curl -s http://localhost:3001/api/health        # {"status":"ok","database":"connected"}
```

---

## 7. Обновление приложения (данные НЕ трогаются)

```bash
cd /var/www/vibevox
git pull

cd apps/backend && npm ci && npm run build
pm2 restart vibevox-api          # ← миграции применятся сами; БД нетронута

cd ../frontend && npm ci && SITE_ORIGIN=https://твой-домен npm run build:full
sudo systemctl reload nginx      # подхватить новую статику
```

> ⚠️ **`npm run db:setup` при обновлениях НЕ запускают.** Он нужен только при самой
> первой установке. Дальше всю эволюцию схемы делают идемпотентные миграции на старте.
> ⚠️ Никогда не удаляйте/не пересоздавайте кластер Postgres при деплое. Деплой =
> только `/var/www/vibevox`.

---

## 8. Замечание про RLS (важно знать)

`init.sql` включает Row-Level Security на `users/subscriptions/sip_trunks/rooms` с
политиками по сессионной переменной `app.current_tenant_id`. Но приложение
подключается под владельцем таблиц (`vibevox_admin`), а **владелец по умолчанию
обходит RLS** — поэтому фактическую изоляцию тенантов обеспечивает **прикладной слой**
(JWT-middleware в роутерах), а RLS — это «спящий» второй рубеж.

Практический вывод для деплоя: **не переключайте приложение на не-владельца БД без
проверки** — иначе RLS внезапно начнёт резать запросы (вернётся пусто), т.к. код
не выставляет `SET app.current_tenant_id` на каждый запрос. На Варианте A под
`vibevox_admin` всё работает как задумано.

---

## 9. Безопасность ПЕРЕД проддом (must-fix из аудита)

БД-персистентность закрыта, но перед публичным запуском нужно закрыть критичные
дыры backend (см. полный аудит в истории):

- **C1/C2** — добавить `requireSuperAdmin` на `POST/GET /api/auth/system-settings`
  и `/google-settings` (сейчас без авторизации пишут все секреты).
- **C3/C5** — `JWT_SECRET`/`DB_PASSWORD` задать в `.env` (не оставлять хардкод-фолбэки);
  желательно — assert на старте.
- **H4/H5** — auth на `/api/billing/sync-products` и `/api/admin/dialects/*`.
- **H2** — rate-limit на `/api/auth/*` (`express-rate-limit`).
- **CORS** — заменить `app.use(cors())` на allow-list своего домена ([DEPLOY.md §2.2](DEPLOY.md)).

---

## 10. Чек-лист «БД неубиваема»

- [ ] Postgres стоит локально, данные в `/var/lib/postgresql` (не в `/var/www`).
- [ ] `.env`: `NODE_ENV=production`, `DB_DISABLE_FALLBACK=true`, сильный `DB_PASSWORD`.
- [ ] `npm run db:setup` выполнен **один раз**; в логах старта нет плашки Auto-DB fallback.
- [ ] Обновления идут через `git pull → build → pm2 restart` (без `db:setup`).
- [ ] Cron `pg_dump` настроен, дампы копируются за пределы VPS.
- [ ] `/api/health` отвечает `database: connected`.

---

## 11. Турнкей-скрипты (`deploy/`) — 4 критичных пункта одной командой

Закрывают операционные «критичные пункты» из комплексной оценки. Запускаются НА VPS.
Сам код (boot-assert секретов, идемпотентная схема, authZ-замки) уже готов — это лишь исполнение.

**① Секреты + ② ротация** — `deploy/gen-secrets.mjs` (генерит сильные, не-git значения):
```bash
node deploy/gen-secrets.mjs >> apps/backend/.env   # допишет JWT_SECRET, SIP_ENCRYPTION_KEY, SUPERADMIN_DEFAULT_PASSWORD
nano apps/backend/.env                              # проверь, убери дубли если запускал повторно; добавь DB_*, NODE_ENV=production, DB_DISABLE_FALLBACK=true
```
Затем войди суперадмином и **смени пароль** в `/admin/config` (ляжет bcrypt-хэшем в `superadmin-auth.json`, дефолт перестанет действовать). Это и есть ротация git-секретов.

**③ Схема + бэкап** — `deploy/pg-backup.sh`:
```bash
cd apps/backend && npm run db:setup                # один раз (идемпотентно, повторный запуск безопасен)
sudo -u postgres crontab -e                        # ежедневный бэкап:
#   0 3 * * * BACKUP_DIR=/backups bash /var/www/vibevox/deploy/pg-backup.sh >> /var/log/vibevox-backup.log 2>&1
```

**④ Smoke-тест после деплоя** — `deploy/smoke-test.sh` (машинно проверяет, что замки безопасности живы):
```bash
BASE=https://твой-домен bash deploy/smoke-test.sh
# ждём: health=200; system-settings/sync-products/dialects без токена → 401; google-settings GET → 200
```

---

*Создано в рамках аудита 2026-05-30. Вариант A (локальный Postgres на Hostinger VPS).
Защита от тихого fallback внесена в код (db/index.ts, гейт по NODE_ENV).
§11 — турнкей-скрипты deploy/ для 4 критичных пунктов.*
