/**
 * Глобальный стейт-менеджер VibeVox (Zustand).
 *
 * Управляет:
 * - Данными пользователя и арендатора
 * - Токеном JWT авторизации
 * - Флагом Telegram Mini App
 * - Состоянием Sidebar
 * - Балансом секунд перевода
 * - Текущим языком интерфейса
 */

import { create } from 'zustand';
import { readJson, type BillingMeResponse } from '../types/api';

// ============================================================================================
// Типы
// ============================================================================================

/** Данные авторизованного пользователя */
export interface UserData {
  id: string;
  name?: string;
  email: string;
  role: 'superadmin' | 'tenant_admin' | 'user';
  tenantId: string | null;
  avatarUrl?: string;
}

/**
 * Минимальный профиль для сохранения в localStorage.
 *
 * ПОЧЕМУ ТОЛЬКО ЭТО: localStorage доступен из любого скрипта на странице (включая
 * потенциально XSS-инъекции). Чем меньше PII там лежит — тем меньше атакующему
 * с XSS-доступом дать. id/role/tenantId нужны фронту для роутинга (RequireAuth/
 * RequireAdmin) и API-вызовов; email — для отображения; name/avatarUrl — нет
 * (восстанавливаются через /api/auth/me после bootstrap'a, либо появляются
 * сразу после логина).
 *
 * TODO (long-term): полностью убрать JWT из localStorage. Идеал — httpOnly cookie
 * + CSRF-токен. Это потребует синхронных изменений на бэке + bootstrap-flow.
 */
type PersistedUser = Pick<UserData, 'id' | 'email' | 'role' | 'tenantId'>;

function toPersistedUser(u: UserData): PersistedUser {
  return { id: u.id, email: u.email, role: u.role, tenantId: u.tenantId };
}

/** Состояние приложения */
interface AppState {
  /** Данные текущего пользователя (null = не авторизован) */
  user: UserData | null;
  /** JWT токен авторизации */
  token: string | null;
  /** UUID текущего арендатора */
  tenantId: string | null;
  /** Тарифный план текущей подписки (общая категория). */
  subscriptionTier: 'trial' | 'monthly' | 'annual' | 'enterprise' | null;
  /** Сырое имя тарифа из БД (plus / standard / standard_yearly / enterprise / trial). */
  subscriptionTierName: string | null;
  /** Статус подписки из БД (active / trialing / canceled / past_due / incomplete). Нужен,
   *  чтобы фронт-гейт был зеркалом feature_gate: tier='premium'+status='canceled' = НЕТ доступа. */
  subscriptionStatus: string | null;
  /**
   * true после того, как refreshBilling() хотя бы раз ОТРАБОТАЛ (успех или ошибка).
   * Нужен гейту оплаты (RequirePaid): пока false — статус подписки ещё не известен,
   * и нельзя редиректить платного юзера на /billing при перезагрузке закрытой страницы.
   */
  billingLoaded: boolean;
  /** Баланс секунд перевода */
  translationBalance: number;
  /** Флаг: приложение запущено внутри Telegram Mini App */
  isMiniApp: boolean;
  /** Состояние боковой панели (открыта/закрыта) */
  sidebarOpen: boolean;
  /** Мобильный More-sheet (открывается из гамбургера и из таба «Ещё»). */
  moreSheetOpen: boolean;
  /** Текущий язык интерфейса (ISO 639-1) */
  language: string;

  // Действия
  setUser: (user: UserData | null) => void;
  setToken: (token: string | null) => void;
  setTenantId: (id: string | null) => void;
  setSubscriptionTier: (tier: AppState['subscriptionTier']) => void;
  setTranslationBalance: (balance: number) => void;
  setMiniApp: (flag: boolean) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setMoreSheetOpen: (open: boolean) => void;
  setLanguage: (lng: string) => void;
  updateUser: (fields: Partial<UserData>) => void;
  
  /** Установка данных авторизации */
  setAuth: (token: string, user: UserData) => void;
  /** Выход из аккаунта */
  logout: () => void;
  /** Полный сброс состояния */
  reset: () => void;
  /** Подгрузить текущие данные подписки (баланс минут + тариф) из /api/billing/me. */
  refreshBilling: () => Promise<void>;
}

// ============================================================================================
// Начальное состояние
// ============================================================================================

const initialState = {
  user: null,
  token: null,
  tenantId: null,
  subscriptionTier: null as AppState['subscriptionTier'],
  subscriptionTierName: null as string | null,
  subscriptionStatus: null as string | null,
  billingLoaded: false,
  translationBalance: 0,
  isMiniApp: false,
  sidebarOpen: true,
  moreSheetOpen: false,
  language: 'ru',
};

// ============================================================================================
// Zustand Store
// ============================================================================================

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setTenantId: (tenantId) => set({ tenantId }),
  setSubscriptionTier: (subscriptionTier) => set({ subscriptionTier }),
  setTranslationBalance: (translationBalance) => set({ translationBalance }),
  setMiniApp: (isMiniApp) => set({ isMiniApp }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setMoreSheetOpen: (moreSheetOpen) => set({ moreSheetOpen }),
  setLanguage: (language) => set({ language }),
  updateUser: (fields) => set((state) => {
    if (!state.user) return {};
    const updatedUser = { ...state.user, ...fields };
    // В localStorage кладём только минимум; name/avatarUrl остаются в памяти.
    localStorage.setItem('vibevox_user', JSON.stringify(toPersistedUser(updatedUser)));
    return { user: updatedUser };
  }),

  setAuth: (token, user) => {
    // Сохраняем в localStorage минимум — для восстановления сессии при перезагрузке.
    // Полный user (с name/avatarUrl) остаётся только в памяти Zustand.
    localStorage.setItem('vibevox_token', token);
    localStorage.setItem('vibevox_user', JSON.stringify(toPersistedUser(user)));

    set({
      token,
      user,
      tenantId: user.tenantId,
      // Если суперадмин, устанавливаем тариф enterprise, иначе trial
      subscriptionTier: user.role === 'superadmin' ? 'enterprise' : 'trial',
    });
  },

  logout: () => {
    localStorage.removeItem('vibevox_token');
    localStorage.removeItem('vibevox_user');
    set({
      ...initialState,
      // Сохраняем флаг Telegram Mini App и язык, чтобы не сбрасывать среду
      isMiniApp: useAppStore.getState().isMiniApp,
      language: useAppStore.getState().language,
    });
  },

  reset: () => set(initialState),

  /**
   * Подгружает баланс минут + тариф из /api/billing/me и кладёт в store.
   * Вызывается:
   *  - после логина (в LoginPage / RegisterPage / GoogleCallbackPage)
   *  - при монтировании MainLayout (на каждой странице сайдбар свежий)
   *  - после успешных операций с балансом (топап, кредит, изменение тарифа)
   * Никогда не бросает: ошибка сети не должна валить UI.
   */
  refreshBilling: async () => {
    const state = useAppStore.getState();
    if (!state.token) return;
    try {
      const res = await fetch('/api/billing/me', {
        headers: { 'Authorization': `Bearer ${state.token}` },
      });
      if (!res.ok) { set({ billingLoaded: true }); return; }
      const data = await readJson<BillingMeResponse>(res);
      const sub = data.subscription;
      if (!sub) {
        set({ translationBalance: 0, subscriptionTierName: null, subscriptionTier: 'trial', subscriptionStatus: null, billingLoaded: true });
        return;
      }
      const balanceSeconds = (Number(sub.balanceSeconds) || 0) + (Number(sub.rolloverSeconds) || 0);
      const tierMap: Record<string, AppState['subscriptionTier']> = {
        premium: 'enterprise',      // Premium = полный доступ (категория «enterprise»); raw-имя 'premium' для отображения
        plus: 'monthly',
        standard: 'monthly',
        standard_yearly: 'annual',
        enterprise: 'enterprise',
        trial: 'trial',
        monthly: 'monthly',
        annual: 'annual',
      };
      set({
        translationBalance: balanceSeconds,
        subscriptionTier: tierMap[sub.tier] ?? 'trial',
        subscriptionTierName: sub.tier || null,
        subscriptionStatus: sub.status || null,
        billingLoaded: true,
      });
    } catch {
      // Сеть упала — статус неизвестен, но гейт нельзя держать в «загрузке» вечно.
      set({ billingLoaded: true });
    }
  },
}));

// Попытка восстановить сессию при загрузке скрипта
try {
  const savedToken = localStorage.getItem('vibevox_token');
  const savedUser = localStorage.getItem('vibevox_user');
  if (savedToken && savedUser) {
    const parsedUser = JSON.parse(savedUser);
    useAppStore.getState().setAuth(savedToken, parsedUser);
    // Сразу подгружаем тариф при восстановлении сессии — чтобы гейт оплаты (RequirePaid)
    // знал статус до монтирования MainLayout и не выбрасывал платного юзера на /billing
    // при перезагрузке закрытой страницы. setAuth ставит лишь временный 'trial'.
    void useAppStore.getState().refreshBilling();
  }
} catch (e) {
  console.error('Ошибка восстановления сессии:', e);
}
