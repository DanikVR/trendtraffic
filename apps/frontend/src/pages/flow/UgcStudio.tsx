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
import { type UgcSpec, type UgcPickTarget, type UgcMode, type UgcFormat, ugcModeOf } from './ugcTypes';
import { useTranslation } from 'react-i18next';

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
  if (kind === 'voiceover') return (
    <span style={box}>
      <i style={b({ inset: 3, background: 'var(--text-disabled)', opacity: .45 })} />
      <i style={b({ left: 6, bottom: 6, width: 3, height: 7, background: ACC2 })} />
      <i style={b({ left: 11, bottom: 6, width: 3, height: 12, background: ACC2 })} />
      <i style={b({ left: 16, bottom: 6, width: 3, height: 5, background: ACC2 })} />
      <i style={b({ left: 21, bottom: 6, width: 3, height: 10, background: ACC2 })} />
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
  const { t } = useTranslation('common');
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
      return { ...u, noAvatar: false, dialogueEnabled: false, retentionPreset: 'off', avatarSource: back };
    }
    if (m === 'retention') return { ...u, noAvatar: false, dialogueEnabled: false, retentionPreset: u.retentionPreset === 'off' ? 'bal' : u.retentionPreset, avatarSource: 'photo' };
    if (m === 'dialogue') return { ...u, noAvatar: false, dialogueEnabled: true, retentionPreset: 'off', avatarSource: 'photo' };
    return { ...u, noAvatar: true, dialogueEnabled: false, retentionPreset: 'off' };   // voiceover
  });

  /* ── готовность к сборке (чек-лист + причина недоступности CTA) ── */
  const avatarOk = ugc.avatarSource === 'collection' ? !!ugc.avatarUrl : !!ugc.photoUrl;
  const voiceOk = mode === 'dialogue'
    ? ugc.script.length > 0
    : (ugc.script.length > 0 || (ugc.source === 'diarize' && !!ugc.recordingUrl));
  const videoOk = mode === 'retention' ? (!!ugc.clip || ugc.retentionBrolls.length > 0) : (mode === 'voiceover' ? !!ugc.clip : true);
  const checks: { label: string; ok: boolean; hint: string; miss: string }[] = [
    ...(mode !== 'voiceover' ? [{ label: ugc.avatarSource === 'collection' ? t('ugc.checklist.avatarChosen') : t('ugc.checklist.photoChosen'), ok: avatarOk, hint: t('ugc.checklist.step', { n: 2 }), miss: ugc.avatarSource === 'collection' ? t('ugc.checklist.missAvatar') : t('ugc.checklist.missPhoto') }] : []),
    ...(mode === 'dialogue' ? [{ label: t('ugc.checklist.secondSpeaker'), ok: !!ugc.photoBUrl, hint: t('ugc.checklist.step', { n: 2 }), miss: t('ugc.checklist.missPhotoB') }] : []),
    { label: mode === 'dialogue' ? t('ugc.checklist.recordingDiarized') : t('ugc.checklist.scriptOrRecording'), ok: voiceOk, hint: t('ugc.checklist.step', { n: 3 }), miss: mode === 'dialogue' ? t('ugc.checklist.missDiarize') : t('ugc.checklist.missScript') },
    ...(mode === 'retention' || mode === 'voiceover' ? [{ label: t('ugc.checklist.videoChosen'), ok: videoOk, hint: t('ugc.checklist.step', { n: 4 }), miss: t('ugc.checklist.missVideo') }] : []),
  ];
  const allOk = checks.every((c) => c.ok) && (mode !== 'dialogue' || !!ugc.photoBUrl);
  const missing = checks.filter((c) => !c.ok).map((c) => c.miss).join(', ');

  /* серия языков (перевод Claude + TTS multilingual) — только ИИ-текст в соло/озвучке */
  const langsActive = ugc.source === 'gen' && (mode === 'solo' || mode === 'voiceover');
  const extraLangsCount = langsActive ? ugc.langs.filter((l) => l !== 'ru').length : 0;

  /* ── смета (ориентиры из докки UGC_AVATARS.md) ── */
  const costBase = mode === 'voiceover'
    ? (ugc.source === 'gen' ? t('ugc.cost.voiceoverAi') : t('ugc.cost.voiceoverFree'))
    : mode === 'retention'
      ? ({ off: '', eco: t('ugc.cost.perClip1_2'), bal: t('ugc.cost.perClip2_3'), prem: t('ugc.cost.perClip3_5') }[ugc.retentionPreset])
      : mode === 'dialogue'
        ? ({ eco: t('ugc.cost.perClip2'), bal: t('ugc.cost.perClip2_3'), dyn: t('ugc.cost.perClip3_5') }[ugc.dialogueEngagement])
        : (ugc.faceProvider === 'heygen_ext' ? t('ugc.cost.perMin1') : t('ugc.cost.perMin3_4'));
  const costExtra = (mode === 'retention' && ugc.retentionBrolls.length > 1
    ? t('ugc.cost.seriesSuffix', { count: ugc.retentionBrolls.length })
    : (ugc.formats.length > 1 ? t('ugc.cost.filesSuffix') : ''))
    + (extraLangsCount > 0 ? t('ugc.cost.langsSuffix', { count: extraLangsCount + 1 }) : '');

  const scrollToSec = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  /* ── голоса ElevenLabs аккаунта (включая клоны) для озвучки ИИ-текста ── */
  const [elVoices, setElVoices] = useState<{ id: string; name: string; preview: string | null; category: string | null }[] | null>(null);
  const [elNote, setElNote] = useState<string | null>(null);
  useEffect(() => {
    if (ugc.source !== 'gen' || elVoices !== null) return;
    void fetch('/api/render/ugc/voices', { headers: { ...(p.token ? { Authorization: `Bearer ${p.token}` } : {}) } })
      .then((r) => r.json())
      .then((d) => { setElVoices(Array.isArray(d?.voices) ? d.voices : []); if (d?.note) setElNote(String(d.note)); })
      .catch(() => setElVoices([]));
  }, [ugc.source, elVoices, p.token]);
  const prevAudioRef = useRef<HTMLAudioElement | null>(null);
  const playPreview = (url: string) => {
    try { prevAudioRef.current?.pause(); const a = new Audio(url); prevAudioRef.current = a; void a.play(); } catch { /* превью не критично */ }
  };
  useEffect(() => () => { try { prevAudioRef.current?.pause(); } catch { /* */ } }, []);

  /* фиксированный набор языков серии (перевод Claude + ElevenLabs multilingual) */
  const LANG_CHOICES: [string, string][] = [['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['fr', 'Français'], ['pt', 'Português'], ['it', 'Italiano'], ['tr', 'Türkçe'], ['uk', 'Українська']];

  /* ── бренд-кит: сохранённый набор оформления (слой, заставки, музыка, субтитры, голос) ── */
  interface BrandKit { id: string; name: string; data: Partial<Pick<UgcSpec, 'layers' | 'intro' | 'outro' | 'music' | 'subtitles' | 'voiceId' | 'progressBar'>> }
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandKits, setBrandKits] = useState<BrandKit[] | null>(null);
  const [brandNote, setBrandNote] = useState<string | null>(null);
  const authHeaders = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(p.token ? { Authorization: `Bearer ${p.token}` } : {}) });
  const loadBrandKits = async () => {
    try {
      const r = await fetch('/api/render/ugc/brandkits', { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setBrandKits(Array.isArray(d?.kits) ? d.kits : []);
    } catch (e: any) { setBrandKits([]); setBrandNote(String(e?.message || e)); }
  };
  const openBrand = () => { setBrandOpen(true); setBrandNote(null); void loadBrandKits(); };
  const applyBrand = (k: BrandKit) => {
    ugcMutate((u) => ({
      ...u,
      ...(k.data.layers ? { layers: k.data.layers } : {}),
      ...(k.data.intro !== undefined ? { intro: k.data.intro } : {}),
      ...(k.data.outro !== undefined ? { outro: k.data.outro } : {}),
      ...(k.data.music !== undefined ? { music: k.data.music } : {}),
      ...(k.data.subtitles ? { subtitles: k.data.subtitles } : {}),
      ...(k.data.voiceId !== undefined ? { voiceId: k.data.voiceId } : {}),
      ...(k.data.progressBar !== undefined ? { progressBar: !!k.data.progressBar } : {}),
    }));
    setBrandOpen(false);
  };
  const saveBrand = async () => {
    try {
      const name = `${t('ugc.brand.defaultName')} ${new Date().toLocaleDateString()}`;
      const data = { layers: ugc.layers, intro: ugc.intro, outro: ugc.outro, music: ugc.music, subtitles: ugc.subtitles, voiceId: ugc.voiceId, progressBar: ugc.progressBar };
      const r = await fetch('/api/render/ugc/brandkits', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, data }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      await loadBrandKits();
    } catch (e: any) { setBrandNote(String(e?.message || e)); }
  };
  const deleteBrand = async (id: string) => {
    try {
      await fetch(`/api/render/ugc/brandkits/${id}`, { method: 'DELETE', headers: authHeaders() });
      await loadBrandKits();
    } catch { /* мягко */ }
  };

  /* Esc: закрывает бренд-модалку → иначе студию (если не открыт пикер/подтверждение) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (brandOpen) { setBrandOpen(false); return; }
      if (!p.ugcPick && !p.ugcDelAvatar) p.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Топбар ── */}
      <div className="flex items-center gap-3 px-3.5 flex-shrink-0" style={{ height: 54, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-medium)' }}>
        <button onClick={p.onClose} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-600"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={15} /> {t('ugc.topbar.back')}
        </button>
        <div className="leading-tight">
          <div className="text-[13.5px] font-700" style={{ color: 'var(--text-primary)' }}>{t('ugc.topbar.title')}</div>
          <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.topbar.subtitle')}</div>
        </div>
        <div className="flex-1" />
        <button onClick={() => void p.ugcSaveNow()} disabled={p.saving} className="inline-flex items-center gap-1.5 text-[11.5px] font-600 px-2.5 py-1.5 rounded-lg disabled:opacity-60"
          style={{ background: 'var(--bg-tertiary)', color: p.ugcSavedFlash ? '#22c55e' : 'var(--text-secondary)', border: `1px solid ${p.ugcSavedFlash ? 'rgba(34,197,94,.5)' : 'var(--border-medium)'}`, cursor: 'pointer' }}
          title={t('ugc.topbar.saveTooltip')}>
          {p.saving ? <Loader2 size={13} className="animate-spin" /> : p.ugcSavedFlash ? <Check size={13} /> : <Save size={13} />}
          {p.saving ? t('ugc.topbar.saving') : p.ugcSavedFlash ? t('ugc.topbar.saved') : t('ugc.topbar.save')}
        </button>
        <button onClick={openBrand} title={t('ugc.brand.tooltip')}
          className="text-[11px] px-2.5 py-1.5 rounded-full font-600"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ◆ {t('ugc.brand.button')}
        </button>
        <span className="text-[11px] px-2.5 py-1.5 rounded-full" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {costBase}{costExtra}
        </span>
        <button onClick={() => void p.ugcBuildStart()} disabled={building || !allOk}
          title={allOk ? t('ugc.topbar.ctaTooltipReady') : t('ugc.topbar.ctaTooltipMissing', { missing })}
          className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2 rounded-xl disabled:opacity-50"
          style={{ background: `linear-gradient(135deg,${ACC},${ACC2})`, color: '#fff', border: 'none', cursor: allOk && !building ? 'pointer' : 'not-allowed' }}>
          {building ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {building ? t('ugc.topbar.creating') : t('ugc.topbar.create')}
        </button>
      </div>

      {/* ── Корпус: панель шагов + превью ── */}
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: '348px 1fr' }}>
        {/* Левая панель */}
        <div className="overflow-y-auto p-3 space-y-2.5" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-medium)' }}>

          {/* 1. Режим ролика */}
          <Sec n={1} title={t('ugc.mode.title')} done>
            <div className="grid grid-cols-2 gap-1.5">
              {([['solo', t('ugc.mode.solo')], ['retention', t('ugc.mode.retention')], ['dialogue', t('ugc.mode.dialogue')], ['voiceover', t('ugc.mode.voiceover')]] as [UgcMode, string][]).map(([m, lbl]) => (
                <button key={m} onClick={() => setMode(m)} className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2"
                  style={{ background: mode === m ? 'rgba(168,85,247,.12)' : 'var(--bg-secondary)', border: `1px solid ${mode === m ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                  <ModeDia kind={m} />
                  <span className="text-[10.5px] font-650 text-center leading-tight" style={{ color: mode === m ? ACC : 'var(--text-secondary)' }}>{lbl}</span>
                </button>
              ))}
            </div>
            <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
              {mode === 'solo' && t('ugc.mode.soloHint')}
              {mode === 'retention' && t('ugc.mode.retentionHint')}
              {mode === 'dialogue' && t('ugc.mode.dialogueHint')}
              {mode === 'voiceover' && t('ugc.mode.voiceoverHint')}
            </p>
            {mode === 'retention' && (
              <>
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.mode.retentionPresetLabel')}</div>
                <Seg value={ugc.retentionPreset} cols={3}
                  opts={[['eco', t('ugc.mode.presetEco')], ['bal', t('ugc.common.balance')], ['prem', t('ugc.mode.presetPrem')]] as [UgcSpec['retentionPreset'], string][]}
                  onPick={(v) => ugcMutate((u) => ({ ...u, retentionPreset: v }))} />
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {ugc.retentionPreset === 'eco' && t('ugc.mode.presetEcoHint')}
                  {ugc.retentionPreset === 'bal' && t('ugc.mode.presetBalHint')}
                  {ugc.retentionPreset === 'prem' && t('ugc.mode.presetPremHint')}
                  {' '}{t('ugc.mode.presetAiTrailer')}
                </p>
              </>
            )}
            {mode === 'dialogue' && (
              <>
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.mode.dialogueEngLabel')}</div>
                <Seg value={ugc.dialogueEngagement} cols={3}
                  opts={[['eco', t('ugc.mode.engCalm')], ['bal', t('ugc.common.balance')], ['dyn', t('ugc.mode.engLively')]] as [UgcSpec['dialogueEngagement'], string][]}
                  onPick={(v) => ugcMutate((u) => ({ ...u, dialogueEngagement: v }))} />
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {ugc.dialogueEngagement === 'eco' && t('ugc.mode.engEcoHint')}
                  {ugc.dialogueEngagement === 'bal' && t('ugc.mode.engBalHint')}
                  {ugc.dialogueEngagement === 'dyn' && t('ugc.mode.engDynHint')}
                  {' '}{t('ugc.mode.engAiTrailer')}
                </p>
                <Toggle on={ugc.dialogueCutout} title={t('ugc.mode.cutoutTitle')}
                  sub={t('ugc.mode.cutoutSub')}
                  onClick={() => ugcMutate((u) => ({ ...u, dialogueCutout: !u.dialogueCutout }))} />
              </>
            )}
          </Sec>

          {/* 2. Аватар */}
          {mode !== 'voiceover' && (
          <div id="ugc-sec-avatar">
          <Sec n={2} title={t('ugc.avatar.title')} sub={t('ugc.avatar.sub')} done={avatarOk && (mode !== 'dialogue' || !!ugc.photoBUrl)}>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
              {([['collection', t('ugc.avatar.sourceCollection')], ['photo', t('ugc.avatar.sourcePhoto')]] as [UgcSpec['avatarSource'], string][]).map(([s, lbl]) => {
                const locked = s === 'collection' && mode !== 'solo';
                return (
                  <button key={s} disabled={locked} onClick={() => ugcMutate((u) => ({ ...u, avatarSource: s }))}
                    title={locked ? t('ugc.avatar.collectionLocked') : undefined}
                    className="py-2 rounded-lg text-[11.5px] font-600 disabled:opacity-40"
                    style={{ background: ugc.avatarSource === s ? 'var(--bg-tertiary)' : 'transparent', color: ugc.avatarSource === s ? ACC : 'var(--text-muted)', border: 'none', cursor: locked ? 'not-allowed' : 'pointer' }}>{lbl}</button>
                );
              })}
            </div>
            {ugc.avatarSource === 'collection' ? (
              <div className="space-y-2">
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.avatar.myCollection')}</div>
                {p.ugcAvLoading ? (
                  <p className="text-[11px] py-3 text-center" style={{ color: 'var(--text-muted)' }}><Loader2 size={14} className="animate-spin inline" /> {t('ugc.avatar.loading')}</p>
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
                          <button onClick={(e) => p.askDelUgcAvatar(a, e)} title={t('ugc.avatar.removeFromCollection')}
                            className="absolute top-1 right-1 rounded-full items-center justify-center hidden group-hover:flex"
                            style={{ width: 18, height: 18, background: 'rgba(0,0,0,.65)', border: 'none', color: '#f87171', cursor: 'pointer' }}><X size={11} /></button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg p-3 text-[11px] text-center" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
                    {t('ugc.avatar.empty')}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <button onClick={p.genUgcAvatars} disabled={p.ugcBusy === 'avatars'} className="flex-1 py-2 rounded-lg text-[11px] font-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ background: 'rgba(168,85,247,0.14)', color: ACC, border: '1px solid rgba(168,85,247,0.4)', cursor: 'pointer' }}>
                    {p.ugcBusy === 'avatars' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {t('ugc.avatar.gen3')}
                  </button>
                  <button onClick={() => p.openUgcPick('avatarAdd')} className="flex-1 py-2 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    <Plus size={13} /> {t('ugc.avatar.pickFromGallery')}
                  </button>
                  <button onClick={() => p.loadUgcAvatars(true)} disabled={p.ugcAvLoading} title={t('ugc.avatar.refresh')} className="px-2 py-2 rounded-lg"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><RefreshCw size={13} /></button>
                </div>
                <input value={p.ugcAvBrief} onChange={(e) => p.setUgcAvBrief(e.target.value)}
                  placeholder={t('ugc.avatar.briefPlaceholder')}
                  className="w-full px-2 py-1.5 rounded-lg text-[11px] outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                {p.ugcAvNote && <p className="text-[11px]" style={{ color: '#f59e0b' }}>{p.ugcAvNote}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{mode === 'dialogue' ? t('ugc.avatar.speakerAHeading') : t('ugc.avatar.yourPhotoHeading')}</div>
                {ugc.photoUrl ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <img src={ugc.photoUrl} alt="" className="rounded-md object-cover" style={{ width: 52, height: 68 }} />
                    <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.photoName || t('ugc.avatar.photoChosenName')}</span>
                    <button onClick={() => p.openUgcPick('photo')} className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                    <button onClick={() => ugcMutate((u) => ({ ...u, photoUrl: null, photoName: null }))} title={t('ugc.common.remove')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => p.openUgcPick('photo')} className="w-full py-2.5 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-secondary)', color: ACC, border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    {t('ugc.avatar.photoEmpty')}
                  </button>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.avatar.photoHint')}</p>
                {mode === 'dialogue' && (
                  <>
                    <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.avatar.speakerBHeading')}</div>
                    {ugc.photoBUrl ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                        <img src={ugc.photoBUrl} alt="" className="rounded-md object-cover" style={{ width: 44, height: 58 }} />
                        <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.photoBName || t('ugc.avatar.photoBName')}</span>
                        <button onClick={() => p.openUgcPick('photoB')} className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                        <button onClick={() => ugcMutate((u) => ({ ...u, photoBUrl: null, photoBName: null }))} title={t('ugc.common.remove')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => p.openUgcPick('photoB')} className="w-full py-2 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--bg-secondary)', color: ACC, border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                        <Plus size={13} /> {t('ugc.avatar.photoBEmpty')}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.avatar.faceProviderLabel')}</div>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                {([['heygen_api', t('ugc.avatar.providerApi')], ['heygen_ext', t('ugc.avatar.providerExt')]] as [UgcSpec['faceProvider'], string][]).map(([pr, lbl]) => (
                  <button key={pr} onClick={() => ugcMutate((u) => ({ ...u, faceProvider: pr }))} className="py-1.5 rounded-lg text-[10.5px] font-700"
                    style={{ background: ugc.faceProvider === pr ? 'rgba(14,158,119,0.14)' : 'transparent', color: ugc.faceProvider === pr ? '#0E9E77' : 'var(--text-muted)', border: `1px solid ${ugc.faceProvider === pr ? '#0E9E77' : 'transparent'}`, cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
              {ugc.faceProvider === 'heygen_ext' ? (
                <div className="text-[10px] px-2 py-1.5 rounded-md leading-relaxed" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                  {t('ugc.avatar.extIntro')}{' '}
                  {t('ugc.avatar.extLabel')}{' '}
                  <b style={{ color: p.hgExt.present === false ? '#ef4444' : p.hgExt.connected ? '#0E9E77' : p.hgExt.present ? '#f59e0b' : 'var(--text-muted)' }}>
                    {p.hgExt.present === null ? t('ugc.avatar.extChecking') : p.hgExt.present === false ? t('ugc.avatar.extAbsent') : p.hgExt.connected ? t('ugc.avatar.extConnected') : t('ugc.avatar.extSignIn')}
                  </b>.
                  {p.hgExt.present === false ? <> <a href="/trendtraffic-extension.zip" download style={{ color: '#0E9E77', textDecoration: 'underline' }}>{t('ugc.avatar.extDownload')}</a> {t('ugc.avatar.extUnified')}</> : null}
                  {' '}{t('ugc.avatar.extKeepOpen')}
                </div>
              ) : (
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.avatar.apiNote')}</p>
              )}
            </div>
          </Sec>
          </div>
          )}

          {/* 3. Голос и текст */}
          <Sec n={3} title={t('ugc.voice.title')} sub={t('ugc.voice.sub')} done={voiceOk}>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
              {([['gen', t('ugc.voice.sourceGen')], ['diarize', t('ugc.voice.sourceDiarize')]] as [UgcSpec['source'], string][]).map(([s, lbl]) => (
                <button key={s} onClick={() => ugcMutate((u) => ({ ...u, source: s }))} className="py-2 rounded-lg text-[11.5px] font-600"
                  style={{ background: ugc.source === s ? 'var(--bg-tertiary)' : 'transparent', color: ugc.source === s ? ACC : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{lbl}</button>
              ))}
            </div>
            {ugc.source === 'gen' ? (
              <div className="space-y-2">
                {mode === 'dialogue' && (
                  <p className="text-[10px]" style={{ color: '#f59e0b' }}>{t('ugc.voice.dialogueNeedsRecording')}</p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t('ugc.voice.ttsLabel')}</span>
                  {([['female', t('ugc.voice.female')], ['male', t('ugc.voice.male')]] as [UgcSpec['voice'], string][]).map(([v, lbl]) => (
                    <button key={v} onClick={() => ugcMutate((u) => ({ ...u, voice: v }))} className="flex-1 py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1"
                      style={{ background: ugc.voice === v ? ACC : 'var(--bg-secondary)', color: ugc.voice === v ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.voice === v ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}><Mic size={11} /> {lbl}</button>
                  ))}
                </div>
                {/* Голоса ElevenLabs из аккаунта клиента (включая клоны); ▶ — послушать образец */}
                {elVoices && elVoices.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.voice.elevenLabel')}</div>
                    <div className="space-y-1" style={{ maxHeight: 168, overflowY: 'auto' }}>
                      <button onClick={() => ugcMutate((u) => ({ ...u, voiceId: null }))}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left"
                        style={{ background: !ugc.voiceId ? 'rgba(168,85,247,.12)' : 'var(--bg-secondary)', border: `1px solid ${!ugc.voiceId ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                        <span className="text-[11px] font-650" style={{ color: !ugc.voiceId ? ACC : 'var(--text-secondary)' }}>{t('ugc.voice.elevenDefault')}</span>
                      </button>
                      {elVoices.map((v) => {
                        const on = ugc.voiceId === v.id;
                        return (
                          <div key={v.id} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg"
                            style={{ background: on ? 'rgba(168,85,247,.12)' : 'var(--bg-secondary)', border: `1px solid ${on ? ACC : 'var(--border-medium)'}` }}>
                            {v.preview ? (
                              <button onClick={() => playPreview(v.preview!)} title={t('ugc.voice.elevenPreview')}
                                className="flex-shrink-0 flex items-center justify-center rounded-full"
                                style={{ width: 22, height: 22, background: 'var(--bg-tertiary)', border: '1px solid var(--border-strong)', color: ACC, cursor: 'pointer', fontSize: 9 }}>▶</button>
                            ) : <span style={{ width: 22 }} />}
                            <button onClick={() => ugcMutate((u) => ({ ...u, voiceId: v.id }))} className="flex-1 min-w-0 text-left" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                              <span className="text-[11px] font-650 block truncate" style={{ color: on ? ACC : 'var(--text-secondary)' }}>{v.name}</span>
                              {v.category && <span className="text-[9.5px]" style={{ color: 'var(--text-muted)' }}>{v.category}</span>}
                            </button>
                            {on && <Check size={12} style={{ color: ACC, flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {elNote && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{elNote}</p>}
                <textarea value={ugc.brief} onChange={(e) => ugcMutate((u) => ({ ...u, brief: e.target.value }))} rows={2}
                  placeholder={t('ugc.voice.briefPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', resize: 'vertical' }} />
                <button onClick={p.ugcGenScript} disabled={p.ugcBusy === 'dialogue'} className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: 'rgba(168,85,247,0.14)', color: ACC, border: '1px solid rgba(168,85,247,0.4)', cursor: 'pointer' }}>
                  {p.ugcBusy === 'dialogue' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {t('ugc.voice.genScript')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {ugc.recordingUrl ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <Music size={15} style={{ color: ACC }} />
                    <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.recordingName || t('ugc.voice.recordingName')}</span>
                    <button onClick={() => ugcMutate((u) => ({ ...u, recordingUrl: null, recordingName: null, script: [], result: null }))} title={t('ugc.voice.removeRecording')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => p.openUgcPick('recording')} className="w-full py-2.5 rounded-xl text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    <Paperclip size={14} /> {t('ugc.voice.recordingEmpty')}
                  </button>
                )}
                <button onClick={p.ugcRunDiarize} disabled={p.ugcBusy === 'diarize' || !ugc.recordingUrl} className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'rgba(168,85,247,0.14)', color: ACC, border: '1px solid rgba(168,85,247,0.4)', cursor: 'pointer' }}>
                  {p.ugcBusy === 'diarize' ? <Loader2 size={15} className="animate-spin" /> : <Scissors size={15} />} {p.ugcBusy === 'diarize' ? t('ugc.voice.diarizing') : t('ugc.voice.diarize')}
                </button>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {mode === 'dialogue' ? t('ugc.voice.diarizeHintDialogue') : mode === 'voiceover' ? t('ugc.voice.diarizeHintVoiceover') : t('ugc.voice.diarizeHintSolo')}
                </p>
                {mode === 'voiceover' && (
                  <Toggle on={ugc.loudnorm} title={t('ugc.voice.loudnormTitle')} sub={t('ugc.voice.loudnormSub')}
                    onClick={() => ugcMutate((u) => ({ ...u, loudnorm: !u.loudnorm }))} />
                )}
              </div>
            )}
            {/* Языки серии: отдельный ролик на каждом языке (перевод Claude → ElevenLabs multilingual) */}
            {langsActive && (
              <div className="space-y-1">
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.voice.langsLabel')}</div>
                <div className="flex gap-1 flex-wrap">
                  <span className="text-[10px] font-650 px-2.5 py-1 rounded-full" style={{ background: ACC, color: '#fff', border: `1px solid ${ACC}` }}>{t('ugc.voice.langRuPinned')}</span>
                  {LANG_CHOICES.map(([code, label]) => {
                    const on = ugc.langs.includes(code);
                    return (
                      <button key={code} onClick={() => ugcMutate((u) => ({ ...u, langs: on ? u.langs.filter((l) => l !== code) : [...u.langs.filter((l) => l === 'ru' || LANG_CHOICES.some(([c]) => c === l)), code] }))}
                        className="text-[10px] font-650 px-2.5 py-1 rounded-full"
                        style={{ background: on ? 'rgba(168,85,247,.14)' : 'var(--bg-secondary)', color: on ? ACC : 'var(--text-muted)', border: `1px solid ${on ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>{label}</button>
                    );
                  })}
                </div>
                {extraLangsCount > 0 && (
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {mode === 'voiceover' ? t('ugc.voice.langsHintVoiceover', { count: extraLangsCount + 1 }) : t('ugc.voice.langsHintSolo', { count: extraLangsCount + 1 })}
                  </p>
                )}
              </div>
            )}
            {ugc.script.length > 0 && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text-secondary)' }}>{t('ugc.lines.count', { count: ugc.script.length, sec: Math.round(p.ugcScriptSec()) })}</b> {t('ugc.lines.editHint')}
              </p>
            )}
          </Sec>

          {/* 4. Видеоряд */}
          <Sec n={4} title={t('ugc.video.title')} sub={t('ugc.video.sub')} done={!!ugc.clip || (mode === 'retention' && ugc.retentionBrolls.length > 0)}>
            {ugc.clip ? (
              <div className="flex items-center gap-2">
                <video src={`${ugc.clip.url}#t=0.1`} muted className="rounded-lg" style={{ width: 44, height: 78, objectFit: 'cover', background: '#000' }} />
                <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.clip.name}</span>
                <button onClick={() => p.openUgcPick('clip')} className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                <button onClick={() => ugcMutate((u) => ({ ...u, clip: null }))} title={t('ugc.common.remove')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => p.openUgcPick('clip')} className="w-full py-2.5 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-secondary)', color: ACC, border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                <Video size={14} /> {t('ugc.video.empty')}
              </button>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {([['cover', t('ugc.video.fitCover')], ['contain', t('ugc.video.fitContain')]] as ['cover' | 'contain', string][]).map(([f, lbl]) => (
                  <button key={f} onClick={() => ugcMutate((u) => ({ ...u, clipFit: f }))} className="text-[10px] font-600 px-2 py-1 rounded-md"
                    style={{ background: ugc.clipFit === f ? ACC : 'var(--bg-secondary)', color: ugc.clipFit === f ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.clipFit === f ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
              <label className="text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!ugc.clipMuted} onChange={(e) => ugcMutate((u) => ({ ...u, clipMuted: !e.target.checked }))} /> {t('ugc.video.keepSound')}
              </label>
            </div>
            {mode === 'solo' && !ugc.clip && (
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.video.soloOptional')}</p>
            )}
            {mode === 'dialogue' && (
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.video.dialogueHint')}</p>
            )}
            {mode === 'voiceover' && (
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.video.voiceoverBase')}</p>
            )}
            {mode === 'retention' && (
              <div className="rounded-lg p-2 space-y-1.5" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-medium)' }}>
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.video.seriesHeading')}</div>
                {ugc.retentionBrolls.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{t('ugc.video.seriesCount', { count: ugc.retentionBrolls.length })}</div>
                    <div className="flex gap-1.5">
                      <button onClick={() => p.openUgcPick('retBrolls')} className="flex-1 py-1.5 rounded-md text-[11px] font-600" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.video.seriesChange')}</button>
                      <button onClick={() => ugcMutate((u) => ({ ...u, retentionBrolls: [] }))} className="px-2 py-1.5 rounded-md text-[11px]" style={{ background: 'transparent', color: '#ef4444', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.clear')}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => p.openUgcPick('retBrolls')} className="w-full py-2 rounded-md text-[11px] font-600 inline-flex items-center justify-center gap-1.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    <Layers size={13} /> {t('ugc.video.seriesAdd')}
                  </button>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.video.seriesBilling')}</p>
              </div>
            )}
            {/* Заставки до и после: готовое видео из Галереи приклеивается как есть */}
            <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.bumpers.heading')}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {([['intro', ugc.intro, t('ugc.bumpers.introEmpty')], ['outro', ugc.outro, t('ugc.bumpers.outroEmpty')]] as ['intro' | 'outro', { url: string; name: string } | null, string][]).map(([kind, val, emptyLbl]) => (
                val ? (
                  <div key={kind} className="flex items-center gap-1.5 p-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <video src={`${val.url}#t=0.1`} muted className="rounded" style={{ width: 30, height: 30, objectFit: 'cover', background: '#000', flexShrink: 0 }} />
                    <span className="text-[10px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }} title={val.name}>{val.name}</span>
                    <button onClick={() => ugcMutate((u) => ({ ...u, [kind]: null }))} title={t('ugc.common.remove')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}><X size={12} /></button>
                  </div>
                ) : (
                  <button key={kind} onClick={() => p.openUgcPick(kind)} className="py-2 rounded-lg text-[10.5px] font-600 inline-flex items-center justify-center gap-1"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    <Plus size={11} /> {emptyLbl}
                  </button>
                )
              ))}
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.bumpers.hint')}</p>
          </Sec>

          {/* 5. Субтитры */}
          <Sec n={5} title={t('ugc.subtitles.title')} sub={t('ugc.subtitles.sub')} done>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.subtitles.styleLabel')}</span>
              {([['none', t('ugc.subtitles.styleNone')], ['word', t('ugc.subtitles.styleWord')], ['karaoke', t('ugc.subtitles.styleKaraoke')], ['plain', t('ugc.subtitles.stylePlain')]] as [UgcSpec['subtitles']['style'], string][]).map(([s, lbl]) => (
                <button key={s} onClick={() => ugcMutate((u) => ({ ...u, subtitles: { ...u.subtitles, style: s } }))} className="text-[10px] font-600 px-2 py-1 rounded-md"
                  style={{ background: ugc.subtitles.style === s ? ACC : 'var(--bg-secondary)', color: ugc.subtitles.style === s ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.subtitles.style === s ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.subtitles.posLabel')}</span>
              {([['bottom', t('ugc.subtitles.posBottom')], ['center', t('ugc.subtitles.posCenter')], ['top', t('ugc.subtitles.posTop')]] as [UgcSpec['subtitles']['pos'], string][]).map(([pos, lbl]) => (
                <button key={pos} onClick={() => ugcMutate((u) => ({ ...u, subtitles: { ...u.subtitles, pos } }))} className="text-[10px] font-600 px-2 py-1 rounded-md"
                  style={{ background: ugc.subtitles.pos === pos ? ACC : 'var(--bg-secondary)', color: ugc.subtitles.pos === pos ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.subtitles.pos === pos ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
              ))}
            </div>
            <input value={ugc.subtitles.wishes} onChange={(e) => ugcMutate((u) => ({ ...u, subtitles: { ...u.subtitles, wishes: e.target.value } }))}
              placeholder={t('ugc.subtitles.wishesPlaceholder')} className="w-full px-2 py-1.5 rounded-lg text-[12px] outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </Sec>

          {/* 6. Фоновая музыка (бэкенд поддерживает во всех режимах: цикл + обрезка + громкость %) */}
          <Sec n={6} title={t('ugc.music.title')} sub={t('ugc.music.sub')} done={!!ugc.music}>
            {ugc.music ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  <Music size={15} style={{ color: ACC }} />
                  <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{ugc.music.name}</span>
                  <button onClick={() => p.openUgcPick('music')} className="text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                  <button onClick={() => ugcMutate((u) => ({ ...u, music: null }))} title={t('ugc.common.remove')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t('ugc.music.volumeLabel')}</span>
                  <input type="range" min={0} max={100} step={5} value={ugc.music.volumePct}
                    onChange={(e) => { const v = Number(e.target.value); ugcMutate((u) => (u.music ? { ...u, music: { ...u.music, volumePct: v } } : u)); }}
                    className="flex-1" style={{ accentColor: ACC, height: 20 }} />
                  <b className="text-[11px]" style={{ color: ACC, fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}>{ugc.music.volumePct}%</b>
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.music.volumeHint')}</p>
                {/* Сколько играет: весь ролик (зациклится/обрежется) или только первые N секунд (затем затухание) */}
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.music.durationLabel')}</div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                  {([[null, t('ugc.music.playFull')], [15, t('ugc.music.playFirst')]] as [number | null, string][]).map(([v, lbl]) => {
                    const sel = (v === null) === !(Number(ugc.music?.durationSec) > 0);
                    return (
                      <button key={String(v)} onClick={() => ugcMutate((u) => (u.music ? { ...u, music: { ...u.music, durationSec: v === null ? null : (Number(u.music.durationSec) > 0 ? u.music.durationSec : 15) } } : u))}
                        className="py-1.5 rounded-lg text-[10.5px] font-700"
                        style={{ background: sel ? ACC : 'transparent', color: sel ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{lbl}</button>
                    );
                  })}
                </div>
                {Number(ugc.music.durationSec) > 0 && (
                  <div className="flex items-center gap-2">
                    <input type="number" min={3} step={1} value={Math.round(Number(ugc.music.durationSec))}
                      onChange={(e) => { const v = Math.max(3, Number(e.target.value) || 15); ugcMutate((u) => (u.music ? { ...u, music: { ...u.music, durationSec: v } } : u)); }}
                      className="px-2 py-1 rounded-md text-[11px] outline-none" style={{ width: 64, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', fontVariantNumeric: 'tabular-nums' }} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.music.durationHint')}</span>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => p.openUgcPick('music')} className="w-full py-2.5 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                <Music size={14} /> {t('ugc.music.empty')}
              </button>
            )}
          </Sec>

          {/* 7. Верхний слой: прозрачный PNG под формат (лого/рамка) — поверх видео, под субтитрами */}
          <Sec n={7} title={t('ugc.layer.title')} sub={t('ugc.layer.sub')} done={ugc.formats.some((f) => !!ugc.layers[f]) || ugc.progressBar}>
            <div className={ugc.formats.length > 1 ? 'grid grid-cols-2 gap-1.5' : 'space-y-1.5'}>
              {ugc.formats.map((f) => {
                const val = ugc.layers[f];
                const cap = ({ '9x16': '9:16', '16x9': '16:9', '1x1': '1:1', '4x5': '4:5' } as Record<UgcFormat, string>)[f];
                return val ? (
                  <div key={f} className="flex items-center gap-1.5 p-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <img src={val.url} alt="" className="rounded" style={{ width: 26, height: 26, objectFit: 'contain', background: 'repeating-conic-gradient(#3a3a42 0% 25%, #2a2a30 0% 50%) 0 0 / 10px 10px', flexShrink: 0 }} />
                    <span className="text-[10px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }} title={val.name}>{cap} · {val.name}</span>
                    <button onClick={() => ugcMutate((u) => { const layers = { ...u.layers }; delete layers[f]; return { ...u, layers }; })} title={t('ugc.common.remove')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}><X size={12} /></button>
                  </div>
                ) : (
                  <button key={f} onClick={() => p.openUgcPick(`layer_${f}` as UgcPickTarget as Exclude<UgcPickTarget, 'lineImage'>)} className="w-full py-2 rounded-lg text-[10.5px] font-600 inline-flex items-center justify-center gap-1"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                    <Plus size={11} /> {t('ugc.layer.empty', { format: cap })}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.layer.hint')}</p>
            <Toggle on={ugc.progressBar} title={t('ugc.layer.progressTitle')} sub={t('ugc.layer.progressSub')}
              onClick={() => ugcMutate((u) => ({ ...u, progressBar: !u.progressBar }))} />
          </Sec>

          {/* Чек-лист готовности */}
          <div className="rounded-xl p-3" style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-primary)' }}>
            <div className="text-[10px] font-700 uppercase mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.checklist.title')}</div>
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
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{t('ugc.checklist.serverNote')}</p>
          </div>

          {p.ugcNote && <p className="text-[11px] px-1" style={{ color: 'var(--text-secondary)' }}>{p.ugcNote}</p>}
        </div>

        {/* Канвас превью */}
        <div className="relative flex flex-col min-w-0 overflow-y-auto"
          style={{ background: 'var(--bg-primary)', backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1.4px)', backgroundSize: '19px 19px' }}>
          {/* тулбар формата и раскладки */}
          <div className="flex items-center gap-3 flex-wrap px-4 py-2.5">
            <span className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.05em' }}>{t('ugc.format.label')}</span>
            <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
              {/* Мультивыбор: клик добавляет/убирает формат (минимум один остаётся); порядок фиксированный. */}
              {([['9x16', t('ugc.format.portrait')], ['16x9', t('ugc.format.landscape')], ['1x1', t('ugc.format.square')], ['4x5', t('ugc.format.feed')]] as [UgcFormat, string][]).map(([k, lbl]) => {
                const sel = ugc.formats.includes(k);
                return (
                  <button key={k}
                    onClick={() => ugcMutate((u) => {
                      const on = u.formats.includes(k);
                      if (on && u.formats.length <= 1) return u;
                      const order: UgcFormat[] = ['9x16', '16x9', '1x1', '4x5'];
                      const next = on ? u.formats.filter((f) => f !== k) : order.filter((f) => f === k || u.formats.includes(f));
                      return { ...u, formats: next };
                    })}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-700"
                    style={{ background: sel ? 'rgba(168,85,247,.14)' : 'transparent', color: sel ? ACC : 'var(--text-muted)', border: sel ? `1px solid ${ACC}` : '1px solid transparent', cursor: 'pointer' }}>{lbl}</button>
                );
              })}
            </div>
            {mode === 'solo' && (
              <>
                <span className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.05em' }}>{t('ugc.layout.label')}</span>
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  {([['top', t('ugc.layout.top')], ['bottom', t('ugc.layout.bottom')], ['overlay-left', t('ugc.layout.overlayLeft')], ['overlay-right', t('ugc.layout.overlayRight')]] as [UgcSpec['placement'], string][]).map(([v, lbl]) => (
                    <button key={v} onClick={() => ugcMutate((u) => ({ ...u, placement: v }))} title={lbl} className="rounded-lg"
                      style={{ padding: 3, background: ugc.placement === v ? 'rgba(168,85,247,.14)' : 'transparent', border: `1px solid ${ugc.placement === v ? ACC : 'transparent'}`, cursor: 'pointer' }}>
                      <LayDia v={v} />
                    </button>
                  ))}
                </div>
                {(ugc.placement === 'overlay-left' || ugc.placement === 'overlay-right') && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.layout.overlayHint')}</span>
                )}
              </>
            )}
            {ugc.formats.length > 1 && (
              <span className="text-[10.5px] ml-auto" style={{ color: 'var(--text-muted)' }}>{t('ugc.format.filesPerRun', { count: ugc.formats.length })}</span>
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
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-700" style={{ color: ACC }}>{t('ugc.preview.seriesReady', { count: ugc.results.length })}</span>
                  <span className="inline-flex items-center gap-2">
                    <a href="/gallery" className="text-[11px] font-700 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(168,85,247,.14)', color: ACC, border: `1px solid ${ACC}`, textDecoration: 'none' }}>{t('ugc.preview.openGallery')}</a>
                    <button onClick={() => ugcMutate((u) => ({ ...u, result: null, results: [] }))} title={t('ugc.common.hide')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={15} /></button>
                  </span>
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
                  <span className="text-[12px] font-700" style={{ color: ACC }}>{t('ugc.preview.ready')}</span>
                  <span className="inline-flex items-center gap-2">
                    <a href="/gallery" className="text-[11px] font-700 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(168,85,247,.14)', color: ACC, border: `1px solid ${ACC}`, textDecoration: 'none' }}>{t('ugc.preview.openGallery')}</a>
                    <button onClick={() => ugcMutate((u) => ({ ...u, result: null }))} title={t('ugc.common.hide')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={15} /></button>
                  </span>
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
              ? t('ugc.preview.footerSolo')
              : t('ugc.preview.footerPlan')}
          </p>

          {/* прогресс сборки поверх канваса */}
          {building && (
            <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--bg-primary) 82%, transparent)', backdropFilter: 'blur(4px)' }}>
              <div className="rounded-2xl p-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', width: 330, boxShadow: '0 14px 34px rgba(0,0,0,.4)' }}>
                <div className="text-[13px] font-700 mb-0.5 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Loader2 size={15} className="animate-spin" style={{ color: ACC }} /> {t('ugc.progress.title')}
                </div>
                <div className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>{t('ugc.progress.note')}</div>
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
                <b className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{t('ugc.timeline.title')}</b>
                <span className="text-[10.5px]" style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{t('ugc.lines.count', { count: ugc.script.length, sec: Math.round(p.ugcScriptSec()) })}</span>
                <button onClick={() => setLinesOpen((o) => !o)} className="ml-auto text-[10.5px] font-700 px-2.5 py-1 rounded-lg"
                  style={{ background: linesOpen ? 'rgba(168,85,247,.14)' : 'var(--bg-tertiary)', color: linesOpen ? ACC : 'var(--text-secondary)', border: `1px solid ${linesOpen ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                  {linesOpen ? t('ugc.timeline.hideLines') : t('ugc.timeline.showLines')}
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
              {t('ugc.timeline.empty')}
            </p>
          )}
        </div>
      </div>

      {/* ── Пикеры Галереи (единый GalleryPicker сервиса) ── */}
      {p.ugcPick && p.ugcPick !== 'retBrolls' && (() => {
        const pick = p.ugcPick!;
        const isLayer = pick.startsWith('layer_');
        const isImg = pick === 'photo' || pick === 'photoB' || pick === 'avatarAdd' || isLayer;
        const title = pick === 'music' ? t('ugc.music.title')
          : pick === 'photo' ? t('ugc.picker.photoA')
          : pick === 'photoB' ? t('ugc.picker.photoB')
          : pick === 'recording' ? t('ugc.picker.recording')
          : pick === 'avatarAdd' ? t('ugc.picker.avatarAdd')
          : pick === 'lineImage' ? t('ugc.picker.lineImage')
          : pick === 'intro' ? t('ugc.picker.intro')
          : pick === 'outro' ? t('ugc.picker.outro')
          : isLayer ? t('ugc.picker.layer')
          : t('ugc.common.footage');
        return (
          <GalleryPicker
            open token={p.token}
            title={title}
            note={isLayer ? t('ugc.picker.layerNote') : (pick === 'intro' || pick === 'outro') ? t('ugc.picker.bumperNote') : undefined}
            defaultTab={pick === 'music' ? 'audio' : 'reference'}
            onClose={() => { p.setUgcPick(null); p.setUgcLineIdx(null); }}
            onUpload={(files) => p.uploadToGallery(files, pick === 'music' ? 'audio' : 'reference')}
            uploadAccept={pick === 'music' ? 'audio/*' : isLayer ? 'image/png,image/webp' : isImg ? 'image/*' : pick === 'lineImage' ? 'image/*,video/*' : pick === 'recording' ? 'audio/*,video/*' : 'video/*'}
            onlyType={isImg ? 'image' : pick === 'music' ? 'audio' : (pick === 'clip' || pick === 'intro' || pick === 'outro') ? 'video' : undefined}
            onPick={(it) => p.pickUgcItem({ url: it.fileUrl, name: it.title, type: (it.type === 'image' || it.type === 'audio' ? it.type : 'video') })}
          />
        );
      })()}
      {p.ugcPick === 'retBrolls' && (
        <GalleryPicker
          open multi token={p.token}
          title={t('ugc.picker.retBrollsTitle')}
          note={t('ugc.picker.retBrollsNote')}
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

      {/* ── Бренд-кит: применить/сохранить набор оформления ── */}
      {brandOpen && (
        <div onClick={() => setBrandOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl p-4" style={{ width: 'min(460px, 94vw)', maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: '0 14px 34px rgba(0,0,0,.4)' }}>
            <div className="flex items-center justify-between mb-1">
              <b className="text-[13.5px]" style={{ color: 'var(--text-primary)' }}>◆ {t('ugc.brand.title')}</b>
              <button onClick={() => setBrandOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>{t('ugc.brand.sub')}</p>
            {brandKits === null ? (
              <p className="text-[11px] py-3 text-center" style={{ color: 'var(--text-muted)' }}><Loader2 size={14} className="animate-spin inline" /> {t('ugc.brand.loading')}</p>
            ) : brandKits.length === 0 ? (
              <p className="text-[11px] py-2" style={{ color: 'var(--text-muted)' }}>{t('ugc.brand.empty')}</p>
            ) : (
              <div className="space-y-2 mb-3">
                {brandKits.map((k) => {
                  const parts: string[] = [];
                  if (k.data.layers && Object.keys(k.data.layers).length) parts.push(t('ugc.brand.chipLayer'));
                  if (k.data.intro || k.data.outro) parts.push(t('ugc.brand.chipBumpers'));
                  if (k.data.music) parts.push(t('ugc.brand.chipMusic'));
                  if (k.data.subtitles) parts.push(t('ugc.brand.chipSubtitles'));
                  if (k.data.voiceId) parts.push(t('ugc.brand.chipVoice'));
                  if (k.data.progressBar) parts.push(t('ugc.layer.progressTitle'));
                  return (
                    <div key={k.id} className="rounded-xl p-2.5" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-medium)' }}>
                      <div className="flex items-center gap-2">
                        <b className="text-[12px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{k.name}</b>
                        <button onClick={() => applyBrand(k)} className="text-[11px] font-700 px-2.5 py-1 rounded-lg"
                          style={{ background: 'rgba(168,85,247,.14)', color: ACC, border: `1px solid ${ACC}`, cursor: 'pointer' }}>{t('ugc.brand.apply')}</button>
                        <button onClick={() => void deleteBrand(k.id)} title={t('ugc.common.remove')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={13} /></button>
                      </div>
                      {parts.length > 0 && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{parts.join(' · ')}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => void saveBrand()} className="w-full py-2 rounded-xl text-[11.5px] font-650"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1.5px dashed var(--border-strong)', cursor: 'pointer' }}>
              ＋ {t('ugc.brand.saveCurrent')}
            </button>
            {brandNote && <p className="text-[10.5px] mt-2" style={{ color: '#f59e0b' }}>{brandNote}</p>}
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>{t('ugc.brand.note')}</p>
          </div>
        </div>
      )}

      {/* Удаление аватара из коллекции */}
      <ConfirmModal
        open={!!p.ugcDelAvatar}
        title={t('ugc.avatar.delTitle')}
        message={p.ugcDelAvatar ? t('ugc.avatar.delMessage', { name: p.ugcDelAvatar.name }) : ''}
        confirmLabel={t('ugc.common.remove')}
        cancelLabel={t('ugc.common.cancel')}
        variant="danger"
        onCancel={() => p.setUgcDelAvatar(null)}
        onConfirm={() => { if (p.ugcDelAvatar) void p.doDelUgcAvatar(p.ugcDelAvatar); }}
      />
    </div>
  );
}
