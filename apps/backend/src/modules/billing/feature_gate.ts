/**
 * Feature Gate — централизованная проверка доступности фич по тарифу.
 *
 * До v0.10.0 проверка `tier === 'enterprise'` хардкодилась в нескольких местах
 * (insights/router.ts, assistant/service.ts). Этот модуль централизует логику,
 * добавляет superadmin-bypass и поддержку списка фич.
 *
 * Использование:
 *   const access = await getFeatureAccess(tenantId, userRole);
 *   if (!access.enterprise) throw new EnterpriseFeatureRequiredError('chat');
 *
 *   // Или helper-обёртка:
 *   await requireEnterprise(tenantId, userRole, 'chat');
 */

import pool from '../../db/index.js';

// ============================================================================
// Типы
// ============================================================================

export type SubscriptionTier =
  | 'premium'
  | 'plus'
  | 'standard'
  | 'standard_yearly'
  | 'enterprise'
  | 'trial'
  | 'monthly'
  | 'annual';

/** Тарифы с ПОЛНЫМ доступом ко всем функциям сервиса (Премиум = Энтерпрайз по
 *  функциям; различие — в уровне сервиса/«под ключ», а не в наборе фич). */
export const FULL_ACCESS_TIERS = new Set<string>(['premium', 'enterprise']);

/** Тариф даёт полный доступ к фичам (Premium или Enterprise)? Для прямых проверок
 *  tier-строки вне getFeatureAccess (assistant/insights/usage/rooms). */
export function isFullAccessTier(tier: string | null | undefined): boolean {
  return !!tier && FULL_ACCESS_TIERS.has(tier);
}

export type UserRole = 'superadmin' | 'tenant_admin' | 'user';

export interface FeatureAccess {
  /** Сырое имя тарифа из БД, либо null если подписки нет */
  tier: SubscriptionTier | null;
  /** Статус подписки: 'active' | 'trialing' | ... */
  status: string | null;
  /** Доступ к Enterprise-фичам (включая superadmin-bypass) */
  enterprise: boolean;
  /** Это суперадмин (имеет доступ ко всему независимо от тарифа) */
  superadmin: boolean;
}

export class EnterpriseFeatureRequiredError extends Error {
  public readonly statusCode = 402; // Payment Required
  public readonly feature: string;

  constructor(feature: string) {
    super(
      `Функция "${feature}" доступна только на тарифе Enterprise. ` +
      `Обновите подписку в разделе «Тарифы».`
    );
    this.name = 'EnterpriseFeatureRequiredError';
    this.feature = feature;
  }
}

// ============================================================================
// Чтение тарифа
// ============================================================================

/**
 * Возвращает информацию о доступе пользователя к фичам.
 *
 * @param tenantId UUID арендатора
 * @param userRole опционально — роль пользователя. superadmin получает full access.
 */
export async function getFeatureAccess(
  tenantId: string | null | undefined,
  userRole?: UserRole
): Promise<FeatureAccess> {
  const isSuper = userRole === 'superadmin';

  if (!tenantId) {
    // Не залогинен / нет tenant — никакого Enterprise-доступа (кроме суперадмина-исключения)
    return {
      tier: null,
      status: null,
      enterprise: isSuper,
      superadmin: isSuper,
    };
  }

  try {
    const result = await pool.query(
      'SELECT tier, status FROM subscriptions WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );
    const row = result.rows[0];
    const tier = (row?.tier as SubscriptionTier) || null;
    const status = (row?.status as string) || null;

    const hasFullAccessTier = tier ? FULL_ACCESS_TIERS.has(tier) : false;
    const isActive = status === 'active' || status === 'trialing';

    return {
      tier,
      status,
      // «enterprise» здесь = «полный доступ к фичам». Его даёт и Premium, и Enterprise.
      enterprise: isSuper || (hasFullAccessTier && isActive),
      superadmin: isSuper,
    };
  } catch (err) {
    console.warn('[feature_gate] Ошибка чтения подписки:', err);
    return {
      tier: null,
      status: null,
      enterprise: isSuper,
      superadmin: isSuper,
    };
  }
}

/**
 * Бросает EnterpriseFeatureRequiredError если у пользователя нет Enterprise-доступа.
 * Используется в начале endpoint-handler'ов.
 */
export async function requireEnterprise(
  tenantId: string | null | undefined,
  userRole: UserRole | undefined,
  featureName: string
): Promise<FeatureAccess> {
  const access = await getFeatureAccess(tenantId, userRole);
  if (!access.enterprise) {
    throw new EnterpriseFeatureRequiredError(featureName);
  }
  return access;
}

/**
 * Сокращённая проверка — boolean.
 */
export async function hasEnterpriseAccess(
  tenantId: string | null | undefined,
  userRole?: UserRole
): Promise<boolean> {
  const access = await getFeatureAccess(tenantId, userRole);
  return access.enterprise;
}
