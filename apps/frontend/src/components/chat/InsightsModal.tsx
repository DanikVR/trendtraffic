/**
 * InsightsModal — модал с результатом анализа диалога.
 * Открывается по кнопке «Анализ» на странице чата Enterprise-комнаты.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, BarChart3, Tag, Smile, Frown, Meh, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { VibeVoxIcon } from '../VibeVoxIcon';
import { useAppStore } from '../../store/useAppStore';

interface InsightsModalProps {
  roomId: string;
  open: boolean;
  onClose: () => void;
}

interface Insights {
  sentiment?: { label: 'positive' | 'neutral' | 'negative'; score: number; reason: string };
  engagement?: { score: number; reason: string };
  tags?: string[];
  leadScore?: { score: number; stage: 'cold' | 'warm' | 'hot' | 'qualified'; reason: string };
  summary?: string;
  nextSteps?: string[];
}

export function InsightsModal({ roomId, open, onClose }: InsightsModalProps) {
  const { t } = useTranslation('common');
  const { token } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [lineCount, setLineCount] = useState(0);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const runAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/insights/analyze/${roomId}`, {
        method: 'POST',
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setInsights(data.insights);
      setLineCount(data.lineCount || 0);
    } catch (e: any) {
      setError(e?.message || t('insights.errorTitle'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !insights && !loading) {
      runAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
         onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl"
           style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}
           onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3 border-b flex items-center justify-between gap-3"
             style={{ borderColor: 'var(--border-medium)' }}>
          <div className="flex items-center gap-2">
            <VibeVoxIcon size={32} />
            <h2 className="text-base font-700" style={{ color: 'var(--text-primary)' }}>
              {t('insights.title')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={runAnalyze} disabled={loading}
                    className="px-3 py-1.5 rounded-xl text-xs font-700 flex items-center gap-1.5 transition-colors"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {t('insights.recalc')}
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && !insights && (
            <div className="py-12 text-center">
              <Loader2 size={28} className="animate-spin inline-block" style={{ color: '#8B5CF6' }} />
              <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
                {t('insights.thinking')}
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl flex items-start gap-2"
                 style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)' }}>
              <AlertCircle size={14} color="#ef4444" className="mt-[2px]" />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</span>
            </div>
          )}

          {insights && !loading && (
            <>
              {/* Summary */}
              {insights.summary && (
                <Card title={t('insights.summary')}>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {insights.summary}
                  </p>
                </Card>
              )}

              {/* Sentiment + Engagement + Lead Score */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {insights.sentiment && (
                  <MiniCard
                    icon={
                      insights.sentiment.label === 'positive' ? <Smile size={14} color="#10b981" /> :
                      insights.sentiment.label === 'negative' ? <Frown size={14} color="#ef4444" /> :
                      <Meh size={14} color="#94a3b8" />
                    }
                    label={t('insights.sentiment')}
                    value={`${insights.sentiment.score}%`}
                    sub={t(`insights.sentimentValues.${insights.sentiment.label}`)}
                    color={
                      insights.sentiment.label === 'positive' ? '#10b981' :
                      insights.sentiment.label === 'negative' ? '#ef4444' : '#94a3b8'
                    }
                    tooltip={insights.sentiment.reason}
                  />
                )}
                {insights.engagement && (
                  <MiniCard
                    icon={<TrendingUp size={14} color="#22d3ee" />}
                    label={t('insights.engagement')}
                    value={`${insights.engagement.score}%`}
                    color="#22d3ee"
                    tooltip={insights.engagement.reason}
                  />
                )}
                {insights.leadScore && (
                  <MiniCard
                    icon={<BarChart3 size={14} color="#f59e0b" />}
                    label={t('insights.leadScore')}
                    value={`${insights.leadScore.score}%`}
                    sub={insights.leadScore.stage === 'qualified' ? insights.leadScore.stage : t(`insights.leadValues.${insights.leadScore.stage}`)}
                    color="#f59e0b"
                    tooltip={insights.leadScore.reason}
                  />
                )}
              </div>

              {/* Tags */}
              {insights.tags && insights.tags.length > 0 && (
                <Card title={t('insights.topics')}>
                  <div className="flex flex-wrap gap-1.5">
                    {insights.tags.map((t, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full font-600"
                            style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                        <Tag size={9} className="inline mr-1" />
                        {t}
                      </span>
                    ))}
                  </div>
                </Card>
              )}

              {/* Next steps */}
              {insights.nextSteps && insights.nextSteps.length > 0 && (
                <Card title={t('insights.nextSteps')}>
                  <ul className="space-y-1.5">
                    {insights.nextSteps.map((s, i) => (
                      <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-primary)' }}>
                        <span className="text-[10px] mt-[5px]" style={{ color: '#8B5CF6' }}>●</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <p className="text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                {t('insights.analyzedReplies', { count: lineCount })}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3"
         style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
      <h3 className="text-[10px] font-700 uppercase tracking-wider mb-2"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function MiniCard({ icon, label, value, sub, color, tooltip }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="rounded-xl p-3"
         style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}
         title={tooltip}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-700 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <div className="text-xl font-700 tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] uppercase font-600 mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default InsightsModal;
