/**
 * Section4Chatwoot — Раздел 4 страницы EnterpriseSettings.
 *
 * Per-tenant Chatwoot CRM-интеграция: URL + Agent Access Token + on/off toggle.
 * Включить можно только если url+token заданы и `test connection` прошёл.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Boxes,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { ApiKeyField } from '../../components/enterprise/ApiKeyField';
import { useAppStore } from '../../store/useAppStore';

interface ChatwootInfo {
  hasConfig: boolean;
  enabled: boolean;
  urlPreview: string | null;
  hasToken: boolean;
}

export function Section4Chatwoot() {
  const { t } = useTranslation('common');
  const { token } = useAppStore();
  const [info, setInfo] = useState<ChatwootInfo | null>(null);

  const [urlInput, setUrlInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/tenant-settings/chatwoot', { headers: headers() });
        if (r.ok) setInfo(await r.json());
      } catch (e: any) {
        setError(e?.message || t('enterprise.chatwoot.errLoad'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);
    try {
      // Сохраняем без enabled — отдельная кнопка переключения
      const res = await fetch('/api/tenant-settings/chatwoot', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          url: urlInput.trim() || null,
          token: tokenInput.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setInfo(data);
      setUrlInput('');
      setTokenInput('');
      setSuccess(t('enterprise.chatwoot.successSaved'));
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e?.message || t('enterprise.chatwoot.errSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      // Если есть несохранённые url/token — тестируем их, иначе сохранённые
      const body = (urlInput.trim() && tokenInput.trim())
        ? { url: urlInput.trim(), token: tokenInput.trim() }
        : {};
      const res = await fetch('/api/tenant-settings/chatwoot/test', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult({ ok: !!data.ok, error: data.error });
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.message || String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!info) return;
    setTogglingEnabled(true);
    setError(null);
    try {
      const newVal = !info.enabled;
      const res = await fetch('/api/tenant-settings/chatwoot/enabled', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ enabled: newVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setInfo({ ...info, enabled: newVal });
    } catch (e: any) {
      setError(e?.message || t('enterprise.chatwoot.errToggle'));
    } finally {
      setTogglingEnabled(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
          <Boxes size={20} color="#fff" />
        </div>
        <div>
          <h2 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>
            {t('enterprise.chatwoot.headingShort')}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('enterprise.chatwoot.headerLead')}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <AuroraCard className="p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} color="#10b981" />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{success}</span>
          </div>
        </AuroraCard>
      )}
      {error && (
        <AuroraCard className="p-3">
          <div className="flex items-start gap-2">
            <XCircle size={16} color="#ef4444" className="mt-[2px]" />
            <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{error}</span>
          </div>
        </AuroraCard>
      )}

      {/* Status */}
      <AuroraCard className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="text-sm font-700 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('enterprise.chatwoot.statusHeading')}
          </h3>
          {info && (
            <div className="flex items-center gap-2">
              {info.hasConfig ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600"
                      style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}>
                  <CheckCircle2 size={12} /> {t('enterprise.chatwoot.statusConfigured')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600"
                      style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>
                  {t('enterprise.chatwoot.statusNotConfigured')}
                </span>
              )}
              {info.hasConfig && (
                <button onClick={handleToggleEnabled} disabled={togglingEnabled}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-600 transition-colors"
                        style={{
                          background: info.enabled ? 'rgba(16,185,129,0.10)' : 'rgba(148,163,184,0.10)',
                          color: info.enabled ? '#10b981' : 'var(--text-muted)',
                        }}>
                  {togglingEnabled ? <Loader2 size={11} className="animate-spin" /> :
                   info.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                  {info.enabled ? t('enterprise.chatwoot.statusActive') : t('enterprise.chatwoot.statusDisabled')}
                </button>
              )}
            </div>
          )}
        </div>
        {info?.urlPreview && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            URL: <code style={{ color: 'var(--text-secondary)' }}>{info.urlPreview}</code>
          </p>
        )}
      </AuroraCard>

      {/* Edit form */}
      <AuroraCard className="p-5 space-y-3">
        <h3 className="text-sm font-700 uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {t('enterprise.chatwoot.configHeading')}
        </h3>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('enterprise.chatwoot.urlFieldLabel')}
          </label>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={info?.urlPreview ? t('enterprise.chatwoot.urlSavedPrefix', { url: info.urlPreview }) : t('enterprise.chatwoot.urlPlaceholder')}
            className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-400"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontFamily: 'ui-monospace, monospace',
            }}
          />
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('enterprise.chatwoot.tokenFieldLabel')}
          </label>
          <ApiKeyField
            value={tokenInput}
            onChange={setTokenInput}
            hasSaved={info?.hasToken}
            placeholder={t('enterprise.chatwoot.tokenPlaceholder')}
            showCopyButton={false}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <AuroraButton onClick={handleSave}
                       disabled={saving || (!urlInput.trim() && !tokenInput.trim())}
                       icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}>
            {saving ? t('enterprise.chatwoot.savingLabel') : t('enterprise.chatwoot.saveLabel')}
          </AuroraButton>
          <AuroraButton variant="secondary" onClick={handleTest} disabled={testing}
                       icon={testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}>
            {testing ? t('enterprise.chatwoot.testingLabel') : t('enterprise.chatwoot.testLabel')}
          </AuroraButton>
        </div>

        {testResult && (
          <div className="p-3 rounded-xl"
               style={{
                 background: testResult.ok ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
                 border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.30)' : 'rgba(239,68,68,0.30)'}`,
               }}>
            <div className="flex items-start gap-2">
              {testResult.ok ? <CheckCircle2 size={14} color="#10b981" /> : <AlertCircle size={14} color="#ef4444" />}
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {testResult.ok
                  ? t('enterprise.chatwoot.testSuccess')
                  : t('enterprise.chatwoot.testErrorPrefix', { error: testResult.error || t('enterprise.chatwoot.testErrorUnknown') })}
              </span>
            </div>
          </div>
        )}
      </AuroraCard>

      {/* What gets sent */}
      <AuroraCard className="p-5">
        <h3 className="text-sm font-700 uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {t('enterprise.chatwoot.whatSentHeading')}
        </h3>
        <ul className="text-xs leading-relaxed space-y-1.5 pl-4 list-disc" style={{ color: 'var(--text-secondary)' }}>
          <li>{t('enterprise.chatwoot.whatSentItem1')}</li>
          <li>{t('enterprise.chatwoot.whatSentItem2')}</li>
          <li>{t('enterprise.chatwoot.whatSentItem3Prefix')} <code>{t('enterprise.chatwoot.whatSentItem3Code')}</code></li>
        </ul>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          {t('enterprise.chatwoot.whatSentFooter')}
        </p>
        <a href="https://www.chatwoot.com/docs/product/channels/api/client-apis/messages-api"
           target="_blank" rel="noreferrer"
           className="inline-flex items-center gap-1 text-xs font-600 mt-3"
           style={{ color: '#10b981', textDecoration: 'underline' }}>
          {t('enterprise.chatwoot.docsLabel')} <ExternalLink size={12} />
        </a>
      </AuroraCard>
    </div>
  );
}

export default Section4Chatwoot;
