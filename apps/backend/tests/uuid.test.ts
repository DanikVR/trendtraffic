import { test } from 'node:test';
import assert from 'node:assert';
import { isUuid } from '../src/utils/uuid.js';

// ————————————————————————————————————————————————
// Тест 1: формат UUID — что принимаем, что отвергаем
// ————————————————————————————————————————————————
test('isUuid — принимает UUID и отвергает всё остальное', () => {
  // Реальные tenant_id из прода (оба регистра — Postgres отдаёт нижний).
  assert.ok(isUuid('07f15d3e-07bc-4b7c-bf5e-cb089b18c3c7'), 'UUID нижним регистром');
  assert.ok(isUuid('CE7D6E38-1234-4ABC-89EF-0123456789AB'), 'UUID верхним регистром');

  // Сервисные sentinel'ы и мусор — в UUID-колонку такое отдавать нельзя.
  assert.ok(!isUuid('global_admin'), 'sentinel суперадмина — НЕ UUID');
  assert.ok(!isUuid('admin-1'), 'хардкод-id суперадмина — НЕ UUID');
  assert.ok(!isUuid(''), 'пустая строка');
  assert.ok(!isUuid(null), 'null');
  assert.ok(!isUuid(undefined), 'undefined');
  assert.ok(!isUuid('07f15d3e07bc4b7cbf5ecb089b18c3c7'), 'без дефисов');
  assert.ok(!isUuid('07f15d3e-07bc-4b7c-bf5e-cb089b18c3c'), 'на символ короче');
  assert.ok(!isUuid('07f15d3e-07bc-4b7c-bf5e-cb089b18c3c7 '), 'с хвостовым пробелом');
  assert.ok(!isUuid('g7f15d3e-07bc-4b7c-bf5e-cb089b18c3c7'), 'не-hex символ');
  assert.ok(!isUuid(42), 'число');
});

// ————————————————————————————————————————————————
// Тест 2: регрессия — сервисный sentinel НЕ должен доходить до UUID-колонки
// ————————————————————————————————————————————————
// Симптом до фикса: суперадмин ходит с tenantId='global_admin', значение уходило в
// `subscriptions.tenant_id` (UUID) и Postgres ронял запрос 22P02
// «invalid input syntax for type uuid». Логика не ломалась (catch деградировал),
// но 6219 стектрейсов заваливали pm2-error-лог и скрывали настоящие ошибки.
// Проверяем именно ОТСУТСТВИЕ запроса, а не форму ответа: catch в getFeatureAccess
// возвращал ровно тот же объект, что и guard, — на форме регрессию не поймать.
// Единственный наблюдаемый след запроса — console.warn('[feature_gate] ...') из catch.
test('getFeatureAccess("global_admin") — не ходит в БД (нет warn) и не бросает', async () => {
  const { getFeatureAccess } = await import('../src/modules/billing/feature_gate.js');

  const warns: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: any[]) => { warns.push(String(args[0])); };
  try {
    // Без роли: доступа нет, падения нет, запроса нет.
    const asNobody = await getFeatureAccess('global_admin');
    assert.deepStrictEqual(asNobody, { tier: null, status: null, enterprise: false, superadmin: false });

    // С ролью суперадмина — bypass сохраняется (как и до фикса).
    const asSuper = await getFeatureAccess('global_admin', 'superadmin');
    assert.deepStrictEqual(asSuper, { tier: null, status: null, enterprise: true, superadmin: true });
  } finally {
    console.warn = origWarn;
  }

  assert.deepStrictEqual(
    warns.filter(w => w.includes('[feature_gate]')), [],
    'sentinel не должен доходить до subscriptions.tenant_id (UUID) — иначе 22P02 в логах'
  );
});
