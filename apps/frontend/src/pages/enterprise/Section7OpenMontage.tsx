/**
 * Section7OpenMontage — Enterprise BYO-ключи генеративных провайдеров OpenMontage.
 *
 * Enterprise-тенант вводит СВОИ ключи (FAL, OpenAI, ElevenLabs, HeyGen, Runway,
 * Suno, xAI, Doubao, Google + сток Pexels/Pixabay/Unsplash + HF). Рендер от его
 * имени использует их. Каждый ключ — карточка с «Сохранить / Проверить / Удалить».
 * Бесплатная CPU-цепочка (ffmpeg/Piper) ключей НЕ требует — это только для
 * платных/облачных шагов.
 *
 * Backend: /api/tenant-settings/provider-keys (см. tenant_settings/provider_keys.ts).
 * Паттерн карточки — как Section6TikHub.
 */

import React, { useEffect, useState } from 'react';
import { Wand2, Save, Loader2, CheckCircle2, XCircle, AlertTriangle, Trash2, ExternalLink } from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ApiKeyField } from '../../components/enterprise/ApiKeyField';
import { useAppStore } from '../../store/useAppStore';

type ProviderStatus = 'active' | 'invalid' | 'quota_exceeded' | 'unknown' | null;

interface ProviderInfo {
  id: string;
  label: string;
  group: 'llm' | 'paid' | 'stock';
  help?: string;
  hasKey: boolean;
  status: ProviderStatus;
  lastCheckAt: string | null;
  prefix: string | null;
  validation?: { ok: boolean; status: ProviderStatus; message?: string };
}

function authHeaders(token: string | null): HeadersInit {
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function StatusPill({ p }: { p: ProviderInfo }) {
  const base = 'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600';
  if (!p.hasKey) return <span className={base} style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>Не задан</span>;
  if (p.status === 'active') return <span className={base} style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}><CheckCircle2 size={12} /> Активен</span>;
  if (p.status === 'invalid') return <span className={base} style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}><XCircle size={12} /> Невалиден</span>;
  if (p.status === 'quota_exceeded') return <span className={base} style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}><AlertTriangle size={12} /> Нет баланса</span>;
  if (p.status === 'unknown') return <span className={base} style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>Сохранён (без проверки)</span>;
  return <span className={base} style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>Не проверен</span>;
}

function ProviderCard({ p, token, onChanged }: { p: ProviderInfo; token: string | null; onChanged: (id: string, info: Partial<ProviderInfo>) => void }) {
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const flash = (type: 'ok' | 'err', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 6000); };

  const save = async () => {
    if (!keyInput.trim()) { flash('err', 'Введите ключ'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/tenant-settings/provider-keys/${p.id}`, {
        method: 'PUT', headers: authHeaders(token), body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onChanged(p.id, data);
      setKeyInput('');
      flash('ok', data.validation?.message || 'Ключ сохранён');
    } catch (e: any) { flash('err', e?.message || 'Ошибка'); }
    finally { setSaving(false); }
  };

  const validate = async () => {
    setValidating(true);
    try {
      const res = await fetch(`/api/tenant-settings/provider-keys/${p.id}/validate`, { method: 'POST', headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onChanged(p.id, data);
      flash(data.validation?.ok ? 'ok' : 'err', data.validation?.message || 'Проверка выполнена');
    } catch (e: any) { flash('err', e?.message || 'Ошибка'); }
    finally { setValidating(false); }
  };

  const del = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/tenant-settings/provider-keys/${p.id}`, { method: 'DELETE', headers: authHeaders(token) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChanged(p.id, { hasKey: false, status: null, prefix: null, lastCheckAt: null });
      setKeyInput('');
      flash('ok', 'Ключ удалён');
    } catch (e: any) { flash('err', e?.message || 'Ошибка'); }
    finally { setDeleting(false); }
  };

  return (
    <AuroraCard className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-700 truncate" style={{ color: 'var(--text-primary)' }}>{p.label}</div>
          {p.help && (
            <a href={p.help} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-accent, #ec4899)' }}>
              где взять ключ <ExternalLink size={10} />
            </a>
          )}
        </div>
        <StatusPill p={p} />
      </div>

      <ApiKeyField value={keyInput} onChange={setKeyInput} hasSaved={p.hasKey} savedPrefix={p.prefix} placeholder="вставьте ключ..." showCopyButton={false} />

      {p.lastCheckAt && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Проверка: {new Date(p.lastCheckAt).toLocaleString()}</p>
      )}
      {msg && (
        <p className="text-[12px]" style={{ color: msg.type === 'ok' ? '#10b981' : '#ef4444' }}>{msg.text}</p>
      )}

      <div className="flex gap-2 flex-wrap">
        <AuroraButton onClick={save} disabled={saving || !keyInput.trim()} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
          {saving ? '...' : 'Сохранить'}
        </AuroraButton>
        {p.hasKey && (
          <>
            <AuroraButton variant="secondary" onClick={validate} disabled={validating} icon={validating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}>
              {validating ? '...' : 'Проверить'}
            </AuroraButton>
            <AuroraButton variant="secondary" onClick={() => setConfirmOpen(true)} disabled={deleting} icon={deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}>
              Удалить
            </AuroraButton>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={`Удалить ключ ${p.label}?`}
        message="Рендер от имени этого тенанта перестанет использовать этот провайдер."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={del}
        onCancel={() => setConfirmOpen(false)}
      />
    </AuroraCard>
  );
}

export function Section7OpenMontage() {
  const { token, user } = useAppStore();
  const isSuperadmin = user?.role === 'superadmin';

  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/tenant-settings/provider-keys', { headers: authHeaders(token) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setProviders(data.providers || []);
      } catch (e: any) {
        setError(e?.message || 'Не удалось загрузить');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChanged = (id: string, info: Partial<ProviderInfo>) =>
    setProviders((prev) => prev?.map((p) => (p.id === id ? { ...p, ...info } : p)) || prev);

  if (loading) {
    return <div className="py-12 text-center"><Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  const llm = (providers || []).filter((p) => p.group === 'llm');
  const paid = (providers || []).filter((p) => p.group === 'paid');
  const stock = (providers || []).filter((p) => p.group === 'stock');

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>
          <Wand2 size={20} color="#fff" />
        </div>
        <div>
          <h2 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>Ключи генерации (OpenMontage)</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Ваши ключи платных/облачных шагов рендера (ИИ-видео, картинки, озвучка, аватары). Бесплатная CPU-цепочка ключей не требует.
          </p>
        </div>
      </div>

      {isSuperadmin && (
        <AuroraCard className="p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} color="#f59e0b" className="mt-[2px]" />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Вы суперадмин — эти ключи задаёт <b>Enterprise-тенант</b> у себя. У суперадмина нет tenant-аккаунта, поэтому сохранение здесь недоступно.
            </span>
          </div>
        </AuroraCard>
      )}
      {error && (
        <AuroraCard className="p-3"><div className="flex items-start gap-2"><XCircle size={16} color="#ef4444" className="mt-[2px]" /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</span></div></AuroraCard>
      )}

      {llm.length > 0 && (
        <div>
          <h3 className="text-xs font-700 uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>ИИ-режиссёр (ЛЛМ)</h3>
          <p className="text-[12px] mb-2" style={{ color: 'var(--text-muted)' }}>
            «Мозг» умных шагов сценария — ресёрч, выбор лучшего момента, генерация сценария и новостей. Модель по умолчанию — Claude Opus 4.8 (выбор модели — при настройке ✨ЛЛМ-узлов). Базовый монтаж (обрезка/формат/субтитры/экспорт) этого ключа НЕ требует.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {llm.map((p) => <ProviderCard key={p.id} p={p} token={token} onChanged={onChanged} />)}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-700 uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>Платные провайдеры</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {paid.map((p) => <ProviderCard key={p.id} p={p} token={token} onChanged={onChanged} />)}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-700 uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>Бесплатные сток-источники</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stock.map((p) => <ProviderCard key={p.id} p={p} token={token} onChanged={onChanged} />)}
        </div>
      </div>
    </div>
  );
}

export default Section7OpenMontage;
