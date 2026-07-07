/**
 * Типы блока «UGC / Аватары» — вынесены из MontageEditor, чтобы полноэкранная
 * UGC-студия (UgcStudio.tsx) и редактор сценария использовали ОДНУ спеку.
 * Сама спека (UgcSpec) не менялась — graph старых сценариев читается как раньше.
 */
import type { PodLine } from './dialogueTypes';

export type UgcVoice = 'female' | 'male';
export type UgcScriptSource = 'gen' | 'diarize';   // озвучка: сгенерировать текст / разобрать запись
export type UgcFormat = '9x16' | '16x9' | '1x1' | '4x5';   // форматы вывода (мультивыбор)

// ── Блок «UGC / Аватары»: кадр 9:16 из двух половин (аватар + видео) ──
// Одна половина — говорящий аватар (из коллекции Галереи / своё фото → HeyGen), другая —
// произвольное видео из Галереи; аватар ставится сверху или снизу. Скрипт — генерация/разбор
// записи. Снизу — вжигание титров существующим блоком субтитров (subtitle_gen).
export type UgcAvatarSource = 'collection' | 'photo';
export interface UgcSubtitles { style: 'none' | 'word' | 'karaoke' | 'plain'; pos: 'bottom' | 'center' | 'top'; wishes: string }
export interface UgcSpec {
  avatarSource: UgcAvatarSource;
  avatarId: string | null;                                  // выбранный из коллекции
  avatarUrl: string | null; avatarName: string | null;      // его картинка/имя (вход рендера)
  avatarProvider: 'gallery';                                // аватар из Галереи (коллекция) / своё фото → HeyGen
  photoUrl: string | null; photoName: string | null;        // своё фото
  faceProvider: 'heygen_api' | 'heygen_ext';                // чем рендерить лицо: HeyGen API (ключ) ИЛИ подписка через расширение
  placement: 'top' | 'bottom' | 'overlay-left' | 'overlay-right'; // блок сверху/снизу ИЛИ маленьким поверх видео (альфа)
  voice: UgcVoice;
  source: UgcScriptSource;                                  // 'gen' | 'diarize'
  brief: string;
  script: PodLine[];                                        // реплики (один аватар)
  recordingUrl: string | null; recordingName: string | null;
  clip: { url: string; name: string } | null;              // вторая половина — видео
  clipFit: 'cover' | 'contain'; clipMuted: boolean;
  subtitles: UgcSubtitles;                                  // титры (переиспользуем блок субтитров)
  music: { url: string; name: string; volumePct: number; durationSec?: number | null } | null;   // durationSec: играть первые N сек (null = весь ролик)
  platforms: string[];
  buildJobId: string | null;                                // идущая сборка (переживает перезаход)
  result: { url: string; name: string } | null;             // готовый ролик
  // Удержание (переключения техник) — только для «Своё фото» (HeyGen IV/III):
  retentionPreset: 'off' | 'eco' | 'bal' | 'prem';          // off = обычная сборка
  retentionBrolls: { url: string; name: string }[];         // батч: N видео → N роликов (иначе один clip)
  results: { url: string; name: string }[];                 // готовые ролики батча
  // Диалоги (два собеседника) — только «Своё фото» + разбор записи двух голосов (HeyGen):
  dialogueEnabled: boolean;                                 // включён режим диалога A/B
  dialogueEngagement: 'eco' | 'bal' | 'dyn';                // как часто оба в кадре (эконом/баланс/динамично)
  dialogueCutout: boolean;                                  // вырезать фон аватара (силуэт поверх медиа)
  photoBUrl: string | null; photoBName: string | null;      // фото «Спикер B» (A = photoUrl)
  formats: UgcFormat[];                                     // форматы вывода (любое сочетание, ≥1)
}
export const UGC_DEFAULT: UgcSpec = {
  avatarSource: 'collection', avatarId: null,
  avatarUrl: null, avatarName: null, avatarProvider: 'gallery',
  photoUrl: null, photoName: null,
  faceProvider: 'heygen_api',
  placement: 'top', voice: 'female',
  source: 'gen', brief: '', script: [],
  recordingUrl: null, recordingName: null,
  clip: null, clipFit: 'cover', clipMuted: true,
  subtitles: { style: 'word', pos: 'bottom', wishes: '' },
  music: null,
  platforms: ['tiktok', 'reels', 'shorts'],
  buildJobId: null,
  result: null,
  retentionPreset: 'off',
  retentionBrolls: [],
  results: [],
  dialogueEnabled: false,
  dialogueEngagement: 'bal',
  dialogueCutout: false,
  photoBUrl: null, photoBName: null,
  formats: ['9x16'],
};

/** Цель пикера Галереи в UGC-студии (какое поле заполняем выбранным файлом). */
export type UgcPickTarget = 'clip' | 'photo' | 'photoB' | 'recording' | 'music' | 'avatarAdd' | 'lineImage' | 'retBrolls';

/** Производный режим ролика (три взаимоисключающие ветки /ugc/build). */
export type UgcMode = 'solo' | 'retention' | 'dialogue';
export const ugcModeOf = (u: UgcSpec): UgcMode =>
  u.dialogueEnabled ? 'dialogue' : (u.retentionPreset !== 'off' ? 'retention' : 'solo');
