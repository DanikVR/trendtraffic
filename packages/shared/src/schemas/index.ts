import { z } from 'zod';

// Экспорт всех модульных схем
export * from './sip.js';
export * from './billing.js';
export * from './assistant.js';

// Схема авторизации пользователей
export const UserAuthSchema = z.object({
  email: z.string().email('Некорректный формат email').optional(),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов').optional(),
  telegramId: z.string().optional(),
  googleId: z.string().optional()
});
