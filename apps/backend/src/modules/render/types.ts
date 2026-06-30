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
  | 'audio' | 'voiceover' | 'color' | 'broll' | 'avatar' | 'upscale' | 'export'
  | 'podcast';

// ── Подкаст-сцена (2 ведущих): спецификация сборки ────────────────────────────
/** Один ведущий: фото + голос TTS (+опц. имя). */
export interface PodcastHost {
  photoUrl: string | null;
  photoName: string | null;
  voice: 'female' | 'male';
  name?: string;
}
/** Реплика диалога: какой ведущий и что говорит (+ таймкоды для нарезки реального голоса при диаризации). */
export interface PodcastLine { speaker: 'A' | 'B'; text: string; start?: number; end?: number }
/** Картинка-вставка, показываемая между ведущими. */
export interface PodcastCutaway { url: string; name?: string }
/**
 * Спецификация подкаст-сцены (хранится в flows.graph.podcast, исполняется
 * инструментом podcast_compose на воркере). Дорожки берутся либо генерацией
 * диалога (source='gen' → Claude+Piper на 2 голоса), либо разбором готовой
 * записи (source='diarize' → диаризация на 2 спикеров).
 */
export interface PodcastSpec {
  hostA: PodcastHost;
  hostB: PodcastHost;
  /** Откуда дорожки: 'gen' — сгенерировать диалог; 'diarize' — разобрать запись. */
  source: 'gen' | 'diarize';
  /** Бриф/тема для генерации диалога (source='gen'). */
  brief: string;
  /** Реплики диалога (source='gen'). */
  dialogue: PodcastLine[];
  /** Загруженная запись подкаста для диаризации (source='diarize'). */
  recordingUrl: string | null;
  recordingName: string | null;
  /** Картинки, показываемые между ведущими (сплит-скрин). */
  cutaways: PodcastCutaway[];
  /** Где картинка в сплит-скрине: 'overlay' — по центру шва; 'topbar' — плашкой сверху. */
  layout: 'overlay' | 'topbar';
  /** Длительность сегмента-реплики (сек) для стилл-фолбэка и показа картинок. */
  segSec: number;
  /** Площадки экспорта. */
  platforms: string[];
}

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
