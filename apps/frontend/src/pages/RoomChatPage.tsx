/**
 * RoomChatPage — чат с клиентом внутри Enterprise-комнаты (Блок 1).
 *
 * URL: /room/:roomId/chat
 *
 * Доступно только creator'у комнаты с Enterprise-тарифом.
 *
 * Показывает:
 *  - Header с именем клиента + теги потребностей
 *  - Список сообщений (MessageList → MessageBubble)
 *  - Composer для отправки текста и медиа (только для telegram_chat — для video только заметки)
 *  - Popover с тонами при клике «Тон» на любом сообщении клиента/AI
 *  - Кнопка «Анализ» (запускает insights — Этап 7)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Loader2, AlertCircle, RefreshCw, Tag as TagIcon } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useIsEnterprise } from '../hooks/useIsEnterprise';
import { MessageList } from '../components/chat/MessageList';
import { ComposerWithMedia } from '../components/chat/ComposerWithMedia';
import { ToneMenuPopover } from '../components/chat/ToneMenuPopover';
import { InsightsModal } from '../components/chat/InsightsModal';
import { NeedTagBadge } from '../components/enterprise/NeedTagBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import type { ChatMessage } from '../components/chat/MessageBubble';

interface RoomMeta {
  id: string;
  name: string;
  kind: 'video' | 'telegram_chat';
  telegramUsername?: string | null;
  telegramDisplayName?: string | null;
}

interface AssignedTag {
  id: string;
  tagId: string;
  name: string;
  color: string | null;
  confidence: number | null;
  detectedAt: string;
}

export function RoomChatPage() {
  const { t } = useTranslation('common');
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { token } = useAppStore();
  const isEnterprise = useIsEnterprise();

  const [room, setRoom] = useState<RoomMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tags, setTags] = useState<AssignedTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Tone popover
  const [tonePopover, setTonePopover] = useState<{ message: ChatMessage; anchorRect: DOMRect } | null>(null);
  // Insights modal
  const [insightsOpen, setInsightsOpen] = useState(false);
  // Delete-confirm modal
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Polling — обновляем каждые 5 секунд, если есть фокус
  const pollIntervalRef = useRef<number | null>(null);
  // Отмена in-flight запроса. Без неё медленный poll/refresh мог прийти ПОСЛЕ
  // нового и перезаписать свежие сообщения (race condition), либо вызвать
  // setState уже после размонтирования. Паттерн «последний запрос выигрывает».
  const loadAbortRef = useRef<AbortController | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  const authHeader = (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

  // ── Load ──────────────────────────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!roomId) return;
    // Отменяем предыдущий незавершённый запрос перед новым.
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    if (!silent) setLoading(true);
    try {
      const [m, tagsRes] = await Promise.all([
        fetch(`/api/enterprise-chat/${roomId}/messages`, { headers: headers(), signal: ac.signal }),
        fetch(`/api/enterprise-chat/${roomId}/tags`, { headers: headers(), signal: ac.signal }),
      ]);
      if (!m.ok) {
        const d = await m.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${m.status}`);
      }
      const dataM = await m.json();
      setRoom(dataM.room);
      setMessages(dataM.messages || []);
      if (tagsRes.ok) {
        const dataT = await tagsRes.json();
        setTags(dataT.tags || []);
      }
      setError(null);
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // ожидаемо при отмене/unmount — не ошибка
      setError(e?.message || t('chat.loadError'));
    } finally {
      if (loadAbortRef.current === ac) loadAbortRef.current = null;
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, token]);

  // Ручное обновление по кнопке: показываем компактный спиннер (refreshing),
  // не дёргая полноэкранный loader. Раньше состояние refreshing объявлялось,
  // но НИКОГДА не выставлялось — спиннер кнопки был «мёртвым».
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(true); } finally { setRefreshing(false); }
  }, [load]);

  useEffect(() => {
    load();
    // Polling
    pollIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 5000);
    return () => {
      if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
      loadAbortRef.current?.abort(); // отменяем in-flight запрос при размонтировании
    };
  }, [load]);

  // ── Send text ─────────────────────────────────────────────────
  const handleSendText = async (text: string) => {
    if (!roomId) return;
    const res = await fetch(`/api/enterprise-chat/${roomId}/send`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d?.error || `HTTP ${res.status}`);
    }
    const newMsg = await res.json();
    setMessages((prev) => [...prev, newMsg]);
  };

  // ── Send media ────────────────────────────────────────────────
  const handleSendMedia = async (file: File, caption: string) => {
    if (!roomId) return;
    const fd = new FormData();
    fd.append('file', file);
    if (caption) fd.append('caption', caption);
    const res = await fetch(`/api/enterprise-chat/${roomId}/upload`, {
      method: 'POST',
      headers: authHeader(),
      body: fd,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d?.error || `HTTP ${res.status}`);
    }
    const newMsg = await res.json();
    setMessages((prev) => [...prev, newMsg]);
  };

  // ── Tone popover ──────────────────────────────────────────────
  const handleToneClick = (m: ChatMessage, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    setTonePopover({ message: m, anchorRect: rect });
  };

  // ── Delete message ────────────────────────────────────────────
  // Шаг 1: клик по 🗑 → открываем стилизованный ConfirmModal
  const handleDeleteRequest = (m: ChatMessage) => {
    setDeletingMessage(m);
  };

  // Шаг 2: пользователь подтвердил → реально удаляем
  const handleConfirmDelete = async () => {
    if (!roomId || !deletingMessage) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/enterprise-chat/${roomId}/messages/${deletingMessage.id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      setMessages((prev) => prev.filter((x) => x.id !== deletingMessage.id));
      setDeletingMessage(null);
    } catch (e: any) {
      setError(e?.message || t('chat.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  if (!isEnterprise) {
    return (
      <div className="p-6 text-center">
        <AlertCircle size={32} className="mx-auto mb-2" style={{ color: '#f59e0b' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('chat.enterpriseOnlyHint')}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 size={28} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="p-4 rounded-2xl"
             style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} color="#ef4444" />
            <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{t('chat.errorTitle')}</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button onClick={() => navigate('/')}
                  className="mt-3 text-xs font-600"
                  style={{ color: '#22d3ee', textDecoration: 'underline' }}>
            {t('chat.backToRooms')}
          </button>
        </div>
      </div>
    );
  }

  const clientName =
    room?.telegramDisplayName ||
    (room?.telegramUsername ? `@${room.telegramUsername}` : null) ||
    room?.name ||
    t('chat.client');

  const isReadOnlyToTelegram = room?.kind !== 'telegram_chat';

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[57px] lg:top-0 lg:left-64 z-10"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Header — flex-shrink-0, прикреплён к верху */}
      <div className="flex-shrink-0 px-4 py-3 border-b flex items-center gap-3"
           style={{ borderColor: 'var(--border-medium)', background: 'var(--bg-secondary)' }}>
        <button onClick={() => navigate('/')}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-700 truncate" style={{ color: 'var(--text-primary)' }}>
              {clientName}
            </h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-600"
                  style={{
                    background: room?.kind === 'telegram_chat' ? 'rgba(34,211,238,0.15)' : 'rgba(139,92,246,0.15)',
                    color: room?.kind === 'telegram_chat' ? '#22d3ee' : '#8B5CF6',
                  }}>
              {room?.kind === 'telegram_chat' ? t('chat.telegramBadge') : t('chat.videoRoomBadge')}
            </span>
          </div>
          {tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <TagIcon size={10} style={{ color: 'var(--text-muted)' }} />
              {tags.map((t) => (
                <NeedTagBadge key={t.id} name={t.name} color={t.color} confidence={t.confidence} />
              ))}
            </div>
          )}
        </div>

        <button onClick={handleManualRefresh}
                disabled={refreshing}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}
                title={t('chat.refreshShort')}>
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>

        <button onClick={() => setInsightsOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-700 transition-colors hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff' }}
                title={t('chat.analyzeTooltip')}>
          <BarChart3 size={12} /> {t('chat.analyze')}
        </button>
      </div>

      {/* Messages */}
      <MessageList messages={messages} onToneClick={handleToneClick} onDelete={handleDeleteRequest} />

      {/* Composer */}
      <ComposerWithMedia
        onSendText={handleSendText}
        onSendMedia={handleSendMedia}
        readOnlyToTelegram={isReadOnlyToTelegram}
      />

      {/* Tone popover */}
      {tonePopover && roomId && (
        <ToneMenuPopover
          roomId={roomId}
          message={tonePopover.message}
          anchorRect={tonePopover.anchorRect}
          onClose={() => setTonePopover(null)}
        />
      )}

      {/* Insights modal */}
      {roomId && (
        <InsightsModal roomId={roomId} open={insightsOpen} onClose={() => setInsightsOpen(false)} />
      )}

      {/* Стилизованное подтверждение удаления (вместо нативного confirm) */}
      <ConfirmModal
        open={!!deletingMessage}
        title={t('chat.deleteMessageConfirmTitle')}
        message={
          <>
            {t('chat.deleteMessageConfirmText')}
            {deletingMessage?.mediaUrl && (
              <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('chat.deleteMessageConfirmMediaNote')}
              </div>
            )}
          </>
        }
        confirmLabel={deleting ? t('chat.deletingShort') : t('confirmModal.delete')}
        cancelLabel={t('confirmModal.cancel')}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeletingMessage(null)}
      />
      </div>
    </div>
  );
}

export default RoomChatPage;
