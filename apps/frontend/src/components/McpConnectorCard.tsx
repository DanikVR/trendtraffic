/**
 * McpConnectorCard — «Коннектор Claude (MCP)» в Настройках.
 *
 * У КАЖДОЙ учётки свой индивидуальный коннектор: персональный ключ vbvx_mcp_…
 * (хэш в БД, показывается ОДИН раз) + готовые сниппеты подключения с этим
 * ключом — Claude Desktop (mcp-remote) и Claude Code. Ключ создаётся со всеми
 * доступными скоупами; тонкая настройка прав — в Enterprise → MCP (Section5Mcp).
 * Без активной подписки — карточка-приглашение на /billing.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Copy, Check, Loader2, Trash2, AlertCircle, KeyRound, Zap,
} from 'lucide-react';
import { AuroraCard } from './AuroraCard';
import { AuroraButton } from './AuroraButton';
import { ConfirmModal } from './ConfirmModal';
import { ClaudeLogo } from './ClaudeLogo';
import { McpConnectSnippets } from './McpConnectSnippets';
import { useAppStore } from '../store/useAppStore';
import { useIsEnterprise } from '../hooks/useIsEnterprise';

interface McpKey {
  id: string;
  apiKeyPrefix: string;
  label: string | null;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}
interface CreatedKey extends McpKey { rawKey: string }

// Сниппеты/хелперы подключения вынесены в общий McpConnectSnippets
// (используется и здесь, и в Enterprise → MCP).

export function McpConnectorCard() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { token } = useAppStore();
  const hasAccess = useIsEnterprise();

  const [keys, setKeys] = useState<McpKey[]>([]);
  const [allScopes, setAllScopes] = useState<string[]>([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    (async () => {
      try {
        const [k, s, i] = await Promise.all([
          fetch('/api/mcp/keys', { headers: headers() }),
          fetch('/api/mcp/scopes', { headers: headers() }),
          fetch('/api/mcp/info', { headers: headers() }),
        ]);
        if (k.ok) setKeys((await k.json()).keys || []);
        if (s.ok) setAllScopes(((await s.json()).scopes || []).map((x: any) => x.scope));
        if (i.ok) setUrl((await i.json()).url || '');
      } catch {
        setError(t('settings.mcp.errLoad', 'Не удалось загрузить данные коннектора'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* clipboard недоступен */ }
  };

  const handleCreate = async () => {
    setCreating(true); setError(null);
    try {
      const res = await fetch('/api/mcp/keys', {
        method: 'POST', headers: headers(),
        // Персональный коннектор владельца — полный набор скоупов (сузить можно в Enterprise → MCP).
        body: JSON.stringify({ label: t('settings.mcp.keyLabel', 'Claude — персональный коннектор'), scopes: allScopes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setJustCreated(data);
      setKeys((prev) => [data, ...prev]);
    } catch (e: any) {
      setError(e?.message || t('settings.mcp.errCreate', 'Не удалось создать ключ'));
    } finally {
      setCreating(false);
    }
  };

  const doDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/mcp/keys/${id}/hard`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (justCreated?.id === id) setJustCreated(null);
    } catch (e: any) {
      setError(e?.message || t('settings.mcp.errDelete', 'Не удалось удалить ключ'));
    } finally {
      setDeletingId(null);
    }
  };

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      type="button"
      onClick={() => handleCopy(text, field)}
      className="flex-shrink-0 px-2.5 py-2 rounded-lg text-xs transition-colors"
      style={{
        background: copiedField === field ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)',
        border: `1px solid ${copiedField === field ? 'rgba(16,185,129,0.35)' : 'var(--border-medium)'}`,
        color: copiedField === field ? '#10b981' : 'var(--text-secondary)',
      }}
      title={t('settings.mcp.copy', 'Скопировать')}
    >
      {copiedField === field ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );

  const Header = (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: 'rgba(217, 119, 87, 0.12)' }}>
        <ClaudeLogo size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
          {t('settings.mcp.title', 'Коннектор Claude (MCP)')}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t('settings.mcp.subtitle', 'Управляйте TrendTraffic прямо из чата Claude: тренды, галерея, ЦА, публикатор. Индивидуальный ключ вашей учётки.')}
        </p>
      </div>
    </div>
  );

  // ── Без подписки: приглашение ──
  if (!hasAccess) {
    return (
      <AuroraCard className="p-5">
        {Header}
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('settings.mcp.noAccess', 'Коннектор доступен на тарифе Premium. Оформите подписку — и подключите Claude к своему аккаунту за минуту.')}
        </p>
        <AuroraButton onClick={() => navigate('/billing')} icon={<Zap size={16} />}>
          {t('settings.mcp.goBilling', 'Смотреть тариф')}
        </AuroraButton>
      </AuroraCard>
    );
  }

  if (loading) {
    return (
      <AuroraCard className="p-5">
        {Header}
        <div className="py-4 text-center"><Loader2 size={20} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
      </AuroraCard>
    );
  }

  const mcpUrl = url || 'https://app.trendtraffic.pro/api/mcp';

  return (
    <AuroraCard className="p-5">
      {Header}

      {error && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-xl"
             style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle size={14} color="#ef4444" className="mt-[2px] flex-shrink-0" />
          <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>{error}</span>
          <button type="button" onClick={() => setError(null)} style={{ color: 'var(--text-muted)' }}>×</button>
        </div>
      )}

      {/* Персональный ключ */}
      <div className="mb-4">
        <label className="text-xs font-600 uppercase tracking-wider block mb-1.5"
               style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {t('settings.mcp.keysTitle', 'Персональный ключ')}
        </label>

        {keys.length === 0 && !justCreated && (
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            {t('settings.mcp.noKeys', 'Ключа ещё нет. Создайте — он подставится в сниппеты ниже и покажется один раз.')}
          </p>
        )}

        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-2 mb-1.5 px-3 py-2 rounded-xl"
               style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
            <KeyRound size={13} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <code className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace' }}>
              {k.apiKeyPrefix}
            </code>
            <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
              {k.label || ''}
            </span>
            <button type="button" onClick={() => setConfirm({ id: k.id })} disabled={deletingId === k.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(239,68,68,0.16)]"
                    style={{ color: '#ef4444' }} title={t('settings.mcp.deleteTitle', 'Удалить ключ')}>
              {deletingId === k.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        ))}

        <AuroraButton onClick={handleCreate} disabled={creating || allScopes.length === 0}
                      icon={creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
          {creating
            ? t('settings.mcp.creating', 'Создаю…')
            : t('settings.mcp.create', 'Создать персональный ключ')}
        </AuroraButton>

        {justCreated && (
          <div className="rounded-xl p-3 mt-3" style={{ background: 'rgba(217,119,87,0.08)', border: '1px solid rgba(217,119,87,0.30)' }}>
            <p className="text-xs font-700 mb-2" style={{ color: '#D97757' }}>
              {t('settings.mcp.createdOnce', 'Ключ показан ОДИН раз — сохраните его. Он уже вставлен в сниппеты ниже.')}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs px-3 py-2 rounded-lg break-all"
                    style={{ background: 'rgba(0,0,0,0.20)', color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}>
                {justCreated.rawKey}
              </code>
              <CopyBtn text={justCreated.rawKey} field="rawkey" />
            </div>
          </div>
        )}
      </div>

      {/* Способы подключения (1 — приложение Claude, 2 — Desktop-файл, 3 — Code) */}
      <McpConnectSnippets url={mcpUrl} rawKey={justCreated?.rawKey || null} />

      <ConfirmModal
        open={!!confirm}
        title={t('settings.mcp.confirmDelete', 'Удалить ключ?')}
        message={t('settings.mcp.confirmDeleteBody', 'Подключённый через этот ключ Claude перестанет видеть аккаунт. Действие необратимо.')}
        confirmLabel={t('settings.mcp.deleteTitle', 'Удалить ключ')}
        variant="danger"
        onConfirm={() => { const id = confirm?.id; setConfirm(null); if (id) doDelete(id); }}
        onCancel={() => setConfirm(null)}
      />
    </AuroraCard>
  );
}

export default McpConnectorCard;
