/**
 * MontageEditor — радиальный («паутина») редактор монтажного сценария TrendFlow.
 *
 * В центре — исходное видео; вокруг по лучам — узлы-процессы (на базе инструментов
 * OpenMontage). Цепочка вокруг центра: порядок узлов = порядок применения.
 *  • hover-анимация на узлах;
 *  • нижняя строка «Добавить параметр» + «+» → выбор процесса (диалоговый режим);
 *  • применённые процессы — чипами сверху, у каждого «редактировать»;
 *  • узел раскрывается в панель: текст + 📎 медиа из Галереи + ✨ЛЛМ + ✎/🗑;
 *  • пустой сценарий → витрина 12 пресетов (4 группы × 3).
 *
 * Хранение — в flows.graph.nodes (JSONB), переиспользуем существующий движок флоу.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Video, Scissors, Crop, VolumeX, Type, Music, Mic, Palette, Image,
  UserRound, Search, Maximize2, Share2, Newspaper,
  Plus, Pencil, Trash2, X, Loader2, ArrowLeft, Sparkles, Paperclip, Save, Wand2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

type MKind =
  | 'news' | 'research' | 'length' | 'format' | 'silence' | 'subtitles' | 'audio'
  | 'voiceover' | 'color' | 'broll' | 'avatar' | 'upscale' | 'export';

interface MNode {
  id: string;
  kind: MKind;
  text: string;
  mediaUrl: string | null;
  mediaName: string | null;
  useLlm: boolean;
}

interface Meta { label: string; icon: React.ReactNode; hint: string; media: boolean; llm: boolean; ph: string; }

const META: Record<MKind, Meta> = {
  news:      { label: 'Новости',      icon: <Newspaper size={18} />,   hint: 'Источник: RSS / Telegram / сайт / рубрика → текст + фото',  media: false, llm: true,  ph: 'RSS-URL, @telegram-канал, ссылка на сайт или рубрику' },
  research:  { label: 'Исследование', icon: <Search size={18} />,     hint: 'Веб-поиск темы + источники (ЛЛМ)', media: false, llm: true,  ph: 'Тема для ресёрча…' },
  length:    { label: 'Длина',        icon: <Scissors size={18} />,    hint: 'Обрезка / лучший момент',         media: false, llm: true,  ph: 'напр. 0:10–0:40 или «лучший момент 30 сек»' },
  format:    { label: 'Формат',       icon: <Crop size={18} />,        hint: 'Вертикаль / гориз / квадрат',     media: false, llm: false, ph: 'вертикаль 9:16 / гориз 16:9 / 1:1 / 4:5' },
  silence:   { label: 'Паузы',        icon: <VolumeX size={18} />,     hint: 'Вырезать тишину',                 media: false, llm: false, ph: 'вырезать паузы (порог −35 дБ)' },
  subtitles: { label: 'Субтитры',     icon: <Type size={18} />,    hint: 'Караоке / по словам',             media: true,  llm: true,  ph: 'караоке по словам, белый + жёлтый акцент' },
  audio:     { label: 'Аудио',        icon: <Music size={18} />,       hint: 'Музыка + дакинг',                 media: true,  llm: false, ph: 'фоновая музыка, тише под голос' },
  voiceover: { label: 'Озвучка',      icon: <Mic size={18} />,         hint: 'Текст → голос (TTS)',             media: true,  llm: true,  ph: 'текст для озвучки…' },
  color:     { label: 'Цветокор',     icon: <Palette size={18} />,     hint: 'Пресет / LUT',                    media: true,  llm: false, ph: 'тёплый кинематографичный' },
  broll:     { label: 'B-roll',       icon: <Image size={18} />,      hint: 'Вставки / оверлей',               media: true,  llm: true,  ph: 'что вставить и когда…' },
  avatar:    { label: 'Аватар',       icon: <UserRound size={18} />,   hint: 'Говорящая голова / UGC',          media: true,  llm: true,  ph: 'сценарий для аватара…' },
  upscale:   { label: 'Апскейл',      icon: <Maximize2 size={18} />,   hint: 'Повысить чёткость 2×/4×',         media: false, llm: false, ph: 'апскейл 2×' },
  export:    { label: 'Экспорт',      icon: <Share2 size={18} />,      hint: 'Площадки вывода',                 media: false, llm: false, ph: 'TikTok, Reels, Shorts, YouTube' },
};

const KIND_ORDER: MKind[] = ['news', 'research', 'length', 'format', 'silence', 'subtitles', 'audio', 'voiceover', 'color', 'broll', 'avatar', 'upscale', 'export'];

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
          const mapped: MNode[] = g.filter((x: any) => x?.type === 'montage' && x?.data?.kind)
            .map((x: any) => ({ id: x.id, kind: x.data.kind, text: x.data.text || '', mediaUrl: x.data.mediaUrl || null, mediaName: x.data.mediaName || null, useLlm: !!x.data.useLlm }));
          setNodes(mapped);
          if (mapped.length === 0) setShowPresets(true);
        }
      } catch { /* пусто */ }
      finally { setLoading(false); }
    })();
  }, [flowId, headers]);

  const save = async () => {
    setSaving(true);
    try {
      const graphNodes = nodes.map((n, i) => ({ id: n.id, type: 'montage', position: { x: i, y: 0 }, data: { kind: n.kind, text: n.text, mediaUrl: n.mediaUrl, mediaName: n.mediaName, useLlm: n.useLlm } }));
      await fetch(`/api/flows/${flowId}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ graph: { nodes: graphNodes, edges: [] } }) });
      setDirty(false);
    } catch { /* */ }
    finally { setSaving(false); }
  };

  const addNode = (kind: MKind) => {
    const n: MNode = { id: newId(), kind, text: '', mediaUrl: null, mediaName: null, useLlm: false };
    update((p) => [...p, n]);
    setShowPicker(false);
    setSelectedId(n.id);
  };
  const removeNode = (id: string) => { update((p) => p.filter((n) => n.id !== id)); if (selectedId === id) setSelectedId(null); };
  const patchNode = (id: string, patch: Partial<MNode>) => update((p) => p.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const applyPreset = (preset: Preset) => {
    setName(preset.name);
    setNodes(preset.kinds.map((k) => ({ id: newId(), kind: k, text: '', mediaUrl: null, mediaName: null, useLlm: false })));
    setDirty(true);
    setShowPresets(false);
  };

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

  const selected = nodes.find((n) => n.id === selectedId) || null;

  // Радиальные позиции (в % холста), порядок = цепочка по часовой от верха.
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
        .me-chip{transition:border-color .12s, background .12s;}
        .me-chip:hover{border-color:var(--text-accent)!important;}
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
        <button className="inline-flex items-center gap-1.5 text-sm font-700 px-3 py-1.5 rounded-lg" title="Скоро"
          style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', cursor: 'pointer' }} onClick={() => alert('Сборка ролика — следующий этап (рендер-воркер).')}>
          <Wand2 size={15} /> Собрать
        </button>
      </div>

      {/* Применённые процессы — чипами */}
      {nodes.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap" style={{ borderBottom: '1px solid var(--border-medium)' }}>
          {nodes.map((n) => (
            <button key={n.id} onClick={() => setSelectedId(n.id)}
              className="me-chip inline-flex items-center gap-1.5 text-xs font-600 px-2.5 py-1.5 rounded-full"
              style={{ background: selectedId === n.id ? 'var(--btn-primary-bg)' : 'var(--bg-tertiary)', color: selectedId === n.id ? '#ff7300' : 'var(--text-secondary)', border: `1px solid ${selectedId === n.id ? '#ff7300' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
              <span style={{ display: 'inline-flex' }}>{React.cloneElement(META[n.kind].icon as any, { size: 13 })}</span>
              {META[n.kind].label}
              <Pencil size={11} style={{ opacity: 0.7 }} />
            </button>
          ))}
        </div>
      )}

      {/* Холст-паутина */}
      <div className="flex-1" style={{ position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 42%, rgba(255,115,0,0.05), transparent 60%), var(--bg-primary)',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
        {/* линии */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden="true">
          {positions.map((p, i) => (
            <line key={i} x1="50" y1="50" x2={p.left} y2={p.top} stroke="var(--border-strong)" strokeWidth="0.18" />
          ))}
        </svg>

        {/* центр — видео */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
          <div style={{ width: 76, height: 76, borderRadius: '50%', margin: '0 auto',
            background: 'radial-gradient(circle at 36% 34%, #fff, #ffb066 50%, #ff7300 100%)',
            boxShadow: '0 0 36px rgba(255,115,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a1500' }}>
            <Video size={28} />
          </div>
          <div className="text-[11px] mt-2" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Видео из галереи</div>
        </div>

        {/* узлы-процессы */}
        {nodes.map((n, i) => (
          <button key={n.id} onClick={() => setSelectedId(n.id)}
            className="me-node me-pop-in"
            style={{ position: 'absolute', left: `${positions[i].left}%`, top: `${positions[i].top}%`, transform: 'translate(-50%,-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <span style={{ width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-secondary)', border: `${selectedId === n.id ? 2 : 1}px solid ${selectedId === n.id ? 'var(--text-accent, #ff7300)' : 'var(--border-strong)'}`,
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

        {/* пусто */}
        {nodes.length === 0 && (
          <div style={{ position: 'absolute', left: '50%', top: '64%', transform: 'translateX(-50%)', textAlign: 'center' }}>
            <button onClick={() => setShowPresets(true)} className="text-sm font-600 px-4 py-2 rounded-xl"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              Выбрать пресет сценария
            </button>
          </div>
        )}
      </div>

      {/* Нижняя строка «Добавить параметр» */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-medium)' }}>
        <div className="flex items-center gap-2 mx-auto" style={{ maxWidth: 560, background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '6px 6px 6px 8px' }}>
          <button onClick={() => setShowPicker(true)} title="Добавить параметр" className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Plus size={18} /></button>
          <input readOnly onClick={() => setShowPicker(true)} placeholder="Добавить параметр или процесс…"
            className="flex-1 text-sm outline-none" style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', cursor: 'pointer' }} />
          <button onClick={() => setShowPicker(true)} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--btn-primary-bg)', color: '#ff7300', border: 'none', cursor: 'pointer' }}><Plus size={18} /></button>
        </div>
      </div>

      {/* Панель раскрытого узла */}
      {selected && (
        <div onClick={() => setSelectedId(null)} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, margin: '0 12px 84px', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: '#ff7300' }}>{META[selected.kind].icon}</span> {META[selected.kind].label}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => removeNode(selected.id)} title="Удалить" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={15} /></button>
                <button onClick={() => setSelectedId(null)} title="Закрыть" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={15} /></button>
              </div>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{META[selected.kind].hint}</p>
            <textarea value={selected.text} onChange={(e) => patchNode(selected.id, { text: e.target.value })} rows={2} placeholder={META[selected.kind].ph}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', resize: 'vertical' }} />
            <div className="flex flex-wrap items-center gap-2">
              {META[selected.kind].media && (
                selected.mediaUrl ? (
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <Paperclip size={13} /> {selected.mediaName || 'файл'}
                    <button onClick={() => patchNode(selected.id, { mediaUrl: null, mediaName: null })} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={12} /></button>
                  </span>
                ) : (
                  <button onClick={() => openAttach(selected.id)} className="inline-flex items-center gap-1.5 text-xs font-600 px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Paperclip size={13} /> Прикрепить из Галереи</button>
                )
              )}
              {META[selected.kind].llm && (
                <button onClick={() => patchNode(selected.id, { useLlm: !selected.useLlm })} className="inline-flex items-center gap-1.5 text-xs font-600 px-2.5 py-1.5 rounded-lg"
                  style={{ background: selected.useLlm ? 'rgba(124,92,255,0.15)' : 'var(--bg-tertiary)', color: selected.useLlm ? '#7c5cff' : 'var(--text-secondary)', border: `1px solid ${selected.useLlm ? 'rgba(124,92,255,0.4)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                  <Sparkles size={13} /> ЛЛМ {selected.useLlm ? 'вкл' : 'выкл'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Выбор процесса (диалог «+») */}
      {showPicker && (
        <div onClick={() => setShowPicker(false)} style={{ position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, margin: '0 12px 96px', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <div className="text-sm font-700 mb-3" style={{ color: 'var(--text-primary)' }}>Добавить процесс</div>
            <div className="grid grid-cols-3 gap-2">
              {KIND_ORDER.map((k) => (
                <button key={k} onClick={() => addNode(k)} className="flex flex-col items-center gap-1.5 py-3 rounded-xl"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  title={META[k].hint}>
                  <span style={{ color: '#ff7300' }}>{META[k].icon}</span>
                  <span className="text-[11px]">{META[k].label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Витрина пресетов (4 группы × 3) */}
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
                      <button key={p.name} onClick={() => applyPreset(p)} className="text-left p-3 rounded-xl transition-colors hover:border-[var(--text-accent)]"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
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
                  <button key={m.id} onClick={() => { patchNode(attachFor, { mediaUrl: m.fileUrl, mediaName: m.title }); setAttachFor(null); }}
                    className="rounded-xl overflow-hidden text-left" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
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
    </div>
  );
}
