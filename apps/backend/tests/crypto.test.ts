import { test } from 'node:test';
import assert from 'node:assert';
import { encryptSipPassword, decryptSipPassword } from '../src/utils/crypto.js';

// Установка временного тестового ключа для запуска тестов
process.env.SIP_ENCRYPTION_KEY = 'test_secret_master_key_for_sip_encryption_2026';

test('Шифрование и дешифрование пароля SIP (AES-256-GCM)', () => {
  const originalPassword = 'MySecretSIPPassword123!';

  // 1. Шифрование
  const encrypted = encryptSipPassword(originalPassword);
  assert.ok(encrypted, 'Зашифрованный результат не должен быть пустым');
  assert.ok(encrypted.includes(':'), 'Зашифрованная строка должна разделяться символом ":"');

  const parts = encrypted.split(':');
  assert.strictEqual(parts.length, 3, 'Строка должна состоять из 3 компонентов (ciphertext:iv:authTag)');

  // 2. Дешифрование
  const decrypted = decryptSipPassword(encrypted);
  assert.strictEqual(decrypted, originalPassword, 'Дешифрованный пароль должен в точности совпадать с оригиналом');
});

test('Попытка дешифрования искаженных данных должна вызывать ошибку целостности (GCM)', () => {
  const originalPassword = 'AnotherSecretPassword';
  const encrypted = encryptSipPassword(originalPassword);

  const parts = encrypted.split(':');
  // Искажаем шифротекст (меняем последний символ), нарушая электронную подпись GCM
  const lastChar = parts[0].slice(-1);
  const newLastChar = lastChar === '0' ? '1' : '0';
  parts[0] = parts[0].slice(0, -1) + newLastChar;

  const corruptedData = parts.join(':');

  assert.throws(() => {
    decryptSipPassword(corruptedData);
  }, /Unsupported state or unable to authenticate data/i, 'Должна возникнуть ошибка при нарушении целостности данных');
});
