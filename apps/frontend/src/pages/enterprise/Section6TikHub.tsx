/**
 * Section6TikHub — раздел Enterprise-настроек: собственный ключ TikHub.io.
 *
 * Enterprise-тенант вводит СВОЙ ключ TikHub (скан трендов + скачивание видео).
 * Ключ хранится зашифрованным (AES-256-GCM) и используется вместо платформенного.
 * Кнопка «Проверить» реально дёргает TikHub (get_user_info) и показывает статус + баланс.
 *
 * UI/паттерн скопирован с Section1Gemini (карточка ключа: Save / Проверить / Удалить).
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Save, Loader2, CheckCircle2, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ApiKeyField } from '../../components/enterprise/ApiKeyField';
import { useAppStore } from '../../store/useAppStore';

type TikHubKeyStatus = 'active' | 'invalid' | 'quota_exceeded' | null;

interface TikHubInfo {
  hasKey: boolean;
  status: TikHubKeyStatus;
  lastCheckAt: string | null;
  prefix: string | null;
  validation?: { ok: boolean; status: TikHubKeyStatus; message?: string; error?: string };
}

export function Section6TikHub() {
  const { t } = useTranslation('common');
  const { token, user } = useAppStore();
  const isSuperadmin = user?.role === 'superadmin';

  const [info, setInfo] = useState<TikHubInfo | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/tenant-settings/tikhub', { headers: headers() });
        if (res.ok) setInfo(await res.json());
      } catch (e: any) {
        setError(e?.message || t('enterprise.common.loadError', 'Не удалось загрузить'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!keyInput.trim()) { setError(t('enterprise.tikhub.errEnterKey', 'Введите ключ TikHub')); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/tenant-settings/tikhub', {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setInfo(data);
      setKeyInput('');
      setSuccess(data.validation?.message || t('enterprise.tikhub.saved', 'Ключ сохранён'));
      setTimeout(() => setSuccess(null), 6000);
    } catch (e: any) { setError(e?.message || t('enterprise.common.genericError', 'Ошибка')); }
    finally { setSaving(false); }
  };

  const handleValidate = async () => {
    setValidating(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/tenant-settings/tikhub/validate', { method: 'POST', headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setInfo(data);
      setSuccess(data.validation?.message || t('enterprise.tikhub.checked', 'Проверка выполнена'));
      setTimeout(() => setSuccess(null), 6000);
    } catch (e: any) { setError(e?.message || t('enterprise.common.genericError', 'Ошибка')); }
    finally { setValidating(false); }
  };

  const handleDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true); setError(null);
    try {
      const res = await fetch('/api/tenant-settings/tikhub', { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInfo({ hasKey: false, status: null, lastCheckAt: null, prefix: null });
      setKeyInput('');
      setSuccess(t('enterprise.tikhub.deleted', 'Ключ удалён'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e?.message || t('enterprise.common.genericError', 'Ошибка')); }
    finally { setDeleting(false); }
  };

  const renderStatus = () => {
    if (!info?.hasKey) {
      return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600"
                   style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>{t('enterprise.tikhub.statusNotSet', 'Ключ не задан')}</span>;
    }
    if (info.status === 'active') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600" style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}><CheckCircle2 size={12} /> {t('enterprise.tikhub.statusActive', 'Активен')}</span>;
    if (info.status === 'invalid') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}><XCircle size={12} /> {t('enterprise.tikhub.statusInvalid', 'Невалиден')}</span>;
    if (info.status === 'quota_exceeded') return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600" style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}><AlertTriangle size={12} /> {t('enterprise.tikhub.statusQuota', 'Нет баланса')}</span>;
    return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600" style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>{t('enterprise.tikhub.statusUnknown', 'Не проверен')}</span>;
  };

  if (loading) {
    return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
          <TrendingUp size={20} color="#fff" />
        </div>
        <div>
          <h2 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{t('enterprise.tikhub.heading', 'Свой ключ Trend')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('enterprise.tikhub.lead', 'Ваш собственный ключ Trend для сканирования трендов и скачивания видео.')}
          </p>
        </div>
      </div>

      {isSuperadmin && (
        <AuroraCard className="p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} color="#f59e0b" className="mt-[2px]" />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Вы суперадмин — этот раздел задаёт ключ для <b>Enterprise-тенантов</b>. Свой платформенный ключ задайте в <b>Админ-панели → «Настройки системных API»</b> (карточка TikHub). У суперадмина нет tenant-аккаунта, поэтому сохранение здесь недоступно.
            </span>
          </div>
        </AuroraCard>
      )}

      {success && (
        <AuroraCard className="p-3"><div className="flex items-center gap-2"><CheckCircle2 size={16} color="#10b981" /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{success}</span></div></AuroraCard>
      )}
      {error && (
        <AuroraCard className="p-3"><div className="flex items-start gap-2"><XCircle size={16} color="#ef4444" className="mt-[2px]" /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</span></div></AuroraCard>
      )}

      <AuroraCard className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{t('enterprise.tikhub.keyLabel', 'API-ключ Trend')}</h3>
          {renderStatus()}
        </div>
        <ApiKeyField value={keyInput} onChange={setKeyInput} hasSaved={info?.hasKey} savedPrefix={info?.prefix || null} placeholder={t('enterprise.tikhub.keyPlaceholder', 'вставьте ключ TikHub...')} showCopyButton={false} />
        {info?.lastCheckAt && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('enterprise.tikhub.lastCheck', 'Последняя проверка')}: {new Date(info.lastCheckAt).toLocaleString()}</p>
        )}
        <div className="flex gap-2 flex-wrap">
          <AuroraButton onClick={handleSave} disabled={saving || !keyInput.trim()} icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}>{saving ? t('enterprise.tikhub.saving', 'Сохранение...') : t('enterprise.tikhub.save', 'Сохранить')}</AuroraButton>
          {info?.hasKey && (
            <>
              <AuroraButton variant="secondary" onClick={handleValidate} disabled={validating} icon={validating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}>{validating ? t('enterprise.tikhub.validating', 'Проверка...') : t('enterprise.tikhub.validate', 'Проверить')}</AuroraButton>
              <AuroraButton variant="secondary" onClick={() => setConfirmOpen(true)} disabled={deleting} icon={deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}>{t('enterprise.tikhub.delete', 'Удалить')}</AuroraButton>
            </>
          )}
        </div>
      </AuroraCard>

      <ConfirmModal
        open={confirmOpen}
        title={t('enterprise.tikhub.confirmDeleteTitle', 'Удалить ключ TikHub?')}
        message={t('enterprise.tikhub.confirmDeleteBody', 'Тенант вернётся на платформенный ключ (если тариф это позволяет).')}
        confirmLabel={t('enterprise.tikhub.delete', 'Удалить')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default Section6TikHub;
