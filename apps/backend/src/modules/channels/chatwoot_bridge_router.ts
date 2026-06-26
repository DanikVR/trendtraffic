/**
 * OMNICHANNEL CW-SSO — мост «нажал Чат → бесшовно открыл Chatwoot».
 *
 * Endpoint (JWT + Enterprise):
 *   GET /api/chatwoot-bridge/open?roomId=<uuid>
 *     → 200 { configured:true, url, deepLink, conversationId }   — открываем url
 *     → 200 { configured:false }                                  — мост не настроен,
 *           фронт откатывается на внутренний чат VibeVox (/room/:id/chat).
 *
 * url — одноразовая SSO-ссылка Platform API (агент уже залогинен). deepLink —
 * прямая ссылка на диалог клиента (для будущего iframe-варианта/Фазы 2).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../../db/index.js';
import { JWT_SECRET } from '../../config/secrets.js';
import {
  requireEnterprise,
  EnterpriseFeatureRequiredError,
  type UserRole,
} from '../billing/feature_gate.js';
import { isPlatformConfigured, getChatwootEntryForRoom } from './chatwoot_platform.js';

const router = Router();

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

router.use(requireAuth);

router.get('/open', async (req: AuthedRequest, res: Response) => {
  // Enterprise-гейт (как в enterprise-chat).
  try {
    await requireEnterprise(req.tenantId, req.userRole, 'chatwoot-bridge');
  } catch (err) {
    if (err instanceof EnterpriseFeatureRequiredError) {
      return res.status(402).json({ error: err.message, feature: err.feature });
    }
    return res.status(500).json({ error: (err as Error).message });
  }

  // Мост выключен → фронт идёт на внутренний чат.
  if (!isPlatformConfigured()) {
    return res.json({ configured: false });
  }

  const roomId = (req.query.roomId as string) || '';
  let room: { id: string; name: string; kind?: string | null; chatwoot_conversation_id?: string | null } | null = null;
  if (roomId) {
    try {
      const r = await pool.query(
        `SELECT id, name, kind, creator_tenant_id, chatwoot_conversation_id
         FROM rooms WHERE id = $1 LIMIT 1`,
        [roomId],
      );
      const row = (r.rows as any[])[0];
      if (!row) return res.status(404).json({ error: 'Комната не найдена' });
      if (row.creator_tenant_id !== req.tenantId) {
        return res.status(403).json({ error: 'Нет доступа к этой комнате' });
      }
      room = {
        id: row.id,
        name: row.name,
        kind: row.kind,
        chatwoot_conversation_id: row.chatwoot_conversation_id || null,
      };
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Ошибка проверки доступа' });
    }
  }

  try {
    const lang = typeof req.query.lang === 'string' ? req.query.lang : null;
    const entry = await getChatwootEntryForRoom(
      req.tenantId!,
      req.userEmail || '',
      req.userEmail || '',
      room,
      lang,
    );
    if (!entry) {
      // Провижининг/SSO не удался — мягкий откат на внутренний чат.
      return res.json({ configured: false });
    }
    return res.json({
      configured: true,
      url: entry.ssoUrl,
      deepLink: entry.deepLink,
      conversationId: entry.conversationId,
      accountId: entry.accountId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка моста Chatwoot' });
  }
});

export default router;
