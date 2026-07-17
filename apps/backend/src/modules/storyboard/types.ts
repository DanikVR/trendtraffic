/**
 * СТОРИБОРД — общие типы модуля (план раскадровки).
 *
 * Механика (по мотивам конвейера «рилс-автомонтаж»): говорящее видео режется на
 * куски ≤8с по концам фраз, на каждый кусок строится раскадровка из ~6 панелей
 * (спикер крупно / титр / врезка / сплит / мокап / финал+CTA), затем движок
 * (v1 — программный ffmpeg) рендерит куски и склеивает готовый вертикальный рилс.
 */

export type PanelType = 'speaker' | 'title' | 'cutaway' | 'split' | 'mockup' | 'final';

export const PANEL_TYPES: PanelType[] = ['speaker', 'title', 'cutaway', 'split', 'mockup', 'final'];

export interface SbPanel {
  type: PanelType;
  /** Секунды ОТ НАЧАЛА КУСКА. */
  start: number;
  end: number;
  /** Титр/CTA/подпись панели (рисуется программно — текст никогда не «плывёт»). */
  text?: string;
  /** Абсолютная секунда исходника для кадра-превью панели. */
  frameTs?: number;
  /** /uploads/... — готовый jpg-кадр превью панели (генерится при analyze/plan). */
  frameUrl?: string;
  /** /uploads/... — картинка для врезки/сплита/мокапа (из Галереи). */
  imageUrl?: string;
  /** Промпт для генеративного движка (Ф3 — Omni/Flow). */
  prompt?: string;
}

export type ChunkStatus = 'draft' | 'rendering' | 'done' | 'failed';

export interface SbChunk {
  idx: number;
  /** Секунды в исходнике. */
  start: number;
  end: number;
  enabled: boolean;
  status: ChunkStatus;
  panels: SbPanel[];
  pngUrl?: string;
  renderUrl?: string;
  /** /uploads/... — филмстрип куска (горизонтальный спрайт кадров ~каждые 0.7с). */
  stripUrl?: string;
  error?: string;
}

export interface SbTranscriptSeg { start: number; end: number; text: string }
export interface SbBeat { t: number; desc: string; intensity?: string }

export interface SbPlan {
  transcript: SbTranscriptSeg[];
  beats?: SbBeat[];
  textOverlays?: string[];
  chunks: SbChunk[];
  /** Чем построен план панелей: 'claude' | 'template'. */
  planSource?: 'claude' | 'template';
  planNote?: string;
}

export type SbEngine = 'program' | 'omni' | 'flow';

export interface SbSettings {
  /** Стиль-пресет (влияет на цвет титров/подложек и промпты Ф3). */
  style?: string;
  engine?: SbEngine;
  /** Текст-бейдж в углу готового ролика. */
  badgeText?: string;
  /** Прожигать субтитры из транскрипта. */
  subtitles?: boolean;
  /** Кодовое слово CTA финала (= кодовое слово подписи из «формулы-подписи»). */
  ctaWord?: string;
}

export type SbStatus = 'draft' | 'analyzing' | 'planned' | 'rendering' | 'done' | 'failed';

export interface StoryboardDoc {
  id: string;
  name: string;
  status: SbStatus;
  sourceAssetId?: string | null;
  sourceUrl?: string | null;
  sourceDuration?: number | null;
  plan: SbPlan;
  settings: SbSettings;
  resultAssetId?: string | null;
  resultUrl?: string | null;
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Живой процесс над проектом (in-memory): analyze/plan/render/assemble. */
  busy?: { stage: string; chunk?: number; startedAt: number } | null;
}

/** Максимальная длина куска, сек (лимит генеративных движков — 8с/клип). */
export const MAX_CHUNK_SEC = 8;
/** Пределы панелей на кусок. */
export const MIN_PANELS = 3;
export const MAX_PANELS = 8;

/** Русские подписи типов панелей (для PNG-сетки и фолбэков UI). */
export const PANEL_LABEL_RU: Record<PanelType, string> = {
  speaker: 'Спикер крупно',
  title: 'Титр во весь экран',
  cutaway: 'Врезка',
  split: 'Сплит-экран',
  mockup: 'Мокап',
  final: 'Финал + CTA',
};
