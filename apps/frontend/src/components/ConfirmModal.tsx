/**
 * ConfirmModal — стилизованный confirm-диалог в фирменном Aurora-стиле.
 *
 * Заменяет нативный `window.confirm(...)` — браузерный диалог уродлив и
 * не соответствует дизайну приложения. Поддерживает:
 *  - title + сообщение (опционально с акцентом)
 *  - кастомный текст кнопок (default: «Да» / «Отмена»)
 *  - вариант кнопки подтверждения: 'primary' (фиолетовый) | 'danger' (красный)
 *  - закрытие по Esc и клику на backdrop
 */

import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Да',
  cancelLabel = 'Отмена',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', handler);
    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const accentColor = variant === 'danger' ? '#ef4444' : '#8B5CF6';
  const accentBg = variant === 'danger' ? 'rgba(239,68,68,0.10)' : 'rgba(139,92,246,0.10)';
  const confirmBg = variant === 'danger'
    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
    : 'linear-gradient(135deg, #8B5CF6, #6366F1)';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-start gap-3 border-b" style={{ borderColor: 'var(--border-medium)' }}>
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: accentBg, color: accentColor }}
          >
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-700 leading-tight" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {message && (
          <div className="px-5 py-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 flex justify-end gap-2 border-t" style={{ borderColor: 'var(--border-medium)' }}>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-700 transition-colors"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-medium)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="px-4 py-2 rounded-xl text-sm font-700 transition-all hover:opacity-90"
            style={{ background: confirmBg, color: '#fff' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
