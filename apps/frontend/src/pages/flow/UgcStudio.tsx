/**
 * UgcStudio — полноэкранная студия блока «UGC» (замена модалки 600px).
 *
 * Анатомия (как в утверждённом макете): топбар (выход · сохранение · смета · «Создать видео»)
 * / левая панель шагов 1–6 с чек-листом / интерактивное превью кадра по центру / док
 * таймлайна реплик снизу во всю ширину.
 *
 * Фаза 1: каркас + перегруппировка существующих контролов с новыми подписями.
 * Состояние и вся логика (спека UgcSpec, пикеры, сборка, поллинг) живут в MontageEditor
 * и приходят пропсами — graph старых сценариев читается без миграций.
 * «Режим ролика» — производный от спеки: dialogueEnabled → «Диалог двоих»,
 * retentionPreset≠off → «Динамичный монтаж», иначе «Один ведущий».
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Check, Loader2, Save, Wand2, Sparkles, Plus, RefreshCw, X,
  Mic, Paperclip, Scissors, Music, Video, Type, Layers,
} from 'lucide-react';
import DialogueTimeline from './DialogueTimeline';
import UgcPreview from './UgcPreview';
import UgcLinesPanel from './UgcLinesPanel';
import { GalleryPicker, type GalleryPickItem } from '../../components/GalleryPicker';
import { ConfirmModal } from '../../components/ConfirmModal';
import { type UgcSpec, type UgcPickTarget, type UgcMode, ugcModeOf } from './ugcTypes';

const ACC = '#a855f7';       // фирменный цвет блока UGC
const ACC2 = '#c084fc';

export interface UgcStudioProps {
  token: string | null;
  ugc: UgcSpec;
  ugcMutate: (fn: (u: UgcSpec) => UgcSpec) => void;
  saving: boolean;
  ugcSavedFlash: boolean;
  ugcSaveNow: () => Promise<void> | void;
  ugcBusy: null | 'dialogue' | 'diarize' | 'render' | 'compose' | 'avatars';
  ugcNote: string | null;
  ugcAvatars: { id: string; url: string; name: string }[] | null;
  ugcAvLoading: boolean;
  ugcAvBrief: string;
  setUgcAvBrief: (v: string) => void;
  ugcAvNote: string | null;
  loadUgcAvatars: (force?: boolean) => void;
  genUgcAvatars: () => void;
  pickUgcAvatar: (a: { id: string; url: string; name: string }) => void;
  askDelUgcAvatar: (a: { id: string; url: string; name: string }, e: React.MouseEvent) => void;
  ugcDelAvatar: { id: string; url: string; name: string } | null;
  setUgcDelAvatar: (a: { id: string; url: string; name: string } | null) => void;
  doDelUgcAvatar: (a: { id: string; url: string; name: string }) => void;
  hgExt: { present: boolean | null; connected: boolean };
  ugcGenScript: () => void;
  ugcRunDiarize: () => void;
  ugcBuildStart: () => Promise<void> | void;
  ugcScriptSec: () => number;
  ugcPick: UgcPickTarget | null;
  setUgcPick: (p: UgcPickTarget | null) => void;
  setUgcLineIdx: (i: number | null) => void;
  openUgcPick: (t: Exclude<UgcPickTarget, 'lineImage'>) => void;
  pickUgcItem: (g: { url: string; name: string; type: 'video' | 'audio' | 'image' }) => void;
  uploadToGallery: (files: FileList | File[], kind?: 'reference' | 'audio') => Promise<GalleryPickItem[]>;
  ugcResultAR: number;
  setUgcResultAR: (n: number) => void;
  onClose: () => void;
}

/* ── мелкие строительные блоки студии ── */

function Sec({ n, title, sub, done, children }: { n: number; title: string; sub?: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3 space-y-2.5" style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-primary)' }}>
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center flex-shrink-0 rounded-full text-[10px] font-700"
          style={{ width: 20, height: 20, background: done ? '#10b981' : 'var(--bg-tertiary)', border: `1px solid ${done ? '#10b981' : 'var(--border-strong)'}`, color: done ? '#fff' : 'var(--text-muted)' }}>
          {done ? <Check size={11} /> : n}
        </span>
        <b className="text-[12.5px]" style={{ color: 'var(--text-primary)' }}>{title}</b>
        {sub && <span className="text-[10.5px] ml-auto" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function Seg<T extends string>({ value, opts, onPick, cols }: { value: T; opts: [T, string][]; onPick: (v: T) => void; cols?: number }) {
  return (
    <div className="grid gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', gridTemplateColumns: `repeat(${cols || opts.length}, 1fr)` }}>
      {opts.map(([v, lbl]) => (
        <button key={v} onClick={() => onPick(v)} className="py-1.5 rounded-lg text-[11px] font-700"
          style={{ background: value === v ? ACC : 'transparent', color: value === v ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{lbl}</button>
      ))}
    </div>
  );
}

function Toggle({ on, title, sub, onClick }: { on: boolean; title: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-start justify-between gap-2 p-2 rounded-lg text-left"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
      <span className="text-[11px] font-600" style={{ color: 'var(--text-secondary)' }}>
        {title}{sub ? <><br /><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</span></> : null}
      </span>
      <span className="relative inline-flex flex-shrink-0 items-center" style={{ width: 34, height: 18, borderRadius: 9, background: on ? ACC : 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', marginTop: 2 }}>
        <span style={{ position: 'absolute', top: 1, left: on ? 17 : 1, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
    </button>
  );
}

/* мини-диаграмма режима: примитивные блоки кадра */
function ModeDia({ kind }: { kind: UgcMode }) {
  const box: React.CSSProperties = { width: 30, height: 48, borderRadius: 6, border: '1.5px solid var(--border-strong)', position: 'relative', overflow: 'hidden', background: 'var(--bg-secondary)' };
  const b = (s: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', borderRadius: 2.5, ...s });
  if (kind === 'retention') return (
    <span style={box}>
      <i style={b({ left: 3, top: 3, width: 10, height: 13, background: ACC2, opacity: .9 })} />
      <i style={b({ right: 3, top: 3, width: 9, height: 13, background: 'var(--text-disabled)', opacity: .6 })} />
      <i style={b({ left: 3, top: 19, width: 22, height: 10, background: 'var(--text-disabled)', opacity: .5 })} />
      <i style={b({ left: 3, bottom: 3, width: 22, height: 11, background: ACC2, opacity: .55 })} />
    </span>
  );
  if (kind === 'dialogue') return (
    <span style={box}>
      <i style={b({ left: 3, right: 3, top: 3, height: 19, background: ACC2, opacity: .9 })} />
      <i style={b({ left: 3, right: 3, bottom: 3, height: 17, background: '#f472b6', opacity: .9 })} />
    </span>
  );
  return (
    <span style={box}>
      <i style={b({ left: 3, right: 3, top: 3, height: 19, background: ACC2, opacity: .9 })} />
      <i style={b({ left: 3, right: 3, bottom: 3, height: 17, background: 'var(--text-disabled)', opacity: .5 })} />
    </span>
  );
}

/* мини-диаграмма раскладки кадра (для тулбара превью) */
function LayDia({ v }: { v: UgcSpec['placement'] }) {
  const b = (s: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', borderRadius: 2.5, ...s });
  return (
    <span style={{ width: 26, height: 42, borderRadius: 6, position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
      {v === 'top' && <><i style={b({ left: 2, right: 2, top: 2, height: 17, background: ACC2 })} /><i style={b({ left: 2, right: 2, bottom: 2, height: 16, background: 'var(--text-disabled)', opacity: .5 })} /></>}
      {v === 'bottom' && <><i style={b({ left: 2, right: 2, top: 2, height: 16, background: 'var(--text-disabled)', opacity: .5 })} /><i style={b({ left: 2, right: 2, bottom: 2, height: 17, background: ACC2 })} /></>}
      {v === 'overlay-left' && <><i style={b({ inset: 2, background: 'var(--text-disabled)', opacity: .4 })} /><i style={b({ left: 3, bottom: 3, width: 9, height: 14, background: ACC2, borderRadius: '4px 4px 0 0' })} /></>}
      {v === 'overlay-right' && <><i style={b({ inset: 2, background: 'var(--text-disabled)', opacity: .4 })} /><i style={b({ right: 3, bottom: 3, width: 9, height: 14, background: ACC2, borderRadius: '4px 4px 0 0' })} /></>}
    </span>
  );
}

export default function UgcStudio(p: UgcStudioProps) {
  const { ugc, ugcMutate } = p;
  const mode = ugcModeOf(ugc);
  const building = p.ugcBusy === 'render';

  /* панель «Реплики» над таймлайном; авто-открывается, когда реплики появились впервые */
  const [linesOpen, setLinesOpen] = useState(false);
  const prevLinesLen = useRef(ugc.script.length);
  useEffect(() => {
    if (prevLinesLen.current === 0 && ugc.script.length > 0) setLinesOpen(true);
    prevLinesLen.current = ugc.script.length;
  }, [ugc.script.length]);

  /* ── производный «Режим ролика» поверх существующих полей спеки ── */
  const setMode = (m: UgcMode) => ugcMutate((u) => {
    if (m === 'solo') {
      // Возврат в соло: если «Моё фото» пустое, а из коллекции аватар выбран — вернуть вкладку коллекции,
      // чтобы выбор не «терялся» визуально после захода в Диалог/Монтаж (они форсят photo).
      const back = !u.photoUrl && u.avatarUrl ? 'collection' as const : u.avatarSource;
      return { ...u, dialogueEnabled: false, retentionPreset: 'off', avatarSource: back };
    }
    if (m === 'retention') return { ...u, dialogueEnabled: false, retentionPreset: u.retentionPreset === 'off' ? 'bal' : u.retentionPreset, avatarSource: 'photo' };
    return { ...u, dialogueEnabled: true, retentionPreset: 'off', avatarSource: 'photo' };
  });

  /* ── готовность к сборке (чек-лист + причина недоступности CTA) ── */
  const avatarOk = ugc.avatarSource === 'collection' ? !!ugc.avatarUrl : !!ugc.photoUrl;
  const voiceOk = mode === 'dialogue'
    ? ugc.script.length > 0
    : (ugc.script.length > 0 || (ugc.source === 'diarize' && !!ugc.recordingUrl));
  const videoOk = mode === 'retention' ? (!!ugc.clip || ugc.retentionBrolls.length > 0) : true;
  const checks: { label: string; ok: boolean; hint: string; miss: string }[] = [
    { label: ugc.avatarSource === 'collection' ? 'Аватар выбран' : 'Фото выбрано', ok: avatarOk, hint: 'шаг 2', miss: ugc.avatarSource === 'collection' ? 'аватар' : 'фото' },
    ...(mode === 'dialogue' ? [{ label: 'Второй собеседник', ok: !!ugc.photoBUrl, hint: 'шаг 2', miss: 'фото второго собеседника' }] : []),
    { label: mode === 'dialogue' ? 'Запись разобрана (голоса A/B)' : 'Текст или запись готовы', ok: voiceOk, hint: 'шаг 3', miss: mode === 'dialogue' ? 'разбор записи двух голосов' : 'текст или запись' },
    ...(mode === 'retention' ? [{ label: 'Видеоряд выбран', ok: videoOk, hint: 'шаг 4', miss: 'видеоряд' }] : []),
  ];
  const allOk = checks.every((c) => c.ok) && (mode !== 'dialogue' || !!ugc.photoBUrl);
  const missing = checks.filter((c) => !c.ok).map((c) => c.miss).join(', ');

  /* ── смета (ориентиры из докки UGC_AVATARS.md) ── */
  const costBase = mode === 'retention'
    ? ({ off: '', eco: '≈ $1–2 за ролик', bal: '≈ $2–3 за ролик', prem: '≈ $3–5 за ролик' }[ugc.retentionPreset])
    : mode === 'dialogue'
      ? ({ eco: '≈ $2 за ролик', bal: '≈ $2–3 за ролик', dyn: '≈ $3–5 за ролик' }[ugc.dialogueEngagement])
      : (ugc.faceProvider === 'heygen_ext' ? '≈ $1 за минуту' : '≈ $3–4 за минуту');
  const costExtra = mode === 'retention' && ugc.retentionBrolls.length > 1
    ? ` · серия из ${ugc.retentionBrolls.length} — аватар 1 раз`
    : (ugc.formats.length > 1 ? ' · 2 файла — аватар 1 раз' : '');

  /* Esc закрывает студию (если не открыт пикер/подтверждение) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !p.ugcPick && !p.ugcDelAvatar) p.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const scrollToSec = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Топбар ── */}
      <div className="flex items-center gap-3 px-3.5 flex-shrink-0" style={{ height: 54, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-medium)' }}>
        <button onClick={p.onClose} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-600"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Сценарий
        </button>
        <div className="leading-tight">
          <div className="text-[13.5px] font-700" style={{ color: 'var(--text-primary)' }}>UGC-студия</div>
          <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>Ролик с говорящим аватаром</div>
        </div>
        <div className="flex-1" />
        <button onClick={() => void p.ugcSaveNow()} disabled={p.saving} className="inline-flex items-center gap-1.5 text-[11.5px] font-600 px-2.5 py-1.5 rounded-lg disabled:opacity-60"
          style={{ background: 'var(--bg-tertiary)', color: p.ugcSavedFlash ? '#22c55e' : 'var(--text-secondary)', border: `1px solid ${p.ugcSavedFlash ? 'rgba(34,197,94,.5)' : 'var(--border-medium)'}`, cursor: 'pointer' }}
          title="Автосохранение включено — кнопка лишь страховка">
          {p.saving ? <Loader2 size={13} className="animate-spin" /> : p.ugcSavedFlash ? <Check size={13} /> : <Save size={13} />}
          {p.saving ? 'Сохраняю…' : p.ugcSavedFlash ? 'Сохранено' : 'Сохранить'}
        </button>
        <span className="text-[11px] px-2.5 py-1.5 rounded-full" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {costBase}{costExtra}
        </span>
        <button onClick={() => void p.ugcBuildStart()} disabled={building || !allOk}
          title={allOk ? 'Аватар говорит скрипт (HeyGen) → склейка с видео → субтитры → Галерея' : `Осталось: ${missing}`}
          className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2 rounded-xl disabled:opacity-50"
          style={{ background: `linear-gradient(135deg,${ACC},${ACC2})`, color: '#fff', border: 'none', cursor: allOk && !building ? 'pointer' : 'not-allowed' }}>
          {building ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {building ? 'Создаём…' : 'Создать видео'}
        </button>
      </div>

      {/* ── Корпус: панель шагов + превью ── */}
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: '348px 1fr' }}>
        {/* Левая панель */}
        <div className="overflow-y-auto p-3 space-y-2.5" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-medium)' }}>

          {/* 1. Режим ролика */}
          <Sec n={1} title="Режим ролика" done>
            <div className="grid grid-cols-3 gap-1.5">
              {([['solo', 'Один ведущий'], ['retention', 'Динамичный монтаж'], ['dialogue', 'Диалог двоих']] as [UgcMode, string][]).map(([m, lbl]) => (
                <button key={m} onClick={() => setMode(m)} className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2"
                  style={{ background: mode === m ? 'rgba(168,85,247,.12)' : 'var(--bg-secondary)', border: `1px solid ${mode === m ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                  <ModeDia kind={m} />
                  <span className="text-[10.5px] font-650 text-center leading-tight" style={{ color: mode === m ? ACC : 'var(--text-secondary)' }}>{lbl}</span>
                </button>
              ))}
            </div>
            <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
              {mode === 'solo' && 'Аватар говорит весь текст, рядом — ваш видеоряд. Самый простой вариант.'}
              {mode === 'retention' && 'Кадр сменяет план каждые несколько секунд под одну дорожку голоса — зритель досматривает до конца. Только «Моё фото».'}
              {mode === 'dialogue' && 'Два человека говорят своими лицами. Нужны два фото и запись разговора двух голосов.'}
            </p>
            {mode === 'retention' && (
              <>
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>Насыщенность монтажа</div>
                <Seg value={ugc.retentionPreset} cols={3}
                  opts={[['eco', 'Эконом'], ['bal', 'Баланс'], ['prem', 'Премиум']] as [UgcSpec['retentionPreset'], string][]}
                  onPick={(v) => ugcMutate((u) => ({ ...u, retentionPreset: v }))} />
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {ugc.retentionPreset === 'eco' && 'Дорогой крупный план — только на крючок и призыв (~2 на ролик). Дешевле всего.'}
                  {ugc.retentionPreset === 'bal' && 'Крупные планы на крючок, действие и призыв (~3). Золотая середина.'}
                  {ugc.retentionPreset === 'prem' && 'Максимум лица (~4 крупных плана). Живее и дороже.'}
                  {' '}Где какой план — решает ИИ по тексту.
                </p>
              </>
            )}
            {mode === 'dialogue' && (
              <>
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>Динамика диалога</div>
                <Seg value={ugc.dialogueEngagement} cols={3}
                  opts={[['eco', 'Спокойно'], ['bal', 'Баланс'], ['dyn', 'Живо']] as [UgcSpec['dialogueEngagement'], string][]}
                  onPick={(v) => ugcMutate((u) => ({ ...u, dialogueEngagement: v }))} />
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {ugc.dialogueEngagement === 'eco' && 'Почти всегда один говорящий в кадре — самый дешёвый вариант.'}
                  {ugc.dialogueEngagement === 'bal' && 'Крупный план говорящего; оба в кадре — на реакциях и пиках.'}
                  {ugc.dialogueEngagement === 'dyn' && 'Больше сцен «оба в кадре» и врезок — динамичнее и дороже.'}
                  {' '}ИИ распределяет планы сам.
                </p>
                <Toggle on={ugc.dialogueCutout} title="Прозрачный фон аватара"
                  sub="в кадре останется только человек — для раскладки «фоном, аватар сбоку»"
                  onClick={() => ugcMutate((u) => ({ ...u, dialogueCutout: !u.dialogueCutout }))} />
              </>
            )}
          </Sec>

          {/* 2. Аватар */}
          <div id="ugc-sec-avatar">
          <Sec n={2} title="Аватар" sub="кто в кадре" done={avatarOk && (mode !== 'dialogue' || !!ugc.photoBUrl)}>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
              {([['collection', 'Готовые аватары'], ['photo', 'Моё фото']] as [UgcSpec['avatarSource'], string][]).map(([s, lbl]) => {
                const locked = s === 'collection' && mode !== 'solo';
                return (
                  <button key={s} disabled={locked} onClick={() => ugcMutate((u) => ({ ...u, avatarSource: s }))}
                    title={locked ? 'В этом режиме — только «Моё фото» (HeyGen)' : undefined}
                    className="py-2 rounded-lg text-[11.5px] font-600 disabled:opacity-40"
                    style={{ background: ugc.avatarSource === s ? 'var(--bg-tertiary)' : 'transparent', color: ugc.avatarSource === s ? ACC : 'var(--text-muted)', border: 'none', cursor: locked ? 'not-allowed' : 'pointer' }}>{lbl}</button>
                );
              })}
            </div>
            {ugc.avatarSource === 'collection' ? (
              <div className="space-y-2">
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>Моя коллекция</div>
                {p.ugcAvLoading ? (
                  <p className="text-[11px] py-3 text-center" style={{ color: 'var(--text-muted)' }}><Loader2 size={14} className="animate-spin inline" /> загружаю аватары…</p>
                ) : (p.ugcAvatars || []).length ? (
                  <div className="grid grid-cols-4 gap-1.5" style={{ maxHeight: 236, overflowY: 'auto' }}>
                    {(p.ugcAvatars || []).map((a) => {
                      const sel = ugc.avatarProvider === 'gallery' && ugc.avatarId === a.id;
                      return (
                        <div key={a.id} onClick={() => p.pickUgcAvatar(a)} title={a.name} className="relative rounded-lg overflow-hidden group"
                          style={{ aspectRatio: '3/4', background: '#000', cursor: 'pointer',
                            border: sel ? `2px solid ${ACC}` : '1px solid var(--border-medium)',
                            boxShadow: sel ? '0 0 0 2px rgba(168,85,247,.3)' : 'none' }}>
                          <img src={a.url} alt={a.name} loading="lazy" className="w-full h-full object-cover" />
                          {sel && (
                            <span className="absolute bottom-1 left-1 rounded-full flex items-center justify-center" style={{ width: 18, height: 18, background: ACC }}><Check size={12} color="#fff" /></span>
                          )}
                          <button onClick={(e) => p.askDelUgcAvatar(a, e)} title="Убрать из коллекции"
                            className="absolute top-1 right-1 rounded-full items-center justify-center hidden group-hover:flex"
                            style={{ width: 18, height: 18, background: 'rgba(0,0,0,.65)', border: 'none', color: '#f87171', cursor: 'pointer' }}><X size={11} /></button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg p-3 text-[11px] text-center" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
                    Коллекция пуста — сгенерируйте готовых аватаров или добавьте фото из Галереи.
                  </div>
                )}
                <div className="flex gap-1.5">
                  <button onClick={p.genUgcAvatars} disabled={p.ugcBusy === 'avatars'} className="flex-1 py-2 rounded-lg text-[11px] font-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ background: 'rgba(168,85,247,0.14)', color: ACC, border: '1px solid rgba(168,85,247,0.4)', cursor: 'pointer' }}>
                    {p.ugcBusy === 'avatars' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Сгенерировать 3 аватара
                  </button>
                  <button onClick={() => p.openUgcPick('avatarAdd')} className="flex-1 py-2 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    <Plus size={13} /> Выбрать из Галереи
                  </button>
                  <button onClick={() => p.loadUgcAvatars(true)} disabled={p.ugcAvLoading} title="Обновить список" className="px-2 py-2 rounded-lg"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><RefreshCw size={13} /></button>
                </div>
                <input value={p.ugcAvBrief} onChange={(e) => p.setUgcAvBrief(e.target.value)}
                  placeholder="Опишите аватара: «девушка 25 лет, casual, дружелюбная»…"
                  className="w-full px-2 py-1.5 rounded-lg text-[11px] outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                {p.ugcAvNote && <p className="text-[11px]" style={{ color: '#f59e0b' }}>{p.ugcAvNote}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{mode === 'dialogue' ? 'Первый собеседник (A)' : 'Ваше фото'}</div>
                {ugc.photoUrl ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <img src={ugc.photoUrl} alt="" className="rounded-md object-cover" style={{ width: 52, height: 68 }} />
                    <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.photoName || 'фото выбрано'}</span>
                    <button onClick={() => p.openUgcPick('photo')} className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Заменить</button>
                    <button onClick={() => ugcMutate((u) => ({ ...u, photoUrl: null, photoName: null }))} title="Убрать" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => p.openUgcPick('photo')} className="w-full py-2.5 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-secondary)', color: ACC, border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    Фото — пока не загружено · выбрать из Галереи
                  </button>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Портрет анфас. Фото оживит <b>HeyGen</b> — губы и мимика синхронизируются с голосом.</p>
                {mode === 'dialogue' && (
                  <>
                    <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>Второй собеседник (B)</div>
                    {ugc.photoBUrl ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                        <img src={ugc.photoBUrl} alt="" className="rounded-md object-cover" style={{ width: 44, height: 58 }} />
                        <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.photoBName || 'фото B'}</span>
                        <button onClick={() => p.openUgcPick('photoB')} className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Заменить</button>
                        <button onClick={() => ugcMutate((u) => ({ ...u, photoBUrl: null, photoBName: null }))} title="Убрать" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => p.openUgcPick('photoB')} className="w-full py-2 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--bg-secondary)', color: ACC, border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                        <Plus size={13} /> Фото — пока не загружено · выбрать
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>Оживление аватара</div>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                {([['heygen_api', 'По ключу API'], ['heygen_ext', 'По подписке HeyGen']] as [UgcSpec['faceProvider'], string][]).map(([pr, lbl]) => (
                  <button key={pr} onClick={() => ugcMutate((u) => ({ ...u, faceProvider: pr }))} className="py-1.5 rounded-lg text-[10.5px] font-700"
                    style={{ background: ugc.faceProvider === pr ? 'rgba(14,158,119,0.14)' : 'transparent', color: ugc.faceProvider === pr ? '#0E9E77' : 'var(--text-muted)', border: `1px solid ${ugc.faceProvider === pr ? '#0E9E77' : 'transparent'}`, cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
              {ugc.faceProvider === 'heygen_ext' ? (
                <div className="text-[10px] px-2 py-1.5 rounded-md leading-relaxed" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                  Головы рендерит расширение в вашей вкладке <b>app.heygen.com</b> по подписке (втрое дешевле API).{' '}
                  Расширение:{' '}
                  <b style={{ color: p.hgExt.present === false ? '#ef4444' : p.hgExt.connected ? '#0E9E77' : p.hgExt.present ? '#f59e0b' : 'var(--text-muted)' }}>
                    {p.hgExt.present === null ? 'проверяем…' : p.hgExt.present === false ? 'не установлено' : p.hgExt.connected ? 'подключено' : 'установлено — войдите в аккаунт HeyGen'}
                  </b>.
                  {p.hgExt.present === false ? <> <a href="/trendtraffic-extension.zip" download style={{ color: '#0E9E77', textDecoration: 'underline' }}>Скачать расширение</a> (единое — Flow · NotebookLM · HeyGen).</> : null}
                  {' '}Держите открытой вкладку студии HeyGen с активной подпиской.
                </div>
              ) : (
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Через HeyGen API — ключ в Настройки → Генерация, оплата pay-as-you-go (~$3/мин Avatar IV).</p>
              )}
            </div>
          </Sec>
          </div>

          {/* 3. Голос и текст */}
          <Sec n={3} title="Голос и текст" sub="что говорит" done={voiceOk}>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
              {([['gen', 'Написать с ИИ'], ['diarize', 'Моя запись']] as [UgcSpec['source'], string][]).map(([s, lbl]) => (
                <button key={s} onClick={() => ugcMutate((u) => ({ ...u, source: s }))} className="py-2 rounded-lg text-[11.5px] font-600"
                  style={{ background: ugc.source === s ? 'var(--bg-tertiary)' : 'transparent', color: ugc.source === s ? ACC : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{lbl}</button>
              ))}
            </div>
            {ugc.source === 'gen' ? (
              <div className="space-y-2">
                {mode === 'dialogue' && (
                  <p className="text-[10px]" style={{ color: '#f59e0b' }}>Для диалога нужна запись двух голосов — переключитесь на «Моя запись» и разберите речь.</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Голос озвучки:</span>
                  {([['female', 'Женский'], ['male', 'Мужской']] as [UgcSpec['voice'], string][]).map(([v, lbl]) => (
                    <button key={v} onClick={() => ugcMutate((u) => ({ ...u, voice: v }))} className="flex-1 py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1"
                      style={{ background: ugc.voice === v ? ACC : 'var(--bg-secondary)', color: ugc.voice === v ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.voice === v ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}><Mic size={11} /> {lbl}</button>
                  ))}
                </div>
                <textarea value={ugc.brief} onChange={(e) => ugcMutate((u) => ({ ...u, brief: e.target.value }))} rows={2}
                  placeholder="О чём ролик: «честный отзыв на приложение, крючок в первые 3 секунды»…"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', resize: 'vertical' }} />
                <button onClick={p.ugcGenScript} disabled={p.ugcBusy === 'dialogue'} className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: 'rgba(168,85,247,0.14)', color: ACC, border: '1px solid rgba(168,85,247,0.4)', cursor: 'pointer' }}>
                  {p.ugcBusy === 'dialogue' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Сгенерировать текст
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {ugc.recordingUrl ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <Music size={15} style={{ color: ACC }} />
                    <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.recordingName || 'запись'}</span>
                    <button onClick={() => ugcMutate((u) => ({ ...u, recordingUrl: null, recordingName: null, script: [], result: null }))} title="Убрать запись (сбросит и её разбор)" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => p.openUgcPick('recording')} className="w-full py-2.5 rounded-xl text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    <Paperclip size={14} /> Запись — пока не загружена · аудио или видео
                  </button>
                )}
                <button onClick={p.ugcRunDiarize} disabled={p.ugcBusy === 'diarize' || !ugc.recordingUrl} className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'rgba(168,85,247,0.14)', color: ACC, border: '1px solid rgba(168,85,247,0.4)', cursor: 'pointer' }}>
                  {p.ugcBusy === 'diarize' ? <Loader2 size={15} className="animate-spin" /> : <Scissors size={15} />} {p.ugcBusy === 'diarize' ? 'Разбираем запись…' : 'Разобрать речь'}
                </button>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {mode === 'dialogue' ? 'Разбор различит два голоса — реплики лягут на дорожки A и B.' : 'Голос из записи станет голосом ролика.'}
                </p>
              </div>
            )}
            {ugc.script.length > 0 && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text-secondary)' }}>{ugc.script.length} реплик · ~{Math.round(p.ugcScriptSec())} сек</b> — правка на таймлайне внизу экрана.
              </p>
            )}
          </Sec>

          {/* 4. Видеоряд */}
          <Sec n={4} title="Видеоряд" sub="что на экране" done={!!ugc.clip || (mode === 'retention' && ugc.retentionBrolls.length > 0)}>
            {ugc.clip ? (
              <div className="flex items-center gap-2">
                <video src={`${ugc.clip.url}#t=0.1`} muted className="rounded-lg" style={{ width: 44, height: 78, objectFit: 'cover', background: '#000' }} />
                <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.clip.name}</span>
                <button onClick={() => p.openUgcPick('clip')} className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Заменить</button>
                <button onClick={() => ugcMutate((u) => ({ ...u, clip: null }))} title="Убрать" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => p.openUgcPick('clip')} className="w-full py-2.5 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-secondary)', color: ACC, border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                <Video size={14} /> Видео — пока не загружено · выбрать из Галереи
              </button>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {([['cover', 'Заполнить кадр'], ['contain', 'Показать целиком']] as ['cover' | 'contain', string][]).map(([f, lbl]) => (
                  <button key={f} onClick={() => ugcMutate((u) => ({ ...u, clipFit: f }))} className="text-[10px] font-600 px-2 py-1 rounded-md"
                    style={{ background: ugc.clipFit === f ? ACC : 'var(--bg-secondary)', color: ugc.clipFit === f ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.clipFit === f ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
              <label className="text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!ugc.clipMuted} onChange={(e) => ugcMutate((u) => ({ ...u, clipMuted: !e.target.checked }))} /> звук из видео
              </label>
            </div>
            {mode === 'solo' && !ugc.clip && (
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Не обязательно: без видео аватар будет во весь кадр.</p>
            )}
            {mode === 'dialogue' && (
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>В диалоге медиа прикрепляются к репликам на таймлайне внизу — «Как показать» и «Показывать N сек» появятся у реплики с медиа.</p>
            )}
            {mode === 'retention' && (
              <div className="rounded-lg p-2 space-y-1.5" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-medium)' }}>
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>Серия роликов</div>
                {ugc.retentionBrolls.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Видео в серии: <b style={{ color: ACC }}>{ugc.retentionBrolls.length}</b> → столько же роликов на выходе</div>
                    <div className="flex gap-1.5">
                      <button onClick={() => p.openUgcPick('retBrolls')} className="flex-1 py-1.5 rounded-md text-[11px] font-600" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Изменить</button>
                      <button onClick={() => ugcMutate((u) => ({ ...u, retentionBrolls: [] }))} className="px-2 py-1.5 rounded-md text-[11px]" style={{ background: 'transparent', color: '#ef4444', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Очистить</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => p.openUgcPick('retBrolls')} className="w-full py-2 rounded-md text-[11px] font-600 inline-flex items-center justify-center gap-1.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    <Layers size={13} /> Добавить видео в серию — отдельный ролик на каждое
                  </button>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Аватар оплачивается один раз на всю серию.</p>
              </div>
            )}
          </Sec>

          {/* 5. Субтитры */}
          <Sec n={5} title="Субтитры" sub="живой пример — в превью" done>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Стиль:</span>
              {([['none', 'Выключены'], ['word', 'По словам'], ['karaoke', 'Караоке'], ['plain', 'Строкой']] as [UgcSpec['subtitles']['style'], string][]).map(([s, lbl]) => (
                <button key={s} onClick={() => ugcMutate((u) => ({ ...u, subtitles: { ...u.subtitles, style: s } }))} className="text-[10px] font-600 px-2 py-1 rounded-md"
                  style={{ background: ugc.subtitles.style === s ? ACC : 'var(--bg-secondary)', color: ugc.subtitles.style === s ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.subtitles.style === s ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Положение:</span>
              {([['bottom', 'Снизу'], ['center', 'По центру'], ['top', 'Сверху']] as [UgcSpec['subtitles']['pos'], string][]).map(([pos, lbl]) => (
                <button key={pos} onClick={() => ugcMutate((u) => ({ ...u, subtitles: { ...u.subtitles, pos } }))} className="text-[10px] font-600 px-2 py-1 rounded-md"
                  style={{ background: ugc.subtitles.pos === pos ? ACC : 'var(--bg-secondary)', color: ugc.subtitles.pos === pos ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.subtitles.pos === pos ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
              ))}
            </div>
            <input value={ugc.subtitles.wishes} onChange={(e) => ugcMutate((u) => ({ ...u, subtitles: { ...u.subtitles, wishes: e.target.value } }))}
              placeholder="Пожелания к стилю: цвет, шрифт, обводка…" className="w-full px-2 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </Sec>

          {/* 6. Фоновая музыка (бэкенд поддерживает во всех режимах: цикл + обрезка + громкость %) */}
          <Sec n={6} title="Фоновая музыка" sub="не обязательно" done={!!ugc.music}>
            {ugc.music ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  <Music size={15} style={{ color: ACC }} />
                  <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.music.name}</span>
                  <button onClick={() => p.openUgcPick('music')} className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Заменить</button>
                  <button onClick={() => ugcMutate((u) => ({ ...u, music: null }))} title="Убрать" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Громкость музыки:</span>
                  <input type="range" min={0} max={100} step={5} value={ugc.music.volumePct}
                    onChange={(e) => { const v = Number(e.target.value); ugcMutate((u) => (u.music ? { ...u, music: { ...u.music, volumePct: v } } : u)); }}
                    className="flex-1" style={{ accentColor: ACC, height: 20 }} />
                  <b className="text-[11px]" style={{ color: ACC, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}>{ugc.music.volumePct}%</b>
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Голос всегда 100%; лучшая практика фона — 15–25%. Трек короче ролика — зациклится, длиннее — обрежется.</p>
              </div>
            ) : (
              <button onClick={() => p.openUgcPick('music')} className="w-full py-2.5 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                <Music size={14} /> Музыка — пока не выбрана · тихо подложится под голос
              </button>
            )}
          </Sec>

          {/* Чек-лист готовности */}
          <div className="rounded-xl p-3" style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-primary)' }}>
            <div className="text-[10px] font-700 uppercase mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>Готовность к сборке</div>
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2 py-1 text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: 16, height: 16, background: c.ok ? '#10b981' : 'transparent', border: `1.5px solid ${c.ok ? '#10b981' : 'var(--border-strong)'}`, color: '#fff', fontSize: 9 }}>
                  {c.ok ? <Check size={10} /> : null}
                </span>
                {c.label}
                {!c.ok && <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.hint}</span>}
              </div>
            ))}
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>Сборка идёт на сервере — можно закрыть окно, прогресс не потеряется.</p>
          </div>

          {p.ugcNote && <p className="text-[11px] px-1" style={{ color: 'var(--text-secondary)' }}>{p.ugcNote}</p>}
        </div>

        {/* Канвас превью */}
        <div className="relative flex flex-col min-w-0 overflow-y-auto"
          style={{ background: 'var(--bg-primary)', backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1.4px)', backgroundSize: '19px 19px' }}>
          {/* тулбар формата и раскладки */}
          <div className="flex items-center gap-3 flex-wrap px-4 py-2.5">
            <span className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.05em' }}>Формат</span>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
              {([['p', '9:16 · вертикальный', ['9x16']], ['l', '16:9 · горизонтальный', ['16x9']], ['b', 'Оба', ['9x16', '16x9']]] as [string, string, ('9x16' | '16x9')[]][]).map(([k, lbl, val]) => {
                const sel = ugc.formats.length === val.length && val.every((v) => ugc.formats.includes(v));
                return (
                  <button key={k} onClick={() => ugcMutate((u) => ({ ...u, formats: val }))} className="px-3 py-1.5 rounded-lg text-[11px] font-700"
                    style={{ background: sel ? 'rgba(168,85,247,.14)' : 'transparent', color: sel ? ACC : 'var(--text-muted)', border: sel ? `1px solid ${ACC}` : '1px solid transparent', cursor: 'pointer' }}>{lbl}</button>
                );
              })}
            </div>
            {mode === 'solo' && (
              <>
                <span className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.05em' }}>Раскладка</span>
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  {([['top', 'Аватар сверху'], ['bottom', 'Аватар снизу'], ['overlay-left', 'Поверх видео, слева'], ['overlay-right', 'Поверх видео, справа']] as [UgcSpec['placement'], string][]).map(([v, lbl]) => (
                    <button key={v} onClick={() => ugcMutate((u) => ({ ...u, placement: v }))} title={lbl} className="rounded-lg"
                      style={{ padding: 3, background: ugc.placement === v ? 'rgba(168,85,247,.14)' : 'transparent', border: `1px solid ${ugc.placement === v ? ACC : 'transparent'}`, cursor: 'pointer' }}>
                      <LayDia v={v} />
                    </button>
                  ))}
                </div>
                {(ugc.placement === 'overlay-left' || ugc.placement === 'overlay-right') && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>видео во весь кадр, аватар маленьким поверх</span>
                )}
              </>
            )}
            {ugc.formats.length > 1 && (
              <span className="text-[10.5px] ml-auto" style={{ color: 'var(--text-muted)' }}>2 файла за прогон — аватар оплачивается один раз</span>
            )}
          </div>

          {/* интерактивное превью (спека → кадр) или готовый результат */}
          {!((ugc.results && ugc.results.length > 1) || ugc.result) ? (
            <UgcPreview
              ugc={ugc} mode={mode}
              onEmptyAvatar={() => { if (ugc.avatarSource === 'photo' || mode !== 'solo') p.openUgcPick('photo'); else scrollToSec('ugc-sec-avatar'); }}
              onEmptyPhotoB={() => p.openUgcPick('photoB')}
              onEmptyClip={() => p.openUgcPick('clip')}
              onOpenLines={() => setLinesOpen(true)}
            />
          ) : (
          <div className="flex-1 flex items-center justify-center gap-6 flex-wrap px-4 pb-3" style={{ minHeight: 0 }}>
            {(ugc.results && ugc.results.length > 1) ? (
              <div className="rounded-xl p-3 space-y-2 my-3" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(168,85,247,.4)', maxWidth: 760, width: '100%' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-700" style={{ color: ACC }}>Серия готова: {ugc.results.length} видео — все в Галерее</span>
                  <button onClick={() => ugcMutate((u) => ({ ...u, result: null, results: [] }))} title="Скрыть" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={15} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ugc.results.map((res, i) => (
                    <div key={res.url + i} className="space-y-1">
                      <video src={res.url} controls playsInline className="rounded-lg block w-full" style={{ height: 'auto', maxHeight: '42vh', objectFit: 'contain', background: '#000' }} />
                      <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }} title={res.name}>{res.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : ugc.result ? (
              <div className="rounded-xl p-3 space-y-2 my-3" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(168,85,247,.4)' }}>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[12px] font-700" style={{ color: ACC }}>Готово — видео в Галерее</span>
                  <button onClick={() => ugcMutate((u) => ({ ...u, result: null }))} title="Скрыть" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={15} /></button>
                </div>
                <video src={ugc.result.url} controls playsInline autoPlay
                  onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) p.setUgcResultAR(v.videoWidth / v.videoHeight); }}
                  className="rounded-lg block" style={{ aspectRatio: String(p.ugcResultAR), maxHeight: '64vh', maxWidth: '100%', width: 'auto', margin: '0 auto', background: '#000' }} />
              </div>
            ) : null}
          </div>
          )}
          <p className="text-center text-[10.5px] pb-2.5 px-4" style={{ color: 'var(--text-muted)' }}>
            {mode === 'solo'
              ? 'Кликните по зоне превью, чтобы добавить содержимое. Превью обновляется сразу.'
              : 'Кликайте по сегментам плана — превью покажет каждый план кадра. Медиа реплик — на таймлайне внизу.'}
          </p>

          {/* прогресс сборки поверх канваса */}
          {building && (
            <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--bg-primary) 82%, transparent)', backdropFilter: 'blur(4px)' }}>
              <div className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', width: 330, boxShadow: '0 14px 34px rgba(0,0,0,.4)' }}>
                <div className="text-[13px] font-700 mb-0.5 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Loader2 size={15} className="animate-spin" style={{ color: ACC }} /> Создаём видео…
                </div>
                <div className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>Можно закрыть окно — сборка продолжится на сервере (~2–5 мин).</div>
                {p.ugcNote && <div className="text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>{p.ugcNote}</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Док таймлайна (+ выдвижная панель «Реплики» поверх) ── */}
      <div className="flex-shrink-0 relative" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-medium)' }}>
        {linesOpen && ugc.script.length > 0 && (
          <UgcLinesPanel
            ugc={ugc} ugcMutate={ugcMutate}
            onPickMedia={(i) => { p.setUgcLineIdx(i); p.setUgcPick('lineImage'); }}
            onClose={() => setLinesOpen(false)}
          />
        )}
        <div className="px-3.5 py-2" style={{ maxHeight: 236, overflowY: 'auto' }}>
          {ugc.script.length > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <b className="text-[12px]" style={{ color: 'var(--text-primary)' }}>Таймлайн реплик</b>
                <span className="text-[10.5px]" style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{ugc.script.length} реплик · ~{Math.round(p.ugcScriptSec())} сек</span>
                <button onClick={() => setLinesOpen((o) => !o)} className="ml-auto text-[10.5px] font-700 px-2.5 py-1 rounded-lg"
                  style={{ background: linesOpen ? 'rgba(168,85,247,.14)' : 'var(--bg-tertiary)', color: linesOpen ? ACC : 'var(--text-secondary)', border: `1px solid ${linesOpen ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                  {linesOpen ? 'Скрыть реплики ▾' : 'Реплики ▴'}
                </button>
              </div>
              <DialogueTimeline
                dialogue={ugc.script}
                setDialogue={(updater) => ugcMutate((u) => ({ ...u, script: updater(u.script) }))}
                recordingUrl={ugc.recordingUrl}
                onPickImage={(i) => { p.setUgcLineIdx(i); p.setUgcPick('lineImage'); }}
                dialogueMode={ugc.dialogueEnabled}
                accentA={ACC}
                accentB={ACC2}
              />
            </>
          ) : (
            <p className="text-center text-[11.5px] py-3" style={{ color: 'var(--text-muted)' }}>
              <Type size={13} className="inline mr-1.5" style={{ verticalAlign: '-2px' }} />
              Реплики появятся здесь после «Сгенерировать текст» или «Разобрать речь» — таймлайн с дорожками голосов, резкой и медиа.
            </p>
          )}
        </div>
      </div>

      {/* ── Пикеры Галереи (единый GalleryPicker сервиса) ── */}
      {p.ugcPick && p.ugcPick !== 'retBrolls' && (
        <GalleryPicker
          open token={p.token}
          title={p.ugcPick === 'music' ? 'Фоновая музыка' : p.ugcPick === 'photo' ? 'Фото · первый собеседник' : p.ugcPick === 'photoB' ? 'Фото · второй собеседник' : p.ugcPick === 'recording' ? 'Запись' : p.ugcPick === 'avatarAdd' ? 'Аватар из Галереи' : p.ugcPick === 'lineImage' ? 'Медиа к реплике' : 'Видеоряд'}
          defaultTab={p.ugcPick === 'music' ? 'audio' : 'reference'}
          onClose={() => { p.setUgcPick(null); p.setUgcLineIdx(null); }}
          onUpload={(files) => p.uploadToGallery(files, p.ugcPick === 'music' ? 'audio' : 'reference')}
          uploadAccept={p.ugcPick === 'music' ? 'audio/*' : (p.ugcPick === 'photo' || p.ugcPick === 'photoB' || p.ugcPick === 'avatarAdd') ? 'image/*' : p.ugcPick === 'lineImage' ? 'image/*,video/*' : p.ugcPick === 'recording' ? 'audio/*,video/*' : 'video/*'}
          onlyType={p.ugcPick === 'photo' || p.ugcPick === 'photoB' || p.ugcPick === 'avatarAdd' ? 'image' : p.ugcPick === 'music' ? 'audio' : p.ugcPick === 'clip' ? 'video' : undefined}
          onPick={(it) => p.pickUgcItem({ url: it.fileUrl, name: it.title, type: (it.type === 'image' || it.type === 'audio' ? it.type : 'video') })}
        />
      )}
      {p.ugcPick === 'retBrolls' && (
        <GalleryPicker
          open multi token={p.token}
          title="Видео для серии — отдельный ролик на каждое"
          note="Клик добавляет видео; можно выбрать несколько. Аватар оплачивается один раз на всю серию."
          defaultTab="reference"
          onlyType="video"
          uploadAccept="video/*"
          pickedKeys={new Set(ugc.retentionBrolls.map((b) => b.url))}
          onClose={() => p.setUgcPick(null)}
          onUpload={(files) => p.uploadToGallery(files, 'reference')}
          onPick={(it) => ugcMutate((u) => (
            u.retentionBrolls.some((b) => b.url === it.fileUrl)
              ? { ...u, retentionBrolls: u.retentionBrolls.filter((b) => b.url !== it.fileUrl) }
              : { ...u, retentionBrolls: [...u.retentionBrolls, { url: it.fileUrl, name: it.title }] }
          ))}
        />
      )}

      {/* Удаление аватара из коллекции */}
      <ConfirmModal
        open={!!p.ugcDelAvatar}
        title="Убрать аватар?"
        message={p.ugcDelAvatar ? `«${p.ugcDelAvatar.name}» будет убран из вашей коллекции аватаров. Исходный файл в Галерее останется.` : ''}
        confirmLabel="Убрать"
        cancelLabel="Отмена"
        variant="danger"
        onCancel={() => p.setUgcDelAvatar(null)}
        onConfirm={() => { if (p.ugcDelAvatar) void p.doDelUgcAvatar(p.ugcDelAvatar); }}
      />
    </div>
  );
}
