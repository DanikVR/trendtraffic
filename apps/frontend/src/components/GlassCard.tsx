/**
 * GlassCard — переиспользуемая стеклянная карточка в стиле Gemini Glass.
 *
 * Применяет полупрозрачный фон, размытие заднего плана и тонкую белую рамку.
 * Поддерживает опциональное неоновое свечение.
 */

import { type ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  /** Дополнительные CSS-классы */
  className?: string;
  /** Включить неоновое свечение (blue glow) */
  glow?: boolean;
  /** Обработчик клика */
  onClick?: () => void;
}

export function GlassCard({ children, className = '', glow = false, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white/5 backdrop-blur-xl
        border border-white/10 rounded-2xl
        shadow-glass
        transition-all duration-300
        ${glow ? 'glass-glow animate-glow-pulse' : ''}
        ${onClick ? 'cursor-pointer hover:bg-white/[0.08] hover:border-white/15 hover:shadow-glass-hover' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
