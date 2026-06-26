/**
 * Типы ответов backend API (frontend-сторона).
 *
 * Заменяют `any` при разборе `res.json()`. Намеренно НЕ претендуют на полноту
 * схемы БД — описывают только те поля, которые реально читает UI. Расширять по
 * мере необходимости. Источник правды по схеме — backend (Zod в packages/shared).
 */

/** Комната из GET /api/rooms (список «моих» комнат). */
export interface ApiRoom {
  id: string;
  name: string;
  participantsCount?: number;
  isLive?: boolean;
  // ENTERPRISE v0.10.0
  kind?: 'video' | 'telegram_chat';
  telegramUsername?: string | null;
  telegramDisplayName?: string | null;
  tags?: Array<{ id: string; name: string; color: string | null; confidence: number | null }>;
}

export interface RoomsResponse {
  rooms: ApiRoom[];
}

/** Подписка из GET /api/billing/me. */
export interface BillingSubscription {
  tier: string;
  status?: string;
  balanceSeconds?: number;
  rolloverSeconds?: number;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  hasActiveStripeSub?: boolean;
  rolloverMinutes?: number;
  totalMinutes?: number;
}

export interface BillingMeResponse {
  subscription: BillingSubscription | null;
}

/**
 * Безопасно читает JSON-тело ответа: пустое тело или не-JSON → {} (Partial<T>).
 * Заменяет повторяющийся по коду паттерн:
 *   const text = await res.text(); let data: any = {};
 *   if (text.trim()) { try { data = JSON.parse(text); } catch {} }
 */
export async function readJson<T>(res: Response): Promise<Partial<T>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as T;
  } catch {
    return {};
  }
}
