/**
 * Общие типы диалога/таймлайна — переиспускаются подкастом и «Комментатором».
 * Вынесены из MontageEditor, чтобы редактор-таймлайн (DialogueTimeline) был ОДИН
 * на оба блока (идентичны навсегда), без циклических импортов.
 */

export type PodAnim = 'auto' | 'slide-left' | 'slide-right' | 'slide-up' | 'fade' | 'zoom';

export const POD_ANIMS: { v: PodAnim; label: string }[] = [
  { v: 'auto', label: 'Авто' }, { v: 'slide-left', label: '← Слева' }, { v: 'slide-right', label: 'Справа →' },
  { v: 'slide-up', label: '↑ Снизу' }, { v: 'zoom', label: 'Зум' }, { v: 'fade', label: 'Проявление' },
];

/** Реплика: спикер + текст (+ таймкоды) + опц. картинка/видео + tStart (позиция на таймлайне).
 *  mode/title/anim — план показа медиа; gesture — переопределение жеста (подкаст, GPU-студия). */
export interface PodLine {
  speaker: 'A' | 'B';
  text: string;
  start?: number; end?: number;
  image?: string; imageName?: string;
  anim?: PodAnim;
  tStart?: number;
  gesture?: number;
  mode?: 'card' | 'full';
  title?: string;
}
