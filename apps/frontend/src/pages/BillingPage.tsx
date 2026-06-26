/**
 * BillingPage — страница тарифов и баланса.
 *
 * Три тарифа: Plus (€19/мес), Standard (€29/мес или €289/год -17%), Enterprise (контакт).
 * Без бесплатного Trial. Кнопки оплаты ведут на Stripe Checkout (этап 4).
 *
 * Все иконки — lucide-react (без эмодзи в UI, согласно директиве).
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check, ArrowRight, Crown, Zap, Building2, Globe, Mic, Video, Phone,
  Sparkles, Languages, BarChart3, MessageSquare,
  Calendar, Tags, Database, Settings, Send, FileText, Loader2, Search, X,
  Ban, RotateCcw, Infinity as InfinityIcon,
} from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { SUPPORTED_LANGUAGES } from '../components/LanguagePicker';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../components/Toast';

// ─────────────────────────────────────────────
// Тарифные планы (финальные цены)
// ─────────────────────────────────────────────
interface PlanFeature {
  icon: React.ReactNode;
  text: string;
  highlight?: boolean;
  /** Отдельная крупная строка-акцент (∞+видео = безлимитные видеозвонки). Без текста — не требует перевода. */
  standout?: boolean;
}

interface Plan {
  id: 'plus' | 'standard' | 'enterprise';
  name: string;
  priceMonthly: number;   // EUR
  priceYearly?: number;   // EUR за год (для Standard)
  priceLabel: string;
  minutes: string;
  pricePerMinute: string;
  description: string;
  features: PlanFeature[];
  ctaLabel: string;
  highlighted?: boolean;
  contactOnly?: boolean;
}

// ═══════════════════════════════════════════════
// TOPUP CALCULATOR — отдельный компонент со слайдером
// ═══════════════════════════════════════════════
const PRICE_PER_MIN_EUR = 0.17;
const MIN_TOPUP = 60;
const MAX_TOPUP = 600;
const TOPUP_STEP = 30;

/**
 * Бейдж языка в списке на странице тарифов.
 * Для стран в данных стоит флаг-эмодзи (на Windows он рендерится как аккуратный
 * 2-буквенный код RU/GB, на macOS/мобильных — как флажок) — его и показываем.
 * Для языков без своей страны (Esperanto, Hmong, Basque, Catalan, Welsh, Scots
 * Gaelic, Latin…) в данных стоят «странные» fallback-эмодзи 🌐/🏴/🏛️ — вместо них
 * показываем 2-буквенный код языка (EO, HMN, EU…), чтобы список был однородным.
 */
function isCountryFlag(flag: string): boolean {
  const cp = flag.codePointAt(0) ?? 0;
  return cp >= 0x1f1e6 && cp <= 0x1f1ff; // диапазон regional indicator symbols (🇦…🇿)
}

interface TopupCalculatorProps {
  token: string | null;
  promotionCodeId?: string | null;
  promoCode?: string | null;
  promoPercentOff?: number | null;
}

function TopupCalculator({ token, promotionCodeId, promoCode, promoPercentOff }: TopupCalculatorProps) {
  const { t } = useTranslation('common');
  const [minutes, setMinutes] = useState<number>(60);
  const [busy, setBusy] = useState(false);
  const baseTotal = minutes * PRICE_PER_MIN_EUR;
  const discountedTotal = promotionCodeId && promoPercentOff ? baseTotal * (1 - promoPercentOff / 100) : baseTotal;
  const totalEur = discountedTotal.toFixed(2);
  const baseTotalLabel = baseTotal.toFixed(2);
  const hasDiscount = !!(promotionCodeId && promoPercentOff);

  const handleBuy = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          minutes,
          currency: 'eur',
          ...(promotionCodeId ? { promotionCodeId } : {}),
        }),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(t('billingPage.checkoutNoUrl'));
      }
    } catch (err: any) {
      showToast(t('billingPage.checkoutFailed', { error: err.message || err }), 'error');
      setBusy(false);
    }
  };

  return (
    <AuroraCard className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'rgba(245,158,11,0.10)', color: '#FBBF24' }}>
          <Zap size={18} strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
            {t('billingPage.topupTitle')}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('billingPage.topupDescription')}
          </p>
        </div>
      </div>

      {/* Slider */}
      <div className="mb-4">
        <div className="flex justify-between mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{t('balance.minutes', { count: MIN_TOPUP })}</span>
          <span>{t('billingPage.topupSliderMax', { max: MAX_TOPUP })}</span>
        </div>
        <input
          type="range"
          min={MIN_TOPUP}
          max={MAX_TOPUP}
          step={TOPUP_STEP}
          value={minutes}
          onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #10B981 0%, #10B981 ${((minutes - MIN_TOPUP) / (MAX_TOPUP - MIN_TOPUP)) * 100}%, rgba(255,255,255,0.08) ${((minutes - MIN_TOPUP) / (MAX_TOPUP - MIN_TOPUP)) * 100}%, rgba(255,255,255,0.08) 100%)`,
          }}
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {[60, 120, 300, 600].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setMinutes(preset)}
              className="px-2.5 py-1 rounded-full text-[11px] font-600 transition-all"
              style={{
                background: minutes === preset ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${minutes === preset ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: minutes === preset ? '#34D399' : 'var(--text-muted)',
              }}
            >
              {preset >= 60 ? t('billingPage.presetHours', { count: preset / 60 }) : t('billingPage.presetMinutes', { count: preset })} ({t('balance.minutes', { count: preset })})
            </button>
          ))}
        </div>
      </div>

      {/* Итог + кнопка */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <p className="text-3xl font-800"
               style={{
                 fontFamily: 'Space Grotesk, sans-serif',
                 color: hasDiscount ? '#10b981' : 'var(--text-primary)',
                 letterSpacing: '-0.03em',
               }}>
              €{totalEur}
            </p>
            {hasDiscount && (
              <span className="text-sm font-600 line-through"
                    style={{ color: 'var(--text-disabled)', fontFamily: 'Space Grotesk, sans-serif' }}>
                €{baseTotalLabel}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('billingPage.minutesTimesPrice', { count: minutes, price: PRICE_PER_MIN_EUR.toFixed(2) })}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-1">
          <AuroraButton
            onClick={handleBuy}
            disabled={busy}
            icon={busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={2} />}
            id="topup-buy"
          >
            {busy ? t('billingPage.stripeOpening') : t('billingPage.buyNMinutes', { count: minutes })}
          </AuroraButton>
          {hasDiscount && promoCode && (
            <p className="text-[10.5px] sm:text-[11px] text-center font-600 leading-tight px-1 break-words"
               style={{ color: '#34D399' }}>
              {t('billingPage.discountWithPromo', { percent: promoPercentOff, code: promoCode })}
            </p>
          )}
        </div>
      </div>
    </AuroraCard>
  );
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════
export function BillingPage() {
  const { t } = useTranslation('common');
  const [annual, setAnnual] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [langSearch, setLangSearch] = useState('');
  const { translationBalance, subscriptionTier, subscriptionTierName, token, refreshBilling } = useAppStore();
  const balanceMin = Math.floor((translationBalance || 0) / 60);

  /** v0.9.5: дружелюбные названия тарифов из БД для отображения. */
  const TIER_DISPLAY_LABELS: Record<string, string> = useMemo(() => ({
    plus: t('tier.plus'),
    standard: t('tier.standard'),
    standard_yearly: t('tier.standardYearly'),
    enterprise: t('tier.enterprise'),
    trial: t('tier.trial'),
    monthly: t('tier.plus'),                 // legacy
    annual: t('tier.standardYearly'),        // legacy
  }), [t]);

  /** Тарифные планы — построены через t() так, чтобы они переразвязывались при смене языка. */
  const PLANS: Plan[] = useMemo(() => ([
    {
      id: 'plus',
      name: t('billingPage.tierPlusName'),
      priceMonthly: 19,
      priceLabel: '€19',
      minutes: t('billingPage.tierPlusMinutes'),
      pricePerMinute: t('billingPage.tierPlusPrice'),
      description: t('billingPage.tierPlusSummary'),
      features: [
        { icon: <Globe size={14} />,     text: t('billingPage.feature100Languages') },
        { icon: <Mic size={14} />,       text: t('billingPage.featureHd') },
        { icon: <Video size={14} />,     text: t('billingPage.featureRooms') },
        { icon: <Sparkles size={14} />,  text: t('billingPage.featureCoach') },
        { icon: <FileText size={14} />,  text: t('billingPage.featureLiveSubs') },
        { icon: <Phone size={14} />,     text: t('billingPage.featureSip') },
        { icon: <Languages size={14} />, text: t('billingPage.featureLearnHub') },
      ],
      ctaLabel: t('billingPage.ctaSubscribePlus'),
    },
    {
      id: 'standard',
      name: t('billingPage.tierStandardName'),
      priceMonthly: 29,
      priceYearly: 289,
      priceLabel: '€29',
      minutes: t('billingPage.tierStandardMinutes'),
      pricePerMinute: t('billingPage.tierStandardPrice'),
      description: t('billingPage.tierStandardSummary'),
      features: [
        { icon: <Check size={14} />,        text: t('billingPage.featureAllPlus'), highlight: true },
        { icon: <BarChart3 size={14} />,    text: t('billingPage.featureAdvAnalytics') },
        { icon: <ArrowRight size={14} />,   text: t('billingPage.featureRollover') },
      ],
      ctaLabel: t('billingPage.ctaSubscribeStandard'),
      highlighted: true,
    },
    {
      id: 'enterprise',
      name: t('billingPage.tierEnterpriseName'),
      priceMonthly: 0,
      priceLabel: t('billingPage.ctaContact'),
      minutes: t('billingPage.tierEnterpriseLabel'),
      pricePerMinute: t('billingPage.tierEnterprisePrice'),
      description: t('billingPage.tierEnterpriseSummary'),
      features: [
        { icon: <Check size={14} />,         text: t('billingPage.featureAllStandard'), highlight: true },
        { icon: (<><InfinityIcon size={22} strokeWidth={2.5} /><Video size={22} strokeWidth={2} /></>), text: '', standout: true },
        { icon: <Database size={14} />,      text: t('billingPage.featureCRM') },
        { icon: <MessageSquare size={14} />, text: t('billingPage.featureTelegramAuth') },
        { icon: <Settings size={14} />,      text: t('billingPage.featurePersonalPrompts') },
        { icon: <Tags size={14} />,          text: t('billingPage.featureSmartTags') },
        { icon: <Send size={14} />,          text: t('billingPage.featureCRMExport') },
        { icon: <Building2 size={14} />,     text: t('billingPage.featureQuestFlow') },
      ],
      ctaLabel: t('billingPage.ctaContactWhatsApp'),
      contactOnly: true,
    },
  ]), [t]);

  const tierDisplay = subscriptionTierName
    ? (TIER_DISPLAY_LABELS[subscriptionTierName] || subscriptionTierName)
    : (subscriptionTier ? (TIER_DISPLAY_LABELS[subscriptionTier] || subscriptionTier) : t('billingPage.billingNotActive'));

  // v0.9.5: отмена/возобновление Stripe-подписки самим пользователем
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Кастомный confirm-диалог (вместо браузерного confirm())
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message?: React.ReactNode;
    confirmLabel?: string;
    variant?: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  const handleCancelSubscription = () => {
    const periodEndStr = subscriptionInfo?.currentPeriodEnd
      ? new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()
      : t('billingPage.untilEndOfPeriod');
    setConfirmDialog({
      title: t('billingPage.cancelAutoRenewQuestion'),
      message: (
        <ul className="list-disc pl-5 space-y-1">
          <li>{t('billingPage.cancelDetailNoRefund')}</li>
          <li>{t('billingPage.cancelDetailActiveUntil', { date: periodEndStr })}</li>
          <li>{t('billingPage.cancelDetailMinutesAvailable')}</li>
          <li>{t('billingPage.cancelDetailAutoClose')}</li>
        </ul>
      ),
      confirmLabel: t('billingPage.cancel'),
      variant: 'danger',
      onConfirm: async () => {
        setCancelBusy(true);
        setCancelMessage(null);
        try {
          const res = await fetch('/api/billing/cancel-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setCancelMessage({ kind: 'success', text: data.message || t('billingPage.canceled') });
          setSubscriptionInfo((s) => s ? { ...s, cancelAtPeriodEnd: true, currentPeriodEnd: data.currentPeriodEnd || s.currentPeriodEnd } : s);
          refreshBilling();
        } catch (e: any) {
          setCancelMessage({ kind: 'error', text: e.message || t('billingPage.cancelFailed') });
        } finally {
          setCancelBusy(false);
        }
      },
    });
  };

  const handleResumeSubscription = () => {
    setConfirmDialog({
      title: t('billingPage.resumeAutoRenewQuestion'),
      message: t('billingPage.resumeNextChargeNote'),
      confirmLabel: t('billingPage.resume'),
      variant: 'primary',
      onConfirm: async () => {
        setCancelBusy(true);
        setCancelMessage(null);
        try {
          const res = await fetch('/api/billing/resume-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setCancelMessage({ kind: 'success', text: data.message || t('billingPage.resumed') });
          setSubscriptionInfo((s) => s ? { ...s, cancelAtPeriodEnd: false } : s);
          refreshBilling();
        } catch (e: any) {
          setCancelMessage({ kind: 'error', text: e.message || t('billingPage.resumeFailed') });
        } finally {
          setCancelBusy(false);
        }
      },
    });
  };

  // v0.9.5: подробная инфа о подписке (cancel_at_period_end, rollover, период)
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
    rolloverMinutes: number;
    totalMinutes: number;
    hasActiveStripeSub: boolean;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/billing/me', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (data?.subscription) {
          setSubscriptionInfo({
            cancelAtPeriodEnd: !!data.subscription.cancelAtPeriodEnd,
            currentPeriodEnd: data.subscription.currentPeriodEnd || null,
            rolloverMinutes: data.subscription.rolloverMinutes || 0,
            totalMinutes: data.subscription.totalMinutes || 0,
            hasActiveStripeSub: !!data.subscription.hasActiveStripeSub,
          });
        } else {
          setSubscriptionInfo(null);
        }
      } catch {
        if (!cancelled) setSubscriptionInfo(null);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // v0.9.0: Promocode applicator
  const [promoCode, setPromoCode] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    promotionCodeId: string;
    code: string;
    percentOff: number | null;
    amountOff: number | null;
    summary: string;
    appliesToTiers: string[] | null;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoApplying(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/billing/promo-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setPromoError(data.error || t('billingPage.promoInvalid'));
        setAppliedPromo(null);
        return;
      }
      setAppliedPromo({
        promotionCodeId: data.promotionCodeId,
        code: data.code,
        percentOff: data.percentOff,
        amountOff: data.amountOff,
        summary: data.summary,
        appliesToTiers: data.appliesToTiers ?? null,
      });
    } catch (e: any) {
      setPromoError(e.message || t('billingPage.networkError'));
    } finally {
      setPromoApplying(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError(null);
  };

  /**
   * Применяется ли промокод к конкретному tier'у?
   * Если appliesToTiers=null → ко всем; иначе — только к перечисленным.
   */
  const promoAppliesToTier = (tier: string): boolean => {
    if (!appliedPromo) return false;
    if (!appliedPromo.appliesToTiers || appliedPromo.appliesToTiers.length === 0) return true;
    return appliedPromo.appliesToTiers.includes(tier);
  };

  /** Рассчитать цену с учётом скидки. priceEur в евро. */
  const calcDiscounted = (priceEur: number, tier: string): { final: number; saved: number; applied: boolean } => {
    if (!appliedPromo || !promoAppliesToTier(tier)) return { final: priceEur, saved: 0, applied: false };
    if (appliedPromo.percentOff) {
      const saved = priceEur * appliedPromo.percentOff / 100;
      return { final: priceEur - saved, saved, applied: true };
    }
    if (appliedPromo.amountOff) {
      const saved = appliedPromo.amountOff / 100;
      return { final: Math.max(0, priceEur - saved), saved, applied: true };
    }
    return { final: priceEur, saved: 0, applied: false };
  };

  /** Форматирование цены — целое если целое, иначе с 2 знаками. */
  const fmtPrice = (eur: number): string => {
    return Number.isInteger(eur) ? `€${eur}` : `€${eur.toFixed(2)}`;
  };

  // Полный список языков с фильтром по поиску — match по name, nameEn, code.
  const filteredLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.nameEn.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  }, [langSearch]);

  // ── Запуск оплаты Stripe Checkout (реализовано в этапе 4) ──
  const handleCheckout = async (planId: 'plus' | 'standard') => {
    setCheckoutLoading(planId);
    try {
      const billingPeriod = planId === 'standard' && annual ? 'yearly' : 'monthly';
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tier: billingPeriod === 'yearly' ? 'standard_yearly' : planId,
          currency: 'eur',
          promotionCodeId: appliedPromo?.promotionCodeId,
        }),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(t('billingPage.checkoutNoUrl'));
      }
    } catch (err: any) {
      showToast(t('billingPage.checkoutFailed', { error: err.message || err }), 'error');
      setCheckoutLoading(null);
    }
  };

  const handleContactEnterprise = () => {
    const url = 'https://wa.me/380637610482?text=' + encodeURIComponent(
      t('billingPage.whatsAppMessage')
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ═══════════════════════════════════════════════
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Заголовок */}
      <div>
        <h1 className="section-title text-2xl mb-1">{t('billingPage.title')}</h1>
        <p className="section-subtitle">{t('billingPage.subtitle')}</p>
      </div>

      {/* Текущий баланс */}
      <AuroraCard className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(59,130,246,0.10)', color: '#60A5FA' }}>
              <Zap size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs uppercase font-600" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                {t('billingPage.balanceLabel')}
              </p>
              <p className="text-2xl font-700" style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
                {balanceMin} <span className="text-sm font-500" style={{ color: 'var(--text-muted)' }}>{t('billingPage.balanceMinutes')}</span>
                {subscriptionInfo && subscriptionInfo.rolloverMinutes > 0 && (
                  <span className="text-xs ml-2 px-2 py-0.5 rounded-full font-600"
                        style={{ background: 'rgba(16,185,129,0.10)', color: '#34D399', letterSpacing: '0.02em' }}
                        title={t('billingPage.topupCarriedTooltip')}>
                    + {t('billingPage.topupCarried')} {subscriptionInfo.rolloverMinutes}
                  </span>
                )}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {t('billingPage.tierLabel')}: <strong style={{ color: 'var(--text-secondary)' }}>{tierDisplay}</strong>
                {subscriptionInfo?.currentPeriodEnd && !subscriptionInfo.cancelAtPeriodEnd && (
                  <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                    · {t('billingPage.renewsOn', { date: new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString() })}
                  </span>
                )}
              </p>
            </div>
          </div>
          {/* v0.9.5: кнопка управления автопродлением — только при активной Stripe-подписке */}
          {subscriptionInfo?.hasActiveStripeSub && !subscriptionInfo.cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={handleCancelSubscription}
              disabled={cancelBusy}
              className="text-xs font-600 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-muted)',
              }}
              title={t('billingPage.cancelTooltip')}
            >
              {cancelBusy ? <Loader2 size={12} className="animate-spin inline mr-1" /> : <Ban size={12} strokeWidth={1.5} className="inline mr-1" />}
              {t('billingPage.cancelSubscription')}
            </button>
          )}
          {subscriptionInfo?.hasActiveStripeSub && subscriptionInfo.cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={handleResumeSubscription}
              disabled={cancelBusy}
              className="text-xs font-600 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
              style={{
                background: 'rgba(16,185,129,0.10)',
                border: '1px solid rgba(16,185,129,0.30)',
                color: '#10b981',
              }}
              title={t('billingPage.resumeTooltip')}
            >
              {cancelBusy ? <Loader2 size={12} className="animate-spin inline mr-1" /> : <RotateCcw size={12} strokeWidth={1.5} className="inline mr-1" />}
              {t('billingPage.resume')}
            </button>
          )}
        </div>
        {cancelMessage && (
          <div className="mt-4 rounded-2xl p-3 text-xs flex items-start gap-2"
               style={{
                 background: cancelMessage.kind === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                 border: `1px solid ${cancelMessage.kind === 'success' ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}`,
                 color: cancelMessage.kind === 'success' ? '#10b981' : '#ef4444',
               }}>
            {cancelMessage.kind === 'success' ? <Check size={14} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" /> : <X size={14} className="flex-shrink-0 mt-0.5" />}
            <span className="leading-relaxed">{cancelMessage.text}</span>
            <button type="button" onClick={() => setCancelMessage(null)} className="ml-auto flex-shrink-0">
              <X size={12} />
            </button>
          </div>
        )}
        {subscriptionInfo?.cancelAtPeriodEnd && subscriptionInfo.currentPeriodEnd && (
          <div className="mt-4 rounded-2xl p-3.5 flex items-start gap-2.5"
               style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.22)' }}>
            <Calendar size={16} strokeWidth={1.5} style={{ color: '#FBBF24', marginTop: 1, flexShrink: 0 }} />
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <p className="font-700 mb-0.5" style={{ color: '#FBBF24' }}>
                {t('billingPage.autoRenewCancelledHeading', { date: new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString() })}
              </p>
              <p style={{ color: 'var(--text-muted)' }}>
                {t('billingPage.autoRenewCancelledHint')}
              </p>
            </div>
          </div>
        )}
      </AuroraCard>

      {/* Переключатель Месячно / Ежегодно */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className="px-4 py-2 rounded-xl text-sm font-600 transition-all"
          style={{
            background: !annual ? 'var(--text-primary)' : 'transparent',
            color: !annual ? 'var(--bg-primary)' : 'var(--text-muted)',
            border: !annual ? 'none' : '1px solid var(--border-subtle)',
          }}
        >
          {t('billingPage.monthlyToggle')}
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className="px-4 py-2 rounded-xl text-sm font-600 transition-all flex items-center gap-2"
          style={{
            background: annual ? 'var(--text-primary)' : 'transparent',
            color: annual ? 'var(--bg-primary)' : 'var(--text-muted)',
            border: annual ? 'none' : '1px solid var(--border-subtle)',
          }}
        >
          {t('billingPage.yearlyToggle')}
          <span
            className="text-[10px] font-700 px-2 py-0.5 rounded-full"
            style={{
              background: annual ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.10)',
              color: '#34D399',
            }}
          >
            {t('billingPage.yearlyDiscount')}
          </span>
        </button>
      </div>

      {/* v0.9.0: Поле «Активировать промокод» */}
      <AuroraCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Tags size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-xs font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('billingPage.promoCode')}
          </h3>
        </div>

        {appliedPromo ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
               style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.32)' }}>
            <Check size={14} strokeWidth={2.5} color="#10b981" />
            <span className="text-sm font-700" style={{ color: '#10b981' }}>{appliedPromo.code}</span>
            <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>· {appliedPromo.summary}</span>
            <button type="button" onClick={removePromo}
                    className="text-xs px-2 py-1 rounded-lg" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
              {t('common.delete')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplyPromo(); }}
              placeholder={t('billingPage.promoPlaceholder')}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm font-600 outline-none focus:border-violet-400"
              style={{
                background: 'var(--bg-tertiary)',
                border: `1px solid ${promoError ? 'rgba(239,68,68,0.45)' : 'var(--border-medium)'}`,
                color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, monospace',
                letterSpacing: '0.05em',
              }}
            />
            <button type="button"
                    onClick={handleApplyPromo}
                    disabled={promoApplying || !promoCode.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-700 transition-opacity disabled:opacity-50"
                    style={{ background: 'var(--btn-primary-bg)', color: 'var(--bg-primary)' }}>
              {promoApplying ? <Loader2 size={14} className="animate-spin inline" /> : t('billingPage.promoApply')}
            </button>
          </div>
        )}
        {promoError && (
          <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{promoError}</p>
        )}
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
          {t('billingPage.promoHint')}
        </p>
      </AuroraCard>

      {/* Карточки тарифов */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const showAnnual = plan.id === 'standard' && annual && plan.priceYearly;
          const basePrice = plan.contactOnly
            ? 0
            : showAnnual ? plan.priceYearly! : plan.priceMonthly;
          const planTier = plan.id === 'standard' && annual ? 'standard_yearly' : plan.id;
          const disc = plan.contactOnly ? { final: 0, saved: 0, applied: false } : calcDiscounted(basePrice, planTier);
          const displayPriceLabel = plan.contactOnly ? plan.priceLabel : fmtPrice(disc.applied ? disc.final : basePrice);
          const originalPriceLabel = plan.contactOnly ? '' : fmtPrice(basePrice);
          const displayPeriod = plan.contactOnly
            ? ''
            : showAnnual ? t('billingPage.perYearShort') : t('billingPage.perMonthShort');
          const displayMinutes = showAnnual ? t('billingPage.yearlyMinutes') : plan.minutes;

          return (
            <div
              key={plan.id}
              className="relative rounded-3xl p-6 flex flex-col"
              style={{
                background: plan.highlighted
                  ? 'linear-gradient(180deg, rgba(59,130,246,0.06) 0%, var(--card-bg) 100%)'
                  : 'var(--card-bg)',
                border: plan.highlighted
                  ? '1.5px solid rgba(59,130,246,0.40)'
                  : '1px solid var(--card-border)',
                boxShadow: plan.highlighted ? '0 16px 48px rgba(59,130,246,0.10)' : 'none',
              }}
            >
              {plan.highlighted && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-700 uppercase tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6, #38BDF8)',
                    color: '#FFFFFF',
                    letterSpacing: '0.08em',
                    boxShadow: '0 4px 14px rgba(59,130,246,0.40)',
                  }}
                >
                  {t('paywall.popular')}
                </div>
              )}

              {/* Заголовок плана */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  {plan.id === 'plus' && <Zap size={20} strokeWidth={1.5} style={{ color: '#60A5FA' }} />}
                  {plan.id === 'standard' && <Sparkles size={20} strokeWidth={1.5} style={{ color: '#60A5FA' }} />}
                  {plan.id === 'enterprise' && <Crown size={20} strokeWidth={1.5} style={{ color: '#FBBF24' }} />}
                  <h3
                    className="text-lg font-700"
                    style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
                  >
                    {plan.name}
                  </h3>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {plan.description}
                </p>
              </div>

              {/* Цена */}
              <div className="mb-5">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span
                    className="text-3xl font-800"
                    style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      color: disc.applied ? '#10b981' : 'var(--text-primary)',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {displayPriceLabel}
                  </span>
                  {disc.applied && (
                    <span
                      className="text-base font-600 line-through"
                      style={{ color: 'var(--text-disabled)', fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                      {originalPriceLabel}
                    </span>
                  )}
                  {displayPeriod && (
                    <span className="text-sm font-500" style={{ color: 'var(--text-muted)' }}>
                      {displayPeriod}
                    </span>
                  )}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {displayMinutes}
                  {!plan.contactOnly && (
                    <span className="ml-2" style={{ color: 'var(--text-disabled)' }}>
                      · {plan.pricePerMinute}
                    </span>
                  )}
                </div>
                {disc.applied && (
                  <div
                    className="text-[11px] mt-2 font-700 inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.14)', color: '#34D399', letterSpacing: '0.02em' }}
                  >
                    <Check size={10} strokeWidth={2.5} />
                    {t('billingPage.promoCodeBadge', { code: appliedPromo!.code, percent: appliedPromo!.percentOff })}
                  </div>
                )}
                {showAnnual && !disc.applied && (
                  <div
                    className="text-xs mt-2 font-600 inline-block px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.14)', color: '#34D399' }}
                  >
                    {t('billingPage.yearlySavings')}
                  </div>
                )}
              </div>

              {/* Список фич */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f, idx) => (
                  f.standout ? (
                    <li
                      key={idx}
                      className="flex items-center justify-center gap-3 py-2.5 my-1 rounded-xl"
                      style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.30)', color: '#60A5FA' }}
                      aria-hidden
                    >
                      {f.icon}
                    </li>
                  ) : (
                    <li key={idx} className="flex items-start gap-2.5">
                      <div
                        className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: f.highlight ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.04)',
                          color: f.highlight ? '#60A5FA' : 'var(--text-muted)',
                        }}
                      >
                        {f.icon}
                      </div>
                      <span
                        className={`text-xs leading-relaxed ${f.highlight ? 'font-600' : 'font-500'}`}
                        style={{ color: f.highlight ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        {f.text}
                      </span>
                    </li>
                  )
                ))}
              </ul>

              {/* CTA */}
              {plan.contactOnly ? (
                <AuroraButton
                  fullWidth
                  variant="ghost"
                  icon={<MessageSquare size={16} strokeWidth={1.5} />}
                  onClick={handleContactEnterprise}
                  id={`billing-cta-${plan.id}`}
                >
                  {plan.ctaLabel}
                </AuroraButton>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <AuroraButton
                    fullWidth
                    onClick={() => handleCheckout(plan.id as 'plus' | 'standard')}
                    disabled={checkoutLoading !== null}
                    iconRight={checkoutLoading === plan.id
                      ? <Loader2 size={16} className="animate-spin" />
                      : <ArrowRight size={16} strokeWidth={2} />}
                    id={`billing-cta-${plan.id}`}
                  >
                    {checkoutLoading === plan.id ? t('billingPage.stripeOpening') : plan.ctaLabel}
                  </AuroraButton>
                  {disc.applied && (
                    <p
                      className="text-[10.5px] sm:text-[11px] text-center font-600 leading-tight px-1 break-words"
                      style={{ color: '#34D399', letterSpacing: '0.01em' }}
                    >
                      {t('billingPage.discountWithPromo', { percent: appliedPromo!.percentOff, code: appliedPromo!.code })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Top-up calculator */}
      <TopupCalculator
        token={token}
        promotionCodeId={appliedPromo?.promotionCodeId ?? null}
        promoCode={appliedPromo?.code ?? null}
        promoPercentOff={appliedPromo?.percentOff ?? null}
      />

      {/* Список языков с поиском — полный список языков, поддерживаемых Gemini Live API. */}
      <AuroraCard className="p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Globe size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-700 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('billingPage.languagesHeading')}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.24)' }}>
            {t('billingPage.languagesCount', { count: SUPPORTED_LANGUAGES.length })}
          </span>
        </div>

        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('billingPage.languagesLead')}
        </p>

        {/* Поиск по языкам */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={langSearch}
            onChange={(e) => setLangSearch(e.target.value)}
            placeholder=""
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm transition-colors focus:outline-none focus:border-violet-400"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
            }}
          />
          {langSearch && (
            <button type="button"
                    onClick={() => setLangSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--bg-secondary)]"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label={t('billingPage.clearSearch')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Результаты */}
        {filteredLanguages.length === 0 ? (
          <div className="text-center py-6 px-3 rounded-xl"
               style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.20)' }}>
            <p className="text-sm font-600" style={{ color: '#ef4444' }}>
              {t('billingPage.languagesNoResults')}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {filteredLanguages.map((lang) => (
                <span key={lang.code}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-500"
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}>
                  <span className="text-sm leading-none uppercase" aria-hidden>
                    {isCountryFlag(lang.flag) ? lang.flag : lang.code}
                  </span>
                  <span>{lang.name}</span>
                  {lang.name !== lang.nameEn && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>· {lang.nameEn}</span>
                  )}
                </span>
              ))}
            </div>
            {langSearch && (
              <p className="text-[11px] mt-2.5" style={{ color: 'var(--text-muted)' }}>
                {t('billingPage.searchResultsCount', { count: filteredLanguages.length })}
              </p>
            )}
          </>
        )}
      </AuroraCard>

      {/* FAQ */}
      <div className="space-y-3">
        <h2 className="section-title text-lg">{t('billingPage.faqHeading')}</h2>
        {[
          { q: t('billingPage.faqQ1'), a: t('billingPage.faqA1') },
          { q: t('billingPage.faqQ2'), a: t('billingPage.faqA2') },
          { q: t('billingPage.faqQ3'), a: t('billingPage.faqA3') },
          { q: t('billingPage.faqQ4'), a: t('billingPage.faqA4') },
        ].map((item, idx) => (
          <AuroraCard key={idx} className="p-4">
            <p className="text-sm font-600 mb-1" style={{ color: 'var(--text-primary)' }}>{item.q}</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.a}</p>
          </AuroraCard>
        ))}
      </div>

      {/* In-app confirm-диалог (заменяет браузерный confirm()) */}
      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant || 'danger'}
        onConfirm={() => { const cb = confirmDialog?.onConfirm; setConfirmDialog(null); cb?.(); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
