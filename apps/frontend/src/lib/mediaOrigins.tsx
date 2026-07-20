/**
 * Происхождение файлов Галереи — иконки, подписи, цвета.
 *
 * У каждого файла бэкенд хранит ЦЕПОЧКУ меток (media_assets.origins), хронологически:
 * ['flow','ugc'] = сняли в Google Flow, потом собрали в UGC-студии. Галерея рисует
 * по иконке на метку — сразу видно, через какие блоки прошёл ролик.
 *
 * ⚠ Ключи ОБЯЗАНЫ совпадать с бэкендом: apps/backend/src/modules/media/origins.ts.
 *    Неизвестный ключ просто не рисуется (originMeta вернёт null) — падать нельзя.
 */

import React from 'react';
import {
  UploadCloud, TrendingUp, BarChart3, FileText, Clapperboard, Zap, Mic,
  Users, UserRound, LayoutGrid, BookOpen, Scissors, Bot,
} from 'lucide-react';

export type OriginKey =
  | 'upload' | 'trends' | 'analytics' | 'text' | 'flow' | 'omni' | 'commentator'
  | 'ugc' | 'avatar' | 'storyboard' | 'hotebook' | 'montage' | 'autopilot';

export interface OriginMeta {
  key: OriginKey;
  label: string;                       // ru-дефолт; переводится через t('sec.origins.<key>', label)
  color: string;                       // цвет иконки и рамки чипа
  icon: (size: number) => React.ReactNode;
}

/** Порядок = порядок чипов-фильтров над сеткой. */
export const ORIGINS: OriginMeta[] = [
  { key: 'flow',        label: 'Google Flow', color: '#4285f4', icon: (s) => <Clapperboard size={s} /> },
  { key: 'ugc',         label: 'UGC-студия',  color: '#7c5cff', icon: (s) => <Users size={s} /> },
  { key: 'storyboard',  label: 'Сториборд',   color: '#f59e0b', icon: (s) => <LayoutGrid size={s} /> },
  { key: 'hotebook',    label: 'Hotebook',    color: '#22c55e', icon: (s) => <BookOpen size={s} /> },
  { key: 'trends',      label: 'Тренды',      color: '#ec4899', icon: (s) => <TrendingUp size={s} /> },
  { key: 'analytics',   label: 'Аналитика',   color: '#06b6d4', icon: (s) => <BarChart3 size={s} /> },
  { key: 'omni',        label: 'Omni Flash',  color: '#a855f7', icon: (s) => <Zap size={s} /> },
  { key: 'commentator', label: 'Комментатор', color: '#f97316', icon: (s) => <Mic size={s} /> },
  { key: 'avatar',      label: 'Аватары',     color: '#e11d48', icon: (s) => <UserRound size={s} /> },
  { key: 'montage',     label: 'Монтаж',      color: '#14b8a6', icon: (s) => <Scissors size={s} /> },
  { key: 'autopilot',   label: 'Автопилот',   color: '#84cc16', icon: (s) => <Bot size={s} /> },
  { key: 'text',        label: 'Текст',       color: '#94a3b8', icon: (s) => <FileText size={s} /> },
  { key: 'upload',      label: 'Загрузка',    color: '#64748b', icon: (s) => <UploadCloud size={s} /> },
];

const BY_KEY = new Map(ORIGINS.map((o) => [o.key, o]));

export function originMeta(key: string): OriginMeta | null {
  return BY_KEY.get(key as OriginKey) || null;
}

/**
 * Ряд иконок-источников на обложку карточки.
 * Цепочка хронологическая: слева — откуда пришло, справа — чем стало.
 * Длинные цепочки схлопываем до `max` иконок + «+N», иначе они съедают превью.
 */
export function OriginBadges({
  origins, size = 11, max = 3, title, className = '',
}: { origins?: string[] | null; size?: number; max?: number; title?: string; className?: string }) {
  const metas = (origins || []).map(originMeta).filter((m): m is OriginMeta => !!m);
  if (!metas.length) return null;
  const shown = metas.slice(0, max);
  const rest = metas.length - shown.length;
  const chainTitle = title || metas.map((m) => m.label).join(' → ');
  return (
    <span className={`flex items-center gap-[3px] ${className}`} title={chainTitle}>
      {shown.map((m, i) => (
        <span key={`${m.key}-${i}`} className="flex items-center justify-center rounded-md"
          style={{
            width: size + 7, height: size + 7, color: m.color,
            background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(3px)',
            boxShadow: `inset 0 0 0 1px ${m.color}66`,
          }}>
          {m.icon(size)}
        </span>
      ))}
      {rest > 0 && (
        <span className="flex items-center justify-center rounded-md text-[9px] font-700"
          style={{ height: size + 7, padding: '0 3px', color: '#fff', background: 'rgba(0,0,0,0.62)' }}>+{rest}</span>
      )}
    </span>
  );
}
