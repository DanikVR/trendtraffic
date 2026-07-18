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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, Loader2, Save, Wand2, Sparkles, Plus, RefreshCw, X,
  Mic, Paperclip, Scissors, Music, Video, Type, Layers, UserRound, ImagePlus,
  Pencil, Undo2, Redo2, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import DialogueTimeline from './DialogueTimeline';
import UgcPreview from './UgcPreview';
import UgcLinesPanel from './UgcLinesPanel';
import { GalleryPicker, type GalleryPickItem } from '../../components/GalleryPicker';
import { ConfirmModal } from '../../components/ConfirmModal';
import { VideoViewer } from '../../components/VideoViewer';
import { type UgcSpec, type UgcPickTarget, type UgcMode, type UgcFormat, ugcModeOf, syncClips, clipEffDur } from './ugcTypes';
import { parseCapWishes } from './ugcCapWishes';
import { SUPPORTED_LANGUAGES } from '../../config/i18n';
import { useTranslation } from 'react-i18next';

const ACC = '#a855f7';       // фирменный цвет блока UGC
const ACC2 = '#c084fc';

/* док таймлайна: высота тянется за ручку, помнится между сессиями */
const DOCK_H_KEY = 'tt_ugc_dock_h';
const DOCK_DEF = 236;        // прежний фиксированный maxHeight — остаётся дефолтом
const DOCK_MIN = 110;        // заголовок + верх таймлайна
const dockMax = () => Math.max(320, Math.round(window.innerHeight * 0.72));

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
  /* Итог/ошибка сборки — поп-ап под кнопкой «Создать видео» (заметку в подвале панели не замечали) */
  ugcCtaNote: { kind: 'error' | 'ok'; text: string } | null;
  onUgcCtaNote: (n: { kind: 'error' | 'ok'; text: string } | null) => void;
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
  // Имя ролика в топбаре (вместо статичного «UGC-студия») + инлайн-переименование.
  flowName: string;
  onRenameFlow: (v: string) => void;
  // Назад/вперёд (undo/redo истории редактора — включает правки UGC).
  undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean;
  // «Выход»: сохранить сценарий + апсертить шаблон (появится в Галерее) → закрыть.
  onExitSave: () => void | Promise<void>;
}

/* ── мелкие строительные блоки студии ── */

/* Имя файла в чипе: две строки мелким и обрез многоточием — длинные названия из Галереи
   («Снимок экрана 2026-07-08 в 14.03.12.png») раньше обрезались до бессмыслицы. */
const NAME_CLAMP: React.CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  overflow: 'hidden', wordBreak: 'break-word', lineHeight: 1.3,
};

/* Пустой слот выбора медиа: иконка в плашке → заголовок → подсказка (как в Canva),
   вместо прежней строки «иконка + длинный текст», которая разъезжалась при переносе. */
function EmptySlot({ icon, title, sub, onClick, pad }: { icon: React.ReactNode; title: string; sub?: string; onClick: () => void; pad?: number }) {
  return (
    <button onClick={onClick} className="w-full flex flex-col items-center justify-center gap-1 rounded-xl text-center"
      style={{ padding: `${pad ?? 12}px 10px`, background: 'var(--bg-secondary)', border: '1.5px dashed var(--border-strong)', cursor: 'pointer' }}>
      <span className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 28, height: 28, background: 'rgba(168,85,247,.10)', color: ACC }}>{icon}</span>
      <b className="text-[11.5px] font-650 leading-tight" style={{ color: 'var(--text-secondary)' }}>{title}</b>
      {sub && <span className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
    </button>
  );
}

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

/* Обложка тренда: подписанные CDN-ссылки TikTok/IG не грузятся кросс-доменно → через
   наш прокси /api/channels/cover (локальная копия хелпера из TrendSearch — не тянем его чанк). */
function coverSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/tiktokcdn|ibyteimg|byteimg|muscdn|tiktokv|pstatp|cdninstagram|fbcdn/i.test(url)) {
    return `/api/channels/cover?u=${encodeURIComponent(url)}`;
  }
  return url;
}

/* чип распознанного пожелания к стилю титров: подпись + образец цвета */
function WishChip({ label, color }: { label: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
      {color && <span style={{ width: 9, height: 9, borderRadius: 3, background: color, border: '1px solid rgba(127,127,127,.45)', display: 'inline-block' }} />}
      {label}
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

  /* ── синк «бегунок таймлайна ↔ готовое видео» (двусторонний скраб) ──
     Тащишь бегунок — видео мотается на ту же секунду; мотаешь/играешь видео — бегунок едет следом.
     tlDriveRef гасит эхо: сик, который мы сами задали с таймлайна, не шлём обратно в таймлайн. */
  const resultVidRef = useRef<HTMLVideoElement | null>(null);
  const [tlFollow, setTlFollow] = useState<{ t: number; k: number } | null>(null);
  const tlDriveRef = useRef<{ t: number; ts: number }>({ t: -1, ts: 0 });
  const onTimelineScrub = (tSec: number) => {
    const v = resultVidRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    tlDriveRef.current = { t: tSec, ts: Date.now() };
    try { v.currentTime = Math.max(0, Math.min(tSec, v.duration - 0.05)); } catch { /* до метаданных */ }
  };
  const onResultVideoTime = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const cur = e.currentTarget.currentTime;
    const d = tlDriveRef.current;
    if (Date.now() - d.ts < 500 && Math.abs(cur - d.t) < 0.35) return;   // наше же эхо
    setTlFollow((s) => ({ t: cur, k: (s?.k || 0) + 1 }));
  };

  /* «Мой текст как есть»: поле брифа → реплики БЕЗ ИИ-переработки. Абзацы/строки = реплики;
     один сплошной абзац режем по предложениям. Замещает скрипт (как и «Сгенерировать текст»). */
  const useBriefAsScript = () => {
    const raw = ugc.brief.trim();
    if (!raw) return;
    let parts = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 1) parts = raw.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    const lines = parts.slice(0, 80).map((text) => ({ speaker: 'A' as const, text }));
    if (!lines.length) return;
    ugcMutate((u) => ({ ...u, script: lines }));
  };

  /* ── «Видеоряд» из нескольких клипов: длительность у каждого, обрезка, редактор ── */
  const mmss = (s: number): string => { const m = Math.floor(s / 60); const ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, '0')}`; };
  // Длительность из метаданных <video> панели (единожды на клип); заодно зажимаем trimEnd.
  const setClipDuration = (i: number, d: number) => ugcMutate((u) => syncClips(u, u.clips.map((c, j) =>
    j === i ? { ...c, durationSec: d, ...(Number.isFinite(c.trimEnd) && (c.trimEnd as number) > d ? { trimEnd: d } : {}) } : c)));
  const removeClip = (i: number) => ugcMutate((u) => syncClips(u, u.clips.filter((_, j) => j !== i)));
  // Клик по клипу (тумба в панели или сегмент на таймлайне) → наш VideoViewer (обрезка/склейка).
  // Сохранение НЕразрушающее: новый файл замещает клип, обрезка дорожки сбрасывается.
  const [clipEditIdx, setClipEditIdx] = useState<number | null>(null);
  // Клик по сегменту «Аватар» (готовое видео) → тот же VideoViewer для видео-аватара.
  const [avatarEdit, setAvatarEdit] = useState(false);
  // Таймлайн живёт не только с репликами: видеоряд (обрезка клипов) и сегмент видео-аватара
  // редактируются на дорожках и ДО генерации текста / без него («Готовое видео» текста не имеет).
  // (mode/isVideoAv объявлены ниже — здесь считаем от спеки напрямую.)
  const hasTimeline = ugc.script.length > 0 || ugc.clips.length > 0
    || (!ugc.noAvatar && !ugc.dialogueEnabled && ugc.retentionPreset === 'off' && ugc.avatarSource === 'video' && !!ugc.avatarVideoUrl);

  /* ── высота дока таймлайна: ручка над доком, тянется вверх/вниз (просьба юзера «двигать больше»).
     Во время жеста высоту пишем прямо в DOM (без re-render на каждый move), в стейт и localStorage —
     на pointerup. Двойной клик по ручке — сброс к дефолту. */
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [dockH, setDockH] = useState<number>(() => {
    const v = Number(localStorage.getItem(DOCK_H_KEY) || '');
    return Number.isFinite(v) ? Math.min(Math.max(v, DOCK_MIN), dockMax()) : DOCK_DEF;
  });
  const [dockDrag, setDockDrag] = useState(false);
  const dragDock = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    e.preventDefault();
    // Захват указателя — жест не «залипает», когда курсор уходит на превью или за окно.
    try { el.setPointerCapture(e.pointerId); } catch { /* не критично */ }
    const h0 = dockH, sy = e.clientY;
    let last = h0;
    setDockDrag(true);
    const onMove = (ev: PointerEvent) => {
      last = Math.min(dockMax(), Math.max(DOCK_MIN, h0 + (sy - ev.clientY)));
      if (dockRef.current) dockRef.current.style.maxHeight = `${last}px`;
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      try { el.releasePointerCapture(e.pointerId); } catch { /* */ }
      setDockDrag(false);
      setDockH(last);
      try { localStorage.setItem(DOCK_H_KEY, String(Math.round(last))); } catch { /* приватный режим */ }
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };
  const dockReset = () => {
    setDockH(DOCK_DEF);
    try { localStorage.setItem(DOCK_H_KEY, String(DOCK_DEF)); } catch { /* */ }
  };

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
  // «Готовое видео-аватар» (соло): свой ролик с речью+мимикой внутри — HeyGen и озвучка не нужны.
  const isVideoAv = mode === 'solo' && ugc.avatarSource === 'video';
  const avatarOk = ugc.avatarSource === 'collection' ? !!ugc.avatarUrl
    : ugc.avatarSource === 'video' ? !!ugc.avatarVideoUrl
    : !!ugc.photoUrl;
  const voiceOk = isVideoAv
    ? true                                              // речь уже в готовом видео
    : mode === 'dialogue'
    ? ugc.script.length > 0
    : (ugc.script.length > 0 || (ugc.source === 'diarize' && !!ugc.recordingUrl));
  const hasFootage = ugc.clips.length > 0 || !!ugc.clip || ugc.clipImages.length > 0;   // видео ИЛИ фото-слайдшоу
  const videoOk = mode === 'retention' ? (hasFootage || ugc.retentionBrolls.length > 0) : (mode === 'voiceover' ? hasFootage : true);
  const checks: { label: string; ok: boolean; hint: string; miss: string }[] = [
    ...(mode !== 'voiceover' ? [{ label: ugc.avatarSource === 'collection' ? t('ugc.checklist.avatarChosen') : ugc.avatarSource === 'video' ? t('ugc.checklist.videoAvatarChosen') : t('ugc.checklist.photoChosen'), ok: avatarOk, hint: t('ugc.checklist.step', { n: 2 }), miss: ugc.avatarSource === 'collection' ? t('ugc.checklist.missAvatar') : ugc.avatarSource === 'video' ? t('ugc.checklist.missVideoAvatar') : t('ugc.checklist.missPhoto') }] : []),
    ...(mode === 'dialogue' ? [{ label: t('ugc.checklist.secondSpeaker'), ok: !!ugc.photoBUrl, hint: t('ugc.checklist.step', { n: 2 }), miss: t('ugc.checklist.missPhotoB') }] : []),
    ...(!isVideoAv ? [{ label: mode === 'dialogue' ? t('ugc.checklist.recordingDiarized') : t('ugc.checklist.scriptOrRecording'), ok: voiceOk, hint: t('ugc.checklist.step', { n: 3 }), miss: mode === 'dialogue' ? t('ugc.checklist.missDiarize') : t('ugc.checklist.missScript') }] : []),
    ...(mode === 'retention' || mode === 'voiceover' ? [{ label: t('ugc.checklist.videoChosen'), ok: videoOk, hint: t('ugc.checklist.step', { n: 4 }), miss: t('ugc.checklist.missVideo') }] : []),
  ];
  const allOk = checks.every((c) => c.ok) && (mode !== 'dialogue' || !!ugc.photoBUrl);
  const missing = checks.filter((c) => !c.ok).map((c) => c.miss).join(', ');

  /* серия языков (перевод Claude + TTS multilingual) — только ИИ-текст в соло/озвучке */
  const langsActive = !isVideoAv && ugc.source === 'gen' && (mode === 'solo' || mode === 'voiceover');
  const extraLangsCount = langsActive ? ugc.langs.filter((l) => l !== 'ru').length : 0;

  /* ── смета (ориентиры из докки UGC_AVATARS.md) ── */
  const costBase = mode === 'voiceover'
    ? (ugc.source === 'gen' ? t('ugc.cost.voiceoverAi') : t('ugc.cost.voiceoverFree'))
    : mode === 'retention'
      ? ({ off: '', eco: t('ugc.cost.perClip1_2'), bal: t('ugc.cost.perClip2_3'), prem: t('ugc.cost.perClip3_5') }[ugc.retentionPreset])
      : mode === 'dialogue'
        ? ({ eco: t('ugc.cost.perClip2'), bal: t('ugc.cost.perClip2_3'), dyn: t('ugc.cost.perClip3_5') }[ugc.dialogueEngagement])
        : isVideoAv ? t('ugc.cost.videoFree')
        : (ugc.faceProvider === 'heygen_ext' ? t('ugc.cost.perMin1') : t('ugc.cost.perMin3_4'));
  const costExtra = (mode === 'retention' && ugc.retentionBrolls.length > 1
    ? t('ugc.cost.seriesSuffix', { count: ugc.retentionBrolls.length })
    : (ugc.formats.length > 1 ? t('ugc.cost.filesSuffix') : ''))
    + (extraLangsCount > 0 ? t('ugc.cost.langsSuffix', { count: extraLangsCount + 1 }) : '');

  const scrollToSec = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  /* Пожелания к стилю титров: распознанные цвет/обводка/размер — чипы под полем + живой пример */
  const capWish = useMemo(() => parseCapWishes(ugc.subtitles.wishes), [ugc.subtitles.wishes]);
  const hasAvatarRects = Object.keys(ugc.avatarRects || {}).length > 0;
  /* Инлайн-переименование ролика в топбаре (карандаш → поле). */
  const [nameEdit, setNameEdit] = useState(false);

  /* ── голоса ElevenLabs аккаунта (включая ВАШИ загруженные/клонированные) для озвучки ИИ-текста ── */
  const [elVoices, setElVoices] = useState<{ id: string; name: string; preview: string | null; category: string | null }[] | null>(null);
  const [elNote, setElNote] = useState<string | null>(null);
  const [elLoading, setElLoading] = useState(false);
  const loadVoices = (fresh = false) => {
    setElLoading(true);
    void fetch(`/api/render/ugc/voices${fresh ? '?fresh=1' : ''}`, { headers: { ...(p.token ? { Authorization: `Bearer ${p.token}` } : {}) } })
      .then((r) => r.json())
      .then((d) => { setElVoices(Array.isArray(d?.voices) ? d.voices : []); setElNote(d?.note ? String(d.note) : null); })
      .catch(() => setElVoices([]))
      .finally(() => setElLoading(false));
  };
  useEffect(() => {
    if (ugc.source !== 'gen' || elVoices !== null) return;
    loadVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ugc.source, elVoices, p.token]);
  /* ── Готовые луки/фото-аватары аккаунта HeyGen (вкл. натренированные Personal Model) ──
     Список — по кнопке (GET heygen-avatars, нужен API-ключ HeyGen); выбор фиксируется через
     POST heygen-avatar-pick: превью скачивается к нам (подписанные URL HeyGen протухают),
     ложится в «Моё фото» + heygenLookId в спеку → рендер идёт по id, без заливки фото. */
  const [hgLooks, setHgLooks] = useState<{ id: string; name: string; preview: string; group?: string }[] | null>(null);
  const [hgLooksBusy, setHgLooksBusy] = useState<null | 'list' | 'pick'>(null);
  const [hgLooksNote, setHgLooksNote] = useState<string | null>(null);
  const loadHgLooks = () => {
    if (hgLooksBusy) return;
    setHgLooksBusy('list'); setHgLooksNote(null);
    void fetch('/api/render/ugc/heygen-avatars', { headers: { ...(p.token ? { Authorization: `Bearer ${p.token}` } : {}) } })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || t('sec.ugc.httpError', 'Ошибка {{status}}', { status: r.status }));
        const looks = Array.isArray(d?.looks) ? d.looks : [];
        setHgLooks(looks);
        if (!looks.length) setHgLooksNote(t('ugc.avatar.hgLooksEmpty', 'В аккаунте HeyGen пока нет фото-аватаров: создайте лук в кабинете HeyGen или загрузите фото как обычно.'));
      })
      .catch((e: any) => { setHgLooks([]); setHgLooksNote(String(e?.message || e)); })
      .finally(() => setHgLooksBusy(null));
  };
  const pickHgLook = (l: { id: string; name: string; preview: string }) => {
    if (hgLooksBusy === 'pick') return;
    setHgLooksBusy('pick'); setHgLooksNote(null);
    void fetch('/api/render/ugc/heygen-avatar-pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(p.token ? { Authorization: `Bearer ${p.token}` } : {}) },
      body: JSON.stringify({ id: l.id, name: l.name, preview: l.preview }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || t('sec.ugc.httpError', 'Ошибка {{status}}', { status: r.status }));
        ugcMutate((u) => ({ ...u, photoUrl: String(d.photoUrl), photoName: String(d.name || l.name), heygenLookId: String(d.heygenLookId || l.id) }));
      })
      .catch((e: any) => setHgLooksNote(String(e?.message || e)))
      .finally(() => setHgLooksBusy(null));
  };

  /* Категория голоса ElevenLabs → человекочитаемо (клонированный/встроенный/…). */
  const voiceCatLabel = (cat: string | null): string => {
    const key = (cat || '').toLowerCase();
    if (key === 'cloned' || key === 'professional') return t('ugc.voice.catCloned');
    if (key === 'generated') return t('ugc.voice.catGenerated');
    if (key === 'premade') return t('ugc.voice.catPremade');
    return cat || '';
  };
  const isMyVoice = (cat: string | null): boolean => ['cloned', 'professional', 'generated'].includes((cat || '').toLowerCase());
  const prevAudioRef = useRef<HTMLAudioElement | null>(null);
  const playPreview = (url: string) => {
    try { prevAudioRef.current?.pause(); const a = new Audio(url); prevAudioRef.current = a; void a.play(); } catch { /* превью не критично */ }
  };
  useEffect(() => () => { try { prevAudioRef.current?.pause(); } catch { /* */ } }, []);

  /* Языки серии = ВСЕ, что реально озвучивает наш конвейер: перевод Claude → ElevenLabs
     eleven_multilingual_v2 (29 языков). Родные названия берём из i18n (fallback — код).
     'ru' закреплён отдельно как основной, поэтому здесь его нет. */
  const TTS_LANG_CODES = ['en', 'es', 'de', 'fr', 'pt', 'it', 'nl', 'pl', 'sv', 'da', 'fi', 'cs', 'sk', 'hr', 'ro', 'bg', 'el', 'uk', 'tr', 'ar', 'hi', 'ta', 'ja', 'ko', 'zh', 'id', 'ms', 'tl'];
  const LANG_CHOICES: [string, string][] = TTS_LANG_CODES.map((code) => {
    const meta = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return [code, meta?.nativeName || code.toUpperCase()] as [string, string];
  });
  /* Язык автопубликации = те же 29 языков конвейера; здесь ru участвует наравне. */
  const AUTOPUB_LANG_CHOICES: [string, string][] = [
    ['ru', SUPPORTED_LANGUAGES.find((l) => l.code === 'ru')?.nativeName || 'Русский'],
    ...LANG_CHOICES,
  ];

  /* слой принимает только прозрачный PNG/WebP — заметка при попытке выбрать иное */
  const [layerNote, setLayerNote] = useState<string | null>(null);

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

  /* ── «Использовать анализ»: выбор разбора тренда (video_analyses) + галочки по блокам ── */
  const [anaOpen, setAnaOpen] = useState(false);
  const [anaList, setAnaList] = useState<any[] | null>(null);
  const openAnalysisPick = async () => {
    setAnaOpen(true);
    if (anaList !== null) return;
    try {
      const r = await fetch('/api/trends/analyses?limit=100', { headers: { ...(p.token ? { Authorization: `Bearer ${p.token}` } : {}) } });
      const d = await r.json().catch(() => ({}));
      setAnaList(Array.isArray(d?.analyses) ? d.analyses : []);
    } catch { setAnaList([]); }
  };
  const applyAnalysis = (a: any) => {
    const dna = a?.dna || {};
    ugcMutate((u) => {
      const title = String(a.title || dna.meta?.author || dna.hookType || t('sec.ugc.analysisFallbackName', 'разбор'));
      const next: UgcSpec = {
        ...u,
        analysis: {
          id: String(a.id),
          title,
          brief: String(dna.brief || ''),
          copyReadyScript: String(dna.copyReadyScript || ''),
          visualStyle: String(dna.visualStyle || ''),
          hookAnalysis: String(dna.hookAnalysis || ''),
          fileUrl: a.fileUrl || null,
        },
      };
      // Галочки применяются сразу: видео тренда → ПЕРВЫМ клипом Видеоряда, стиль титров → пожелания.
      if (u.analysisUse.video && a.fileUrl) {
        const rest = u.clips.filter((c) => c.url !== a.fileUrl);
        Object.assign(next, syncClips(next, [{ url: a.fileUrl, name: title }, ...rest].slice(0, 12)));
      }
      if (u.analysisUse.subtitles && dna.visualStyle && !u.subtitles.wishes.trim()) {
        next.subtitles = { ...u.subtitles, wishes: String(dna.visualStyle).slice(0, 180) };
      }
      return next;
    });
    setAnaOpen(false);
  };
  /* Галочки СИММЕТРИЧНЫ: включение применяет эффект, снятие — откатывает его,
     но только если поле всё ещё держит значение ИЗ анализа (ручные правки не трогаем). */
  const toggleAnaUse = (k: keyof UgcSpec['analysisUse']) => ugcMutate((u) => {
    const on = !u.analysisUse[k];
    const next: UgcSpec = { ...u, analysisUse: { ...u.analysisUse, [k]: on } };
    if (k === 'video') {
      if (on && u.analysis?.fileUrl) {
        const rest = u.clips.filter((c) => c.url !== u.analysis!.fileUrl);
        Object.assign(next, syncClips(next, [{ url: u.analysis.fileUrl, name: u.analysis.title || t('sec.ugc.trendFallbackName', 'тренд') }, ...rest].slice(0, 12)));
      }
      if (!on && u.analysis?.fileUrl) Object.assign(next, syncClips(next, u.clips.filter((c) => c.url !== u.analysis!.fileUrl)));
    }
    if (k === 'subtitles') {
      const styleWish = (u.analysis?.visualStyle || '').slice(0, 180);
      if (on && styleWish && !u.subtitles.wishes.trim()) next.subtitles = { ...u.subtitles, wishes: styleWish };
      if (!on && styleWish && u.subtitles.wishes === styleWish) next.subtitles = { ...u.subtitles, wishes: '' };
    }
    return next;
  });

  /* ── Шаблоны UGC: полный снимок спеки + ключевик (бейдж) + автопубликация ── */
  interface UgcTemplate { id: string; name: string; trendKeyword: string; spec: Record<string, any>; autopublish: Record<string, any> }
  const [tplOpen, setTplOpen] = useState(false);
  const [tpls, setTpls] = useState<UgcTemplate[] | null>(null);
  const [tplNote, setTplNote] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplKeyword, setTplKeyword] = useState('');
  const [watches, setWatches] = useState<{ id: string; keyword: string; platform: string; enabled: boolean }[] | null>(null);
  const loadTpls = async () => {
    try {
      const r = await fetch('/api/render/ugc/templates', { headers: authHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setTpls(Array.isArray(d?.templates) ? d.templates : []);
    } catch (e: any) { setTpls([]); setTplNote(String(e?.message || e)); }
    // Источники автопубликации: пока Тренды (автоанализ ключевиков); другие — позже.
    try {
      const r2 = await fetch('/api/trends/watches', { headers: authHeaders() });
      const d2 = await r2.json().catch(() => ({}));
      setWatches(r2.ok && Array.isArray(d2?.watches) ? d2.watches : []);
    } catch { setWatches([]); }
  };
  const openTpl = () => { setTplOpen(true); setTplNote(null); void loadTpls(); };
  const saveTpl = async () => {
    try {
      const name = tplName.trim() || `${t('ugc.tpl.defaultName')} ${new Date().toLocaleDateString()}`;
      const spec = { ...ugc, buildJobId: null, result: null, results: [] };
      const r = await fetch('/api/render/ugc/templates', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ name, trendKeyword: tplKeyword.trim(), spec }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setTplName(''); setTplKeyword('');
      await loadTpls();
    } catch (e: any) { setTplNote(String(e?.message || e)); }
  };
  const applyTpl = (k: UgcTemplate) => {
    ugcMutate((u) => ({ ...u, ...(k.spec as Partial<UgcSpec>), buildJobId: null, result: null, results: [] }));
    setTplOpen(false);
  };
  const patchTplAutopub = async (k: UgcTemplate, ap: Record<string, any>) => {
    try {
      const r = await fetch(`/api/render/ugc/templates/${k.id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ autopublish: ap }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setTpls((prev) => (prev || []).map((x) => (x.id === k.id ? { ...x, autopublish: ap } : x)));
    } catch (e: any) { setTplNote(String(e?.message || e)); }
  };
  const deleteTpl = async (id: string) => {
    try {
      await fetch(`/api/render/ugc/templates/${id}`, { method: 'DELETE', headers: authHeaders() });
      await loadTpls();
    } catch { /* мягко */ }
  };

  /* Esc: закрывает модалки (шаблоны → анализ → бренд) → иначе студию */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (nameEdit) return;   // Esc в поле имени обрабатывает само поле
      if (tplOpen) { setTplOpen(false); return; }
      if (anaOpen) { setAnaOpen(false); return; }
      if (brandOpen) { setBrandOpen(false); return; }
      if (!p.ugcPick && !p.ugcDelAvatar) void p.onExitSave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* Поп-ап УСПЕХА под CTA гаснет сам; ошибка висит, пока не закроют или не запустят снова */
  useEffect(() => {
    if (p.ugcCtaNote?.kind !== 'ok') return;
    const id = window.setTimeout(() => p.onUgcCtaNote(null), 8000);
    return () => window.clearTimeout(id);
  }, [p.ugcCtaNote, p.onUgcCtaNote]);

  return (
    <div className="ugc-studio" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Палитра кадра превью: на светлой теме рамки СВЕТЛЫЕ (не чёрный «телевизор»),
          на тёмной — прежние тёмные. Тема сервиса = класс .dark на <html>. */}
      <style>{`
        .ugc-studio{--ugcf-bg:#eceef4;--ugcf-cell:#e4e7ef;--ugcf-title:#5a626f;--ugcf-sub:#8b93a1;--ugcf-dash:#b4bbc9;--ugcf-veil:rgba(255,255,255,.55);--ugcf-chk1:#d8dbe3;--ugcf-chk2:#c9cdd8;--ugcf-shadow:0 14px 34px rgba(35,42,70,.16)}
        .dark .ugc-studio{--ugcf-bg:#101013;--ugcf-cell:#101013;--ugcf-title:#a3a3ad;--ugcf-sub:#77777f;--ugcf-dash:#5c5c66;--ugcf-veil:rgba(0,0,0,.35);--ugcf-chk1:#3a3a42;--ugcf-chk2:#2a2a30;--ugcf-shadow:0 14px 34px rgba(0,0,0,.35)}
      `}</style>
      {/* ── Топбар ── */}
      <div className="flex items-center gap-2.5 px-3.5 flex-shrink-0" style={{ height: 54, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-medium)' }}>
        {/* Выход = сохранить сценарий + шаблон (появится в Галерее) → закрыть */}
        <button onClick={() => void p.onExitSave()} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-600"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          title={t('ugc.topbar.exitTooltip')}>
          <ArrowLeft size={15} /> {t('ugc.topbar.back')}
        </button>
        {/* Название ролика + карандаш (инлайн-переименование) вместо статичного «UGC-студия» */}
        {nameEdit ? (
          <input autoFocus value={p.flowName}
            onChange={(e) => p.onRenameFlow(e.target.value)}
            onBlur={() => setNameEdit(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setNameEdit(false); }}
            className="text-[14px] font-700 px-2 py-1 rounded-lg outline-none"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: `1px solid ${ACC}`, maxWidth: 300 }} />
        ) : (
          <button onClick={() => setNameEdit(true)} title={t('ugc.topbar.renameTooltip')}
            className="inline-flex items-center gap-1.5 text-[14px] font-700 min-w-0"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <span className="truncate" style={{ maxWidth: 260 }}>{p.flowName || t('ugc.topbar.untitled')}</span>
            <Pencil size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        )}
        {/* Назад/вперёд (undo/redo) */}
        <div className="flex items-center gap-1 ml-1">
          <button onClick={p.undo} disabled={!p.canUndo} title={t('ugc.topbar.undo')}
            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-40"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: p.canUndo ? 'pointer' : 'not-allowed' }}><Undo2 size={14} /></button>
          <button onClick={p.redo} disabled={!p.canRedo} title={t('ugc.topbar.redo')}
            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-40"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: p.canRedo ? 'pointer' : 'not-allowed' }}><Redo2 size={14} /></button>
        </div>
        <div className="flex-1" />
        <button onClick={() => void p.ugcSaveNow()} disabled={p.saving} className="inline-flex items-center gap-1.5 text-[11.5px] font-600 px-2.5 py-1.5 rounded-lg disabled:opacity-60"
          style={{ background: 'var(--bg-tertiary)', color: p.ugcSavedFlash ? '#22c55e' : 'var(--text-secondary)', border: `1px solid ${p.ugcSavedFlash ? 'rgba(34,197,94,.5)' : 'var(--border-medium)'}`, cursor: 'pointer' }}
          title={t('ugc.topbar.saveTooltip')}>
          {p.saving ? <Loader2 size={13} className="animate-spin" /> : p.ugcSavedFlash ? <Check size={13} /> : <Save size={13} />}
          {p.saving ? t('ugc.topbar.saving') : p.ugcSavedFlash ? t('ugc.topbar.saved') : t('ugc.topbar.save')}
        </button>
        <button onClick={openTpl} title={t('ugc.tpl.tooltip')}
          className="text-[11px] px-2.5 py-1.5 rounded-full font-600"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ▦ {t('ugc.tpl.button')}
        </button>
        <button onClick={openBrand} title={t('ugc.brand.tooltip')}
          className="text-[11px] px-2.5 py-1.5 rounded-full font-600"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ◆ {t('ugc.brand.button')}
        </button>
        <span className="text-[11px] px-2.5 py-1.5 rounded-full" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {costBase}{costExtra}
        </span>
        {/* CTA намеренно НЕ disabled при неполном чек-листе: клик обязан объяснить, чего не хватает
            (было: disabled → клик молчал, ошибка сборки пряталась в подвале панели — фидбэк 14.07) */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => {
              if (building) return;
              if (!allOk) { p.onUgcCtaNote({ kind: 'error', text: t('ugc.topbar.ctaTooltipMissing', { missing }) }); return; }
              void p.ugcBuildStart();
            }}
            title={allOk ? t('ugc.topbar.ctaTooltipReady') : t('ugc.topbar.ctaTooltipMissing', { missing })}
            className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2 rounded-xl"
            style={{ background: `linear-gradient(135deg,${ACC},${ACC2})`, color: '#fff', border: 'none', opacity: building || !allOk ? .5 : 1, cursor: allOk && !building ? 'pointer' : 'not-allowed' }}>
            {building ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {building ? t('ugc.topbar.creating') : t('ugc.topbar.create')}
          </button>
          {/* Поп-ап итога/ошибки сборки — прямо под кнопкой, не потерять */}
          {p.ugcCtaNote && !building && (
            <div className="absolute flex items-start gap-2 p-3 rounded-xl"
              style={{ top: 'calc(100% + 10px)', right: 0, width: 340, zIndex: 90, background: 'var(--bg-secondary)',
                border: `1px solid ${p.ugcCtaNote.kind === 'error' ? 'rgba(239,68,68,.55)' : 'rgba(34,197,94,.55)'}`,
                boxShadow: 'var(--ugcf-shadow)' }}>
              {p.ugcCtaNote.kind === 'error'
                ? <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
                : <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />}
              <div className="flex-1 text-[12px] leading-snug" style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{p.ugcCtaNote.text}</div>
              <button onClick={() => p.onUgcCtaNote(null)} title={t('ugc.common.remove')} className="flex-shrink-0"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* ── Корпус: панель шагов + превью (рейл сжимается на узких экранах) ── */}
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: 'minmax(292px, 348px) minmax(0, 1fr)' }}>
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

          {/* ✨ Анализ тренда: формула успеха разбора → в блоки студии (гибко, галочками).
              Без номера шага — он ОПЦИОНАЛЬНЫЙ и влияет сразу на несколько блоков. */}
          <div className="rounded-xl p-3 space-y-2" style={{ border: `1px solid ${ugc.analysis ? 'rgba(168,85,247,.45)' : 'var(--border-medium)'}`, background: 'var(--bg-primary)' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={13} style={{ color: ACC, flexShrink: 0 }} />
              <b className="text-[12.5px]" style={{ color: 'var(--text-primary)' }}>{t('ugc.analysis.title')}</b>
              <span className="text-[10.5px] ml-auto" style={{ color: 'var(--text-muted)' }}>{t('ugc.analysis.sub')}</span>
            </div>
            {ugc.analysis ? (
              <>
                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(168,85,247,.08)', border: '1px solid rgba(168,85,247,.35)' }}>
                  <span className="text-[11px] flex-1 min-w-0 font-650" style={{ color: ACC, ...NAME_CLAMP }} title={ugc.analysis.title}>{ugc.analysis.title}</span>
                  <button onClick={openAnalysisPick} className="text-[11px] px-2 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                  <button onClick={() => ugcMutate((u) => {
                    // Убрали разбор — откатываем и его следы (если поля не правились руками).
                    const styleWish = (u.analysis?.visualStyle || '').slice(0, 180);
                    const cleaned = u.analysis?.fileUrl ? u.clips.filter((c) => c.url !== u.analysis!.fileUrl) : u.clips;
                    return syncClips({
                      ...u, analysis: null,
                      subtitles: styleWish && u.subtitles.wishes === styleWish ? { ...u.subtitles, wishes: '' } : u.subtitles,
                    }, cleaned);
                  })} title={t('ugc.common.remove')} className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                </div>
                {/* Галочки: что именно подмешивать. Каждая включается/выключается независимо. */}
                <div className="space-y-1">
                  {([
                    ['script', t('ugc.analysis.useScript'), t('ugc.analysis.useScriptSub')],
                    ['video', t('ugc.analysis.useVideo'), t('ugc.analysis.useVideoSub')],
                    ['subtitles', t('ugc.analysis.useSubtitles'), t('ugc.analysis.useSubtitlesSub')],
                    ['retention', t('ugc.analysis.useRetention'), t('ugc.analysis.useRetentionSub')],
                  ] as [keyof UgcSpec['analysisUse'], string, string][]).map(([k, lbl, sub]) => (
                    <label key={k} className="flex items-start gap-2 p-1.5 rounded-lg" style={{ cursor: 'pointer', background: ugc.analysisUse[k] ? 'rgba(168,85,247,.06)' : 'transparent' }}>
                      <input type="checkbox" checked={ugc.analysisUse[k]} onChange={() => toggleAnaUse(k)} style={{ marginTop: 2, accentColor: ACC }} />
                      <span className="text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
                        <b className="font-650">{lbl}</b><br />
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <EmptySlot icon={<Sparkles size={14} />} title={t('ugc.analysis.empty')} sub={t('ugc.analysis.emptySub')} onClick={() => void openAnalysisPick()} />
            )}
          </div>

          {/* 2. Аватар */}
          {mode !== 'voiceover' && (
          <div id="ugc-sec-avatar">
          <Sec n={2} title={t('ugc.avatar.title')} sub={t('ugc.avatar.sub')} done={avatarOk && (mode !== 'dialogue' || !!ugc.photoBUrl)}>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
              {([['collection', t('ugc.avatar.sourceCollection')], ['photo', t('ugc.avatar.sourcePhoto')], ['video', t('ugc.avatar.sourceVideo')]] as [UgcSpec['avatarSource'], string][]).map(([s, lbl]) => {
                // «Коллекция» и «Готовое видео» — только в режиме «Один ведущий» (solo).
                const locked = (s === 'collection' || s === 'video') && mode !== 'solo';
                return (
                  <button key={s} disabled={locked} onClick={() => ugcMutate((u) => ({ ...u, avatarSource: s }))}
                    title={locked ? (s === 'video' ? t('ugc.avatar.videoLocked') : t('ugc.avatar.collectionLocked')) : undefined}
                    className="py-2 rounded-lg text-[11px] font-600 disabled:opacity-40"
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
                <input value={p.ugcAvBrief} onChange={(e) => p.setUgcAvBrief(e.target.value)}
                  placeholder={t('ugc.avatar.briefPlaceholder')}
                  className="w-full px-2.5 py-2 rounded-lg text-[11px] outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                <button onClick={p.genUgcAvatars} disabled={p.ugcBusy === 'avatars'} className="w-full py-2.5 rounded-xl text-[11.5px] font-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ background: 'rgba(168,85,247,0.14)', color: ACC, border: '1px solid rgba(168,85,247,0.4)', cursor: 'pointer' }}>
                  {p.ugcBusy === 'avatars' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {t('ugc.avatar.gen3')}
                </button>
                <div className="flex gap-1.5">
                  <button onClick={() => p.openUgcPick('avatarAdd')} className="flex-1 py-2 rounded-xl text-[11px] font-600 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1.5px dashed var(--border-strong)', cursor: 'pointer' }}>
                    <Plus size={13} /> {t('ugc.avatar.pickFromGallery')}
                  </button>
                  <button onClick={() => p.loadUgcAvatars(true)} disabled={p.ugcAvLoading} title={t('ugc.avatar.refresh')} className="rounded-xl inline-flex items-center justify-center disabled:opacity-60"
                    style={{ width: 36, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                    {p.ugcAvLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  </button>
                </div>
                {p.ugcAvNote && <p className="text-[11px]" style={{ color: '#f59e0b' }}>{p.ugcAvNote}</p>}
              </div>
            ) : ugc.avatarSource === 'video' ? (
              /* Готовое видео-аватар: свой ролик (речь+мимика внутри) → прямо в кадр, без HeyGen. */
              <div className="space-y-2">
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.avatar.videoHeading')}</div>
                {ugc.avatarVideoUrl ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <video src={`${ugc.avatarVideoUrl}#t=0.1`} muted playsInline preload="metadata" className="rounded-md object-cover flex-shrink-0" style={{ width: 52, height: 68, background: '#000' }}
                      onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0 && Math.abs((ugc.avatarVideoDurationSec || 0) - d) > 0.05) ugcMutate((u) => ({ ...u, avatarVideoDurationSec: Math.round(d * 10) / 10 })); }} />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="text-[11px]" style={{ color: 'var(--text-secondary)', ...NAME_CLAMP }} title={ugc.avatarVideoName || undefined}>{ugc.avatarVideoName || t('ugc.avatar.videoChosenName')}</div>
                      {Number(ugc.avatarVideoDurationSec) > 0 && (
                        <div className="text-[10px] font-650" style={{ color: ACC, fontVariantNumeric: 'tabular-nums' }}>{mmss(ugc.avatarVideoDurationSec as number)}</div>
                      )}
                    </div>
                    <button onClick={() => p.openUgcPick('avatarVideo')} className="text-[11px] px-2 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                    <button onClick={() => ugcMutate((u) => ({ ...u, avatarVideoUrl: null, avatarVideoName: null, avatarVideoDurationSec: null, avatarVideoStartSec: 0, result: null }))} title={t('ugc.common.remove')} className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                ) : (
                  <EmptySlot icon={<Video size={14} />} title={t('ugc.avatar.videoEmptyTitle')} sub={t('ugc.video.emptySub')} onClick={() => p.openUgcPick('avatarVideo')} />
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.avatar.videoHint')}</p>
                {ugc.avatarVideoUrl && ugc.clips.length > 0 && (
                  <p className="text-[10px]" style={{ color: '#f59e0b' }}>{t('ugc.avatar.videoTimelineHint', 'Длину ролика задаёт видеоряд. Когда аватар появится в кадре и заговорит — двигайте оранжевый сегмент «Аватар» на таймлайне внизу; клик по нему — обрезка в редакторе.')}</p>
                )}
                <label className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  <input type="checkbox" checked={ugc.avatarVideoCutout} onChange={(e) => ugcMutate((u) => ({ ...u, avatarVideoCutout: e.target.checked }))} style={{ accentColor: ACC, width: 15, height: 15 }} />
                  <span className="text-[11px] font-600 flex-1" style={{ color: 'var(--text-secondary)' }}>{t('ugc.avatar.videoCutout')}</span>
                </label>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.avatar.videoCutoutHint')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{mode === 'dialogue' ? t('ugc.avatar.speakerAHeading') : t('ugc.avatar.yourPhotoHeading')}</div>
                {ugc.photoUrl ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <img src={ugc.photoUrl} alt="" className="rounded-md object-cover flex-shrink-0" style={{ width: 52, height: 68 }} />
                    <span className="text-[11px] flex-1 min-w-0" style={{ color: 'var(--text-secondary)', ...NAME_CLAMP }} title={ugc.photoName || undefined}>{ugc.photoName || t('ugc.avatar.photoChosenName')}</span>
                    <button onClick={() => p.openUgcPick('photo')} className="text-[11px] px-2 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                    <button onClick={() => ugcMutate((u) => ({ ...u, photoUrl: null, photoName: null, heygenLookId: null }))} title={t('ugc.common.remove')} className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                ) : (
                  <EmptySlot icon={<UserRound size={14} />} title={t('ugc.avatar.photoEmptyTitle')} sub={t('ugc.video.emptySub')} onClick={() => p.openUgcPick('photo')} />
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.avatar.photoHint')}</p>

                {/* Готовый аватар из аккаунта HeyGen (вкл. натренированные Personal Model):
                    рендер идёт по id лука — фото не заливается, слоты фото-аватаров не тратятся.
                    Обычная загрузка одного фото выше остаётся как была. */}
                {ugc.heygenLookId && (
                  <p className="text-[10px]" style={{ color: '#0E9E77' }}>{t('ugc.avatar.hgLookActive', 'Выбран готовый аватар HeyGen — фото не заливается, слоты не тратятся. Замена фото выключает его.')}</p>
                )}
                <button onClick={loadHgLooks} disabled={hgLooksBusy === 'list'} className="w-full py-2 rounded-xl text-[11px] font-650 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ background: 'var(--bg-secondary)', border: '1.5px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  {hgLooksBusy === 'list' ? <Loader2 size={12} className="animate-spin" /> : <UserRound size={12} />} {t('ugc.avatar.hgLooksBtn', 'Выбрать готовый аватар из HeyGen')}
                </button>
                {hgLooksNote && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{hgLooksNote}</p>}
                {hgLooks && hgLooks.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {hgLooks.map((l) => (
                      <button key={l.id} onClick={() => pickHgLook(l)} disabled={hgLooksBusy === 'pick'} title={l.group ? `${l.name} · ${l.group}` : l.name}
                        className="relative rounded-lg overflow-hidden disabled:opacity-60"
                        style={{ aspectRatio: '3 / 4', border: `2px solid ${ugc.heygenLookId === l.id ? ACC : 'var(--border-medium)'}`, padding: 0, background: 'var(--bg-secondary)', cursor: 'pointer' }}>
                        <img src={l.preview} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25'; }} />
                        {ugc.heygenLookId === l.id && <span className="absolute flex items-center justify-center rounded-full" style={{ top: 3, right: 3, width: 16, height: 16, background: ACC, color: '#fff' }}><Check size={10} /></span>}
                      </button>
                    ))}
                  </div>
                )}
                {mode === 'dialogue' && (
                  <>
                    <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.avatar.speakerBHeading')}</div>
                    {ugc.photoBUrl ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                        <img src={ugc.photoBUrl} alt="" className="rounded-md object-cover flex-shrink-0" style={{ width: 44, height: 58 }} />
                        <span className="text-[11px] flex-1 min-w-0" style={{ color: 'var(--text-secondary)', ...NAME_CLAMP }} title={ugc.photoBName || undefined}>{ugc.photoBName || t('ugc.avatar.photoBName')}</span>
                        <button onClick={() => p.openUgcPick('photoB')} className="text-[11px] px-2 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                        <button onClick={() => ugcMutate((u) => ({ ...u, photoBUrl: null, photoBName: null }))} title={t('ugc.common.remove')} className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                    ) : (
                      <EmptySlot icon={<UserRound size={14} />} title={t('ugc.avatar.photoEmptyTitle')} sub={t('ugc.preview.emptyClickToChoose')} pad={9} onClick={() => p.openUgcPick('photoB')} />
                    )}
                  </>
                )}
              </div>
            )}
            {/* Оживление лица (HeyGen) — только для фото/коллекции; готовое видео уже с мимикой. */}
            {ugc.avatarSource !== 'video' && (
            <div className="space-y-1.5">
              {/* ИИ-вырезка фона (соло, фото/коллекция): HeyGen оживляет на ЗЕЛЁНОМ фоне →
                  рендер убирает его chroma-key — поверх кадра остаётся только силуэт человека. */}
              {mode === 'solo' && (
                <>
                  <label className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <input type="checkbox" checked={ugc.avatarCutout} onChange={(e) => ugcMutate((u) => ({ ...u, avatarCutout: e.target.checked }))} style={{ accentColor: ACC, width: 15, height: 15 }} />
                    <span className="text-[11px] font-600 flex-1" style={{ color: 'var(--text-secondary)' }}>{t('ugc.avatar.aiCutout')}</span>
                  </label>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.avatar.aiCutoutHint')}</p>
                </>
              )}
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
            )}
          </Sec>
          </div>
          )}

          {/* 3. Голос и текст — скрыт для «Готового видео» (речь уже внутри ролика) */}
          {!isVideoAv && (
          <div id="ugc-sec-voice">
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
                {/* Голоса ElevenLabs аккаунта (включая ВАШИ клонированные/загруженные); ▶ — образец */}
                {elVoices && elVoices.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '.04em' }}>{t('ugc.voice.elevenLabel')}</div>
                      <button onClick={() => loadVoices(true)} disabled={elLoading} title={t('ugc.voice.reloadTooltip')}
                        className="inline-flex items-center gap-1 text-[9.5px] font-650 px-1.5 py-0.5 rounded-md"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', cursor: elLoading ? 'default' : 'pointer' }}>
                        {elLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} {t('ugc.voice.reload')}
                      </button>
                    </div>
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
                              <span className="text-[11px] font-650 truncate inline-flex items-center gap-1" style={{ color: on ? ACC : 'var(--text-secondary)', maxWidth: '100%' }}>
                                <span className="truncate">{v.name}</span>
                                {isMyVoice(v.category) && <span className="flex-shrink-0 text-[8px] font-750 px-1 py-px rounded" style={{ background: 'rgba(168,85,247,.16)', color: ACC, letterSpacing: '.02em' }}>{t('ugc.voice.yourBadge')}</span>}
                              </span>
                              {v.category && <span className="text-[9.5px] block" style={{ color: 'var(--text-muted)' }}>{voiceCatLabel(v.category)}</span>}
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
                {/* готовый текст БЕЗ ИИ: поле выше → реплики как есть (по строкам/предложениям) */}
                <button onClick={useBriefAsScript} disabled={p.ugcBusy === 'dialogue' || !ugc.brief.trim()}
                  className="w-full py-2 rounded-xl text-[12px] font-650 inline-flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1.5px dashed var(--border-strong)', cursor: 'pointer' }}>
                  <Type size={13} /> {t('ugc.voice.useAsIs')}
                </button>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.voice.useAsIsHint')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ugc.recordingUrl ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <Music size={15} className="flex-shrink-0" style={{ color: ACC }} />
                    <span className="text-[11px] flex-1 min-w-0" style={{ color: 'var(--text-secondary)', ...NAME_CLAMP }} title={ugc.recordingName || undefined}>{ugc.recordingName || t('ugc.voice.recordingName')}</span>
                    <button onClick={() => ugcMutate((u) => ({ ...u, recordingUrl: null, recordingName: null, script: [], result: null }))} title={t('ugc.voice.removeRecording')} className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
                  </div>
                ) : (
                  <EmptySlot icon={<Paperclip size={14} />} title={t('ugc.voice.recordingEmptyTitle')} sub={t('ugc.voice.recordingEmptySub')} onClick={() => p.openUgcPick('recording')} />
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
                <div className="flex gap-1 flex-wrap" style={{ maxHeight: 132, overflowY: 'auto' }}>
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
                <p className="text-[9.5px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.voice.langsAllHint')}</p>
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
          </div>
          )}

          {/* 4. Видеоряд */}
          <Sec n={4} title={t('ugc.video.title')} sub={t('ugc.video.sub')} done={hasFootage || (mode === 'retention' && ugc.retentionBrolls.length > 0)}>
            {ugc.clips.length ? (
              <div className="space-y-1.5">
                {ugc.clips.map((c, i) => {
                  const hasDur = Number.isFinite(c.durationSec) && (c.durationSec as number) > 0;
                  const trimmed = (c.trimStart || 0) > 0.05 || (hasDur && Number.isFinite(c.trimEnd) && (c.trimEnd as number) > 0 && (c.trimEnd as number) < (c.durationSec as number) - 0.05);
                  return (
                    <div key={c.url + i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                      {ugc.clips.length > 1 && <span className="text-[10px] font-700 flex-shrink-0" style={{ color: 'var(--text-muted)', width: 11, textAlign: 'center' }}>{i + 1}</span>}
                      <video src={`${c.url}#t=0.1`} muted preload="metadata"
                        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0 && Math.abs((c.durationSec || 0) - d) > 0.05) setClipDuration(i, Math.round(d * 10) / 10); }}
                        onClick={() => setClipEditIdx(i)} title={t('ugc.video.editClip', 'Открыть в редакторе — обрезка/нарезка')}
                        className="rounded-lg flex-shrink-0" style={{ width: 44, height: 78, objectFit: 'cover', background: 'var(--bg-tertiary)', cursor: 'pointer' }} />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="text-[11px]" style={{ color: 'var(--text-secondary)', ...NAME_CLAMP }} title={c.name}>{c.name}</div>
                        {/* время ролика — сразу возле него; у обрезанного видно взятый кусок */}
                        <div className="text-[10px] font-650" style={{ color: ACC, fontVariantNumeric: 'tabular-nums' }}>
                          {hasDur
                            ? (trimmed
                              ? t('ugc.video.durTrimmed', '{{from}}–{{to}} из {{full}}', { from: mmss(c.trimStart || 0), to: mmss((Number.isFinite(c.trimEnd) && (c.trimEnd as number) > 0 ? c.trimEnd : c.durationSec) as number), full: mmss(c.durationSec as number) })
                              : mmss(c.durationSec as number))
                            : '…'}
                        </div>
                      </div>
                      <button onClick={() => removeClip(i)} title={t('ugc.common.remove')} className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                  );
                })}
                {ugc.clips.length < 12 && (
                  <button onClick={() => p.openUgcPick('clip')} className="w-full py-1.5 rounded-lg text-[11px] font-650 inline-flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--bg-secondary)', color: ACC, border: '1.5px dashed var(--border-strong)', cursor: 'pointer' }}>
                    <Plus size={12} /> {t('ugc.video.addMore', 'Добавить видео')}
                  </button>
                )}
                {ugc.clips.length > 1 && (
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {t('ugc.video.multiHint', 'Несколько видео идут друг за другом · всего {{dur}}. Обрезка — на дорожке «Видеоряд» таймлайна внизу.', { dur: mmss(ugc.clips.reduce((s, c) => s + clipEffDur(c, ugc.clipSpeedPct), 0)) })}
                  </p>
                )}
              </div>
            ) : (
              <EmptySlot icon={<Video size={14} />} title={t('ugc.video.emptyTitle')} sub={t('ugc.video.emptySub')} onClick={() => p.openUgcPick('clip')} />
            )}
            {/* Фото-слайдшоу: 1 фото = статичный кадр, несколько = перелистываются по кругу.
                Собирается бэкендом в клип пре-шагом сборки; при выбранном видео игнорируется. */}
            {ugc.clipImages.length ? (
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                <img src={ugc.clipImages[0].url} alt="" className="rounded-md object-cover flex-shrink-0" style={{ width: 40, height: 40 }} />
                <span className="text-[11px] flex-1 min-w-0" style={{ color: 'var(--text-secondary)', ...NAME_CLAMP }}>
                  {ugc.clipImages.length === 1 ? t('ugc.video.photosOne') : t('ugc.video.photosCount', { count: ugc.clipImages.length })}
                </span>
                <button onClick={() => p.openUgcPick('clipImages')} className="text-[11px] px-2 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                <button onClick={() => ugcMutate((u) => ({ ...u, clipImages: [] }))} title={t('ugc.common.remove')} className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
              </div>
            ) : (
              <EmptySlot icon={<ImagePlus size={14} />} title={t('ugc.video.photosTitle')} sub={t('ugc.video.photosSub')} pad={8} onClick={() => p.openUgcPick('clipImages')} />
            )}
            {ugc.clip && ugc.clipImages.length > 0 && (
              <p className="text-[10px]" style={{ color: '#f59e0b' }}>{t('ugc.video.photosVsVideo')}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {([['cover', t('ugc.video.fitCover')], ['contain', t('ugc.video.fitContain')]] as ['cover' | 'contain', string][]).map(([f, lbl]) => (
                  <button key={f} onClick={() => ugcMutate((u) => ({ ...u, clipFit: f }))} className="text-[10px] font-600 px-2 py-1 rounded-md"
                    style={{ background: ugc.clipFit === f ? ACC : 'var(--bg-secondary)', color: ugc.clipFit === f ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.clipFit === f ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
                ))}
              </div>
              {/* «звук из видео» неуместен, когда видеоряд — беззвучное фото-слайдшоу */}
              {(ugc.clip || !ugc.clipImages.length) && (
                <label className="text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!ugc.clipMuted} onChange={(e) => ugcMutate((u) => ({ ...u, clipMuted: !e.target.checked }))} /> {t('ugc.video.keepSound')}
                </label>
              )}
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
              {([['intro', ugc.intro, t('ugc.bumpers.introTitle')], ['outro', ugc.outro, t('ugc.bumpers.outroTitle')]] as ['intro' | 'outro', { url: string; name: string } | null, string][]).map(([kind, val, slotTitle]) => (
                val ? (
                  <div key={kind} className="flex items-center gap-1.5 p-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <video src={`${val.url}#t=0.1`} muted className="rounded flex-shrink-0" style={{ width: 30, height: 30, objectFit: 'cover', background: 'var(--bg-tertiary)' }} />
                    <span className="text-[10px] flex-1 min-w-0" style={{ color: 'var(--text-secondary)', ...NAME_CLAMP }} title={val.name}>{val.name}</span>
                    <button onClick={() => ugcMutate((u) => ({ ...u, [kind]: null }))} title={t('ugc.common.remove')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}><X size={12} /></button>
                  </div>
                ) : (
                  <EmptySlot key={kind} icon={<Plus size={13} />} title={slotTitle} sub={t('ugc.bumpers.addSub')} pad={7} onClick={() => p.openUgcPick(kind)} />
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
            {/* Что распознали из пожеланий — эти же стили сразу красят живой пример в превью и рендер */}
            {capWish && (
              <div className="flex items-center gap-1.5 flex-wrap text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span>{t('ugc.subtitles.parsedPrefix')}</span>
                {capWish.color && <WishChip label={t('ugc.subtitles.parsedColor')} color={capWish.color} />}
                {(capWish.outlineColor || capWish.outlineWidth != null) && (
                  capWish.outlineWidth === 0
                    ? <WishChip label={t('ugc.subtitles.parsedOutlineOff')} />
                    : <WishChip label={t('ugc.subtitles.parsedOutline')} color={capWish.outlineColor || '#141414'} />
                )}
                {capWish.sizePct != null && <WishChip label={t('ugc.subtitles.parsedSize', { pct: capWish.sizePct })} />}
                {capWish.bg && <WishChip label={t('ugc.subtitles.parsedBg')} color={capWish.bg} />}
              </div>
            )}
          </Sec>

          {/* 6. Фоновая музыка (бэкенд поддерживает во всех режимах: цикл + обрезка + громкость %) */}
          <Sec n={6} title={t('ugc.music.title')} sub={t('ugc.music.sub')} done={!!ugc.music}>
            {ugc.music ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  <Music size={15} className="flex-shrink-0" style={{ color: ACC }} />
                  <span className="text-[11px] flex-1 min-w-0" style={{ color: 'var(--text-secondary)', ...NAME_CLAMP }} title={ugc.music.name}>{ugc.music.name}</span>
                  <button onClick={() => p.openUgcPick('music')} className="text-[11px] px-2 py-1 rounded-md flex-shrink-0" style={{ background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}>{t('ugc.common.replace')}</button>
                  <button onClick={() => ugcMutate((u) => ({ ...u, music: null }))} title={t('ugc.common.remove')} className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
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
              <EmptySlot icon={<Music size={14} />} title={t('ugc.music.emptyTitle')} sub={t('ugc.music.emptySub')} onClick={() => p.openUgcPick('music')} />
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
                    <img src={val.url} alt="" className="rounded" style={{ width: 26, height: 26, objectFit: 'contain', background: 'repeating-conic-gradient(var(--ugcf-chk1, #3a3a42) 0% 25%, var(--ugcf-chk2, #2a2a30) 0% 50%) 0 0 / 10px 10px', flexShrink: 0 }} />
                    <span className="text-[10px] flex-1 min-w-0" style={{ color: 'var(--text-secondary)', ...NAME_CLAMP }} title={val.name}>{cap} · {val.name}</span>
                    <button onClick={() => ugcMutate((u) => { const layers = { ...u.layers }; delete layers[f]; return { ...u, layers }; })} title={t('ugc.common.remove')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}><X size={12} /></button>
                  </div>
                ) : (
                  <EmptySlot key={f} icon={<Layers size={13} />} title={cap} sub={t('ugc.layer.emptySub')} pad={7} onClick={() => p.openUgcPick(`layer_${f}` as UgcPickTarget as Exclude<UgcPickTarget, 'lineImage'>)} />
                );
              })}
            </div>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.layer.hint')}</p>
            {layerNote && <p className="text-[10px]" style={{ color: '#f59e0b' }}>{layerNote}</p>}
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
                    // Клик по пресету сбрасывает кастомные позиции аватара (avatarRects) — пресет = «как из коробки».
                    <button key={v} onClick={() => ugcMutate((u) => ({ ...u, placement: v, avatarRects: {} }))} title={lbl} className="rounded-lg"
                      style={{ padding: 3, background: ugc.placement === v ? 'rgba(168,85,247,.14)' : 'transparent', border: `1px solid ${ugc.placement === v ? ACC : 'transparent'}`, cursor: 'pointer' }}>
                      <LayDia v={v} />
                    </button>
                  ))}
                </div>
                {(ugc.placement === 'overlay-left' || ugc.placement === 'overlay-right') && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.layout.overlayHint')}</span>
                )}
                {hasAvatarRects && (
                  <button onClick={() => ugcMutate((u) => ({ ...u, avatarRects: {} }))} className="text-[10px] font-600 px-2 py-1 rounded-md"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                    {t('ugc.layout.resetAvatar')}
                  </button>
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
              onEmptyAvatar={() => {
                // Плюс/бокс аватара на превью ВСЕГДА открывает Галерею — пикер по текущему источнику:
                // «Готовые аватары» → добавить из Галереи (сразу станет аватаром), «Готовое видео» → видео, иначе фото.
                if (mode === 'solo' && ugc.avatarSource === 'collection') p.openUgcPick('avatarAdd');
                else if (mode === 'solo' && ugc.avatarSource === 'video') p.openUgcPick('avatarVideo');
                else p.openUgcPick('photo');
              }}
              onEmptyPhotoB={() => p.openUgcPick('photoB')}
              onEmptyClip={() => p.openUgcPick('clip')}
              onOpenLines={() => {
                // Плюс «медиа реплики» на превью: сразу Галерея — медиа прикрепится к первой реплике
                // без вложения. Реплик ещё нет → ведём к шагу «Голос и текст» (панель реплик пустой не рендерится).
                if (ugc.script.length > 0) {
                  const idx = ugc.script.findIndex((l) => !l.image);
                  p.setUgcLineIdx(idx >= 0 ? idx : 0);
                  p.setUgcPick('lineImage');
                  setLinesOpen(true);
                } else scrollToSec('ugc-sec-voice');
              }}
              onAvatarRect={(fmt, rect) => ugcMutate((u) => ({ ...u, avatarRects: { ...u.avatarRects, [fmt]: rect } }))}
              onLineRect={(i, rect) => ugcMutate((u) => ({ ...u, script: u.script.map((l, j) => (j === i ? { ...l, rect: rect || undefined } : l)) }))}
              onAvatarOverInserts={(v) => ugcMutate((u) => ({ ...u, avatarOverInserts: v }))}
            />
          ) : (
          <div className="flex-1 flex items-center justify-center gap-6 flex-wrap px-4 pb-3" style={{ minHeight: 0 }}>
            {(ugc.results && ugc.results.length > 1) ? (
              <div className="rounded-xl my-3" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(168,85,247,.4)', maxWidth: 760, width: '100%', padding: '12px 14px 14px' }}>
                <div className="flex items-center justify-between gap-3" style={{ marginBottom: 10 }}>
                  <span className="text-[12px] font-700" style={{ color: ACC }}>{t('ugc.preview.seriesReady', { count: ugc.results.length })}</span>
                  <span className="inline-flex items-center gap-2.5">
                    <a href="/gallery" className="text-[11px] font-700 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(168,85,247,.14)', color: ACC, border: `1px solid ${ACC}`, textDecoration: 'none' }}>{t('ugc.preview.openGallery')}</a>
                    <button onClick={() => ugcMutate((u) => ({ ...u, result: null, results: [] }))} title={t('ugc.common.hide')}
                      className="flex items-center justify-center rounded-lg"
                      style={{ width: 26, height: 26, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={14} /></button>
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
              /* шапка отделена от видео воздухом (не «приклеена»); бегунок таймлайна внизу и это
                 видео синхронизированы: скраб таймлайна мотает видео, перемотка видео двигает бегунок */
              <div className="rounded-xl my-3" style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(168,85,247,.4)', padding: '12px 14px 14px' }}>
                <div className="flex items-center justify-between gap-4" style={{ marginBottom: 10 }}>
                  <span className="text-[12px] font-700" style={{ color: ACC }}>{t('ugc.preview.ready')}</span>
                  <span className="inline-flex items-center gap-2.5">
                    <a href="/gallery" className="text-[11px] font-700 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(168,85,247,.14)', color: ACC, border: `1px solid ${ACC}`, textDecoration: 'none' }}>{t('ugc.preview.openGallery')}</a>
                    <button onClick={() => ugcMutate((u) => ({ ...u, result: null }))} title={t('ugc.common.hide')}
                      className="flex items-center justify-center rounded-lg"
                      style={{ width: 26, height: 26, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={14} /></button>
                  </span>
                </div>
                <video src={ugc.result.url} controls playsInline autoPlay
                  ref={resultVidRef}
                  onTimeUpdate={onResultVideoTime}
                  onSeeked={onResultVideoTime}
                  onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth && v.videoHeight) p.setUgcResultAR(v.videoWidth / v.videoHeight); }}
                  className="rounded-lg block" style={{ aspectRatio: String(p.ugcResultAR), maxHeight: '64vh', maxWidth: '100%', width: 'auto', margin: '0 auto', background: '#000' }} />
              </div>
            ) : null}
          </div>
          )}
          {/* подсказка про клики по превью — только в режиме превью (под готовым видео не нужна) */}
          {!((ugc.results && ugc.results.length > 1) || ugc.result) && (
            <p className="text-center text-[10.5px] pb-2.5 px-4" style={{ color: 'var(--text-muted)' }}>
              {mode === 'solo'
                ? t('ugc.preview.footerSolo')
                : t('ugc.preview.footerPlan')}
            </p>
          )}

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
        {/* ручка высоты дока: тянуть вверх/вниз, двойной клик — сброс */}
        {hasTimeline && (
          <div
            onPointerDown={dragDock} onDoubleClick={dockReset}
            title={t('ugc.timeline.dragResize', 'Потяните вверх/вниз — высота таймлайна; двойной клик — как было')}
            className="absolute left-0 right-0 flex items-center justify-center opacity-60 hover:opacity-100"
            style={{ top: -7, height: 14, cursor: 'ns-resize', zIndex: 31, touchAction: 'none', ...(dockDrag ? { opacity: 1 } : null) }}
          >
            <span style={{ width: 46, height: 5, borderRadius: 999, background: dockDrag ? ACC : 'var(--text-muted)', boxShadow: '0 1px 3px rgba(0,0,0,.3)', transition: 'background .15s' }} />
          </div>
        )}
        <div ref={dockRef} className="px-3.5 py-2" style={{ maxHeight: dockH, overflowY: 'auto' }}>
          {hasTimeline ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <b className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{t('ugc.timeline.title')}</b>
                {ugc.script.length > 0 && (
                  <span className="text-[10.5px]" style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{t('ugc.lines.count', { count: ugc.script.length, sec: Math.round(p.ugcScriptSec()) })}</span>
                )}
                {ugc.script.length > 0 && (
                <button onClick={() => setLinesOpen((o) => !o)} className="ml-auto text-[10.5px] font-700 px-2.5 py-1 rounded-lg"
                  style={{ background: linesOpen ? 'rgba(168,85,247,.14)' : 'var(--bg-tertiary)', color: linesOpen ? ACC : 'var(--text-secondary)', border: `1px solid ${linesOpen ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                  {linesOpen ? t('ugc.timeline.hideLines') : t('ugc.timeline.showLines')}
                </button>
                )}
              </div>
              {/* Громкости и скорость — у дорожек, к которым относятся (просьба юзера «% на дорожках») */}
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mb-1.5 text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                {ugc.clips.length > 0 && (
                  <>
                    <label className="inline-flex items-center gap-1.5" title={ugc.clipMuted ? t('ugc.timeline.clipSoundOff', 'Звук видеоряда выключен — галочка «звук из видео» в шаге «Видеоряд»') : t('ugc.timeline.clipSound', 'Громкость звука видеоряда')}
                      style={ugc.clipMuted ? { opacity: 0.45 } : undefined}>
                      <span style={{ color: '#10b981', fontWeight: 650 }}>{t('ugc.common.footage')}</span>
                      <input type="range" min={0} max={200} step={5} value={ugc.clipVolumePct} disabled={ugc.clipMuted}
                        onChange={(e) => ugcMutate((u) => ({ ...u, clipVolumePct: Number(e.target.value) }))}
                        style={{ width: 76, accentColor: '#10b981' }} />
                      <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>{ugc.clipMuted ? t('ugc.timeline.mutedShort', 'выкл') : `${ugc.clipVolumePct}%`}</span>
                    </label>
                    <span className="inline-flex items-center gap-1" title={t('ugc.timeline.clipSpeed', 'Скорость воспроизведения видеоряда (×0.5–×2): видео уско­ряется/замедляется, дорожка пересчитывается')}>
                      {[50, 75, 100, 125, 150, 200].map((s) => (
                        <button key={s} onClick={() => ugcMutate((u) => ({ ...u, clipSpeedPct: s }))}
                          className="px-1.5 py-0.5 rounded-md font-650"
                          style={{ fontSize: 10, background: ugc.clipSpeedPct === s ? '#10b981' : 'var(--bg-tertiary)', color: ugc.clipSpeedPct === s ? '#fff' : 'var(--text-muted)', border: `1px solid ${ugc.clipSpeedPct === s ? '#10b981' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                          ×{(s / 100).toString().replace('.', ',')}
                        </button>
                      ))}
                    </span>
                  </>
                )}
                <label className="inline-flex items-center gap-1.5" title={t('ugc.timeline.voiceVol', 'Громкость озвучки (голос аватара / TTS / запись)')}>
                  <span style={{ color: ACC, fontWeight: 650 }}>{t('ugc.timeline.voiceLabel', 'Озвучка')}</span>
                  <input type="range" min={0} max={200} step={5} value={ugc.voiceVolumePct}
                    onChange={(e) => ugcMutate((u) => ({ ...u, voiceVolumePct: Number(e.target.value) }))}
                    style={{ width: 76, accentColor: ACC }} />
                  <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>{ugc.voiceVolumePct}%</span>
                </label>
              </div>
              <DialogueTimeline
                dialogue={ugc.script}
                setDialogue={(updater) => ugcMutate((u) => ({ ...u, script: updater(u.script) }))}
                recordingUrl={ugc.recordingUrl}
                onPickImage={(i) => { p.setUgcLineIdx(i); p.setUgcPick('lineImage'); }}
                dialogueMode={ugc.dialogueEnabled}
                hideMediaPlan
                onPlayheadScrub={onTimelineScrub}
                externalPlayhead={tlFollow}
                accentA={ACC}
                accentB={ACC2}
                clipTrack={ugc.clips.length ? {
                  label: t('ugc.common.footage'),
                  clips: ugc.clips,
                  onTrim: (i, patch) => ugcMutate((u) => syncClips(u, u.clips.map((c, j) => (j === i ? { ...c, ...patch } : c)))),
                  onOpen: (i) => setClipEditIdx(i),
                  onDuration: setClipDuration,
                  speedPct: ugc.clipSpeedPct,
                } : undefined}
                overlayTrack={isVideoAv && ugc.avatarVideoUrl && ugc.clips.length > 0 ? {
                  label: t('ugc.timeline.avatarLabel', 'Аватар'),
                  name: ugc.avatarVideoName || t('ugc.avatar.videoChosenName'),
                  url: ugc.avatarVideoUrl,
                  startSec: ugc.avatarVideoStartSec,
                  durationSec: ugc.avatarVideoDurationSec || undefined,
                  onMove: (s) => ugcMutate((u) => ({ ...u, avatarVideoStartSec: s })),
                  onOpen: () => setAvatarEdit(true),
                  onDuration: (d) => ugcMutate((u) => ({ ...u, avatarVideoDurationSec: d })),
                } : undefined}
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
      {p.ugcPick && p.ugcPick !== 'retBrolls' && p.ugcPick !== 'clipImages' && (() => {
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
          : pick === 'avatarVideo' ? t('ugc.avatar.sourceVideo')
          : isLayer ? t('ugc.picker.layer')
          : t('ugc.common.footage');
        return (
          <GalleryPicker
            open token={p.token}
            title={title}
            note={isLayer ? t('ugc.picker.layerNote') : (pick === 'intro' || pick === 'outro') ? t('ugc.picker.bumperNote') : undefined}
            defaultTab={pick === 'music' || pick === 'recording' ? 'audio' : 'reference'}
            onClose={() => { p.setUgcPick(null); p.setUgcLineIdx(null); }}
            onUpload={(files) => p.uploadToGallery(files, pick === 'music' ? 'audio' : pick === 'recording' ? undefined : 'reference')}
            uploadAccept={pick === 'music' ? 'audio/*' : isLayer ? 'image/png,image/webp' : isImg ? 'image/*' : pick === 'lineImage' ? 'image/*,video/*' : pick === 'recording' ? 'audio/*,video/*' : 'video/*'}
            onlyType={isImg ? 'image' : pick === 'music' ? 'audio' : pick === 'recording' ? ['audio', 'video'] : pick === 'lineImage' ? ['image', 'video'] : 'video'}
            onPick={(it) => {
              // Слой обязан быть прозрачным PNG/WebP: JPEG без альфы закрыл бы весь кадр в рендере.
              if (isLayer && !/\.(png|webp)(\?|#|$)/i.test(it.fileUrl)) { setLayerNote(t('ugc.layer.pngOnly')); return; }
              if (isLayer) setLayerNote(null);
              p.pickUgcItem({ url: it.fileUrl, name: it.title, type: (it.type === 'image' || it.type === 'audio' ? it.type : 'video') });
            }}
          />
        );
      })()}
      {/* Фото-слайдшоу: мультивыбор изображений (клик добавляет/убирает, порядок = порядок выбора) */}
      {p.ugcPick === 'clipImages' && (
        <GalleryPicker
          open multi token={p.token}
          title={t('ugc.picker.clipImagesTitle')}
          note={t('ugc.picker.clipImagesNote')}
          defaultTab="reference"
          onlyType="image"
          uploadAccept="image/*"
          pickedKeys={new Set(ugc.clipImages.map((b) => b.url))}
          onClose={() => p.setUgcPick(null)}
          onUpload={(files) => p.uploadToGallery(files, 'reference')}
          onPick={(it) => ugcMutate((u) => (
            u.clipImages.some((b) => b.url === it.fileUrl)
              ? { ...u, clipImages: u.clipImages.filter((b) => b.url !== it.fileUrl) }
              : { ...u, clipImages: [...u.clipImages, { url: it.fileUrl, name: it.title }].slice(0, 12) }
          ))}
        />
      )}
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

      {/* ── Выбор разбора тренда: список сохранённых анализов (video_analyses) ── */}
      {anaOpen && (
        <div onClick={() => setAnaOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl p-4" style={{ width: 'min(520px, 94vw)', maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: '0 14px 34px rgba(0,0,0,.4)' }}>
            <div className="flex items-center justify-between mb-1">
              <b className="text-[13.5px] inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}><Sparkles size={14} style={{ color: ACC }} /> {t('ugc.analysis.pickTitle')}</b>
              <button onClick={() => setAnaOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>{t('ugc.analysis.pickSub')}</p>
            {anaList === null ? (
              <p className="text-[11px] py-3 text-center" style={{ color: 'var(--text-muted)' }}><Loader2 size={14} className="animate-spin inline" /> {t('ugc.brand.loading')}</p>
            ) : anaList.length === 0 ? (
              <p className="text-[11px] py-2" style={{ color: 'var(--text-muted)' }}>{t('ugc.analysis.none')}</p>
            ) : (
              <div className="space-y-1.5">
                {anaList.map((a) => {
                  const dna = a?.dna || {};
                  // coverUrl с бэка = лучшая из dna.meta.cover и обложки того же видео в ленте
                  // трендов (самолечится на диск) — «лёгкие» разборы больше не остаются пустыми.
                  const cover = (a.coverUrl as string | undefined) || (dna?.meta?.cover as string | undefined);
                  return (
                    <button key={a.id} onClick={() => applyAnalysis(a)} className="w-full text-left rounded-xl p-2 flex items-center gap-2.5"
                      style={{ background: 'var(--bg-primary)', border: `1px solid ${ugc.analysis?.id === String(a.id) ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                      {/* Обложка видео — так проще узнать тренд, чем по имени файла tiktok-…mp4.
                          Искры лежат ПОД медиа: битая картинка/недогруженное видео не оставляют
                          пустой серый квадрат. */}
                      <span className="relative rounded-lg overflow-hidden flex-shrink-0" style={{ width: 46, height: 62, background: 'var(--bg-tertiary)' }}>
                        <span className="absolute inset-0 flex items-center justify-center" style={{ color: ACC }}><Sparkles size={17} /></span>
                        {a.fileUrl ? (
                          <video src={`${a.fileUrl}#t=0.1`} poster={coverSrc(cover) || undefined} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
                        ) : cover ? (
                          <img src={coverSrc(cover)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : null}
                      </span>
                      <span className="flex-1 min-w-0 space-y-0.5">
                        <span className="flex items-center gap-2">
                          <b className="text-[11.5px] flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{a.title || dna.hookType || a.platform || t('sec.ugc.analysisFallbackName', 'разбор')}</b>
                          {dna.visual?.framesAnalyzed && <span className="text-[9px] font-700 px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(16,185,129,.14)', color: '#10b981' }}>{t('ugc.analysis.framesBadge')}</span>}
                          <span className="text-[9.5px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</span>
                        </span>
                        <span className="block text-[10px]" style={{ color: 'var(--text-muted)', ...NAME_CLAMP }}>{dna.hookType ? `${dna.hookType} · ` : ''}{dna.summary || dna.whyItWorks || ''}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Шаблоны UGC: применить/сохранить + автопубликация (источник: Тренды) ── */}
      {tplOpen && (
        <div onClick={() => setTplOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-2xl p-4" style={{ width: 'min(560px, 94vw)', maxHeight: '84vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: '0 14px 34px rgba(0,0,0,.4)' }}>
            <div className="flex items-center justify-between mb-1">
              <b className="text-[13.5px]" style={{ color: 'var(--text-primary)' }}>▦ {t('ugc.tpl.title')}</b>
              <button onClick={() => setTplOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>{t('ugc.tpl.sub')}</p>

            {tpls === null ? (
              <p className="text-[11px] py-3 text-center" style={{ color: 'var(--text-muted)' }}><Loader2 size={14} className="animate-spin inline" /> {t('ugc.brand.loading')}</p>
            ) : tpls.length === 0 ? (
              <p className="text-[11px] py-2" style={{ color: 'var(--text-muted)' }}>{t('ugc.tpl.empty')}</p>
            ) : (
              <div className="space-y-2 mb-3">
                {tpls.map((k) => {
                  const ap = k.autopublish || {};
                  const apOn = ap.enabled === true;
                  const srcId = ap.source?.type === 'trend_watch' ? String(ap.source.id || '') : '';
                  return (
                    <div key={k.id} className="rounded-xl p-2.5 space-y-2" style={{ background: 'var(--bg-primary)', border: `1px solid ${apOn ? 'rgba(168,85,247,.45)' : 'var(--border-medium)'}` }}>
                      <div className="flex items-center gap-2">
                        {/* Ключевик тренда — бейдж СВЕРХУ карточки шаблона (как просили) */}
                        <span className="flex-1 min-w-0">
                          {k.trendKeyword && (
                            <span className="inline-block text-[9px] font-700 px-2 py-0.5 rounded-full mb-0.5" style={{ background: 'rgba(168,85,247,.14)', color: ACC, border: '1px solid rgba(168,85,247,.4)' }}>#{k.trendKeyword}</span>
                          )}
                          <b className="block text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>{k.name}</b>
                        </span>
                        <button onClick={() => applyTpl(k)} className="text-[11px] font-700 px-2.5 py-1 rounded-lg flex-shrink-0"
                          style={{ background: 'rgba(168,85,247,.14)', color: ACC, border: `1px solid ${ACC}`, cursor: 'pointer' }}>{t('ugc.tpl.apply')}</button>
                        <button onClick={() => void deleteTpl(k.id)} title={t('ugc.common.remove')} className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={13} /></button>
                      </div>
                      {/* «Включить автопубликацию» — в середине шаблона: источник = ваши автоанализы Трендов */}
                      <div className="rounded-lg p-2 space-y-1.5" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)' }}>
                        <label className="flex items-center gap-2 text-[11px] font-650" style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={apOn} style={{ accentColor: ACC }}
                            onChange={(e) => void patchTplAutopub(k, { ...ap, enabled: e.target.checked, language: ap.language || 'en', source: ap.source || { type: 'trend_watch', id: '' } })} />
                          {t('ugc.tpl.autopubOn')}
                        </label>
                        {apOn && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t('ugc.tpl.source')}</span>
                              <select value={srcId}
                                onChange={(e) => void patchTplAutopub(k, { ...ap, source: { type: 'trend_watch', id: e.target.value } })}
                                className="flex-1 px-2 py-1 rounded-md text-[11px] outline-none"
                                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}>
                                <option value="">{t('ugc.tpl.sourceNone')}</option>
                                {(watches || []).map((w) => (
                                  <option key={w.id} value={w.id}>{t('ugc.tpl.sourceTrends')}: {w.keyword} ({w.platform}{w.enabled ? '' : ` · ${t('ugc.tpl.sourcePaused')}`})</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t('ugc.tpl.lang')}</span>
                              <select value={String(ap.language || 'en')}
                                onChange={(e) => void patchTplAutopub(k, { ...ap, language: e.target.value })}
                                className="px-2 py-1 rounded-md text-[11px] outline-none"
                                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}>
                                {AUTOPUB_LANG_CHOICES.map(([code, name]) => <option key={code} value={code}>{name} · {code.toUpperCase()}</option>)}
                              </select>
                              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.tpl.langHint')}</span>
                            </div>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('ugc.tpl.autopubHint')}</p>
                            {(watches || []).length === 0 && <p className="text-[10px]" style={{ color: '#f59e0b' }}>{t('ugc.tpl.noWatches')}</p>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Сохранить текущие настройки студии как новый шаблон */}
            <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: 'var(--bg-primary)', border: '1.5px dashed var(--border-strong)' }}>
              <b className="text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>＋ {t('ugc.tpl.saveCurrent')}</b>
              <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={t('ugc.tpl.namePlaceholder')}
                className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
              <input value={tplKeyword} onChange={(e) => setTplKeyword(e.target.value)} placeholder={t('ugc.tpl.keywordPlaceholder')}
                className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
              <button onClick={() => void saveTpl()} className="w-full py-2 rounded-xl text-[11.5px] font-700"
                style={{ background: 'rgba(168,85,247,.14)', color: ACC, border: '1px solid rgba(168,85,247,.4)', cursor: 'pointer' }}>
                {t('ugc.tpl.save')}
              </button>
            </div>
            {tplNote && <p className="text-[10.5px] mt-2" style={{ color: '#f59e0b' }}>{tplNote}</p>}
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>{t('ugc.tpl.note')}</p>
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

      {/* Клип «Видеоряда» в нашем редакторе (обрезка/нарезка, VideoViewer): клик по тумбе панели
          или по сегменту дорожки таймлайна. Сохранение НЕразрушающее — новый файл замещает клип
          (обрезка дорожки сбрасывается, длительность перечитается из метаданных). */}
      {clipEditIdx != null && ugc.clips[clipEditIdx] && (
        <VideoViewer
          open
          url={ugc.clips[clipEditIdx].url}
          title={ugc.clips[clipEditIdx].name}
          onClose={() => setClipEditIdx(null)}
          onSaved={(r) => {
            ugcMutate((u) => syncClips(u, u.clips.map((c, j) => j === clipEditIdx
              ? { url: r.fileUrl, name: `${c.name} · ${t('ugc.video.editedSuffix', 'обрезано')}`, durationSec: undefined, trimStart: undefined, trimEnd: undefined }
              : c)));
            setClipEditIdx(null);
          }}
        />
      )}

      {/* Видео-аватар в редакторе (клик по сегменту «Аватар» на таймлайне): обрезка/нарезка,
          новый файл замещает аватара, длительность перечитается из метаданных. */}
      {avatarEdit && ugc.avatarVideoUrl && (
        <VideoViewer
          open
          url={ugc.avatarVideoUrl}
          title={ugc.avatarVideoName || t('ugc.avatar.videoChosenName')}
          onClose={() => setAvatarEdit(false)}
          onSaved={(r) => {
            ugcMutate((u) => ({ ...u, avatarVideoUrl: r.fileUrl, avatarVideoName: `${u.avatarVideoName || t('ugc.avatar.videoChosenName')} · ${t('ugc.video.editedSuffix', 'обрезано')}`, avatarVideoDurationSec: null, result: null }));
            setAvatarEdit(false);
          }}
        />
      )}
    </div>
  );
}
