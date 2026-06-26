/**
 * OMNICHANNEL Фаза 2 — страница конструктора цепочек (/flow).
 * 2d-1: список цепочек + создание/активация/удаление.
 * 2d-2 (следующий шаг): визуальный редактор на React Flow вместо заглушки editor.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Workflow, Plus, Trash2, Loader2, Power, Pencil, Check, X } from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';
import { useAppStore } from '../store/useAppStore';
import { ChannelIcon, CHANNELS, channelMeta } from './flow/channels';

// React Flow канвас — lazy: его (и библиотеку) грузим только при открытии редактора.
const FlowCanvas = React.lazy(() => import('./flow/FlowCanvas'));

interface FlowRow {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  channel_type: string | null;
  is_default: boolean;
  updated_at?: string;
}

export default function FlowPage() {
  const { t } = useTranslation('common');
  const token = useAppStore((s) => s.token);
  const headers = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [igStatus, setIgStatus] = useState<{ connected: boolean; username?: string | null; oauthReady?: boolean } | null>(null);
  const [igMsg, setIgMsg] = useState<string | null>(null);
  const [iceOpen, setIceOpen] = useState(false);
  const [iceItems, setIceItems] = useState<string[]>([]);
  const [iceSaving, setIceSaving] = useState(false);
  const [iceMsg, setIceMsg] = useState<string | null>(null);
  const [anaOpen, setAnaOpen] = useState(false);
  const [anaDays, setAnaDays] = useState(7);
  const [analytics, setAnalytics] = useState<any>(null);
  const [anaLoading, setAnaLoading] = useState(false);
  const [ttStatus, setTtStatus] = useState<{ connected: boolean } | null>(null);
  const [ttOpen, setTtOpen] = useState(false);
  const [ttWelcome, setTtWelcome] = useState('');
  const [ttSuggested, setTtSuggested] = useState<string[]>([]);
  const [ttSaving, setTtSaving] = useState(false);
  const [ttMsg, setTtMsg] = useState<string | null>(null);
  const [ttRefUrl, setTtRefUrl] = useState('');
  const [msgStatus, setMsgStatus] = useState<{ connected: boolean } | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgGreeting, setMsgGreeting] = useState('');
  const [msgIce, setMsgIce] = useState<string[]>([]);
  const [msgMenu, setMsgMenu] = useState<string[]>([]);
  const [msgSaving, setMsgSaving] = useState(false);
  const [msgMsg, setMsgMsg] = useState<string | null>(null);
  const [msgRefUrl, setMsgRefUrl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/flows', { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setFlows(data.flows || []);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  // Статус прямого подключения Instagram (IG-0.5).
  useEffect(() => {
    (async () => {
      try { const res = await fetch('/api/instagram/status', { headers: headers() }); if (res.ok) setIgStatus(await res.json()); } catch { /* не критично */ }
    })();
  }, [headers]);

  // Результат OAuth-редиректа (?ig=connected|error).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ig = p.get('ig');
    if (ig === 'connected') setIgMsg(`Instagram подключён${p.get('u') ? `: @${p.get('u')}` : ''} ✓`);
    else if (ig === 'error') setIgMsg('Не удалось подключить Instagram. Попробуйте ещё раз.');
    if (ig) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // Загрузка Ice Breakers, когда IG подключён.
  useEffect(() => {
    if (!igStatus?.connected) return;
    (async () => {
      try {
        const res = await fetch('/api/instagram/ice-breakers', { headers: headers() });
        if (res.ok) { const d = await res.json(); setIceItems(Array.isArray(d.iceBreakers) ? d.iceBreakers.map((i: any) => i.question || '') : []); }
      } catch { /* не критично */ }
    })();
  }, [igStatus?.connected, headers]);

  const loadAnalytics = useCallback(async (days: number) => {
    setAnaLoading(true);
    try {
      const res = await fetch(`/api/flows/analytics?days=${days}`, { headers: headers() });
      if (res.ok) { const d = await res.json(); setAnalytics(d.analytics || null); }
    } catch { /* не критично */ } finally { setAnaLoading(false); }
  }, [headers]);

  useEffect(() => { if (anaOpen) loadAnalytics(anaDays); }, [anaOpen, anaDays, loadAnalytics]);

  // Статус прямого подключения TikTok.
  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/tiktok/status', { headers: headers() }); if (r.ok) setTtStatus(await r.json()); } catch { /* не критично */ }
    })();
  }, [headers]);

  // Welcome + Suggested + Ref-URL, когда TikTok подключён.
  useEffect(() => {
    if (!ttStatus?.connected) return;
    (async () => {
      try {
        const r = await fetch('/api/tiktok/auto-messages', { headers: headers() });
        if (r.ok) { const d = await r.json(); setTtWelcome(d.welcome || ''); setTtSuggested(Array.isArray(d.suggested) ? d.suggested : []); }
        const r2 = await fetch('/api/tiktok/ref-url', { headers: headers() });
        if (r2.ok) { const d2 = await r2.json(); setTtRefUrl(d2.url || ''); }
      } catch { /* не критично */ }
    })();
  }, [ttStatus?.connected, headers]);

  const saveTikTokAuto = async () => {
    setTtSaving(true); setTtMsg(null);
    try {
      const suggested = ttSuggested.map((s) => s.trim()).filter(Boolean).slice(0, 3);
      const res = await fetch('/api/tiktok/auto-messages', { method: 'POST', headers: headers(), body: JSON.stringify({ welcome: ttWelcome, suggested }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) throw new Error(d.error || `HTTP ${res.status}`);
      setTtMsg('Сохранено ✓');
      setTimeout(() => setTtMsg(null), 2500);
    } catch (e: any) {
      setTtMsg(e?.message || 'Ошибка сохранения');
    } finally {
      setTtSaving(false);
    }
  };

  // Messenger: статус + профиль (greeting/icebreakers/menu) + ref.
  useEffect(() => {
    (async () => { try { const r = await fetch('/api/messenger/status', { headers: headers() }); if (r.ok) setMsgStatus(await r.json()); } catch { /* */ } })();
  }, [headers]);
  useEffect(() => {
    if (!msgStatus?.connected) return;
    (async () => {
      try {
        const r = await fetch('/api/messenger/profile', { headers: headers() });
        if (r.ok) { const d = await r.json(); setMsgGreeting(d.greeting || ''); setMsgIce(Array.isArray(d.iceBreakers) ? d.iceBreakers.map((i: any) => i.question || '') : []); setMsgMenu(Array.isArray(d.menu) ? d.menu.map((m: any) => m.title || '') : []); }
        const r2 = await fetch('/api/messenger/ref-url', { headers: headers() });
        if (r2.ok) { const d2 = await r2.json(); setMsgRefUrl(d2.url || ''); }
      } catch { /* */ }
    })();
  }, [msgStatus?.connected, headers]);
  const saveMessengerProfile = async () => {
    setMsgSaving(true); setMsgMsg(null);
    try {
      const iceBreakers = msgIce.map((s) => s.trim()).filter(Boolean).slice(0, 4).map((q) => ({ question: q, payload: q }));
      const menu = msgMenu.map((s) => s.trim()).filter(Boolean).slice(0, 3).map((t) => ({ title: t, payload: t }));
      const res = await fetch('/api/messenger/profile', { method: 'POST', headers: headers(), body: JSON.stringify({ greeting: msgGreeting, iceBreakers, menu }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) throw new Error(d.error || `HTTP ${res.status}`);
      setMsgMsg('Сохранено ✓'); setTimeout(() => setMsgMsg(null), 2500);
    } catch (e: any) { setMsgMsg(e?.message || 'Ошибка сохранения'); } finally { setMsgSaving(false); }
  };

  const connectInstagram = () => {
    if (token) window.location.href = `/api/instagram/oauth/start?t=${encodeURIComponent(token)}`;
  };

  const saveIceBreakers = async () => {
    setIceSaving(true); setIceMsg(null);
    try {
      const items = iceItems.map((q) => q.trim()).filter(Boolean).slice(0, 4).map((q) => ({ question: q, payload: q }));
      const res = await fetch('/api/instagram/ice-breakers', { method: 'POST', headers: headers(), body: JSON.stringify({ iceBreakers: items }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) throw new Error(d.error || `HTTP ${res.status}`);
      setIceMsg('Сохранено ✓');
      setTimeout(() => setIceMsg(null), 2500);
    } catch (e: any) {
      setIceMsg(e?.message || 'Ошибка сохранения');
    } finally {
      setIceSaving(false);
    }
  };

  const createFlow = async (channelType: string) => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: newName.trim() || undefined, channelType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setNewName('');
      setPicking(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (f: FlowRow) => {
    setBusyId(f.id);
    setError(null);
    try {
      const next = f.status === 'active' ? 'draft' : 'active';
      const res = await fetch(`/api/flows/${f.id}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ status: next, ...(next === 'active' ? { isDefault: true } : {}) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/flows/${id}`, { method: 'DELETE', headers: headers() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) {
        throw new Error(d.error || `Не удалось удалить (HTTP ${res.status})`);
      }
      setPendingDelete(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    } finally {
      setBusyId(null);
    }
  };

  const renameFlow = async (id: string) => {
    const name = editName.trim();
    if (!name) { setEditingNameId(null); return; }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/flows/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ name }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setEditingNameId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Ошибка');
    } finally {
      setBusyId(null);
    }
  };

  // ── Редактор: канвас React Flow (lazy — грузим только при открытии). ──
  if (editingId) {
    return (
      <React.Suspense fallback={<div className="py-12 text-center"><Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>}>
        <FlowCanvas flowId={editingId} onBack={() => { setEditingId(null); load(); }} />
      </React.Suspense>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-700 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Workflow size={24} /> Botflow
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('flow.subtitle', 'Сценарии бота для каналов (WhatsApp, Instagram, Messenger, веб-виджет).')}
        </p>
      </div>

      {igMsg && (
        <AuroraCard className="p-3">
          <p className="text-sm" style={{ color: igMsg.includes('✓') ? '#10b981' : '#ff5ca8' }}>{igMsg}</p>
        </AuroraCard>
      )}

      {igStatus && (igStatus.oauthReady || igStatus.connected) && (
        <AuroraCard className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <ChannelIcon channel="instagram" size={22} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{t('flow.igTitle', 'Instagram — прямое подключение')}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {igStatus.connected
                  ? `${t('flow.igConnected', 'Подключён')}: @${igStatus.username || '—'}`
                  : t('flow.igHint', 'Комментарии-в-Директ, карусель, гейт подписки.')}
              </p>
            </div>
            {igStatus.oauthReady ? (
              <AuroraButton variant={igStatus.connected ? 'secondary' : 'primary'} size="sm" onClick={connectInstagram}>
                {igStatus.connected ? t('flow.igReconnect', 'Переподключить') : t('flow.igConnect', 'Подключить Instagram')}
              </AuroraButton>
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('flow.igNoOauth', 'OAuth не настроен на сервере')}</span>
            )}
          </div>

          {igStatus.connected && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-medium)' }}>
              <button
                onClick={() => setIceOpen((v) => !v)}
                className="text-xs font-600 flex items-center gap-1"
                style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {iceOpen ? '▾' : '▸'} {t('flow.iceTitle', 'Приветственные вопросы (Ice Breakers, до 4)')}
              </button>
              {iceOpen && (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {t('flow.iceHint', 'Показываются, когда клиент впервые открывает Директ. Нажатие запускает цепочку с текстом вопроса.')}
                  </p>
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      value={iceItems[i] || ''}
                      maxLength={80}
                      onChange={(e) => { const next = [...iceItems]; next[i] = e.target.value.slice(0, 80); setIceItems(next); }}
                      placeholder={`${t('flow.iceQ', 'Вопрос')} ${i + 1}`}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}
                    />
                  ))}
                  <div className="flex items-center gap-2">
                    <AuroraButton variant="primary" size="sm" loading={iceSaving} onClick={saveIceBreakers}>
                      {t('flow.save', 'Сохранить')}
                    </AuroraButton>
                    {iceMsg && <span className="text-xs" style={{ color: iceMsg.includes('✓') ? '#10b981' : '#ff5ca8' }}>{iceMsg}</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </AuroraCard>
      )}

      <AuroraCard className="p-4">
        <div className="flex gap-2 items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setPicking(true); }}
            placeholder={t('flow.namePlaceholder', 'Название новой цепочки')}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}
          />
          <AuroraButton variant="primary" icon={<Plus size={16} />} loading={creating} onClick={() => setPicking((v) => !v)}>
            {t('flow.create', 'Создать')}
          </AuroraButton>
        </div>

        {picking && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-medium)' }}>
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              {t('flow.pickChannel', 'Для какого канала цепочка?')}
            </div>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => createFlow(c.key)}
                  disabled={creating}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', cursor: creating ? 'wait' : 'pointer' }}
                  title={c.hint}
                >
                  <ChannelIcon channel={c.key} size={20} />
                  <span className="text-sm font-600">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </AuroraCard>

      {ttStatus?.connected && (
        <AuroraCard className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <ChannelIcon channel="tiktok" size={22} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{t('flow.ttTitle', 'TikTok — прямое подключение')}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('flow.ttHint', 'Приветствие, рекомендованные вопросы, Ref-URL/QR. Лимит 48ч/10.')}</p>
            </div>
            <AuroraButton variant="secondary" size="sm" onClick={() => setTtOpen((v) => !v)}>
              {ttOpen ? t('flow.collapse', 'Свернуть') : t('flow.configure', 'Настроить')}
            </AuroraButton>
          </div>
          {ttOpen && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-600" style={{ color: 'var(--text-muted)' }}>{t('flow.ttWelcome', 'Приветственное сообщение')}</label>
                <textarea rows={2} value={ttWelcome} maxLength={500} onChange={(e) => setTtWelcome(e.target.value.slice(0, 500))} placeholder={t('flow.ttWelcomePh', 'Привет! Чем помочь?')}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
              </div>
              <div>
                <label className="text-xs font-600" style={{ color: 'var(--text-muted)' }}>{t('flow.ttSuggested', 'Рекомендованные вопросы (до 3)')}</label>
                {[0, 1, 2].map((i) => (
                  <input key={i} value={ttSuggested[i] || ''} maxLength={80} onChange={(e) => { const n = [...ttSuggested]; n[i] = e.target.value.slice(0, 80); setTtSuggested(n); }} placeholder={`${t('flow.iceQ', 'Вопрос')} ${i + 1}`}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <AuroraButton variant="primary" size="sm" loading={ttSaving} onClick={saveTikTokAuto}>{t('flow.save', 'Сохранить')}</AuroraButton>
                {ttMsg && <span className="text-xs" style={{ color: ttMsg.includes('✓') ? '#10b981' : '#ff5ca8' }}>{ttMsg}</span>}
              </div>
              {ttRefUrl && (
                <div className="pt-2" style={{ borderTop: '1px solid var(--border-medium)' }}>
                  <div className="text-xs font-600 mb-1" style={{ color: 'var(--text-muted)' }}>{t('flow.ttRef', 'Ref-ссылка (в шапку профиля) + QR')}</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(ttRefUrl)}`} alt="QR" width={120} height={120} style={{ borderRadius: 8, background: '#fff', padding: 4 }} />
                    <div className="flex-1 min-w-0">
                      <input readOnly value={ttRefUrl} onFocus={(e) => e.currentTarget.select()} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }} />
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('flow.ttRefNote', 'Откроет Директ TikTok; приветствие и вопросы запустят сценарий.')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </AuroraCard>
      )}

      {msgStatus?.connected && (
        <AuroraCard className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <ChannelIcon channel="messenger" size={22} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{t('flow.msgTitle', 'Messenger — прямое подключение')}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('flow.msgHint', 'Get Started, приветствие, рекомендованные вопросы, меню, Ref-URL.')}</p>
            </div>
            <AuroraButton variant="secondary" size="sm" onClick={() => setMsgOpen((v) => !v)}>{msgOpen ? t('flow.collapse', 'Свернуть') : t('flow.configure', 'Настроить')}</AuroraButton>
          </div>
          {msgOpen && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-600" style={{ color: 'var(--text-muted)' }}>{t('flow.msgGreeting', 'Приветствие (Greeting, до первого сообщения)')}</label>
                <textarea rows={2} value={msgGreeting} maxLength={160} onChange={(e) => setMsgGreeting(e.target.value.slice(0, 160))} placeholder={t('flow.msgGreetingPh', 'Привет! Напишите нам — поможем 🙌')}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
              </div>
              <div>
                <label className="text-xs font-600" style={{ color: 'var(--text-muted)' }}>{t('flow.msgIce', 'Рекомендованные вопросы (Ice Breakers, до 4)')}</label>
                {[0, 1, 2, 3].map((i) => (
                  <input key={i} value={msgIce[i] || ''} maxLength={80} onChange={(e) => { const n = [...msgIce]; n[i] = e.target.value.slice(0, 80); setMsgIce(n); }} placeholder={`${t('flow.iceQ', 'Вопрос')} ${i + 1}`}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                ))}
              </div>
              <div>
                <label className="text-xs font-600" style={{ color: 'var(--text-muted)' }}>{t('flow.msgMenu', 'Постоянное меню (до 3 пунктов)')}</label>
                {[0, 1, 2].map((i) => (
                  <input key={i} value={msgMenu[i] || ''} maxLength={30} onChange={(e) => { const n = [...msgMenu]; n[i] = e.target.value.slice(0, 30); setMsgMenu(n); }} placeholder={`${t('flow.msgMenuItem', 'Пункт меню')} ${i + 1}`}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <AuroraButton variant="primary" size="sm" loading={msgSaving} onClick={saveMessengerProfile}>{t('flow.save', 'Сохранить')}</AuroraButton>
                {msgMsg && <span className="text-xs" style={{ color: msgMsg.includes('✓') ? '#10b981' : '#ff5ca8' }}>{msgMsg}</span>}
              </div>
              {msgRefUrl && (
                <div className="pt-2" style={{ borderTop: '1px solid var(--border-medium)' }}>
                  <div className="text-xs font-600 mb-1" style={{ color: 'var(--text-muted)' }}>{t('flow.msgRef', 'm.me ссылка + QR')}</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(msgRefUrl)}`} alt="QR" width={120} height={120} style={{ borderRadius: 8, background: '#fff', padding: 4 }} />
                    <input readOnly value={msgRefUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </AuroraCard>
      )}

      <AuroraCard className="p-4">
        <button onClick={() => setAnaOpen((v) => !v)} className="w-full flex items-center justify-between" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{anaOpen ? '▾' : '▸'} {t('flow.analytics', 'Аналитика')}</span>
          {anaLoading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
        </button>
        {anaOpen && (
          <div className="mt-3">
            <div className="flex gap-1 mb-3">
              {[7, 30, 90].map((dd) => (
                <button key={dd} onClick={() => setAnaDays(dd)} className="px-2 py-1 rounded text-xs"
                  style={{ background: anaDays === dd ? 'var(--accent)' : 'var(--bg-tertiary)', color: anaDays === dd ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                  {dd} {t('flow.days', 'дн')}
                </button>
              ))}
            </div>
            {!analytics ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{anaLoading ? t('flow.loading', 'Загрузка…') : t('flow.noData', 'Нет данных.')}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-5 flex-wrap">
                  {[[t('flow.anaDialogs', 'Диалоги'), analytics.totalConversations || 0], [t('flow.anaClientMsg', 'Сообщения клиентов'), analytics.messages?.client || 0], [t('flow.anaAiMsg', 'Ответы ИИ'), analytics.messages?.ai || 0]].map(([l, v]) => (
                    <div key={l as string}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{v as number}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{l as string}</div>
                    </div>
                  ))}
                </div>
                {analytics.byChannel?.length > 0 && (
                  <div>
                    <div className="text-xs font-600 mb-1" style={{ color: 'var(--text-muted)' }}>{t('flow.anaByChannel', 'По каналам')}</div>
                    {analytics.byChannel.map((c: any) => (
                      <div key={c.channel} className="flex items-center justify-between text-xs py-0.5">
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}><ChannelIcon channel={c.channel} size={14} /> {channelMeta(c.channel)?.label || c.channel}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{c.conversations}</span>
                      </div>
                    ))}
                  </div>
                )}
                {analytics.topTags?.length > 0 && (
                  <div>
                    <div className="text-xs font-600 mb-1" style={{ color: 'var(--text-muted)' }}>{t('flow.anaTopTags', 'Топ потребностей')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {analytics.topTags.map((tg: any) => (
                        <span key={tg.tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>{tg.tag} · {tg.count}</span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('flow.anaNote', 'На локальной базе без Postgres показывает 0 — данные считаются на сервере.')}</p>
              </div>
            )}
          </div>
        )}
      </AuroraCard>

      {error && (
        <AuroraCard className="p-3">
          <p className="text-sm" style={{ color: '#ff5ca8' }}>{error}</p>
        </AuroraCard>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : flows.length === 0 ? (
        <AuroraCard className="p-6 text-center">
          <p style={{ color: 'var(--text-muted)' }}>{t('flow.empty', 'Цепочек пока нет — создайте первую.')}</p>
        </AuroraCard>
      ) : (
        <div className="space-y-3">
          {flows.map((f) => (
            <AuroraCard key={f.id} className="p-4">
              {/* Раскладка: слева имя+статус+кнопки; справа сверху — иконка канала, снизу — «Удалить» (без текста, такого же размера). При длинном переводе кнопки растянутся вправо в свободное место. */}
              <div className="flex gap-3">
                <div className="flex-1 min-w-0 flex flex-col">
                  {editingNameId === f.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameFlow(f.id); if (e.key === 'Escape') setEditingNameId(null); }}
                        className="px-2 py-1 rounded text-base outline-none min-w-0 flex-1"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}
                      />
                      <button onClick={() => renameFlow(f.id)} title="Сохранить" style={{ color: '#10b981', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}><Check size={16} /></button>
                      <button onClick={() => setEditingNameId(null)} title="Отмена" style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-700 truncate" style={{ color: 'var(--text-primary)', fontSize: 16 }}>{f.name}</span>
                      <button onClick={() => { setEditingNameId(f.id); setEditName(f.name); }} title="Переименовать" style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}><Pencil size={14} /></button>
                    </div>
                  )}
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {f.status === 'active' ? t('flow.statusActive', 'Активна') : t('flow.statusDraft', 'Черновик')}
                    {f.channel_type ? ` · ${channelMeta(f.channel_type)?.label || f.channel_type}` : ''}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    <AuroraButton
                      variant={f.status === 'active' ? 'secondary' : 'primary'}
                      size="sm"
                      icon={<Power size={14} />}
                      loading={busyId === f.id}
                      onClick={() => toggleActive(f)}
                    >
                      {f.status === 'active' ? t('flow.deactivate', 'Выключить') : t('flow.activate', 'Включить')}
                    </AuroraButton>
                    <AuroraButton variant="secondary" size="sm" onClick={() => setEditingId(f.id)}>
                      {t('flow.openEditor', 'Редактор')}
                    </AuroraButton>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between shrink-0">
                  <span
                    title={channelMeta(f.channel_type)?.label || f.channel_type || 'Канал не выбран'}
                    className="inline-flex items-center justify-center shrink-0"
                    style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}
                  >
                    <ChannelIcon channel={f.channel_type} size={18} muted={!f.channel_type} />
                  </span>
                  <button
                    onClick={() => setPendingDelete(f.id)}
                    title={t('flow.delete', 'Удалить')}
                    aria-label={t('flow.delete', 'Удалить')}
                    className="inline-flex items-center justify-center shrink-0"
                    style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,92,168,0.10)', border: '1px solid rgba(255,92,168,0.30)', color: '#ff5ca8', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {pendingDelete === f.id && (
                <div
                  className="mt-3 p-3 rounded-lg flex items-center justify-between gap-2"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('flow.confirmDelete', 'Удалить эту цепочку?')}
                  </span>
                  <div className="flex gap-2">
                    <AuroraButton variant="danger" size="sm" loading={busyId === f.id} onClick={() => doDelete(f.id)}>
                      {t('flow.delete', 'Удалить')}
                    </AuroraButton>
                    <AuroraButton variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
                      {t('flow.cancel', 'Отмена')}
                    </AuroraButton>
                  </div>
                </div>
              )}
            </AuroraCard>
          ))}
        </div>
      )}
    </div>
  );
}
