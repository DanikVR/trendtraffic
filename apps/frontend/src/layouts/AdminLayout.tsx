/**
 * AdminLayout — макет для панели суперадмина VibeVox.
 * 
 * Предоставляет левую навигационную панель для десктопа (lg+)
 * и верхние вкладки навигации для мобильной версии, а также
 * удобный возврат на основную часть сайта без логаута.
 */

import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Sliders,
  Brain,
  Tag,
  Users,
  ArrowLeft,
  Sun,
  Moon,
  LogOut,
  Zap,
  HeartHandshake,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { AvatarCircle } from '../components/AvatarCircle';
import { AppVersion } from '../components/AppVersion';

// ── Функция переключения темы (синхронизация с системой) ──
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

export function AdminLayout() {
  const { user, logout } = useAppStore();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark')
  );

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
  };

  return (
    <div
      className="flex flex-col lg:flex-row h-[100dvh] overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ────────────────────────────────────
       * DESKTOP: Left Sidebar (lg+)
       * ──────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-64 border-r flex-shrink-0"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
      >
        {/* Логотип и переключатель темы */}
        <div className="flex flex-col gap-2 px-5 py-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
            >
              <Zap size={18} strokeWidth={2} color="#fff" />
            </div>
            <span
              className="flex-1 text-lg font-700"
              style={{ fontFamily: 'Geist Sans, sans-serif', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}
            >
              VibeVox
            </span>
            <button
              onClick={() => toggleGlobalTheme(isDark, setIsDark)}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              title={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
          <div className="flex items-center mt-1">
            <span
              className="px-2 py-0.5 text-[10px] font-700 tracking-wider rounded-full uppercase"
              style={{
                background: 'rgba(99, 102, 241, 0.12)',
                color: 'var(--brand)',
                border: '1px solid rgba(99, 102, 241, 0.24)',
              }}
            >
              Суперадмин-панель
            </span>
          </div>
        </div>

        {/* Навигация */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
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
                <Sliders size={20} strokeWidth={isActive ? 2 : 1.5} />
                <span>Настройки API</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/admin/dialects"
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
                <Brain size={20} strokeWidth={isActive ? 2 : 1.5} />
                <span>AI Learning Hub</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/admin/promocodes"
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
                <Tag size={20} strokeWidth={isActive ? 2 : 1.5} />
                <span>Промокоды</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/admin/users"
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
                <Users size={20} strokeWidth={isActive ? 2 : 1.5} />
                <span>Пользователи</span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/admin/partners"
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
                <HeartHandshake size={20} strokeWidth={isActive ? 2 : 1.5} />
                <span>Партнёры</span>
              </>
            )}
          </NavLink>

          {/* Разделитель */}
          <div className="my-3 border-t" style={{ borderColor: 'var(--border-subtle)' }} />

          {/* Возврат на главный интерфейс пользователя */}
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-500 transition-all duration-150 no-select"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid transparent',
            }}
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
            <span>Вернуться на сайт</span>
          </NavLink>
        </nav>

        {/* Нижний блок администратора */}
        <div className="p-3 pb-5 space-y-3">
          <div
            className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)' }}
          >
            <AvatarCircle name={user?.name || user?.email} size="sm" status="online" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-600 truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.name || 'Администратор'}
              </p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444] transition-all"
              style={{ color: 'var(--text-muted)' }}
              title="Выйти из аккаунта"
            >
              <LogOut size={15} />
            </button>
          </div>

          <AppVersion />
        </div>
      </aside>

      {/* ────────────────────────────────────
       * MOBILE: Header & Top Tabs Sub-nav
       * ──────────────────────────────────── */}
      <header
        className="flex flex-col border-b shrink-0 lg:hidden"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
            >
              <Zap size={15} strokeWidth={2} color="#fff" />
            </div>
            <span
              className="text-base font-700"
              style={{ fontFamily: 'Geist Sans, sans-serif', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}
            >
              VibeVox Admin
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleGlobalTheme(isDark, setIsDark)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              title="Вернуться на сайт"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
        </div>

        {/* Вкладки для мобильной навигации */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          <NavLink
            to="/admin/config"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-xl text-xs font-600 whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
              }`
            }
          >
            ⚙️ Настройки API
          </NavLink>
          <NavLink
            to="/admin/dialects"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-xl text-xs font-600 whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
              }`
            }
          >
            🧠 AI Learning Hub
          </NavLink>
          <NavLink
            to="/admin/promocodes"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-xl text-xs font-600 whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
              }`
            }
          >
            🏷 Промокоды
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-xl text-xs font-600 whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
              }`
            }
          >
            👥 Пользователи
          </NavLink>
          <NavLink
            to="/admin/partners"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-xl text-xs font-600 whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
              }`
            }
          >
            🤝 Партнёры
          </NavLink>
        </div>
      </header>

      {/* ────────────────────────────────────
       * Main Content Area
       * ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto" id="admin-main-scroll">
        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8 max-w-6xl w-full mx-auto animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
