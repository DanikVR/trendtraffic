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
export type UgcAvatarSource = 'collection' | 'photo' | 'video';   // готовые аватары / своё фото / готовое видео-аватар
export interface UgcSubtitles { style: 'none' | 'word' | 'karaoke' | 'plain'; pos: 'bottom' | 'center' | 'top'; wishes: string }
// Кастомная позиция/размер аватара на кадре (все раскладки solo): доли кадра 0..1,
// своя на каждый формат. Пусто = дефолт раскладки. Выставляется драгом на превью.
// oy — вертикальный сдвиг КАРТИНКИ внутри бокса (object-position Y, 0..1, деф. 0.5):
// аватар обрезается по cover, oy выбирает видимую часть (лицо/плечи). Драг-ручкой ↕.
export interface UgcAvatarRect { x: number; y: number; w: number; h: number; oy?: number }
/** Дефолтный прямоугольник аватара по раскладке (доли кадра). Раскладка = стартовая позиция,
 *  дальше двигается/масштабируется драгом. ТА ЖЕ логика зашита в бэкенде (render/router).
 *  «сверху»/«снизу» — крупный бокс в верхней/нижней половине (аватар cover-кроп ≈ сплит,
 *  но перетаскиваемый); overlay-* — маленький бокс в углу поверх видео. */
export function avatarDefaultRect(placement: UgcSpec['placement']): UgcAvatarRect {
  switch (placement) {
    case 'top': return { x: 0.06, y: 0.04, w: 0.88, h: 0.46 };
    case 'bottom': return { x: 0.06, y: 0.50, w: 0.88, h: 0.46 };
    case 'overlay-right': return { x: 0.52, y: 0.58, w: 0.44, h: 0.40 };
    case 'overlay-left':
    default: return { x: 0.04, y: 0.58, w: 0.44, h: 0.40 };
  }
}
export interface UgcSpec {
  avatarSource: UgcAvatarSource;
  avatarId: string | null;                                  // выбранный из коллекции
  avatarUrl: string | null; avatarName: string | null;      // его картинка/имя (вход рендера)
  avatarProvider: 'gallery';                                // аватар из Галереи (коллекция) / своё фото → HeyGen
  photoUrl: string | null; photoName: string | null;        // своё фото
  heygenLookId: string | null;                               // готовый лук/фото-аватар аккаунта HeyGen (рендер по id, без upload)
  // Готовое видео-аватар (avatarSource='video'): уже готовый ролик с говорящим человеком
  // (речь+мимика внутри). Идёт прямо в композит (composeUgc), HeyGen/ElevenLabs НЕ участвуют.
  avatarVideoUrl: string | null; avatarVideoName: string | null;
  avatarVideoCutout: boolean;                               // зелёный фон → вырезать (chroma-key), силуэт поверх видеоряда
  // ИИ-вырезка фона аватара в соло («Моё фото»/«Коллекция»): HeyGen оживляет фото на ЗЕЛЁНОМ
  // фоне (bgColor), рендер делает chroma-key → поверх кадра остаётся только силуэт человека.
  avatarCutout: boolean;
  // Аватар ПОВЕРХ врезок медиа реплик (соло): врезка идёт под аватаром — ведущий остаётся в кадре.
  // false (деф.) = врезка перекрывает аватара на время реплики (как раньше).
  avatarOverInserts: boolean;
  faceProvider: 'heygen_api' | 'heygen_ext';                // чем рендерить лицо: HeyGen API (ключ) ИЛИ подписка через расширение
  placement: 'top' | 'bottom' | 'overlay-left' | 'overlay-right'; // блок сверху/снизу ИЛИ маленьким поверх видео (альфа)
  voice: UgcVoice;
  source: UgcScriptSource;                                  // 'gen' | 'diarize'
  brief: string;
  script: PodLine[];                                        // реплики (один аватар)
  recordingUrl: string | null; recordingName: string | null;
  clip: { url: string; name: string } | null;              // вторая половина — видео
  // Видеоряд из ФОТО: одно = статичный кадр, несколько = перелистывание по кругу
  // (бэкенд собирает слайдшоу-клип пре-шагом /ugc/build; при заданном clip игнорируется).
  clipImages: { url: string; name: string }[];
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
  // Режим «Без аватара — озвучка» (ваше видео + голос, HeyGen не участвует):
  noAvatar: boolean;
  loudnorm: boolean;                                        // выровнять громкость своей записи (loudnorm)
  // Голос ElevenLabs из аккаунта клиента (null = дефолт по полу: Sarah/George):
  voiceId: string | null;
  // Языки серии (перевод Claude → TTS multilingual); 'ru' — основной:
  langs: string[];
  // Заставки до/после (приклеиваются как есть) и верхний PNG-слой на каждый формат:
  intro: { url: string; name: string } | null;
  outro: { url: string; name: string } | null;
  layers: Partial<Record<UgcFormat, { url: string; name: string }>>;
  // Позиция аватара per-format (драг на превью); {} = дефолт раскладки.
  avatarRects: Partial<Record<UgcFormat, UgcAvatarRect>>;
  // Шаблон, привязанный к этому ролику (апсертится при «Выходе»): один шаблон на ролик,
  // повторный выход обновляет его (а не плодит дубли). null = шаблона ещё нет.
  templateId: string | null;
  progressBar: boolean;                                     // полоса прогресса сверху кадра
  // «Использовать анализ» (ДНК тренда) — гибко по блокам: что именно подмешивать.
  // analysis = выбранный разбор (id из video_analyses + снимок нужных полей ДНК);
  // analysisUse — галочки: script (генерация текста), video (видео тренда в Видеоряд),
  // subtitles (стиль титров из visualStyle), retention (sceneBeats → режиссура Монтажа).
  analysis: {
    id: string;
    title?: string;             // подпись выбранного разбора (имя видео/ключевик)
    brief?: string;             // компилированный бриф ДНК
    copyReadyScript?: string;   // готовый черновик озвучки
    visualStyle?: string;
    hookAnalysis?: string;
    fileUrl?: string | null;    // видео тренда в Галерее (для галочки «видео»)
  } | null;
  analysisUse: { script: boolean; video: boolean; subtitles: boolean; retention: boolean };
}
export const UGC_DEFAULT: UgcSpec = {
  avatarSource: 'collection', avatarId: null,
  avatarUrl: null, avatarName: null, avatarProvider: 'gallery',
  photoUrl: null, photoName: null,
  heygenLookId: null,
  avatarVideoUrl: null, avatarVideoName: null, avatarVideoCutout: false,
  avatarCutout: false,
  avatarOverInserts: false,
  faceProvider: 'heygen_api',
  placement: 'top', voice: 'female',
  source: 'gen', brief: '', script: [],
  recordingUrl: null, recordingName: null,
  clip: null, clipImages: [], clipFit: 'cover', clipMuted: true,
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
  noAvatar: false,
  loudnorm: true,
  voiceId: null,
  langs: ['ru'],
  intro: null,
  outro: null,
  layers: {},
  avatarRects: {},
  templateId: null,
  progressBar: false,
  analysis: null,
  analysisUse: { script: true, video: true, subtitles: true, retention: true },
};

/** Цель пикера Галереи в UGC-студии (какое поле заполняем выбранным файлом). */
export type UgcPickTarget =
  | 'clip' | 'photo' | 'photoB' | 'avatarVideo' | 'recording' | 'music' | 'avatarAdd' | 'lineImage' | 'retBrolls'
  | 'intro' | 'outro' | 'clipImages'
  | `layer_${UgcFormat}`;

/** Производный режим ролика (четыре взаимоисключающие ветки /ugc/build). */
export type UgcMode = 'solo' | 'retention' | 'dialogue' | 'voiceover';
export const ugcModeOf = (u: UgcSpec): UgcMode =>
  u.noAvatar ? 'voiceover' : u.dialogueEnabled ? 'dialogue' : (u.retentionPreset !== 'off' ? 'retention' : 'solo');
