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
import type { PodcastSpec, RenderJob, RenderStep } from './types.js';

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
  // Главный промт (общий сценарий ролика) — прокидываем в каждый шаг, ИИ-режиссёр учтёт его в ЛЛМ-шагах.
  const brief = (opts.flow.graph?.brief || '').trim();
  if (brief) steps.forEach((s: any) => { s.params = { ...(s.params || {}), brief }; });
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

/** Минимальная валидация спецификации подкаста. */
function podcastReady(spec: PodcastSpec | null | undefined): string | null {
  if (!spec || typeof spec !== 'object') return 'Подкаст не настроен.';
  if (!spec.hostA?.photoUrl || !spec.hostB?.photoUrl) return 'Загрузите фото обоих ведущих.';
  if (spec.source === 'gen') {
    if (!Array.isArray(spec.dialogue) || spec.dialogue.filter((l) => l?.text?.trim()).length === 0)
      return 'Сгенерируйте или впишите диалог ведущих.';
  } else if (spec.source === 'diarize') {
    if (!spec.recordingUrl) return 'Загрузите запись подкаста для разбора на 2 голоса.';
  }
  return null;
}

/**
 * Ставит сборку подкаст-сцены (2 ведущих) в очередь. В отличие от обычного
 * рендера, не разворачивает граф в цепочку — собирает один шаг podcast_compose,
 * несущий всю спецификацию (фото, дорожки/диалог, картинки-вставки, раскладку).
 */
export async function createPodcastJob(
  tenantId: string,
  opts: { flow: Flow; spec?: PodcastSpec | null }
): Promise<CreateRenderResult> {
  const spec = (opts.spec || (opts.flow.graph?.podcast as PodcastSpec | undefined)) ?? null;
  const err = podcastReady(spec);
  if (err) return { error: err };
  const brief = (opts.flow.graph?.brief || '').trim();
  const step: RenderStep = {
    kind: 'podcast',
    tool: 'podcast_compose',
    target: 'cpu',
    llm: false,
    params: { podcast: spec, ...(brief ? { brief } : {}) },
    status: 'pending',
  };
  const job = await insertJob({
    tenantId,
    flowId: opts.flow.id,
    flowName: opts.flow.name,
    gpuTarget: getRenderGpuTarget(),
    inputUrl: null, // подкаст генеративный — без исходного видео
    steps: [step],
  });
  return { job };
}

/** Одна задача рендера тенанта. */
export const getRenderJob = getJob;
/** Список задач рендера тенанта (новые сверху). */
export const listRenderJobs = listJobs;
