/**
 * TrendTraffic — загружаемые медиа-ассеты Галереи.
 *
 * kind = 'reference' (изображения/видео-референсы) | 'audio' (аудиодорожки).
 * Файлы лежат на диске (uploads/reference, uploads/audio), метаданные — в media_assets.
 * Только PostgreSQL: в fallback-режиме деградирует (try/catch → пусто/false).
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import pool from '../../db/index.js';

export type MediaKind = 'reference' | 'audio';

export interface MediaAsset {
  id: string;
  kind: string;
  mediaType: string; // image | video | audio | file
  originalName?: string;
  fileUrl: string;
  mime?: string;
  size?: number;
}

function mapRow(r: any): MediaAsset {
  return {
    id: r.id,
    kind: r.kind,
    mediaType: r.media_type,
    originalName: r.original_name || undefined,
    fileUrl: r.file_url,
    mime: r.mime || undefined,
    size: r.size != null ? Number(r.size) : undefined,
  };
}

export async function listAssets(tenantId: string, kind: MediaKind): Promise<MediaAsset[]> {
  try {
    const r = await pool.query(
      `SELECT id, kind, media_type, original_name, file_url, mime, size
       FROM media_assets WHERE tenant_id = $1 AND kind = $2 ORDER BY created_at DESC LIMIT 500`,
      [tenantId, kind]
    );
    return (r.rows as any[]).map(mapRow);
  } catch {
    return [];
  }
}

export async function createAsset(
  tenantId: string,
  a: { kind: MediaKind; mediaType: string; originalName?: string; fileUrl: string; filePath?: string; mime?: string; size?: number }
): Promise<MediaAsset | null> {
  try {
    const id = randomUUID();
    const r = await pool.query(
      `INSERT INTO media_assets (id, tenant_id, kind, media_type, original_name, file_url, file_path, mime, size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, kind, media_type, original_name, file_url, mime, size`,
      [id, tenantId, a.kind, a.mediaType, a.originalName || null, a.fileUrl, a.filePath || null, a.mime || null, a.size ?? null]
    );
    return mapRow(r.rows[0]);
  } catch (e) {
    console.warn('[media] createAsset failed:', (e as Error).message);
    return null;
  }
}

export async function deleteAsset(tenantId: string, id: string): Promise<boolean> {
  try {
    const r = await pool.query(`SELECT file_path FROM media_assets WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    const fp = r.rows[0]?.file_path;
    if (fp) { try { fs.unlinkSync(fp); } catch { /* файла может не быть */ } }
    const d = await pool.query(`DELETE FROM media_assets WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return (d.rowCount || 0) > 0;
  } catch {
    return false;
  }
}

export async function deleteAssets(tenantId: string, ids: string[]): Promise<number> {
  let n = 0;
  for (const id of ids) { if (await deleteAsset(tenantId, id)) n++; }
  return n;
}
