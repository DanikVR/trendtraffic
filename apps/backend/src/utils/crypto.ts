import crypto from 'crypto';

// Загрузка и подготовка 32-байтного ключа шифрования
const getEncryptionKey = (): Buffer => {
  const rawKey = process.env.SIP_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('Критическая ошибка: Переменная окружения SIP_ENCRYPTION_KEY не задана!');
  }
  // Используем SHA-256, чтобы гарантированно получить ключ длиной 32 байта (256 бит)
  return crypto.createHash('sha256').update(rawKey).digest();
};

/**
 * Шифрует пароль SIP с использованием алгоритма AES-256-GCM.
 * Возвращает объединенную строку формата: ciphertext:iv:authTag
 */
export const encryptSipPassword = (password: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Вектор инициализации (рекомендуется 12 байт для GCM)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex'); // Тег аутентификации (16 байт)

  return `${encrypted}:${iv.toString('hex')}:${authTag}`;
};

/**
 * Дешифрует пароль SIP с проверкой целостности данных GCM.
 * Принимает зашифрованную строку формата: ciphertext:iv:authTag
 */
export const decryptSipPassword = (encryptedData: string): string => {
  const key = getEncryptionKey();
  const parts = encryptedData.split(':');

  if (parts.length !== 3) {
    throw new Error('Некорректный формат зашифрованных данных. Ожидался: ciphertext:iv:authTag');
  }

  const [ciphertext, ivHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};
