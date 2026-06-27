/**
 * TrendTraffic — исполнитель-обёртка ИИ-режиссёра (decorator над базовым).
 *
 * Перехватывает «умные» шаги ДО инструмента OpenMontage:
 *  • research / news (+ЛЛМ) → Claude собирает текст → в ctx.scratchpad (видео без
 *    изменений); downstream-шаги (озвучка) подхватывают как материал-опору.
 *  • voiceover (+ЛЛМ) → Claude пишет сценарий → подменяет params.text → базовый
 *    исполнитель прогоняет tts (Piper озвучивает уже готовый сценарий).
 *  • length (+ЛЛМ) → Claude по транскрипту выбирает момент → проставляет
 *    params.text="start-end" → базовый video_trimmer режет именно его.
 *
 * Всё остальное — без изменений уходит базовому исполнителю. Без ключа Claude /
 * при ошибке — мягкая деградация (passthrough с заметкой), конвейер не падает.
 */

import type { RenderStep } from './types.js';
import type { StepContext, StepResult, StepExecutor } from './executor.js';
import {
  directorModel, generateVoiceoverScript, runResearch, writeNews, pickBestMoment,
} from './director.js';

/** Целевая длительность для «выбора момента» из choices.duration (15/30/60 → сек, иначе 30). */
function targetSeconds(params: Record<string, any>): number {
  const d = (params?.choices?.duration || [])[0];
  return d === '15' || d === '30' || d === '60' ? Number(d) : 30;
}

function joinNotes(a?: string, b?: string): string | undefined {
  return [a, b].filter(Boolean).join(' · ') || undefined;
}

export class DirectorExecutor implements StepExecutor {
  constructor(private base: StepExecutor) {}

  async execute(step: RenderStep, ctx: StepContext): Promise<StepResult> {
    const scratch = ctx.scratchpad || {};
    const model = directorModel(step.params);
    const text = String(step.params?.text || '').trim();

    // research / news → текст в scratchpad, видео не меняем
    if ((step.kind === 'research' || step.kind === 'news') && step.llm) {
      const r = step.kind === 'research'
        ? await runResearch({ tenantId: ctx.tenantId, topic: text, model })
        : await writeNews({ tenantId: ctx.tenantId, topic: text, model });
      if (r.text) scratch[step.kind] = r.text;
      return { outputUrl: ctx.currentUrl, note: r.note };
    }

    // voiceover (+ЛЛМ) → сценарий → базовый tts
    if (step.kind === 'voiceover' && step.llm) {
      const r = await generateVoiceoverScript({
        tenantId: ctx.tenantId, brief: text, notes: scratch.research || scratch.news, model,
      });
      const enriched = r.text ? { ...step, params: { ...step.params, text: r.text } } : step;
      const base = await this.base.execute(enriched, ctx);
      return { ...base, note: joinNotes(r.note, base.note) };
    }

    // length (+ЛЛМ) и без явного диапазона в тексте → выбор момента
    if (step.kind === 'length' && step.llm && !/\d\s*[-–—]\s*\d/.test(text)) {
      const r = await pickBestMoment({
        tenantId: ctx.tenantId, sourceUrl: ctx.currentUrl, targetSec: targetSeconds(step.params), model,
      });
      const enriched = r.range ? { ...step, params: { ...step.params, text: r.range } } : step;
      const base = await this.base.execute(enriched, ctx);
      return { ...base, note: joinNotes(r.note, base.note) };
    }

    return this.base.execute(step, ctx);
  }
}
