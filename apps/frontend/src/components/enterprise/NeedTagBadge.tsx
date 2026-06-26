/**
 * NeedTagBadge — компактный бейдж тега потребности.
 * Используется на карточке Enterprise-комнаты + в чате (вверху).
 */

import React from 'react';

interface NeedTagBadgeProps {
  name: string;
  color?: string | null;
  confidence?: number | null;
  size?: 'sm' | 'md';
}

export function NeedTagBadge({ name, color, confidence, size = 'sm' }: NeedTagBadgeProps) {
  const bg = color ? hexToRgba(color, 0.10) : 'rgba(148,163,184,0.10)';
  const fg = color || 'var(--text-muted)';
  const border = color ? hexToRgba(color, 0.30) : 'rgba(148,163,184,0.30)';

  const padding = size === 'md' ? 'px-2.5 py-1' : 'px-2 py-0.5';
  const fontSize = size === 'md' ? 'text-xs' : 'text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-600 ${padding} ${fontSize}`}
      style={{ background: bg, color: fg, border: `1px solid ${border}` }}
      title={confidence != null ? `Уверенность: ${(confidence * 100).toFixed(0)}%` : undefined}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: fg }} />
      <span>{name}</span>
    </span>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(148,163,184,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
