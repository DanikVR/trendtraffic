/**
 * ResetPassword — установка нового пароля по ссылке из письма (Abyss Aurora, mobile-first).
 *
 * Принимает ?token=... из письма сброса, постит /api/auth/reset-password.
 * Токен одноразовый (привязан к текущему хэшу пароля) и живёт 1 час.
 */

import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { AuroraButton } from '../../components/AuroraButton';
import { AuroraInput }  from '../../components/AuroraInput';
import { VibeVoxLogo }  from '../../components/VibeVoxLogo';

export function ResetPassword() {
  const { t } = useTranslation('common');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [done,     setDone]       = useState(false);
  const [error,    setError]      = useState('');

  // Сопоставление машинных кодов ошибок бэка с локализованными строками.
  const messageForCode = (code?: string): string => {
    switch (code) {
      case 'TOO_SHORT':      return t('auth.reset.tooShort');
      case 'INVALID_LINK':   return t('auth.reset.invalidLink');
      case 'FIELDS_REQUIRED':return t('auth.reset.required');
      default:               return t('auth.reset.failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError(t('auth.reset.invalidLink')); return; }
    if (!password) { setError(t('auth.reset.required')); return; }
    if (password.length < 8) { setError(t('auth.reset.tooShort')); return; }
    if (password !== confirm) { setError(t('auth.reset.mismatch')); return; }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(messageForCode(data?.code)); return; }
      setDone(true);
    } catch {
      setError(t('auth.reset.failed'));
    } finally {
      setLoading(false);
    }
  };

  const passwordToggle = (
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
  );

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] pointer-events-none opacity-40 dark:opacity-100"
        style={{ background: 'radial-gradient(ellipse, var(--hero-glow-color) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative z-10 w-full max-w-sm animate-slide-up">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <VibeVoxLogo height={48} />
          <div className="text-center">
            <h1
              className="text-2xl font-800 mb-0.5 text-aurora"
              style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.03em' }}
            >
              {t('auth.reset.title')}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('auth.reset.subtitle')}
            </p>
          </div>
        </div>

        <div
          className="p-6 rounded-3xl border transition-all"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            backdropFilter: 'blur(24px)',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          {done ? (
            /* Успешно сброшен */
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(16,185,129,0.12)' }}
              >
                <CheckCircle size={32} strokeWidth={1.5} style={{ color: 'var(--accent-green)' }} />
              </div>
              <h2
                className="text-lg font-700 mb-2"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              >
                {t('auth.reset.successTitle')}
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
                {t('auth.reset.successHint')}
              </p>
              <Link to="/auth/login">
                <AuroraButton variant="primary" fullWidth iconRight={<ArrowRight size={16} strokeWidth={2} />}>
                  {t('auth.reset.goToLogin')}
                </AuroraButton>
              </Link>
            </div>
          ) : !token ? (
            /* Нет токена в ссылке */
            <div className="text-center py-4">
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
                {t('auth.reset.invalidLink')}
              </p>
              <Link to="/auth/forgot-password">
                <AuroraButton variant="secondary" fullWidth icon={<ArrowLeft size={16} strokeWidth={1.5} />}>
                  {t('auth.forgot.title')}
                </AuroraButton>
              </Link>
            </div>
          ) : (
            <>
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
                  label={t('auth.reset.newPassword')}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.register.passwordHintShort')}
                  icon={<Lock size={16} strokeWidth={1.5} />}
                  iconRight={passwordToggle}
                  autoComplete="new-password"
                  inputId="reset-password"
                  autoFocus
                />
                <AuroraInput
                  label={t('auth.reset.confirmPassword')}
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t('auth.common.passwordRepeatPlaceholder')}
                  icon={<Lock size={16} strokeWidth={1.5} />}
                  autoComplete="new-password"
                  inputId="reset-password-confirm"
                />

                <AuroraButton
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={loading}
                  iconRight={!loading ? <ArrowRight size={18} strokeWidth={2} /> : undefined}
                  id="reset-submit"
                >
                  {loading ? t('auth.reset.loading') : t('auth.reset.submit')}
                </AuroraButton>
              </form>
            </>
          )}
        </div>

        {!done && (
          <p className="text-center mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Link
              to="/auth/login"
              className="font-600 flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity underline underline-offset-4"
              style={{ color: 'var(--text-primary)' }}
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
              {t('auth.reset.backToLogin')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
