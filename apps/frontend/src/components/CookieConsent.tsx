/**
 * CookieConsent — плашка согласия на cookies по нормам ЕС (GDPR/ePrivacy).
 *
 * Требования ЕС, которые здесь соблюдены: выбор ДО установки необязательных
 * cookies, кнопка отказа («Только необходимые») равнозначна кнопке согласия,
 * ссылки на Политику конфиденциальности и Политику cookies, решение хранится
 * локально (tt_cookie_consent) и плашка больше не показывается.
 * Сейчас сервис ставит только строго необходимые cookies/localStorage (сессия,
 * язык, тема) — выбор пользователя учитывается на будущее для аналитики.
 *
 * Инлайн-стили без зависимостей от landing.css — компонент живёт и на
 * маркетинговых страницах (лендинг, легалки), и на публичном /billing.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LS_KEY = 'tt_cookie_consent';
const REOPEN_EVENT = 'tt-cookie-consent-open';
/** Согласие «протухает» через 12 месяцев — плашка показывается заново (рекомендация ЕС). */
const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export type CookieConsentLevel = 'all' | 'essential';

export function getCookieConsent(): CookieConsentLevel | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v?.ts && Date.now() - new Date(v.ts).getTime() > CONSENT_TTL_MS) return null;
    return v?.level === 'all' || v?.level === 'essential' ? v.level : null;
  } catch { return null; }
}

function saveConsent(level: CookieConsentLevel) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ level, ts: new Date().toISOString() })); } catch { /* private mode */ }
}

/**
 * Повторно открыть плашку согласия (ссылка «Настройки cookie» в футере,
 * кнопка на /cookies): отзыв согласия обязан быть так же прост, как выдача.
 */
export function openCookieConsent() {
  try { localStorage.removeItem(LS_KEY); } catch { /* private mode */ }
  window.dispatchEvent(new Event(REOPEN_EVENT));
}

export function CookieConsent() {
  const { t } = useTranslation('common');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Показываем только если решение ещё не принято (или устарело).
    if (!getCookieConsent()) setVisible(true);
    const reopen = () => setVisible(true);
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
  }, []);

  if (!visible) return null;

  const choose = (level: CookieConsentLevel) => { saveConsent(level); setVisible(false); };

  const btnBase: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.02em',
    borderRadius: 999,
    padding: '10px 18px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('sec.misc.cookieAria', 'Согласие на использование cookies')}
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 55,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: 760,
          width: '100%',
          background: 'rgba(12, 12, 14, 0.92)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 20,
          padding: '16px 18px',
          color: '#e8e8e8',
          boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <p style={{ margin: 0, flex: '1 1 320px', fontSize: 13, lineHeight: 1.55, fontWeight: 400 }}>
          {t('sec.misc.cookieText', 'Мы используем cookies: строго необходимые — для работы сайта (вход, язык, тема), и, с вашего согласия, аналитические — чтобы улучшать сервис. Подробности — в ')}
          <a href="/cookies" style={{ color: '#a78bfa', textDecoration: 'underline' }}>
            {t('sec.misc.cookiePolicyLink', 'Политике cookies')}
          </a>
          {' '}{t('sec.misc.cookieAnd', 'и')}{' '}
          <a href="/privacy" style={{ color: '#a78bfa', textDecoration: 'underline' }}>
            {t('sec.misc.cookiePrivacyLink', 'Политике конфиденциальности')}
          </a>.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            id="cookie-essential"
            onClick={() => choose('essential')}
            style={{ ...btnBase, background: 'transparent', border: '1px solid rgba(255,255,255,0.28)', color: '#e8e8e8' }}
          >
            {t('sec.misc.cookieEssential', 'Только необходимые')}
          </button>
          <button
            type="button"
            id="cookie-accept-all"
            onClick={() => choose('all')}
            style={{ ...btnBase, background: '#8052ff', border: '1px solid #8052ff', color: '#fff' }}
          >
            {t('sec.misc.cookieAcceptAll', 'Принять все')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
