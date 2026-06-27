/**
 * TrendTraffic — сервис рендера «Собрать».
 *
 * Высокоуровневый API: построить план из графа flow и поставить задачу в очередь.
 * Чтение задач — реэкспорт из store. Само исполнение — в worker.ts (+ executor.ts).
 */

import { getRenderGpuTarget } from '../../config/systemConfig.js';
import type { Flow } from '../flows/service.js';
import { planFromGraph } from './planner.js';
import { insertJob, getJob, listJobs } from './store.js';
import type { RenderJob } from './types.js';

export interface CreateRenderResult {
  job?: RenderJob;
  error?: string;
}

/**
 * Ставит рендер сценария в очередь. Планирует шаги из flow.graph и фиксирует
 * снимок переключателя GPU. Возвращает ошибку, если в графе нет шагов монтажа.
 */
export async function createRenderJob(
  tenantId: string,
  opts: { flow: Flow; inputUrl?: string | null }
): Promise<CreateRenderResult> {
  const steps = planFromGraph(opts.flow.graph);
  if (steps.length === 0) {
    return { error: 'В сценарии нет шагов монтажа. Добавьте узлы процессов и сохраните сценарий.' };
  }
  // Вход цепочки: явный inputUrl, иначе сохранённый источник из графа (центральный узел).
  const inputUrl = opts.inputUrl ?? opts.flow.graph?.source?.url ?? null;
  const job = await insertJob({
    tenantId,
    flowId: opts.flow.id,
    flowName: opts.flow.name,
    gpuTarget: getRenderGpuTarget(),
    inputUrl,
    steps,
  });
  return { job };
}

/** Одна задача рендера тенанта. */
export const getRenderJob = getJob;
/** Список задач рендера тенанта (новые сверху). */
export const listRenderJobs = listJobs;
