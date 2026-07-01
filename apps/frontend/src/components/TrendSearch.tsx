/**
 * TrendSearch — переиспользуемый блок «Поиск горячих видео» (TikHub).
 *
 * Выделен из TrendsPage, чтобы один и тот же поиск трендов работал и на странице
 * «Тренды» (анализ через TrendAnalyticsPanel), и во вкладке «Social Media Extension»
 * (анализ через рехостнутое расширение в iframe). Сам поиск/скачивание — через
 * /api/trends/*; что делать с «Аналитикой» — решает родитель через колбэки
 * onAnalyze / onAnalyzeBulk.
 */

import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Search, Loader2, Download, ExternalLink, CheckCircle2, XCircle, AlertCircle,
  Eye, Heart, MessageCircle, Share2, Play, CheckSquare, Square, Check, BarChart3, Trash2, X,
} from 'lucide-react';
import { AuroraCard } from './AuroraCard';
import { AuroraButton } from './AuroraButton';
import { ConfirmModal } from './ConfirmModal';

type Kind = 'keyword' | 'trending';
type Source = 'tiktok' | 'instagram' | 'youtube' | 'twitter';

/**
 * TikTok/Instagram отдают подписанные CDN-обложки (p16-…-sign.tiktokcdn-eu.com и т.п.),
 * которые браузер блокирует при прямой загрузке через <img> (ORB / 403 — нужен Referer
 * площадки). Гоним их через наш публичный прокси /api/channels/cover (он ставит нужный
 * Referer серверно). YouTube (ytimg) и прочие — напрямую. Тот же приём, что в «Каналах».
 */
function coverSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/tiktokcdn|ibyteimg|byteimg|muscdn|tiktokv|pstatp|cdninstagram|fbcdn/i.test(url)) {
    return `/api/channels/cover?u=${encodeURIComponent(url)}`;
  }
  return url;
}

// Источники трендов. Дизайн: брендовый глиф в мягком тонированном «app-icon» чипе
// (currentColor → color, фон → tint), выбор источника — indigo-выделение пилюли.
// TikTok/X монохромны (color = текст темы), IG/YouTube — приглушённый бренд-акцент.
// Reddit убран (расширение его не анализирует); у X нет ленты «Горячее» — только поиск.
const PLATFORMS: { id: Source; name: string; color: string; tint: string; trending: boolean; icon: React.ReactNode }[] = [
  { id: 'tiktok', name: 'TikTok', color: 'var(--text-primary)', tint: 'var(--bg-elevated)', trending: true, icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8c-.9-.6-1.5-1.6-1.7-2.8h-2.6v11.4c0 1.3-1 2.3-2.3 2.3s-2.3-1-2.3-2.3 1-2.3 2.3-2.3c.2 0 .5 0 .7.1v-2.7c-.2 0-.5-.1-.7-.1A5 5 0 1 0 14.9 14V8.7c1 .7 2.2 1.1 3.5 1.1V7.2c-.7 0-1.3-.2-1.8-.5z"/></svg>
  ) },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', tint: 'rgba(225,48,108,0.14)', trending: true, icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>
  ) },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', tint: 'rgba(255,0,0,0.12)', trending: true, icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.75-1.77C18.27 5 12 5 12 5s-6.27 0-7.85.43A2.5 2.5 0 0 0 2.4 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.75 1.77C5.73 19 12 19 12 19s6.27 0 7.85-.43a2.5 2.5 0 0 0 1.75-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.4-4.8zM10 15V9l5.2 3-5.2 3z"/></svg>
  ) },
  { id: 'twitter', name: 'X', color: 'var(--text-primary)', tint: 'var(--bg-elevated)', trending: false, icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.3 8.3L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L1 2h7l4.8 6.3L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z"/></svg>
  ) },
];

interface FilterDef { key: string; label: string; def: string; options: { v: string; label: string }[] }
const PLATFORM_FILTERS: Partial<Record<Source, FilterDef[]>> = {
  youtube: [
    { key: 'yt_kind', label: 'Формат', def: 'video', options: [
      { v: 'video', label: 'Видео' }, { v: 'shorts', label: 'Shorts' }] },
    { key: 'sort_by', label: 'Сортировка', def: 'relevance', options: [
      { v: 'relevance', label: 'По релевантности' }, { v: 'upload_date', label: 'Новые' },
      { v: 'view_count', label: 'Больше просмотров' }, { v: 'rating', label: 'По рейтингу' }] },
    { key: 'upload_time', label: 'Период', def: '', options: [
      { v: '', label: 'Всё время' }, { v: 'hour', label: 'Час' }, { v: 'today', label: 'Сегодня' },
      { v: 'week', label: 'Неделя' }, { v: 'month', label: 'Месяц' }, { v: 'year', label: 'Год' }] },
    { key: 'duration', label: 'Длительность', def: '', options: [
      { v: '', label: 'Любая' }, { v: 'short', label: 'Короткие' }, { v: 'medium', label: 'Средние' }, { v: 'long', label: 'Длинные' }] },
  ],
  twitter: [
    { key: 'search_type', label: 'Тип', def: 'Top', options: [
      { v: 'Top', label: 'Топ' }, { v: 'Latest', label: 'Свежие' }, { v: 'Media', label: 'С медиа' }] },
  ],
};
const defaultFilters = (id: Source): Record<string, string> => {
  const out: Record<string, string> = {};
  (PLATFORM_FILTERS[id] || []).forEach((f) => { if (f.def) out[f.key] = f.def; });
  return out;
};

export interface StoredVideo {
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
  const t = Math.round(s); // Instagram отдаёт дробные секунды → округляем (иначе «0:32.972…»)
  const m = Math.floor(t / 60), sec = t % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function friendlyError(e: any, fallback: string): string {
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed|err_connection/i.test(msg)) {
    return 'Сервер недоступен (нет связи с API). Проверьте, что запущены backend (apps/backend → npm run dev, порт 3001) и dev-сервер фронта (порт 3000), затем обновите страницу.';
  }
  return msg || fallback;
}

export interface TrendSearchProps {
  token: string | null;
  /** Открыть аналитику по одной ссылке (видео/аккаунт). */
  onAnalyze: (webUrl: string, cover?: string | null) => void;
  /** Открыть аналитику по списку выбранных ссылок (массовый разбор). */
  onAnalyzeBulk?: (items: { url: string; cover?: string }[]) => void;
  /** Слот между карточкой поиска и лентой результатов (напр. переключатель секций). */
  sectionTabs?: React.ReactNode;
}

export default function TrendSearch({ token, onAnalyze, onAnalyzeBulk, sectionTabs }: TrendSearchProps) {
  const [platform, setPlatform] = useState<Source>('tiktok');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<Kind>('keyword');
  const selectPlatform = (id: Source) => {
    setPlatform(id);
    setFilters(defaultFilters(id));
    setQuery(perPlatform[id]?.query ?? '');
    setPage(1); setSelected(new Set()); setNotice(null); setError(null);
    const p = PLATFORMS.find((x) => x.id === id);
    if (p && !p.trending && kind === 'trending') setKind('keyword');
  };
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(20);
  // Строковое зеркало count для поля ввода — чтобы цифра набиралась ПЛАВНО (можно очистить
  // поле, править середину), а клэмп в допустимый диапазон [1..30] происходил на blur, а не
  // на каждый keystroke (иначе пустое поле мгновенно превращалось в 1 и ввод «дёргался»).
  const [countStr, setCountStr] = useState('20');
  const clampCount = (n: number) => Math.min(30, Math.max(1, n));
  const pickCount = (n: number) => { const c = clampCount(n); setCount(c); setCountStr(String(c)); };
  const [mode, setMode] = useState<'video' | 'general' | 'app'>('app');
  const [sortType, setSortType] = useState<0 | 1 | 2>(0);
  const [publishTime, setPublishTime] = useState<0 | 1 | 7 | 30 | 90 | 180>(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanShape, setScanShape] = useState<any>(null);
  const [perPlatform, setPerPlatform] = useState<Record<string, { query: string; videos: StoredVideo[] }>>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const videos = perPlatform[platform]?.videos ?? [];
  const cardAspect = platform === 'youtube' ? (filters.yt_kind === 'shorts' ? '9 / 16' : '16 / 9') : '9 / 16';
  const setVideos = (updater: StoredVideo[] | ((prev: StoredVideo[]) => StoredVideo[])) =>
    setPerPlatform((s) => {
      const cur = s[platform] || { query: '', videos: [] };
      const next = typeof updater === 'function' ? (updater as (p: StoredVideo[]) => StoredVideo[])(cur.videos) : updater;
      return { ...s, [platform]: { query: cur.query, videos: next } };
    });
  const dedupVideos = (list: StoredVideo[]): StoredVideo[] => {
    const seen = new Set<string>(); const out: StoredVideo[] = [];
    for (const v of list) { const k = v.externalId || v.id || ''; if (!k || seen.has(k)) continue; seen.add(k); out.push(v); }
    return out;
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Подтверждение удаления — внутренняя модалка (вместо браузерного confirm).
  const [confirm, setConfirm] = useState<{ title: string; message?: string; onConfirm: () => void } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // Загрузка/обновление списка с сервера (источник истины). После удаления и при
  // фоновом скачивании UI приводим в соответствие с БД — без оптимистичных фантомов.
  const loadVideos = async () => {
    try {
      const res = await fetch('/api/trends/videos?limit=200', { headers: headers() });
      if (!res.ok) return;
      const d = await res.json();
      const buckets: Record<string, { query: string; videos: StoredVideo[] }> = {};
      for (const v of (d.videos || []) as StoredVideo[]) {
        const p = v.platform || 'tiktok';
        (buckets[p] = buckets[p] || { query: '', videos: [] }).videos.push(v);
      }
      setPerPlatform(buckets);
    } catch { /* тихо */ }
  };

  useEffect(() => { loadVideos(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Фоновое скачивание идёт на сервере → опрашиваем статусы, пока что-то качается.
  const anyDownloading = Object.values(perPlatform).some((b) => b.videos.some((v) => v.status === 'downloading'));
  useEffect(() => {
    if (!anyDownloading) return;
    const t = setInterval(() => { loadVideos(); }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyDownloading]);

  const handleScan = async () => {
    if (kind === 'keyword' && !query.trim()) { setError('Введите ключевое слово'); return; }
    setScanning(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/trends/scan', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ kind, query: query.trim(), count, mode, sortType, publishTime, platform, filters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const found: StoredVideo[] = data.videos || [];
      const q = query.trim();
      setPerPlatform((s) => {
        const cur = s[platform] || { query: '', videos: [] };
        return { ...s, [platform]: { query: q, videos: dedupVideos([...found, ...cur.videos]) } };
      });
      setPage(1);
      const fb = data.fellBackToApp ? ' Режим «Поиск по слову/Около-тематика» был нестабилен — поиск автоматически выполнен «Умным поиском».' : '';
      if ((data.count ?? 0) === 0) {
        setNotice(`Trend ответил, но видео не распознаны. Ключи ответа: [${(data.rawKeys || []).join(', ')}].${fb}`);
        setScanShape(data.shape || null);
      } else {
        setNotice(`Найдено видео: ${data.count}.${fb}`);
        setScanShape(null);
      }
    } catch (e: any) { setError(friendlyError(e, 'Ошибка сканирования')); }
    finally { setScanning(false); }
  };

  // Скачивание идёт ФОНОВО на сервере (можно уйти со страницы) и попадает в Галерею.
  // Статус обновляет поллинг loadVideos. Здесь — только запуск + мгновенный отклик.
  const handleDownload = async (v: StoredVideo) => {
    if (!v.id) { setError('Видео не сохранено в БД — повторите скан.'); return; }
    setError(null);
    setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'downloading' } : x));
    try {
      const res = await fetch(`/api/trends/videos/${v.id}/download`, { method: 'POST', headers: headers() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'failed' } : x));
      setError(friendlyError(e, 'Не удалось скачать'));
    }
  };

  const cancelDownload = async (v: StoredVideo) => {
    if (!v.id) return;
    setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'discovered' } : x));
    try { await fetch(`/api/trends/videos/${v.id}/download/cancel`, { method: 'POST', headers: headers() }); } catch { /* тихо */ }
  };

  // Ключ выбора: БД-id, а если видео ещё не сохранено в БД (напр. Instagram) —
  // externalId. Так чекбокс работает на КАЖДОЙ карточке (выбор → массовая аналитика);
  // скачивание/удаление по-прежнему требуют БД-id (фильтруются ниже).
  const keyOf = (v: StoredVideo): string => v.id || v.externalId || '';
  const toggleSelect = (id: string | null) => {
    if (!id) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectableIds = videos.map(keyOf).filter(Boolean);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds));

  const downloadSelected = async () => {
    const targets = videos.filter((v) => v.id && selected.has(keyOf(v)) && !v.fileUrl);
    if (targets.length === 0) return;
    setBulkDownloading(true);
    for (const v of targets) {
      // eslint-disable-next-line no-await-in-loop
      await handleDownload(v);
    }
    setBulkDownloading(false);
  };

  const doDeleteBulk = async (ids: string[]) => {
    setBulkDeleting(true); setError(null);
    try {
      const res = await fetch('/api/trends/videos/delete-bulk', { method: 'POST', headers: headers(), body: JSON.stringify({ ids }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setSelected(new Set());
      await loadVideos(); // источник истины — БД (без оптимистичного удаления из UI)
      if ((d.deleted ?? 0) < ids.length) setNotice(`Удалено: ${d.deleted ?? 0} из ${ids.length}.`);
    } catch (e: any) { setError(friendlyError(e, 'Не удалось удалить')); }
    finally { setBulkDeleting(false); }
  };
  const deleteSelected = () => {
    const ids = videos.filter((v) => v.id && selected.has(keyOf(v))).map((v) => v.id as string);
    if (ids.length === 0) return;
    setConfirm({ title: 'Удалить видео?', message: `Удалить выбранные видео из списка (${ids.length})? Действие необратимо.`, onConfirm: () => { setConfirm(null); doDeleteBulk(ids); } });
  };
  const deleteOne = (v: StoredVideo) => {
    if (!v.id) return;
    setConfirm({ title: 'Удалить видео?', message: 'Удалить это видео из списка?', onConfirm: () => {
      setConfirm(null); setError(null);
      (async () => {
        try {
          const res = await fetch(`/api/trends/videos/${v.id}`, { method: 'DELETE', headers: headers() });
          if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${res.status}`); }
          await loadVideos();
        } catch (e: any) { setError(friendlyError(e, 'Не удалось удалить')); }
      })();
    } });
  };

  const analyzeSelected = () => {
    // Аналитике нужен только webUrl — работает и для несохранённых (Instagram без БД-id).
    const items = videos.filter((v) => selected.has(keyOf(v)) && v.webUrl).map((v) => ({ url: v.webUrl as string, cover: v.coverUrl }));
    if (items.length === 0 || !onAnalyzeBulk) return;
    onAnalyzeBulk(items);
  };

  const selectedCount = videos.filter((v) => v.id && selected.has(keyOf(v)) && !v.fileUrl).length;

  return (
    <>
      {/* Search card */}
      <AuroraCard className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-600 mr-1" style={{ color: 'var(--text-muted)' }}>Источник:</span>
          {PLATFORMS.map((p) => {
            const on = platform === p.id;
            return (
              <button key={p.id} onClick={() => selectPlatform(p.id)} title={p.name}
                className="inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full transition-all duration-150"
                style={{
                  background: on ? 'rgba(99,102,241,0.10)' : 'var(--bg-tertiary)',
                  border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border-subtle)'}`,
                  boxShadow: on ? '0 1px 6px rgba(99,102,241,0.18)' : 'none',
                }}>
                <span className="w-[26px] h-[26px] rounded-[9px] flex items-center justify-center flex-shrink-0"
                      style={{ background: p.tint, color: p.color }}>{p.icon}</span>
                <span className="text-[12px] font-600" style={{ color: on ? 'var(--brand)' : 'var(--text-secondary)' }}>{p.name}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:inline-grid sm:auto-cols-max sm:grid-flow-col gap-1 p-1 rounded-xl"
             style={{ background: 'var(--bg-tertiary)' }}>
          {(['keyword', 'trending'] as Kind[]).map((k) => {
            const disabled = k === 'trending' && !(PLATFORMS.find((p) => p.id === platform)?.trending);
            return (
            <button key={k} onClick={() => !disabled && setKind(k)} disabled={disabled}
              title={disabled ? 'У этой площадки нет ленты «Горячее»' : undefined}
              className="px-4 py-2 rounded-lg text-sm font-600 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: kind === k ? 'var(--bg-secondary)' : 'transparent',
                color: kind === k ? 'var(--brand)' : 'var(--text-muted)',
                boxShadow: kind === k ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}>
              {k === 'keyword' ? '🔍 По ключевику' : '🔥 Горячее'}
            </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          {kind === 'keyword' && (
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
                placeholder="например: morning routine, рецепт, gym…"
                className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 transition-shadow"
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

        <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Сколько видео
            <div className="flex items-center gap-1.5">
              {[10, 20, 30].map((n) => (
                <button key={n} type="button" onClick={() => pickCount(n)}
                  className="w-10 h-10 rounded-lg text-sm font-700 transition-colors"
                  style={{
                    background: count === n ? 'var(--brand)' : 'var(--bg-tertiary)',
                    color: count === n ? 'var(--brand-contrast)' : 'var(--text-muted)',
                    border: `1px solid ${count === n ? 'var(--brand)' : 'var(--border-medium)'}`,
                  }}>
                  {n}
                </button>
              ))}
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={countStr}
                onChange={(e) => {
                  // Только цифры, максимум 2 знака (потолок 30). Пустое поле разрешаем — не
                  // навязываем 1; count обновляем лишь на валидном числе, финальный клэмп — на blur.
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setCountStr(raw);
                  const n = parseInt(raw, 10);
                  if (Number.isFinite(n) && n >= 1) setCount(clampCount(n));
                }}
                onBlur={() => pickCount(parseInt(countStr, 10) || 20)}
                onFocus={(e) => e.currentTarget.select()}
                title="Своё количество (1–30)"
                aria-label="Своё количество видео (1–30)"
                className="w-14 h-10 px-2 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
            </div>
          </label>

          {kind === 'keyword' && platform === 'tiktok' && (
            <label className="flex flex-col gap-1 text-[11px] flex-1 min-w-[150px]" style={{ color: 'var(--text-muted)' }}>
              Тип поиска
              <select value={mode} onChange={(e) => setMode(e.target.value as any)}
                className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                <option value="app">Умный поиск</option>
                <option value="video">Поиск по слову</option>
                <option value="general">Около-тематика</option>
              </select>
            </label>
          )}
          {kind === 'keyword' && platform === 'tiktok' && mode === 'app' && (
            <>
              <label className="flex flex-col gap-1 text-[11px] flex-1 min-w-[140px]" style={{ color: 'var(--text-muted)' }}>
                Сортировка
                <select value={sortType} onChange={(e) => setSortType(Number(e.target.value) as any)}
                  className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                  <option value={0}>По релевантности</option>
                  <option value={1}>Больше лайков</option>
                  <option value={2}>Новее</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] flex-1 min-w-[130px]" style={{ color: 'var(--text-muted)' }}>
                Период
                <select value={publishTime} onChange={(e) => setPublishTime(Number(e.target.value) as any)}
                  className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
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

          {kind === 'keyword' && platform !== 'tiktok' && (PLATFORM_FILTERS[platform] || []).map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-[11px] flex-1 min-w-[140px]" style={{ color: 'var(--text-muted)' }}>
              {f.label}
              {f.options.length <= 2 ? (
                /* Мало вариантов (YouTube «Формат» Видео/Shorts) — сегмент-кнопки вместо выпадашки. */
                <div className="flex items-center gap-1.5">
                  {f.options.map((o) => {
                    const on = (filters[f.key] ?? f.def) === o.v;
                    return (
                      <button key={o.v} type="button" onClick={() => setFilters((s) => ({ ...s, [f.key]: o.v }))}
                        className="flex-1 h-10 px-3 rounded-lg text-sm font-600 transition-colors whitespace-nowrap"
                        style={{ background: on ? 'var(--brand)' : 'var(--bg-tertiary)', color: on ? 'var(--brand-contrast)' : 'var(--text-muted)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-medium)'}` }}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <select value={filters[f.key] ?? f.def} onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                  {f.options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              )}
            </label>
          ))}
          {kind === 'keyword' && platform === 'instagram' && (
            <p className="text-[11px] flex items-end pb-2.5" style={{ color: 'var(--text-muted)' }}>Instagram: фильтров нет — только поиск по ключевику.</p>
          )}
        </div>

        {kind === 'keyword' && platform === 'tiktok' && (
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
        {scanShape && (
          <details className="text-[11px]">
            <summary className="inline-flex items-center gap-1.5 cursor-pointer select-none font-600" style={{ color: 'var(--text-muted)' }}>
              🔧 Структура ответа (пришлите для настройки разбора)
            </summary>
            <pre className="mt-2 p-3 rounded-lg overflow-auto" style={{ maxHeight: 360, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {JSON.stringify(scanShape, null, 1)}
            </pre>
          </details>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <XCircle size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
          </div>
        )}
      </AuroraCard>

      {sectionTabs}

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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                Найдено: {videos.length}
              </span>
              <button type="button" onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {allSelected ? <CheckSquare size={15} color="var(--brand)" /> : <Square size={15} />}
                {allSelected ? 'Снять выделение' : 'Выбрать всё'}{selected.size > 0 ? ` · ${selected.size}` : ''}
              </button>
              <button type="button" onClick={deleteSelected} disabled={selected.size === 0 || bulkDeleting}
                title="Удалить выбранные из списка"
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                {bulkDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Удалить{selected.size > 0 ? ` · ${selected.size}` : ''}
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {onAnalyzeBulk && (
                <AuroraButton variant="secondary" onClick={analyzeSelected} disabled={selected.size === 0}
                  icon={<BarChart3 size={16} />}>
                  {`Анализировать выбранные${selected.size > 0 ? ` (${selected.size})` : ''}`}
                </AuroraButton>
              )}
              <AuroraButton onClick={downloadSelected} disabled={bulkDownloading || selectedCount === 0}
                icon={bulkDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}>
                {bulkDownloading ? 'Скачиваю…' : `Скачать выбранные${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
              </AuroraButton>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {videos.slice(0, page * PAGE_SIZE).map((v) => {
            const isSel = !!(keyOf(v) && selected.has(keyOf(v)));
            return (
            <AuroraCard key={v.id || v.externalId}
              className={`group p-0 overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-1 hover:shadow-lg${isSel ? ' ring-2 ring-[var(--brand)] ring-inset' : ''}`}>
              <div className="relative w-full" style={{ aspectRatio: cardAspect, background: 'var(--bg-tertiary)' }}>
                {v.coverUrl ? (
                  <img src={coverSrc(v.coverUrl)} alt="" referrerPolicy="no-referrer" loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Play size={28} style={{ color: 'var(--text-muted)' }} /></div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none"
                     style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
                {v.webUrl && (
                  <a href={v.webUrl} target="_blank" rel="noreferrer"
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.28)' }} title="Открыть оригинал">
                    <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(4px)' }}>
                      <Play size={24} color="#fff" fill="#fff" />
                    </span>
                  </a>
                )}
                <span className="absolute bottom-2 left-2 text-[11px] px-1.5 py-0.5 rounded-md font-700 inline-flex items-center gap-1 z-10"
                  style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                  <Eye size={12} /> {fmt(v.stats.play)}
                </span>
                {dur(v.durationSec) && (
                  <span className="absolute bottom-2 right-2 text-[11px] px-1.5 py-0.5 rounded font-600 z-10"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{dur(v.durationSec)}</span>
                )}
                {keyOf(v) && (
                  <button type="button" onClick={() => toggleSelect(keyOf(v))} title="Выбрать"
                    className="absolute top-2 left-2 w-7 h-7 rounded-md flex items-center justify-center z-20 transition-colors"
                    style={{ background: isSel ? 'var(--brand)' : 'rgba(0,0,0,0.45)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.7)' }}>
                    {isSel ? <Check size={15} /> : null}
                  </button>
                )}
                {v.status === 'downloaded' && (
                  <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded font-700 inline-flex items-center gap-1 z-20"
                    style={{ background: 'rgba(16,185,129,0.92)', color: '#fff' }}><CheckCircle2 size={11} /> скачано</span>
                )}
              </div>
              <div className="p-3 flex flex-col gap-2 flex-1">
                <div className="text-xs font-700 truncate" style={{ color: 'var(--text-primary)' }} title={v.authorName || v.author}>
                  @{v.author}
                </div>
                {v.description && (
                  <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{v.description}</p>
                )}
                {/* Показываем только те метрики, что реально есть (YouTube не отдаёт
                    лайки/комменты/шеры в списке поиска → иконки с «—» убираем). */}
                {(v.stats.like != null || v.stats.comment != null || v.stats.share != null) && (
                  <div className="flex items-center gap-2.5 text-[11px] flex-wrap mt-auto" style={{ color: 'var(--text-muted)' }}>
                    {v.stats.like != null && <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(v.stats.like)}</span>}
                    {v.stats.comment != null && <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} /> {fmt(v.stats.comment)}</span>}
                    {v.stats.share != null && <span className="inline-flex items-center gap-0.5"><Share2 size={11} /> {fmt(v.stats.share)}</span>}
                  </div>
                )}
                <div className="flex items-center gap-1 pt-1">
                  {v.webUrl && (
                    <button type="button" onClick={() => onAnalyze(v.webUrl!, v.coverUrl)} title="Аналитика"
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
                      style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)', border: '1px solid rgba(99,102,241,0.3)' }}>
                      <BarChart3 size={15} />
                    </button>
                  )}
                  {v.id && (
                    <button type="button" onClick={() => deleteOne(v)} title="Удалить это видео из списка"
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
                      style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                  {v.webUrl && (
                    <a href={v.webUrl} target="_blank" rel="noreferrer" title="Открыть оригинал"
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {v.fileUrl ? (
                    <a href={v.fileUrl} target="_blank" rel="noreferrer" title="Скачано — открыть файл"
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-auto"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                      <CheckCircle2 size={15} />
                    </a>
                  ) : v.status === 'downloading' ? (
                    <button type="button" onClick={() => cancelDownload(v)} title="Скачивается в фоне — нажмите, чтобы отменить"
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-auto group/dl transition-colors"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                      <Loader2 size={14} className="animate-spin group-hover/dl:hidden" />
                      <X size={15} className="hidden group-hover/dl:block" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleDownload(v)} disabled={!v.id}
                      title={!v.id ? 'Видео не сохранено в БД' : v.status === 'failed' ? 'Ошибка скачивания — нажмите, чтобы повторить' : 'Скачать (в фоне → появится в Галерее)'}
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-auto transition-colors disabled:opacity-40"
                      style={{ background: v.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'var(--brand)', color: v.status === 'failed' ? '#ef4444' : 'var(--brand-contrast)' }}>
                      {v.status === 'failed' ? <AlertCircle size={15} /> : <Download size={15} />}
                    </button>
                  )}
                </div>
              </div>
            </AuroraCard>
            );
          })}
          </div>

          {videos.length > page * PAGE_SIZE && (
            <div className="flex justify-center pt-1">
              <AuroraButton variant="secondary" onClick={() => setPage((p) => p + 1)}>
                Показать ещё ({videos.length - page * PAGE_SIZE})
              </AuroraButton>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message}
        variant="danger"
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
