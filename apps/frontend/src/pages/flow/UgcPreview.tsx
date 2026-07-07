/**
 * UgcPreview — интерактивное превью кадра UGC-студии (фаза 2 редизайна).
 *
 * Чистая функция «спека → кадр»: пустые зоны кликабельны («пока не выбрано» → пикер),
 * субтитры — живой пример (слова из первой реплики реального скрипта), для режимов
 * «Динамичный монтаж» и «Диалог двоих» — кликабельная полоса плана: превью показывает
 * каждый план кадра (крупный / пополам / врезка $0 / фон+лицо). Полоса — иллюстрация
 * типового плана пресета; точное распределение по фразам делает ИИ на сборке.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Play, Plus, UserRound } from 'lucide-react';
import type { UgcMode, UgcSpec } from './ugcTypes';

const ACC = '#a855f7';
const ACC2 = '#c084fc';
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── план сегментов (иллюстрация пресета; реальный план строит ИИ по тексту) ── */
type SegView = 'closeup' | 'split' | 'broll' | 'pip' | 'dlgA' | 'dlgB' | 'both';
interface PlanSeg { label: string; sub: string; kind: 'iv' | 'iii' | 'free'; view: SegView }

function retPlan(preset: UgcSpec['retentionPreset']): PlanSeg[] {
  if (preset === 'eco') return [
    { label: 'Крючок', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
    { label: 'Связка', sub: 'Avatar III', kind: 'iii', view: 'split' },
    { label: 'Врезка', sub: '$0', kind: 'free', view: 'broll' },
    { label: 'Врезка', sub: '$0', kind: 'free', view: 'broll' },
    { label: 'Призыв', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
  ];
  if (preset === 'prem') return [
    { label: 'Крючок', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
    { label: 'Связка', sub: 'Avatar III', kind: 'iii', view: 'split' },
    { label: 'Действие', sub: 'Avatar IV', kind: 'iv', view: 'pip' },
    { label: 'Врезка', sub: '$0', kind: 'free', view: 'broll' },
    { label: 'Эмоция', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
    { label: 'Призыв', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
  ];
  return [
    { label: 'Крючок', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
    { label: 'Связка', sub: 'Avatar III', kind: 'iii', view: 'split' },
    { label: 'Врезка', sub: '$0', kind: 'free', view: 'broll' },
    { label: 'Действие', sub: 'Avatar IV', kind: 'iv', view: 'pip' },
    { label: 'Врезка', sub: '$0', kind: 'free', view: 'broll' },
    { label: 'Призыв', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
  ];
}
function dlgPlan(engagement: UgcSpec['dialogueEngagement']): PlanSeg[] {
  if (engagement === 'eco') return [
    { label: 'A крупно', sub: 'говорит A', kind: 'iii', view: 'dlgA' },
    { label: 'B крупно', sub: 'говорит B', kind: 'iii', view: 'dlgB' },
    { label: 'A крупно', sub: 'Avatar IV', kind: 'iv', view: 'dlgA' },
    { label: 'Врезка', sub: '$0', kind: 'free', view: 'broll' },
    { label: 'B крупно', sub: 'говорит B', kind: 'iii', view: 'dlgB' },
  ];
  if (engagement === 'dyn') return [
    { label: 'Оба в кадре', sub: 'реакция $0', kind: 'iv', view: 'both' },
    { label: 'A крупно', sub: 'Avatar IV', kind: 'iv', view: 'dlgA' },
    { label: 'Врезка', sub: '$0', kind: 'free', view: 'broll' },
    { label: 'Фон + лицо', sub: 'вырезка', kind: 'iii', view: 'pip' },
    { label: 'B крупно', sub: 'Avatar IV', kind: 'iv', view: 'dlgB' },
    { label: 'Оба в кадре', sub: 'реакция $0', kind: 'iii', view: 'both' },
  ];
  return [
    { label: 'A крупно', sub: 'Avatar IV', kind: 'iv', view: 'dlgA' },
    { label: 'Оба в кадре', sub: 'реакция $0', kind: 'iii', view: 'both' },
    { label: 'B крупно', sub: 'говорит B', kind: 'iii', view: 'dlgB' },
    { label: 'Фон + лицо', sub: 'вырезка', kind: 'iii', view: 'pip' },
    { label: 'Врезка', sub: '$0', kind: 'free', view: 'broll' },
    { label: 'A крупно', sub: 'Avatar IV', kind: 'iv', view: 'dlgA' },
  ];
}

const CHECKER: React.CSSProperties = {
  backgroundImage: 'conic-gradient(#3a3a42 25%, #2a2a30 0 50%, #3a3a42 0 75%, #2a2a30 0)',
  backgroundSize: '14px 14px',
};

export interface UgcPreviewProps {
  ugc: UgcSpec;
  mode: UgcMode;
  onEmptyAvatar: () => void;
  onEmptyPhotoB: () => void;
  onEmptyClip: () => void;
  onOpenLines: () => void;   // «медиа реплики» в диалоге живёт на таймлайне — открыть панель «Реплики»
}

const isVideoUrl = (u?: string | null): boolean => !!u && /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(u);

export default function UgcPreview({ ugc, mode, onEmptyAvatar, onEmptyPhotoB, onEmptyClip, onOpenLines }: UgcPreviewProps) {
  const avatarImg = ugc.avatarSource === 'collection' ? ugc.avatarUrl : ugc.photoUrl;
  const firstLineMedia = ugc.script.find((l) => !!l.image)?.image || null;

  /* полоса плана: активный сегмент; сбрасывается при смене режима/пресета */
  const plan: PlanSeg[] | null = mode === 'retention' ? retPlan(ugc.retentionPreset) : mode === 'dialogue' ? dlgPlan(ugc.dialogueEngagement) : null;
  const [curSeg, setCurSeg] = useState(0);
  useEffect(() => { setCurSeg(0); }, [mode, ugc.retentionPreset, ugc.dialogueEngagement]);
  const seg = plan ? plan[Math.min(curSeg, plan.length - 1)] : null;

  /* живые субтитры: слова из первой реплики реального скрипта (или образец) */
  const words = useMemo(() => {
    const t = (ugc.script[0]?.text || '').trim();
    const ws = t ? t.split(/\s+/).slice(0, 8) : ['Пример', 'живых', 'субтитров'];
    return ws.length >= 2 ? ws : [...ws, '…'];
  }, [ugc.script]);
  const [widx, setWidx] = useState(0);
  const animate = !reducedMotion && (ugc.subtitles.style === 'word' || ugc.subtitles.style === 'karaoke');
  useEffect(() => {
    if (!animate) return;
    const t = window.setInterval(() => setWidx((i) => i + 1), 650);
    return () => window.clearInterval(t);
  }, [animate, words]);

  const caption = (fmt: '9x16' | '16x9') => {
    if (ugc.subtitles.style === 'none') return null;
    const pos: React.CSSProperties = ugc.subtitles.pos === 'top' ? { top: '8%' } : ugc.subtitles.pos === 'center' ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: '9%' };
    const hot = widx % words.length;
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 6, display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: '0 12px', ...pos }}>
        {ugc.subtitles.style === 'word' ? (
          <span key={hot} className="ugc-cap-pop" style={{ fontSize: fmt === '16x9' ? 22 : 19, fontWeight: 850, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>{words[hot]}</span>
        ) : (
          <span style={{ fontSize: 11.5, fontWeight: 750, color: '#fff', textAlign: 'center', textShadow: '0 1px 6px rgba(0,0,0,.85)', lineHeight: 1.35 }}>
            {ugc.subtitles.style === 'karaoke'
              ? words.map((w, i) => <span key={i} style={{ color: i === hot ? ACC2 : '#fff', transition: 'color .15s' }}>{w}{i < words.length - 1 ? ' ' : ''}</span>)
              : words.join(' ')}
          </span>
        )}
      </div>
    );
  };

  /* ── ячейки кадра ── */
  const cellTag = (t: string) => (
    <span style={{ position: 'absolute', top: 6, left: 6, zIndex: 3, fontSize: 8.5, fontWeight: 750, letterSpacing: '.05em', textTransform: 'uppercase', color: '#fff', background: 'rgba(0,0,0,.5)', borderRadius: 999, padding: '2px 7px', pointerEvents: 'none' }}>{t}</span>
  );
  const emptyCell = (title: string, sub: string, onClick: () => void) => (
    <button onClick={onClick} className="w-full h-full flex flex-col items-center justify-center gap-1.5"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a9aa4' }}>
      <span className="flex items-center justify-center rounded-xl" style={{ width: 46, height: 46, border: '1.5px dashed #5c5c66', color: '#8b8b93' }}><Plus size={18} /></span>
      <b className="text-[10.5px] font-700" style={{ color: '#a3a3ad' }}>{title}</b>
      <span className="text-[9.5px]" style={{ color: '#77777f' }}>{sub}</span>
    </button>
  );
  const faceCell = (url: string | null, tag: string, onEmpty: () => void, emptyTitle?: string) => (
    <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden" style={{ background: '#101013' }}>
      {url ? (<>{cellTag(tag)}<img src={url} alt="" className="w-full h-full object-cover" /></>)
        : emptyCell(emptyTitle || `${tag} — пока не выбран`, 'нажмите, чтобы выбрать', onEmpty)}
    </div>
  );
  const clipCell = (tag: string, emptySub?: string) => (
    <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden" style={{ background: '#101013' }}>
      {ugc.clip ? (
        <>
          {cellTag(tag + (ugc.clipFit === 'contain' ? ' · целиком' : ''))}
          <video src={`${ugc.clip.url}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full" style={{ objectFit: ugc.clipFit === 'contain' ? 'contain' : 'cover' }} />
          <span className="absolute flex items-center justify-center rounded-full" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 32, height: 32, background: 'rgba(0,0,0,.45)', border: '1.5px solid rgba(255,255,255,.75)', pointerEvents: 'none' }}><Play size={14} color="#fff" fill="#fff" /></span>
        </>
      ) : emptyCell('Видео — пока не загружено', emptySub || 'нажмите — выбрать из Галереи', onEmptyClip)}
    </div>
  );
  /* «медиа реплики» в диалоге: превью первого прикреплённого медиа; пусто → в панель «Реплики» */
  const lineMediaCell = (tag: string) => (
    <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden" style={{ background: '#101013' }}>
      {firstLineMedia ? (
        <>
          {cellTag(tag)}
          {isVideoUrl(firstLineMedia)
            ? <video src={`${firstLineMedia}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
            : <img src={firstLineMedia} alt="" className="w-full h-full object-cover" />}
        </>
      ) : emptyCell('Медиа реплики — пока нет', 'прикрепите фото или видео к реплике (⊞)', onOpenLines)}
    </div>
  );

  /* аватар маленьким поверх видео; cutout → шахматная кайма и без «карточки» (иллюстрация прозрачного фона) */
  const overlayAvatar = (side: 'left' | 'right', cutout: boolean, url: string | null, onEmpty: () => void) => (
    <div style={{ position: 'absolute', bottom: 0, width: '44%', height: '42%', zIndex: 4, ...(side === 'right' ? { right: '4%' } : { left: '4%' }) }}>
      {url ? (
        cutout ? (
          <div className="w-full h-full" style={{ ...CHECKER, borderRadius: '12px 12px 0 0', padding: 4 }} title="Прозрачный фон — в ролике останется только человек">
            <img src={url} alt="" className="w-full h-full object-cover" style={{ borderRadius: '9px 9px 0 0' }} />
            <span style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 750, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', background: ACC, borderRadius: 999, padding: '1.5px 7px', whiteSpace: 'nowrap' }}>прозрачный фон</span>
          </div>
        ) : (
          <img src={url} alt="" className="w-full h-full object-cover" style={{ borderRadius: '12px 12px 0 0', border: '1px solid rgba(255,255,255,.25)', borderBottom: 'none' }} />
        )
      ) : (
        <button onClick={onEmpty} className="w-full h-full flex flex-col items-center justify-center gap-1 text-[9px] font-650"
          style={{ border: '1.5px dashed #6b6b75', borderRadius: 12, background: 'rgba(0,0,0,.35)', color: '#9a9aa4', cursor: 'pointer' }}>
          <UserRound size={16} /> Аватар — пока<br />не выбран
        </button>
      )}
    </div>
  );

  /* ── содержимое кадра по режиму и активному сегменту плана ── */
  const frameInner = (fmt: '9x16' | '16x9') => {
    const row = fmt === '16x9';
    const stack = (a: React.ReactNode, b: React.ReactNode) => (
      <div className={`absolute inset-0 flex ${row ? 'flex-row' : 'flex-col'}`}>{a}{b}</div>
    );
    const full = (node: React.ReactNode) => <div className="absolute inset-0 flex">{node}</div>;

    if (mode === 'dialogue') {
      const view = seg?.view || 'dlgA';
      if (view === 'dlgA') return full(faceCell(ugc.photoUrl, 'Собеседник A · крупный план', onEmptyAvatar, 'Собеседник A — пока не выбран'));
      if (view === 'dlgB') return full(faceCell(ugc.photoBUrl, 'Собеседник B · крупный план', onEmptyPhotoB, 'Собеседник B — пока не выбран'));
      if (view === 'both') return stack(
        faceCell(ugc.photoUrl, 'Собеседник A', onEmptyAvatar, 'Собеседник A — пока не выбран'),
        faceCell(ugc.photoBUrl, 'Собеседник B · реакция $0', onEmptyPhotoB, 'Собеседник B — пока не выбран'),
      );
      if (view === 'pip') return (
        <div className="absolute inset-0 flex">
          {lineMediaCell('Медиа реплики · фоном')}
          {overlayAvatar('left', ugc.dialogueCutout, ugc.photoUrl, onEmptyAvatar)}
        </div>
      );
      return full(lineMediaCell('Врезка · лица нет · $0'));
    }

    if (mode === 'retention') {
      const view = seg?.view || 'closeup';
      if (view === 'closeup') return full(faceCell(avatarImg, 'Аватар · крупный план', onEmptyAvatar));
      if (view === 'split') return ugc.placement === 'bottom'
        ? stack(clipCell('Видеоряд'), faceCell(avatarImg, 'Аватар', onEmptyAvatar))
        : stack(faceCell(avatarImg, 'Аватар', onEmptyAvatar), clipCell('Видеоряд'));
      if (view === 'pip') return (
        <div className="absolute inset-0 flex">
          {clipCell('Видеоряд')}
          {overlayAvatar('left', false, avatarImg, onEmptyAvatar)}
        </div>
      );
      return full(clipCell('Врезка · лица нет · $0'));
    }

    /* solo: раскладка спеки */
    if (ugc.placement === 'overlay-left' || ugc.placement === 'overlay-right') return (
      <div className="absolute inset-0 flex">
        {clipCell('Видеоряд')}
        {overlayAvatar(ugc.placement === 'overlay-right' ? 'right' : 'left', false, avatarImg, onEmptyAvatar)}
      </div>
    );
    const av = faceCell(avatarImg, 'Аватар', onEmptyAvatar);
    const vid = clipCell('Видеоряд', 'не обязательно · нажмите, чтобы выбрать');
    return ugc.placement === 'bottom' ? stack(vid, av) : stack(av, vid);
  };

  const frame = (fmt: '9x16' | '16x9', mini?: boolean) => {
    const dims = fmt === '9x16' ? (mini ? { w: 132, h: 235 } : { w: 246, h: 437 }) : (mini ? { w: 300, h: 169 } : { w: 496, h: 279 });
    return (
      <div key={fmt} className="flex flex-col items-center gap-2">
        <span className="text-[10.5px] font-600" style={{ color: 'var(--text-muted)' }}>{fmt === '9x16' ? '9:16 · TikTok, Reels, Shorts' : '16:9 · YouTube'}</span>
        <div className="relative overflow-hidden" style={{ width: dims.w, height: dims.h, borderRadius: fmt === '9x16' ? 20 : 14, border: '1px solid var(--border-strong)', background: '#101013', boxShadow: '0 14px 34px rgba(0,0,0,.35)' }}>
          {frameInner(fmt)}
          {caption(fmt)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* однократные кейфреймы для «слова» субтитров */}
      <style>{'@keyframes ugcCapPop{from{transform:scale(.55);opacity:0}to{transform:scale(1);opacity:1}} .ugc-cap-pop{animation:ugcCapPop .3s cubic-bezier(.2,1.6,.4,1)}'}</style>

      <div className="flex-1 flex items-center justify-center gap-6 flex-wrap px-4 pb-1" style={{ minHeight: 0 }}>
        {ugc.formats.includes('9x16') && frame('9x16', false)}
        {ugc.formats.includes('16x9') && frame('16x9', ugc.formats.length > 1)}
      </div>

      {/* полоса плана: кликните сегмент — превью покажет этот план кадра */}
      {plan && (
        <div className="flex flex-col items-center gap-1.5 px-4 pb-1">
          <div className="flex gap-1 flex-wrap justify-center">
            {plan.map((s, i) => {
              const on = i === Math.min(curSeg, plan.length - 1);
              const st: React.CSSProperties = s.kind === 'iv'
                ? { background: ACC, borderColor: ACC, color: '#fff' }
                : s.kind === 'iii'
                  ? { background: 'rgba(168,85,247,.14)', borderColor: 'rgba(168,85,247,.45)', color: ACC }
                  : { background: 'var(--bg-secondary)', borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' };
              return (
                <button key={i} onClick={() => setCurSeg(i)}
                  className="flex flex-col items-center rounded-lg px-2.5 py-1"
                  style={{ ...st, border: `1px solid ${String(st.borderColor)}`, cursor: 'pointer', minWidth: 58, boxShadow: on ? `0 0 0 2px var(--bg-primary), 0 0 0 3.5px ${ACC2}` : 'none' }}>
                  <span className="text-[9.5px] font-750" style={{ letterSpacing: '.02em' }}>{s.label}</span>
                  <span className="text-[8.5px] font-650" style={{ color: s.kind === 'iv' ? 'rgba(255,255,255,.78)' : s.kind === 'free' ? '#10b981' : undefined, opacity: s.kind === 'iii' ? .8 : 1 }}>{s.sub}</span>
                </button>
              );
            })}
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {mode === 'retention'
              ? 'Примерный план пресета: фиолетовое — дорогой Avatar IV, «$0» — сегменты без лица. Точный план ИИ строит по вашему тексту.'
              : 'Примерный план диалога: ИИ решает, когда крупный план, когда оба в кадре (реакция — статичное фото, $0).'}
          </span>
        </div>
      )}
    </>
  );
}
