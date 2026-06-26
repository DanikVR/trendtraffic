import { test, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { randomUUID } from 'crypto';

// Устанавливаем переменные окружения до импорта модулей бэкенда
process.env.PORT = '0';
process.env.SIP_ENCRYPTION_KEY = 'test_secret_master_key_for_sip_encryption_2026';
process.env.LIVEKIT_API_KEY = 'test_livekit_api_key';
process.env.LIVEKIT_API_SECRET = 'test_livekit_api_secret_long_enough_for_jwt_signing';
process.env.LIVEKIT_URL = 'http://localhost:7880';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_webhook_secret';

// -----------------------------------------------------------------------------
// МОКИРОВАНИЕ LIVEKIT API
// -----------------------------------------------------------------------------
import { SipClient } from 'livekit-server-sdk';

SipClient.prototype.listSipOutboundTrunk = async function() {
  return [];
};
SipClient.prototype.createSipOutboundTrunk = async function(name: string, address: string, numbers: string[], opts?: any) {
  return { sipTrunkId: 'mock-lk-trunk-123', name, address, numbers } as any;
};
SipClient.prototype.deleteSipTrunk = async function(sipTrunkId: string) {
  return { sipTrunkId } as any;
};

// -----------------------------------------------------------------------------
// МОКИРОВАНИЕ ПОДКЛЮЧЕНИЯ POSTGRESQL И RLS ИЗОЛЯЦИИ
// -----------------------------------------------------------------------------
import pool from '../dist/db/index.js';

// Внутреннее хранилище в памяти для симуляции СУБД
const dbStore = new Map<string, any>();

// Переопределяем метод pool.query для глобальных вызовов в тестах
pool.query = async function(sql: string, params?: any[]) {
  if (sql.includes('INSERT INTO tenants') || sql.includes('DELETE FROM tenants')) {
    return { rows: [], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

// Имитируем пул соединений и PoolClient для симуляции RLS
pool.connect = async function() {
  let currentTenantId: string | null = null;

  const clientMock = {
    query: async (sql: string, params?: any[]) => {
      // Имитируем RLS: установкаapp.current_tenant_id в транзакции
      if (sql.includes('set_config')) {
        currentTenantId = params ? params[1] : null;
        return { rows: [] };
      }

      if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK')) {
        return { rows: [] };
      }

      // Имитируем SELECT из sip_trunks
      if (sql.includes('SELECT') && sql.includes('sip_trunks')) {
        const tenantParam = params ? params[0] : null;
        
        // Симуляция RLS-изоляции: если app.current_tenant_id не установлен или не совпадает с запрашиваемым
        if (!currentTenantId || currentTenantId !== tenantParam) {
          return { rows: [] }; // RLS скрывает строки от другого арендатора
        }

        const data = dbStore.get(tenantParam);
        if (!data) {
          return { rows: [] };
        }

        // Возвращаем запись
        return {
          rows: [{
            id: data.id,
            tenant_id: data.tenantId,
            sip_server: data.sipServer,
            username: data.username,
            encrypted_password: data.encryptedPassword,
            iv: data.iv,
            caller_id: data.callerId,
            transport: data.transport,
            created_at: new Date(),
            updated_at: new Date()
          }],
          rowCount: 1
        };
      }

      // Имитируем INSERT в sip_trunks
      if (sql.includes('INSERT INTO sip_trunks')) {
        const [tenantId, sipServer, username, encryptedPassword, iv, callerId, transport] = params || [];

        // RLS-проверка на запись
        if (!currentTenantId || currentTenantId !== tenantId) {
          throw new Error('RLS Violation: Несанкционированная запись для чужого арендатора!');
        }

        const id = randomUUID();
        const row = { id, tenantId, sipServer, username, encryptedPassword, iv, callerId, transport };
        dbStore.set(tenantId, row);

        return {
          rows: [{
            id,
            tenant_id: tenantId,
            sip_server: sipServer,
            username,
            caller_id: callerId,
            transport,
            created_at: new Date(),
            updated_at: new Date()
          }],
          rowCount: 1
        };
      }

      // Имитируем UPDATE в sip_trunks
      if (sql.includes('UPDATE sip_trunks')) {
        const [sipServer, username, encryptedPassword, iv, callerId, transport, tenantId] = params || [];

        // RLS-проверка на запись
        if (!currentTenantId || currentTenantId !== tenantId) {
          throw new Error('RLS Violation: Несанкционированное обновление для чужого арендатора!');
        }

        const existing = dbStore.get(tenantId);
        const id = existing ? existing.id : randomUUID();
        const row = { id, tenantId, sipServer, username, encryptedPassword, iv, callerId, transport };
        dbStore.set(tenantId, row);

        return {
          rows: [{
            id,
            tenant_id: tenantId,
            sip_server: sipServer,
            username,
            caller_id: callerId,
            transport,
            created_at: new Date(),
            updated_at: new Date()
          }],
          rowCount: 1
        };
      }

      // Имитируем DELETE из sip_trunks
      if (sql.includes('DELETE FROM sip_trunks')) {
        const tenantId = params ? params[0] : null;

        // RLS-проверка на удаление
        if (!currentTenantId || currentTenantId !== tenantId) {
          throw new Error('RLS Violation: Несанкционированное удаление для чужого арендатора!');
        }

        const has = dbStore.has(tenantId);
        dbStore.delete(tenantId);
        return { rows: [], rowCount: has ? 1 : 0 };
      }

      return { rows: [] };
    },
    release: () => {}
  };

  return clientMock as any;
};

// Объявляем переменные для лениво загружаемых модулей бэкенда
let upsertSipTrunk: any;
let getSipTrunk: any;
let deleteSipTrunk: any;
let app: any;

// Генерируем тестовые UUID для арендаторов
const tenantIdA = randomUUID();
const tenantIdB = randomUUID();

let server: http.Server;
let port: number;

// Вспомогательный метод для HTTP-запросов к Express
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
          ...(body ? { 'Content-Type': 'application/json' } : {})
        }
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: responseBody
          });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// -----------------------------------------------------------------------------
// ИНИЦИАЛИЗАЦИЯ И ОЧИСТКА ОКРУЖЕНИЯ
// -----------------------------------------------------------------------------
before(async () => {
  const serviceModule = await import('../dist/modules/sip/service.js');
  upsertSipTrunk = serviceModule.upsertSipTrunk;
  getSipTrunk = serviceModule.getSipTrunk;
  deleteSipTrunk = serviceModule.deleteSipTrunk;

  const serverModule = await import('../dist/server.js');
  app = serverModule.app;

  // Запускаем Express-сервер на случайном порту
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      port = typeof addr === 'string' ? 0 : addr?.port || 0;
      resolve();
    });
  });

  // Вставляем тестовых арендаторов в БД
  await pool.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [tenantIdA, 'Тестовый Арендатор А']);
  await pool.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [tenantIdB, 'Тестовый Арендатор Б']);
});

after(async () => {
  // Удаляем тестовые данные из БД
  if (pool) {
    await pool.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantIdA, tenantIdB]);
  }
  
  // Закрываем HTTP-сервер
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// -----------------------------------------------------------------------------
// ТЕСТЫ СЕРВИСНОГО СЛОЯ И ШИФРОВАНИЯ
// -----------------------------------------------------------------------------
test('SIP Service: Создание транка шифрует пароль в БД и работает RLS', async () => {
  const sipConfig = {
    sipServer: 'sip.test-telecom.ru',
    username: 'vibevox_sip_user',
    password: 'super_secure_sip_password_100',
    callerId: '+79998887766',
    transport: 'udp' as const
  };

  // 1. Создаем транк для Арендатора А через сервис
  const result = await upsertSipTrunk(tenantIdA, sipConfig);
  assert.ok(result.id, 'Транк должен быть успешно создан и иметь UUID');
  assert.strictEqual(result.tenantId, tenantIdA, 'Идентификатор арендатора должен совпадать');

  // 2. Проверяем напрямую через СУБД (в обход RLS), что пароль в БД зашифрован
  // Для этого мы берем объект из нашего симулированного хранилища dbStore
  const storedData = dbStore.get(tenantIdA);
  assert.ok(storedData, 'Запись транка должна существовать в БД');
  
  const rawEncrypted = storedData.encryptedPassword;
  assert.notStrictEqual(rawEncrypted, sipConfig.password, 'Пароль в БД не должен лежать в открытом виде');
  assert.ok(rawEncrypted.includes(':'), 'Зашифрованная строка должна содержать разделители GCM (:).');

  // 3. Проверяем Row-Level Security: запрашиваем транк от имени Арендатора Б
  const trunkB = await getSipTrunk(tenantIdB);
  assert.strictEqual(trunkB, null, 'Арендатор Б не должен видеть транк Арендатора А из-за политик RLS');
});

// -----------------------------------------------------------------------------
// ТЕСТЫ API-ИНТЕГРАЦИИ (КОНТРОЛЛЕРЫ, ВАЛИДАЦИЯ, МАСКИРОВАНИЕ)
// -----------------------------------------------------------------------------
test('SIP API: Доступ без заголовка x-tenant-id или с невалидным UUID запрещен', async () => {
  // Отправляем запрос без заголовка
  const resNoHeader = await makeRequest('GET', '/api/sip/trunk', {});
  assert.strictEqual(resNoHeader.statusCode, 400, 'Должен вернуть 400 Bad Request');
  const jsonNoHeader = JSON.parse(resNoHeader.body);
  assert.ok(jsonNoHeader.error.includes('x-tenant-id'), 'Сообщение должно указывать на отсутствие заголовка');

  // Отправляем запрос с невалидным UUID в заголовке
  const resInvalidUuid = await makeRequest('GET', '/api/sip/trunk', { 'x-tenant-id': 'not-a-valid-uuid' });
  assert.strictEqual(resInvalidUuid.statusCode, 400, 'Должен вернуть 400 Bad Request при неверном формате UUID');
  const jsonInvalidUuid = JSON.parse(resInvalidUuid.body);
  assert.ok(jsonInvalidUuid.error.includes('валидный UUID'), 'Сообщение должно указывать на формат UUID');
});

test('SIP API: Создание, Получение с маскированием и Удаление транка', async () => {
  const requestBody = {
    sipServer: 'sip.api-telecom.ru',
    username: 'api_sip_user',
    password: 'api_sip_password_999',
    callerId: '+71112223344',
    transport: 'tcp'
  };

  const headers = { 'x-tenant-id': tenantIdB };

  // 1. Создаем транк через API POST /api/sip/trunk
  const createRes = await makeRequest('POST', '/api/sip/trunk', headers, requestBody);
  assert.strictEqual(createRes.statusCode, 200, 'Запрос должен завершиться успешно (200 OK)');
  
  const createJson = JSON.parse(createRes.body);
  assert.strictEqual(createJson.status, 'success');
  assert.strictEqual(createJson.trunk.password, '********', 'Пароль в ответе создания должен быть замаскирован');

  // 2. Получаем транк через API GET /api/sip/trunk
  const getRes = await makeRequest('GET', '/api/sip/trunk', headers);
  assert.strictEqual(getRes.statusCode, 200, 'Запрос должен завершиться успешно (200 OK)');
  
  const getJson = JSON.parse(getRes.body);
  assert.strictEqual(getJson.sipServer, requestBody.sipServer, 'Адрес сервера должен совпадать');
  assert.strictEqual(getJson.username, requestBody.username, 'Имя пользователя должно совпадать');
  assert.strictEqual(getJson.password, '********', 'Пароль в ответе получения должен быть строго замаскирован!');

  // 3. Удаляем транк через API DELETE /api/sip/trunk
  const deleteRes = await makeRequest('DELETE', '/api/sip/trunk', headers);
  assert.strictEqual(deleteRes.statusCode, 200, 'Удаление должно завершиться успешно (200 OK)');
  
  const deleteJson = JSON.parse(deleteRes.body);
  assert.strictEqual(deleteJson.status, 'success');

  // 4. Проверяем повторный GET — должен вернуть 404 Not Found
  const getResAfterDelete = await makeRequest('GET', '/api/sip/trunk', headers);
  assert.strictEqual(getResAfterDelete.statusCode, 404, 'После удаления транк не должен быть найден');
});
