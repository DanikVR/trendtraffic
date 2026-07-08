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
import { useTranslation } from 'react-i18next';
import { Play, Plus, UserRound, Move, Maximize2 } from 'lucide-react';
import { avatarDefaultRect, type UgcAvatarRect, type UgcFormat, type UgcMode, type UgcSpec } from './ugcTypes';
import { parseCapWishes } from './ugcCapWishes';

const ACC = '#a855f7';
const ACC2 = '#c084fc';
const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── план сегментов (иллюстрация пресета; реальный план строит ИИ по тексту) ── */
type SegView = 'closeup' | 'split' | 'broll' | 'pip' | 'dlgA' | 'dlgB' | 'both';
interface PlanSeg { labelKey: string; sub?: string; subKey?: string; kind: 'iv' | 'iii' | 'free'; view: SegView }

function retPlan(preset: UgcSpec['retentionPreset']): PlanSeg[] {
  if (preset === 'eco') return [
    { labelKey: 'ugc.plan.hook', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
    { labelKey: 'ugc.plan.bridge', sub: 'Avatar III', kind: 'iii', view: 'split' },
    { labelKey: 'ugc.plan.cutaway', sub: '$0', kind: 'free', view: 'broll' },
    { labelKey: 'ugc.plan.cutaway', sub: '$0', kind: 'free', view: 'broll' },
    { labelKey: 'ugc.plan.cta', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
  ];
  if (preset === 'prem') return [
    { labelKey: 'ugc.plan.hook', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
    { labelKey: 'ugc.plan.bridge', sub: 'Avatar III', kind: 'iii', view: 'split' },
    { labelKey: 'ugc.plan.action', sub: 'Avatar IV', kind: 'iv', view: 'pip' },
    { labelKey: 'ugc.plan.cutaway', sub: '$0', kind: 'free', view: 'broll' },
    { labelKey: 'ugc.plan.emotion', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
    { labelKey: 'ugc.plan.cta', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
  ];
  return [
    { labelKey: 'ugc.plan.hook', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
    { labelKey: 'ugc.plan.bridge', sub: 'Avatar III', kind: 'iii', view: 'split' },
    { labelKey: 'ugc.plan.cutaway', sub: '$0', kind: 'free', view: 'broll' },
    { labelKey: 'ugc.plan.action', sub: 'Avatar IV', kind: 'iv', view: 'pip' },
    { labelKey: 'ugc.plan.cutaway', sub: '$0', kind: 'free', view: 'broll' },
    { labelKey: 'ugc.plan.cta', sub: 'Avatar IV', kind: 'iv', view: 'closeup' },
  ];
}
function dlgPlan(engagement: UgcSpec['dialogueEngagement']): PlanSeg[] {
  if (engagement === 'eco') return [
    { labelKey: 'ugc.plan.aCloseup', subKey: 'ugc.plan.aSpeaking', kind: 'iii', view: 'dlgA' },
    { labelKey: 'ugc.plan.bCloseup', subKey: 'ugc.plan.bSpeaking', kind: 'iii', view: 'dlgB' },
    { labelKey: 'ugc.plan.aCloseup', sub: 'Avatar IV', kind: 'iv', view: 'dlgA' },
    { labelKey: 'ugc.plan.cutaway', sub: '$0', kind: 'free', view: 'broll' },
    { labelKey: 'ugc.plan.bCloseup', subKey: 'ugc.plan.bSpeaking', kind: 'iii', view: 'dlgB' },
  ];
  if (engagement === 'dyn') return [
    { labelKey: 'ugc.plan.bothInFrame', subKey: 'ugc.plan.reactionFree', kind: 'iv', view: 'both' },
    { labelKey: 'ugc.plan.aCloseup', sub: 'Avatar IV', kind: 'iv', view: 'dlgA' },
    { labelKey: 'ugc.plan.cutaway', sub: '$0', kind: 'free', view: 'broll' },
    { labelKey: 'ugc.plan.bgFace', subKey: 'ugc.plan.cutout', kind: 'iii', view: 'pip' },
    { labelKey: 'ugc.plan.bCloseup', sub: 'Avatar IV', kind: 'iv', view: 'dlgB' },
    { labelKey: 'ugc.plan.bothInFrame', subKey: 'ugc.plan.reactionFree', kind: 'iii', view: 'both' },
  ];
  return [
    { labelKey: 'ugc.plan.aCloseup', sub: 'Avatar IV', kind: 'iv', view: 'dlgA' },
    { labelKey: 'ugc.plan.bothInFrame', subKey: 'ugc.plan.reactionFree', kind: 'iii', view: 'both' },
    { labelKey: 'ugc.plan.bCloseup', subKey: 'ugc.plan.bSpeaking', kind: 'iii', view: 'dlgB' },
    { labelKey: 'ugc.plan.bgFace', subKey: 'ugc.plan.cutout', kind: 'iii', view: 'pip' },
    { labelKey: 'ugc.plan.cutaway', sub: '$0', kind: 'free', view: 'broll' },
    { labelKey: 'ugc.plan.aCloseup', sub: 'Avatar IV', kind: 'iv', view: 'dlgA' },
  ];
}

/* Палитра кадра — CSS-переменные из UgcStudio (.ugc-studio / .dark .ugc-studio):
   на светлой теме кадр светлый, на тёмной — тёмный. Фолбэки = тёмные значения. */
const F = {
  bg: 'var(--ugcf-bg, #101013)',
  cell: 'var(--ugcf-cell, #101013)',
  title: 'var(--ugcf-title, #a3a3ad)',
  sub: 'var(--ugcf-sub, #77777f)',
  dash: 'var(--ugcf-dash, #5c5c66)',
  veil: 'var(--ugcf-veil, rgba(0,0,0,.35))',
  shadow: 'var(--ugcf-shadow, 0 14px 34px rgba(0,0,0,.35))',
};
const CHECKER: React.CSSProperties = {
  backgroundImage: 'conic-gradient(var(--ugcf-chk1, #3a3a42) 25%, var(--ugcf-chk2, #2a2a30) 0 50%, var(--ugcf-chk1, #3a3a42) 0 75%, var(--ugcf-chk2, #2a2a30) 0)',
  backgroundSize: '14px 14px',
};

export interface UgcPreviewProps {
  ugc: UgcSpec;
  mode: UgcMode;
  onEmptyAvatar: () => void;
  onEmptyPhotoB: () => void;
  onEmptyClip: () => void;
  onOpenLines: () => void;   // «медиа реплики» в диалоге живёт на таймлайне — открыть панель «Реплики»
  onAvatarRect?: (fmt: UgcFormat, rect: UgcAvatarRect) => void;   // драг/резайз аватара-оверлея на превью
}

/* Дефолтные прямоугольники аватара-оверлея (совпадают с прежним статичным CSS: 44%×42%, низ, отступ 4%). */
const AV_DEF: Record<'left' | 'right', UgcAvatarRect> = {
  left: { x: 0.04, y: 0.58, w: 0.44, h: 0.42 },
  right: { x: 0.52, y: 0.58, w: 0.44, h: 0.42 },
};

const isVideoUrl = (u?: string | null): boolean => !!u && /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(u);

export default function UgcPreview({ ugc, mode, onEmptyAvatar, onEmptyPhotoB, onEmptyClip, onOpenLines, onAvatarRect }: UgcPreviewProps) {
  const { t } = useTranslation('common');
  const avatarImg = ugc.avatarSource === 'collection' ? ugc.avatarUrl : ugc.photoUrl;
  const firstLineMedia = ugc.script.find((l) => !!l.image)?.image || null;
  // «Один ведущий» — аватар всегда перетаскивается/масштабируется на превью (в ЛЮБОЙ раскладке;
  // раскладка = стартовая позиция). В «Монтаже»/«Диалоге» — свои фиксированные планы.
  const isSolo = mode === 'solo';

  /* ── аватар на кадре: перетаскивание и размер прямо на превью ──
     Позиция per-format в долях кадра (ugc.avatarRects); дефолт — по раскладке. Во время жеста —
     локальный rect, коммит в спеку одним ugcMutate на pointerup (не спамим автосейв). */
  const [liveRect, setLiveRect] = useState<{ fmt: UgcFormat; rect: UgcAvatarRect } | null>(null);
  const rectFor = (fmt: UgcFormat): UgcAvatarRect =>
    (liveRect?.fmt === fmt ? liveRect.rect : null) || ugc.avatarRects?.[fmt] || avatarDefaultRect(ugc.placement);
  const clamp01 = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const dragAvatar = (e: React.PointerEvent, fmt: UgcFormat, kind: 'move' | 'size') => {
    if (!onAvatarRect || e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const frameEl = el.closest('[data-ugc-frame]') as HTMLElement | null;
    if (!frameEl) return;
    e.preventDefault(); e.stopPropagation();
    // Захват указателя: ВСЕ последующие pointermove/up идут в этот элемент, даже когда палец/
    // курсор уходит за границы кадра или над скролл-контейнером студии. Без этого быстрый
    // ВЕРТИКАЛЬНЫЙ жест мог «залипать»: скролл-область перехватывала его, и аватар не двигался.
    try { el.setPointerCapture(e.pointerId); } catch { /* не критично */ }
    const fr = frameEl.getBoundingClientRect();
    const r0 = rectFor(fmt);
    const sx = e.clientX, sy = e.clientY;
    let last = r0; let moved = false;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / fr.width, dy = (ev.clientY - sy) / fr.height;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) moved = true;
      last = kind === 'move'
        ? { ...r0, x: clamp01(r0.x + dx, 0, 1 - r0.w), y: clamp01(r0.y + dy, 0, 1 - r0.h) }
        : { x: r0.x, y: r0.y, w: clamp01(r0.w + dx, 0.12, 1 - r0.x), h: clamp01(r0.h + dy, 0.12, 1 - r0.y) };
      setLiveRect({ fmt, rect: last });
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      try { el.releasePointerCapture(e.pointerId); } catch { /* */ }
      if (moved) onAvatarRect(fmt, { x: +last.x.toFixed(4), y: +last.y.toFixed(4), w: +last.w.toFixed(4), h: +last.h.toFixed(4) });
      setLiveRect(null);
    };
    // Слушаем на самом элементе (получает события благодаря захвату) — надёжнее, чем window.
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };

  /* полоса плана: активный сегмент; сбрасывается при смене режима/пресета */
  const plan: PlanSeg[] | null = mode === 'retention' ? retPlan(ugc.retentionPreset) : mode === 'dialogue' ? dlgPlan(ugc.dialogueEngagement) : null;
  const [curSeg, setCurSeg] = useState(0);
  useEffect(() => { setCurSeg(0); }, [mode, ugc.retentionPreset, ugc.dialogueEngagement]);
  const seg = plan ? plan[Math.min(curSeg, plan.length - 1)] : null;

  /* живые субтитры: слова из первой реплики реального скрипта (или образец) */
  const capSample = t('ugc.subtitles.demoWords');
  const words = useMemo(() => {
    const t = (ugc.script[0]?.text || '').trim();
    const ws = t ? t.split(/\s+/).slice(0, 8) : capSample.split(' ');
    return ws.length >= 2 ? ws : [...ws, '…'];
  }, [ugc.script, capSample]);
  const [widx, setWidx] = useState(0);
  const animate = !reducedMotion && (ugc.subtitles.style === 'word' || ugc.subtitles.style === 'karaoke');
  useEffect(() => {
    if (!animate) return;
    const t = window.setInterval(() => setWidx((i) => i + 1), 650);
    return () => window.clearInterval(t);
  }, [animate, words]);

  /* Пожелания к стилю: цвет/обводка/размер/подложка — парсятся на каждый ввод и красят
     живой пример мгновенно. Тот же разбор применяет бэкенд к ASS-титрам рендера. */
  const wish = useMemo(() => parseCapWishes(ugc.subtitles.wishes), [ugc.subtitles.wishes]);
  const caption = (fmt: UgcFormat, frameW: number) => {
    if (ugc.subtitles.style === 'none') return null;
    const pos: React.CSSProperties = ugc.subtitles.pos === 'top' ? { top: '8%' } : ugc.subtitles.pos === 'center' ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: '9%' };
    const hot = widx % words.length;
    const scale = (wish?.sizePct || 100) / 100;
    // Обводка: ASS-пиксели (кадр 1080/1920) → пиксели превью; рисуем 8-направленной тенью.
    const baseW = fmt === '16x9' ? 1920 : 1080;
    const ow = wish?.bg ? 0 : (wish?.outlineWidth ?? 4);
    const r = ow > 0 ? Math.max(1, Math.round((ow / baseW) * frameW * 2)) : 0;
    const oc = wish?.outlineColor || 'rgba(10,10,14,.85)';
    const outline = r > 0
      ? `${r}px 0 0 ${oc}, -${r}px 0 0 ${oc}, 0 ${r}px 0 ${oc}, 0 -${r}px 0 ${oc}, ${r}px ${r}px 0 ${oc}, -${r}px -${r}px 0 ${oc}, ${r}px -${r}px 0 ${oc}, -${r}px ${r}px 0 ${oc}, `
      : '';
    const bgChip: React.CSSProperties = wish?.bg ? { background: wish.bg, padding: '2px 8px', borderRadius: 6 } : {};
    const txtColor = wish?.color || '#fff';
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 6, display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: '0 12px', ...pos }}>
        {ugc.subtitles.style === 'word' ? (
          <span key={hot} className="ugc-cap-pop" style={{ fontSize: (fmt === '16x9' ? 22 : 19) * scale, fontWeight: 850, color: txtColor, textShadow: `${outline}0 2px 8px rgba(0,0,0,.8)`, ...bgChip }}>{words[hot]}</span>
        ) : (
          <span style={{ fontSize: 11.5 * scale, fontWeight: 750, color: txtColor, textAlign: 'center', textShadow: `${outline}0 1px 6px rgba(0,0,0,.85)`, lineHeight: 1.35, ...bgChip }}>
            {ugc.subtitles.style === 'karaoke'
              ? words.map((w, i) => <span key={i} style={{ color: i === hot ? (wish?.color || ACC2) : '#fff', transition: 'color .15s' }}>{w}{i < words.length - 1 ? ' ' : ''}</span>)
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
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: F.sub }}>
      <span className="flex items-center justify-center rounded-xl" style={{ width: 46, height: 46, border: `1.5px dashed ${F.dash}`, color: F.sub }}><Plus size={18} /></span>
      <b className="text-[10.5px] font-700" style={{ color: F.title }}>{title}</b>
      <span className="text-[9.5px]" style={{ color: F.sub }}>{sub}</span>
    </button>
  );
  const faceCell = (url: string | null, tag: string, onEmpty: () => void, emptyTitle?: string) => (
    <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden" style={{ background: F.cell }}>
      {url ? (<>{cellTag(tag)}<img src={url} alt="" className="w-full h-full object-cover" /></>)
        : emptyCell(emptyTitle || t('ugc.preview.emptyNotSelected', { tag }), t('ugc.preview.emptyClickToChoose'), onEmpty)}
    </div>
  );
  const clipCell = (tag: string, emptySub?: string) => (
    <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden" style={{ background: F.cell }}>
      {ugc.clip ? (
        <>
          {cellTag(tag + (ugc.clipFit === 'contain' ? t('ugc.preview.tagFitContainSuffix') : ''))}
          <video src={`${ugc.clip.url}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full" style={{ objectFit: ugc.clipFit === 'contain' ? 'contain' : 'cover' }} />
          <span className="absolute flex items-center justify-center rounded-full" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 32, height: 32, background: 'rgba(0,0,0,.45)', border: '1.5px solid rgba(255,255,255,.75)', pointerEvents: 'none' }}><Play size={14} color="#fff" fill="#fff" /></span>
        </>
      ) : emptyCell(t('ugc.preview.emptyClipTitle'), emptySub || t('ugc.preview.emptyClipSub'), onEmptyClip)}
    </div>
  );
  /* «медиа реплики» в диалоге: превью первого прикреплённого медиа; пусто → в панель «Реплики» */
  const lineMediaCell = (tag: string) => (
    <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden" style={{ background: F.cell }}>
      {firstLineMedia ? (
        <>
          {cellTag(tag)}
          {isVideoUrl(firstLineMedia)
            ? <video src={`${firstLineMedia}#t=0.1`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
            : <img src={firstLineMedia} alt="" className="w-full h-full object-cover" />}
        </>
      ) : emptyCell(t('ugc.preview.emptyLineMediaTitle'), t('ugc.preview.emptyLineMediaSub'), onOpenLines)}
    </div>
  );

  /* аватар маленьким поверх видео; cutout → шахматная кайма и без «карточки» (иллюстрация прозрачного фона).
     draggable (соло-оверлей) + есть аватар: тащим за сам аватар, размер — за уголок; позиция per-format
     уезжает в рендер. Пусто → обычная кнопка выбора (двигать нечего). mini → компактная фурнитура. */
  const overlayAvatar = (rc: UgcAvatarRect, cutout: boolean, url: string | null, onEmpty: () => void, fmt: UgcFormat, draggable = false, mini = false) => {
    const canDrag = draggable && !!onAvatarRect && !!url;   // двигать можно только реальный аватар
    const handle = mini ? 16 : 20;
    return (
    <div
      onPointerDown={canDrag ? (e) => dragAvatar(e, fmt, 'move') : undefined}
      style={{
        position: 'absolute', zIndex: 4,
        left: `${rc.x * 100}%`, top: `${rc.y * 100}%`, width: `${rc.w * 100}%`, height: `${rc.h * 100}%`,
        ...(canDrag ? { cursor: 'grab', touchAction: 'none' } : {}),
      }}>
      {url ? (
        cutout ? (
          <div className="w-full h-full" style={{ ...CHECKER, borderRadius: '12px 12px 0 0', padding: 4 }} title={t('ugc.preview.cutoutTooltip')}>
            <img src={url} alt="" draggable={false} className="w-full h-full object-cover" style={{ borderRadius: '9px 9px 0 0' }} />
            <span style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', fontSize: 8, fontWeight: 750, letterSpacing: '.04em', textTransform: 'uppercase', color: '#fff', background: ACC, borderRadius: 999, padding: '1.5px 7px', whiteSpace: 'nowrap' }}>{t('ugc.preview.cutoutBadge')}</span>
          </div>
        ) : (
          <img src={url} alt="" draggable={false} className="w-full h-full object-cover" style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,.25)' }} />
        )
      ) : (
        <button onClick={onEmpty} className="w-full h-full flex flex-col items-center justify-center gap-1 text-[9px] font-650"
          style={{ border: `1.5px dashed ${F.dash}`, borderRadius: 12, background: F.veil, color: F.title, cursor: 'pointer' }}>
          <UserRound size={16} /> {t('ugc.preview.emptyAvatarOverlay')}
        </button>
      )}
      {canDrag && (
        <>
          {/* заметная рамка захвата: фиолетовая + белый ободок (видна на любом фоне) */}
          <span style={{ position: 'absolute', inset: 0, border: `2px solid ${ACC}`, borderRadius: 11, pointerEvents: 'none', boxShadow: '0 0 0 1.5px rgba(255,255,255,.6)' }} />
          {/* значок-подсказка «Двигать» сверху по центру — сразу видно, что аватар таскается */}
          <span style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', gap: 3, background: ACC, color: '#fff', borderRadius: 999, padding: mini ? '2px 5px' : '2px 8px', fontSize: mini ? 8 : 9.5, fontWeight: 750, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 1px 5px rgba(0,0,0,.45)' }}>
            <Move size={mini ? 9 : 11} />{!mini && <span>{t('ugc.preview.avatarDragBadge')}</span>}
          </span>
          {/* уголок-ручка размера: крупная, с иконкой, внутри бокса (не режется overflow кадра) */}
          <span
            onPointerDown={(e) => dragAvatar(e, fmt, 'size')}
            title={t('ugc.preview.avatarResizeTip')}
            className="flex items-center justify-center"
            style={{ position: 'absolute', right: 3, bottom: 3, width: handle, height: handle, borderRadius: 6, background: ACC, border: '2px solid #fff', color: '#fff', cursor: 'nwse-resize', touchAction: 'none', boxShadow: '0 1px 5px rgba(0,0,0,.5)' }}>
            <Maximize2 size={mini ? 8 : 10} style={{ pointerEvents: 'none' }} />
          </span>
        </>
      )}
    </div>
    );
  };

  /* ── содержимое кадра по режиму и активному сегменту плана ── */
  const frameInner = (fmt: UgcFormat, mini = false) => {   // 16:9 → раскладка в строку; 9:16 / 1:1 / 4:5 → в столбец
    const row = fmt === '16x9';
    const stack = (a: React.ReactNode, b: React.ReactNode) => (
      <div className={`absolute inset-0 flex ${row ? 'flex-row' : 'flex-col'}`}>{a}{b}</div>
    );
    const full = (node: React.ReactNode) => <div className="absolute inset-0 flex">{node}</div>;

    if (mode === 'voiceover') {
      // «Без аватара»: базовое видео во весь кадр; врезки/слой/субтитры — поверх на сборке.
      return full(clipCell(t('ugc.preview.tagYourVideo'), t('ugc.preview.emptyClipSubVoiceover')));
    }
    if (mode === 'dialogue') {
      const view = seg?.view || 'dlgA';
      if (view === 'dlgA') return full(faceCell(ugc.photoUrl, t('ugc.preview.tagPeerACloseup'), onEmptyAvatar, t('ugc.preview.emptyPeerA')));
      if (view === 'dlgB') return full(faceCell(ugc.photoBUrl, t('ugc.preview.tagPeerBCloseup'), onEmptyPhotoB, t('ugc.preview.emptyPeerB')));
      if (view === 'both') return stack(
        faceCell(ugc.photoUrl, t('ugc.preview.tagPeerA'), onEmptyAvatar, t('ugc.preview.emptyPeerA')),
        faceCell(ugc.photoBUrl, t('ugc.preview.tagPeerBReaction'), onEmptyPhotoB, t('ugc.preview.emptyPeerB')),
      );
      if (view === 'pip') return (
        <div className="absolute inset-0 flex">
          {lineMediaCell(t('ugc.preview.tagLineMediaBg'))}
          {overlayAvatar(AV_DEF.left, ugc.dialogueCutout, ugc.photoUrl, onEmptyAvatar, fmt)}
        </div>
      );
      return full(lineMediaCell(t('ugc.preview.tagCutawayNoFace')));
    }

    if (mode === 'retention') {
      const view = seg?.view || 'closeup';
      if (view === 'closeup') return full(faceCell(avatarImg, t('ugc.preview.tagAvatarCloseup'), onEmptyAvatar));
      if (view === 'split') return ugc.placement === 'bottom'
        ? stack(clipCell(t('ugc.common.footage')), faceCell(avatarImg, t('ugc.common.avatar'), onEmptyAvatar))
        : stack(faceCell(avatarImg, t('ugc.common.avatar'), onEmptyAvatar), clipCell(t('ugc.common.footage')));
      if (view === 'pip') return (
        <div className="absolute inset-0 flex">
          {clipCell(t('ugc.common.footage'))}
          {overlayAvatar(AV_DEF.left, false, avatarImg, onEmptyAvatar, fmt)}
        </div>
      );
      return full(clipCell(t('ugc.preview.tagCutawayNoFace')));
    }

    /* solo: видео во весь кадр + перетаскиваемый аватар в ЛЮБОЙ раскладке (раскладка =
       стартовая позиция бокса; дальше двигаешь/масштабируешь мышкой). Рендер строит так же. */
    return (
      <div className="absolute inset-0 flex">
        {clipCell(t('ugc.common.footage'), t('ugc.preview.emptyClipSubOptional'))}
        {overlayAvatar(rectFor(fmt), false, avatarImg, onEmptyAvatar, fmt, true, mini)}
      </div>
    );
  };

  /* кадры всех форматов: первый выбранный — крупно, остальные миниатюрами */
  const FRAME_DIMS: Record<UgcFormat, { main: { w: number; h: number }; mini: { w: number; h: number }; capKey: string; radius: number }> = {
    '9x16': { main: { w: 246, h: 437 }, mini: { w: 132, h: 235 }, capKey: 'ugc.format.label916', radius: 20 },
    '16x9': { main: { w: 496, h: 279 }, mini: { w: 300, h: 169 }, capKey: 'ugc.format.label169', radius: 14 },
    '1x1':  { main: { w: 300, h: 300 }, mini: { w: 168, h: 168 }, capKey: 'ugc.format.label11',  radius: 16 },
    '4x5':  { main: { w: 272, h: 340 }, mini: { w: 150, h: 187 }, capKey: 'ugc.format.label45',  radius: 16 },
  };
  const frame = (fmt: UgcFormat, mini?: boolean) => {
    const meta = FRAME_DIMS[fmt];
    const dims = mini ? meta.mini : meta.main;
    return (
      <div key={fmt} className="flex flex-col items-center gap-2">
        <span className="text-[10.5px] font-600" style={{ color: 'var(--text-muted)' }}>{t(meta.capKey)}</span>
        <div className="relative overflow-hidden" data-ugc-frame={fmt} style={{ width: dims.w, height: dims.h, borderRadius: mini ? Math.min(meta.radius, 13) : meta.radius, border: '1px solid var(--border-strong)', background: F.bg, boxShadow: F.shadow }}>
          {frameInner(fmt, mini)}
          {/* верхний PNG-слой юзера — как в рендере: поверх видео, ПОД субтитрами */}
          {ugc.layers[fmt] && (
            <img src={ugc.layers[fmt]!.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', zIndex: 5, pointerEvents: 'none' }} />
          )}
          {ugc.progressBar && <span className="ugc-progress" style={{ position: 'absolute', top: 0, left: 0, height: 4, background: ACC2, zIndex: 5, pointerEvents: 'none', borderRadius: '0 2px 2px 0' }} />}
          {caption(fmt, dims.w)}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* однократные кейфреймы для «слова» субтитров */}
      <style>{'@keyframes ugcCapPop{from{transform:scale(.55);opacity:0}to{transform:scale(1);opacity:1}} .ugc-cap-pop{animation:ugcCapPop .3s cubic-bezier(.2,1.6,.4,1)} .ugc-progress{width:38%} @media (prefers-reduced-motion: no-preference){.ugc-progress{animation:ugcProg 6s linear infinite}} @keyframes ugcProg{from{width:0}to{width:100%}}'}</style>

      <div className="flex-1 flex items-center justify-center gap-6 flex-wrap px-4 pb-1" style={{ minHeight: 0 }}>
        {ugc.formats.map((f, i) => frame(f, i > 0))}
      </div>

      {/* подсказка под кадрами: в «Один ведущий» аватар двигается/масштабируется мышкой */}
      {isSolo && onAvatarRect && (
        <div className="flex items-center justify-center gap-1.5 px-4 pb-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          <span className="inline-flex items-center justify-center rounded-md" style={{ width: 18, height: 18, background: 'rgba(168,85,247,.16)', color: ACC }}><Move size={11} /></span>
          {t('ugc.preview.avatarDragHint')}
        </div>
      )}

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
                  <span className="text-[9.5px] font-750" style={{ letterSpacing: '.02em' }}>{t(s.labelKey)}</span>
                  <span className="text-[8.5px] font-650" style={{ color: s.kind === 'iv' ? 'rgba(255,255,255,.78)' : s.kind === 'free' ? '#10b981' : undefined, opacity: s.kind === 'iii' ? .8 : 1 }}>{s.subKey ? t(s.subKey) : s.sub}</span>
                </button>
              );
            })}
          </div>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {mode === 'retention'
              ? t('ugc.plan.noteRetention')
              : t('ugc.plan.noteDialogue')}
          </span>
        </div>
      )}
    </>
  );
}
