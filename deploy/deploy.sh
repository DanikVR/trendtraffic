#!/usr/bin/env bash
# ============================================================================
# VibeVox — идемпотентный апдейт на VPS. Запускается НА сервере (вручную по SSH
# или из GitHub Actions). Данные пользователей НЕ трогает: миграции на старте
# только аддитивные (ADD COLUMN IF NOT EXISTS), db:setup здесь НЕ вызывается.
#
# Использование на VPS:
#   cd /var/www/vibevox && bash deploy/deploy.sh
# Переменные (необязательно):
#   SITE_ORIGIN=https://your-domain   — для сборки фронта (sitemap/prerender)
#   BASE=http://localhost:3001        — куда стучится smoke-test
#   PM2_NAME=vibevox-api              — имя процесса pm2
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."                 # корень репозитория
PM2_NAME="${PM2_NAME:-vibevox-api}"
SITE_ORIGIN="${SITE_ORIGIN:-https://your-domain}"

echo "==> [1/6] git pull (только fast-forward — без локальных правок на сервере!)"
git pull --ff-only

echo "==> [2/6] backend: зависимости + сборка"
( cd apps/backend && npm ci && npm run build )

echo "==> [3/6] backend: рестарт (идемпотентные миграции применятся сами на старте)"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  ( cd apps/backend && pm2 start npm --name "$PM2_NAME" -- start )
  pm2 save
fi

echo "==> [4/6] frontend: сборка статики"
( cd apps/frontend && npm ci && SITE_ORIGIN="$SITE_ORIGIN" npm run build:full )

echo "==> [5/6] nginx: подхватить новую статику"
sudo systemctl reload nginx || echo "  (nginx reload пропущен — проверьте вручную)"

echo "==> [6/6] smoke-test (проверка, что замки безопасности живы)"
BASE="${BASE:-http://localhost:3001}" bash deploy/smoke-test.sh || echo "  ⚠ smoke-test дал предупреждение — посмотрите вывод выше"

echo "✅ deploy завершён. db:setup НЕ запускался (он нужен только при ПЕРВОЙ установке)."
