/**
 * QuestFlowKeysEditor — API-ключи Quest Flow.
 * Вынесено из Section3 в раздел «API» (рядом с Gemini-ключом): каждый ключ — секрет
 * для HTTP-блока Quest Flow, по нему VibeVox опознаёт аккаунт. Самодостаточный компонент
 * (своё состояние + загрузка + confirm-диалог удаления).
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Copy, Check, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { AuroraCard } from '../AuroraCard';
import { AuroraButton } from '../AuroraButton';
import { ConfirmModal } from '../ConfirmModal';
import { useAppStore } from '../../store/useAppStore';

interface QuestFlowKey {
  id: string;
  apiKeyPrefix: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}
interface CreatedKey extends QuestFlowKey {
  rawKey: string;
}

export function QuestFlowKeysEditor() {
  const { t } = useTranslation('common');
  const { token } = useAppStore();

  const [keys, setKeys] = useState<QuestFlowKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keyLabel, setKeyLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel: string; onConfirm: () => void;
  } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => {
    (async () => {
      try {
        const k = await fetch('/api/quest-flow/keys', { headers: headers() });
        if (k.ok) { const data = await k.json(); setKeys(data.keys || []); }
      } catch (e: any) {
        setError(e?.message || t('enterprise.questFlow.errLoad'));
      } finally {
        setKeysLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateKey = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/quest-flow/keys', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ label: keyLabel.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setJustCreated(data);
      setKeys((prev) => [data, ...prev]);
      setKeyLabel('');
    } catch (e: any) {
      setError(e?.message || t('enterprise.questFlow.errCreate'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (!justCreated) return;
    try {
      await navigator.clipboard.writeText(justCreated.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard может быть недоступен */ }
  };

  const handleDeleteKey = (id: string) => {
    setConfirmDialog({
      title: t('enterprise.questFlow.confirmDeleteTitle'),
      message: t('enterprise.questFlow.confirmDeleteBody'),
      confirmLabel: t('enterprise.questFlow.confirmDeleteCta'),
      onConfirm: async () => {
        setDeletingId(id);
        try {
          const res = await fetch(`/api/quest-flow/keys/${id}/hard`, { method: 'DELETE', headers: headers() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setKeys((prev) => prev.filter((k) => k.id !== id));
        } catch (e: any) {
          setError(e?.message || t('enterprise.questFlow.errDelete'));
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  return (
    <>
      {error && (
        <AuroraCard className="p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} color="#ef4444" className="mt-[2px]" />
            <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        </AuroraCard>
      )}

      <AuroraCard className="p-5 space-y-4">
        <h3 className="text-sm font-700 uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {t('enterprise.questFlow.keysHeading')}
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t('enterprise.questFlow.keysLead')}
        </p>

        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value.slice(0, 100))}
            placeholder={t('enterprise.questFlow.keyLabelPlaceholder')}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-cyan-400"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
          />
          <AuroraButton onClick={handleCreateKey} disabled={creating}
                       icon={creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
            {creating ? t('enterprise.questFlow.creatingKey') : t('enterprise.questFlow.createKey')}
          </AuroraButton>
        </div>

        {justCreated && (
          <div className="rounded-xl p-4"
               style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.30)' }}>
            <p className="text-sm font-700 mb-2" style={{ color: '#f59e0b' }}>
              {t('enterprise.questFlow.createdWarning')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs px-3 py-2 rounded-lg break-all"
                    style={{ background: 'rgba(0,0,0,0.20)', color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}>
                {justCreated.rawKey}
              </code>
              <button onClick={handleCopyKey}
                      className="px-3 py-2 rounded-lg text-sm font-600 transition-colors"
                      style={{ background: copied ? 'rgba(16,185,129,0.20)' : 'rgba(245,158,11,0.20)', color: copied ? '#10b981' : '#f59e0b' }}>
                {copied ? <><Check size={14} className="inline mr-1" />{t('enterprise.questFlow.copiedKey')}</> :
                          <><Copy size={14} className="inline mr-1" />{t('enterprise.questFlow.copyKey')}</>}
              </button>
            </div>
            <button onClick={() => setJustCreated(null)} className="text-xs mt-2"
                    style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
              {t('enterprise.questFlow.savedKeyConfirm')}
            </button>
          </div>
        )}

        {keysLoading ? (
          <div className="py-4 text-center"><Loader2 size={18} className="animate-spin inline-block" /></div>
        ) : keys.length === 0 ? (
          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
            {t('enterprise.questFlow.noKeysHint')}
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                   style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                <code className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace' }}>
                  {k.apiKeyPrefix}
                </code>
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {k.label || <em style={{ color: 'var(--text-muted)' }}>{t('enterprise.questFlow.noLabel')}</em>}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {k.lastUsedAt
                    ? t('enterprise.questFlow.usedOn', { date: new Date(k.lastUsedAt).toLocaleDateString() })
                    : t('enterprise.questFlow.neverUsed')}
                </span>
                <button onClick={() => handleDeleteKey(k.id)} disabled={deletingId === k.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(239,68,68,0.16)]"
                        style={{ color: '#ef4444' }} title={t('enterprise.questFlow.deleteTitle')}>
                  {deletingId === k.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </AuroraCard>

      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel || t('confirmModal.confirm')}
        variant="danger"
        onConfirm={() => { const cb = confirmDialog?.onConfirm; setConfirmDialog(null); cb?.(); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </>
  );
}

export default QuestFlowKeysEditor;
