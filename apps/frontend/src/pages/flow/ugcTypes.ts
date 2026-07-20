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
/** Дефолтный PiP-бокс аватара в «Динамичном монтаже» и «Диалоге двоих» (доли кадра).
 *  Повторяет прежний зашитый в бэкенде PiP 360×640 в правом нижнем углу 1080×1920, но в
 *  ДОЛЯХ — поэтому одинаково ложится на 9:16 / 16:9 / 1:1 / 4:5 (в пикселях он на ландшафте
 *  разъезжался). Дальше двигается драгом на превью, как в соло. ТА ЖЕ логика в бэкенде. */
export const AVATAR_PIP_RECT: UgcAvatarRect = { x: 0.637, y: 0.6417, w: 0.3333, h: 0.3333, oy: 0.5 };
// Клип «Видеоряда» (их может быть несколько — идут друг за другом):
// durationSec — узнаётся из метаданных при показе; trimStart/trimEnd — обрезка
// в СЕКУНДАХ ИСХОДНИКА (абсолютные позиции), правится на дорожке таймлайна.
export interface UgcClipItem { url: string; name: string; durationSec?: number; trimStart?: number; trimEnd?: number }
/** Эффективная длительность клипа с учётом обрезки И скорости воспроизведения
 *  (speedPct — общий spec.clipSpeedPct; фолбэк 5с, пока метаданные не загрузились). */
export const clipEffDur = (c: UgcClipItem, speedPct = 100): number => {
  const spd = Math.min(2, Math.max(0.5, (Number(speedPct) || 100) / 100));
  return Math.max(0.3, ((Number.isFinite(c.trimEnd) && (c.trimEnd as number) > 0 ? (c.trimEnd as number) : (c.durationSec || 5)) - (c.trimStart || 0)) / spd);
};
/** Замена clips с синхронизацией legacy-поля clip (= первый клип): его читают превью,
 *  обложки шаблонов и старый путь бэкенда — не рассинхронизировать. */
export const syncClips = (u: UgcSpec, clips: UgcClipItem[]): UgcSpec =>
  ({ ...u, clips, clip: clips.length ? { url: clips[0].url, name: clips[0].name } : null });

/** Пакет «ролик на каждое видео»: одна задача сборки на выбранный видеоряд.
 *  status — 'queued' до ответа сервера, дальше строка статуса бэка как есть (или done/failed). */
export interface UgcBatchJob {
  url: string; name: string;
  jobId: string | null;
  status: string;
  resultUrl?: string; error?: string;
  clipSec?: number; startSec?: number;   // длина видеоряда и посчитанный старт аватара — видно в панели
}

/** Эффективный режим фона «Готового видео»: легаси-спеки без avatarVideoBgMode
 *  трактуем по старой галочке avatarVideoCutout (true = хромакей). */
export const avatarVideoBgModeOf = (u: UgcSpec): 'keep' | 'chroma' | 'ai' =>
  u.avatarVideoBgMode === 'ai' || u.avatarVideoBgMode === 'chroma' || u.avatarVideoBgMode === 'keep'
    ? u.avatarVideoBgMode : (u.avatarVideoCutout ? 'chroma' : 'keep');

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
  avatarVideoCutout: boolean;                               // legacy-галочка «хромакей» (= bgMode 'chroma'); поддерживаем для старых шаблонов/бэка
  // Режим фона готового видео: 'keep' = оставить, 'chroma' = хромакей (однотонный фон,
  // цвет по кадру), 'ai' = ИИ-матинг ЛЮБОГО фона (RobustVideoMatting на GPU-воркере).
  // '' = не задан (легаси-спека) → режим выводится из avatarVideoCutout (avatarVideoBgModeOf).
  avatarVideoBgMode: '' | 'keep' | 'chroma' | 'ai';
  // Вставка видео-аватара ПО ТАЙМЛАЙНУ (при заданном видеоряде): позиция в ВЫХОДНЫХ секундах —
  // аватар появляется и говорит с этого места; длину ролика задаёт видеоряд (хвост продлевает).
  avatarVideoStartSec: number;
  avatarVideoDurationSec: number | null;                    // из метаданных (ширина сегмента на дорожке)
  // Обрезка видео-аватара краями сегмента (СЕКУНДЫ ИСХОДНИКА, как у клипов видеоряда):
  avatarVideoTrimStart: number;
  avatarVideoTrimEnd: number | null;
  // ДОПОЛНИТЕЛЬНЫЕ сегменты того же видео-аватара (дубли по таймлайну, до 4): каждый —
  // своя позиция и обрезка; рендер кладёт их финальными проходами поверх готового ролика.
  avatarVideoExtraSegs: { startSec: number; trimStart?: number; trimEnd?: number }[];
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
  clip: { url: string; name: string } | null;              // legacy: = clips[0] (превью/обложки/старые сценарии)
  // Видеоряд: НЕСКОЛЬКО видео подряд (бэкенд склеивает пре-шагом → один clip).
  // Один клип без обрезки идёт как раньше, без перекодирования.
  clips: UgcClipItem[];
  // Видеоряд из ФОТО: одно = статичный кадр, несколько = перелистывание по кругу
  // (бэкенд собирает слайдшоу-клип пре-шагом /ugc/build; при заданном clip игнорируется).
  clipImages: { url: string; name: string }[];
  clipFit: 'cover' | 'contain'; clipMuted: boolean;
  // Громкость звука видеоряда в % (0–200, деф. 90 — прежний хардкод 0.9) — микс solo/озвучки.
  clipVolumePct: number;
  // Громкость озвучки (голос аватара/TTS/запись) в % (0–200, деф. 100).
  voiceVolumePct: number;
  // Скорость воспроизведения видеоряда в % (50–200 = ×0.5…×2, atempo-диапазон); ≠100 → пре-шаг.
  clipSpeedPct: number;
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
  // Переход на стыках ролик↔заставки: 5 xfade-пресетов + «аватар-зум» (панч в бокс аватара).
  bumperTransition: 'none' | 'fade' | 'zoom' | 'slide' | 'circle' | 'blur' | 'avatarzoom';
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
  avatarVideoUrl: null, avatarVideoName: null, avatarVideoCutout: false, avatarVideoBgMode: '',
  avatarVideoStartSec: 0, avatarVideoDurationSec: null,
  avatarVideoTrimStart: 0, avatarVideoTrimEnd: null,
  avatarVideoExtraSegs: [],
  avatarCutout: false,
  avatarOverInserts: false,
  faceProvider: 'heygen_api',
  placement: 'top', voice: 'female',
  source: 'gen', brief: '', script: [],
  recordingUrl: null, recordingName: null,
  clip: null, clips: [], clipImages: [], clipFit: 'cover', clipMuted: true,
  clipVolumePct: 90, voiceVolumePct: 100, clipSpeedPct: 100,
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
  bumperTransition: 'none',
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

/** ЕДИНЫЙ источник координат аватара для формата: кастом (драг на превью) ИЛИ дефолт режима.
 *  Соло — бокс раскладки, «Монтаж»/«Диалог» — PiP-бокс. Рендер обязан считать ТО ЖЕ САМОЕ
 *  (render/router.ts::avatarRectFor), иначе превью разъезжается с роликом. */
export const avatarRectOf = (u: UgcSpec, fmt: UgcFormat): UgcAvatarRect =>
  u.avatarRects?.[fmt] || (ugcModeOf(u) === 'solo' ? avatarDefaultRect(u.placement) : AVATAR_PIP_RECT);

/* ── Калькулятор затрат API (смета в топбаре) ──
 * Считаем ТОЛЬКО детерминированные пути — по фактической длительности голоса и символам:
 *  · соло «Моё фото»/«Коллекция» по API: HeyGen Avatar IV на ВСЮ длину голоса,
 *    и на КАЖДЫЙ язык серии заново (бэкенд рендерит аватара per-language!) + TTS;
 *  · «Диалог двоих»: сегменты обоих спикеров суммарно ≈ длине разобранной записи;
 *  · «Без аватара» с ИИ-текстом: только ElevenLabs по символам × языки.
 * null = не считаем числом (готовое видео $0, подписка, «Монтаж» — долю лицевых
 * сегментов решает ИИ-режиссёр на сервере, заранее неизвестна → остаются ориентиры). */
export const HEYGEN_IV_USD_PER_MIN = 3;      // Avatar IV pay-as-you-go (прайс HeyGen 07.2026)
export const ELEVEN_USD_PER_1K_CHARS = 0.2;  // ElevenLabs multilingual v2, ориентир Creator-тарифа
export interface UgcCostCalc { usd: number; heygenUsd: number; ttsUsd: number; heygenSec: number; langs: number; chars: number }
export function estimateUgcCost(u: UgcSpec, voiceSec: number): UgcCostCalc | null {
  if (!(voiceSec > 0)) return null;
  const mode = ugcModeOf(u);
  const isVideoAv = mode === 'solo' && u.avatarSource === 'video';
  const chars = u.script.reduce((s, l) => s + (l.text || '').trim().length, 0);
  // Серия языков — только ИИ-текст в соло/озвучке (зеркало langsActive в студии); ru всегда в счёте.
  const langs = !isVideoAv && u.source === 'gen' && (mode === 'solo' || mode === 'voiceover')
    ? new Set(['ru', ...u.langs]).size : 1;
  const ttsUsd = u.source === 'gen' && chars > 0 ? (chars / 1000) * ELEVEN_USD_PER_1K_CHARS * langs : 0;
  if (mode === 'voiceover') return u.source === 'gen' ? { usd: ttsUsd, heygenUsd: 0, ttsUsd, heygenSec: 0, langs, chars } : null;
  if (mode === 'dialogue') {
    const h = (voiceSec / 60) * HEYGEN_IV_USD_PER_MIN;
    return { usd: h, heygenUsd: h, ttsUsd: 0, heygenSec: Math.round(voiceSec), langs: 1, chars };
  }
  if (mode === 'solo' && !isVideoAv && u.faceProvider === 'heygen_api') {
    const h = (voiceSec / 60) * HEYGEN_IV_USD_PER_MIN * langs;
    return { usd: h + ttsUsd, heygenUsd: h, ttsUsd, heygenSec: Math.round(voiceSec), langs, chars };
  }
  return null;
}
