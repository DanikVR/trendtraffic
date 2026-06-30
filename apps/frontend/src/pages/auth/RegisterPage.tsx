/**
 * RegisterPage — страница регистрации (Abyss Aurora, mobile-first).
 * Вся оригинальная логика сохранена.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { AuroraButton } from '../../components/AuroraButton';
import { AuroraInput }  from '../../components/AuroraInput';
import { VibeVoxLogo }  from '../../components/VibeVoxLogo';
import { useAppStore }  from '../../store/useAppStore';
import { readReferralCode } from '../../components/ReferralTracker';

export function RegisterPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { setAuth } = useAppStore();

  const passwordRules = [
    { id: 'length', label: t('auth.register.ruleLength'), check: (p: string) => p.length >= 8 },
    { id: 'upper',  label: t('auth.register.ruleUpper'),  check: (p: string) => /[A-Z]/.test(p)  },
    { id: 'number', label: t('auth.register.ruleNumber'), check: (p: string) => /[0-9]/.test(p)  },
  ];

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [serverClientId, setServerClientId] = useState('');

  useEffect(() => {
    fetch('/api/auth/google-settings')
      .then(res => res.json())
      .then(data => {
        if (data.clientId) {
          setServerClientId(data.clientId);
        }
      })
      .catch(err => console.warn('[RegisterPage] Не удалось загрузить Google Client ID с сервера:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) { setError(t('auth.register.registerFailed')); return; }
    if (password.length < 8) { setError(t('auth.register.passwordTooShort')); return; }
    setError('');
    setLoading(true);
    try {
      const partnerCode = readReferralCode();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          ...(partnerCode ? { partnerCode } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t('auth.register.registerFailed'));
      }
      const { token, user } = await res.json();
      setAuth(token, user);
      // См. LoginPage: подгружаем тариф до перехода, иначе гейт оплаты висит на спиннере.
      await useAppStore.getState().refreshBilling();
      navigate('/');
    } catch (err: any) {
      setError(err?.message || t('auth.register.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Ambient glows */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none opacity-40 dark:opacity-100"
        style={{ background: 'radial-gradient(ellipse, var(--hero-glow-color) 0%, transparent 70%)', filter: 'blur(55px)' }} />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full pointer-events-none opacity-20 dark:opacity-50"
        style={{ background: 'radial-gradient(circle, var(--hero-glow-color) 0%, transparent 70%)', filter: 'blur(50px)' }} />

      <div className="relative z-10 w-full max-w-sm animate-slide-up">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <VibeVoxLogo height={60} />
          <div className="text-center">
            <h1
              className="text-2xl font-800 text-aurora"
              style={{
                fontFamily: 'Geist Sans, sans-serif',
                letterSpacing: '-0.03em',
              }}
            >
              {t('auth.register.title')}
            </h1>
          </div>
        </div>

        {/* Card */}
        <div
          className="p-6 rounded-3xl border transition-all"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            backdropFilter: 'blur(24px)',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          {error && (
            <div
              className="flex items-center gap-2.5 p-3 rounded-2xl mb-4 text-sm"
              style={{
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.20)',
                color: 'var(--accent-magenta)',
              }}
            >
              <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-700"
                style={{ background: 'rgba(239,68,68,0.20)' }}>!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AuroraInput
              label={t('auth.register.nameLabel')}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.register.namePlaceholder')}
              icon={<User size={16} strokeWidth={1.5} />}
              autoComplete="name"
              inputId="register-name"
              autoFocus
            />

            <AuroraInput
              label={t('auth.common.emailLabel')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.common.emailPlaceholder')}
              icon={<Mail size={16} strokeWidth={1.5} />}
              autoComplete="email"
              inputId="register-email"
            />

            <AuroraInput
              label={t('auth.common.passwordLabel')}
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.register.passwordHintShort')}
              icon={<Lock size={16} strokeWidth={1.5} />}
              iconRight={
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}
                  className="touch-target flex items-center justify-center hover:opacity-80 transition-opacity"
                  title={showPass ? t('auth.common.hidePassword') : t('auth.common.showPassword')}
                  aria-label={showPass ? t('auth.common.hidePassword') : t('auth.common.showPassword')}
                >
                  {showPass ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                </button>
              }
              autoComplete="new-password"
              inputId="register-password"
            />

            {/* Правила пароля */}
            {password.length > 0 && (
              <div className="flex flex-col gap-1.5 pl-1">
                {passwordRules.map((rule) => {
                  const ok = rule.check(password);
                  return (
                    <div key={rule.id} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all text-xs"
                        style={ok
                          ? { background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)' }
                          : { background: 'var(--bg-tertiary)', color: 'var(--text-disabled)' }
                        }
                      >
                        <Check size={9} strokeWidth={2.5} />
                      </div>
                      <span className="text-xs transition-colors" style={{ color: ok ? 'var(--accent-green)' : 'var(--text-disabled)' }}>
                        {rule.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Условия */}
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-disabled)' }}>
              {t('auth.register.agreementPrefix')}{' '}
              <a href="#" className="underline transition-colors hover:opacity-80 underline-offset-4" style={{ color: 'var(--text-primary)' }}>
                {t('auth.register.agreementTos')}
              </a>
              {t('auth.register.agreementAnd')}
              <a href="#" className="underline transition-colors hover:opacity-80 underline-offset-4" style={{ color: 'var(--text-primary)' }}>
                {t('auth.register.agreementPrivacy')}
              </a>
            </p>

            <AuroraButton
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              iconRight={!loading ? <ArrowRight size={18} strokeWidth={2} /> : undefined}
              id="register-submit"
            >
              {loading ? t('auth.register.loading') : t('auth.register.submit')}
            </AuroraButton>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="aurora-divider flex-1" />
            <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>{t('auth.common.or')}</span>
            <div className="aurora-divider flex-1" />
          </div>

          {/* Social buttons */}
          <div className="space-y-3">
            <button
              id="register-google"
              type="button"
              className="btn btn-google btn-full btn-lg flex items-center gap-3"
              onClick={() => {
                const clientId = serverClientId || localStorage.getItem('sys_google_client_id') || '813706901561-ndnndbssl6im5e4hrjnjnljf7fcmmva3.apps.googleusercontent.com';
                const redirectUri = window.location.origin === 'http://localhost:3000'
                  ? 'http://localhost:3000/api/auth/callback/google'
                  : `${window.location.origin}/auth/google/callback`;
                const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email%20profile&prompt=select_account`;
                window.location.href = googleUrl;
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>{t('auth.common.googleSignUp')}</span>
            </button>
          </div>
        </div>

        <p className="text-center mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('auth.register.haveAccount')}{' '}
          <Link
            to="/auth/login"
            className="font-600 transition-colors hover:opacity-80 underline underline-offset-4"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('auth.register.loginLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
