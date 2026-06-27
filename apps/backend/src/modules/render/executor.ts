/**
 * TrendTraffic — исполнитель одного шага рендера (seam).
 *
 * Сейчас реализован SimulationExecutor — он НЕ запускает ffmpeg/OpenMontage, а
 * лишь логически «проигрывает» план: помечает шаги выполненными и проксирует
 * исходное видео в результат. Это даёт работающий сквозной скелет
 * (граф → очередь → статус → ролик в Галерею), пока не подключён реальный
 * Python-воркер OpenMontage (следующий блок этапа D).
 *
 * Реальный исполнитель заменит SimulationExecutor, не трогая worker.ts:
 *  - CPU-шаги (target='cpu') → HTTP к FastAPI-обёртке OpenMontage на VPS;
 *  - GPU-шаги (target='gpu') → к домашнему воркеру RTX 5080 по Tailscale
 *    либо в облако, в зависимости от ctx.gpuTarget.
 */

import type { RenderStep } from './types.js';

export interface StepContext {
  jobId: string;
  tenantId: string;
  /** Куда слать GPU-шаги (снимок переключателя на момент постановки). */
  gpuTarget: 'home' | 'cloud' | 'off';
  /** URL текущего «рабочего» медиа (выход предыдущего шага → вход следующего). */
  currentUrl: string | null;
  /** Общий «блокнот» задачи: ИИ-режиссёр пишет сюда ресёрч/новости, озвучка читает. */
  scratchpad?: Record<string, any>;
}

export interface StepResult {
  /** Новый URL медиа после шага (если шаг его произвёл). */
  outputUrl?: string | null;
  /** true — шаг намеренно пропущен (напр. GPU выключен). */
  skipped?: boolean;
  /** Человекочитаемая заметка к шагу. */
  note?: string;
}

export interface StepExecutor {
  execute(step: RenderStep, ctx: StepContext): Promise<StepResult>;
}

/**
 * Скелет-исполнитель: ничего не рендерит. GPU-шаги при выключенном GPU помечает
 * пропущенными; CPU-шаги «проходят» с заметкой. Реальной обработки нет — это
 * каркас конвейера до подключения OpenMontage-воркера.
 */
export class SimulationExecutor implements StepExecutor {
  async execute(step: RenderStep, ctx: StepContext): Promise<StepResult> {
    if (step.target === 'gpu' && ctx.gpuTarget === 'off') {
      return { skipped: true, note: 'GPU выключен в админке — шаг пропущен' };
    }
    const where = step.target === 'gpu' ? `GPU:${ctx.gpuTarget}` : 'CPU:VPS';
    // Проброс текущего медиа без изменений (скелет).
    return { outputUrl: ctx.currentUrl, note: `симуляция (${where}) — OpenMontage-воркер ещё не подключён` };
  }
}
