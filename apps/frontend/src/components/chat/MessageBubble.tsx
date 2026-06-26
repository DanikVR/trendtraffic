/**
 * MessageBubble — отдельное сообщение в чате Enterprise-комнаты.
 *
 * Отображает:
 *  - аватарку по sender'у
 *  - текст или медиа (image / video / audio / file)
 *  - timestamp
 *  - индикатор источника (transcript / chat / media)
 *  - outbox status (pending / sent) для admin-сообщений
 *
 * Поддерживает hover-меню (tone popover) — открывается родителем по клику.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, User, Headphones, FileText, Volume2, MessageSquare, Sparkles, Check, Clock, Trash2 } from 'lucide-react';
import { extractDisplayText, extractOriginalTimestamp } from './messageText';
import { MediaLightbox, MediaDownloadButton } from './MediaLightbox';

export interface ChatMessage {
  id: string;
  roomId: string;
  sender: 'client' | 'admin' | 'ai' | 'system';
  source: 'chat' | 'transcript' | 'media' | 'system';
  kind: 'text' | 'audio' | 'image' | 'video' | 'file';
  content: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaSize: number | null;
  languageDetected: string | null;
  dialectDetected: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onToneClick?: (m: ChatMessage, anchor: HTMLElement) => void;
  onDelete?: (m: ChatMessage) => void;
}

export function MessageBubble({ message, onToneClick, onDelete }: MessageBubbleProps) {
  const { t } = useTranslation('common');
  const isAdmin = message.sender === 'admin';
  const isAi = message.sender === 'ai';
  const isSystem = message.sender === 'system';

  // Полноэкранный просмотр медиа (изображение / видео)
  const [lightbox, setLightbox] = useState(false);

  const align = isAdmin ? 'justify-end' : 'justify-start';
  const bubbleSide = isAdmin ? 'order-2' : 'order-1';
  const avatarSide = isAdmin ? 'order-1' : 'order-2';

  // Цвета по sender'у
  const palette = isAdmin
    ? { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.30)', text: 'var(--text-primary)', avatar: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }
    : isAi
    ? { bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.30)', text: 'var(--text-primary)', avatar: 'linear-gradient(135deg, #06b6d4, #22d3ee)' }
    : isSystem
    ? { bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.30)', text: 'var(--text-muted)', avatar: 'linear-gradient(135deg, #94a3b8, #64748b)' }
    : { bg: 'var(--bg-tertiary)', border: 'var(--border-medium)', text: 'var(--text-primary)', avatar: 'linear-gradient(135deg, #f59e0b, #ef4444)' };

  // Время сообщения: предпочитаем originalTimestamp из JSON-content (точное время реплики),
  // иначе createdAt (время сохранения в БД, может быть одинаковым у целого батча).
  const originalTs = extractOriginalTimestamp(message.content);
  const ts = new Date(originalTs ?? message.createdAt);
  const timeLabel = ts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const handleToneClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onToneClick) {
      onToneClick(message, e.currentTarget as HTMLElement);
    }
  };

  const outboxStatus: string | undefined = message.metadata?.outbox_status;

  return (
    <div className={`flex gap-2 ${align} group`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 ${avatarSide}`}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
             style={{ background: palette.avatar }}>
          {isAi ? <Bot size={14} color="#fff" /> :
           isAdmin ? <User size={14} color="#fff" /> :
           isSystem ? <MessageSquare size={14} color="#fff" /> :
           <Headphones size={14} color="#fff" />}
        </div>
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] sm:max-w-[70%] ${bubbleSide}`}>
        <div className="rounded-2xl p-3"
             style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text }}>
          {/* Source tag (для transcript показываем что это не настоящий чат) */}
          {message.source === 'transcript' && (
            <span className="inline-block text-[9px] font-700 uppercase tracking-wider mb-1.5 px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              ⓘ {t('chat.fromTranscript')}
            </span>
          )}

          {/* Media (если есть). У каждого медиа — иконка «Скачать» (без текста).
              Имя файла берётся чистым из URL (без кракозябр). */}
          {message.kind === 'image' && message.mediaUrl && (
            <div className="relative inline-block mb-1 max-w-full">
              <button type="button" onClick={() => setLightbox(true)}
                      className="block rounded-xl overflow-hidden focus:outline-none"
                      title={t('chat.openImage')}>
                <img src={message.mediaUrl} alt="" loading="lazy"
                     className="max-w-full max-h-64 rounded-xl cursor-zoom-in" />
              </button>
              <MediaDownloadButton url={message.mediaUrl} overlay className="absolute top-1.5 right-1.5" />
            </div>
          )}
          {message.kind === 'video' && message.mediaUrl && (
            <div className="relative inline-block mb-1 max-w-full">
              <video src={message.mediaUrl} controls preload="metadata"
                     className="block max-w-full max-h-64 rounded-xl" />
              <MediaDownloadButton url={message.mediaUrl} overlay className="absolute top-1.5 right-1.5" />
            </div>
          )}
          {message.kind === 'audio' && message.mediaUrl && (
            <div className="flex items-center gap-2 mb-1 px-2 py-1.5 rounded-lg"
                 style={{ background: 'rgba(0,0,0,0.15)' }}>
              <Volume2 size={12} className="flex-shrink-0" />
              <audio src={message.mediaUrl} controls preload="metadata" className="h-7 max-w-full" />
              <MediaDownloadButton url={message.mediaUrl} />
            </div>
          )}
          {message.kind === 'file' && message.mediaUrl && (
            <a href={message.mediaUrl} download
               className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 text-xs hover:underline"
               style={{ background: 'rgba(0,0,0,0.15)' }}>
              <FileText size={12} />
              <span>{message.metadata?.original_name || t('chat.fileFallback')}</span>
              {message.mediaSize && <span className="opacity-60">· {(message.mediaSize / 1024).toFixed(0)} KB</span>}
            </a>
          )}

          {/* Текст — если контент сериализован как JSON, показываем только text-поле.
              Если расшифровки нет, но есть аудио — показываем подпись. */}
          {(() => {
            const displayText = extractDisplayText(message.content);
            if (displayText) {
              return (
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {displayText}
                </div>
              );
            }
            if (message.kind === 'audio' && message.mediaUrl) {
              return (
                <div className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                  🎤 {t('chat.audioMessage')}
                </div>
              );
            }
            return null;
          })()}

          {/* Language/dialect chip */}
          {(message.languageDetected || message.dialectDetected) && (
            <div className="flex gap-1 flex-wrap mt-1.5">
              {message.languageDetected && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-600"
                      style={{ background: 'rgba(0,0,0,0.15)', color: 'var(--text-muted)' }}>
                  {message.languageDetected.toUpperCase()}
                </span>
              )}
              {message.dialectDetected && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-600"
                      style={{ background: 'rgba(0,0,0,0.15)', color: 'var(--text-muted)' }}>
                  {message.dialectDetected}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Meta-line: time + outbox status + tone button */}
        <div className={`flex items-center gap-2 mt-1 px-1 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{timeLabel}</span>
          {isAdmin && outboxStatus === 'pending' && (
            <span className="text-[10px] inline-flex items-center gap-0.5" style={{ color: '#f59e0b' }}>
              <Clock size={9} /> {t('chat.queued')}
            </span>
          )}
          {isAdmin && outboxStatus === 'sent' && (
            <span className="text-[10px] inline-flex items-center gap-0.5" style={{ color: '#10b981' }}>
              <Check size={9} /> {t('chat.delivered')}
            </span>
          )}
          {/* Tone explain button — для сообщений клиента и AI (всегда видна) */}
          {(message.sender === 'client' || message.sender === 'ai') && message.content && onToneClick && (
            <button onClick={handleToneClick}
                    className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-600 transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}
                    title={t('chat.explainTone')}>
              <Sparkles size={9} /> {t('chat.tone')}
            </button>
          )}
          {/* Delete button — admin может удалить любое сообщение (всегда видна) */}
          {onDelete && (
            <button
              onClick={() => onDelete(message)}
              className="text-[10px] inline-flex items-center gap-0.5 w-5 h-5 justify-center rounded font-600 transition-opacity hover:opacity-80"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
              title={t('chat.deleteMessage')}>
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Полноэкранный просмотр изображения (с кнопкой «Закрыть») */}
      {message.kind === 'image' && message.mediaUrl && (
        <MediaLightbox
          open={lightbox}
          url={message.mediaUrl}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

export default MessageBubble;
