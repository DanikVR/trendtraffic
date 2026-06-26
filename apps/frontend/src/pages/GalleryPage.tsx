/**
 * GalleryPage — галерея скачанных видео (TrendTraffic).
 *
 * Показывает source_videos со статусом 'downloaded' (файл на диске, /uploads/...).
 * Возможности: поиск, проигрывание, удаление одного и массовое удаление.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image, Search, Loader2, Trash2, ExternalLink, CheckSquare, Square, Check, Eye, Heart, RefreshCw,
} from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAppStore } from '../store/useAppStore';

interface GalleryVideo {
  id: string;
  externalId: string;
  author: string;
  authorName?: string;
  description?: string;
  coverUrl?: string;
  webUrl?: string;
  durationSec?: number;
  stats: { play?: number; like?: number; comment?: number; share?: number };
  fileUrl?: string | null;
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
  const [videos, setVideos] = useState<GalleryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/trends/videos?downloaded=1&limit=200', { headers: headers() });
      if (res.ok) { const d = await res.json(); setVideos(d.videos || []); }
    } catch (e: any) { setError(e?.message || 'Ошибка загрузки'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) =>
      v.author.toLowerCase().includes(q) ||
      (v.authorName || '').toLowerCase().includes(q) ||
      (v.description || '').toLowerCase().includes(q)
    );
  }, [videos, query]);

  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const visibleIds = filtered.map((v) => v.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds));

  const doDeleteOne = async (id: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/trends/videos/${id}`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setVideos((prev) => prev.filter((v) => v.id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e: any) { setError(e?.message || 'Не удалось удалить'); }
    finally { setBusy(false); }
  };

  const doDeleteSelected = async () => {
    const ids = visibleIds.filter((id) => selected.has(id));
    if (ids.length === 0) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/trends/videos/delete-bulk', {
        method: 'POST', headers: headers(), body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const idset = new Set(ids);
      setVideos((prev) => prev.filter((v) => !idset.has(v.id)));
      setSelected(new Set());
    } catch (e: any) { setError(e?.message || 'Не удалось удалить'); }
    finally { setBusy(false); }
  };

  const askDeleteOne = (v: GalleryVideo) => setConfirm({
    title: 'Удалить видео?',
    message: `@${v.author} — файл будет удалён с диска безвозвратно.`,
    onConfirm: () => { setConfirm(null); doDeleteOne(v.id); },
  });
  const askDeleteSelected = () => setConfirm({
    title: `Удалить выбранные (${selected.size})?`,
    message: 'Все выбранные файлы будут удалены с диска безвозвратно.',
    onConfirm: () => { setConfirm(null); doDeleteSelected(); },
  });

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
          <Image size={20} color="#fff" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-700" style={{ color: 'var(--text-primary)' }}>Галерея</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Скачанные видео ({videos.length}). Хранятся на сервере в <code>uploads/source-videos</code>.</p>
        </div>
        <AuroraButton variant="secondary" onClick={load} disabled={loading} icon={<RefreshCw size={16} className={loading ? 'animate-spin' : ''} />}>Обновить</AuroraButton>
      </div>

      {/* Toolbar: search + select all + delete selected */}
      <AuroraCard className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по автору или описанию..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
        </div>
        <button type="button" onClick={toggleSelectAll} disabled={filtered.length === 0}
          className="inline-flex items-center justify-center gap-2 text-sm font-600 px-3 py-2.5 rounded-xl disabled:opacity-50"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          {allSelected ? <CheckSquare size={16} color="#10b981" /> : <Square size={16} />}
          {allSelected ? 'Снять' : 'Выбрать всё'} ({selected.size})
        </button>
        <AuroraButton variant="secondary" onClick={askDeleteSelected} disabled={busy || selected.size === 0}
          icon={busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}>
          Удалить выбранные ({selected.size})
        </AuroraButton>
      </AuroraCard>

      {error && (
        <div className="flex items-start gap-2 text-sm" style={{ color: '#ef4444' }}><Trash2 size={16} className="mt-[2px]" /><span>{error}</span></div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
      ) : filtered.length === 0 ? (
        <AuroraCard className="p-10 text-center">
          <Image size={28} className="inline-block mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {videos.length === 0 ? 'Пока пусто. Скачайте видео на странице «Тренды».' : 'Ничего не найдено по запросу.'}
          </p>
        </AuroraCard>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((v) => (
            <AuroraCard key={v.id} className="p-0 overflow-hidden flex flex-col">
              <div className="relative aspect-[9/16] w-full" style={{ background: '#000' }}>
                {v.fileUrl ? (
                  <video src={v.fileUrl} poster={v.coverUrl || undefined} controls preload="none"
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Image size={28} style={{ color: 'var(--text-muted)' }} /></div>
                )}
                <button type="button" onClick={() => toggleSelect(v.id)} title="Выбрать"
                  className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center z-20 transition-colors"
                  style={{ background: selected.has(v.id) ? '#10b981' : 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.6)' }}>
                  {selected.has(v.id) ? <Check size={14} /> : null}
                </button>
                {dur(v.durationSec) && (
                  <span className="absolute bottom-1.5 right-1.5 text-[11px] px-1.5 py-0.5 rounded font-600 z-10"
                    style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>{dur(v.durationSec)}</span>
                )}
              </div>
              <div className="p-3 flex flex-col gap-2 flex-1">
                <div className="text-xs font-700 truncate" style={{ color: 'var(--text-primary)' }} title={v.authorName || v.author}>@{v.author}</div>
                {v.description && <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{v.description}</p>}
                <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-0.5"><Eye size={11} /> {fmt(v.stats.play)}</span>
                  <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(v.stats.like)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  {v.webUrl && (
                    <a href={v.webUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1 text-[11px] font-600 px-2 py-2 rounded-lg flex-1 transition-colors hover:opacity-80"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                      <ExternalLink size={12} /> TikTok
                    </a>
                  )}
                  <button type="button" onClick={() => askDeleteOne(v)} disabled={busy} title="Удалить"
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </AuroraCard>
          ))}
        </div>
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
