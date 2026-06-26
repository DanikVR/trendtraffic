/**
 * Express router для MCP (Model Context Protocol).
 *
 * 1. Протокол (Bearer MCP-ключ, без JWT):
 *    POST /api/mcp            — JSON-RPC эндпоинт для внешних агентов/CRM
 *    GET  /api/mcp            — 405 (SSE/GET пока не поддержан)
 *
 * 2. Управление ключами (JWT + Enterprise):
 *    GET    /api/mcp/keys         — список ключей
 *    POST   /api/mcp/keys         — создать (returns rawKey один раз) { label?, scopes? }
 *    DELETE /api/mcp/keys/:id     — отозвать
 *    DELETE /api/mcp/keys/:id/hard— удалить из БД
 *    GET    /api/mcp/scopes       — доступные скоупы (для UI)
 *    GET    /api/mcp/info         — URL подключения
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import {
  requireEnterprise,
  EnterpriseFeatureRequiredError,
  hasEnterpriseAccess,
  type UserRole,
} from '../billing/feature_gate.js';
import { verifyKey, createKey, listKeys, revokeKey, deleteKey } from './keys.js';
import { MCP_SCOPES, ALL_SCOPES } from './scopes.js';
import { handleMcpMessage } from './server.js';
import type { McpToolContext } from './registry.js';

const router = Router();
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');

// ============================================================================
// 1. MCP PROTOCOL (Bearer MCP-ключ)
// ============================================================================

router.post('/', async (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const rawKey = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!rawKey) return res.status(401).json({ error: 'Authorization: Bearer <vbvx_mcp_...> обязателен' });

  const ident = await verifyKey(rawKey);
  if (!ident) return res.status(401).json({ error: 'Невалидный или отозванный MCP-ключ' });

  // MCP — Enterprise-only (ключ не создать без Enterprise, но тариф мог истечь).
  try {
    if (!(await hasEnterpriseAccess(ident.tenantId))) {
      return res.status(402).json({ error: 'MCP доступен только на тарифе Enterprise' });
    }
  } catch { /* при ошибке проверки — не блокируем */ }

  const ctx: McpToolContext = { tenantId: ident.tenantId, scopes: ident.scopes };
  const body = req.body;

  try {
    if (Array.isArray(body)) {
      const out: any[] = [];
      for (const m of body) {
        const r = await handleMcpMessage(ctx, m);
        if (r) out.push(r);
      }
      if (out.length === 0) return res.status(202).end();
      return res.json(out);
    }
    const single = await handleMcpMessage(ctx, body || {});
    if (!single) return res.status(202).end(); // нотификация — без тела
    return res.json(single);
  } catch (err: any) {
    return res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: err?.message || 'Ошибка' } });
  }
});

router.get('/', (_req: Request, res: Response) => {
  res.status(405).json({ error: 'Используйте POST для MCP JSON-RPC. SSE/GET пока не поддержан.' });
});

// ============================================================================
// 2. KEY MANAGEMENT (JWT + Enterprise)
// ============================================================================

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: UserRole;
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
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный JWT токен' });
  }
}

async function ensureEnterprise(req: AuthedRequest, res: Response): Promise<boolean> {
  try {
    await requireEnterprise(req.tenantId, req.userRole, 'mcp');
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

// JWT только на управляющих путях (не на корневом протокольном POST).
router.use(['/keys', '/scopes', '/info'], requireAuth);

router.get('/scopes', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  res.json({ scopes: ALL_SCOPES.map((s) => ({ scope: s, description: MCP_SCOPES[s] })) });
});

router.get('/info', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  res.json({ url: `${PUBLIC_BASE_URL}/api/mcp`, transport: 'streamable-http (JSON)' });
});

router.get('/keys', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  try {
    const keys = await listKeys(req.tenantId!);
    res.json({ keys });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

router.post('/keys', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  try {
    const { label, scopes } = req.body || {};
    const created = await createKey(req.tenantId!, typeof label === 'string' ? label : undefined, scopes);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка создания ключа' });
  }
});

router.delete('/keys/:id', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  try {
    const ok = await revokeKey(req.tenantId!, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Ключ не найден' });
    res.json({ ok: true, revoked: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка отзыва ключа' });
  }
});

router.delete('/keys/:id/hard', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  try {
    const ok = await deleteKey(req.tenantId!, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Ключ не найден' });
    res.json({ ok: true, deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

export default router;
