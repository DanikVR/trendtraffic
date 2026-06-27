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
- `GET /files/<name>` — отдать произведённый файл (web-VPS его забирает).

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
- GPU-инструменты (avatar/upscale) сюда НЕ маршрутизируются (это CPU-воркер) — они идут
  на домашнюю RTX 5080 (отдельный GPU-воркер, позже).
