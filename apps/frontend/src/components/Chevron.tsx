/**
 * Chevron — направляющие иконки-стрелки, корректно работающие в RTL-локалях.
 *
 * Lucide-иконки `ChevronRight` / `ChevronLeft` всегда указывают физически
 * вправо/влево. В RTL-интерфейсе (ar, he, fa, ur, ps, sd, yi) направление
 * движения «вперёд / глубже» — справа налево, поэтому визуально chevron
 * должен указывать влево. Без этой инверсии стрелка в пунктах меню,
 * кнопках «Войти» и т.п. смотрит «против» направления чтения.
 *
 * Использование (drop-in замена):
 *   - `<ChevronForward />` — для forward-navigation (пункт меню, "Войти", "Далее")
 *   - `<ChevronBack />` — для back-navigation ("Назад", "Закрыть страницу")
 *
 * Реагирует на смену языка через useTranslation — RTL-флаг считается
 * из i18n.language, а не из `document.dir`, чтобы корректно работать
 * при prerender'е (статической генерации страниц).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { RTL_LANGUAGES } from '../config/i18n';

type ChevronProps = React.ComponentProps<typeof ChevronRight>;

function useIsRtl(): boolean {
  const { i18n } = useTranslation();
  const code = (i18n.language || 'en').split('-')[0];
  return RTL_LANGUAGES.includes(code);
}

/** Forward navigation chevron — `>` в LTR, `<` в RTL. */
export function ChevronForward(props: ChevronProps) {
  const Icon = useIsRtl() ? ChevronLeft : ChevronRight;
  return <Icon {...props} />;
}

/** Back navigation chevron — `<` в LTR, `>` в RTL. */
export function ChevronBack(props: ChevronProps) {
  const Icon = useIsRtl() ? ChevronRight : ChevronLeft;
  return <Icon {...props} />;
}
