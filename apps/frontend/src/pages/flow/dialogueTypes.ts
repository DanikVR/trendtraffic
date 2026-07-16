/**
 * Общие типы диалога/таймлайна — переиспускаются подкастом и «Комментатором».
 * Вынесены из MontageEditor, чтобы редактор-таймлайн (DialogueTimeline) был ОДИН
 * на оба блока (идентичны навсегда), без циклических импортов.
 */

export type PodAnim = 'auto' | 'slide-left' | 'slide-right' | 'slide-up' | 'fade' | 'zoom';

/** Значения выезда карточки. Подписи (i18n) — в точке рендера: DialogueTimeline, ключи sec.dialogue.anim*. */
export const POD_ANIMS: PodAnim[] = ['auto', 'slide-left', 'slide-right', 'slide-up', 'zoom', 'fade'];

/** Как показать медиа реплики в режиме «Диалоги» ('auto' → решает Claude). */
export type DlgMediaHint = 'auto' | 'media-full' | 'media-bg-left' | 'media-bg-right' | 'media-split';
/** Значения раскладки. Подписи (i18n) — в точке рендера: DialogueTimeline, ключи sec.dialogue.hint*. */
export const DLG_MEDIA_HINTS: DlgMediaHint[] = ['auto', 'media-full', 'media-bg-left', 'media-bg-right', 'media-split'];

/** Кадр-окно медиа реплики (доли кадра 0..1) — выставляется драгом на превью UGC-студии.
 *  Отсутствует (undefined) = медиа во весь кадр. ТА ЖЕ геометрия уходит в рендер (overlayExtras). */
export interface LineRect { x: number; y: number; w: number; h: number }

/** Реплика: спикер + текст (+ таймкоды) + опц. картинка/видео + tStart (позиция на таймлайне).
 *  mode/title/anim — план показа медиа; gesture — переопределение жеста (подкаст, GPU-студия);
 *  layoutHint/holdSec — режим «Диалоги»: как показать медиа и сколько держать (растяжка);
 *  rect — окно врезки в соло/озвучке UGC (пусто = во весь кадр). */
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
  layoutHint?: DlgMediaHint;
  holdSec?: number;
  rect?: LineRect;
}
