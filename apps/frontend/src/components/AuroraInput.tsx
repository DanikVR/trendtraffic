/**
 * AuroraInput — стилизованный input с label, иконкой и clear button.
 * Полностью доступный (aria-label, id связь с label).
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface AuroraInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  error?: string;
  hint?: string;
  onClear?: () => void;
  inputId?: string;
}

const AuroraInput = forwardRef<HTMLInputElement, AuroraInputProps>(
  ({ label, icon, iconRight, error, hint, onClear, inputId, className = '', value, ...props }, ref) => {
    const id = inputId || `input-${label?.toLowerCase().replace(/\s+/g, '-') || 'field'}`;
    const hasValue = value !== undefined && value !== '';

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-xs font-600 uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {/* Левая иконка */}
          {icon && (
            <span
              className="absolute left-4 flex items-center pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            value={value}
            className={clsx(
              'aurora-input',
              icon && 'pl-11',
              (iconRight || onClear) && 'pr-11',
              error && 'border-red-500/50 focus:!border-red-500/70 focus:!shadow-[0_0_0_3px_rgba(239,68,68,0.12)]',
              className,
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...props}
          />

          {/* Правая иконка или clear */}
          {(onClear && hasValue) ? (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 flex items-center justify-center w-6 h-6 rounded-full transition-colors"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
              tabIndex={-1}
              aria-label="Очистить"
            >
              <X size={12} strokeWidth={2} />
            </button>
          ) : iconRight ? (
            <span
              className="absolute right-4 flex items-center z-10"
              style={{ color: 'var(--text-muted)' }}
            >
              {iconRight}
            </span>
          ) : null}
        </div>

        {/* Ошибка */}
        {error && (
          <p id={`${id}-error`} className="text-xs font-medium" style={{ color: '#F87171' }}>
            {error}
          </p>
        )}

        {/* Подсказка */}
        {hint && !error && (
          <p id={`${id}-hint`} className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

AuroraInput.displayName = 'AuroraInput';
export { AuroraInput };
