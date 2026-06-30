/**
 * TrendTraffic — планировщик рендера: граф TrendFlow → упорядоченный список шагов.
 *
 * Порядок узлов в graph.nodes = порядок применения (цепочка вокруг центра в
 * MontageEditor). Каждый montage-узел разворачивается в RenderStep с привязкой к
 * инструменту OpenMontage и целью исполнения (cpu/gpu).
 *
 * Карта kind → инструмент сверена по docs/TRENDTRAFFIC.md §4 (OpenMontage). GPU
 * требуют только avatar (talking-head: SadTalker/Wav2Lip) и upscale (Real-ESRGAN);
 * остальное — бесплатная CPU-цепочка ffmpeg (vram_mb==0).
 */

import type { FlowGraph } from '../flows/service.js';
import type { MKind, RenderStep, StepTarget } from './types.js';

interface ToolSpec { tool: string; target: StepTarget; }

/** kind → инструмент OpenMontage + где исполнять. */
const TOOL_MAP: Record<MKind, ToolSpec> = {
  news:      { tool: 'news_source',    target: 'cpu' }, // источник текст+фото (отдельный блок RSS — позже)
  research:  { tool: 'web_research',   target: 'cpu' }, // ЛЛМ + веб-поиск (наша сторона)
  length:    { tool: 'video_trimmer',  target: 'cpu' }, // in/out таймкоды [+ЛЛМ выбор момента]
  format:    { tool: 'auto_reframe',   target: 'cpu' }, // 9:16/1:1/16:9 + media-profile
  silence:   { tool: 'silence_cutter', target: 'cpu' },
  subtitles: { tool: 'subtitle_gen',   target: 'cpu' }, // burn ffmpeg-фолбэк
  audio:     { tool: 'audio_mixer',    target: 'cpu' }, // tracks/ducking/volume
  voiceover: { tool: 'tts',            target: 'cpu' }, // Piper локально (бесплатно)
  color:     { tool: 'color_grade',    target: 'cpu' },
  broll:     { tool: 'clip_search',    target: 'cpu' },
  avatar:    { tool: 'talking_head',   target: 'gpu' }, // SadTalker/Wav2Lip — GPU
  upscale:   { tool: 'upscale',        target: 'gpu' }, // Real-ESRGAN — GPU
  export:    { tool: 'video_compose',  target: 'cpu' }, // media-profile, мультиплатформа
  // Подкаст-сцена (2 ведущих) собирается одним шагом podcast_compose. target=cpu:
  // конвейерная работа (TTS, сшивка, реренфрейм) идёт на VPS; говорящие головы
  // (talking_head) — апгрейд, когда шаг исполняется на GPU-воркере с SadTalker.
  podcast:   { tool: 'podcast_compose', target: 'cpu' },
};

/** Известен ли тип узла планировщику (есть ли он в карте инструментов). */
export function isKnownKind(kind: unknown): kind is MKind {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(TOOL_MAP, kind);
}

/**
 * Разворачивает граф flow в список шагов рендера в порядке узлов.
 * Берёт только montage-узлы с известным kind; остальное игнорирует.
 */
export function planFromGraph(graph: FlowGraph | null | undefined): RenderStep[] {
  const nodes = Array.isArray(graph?.nodes) ? graph!.nodes : [];
  const steps: RenderStep[] = [];
  for (const n of nodes) {
    const kind = n?.data?.kind;
    if (n?.type !== 'montage' || !isKnownKind(kind)) continue;
    const spec = TOOL_MAP[kind];
    steps.push({
      kind,
      tool: spec.tool,
      target: spec.target,
      llm: !!n.data.useLlm,
      params: {
        text: typeof n.data.text === 'string' ? n.data.text : '',
        mediaUrl: n.data.mediaUrl || null,
        mediaName: n.data.mediaName || null,
        choices: n.data.choices && typeof n.data.choices === 'object' ? n.data.choices : {},
      },
      status: 'pending',
    });
  }
  return steps;
}
