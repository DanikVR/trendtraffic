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
  Users,
  Image,
  Send,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

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
import { PWAInstallPrompt, usePWAInstall } from '../components/PWAInstallPrompt';
import { useAppStore }   from '../store/useAppStore';
import { useIsEnterprise } from '../hooks/useIsEnterprise';
import { FEATURES }      from '../config/features';

export function MainLayout() {
  const { t } = useTranslation('common');
  const { user, subscriptionTier, subscriptionTierName, refreshBilling, setMoreSheetOpen } = useAppStore();
  // Конструктор цепочек (/flow) — на всю ширину (холст React Flow), без центрирующего max-w.
  const { pathname } = useLocation();
  // /flow (холст React Flow) и /social-extension (iframe расширения) — на всю ширину.
  const iframeFull = pathname.startsWith('/social-extension');
  // Широкая лента (как «Тренды»), но без iframe-h-full: /channels, /gallery, /publisher, /flow.
  const fullBleed = pathname.startsWith('/flow') || pathname.startsWith('/channels')
    || pathname.startsWith('/gallery') || pathname.startsWith('/publisher') || iframeFull;

  // ENTERPRISE: видимость Enterprise-пунктов — единый источник истины (хук).
  const isEnterprise = useIsEnterprise();

  // Фич-флаги: пункты навигации появляются только для включённых функций.
  // Боковые иконки — стандартные lucide (брендовые PNG используются только в шапках разделов).
  const desktopNav = [
    ...(FEATURES.video ? [{ path: '/',    icon: Languages, label: t('nav.rooms'), exact: true  }] : []),
    ...(FEATURES.sip   ? [{ path: '/sip', icon: Phone,     label: t('nav.sip'),   exact: false }] : []),
    // «Тренды» → расширение (/social-extension). Гейт Enterprise — RequireEnterprise
    // (не-Enterprise редиректит на Тарифы). Старая страница /trends удалена.
    ...(FEATURES.socialMediaExt
      ? [{ path: '/social-extension', icon: TrendingUp, label: t('nav.trends', 'Тренды'), exact: false }]
      : []),
    ...(FEATURES.gallery ? [{ path: '/gallery', icon: Image, label: t('nav.gallery', 'Галерея'), exact: false }] : []),
    ...(FEATURES.publisher ? [{ path: '/publisher', icon: Send, label: t('nav.publisher', 'Публикатор'), exact: false }] : []),
    ...(FEATURES.flow  ? [{ path: '/flow', icon: Workflow, label: 'TrendFlow',  exact: false }] : []),
    // «Каналы» → анализ всех видео канала (/channels). Гейт Enterprise — RequireEnterprise.
    ...(FEATURES.channels ? [{ path: '/channels', icon: Users, label: t('nav.channels', 'Каналы'), exact: false }] : []),
  ];

  // При монтировании / смене токена — подтянуть баланс и тариф с бэка.
  React.useEffect(() => { refreshBilling(); }, [refreshBilling]);

  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );
  // Левый сайдбар: по умолчанию свёрнут (только иконки), раскрывается по клику.
  const [navCollapsed, setNavCollapsed] = useState(
    () => localStorage.getItem('vv_sidebar_collapsed') !== 'false'
  );
  const toggleNav = () => setNavCollapsed((c) => {
    const n = !c;
    localStorage.setItem('vv_sidebar_collapsed', String(n));
    return n;
  });

  // PWA install — кнопка показывается всегда, кроме случаев:
  //  - приложение уже запущено как установленная PWA (standalone)
  //  - Telegram Mini App (установка в WebView недоступна)
  const { showInstallDialog, isAvailable: pwaInstallAvailable } = usePWAInstall();

  // Impersonation: суперадмин «вошёл в аккаунт пользователя» (UsersPage). Бэкап его сессии
  // лежит в sessionStorage (переживает reload вкладки). Показываем баннер возврата.
  const impersonation = (() => {
    try {
      const raw = sessionStorage.getItem('tt_impersonation_backup');
      return raw ? (JSON.parse(raw) as { token: string; user: { email?: string } }) : null;
    } catch { return null; }
  })();
  const exitImpersonation = () => {
    try {
      const raw = sessionStorage.getItem('tt_impersonation_backup');
      sessionStorage.removeItem('tt_impersonation_backup');
      if (raw) { const b = JSON.parse(raw); useAppStore.getState().setAuth(b.token, b.user); }
    } catch { /* приватный режим */ }
    window.location.href = '/admin/users';
  };

  return (
    <div
      className="flex h-[100dvh] overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {impersonation && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '7px 16px', fontSize: 13, fontWeight: 600,
          background: 'linear-gradient(90deg,#6366f1,#818cf8)', color: '#fff',
          boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
        }}>
          <span>Вход от суперадмина: вы работаете как <b>{user?.email || 'пользователь'}</b></span>
          <button type="button" onClick={exitImpersonation}
                  style={{ background: '#fff', color: '#4f46e5', borderRadius: 8,
                           padding: '4px 12px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
            ← Вернуться в админку
          </button>
        </div>
      )}
      {/* ────────────────────────────────────
       * DESKTOP: Slim Left Sidebar (lg+)
       * ──────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col ${navCollapsed ? 'w-[68px]' : 'w-64'} border-r flex-shrink-0 transition-[width] duration-200`}
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
      >
        {/* Свёрнутый режим: прячем подписи у пунктов навигации и центруем иконки. */}
        <style>{`
          .vv-nav-collapsed > a, .vv-nav-collapsed > button { justify-content: center; padding-left: 0; padding-right: 0; }
          .vv-nav-collapsed > a > span, .vv-nav-collapsed > button > span { display: none; }
        `}</style>
        {/* Header: лого + переключатели + кнопка сворачивания.
            Развёрнутый режим — лого на ОТДЕЛЬНОЙ строке (крупно, на всю ширину),
            под ним строка контролов. Так логотип не зажат справа кнопками. */}
        {navCollapsed ? (
          <div className="flex flex-col items-center gap-2 px-2 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <button type="button" onClick={() => navigate('/')} className="no-select" aria-label={t('sidebar.logoAria')}>
              <VibeVoxIcon size={32} bordered />
            </button>
            <button
              onClick={toggleNav}
              title="Развернуть меню"
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            >
              <PanelLeftOpen size={15} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-5 py-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            {/* Лого — отдельной строкой, на всю ширину сайдбара */}
            <button type="button" onClick={() => navigate('/')} className="flex items-center no-select" aria-label={t('sidebar.logoAria')}>
              <VibeVoxLogo height={44} />
            </button>
            {/* Переключатели языка и темы + сворачивание */}
            <div className="flex items-center gap-1">
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
              <button
                onClick={toggleNav}
                title="Свернуть меню"
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ml-auto"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                <PanelLeftClose size={15} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav className={`flex-1 px-3 py-4 flex flex-col gap-1 ${navCollapsed ? 'vv-nav-collapsed' : ''}`}>
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
        {!navCollapsed && pwaInstallAvailable && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={showInstallDialog}
              className="w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-colors hover:bg-[var(--bg-elevated)]"
              style={{
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.22)',
              }}
              aria-label={t('pwaInstall.buttonAria')}
            >
              <VibeVoxIcon size={36} bordered />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-600" style={{ color: 'var(--brand)' }}>
                  {t('pwaInstall.buttonLabel')}
                </p>
                <p className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('pwaInstall.buttonSubtitle')}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Объединённая карточка: User + Тариф + Баланс. В свёрнутом — только аватар + тариф. */}
        {navCollapsed ? (
          <div className="p-2 pb-4 flex flex-col items-center gap-2">
            <button type="button" onClick={() => navigate('/billing')} title={t('balance.tariffs')}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--brand)' }}>
              <CreditCard size={16} strokeWidth={1.5} />
            </button>
            <button type="button" onClick={() => navigate('/settings')} title={user?.email || ''} className="no-select">
              <AvatarCircle name={user?.name || user?.email} size="sm" status="online" />
            </button>
          </div>
        ) : (
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

            {/* Тариф (минуты убраны — TrendTraffic их не использует) */}
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="block w-full p-3 text-left transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <span className="text-[10px] font-700 uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                {t('balance.tariffLabel', 'Тариф')}
              </span>
              {(() => {
                const raw = (subscriptionTierName || '').toLowerCase();
                const map: Record<string, { bg: string; fg: string; label: string }> = {
                  premium:         { bg: 'rgba(99,102,241,0.15)',  fg: '#818cf8', label: 'Premium' },
                  enterprise:      { bg: 'rgba(167,139,250,0.15)', fg: '#a78bfa', label: 'Enterprise' },
                  standard_yearly: { bg: 'rgba(34,211,238,0.15)',  fg: '#22d3ee', label: 'Standard (год)' },
                  standard:        { bg: 'rgba(16,185,129,0.15)',  fg: '#10b981', label: 'Standard' },
                  plus:            { bg: 'rgba(59,130,246,0.15)',  fg: '#3b82f6', label: 'Plus' },
                };
                const m = map[raw];
                return (
                  <span className="text-sm font-700 px-2.5 py-1 rounded-lg inline-block"
                        style={{ background: m ? m.bg : 'rgba(148,163,184,0.12)', color: m ? m.fg : 'var(--text-muted)', fontFamily: 'Geist Sans, sans-serif' }}>
                    {m ? m.label : 'Не активна'}
                  </span>
                );
              })()}

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
        )}
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
            <VibeVoxLogo height={30} />
          </button>

          {/* Balance · hamburger — без обводок */}
          <div className="flex items-center gap-1">
            {/* Баланс — иконка чёрная (по теме), текст оранжевый */}
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="flex items-center gap-1 px-1.5 py-1.5 no-select touch-target"
              aria-label={t('balance.tariffs')}
            >
              <CreditCard size={18} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
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
          {/* iframeFull (/social-extension): даём обёртке полную высоту, чтобы iframe-страница
              растянулась через flex/h-full без магического calc(100dvh - …). */}
          <div className={(fullBleed ? 'px-3 py-3 lg:px-4 lg:py-4 animate-fade-in' : 'max-w-2xl mx-auto px-4 py-5 lg:px-8 lg:py-8 lg:max-w-5xl animate-fade-in') + (iframeFull ? ' h-full' : '')}>
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
