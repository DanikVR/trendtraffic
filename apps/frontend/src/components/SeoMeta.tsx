/**
 * SeoMeta — глобальный компонент SEO мета-тегов VibeVox.
 *
 * Динамически подставляет в <head>:
 *  - <title>, <meta description, keywords>
 *  - Open Graph (og:title, og:description, og:locale, og:type)
 *  - Twitter Card
 *  - canonical
 *  - <link rel="alternate" hreflang> для всех поддерживаемых языков
 *  - <meta http-equiv="content-language">
 *
 * Тексты берутся из неймспейса common (поле seo.*). Локаль читается из i18next.
 * Атрибуты <html lang> + <html dir> ставятся отдельно (i18n.ts слушает languageChanged).
 */

import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES } from '../config/i18n';

// Английский — язык по умолчанию: его страницы лежат по канонiчному пути без
// префикса (`/`, `/auth/login`), остальные языки — под `/{lang}/...`. Это
// согласовано с `scripts/prerender.mjs` (генерирует `dist/{lang}/.../index.html`,
// а английский кладёт прямо в `dist/`) и `scripts/sitemap.mjs`.
const DEFAULT_LANG = 'en';
const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

/** Убирает префикс языка из pathname, если он там есть.
 *  `/es/auth/login` → `/auth/login`; `/auth/login` → `/auth/login`. */
function stripLangPrefix(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg && SUPPORTED_CODES.includes(seg)) {
    const rest = pathname.split('/').slice(2).filter(Boolean).join('/');
    return rest ? `/${rest}` : '/';
  }
  return pathname || '/';
}

/** Каноничный URL для языка + пути (без префикса). en — без префикса,
 *  остальные — `/${lang}${path}`. */
function urlForLang(origin: string, langCode: string, basePath: string): string {
  if (langCode === DEFAULT_LANG) return `${origin}${basePath}`;
  const tail = basePath === '/' ? '' : basePath;
  return `${origin}/${langCode}${tail}`;
}

export function SeoMeta() {
  const { t, i18n } = useTranslation('common');
  const lang = (i18n.language || DEFAULT_LANG).split('-')[0];
  const isRtl = RTL_LANGUAGES.includes(lang);

  const title = t('seo.title', { defaultValue: 'VibeVox' }) as string;
  const description = t('seo.description', {
    defaultValue: 'VibeVox — synchronous AI voice translation platform.',
  }) as string;
  const keywords = t('seo.keywords', { defaultValue: 'AI translation, voice' }) as string;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vibevox.app';
  const rawPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const basePath = stripLangPrefix(rawPath);

  // Canonical — URL текущего языка в каноничной форме.
  const canonicalUrl = urlForLang(origin, lang, basePath);

  return (
    <Helmet>
      <html lang={lang} dir={isRtl ? 'rtl' : 'ltr'} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta httpEquiv="content-language" content={lang} />

      {/* Canonical */}
      <link rel="canonical" href={canonicalUrl} />

      {/* hreflang — каждый язык по своему path-префиксу (en = без префикса).
          Согласовано с prerender.mjs и sitemap.mjs. */}
      {SUPPORTED_LANGUAGES.map((l) => (
        <link
          key={l.code}
          rel="alternate"
          hrefLang={l.code}
          href={urlForLang(origin, l.code, basePath)}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={urlForLang(origin, DEFAULT_LANG, basePath)} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={lang} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={`${origin}/vibevox-logo-light.png`} />
      <meta property="og:site_name" content="VibeVox" />

      {/* Twitter card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${origin}/vibevox-logo-light.png`} />

      {/* Robots */}
      <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    </Helmet>
  );
}

export default SeoMeta;
