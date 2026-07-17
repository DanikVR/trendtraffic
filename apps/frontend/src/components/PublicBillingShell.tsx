/**
 * PublicBillingShell — обёртка ПУБЛИЧНОЙ страницы /billing (без регистрации).
 *
 * Анонимный посетитель видит тарифы как витрину: минимальный топбар
 * (логотип + «Войти» / «Начать бесплатно») и контент BillingPage через <Outlet/>.
 * Авторизованных этот шелл не касается — им BillingChrome (router.tsx) отдаёт
 * обычный LayoutSwitcher с сайдбаром.
 */

import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { CookieConsent } from './CookieConsent';

export function PublicBillingShell() {
  const { t } = useTranslation('common');
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>
      {/* Топбар */}
      <header className="sticky top-0 z-40"
              style={{ background: 'color-mix(in srgb, var(--bg-primary) 82%, transparent)',
                       backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <a href="https://trendtraffic.pro" className="flex items-center gap-2 no-underline">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <linearGradient id="pbs-lg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#8052ff" />
                  <stop offset="1" stopColor="#15846e" />
                </linearGradient>
              </defs>
              <path d="M5 3.2 L21 12 L5 20.8 Z" fill="url(#pbs-lg)" />
            </svg>
            <span className="text-sm font-700" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              TrendTraffic
            </span>
          </a>
          <div className="flex items-center gap-2">
            <Link to="/auth/login"
                  className="text-xs font-600 px-3 py-2 rounded-xl transition-colors"
                  style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
              {t('sec.billing.publicLogin', 'Войти')}
            </Link>
            <Link to="/auth/register"
                  className="text-xs font-700 px-3 py-2 rounded-xl inline-flex items-center gap-1.5 transition-opacity hover:opacity-90"
                  style={{ background: 'var(--btn-primary-bg, var(--brand))', color: 'var(--brand-contrast, #fff)' }}>
              {t('sec.billing.publicStart', 'Начать бесплатно')}
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </header>

      {/* Контент страницы тарифов */}
      <main className="max-w-6xl mx-auto px-4 pt-8">
        <Outlet />
      </main>

      {/* Плашка cookie-согласия (ЕС) — публичная страница */}
      <CookieConsent />
    </div>
  );
}

export default PublicBillingShell;
