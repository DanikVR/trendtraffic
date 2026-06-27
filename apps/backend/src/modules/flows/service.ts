/**
 * OMNICHANNEL Фаза 2 — хранилище цепочек (flows).
 * Граф (nodes+edges в формате React Flow) хранится в flows.graph (JSONB).
 * flow_sessions (Фаза 0) ссылается на flows.id и держит состояние диалога.
 */
import pool from '../../db/index.js';
import { randomUUID } from 'crypto';
import { listTags } from '../need_tags/service.js';

export interface FlowGraph {
  nodes: any[];
  edges: any[];
  /** Триггеры запуска (Instagram): comment-to-DM, dm-keyword, story. */
  triggers?: any[];
  /** Исходное видео рендера «Собрать» (выбор центрального узла в MontageEditor). */
  source?: { url: string; name?: string } | null;
}

export interface Flow {
  id: string;
  tenant_id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  graph: FlowGraph;
  channel_type: string | null;
  chatwoot_inbox_id: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

const COLS = 'id, tenant_id, name, status, graph, channel_type, chatwoot_inbox_id, is_default, created_at, updated_at';

function parseGraph(g: any): FlowGraph {
  if (typeof g === 'string') { try { g = JSON.parse(g); } catch { g = null; } }
  if (!g || typeof g !== 'object') return { nodes: [], edges: [], triggers: [] };
  return {
    nodes: Array.isArray(g.nodes) ? g.nodes : [],
    edges: Array.isArray(g.edges) ? g.edges : [],
    triggers: Array.isArray(g.triggers) ? g.triggers : [],
    source: (g.source && typeof g.source === 'object' && typeof g.source.url === 'string')
      ? { url: g.source.url, name: typeof g.source.name === 'string' ? g.source.name : undefined }
      : null,
  };
}

function mapRow(r: any): Flow {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    name: r.name,
    status: (r.status || 'draft') as Flow['status'],
    graph: parseGraph(r.graph),
    channel_type: r.channel_type || null,
    chatwoot_inbox_id: r.chatwoot_inbox_id != null ? String(r.chatwoot_inbox_id) : null,
    is_default: r.is_default === true || r.is_default === 'true',
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function listFlows(tenantId: string): Promise<Flow[]> {
  try {
    const r = await pool.query(`SELECT ${COLS} FROM flows WHERE tenant_id = $1 ORDER BY updated_at DESC`, [tenantId]);
    return (r.rows as any[]).map(mapRow);
  } catch { return []; }
}

export async function getFlow(tenantId: string, id: string): Promise<Flow | null> {
  try {
    const r = await pool.query(`SELECT ${COLS} FROM flows WHERE tenant_id = $1 AND id = $2 LIMIT 1`, [tenantId, id]);
    const row = (r.rows as any[])[0];
    return row ? mapRow(row) : null;
  } catch { return null; }
}

export async function createFlow(
  tenantId: string,
  input: { name?: string; channelType?: string | null; chatwootInboxId?: string | null }
): Promise<Flow | null> {
  const id = randomUUID();
  const name = (input.name || 'Без названия').slice(0, 255);
  try {
    const r = await pool.query(
      `INSERT INTO flows (id, tenant_id, name, status, graph, channel_type, chatwoot_inbox_id)
       VALUES ($1, $2, $3, 'draft', '{"nodes":[],"edges":[]}'::jsonb, $4, $5)
       RETURNING ${COLS}`,
      [id, tenantId, name, input.channelType || null, input.chatwootInboxId || null]
    );
    const row = (r.rows as any[])[0];
    return row ? mapRow(row) : null;
  } catch (e) {
    console.warn('[flows] create failed:', (e as Error).message);
    return null;
  }
}

export async function updateFlow(
  tenantId: string,
  id: string,
  patch: Partial<Pick<Flow, 'name' | 'status' | 'graph' | 'channel_type' | 'chatwoot_inbox_id' | 'is_default'>>
): Promise<Flow | null> {
  const cur = await getFlow(tenantId, id);
  if (!cur) return null;
  const merged: Flow = {
    ...cur,
    name: patch.name !== undefined ? String(patch.name).slice(0, 255) : cur.name,
    status: patch.status !== undefined ? patch.status : cur.status,
    graph: patch.graph !== undefined ? parseGraph(patch.graph) : cur.graph,
    channel_type: patch.channel_type !== undefined ? patch.channel_type : cur.channel_type,
    chatwoot_inbox_id: patch.chatwoot_inbox_id !== undefined ? patch.chatwoot_inbox_id : cur.chatwoot_inbox_id,
    is_default: patch.is_default !== undefined ? !!patch.is_default : cur.is_default,
  };
  try {
    const r = await pool.query(
      `UPDATE flows SET name = $1, status = $2, graph = $3, channel_type = $4, chatwoot_inbox_id = $5, is_default = $6,
              updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $7 AND id = $8
       RETURNING ${COLS}`,
      [merged.name, merged.status, JSON.stringify(merged.graph), merged.channel_type, merged.chatwoot_inbox_id, merged.is_default, tenantId, id]
    );
    const row = (r.rows as any[])[0];
    return row ? mapRow(row) : merged;
  } catch (e) {
    console.warn('[flows] update failed:', (e as Error).message);
    return null;
  }
}

export async function deleteFlow(tenantId: string, id: string): Promise<boolean> {
  try {
    const r = await pool.query('DELETE FROM flows WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
    return (r.rowCount || 0) > 0;
  } catch { return false; }
}

/**
 * Активная цепочка для инбокса: сначала привязанная к inbox, иначе дефолтная активная.
 * Используется раннером при входящем сообщении.
 */
export async function getActiveFlowForInbox(tenantId: string, chatwootInboxId: string | null): Promise<Flow | null> {
  try {
    const r = await pool.query(`SELECT ${COLS} FROM flows WHERE tenant_id = $1 AND status = 'active'`, [tenantId]);
    const flows = (r.rows as any[]).map(mapRow);
    if (flows.length === 0) return null;
    if (chatwootInboxId) {
      const bound = flows.find((f) => f.chatwoot_inbox_id === String(chatwootInboxId));
      if (bound) return bound;
    }
    return flows.find((f) => f.is_default) || null;
  } catch { return null; }
}

export interface FlowAnalytics {
  periodDays: number;
  totalConversations: number;
  byChannel: { channel: string; conversations: number }[];
  messages: { client: number; ai: number };
  topTags: { tag: string; count: number }[];
}

/** Компактная аналитика по диалогам/каналам/тегам за N дней. Деградирует до нулей в fallback. */
export async function getFlowAnalytics(tenantId: string, days: number): Promise<FlowAnalytics> {
  const d = Math.max(1, Math.min(90, Math.floor(days) || 7));
  const byChannel: { channel: string; conversations: number }[] = [];
  let client = 0, ai = 0;
  const topTags: { tag: string; count: number }[] = [];

  try {
    const r = await pool.query(
      `SELECT LOWER(COALESCE(channel_type, CASE WHEN kind = 'telegram_chat' THEN 'telegram' ELSE 'web' END)) AS channel,
              COUNT(*)::int AS conversations
       FROM rooms
       WHERE creator_tenant_id = $1 AND created_at >= NOW() - ($2 * INTERVAL '1 day')
         AND kind IN ('channel_chat', 'telegram_chat')
       GROUP BY 1 ORDER BY conversations DESC`,
      [tenantId, d]
    );
    for (const row of (r.rows as any[])) byChannel.push({ channel: String(row.channel), conversations: Number(row.conversations) });
  } catch { /* fallback / нет данных */ }

  try {
    const r = await pool.query(
      `SELECT m.sender, COUNT(*)::int AS cnt FROM room_messages m JOIN rooms r ON r.id = m.room_id
       WHERE r.creator_tenant_id = $1 AND m.created_at >= NOW() - ($2 * INTERVAL '1 day') GROUP BY m.sender`,
      [tenantId, d]
    );
    for (const row of (r.rows as any[])) { if (row.sender === 'client') client = Number(row.cnt); else if (row.sender === 'ai') ai = Number(row.cnt); }
  } catch { /* fallback */ }

  try {
    const r = await pool.query(
      `SELECT cta.tag_id, COUNT(*)::int AS cnt FROM client_tag_assignments cta JOIN rooms r ON r.id = cta.room_id
       WHERE r.creator_tenant_id = $1 AND r.created_at >= NOW() - ($2 * INTERVAL '1 day')
       GROUP BY cta.tag_id ORDER BY cnt DESC LIMIT 8`,
      [tenantId, d]
    );
    const rows = r.rows as any[];
    if (rows.length > 0) {
      const tags = await listTags(tenantId).catch(() => []);
      const nameById = new Map((tags as any[]).map((t) => [t.id, t.name]));
      for (const row of rows) topTags.push({ tag: nameById.get(row.tag_id) || 'тег', count: Number(row.cnt) });
    }
  } catch { /* fallback / нет таблицы тегов */ }

  const totalConversations = byChannel.reduce((s, c) => s + c.conversations, 0);
  return { periodDays: d, totalConversations, byChannel, messages: { client, ai }, topTags };
}

/** Активная цепочка для канала (например 'instagram' при прямом подключении без Chatwoot-инбокса). */
export async function getActiveFlowForChannel(tenantId: string, channelType: string): Promise<Flow | null> {
  try {
    const r = await pool.query(`SELECT ${COLS} FROM flows WHERE tenant_id = $1 AND status = 'active'`, [tenantId]);
    const flows = (r.rows as any[]).map(mapRow);
    if (flows.length === 0) return null;
    const ch = String(channelType).toLowerCase();
    const byChannel = flows.find((f) => (f.channel_type || '').toLowerCase() === ch);
    if (byChannel) return byChannel;
    return flows.find((f) => f.is_default) || null;
  } catch { return null; }
}
