import { z } from 'zod';

// Схема валидации данных SIP-подключения
export const SipTrunkSchema = z.object({
  sipServer: z.string().min(1, 'Адрес SIP-сервера обязателен'),
  username: z.string().min(1, 'Имя пользователя SIP обязательно'),
  password: z.string().min(1, 'Пароль SIP обязателен'),
  callerId: z.string().optional(),
  transport: z.enum(['udp', 'tcp', 'tls']).default('udp')
});
