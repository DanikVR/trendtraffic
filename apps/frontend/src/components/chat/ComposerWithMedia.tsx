/**
 * ComposerWithMedia — поле ввода сообщения + прикрепление медиа.
 *
 * Особенности:
 *  - Enter — отправить, Shift+Enter — перевод строки
 *  - Кнопка скрепки → выбор файла → сразу загрузка (caption опционально)
 *  - Disabled state пока сообщение/файл отправляется
 */

import React, { useRef, useState } from 'react';
import { Send, Paperclip, Loader2, X } from 'lucide-react';

interface ComposerWithMediaProps {
  onSendText: (text: string) => Promise<void>;
  onSendMedia: (file: File, caption: string) => Promise<void>;
  disabled?: boolean;
  /** Если room.kind === 'video' — outbox в Telegram не работает, показываем подсказку */
  readOnlyToTelegram?: boolean;
}

export function ComposerWithMedia({ onSendText, onSendMedia, disabled, readOnlyToTelegram }: ComposerWithMediaProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedCaption, setStagedCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleSendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSendText(trimmed);
      setText('');
      // reset height
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStagedFile(file);
      setStagedCaption('');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSendMedia = async () => {
    if (!stagedFile || sending) return;
    setSending(true);
    try {
      await onSendMedia(stagedFile, stagedCaption);
      setStagedFile(null);
      setStagedCaption('');
    } finally {
      setSending(false);
    }
  };

  const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(160, el.scrollHeight) + 'px';
  };

  return (
    <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--border-medium)' }}>
      {/* Staged file preview */}
      {stagedFile && (
        <div className="px-3 py-2 flex items-center gap-2 border-b"
             style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-medium)' }}>
          <Paperclip size={14} style={{ color: '#8B5CF6' }} />
          <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
            <b>{stagedFile.name}</b> · {(stagedFile.size / 1024).toFixed(0)} KB
          </span>
          <input
            type="text"
            value={stagedCaption}
            onChange={(e) => setStagedCaption(e.target.value.slice(0, 1000))}
            placeholder="Подпись (необязательно)"
            className="flex-1 max-w-[50%] px-2 py-1 rounded-lg text-xs focus:outline-none"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
          />
          <button onClick={handleSendMedia} disabled={sending}
                  className="px-3 py-1 rounded-lg text-xs font-700"
                  style={{ background: '#8B5CF6', color: '#fff' }}>
            {sending ? <Loader2 size={12} className="animate-spin" /> : 'Отправить'}
          </button>
          <button onClick={() => { setStagedFile(null); setStagedCaption(''); }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ color: 'var(--text-muted)' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Main composer */}
      <div className="flex items-end gap-2 px-3 py-2.5">
        <input ref={fileRef} type="file" onChange={handleFileChange} className="hidden"
               accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={disabled || sending}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}
                title="Прикрепить файл">
          <Paperclip size={16} />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 4000))}
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение клиенту..."
          rows={1}
          disabled={disabled || sending}
          className="flex-1 px-3 py-2 rounded-xl text-sm leading-relaxed resize-none focus:outline-none focus:border-violet-400"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
            maxHeight: '160px',
          }}
        />

        <button onClick={handleSendText} disabled={disabled || sending || !text.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: text.trim() ? 'linear-gradient(135deg, #8B5CF6, #6366F1)' : 'var(--bg-tertiary)',
                  color: text.trim() ? '#fff' : 'var(--text-muted)',
                }}
                title="Отправить (Enter)">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

export default ComposerWithMedia;
