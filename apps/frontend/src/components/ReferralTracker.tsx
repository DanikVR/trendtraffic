/**
 * ReferralTracker — невидимый компонент, который один раз при загрузке страницы:
 *  1) читает URL-параметр `?Vibe=CODE`
 *  2) сохраняет код в cookie `vbvx_ref` на 90 дней
 *  3) шлёт fire-and-forget POST /api/partners/track-click для счётчика переходов
 *  4) чистит URL от `?Vibe=` через history.replaceState (чтобы код не светился)
 *
 * Не зависит от react-router хуков, поэтому может стоять в корне App.tsx,
 * до того как RouterProvider начнёт рендерить дерево.
 */

import { useEffect } from 'react';

const PARAM_NAME = 'Vibe';
const COOKIE_NAME = 'vbvx_ref';
const COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 дней

function setRefCookie(code: string) {
  const secureFlag = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; max-age=${COOKIE_MAX_AGE_SECONDS}; path=/; samesite=lax${secureFlag}`;
}

function stripVibeFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAM_NAME)) return;
    url.searchParams.delete(PARAM_NAME);
    const cleanSearch = url.searchParams.toString();
    const newUrl =
      url.pathname +
      (cleanSearch ? `?${cleanSearch}` : '') +
      url.hash;
    window.history.replaceState({}, '', newUrl);
  } catch {
    // если URL невалидный — просто игнорируем, не критично
  }
}

export function ReferralTracker() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get(PARAM_NAME);
      if (!code) return;

      const trimmed = code.trim();
      if (!trimmed || trimmed.length > 32) return;

      // Сохраняем в cookie на 90 дней — атрибуция переживёт открытие сайта в новой вкладке.
      setRefCookie(trimmed);

      // Fire-and-forget трекер. Ошибки игнорируем — это не должно мешать UX.
      fetch('/api/partners/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
        keepalive: true,
      }).catch(() => {});

      // Убираем код из URL после сохранения, чтобы не светился в адресной строке.
      stripVibeFromUrl();
    } catch {
      // безопасный тихий no-op
    }
  }, []);

  return null;
}

/**
 * Утилита для других модулей (Login/Register Page): достать партнёрский код
 * из cookie (приоритет — там, потому что cookie живёт 90 дней) или из URL fallback.
 */
export function readReferralCode(): string | null {
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
    if (match?.[1]) return decodeURIComponent(match[1]).trim() || null;

    // fallback: вдруг ReferralTracker ещё не отработал в этой сессии
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(PARAM_NAME);
    return raw ? raw.trim() || null : null;
  } catch {
    return null;
  }
}
