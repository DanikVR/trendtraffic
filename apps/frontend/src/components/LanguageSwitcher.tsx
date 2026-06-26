/**
 * LanguageSwitcher — иконка переключения языка интерфейса.
 *
 * При клике: открывает поповер со строкой поиска и списком всех поддерживаемых
 * языков. Выбор сохраняется в localStorage (i18next делает это сам через
 * LanguageDetector), мгновенно меняет UI и атрибут <html lang/dir>.
 *
 * Компактен — занимает w-9 h-9. Подходит для шапки приложения.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Search, Check } from 'lucide-react';
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES } from '../config/i18n';

const POPUP_WIDTH = 288;     // w-72
const VIEWPORT_PADDING = 12; // отступ от краёв окна

interface LanguageSwitcherProps {
  /** Компактный или развёрнутый. Сейчас всегда compact-icon. */
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Координаты попапа в viewport (position: fixed) — пересчитываются при каждом открытии.
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Пересчитать позицию попапа.
  // ДЕТЕРМИНИРОВАННЫЙ подход: попап анкорится к КРАЮ viewport (правому или левому)
  // в зависимости от того, в какой половине окна расположена иконка-кнопка.
  // Это гарантирует, что при повторных открытиях попап появляется в ОДНОМ И ТОМ ЖЕ
  // месте — даже если кнопка сдвинулась на пару пикселей из-за reflow/смены direction.
  const recomputePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Ширина — не больше POPUP_WIDTH и не больше viewport - 2*padding.
    const width = Math.min(POPUP_WIDTH, vw - 2 * VIEWPORT_PADDING);

    // Решение стороны: смотрим где центр кнопки — в правой или левой половине viewport.
    const buttonCenter = rect.left + rect.width / 2;
    const anchorRight = buttonCenter > vw / 2;

    // Анкорим к самому краю viewport (а не к краю кнопки), чтобы позиция не зависела
    // от мелких сдвигов кнопки при ре-рендере.
    const left = anchorRight
      ? Math.max(VIEWPORT_PADDING, vw - VIEWPORT_PADDING - width)
      : VIEWPORT_PADDING;

    // top: ниже кнопки на 8px.
    const top = rect.bottom + 8;
    // Максимальная высота — до низа viewport минус отступ.
    const maxHeight = Math.max(200, vh - top - VIEWPORT_PADDING);

    setPopupStyle({
      position: 'fixed',
      top,
      left,
      width,
      maxHeight,
      visibility: 'visible',
    });
  };

  useLayoutEffect(() => {
    if (open) {
      recomputePosition();
    } else {
      // прячем при закрытии (на случай гонки)
      setPopupStyle((s) => ({ ...s, visibility: 'hidden' }));
    }
     
  }, [open]);

  // Реагируем ТОЛЬКО на resize окна. Скролл внутри списка / скролл страницы
  // НЕ должен пересчитывать позицию — иначе попап «прыгает» при перелистывании
  // языков (особенно когда смена языка переключает html dir и вызывает reflow).
  useEffect(() => {
    if (!open) return;
    const onResize = () => recomputePosition();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const currentCode = (i18n.language || 'en').split('-')[0];
  const currentLang = useMemo(
    () => SUPPORTED_LANGUAGES.find((l) => l.code === currentCode) || SUPPORTED_LANGUAGES.find((l) => l.code === 'en')!,
    [currentCode],
  );

  // Фокус на поиск при открытии.
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    } else {
      setSearch('');
    }
  }, [open]);

  // Клик вне поповера → закрыть.
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.englishName.toLowerCase().includes(q),
    );
  }, [search]);

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className={`relative ${className || ''}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 flex items-center justify-center transition-colors no-select touch-target"
        style={{ color: 'var(--text-secondary)' }}
        title={`${t('languagePicker.button')}: ${currentLang.nativeName}`}
        aria-label={t('languagePicker.button') as string}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe size={18} strokeWidth={1.5} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="rounded-2xl overflow-hidden shadow-xl z-50 flex flex-col"
          style={{
            ...popupStyle,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.30)',
          }}
          role="listbox"
          dir="ltr"
        >
          {/* Header */}
          <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="text-[10px] font-700 uppercase tracking-wider mb-1.5"
                 style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {t('languagePicker.currentLabel')}: {currentLang.nativeName}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('languagePicker.searchPlaceholder') as string}
                className="w-full pl-8 pr-2 py-2 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* List — flex-1 чтобы занять оставшееся место в попапе с фикс. maxHeight */}
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {t('languagePicker.noResults')}
              </div>
            ) : (
              filtered.map((lang) => {
                const isActive = lang.code === currentCode;
                const isRtl = RTL_LANGUAGES.includes(lang.code);
                return (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(lang.code)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                    style={{ color: isActive ? '#ff7300' : 'var(--text-primary)' }}
                    dir={isRtl ? 'rtl' : 'ltr'}
                  >
                    <span className="text-xs font-700 w-9 uppercase opacity-70 tabular-nums">
                      {lang.code}
                    </span>
                    <span className="flex-1 text-sm font-600 truncate">{lang.nativeName}</span>
                    <span className="text-[10px] opacity-50 truncate hidden sm:inline" style={{ maxWidth: '90px' }}>
                      {lang.englishName}
                    </span>
                    {isActive && <Check size={14} style={{ color: '#ff7300' }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
