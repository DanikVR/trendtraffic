/**
 * OMNICHANNEL Фаза 2 — REST API цепочек (flows). JWT + Enterprise.
 *
 *  GET    /api/flows        — список цепочек tenant'а
 *  GET    /api/flows/:id    — одна цепочка (граф)
 *  POST   /api/flows        — создать (draft)
 *  PUT    /api/flows/:id    — обновить (name/status/graph/привязка)
 *  DELETE /api/flows/:id    — удалить
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { requireEnterprise, EnterpriseFeatureRequiredError, type UserRole } from '../billing/feature_gate.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { listFlows, getFlow, createFlow, updateFlow, deleteFlow, getFlowAnalytics } from './service.js';

const router = Router();

// Загрузка медиафайлов блока «Медиа» → uploads/flow-media; тип определяется по MIME автоматически.
const __fr_dir = path.dirname(fileURLToPath(import.meta.url));
const FLOW_MEDIA_DIR = path.resolve(__fr_dir, '../../../../uploads/flow-media');
try { fs.mkdirSync(FLOW_MEDIA_DIR, { recursive: true }); } catch { /* best-effort */ }
const uploadFlowMedia = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FLOW_MEDIA_DIR),
    filename: (_req, file, cb) => cb(null, `fm-${randomUUID()}${path.extname(file.originalname) || ''}`),
  }),
  limits: { fileSize: 40 * 1024 * 1024 }, // 40 МБ — потолок Chatwoot
});

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

async function ensureEnterprise(req: AuthedRequest, res: Response): Promise<boolean> {
  try {
    await requireEnterprise(req.tenantId, req.userRole, 'flow-constructor');
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

router.get('/', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  res.json({ flows: await listFlows(req.tenantId!) });
});

router.get('/analytics', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  const days = parseInt(String(req.query.days || '7'), 10) || 7;
  res.json({ analytics: await getFlowAnalytics(req.tenantId!, days) });
});

router.get('/:id', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  const flow = await getFlow(req.tenantId!, req.params.id);
  if (!flow) return res.status(404).json({ error: 'Цепочка не найдена' });
  res.json({ flow });
});

router.post('/', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  const { name, channelType, chatwootInboxId } = req.body || {};
  const flow = await createFlow(req.tenantId!, { name, channelType, chatwootInboxId });
  if (!flow) return res.status(500).json({ error: 'Не удалось создать цепочку' });
  res.status(201).json({ flow });
});

router.put('/:id', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  const { name, status, graph, channelType, chatwootInboxId, isDefault } = req.body || {};
  const patch: Record<string, any> = {};
  if (name !== undefined) patch.name = name;
  if (status !== undefined) patch.status = status;
  if (graph !== undefined) patch.graph = graph;
  if (channelType !== undefined) patch.channel_type = channelType;
  if (chatwootInboxId !== undefined) patch.chatwoot_inbox_id = chatwootInboxId;
  if (isDefault !== undefined) patch.is_default = isDefault;
  const flow = await updateFlow(req.tenantId!, req.params.id, patch);
  if (!flow) return res.status(404).json({ error: 'Цепочка не найдена' });
  res.json({ flow });
});

router.delete('/:id', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  res.json({ ok: await deleteFlow(req.tenantId!, req.params.id) });
});

// POST /api/flows/media-upload — загрузить файл (multipart "file"); вернёт { url, mime, mediaType }.
router.post('/media-upload', uploadFlowMedia.single('file'), async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res))) return;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'Файл не передан' });
  const mime = file.mimetype || 'application/octet-stream';
  const mediaType = mime.startsWith('image/') ? 'image'
    : mime.startsWith('video/') ? 'video'
    : mime.startsWith('audio/') ? 'audio' : 'file';
  res.status(201).json({ ok: true, url: `/uploads/flow-media/${path.basename(file.path)}`, mime, mediaType });
});

export default router;
