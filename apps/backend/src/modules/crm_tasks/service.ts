/**
 * CRM-ЗАДАЧИ — «двойные задачи + авто-сообщения» (см. docs/KANBAN_CRM_MODULE.md).
 *
 * Два типа задач на контакт Chatwoot (бесконечно):
 *  - internal_notification — напоминание ОПЕРАТОРУ: в due_at эмитим событие
 *    (WS-тост в интерфейсе оператора; FCM — Фаза 3). Статус НЕ авто-меняется —
 *    оператор сам ставит галочку. Анти-повтор: ставим fired_at.
 *  - client_message — авто-сообщение КЛИЕНТУ: в due_at бэкенд сам шлёт текст в
 *    диалог через Chatwoot Application API (sendChatwootReply) и помечает completed.
 *
 * Планировщик — простой БД-таймер (раз в минуту), без BullMQ/Redis (решение владельца).
 * Изоляция — ВСЕ запросы фильтруются по tenant_id.
 */

import { EventEmitter } from 'events';
import pool from '../../db/index.js';
import { getEffectiveChatwoot, sendChatwootReply } from '../tenant_settings/chatwoot.js';

export type CrmTaskType = 'internal_notification' | 'client_message';
export type CrmTaskStatus = 'todo' | 'completed' | 'failed';

export interface CrmTask {
  id: string;
  tenant_id: string;
  chatwoot_account_id: string;
  chatwoot_contact_id: string;
  chatwoot_conversation_id: string | null;
  assigned_operator_id: string;
  type: CrmTaskType;
  body: string;
  due_at: string;
  status: CrmTaskStatus;
  fired_at: string | null;
  error: string | null;
  created_at?: string;
}

/** Шина событий: WS-слой (Фаза 1, фронт) подписывается на 'reminder'. */
export const crmTaskEvents = new EventEmitter();

const SELECT_COLS =
  'id, tenant_id, chatwoot_account_id, chatwoot_contact_id, chatwoot_conversation_id, assigned_operator_id, type, body, due_at, status, fired_at, error, created_at';

// ============================================================================
// CRUD (всё под tenant_id)
// ============================================================================

export async function createTask(input: {
  tenantId: string;
  chatwootAccountId: string;
  chatwootContactId: string;
  chatwootConversationId?: string | null;
  assignedOperatorId: string;
  type: CrmTaskType;
  body: string;
  dueAt: string; // ISO
}): Promise<CrmTask | null> {
  const r = await pool.query(
    `INSERT INTO crm_tasks
       (tenant_id, chatwoot_account_id, chatwoot_contact_id, chatwoot_conversation_id,
        assigned_operator_id, type, body, due_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING ${SELECT_COLS}`,
    [
      input.tenantId,
      input.chatwootAccountId,
      input.chatwootContactId,
      input.chatwootConversationId || null,
      input.assignedOperatorId,
      input.type,
      input.body,
      input.dueAt,
    ]
  );
  return ((r.rows as any[])[0] as CrmTask) || null;
}

/** Задачи по контакту: сначала активные (todo) по возрастанию due_at, затем архив. */
export async function listTasksByContact(tenantId: string, contactId: string): Promise<CrmTask[]> {
  const r = await pool.query(
    `SELECT ${SELECT_COLS} FROM crm_tasks
     WHERE tenant_id = $1 AND chatwoot_contact_id = $2
     ORDER BY (status = 'todo') DESC, due_at ASC`,
    [tenantId, contactId]
  );
  return r.rows as CrmTask[];
}

/** Смена статуса (todo↔completed) и/или перенос due_at. Перенос сбрасывает fired_at. */
export async function updateTask(
  tenantId: string,
  id: string,
  patch: { status?: CrmTaskStatus; dueAt?: string }
): Promise<CrmTask | null> {
  const sets: string[] = ['updated_at = now()'];
  const vals: any[] = [];
  let i = 1;
  if (patch.status) { sets.push(`status = $${i++}`); vals.push(patch.status); }
  if (patch.dueAt) { sets.push(`due_at = $${i++}`); sets.push('fired_at = NULL'); vals.push(patch.dueAt); }
  vals.push(tenantId, id);
  const r = await pool.query(
    `UPDATE crm_tasks SET ${sets.join(', ')} WHERE tenant_id = $${i++} AND id = $${i} RETURNING ${SELECT_COLS}`,
    vals
  );
  return ((r.rows as any[])[0] as CrmTask) || null;
}

export async function deleteTask(tenantId: string, id: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM crm_tasks WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
  return (r.rowCount || 0) > 0;
}

/**
 * Каскад: контакт удалён В Chatwoot → чистим его отложенные задачи, чтобы воркер
 * не пытался отправить сообщение «в пустоту». Ключ — account_id + contact_id.
 * (Дополнительная страховка: при отправке client_message несуществующему контакту
 * Chatwoot вернёт ошибку → задача помечается failed, а не уходит «в никуда».)
 */
export async function deleteTasksForChatwootContact(
  chatwootAccountId: string,
  chatwootContactId: string
): Promise<number> {
  try {
    const r = await pool.query(
      `DELETE FROM crm_tasks WHERE chatwoot_account_id = $1 AND chatwoot_contact_id = $2`,
      [chatwootAccountId, chatwootContactId]
    );
    return r.rowCount || 0;
  } catch (err) {
    console.warn('[crm_tasks] очистка задач при удалении контакта не удалась:', (err as Error).message);
    return 0;
  }
}

/** Доска/календарь: все задачи аккаунта за N дней (опц. фильтр по оператору). */
export async function listBoard(
  tenantId: string,
  opts: { days?: number; operatorId?: string | null }
): Promise<CrmTask[]> {
  const days = Math.min(Math.max(opts.days || 7, 1), 90);
  const params: any[] = [tenantId, days];
  let where = `tenant_id = $1 AND due_at >= now() - ($2::int * interval '1 day')`;
  if (opts.operatorId) { params.push(opts.operatorId); where += ` AND assigned_operator_id = $3`; }
  const r = await pool.query(
    `SELECT ${SELECT_COLS} FROM crm_tasks WHERE ${where} ORDER BY due_at ASC`,
    params
  );
  return r.rows as CrmTask[];
}

// ============================================================================
// Планировщик (БД-таймер раз в минуту)
// ============================================================================

/** Внутреннее напоминание — эмит события оператору (WS подключим на Фазе 1). */
function notifyOperator(task: CrmTask): void {
  console.log(`[crm_tasks] 🔔 напоминание оператору ${task.assigned_operator_id}: ${task.body.slice(0, 80)}`);
  crmTaskEvents.emit('reminder', { operatorId: task.assigned_operator_id, task });
}

/** Один проход: берём наступившие 'todo' (ещё не сработавшие) и выполняем по типу. */
async function fireDueTasks(): Promise<void> {
  let due: CrmTask[];
  try {
    const r = await pool.query(
      `SELECT ${SELECT_COLS} FROM crm_tasks
       WHERE status = 'todo' AND fired_at IS NULL AND due_at <= now()
       ORDER BY due_at ASC LIMIT 100`
    );
    due = r.rows as CrmTask[];
  } catch (err) {
    console.warn('[crm_tasks] опрос планировщика не удался:', (err as Error).message);
    return;
  }

  for (const task of due) {
    try {
      if (task.type === 'client_message') {
        if (!task.chatwoot_conversation_id) {
          await pool.query(
            `UPDATE crm_tasks SET status='failed', error='no conversation_id', fired_at=now(), updated_at=now() WHERE id=$1`,
            [task.id]
          );
          continue;
        }
        const cfg = await getEffectiveChatwoot(task.tenant_id);
        const res = await sendChatwootReply(cfg, task.chatwoot_account_id, task.chatwoot_conversation_id, task.body);
        if (res.ok) {
          await pool.query(`UPDATE crm_tasks SET status='completed', fired_at=now(), updated_at=now() WHERE id=$1`, [task.id]);
        } else {
          await pool.query(
            `UPDATE crm_tasks SET status='failed', error=$2, fired_at=now(), updated_at=now() WHERE id=$1`,
            [task.id, (res.error || 'send failed').slice(0, 500)]
          );
        }
      } else {
        // internal_notification: уведомляем оператора; статус остаётся 'todo'
        // (закрывает оператор галочкой), помечаем fired_at — чтобы не дублировать.
        notifyOperator(task);
        await pool.query(`UPDATE crm_tasks SET fired_at=now(), updated_at=now() WHERE id=$1`, [task.id]);
      }
    } catch (err) {
      console.warn(`[crm_tasks] срабатывание ${task.id} упало:`, (err as Error).message);
    }
  }
}

let crmTimer: ReturnType<typeof setInterval> | null = null;

export function startCrmTaskScheduler(): void {
  if (crmTimer) return;
  setTimeout(() => void fireDueTasks(), 20 * 1000);            // первый прогон через 20с
  crmTimer = setInterval(() => void fireDueTasks(), 60 * 1000); // далее раз в минуту
  console.log('[crm_tasks] Планировщик запущен (раз в минуту)');
}
