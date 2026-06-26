/**
 * LangPathSync — при первой загрузке снимает /{lang}/ префикс из URL,
 * переключая i18n в нужный язык. Это позволяет серверу отдавать prerendered
 * HTML по адресу /es/billing, а после hydration React переходит на чистый
 * /billing с уже выставленным языком.
 *
 * Дополнительно: при смене языка через LanguageSwitcher обновляет URL,
 * чтобы при копировании можно было поделиться языковой версией.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../config/i18n';

const LANG_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

export function LangPathSync() {
  const { i18n } = useTranslation();

  // На монтировании: проверяем URL на наличие /:lang/ префикса.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);
    const first = segments[0];

    if (first && LANG_CODES.includes(first)) {
      // Переключаем язык, если ещё не такой
      if (i18n.language?.split('-')[0] !== first) {
        i18n.changeLanguage(first);
      }
      // Удаляем префикс из URL (history.replaceState — не триггерит navigation)
      const rest = '/' + segments.slice(1).join('/');
      const newUrl = rest + window.location.search + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default LangPathSync;
