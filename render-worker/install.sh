#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# TrendTraffic — установка рендер-воркера (FastAPI-обёртка OpenMontage) как
# systemd-сервиса на РЕНДЕР-VPS. Запуск ОТ ROOT, ПОСЛЕ vps-openmontage.sh.
#
# Воркер слушает ТОЛЬКО Tailscale-адрес (по умолчанию 100.81.35.75:8800) —
# наружу в интернет не торчит. Web-VPS дёргает его по Tailscale.
#
# Запуск:
#   curl -fsSL https://raw.githubusercontent.com/DanikVR/trendtraffic/main/render-worker/install.sh | bash
# (или:  bash /opt/tt/render-worker/install.sh)
# Переопределить адрес/порт:  WORKER_HOST=100.x WORKER_PORT=8800 bash install.sh
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

OM_DIR="${OPENMONTAGE_DIR:-/opt/openmontage}"
VENV="${OM_DIR}/.venv"
REPO_DIR="/opt/tt"
WORKER_DIR="${REPO_DIR}/render-worker"
HOST="${WORKER_HOST:-100.81.35.75}"   # Tailscale-адрес рендер-VPS (srv1781410)
PORT="${WORKER_PORT:-8800}"

[ "$(id -u)" = "0" ] || { echo "Запусти от root"; exit 1; }
[ -d "$VENV" ] || { echo "Нет venv OpenMontage ($VENV). Сначала: bash /opt/tt/deploy/vps-openmontage.sh"; exit 1; }

# Обновить репозиторий (чтобы render-worker был свежим)
if [ -d "${REPO_DIR}/.git" ]; then
  git -C "${REPO_DIR}" fetch --depth 1 origin main && git -C "${REPO_DIR}" reset --hard origin/main || true
fi
[ -f "${WORKER_DIR}/main.py" ] || { echo "Нет ${WORKER_DIR}/main.py — обнови /opt/tt из репозитория"; exit 1; }

echo "== pip: fastapi/uvicorn в venv OpenMontage =="
"${VENV}/bin/pip" install -r "${WORKER_DIR}/requirements.txt"

echo "== systemd unit trendtraffic-render =="
cat > /etc/systemd/system/trendtraffic-render.service <<UNIT
[Unit]
Description=TrendTraffic Render Worker (OpenMontage FastAPI)
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
WorkingDirectory=${OM_DIR}
Environment=OPENMONTAGE_DIR=${OM_DIR}
ExecStart=${VENV}/bin/uvicorn main:app --app-dir ${WORKER_DIR} --host ${HOST} --port ${PORT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable trendtraffic-render.service
systemctl restart trendtraffic-render.service   # restart, а не enable --now: иначе уже запущенный сервис держит старый код
sleep 2

echo "== health =="
curl -fsS "http://${HOST}:${PORT}/health" 2>/dev/null && echo \
  || echo "(воркер ещё стартует — проверь: systemctl status trendtraffic-render; journalctl -u trendtraffic-render -n 50)"

echo
echo "ГОТОВО. Воркер: http://${HOST}:${PORT} (только Tailscale)."
echo "Теперь на WEB-VPS (srv1787697) задай в apps/backend/.env:"
echo "    RENDER_WORKER_URL=http://${HOST}:${PORT}"
echo "и перезапусти backend:  pm2 restart trendtraffic-api --update-env"
