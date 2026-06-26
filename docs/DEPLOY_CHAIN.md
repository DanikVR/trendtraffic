# VibeVox — Цепочка деплоя: локально → GitHub → Hostinger VPS

> Отвечает на вопросы: **какая цепочка самая правильная, какие данные от VPS нужны и когда,
> и почему НЕЛЬЗЯ менять код на Hostinger напрямую.**
> Технические шаги первой установки/обновления — в [DEPLOY_HOSTINGER_VPS.md](DEPLOY_HOSTINGER_VPS.md).

## Золотое правило

**GitHub — единственный источник правды. Поток кода ОДНОНАПРАВЛЕННЫЙ:**

```
  ваш ПК                         GitHub (DanikVR/vibevox)            Hostinger VPS
  ───────                        ────────────────────────           ─────────────
  правка → commit → git push  ─────────►  ветка/main  ──(деплой)──►  git pull → build → pm2 restart
                                                                      └ Postgres (данные, не трогаются)
```

- **Код на VPS не редактируется руками НИКОГДА.** VPS только *получает* код через `git pull`.
  Если поправить файл прямо на сервере — следующий `git pull` либо затрёт правку, либо упадёт
  с конфликтом, и деплой сломается. На сервере живёт только то, чего НЕТ в git:
  `apps/backend/.env` (секреты), конфиг nginx, системные пакеты, cron-бэкап.
- **Секреты в git не попадают.** Они только в двух местах: `.env` на VPS и GitHub Secrets.

## Какие данные и КОГДА давать (главное)

**Ассистенту (мне) производственные секреты и SSH давать не нужно — я пишу скрипты, вы вставляете значения сами.**

| Когда | Что нужно | Куда кладётся | Даёте мне? |
|---|---|---|---|
| Сейчас (push) | — | уже в GitHub | нет |
| Первая установка VPS (1 раз) | SSH-доступ к VPS: IP + логин (hPanel Hostinger) | используете сами на сервере | **нет** — я даю команды, вы выполняете |
| Секреты приложения (1 раз, на VPS) | `DB_PASSWORD`, `JWT_SECRET`, `SIP_ENCRYPTION_KEY`, Stripe, Gemini, Google OAuth, LiveKit, SMTP | только `apps/backend/.env` на VPS (в .gitignore) | **нет, никогда** |
| Авто-деплой GitHub Actions (1 раз) | `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`(приватный), `VPS_PORT` | GitHub → Settings → Secrets → Actions | вы добавляете сами; мне нужны лишь НЕсекретные IP/юзер/путь, если поправить workflow |

Вывод: **VPS-данные вы «даёте» в момент первой установки — но самому себе** (вводите на сервере).
Единственный мост GitHub→VPS для авто-деплоя — приватный SSH-ключ в GitHub Secrets, который
добавляете тоже вы. Мне передавать пароли/ключи не требуется.

## Вариант 1 — Ручной деплой (начните с него)

Самый простой и контролируемый. После `git push`:

```bash
ssh user@VPS_IP
cd /var/www/vibevox
bash deploy/deploy.sh          # git pull → build → миграции на старте → pm2 restart → smoke-test
```

`deploy/deploy.sh` идемпотентен и НЕ запускает `db:setup` (он только для первой установки).
Это и есть цикл обновления из [DEPLOY_HOSTINGER_VPS.md §7](DEPLOY_HOSTINGER_VPS.md), завёрнутый в один скрипт.

## Вариант 2 — Авто-деплой (push → деплой), цель steady-state

Workflow уже в репозитории: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).
Сейчас он на ручном запуске (чтобы не падать без секретов). Включение:

1. На VPS создайте отдельного deploy-пользователя (не root) и SSH-ключ для Actions:
   ```bash
   sudo adduser --disabled-password deploy
   sudo usermod -aG sudo deploy           # для systemctl reload nginx (или дайте точечный sudoers)
   ssh-keygen -t ed25519 -f vibevox_deploy -N ""     # на своём ПК
   # публичную половину → ~deploy/.ssh/authorized_keys на VPS
   ```
2. В GitHub добавьте Secrets: `VPS_HOST`, `VPS_USER=deploy`, `VPS_SSH_KEY` (содержимое приватного `vibevox_deploy`), при нестандартном порте — `VPS_PORT`.
3. Прогоните **вручную** (Actions → Deploy to Hostinger VPS → Run workflow) и убедитесь, что всё ок.
4. Раскомментируйте блок `push:` в `deploy.yml` — теперь каждый `git push` в ветку деплоит сам.

## Рекомендуемая итоговая цепочка

1. **Первый деплой — вручную** (Вариант 1), чтобы убедиться, что сервер настроен (Postgres, `.env`, nginx, `db:setup` один раз).
2. **Дальше — авто** (Вариант 2): `commit → push → GitHub Actions → SSH → deploy.sh`.
3. **Бэкапы** ([`deploy/pg-backup.sh`](../deploy/pg-backup.sh) в cron) + **smoke-test** после каждого деплоя — страховка.
4. **Никаких прямых правок на Hostinger.** Любое изменение — только через GitHub.

## Безопасность (коротко)

- VPS-ключ для Actions — отдельный, под deploy-юзером (не root), отзываемый. Пароль VPS в GitHub НЕ кладём.
- В проде `NODE_ENV=production` + `DB_DISABLE_FALLBACK=true` → JSON-fallback выключен, данные только в Postgres.
- `.env`, `superadmin-auth.json`, `google-oauth.json`, `db_fallback*.json` — в `.gitignore`, в репозиторий не уезжают.
