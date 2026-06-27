#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# TrendTraffic — установка OpenMontage (calesthio/OpenMontage) в CPU-режиме.
# Запуск ОТ ROOT на VPS (Ubuntu 24.04). Идемпотентный.
#
# Ставит ТОЛЬКО бесплатную CPU-цепочку (ffmpeg-инструменты), БЕЗ torch/GPU:
#   core requirements.txt + yt-dlp, faster-whisper, ffmpeg-python, opencv(headless),
#   piper-tts (offline TTS, best-effort) + Remotion composer (Node) best-effort.
# НЕ запускает `make install-gpu` (torch/torchaudio/torchvision) — это для
# домашнего RTX 5080 воркера, а не для CPU-VPS.
#
# OpenMontage = AGPLv3, запускаем отдельным процессом/сервисом под /opt/openmontage
# со своей venv. Наш backend будет дёргать его инструменты через Python-обёртку
# (следующий блок кода: pg-boss + FastAPI bridge).
#
# Запуск:
#   curl -fsSL https://raw.githubusercontent.com/DanikVR/trendtraffic/main/deploy/vps-openmontage.sh | bash
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

OM_REPO="https://github.com/calesthio/OpenMontage.git"
OM_DIR="/opt/openmontage"
VENV="${OM_DIR}/.venv"
PY="${VENV}/bin/python"
PIP="${VENV}/bin/pip"

log(){ echo -e "\n\033[1;36m== $* ==\033[0m"; }
[ "$(id -u)" = "0" ] || { echo "Запусти от root (sudo -i)"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

### 1. Системные зависимости (на случай отдельного запуска без bootstrap) ──────
log "apt: ffmpeg, python venv, git, мультимедиа-библиотеки"
apt-get update -y
apt-get install -y git ffmpeg python3 python3-venv python3-pip build-essential \
  libsndfile1 libgomp1

### 2. Клон/обновление OpenMontage (ветка main) ───────────────────────────────
log "OpenMontage → ${OM_DIR}"
mkdir -p /opt
if [ -d "${OM_DIR}/.git" ]; then
  git -C "${OM_DIR}" fetch --depth 1 origin main
  git -C "${OM_DIR}" reset --hard origin/main
else
  git clone --depth 1 "${OM_REPO}" "${OM_DIR}"
fi
cd "${OM_DIR}"
echo "Python на сервере: $(python3 --version)"

### 3. venv + CPU-зависимости (БЕЗ torch) ─────────────────────────────────────
log "Создаю venv ${VENV}"
[ -d "${VENV}" ] || python3 -m venv "${VENV}"
"${PIP}" install --upgrade pip wheel setuptools

log "pip: core requirements.txt"
"${PIP}" install -r requirements.txt

log "pip: бесплатная CPU-цепочка (без torch)"
# opencv-python-headless — серверный вариант (без GUI/libGL зависимостей).
"${PIP}" install yt-dlp faster-whisper ffmpeg-python opencv-python-headless

log "pip: piper-tts (offline TTS, best-effort — на Python 3.12 колесо может отсутствовать)"
"${PIP}" install piper-tts || echo "  [skip] piper-tts не встал — TTS уйдёт на облачных провайдеров (или поставим в 3.11-venv позже)"

### 4. Remotion composer (Node) — best-effort (для анимир. субтитров/графики) ──
if [ -d "${OM_DIR}/remotion-composer" ] && command -v npm >/dev/null 2>&1; then
  log "Remotion composer: npm install (best-effort)"
  ( cd "${OM_DIR}/remotion-composer" && { npm install || npx --yes npm install || true; } )
fi

### 5. .env: создать из примера + CPU-режим ───────────────────────────────────
log ".env (CPU-режим)"
[ -f "${OM_DIR}/.env" ] || cp "${OM_DIR}/.env.example" "${OM_DIR}/.env"
if grep -q '^VIDEO_GEN_LOCAL_ENABLED=' "${OM_DIR}/.env"; then
  sed -i 's/^VIDEO_GEN_LOCAL_ENABLED=.*/VIDEO_GEN_LOCAL_ENABLED=false/' "${OM_DIR}/.env"
else
  echo 'VIDEO_GEN_LOCAL_ENABLED=false' >> "${OM_DIR}/.env"
fi

### 6. Верификация реестра инструментов (какие доступны на CPU) ───────────────
log "Проверка реестра инструментов (support_envelope)"
cd "${OM_DIR}"
"${PY}" - <<'PYEOF' || echo "  [warn] не удалось опросить реестр — посмотри вывод выше"
import json
from tools.tool_registry import registry
registry.discover()
try:
    env = registry.support_envelope()
    tools = env if isinstance(env, list) else env.get("tools", env)
    n = len(tools) if hasattr(tools, "__len__") else "?"
    print(f"OK: реестр загрузился, инструментов в envelope: {n}")
except Exception as e:
    print(f"support_envelope error: {e}")
PYEOF

log "ГОТОВО — OpenMontage (CPU) установлен"
echo "Каталог:           ${OM_DIR}"
echo "Python (venv):     ${PY}"
echo "Запуск инструмента: ${PY} -c \"from tools.tool_registry import registry; registry.discover(); ...\""
echo "Вывод рендера:     ${OM_DIR}/projects/<name>/renders/final.mp4"
echo
echo "torch НЕ ставился (CPU-only). GPU-инструменты (апскейл/аватар/локальная ген) —"
echo "позже на домашнем RTX 5080 воркере через 'make install-gpu'."
echo "Дальше: наша Python-обёртка (FastAPI) + pg-boss — связь backend ↔ OpenMontage."
