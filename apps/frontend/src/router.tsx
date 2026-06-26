/**
 * Роутер VibeVox — управление маршрутизацией и защитой маршрутов.
 *
 * Переключение макетов основано на флаге isMiniApp из Zustand store.
 * Защищает секретные роуты суперадмина мидлварями авторизации.
 */

import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
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

// OMNICHANNEL Фаза 2: конструктор цепочек — lazy (React Flow тяжёлый, грузим по входу).
const FlowPage = React.lazy(() => import('./pages/FlowPage'));
// TRENDTRAFFIC: анализатор трендов — lazy.
const TrendsPage = React.lazy(() => import('./pages/TrendsPage'));

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

// ============================================================================================
// LayoutSwitcher — переключатель Layout'ов
// ============================================================================================

function LayoutSwitcher() {
  const isMiniApp = useAppStore((state) => state.isMiniApp);
  return isMiniApp ? <MiniAppLayout /> : <MainLayout />;
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
          ...(FEATURES.trends ? [{
            path: 'trends',
            element: (
              <React.Suspense fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>…</div>}>
                <TrendsPage />
              </React.Suspense>
            ),
          }] : []),
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
