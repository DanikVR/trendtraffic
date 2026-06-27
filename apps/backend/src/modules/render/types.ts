/**
 * TrendTraffic — рендер «Собрать» (этап D). Типы.
 *
 * Конвейер: граф TrendFlow (flows.graph.nodes) → план шагов (RenderStep[]) →
 * очередь (render_jobs) → воркер-диспетчер → готовый ролик в Галерею.
 *
 * Маршрутизация: CPU-шаги (ResourceProfile.vram_mb==0) исполняются бесплатной
 * ffmpeg-цепочкой на VPS; GPU-шаги (avatar/upscale) — на домашнем RTX 5080 по
 * Tailscale либо в облаке, в зависимости от переключателя getRenderGpuTarget().
 */

/** Типы узлов монтажа (совпадают с MKind во фронтовом MontageEditor). */
export type MKind =
  | 'news' | 'research' | 'length' | 'format' | 'silence' | 'subtitles'
  | 'audio' | 'voiceover' | 'color' | 'broll' | 'avatar' | 'upscale' | 'export';

/** Где исполнять шаг: cpu — бесплатно на VPS; gpu — на воркере (дом/облако). */
export type StepTarget = 'cpu' | 'gpu';

/** Куда слать GPU-шаги (снимок переключателя на момент постановки задачи). */
export type GpuTarget = 'home' | 'cloud' | 'off';

/** Статус всей задачи рендера. */
export type RenderStatus = 'queued' | 'running' | 'done' | 'failed' | 'canceled';

/** Статус отдельного шага плана. */
export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed';

/** Один шаг рендера — узел графа, развёрнутый в вызов инструмента OpenMontage. */
export interface RenderStep {
  /** Тип узла-источника. */
  kind: MKind;
  /** Имя инструмента OpenMontage (см. planner.TOOL_MAP). */
  tool: string;
  /** cpu (VPS) или gpu (воркер). */
  target: StepTarget;
  /** Включён ли ЛЛМ-директор для этого шага (платный «умный» режим). */
  llm: boolean;
  /** Параметры узла (text/mediaUrl/choices) → пойдут инструменту. */
  params: Record<string, any>;
  /** Текущий статус шага. */
  status: StepStatus;
  /** Заметка (причина пропуска / сообщение исполнителя). */
  note?: string;
}

/** Задача рендера (строка render_jobs, нормализованная для API). */
export interface RenderJob {
  id: string;
  tenantId: string;
  flowId: string | null;
  flowName: string | null;
  status: RenderStatus;
  gpuTarget: GpuTarget;
  /** Исходное видео (URL/путь) — вход цепочки. */
  inputUrl: string | null;
  steps: RenderStep[];
  stepIndex: number;
  /** Прогресс 0..100. */
  progress: number;
  resultUrl: string | null;
  resultAssetId: string | null;
  note: string | null;
  error: string | null;
  attempts: number;
  createdAt?: string;
  updatedAt?: string;
}
