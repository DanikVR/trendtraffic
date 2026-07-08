/**
 * DialogueTimeline — ОБЩИЙ редактор диалога: таймлайн с наложением голосов + список реплик.
 * Вынесен из подкаста, чтобы «Комментатор» и «Подкаст» использовали ОДИН редактор (идентичны).
 *
 * Возможности (1:1 с подкастом): перетаскивание клипов по времени и ВВЕРХ/ВНИЗ (смена спикера A↔B),
 * бегунок + воспроизведение с микшированием наложений через Web Audio, ✂ резка по бегунку, сплит/
 * склейка реплик, зум (−/+/вместить), правка текста/спикера/картинки/плана показа на реплику.
 *
 * Prop-driven: dialogue + setDialogue (мутатор), recordingUrl (для Web Audio плеера), onPickImage
 * (хост открывает свой пикер и кладёт image в реплику), showGestures (подкаст GPU), onDirty.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Play, Pause, Scissors, Minus, Plus, Image as ImageIcon, X, Combine, Sparkles } from 'lucide-react';
import { PodLine, PodAnim, POD_ANIMS, DlgMediaHint, DLG_MEDIA_HINTS } from './dialogueTypes';

interface Props {
  dialogue: PodLine[];
  setDialogue: (updater: (d: PodLine[]) => PodLine[]) => void;
  recordingUrl?: string | null;
  onDirty?: () => void;
  onPickImage?: (index: number) => void;
  onOmni?: (index: number) => void;
  showGestures?: boolean;
  dialogueMode?: boolean;   // режим «Диалоги»: на реплике с медиа — выбор раскладки + растяжка показа
  accentA?: string;
  accentB?: string;
}

/* Пределы масштаба: до 2000 px/сек — иначе плотные реплики (диаризация речи режет
   фразы по 0.1–0.5с) физически не разглядеть; старый потолок 160 был про «длинные» клипы. */
const MIN_PPS = 2;
const MAX_PPS = 2000;

export default function DialogueTimeline({ dialogue, setDialogue, recordingUrl, onDirty, onPickImage, onOmni, showGestures, dialogueMode, accentA = '#ec4899', accentB = '#8b5cf6' }: Props) {
  const dirty = () => { onDirty?.(); };
  const mutate = (fn: (d: PodLine[]) => PodLine[]) => { setDialogue(fn); dirty(); };
  const lineMutate = (i: number, patch: Partial<PodLine>) => mutate((d) => d.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const lineDel = (i: number) => { mutate((d) => d.filter((_, j) => j !== i)); setSelLine((s) => (s == null ? s : s === i ? null : s > i ? s - 1 : s)); };
  const lineAdd = () => mutate((d) => [...d, { speaker: 'A', text: '' }]);
  const setLineImage = (i: number, url: string | null) => lineMutate(i, { image: url || undefined, ...(url ? {} : { imageName: undefined }) });
  const setLineAnim = (i: number, v: PodAnim) => lineMutate(i, { anim: v });

  // ── таймлайн: длительность/позиция ──
  const lineDur = (l: PodLine): number => {
    if (Number.isFinite(l.start) && Number.isFinite(l.end) && (l.end as number) > (l.start as number)) return (l.end as number) - (l.start as number);
    return Math.max(1.5, Math.min(12, (l.text || '').length * 0.06));
  };
  const lineT = (l: PodLine, i: number, arr: PodLine[]): number => {
    if (Number.isFinite(l.tStart)) return l.tStart as number;
    if (Number.isFinite(l.start)) return l.start as number;
    let acc = 0; for (let j = 0; j < i; j++) acc += lineDur(arr[j]); return acc;
  };
  const isVideoUrl = (u?: string | null): boolean => !!u && /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(u);
  const tlMmss = (s: number): string => { const m = Math.floor(s / 60); const ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, '0')}`; };

  const splitLineAt = (i: number, tCut: number) => {
    const arr = dialogue; const l = arr[i]; if (!l) return;
    const t = lineT(l, i, arr); const d = lineDur(l); const off = tCut - t;
    if (off <= 0.1 || off >= d - 0.1) return;
    const frac = off / d;
    const words = (l.text || '').split(/\s+/).filter(Boolean);
    const hasTC = Number.isFinite(l.start) && Number.isFinite(l.end);
    if (!hasTC && words.length < 2) return;
    const cw = Math.max(1, Math.round(words.length * frac));
    const mid = hasTC ? (l.start as number) + ((l.end as number) - (l.start as number)) * frac : undefined;
    const a: PodLine = { ...l, text: words.slice(0, cw).join(' ') || l.text, tStart: t, ...(hasTC ? { end: mid } : {}) };
    const b: PodLine = { ...l, text: words.slice(cw).join(' '), tStart: Math.round((t + off) * 20) / 20, image: undefined, imageName: undefined, anim: undefined, ...(hasTC ? { start: mid } : {}) };
    mutate((p) => [...p.slice(0, i), a, b, ...p.slice(i + 1)]);
    setSelLine((s) => (s != null && s > i ? s + 1 : s));
  };
  const mergeLineDown = (i: number) => {
    mutate((p) => {
      const a = p[i]; const b = p[i + 1]; if (!a || !b) return p;
      const tA = lineT(a, i, p); const tB = lineT(b, i + 1, p);
      const [first, second] = tB < tA ? [b, a] : [a, b];
      const starts = [a.start, b.start].filter((x): x is number => Number.isFinite(x));
      const ends = [a.end, b.end].filter((x): x is number => Number.isFinite(x));
      const merged: PodLine = {
        ...a, text: [first.text, second.text].map((x) => (x || '').trim()).filter(Boolean).join(' '),
        tStart: Math.min(tA, tB), ...(starts.length ? { start: Math.min(...starts) } : {}), ...(ends.length ? { end: Math.max(...ends) } : {}),
        image: a.image || b.image, imageName: a.imageName || b.imageName, anim: a.anim || b.anim,
      };
      return [...p.slice(0, i), merged, ...p.slice(i + 2)];
    });
    setSelLine((s) => (s == null ? s : s === i + 1 ? i : s > i + 1 ? s - 1 : s));
  };

  // ── состояние таймлайна ──
  const tlDragRef = useRef<{ i: number; startX: number; startY: number; startT: number; spk: 'A' | 'B'; cur?: 'A' | 'B' } | null>(null);
  const [tlPps, setTlPps] = useState(44);
  const tlPpsRef = useRef(44);
  /* Якорь зума применяется СИНХРОННО после рендера с новым pps (layout-эффект):
     rAF-вариант дрейфовал при серии кликов/колеса — следующий шаг читал старый scrollLeft. */
  const tlZoomAnchorRef = useRef<{ t: number; x: number } | null>(null);
  useLayoutEffect(() => {
    tlPpsRef.current = tlPps;
    const a = tlZoomAnchorRef.current;
    if (a && tlWrapRef.current) { tlWrapRef.current.scrollLeft = Math.max(0, 32 + a.t * tlPps - a.x); tlZoomAnchorRef.current = null; }
  }, [tlPps]);
  const [tlPlayhead, setTlPlayhead] = useState(0);
  const tlPlayDragRef = useRef(false);
  const tlMovedRef = useRef(false);
  const tlWrapRef = useRef<HTMLDivElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selLine, setSelLine] = useState<number | null>(null);
  const [tlPlaying, setTlPlaying] = useState(false);
  const tlRafRef = useRef<number | null>(null);
  const tlRafPrevRef = useRef<number | null>(null);
  const tlCtxRef = useRef<AudioContext | null>(null);
  const tlBufRef = useRef<AudioBuffer | null>(null);
  const tlBufUrlRef = useRef<string | null>(null);
  const tlSrcsRef = useRef<AudioBufferSourceNode[]>([]);
  const tlPlaySeqRef = useRef(0);

  const cutAtPlayhead = () => {
    const arr = dialogue;
    const idx = arr.findIndex((l, i) => { const t = lineT(l, i, arr); return tlPlayhead > t + 0.1 && tlPlayhead < t + lineDur(l) - 0.1; });
    if (idx >= 0) splitLineAt(idx, tlPlayhead);
  };
  const fitTimeline = () => {
    const arr = dialogue;
    const total = Math.max(3, ...arr.map((l, i) => lineT(l, i, arr) + lineDur(l)));
    const w = (tlWrapRef.current?.clientWidth || 520) - 48;
    setTlPps(Math.max(MIN_PPS, Math.min(160, w / total)));
    if (tlWrapRef.current) tlWrapRef.current.scrollLeft = 0;
  };
  /* Зум с якорем: точка под бегунком (если он в кадре) или центр вьюпорта остаётся на месте.
     Без якоря глубокий зум «улетал» — прокрутку приходилось искать руками. */
  const zoomAt = (nextPps: number, anchorX?: number) => {
    const wrap = tlWrapRef.current;
    const oldPps = tlPpsRef.current;
    const next = Math.max(MIN_PPS, Math.min(MAX_PPS, nextPps));
    if (!wrap || next === oldPps) { setTlPps(next); return; }
    let ax = anchorX;
    if (ax == null) {
      const phX = 32 + tlPlayhead * oldPps - wrap.scrollLeft;
      ax = phX >= 0 && phX <= wrap.clientWidth ? phX : wrap.clientWidth / 2;
    }
    tlZoomAnchorRef.current = { t: Math.max(0, (wrap.scrollLeft + ax - 32) / oldPps), x: ax };
    setTlPps(next);
  };
  const tlStopSources = () => { for (const s of tlSrcsRef.current) { try { s.stop(); } catch { /* тихо */ } } tlSrcsRef.current = []; };
  const tlStop = () => {
    tlPlaySeqRef.current++;
    setTlPlaying(false); tlStopSources();
    if (tlRafRef.current != null) { cancelAnimationFrame(tlRafRef.current); tlRafRef.current = null; }
    tlRafPrevRef.current = null;
  };
  const tlLoadBuffer = async (): Promise<AudioBuffer | null> => {
    if (!recordingUrl) return null;
    const ctx = tlCtxRef.current || (tlCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)());
    if (tlBufRef.current && tlBufUrlRef.current === recordingUrl) return tlBufRef.current;
    const r = await fetch(recordingUrl); const ab = await r.arrayBuffer();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    tlBufRef.current = buf; tlBufUrlRef.current = recordingUrl; return buf;
  };
  const tlPlay = async () => {
    tlStop();
    const seq = tlPlaySeqRef.current;
    const arr = dialogue;
    const total = Math.max(1, ...arr.map((l, i) => lineT(l, i, arr) + lineDur(l)));
    let from = tlPlayhead; if (from >= total - 0.05) { from = 0; setTlPlayhead(0); }
    setTlPlaying(true);
    let buf: AudioBuffer | null = null;
    try { buf = await tlLoadBuffer(); } catch { buf = null; }
    const ctx = tlCtxRef.current;
    if (buf && ctx) {
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* тихо */ } }
      if (seq !== tlPlaySeqRef.current) return;
      tlStopSources();
      const t0 = ctx.currentTime + 0.08;
      arr.forEach((l, i) => {
        const st = Number(l.start); const en = Number(l.end);
        if (!Number.isFinite(st) || !Number.isFinite(en) || en <= st) return;
        const tStart = lineT(l, i, arr);
        const clipEnd = tStart + (en - st);
        if (clipEnd <= from) return;
        let offset = st; let dur = en - st; let when = t0 + (tStart - from);
        if (tStart < from) { const skip = from - tStart; offset = st + skip; dur -= skip; when = t0; }
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
    if (seq !== tlPlaySeqRef.current) return;
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
        const dx = e.clientX - d.startX; const dy = e.clientY - d.startY;
        const other: 'A' | 'B' = d.spk === 'A' ? 'B' : 'A';
        const toOther = d.spk === 'A' ? dy : -dy;
        let spk: 'A' | 'B' = d.cur || d.spk;
        if (spk === d.spk) { if (toOther >= 30 && Math.abs(dy) >= Math.abs(dx) * 0.6) spk = other; }
        else if (toOther < 14) { spk = d.spk; }
        d.cur = spk;
        setDialogue((p) => p.map((l, j) => (j === d.i ? { ...l, tStart: nt, speaker: spk } : l)));
      } else if (tlPlayDragRef.current && tlWrapRef.current) {
        const r = tlWrapRef.current.getBoundingClientRect();
        const x = e.clientX - r.left + tlWrapRef.current.scrollLeft - 32;
        const nt = Math.max(0, Math.round((x / tlPpsRef.current) * 20) / 20);
        setTlPlayhead(nt);
        if (tlSrcsRef.current.length || tlRafRef.current != null) tlStop();
      }
    };
    const up = () => {
      if (tlDragRef.current) {
        tlDragRef.current = null;
        if (tlMovedRef.current) dirty();
        window.setTimeout(() => { tlMovedRef.current = false; }, 0);
      }
      tlPlayDragRef.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => tlStop(), []);

  /* Ctrl+колесо над таймлайном = зум к курсору (как в CapCut/Premiere).
     Нативный слушатель с passive:false — React-обёртка не даёт preventDefault для wheel.
     Зависимость hasLines: при монтировании с ПУСТЫМ диалогом (подкаст/Комментатор) компонент
     возвращает null и div-а ещё нет — слушатель вешается, когда таймлайн реально появился. */
  const hasLines = dialogue.length > 0;
  useEffect(() => {
    const el = tlWrapRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const oldPps = tlPpsRef.current;
      const next = Math.max(MIN_PPS, Math.min(MAX_PPS, oldPps * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
      if (next === oldPps) return;
      const x = e.clientX - el.getBoundingClientRect().left;
      tlZoomAnchorRef.current = { t: Math.max(0, (el.scrollLeft + x - 32) / oldPps), x };
      setTlPps(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLines]);

  if (!dialogue.length) return null;
  const arr = dialogue;
  const total = Math.max(3, ...arr.map((l, i) => lineT(l, i, arr) + lineDur(l)));
  const W = Math.ceil(total) * tlPps + 40;
  const step = tlPps >= 40 ? 1 : tlPps >= 22 ? 2 : tlPps >= 11 ? 5 : 10;
  const phLeft = 32 + tlPlayhead * tlPps;

  return (
    <div className="space-y-1.5">
      {/* Таймлайн (наложение голосов) */}
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <span className="text-[11px] font-600 inline-flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          Таймлайн (наложение голосов)
          <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{tlMmss(tlPlayhead)} / {tlMmss(total)}</span>
        </span>
        <div className="inline-flex items-center gap-1.5">
          <button onClick={tlTogglePlay} title={tlPlaying ? 'Пауза' : 'Воспроизвести с бегунка'} className="w-6 h-6 rounded-lg inline-flex items-center justify-center" style={{ background: tlPlaying ? '#10b981' : 'var(--bg-tertiary)', color: tlPlaying ? '#fff' : '#10b981', border: `1px solid ${tlPlaying ? '#10b981' : 'var(--border-medium)'}`, cursor: 'pointer' }}>{tlPlaying ? <Pause size={13} /> : <Play size={13} />}</button>
          <button onClick={cutAtPlayhead} title="Разрезать по бегунку (✂)" className="w-6 h-6 rounded-lg inline-flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: accentA, border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Scissors size={13} /></button>
          <button onClick={() => zoomAt(tlPpsRef.current / 1.4)} title="Уменьшить масштаб (Ctrl+колесо)" className="w-6 h-6 rounded-lg inline-flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Minus size={13} /></button>
          <button onClick={() => zoomAt(tlPpsRef.current * 1.4)} title="Увеличить масштаб (Ctrl+колесо)" className="w-6 h-6 rounded-lg inline-flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Plus size={13} /></button>
          <button onClick={fitTimeline} title="Вместить всё" className="text-[10px] font-600 px-2 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>вместить</button>
        </div>
      </div>
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
              <span style={{ position: 'absolute', left: 6, top: 9, fontSize: 10, fontWeight: 700, color: trk === 'A' ? accentA : accentB }}>{trk}</span>
              <div style={{ position: 'absolute', left: 32, right: 0, top: 0, bottom: 0 }}>
                {arr.map((l, i) => {
                  if ((l.speaker === 'B' ? 'B' : 'A') !== trk) return null;
                  const t = lineT(l, i, arr); const d = lineDur(l);
                  const w = Math.max(6, d * tlPps - 2);
                  const sel = selLine === i;
                  const showText = w >= 40;
                  const showThumb = w >= 46 && !!l.image;
                  const vid = isVideoUrl(l.image);
                  return (
                    <div key={i}
                      onPointerDown={(e) => { e.preventDefault(); tlMovedRef.current = false; tlDragRef.current = { i, startX: e.clientX, startY: e.clientY, startT: t, spk: trk }; }}
                      onClick={() => { if (tlMovedRef.current) { tlMovedRef.current = false; return; } setSelLine(i); setDialogOpen(true); setTimeout(() => document.getElementById(`dl-${i}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60); }}
                      title={l.text}
                      style={{ position: 'absolute', left: t * tlPps, width: w, top: 2, height: 30, borderRadius: 7,
                        background: trk === 'A' ? 'linear-gradient(180deg, rgba(244,114,182,0.96), rgba(219,39,119,0.96))' : 'linear-gradient(180deg, rgba(167,139,250,0.96), rgba(124,58,237,0.96))',
                        color: '#fff', fontSize: 9, lineHeight: '30px', padding: showText ? '0 6px' : '0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'grab', userSelect: 'none', touchAction: 'none',
                        border: sel ? 'none' : '1px solid rgba(255,255,255,0.18)', boxShadow: sel ? `0 0 0 2px #fff, 0 0 0 4px ${accentA}` : '0 1px 3px rgba(0,0,0,0.28)' }}>
                      {showThumb && (vid
                        ? <span style={{ position: 'absolute', right: 2, top: 2, width: 26, height: 26, borderRadius: 4, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={12} fill="#fff" style={{ color: '#fff' }} /></span>
                        : <img src={l.image} alt="" style={{ position: 'absolute', right: 2, top: 2, width: 26, height: 26, objectFit: 'cover', borderRadius: 4 }} />)}
                      {showText ? <span style={{ pointerEvents: 'none' }}>{l.text || `реплика ${i + 1}`}</span>
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
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>▶ — играть с бегунка; тащи клипы по времени, ВВЕРХ/ВНИЗ — на дорожку другого голоса; бегунок ведёшь и ✂ режет по нему; −/+/вместить или Ctrl+колесо — масштаб (зум держит точку под бегунком/курсором). Клик по клипу открывает реплику ниже. Наложение A/B = одновременно.</p>

      {/* Реплики */}
      <button onClick={() => setDialogOpen((o) => !o)} className="w-full flex items-center justify-between text-[11px] font-600 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
        <span>Реплики ({arr.length}) — открыть/свернуть</span><span>{dialogOpen ? '▾' : '▸'}</span>
      </button>
      {dialogOpen && (
        <div className="space-y-1.5" style={{ maxHeight: 300, overflowY: 'auto' }}>
          {arr.map((l, i) => (
            <div key={i} id={`dl-${i}`} className="rounded-lg p-1.5" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${selLine === i ? accentA : 'var(--border-medium)'}` }}>
              <div className="flex items-start gap-1.5">
                <button onClick={() => lineMutate(i, { speaker: l.speaker === 'A' ? 'B' : 'A' })} title="Сменить голос" className="flex-shrink-0 w-7 h-7 rounded-lg text-[11px] font-700 flex items-center justify-center mt-0.5" style={{ background: l.speaker === 'A' ? accentA : accentB, color: '#fff', border: 'none', cursor: 'pointer' }}>{l.speaker}</button>
                <textarea value={l.text} onChange={(e) => lineMutate(i, { text: e.target.value })} rows={1} className="flex-1 px-2 py-1.5 rounded-lg text-[12px] outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', resize: 'vertical' }} />
                {l.image ? (
                  <div className="relative flex-shrink-0 mt-0.5" style={{ width: 28, height: 28 }}>
                    {isVideoUrl(l.image) ? (
                      <><video src={l.image} muted preload="metadata" className="w-full h-full object-cover rounded-lg" style={{ border: `1px solid ${accentA}` }} /><span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={11} fill="#fff" style={{ color: '#fff' }} /></span></>
                    ) : (<img src={l.image} alt="" className="w-full h-full object-cover rounded-lg" style={{ border: `1px solid ${accentA}` }} />)}
                    <button onClick={() => setLineImage(i, null)} title="Убрать медиа" className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full" style={{ background: 'rgba(0,0,0,0.8)', color: '#fff', border: 'none', cursor: 'pointer' }}><X size={9} /></button>
                  </div>
                ) : (
                  <button onClick={() => onPickImage?.(i)} title="Прикрепить фото/видео к фразе" className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'var(--bg-secondary)', color: accentA, border: '1px solid var(--border-medium)', cursor: 'pointer' }}><ImageIcon size={13} /></button>
                )}
                {i < arr.length - 1 && (
                  <button onClick={() => mergeLineDown(i)} title="Объединить со следующей" className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'var(--bg-secondary)', color: accentB, border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Combine size={13} /></button>
                )}
                {onOmni && (
                  <button onClick={() => onOmni(i)} title="Сгенерировать Omni-клип на эту фразу" className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'var(--bg-secondary)', color: '#6366f1', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Sparkles size={13} /></button>
                )}
                <button onClick={() => lineDel(i)} title="Удалить реплику" className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: 'var(--bg-secondary)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><X size={13} /></button>
              </div>
              {showGestures && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5" style={{ paddingLeft: 34 }}>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Жест:</span>
                  {([['Авто', undefined], ['Без', 0], ['Слабо', 30], ['Средне', 60], ['Сильно', 95]] as [string, number | undefined][]).map(([lbl, val]) => {
                    const sel = val === undefined ? (l.gesture === undefined || l.gesture === null) : l.gesture === val;
                    return (<button key={lbl} onClick={() => lineMutate(i, { gesture: val })} className="text-[10px] font-600 px-1.5 py-0.5 rounded-md" style={{ background: sel ? accentB : 'var(--bg-secondary)', color: sel ? '#fff' : 'var(--text-muted)', border: `1px solid ${sel ? accentB : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>);
                  })}
                </div>
              )}
              {/* Режим «Диалоги»: раскладка медиа + растяжка показа (сдвигает следующие реплики) */}
              {l.image && dialogueMode && (
                <>
                  <div className="flex flex-wrap items-center gap-1 mt-1.5" style={{ paddingLeft: 34 }}>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Показ:</span>
                    {DLG_MEDIA_HINTS.map((h) => { const sel = (l.layoutHint || 'auto') === h.v; return (
                      <button key={h.v} onClick={() => lineMutate(i, { layoutHint: h.v })} className="text-[10px] font-600 px-2 py-1 rounded-md" style={{ background: sel ? accentA : 'var(--bg-secondary)', color: sel ? '#fff' : 'var(--text-muted)', border: `1px solid ${sel ? accentA : 'var(--border-medium)'}`, cursor: 'pointer' }}>{h.label}</button>
                    ); })}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1" style={{ paddingLeft: 34 }}>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Держать медиа:</span>
                    <input type="number" min={0} step={0.5} value={l.holdSec ? Math.round(l.holdSec * 10) / 10 : ''}
                      onChange={(e) => { const v = parseFloat(e.target.value); lineMutate(i, { holdSec: Number.isFinite(v) && v > 0 ? v : undefined }); }}
                      placeholder={`${lineDur(l).toFixed(1)}`} className="w-16 px-2 py-1 rounded-md text-[10px] outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>сек {l.holdSec && l.holdSec > lineDur(l) ? `· +${(l.holdSec - lineDur(l)).toFixed(1)}с, реплики сдвинутся` : `· реплика ${lineDur(l).toFixed(1)}с`}</span>
                  </div>
                </>
              )}
              {l.image && !dialogueMode && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5" style={{ paddingLeft: 34 }}>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Кадр:</span>
                  {([['full', 'Во весь кадр'], ['card', 'Карточка']] as ['full' | 'card', string][]).map(([m, lbl]) => { const sel = (l.mode || 'card') === m; return (
                    <button key={m} onClick={() => lineMutate(i, { mode: m })} className="text-[10px] font-600 px-2 py-1 rounded-md" style={{ background: sel ? '#6366f1' : 'var(--bg-secondary)', color: sel ? '#fff' : 'var(--text-muted)', border: `1px solid ${sel ? '#6366f1' : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
                  ); })}
                </div>
              )}
              {l.image && !dialogueMode && l.mode === 'full' && (
                <div className="flex items-center gap-1 mt-1" style={{ paddingLeft: 34 }}>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Плашка:</span>
                  <input value={l.title || ''} onChange={(e) => lineMutate(i, { title: e.target.value.slice(0, 60) })} placeholder="заголовок 2–5 слов (необязательно)" className="flex-1 px-2 py-1 rounded-md text-[10px] outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                </div>
              )}
              {l.image && !dialogueMode && (l.mode || 'card') === 'card' && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5" style={{ paddingLeft: 34 }}>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Выезд:</span>
                  {POD_ANIMS.map((a) => { const sel = (l.anim || 'auto') === a.v; return (
                    <button key={a.v} onClick={() => setLineAnim(i, a.v)} className="text-[10px] font-600 px-2 py-1 rounded-md" style={{ background: sel ? accentA : 'var(--bg-secondary)', color: sel ? '#fff' : 'var(--text-muted)', border: `1px solid ${sel ? accentA : 'var(--border-medium)'}`, cursor: 'pointer' }}>{a.label}</button>
                  ); })}
                </div>
              )}
            </div>
          ))}
          <button onClick={lineAdd} className="text-[11px] font-600 inline-flex items-center gap-1" style={{ color: accentA, background: 'transparent', border: 'none', cursor: 'pointer' }}><Plus size={12} /> Добавить реплику</button>
        </div>
      )}
    </div>
  );
}
