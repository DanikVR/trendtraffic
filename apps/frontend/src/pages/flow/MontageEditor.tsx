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
  Cloud, CalendarDays, Download, Link2, Film,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

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
  useLlm: boolean;
  choices: Record<string, string[]>;
}

const META: Record<MKind, Meta> = {
  news:      { label: 'Новости', icon: <Newspaper size={18} />, hint: 'Источник: RSS / Telegram / сайт / рубрика → текст + фото',
    choices: [{ id: 'type', label: 'Тип источника', def: ['rss'], opts: [{ v: 'rss', label: 'RSS' }, { v: 'telegram', label: 'Telegram' }, { v: 'site', label: 'Сайт' }, { v: 'rubric', label: 'Рубрика' }] }],
    text: 'RSS-URL, @telegram-канал или ссылка', llm: true },
  research:  { label: 'Исследование', icon: <Search size={18} />, hint: 'Веб-поиск темы + источники', text: 'Тема для ресёрча…', llm: true },
  length:    { label: 'Длина', icon: <Scissors size={18} />, hint: 'Длина ролика',
    choices: [{ id: 'duration', label: 'Длительность', def: ['30'], opts: [{ v: '15', label: '15 сек' }, { v: '30', label: '30 сек' }, { v: '60', label: '60 сек' }, { v: 'best', label: 'Лучший момент (ЛЛМ)' }, { v: 'full', label: 'Весь' }] }],
    text: 'или диапазон 0:10–0:40', llm: true },
  format:    { label: 'Формат', icon: <Crop size={18} />, hint: 'Ориентация под площадку',
    choices: [{ id: 'orient', label: 'Ориентация', def: ['9:16'], opts: [{ v: '9:16', label: 'Вертикаль 9:16' }, { v: '16:9', label: 'Гориз 16:9' }, { v: '1:1', label: 'Квадрат' }, { v: '4:5', label: '4:5' }, { v: '21:9', label: 'Cinematic' }] }] },
  silence:   { label: 'Паузы', icon: <VolumeX size={18} />, hint: 'Тишина между словами',
    choices: [{ id: 'mode', label: 'Что делать с паузами', def: ['cut'], opts: [{ v: 'none', label: 'Не трогать' }, { v: 'cut', label: 'Вырезать' }, { v: 'speed', label: 'Ускорить' }] }] },
  subtitles: { label: 'Субтитры', icon: <Type size={18} />, hint: 'Стиль титров',
    choices: [
      { id: 'style', label: 'Стиль', def: ['word'], opts: [{ v: 'none', label: 'Без' }, { v: 'word', label: 'По словам' }, { v: 'karaoke', label: 'Караоке' }, { v: 'plain', label: 'Обычные' }] },
      { id: 'pos', label: 'Позиция', def: ['bottom'], opts: [{ v: 'bottom', label: 'Низ' }, { v: 'center', label: 'Центр' }, { v: 'top', label: 'Верх' }] },
    ], text: 'Пожелания к титрам: шрифт, кегль, межбуквенный и межстрочный интервал, обводка, цвет, тень…', llm: true },
  audio:     { label: 'Аудио', icon: <Music size={18} />, hint: 'Музыка + баланс с голосом',
    choices: [
      { id: 'vol', label: 'Громкость музыки', def: ['mid'], opts: [{ v: 'low', label: 'Тихо' }, { v: 'mid', label: 'Средне' }, { v: 'high', label: 'Громко' }] },
      { id: 'duck', label: 'Приглушать под голос', def: ['on'], opts: [{ v: 'on', label: 'Вкл' }, { v: 'off', label: 'Выкл' }] },
    ], media: 'Музыка из Галереи' },
  voiceover: { label: 'Озвучка', icon: <Mic size={18} />, hint: 'Текст → голос (TTS)',
    choices: [{ id: 'voice', label: 'Голос', def: ['female'], opts: [{ v: 'female', label: 'Женский' }, { v: 'male', label: 'Мужской' }] }],
    text: 'текст для озвучки…', media: 'Референс голоса', llm: true },
  color:     { label: 'Цветокор', icon: <Palette size={18} />, hint: 'Настроение картинки',
    choices: [{ id: 'preset', label: 'Пресет', def: ['none'], opts: [{ v: 'none', label: 'Без' }, { v: 'warm', label: 'Тёплый' }, { v: 'cold', label: 'Холодный' }, { v: 'cinema', label: 'Кино' }, { v: 'bw', label: 'Ч/Б' }, { v: 'vivid', label: 'Яркий' }] }],
    text: 'Опишите цвет: «тёплый плёночный закат, мягкие тени, лёгкое зерно»…', media: 'LUT (.cube) или референс' },
  broll:     { label: 'B-roll', icon: <Image size={18} />, hint: 'Перебивки / вставки',
    choices: [{ id: 'src', label: 'Откуда брать', def: ['reference'], opts: [{ v: 'reference', label: 'Из Референса' }, { v: 'ai', label: 'AI-генерация' }, { v: 'stock', label: 'Стоки' }] }],
    text: 'что вставить и когда…', media: 'Медиа из Галереи', llm: true },
  avatar:    { label: 'Аватар', icon: <UserRound size={18} />, hint: 'Говорящая голова / UGC',
    choices: [{ id: 'engine', label: 'Движок', def: ['heygen'], opts: [{ v: 'heygen', label: 'HeyGen (облако)' }, { v: 'sadtalker', label: 'SadTalker (локально)' }] }],
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
  news: 'Claude соберёт свежую новость по источнику/теме (веб-поиск) для озвучки.',
  length: 'Claude выберет самый сильный момент по транскрипту и обрежет под длительность.',
};

// Облачные узлы графа (перетаскиваемые): Google Omni (генерация видео) и Контент-план.
type CloudId = 'omni' | 'plan';
const CLOUD: Record<CloudId, { label: string; icon: React.ReactNode; color: string; glow: string; def: { x: number; y: number } }> = {
  omni: { label: 'Google Omni', icon: <Cloud size={24} />, color: '#4285F4', glow: 'rgba(66,133,244,.35)', def: { x: 85, y: 24 } },
  plan: { label: 'Контент-план', icon: <CalendarDays size={22} />, color: '#10b981', glow: 'rgba(16,185,129,.35)', def: { x: 85, y: 76 } },
};

// ── Преобразование исходного видео по таймлайну (узел Google Omni) ──
// engine: 'omni' — сгенерировать новый клип (Veo 3.1, 4/6/8с, текст/кадр→видео);
//         'v2v'  — ре-стайл реального фрагмента (Runway Gen-4 / FAL-Kling).
type OmniEngine = 'omni' | 'v2v';
type OmniMode = 'whole' | 'part' | 'inserts';
type V2VProvider = 'runway' | 'fal';
interface OmniSeg {
  id: string;
  start: number;          // доля таймлайна 0..1
  end: number;            // доля таймлайна 0..1
  engine: OmniEngine;
  prompt: string;         // «как преобразовать»
  lenSec: 4 | 6 | 8;      // длина генерации (engine=omni)
  seedFrame: boolean;     // omni: взять кадр из start как первый кадр
  provider: V2VProvider;  // engine=v2v: чем ре-стайлить
}
interface OmniSpec { mode: OmniMode; segments: OmniSeg[]; }
let omniSeq = 0;
const newSeg = (start: number, end: number): OmniSeg =>
  ({ id: `seg${++omniSeq}`, start, end, engine: 'omni', prompt: '', lenSec: 8, seedFrame: true, provider: 'runway' });
const OMNI_DEFAULT: OmniSpec = { mode: 'whole', segments: [newSeg(0, 1)] };
const V2V_LABEL: Record<V2VProvider, string> = { runway: 'Runway Gen-4', fal: 'Kling (FAL)' };

interface Preset { name: string; kinds: MKind[]; }
const NEWS_CHAIN: MKind[] = ['news', 'voiceover', 'broll', 'subtitles', 'audio', 'format', 'export'];
const PRESET_GROUPS: { group: string; presets: Preset[] }[] = [
  { group: 'Новости', presets: [
    { name: 'Новости из RSS', kinds: NEWS_CHAIN },
    { name: 'Из Telegram-канала', kinds: NEWS_CHAIN },
    { name: 'С сайта (рубрика)', kinds: NEWS_CHAIN },
  ] },
  { group: 'Короткие ролики', presets: [
    { name: 'Клип-фабрика', kinds: ['length', 'format', 'silence', 'subtitles', 'audio', 'export'] },
    { name: 'Подкаст → шортс', kinds: ['length', 'format', 'subtitles', 'audio', 'export'] },
    { name: 'Reels-нарезка', kinds: ['length', 'format', 'silence', 'subtitles', 'export'] },
  ] },
  { group: 'Говорящие', presets: [
    { name: 'Говорящая голова', kinds: ['length', 'format', 'subtitles', 'audio', 'color', 'export'] },
    { name: 'Аватар-спикер', kinds: ['research', 'voiceover', 'avatar', 'subtitles', 'export'] },
    { name: 'UGC-отзыв', kinds: ['avatar', 'voiceover', 'subtitles', 'audio', 'export'] },
  ] },
  { group: 'Постановочные', presets: [
    { name: 'Кинематик', kinds: ['length', 'format', 'color', 'audio', 'export'] },
    { name: 'Объяснитель', kinds: ['research', 'voiceover', 'broll', 'subtitles', 'audio', 'export'] },
    { name: 'Документалка', kinds: ['length', 'broll', 'color', 'audio', 'export'] },
  ] },
  { group: 'Сервисные', presets: [
    { name: 'Скрин-демо', kinds: ['length', 'silence', 'subtitles', 'audio', 'export'] },
    { name: 'Дубляж', kinds: ['voiceover', 'subtitles', 'export'] },
    { name: 'Гибрид', kinds: ['length', 'format', 'broll', 'subtitles', 'audio', 'export'] },
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

export default function MontageEditor({ flowId, onBack }: { flowId: string; onBack: () => void }) {
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
  const [media, setMedia] = useState<{ id: string; fileUrl: string; title: string; kind: string }[]>([]);
  const [uploading, setUploading] = useState(false);   // загрузка медиа с устройства
  const [dragOver, setDragOver] = useState(false);     // подсветка зоны drag-and-drop
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildJob, setBuildJob] = useState<any | null>(null);
  const [buildMinimized, setBuildMinimized] = useState(false); // свернуть прогресс → рендер в фоне
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [sources, setSources] = useState<{ url: string; name: string; thumb?: string; type: string }[]>([]);
  // Облачные узлы (Omni / Контент-план): позиции (%), связи-стрелки, режим связывания, панель.
  const [cloud, setCloud] = useState<Record<CloudId, { x: number; y: number }>>({ omni: { ...CLOUD.omni.def }, plan: { ...CLOUD.plan.def } });
  const [cloudEdges, setCloudEdges] = useState<{ from: string; to: string }[]>([]);
  const [pending, setPending] = useState<{ from: string; x: number; y: number } | null>(null); // тянем стрелку
  const pendingRef = useRef<{ from: string; x: number; y: number } | null>(null);
  const [cloudPanel, setCloudPanel] = useState<CloudId | null>(null);
  // Omni: спецификация преобразования исходного видео по таймлайну.
  const [omniSpec, setOmniSpec] = useState<OmniSpec>(OMNI_DEFAULT);
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
            .map((x: any) => ({ id: x.id, kind: x.data.kind, text: x.data.text || '', mediaUrl: x.data.mediaUrl || null, mediaName: x.data.mediaName || null, useLlm: !!x.data.useLlm, choices: hydrate(x.data.kind, x.data.choices) }));
          setNodes(mapped);
          const src = d.flow.graph?.source;
          if (src && typeof src.url === 'string') { setSourceUrl(src.url); setSourceName(src.name || 'видео'); }
          if (d.flow.graph?.cloud && typeof d.flow.graph.cloud === 'object') setCloud((c) => ({ ...c, ...d.flow.graph.cloud }));
          if (Array.isArray(d.flow.graph?.cloudEdges)) setCloudEdges(d.flow.graph.cloudEdges);
          if (d.flow.graph?.omni && typeof d.flow.graph.omni === 'object') {
            const segs = Array.isArray(d.flow.graph.omni.segments) ? d.flow.graph.omni.segments : [];
            setOmniSpec({ mode: d.flow.graph.omni.mode || 'whole', segments: segs.length ? segs : [newSeg(0, 1)] });
          }
          if (mapped.length === 0) setShowPresets(true);
        }
      } catch { /* пусто */ }
      finally { setLoading(false); }
    })();
  }, [flowId, headers]);

  const save = async () => {
    setSaving(true);
    try {
      const graphNodes = nodes.map((n, i) => ({ id: n.id, type: 'montage', position: { x: i, y: 0 }, data: { kind: n.kind, text: n.text, mediaUrl: n.mediaUrl, mediaName: n.mediaName, useLlm: n.useLlm, choices: n.choices } }));
      const source = sourceUrl ? { url: sourceUrl, name: sourceName || undefined } : null;
      await fetch(`/api/flows/${flowId}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ graph: { nodes: graphNodes, edges: [], source, cloud, cloudEdges, omni: omniSpec, brief } }) });
      setDirty(false);
    } catch { /* */ }
    finally { setSaving(false); }
  };

  // ── Omni: редактирование спецификации преобразования ──
  const omniMutate = (fn: (s: OmniSpec) => OmniSpec) => { setOmniSpec((s) => fn(s)); setDirty(true); };
  const setOmniMode = (mode: OmniMode) => omniMutate((s) => {
    if (mode === 'whole') return { mode, segments: [{ ...(s.segments[0] || newSeg(0, 1)), start: 0, end: 1 }] };
    if (mode === 'part') return { mode, segments: [s.segments[0] ? { ...s.segments[0] } : newSeg(0, 0.34)] };
    return { mode, segments: s.segments.length ? s.segments.slice(0, 3) : [newSeg(0, 0.25)] }; // inserts
  });
  const updateSeg = (id: string, patch: Partial<OmniSeg>) =>
    omniMutate((s) => ({ ...s, segments: s.segments.map((g) => g.id === id ? { ...g, ...patch } : g) }));
  const addInsert = () => omniMutate((s) => {
    if (s.segments.length >= 3) return s;
    const last = s.segments[s.segments.length - 1];
    const start = last ? Math.min(0.9, last.end + 0.05) : 0;
    return { ...s, segments: [...s.segments, newSeg(start, Math.min(1, start + 0.2))] };
  });
  const removeSeg = (id: string) => omniMutate((s) => ({ ...s, segments: s.segments.filter((g) => g.id !== id) }));
  const fmtT = (frac: number) => srcDuration > 0 ? `${(frac * srcDuration).toFixed(1)}с` : `${Math.round(frac * 100)}%`;
  const omniGenSeconds = omniSpec.segments.filter((g) => g.engine === 'omni').reduce((a, g) => a + g.lenSec, 0);

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
    if (building) return;
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

  const applyPreset = (preset: Preset) => { setName(preset.name); setNodes(preset.kinds.map(newNode)); setDirty(true); setShowPresets(false); };

  const loadMedia = async () => {
    try {
      const [r, a] = await Promise.all([
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
        fetch('/api/trends/media?kind=audio', { headers: headers() }),
      ]);
      const ref = r.ok ? (await r.json()).assets || [] : [];
      const aud = a.ok ? (await a.json()).assets || [] : [];
      setMedia([...ref, ...aud].map((m: any) => ({ id: m.id, fileUrl: m.fileUrl, title: m.originalName || 'файл', kind: m.mediaType })));
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
        if (res.ok) { const d = await res.json(); if (d.asset) lastAsset = d.asset; }
      }
      await loadMedia();
      if (lastAsset) patchNode(attachFor, { mediaUrl: lastAsset.fileUrl, mediaName: lastAsset.originalName || 'файл' });
    } catch { /* тихо */ }
    finally { setUploading(false); }
  };

  // Пикер исходного видео: скачанные тренды + видео-референсы из Галереи.
  const openSourcePicker = async () => {
    setShowSource(true);
    try {
      const [v, r] = await Promise.all([
        fetch('/api/trends/videos?downloaded=1', { headers: headers() }),
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
      ]);
      const vids = v.ok ? ((await v.json()).videos || []) : [];
      const refs = r.ok ? ((await r.json()).assets || []) : [];
      const list: { url: string; name: string; thumb?: string; type: string }[] = [];
      for (const x of vids) if (x.fileUrl) list.push({ url: x.fileUrl, name: String(x.description || x.authorName || x.author || 'Видео').slice(0, 40), thumb: x.coverUrl, type: 'trend' });
      for (const m of refs) if (m.mediaType === 'video' && m.fileUrl) list.push({ url: m.fileUrl, name: m.originalName || 'видео', type: 'reference' });
      setSources(list);
    } catch { setSources([]); }
  };

  const selected = nodes.find((n) => n.id === selectedId) || null;

  // ── Облачные узлы: позиции, связи-стрелки, перетаскивание ──────────────────
  const cloudPoint = (id: string): { x: number; y: number } | null => {
    const base = id === 'center' ? { x: 50, y: 50 } : (id === 'omni' || id === 'plan') ? cloud[id] : null;
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
    setCloudPanel(id);
  };

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

  if (loading) {
    return <div className="flex items-center justify-center" style={{ height: '70vh' }}><Loader2 size={26} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 8px)', position: 'relative' }}>
      <style>{`
        .me-node{transition:transform .18s cubic-bezier(.34,1.56,.64,1), filter .18s ease;}
        .me-node:hover{transform:translate(-50%,-50%) scale(1.12);filter:brightness(1.3);}
        .me-node-in{animation:meNodeIn .45s cubic-bezier(.34,1.56,.64,1) backwards;}
        @keyframes meNodeIn{from{opacity:0;transform:translate(-50%,-50%) scale(.3)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        .me-pop-in{animation:mePop .2s ease;}
        @keyframes mePop{from{opacity:0;transform:translate(-50%,-50%) scale(.6)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        /* центр — обработка */
        .me-build{animation:meBuildPulse 1.6s ease-in-out infinite!important;}
        @keyframes meBuildPulse{0%,100%{box-shadow:0 0 30px rgba(255,115,0,.5)}50%{box-shadow:0 0 64px rgba(255,115,0,1)}}
        .me-ring{position:absolute;left:50%;top:50%;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;border:3px solid transparent;border-top-color:#ff7300;border-right-color:rgba(255,115,0,.35);animation:meSpin 1s linear infinite;pointer-events:none;}
        @keyframes meSpin{to{transform:rotate(360deg)}}
        /* шиммер прогресса */
        .me-shimmer{background:linear-gradient(90deg,#ff7300,#ffd9b3,#ff7300);background-size:200% 100%;animation:meShimmer 1.3s linear infinite;}
        @keyframes meShimmer{to{background-position:-200% 0}}
        .me-fab{transition:transform .15s ease, filter .15s ease, box-shadow .15s ease;}
        .me-fab:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.06);box-shadow:0 12px 32px rgba(255,94,0,.6);}
        .me-fab:active:not(:disabled){transform:translateY(0) scale(.97);}
        /* нижнее поле */
        .me-addbar{transition:box-shadow .25s ease, transform .2s ease, border-color .25s ease;}
        .me-addbar:hover,.me-addbar:focus-within{transform:translateY(-2px);box-shadow:0 10px 30px rgba(255,115,0,.18);border-color:#ff7300!important;}
        /* плавающая пилюля рендера */
        .me-float-in{animation:meFloatIn .3s cubic-bezier(.34,1.56,.64,1);}
        @keyframes meFloatIn{from{opacity:0;transform:translateY(14px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
        .me-dot{animation:meDot 1.4s ease-in-out infinite;}
        @keyframes meDot{0%,100%{opacity:.3}50%{opacity:1}}
        /* раскрытие — пружинка (быстро, мультяшно) */
        .me-grow{animation:meGrow .26s cubic-bezier(.34,1.7,.5,1);transform-origin:bottom center;}
        @keyframes meGrow{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
        /* веер иконок процессов из плавающей «+» */
        .me-fan-item{animation:meFan .28s cubic-bezier(.34,1.6,.64,1) backwards;transition:transform .12s ease, border-color .12s ease;}
        @keyframes meFan{from{opacity:0;transform:translate(-16px,-16px) scale(.4)}to{opacity:1;transform:translate(0,0) scale(1)}}
        .me-fan-item:hover{border-color:#ff7300!important;transform:scale(1.1);}
      `}</style>

      {/* Верхняя панель */}
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-medium)' }}>
        <button onClick={onBack} title="Назад" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><ArrowLeft size={16} /></button>
        <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>{name}</span>
        <div className="flex-1" />
        <button onClick={() => setShowBrief(true)} title="Общий сценарий ролика — главный промт для ИИ-режиссёра"
          className="inline-flex items-center gap-1.5 text-sm font-600 px-3 py-1.5 rounded-lg"
          style={{ background: brief.trim() ? 'rgba(124,92,255,0.14)' : 'var(--bg-tertiary)', color: brief.trim() ? '#7c5cff' : 'var(--text-secondary)', border: `1px solid ${brief.trim() ? 'rgba(124,92,255,0.4)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
          <Sparkles size={15} /> Сценарий{brief.trim() ? ' ✓' : ''}
        </button>
        <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 text-sm font-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Сохранить
        </button>
      </div>

      {/* Холст-паутина (верхние чипы убраны — добавление через плавающую «+» слева сверху) */}
      <div ref={canvasRef} className="flex-1" style={{ position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 42%, rgba(255,115,0,0.05), transparent 60%), var(--bg-primary)',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>

        {/* Плавающая «+» (левый верхний угол): клик → веером выезжают иконки процессов (без подписей) */}
        <div style={{ position: 'absolute', left: 14, top: 14, zIndex: 40 }}>
          <button onClick={() => setAddOpen((o) => !o)} title={addOpen ? 'Закрыть' : 'Добавить процесс'}
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', border: '1px solid #ff7300', boxShadow: '0 6px 20px rgba(255,115,0,.3)', cursor: 'pointer', transition: 'transform .25s cubic-bezier(.34,1.6,.64,1)', transform: addOpen ? 'rotate(135deg)' : 'none' }}>
            <Plus size={22} />
          </button>
          {addOpen && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, maxWidth: 176 }}>
              {KIND_ORDER.map((k, i) => (
                <button key={k} onClick={() => { addNode(k); setAddOpen(false); }} title={META[k].label}
                  className="me-fan-item w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: '#ff7300', cursor: 'pointer', animationDelay: `${i * 0.03}s` }}>
                  {React.cloneElement(META[k].icon as any, { size: 17 })}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Плавающая кнопка «Собрать видео» — всегда под рукой (правый нижний угол холста) */}
        <button onClick={build} disabled={building || nodes.length === 0}
          title={nodes.length === 0 ? 'Добавьте процессы в сценарий' : 'Собрать ролик из сценария'}
          className="me-fab"
          style={{ position: 'absolute', right: 18, bottom: 18, zIndex: 45, display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 20px', borderRadius: 999, border: 'none', fontSize: 15, fontWeight: 800,
            background: 'linear-gradient(135deg, #ff8a2b, #ff5e00)', color: '#fff',
            boxShadow: '0 8px 26px rgba(255,94,0,0.5)', cursor: building ? 'wait' : nodes.length === 0 ? 'not-allowed' : 'pointer',
            opacity: nodes.length === 0 ? 0.5 : 1 }}>
          {building ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
          {building ? `Собираю… ${buildJob?.progress || 0}%` : 'Собрать видео'}
        </button>

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
          {positions.map((p, i) => (<line key={i} x1="50" y1="50" x2={p.left} y2={p.top} stroke="var(--border-strong)" strokeWidth="0.18" />))}
        </svg>

        <button data-node-id="center" onClick={() => openSourcePicker()} title={building ? 'Идёт сборка…' : 'Выбрать исходное видео'}
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', background: 'transparent', border: 'none', cursor: building ? 'default' : 'pointer' }}>
          <div style={{ position: 'relative', width: 76, height: 76, margin: '0 auto' }}>
            {building && <span className="me-ring" />}
            <div className={building ? 'me-build' : undefined} style={{ width: 76, height: 76, borderRadius: '50%', overflow: 'hidden',
              background: sourceUrl ? '#000' : 'radial-gradient(circle at 36% 34%, #fff, #ffb066 50%, #ff7300 100%)',
              boxShadow: '0 0 36px rgba(255,115,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a1500',
              border: sourceUrl ? '2px solid #ff7300' : 'none' }}>
              <Video size={28} color={sourceUrl ? '#ff7300' : undefined} className={building ? 'animate-pulse' : undefined} />
            </div>
          </div>
          <div className="text-[11px] mt-2" style={{ color: building ? '#ff7300' : sourceUrl ? '#ff7300' : 'var(--text-secondary)', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--bg-primary)', padding: '1px 7px', borderRadius: 6, display: 'inline-block' }}>
            {building ? `Собираю… ${buildJob?.progress || 0}%` : sourceUrl ? (sourceName || 'видео выбрано') : 'Видео из галереи'}
          </div>
        </button>
        {/* 🔗 связать стрелкой ОТ «Видео из галереи» */}
        <button onPointerDown={(e) => startConnect('center', e)}
          title="Потяните, чтобы провести стрелку"
          style={{ position: 'absolute', left: 'calc(50% + 32px)', top: 'calc(50% - 32px)', transform: 'translate(-50%,-50%)', zIndex: 9, width: 24, height: 24, borderRadius: '50%', background: pending?.from === 'center' ? '#ff7300' : 'var(--bg-secondary)', border: '2px solid #ff7300', color: pending?.from === 'center' ? '#fff' : '#ff7300', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair', padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', touchAction: 'none' }}>
          <Link2 size={13} />
        </button>

        {nodes.map((n, i) => (
          <button key={n.id} onClick={() => setSelectedId(n.id)} className="me-node me-node-in"
            style={{ position: 'absolute', left: `${positions[i].left}%`, top: `${positions[i].top}%`, transform: 'translate(-50%,-50%)', animationDelay: `${i * 0.05}s`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <span style={{ width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-secondary)', border: `${selectedId === n.id ? 2 : 1}px solid ${selectedId === n.id ? '#ff7300' : 'var(--border-strong)'}`,
              color: selectedId === n.id ? '#ff7300' : 'var(--text-secondary)' }}>{META[n.kind].icon}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', background: 'var(--bg-primary)', padding: '0 5px', borderRadius: 5 }}>{META[n.kind].label}</span>
            {nodeSummary(n) && (
              <span style={{ fontSize: 9, lineHeight: 1.15, color: '#ff7300', maxWidth: 96, textAlign: 'center', whiteSpace: 'normal', fontWeight: 600, background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: 5 }}>{nodeSummary(n)}</span>
            )}
            {(n.mediaUrl || n.useLlm) && (
              <span style={{ position: 'absolute', top: -2, right: 4, display: 'inline-flex', gap: 2 }}>
                {n.mediaUrl && <Paperclip size={11} style={{ color: '#10b981' }} />}
                {n.useLlm && <Sparkles size={11} style={{ color: '#7c5cff' }} />}
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
            return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#ff7300" strokeWidth="0.35" strokeDasharray="1.4 0.9" />;
          })}
          {pending && (() => { const p = cloudPoint(pending.from); return p ? <line x1={p.x} y1={p.y} x2={pending.x} y2={pending.y} stroke="#ff7300" strokeWidth="0.4" strokeDasharray="1.4 0.9" /> : null; })()}
        </svg>
        {cloudEdges.map((e, i) => {
          const p = cloudPoint(e.from), q = cloudPoint(e.to);
          if (!p || !q) return null;
          const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          return (
            <button key={'ce' + i} onClick={() => { setCloudEdges((es) => es.filter((_, j) => j !== i)); setDirty(true); }} title="Удалить связь"
              style={{ position: 'absolute', left: `${mx}%`, top: `${my}%`, transform: 'translate(-50%,-50%)', zIndex: 6, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid #ff7300', color: '#ff7300', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <X size={11} />
            </button>
          );
        })}
        {(['omni', 'plan'] as CloudId[]).map((id) => {
          const pos = cloud[id]; const cfg = CLOUD[id];
          return (
            <div key={id} data-node-id={id} onPointerDown={() => { dragRef.current = id; movedRef.current = false; }}
              style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', zIndex: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'grab', touchAction: 'none', userSelect: 'none' }}>
              <button onClick={() => onCloudClick(id)} title={cfg.label}
                style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: pending?.from === id ? 'var(--btn-primary-bg)' : 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))',
                  border: `2px solid ${pending?.from === id ? '#ff7300' : cfg.color}`, color: cfg.color, boxShadow: `0 6px 22px ${cfg.glow}`, cursor: 'pointer' }}>
                {cfg.icon}
              </button>
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', background: 'var(--bg-primary)', padding: '0 5px', borderRadius: 5 }}>{cfg.label}</span>
              <button onPointerDown={(e) => startConnect(id, e)} title="Потяните, чтобы провести стрелку"
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: pending?.from === id ? '#ff7300' : 'var(--bg-secondary)', border: '1px solid #ff7300', color: pending?.from === id ? '#fff' : '#ff7300', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair', padding: 0, touchAction: 'none' }}>
                <Link2 size={11} />
              </button>
            </div>
          );
        })}
        {pending && (
          <div style={{ position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)', zIndex: 12, background: 'var(--bg-secondary)', border: '1px solid #ff7300', borderRadius: 999, padding: '4px 12px', fontSize: 12, color: '#ff7300', fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Тяните к узлу и отпустите, чтобы связать
          </div>
        )}
      </div>

      {/* Панель раскрытого узла */}
      {selected && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, margin: '0 12px 84px', maxHeight: '72vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}><span style={{ color: '#ff7300' }}>{META[selected.kind].icon}</span> {META[selected.kind].label}</span>
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
                        style={{ background: sel ? 'var(--btn-primary-bg)' : 'var(--bg-tertiary)', color: sel ? '#ff7300' : 'var(--text-secondary)', border: `1px solid ${sel ? '#ff7300' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
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
                    style={{ background: 'var(--bg-tertiary)', color: '#ff7300', border: '1px dashed #ff7300', cursor: 'pointer' }}>
                    <Video size={14} /> Выберите исходное видео, чтобы резать по ленте →
                  </button>
                ) : (
                  <>
                    <video src={sourceUrl} controls preload="metadata"
                      onLoadedMetadata={(e) => setSrcDuration(e.currentTarget.duration || 0)}
                      style={{ width: '100%', maxHeight: 170, borderRadius: 10, background: '#000', marginBottom: 8 }} />
                    <div className="relative w-full mb-1.5" style={{ height: 30, borderRadius: 7, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 2, bottom: 2, left: `${lenSel.start * 100}%`, width: `${Math.max(0.02, lenSel.end - lenSel.start) * 100}%`, background: 'rgba(255,115,0,0.85)', borderRadius: 5 }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      <span>С: <b style={{ color: '#ff7300' }}>{fmtT(lenSel.start)}</b></span>
                      <span>По: <b style={{ color: '#ff7300' }}>{fmtT(lenSel.end)}</b></span>
                    </div>
                    <input type="range" min={0} max={1} step={0.005} value={lenSel.start}
                      onChange={(e) => { const v = Math.min(parseFloat(e.target.value), lenSel.end - 0.02); writeLenRange(selected.id, { start: Math.max(0, v), end: lenSel.end }); }}
                      className="w-full" style={{ accentColor: '#ff7300' }} />
                    <input type="range" min={0} max={1} step={0.005} value={lenSel.end}
                      onChange={(e) => { const v = Math.max(parseFloat(e.target.value), lenSel.start + 0.02); writeLenRange(selected.id, { start: lenSel.start, end: Math.min(1, v) }); }}
                      className="w-full" style={{ accentColor: '#ff7300' }} />
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
                  style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', border: '1px solid #ff7300', cursor: exporting ? 'wait' : 'pointer' }}>
                  {exporting && <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${exportPct}%`, background: 'rgba(255,115,0,0.18)', transition: 'width .2s' }} />}
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

            {/* Медиа + ЛЛМ */}
            {(META[selected.kind].media || META[selected.kind].llm) && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {META[selected.kind].media && (selected.mediaUrl ? (
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
                    style={{ background: selected.useLlm ? 'rgba(124,92,255,0.15)' : 'var(--bg-tertiary)', color: selected.useLlm ? '#7c5cff' : 'var(--text-secondary)', border: `1px solid ${selected.useLlm ? 'rgba(124,92,255,0.4)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                    <Sparkles size={13} /> ЛЛМ {selected.useLlm ? 'вкл' : 'выкл'}
                  </button>
                )}
              </div>
            )}

            {/* Что сделает ИИ-режиссёр при включённом ЛЛМ */}
            {META[selected.kind].llm && selected.useLlm && DIR_HINT[selected.kind] && (
              <p className="text-[11px] mb-4 flex items-start gap-1.5" style={{ color: '#7c5cff' }}>
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
                style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', border: 'none', cursor: 'pointer' }}><Check size={16} /> Готово</button>
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
                  <span style={{ color: '#ff7300' }}>{META[k].icon}</span>
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
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{p.kinds.map((k) => META[k].label).join(' · ')}</div>
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
            style={{ width: '100%', maxWidth: 560, maxHeight: '82vh', overflow: 'auto', background: 'var(--bg-secondary)', border: `1px solid ${dragOver ? '#ff7300' : 'var(--border-medium)'}`, borderRadius: 16, padding: 16, transform: 'none', outline: dragOver ? '2px dashed #ff7300' : 'none', outlineOffset: -6 }}>
            <input ref={attachInputRef} type="file" multiple accept="image/*,video/*,audio/*" style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.length) uploadMediaFiles(e.target.files); e.currentTarget.value = ''; }} />
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Медиа</span>
              <button onClick={() => setAttachFor(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            {/* Зона загрузки с устройства / drag-and-drop */}
            <button onClick={() => attachInputRef.current?.click()} disabled={uploading}
              className="w-full mb-3 rounded-xl flex flex-col items-center justify-center gap-1.5 py-5 transition-colors"
              style={{ background: dragOver ? 'rgba(255,115,0,0.08)' : 'var(--bg-tertiary)', border: `1.5px dashed ${dragOver ? '#ff7300' : 'var(--border-strong)'}`, color: dragOver ? '#ff7300' : 'var(--text-secondary)', cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? <Loader2 size={20} className="animate-spin" style={{ color: '#ff7300' }} /> : <Plus size={20} style={{ color: '#ff7300' }} />}
              <span className="text-[13px] font-600">{uploading ? 'Загружаю…' : 'Загрузить с устройства'}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>с компьютера/телефона или перетащите файлы сюда → попадут в Галерею</span>
            </button>

            <div className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>Из Галереи</div>
            {media.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Пока пусто. Загрузите файл выше или добавьте во вкладке «Галерея».</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m) => (
                  <button key={m.id} onClick={() => { patchNode(attachFor, { mediaUrl: m.fileUrl, mediaName: m.title }); setAttachFor(null); }} className="rounded-xl overflow-hidden text-left" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                    <div style={{ aspectRatio: '1 / 1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.kind === 'image' ? <img src={m.fileUrl} alt="" className="w-full h-full object-cover" />
                        : m.kind === 'audio' ? <Music size={22} style={{ color: '#7c5cff' }} />
                        : <Video size={22} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{m.title}</div>
                  </button>
                ))}
              </div>
            )}
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
              <button onClick={() => { setSourceUrl(null); setSourceName(null); setDirty(true); setShowSource(false); }} className="text-xs mb-3" style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕ Убрать источник</button>
            )}
            {sources.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Нет видео. Скачайте тренды (вкладка «Тренды») или загрузите видео в «Референс» Галереи.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {sources.map((s, i) => (
                  <button key={i} onClick={() => { setSourceUrl(s.url); setSourceName(s.name); setDirty(true); setShowSource(false); }} className="rounded-xl overflow-hidden text-left" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${sourceUrl === s.url ? '#ff7300' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                    <div style={{ aspectRatio: '1 / 1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s.thumb ? <img src={s.thumb} alt="" className="w-full h-full object-cover" /> : <Video size={22} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{s.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Главный промт — общий сценарий ролика (для ИИ-режиссёра) */}
      {showBrief && (
        <div onClick={() => setShowBrief(false)} style={{ position: 'absolute', inset: 0, zIndex: 92, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 520, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}><Sparkles size={18} style={{ color: '#7c5cff' }} /> Сценарий ролика</span>
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
                style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', border: 'none', cursor: 'pointer' }}><Check size={16} /> Сохранить сценарий</button>
            </div>
          </div>
        </div>
      )}

      {/* Панель облачного узла (Omni / Контент-план) — каркас */}
      {cloudPanel && (
        <div onClick={() => setCloudPanel(null)} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: cloudPanel === 'omni' ? 600 : 460, maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: CLOUD[cloudPanel].color }}>{CLOUD[cloudPanel].icon}</span> {CLOUD[cloudPanel].label}
              </span>
              <button onClick={() => setCloudPanel(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {cloudPanel === 'omni' ? (
              <div className="space-y-3.5">
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Преобразование видео по ленте. <b style={{ color: '#4285F4' }}>Omni</b> — генерирует новый клип
                  (Veo 3.1, 4/6/8с). <b style={{ color: '#a855f7' }}>V2V</b> — ре-стайл реального фрагмента (Runway/Kling).
                  Ключи — в <b style={{ color: 'var(--text-secondary)' }}>Enterprise → Генерация</b>.
                </p>

                {!sourceUrl ? (
                  <button onClick={() => { setCloudPanel(null); openSourcePicker(); }}
                    className="w-full py-3 rounded-xl text-sm font-600 inline-flex items-center justify-center gap-2"
                    style={{ background: 'var(--bg-tertiary)', color: '#ff7300', border: '1px dashed #ff7300', cursor: 'pointer' }}>
                    <Video size={16} /> Сначала выберите исходное видео →
                  </button>
                ) : (
                  <>
                    {/* Превью исходника */}
                    <video src={sourceUrl} controls preload="metadata"
                      onLoadedMetadata={(e) => setSrcDuration(e.currentTarget.duration || 0)}
                      style={{ width: '100%', maxHeight: 190, borderRadius: 10, background: '#000' }} />

                    {/* Режим выбора */}
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                      {([['whole', 'Всё видео'], ['part', 'Часть'], ['inserts', '2–3 вставки']] as [OmniMode, string][]).map(([m, lbl]) => (
                        <button key={m} onClick={() => setOmniMode(m)}
                          className="py-2 rounded-lg text-[12px] font-600 transition-all"
                          style={{ background: omniSpec.mode === m ? 'var(--bg-secondary)' : 'transparent', color: omniSpec.mode === m ? '#ff7300' : 'var(--text-muted)', boxShadow: omniSpec.mode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
                          {lbl}
                        </button>
                      ))}
                    </div>

                    {/* Лента-таймлайн: визуализация выбранных кусков */}
                    <div>
                      <div className="relative w-full" style={{ height: 38, borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', overflow: 'hidden' }}>
                        {/* засечки */}
                        {[0.25, 0.5, 0.75].map((t) => (
                          <div key={t} style={{ position: 'absolute', left: `${t * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--border-medium)' }} />
                        ))}
                        {omniSpec.segments.map((g, i) => (
                          <div key={g.id} title={g.engine === 'omni' ? 'Omni-генерация' : 'V2V ре-стайл'}
                            style={{ position: 'absolute', top: 3, bottom: 3, left: `${g.start * 100}%`, width: `${Math.max(0.02, g.end - g.start) * 100}%`,
                              background: g.engine === 'omni' ? 'rgba(66,133,244,0.85)' : 'rgba(168,85,247,0.85)', borderRadius: 5,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, overflow: 'hidden' }}>
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>0с</span><span>{srcDuration > 0 ? `${srcDuration.toFixed(0)}с` : 'длительность'}</span>
                      </div>
                    </div>

                    {/* Карточки кусков */}
                    <div className="space-y-2.5">
                      {omniSpec.segments.map((g, i) => (
                        <div key={g.id} className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-700 inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                              <span style={{ width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', background: g.engine === 'omni' ? '#4285F4' : '#a855f7' }}>{i + 1}</span>
                              {omniSpec.mode === 'inserts' ? `Вставка ${i + 1}` : omniSpec.mode === 'whole' ? 'Всё видео' : 'Фрагмент'}
                            </span>
                            {omniSpec.mode === 'inserts' && omniSpec.segments.length > 1 && (
                              <button onClick={() => removeSeg(g.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-secondary)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={13} /></button>
                            )}
                          </div>

                          {/* Движок: Omni / V2V */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {([['omni', 'Сгенерировать', '#4285F4', <Sparkles size={13} key="s" />], ['v2v', 'Ре-стайл (V2V)', '#a855f7', <Scissors size={13} key="c" />]] as [OmniEngine, string, string, React.ReactNode][]).map(([eng, lbl, col, ic]) => (
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
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Длина</span>
                              {([4, 6, 8] as const).map((sec) => (
                                <button key={sec} onClick={() => updateSeg(g.id, { lenSec: sec })}
                                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-700"
                                  style={{ background: g.lenSec === sec ? 'var(--btn-primary-bg)' : 'var(--bg-secondary)', color: g.lenSec === sec ? '#ff7300' : 'var(--text-muted)', border: `1px solid ${g.lenSec === sec ? '#ff7300' : 'var(--border-medium)'}` }}>
                                  {sec}с
                                </button>
                              ))}
                              <button onClick={() => updateSeg(g.id, { seedFrame: !g.seedFrame })}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center gap-1.5"
                                style={{ background: g.seedFrame ? 'rgba(66,133,244,0.14)' : 'var(--bg-secondary)', color: g.seedFrame ? '#4285F4' : 'var(--text-muted)', border: `1px solid ${g.seedFrame ? '#4285F4' : 'var(--border-medium)'}` }}>
                                {g.seedFrame ? <Check size={12} /> : <Plus size={12} />} кадр отсюда как старт
                              </button>
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

                          {/* Диапазон по ленте (для part/inserts) */}
                          {omniSpec.mode !== 'whole' && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                <span>Начало: <b style={{ color: 'var(--text-secondary)' }}>{fmtT(g.start)}</b></span>
                                <span>Конец: <b style={{ color: 'var(--text-secondary)' }}>{fmtT(g.end)}</b></span>
                              </div>
                              <input type="range" min={0} max={1} step={0.01} value={g.start}
                                onChange={(e) => { const v = Math.min(parseFloat(e.target.value), g.end - 0.02); updateSeg(g.id, { start: Math.max(0, v) }); }}
                                className="w-full" style={{ accentColor: g.engine === 'omni' ? '#4285F4' : '#a855f7' }} />
                              <input type="range" min={0} max={1} step={0.01} value={g.end}
                                onChange={(e) => { const v = Math.max(parseFloat(e.target.value), g.start + 0.02); updateSeg(g.id, { end: Math.min(1, v) }); }}
                                className="w-full" style={{ accentColor: g.engine === 'omni' ? '#4285F4' : '#a855f7' }} />
                            </div>
                          )}
                        </div>
                      ))}

                      {omniSpec.mode === 'inserts' && omniSpec.segments.length < 3 && (
                        <button onClick={addInsert}
                          className="w-full py-2.5 rounded-xl text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                          <Plus size={14} /> Добавить вставку ({omniSpec.segments.length}/3)
                        </button>
                      )}
                    </div>

                    {/* Сводка + стоимость */}
                    <div className="rounded-xl p-3 text-[11px] space-y-1" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {omniGenSeconds > 0 && (
                        <div>Omni-генерация: <b style={{ color: 'var(--text-secondary)' }}>{omniGenSeconds}с</b> ≈ ${(omniGenSeconds * 0.10).toFixed(2)}–${(omniGenSeconds * 0.40).toFixed(2)} <span style={{ opacity: 0.7 }}>(Veo Fast…Standard, 720p/1080p)</span></div>
                      )}
                      {omniSpec.segments.some((g) => g.engine === 'v2v') && (
                        <div>V2V ре-стайл: по тарифу провайдера (Runway/Kling).</div>
                      )}
                      <div style={{ opacity: 0.8 }}>Спецификация сохраняется в сценарий. Реальная генерация (вызов Veo/Runway и склейка в монтаж) — следующий деплой; нужны ключи в Enterprise → Генерация.</div>
                    </div>

                    <button onClick={() => { save(); setCloudPanel(null); }}
                      className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2"
                      style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', border: '1px solid #ff7300', cursor: 'pointer' }}>
                      <Save size={15} /> Сохранить преобразование
                    </button>
                  </>
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

      {/* Прогресс сборки «Собрать» */}
      {buildJob && !buildMinimized && (
        <div onClick={() => (building ? setBuildMinimized(true) : setBuildJob(null))} style={{ position: 'absolute', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 460, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                {building && <Loader2 size={16} className="animate-spin" style={{ color: '#ff7300' }} />}
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
                    <span style={{ color: s.status === 'done' ? '#10b981' : s.status === 'skipped' ? '#f59e0b' : s.status === 'running' ? '#ff7300' : 'var(--text-muted)' }}>●</span>
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
                style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', textDecoration: 'none' }}>
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
        <button onClick={() => setBuildMinimized(false)} className="me-float-in"
          style={{ position: 'absolute', right: 16, bottom: 84, zIndex: 96, display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-secondary)', border: `1px solid ${buildJob.status === 'failed' ? '#ef4444' : buildJob.status === 'done' ? '#10b981' : '#ff7300'}`,
            borderRadius: 999, padding: '8px 14px 8px 10px', cursor: 'pointer', boxShadow: '0 8px 28px rgba(0,0,0,0.4)' }}>
          {buildJob.status === 'done'
            ? <Check size={16} style={{ color: '#10b981' }} />
            : buildJob.status === 'failed'
            ? <X size={16} style={{ color: '#ef4444' }} />
            : <Loader2 size={16} className="animate-spin" style={{ color: '#ff7300' }} />}
          <span className="text-xs font-700" style={{ color: 'var(--text-primary)' }}>
            {buildJob.status === 'done' ? 'Ролик готов' : buildJob.status === 'failed' ? 'Ошибка сборки' : `Собираю… ${buildJob.progress || 0}%`}
          </span>
        </button>
      )}
    </div>
  );
}
