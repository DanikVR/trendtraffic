/**
 * AuroraButton — кнопка дизайн-системы Abyss Aurora.
 *
 * Варианты: primary | warm | secondary | ghost | danger
 * Размеры: sm | md | lg | xl
 * Опции: icon-only, fullWidth, loading
 */

import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'warm' | 'secondary' | 'ghost' | 'danger' | 'hangup';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface AuroraButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  round?: boolean;
}

const variantMap: Record<ButtonVariant, string> = {
  primary:   'btn-primary',
  warm:      'btn-warm',
  secondary: 'btn-secondary',
  ghost:     'btn-ghost',
  danger:    'btn-danger',
  hangup:    'btn-hangup',
};

const sizeMap: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',       // дефолт
  lg: 'btn-lg',
  xl: 'btn-xl',
};

export function AuroraButton({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  loading = false,
  round = false,
  className = '',
  disabled,
  ...props
}: AuroraButtonProps) {
  const isIconOnly = !children && (icon || loading);

  return (
    <button
      className={clsx(
        'btn',
        variantMap[variant],
        sizeMap[size],
        fullWidth && 'btn-full',
        round && 'btn-round',
        isIconOnly && 'btn-icon',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" strokeWidth={1.5} />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span className="flex-shrink-0">{iconRight}</span>
      )}
    </button>
  );
}
