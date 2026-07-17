/**
 * LegalDocPage — правовые страницы TrendTraffic (/privacy, /terms, /cookies)
 * в фирменном стиле лендинга «Dala»: тот же хедер TTNav, футер TTFooter,
 * подложка-анимация Constellation и lerp-скролл.
 *
 * Тексты — отдельный ленивый i18n-неймспейс `legal` (public/locales/<lng>/legal.json,
 * EN — база, остальные языки — прогон scripts/translate-legal.mjs). Каждый документ —
 * массив секций {h, b}: заголовок + HTML-тело (наш собственный статический контент).
 */

import { useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TTNav, TTFooter, FadeUp, RevealLines, useSmoothScroll } from './landing/chrome';
import { Constellation } from './landing/Constellation';
import { openCookieConsent } from '../../components/CookieConsent';
import './landing/landing.css';

type LegalDocKey = 'privacy' | 'terms' | 'cookies';

interface LegalSection { h: string; b: string }

const DOC_PATHS: Record<LegalDocKey, string> = {
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
};

export function LegalDocPage({ doc }: { doc: LegalDocKey }) {
  const { t, ready } = useTranslation('legal');
  const { pathname } = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);
  const { scrollToId, posRef } = useSmoothScroll(pageRef);

  // Страница живёт на чистом чёрном (как лендинг) — красим body на время визита.
  useEffect(() => {
    const prev = document.body.style.background;
    const prevX = document.body.style.overflowX;
    document.body.style.background = '#000';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.background = prev;
      document.body.style.overflowX = prevX;
    };
  }, []);

  // Переход между документами — всегда с начала страницы.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const rawSections = t(`${doc}.sections`, { returnObjects: true, defaultValue: [] });
  const sections: LegalSection[] = Array.isArray(rawSections)
    ? (rawSections as LegalSection[]).filter((s) => s && typeof s.h === 'string' && typeof s.b === 'string')
    : [];

  const title = t(`${doc}.title`, doc === 'privacy' ? 'Privacy Policy' : doc === 'terms' ? 'Terms of Service' : 'Cookie Policy');
  const subtitle = t(`${doc}.subtitle`, 'of the TrendTraffic platform');
  const updated = t(`${doc}.updated`, '17 July 2026');
  const metaDescription = t(`${doc}.metaDescription`, `TrendTraffic — ${title}`);
  const canonical = `https://trendtraffic.pro${DOC_PATHS[doc]}`;

  const otherDocs = (Object.keys(DOC_PATHS) as LegalDocKey[]).filter((d) => d !== doc);

  return (
    <div className="ttl">
      {/* defer={false} — синхронный коммит тегов (rAF в скрытых вкладках/краулерах мёртв) */}
      <Helmet defer={false}>
        <title>{`${title} — TrendTraffic`}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={`${title} — TrendTraffic`} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="TrendTraffic" />
      </Helmet>

      {/* Подложка-анимация лендинга в ambient-режиме: фигуры видимы всю прокрутку */}
      <Constellation started posRef={posRef} ambient />
      <TTNav minimal />

      <div ref={pageRef} className="ttl-page">
        <main className="ttl-wrap ttl-legal-main">
          <FadeUp animate>
            <p className="ttl-label">{t('ui.kicker', 'Legal')}</p>
          </FadeUp>
          <RevealLines as="h1" className="ttl-h-lg" animate delay={0.08} lines={[title]} />
          <FadeUp animate delay={0.22}>
            <p className="ttl-body ttl-legal-sub">{subtitle}</p>
            <p className="ttl-caption ttl-legal-updated">{t('ui.updatedAt', 'Last updated:')} {updated}</p>
          </FadeUp>

          {/* Навигация между правовыми документами */}
          <FadeUp animate delay={0.3}>
            <nav className="ttl-legal-docnav" aria-label={t('ui.otherDocs', 'Related documents')}>
              {otherDocs.map((d) => (
                <Link key={d} className="ttl-legal-chip" to={DOC_PATHS[d]}>
                  {t(`ui.${d}Nav`, DOC_PATHS[d])}
                </Link>
              ))}
            </nav>
          </FadeUp>

          {/* Оглавление */}
          {ready && sections.length > 0 && (
            <FadeUp animate delay={0.36}>
              <nav className="ttl-legal-toc" aria-label={t('ui.toc', 'Contents')}>
                <p className="ttl-caption ttl-legal-toc-title">{t('ui.toc', 'Contents')}</p>
                <ul>
                  {sections.map((s, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => scrollToId(`sec-${i}`)}>{s.h}</button>
                    </li>
                  ))}
                </ul>
              </nav>
            </FadeUp>
          )}

          {/* Секции документа. HTML — наш собственный статический контент из locales. */}
          <article className="ttl-legal">
            {sections.map((s, i) => (
              <section key={i} id={`sec-${i}`}>
                <h2>{s.h}</h2>
                <div dangerouslySetInnerHTML={{ __html: s.b }} />
              </section>
            ))}
          </article>

          {/* На странице cookies — управление согласием (отзыв так же прост, как выдача) */}
          {doc === 'cookies' && (
            <div className="ttl-legal-cookiebtn">
              <button type="button" className="ttl-ghost" onClick={openCookieConsent}>
                {t('ui.cookieSettingsBtn', 'Change my cookie choice')}
              </button>
              <p className="ttl-caption">{t('ui.cookieSettingsHint', 'Reopens the consent banner so you can change your selection at any time.')}</p>
            </div>
          )}

          <p className="ttl-caption ttl-legal-contact">
            {t('ui.contact', 'Questions about this document? Contact us at')}{' '}
            <a href="mailto:SEO@trendtraffic.pro">SEO@trendtraffic.pro</a>
          </p>
        </main>

        <TTFooter />
      </div>
    </div>
  );
}

export default LegalDocPage;
