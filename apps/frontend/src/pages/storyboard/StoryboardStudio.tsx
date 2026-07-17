/**
 * StoryboardStudio — полноэкранная студия сториборда (/storyboard/:id).
 *
 * Конвейер из 5 станций (степпер): Источник → Расшифровка → Раскадровка →
 * Генерация → Сборка. Механика: говорящее видео → куски ≤8с по концам фраз →
 * 6 панелей на кусок (спикер/титр/врезка/сплит/мокап/финал) → программный
 * ffmpeg-рендер (движки Omni/Flow — «скоро») → склейка с бейджем → Галерея.
 *
 * Дисциплина конвейера: сначала генерируется и проверяется ТОЛЬКО кусок 1 —
 * остальные разблокируются после него (защита ключей/времени пользователя).
 * Ошибки — видимым текстом ПОД кнопками (канон v2.2.53), не в консоли.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Loader2, Check, Play, RefreshCw, Sparkles, Image as ImageIcon,
  Plus, Trash2, AlertTriangle, Download, Film, LayoutGrid, Wand2, Lock, Copy, Paperclip,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { GalleryPicker, type GalleryPickItem } from '../../components/GalleryPicker';

type PanelType = 'speaker' | 'title' | 'cutaway' | 'split' | 'mockup' | 'final';
interface SbPanel { type: PanelType; start: number; end: number; text?: string; frameTs?: number; frameUrl?: string; imageUrl?: string; prompt?: string }
interface SbChunk { idx: number; start: number; end: number; enabled: boolean; status: string; panels: SbPanel[]; pngUrl?: string; renderUrl?: string; stripUrl?: string; error?: string }
interface SbDoc {
  id: string; name: string; status: string;
  sourceUrl?: string | null; sourceDuration?: number | null;
  plan: { transcript?: { start: number; end: number; text: string }[]; chunks?: SbChunk[]; planSource?: string; planNote?: string };
  settings: { style?: string; engine?: string; badgeText?: string; subtitles?: boolean; ctaWord?: string; autoAssemble?: boolean };
  resultUrl?: string | null; error?: string | null;
  busy?: { stage: string; chunk?: number } | null;
  /** Flow-автомат: статусы задач очереди по кускам (queued/running/done/failed). */
  flowQueue?: Record<number, { taskId: string; status: string; note?: string | null }>;
}

const PANEL_TYPES: { key: PanelType; ru: string }[] = [
  { key: 'speaker', ru: 'Спикер крупно' },
  { key: 'title', ru: 'Титр во весь экран' },
  { key: 'cutaway', ru: 'Врезка' },
  { key: 'split', ru: 'Сплит-экран' },
  { key: 'mockup', ru: 'Мокап' },
  { key: 'final', ru: 'Финал + CTA' },
];
const STYLES = [
  { key: 'clean', ru: 'Чистый' },
  { key: 'neon', ru: 'Неон' },
  { key: 'paper', ru: 'Бумага' },
  { key: 'terminal', ru: 'Терминал' },
  { key: 'bold', ru: 'Дерзкий' },
];

/** Цвета стиль-пресетов для wysiwyg-превью титров (зеркало styleColors бэка). */
const STYLE_COLORS: Record<string, { bg: string; fg: string; accent: string }> = {
  clean: { bg: '#0b0e1a', fg: '#ffffff', accent: '#818cf8' },
  neon: { bg: '#0a0018', fg: '#ffffff', accent: '#22d3ee' },
  paper: { bg: '#f5f0e6', fg: '#1a1a1a', accent: '#d97706' },
  terminal: { bg: '#02120a', fg: '#34d399', accent: '#34d399' },
  bold: { bg: '#18040a', fg: '#ffffff', accent: '#fb7185' },
};

export default function StoryboardStudio() {
  const { t } = useTranslation('common');
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useAppStore((s) => s.token);
  const auth = (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

  const [doc, setDoc] = useState<SbDoc | null>(null);
  const [step, setStep] = useState<number>(2);
  const [activeChunk, setActiveChunk] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [imgPickFor, setImgPickFor] = useState<number | null>(null);
  const [renderQueue, setRenderQueue] = useState<number[]>([]);
  const [selectedPanel, setSelectedPanel] = useState(0);
  const [flowMats, setFlowMats] = useState<Record<number, { chunkUrl: string; pngUrl: string | null; prompt: string }>>({});
  const [attachFor, setAttachFor] = useState<number | null>(null);
  const [promptCopied, setPromptCopied] = useState<number | null>(null);
  const backfillTried = useRef(false);
  const [savedTick, setSavedTick] = useState(0);
  const autostarted = useRef(false);
  const stepInited = useRef(false);
  const dirtyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chunks: SbChunk[] = useMemo(() => doc?.plan?.chunks || [], [doc]);
  const chunk = chunks.find((c) => c.idx === activeChunk) || chunks[0] || null;
  const chunk0Done = chunks.length > 0 && chunks[0].status === 'done';
  const doneChunks = chunks.filter((c) => c.enabled && c.status === 'done');

  const load = async (): Promise<SbDoc | null> => {
    try {
      const r = await fetch(`/api/storyboard/${id}`, { headers: auth() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setNote(d?.error || 'Проект не найден'); return null; }
      setDoc(d);
      return d;
    } catch { return null; }
  };

  useEffect(() => {
    void (async () => {
      const d = await load();
      if (!d || stepInited.current) return;
      stepInited.current = true;
      if (d.status === 'done' && d.resultUrl) setStep(5);
      else if (d.plan?.chunks?.length) setStep(3);
      else setStep(2);
      // автозапуск расшифровки сразу после создания (?autostart=1)
      if (searchParams.get('autostart') === '1' && d.status === 'draft' && !d.busy && !autostarted.current) {
        autostarted.current = true;
        void act('analyze', () => fetch(`/api/storyboard/${id}/analyze`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: '{}' }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Поллинг: фоновая операция ИЛИ активная очередь Flow-автомата (генерации идут минутами)
  const flowActive = Object.values(doc?.flowQueue || {}).some((q) => q.status === 'queued' || q.status === 'running');
  useEffect(() => {
    if (!doc?.busy && doc?.status !== 'analyzing' && doc?.status !== 'rendering' && !flowActive) return;
    const iv = setInterval(() => { void load(); }, flowActive && !doc?.busy ? 6000 : 2500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.busy?.stage, doc?.busy?.chunk, doc?.status, flowActive]);

  // Смена активного куска — сбрасываем выбранную панель
  useEffect(() => { setSelectedPanel(0); }, [activeChunk]);

  // Проекты, созданные до фичи превью: сервер бэкфилит кадры при открытии —
  // один раз перечитываем документ через 5с, чтобы плёнка/кадры появились.
  useEffect(() => {
    if (backfillTried.current || !chunks.length || doc?.busy) return;
    if (chunks.every((c) => c.stripUrl)) return;
    backfillTried.current = true;
    const tm = setTimeout(() => { void load(); }, 5000);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, doc?.busy]);

  // После расшифровки — перескок на шаг 3
  const prevChunks = useRef(0);
  useEffect(() => {
    if (chunks.length && !prevChunks.current && step === 2 && !doc?.busy) setStep(3);
    prevChunks.current = chunks.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks.length, doc?.busy]);

  // Очередь «Сгенерировать все»: следующий кусок стартует, когда проект свободен
  useEffect(() => {
    if (!renderQueue.length || doc?.busy) return;
    const next = renderQueue[0];
    const c = chunks.find((x) => x.idx === next);
    if (!c || c.status === 'done') { setRenderQueue((q) => q.slice(1)); return; }
    setRenderQueue((q) => q.slice(1));
    void fetch(`/api/storyboard/${id}/render`, {
      method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ chunk: next }),
    }).then(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderQueue, doc?.busy, chunks]);

  /** Общий раннер действий: кнопка → запрос → note при ошибке → перезагрузка дока. */
  const act = async (key: string, fn: () => Promise<Response>) => {
    if (acting) return;
    setActing(key); setNote(null);
    try {
      const r = await fn();
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setNote(d?.error || t('sec.storyboard.actFail', 'Не получилось — попробуйте ещё раз.'));
      await load();
    } catch {
      setNote(t('sec.storyboard.netFail', 'Сеть недоступна — попробуйте ещё раз.'));
    } finally {
      setActing(null);
    }
  };

  /** Локальная правка плана + отложенный автосейв (800мс). */
  const patchLocal = (mut: (d: SbDoc) => void) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const next: SbDoc = JSON.parse(JSON.stringify(prev));
      mut(next);
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
      dirtyTimer.current = setTimeout(() => { void saveDoc(next); }, 800);
      return next;
    });
  };
  const saveDoc = async (d: SbDoc) => {
    try {
      const r = await fetch(`/api/storyboard/${id}`, {
        method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: d.name, plan: d.plan, settings: d.settings }),
      });
      if (r.ok) { setDoc(await r.json()); setSavedTick((x) => x + 1); }
    } catch { /* автосейв тихий; явные действия покажут ошибку */ }
  };

  const setPanel = (pi: number, mut: (p: SbPanel) => void) =>
    patchLocal((d) => { const c = d.plan.chunks?.find((x) => x.idx === activeChunk); if (c?.panels[pi]) mut(c.panels[pi]); });

  const addPanel = () => patchLocal((d) => {
    const c = d.plan.chunks?.find((x) => x.idx === activeChunk);
    if (!c || c.panels.length >= 8) return;
    // делим самую длинную панель пополам
    let li = 0;
    c.panels.forEach((p, i) => { if (p.end - p.start > c.panels[li].end - c.panels[li].start) li = i; });
    const p = c.panels[li];
    const mid = (p.start + p.end) / 2;
    const clone: SbPanel = { type: 'cutaway', start: mid, end: p.end, frameTs: c.start + mid };
    p.end = mid;
    c.panels.splice(li + 1, 0, clone);
  });

  const removePanel = (pi: number) => patchLocal((d) => {
    const c = d.plan.chunks?.find((x) => x.idx === activeChunk);
    if (!c || c.panels.length <= 3) return;
    const p = c.panels[pi];
    if (pi > 0) c.panels[pi - 1].end = p.end; else if (c.panels[pi + 1]) c.panels[pi + 1].start = p.start;
    c.panels.splice(pi, 1);
  });

  const fmtT = (s: number) => `${s.toFixed(1)}с`;
  const busyStage = doc?.busy?.stage;
  const stageRu = busyStage === 'analyze' ? t('sec.storyboard.busyAnalyze', 'расшифровка и раскадровка')
    : busyStage === 'plan' ? t('sec.storyboard.busyPlan', 'ИИ-режиссёр планирует панели')
    : busyStage === 'render' ? t('sec.storyboard.busyRender', 'рендер куска {{n}}', { n: (doc?.busy?.chunk ?? 0) + 1 })
    : busyStage === 'attach' ? t('sec.storyboard.busyAttach', 'прикрепляю клип к куску {{n}}', { n: (doc?.busy?.chunk ?? 0) + 1 })
    : busyStage === 'assemble' ? t('sec.storyboard.busyAssemble', 'финальная сборка') : null;

  /** Материалы Flow для куска (mp4+PNG+промпт) — храним ответ, чтобы показать ссылки. */
  const prepFlow = async (chunkIdx: number) => {
    if (acting) return;
    setActing(`prep${chunkIdx}`); setNote(null);
    try {
      const r = await fetch(`/api/storyboard/${id}/prepare-flow`, {
        method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunk: chunkIdx }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setNote(d?.error || t('sec.storyboard.actFail', 'Не получилось — попробуйте ещё раз.'));
      else setFlowMats((p) => ({ ...p, [chunkIdx]: d }));
    } catch {
      setNote(t('sec.storyboard.netFail', 'Сеть недоступна — попробуйте ещё раз.'));
    } finally {
      setActing(null);
    }
  };

  const steps = [
    { n: 1, label: t('sec.storyboard.step1', 'Источник'), ok: !!doc?.sourceUrl },
    { n: 2, label: t('sec.storyboard.step2', 'Расшифровка'), ok: chunks.length > 0 },
    { n: 3, label: t('sec.storyboard.step3', 'Раскадровка'), ok: chunks.some((c) => c.panels.length > 0) },
    { n: 4, label: t('sec.storyboard.step4', 'Генерация'), ok: doneChunks.length > 0 },
    { n: 5, label: t('sec.storyboard.step5', 'Сборка'), ok: !!doc?.resultUrl },
  ];

  if (!doc) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        {note
          ? <div className="text-[13px]" style={{ color: '#f87171' }}>{note}</div>
          : <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
      </div>
    );
  }

  const inputStyle: React.CSSProperties = { background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' };
  const btnPrimary: React.CSSProperties = { background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' };
  const btnGhost: React.CSSProperties = { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Топбар ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => navigate('/gallery?tab=storyboard')} title={t('sec.storyboard.back', 'К списку сторибордов')}
          className="w-9 h-9 rounded-xl flex items-center justify-center" style={btnGhost}>
          <ArrowLeft size={16} />
        </button>
        <input
          value={doc.name}
          onChange={(e) => patchLocal((d) => { d.name = e.target.value.slice(0, 200); })}
          className="text-[15px] font-700 px-3 py-2 rounded-xl outline-none flex-1 min-w-[160px]"
          style={{ ...inputStyle, maxWidth: 420 }}
        />
        {stageRu ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg"
            style={{ background: 'rgba(99,102,241,0.10)', color: 'var(--brand)' }}>
            <Loader2 size={12} className="animate-spin" /> {stageRu}…
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }} key={savedTick}>
            {savedTick > 0 ? t('sec.storyboard.saved', 'Сохранено') : ''}
          </span>
        )}
      </div>

      {/* ── Степпер 5 станций ── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {steps.map((s) => (
          <button key={s.n} type="button" onClick={() => setStep(s.n)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-600 transition-colors"
            style={step === s.n
              ? { background: 'rgba(99,102,241,0.12)', border: '1px solid var(--brand)', color: 'var(--brand)', cursor: 'pointer' }
              : { background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: s.ok ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: 'pointer' }}>
            {s.ok ? <Check size={12} /> : <span>{s.n}</span>} {s.label}
          </button>
        ))}
      </div>

      {note && (
        <div className="px-3 py-2 rounded-xl text-[12px] flex items-start gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> <span>{note}</span>
        </div>
      )}
      {doc.error && !note && (
        <div className="px-3 py-2 rounded-xl text-[12px]" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {doc.error}
        </div>
      )}

      <div className="flex gap-3 items-start flex-col lg:flex-row">
        {/* ═══ Центр: активная станция ═══ */}
        <div className="flex-1 min-w-0 w-full flex flex-col gap-3">

          {/* ── Шаг 1: Источник ── */}
          {step === 1 && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.storyboard.srcTitle', 'Исходное видео')}</div>
              {doc.sourceUrl ? (
                <video src={doc.sourceUrl} controls playsInline className="rounded-xl w-full" style={{ maxWidth: 260, aspectRatio: '9/16', background: '#000' }} />
              ) : (
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('sec.storyboard.srcNone', 'Источник не выбран.')}</p>
              )}
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {t('sec.storyboard.srcHint', 'Источник меняется при создании проекта. Хотите другой дубль — создайте новый сториборд из Галереи.')}
                {doc.sourceDuration ? ` ${t('sec.storyboard.srcDur', 'Длительность: {{d}} сек.', { d: Math.round(doc.sourceDuration) })}` : ''}
              </p>
            </div>
          )}

          {/* ── Шаг 2: Расшифровка ── */}
          {step === 2 && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.storyboard.trTitle', 'Расшифровка и нарезка по фразам')}</div>
              <div className="flex gap-3 items-start">
                {doc.sourceUrl && (
                  <video src={doc.sourceUrl} controls playsInline preload="metadata"
                    className="rounded-xl flex-shrink-0 hidden sm:block"
                    style={{ width: 128, aspectRatio: '9/16', background: '#000' }} />
                )}
                <p className="text-[12px] flex-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('sec.storyboard.trIntro', 'Gemini смотрит видео целиком: дословная речь с таймкодами + реальные сцены. Затем ролик режется на куски до 8 секунд по концам фраз, и на каждый строится раскадровка.')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" disabled={!!doc.busy || !!acting}
                  onClick={() => act('analyze', () => fetch(`/api/storyboard/${id}/analyze`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: '{}' }))}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-700 disabled:opacity-50" style={btnPrimary}>
                  {doc.busy?.stage === 'analyze' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {chunks.length ? t('sec.storyboard.trRedo', 'Расшифровать заново') : t('sec.storyboard.trRun', 'Расшифровать и раскадровать')}
                </button>
                <button type="button" disabled={!!doc.busy || !!acting}
                  onClick={() => act('analyzeNoAi', () => fetch(`/api/storyboard/${id}/analyze`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ skipAi: true }) }))}
                  className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-600 disabled:opacity-50" style={btnGhost}
                  title={t('sec.storyboard.trNoAiHint', 'Без ключа Gemini: ровные куски по 8с, панели шаблоном')}>
                  {t('sec.storyboard.trNoAi', 'Без ИИ (ровные куски)')}
                </button>
              </div>
              {doc.plan?.planNote && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{doc.plan.planNote}</p>}
              {(doc.plan?.transcript?.length || 0) > 0 && (
                <div className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: 'var(--bg-tertiary)', maxHeight: 320, overflowY: 'auto' }}>
                  {doc.plan!.transcript!.map((s, i) => (
                    <div key={i} className="text-[12px] flex gap-2">
                      <span className="tabular-nums flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{s.start.toFixed(1)}–{s.end.toFixed(1)}</span>
                      <span style={{ color: 'var(--text-primary)' }}>{s.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {chunks.length > 0 && (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {t('sec.storyboard.trChunks', 'Нарезано кусков: {{n}} (по концам фраз, до 8 сек). Дальше — шаг 3 «Раскадровка».', { n: chunks.length })}
                </p>
              )}
            </div>
          )}

          {/* ── Шаг 3: Раскадровка ── */}
          {step === 3 && chunk && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                {chunks.map((c) => (
                  <button key={c.idx} type="button" onClick={() => setActiveChunk(c.idx)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-600"
                    style={c.idx === (chunk?.idx ?? 0)
                      ? { background: 'rgba(99,102,241,0.12)', border: '1px solid var(--brand)', color: 'var(--brand)', cursor: 'pointer' }
                      : { background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: c.enabled ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: 'pointer', opacity: c.enabled ? 1 : 0.6 }}>
                    {t('sec.storyboard.chunkN', 'Кусок {{n}}', { n: c.idx + 1 })} · {fmtT(c.start)}–{fmtT(c.end)}
                    {c.status === 'done' && <Check size={11} style={{ color: '#34d399' }} />}
                  </button>
                ))}
              </div>
              {chunk && !chunk.enabled && (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('sec.storyboard.chunkOff', 'Кусок выключен — не попадёт в ролик.')}</p>
              )}
              <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-[13px] font-700 flex-1" style={{ color: 'var(--text-primary)' }}>
                    {t('sec.storyboard.panelsTitle', 'Панели куска {{n}}', { n: chunk.idx + 1 })}
                    <span className="text-[11px] font-400 ml-2" style={{ color: 'var(--text-muted)' }}>
                      {doc.plan?.planSource === 'claude' ? t('sec.storyboard.byClaude', 'план: ИИ-режиссёр') : t('sec.storyboard.byTemplate', 'план: шаблон')}
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={chunk.enabled}
                      onChange={(e) => patchLocal((d) => { const c = d.plan.chunks?.find((x) => x.idx === chunk.idx); if (c) c.enabled = e.target.checked; })} />
                    {t('sec.storyboard.chunkEnabled', 'В ролик')}
                  </label>
                  <button type="button" disabled={!!doc.busy || !!acting}
                    onClick={() => act('plan', () => fetch(`/api/storyboard/${id}/plan`, { method: 'POST', headers: auth() }))}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-600 disabled:opacity-50" style={btnGhost}
                    title={t('sec.storyboard.replanHint', 'Перестроить панели всех кусков ИИ-режиссёром (ручные правки текстов будут перезаписаны)')}>
                    <Wand2 size={13} /> {t('sec.storyboard.replan', 'Перепланировать ИИ')}
                  </button>
                </div>

                {/* Филмстрип куска: цветная полоса = границы панелей, клик по плёнке = кадр выбранной панели */}
                {chunk.stripUrl && (
                  <div className="flex flex-col gap-1">
                    <div className="flex" style={{ gap: 2 }}>
                      {chunk.panels.map((p, pi) => (
                        <button key={pi} type="button" onClick={() => setSelectedPanel(pi)}
                          title={`${pi + 1} · ${t(`sec.storyboard.pt_${p.type}`, PANEL_TYPES.find((x) => x.key === p.type)?.ru || p.type)}`}
                          style={{ flex: Math.max(0.2, p.end - p.start), height: 6, borderRadius: 3, border: 'none', cursor: 'pointer',
                                   background: pi === selectedPanel ? 'var(--brand)' : 'var(--border-strong)', padding: 0 }} />
                      ))}
                    </div>
                    <div
                      style={{ position: 'relative', cursor: 'crosshair' }}
                      title={t('sec.storyboard.stripClick', 'Клик — кадр для панели {{n}}', { n: selectedPanel + 1 })}
                      onClick={(e) => {
                        if (doc.busy || acting) return;
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                        const ts = chunk.start + frac * (chunk.end - chunk.start);
                        void act('frame', () => fetch(`/api/storyboard/${id}/panel-frame`, {
                          method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' },
                          body: JSON.stringify({ chunk: chunk.idx, panel: selectedPanel, ts }),
                        }));
                      }}>
                      <img src={chunk.stripUrl} alt="" style={{ width: '100%', borderRadius: 8, display: 'block', border: '1px solid var(--border-subtle)', opacity: acting === 'frame' ? 0.6 : 1 }} />
                      {acting === 'frame' && (
                        <span className="absolute inset-0 flex items-center justify-center"><Loader2 size={16} className="animate-spin" style={{ color: '#fff' }} /></span>
                      )}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {t('sec.storyboard.stripHint', 'Плёнка куска. Клик по кадру — назначить его выбранной панели (сейчас: {{n}}). Панель выбирается кликом по карточке или цветной полосе.', { n: selectedPanel + 1 })}
                    </div>
                  </div>
                )}

                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                  {chunk.panels.map((p, pi) => (
                    <div key={pi} onClick={() => setSelectedPanel(pi)}
                      className="rounded-xl p-2 flex flex-col gap-1.5"
                      style={{ background: 'var(--bg-tertiary)', border: pi === selectedPanel ? '1.5px solid var(--brand)' : '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                      {/* Превью панели: wysiwyg-титр / картинка / живой кадр из видео */}
                      {(() => {
                        const sc = STYLE_COLORS[doc.settings?.style || 'clean'] || STYLE_COLORS.clean;
                        const isImgType = p.type === 'cutaway' || p.type === 'split' || p.type === 'mockup';
                        if (p.type === 'title') {
                          return (
                            <div className="rounded-lg relative overflow-hidden flex items-center justify-center" style={{ aspectRatio: '9/13', background: sc.bg }}>
                              <span style={{ position: 'absolute', left: 8, top: '22%', bottom: '22%', width: 3, borderRadius: 2, background: sc.accent }} />
                              <span className="px-3 text-center" style={{ color: sc.fg, fontSize: 12.5, fontWeight: 700, lineHeight: 1.35, wordBreak: 'break-word' }}>
                                {p.text || t('sec.storyboard.titlePh', 'Текст титра (коротко)')}
                              </span>
                            </div>
                          );
                        }
                        if (isImgType) {
                          return (
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); setSelectedPanel(pi); setImgPickFor(pi); }}
                              className="rounded-lg relative overflow-hidden flex flex-col items-center justify-center gap-1"
                              style={{ aspectRatio: '9/13', background: '#000', border: '1px dashed var(--border-strong)', cursor: 'pointer', padding: 0 }}
                              title={t('sec.storyboard.pickImg', 'Картинка из Галереи (скрин, фото, график)')}>
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              ) : p.frameUrl ? (
                                <img src={p.frameUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.75 }} />
                              ) : (
                                <ImageIcon size={16} style={{ color: 'var(--text-muted)' }} />
                              )}
                              <span className="absolute bottom-1 left-1 right-1 text-[9px] px-1.5 py-0.5 rounded text-center" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                                {p.imageUrl ? t('sec.storyboard.imgSet', 'клик — сменить картинку') : t('sec.storyboard.noImg', 'клик — картинка из Галереи')}
                              </span>
                            </button>
                          );
                        }
                        return (
                          <div className="rounded-lg relative overflow-hidden flex items-center justify-center" style={{ aspectRatio: '9/13', background: '#000' }}>
                            {p.frameUrl
                              ? <img src={p.frameUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                              : <Film size={16} style={{ color: 'var(--text-muted)' }} />}
                            {p.frameTs != null && (
                              <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                                {t('sec.storyboard.frameAt', 'кадр {{s}}с', { s: p.frameTs.toFixed(1) })}
                              </span>
                            )}
                            {p.type === 'final' && (
                              <span className="absolute bottom-5 left-2 right-2 text-[9.5px] px-1.5 py-1 rounded text-center" style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', lineHeight: 1.3 }}>
                                {p.text || t('sec.storyboard.ctaPh', 'Пиши СЛОВО в комментариях')}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <select value={p.type} onChange={(e) => setPanel(pi, (x) => { x.type = e.target.value as PanelType; })}
                          className="text-[11px] font-600 rounded-lg px-1.5 py-1 outline-none flex-1 min-w-0" style={inputStyle}>
                          {PANEL_TYPES.map((pt) => (
                            <option key={pt.key} value={pt.key}>{t(`sec.storyboard.pt_${pt.key}`, pt.ru)}</option>
                          ))}
                        </select>
                        <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{fmtT(p.start)}–{fmtT(p.end)}</span>
                      </div>
                      {(p.type === 'title' || p.type === 'split' || p.type === 'final') && (
                        <textarea value={p.text || ''} rows={2}
                          onChange={(e) => setPanel(pi, (x) => { x.text = e.target.value.slice(0, 160); })}
                          placeholder={p.type === 'final' ? t('sec.storyboard.ctaPh', 'Пиши СЛОВО в комментариях') : t('sec.storyboard.titlePh', 'Текст титра (коротко)')}
                          className="text-[11px] rounded-lg px-2 py-1.5 outline-none resize-none" style={inputStyle} />
                      )}
                      <div className="flex items-center gap-1 mt-auto">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{pi + 1}/{chunk.panels.length}</span>
                        <button type="button" onClick={() => removePanel(pi)} disabled={chunk.panels.length <= 3}
                          title={t('sec.storyboard.delPanel', 'Убрать панель (время уйдёт соседней)')}
                          className="w-[25px] h-[25px] rounded-lg flex items-center justify-center ml-auto disabled:opacity-40"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {chunk.panels.length < 8 && (
                    <button type="button" onClick={addPanel}
                      className="rounded-xl flex flex-col items-center justify-center gap-1"
                      style={{ minHeight: 120, border: '1.5px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <Plus size={16} /> <span className="text-[10px]">{t('sec.storyboard.addPanel', 'Панель')}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" disabled={!!doc.busy || acting === 'png'}
                    onClick={() => act('png', () => fetch(`/api/storyboard/${id}/png`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ chunk: chunk.idx }) }))}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-700 disabled:opacity-50" style={btnGhost}>
                    {acting === 'png' ? <Loader2 size={13} className="animate-spin" /> : <LayoutGrid size={13} />}
                    {t('sec.storyboard.makePng', 'Собрать PNG-сториборд')}
                  </button>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {t('sec.storyboard.pngHint', 'Проверьте глазами: тексты без ошибок, кадры ваши — дешевле поймать здесь, чем после генерации.')}
                  </span>
                </div>
                {chunk.pngUrl && (
                  <a href={chunk.pngUrl} target="_blank" rel="noreferrer" title={t('sec.storyboard.pngOpen', 'Открыть в полный размер')}>
                    <img src={chunk.pngUrl} alt="" className="rounded-xl" style={{ maxWidth: 300, width: '100%', border: '1px solid var(--border-subtle)' }} />
                  </a>
                )}
              </div>
            </>
          )}
          {step === 3 && !chunk && (
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('sec.storyboard.noChunks', 'Кусков ещё нет — выполните шаг 2 «Расшифровка».')}</p>
          )}

          {/* ── Шаг 4: Генерация ── */}
          {step === 4 && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.storyboard.genTitle', 'Генерация кусков')}</div>
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {(doc.settings?.engine || 'program') === 'omni'
                  ? t('sec.storyboard.genIntroOmni', 'Движок Omni Flash: одна генерация на кусок — стартовый кадр «оживает» по промпту панелей, поверх кладётся ваш оригинальный голос. Стоимость ≈$1/кусок (~10с × $0.10) с ключа Gemini. Сначала кусок 1!')
                  : (doc.settings?.engine || 'program') === 'flow'
                  ? t('sec.storyboard.genIntroFlow2', 'Движок Flow — АВТОМАТ: откройте labs.google → Flow в браузере с расширением TrendTraffic и нажмите кнопку ниже. Расширение само зальёт кусок и сториборд, вставит промпт, сгенерирует и вернёт клип — кусок за куском, хоть на длинный ролик (лимит Flow ~8с/клип, поэтому и режем по 8с). Голос оригинала наложим сами. Ручной режим — кнопки на карточках.')
                  : t('sec.storyboard.genIntro', 'Дисциплина конвейера: сначала кусок 1. Проверьте результат — остальные разблокируются. Программный движок монтирует по панелям: наезды, титры, врезки, сплит-экран.')}
              </p>
              {(doc.settings?.engine || 'program') === 'flow' && (
                <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" disabled={!!acting || chunks.every((c) => !c.enabled || c.status === 'done')}
                      onClick={() => act('flowAll', () => fetch(`/api/storyboard/${id}/flow-queue`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ chunks: 'all' }) }))}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-700 disabled:opacity-50" style={btnPrimary}>
                      {acting === 'flowAll' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {t('sec.storyboard.flowQueueAll', 'Автомат: отправить все куски в Flow')}
                    </button>
                    <label className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={doc.settings?.autoAssemble !== false}
                        onChange={(e) => patchLocal((d) => { d.settings = { ...d.settings, autoAssemble: e.target.checked }; })} />
                      {t('sec.storyboard.autoAssemble', 'Автосборка ролика, когда все куски готовы')}
                    </label>
                  </div>
                  {flowActive && (
                    <div className="text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--brand)' }}>
                      <Loader2 size={12} className="animate-spin" />
                      {t('sec.storyboard.flowActiveHint', 'Очередь Flow работает — держите вкладку labs.google/…/flow открытой. Статусы обновляются сами.')}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {chunks.map((c) => {
                  const locked = c.idx > 0 && !chunk0Done;
                  const isBusy = doc.busy?.stage === 'render' && doc.busy?.chunk === c.idx;
                  return (
                    <div key={c.idx} className="rounded-xl p-3 flex items-center gap-3 flex-wrap" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', opacity: c.enabled ? 1 : 0.55 }}>
                      <div className="flex-1 min-w-[140px]">
                        <div className="text-[12px] font-600" style={{ color: 'var(--text-primary)' }}>
                          {t('sec.storyboard.chunkN', 'Кусок {{n}}', { n: c.idx + 1 })} · {fmtT(c.start)}–{fmtT(c.end)} · {c.panels.length} {t('sec.storyboard.panelsShort', 'пан.')}
                        </div>
                        <div className="text-[10px]" style={{ color: c.status === 'failed' ? '#f87171' : 'var(--text-muted)' }}>
                          {isBusy ? t('sec.storyboard.chRendering', 'Рендерится…')
                            : c.status === 'done' ? t('sec.storyboard.chDone', 'Готов — посмотрите результат')
                            : c.status === 'failed' ? (c.error || t('sec.storyboard.chFailed', 'Ошибка рендера'))
                            : t('sec.storyboard.chDraft', 'Не сгенерирован')}
                        </div>
                      </div>
                      {c.renderUrl && (
                        <video src={c.renderUrl} controls playsInline className="rounded-lg" style={{ height: 130, aspectRatio: '9/16', background: '#000' }} />
                      )}
                      {(doc.settings?.engine || 'program') !== 'flow' ? (
                        <button type="button" disabled={!!doc.busy || !!acting || locked || !c.enabled}
                          onClick={() => act(`render${c.idx}`, () => fetch(`/api/storyboard/${id}/render`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ chunk: c.idx }) }))}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-700 disabled:opacity-50"
                          style={c.idx === 0 && c.status !== 'done' ? btnPrimary : btnGhost}
                          title={locked ? t('sec.storyboard.lockedHint', 'Сначала сгенерируйте и проверьте кусок 1') : undefined}>
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : locked ? <Lock size={12} /> : c.status === 'done' ? <RefreshCw size={12} /> : <Play size={12} />}
                          {c.status === 'done' ? t('sec.storyboard.reRender', 'Перегенерить') : t('sec.storyboard.render', 'Сгенерировать')}
                        </button>
                      ) : (
                        <div className="flex flex-col gap-1.5" style={{ minWidth: 200 }}>
                          {(() => {
                            const q = doc.flowQueue?.[c.idx];
                            if (!q || c.status === 'done') return null;
                            const txt = q.status === 'queued' ? t('sec.storyboard.fqQueued', 'в очереди Flow')
                              : q.status === 'running' ? t('sec.storyboard.fqRunning', 'генерится в Flow…')
                              : q.status === 'failed' ? `${t('sec.storyboard.fqFailed', 'Flow: ошибка')}${q.note ? ` — ${q.note}` : ''}`
                              : q.status;
                            return (
                              <span className="inline-flex items-center gap-1.5 text-[10.5px] px-2 py-1 rounded-lg"
                                style={{ background: q.status === 'failed' ? 'rgba(239,68,68,0.10)' : 'rgba(99,102,241,0.10)', color: q.status === 'failed' ? '#f87171' : 'var(--brand)' }}>
                                {(q.status === 'queued' || q.status === 'running') && <Loader2 size={11} className="animate-spin" />}
                                {txt}
                              </span>
                            );
                          })()}
                          <button type="button" disabled={!!acting || !c.enabled || (doc.flowQueue?.[c.idx]?.status === 'queued' || doc.flowQueue?.[c.idx]?.status === 'running')}
                            onClick={() => act(`fq${c.idx}`, () => fetch(`/api/storyboard/${id}/flow-queue`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ chunks: [c.idx] }) }))}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-700 disabled:opacity-50"
                            style={c.idx === 0 && c.status !== 'done' ? btnPrimary : btnGhost}>
                            {acting === `fq${c.idx}` ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={12} />}
                            {c.status === 'done' ? t('sec.storyboard.fqAgain', 'В Flow ещё раз') : t('sec.storyboard.fqAuto', 'В Flow (автомат)')}
                          </button>
                          <button type="button" disabled={!!doc.busy || !!acting || locked || !c.enabled}
                            onClick={() => void prepFlow(c.idx)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-700 disabled:opacity-50" style={btnGhost}
                            title={locked ? t('sec.storyboard.lockedHint', 'Сначала сгенерируйте и проверьте кусок 1') : undefined}>
                            {acting === `prep${c.idx}` ? <Loader2 size={13} className="animate-spin" /> : locked ? <Lock size={12} /> : <Download size={12} />}
                            {t('sec.storyboard.flowMats', 'Материалы для Flow')}
                          </button>
                          {flowMats[c.idx] && (
                            <div className="flex flex-col gap-1 text-[10.5px]">
                              <a href={flowMats[c.idx].chunkUrl} download
                                className="px-2.5 py-1.5 rounded-lg" style={{ ...btnGhost, textDecoration: 'none', textAlign: 'center' }}>
                                ⬇ {t('sec.storyboard.flowChunkFile', 'Кусок (mp4 со звуком)')}
                              </a>
                              {flowMats[c.idx].pngUrl && (
                                <a href={flowMats[c.idx].pngUrl!} target="_blank" rel="noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg" style={{ ...btnGhost, textDecoration: 'none', textAlign: 'center' }}>
                                  🖼 {t('sec.storyboard.flowPngFile', 'PNG-сториборд')}
                                </a>
                              )}
                              <button type="button"
                                onClick={() => { void navigator.clipboard?.writeText(flowMats[c.idx].prompt).then(() => { setPromptCopied(c.idx); setTimeout(() => setPromptCopied(null), 1600); }); }}
                                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={btnGhost}>
                                {promptCopied === c.idx ? <Check size={11} style={{ color: '#34d399' }} /> : <Copy size={11} />}
                                {promptCopied === c.idx ? t('sec.storyboard.flowPromptCopied', 'Промпт скопирован') : t('sec.storyboard.flowPromptCopy', 'Скопировать промпт')}
                              </button>
                            </div>
                          )}
                          <button type="button" disabled={!!doc.busy || !!acting || locked || !c.enabled}
                            onClick={() => setAttachFor(c.idx)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-700 disabled:opacity-50"
                            style={c.idx === 0 && c.status !== 'done' ? btnPrimary : btnGhost}>
                            <Paperclip size={12} /> {t('sec.storyboard.flowAttach', 'Прикрепить результат')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {(doc.settings?.engine || 'program') !== 'flow' && chunk0Done && chunks.some((c) => c.enabled && c.status !== 'done') && (
                <button type="button" disabled={!!doc.busy || !!acting || renderQueue.length > 0}
                  onClick={() => setRenderQueue(chunks.filter((c) => c.enabled && c.status !== 'done').map((c) => c.idx))}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-700 self-start disabled:opacity-50" style={btnPrimary}>
                  {renderQueue.length ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                  {t('sec.storyboard.renderAll', 'Сгенерировать остальные')}
                </button>
              )}
            </div>
          )}

          {/* ── Шаг 5: Сборка ── */}
          {step === 5 && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.storyboard.asmTitle', 'Финальная сборка')}</div>
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {t('sec.storyboard.asmIntro', 'Готовые куски склеиваются по порядку, сверху бейдж и (по желанию) субтитры. Результат падает в Галерею → «Медиафайлы» и готов к Публикатору.')}
              </p>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {t('sec.storyboard.asmReady', 'Готово кусков: {{a}} из {{b}} включённых.', { a: doneChunks.length, b: chunks.filter((c) => c.enabled).length })}
              </div>
              <button type="button" disabled={!!doc.busy || !!acting || !doneChunks.length}
                onClick={() => act('assemble', () => fetch(`/api/storyboard/${id}/assemble`, { method: 'POST', headers: auth() }))}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-700 self-start disabled:opacity-50" style={btnPrimary}>
                {doc.busy?.stage === 'assemble' ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                {t('sec.storyboard.assemble', 'Собрать ролик')}
              </button>
              {doc.resultUrl && (
                <div className="flex flex-col gap-2">
                  <video src={doc.resultUrl} controls playsInline className="rounded-xl" style={{ maxWidth: 260, aspectRatio: '9/16', background: '#000' }} />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => navigate('/gallery?tab=reference')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-700" style={btnGhost}>
                      {t('sec.storyboard.toGallery', 'Открыть в Галерее')}
                    </button>
                    <a href={doc.resultUrl} download
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-700" style={{ ...btnGhost, textDecoration: 'none' }}>
                      <Download size={13} /> {t('sec.storyboard.download', 'Скачать')}
                    </a>
                    <button type="button" onClick={() => navigate('/gallery?tab=publisher')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-700" style={btnGhost}>
                      {t('sec.storyboard.toPublisher', 'В Публикатор')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ Правый рельс: стиль / движок / настройки ═══ */}
        <div className="w-full lg:w-[230px] flex-shrink-0 flex flex-col gap-3">
          <div className="rounded-2xl p-3.5 flex flex-col gap-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <div className="text-[10px] font-700 uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('sec.storyboard.setStyle', 'Стиль')}</div>
              <select value={doc.settings?.style || 'clean'}
                onChange={(e) => patchLocal((d) => { d.settings = { ...d.settings, style: e.target.value }; })}
                className="w-full text-[12px] rounded-lg px-2 py-1.5 outline-none" style={inputStyle}>
                {STYLES.map((s) => <option key={s.key} value={s.key}>{t(`sec.storyboard.style_${s.key}`, s.ru)}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-700 uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('sec.storyboard.setEngine', 'Движок')}</div>
              <div className="flex flex-col gap-1.5 text-[12px]">
                {([
                  { key: 'program', label: t('sec.storyboard.engProgram', 'Программный (ffmpeg)'), hint: t('sec.storyboard.engProgramHint', 'бесплатно, без ключей') },
                  { key: 'omni', label: 'Omni Flash API', hint: t('sec.storyboard.engOmniHint', '≈$1/кусок, ключ Gemini') },
                  { key: 'flow', label: `Flow-${t('sec.storyboard.engExt', 'расширение')}`, hint: t('sec.storyboard.engFlowHint', 'полуавтомат, подписка Flow') },
                ] as { key: string; label: string; hint: string }[]).map((e) => (
                  <label key={e.key} className="inline-flex items-start gap-2 cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                    <input type="radio" name="sb-engine" className="mt-0.5"
                      checked={(doc.settings?.engine || 'program') === e.key}
                      onChange={() => patchLocal((d) => { d.settings = { ...d.settings, engine: e.key as any }; })} />
                    <span>
                      {e.label}
                      <span className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>{e.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-700 uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('sec.storyboard.setBadge', 'Бейдж в углу')}</div>
              <input value={doc.settings?.badgeText ?? ''} placeholder={t('sec.storyboard.badgePh', 'например, @мойканал')}
                onChange={(e) => patchLocal((d) => { d.settings = { ...d.settings, badgeText: e.target.value.slice(0, 40) }; })}
                className="w-full text-[12px] rounded-lg px-2 py-1.5 outline-none" style={inputStyle} />
            </div>
            <div>
              <div className="text-[10px] font-700 uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('sec.storyboard.setCta', 'Кодовое слово CTA')}</div>
              <input value={doc.settings?.ctaWord ?? ''} placeholder={t('sec.storyboard.ctaWordPh', 'ТРЕНД')}
                onChange={(e) => patchLocal((d) => { d.settings = { ...d.settings, ctaWord: e.target.value.slice(0, 24) }; })}
                className="w-full text-[12px] rounded-lg px-2 py-1.5 outline-none" style={inputStyle} />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('sec.storyboard.ctaHintV2', 'То же кодовое слово используйте в подписи к посту.')}</p>
            </div>
            <label className="inline-flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={!!doc.settings?.subtitles}
                onChange={(e) => patchLocal((d) => { d.settings = { ...d.settings, subtitles: e.target.checked }; })} />
              {t('sec.storyboard.setSubs', 'Субтитры из расшифровки')}
            </label>
            <div className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {t('sec.storyboard.costNote', 'Программный движок не тратит внешние ключи. Расшифровка — 1 запрос Gemini; ИИ-план панелей — 1 запрос Claude (ключи в Настройках).')}
            </div>
          </div>
        </div>
      </div>

      {/* Пикер клипа Flow: прикрепить результат генерации как рендер куска */}
      <GalleryPicker
        open={attachFor != null}
        onClose={() => setAttachFor(null)}
        onPick={(g: GalleryPickItem) => {
          const ci = attachFor; setAttachFor(null);
          if (ci != null) {
            void act(`attach${ci}`, () => fetch(`/api/storyboard/${id}/attach-render`, {
              method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ chunk: ci, fileUrl: g.fileUrl }),
            }));
          }
        }}
        token={token}
        title={t('sec.storyboard.attachTitle', 'Клип из Flow для куска')}
        note={t('sec.storyboard.attachNote', 'Выберите клип, сохранённый расширением из Google Flow («В галерею»). Мы приведём его к формату куска и наложим оригинальный голос.')}
        onlyType="video"
      />

      {/* Пикер картинки для панели (врезка/сплит/мокап) */}
      <GalleryPicker
        open={imgPickFor != null}
        onClose={() => setImgPickFor(null)}
        onPick={(g: GalleryPickItem) => { const pi = imgPickFor; setImgPickFor(null); if (pi != null) setPanel(pi, (x) => { x.imageUrl = g.fileUrl; }); }}
        token={token}
        title={t('sec.storyboard.imgPickTitle', 'Картинка панели')}
        note={t('sec.storyboard.imgPickNote', 'Скрин статистики, фото продукта, график — попадёт во врезку/сплит/мокап этой панели.')}
        onlyType="image"
      />
    </div>
  );
}
