import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle } from 'lucide-react';
import { VibeVoxLogo } from '../../components/VibeVoxLogo';
import { useAppStore } from '../../store/useAppStore';
import { AuroraButton } from '../../components/AuroraButton';
import { readReferralCode } from '../../components/ReferralTracker';

export function GoogleCallbackPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAppStore();
  const [error, setError] = useState('');
  const [status, setStatus] = useState(t('auth.googleCallback.loading'));

  const ranRef = useRef(false);
  useEffect(() => {
    // Google-код одноразовый: если эффект перезапустится (StrictMode в dev или
    // смена identity у t/i18n), повторный POST с уже использованным кодом даст
    // ложную «ошибку регистрации» перед редиректом. Гард → строго один запуск.
    if (ranRef.current) return;
    ranRef.current = true;

    const code = searchParams.get('code');
    if (!code) {
      setError(t('auth.googleCallback.error'));
      return;
    }

    const processLogin = async () => {
      setStatus(t('auth.googleCallback.loading'));
      try {
        // redirect_uri должен совпадать с тем, что был использован при начальном запросе
        const clientId = localStorage.getItem('sys_google_client_id') || '';
        const clientSecretVal = localStorage.getItem('sys_google_client_secret') || '';
        const redirectUri = window.location.origin === 'http://localhost:3000'
          ? 'http://localhost:3000/api/auth/callback/google'
          : `${window.location.origin}/auth/google/callback`;

        setStatus(t('auth.googleCallback.loading'));
        // Передаём clientId/clientSecret как фолбэк — сервер автоматически сохранит их
        const partnerCode = readReferralCode();
        const res = await fetch('/api/auth/google-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            clientId,
            clientSecret: clientSecretVal,
            redirectUri,
            ...(partnerCode ? { partnerCode } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || t('auth.googleCallback.error'));
        }

        const data = await res.json();
        setStatus(t('auth.googleCallback.redirecting'));
        setAuth(data.token, data.user);

        // Небольшая задержка перед редиректом для плавности перехода
        setTimeout(() => {
          navigate('/');
        }, 1000);
      } catch (err: any) {
        console.error('[GoogleCallbackPage Error]:', err);
        setError(err.message || t('auth.googleCallback.error'));
      }
    };

    processLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Мягкое свечение Aurora */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(circle, var(--hero-glow-color) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative z-10 w-full max-w-sm text-center space-y-6 animate-slide-up">
        {/* Логотип-индикатор */}
        <div className="flex justify-center animate-pulse">
          <VibeVoxLogo height={48} />
        </div>

        {/* Информационная карточка */}
        <div
          className="p-8 rounded-3xl border text-center space-y-4"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            backdropFilter: 'blur(24px)',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          {error ? (
            <div className="space-y-4">
              <div className="flex justify-center text-[var(--accent-magenta)] animate-bounce">
                <AlertCircle size={40} strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-700 text-[var(--text-primary)]" style={{ fontFamily: 'Geist Sans, sans-serif' }}>
                {t('auth.googleCallback.error')}
              </h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {error}
              </p>
              <div className="pt-2">
                <AuroraButton fullWidth onClick={() => navigate('/auth/login')}>
                  {t('auth.forgot.backToLogin')}
                </AuroraButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                <Loader2 size={36} className="animate-spin" style={{ color: '#A78BFA' }} />
              </div>
              <h2 className="text-lg font-700 text-[var(--text-primary)]" style={{ fontFamily: 'Geist Sans, sans-serif' }}>
                {t('auth.common.googleSignIn')}
              </h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {status}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
