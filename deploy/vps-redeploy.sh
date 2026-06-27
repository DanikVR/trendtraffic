#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# TrendTraffic — РЕДЕПЛОЙ веб-приложения на web-VPS (srv1787697).
# Обновляет код из origin/main, ставит новые зависимости (напр. @anthropic-ai/sdk),
# пересобирает shared→backend→frontend, гонит миграции, перезапускает pm2.
# Идемпотентный, запуск ОТ ROOT. НЕ трогает существующие секреты в .env.
#
# Базовый запуск:
#   cd /var/www/trendtraffic && git fetch origin main && git reset --hard origin/main \
#     && bash deploy/vps-redeploy.sh
#
# Можно сразу прописать переменные в .env (upsert; передаются как env скрипту):
#   RENDER_WORKER_URL=http://100.81.35.75:8800 \
#   ANTHROPIC_API_KEY=sk-ant-... \
#   bash deploy/vps-redeploy.sh
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/trendtraffic}"
PM2_NAME="${PM2_NAME:-trendtraffic-api}"
ENV_FILE="${APP_DIR}/apps/backend/.env"

log(){ echo -e "\n\033[1;36m== $* ==\033[0m"; }
[ "$(id -u)" = "0" ] || { echo "Запусти от root (sudo -i)"; exit 1; }
[ -d "${APP_DIR}/.git" ] || { echo "Нет ${APP_DIR} — сначала deploy/vps-bootstrap.sh"; exit 1; }

cd "${APP_DIR}"
log "Обновление кода (origin/main)"
git fetch --depth 1 origin main
git reset --hard origin/main

log "npm install (подтянет новые зависимости: @anthropic-ai/sdk и пр.)"
npm ci || npm install

log "Сборка: shared → backend → frontend"
npm run build -w @vibevox/shared
npm run build -w @vibevox/backend
( cd apps/frontend && { npm run build || npx vite build; } )

# ── Опциональный upsert переменных в .env (только если переданы скрипту) ──────
upsert_env(){
  local key="$1" val="$2"
  [ -n "$val" ] || return 0
  [ -f "$ENV_FILE" ] || { echo "  Нет ${ENV_FILE} — пропускаю ${key}"; return 0; }
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
  echo "  .env: ${key} задан"
}
if [ -n "${RENDER_WORKER_URL:-}${RENDER_GPU_WORKER_URL:-}${RENDER_GPU_TARGET:-}${ANTHROPIC_API_KEY:-}" ]; then
  log "Переменные .env (upsert)"
  upsert_env RENDER_WORKER_URL     "${RENDER_WORKER_URL:-}"
  upsert_env RENDER_GPU_WORKER_URL "${RENDER_GPU_WORKER_URL:-}"
  upsert_env RENDER_GPU_TARGET     "${RENDER_GPU_TARGET:-}"
  upsert_env ANTHROPIC_API_KEY     "${ANTHROPIC_API_KEY:-}"
fi

log "Миграции БД (идемпотентно)"
( cd apps/backend && npm run db:setup )

log "Перезапуск backend (pm2 --update-env)"
cd "${APP_DIR}/apps/backend"
pm2 restart "${PM2_NAME}" --update-env || pm2 start npm --name "${PM2_NAME}" -- start
pm2 save || true

log "Health-check (ждём старт)"
sleep 4
echo -n "backend /api/health → "; curl -fsS http://localhost:3001/api/health || echo "(ещё стартует — см. pm2 logs ${PM2_NAME})"
echo
log "ГОТОВО"
echo "Приложение обновлено. Версия в углу страницы должна стать v1.1.8."
echo "Render worker URL в .env: $(grep -m1 '^RENDER_WORKER_URL=' "$ENV_FILE" 2>/dev/null || echo 'не задан (рендер в симуляции)')"
