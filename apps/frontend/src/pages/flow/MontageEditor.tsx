/**
 * MontageEditor — радиальный («паутина») редактор монтажного сценария TrendFlow.
 *
 * В центре — исходное видео; вокруг по лучам — узлы-процессы (на базе инструментов
 * OpenMontage). Цепочка вокруг центра: порядок узлов = порядок применения.
 *  • узлы настраиваются КНОПКАМИ (с умными дефолтами — «не задумываясь»);
 *    мультивыбор где нужно (Экспорт — несколько площадок);
 *  • опц. текстовое поле + 📎 медиа из Галереи + ✨ЛЛМ; кнопка «Готово»;
 *  • применённые процессы — чипами сверху с «редактировать»;
 *  • пустой сценарий → витрина пресетов (группы × 3).
 *
 * Хранение — в flows.graph.nodes (JSONB).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Video, Scissors, Crop, VolumeX, Type, Music, Mic, Palette, Image,
  UserRound, Search, Maximize2, Share2, Newspaper,
  Plus, Pencil, Trash2, X, Minus, Loader2, ArrowLeft, Sparkles, Paperclip, Save, Wand2, Check,
  Cloud, CalendarDays, Download, Link2, Film, Undo2, Redo2, Play, Pause, Combine, UploadCloud, Info,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { VideoViewer } from '../../components/VideoViewer';

type MKind =
  | 'news' | 'research' | 'length' | 'format' | 'silence' | 'subtitles' | 'audio'
  | 'voiceover' | 'color' | 'broll' | 'avatar' | 'upscale' | 'export';

interface Choice { id: string; label: string; multi?: boolean; def: string[]; opts: { v: string; label: string }[]; }
interface Meta { label: string; icon: React.ReactNode; hint: string; choices?: Choice[]; text?: string; media?: string; llm?: boolean; }

interface MNode {
  id: string;
  kind: MKind;
  text: string;
  mediaUrl: string | null;
  mediaName: string | null;
  /** Доп. медиа (B-roll «Медиафайлы» принимает НЕСКОЛЬКО файлов из Галереи). */
  medias?: { url: string; name: string }[];
  useLlm: boolean;
  choices: Record<string, string[]>;
}

const META: Record<MKind, Meta> = {
  news:      { label: 'Новости', icon: <Newspaper size={18} />, hint: 'Источник: RSS / Telegram / сайт / рубрика → текст + фото',
    choices: [{ id: 'type', label: 'Тип источника', def: ['rss'], opts: [{ v: 'rss', label: 'RSS' }, { v: 'telegram', label: 'Telegram' }, { v: 'site', label: 'Сайт' }, { v: 'rubric', label: 'Рубрика' }] }],
    text: 'RSS-URL, @telegram-канал или ссылка на сайт — возьмём последнюю запись (текст + фото)', llm: true },
  research:  { label: 'Исследование', icon: <Search size={18} />, hint: 'Веб-поиск темы + источники', text: 'Тема для ресёрча…', llm: true },
  length:    { label: 'Длина', icon: <Scissors size={18} />, hint: 'Длительность / лучший момент (ИИ) — авто-нарезка; ручная обрезка — в облаке «Редактор»',
    choices: [{ id: 'duration', label: 'Длительность', def: ['30'], opts: [{ v: '15', label: '15 сек' }, { v: '30', label: '30 сек' }, { v: '60', label: '60 сек' }, { v: 'best', label: 'Лучший момент (ЛЛМ)' }, { v: 'full', label: 'Весь' }] }],
    text: 'или диапазон 0:10–0:40', llm: true },
  format:    { label: 'Формат', icon: <Crop size={18} />, hint: 'Ориентация под площадку',
    choices: [{ id: 'orient', label: 'Ориентация', def: ['9:16'], opts: [{ v: '9:16', label: 'Вертикаль 9:16' }, { v: '16:9', label: 'Гориз 16:9' }, { v: '1:1', label: 'Квадрат' }, { v: '4:5', label: '4:5' }, { v: '21:9', label: 'Cinematic' }] }] },
  silence:   { label: 'Паузы', icon: <VolumeX size={18} />, hint: 'Тишина между словами',
    choices: [{ id: 'mode', label: 'Что делать с паузами', def: ['cut'], opts: [{ v: 'none', label: 'Не трогать' }, { v: 'cut', label: 'Вырезать' }, { v: 'speed', label: 'Ускорить' }] }] },
  subtitles: { label: 'Субтитры', icon: <Type size={18} />, hint: 'Распознаём речь и вшиваем титры',
    choices: [
      { id: 'style', label: 'Стиль', def: ['word'], opts: [{ v: 'none', label: 'Без' }, { v: 'word', label: 'По словам' }, { v: 'karaoke', label: 'Караоке' }, { v: 'plain', label: 'Обычные' }] },
    ] },
  audio:     { label: 'Аудио', icon: <Music size={18} />, hint: 'Музыка + баланс с голосом',
    choices: [
      { id: 'vol', label: 'Громкость музыки', def: ['mid'], opts: [{ v: 'low', label: 'Тихо' }, { v: 'mid', label: 'Средне' }, { v: 'high', label: 'Громко' }] },
      { id: 'duck', label: 'Приглушать под голос', def: ['on'], opts: [{ v: 'on', label: 'Вкл' }, { v: 'off', label: 'Выкл' }] },
    ], media: 'Музыка из Галереи' },
  voiceover: { label: 'Озвучка', icon: <Mic size={18} />, hint: 'Текст → голос (TTS)',
    choices: [{ id: 'voice', label: 'Голос', def: ['female'], opts: [{ v: 'female', label: 'Женский' }, { v: 'male', label: 'Мужской' }] }],
    text: 'текст для озвучки…', llm: true },
  color:     { label: 'Цветокор', icon: <Palette size={18} />, hint: 'Настроение картинки: пресет или свой LUT',
    choices: [{ id: 'preset', label: 'Пресет', def: ['none'], opts: [{ v: 'none', label: 'Без' }, { v: 'warm', label: 'Тёплый' }, { v: 'cold', label: 'Холодный' }, { v: 'cinema', label: 'Кино' }, { v: 'bw', label: 'Ч/Б' }, { v: 'vivid', label: 'Яркий' }] }],
    media: 'LUT-файл (.cube) из Галереи — заменяет пресет' },
  broll:     { label: 'Медиафайлы', icon: <Image size={18} />, hint: 'Перебивки: стоки, кадры источника (фото из блока «Новости») или свои файлы из Галереи (можно несколько)',
    choices: [{ id: 'src', label: 'Откуда брать', def: ['stock'], opts: [{ v: 'stock', label: 'Стоки' }, { v: 'source', label: 'Кадры источника' }, { v: 'reference', label: 'Свои файлы' }] }],
    text: 'что вставить и когда…', media: 'Добавить из Галереи', llm: true },
  avatar:    { label: 'Аватар', icon: <UserRound size={18} />, hint: 'Одна говорящая голова (монолог); диалог двух ведущих — облако «Подкаст»',
    choices: [
      { id: 'engine', label: 'Движок', def: ['heygen'], opts: [{ v: 'heygen', label: 'HeyGen (облако)' }, { v: 'sadtalker', label: 'SadTalker (GPU)' }] },
      { id: 'voice', label: 'Голос', def: ['female'], opts: [{ v: 'female', label: 'Женский' }, { v: 'male', label: 'Мужской' }] },
    ],
    text: 'сценарий для аватара…', media: 'Фото / аватар', llm: true },
  upscale:   { label: 'Апскейл', icon: <Maximize2 size={18} />, hint: 'Повысить чёткость',
    choices: [{ id: 'scale', label: 'Множитель', def: ['off'], opts: [{ v: 'off', label: 'Выкл' }, { v: '2', label: '2×' }, { v: '4', label: '4×' }] }] },
  export:    { label: 'Экспорт', icon: <Share2 size={18} />, hint: 'Куда выводим (можно несколько)',
    choices: [{ id: 'platforms', label: 'Площадки', multi: true, def: ['tiktok', 'reels', 'shorts'], opts: [{ v: 'tiktok', label: 'TikTok' }, { v: 'reels', label: 'Reels' }, { v: 'shorts', label: 'Shorts' }, { v: 'youtube', label: 'YouTube' }, { v: 'instagram', label: 'Inst-лента' }] }] },
};

const KIND_ORDER: MKind[] = ['news', 'research', 'length', 'format', 'silence', 'subtitles', 'audio', 'voiceover', 'color', 'broll', 'avatar', 'upscale', 'export'];

// Что делает ИИ-режиссёр (Claude), когда у узла включён ✨ЛЛМ.
const DIR_HINT: Partial<Record<MKind, string>> = {
  voiceover: 'Claude напишет сценарий по вашему брифу выше, затем Piper его озвучит.',
  research: 'Claude найдёт материал по теме в вебе — он станет опорой для озвучки.',
  news: 'Ссылка/@канал читается напрямую (текст+фото), Claude перепишет для озвучки; тема без ссылки — веб-поиск.',
  length: 'Claude выберет самый сильный момент по транскрипту и обрежет под длительность.',
  broll: 'Claude подберёт запрос для стоков (Pexels/Pixabay) по сценарию ролика.',
  avatar: 'Claude напишет сценарий по брифу — аватар его произнесёт (HeyGen или GPU).',
};

// Облачные узлы графа (перетаскиваемые): Omni Flash (генерация видео), Контент-план, Подкаст.
type CloudId = 'omni' | 'plan' | 'podcast' | 'editor';
const CLOUD: Record<CloudId, { label: string; icon: React.ReactNode; color: string; glow: string; def: { x: number; y: number } }> = {
  omni: { label: 'Omni Flash', icon: <Cloud size={24} />, color: '#4285F4', glow: 'rgba(66,133,244,.35)', def: { x: 85, y: 24 } },
  plan: { label: 'Контент-план', icon: <CalendarDays size={22} />, color: '#10b981', glow: 'rgba(16,185,129,.35)', def: { x: 85, y: 76 } },
  podcast: { label: 'Подкаст', icon: <Mic size={22} />, color: '#ec4899', glow: 'rgba(236,72,153,.35)', def: { x: 15, y: 76 } },
  editor: { label: 'Редактор', icon: <Film size={22} />, color: '#f59e0b', glow: 'rgba(245,158,11,.35)', def: { x: 15, y: 24 } },
};

// Пикер «Редактора» повторяет Галерею: те же вкладки-папки (тренды/референс/аудио/из анализа).
type EdCat = 'trends' | 'reference' | 'audio' | 'analyzed';
const ED_TABS: { key: EdCat; label: string; icon: React.ReactNode }[] = [
  { key: 'trends', label: 'Тренды', icon: <Video size={13} /> },
  { key: 'reference', label: 'Референс', icon: <Image size={13} /> },
  { key: 'audio', label: 'Аудио', icon: <Music size={13} /> },
  { key: 'analyzed', label: 'Из анализа', icon: <Sparkles size={13} /> },
];

// ── Подкаст-сцена (2 ведущих): спецификация облачного узла «Подкаст» ──
type PodVoice = 'female' | 'male';
type PodSource = 'gen' | 'diarize';   // дорожки: сгенерировать диалог / разобрать запись
type PodLayout = 'overlay' | 'topbar'; // где картинка в сплит-скрине
interface PodHost { photoUrl: string | null; photoName: string | null; voice: PodVoice; name: string }
// Анимация «выезда» картинки, прикреплённой к реплике.
type PodAnim = 'auto' | 'slide-left' | 'slide-right' | 'slide-up' | 'fade' | 'zoom';
const POD_ANIMS: { v: PodAnim; label: string }[] = [
  { v: 'auto', label: 'Авто' }, { v: 'slide-left', label: '← Слева' }, { v: 'slide-right', label: 'Справа →' },
  { v: 'slide-up', label: '↑ Снизу' }, { v: 'zoom', label: 'Зум' }, { v: 'fade', label: 'Проявление' },
];
// Реплика: спикер + текст (+ таймкоды) + опц. картинка + tStart (позиция на таймлайне Фазы 2).
interface PodLine { speaker: 'A' | 'B'; text: string; start?: number; end?: number; image?: string; imageName?: string; anim?: PodAnim; tStart?: number }
interface PodCutaway { url: string; name: string }
// Анимация ведущих (говорящие головы): провайдер + версия. Стоимость зависит от провайдера.
type PodAvatarProvider = 'heygen' | 'did' | 'gpu' | 'omni';
type PodAvatarMode = 'standard' | 'iv';                 // HeyGen: стандартный движок / Avatar IV
type PodVoiceSource = 'heygen' | 'record' | 'elevenlabs'; // откуда голос для аниматора
interface PodAvatar { provider: PodAvatarProvider; mode: PodAvatarMode; voiceSource: PodVoiceSource; emotion?: string }
// Пресеты подачи/эмоции (топ-кнопки) — маппятся в эмоцию голоса HeyGen на бэке.
const POD_EMOTIONS: { v: string; label: string }[] = [
  { v: 'friendly', label: 'Дружелюбно' }, { v: 'confident', label: 'Уверенно' },
  { v: 'excited', label: 'Восторженно' }, { v: 'calm', label: 'Спокойно' }, { v: 'serious', label: 'Серьёзно' },
];
const POD_AVATARS: { v: PodAvatarProvider; label: string; quality: string; cost: string; perMin: number; note: string }[] = [
  { v: 'omni', label: 'Omni-студия', quality: '★★★★★ живая сцена + правки чатом', cost: 'ИИ-голос ~$0.10/с', perMin: 0, note: 'Omni Flash оживляет фото КАЖДОГО ведущего и правится чатом (диалоговое редактирование). Голос — синтетический (Omni). Для реального голоса из записи выберите HeyGen. Нужен Gemini-ключ.' },
  { v: 'heygen', label: 'HeyGen', quality: '★★★★★ фотореализм', cost: 'премиум', perMin: 0.6, note: 'Лучшее качество, версии 3/4/5. Нужен ключ HeyGen (Настройки → Генерация).' },
  { v: 'did', label: 'D-ID / Hedra', quality: '★★★★ хорошо', cost: 'дешевле в разы', perMin: 0.12, note: 'Говорящая голова из фото за меньшие деньги. Нужен ключ провайдера.' },
  { v: 'gpu', label: 'Наш GPU (SadTalker)', quality: '★★★ скромнее', cost: 'бесплатно', perMin: 0, note: 'Без оплаты за минуту, крутится на нашем GPU-воркере. Сейчас GPU не подключён.' },
];
// Лицо на групповом фото: бокс в долях изображения (0..1) + назначенный спикер.
interface PodFace { id: string; box: { x: number; y: number; w: number; h: number }; speaker: 'A' | 'B' }
interface PodcastSpec {
  hostA: PodHost; hostB: PodHost;
  source: PodSource; brief: string; dialogue: PodLine[];
  recordingUrl: string | null; recordingName: string | null;
  cutaways: PodCutaway[]; layout: PodLayout; segSec: number; platforms: string[];
  // Фаза 1 «Студия лиц»: групповое фото → детекция/разметка лиц → кадры-ракурсы.
  groupPhotoUrl: string | null; groupPhotoName: string | null; faces: PodFace[];
  // Фаза 2 «Таймлайн»: режим наложения дорожек (микс в воркере по tStart реплик).
  timeline?: boolean;
  // Анимация ведущих (говорящие головы): выбор провайдера/версии.
  avatar?: PodAvatar;
  // Фоновая музыка на весь ролик (генерим/загружаем): url + громкость % (обрезается по длине видео).
  music?: { url: string; name: string; volumePct: number } | null;
  // Результаты/статус аниматора — сохраняются в спеку, чтобы пережить выход/вход в сценарий.
  animActive?: { kind: 'omnipod' | 'heygen'; jobId?: string; videoIds?: string[] } | null;
  animResult?: { host: string; name: string; videoId: string; url: string | null; interactionId?: string | null }[] | null;
  // Фон студии для «Собрать НА студии»: clean plate (студия без людей), выживает выход/вход.
  studioBgUrl?: string | null;
  // Окна ведущих в долях исходного фото — посадка аватаров на свои места при склейке.
  studioPlace?: { A?: { x: number; y: number; w: number; h: number }; B?: { x: number; y: number; w: number; h: number } } | null;
}
const POD_DEFAULT: PodcastSpec = {
  hostA: { photoUrl: null, photoName: null, voice: 'female', name: 'Ведущий A' },
  hostB: { photoUrl: null, photoName: null, voice: 'male', name: 'Ведущий B' },
  source: 'gen', brief: '', dialogue: [],
  recordingUrl: null, recordingName: null,
  cutaways: [], layout: 'overlay', segSec: 0, platforms: ['tiktok', 'reels', 'shorts'],
  groupPhotoUrl: null, groupPhotoName: null, faces: [],
  timeline: false,
  avatar: { provider: 'heygen', mode: 'iv', voiceSource: 'heygen', emotion: 'friendly' },
  music: null,
};

// ── Преобразование исходного видео по таймлайну (узел Omni Flash) ──
// engine: 'omni' — сгенерировать новый клип (Veo 3.1, 4/6/8с, текст/кадр→видео);
//         'v2v'  — ре-стайл реального фрагмента (Runway Gen-4 / FAL-Kling).
type OmniEngine = 'omni' | 'v2v';
type V2VProvider = 'runway' | 'fal';
// Окно на ленте исходника. Длина = ширина окна (Omni Flash преобразует 10с за проход).
// Левый край окна = первый кадр, правый край = последний кадр для kadr→видео.
interface OmniSeg {
  id: string;
  start: number;          // доля таймлайна 0..1 (левый край / первый кадр)
  end: number;            // доля таймлайна 0..1 (правый край / последний кадр)
  engine: OmniEngine;
  prompt: string;         // «как преобразовать»
  seedFrame: boolean;     // (устар.) — заменён явным startFrame
  startFrame?: string | null; // omni: URL старт-кадра (первый кадр для image_to_video) — #3
  genJobId?: string | null;         // активная задача Omni (возобновляем поллинг после выхода/входа в сценарий)
  genUrl?: string | null;           // готовый клип — превью выживает выход/вход
  genInteractionId?: string | null; // interactionId готового клипа (для чат-правок)
  provider: V2VProvider;  // engine=v2v: чем ре-стайлить
}
interface OmniSpec { segments: OmniSeg[]; }
let omniSeq = 0;
const OMNI_MAX_SEC = 10;  // Omni Flash преобразует 10с за один проход
const newSeg = (start: number, end: number): OmniSeg =>
  ({ id: `seg${++omniSeq}`, start, end, engine: 'omni', prompt: '', seedFrame: true, provider: 'runway' });
const OMNI_DEFAULT: OmniSpec = { segments: [newSeg(0, 0.2)] };
const V2V_LABEL: Record<V2VProvider, string> = { runway: 'Runway Gen-4', fal: 'Kling (FAL)' };

/** Узел пресета: kind или kind с готовыми настройками (кнопки/текст/✨). */
type PresetNode = MKind | { kind: MKind; choices?: Record<string, string[]>; text?: string; llm?: boolean };
interface Preset { name: string; kinds: PresetNode[]; }
// Порядок узлов = порядок применения: Формат ДО титров (кроп не отрежет вшитые
// субтитры), титры ПОСЛЕ озвучки (транскрибируют голос), музыка — после титров.
const NEWS_CHAIN = (type: string): PresetNode[] => [
  { kind: 'news', choices: { type: [type] }, llm: true },
  { kind: 'voiceover', llm: true }, 'format', { kind: 'broll', llm: true }, 'subtitles', 'audio', 'export',
];
const PRESET_GROUPS: { group: string; presets: Preset[] }[] = [
  { group: 'Новости', presets: [
    { name: 'Новости из RSS', kinds: NEWS_CHAIN('rss') },
    { name: 'Из Telegram-канала', kinds: NEWS_CHAIN('telegram') },
    { name: 'С сайта (рубрика)', kinds: NEWS_CHAIN('site') },
  ] },
  { group: 'Короткие ролики', presets: [
    { name: 'Клип-фабрика', kinds: ['length', 'format', 'silence', 'subtitles', 'audio', 'export'] },
    { name: 'Лучший момент → шортс', kinds: [{ kind: 'length', choices: { duration: ['best'] }, llm: true }, 'format', 'subtitles', 'audio', 'export'] },
    { name: 'Reels-нарезка', kinds: [{ kind: 'length', choices: { duration: ['15'] } }, 'format', 'silence', { kind: 'color', choices: { preset: ['vivid'] } }, 'subtitles', 'export'] },
  ] },
  { group: 'Говорящие', presets: [
    { name: 'Говорящая голова', kinds: ['length', 'format', 'color', 'subtitles', 'audio', 'export'] },
    { name: 'Аватар-спикер', kinds: [{ kind: 'research', llm: true }, { kind: 'avatar', llm: true }, 'subtitles', 'audio', 'export'] },
    { name: 'UGC-отзыв', kinds: [{ kind: 'avatar', llm: true }, 'subtitles', 'audio', 'export'] },
  ] },
  { group: 'Постановочные', presets: [
    { name: 'Кинематик', kinds: ['length', { kind: 'format', choices: { orient: ['21:9'] } }, { kind: 'color', choices: { preset: ['cinema'] } }, 'audio', 'export'] },
    { name: 'Объяснитель', kinds: [{ kind: 'research', llm: true }, { kind: 'voiceover', llm: true }, 'format', { kind: 'broll', llm: true }, 'subtitles', 'audio', 'export'] },
    { name: 'Документалка', kinds: ['length', { kind: 'format', choices: { orient: ['16:9'] } }, { kind: 'broll', llm: true }, { kind: 'color', choices: { preset: ['cinema'] } }, 'audio', 'export'] },
  ] },
  { group: 'Сервисные', presets: [
    { name: 'Скрин-демо', kinds: ['length', 'silence', 'subtitles', 'audio', 'export'] },
    { name: 'Дубляж', kinds: ['voiceover', 'subtitles', 'export'] },
    { name: 'Гибрид', kinds: ['length', 'format', { kind: 'broll', llm: true }, 'subtitles', 'audio', 'export'] },
  ] },
];

let _seq = 0;
const newId = () => `m${Date.now().toString(36)}${(_seq++).toString(36)}`;
function newNode(kind: MKind): MNode {
  const choices: Record<string, string[]> = {};
  (META[kind].choices || []).forEach((c) => { choices[c.id] = [...c.def]; });
  return { id: newId(), kind, text: '', mediaUrl: null, mediaName: null, useLlm: false, choices };
}
function hydrate(kind: MKind, choices: any): Record<string, string[]> {
  const out: Record<string, string[]> = { ...(choices && typeof choices === 'object' ? choices : {}) };
  (META[kind]?.choices || []).forEach((c) => { if (!Array.isArray(out[c.id])) out[c.id] = [...c.def]; });
  return out;
}

/** Краткая сводка выбранных параметров узла (для мелкой подписи под кружком). */
function nodeSummary(n: MNode): string {
  const parts: string[] = [];
  (META[n.kind].choices || []).forEach((c) => {
    const labels = (n.choices[c.id] || [])
      .map((v) => c.opts.find((o) => o.v === v)?.label)
      .filter((x): x is string => !!x && x !== 'Без' && x !== 'Не трогать' && x !== 'Выкл');
    if (labels.length) parts.push(labels.join(', '));
  });
  if (n.useLlm) parts.unshift('✨ИИ');
  const s = parts.join(' · ');
  return s.length > 40 ? s.slice(0, 39) + '…' : s;
}

// ── ДНК тренда (Фаза 2): автозаполнение блоков из сохранённого анализа ──────────
interface DnaBeat { t: number; desc: string; intensity?: 'low' | 'mid' | 'high' }
interface TrendDNA {
  hookType: string; whyItWorks: string; targetAudience: string; viralFactors: string[];
  copyReadyScript: string; howToAdapt: string[];
  summary: string; sceneBeats: DnaBeat[]; hookAnalysis: string; visualStyle: string;
  audioDialogue: string; whyResonates: string[]; howToReplicate: string[];
  keywords: string[]; brief: string;
  meta?: { platform?: string; author?: string; durationSec?: number; music?: string };
  quality?: { lufs?: number; brightness?: number; vqScore?: number; originW?: number; originH?: number; needUpscale?: boolean };
  benchmark?: { engagementRate?: number; likeRate?: number; saveRate?: number };
}
const secToClock = (sec: number) => { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; };

function dnaDuration(sec?: number): string {
  if (!sec || sec <= 0) return '30';
  if (sec <= 20) return '15';
  if (sec <= 45) return '30';
  return '60';
}
function dnaColorPreset(style: string): string {
  const s = (style || '').toLowerCase();
  if (/ярк|насыщ|vivid|bright|колор/.test(s)) return 'vivid';
  if (/тёпл|тепл|warm|закат|золот/.test(s)) return 'warm';
  if (/холод|cold|синий|blue/.test(s)) return 'cold';
  if (/кино|cinema|cinematic|плён|плен|\bfilm/.test(s)) return 'cinema';
  if (/ч\/б|чёрно|черно|\bbw\b|monochrome|black.?and.?white/.test(s)) return 'bw';
  return 'none';
}
function dnaPlatforms(platform?: string): string[] {
  switch (platform) {
    case 'instagram': return ['reels', 'instagram'];
    case 'youtube': return ['shorts', 'youtube'];
    case 'tiktok': return ['tiktok'];
    default: return ['tiktok', 'reels', 'shorts'];
  }
}
/** Создаёт узел заданного типа с переопределением текста/ЛЛМ/одиночных выборов. */
function mkNode(kind: MKind, over: { text?: string; useLlm?: boolean; choices?: Record<string, string> }): MNode {
  const n = newNode(kind);
  if (over.text != null) n.text = over.text;
  if (over.useLlm != null) n.useLlm = over.useLlm;
  if (over.choices) for (const [k, v] of Object.entries(over.choices)) n.choices[k] = [v];
  return n;
}
/** Раскладывает ДНК тренда по блокам TrendFlow + отдаёт скомпилированный бриф. */
function dnaToGraph(d: TrendDNA): { nodes: MNode[]; brief: string } {
  const kw = (d.keywords || []).slice(0, 8).join(', ');
  const beats = (d.sceneBeats || []).filter((b) => Number.isFinite(b.t));

  // Длина: из тайм-кодов сцен — реальный диапазон нарезки (его читает video_trimmer);
  // нет тайм-кодов → отдаём пресет длительности + ЛЛМ «лучший момент».
  let lenText = ''; let lenLlm = true;
  if (beats.length) {
    const start = Math.max(0, Math.floor(Math.min(...beats.map((b) => b.t))));
    let end = Math.ceil(Math.max(...beats.map((b) => b.t)));
    if (d.meta?.durationSec) end = Math.min(Math.ceil(d.meta.durationSec), end + 1);
    if (end <= start) end = start + (d.meta?.durationSec ? Math.ceil(d.meta.durationSec) : 15);
    lenText = `${secToClock(start)}–${secToClock(end)}`; lenLlm = false;
  }

  // B-roll: тема (ключи) + тайминг вставок по ритму оригинала.
  const brollBits: string[] = [];
  if (kw) brollBits.push(`Вставки по теме: ${kw}`);
  if (beats.length >= 2) brollBits.push(`Тайминг по ритму: ${beats.slice(0, 4).map((b) => secToClock(b.t)).join(', ')}`);

  const nodes: MNode[] = [
    mkNode('length', { useLlm: lenLlm, choices: { duration: dnaDuration(d.meta?.durationSec) }, text: lenText }),
    mkNode('format', { choices: { orient: '9:16' } }),
    mkNode('voiceover', {
      text: d.copyReadyScript || '',
      useLlm: !d.copyReadyScript,        // есть готовый скрипт → читаем как есть; нет → пишет Claude по брифу
      choices: { voice: 'female' },
    }),
    // B-roll ДО титров (перебивки не закрывают вшитый текст), титры ПОСЛЕ озвучки.
    mkNode('broll', { useLlm: true, choices: { src: 'stock' },
      text: brollBits.join(' · ') || (d.howToReplicate || []).slice(0, 2).join('; ') }),
    mkNode('subtitles', { choices: { style: 'word' } }),
    mkNode('audio', { choices: { vol: 'mid', duck: 'on' } }),
    mkNode('color', { choices: { preset: dnaColorPreset(d.visualStyle) } }),
  ];
  // Апскейл — только если оригинал низкого качества / <1080p (GPU-шаг, добавляем по делу).
  if (d.quality?.needUpscale) nodes.push(mkNode('upscale', { choices: { scale: '2' } }));
  const exportNode = newNode('export');
  exportNode.choices.platforms = dnaPlatforms(d.meta?.platform); // мультивыбор площадок
  nodes.push(exportNode);
  return { nodes, brief: d.brief || '' };
}

export default function MontageEditor({ flowId, onBack, isNew }: { flowId: string; onBack: () => void; isNew?: boolean }) {
  const token = useAppStore((s) => s.token);
  const headers = useCallback((): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  const [name, setName] = useState('Сценарий');
  const [brief, setBrief] = useState('');          // главный промт: общий сценарий ролика (для ИИ-режиссёра)
  const [showBrief, setShowBrief] = useState(false);
  const [nodes, setNodes] = useState<MNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [addOpen, setAddOpen] = useState(false); // нижнее поле «Добавить»: свёрнуто/раскрыто
  const [showPresets, setShowPresets] = useState(false);
  const [attachFor, setAttachFor] = useState<string | null>(null);
  const [media, setMedia] = useState<{ id: string; fileUrl: string; title: string; kind: string; folder: 'trends' | 'reference' | 'audio' | 'analyzed'; cover?: string }[]>([]);
  const [imgPick, setImgPick] = useState<string | null>(null);   // #3: segId, для которого выбираем старт-кадр из галереи картинок
  const [imgPickQ, setImgPickQ] = useState('');
  const imgUploadRef = useRef<HTMLInputElement | null>(null);
  const [podPickTab, setPodPickTab] = useState<'all' | 'trends' | 'reference' | 'audio' | 'analyzed'>('all'); // вкладка-папка в пикере
  const [podPickQ, setPodPickQ] = useState(''); // поиск в пикере
  const [uploading, setUploading] = useState(false);   // загрузка медиа с устройства
  const [dragOver, setDragOver] = useState(false);     // подсветка зоны drag-and-drop
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildJob, setBuildJob] = useState<any | null>(null);
  const [buildMinimized, setBuildMinimized] = useState(false); // свернуть прогресс → рендер в фоне
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [sources, setSources] = useState<{ url: string; name: string; thumb?: string; type: string; assetId?: string }[]>([]);
  const [srcUploading, setSrcUploading] = useState(false);   // загрузка своего видео прямо в пикер источника
  const srcUploadRef = useRef<HTMLInputElement | null>(null);
  const [srcTab, setSrcTab] = useState<'all' | 'analyzed' | 'trend' | 'reference'>('all'); // вкладка-папка пикера источника
  const [srcQuery, setSrcQuery] = useState('');
  // ДНК тренда (Фаза 2): анализ выбранного источника + панель автозаполнения блоков.
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null);
  const [dna, setDna] = useState<TrendDNA | null>(null);
  const [dnaLoading, setDnaLoading] = useState(false);
  const [showDnaPanel, setShowDnaPanel] = useState(false);
  // Пакетная сборка: выбор нескольких источников → по ролику на каждый (одна цепочка блоков).
  const [picked, setPicked] = useState<{ url: string; name: string; assetId?: string }[]>([]);
  const [batchJobs, setBatchJobs] = useState<{ source: string; job: any }[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [batchMinimized, setBatchMinimized] = useState(false);
  const [batchNote, setBatchNote] = useState<string | null>(null);
  // Облачные узлы (Omni / Контент-план): позиции (%), связи-стрелки, режим связывания, панель.
  const [cloud, setCloud] = useState<Record<CloudId, { x: number; y: number }>>({ omni: { ...CLOUD.omni.def }, plan: { ...CLOUD.plan.def }, podcast: { ...CLOUD.podcast.def }, editor: { ...CLOUD.editor.def } });
  const [cloudEdges, setCloudEdges] = useState<{ from: string; to: string }[]>([]);
  const [pending, setPending] = useState<{ from: string; x: number; y: number } | null>(null); // тянем стрелку
  const pendingRef = useRef<{ from: string; x: number; y: number } | null>(null);
  const [cloudPanel, setCloudPanel] = useState<CloudId | null>(null);
  // Облако «Редактор»: выбранные видео-клипы, результат склейки, открытый просмотрщик, инлайн-пикер.
  const [editorClips, setEditorClips] = useState<{ url: string; name: string; type?: 'video' | 'audio' }[]>([]);
  const [editorResult, setEditorResult] = useState<{ url: string; name: string; type?: 'video' | 'audio' } | null>(null);
  const [editorView, setEditorView] = useState<{ url: string; name: string; type?: 'video' | 'audio' } | null>(null);
  const [editorPick, setEditorPick] = useState(false);
  const [editorGallery, setEditorGallery] = useState<{ url: string; name: string; cover?: string; type: 'video' | 'audio'; cat: EdCat }[]>([]);
  const [editorGalLoading, setEditorGalLoading] = useState(false);
  const [editorMerging, setEditorMerging] = useState(false);
  const [editorNote, setEditorNote] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<EdCat>('analyzed'); // вкладка пикера (как в Галерее)
  const [editorQuery, setEditorQuery] = useState('');            // поиск в пикере
  const [editorUploading, setEditorUploading] = useState(false); // загрузка «Медиа»/«Аудио» в пикере
  const edMediaInputRef = useRef<HTMLInputElement | null>(null);
  const edAudioInputRef = useRef<HTMLInputElement | null>(null);
  // Omni: спецификация преобразования исходного видео по таймлайну.
  const [omniSpec, setOmniSpec] = useState<OmniSpec>(OMNI_DEFAULT);
  // Omni Flash: генерация/правка видео по каждому сегменту (segId → состояние).
  const [omniGen, setOmniGen] = useState<Record<string, { busy?: boolean; note?: string | null; url?: string | null; interactionId?: string | null; edit?: string; sbBusy?: boolean; fbBusy?: boolean; frames?: string[]; seed?: string | null }>>({});
  const omniPollRef = useRef<Record<string, number>>({});
  // Omni-лента: перетаскивание окна (тело=сдвиг, края=длина) + живой предпросмотр исходника.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const srcVideoRef = useRef<HTMLVideoElement | null>(null);
  const omniDragRef = useRef<null | { id: string; handle: 'move' | 'start' | 'end'; s0: number; e0: number; x0: number }>(null);
  // Подкаст: спецификация сцены (2 ведущих) + UI-состояния панели.
  const [pod, setPod] = useState<PodcastSpec>(POD_DEFAULT);
  const [podBusy, setPodBusy] = useState<null | 'dialogue' | 'diarize' | 'upload' | 'detect' | 'apply'>(null);
  const [podNote, setPodNote] = useState<string | null>(null);
  const [animBusy, setAnimBusy] = useState(false);          // идёт рендер говорящих голов
  const [animNote, setAnimNote] = useState<string | null>(null);
  const [animJobs, setAnimJobs] = useState<{ host: string; name: string; videoId: string; status?: string; url?: string | null; interactionId?: string | null; edit?: string; editing?: boolean }[]>([]);
  const [studioBg, setStudioBg] = useState<string | null>(null); // HeyGen «на студии»: фон-фото студии для compose-studio (chroma-key)
  const animPollRef = useRef<number | null>(null);
  // Компонент жив? Опросы переустанавливают setTimeout ПОСЛЕ await fetch — clearTimeout в cleanup
  // снимает только уже запланированный таймер, и без этого флага цикл «воскресал» после unmount.
  const pollAliveRef = useRef(true);
  const [composeBusy, setComposeBusy] = useState(false);       // склейка сплит-скрина
  const [composeNote, setComposeNote] = useState<string | null>(null);
  const [composeUrl, setComposeUrl] = useState<string | null>(null);
  const composePollRef = useRef<number | null>(null);
  const [podPick, setPodPick] = useState<null | 'hostA' | 'hostB' | 'cutaway' | 'recording' | 'group' | 'lineimg' | 'music'>(null);
  const [podLineIdx, setPodLineIdx] = useState<number | null>(null); // реплика, к которой прикрепляем картинку
  const [loadDlgOpen, setLoadDlgOpen] = useState(false);  // модал «Загрузить диалог» (текст/JSON/из Исследования)
  const [loadDlgText, setLoadDlgText] = useState('');
  const podPickInputRef = useRef<HTMLInputElement | null>(null);
  // «Студия лиц»: рисование боксов поверх группового фото.
  const faceWrapRef = useRef<HTMLDivElement | null>(null);
  const [drawBox, setDrawBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  // AI-ракурсы студии: кастомный промт, своя картинка-вход (с диска), сгенерированные превью.
  const [angleBusy, setAngleBusy] = useState<string | null>(null);
  const [anglePromptText, setAnglePromptText] = useState('');
  const [podAngles, setPodAngles] = useState<{ url: string; preset: string }[]>([]);
  const [angleSrc, setAngleSrc] = useState<{ url: string; name: string } | null>(null); // своя картинка-вход (иначе групповое фото)
  const angleInputRef = useRef<HTMLInputElement | null>(null);
  const [nameEdit, setNameEdit] = useState(false); // инлайн-редактирование имени сценария
  const [diarizeDone, setDiarizeDone] = useState(false); // разбор записи завершён → мигающий кружок на узле «Подкаст»
  const [srcDuration, setSrcDuration] = useState<number>(0);
  const [lenSel, setLenSel] = useState<{ start: number; end: number }>({ start: 0, end: 1 }); // отрезок в узле «Длина»
  const [exporting, setExporting] = useState(false); // имитация передачи в API площадок
  const [exportPct, setExportPct] = useState(0);
  const [connected, setConnected] = useState<Set<string>>(new Set()); // подключённые аккаунты площадок (мок до этапа C)
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<CloudId | null>(null);
  const movedRef = useRef(false);

  const update = (fn: (n: MNode[]) => MNode[]) => { setNodes((prev) => fn(prev)); setDirty(true); };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/flows/${flowId}`, { headers: headers() });
        const d = await res.json();
        if (res.ok && d.flow) {
          setName(d.flow.name || 'Сценарий');
          if (typeof d.flow.graph?.brief === 'string') setBrief(d.flow.graph.brief);
          const g = d.flow.graph?.nodes || [];
          const mapped: MNode[] = g.filter((x: any) => x?.type === 'montage' && x?.data?.kind && META[x.data.kind as MKind])
            .map((x: any) => ({ id: x.id, kind: x.data.kind, text: x.data.text || '', mediaUrl: x.data.mediaUrl || null, mediaName: x.data.mediaName || null,
              medias: Array.isArray(x.data.medias) ? x.data.medias.filter((m: any) => m?.url) : [],
              useLlm: !!x.data.useLlm, choices: hydrate(x.data.kind, x.data.choices) }));
          setNodes(mapped);
          const src = d.flow.graph?.source;
          if (src && typeof src.url === 'string') {
            setSourceUrl(src.url); setSourceName(src.name || 'видео');
            if (typeof src.assetId === 'string' && src.assetId) {
              setSourceAssetId(src.assetId);
              // Подтянуть сохранённую ДНК этого видео → покажем чип «Из тренда» (без авто-применения).
              try {
                const ar = await fetch(`/api/trends/media/${src.assetId}/analysis`, { headers: headers() });
                if (ar.ok) { const adn = (await ar.json()).analysis?.dna; if (adn) setDna(adn as TrendDNA); }
              } catch { /* нет анализа — не страшно */ }
            }
          }
          if (d.flow.graph?.cloud && typeof d.flow.graph.cloud === 'object') setCloud((c) => ({ ...c, ...d.flow.graph.cloud }));
          if (Array.isArray(d.flow.graph?.cloudEdges)) {
            // «Контент-план» скрыт — старые связи с ним не рисуем и не копим.
            setCloudEdges(d.flow.graph.cloudEdges.filter((e: any) => e?.from !== 'plan' && e?.to !== 'plan'));
          }
          if (d.flow.graph?.omni && typeof d.flow.graph.omni === 'object') {
            const raw = Array.isArray(d.flow.graph.omni.segments) ? d.flow.graph.omni.segments : [];
            // Нормализуем старые сохранённые сегменты (могли нести legacy lenSec/mode или битые доли).
            const clamp01 = (v: unknown, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fb);
            const norm: OmniSeg[] = raw.map((x: any) => {
              const st = clamp01(x?.start, 0);
              const en = Math.max(st + 0.01, clamp01(x?.end, Math.min(1, st + 0.2)));
              return {
                id: typeof x?.id === 'string' ? x.id : `seg${++omniSeq}`,
                start: st, end: en,
                engine: x?.engine === 'v2v' ? 'v2v' : 'omni',
                prompt: typeof x?.prompt === 'string' ? x.prompt : '',
                seedFrame: x?.seedFrame !== false,
                startFrame: typeof x?.startFrame === 'string' ? x.startFrame : null,
                genJobId: typeof x?.genJobId === 'string' ? x.genJobId : null,
                genUrl: typeof x?.genUrl === 'string' ? x.genUrl : null,
                genInteractionId: typeof x?.genInteractionId === 'string' ? x.genInteractionId : null,
                provider: x?.provider === 'fal' ? 'fal' : 'runway',
              };
            });
            setOmniSpec({ segments: norm.length ? norm : [newSeg(0, 0.2)] });
            // Гидрация Omni: вернуть превью готовых клипов и ВОЗОБНОВИТЬ поллинг активных задач (фон переживает выход/вход).
            for (const sg of norm) {
              if (sg.genUrl) setOG(sg.id, { url: sg.genUrl, interactionId: sg.genInteractionId || null, note: 'Готово · в Галерее' });
              else if (sg.genJobId) { setOG(sg.id, { busy: true, note: 'Возобновляю…' }); pollOmni(sg.id, sg.genJobId); }
            }
          }
          if (d.flow.graph?.podcast && typeof d.flow.graph.podcast === 'object') {
            const pp = d.flow.graph.podcast;
            setPod({
              ...POD_DEFAULT, ...pp,
              hostA: { ...POD_DEFAULT.hostA, ...(pp.hostA || {}) },
              hostB: { ...POD_DEFAULT.hostB, ...(pp.hostB || {}) },
              dialogue: Array.isArray(pp.dialogue) ? pp.dialogue : [],
              cutaways: Array.isArray(pp.cutaways) ? pp.cutaways : [],
              faces: Array.isArray(pp.faces) ? pp.faces : [],
            });
          }
          if (d.flow.graph?.editor && typeof d.flow.graph.editor === 'object') {
            const ed = d.flow.graph.editor;
            if (Array.isArray(ed.clips)) setEditorClips(ed.clips.filter((c: any) => c && typeof c.url === 'string').map((c: any) => ({ url: c.url, name: c.name || 'видео', type: c.type === 'audio' ? 'audio' : 'video' })));
            if (ed.result && typeof ed.result.url === 'string') setEditorResult({ url: ed.result.url, name: ed.result.name || 'Результат', type: ed.result.type === 'audio' ? 'audio' : 'video' });
          }
          if (mapped.length === 0 && isNew) setShowPresets(true); // пресеты — только для НОВОГО сценария
        }
      } catch { /* пусто */ }
      finally { setLoading(false); }
    })();
  }, [flowId, headers]);

  const save = async () => {
    setSaving(true);
    try {
      const graphNodes = nodes.map((n, i) => ({ id: n.id, type: 'montage', position: { x: i, y: 0 }, data: { kind: n.kind, text: n.text, mediaUrl: n.mediaUrl, mediaName: n.mediaName, medias: n.medias || [], useLlm: n.useLlm, choices: n.choices } }));
      const source = sourceUrl ? { url: sourceUrl, name: sourceName || undefined, assetId: sourceAssetId || undefined } : null;
      await fetch(`/api/flows/${flowId}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ name, graph: { nodes: graphNodes, edges: [], source, cloud, cloudEdges, omni: omniSpec, podcast: pod, editor: { clips: editorClips, result: editorResult }, brief } }) });
      setDirty(false);
    } catch { /* */ }
    finally { setSaving(false); }
  };
  // Авто-сохранение: любые правки (в т.ч. вся спека «Подкаста») сохраняются сами через ~1.6с —
  // выйдешь и вернёшься в сценарий → всё на месте. Ничего не теряется без кнопки «Сохранить».
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    if (!dirty || loading) return;
    const t = window.setTimeout(() => { void saveRef.current(); }, 1600);
    return () => clearTimeout(t);
  }, [dirty, loading]);

  // ── Undo/Redo: история снимков редактируемого «документа» ──────────────────────
  const histRef = useRef<{ stack: string[]; idx: number }>({ stack: [], idx: -1 });
  const restoringRef = useRef(false);
  const [, setHistTick] = useState(0);
  const docSnap = useCallback((): string => JSON.stringify({
    name, brief, nodes, pod,
    // volatile gen-поля (genJobId/genUrl/genInteractionId) НЕ в undo-историю: их пишет фоновый поллинг, а не юзер.
    omniSpec: { segments: omniSpec.segments.map(({ genJobId, genUrl, genInteractionId, ...s }) => s) },
    cloud, cloudEdges, sourceUrl, sourceName, sourceAssetId,
  }), [name, brief, nodes, pod, omniSpec, cloud, cloudEdges, sourceUrl, sourceName, sourceAssetId]);
  const applyDoc = (s: string) => {
    let d: any; try { d = JSON.parse(s); } catch { return; }
    restoringRef.current = true;
    setName(d.name); setBrief(d.brief); setNodes(d.nodes); setPod(d.pod);
    // omniSpec в истории без gen-полей → возвращаем их из ТЕКУЩЕГО состояния по id (не теряем активную задачу/превью).
    setOmniSpec((cur) => {
      const genById = new Map(cur.segments.map((sg) => [sg.id, { genJobId: sg.genJobId ?? null, genUrl: sg.genUrl ?? null, genInteractionId: sg.genInteractionId ?? null }]));
      const segs: OmniSeg[] = Array.isArray(d.omniSpec?.segments)
        ? d.omniSpec.segments.map((sg: any) => ({ ...sg, ...(genById.get(sg.id) || {}) }))
        : cur.segments;
      return { segments: segs };
    });
    setCloud(d.cloud); setCloudEdges(d.cloudEdges);
    setSourceUrl(d.sourceUrl); setSourceName(d.sourceName); setSourceAssetId(d.sourceAssetId);
    setDirty(true);
  };
  // захват снимка при изменениях (дебаунс; пропускаем, если это восстановление undo/redo).
  useEffect(() => {
    if (restoringRef.current) { restoringRef.current = false; return; }
    const h = setTimeout(() => {
      const snap = docSnap();
      const st = histRef.current;
      if (st.stack[st.idx] === snap) return;
      st.stack = st.stack.slice(0, st.idx + 1);
      st.stack.push(snap);
      if (st.stack.length > 120) st.stack.shift();
      st.idx = st.stack.length - 1;
      setHistTick((t) => t + 1);
    }, 350);
    return () => clearTimeout(h);
  }, [docSnap]);
  const undo = () => { const st = histRef.current; if (st.idx > 0) { st.idx -= 1; applyDoc(st.stack[st.idx]); setHistTick((t) => t + 1); } };
  const redo = () => { const st = histRef.current; if (st.idx < st.stack.length - 1) { st.idx += 1; applyDoc(st.stack[st.idx]); setHistTick((t) => t + 1); } };
  const canUndo = histRef.current.idx > 0;
  const canRedo = histRef.current.idx < histRef.current.stack.length - 1;
  // Ctrl/Cmd+Z — назад, Ctrl/Cmd+Shift+Z — вперёд (не мешаем, когда курсор в поле ввода).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Omni: редактирование спецификации преобразования ──
  const omniMutate = (fn: (s: OmniSpec) => OmniSpec) => { setOmniSpec((s) => fn(s)); setDirty(true); };
  // ── Omni Flash: генерация видео (Gemini Interactions API) ──
  const setOG = (id: string, patch: Partial<{ busy: boolean; note: string | null; url: string | null; interactionId: string | null; edit: string; sbBusy: boolean; fbBusy: boolean; frames: string[]; seed: string | null }>) =>
    setOmniGen((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  /** Раскадровка через Nano Banana 2 Lite — дешёвые кадры ДО дорогой видео-генерации. */
  const runStoryboard = async (g: OmniSeg) => {
    if (omniGen[g.id]?.sbBusy) return;
    if (!g.prompt.trim()) { setOG(g.id, { note: 'Впишите промт для раскадровки.' }); return; }
    setOG(g.id, { sbBusy: true, note: null });
    try {
      const res = await fetch('/api/render/omni/storyboard', { method: 'POST', headers: headers(), body: JSON.stringify({ prompt: g.prompt, count: 3 }) });
      const d = await res.json();
      if (!res.ok || !Array.isArray(d.frames) || !d.frames.length) { setOG(g.id, { sbBusy: false, note: d?.error || 'Не удалось сделать раскадровку.' }); return; }
      setOG(g.id, { sbBusy: false, frames: d.frames.map((f: any) => f.url), note: d.note });
    } catch { setOG(g.id, { sbBusy: false, note: 'Ошибка сети при раскадровке.' }); }
  };
  /** Понятное объяснение ошибок Omni/Nano — частый кейс это фильтр контента Gemini (400 Input blocked). */
  const friendlyOmniError = (raw?: string | null): string => {
    const s = (raw || '').toLowerCase();
    if (/input blocked|prohibited|could not be processed|not be processed|safety|content polic|deepfake|blocked/.test(s)) {
      return '⚠️ Gemini заблокировал запрос (фильтр контента). Чаще всего дело в «жёстком» промте (взрыв/насилие/оружие) или запрещённой теме — реже в связке «реальный человек + такое действие». Смягчите формулировку (напр. «бутылка эффектно раскрывается брызгами»); один реальный кадр-лицо сам по себе обычно проходит.';
    }
    return raw || 'Не удалось сгенерировать.';
  };
  const pollOmni = (id: string, jobId: string) => {
    const tick = async () => {
      try {
        const res = await fetch('/api/render/omni/status?jobId=' + jobId, { headers: headers() });
        if (res.status === 404) {  // задача пропала (сервер перезапустился) → мягко; готовый клип мог сохраниться в Галерею
          setOG(id, { busy: false, note: 'Прошлая генерация не найдена (сервер мог перезапуститься). Готовый клип ищите в Галерее.' });
          updateSeg(id, { genJobId: null });
          return;
        }
        const d = await res.json();
        if (res.ok && d.status && d.status !== 'processing') {
          if (d.status === 'done' && d.fileUrl) {
            setOG(id, { busy: false, url: d.fileUrl, interactionId: d.interactionId, note: `Готово${d.costUsd ? ` · ~$${d.costUsd}` : ''}${d.seconds ? ` · ${d.seconds}с` : ''} · в Галерее` });
            updateSeg(id, { genJobId: null, genUrl: d.fileUrl, genInteractionId: d.interactionId || null });  // результат → переживёт выход/вход
          } else {
            setOG(id, { busy: false, note: friendlyOmniError(d.error) });
            updateSeg(id, { genJobId: null });
          }
          return;
        }
      } catch { /* ретрай */ }
      omniPollRef.current[id] = window.setTimeout(tick, 6000);
    };
    tick();
  };
  const runOmniGen = async (g: OmniSeg) => {
    if (omniGen[g.id]?.busy) return;
    if (!g.prompt.trim()) { setOG(g.id, { note: 'Впишите промт «как сгенерировать».' }); return; }
    if (omniPollRef.current[g.id]) clearTimeout(omniPollRef.current[g.id]);
    setOG(g.id, { busy: true, note: null, url: null, interactionId: null });
    try {
      let seed = g.startFrame || omniGen[g.id]?.seed || undefined; // старт-кадр (#3) / кадр раскадровки
      // КОНТЕКСТ ВИДЕО: старт-кадр не задан вручную → берём кадр из ВЫДЕЛЕННОГО фрагмента (позиция окна).
      // Omni оживит реальный кадр сцены по промту (сохранит контекст), а не сгенерит клип с нуля.
      if (!seed && g.engine === 'omni' && sourceUrl && srcDuration > 0) {
        setOG(g.id, { note: `Беру кадр ${(g.start * srcDuration).toFixed(1)}с из выделенного фрагмента как контекст…` });
        try {
          const fr = await fetch('/api/render/omni/frame', { method: 'POST', headers: headers(), body: JSON.stringify({ videoUrl: sourceUrl, timeSec: g.start * srcDuration }) });
          const fd = await fr.json();
          if (fr.ok && fd.url) seed = fd.url;
        } catch { /* кадр не вышел — уйдём в текст→видео */ }
      }
      const res = await fetch('/api/render/omni/generate', { method: 'POST', headers: headers(), body: JSON.stringify({ prompt: g.prompt, aspect: '9:16', imageUrl: seed }) });
      const d = await res.json();
      if (!res.ok || !d.jobId) { setOG(g.id, { busy: false, note: d?.error ? friendlyOmniError(d.error) : 'Omni Flash недоступен.' }); return; }
      setOG(g.id, { note: d.note });
      updateSeg(g.id, { genJobId: d.jobId, genUrl: null, genInteractionId: null });  // активная задача → переживёт выход/вход
      pollOmni(g.id, d.jobId);
    } catch { setOG(g.id, { busy: false, note: 'Ошибка сети при генерации.' }); }
  };
  const runOmniEdit = async (g: OmniSeg) => {
    const st = omniGen[g.id]; if (!st?.interactionId || st.busy) return;
    const editPrompt = (st.edit || '').trim(); if (!editPrompt) return;
    if (omniPollRef.current[g.id]) clearTimeout(omniPollRef.current[g.id]);
    setOG(g.id, { busy: true, note: null });
    try {
      const res = await fetch('/api/render/omni/edit', { method: 'POST', headers: headers(), body: JSON.stringify({ previousInteractionId: st.interactionId, prompt: editPrompt, aspect: '9:16' }) });
      const d = await res.json();
      if (!res.ok || !d.jobId) { setOG(g.id, { busy: false, note: d?.error ? friendlyOmniError(d.error) : 'Ошибка правки.' }); return; }
      setOG(g.id, { note: d.note, edit: '' });
      updateSeg(g.id, { genJobId: d.jobId, genUrl: null, genInteractionId: null });  // правка = новая задача; старый результат сбрасываем, иначе гидрация не возобновит её
      pollOmni(g.id, d.jobId);
    } catch { setOG(g.id, { busy: false, note: 'Ошибка сети при правке.' }); }
  };
  const updateSeg = (id: string, patch: Partial<OmniSeg>) =>
    omniMutate((s) => ({ ...s, segments: s.segments.map((g) => g.id === id ? { ...g, ...patch } : g) }));
  const addSegment = (startFrame?: string | null): string | null => {
    const s = omniSpec;                                                   // committed состояние на момент клика
    if (s.segments.length >= 6) return null;
    const maxEnd = s.segments.reduce((m, x) => Math.max(m, x.end), 0);    // правый край самого правого окна
    const gap = s.segments.length ? 0.01 : 0;
    const free = 1 - (maxEnd + gap);                                      // свободный хвост справа
    const minW = srcDuration > 0 ? Math.min(0.5, srcDuration) / srcDuration : 0.03;
    if (free < minW) return null;                                         // места нет — окно не добавляем
    const w = Math.min(free, srcDuration > 0 ? Math.min(0.2, OMNI_MAX_SEC / srcDuration) : 0.2);
    const start = s.segments.length ? maxEnd + gap : 0;
    const seg: OmniSeg = { ...newSeg(start, Math.min(1, start + w)), startFrame: startFrame ?? null };
    omniMutate((prev) => ({ ...prev, segments: [...prev.segments, seg] }));  // чистый append, id известен синхронно
    return seg.id;
  };
  // ── #3 Старт-кадр (кадр из видео / загрузка / промт+картинка) + #4 продолжение по последнему кадру ──
  const runExtractFrame = async (g: OmniSeg) => {
    if (!sourceUrl) { setOG(g.id, { note: 'Сначала выберите исходное видео.' }); return; }
    if (omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy) return;
    setOG(g.id, { fbBusy: true, note: null });
    try {
      const timeSec = srcDuration > 0 ? g.start * srcDuration : 0;
      const res = await fetch('/api/render/omni/frame', { method: 'POST', headers: headers(), body: JSON.stringify({ videoUrl: sourceUrl, timeSec }) });
      const d = await res.json();
      if (!res.ok || !d.url) { setOG(g.id, { fbBusy: false, note: d?.error || 'Не удалось взять кадр.' }); return; }
      updateSeg(g.id, { startFrame: d.url });
      setOG(g.id, { fbBusy: false, note: 'Старт-кадр взят из видео (в Галерее).' });
    } catch { setOG(g.id, { fbBusy: false, note: 'Ошибка сети при извлечении кадра.' }); }
  };
  // #3 «Загрузить»: открыть галерею СВОИХ картинок для этого окна — выбрать существующую ИЛИ загрузить новую.
  const openStartFramePicker = (segId: string) => { setImgPick(segId); setImgPickQ(''); void loadMedia(); };
  const uploadStartFrame = async (segId: string, files: FileList | null): Promise<boolean> => {
    const f = files && files[0]; if (!f) return false;
    setOG(segId, { fbBusy: true, note: null });
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/trends/media/upload?kind=reference', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.asset?.fileUrl) { setOG(segId, { fbBusy: false, note: d?.error || 'Не удалось загрузить картинку.' }); return false; }
      updateSeg(segId, { startFrame: d.asset.fileUrl });
      setOG(segId, { fbBusy: false, note: 'Своя картинка — старт-кадр.' });
      return true;
    } catch { setOG(segId, { fbBusy: false, note: 'Ошибка загрузки картинки.' }); return false; }
  };
  // Загрузка новой картинки из модалки галереи: грузим → ставим старт-кадром → обновляем галерею → закрываем.
  const uploadStartFrameFromPicker = async (segId: string, files: FileList | null) => {
    const ok = await uploadStartFrame(segId, files);
    if (ok) { await loadMedia(); setImgPick(null); }
  };
  const runPromptImage = async (g: OmniSeg) => {
    if (omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy) return;
    if (!g.startFrame) { setOG(g.id, { note: 'Сначала возьми кадр из видео или загрузи картинку.' }); return; }
    if (!g.prompt.trim()) { setOG(g.id, { note: 'Впиши промт — как изменить картинку.' }); return; }
    setOG(g.id, { fbBusy: true, note: null });
    try {
      const res = await fetch('/api/render/omni/storyboard', { method: 'POST', headers: headers(), body: JSON.stringify({ prompt: g.prompt, count: 1, imageUrl: g.startFrame }) });
      const d = await res.json();
      if (!res.ok || !Array.isArray(d.frames) || !d.frames.length) { setOG(g.id, { fbBusy: false, note: d?.error ? friendlyOmniError(d.error) : 'Не удалось перерисовать кадр.' }); return; }
      updateSeg(g.id, { startFrame: d.frames[0].url });
      setOG(g.id, { fbBusy: false, note: 'Старт-кадр перерисован по промту (Nano).' });
    } catch { setOG(g.id, { fbBusy: false, note: 'Ошибка сети при перерисовке.' }); }
  };
  const runContinue = async (g: OmniSeg) => {
    const url = omniGen[g.id]?.url; if (!url) return;
    if (omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy) return;
    setOG(g.id, { fbBusy: true, note: null });
    try {
      const res = await fetch('/api/render/omni/frame', { method: 'POST', headers: headers(), body: JSON.stringify({ videoUrl: url, last: true }) });
      const d = await res.json();
      if (!res.ok || !d.url) { setOG(g.id, { fbBusy: false, note: d?.error || 'Не удалось взять последний кадр.' }); return; }
      const newId = addSegment(d.url);
      setOG(g.id, { fbBusy: false, note: newId ? 'Добавил окно-продолжение: старт = последний кадр.' : 'Нет места на ленте для нового окна.' });
    } catch { setOG(g.id, { fbBusy: false, note: 'Ошибка сети при продолжении.' }); }
  };
  const removeSeg = (id: string) => {
    if (omniPollRef.current[id]) { clearTimeout(omniPollRef.current[id]); delete omniPollRef.current[id]; } // не оставляем висящий поллинг удалённого окна
    omniMutate((s) => (s.segments.length <= 1 ? s : { ...s, segments: s.segments.filter((g) => g.id !== id) }));
  };
  const fmtT = (frac: number) => srcDuration > 0 ? `${(frac * srcDuration).toFixed(1)}с` : `${Math.round(frac * 100)}%`;
  const winSecOf = (g: OmniSeg) => srcDuration > 0 ? (g.end - g.start) * srcDuration : 0;
  const omniGenSeconds = omniSpec.segments.filter((g) => g.engine === 'omni').reduce((a, g) => a + Math.min(OMNI_MAX_SEC, winSecOf(g)), 0);
  // Идёт генерация видео или подготовка кадра хотя бы по одному окну → анимируем узел «Omni Flash» (как «Подкаст»).
  const omniBusy = Object.values(omniGen).some((x) => !!(x?.busy || x?.fbBusy));

  // ── Интерактивная лента Omni: тянем окно (тело=сдвиг, края=длина), макс 10с у Omni, живой seek ──
  const omniMaxFrac = () => srcDuration > 0 ? Math.min(1, OMNI_MAX_SEC / srcDuration) : 1;
  const omniMinFrac = () => srcDuration > 0 ? Math.min(0.5, srcDuration) / srcDuration : 0.03;
  const seekSrc = (frac: number) => {
    const v = srcVideoRef.current; if (!v || !srcDuration) return;
    try { v.pause(); v.currentTime = Math.max(0, Math.min(srcDuration - 0.03, frac * srcDuration)); } catch { /* seek не готов */ }
  };
  const fracFromClientX = (clientX: number) => {
    const el = stripRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    return r.width > 0 ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
  };
  const omniDragStart = (e: React.PointerEvent, g: OmniSeg, handle: 'move' | 'start' | 'end') => {
    e.preventDefault(); e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* нет capture */ }
    omniDragRef.current = { id: g.id, handle, s0: g.start, e0: g.end, x0: e.clientX };
    seekSrc(handle === 'end' ? g.end : g.start);
  };
  const omniDragMove = (e: React.PointerEvent) => {
    const d = omniDragRef.current; if (!d) return;
    e.stopPropagation();   // не даём событию всплыть с ручки на тело (двойной обработчик)
    const seg = omniSpec.segments.find((x) => x.id === d.id); if (!seg) return;
    const isOmni = seg.engine === 'omni';
    const maxF = isOmni ? omniMaxFrac() : 1;
    const minF = omniMinFrac();
    const others = omniSpec.segments.filter((x) => x.id !== d.id);
    const prevEnd = others.filter((x) => x.end <= d.s0 + 1e-4).reduce((m, x) => Math.max(m, x.end), 0);
    const nextStart = others.filter((x) => x.start >= d.e0 - 1e-4).reduce((m, x) => Math.min(m, x.start), 1);
    const cur = fracFromClientX(e.clientX);
    if (d.handle === 'move') {
      const w = d.e0 - d.s0;
      let s = d.s0 + (cur - fracFromClientX(d.x0));
      s = Math.max(prevEnd, Math.min(s, Math.min(1, nextStart) - w));
      updateSeg(d.id, { start: s, end: s + w });
      seekSrc(s);
    } else if (d.handle === 'start') {
      let s = Math.max(prevEnd, Math.min(cur, d.e0 - minF));
      if (isOmni && d.e0 - s > maxF) s = d.e0 - maxF;
      s = Math.max(0, s);
      updateSeg(d.id, { start: s, end: d.e0 });
      seekSrc(s);
    } else {
      let en = Math.min(nextStart, Math.max(cur, d.s0 + minF));
      if (isOmni && en - d.s0 > maxF) en = d.s0 + maxF;
      en = Math.min(1, en);
      updateSeg(d.id, { start: d.s0, end: en });
      seekSrc(en);
    }
  };
  const omniDragEnd = (e: React.PointerEvent) => {
    if (!omniDragRef.current) return;
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    omniDragRef.current = null;
  };

  // ── Длина: визуальный выбор отрезка на ленте → пишет диапазон m:ss–m:ss в текст узла ──
  const toClock = (sec: number) => { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; };
  const parseRange = (txt: string, dur: number): { start: number; end: number } | null => {
    const m = txt.match(/(\d+):(\d\d)\s*[-–—]\s*(\d+):(\d\d)/);
    if (m && dur > 0) {
      const a = (+m[1] * 60 + +m[2]) / dur, b = (+m[3] * 60 + +m[4]) / dur;
      if (b > a) return { start: Math.max(0, Math.min(1, a)), end: Math.max(0, Math.min(1, b)) };
    }
    return null;
  };
  const writeLenRange = (id: string, sel: { start: number; end: number }) => {
    setLenSel(sel);
    if (srcDuration > 0) patchNode(id, { text: `${toClock(sel.start * srcDuration)}–${toClock(sel.end * srcDuration)}` });
  };

  // ── Экспорт: «Начать экспорт» с имитацией тайминга (реальная передача в API — этап C) ──
  const startExport = () => {
    if (exporting) return;
    setExporting(true); setExportPct(0);
    const tick = () => setExportPct((p) => {
      if (p >= 100) { setExporting(false); return 100; }
      const next = Math.min(100, p + 7 + Math.round(p / 12));
      setTimeout(tick, 220);
      return next;
    });
    setTimeout(tick, 220);
  };

  // При открытии узла «Длина» — подтянуть отрезок из его текста (если задан диапазон).
  useEffect(() => {
    const n = nodes.find((x) => x.id === selectedId);
    if (n?.kind === 'length') setLenSel(parseRange(n.text || '', srcDuration) || { start: 0, end: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, srcDuration]);

  // «Собрать» — сохранить сценарий, поставить задачу рендера, поллить прогресс.
  const build = async () => {
    if (building || batchRunning) return;
    if (!sourceUrl && !canBuildWithoutSource) {
      // Без исходника рендерить нечего: открываем пикер и подсказываем по-русски.
      // (цепочки с Новостями/Озвучкой умеют собираться «с нуля» — их пропускаем)
      setSelectedId(null); setCloudPanel(null); setShowSource(true);
      setBuildJob({ status: 'failed', progress: 0, steps: [], error: 'Сначала выберите исходное видео: клик по центральному узлу «Видео из галереи».' });
      return;
    }
    setBuilding(true);
    setBuildMinimized(false);
    setBuildJob({ status: 'queued', progress: 0, steps: [] });
    try {
      if (dirty) await save();
      const res = await fetch(`/api/render/flow/${flowId}`, { method: 'POST', headers: headers(), body: JSON.stringify({ inputUrl: sourceUrl }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      let job = d.job;
      setBuildJob(job);
      for (let i = 0; i < 600 && job && (job.status === 'queued' || job.status === 'running'); i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (!pollAliveRef.current) return; // компонент размонтирован — прекращаем опрос
        const pr = await fetch(`/api/render/${job.id}`, { headers: headers() });
        if (pr.ok) { job = (await pr.json()).job; setBuildJob(job); }
      }
    } catch (e: any) {
      const raw = String(e?.message || 'Ошибка');
      const msg = /inputUrl|source/i.test(raw)
        ? 'Не выбрано исходное видео — кликните центральный узел и выберите файл из Галереи.'
        : raw;
      setBuildJob({ status: 'failed', error: msg, progress: 0, steps: [] });
    } finally {
      setBuilding(false);
    }
  };

  // ── Подкаст: мутации спеки, диалог/диаризация, медиа, сборка ──────────────────
  const podMutate = (fn: (p: PodcastSpec) => PodcastSpec) => { setPod((p) => fn(p)); setDirty(true); };
  /** Сохранить результат/активную задачу аниматора в спеку (авто-сейв → переживает выход/вход). */
  const persistAnim = (patch: Partial<Pick<PodcastSpec, 'animActive' | 'animResult' | 'studioBgUrl' | 'studioPlace'>>) => { setPod((p) => ({ ...p, ...patch })); setDirty(true); };

  /** Сгенерировать диалог двух ведущих по брифу (Claude). */
  const genDialogue = async () => {
    if (podBusy) return;
    if (!pod.brief.trim()) { setPodNote('Опишите тему подкаста для генерации диалога.'); return; }
    setPodBusy('dialogue'); setPodNote(null);
    try {
      const res = await fetch('/api/render/podcast/dialogue', { method: 'POST', headers: headers(),
        body: JSON.stringify({ brief: pod.brief, nameA: pod.hostA.name, nameB: pod.hostB.name }) });
      const d = await res.json();
      // timeline: false — новые TTS-реплики без start/tStart; в старом режиме таймлайна
      // (после прошлой диаризации) они раскладывались по оценкам и резались невпопад
      if (res.ok && Array.isArray(d.lines) && d.lines.length) { podMutate((p) => ({ ...p, dialogue: d.lines, timeline: false })); setPodNote(d.note || null); }
      else setPodNote(d?.note || d?.error || 'Не удалось сгенерировать диалог.');
    } catch { setPodNote('Ошибка сети при генерации диалога.'); }
    finally { setPodBusy(null); }
  };

  /** Разобрать текст/JSON в реплики двух ведущих (для «Загрузить диалог»). */
  const parseDialogueInput = (raw: string): PodLine[] => {
    const s = (raw || '').trim();
    if (!s) return [];
    const toAB = (who: string, names: string[]): 'A' | 'B' => {
      const low = who.toLowerCase().trim();
      if (/(^|\b)(b|2)(\b|$)|ведущ\w*\s*[бb]|второй|male|муж/.test(low) || low === 'б') return 'B';
      if (/(^|\b)(a|1)(\b|$)|ведущ\w*\s*[аa]|перв|female|жен/.test(low) || low === 'а') return 'A';
      if (who && !names.includes(who)) names.push(who);
      // 1-й уникальный голос → A, 2-й → B, дальше чередуем (раньше 3-й+ молча уходили в A)
      return names.indexOf(who) % 2 === 1 ? 'B' : 'A';
    };
    // JSON?
    if (s[0] === '[' || s[0] === '{') {
      try {
        const j = JSON.parse(s);
        const arr = Array.isArray(j) ? j : (j.dialogue || j.lines || j.segments);
        if (Array.isArray(arr)) {
          const names: string[] = [];
          return arr
            .map((it: any) => {
              const sp = String(it?.speaker ?? it?.role ?? it?.name ?? '').trim();
              const text = String(it?.text ?? it?.content ?? it?.line ?? '').trim();
              // сохраняем таймкоды, если они есть в JSON (сегменты диаризации)
              const st = Number(it?.start); const en = Number(it?.end);
              return {
                speaker: toAB(sp, names), text,
                ...(Number.isFinite(st) ? { start: st } : {}),
                ...(Number.isFinite(en) && (!Number.isFinite(st) || en > st) ? { end: en } : {}),
              } as PodLine;
            })
            .filter((l) => l.text);
        }
      } catch { /* не JSON — разберём как текст */ }
    }
    // Текст: строки «Имя: реплика» (либо просто чередуем).
    const names: string[] = [];
    const out: PodLine[] = [];
    for (const rawLine of s.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = line.match(/^\s*([^:：]{1,32})[:：]\s*(.+)$/);
      if (m) out.push({ speaker: toAB(m[1], names), text: m[2].trim() });
      else if (out.length) out[out.length - 1].text += ' ' + line; // продолжение реплики
      else out.push({ speaker: 'A', text: line });
    }
    return out.filter((l) => l.text.trim());
  };
  /** Применить загруженный диалог из модала. */
  const applyLoadedDialogue = () => {
    const lines = parseDialogueInput(loadDlgText);
    if (!lines.length) { setPodNote('Не разобрать. Формат: строки «A: …» / «B: …» или JSON [{ "speaker": "A", "text": "…" }].'); return; }
    podMutate((p) => ({ ...p, dialogue: lines, timeline: false }));
    setLoadDlgOpen(false); setLoadDlgText(''); setPodNote(`Загружено реплик: ${lines.length}.`);
  };
  /** Узлы «Исследование»/«Новости» текущего сценария с текстом — источник для «Загрузить диалог». */
  const researchNodes = nodes.filter((n) => (n.kind === 'research' || n.kind === 'news') && (n.text || '').trim());

  /** Разобрать загруженную запись на 2 голоса (диаризация). */
  const runDiarize = async () => {
    if (podBusy || !pod.recordingUrl) return;
    setPodBusy('diarize'); setPodNote(null);
    try {
      const res = await fetch('/api/render/podcast/diarize', { method: 'POST', headers: headers(),
        body: JSON.stringify({ recordingUrl: pod.recordingUrl, hostAVoice: pod.hostA.voice, hostBVoice: pod.hostB.voice }) });
      const d = await res.json();
      if (res.ok && Array.isArray(d.lines) && d.lines.length) {
        // Авто-раскладка: ставим клипы на их реальные времена (tStart=start) и включаем таймлайн.
        // Голос аниматора автоматически «Из записи»: раз запись разобрана — в ролик идёт СВОЙ
        // голос по таймкодам, HeyGen делает только мимику/липсинк (не пере-озвучивает TTS-ом).
        podMutate((p) => ({ ...p, timeline: true,
          avatar: { ...(p.avatar || POD_DEFAULT.avatar!), voiceSource: 'record' },
          dialogue: d.lines.map((l: any) => {
          // Number(): строковые таймкоды (фолбэк-воркер) иначе молча теряли авто-раскладку
          const st = Number(l.start); const en = Number(l.end);
          return {
            speaker: l.speaker === 'B' ? 'B' : 'A', text: String(l.text || ''),
            ...(Number.isFinite(st) ? { start: st, tStart: st } : {}),
            ...(Number.isFinite(en) ? { end: en } : {}),
          };
        }) }));
        setPodNote((d.note ? d.note + ' · ' : '') + 'Голос аниматора: «Из записи» (ваш голос, HeyGen — только мимика).');
        setDiarizeDone(true);  // мигающий кружок на узле «Подкаст»
      } else setPodNote(d?.note || d?.error || 'Не удалось разобрать запись.');
    } catch { setPodNote('Ошибка сети при разборе записи.'); }
    finally { setPodBusy(null); }
  };

  /** Суммарная длительность диалога (сек) — для оценки стоимости анимации. */
  const dialogTotalSec = (): number => pod.dialogue.reduce((s, l) => s + lineDur(l), 0);
  /** Опрос статуса рендеров HeyGen до готовности (потолок ~30 мин). */
  const pollAnimate = (ids: string[]) => {
    let ticks = 0;
    const tick = async () => {
      try {
        const res = await fetch('/api/render/podcast/animate/status?ids=' + ids.join(','), { headers: headers() });
        const d = await res.json();
        if (res.ok && Array.isArray(d.statuses) && d.statuses.length) {
          let merged: typeof animJobs = [];
          setAnimJobs((prev) => { merged = prev.map((j) => { const s = d.statuses.find((x: any) => x.id === j.videoId); return s ? { ...j, status: s.status, url: s.url } : j; }); return merged; });
          const done = d.statuses.every((s: any) => s.status === 'completed' || s.status === 'failed');
          if (done) {
            setAnimBusy(false);
            setAnimNote(d.statuses.some((s: any) => s.status === 'failed') ? 'Часть голов не отрендерилась — см. статус ниже.' : 'Готово! Говорящие головы ведущих отрендерены. Ниже — превью.');
            persistAnim({ animActive: null, animResult: merged.map((j) => ({ host: j.host, name: j.name, videoId: j.videoId, url: j.url || null, interactionId: j.interactionId || null })) });
            return;
          }
        }
      } catch { /* ретрай */ }
      if (!pollAliveRef.current) return;
      if (++ticks > 180) { setAnimBusy(false); setAnimNote('Опрос рендера остановлен по таймауту (30 мин) — готовые головы ищите в Галерее.'); return; }
      animPollRef.current = window.setTimeout(tick, 10000);
    };
    tick();
  };
  /** Запустить рендер говорящих голов ведущих у выбранного провайдера (HeyGen — реально). */
  const runAnimate = async () => {
    if (animBusy) return;
    const av = pod.avatar || POD_DEFAULT.avatar!;
    if (av.provider === 'omni') { void runOmniAnimate(); return; }
    if (av.provider === 'heygen' && (!pod.hostA.photoUrl || !pod.hostB.photoUrl)) { setAnimNote('Сначала добавьте фото обоих ведущих (студия лиц / ракурсы).'); return; }
    if (av.provider === 'heygen' && !pod.dialogue.some((l) => (l.text || '').trim())) { setAnimNote('Нужен диалог: сгенерируйте, загрузите или разберите запись.'); return; }
    if (animPollRef.current) { clearTimeout(animPollRef.current); animPollRef.current = null; }
    setAnimBusy(true); setAnimNote(null); setAnimJobs([]);
    try {
      const res = await fetch('/api/render/podcast/animate', { method: 'POST', headers: headers(),
        body: JSON.stringify({ provider: av.provider, mode: av.mode, voiceSource: av.voiceSource, emotion: av.emotion, spec: pod }) });
      const d = await res.json();
      if (!res.ok) { setAnimNote(d?.error || 'Аниматор недоступен.'); setAnimBusy(false); return; }
      if (Array.isArray(d.jobs) && d.jobs.length) {
        setAnimJobs(d.jobs.map((j: any) => ({ ...j, status: 'processing', url: null })));
        setAnimNote(d.note || 'Идёт рендер…');
        persistAnim({ animActive: { kind: 'heygen', videoIds: d.jobs.map((j: any) => j.videoId) }, animResult: null });
        pollAnimate(d.jobs.map((j: any) => j.videoId));
      } else { setAnimNote(d.note || 'Готово.'); setAnimBusy(false); }
    } catch { setAnimNote('Ошибка сети при запуске аниматора.'); setAnimBusy(false); }
  };
  /** Опрос статуса склейки сплит-скрина (потолок ~30 мин). */
  const pollCompose = (jobId: string) => {
    let ticks = 0;
    const tick = async () => {
      try {
        const res = await fetch('/api/render/podcast/compose/status?jobId=' + jobId, { headers: headers() });
        const d = await res.json();
        if (res.ok && d.status && d.status !== 'processing') {
          setComposeBusy(false);
          if (d.status === 'done' && d.fileUrl) { setComposeUrl(d.fileUrl); setComposeNote('Готово! Сплит-скрин собран и сохранён в Галерею.'); }
          else setComposeNote(d.error || 'Склейка не удалась.');
          return;
        }
      } catch { /* ретрай */ }
      if (!pollAliveRef.current) return;
      if (++ticks > 225) { setComposeBusy(false); setComposeNote('Опрос склейки остановлен по таймауту (30 мин) — результат ищите в Галерее.'); return; }
      composePollRef.current = window.setTimeout(tick, 8000);
    };
    tick();
  };
  /** Склеить готовые головы в сплит-скрин (+ запись как аудио, + фон-музыка). */
  const runCompose = async () => {
    if (composeBusy) return;
    const a = animJobs.find((j) => j.host === 'A' && j.url && j.status === 'completed');
    const b = animJobs.find((j) => j.host === 'B' && j.url && j.status === 'completed');
    if (!a?.url || !b?.url) { setComposeNote('Сначала дождитесь готовности обеих голов.'); return; }
    if (composePollRef.current) { clearTimeout(composePollRef.current); composePollRef.current = null; }
    setComposeBusy(true); setComposeNote(null); setComposeUrl(null);
    try {
      const av = pod.avatar || POD_DEFAULT.avatar!;
      const bg = studioBg || pod.studioBgUrl || null;
      const onStudio = !!bg;
      const body: any = { headA: a.url, headB: b.url,
        audioUrl: av.voiceSource === 'record' ? pod.recordingUrl : undefined,
        musicUrl: pod.music?.url || undefined, musicVolume: pod.music?.volumePct ?? 20 };
      if (onStudio) {
        body.studioUrl = bg;
        body.fullFrame = true; // вырезки в композиции кадра фона → аватары на своих местах
        if (pod.studioPlace?.A && pod.studioPlace?.B) body.place = pod.studioPlace; // окна-координаты посадки
        // медиа реплик (картинки/видео) — показываются по своим интервалам поверх сцены
        body.overlays = pod.dialogue
          .map((l, i, arr) => l.image ? { url: l.image, tStart: lineT(l, i, arr), dur: lineDur(l), video: isVideoUrl(l.image) } : null)
          .filter(Boolean)
          .slice(0, 12);
      }
      const res = await fetch(onStudio ? '/api/render/podcast/compose-studio' : '/api/render/podcast/compose', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok || !d.jobId) { setComposeNote(d?.error || 'Не удалось запустить склейку.'); setComposeBusy(false); return; }
      setComposeNote(d.note || 'Склеиваю…');
      pollCompose(d.jobId);
    } catch { setComposeNote('Ошибка сети при склейке.'); setComposeBusy(false); }
  };

  // ── HeyGen «на студии»: вырезать людей из общего фото (Nano→зелёный) → HeyGen (Avatar IV) → наложим на студию ──
  const runHeyGenStudio = async () => {
    if (animBusy) return;
    if (!pod.groupPhotoUrl) { setAnimNote('Нужно общее фото студии (студия лиц) — из него вырежем обоих ведущих.'); return; }
    if (!pod.dialogue.some((l) => (l.text || '').trim())) { setAnimNote('Нужен диалог: сгенерируйте, загрузите или разберите запись.'); return; }
    if (animPollRef.current) { clearTimeout(animPollRef.current); animPollRef.current = null; }
    setAnimBusy(true); setAnimNote(null); setAnimJobs([]); setStudioBg(null); setComposeUrl(null);
    try {
      const av = pod.avatar || POD_DEFAULT.avatar!;
      const res = await fetch('/api/render/podcast/heygen-studio', { method: 'POST', headers: headers(), body: JSON.stringify({ spec: pod, mode: av.mode, voiceSource: av.voiceSource, emotion: av.emotion }) });
      const d = await res.json();
      if (!res.ok) { setAnimNote(d?.error || 'HeyGen-студия недоступна.'); setAnimBusy(false); return; }
      if (Array.isArray(d.jobs) && d.jobs.length) {
        setAnimJobs(d.jobs.map((j: any) => ({ ...j, status: 'processing', url: null })));
        const bg = d.studioUrl || pod.groupPhotoUrl || null;
        setStudioBg(bg);
        setAnimNote(d.note || 'HeyGen анимирует…');
        // studioBgUrl (clean plate) — в спеку: «Собрать НА студии» работает и после выхода/входа
        persistAnim({ animActive: { kind: 'heygen', videoIds: d.jobs.map((j: any) => j.videoId) }, animResult: null, studioBgUrl: bg, studioPlace: d.place || null });
        pollAnimate(d.jobs.map((j: any) => j.videoId));
      } else { setAnimNote(d.note || 'Готово.'); setAnimBusy(false); }
    } catch { setAnimNote('Ошибка сети (HeyGen-студия).'); setAnimBusy(false); }
  };

  // ── Omni-студия: оживить фото каждого ведущего через Omni Flash (по одному) → 2 клипа с ИИ-голосом ──
  const runOmniAnimate = async () => {
    if (animBusy) return;
    if (!pod.groupPhotoUrl && (!pod.hostA.photoUrl || !pod.hostB.photoUrl)) { setAnimNote('Добавьте общее фото студии (студия лиц) или фото обоих ведущих.'); return; }
    if (animPollRef.current) { clearTimeout(animPollRef.current); animPollRef.current = null; }
    setAnimBusy(true); setAnimNote(null); setAnimJobs([]);
    try {
      const res = await fetch('/api/render/podcast/omni-animate', { method: 'POST', headers: headers(), body: JSON.stringify({ spec: pod, aspect: '9:16' }) });
      const d = await res.json();
      if (!res.ok || !d.jobId) { setAnimNote(d?.error || 'Omni-студия недоступна.'); setAnimBusy(false); return; }
      setAnimNote(d.note || 'Omni оживляет ведущих…');
      persistAnim({ animActive: { kind: 'omnipod', jobId: d.jobId }, animResult: null });
      pollOmniAnimate(d.jobId);
    } catch { setAnimNote('Ошибка сети при запуске Omni-студии.'); setAnimBusy(false); }
  };
  const pollOmniAnimate = (jobId: string) => {
    let ticks = 0;
    const tick = async () => {
      try {
        const res = await fetch('/api/render/podcast/omni-animate/status?jobId=' + jobId, { headers: headers() });
        if (res.status === 404) { setAnimBusy(false); persistAnim({ animActive: null }); setAnimNote('Прошлая Omni-генерация не найдена (сервер мог перезапуститься). Готовые клипы ищите в Галерее.'); return; }
        const d = await res.json();
        if (res.ok && d.status && d.status !== 'processing') {
          setAnimBusy(false);
          const hosts = Array.isArray(d.hosts) ? d.hosts : [];
          const jobs = hosts.map((h: any) => ({ host: h.host, name: h.name, videoId: 'omni-' + h.host, status: h.url ? 'completed' : 'failed', url: h.url || null, interactionId: h.interactionId || null }));
          setAnimJobs(jobs);
          persistAnim({ animActive: null, animResult: jobs.map((j: any) => ({ host: j.host, name: j.name, videoId: j.videoId, url: j.url || null, interactionId: j.interactionId || null })) });
          setAnimNote(d.status === 'failed' ? (d.error || 'Omni не смог оживить ведущих.') : 'Готово! Omni оживил ведущих. Правь клипы чатом ниже или склей сплит-скрин.');
          return;
        }
      } catch { /* ретрай */ }
      if (!pollAliveRef.current) return;
      if (++ticks > 225) { setAnimBusy(false); setAnimNote('Опрос Omni остановлен по таймауту (30 мин) — готовые клипы ищите в Галерее.'); return; }
      animPollRef.current = window.setTimeout(tick, 8000);
    };
    tick();
  };
  /** Чат-правка Omni-клипа одного ведущего (та же сессия Interactions, previous_interaction_id). */
  const runOmniHostEdit = async (host: string) => {
    const job = animJobs.find((j) => j.host === host);
    const prompt = (job?.edit || '').trim();
    if (!job?.interactionId || !prompt || job.editing) return;
    setAnimJobs((prev) => prev.map((j) => j.host === host ? { ...j, editing: true } : j));
    try {
      const res = await fetch('/api/render/omni/edit', { method: 'POST', headers: headers(), body: JSON.stringify({ previousInteractionId: job.interactionId, prompt, aspect: '9:16' }) });
      const d = await res.json();
      if (!res.ok || !d.jobId) { setAnimJobs((prev) => prev.map((j) => j.host === host ? { ...j, editing: false } : j)); setAnimNote(d?.error || 'Правка не запустилась.'); return; }
      let ticks = 0;
      const poll = async () => {
        try {
          const r = await fetch('/api/render/omni/status?jobId=' + d.jobId, { headers: headers() });
          const s = await r.json();
          if (r.ok && s.status && s.status !== 'processing') {
            let merged: typeof animJobs = [];
            setAnimJobs((prev) => { merged = prev.map((j) => j.host === host ? { ...j, editing: false, edit: '', url: s.fileUrl || j.url, interactionId: s.interactionId || j.interactionId } : j); return merged; });
            persistAnim({ animResult: merged.map((j) => ({ host: j.host, name: j.name, videoId: j.videoId, url: j.url || null, interactionId: j.interactionId || null })) });
            if (s.status === 'failed') setAnimNote(s.error || 'Правка не удалась.');
            return;
          }
        } catch { /* ретрай */ }
        if (!pollAliveRef.current || ++ticks > 150) return;
        omniPollRef.current[d.jobId] = window.setTimeout(poll, 8000);
      };
      poll();
    } catch { setAnimJobs((prev) => prev.map((j) => j.host === host ? { ...j, editing: false } : j)); setAnimNote('Ошибка сети при правке.'); }
  };

  // Восстановление результатов аниматора при возврате в сценарий + возобновление опроса, если генерация ещё шла.
  const animHydratedRef = useRef(false);
  useEffect(() => {
    if (loading || animHydratedRef.current) return;
    animHydratedRef.current = true;
    const res = pod.animResult; const active = pod.animActive;
    if (Array.isArray(res) && res.length) setAnimJobs(res.map((r) => ({ ...r, status: r.url ? 'completed' : 'failed' })));
    if (pod.studioBgUrl) setStudioBg(pod.studioBgUrl); // clean plate выживает выход/вход
    if (active && active.kind === 'omnipod' && active.jobId) {
      setAnimBusy(true); setAnimNote('Возобновляю Omni-генерацию (шла в фоне)…'); pollOmniAnimate(active.jobId);
    } else if (active && active.kind === 'heygen' && Array.isArray(active.videoIds) && active.videoIds.length) {
      setAnimBusy(true); setAnimNote('Возобновляю рендер HeyGen…');
      setAnimJobs(active.videoIds.map((id, i) => ({ host: i === 0 ? 'A' : 'B', name: (res && res[i]?.name) || `Ведущий ${i === 0 ? 'A' : 'B'}`, videoId: id, status: 'processing', url: null })));
      pollAnimate(active.videoIds);
    }
  }, [loading]);

  const podLineMutate = (i: number, patch: Partial<PodLine>) =>
    podMutate((p) => ({ ...p, dialogue: p.dialogue.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const podLineAdd = () => podMutate((p) => ({ ...p, dialogue: [...p.dialogue, { speaker: p.dialogue.length % 2 ? 'B' : 'A', text: '' }] }));
  const podLineDel = (i: number) => {
    podMutate((p) => ({ ...p, dialogue: p.dialogue.filter((_, j) => j !== i) }));
    setSelLine((s) => (s == null ? s : s === i ? null : s > i ? s - 1 : s)); // индексы сдвинулись
  };

  // ── Таймлайн (Фаза 2): длительность/позиция клипа, вкл. режим наложения, перетаскивание ──
  const lineDur = (l: PodLine): number => {
    if (Number.isFinite(l.start) && Number.isFinite(l.end) && (l.end as number) > (l.start as number)) return (l.end as number) - (l.start as number);
    return Math.max(1.5, Math.min(12, (l.text || '').length * 0.06)); // оценка для TTS (нет реальной длины)
  };
  /** Позиция клипа на таймлайне: tStart → исходный start → встык за предыдущим того же набора. */
  const lineT = (l: PodLine, i: number, arr: PodLine[]): number => {
    if (Number.isFinite(l.tStart)) return l.tStart as number;
    if (Number.isFinite(l.start)) return l.start as number;
    let acc = 0;
    for (let j = 0; j < i; j++) acc += lineDur(arr[j]);
    return acc;
  };
  /** Включить/выключить режим таймлайна; при включении проставляем tStart по умолчанию. */
  const toggleTimeline = () => podMutate((p) => {
    const on = !p.timeline;
    const dialogue = on ? p.dialogue.map((l, i, arr) => ({ ...l, tStart: lineT(l, i, arr) })) : p.dialogue;
    return { ...p, timeline: on, dialogue };
  });
  const tlSetStart = (i: number, t: number) =>
    podMutate((p) => ({ ...p, dialogue: p.dialogue.map((l, j) => (j === i ? { ...l, tStart: Math.max(0, Math.round(t * 20) / 20) } : l)) }));
  /** Разрезать клип i в позиции tCut (сек на таймлайне) на две реплики. */
  const splitLineAt = (i: number, tCut: number) => {
    const arr = pod.dialogue;
    const l = arr[i]; if (!l) return;
    // позиция клипа = lineT (tStart → start → встык): раньше клип без tStart считался от 0,
    // и ножницы резали не там, куда указывал бегунок
    const t = lineT(l, i, arr);
    const d = lineDur(l);
    const off = tCut - t;
    if (off <= 0.1 || off >= d - 0.1) return; // слишком близко к краю — не режем
    const frac = off / d;
    const words = (l.text || '').split(/\s+/).filter(Boolean);
    const hasTC = Number.isFinite(l.start) && Number.isFinite(l.end);
    if (!hasTC && words.length < 2) return; // TTS-реплику из одного слова не разрезать (пустая половина)
    const cw = Math.max(1, Math.round(words.length * frac));
    const mid = hasTC ? (l.start as number) + (l.end as number - (l.start as number)) * frac : undefined;
    const a: PodLine = { ...l, text: words.slice(0, cw).join(' ') || l.text, tStart: t, ...(hasTC ? { end: mid } : {}) };
    const b: PodLine = { ...l, text: words.slice(cw).join(' '), tStart: Math.round((t + off) * 20) / 20, image: undefined, imageName: undefined, anim: undefined, ...(hasTC ? { start: mid } : {}) };
    podMutate((p) => ({ ...p, dialogue: [...p.dialogue.slice(0, i), a, b, ...p.dialogue.slice(i + 1)] }));
    setSelLine((s) => (s != null && s > i ? s + 1 : s)); // индексы ниже разреза сдвинулись
  };
  const tlDragRef = useRef<{ i: number; startX: number; startT: number } | null>(null);
  const [tlPps, setTlPps] = useState(44); // пикселей на секунду — масштаб таймлайна (зум)
  const tlPpsRef = useRef(44);
  useEffect(() => { tlPpsRef.current = tlPps; }, [tlPps]);
  const [tlPlayhead, setTlPlayhead] = useState(0);     // бегунок (сек) — где режут ножницы
  const tlPlayDragRef = useRef(false);
  const tlMovedRef = useRef(false); // был ли драг клипа (чтобы клик ≠ перетаскивание)
  const tlWrapRef = useRef<HTMLDivElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false); // список реплик свёрнут/раскрыт
  const [selLine, setSelLine] = useState<number | null>(null); // выбранная реплика (клик по клипу)
  const [tlPlaying, setTlPlaying] = useState(false);   // идёт воспроизведение с бегунка
  const tlRafRef = useRef<number | null>(null);
  const tlRafPrevRef = useRef<number | null>(null);
  // Web Audio: микшируем клипы по их tStart, чтобы наложенные (перебивание) звучали ОДНОВРЕМЕННО.
  const tlCtxRef = useRef<AudioContext | null>(null);
  const tlBufRef = useRef<AudioBuffer | null>(null);
  const tlBufUrlRef = useRef<string | null>(null);
  const tlSrcsRef = useRef<AudioBufferSourceNode[]>([]);
  const tlMmss = (s: number): string => { const m = Math.floor(s / 60); const ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, '0')}`; };
  /** Медиа реплики — видео? (чтобы показать нужную иконку и во воркере наложить как видео). */
  const isVideoUrl = (u?: string | null): boolean => !!u && /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(u);
  /** Разрезать клип, над которым стоит бегунок, в его позиции. */
  const cutAtPlayhead = () => {
    const arr = pod.dialogue;
    const idx = arr.findIndex((l, i) => { const t = lineT(l, i, arr); return tlPlayhead > t + 0.1 && tlPlayhead < t + lineDur(l) - 0.1; });
    if (idx >= 0) splitLineAt(idx, tlPlayhead);
  };
  /** Вместить весь таймлайн в видимую ширину (минимальный масштаб). */
  const fitTimeline = () => {
    const arr = pod.dialogue;
    const total = Math.max(3, ...arr.map((l, i) => lineT(l, i, arr) + lineDur(l)));
    const w = (tlWrapRef.current?.clientWidth || 520) - 48;
    setTlPps(Math.max(3, Math.min(160, w / total)));
  };
  /** Объединить реплику i со следующей: тексты, времена и медиа сливаются в один клип. */
  const mergeLineDown = (i: number) => {
    podMutate((p) => {
      const a = p.dialogue[i]; const b = p.dialogue[i + 1];
      if (!a || !b) return p;
      const tA = lineT(a, i, p.dialogue);
      const tB = lineT(b, i + 1, p.dialogue);
      // после перетаскивания сосед по массиву может стоять РАНЬШЕ по времени — сливаем по
      // времени (иначе получался end < start, и клип молча переставал играть)
      const [first, second] = tB < tA ? [b, a] : [a, b];
      const starts = [a.start, b.start].filter((x): x is number => Number.isFinite(x));
      const ends = [a.end, b.end].filter((x): x is number => Number.isFinite(x));
      const merged: PodLine = {
        ...a,
        text: [first.text, second.text].map((x) => (x || '').trim()).filter(Boolean).join(' '),
        tStart: Math.min(tA, tB),
        ...(starts.length ? { start: Math.min(...starts) } : {}),
        ...(ends.length ? { end: Math.max(...ends) } : {}),
        image: a.image || b.image, imageName: a.imageName || b.imageName, anim: a.anim || b.anim,
      };
      return { ...p, dialogue: [...p.dialogue.slice(0, i), merged, ...p.dialogue.slice(i + 2)] };
    });
    setSelLine((s) => (s == null ? s : s === i + 1 ? i : s > i + 1 ? s - 1 : s));
  };
  /** Остановить все запланированные аудио-источники таймлайна. */
  const tlStopSources = () => { for (const s of tlSrcsRef.current) { try { s.stop(); } catch { /* тихо */ } } tlSrcsRef.current = []; };
  // Поколение запуска: tlPlay ждёт декодирование записи (секунды) — Стоп/повторный Play за это
  // время должен отменить «догоняющий» запуск, иначе играет призрачное аудио + второй raf-цикл.
  const tlPlaySeqRef = useRef(0);
  /** Остановить воспроизведение таймлайна (аудио + анимация бегунка). */
  const tlStop = () => {
    tlPlaySeqRef.current++;
    setTlPlaying(false);
    tlStopSources();
    if (tlRafRef.current != null) { cancelAnimationFrame(tlRafRef.current); tlRafRef.current = null; }
    tlRafPrevRef.current = null;
  };
  /** Декодировать запись в AudioBuffer (кэш по url). */
  const tlLoadBuffer = async (): Promise<AudioBuffer | null> => {
    if (!pod.recordingUrl) return null;
    const ctx = tlCtxRef.current || (tlCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)());
    if (tlBufRef.current && tlBufUrlRef.current === pod.recordingUrl) return tlBufRef.current;
    const r = await fetch(pod.recordingUrl);
    const ab = await r.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    tlBufRef.current = buf; tlBufUrlRef.current = pod.recordingUrl;
    return buf;
  };
  /** Воспроизвести с жёлтого бегунка. Каждый клип играет свой отрезок записи в позиции tStart —
   *  наложенные клипы (перебивание) звучат ОДНОВРЕМЕННО (Web Audio микширует). */
  const tlPlay = async () => {
    tlStop(); // снимаем предыдущий цикл (raf/источники), если был
    const seq = tlPlaySeqRef.current;
    const arr = pod.dialogue;
    const total = Math.max(1, ...arr.map((l, i) => lineT(l, i, arr) + lineDur(l)));
    let from = tlPlayhead; if (from >= total - 0.05) { from = 0; setTlPlayhead(0); }
    setTlPlaying(true);
    let buf: AudioBuffer | null = null;
    try { buf = await tlLoadBuffer(); } catch { buf = null; }
    const ctx = tlCtxRef.current;
    if (buf && ctx) {
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* тихо */ } }
      if (seq !== tlPlaySeqRef.current) return; // пока декодировали — нажали Стоп/Play заново
      tlStopSources();
      const t0 = ctx.currentTime + 0.08;
      arr.forEach((l, i) => {
        const st = Number(l.start); const en = Number(l.end);
        if (!Number.isFinite(st) || !Number.isFinite(en) || en <= st) return; // нет реального отрезка
        const tStart = lineT(l, i, arr);
        const clipEnd = tStart + (en - st);
        if (clipEnd <= from) return;                       // клип целиком до бегунка
        let offset = st; let dur = en - st; let when = t0 + (tStart - from);
        if (tStart < from) { const skip = from - tStart; offset = st + skip; dur -= skip; when = t0; } // клип начался раньше бегунка
        offset = Math.max(0, Math.min(offset, buf!.duration - 0.02));
        dur = Math.min(dur, buf!.duration - offset);
        if (dur <= 0.02) return;
        const src = ctx.createBufferSource(); src.buffer = buf!; src.connect(ctx.destination);
        try { src.start(when, offset, dur); tlSrcsRef.current.push(src); } catch { /* тихо */ }
      });
      const tick = () => {
        const c = tlCtxRef.current; if (!c) return;
        const cur = from + (c.currentTime - t0);
        if (cur >= total) { setTlPlayhead(total); tlStop(); return; }
        if (cur >= 0) setTlPlayhead(cur);
        tlRafRef.current = requestAnimationFrame(tick);
      };
      tlRafRef.current = requestAnimationFrame(tick);
      return;
    }
    // Нет записи / не удалось декодировать — просто ведём бегунок по времени.
    if (seq !== tlPlaySeqRef.current) return; // запуск отменили, пока грузили запись
    tlRafPrevRef.current = null;
    const tick = (ts: number) => {
      if (tlRafPrevRef.current == null) tlRafPrevRef.current = ts;
      const cur = from + (ts - tlRafPrevRef.current) / 1000;
      if (cur >= total) { setTlPlayhead(total); tlStop(); return; }
      setTlPlayhead(cur);
      tlRafRef.current = requestAnimationFrame(tick);
    };
    tlRafRef.current = requestAnimationFrame(tick);
  };
  const tlTogglePlay = () => { if (tlPlaying) tlStop(); else { tlPlay().catch(() => setTlPlaying(false)); } };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = tlDragRef.current;
      if (d) {
        tlMovedRef.current = true;
        const nt = Math.max(0, Math.round((d.startT + (e.clientX - d.startX) / tlPpsRef.current) * 20) / 20);
        setPod((p) => ({ ...p, dialogue: p.dialogue.map((l, j) => (j === d.i ? { ...l, tStart: nt } : l)) }));
      } else if (tlPlayDragRef.current && tlWrapRef.current) {
        const r = tlWrapRef.current.getBoundingClientRect();
        const x = e.clientX - r.left + tlWrapRef.current.scrollLeft - 32; // 32 = отступ подписи дорожки
        const nt = Math.max(0, Math.round((x / tlPpsRef.current) * 20) / 20);
        setTlPlayhead(nt);
        // ручная перемотка — останавливаем воспроизведение (и raf-режим без аудио тоже,
        // иначе цикл каждый кадр перетирает позицию и бегунок «вырывается из рук»)
        if (tlSrcsRef.current.length || tlRafRef.current != null) tlStop();
      }
    };
    const up = () => {
      if (tlDragRef.current) {
        tlDragRef.current = null;
        if (tlMovedRef.current) setDirty(true); // клик без движения — не «грязним» документ
        // сбрасываем флаг ПОСЛЕ click-события (иначе прерванный драг проглатывает следующий клик)
        window.setTimeout(() => { tlMovedRef.current = false; }, 0);
      }
      tlPlayDragRef.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      pollAliveRef.current = false; // тикеры в полёте (await fetch) не переустановят таймеры
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (tlRafRef.current != null) cancelAnimationFrame(tlRafRef.current);
      for (const s of tlSrcsRef.current) { try { s.stop(); } catch { /* тихо */ } }
      if (tlCtxRef.current) { try { tlCtxRef.current.close(); } catch { /* тихо */ } tlCtxRef.current = null; }
      if (animPollRef.current) { clearTimeout(animPollRef.current); animPollRef.current = null; }
      if (composePollRef.current) { clearTimeout(composePollRef.current); composePollRef.current = null; }
      Object.values(omniPollRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Медиа для подкаста: выбор из Галереи / загрузка с устройства → в нужное поле спеки.
  type PodPickTarget = 'hostA' | 'hostB' | 'cutaway' | 'recording' | 'group' | 'lineimg' | 'music';
  const openPodPick = (target: PodPickTarget) => { setPodPick(target); setPodPickTab('all'); setPodPickQ(''); loadMedia(); };
  const applyPodMedia = (target: PodPickTarget, m: { fileUrl: string; title: string }) => {
    podMutate((p) => {
      if (target === 'hostA') return { ...p, hostA: { ...p.hostA, photoUrl: m.fileUrl, photoName: m.title } };
      if (target === 'hostB') return { ...p, hostB: { ...p.hostB, photoUrl: m.fileUrl, photoName: m.title } };
      // запись выбрана → голос аниматора сразу «Из записи» (свой голос, HeyGen — только мимика)
      if (target === 'recording') return { ...p, recordingUrl: m.fileUrl, recordingName: m.title, avatar: { ...(p.avatar || POD_DEFAULT.avatar!), voiceSource: 'record' } };
      if (target === 'group') return { ...p, groupPhotoUrl: m.fileUrl, groupPhotoName: m.title, faces: [] };
      if (target === 'lineimg' && podLineIdx != null) return { ...p, dialogue: p.dialogue.map((l, j) => (j === podLineIdx ? { ...l, image: m.fileUrl, imageName: m.title } : l)) };
      if (target === 'music') return { ...p, music: { url: m.fileUrl, name: m.title, volumePct: p.music?.volumePct ?? 20 } };
      return { ...p, cutaways: [...p.cutaways, { url: m.fileUrl, name: m.title }] };
    });
    setPodPick(null);
  };
  const uploadPodFiles = async (files: FileList | File[]) => {
    const target = podPick; const list = Array.from(files || []).filter(Boolean);
    if (!target || !list.length) return;
    const kind = (target === 'recording' || target === 'music') ? 'audio' : 'reference';
    setPodBusy('upload'); let last: any = null;
    try {
      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(`/api/trends/media/upload?kind=${kind}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: (() => { const fd = new FormData(); fd.append('file', f); return fd; })() });
        if (res.ok) { const d = await res.json(); if (d.asset) last = d.asset; }
      }
      await loadMedia();
      if (last) applyPodMedia(target, { fileUrl: last.fileUrl, title: last.originalName || 'файл' });
    } catch { /* тихо */ }
    finally { setPodBusy(null); }
  };

  // ── Студия лиц (Фаза 1): групповое фото → детекция/разметка → кроп крупных планов ──
  /** Координаты события → доли изображения (0..1) внутри обёртки фото. */
  const faceXY = (e: React.PointerEvent) => {
    const r = faceWrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) };
  };
  const nextSpeaker = (): 'A' | 'B' => (pod.faces.some((f) => f.speaker === 'A') ? 'B' : 'A');
  const faceDown = (e: React.PointerEvent) => {
    if (pod.faces.length >= 2) return; // только два персонажа
    drawStartRef.current = faceXY(e);
    setDrawBox({ ...drawStartRef.current, w: 0, h: 0 });
  };
  const faceMove = (e: React.PointerEvent) => {
    if (!drawStartRef.current) return;
    const p = faceXY(e); const s = drawStartRef.current;
    setDrawBox({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const faceUp = () => {
    const b = drawBox; drawStartRef.current = null; setDrawBox(null);
    if (b && b.w > 0.03 && b.h > 0.03) {
      podMutate((p) => ({ ...p, faces: [...p.faces, { id: `f${Date.now().toString(36)}${p.faces.length}`, box: b, speaker: nextSpeaker() }] }));
    }
  };
  // Роли взаимоисключающие: назначили A одному лицу → второе автоматически становится B (персонажей всего 2).
  const faceAssign = (id: string, speaker: 'A' | 'B') => podMutate((p) => ({
    ...p,
    faces: p.faces.map((f) => (f.id === id ? { ...f, speaker } : { ...f, speaker: speaker === 'A' ? 'B' : 'A' })),
  }));
  const faceDel = (id: string) => podMutate((p) => ({ ...p, faces: p.faces.filter((f) => f.id !== id) }));

  /** Грузит HTMLImageElement из URL (same-origin → canvas не «грязнится»). */
  const loadImage = (url: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const img = new window.Image(); img.crossOrigin = 'anonymous'; // window.Image — DOM-конструктор (Image затенён иконкой lucide)
    img.onload = () => resolve(img); img.onerror = reject; img.src = url;
  });

  /** Детекция лиц через MediaPipe (надёжно, любой современный браузер) → [{x,y,w,h}] в долях. */
  const detectMediapipe = async (img: HTMLImageElement): Promise<{ x: number; y: number; w: number; h: number }[]> => {
    const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';
    const vision: any = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    const detector = await vision.FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
      runningMode: 'IMAGE',
    });
    const W = img.naturalWidth || 1, H = img.naturalHeight || 1;
    const res = detector.detect(img);
    return (res?.detections || []).map((d: any) => {
      const b = d.boundingBox; return { x: b.originX / W, y: b.originY / H, w: b.width / W, h: b.height / H };
    });
  };
  /** Детекция через браузерный FaceDetector (фолбэк). */
  const detectNative = async (img: HTMLImageElement): Promise<{ x: number; y: number; w: number; h: number }[]> => {
    const FD = (window as any).FaceDetector;
    if (!FD) return [];
    const faces = await new FD({ fastMode: true, maxDetectedFaces: 2 }).detect(img);
    const W = img.naturalWidth || 1, H = img.naturalHeight || 1;
    return (faces || []).map((f: any) => ({ x: f.boundingBox.x / W, y: f.boundingBox.y / H, w: f.boundingBox.width / W, h: f.boundingBox.height / H }));
  };
  /** Авто-распознавание: MediaPipe → FaceDetector → ручная обводка. Берём 2 крупнейших лица слева→направо. */
  const detectFaces = async () => {
    if (!pod.groupPhotoUrl || podBusy) return;
    setPodBusy('detect'); setPodNote(null);
    try {
      const img = await loadImage(pod.groupPhotoUrl);
      let raw: { x: number; y: number; w: number; h: number }[] = [];
      try { raw = await detectMediapipe(img); } catch { raw = []; }
      if (!raw.length) { try { raw = await detectNative(img); } catch { raw = []; } }
      if (!raw.length) { setPodNote('Ведущие не найдены автоматически — обведите каждого рамкой по фото (мышью).'); return; }
      // 2 крупнейших лица слева→направо → A, B; рамку расширяем с лица до ВЕДУЩЕГО ЦЕЛИКОМ
      // (рамка теперь задаёт, кого вырезаем на студию, и участок для крупного плана)
      const top = raw.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 2).sort((a, b) => a.x - b.x);
      const person = (f: { x: number; y: number; w: number; h: number }) => {
        const cx = f.x + f.w / 2;
        const w = Math.min(1, f.w * 3.4); const x = Math.min(Math.max(0, cx - w / 2), 1 - w);
        const y = Math.max(0, f.y - f.h * 0.55); const h = Math.min(1 - y, f.h * 5.6);
        return { x, y, w, h };
      };
      const boxes: PodFace[] = top.map((box, i) => ({ id: `f${Date.now().toString(36)}${i}`, box: person(box), speaker: i === 0 ? 'A' : 'B' }));
      podMutate((p) => ({ ...p, faces: boxes }));
      setPodNote(`Найдено ведущих: ${boxes.length}. Слева — A, справа — B (рамки можно поправить/перерисовать).`);
    } catch { setPodNote('Не удалось распознать — обведите вручную.'); }
    finally { setPodBusy(null); }
  };

  /** Кроп области → квадратный JPEG-Blob. Рамка может быть и лицом, и ведущим целиком:
   *  большую рамку берём почти как есть (небольшой запас), маленькую (лицо) расширяем под
   *  голову/плечи — иначе кадр из «рамки-ведущего» разрастался на всё фото. */
  const cropBox = (img: HTMLImageElement, box: { x: number; y: number; w: number; h: number }, out = 640): Promise<Blob | null> => {
    const W = img.naturalWidth, H = img.naturalHeight;
    const isPerson = box.w >= 0.28 || box.h >= 0.38; // крупная рамка — обведён ведущий целиком
    let x: number, y: number, w: number, h: number;
    if (isPerson) {
      x = (box.x - box.w * 0.06) * W; y = (box.y - box.h * 0.06) * H;
      w = box.w * 1.12 * W; h = box.h * 1.12 * H;
    } else {
      x = (box.x - box.w * 0.7) * W; y = (box.y - box.h * 0.9) * H;
      w = box.w * 2.4 * W; h = box.h * 3.3 * H;
    }
    x = Math.max(0, x); y = Math.max(0, y); w = Math.min(W - x, w); h = Math.min(H - y, h);
    const c = document.createElement('canvas'); c.width = out; c.height = out;
    const ctx = c.getContext('2d'); if (!ctx) return Promise.resolve(null);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, out, out);
    const scale = Math.max(out / w, out / h);
    const dw = w * scale, dh = h * scale;
    ctx.drawImage(img, x, y, w, h, (out - dw) / 2, (out - dh) / 2, dw, dh);
    return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.9));
  };

  const uploadBlob = async (blob: Blob, filename: string): Promise<any | null> => {
    const fd = new FormData(); fd.append('file', new File([blob], filename, { type: blob.type || 'image/jpeg' }));
    const res = await fetch('/api/trends/media/upload?kind=reference', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
    if (!res.ok) return null;
    return (await res.json()).asset || null;
  };

  /** «Сделать кадры»: кроп крупных планов A/B → фото ведущих; общий план → вставка. */
  const applyFaces = async () => {
    if (!pod.groupPhotoUrl || podBusy) return;
    if (!pod.faces.some((f) => f.speaker === 'A') && !pod.faces.some((f) => f.speaker === 'B')) {
      setPodNote('Обведите каждого ведущего рамкой и назначьте A/B (или нажмите «Найти ведущих»).'); return;
    }
    setPodBusy('apply'); setPodNote(null);
    try {
      const img = await loadImage(pod.groupPhotoUrl);
      const urls: { A?: string; B?: string } = {};
      for (const sp of ['A', 'B'] as const) {
        const face = pod.faces.find((f) => f.speaker === sp);
        if (!face) continue;
        const blob = await cropBox(img, face.box);
        if (!blob) continue;
        const asset = await uploadBlob(blob, `host-${sp}.jpg`);
        if (!asset) continue;
        urls[sp] = asset.fileUrl;
      }
      // патч собираем ВНУТРИ функционального апдейта: кроп+аплоад занимают секунды, и копия
      // pod из замыкания перетёрла бы правки имени/голоса, сделанные за это время
      podMutate((p) => ({
        ...p,
        ...(urls.A ? { hostA: { ...p.hostA, photoUrl: urls.A, photoName: 'Ведущий A (кадр)' } } : {}),
        ...(urls.B ? { hostB: { ...p.hostB, photoUrl: urls.B, photoName: 'Ведущий B (кадр)' } } : {}),
      }));
      setPodNote('Готово: крупные планы ведущих созданы из общего фото.');
    } catch { setPodNote('Не удалось сделать кадры из фото.'); }
    finally { setPodBusy(null); }
  };

  /** AI-ракурс студии (Gemini Nano Banana Pro): перерисовать групповое фото под другим ракурсом. */
  const genAngle = async (preset: string) => {
    const baseUrl = angleSrc?.url || pod.groupPhotoUrl;
    if (!baseUrl || angleBusy) return;
    setAngleBusy(preset); setPodNote(null);
    try {
      const res = await fetch('/api/render/podcast/angle', { method: 'POST', headers: headers(),
        body: JSON.stringify({ imageUrl: baseUrl, preset, prompt: anglePromptText }) });
      const d = await res.json();
      if (res.ok && d.mediaUrl) setPodAngles((prev) => [{ url: d.mediaUrl, preset }, ...prev]);
      else setPodNote(d?.error || 'Не удалось сгенерировать ракурс.');
    } catch { setPodNote('Ошибка сети при генерации ракурса.'); }
    finally { setAngleBusy(null); }
  };
  /** Загрузить свою картинку-вход для AI-ракурсов (с диска). */
  const uploadAngleSrc = async (files: FileList | File[]) => {
    const f = Array.from(files || [])[0];
    if (!f) return;
    setAngleBusy('upload'); setPodNote(null);
    try {
      const asset = await uploadBlob(f, f.name || 'image.jpg');
      if (asset) setAngleSrc({ url: asset.fileUrl, name: asset.originalName || 'фото' });
      else setPodNote('Не удалось загрузить картинку.');
    } catch { setPodNote('Ошибка загрузки картинки.'); }
    finally { setAngleBusy(null); }
  };

  // ── Картинки к фразам (B-roll): прикрепляем картинку к реплике, выезжает на этой фразе ──
  const openPodLineImage = (i: number) => { setPodLineIdx(i); setPodPick('lineimg'); setPodPickTab('all'); setPodPickQ(''); loadMedia(); };
  const setLineImage = (i: number, url: string | null, name?: string) =>
    podMutate((p) => ({ ...p, dialogue: p.dialogue.map((l, j) => (j === i ? { ...l, image: url || undefined, imageName: name } : l)) }));
  const setLineAnim = (i: number, anim: PodAnim) =>
    podMutate((p) => ({ ...p, dialogue: p.dialogue.map((l, j) => (j === i ? { ...l, anim } : l)) }));

  /** Чего не хватает для сборки подкаста (null = можно собирать). */
  const podBuildHint = (): string | null => {
    if (!pod.hostA.photoUrl || !pod.hostB.photoUrl) return 'Сделайте кадры обоих ведущих (или выберите фото вручную).';
    if (pod.source === 'diarize') return pod.recordingUrl ? null : 'Загрузите запись (можно сразу «Собрать» — разберём сами).';
    return pod.dialogue.some((l) => l.text.trim()) ? null : 'Сгенерируйте или впишите диалог ведущих.';
  };

  /** «Собрать подкаст» — сохранить спеку, поставить задачу podcast_compose, поллить прогресс. */
  const buildPodcast = async () => {
    if (building) return;
    setCloudPanel(null);
    setBuilding(true); setBuildMinimized(false);
    setBuildJob({ status: 'queued', progress: 0, steps: [] });
    try {
      if (dirty) await save();
      const res = await fetch(`/api/render/podcast/${flowId}`, { method: 'POST', headers: headers(), body: JSON.stringify({ spec: pod }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      let job = d.job; setBuildJob(job);
      for (let i = 0; i < 600 && job && (job.status === 'queued' || job.status === 'running'); i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (!pollAliveRef.current) return; // ушли со страницы — не опрашиваем ещё 20 минут
        const pr = await fetch(`/api/render/${job.id}`, { headers: headers() });
        if (pr.ok) { job = (await pr.json()).job; setBuildJob(job); }
      }
    } catch (e: any) {
      setBuildJob({ status: 'failed', error: e?.message || 'Ошибка', progress: 0, steps: [] });
    } finally {
      setBuilding(false);
    }
  };

  const addNode = (kind: MKind) => { const n = newNode(kind); update((p) => [...p, n]); setShowPicker(false); setSelectedId(n.id); };
  const removeNode = (id: string) => { update((p) => p.filter((n) => n.id !== id)); if (selectedId === id) setSelectedId(null); };
  const patchNode = (id: string, patch: Partial<MNode>) => update((p) => p.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  const setChoice = (id: string, c: Choice, v: string) => update((p) => p.map((n) => {
    if (n.id !== id) return n;
    const cur = n.choices[c.id] || [];
    const next = c.multi ? (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) : [v];
    return { ...n, choices: { ...n.choices, [c.id]: next } };
  }));

  const applyPreset = (preset: Preset) => {
    setName(preset.name);
    setNodes(preset.kinds.map((p) => {
      const spec = typeof p === 'string' ? { kind: p } : p;
      const n = newNode(spec.kind);
      if (spec.choices) Object.entries(spec.choices).forEach(([k, v]) => { n.choices[k] = [...v]; });
      if (spec.text) n.text = spec.text;
      if (spec.llm) n.useLlm = true;
      return n;
    }));
    setDirty(true); setShowPresets(false);
  };

  // Вся Галерея с папками (как в разделе «Галерея»): тренды + референс + аудио + из анализа.
  const loadMedia = async () => {
    try {
      const [tr, r, a, an] = await Promise.all([
        fetch('/api/trends/videos?downloaded=1&limit=200', { headers: headers() }),
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
        fetch('/api/trends/media?kind=audio', { headers: headers() }),
        fetch('/api/trends/media?folder=analyzed', { headers: headers() }),
      ]);
      const trends = tr.ok ? (await tr.json()).videos || [] : [];
      const ref = r.ok ? (await r.json()).assets || [] : [];
      const aud = a.ok ? (await a.json()).assets || [] : [];
      const ana = an.ok ? (await an.json()).assets || [] : [];
      const seen = new Set<string>();
      const out: { id: string; fileUrl: string; title: string; kind: string; folder: 'trends' | 'reference' | 'audio' | 'analyzed'; cover?: string }[] = [];
      const push = (id: string, fileUrl: string, title: string, kind: string, folder: 'trends' | 'reference' | 'audio' | 'analyzed', cover?: string) => {
        if (fileUrl && !seen.has(fileUrl)) { seen.add(fileUrl); out.push({ id: id || fileUrl, fileUrl, title, kind, folder, cover }); }
      };
      for (const v of trends) if (v.fileUrl) push(v.id, v.fileUrl, v.title || v.author || 'видео', 'video', 'trends', v.coverUrl);
      for (const m of ref) push(m.id, m.fileUrl, m.originalName || 'файл', m.mediaType, 'reference');
      for (const m of aud) push(m.id, m.fileUrl, m.originalName || 'аудио', m.mediaType, 'audio');
      for (const m of ana) if (m.mediaType === 'video') push(m.id, m.fileUrl, m.originalName || 'видео', 'video', 'analyzed');
      setMedia(out);
    } catch { setMedia([]); }
  };
  const openAttach = (id: string) => { setAttachFor(id); loadMedia(); };

  // Загрузка файлов с устройства (или drag-and-drop) прямо из блока узла → в Галерею + привязка к узлу.
  const uploadMediaFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter(Boolean);
    if (!list.length || !attachFor) return;
    const node = nodes.find((x) => x.id === attachFor);
    const kind = node?.kind === 'audio' ? 'audio' : 'reference';
    setUploading(true);
    let lastAsset: any = null;
    const uploaded: { url: string; name: string }[] = [];
    try {
      for (const f of list) {
        const fd = new FormData();
        fd.append('file', f);
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(`/api/trends/media/upload?kind=${kind}`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
        });
        if (res.ok) {
          const d = await res.json();
          if (d.asset) { lastAsset = d.asset; uploaded.push({ url: d.asset.fileUrl, name: d.asset.originalName || 'файл' }); }
        }
      }
      await loadMedia();
      if (node?.kind === 'broll') {
        // «Медиафайлы»: ВСЕ загруженные файлы добавляются в список узла.
        const cur = node.medias || [];
        const add = uploaded.filter((u) => !cur.some((x) => x.url === u.url));
        if (add.length) patchNode(attachFor, { medias: [...cur, ...add] });
      } else if (lastAsset) {
        patchNode(attachFor, { mediaUrl: lastAsset.fileUrl, mediaName: lastAsset.originalName || 'файл' });
      }
    } catch { /* тихо */ }
    finally { setUploading(false); }
  };

  // Пикер исходного видео: проанализированные (с ДНК) + скачанные тренды + видео-референсы.
  /** Загрузить список источников (как в Галерее): анализ + скачанные тренды + референс-видео. */
  const loadSources = async () => {
    try {
      const [an, v, r] = await Promise.all([
        fetch('/api/trends/media?folder=analyzed', { headers: headers() }),
        fetch('/api/trends/videos?downloaded=1', { headers: headers() }),
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
      ]);
      const analyzed = an.ok ? ((await an.json()).assets || []) : [];
      const vids = v.ok ? ((await v.json()).videos || []) : [];
      const refs = r.ok ? ((await r.json()).assets || []) : [];
      const list: { url: string; name: string; thumb?: string; type: string; assetId?: string }[] = [];
      // Проанализированные («Из анализа») первыми — у них есть ДНК для автозаполнения блоков.
      for (const m of analyzed) if (m.mediaType === 'video' && m.fileUrl) list.push({ url: m.fileUrl, name: m.originalName || 'видео', thumb: m.coverUrl || m.thumbUrl || undefined, type: 'analyzed', assetId: m.id });
      for (const x of vids) if (x.fileUrl) list.push({ url: x.fileUrl, name: String(x.description || x.authorName || x.author || 'Видео').slice(0, 40), thumb: x.coverUrl, type: 'trend' });
      for (const m of refs) if (m.mediaType === 'video' && m.fileUrl) list.push({ url: m.fileUrl, name: m.originalName || 'видео', thumb: m.coverUrl || m.thumbUrl || undefined, type: 'reference' });
      setSources(list);
    } catch { setSources([]); }
  };
  const openSourcePicker = async () => {
    setShowSource(true);
    setPicked([]); setBatchNote(null); setSrcTab('all'); setSrcQuery('');
    await loadSources();
  };
  /** «Добавить видео» из пикера источника → грузим в Референс Галереи и перечитываем список. */
  const uploadSourceVideo = async (files: FileList | File[] | null) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setSrcUploading(true); setBatchNote(null);
    try {
      for (const f of list) {
        const fd = new FormData(); fd.append('file', f);
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch('/api/trends/media/upload?kind=reference', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      }
      await loadSources();
      setSrcTab('reference');   // загруженное лежит в «Референс»
    } catch (e: any) { setBatchNote(e?.message || 'Ошибка загрузки видео'); }
    finally { setSrcUploading(false); if (srcUploadRef.current) srcUploadRef.current.value = ''; }
  };

  // ── ДНК тренда: применить к графу / подтянуть по ассету / выбрать источник ──
  /** Раскладывает ДНК по блокам сценария + задаёт общий «Сценарий» (brief). */
  const applyDna = (d: TrendDNA) => {
    const { nodes: nn, brief: bb } = dnaToGraph(d);
    setNodes(nn);
    if (bb) setBrief(bb);
    if (d.meta?.author) setName(`По тренду: ${d.meta.author}`.slice(0, 60));
    setDirty(true);
    setShowDnaPanel(false);
    setShowPresets(false);
    setSelectedId(null);
  };
  /** Загружает сохранённую ДНК ассета. Пустой сценарий → авто-заполнение; иначе — панель подтверждения. */
  const fetchDna = async (assetId: string) => {
    setDnaLoading(true);
    try {
      const r = await fetch(`/api/trends/media/${assetId}/analysis`, { headers: headers() });
      if (!r.ok) { setDna(null); return; }
      const d = (await r.json()).analysis?.dna as TrendDNA | undefined;
      if (!d) { setDna(null); return; }
      setDna(d);
      if (nodes.length === 0) applyDna(d);   // пустой сценарий → данные «приезжают вместе с видео»
      else setShowDnaPanel(true);            // есть блоки → спросим перед заменой
    } catch { setDna(null); }
    finally { setDnaLoading(false); }
  };
  const selectSource = (s: { url: string; name: string; assetId?: string }) => {
    setSourceUrl(s.url); setSourceName(s.name); setSourceAssetId(s.assetId || null);
    setDna(null); setDirty(true); setShowSource(false);
    if (s.assetId) fetchDna(s.assetId);
  };
  const clearSource = () => {
    setSourceUrl(null); setSourceName(null); setSourceAssetId(null); setDna(null);
    setDirty(true); setShowSource(false);
  };

  // ── Пакетная сборка: один сценарий (цепочка блоков) → по ролику на каждый источник ──
  const togglePick = (s: { url: string; name: string; assetId?: string }) => {
    setBatchNote(null);
    setPicked((p) => (p.some((x) => x.url === s.url) ? p.filter((x) => x.url !== s.url) : [...p, s]));
  };
  /**
   * Ставит в очередь по одной задаче рендера на каждый выбранный источник — все
   * через текущую цепочку блоков (граф flow). Воркер берёт их по очереди
   * (single-flight): «сначала одно, потом второе…». Поллит прогресс всех задач.
   */
  const runBatch = async (items: { url: string; name: string }[]) => {
    if (batchRunning || building) return;
    if (nodes.length === 0) { setBatchNote('Сначала добавьте блоки в сценарий — по ним соберётся каждый ролик.'); return; }
    if (items.length === 0) return;
    setShowSource(false);
    setBatchRunning(true); setBatchMinimized(false); setShowBatch(true);
    const jobs: { source: string; job: any }[] = items.map((s) => ({ source: s.name, job: { status: 'queued', progress: 0, steps: [] } }));
    setBatchJobs(jobs.map((j) => ({ ...j })));
    try {
      if (dirty) await save();
      // Ставим задачи по порядку — чтобы очередь сохранила «первое, второе, третье».
      for (let k = 0; k < items.length; k++) {
        try {
          const res = await fetch(`/api/render/flow/${flowId}`, { method: 'POST', headers: headers(), body: JSON.stringify({ inputUrl: items[k].url }) });
          const d = await res.json();
          jobs[k].job = res.ok && d.job ? d.job : { status: 'failed', error: d?.error || `HTTP ${res.status}`, progress: 0, steps: [] };
        } catch (e: any) {
          jobs[k].job = { status: 'failed', error: e?.message || 'Ошибка', progress: 0, steps: [] };
        }
        setBatchJobs(jobs.map((j) => ({ ...j })));
      }
      // Поллим все незавершённые, пока не дойдут до done/failed (или таймаут поллера).
      const terminal = (st?: string) => st === 'done' || st === 'failed';
      for (let i = 0; i < 1200; i++) {
        if (jobs.every((j) => terminal(j.job?.status))) break;
        await new Promise((r) => setTimeout(r, 3000));
        await Promise.all(jobs.map(async (entry) => {
          if (!entry.job?.id || terminal(entry.job.status)) return;
          try {
            const pr = await fetch(`/api/render/${entry.job.id}`, { headers: headers() });
            if (pr.ok) entry.job = (await pr.json()).job;
          } catch { /* пропустим тик */ }
        }));
        setBatchJobs(jobs.map((j) => ({ ...j })));
      }
    } finally {
      setBatchRunning(false);
    }
  };

  const selected = nodes.find((n) => n.id === selectedId) || null;

  // ── Облачные узлы: позиции, связи-стрелки, перетаскивание ──────────────────
  const cloudPoint = (id: string): { x: number; y: number } | null => {
    const base = id === 'center' ? { x: 50, y: 50 } : (id === 'omni' || id === 'plan' || id === 'podcast' || id === 'editor') ? cloud[id] : null;
    // Точка соединения 🔗 — у верх-правого края узла (лента идёт от неё, не из центра).
    return base ? { x: base.x + 2.6, y: base.y - 3 } : null;
  };

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    setCloudEdges((es) => (es.some((e) => e.from === from && e.to === to) ? es : [...es, { from, to }]));
    setDirty(true);
  };

  const onCloudClick = (id: CloudId) => {
    if (movedRef.current) { movedRef.current = false; return; } // был drag узла — не открываем панель
    if (id === 'podcast') setDiarizeDone(false); // открыли — мигание погасло
    setCloudPanel(id);
  };

  // ── Облако «Редактор»: пикер видео из Галереи + склейка ──
  const loadEditorGallery = async () => {
    setEditorPick(true); setEditorGalLoading(true); setEditorNote(null); setEditorQuery('');
    try {
      // Как в Галерее: тренды + референс-видео + папка «Из анализа» + аудио — по вкладкам.
      const [v, r, an, au] = await Promise.all([
        fetch('/api/trends/videos?downloaded=1&limit=200', { headers: headers() }),
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
        fetch('/api/trends/media?folder=analyzed', { headers: headers() }),
        fetch('/api/trends/media?kind=audio', { headers: headers() }),
      ]);
      const vids = v.ok ? ((await v.json()).videos || []) : [];
      const refs = r.ok ? ((await r.json()).assets || []) : [];
      const analyzed = an.ok ? ((await an.json()).assets || []) : [];
      const audios = au.ok ? ((await au.json()).assets || []) : [];
      const seen = new Set<string>();
      const list: { url: string; name: string; cover?: string; type: 'video' | 'audio'; cat: EdCat }[] = [];
      const push = (url: string, name: string, type: 'video' | 'audio', cat: EdCat, cover?: string) => {
        if (url && !seen.has(url)) { seen.add(url); list.push({ url, name, cover, type, cat }); }
      };
      for (const x of vids) if (x.fileUrl) push(x.fileUrl, x.title || x.author || 'видео', 'video', 'trends', x.coverUrl);
      for (const m of analyzed) if (m.mediaType === 'video' && m.fileUrl) push(m.fileUrl, m.originalName || 'видео', 'video', 'analyzed');
      for (const m of refs) if (m.mediaType === 'video' && m.fileUrl) push(m.fileUrl, m.originalName || 'видео', 'video', 'reference');
      for (const m of audios) if (m.fileUrl) push(m.fileUrl, m.originalName || 'аудио', 'audio', 'audio');
      setEditorGallery(list);
      // Открыть первую непустую вкладку (приоритет — «Из анализа», где лежат проанализированные видео).
      const order: EdCat[] = ['analyzed', 'trends', 'reference', 'audio'];
      const firstNonEmpty = order.find((c) => list.some((it) => it.cat === c));
      if (firstNonEmpty) setEditorTab(firstNonEmpty);
    } catch { setEditorGallery([]); }
    finally { setEditorGalLoading(false); }
  };
  /** Загрузка «Медиа»/«Аудио» прямо из пикера — тот же эндпоинт, что в Галерее; затем перезагрузка списка. */
  const uploadEditorMedia = async (files: FileList | null, kind: 'reference' | 'audio') => {
    if (!files || files.length === 0) return;
    setEditorUploading(true); setEditorNote(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        // FormData: НЕ задаём Content-Type — браузер сам проставит boundary.
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(`/api/trends/media/upload?kind=${kind}`, {
          method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd,
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      }
      await loadEditorGallery();                                 // перезагрузить (как Галерея после аплоада)
      setEditorTab(kind === 'audio' ? 'audio' : 'reference');    // открыть вкладку, куда легло
    } catch (e: any) { setEditorNote(e?.message || 'Ошибка загрузки'); }
    finally {
      setEditorUploading(false);
      if (edMediaInputRef.current) edMediaInputRef.current.value = '';
      if (edAudioInputRef.current) edAudioInputRef.current.value = '';
    }
  };
  const addEditorClip = (c: { url: string; name: string; type?: 'video' | 'audio' }) => { setEditorClips((cs) => (cs.some((x) => x.url === c.url) ? cs : [...cs, c])); setDirty(true); };
  const removeEditorClip = (url: string) => { setEditorClips((cs) => cs.filter((x) => x.url !== url)); setDirty(true); };
  const mergeEditorClips = async () => {
    if (editorClips.length < 2 || editorMerging) return;
    if (editorClips.some((c) => c.type === 'audio')) { setEditorNote('Склейка — только для видео. Аудио редактируйте по одному (обрезка).'); return; }
    setEditorMerging(true); setEditorNote(null);
    try {
      const res = await fetch('/api/video-edit/merge', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ clips: editorClips.map((c) => ({ inputUrl: c.url })), name: name ? `Склейка — ${name}` : 'Склейка видео' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Ошибка ${res.status}`);
      setEditorResult({ url: d.fileUrl, name: 'Склейка видео', type: 'video' }); setDirty(true);
    } catch (e: any) { setEditorNote(e?.message || 'Не удалось склеить'); }
    finally { setEditorMerging(false); }
  };
  // Панель «Редактор» открыта → сразу показываем Галерею (пикер всегда виден снизу,
  // отдельная кнопка «Выбрать видео / аудио» не нужна — добавляем кликом по превью).
  useEffect(() => {
    if (cloudPanel === 'editor') loadEditorGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudPanel]);

  const setPend = (v: { from: string; x: number; y: number } | null) => { pendingRef.current = v; setPending(v); };
  // Старт перетягивания СТРЕЛКИ от точки 🔗 узла.
  const startConnect = (from: string, e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    const p = cloudPoint(from);
    setPend({ from, x: p?.x ?? 50, y: p?.y ?? 50 });
  };

  // Перетаскивание САМОГО УЗЛА (Omni/Контент-план).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      movedRef.current = true;
      const r = canvasRef.current.getBoundingClientRect();
      const x = Math.max(5, Math.min(95, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.max(5, Math.min(95, ((e.clientY - r.top) / r.height) * 100));
      setCloud((c) => ({ ...c, [dragRef.current as CloudId]: { x, y } }));
    };
    const up = () => { if (dragRef.current && movedRef.current) setDirty(true); dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  // Перетаскивание СТРЕЛКИ: тянем от 🔗 — линия следует за курсором; отпустили на узле → связь.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!pendingRef.current || !canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      setPend({ ...pendingRef.current, x, y });
    };
    const up = (e: PointerEvent) => {
      if (!pendingRef.current) return;
      const from = pendingRef.current.from;
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const to = el?.closest('[data-node-id]')?.getAttribute('data-node-id') || null;
      if (to && to !== from) addEdge(from, to);
      setPend(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const positions = useMemo(() => {
    const n = nodes.length;
    return nodes.map((_, i) => {
      const ang = (-90 + (360 / Math.max(n, 1)) * i) * Math.PI / 180;
      return { left: 50 + 27 * Math.cos(ang), top: 50 + 30 * Math.sin(ang) };
    });
  }, [nodes]);

  // Какой блок цепочки прямо сейчас исполняется воркером (для подсветки узла при сборке).
  const runningKind: MKind | null = building
    ? ((buildJob?.steps || []).find((s: any) => s?.status === 'running')?.kind ?? null)
    : null;
  // Цепочка умеет собираться «с нуля» (без исходника): есть Новости или Озвучка с текстом/✨.
  const canBuildWithoutSource = nodes.some((n) => n.kind === 'news' || (n.kind === 'voiceover' && (n.useLlm || (n.text || '').trim())));

  if (loading) {
    return <div className="flex items-center justify-center" style={{ height: '70vh' }}><Loader2 size={26} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 8px)', position: 'relative' }}>
      <style>{`
        .me-node{transition:transform .18s cubic-bezier(.34,1.56,.64,1), filter .18s ease;}
        .me-line-flow{animation:meLineFlow 1.1s linear infinite;}
        @keyframes meLineFlow{to{stroke-dashoffset:9.2;}}
        .me-node:hover{transform:translate(-50%,-50%) scale(1.12);filter:brightness(1.3);}
        .me-node-in{animation:meNodeIn .45s cubic-bezier(.34,1.56,.64,1) backwards;}
        @keyframes meNodeIn{from{opacity:0;transform:translate(-50%,-50%) scale(.3)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        .me-pop-in{animation:mePop .2s ease;}
        @keyframes mePop{from{opacity:0;transform:translate(-50%,-50%) scale(.6)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        /* центр — обработка */
        .me-build{animation:meBuildPulse 1.6s ease-in-out infinite!important;}
        @keyframes meBuildPulse{0%,100%{box-shadow:0 0 30px rgba(99,102,241,.5)}50%{box-shadow:0 0 64px rgba(99,102,241,1)}}
        .me-ring{position:absolute;left:50%;top:50%;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;border:3px solid transparent;border-top-color:var(--brand);border-right-color:rgba(99,102,241,.35);animation:meSpin 1s linear infinite;pointer-events:none;}
        @keyframes meSpin{to{transform:rotate(360deg)}}
        /* шиммер прогресса */
        .me-shimmer{background:linear-gradient(90deg,var(--brand),#c7d2fe,var(--brand));background-size:200% 100%;animation:meShimmer 1.3s linear infinite;}
        @keyframes meShimmer{to{background-position:-200% 0}}
        .me-fab{transition:transform .15s ease, filter .15s ease, box-shadow .15s ease;}
        .me-fab:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.06);box-shadow:0 12px 32px rgba(99,102,241,.6);}
        .me-fab:active:not(:disabled){transform:translateY(0) scale(.97);}
        /* нижнее поле */
        .me-addbar{transition:box-shadow .25s ease, transform .2s ease, border-color .25s ease;}
        .me-addbar:hover,.me-addbar:focus-within{transform:translateY(-2px);box-shadow:0 10px 30px rgba(99,102,241,.18);border-color:var(--brand)!important;}
        /* плавающая пилюля рендера */
        .me-float-in{animation:meFloatIn .3s cubic-bezier(.34,1.56,.64,1);}
        @keyframes meFloatIn{from{opacity:0;transform:translateY(14px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
        .me-dot{animation:meDot 1.4s ease-in-out infinite;}
        @keyframes meDot{0%,100%{opacity:.3}50%{opacity:1}}
        .me-ready{animation:meReady 1.1s ease-in-out infinite;}
        @keyframes meReady{0%,100%{box-shadow:0 8px 26px rgba(16,185,129,.4);transform:scale(1)}50%{box-shadow:0 10px 40px rgba(16,185,129,.95);transform:scale(1.05)}}
        /* контур генерации: ПОД иконкой (z-index:-1), переливается (hue-rotate) + циклически «дышит» (scale) */
        .me-busyring{position:absolute;width:74px;height:74px;border-radius:50%;top:-8px;left:50%;transform:translateX(-50%);background:conic-gradient(from 0deg,#ec4899,#818cf8,#34d399,#fbbf24,#f472b6,#ec4899);animation:meShine 2.6s linear infinite, mePulse 1.7s ease-in-out infinite;-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 3px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,#0000 calc(100% - 3px),#000 calc(100% - 3px));pointer-events:none;z-index:-1;will-change:transform,filter;}
        @keyframes meShine{0%{filter:hue-rotate(0deg) saturate(1.15)}50%{filter:hue-rotate(180deg) saturate(1.5)}100%{filter:hue-rotate(360deg) saturate(1.15)}}
        @keyframes mePulse{0%,100%{transform:translateX(-50%) scale(.78);opacity:.7}50%{transform:translateX(-50%) scale(1.08);opacity:1}}
        /* всплывающая подсказка при наведении (ⓘ) */
        .me-tip{position:relative;display:inline-flex;align-items:center;}
        .me-tip-pop{display:none;position:absolute;bottom:calc(100% + 8px);right:0;width:290px;padding:10px 12px;border-radius:10px;background:var(--bg-secondary);border:1px solid var(--border-medium);color:var(--text-secondary);font-size:11px;line-height:1.5;z-index:96;box-shadow:0 10px 30px rgba(0,0,0,.35);white-space:normal;text-align:left;}
        .me-tip:hover .me-tip-pop,.me-tip:focus-within .me-tip-pop{display:block;}
        /* раскрытие — пружинка (быстро, мультяшно) */
        .me-grow{animation:meGrow .26s cubic-bezier(.34,1.7,.5,1);transform-origin:bottom center;}
        @keyframes meGrow{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
        /* веер иконок процессов из плавающей «+» */
        .me-fan-item{animation:meFan .28s cubic-bezier(.34,1.6,.64,1) backwards;transition:transform .12s ease, border-color .12s ease;}
        @keyframes meFan{from{opacity:0;transform:translate(-16px,-16px) scale(.4)}to{opacity:1;transform:translate(0,0) scale(1)}}
        .me-fan-item:hover{border-color:var(--brand)!important;transform:scale(1.1);}
      `}</style>

      {/* Верхняя панель */}
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-medium)' }}>
        <button onClick={async () => { if (dirty) { try { await save(); } catch { /* */ } } onBack(); }} title="Назад" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><ArrowLeft size={16} /></button>
        {nameEdit ? (
          <input autoFocus value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            onBlur={() => { setNameEdit(false); save(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setNameEdit(false); save(); } }}
            className="text-base font-700 px-2 py-1 rounded-lg outline-none"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--brand)', maxWidth: 320 }} />
        ) : (
          <button onClick={() => setNameEdit(true)} title="Переименовать сценарий"
            className="inline-flex items-center gap-1.5 text-base font-700"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
            {name} <Pencil size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
        <div className="flex-1" />
        <button onClick={undo} disabled={!canUndo} title="Назад (Ctrl+Z)"
          className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: canUndo ? 'pointer' : 'not-allowed' }}><Undo2 size={15} /></button>
        <button onClick={redo} disabled={!canRedo} title="Вперёд (Ctrl+Shift+Z)"
          className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: canRedo ? 'pointer' : 'not-allowed' }}><Redo2 size={15} /></button>
        <button onClick={() => setShowBrief(true)} title="Общий сценарий ролика — главный промт для ИИ-режиссёра"
          className="inline-flex items-center gap-1.5 text-sm font-600 px-3 py-1.5 rounded-lg"
          style={{ background: brief.trim() ? 'rgba(99,102,241,0.14)' : 'var(--bg-tertiary)', color: brief.trim() ? 'var(--brand)' : 'var(--text-secondary)', border: `1px solid ${brief.trim() ? 'rgba(99,102,241,0.4)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
          <Sparkles size={15} /> Сценарий{brief.trim() ? ' ✓' : ''}
        </button>
        {(dna || dnaLoading) && (
          <button onClick={() => dna && setShowDnaPanel(true)} disabled={!dna} title="Заполнить блоки сценария по данным тренда"
            className="inline-flex items-center gap-1.5 text-sm font-600 px-3 py-1.5 rounded-lg disabled:opacity-60"
            style={{ background: 'rgba(99,102,241,0.14)', color: 'var(--brand)', border: '1px solid rgba(99,102,241,0.4)', cursor: dna ? 'pointer' : 'wait' }}>
            {dnaLoading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Из тренда
          </button>
        )}
        <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 text-sm font-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Сохранить
        </button>
        {/* «Собрать» в шапке — всегда видима (плавающую кнопку перекрывают модалки панелей). */}
        <button onClick={build} disabled={building || batchRunning || nodes.length === 0}
          title={nodes.length === 0 ? 'Добавьте блоки в сценарий' : !sourceUrl ? 'Сначала выберите исходное видео (центральный узел)' : 'Собрать ролик из сценария'}
          className="inline-flex items-center gap-1.5 text-sm font-700 px-3.5 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: 'var(--brand-contrast)', border: 'none',
            cursor: building ? 'wait' : nodes.length === 0 ? 'not-allowed' : 'pointer' }}>
          {building ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
          {building ? `Собираю… ${buildJob?.progress || 0}%` : 'Собрать'}
        </button>
      </div>

      {/* Холст-паутина (верхние чипы убраны — добавление через плавающую «+» слева сверху) */}
      <div ref={canvasRef} className="flex-1" style={{ position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 42%, rgba(99,102,241,0.05), transparent 60%), var(--bg-primary)',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>

        {/* Плавающая «+» (левый верхний угол): клик → веером выезжают иконки процессов (без подписей) */}
        <div style={{ position: 'absolute', left: 14, top: 14, zIndex: 40 }}>
          <button onClick={() => setAddOpen((o) => !o)} title={addOpen ? 'Закрыть' : 'Добавить процесс'}
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: '1px solid var(--brand)', boxShadow: '0 6px 20px rgba(99,102,241,.3)', cursor: 'pointer', transition: 'transform .25s cubic-bezier(.34,1.6,.64,1)', transform: addOpen ? 'rotate(135deg)' : 'none' }}>
            <Plus size={22} />
          </button>
          {addOpen && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, maxWidth: 176 }}>
              {KIND_ORDER.map((k, i) => (
                <button key={k} onClick={() => { addNode(k); setAddOpen(false); }} title={META[k].label}
                  className="me-fan-item w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--brand)', cursor: 'pointer', animationDelay: `${i * 0.03}s` }}>
                  {React.cloneElement(META[k].icon as any, { size: 17 })}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Плавающая кнопка «Собрать видео» — всегда под рукой (правый нижний угол холста) */}
        <button onClick={build} disabled={building || batchRunning || nodes.length === 0}
          title={nodes.length === 0 ? 'Добавьте процессы в сценарий' : 'Собрать ролик из сценария'}
          className="me-fab"
          style={{ position: 'absolute', right: 18, bottom: 18, zIndex: 45, display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 20px', borderRadius: 999, border: 'none', fontSize: 15, fontWeight: 800,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: 'var(--brand-contrast)',
            boxShadow: '0 8px 26px rgba(99,102,241,0.5)', cursor: building ? 'wait' : nodes.length === 0 ? 'not-allowed' : 'pointer',
            opacity: nodes.length === 0 ? 0.5 : 1 }}>
          {building ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
          {building ? `Собираю… ${buildJob?.progress || 0}%` : 'Собрать видео'}
        </button>

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
          {positions.map((p, i) => (
            <line key={i} x1="50" y1="50" x2={p.left} y2={p.top}
              className={building ? 'me-line-flow' : undefined}
              stroke={building ? 'rgba(129,140,248,0.55)' : 'var(--border-strong)'}
              strokeWidth={building ? 0.26 : 0.18}
              strokeDasharray={building ? '1.4 3.2' : undefined} />
          ))}
        </svg>

        {/* «Сценарий» — над центральным узлом (просьба юзера): главный промт всегда на виду */}
        <button onClick={() => setShowBrief(true)} title="Общий сценарий ролика — главный промт для ИИ-режиссёра (все ✨-шаги читают его)"
          style={{ position: 'absolute', left: '50%', top: 'calc(50% - 84px)', transform: 'translateX(-50%)', zIndex: 7,
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: brief.trim() ? 'rgba(99,102,241,0.16)' : 'var(--bg-secondary)', color: brief.trim() ? 'var(--brand)' : 'var(--text-secondary)',
            border: `1px ${brief.trim() ? 'solid rgba(99,102,241,0.5)' : 'dashed var(--border-strong)'}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Sparkles size={13} /> {brief.trim() ? `Сценарий ✓ ${brief.trim().slice(0, 26)}${brief.trim().length > 26 ? '…' : ''}` : 'Сценарий ролика — задайте тон ИИ'}
        </button>

        <button data-node-id="center" onClick={() => openSourcePicker()} title={building ? 'Идёт сборка…' : 'Выбрать исходное видео'}
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', background: 'transparent', border: 'none', cursor: building ? 'default' : 'pointer' }}>
          <div style={{ position: 'relative', width: 76, height: 76, margin: '0 auto' }}>
            {building && <span className="me-ring" />}
            <div className={building ? 'me-build' : undefined} style={{ width: 76, height: 76, borderRadius: '50%', overflow: 'hidden',
              background: sourceUrl ? '#000' : 'radial-gradient(circle at 36% 34%, #fff, #818cf8 50%, var(--brand) 100%)',
              boxShadow: '0 0 36px rgba(99,102,241,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-contrast)',
              border: sourceUrl ? '2px solid var(--brand)' : 'none' }}>
              <Video size={28} color={sourceUrl ? 'var(--brand)' : undefined} className={building ? 'animate-pulse' : undefined} />
            </div>
          </div>
          <div className="text-[11px] mt-2" style={{ color: building ? 'var(--brand)' : sourceUrl ? 'var(--brand)' : 'var(--text-secondary)', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--bg-primary)', padding: '1px 7px', borderRadius: 6, display: 'inline-block' }}>
            {building ? `Собираю… ${buildJob?.progress || 0}%` : sourceUrl ? (sourceName || 'видео выбрано') : canBuildWithoutSource ? 'Без исходника — из материалов' : 'Видео из галереи'}
          </div>
        </button>
        {/* 🔗 связать стрелкой ОТ «Видео из галереи» */}
        <button onPointerDown={(e) => startConnect('center', e)}
          title="Потяните, чтобы провести стрелку"
          style={{ position: 'absolute', left: 'calc(50% + 32px)', top: 'calc(50% - 32px)', transform: 'translate(-50%,-50%)', zIndex: 9, width: 24, height: 24, borderRadius: '50%', background: pending?.from === 'center' ? 'var(--brand)' : 'var(--bg-secondary)', border: '2px solid var(--brand)', color: pending?.from === 'center' ? '#fff' : 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair', padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', touchAction: 'none' }}>
          <Link2 size={13} />
        </button>

        {nodes.map((n, i) => (
          <button key={n.id} onClick={() => setSelectedId(n.id)} className="me-node me-node-in"
            style={{ position: 'absolute', left: `${positions[i].left}%`, top: `${positions[i].top}%`, transform: 'translate(-50%,-50%)', animationDelay: `${i * 0.05}s`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            {runningKind === n.kind && <span className="me-busyring" style={{ width: 60, height: 60, top: -7 }} />}
            <span style={{ width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-secondary)', border: `${selectedId === n.id ? 2 : 1}px solid ${selectedId === n.id ? 'var(--brand)' : 'var(--border-strong)'}`,
              color: selectedId === n.id ? 'var(--brand)' : 'var(--text-secondary)' }}>{META[n.kind].icon}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', background: 'var(--bg-primary)', padding: '0 5px', borderRadius: 5 }}>{META[n.kind].label}</span>
            {nodeSummary(n) && (
              <span style={{ fontSize: 9, lineHeight: 1.15, color: 'var(--brand)', maxWidth: 96, textAlign: 'center', whiteSpace: 'normal', fontWeight: 600, background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: 5 }}>{nodeSummary(n)}</span>
            )}
            {(n.mediaUrl || n.useLlm) && (
              <span style={{ position: 'absolute', top: -2, right: 4, display: 'inline-flex', gap: 2 }}>
                {n.mediaUrl && <Paperclip size={11} style={{ color: '#10b981' }} />}
                {n.useLlm && <Sparkles size={11} style={{ color: 'var(--brand)' }} />}
              </span>
            )}
          </button>
        ))}

        {nodes.length === 0 && (
          <div style={{ position: 'absolute', left: '50%', top: '64%', transform: 'translateX(-50%)', textAlign: 'center' }}>
            <button onClick={() => setShowPresets(true)} className="text-sm font-600 px-4 py-2 rounded-xl"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Выбрать пресет сценария</button>
          </div>
        )}

        {/* ── Облачные узлы (Omni / Контент-план) + связи-стрелки ── */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} aria-hidden="true">
          {cloudEdges.map((e, i) => {
            const p = cloudPoint(e.from), q = cloudPoint(e.to);
            if (!p || !q) return null;
            return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--brand)" strokeWidth="0.35" strokeDasharray="1.4 0.9" />;
          })}
          {pending && (() => { const p = cloudPoint(pending.from); return p ? <line x1={p.x} y1={p.y} x2={pending.x} y2={pending.y} stroke="var(--brand)" strokeWidth="0.4" strokeDasharray="1.4 0.9" /> : null; })()}
        </svg>
        {cloudEdges.map((e, i) => {
          const p = cloudPoint(e.from), q = cloudPoint(e.to);
          if (!p || !q) return null;
          const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          return (
            <button key={'ce' + i} onClick={() => { setCloudEdges((es) => es.filter((_, j) => j !== i)); setDirty(true); }} title="Удалить связь"
              style={{ position: 'absolute', left: `${mx}%`, top: `${my}%`, transform: 'translate(-50%,-50%)', zIndex: 6, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--brand)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <X size={11} />
            </button>
          );
        })}
        {/* «Контент-план» скрыт до реализации (этап C): узел был пустым стабом. */}
        {(['omni', 'podcast', 'editor'] as CloudId[]).map((id) => {
          const pos = cloud[id]; const cfg = CLOUD[id];
          return (
            <div key={id} data-node-id={id} onPointerDown={() => { dragRef.current = id; movedRef.current = false; }}
              style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', zIndex: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'grab', touchAction: 'none', userSelect: 'none' }}>
              {id === 'podcast' && (!!podBusy || building || !!angleBusy || animBusy || composeBusy) && <span className="me-busyring" />}
              {id === 'omni' && omniBusy && <span className="me-busyring" />}
              <button onClick={() => onCloudClick(id)} title={cfg.label}
                style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: pending?.from === id ? 'var(--btn-primary-bg)' : 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))',
                  border: `2px solid ${pending?.from === id ? 'var(--brand)' : cfg.color}`, color: cfg.color, boxShadow: `0 6px 22px ${cfg.glow}`, cursor: 'pointer' }}>
                {cfg.icon}
              </button>
              {id === 'podcast' && diarizeDone && (
                <span className="me-dot" title="Разбор записи готов" style={{ position: 'absolute', top: -3, left: -3, width: 15, height: 15, borderRadius: '50%', background: '#10b981', border: '2px solid var(--bg-primary)', boxShadow: '0 0 10px #10b981' }} />
              )}
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', background: 'var(--bg-primary)', padding: '0 5px', borderRadius: 5 }}>{cfg.label}</span>
              <button onPointerDown={(e) => startConnect(id, e)} title="Потяните, чтобы провести стрелку"
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: pending?.from === id ? 'var(--brand)' : 'var(--bg-secondary)', border: '1px solid var(--brand)', color: pending?.from === id ? '#fff' : 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair', padding: 0, touchAction: 'none' }}>
                <Link2 size={11} />
              </button>
            </div>
          );
        })}
        {pending && (
          <div style={{ position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)', zIndex: 12, background: 'var(--bg-secondary)', border: '1px solid var(--brand)', borderRadius: 999, padding: '4px 12px', fontSize: 12, color: 'var(--brand)', fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Тяните к узлу и отпустите, чтобы связать
          </div>
        )}
      </div>

      {/* Панель раскрытого узла */}
      {selected && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, margin: '0 12px 84px', maxHeight: '72vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}><span style={{ color: 'var(--brand)' }}>{META[selected.kind].icon}</span> {META[selected.kind].label}</span>
              <button onClick={() => setSelectedId(null)} title="Закрыть" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{META[selected.kind].hint}</p>

            {/* Кнопки-выборы */}
            {META[selected.kind].choices?.map((c) => (
              <div key={c.id} className="mb-3">
                <div className="text-[11px] font-600 mb-1.5" style={{ color: 'var(--text-muted)' }}>{c.label}{c.multi ? ' (можно несколько)' : ''}</div>
                <div className="flex flex-wrap gap-1.5">
                  {c.opts.map((o) => {
                    const sel = (selected.choices[c.id] || []).includes(o.v);
                    return (
                      <button key={o.v} onClick={() => setChoice(selected.id, c, o.v)} className="inline-flex items-center gap-1 text-xs font-600 px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ background: sel ? 'var(--brand)' : 'var(--bg-tertiary)', color: sel ? 'var(--brand-contrast)' : 'var(--text-secondary)', border: `1px solid ${sel ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                        {sel && <Check size={12} />}{o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Длина: визуальная нарезка на ленте исходного видео */}
            {selected.kind === 'length' && (
              <div className="mb-3">
                <div className="text-[11px] font-600 mb-1.5" style={{ color: 'var(--text-muted)' }}>Нарезка на ленте</div>
                {!sourceUrl ? (
                  <button onClick={() => { setSelectedId(null); openSourcePicker(); }}
                    className="w-full py-2.5 rounded-xl text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--brand)', border: '1px dashed var(--brand)', cursor: 'pointer' }}>
                    <Video size={14} /> Выберите исходное видео, чтобы резать по ленте →
                  </button>
                ) : (
                  <>
                    <video src={sourceUrl} controls preload="metadata"
                      onLoadedMetadata={(e) => setSrcDuration(e.currentTarget.duration || 0)}
                      style={{ width: '100%', maxHeight: 170, borderRadius: 10, background: '#000', marginBottom: 8 }} />
                    <div className="relative w-full mb-1.5" style={{ height: 30, borderRadius: 7, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 2, bottom: 2, left: `${lenSel.start * 100}%`, width: `${Math.max(0.02, lenSel.end - lenSel.start) * 100}%`, background: 'rgba(99,102,241,0.85)', borderRadius: 5 }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <span>С: <b style={{ color: 'var(--brand)' }}>{fmtT(lenSel.start)}</b></span>
                      <span>По: <b style={{ color: 'var(--brand)' }}>{fmtT(lenSel.end)}</b></span>
                    </div>
                    <input type="range" min={0} max={1} step={0.005} value={lenSel.start}
                      onChange={(e) => { const v = Math.min(parseFloat(e.target.value), lenSel.end - 0.02); writeLenRange(selected.id, { start: Math.max(0, v), end: lenSel.end }); }}
                      className="w-full" style={{ accentColor: 'var(--brand)' }} />
                    <input type="range" min={0} max={1} step={0.005} value={lenSel.end}
                      onChange={(e) => { const v = Math.max(parseFloat(e.target.value), lenSel.start + 0.02); writeLenRange(selected.id, { start: lenSel.start, end: Math.min(1, v) }); }}
                      className="w-full" style={{ accentColor: 'var(--brand)' }} />
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Отрезок пишется в поле диапазона ниже. Пресеты «15/30/60с», «Лучший момент» и «Весь» — альтернатива нарезке.</p>
                  </>
                )}
              </div>
            )}

            {/* Экспорт: подключение аккаунтов + запуск передачи в API площадок */}
            {selected.kind === 'export' && (
              <div className="mb-3 space-y-2.5">
                <div className="text-[11px] font-600" style={{ color: 'var(--text-muted)' }}>Аккаунты площадок</div>
                <div className="flex flex-wrap gap-1.5">
                  {(selected.choices.platforms || []).length === 0 ? (
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Выберите площадки выше.</span>
                  ) : (selected.choices.platforms || []).map((p) => {
                    const on = connected.has(p);
                    return (
                      <button key={p} onClick={() => setConnected((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; })}
                        title={on ? 'Аккаунт подключён (нажмите, чтобы отвязать)' : 'Подключить аккаунт площадки'}
                        className="inline-flex items-center gap-1.5 text-[11px] font-600 px-2.5 py-1.5 rounded-lg"
                        style={{ background: on ? 'rgba(16,185,129,0.12)' : 'var(--bg-tertiary)', color: on ? '#10b981' : 'var(--text-secondary)', border: `1px solid ${on ? 'rgba(16,185,129,0.4)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                        {on ? <Check size={12} /> : <Link2 size={12} />} {on ? `${p} ✓` : `Подключить ${p}`}
                      </button>
                    );
                  })}
                </div>
                <button onClick={startExport} disabled={exporting || (selected.choices.platforms || []).length === 0}
                  className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-50 relative overflow-hidden"
                  style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: '1px solid var(--brand)', cursor: exporting ? 'wait' : 'pointer' }}>
                  {exporting && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${exportPct}%`, background: 'rgba(99,102,241,0.18)', transition: 'width .2s' }} />}
                  <span className="relative inline-flex items-center gap-2">
                    {exporting ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                    {exporting ? `Передаю в API… ${exportPct}%` : exportPct === 100 ? 'Отправлено ✓ — повторить' : 'Начать экспорт'}
                  </span>
                </button>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Реальная публикация в соцсети — раздел «Публикатор» (этап C). Здесь — постановка площадок и запуск передачи.</p>
              </div>
            )}

            {/* Текст (опц.) */}
            {META[selected.kind].text && (
              <textarea value={selected.text} onChange={(e) => patchNode(selected.id, { text: e.target.value })} rows={2} placeholder={META[selected.kind].text}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', resize: 'vertical' }} />
            )}

            {/* Медиа + ЛЛМ. «Медиафайлы» (broll) принимает НЕСКОЛЬКО файлов — чипы с ✕. */}
            {(META[selected.kind].media || META[selected.kind].llm) && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {selected.kind === 'broll' ? (
                  <>
                    {(selected.medias || []).map((m) => (
                      <span key={m.url} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                        <Paperclip size={13} /> <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                        <button title="Удалить файл" onClick={() => patchNode(selected.id, { medias: (selected.medias || []).filter((x) => x.url !== m.url) })}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'inline-flex' }}><Trash2 size={12} /></button>
                      </span>
                    ))}
                    <button onClick={() => openAttach(selected.id)} className="inline-flex items-center gap-1.5 text-xs font-600 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-strong)', cursor: 'pointer' }}>
                      <Plus size={13} /> {(selected.medias || []).length ? 'Добавить ещё' : META[selected.kind].media}
                    </button>
                  </>
                ) : META[selected.kind].media && (selected.mediaUrl ? (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <Paperclip size={13} /> {selected.mediaName || 'файл'}
                    <button onClick={() => patchNode(selected.id, { mediaUrl: null, mediaName: null })} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={12} /></button>
                  </span>
                ) : (
                  <button onClick={() => openAttach(selected.id)} className="inline-flex items-center gap-1.5 text-xs font-600 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                    <Paperclip size={13} /> {META[selected.kind].media}
                  </button>
                ))}
                {META[selected.kind].llm && (
                  <button onClick={() => patchNode(selected.id, { useLlm: !selected.useLlm })} className="inline-flex items-center gap-1.5 text-xs font-600 px-2.5 py-1.5 rounded-lg"
                    style={{ background: selected.useLlm ? 'rgba(99,102,241,0.15)' : 'var(--bg-tertiary)', color: selected.useLlm ? 'var(--brand)' : 'var(--text-secondary)', border: `1px solid ${selected.useLlm ? 'rgba(99,102,241,0.4)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                    <Sparkles size={13} /> ЛЛМ {selected.useLlm ? 'вкл' : 'выкл'}
                  </button>
                )}
              </div>
            )}

            {/* Что сделает ИИ-режиссёр при включённом ЛЛМ */}
            {META[selected.kind].llm && selected.useLlm && DIR_HINT[selected.kind] && (
              <p className="text-[11px] mb-4 flex items-start gap-1.5" style={{ color: 'var(--brand)' }}>
                <Sparkles size={12} className="mt-[1px] flex-shrink-0" /> {DIR_HINT[selected.kind]}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button onClick={() => removeNode(selected.id)} title="Удалить узел из сценария"
                className="inline-flex items-center justify-center gap-1.5 text-sm font-600 px-3 py-2.5 rounded-xl flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                <Trash2 size={15} /> Удалить
              </button>
              <button onClick={() => setSelectedId(null)} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-700 py-2.5 rounded-xl"
                style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}><Check size={16} /> Готово</button>
            </div>
          </div>
        </div>
      )}

      {/* Выбор процесса */}
      {showPicker && (
        <div onClick={() => setShowPicker(false)} style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} className="me-grow" style={{ width: '100%', maxWidth: 560, margin: '0 12px 88px', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <div className="text-sm font-700 mb-3" style={{ color: 'var(--text-primary)' }}>Добавить процесс</div>
            <div className="grid grid-cols-3 gap-2">
              {KIND_ORDER.map((k) => (
                <button key={k} onClick={() => addNode(k)} className="flex flex-col items-center gap-1.5 py-3 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }} title={META[k].hint}>
                  <span style={{ color: 'var(--brand)' }}>{META[k].icon}</span>
                  <span className="text-[11px]">{META[k].label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Витрина пресетов */}
      {showPresets && (
        <div onClick={() => setShowPresets(false)} style={{ position: 'absolute', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 640, maxHeight: '86vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Выберите пресет сценария</span>
              <button onClick={() => setShowPresets(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div className="space-y-4">
              {PRESET_GROUPS.map((g) => (
                <div key={g.group}>
                  <div className="text-[11px] font-700 uppercase mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{g.group}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {g.presets.map((p) => (
                      <button key={p.name} onClick={() => applyPreset(p)} className="text-left p-3 rounded-xl transition-colors hover:border-[var(--text-accent)]" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                        <div className="text-sm font-700 mb-1" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{p.kinds.map((k) => META[typeof k === 'string' ? k : k.kind].label).join(' · ')}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Выбор медиа: из Галереи + загрузка с устройства + drag-and-drop */}
      {attachFor && (
        <div onClick={() => { setAttachFor(null); setDragOver(false); }} style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.files?.length) uploadMediaFiles(e.dataTransfer.files); }}
            style={{ width: '100%', maxWidth: 560, maxHeight: '82vh', overflow: 'auto', background: 'var(--bg-secondary)', border: `1px solid ${dragOver ? 'var(--brand)' : 'var(--border-medium)'}`, borderRadius: 16, padding: 16, transform: 'none', outline: dragOver ? '2px dashed var(--brand)' : 'none', outlineOffset: -6 }}>
            <input ref={attachInputRef} type="file" multiple accept="image/*,video/*,audio/*" style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.length) uploadMediaFiles(e.target.files); e.currentTarget.value = ''; }} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                {nodes.find((x) => x.id === attachFor)?.kind === 'broll'
                  ? `Медиафайлы — выбрано: ${(nodes.find((x) => x.id === attachFor)?.medias || []).length} (клик добавляет/убирает)`
                  : 'Медиа'}
              </span>
              <button onClick={() => setAttachFor(null)} className="inline-flex items-center gap-1 text-xs font-600 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                {nodes.find((x) => x.id === attachFor)?.kind === 'broll' ? <><Check size={14} /> Готово</> : <X size={16} />}
              </button>
            </div>

            {/* Зона загрузки с устройства / drag-and-drop */}
            <button onClick={() => attachInputRef.current?.click()} disabled={uploading}
              className="w-full mb-3 rounded-xl flex flex-col items-center justify-center gap-1.5 py-5 transition-colors"
              style={{ background: dragOver ? 'rgba(99,102,241,0.08)' : 'var(--bg-tertiary)', border: `1.5px dashed ${dragOver ? 'var(--brand)' : 'var(--border-strong)'}`, color: dragOver ? 'var(--brand)' : 'var(--text-secondary)', cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? <Loader2 size={20} className="animate-spin" style={{ color: 'var(--brand)' }} /> : <Plus size={20} style={{ color: 'var(--brand)' }} />}
              <span className="text-[13px] font-600">{uploading ? 'Загружаю…' : 'Загрузить с устройства'}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>с компьютера/телефона или перетащите файлы сюда → попадут в Галерею</span>
            </button>

            <div className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>Из Галереи</div>
            {media.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Пока пусто. Загрузите файл выше или добавьте во вкладке «Галерея».</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m) => {
                  const attachNode = nodes.find((x) => x.id === attachFor);
                  const multi = attachNode?.kind === 'broll';
                  const added = multi && (attachNode?.medias || []).some((x) => x.url === m.fileUrl);
                  return (
                  <button key={m.id} onClick={() => {
                    if (multi) {
                      // «Медиафайлы»: клик добавляет/убирает, пикер не закрываем — можно добрать ещё.
                      const list = attachNode?.medias || [];
                      patchNode(attachFor!, { medias: added ? list.filter((x) => x.url !== m.fileUrl) : [...list, { url: m.fileUrl, name: m.title }] });
                    } else {
                      patchNode(attachFor!, { mediaUrl: m.fileUrl, mediaName: m.title });
                      setAttachFor(null);
                    }
                  }} className="rounded-xl overflow-hidden text-left" style={{ position: 'relative', background: 'var(--bg-tertiary)', border: `2px solid ${added ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                    {added && (
                      <span style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--brand)', color: 'var(--brand-contrast)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} /></span>
                    )}
                    <div style={{ aspectRatio: '1 / 1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.kind === 'image' ? <img src={m.fileUrl} alt="" className="w-full h-full object-cover" />
                        : m.kind === 'audio' ? <Music size={22} style={{ color: 'var(--brand)' }} />
                        : <Video size={22} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{m.title}</div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Подкаст: выбор медиа (фото ведущих / картинка-вставка / запись) */}
      {podPick && (
        <div onClick={() => setPodPick(null)} style={{ position: 'absolute', inset: 0, zIndex: 94, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, maxHeight: '82vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <input ref={podPickInputRef} type="file" multiple accept={podPick === 'music' ? 'audio/*' : podPick === 'recording' ? 'audio/*,video/*' : (podPick === 'lineimg' || podPick === 'cutaway') ? 'image/*,video/*' : 'image/*'} style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.length) uploadPodFiles(e.target.files); e.currentTarget.value = ''; }} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                {podPick === 'recording' ? 'Запись подкаста' : podPick === 'music' ? 'Фоновая музыка (весь ролик)' : podPick === 'lineimg' ? 'Медиа к реплике (фото или видео)' : podPick === 'cutaway' ? 'Картинка-вставка' : podPick === 'group' ? 'Групповое фото ведущих' : `Фото — ${podPick === 'hostA' ? pod.hostA.name : pod.hostB.name}`}
              </span>
              <button onClick={() => setPodPick(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <button onClick={() => podPickInputRef.current?.click()} disabled={podBusy === 'upload'}
              className="w-full mb-3 rounded-xl flex flex-col items-center justify-center gap-1.5 py-5"
              style={{ background: 'var(--bg-tertiary)', border: '1.5px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: podBusy === 'upload' ? 'wait' : 'pointer' }}>
              {podBusy === 'upload' ? <Loader2 size={20} className="animate-spin" style={{ color: '#ec4899' }} /> : <Plus size={20} style={{ color: '#ec4899' }} />}
              <span className="text-[13px] font-600">{podBusy === 'upload' ? 'Загружаю…' : 'Загрузить с устройства'}</span>
            </button>
            <div className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>Из Галереи — папки и поиск</div>
            {(() => {
              const wantAudio = podPick === 'recording';
              const wantMedia = podPick === 'lineimg' || podPick === 'cutaway'; // фото ИЛИ видео
              const kindOk = (m: typeof media[number]) => podPick === 'music' ? m.kind === 'audio'
                : wantAudio ? (m.kind === 'audio' || m.kind === 'video')
                : wantMedia ? (m.kind === 'image' || m.kind === 'video') : m.kind === 'image';
              const base = media.filter(kindOk);
              const TABS = ([['all', 'Все'], ['trends', 'Тренды'], ['reference', 'Референс'], ['audio', 'Аудио'], ['analyzed', 'Из анализа']] as const)
                .filter(([k]) => k === 'all' || base.some((m) => m.folder === k));
              const q = podPickQ.trim().toLowerCase();
              const items = base.filter((m) => (podPickTab === 'all' || m.folder === podPickTab) && (!q || m.title.toLowerCase().includes(q)));
              return (
                <>
                  {TABS.length > 2 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {TABS.map(([k, lbl]) => (
                        <button key={k} onClick={() => setPodPickTab(k)} className="text-[11px] font-600 px-2.5 py-1 rounded-lg" style={{ background: podPickTab === k ? '#ec4899' : 'var(--bg-tertiary)', color: podPickTab === k ? '#fff' : 'var(--text-secondary)', border: `1px solid ${podPickTab === k ? '#ec4899' : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
                      ))}
                    </div>
                  )}
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={podPickQ} onChange={(e) => setPodPickQ(e.target.value)} placeholder="Поиск по названию…"
                      className="w-full py-1.5 rounded-lg text-[12px] outline-none" style={{ paddingLeft: 26, paddingRight: 8, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                  </div>
                  {items.length === 0 ? (
                    <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Ничего не найдено. Загрузите файл выше или добавьте в «Галерею».</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {items.map((m) => (
                        <button key={m.id} onClick={() => applyPodMedia(podPick, { fileUrl: m.fileUrl, title: m.title })} className="rounded-xl overflow-hidden text-left" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                          <div style={{ position: 'relative', aspectRatio: '1 / 1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {m.kind === 'image' ? <img src={m.fileUrl} alt="" className="w-full h-full object-cover" />
                              : m.kind === 'audio' ? <Music size={22} style={{ color: '#ec4899' }} />
                              : (<>
                                  {m.cover ? <img src={m.cover} alt="" className="w-full h-full object-cover" /> : <video src={m.fileUrl} muted preload="metadata" className="w-full h-full object-cover" />}
                                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}><Play size={20} style={{ color: '#fff' }} fill="#fff" /></span>
                                </>)}
                          </div>
                          <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{m.title}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Загрузить диалог: вставить текст/JSON или взять из блока «Исследование» */}
      {loadDlgOpen && (
        <div onClick={() => setLoadDlgOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 94, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, maxHeight: '82vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Загрузить диалог</span>
              <button onClick={() => setLoadDlgOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
              Вставьте диалог: строки «A: реплика» / «B: реплика» (или по именам ведущих), либо JSON вида
              <code style={{ color: 'var(--text-secondary)' }}> [{'{'}"speaker":"A","text":"…"{'}'}]</code>. Первый голос → A, второй → B.
            </p>
            {researchNodes.length > 0 && (
              <div className="mb-2">
                <div className="text-[11px] font-600 mb-1" style={{ color: 'var(--text-muted)' }}>Из блока «Исследование»</div>
                <div className="flex flex-wrap gap-1.5">
                  {researchNodes.map((n) => (
                    <button key={n.id} onClick={() => setLoadDlgText((t) => (t.trim() ? t + '\n' + (n.text || '') : (n.text || '')))}
                      className="text-[11px] font-600 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                      <Newspaper size={12} /> {n.kind === 'news' ? 'Новости' : 'Исследование'}: вставить текст
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea value={loadDlgText} onChange={(e) => setLoadDlgText(e.target.value)} rows={10}
              placeholder={'A: Привет! Сегодня обсудим ИИ в быту.\nB: Да, тема спорная — давай разберёмся…'}
              className="w-full px-3 py-2 rounded-xl text-[13px] outline-none"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', resize: 'vertical', fontFamily: 'inherit' }} />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={() => { setLoadDlgText(''); }} className="text-[12px] font-600 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Очистить</button>
              <button onClick={applyLoadedDialogue} disabled={!loadDlgText.trim()} className="text-[13px] font-700 px-4 py-2 rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
                style={{ background: '#ec4899', color: '#fff', border: 'none', cursor: 'pointer' }}>
                <Check size={15} /> Загрузить в реплики
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Выбор исходного видео */}
      {showSource && (
        <div onClick={() => setShowSource(false)} style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Исходное видео</span>
              <button onClick={() => setShowSource(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {sourceUrl && (
              <button onClick={clearSource} className="text-xs mb-3" style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕ Убрать источник</button>
            )}
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
              <Sparkles size={11} style={{ color: 'var(--brand)', display: 'inline', verticalAlign: '-1px' }} /> — есть анализ: одно такое видео заполнит блоки по тренду.
              Отметьте <b>несколько</b> — соберём по ролику на каждое (одна цепочка блоков).
            </p>
            {(() => {
              const SRC_TABS = ([['all', 'Все'], ['analyzed', 'Из анализа'], ['trend', 'Тренды'], ['reference', 'Референс']] as const)
                .filter(([k]) => k === 'all' || sources.some((s) => s.type === k));
              const q = srcQuery.trim().toLowerCase();
              const shown = sources.filter((s) => (srcTab === 'all' || s.type === srcTab) && (!q || (s.name || '').toLowerCase().includes(q)));
              return (
                <>
                  {SRC_TABS.length > 2 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {SRC_TABS.map(([k, lbl]) => (
                        <button key={k} onClick={() => setSrcTab(k)} className="text-[11px] font-600 px-2.5 py-1 rounded-lg" style={{ background: srcTab === k ? 'var(--brand)' : 'var(--bg-tertiary)', color: srcTab === k ? 'var(--brand-contrast)' : 'var(--text-secondary)', border: `1px solid ${srcTab === k ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
                      ))}
                    </div>
                  )}
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={srcQuery} onChange={(e) => setSrcQuery(e.target.value)} placeholder="Поиск по названию…"
                      className="w-full py-1.5 rounded-lg text-[12px] outline-none" style={{ paddingLeft: 26, paddingRight: 8, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                  </div>
                  <input ref={srcUploadRef} type="file" accept="video/*" multiple style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files?.length) void uploadSourceVideo(e.target.files); }} />
                  <button onClick={() => srcUploadRef.current?.click()} disabled={srcUploading}
                    className="w-full mb-2 py-2 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--brand)', border: '1px dashed var(--brand)', cursor: srcUploading ? 'not-allowed' : 'pointer' }}>
                    {srcUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} {srcUploading ? 'Загружаю…' : 'Добавить видео'}
                  </button>
                  <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>Найдено: {shown.length}</div>
                  {shown.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Ничего не найдено. Нажмите «Добавить видео» выше или скачайте тренды.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {shown.map((s) => {
                  const isPicked = picked.some((x) => x.url === s.url);
                  const order = picked.findIndex((x) => x.url === s.url);
                  return (
                  <button key={s.url} onClick={() => togglePick(s)} className="rounded-xl overflow-hidden text-left" style={{ position: 'relative', background: 'var(--bg-tertiary)', border: `2px solid ${isPicked || sourceUrl === s.url ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                    {s.assetId && (
                      <span title="Есть анализ (ДНК тренда)" style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--brand)', color: 'var(--brand-contrast)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}><Sparkles size={11} /></span>
                    )}
                    {isPicked && (
                      <span title={`В пакете №${order + 1}`} style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: 'var(--brand)', color: 'var(--brand-contrast)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 10, fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}><Check size={11} />{order + 1}</span>
                    )}
                    <div style={{ aspectRatio: '1 / 1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isPicked ? 0.85 : 1 }}>
                      {s.thumb
                        ? <img src={s.thumb} alt="" className="w-full h-full object-cover" />
                        : <video src={`${s.url}#t=0.1`} muted preload="metadata" playsInline className="w-full h-full object-cover" />}
                    </div>
                    <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{s.name}</div>
                  </button>
                  );
                })}
              </div>
            )}
                </>
              );
            })()}
            {batchNote && <p className="text-[11px] mt-2" style={{ color: '#f59e0b' }}>{batchNote}</p>}
            {/* Липкая панель действий: видна без прокрутки в конец списка */}
            <div className="flex items-center gap-2" style={{ position: 'sticky', bottom: -16, zIndex: 3, margin: '12px -16px -16px', padding: '10px 16px 12px',
              background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-medium)' }}>
              <span className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>Выбрано: {picked.length}</span>
              {picked.length === 0 && canBuildWithoutSource && (
                <button onClick={() => { if (sourceUrl) clearSource(); setShowSource(false); }}
                  title="Соберём ролик целиком из материалов: фото новости + озвучка + стоковые перебивки"
                  className="inline-flex items-center gap-1.5 text-sm font-600 px-3.5 py-2.5 rounded-xl"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--brand)', border: '1px dashed var(--brand)', cursor: 'pointer' }}>
                  <Wand2 size={15} /> Без исходника
                </button>
              )}
              {picked.length === 1 && (
                <button onClick={() => selectSource(picked[0])} className="inline-flex items-center gap-1.5 text-sm font-700 px-4 py-2.5 rounded-xl"
                  style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                  <Check size={16} /> Выбрать видео
                </button>
              )}
              {picked.length >= 2 && (
                <button onClick={() => runBatch(picked)} disabled={nodes.length === 0}
                  title={nodes.length === 0 ? 'Сначала добавьте блоки в сценарий' : `Собрать ${picked.length} роликов`}
                  className="inline-flex items-center gap-1.5 text-sm font-700 px-4 py-2.5 rounded-xl"
                  style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: nodes.length === 0 ? 'not-allowed' : 'pointer', opacity: nodes.length === 0 ? 0.5 : 1 }}>
                  <Film size={16} /> Собрать пакет ({picked.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* #3 Галерея своих картинок для старт-кадра окна: выбрать существующую ИЛИ загрузить новую */}
      {imgPick !== null && (() => {
        const seg = imgPick;
        const q = imgPickQ.trim().toLowerCase();
        const curSF = omniSpec.segments.find((s) => s.id === seg)?.startFrame || null;
        const imgs = media.filter((m) => m.kind === 'image' && (!q || (m.title || '').toLowerCase().includes(q)));
        const busy = !!omniGen[seg]?.fbBusy;
        return (
          <div onClick={() => setImgPick(null)} style={{ position: 'absolute', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Старт-кадр — своё фото</span>
                <button onClick={() => setImgPick(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>
              <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>Выберите свою картинку (предмет/фон) как первый кадр — Omni оживит именно её. Или загрузите новую.</p>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input value={imgPickQ} onChange={(e) => setImgPickQ(e.target.value)} placeholder="Поиск по названию…" className="w-full py-1.5 rounded-lg text-[12px] outline-none" style={{ paddingLeft: 26, paddingRight: 8, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
              </div>
              <input ref={imgUploadRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files?.length) void uploadStartFrameFromPicker(seg, e.target.files); e.currentTarget.value = ''; }} />
              <button onClick={() => imgUploadRef.current?.click()} disabled={busy}
                className="w-full mb-2 py-2 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--brand)', border: '1px dashed var(--brand)', cursor: busy ? 'not-allowed' : 'pointer' }}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} {busy ? 'Загружаю…' : 'Загрузить новую'}
              </button>
              <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>Найдено: {imgs.length}</div>
              {imgs.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Пока нет своих картинок. Нажмите «Загрузить новую».</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {imgs.map((m) => (
                    <button key={m.fileUrl} onClick={() => { updateSeg(seg, { startFrame: m.fileUrl }); setOG(seg, { seed: null, note: 'Старт-кадр из галереи.' }); setImgPick(null); }}
                      className="rounded-xl overflow-hidden text-left" style={{ background: 'var(--bg-tertiary)', border: `2px solid ${curSF === m.fileUrl ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer', padding: 0 }}>
                      <div style={{ aspectRatio: '1 / 1', background: '#000' }}>
                        <img src={m.fileUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{m.title}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Главный промт — общий сценарий ролика (для ИИ-режиссёра) */}
      {showBrief && (
        <div onClick={() => setShowBrief(false)} style={{ position: 'absolute', inset: 0, zIndex: 92, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 520, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}><Sparkles size={18} style={{ color: 'var(--brand)' }} /> Сценарий ролика</span>
              <button onClick={() => setShowBrief(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Опишите ролик одним абзацем — это <b>главный промт</b>. ИИ-режиссёр учитывает его во всех ✨ЛЛМ-шагах
              (озвучка, исследование, выбор момента, субтитры). Узлы ниже — точечные настройки поверх этого замысла.
            </p>
            <textarea value={brief} onChange={(e) => { setBrief(e.target.value); setDirty(true); }} rows={6}
              placeholder="Напр.: «Динамичный вертикальный ролик про утреннюю рутину продуктивного человека. Энергичный тон, разговорный язык, хук в первые 2 секунды, призыв подписаться в конце»."
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-3"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', resize: 'vertical' }} />
            <div className="flex items-center gap-2">
              {brief.trim() && (
                <button onClick={() => { setBrief(''); setDirty(true); }} className="text-sm font-600 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>Очистить</button>
              )}
              <button onClick={() => { save(); setShowBrief(false); }} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-700 py-2.5 rounded-xl"
                style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}><Check size={16} /> Сохранить сценарий</button>
            </div>
          </div>
        </div>
      )}

      {/* Заполнить из тренда — раскладка ДНК по блокам */}
      {showDnaPanel && dna && (
        <div onClick={() => setShowDnaPanel(false)} style={{ position: 'absolute', inset: 0, zIndex: 93, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 540, maxHeight: '86vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}><Wand2 size={18} style={{ color: 'var(--brand)' }} /> Заполнить из тренда</span>
              <button onClick={() => setShowDnaPanel(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Разложим анализ тренда по блокам сценария и зададим общий «Сценарий». Дальше правьте в блоках — это единый источник правды для сборки.
            </p>

            {/* Сводка ДНК */}
            <div className="rounded-xl p-3 mb-3 text-[12px] space-y-1" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {dna.hookType && <div><b style={{ color: 'var(--text-primary)' }}>Хук:</b> {dna.hookType}</div>}
              {dna.targetAudience && <div><b style={{ color: 'var(--text-primary)' }}>Аудитория:</b> {dna.targetAudience}</div>}
              <div style={{ color: 'var(--text-muted)' }}>
                Сцен: {dna.sceneBeats?.length || 0} · Скрипт озвучки: {dna.copyReadyScript ? 'есть' : '—'} · Ключи: {(dna.keywords || []).length}
              </div>
            </div>

            {/* Цель (бенчмарк тренда) + технические таргеты качества */}
            {(dna.benchmark || dna.quality) && (
              <div className="rounded-xl p-3 mb-3 text-[12px] space-y-1.5" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
                {dna.benchmark && (dna.benchmark.engagementRate != null || dna.benchmark.likeRate != null || dna.benchmark.saveRate != null) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--text-secondary)' }}>
                    <span><b style={{ color: 'var(--brand)' }}>Цель — превзойти тренд:</b></span>
                    {dna.benchmark.engagementRate != null && <span>ER {dna.benchmark.engagementRate}%</span>}
                    {dna.benchmark.likeRate != null && <span>лайки {dna.benchmark.likeRate}%</span>}
                    {dna.benchmark.saveRate != null && <span>сохранения {dna.benchmark.saveRate}%</span>}
                  </div>
                )}
                {dna.quality && (dna.quality.lufs != null || dna.quality.brightness != null || dna.quality.vqScore != null || dna.quality.needUpscale) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--text-muted)' }}>
                    <span>Качество:</span>
                    {dna.quality.lufs != null && <span>{dna.quality.lufs} LUFS</span>}
                    {dna.quality.brightness != null && <span>яркость {Math.round(dna.quality.brightness)}</span>}
                    {dna.quality.vqScore != null && <span>VQ {dna.quality.vqScore}</span>}
                    {dna.quality.originH ? <span>{dna.quality.originW ? `${dna.quality.originW}×` : ''}{dna.quality.originH}</span> : null}
                    {dna.quality.needUpscale && <span style={{ color: 'var(--brand)' }}>→ апскейл 2×</span>}
                  </div>
                )}
              </div>
            )}

            {/* Что будет создано */}
            <div className="text-[11px] font-600 mb-1.5" style={{ color: 'var(--text-muted)' }}>Блоки сценария</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {dnaToGraph(dna).nodes.map((n, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] font-600 px-2 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
                  <span style={{ color: 'var(--brand)', display: 'inline-flex' }}>{React.cloneElement(META[n.kind].icon as any, { size: 13 })}</span>{META[n.kind].label}
                </span>
              ))}
            </div>

            {nodes.length > 0 && (
              <p className="text-[11px] mb-3 inline-flex items-start gap-1.5" style={{ color: '#f59e0b' }}>
                <Minus size={12} className="mt-[1px] flex-shrink-0" /> Текущие блоки ({nodes.length}) и «Сценарий» будут заменены.
              </p>
            )}

            <div className="flex items-center gap-2">
              <button onClick={() => setShowDnaPanel(false)} className="text-sm font-600 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Отмена</button>
              <button onClick={() => applyDna(dna)} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-700 py-2.5 rounded-xl"
                style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}><Wand2 size={16} /> Заполнить блоки</button>
            </div>
          </div>
        </div>
      )}

      {/* Панель облачного узла (Omni / Контент-план) — каркас */}
      {cloudPanel && (
        <div onClick={() => setCloudPanel(null)} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: cloudPanel === 'plan' ? 460 : 600, maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: CLOUD[cloudPanel].color }}>{CLOUD[cloudPanel].icon}</span> {CLOUD[cloudPanel].label}
              </span>
              <button onClick={() => setCloudPanel(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {cloudPanel === 'omni' ? (
              <div className="space-y-3.5">
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Преобразование видео по ленте. <b style={{ color: '#4285F4' }}>Omni Flash</b> — генерирует новый клип
                  со звуком (Gemini Omni Flash, 720p). <b style={{ color: '#a855f7' }}>V2V</b> — ре-стайл реального фрагмента (Runway/Kling).
                  Ключи — в <b style={{ color: 'var(--text-secondary)' }}>Enterprise → Генерация</b>.
                </p>

                {!sourceUrl ? (
                  <button onClick={() => { setCloudPanel(null); openSourcePicker(); }}
                    className="w-full py-3 rounded-xl text-sm font-600 inline-flex items-center justify-center gap-2"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--brand)', border: '1px dashed var(--brand)', cursor: 'pointer' }}>
                    <Video size={16} /> Сначала выберите исходное видео →
                  </button>
                ) : (
                  <>
                    {/* Превью исходника */}
                    <video ref={srcVideoRef} src={sourceUrl} controls preload="metadata"
                      onLoadedMetadata={(e) => setSrcDuration(e.currentTarget.duration || 0)}
                      style={{ width: '100%', maxHeight: 190, borderRadius: 10, background: '#000' }} />

                    {/* Интерактивная лента: перетаскивай окно (тело=сдвиг, края=длина). Omni — макс 10с. Живой предпросмотр. */}
                    <div>
                      <div ref={stripRef} className="relative w-full" style={{ height: 46, borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}>
                        {[0.25, 0.5, 0.75].map((t) => (
                          <div key={t} style={{ position: 'absolute', left: `${t * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--border-medium)' }} />
                        ))}
                        {omniSpec.segments.map((g, i) => {
                          const col = g.engine === 'omni' ? '#4285F4' : '#a855f7';
                          const over = g.engine === 'omni' && winSecOf(g) > OMNI_MAX_SEC + 0.05;
                          return (
                            <div key={g.id}
                              onPointerDown={(e) => omniDragStart(e, g, 'move')} onPointerMove={omniDragMove} onPointerUp={omniDragEnd} onPointerCancel={omniDragEnd}
                              title="Перетащи — сдвиг · за края — длина"
                              style={{ position: 'absolute', top: 4, bottom: 4, left: `${g.start * 100}%`, width: `${Math.max(1.5, (g.end - g.start) * 100)}%`,
                                background: over ? 'rgba(239,68,68,0.92)' : `${col}e6`, borderRadius: 7, cursor: 'grab', touchAction: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, boxShadow: '0 1px 5px rgba(0,0,0,0.28)' }}>
                              <div onPointerDown={(e) => omniDragStart(e, g, 'start')} onPointerMove={omniDragMove} onPointerUp={omniDragEnd} onPointerCancel={omniDragEnd}
                                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 13, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 3, height: '55%', background: '#fff', borderRadius: 2, opacity: 0.9 }} />
                              </div>
                              <span style={{ pointerEvents: 'none' }}>{i + 1}</span>
                              <div onPointerDown={(e) => omniDragStart(e, g, 'end')} onPointerMove={omniDragMove} onPointerUp={omniDragEnd} onPointerCancel={omniDragEnd}
                                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 13, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 3, height: '55%', background: '#fff', borderRadius: 2, opacity: 0.9 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>0с</span>
                        <span style={{ opacity: 0.8 }}>тяни окно · края = длина · Omni макс 10с</span>
                        <span>{srcDuration > 0 ? `${srcDuration.toFixed(0)}с` : '—'}</span>
                      </div>
                      <button onClick={() => addSegment()} disabled={omniSpec.segments.length >= 6}
                        className="w-full mt-2 py-2 rounded-xl text-[12px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                        <Plus size={14} /> Добавить окно ({omniSpec.segments.length})
                      </button>
                    </div>

                    {/* Карточки кусков */}
                    <div className="space-y-2.5">
                      {omniSpec.segments.map((g, i) => (
                        <div key={g.id} className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-700 inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                              <span style={{ width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', background: g.engine === 'omni' ? '#4285F4' : '#a855f7' }}>{i + 1}</span>
                              Окно {i + 1}
                            </span>
                            {omniSpec.segments.length > 1 && (
                              <button onClick={() => removeSeg(g.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-secondary)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={13} /></button>
                            )}
                          </div>

                          {/* Окно на ленте (тянется на полоске сверху) */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span style={{ color: 'var(--text-muted)' }}>Окно: <b style={{ color: 'var(--text-secondary)' }}>{fmtT(g.start)}–{fmtT(g.end)}</b></span>
                            {g.engine === 'omni' && (
                              <span style={{ color: winSecOf(g) > OMNI_MAX_SEC + 0.05 ? '#ef4444' : '#4285F4', fontWeight: 700 }}>
                                {srcDuration > 0 ? `${winSecOf(g).toFixed(1)}с из макс 10с` : 'макс 10с'}
                              </span>
                            )}
                          </div>

                          {/* Движок: Omni Flash / V2V */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {([['omni', 'Omni Flash', '#4285F4', <Sparkles size={13} key="s" />], ['v2v', 'Ре-стайл (V2V)', '#a855f7', <Scissors size={13} key="c" />]] as [OmniEngine, string, string, React.ReactNode][]).map(([eng, lbl, col, ic]) => (
                              <button key={eng} onClick={() => updateSeg(g.id, { engine: eng })}
                                className="py-2 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 transition-all"
                                style={{ background: g.engine === eng ? col : 'var(--bg-secondary)', color: g.engine === eng ? '#fff' : 'var(--text-muted)', border: `1px solid ${g.engine === eng ? col : 'var(--border-medium)'}` }}>
                                {ic} {lbl}
                              </button>
                            ))}
                          </div>

                          {/* Промт «как» */}
                          <textarea value={g.prompt} onChange={(e) => updateSeg(g.id, { prompt: e.target.value })}
                            placeholder={g.engine === 'omni' ? 'Как сгенерировать: «киношный закат над городом, медленный пролёт…»' : 'Как переделать фрагмент: «в стиле аниме», «зимняя ночь», «акварель…»'}
                            rows={2}
                            className="w-full px-2.5 py-2 rounded-lg text-[12px] focus:outline-none resize-none"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />

                          {/* Параметры движка */}
                          {g.engine === 'omni' ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Длина = ширина окна. Без старт-кадра Omni берёт кадр выделенного фрагмента как контекст (сцена сохранится). Полная покадровая перерисовка — «Ре-стайл (V2V)».</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Провайдер</span>
                              {(['runway', 'fal'] as V2VProvider[]).map((p) => (
                                <button key={p} onClick={() => updateSeg(g.id, { provider: p })}
                                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center gap-1.5"
                                  style={{ background: g.provider === p ? 'rgba(168,85,247,0.16)' : 'var(--bg-secondary)', color: g.provider === p ? '#a855f7' : 'var(--text-muted)', border: `1px solid ${g.provider === p ? '#a855f7' : 'var(--border-medium)'}` }}>
                                  <Film size={12} /> {V2V_LABEL[p]}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Omni Flash: раскадровка (Nano) → выбор кадра → генерация видео + чат-правка */}
                          {g.engine === 'omni' && (
                            <div className="space-y-2">
                              {/* #3 Старт-кадр: кадр из видео / загрузка / промт+картинка (Nano). Первый кадр для image_to_video. */}
                              <div className="rounded-lg p-2 space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                                <div className="text-[10px] font-600" style={{ color: 'var(--text-secondary)' }}>Старт-кадр (первый кадр для оживления):</div>
                                <div className="grid grid-cols-3 gap-1.5">
                                  <button onClick={() => runExtractFrame(g)} disabled={!sourceUrl || omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy}
                                    className="py-1.5 rounded-lg text-[10px] font-600 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}
                                    title={sourceUrl ? 'Взять кадр исходника в позиции окна' : 'Сначала выберите исходное видео'}>
                                    <Film size={12} /> Из кадра видео
                                  </button>
                                  <button onClick={() => openStartFramePicker(g.id)} disabled={omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy}
                                    className="py-1.5 rounded-lg text-[10px] font-600 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}
                                    title="Выбрать из своих картинок или загрузить новую">
                                    <UploadCloud size={12} /> Загрузить
                                  </button>
                                  <button onClick={() => runPromptImage(g)} disabled={!g.startFrame || !g.prompt.trim() || omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy}
                                    className="py-1.5 rounded-lg text-[10px] font-600 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                                    style={{ background: 'var(--bg-tertiary)', color: '#4285F4', border: '1px solid rgba(66,133,244,0.4)', cursor: 'pointer' }}
                                    title="Перерисовать текущий старт-кадр по промту (Nano img2img)">
                                    <Sparkles size={12} /> Промт+картинка
                                  </button>
                                </div>
                                {omniGen[g.id]?.fbBusy && <div className="text-[10px] inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Loader2 size={11} className="animate-spin" /> Готовлю кадр…</div>}
                                {g.startFrame && (
                                  <div className="flex items-center gap-2">
                                    <img src={g.startFrame} alt="старт-кадр" style={{ width: 40, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 6, border: '2px solid #4285F4' }} />
                                    <span className="text-[10px]" style={{ color: '#4285F4', fontWeight: 700 }}>Старт-кадр задан</span>
                                    <button onClick={() => { updateSeg(g.id, { startFrame: null }); setOG(g.id, { seed: null }); }}
                                      className="ml-auto w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: '#ef4444', border: 'none', cursor: 'pointer' }} title="Убрать старт-кадр"><X size={12} /></button>
                                  </div>
                                )}
                              </div>
                              {/* Шаг 1: дешёвая раскадровка перед видео */}
                              <button onClick={() => runStoryboard(g)} disabled={omniGen[g.id]?.sbBusy || omniGen[g.id]?.busy}
                                className="w-full py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                                style={{ background: 'var(--bg-secondary)', color: '#4285F4', border: '1px solid rgba(66,133,244,0.4)', cursor: 'pointer' }}>
                                {omniGen[g.id]?.sbBusy ? <Loader2 size={13} className="animate-spin" /> : <Image size={13} />} {omniGen[g.id]?.sbBusy ? 'Рисую кадры…' : 'Раскадровка (Nano, ~$0.10) — увидеть до видео'}
                              </button>
                              {!!omniGen[g.id]?.frames?.length && (
                                <div>
                                  <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Выберите кадр — Omni оживит именно его:</div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {omniGen[g.id]!.frames!.map((f) => { const sel = omniGen[g.id]?.seed === f; return (
                                      <button key={f} onClick={() => { const nv = sel ? null : f; setOG(g.id, { seed: nv }); updateSeg(g.id, { startFrame: nv }); }} className="rounded-lg overflow-hidden" style={{ border: `2px solid ${sel ? '#4285F4' : 'var(--border-medium)'}`, cursor: 'pointer', padding: 0, position: 'relative' }}>
                                        <img src={f} alt="" className="w-full" style={{ aspectRatio: '9 / 16', objectFit: 'cover', display: 'block' }} />
                                        {sel && <span style={{ position: 'absolute', top: 2, right: 2, background: '#4285F4', color: '#fff', borderRadius: 6, padding: '0 4px', fontSize: 9, fontWeight: 700 }}>✓</span>}
                                      </button>
                                    ); })}
                                  </div>
                                </div>
                              )}
                              {/* Шаг 2: оживить (выбранный кадр = старт, иначе текст→видео) */}
                              <button onClick={() => runOmniGen(g)} disabled={omniGen[g.id]?.busy}
                                className="w-full py-2 rounded-lg text-[12px] font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                                style={{ background: '#4285F4', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                {omniGen[g.id]?.busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {omniGen[g.id]?.busy ? 'Генерирую… (~30–60с)' : ((g.startFrame || omniGen[g.id]?.seed) ? 'Оживить старт-кадр (Omni Flash)' : 'Сгенерировать (Omni Flash)')}
                              </button>
                              {omniGen[g.id]?.note && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{omniGen[g.id]?.note}</p>}
                              {omniGen[g.id]?.url && (
                                <>
                                  <video src={omniGen[g.id]!.url!} controls className="w-full rounded-lg" style={{ aspectRatio: '9 / 16', background: '#000', maxHeight: 320 }} />
                                  {omniGen[g.id]?.interactionId && (
                                    <div className="flex items-center gap-1.5">
                                      <input value={omniGen[g.id]?.edit || ''} onChange={(e) => setOG(g.id, { edit: e.target.value })}
                                        placeholder="Правка чатом: «поменяй цвет машины на красный»"
                                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                                      <button onClick={() => runOmniEdit(g)} disabled={omniGen[g.id]?.busy || !(omniGen[g.id]?.edit || '').trim()}
                                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-700 disabled:opacity-50" style={{ background: '#4285F4', color: '#fff', border: 'none', cursor: 'pointer' }}>Править</button>
                                    </div>
                                  )}
                                  {/* #4: оставить последний кадр → новое окно (сшивка-продолжение следующих 10с) */}
                                  <button onClick={() => runContinue(g)} disabled={omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy || omniSpec.segments.length >= 6}
                                    className="w-full py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    style={{ background: 'var(--bg-secondary)', color: '#4285F4', border: '1px solid rgba(66,133,244,0.4)', cursor: 'pointer' }}
                                    title="Взять последний кадр клипа как старт нового окна — продолжение">
                                    {omniGen[g.id]?.fbBusy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Последний кадр → новое окно
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>

                    {/* Сводка + стоимость */}
                    <div className="rounded-xl p-3 text-[11px] space-y-1" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {omniGenSeconds > 0 && (
                        <div>Omni Flash: <b style={{ color: 'var(--text-secondary)' }}>{omniGenSeconds.toFixed(0)}с</b> ≈ ${(omniGenSeconds * 0.10).toFixed(2)} <span style={{ opacity: 0.7 }}>(Gemini Omni Flash, 720p, со звуком, ~$0.10/с)</span></div>
                      )}
                      {omniSpec.segments.some((g) => g.engine === 'v2v') && (
                        <div>V2V ре-стайл: по тарифу провайдера (Runway/Kling).</div>
                      )}
                      <div style={{ opacity: 0.8 }}>Спецификация сохраняется в сценарий. Реальная генерация (вызов Veo/Runway и склейка в монтаж) — следующий деплой; нужны ключи в Enterprise → Генерация.</div>
                    </div>

                    <button onClick={() => { save(); setCloudPanel(null); }}
                      className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2"
                      style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: '1px solid var(--brand)', cursor: 'pointer' }}>
                      <Save size={15} /> Сохранить преобразование
                    </button>
                  </>
                )}
              </div>
            ) : cloudPanel === 'podcast' ? (
              <div className="space-y-3.5">
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Сцена-подкаст: <b style={{ color: '#ec4899' }}>два ведущих</b> в сплит-скрине, у каждого — своя
                  голосовая дорожка. Дорожки можно <b>сгенерировать</b> (диалог + TTS) или <b>разобрать</b> готовую
                  запись на 2 голоса. К каждой фразе можно прикрепить <b>картинку</b> — она эффектно выезжает в этот момент.
                </p>

                {/* Студия лиц: одно групповое фото → детекция/разметка → назначение A/B → кадры */}
                <div className="space-y-2.5">
                  <div className="text-[11px] font-600" style={{ color: 'var(--text-muted)' }}>Студия лиц — одно фото обоих ведущих</div>
                  {!pod.groupPhotoUrl ? (
                    <button onClick={() => openPodPick('group')}
                      className="w-full py-6 rounded-xl text-[12px] font-600 inline-flex flex-col items-center justify-center gap-1.5"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1.5px dashed var(--border-strong)', cursor: 'pointer' }}>
                      <Image size={22} style={{ color: '#ec4899' }} />
                      Загрузить общее фото ведущих
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>распознаем/обведём лица и сделаем крупные планы</span>
                    </button>
                  ) : (
                    <>
                      <div ref={faceWrapRef}
                        onPointerDown={faceDown} onPointerMove={faceMove} onPointerUp={faceUp} onPointerLeave={faceUp}
                        style={{ position: 'relative', width: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-medium)', cursor: 'crosshair', touchAction: 'none', userSelect: 'none' }}>
                        <img src={pod.groupPhotoUrl} alt="" draggable={false} style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />
                        {pod.faces.map((f) => (
                          <div key={f.id} style={{ position: 'absolute', left: `${f.box.x * 100}%`, top: `${f.box.y * 100}%`, width: `${f.box.w * 100}%`, height: `${f.box.h * 100}%`, border: `2px solid ${f.speaker === 'A' ? '#ec4899' : '#8b5cf6'}`, borderRadius: 4 }}>
                            <div style={{ position: 'absolute', top: -21, left: -2, display: 'flex', gap: 2 }}>
                              {(['A', 'B'] as const).map((sp) => (
                                <button key={sp} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); faceAssign(f.id, sp); }}
                                  style={{ fontSize: 10, fontWeight: 700, width: 20, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer', background: f.speaker === sp ? (sp === 'A' ? '#ec4899' : '#8b5cf6') : 'rgba(0,0,0,0.6)', color: '#fff' }}>{sp}</button>
                              ))}
                              <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); faceDel(f.id); }}
                                style={{ width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={11} /></button>
                            </div>
                          </div>
                        ))}
                        {drawBox && (
                          <div style={{ position: 'absolute', left: `${drawBox.x * 100}%`, top: `${drawBox.y * 100}%`, width: `${drawBox.w * 100}%`, height: `${drawBox.h * 100}%`, border: '2px dashed #ec4899', borderRadius: 4, background: 'rgba(236,72,153,0.12)', pointerEvents: 'none' }} />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={detectFaces} disabled={!!podBusy}
                          className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg disabled:opacity-60"
                          style={{ background: 'rgba(236,72,153,0.14)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)', cursor: 'pointer' }}>
                          {podBusy === 'detect' ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Найти ведущих (авто)
                        </button>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>или обведите КАЖДОГО ведущего рамкой целиком · A — розовый, B — фиолетовый. Рамка задаёт, кого вырезаем и анимируем на студии.</span>
                        <div className="flex-1" />
                        <button onClick={() => openPodPick('group')} className="text-[11px]" style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>сменить фото</button>
                        <button onClick={() => podMutate((p) => ({ ...p, groupPhotoUrl: null, groupPhotoName: null, faces: [] }))} className="text-[11px]" style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>удалить</button>
                      </div>
                      <button onClick={applyFaces} disabled={!!podBusy}
                        className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ background: '#ec4899', color: '#fff', border: 'none', cursor: 'pointer' }}>
                        {podBusy === 'apply' ? <Loader2 size={15} className="animate-spin" /> : <Crop size={15} />} Сделать кадры ведущих
                      </button>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)', marginTop: -4 }}>
                        Кадры — отдельные фото A/B (нужны для обычного «Оживить ведущих» и сплит-скрина).
                        Для «Оживить НА студии» кадры не обязательны: там ведущие вырезаются прямо из этого фото по рамкам.
                      </div>

                      {/* AI-ракурсы студии — другой вид той же студии для разнообразия */}
                      <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                        <div className="text-[11px] font-600 inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                          <Sparkles size={12} style={{ color: '#ec4899' }} /> AI-ракурсы студии — те же ведущие, другой вид камеры
                        </div>

                        <input ref={angleInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={(e) => { if (e.target.files?.length) uploadAngleSrc(e.target.files); e.currentTarget.value = ''; }} />
                        <textarea value={anglePromptText}
                          onChange={(e) => { setAnglePromptText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
                          rows={1} placeholder="свой промт (необязательно): «приблизь, в кадре только женщина, мужчина — лишь рука»…"
                          className="w-full px-2 py-1.5 rounded-lg text-[12px] outline-none"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', resize: 'none', overflow: 'hidden', minHeight: 34 }} />
                        <button onClick={() => genAngle('custom')} disabled={!!angleBusy || !anglePromptText.trim()}
                          className="w-full py-2 rounded-lg text-[12px] font-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                          style={{ background: '#ec4899', color: '#fff', border: 'none', cursor: anglePromptText.trim() ? 'pointer' : 'not-allowed' }}>
                          {angleBusy === 'custom' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Применить свой промт
                        </button>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>ракурсы:</span>
                          {([['left', '← Левее'], ['right', 'Правее →'], ['up', '↑ Сверху'], ['down', '↓ Снизу'], ['back', 'Сзади'], ['closeup', 'Крупнее']] as [string, string][]).map(([p, lbl]) => (
                            <button key={p} onClick={() => genAngle(p)} disabled={!!angleBusy}
                              className="text-[11px] font-600 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-60"
                              style={{ background: 'rgba(236,72,153,0.14)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)', cursor: 'pointer' }}>
                              {angleBusy === p ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {lbl}
                            </button>
                          ))}
                          <button onClick={() => angleInputRef.current?.click()} disabled={angleBusy === 'upload'}
                            className="text-[11px] font-600 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                            style={{ background: 'var(--bg-secondary)', color: '#ec4899', border: '1px dashed var(--border-strong)', cursor: 'pointer' }}>
                            {angleBusy === 'upload' ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />} своё фото
                          </button>
                        </div>
                        {(angleSrc || podAngles.length > 0) && (
                          <div className="flex flex-wrap gap-2">
                            {angleSrc && (
                              <div className="relative rounded-lg overflow-hidden" style={{ width: 64, height: 64, border: '2px solid #ec4899' }}>
                                <img src={angleSrc.url} alt="" className="w-full h-full object-cover" />
                                <span style={{ position: 'absolute', left: 0, bottom: 0, fontSize: 8, color: '#fff', background: 'rgba(236,72,153,0.9)', padding: '0 3px', borderTopRightRadius: 4 }}>вход</span>
                                <button onClick={() => setAngleSrc(null)} className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer' }}><X size={11} /></button>
                              </div>
                            )}
                            {podAngles.map((a, i) => (
                              <div key={i} className="relative rounded-lg overflow-hidden" style={{ width: 64, height: 64, border: '1px solid var(--border-medium)' }}>
                                <img src={a.url} alt="" className="w-full h-full object-cover" />
                                <button onClick={() => setPodAngles((prev) => prev.filter((_, j) => j !== i))} className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer' }}><X size={11} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Готовые ракурсы попадают в Галерею → прикрепляй их к фразам кнопкой 🖼.</p>
                      </div>
                    </>
                  )}

                  {/* Спикеры A/B: крупный план + имя + голос */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['hostA', 'hostB'] as const).map((hk) => {
                      const h = pod[hk]; const label = hk === 'hostA' ? 'A' : 'B';
                      return (
                        <div key={hk} className="rounded-xl p-2.5 space-y-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                          <div className="w-full rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1 / 1', background: '#000', border: `1px solid ${h.photoUrl ? (label === 'A' ? '#ec4899' : '#8b5cf6') : 'var(--border-medium)'}` }}>
                            {h.photoUrl ? <img src={h.photoUrl} alt="" className="w-full h-full object-cover" />
                              : <span className="flex flex-col items-center gap-1" style={{ color: 'var(--text-muted)' }}><UserRound size={22} /><span className="text-[10px]">Крупный план {label}</span></span>}
                          </div>
                          <input value={h.name} onChange={(e) => podMutate((p) => ({ ...p, [hk]: { ...p[hk], name: e.target.value } }))}
                            className="w-full px-2 py-1.5 rounded-lg text-[12px] outline-none"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                          <div className="grid grid-cols-2 gap-1">
                            {([['female', 'Жен'], ['male', 'Муж']] as [PodVoice, string][]).map(([v, lbl]) => (
                              <button key={v} onClick={() => podMutate((p) => ({ ...p, [hk]: { ...p[hk], voice: v } }))}
                                className="py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1"
                                style={{ background: h.voice === v ? '#ec4899' : 'var(--bg-secondary)', color: h.voice === v ? '#fff' : 'var(--text-muted)', border: `1px solid ${h.voice === v ? '#ec4899' : 'var(--border-medium)'}` }}>
                                <Mic size={11} /> {lbl}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openPodPick(hk)} className="text-[10px]" style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>выбрать вручную</button>
                            {h.photoUrl && <button onClick={() => podMutate((p) => ({ ...p, [hk]: { ...p[hk], photoUrl: null, photoName: null } }))} className="text-[10px]" style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>убрать кадр</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Источник дорожек */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                  {([['gen', 'Сгенерировать диалог'], ['diarize', 'Разобрать запись']] as [PodSource, string][]).map(([s, lbl]) => (
                    <button key={s} onClick={() => podMutate((p) => ({ ...p, source: s }))}
                      className="py-2 rounded-lg text-[12px] font-600 transition-all"
                      style={{ background: pod.source === s ? 'var(--bg-secondary)' : 'transparent', color: pod.source === s ? '#ec4899' : 'var(--text-muted)', boxShadow: pod.source === s ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {pod.source === 'gen' ? (
                  <div className="space-y-2">
                    <textarea value={pod.brief} onChange={(e) => podMutate((p) => ({ ...p, brief: e.target.value }))} rows={2}
                      placeholder="Тема подкаста: «Спор о том, нужен ли людям ИИ-ассистент в быту»…"
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', resize: 'vertical' }} />
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={genDialogue} disabled={podBusy === 'dialogue'}
                        className="py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ background: 'rgba(236,72,153,0.14)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)', cursor: 'pointer' }}>
                        {podBusy === 'dialogue' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Сгенерировать
                      </button>
                      <div className="flex items-stretch gap-1">
                        <button onClick={() => setLoadDlgOpen(true)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                          <Download size={15} /> Загрузить диалог
                        </button>
                        <span className="me-tip" tabIndex={0} style={{ flexShrink: 0, width: 34, borderRadius: 12, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', cursor: 'help', justifyContent: 'center' }}>
                          <Info size={16} />
                          <span className="me-tip-pop">
                            <b>Как подготовить текст диалога</b><br />
                            Каждая реплика — с новой строки, в начале укажите, кто говорит:<br />
                            <code style={{ color: 'var(--text-secondary)' }}>A: Привет, сегодня обсудим…</code><br />
                            <code style={{ color: 'var(--text-secondary)' }}>B: Да, поехали!</code><br />
                            Можно по именам ведущих — первый голос станет A, второй B.<br /><br />
                            <b>Или JSON:</b><br />
                            <code style={{ color: 'var(--text-secondary)' }}>[{'{'}"speaker":"A","text":"…"{'}'}, {'{'}"speaker":"B","text":"…"{'}'}]</code><br />
                            Поддерживаются поля speaker/role/name и text/content/line.<br /><br />
                            Ещё можно вставить текст из блока «Исследование»/«Новости» сценария — кнопкой внутри окна.
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pod.recordingUrl ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                        <Music size={15} style={{ color: '#ec4899' }} />
                        <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{pod.recordingName || 'запись'}</span>
                        <button onClick={() => podMutate((p) => ({ ...p, recordingUrl: null, recordingName: null,
                          // записи больше нет — голос «Из записи» невозможен, откатываем на TTS
                          ...(p.avatar?.voiceSource === 'record' ? { avatar: { ...(p.avatar || POD_DEFAULT.avatar!), voiceSource: 'heygen' as PodVoiceSource } } : {}) }))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => openPodPick('recording')} className="w-full py-2.5 rounded-xl text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                        <Paperclip size={14} /> Загрузить запись подкаста (аудио/видео)
                      </button>
                    )}
                    <button onClick={runDiarize} disabled={podBusy === 'diarize' || !pod.recordingUrl}
                      className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'rgba(236,72,153,0.14)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)', cursor: 'pointer' }}>
                      {podBusy === 'diarize' ? <Loader2 size={15} className="animate-spin" /> : <Scissors size={15} />} Разобрать на 2 голоса
                    </button>
                  </div>
                )}

                {/* Таймлайн (Фаза 2) — вверху; наложение голосовых дорожек (Web Audio микширует наложения) */}
                {pod.dialogue.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="text-[11px] font-600 inline-flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                        Таймлайн (наложение голосов)
                        {pod.timeline && (() => { const arr = pod.dialogue; const total = Math.max(0, ...arr.map((l, i) => lineT(l, i, arr) + lineDur(l))); return <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{tlMmss(tlPlayhead)} / {tlMmss(total)}</span>; })()}
                      </span>
                      <div className="inline-flex items-center gap-1.5">
                        {pod.timeline && (
                          <>
                            <button onClick={tlTogglePlay} title={tlPlaying ? 'Пауза' : 'Воспроизвести с бегунка'} className="w-6 h-6 rounded-lg inline-flex items-center justify-center" style={{ background: tlPlaying ? '#10b981' : 'var(--bg-tertiary)', color: tlPlaying ? '#fff' : '#10b981', border: `1px solid ${tlPlaying ? '#10b981' : 'var(--border-medium)'}`, cursor: 'pointer' }}>{tlPlaying ? <Pause size={13} /> : <Play size={13} />}</button>
                            <button onClick={cutAtPlayhead} title="Разрезать по бегунку (✂)" className="w-6 h-6 rounded-lg inline-flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: '#ec4899', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Scissors size={13} /></button>
                            <button onClick={() => setTlPps((v) => Math.max(3, Math.round(v / 1.4)))} title="Уменьшить масштаб" className="w-6 h-6 rounded-lg inline-flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Minus size={13} /></button>
                            <button onClick={() => setTlPps((v) => Math.min(160, Math.round(v * 1.4)))} title="Увеличить масштаб" className="w-6 h-6 rounded-lg inline-flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Plus size={13} /></button>
                            <button onClick={fitTimeline} title="Вместить всё на экран" className="text-[10px] font-600 px-2 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>вместить</button>
                          </>
                        )}
                        <button onClick={toggleTimeline}
                          className="text-[11px] font-600 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5"
                          style={{ background: pod.timeline ? '#ec4899' : 'var(--bg-tertiary)', color: pod.timeline ? '#fff' : 'var(--text-secondary)', border: `1px solid ${pod.timeline ? '#ec4899' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                          <Film size={12} /> {pod.timeline ? 'Таймлайн вкл' : 'Включить таймлайн'}
                        </button>
                      </div>
                    </div>
                    {pod.timeline && (() => {
                      const arr = pod.dialogue;
                      const total = Math.max(3, ...arr.map((l, i) => lineT(l, i, arr) + lineDur(l)));
                      const W = Math.ceil(total) * tlPps + 40;
                      const step = tlPps >= 40 ? 1 : tlPps >= 22 ? 2 : tlPps >= 11 ? 5 : 10;
                      const phLeft = 32 + tlPlayhead * tlPps;
                      return (
                        <div ref={tlWrapRef} style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border-medium)', background: 'var(--bg-tertiary)' }}>
                          <div style={{ position: 'relative', width: W, padding: '4px 0' }}>
                            <div onPointerDown={(e) => { tlPlayDragRef.current = true; const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); setTlPlayhead(Math.max(0, Math.round(((e.clientX - rect.left - 32) / tlPps) * 20) / 20)); }}
                              style={{ position: 'relative', height: 16, marginLeft: 32, cursor: 'col-resize', touchAction: 'none' }}>
                              {Array.from({ length: Math.floor(total / step) + 1 }).map((_, k) => { const s = k * step; return (
                                <span key={k} style={{ position: 'absolute', left: s * tlPps, top: 1, fontSize: 8, color: 'var(--text-muted)' }}>{tlMmss(s)}</span>
                              ); })}
                            </div>
                            {(['A', 'B'] as const).map((trk) => (
                              <div key={trk} style={{ position: 'relative', height: 34, marginTop: 4 }}>
                                <span style={{ position: 'absolute', left: 6, top: 9, fontSize: 10, fontWeight: 700, color: trk === 'A' ? '#ec4899' : '#8b5cf6' }}>{trk}</span>
                                <div style={{ position: 'absolute', left: 32, right: 0, top: 0, bottom: 0 }}>
                                  {arr.map((l, i) => {
                                    if ((l.speaker === 'B' ? 'B' : 'A') !== trk) return null;
                                    const t = lineT(l, i, arr); const d = lineDur(l);
                                    const w = Math.max(6, d * tlPps - 2);
                                    const sel = selLine === i;
                                    const showText = w >= 40;       // на мелком зуме подписи прячем — чистые плашки
                                    const showThumb = w >= 46 && !!l.image;
                                    const vid = isVideoUrl(l.image);
                                    return (
                                      <div key={i}
                                        onPointerDown={(e) => { e.preventDefault(); tlMovedRef.current = false; tlDragRef.current = { i, startX: e.clientX, startT: t }; }}
                                        onClick={() => { if (tlMovedRef.current) { tlMovedRef.current = false; return; } setSelLine(i); setDialogOpen(true); setTimeout(() => document.getElementById(`pl-${i}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60); }}
                                        title={l.text}
                                        style={{ position: 'absolute', left: t * tlPps, width: w, top: 2, height: 30, borderRadius: 7,
                                          background: trk === 'A' ? 'linear-gradient(180deg, rgba(244,114,182,0.96), rgba(219,39,119,0.96))' : 'linear-gradient(180deg, rgba(167,139,250,0.96), rgba(124,58,237,0.96))',
                                          color: '#fff', fontSize: 9, lineHeight: '30px',
                                          padding: showText ? '0 6px' : '0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'grab', userSelect: 'none', touchAction: 'none',
                                          border: sel ? 'none' : '1px solid rgba(255,255,255,0.18)',
                                          boxShadow: sel ? '0 0 0 2px #fff, 0 0 0 4px #ec4899' : '0 1px 3px rgba(0,0,0,0.28)' }}>
                                        {showThumb && (vid
                                          ? <span style={{ position: 'absolute', right: 2, top: 2, width: 26, height: 26, borderRadius: 4, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={12} fill="#fff" style={{ color: '#fff' }} /></span>
                                          : <img src={l.image} alt="" style={{ position: 'absolute', right: 2, top: 2, width: 26, height: 26, objectFit: 'cover', borderRadius: 4 }} />)}
                                        {showText
                                          ? <span style={{ pointerEvents: 'none' }}>{l.text || `реплика ${i + 1}`}</span>
                                          : (l.image && <span style={{ position: 'absolute', left: 3, top: 3, width: 6, height: 6, borderRadius: '50%', background: '#fff', opacity: 0.9 }} />)}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            <div style={{ position: 'absolute', left: phLeft, top: 0, bottom: 0, width: 2, background: '#fbbf24', zIndex: 5, pointerEvents: 'none' }}>
                              <span onPointerDown={(e) => { e.stopPropagation(); tlPlayDragRef.current = true; }} style={{ position: 'absolute', top: 0, left: -6, width: 14, height: 14, borderRadius: '50%', background: '#fbbf24', cursor: 'col-resize', pointerEvents: 'auto', touchAction: 'none' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {pod.timeline && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>▶ — играть с жёлтого бегунка; тащи клипы по времени; бегунок ведёшь и ✂ режет по нему (появляется новая реплика); −/+/вместить — масштаб. Клик по клипу открывает реплику ниже. Наложение A/B = перебивание.</p>}
                  </div>
                )}

                {/* Реплики — свёрнуты, открываются; клик по клипу подсвечивает */}
                {pod.dialogue.length > 0 && (
                  <div className="space-y-1.5">
                    <button onClick={() => setDialogOpen((o) => !o)} className="w-full flex items-center justify-between text-[11px] font-600 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                      <span>Реплики ({pod.dialogue.length}) — открыть/свернуть</span>
                      <span>{dialogOpen ? '▾' : '▸'}</span>
                    </button>
                    {dialogOpen && (
                      <div className="space-y-1.5" style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {pod.dialogue.map((l, i) => (
                          <div key={i} id={`pl-${i}`} className="rounded-lg p-1.5" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${selLine === i ? '#ec4899' : 'var(--border-medium)'}` }}>
                            <div className="flex items-start gap-1.5">
                              <button onClick={() => podLineMutate(i, { speaker: l.speaker === 'A' ? 'B' : 'A' })} title="Сменить ведущего"
                                className="flex-shrink-0 w-7 h-7 rounded-lg text-[11px] font-700 flex items-center justify-center mt-0.5"
                                style={{ background: l.speaker === 'A' ? '#ec4899' : '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer' }}>{l.speaker}</button>
                              <textarea value={l.text} onChange={(e) => podLineMutate(i, { text: e.target.value })} rows={1}
                                className="flex-1 px-2 py-1.5 rounded-lg text-[12px] outline-none"
                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', resize: 'vertical' }} />
                              {l.image ? (
                                <div className="relative flex-shrink-0 mt-0.5" style={{ width: 28, height: 28 }}>
                                  {isVideoUrl(l.image) ? (
                                    <>
                                      <video src={l.image} muted preload="metadata" className="w-full h-full object-cover rounded-lg" style={{ border: '1px solid #ec4899' }} />
                                      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={11} fill="#fff" style={{ color: '#fff' }} /></span>
                                    </>
                                  ) : (
                                    <img src={l.image} alt="" className="w-full h-full object-cover rounded-lg" style={{ border: '1px solid #ec4899' }} />
                                  )}
                                  <button onClick={() => setLineImage(i, null)} title="Убрать медиа" className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full" style={{ background: 'rgba(0,0,0,0.8)', color: '#fff', border: 'none', cursor: 'pointer' }}><X size={9} /></button>
                                </div>
                              ) : (
                                <button onClick={() => openPodLineImage(i)} title="Прикрепить фото или видео к фразе" className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'var(--bg-secondary)', color: '#ec4899', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Image size={13} /></button>
                              )}
                              {i < pod.dialogue.length - 1 && (
                                <button onClick={() => mergeLineDown(i)} title="Объединить со следующей репликой" className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'var(--bg-secondary)', color: '#8b5cf6', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Combine size={13} /></button>
                              )}
                              <button onClick={() => podLineDel(i)} title="Удалить реплику" className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'var(--bg-secondary)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><X size={13} /></button>
                            </div>
                            {l.image && (
                              <div className="flex flex-wrap items-center gap-1 mt-1.5" style={{ paddingLeft: 34 }}>
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Выезд:</span>
                                {POD_ANIMS.map((a) => { const sel = (l.anim || 'auto') === a.v; return (
                                  <button key={a.v} onClick={() => setLineAnim(i, a.v)} className="text-[10px] font-600 px-2 py-1 rounded-md" style={{ background: sel ? '#ec4899' : 'var(--bg-secondary)', color: sel ? '#fff' : 'var(--text-muted)', border: `1px solid ${sel ? '#ec4899' : 'var(--border-medium)'}`, cursor: 'pointer' }}>{a.label}</button>
                                ); })}
                              </div>
                            )}
                          </div>
                        ))}
                        <button onClick={podLineAdd} className="text-[11px] font-600 inline-flex items-center gap-1" style={{ color: '#ec4899', background: 'transparent', border: 'none', cursor: 'pointer' }}><Plus size={12} /> Добавить реплику</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Анимация ведущих — говорящие головы (выбор провайдера + оценка стоимости) */}
                {(() => {
                  const av = pod.avatar || POD_DEFAULT.avatar!;
                  const cur = POD_AVATARS.find((a) => a.v === av.provider) || POD_AVATARS[0];
                  const mins = Math.max(0.1, dialogTotalSec() / 60);
                  const est = av.provider === 'omni'
                    ? '≈ $2 за 2 клипа (2 × ~10с × ~$0.10/с) + правки чатом'
                    : cur.perMin > 0 ? `≈ $${(mins * cur.perMin).toFixed(2)} за ролик (${Math.round(mins * 10) / 10} мин × $${cur.perMin}/мин)` : 'без оплаты за минуту';
                  return (
                    <div className="space-y-2 rounded-xl p-2.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                      <div className="text-[11px] font-700 inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><UserRound size={13} style={{ color: '#ec4899' }} /> Анимация ведущих (говорящие головы)</div>
                      <div className="grid grid-cols-2 gap-1">
                        {POD_AVATARS.map((a) => { const sel = av.provider === a.v; return (
                          <button key={a.v} onClick={() => podMutate((p) => ({ ...p, avatar: { ...(p.avatar || POD_DEFAULT.avatar!), provider: a.v } }))}
                            className="rounded-lg px-1.5 py-1.5 text-left" style={{ background: sel ? 'rgba(236,72,153,0.14)' : 'var(--bg-secondary)', border: `1px solid ${sel ? '#ec4899' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                            <div className="text-[11px] font-700" style={{ color: sel ? '#ec4899' : 'var(--text-primary)' }}>{a.label}</div>
                            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{a.quality}</div>
                            <div className="text-[9px] font-600" style={{ color: a.perMin === 0 ? '#10b981' : 'var(--text-secondary)' }}>{a.cost}</div>
                          </button>
                        ); })}
                      </div>
                      {av.provider === 'heygen' && (
                        <>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Режим:</span>
                            {([['standard', 'Стандарт'], ['iv', 'Avatar IV (жесты/мимика)']] as [PodAvatarMode, string][]).map(([m, lbl]) => { const sel = (av.mode || 'standard') === m; return (
                              <button key={m} onClick={() => podMutate((p) => ({ ...p, avatar: { ...(p.avatar || POD_DEFAULT.avatar!), mode: m } }))}
                                className="text-[10px] font-700 px-2 py-1 rounded-md" style={{ background: sel ? '#ec4899' : 'var(--bg-secondary)', color: sel ? '#fff' : 'var(--text-muted)', border: `1px solid ${sel ? '#ec4899' : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
                            ); })}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Голос:</span>
                            {([['record', 'Из записи (реальные)'], ['heygen', 'HeyGen TTS'], ['elevenlabs', 'ElevenLabs']] as [PodVoiceSource, string][]).map(([vs, lbl]) => { const sel = (av.voiceSource || 'heygen') === vs; const disabled = vs === 'record' && !pod.recordingUrl; return (
                              <button key={vs} disabled={disabled} title={disabled ? 'Нужна загруженная запись подкаста' : ''} onClick={() => podMutate((p) => ({ ...p, avatar: { ...(p.avatar || POD_DEFAULT.avatar!), voiceSource: vs } }))}
                                className="text-[10px] font-600 px-2 py-1 rounded-md disabled:opacity-40" style={{ background: sel ? '#8b5cf6' : 'var(--bg-secondary)', color: sel ? '#fff' : 'var(--text-muted)', border: `1px solid ${sel ? '#8b5cf6' : 'var(--border-medium)'}`, cursor: disabled ? 'not-allowed' : 'pointer' }}>{lbl}</button>
                            ); })}
                          </div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            «Из записи» — в ролик идёт ВАШ голос как есть (по таймкодам реплик), HeyGen делает только мимику и липсинк.
                            Включается автоматически после «Разобрать запись».
                          </div>
                        </>
                      )}
                      {/* Подача/эмоция (движение) — топ-пресеты */}
                      {av.provider === 'heygen' && (av.voiceSource || 'heygen') === 'heygen' && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Подача/эмоция:</span>
                          {POD_EMOTIONS.map((e) => { const sel = (av.emotion || 'friendly') === e.v; return (
                            <button key={e.v} onClick={() => podMutate((p) => ({ ...p, avatar: { ...(p.avatar || POD_DEFAULT.avatar!), emotion: e.v } }))}
                              className="text-[10px] font-600 px-2 py-1 rounded-md" style={{ background: sel ? '#ec4899' : 'var(--bg-secondary)', color: sel ? '#fff' : 'var(--text-muted)', border: `1px solid ${sel ? '#ec4899' : 'var(--border-medium)'}`, cursor: 'pointer' }}>{e.label}</button>
                          ); })}
                        </div>
                      )}
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{cur.note} Оценка: <b style={{ color: 'var(--text-secondary)' }}>{est}</b>. Голос «Из записи» = реальные голоса ведущих (по таймкодам), ElevenLabs — настраивается в ElevenLabs. Suno — это музыка (фон), не речь.</p>
                      {/* Фоновая музыка на весь ролик */}
                      <div className="rounded-lg p-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-700 inline-flex items-center gap-1" style={{ color: 'var(--text-primary)' }}><Music size={11} style={{ color: '#8b5cf6' }} /> Фоновая музыка (весь ролик)</span>
                          {pod.music && <button onClick={() => podMutate((p) => ({ ...p, music: null }))} className="text-[10px]" style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>убрать</button>}
                        </div>
                        {pod.music ? (
                          <>
                            <div className="text-[10px] truncate mb-1" style={{ color: 'var(--text-secondary)' }}>{pod.music.name}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Громкость {pod.music.volumePct}%</span>
                              <input type="range" min={0} max={100} value={pod.music.volumePct} onChange={(e) => podMutate((p) => ({ ...p, music: p.music ? { ...p.music, volumePct: Number(e.target.value) } : p.music }))} style={{ flex: 1, accentColor: '#8b5cf6' }} />
                            </div>
                          </>
                        ) : (
                          <button onClick={() => openPodPick('music')} className="w-full py-1.5 rounded-md text-[11px] font-600" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>+ Добавить музыку (загрузить / из галереи)</button>
                        )}
                        <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>Если музыка длиннее ролика — обрежется. Генерацию через Suno добавлю следующим шагом.</p>
                      </div>
                      {av.provider === 'omni' && (
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{pod.groupPhotoUrl ? 'Есть общее фото студии → Omni оживит ВСЮ сцену одним клипом (оба ведущих в кадре, ИИ-голос), затем правь чатом.' : 'Нет общего фото — Omni оживит каждого ведущего отдельным клипом (2 лица в одном кадре модель блокирует). Загрузи общее фото студии (студия лиц) для цельной сцены.'} Реплики берутся из диалога.</p>
                      )}
                      <button onClick={runAnimate} disabled={animBusy}
                        className="w-full py-2 rounded-lg text-[12px] font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        style={{ background: 'rgba(236,72,153,0.14)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)', cursor: 'pointer' }}>
                        {animBusy ? <Loader2 size={14} className="animate-spin" /> : <UserRound size={14} />} {animBusy ? (av.provider === 'omni' ? 'Omni оживляет…' : 'Рендер идёт…') : (av.provider === 'omni' ? 'Оживить ведущих (Omni)' : 'Анимировать ведущих (сплит-скрин)')}
                      </button>
                      {av.provider === 'heygen' && pod.groupPhotoUrl && (
                        <>
                          <button onClick={runHeyGenStudio} disabled={animBusy}
                            className="w-full py-2 rounded-lg text-[12px] font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                            style={{ background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer' }}>
                            {animBusy ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />} Оживить НА студии (вырезать людей → HeyGen)
                          </button>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>«На студии»: вырезаю обоих ведущих из общего фото → HeyGen оживляет (Avatar IV, тело/руки) на зелёном → накладываю на фон студии. Голос — по выбору выше.</p>
                        </>
                      )}
                      {animNote && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{animNote}</p>}
                      {animJobs.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {animJobs.map((j) => (
                            <div key={j.videoId} className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                              <div style={{ aspectRatio: '9 / 16', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                {j.url ? <video src={j.url} controls muted className="w-full h-full object-cover" />
                                  : <div className="flex flex-col items-center gap-1"><Loader2 size={18} className="animate-spin" style={{ color: '#ec4899' }} /><span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{j.status === 'failed' ? 'ошибка' : 'рендер…'}</span></div>}
                              </div>
                              <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{j.name} ({j.host}){j.url ? ' ✓' : ''}</div>
                              {av.provider === 'omni' && j.url && j.interactionId && (
                                <div className="px-1.5 pb-1.5 space-y-1">
                                  <input value={j.edit || ''} onChange={(e) => { const val = e.target.value; setAnimJobs((prev) => prev.map((x) => x.host === j.host ? { ...x, edit: val } : x)); }}
                                    placeholder="Правка чатом: «улыбнись», «крупнее»…"
                                    className="w-full text-[10px] px-1.5 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                                  <button onClick={() => runOmniHostEdit(j.host)} disabled={j.editing || !(j.edit || '').trim()}
                                    className="w-full text-[10px] font-700 py-1 rounded-md inline-flex items-center justify-center gap-1 disabled:opacity-50"
                                    style={{ background: '#4285F4', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                    {j.editing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} {j.editing ? 'Меняю…' : 'Изменить клип'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {animJobs.length >= 2 && animJobs.every((j) => j.status === 'completed' && j.url) && (
                        <button onClick={runCompose} disabled={composeBusy}
                          className="w-full py-2 rounded-lg text-[12px] font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                          style={{ background: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          {composeBusy ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />} {composeBusy ? (studioBg ? 'Собираю на студии…' : 'Склеиваю сплит-скрин…') : (studioBg ? 'Собрать НА студии (chroma-key)' : 'Склеить сплит-скрин + музыка')}
                        </button>
                      )}
                      {composeNote && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{composeNote}</p>}
                      {composeUrl && (
                        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-medium)' }}>
                          <video src={composeUrl} controls className="w-full" style={{ aspectRatio: '9 / 16', background: '#000' }} />
                          <div className="text-[10px] px-1.5 py-1" style={{ color: 'var(--text-secondary)' }}>{studioBg ? 'Готово: ведущие на фоне студии ✓ (в Галерее)' : 'Готовый сплит-скрин ✓ (сохранён в Галерею)'}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Мин. длина реплики */}
                <div className="space-y-1">
                  <div className="text-[11px] font-600" style={{ color: 'var(--text-muted)' }}>Мин. длина реплики</div>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)', maxWidth: 220 }}>
                    {([[0, 'Авто'], [4, '4с'], [6, '6с']] as [number, string][]).map(([s, lbl]) => (
                      <button key={s} onClick={() => podMutate((p) => ({ ...p, segSec: s }))}
                        className="py-1.5 rounded-lg text-[11px] font-700"
                        style={{ background: pod.segSec === s ? 'var(--bg-secondary)' : 'transparent', color: pod.segSec === s ? '#ec4899' : 'var(--text-muted)' }}>{lbl}</button>
                    ))}
                  </div>
                </div>

                {podNote && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{podNote}</p>}

                <div className="rounded-xl p-3 text-[11px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  Сплит-скрин собирается на воркере (ffmpeg): без GPU — статичные фото + 2 голоса,
                  на GPU — говорящие головы (SadTalker). «Разобрать запись» использует pyannote при
                  наличии HF-ключа (иначе — разбивка по паузам).
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => save()} className="text-sm font-600 px-3 py-2.5 rounded-xl inline-flex items-center gap-1.5"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Save size={15} /> Сохранить</button>
                  <button onClick={buildPodcast} disabled={building || !!podBuildHint()} title={podBuildHint() || ''}
                    className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-700 py-2.5 rounded-xl disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#ec4899,#f472b6)', color: '#fff', border: 'none', cursor: podBuildHint() ? 'not-allowed' : 'pointer' }}>
                    {building ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Собрать подкаст
                  </button>
                </div>
                {podBuildHint() && !building && (
                  <p className="text-[11px] text-center" style={{ color: '#f59e0b' }}>{podBuildHint()}</p>
                )}
              </div>
            ) : cloudPanel === 'editor' ? (
              <div className="space-y-3">
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Просмотр и обрезка видео или аудио: обрезать начало/конец, вырезать куски, повернуть (видео),
                  склеить несколько роликов. Сохранение неразрушающее — результат уходит в Галерею.
                </p>

                {editorClips.length > 0 && (
                  <div className="space-y-1.5">
                    {editorClips.map((c, i) => (
                      <div key={c.url} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <span className="text-[11px] font-700" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                        {c.type === 'audio' ? <Music size={13} style={{ color: 'var(--brand)', flexShrink: 0 }} /> : <Video size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-primary)' }} title={c.name}>{c.name}</span>
                        <button onClick={() => setEditorView(c)} title="Открыть в редакторе" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}><Scissors size={13} /></button>
                        <button onClick={() => removeEditorClip(c.url)} title="Убрать" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {editorClips.length === 1 && (
                  <button onClick={() => setEditorView(editorClips[0])} className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2"
                    style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                    <Film size={16} /> Открыть редактор
                  </button>
                )}
                {editorClips.length >= 2 && (
                  <button onClick={mergeEditorClips} disabled={editorMerging} className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                    {editorMerging ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />} Склеить {editorClips.length} видео
                  </button>
                )}
                {editorNote && <p className="text-[11px]" style={{ color: '#ef4444' }}>{editorNote}</p>}

                {editorResult && (
                  <div className="p-2.5 rounded-xl space-y-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                    <div className="text-xs font-600 inline-flex items-center gap-1.5" style={{ color: '#10b981' }}><Check size={14} /> Результат в Галерее</div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditorView(editorResult)} className="flex-1 py-2 rounded-lg text-xs font-600 inline-flex items-center justify-center gap-1.5" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Film size={13} /> Открыть</button>
                      <a href={editorResult.url} target="_blank" rel="noreferrer" className="flex-1 py-2 rounded-lg text-xs font-600 inline-flex items-center justify-center gap-1.5" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', textDecoration: 'none' }}><Download size={13} /> Скачать</a>
                    </div>
                  </div>
                )}

                {editorPick && (
                  <div className="rounded-xl p-2.5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-medium)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-600" style={{ color: 'var(--text-muted)' }}>Из Галереи — клик добавляет</span>
                    </div>
                    {/* Загрузка своих файлов прямо в Галерею — те же кнопки, что на странице «Галерея» */}
                    <input ref={edMediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => uploadEditorMedia(e.target.files, 'reference')} />
                    <input ref={edAudioInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => uploadEditorMedia(e.target.files, 'audio')} />
                    <div className="flex items-center gap-1.5 mb-2">
                      <button type="button" onClick={() => edMediaInputRef.current?.click()} disabled={editorUploading} title="Загрузить видео/изображение в «Референс»"
                        className="inline-flex items-center gap-1.5 text-[11px] font-600 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: editorUploading ? 'wait' : 'pointer' }}>
                        {editorUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Медиа
                      </button>
                      <button type="button" onClick={() => edAudioInputRef.current?.click()} disabled={editorUploading} title="Загрузить аудио в «Аудио»"
                        className="inline-flex items-center gap-1.5 text-[11px] font-600 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: editorUploading ? 'wait' : 'pointer' }}>
                        {editorUploading ? <Loader2 size={13} className="animate-spin" /> : <Music size={13} />} Аудио
                      </button>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>загрузить своё</span>
                    </div>
                    {/* Вкладки-папки (как в Галерее): Тренды/Референс/Аудио/Из анализа + счётчики */}
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-lg mb-2" style={{ background: 'var(--bg-tertiary)' }}>
                      {ED_TABS.map((tb) => {
                        const n = editorGallery.filter((g) => g.cat === tb.key).length;
                        const active = editorTab === tb.key;
                        return (
                          <button key={tb.key} onClick={() => setEditorTab(tb.key)}
                            className="inline-flex items-center justify-center gap-1 px-1 py-1.5 rounded-md text-[11px] font-600 whitespace-nowrap"
                            style={{ background: active ? 'var(--brand)' : 'transparent', color: active ? 'var(--brand-contrast)' : 'var(--text-muted)' }}>
                            {tb.icon}<span className="truncate">{tb.label}</span>{n > 0 && <span style={{ opacity: 0.7 }}>{n}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {/* Поиск по имени */}
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                      <input value={editorQuery} onChange={(e) => setEditorQuery(e.target.value)} placeholder="Поиск по имени…"
                        className="w-full pl-8 pr-2 py-2 rounded-lg text-xs outline-none"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                    </div>
                    {(() => {
                      const filtered = editorGallery.filter((g) => g.cat === editorTab
                        && (!editorQuery.trim() || g.name.toLowerCase().includes(editorQuery.trim().toLowerCase())));
                      if (editorGalLoading) return <div className="py-6 text-center"><Loader2 size={18} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>;
                      if (filtered.length === 0) return <p className="text-[11px] py-4 text-center" style={{ color: 'var(--text-muted)' }}>{editorQuery.trim() ? 'Ничего не найдено.' : 'В этой папке пусто.'}</p>;
                      return (
                        <>
                          <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>Найдено: {filtered.length}</div>
                          <div className="grid grid-cols-3 gap-2" style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {filtered.map((g) => {
                              const sel = editorClips.some((c) => c.url === g.url);
                              return (
                                <button key={g.url} onClick={() => addEditorClip({ url: g.url, name: g.name, type: g.type })} title={g.name}
                                  className="rounded-xl overflow-hidden text-left" style={{ background: 'var(--bg-tertiary)', border: sel ? '2px solid var(--brand)' : '1px solid var(--border-medium)', cursor: 'pointer', padding: 0 }}>
                                  <div className="relative flex items-center justify-center" style={{ aspectRatio: '1 / 1', background: '#000' }}>
                                    {g.type === 'audio'
                                      ? <Music size={30} style={{ color: 'var(--brand)' }} />
                                      : (g.cover ? <img src={g.cover} alt="" className="w-full h-full object-cover" /> : <video src={`${g.url}#t=0.1`} muted preload="metadata" className="w-full h-full object-cover" />)}
                                    {g.type === 'audio' && <span className="absolute bottom-1 left-1 text-[8px] font-700 px-1 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>АУДИО</span>}
                                    {sel && <span className="absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)', color: '#fff' }}><Check size={12} /></span>}
                                  </div>
                                  <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{g.name}</div>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <p><b>Контент-план</b> — расписание и публикация готовых роликов по соцсетям.</p>
                <p style={{ color: 'var(--text-muted)' }}>Календарь + публикатор — этап C. Сейчас узел можно связывать: по стрелке сюда попадёт готовое видео из цепочки.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Единый просмотрщик-редактор видео (плеер + обрезка), вызывается из облака «Редактор» */}
      <VideoViewer
        open={!!editorView}
        url={editorView?.url || ''}
        title={editorView?.name}
        kind={editorView?.type}
        onClose={() => setEditorView(null)}
        onSaved={async (r) => {
          const t = editorView?.type === 'audio' ? 'audio' : 'video';
          setEditorResult({ url: r.fileUrl, name: t === 'audio' ? 'Обрезанное аудио' : 'Обрезанное видео', type: t }); setDirty(true);
          // Обновить Галерею в пикере, чтобы обрезанный файл сразу появился, и открыть его вкладку.
          await loadEditorGallery();
          setEditorTab(t === 'audio' ? 'audio' : 'reference');
        }}
      />

      {/* Прогресс сборки «Собрать» — в углу, чтобы не закрывать паутину и центральный узел
          (импульсы и кольцо активного блока видны во время рендера). */}
      {buildJob && !buildMinimized && (
        <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 95, width: 'min(430px, calc(100% - 32px))', maxHeight: '70%', overflow: 'auto' }}>
          <div className="me-pop-in" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none', boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                {building && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--brand)' }} />}
                {buildJob.status === 'done' ? 'Готово ✓' : buildJob.status === 'failed' ? 'Ошибка' : 'Собираю ролик…'}
              </span>
              <button onClick={() => (building ? setBuildMinimized(true) : setBuildJob(null))}
                title={building ? 'Свернуть — рендер продолжится в фоне' : 'Закрыть'}
                className="inline-flex items-center gap-1 text-xs font-600 px-2 py-1 rounded-lg"
                style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {building ? <><Minus size={14} /> Свернуть</> : <X size={18} />}
              </button>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: 10 }}>
              <div className={building ? 'me-shimmer' : undefined} style={{ height: '100%', width: `${buildJob.status === 'done' ? 100 : (buildJob.progress || 0)}%`,
                background: building ? undefined : (buildJob.status === 'failed' ? '#ef4444' : '#10b981'), transition: 'width .4s' }} />
            </div>
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Шагов: {buildJob.steps?.length || 0} · статус: {buildJob.status}
            </div>
            {Array.isArray(buildJob.steps) && buildJob.steps.length > 0 && (
              <div className="space-y-1 mb-2" style={{ maxHeight: 200, overflow: 'auto' }}>
                {buildJob.steps.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: s.status === 'done' ? '#10b981' : s.status === 'skipped' ? '#f59e0b' : s.status === 'running' ? 'var(--brand)' : 'var(--text-muted)' }}>●</span>
                    {META[s.kind as MKind]?.label || s.kind}
                    <span style={{ color: 'var(--text-muted)' }}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}
            {buildJob.error && <p className="text-xs" style={{ color: '#ef4444' }}>{buildJob.error}</p>}
            {buildJob.status === 'done' && (
              <p className="text-xs mt-1" style={{ color: buildJob.resultAssetId ? '#10b981' : 'var(--text-muted)' }}>
                {buildJob.resultAssetId ? 'Ролик добавлен в Галерею → вкладка «Референс».' : (buildJob.note || 'Конвейер выполнен.')}
              </p>
            )}
            {buildJob.status === 'done' && buildJob.resultUrl && (
              <a href={buildJob.resultUrl} download className="mt-3 inline-flex items-center justify-center gap-1.5 text-sm font-700 py-2.5 px-4 rounded-xl w-full"
                style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', textDecoration: 'none' }}>
                <Download size={16} /> Скачать видео
              </a>
            )}
            {building && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                Можно свернуть — ролик соберётся в фоне и появится в Галерее.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Плавающая пилюля: рендер в фоне (свернули прогресс) */}
      {buildJob && buildMinimized && (
        <button onClick={() => setBuildMinimized(false)} className={`me-float-in${buildJob.status === 'done' ? ' me-ready' : ''}`}
          title={buildJob.status === 'done' ? 'Ролик готов — открыть' : 'Идёт сборка — открыть'}
          style={{ position: 'absolute', right: 16, bottom: 84, zIndex: 96, display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-secondary)', border: `1px solid ${buildJob.status === 'failed' ? '#ef4444' : buildJob.status === 'done' ? '#10b981' : 'var(--brand)'}`,
            borderRadius: 999, padding: '8px 14px 8px 10px', cursor: 'pointer', boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}>
          {buildJob.status === 'done'
            ? <Check size={16} style={{ color: '#10b981' }} />
            : buildJob.status === 'failed'
            ? <X size={16} style={{ color: '#ef4444' }} />
            : <Loader2 size={16} className="animate-spin" style={{ color: 'var(--brand)' }} />}
          <span className="text-xs font-700" style={{ color: 'var(--text-primary)' }}>
            {buildJob.status === 'done' ? 'Ролик готов' : buildJob.status === 'failed' ? 'Ошибка сборки' : `Собираю… ${buildJob.progress || 0}%`}
          </span>
        </button>
      )}

      {/* Прогресс ПАКЕТНОЙ сборки (N источников → N роликов) */}
      {showBatch && batchJobs.length > 0 && !batchMinimized && (() => {
        const done = batchJobs.filter((b) => b.job?.status === 'done').length;
        const failed = batchJobs.filter((b) => b.job?.status === 'failed').length;
        const total = batchJobs.length;
        return (
        <div onClick={() => (batchRunning ? setBatchMinimized(true) : setShowBatch(false))} style={{ position: 'absolute', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 480, maxHeight: '82vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                {batchRunning ? <Loader2 size={16} className="animate-spin" style={{ color: 'var(--brand)' }} /> : <Film size={16} style={{ color: 'var(--brand)' }} />}
                Пакет: {done}/{total} готово{failed ? ` · ${failed} с ошибкой` : ''}
              </span>
              <button onClick={() => (batchRunning ? setBatchMinimized(true) : setShowBatch(false))}
                title={batchRunning ? 'Свернуть — сборка продолжится в фоне' : 'Закрыть'}
                className="inline-flex items-center gap-1 text-xs font-600 px-2 py-1 rounded-lg"
                style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {batchRunning ? <><Minus size={14} /> Свернуть</> : <X size={18} />}
              </button>
            </div>
            <div className="space-y-2.5">
              {batchJobs.map((b, i) => {
                const st = b.job?.status; const pct = st === 'done' ? 100 : (b.job?.progress || 0);
                const col = st === 'failed' ? '#ef4444' : st === 'done' ? '#10b981' : 'var(--brand)';
                return (
                  <div key={i} className="rounded-xl p-2.5" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-700" style={{ color: 'var(--text-muted)' }}>#{i + 1}</span>
                      <span className="text-xs font-600 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{b.source}</span>
                      <span className="text-[11px] font-700" style={{ color: col }}>
                        {st === 'done' ? 'Готово ✓' : st === 'failed' ? 'Ошибка' : st === 'queued' ? 'В очереди' : `${pct}%`}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                      <div className={st !== 'done' && st !== 'failed' && batchRunning ? 'me-shimmer' : undefined}
                        style={{ height: '100%', width: `${pct}%`, background: st === 'failed' ? '#ef4444' : st === 'done' ? '#10b981' : undefined, transition: 'width .4s' }} />
                    </div>
                    {b.job?.error && <p className="text-[11px] mt-1" style={{ color: '#ef4444' }}>{b.job.error}</p>}
                    {st === 'done' && b.job?.resultUrl && (
                      <a href={b.job.resultUrl} download className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-700" style={{ color: 'var(--brand)', textDecoration: 'none' }}>
                        <Download size={12} /> Скачать
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
              {batchRunning
                ? 'Ролики собираются по очереди. Можно свернуть — всё доделается в фоне и появится в Галерее («Референс»).'
                : 'Готовые ролики добавлены в Галерею → вкладка «Референс».'}
            </p>
          </div>
        </div>
        );
      })()}

      {/* Плавающая пилюля: пакетная сборка в фоне */}
      {showBatch && batchJobs.length > 0 && batchMinimized && (() => {
        const done = batchJobs.filter((b) => b.job?.status === 'done').length;
        const total = batchJobs.length;
        return (
        <button onClick={() => setBatchMinimized(false)} className={`me-float-in${!batchRunning ? ' me-ready' : ''}`}
          title={batchRunning ? 'Идёт пакетная сборка — открыть' : 'Пакет готов — открыть'}
          style={{ position: 'absolute', right: 16, bottom: 140, zIndex: 96, display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-secondary)', border: `1px solid ${batchRunning ? 'var(--brand)' : '#10b981'}`,
            borderRadius: 999, padding: '8px 14px 8px 10px', cursor: 'pointer', boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}>
          {batchRunning ? <Loader2 size={16} className="animate-spin" style={{ color: 'var(--brand)' }} /> : <Check size={16} style={{ color: '#10b981' }} />}
          <span className="text-xs font-700" style={{ color: 'var(--text-primary)' }}>Пакет {done}/{total}</span>
        </button>
        );
      })()}
    </div>
  );
}
