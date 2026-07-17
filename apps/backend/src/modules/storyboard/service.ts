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
  renderChunkProgram, assembleFinal, buildChunkPng, extractPanelFrame, buildFilmstrip,
  cutChunkExact, fitClipToChunk, muxChunkAudio,
} from './ffmpeg.js';
import { renderChunkOmni, buildChunkPrompt } from './omni.js';
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
            COALESCE(plan#>>'{chunks,0,pngUrl}', plan#>>'{chunks,0,panels,0,frameUrl}') AS cover,
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
        stripUrl: typeof c?.stripUrl === 'string' && c.stripUrl.startsWith('/uploads/') ? c.stripUrl : undefined,
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
      autoAssemble: s.autoAssemble !== false,
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
 * Превью для студии: филмстрип на кусок + jpg-кадр на каждую видео-панель.
 * Имена детерминированы от таймингов → повторный вызов с теми же границами
 * переиспользует файлы (и браузерный кэш), смена времени даёт новый URL.
 * Best-effort: сбой одного кадра не валит конвейер.
 */
async function generatePreviews(id: string, plan: SbPlan): Promise<void> {
  const work = workPath(id);
  if (!fs.existsSync(work)) return;
  const dir = sbDir(id);
  const key = (n: number) => String(Math.round(n * 10));
  for (const chunk of plan.chunks || []) {
    try {
      const strip = path.join(dir, `strip-${chunk.idx}-${key(chunk.start)}-${key(chunk.end)}.jpg`);
      if (!fs.existsSync(strip)) await buildFilmstrip(work, chunk, strip);
      chunk.stripUrl = toUploadsUrl(strip);
    } catch (e) { console.warn('[storyboard] филмстрип не собрался:', (e as Error).message); }
    for (const p of chunk.panels || []) {
      if (p.imageUrl) { p.frameUrl = undefined; continue; } // картинка панели показывается сама
      try {
        const ts = p.frameTs != null ? p.frameTs : chunk.start + (p.start + p.end) / 2;
        p.frameTs = Math.round(ts * 100) / 100;
        const f = path.join(dir, `pf-${key(ts)}.jpg`);
        if (!fs.existsSync(f)) await extractPanelFrame(work, ts, f);
        p.frameUrl = toUploadsUrl(f);
      } catch { /* панель останется без превью */ }
    }
  }
}

/** Ленивый бэкфилл превью для проектов, созданных ДО этой фичи (по открытию). */
const backfilling = new Set<string>();
export function maybeBackfillPreviews(tenantId: string, id: string, doc: StoryboardDoc): void {
  if (backfilling.has(id) || busy.has(id)) return;
  const chunks = doc.plan?.chunks || [];
  if (!chunks.length || chunks.every((c) => c.stripUrl)) return;
  if (!fs.existsSync(workPath(id))) return;
  backfilling.add(id);
  (async () => {
    try {
      const d = await getStoryboard(tenantId, id);
      if (!d?.plan?.chunks?.length) return;
      await generatePreviews(id, d.plan);
      await patch(tenantId, id, { plan: JSON.stringify(d.plan) });
    } catch (e) {
      console.warn('[storyboard] бэкфилл превью:', (e as Error).message);
    } finally {
      backfilling.delete(id);
    }
  })();
}

/** Сменить кадр панели (клик по филмстрипу): frameTs → новый jpg → сохранение. */
export async function setPanelFrame(
  tenantId: string, id: string, chunkIdx: number, panelIdx: number, ts: number
): Promise<StoryboardDoc> {
  const doc = await getStoryboard(tenantId, id);
  if (!doc) throw new Error('Проект не найден');
  const chunk = doc.plan?.chunks?.find((c) => c.idx === chunkIdx);
  const panel = chunk?.panels?.[panelIdx];
  if (!chunk || !panel) throw new Error('Панель не найдена');
  const work = workPath(id);
  if (!fs.existsSync(work)) throw new Error('Сначала выполните расшифровку (шаг 2).');
  const clamped = Math.max(chunk.start, Math.min(chunk.end - 0.05, ts));
  panel.frameTs = Math.round(clamped * 100) / 100;
  const f = path.join(sbDir(id), `pf-${String(Math.round(clamped * 10))}.jpg`);
  if (!fs.existsSync(f)) await extractPanelFrame(work, clamped, f);
  panel.frameUrl = toUploadsUrl(f);
  await patch(tenantId, id, { plan: JSON.stringify(doc.plan) });
  return (await getStoryboard(tenantId, id))!;
}

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
      await generatePreviews(id, plan);
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
      await generatePreviews(id, plan);
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
      const engine = doc.settings?.engine || 'program';
      if (engine === 'flow') {
        throw new Error('Движок Flow — полуавтомат: скачайте материалы куска и прикрепите готовый клип кнопками на карточке.');
      }
      const out = engine === 'omni'
        ? await renderChunkOmni(tenantId, work, chunk, sbDir(id), { style: doc.settings?.style, ctaWord: doc.settings?.ctaWord })
        : await renderChunkProgram(work, chunk, sbDir(id), { style: doc.settings?.style, isLastChunk: isLast });
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

/**
 * Движок Flow, шаг 1 (полуавтомат): подготовить материалы куска — вырезанный
 * mp4 (со звуком), PNG-сториборд и посекундный промпт. Файлы — статикой из uploads.
 */
export async function prepareFlowChunk(
  tenantId: string, id: string, chunkIdx: number
): Promise<{ chunkUrl: string; pngUrl: string | null; prompt: string }> {
  const doc = await getStoryboard(tenantId, id);
  if (!doc) throw new Error('Проект не найден');
  const chunk = doc.plan?.chunks?.find((c) => c.idx === chunkIdx);
  if (!chunk) throw new Error('Кусок не найден');
  const work = workPath(id);
  if (!fs.existsSync(work)) throw new Error('Сначала выполните расшифровку (шаг 2).');

  const dir = sbDir(id);
  const key = (n: number) => String(Math.round(n * 10));
  const src = path.join(dir, `flowsrc-${chunk.idx}-${key(chunk.start)}-${key(chunk.end)}.mp4`);
  if (!fs.existsSync(src)) await cutChunkExact(work, chunk, src);

  if (!chunk.pngUrl) {
    try {
      const png = await buildChunkPng(work, chunk, dir);
      chunk.pngUrl = toUploadsUrl(png);
      await patch(tenantId, id, { plan: JSON.stringify(doc.plan) });
    } catch { /* PNG опционален для Flow */ }
  }
  return {
    chunkUrl: toUploadsUrl(src),
    pngUrl: chunk.pngUrl || null,
    prompt: buildChunkPrompt(chunk, doc.settings?.style, doc.settings?.ctaWord),
  };
}

/**
 * Движок Flow, шаг 2: прикрепить готовый клип (из Галереи, папка Google Flow) как
 * рендер куска — формат 1080×1920@30, длина куска, поверх ОРИГИНАЛЬНЫЙ звук.
 */
export async function attachRenderChunk(
  tenantId: string, id: string, chunkIdx: number, fileUrl: string
): Promise<StoryboardDoc> {
  if (!setBusy(id, 'attach', chunkIdx)) throw new Error('Уже идёт операция — дождитесь завершения.');
  try {
    const doc = await getStoryboard(tenantId, id);
    if (!doc) throw new Error('Проект не найден');
    const chunk = doc.plan?.chunks?.find((c) => c.idx === chunkIdx);
    if (!chunk) throw new Error('Кусок не найден');
    const abs = fromUploadsUrl(fileUrl);
    if (!abs || !fs.existsSync(abs)) throw new Error('Файл не найден — выберите клип из Галереи.');
    const work = workPath(id);
    if (!fs.existsSync(work)) throw new Error('Сначала выполните расшифровку (шаг 2).');

    const dir = sbDir(id);
    const D = Math.max(0.5, chunk.end - chunk.start);
    const fitted = path.join(dir, `attach-fit-${chunk.idx}-${randomUUID().slice(0, 8)}.mp4`);
    const outPath = path.join(dir, `chunk-${chunk.idx}.mp4`);
    try {
      await fitClipToChunk(abs, D, fitted);
      await muxChunkAudio(fitted, work, chunk, outPath, dir);
    } finally {
      try { fs.unlinkSync(fitted); } catch { /* best-effort */ }
    }
    chunk.renderUrl = toUploadsUrl(outPath);
    chunk.status = 'done';
    chunk.error = undefined;
    await patch(tenantId, id, { status: 'planned', plan: JSON.stringify(doc.plan), error: null });
    return (await getStoryboard(tenantId, id))!;
  } finally {
    clearBusy(id);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FLOW-АВТОМАТ: куски → очередь flow_ext_tasks → расширение генерит в Google Flow
// → вотчер прикрепляет результаты → (опц.) автосборка готового ролика.
// Переиспользуем ГОТОВУЮ инфраструктуру flow-ext (enqueue/tasks/ingest в расширении):
// связка со сторибордом — settings JSONB задачи {storyboardId, chunkIdx}.
// ════════════════════════════════════════════════════════════════════════════

export interface FlowQueueEntry { taskId: string; status: string; note?: string | null }

/** Активные/последние задачи Flow этого сториборда: {chunkIdx → задача}. */
export async function getFlowQueueMap(tenantId: string, storyboardId: string): Promise<Record<number, FlowQueueEntry>> {
  try {
    const r = await pool.query(
      `SELECT id, status, note, settings FROM flow_ext_tasks
        WHERE tenant_id = $1 AND settings->>'storyboardId' = $2
        ORDER BY created_at ASC`,
      [tenantId, storyboardId]
    );
    const map: Record<number, FlowQueueEntry> = {};
    for (const row of r.rows as any[]) {
      const idx = Number(row.settings?.chunkIdx);
      if (!Number.isInteger(idx)) continue;
      map[idx] = { taskId: row.id, status: row.status, note: row.note }; // последняя по времени побеждает
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Поставить куски в очередь Flow-автомата. Материалы (mp4+PNG+промпт) готовятся
 * здесь же; references — АБСОЛЮТНЫЕ URL (расширение качает байты из background).
 * Куски уже ≤8с — лимит генерации Flow; большой ролик = много задач по очереди.
 */
export async function queueFlowChunks(
  tenantId: string, id: string, chunkIdxs: number[], baseUrl: string
): Promise<{ queued: number; skipped: number }> {
  const doc = await getStoryboard(tenantId, id);
  if (!doc) throw new Error('Проект не найден');
  const existing = await getFlowQueueMap(tenantId, id);
  const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : baseUrl.replace(/\/+$/, '') + u);

  let queued = 0, skipped = 0;
  for (const idx of chunkIdxs) {
    const chunk = doc.plan?.chunks?.find((c) => c.idx === idx);
    if (!chunk || !chunk.enabled) { skipped++; continue; }
    const cur = existing[idx];
    if (cur && (cur.status === 'queued' || cur.status === 'running')) { skipped++; continue; }

    const mats = await prepareFlowChunk(tenantId, id, idx);
    const prompt = mats.prompt
      + '\nФормат 9:16, 1080p. Первый референс — видео-кусок: сохрани его речь, лицо и движение спикера, '
      + 'смонтируй по режиссуре выше. Второй референс — сториборд-план кадров.';
    const refs = [abs(mats.chunkUrl), ...(mats.pngUrl ? [abs(mats.pngUrl)] : [])];
    await pool.query(
      `INSERT INTO flow_ext_tasks (id, tenant_id, flow_id, prompt, refs, settings, title)
       VALUES ($1,$2,NULL,$3,$4,$5,$6)`,
      [randomUUID(), tenantId, prompt, JSON.stringify(refs),
        JSON.stringify({ storyboardId: id, chunkIdx: idx, aspect: '9:16', source: 'storyboard' }),
        `Сториборд «${doc.name}» — кусок ${idx + 1}`.slice(0, 200)]
    );
    queued++;
  }
  return { queued, skipped };
}

/** Прикрепить результат задачи Flow к куску (fit + оригинальный голос) — ядро вотчера. */
async function attachFlowTask(tenantId: string, sbId: string, chunkIdx: number, fileUrl: string): Promise<void> {
  await attachRenderChunk(tenantId, sbId, chunkIdx, fileUrl);
}

let flowWatcherStarted = false;
/**
 * Вотчер Flow-автомата (тик 15с): done-задачи сториборда → прикрепить клип к куску;
 * failed → пометить кусок; когда ВСЕ включённые куски готовы и в настройках
 * autoAssemble — запустить финальную сборку. Обработанные задачи помечаются
 * settings.handled, чтобы не трогать их повторно.
 */
export function startStoryboardFlowWatcher(): void {
  if (flowWatcherStarted) return;
  flowWatcherStarted = true;
  const tick = async () => {
    try {
      const r = await pool.query(
        `SELECT id, tenant_id, status, note, file_url, settings FROM flow_ext_tasks
          WHERE settings->>'storyboardId' IS NOT NULL
            AND settings->>'handled' IS NULL
            AND status IN ('done','failed')
          ORDER BY updated_at ASC
          LIMIT 10`
      );
      for (const row of r.rows as any[]) {
        const sbId = String(row.settings?.storyboardId || '');
        const chunkIdx = Number(row.settings?.chunkIdx);
        const tenantId = String(row.tenant_id);
        if (!sbId || !Number.isInteger(chunkIdx)) continue;
        try {
          if (row.status === 'done' && row.file_url) {
            await attachFlowTask(tenantId, sbId, chunkIdx, String(row.file_url));
          } else {
            const doc = await getStoryboard(tenantId, sbId);
            const chunk = doc?.plan?.chunks?.find((c) => c.idx === chunkIdx);
            if (doc && chunk) {
              chunk.status = 'failed';
              chunk.error = `Flow: ${String(row.note || 'генерация не удалась').slice(0, 260)}`;
              await patch(tenantId, sbId, { plan: JSON.stringify(doc.plan) });
            }
          }
          await pool.query(
            `UPDATE flow_ext_tasks SET settings = settings || '{"handled":true}'::jsonb, updated_at = now() WHERE id = $1`,
            [row.id]
          );
          // Автосборка большого ролика: все включённые куски готовы → собрать без участия юзера.
          if (row.status === 'done') {
            const doc = await getStoryboard(tenantId, sbId);
            const auto = (doc?.settings as any)?.autoAssemble !== false;
            const enabled = (doc?.plan?.chunks || []).filter((c) => c.enabled);
            if (doc && auto && enabled.length && enabled.every((c) => c.status === 'done') && doc.status !== 'done' && !getBusy(sbId)) {
              startAssemble(tenantId, sbId);
            }
          }
        } catch (e: any) {
          // busy («Уже идёт операция») и прочее — не помечаем handled, вернёмся следующим тиком
          const msg = String(e?.message || e);
          if (!/Уже идёт операция/.test(msg)) {
            console.warn('[storyboard] flow-вотчер, задача', row.id, ':', msg);
            await pool.query(
              `UPDATE flow_ext_tasks SET settings = settings || '{"handled":true}'::jsonb, note=$2, updated_at = now() WHERE id = $1`,
              [row.id, `attach: ${msg}`.slice(0, 400)]
            ).catch(() => {});
          }
        }
      }
    } catch { /* тик best-effort */ }
  };
  setInterval(tick, 15_000);
  setTimeout(tick, 5_000);
  console.log('[storyboard] Flow-вотчер запущен (тик 15с)');
}
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
