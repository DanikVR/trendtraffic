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
import {
  Image as ImageIcon, Video, Music, Search, Loader2, Trash2, ExternalLink,
  CheckSquare, Square, Check, Eye, Heart, RefreshCw, UploadCloud, FileText, Sparkles,
  Download, Play,
} from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAppStore } from '../store/useAppStore';

type Tab = 'trends' | 'reference' | 'audio' | 'analyzed';

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
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'trends', label: 'Тренды' },
  { key: 'reference', label: 'Референс' },
  { key: 'audio', label: 'Аудио' },
  { key: 'analyzed', label: 'Из анализа' },
];

function tabIcon(key: Tab, size = 15) {
  if (key === 'trends') return <Video size={size} />;
  if (key === 'reference') return <ImageIcon size={size} />;
  if (key === 'audio') return <Music size={size} />;
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

export default function GalleryPage() {
  const { token } = useAppStore();
  const [tab, setTab] = useState<Tab>('trends');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

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
      } else {
        // 'analyzed' → папка «Из анализа» (folder=analyzed, любой kind); иначе по kind.
        const qsMedia = which === 'analyzed' ? 'folder=analyzed' : `kind=${which}`;
        const res = await fetch(`/api/trends/media?${qsMedia}`, { headers: jsonHeaders() });
        if (res.ok) {
          const d = await res.json();
          setItems((d.assets || []).map((a: any): GalleryItem => ({
            id: a.id, mediaType: a.mediaType, fileUrl: a.fileUrl,
            title: a.originalName || 'файл', isTrend: false,
          })));
        }
      }
    } catch (e: any) { setError(e?.message || 'Ошибка загрузки'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab]);

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
      <video src={v.coverUrl ? v.fileUrl : `${v.fileUrl}#t=0.1`} poster={v.coverUrl || undefined} controls preload="metadata" className="w-full h-full object-cover" />
    );
    if (v.mediaType === 'image') return <img src={v.fileUrl} alt={v.title} loading="lazy" className="w-full h-full object-cover" />;
    if (v.mediaType === 'audio') return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-3" style={{ background: 'var(--bg-tertiary)' }}>
        <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)' }}><Music size={26} /></span>
        <audio src={v.fileUrl} controls className="w-full" />
      </div>
    );
    return <div className="w-full h-full flex items-center justify-center"><FileText size={28} style={{ color: 'var(--text-muted)' }} /></div>;
  };

  return (
    <div className="max-w-6xl mx-auto py-5 sm:py-6 px-3 sm:px-4 space-y-4">
      {/* Header: иконка + заголовок + загрузка + обновить */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
          <ImageIcon size={20} color="#fff" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-700 leading-tight" style={{ color: 'var(--text-primary)' }}>Галерея</h1>
          <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--text-muted)' }}>Медиа-библиотека: тренды, референсы, аудио и сохранённое из анализа.</p>
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
      <div className="grid grid-cols-2 sm:inline-grid sm:auto-cols-max sm:grid-flow-col gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
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
      ) : filtered.length === 0 ? (
        <AuroraCard className="p-10 sm:p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
            {tabIcon(tab, 26)}
          </div>
          <p className="text-sm font-600" style={{ color: 'var(--text-secondary)' }}>Пока пусто</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {tab === 'trends' ? 'Скачайте видео на странице «Тренды».'
              : tab === 'reference' ? 'Загрузите изображения/видео кнопкой «Медиа».'
              : tab === 'audio' ? 'Загрузите аудио кнопкой «Аудио».'
              : 'Сохраняйте видео из «Аналитики» (вкладка «Тренды» → «Добавить в галерею») — они появятся здесь.'}
          </p>
        </AuroraCard>
      ) : (
        <>
          {/* Тулбар результатов */}
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

          {/* Сетка карточек */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
    </div>
  );
}
