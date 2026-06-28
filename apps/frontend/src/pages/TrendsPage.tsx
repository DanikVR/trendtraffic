/**
 * TrendsPage — анализатор трендов (TikHub).
 *
 * Поиск по ключевому слову или выдача трендов → грид найденных видео со
 * статистикой → скачивание исходника на диск. Данные с /api/trends/*.
 */

import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Search, Loader2, Download, ExternalLink, CheckCircle2, XCircle, AlertCircle,
  Eye, Heart, MessageCircle, Share2, Play, CheckSquare, Square, Check, BarChart3,
} from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { useAppStore } from '../store/useAppStore';
import TrendAnalyticsPanel from './TrendAnalyticsPanel';

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
  const [view, setView] = useState<'trends' | 'analytics'>('trends');
  const [analyzeUrl, setAnalyzeUrl] = useState<string | null>(null);
  const [analyzeCover, setAnalyzeCover] = useState<string | null>(null);
  const openAnalytics = (videoUrl: string, cover?: string | null) => { setAnalyzeUrl(videoUrl); setAnalyzeCover(cover || null); setView('analytics'); };
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
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);

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
        setNotice(`Trend ответил, но видео не распознаны. Ключи ответа: [${(data.rawKeys || []).join(', ')}]. Пришлите это — доуточню разбор.${fb}`);
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

  // Массовый анализ выбранных → таблица-сравнение в CSV.
  const analyzeSelected = async () => {
    const urls = videos.filter((v) => v.id && selected.has(v.id) && v.webUrl).map((v) => v.webUrl as string);
    if (urls.length === 0) return;
    setBulkAnalyzing(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/trends/analyze/bulk', {
        method: 'POST', headers: headers(), body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const rows: any[] = data.rows || [];
      const head = ['url', 'platform', 'author', 'views', 'likes', 'comments', 'shares', 'engagementRate', 'error'];
      const csv = '﻿' + [head.join(','), ...rows.map((r) => {
        const s = r.summary || {};
        return [r.url, r.platform || '', s.author || '', s.views ?? '', s.likes ?? '', s.comments ?? '', s.shares ?? '', s.engagementRate ?? '', r.error || '']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
      })].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `trends-analytics-${rows.length}.csv`; a.click();
      URL.revokeObjectURL(a.href);
      setNotice(`Проанализировано: ${rows.length}. Таблица-сравнение скачана (CSV).`);
    } catch (e: any) { setError(friendlyError(e, 'Ошибка массового анализа')); }
    finally { setBulkAnalyzing(false); }
  };

  const selectedCount = videos.filter((v) => v.id && selected.has(v.id) && !v.fileUrl).length;

  return (
    <div className="max-w-6xl mx-auto py-5 sm:py-6 px-3 sm:px-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
          <TrendingUp size={20} color="#fff" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-700 leading-tight" style={{ color: 'var(--text-primary)' }}>Тренды</h1>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>Поиск горячих видео + аналитика по любой публичной ссылке.</p>
        </div>
      </div>

      {/* Переключатель: поиск трендов / аналитика по ссылке */}
      <div className="grid grid-cols-2 sm:inline-grid sm:auto-cols-max sm:grid-flow-col gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
        {([['trends', '🔎 Поиск трендов'], ['analytics', '📊 Аналитика по ссылке']] as [typeof view, string][]).map(([v, lbl]) => (
          <button key={v} onClick={() => setView(v)}
            className="px-4 py-2 rounded-lg text-sm font-600 transition-all whitespace-nowrap"
            style={{ background: view === v ? 'var(--bg-secondary)' : 'transparent', color: view === v ? '#ff7300' : 'var(--text-muted)', boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.12)' : 'none' }}>
            {lbl}
          </button>
        ))}
      </div>

      {view === 'analytics' ? (
        <TrendAnalyticsPanel token={token} initialUrl={analyzeUrl} initialCover={analyzeCover} />
      ) : (
      <>
      {/* Search card */}
      <AuroraCard className="p-4 sm:p-5 space-y-4">
        {/* Сегмент-контрол: что ищем */}
        <div className="grid grid-cols-2 sm:inline-grid sm:auto-cols-max sm:grid-flow-col gap-1 p-1 rounded-xl"
             style={{ background: 'var(--bg-tertiary)' }}>
          {(['keyword', 'trending'] as Kind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className="px-4 py-2 rounded-lg text-sm font-600 transition-all whitespace-nowrap"
              style={{
                background: kind === k ? 'var(--bg-secondary)' : 'transparent',
                color: kind === k ? '#ff7300' : 'var(--text-muted)',
                boxShadow: kind === k ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}>
              {k === 'keyword' ? '🔍 По ключевику' : '🔥 Горячее'}
            </button>
          ))}
        </div>

        {/* Главная строка: поиск + кнопка */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {kind === 'keyword' && (
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
                placeholder="например: morning routine, рецепт, gym…"
                className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7300]/40 transition-shadow"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
          <AuroraButton onClick={handleScan} disabled={scanning} fullWidth
            className="sm:!w-auto"
            icon={scanning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {scanning ? 'Сканирую…' : 'Сканировать'}
          </AuroraButton>
        </div>

        {/* Параметры: количество + (для ключевика) тип / сортировка / период */}
        <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
          {/* Количество */}
          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Сколько видео
            <div className="flex items-center gap-1.5">
              {[10, 20, 30].map((n) => (
                <button key={n} type="button" onClick={() => setCount(n)}
                  className="w-10 h-10 rounded-lg text-sm font-700 transition-colors"
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
                className="w-14 h-10 px-2 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#ff7300]/40"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
            </div>
          </label>

          {kind === 'keyword' && (
            <label className="flex flex-col gap-1 text-[11px] flex-1 min-w-[150px]" style={{ color: 'var(--text-muted)' }}>
              Тип поиска
              <select value={mode} onChange={(e) => setMode(e.target.value as any)}
                className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7300]/40"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                <option value="app">Умный поиск</option>
                <option value="video">Поиск по слову</option>
                <option value="general">Около-тематика</option>
              </select>
            </label>
          )}
          {kind === 'keyword' && mode === 'app' && (
            <>
              <label className="flex flex-col gap-1 text-[11px] flex-1 min-w-[140px]" style={{ color: 'var(--text-muted)' }}>
                Сортировка
                <select value={sortType} onChange={(e) => setSortType(Number(e.target.value) as any)}
                  className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7300]/40"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                  <option value={0}>По релевантности</option>
                  <option value={1}>Больше лайков</option>
                  <option value={2}>Новее</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] flex-1 min-w-[130px]" style={{ color: 'var(--text-muted)' }}>
                Период
                <select value={publishTime} onChange={(e) => setPublishTime(Number(e.target.value) as any)}
                  className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7300]/40"
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
        </div>

        {/* Сворачиваемая подсказка по типам поиска */}
        {kind === 'keyword' && (
          <details className="group/help text-[12px]">
            <summary className="inline-flex items-center gap-1.5 cursor-pointer select-none font-600 list-none"
                     style={{ color: 'var(--text-muted)' }}>
              <AlertCircle size={13} /> Чем отличаются типы поиска?
            </summary>
            <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text-secondary)' }}>Умный поиск</b> — по теме, устойчив к опечаткам
              («wordpres» → WordPress), с фильтрами «Период»/«Сортировка» и прямыми ссылками для скачивания
              <i> (рекомендуется)</i>. <b style={{ color: 'var(--text-secondary)' }}>Поиск по слову</b> и{' '}
              <b style={{ color: 'var(--text-secondary)' }}>Около-тематика</b> — Web-выдача без фильтров,
              шире охват, но иногда нестабильна.
            </p>
          </details>
        )}

        {notice && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={16} className="mt-[2px] flex-shrink-0" style={{ color: '#10b981' }} /><span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <XCircle size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
          </div>
        )}
      </AuroraCard>

      {/* Results */}
      {videos.length === 0 ? (
        <AuroraCard className="p-10 sm:p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
               style={{ background: 'var(--bg-tertiary)' }}>
            <TrendingUp size={26} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-sm font-600" style={{ color: 'var(--text-secondary)' }}>Пока пусто</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Введите ключевик (или выберите «Горячее») и нажмите «Сканировать».
          </p>
        </AuroraCard>
      ) : (
        <>
          {/* Тулбар: счётчик + выбрать всё + скачать выбранные */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                Найдено: {videos.length}
              </span>
              <button type="button" onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {allSelected ? <CheckSquare size={15} color="#ff7300" /> : <Square size={15} />}
                {allSelected ? 'Снять выделение' : 'Выбрать всё'}{selected.size > 0 ? ` · ${selected.size}` : ''}
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <AuroraButton variant="secondary" onClick={analyzeSelected} disabled={bulkAnalyzing || selected.size === 0}
                icon={bulkAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}>
                {bulkAnalyzing ? 'Анализирую…' : `Анализировать выбранные${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </AuroraButton>
              <AuroraButton onClick={downloadSelected} disabled={bulkDownloading || selectedCount === 0}
                icon={bulkDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}>
                {bulkDownloading ? 'Скачиваю…' : `Скачать выбранные${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
              </AuroraButton>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {videos.map((v) => {
            const isSel = !!(v.id && selected.has(v.id));
            return (
            <AuroraCard key={v.id || v.externalId}
              className={`group p-0 overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-1 hover:shadow-lg${isSel ? ' ring-2 ring-[#ff7300] ring-inset' : ''}`}>
              {/* Cover */}
              <div className="relative aspect-[9/16] w-full" style={{ background: 'var(--bg-tertiary)' }}>
                {v.coverUrl ? (
                  <img src={v.coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Play size={28} style={{ color: 'var(--text-muted)' }} /></div>
                )}
                {/* нижний скрим — для читаемости просмотров/длительности на ярких обложках */}
                <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
                     style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
                {/* play-оверлей при наведении */}
                {v.webUrl && (
                  <a href={v.webUrl} target="_blank" rel="noreferrer"
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.28)' }} title="Открыть в TikTok">
                    <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(4px)' }}>
                      <Play size={24} color="#fff" fill="#fff" />
                    </span>
                  </a>
                )}
                {/* просмотры — главный «трендовый» метрик, слева снизу */}
                <span className="absolute bottom-2 left-2 text-[11px] px-1.5 py-0.5 rounded-md font-700 inline-flex items-center gap-1 z-10"
                  style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                  <Eye size={12} /> {fmt(v.stats.play)}
                </span>
                {dur(v.durationSec) && (
                  <span className="absolute bottom-2 right-2 text-[11px] px-1.5 py-0.5 rounded font-600 z-10"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{dur(v.durationSec)}</span>
                )}
                {/* чекбокс выбора (для пакетной загрузки) */}
                {v.id && (
                  <button type="button" onClick={() => toggleSelect(v.id)} title="Выбрать"
                    className="absolute top-2 left-2 w-7 h-7 rounded-md flex items-center justify-center z-20 transition-colors"
                    style={{ background: isSel ? '#ff7300' : 'rgba(0,0,0,0.45)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.7)' }}>
                    {isSel ? <Check size={15} /> : null}
                  </button>
                )}
                {v.status === 'downloaded' && (
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-700 inline-flex items-center gap-1 z-20"
                    style={{ background: 'rgba(16,185,129,0.92)', color: '#fff' }}><CheckCircle2 size={11} /> скачано</span>
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
                <div className="flex items-center gap-2.5 text-[11px] flex-wrap mt-auto" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(v.stats.like)}</span>
                  <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} /> {fmt(v.stats.comment)}</span>
                  <span className="inline-flex items-center gap-0.5"><Share2 size={11} /> {fmt(v.stats.share)}</span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {v.webUrl && (
                    <button type="button" onClick={() => openAnalytics(v.webUrl!, v.coverUrl)} title="Открыть в Аналитике и проанализировать"
                      className="inline-flex items-center justify-center gap-1 text-[11px] font-700 px-2 py-2 rounded-lg flex-1 transition-colors hover:opacity-80"
                      style={{ background: 'rgba(255,115,0,0.12)', color: '#ff7300', border: '1px solid rgba(255,115,0,0.3)' }}>
                      <BarChart3 size={12} /> Аналитика
                    </button>
                  )}
                  {v.webUrl && (
                    <a href={v.webUrl} target="_blank" rel="noreferrer" title="Открыть в TikTok"
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                      <ExternalLink size={14} />
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
            );
          })}
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
