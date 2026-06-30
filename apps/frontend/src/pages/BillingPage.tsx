/**
 * BillingPage — тарифы TrendTraffic.
 *
 * Два тарифа:
 *   • Premium (€120/мес, Stripe) — полный самостоятельный доступ ко ВСЕМ функциям.
 *   • Enterprise (по запросу) — то же + индивидуальная настройка и массовое ведение
 *     соцсетей «под ключ» через наш API.
 * Функции у тарифов идентичны; различие — в уровне сервиса.
 *
 * Сохранены: промокоды, Stripe Checkout, управление подпиской (отмена/возобновление).
 * Удалено легаси VibeVox: «минуты перевода», докупка, список языков, видеозвонки/SIP.
 */

import React, { useState, useEffect } from 'react';
import {
  Check, ArrowRight, Crown, Sparkles, TrendingUp, BarChart3, Users, Image as ImageIcon,
  Workflow, Send, Video, KeyRound, MessageSquare, Tags, Loader2, X, Ban, RotateCcw,
  Calendar, Settings, Headphones, Gauge, Layers, Gift, Plug,
} from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../components/Toast';

// ─────────────────────────────────────────────
// Данные тарифов
// ─────────────────────────────────────────────
interface PlanFeature { icon: React.ReactNode; text: string; strong?: boolean }

const PREMIUM_FEATURES: PlanFeature[] = [
  { icon: <TrendingUp size={14} />, text: 'Безлимитный поиск вирусных трендов: TikTok, Instagram, YouTube, X, Reddit, Douyin, Bilibili' },
  { icon: <BarChart3 size={14} />, text: 'Безлимитная аналитика по ссылке: просмотры, лайки, вовлечённость, тональность (ИИ), облако слов, топ-комментарии' },
  { icon: <Users size={14} />, text: '«Каналы» — анализ всех роликов канала + вотчлист с историей метрик и приростами' },
  { icon: <ImageIcon size={14} />, text: 'Галерея + скачивание видео без водяного знака (TikTok, X, Instagram)' },
  { icon: <Workflow size={14} />, text: 'TrendFlow — сборка роликов по сценам: монтаж, формат 9:16/1:1/16:9, субтитры, озвучка, цвет, экспорт' },
  { icon: <Video size={14} />, text: 'Генерация видео через ВАШИ подключённые API: видео, аватары, озвучка, рестайл (Anthropic Claude, FAL.ai, OpenAI, ElevenLabs, HeyGen и др.)' },
  { icon: <Gift size={14} />, text: 'Подключение бесплатных API для генерации и видео: Pexels, Pixabay, Unsplash, HuggingFace' },
  { icon: <Send size={14} />, text: 'Публикатор — публикация роликов в TikTok, Instagram, YouTube, Facebook, X (скоро)' },
  { icon: <Tags size={14} />, text: 'Промокоды и реферальная система' },
];

const ENTERPRISE_FEATURES: PlanFeature[] = [
  { icon: <Check size={14} />, text: 'Всё из тарифа Premium' },
  { icon: <Plug size={14} />, text: 'Подключение ваших API для генерации (платные и бесплатные)' },
  { icon: <Settings size={14} />, text: 'Индивидуальная настройка сервиса под ваш бренд и задачи' },
  { icon: <Layers size={14} />, text: 'Массовое ведение соцсетей «под ключ» через наш API — ведём аккаунты за вас' },
  { icon: <KeyRound size={14} />, text: 'Индивидуальные интеграции и доработки под ваш пайплайн' },
  { icon: <Gauge size={14} />, text: 'Приоритетная очередь генерации и рендера' },
  { icon: <Headphones size={14} />, text: 'Выделенная поддержка и персональный менеджер' },
];

// Список провайдеров для блока «как работает генерация через подключённые API».
const GEN_PROVIDERS = 'Google Veo / Omni · FAL / Kling · Runway · OpenAI · ElevenLabs · HeyGen · Anthropic Claude';

const WHATSAPP_NUMBER = '380637610482';

export function BillingPage() {
  const { subscriptionTier, subscriptionTierName, token, refreshBilling } = useAppStore();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Текущий тариф для показа в карточке статуса.
  const tierDisplay = (() => {
    const raw = (subscriptionTierName || subscriptionTier || '').toLowerCase();
    if (raw === 'premium') return 'Premium';
    if (raw === 'enterprise') return 'Enterprise';
    if (raw === 'plus') return 'Plus';
    if (raw === 'standard') return 'Standard';
    if (raw === 'standard_yearly') return 'Standard (год)';
    if (raw === 'trial' || raw === '') return 'Подписка не активна';
    return subscriptionTierName || subscriptionTier || 'Подписка не активна';
  })();

  // ── Управление подпиской (отмена/возобновление) ──
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message?: React.ReactNode; confirmLabel?: string; variant?: 'primary' | 'danger'; onConfirm: () => void;
  } | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null; hasActiveStripeSub: boolean;
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
            hasActiveStripeSub: !!data.subscription.hasActiveStripeSub,
          });
        } else setSubscriptionInfo(null);
      } catch { if (!cancelled) setSubscriptionInfo(null); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleCancelSubscription = () => {
    const periodEndStr = subscriptionInfo?.currentPeriodEnd
      ? new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()
      : 'до конца оплаченного периода';
    setConfirmDialog({
      title: 'Отключить автопродление подписки?',
      message: (
        <ul className="list-disc pl-5 space-y-1">
          <li>Деньги за текущий период не возвращаются.</li>
          <li>Доступ сохранится до {periodEndStr}.</li>
          <li>После этой даты подписка закроется автоматически.</li>
        </ul>
      ),
      confirmLabel: 'Отключить',
      variant: 'danger',
      onConfirm: async () => {
        setCancelBusy(true); setCancelMessage(null);
        try {
          const res = await fetch('/api/billing/cancel-subscription', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setCancelMessage({ kind: 'success', text: data.message || 'Автопродление отключено.' });
          setSubscriptionInfo((s) => s ? { ...s, cancelAtPeriodEnd: true, currentPeriodEnd: data.currentPeriodEnd || s.currentPeriodEnd } : s);
          refreshBilling();
        } catch (e: any) {
          setCancelMessage({ kind: 'error', text: e.message || 'Не удалось отключить автопродление.' });
        } finally { setCancelBusy(false); }
      },
    });
  };

  const handleResumeSubscription = () => {
    setConfirmDialog({
      title: 'Возобновить автопродление?',
      message: 'Подписка снова будет продлеваться автоматически. Ближайшее списание — в конце текущего периода.',
      confirmLabel: 'Возобновить',
      variant: 'primary',
      onConfirm: async () => {
        setCancelBusy(true); setCancelMessage(null);
        try {
          const res = await fetch('/api/billing/resume-subscription', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setCancelMessage({ kind: 'success', text: data.message || 'Автопродление возобновлено.' });
          setSubscriptionInfo((s) => s ? { ...s, cancelAtPeriodEnd: false } : s);
          refreshBilling();
        } catch (e: any) {
          setCancelMessage({ kind: 'error', text: e.message || 'Не удалось возобновить.' });
        } finally { setCancelBusy(false); }
      },
    });
  };

  // ── Промокод ──
  const [promoCode, setPromoCode] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    promotionCodeId: string; code: string; percentOff: number | null; amountOff: number | null;
    summary: string; appliesToTiers: string[] | null;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoApplying(true); setPromoError(null);
    try {
      const res = await fetch('/api/billing/promo-validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) { setPromoError(data.error || 'Промокод недействителен.'); setAppliedPromo(null); return; }
      setAppliedPromo({
        promotionCodeId: data.promotionCodeId, code: data.code, percentOff: data.percentOff,
        amountOff: data.amountOff, summary: data.summary, appliesToTiers: data.appliesToTiers ?? null,
      });
    } catch (e: any) { setPromoError(e.message || 'Ошибка сети.'); }
    finally { setPromoApplying(false); }
  };
  const removePromo = () => { setAppliedPromo(null); setPromoCode(''); setPromoError(null); };

  const promoAppliesToPremium = (): boolean => {
    if (!appliedPromo) return false;
    if (!appliedPromo.appliesToTiers || appliedPromo.appliesToTiers.length === 0) return true;
    return appliedPromo.appliesToTiers.includes('premium');
  };

  const PREMIUM_EUR = 120;
  const discounted = (() => {
    if (!appliedPromo || !promoAppliesToPremium()) return { final: PREMIUM_EUR, applied: false };
    if (appliedPromo.percentOff) return { final: PREMIUM_EUR * (1 - appliedPromo.percentOff / 100), applied: true };
    if (appliedPromo.amountOff) return { final: Math.max(0, PREMIUM_EUR - appliedPromo.amountOff / 100), applied: true };
    return { final: PREMIUM_EUR, applied: false };
  })();
  const fmtPrice = (eur: number) => Number.isInteger(eur) ? `€${eur}` : `€${eur.toFixed(2)}`;

  // ── Stripe Checkout (Premium) ──
  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ tier: 'premium', currency: 'eur', promotionCodeId: appliedPromo?.promotionCodeId }),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else throw new Error('Stripe не вернул ссылку на оплату.');
    } catch (err: any) {
      showToast(`Не удалось открыть оплату: ${err.message || err}`, 'error');
      setCheckoutLoading(false);
    }
  };

  const handleContactEnterprise = () => {
    const msg = 'Здравствуйте! Хочу узнать про тариф Enterprise в TrendTraffic (индивидуальная настройка и ведение соцсетей).';
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  // ═══════════════════════════════════════════════
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Заголовок */}
      <div>
        <h1 className="section-title text-2xl mb-1">Тарифы</h1>
        <p className="section-subtitle">Полный доступ ко всем функциям TrendTraffic.</p>
      </div>

      {/* Текущий тариф + управление подпиской */}
      <AuroraCard className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(99,102,241,0.10)', color: 'var(--brand)' }}>
              <Crown size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs uppercase font-600" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                Ваш тариф
              </p>
              <p className="text-2xl font-700" style={{ color: 'var(--text-primary)', fontFamily: 'Geist Sans, sans-serif' }}>
                {tierDisplay}
              </p>
              {subscriptionInfo?.currentPeriodEnd && !subscriptionInfo.cancelAtPeriodEnd && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Продлевается {new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {subscriptionInfo?.hasActiveStripeSub && !subscriptionInfo.cancelAtPeriodEnd && (
            <button type="button" onClick={handleCancelSubscription} disabled={cancelBusy}
              className="text-xs font-600 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
              style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
              {cancelBusy ? <Loader2 size={12} className="animate-spin inline mr-1" /> : <Ban size={12} strokeWidth={1.5} className="inline mr-1" />}
              Отключить автопродление
            </button>
          )}
          {subscriptionInfo?.hasActiveStripeSub && subscriptionInfo.cancelAtPeriodEnd && (
            <button type="button" onClick={handleResumeSubscription} disabled={cancelBusy}
              className="text-xs font-600 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
              style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)', color: '#10b981' }}>
              {cancelBusy ? <Loader2 size={12} className="animate-spin inline mr-1" /> : <RotateCcw size={12} strokeWidth={1.5} className="inline mr-1" />}
              Возобновить
            </button>
          )}
        </div>
        {cancelMessage && (
          <div className="mt-4 rounded-2xl p-3 text-xs flex items-start gap-2"
               style={{ background: cancelMessage.kind === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${cancelMessage.kind === 'success' ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}`,
                        color: cancelMessage.kind === 'success' ? '#10b981' : '#ef4444' }}>
            {cancelMessage.kind === 'success' ? <Check size={14} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" /> : <X size={14} className="flex-shrink-0 mt-0.5" />}
            <span className="leading-relaxed">{cancelMessage.text}</span>
            <button type="button" onClick={() => setCancelMessage(null)} className="ml-auto flex-shrink-0"><X size={12} /></button>
          </div>
        )}
        {subscriptionInfo?.cancelAtPeriodEnd && subscriptionInfo.currentPeriodEnd && (
          <div className="mt-4 rounded-2xl p-3.5 flex items-start gap-2.5"
               style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.22)' }}>
            <Calendar size={16} strokeWidth={1.5} style={{ color: '#FBBF24', marginTop: 1, flexShrink: 0 }} />
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <p className="font-700 mb-0.5" style={{ color: '#FBBF24' }}>
                Автопродление отключено · доступ до {new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()}
              </p>
              <p style={{ color: 'var(--text-muted)' }}>Можно возобновить в любой момент до этой даты.</p>
            </div>
          </div>
        )}
      </AuroraCard>

      {/* Промокод */}
      <AuroraCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Tags size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-xs font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>Промокод</h3>
        </div>
        {appliedPromo ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
               style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.32)' }}>
            <Check size={14} strokeWidth={2.5} color="#10b981" />
            <span className="text-sm font-700" style={{ color: '#10b981' }}>{appliedPromo.code}</span>
            <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>· {appliedPromo.summary}</span>
            <button type="button" onClick={removePromo} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>Убрать</button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="text" value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplyPromo(); }}
              placeholder="ВАШ-ПРОМОКОД"
              className="flex-1 px-3 py-2.5 rounded-xl text-sm font-600 outline-none focus:border-indigo-400"
              style={{ background: 'var(--bg-tertiary)', border: `1px solid ${promoError ? 'rgba(239,68,68,0.45)' : 'var(--border-medium)'}`,
                       color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }} />
            <button type="button" onClick={handleApplyPromo} disabled={promoApplying || !promoCode.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-700 transition-opacity disabled:opacity-50"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--bg-primary)' }}>
              {promoApplying ? <Loader2 size={14} className="animate-spin inline" /> : 'Применить'}
            </button>
          </div>
        )}
        {promoError && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{promoError}</p>}
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>Скидка применится к подписке Premium при оплате.</p>
      </AuroraCard>

      {/* Карточки тарифов */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Premium ── */}
        <div className="relative rounded-3xl p-6 flex flex-col"
             style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.06) 0%, var(--card-bg) 100%)',
                      border: '1.5px solid rgba(99,102,241,0.40)', boxShadow: '0 16px 48px rgba(99,102,241,0.10)' }}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-700 uppercase tracking-wider"
               style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', letterSpacing: '0.08em', boxShadow: '0 4px 14px rgba(99,102,241,0.40)' }}>
            Популярный
          </div>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={20} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
              <h3 className="text-lg font-700" style={{ fontFamily: 'Geist Sans, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Premium</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Полный самостоятельный доступ ко всем функциям сервиса.
            </p>
          </div>
          <div className="mb-5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl font-800" style={{ fontFamily: 'Geist Sans, sans-serif', color: discounted.applied ? '#10b981' : 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                {fmtPrice(discounted.applied ? discounted.final : PREMIUM_EUR)}
              </span>
              {discounted.applied && (
                <span className="text-base font-600 line-through" style={{ color: 'var(--text-disabled)', fontFamily: 'Geist Sans, sans-serif' }}>€{PREMIUM_EUR}</span>
              )}
              <span className="text-sm font-500" style={{ color: 'var(--text-muted)' }}>/ мес</span>
            </div>
            {discounted.applied && appliedPromo && (
              <div className="text-[11px] mt-2 font-700 inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                   style={{ background: 'rgba(16,185,129,0.14)', color: '#34D399' }}>
                <Check size={10} strokeWidth={2.5} /> Промокод {appliedPromo.code}
              </div>
            )}
          </div>
          <ul className="space-y-2 mb-6 flex-1">
            {PREMIUM_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: f.strong ? 'rgba(99,102,241,0.14)' : 'rgba(255,255,255,0.04)', color: f.strong ? 'var(--brand)' : 'var(--text-muted)' }}>
                  {f.icon}
                </div>
                <span className={`text-xs leading-relaxed ${f.strong ? 'font-600' : 'font-500'}`} style={{ color: f.strong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
          <AuroraButton fullWidth onClick={handleCheckout} disabled={checkoutLoading}
            iconRight={checkoutLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={2} />}
            id="billing-cta-premium">
            {checkoutLoading ? 'Открываю Stripe…' : 'Оформить Premium'}
          </AuroraButton>
        </div>

        {/* ── Enterprise ── */}
        <div className="relative rounded-3xl p-6 flex flex-col" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown size={20} strokeWidth={1.5} style={{ color: '#FBBF24' }} />
              <h3 className="text-lg font-700" style={{ fontFamily: 'Geist Sans, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Enterprise</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Всё из Premium + индивидуальная настройка и ведение соцсетей «под ключ».
            </p>
          </div>
          <div className="mb-5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl font-800" style={{ fontFamily: 'Geist Sans, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>По запросу</span>
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Индивидуальные условия под объём задач.</div>
          </div>
          <ul className="space-y-2 mb-6 flex-1">
            {ENTERPRISE_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: f.strong ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.04)', color: f.strong ? '#FBBF24' : 'var(--text-muted)' }}>
                  {f.icon}
                </div>
                <span className={`text-xs leading-relaxed ${f.strong ? 'font-600' : 'font-500'}`} style={{ color: f.strong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
          <AuroraButton fullWidth variant="ghost" icon={<MessageSquare size={16} strokeWidth={1.5} />} onClick={handleContactEnterprise} id="billing-cta-enterprise">
            Связаться (WhatsApp)
          </AuroraButton>
        </div>
      </div>

      {/* Как работает генерация видео через подключённые API */}
      <AuroraCard className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Video size={16} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
          <h3 className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Генерация видео через ваши API-ключи</h3>
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
          В разделе <b>«Настройки Enterprise»</b> подключите свои ключи нужных сервисов — и <b>TrendFlow</b> будет
          генерировать ими видео, озвучку, аватаров и рестайл прямо в сборке роликов. Вы платите сервисам напрямую
          по их тарифам, а TrendTraffic оркестрирует пайплайн.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {GEN_PROVIDERS.split(' · ').map((p) => (
            <span key={p} className="text-[11px] px-2 py-0.5 rounded-lg font-600"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{p}</span>
          ))}
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Базовая обработка (монтаж, формат, субтитры, озвучка Piper, экспорт) работает без внешних ключей.
        </p>
      </AuroraCard>

      {/* FAQ */}
      <div className="space-y-3">
        <h2 className="section-title text-lg">Частые вопросы</h2>
        {[
          { q: 'Чем Premium отличается от Enterprise?', a: 'Набор функций одинаковый — оба тарифа открывают полный доступ ко всему сервису. Enterprise дополнительно включает индивидуальную настройку под ваш бренд и массовое ведение соцсетей «под ключ» через наш API (мы ведём аккаунты за вас).' },
          { q: 'Что значит «генерация через подключённые API»?', a: 'Вы подключаете свои ключи внешних сервисов (Google Veo, FAL/Kling, Runway, OpenAI, ElevenLabs, HeyGen, Claude). TrendFlow использует их для генерации видео/озвучки/аватаров. Оплата этим сервисам идёт напрямую по их ценам.' },
          { q: 'Анализ трендов правда безлимитный?', a: 'Да — поиск и аналитика трендов на Premium и Enterprise не ограничены по количеству.' },
          { q: 'Можно ли отменить подписку?', a: 'Да, в любой момент в карточке тарифа выше — автопродление отключится, а доступ сохранится до конца оплаченного периода.' },
          { q: 'Действуют ли промокоды?', a: 'Да. Введите промокод выше — скидка применится при оформлении Premium через Stripe.' },
        ].map((item, idx) => (
          <AuroraCard key={idx} className="p-4">
            <p className="text-sm font-600 mb-1" style={{ color: 'var(--text-primary)' }}>{item.q}</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.a}</p>
          </AuroraCard>
        ))}
      </div>

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
