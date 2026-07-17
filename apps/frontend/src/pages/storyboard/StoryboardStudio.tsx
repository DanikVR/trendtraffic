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
  Plus, Trash2, AlertTriangle, Download, Film, LayoutGrid, Wand2, Lock,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { GalleryPicker, type GalleryPickItem } from '../../components/GalleryPicker';

type PanelType = 'speaker' | 'title' | 'cutaway' | 'split' | 'mockup' | 'final';
interface SbPanel { type: PanelType; start: number; end: number; text?: string; frameTs?: number; imageUrl?: string; prompt?: string }
interface SbChunk { idx: number; start: number; end: number; enabled: boolean; status: string; panels: SbPanel[]; pngUrl?: string; renderUrl?: string; error?: string }
interface SbDoc {
  id: string; name: string; status: string;
  sourceUrl?: string | null; sourceDuration?: number | null;
  plan: { transcript?: { start: number; end: number; text: string }[]; chunks?: SbChunk[]; planSource?: string; planNote?: string };
  settings: { style?: string; engine?: string; badgeText?: string; subtitles?: boolean; ctaWord?: string };
  resultUrl?: string | null; error?: string | null;
  busy?: { stage: string; chunk?: number } | null;
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

  // Поллинг, пока идёт фоновая операция
  useEffect(() => {
    if (!doc?.busy && doc?.status !== 'analyzing' && doc?.status !== 'rendering') return;
    const iv = setInterval(() => { void load(); }, 2500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.busy?.stage, doc?.busy?.chunk, doc?.status]);

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
    : busyStage === 'assemble' ? t('sec.storyboard.busyAssemble', 'финальная сборка') : null;

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
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {t('sec.storyboard.trIntro', 'Gemini смотрит видео целиком: дословная речь с таймкодами + реальные сцены. Затем ролик режется на куски до 8 секунд по концам фраз, и на каждый строится раскадровка.')}
              </p>
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

                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                  {chunk.panels.map((p, pi) => (
                    <div key={pi} className="rounded-xl p-2.5 flex flex-col gap-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-1.5">
                        <select value={p.type} onChange={(e) => setPanel(pi, (x) => { x.type = e.target.value as PanelType; })}
                          className="text-[11px] font-600 rounded-lg px-1.5 py-1 outline-none flex-1 min-w-0" style={inputStyle}>
                          {PANEL_TYPES.map((pt) => (
                            <option key={pt.key} value={pt.key}>{t(`sec.storyboard.pt_${pt.key}`, pt.ru)}</option>
                          ))}
                        </select>
                        <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{fmtT(p.start)}–{fmtT(p.end)}</span>
                      </div>
                      {(p.type === 'cutaway' || p.type === 'split' || p.type === 'mockup') && (
                        <button type="button" onClick={() => setImgPickFor(pi)}
                          className="rounded-lg flex items-center justify-center relative overflow-hidden"
                          style={{ height: 74, background: '#000', border: '1px dashed var(--border-strong)', cursor: 'pointer' }}
                          title={t('sec.storyboard.pickImg', 'Картинка из Галереи (скрин, фото, график)')}>
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            : <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}><ImageIcon size={12} /> {t('sec.storyboard.noImg', 'без картинки — кадр из видео')}</span>}
                        </button>
                      )}
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
                {t('sec.storyboard.genIntro', 'Дисциплина конвейера: сначала кусок 1. Проверьте результат — остальные разблокируются. Программный движок монтирует по панелям: наезды, титры, врезки, сплит-экран.')}
              </p>
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
                      <button type="button" disabled={!!doc.busy || !!acting || locked || !c.enabled}
                        onClick={() => act(`render${c.idx}`, () => fetch(`/api/storyboard/${id}/render`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ chunk: c.idx }) }))}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-700 disabled:opacity-50"
                        style={c.idx === 0 && c.status !== 'done' ? btnPrimary : btnGhost}
                        title={locked ? t('sec.storyboard.lockedHint', 'Сначала сгенерируйте и проверьте кусок 1') : undefined}>
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : locked ? <Lock size={12} /> : c.status === 'done' ? <RefreshCw size={12} /> : <Play size={12} />}
                        {c.status === 'done' ? t('sec.storyboard.reRender', 'Перегенерить') : t('sec.storyboard.render', 'Сгенерировать')}
                      </button>
                    </div>
                  );
                })}
              </div>
              {chunk0Done && chunks.some((c) => c.enabled && c.status !== 'done') && (
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
                <label className="inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <input type="radio" checked readOnly /> {t('sec.storyboard.engProgram', 'Программный (ffmpeg)')}
                </label>
                <label className="inline-flex items-center gap-2" style={{ color: 'var(--text-muted)' }} title={t('sec.storyboard.engSoon', 'Скоро')}>
                  <input type="radio" disabled /> Omni Flash API <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>{t('sec.storyboard.soon', 'скоро')}</span>
                </label>
                <label className="inline-flex items-center gap-2" style={{ color: 'var(--text-muted)' }} title={t('sec.storyboard.engSoon', 'Скоро')}>
                  <input type="radio" disabled /> Flow-{t('sec.storyboard.engExt', 'расширение')} <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>{t('sec.storyboard.soon', 'скоро')}</span>
                </label>
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
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('sec.storyboard.ctaHint', 'То же слово используйте в подписи («Скиллы → Формула подписи»).')}</p>
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
