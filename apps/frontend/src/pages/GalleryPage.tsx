/**
 * GalleryPage — медиа-библиотека (TrendTraffic).
 *
 * Дизайн «1:1 с разделом Тренды (social-extension)»: сегмент-вкладки-папки (индиго),
 * плотная сетка карточек с обложкой+оверлеями (чекбокс, просмотры, длительность),
 * тулбар «Найдено · Выбрать всё · Удалить выбранные · Скачать выбранные».
 *
 * Четыре папки (вкладки):
 *  - Тренды     — скачанные видео из «Трендов» (source_videos, downloaded).
 *  - Референс   — загружаемые изображения/видео (media_assets kind='reference').
 *  - Аудио      — загружаемые аудиофайлы (media_assets kind='audio').
 *  - Из анализа — сохранённое со страницы аналитики (media_assets folder='analyzed').
 *
 * Поиск, проигрывание/просмотр, выбор (в т.ч. «выбрать всё»), скачивание на устройство,
 * удаление одного и массовое. Загрузка медиа/аудио — иконками рядом с «Обновить».
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Image as ImageIcon, Video, Music, Search, Loader2, Trash2, ExternalLink,
  CheckSquare, Square, Check, Eye, Heart, RefreshCw, UploadCloud, FileText, Sparkles,
  Download, Play, BookOpen, Clapperboard, ArrowRight, Plus, TrendingUp, Users, LayoutTemplate, X,
} from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { VideoViewer } from '../components/VideoViewer';
import { AudioPlayer } from '../components/AudioPlayer';
import { useAppStore } from '../store/useAppStore';
import { TT_EXT_VERSION } from '../components/AppVersion';
import { coverSrc } from '../components/TrendSearch';

type Tab = 'trends' | 'reference' | 'audio' | 'analyzed' | 'hotebook' | 'flow' | 'ugc' | 'trendhub';

interface GalleryItem {
  id: string;
  mediaType: 'video' | 'image' | 'audio' | 'file';
  fileUrl: string;
  coverUrl?: string;
  title: string;       // @author или имя файла
  subtitle?: string;   // описание
  webUrl?: string;
  durationSec?: number;
  stats?: { play?: number; like?: number };
  isTrend: boolean;
  hasAnalysis?: boolean; // «Из анализа»: есть сохранённый разбор → бейдж + просмотр
}

// Галерея = ГЛАВНЫЙ ЭКРАН (2026-07-08): всё проходит через неё. Единый стиль раздела:
// первой в сетке стоит плитка «+ Добавить» — она открывает соответствующий блок
// (Hotebook / Google Flow / UGC-студию / скан Трендов), рядом — сохранённые файлы раздела.
//  - TrendFlow   — всё, что произвёл TrendFlow (ролики, склейки, кадры) + ручные загрузки.
//  - Аудио       — аудиофайлы.
//  - Из анализа  — сохранённое со страницы аналитики (+ бейдж «Анализ»).
//  - Hotebook    — артефакты NotebookLM; «+» открывает блок Hotebook.
//  - Google Flow — клипы из Google Flow (Veo); «+» открывает блок Flow.
//  - UGC         — рендеры UGC-студии + макеты (бренд-киты); «+» открывает студию.
//  - Тренды      — проанализированные видео (с разбором) + сохранённые запросы сканов;
//                  клик по запросу открывает «Тренды» с уже готовой выдачей по слову.
const TABS: { key: Tab; label: string }[] = [
  { key: 'reference', label: 'TrendFlow' },
  { key: 'audio', label: 'Аудио' },
  { key: 'analyzed', label: 'Из анализа' },
  { key: 'hotebook', label: 'Hotebook' },
  { key: 'flow', label: 'Google Flow' },
  { key: 'ugc', label: 'UGC' },
  { key: 'trendhub', label: 'Тренды' },
];

function tabIcon(key: Tab, size = 15) {
  if (key === 'trends') return <Video size={size} />;
  if (key === 'reference') return <ImageIcon size={size} />;
  if (key === 'audio') return <Music size={size} />;
  if (key === 'hotebook') return <BookOpen size={size} />;
  if (key === 'flow') return <Clapperboard size={size} />;
  if (key === 'ugc') return <Users size={size} />;
  if (key === 'trendhub') return <TrendingUp size={size} />;
  return <Sparkles size={size} />;
}

function fmt(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function dur(s?: number): string {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface TrendAnalysisItem {
  id: string;
  mediaAssetId?: string;
  sourceUrl?: string;
  platform?: string;
  dna: any;
  fileUrl?: string;  // видео в Галерее (если сохранено)
  title?: string;
  createdAt?: string;
}

interface TrendQueryItem {
  id: string;
  query: string;
  platform: string;
  resultCount: number;
  createdAt: string;
}

interface BrandKit { id: string; name: string; data?: any }

export default function GalleryPage() {
  const { token } = useAppStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('reference');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const [analysis, setAnalysis] = useState<{ title: string; dna: any } | null>(null); // просмотр сохранённого разбора
  const [analysisLoading, setAnalysisLoading] = useState(false);
  // «Тренды»: проанализированные видео + сохранённые запросы сканов.
  const [analyses, setAnalyses] = useState<TrendAnalysisItem[]>([]);
  const [trendQueries, setTrendQueries] = useState<TrendQueryItem[]>([]);
  // «UGC»: макеты (бренд-киты студии).
  const [kits, setKits] = useState<BrandKit[]>([]);

  // Отправка медиа в Google Flow через Chrome-расширение (postMessage-мост, как в блоке Google Flow).
  const [extStatus, setExtStatus] = useState<'checking' | 'present' | 'absent'>('checking');
  const [flowMsg, setFlowMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [extPopup, setExtPopup] = useState(false);
  const [videoPopup, setVideoPopup] = useState<GalleryItem | null>(null); // видео → скачать + инструкция
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const d = ev.data;
      if (!d || d.source !== 'tt-flow-ext') return;
      if (d.type === 'present' || d.type === 'status' || d.type === 'connected') setExtStatus('present');
      if (d.type === 'push-to-flow-result') {
        setFlowMsg(d.ok ? { ok: true, text: 'Отправлено в Google Flow — переключитесь на вкладку Flow.' } : { ok: false, text: 'Не удалось: ' + (d.error || 'ошибка') });
        setTimeout(() => setFlowMsg(null), 6000);
      }
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ source: 'trendtraffic', type: 'status' }, window.location.origin);
    const t = setTimeout(() => setExtStatus((s) => (s === 'checking' ? 'absent' : s)), 1400);
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t); };
  }, []);
  const sendToFlow = (v: GalleryItem) => {
    // Видео: Flow НЕ принимает авто-вставкой (у Flow поле только image/*). Скачиваем файл + инструкция «залей вручную».
    if (v.mediaType === 'video') { downloadOne(v); setVideoPopup(v); return; }
    // Картинка: авто-вставка через расширение (нет расширения → поп-ап установки).
    if (extStatus !== 'present') { setExtPopup(true); return; }
    const abs = /^https?:/i.test(v.fileUrl) ? v.fileUrl : window.location.origin + (v.fileUrl.startsWith('/') ? v.fileUrl : '/' + v.fileUrl);
    window.postMessage({ source: 'trendtraffic', type: 'push-to-flow', url: abs, title: v.title, kind: 'image' }, window.location.origin);
    setFlowMsg({ ok: true, text: `Отправляю «${v.title}» в Google Flow…` });
    setTimeout(() => setFlowMsg(null), 6000);
  };

  const openAnalysis = async (v: GalleryItem) => {
    setAnalysis({ title: v.title, dna: null }); setAnalysisLoading(true);
    try {
      const r = await fetch(`/api/trends/media/${v.id}/analysis`, { headers: jsonHeaders() });
      if (r.ok) setAnalysis({ title: v.title, dna: (await r.json()).analysis?.dna || {} });
      else setAnalysis({ title: v.title, dna: { __error: r.status === 404 ? 'Анализ не найден.' : `Ошибка ${r.status}` } });
    } catch { setAnalysis({ title: v.title, dna: { __error: 'Не удалось загрузить анализ.' } }); }
    finally { setAnalysisLoading(false); }
  };

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const authHeader = (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});
  const jsonHeaders = (): HeadersInit => ({ 'Content-Type': 'application/json', ...authHeader() });

  const load = async (which: Tab = tab) => {
    setLoading(true); setError(null); setSelected(new Set());
    try {
      if (which === 'trends') {
        const res = await fetch('/api/trends/videos?downloaded=1&limit=200', { headers: jsonHeaders() });
        if (res.ok) {
          const d = await res.json();
          setItems((d.videos || []).map((v: any): GalleryItem => ({
            id: v.id, mediaType: 'video', fileUrl: v.fileUrl, coverUrl: v.coverUrl,
            title: `@${v.author}`, subtitle: v.description, webUrl: v.webUrl,
            durationSec: v.durationSec, stats: v.stats, isTrend: true,
          })));
        }
      } else if (which === 'trendhub') {
        // «Тренды»: разбор (video_analyses) + запросы сканов — двумя запросами параллельно.
        setItems([]);
        const [ar, qr] = await Promise.all([
          fetch('/api/trends/analyses?limit=200', { headers: jsonHeaders() }),
          fetch('/api/trends/history?limit=60', { headers: jsonHeaders() }),
        ]);
        setAnalyses(ar.ok ? ((await ar.json()).analyses || []) : []);
        setTrendQueries(qr.ok ? ((await qr.json()).queries || []) : []);
      } else {
        // Папочные вкладки: 'analyzed'/'hotebook'/'flow'/'ugc' → folder=…; иначе по kind.
        const FOLDER_TABS: Partial<Record<Tab, string>> = { analyzed: 'analyzed', hotebook: 'hotebook', flow: 'flow', ugc: 'ugc' };
        const qsMedia = FOLDER_TABS[which] ? `folder=${FOLDER_TABS[which]}` : `kind=${which}`;
        const res = await fetch(`/api/trends/media?${qsMedia}`, { headers: jsonHeaders() });
        if (res.ok) {
          const d = await res.json();
          setItems((d.assets || []).map((a: any): GalleryItem => ({
            id: a.id, mediaType: a.mediaType, fileUrl: a.fileUrl,
            title: a.originalName || 'файл', isTrend: false, hasAnalysis: !!a.hasAnalysis,
          })));
        }
        // «UGC»: рядом с рендерами — макеты (бренд-киты студии).
        if (which === 'ugc') {
          try {
            const kr = await fetch('/api/render/ugc/brandkits', { headers: jsonHeaders() });
            setKits(kr.ok ? ((await kr.json()).kits || []) : []);
          } catch { setKits([]); }
        }
      }
    } catch (e: any) { setError(e?.message || 'Ошибка загрузки'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

  // ── «+ Добавить» — первой плиткой каждого раздела: открывает блок раздела ──
  const addAction = (which: Tab): { label: string; hint: string; run: () => void } => {
    switch (which) {
      case 'audio': return { label: 'Добавить аудио', hint: 'Загрузить аудиофайлы с устройства', run: () => audioInputRef.current?.click() };
      case 'analyzed': return { label: 'Добавить', hint: 'Открыть «Тренды → Аналитика»: разобрать видео и сохранить в галерею', run: () => navigate('/social-extension?tab=analytics') };
      case 'hotebook': return { label: 'Добавить', hint: 'Открыть блок «Hotebook»: источники, чат и генерация артефактов', run: () => navigate('/flow?open=hotebook') };
      case 'flow': return { label: 'Добавить', hint: 'Открыть блок «Google Flow» (Veo): генерация клипов', run: () => navigate('/flow?open=flow') };
      case 'ugc': return { label: 'Добавить', hint: 'Открыть UGC-студию: собрать ролик с аватаром/озвучкой', run: () => navigate('/flow?open=ugc') };
      case 'trendhub': return { label: 'Добавить тренд', hint: 'Открыть «Тренды»: сканировать и анализировать', run: () => navigate('/social-extension') };
      default: return { label: 'Добавить', hint: 'Открыть TrendFlow — сценарии производства видео (или загрузите файлы кнопкой «Медиа»)', run: () => navigate('/flow') };
    }
  };
  // Рендер-функция (не компонент — чтобы не перемонтировалась на каждый рендер страницы).
  const renderAddTile = (which: Tab) => {
    const a = addAction(which);
    return (
      <button type="button" onClick={a.run} title={a.hint}
        className="rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors hover:border-[var(--border-stronger)]"
        style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer', minHeight: 180 }}>
        <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ border: '1px solid var(--border-strong)' }}>
          <Plus size={26} />
        </span>
        <span className="text-sm font-600 px-2 text-center">{a.label}</span>
        <span className="text-[11px] px-3 text-center leading-snug" style={{ color: 'var(--text-muted)' }}>{a.hint}</span>
      </button>
    );
  };

  // «UGC»: удалить макет (бренд-кит студии).
  const deleteKit = async (k: BrandKit) => {
    try {
      const r = await fetch(`/api/render/ugc/brandkits/${k.id}`, { method: 'DELETE', headers: jsonHeaders() });
      if (r.ok) setKits((prev) => prev.filter((x) => x.id !== k.id));
    } catch { /* не критично */ }
  };

  // «Тренды»: убрать запрос из истории сканов.
  const deleteQuery = async (q: TrendQueryItem) => {
    try {
      const r = await fetch('/api/trends/history/delete', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ query: q.query }) });
      if (r.ok) setTrendQueries((prev) => prev.filter((x) => x.query.toLowerCase() !== q.query.toLowerCase()));
    } catch { /* не критично */ }
  };

  // Вкладка «Тренды»: раздел «Анализ» (разобранные видео с обложкой и данными) +
  // раздел «Запросы трендов» (клик — «Тренды» открываются с готовой выдачей по слову).
  const renderTrendHub = () => {
    const q = query.trim().toLowerCase();
    const fAn = q ? analyses.filter((a) =>
      (a.title || '').toLowerCase().includes(q) || (a.dna?.meta?.author || '').toLowerCase().includes(q) || (a.sourceUrl || '').toLowerCase().includes(q)) : analyses;
    const fQs = q ? trendQueries.filter((x) => x.query.toLowerCase().includes(q)) : trendQueries;
    const anTitle = (a: TrendAnalysisItem) => a.title || a.dna?.meta?.author || 'Видео';
    return (
      <>
        {/* Анализ */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-700" style={{ color: 'var(--text-primary)' }}>
              <Sparkles size={15} style={{ color: '#22d3ee' }} /> Анализ
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {fAn.length} — уже разобранные видео: обложка + данные анализа</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {renderAddTile('trendhub')}
            {fAn.map((a) => {
              const cover = a.dna?.meta?.cover as string | undefined;
              const title = anTitle(a);
              const openDna = () => setAnalysis({ title, dna: a.dna || {} });
              return (
                <AuroraCard key={a.id} className="group p-0 overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative w-full" style={{ aspectRatio: '9 / 16', background: 'var(--bg-tertiary)' }}>
                    {a.fileUrl ? (
                      <button type="button" onClick={() => setViewer({ url: a.fileUrl!, title })} className="group/vid block w-full h-full relative" title="Открыть в просмотрщике (с обрезкой)">
                        <video src={`${a.fileUrl}#t=0.1`} poster={coverSrc(cover) || undefined} preload="metadata" muted className="w-full h-full object-cover pointer-events-none" />
                        <span className="absolute inset-0 flex items-center justify-center opacity-90 group-hover/vid:opacity-100">
                          <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                            <Play size={22} className="ml-0.5" />
                          </span>
                        </span>
                      </button>
                    ) : cover ? (
                      <button type="button" onClick={openDna} className="block w-full h-full" title="Открыть разбор">
                        <img src={coverSrc(cover)} alt={title} loading="lazy" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <button type="button" onClick={openDna} className="w-full h-full flex items-center justify-center" title="Открыть разбор"
                        style={{ background: 'transparent', border: 'none', color: '#22d3ee', cursor: 'pointer' }}>
                        <Sparkles size={34} />
                      </button>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); openDna(); }}
                      title="Открыть разбор виральности этого видео"
                      className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 text-[10px] font-700 px-2 py-1 rounded-lg transition-transform hover:scale-105"
                      style={{ background: 'rgba(34,211,238,0.92)', color: '#083344', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
                      <Sparkles size={11} /> Анализ
                    </button>
                  </div>
                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <div className="text-xs font-700 truncate" style={{ color: 'var(--text-primary)' }} title={title}>{title}</div>
                    {a.dna?.hookType && <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{a.dna.hookType}</p>}
                    <div className="flex items-center gap-1 pt-1 mt-auto">
                      {a.sourceUrl && (
                        <a href={a.sourceUrl} target="_blank" rel="noreferrer" title="Открыть оригинал"
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button type="button" onClick={openDna} title="Открыть разбор"
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-auto transition-colors hover:opacity-90"
                        style={{ background: 'rgba(34,211,238,0.14)', color: '#22d3ee' }}>
                        <Sparkles size={15} />
                      </button>
                    </div>
                  </div>
                </AuroraCard>
              );
            })}
          </div>
          {fAn.length === 0 && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Пока нет разборов. Нажмите «+ Добавить тренд» и проанализируйте видео — разобранное появится здесь с обложкой и данными анализа.
            </p>
          )}
        </div>

        {/* Запросы трендов */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-sm font-700" style={{ color: 'var(--text-primary)' }}>
              <Search size={15} style={{ color: 'var(--brand)' }} /> Запросы трендов
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {fQs.length} — клик: «Тренды» откроются с готовой выдачей по этому слову</span>
          </div>
          {fQs.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Пока нет запросов. Сканируйте тренды по ключевому слову — запросы сохранятся здесь, чтобы не набирать их дважды.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {fQs.map((x) => (
                <span key={x.id} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-xl"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                  <button type="button"
                    onClick={() => navigate(`/social-extension?q=${encodeURIComponent(x.query)}&platform=${encodeURIComponent(x.platform)}`)}
                    title={`Открыть «Тренды» с готовой выдачей: «${x.query}» (${x.platform})`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-600"
                    style={{ color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <TrendingUp size={13} style={{ color: 'var(--brand)' }} />
                    {x.query}
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>· {x.platform}{x.resultCount ? ` · ${x.resultCount}` : ''}</span>
                  </button>
                  <button type="button" onClick={() => void deleteQuery(x)} title="Убрать запрос из истории"
                    className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:opacity-80"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((v) => v.title.toLowerCase().includes(q) || (v.subtitle || '').toLowerCase().includes(q));
  }, [items, query]);

  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const visibleIds = filtered.map((v) => v.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds));

  const deleteBase = tab === 'trends' ? '/api/trends/videos' : '/api/trends/media';

  const doDeleteOne = async (id: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${deleteBase}/${id}`, { method: 'DELETE', headers: jsonHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((v) => v.id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e: any) { setError(e?.message || 'Не удалось удалить'); }
    finally { setBusy(false); }
  };
  const doDeleteSelected = async () => {
    const ids = visibleIds.filter((id) => selected.has(id));
    if (ids.length === 0) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${deleteBase}/delete-bulk`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ ids }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const idset = new Set(ids);
      setItems((prev) => prev.filter((v) => !idset.has(v.id)));
      setSelected(new Set());
    } catch (e: any) { setError(e?.message || 'Не удалось удалить'); }
    finally { setBusy(false); }
  };

  const askDeleteOne = (v: GalleryItem) => setConfirm({
    title: 'Удалить?', message: `${v.title} — файл будет удалён с диска безвозвратно.`,
    onConfirm: () => { setConfirm(null); doDeleteOne(v.id); },
  });
  const askDeleteSelected = () => setConfirm({
    title: `Удалить выбранные (${selected.size})?`, message: 'Все выбранные файлы будут удалены с диска безвозвратно.',
    onConfirm: () => { setConfirm(null); doDeleteSelected(); },
  });

  // Скачать один файл на устройство (статика /uploads — same-origin, без авторизации).
  const downloadOne = (v: GalleryItem) => {
    const a = document.createElement('a');
    a.href = v.fileUrl; a.download = ''; a.target = '_blank'; a.rel = 'noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  };
  // Скачать выбранные — по очереди со сдвигом (иначе браузер блокирует серию).
  const downloadSelected = () => {
    const targets = filtered.filter((v) => selected.has(v.id) && v.fileUrl);
    targets.forEach((v, i) => setTimeout(() => downloadOne(v), i * 350));
  };

  const handleFiles = async (files: FileList | null, kind: 'reference' | 'audio') => {
    if (!files || files.length === 0) return;
    setUploading(true); setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        // ВАЖНО: для FormData НЕ задаём Content-Type — браузер сам проставит boundary.
        const res = await fetch(`/api/trends/media/upload?kind=${kind}`, { method: 'POST', headers: authHeader(), body: fd });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      }
      setTab(kind); // load() сработает по смене вкладки
      if (tab === kind) await load(kind);
    } catch (e: any) { setError(e?.message || 'Ошибка загрузки'); }
    finally {
      setUploading(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const selectedCount = selected.size;

  const renderPreview = (v: GalleryItem) => {
    if (v.mediaType === 'video') return (
      <button type="button" onClick={() => setViewer({ url: v.fileUrl, title: v.title })}
        className="group/vid block w-full h-full relative" title="Открыть в просмотрщике (с обрезкой)">
        <video src={`${v.fileUrl}#t=0.1`} poster={v.coverUrl || undefined} preload="metadata" muted
          className="w-full h-full object-cover pointer-events-none" />
        <span className="absolute inset-0 flex items-center justify-center transition-opacity opacity-90 group-hover/vid:opacity-100">
          <span className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <Play size={22} className="ml-0.5" />
          </span>
        </span>
      </button>
    );
    if (v.mediaType === 'image') return <img src={v.fileUrl} alt={v.title} loading="lazy" className="w-full h-full object-cover" />;
    if (v.mediaType === 'audio') return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-3" style={{ background: 'var(--bg-tertiary)' }}>
        <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)' }}><Music size={26} /></span>
        <AudioPlayer src={v.fileUrl} />
      </div>
    );
    // Файлы (pdf/pptx/md/json/csv — артефакты Hotebook и т.п.): клик открывает в новой вкладке.
    const ext = (v.fileUrl.split('.').pop() || '').toUpperCase().slice(0, 5);
    return (
      <a href={v.fileUrl} target="_blank" rel="noreferrer" title="Открыть файл"
        className="w-full h-full flex flex-col items-center justify-center gap-2.5" style={{ background: 'var(--bg-tertiary)' }}>
        <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}>
          <FileText size={26} />
        </span>
        {ext && <span className="text-[10px] font-700 px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.35)', color: 'var(--text-secondary)' }}>{ext}</span>}
      </a>
    );
  };

  return (
    <div className="max-w-[1760px] mx-auto py-2 sm:py-3 space-y-4">
      {/* Header: иконка + заголовок + загрузка + обновить */}
      <div className="flex items-center gap-3 flex-wrap">
        <img src="/icons/nav-gallery.png" alt="" draggable={false}
             className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0" style={{ objectFit: 'contain' }} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-700 leading-tight" style={{ color: 'var(--text-primary)' }}>Галерея</h1>
          <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--text-muted)' }}>Главный экран: «+ Добавить» открывает блоки, рядом — всё сохранённое (TrendFlow, Hotebook, Google Flow, UGC, Тренды).</p>
        </div>
        {/* Загрузка медиа (изображения/видео) */}
        <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files, 'reference')} />
        <button type="button" onClick={() => mediaInputRef.current?.click()} disabled={uploading} title="Загрузить изображения/видео в «Референс»"
          className="inline-flex items-center gap-1.5 text-sm font-600 px-3 py-2 rounded-xl disabled:opacity-50 transition-colors"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />} Медиа
        </button>
        {/* Загрузка аудио */}
        <input ref={audioInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files, 'audio')} />
        <button type="button" onClick={() => audioInputRef.current?.click()} disabled={uploading} title="Загрузить аудио в «Аудио»"
          className="inline-flex items-center gap-1.5 text-sm font-600 px-3 py-2 rounded-xl disabled:opacity-50 transition-colors"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Music size={16} />} Аудио
        </button>
        <AuroraButton variant="secondary" onClick={() => load()} disabled={loading} icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />}>Обновить</AuroraButton>
      </div>

      {/* Папки — сегмент-вкладки (индиго-заливка активной), как секции в «Трендах» */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl sm:inline-flex" style={{ background: 'var(--bg-tertiary)' }}>
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-600 transition-all whitespace-nowrap"
              style={{ background: active ? 'var(--brand)' : 'transparent', color: active ? 'var(--brand-contrast)' : 'var(--text-muted)', boxShadow: active ? '0 2px 8px rgba(99,102,241,0.35)' : 'none' }}>
              {tabIcon(tb.key)} {tb.label}
            </button>
          );
        })}
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по имени / автору / описанию…"
          className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 transition-shadow"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          <Trash2 size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
      ) : tab === 'trendhub' ? (
        renderTrendHub()
      ) : (
        <>
          {/* Тулбар результатов — когда есть файлы */}
          {filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Найдено: {filtered.length}</span>
              <button type="button" onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {allSelected ? <CheckSquare size={15} color="var(--brand)" /> : <Square size={15} />}
                {allSelected ? 'Снять выделение' : 'Выбрать всё'}{selectedCount > 0 ? ` · ${selectedCount}` : ''}
              </button>
              <button type="button" onClick={askDeleteSelected} disabled={selectedCount === 0 || busy}
                title="Удалить выбранные файлы"
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Удалить{selectedCount > 0 ? ` · ${selectedCount}` : ''}
              </button>
            </div>
            <AuroraButton onClick={downloadSelected} disabled={selectedCount === 0}
              icon={<Download size={16} />}>
              {`Скачать выбранные${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
            </AuroraButton>
          </div>
          )}

          {/* «UGC»: макеты (бренд-киты студии) — рядом с рендерами */}
          {tab === 'ugc' && kits.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-700" style={{ color: 'var(--text-secondary)' }}>
                <LayoutTemplate size={15} /> Макеты:
              </span>
              {kits.map((k) => (
                <span key={k.id} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-xl"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                  <button type="button" onClick={() => navigate('/flow?open=ugc')} title="Открыть UGC-студию — макет применяется в шаге «Оформление»"
                    className="text-[13px] font-600" style={{ color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {k.name || 'Макет'}
                  </button>
                  <button type="button" onClick={() => void deleteKit(k)} title="Удалить макет"
                    className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:opacity-80"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Сетка карточек: первой — плитка «+ Добавить» (открывает блок раздела) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {renderAddTile(tab)}
            {filtered.map((v) => {
              const isSel = selected.has(v.id);
              return (
                <AuroraCard key={v.id}
                  className={`group p-0 overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-1 hover:shadow-lg${isSel ? ' ring-2 ring-[var(--brand)] ring-inset' : ''}`}>
                  <div className="relative w-full" style={{ aspectRatio: '9 / 16', background: 'var(--bg-tertiary)' }}>
                    {renderPreview(v)}
                    {/* Чекбокс выбора */}
                    <button type="button" onClick={() => toggleSelect(v.id)} title="Выбрать"
                      className="absolute top-2 left-2 w-7 h-7 rounded-md flex items-center justify-center z-20 transition-colors"
                      style={{ background: isSel ? 'var(--brand)' : 'rgba(0,0,0,0.45)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.7)' }}>
                      {isSel ? <Check size={15} /> : null}
                    </button>
                    {/* Просмотры (тренды) */}
                    {v.stats?.play != null && (
                      <span className="absolute bottom-2 left-2 text-[11px] font-700 inline-flex items-center gap-1 z-10"
                        style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                        <Eye size={12} /> {fmt(v.stats.play)}
                      </span>
                    )}
                    {/* Длительность */}
                    {dur(v.durationSec) && (
                      <span className="absolute bottom-2 right-2 text-[11px] px-1.5 py-0.5 rounded font-600 z-10"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{dur(v.durationSec)}</span>
                    )}
                    {/* Бейдж «Анализ» — у видео «Из анализа» с сохранённым разбором; клик → открыть разбор */}
                    {v.hasAnalysis && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); void openAnalysis(v); }}
                        title="Открыть сохранённый анализ этого видео"
                        className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 text-[10px] font-700 px-2 py-1 rounded-lg transition-transform hover:scale-105"
                        style={{ background: 'rgba(34,211,238,0.92)', color: '#083344', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
                        <Sparkles size={11} /> Анализ
                      </button>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div className="text-xs font-700 truncate" style={{ color: 'var(--text-primary)' }} title={v.title}>{v.title}</div>
                    {v.subtitle && <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{v.subtitle}</p>}
                    {v.stats && (
                      <div className="flex items-center gap-2.5 text-[11px] mt-auto" style={{ color: 'var(--text-muted)' }}>
                        <span className="inline-flex items-center gap-0.5"><Eye size={11} /> {fmt(v.stats.play)}</span>
                        <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(v.stats.like)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 pt-1">
                      {/* Открыть оригинал (тренды) или файл */}
                      <a href={v.webUrl || v.fileUrl} target="_blank" rel="noreferrer" title={v.webUrl ? 'Открыть оригинал' : 'Открыть файл'}
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {v.webUrl ? <ExternalLink size={14} /> : <Play size={14} />}
                      </a>
                      {/* → Google Flow (видео/картинки): отправить в Flow через расширение */}
                      {(v.mediaType === 'video' || v.mediaType === 'image') && (
                        <button type="button" onClick={() => sendToFlow(v)} title={v.mediaType === 'video' ? 'Скачать и загрузить в Google Flow (видео — вручную через «Загрузки»)' : 'Отправить картинку в Google Flow (Veo) через расширение'}
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
                          style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                          <Clapperboard size={14} />
                        </button>
                      )}
                      {/* Удалить */}
                      <button type="button" onClick={() => askDeleteOne(v)} disabled={busy} title="Удалить файл"
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80 disabled:opacity-40"
                        style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                        <Trash2 size={14} />
                      </button>
                      {/* Скачать на устройство */}
                      <button type="button" onClick={() => downloadOne(v)} title="Скачать на устройство"
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-auto transition-colors hover:opacity-90"
                        style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}>
                        <Download size={15} />
                      </button>
                    </div>
                  </div>
                </AuroraCard>
              );
            })}
          </div>

          {/* Пусто: подсказка под плиткой «+» */}
          {filtered.length === 0 && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              {tab === 'reference' ? 'Пока пусто. Всё, что произведёт TrendFlow, появится здесь; файлы можно загрузить кнопкой «Медиа».'
                : tab === 'audio' ? 'Пока пусто. Загрузите аудио плиткой «+» или кнопкой «Аудио».'
                : tab === 'hotebook' ? 'Пока пусто. Нажмите «+» — откроется блок «Hotebook»: аудио, видео, отчёты и другие артефакты попадут сюда.'
                : tab === 'flow' ? 'Пока пусто. Нажмите «+» — откроется блок «Google Flow» (Veo): готовые клипы попадут сюда.'
                : tab === 'ugc' ? 'Пока пусто. Нажмите «+» — откроется UGC-студия: собранные ролики и макеты появятся здесь.'
                : 'Пока пусто. Сохраняйте видео из «Аналитики» («Добавить в галерею») — они появятся здесь.'}
            </p>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />

      {/* Единый просмотрщик-редактор видео (плеер + обрезка) */}
      <VideoViewer
        open={!!viewer}
        url={viewer?.url || ''}
        title={viewer?.title}
        onClose={() => setViewer(null)}
        onSaved={() => { void load(); }}
      />

      {/* Просмотр сохранённого анализа видео (тот же разбор, что на вкладке «Аналитика») */}
      {analysis && (
        <div onClick={() => setAnalysis(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18 }}>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                <Sparkles size={16} style={{ color: '#22d3ee' }} /> Анализ · {analysis.title}
              </span>
              <button onClick={() => setAnalysis(null)} title="Закрыть" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            {analysisLoading ? (
              <div className="py-10 text-center"><Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
            ) : analysis.dna?.__error ? (
              <p className="text-sm py-6 text-center" style={{ color: '#ef4444' }}>{analysis.dna.__error}</p>
            ) : (
              <AnalysisView dna={analysis.dna} />
            )}
          </div>
        </div>
      )}

      {/* Тост-уведомление отправки в Flow */}
      {flowMsg && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 96, maxWidth: 360, padding: '10px 14px', borderRadius: 12, background: 'var(--bg-secondary)', border: `1px solid ${flowMsg.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, color: flowMsg.ok ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {flowMsg.text}
        </div>
      )}

      {/* Поп-ап «нужно расширение» — если расширение не установлено */}
      {extPopup && (
        <div onClick={() => setExtPopup(false)} style={{ position: 'fixed', inset: 0, zIndex: 97, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 470, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}><Clapperboard size={18} color="#fff" /></span>
              <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Нужно расширение Google Flow</span>
            </div>
            <p className="text-[13px] mb-3" style={{ color: 'var(--text-secondary)' }}>
              Чтобы отправлять медиа прямо в Google Flow, установите наше единое Chrome-расширение TrendTraffic (v{TT_EXT_VERSION}) — оно же работает и с NotebookLM. Один раз — дальше подключается автоматически.
            </p>
            <a href="/trendtraffic-extension.zip" download className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2.5 rounded-xl" style={{ background: '#6366f1', color: '#fff', textDecoration: 'none' }}>
              <Download size={15} /> Скачать расширение
            </a>
            <ol className="list-decimal ml-4 text-[12px] space-y-1 mt-3" style={{ color: 'var(--text-muted)' }}>
              <li>Распакуйте .zip в отдельную папку.</li>
              <li><code>chrome://extensions</code> → «Режим разработчика» → «Загрузить распакованное» → эта папка.</li>
              <li>Войдите в свой Google на <b>labs.google/flow</b>, вернитесь сюда и снова нажмите «→ Flow».</li>
            </ol>
            <div className="flex justify-end mt-3">
              <button onClick={() => setExtPopup(false)} className="text-[13px] font-600 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Видео → Flow: файл скачивается + инструкция залить вручную в «Загрузки» (Flow видео авто-вставкой не берёт) */}
      {videoPopup && (
        <div onClick={() => setVideoPopup(null)} style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}><Clapperboard size={18} color="#fff" /></span>
              <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Видео → Google Flow</span>
            </div>
            <p className="text-[13px] mb-1" style={{ color: '#10b981', fontWeight: 600 }}>✓ Видео скачивается на устройство.</p>
            <p className="text-[12.5px] mb-1" style={{ color: 'var(--text-secondary)' }}>
              Google Flow принимает видео только вручную — через раздел «Загрузки». Авто-вставку видео Flow не поддерживает (только картинки).
            </p>

            {/* Точная стрелка: скачано → Flow «Загрузки» */}
            <div className="flex items-center justify-center gap-2 my-3 p-3 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}><Download size={14} /> Скачано</span>
              <ArrowRight size={22} style={{ color: '#6366f1' }} />
              <span className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}><UploadCloud size={14} /> Flow → «Загрузки»</span>
            </div>

            <ol className="list-decimal ml-4 text-[12.5px] space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>Открой <b>Google Flow</b> (кнопка ниже).</li>
              <li>Слева выбери раздел <b>«Загрузки»</b>.</li>
              <li>Нажми <b>«Загрузить»</b> → выбери скачанный файл <b>«{videoPopup.title}»</b>.</li>
            </ol>

            <div className="flex items-center gap-2 mt-4">
              <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2.5 rounded-xl" style={{ background: '#6366f1', color: '#fff', textDecoration: 'none' }}>
                <ExternalLink size={15} /> Открыть Google Flow
              </a>
              <button onClick={() => downloadOne(videoPopup)} className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                <Download size={15} /> Скачать ещё раз
              </button>
              <button onClick={() => setVideoPopup(null)} className="text-[13px] font-600 px-3 py-2.5 rounded-xl ml-auto" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Форматированный разбор из сохранённой TrendDNA (Viral Breakdown + Video Content Analysis). */
function AnalysisView({ dna }: { dna: any }) {
  const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-3">
      <div className="text-[10px] font-700 tracking-wide mb-1" style={{ color: '#22d3ee' }}>{title}</div>
      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{children}</div>
    </div>
  );
  const Bul = ({ items }: { items: any }) => Array.isArray(items) && items.length ? (
    <ul className="space-y-0.5">{items.map((x: any, i: number) => <li key={i}>• {String(x)}</li>)}</ul>
  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const beats = Array.isArray(dna?.sceneBeats) ? dna.sceneBeats : [];
  const fmtT = (t: any) => (typeof t === 'number' ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '');
  return (
    <div>
      <div className="text-[11px] font-700 mb-2" style={{ color: 'var(--text-muted)' }}>ВИРАЛЬНЫЙ РАЗБОР</div>
      {dna?.hookType && <Sec title="ТИП ХУКА">{dna.hookType}</Sec>}
      {dna?.whyItWorks && <Sec title="ПОЧЕМУ РАБОТАЕТ">{dna.whyItWorks}</Sec>}
      {dna?.targetAudience && <Sec title="ЦЕЛЕВАЯ АУДИТОРИЯ">{dna.targetAudience}</Sec>}
      {dna?.viralFactors && <Sec title="ФАКТОРЫ ВИРАЛЬНОСТИ"><Bul items={dna.viralFactors} /></Sec>}
      {dna?.copyReadyScript && <Sec title="ГОТОВЫЙ СЦЕНАРИЙ"><div className="p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', whiteSpace: 'pre-wrap' }}>{dna.copyReadyScript}</div></Sec>}
      {dna?.howToAdapt && <Sec title="КАК АДАПТИРОВАТЬ"><Bul items={dna.howToAdapt} /></Sec>}
      <div className="text-[11px] font-700 mb-2 mt-4" style={{ color: 'var(--text-muted)' }}>АНАЛИЗ СОДЕРЖАНИЯ</div>
      {dna?.summary && <Sec title="КРАТКОЕ ОПИСАНИЕ">{dna.summary}</Sec>}
      {beats.length > 0 && <Sec title="СЦЕНЫ (ТАЙМИНГ)"><ul className="space-y-0.5">{beats.map((b: any, i: number) => <li key={i}><span style={{ color: '#22d3ee' }}>{fmtT(b?.t)}</span> {b?.desc}{b?.intensity ? ` [${b.intensity}]` : ''}</li>)}</ul></Sec>}
      {dna?.hookAnalysis && <Sec title="РАЗБОР ХУКА">{dna.hookAnalysis}</Sec>}
      {dna?.visualStyle && <Sec title="ВИЗУАЛЬНЫЙ СТИЛЬ">{dna.visualStyle}</Sec>}
      {dna?.audioDialogue && <Sec title="АУДИО / ДИАЛОГ">{dna.audioDialogue}</Sec>}
      {dna?.whyResonates && <Sec title="ПОЧЕМУ ЗАХОДИТ"><Bul items={dna.whyResonates} /></Sec>}
      {dna?.howToReplicate && <Sec title="КАК ПОВТОРИТЬ"><Bul items={dna.howToReplicate} /></Sec>}
      {Array.isArray(dna?.keywords) && dna.keywords.length > 0 && <Sec title="КЛЮЧЕВЫЕ СЛОВА">{dna.keywords.join(', ')}</Sec>}
    </div>
  );
}
