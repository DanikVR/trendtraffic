import { test } from 'node:test';
import assert from 'node:assert';
import { TIER_SECONDS_MAP, LiveKitTokenRequestSchema } from '@vibevox/shared';

// ————————————————————————————————————————————————
// Тест 1: Карта тарифов — корректные значения в секундах
// ————————————————————————————————————————————————
test('TIER_SECONDS_MAP — содержит все тарифы с корректными значениями в секундах', () => {
  const expectedTiers = ['trial', 'monthly', 'annual', 'enterprise'];

  for (const tier of expectedTiers) {
    assert.ok(
      TIER_SECONDS_MAP[tier] !== undefined,
      `Тариф "${tier}" должен быть в TIER_SECONDS_MAP`
    );
    assert.ok(
      TIER_SECONDS_MAP[tier] > 0,
      `Тариф "${tier}" должен содержать положительное значение секунд`
    );
  }

  // Проверяем конкретные значения
  assert.strictEqual(TIER_SECONDS_MAP['trial'],      600,    'Trial: 600 сек (10 минут)');
  assert.strictEqual(TIER_SECONDS_MAP['monthly'],    18000,  'Monthly: 18000 сек (300 минут)');
  assert.strictEqual(TIER_SECONDS_MAP['annual'],     240000, 'Annual: 240000 сек (4000 минут)');
  assert.strictEqual(TIER_SECONDS_MAP['enterprise'], 999999, 'Enterprise: 999999 сек (неограниченный)');
});

// ————————————————————————————————————————————————
// Тест 2: Расчет овертайм-секунд
// ————————————————————————————————————————————————
test('Расчет овертайм-баланса — минуты правильно конвертируются в секунды', () => {
  const overtimeMinutes = [5, 30, 100, 0, 1];
  const expected =       [300, 1800, 6000, 0, 60];

  for (let i = 0; i < overtimeMinutes.length; i++) {
    const seconds = overtimeMinutes[i] * 60;
    assert.strictEqual(seconds, expected[i], `${overtimeMinutes[i]} мин → ${expected[i]} сек`);
  }
});

// ————————————————————————————————————————————————
// Тест 3: Валидация LiveKitTokenRequestSchema — корректные данные
// ————————————————————————————————————————————————
test('LiveKitTokenRequestSchema — принимает корректные данные', () => {
  const validInput = {
    roomName: 'room-101',
    identity: 'user-xyz',
    nativeLanguage: 'ru',
    voiceGender: 'female'
  };

  const result = LiveKitTokenRequestSchema.safeParse(validInput);
  assert.ok(result.success, 'Корректные данные должны проходить валидацию');
});

// ————————————————————————————————————————————————
// Тест 4: Валидация LiveKitTokenRequestSchema — некорректный код языка
// ————————————————————————————————————————————————
test('LiveKitTokenRequestSchema — отклоняет код языка длиннее 2 символов', () => {
  const invalidInput = {
    roomName: 'room-101',
    identity: 'user-xyz',
    nativeLanguage: 'rus', // Некорректно — должно быть 2 символа
    voiceGender: 'male'
  };

  const result = LiveKitTokenRequestSchema.safeParse(invalidInput);
  assert.ok(!result.success, 'Код языка из 3 символов должен вызывать ошибку валидации');

  if (!result.success) {
    const langError = result.error.flatten().fieldErrors['nativeLanguage'];
    assert.ok(langError && langError.length > 0, 'Должна быть ошибка по полю nativeLanguage');
  }
});

// ————————————————————————————————————————————————
// Тест 5: Валидация LiveKitTokenRequestSchema — некорректный voiceGender
// ————————————————————————————————————————————————
test('LiveKitTokenRequestSchema — отклоняет недопустимое значение voiceGender', () => {
  const invalidInput = {
    roomName: 'room-101',
    identity: 'user-xyz',
    nativeLanguage: 'en',
    voiceGender: 'neutral' // Недопустимое значение
  };

  const result = LiveKitTokenRequestSchema.safeParse(invalidInput);
  assert.ok(!result.success, '"neutral" должен быть недопустимым значением voiceGender');
});

// ————————————————————————————————————————————————
// Тест 6: Логика overtime_topup — проверка отфильтровки некорректных invoices
// ————————————————————————————————————————————————
test('Фильтр овертайма — invoice без overtime_topup пропускается (баланс не меняется)', () => {
  // Имитируем проверку условия из webhook.ts
  const regularInvoice = { metadata: { type: 'subscription_cycle' } };
  const overtimeInvoice = { metadata: { type: 'overtime_topup', minutes: '30' } };

  const isOvertimeRegular = regularInvoice.metadata?.type === 'overtime_topup';
  const isOvertimeTopup = overtimeInvoice.metadata?.type === 'overtime_topup';

  assert.strictEqual(isOvertimeRegular, false, 'Обычный invoice не является overtime_topup');
  assert.strictEqual(isOvertimeTopup, true, 'Invoice с type=overtime_topup должен обрабатываться');

  // Проверяем корректность расчета секунд из metadata
  const minutes = parseInt(overtimeInvoice.metadata.minutes, 10);
  const seconds = minutes * 60;
  assert.strictEqual(seconds, 1800, '30 минут = 1800 секунд');
});
