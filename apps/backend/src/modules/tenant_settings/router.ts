/**
 * Express router для Enterprise-настроек tenant'а (Раздел 1, 4 + базовые поля).
 *
 * Mounts:
 *  - GET    /api/tenant-settings/gemini                 — info о per-tenant Gemini key
 *  - PUT    /api/tenant-settings/gemini                 — установить ключ + сразу валидировать
 *  - DELETE /api/tenant-settings/gemini                 — удалить per-tenant key
 *  - POST   /api/tenant-settings/gemini/validate        — повторно проверить текущий ключ
 *  - GET    /api/tenant-settings/owner-telegram         — chat_id владельца
 *  - PUT    /api/tenant-settings/owner-telegram         — привязать/отвязать chat_id
 *
 * Все эндпоинты требуют JWT + Enterprise-доступ (см. feature_gate).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../../db/index.js';
import {
  getTenantGeminiKeyInfo,
  setTenantGeminiKey,
  clearTenantGeminiKey,
  validateTenantGeminiKey,
} from './gemini.js';
import {
  getTenantTikHubKeyInfo,
  setTenantTikHubKey,
  clearTenantTikHubKey,
  validateTenantTikHubKey,
} from './tikhub.js';
import {
  getOwnerBotToken,
  setOwnerBotToken,
  checkBotToken,
  sendTestMessage,
  refreshSubscribers,
  getSubscribers,
  removeSubscriber,
} from './owner_telegram.js';
import {
  isProvider,
  listProviderKeys,
  getProviderKeyInfo,
  setProviderKey,
  clearProviderKey,
  validateProviderKey,
} from './provider_keys.js';
import {
  requireEnterprise,
  EnterpriseFeatureRequiredError,
  type UserRole,
} from '../billing/feature_gate.js';

const router = Router();
import { JWT_SECRET } from '../../config/secrets.js';

// ============================================================================
// Auth middleware
// ============================================================================

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: UserRole;
  userEmail?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

/**
 * Хелпер: проверяет Enterprise-доступ и возвращает 402 если нет.
 * Не используем как middleware (async), вызываем явно в handler.
 */
async function ensureEnterprise(req: AuthedRequest, res: Response, feature: string): Promise<boolean> {
  try {
    await requireEnterprise(req.tenantId, req.userRole, feature);
    return true;
  } catch (err) {
    if (err instanceof EnterpriseFeatureRequiredError) {
      res.status(402).json({ error: err.message, feature: err.feature });
      return false;
    }
    res.status(500).json({ error: (err as Error).message });
    return false;
  }
}

router.use(requireAuth);

// ============================================================================
// GEMINI API KEY
// ============================================================================

router.get('/gemini', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'gemini-key'))) return;
  try {
    const info = await getTenantGeminiKeyInfo(req.tenantId!);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

router.put('/gemini', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'gemini-key'))) return;
  try {
    const { apiKey } = req.body || {};
    if (typeof apiKey !== 'string' || apiKey.length < 8) {
      return res.status(400).json({ error: 'Передайте валидный apiKey (string ≥ 8 символов)' });
    }
    await setTenantGeminiKey(req.tenantId!, apiKey.trim());
    // Сразу валидируем — клиент получит результат проверки
    const validation = await validateTenantGeminiKey(req.tenantId!);
    const info = await getTenantGeminiKeyInfo(req.tenantId!);
    res.json({ ...info, validation });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения' });
  }
});

router.delete('/gemini', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'gemini-key'))) return;
  try {
    await clearTenantGeminiKey(req.tenantId!);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

router.post('/gemini/validate', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'gemini-key'))) return;
  try {
    const validation = await validateTenantGeminiKey(req.tenantId!);
    const info = await getTenantGeminiKeyInfo(req.tenantId!);
    res.json({ ...info, validation });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка валидации' });
  }
});

// ============================================================================
// TIKHUB API KEY (TrendTraffic — Enterprise BYO для скана трендов)
// ============================================================================

router.get('/tikhub', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'tikhub-key'))) return;
  try {
    const info = await getTenantTikHubKeyInfo(req.tenantId!);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

router.put('/tikhub', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'tikhub-key'))) return;
  try {
    const { apiKey } = req.body || {};
    if (typeof apiKey !== 'string' || apiKey.length < 8) {
      return res.status(400).json({ error: 'Передайте валидный apiKey (string ≥ 8 символов)' });
    }
    await setTenantTikHubKey(req.tenantId!, apiKey.trim());
    // Сразу реально проверяем ключ против TikHub.
    const validation = await validateTenantTikHubKey(req.tenantId!);
    const info = await getTenantTikHubKeyInfo(req.tenantId!);
    res.json({ ...info, validation });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения' });
  }
});

router.delete('/tikhub', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'tikhub-key'))) return;
  try {
    await clearTenantTikHubKey(req.tenantId!);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

router.post('/tikhub/validate', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'tikhub-key'))) return;
  try {
    // Если в теле передан apiKey — проверяем именно его (до сохранения); иначе сохранённый.
    const raw = typeof req.body?.apiKey === 'string' ? req.body.apiKey : undefined;
    const validation = await validateTenantTikHubKey(req.tenantId!, raw);
    const info = await getTenantTikHubKeyInfo(req.tenantId!);
    res.json({ ...info, validation });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка валидации' });
  }
});

// ============================================================================
// OWNER TELEGRAM
// ============================================================================

/**
 * GET /api/tenant-settings/owner-telegram
 * Возвращает текущее состояние: токен сохранён? какой бот? список подписчиков.
 */
router.get('/owner-telegram', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'owner-telegram'))) return;
  try {
    const botToken = await getOwnerBotToken(req.tenantId!);
    const subscribers = await getSubscribers(req.tenantId!);
    res.json({
      hasBotToken: !!botToken,
      ...(botToken ? { botInfo: await checkBotToken(botToken) } : {}),
      subscribers,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/**
 * PUT /api/tenant-settings/owner-telegram
 * Сохраняет токен. Только это поле, больше ничего не нужно — подписчиков автоматически
 * найдёт через /getUpdates и сразу разошлёт welcome всем найденным.
 */
router.put('/owner-telegram', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'owner-telegram'))) return;
  try {
    const { botToken } = req.body || {};

    // Удаление (botToken === null) — отвязываем бот + чистим подписчиков
    if (botToken === null) {
      await setOwnerBotToken(req.tenantId!, null);
      return res.json({ ok: true, hasBotToken: false, subscribers: [] });
    }

    if (typeof botToken !== 'string' || !botToken.includes(':')) {
      return res.status(400).json({ error: 'Невалидный формат токена (ожидается «123456:ABC-DEF…»)' });
    }

    const trimmedToken = botToken.trim();

    // 1. Проверка токена через /getMe ДО сохранения
    const botCheck = await checkBotToken(trimmedToken);
    if (!botCheck.ok) {
      return res.status(400).json({
        ok: false,
        error: `Telegram отверг токен: ${botCheck.error}`,
        botInfo: botCheck,
      });
    }

    // 2. Сохраняем токен (подписчики сбрасываются если меняется бот — это норм)
    const previousToken = await getOwnerBotToken(req.tenantId!);
    if (previousToken !== trimmedToken) {
      // Чистим подписчиков от старого бота
      await pool.query(
        'UPDATE tenants SET owner_telegram_subscribers = $1 WHERE id = $2',
        [JSON.stringify([]), req.tenantId!]
      );
    }
    await setOwnerBotToken(req.tenantId!, trimmedToken);

    // 3. Refresh подписчиков через /getUpdates
    const refresh = await refreshSubscribers(req.tenantId!);

    // 4. Welcome-broadcast всем найденным
    let welcomeBroadcast: Awaited<ReturnType<typeof sendTestMessage>>['broadcast'] | undefined;
    if (refresh.subscribers.length > 0) {
      const TELEGRAM_API = 'https://api.telegram.org';
      let sent = 0, failed = 0;
      await Promise.all(refresh.subscribers.map(async (sub) => {
        try {
          const r = await fetch(`${TELEGRAM_API}/bot${trimmedToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: sub.chatId,
              text:
                `<b>✅ Бот @${botCheck.username} подключён к VibeVox</b>\n\n` +
                `Теперь сюда будут приходить уведомления вашего аккаунта:\n` +
                `• 🆕 Новые клиенты через Quest Flow\n` +
                `• 🏷 Выявленные потребности (теги)\n` +
                `• ⚠️ Ошибки Gemini-ключа / квоты`,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            }),
          });
          if (r.ok) sent++; else failed++;
        } catch { failed++; }
      }));
      welcomeBroadcast = { sent, failed, total: refresh.subscribers.length };
    }

    res.json({
      ok: true,
      hasBotToken: true,
      botInfo: botCheck,
      subscribers: refresh.subscribers,
      welcomeBroadcast,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения' });
  }
});

/**
 * POST /api/tenant-settings/owner-telegram/refresh
 * Обновить список подписчиков (если новые люди написали /start после save).
 */
router.post('/owner-telegram/refresh', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'owner-telegram'))) return;
  try {
    const result = await refreshSubscribers(req.tenantId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка refresh' });
  }
});

/**
 * DELETE /api/tenant-settings/owner-telegram/subscribers/:chatId
 * Удалить конкретного подписчика из списка рассылки.
 */
router.delete('/owner-telegram/subscribers/:chatId', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'owner-telegram'))) return;
  try {
    await removeSubscriber(req.tenantId!, req.params.chatId);
    const subscribers = await getSubscribers(req.tenantId!);
    res.json({ ok: true, subscribers });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка' });
  }
});

/**
 * POST /api/tenant-settings/owner-telegram/test
 * Тестовая рассылка всем подписчикам.
 */
router.post('/owner-telegram/test', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'owner-telegram'))) return;
  try {
    const result = await sendTestMessage(req.tenantId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка теста' });
  }
});

// ============================================================================
// OPENMONTAGE PROVIDER KEYS (Enterprise BYO — генеративные провайдеры рендера)
// ============================================================================

router.get('/provider-keys', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'provider-keys'))) return;
  try {
    res.json({ providers: await listProviderKeys(req.tenantId!) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

router.put('/provider-keys/:provider', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'provider-keys'))) return;
  try {
    const provider = String(req.params.provider || '');
    if (!isProvider(provider)) return res.status(404).json({ error: 'Неизвестный провайдер' });
    const { apiKey } = req.body || {};
    if (typeof apiKey !== 'string' || apiKey.trim().length < 4) {
      return res.status(400).json({ error: 'Передайте валидный apiKey (string ≥ 4 символов)' });
    }
    await setProviderKey(req.tenantId!, provider, apiKey.trim());
    // Сразу реально проверяем ключ против API провайдера (где это возможно).
    const validation = await validateProviderKey(req.tenantId!, provider);
    const info = await getProviderKeyInfo(req.tenantId!, provider);
    res.json({ ...info, validation });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения' });
  }
});

router.delete('/provider-keys/:provider', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'provider-keys'))) return;
  try {
    const provider = String(req.params.provider || '');
    if (!isProvider(provider)) return res.status(404).json({ error: 'Неизвестный провайдер' });
    await clearProviderKey(req.tenantId!, provider);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

router.post('/provider-keys/:provider/validate', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'provider-keys'))) return;
  try {
    const provider = String(req.params.provider || '');
    if (!isProvider(provider)) return res.status(404).json({ error: 'Неизвестный провайдер' });
    // Если в теле передан apiKey — проверяем именно его (до сохранения); иначе сохранённый.
    const raw = typeof req.body?.apiKey === 'string' ? req.body.apiKey : undefined;
    const validation = await validateProviderKey(req.tenantId!, provider, raw);
    const info = await getProviderKeyInfo(req.tenantId!, provider);
    res.json({ ...info, validation });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка валидации' });
  }
});

export default router;
