/**
 * AudioPlayer — компактный аудио-плеер в стиле приложения (тёмная/светлая тема).
 *
 * Нативный <audio controls> не подчиняется теме (всегда браузерный дефолт).
 * Здесь — свой минимальный плеер на CSS-переменных дизайн-системы
 * (var(--brand)/--bg-tertiary/--text-*), поэтому он корректен в обеих темах.
 * Play/pause + перемотка кликом/тягой по дорожке + время + mute.
 *
 * Используется в Галерее (карточки аудио) и в блоке «Hotebook» (артефакты) —
 * слушать прямо на месте, без открытия файла в новой вкладке.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AudioPlayer({ src, className, autoLoad = true }: { src: string; className?: string; autoLoad?: boolean }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => { if (!draggingRef.current) setCur(a.currentTime); };
    const onDur = () => setDur(a.duration || 0);
    const onEnd = () => { setPlaying(false); setCur(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onDur);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onDur);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, []);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const seekFromEvent = (clientX: number) => {
    const el = trackRef.current, a = ref.current;
    if (!el || !a || !dur) return;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const t = frac * dur;
    a.currentTime = t; setCur(t);
  };
  const onTrackDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    seekFromEvent(e.clientX);
  };
  const onTrackMove = (e: React.PointerEvent) => { if (draggingRef.current) seekFromEvent(e.clientX); };
  const onTrackUp = (e: React.PointerEvent) => {
    if (draggingRef.current) { draggingRef.current = false; try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { /* */ } }
  };
  const toggleMute = () => { const a = ref.current; if (a) { a.muted = !a.muted; setMuted(a.muted); } };

  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  return (
    <div className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', padding: '8px 10px', borderRadius: 12,
        background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
      <audio ref={ref} src={src} preload={autoLoad ? 'metadata' : 'none'} />
      {/* Ряд 1: play/pause + текущее/полное время + mute */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={toggle} title={playing ? 'Пауза' : 'Воспроизвести'}
          className="flex-shrink-0" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--brand)', color: 'var(--brand-contrast)' }}>
          {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
        </button>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmt(cur)}</span>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmt(dur)}</span>
        <button type="button" onClick={toggleMute} title={muted ? 'Включить звук' : 'Выключить звук'}
          className="flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-muted)' }}>
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
      {/* Ряд 2: ПОЛЗУНОК перемотки на всю ширину (крупная зона захвата — легко таскать). */}
      <div ref={trackRef} onPointerDown={onTrackDown} onPointerMove={onTrackMove} onPointerUp={onTrackUp}
        style={{ position: 'relative', width: '100%', height: 16, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}>
        <div style={{ position: 'relative', width: '100%', height: 6, borderRadius: 999, background: 'var(--bg-primary)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'var(--brand)', borderRadius: 999 }} />
          <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', width: 14, height: 14, marginLeft: -7, marginTop: -7,
            borderRadius: '50%', background: 'var(--brand)', border: '2px solid var(--bg-secondary)', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }} />
        </div>
      </div>
    </div>
  );
}

export default AudioPlayer;
