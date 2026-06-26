/**
 * Toast — лёгкая система всплывающих уведомлений в Aurora-стиле.
 *
 * Зачем: заменяет нативный `alert()` (уродливый, блокирующий, ломает iOS PWA).
 * Имеет глобальный singleton — можно звать `showToast(...)` из любого места
 * вне React-дерева (в catch-блоках, fetch-обработчиках и т.п.).
 *
 * Использование:
 *   import { showToast } from '@/components/Toast';
 *   showToast('Не удалось сохранить', 'error');
 *
 * Контейнер `<ToastContainer />` рендерится один раз в App.tsx.
 */

import React, { useEffect } from 'react';
import { create } from 'zustand';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastKind = 'error' | 'success' | 'info';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

const TOAST_TTL_MS = 5000;
let nextId = 1;

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, kind = 'error') => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => get().dismiss(id), TOAST_TTL_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Вызов из любого места — в т.ч. вне React-дерева. */
export function showToast(message: string, kind: ToastKind = 'error'): void {
  useToastStore.getState().show(message, kind);
}

const COLORS: Record<ToastKind, { fg: string; bg: string; border: string }> = {
  error: { fg: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.32)' },
  success: { fg: '#10b981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.32)' },
  info: { fg: '#60A5FA', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.32)' },
};

const ICONS: Record<ToastKind, React.ReactNode> = {
  error: <AlertCircle size={16} strokeWidth={2} />,
  success: <CheckCircle2 size={16} strokeWidth={2} />,
  info: <Info size={16} strokeWidth={2} />,
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    // Ничего — TTL уже в store.
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[200] flex flex-col gap-2 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)', right: 16, maxWidth: 'calc(100vw - 32px)' }}
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const c = COLORS[t.kind];
        return (
          <div
            key={t.id}
            className="pointer-events-auto rounded-2xl px-4 py-3 flex items-start gap-2.5 shadow-lg animate-fade-in"
            style={{
              background: 'var(--bg-secondary)',
              border: `1px solid ${c.border}`,
              minWidth: 260,
              maxWidth: 420,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: c.bg, color: c.fg }}
            >
              {ICONS[t.kind]}
            </div>
            <p className="text-sm leading-relaxed flex-1 break-words" style={{ color: 'var(--text-primary)' }}>
              {t.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-[var(--bg-tertiary)] transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
