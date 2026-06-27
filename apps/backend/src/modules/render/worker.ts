/**
 * TrendTraffic — воркер-диспетчер рендера.
 *
 * Лёгкий поллер: каждые N мс забирает одну 'queued' задачу из очереди (атомарный
 * claim в store), прогоняет её шаги через StepExecutor, обновляет прогресс и
 * финализирует. Single-flight: одновременно обрабатывается одна задача на процесс
 * (для масштабирования — несколько процессов/воркеров, claim защищён SKIP LOCKED).
 *
 * Реальная обработка появится с подключением OpenMontage-воркера через
 * setRenderExecutor(); сейчас по умолчанию SimulationExecutor (скелет).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { claimNextJob, saveProgress, finishJob } from './store.js';
import { SimulationExecutor, type StepExecutor } from './executor.js';
import { createAsset } from '../media/assets.js';
import type { RenderJob } from './types.js';

const __dirname_w = path.dirname(fileURLToPath(import.meta.url));
const RENDERS_DIR_W = path.resolve(__dirname_w, '../../../../uploads/renders');

/** Регистрирует готовый ролик в Галерею (вкладка «Референс», media_assets). */
async function registerRenderInGallery(job: RenderJob, url: string): Promise<string | null> {
  try {
    const abs = path.join(RENDERS_DIR_W, path.basename(url));
    let size: number | undefined;
    try { size = fs.statSync(abs).size; } catch { /* в симуляции файла нет */ }
    const asset = await createAsset(job.tenantId, {
      kind: 'reference',
      mediaType: 'video',
      originalName: `${job.flowName || 'Рендер'} (готовый ролик)`,
      fileUrl: url,
      filePath: abs,
      mime: 'video/mp4',
      size,
    });
    return asset?.id || null;
  } catch (e) {
    console.warn('[render] регистрация в Галерею не удалась:', (e as Error).message);
    return null;
  }
}

let timer: NodeJS.Timeout | null = null;
let busy = false;
let executor: StepExecutor = new SimulationExecutor();

/** Подменить исполнителя шагов (реальный OpenMontage-воркер вместо симуляции). */
export function setRenderExecutor(e: StepExecutor): void {
  executor = e;
}

/** Запускает поллер очереди (идемпотентно). */
export function startRenderWorker(opts?: { intervalMs?: number }): void {
  if (timer) return;
  const interval = opts?.intervalMs ?? 3000;
  timer = setInterval(() => { void tick(); }, interval);
  if (typeof timer.unref === 'function') timer.unref(); // не держим event loop
  console.log(`[render] воркер запущен (интервал ${interval}ms, executor=${executor.constructor.name})`);
}

export function stopRenderWorker(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

async function tick(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const job = await claimNextJob();
    if (job) await processJob(job);
  } catch (e) {
    console.warn('[render] tick:', (e as Error).message);
  } finally {
    busy = false;
  }
}

async function processJob(job: RenderJob): Promise<void> {
  const steps = job.steps.slice();
  let currentUrl = job.inputUrl;
  // Один «блокнот» на задачу: ИИ-режиссёр (research/news) пишет, озвучка читает.
  const scratchpad: Record<string, any> = {};
  const ctxBase = { jobId: job.id, tenantId: job.tenantId, gpuTarget: job.gpuTarget, scratchpad };

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      step.status = 'running';
      await saveProgress(job.id, { steps, stepIndex: i, progress: Math.round((i / steps.length) * 100) });

      const res = await executor.execute(step, { ...ctxBase, currentUrl });
      if (res.skipped) {
        step.status = 'skipped';
        step.note = res.note;
      } else {
        step.status = 'done';
        step.note = res.note;
        if (res.outputUrl !== undefined) currentUrl = res.outputUrl;
      }
    }

    const skipped = steps.filter((s) => s.status === 'skipped').length;
    // Реальный произведённый ролик (под /uploads/renders/) → регистрируем в Галерею.
    let resultAssetId: string | null = null;
    if (currentUrl && currentUrl.includes('/uploads/renders/')) {
      resultAssetId = await registerRenderInGallery(job, currentUrl);
    }
    const note = resultAssetId
      ? `Готово: ${steps.length} шаг(ов)` + (skipped ? `, пропущено ${skipped}` : '') + '. Ролик добавлен в Галерею.'
      : `Спланировано ${steps.length} шаг(ов)` + (skipped ? `, пропущено ${skipped}` : '')
        + '. Готового файла нет (нет входного видео или CPU-воркер не настроен).';
    await finishJob(job.id, { status: 'done', steps, progress: 100, resultUrl: currentUrl, resultAssetId, note });
    console.log(`[render] задача ${job.id} готова (${steps.length} шагов, asset=${resultAssetId || '—'})`);
  } catch (e) {
    await finishJob(job.id, { status: 'failed', steps, error: (e as Error).message });
    console.warn(`[render] задача ${job.id} упала:`, (e as Error).message);
  }
}
