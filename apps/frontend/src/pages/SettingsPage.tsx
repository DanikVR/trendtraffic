/**
 * SettingsPage — страница настроек профиля (Abyss Aurora, mobile-first).
 *
 * v0.10.18: упрощено по запросу — поле «Имя» заменено на inline-edit карандашиком
 * рядом с именем в шапке профиля. Блоки «Уведомления» и «Безопасность» убраны.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mail, Moon, Sun, LogOut, Zap, Pencil, Check, X,
  HeartHandshake, Copy, FileText, MessageCircle,
  Lock, KeyRound, Eye, EyeOff,
} from 'lucide-react';
import { ChevronForward } from '../components/Chevron';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { AuroraInput } from '../components/AuroraInput';
import { AvatarCircle } from '../components/AvatarCircle';
import { StatusPill } from '../components/StatusPill';
import { useAppStore } from '../store/useAppStore';
import { useNavigate } from 'react-router-dom';

interface PartnerMe {
  enabled: boolean;
  code?: string;
  link?: string;
  clicks?: number;
  registrations?: number;
  paidUsers?: number;
  paidMinutes?: number;
  reason?: string;
}

interface PartnerProgram {
  termsText: string;
  whatsappContact: string;
}

export function SettingsPage() {
  const { t } = useTranslation('common');
  const { user, logout, subscriptionTier, subscriptionTierName, token } = useAppStore();
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  );
  const [email, setEmail] = useState(user?.email || '');
  const [saved, setSaved] = useState(false);

  // Inline-редактирование имени в шапке профиля
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name || '');

  // ── Смена пароля (inline-форма под профилем) ──
  const [pwOpen, setPwOpen]         = useState(false);
  const [pwCurrent, setPwCurrent]   = useState('');
  const [pwNew, setPwNew]           = useState('');
  const [pwConfirm, setPwConfirm]   = useState('');
  const [pwShow, setPwShow]         = useState(false);
  const [pwLoading, setPwLoading]   = useState(false);
  const [pwSaved, setPwSaved]       = useState(false);
  const [pwError, setPwError]       = useState('');

  // Сопоставление машинных кодов ошибок бэка с локализованными строками.
  const pwMessageForCode = (code?: string): string => {
    switch (code) {
      case 'WRONG_CURRENT': return t('settings.changePwd.errWrongCurrent');
      case 'NO_PASSWORD':   return t('settings.changePwd.errNoPassword');
      case 'SUPERADMIN':    return t('settings.changePwd.errSuperAdmin');
      case 'TOO_SHORT':     return t('settings.changePwd.errTooShort');
      case 'SAME_AS_OLD':   return t('settings.changePwd.errSameAsOld');
      case 'FIELDS_REQUIRED': return t('settings.changePwd.errFieldsRequired');
      default:              return t('settings.changePwd.errGeneric');
    }
  };

  const resetPwForm = () => {
    setPwCurrent(''); setPwNew(''); setPwConfirm('');
    setPwError(''); setPwShow(false);
  };

  const closePwForm = () => { setPwOpen(false); resetPwForm(); };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwCurrent || !pwNew || !pwConfirm) { setPwError(t('settings.changePwd.errFieldsRequired')); return; }
    if (pwNew.length < 8)        { setPwError(t('settings.changePwd.errTooShort')); return; }
    if (pwNew !== pwConfirm)     { setPwError(t('settings.changePwd.errMismatch')); return; }
    if (pwNew === pwCurrent)     { setPwError(t('settings.changePwd.errSameAsOld')); return; }

    setPwError('');
    setPwLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPwError(pwMessageForCode(data?.code)); return; }
      // Успех: закрываем форму, показываем тост.
      setPwOpen(false);
      resetPwForm();
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    } catch {
      setPwError(t('settings.changePwd.errGeneric'));
    } finally {
      setPwLoading(false);
    }
  };

  // ── Партнёрская программа ──
  const [partner, setPartner] = useState<PartnerMe | null>(null);
  const [program, setProgram] = useState<PartnerProgram | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
    Promise.allSettled([
      fetch('/api/partners/me', { headers }).then(r => r.json()),
      fetch('/api/partners/program').then(r => r.json()),
    ]).then(([meRes, progRes]) => {
      if (cancelled) return;
      if (meRes.status === 'fulfilled' && meRes.value && !meRes.value.error) setPartner(meRes.value);
      if (progRes.status === 'fulfilled' && progRes.value && !progRes.value.error) setProgram(progRes.value);
    });
    return () => { cancelled = true; };
  }, [token]);

  const copyLink = async () => {
    if (!partner?.link) return;
    try {
      await navigator.clipboard.writeText(partner.link);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    } catch { /* noop */ }
  };

  const openWhatsApp = () => {
    const phone = (program?.whatsappContact || '').replace(/[^\d+]/g, '');
    if (!phone) return;
    const cleanPhone = phone.startsWith('+') ? phone.slice(1) : phone;
    window.open(`https://wa.me/${cleanPhone}`, '_blank', 'noopener,noreferrer');
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.remove('dark');
      setDarkMode(false);
    } else {
      html.classList.add('dark');
      setDarkMode(true);
    }
  };

  const commitNameEdit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && user) {
      useAppStore.getState().updateUser({ name: trimmed });
    } else {
      // Если пустое — откатываем
      setNameDraft(user?.name || '');
    }
    setEditingName(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      useAppStore.getState().updateUser({ email });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const menuItems = [
    { id: 'settings-billing', icon: <Zap size={18} strokeWidth={1.5} />, label: t('settingsMore.billing'), accent: '#F59E0B',
      onClick: () => navigate('/billing') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Заголовок */}
      <div>
        <h1 className="section-title text-2xl mb-1">{t('settings.title')}</h1>
        <p className="section-subtitle">{t('settings.subtitle')}</p>
      </div>

      {/* Профиль */}
      <AuroraCard className="p-5">
        <div className="flex items-center gap-4 mb-5">
          <AvatarCircle name={user?.name || user?.email} size="lg" status="online" />
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value.slice(0, 64))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitNameEdit();
                    if (e.key === 'Escape') { setNameDraft(user?.name || ''); setEditingName(false); }
                  }}
                  onBlur={commitNameEdit}
                  className="flex-1 min-w-0 text-base font-700 bg-transparent outline-none border-b"
                  style={{
                    fontFamily: 'Geist Sans, sans-serif',
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                    borderColor: 'var(--border-medium)',
                  }}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={commitNameEdit}
                  className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-[var(--bg-tertiary)]"
                  style={{ color: '#10b981' }}
                  title={t('common.save')}
                >
                  <Check size={14} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setNameDraft(user?.name || ''); setEditingName(false); }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-[var(--bg-tertiary)]"
                  style={{ color: 'var(--text-muted)' }}
                  title={t('common.cancel')}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-base font-700 truncate"
                  style={{ fontFamily: 'Geist Sans, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {user?.name || t('moreSheet.userFallback')}
                </p>
                <button
                  type="button"
                  onClick={() => { setNameDraft(user?.name || ''); setEditingName(true); }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)] flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                  title={t('settings.editName')}
                  aria-label={t('settings.editName')}
                >
                  <Pencil size={12} strokeWidth={1.5} />
                </button>
              </div>
            )}
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            <div className="mt-1.5">
              <StatusPill
                status={subscriptionTier === 'trial' ? 'trial' : 'online'}
                label={(subscriptionTierName || '').toLowerCase() === 'premium' ? 'Премиум' : subscriptionTier === 'enterprise' ? t('tier.enterprise') : subscriptionTier === 'trial' ? t('tier.trial') : t('tier.standard')}
              />
            </div>
          </div>
        </div>

        <div className="aurora-divider mb-4" />

        {/* Успех */}
        {saved && (
          <div className="mb-4 p-3 rounded-2xl text-sm flex items-center gap-2 animate-slide-up"
            style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)', color: '#34D399' }}>
            {t('settings.saved')}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <AuroraInput
            label={t('settingsMore.email')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={16} strokeWidth={1.5} />}
            placeholder="email@example.com"
            inputId="settings-email"
          />
          <div className="flex flex-wrap gap-2">
            <AuroraButton type="submit" size="sm" id="settings-save">
              {t('settings.saveProfile')}
            </AuroraButton>
            <AuroraButton
              type="button"
              variant="secondary"
              size="sm"
              icon={<KeyRound size={16} strokeWidth={1.5} />}
              onClick={() => {
                if (pwOpen) { closePwForm(); }
                else { setPwSaved(false); setPwError(''); setPwOpen(true); }
              }}
              id="settings-change-password"
            >
              {t('settings.changePassword')}
            </AuroraButton>
          </div>
        </form>

        {/* Тост успеха смены пароля */}
        {pwSaved && (
          <div className="mt-4 p-3 rounded-2xl text-sm flex items-center gap-2 animate-slide-up"
            style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)', color: '#34D399' }}>
            {t('settings.changePwd.success')}
          </div>
        )}

        {/* Inline-форма смены пароля */}
        {pwOpen && (
          <div className="mt-4 pt-4 border-t animate-slide-up" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                <Lock size={16} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                {t('settings.changePwd.title')}
              </p>
            </div>

            {pwError && (
              <div className="flex items-center gap-2.5 p-3 rounded-2xl mb-3 text-sm"
                style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', color: 'var(--accent-magenta)' }}>
                <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-700"
                  style={{ background: 'rgba(239,68,68,0.20)' }}>!</span>
                {pwError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <AuroraInput
                label={t('settings.changePwd.current')}
                type={pwShow ? 'text' : 'password'}
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                icon={<Lock size={16} strokeWidth={1.5} />}
                iconRight={
                  <button type="button" onClick={() => setPwShow(!pwShow)} tabIndex={-1}
                    className="touch-target flex items-center justify-center hover:opacity-80 transition-opacity"
                    title={pwShow ? t('auth.common.hidePassword') : t('auth.common.showPassword')}
                    aria-label={pwShow ? t('auth.common.hidePassword') : t('auth.common.showPassword')}>
                    {pwShow ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                  </button>
                }
                autoComplete="current-password"
                inputId="settings-pw-current"
              />
              <AuroraInput
                label={t('settings.changePwd.new')}
                type={pwShow ? 'text' : 'password'}
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                icon={<Lock size={16} strokeWidth={1.5} />}
                autoComplete="new-password"
                inputId="settings-pw-new"
              />
              <AuroraInput
                label={t('settings.changePwd.confirm')}
                type={pwShow ? 'text' : 'password'}
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                icon={<Lock size={16} strokeWidth={1.5} />}
                autoComplete="new-password"
                inputId="settings-pw-confirm"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <AuroraButton type="submit" size="sm" loading={pwLoading} id="settings-pw-submit">
                  {pwLoading ? t('settings.changePwd.submitting') : t('settings.changePwd.submit')}
                </AuroraButton>
                <AuroraButton type="button" variant="secondary" size="sm" onClick={closePwForm} id="settings-pw-cancel">
                  {t('settings.changePwd.cancel')}
                </AuroraButton>
              </div>
            </form>
          </div>
        )}
      </AuroraCard>

      {/* Тема */}
      <AuroraCard className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: darkMode ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)',
                       color: darkMode ? '#60A5FA' : '#FBBF24' }}>
              {darkMode ? <Moon size={18} strokeWidth={1.5} /> : <Sun size={18} strokeWidth={1.5} />}
            </div>
            <div>
              <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                {darkMode ? t('settings.themeDark') : t('settings.themeLight')}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {darkMode ? t('settings.themeDarkSub') : t('settings.themeLightSub')}
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            id="settings-theme-toggle"
            type="button"
            onClick={toggleTheme}
            className="relative w-12 h-7 rounded-full transition-all duration-300 flex-shrink-0"
            style={{ background: darkMode ? 'rgba(59,130,246,0.70)' : 'rgba(107,114,128,0.30)' }}
            aria-pressed={darkMode}
            aria-label={darkMode ? t('sidebar.themeLight') : t('sidebar.themeDark')}
          >
            <span
              className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300"
              style={{ transform: darkMode ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>
      </AuroraCard>

      {/* ── Партнёрская программа ── */}
      {partner?.enabled && (
        <AuroraCard className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
              <HeartHandshake size={18} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                {t('partner.title')}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('partner.subtitle')}
              </p>
            </div>
          </div>

          {/* Реферальная ссылка */}
          <div className="mb-4">
            <label className="text-xs font-600 uppercase tracking-wider block mb-1.5"
                   style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {t('partner.yourLink')}
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={partner.link || ''}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm font-mono transition-colors"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={copyLink}
                title={t('partner.copy')}
                className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                style={{
                  background: copyToast ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                  border: `1px solid ${copyToast ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-medium)'}`,
                  color: copyToast ? '#10b981' : 'var(--text-secondary)',
                }}
              >
                {copyToast ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={1.5} />}
              </button>
            </div>
            {copyToast && (
              <p className="mt-1.5 text-xs" style={{ color: '#10b981' }}>{t('partner.copied')}</p>
            )}
          </div>

          {/* 3 индикатора: переходы / регистрации / оплаты */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <PartnerStatTile
              label={t('partner.stats.clicks')}
              value={partner.clicks ?? 0}
              color="#3b82f6"
            />
            <PartnerStatTile
              label={t('partner.stats.registrations')}
              value={partner.registrations ?? 0}
              color="#8b5cf6"
            />
            <PartnerStatTile
              label={t('partner.stats.paid')}
              value={partner.paidUsers ?? 0}
              sublabel={
                (partner.paidUsers ?? 0) > 0
                  ? t('partner.stats.paidUnit', {
                      users: partner.paidUsers,
                      minutes: partner.paidMinutes ?? 0,
                    })
                  : undefined
              }
              color="#10b981"
            />
          </div>

          {/* Кнопки: условия + связаться */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 transition-all"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
              }}
            >
              <FileText size={16} strokeWidth={1.5} />
              <span>{t('partner.terms')}</span>
            </button>
            {program?.whatsappContact && (
              <button
                type="button"
                onClick={openWhatsApp}
                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(37, 211, 102, 0.12)',
                  border: '1px solid rgba(37, 211, 102, 0.30)',
                  color: '#25D366',
                }}
              >
                <MessageCircle size={16} strokeWidth={1.5} />
                <span>{t('partner.contact')}</span>
              </button>
            )}
          </div>
        </AuroraCard>
      )}

      {/* Модал условий партнёрской программы */}
      {termsOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto animate-fade-in"
             style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
             onClick={() => setTermsOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg mx-4 my-4 sm:my-8"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            <AuroraCard className="p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                  <FileText size={18} color="#F59E0B" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-700 truncate" style={{ color: 'var(--text-primary)' }}>
                    {t('partner.termsModalTitle')}
                  </h3>
                </div>
                <button type="button" onClick={() => setTermsOpen(false)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]">
                  <X size={16} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
              <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                {program?.termsText?.trim()
                  ? program.termsText
                  : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('partner.termsEmpty')}</span>}
              </div>
              {program?.whatsappContact && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    type="button"
                    onClick={openWhatsApp}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 transition-all hover:scale-[1.02]"
                    style={{
                      background: 'rgba(37, 211, 102, 0.12)',
                      border: '1px solid rgba(37, 211, 102, 0.30)',
                      color: '#25D366',
                    }}
                  >
                    <MessageCircle size={16} strokeWidth={1.5} />
                    <span>{t('partner.contact')} · {program.whatsappContact}</span>
                  </button>
                </div>
              )}
            </AuroraCard>
          </div>
        </div>
      )}

      {/* Прочие настройки */}
      <AuroraCard className="overflow-hidden">
        {menuItems.map((item, idx) => (
          <React.Fragment key={item.id}>
            <button
              id={item.id}
              type="button"
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors aurora-card-interactive"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${item.accent}14`, color: item.accent }}>
                {item.icon}
              </div>
              <span className="flex-1 text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                {item.label}
              </span>
              <ChevronForward size={16} strokeWidth={1.5} style={{ color: 'var(--text-disabled)' }} />
            </button>
            {idx < menuItems.length - 1 && <div className="aurora-divider mx-5" />}
          </React.Fragment>
        ))}
      </AuroraCard>

      {/* Выход */}
      <AuroraButton
        variant="danger"
        fullWidth
        icon={<LogOut size={18} strokeWidth={1.5} />}
        onClick={() => { logout(); navigate('/auth/login'); }}
        id="settings-logout"
      >
        {t('settingsMore.logout')}
      </AuroraButton>
    </div>
  );
}

// Плитка-индикатор для блока партнёрской программы
function PartnerStatTile({
  label, value, sublabel, color,
}: {
  label: string;
  value: number;
  sublabel?: string;
  color: string;
}) {
  return (
    <div className="px-3 py-3 rounded-xl text-center"
         style={{
           background: `${color}10`,
           border: `1px solid ${color}26`,
         }}>
      <div className="text-xl font-700 tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5 font-600" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
        {label}
      </div>
      {sublabel && (
        <div className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
