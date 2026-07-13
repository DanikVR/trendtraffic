/**
 * MainLayout — основной Layout VibeVox (Abyss Aurora).
 *
 * Mobile-first: BottomTabBar внизу + header сверху.
 * Desktop (lg+): slim left sidebar с иконками + labels.
 */

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  Plus,
  Sun,
  Moon,
  ShieldAlert,
  Settings,
  Menu,
  TrendingUp,
  Users,
  Send,
  BookOpen,
  Clapperboard,
  Video,
  Loader2,
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
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { PWAInstallPrompt, usePWAInstall } from '../components/PWAInstallPrompt';
import { useAppStore }   from '../store/useAppStore';
import { useIsEnterprise } from '../hooks/useIsEnterprise';
import { FEATURES }      from '../config/features';

export function MainLayout() {
  const { t } = useTranslation('common');
  const { user, token, subscriptionTier, subscriptionTierName, refreshBilling, setMoreSheetOpen } = useAppStore();
  // Конструктор цепочек (/flow) — на всю ширину (холст React Flow), без центрирующего max-w.
  const { pathname } = useLocation();
  // /flow (холст React Flow) и /social-extension (iframe расширения) — на всю ширину.
  const iframeFull = pathname.startsWith('/social-extension');
  // Широкая лента (как «Тренды»), но без iframe-h-full: /channels, /gallery, /publisher, /flow.
  const fullBleed = pathname.startsWith('/flow') || pathname.startsWith('/channels')
    || pathname.startsWith('/gallery') || pathname.startsWith('/publisher') || iframeFull;

  // ENTERPRISE: видимость Enterprise-пунктов — единый источник истины (хук).
  const isEnterprise = useIsEnterprise();

  // Индикаторы генерации в САЙДБАРЕ: пока в Hotebook/Google Flow что-то генерится, на иконке
  // раздела крутится спиннер — видно с любого экрана, даже уйдя из Галереи.
  const [hbGen, setHbGen] = useState(0);
  const [flowGen, setFlowGen] = useState(0);
  useEffect(() => {
    if (!token || !isEnterprise) { setHbGen(0); setFlowGen(0); return; }
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/notebooklm/jobs?active=1', { headers: { Authorization: `Bearer ${token}` } });
        if (alive && r.ok) {
          const d = await r.json();
          setHbGen(Array.isArray(d.jobs) ? d.jobs.length : 0);
        }
      } catch { /* не критично */ }
      try {
        const r2 = await fetch('/api/flow-ext/observed', { headers: { Authorization: `Bearer ${token}` } });
        if (alive && r2.ok) {
          const d2 = await r2.json();
          const obs = d2.observed && typeof d2.observed === 'object' ? d2.observed : {};
          setFlowGen(Object.values(obs).reduce((s: number, n: any) => s + (Number(n) || 0), 0));
        }
      } catch { /* не критично */ }
    };
    poll();
    const iv = setInterval(poll, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, [token, isEnterprise]);

  // Сайдбар = быстрый переход по вкладкам ГАЛЕРЕИ (главный экран-хаб, 2026-07-08).
  // Всё открывается ВНУТРИ Галереи: пункт ведёт на /gallery?tab=… и переключает вкладку.
  // «Каналы» переехали внутрь «Тренды», страница /publisher удалена (Публикатор — вкладка).
  const galleryNav = [
    { tab: 'trendhub',  icon: TrendingUp,  label: t('nav.trends', 'Тренды') },
    { tab: 'ugc',       icon: Users,       label: 'UGC' },
    { tab: 'flow',      icon: Clapperboard, label: 'Google Flow' },
    { tab: 'hotebook',  icon: BookOpen,    label: 'Hotebook' },
    { tab: 'reference', icon: Video,       label: t('nav.gallery', 'Медиафайлы') },
    { tab: 'publisher', icon: Send,        label: t('nav.publisher', 'Публикатор') },
  ];
  // Активная вкладка Галереи — из ?tab= (дефолт 'trendhub'); подсвечиваем пункт сайдбара.
  const { search } = useLocation();
  const curGalleryTab = pathname === '/gallery' ? (new URLSearchParams(search).get('tab') || 'trendhub') : null;

  // При монтировании / смене токена — подтянуть баланс и тариф с бэка.
  React.useEffect(() => { refreshBilling(); }, [refreshBilling]);

  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );
  // Левый сайдбар ВСЕГДА свёрнут (только иконки) — по слову юзера (2026-07-08).

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
        className="hidden lg:flex flex-col w-[68px] border-r flex-shrink-0"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
      >
        {/* Header (всегда свёрнут): только лого-иконка → домой (Галерея).
            Язык и тема переехали ВНИЗ сайдбара — по слову юзера (2026-07-08). */}
        <div className="flex flex-col items-center px-2 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <button type="button" onClick={() => navigate('/gallery')} className="no-select" aria-label={t('sidebar.logoAria')} title="Галерея — на главный экран">
            <img src="/icons/logo.png?v=tt3" alt="" width={36} height={36} draggable={false} style={{ objectFit: 'contain' }} />
          </button>
        </div>

        {/* Nav: быстрые переходы во вкладки Галереи (иконки + tooltip) */}
        <nav className="flex-1 px-2 py-4 flex flex-col items-center gap-1.5">
          {galleryNav.map((item) => {
            const Icon = item.icon;
            const isActive = curGalleryTab === item.tab;
            const generating = (item.tab === 'hotebook' && hbGen > 0) || (item.tab === 'flow' && flowGen > 0);
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => navigate(`/gallery?tab=${item.tab}`)}
                title={generating ? `${item.label} — идёт генерация (${item.tab === 'flow' ? flowGen : hbGen})` : item.label}
                aria-label={item.label}
                className="relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-150 no-select"
                style={isActive
                  ? { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }
                  : { color: 'var(--text-muted)', border: '1px solid transparent', background: 'transparent', cursor: 'pointer' }}
              >
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                {generating && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <Loader2 size={11} className="animate-spin" style={{ color: item.tab === 'flow' ? '#6366f1' : '#22d3ee' }} />
                  </span>
                )}
              </button>
            );
          })}

          {/* Шестерёнка «Настройки Enterprise» — в конце (иконка) */}
          {isEnterprise && (
            <NavLink
              to="/settings/enterprise"
              title={t('nav.enterpriseSettings')}
              aria-label={t('nav.enterpriseSettings')}
              className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-150 no-select mt-1"
              style={({ isActive }) => isActive
                ? { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }
                : { color: 'var(--text-muted)', border: '1px solid transparent' }}
            >
              {({ isActive }) => <Settings size={20} strokeWidth={isActive ? 2 : 1.5} />}
            </NavLink>
          )}

          {user?.role === 'superadmin' && (
            <NavLink
              to="/admin/config"
              title={t('nav.admin')}
              aria-label={t('nav.admin')}
              className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-150 no-select"
              style={({ isActive }) => isActive
                ? { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }
                : { color: 'var(--text-muted)', border: '1px solid transparent' }}
            >
              {({ isActive }) => <ShieldAlert size={20} strokeWidth={isActive ? 2 : 1.5} />}
            </NavLink>
          )}
        </nav>

        {/* PWA Install — свёрнутый сайдбар: компактная иконка-кнопка (установить приложение) */}
        {pwaInstallAvailable && (
          <div className="px-2 pb-3 flex justify-center">
            <button
              type="button"
              onClick={showInstallDialog}
              className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors hover:bg-[var(--bg-elevated)]"
              style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.22)' }}
              aria-label={t('pwaInstall.buttonAria')} title={t('pwaInstall.buttonLabel')}
            >
              <img src="/icons/logo.png?v=tt3" alt="" width={28} height={28} draggable={false} style={{ objectFit: 'contain' }} />
            </button>
          </div>
        )}

        {/* Низ сайдбара (по слову юзера 2026-07-08): язык + тема, затем тариф + аватар */}
        <div className="p-2 pb-4 flex flex-col items-center gap-2">
          <LanguageSwitcher />
          <button
            id="sidebar-theme-toggle"
            onClick={() => toggleGlobalTheme(isDark, setIsDark)}
            title={isDark ? t('sidebar.themeLight') : t('sidebar.themeDark')}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
          >
            {isDark ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
          </button>
          <button type="button" onClick={() => navigate('/billing')} title={t('balance.tariffs')}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--brand)' }}>
            <CreditCard size={16} strokeWidth={1.5} />
          </button>
          <button type="button" onClick={() => navigate('/settings')} title={user?.email || ''} className="no-select">
            <AvatarCircle name={user?.name || user?.email} size="sm" status="online" />
          </button>
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
