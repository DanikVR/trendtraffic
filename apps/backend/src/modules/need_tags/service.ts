/**
 * Теги потребностей (Enterprise v0.10.0) — CRUD-операции.
 *
 * Владелец Enterprise-аккаунта определяет набор «потребностей», которые AI должен
 * распознавать в диалогах с клиентами (Telegram через Quest Flow + video-комнаты).
 *
 * Каждый тег:
 *  - name — короткий лейбл («Юрист», «Срочно», «Заинтересован в Premium»)
 *  - description — промт-подсказка для AI (как понять что потребность совпала)
 *  - color — для UI на карточке комнаты
 *
 * При выявлении тега AI создаёт client_tag_assignments — это уже на стороне детектора.
 */

import pool from '../../db/index.js';

export interface NeedTag {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: any): NeedTag {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description || null,
    color: row.color || null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function listTags(tenantId: string): Promise<NeedTag[]> {
  const res = await pool.query(
    'SELECT * FROM tenant_need_tags WHERE tenant_id = $1 ORDER BY created_at ASC',
    [tenantId]
  );
  return (res.rows as any[]).map(mapRow);
}

export async function getTag(tenantId: string, id: string): Promise<NeedTag | null> {
  const res = await pool.query(
    'SELECT * FROM tenant_need_tags WHERE id = $1 LIMIT 1',
    [id]
  );
  const row = (res.rows as any[])[0];
  if (!row) return null;
  // Защита от cross-tenant доступа
  if (row.tenant_id !== tenantId) return null;
  return mapRow(row);
}

export async function createTag(
  tenantId: string,
  data: { name: string; description?: string | null; color?: string | null }
): Promise<NeedTag> {
  const res = await pool.query(
    `INSERT INTO tenant_need_tags (tenant_id, name, description, color)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [tenantId, data.name.slice(0, 64), data.description?.slice(0, 1000) || null, data.color || null]
  );
  return mapRow((res.rows as any[])[0]);
}

export async function updateTag(
  tenantId: string,
  id: string,
  data: { name?: string; description?: string | null; color?: string | null }
): Promise<NeedTag | null> {
  // Сначала проверим что тег принадлежит этому tenant'у
  const existing = await getTag(tenantId, id);
  if (!existing) return null;

  const newName = data.name !== undefined ? data.name.slice(0, 64) : existing.name;
  const newDesc = data.description !== undefined ? (data.description?.slice(0, 1000) || null) : existing.description;
  const newColor = data.color !== undefined ? data.color : existing.color;

  const res = await pool.query(
    `UPDATE tenant_need_tags
     SET name = $1, description = $2, color = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 RETURNING *`,
    [newName, newDesc, newColor, id]
  );
  const row = (res.rows as any[])[0];
  return row ? mapRow(row) : null;
}

export async function deleteTag(tenantId: string, id: string): Promise<boolean> {
  // Проверка принадлежности
  const existing = await getTag(tenantId, id);
  if (!existing) return false;

  const res = await pool.query('DELETE FROM tenant_need_tags WHERE id = $1', [id]);
  return (res.rowCount || 0) > 0;
}

// ============================================================================
// Чтение присвоенных тегов конкретной комнате (для отображения на карточке)
// ============================================================================

export interface AssignedTag {
  id: string;
  tagId: string;
  name: string;
  color: string | null;
  confidence: number | null;
  detectedAt: Date;
}

export async function listAssignedTagsForRoom(roomId: string): Promise<AssignedTag[]> {
  const res = await pool.query(
    `SELECT a.id, a.tag_id, a.confidence, a.detected_at,
            t.name, t.color
     FROM client_tag_assignments a
     LEFT JOIN tenant_need_tags t ON t.id = a.tag_id
     WHERE a.room_id = $1
     ORDER BY a.detected_at ASC`,
    [roomId]
  );
  return (res.rows as any[]).map((r) => ({
    id: r.id,
    tagId: r.tag_id,
    name: r.name || '?',
    color: r.color || null,
    confidence: r.confidence != null ? Number(r.confidence) : null,
    detectedAt: new Date(r.detected_at),
  }));
}
