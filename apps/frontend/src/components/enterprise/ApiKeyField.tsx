/**
 * ApiKeyField — переиспользуемое поле ввода секретного API-ключа.
 *
 * Особенности:
 *  - eye/eye-off для скрытия/показа значения
 *  - кнопка копирования
 *  - placeholder с маской если ключ уже сохранён на сервере
 *  - controlled input (value/onChange)
 *
 * Используется в EnterpriseSettings (Gemini, Chatwoot, Quest Flow ключи) и в admin/config.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Copy, Check, Lock } from 'lucide-react';

interface ApiKeyFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Если на сервере уже сохранён ключ — показываем "···· сохранён" вместо empty. */
  hasSaved?: boolean;
  savedPrefix?: string | null;
  disabled?: boolean;
  className?: string;
  /** Доступно ли копирование текущего значения (если поле раскрыто). */
  showCopyButton?: boolean;
}

export function ApiKeyField({
  value,
  onChange,
  placeholder,
  hasSaved,
  savedPrefix,
  disabled,
  className,
  showCopyButton = true,
}: ApiKeyFieldProps) {
  const { t } = useTranslation('common');
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [focused, setFocused] = useState(false);

  // Ключ сохранён, поле пустое и не в фокусе → показываем сохранённый (маскированный) ключ
  // СПЛОШНЫМ текстом с замком и бейджем «сохранён» — чтобы не выглядел как пустое поле.
  // Сам секрет не отдаётся с бэка (только префикс) — это намеренно.
  const showSavedMask = !!hasSaved && !!savedPrefix && !value && !focused;

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const effectivePlaceholder = hasSaved
    ? (savedPrefix
        ? t('enterprise.apiKey.savedPrefix', { prefix: savedPrefix })
        : t('enterprise.apiKey.savedPlaceholder'))
    : (placeholder || t('enterprise.apiKey.pastePlaceholder'));

  return (
    <div className={`relative flex items-center ${className || ''}`}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={showSavedMask ? '' : effectivePlaceholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        className="w-full px-3 py-2 pr-20 rounded-xl text-sm transition-colors focus:outline-none focus:border-[var(--brand)]"
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-medium)',
          color: 'var(--text-primary)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      />
      {/* Видимый сохранённый ключ (маска), пока поле пустое и не в фокусе. pointer-events-none →
          клик проваливается в input под ним и фокусирует его, маска скрывается, можно вводить новый. */}
      {showSavedMask && (
        <div className="absolute inset-0 flex items-center gap-2 px-3 pr-20 pointer-events-none">
          <Lock size={13} style={{ color: '#10b981', flexShrink: 0 }} />
          <span
            className="text-sm truncate"
            style={{ color: 'var(--text-primary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          >
            {savedPrefix}
          </span>
          <span
            className="text-[10px] font-700 uppercase px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', letterSpacing: '0.04em' }}
          >
            {t('enterprise.apiKey.savedBadge')}
          </span>
        </div>
      )}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {showCopyButton && value && (
          <button
            type="button"
            onClick={handleCopy}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: copied ? '#10b981' : 'var(--text-muted)' }}
            title={copied ? t('enterprise.apiKey.copied') : t('enterprise.apiKey.copy')}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-secondary)]"
          style={{ color: 'var(--text-muted)' }}
          title={show ? t('enterprise.apiKey.hide') : t('enterprise.apiKey.show')}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}
