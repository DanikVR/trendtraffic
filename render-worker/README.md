# TrendTraffic — Render Worker (Python FastAPI обёртка OpenMontage)

Запускается на **рендер-VPS** (`srv1781410`, Tailscale `100.81.35.75`). Принимает от
web-VPS по одному шагу плана рендера, вызывает инструмент OpenMontage и отдаёт результат.

## Архитектура
```
web-VPS (Node оркестратор)               рендер-VPS (этот воркер)
  render/worker.ts (поллер очереди)
  render/executor_http.ts  ──HTTP по Tailscale──►  POST /execute  { tool, params, input_url }
                                                       │ скачивает вход с web-VPS /uploads
                                                       │ registry.get(tool).execute(inputs)
                                                       ▼
                          ◄──GET /files/<name>──   { output_name }
  сохраняет в uploads/renders → Галерея
```

## Установка (на рендер-VPS, от root, после `vps-openmontage.sh`)
```
bash /opt/tt/render-worker/install.sh
```
Ставит `fastapi`/`uvicorn` в venv OpenMontage и поднимает systemd-сервис
`trendtraffic-render`, слушающий **только** Tailscale-адрес `100.81.35.75:8800`.

Затем на **web-VPS** в `apps/backend/.env`:
```
RENDER_WORKER_URL=http://100.81.35.75:8800
```
и `pm2 restart trendtraffic-api --update-env`. После этого кнопка «Собрать» гонит
реальный рендер (а не симуляцию).

## Эндпоинты
- `GET /health` → `{ ok, tools }` — реестр загружен, число инструментов.
- `POST /execute` → один шаг: скачать вход, вызвать инструмент, вернуть `{ output_name | skipped | note }`.
- `POST /transcribe` → `{ input_url }` → `{ segments: [{start,end,text}] }` — транскрипт (faster-whisper)
  для ИИ-режиссёра (выбор лучшего момента в узле «Длина»).
- `GET /files/<name>` — отдать произведённый файл (web-VPS его забирает).

## GPU-воркер (домашний ПК, RTX 5080) — для аватара/апскейла
Тот же `main.py`, но с GPU-цепочкой OpenMontage (torch/CUDA). Обрабатывает шаги
`talking_head` (аватар, SadTalker) и `upscale` (Real-ESRGAN). Ставится на домашний
ПК (Linux/WSL2 с NVIDIA), от root:
```
WORKER_HOST=100.122.182.97 bash /opt/tt/render-worker/install-gpu.sh
```
Поднимает systemd-сервис `trendtraffic-render-gpu` на `100.122.182.97:8801` (только
Tailscale). Затем в **Админ-панели → Конфигурация → «Рендер: GPU и воркеры»**: GPU =
«Домашний ПК», GPU-воркер = `http://100.122.182.97:8801` → Сохранить. (Эквивалент в
`.env` web-VPS: `RENDER_GPU_TARGET=home`, `RENDER_GPU_WORKER_URL=...`.)

## Управление
```
systemctl status trendtraffic-render
journalctl -u trendtraffic-render -n 100 -f
systemctl restart trendtraffic-render
```

## Заметки v1
- Диспетчер инструментов **универсальный**: вход + параметры узла → `tool.execute(inputs)`.
  Точная карта `inputs` под каждый инструмент OpenMontage дорабатывается на первых
  реальных прогонах — это видно по `note` каждого шага в статусе задачи.
- Любая неуверенность/ошибка инструмента → **passthrough** (вход=выход) + note, чтобы
  не падал весь конвейер.
- GPU-шаги (avatar/upscale) на CPU-VPS не маршрутизируются — web-VPS шлёт их на
  GPU-воркер (домашняя RTX 5080) по `RENDER_GPU_WORKER_URL`, с учётом переключателя
  GPU в админке. Тот же `main.py` обслуживает оба (CPU/GPU) — отличаются лишь
  установленные зависимости (torch на GPU-машине) и какие шаги им маршрутизируются.
