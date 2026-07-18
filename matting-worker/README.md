# Matting Worker — ИИ-вырезка фона видео (RobustVideoMatting)

> **⚠️ Статус: standalone-запасной путь, ПРОДОМ НЕ ИСПОЛЬЗУЕТСЯ.** С v2.6.6 ИИ-вырезка
> в UGC-студии считается через Replicate по BYO-ключу тенанта (`render/matting.ts`,
> провайдер `replicate` в Настройки → Генерация) — домашний ПК не нужен. Этот воркер
> остаётся рабочим (systemd `trendtraffic-matting` на GPU-ПК, порт 8801) на случай
> возврата к локальному расчёту: тогда в `matting.ts` вернуть клиент воркера
> (git-история v2.6.5) и `mattingWorkerUrl` в systemConfig.

Вырезает **любой** фон (комната, улица) из видео-аватара UGC-студии — не только
однотонный хромакей. Модель: [RobustVideoMatting](https://github.com/PeterL1n/RobustVideoMatting)
(mobilenetv3, рекуррентная — длина клипа не ограничена VRAM). Считается на GPU-ПК
(WSL Ubuntu, RTX), веб-VPS без GPU ходит сюда по Tailscale.

## Схема

```
backend (VPS) ── Tailscale ──> Windows fwd8801.py ──> WSL :8801 uvicorn (этот воркер)
   POST /matting {video_url}      → {job_id}
   GET  /matting/status?job=      → processing (progress %) | done | failed
   GET  /files/<output_name>      → webm VP9 с альфа-каналом (yuva420p, без звука)
```

Выход подаётся в `composeUgc` как `avatarKind='alpha'` (тот же контракт, что старый
sr-capture-webm); звук бэкенд берёт из исходного ролика (`voicePath`).

## Установка (WSL Ubuntu на GPU-ПК)

```bash
# из клона репо в WSL (напр. /opt/tt):
sudo bash matting-worker/install-wsl.sh
# → venv /opt/tt-matting, torch cu128, прогрев весов RVM,
#   systemd trendtraffic-matting на :8801, health-проверка
```

Windows-часть (доступ с Tailscale-IP): скопировать `fwd8801.py` в
`C:\Users\<user>\trendtraffic-gpu\` и добавить в `start-gpu.bat` строку:

```bat
start "" /b pythonw "C:\Users\<user>\trendtraffic-gpu\fwd8801.py"
```

(тот же механизм, что fwd8802 у Hotebook; автозапуск — vbs в Startup уже зовёт этот bat).

## Конфиг бэкенда

`apps/backend/system-config.json` → `"mattingWorkerUrl": "http://100.122.182.97:8801"`
(или env `MATTING_WORKER_URL`). Пусто → в студии вариант «ИИ-вырезка» отвечает
понятной ошибкой, хромакей работает как раньше.

## Ручки окружения воркера

| env | дефолт | что |
|---|---|---|
| `MATTING_VARIANT` | `mobilenetv3` | `resnet50` — чуть чище края, медленнее |
| `MATTING_MAX_SIDE` | `1920` | кап разрешения (больше — даунскейл) |
| `MATTING_MAX_SEC` | `600` | потолок длительности клипа |
| `MATTING_SEQ_CHUNK` | `8` | кадров за форвард |
| `MATTING_WORK_DIR` | `/opt/tt-matting/work` | рабочая папка (jobs/out, чистка 48ч) |

## Проверка руками

```bash
curl http://127.0.0.1:8801/health
curl -X POST http://127.0.0.1:8801/matting -H 'content-type: application/json' \
  -d '{"video_url":"https://app.trendtraffic.pro/uploads/....mp4"}'
curl 'http://127.0.0.1:8801/matting/status?job=mat_...'
curl -O http://127.0.0.1:8801/files/matting-........webm
ffprobe matting-*.webm   # pix_fmt должен быть yuva420p (альфа)
```
