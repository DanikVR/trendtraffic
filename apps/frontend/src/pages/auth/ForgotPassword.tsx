/**
 * ForgotPassword — страница сброса пароля (Abyss Aurora, mobile-first).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { AuroraButton } from '../../components/AuroraButton';
import { AuroraInput }  from '../../components/AuroraInput';
import { VibeVoxLogo }  from '../../components/VibeVoxLogo';

export function ForgotPassword() {
  const { t } = useTranslation('common');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError(t('auth.forgot.emailRequired')); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error(t('auth.forgot.sendFailed'));
      setSent(true);
    } catch (err: any) {
      setError(err?.message || t('auth.forgot.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

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
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                letterSpacing: '-0.03em',
              }}
            >
              {t('auth.forgot.title')}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('auth.forgot.subtitle')}
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
          {/* Успешно отправлено */}
          {sent ? (
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
                {t('auth.forgot.successTitle')}
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
                {t('auth.forgot.successHint', { email })}
              </p>
              <Link to="/auth/login">
                <AuroraButton variant="secondary" fullWidth icon={<ArrowLeft size={16} strokeWidth={1.5} />}>
                  {t('auth.forgot.backToLogin')}
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
                  label={t('auth.common.emailLabel')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.common.emailPlaceholder')}
                  icon={<Mail size={16} strokeWidth={1.5} />}
                  autoComplete="email"
                  inputId="forgot-email"
                  autoFocus
                />

                <AuroraButton
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={loading}
                  iconRight={!loading ? <ArrowRight size={18} strokeWidth={2} /> : undefined}
                  id="forgot-submit"
                >
                  {loading ? t('auth.forgot.loading') : t('auth.forgot.submit')}
                </AuroraButton>
              </form>
            </>
          )}
        </div>

        {!sent && (
          <p className="text-center mt-5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Link
              to="/auth/login"
              className="font-600 flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity underline underline-offset-4"
              style={{ color: 'var(--text-primary)' }}
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
              {t('auth.forgot.backToLogin')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
