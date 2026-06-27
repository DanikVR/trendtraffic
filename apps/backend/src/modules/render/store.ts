/**
 * TrendTraffic — хранилище очереди рендера (таблица render_jobs).
 *
 * Лёгкая Postgres-очередь БЕЗ внешних зависимостей: claim самой старой 'queued'
 * задачи одним атомарным UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED).
 * Слой тонкий и изолированный — при деплое легко заменить на pg-boss, не трогая
 * вызовов (см. docs/TRENDTRAFFIC.md §5: «очередь pg-boss на Postgres»).
 */

import { randomUUID } from 'crypto';
import pool from '../../db/index.js';
import type { GpuTarget, RenderJob, RenderStatus, RenderStep } from './types.js';

const COLS = `id, tenant_id, flow_id, flow_name, status, gpu_target, input_url, steps,
  step_index, progress, result_url, result_asset_id, note, error, attempts, created_at, updated_at`;

function parseSteps(v: any): RenderStep[] {
  if (Array.isArray(v)) return v as RenderStep[];
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

export function mapRow(r: any): RenderJob {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    flowId: r.flow_id || null,
    flowName: r.flow_name || null,
    status: (r.status || 'queued') as RenderStatus,
    gpuTarget: (r.gpu_target || 'home') as GpuTarget,
    inputUrl: r.input_url || null,
    steps: parseSteps(r.steps),
    stepIndex: Number(r.step_index ?? 0),
    progress: Number(r.progress ?? 0),
    resultUrl: r.result_url || null,
    resultAssetId: r.result_asset_id || null,
    note: r.note || null,
    error: r.error || null,
    attempts: Number(r.attempts ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface InsertJobInput {
  tenantId: string;
  flowId: string | null;
  flowName: string | null;
  gpuTarget: GpuTarget;
  inputUrl: string | null;
  steps: RenderStep[];
}

/** Ставит задачу в очередь (status='queued'). */
export async function insertJob(input: InsertJobInput): Promise<RenderJob> {
  const r = await pool.query(
    `INSERT INTO render_jobs (id, tenant_id, flow_id, flow_name, status, gpu_target, input_url, steps, progress)
     VALUES ($1,$2,$3,$4,'queued',$5,$6,$7::jsonb,0)
     RETURNING ${COLS}`,
    [randomUUID(), input.tenantId, input.flowId, input.flowName, input.gpuTarget, input.inputUrl, JSON.stringify(input.steps)]
  );
  return mapRow(r.rows[0]);
}

export async function getJob(tenantId: string, id: string): Promise<RenderJob | null> {
  try {
    const r = await pool.query(`SELECT ${COLS} FROM render_jobs WHERE tenant_id = $1 AND id = $2 LIMIT 1`, [tenantId, id]);
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  } catch { return null; }
}

export async function listJobs(tenantId: string, limit = 50): Promise<RenderJob[]> {
  const lim = Math.min(Math.max(limit, 1), 200);
  try {
    const r = await pool.query(
      `SELECT ${COLS} FROM render_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, lim]
    );
    return (r.rows as any[]).map(mapRow);
  } catch { return []; }
}

/**
 * Атомарно забирает самую старую 'queued' задачу и помечает 'running'.
 * SKIP LOCKED → несколько воркеров не возьмут одну задачу. Возвращает null, если очередь пуста.
 */
export async function claimNextJob(): Promise<RenderJob | null> {
  try {
    const r = await pool.query(
      `UPDATE render_jobs SET status='running', locked_at=now(), attempts=attempts+1, updated_at=now()
       WHERE id = (
         SELECT id FROM render_jobs WHERE status='queued'
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING ${COLS}`
    );
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  } catch (e) {
    // FOR UPDATE/SKIP LOCKED недоступны в fallback-режиме — там очереди нет.
    console.warn('[render] claimNextJob:', (e as Error).message);
    return null;
  }
}

/** Сохраняет прогресс/шаги по ходу исполнения. */
export async function saveProgress(id: string, patch: { steps?: RenderStep[]; stepIndex?: number; progress?: number }): Promise<void> {
  try {
    await pool.query(
      `UPDATE render_jobs SET
         steps = COALESCE($2::jsonb, steps),
         step_index = COALESCE($3, step_index),
         progress = COALESCE($4, progress),
         updated_at = now()
       WHERE id = $1`,
      [id, patch.steps ? JSON.stringify(patch.steps) : null, patch.stepIndex ?? null, patch.progress ?? null]
    );
  } catch (e) {
    console.warn('[render] saveProgress:', (e as Error).message);
  }
}

/** Финализирует задачу (done|failed|canceled). */
export async function finishJob(
  id: string,
  patch: { status: RenderStatus; steps?: RenderStep[]; progress?: number; resultUrl?: string | null; resultAssetId?: string | null; note?: string | null; error?: string | null }
): Promise<void> {
  try {
    await pool.query(
      `UPDATE render_jobs SET
         status = $2,
         steps = COALESCE($3::jsonb, steps),
         progress = COALESCE($4, progress),
         result_url = $5,
         result_asset_id = $6,
         note = $7,
         error = $8,
         updated_at = now()
       WHERE id = $1`,
      [
        id, patch.status, patch.steps ? JSON.stringify(patch.steps) : null,
        patch.progress ?? null, patch.resultUrl ?? null, patch.resultAssetId ?? null,
        patch.note ?? null, patch.error ?? null,
      ]
    );
  } catch (e) {
    console.warn('[render] finishJob:', (e as Error).message);
  }
}
