/**
 * TrendsPage — анализатор трендов (TikHub).
 *
 * Две вкладки: «Поиск трендов» (переиспользуемый TrendSearch) и «Аналитика по
 * ссылке» (TrendAnalyticsPanel). Поиск ведёт в аналитику по клику на карточке.
 * Тот же TrendSearch используется во вкладке «Social Media Extension».
 */

import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import TrendSearch from '../components/TrendSearch';
import TrendAnalyticsPanel from './TrendAnalyticsPanel';

export default function TrendsPage() {
  const { token } = useAppStore();
  const [view, setView] = useState<'trends' | 'analytics'>('trends');
  const [analyzeUrl, setAnalyzeUrl] = useState<string | null>(null);
  const [analyzeCover, setAnalyzeCover] = useState<string | null>(null);
  const [bulkItems, setBulkItems] = useState<{ url: string; cover?: string }[] | null>(null);

  const openAnalytics = (videoUrl: string, cover?: string | null) => {
    setAnalyzeUrl(videoUrl); setAnalyzeCover(cover || null); setBulkItems(null); setView('analytics');
  };
  const openAnalyticsBulk = (items: { url: string; cover?: string }[]) => {
    setBulkItems(items); setAnalyzeUrl(null); setView('analytics');
  };

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
            style={{ background: view === v ? 'var(--brand)' : 'transparent', color: view === v ? 'var(--brand-contrast)' : 'var(--text-muted)', boxShadow: view === v ? '0 2px 8px rgba(99,102,241,0.35)' : 'none' }}>
            {lbl}
          </button>
        ))}
      </div>

      {view === 'analytics' ? (
        <TrendAnalyticsPanel token={token} initialUrl={analyzeUrl} initialCover={analyzeCover} bulkItems={bulkItems} />
      ) : (
        <TrendSearch token={token} onAnalyze={openAnalytics} onAnalyzeBulk={openAnalyticsBulk} />
      )}
    </div>
  );
}
