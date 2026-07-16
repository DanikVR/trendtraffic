/** WikiPage — «Wiki / Документация» (пока заглушка в стиле лендинга; контент позже). */

import { useTranslation } from 'react-i18next';
import { StubPage } from './landing/StubPage';

export function WikiPage() {
  const { t } = useTranslation('common');
  return (
    <StubPage
      title={t('sec.ttLanding.wikiTitle', 'Wiki')}
      metaTitle={t('sec.ttLanding.wikiMeta', 'Wiki — TrendTraffic')}
    />
  );
}

export default WikiPage;
