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
- `POST /diarize` → `{ input_url, hf_token? }` → `{ lines: [{speaker,text,start,end}] }` — разбор записи
  подкаста на 2 голоса. С `hf_token` и установленным `pyannote.audio` — настоящая диаризация
  pyannote 3.1; иначе фолбэк: транскрипт + разделение по паузам.
- `GET /files/<name>` — отдать произведённый файл (web-VPS его забирает).

## Подкаст-сцена (`podcast_compose`)
Узел «Подкаст» в TrendFlow собирается одним шагом `podcast_compose` (см. `_podcast_compose`):
озвучка реплик (реальный голос из записи при диаризации, иначе Piper TTS) → говорящая сторона
(`talking_head`/SadTalker на GPU-воркере, иначе статичное фото) + статичное фото второго ведущего
→ **сплит-скрин 1080×1920 через ffmpeg** (`hstack`, картинка-вставка overlay/topbar) → склейка
сегментов (`concat`). Требует **ffmpeg + ffprobe** в PATH (ставятся `install.sh`/`install-gpu.sh`).
Для настоящей диаризации: на GPU-воркере `pip install pyannote.audio`, HF-токен в Enterprise-ключах
(provider `hf`) и принятые условия gated-моделей `pyannote/speaker-diarization-3.1` +
`pyannote/segmentation-3.0` на HuggingFace.

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

## Аватар «на студии» на своём GPU (замена HeyGen, БЕЗ кредитов) — `POST /avatar`
Локальная замена облачного HeyGen для подкаст-студии. Бэкенд (`/podcast/gpu-studio`) делает
всё «дорогое-но-дешёвое» у себя (вырезка ведущего на зелёный через Gemini + валидация + аудио
из вашей записи), а СЮДА шлёт только анимацию головы:
```
POST /avatar  { image_url (зелёная вырезка), audio_url (голос), base_url, engine? }
   → { output_name, engine, note }        # видео на ЗЕЛЁНОМ (фон не тронут)
GET  /files/<output_name>                  # бэкенд забирает, снимает chroma-key, сажает на студию
```
Движки (по убыванию «живости»), выбираются автоматически по доступности (`/health.avatar_engines`):
1. **EchoMimic-v2** — фото по пояс + аудио → говорящий **С ЖЕСТАМИ рук/корпуса** (то, ради чего
   уходим с HeyGen). Ставится `install-gpu.sh` в `/opt/echomimic_v2`; воркер видит его по
   `ECHOMIMIC_DIR`. ⚠ Веса качаются вручную (HuggingFace, см. README EchoMimic-v2), и точное
   имя скрипта инференса/аргументы задаются env `ECHOMIMIC_INFER` / `ECHOMIMIC_ARGS` в юните —
   **проверить на первой установке** (в коде дефолт `infer_acc.py`).
3. **SadTalker** (`talking_head`) — фолбэк: только голова/липсинк, без жестов. Работает сразу,
   если стоит OpenMontage-GPU.

### Запуск утром (по шагам)
1. Включить/перезагрузить домашний ПК, проверить `nvidia-smi` (в WSL2 — драйвер в Windows).
2. `WORKER_HOST=100.122.182.97 bash /opt/tt/render-worker/install-gpu.sh`
   (клонирует EchoMimic-v2, ставит зависимости, поднимает `trendtraffic-render-gpu:8801`).
3. Скачать веса EchoMimic-v2 по их README в `/opt/echomimic_v2/pretrained_weights`; при
   необходимости поправить `ECHOMIMIC_INFER`/`ECHOMIMIC_ARGS` в
   `/etc/systemd/system/trendtraffic-render-gpu.service` → `systemctl daemon-reload && systemctl restart trendtraffic-render-gpu`.
4. Проверить: `curl http://100.122.182.97:8801/health` → в `avatar_engines` должно быть
   `echomimic` (и/или `sadtalker`).
5. В **Админ → Конфигурация → Рендер**: GPU-воркер = `http://100.122.182.97:8801` → Сохранить
   (или `.env` web-VPS `RENDER_GPU_WORKER_URL=...`, `RENDER_GPU_TARGET=home`, pm2 restart).
6. В TrendFlow → Подкаст: провайдер **«Домашний GPU (жесты)»**, голос **«Из записи»**, фото
   студии + рамки ведущих → **«Оживить НА студии (домашний GPU)»** → **«Собрать НА студии»**.

Без EchoMimic-v2 (только SadTalker) всё работает, но БЕЗ жестов (голова/липсинк). Если
`avatar_engines` пуст — нет ни одного движка (поставь OpenMontage-GPU или EchoMimic-v2).

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
