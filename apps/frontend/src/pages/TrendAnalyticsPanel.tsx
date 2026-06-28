/**
 * TrendAnalyticsPanel — «Аналитика по ссылке» (порт расширения TikHub в веб).
 *
 * Вставляешь ссылку на видео/пост или аккаунт (TikTok/Douyin/Instagram/X/Bilibili)
 * → backend (/api/trends/analyze) дёргает TikHub НАШИМ ключом → показываем сводку
 * (просмотры/лайки/комменты/шеры + ER), статусы вызовов и сырые данные с экспортом JSON.
 */

import React, { useState } from 'react';
import { Link2, Loader2, Search, Download, CheckCircle2, XCircle, Eye, Heart, MessageCircle, Share2, Users, BarChart3, ChevronDown } from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';

interface Block { ok: boolean; error?: string; data?: any; }
interface AnalyzeResult {
  detected: { platform: string; platformLabel: string; type: 'video' | 'account'; videoId?: string; username?: string };
  blocks: Record<string, Block>;
  summary: Record<string, any>;
}

function fmt(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

const BLOCK_LABEL: Record<string, string> = {
  video: 'Видео / пост', metrics: 'Метрики', comments: 'Комментарии',
  commentKeywords: 'Ключевые слова', account: 'Аккаунт', posts: 'Лента публикаций',
};

export default function TrendAnalyticsPanel({ token }: { token: string | null }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [openRaw, setOpenRaw] = useState<Record<string, boolean>>({});

  const analyze = async () => {
    if (!url.trim()) { setError('Вставьте ссылку на видео/пост или аккаунт.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/trends/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e: any) {
      setError(e instanceof TypeError ? 'Сервер недоступен. Обновите страницу.' : (e?.message || 'Ошибка анализа'));
    } finally { setLoading(false); }
  };

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics-${result.detected.platform}-${result.detected.videoId || result.detected.username || 'data'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const s = result?.summary || {};
  const stat = (icon: React.ReactNode, label: string, val?: number) => (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)' }}>
      <div className="flex items-center gap-1.5 text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{icon} {label}</div>
      <div className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{fmt(val)}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <AuroraCard className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <Link2 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') analyze(); }}
              placeholder="Ссылка: TikTok / Douyin / Instagram / X / Bilibili — видео или аккаунт"
              className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7300]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </div>
          <AuroraButton onClick={analyze} disabled={loading} fullWidth className="sm:!w-auto"
            icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {loading ? 'Анализирую…' : 'Анализировать'}
          </AuroraButton>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Метрики видео, комментарии, профиль и история публикаций — через ваш ключ Trend. Каждый анализ тратит кредиты TikHub.
        </p>
        {error && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <XCircle size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
          </div>
        )}
      </AuroraCard>

      {result && (
        <>
          {/* Распознано */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-700 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,115,0,0.12)', color: '#ff7300' }}>
              {result.detected.platformLabel}
            </span>
            <span className="text-[12px] px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {result.detected.type === 'video' ? 'Видео / пост' : 'Аккаунт'}
            </span>
            {s.author && <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>· {String(s.author)}</span>}
            <div className="flex-1" />
            <AuroraButton variant="secondary" onClick={exportJson} icon={<Download size={15} />}>Скачать JSON</AuroraButton>
          </div>

          {/* Сводка */}
          {s.desc && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{String(s.desc)}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {stat(<Eye size={12} />, 'Просмотры', s.views)}
            {stat(<Heart size={12} />, 'Лайки', s.likes)}
            {stat(<MessageCircle size={12} />, 'Комменты', s.comments)}
            {stat(<Share2 size={12} />, 'Шеры', s.shares)}
            {result.detected.type === 'account'
              ? stat(<Users size={12} />, 'Подписчики', s.followers)
              : (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-1.5 text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}><BarChart3 size={12} /> Вовлечённость</div>
                  <div className="text-lg font-700" style={{ color: '#10b981' }}>{s.engagementRate != null ? `${s.engagementRate}%` : '—'}</div>
                </div>
              )}
          </div>

          {/* Блоки (статус + сырые данные) */}
          <div className="space-y-2">
            {Object.entries(result.blocks).map(([key, b]) => (
              <AuroraCard key={key} className="p-0 overflow-hidden">
                <button onClick={() => setOpenRaw((o) => ({ ...o, [key]: !o[key] }))}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  {b.ok ? <CheckCircle2 size={15} style={{ color: '#10b981' }} /> : <XCircle size={15} style={{ color: '#ef4444' }} />}
                  <span className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{BLOCK_LABEL[key] || key}</span>
                  {!b.ok && <span className="text-[11px]" style={{ color: '#ef4444' }}>{b.error}</span>}
                  <div className="flex-1" />
                  <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: openRaw[key] ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {openRaw[key] && b.data != null && (
                  <pre className="text-[11px] px-4 pb-3 overflow-auto" style={{ maxHeight: 320, color: 'var(--text-secondary)' }}>
                    {JSON.stringify(b.data, null, 2)}
                  </pre>
                )}
              </AuroraCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
