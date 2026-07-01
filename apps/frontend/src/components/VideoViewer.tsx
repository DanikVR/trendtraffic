/**
 * VideoViewer — единый просмотрщик-редактор видео для ВСЕГО сервиса (TrendTraffic).
 *
 * Везде, где открывается видео (Галерея, превью генерации, источники, блок сценария),
 * используется этот компонент. Это плеер + встроенная обрезка в духе LosslessCut:
 *   - обрезать начало/конец (выделение IN..OUT → «Оставить выделенное»)
 *   - вырезать кусок из середины («Вырезать выделенное» → склейка оставшихся частей)
 *   - повернуть (⟳ 90°)
 * Всё lossless: операции уходят на /api/video-edit (ffmpeg -c copy), сохранение
 * НЕРАЗРУШАЮЩЕЕ — создаётся новый файл, исходник цел.
 *
 * Редактирование доступно только для локальных видео сервиса (/uploads/...).
 * Внешние ссылки открываются как обычный плеер (editable=false).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Play, Pause, Scissors, RotateCw, Crop, Undo2, RefreshCw, Save, Loader2, Download,
  SkipBack, SkipForward, Check, Music, Pencil, Plus,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { downloadMedia } from './chat/MediaLightbox';

export interface VideoEditResult { fileUrl: string; assetId: string | null; }

interface VideoViewerProps {
  open: boolean;
  /** URL видео (/uploads/... для редактирования, либо внешняя ссылка для просмотра). */
  url: string;
  title?: string;
  onClose: () => void;
  /** Колбэк после успешного сохранения обрезки (новый файл). */
  onSaved?: (result: VideoEditResult) => void;
  /** false — чистый просмотр без обрезки. По умолчанию редактирование включено для /uploads. */
  editable?: boolean;
  /** 'audio' — аудио-режим: без картинки/поворота, доступна только обрезка/нарезка. */
  kind?: 'video' | 'audio';
}

interface Seg { start: number; end: number; }

const EPS = 0.05;
const isLocal = (u: string) => u.startsWith('/uploads/') || u.startsWith('uploads/');

function fmtTime(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t - Math.floor(t)) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** Вычесть [a,b] из набора сегментов (операция «вырезать»). */
function subtract(segs: Seg[], a: number, b: number): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    if (b <= s.start + EPS || a >= s.end - EPS) { out.push(s); continue; }
    if (a > s.start + EPS) out.push({ start: s.start, end: a });
    if (b < s.end - EPS) out.push({ start: b, end: s.end });
  }
  return out.filter((s) => s.end - s.start > EPS);
}

/** Пересечь набор сегментов с [a,b] (операция «оставить только»). */
function intersect(segs: Seg[], a: number, b: number): Seg[] {
  return segs
    .map((s) => ({ start: Math.max(s.start, a), end: Math.min(s.end, b) }))
    .filter((s) => s.end - s.start > EPS);
}

/** Отсортировать и слить пересекающиеся/смежные промежутки в нормальный вид. */
function normalize(segs: Seg[]): Seg[] {
  const s = segs.filter((x) => x.end - x.start > EPS).sort((a, b) => a.start - b.start);
  const out: Seg[] = [];
  for (const seg of s) {
    const last = out[out.length - 1];
    if (last && seg.start <= last.end + EPS) last.end = Math.max(last.end, seg.end);
    else out.push({ ...seg });
  }
  return out;
}

export function VideoViewer({ open, url, title, onClose, onSaved, editable, kind }: VideoViewerProps) {
  const isAudio = kind === 'audio';
  const token = useAppStore((s) => s.token);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Текущий проигрываемый URL (после сохранения переключаемся на результат).
  const [curUrl, setCurUrl] = useState(url);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Модель обрезки: сегменты, которые ОСТАВИТЬ (по умолчанию — весь файл).
  const [keep, setKeep] = useState<Seg[]>([]);
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [selIn, setSelIn] = useState(0);
  const [selOut, setSelOut] = useState(0);
  // История правок для кнопки «Отменить» (стек снимков {keep, rotate}).
  const [history, setHistory] = useState<{ keep: Seg[]; rotate: 0 | 90 | 180 | 270 }[]>([]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // Имя файла (редактируемое вверху) + несколько отмеченных промежутков (мульти-обрезка).
  const [nameEdit, setNameEdit] = useState(title || 'Видео');
  const [editingName, setEditingName] = useState(false);
  const [marks, setMarks] = useState<Seg[]>([]);

  const canEdit = (editable ?? true) && isLocal(curUrl);

  // Сброс при открытии / смене входного URL.
  useEffect(() => {
    if (!open) return;
    setCurUrl(url); setDuration(0); setTime(0); setPlaying(false);
    setKeep([]); setRotate(0); setSelIn(0); setSelOut(0); setHistory([]);
    setErr(null); setSavedOk(false);
    setNameEdit(title || 'Видео'); setEditingName(false); setMarks([]);
  }, [open, url, title]);

  // Esc + блокировка скролла фона.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(time - (e.shiftKey ? 5 : 1 / 30)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); seek(time + (e.shiftKey ? 5 : 1 / 30)); }
      else if (canEdit && (e.key === 'i' || e.key === 'I' || e.key === 'ш' || e.key === 'Ш')) setInPoint();
      else if (canEdit && (e.key === 'o' || e.key === 'O' || e.key === 'щ' || e.key === 'Щ')) setOutPoint();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, time, canEdit]);

  const onMeta = () => {
    const v = videoRef.current; if (!v) return;
    const d = v.duration || 0;
    setDuration(d);
    setKeep([{ start: 0, end: d }]);
    setSelIn(0); setSelOut(d);
  };

  const seek = useCallback((t: number) => {
    const v = videoRef.current; if (!v || !duration) return;
    const nt = Math.max(0, Math.min(duration, t));
    v.currentTime = nt; setTime(nt);
  }, [duration]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { void v.play(); } else { v.pause(); }
  }, []);

  const setInPoint = () => setSelIn(Math.min(time, selOut - EPS));
  const setOutPoint = () => setSelOut(Math.max(time, selIn + EPS));

  // Снимок текущего состояния правок в стек истории (перед каждой операцией).
  const snapshot = () => setHistory((h) => [...h, { keep: keep.map((s) => ({ ...s })), rotate }]);
  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setKeep(last.keep); setRotate(last.rotate);
      return h.slice(0, -1);
    });
  };

  // Мульти-обрезка: отметить текущее выделение как ещё один промежуток.
  const addMark = () => {
    if (selOut - selIn <= EPS) return;
    setMarks((m) => normalize([...m, { start: selIn, end: selOut }]));
  };
  const removeMark = (i: number) => setMarks((m) => m.filter((_, idx) => idx !== i));
  const clearMarks = () => setMarks([]);
  // Набор промежутков для операции: отмеченные (если есть), иначе — текущее выделение.
  const activeSegs = (): Seg[] => (marks.length ? marks : [{ start: selIn, end: selOut }]);

  const keepSelection = () => {
    snapshot();
    const segs = activeSegs();
    setKeep((k) => normalize(segs.flatMap((s) => intersect(k, s.start, s.end))));
    setMarks([]);
  };
  const cutSelection = () => {
    snapshot();
    const segs = activeSegs();
    setKeep((k) => segs.reduce((acc, s) => subtract(acc, s.start, s.end), k));
    setMarks([]);
  };
  const rotateStep = () => { snapshot(); setRotate((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270); };
  const resetEdits = () => { snapshot(); setKeep([{ start: 0, end: duration }]); setSelIn(0); setSelOut(duration); setRotate(0); setMarks([]); };

  const resultDuration = useMemo(() => keep.reduce((a, s) => a + (s.end - s.start), 0), [keep]);
  const isFullKeep = keep.length === 1 && keep[0].start <= EPS && keep[0].end >= duration - EPS;
  const hasChanges = canEdit && duration > 0 && (!isFullKeep || rotate !== 0) && keep.length > 0;

  // ── позиционирование на дорожке ──────────────────────────────────────────────
  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);
  const timeFromEvent = (clientX: number): number => {
    const el = trackRef.current; if (!el || !duration) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
  };
  const onTrackClick = (e: React.MouseEvent) => { if (duration) seek(timeFromEvent(e.clientX)); };

  // Перетаскивание ручек IN/OUT.
  const dragHandle = (which: 'in' | 'out') => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const move = (ev: PointerEvent) => {
      const t = timeFromEvent(ev.clientX);
      if (which === 'in') setSelIn(Math.min(t, selOutRef.current - EPS));
      else setSelOut(Math.max(t, selInRef.current + EPS));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  // refs, чтобы обработчик drag видел свежие значения без пересоздания.
  const selInRef = useRef(selIn); const selOutRef = useRef(selOut);
  useEffect(() => { selInRef.current = selIn; }, [selIn]);
  useEffect(() => { selOutRef.current = selOut; }, [selOut]);

  const save = async () => {
    if (!hasChanges || saving) return;
    setSaving(true); setErr(null); setSavedOk(false);
    try {
      const body: any = { inputUrl: curUrl, name: (nameEdit || title || 'Видео').trim() };
      if (!isFullKeep) body.segments = keep.map((s) => ({ start: +s.start.toFixed(3), end: +s.end.toFixed(3) }));
      if (rotate !== 0) body.rotate = rotate;
      const res = await fetch('/api/video-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      const result: VideoEditResult = { fileUrl: data.fileUrl, assetId: data.assetId ?? null };
      setSavedOk(true);
      onSaved?.(result);
      // Переключаем плеер на результат и сбрасываем правки.
      setCurUrl(result.fileUrl);
      setKeep([]); setRotate(0); setHistory([]);
    } catch (e: any) {
      setErr(e?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-[130] flex flex-col" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)' }}>
      {/* Шапка: имя файла (редактируемое) + Сохранить/Скачать/Закрыть */}
      <div className="flex items-center gap-2 sm:gap-3 px-4 py-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          {canEdit && editingName ? (
            <input autoFocus value={nameEdit} onChange={(e) => setNameEdit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
              onBlur={() => setEditingName(false)}
              className="text-sm font-700 px-2 py-1 rounded-md outline-none w-full"
              style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', maxWidth: 460 }} />
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-700 truncate" style={{ color: '#fff' }} title={canEdit ? (nameEdit || 'Видео') : (title || 'Видео')}>
                {canEdit ? (nameEdit || 'Видео') : (title || 'Видео')}
              </span>
              {canEdit && (
                <button type="button" onClick={() => setEditingName(true)} title="Переименовать файл"
                  className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {canEdit ? (isAudio ? 'Прослушивание и обрезка аудио' : 'Просмотр и обрезка') : 'Просмотр'}
          </div>
        </div>
        {canEdit && (
          <>
            {err && <span className="text-xs hidden sm:inline" style={{ color: '#fca5a5' }}>{err}</span>}
            {savedOk && !err && <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#86efac' }}><Check size={14} /> Сохранено</span>}
            <button type="button" onClick={save} disabled={!hasChanges || saving} title="Сохранить результат в Галерею (новый файл)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-700 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: hasChanges ? 'var(--brand)' : 'rgba(255,255,255,0.14)', color: hasChanges ? 'var(--brand-contrast, #fff)' : 'rgba(255,255,255,0.5)' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Сохранить
            </button>
          </>
        )}
        <button type="button" onClick={() => downloadMedia(curUrl)} title="Скачать"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-90 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
          <Download size={18} />
        </button>
        <button type="button" onClick={onClose} title="Закрыть (Esc)"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-90 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
          <X size={18} />
        </button>
      </div>

      {/* Видео / аудио */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 overflow-hidden" style={{ position: 'relative' }}>
        <video
          ref={videoRef}
          src={curUrl}
          className="max-w-full max-h-full rounded-lg"
          style={isAudio
            ? { width: '100%', maxWidth: 520, height: 120, background: '#000' }
            : { transform: rotate ? `rotate(${rotate}deg)` : undefined, transition: 'transform 0.2s' }}
          onLoadedMetadata={onMeta}
          onTimeUpdate={() => setTime(videoRef.current?.currentTime || 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onClick={togglePlay}
          playsInline
        />
        {isAudio && (
          <div className="pointer-events-none flex flex-col items-center gap-2" style={{ position: 'absolute', color: 'rgba(255,255,255,0.9)' }}>
            <Music size={48} />
            <span className="text-sm">Аудио — обрезайте по дорожке ниже</span>
          </div>
        )}
      </div>

      {/* Панель управления */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 space-y-3" style={{ background: 'rgba(0,0,0,0.35)' }}>
        {/* Транспорт */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => seek(time - 1 / 30)} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title="Кадр назад (←)"><SkipBack size={16} /></button>
          <button type="button" onClick={togglePlay} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'var(--brand)', color: 'var(--brand-contrast, #fff)' }} title="Play/Pause (Space)">
            {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <button type="button" onClick={() => seek(time + 1 / 30)} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title="Кадр вперёд (→)"><SkipForward size={16} /></button>
          <div className="text-xs tabular-nums ml-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {fmtTime(time)} <span style={{ color: 'rgba(255,255,255,0.4)' }}>/ {fmtTime(duration)}</span>
          </div>
          {canEdit && (
            <div className="ml-auto text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Итог: <span style={{ color: 'var(--brand)' }}>{fmtTime(resultDuration)}</span>
            </div>
          )}
        </div>

        {/* Дорожка-таймлайн */}
        <div className="relative select-none" style={{ height: 44 }}>
          <div ref={trackRef} onClick={onTrackClick}
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-md cursor-pointer overflow-hidden"
            style={{ height: 26, background: 'rgba(255,255,255,0.12)' }}>
            {/* Оставляемые сегменты (зелёные) */}
            {canEdit && keep.map((s, i) => (
              <div key={i} className="absolute top-0 bottom-0" style={{ left: `${pct(s.start)}%`, width: `${pct(s.end - s.start)}%`, background: 'rgba(34,197,94,0.40)', borderLeft: '1px solid rgba(34,197,94,0.8)', borderRight: '1px solid rgba(34,197,94,0.8)' }} />
            ))}
            {/* Отмеченные промежутки (красные) — применятся все сразу «Вырезать»/«Оставить» */}
            {canEdit && marks.map((m, i) => (
              <div key={`m${i}`} className="absolute top-0 bottom-0" title={`Промежуток ${i + 1} — двойной клик снимет`} onDoubleClick={(e) => { e.stopPropagation(); removeMark(i); }}
                style={{ left: `${pct(m.start)}%`, width: `${pct(m.end - m.start)}%`, background: 'rgba(239,68,68,0.38)', borderLeft: '2px solid rgba(239,68,68,0.95)', borderRight: '2px solid rgba(239,68,68,0.95)' }} />
            ))}
            {/* Текущее выделение IN..OUT */}
            {canEdit && (
              <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${pct(selIn)}%`, width: `${pct(selOut - selIn)}%`, background: 'rgba(99,102,241,0.30)', border: '1px solid var(--brand)' }} />
            )}
            {/* Плейхед */}
            <div className="absolute top-0 bottom-0 w-[2px] pointer-events-none" style={{ left: `${pct(time)}%`, background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.6)' }} />
          </div>

          {/* Ручки выделения */}
          {canEdit && duration > 0 && (
            <>
              <div onPointerDown={dragHandle('in')} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize rounded"
                style={{ left: `${pct(selIn)}%`, width: 12, height: 38, background: 'var(--brand)', touchAction: 'none' }} title="Начало выделения" />
              <div onPointerDown={dragHandle('out')} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize rounded"
                style={{ left: `${pct(selOut)}%`, width: 12, height: 38, background: 'var(--brand)', touchAction: 'none' }} title="Конец выделения" />
            </>
          )}
        </div>

        {/* Инструменты обрезки */}
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={setInPoint} className={btn} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title="Начало выделения здесь (I)">[ Начало</button>
            <button type="button" onClick={setOutPoint} className={btn} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title="Конец выделения здесь (O)">Конец ]</button>
            <button type="button" onClick={addMark} className={btn} style={{ background: 'rgba(239,68,68,0.22)', color: '#fca5a5' }} title="Отметить текущий промежуток. Можно несколько — потом «Вырезать»/«Оставить» применит все сразу">
              <Plus size={15} /> Отметить{marks.length ? ` · ${marks.length}` : ''}
            </button>
            <button type="button" onClick={keepSelection} className={btn} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title={marks.length ? `Оставить только отмеченные промежутки (${marks.length})` : 'Оставить только выделенное'}>
              <Crop size={15} /> Оставить{marks.length ? ` (${marks.length})` : ''}
            </button>
            <button type="button" onClick={cutSelection} className={btn} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title={marks.length ? `Вырезать все отмеченные промежутки (${marks.length})` : 'Вырезать выделенный кусок'}>
              <Scissors size={15} /> Вырезать{marks.length ? ` (${marks.length})` : ''}
            </button>
            {marks.length > 0 && (
              <button type="button" onClick={clearMarks} className={btn} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title="Снять все отметки">
                <X size={15} /> Отметки
              </button>
            )}
            {!isAudio && (
              <button type="button" onClick={rotateStep} className={btn} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title="Повернуть на 90°">
                <RotateCw size={15} /> Поворот{rotate ? ` ${rotate}°` : ''}
              </button>
            )}
            <button type="button" onClick={undo} disabled={!history.length} className={btn} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title="Отменить последнее действие">
              <Undo2 size={15} /> Отменить
            </button>
            <button type="button" onClick={resetEdits} className={btn} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }} title="Сбросить все правки">
              <RefreshCw size={15} /> Сброс
            </button>
            {marks.length > 0 && (
              <span className="text-[11px] w-full sm:w-auto sm:ml-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Красным — {marks.length} отмеч. промежут(ок/ка): «Вырезать»/«Оставить» применит все сразу; двойной клик по красному — снять.
              </span>
            )}
          </div>
        ) : (
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Обрезка доступна для видео из Галереи. Добавьте это видео в Галерею, чтобы редактировать.
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoViewer;
