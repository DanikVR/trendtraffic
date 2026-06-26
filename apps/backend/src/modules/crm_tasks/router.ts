/**
 * CRM-ЗАДАЧИ — API (`/api/crm-tasks`). JWT + Enterprise.
 *
 * Изоляция: tenant_id берём ИЗ ТОКЕНА (не с клиента). chatwoot_account_id —
 * из tenants.chatwoot_account_id (приоритет), иначе из тела (контекст Dashboard App).
 *
 * Эндпоинты:
 *   GET    /api/crm-tasks?contactId=   — задачи по контакту (todo→архив)
 *   POST   /api/crm-tasks              — создать
 *   PATCH  /api/crm-tasks/:id          — статус / перенос due_at
 *   DELETE /api/crm-tasks/:id          — удалить
 *   GET    /api/crm-tasks/board?days=&operatorId=  — доска/календарь
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../../db/index.js';
import { JWT_SECRET } from '../../config/secrets.js';
import { requireEnterprise, EnterpriseFeatureRequiredError, type UserRole } from '../billing/feature_gate.js';
import { createTask, listTasksByContact, updateTask, deleteTask, listBoard, type CrmTaskType } from './service.js';

const router = Router();

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: UserRole;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const decoded = jwt.verify(auth.substring(7), JWT_SECRET) as any;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

router.use(requireAuth);
router.use(async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    await requireEnterprise(req.tenantId, req.userRole, 'crm-tasks');
    next();
  } catch (err) {
    if (err instanceof EnterpriseFeatureRequiredError) {
      return res.status(402).json({ error: err.message, feature: err.feature });
    }
    return res.status(500).json({ error: (err as Error).message });
  }
});

/** chatwoot_account_id тенанта (приоритет) либо переданный из контекста Dashboard App. */
async function resolveAccountId(tenantId: string, fromBody?: string): Promise<string | null> {
  try {
    const r = await pool.query(`SELECT chatwoot_account_id FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    const acc = (r.rows as any[])[0]?.chatwoot_account_id;
    if (acc) return String(acc);
  } catch { /* fallthrough */ }
  return fromBody ? String(fromBody) : null;
}

const VALID_TYPES: CrmTaskType[] = ['internal_notification', 'client_message'];

router.get('/board', async (req: AuthedRequest, res: Response) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 7;
    const operatorId = (req.query.operatorId as string) || null;
    const rows = await listBoard(req.tenantId!, { days, operatorId });
    return res.json({ tasks: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка доски' });
  }
});

router.get('/', async (req: AuthedRequest, res: Response) => {
  const contactId = (req.query.contactId as string) || '';
  if (!contactId) return res.status(400).json({ error: 'contactId обязателен' });
  try {
    const rows = await listTasksByContact(req.tenantId!, contactId);
    return res.json({ tasks: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка списка' });
  }
});

router.post('/', async (req: AuthedRequest, res: Response) => {
  const b = req.body || {};
  const type = b.type as CrmTaskType;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Неверный type' });
  if (!b.body || !String(b.body).trim()) return res.status(400).json({ error: 'body обязателен' });
  if (!b.due_at) return res.status(400).json({ error: 'due_at обязателен' });
  // Защита от «дурака»: due_at должен быть в будущем (UTC-сравнение, TZ-безопасно).
  // Иначе минутный воркер сразу отправит/завалит задачу. Грейс 30с на округление.
  const dueDate = new Date(b.due_at);
  if (isNaN(dueDate.getTime())) return res.status(400).json({ error: 'Неверный формат due_at (нужен ISO 8601 UTC)' });
  if (dueDate.getTime() < Date.now() - 30_000) {
    return res.status(400).json({ error: 'due_at в прошлом — нельзя планировать на прошедшее время' });
  }
  if (!b.chatwoot_contact_id) return res.status(400).json({ error: 'chatwoot_contact_id обязателен' });
  if (type === 'client_message' && !b.chatwoot_conversation_id) {
    return res.status(400).json({ error: 'Для авто-сообщения нужен chatwoot_conversation_id' });
  }
  const accountId = await resolveAccountId(req.tenantId!, b.chatwoot_account_id);
  if (!accountId) return res.status(400).json({ error: 'Не определён chatwoot_account_id' });
  try {
    const task = await createTask({
      tenantId: req.tenantId!,
      chatwootAccountId: accountId,
      chatwootContactId: String(b.chatwoot_contact_id),
      chatwootConversationId: b.chatwoot_conversation_id ? String(b.chatwoot_conversation_id) : null,
      assignedOperatorId: String(b.assigned_operator_id || ''),
      type,
      body: String(b.body),
      dueAt: dueDate.toISOString(), // строго UTC (TIMESTAMPTZ на стороне БД)
    });
    return res.json({ task });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка создания' });
  }
});

router.patch('/:id', async (req: AuthedRequest, res: Response) => {
  const b = req.body || {};
  const patch: { status?: any; dueAt?: string } = {};
  if (b.status) {
    if (!['todo', 'completed', 'failed'].includes(b.status)) return res.status(400).json({ error: 'Неверный status' });
    patch.status = b.status;
  }
  if (b.due_at) patch.dueAt = new Date(b.due_at).toISOString();
  if (!patch.status && !patch.dueAt) return res.status(400).json({ error: 'Нечего обновлять' });
  try {
    const task = await updateTask(req.tenantId!, req.params.id, patch);
    if (!task) return res.status(404).json({ error: 'Задача не найдена' });
    return res.json({ task });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка обновления' });
  }
});

router.delete('/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await deleteTask(req.tenantId!, req.params.id);
    return res.json({ ok });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

export default router;
