// Общие типы для фронтенда и бэкенда VibeVox
export type UserRole = 'superadmin' | 'tenant_admin' | 'user';
export type TenantStatus = 'active' | 'suspended';
export type SubscriptionTier = 'trial' | 'monthly' | 'annual' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due';
export type SipTransport = 'udp' | 'tcp' | 'tls';
