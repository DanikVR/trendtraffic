# Коннекторы мессенджеров — карта и регламент обновления

> Этот документ — для случая «**что-то не работает в канале**» или «**Meta/TikTok изменили API**, надо
> обновить синхронизацию». Здесь: где что лежит, как чинить точечно и **не сломать остальное**,
> как обновлять из GitHub на нашем исходнике.

## 0. Главный принцип (почему правки безопасны)
1. **Один движок цепочек** — `apps/backend/src/modules/flows/runner.ts`. Все каналы ходят через него.
   Его контракты (`SendIntent`, `FlowRunContext`) — **общие**: менять ради одного канала НЕЛЬЗЯ
   (сломаются все). Новое поле — только **опциональное**.
2. **HTTP-специфика каждого канала изолирована** в его `*_client.ts` (формы запросов/эндпоинты) и
   парсерах `*_inbound.ts` / `*_webhook.ts` (формы вебхуков). 99% правок при смене API — **в этих
   файлах одного канала**, не задевая раннер, UI и другие каналы.
3. **Каналы дормантны без `.env`** — правка/поломка коннектора не влияет на прод, пока не заданы
   переменные канала. Безопасно править и коммитить.
4. **Telegram/QuestFlow — отдельная система**, НЕ трогаем (см. [[project_questflow_chain]]).

## 1. Карта файлов (где искать по каналу)
Все коннекторы: `apps/backend/src/modules/channels/<канал>/`

| Канал | Папка | Файлы (роль) | Mount | object вебхука |
|---|---|---|---|---|
| **Instagram** | `instagram/` | ig_config (env/OAuth-резолв), ig_client (Send API + карусель + ice breakers + follow-status), ig_inbound (приём→раннер + comment-to-DM + story), ig_webhook (verify/events/oauth/status/icebreakers), ig_accounts (per-tenant токены), ig_oauth (self-connect), ig_ratelimit | `/api/instagram` | `instagram` |
| **TikTok** | `tiktok/` | tt_config, tt_client (⚠️ формы = **TODO(partner)**), tt_inbound, tt_webhook, tt_ratelimit (48ч/10) | `/api/tiktok` | — |
| **WhatsApp** | `whatsapp/` | wa_config, wa_client (text/кнопки/список/cta/медиа), wa_inbound (+opt-out), wa_webhook, wa_window (24ч-гейт) | `/api/whatsapp` | `whatsapp_business_account` |
| **Messenger** | `messenger/` | msg_config, msg_client (Send API + карусель + messenger_profile), msg_inbound (+comment-to-DM по feed), msg_webhook, msg_window (24ч) | `/api/messenger` | `page` |

**Общие (затрагивают ВСЕ каналы — править осторожно):**
- `flows/runner.ts` — движок (SendIntent/FlowRunContext, узлы, ветвление, спинтакс, handover, анти-флуд кап).
- `channels/capabilities.ts` — бэкенд-матрица возможностей (maxButtons/cards/ctaUrl/media по каналу).
- ~~`flow/channels.tsx` / `flow/flowNodes.tsx` / `flow/FlowCanvas.tsx`~~ — УДАЛЕНЫ в v1.6.42 (легаси omnichannel-редактора; страница /flow теперь = TrendFlow `flow/MontageEditor.tsx`). Фронт-матрица каналов при возврате бот-фичи восстанавливается из git-истории.
- `server.ts` — монтаж `/api/<канал>` (раздел 2.2.x).
- `apps/backend/.env.example` — все переменные `<КАНАЛ>_*`.

**Сверка форм API при go-live/поломке:** `docs/CHANNELS_GOLIVE_CHECKLIST.md` (что получить, .env, webhook, таблица «что сверить», тест-чеклист — по каждому каналу).

## 2. Регламент починки/обновления (по шагам)
1. **Определить канал** по симптому → найти папку (таблица §1).
2. **Свериться с офиц. докой** (ссылки в `CHANNELS_GOLIVE_CHECKLIST.md`): что изменилось — эндпоинт/payload/лимит/поле вебхука.
3. **Ветка**: работаем на `feat/omnichannel-chatwoot` или новой `fix/<channel>-api`. НЕ на main.
4. **Правка точечная**: только `<канал>/*_client.ts` (формы запросов) и/или парсеры `*_inbound.ts` / `*_webhook.ts`. Раннер/другие каналы — НЕ трогать.
5. **Гейты (обязательно):**
   - `npx tsc --noEmit -p apps/backend/tsconfig.json` → 0
   - `npx tsc --noEmit -p apps/frontend/tsconfig.json` → 0
   - `npm --prefix apps/frontend run lint` → 0 errors
   - smoke: `GET /api/<канал>/webhook` → **403** (смонтирован), `GET /api/<канал>/status` → **401**. (404 = не смонтирован.)
6. **Если есть доступ** — прогнать тест-чеклист канала из `CHANNELS_GOLIVE_CHECKLIST.md`.
7. **Коммит** (понятное сообщение, `Co-Authored-By: ...`), **push** на github.com/DanikVR/vibevox.
8. **Деплой** (когда на VPS): `git pull` + build + `pm2 restart` (см. [[project_deploy]] / `docs/DEPLOY_HOSTINGER_VPS.md`). Идемпотентные миграции применятся сами.

## 3. Обновление «из GitHub на нашем исходнике»
- Репозиторий: **github.com/DanikVR/vibevox**, ветка **`feat/omnichannel-chatwoot`**.
- Подтянуть: `git pull` → прогнать гейты (§2.5) ДО правок (убедиться, что база зелёная) → внести изменения → гейты снова → commit/push.
- Конфликты не ломать слепо: коннекторы изолированы, обычно мерджатся чисто.

## 4. Чего НЕ делать (чтобы не сломать)
- ❌ Менять контракты `runner.ts` (SendIntent/FlowRunContext) под один канал — сломает все. Только опц. поля.
- ❌ Удалять/переименовывать env без правки `*_config.ts` + `.env.example` + чеклиста.
- ❌ Писать в `db_fallback.json` при живом backend (папка Google Drive → порча NUL).
- ❌ Трогать Telegram/QuestFlow.
- ⚠️ После правки `runner.ts`/`capabilities.ts` — это общий код: прогнать tsc + проверить хотя бы один канал.

## 5. Быстрая диагностика «канал X не отвечает»
- **404** на `/api/X/webhook` → не смонтирован (`server.ts`, импорт+`app.use`).
- **status 401 всегда** → ок (нужен Bearer). **connected:false** → env не заданы (`<КАНАЛ>_ACCESS_TOKEN`/`_DEFAULT_TENANT_ID`).
- Бот молчит, хотя env есть → проверить: webhook подписан на нужные поля (messages/comments/feed); окно/лимит (WA/Messenger 24ч, TikTok 48ч/10); вне окна свободные сообщения блокируются by design.
- Логи: `[ig|tt|wa|msg/webhook]`, `[.../inbound]`, ошибки Send API содержат HTTP-код и тело ответа платформы.
- Формы запросов TikTok — **best-effort `TODO(partner)`** в `tt_client.ts`: при поломке сверять там в первую очередь.

## 6. Где формы запросов чаще всего «протухают»
| Что меняют платформы | Где править |
|---|---|
| Версия API (v21.0 → vNN) | `<канал>/*_client.ts` константа базового URL (или env `*_API_BASE`) |
| Форма payload отправки | `*_client.ts` соответствующая send-функция |
| Форма входящего вебхука | `*_inbound.ts` парсеры (extract*/fetch* + поля сообщения) и `*_webhook.ts` (`object`, `entry/changes/messaging`) |
| Лимиты/окна | `*_window.ts` / `*_ratelimit.ts` константы |
| Разрешения/доступ | процесс (App Review / Messaging Partner) — не код; см. чеклист |
