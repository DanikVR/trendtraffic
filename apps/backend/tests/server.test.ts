import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

// Устанавливаем фиктивные переменные окружения, чтобы модули бэкенда успешно инициализировались в тестах
process.env.PORT = '0';
process.env.SIP_ENCRYPTION_KEY = 'test_secret_master_key_for_sip_encryption_2026';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_webhook_secret';
process.env.LIVEKIT_API_KEY = 'test_livekit_api_key';
process.env.LIVEKIT_API_SECRET = 'test_livekit_api_secret_long_enough_for_jwt_signing';

// Импортируем наше Express-приложение и сервер из скомпилированной директории dist
const { app, server } = await import('../dist/server.js');

// Вспомогательная функция для отправки HTTP GET запроса
function makeGetRequest(url: string): Promise<{ statusCode: number; data: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          data,
          headers: res.headers
        });
      });
    }).on('error', reject);
  });
}

test('Интеграционный тест: GET /api/health возвращает JSON ответ со статусом', async () => {
  const address = server.address();
  assert.ok(address, 'Сервер должен иметь назначенный адрес');
  
  const port = typeof address === 'string' ? 0 : address?.port;
  assert.ok(port && port > 0, 'Сервер должен слушать на положительном порту');

  const healthUrl = `http://localhost:${port}/api/health`;

  try {
    const response = await makeGetRequest(healthUrl);
    
    // Эндпоинт вернет либо 200 (если база данных доступна), либо 500 (если нет)
    // Оба случая являются валидным поведением эндпоинта и возвращают JSON
    assert.ok(
      response.statusCode === 200 || response.statusCode === 500,
      `Код статуса ответа должен быть 200 или 500 (получено: ${response.statusCode})`
    );

    const json = JSON.parse(response.data);
    
    // Проверяем структуру JSON
    assert.ok('status' in json, 'Ответ должен содержать поле "status"');
    assert.ok('database' in json, 'Ответ должен содержать поле "database"');
    assert.ok('timestamp' in json, 'Ответ должен содержать поле "timestamp"');

    if (response.statusCode === 200) {
      assert.strictEqual(json.status, 'ok', 'При коде 200 статус должен быть "ok"');
      assert.strictEqual(json.database, 'connected', 'При коде 200 БД должна быть "connected"');
    } else {
      assert.strictEqual(json.status, 'error', 'При коде 500 статус должен быть "error"');
      assert.strictEqual(json.database, 'disconnected', 'При коде 500 БД должна быть "disconnected"');
    }
  } finally {
    // В любом случае закрываем сервер, чтобы не зависать в процессе тестов
    server.close();
  }
});
