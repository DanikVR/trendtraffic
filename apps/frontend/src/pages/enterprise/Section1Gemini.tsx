/**
 * Section1Gemini — Раздел 1 страницы EnterpriseSettings.
 *
 * Per-tenant Google Gemini API key (AI Studio) + Telegram-бот для уведомлений.
 *
 * Telegram-модель v0.10.10:
 *  - Владелец вставляет ТОЛЬКО токен своего бота.
 *  - Backend через /getUpdates находит всех кто написал боту /start.
 *  - Уведомления рассылаются ВСЕМ найденным подписчикам.
 *  - Можно нажать «Обновить подписчиков» если новые люди подписались позже.
 *  - Глобальный VibeVox-бот для Enterprise НЕ используется (только для суперадмина).
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Send,
  MessageCircle,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ApiKeyField } from '../../components/enterprise/ApiKeyField';
import { QuestFlowKeysEditor } from '../../components/enterprise/QuestFlowKeysEditor';
import { useAppStore } from '../../store/useAppStore';

type GeminiKeyStatus = 'active' | 'invalid' | 'quota_exceeded' | null;

interface GeminiInfo {
  hasKey: boolean;
  status: GeminiKeyStatus;
  lastCheckAt: string | null;
  prefix: string | null;
  validation?: { ok: boolean; status: GeminiKeyStatus; error?: string };
}

interface BotInfo { ok: boolean; username?: string }

interface BroadcastResult { sent: number; failed: number; total: number }

export function Section1Gemini() {
  const { t } = useTranslation('common');
  const { token } = useAppStore();

  // ── Gemini ──
  const [info, setInfo] = useState<GeminiInfo | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Модель генерации изображений (Quest Flow, одна на аккаунт) ──
  const [imageModels, setImageModels] = useState<Array<{ id: string; label: string; tier: string; editing: boolean }>>([]);
  const [imageModel, setImageModel] = useState<string>('');        // выбранная в селекте (может быть несохранённой)
  const [savedImageModel, setSavedImageModel] = useState<string>(''); // что реально лежит на сервере
  const [savingImageModel, setSavingImageModel] = useState(false);
  const [imageKeyReady, setImageKeyReady] = useState(false); // есть ли рабочий Gemini-ключ; без него модель не выбираем

  // ── Telegram ──
  const [botTokenInput, setBotTokenInput] = useState('');
  const [hasSavedBotToken, setHasSavedBotToken] = useState(false);
  const [savedBotInfo, setSavedBotInfo] = useState<BotInfo | null>(null);
  const [savingBot, setSavingBot] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removingBot, setRemovingBot] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<BroadcastResult | null>(null);
  const [botError, setBotError] = useState<string | null>(null);
  const [botSuccess, setBotSuccess] = useState<string | null>(null);

  // Кастомный confirm-диалог (вместо браузерного confirm())
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message?: React.ReactNode;
    confirmLabel?: string;
    variant?: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // Модель генерации + доступность (hasKey). Зовём при загрузке и после любой смены ключа,
  // чтобы выбор модели был заблокирован ровно тогда, когда рабочего ключа нет.
  const loadImageConfig = async () => {
    try {
      const [cfgRes, modelsRes] = await Promise.all([
        fetch('/api/quest-flow/image/config', { headers: headers() }),
        fetch('/api/quest-flow/image/models', { headers: headers() }),
      ]);
      if (cfgRes.ok) { const d = await cfgRes.json(); setImageModel(d.model || ''); setSavedImageModel(d.model || ''); }
      if (modelsRes.ok) { const d = await modelsRes.json(); setImageModels(d.models || []); setImageKeyReady(d.hasKey !== false); }
    } catch { /* тихо — раздел просто покажет «нет ключа» */ }
  };

  // ── Load ──
  useEffect(() => {
    (async () => {
      try {
        const [g, t] = await Promise.all([
          fetch('/api/tenant-settings/gemini', { headers: headers() }),
          fetch('/api/tenant-settings/owner-telegram', { headers: headers() }),
        ]);
        if (g.ok) setInfo(await g.json());
        if (t.ok) {
          const data = await t.json();
          setHasSavedBotToken(!!data.hasBotToken);
          setSavedBotInfo(data.botInfo?.ok ? { ok: true, username: data.botInfo.username } : null);
        }
        await loadImageConfig();
      } catch (e: any) {
        setError(e?.message || t('enterprise.common.loadError'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Gemini handlers ──
  const handleSaveKey = async () => {
    if (!keyInput.trim()) { setError(t('enterprise.gemini.errEnterKey')); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/tenant-settings/gemini', {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setInfo(data);
      setKeyInput('');
      setSuccess(
        data.validation?.ok
          ? t('enterprise.gemini.successSavedValidated')
          : t('enterprise.gemini.successSavedWithIssue', { error: data.validation?.error || t('enterprise.gemini.validationUnknown') })
      );
      setTimeout(() => setSuccess(null), 4000);
      loadImageConfig(); // ключ появился/обновился → пересчитать доступность модели
    } catch (e: any) { setError(e?.message || t('enterprise.common.genericError')); } finally { setSaving(false); }
  };
  const handleValidate = async () => {
    setValidating(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/tenant-settings/gemini/validate', { method: 'POST', headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setInfo(data);
      setSuccess(
        data.validation?.ok
          ? t('enterprise.gemini.successValid')
          : t('enterprise.gemini.successInvalid', { error: data.validation?.error || '' })
      );
      setTimeout(() => setSuccess(null), 4000);
      loadImageConfig(); // статус ключа мог измениться (active↔invalid) → пересчитать доступность
    } catch (e: any) { setError(e?.message || t('enterprise.common.genericError')); } finally { setValidating(false); }
  };
  const handleDelete = () => {
    setConfirmDialog({
      title: t('enterprise.gemini.confirmDeleteTitle'),
      message: t('enterprise.gemini.confirmDeleteBody'),
      confirmLabel: t('enterprise.gemini.confirmDeleteCta'),
      variant: 'danger',
      onConfirm: async () => {
        setDeleting(true); setError(null);
        try {
          const res = await fetch('/api/tenant-settings/gemini', { method: 'DELETE', headers: headers() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setInfo({ hasKey: false, status: null, lastCheckAt: null, prefix: null });
          setKeyInput('');
          setSuccess(t('enterprise.gemini.successDeleted'));
          setTimeout(() => setSuccess(null), 3000);
          loadImageConfig(); // ключа больше нет → заблокировать выбор модели
        } catch (e: any) { setError(e?.message || t('enterprise.common.genericError')); } finally { setDeleting(false); }
      },
    });
  };

  // ── Image model handler (явная кнопка «Сохранить»; подтверждение выводится из состояния) ──
  const imageModelDirty = imageModel !== savedImageModel && imageModels.length > 0;
  const handleSaveImageModel = async () => {
    if (!imageModel) return;
    setSavingImageModel(true); setError(null);
    try {
      const res = await fetch('/api/quest-flow/image/model', {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ model: imageModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const savedId = data.model || imageModel;
      setImageModel(savedId);
      setSavedImageModel(savedId);
    } catch (e: any) { setError(e?.message || t('enterprise.common.genericError')); }
    finally { setSavingImageModel(false); }
  };

  // ── Telegram handlers ──
  const handleSaveBot = async () => {
    if (!botTokenInput.trim()) { setBotError(t('enterprise.gemini.telegram.errEnterToken')); return; }
    setSavingBot(true); setBotError(null); setBotSuccess(null); setLastBroadcast(null);
    try {
      const res = await fetch('/api/tenant-settings/owner-telegram', {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ botToken: botTokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setHasSavedBotToken(true);
      setSavedBotInfo(data.botInfo);
      setBotTokenInput('');
      if (data.welcomeBroadcast && data.welcomeBroadcast.sent > 0) {
        setLastBroadcast(data.welcomeBroadcast);
        setBotSuccess(
          t('enterprise.gemini.telegram.successSavedWithBroadcast', {
            username: data.botInfo?.username,
            sent: data.welcomeBroadcast.sent,
          })
        );
      } else {
        setBotSuccess(
          t('enterprise.gemini.telegram.successSavedNoBroadcast', {
            username: data.botInfo?.username,
          })
        );
      }
      setTimeout(() => setBotSuccess(null), 9000);
    } catch (e: any) { setBotError(e?.message || t('enterprise.common.genericError')); } finally { setSavingBot(false); }
  };

  const handleTest = async () => {
    setTesting(true); setBotError(null); setBotSuccess(null); setLastBroadcast(null);
    try {
      const res = await fetch('/api/tenant-settings/owner-telegram/test', {
        method: 'POST', headers: headers(),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data?.error || 'unknown');
      setLastBroadcast(data.broadcast);
      const n = data.broadcast.sent;
      setBotSuccess(
        n === 1
          ? t('enterprise.gemini.telegram.successTestSingle')
          : t('enterprise.gemini.telegram.successTestMany', { count: n })
      );
      setTimeout(() => setBotSuccess(null), 6000);
    } catch (e: any) { setBotError(e?.message || t('enterprise.common.genericError')); } finally { setTesting(false); }
  };

  const handleRemoveBot = () => {
    setConfirmDialog({
      title: t('enterprise.gemini.telegram.confirmUnlinkTitle'),
      message: t('enterprise.gemini.telegram.confirmUnlinkBody'),
      confirmLabel: t('enterprise.gemini.telegram.confirmUnlinkCta'),
      variant: 'danger',
      onConfirm: () => doRemoveBot(),
    });
  };

  const doRemoveBot = async () => {
    setRemovingBot(true); setBotError(null);
    try {
      const res = await fetch('/api/tenant-settings/owner-telegram', {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ botToken: null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHasSavedBotToken(false);
      setSavedBotInfo(null);
      setBotSuccess(t('enterprise.gemini.telegram.successUnlinked'));
      setTimeout(() => setBotSuccess(null), 3000);
    } catch (e: any) { setBotError(e?.message || t('enterprise.common.genericError')); } finally { setRemovingBot(false); }
  };

  // ── Render helpers ──
  const renderGeminiStatus = () => {
    if (!info?.hasKey) {
      return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600"
                   style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>{t('enterprise.gemini.statusNotSet')}</span>;
    }
    if (info.status === 'active') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600" style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}><CheckCircle2 size={12} /> {t('enterprise.gemini.statusActive')}</span>;
    if (info.status === 'invalid') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}><XCircle size={12} /> {t('enterprise.gemini.statusInvalid')}</span>;
    if (info.status === 'quota_exceeded') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600" style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}><AlertTriangle size={12} /> {t('enterprise.gemini.statusQuotaExceeded')}</span>;
    return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600" style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>{t('enterprise.gemini.statusNotChecked')}</span>;
  };

  if (loading) {
    return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Gemini header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
          <Sparkles size={20} color="#fff" />
        </div>
        <div>
          <h2 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{t('enterprise.gemini.heading')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('enterprise.gemini.leadPrefix')}{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
               style={{ color: '#8B5CF6', textDecoration: 'underline' }}>{t('enterprise.gemini.aiStudioLink')}</a>
            {t('enterprise.gemini.leadSuffix')}
          </p>
        </div>
      </div>

      {success && (
        <AuroraCard className="p-3"><div className="flex items-center gap-2"><CheckCircle2 size={16} color="#10b981" /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{success}</span></div></AuroraCard>
      )}
      {error && (
        <AuroraCard className="p-3"><div className="flex items-start gap-2"><XCircle size={16} color="#ef4444" className="mt-[2px]" /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</span></div></AuroraCard>
      )}

      {/* Gemini key card */}
      <AuroraCard className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{t('enterprise.gemini.keyLabel')}</h3>
          {renderGeminiStatus()}
        </div>
        <ApiKeyField value={keyInput} onChange={setKeyInput} hasSaved={info?.hasKey} savedPrefix={info?.prefix || null} placeholder={t('enterprise.gemini.keyPlaceholder')} showCopyButton={false} />
        {info?.lastCheckAt && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('enterprise.gemini.lastCheckLabel', { when: new Date(info.lastCheckAt).toLocaleString() })}</p>
        )}
        <div className="flex gap-2 flex-wrap">
          <AuroraButton onClick={handleSaveKey} disabled={saving || !keyInput.trim()} icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}>{saving ? t('enterprise.gemini.savingLabel') : t('enterprise.gemini.saveLabel')}</AuroraButton>
          {info?.hasKey && (
            <>
              <AuroraButton variant="secondary" onClick={handleValidate} disabled={validating} icon={validating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}>{validating ? t('enterprise.gemini.validatingLabel') : t('enterprise.gemini.validateLabel')}</AuroraButton>
              <AuroraButton variant="secondary" onClick={handleDelete} disabled={deleting} icon={deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}>{t('enterprise.gemini.deleteLabel')}</AuroraButton>
            </>
          )}
        </div>
      </AuroraCard>

      {/* API-ключи Quest Flow (перенесено сюда из вкладки «AI») */}
      <QuestFlowKeysEditor />

      {/* Модель генерации изображений (Quest Flow, одна на аккаунт) */}
      <AuroraCard className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} color="#ec4899" />
          <h3 className="text-sm font-700 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('enterprise.gemini.imageModel.heading')}
          </h3>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t('enterprise.gemini.imageModel.lead')}
        </p>

        {!imageKeyReady ? (
          /* Нет рабочего ключа → модель не выбираем: Enterprise без своего валидного ключа не генерирует. */
          <div className="flex items-start gap-2 p-3 rounded-xl"
               style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <AlertTriangle size={15} style={{ color: '#f59e0b', marginTop: 1, flexShrink: 0 }} />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('enterprise.gemini.imageModel.needKey')}
            </span>
          </div>
        ) : (
          <>
            <select
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              disabled={savingImageModel || imageModels.length === 0}
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
            >
              {imageModels.length === 0 && <option value="">{t('enterprise.gemini.imageModel.needKey')}</option>}
              {imageModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}{m.editing ? '' : ` — ${t('enterprise.gemini.imageModel.generateOnly')}`}
                </option>
              ))}
            </select>

            {/* Лаконичный статус: модель видна в селекте, поэтому подпись краткая. */}
            <div className="flex items-center gap-2 flex-wrap">
              <AuroraButton
                onClick={handleSaveImageModel}
                disabled={savingImageModel || !imageModelDirty}
                icon={savingImageModel ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              >
                {savingImageModel ? t('enterprise.gemini.imageModel.savingLabel') : t('enterprise.gemini.imageModel.saveLabel')}
              </AuroraButton>
              {imageModelDirty ? (
                <span className="inline-flex items-center gap-1.5 text-[13px] font-600" style={{ color: '#f59e0b' }}>
                  <AlertTriangle size={14} /> {t('enterprise.gemini.imageModel.unsaved')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[13px] font-600" style={{ color: '#10b981' }}>
                  <CheckCircle2 size={14} /> {t('enterprise.gemini.imageModel.saved')}
                </span>
              )}
            </div>

            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {t('enterprise.gemini.imageModel.hint')}
            </p>
          </>
        )}
      </AuroraCard>

      {/* Telegram-бот для уведомлений */}
      <AuroraCard className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} color="#22d3ee" />
          <h3 className="text-sm font-700 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('enterprise.gemini.telegram.heading')}
          </h3>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t('enterprise.gemini.telegram.leadCreatePart1')}{' '}
          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer"
             style={{ color: '#22d3ee', textDecoration: 'underline' }}>{t('enterprise.gemini.telegram.botFatherLabel')}</a>
          {' '}{t('enterprise.gemini.telegram.leadCreatePart2')} <b>{t('enterprise.gemini.telegram.leadAllWhoStart')} <code>{t('enterprise.gemini.telegram.leadStartCmd')}</code></b>{t('enterprise.gemini.telegram.leadAfterStart')}
        </p>

        {botSuccess && (
          <div className="p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)' }}>
            <div className="flex items-start gap-2"><CheckCircle2 size={14} color="#10b981" className="mt-[2px]" /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{botSuccess}</span></div>
          </div>
        )}
        {botError && (
          <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)' }}>
            <div className="flex items-start gap-2"><XCircle size={14} color="#ef4444" className="mt-[2px]" /><span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{botError}</span></div>
          </div>
        )}

        {/* Поле токена */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-700 uppercase tracking-wider"
                 style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('enterprise.gemini.telegram.tokenLabel')}
          </label>
          <ApiKeyField
            value={botTokenInput}
            onChange={setBotTokenInput}
            hasSaved={hasSavedBotToken}
            savedPrefix={null}
            placeholder={t('enterprise.gemini.telegram.tokenPlaceholder')}
            showCopyButton={false}
          />
        </div>

        {/* Активная карточка подключённого бота */}
        {hasSavedBotToken && savedBotInfo?.username && (
          <div className="rounded-xl p-3 flex items-center gap-3"
               style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)' }}>
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}>
              <MessageCircle size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                {t('enterprise.gemini.telegram.botConnected')}
              </div>
              <a href={`https://t.me/${savedBotInfo.username}`} target="_blank" rel="noreferrer"
                 className="text-xs inline-flex items-center gap-1 hover:underline"
                 style={{ color: '#22d3ee', fontFamily: 'ui-monospace, monospace' }}>
                @{savedBotInfo.username}
                <ExternalLink size={10} />
              </a>
            </div>
            <button onClick={handleRemoveBot} disabled={removingBot}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[rgba(239,68,68,0.16)]"
                    style={{ color: '#ef4444' }}
                    title={t('enterprise.gemini.telegram.botUnlink')}>
              {removingBot ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        )}

        {/* Кнопки действий — минимальный набор */}
        <div className="flex gap-2 flex-wrap">
          <AuroraButton onClick={handleSaveBot}
                       disabled={savingBot || !botTokenInput.trim()}
                       icon={savingBot ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}>
            {savingBot ? t('enterprise.gemini.telegram.savingLabel') : t('enterprise.gemini.telegram.saveLabel')}
          </AuroraButton>
          {hasSavedBotToken && (
            <AuroraButton variant="secondary" onClick={handleTest}
                         disabled={testing}
                         icon={testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                         title={t('enterprise.gemini.telegram.testTooltip')}>
              {testing ? t('enterprise.gemini.telegram.testingLabel') : t('enterprise.gemini.telegram.testLabel')}
            </AuroraButton>
          )}
        </div>

        {/* Краткая статистика последней рассылки (без списка подписчиков) */}
        {lastBroadcast && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('enterprise.gemini.telegram.lastBroadcast', { sent: lastBroadcast.sent, total: lastBroadcast.total })}
            {lastBroadcast.failed > 0 && t('enterprise.gemini.telegram.lastBroadcastFailed', { failed: lastBroadcast.failed })}
          </p>
        )}
      </AuroraCard>

      {/* In-app confirm-диалог (заменяет браузерный confirm()) */}
      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant || 'danger'}
        onConfirm={() => { const cb = confirmDialog?.onConfirm; setConfirmDialog(null); cb?.(); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}

export default Section1Gemini;
