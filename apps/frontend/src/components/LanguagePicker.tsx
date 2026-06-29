/**
 * LanguagePicker — Bottom Sheet выбор языка с поиском и флагами.
 * Использует framer-motion для плавного выезда снизу.
 *
 * 100+ языков, без нативного <select>.
 * Фиксированная высота, внутренняя прокрутка, поиск.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Check } from 'lucide-react';

export interface Language {
  code: string;
  name: string;
  nameEn: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  // ── Популярные ──
  { code: 'ru', name: 'Русский',       nameEn: 'Russian',       flag: '🇷🇺' },
  { code: 'en', name: 'English',       nameEn: 'English',       flag: '🇬🇧' },
  { code: 'uz', name: 'Oʻzbekcha',    nameEn: 'Uzbek',         flag: '🇺🇿' },
  { code: 'kk', name: 'Қазақша',       nameEn: 'Kazakh',        flag: '🇰🇿' },
  { code: 'de', name: 'Deutsch',       nameEn: 'German',        flag: '🇩🇪' },
  { code: 'fr', name: 'Français',      nameEn: 'French',        flag: '🇫🇷' },
  { code: 'es', name: 'Español',       nameEn: 'Spanish',       flag: '🇪🇸' },
  { code: 'tr', name: 'Türkçe',        nameEn: 'Turkish',       flag: '🇹🇷' },
  { code: 'zh', name: '中文',           nameEn: 'Chinese',       flag: '🇨🇳' },
  { code: 'ar', name: 'العربية',       nameEn: 'Arabic',        flag: '🇸🇦' },
  { code: 'ja', name: '日本語',         nameEn: 'Japanese',      flag: '🇯🇵' },
  { code: 'ko', name: '한국어',         nameEn: 'Korean',        flag: '🇰🇷' },
  { code: 'pt', name: 'Português',     nameEn: 'Portuguese',    flag: '🇧🇷' },
  { code: 'it', name: 'Italiano',      nameEn: 'Italian',       flag: '🇮🇹' },
  { code: 'pl', name: 'Polski',        nameEn: 'Polish',        flag: '🇵🇱' },
  { code: 'uk', name: 'Українська',    nameEn: 'Ukrainian',     flag: '🇺🇦' },
  // ── Все остальные (алфавит) ──
  { code: 'af', name: 'Afrikaans',     nameEn: 'Afrikaans',     flag: '🇿🇦' },
  { code: 'sq', name: 'Shqip',         nameEn: 'Albanian',      flag: '🇦🇱' },
  { code: 'am', name: 'አማርኛ',          nameEn: 'Amharic',       flag: '🇪🇹' },
  { code: 'hy', name: 'Հայերեն',       nameEn: 'Armenian',      flag: '🇦🇲' },
  { code: 'az', name: 'Azərbaycan',    nameEn: 'Azerbaijani',   flag: '🇦🇿' },
  { code: 'eu', name: 'Euskara',       nameEn: 'Basque',        flag: '🏴' },
  { code: 'be', name: 'Беларуская',    nameEn: 'Belarusian',    flag: '🇧🇾' },
  { code: 'bn', name: 'বাংলা',          nameEn: 'Bengali',       flag: '🇧🇩' },
  { code: 'bs', name: 'Bosanski',      nameEn: 'Bosnian',       flag: '🇧🇦' },
  { code: 'bg', name: 'Български',     nameEn: 'Bulgarian',     flag: '🇧🇬' },
  { code: 'my', name: 'မြန်မာ',          nameEn: 'Burmese',       flag: '🇲🇲' },
  { code: 'ca', name: 'Català',        nameEn: 'Catalan',       flag: '🏴' },
  { code: 'ceb',name: 'Cebuano',       nameEn: 'Cebuano',       flag: '🇵🇭' },
  { code: 'ny', name: 'Chichewa',      nameEn: 'Chichewa',      flag: '🇲🇼' },
  { code: 'co', name: 'Corsu',         nameEn: 'Corsican',      flag: '🇫🇷' },
  { code: 'hr', name: 'Hrvatski',      nameEn: 'Croatian',      flag: '🇭🇷' },
  { code: 'cs', name: 'Čeština',       nameEn: 'Czech',         flag: '🇨🇿' },
  { code: 'da', name: 'Dansk',         nameEn: 'Danish',        flag: '🇩🇰' },
  { code: 'nl', name: 'Nederlands',    nameEn: 'Dutch',         flag: '🇳🇱' },
  { code: 'eo', name: 'Esperanto',     nameEn: 'Esperanto',     flag: '🌍' },
  { code: 'et', name: 'Eesti',         nameEn: 'Estonian',       flag: '🇪🇪' },
  { code: 'fi', name: 'Suomi',         nameEn: 'Finnish',       flag: '🇫🇮' },
  { code: 'fy', name: 'Frysk',         nameEn: 'Frisian',       flag: '🇳🇱' },
  { code: 'gl', name: 'Galego',        nameEn: 'Galician',      flag: '🇪🇸' },
  { code: 'ka', name: 'ქართული',       nameEn: 'Georgian',      flag: '🇬🇪' },
  { code: 'el', name: 'Ελληνικά',      nameEn: 'Greek',         flag: '🇬🇷' },
  { code: 'gu', name: 'ગુજરાતી',       nameEn: 'Gujarati',      flag: '🇮🇳' },
  { code: 'ht', name: 'Kreyòl',        nameEn: 'Haitian Creole',flag: '🇭🇹' },
  { code: 'ha', name: 'Hausa',         nameEn: 'Hausa',         flag: '🇳🇬' },
  { code: 'haw',name: 'ʻŌlelo Hawaiʻi',nameEn: 'Hawaiian',     flag: '🇺🇸' },
  { code: 'he', name: 'עברית',          nameEn: 'Hebrew',        flag: '🇮🇱' },
  { code: 'hi', name: 'हिन्दी',          nameEn: 'Hindi',         flag: '🇮🇳' },
  { code: 'hmn',name: 'Hmong',         nameEn: 'Hmong',         flag: '🌏' },
  { code: 'hu', name: 'Magyar',        nameEn: 'Hungarian',     flag: '🇭🇺' },
  { code: 'is', name: 'Íslenska',      nameEn: 'Icelandic',     flag: '🇮🇸' },
  { code: 'ig', name: 'Igbo',          nameEn: 'Igbo',          flag: '🇳🇬' },
  { code: 'id', name: 'Bahasa Indonesia',nameEn: 'Indonesian',  flag: '🇮🇩' },
  { code: 'ga', name: 'Gaeilge',       nameEn: 'Irish',         flag: '🇮🇪' },
  { code: 'jw', name: 'Basa Jawa',     nameEn: 'Javanese',      flag: '🇮🇩' },
  { code: 'kn', name: 'ಕನ್ನಡ',          nameEn: 'Kannada',       flag: '🇮🇳' },
  { code: 'km', name: 'ភាសាខ្មែរ',       nameEn: 'Khmer',         flag: '🇰🇭' },
  { code: 'rw', name: 'Kinyarwanda',   nameEn: 'Kinyarwanda',   flag: '🇷🇼' },
  { code: 'ky', name: 'Кыргызча',      nameEn: 'Kyrgyz',        flag: '🇰🇬' },
  { code: 'lo', name: 'ລາວ',            nameEn: 'Lao',           flag: '🇱🇦' },
  { code: 'la', name: 'Latina',        nameEn: 'Latin',         flag: '🏛️' },
  { code: 'lv', name: 'Latviešu',      nameEn: 'Latvian',       flag: '🇱🇻' },
  { code: 'lt', name: 'Lietuvių',      nameEn: 'Lithuanian',    flag: '🇱🇹' },
  { code: 'lb', name: 'Lëtzebuergesch',nameEn: 'Luxembourgish', flag: '🇱🇺' },
  { code: 'mk', name: 'Македонски',    nameEn: 'Macedonian',    flag: '🇲🇰' },
  { code: 'mg', name: 'Malagasy',      nameEn: 'Malagasy',      flag: '🇲🇬' },
  { code: 'ms', name: 'Bahasa Melayu', nameEn: 'Malay',         flag: '🇲🇾' },
  { code: 'ml', name: 'മലയാളം',         nameEn: 'Malayalam',     flag: '🇮🇳' },
  { code: 'mt', name: 'Malti',         nameEn: 'Maltese',       flag: '🇲🇹' },
  { code: 'mi', name: 'Māori',         nameEn: 'Maori',         flag: '🇳🇿' },
  { code: 'mr', name: 'मराठी',           nameEn: 'Marathi',       flag: '🇮🇳' },
  { code: 'mn', name: 'Монгол',        nameEn: 'Mongolian',     flag: '🇲🇳' },
  { code: 'ne', name: 'नेपाली',          nameEn: 'Nepali',        flag: '🇳🇵' },
  { code: 'no', name: 'Norsk',         nameEn: 'Norwegian',     flag: '🇳🇴' },
  { code: 'or', name: 'ଓଡ଼ିଆ',          nameEn: 'Odia',          flag: '🇮🇳' },
  { code: 'ps', name: 'پښتو',           nameEn: 'Pashto',        flag: '🇦🇫' },
  { code: 'fa', name: 'فارسی',          nameEn: 'Persian',       flag: '🇮🇷' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ',          nameEn: 'Punjabi',       flag: '🇮🇳' },
  { code: 'ro', name: 'Română',        nameEn: 'Romanian',      flag: '🇷🇴' },
  { code: 'sm', name: 'Gagana Samoa',  nameEn: 'Samoan',        flag: '🇼🇸' },
  { code: 'gd', name: 'Gàidhlig',      nameEn: 'Scots Gaelic',  flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { code: 'sr', name: 'Српски',        nameEn: 'Serbian',       flag: '🇷🇸' },
  { code: 'st', name: 'Sesotho',       nameEn: 'Sesotho',       flag: '🇱🇸' },
  { code: 'sn', name: 'chiShona',      nameEn: 'Shona',         flag: '🇿🇼' },
  { code: 'sd', name: 'سنڌي',           nameEn: 'Sindhi',        flag: '🇵🇰' },
  { code: 'si', name: 'සිංහල',          nameEn: 'Sinhala',       flag: '🇱🇰' },
  { code: 'sk', name: 'Slovenčina',    nameEn: 'Slovak',        flag: '🇸🇰' },
  { code: 'sl', name: 'Slovenščina',   nameEn: 'Slovenian',     flag: '🇸🇮' },
  { code: 'so', name: 'Soomaali',      nameEn: 'Somali',        flag: '🇸🇴' },
  { code: 'su', name: 'Basa Sunda',    nameEn: 'Sundanese',     flag: '🇮🇩' },
  { code: 'sw', name: 'Kiswahili',     nameEn: 'Swahili',       flag: '🇰🇪' },
  { code: 'sv', name: 'Svenska',       nameEn: 'Swedish',       flag: '🇸🇪' },
  { code: 'tl', name: 'Tagalog',       nameEn: 'Tagalog',       flag: '🇵🇭' },
  { code: 'tg', name: 'Тоҷикӣ',       nameEn: 'Tajik',         flag: '🇹🇯' },
  { code: 'ta', name: 'தமிழ்',          nameEn: 'Tamil',         flag: '🇮🇳' },
  { code: 'tt', name: 'Татарча',       nameEn: 'Tatar',         flag: '🇷🇺' },
  { code: 'te', name: 'తెలుగు',         nameEn: 'Telugu',        flag: '🇮🇳' },
  { code: 'th', name: 'ไทย',            nameEn: 'Thai',          flag: '🇹🇭' },
  { code: 'tk', name: 'Türkmen',       nameEn: 'Turkmen',       flag: '🇹🇲' },
  { code: 'ur', name: 'اردو',           nameEn: 'Urdu',          flag: '🇵🇰' },
  { code: 'ug', name: 'ئۇيغۇرچە',       nameEn: 'Uyghur',        flag: '🇨🇳' },
  { code: 'vi', name: 'Tiếng Việt',    nameEn: 'Vietnamese',    flag: '🇻🇳' },
  { code: 'cy', name: 'Cymraeg',       nameEn: 'Welsh',         flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  { code: 'xh', name: 'isiXhosa',      nameEn: 'Xhosa',        flag: '🇿🇦' },
  { code: 'yi', name: 'ייִדיש',          nameEn: 'Yiddish',       flag: '🇮🇱' },
  { code: 'yo', name: 'Yorùbá',        nameEn: 'Yoruba',        flag: '🇳🇬' },
  { code: 'zu', name: 'isiZulu',       nameEn: 'Zulu',          flag: '🇿🇦' },
];

const POPULAR_CODES = ['ru', 'en', 'uz', 'kk', 'de', 'fr', 'es', 'tr', 'zh', 'ar'];

interface LanguagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (code: string) => void;
  title?: string;
}

/** Хук: десктоп ли (≥640px). Слушает resize. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(min-width: 640px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function LanguagePicker({
  isOpen,
  onClose,
  value,
  onChange,
  title = 'Выберите язык',
}: LanguagePickerProps) {
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isDesktop = useIsDesktop();

  // Фокус на поиск при открытии
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nameEn.toLowerCase().includes(q) ||
        l.code.includes(q),
    );
  }, [search]);

  const popular = filtered.filter((l) => POPULAR_CODES.includes(l.code));
  const rest    = filtered.filter((l) => !POPULAR_CODES.includes(l.code));

  const handleSelect = (code: string) => {
    onChange(code);
    onClose();
    setSearch('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Оверлей */}
          <motion.div
            key="overlay"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.60)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Контент picker'а — одинаковый и для bottom-sheet (mobile), и для центрированного модала (desktop). */}
          {(() => {
            const PickerInner = (
              <>
                {/* Ручка — только на мобильных */}
                {!isDesktop && (
                  <div className="pt-3 pb-1 flex justify-center">
                    <div className="bottom-sheet-handle" />
                  </div>
                )}

                {/* Заголовок */}
                <div className="flex items-center justify-between px-5 py-3">
                  <h3
                    className="text-lg font-700"
                    style={{ fontFamily: 'Geist Sans, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
                  >
                    {title}
                  </h3>
                  <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-full flex items-center justify-center touch-target transition-colors"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                    aria-label="Закрыть"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>

                {/* Поиск */}
                <div className="px-5 pb-3">
                  <div className="relative flex items-center">
                    <Search
                      size={16}
                      strokeWidth={1.5}
                      className="absolute left-3.5 pointer-events-none"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder="Поиск среди 100+ языков..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="aurora-input pl-10 py-2.5 text-sm"
                      autoComplete="off"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 flex items-center justify-center"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label="Очистить поиск"
                      >
                        <X size={14} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Счётчик результатов */}
                {search && (
                  <div className="px-5 pb-2">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Найдено: {filtered.length}
                    </p>
                  </div>
                )}

                {/* Список языков */}
                <div
                  ref={listRef}
                  className={`overflow-y-auto flex-1 px-4 ${isDesktop ? 'pb-5' : 'pb-8 pb-safe'}`}
                  style={{
                    maxHeight: isDesktop ? 'calc(80vh - 180px)' : '55dvh',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {!search && popular.length > 0 && (
                    <>
                      <p
                        className="text-xs font-700 uppercase px-1 py-2"
                        style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
                      >
                        Популярные
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                        {popular.map((lang) => (
                          <LanguageItem
                            key={lang.code}
                            lang={lang}
                            selected={lang.code === value}
                            onSelect={handleSelect}
                          />
                        ))}
                      </div>
                      {rest.length > 0 && (
                        <>
                          <div className="aurora-divider my-3" />
                          <p
                            className="text-xs font-700 uppercase px-1 py-2"
                            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
                          >
                            Все языки ({rest.length})
                          </p>
                        </>
                      )}
                    </>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(search ? filtered : rest).map((lang) => (
                      <LanguageItem
                        key={lang.code}
                        lang={lang}
                        selected={lang.code === value}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>

                  {filtered.length === 0 && (
                    <div className="py-12 text-center">
                      <p style={{ color: 'var(--text-muted)' }} className="text-sm">
                        Язык не найден
                      </p>
                      <p style={{ color: 'var(--text-disabled)' }} className="text-xs mt-1">
                        Попробуйте другой запрос
                      </p>
                    </div>
                  )}
                </div>
              </>
            );

            return isDesktop ? (
              <motion.div
                key="modal"
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <motion.div
                  className="bottom-sheet flex flex-col w-full max-w-2xl pointer-events-auto"
                  style={{ maxHeight: '80vh', borderRadius: '28px' }}
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.94, opacity: 0 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 360 }}
                >
                  {PickerInner}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="sheet"
                className="fixed bottom-0 left-0 right-0 z-50 bottom-sheet flex flex-col"
                style={{ maxHeight: '80dvh' }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              >
                {PickerInner}
              </motion.div>
            );
          })()}
        </>
      )}
    </AnimatePresence>
  );
}

interface LanguageItemProps {
  lang: Language;
  selected: boolean;
  onSelect: (code: string) => void;
}

function LanguageItem({ lang, selected, onSelect }: LanguageItemProps) {
  return (
    <button
      onClick={() => onSelect(lang.code)}
      className={`lang-chip w-full text-left ${selected ? 'selected' : ''}`}
      aria-pressed={selected}
    >
      <span className="text-2xl leading-none select-none">{lang.flag}</span>
      <span className="flex-1 min-w-0">
        <span
          className="block text-sm font-600 truncate"
          style={{ color: selected ? 'var(--accent-light)' : 'var(--text-primary)' }}
        >
          {lang.name}
        </span>
        <span className="block text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {lang.nameEn}
        </span>
      </span>
      {selected && (
        <Check size={16} strokeWidth={2} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      )}
    </button>
  );
}
