/**
 * GlassButton — стеклянная кнопка в стиле Gemini Glass.
 *
 * Варианты:
 * - 'default'  — полупрозрачная стеклянная кнопка
 * - 'primary'  — акцентная кнопка с градиентом Blue → Purple
 * - 'ghost'    — прозрачная кнопка (только hover-эффект)
 * - 'danger'   — красная кнопка для деструктивных действий
 */

import { type ReactNode, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Визуальный вариант кнопки */
  variant?: ButtonVariant;
  /** Иконка слева от текста */
  icon?: ReactNode;
  /** Полная ширина */
  fullWidth?: boolean;
}

/** Маппинг CSS-классов для каждого варианта */
const variantClasses: Record<ButtonVariant, string> = {
  default: `
    bg-white/10 hover:bg-white/15
    backdrop-blur-sm border border-white/10
    text-white/90 hover:border-white/20
    shadow-glass hover:shadow-glass-hover
  `,
  primary: `
    bg-neon-gradient border-0
    text-white font-semibold
    shadow-neon-blue hover:shadow-neon-purple
    hover:brightness-110
  `,
  ghost: `
    bg-transparent hover:bg-white/10
    border border-transparent hover:border-white/10
    text-white/70 hover:text-white/90
  `,
  danger: `
    bg-red-500/20 hover:bg-red-500/30
    backdrop-blur-sm border border-red-400/20
    text-red-300 hover:text-red-200
    hover:border-red-400/40
  `,
};

export function GlassButton({
  children,
  variant = 'default',
  icon,
  fullWidth = false,
  className = '',
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        rounded-xl px-4 py-2.5 text-sm font-medium
        transition-all duration-300 ease-out
        active:scale-[0.98]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
