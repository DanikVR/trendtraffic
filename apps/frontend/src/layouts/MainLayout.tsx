/**
 * MainLayout — основной Layout VibeVox (Abyss Aurora).
 *
 * Mobile-first: BottomTabBar внизу + header сверху.
 * Desktop (lg+): slim left sidebar с иконками + labels.
 */

import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Languages,
  CreditCard,
  Plus,
  Sun,
  Moon,
  ShieldAlert,
  Settings,
  Phone,
  Menu,
  Workflow,
  TrendingUp,
  Image,
  Send,
} from 'lucide-react';

/** Композитная иконка «перевод + телефон» — используется и в шапке баланса,
 *  и на плавающей FAB. Размер настраивается через size, отступы остаются плотными. */
function TranslationPhoneGlyph({ size = 12, strokeWidth = 1.5 }: { size?: number; strokeWidth?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: '1px' }} aria-hidden>
      <Languages size={size} strokeWidth={strokeWidth} />
      <Phone size={size} strokeWidth={strokeWidth} />
    </span>
  );
}

// ── Функция переключения темы (глобальная, без re-render всего layout) ──
function toggleGlobalTheme(current: boolean, setCurrent: (v: boolean) => void) {
  const html = document.documentElement;
  if (current) {
    html.classList.remove('dark');
    localStorage.setItem('vibevox_theme', 'light');
    setCurrent(false);
  } else {
    html.classList.add('dark');
    localStorage.setItem('vibevox_theme', 'dark');
    setCurrent(true);
  }
}
import { BottomTabBar } from '../components/BottomTabBar';
import { AvatarCircle }  from '../components/AvatarCircle';
import { AppVersion }    from '../components/AppVersion';
import { VibeVoxLogo }   from '../components/VibeVoxLogo';
import { VibeVoxIcon }   from '../components/VibeVoxIcon';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { MinutesDisplay } from '../components/MinutesDisplay';
import { PWAInstallPrompt, usePWAInstall } from '../components/PWAInstallPrompt';
import { useAppStore }   from '../store/useAppStore';
import { FEATURES }      from '../config/features';

export function MainLayout() {
  const { t } = useTranslation('common');
  const { user, translationBalance, subscriptionTier, subscriptionTierName, refreshBilling, setMoreSheetOpen } = useAppStore();
  // Конструктор цепочек (/flow) — на всю ширину (холст React Flow), без центрирующего max-w.
  const { pathname } = useLocation();
  const fullBleed = pathname.startsWith('/flow');

  // Фич-флаги: пункты навигации появляются только для включённых функций.
  const desktopNav = [
    ...(FEATURES.video ? [{ path: '/',    icon: Languages, label: t('nav.rooms'), exact: true  }] : []),
    ...(FEATURES.sip   ? [{ path: '/sip', icon: Phone,     label: t('nav.sip'),   exact: false }] : []),
    ...(FEATURES.trends ? [{ path: '/trends', icon: TrendingUp, label: t('nav.trends', 'Тренды'), exact: false }] : []),
    ...(FEATURES.gallery ? [{ path: '/gallery', icon: Image, label: t('nav.gallery', 'Галерея'), exact: false }] : []),
    ...(FEATURES.publisher ? [{ path: '/publisher', icon: Send, label: t('nav.publisher', 'Публикатор'), exact: false }] : []),
    ...(FEATURES.flow  ? [{ path: '/flow', icon: Workflow, label: 'TrendFlow',  exact: false }] : []),
  ];

  // При монтировании / смене токена — подтянуть баланс и тариф с бэка.
  React.useEffect(() => { refreshBilling(); }, [refreshBilling]);

  // ENTERPRISE v0.10.4: видимость пункта «Настройки Enterprise».
  // superadmin или активный тариф Enterprise. case-insensitive на всякий случай.
  const isEnterprise =
    user?.role === 'superadmin' ||
    (subscriptionTierName || '').toLowerCase() === 'enterprise' ||
    (subscriptionTier || '').toLowerCase() === 'enterprise';
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  // PWA install — кнопка показывается всегда, кроме случаев:
  //  - приложение уже запущено как установленная PWA (standalone)
  //  - Telegram Mini App (установка в WebView недоступна)
  const { showInstallDialog, isAvailable: pwaInstallAvailable } = usePWAInstall();

  return (
    <div
      className="flex h-[100dvh] overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ────────────────────────────────────
       * DESKTOP: Slim Left Sidebar (lg+)
       * ──────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-64 border-r flex-shrink-0"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
      >
        {/* Logo (clickable → /) */}
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center flex-1 min-w-0 no-select"
            aria-label={t('sidebar.logoAria')}
          >
            <VibeVoxLogo height={30} />
          </button>
          {/* Переключатели языка и темы */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <LanguageSwitcher />
            <button
              id="sidebar-theme-toggle"
              onClick={() => toggleGlobalTheme(isDark, setIsDark)}
              title={isDark ? t('sidebar.themeLight') : t('sidebar.themeDark')}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            >
              {isDark
                ? <Sun  size={15} strokeWidth={1.5} />
                : <Moon size={15} strokeWidth={1.5} />
              }
            </button>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {desktopNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-500 transition-all duration-150 no-select ${
                    isActive ? 'font-600' : 'hover:font-500'
                  }`
                }
                style={({ isActive }) => isActive
                  ? {
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-medium)',
                    }
                  : {
                      color: 'var(--text-muted)',
                      border: '1px solid transparent',
                    }
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* ENTERPRISE v0.10.4: пункт «Настройки Enterprise» — после «Тарифы» и до «Админ-панель» */}
          {isEnterprise && (
            <NavLink
              to="/settings/enterprise"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-500 transition-all duration-150 no-select ${
                  isActive ? 'font-600' : 'hover:font-500'
                }`
              }
              style={({ isActive }) => isActive
                ? {
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-medium)',
                  }
                : {
                    color: 'var(--text-muted)',
                    border: '1px solid transparent',
                  }
              }
            >
              {({ isActive }) => (
                <>
                  <Settings size={20} strokeWidth={isActive ? 2 : 1.5} />
                  <span>{t('nav.enterpriseSettings')}</span>
                </>
              )}
            </NavLink>
          )}

          {user?.role === 'superadmin' && (
            <NavLink
              to="/admin/config"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-500 transition-all duration-150 no-select ${
                  isActive ? 'font-600' : 'hover:font-500'
                }`
              }
              style={({ isActive }) => isActive
                ? {
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-medium)',
                  }
                : {
                    color: 'var(--text-muted)',
                    border: '1px solid transparent',
                  }
              }
            >
              {({ isActive }) => (
                <>
                  <ShieldAlert size={20} strokeWidth={isActive ? 2 : 1.5} />
                  <span>{t('nav.admin')}</span>
                </>
              )}
            </NavLink>
          )}

          {/* Create room CTA — только при включённых видеозвонках */}
          {FEATURES.video && (
          <button
            onClick={() => navigate('/?create=true')}
            className="flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-600 mt-2 transition-all duration-150 no-select"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            <Plus size={20} strokeWidth={2} />
            <span>{t('nav.createRoom')}</span>
          </button>
          )}
        </nav>

        {/* PWA Install — плашка между навигацией и user-card.
            Скрывается если приложение уже установлено или работает в Telegram.
            Слева — фирменный VibeVoxIcon (даёт понять что именно "VibeVox"
            окажется на устройстве). Описание без truncate — переносится на
            нужное число строк, чтобы влезло полностью на любом языке. */}
        {pwaInstallAvailable && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={showInstallDialog}
              className="w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-colors hover:bg-[var(--bg-elevated)]"
              style={{
                background: 'rgba(255,115,0,0.06)',
                border: '1px solid rgba(255,115,0,0.22)',
              }}
              aria-label={t('pwaInstall.buttonAria')}
            >
              <VibeVoxIcon size={36} bordered />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-600" style={{ color: '#ff7300' }}>
                  {t('pwaInstall.buttonLabel')}
                </p>
                <p className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('pwaInstall.buttonSubtitle')}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Объединённая карточка: User + Тариф + Баланс */}
        <div className="p-3 pb-5">
          <div className="rounded-2xl overflow-hidden"
               style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
            {/* User row — clickable, ведёт в /settings */}
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="flex items-center gap-3 w-full p-3 transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <AvatarCircle name={user?.name || user?.email} size="sm" status="online" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-600 truncate" style={{ color: 'var(--text-primary)' }}>
                  {user?.name || user?.email || 'User'}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {user?.email}
                </p>
              </div>
            </button>

            {/* Separator */}
            <div className="h-px mx-3" style={{ background: 'var(--border-subtle)' }} />

            {/* Balance + Tier */}
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="block w-full p-3 text-left transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  {t('balance.label')}
                </span>
                {subscriptionTierName && (
                  <span className="text-[10px] font-700 px-2 py-0.5 rounded-full"
                        style={{
                          background: subscriptionTierName === 'enterprise' ? 'rgba(167, 139, 250, 0.15)'
                                    : subscriptionTierName === 'standard_yearly' ? 'rgba(34, 211, 238, 0.15)'
                                    : subscriptionTierName === 'standard' ? 'rgba(16, 185, 129, 0.15)'
                                    : subscriptionTierName === 'plus' ? 'rgba(59, 130, 246, 0.15)'
                                    : 'rgba(148, 163, 184, 0.15)',
                          color: subscriptionTierName === 'enterprise' ? '#a78bfa'
                               : subscriptionTierName === 'standard_yearly' ? '#22d3ee'
                               : subscriptionTierName === 'standard' ? '#10b981'
                               : subscriptionTierName === 'plus' ? '#3b82f6'
                               : 'var(--text-muted)',
                        }}>
                    {subscriptionTierName === 'plus' ? t('tier.plus')
                     : subscriptionTierName === 'standard' ? t('tier.standard')
                     : subscriptionTierName === 'standard_yearly' ? t('tier.standardYearly')
                     : subscriptionTierName === 'enterprise' ? t('tier.enterprise')
                     : t('tier.trial')}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <MinutesDisplay
                  count={Math.floor(translationBalance / 60)}
                  numberClassName="text-2xl font-700"
                  numberStyle={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.03em', color: '#ff7300' }}
                  unitClassName="text-sm font-600"
                  unitStyle={{ color: '#ff7300' }}
                />
              </div>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (translationBalance / 18000) * 100)}%`,
                    background: 'linear-gradient(90deg, var(--text-secondary), var(--accent))',
                  }}
                />
              </div>

              {/* CTA-индикатор: вся карточка ведёт в /billing */}
              <div
                className="mt-2.5 flex items-center justify-center gap-1.5 py-1.5 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
              >
                <CreditCard size={12} strokeWidth={1.5} />
                <span className="text-xs font-600">{t('balance.tariffs')}</span>
              </div>
            </button>
          </div>

          {/* Версия приложения */}
          <AppVersion />
        </div>
      </aside>

      {/* ────────────────────────────────────
       * Main Content
       * ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header
          className="flex items-center justify-between px-4 py-3 border-b shrink-0 lg:hidden"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
        >
          {/* Logo (clickable → /) */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center no-select touch-target"
            aria-label={t('sidebar.logoAria')}
          >
            <VibeVoxLogo height={26} />
          </button>

          {/* Balance · hamburger — без обводок */}
          <div className="flex items-center gap-1">
            {/* Баланс — иконка чёрная (по теме), текст оранжевый */}
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="flex items-center gap-1 px-1.5 py-1.5 no-select touch-target"
              aria-label={t('balance.openPlans')}
            >
              <span style={{ color: 'var(--text-primary)' }}>
                <TranslationPhoneGlyph size={11} strokeWidth={1.5} />
              </span>
              <span className="text-xs font-600" style={{ color: '#ff7300' }}>
                <MinutesDisplay count={Math.floor(translationBalance / 60)} />
              </span>
            </button>

            {/* Переключатель языка */}
            <LanguageSwitcher />

            {/* Гамбургер — открывает More-sheet (вся остальная навигация: тема, аватар, настройки) */}
            <button
              id="mobile-menu-trigger"
              onClick={() => setMoreSheetOpen(true)}
              className="w-9 h-9 flex items-center justify-center transition-colors no-select touch-target"
              style={{ color: 'var(--text-secondary)' }}
              aria-label={t('nav.menu')}
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar-mobile" id="main-scroll">
          <div className={fullBleed ? 'px-3 py-3 lg:px-4 lg:py-4 animate-fade-in' : 'max-w-2xl mx-auto px-4 py-5 lg:px-8 lg:py-8 lg:max-w-5xl animate-fade-in'}>
            <Outlet />
          </div>
        </div>
      </main>

      {/* ── Mobile Bottom Tab Bar ── */}
      <BottomTabBar />

      {/* ── PWA install — авто-показ + триггер из кнопок mobile/desktop ── */}
      <PWAInstallPrompt />
    </div>
  );
}
