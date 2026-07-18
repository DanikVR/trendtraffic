#!/usr/bin/env bash
# Установка матинг-воркера в WSL Ubuntu (GPU-ПК). Запуск: sudo bash install-wsl.sh
# Ставит venv (/opt/tt-matting), torch cu128 + fastapi, прогревает модель RVM,
# создаёт systemd-юнит trendtraffic-matting (порт 8801) и запускает его.
# Код воркера БЕРЁТСЯ ИЗ ЭТОЙ ПАПКИ (копируется в /opt/tt-matting) — обновление кода =
# повторный запуск скрипта (venv и модель переиспользуются, ставится быстро).
set -euo pipefail

DIR=/opt/tt-matting
SRC="$(cd "$(dirname "$0")" && pwd)"
PORT="${MATTING_PORT:-8801}"

echo "== venv =="
apt-get install -y -q python3-venv ffmpeg >/dev/null 2>&1 || true
mkdir -p "$DIR"
[ -x "$DIR/.venv/bin/python" ] || python3 -m venv "$DIR/.venv"
"$DIR/.venv/bin/pip" -q install --upgrade pip

echo "== torch cu128 (крупный — один раз, дальше кэш pip) =="
"$DIR/.venv/bin/pip" -q install torch torchvision --index-url https://download.pytorch.org/whl/cu128
"$DIR/.venv/bin/pip" -q install fastapi "uvicorn[standard]" numpy

echo "== код воркера =="
cp "$SRC/main.py" "$DIR/main.py"

echo "== прогрев модели (веса RVM → ~/.cache/torch) =="
"$DIR/.venv/bin/python" - <<'PY'
import torch
m = torch.hub.load("PeterL1n/RobustVideoMatting", "mobilenetv3", trust_repo=True)
print("RVM mobilenetv3 готов; cuda:", torch.cuda.is_available())
PY

echo "== systemd =="
cat > /etc/systemd/system/trendtraffic-matting.service <<UNIT
[Unit]
Description=TrendTraffic Matting Worker (RobustVideoMatting, GPU)
After=network.target

[Service]
WorkingDirectory=$DIR
ExecStart=$DIR/.venv/bin/uvicorn main:app --app-dir $DIR --host 0.0.0.0 --port $PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now trendtraffic-matting
sleep 2
curl -s "http://127.0.0.1:$PORT/health" && echo
echo "OK: воркер на :$PORT. Дальше — форвардер fwd8801.py на Windows (см. README)."
