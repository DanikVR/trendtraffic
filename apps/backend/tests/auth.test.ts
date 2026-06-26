import { test, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import bcrypt from 'bcryptjs';

// Установка необходимых переменных окружения
process.env.PORT = '0';
process.env.SIP_ENCRYPTION_KEY = 'test_secret_master_key_for_sip_encryption_2026';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_webhook_secret';
process.env.LIVEKIT_API_KEY = 'test_livekit_api_key';
process.env.LIVEKIT_API_SECRET = 'test_livekit_api_secret_long_enough_for_jwt_signing';

// Мокаем pg pool
import pool from '../dist/db/index.js';

// Хешируем тестовый пароль для проверки логина
const testPasswordPlain = 'valid_password';
const testPasswordHash = bcrypt.hashSync(testPasswordPlain, 10);

pool.query = async function (sql: string, params?: any[]) {
  if (sql.includes('SELECT * FROM users WHERE email = $1')) {
    const email = params ? params[0] : '';
    if (email === 'user@example.com') {
      return {
        rows: [{
          id: 'user-uuid-123',
          tenant_id: 'tenant-uuid-456',
          email: 'user@example.com',
          role: 'user',
          password_hash: testPasswordHash
        }],
        rowCount: 1
      };
    }
  }
  return { rows: [], rowCount: 0 };
};

// Имитируем успешное подключение и транзакции в БД для тестов регистрации
pool.connect = async function() {
  const clientMock = {
    query: async (sql: string, params?: any[]) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT') || sql.includes('ROLLBACK') || sql.includes('set_config')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO tenants')) {
        return { rows: [{ id: 'mock-tenant-uuid-register' }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO users')) {
        return {
          rows: [{
            id: 'mock-user-uuid-register',
            email: params ? params[1] : '',
            role: 'tenant_admin',
            tenant_id: 'mock-tenant-uuid-register'
          }],
          rowCount: 1
        };
      }
      if (sql.includes('INSERT INTO subscriptions')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    },
    release: () => {},
  };
  return clientMock as any;
};

let app: any;
let server: http.Server;
let port: number;

function makeRequest(
  method: string,
  path: string,
  body?: any
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: 'localhost',
        port,
        path,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
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

before(async () => {
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
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ============================================================================================
// Тесты авторизации (Login)
// ============================================================================================

test('[Auth] Суперадминистратор авторизуется по жестким учетным данным', async () => {
  const res = await makeRequest('POST', '/api/auth/login', {
    email: 'live7610482@gmail.com',
    password: 'Danyuk1976!',
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.body);
  
  assert.strictEqual(data.status, 'success');
  assert.ok(data.token, 'Токен должен присутствовать в ответе');
  assert.strictEqual(data.user.role, 'superadmin');
  assert.strictEqual(data.user.email, 'live7610482@gmail.com');
  assert.strictEqual(data.user.tenantId, 'global_admin');
});

test('[Auth] Суперадминистратор авторизуется при вводе email с опечаткой (life...)', async () => {
  const res = await makeRequest('POST', '/api/auth/login', {
    email: 'life7610482@gmail.com',
    password: 'Danyuk1976!',
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.strictEqual(data.status, 'success');
  assert.strictEqual(data.user.role, 'superadmin');
});

test('[Auth] Обычный пользователь авторизуется с правильным bcryptjs паролем', async () => {
  const res = await makeRequest('POST', '/api/auth/login', {
    email: 'user@example.com',
    password: 'valid_password',
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.body);
  
  assert.strictEqual(data.status, 'success');
  assert.ok(data.token);
  assert.strictEqual(data.user.role, 'user');
  assert.strictEqual(data.user.email, 'user@example.com');
  assert.strictEqual(data.user.tenantId, 'tenant-uuid-456');
});

test('[Auth] Возвращает 401 для обычного пользователя при неверном пароле', async () => {
  const res = await makeRequest('POST', '/api/auth/login', {
    email: 'user@example.com',
    password: 'wrong_password',
  });

  assert.strictEqual(res.statusCode, 401);
  const data = JSON.parse(res.body);
  assert.ok(data.error.includes('Неверный'));
});

// ============================================================================================
// Тесты регистрации (Register)
// ============================================================================================

test('[Auth Register] Успешная регистрация нового арендатора', async () => {
  const res = await makeRequest('POST', '/api/auth/register', {
    email: 'newowner@company.com',
    password: 'secure_password_123',
    companyName: 'Owner Corporation',
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.body);
  
  assert.strictEqual(data.status, 'success');
  assert.ok(data.token, 'Токен должен быть сгенерирован');
  assert.strictEqual(data.user.role, 'tenant_admin');
  assert.strictEqual(data.user.email, 'newowner@company.com');
  assert.strictEqual(data.user.tenantId, 'mock-tenant-uuid-register');
});

test('[Auth Register] Возвращает 400 при отсутствии обязательного пароля', async () => {
  const res = await makeRequest('POST', '/api/auth/register', {
    email: 'newowner@company.com',
    companyName: 'Owner Corporation',
  });
  assert.strictEqual(res.statusCode, 400);
});

// ============================================================================================
// Тесты сброса пароля (Forgot Password)
// ============================================================================================

test('[Auth Forgot Password] Успешная обработка запроса сброса (Имитация)', async () => {
  const res = await makeRequest('POST', '/api/auth/forgot-password', {
    email: 'live7610482@gmail.com',
  });

  assert.strictEqual(res.statusCode, 200);
  const data = JSON.parse(res.body);
  assert.strictEqual(data.status, 'success');
  assert.ok(data.message.includes('отправлены'));
});
