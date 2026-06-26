/**
 * AvatarCircle — аватар пользователя с online-кольцом и fallback инициалами.
 * Размеры: sm (32) | md (44) | lg (64) | xl (80)
 */

import { clsx } from 'clsx';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';
type AvatarStatus = 'online' | 'offline' | 'live' | 'none';

interface AvatarCircleProps {
  name?: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
}

const sizeConfig = {
  sm: { outer: 'w-8 h-8',   text: 'text-xs',   ring: 'w-2.5 h-2.5 border-[1.5px]' },
  md: { outer: 'w-11 h-11', text: 'text-sm',   ring: 'w-3 h-3 border-2' },
  lg: { outer: 'w-16 h-16', text: 'text-xl',   ring: 'w-4 h-4 border-2' },
  xl: { outer: 'w-20 h-20', text: 'text-2xl',  ring: 'w-5 h-5 border-2' },
};

const statusRing = {
  online:  'bg-jade-400',
  live:    'bg-aurora-400 animate-pulse',
  offline: 'bg-gray-600',
  none:    'hidden',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Генерация цвета аватара на основе имени
function getAvatarColor(name?: string): string {
  const colors = [
    'linear-gradient(135deg, #3B82F6, #6D28D9)',
    'linear-gradient(135deg, #06B6D4, #0284C7)',
    'linear-gradient(135deg, #F472B6, #9D174D)',
    'linear-gradient(135deg, #10B981, #047857)',
    'linear-gradient(135deg, #F59E0B, #B45309)',
    'linear-gradient(135deg, #3B82F6, #38BDF8)',
  ];
  if (!name) return colors[0];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

export function AvatarCircle({ name, src, size = 'md', status = 'none', className }: AvatarCircleProps) {
  const cfg = sizeConfig[size];

  return (
    <div className={clsx('relative flex-shrink-0', className)}>
      <div
        className={clsx(
          'rounded-full flex items-center justify-center overflow-hidden select-none',
          cfg.outer,
        )}
        style={!src ? { background: getAvatarColor(name) } : undefined}
      >
        {src ? (
          <img src={src} alt={name || 'Аватар'} className="w-full h-full object-cover" />
        ) : (
          <span className={clsx('font-bold text-white', cfg.text)}>
            {getInitials(name)}
          </span>
        )}
      </div>

      {/* Status indicator */}
      {status !== 'none' && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 rounded-full flex-shrink-0',
            cfg.ring,
            statusRing[status],
          )}
          style={{ borderColor: 'var(--bg-primary)' }}
        />
      )}
    </div>
  );
}
