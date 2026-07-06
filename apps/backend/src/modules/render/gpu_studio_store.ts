/**
 * Персист джобов GPU-студии (gpu_studio_jobs).
 *
 * Зачем: деплой = pm2 restart по несколько раз в день; джоб, живший только в памяти
 * процесса, умирал вместе с ним — фронт получал 404 «генерация не найдена», а GPU-воркер
 * продолжал рендерить «в никуда» (потерянные 10–30 минут GPU). Теперь спека джоба и
 * прогресс КАЖДОГО шага (аудио → вырезка → воркер-джоб → скачанная голова) пишутся сюда,
 * и при старте бэкенда недоделанные джобы реанимируются с того же места.
 *
 * Fallback-режим БД: все функции глотают ошибки (журнал становится best-effort,
 * поведение деградирует до старого in-memory).
 */

import pool from '../../db/index.js';

/** Прогресс одного ведущего внутри джоба. */
export interface GpuStudioHostState {
  host: 'A' | 'B';
  name: string;
  /** Готовая аудио-дорожка (файл в uploads переживает рестарт — не пересобираем). */
  audioUrl?: string | null;
  /** job_id на GPU-воркере: записан ДО долгого опроса — после рестарта просто доопрашиваем. */
  workerJobId?: string | null;
  url?: string;
  alphaUrl?: string | null;
  assetId?: string | null;
  engine?: string | null;
  error?: string;
}

export interface GpuStudioState {
  studioUrl?: string | null; // clean plate (переиспользуется при реанимации — не жжём Gemini заново)
  hosts: GpuStudioHostState[];
}

export interface GpuStudioParams {
  spec: any;                              // podcast-спека (groupPhotoUrl, hostA/B, dialogue, faces, …)
  voiceSource: 'record' | 'elevenlabs';
  engine?: string | null;
}

export interface GpuStudioJobRow {
  id: string;
  tenantId: string;
  status: 'processing' | 'done' | 'failed';
  params: GpuStudioParams;
  state: GpuStudioState;
  error: string | null;
}

export async function insertGpuJob(id: string, tenantId: string, params: GpuStudioParams, state: GpuStudioState): Promise<void> {
  try {
    // заодно подметаем хвосты: финалы старше 48ч никому не нужны
    await pool.query(`DELETE FROM gpu_studio_jobs WHERE created_at < NOW() - INTERVAL '48 hours'`);
    await pool.query(
      `INSERT INTO gpu_studio_jobs (id, tenant_id, status, params, state)
       VALUES ($1, $2, 'processing', $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, tenantId, JSON.stringify(params), JSON.stringify(state)]
    );
  } catch (e: any) {
    console.warn('[gpu-studio] insertGpuJob:', e?.message || e);
  }
}

export async function updateGpuJob(id: string, patch: { status?: string; state?: GpuStudioState; error?: string | null }): Promise<void> {
  try {
    await pool.query(
      `UPDATE gpu_studio_jobs SET
         status = COALESCE($2, status),
         state = COALESCE($3, state),
         error = $4,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, patch.status ?? null, patch.state ? JSON.stringify(patch.state) : null, patch.error ?? null]
    );
  } catch (e: any) {
    console.warn('[gpu-studio] updateGpuJob:', e?.message || e);
  }
}

function mapRow(r: any): GpuStudioJobRow {
  const parse = (v: any, dflt: any) => {
    if (v == null) return dflt;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return dflt; }
  };
  return {
    id: r.id,
    tenantId: r.tenant_id,
    status: r.status,
    params: parse(r.params, { spec: {}, voiceSource: 'record' }),
    state: { hosts: [], ...parse(r.state, {}) },
    error: r.error || null,
  };
}

export async function getGpuJob(id: string): Promise<GpuStudioJobRow | null> {
  try {
    const r = await pool.query(`SELECT id, tenant_id, status, params, state, error FROM gpu_studio_jobs WHERE id = $1`, [id]);
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  } catch {
    return null;
  }
}

/** Недоделанные джобы для реанимации при старте (не старше 6ч — как TTL in-memory карты). */
export async function listProcessingGpuJobs(): Promise<GpuStudioJobRow[]> {
  try {
    const r = await pool.query(
      `SELECT id, tenant_id, status, params, state, error FROM gpu_studio_jobs
       WHERE status = 'processing' AND created_at > NOW() - INTERVAL '6 hours'
       ORDER BY created_at`
    );
    return (r.rows as any[]).map(mapRow);
  } catch {
    return [];
  }
}
