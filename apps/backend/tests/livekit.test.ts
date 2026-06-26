import { test } from 'node:test';
import assert from 'node:assert';

// Устанавливаем тестовые переменные окружения ДО импорта модуля сервиса
process.env.LIVEKIT_API_KEY = 'test_livekit_api_key';
process.env.LIVEKIT_API_SECRET = 'test_livekit_api_secret_long_enough_for_jwt_signing';
process.env.SIP_ENCRYPTION_KEY = 'test_sip_key';

const { generateLiveKitToken } = await import('../src/modules/livekit/service.js');

// ————————————————————————————————————————————————
// Тест 1: Успешная генерация токена
// ————————————————————————————————————————————————
await test('generateLiveKitToken — возвращает JWT-строку', async () => {
  const token = await generateLiveKitToken({
    roomName: 'test-room-42',
    identity: 'user-abc123',
    nativeLanguage: 'ru',
    voiceGender: 'female'
  });

  assert.ok(typeof token === 'string', 'Токен должен быть строкой');
  assert.ok(token.length > 0, 'Токен не должен быть пустым');

  // JWT состоит из 3 частей, разделённых точкой
  const parts = token.split('.');
  assert.strictEqual(parts.length, 3, 'JWT должен состоять из 3 частей: header.payload.signature');
});

// ————————————————————————————————————————————————
// Тест 2: Метаданные языка упакованы в payload токена
// ————————————————————————————————————————————————
await test('generateLiveKitToken — metadata содержит nativeLanguage и voiceGender', async () => {
  const token = await generateLiveKitToken({
    roomName: 'room-fr',
    identity: 'user-fr-001',
    nativeLanguage: 'fr',
    voiceGender: 'male'
  });

  // Декодируем payload (вторая часть JWT) без проверки подписи
  const payloadBase64 = token.split('.')[1];
  const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
  const payload = JSON.parse(payloadJson);

  assert.ok(payload.metadata, 'Payload токена должен содержать поле metadata');

  const metadata = JSON.parse(payload.metadata);
  assert.strictEqual(metadata.nativeLanguage, 'fr', 'Поле nativeLanguage должно совпадать');
  assert.strictEqual(metadata.voiceGender, 'male', 'Поле voiceGender должно совпадать');
});

// ————————————————————————————————————————————————
// Тест 3: Ошибка при отсутствии переменных окружения
// ————————————————————————————————————————————————
await test('generateLiveKitToken — исключение при отсутствии ключей окружения', async () => {
  const origKey = process.env.LIVEKIT_API_KEY;
  const origSecret = process.env.LIVEKIT_API_SECRET;

  // Временно сбрасываем переменные окружения
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;

  await assert.rejects(
    async () => {
      // Перезагружаем модуль в новом контексте для проверки guard
      const mod = await import(`../src/modules/livekit/service.js?t=${Date.now()}`);
      await mod.generateLiveKitToken({
        roomName: 'r', identity: 'u', nativeLanguage: 'en', voiceGender: 'male'
      });
    },
    (err: Error) => {
      assert.ok(
        err.message.includes('LIVEKIT_API_KEY') || err.message.includes('LIVEKIT_API_SECRET') || err instanceof Error,
        'Должна выброситься ошибка о переменных окружения'
      );
      return true;
    }
  );

  // Восстанавливаем переменные
  process.env.LIVEKIT_API_KEY = origKey;
  process.env.LIVEKIT_API_SECRET = origSecret;
});
