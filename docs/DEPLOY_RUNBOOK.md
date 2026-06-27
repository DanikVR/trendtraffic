# TrendTraffic — Деплой-runbook (как ассистент деплоит по SSH)

> Зафиксировано 2026-06-27 после деплоя v1.1.2–1.1.8. Это рабочая инструкция:
> ассистент (Claude Code) деплоит **сам по SSH** из своей среды — пользователю
> НЕ нужно вручную вставлять команды в браузерный терминал.

---

## ⚠️ Безопасность (прочитать первым)
- **Репозиторий публичный.** В нём уже лежат IP/Tailscale-адреса серверов
  (в `deploy/*.sh`, `render-worker/*.sh`). Этот runbook их лишь собирает воедино.
  Рекомендуется **сделать репозиторий приватным** (тогда `git pull` на VPS
  потребует deploy-token — добавить в команды клонирования).
- **Никогда не коммить** в git: приватные SSH-ключи, пароли, `.env`, содержимое
  `/root/.trendtraffic_*`. Секреты генерятся/живут только на серверах.
- Root-пароль и пароль суперадмина, засветившиеся в переписке/скринах, **сменить**
  (`passwd` на сервере; суперадмин — в `/admin/config`). Доступ по ключу не пострадает.

---

## Топология
| Роль | Hostname | Публичный IP | Tailscale | Что крутится |
|---|---|---|---|---|
| **web-VPS** | `srv1787697.hstgr.cloud` | `72.62.0.184` | `100.114.172.30` | приложение `/var/www/trendtraffic`, pm2 `trendtraffic-api` (:3001), nginx, PostgreSQL `vibevox_db` |
| **рендер-VPS** | `srv1781410.hstgr.cloud` | `187.124.130.12` | `100.81.35.75` | OpenMontage `/opt/openmontage`, репо `/opt/tt`, systemd `trendtraffic-render` (:8800, только Tailscale) |
| **домашний ПК** | `super` | — | `100.122.182.97` | (позже) GPU-воркер `trendtraffic-render-gpu` (:8801) |

Все три — в одном tailnet (`viitalyyy@gmail.com`). Домен: `https://app.trendtraffic.pro` → web-VPS (HTTPS Let's Encrypt).

---

## SSH-доступ
Из среды ассистента SSH к обоим VPS проходит **по ключу, без пароля** (ключ уже
авторизован как root). Базовый враппер:

```bash
SSH="ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=15"
$SSH root@72.62.0.184  'echo CONNECTED_OK'   # web-VPS
$SSH root@187.124.130.12 'echo CONNECTED_OK'  # рендер-VPS
```

- `BatchMode=yes` — никогда не спрашивает пароль (если ключа нет — честно падает,
  а не виснет). `git push` в GitHub из среды тоже работает.
- **Грабли:** Windows-`curl` к https может падать с `schannel ... CRYPT_E_NO_REVOCATION_CHECK`
  и `http_code=000` — это НЕ значит «нет сети». `ssh`/`git` работают. Проверять
  доступ нужно через `ssh`, а не `curl`.

---

## Полный деплой (что и в каком порядке запускал ассистент)

### 0. Локально: коммит + пуш
```bash
git add -A && git commit -m "..."          # версия = коммит, бампить APP_VERSION
git push origin main
```

### 1. Рендер-VPS — поставить/обновить CPU-воркер
```bash
$SSH root@187.124.130.12 'cd /opt/tt && git fetch --depth 1 origin main && git reset --hard origin/main && bash render-worker/install.sh'
```
`install.sh` ставит `fastapi/uvicorn` в venv OpenMontage и поднимает systemd
`trendtraffic-render` на `100.81.35.75:8800`. Успех = `{"ok":true,"tools":85,...}`.
(Если `/opt/tt` ещё не клонирован — `git clone --depth 1 https://github.com/DanikVR/trendtraffic /opt/tt` сначала.)

### 2. web-VPS — редеплой приложения
```bash
$SSH root@72.62.0.184 'cd /var/www/trendtraffic && git fetch --depth 1 origin main && git reset --hard origin/main && RENDER_WORKER_URL=http://100.81.35.75:8800 bash deploy/vps-redeploy.sh'
```
`deploy/vps-redeploy.sh` (идемпотентный): `npm ci/install` → сборка
`shared → backend → frontend` → upsert переданных env в `.env`
(`RENDER_WORKER_URL`, опц. `ANTHROPIC_API_KEY`, `RENDER_GPU_*`) → `npm run db:setup`
(идемпотентные миграции) → `pm2 restart trendtraffic-api --update-env` → health-check.

### 3. (Позже) Домашний ПК — GPU-воркер
```bash
sudo WORKER_HOST=100.122.182.97 bash /opt/tt/render-worker/install-gpu.sh
```
Linux/WSL2 + NVIDIA. Ставит GPU-цепочку OpenMontage (torch/CUDA) + systemd
`trendtraffic-render-gpu` на `100.122.182.97:8801`. Затем в Админ → Конфигурация →
«Рендер: GPU и воркеры»: GPU = «Домашний ПК», адрес = `http://100.122.182.97:8801`.

---

## Проверка после деплоя
```bash
$SSH root@72.62.0.184 '
  git -C /var/www/trendtraffic log --oneline -1;                                   # коммит
  grep -rhoE "1\.1\.[0-9]" /var/www/trendtraffic/apps/frontend/dist/assets/*.js | head -1;  # версия фронта
  curl -fsS -m 8 http://100.81.35.75:8800/health;                                   # воркер по Tailscale
  pm2 logs trendtraffic-api --nostream --lines 400 | grep -iE "\[render\]" | tail -4  # исполнитель
'
```
Хорошие признаки:
- `[render] исполнитель: HttpWorkerExecutor + ИИ-режиссёр → http://100.81.35.75:8800`
- `воркер запущен (... executor=DirectorExecutor)` (а НЕ `SimulationExecutor`)
- `/api/health → {"status":"ok","database":"connected"}`

---

## Откат (rollback)
```bash
# узнать предыдущий рабочий коммит:  git -C /var/www/trendtraffic log --oneline -5
$SSH root@72.62.0.184 'cd /var/www/trendtraffic && git reset --hard <PREV_SHA> && bash deploy/vps-redeploy.sh'
```
`.env` и БД не трогаются (миграции аддитивные). Воркер на рендер-VPS откатывать
аналогично через `/opt/tt`.

---

## Изменения этого деплоя (v1.1.2 → v1.1.8)
Полный построчный changelog — в `apps/frontend/src/components/AppVersion.tsx`.
Кратко:

| Версия | Что |
|---|---|
| **1.1.2** | Enterprise → вкладка «Генерация»: BYO-ключи провайдеров OpenMontage (FAL/OpenAI/ElevenLabs/HeyGen/Runway/Suno/xAI/Doubao/Google + сток) с реальной «Проверить». Убраны «Подсказки» и «CRM/Chatwoot». Таблица `tenant_provider_keys`. |
| **1.1.3** | Рендер «Собрать» подключён к OpenMontage: Python FastAPI-воркер (`render-worker/`), `executor_http.ts` (CPU→`RENDER_WORKER_URL`, GPU→`RENDER_GPU_WORKER_URL`), готовый ролик → Галерея, кнопка «Собрать» с поллингом. |
| **1.1.4** | Выбор исходного видео (пикер: скачанные тренды + видео-референсы), `flows.graph.source`. |
| **1.1.5** | Точный маппинг инструментов OpenMontage в воркере по реальным `input_schema`. |
| **1.1.6** | ИИ-режиссёр, кирпич 1: Claude-ключ (`anthropic`, группа `llm`) в Enterprise → Генерация, пинг `GET /v1/models`. |
| **1.1.7** | ИИ-режиссёр, мозг: `render/director.ts` + `executor_director.ts` (Anthropic SDK). Умные ✨ЛЛМ-узлы: озвучка-сценарий, ресёрч/новости (web_search), выбор момента (`/transcribe`). Зависимость `@anthropic-ai/sdk`. |
| **1.1.8** | GPU-рендер: карточка-переключатель «Рендер: GPU и воркеры» в админке (Дом/Облако/Выкл + адреса воркеров). Домашний GPU-воркер: диспетчер `upscale`/`talking_head` + `install-gpu.sh`. |

Деплой выполнен ассистентом по SSH 2026-06-27: web-VPS → `937321f` (фронт v1.1.8),
рендер-воркер живой (`100.81.35.75:8800`, 85 инструментов), `RENDER_WORKER_URL`
прописан → реальный рендер (не симуляция). Осталось: задать `ANTHROPIC_API_KEY`
(для ✨ЛЛМ-шагов) и поднять GPU-воркер на домашнем ПК.
