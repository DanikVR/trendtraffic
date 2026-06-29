/**
 * ChannelsPage — «Каналы» (Фаза 1): вставляешь ссылку на канал/профиль
 * (TikTok / Instagram / YouTube) → backend тянет профиль и ВСЕ видео канала
 * (постранично) → показываем шапку канала + ленту видео с текущими метриками.
 *
 * Фаза 2 (история/дельты «было→стало», watchlist + ночной снимок) — отдельно:
 * рядом с метриками появятся дельты, добавится кнопка «Отслеживать» и список
 * отслеживаемых каналов с авто-обновлением.
 */

import React, { useState } from 'react';
import {
  Users, Search, Loader2, ExternalLink, Eye, Heart, MessageCircle, Share2,
  Play, BadgeCheck, AlertCircle, XCircle, Film, TrendingUp,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';

interface ChannelProfile {
  platform: 'tiktok' | 'instagram' | 'youtube';
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  followers?: number;
  verified?: boolean;
  url?: string;
}
interface ChannelVideo {
  externalId: string;
  platform: string;
  author: string;
  authorName?: string;
  description?: string;
  coverUrl?: string;
  webUrl?: string;
  durationSec?: number;
  createTime?: number;
  stats: { play?: number; like?: number; comment?: number; share?: number };
}
interface ChannelAnalysis {
  profile: ChannelProfile;
  videos: ChannelVideo[];
  count: number;
  hasMore: boolean;
  pagesFetched: number;
  note?: string;
}

const PLATFORM_LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' };

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
function friendlyError(e: any, fallback: string): string {
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Сервер недоступен. Проверьте, что backend запущен, и обновите страницу.';
  }
  return msg || fallback;
}

export default function ChannelsPage() {
  const { token } = useAppStore();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ChannelAnalysis | null>(null);

  const analyze = async () => {
    const v = url.trim();
    if (!v) { setData(null); setError('Вставьте ссылку на канал.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/channels/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: v, maxVideos: 200 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setData(d as ChannelAnalysis);
    } catch (e: any) {
      setError(friendlyError(e, 'Не удалось проанализировать канал'));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Агрегаты по каналу (по загруженным видео).
  const agg = data ? data.videos.reduce(
    (a, v) => {
      a.views += v.stats.play || 0; a.likes += v.stats.like || 0;
      a.comments += v.stats.comment || 0; a.shares += v.stats.share || 0;
      return a;
    },
    { views: 0, likes: 0, comments: 0, shares: 0 }
  ) : null;
  const avgEr = agg && agg.views > 0
    ? Number((((agg.likes + agg.comments + agg.shares) / agg.views) * 100).toFixed(2))
    : undefined;

  return (
    <div className="max-w-6xl mx-auto py-5 sm:py-6 px-3 sm:px-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
          <Users size={20} color="#fff" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-700 leading-tight" style={{ color: 'var(--text-primary)' }}>Каналы</h1>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
            Вставьте ссылку на канал — соберём все его видео и метрики. История и дельты «было→стало» — скоро.
          </p>
        </div>
      </div>

      {/* Поиск канала */}
      <AuroraCard className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') analyze(); }}
              placeholder="tiktok.com/@user  ·  instagram.com/user  ·  youtube.com/channel/UC…"
              className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 transition-shadow"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
            />
          </div>
          <AuroraButton onClick={analyze} disabled={loading} fullWidth className="sm:!w-auto"
            icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {loading ? 'Собираю…' : 'Анализировать'}
          </AuroraButton>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Поддержка: TikTok, Instagram, YouTube. До 200 видео за раз.
        </p>
        {error && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <XCircle size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
          </div>
        )}
      </AuroraCard>

      {/* Результат */}
      {data && data.profile && (
        <>
          {/* Шапка канала + агрегаты */}
          <AuroraCard className="p-4 sm:p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
                {data.profile.avatarUrl ? (
                  <img src={data.profile.avatarUrl} alt="" referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Users size={26} style={{ color: 'var(--text-muted)' }} /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>
                    {data.profile.displayName || `@${data.profile.handle}`}
                  </span>
                  {data.profile.verified && <BadgeCheck size={16} style={{ color: 'var(--brand)' }} />}
                  <span className="text-[11px] font-600 px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                    {PLATFORM_LABEL[data.profile.platform] || data.profile.platform}
                  </span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>@{(data.profile.handle || '').replace(/^@/, '')}</div>
                {data.profile.followers != null && (
                  <div className="text-sm font-600 mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {fmt(data.profile.followers)} подписчиков
                  </div>
                )}
                {data.profile.bio && <p className="text-[12px] mt-1.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>{data.profile.bio}</p>}
                {data.profile.url && (
                  <a href={data.profile.url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-600 mt-2" style={{ color: 'var(--brand)' }}>
                    <ExternalLink size={12} /> Открыть канал
                  </a>
                )}
              </div>
            </div>

            {/* Агрегаты по загруженным видео (показываем только если видео есть) */}
            {data.count > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-4">
              {([
                ['Видео', String(data.count), <Film size={15} key="f" />],
                ['Сумма просмотров', fmt(agg!.views), <Eye size={15} key="e" />],
                ['Сумма лайков', fmt(agg!.likes), <Heart size={15} key="h" />],
                ['Сумма комментариев', fmt(agg!.comments), <MessageCircle size={15} key="c" />],
                ['Средний ER', avgEr != null ? `${avgEr}%` : '—', <TrendingUp size={15} key="t" />],
              ] as [string, string, React.ReactNode][]).map(([label, val, icon]) => (
                <div key={label} className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{icon}{label}</div>
                  <div className="text-lg font-800 mt-0.5" style={{ color: 'var(--text-primary)' }}>{val}</div>
                </div>
              ))}
            </div>
            )}

            {data.note && (
              <div className="flex items-start gap-2 text-[12px] rounded-xl p-3 mt-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                <AlertCircle size={14} className="mt-[2px] flex-shrink-0" style={{ color: '#f59e0b' }} /><span>{data.note}</span>
              </div>
            )}
            {data.hasMore && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                Показаны первые {data.count} видео (на канале есть ещё — лимит за один разбор).
              </p>
            )}
          </AuroraCard>

          {/* Лента видео */}
          {data.videos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {data.videos.map((v) => (
                <AuroraCard key={v.externalId} className="group p-0 overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative w-full" style={{ aspectRatio: '9 / 16', background: 'var(--bg-tertiary)' }}>
                    {v.coverUrl ? (
                      <img src={v.coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Play size={26} style={{ color: 'var(--text-muted)' }} /></div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-14 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
                    {v.webUrl && (
                      <a href={v.webUrl} target="_blank" rel="noreferrer"
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.28)' }} title="Открыть оригинал">
                        <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(4px)' }}>
                          <Play size={22} color="#fff" fill="#fff" />
                        </span>
                      </a>
                    )}
                    <span className="absolute bottom-2 left-2 text-[11px] font-700 inline-flex items-center gap-1 z-10"
                      style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                      <Eye size={12} /> {fmt(v.stats.play)}
                    </span>
                    {dur(v.durationSec) && (
                      <span className="absolute bottom-2 right-2 text-[11px] px-1.5 py-0.5 rounded font-600 z-10"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{dur(v.durationSec)}</span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    {v.description && (
                      <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{v.description}</p>
                    )}
                    <div className="flex items-center gap-2.5 text-[11px] flex-wrap mt-auto" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(v.stats.like)}</span>
                      <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} /> {fmt(v.stats.comment)}</span>
                      <span className="inline-flex items-center gap-0.5"><Share2 size={11} /> {fmt(v.stats.share)}</span>
                    </div>
                  </div>
                </AuroraCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* Пустое состояние */}
      {!data && !loading && !error && (
        <AuroraCard className="p-10 sm:p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
            <Users size={26} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-sm font-600" style={{ color: 'var(--text-secondary)' }}>Вставьте ссылку на канал</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            TikTok, Instagram или YouTube — соберём все видео канала с метриками.
          </p>
        </AuroraCard>
      )}
    </div>
  );
}
