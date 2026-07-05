#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# TrendTraffic — установка Hotebook-воркера (обёртка notebooklm-py) как
# systemd-сервиса. Ставится РЯДОМ с render-worker: на домашнем GPU-воркере
# (WSL) или на рендер-VPS — где угодно, где есть Tailscale и python3.10+.
#
# Адрес: если tailscale есть в этой ОС — слушаем только его IP; в WSL с
# mirrored-сетью (Tailscale на Windows-хосте) — 0.0.0.0 (наружу всё равно
# только через Tailscale хоста). Порт 8802 (8800/8801 заняты рендер-воркерами).
#
# Запуск:  bash /opt/tt/notebooklm-worker/install.sh
# Переопределить адрес/порт:  WORKER_HOST=100.x WORKER_PORT=8802 bash install.sh
#
# Данные (профиль Google-аккаунта + готовые артефакты) живут ВНЕ репозитория:
#   /opt/tt-hotebook/home  — NOTEBOOKLM_HOME (storage_state.json и т.п.)
#   /opt/tt-hotebook/out   — файлы готовых генераций (отдаются в /files)
#
# Подключение аккаунта (один раз, на машине с браузером):
#   /opt/tt-hotebook/.venv/bin/notebooklm login        (откроется браузер)
#   либо скопировать storage_state.json в /opt/tt-hotebook/home/profiles/default/
#   либо импортировать куки через настройки TrendTraffic (Enterprise → Hotebook).
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/tt}"
WORKER_DIR="${REPO_DIR}/notebooklm-worker"
DATA_DIR="/opt/tt-hotebook"
VENV="${DATA_DIR}/.venv"
HOST="${WORKER_HOST:-$(tailscale ip -4 2>/dev/null | head -1 || true)}"
HOST="${HOST:-0.0.0.0}"   # WSL mirrored: Tailscale живёт на Windows-хосте
PORT="${WORKER_PORT:-8802}"

[ "$(id -u)" = "0" ] || { echo "Запусти от root"; exit 1; }
[ -f "${WORKER_DIR}/main.py" ] || { echo "Нет ${WORKER_DIR}/main.py — обнови ${REPO_DIR} из репозитория"; exit 1; }

mkdir -p "${DATA_DIR}/home" "${DATA_DIR}/out"

echo "== venv + pip (fastapi/uvicorn/notebooklm-py) =="
if [ ! -d "$VENV" ]; then python3 -m venv "$VENV"; fi
"${VENV}/bin/pip" install -q --upgrade pip
"${VENV}/bin/pip" install -q -r "${WORKER_DIR}/requirements.txt"

echo "== systemd unit trendtraffic-notebooklm =="
cat > /etc/systemd/system/trendtraffic-notebooklm.service <<UNIT
[Unit]
Description=TrendTraffic Hotebook Worker (NotebookLM FastAPI)
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
WorkingDirectory=${WORKER_DIR}
Environment=NOTEBOOKLM_HOME=${DATA_DIR}/home
Environment=NOTEBOOKLM_OUT=${DATA_DIR}/out
Environment=DISPLAY=:0
ExecStart=${VENV}/bin/uvicorn main:app --app-dir ${WORKER_DIR} --host ${HOST} --port ${PORT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

# keepalive: продлеваем сессию КАЖДОГО профиля-тенанта (не только default),
# т.к. подключение пер-тенантное. Скрипт перебирает все профили в NOTEBOOKLM_HOME.
cat > "${DATA_DIR}/refresh-all.sh" <<'RSH'
#!/usr/bin/env bash
HOME_DIR="${NOTEBOOKLM_HOME:-/opt/tt-hotebook/home}"
NB="__VENV__/bin/notebooklm"
for d in "${HOME_DIR}"/profiles/*/; do
  [ -f "${d}/storage_state.json" ] || continue
  p="$(basename "$d")"
  "$NB" -p "$p" auth refresh --quiet || true
done
RSH
sed -i "s#__VENV__#${VENV}#" "${DATA_DIR}/refresh-all.sh"
chmod +x "${DATA_DIR}/refresh-all.sh"

echo "== systemd timer: продление сессий Google всех тенантов (раз в сутки) =="
cat > /etc/systemd/system/trendtraffic-notebooklm-refresh.service <<UNIT
[Unit]
Description=TrendTraffic Hotebook — keepalive сессий NotebookLM (все профили)

[Service]
Type=oneshot
Environment=NOTEBOOKLM_HOME=${DATA_DIR}/home
ExecStart=${DATA_DIR}/refresh-all.sh
UNIT
cat > /etc/systemd/system/trendtraffic-notebooklm-refresh.timer <<UNIT
[Unit]
Description=TrendTraffic Hotebook — ежесуточный keepalive сессии

[Timer]
OnBootSec=10min
OnUnitActiveSec=24h
Persistent=true

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable trendtraffic-notebooklm.service trendtraffic-notebooklm-refresh.timer
systemctl restart trendtraffic-notebooklm.service   # restart: уже запущенный держит старый код
systemctl start trendtraffic-notebooklm-refresh.timer || true
sleep 2

echo "== health =="
curl -fsS "http://${HOST}:${PORT}/health" 2>/dev/null && echo \
  || echo "(воркер ещё стартует — проверь: systemctl status trendtraffic-notebooklm; journalctl -u trendtraffic-notebooklm -n 50)"

echo
echo "ГОТОВО. Hotebook-воркер слушает ${HOST}:${PORT}."
if [ "$HOST" = "0.0.0.0" ]; then
  # WSL: Tailscale живёт на Windows-хосте — VPS ходит на ЕГО Tailscale-адрес, не 0.0.0.0.
  TS_HINT="$(tailscale ip -4 2>/dev/null | head -1)"
  [ -n "$TS_HINT" ] || TS_HINT="<Tailscale-IP-этой-машины, напр. 100.122.182.97>"
  echo "ВНИМАНИЕ: воркер в WSL. На WEB-VPS в apps/backend/.env укажи Tailscale-адрес ЭТОЙ машины (НЕ 0.0.0.0):"
  echo "    NOTEBOOKLM_WORKER_URL=http://${TS_HINT}:${PORT}"
else
  echo "На WEB-VPS задай в apps/backend/.env:"
  echo "    NOTEBOOKLM_WORKER_URL=http://${HOST}:${PORT}"
fi
echo "и перезапусти backend:  pm2 restart trendtraffic-api --update-env"
