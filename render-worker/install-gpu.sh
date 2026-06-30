#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# TrendTraffic — установка GPU-рендер-воркера (OpenMontage + torch/CUDA) на
# ДОМАШНЕМ ПК с NVIDIA (напр. RTX 5080). Тот же FastAPI-воркер (render-worker/
# main.py), что и на CPU-VPS, но с GPU-цепочкой OpenMontage — обрабатывает
# тяжёлые шаги: аватар (SadTalker → talking_head) и апскейл (Real-ESRGAN).
#
# ОС: Linux или WSL2 Ubuntu с NVIDIA CUDA (на WSL2 драйвер ставится в Windows,
# в Ubuntu виден через nvidia-smi). Воркер слушает ТОЛЬКО Tailscale-адрес —
# наружу в интернет не торчит. Web-VPS шлёт сюда GPU-шаги по Tailscale.
#
# Запуск (от root / sudo):
#   WORKER_HOST=100.122.182.97 bash install-gpu.sh
# Переопределить:  OPENMONTAGE_DIR=/opt/openmontage WORKER_PORT=8801 bash install-gpu.sh
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

OM_REPO="${OPENMONTAGE_REPO:-https://github.com/calesthio/OpenMontage}"
OM_DIR="${OPENMONTAGE_DIR:-/opt/openmontage}"
VENV="${OM_DIR}/.venv"
REPO_DIR="${TT_DIR:-/opt/tt}"
WORKER_DIR="${REPO_DIR}/render-worker"
HOST="${WORKER_HOST:-100.122.182.97}"   # Tailscale-адрес домашнего ПК (super)
PORT="${WORKER_PORT:-8801}"

[ "$(id -u)" = "0" ] || { echo "Запусти от root (sudo bash install-gpu.sh)"; exit 1; }

echo "== проверка NVIDIA GPU =="
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi -L || true
else
  echo "ВНИМАНИЕ: nvidia-smi не найден. Нужен NVIDIA-драйвер + CUDA."
  echo "  • На WSL2: драйвер ставится в Windows, в Ubuntu CUDA виден автоматически."
  echo "  • Без GPU аватар/апскейл будут падать → конвейер сделает passthrough."
fi

echo "== системные пакеты (git, python venv, ffmpeg, make) =="
apt-get update -y
apt-get install -y git python3 python3-venv python3-pip ffmpeg make build-essential

echo "== OpenMontage: клон + GPU-цепочка (torch/CUDA) =="
if [ ! -d "${OM_DIR}/.git" ]; then
  git clone --depth 1 "${OM_REPO}" "${OM_DIR}"
fi
cd "${OM_DIR}"
[ -d "${VENV}" ] || python3 -m venv "${VENV}"
"${VENV}/bin/pip" install --upgrade pip
# = make install + make install-gpu (через venv-pip, без Makefile PYTHON-переменной)
"${VENV}/bin/pip" install -r requirements.txt
"${VENV}/bin/pip" install -r requirements-gpu.txt
"${VENV}/bin/pip" install diffusers transformers accelerate
# Озвучка для аватара (как на CPU-воркере)
"${VENV}/bin/pip" install piper-tts || echo "(piper-tts не установился — аватар-озвучка может не работать)"
# Диаризация подкаста на 2 голоса (pyannote — нужен torch, есть здесь). Требует HF-токен
# и принятые условия gated-моделей pyannote/speaker-diarization-3.1 + pyannote/segmentation-3.0.
"${VENV}/bin/pip" install "pyannote.audio>=3.1" || echo "(pyannote.audio не установился — /diarize упадёт на разбивку по паузам)"

echo
echo "== проверка torch видит GPU =="
"${VENV}/bin/python" - <<'PY' || echo "(torch/cuda не готов — поставь свежий torch для своей CUDA, см. ниже)"
import torch
print("torch", torch.__version__, "cuda:", torch.cuda.is_available(),
      torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")
PY

echo "== TrendTraffic render-worker: клон/обновление + fastapi/uvicorn =="
if [ ! -d "${REPO_DIR}/.git" ]; then
  git clone --depth 1 https://github.com/DanikVR/trendtraffic "${REPO_DIR}"
else
  git -C "${REPO_DIR}" fetch --depth 1 origin main && git -C "${REPO_DIR}" reset --hard origin/main || true
fi
[ -f "${WORKER_DIR}/main.py" ] || { echo "Нет ${WORKER_DIR}/main.py — проверь клон ${REPO_DIR}"; exit 1; }
"${VENV}/bin/pip" install -r "${WORKER_DIR}/requirements.txt"

echo "== systemd unit trendtraffic-render-gpu =="
cat > /etc/systemd/system/trendtraffic-render-gpu.service <<UNIT
[Unit]
Description=TrendTraffic GPU Render Worker (OpenMontage + CUDA)
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
systemctl enable --now trendtraffic-render-gpu.service
sleep 2

echo "== health =="
curl -fsS "http://${HOST}:${PORT}/health" 2>/dev/null && echo \
  || echo "(воркер ещё стартует / грузит модели — journalctl -u trendtraffic-render-gpu -n 50)"

echo
echo "ГОТОВО. GPU-воркер: http://${HOST}:${PORT} (только Tailscale)."
echo "Дальше — в Админ-панели → Конфигурация → «Рендер: GPU и воркеры»:"
echo "    GPU = «Домашний ПК»,  GPU-воркер = http://${HOST}:${PORT}  → Сохранить."
echo "(эквивалент в .env web-VPS: RENDER_GPU_TARGET=home, RENDER_GPU_WORKER_URL=http://${HOST}:${PORT})"
echo
echo "Если torch не увидел RTX 5080 (новая карта) — поставь свежий CUDA-torch, напр.:"
echo "    ${VENV}/bin/pip install --upgrade torch torchvision --index-url https://download.pytorch.org/whl/cu124"
echo "и перезапусти:  systemctl restart trendtraffic-render-gpu"
