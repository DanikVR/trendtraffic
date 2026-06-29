/**
 * PaywallModal — модал «оформите тариф / докупите минут» при попытке создать комнату без баланса.
 *
 * Поведение:
 *  - Три карточки тарифов (Plus / Standard / Standard Yearly) с кнопками «Оформить».
 *  - Слайдер докупки минут (60–600) с live-расчётом стоимости через /api/billing/topup-preview.
 *  - Если активной подписки нет — preview показывает «+ авто-Plus» и breakdown.
 *  - По клику на любую кнопку оплаты → редирект на Stripe Checkout.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, Check, Sparkles, Zap, Crown } from 'lucide-react';
import { AuroraCard } from './AuroraCard';
import { VibeVoxIcon } from './VibeVoxIcon';
import { useAppStore } from '../store/useAppStore';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  /** Заголовок (например, «Чтобы создать комнату, оформите тариф»). */
  title?: string;
  /** Куда возвращать пользователя после Stripe — обычно текущая страница. */
  returnUrl?: string;
}

interface TierCard {
  tier: 'plus' | 'standard' | 'standard_yearly';
  name: string;
  priceLabel: string;
  perMonth: string;
  minutes: number;
  color: string;
  bg: string;
  icon: React.ReactNode;
  highlight?: boolean;
  badge?: string;
}

// TIERS — раскрашенные карточки тарифов. perMonth/badge берутся из i18n через
// useTiers() ниже, чтобы при смене языка обновлялись.
function useTiers(t: (k: string) => string): TierCard[] {
  return [
    {
      tier: 'plus', name: 'Plus', priceLabel: '€19', perMonth: t('paywall.perMonth'),
      minutes: 60, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.10)',
      icon: <Sparkles size={16} />,
    },
    {
      tier: 'standard', name: 'Standard', priceLabel: '€29', perMonth: t('paywall.perMonth'),
      minutes: 120, color: '#10b981', bg: 'rgba(16, 185, 129, 0.10)',
      icon: <Zap size={16} />, highlight: true, badge: t('paywall.popular'),
    },
    {
      tier: 'standard_yearly', name: 'Standard Yearly', priceLabel: '€289',
      perMonth: t('paywall.perYearDiscount'),
      minutes: 1440, color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.10)',
      icon: <Crown size={16} />, badge: '−17%',
    },
  ];
}

interface Preview {
  needsSubscription: boolean;
  subscriptionTier: string | null;
  subscriptionMinutes: number;
  subscriptionPriceCents: number;
  topupMinutes: number;
  topupPriceCents: number;
  totalPriceCents: number;
  freeMinutesFromSubscription: number;
  currency: string;
  summary: string;
}

export function PaywallModal({ open, onClose, title, returnUrl }: PaywallModalProps) {
  const { t } = useTranslation('common');
  const TIERS = useTiers(t);
  const { token } = useAppStore();
  const [topupMinutes, setTopupMinutes] = useState(60);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submittingTier, setSubmittingTier] = useState<string | null>(null);
  const [submittingTopup, setSubmittingTopup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  });

  // Live-preview каждые 250 мс при изменении minutes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/billing/topup-preview', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ minutes: topupMinutes }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setPreview(data);
          setError(null);
        } else {
          setError(data.error || t('paywall.previewFailed'));
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || t('paywall.networkError'));
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topupMinutes, open]);

  // Lock body scroll — ВАЖНО: useEffect должен быть до early return,
  // чтобы количество hooks между рендерами не менялось (Rules of Hooks).
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const handleSubscribe = async (tier: TierCard['tier']) => {
    setSubmittingTier(tier);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ tier, currency: 'eur' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (e: any) {
      setError(e.message || t('paywall.checkoutFailed'));
    } finally {
      setSubmittingTier(null);
    }
  };

  const handleBuyTopup = async () => {
    setSubmittingTopup(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          minutes: topupMinutes,
          currency: 'eur',
          returnUrl: returnUrl || window.location.href,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (e: any) {
      setError(e.message || t('paywall.checkoutFailed'));
    } finally {
      setSubmittingTopup(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl mx-4 my-4 sm:my-8"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* AuroraCard сам padding не задаёт — добавляем p-5/p-6 для контента модала. */}
        <AuroraCard className="p-5 sm:p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-3">
              <VibeVoxIcon size={40} />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-700" style={{ color: 'var(--text-primary)' }}>
                  {title || t('paywall.titleNoSub')}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('paywall.subtitle')}
                </p>
              </div>
              <button type="button" onClick={onClose}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)] flex-shrink-0">
                <X size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {error && (
              <div className="text-xs px-3 py-2 rounded-xl"
                   style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                {error}
              </div>
            )}

            {/* Тарифы */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIERS.map(tier => (
                <div
                  key={tier.tier}
                  className="relative rounded-2xl p-4 flex flex-col gap-3 transition-all"
                  style={{
                    background: tier.bg,
                    border: `1px solid ${tier.color}30`,
                  }}
                >
                  {tier.badge && (
                    <span className="absolute -top-2 right-3 text-[10px] font-700 px-2 py-0.5 rounded-full"
                          style={{ background: tier.color, color: '#fff' }}>
                      {tier.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                         style={{ background: tier.color, color: '#fff' }}>
                      {tier.icon}
                    </div>
                    <h3 className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{tier.name}</h3>
                  </div>
                  <div>
                    <div className="text-2xl font-700 tabular-nums" style={{ color: tier.color }}>{tier.priceLabel}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{tier.perMonth}</div>
                  </div>
                  <ul className="text-xs space-y-1.5 flex-1" style={{ color: 'var(--text-secondary)' }}>
                    <li className="flex items-center gap-1.5"><Check size={12} color={tier.color} /> {t('paywall.featureMinutes', { count: tier.minutes })}</li>
                    <li className="flex items-center gap-1.5"><Check size={12} color={tier.color} /> {t('paywall.feature100Languages')}</li>
                    <li className="flex items-center gap-1.5"><Check size={12} color={tier.color} /> {t('paywall.featureHd')}</li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleSubscribe(tier.tier)}
                    disabled={submittingTier !== null}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-700 transition-all disabled:opacity-50"
                    style={{
                      background: tier.color,
                      color: '#fff',
                      boxShadow: `0 4px 14px ${tier.color}40`,
                    }}>
                    {submittingTier === tier.tier ? <Loader2 size={14} className="animate-spin" /> : <span>{t('paywall.subscribe')}</span>}
                  </button>
                </div>
              ))}
            </div>

            {/* Разделитель */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
              <span className="text-[11px] uppercase font-600 tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('paywall.or')}</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            </div>

            {/* Top-up слайдер */}
            <div className="rounded-2xl p-4 space-y-4"
                 style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{t('paywall.topupTitle')}</h3>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('paywall.topupPerMin')}</div>
              </div>

              <div>
                <input
                  type="range"
                  min={60}
                  max={600}
                  step={30}
                  value={topupMinutes}
                  onChange={(e) => setTopupMinutes(parseInt(e.target.value, 10))}
                  className="w-full"
                  style={{ accentColor: 'var(--brand)' }}
                />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span>60 мин</span>
                  <span>600 мин</span>
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {[60, 120, 300, 600].map(v => (
                  <button key={v} type="button"
                          onClick={() => setTopupMinutes(v)}
                          className="text-xs px-2.5 py-1 rounded-lg font-600 transition-all"
                          style={{
                            background: topupMinutes === v ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-secondary)',
                            border: `1px solid ${topupMinutes === v ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                            color: topupMinutes === v ? 'var(--brand)' : 'var(--text-secondary)',
                          }}>
                    {t('balance.minutes', { count: v })}
                  </button>
                ))}
              </div>

              <div className="text-center py-1">
                <div className="text-3xl font-700 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {t('balance.minutes', { count: topupMinutes })}
                </div>
              </div>

              {/* Breakdown */}
              {previewLoading && !preview && (
                <div className="text-center text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 size={12} className="animate-spin inline-block mr-1" /> {t('paywall.topupCalcLoading')}
                </div>
              )}
              {preview && (
                <div className="space-y-2">
                  {preview.needsSubscription && (
                    <div className="text-xs px-3 py-2 rounded-xl"
                         style={{ background: 'rgba(34, 211, 238, 0.10)', border: '1px solid rgba(34, 211, 238, 0.3)', color: '#22d3ee' }}>
                      {t('paywall.topupNoSubInfo')}
                    </div>
                  )}
                  <div className="space-y-1.5 text-sm">
                    {preview.needsSubscription && (
                      <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span>{t('paywall.topupPlusLine', { count: preview.subscriptionMinutes })}</span>
                        <span className="tabular-nums font-600">€{(preview.subscriptionPriceCents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    {preview.freeMinutesFromSubscription > 0 && (
                      <div className="flex justify-between text-xs" style={{ color: '#10b981' }}>
                        <span>{t('paywall.topupFreeLine', { count: preview.freeMinutesFromSubscription })}</span>
                        <span className="tabular-nums">−€0.00</span>
                      </div>
                    )}
                    {preview.topupMinutes > 0 && (
                      <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                        <span>{t('paywall.topupAddon', { count: preview.topupMinutes })}</span>
                        <span className="tabular-nums font-600">€{(preview.topupPriceCents / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="h-px my-1" style={{ background: 'var(--border-subtle)' }} />
                    <div className="flex justify-between text-base">
                      <span className="font-700" style={{ color: 'var(--text-primary)' }}>{t('paywall.total')}</span>
                      <span className="font-700 tabular-nums" style={{ color: 'var(--brand)' }}>
                        €{(preview.totalPriceCents / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleBuyTopup}
                disabled={submittingTopup || !preview}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-700 transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                }}>
                {submittingTopup
                  ? <Loader2 size={16} className="animate-spin" />
                  : <span>{t('paywall.topupBuyButton', { price: preview ? (preview.totalPriceCents / 100).toFixed(2) : '—' })}</span>
                }
              </button>
            </div>

            <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
              {t('paywall.stripeNote')}
            </p>
          </div>
        </AuroraCard>
      </div>
    </div>
  );
}
