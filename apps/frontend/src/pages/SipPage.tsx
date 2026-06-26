/**
 * SipPage — SIP-телефония (Abyss Aurora).
 *
 * Что делает (Итерация А):
 *  - Загружает существующий транк через GET /api/sip/trunk при монтировании.
 *  - Сохраняет / обновляет через POST /api/sip/trunk.
 *  - Удаляет через DELETE /api/sip/trunk.
 *  - x-tenant-id берётся из user.tenantId (JWT через useAppStore).
 *
 * NB: SIP действует на уровне арендатора (tenant). Суперадмин (tenantId='global_admin')
 * сам по себе SIP-транк настроить не может — для теста нужен обычный tenant-юзер.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Server, Shield, Plus, Wifi, Trash2, Save, AlertTriangle, Loader2, Check, X, Copy, PhoneIncoming, PhoneCall, Eye, EyeOff, Power, RefreshCw, Globe } from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { AuroraInput } from '../components/AuroraInput';
import { StatusPill } from '../components/StatusPill';
import { LanguagePicker, SUPPORTED_LANGUAGES } from '../components/LanguagePicker';
import { useAppStore } from '../store/useAppStore';

// ── Типы ──────────────────────────────────────────
type Transport = 'udp' | 'tcp' | 'tls';

interface TrunkDetails {
  id: string;
  tenantId: string;
  sipServer: string;
  username: string;
  callerId: string | null;
  transport: Transport;
  password: string; // приходит маскированной как "********"
  createdAt: string;
  updatedAt: string;
}

interface Toast {
  type: 'success' | 'error';
  text: string;
}

interface InboundDetails {
  id: string;
  tenantId: string;
  sipHost: string;
  roomName: string;
  authUsername: string;
  authPassword: string;
  liveKitInboundTrunkId: string;
  liveKitDispatchRuleId: string;
  bridgeActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── UUID v4 regex (бэк требует UUID в x-tenant-id) ──
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function SipPage() {
  const { user, token } = useAppStore();
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  // ── Поля формы ──
  const [sipServer,   setSipServer]   = useState('');
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [callerId,    setCallerId]    = useState('');
  const [transport,   setTransport]   = useState<Transport>('udp');

  // ── Состояние ──
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [existingTrunk, setExistingTrunk] = useState<TrunkDetails | null>(null);
  const [toast,       setToast]       = useState<Toast | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // ── Inbound state ──
  const [inbound, setInbound] = useState<InboundDetails | null>(null);
  const [inboundLoading, setInboundLoading] = useState(true);
  const [inboundBusy, setInboundBusy] = useState(false);
  const [showInboundPassword, setShowInboundPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [confirmDeleteInbound, setConfirmDeleteInbound] = useState(false);

  // ── Исходящий звонок ──
  const [callPhone, setCallPhone] = useState('');
  const [callLanguage, setCallLanguage] = useState('en');
  const [calling, setCalling] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  // ── Проверка: tenant ли это (не суперадмин) ──
  const tenantId   = user?.tenantId || '';
  const isTenant   = !!tenantId && UUID_REGEX.test(tenantId);

  // ── Toast helpers ──
  const showToast = (type: Toast['type'], text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // ── API вызовы с x-tenant-id ──
  const apiHeaders = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  });

  // ── Загрузка inbound-конфига ──
  useEffect(() => {
    if (!isTenant) { setInboundLoading(false); return; }
    (async () => {
      try {
        const res = await fetch('/api/sip/inbound', { headers: apiHeaders() });
        if (res.status === 404) {
          setInbound(null);
        } else if (res.ok) {
          setInbound(await res.json());
        }
      } catch (err) {
        console.warn('[SipPage] Не удалось загрузить inbound:', err);
      } finally {
        setInboundLoading(false);
      }
    })();
  }, [isTenant, tenantId]);

  const handleCreateOrRotateInbound = async () => {
    setInboundBusy(true);
    try {
      const res = await fetch('/api/sip/inbound', { method: 'POST', headers: apiHeaders() });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* ignore */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setInbound(data.inbound);
      setShowInboundPassword(true); // показываем сразу после создания
      showToast('success', data.message || t('sip.incoming.createdToast'));
    } catch (err: any) {
      console.error('[SipPage] Ошибка inbound create:', err);
      showToast('error', err.message || t('sip.incoming.createFailed'));
    } finally {
      setInboundBusy(false);
    }
  };

  const handleDeleteInbound = async () => {
    setConfirmDeleteInbound(false);
    setInboundBusy(true);
    try {
      const res = await fetch('/api/sip/inbound', { method: 'DELETE', headers: apiHeaders() });
      if (!res.ok) {
        const text = await res.text();
        let data: any = {};
        if (text.trim()) { try { data = JSON.parse(text); } catch { /* ignore */ } }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setInbound(null);
      setShowInboundPassword(false);
      showToast('success', t('sip.incoming.deletedToast'));
    } catch (err: any) {
      console.error('[SipPage] Ошибка inbound delete:', err);
      showToast('error', err.message || t('sip.incoming.deleteFailed'));
    } finally {
      setInboundBusy(false);
    }
  };

  const toggleInboundBridge = async () => {
    if (!inbound) return;
    setInboundBusy(true);
    try {
      const endpoint = inbound.bridgeActive ? '/api/sip/inbound/deactivate' : '/api/sip/inbound/activate';
      const res = await fetch(endpoint, { method: 'POST', headers: apiHeaders() });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* ignore */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setInbound({ ...inbound, bridgeActive: !inbound.bridgeActive });
      showToast('success', data.message || (inbound.bridgeActive ? t('sip.incoming.stopped') : t('sip.incoming.activated')));
    } catch (err: any) {
      console.error('[SipPage] Ошибка toggle bridge:', err);
      showToast('error', err.message || t('sip.incoming.toggleFailed'));
    } finally {
      setInboundBusy(false);
    }
  };

  // ── Исходящий звонок ──
  const handleMakeCall = async () => {
    if (!existingTrunk) {
      showToast('error', t('sip.outbound.configureFirst'));
      return;
    }
    const normalized = callPhone.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{7,18}$/.test(normalized)) {
      showToast('error', t('sip.outbound.invalidNumber'));
      return;
    }
    setCalling(true);
    try {
      const res = await fetch('/api/sip/call', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          phoneNumber: normalized,
          calleeLanguage: callLanguage,
          callerName: user?.name || user?.email || 'VibeVox',
        }),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* ignore */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      showToast('success', t('sip.outbound.calling', { number: normalized }));
      // Гость в этой комнате — мой родной язык как ответ языка перевода
      sessionStorage.setItem('vibevox_target_lang', user?.name && callLanguage === 'ru' ? 'en' : 'ru');
      // Переходим в комнату звонка
      navigate(`/room/${data.roomId}`);
    } catch (err: any) {
      console.error('[SipPage] Ошибка исходящего звонка:', err);
      showToast('error', err.message || t('sip.outbound.callFailed'));
    } finally {
      setCalling(false);
    }
  };

  const copyText = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      showToast('error', t('sip.incoming.copyFailed'));
    }
  };

  // ── Загрузка существующего транка ──
  useEffect(() => {
    if (!isTenant) { setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch('/api/sip/trunk', { headers: apiHeaders() });
        if (res.status === 404) {
          // Транк ещё не создан — показываем форму ввода
          setExistingTrunk(null);
          setShowForm(true);
        } else if (res.ok) {
          const data: TrunkDetails = await res.json();
          setExistingTrunk(data);
          // Заполняем форму на случай редактирования
          setSipServer(data.sipServer);
          setUsername(data.username);
          setCallerId(data.callerId || '');
          setTransport(data.transport);
          setPassword(''); // пароль приходит маскированным — пустое поле = «не менять»
        } else {
          const err = await res.text().catch(() => '');
          throw new Error(err || `HTTP ${res.status}`);
        }
      } catch (err: any) {
        console.error('[SipPage] Ошибка загрузки транка:', err);
        showToast('error', t('sip.toasts.loadFailed', { error: err.message || err }));
      } finally {
        setLoading(false);
      }
    })();
  }, [isTenant, tenantId]);

  // ── Сохранение транка ──
  const handleSave = async () => {
    if (!sipServer.trim()) { showToast('error', t('sip.validation.serverRequired')); return; }
    if (!username.trim())  { showToast('error', t('sip.validation.loginRequired')); return; }
    if (!password && !existingTrunk) { showToast('error', t('sip.validation.passwordRequired')); return; }

    setSaving(true);
    try {
      // Если редактируем существующий и пароль пустой — отправлять нельзя, бэк требует password.
      // Если пользователь хочет «не менять» — он просто не нажимает «Сохранить».
      const body: Record<string, unknown> = {
        sipServer: sipServer.trim(),
        username: username.trim(),
        password: password || '__keep_existing__', // плейсхолдер если пусто (бэк может потом обработать)
        transport,
      };
      if (callerId.trim()) body.callerId = callerId.trim();

      const res = await fetch('/api/sip/trunk', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) {
        try { data = JSON.parse(text); } catch { /* ignore */ }
      }

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: ${text.slice(0, 120)}`);
      }

      // Бэк возвращает { status:'success', message, trunk: {...} }
      const trunk: TrunkDetails | undefined = data.trunk;
      if (trunk) {
        setExistingTrunk(trunk);
        setSipServer(trunk.sipServer);
        setUsername(trunk.username);
        setCallerId(trunk.callerId || '');
        setTransport(trunk.transport);
        setPassword('');
      }
      setShowForm(false);
      showToast('success', data.message || t('sip.toasts.saved'));
    } catch (err: any) {
      console.error('[SipPage] Ошибка сохранения:', err);
      showToast('error', err.message || t('sip.toasts.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ── Удаление транка (после подтверждения через внутренний модал) ──
  const handleDelete = async () => {
    setConfirmDeleteOpen(false);
    setDeleting(true);
    try {
      const res = await fetch('/api/sip/trunk', {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) {
        try { data = JSON.parse(text); } catch { /* ignore */ }
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setExistingTrunk(null);
      setSipServer('');
      setUsername('');
      setPassword('');
      setCallerId('');
      setTransport('udp');
      setShowForm(true);
      showToast('success', data.message || t('sip.toasts.deleted'));
    } catch (err: any) {
      console.error('[SipPage] Ошибка удаления:', err);
      showToast('error', err.message || t('sip.toasts.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  // ────────────────────────────────────────────────
  // РЕНДЕР: суперадмин или не-tenant
  // ────────────────────────────────────────────────
  if (!isTenant) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="section-title text-2xl mb-1">{t('sip.title')}</h1>
          <p className="section-subtitle">{t('sip.subtitle')}</p>
        </div>
        <AuroraCard className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(245,158,11,0.12)', color: '#FBBF24' }}>
              <AlertTriangle size={18} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                {t('sip.tenantOnly.title')}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {t('sip.tenantOnly.hint1')}
                {' '}
                {t('sip.tenantOnly.hint2')}
              </p>
            </div>
          </div>
        </AuroraCard>
      </div>
    );
  }

  // ────────────────────────────────────────────────
  // РЕНДЕР: загрузка
  // ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  // ────────────────────────────────────────────────
  // РЕНДЕР: основной UI
  // ────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 left-1/2 z-[60] -translate-x-1/2 pointer-events-none animate-slide-up"
          style={{
            padding: '10px 18px',
            borderRadius: 16,
            background: toast.type === 'success' ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.16)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            color: toast.type === 'success' ? '#34D399' : '#FCA5A5',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success'
              ? <Check size={14} strokeWidth={2.5} />
              : <X size={14} strokeWidth={2.5} />}
            <span className="truncate">{toast.text}</span>
          </div>
        </div>
      )}

      {/* Заголовок */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="section-title text-2xl mb-1">{t('sip.title')}</h1>
          <p className="section-subtitle">{t('sip.subtitle')}</p>
        </div>
        {existingTrunk && !showForm && (
          <AuroraButton
            size="sm"
            icon={<Plus size={16} strokeWidth={1.5} />}
            onClick={() => setShowForm(true)}
            id="sip-edit-trunk"
          >
            {t('common.edit')}
          </AuroraButton>
        )}
      </div>

      {/* Статус подключения (есть транк) */}
      {existingTrunk && (
        <div
          className="rounded-3xl p-5 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(34,211,238,0.06) 100%)',
            border: '1px solid rgba(16,185,129,0.18)',
          }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'rgba(16,185,129,0.12)' }}>
            <Phone size={22} strokeWidth={1.5} style={{ color: '#34D399' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
              {t('sip.connected')}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {existingTrunk.username}@{existingTrunk.sipServer} • {existingTrunk.transport.toUpperCase()}
              {existingTrunk.callerId ? ` • Caller ID: ${existingTrunk.callerId}` : ''}
            </p>
          </div>
          <StatusPill status="online" label={t('sip.active')} pulse />
        </div>
      )}

      {/* Форма */}
      {(showForm || !existingTrunk) && (
        <AuroraCard className="p-5 space-y-4 animate-slide-up">
          <h2 className="section-title text-base">
            {existingTrunk ? t('sip.editTrunk') : t('sip.newTrunk')}
          </h2>

          <AuroraInput
            label={t('sip.serverLabel')}
            value={sipServer}
            onChange={(e) => setSipServer(e.target.value)}
            placeholder="sip.zadarma.com"
            icon={<Server size={16} strokeWidth={1.5} />}
            inputId="sip-server"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AuroraInput
              label={t('sip.loginLabel')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="123456"
              inputId="sip-username"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-600 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                {t('sip.transport')}
              </label>
              <select
                className="aurora-input py-3 text-sm"
                style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                value={transport}
                onChange={(e) => setTransport(e.target.value as Transport)}
                id="sip-transport"
              >
                <option value="udp">UDP</option>
                <option value="tcp">TCP</option>
                <option value="tls">TLS (рекомендуется)</option>
              </select>
            </div>
          </div>

          <AuroraInput
            label={existingTrunk ? t('sip.passwordChangeLabel') : t('sip.passwordLabel')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={existingTrunk ? t('sip.passwordUnchanged') : 'sip_password'}
            inputId="sip-password"
          />

          <AuroraInput
            label={t('sip.callerIdLabel')}
            value={callerId}
            onChange={(e) => setCallerId(e.target.value)}
            placeholder="+48 22 555 0100"
            icon={<Phone size={16} strokeWidth={1.5} />}
            inputId="sip-caller-id"
          />

          <div className="flex gap-3 pt-1 flex-wrap">
            <AuroraButton
              icon={<Save size={16} strokeWidth={1.5} />}
              onClick={handleSave}
              disabled={saving}
              id="sip-save"
            >
              {saving ? t('sip.savingShort') : (existingTrunk ? t('sip.savingChanges') : t('sip.createTrunk'))}
            </AuroraButton>
            {existingTrunk && (
              <AuroraButton variant="ghost" onClick={() => { setShowForm(false); /* откат полей не критичен */ }}>
                {t('common.cancel')}
              </AuroraButton>
            )}
          </div>
        </AuroraCard>
      )}

      {/* Параметры (детальная карточка) */}
      {existingTrunk && !showForm && (
        <>
          <AuroraCard className="overflow-hidden">
            <div className="px-4 py-3.5 flex items-center gap-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.12)' }}>
                <Server size={16} strokeWidth={1.5} style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{t('sip.sections.serverParams')}</span>
            </div>
            {[
              { label: t('sip.serverLabel'), value: existingTrunk.sipServer },
              { label: t('sip.loginShort'),  value: existingTrunk.username },
              { label: t('sip.transport'),   value: existingTrunk.transport.toUpperCase() },
              { label: 'Caller ID',          value: existingTrunk.callerId || '—' },
            ].map((item, idx, arr) => (
              <div key={item.label}
                   className="flex justify-between items-center px-4 py-3.5"
                   style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                <span className="text-sm font-600 font-mono" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
              </div>
            ))}
          </AuroraCard>

          <AuroraCard className="overflow-hidden">
            <div className="px-4 py-3.5 flex items-center gap-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)' }}>
                <Shield size={16} strokeWidth={1.5} style={{ color: '#3B82F6' }} />
              </div>
              <span className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{t('sip.sections.security')}</span>
            </div>
            {[
              { label: t('sip.encryption'),   value: 'AES-256-GCM' },
              { label: t('sip.passwordLabel'), value: existingTrunk.password /* "********" */ },
              { label: t('sip.trunkId'),       value: existingTrunk.id.slice(0, 8) + '…' },
              { label: t('sip.updated'),       value: new Date(existingTrunk.updatedAt).toLocaleString('ru-RU') },
            ].map((item, idx, arr) => (
              <div key={item.label}
                   className="flex justify-between items-center px-4 py-3.5"
                   style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                <span className="text-sm font-600 font-mono" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
              </div>
            ))}
          </AuroraCard>

          {/* Опасная зона */}
          <AuroraCard className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(239,68,68,0.10)', color: '#FCA5A5' }}>
                  <Trash2 size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{t('sip.danger.deleteTrunk')}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {t('sip.danger.deleteTrunkHint')}
                  </p>
                </div>
              </div>
              <AuroraButton
                variant="ghost"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleting}
                id="sip-delete"
              >
                {deleting ? t('sip.deletingShort') : t('common.delete')}
              </AuroraButton>
            </div>
          </AuroraCard>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ВХОДЯЩИЕ SIP-ЗВОНКИ (Итерация Б)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="pt-2">
        <h2 className="section-title text-lg mb-1">{t('sip.incoming.heading')}</h2>
        <p className="section-subtitle mb-4">
          {t('sip.incoming.lead')}
        </p>

        {inboundLoading ? (
          <AuroraCard className="p-6 flex justify-center">
            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </AuroraCard>
        ) : !inbound ? (
          /* === Пустое состояние: предложение создать === */
          <AuroraCard className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(59,130,246,0.10)', color: '#60A5FA' }}>
                <PhoneIncoming size={22} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                  {t('sip.incoming.emptyTitle')}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('sip.incoming.emptyHint')}
                </p>
              </div>
            </div>
            <AuroraButton
              onClick={handleCreateOrRotateInbound}
              disabled={inboundBusy}
              icon={<Plus size={16} strokeWidth={1.5} />}
              id="sip-inbound-create"
            >
              {inboundBusy ? t('sip.incoming.creating') : t('sip.incoming.create')}
            </AuroraButton>
          </AuroraCard>
        ) : (
          /* === Активный inbound: показываем данные === */
          <div className="space-y-3">
            {/* Статус */}
            <div
              className="rounded-3xl p-5 flex items-center gap-4"
              style={{
                background: inbound.bridgeActive
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(34,211,238,0.06) 100%)'
                  : 'linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0.04) 100%)',
                border: inbound.bridgeActive
                  ? '1px solid rgba(16,185,129,0.30)'
                  : '1px solid rgba(245,158,11,0.25)',
              }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                   style={{ background: inbound.bridgeActive ? 'rgba(16,185,129,0.14)' : 'rgba(245,158,11,0.14)' }}>
                <PhoneIncoming size={22} strokeWidth={1.5} style={{ color: inbound.bridgeActive ? '#34D399' : '#FBBF24' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                  {inbound.bridgeActive ? t('sip.incoming.active') : t('sip.incoming.paused')}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {inbound.bridgeActive
                    ? t('sip.incoming.activeHint')
                    : t('sip.incoming.pausedHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleInboundBridge}
                disabled={inboundBusy}
                className="px-4 py-2 rounded-xl text-xs font-700 flex items-center gap-1.5 transition-all flex-shrink-0"
                style={{
                  background: inbound.bridgeActive
                    ? 'rgba(239,68,68,0.16)'
                    : 'linear-gradient(135deg, #10B981, #059669)',
                  color: inbound.bridgeActive ? '#FCA5A5' : '#FFFFFF',
                  cursor: inboundBusy ? 'not-allowed' : 'pointer',
                  opacity: inboundBusy ? 0.6 : 1,
                  border: inbound.bridgeActive ? '1px solid rgba(239,68,68,0.30)' : 'none',
                }}
                id="sip-inbound-toggle"
              >
                <Power size={12} strokeWidth={2.5} />
                {inboundBusy ? '…' : inbound.bridgeActive ? t('sip.incoming.stop') : t('sip.incoming.activate')}
              </button>
            </div>

            {/* Данные для копирования в провайдер */}
            <AuroraCard className="overflow-hidden">
              <div className="px-4 py-3.5 flex items-center gap-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)' }}>
                  <Server size={16} strokeWidth={1.5} style={{ color: '#60A5FA' }} />
                </div>
                <span className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                  {t('sip.sections.providerData')}
                </span>
              </div>

              {[
                { label: t('sip.serverLabel'),  value: inbound.sipHost,      field: 'host' },
                { label: t('sip.loginShort'),   value: inbound.authUsername, field: 'user' },
                {
                  label: t('sip.passwordLabel'),
                  value: showInboundPassword ? inbound.authPassword : '••••••••••••••••••',
                  field: 'pass',
                  isPassword: true,
                  realValue: inbound.authPassword,
                },
                { label: t('sip.incoming.translationRoom'), value: inbound.roomName, field: 'room', mono: true },
              ].map((item, idx, arr) => (
                <div
                  key={item.field}
                  className="flex justify-between items-center gap-3 px-4 py-3"
                  style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                >
                  <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-sm font-600 font-mono truncate"
                      style={{ color: 'var(--text-primary)', maxWidth: '320px' }}
                      title={('realValue' in item ? item.realValue : item.value) as string}
                    >
                      {item.value}
                    </span>
                    {item.isPassword && (
                      <button
                        type="button"
                        onClick={() => setShowInboundPassword(!showInboundPassword)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}
                        title={showInboundPassword ? t('sip.incoming.hide') : t('sip.incoming.show')}
                      >
                        {showInboundPassword
                          ? <EyeOff size={13} strokeWidth={1.5} />
                          : <Eye size={13} strokeWidth={1.5} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => copyText(('realValue' in item ? item.realValue : item.value) as string, item.field)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        background: copiedField === item.field ? 'rgba(16,185,129,0.18)' : 'rgba(59,130,246,0.10)',
                        color: copiedField === item.field ? '#34D399' : '#60A5FA',
                      }}
                      title={t('sip.incoming.copy')}
                    >
                      {copiedField === item.field
                        ? <Check size={13} strokeWidth={2.5} />
                        : <Copy size={13} strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
              ))}
            </AuroraCard>

            {/* Инструкция */}
            <AuroraCard className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: 'rgba(96,165,250,0.10)', color: '#60A5FA' }}>
                  <Wifi size={18} strokeWidth={1.5} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                    {t('sip.howTo.heading')}
                  </p>
                  <ol className="text-xs space-y-1 list-decimal ml-4" style={{ color: 'var(--text-muted)' }}>
                    <li>{t('sip.howTo.step1')}</li>
                    <li>{t('sip.howTo.step2')}</li>
                    <li>{t('sip.howTo.step3')}</li>
                    <li>{t('sip.howTo.step4')}</li>
                  </ol>
                </div>
              </div>
            </AuroraCard>

            {/* Опасная зона: пересоздать / удалить */}
            <AuroraCard className="p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(245,158,11,0.10)', color: '#FBBF24' }}>
                    <RefreshCw size={16} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                      {t('sip.incoming.reissue')}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {t('sip.danger.reissueHint')}
                    </p>
                  </div>
                </div>
                <AuroraButton variant="ghost" onClick={handleCreateOrRotateInbound} disabled={inboundBusy}>
                  {inboundBusy ? '…' : t('sip.incoming.reissue')}
                </AuroraButton>
              </div>
            </AuroraCard>

            <AuroraCard className="p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(239,68,68,0.10)', color: '#FCA5A5' }}>
                    <Trash2 size={16} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                      {t('sip.danger.deleteInbound')}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {t('sip.danger.deleteInboundHint')}
                    </p>
                  </div>
                </div>
                <AuroraButton variant="ghost" onClick={() => setConfirmDeleteInbound(true)} disabled={inboundBusy}>
                  {inboundBusy ? '…' : t('common.delete')}
                </AuroraButton>
              </div>
            </AuroraCard>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ИСХОДЯЩИЙ ЗВОНОК (Итерация В) — Web → телефон с переводом
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="pt-2">
        <h2 className="section-title text-lg mb-1">{t('sip.outbound.heading')}</h2>
        <p className="section-subtitle mb-4">
          {t('sip.outbound.lead')}
        </p>

        {!existingTrunk ? (
          <AuroraCard className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(245,158,11,0.10)', color: '#FBBF24' }}>
                <AlertTriangle size={18} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                  {t('sip.outbound.noTrunkTitle')}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {t('sip.outbound.noTrunkHint')}
                </p>
              </div>
            </div>
          </AuroraCard>
        ) : (
          <AuroraCard className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <AuroraInput
                  label={t('sip.outbound.phoneLabel')}
                  value={callPhone}
                  onChange={(e) => setCallPhone(e.target.value)}
                  placeholder="+48225550100"
                  icon={<PhoneCall size={16} strokeWidth={1.5} />}
                  inputId="sip-call-phone"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  {t('sip.outbound.languageLabel')}
                </label>
                <button
                  type="button"
                  onClick={() => setLangPickerOpen(true)}
                  className="aurora-input py-3 text-sm text-left flex items-center gap-2"
                  style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                  id="sip-call-lang"
                >
                  <span className="text-base leading-none">
                    {SUPPORTED_LANGUAGES.find(l => l.code === callLanguage)?.flag || '🌐'}
                  </span>
                  <span className="flex-1 truncate">
                    {SUPPORTED_LANGUAGES.find(l => l.code === callLanguage)?.name || callLanguage}
                  </span>
                  <Globe size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <button
                type="button"
                onClick={handleMakeCall}
                disabled={calling || !callPhone.trim()}
                className="px-5 py-3 rounded-2xl text-sm font-700 flex items-center justify-center gap-2 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  color: '#FFFFFF',
                  cursor: (calling || !callPhone.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (calling || !callPhone.trim()) ? 0.55 : 1,
                  boxShadow: '0 8px 24px rgba(16,185,129,0.30)',
                  fontFamily: 'Inter, sans-serif',
                  flex: '0 0 auto',
                }}
                id="sip-call-go"
              >
                {calling
                  ? (<><Loader2 size={14} className="animate-spin" /> {t('sip.outbound2.callingButton')}</>)
                  : (<><PhoneCall size={14} strokeWidth={2} /> {t('sip.outbound2.callButton')}</>)}
              </button>
              <p className="text-xs leading-snug flex-1" style={{ color: 'var(--text-muted)' }}>
                {t('sip.outbound2.rateInfo')}{' '}
                <strong style={{ color: 'var(--text-secondary)' }}>
                  {existingTrunk.username}@{existingTrunk.sipServer}
                </strong>
              </p>
            </div>
          </AuroraCard>
        )}
      </div>

      {/* LanguagePicker для выбора языка получателя */}
      <LanguagePicker
        isOpen={langPickerOpen}
        onClose={() => setLangPickerOpen(false)}
        value={callLanguage}
        onChange={(code) => setCallLanguage(code)}
        title={t('sip.outbound.languageLabel')}
      />

      {/* Модал подтверждения удаления inbound */}
      {confirmDeleteInbound && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteInbound(false); }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 animate-slide-up"
            style={{
              background: 'linear-gradient(180deg, rgba(20,12,12,0.95) 0%, rgba(15,8,8,0.98) 100%)',
              border: '1px solid rgba(239,68,68,0.30)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.70), 0 0 0 1px rgba(239,68,68,0.15)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(239,68,68,0.14)', color: '#FCA5A5' }}>
                <Trash2 size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-700"
                  style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {t('sip.confirm.deleteInboundTitle')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
              {t('sip.confirm.deleteInboundBody')}
            </p>
            <div className="flex gap-3">
              <AuroraButton variant="ghost" fullWidth onClick={() => setConfirmDeleteInbound(false)}>
                {t('confirmModal.cancel')}
              </AuroraButton>
              <button
                type="button"
                onClick={handleDeleteInbound}
                disabled={inboundBusy}
                className="flex-1 px-5 py-3 rounded-2xl text-sm font-700 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                  color: '#FFFFFF',
                  cursor: inboundBusy ? 'not-allowed' : 'pointer',
                  opacity: inboundBusy ? 0.6 : 1,
                  boxShadow: '0 8px 24px rgba(239,68,68,0.35)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {inboundBusy ? t('sip.deletingShort') : t('confirmModal.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модал подтверждения удаления (внутренний, не браузерный confirm) ── */}
      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fade-in"
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteOpen(false); }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 animate-slide-up"
            style={{
              background: 'linear-gradient(180deg, rgba(20,12,12,0.95) 0%, rgba(15,8,8,0.98) 100%)',
              border: '1px solid rgba(239,68,68,0.30)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.70), 0 0 0 1px rgba(239,68,68,0.15)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(239,68,68,0.14)', color: '#FCA5A5' }}>
                <Trash2 size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-700"
                  style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {t('sip.confirm.deleteTrunkTitle')}
              </h3>
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
              {t('sip.confirm.deleteTrunkBody')}
            </p>
            <div className="flex gap-3">
              <AuroraButton
                variant="ghost"
                fullWidth
                onClick={() => setConfirmDeleteOpen(false)}
                id="sip-confirm-cancel"
              >
                {t('confirmModal.cancel')}
              </AuroraButton>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                id="sip-confirm-delete"
                className="flex-1 px-5 py-3 rounded-2xl text-sm font-700 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                  color: '#FFFFFF',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                  boxShadow: '0 8px 24px rgba(239,68,68,0.35)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {deleting ? t('sip.deletingShort') : t('confirmModal.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Подсказка для пустого состояния */}
      {!existingTrunk && !loading && (
        <AuroraCard className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(59,130,246,0.10)', color: '#60A5FA' }}>
              <Wifi size={18} strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                {t('sip.howTo.heading')}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                1. {t('sip.howTo.step1')}<br />
                2. {t('sip.howTo.step2')}<br />
                3. {t('sip.howTo.step3')}<br />
                4. <em>{t('sip.howTo.step4')}</em>
              </p>
            </div>
          </div>
        </AuroraCard>
      )}

    </div>
  );
}
