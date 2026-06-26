/**
 * Section5Mcp — раздел «MCP» страницы EnterpriseSettings.
 *
 * Per-tenant MCP-подключение: владелец генерирует индивидуальный ключ (со скоупами),
 * вставляет URL+ключ в свой внешний агент/CRM (Claude, ChatGPT-коннекторы, n8n…).
 * Ключ хранится хэшированным в БД, показывается ОДИН раз, удаляется по кнопке.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plug, Plus, Copy, Check, Loader2, Trash2, AlertCircle, CheckCircle2, Link as LinkIcon,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';

interface McpKey {
  id: string;
  apiKeyPrefix: string;
  label: string | null;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}
interface CreatedKey extends McpKey { rawKey: string }
interface ScopeDef { scope: string; description: string }

export function Section5Mcp() {
  const { t } = useTranslation('common');
  const { token } = useAppStore();

  const [keys, setKeys] = useState<McpKey[]>([]);
  const [availableScopes, setAvailableScopes] = useState<ScopeDef[]>([]);
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => {
    (async () => {
      try {
        const [k, s, i] = await Promise.all([
          fetch('/api/mcp/keys', { headers: headers() }),
          fetch('/api/mcp/scopes', { headers: headers() }),
          fetch('/api/mcp/info', { headers: headers() }),
        ]);
        if (k.ok) setKeys((await k.json()).keys || []);
        if (s.ok) {
          const sc: ScopeDef[] = (await s.json()).scopes || [];
          setAvailableScopes(sc);
          // По умолчанию отмечаем только read-скоупы (наименьшие права).
          setSelected(new Set(sc.filter((x) => x.scope.endsWith(':read')).map((x) => x.scope)));
        }
        if (i.ok) setUrl((await i.json()).url || '');
      } catch (e: any) {
        setError(e?.message || t('enterprise.mcp.errLoad'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleScope = (scope: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope); else next.add(scope);
      return next;
    });
  };

  const handleCreate = async () => {
    setCreating(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/mcp/keys', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ label: label.trim() || undefined, scopes: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setJustCreated(data);
      setKeys((prev) => [data, ...prev]);
      setLabel('');
    } catch (e: any) {
      setError(e?.message || t('enterprise.mcp.errCreate'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard недоступен */ }
  };

  const doDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/mcp/keys/${id}/hard`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch (e: any) {
      setError(e?.message || t('enterprise.mcp.errDelete'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
          <Plug size={20} color="#fff" />
        </div>
        <div>
          <h2 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{t('enterprise.mcp.heading')}</h2>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('enterprise.mcp.lead')}</p>
        </div>
      </div>

      {success && (
        <AuroraCard className="p-3"><div className="flex items-center gap-2"><CheckCircle2 size={16} color="#10b981" /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{success}</span></div></AuroraCard>
      )}
      {error && (
        <AuroraCard className="p-3"><div className="flex items-start gap-2"><AlertCircle size={16} color="#ef4444" className="mt-[2px]" /><span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{error}</span><button onClick={() => setError(null)}>×</button></div></AuroraCard>
      )}

      {/* Connection URL */}
      <AuroraCard className="p-5 space-y-3">
        <h3 className="text-sm font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {t('enterprise.mcp.urlLabel')}
        </h3>
        <div className="flex items-center gap-2">
          <LinkIcon size={14} style={{ color: 'var(--text-muted)' }} />
          <code className="flex-1 text-xs px-3 py-2 rounded-lg break-all"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace', border: '1px solid var(--border-medium)' }}>
            {url || '— ' + t('enterprise.mcp.urlMissing')}
          </code>
          {url && (
            <button onClick={() => handleCopy(url)} className="px-2 py-2 rounded-lg text-xs"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
              <Copy size={13} />
            </button>
          )}
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('enterprise.mcp.urlHint')}</p>
      </AuroraCard>

      {/* Create key */}
      <AuroraCard className="p-5 space-y-4">
        <h3 className="text-sm font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {t('enterprise.mcp.keysHeading')}
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('enterprise.mcp.keysLead')}</p>

        <input type="text" value={label} onChange={(e) => setLabel(e.target.value.slice(0, 100))}
               placeholder={t('enterprise.mcp.labelPlaceholder')}
               className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
               style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />

        {/* Scopes */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {t('enterprise.mcp.scopesLabel')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {availableScopes.map((s) => {
              const isWrite = !s.scope.endsWith(':read');
              return (
                <label key={s.scope} className="flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs"
                       style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                  <input type="checkbox" checked={selected.has(s.scope)} onChange={() => toggleScope(s.scope)} className="mt-[2px]" />
                  <span className="flex-1">
                    <code style={{ color: isWrite ? '#f59e0b' : 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}>{s.scope}</code>
                    <span className="block" style={{ color: 'var(--text-muted)' }}>{s.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <AuroraButton onClick={handleCreate} disabled={creating || selected.size === 0}
                     icon={creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
          {creating ? t('enterprise.mcp.creating') : t('enterprise.mcp.createKey')}
        </AuroraButton>

        {/* Just created — показываем ОДИН раз */}
        {justCreated && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.30)' }}>
            <p className="text-sm font-700 mb-2" style={{ color: '#f59e0b' }}>{t('enterprise.mcp.createdWarning')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs px-3 py-2 rounded-lg break-all"
                    style={{ background: 'rgba(0,0,0,0.20)', color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}>
                {justCreated.rawKey}
              </code>
              <button onClick={() => handleCopy(justCreated.rawKey)}
                      className="px-3 py-2 rounded-lg text-sm font-600"
                      style={{ background: copied ? 'rgba(16,185,129,0.20)' : 'rgba(245,158,11,0.20)', color: copied ? '#10b981' : '#f59e0b' }}>
                {copied ? <><Check size={14} className="inline mr-1" />{t('enterprise.mcp.copiedKey')}</> : <><Copy size={14} className="inline mr-1" />{t('enterprise.mcp.copyKey')}</>}
              </button>
            </div>
            <button onClick={() => setJustCreated(null)} className="text-xs mt-2" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
              {t('enterprise.mcp.savedKeyConfirm')}
            </button>
          </div>
        )}

        {/* Keys list */}
        {keys.length === 0 ? (
          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{t('enterprise.mcp.noKeys')}</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="px-3 py-2 rounded-xl space-y-1"
                   style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                <div className="flex items-center gap-3">
                  <code className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace' }}>{k.apiKeyPrefix}</code>
                  <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {k.label || <em style={{ color: 'var(--text-muted)' }}>{t('enterprise.mcp.noLabel')}</em>}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {k.lastUsedAt ? t('enterprise.mcp.usedOn', { date: new Date(k.lastUsedAt).toLocaleDateString() }) : t('enterprise.mcp.neverUsed')}
                  </span>
                  <button onClick={() => setConfirm({ id: k.id })} disabled={deletingId === k.id}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(239,68,68,0.16)]"
                          style={{ color: '#ef4444' }} title={t('enterprise.mcp.deleteTitle')}>
                    {deletingId === k.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
                {k.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {k.scopes.map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </AuroraCard>

      {/* How to connect */}
      <AuroraCard className="p-5 space-y-2">
        <h3 className="text-sm font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {t('enterprise.mcp.howToHeading')}
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('enterprise.mcp.howToBody')}</p>
      </AuroraCard>

      <ConfirmModal
        open={!!confirm}
        title={t('enterprise.mcp.confirmDeleteTitle')}
        message={t('enterprise.mcp.confirmDeleteBody')}
        confirmLabel={t('enterprise.mcp.deleteTitle')}
        variant="danger"
        onConfirm={() => { const id = confirm?.id; setConfirm(null); if (id) doDelete(id); }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export default Section5Mcp;
