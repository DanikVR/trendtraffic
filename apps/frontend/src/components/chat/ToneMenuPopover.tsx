/**
 * ToneMenuPopover — popover для выбора тона пояснения сообщения.
 *
 * Открывается при клике на «Тон» в MessageBubble.
 * Список тонов получает через /api/tenant-prompt/presets.
 * При клике на тон → POST /api/enterprise-chat/:roomId/tone-explain → показывает результат.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { ChatMessage } from './MessageBubble';

interface TonePreset {
  key: string;
  label: string;
  description: string;
}

interface ToneMenuPopoverProps {
  roomId: string;
  message: ChatMessage;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function ToneMenuPopover({ roomId, message, anchorRect, onClose }: ToneMenuPopoverProps) {
  const { token } = useAppStore();
  const ref = useRef<HTMLDivElement>(null);

  const [presets, setPresets] = useState<TonePreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [explanation, setExplanation] = useState<{ tone: string; text: string } | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // Load presets
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/tenant-prompt/presets', { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          setPresets(data.presets || []);
        }
      } finally {
        setLoadingPresets(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click / Esc
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const handlePick = async (toneKey: string, toneLabel: string) => {
    setExplaining(true);
    setError(null);
    try {
      const res = await fetch(`/api/enterprise-chat/${roomId}/tone-explain`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          messageText: message.content || '',
          tone: toneKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setExplanation({ tone: toneLabel, text: data.explanation });
    } catch (e: any) {
      setError(e?.message || 'Ошибка генерации');
    } finally {
      setExplaining(false);
    }
  };

  // Позиционирование
  const top = Math.min(window.innerHeight - 200, anchorRect.bottom + 6);
  const left = Math.min(window.innerWidth - 320, anchorRect.left);

  return (
    <div ref={ref}
         className="fixed z-50 rounded-2xl shadow-2xl"
         style={{
           top, left, width: 320, maxHeight: '70vh',
           background: 'var(--bg-secondary)',
           border: '1px solid var(--border-medium)',
           overflow: 'hidden',
           display: 'flex',
           flexDirection: 'column',
         }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b"
           style={{ borderColor: 'var(--border-medium)' }}>
        <div className="flex items-center gap-2">
          <Sparkles size={14} color="var(--brand)" />
          <span className="text-xs font-700 uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}>
            Объяснить в тоне
          </span>
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)]">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 p-2">
        {!explanation && !explaining && (
          <>
            {loadingPresets ? (
              <div className="py-4 text-center"><Loader2 size={16} className="animate-spin inline-block" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {presets.map((p) => (
                  <button key={p.key}
                          onClick={() => handlePick(p.key, p.label)}
                          className="px-2 py-1.5 rounded-lg text-xs font-600 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                          style={{ color: 'var(--text-primary)' }}
                          title={p.description}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {explaining && (
          <div className="py-6 text-center">
            <Loader2 size={20} className="animate-spin inline-block" style={{ color: 'var(--brand)' }} />
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>AI генерирует пояснение…</p>
          </div>
        )}

        {explanation && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-700 uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--brand)' }}>
                {explanation.tone}
              </span>
              <button onClick={() => setExplanation(null)}
                      className="text-[10px]"
                      style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
                Другой тон
              </button>
            </div>
            <div className="text-sm leading-relaxed p-2 rounded-lg"
                 style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              {explanation.text}
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs p-2 rounded-lg mt-2"
               style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default ToneMenuPopover;
