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
  getOwnerBotToken,
  setOwnerBotToken,
  checkBotToken,
  sendTestMessage,
  refreshSubscribers,
  getSubscribers,
  removeSubscriber,
} from './owner_telegram.js';
import {
  getTenantChatwoot,
  getTenantChatwootInfo,
  setTenantChatwoot,
  setTenantChatwootEnabled,
  testChatwootConnection,
} from './chatwoot.js';
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
// CHATWOOT
// ============================================================================

router.get('/chatwoot', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'chatwoot'))) return;
  try {
    const info = await getTenantChatwootInfo(req.tenantId!);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

router.put('/chatwoot', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'chatwoot'))) return;
  try {
    const { url, token, enabled } = req.body || {};
    if (url !== null && (typeof url !== 'string' || !url.startsWith('http'))) {
      return res.status(400).json({ error: 'url должен начинаться с http:// или https://' });
    }
    if (token !== null && typeof token !== 'string') {
      return res.status(400).json({ error: 'token должен быть строкой' });
    }
    await setTenantChatwoot(
      req.tenantId!,
      url ? String(url).trim() : null,
      token ? String(token).trim() : null,
      typeof enabled === 'boolean' ? enabled : undefined
    );
    const info = await getTenantChatwootInfo(req.tenantId!);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения' });
  }
});

router.post('/chatwoot/test', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'chatwoot'))) return;
  try {
    // Если в body передали url+token — тестируем их (для проверки до сохранения).
    // Иначе тестируем сохранённые.
    const { url, token } = req.body || {};
    const cfg = (url && token)
      ? { url: String(url).trim(), token: String(token).trim(), enabled: true }
      : await getTenantChatwoot(req.tenantId!);
    const result = await testChatwootConnection(cfg);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка теста' });
  }
});

router.put('/chatwoot/enabled', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'chatwoot'))) return;
  try {
    const { enabled } = req.body || {};
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) обязателен' });
    await setTenantChatwootEnabled(req.tenantId!, enabled);
    res.json({ ok: true, enabled });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка' });
  }
});

export default router;
