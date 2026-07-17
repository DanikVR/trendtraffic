/**
 * СТОРИБОРД — сервис: CRUD (PostgreSQL) + оркестрация конвейера.
 *
 * Долгие операции (анализ/план/рендер/сборка) выполняются ФОНОМ в процессе:
 * ход пишется в БД (статусы документа/кусков), «занятость» — in-memory реестр
 * (busy) с защитой от двойного запуска. Фронт поллит GET /:id.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import pool from '../../db/index.js';
import { analyzeVideoVisual } from '../trends/video_insight.js';
import { createAsset } from '../media/assets.js';
import {
  sbDir, toUploadsUrl, fromUploadsUrl, normalizeSource, probeDuration,
  renderChunkProgram, assembleFinal, buildChunkPng,
} from './ffmpeg.js';
import { buildPlan, sanitizePanels, templatePanels } from './planner.js';
import type { StoryboardDoc, SbPlan, SbSettings, SbChunk, SbTranscriptSeg } from './types.js';

export const STORYBOARD_FOLDER = 'storyboard';

// ── busy-реестр (одна долгая операция на проект) ──────────────────────────────
const busy = new Map<string, { stage: string; chunk?: number; startedAt: number }>();
export function getBusy(id: string) { return busy.get(id) || null; }
function setBusy(id: string, stage: string, chunk?: number): boolean {
  if (busy.has(id)) return false;
  busy.set(id, { stage, chunk, startedAt: Date.now() });
  return true;
}
function clearBusy(id: string) { busy.delete(id); }

// ── mapping ───────────────────────────────────────────────────────────────────
function mapRow(r: any): StoryboardDoc {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    sourceAssetId: r.source_asset_id,
    sourceUrl: r.source_url,
    sourceDuration: r.source_duration != null ? Number(r.source_duration) : null,
    plan: (r.plan && typeof r.plan === 'object') ? r.plan : {},
    settings: (r.settings && typeof r.settings === 'object') ? r.settings : {},
    resultAssetId: r.result_asset_id,
    resultUrl: r.result_url,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    busy: getBusy(r.id),
  } as StoryboardDoc;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function listStoryboards(tenantId: string): Promise<any[]> {
  const r = await pool.query(
    `SELECT id, name, status, source_url, result_url, error, created_at, updated_at,
            plan#>>'{chunks,0,pngUrl}' AS cover,
            jsonb_array_length(COALESCE(plan->'chunks','[]'::jsonb)) AS chunks_count
     FROM storyboards WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [tenantId]
  );
  return r.rows.map((x: any) => ({
    id: x.id, name: x.name, status: x.status,
    sourceUrl: x.source_url, resultUrl: x.result_url, error: x.error,
    cover: x.cover || null, chunksCount: Number(x.chunks_count) || 0,
    createdAt: x.created_at, updatedAt: x.updated_at,
    busy: getBusy(x.id),
  }));
}

export async function createStoryboard(
  tenantId: string, a: { name?: string; sourceUrl: string; sourceAssetId?: string }
): Promise<StoryboardDoc> {
  const id = randomUUID();
  const r = await pool.query(
    `INSERT INTO storyboards (id, tenant_id, name, status, source_asset_id, source_url, plan, settings)
     VALUES ($1,$2,$3,'draft',$4,$5,'{}','{}') RETURNING *`,
    [id, tenantId, (a.name || 'Сториборд').slice(0, 200), a.sourceAssetId || null, a.sourceUrl]
  );
  return mapRow(r.rows[0]);
}

export async function getStoryboard(tenantId: string, id: string): Promise<StoryboardDoc | null> {
  const r = await pool.query(`SELECT * FROM storyboards WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

async function patch(tenantId: string, id: string, fields: Record<string, any>): Promise<void> {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  await pool.query(
    `UPDATE storyboards SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id, ...keys.map((k) => fields[k])]
  );
}

/** Лёгкая структурная чистка плана с фронта (панели — через sanitizePanels). */
function sanitizePlan(raw: any): SbPlan {
  const plan: SbPlan = { transcript: [], chunks: [] };
  if (Array.isArray(raw?.transcript)) {
    plan.transcript = raw.transcript
      .map((s: any): SbTranscriptSeg => ({
        start: Math.max(0, Number(s?.start) || 0),
        end: Math.max(0, Number(s?.end) || 0),
        text: String(s?.text || '').slice(0, 300),
      }))
      .filter((s: SbTranscriptSeg) => s.text && s.end > s.start)
      .slice(0, 500);
  }
  if (Array.isArray(raw?.beats)) plan.beats = raw.beats.slice(0, 40);
  if (Array.isArray(raw?.textOverlays)) plan.textOverlays = raw.textOverlays.map((s: any) => String(s).slice(0, 160)).slice(0, 30);
  if (raw?.planSource === 'claude' || raw?.planSource === 'template') plan.planSource = raw.planSource;
  if (typeof raw?.planNote === 'string') plan.planNote = raw.planNote.slice(0, 300);
  const chunksRaw = Array.isArray(raw?.chunks) ? raw.chunks : [];
  plan.chunks = chunksRaw
    .map((c: any, i: number): SbChunk => {
      const start = Math.max(0, Number(c?.start) || 0);
      const end = Math.max(start + 0.4, Number(c?.end) || start + 0.4);
      const chunk: SbChunk = {
        idx: i, start, end,
        enabled: c?.enabled !== false,
        status: ['draft', 'rendering', 'done', 'failed'].includes(c?.status) ? c.status : 'draft',
        panels: [],
        pngUrl: typeof c?.pngUrl === 'string' ? c.pngUrl : undefined,
        renderUrl: typeof c?.renderUrl === 'string' ? c.renderUrl : undefined,
        error: typeof c?.error === 'string' ? c.error.slice(0, 300) : undefined,
      };
      chunk.panels = sanitizePanels(Array.isArray(c?.panels) ? c.panels : [], chunk);
      if (!chunk.panels.length) chunk.panels = templatePanels(chunk, plan.transcript, false);
      return chunk;
    })
    .slice(0, 40);
  return plan;
}

export async function updateStoryboard(
  tenantId: string, id: string, a: { name?: string; plan?: any; settings?: any }
): Promise<StoryboardDoc | null> {
  const fields: Record<string, any> = {};
  if (typeof a.name === 'string' && a.name.trim()) fields.name = a.name.trim().slice(0, 200);
  if (a.plan && typeof a.plan === 'object') fields.plan = JSON.stringify(sanitizePlan(a.plan));
  if (a.settings && typeof a.settings === 'object') {
    const s = a.settings;
    const settings: SbSettings = {
      style: typeof s.style === 'string' ? s.style.slice(0, 24) : undefined,
      engine: ['program', 'omni', 'flow'].includes(s.engine) ? s.engine : 'program',
      badgeText: typeof s.badgeText === 'string' ? s.badgeText.slice(0, 40) : undefined,
      subtitles: !!s.subtitles,
      ctaWord: typeof s.ctaWord === 'string' ? s.ctaWord.slice(0, 24) : undefined,
    };
    fields.settings = JSON.stringify(settings);
  }
  await patch(tenantId, id, fields);
  return getStoryboard(tenantId, id);
}

export async function deleteStoryboard(tenantId: string, id: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM storyboards WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
  if ((r.rowCount || 0) > 0) {
    try { fs.rmSync(sbDir(id), { recursive: true, force: true }); } catch { /* best-effort */ }
    return true;
  }
  return false;
}

// ── Конвейер ──────────────────────────────────────────────────────────────────
const workPath = (id: string) => path.join(sbDir(id), 'work.mp4');

/**
 * Шаг «Расшифровка»: нормализация → длительность → Gemini-разбор (речь+сцены,
 * мягкая деградация) → куски по фразам → панели (Claude|шаблон). Фоном.
 */
export function startAnalyze(tenantId: string, id: string, opts: { skipAi?: boolean } = {}): boolean {
  if (!setBusy(id, 'analyze')) return false;
  (async () => {
    try {
      const doc = await getStoryboard(tenantId, id);
      if (!doc) throw new Error('Проект не найден');
      const src = doc.sourceUrl ? fromUploadsUrl(doc.sourceUrl) : null;
      if (!src || !fs.existsSync(src)) throw new Error('Исходное видео не найдено — выберите его из Галереи заново.');
      await patch(tenantId, id, { status: 'analyzing', error: null });

      const work = workPath(id);
      await normalizeSource(src, work);
      const duration = (await probeDuration(work)) || (await probeDuration(src));
      if (!duration || duration < 1) throw new Error('Не удалось определить длительность видео.');
      if (duration > 180) throw new Error('Видео длиннее 3 минут — обрежьте его в Галерее (оптимум 15–60 секунд).');

      const insight = opts.skipAi ? null : await analyzeVideoVisual(tenantId, work);
      const settings = doc.settings || {};
      const plan = await buildPlan({
        tenantId,
        duration,
        transcript: insight?.transcript || [],
        beats: insight?.sceneBeats,
        textOverlays: insight?.textOverlays,
        style: settings.style,
        ctaWord: settings.ctaWord,
      });
      if (!insight) {
        plan.planNote = (plan.planNote || '')
          + (opts.skipAi ? '' : ' Расшифровка недоступна (нет ключа Gemini) — куски нарезаны ровными отрезками.');
      }
      await patch(tenantId, id, {
        status: 'planned',
        source_duration: duration,
        plan: JSON.stringify(plan),
        error: null,
      });
    } catch (e: any) {
      console.warn('[storyboard] analyze failed:', e?.message || e);
      await patch(tenantId, id, { status: 'failed', error: String(e?.message || e).slice(0, 400) }).catch(() => {});
    } finally {
      clearBusy(id);
    }
  })();
  return true;
}

/** Пере-план панелей (Claude|шаблон) по текущим кускам/расшифровке. Фоном. */
export function startPlan(tenantId: string, id: string): boolean {
  if (!setBusy(id, 'plan')) return false;
  (async () => {
    try {
      const doc = await getStoryboard(tenantId, id);
      if (!doc || !doc.sourceDuration) throw new Error('Сначала выполните расшифровку.');
      const plan = await buildPlan({
        tenantId,
        duration: doc.sourceDuration,
        transcript: doc.plan?.transcript || [],
        beats: doc.plan?.beats,
        textOverlays: doc.plan?.textOverlays,
        style: doc.settings?.style,
        ctaWord: doc.settings?.ctaWord,
      });
      // не терять готовые рендеры кусков, если границы не менялись
      const old = doc.plan?.chunks || [];
      for (const c of plan.chunks) {
        const prev = old.find((o) => Math.abs(o.start - c.start) < 0.05 && Math.abs(o.end - c.end) < 0.05);
        if (prev) { c.pngUrl = prev.pngUrl; c.renderUrl = prev.renderUrl; c.status = prev.status; c.enabled = prev.enabled; }
      }
      await patch(tenantId, id, { status: 'planned', plan: JSON.stringify(plan), error: null });
    } catch (e: any) {
      await patch(tenantId, id, { error: String(e?.message || e).slice(0, 400) }).catch(() => {});
    } finally {
      clearBusy(id);
    }
  })();
  return true;
}

/** PNG-сториборд куска (синхронно, быстро). Возвращает обновлённый документ. */
export async function makeChunkPng(tenantId: string, id: string, chunkIdx: number): Promise<StoryboardDoc> {
  const doc = await getStoryboard(tenantId, id);
  if (!doc) throw new Error('Проект не найден');
  const chunk = doc.plan?.chunks?.find((c) => c.idx === chunkIdx);
  if (!chunk) throw new Error('Кусок не найден');
  const work = workPath(id);
  if (!fs.existsSync(work)) throw new Error('Сначала выполните расшифровку (шаг 2).');
  const png = await buildChunkPng(work, chunk, sbDir(id));
  chunk.pngUrl = toUploadsUrl(png);
  await patch(tenantId, id, { plan: JSON.stringify(doc.plan) });
  return (await getStoryboard(tenantId, id))!;
}

/** Рендер одного куска программным движком. Фоном. */
export function startRenderChunk(tenantId: string, id: string, chunkIdx: number): boolean {
  if (!setBusy(id, 'render', chunkIdx)) return false;
  (async () => {
    try {
      const doc = await getStoryboard(tenantId, id);
      if (!doc) throw new Error('Проект не найден');
      const plan = doc.plan;
      const chunk = plan?.chunks?.find((c) => c.idx === chunkIdx);
      if (!chunk) throw new Error('Кусок не найден');
      const work = workPath(id);
      if (!fs.existsSync(work)) throw new Error('Сначала выполните расшифровку (шаг 2).');

      chunk.status = 'rendering'; chunk.error = undefined;
      await patch(tenantId, id, { status: 'rendering', plan: JSON.stringify(plan) });

      const isLast = chunk.idx === (plan.chunks.length - 1);
      const out = await renderChunkProgram(work, chunk, sbDir(id), { style: doc.settings?.style, isLastChunk: isLast });
      chunk.renderUrl = toUploadsUrl(out);
      chunk.status = 'done';
      await patch(tenantId, id, { status: 'planned', plan: JSON.stringify(plan), error: null });
    } catch (e: any) {
      console.warn('[storyboard] render chunk failed:', e?.message || e);
      const doc2 = await getStoryboard(tenantId, id).catch(() => null);
      const c2 = doc2?.plan?.chunks?.find((c) => c.idx === chunkIdx);
      if (doc2 && c2) {
        c2.status = 'failed'; c2.error = String(e?.message || e).slice(0, 300);
        await patch(tenantId, id, { status: 'planned', plan: JSON.stringify(doc2.plan) }).catch(() => {});
      }
    } finally {
      clearBusy(id);
    }
  })();
  return true;
}

/** Финальная сборка: включённые куски со статусом done → ролик в Галерею. Фоном. */
export function startAssemble(tenantId: string, id: string): boolean {
  if (!setBusy(id, 'assemble')) return false;
  (async () => {
    try {
      const doc = await getStoryboard(tenantId, id);
      if (!doc) throw new Error('Проект не найден');
      const chunks = (doc.plan?.chunks || []).filter((c) => c.enabled && c.status === 'done' && c.renderUrl);
      if (!chunks.length) throw new Error('Нет готовых кусков — сначала сгенерируйте их на шаге 4.');
      const files: string[] = [];
      for (const c of chunks) {
        const abs = fromUploadsUrl(c.renderUrl!);
        if (!abs || !fs.existsSync(abs)) throw new Error(`Файл куска #${c.idx + 1} пропал — перегенерируйте его.`);
        files.push(abs);
      }
      await patch(tenantId, id, { status: 'rendering', error: null });

      // Субтитры: перетаймовка сегментов в таймлайн склейки (куски могли идти не подряд)
      let subs: SbTranscriptSeg[] | undefined;
      if (doc.settings?.subtitles && doc.plan?.transcript?.length) {
        subs = [];
        let off = 0;
        for (const c of chunks) {
          for (const s of doc.plan.transcript) {
            const st = Math.max(s.start, c.start), en = Math.min(s.end, c.end);
            if (en - st > 0.2) subs.push({ start: off + (st - c.start), end: off + (en - c.start), text: s.text });
          }
          off += c.end - c.start;
        }
      }

      const outName = `storyboard-${id.slice(0, 8)}-${Date.now()}.mp4`;
      const outPath = path.join(sbDir(id), outName);
      await assembleFinal(files, outPath, sbDir(id), {
        badgeText: doc.settings?.badgeText,
        subtitles: subs,
      });
      const stat = fs.statSync(outPath);
      if (stat.size < 10_000) throw new Error('Итоговый файл пустой.');

      const fileUrl = toUploadsUrl(outPath);
      const asset = await createAsset(tenantId, {
        kind: 'reference', mediaType: 'video',
        originalName: `${doc.name}.mp4`,
        fileUrl, filePath: outPath, mime: 'video/mp4', size: stat.size,
        folder: STORYBOARD_FOLDER, ugcFormat: '9:16',
      });
      await patch(tenantId, id, {
        status: 'done', result_url: fileUrl, result_asset_id: asset?.id || null, error: null,
      });
    } catch (e: any) {
      console.warn('[storyboard] assemble failed:', e?.message || e);
      await patch(tenantId, id, { status: 'planned', error: String(e?.message || e).slice(0, 400) }).catch(() => {});
    } finally {
      clearBusy(id);
    }
  })();
  return true;
}
