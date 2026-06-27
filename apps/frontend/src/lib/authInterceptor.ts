/**
 * Глобальный перехватчик 401 (истёкшая/невалидная сессия).
 *
 * ПРОБЛЕМА: стор восстанавливает сессию из localStorage БЕЗ проверки токена
 * (useAppStore: bootstrap). Если JWT протух/невалиден, `RequireAuth` всё равно
 * пускает (токен формально есть), но КАЖДЫЙ /api-запрос возвращает 401 — консоль
 * засыпается десятками 401, страница «сломана».
 *
 * РЕШЕНИЕ: один раз патчим window.fetch. Если наш `/api/`-запрос (кроме
 * `/api/auth/` — там 401 = «неверный пароль», не истёкшая сессия) вернул 401 ПРИ
 * наличии токена в сторе — считаем сессию истёкшей: logout() + переход на
 * /auth/login?expired=1. Срабатывает один раз (флаг), ответ возвращаем как есть,
 * fetch никогда не ломаем.
 */
import { useAppStore } from '../store/useAppStore';

let handling = false;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  try { return (input as Request).url || ''; } catch { return ''; }
}

export function installAuthInterceptor(): void {
  if ((window as any).__ttAuthInterceptor) return;
  (window as any).__ttAuthInterceptor = true;

  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await orig(input as any, init);
    try {
      if (res.status === 401 && !handling) {
        const url = urlOf(input);
        const isApi = url.includes('/api/');
        const isAuthEndpoint = url.includes('/api/auth/');
        const hasToken = !!useAppStore.getState().token;
        if (isApi && !isAuthEndpoint && hasToken) {
          handling = true;
          try { useAppStore.getState().logout(); } catch { /* ignore */ }
          if (!location.pathname.startsWith('/auth/login')) {
            location.assign('/auth/login?expired=1');
          }
        }
      }
    } catch {
      /* перехватчик никогда не должен ломать сам fetch */
    }
    return res;
  };
}
