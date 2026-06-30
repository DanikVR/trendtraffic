/**
 * useIsEnterprise — реактивный хук для проверки доступа к Enterprise-фичам.
 *
 * Возвращает true если:
 *  - Текущий пользователь — суперадмин (всегда имеет полный доступ), либо
 *  - subscriptionTier в store === 'enterprise'
 *
 * Используется для условного рендеринга Enterprise-блоков в UI (карточка комнаты,
 * пункт «Настройки» в сайдбаре, разделы EnterpriseSettingsPage).
 */

import { useAppStore } from '../store/useAppStore';

/**
 * Доступ к Enterprise определяется по любому из двух признаков:
 *  1. role === 'superadmin' (полный доступ всегда)
 *  2. subscriptionTierName === 'enterprise' (raw имя из БД)
 *     ИЛИ subscriptionTier === 'enterprise' (общая категория)
 *
 * Оба поля читаются, потому что они могут быть рассинхронизированы:
 * subscriptionTier ставится в 'trial' при `setAuth()` и обновляется на 'enterprise'
 * только когда отрабатывает refreshBilling(). subscriptionTierName — raw имя
 * тарифа из БД и обновляется тоже там же. Если по какой-то причине одно поле
 * обновилось, а другое нет — hook всё равно сработает.
 */
export function useIsEnterprise(): boolean {
  const role = useAppStore((s) => s.user?.role);
  const tier = useAppStore((s) => s.subscriptionTier);
  const tierName = useAppStore((s) => s.subscriptionTierName);
  if (role === 'superadmin') return true;
  // Полный доступ к фичам дают и Premium, и Enterprise (функции идентичны).
  // case-insensitive: subscriptionTierName — raw имя из БД, регистр может «гулять».
  const FULL = ['enterprise', 'premium'];
  return FULL.includes((tier || '').toLowerCase()) || FULL.includes((tierName || '').toLowerCase());
}
