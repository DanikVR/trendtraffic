/**
 * OMNICHANNEL Фаза 2 — состояние выполнения цепочки на диалог-комнату.
 * «1 диалог = 1 активная flow_session»: текущий узел + накопленные переменные.
 */
import pool from '../../db/index.js';
import { randomUUID } from 'crypto';

export interface FlowSession {
  id: string;
  room_id: string;
  tenant_id: string | null;
  flow_id: string | null;
  current_node_id: string | null;
  status: 'active' | 'completed' | 'aborted';
  variables: Record<string, any>;
}

function parseVars(v: any): Record<string, any> {
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = {}; } }
  return v && typeof v === 'object' ? v : {};
}

function mapRow(r: any): FlowSession {
  return {
    id: r.id,
    room_id: r.room_id,
    tenant_id: r.tenant_id || null,
    flow_id: r.flow_id || null,
    current_node_id: r.current_node_id || null,
    status: (r.status || 'active') as FlowSession['status'],
    variables: parseVars(r.variables),
  };
}

export async function getActiveSession(roomId: string): Promise<FlowSession | null> {
  try {
    const r = await pool.query(
      `SELECT id, room_id, tenant_id, flow_id, current_node_id, status, variables
       FROM flow_sessions WHERE room_id = $1 AND status = 'active' LIMIT 1`,
      [roomId]
    );
    const row = (r.rows as any[])[0];
    return row ? mapRow(row) : null;
  } catch { return null; }
}

export async function createSession(input: {
  roomId: string;
  tenantId?: string | null;
  flowId?: string | null;
  currentNodeId?: string | null;
  variables?: Record<string, any>;
}): Promise<FlowSession | null> {
  const id = randomUUID();
  try {
    const r = await pool.query(
      `INSERT INTO flow_sessions (id, room_id, tenant_id, flow_id, current_node_id, status, variables)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)
       RETURNING id, room_id, tenant_id, flow_id, current_node_id, status, variables`,
      [id, input.roomId, input.tenantId || null, input.flowId || null, input.currentNodeId || null, JSON.stringify(input.variables || {})]
    );
    const row = (r.rows as any[])[0];
    return row ? mapRow(row) : { id, room_id: input.roomId, tenant_id: input.tenantId || null, flow_id: input.flowId || null, current_node_id: input.currentNodeId || null, status: 'active', variables: input.variables || {} };
  } catch (e) {
    console.warn('[flow_sessions] create failed:', (e as Error).message);
    return null;
  }
}

/** Полное обновление состояния сессии (current node + variables + status). */
export async function saveSession(session: FlowSession): Promise<void> {
  try {
    await pool.query(
      `UPDATE flow_sessions SET current_node_id = $1, variables = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [session.current_node_id ?? null, JSON.stringify(session.variables || {}), session.status || 'active', session.id]
    );
  } catch (e) {
    console.warn('[flow_sessions] save failed:', (e as Error).message);
  }
}
