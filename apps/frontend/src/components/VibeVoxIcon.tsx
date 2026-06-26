/**
 * VibeVoxIcon — квадратная иконка-фавикон VibeVox (телефон+перевод на белом фоне).
 *
 * Используется в местах, где нужен компактный квадратный логотип:
 * — header-иконка PaywallModal, InsightsModal и других модалов.
 *
 * Файл: /vibevox-icon.png (тот же, что используется фавиконом).
 */

import React from 'react';

interface VibeVoxIconProps {
  /** Размер квадрата (ширина = высота) в пикселях. */
  size?: number;
  className?: string;
  /** Если true — иконка обрамляется в светлый круглый/квадратный фон. */
  bordered?: boolean;
  alt?: string;
}

export function VibeVoxIcon({ size = 40, className, bordered = true, alt = 'VibeVox' }: VibeVoxIconProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        background: bordered ? '#fff' : 'transparent',
        borderRadius: bordered ? Math.round(size * 0.28) : 0,
        overflow: 'hidden',
      }}
    >
      <img
        src="/vibevox-icon.png"
        alt={alt}
        draggable={false}
        style={{
          width: bordered ? Math.round(size * 0.78) : size,
          height: bordered ? Math.round(size * 0.78) : size,
          display: 'block',
          userSelect: 'none',
        }}
      />
    </span>
  );
}

export default VibeVoxIcon;
