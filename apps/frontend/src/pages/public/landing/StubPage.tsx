/**
 * StubPage — каркас пустых публичных страниц лендинга (О проекте, Wiki…).
 * Тот же стиль «Dala»: чёрный void, крупная типографика, нав + футер.
 * Контент появится позже — страница честно говорит «в разработке».
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { TTNav, TTFooter, RevealLines, FadeUp } from './chrome';
import './landing.css';

export function StubPage({ title, metaTitle }: { title: string; metaTitle: string }) {
  const { t } = useTranslation('common');
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#000';
    return () => { document.body.style.background = prev; };
  }, []);

  return (
    <div className="ttl">
      <Helmet defer={false}><title>{metaTitle}</title></Helmet>
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
