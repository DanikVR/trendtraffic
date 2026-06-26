/**
 * MessageList — лента сообщений в чате Enterprise-комнаты.
 *
 * - Авто-скролл вниз при появлении новых сообщений (если пользователь уже был у дна).
 * - Если пользователь скроллил вверх — не дёргает скролл, показывает кнопку «новые сообщения».
 * - Группирует сообщения подряд от одного sender'а (уменьшая margin между ними).
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { MessageBubble, type ChatMessage } from './MessageBubble';
import { hasDisplayableContent, extractOriginalTimestamp } from './messageText';

interface MessageListProps {
  messages: ChatMessage[];
  onToneClick?: (m: ChatMessage, anchor: HTMLElement) => void;
  onDelete?: (m: ChatMessage) => void;
}

/** Ключ календарного дня (год-месяц-день) — для группировки сообщений по дням. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Подпись разделителя дня. «Сегодня»/«Вчера» приходят локализованными из i18n
 * (t('chat.dayToday'/'chat.dayYesterday')), сама дата форматируется в локали пользователя
 * через Intl (toLocaleDateString) — перевода не требует. Год показываем только если не текущий.
 */
function formatDayLabel(d: Date, locale: string, todayLabel: string, yesterdayLabel: string): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return todayLabel;
  if (dayKey(d) === dayKey(yesterday)) return yesterdayLabel;
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

/** Центрированный разделитель дня в ленте (как в мессенджерах). */
function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-1">
      <span
        className="text-[10px] font-600 px-2.5 py-1 rounded-full"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
      >
        {label}
      </span>
    </div>
  );
}

export function MessageList({ messages, onToneClick, onDelete }: MessageListProps) {
  const { t, i18n } = useTranslation('common');
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageIdRef = useRef<string | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (messages.length === 0) return;
    const lastId = messages[messages.length - 1].id;
    if (lastId === lastMessageIdRef.current) return;
    lastMessageIdRef.current = lastId;
    if (isAtBottom) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      setUnreadCount(0);
    } else {
      setUnreadCount((c) => c + 1);
    }
  }, [messages, isAtBottom]);

  // Track scroll position
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 80;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom !== isAtBottom) setIsAtBottom(atBottom);
    if (atBottom) setUnreadCount(0);
  };

  const handleJumpToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    setUnreadCount(0);
  };

  // Скрываем пустые сообщения и JSON-«болванки» без читаемого текста.
  const visibleMessages = messages.filter(hasDisplayableContent);

  if (visibleMessages.length === 0) {
    return (
      <div className="relative flex-1">
        <div className="absolute inset-0 flex items-center justify-center text-sm"
             style={{ color: 'var(--text-muted)' }}>
          {t('chat.empty')}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={containerRef} onScroll={handleScroll}
           className="absolute inset-0 overflow-y-auto px-3 py-4 space-y-3">
        {(() => {
          // Вставляем разделитель дня перед первым сообщением каждого нового календарного дня.
          // День берём из того же времени, что показывает бабл (originalTimestamp → createdAt).
          const nodes: React.ReactNode[] = [];
          let prevDay: string | null = null;
          for (const m of visibleMessages) {
            const ts = new Date(extractOriginalTimestamp(m.content) ?? m.createdAt);
            const k = dayKey(ts);
            if (k !== prevDay) {
              prevDay = k;
              nodes.push(<DayDivider key={`day-${k}`} label={formatDayLabel(ts, i18n.language, t('chat.dayToday'), t('chat.dayYesterday'))} />);
            }
            nodes.push(<MessageBubble key={m.id} message={m} onToneClick={onToneClick} onDelete={onDelete} />);
          }
          return nodes;
        })()}
        <div ref={endRef} />
      </div>

      {/* Jump to bottom */}
      {!isAtBottom && unreadCount > 0 && (
        <button onClick={handleJumpToBottom}
                className="absolute bottom-4 right-4 px-3 py-2 rounded-full text-xs font-700 shadow-lg flex items-center gap-1 transition-transform hover:scale-105"
                style={{ background: '#8B5CF6', color: '#fff' }}>
          <ChevronDown size={14} /> {unreadCount} {t('chat.newMessages')}
        </button>
      )}
    </div>
  );
}

export default MessageList;
