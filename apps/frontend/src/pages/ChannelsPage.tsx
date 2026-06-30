/**
 * ChannelsPage — «Каналы».
 *  • Список ОТСЛЕЖИВАЕМЫХ каналов (watchlist): авто-обновление раз в сутки + кнопка
 *    «Обновить сейчас». Рядом с метриками — дельта «было→стало» (зелёным/красным).
 *  • Детали канала: лента видео с дельтами по каждому показателю.
 *  • Разовый разбор по ссылке (без истории) — Фаза 1, + кнопка «Отслеживать».
 *
 * Дельты появляются со 2-го обновления (1-е — база): историю можно копить только с
 * момента старта отслеживания (TikHub отдаёт лишь текущие цифры).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Users, Search, Loader2, ExternalLink, Eye, Heart, MessageCircle, Share2, Play,
  BadgeCheck, AlertCircle, XCircle, Film, TrendingUp, RefreshCw, Trash2, Plus, ArrowLeft, Clock,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { ConfirmModal } from '../components/ConfirmModal';

const PLATFORM_LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };

interface Nums { play: number | null; like: number | null; comment: number | null; share: number | null }
interface WatchedChannel {
  id: string; platform: string; handle: string; displayName: string | null; avatarUrl: string | null;
  url: string | null; verified: boolean; followers: number | null; prevFollowers: number | null;
  videosCount: number; enabled: boolean; lastRefreshedAt: string | null; prevRefreshedAt: string | null; lastError: string | null;
}
interface WatchedVideo {
  externalId: string; platform: string; isShort?: boolean | null; author: string | null; description: string | null;
  coverUrl: string | null; webUrl: string | null; durationSec: number | null; createTime: number | null;
  stats: Nums; prev: Nums; prevSnapshotAt: string | null;
}
interface OnDemand {
  profile: { platform: string; handle: string; displayName?: string; avatarUrl?: string; bio?: string; followers?: number; verified?: boolean; url?: string };
  videos: { externalId: string; isShort?: boolean; author?: string; description?: string; coverUrl?: string; webUrl?: string; durationSec?: number; createTime?: number; stats: { play?: number; like?: number; comment?: number; share?: number } }[];
  count: number; hasMore: boolean; note?: string;
}

function fmt(n?: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
/** Точное число с разделителями тысяч (для просмотров — пользователь хочет полное число, не «1K»). */
function fmtViews(n?: number | null): string { return n == null ? '—' : n.toLocaleString('ru-RU'); }
function dur(s?: number | null): string {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
/** Соотношение сторон карточки — один-в-один с «Трендами» (social-extension):
 *  YouTube-ролики горизонтальные 16:9, YouTube Shorts (вертикаль ≤60с) и
 *  TikTok/Instagram — вертикальные 9:16. */
function cardAspect(platform?: string, durationSec?: number | null, isShort?: boolean | null): string {
  if (platform === 'youtube') {
    if (isShort) return '9 / 16';                 // Shorts — вертикальные
    if (isShort === false) return '16 / 9';       // обычные ролики — горизонтальные
    return durationSec != null && durationSec > 0 && durationSec <= 60 ? '9 / 16' : '16 / 9';  // нет флага — по длительности
  }
  return '9 / 16';
}
/** TikTok/Instagram отдают подписанные CDN-обложки, которые браузер блокирует при прямой
 *  загрузке через <img> → гоним их через наш прокси /api/channels/cover (с нужным Referer).
 *  YouTube (ytimg) и прочие — напрямую. */
function coverSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/tiktokcdn|ibyteimg|byteimg|muscdn|tiktokv|pstatp|cdninstagram|fbcdn/i.test(url)) {
    return `/api/channels/cover?u=${encodeURIComponent(url)}`;
  }
  return url;
}
function ago(iso: string | null): string {
  if (!iso) return 'ещё не обновлялся';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3.6e6);
  if (h < 1) return 'только что';
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} дн назад`;
}
function friendlyError(e: any, fallback: string): string {
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) return 'Сервер недоступен. Обновите страницу.';
  return msg || fallback;
}

/** Дельта «было→стало»: +45K зелёным / −12K красным / ничего, если истории ещё нет. */
function Delta({ cur, prev }: { cur: number | null | undefined; prev: number | null | undefined }) {
  if (cur == null || prev == null) return null;
  const d = cur - prev;
  if (d === 0) return null;
  const up = d > 0;
  return (
    <span style={{ color: up ? '#10b981' : '#ef4444', fontSize: 10, marginLeft: 4, fontWeight: 700 }}>
      {up ? '+' : '−'}{fmt(Math.abs(d))}
    </span>
  );
}

export default function ChannelsPage() {
  const { token } = useAppStore();
  const authHeaders = useCallback((): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  const [view, setView] = useState<'list' | 'analyze' | 'detail'>('list');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [channels, setChannels] = useState<WatchedChannel[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [adding, setAdding] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message?: string; onConfirm: () => void } | null>(null);

  const [analysis, setAnalysis] = useState<OnDemand | null>(null);
  const [detail, setDetail] = useState<{ channel: WatchedChannel; videos: WatchedVideo[] } | null>(null);
  // Лента канала: вкладка Видео/Shorts (YouTube) + сортировка по просмотрам + фильтр по периоду.
  const [ytTab, setYtTab] = useState<'videos' | 'shorts'>('videos');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [period, setPeriod] = useState<'all' | 'day' | 'week' | 'month' | '45d'>('all');
  const PERIOD_DAYS: Record<string, number> = { all: 0, day: 1, week: 7, month: 30, '45d': 45 };

  // Готовит ленту к показу: фильтр Видео/Shorts (YouTube) → фильтр по периоду публикации → сортировка по просмотрам.
  function prepareVideos<T extends { isShort?: boolean | null; createTime?: number | null; stats: { play?: number | null } }>(platform: string, vids: T[]): T[] {
    let list = platform === 'youtube' ? vids.filter((v) => (ytTab === 'shorts' ? v.isShort : !v.isShort)) : vids.slice();
    const days = PERIOD_DAYS[period] || 0;
    if (days > 0) {
      const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
      list = list.filter((v) => v.createTime != null && v.createTime >= cutoff);
    }
    list.sort((a, b) => { const av = a.stats.play || 0, bv = b.stats.play || 0; return sortOrder === 'asc' ? av - bv : bv - av; });
    return list;
  }

  const ytToggle = (platform: string, vids: { isShort?: boolean | null }[]) => {
    if (platform !== 'youtube') return null;
    const reg = vids.filter((v) => !v.isShort).length, sh = vids.filter((v) => v.isShort).length;
    if (!sh) return null;   // нет Shorts — без переключателя
    return (
      <div className="inline-grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
        {([['videos', `Видео (${reg})`], ['shorts', `Shorts (${sh})`]] as ['videos' | 'shorts', string][]).map(([k, lbl]) => (
          <button key={k} onClick={() => setYtTab(k)} className="px-4 py-1.5 rounded-lg text-sm font-600 transition-all whitespace-nowrap"
            style={{ background: ytTab === k ? 'var(--brand)' : 'transparent', color: ytTab === k ? 'var(--brand-contrast)' : 'var(--text-muted)' }}>{lbl}</button>
        ))}
      </div>
    );
  };
  const selCls = 'h-9 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40';
  const selStyle: React.CSSProperties = { background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' };
  // Панель управления лентой: вкладка Видео/Shorts + сортировка + период.
  const controlsBar = (platform: string, vids: { isShort?: boolean | null }[]) => (
    <div className="flex items-center gap-2 flex-wrap">
      {ytToggle(platform, vids)}
      <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className={selCls} style={selStyle} title="Сортировка">
        <option value="desc">Больше просмотров</option>
        <option value="asc">Меньше просмотров</option>
      </select>
      <select value={period} onChange={(e) => setPeriod(e.target.value as any)} className={selCls} style={selStyle} title="Период публикации">
        <option value="all">Всё время</option>
        <option value="day">За день</option>
        <option value="week">За неделю</option>
        <option value="month">За месяц</option>
        <option value="45d">За 45 дней</option>
      </select>
    </div>
  );

  const loadChannels = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/channels/watch', { headers: authHeaders() });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setChannels(d.channels || []);
    } catch { /* тихо */ } finally { setLoadingList(false); }
  }, [authHeaders]);
  useEffect(() => { loadChannels(); }, [loadChannels]);

  const addWatch = async () => {
    const v = url.trim();
    if (!v) { setError('Вставьте ссылку на канал.'); return; }
    setAdding(true); setError(null); setNote(null);
    try {
      const res = await fetch('/api/channels/watch', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: v }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setUrl(''); setNote('Канал добавлен в отслеживаемые. Базовый снимок собран — дельты появятся при следующем обновлении.');
      await loadChannels();
    } catch (e: any) { setError(friendlyError(e, 'Не удалось добавить канал')); } finally { setAdding(false); }
  };

  const analyzeOnDemand = async () => {
    const v = url.trim();
    if (!v) { setError('Вставьте ссылку на канал.'); return; }
    setAnalyzing(true); setError(null); setNote(null); setAnalysis(null);
    try {
      const res = await fetch('/api/channels/analyze', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: v, maxVideos: 120 }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setAnalysis(d as OnDemand); setView('analyze');
    } catch (e: any) { setError(friendlyError(e, 'Не удалось разобрать канал')); } finally { setAnalyzing(false); }
  };

  const watchFromAnalysis = async () => {
    if (!analysis?.profile?.url) return;
    setAdding(true); setError(null);
    try {
      const res = await fetch('/api/channels/watch', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ url: analysis.profile.url }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      await loadChannels(); setView('list'); setAnalysis(null);
      setNote('Канал добавлен в отслеживаемые.');
    } catch (e: any) { setError(friendlyError(e, 'Не удалось добавить канал')); } finally { setAdding(false); }
  };

  const detailReq = useRef(0);
  const openDetail = async (id: string) => {
    const my = ++detailReq.current;                    // токен запроса — против гонки быстрых кликов
    setError(null); setNote(null); setDetail(null); setView('detail');
    try {
      const res = await fetch(`/api/channels/watch/${id}`, { headers: authHeaders() });
      const d = await res.json().catch(() => ({}));
      if (my !== detailReq.current) return;            // ответ устаревшего запроса — игнорируем
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setDetail(d);
    } catch (e: any) { if (my === detailReq.current) setError(friendlyError(e, 'Не удалось открыть канал')); }
  };

  const refreshChannel = async (id: string, reopenDetail: boolean) => {
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`/api/channels/watch/${id}/refresh`, { method: 'POST', headers: authHeaders() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      await loadChannels();
      if (reopenDetail) await openDetail(id);
    } catch (e: any) { setError(friendlyError(e, 'Не удалось обновить')); } finally { setBusyId(null); }
  };

  const removeChannel = (c: WatchedChannel) => {
    setConfirm({
      title: 'Убрать канал из отслеживаемых?',
      message: `«${c.displayName || c.handle}» и вся его история будут удалены. Действие необратимо.`,
      onConfirm: () => {
        setConfirm(null);
        (async () => {
          setBusyId(c.id); setError(null);
          try {
            const res = await fetch(`/api/channels/watch/${c.id}`, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${res.status}`); }
            if (detail?.channel.id === c.id) { setView('list'); setDetail(null); }
            await loadChannels();
          } catch (e: any) { setError(friendlyError(e, 'Не удалось удалить')); } finally { setBusyId(null); }
        })();
      },
    });
  };

  const ConfirmEl = (
    <ConfirmModal open={!!confirm} title={confirm?.title || ''} message={confirm?.message} variant="danger"
      onConfirm={() => confirm?.onConfirm()} onCancel={() => setConfirm(null)} />
  );

  // ── Шапка страницы ──
  const Header = (
    <div className="flex items-center gap-3">
      <img src="/icons/nav-channels.png" alt="" draggable={false}
           className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0" style={{ objectFit: 'contain' }} />
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-700 leading-tight" style={{ color: 'var(--text-primary)' }}>Каналы</h1>
        <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
          Отслеживайте каналы — метрики обновляются раз в сутки, рядом с цифрами видно «было→стало».
        </p>
      </div>
    </div>
  );

  // ───────────────────────── ДЕТАЛИ КАНАЛА ─────────────────────────
  if (view === 'detail') {
    const ch = detail?.channel;
    return (
      <div className="max-w-[1760px] mx-auto py-2 sm:py-3 space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={() => { setView('list'); setDetail(null); }} title="Назад"
            className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            <ArrowLeft size={17} />
          </button>
          <h1 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{ch?.displayName || (ch ? `@${ch.handle}` : 'Канал')}</h1>
        </div>
        {error && <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}><XCircle size={16} className="mt-[2px]" /><span>{error}</span></div>}
        {!detail ? (
          <AuroraCard className="p-10 text-center"><Loader2 size={22} className="animate-spin mx-auto" style={{ color: 'var(--brand)' }} /></AuroraCard>
        ) : (
          <>
            <AuroraCard className="p-4 sm:p-5">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
                  {ch!.avatarUrl ? <img src={coverSrc(ch!.avatarUrl)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <div className="w-full h-full flex items-center justify-center"><Users size={26} style={{ color: 'var(--text-muted)' }} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{ch!.displayName || `@${ch!.handle}`}</span>
                    {ch!.verified && <BadgeCheck size={16} style={{ color: 'var(--brand)' }} />}
                    <span className="text-[11px] font-600 px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{PLATFORM_LABEL[ch!.platform] || ch!.platform}</span>
                  </div>
                  <div className="text-sm font-600 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {fmt(ch!.followers)} подписчиков<Delta cur={ch!.followers} prev={ch!.prevFollowers} />
                  </div>
                  <div className="text-[11px] mt-1 inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={11} /> Обновлён {ago(ch!.lastRefreshedAt)} · {ch!.videosCount} видео
                  </div>
                </div>
                <AuroraButton onClick={() => refreshChannel(ch!.id, true)} disabled={busyId === ch!.id} variant="secondary" className="!w-auto"
                  icon={busyId === ch!.id ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}>
                  Обновить сейчас
                </AuroraButton>
              </div>
              {ch!.prevRefreshedAt == null && (
                <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <AlertCircle size={12} className="mt-[1px] flex-shrink-0" style={{ color: '#f59e0b' }} />
                  Это базовый снимок. Дельты «было→стало» появятся после следующего обновления (авто — раз в сутки, либо кнопкой).
                </p>
              )}
            </AuroraCard>

            {controlsBar(ch!.platform, detail.videos)}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
              {prepareVideos(ch!.platform, detail.videos).map((v: WatchedVideo) => (
                <AuroraCard key={v.externalId} className="group p-0 overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative w-full" style={{ aspectRatio: cardAspect(v.platform, v.durationSec, v.isShort), background: 'var(--bg-tertiary)' }}>
                    {v.coverUrl ? <img src={coverSrc(v.coverUrl)} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      : <div className="w-full h-full flex items-center justify-center"><Play size={26} style={{ color: 'var(--text-muted)' }} /></div>}
                    <div className="absolute inset-x-0 bottom-0 h-14 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
                    {v.webUrl && (
                      <a href={v.webUrl} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.28)' }} title="Открыть оригинал">
                        <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(4px)' }}><Play size={22} color="#fff" fill="#fff" /></span>
                      </a>
                    )}
                    <span className="absolute bottom-2 left-2 text-[11px] font-700 inline-flex items-center gap-1 z-10" style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                      <Eye size={12} /> {fmtViews(v.stats.play)}<Delta cur={v.stats.play} prev={v.prev.play} />
                    </span>
                    {dur(v.durationSec) && <span className="absolute bottom-2 right-2 text-[11px] px-1.5 py-0.5 rounded font-600 z-10" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{dur(v.durationSec)}</span>}
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    {v.description && <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{v.description}</p>}
                    {v.platform !== 'youtube' && (
                    <div className="flex items-center gap-2.5 text-[11px] flex-wrap mt-auto" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(v.stats.like)}<Delta cur={v.stats.like} prev={v.prev.like} /></span>
                      <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} /> {fmt(v.stats.comment)}<Delta cur={v.stats.comment} prev={v.prev.comment} /></span>
                      <span className="inline-flex items-center gap-0.5"><Share2 size={11} /> {fmt(v.stats.share)}<Delta cur={v.stats.share} prev={v.prev.share} /></span>
                    </div>
                    )}
                  </div>
                </AuroraCard>
              ))}
            </div>
          </>
        )}
        {ConfirmEl}
      </div>
    );
  }

  // ───────────────────────── РАЗОВЫЙ РАЗБОР (on-demand) ─────────────────────────
  if (view === 'analyze' && analysis) {
    const a = analysis;
    const agg = a.videos.reduce((s, v) => { s.views += v.stats.play || 0; s.likes += v.stats.like || 0; return s; }, { views: 0, likes: 0 });
    return (
      <div className="max-w-[1760px] mx-auto py-2 sm:py-3 space-y-5">
        <div className="flex items-center gap-2">
          <button onClick={() => { setView('list'); setAnalysis(null); }} title="Назад" className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><ArrowLeft size={17} /></button>
          <h1 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>Разовый разбор</h1>
        </div>
        {error && <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}><XCircle size={16} className="mt-[2px]" /><span>{error}</span></div>}
        <AuroraCard className="p-4 sm:p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
              {a.profile.avatarUrl ? <img src={coverSrc(a.profile.avatarUrl)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                : <div className="w-full h-full flex items-center justify-center"><Users size={26} style={{ color: 'var(--text-muted)' }} /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{a.profile.displayName || `@${a.profile.handle}`}</span>
                {a.profile.verified && <BadgeCheck size={16} style={{ color: 'var(--brand)' }} />}
                <span className="text-[11px] font-600 px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{PLATFORM_LABEL[a.profile.platform] || a.profile.platform}</span>
              </div>
              {a.profile.followers != null && <div className="text-sm font-600 mt-1" style={{ color: 'var(--text-secondary)' }}>{fmt(a.profile.followers)} подписчиков</div>}
            </div>
            <AuroraButton onClick={watchFromAnalysis} disabled={adding} className="!w-auto" icon={adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}>Отслеживать</AuroraButton>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {([['Видео', String(a.count), <Film size={15} key="f" />], ['Просмотры (сумма)', fmt(agg.views), <Eye size={15} key="e" />], ['Лайки (сумма)', fmt(agg.likes), <Heart size={15} key="h" />], ['Подписчики', fmt(a.profile.followers), <Users size={15} key="u" />]] as [string, string, React.ReactNode][]).map(([l, val, ic]) => (
              <div key={l} className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{ic}{l}</div>
                <div className="text-lg font-800 mt-0.5" style={{ color: 'var(--text-primary)' }}>{val}</div>
              </div>
            ))}
          </div>
          {a.note && <div className="flex items-start gap-2 text-[12px] rounded-xl p-3 mt-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><AlertCircle size={14} className="mt-[2px]" style={{ color: '#f59e0b' }} /><span>{a.note}</span></div>}
        </AuroraCard>
        {controlsBar(a.profile.platform, a.videos)}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {prepareVideos(a.profile.platform, a.videos).map((v: OnDemand['videos'][number]) => (
            <AuroraCard key={v.externalId} className="group p-0 overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-1 hover:shadow-lg">
              <div className="relative w-full" style={{ aspectRatio: cardAspect(a.profile.platform, v.durationSec, v.isShort), background: 'var(--bg-tertiary)' }}>
                {v.coverUrl ? <img src={coverSrc(v.coverUrl)} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  : <div className="w-full h-full flex items-center justify-center"><Play size={26} style={{ color: 'var(--text-muted)' }} /></div>}
                <span className="absolute bottom-2 left-2 text-[11px] font-700 inline-flex items-center gap-1 z-10" style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}><Eye size={12} /> {fmtViews(v.stats.play)}</span>
                {dur(v.durationSec) && <span className="absolute bottom-2 right-2 text-[11px] px-1.5 py-0.5 rounded font-600 z-10" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{dur(v.durationSec)}</span>}
              </div>
              <div className="p-3 flex flex-col gap-2 flex-1">
                {v.description && <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{v.description}</p>}
                {a.profile.platform !== 'youtube' && (
                <div className="flex items-center gap-2.5 text-[11px] flex-wrap mt-auto" style={{ color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(v.stats.like)}</span>
                  <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} /> {fmt(v.stats.comment)}</span>
                  <span className="inline-flex items-center gap-0.5"><Share2 size={11} /> {fmt(v.stats.share)}</span>
                </div>
                )}
              </div>
            </AuroraCard>
          ))}
        </div>
        {ConfirmEl}
      </div>
    );
  }

  // ───────────────────────── СПИСОК ОТСЛЕЖИВАЕМЫХ ─────────────────────────
  return (
    <div className="max-w-[1760px] mx-auto py-2 sm:py-3 space-y-5">
      {Header}

      <AuroraCard className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addWatch(); }}
              placeholder="tiktok.com/@user · instagram.com/user · youtube.com/channel/UC…"
              className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </div>
          <AuroraButton onClick={addWatch} disabled={adding || analyzing} className="sm:!w-auto" icon={adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
            {adding ? 'Добавляю…' : 'Отслеживать'}
          </AuroraButton>
          <AuroraButton variant="secondary" onClick={analyzeOnDemand} disabled={adding || analyzing} className="sm:!w-auto" icon={analyzing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {analyzing ? 'Разбираю…' : 'Разовый разбор'}
          </AuroraButton>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          «Отслеживать» — добавит канал в список с авто-обновлением раз в сутки (дельты «было→стало»). «Разовый разбор» — покажет все видео сейчас, без истории.
        </p>
        {error && <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}><XCircle size={16} className="mt-[2px]" /><span>{error}</span></div>}
        {note && <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><AlertCircle size={15} className="mt-[2px]" style={{ color: '#10b981' }} /><span>{note}</span></div>}
      </AuroraCard>

      {loadingList ? (
        <AuroraCard className="p-10 text-center"><Loader2 size={22} className="animate-spin mx-auto" style={{ color: 'var(--brand)' }} /></AuroraCard>
      ) : channels.length === 0 ? (
        <AuroraCard className="p-10 sm:p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}><Users size={26} style={{ color: 'var(--text-muted)' }} /></div>
          <p className="text-sm font-600" style={{ color: 'var(--text-secondary)' }}>Пока нет отслеживаемых каналов</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Вставьте ссылку выше и нажмите «Отслеживать» — начнём копить историю метрик.</p>
        </AuroraCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {channels.map((c) => (
            <AuroraCard key={c.id} className="p-4 flex flex-col gap-3">
              <button onClick={() => openDetail(c.id)} className="flex items-start gap-3 text-left">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
                  {c.avatarUrl ? <img src={coverSrc(c.avatarUrl)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    : <div className="w-full h-full flex items-center justify-center"><Users size={20} style={{ color: 'var(--text-muted)' }} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-700 truncate" style={{ color: 'var(--text-primary)' }}>{c.displayName || `@${c.handle}`}</span>
                    {c.verified && <BadgeCheck size={14} style={{ color: 'var(--brand)' }} />}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{PLATFORM_LABEL[c.platform] || c.platform} · {c.videosCount} видео</div>
                  <div className="text-sm font-600 mt-0.5" style={{ color: 'var(--text-secondary)' }}>{fmt(c.followers)} подписчиков<Delta cur={c.followers} prev={c.prevFollowers} /></div>
                </div>
              </button>
              {c.lastError && <div className="text-[11px] rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>Ошибка обновления: {c.lastError}</div>}
              <div className="flex items-center justify-between gap-2 mt-auto">
                <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Clock size={11} /> {ago(c.lastRefreshedAt)}</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => refreshChannel(c.id, false)} disabled={busyId === c.id} title="Обновить сейчас"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                  <button onClick={() => removeChannel(c)} disabled={busyId === c.id} title="Убрать из отслеживаемых"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </AuroraCard>
          ))}
        </div>
      )}
      {ConfirmEl}
    </div>
  );
}
