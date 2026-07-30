/**
 * Проверка формата UUID — перед запросами в UUID-колонки.
 *
 * Зачем: `tenants.id` и `subscriptions.tenant_id` — колонки типа UUID, а суперадмин
 * ходит с СЕРВИСНЫМ sentinel'ом `tenantId='global_admin'` (строка, не UUID; см.
 * auth/router.ts — строки в `tenants` у него нет вообще). Часть таблиц под это
 * сделана VARCHAR специально (`watched_channels`, `channel_videos`, снимки метрик),
 * а UUID-колонки на таком значении роняют запрос сырой ошибкой Postgres
 * 22P02 «invalid input syntax for type uuid: "global_admin"».
 *
 * Такие падения были не сбоем логики (везде выше стоял catch с осмысленной
 * деградацией), а шумом: 6219 стектрейсов по ~30 строк заваливали
 * pm2-error-лог и скрывали настоящие ошибки. Правило: перед запросом в
 * UUID-колонку значение проверяем и возвращаем «пусто» — для суперадмина
 * отсутствие тенанта/подписки это корректный ответ, а не ошибка.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): boolean {
  return typeof v === 'string' && UUID_RE.test(v);
}
