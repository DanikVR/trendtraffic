/**
 * Комплексные юнит-тесты модуля ИИ-ассистента VibeVox.
 *
 * Покрываемые сценарии:
 * 1. Feature Toggle — блокировка CRM/Calendar для не-Enterprise тарифов (403)
 * 2. Feature Toggle — разрешение для Enterprise (200)
 * 3. Биллинг — успешное списание аудио-секунд с баланса
 * 4. Биллинг — ошибка 402 при недостаточном балансе
 * 5. Валидация — отклонение невалидного UUID в x-tenant-id (400)
 * 6. Валидация — отклонение отсутствующего x-tenant-id (400)
 * 7. Валидация — отклонение невалидного тела запроса Zod (400)
 * 8. Telegram-шлюз — текстовый запрос не списывает секунды (бесплатный)
 * 9. Telegram-шлюз — аудио-запрос корректно рассчитывает стоимость
 * 10. Валидация — refine: отсутствие text И audio одновременно (400)
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { randomUUID } from 'crypto';

// ============================================================================================
// Установка переменных окружения ДО импорта модулей бэкенда
// ============================================================================================

process.env.PORT = '0';
process.env.SIP_ENCRYPTION_KEY = 'test_secret_master_key_for_sip_encryption_2026';
process.env.LIVEKIT_API_KEY = 'test_livekit_api_key';
process.env.LIVEKIT_API_SECRET = 'test_livekit_api_secret_long_enough_for_jwt_signing';
process.env.LIVEKIT_URL = 'http://localhost:7880';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_webhook_secret';
process.env.GEMINI_API_KEY = 'test_gemini_api_key_mock';

// ============================================================================================
// МОКИРОВАНИЕ LIVEKIT SipClient API (требуется для корректной загрузки server.ts)
// ============================================================================================

import { SipClient } from 'livekit-server-sdk';

SipClient.prototype.listSipOutboundTrunk = async function() { return []; };
SipClient.prototype.createSipOutboundTrunk = async function(name: string, address: string, numbers: string[], opts?: any) {
  return { sipTrunkId: 'mock-lk-trunk-123', name, address, numbers } as any;
};
SipClient.prototype.deleteSipTrunk = async function(sipTrunkId: string) {
  return { sipTrunkId } as any;
};

// ============================================================================================
// МОКИРОВАНИЕ POSTGRESQL (pool.query и pool.connect с RLS-изоляцией)
// ============================================================================================

import pool from '../dist/db/index.js';

// Хранилище подписок в памяти: tenantId → { tier, balance }
const subscriptionStore = new Map<string, { tier: string; balance: number }>();

// Переопределяем pool.query для глобальных вызовов
pool.query = async function(sql: string, params?: any[]) {
  if (sql.includes('INSERT INTO tenants') || sql.includes('DELETE FROM tenants')) {
    return { rows: [], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

// Имитируем пул соединений с RLS-изоляцией
pool.connect = async function() {
  let currentTenantId: string | null = null;

  const clientMock = {
    query: async (sql: string, params?: any[]) => {
      // Установка RLS-контекста
      if (sql.includes('set_config')) {
        currentTenantId = params ? params[1] : null;
        return { rows: [] };
      }

      // Транзакционные команды
      if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
        return { rows: [] };
      }

      // SELECT tier FROM subscriptions — проверка Feature Toggle
      if (sql.includes('SELECT') && sql.includes('tier') && sql.includes('subscriptions')) {
        const tenantParam = params ? params[0] : null;
        if (!currentTenantId || currentTenantId !== tenantParam) {
          return { rows: [] }; // RLS скрывает строки
        }
        const sub = subscriptionStore.get(tenantParam);
        if (!sub) return { rows: [] };
        return { rows: [{ tier: sub.tier }] };
      }

      // UPDATE subscriptions — атомарное списание баланса
      if (sql.includes('UPDATE') && sql.includes('subscriptions') && sql.includes('translation_minutes_balance -')) {
        const seconds = params ? params[0] : 0;
        const tenantParam = params ? params[1] : null;

        if (!currentTenantId || currentTenantId !== tenantParam) {
          return { rows: [], rowCount: 0 };
        }

        const sub = subscriptionStore.get(tenantParam);
        if (!sub || sub.balance < seconds) {
          return { rows: [], rowCount: 0 }; // Баланс недостаточен
        }

        sub.balance -= seconds;
        subscriptionStore.set(tenantParam, sub);
        return {
          rows: [{ translation_minutes_balance: sub.balance }],
          rowCount: 1,
        };
      }

      // SELECT translation_minutes_balance — для сообщения об ошибке
      if (sql.includes('SELECT') && sql.includes('translation_minutes_balance')) {
        const tenantParam = params ? params[0] : null;
        const sub = subscriptionStore.get(tenantParam);
        return {
          rows: sub ? [{ translation_minutes_balance: sub.balance }] : [],
        };
      }

      // Имитируем INSERT/SELECT/UPDATE/DELETE для sip_trunks (для совместимости с server.ts)
      if (sql.includes('sip_trunks')) {
        return { rows: [], rowCount: 0 };
      }

      return { rows: [] };
    },
    release: () => {},
  };

  return clientMock as any;
};

// ============================================================================================
// ПЕРЕМЕННЫЕ ДЛЯ ТЕСТОВ
// ============================================================================================

let app: any;
let server: http.Server;
let port: number;
let setGeminiProvider: any;

// Тестовые UUID арендаторов
const tenantEnterprise = randomUUID();   // Enterprise-аккаунт (полный доступ)
const tenantMonthly = randomUUID();       // Monthly-аккаунт (ограниченный доступ)
const tenantLowBalance = randomUUID();    // Аккаунт с нулевым балансом

// ============================================================================================
// ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ HTTP-ЗАПРОСОВ
// ============================================================================================

function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: any
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: 'localhost',
        port,
        path,
        method,
        headers: {
          ...headers,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, body: responseBody });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============================================================================================
// ИНИЦИАЛИЗАЦИЯ И ОЧИСТКА
// ============================================================================================

before(async () => {
  // Наполняем хранилище подписок тестовыми данными
  subscriptionStore.set(tenantEnterprise, { tier: 'enterprise', balance: 999999 });
  subscriptionStore.set(tenantMonthly, { tier: 'monthly', balance: 18000 });
  subscriptionStore.set(tenantLowBalance, { tier: 'monthly', balance: 0 });

  // Ленивая загрузка скомпилированных модулей
  const serviceModule = await import('../dist/modules/assistant/service.js');
  setGeminiProvider = serviceModule.setGeminiProvider;

  // Установка мок-провайдера Gemini ПЕРЕД загрузкой сервера
  const mockGeminiProvider = {
    async generateContent(params: any) {
      // Определяем, запрошен ли аудио-ответ
      const hasAudioModality = params.config?.responseModalities?.some?.(
        (m: any) => m === 'AUDIO' || m === 1 || m === 'audio'
      );

      if (hasAudioModality) {
        // Возвращаем мок аудио-ответа
        const fakeAudioBase64 = Buffer.alloc(3200).toString('base64');
        return {
          text: null,
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  data: fakeAudioBase64,
                  mimeType: 'audio/pcm;rate=24000',
                },
              }],
            },
          }],
        };
      }

      // Возвращаем мок текстового ответа (JSON для анализа звонков)
      return {
        text: JSON.stringify({
          entities: { clientName: 'Иван Иванов', topic: 'Юридическая консультация' },
          triggers: ['Нужен юрист'],
          summary: 'Клиент обратился с вопросом о юридической консультации',
        }),
      };
    },
  };

  setGeminiProvider(mockGeminiProvider);

  // Загрузка и запуск сервера
  const serverModule = await import('../dist/server.js');
  app = serverModule.app;

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      port = typeof addr === 'string' ? 0 : addr?.port || 0;
      resolve();
    });
  });
});

after(async () => {
  subscriptionStore.clear();
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ============================================================================================
// ТЕСТЫ: ВАЛИДАЦИЯ ЗАГОЛОВКА x-tenant-id
// ============================================================================================

test('[Ассистент] Возвращает 400 при отсутствии заголовка x-tenant-id (call-analytics)', async () => {
  const res = await makeRequest('POST', '/api/assistant/call-analytics', {}, {
    roomName: 'test-room',
    conversationContext: 'Тестовый разговор',
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes('x-tenant-id'));
});

test('[Ассистент] Возвращает 400 при невалидном UUID в x-tenant-id (call-analytics)', async () => {
  const res = await makeRequest('POST', '/api/assistant/call-analytics', {
    'x-tenant-id': 'not-a-valid-uuid-string',
  }, {
    roomName: 'test-room',
    conversationContext: 'Тестовый разговор',
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes('UUID'));
});

test('[Ассистент] Возвращает 400 при отсутствии x-tenant-id (telegram-gateway)', async () => {
  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {}, {
    text: 'Привет',
    response_type: 'text',
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes('x-tenant-id'));
});

test('[Ассистент] Возвращает 400 при невалидном UUID в x-tenant-id (telegram-gateway)', async () => {
  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': '12345',
  }, {
    text: 'Привет',
    response_type: 'text',
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes('UUID'));
});

// ============================================================================================
// ТЕСТЫ: ZOD-ВАЛИДАЦИЯ ТЕЛА ЗАПРОСА
// ============================================================================================

test('[Валидация Zod] Возвращает 400 при пустом conversationContext (call-analytics)', async () => {
  const res = await makeRequest('POST', '/api/assistant/call-analytics', {
    'x-tenant-id': tenantEnterprise,
  }, {
    roomName: 'test-room',
    conversationContext: '',
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes('Некорректные параметры'));
});

test('[Валидация Zod] Возвращает 400 при отсутствии roomName (call-analytics)', async () => {
  const res = await makeRequest('POST', '/api/assistant/call-analytics', {
    'x-tenant-id': tenantEnterprise,
  }, {
    conversationContext: 'Тестовый разговор',
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes('Некорректные параметры'));
});

test('[Валидация Zod] Возвращает 400 при отсутствии text И audio (telegram-gateway, refine)', async () => {
  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': tenantEnterprise,
  }, {
    response_type: 'text',
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes('Некорректные параметры'));
});

test('[Валидация Zod] Возвращает 400 при невалидном response_type (telegram-gateway)', async () => {
  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': tenantEnterprise,
  }, {
    text: 'Привет',
    response_type: 'video',
  });
  assert.strictEqual(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes('Некорректные параметры'));
});

// ============================================================================================
// ТЕСТЫ: FEATURE TOGGLE (Enterprise-only для CRM/Calendar)
// ============================================================================================

test('[Feature Toggle] Возвращает 403 для тарифа monthly при вызове call-analytics', async () => {
  const res = await makeRequest('POST', '/api/assistant/call-analytics', {
    'x-tenant-id': tenantMonthly,
  }, {
    roomName: 'test-room',
    conversationContext: 'Клиент обсуждал юридический вопрос. Нужен юрист.',
  });
  assert.strictEqual(res.statusCode, 403);
  const parsed = JSON.parse(res.body);
  assert.ok(parsed.error.includes('Enterprise'));
  assert.strictEqual(parsed.code, 'FEATURE_NOT_AVAILABLE');
});

test('[Feature Toggle] Возвращает 200 для тарифа enterprise при вызове call-analytics', async () => {
  const res = await makeRequest('POST', '/api/assistant/call-analytics', {
    'x-tenant-id': tenantEnterprise,
  }, {
    roomName: 'test-room',
    conversationContext: 'Клиент обсуждал юридический вопрос. Нужен юрист.',
    extractionSchema: { clientName: 'Имя клиента', topic: 'Тема обращения' },
  });
  assert.strictEqual(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.strictEqual(parsed.status, 'success');
  assert.ok(parsed.analytics.entities);
  assert.ok(Array.isArray(parsed.analytics.triggers));
  assert.ok(parsed.analytics.summary.length > 0);
});

// ============================================================================================
// ТЕСТЫ: БИЛЛИНГ АУДИО-СЕКУНД (Telegram-шлюз)
// ============================================================================================

test('[Биллинг] Текстовый запрос НЕ списывает секунды (бесплатный)', async () => {
  const balanceBefore = subscriptionStore.get(tenantMonthly)!.balance;

  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': tenantMonthly,
  }, {
    text: 'Привет, как дела?',
    response_type: 'text',
  });
  assert.strictEqual(res.statusCode, 200);

  const balanceAfter = subscriptionStore.get(tenantMonthly)!.balance;
  assert.strictEqual(balanceAfter, balanceBefore, 'Баланс не должен измениться при текстовом запросе');
});

test('[Биллинг] Аудио-запрос корректно списывает секунды с баланса', async () => {
  // Создаём фейковое аудио: 32000 байт = 1 секунда PCM 16kHz 16-bit mono
  const fakeAudioBuffer = Buffer.alloc(32000); // 1 секунда
  const fakeAudioBase64 = fakeAudioBuffer.toString('base64');

  const balanceBefore = subscriptionStore.get(tenantMonthly)!.balance;

  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': tenantMonthly,
  }, {
    audio: fakeAudioBase64,
    response_type: 'text',
  });
  assert.strictEqual(res.statusCode, 200);

  const balanceAfter = subscriptionStore.get(tenantMonthly)!.balance;
  // Стоимость: 1 сек входящего аудио, text ответ — без овертайма = ceil(1) = 1 сек
  const expectedDeduction = 1;
  assert.strictEqual(balanceAfter, balanceBefore - expectedDeduction, 'Должна быть списана 1 секунда');
});

test('[Биллинг] Аудио-запрос с аудио-ответом добавляет 10 секунд овертайма', async () => {
  // 64000 байт = 2 секунды PCM
  const fakeAudioBuffer = Buffer.alloc(64000);
  const fakeAudioBase64 = fakeAudioBuffer.toString('base64');

  const balanceBefore = subscriptionStore.get(tenantMonthly)!.balance;

  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': tenantMonthly,
  }, {
    audio: fakeAudioBase64,
    response_type: 'audio',
    voice_gender: 'male',
  });
  assert.strictEqual(res.statusCode, 200);

  const balanceAfter = subscriptionStore.get(tenantMonthly)!.balance;
  // Стоимость: 2 сек входящего + 10 сек овертайм за аудио-ответ = ceil(12) = 12 сек
  const expectedDeduction = 12;
  assert.strictEqual(balanceAfter, balanceBefore - expectedDeduction, 'Должно быть списано 12 секунд');
});

test('[Биллинг] Возвращает 402 при недостаточном балансе (аудио-запрос)', async () => {
  const fakeAudioBuffer = Buffer.alloc(32000);
  const fakeAudioBase64 = fakeAudioBuffer.toString('base64');

  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': tenantLowBalance,
  }, {
    audio: fakeAudioBase64,
    response_type: 'audio',
  });
  assert.strictEqual(res.statusCode, 402);
  const parsed = JSON.parse(res.body);
  assert.strictEqual(parsed.code, 'INSUFFICIENT_BALANCE');
  assert.ok(parsed.error.includes('Недостаточно'));
});

// ============================================================================================
// ТЕСТЫ: TELEGRAM-ШЛЮЗ — ФОРМАТ ОТВЕТОВ
// ============================================================================================

test('[Telegram-шлюз] Текстовый запрос → текстовый ответ', async () => {
  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': tenantEnterprise,
  }, {
    text: 'Расскажи про погоду в Москве',
    response_type: 'text',
  });
  assert.strictEqual(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.strictEqual(parsed.type, 'text');
  assert.ok(parsed.text !== undefined, 'Текстовый ответ должен быть в поле text');
});

test('[Telegram-шлюз] Текстовый запрос → аудио-ответ (с VOICE_MAP)', async () => {
  const balanceBefore = subscriptionStore.get(tenantEnterprise)!.balance;

  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': tenantEnterprise,
  }, {
    text: 'Скажи привет голосом',
    response_type: 'audio',
    voice_gender: 'female',
  });
  assert.strictEqual(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.strictEqual(parsed.type, 'audio');
  assert.ok(parsed.audio, 'Аудио-ответ должен содержать base64-данные');
  assert.ok(parsed.mimeType?.startsWith('audio/'), 'MIME-тип должен начинаться с audio/');

  // Проверяем списание 10 секунд за аудио-ответ (без входящего аудио)
  const balanceAfter = subscriptionStore.get(tenantEnterprise)!.balance;
  assert.strictEqual(balanceAfter, balanceBefore - 10, 'Должно быть списано 10 секунд за аудио-ответ');
});

test('[Telegram-шлюз] Аудио-запрос → аудио-ответ возвращает корректный формат', async () => {
  const fakeAudio = Buffer.alloc(16000).toString('base64'); // 0.5 сек

  const res = await makeRequest('POST', '/api/assistant/telegram-gateway', {
    'x-tenant-id': tenantEnterprise,
  }, {
    audio: fakeAudio,
    response_type: 'audio',
    voice_gender: 'male',
    language: 'en',
  });
  assert.strictEqual(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.strictEqual(parsed.type, 'audio');
  assert.ok(parsed.audio);
  assert.ok(parsed.mimeType);
  assert.ok(typeof parsed.balanceRemaining === 'number', 'balanceRemaining должен быть числом');
});
