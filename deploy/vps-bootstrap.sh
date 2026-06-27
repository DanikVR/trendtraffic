#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# TrendTraffic — единый bootstrap-установщик веб-приложения на свежий VPS.
# Ubuntu 24.04, запуск ОТ ROOT. Идемпотентный: повторный запуск безопасен.
#
# Делает: системные пакеты → Node 20 + pm2 → PostgreSQL (БД+роль+uuid) →
#         клон repo origin/main → npm ci → сборка shared/backend/frontend →
#         apps/backend/.env с авто-секретами → db:setup → pm2 (backend) →
#         nginx (статика фронта + reverse-proxy /api,/uploads) → health-check.
#
# НЕ ставит OpenMontage/torch — это следующий блок (рендер «Собрать»).
# ffmpeg + python3-venv ставятся заранее как база под CPU-цепочку.
#
# Запуск (после git push моего коммита в origin/main):
#   curl -fsSL https://raw.githubusercontent.com/DanikVR/trendtraffic/main/deploy/vps-bootstrap.sh | bash
# либо просто вставить весь файл в SSH-сессию root.
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

### ── Параметры ──────────────────────────────────────────────────────────────
REPO_URL="https://github.com/DanikVR/trendtraffic.git"
APP_DIR="/var/www/trendtraffic"
DB_NAME="vibevox_db"          # внутреннее имя БД (совпадает с дефолтами кода)
DB_USER="vibevox_admin"
PM2_NAME="trendtraffic-api"
PUBLIC_HOST="http://72.62.0.184"   # позже заменить на https://trendtraffic.pro (+ certbot)
NODE_MAJOR=20
ENV_FILE="${APP_DIR}/apps/backend/.env"

log(){ echo -e "\n\033[1;36m== $* ==\033[0m"; }

[ "$(id -u)" = "0" ] || { echo "Запусти от root (sudo -i)"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

### 1. Системные пакеты ───────────────────────────────────────────────────────
log "Системные пакеты (postgres, nginx, ffmpeg, python, build tools)"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg openssl ffmpeg \
  postgresql postgresql-contrib nginx \
  python3 python3-venv python3-pip build-essential

### 2. Node 20 + pm2 ──────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt "$NODE_MAJOR" ]; then
  log "Node ${NODE_MAJOR} (nodesource)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null 2>&1 || { log "pm2 (global)"; npm i -g pm2; }
log "Версии: node $(node -v), npm $(npm -v)"

### 3. PostgreSQL: служба + роль + БД + uuid ─────────────────────────────────
log "PostgreSQL: запуск службы"
systemctl enable --now postgresql

NEED_ENV=0; [ -f "$ENV_FILE" ] || NEED_ENV=1

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  ROLE_EXISTS=1
else
  ROLE_EXISTS=0
fi

if [ "$ROLE_EXISTS" = "0" ]; then
  log "Создаю роль ${DB_USER}"
  DB_PASSWORD="$(openssl rand -hex 24)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';"
  ( umask 077; echo "${DB_PASSWORD}" > /root/.trendtraffic_db_password )
else
  log "Роль ${DB_USER} уже существует"
  DB_PASSWORD="$(cat /root/.trendtraffic_db_password 2>/dev/null || true)"
  if [ "$NEED_ENV" = "1" ] && [ -z "$DB_PASSWORD" ]; then
    log "Пароль роли не найден, а .env нужно создать → задаю новый пароль роли"
    DB_PASSWORD="$(openssl rand -hex 24)"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';"
    ( umask 077; echo "${DB_PASSWORD}" > /root/.trendtraffic_db_password )
  fi
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  log "Создаю БД ${DB_NAME}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

### 4. Код приложения ─────────────────────────────────────────────────────────
log "Репозиторий → ${APP_DIR}"
mkdir -p /var/www
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" fetch --depth 1 origin main
  git -C "${APP_DIR}" reset --hard origin/main
else
  git clone --depth 1 "${REPO_URL}" "${APP_DIR}"
fi
cd "${APP_DIR}"

log "npm ci (монорепо, все workspaces)"
npm ci || npm install

log "Сборка: shared → backend → frontend"
npm run build -w @vibevox/shared
npm run build -w @vibevox/backend
( cd apps/frontend && { npm run build || npx vite build; } )

### 5. apps/backend/.env (секреты генерятся на VPS, не хранятся в git) ─────────
if [ "$NEED_ENV" = "1" ]; then
  log "Пишу ${ENV_FILE} (авто-секреты)"
  JWT_SECRET="$(openssl rand -hex 32)"
  SIP_ENCRYPTION_KEY="$(openssl rand -hex 32)"
  SUPERADMIN_DEFAULT_PASSWORD="$(openssl rand -hex 12)"
  ( umask 077; cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_SSL=false
DB_DISABLE_FALLBACK=true
JWT_SECRET=${JWT_SECRET}
SIP_ENCRYPTION_KEY=${SIP_ENCRYPTION_KEY}
SUPERADMIN_DEFAULT_PASSWORD=${SUPERADMIN_DEFAULT_PASSWORD}
FRONTEND_URL=${PUBLIC_HOST}
PUBLIC_BASE_URL=${PUBLIC_HOST}
APP_BASE_URL=${PUBLIC_HOST}
PUBLIC_APP_URL=${PUBLIC_HOST}
GEMINI_FLASH_MODEL=gemini-3.5-flash
EOF
  )
  ( umask 077; echo "${SUPERADMIN_DEFAULT_PASSWORD}" > /root/.trendtraffic_superadmin_password )
else
  log ".env уже есть — не трогаю (секреты сохранены)"
fi

### 6. Инициализация схемы БД (идемпотентно: guard по таблице tenants) ────────
log "db:setup (создаст схему один раз; повторный запуск безопасен)"
( cd "${APP_DIR}/apps/backend" && npm run db:setup )

### 7. Backend через pm2 ──────────────────────────────────────────────────────
log "pm2: backend"
cd "${APP_DIR}/apps/backend"
pm2 delete "${PM2_NAME}" >/dev/null 2>&1 || true
pm2 start npm --name "${PM2_NAME}" -- start
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

### 8. nginx: статика фронта + reverse-proxy ─────────────────────────────────
log "nginx: конфиг trendtraffic"
cat > /etc/nginx/sites-available/trendtraffic <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/trendtraffic/apps/frontend/dist;
    index index.html;

    client_max_body_size 210M;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_read_timeout 600s;
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/trendtraffic /etc/nginx/sites-enabled/trendtraffic
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# UFW (если включён) — открыть 22/80
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
fi

### 9. Health-check ───────────────────────────────────────────────────────────
log "Health-check (ждём старт backend)"
sleep 4
echo -n "backend /api/health → "; curl -fsS http://localhost:3001/api/health || echo "(ещё не готов — см. 'pm2 logs ${PM2_NAME}')"
echo

log "ГОТОВО"
echo "Приложение:  ${PUBLIC_HOST}"
echo "Суперадмин (первый вход), пароль: $(cat /root/.trendtraffic_superadmin_password 2>/dev/null || echo 'см. SUPERADMIN_DEFAULT_PASSWORD в .env')"
echo "Логи backend:  pm2 logs ${PM2_NAME}"
echo "Пароль БД сохранён в /root/.trendtraffic_db_password"
echo
echo "Дальше: 1) смени root-пароль (passwd);  2) привяжи trendtraffic.pro к 72.62.0.184 и поставь HTTPS (certbot --nginx)."
