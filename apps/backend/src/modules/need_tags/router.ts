/**
 * Express router для tenant_need_tags + assigned_client_tags.
 *
 * Все эндпоинты требуют JWT + Enterprise-доступ.
 *
 * Mounts:
 *  - GET    /api/need-tags                  — список тегов tenant'а
 *  - POST   /api/need-tags                  — создать
 *  - PATCH  /api/need-tags/:id              — обновить (только свой tenant)
 *  - DELETE /api/need-tags/:id              — удалить (только свой)
 *  - GET    /api/need-tags/room/:roomId     — теги присвоенные комнате
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  listAssignedTagsForRoom,
} from './service.js';
import {
  requireEnterprise,
  EnterpriseFeatureRequiredError,
  type UserRole,
} from '../billing/feature_gate.js';
import pool from '../../db/index.js';

const router = Router();
import { JWT_SECRET } from '../../config/secrets.js';

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
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

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
// List / Create
// ============================================================================

router.get('/', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'need-tags'))) return;
  try {
    const tags = await listTags(req.tenantId!);
    res.json({ tags });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения тегов' });
  }
});

router.post('/', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'need-tags'))) return;
  try {
    const { name, description, color } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name обязателен' });
    }
    const tag = await createTag(req.tenantId!, {
      name: name.trim(),
      description: typeof description === 'string' ? description.trim() : null,
      color: typeof color === 'string' ? color : null,
    });
    res.status(201).json(tag);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка создания' });
  }
});

// ============================================================================
// Update / Delete (single)
// ============================================================================

router.patch('/:id', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'need-tags'))) return;
  try {
    const { name, description, color } = req.body || {};
    const updated = await updateTag(req.tenantId!, req.params.id, {
      name: typeof name === 'string' ? name : undefined,
      description: description === null || typeof description === 'string' ? description : undefined,
      color: color === null || typeof color === 'string' ? color : undefined,
    });
    if (!updated) return res.status(404).json({ error: 'Тег не найден' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка обновления' });
  }
});

router.delete('/:id', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'need-tags'))) return;
  try {
    const ok = await deleteTag(req.tenantId!, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Тег не найден' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

// ============================================================================
// Assigned to room
// ============================================================================

router.get('/room/:roomId', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'need-tags'))) return;
  try {
    // Защита: комната должна принадлежать этому tenant'у
    const r = await pool.query(
      'SELECT creator_tenant_id FROM rooms WHERE id = $1 LIMIT 1',
      [req.params.roomId]
    );
    const room = (r.rows as any[])[0];
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
    if (room.creator_tenant_id !== req.tenantId) {
      return res.status(403).json({ error: 'Нет доступа к этой комнате' });
    }
    const tags = await listAssignedTagsForRoom(req.params.roomId);
    res.json({ tags });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

export default router;
