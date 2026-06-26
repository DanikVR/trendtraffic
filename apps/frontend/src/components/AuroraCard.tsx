/**
 * AuroraCard — базовая карточка дизайн-системы Abyss Aurora.
 *
 * Варианты:
 * - default   — полупрозрачная карточка
 * - elevated  — поднятая карточка (для модалок)
 * - interactive — кликабельная с hover эффектом
 * - glow      — с Aurora свечением
 */

import { type ReactNode, forwardRef } from 'react';
import { clsx } from 'clsx';

interface AuroraCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  as?: 'div' | 'section' | 'article';
}

const AuroraCard = forwardRef<HTMLDivElement, AuroraCardProps>(
  ({ children, className = '', glow = false, interactive = false, onClick, as: Tag = 'div' }, ref) => {
    return (
      <Tag
        ref={ref as never}
        onClick={onClick}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={interactive && onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
        className={clsx(
          'aurora-card',
          interactive && 'aurora-card-interactive',
          glow && 'aurora-card-glow',
          className,
        )}
      >
        {children}
      </Tag>
    );
  }
);

AuroraCard.displayName = 'AuroraCard';
export { AuroraCard };
