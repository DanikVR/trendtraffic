/**
 * Роутер VibeVox — управление маршрутизацией и защитой маршрутов.
 *
 * Переключение макетов основано на флаге isMiniApp из Zustand store.
 * Защищает секретные роуты суперадмина мидлварями авторизации.
 */

import React from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useRouteError } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { useIsEnterprise } from './hooks/useIsEnterprise';
import { FEATURES, HOME_ROUTE_WHEN_NO_VIDEO } from './config/features';
import { MainLayout } from './layouts/MainLayout';
import { MiniAppLayout } from './layouts/MiniAppLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Страницы общего пользования
import { RoomPage }      from './pages/RoomPage';
import { BillingPage }   from './pages/BillingPage';
import { SipPage }       from './pages/SipPage';
import { SettingsPage }  from './pages/SettingsPage';
// TenantPromptPage удалена в v1.0.4 — её UI заменён Section2Prompt внутри
// /settings/enterprise (см. enterprise/Section2Prompt.tsx). Backend-эндпоинты
// /api/tenant-prompt/* остались — Section2Prompt их использует.
import { RoomChatPage } from './pages/RoomChatPage';
import { EnterpriseSettingsPage } from './pages/EnterpriseSettingsPage';
// ENTERPRISE v0.10.7: AssistantPage была UI-демкой, удалена.
// Backend модуль assistant/ оставлен как библиотека (deductAudioBalance, geminiProvider и др.).

// Новые ПУБЛИЧНЫЕ (маркетинговые/SEO/правовые) страницы — стиль VibeVox (оранжевый)
import { LandingPage }     from './pages/public/LandingPage';
import { PrivacyPage }     from './pages/public/PrivacyPage';
import { TermsPage }       from './pages/public/TermsPage';
import { CookiePage }      from './pages/public/CookiePage';

// Страницы авторизации — named exports
import { LoginPage }       from './pages/auth/LoginPage';
import { ForgotPassword }  from './pages/auth/ForgotPassword';
import { ResetPassword }   from './pages/auth/ResetPassword';
import { RegisterPage }    from './pages/auth/RegisterPage';
import { GoogleCallbackPage } from './pages/auth/GoogleCallbackPage';

// Страница суперадмина — default export
import AdminConfigPage from './pages/admin/AdminConfigPage';
import DialectsPage from './pages/admin/DialectsPage';
import PromocodesPage from './pages/admin/PromocodesPage';
import UsersPage from './pages/admin/UsersPage';
import PartnersPage from './pages/admin/PartnersPage';

/**
 * Ленивая загрузка с авто-перезагрузкой при «Failed to fetch dynamically imported
 * module». Это бывает ПОСЛЕ ДЕПЛОЯ: открытая вкладка ссылается на старый
 * хеш-чанк (напр. FlowPage-Bk_VdDJI.js), которого в новой сборке уже нет (404).
 * Один раз перезагружаем страницу за свежим index.html+чанками. Защита от цикла —
 * не чаще раза в 10с (sessionStorage-таймстамп).
 */
function lazyWithRetry<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return React.lazy(() =>
    factory().catch((err) => {
      const last = Number(sessionStorage.getItem('vv_chunk_reload_ts') || '0');
      if (Date.now() - last > 10000) {
        sessionStorage.setItem('vv_chunk_reload_ts', String(Date.now()));
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // страница перезагружается — не резолвим
      }
      throw err;
    })
  );
}

// OMNICHANNEL Фаза 2: конструктор цепочек — lazy (React Flow тяжёлый, грузим по входу).
const FlowPage = lazyWithRetry(() => import('./pages/FlowPage'));
const GalleryPage = lazyWithRetry(() => import('./pages/GalleryPage'));
const PublisherPage = lazyWithRetry(() => import('./pages/PublisherPage'));
// TRENDTRAFFIC: вкладка «Social Media Extension» (рехостинг TikHub-расширения) — lazy.
const SocialExtensionPage = lazyWithRetry(() => import('./pages/SocialExtensionPage'));
// TRENDTRAFFIC: «Каналы» — анализ всех видео канала по ссылке — lazy.
const ChannelsPage = lazyWithRetry(() => import('./pages/ChannelsPage'));

// ============================================================================================
// Мидлвари защиты роутов
// ============================================================================================

/**
 * Защита страниц: перенаправляет на страницу входа, если токен отсутствует.
 */
function RequireAuth() {
  const token = useAppStore((state) => state.token);
  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }
  return <Outlet />;
}

/**
 * Защита для суперадмина: перенаправляет на главную, если роль не 'superadmin'.
 */
function RequireAdmin() {
  const user = useAppStore((state) => state.user);
  if (!user || user.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/**
 * Защита Enterprise-фич: пускает superadmin или активный тариф Enterprise
 * (правило-зеркало MainLayout.tsx). Иначе — на «Тарифы» (апселл; /trends удалён).
 */
function RequireEnterprise() {
  const isEnterprise = useIsEnterprise();
  if (!isEnterprise) {
    return <Navigate to="/billing" replace />;
  }
  return <Outlet />;
}

/** Простой полноэкранный лоадер на время, пока подгружается статус подписки. */
function PaidGateLoader() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="animate-spin" aria-label="Загрузка"
           style={{ width: 28, height: 28, border: '3px solid var(--border-medium)',
                    borderTopColor: 'var(--brand)', borderRadius: '50%' }} />
    </div>
  );
}

/**
 * RequirePaid — единый гейт «неоплачен → только тарифы». Пускает superadmin и активный
 * платный тариф (Премиум/Энтерпрайз, включая 7-дневный триал). Неоплаченному открыты
 * ТОЛЬКО /billing (оплатить/промокод/триал) и /settings (аккаунт/выход) — всё остальное
 * редиректит на /billing. Это закрывает «дыры» (/flow, /gallery, /publisher и т.д.).
 *
 * Пока статус подписки ещё не загружен (billingLoaded=false) — НЕ редиректим, показываем
 * лоадер. Иначе платного юзера при перезагрузке закрытой страницы выбросило бы на /billing
 * (setAuth ставит временный 'trial' до того, как refreshBilling вернёт реальный тариф).
 */
function RequirePaid() {
  const isEnterprise = useIsEnterprise();
  const billingLoaded = useAppStore((s) => s.billingLoaded);
  const token = useAppStore((s) => s.token);
  const { pathname } = useLocation();

  // САМОЛЕЧЕНИЕ ГЕЙТА: если есть токен, но статус подписки ещё не загружен —
  // запускаем refreshBilling прямо отсюда. Раньше это делал только MainLayout, но он
  // сам находится за этим гейтом → при свежем входе (email/Google) loader висел вечно
  // (deadlock: ждём billingLoaded, а обновить его некому). Теперь гейт всегда разрешится.
  React.useEffect(() => {
    if (token && !billingLoaded) {
      void useAppStore.getState().refreshBilling();
    }
  }, [token, billingLoaded]);

  const allowedWhenUnpaid = pathname === '/billing' || pathname.startsWith('/settings');
  if (isEnterprise || allowedWhenUnpaid) return <Outlet />;
  if (token && !billingLoaded) return <PaidGateLoader />;
  return <Navigate to="/billing" replace />;
}

// ============================================================================================
// LayoutSwitcher — переключатель Layout'ов
// ============================================================================================

function LayoutSwitcher() {
  const isMiniApp = useAppStore((state) => state.isMiniApp);
  return isMiniApp ? <MiniAppLayout /> : <MainLayout />;
}

/** Дружелюбный экран ошибки роутера (вместо dev «Hey developer»). */
function RouteErrorElement() {
  // Частая причина — устаревший lazy-чанк после деплоя (хеши сменились, а вкладка старая).
  // Авто-перезагружаемся один раз (с защитой от петли), чтобы пользователь не видел белый экран.
  const err = useRouteError() as any;
  React.useEffect(() => {
    const msg = String(err?.message || err?.toString?.() || err || '');
    const isChunk = err?.name === 'ChunkLoadError'
      || /dynamically imported module|Failed to fetch|module script failed|error loading dynamically|Loading chunk/i.test(msg);
    if (!isChunk) return;
    const KEY = 'tt_chunk_reload_at';
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last > 12000) { // не чаще раза в 12с → без бесконечной петли
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    }
  }, [err]);
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Что-то пошло не так</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 380, lineHeight: 1.5 }}>
        Возможно, вышло обновление приложения. Обновите страницу — обычно это решает проблему.
      </div>
      <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '10px 20px', borderRadius: 12, border: 'none', background: 'var(--btn-primary-bg, var(--brand))', color: 'var(--brand-contrast)', fontWeight: 700, cursor: 'pointer' }}>
        Обновить страницу
      </button>
    </div>
  );
}

// ============================================================================================
// Конфигурация маршрутов
// ============================================================================================

export const router = createBrowserRouter([
  // Новая публичная заглавная страница (без авторизации). Существующий
  // дашборд на '/' не затрагивается — лендинг живёт на отдельном роуте.
  {
    path: '/landing',
    element: <LandingPage />,
  },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/terms', element: <TermsPage /> },
  { path: '/cookies', element: <CookiePage /> },
  // Публичные страницы авторизации
  {
    path: '/auth/login',
    element: <LoginPage />,
  },
  {
    path: '/auth/forgot-password',
    element: <ForgotPassword />,
  },
  {
    path: '/auth/reset-password',
    element: <ResetPassword />,
  },
  {
    path: '/auth/register',
    element: <RegisterPage />,
  },
  {
    path: '/auth/google/callback',
    element: <GoogleCallbackPage />,
  },
  // Публичный маршрут комнаты (видеозвонки — фич-флаг `video`)
  ...(FEATURES.video ? [{
    path: '/room/:roomId',
    element: <RoomPage />,
  }] : []),

  // Защищенные системные страницы (требуют токен)
  {
    path: '/',
    element: <RequireAuth />,
    errorElement: <RouteErrorElement />,
    children: [
      {
        // Гейт оплаты: неоплаченный видит только /billing и /settings.
        element: <RequirePaid />,
        children: [
      {
        element: <LayoutSwitcher />,
        children: [
          {
            // Домашняя = список видео-комнат. Если video выключен — редирект на fallback.
            index: true,
            element: FEATURES.video ? <RoomPage /> : <Navigate to={HOME_ROUTE_WHEN_NO_VIDEO} replace />,
          },
          {
            path: 'billing',
            element: <BillingPage />,
          },
          ...(FEATURES.sip ? [{
            path: 'sip',
            element: <SipPage />,
          }] : []),
          {
            path: 'settings',
            element: <SettingsPage />,
          },
          // /assistant-prompt удалён в v1.0.4 — функционал перенесён в
          // /settings/enterprise вкладка «Подсказки» (Section2Prompt).
          // ENTERPRISE v0.10.0: чат с клиентом (только creator + Enterprise)
          {
            path: 'room/:roomId/chat',
            element: <RoomChatPage />,
          },
          // ENTERPRISE v0.10.0: единая страница настроек Enterprise (4 секции + готова под 5+)
          {
            path: 'settings/enterprise',
            element: <EnterpriseSettingsPage />,
          },
          ...(FEATURES.flow ? [{
            path: 'flow',
            element: (
              <React.Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>…</div>}>
                <FlowPage />
              </React.Suspense>
            ),
          }] : []),
          ...(FEATURES.gallery ? [{
            path: 'gallery',
            element: (
              <React.Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>…</div>}>
                <GalleryPage />
              </React.Suspense>
            ),
          }] : []),
          ...(FEATURES.publisher ? [{
            path: 'publisher',
            element: (
              <React.Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>…</div>}>
                <PublisherPage />
              </React.Suspense>
            ),
          }] : []),
          ...(FEATURES.socialMediaExt ? [{
            // Только Enterprise (+superadmin). Гейт — RequireEnterprise.
            element: <RequireEnterprise />,
            children: [{
              path: 'social-extension',
              element: (
                <React.Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>…</div>}>
                  <SocialExtensionPage />
                </React.Suspense>
              ),
            }],
          }] : []),
          ...(FEATURES.channels ? [{
            // «Каналы» — только Enterprise (+superadmin). Гейт — RequireEnterprise.
            element: <RequireEnterprise />,
            children: [{
              path: 'channels',
              element: (
                <React.Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>…</div>}>
                  <ChannelsPage />
                </React.Suspense>
              ),
            }],
          }] : []),
        ],
      },
        ],
      },
      // Маршруты суперадмина (требуют роль superadmin)
      {
        path: 'admin',
        element: <RequireAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              {
                path: 'config',
                element: <AdminConfigPage />,
              },
              ...(FEATURES.learnHub ? [{
                path: 'dialects',
                element: <DialectsPage />,
              }] : []),
              {
                path: 'promocodes',
                element: <PromocodesPage />,
              },
              {
                path: 'users',
                element: <UsersPage />,
              },
              ...(FEATURES.partners ? [{
                path: 'partners',
                element: <PartnersPage />,
              }] : []),
            ],
          },
        ],
      },
    ],
  },
  // Fallback редирект на главную
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
