/**
 * StatusPill — компактный статус-индикатор.
 * Варианты: online | live | trial | offline | enterprise
 *
 * Цвета рассчитаны для контраста 4.5:1+ на ОБОИХ фонах (light + dark).
 */

import { clsx } from 'clsx';

type StatusType = 'online' | 'live' | 'trial' | 'offline' | 'enterprise';

interface StatusPillProps {
  status: StatusType;
  label?: string;
  className?: string;
  pulse?: boolean;
}

/**
 * isDark() — синхронная проверка текущей темы без React state.
 * Используется для выбора правильного цвета текста.
 */
function isDark() {
  return document.documentElement.classList.contains('dark');
}

const statusConfig: Record<StatusType, {
  defaultLabel: string;
  dot: string;
  bg: string;
  bgLight: string;
  text: string;
  textLight: string;
  border: string;
  borderLight: string;
}> = {
  online: {
    defaultLabel: 'Онлайн',
    dot: '#10B981',
    bg:        'rgba(16,185,129,0.12)',
    bgLight:   'rgba(5,150,105,0.10)',
    text:      '#34D399',      // emerald-400 — хорошо на тёмном
    textLight: '#065F46',      // emerald-800 — хорошо на светлом
    border:        'rgba(16,185,129,0.25)',
    borderLight:   'rgba(5,150,105,0.25)',
  },
  live: {
    defaultLabel: 'В эфире',
    dot: '#A1A1AA',
    bg:        'rgba(255,255,255,0.08)',
    bgLight:   'rgba(9,9,11,0.05)',
    text:      '#F4F4F5',      // zinc-100 на тёмном
    textLight: '#27272A',      // zinc-800 на светлом
    border:        'rgba(255,255,255,0.18)',
    borderLight:   'rgba(9,9,11,0.12)',
  },
  trial: {
    defaultLabel: 'Пробный',
    dot: '#F59E0B',
    bg:        'rgba(245,158,11,0.12)',
    bgLight:   'rgba(217,119,6,0.10)',
    text:      '#FCD34D',      // amber-300 — на тёмном (контраст ок)
    textLight: '#92400E',      // amber-800 — на светлом (чёткий)
    border:        'rgba(245,158,11,0.25)',
    borderLight:   'rgba(217,119,6,0.28)',
  },
  offline: {
    defaultLabel: 'Оффлайн',
    dot: '#6B7280',
    bg:        'rgba(107,114,128,0.10)',
    bgLight:   'rgba(75,85,99,0.08)',
    text:      '#9CA3AF',      // gray-400
    textLight: '#374151',      // gray-700
    border:        'rgba(107,114,128,0.18)',
    borderLight:   'rgba(75,85,99,0.18)',
  },
  enterprise: {
    defaultLabel: 'Enterprise',
    dot: '#E4E4E7',
    bg:        'rgba(255,255,255,0.12)',
    bgLight:   'rgba(9,9,11,0.08)',
    text:      '#FFFFFF',      // белый на тёмном
    textLight: '#09090B',      // чёрный на светлом
    border:        'rgba(255,255,255,0.25)',
    borderLight:   'rgba(9,9,11,0.20)',
  },
};

export function StatusPill({ status, label, className, pulse = false }: StatusPillProps) {
  const config = statusConfig[status];
  const displayLabel = label ?? config.defaultLabel;
  const dark = isDark();

  return (
    <span
      className={clsx('status-pill', className)}
      style={{
        background:   dark ? config.bg        : config.bgLight,
        color:        dark ? config.text       : config.textLight,
        borderColor:  dark ? config.border     : config.borderLight,
      }}
    >
      <span
        className={clsx(
          'status-dot',
          pulse && (status === 'live' || status === 'online') && 'animate-pulse',
        )}
        style={{ background: config.dot }}
      />
      {displayLabel}
    </span>
  );
}
