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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Video, Scissors, Crop, VolumeX, Type, Music, Mic, Palette, Image,
  UserRound, Search, Maximize2, Share2, Newspaper,
  Plus, Pencil, X, Loader2, ArrowLeft, Sparkles, Paperclip, Save, Wand2, Check,
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
    ], llm: true },
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
    media: 'LUT (.cube)' },
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

export default function MontageEditor({ flowId, onBack }: { flowId: string; onBack: () => void }) {
  const token = useAppStore((s) => s.token);
  const headers = useCallback((): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  const [name, setName] = useState('Сценарий');
  const [nodes, setNodes] = useState<MNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [attachFor, setAttachFor] = useState<string | null>(null);
  const [media, setMedia] = useState<{ id: string; fileUrl: string; title: string; kind: string }[]>([]);
  const [building, setBuilding] = useState(false);
  const [buildJob, setBuildJob] = useState<any | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [sources, setSources] = useState<{ url: string; name: string; thumb?: string; type: string }[]>([]);

  const update = (fn: (n: MNode[]) => MNode[]) => { setNodes((prev) => fn(prev)); setDirty(true); };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/flows/${flowId}`, { headers: headers() });
        const d = await res.json();
        if (res.ok && d.flow) {
          setName(d.flow.name || 'Сценарий');
          const g = d.flow.graph?.nodes || [];
          const mapped: MNode[] = g.filter((x: any) => x?.type === 'montage' && x?.data?.kind && META[x.data.kind as MKind])
            .map((x: any) => ({ id: x.id, kind: x.data.kind, text: x.data.text || '', mediaUrl: x.data.mediaUrl || null, mediaName: x.data.mediaName || null, useLlm: !!x.data.useLlm, choices: hydrate(x.data.kind, x.data.choices) }));
          setNodes(mapped);
          const src = d.flow.graph?.source;
          if (src && typeof src.url === 'string') { setSourceUrl(src.url); setSourceName(src.name || 'видео'); }
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
      await fetch(`/api/flows/${flowId}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ graph: { nodes: graphNodes, edges: [], source } }) });
      setDirty(false);
    } catch { /* */ }
    finally { setSaving(false); }
  };

  // «Собрать» — сохранить сценарий, поставить задачу рендера, поллить прогресс.
  const build = async () => {
    if (building) return;
    setBuilding(true);
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

  const openAttach = async (id: string) => {
    setAttachFor(id);
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

  const positions = useMemo(() => {
    const n = nodes.length;
    return nodes.map((_, i) => {
      const ang = (-90 + (360 / Math.max(n, 1)) * i) * Math.PI / 180;
      return { left: 50 + 33 * Math.cos(ang), top: 50 + 36 * Math.sin(ang) };
    });
  }, [nodes]);

  if (loading) {
    return <div className="flex items-center justify-center" style={{ height: '70vh' }}><Loader2 size={26} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 8px)', position: 'relative' }}>
      <style>{`
        .me-node{transition:transform .15s ease, filter .15s ease;}
        .me-node:hover{transform:translate(-50%,-50%) scale(1.10);filter:brightness(1.25);}
        .me-pop-in{animation:mePop .18s ease;}
        @keyframes mePop{from{opacity:0;transform:translate(-50%,-50%) scale(.6)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      `}</style>

      {/* Верхняя панель */}
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-medium)' }}>
        <button onClick={onBack} title="Назад" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><ArrowLeft size={16} /></button>
        <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>{name}</span>
        <div className="flex-1" />
        <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 text-sm font-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Сохранить
        </button>
        <button disabled={building || nodes.length === 0} title="Собрать ролик из сценария"
          className="inline-flex items-center gap-1.5 text-sm font-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
          style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', cursor: building ? 'wait' : 'pointer' }} onClick={build}>
          {building ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Собрать
        </button>
      </div>

      {/* Палитра процессов: ВСЕ типы. Активные (в сценарии) — карандаш (редактировать)
          + ✕ (убрать); недостающие — «+» (добавить в воздействие на видео). */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap" style={{ borderBottom: '1px solid var(--border-medium)' }}>
        {KIND_ORDER.map((k) => {
          const node = nodes.find((n) => n.kind === k);
          const active = !!node;
          const sel = active && selectedId === node!.id;
          return (
            <span key={k} className="inline-flex items-center text-xs font-600 rounded-full overflow-hidden transition-colors"
              style={{
                background: sel ? 'var(--btn-primary-bg)' : active ? 'var(--bg-tertiary)' : 'transparent',
                color: sel ? '#ff7300' : active ? 'var(--text-secondary)' : 'var(--text-muted)',
                border: active ? `1px solid ${sel ? '#ff7300' : 'var(--border-medium)'}` : '1px dashed var(--border-strong)',
                opacity: active ? 1 : 0.85,
              }}>
              <button onClick={() => (active ? setSelectedId(node!.id) : addNode(k))}
                title={active ? 'Редактировать' : 'Добавить в сценарий'}
                className="inline-flex items-center gap-1.5 pl-2.5 py-1.5"
                style={{ paddingRight: active ? 5 : 10, background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                <span style={{ display: 'inline-flex' }}>{React.cloneElement(META[k].icon as any, { size: 13 })}</span>
                {META[k].label}
                {active ? <Pencil size={11} style={{ opacity: 0.7 }} /> : <Plus size={12} style={{ opacity: 0.85 }} />}
              </button>
              {active && (
                <button onClick={() => removeNode(node!.id)} title="Убрать из сценария"
                  className="inline-flex items-center justify-center pr-2 pl-1 py-1.5"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={12} />
                </button>
              )}
            </span>
          );
        })}
      </div>

      {/* Холст-паутина */}
      <div className="flex-1" style={{ position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 42%, rgba(255,115,0,0.05), transparent 60%), var(--bg-primary)',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
          {positions.map((p, i) => (<line key={i} x1="50" y1="50" x2={p.left} y2={p.top} stroke="var(--border-strong)" strokeWidth="0.18" />))}
        </svg>

        <button onClick={openSourcePicker} title="Выбрать исходное видео"
          style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: 76, height: 76, borderRadius: '50%', margin: '0 auto', overflow: 'hidden',
            background: sourceUrl ? '#000' : 'radial-gradient(circle at 36% 34%, #fff, #ffb066 50%, #ff7300 100%)',
            boxShadow: '0 0 36px rgba(255,115,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a1500',
            border: sourceUrl ? '2px solid #ff7300' : 'none' }}>
            <Video size={28} color={sourceUrl ? '#ff7300' : undefined} />
          </div>
          <div className="text-[11px] mt-2" style={{ color: sourceUrl ? '#ff7300' : 'var(--text-secondary)', fontWeight: 600, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sourceUrl ? (sourceName || 'видео выбрано') : 'Видео из галереи'}
          </div>
        </button>

        {nodes.map((n, i) => (
          <button key={n.id} onClick={() => setSelectedId(n.id)} className="me-node me-pop-in"
            style={{ position: 'absolute', left: `${positions[i].left}%`, top: `${positions[i].top}%`, transform: 'translate(-50%,-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <span style={{ width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-secondary)', border: `${selectedId === n.id ? 2 : 1}px solid ${selectedId === n.id ? '#ff7300' : 'var(--border-strong)'}`,
              color: selectedId === n.id ? '#ff7300' : 'var(--text-secondary)' }}>{META[n.kind].icon}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{META[n.kind].label}</span>
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
      </div>

      {/* Нижняя строка «Добавить параметр» */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-medium)' }}>
        <div className="flex items-center gap-2 mx-auto" style={{ maxWidth: 560, background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '6px 6px 6px 8px' }}>
          <button onClick={() => setShowPicker(true)} title="Добавить процесс" className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Plus size={18} /></button>
          <input readOnly onClick={() => setShowPicker(true)} placeholder="Добавить параметр или процесс…" className="flex-1 text-sm outline-none" style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', cursor: 'pointer' }} />
          <button onClick={() => setShowPicker(true)} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', border: 'none', cursor: 'pointer' }}><Plus size={18} /></button>
        </div>
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

            <button onClick={() => setSelectedId(null)} className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-700 py-2.5 rounded-xl"
              style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', border: 'none', cursor: 'pointer' }}><Check size={16} /> Готово</button>
          </div>
        </div>
      )}

      {/* Выбор процесса */}
      {showPicker && (
        <div onClick={() => setShowPicker(false)} style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, margin: '0 12px 96px', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
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

      {/* Выбор медиа из Галереи */}
      {attachFor && (
        <div onClick={() => setAttachFor(null)} style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Медиа из Галереи</span>
              <button onClick={() => setAttachFor(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {media.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Пусто. Загрузите файлы во вкладках «Референс» / «Аудио» Галереи.</p>
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

      {/* Прогресс сборки «Собрать» */}
      {buildJob && (
        <div onClick={() => { if (!building) setBuildJob(null); }} style={{ position: 'absolute', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 460, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>
                {buildJob.status === 'done' ? 'Готово ✓' : buildJob.status === 'failed' ? 'Ошибка' : 'Собираю ролик…'}
              </span>
              {!building && <button onClick={() => setBuildJob(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>}
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${buildJob.progress || 0}%`, background: '#ff7300', transition: 'width .3s' }} />
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
          </div>
        </div>
      )}
    </div>
  );
}
