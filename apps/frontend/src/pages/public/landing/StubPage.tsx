/**
 * StubPage — каркас пустых публичных страниц лендинга (О проекте, Wiki…).
 * Тот же стиль «Dala»: чёрный void, крупная типографика, нав + футер.
 * Контент появится позже — страница честно говорит «в разработке».
 */

import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { TTNav, TTFooter, RevealLines, FadeUp } from './chrome';
import './landing.css';

export function StubPage({ title, metaTitle, description }: { title: string; metaTitle: string; description?: string }) {
  const { t } = useTranslation('common');
  const { pathname } = useLocation();
  const canonical = `https://trendtraffic.pro${pathname}`;
  const desc = description
    || t('sec.ttLanding.pageDescription', 'TrendTraffic находит вирусные тренды в TikTok, Instagram и YouTube, разбирает их по кадрам и собирает UGC-ролики с ИИ-аватарами — с публикацией по расписанию и экономией на ИИ до ×4.');
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#000';
    return () => { document.body.style.background = prev; };
  }, []);

  return (
    <div className="ttl">
      {/* defer={false} — синхронный коммит тегов (rAF в скрытых вкладках/краулерах мёртв) */}
      <Helmet defer={false}>
        <title>{metaTitle}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={desc} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="TrendTraffic" />
        <meta property="og:image" content="https://trendtraffic.pro/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content="https://trendtraffic.pro/og-image.png" />
      </Helmet>
      <TTNav minimal />
      <main className="ttl-wrap ttl-stub-main">
        <FadeUp animate>
          <p className="ttl-label">{t('sec.ttLanding.stubLabel', 'TrendTraffic')}</p>
        </FadeUp>
        <RevealLines as="h1" className="ttl-h-lg" animate delay={0.1} lines={[title]} />
        <FadeUp animate delay={0.3}>
          <p className="ttl-body">
            {t('sec.ttLanding.stubSoon', 'Раздел в разработке — скоро здесь появится контент.')}
          </p>
          <Link className="ttl-ghost" to="/landing">
            ← {t('sec.ttLanding.stubBack', 'На главную')}
          </Link>
        </FadeUp>
      </main>
      <TTFooter />
    </div>
  );
}
