/**
 * TrendsPage — анализатор трендов (TikHub).
 *
 * Поиск по ключевому слову или выдача трендов → грид найденных видео со
 * статистикой → скачивание исходника на диск. Данные с /api/trends/*.
 */

import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Search, Loader2, Download, ExternalLink, CheckCircle2, XCircle, AlertCircle,
  Eye, Heart, MessageCircle, Share2, Play, CheckSquare, Square, Check,
} from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { useAppStore } from '../store/useAppStore';

type Kind = 'keyword' | 'trending';

interface StoredVideo {
  id: string | null;
  externalId: string;
  platform: string;
  author: string;
  authorName?: string;
  description?: string;
  coverUrl?: string;
  videoUrl?: string;
  webUrl?: string;
  durationSec?: number;
  stats: { play?: number; like?: number; comment?: number; share?: number };
  status: string;
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

/**
 * Превращает «Failed to fetch» (TypeError при недоступном сервере) в понятное
 * сообщение. Это НЕ ошибка TikHub: значит не отвечает backend (:3001) или
 * dev-сервер фронта (:3000). Частая причина — dev-сервер остановился, а вкладка
 * осталась открытой со старой загрузки.
 */
function friendlyError(e: any, fallback: string): string {
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed|err_connection/i.test(msg)) {
    return 'Сервер недоступен (нет связи с API). Проверьте, что запущены backend (apps/backend → npm run dev, порт 3001) и dev-сервер фронта (порт 3000), затем обновите страницу.';
  }
  return msg || fallback;
}

export default function TrendsPage() {
  const { token } = useAppStore();
  const [kind, setKind] = useState<Kind>('keyword');
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<'video' | 'general' | 'app'>('app');
  const [sortType, setSortType] = useState<0 | 1 | 2>(0);
  const [publishTime, setPublishTime] = useState<0 | 1 | 7 | 30 | 90 | 180>(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [videos, setVideos] = useState<StoredVideo[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/trends/videos?limit=60', { headers: headers() });
        if (res.ok) { const d = await res.json(); setVideos(d.videos || []); }
      } catch { /* тихо */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScan = async () => {
    if (kind === 'keyword' && !query.trim()) { setError('Введите ключевое слово'); return; }
    setScanning(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/trends/scan', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ kind, query: query.trim(), count, mode, sortType, publishTime }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setVideos(data.videos || []);
      const fb = data.fellBackToApp ? ' Режим «Поиск по слову/Около-тематика» был нестабилен — поиск автоматически выполнен «Умным поиском».' : '';
      if ((data.count ?? 0) === 0) {
        setNotice(`TikHub ответил, но видео не распознаны. Ключи ответа: [${(data.rawKeys || []).join(', ')}]. Пришлите это — доуточню разбор.${fb}`);
      } else {
        setNotice(`Найдено видео: ${data.count}.${fb}`);
      }
    } catch (e: any) { setError(friendlyError(e, 'Ошибка сканирования')); }
    finally { setScanning(false); }
  };

  const handleDownload = async (v: StoredVideo) => {
    if (!v.id) { setError('Видео не сохранено в БД — повторите скан.'); return; }
    setDownloadingId(v.id); setError(null);
    try {
      const res = await fetch(`/api/trends/videos/${v.id}/download`, { method: 'POST', headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'downloaded', fileUrl: data.fileUrl } : x));
    } catch (e: any) {
      setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'failed' } : x));
      setError(friendlyError(e, 'Не удалось скачать'));
    } finally { setDownloadingId(null); }
  };

  // ── Выбор и пакетная загрузка ──
  const toggleSelect = (id: string | null) => {
    if (!id) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectableIds = videos.filter((v) => v.id).map((v) => v.id as string);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds));

  const downloadSelected = async () => {
    const targets = videos.filter((v) => v.id && selected.has(v.id) && !v.fileUrl);
    if (targets.length === 0) return;
    setBulkDownloading(true);
    for (const v of targets) {
      // eslint-disable-next-line no-await-in-loop
      await handleDownload(v); // последовательно — мягче к CDN и виден прогресс
    }
    setBulkDownloading(false);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
          <TrendingUp size={20} color="#fff" />
        </div>
        <div>
          <h1 className="text-2xl font-700" style={{ color: 'var(--text-primary)' }}>Тренды</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Сканирование TikTok-трендов: поиск по ключевику или горячая выдача, затем скачивание исходников.</p>
        </div>
      </div>

      {/* Search card */}
      <AuroraCard className="p-5 space-y-4">
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-tertiary)' }}>
          {(['keyword', 'trending'] as Kind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className="px-3 py-1.5 rounded-lg text-sm font-600 transition-colors"
              style={{ background: kind === k ? 'var(--btn-primary-bg)' : 'transparent', color: kind === k ? '#ff7300' : 'var(--text-muted)' }}>
              {k === 'keyword' ? 'По ключевику' : 'Тренды'}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {kind === 'keyword' && (
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
                placeholder="например: morning routine, gym, recipe..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm focus:outline-none"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Кол-во</span>
            {[1, 5, 10].map((n) => (
              <button key={n} type="button" onClick={() => setCount(n)}
                className="w-9 h-9 rounded-lg text-sm font-700 transition-colors"
                style={{
                  background: count === n ? 'var(--btn-primary-bg)' : 'var(--bg-tertiary)',
                  color: count === n ? '#ff7300' : 'var(--text-muted)',
                  border: `1px solid ${count === n ? '#ff7300' : 'var(--border-medium)'}`,
                }}>
                {n}
              </button>
            ))}
            <input type="number" min={1} max={30} value={count}
              onChange={(e) => setCount(Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              title="Своё количество (1–30)"
              className="w-16 px-2 py-2 rounded-lg text-sm text-center focus:outline-none"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </div>
          <AuroraButton onClick={handleScan} disabled={scanning} icon={scanning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {scanning ? 'Сканирую...' : 'Сканировать'}
          </AuroraButton>
        </div>

        {/* Параметры поиска (для режима «По ключевику») */}
        {kind === 'keyword' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Тип поиска
              <select value={mode} onChange={(e) => setMode(e.target.value as any)}
                className="px-3 py-2 rounded-xl text-sm focus:outline-none"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                <option value="app">Умный поиск</option>
                <option value="video">Поиск по слову</option>
                <option value="general">Около-тематика</option>
              </select>
            </label>
            {mode === 'app' && (
              <>
                <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Сортировка
                  <select value={sortType} onChange={(e) => setSortType(Number(e.target.value) as any)}
                    className="px-3 py-2 rounded-xl text-sm focus:outline-none"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                    <option value={0}>По релевантности</option>
                    <option value={1}>Больше лайков</option>
                    <option value={2}>Новее</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Период
                  <select value={publishTime} onChange={(e) => setPublishTime(Number(e.target.value) as any)}
                    className="px-3 py-2 rounded-xl text-sm focus:outline-none"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                    <option value={0}>Всё время</option>
                    <option value={1}>24 часа</option>
                    <option value={7}>Неделя</option>
                    <option value={30}>Месяц</option>
                    <option value={90}>3 месяца</option>
                    <option value={180}>6 месяцев</option>
                  </select>
                </label>
              </>
            )}
            <p className="text-[11px] flex-1 min-w-[180px]" style={{ color: 'var(--text-muted)' }}>
              <b>Умный поиск</b> — по теме, устойчив к опечаткам (напр. «wordpres» → WordPress), с периодом и прямыми ссылками для скачивания (рекомендуется). «Новее»/«Больше лайков» сортируют найденное. <b>Поиск по слову</b> / <b>Около-тематика</b> — Web API без фильтров (бывает нестабилен).
            </p>
          </div>
        )}

        {notice && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{notice}</p>}
        {error && (
          <div className="flex items-start gap-2 text-sm" style={{ color: '#ef4444' }}><XCircle size={16} className="mt-[2px]" /><span>{error}</span></div>
        )}
      </AuroraCard>

      {/* Results grid */}
      {videos.length === 0 ? (
        <AuroraCard className="p-10 text-center">
          <TrendingUp size={28} className="inline-block mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Пока пусто. Введите ключевик и нажмите «Сканировать».</p>
        </AuroraCard>
      ) : (
        <>
          {/* Тулбар: выбрать всё + скачать выбранные одной кнопкой */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button type="button" onClick={toggleSelectAll}
              className="inline-flex items-center gap-2 text-sm font-600 px-3 py-2 rounded-xl transition-colors"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {allSelected ? <CheckSquare size={16} color="#ff7300" /> : <Square size={16} />}
              {allSelected ? 'Снять выделение' : 'Выбрать всё'} ({selected.size})
            </button>
            <AuroraButton onClick={downloadSelected} disabled={bulkDownloading || selected.size === 0}
              icon={bulkDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}>
              {bulkDownloading ? 'Скачиваю выбранные…' : `Скачать выбранные (${selected.size})`}
            </AuroraButton>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v) => (
            <AuroraCard key={v.id || v.externalId} className="group p-0 overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5">
              {/* Cover */}
              <div className="relative aspect-[9/16] w-full" style={{ background: 'var(--bg-tertiary)' }}>
                {v.coverUrl ? (
                  <img src={v.coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Play size={28} style={{ color: 'var(--text-muted)' }} /></div>
                )}
                {/* play-оверлей при наведении */}
                {v.webUrl && (
                  <a href={v.webUrl} target="_blank" rel="noreferrer"
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.28)' }} title="Открыть в TikTok">
                    <Play size={30} color="#fff" fill="#fff" />
                  </a>
                )}
                {dur(v.durationSec) && (
                  <span className="absolute bottom-1.5 right-1.5 text-[11px] px-1.5 py-0.5 rounded font-600"
                    style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>{dur(v.durationSec)}</span>
                )}
                {/* чекбокс выбора (для пакетной загрузки) */}
                {v.id && (
                  <button type="button" onClick={() => toggleSelect(v.id)} title="Выбрать"
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center z-20 transition-colors"
                    style={{ background: selected.has(v.id) ? '#ff7300' : 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.6)' }}>
                    {selected.has(v.id) ? <Check size={14} /> : null}
                  </button>
                )}
                {v.status === 'downloaded' && (
                  <span className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded font-700 inline-flex items-center gap-1 z-20"
                    style={{ background: 'rgba(16,185,129,0.9)', color: '#fff' }}><CheckCircle2 size={11} /> скачано</span>
                )}
              </div>
              {/* Body */}
              <div className="p-3 flex flex-col gap-2 flex-1">
                <div className="text-xs font-700 truncate" style={{ color: 'var(--text-primary)' }} title={v.authorName || v.author}>
                  @{v.author}
                </div>
                {v.description && (
                  <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{v.description}</p>
                )}
                <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-0.5"><Eye size={11} /> {fmt(v.stats.play)}</span>
                  <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(v.stats.like)}</span>
                  <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} /> {fmt(v.stats.comment)}</span>
                  <span className="inline-flex items-center gap-0.5"><Share2 size={11} /> {fmt(v.stats.share)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  {v.webUrl && (
                    <a href={v.webUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1 text-[11px] font-600 px-2 py-2 rounded-lg flex-1 transition-colors hover:opacity-80"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                      <ExternalLink size={12} /> TikTok
                    </a>
                  )}
                  {/* Загрузка — ТОЛЬКО по клику на иконку. Зелёная галка = уже скачано. */}
                  {v.fileUrl ? (
                    <a href={v.fileUrl} target="_blank" rel="noreferrer" title="Скачано — открыть файл"
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                      <CheckCircle2 size={16} />
                    </a>
                  ) : (
                    <button type="button" onClick={() => handleDownload(v)}
                      disabled={!v.id || downloadingId === v.id}
                      title={!v.id ? 'Видео не сохранено в БД' : v.status === 'failed' ? 'Ошибка скачивания — нажмите, чтобы повторить' : 'Загрузить видео на диск'}
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40"
                      style={{
                        background: v.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'var(--btn-primary-bg)',
                        color: v.status === 'failed' ? '#ef4444' : '#ff7300',
                      }}>
                      {(v.id && downloadingId === v.id) ? <Loader2 size={15} className="animate-spin" />
                        : v.status === 'failed' ? <AlertCircle size={15} />
                        : <Download size={15} />}
                    </button>
                  )}
                </div>
              </div>
            </AuroraCard>
          ))}
          </div>
        </>
      )}
    </div>
  );
}
