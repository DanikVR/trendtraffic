/** AboutPage — «О проекте» (пока заглушка в стиле лендинга; контент позже). */

import { useTranslation } from 'react-i18next';
import { StubPage } from './landing/StubPage';

export function AboutPage() {
  const { t } = useTranslation('common');
  return (
    <StubPage
      title={t('sec.ttLanding.aboutTitle', 'О проекте')}
      metaTitle={t('sec.ttLanding.aboutMeta', 'О проекте — TrendTraffic')}
    />
  );
}

export default AboutPage;
