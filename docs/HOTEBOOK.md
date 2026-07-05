# TrendTraffic — Hotebook (Google NotebookLM): установка, подключение, эксплуатация

> Зафиксировано 2026-07-05, версия блока v1.6.85. Пошаговая инструкция: как
> развернуть блок «Hotebook», подключить Google-аккаунты клиентов и обслуживать.
> Блок = 6-й облачный узел TrendFlow: источники + чат + 9 артефактов (аудио,
> видео, отчёт, тест, таблица, инфографика, карточки, ментальная карта,
> презентация) → Галерея, вкладка «Hotebook».

---

## 0. Как это устроено (за 30 секунд)

```
Фронт (Настройки Enterprise → «Hotebook», блок «Hotebook» в сценарии)
   → бэкенд  apps/backend/src/modules/notebooklm/router.ts   (JWT + Enterprise)
   → Hotebook-воркер  notebooklm-worker (FastAPI + notebooklm-py) по Tailscale
   → NotebookLM (недокументированные эндпоинты Google, по кукам аккаунта)
Готовые файлы → uploads/hotebook → media_assets(folder='hotebook') → Галерея.
```

- **Официального API у NotebookLM нет** — работаем через неофициальную библиотеку
  `notebooklm-py` (куки сессии Google). Отсюда все нюансы ниже (бот-детекция,
  жилой vs датацентровый IP, «плашка синхронизации»).
- **Подключение пер-тенантное:** профиль notebooklm-py на воркере = `tenantId`.
  У каждого Enterprise-аккаунта СВОЙ Google, свои лимиты и блокноты. Изолировано.
- **Воркер живёт на домашнем ПК** (WSL, порт 8802), т.к. жилой IP безопаснее для
  неофициального доступа. GPU НЕ нужен (в отличие от EchoMimic-студии).

---

## 1. Предпосылки

- Домашний ПК `super` с WSL2 (Ubuntu, systemd включён) + Tailscale на Windows
  (адрес хоста в tailnet, напр. `100.122.182.97`). Тот же ПК, что и GPU-воркер.
- Репозиторий склонирован на ПК в `/opt/tt` (там же render-worker).
- Отдельный Google-аккаунт под сервис (рекомендуется не основной) + желательно
  план Google AI (Plus/Pro/Ultra) — суточные лимиты считаются на аккаунт.

---

## 2. Установка воркера (на домашнем ПК, один раз)

Воркер = FastAPI-обёртка `notebooklm-worker/`. Ставится как systemd-сервис в WSL.

```bash
# 1) обновить код на ПК
wsl -u root -e bash -c "cd /opt/tt && git fetch origin && git checkout main && git pull"

# 2) поставить сервис (venv + playwright chromium + systemd + keepalive-таймер)
wsl -u root -e bash /opt/tt/notebooklm-worker/install.sh
```

`install.sh` создаёт:
- **venv** `/opt/tt-hotebook/.venv` + ставит `notebooklm-py[browser]` (Playwright
  Chromium ~170 МБ качается на первом `notebooklm login`; если ставили руками —
  `playwright install --with-deps chromium`);
- данные ВНЕ репозитория: `/opt/tt-hotebook/home` (профили+куки),
  `/opt/tt-hotebook/out` (готовые артефакты);
- **сервис** `trendtraffic-notebooklm.service` (автозапуск, слушает `0.0.0.0:8802`,
  `DISPLAY=:0` для окна входа);
- **keepalive** `trendtraffic-notebooklm-refresh.timer` — раз в сутки продлевает
  сессии ВСЕХ профилей-тенантов (скрипт `/opt/tt-hotebook/refresh-all.sh`).

Проверка:
```bash
wsl -e bash -c "systemctl is-active trendtraffic-notebooklm; curl -s http://localhost:8802/health"
# ждём: active  и  {"ok":true,...}
```

> ⚠️ **Проброс порта Windows→WSL (обязательно для доступа с VPS).** Воркер слушает
> `0.0.0.0:8802` ВНУТРИ WSL, но Tailscale живёт на Windows-хосте. Чтобы web-VPS достучался
> на `100.122.182.97:8802`, на Windows крутится TCP-форвардер `C:\Users\pl761\trendtraffic-gpu\fwd8802.py`
> (клон `fwd8801.py` для GPU-воркера) — слушает Windows:8802 → пересылает в WSL. Автозапуск —
> в `start-gpu.bat` (Startup). Без него VPS видит воркер как `offline`. Проверка с VPS:
> `curl http://100.122.182.97:8802/health`.
>
> ⚠️ **Грабли CRLF.** Если `install.sh` копировали из Windows-чекаута, у него могут
> быть CRLF-переводы строк → bash падает `set: pipefail: invalid option name`.
> Лечение: `wsl -u root -e bash -c "sed -i 's/\r$//' /opt/tt/notebooklm-worker/install.sh"`
> и запустить снова. В репо добавлен `.gitattributes` (`*.sh eol=lf`) — при `git pull`
> на Linux/WSL проблемы нет, она только при копировании файлов из Windows.

---

## 3. Деплой бэкенда/фронта (web-VPS)

Обычный деплой (см. `docs/DEPLOY_RUNBOOK.md`) + ОДНА новая переменная окружения.

```bash
# слить фичу в main (ветка feat/hotebook-login)
git fetch origin
git push origin feat/hotebook-login:main     # fast-forward; или через PR

# на web-VPS — стандартный redeploy (vps-redeploy.sh)
# затем в apps/backend/.env добавить адрес воркера:
NOTEBOOKLM_WORKER_URL=http://100.122.182.97:8802
# и перезапустить:
pm2 restart trendtraffic-api --update-env
```

> ⚠️ **Адрес — Tailscale-IP ПК, НЕ `0.0.0.0`.** Внутри WSL воркер слушает
> `0.0.0.0:8802`, но web-VPS ходит на Tailscale-адрес Windows-хоста
> (`100.122.182.97:8802`). Адрес можно задать и в Админ-панели → Конфиг → Рендер
> (поле `notebookWorkerUrl`), а не только в `.env`.

Проверка: открыть Настройки Enterprise → вкладка «Hotebook» → «Проверить
подключение». Если воркер и адрес живы — увидите статус (или «не подключено»,
если Google-аккаунт ещё не привязан — это шаг 4).

---

## 4. Подключение Google-аккаунта

Настройки Enterprise → вкладка **«Hotebook»**. Три способа (у каждого тенанта — свой):

### 4а. «Подключить Google» — вход прямо в приложении (рекомендуется всем)
Кнопка открывает модалку с ЖИВЫМ окном браузера (стримится с воркера). Клиент
вводит Google-логин как обычно; при входе на notebooklm.google.com сессия
сохраняется в его профиль и окно закрывается. Ничего скачивать/вставлять не надо.
Работает на headful-браузере воркера (Google не режет как «небезопасный»).

### 4б. «Открыть окно входа Google» — только суперадмин
Открывает Chromium НА машине воркера (домашний ПК, экран через WSLg). Годится
только тому, кто у этой машины (суперадмин). Спрятано за экран (`--window-position`).

### 4в. Вставить `storage_state.json` (запасной путь, любой тенант)
Клиент у себя: `pip install "notebooklm-py[browser]"` → `notebooklm login` →
вставляет содержимое `~/.notebooklm/profiles/default/storage_state.json` в поле.

**Суперадмину:** старая платформенная сессия (профиль `default`, если логинились
до пер-тенантной схемы) автоматически переносится в его тенант-профиль при первом
открытии статуса (`adopt-default`) — заново входить не нужно.

---

## 5. Как этим пользуются клиенты (эксплуатация)

- Открыть сценарий TrendFlow → облачный узел **«Hotebook»** (бирюзовый, снизу).
- **Источники:** ссылка/YouTube, текст, файл из Галереи (PDF/аудио/видео/картинка).
- **Чат:** вопросы по источникам, ответы с цитатами.
- **Студия:** 9 плиток, у каждой модалка настроек 1:1 как в NotebookLM
  (формат-карточки, длина, язык, «на чём сделать акцент»).
- **Индикатор на узле** как у подкаста: переливающееся кольцо во время генерации,
  зелёная точка когда готово.
- **Готовое** падает в Галерею → вкладка «Hotebook»; тест/карточки/менталку/таблицу
  можно смотреть интерактивно прямо в панели блока.
- **Счётчик** «Сегодня: N» — суточные лимиты считаются на Google-аккаунт тенанта.

---

## 6. «Плашка синхронизации» — что значит и что делать

Статус подключения (в блоке и в настройках). `errorKind`:

| Плашка | Причина | Что делать |
|---|---|---|
| `auth` | Сессия Google протухла/отозвана | Переподключить аккаунт (шаг 4) |
| `api_changed` | Google сменил внутренний API NotebookLM | `pip install -U notebooklm-py` на воркере + рестарт сервиса |
| `quota` | Исчерпан суточный лимит аккаунта | Ждать сброса (сутки) или поднять план Google AI |
| `offline` | Воркер недоступен (ПК выключен) | Включить ПК/WSL; `systemctl status trendtraffic-notebooklm` |
| `not_configured` | Не задан `NOTEBOOKLM_WORKER_URL` | Прописать адрес (шаг 3) |
| `network` | Сбой сети воркер↔Google | Проверить интернет на ПК |

При `auth`/`api_changed` владельцу тенанта раз в 12ч уходит Telegram-алерт (если
подключён бот в Настройках).

---

## 7. Обслуживание и диагностика

```bash
# статус/логи сервиса
wsl -e bash -c "systemctl status trendtraffic-notebooklm; journalctl -u trendtraffic-notebooklm -n 60"

# health и статус аккаунта конкретного профиля (profile = tenantId, 'default' = платформенный)
wsl -e bash -c "curl -s http://localhost:8802/health; echo; curl -s 'http://localhost:8802/auth/status?profile=default'"

# ручной перезапуск (обновили код воркера)
wsl -u root -e bash -c "cd /opt/tt && git pull && systemctl restart trendtraffic-notebooklm"

# ручное продление сессий всех тенантов (обычно делает таймер сам раз в сутки)
wsl -u root -e bash -c "systemctl start trendtraffic-notebooklm-refresh"
```

- **Порт 8801 занят GPU-студией (EchoMimic), Hotebook = 8802.** Не путать. Команды
  вида `pkill -f 'uvicorn main:app'` УБЬЮТ и GPU-воркер — всегда добавлять порт:
  `pkill -f 'uvicorn main:app.*8802'`.
- **Профили на диске:** `/opt/tt-hotebook/home/profiles/<tenantId>/storage_state.json`
  (права `0600`). Удалить профиль = отключить аккаунт этого тенанта.
- **Надёжность = WSL запущен.** Сервис стартует при загрузке WSL; WSL поднимается
  при входе в Windows (как и GPU-воркер). ПК выключен/спит → Hotebook недоступен.

---

## 8. На будущее: 24/7 через хостинг + прокси

Воркеру не нужен GPU → его МОЖНО перенести на CPU render-VPS (там уже
Python+FastAPI+systemd), тогда он живёт 24/7 независимо от домашнего ПК. Нюансы:
- Датацентровый IP Hostinger → Google подозрительнее к неофиц. доступу (чаще
  «подтвердите вход», риск флага). Домашний (жилой) IP — безопаснее.
- На VPS нет экрана → окно входа через `Xvfb`; при TLS-блокировке —
  `NOTEBOOKLM_TRANSPORT=curl_cffi` (`pip install notebooklm-py[curl-cffi]`).
- **Прокси = правка БЕЗ кода:** библиотека читает `HTTP_PROXY`/`HTTPS_PROXY` —
  добавить в env юнита воркера и перезапустить. Резидентный прокси (~$1–3/мес)
  даёт «VPS 24/7 + жилой IP к Google».

Рекомендация: остаёмся на домашнем ПК; при переезде — VPS основной + дом fallback
(переключение = одна строка `NOTEBOOKLM_WORKER_URL`), прокси добавляем по нужде.

---

## 9. Ключевые файлы

| Что | Где |
|---|---|
| Воркер (FastAPI + notebooklm-py) | `notebooklm-worker/main.py` |
| Установка сервиса (systemd + keepalive) | `notebooklm-worker/install.sh` |
| Бэкенд-модуль (роуты, джобы, прокси окна входа) | `apps/backend/src/modules/notebooklm/router.ts` |
| Адрес воркера (env/админка) | `apps/backend/src/config/systemConfig.ts` (`getNotebookWorkerUrl`) |
| Блок в редакторе | `apps/frontend/src/pages/flow/MontageEditor.tsx` (узел `hotebook`) |
| Настройки подключения | `apps/frontend/src/pages/enterprise/Section8Hotebook.tsx` |
| Вкладка Галереи | `apps/frontend/src/pages/GalleryPage.tsx` (folder `hotebook`) |
