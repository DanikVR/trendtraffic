/**
 * RoomLobbyPage — лобби комнаты перевода (Abyss Aurora, mobile-first).
 *
 * v0.10.x: локализация переведена на react-i18next. Прежний словарь UI_TRANSLATIONS удалён —
 * все строки берутся из public/locales/<lng>/common.json по ключам lobby.*.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, ArrowRight, Copy, Check, Globe, Shield, Share2, X, Users, Gauge } from 'lucide-react';
import { VibeVoxLogo } from '../components/VibeVoxLogo';
import { AuroraButton } from '../components/AuroraButton';
import { AuroraInput } from '../components/AuroraInput';
import { LanguagePicker, SUPPORTED_LANGUAGES } from '../components/LanguagePicker';
import { useAppStore } from '../store/useAppStore';

// ══════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════

interface RoomLobbyPageProps {
  roomName: string;
  onJoin: (name: string, language: string) => void;
  isCreator?: boolean;
  onClose?: () => void;
  lobbyError?: string | null;
}

export function RoomLobbyPage({ roomName, onJoin, isCreator, onClose, lobbyError }: RoomLobbyPageProps) {
  const { t, i18n } = useTranslation('common');
  const { user } = useAppStore();

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const savedName = sessionStorage.getItem('vibevox_guest_name');
  if (savedName && UUID_RE.test(savedName)) sessionStorage.removeItem('vibevox_guest_name');
  const cleanSaved = savedName && !UUID_RE.test(savedName) ? savedName : null;
  const googleName = user?.name && !UUID_RE.test(user.name) ? user.name : '';

  // Дефолт языка перевода = язык UI. Логика: если у пользователя интерфейс на
  // X — значит он хочет видеть субтитры на X. Если ранее уже выбирал другой —
  // sessionStorage перезапишет. Это лучше чем заходить «сразу на русском по
  // умолчанию» (как было до 1.0.4).
  const uiLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const uiLangSupported = SUPPORTED_LANGUAGES.some((l) => l.code === uiLang) ? uiLang : 'en';
  const [name, setName]               = useState(cleanSaved ?? googleName);
  const [selectedLang, setSelectedLang] = useState(sessionStorage.getItem('vibevox_target_lang') || uiLangSupported);
  const [error, setError]             = useState('');
  const [copied, setCopied]           = useState(false);
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  // Сохраняем дефолт в sessionStorage при первом входе. Когда юзер переключает
  // язык интерфейса позднее — этот дефолт уже сохранён и не перезатирается;
  // если хочет другой язык субтитров, выберет в LanguagePicker (там тоже идёт
  // sessionStorage.setItem на код).
  useEffect(() => {
    const savedLang = sessionStorage.getItem('vibevox_target_lang');
    if (!savedLang) {
      setSelectedLang(uiLangSupported);
      sessionStorage.setItem('vibevox_target_lang', uiLangSupported);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Фоллбэк
      const ta = document.createElement('textarea');
      ta.value = window.location.href;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setToastVisible(true);
    setTimeout(() => setCopied(false), 2500);
    setTimeout(() => setToastVisible(false), 2800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('lobby.nameError'));
      return;
    }
    setError('');
    sessionStorage.setItem('vibevox_guest_name', name.trim());
    sessionStorage.setItem('vibevox_target_lang', selectedLang);
    onJoin(name.trim(), selectedLang);
  };

  const selectedLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang);

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ── Фоновые ambient blobs ── */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />
      <div
        className="absolute bottom-1/4 left-1/4 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)', filter: 'blur(50px)' }}
      />
      <div
        className="absolute top-3/4 right-1/4 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)', filter: 'blur(50px)' }}
      />

      {/* ── Toast: Ссылка скопирована ── */}
      <div
        className="fixed top-6 left-1/2 z-[60] pointer-events-none transition-all duration-300"
        style={{
          transform: `translateX(-50%) translateY(${toastVisible ? '0' : '-20px'})`,
          opacity: toastVisible ? 1 : 0,
        }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3 rounded-2xl"
          style={{
            background: 'rgba(16,185,129,0.14)',
            border: '1px solid rgba(16,185,129,0.25)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            color: '#34D399',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Check size={14} strokeWidth={2.5} />
          {t('lobby.copied')}
        </div>
      </div>

      {/* ── Главная карточка ── */}
      <div
        className="relative z-10 w-full max-w-sm animate-slide-up"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '28px',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          padding: '32px 24px 24px',
        }}
      >
        {/* Кнопка «Закрыть» — только для создателя комнаты */}
        {isCreator && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110 active:scale-95"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}

        {/* Логотип + Заголовок */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <VibeVoxLogo height={42} />
          <div className="text-center">
            <h1
              className="text-xl font-700 leading-tight"
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
              }}
            >
              {t('lobby.title')}
            </h1>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('lobby.subtitle')}
            </p>
          </div>
        </div>

        {/* Состояние «комната заполнена» */}
        {lobbyError === 'room_full' && (
          <div
            className="rounded-2xl p-5 text-center mb-2"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.22)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(245,158,11,0.14)', color: '#FBBF24' }}
            >
              <Users size={22} strokeWidth={1.5} />
            </div>
            <p
              className="text-base font-700 mb-1.5"
              style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              {t('lobby.roomFullTitle')}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {t('lobby.roomFullMsg')}
            </p>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full py-2.5 rounded-2xl text-sm font-600 transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  color: '#60A5FA',
                }}
              >
                {t('call.backToRooms')}
              </button>
            )}
          </div>
        )}

        {/* Состояние «сервис перевода перегружен» (admission control) */}
        {lobbyError === 'service_overloaded' && (
          <div
            className="rounded-2xl p-5 text-center mb-2"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.22)',
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(239,68,68,0.14)', color: '#F87171' }}
            >
              <Gauge size={22} strokeWidth={1.5} />
            </div>
            <p
              className="text-base font-700 mb-1.5"
              style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              {t('lobby.overloadedTitle')}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {t('lobby.overloadedMsg')}
            </p>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full py-2.5 rounded-2xl text-sm font-600 transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  color: '#60A5FA',
                }}
              >
                {t('call.backToRooms')}
              </button>
            )}
          </div>
        )}

        {/* Форма — скрыта когда комната заполнена или сервис перегружен */}
        <form onSubmit={handleSubmit} className="space-y-5" style={{ display: (lobbyError === 'room_full' || lobbyError === 'service_overloaded') ? 'none' : undefined }}>
          {/* Имя */}
          <AuroraInput
            label={t('lobby.nameLabel')}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder={t('lobby.namePlaceholder')}
            icon={<User size={16} strokeWidth={1.5} />}
            error={error}
            inputId="lobby-name"
            autoFocus
          />

          {/* Выбор языка перевода */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-600 uppercase"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            >
              {t('lobby.languageLabel')}
            </label>
            <button
              type="button"
              id="lobby-lang-picker"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1.5px solid var(--border-subtle)',
              }}
            >
              <span className="text-2xl leading-none">{selectedLangObj?.flag ?? '🌐'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                  {selectedLangObj?.name ?? selectedLang.toUpperCase()}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {selectedLangObj?.nameEn}
                </p>
              </div>
              <Globe size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
            {/* Подсказка под полем */}
            <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
              {t('lobby.languageHint')}
            </p>
          </div>

          {/* CTA кнопка */}
          <AuroraButton
            type="submit"
            fullWidth
            size="lg"
            iconRight={<ArrowRight size={18} strokeWidth={2} />}
            className="mt-2"
            id="lobby-join"
          >
            {t('lobby.connect')}
          </AuroraButton>
        </form>

        {/* ── Блок «Поделитесь ссылкой» — только для создателя комнаты ── */}
        {isCreator && <div className="mt-6">
          <div className="flex items-center gap-2 mb-1.5">
            <Share2 size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {t('lobby.shareSection')}
            </p>
          </div>
          <p className="text-[11px] leading-snug mb-2.5" style={{ color: 'var(--text-muted)' }}>
            {t('lobby.shareHint')}
          </p>

          {/* Visible URL в read-only input */}
          <div
            className="rounded-xl mb-2.5 overflow-hidden"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}
          >
            <input
              type="text"
              readOnly
              value={window.location.href}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full px-3 py-2.5 bg-transparent text-xs outline-none select-all"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                fontFeatureSettings: '"calt" 0',
              }}
              aria-label={t('roomActions.copyLink')}
              title={window.location.href}
            />
          </div>

          {/* Крупная заметная кнопка копирования */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-700 transition-all active:scale-[0.98]"
            style={{
              background: copied ? 'rgba(16,185,129,0.16)' : 'rgba(59,130,246,0.12)',
              border: copied ? '1px solid rgba(16,185,129,0.45)' : '1px solid rgba(59,130,246,0.30)',
              color: copied ? '#10b981' : '#60A5FA',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {copied
              ? <><Check size={16} strokeWidth={2.5} /><span>{t('lobby.copied')}</span></>
              : <><Copy size={16} strokeWidth={1.5} /><span>{t('lobby.copyLink')}</span></>
            }
          </button>

          {/* Подсказка после копирования */}
          {copied && (
            <p className="text-[11px] mt-2.5 leading-snug px-1" style={{ color: '#34D399' }}>
              {t('lobby.shareSuccessHint')}
            </p>
          )}
        </div>}

        {/* ── Футер: Условия и Политика ── */}
        <div className="mt-6 px-2">
          <p className="text-center text-[10px] leading-relaxed" style={{ color: 'var(--text-disabled)' }}>
            <Shield size={10} strokeWidth={1.5} className="inline mr-0.5" style={{ verticalAlign: '-1px' }} />
            {' '}{t('lobby.tosAgree')}{' '}
            <a
              href="/terms"
              className="underline transition-colors"
              style={{ color: 'var(--text-muted)' }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('lobby.tos')}
            </a>
            {t('lobby.andWord')}
            <a
              href="/privacy"
              className="underline transition-colors"
              style={{ color: 'var(--text-muted)' }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('lobby.privacy')}
            </a>
            {t('lobby.audioConsent')}
          </p>
        </div>
      </div>

      {/* ── Брендинг внизу ── */}
      <p className="text-center text-[10px] mt-4 z-10" style={{ color: 'var(--text-disabled)' }}>
        VibeVox © 2026 • {t('lobby.footerTagline')}
      </p>

      {/* LanguagePicker Sheet */}
      <LanguagePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={selectedLang}
        onChange={(code) => {
          setSelectedLang(code);
          sessionStorage.setItem('vibevox_target_lang', code);
        }}
        title={t('lobby.languageLabel')}
      />
    </div>
  );
}
