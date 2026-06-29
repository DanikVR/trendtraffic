/**
 * MiniAppLayout — Layout для Telegram Mini App (Abyss Aurora).
 * Без Bottom Tab Bar — компактный header + полноэкранный контент.
 */

import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';

export function MiniAppLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isRoot    = location.pathname === '/';

  return (
    <div
      className="flex flex-col h-[100dvh] overflow-hidden no-select"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0 border-b"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
      >
        {!isRoot && (
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors touch-target"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            aria-label="Назад"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #38BDF8)' }}
          >
            <Zap size={14} strokeWidth={2} className="text-white" />
          </div>
          <span
            className="text-base font-700"
            style={{
              fontFamily: 'Geist Sans, sans-serif',
              letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #60A5FA, #38BDF8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            VibeVox
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
