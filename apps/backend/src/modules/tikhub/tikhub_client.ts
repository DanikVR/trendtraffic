/**
 * TikHub.io API клиент (TrendTraffic).
 *
 * TikHub — единый сторонний REST API для сканирования трендов и скачивания видео
 * (TikTok, Douyin, Instagram, YouTube и др.). Авторизация — Bearer-токен; биллинг
 * pay-as-you-go. Один платформенный ключ на весь аккаунт ИЛИ собственный ключ
 * Enterprise-тенанта (см. systemConfig.getTikHubApiKey / tenant_settings/tikhub.ts).
 *
 * Здесь — низкоуровневый GET + РЕАЛЬНАЯ проверка ключа (эндпоинт get_user_info).
 * Методы скана трендов/скачивания добавятся в блоке «Анализатор трендов».
 *
 * Эндпоинт проверки (сверено по openapi.json):
 *   GET /api/v1/tikhub/user/get_user_info  (Bearer)
 *   200 → { code, api_key_data:{ api_key_name, api_key_scopes, api_key_status, expires_at },
 *           user_data:{ email, balance, free_credit, email_verified, account_disabled, is_active } }
 */

const TIKHUB_BASE = (process.env.TIKHUB_BASE_URL || 'https://api.tikhub.io').replace(/\/+$/, '');

export interface TikHubResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Низкоуровневый авторизованный GET к TikHub. Никогда не бросает — возвращает
 * типизированный результат (по образцу channels/instagram/ig_client.ts).
 */
export async function tikhubGet<T = any>(
  apiKey: string,
  pathAndQuery: string,
  opts?: { timeoutMs?: number }
): Promise<TikHubResult<T>> {
  const url = pathAndQuery.startsWith('http') ? pathAndQuery : `${TIKHUB_BASE}${pathAndQuery}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 20000);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'User-Agent': 'TrendTraffic/1.0',
      },
      signal: controller.signal,
    });
    const text = await resp.text();
    let data: any = undefined;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!resp.ok) {
      const apiMsg =
        (data && typeof data === 'object' && (data.detail || data.message || data.error)) || '';
      return { ok: false, status: resp.status, error: apiMsg ? String(apiMsg).slice(0, 300) : `HTTP ${resp.status}` };
    }
    return { ok: true, status: resp.status, data: data as T };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return { ok: false, status: 0, error: aborted ? 'Таймаут запроса к TikHub' : (err?.message || String(err)) };
  } finally {
    clearTimeout(timer);
  }
}

export type TikHubKeyStatus = 'active' | 'invalid' | 'quota_exceeded';

export interface TikHubKeyInfo {
  ok: boolean;
  /** Готовый текст для UI: email + баланс, либо причина ошибки. */
  message: string;
  status: TikHubKeyStatus;
  email?: string;
  balance?: number;
  freeCredit?: number;
  apiKeyName?: string;
  scopes?: string[];
  expiresAt?: string | null;
  error?: string;
}

/**
 * РЕАЛЬНАЯ проверка ключа против TikHub (GET get_user_info — самый дешёвый
 * account-эндпоинт; отдаёт статус ключа + баланс). Используется кнопкой
 * «Проверить» в админке и в Enterprise-настройках тенанта.
 */
export async function validateTikHubKey(apiKey: string): Promise<TikHubKeyInfo> {
  const key = (apiKey || '').trim();
  if (!key) return { ok: false, status: 'invalid', message: 'Ключ не задан', error: 'empty' };

  const r = await tikhubGet<any>(key, '/api/v1/tikhub/user/get_user_info');

  if (r.ok && r.data && typeof r.data === 'object') {
    const u = r.data.user_data || {};
    const k = r.data.api_key_data || {};
    const disabled = u.account_disabled === true || u.is_active === false;
    if (disabled) {
      return { ok: false, status: 'invalid', message: 'Аккаунт TikHub отключён или ключ неактивен.', error: 'account_disabled' };
    }
    const balance = typeof u.balance === 'number' ? u.balance : undefined;
    const freeCredit = typeof u.free_credit === 'number' ? u.free_credit : undefined;
    const email = typeof u.email === 'string' ? u.email : undefined;
    const balStr = balance != null ? `$${balance.toFixed(4)}` : '—';
    const freeStr = freeCredit != null ? `$${freeCredit.toFixed(4)}` : '—';
    return {
      ok: true,
      status: 'active',
      message: `Ключ валиден${email ? ` (${email})` : ''}. Баланс: ${balStr}, бесплатный кредит: ${freeStr}.`,
      email,
      balance,
      freeCredit,
      apiKeyName: typeof k.api_key_name === 'string' ? k.api_key_name : undefined,
      scopes: Array.isArray(k.api_key_scopes) ? k.api_key_scopes : undefined,
      expiresAt: k.expires_at ?? null,
    };
  }

  // 401/403 — невалидный ключ; 402/429 — недостаточно баланса / лимит; иначе сетевая ошибка.
  if (r.status === 401 || r.status === 403) {
    return { ok: false, status: 'invalid', message: `TikHub отверг ключ (HTTP ${r.status})${r.error ? ': ' + r.error : ''}.`, error: r.error };
  }
  if (r.status === 402 || r.status === 429) {
    return { ok: false, status: 'quota_exceeded', message: `Недостаточно баланса или превышен лимит TikHub (HTTP ${r.status}).`, error: r.error };
  }
  return { ok: false, status: 'invalid', message: `Не удалось проверить ключ: ${r.error || `HTTP ${r.status}`}.`, error: r.error };
}
