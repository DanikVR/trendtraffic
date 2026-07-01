/**
 * /admin/users — суперадминская таблица пользователей.
 *
 * Возможности:
 *  - поиск по email / организации / tenant_id / Stripe Customer ID
 *  - фильтры: «только оплатившие», тариф, диапазон дат регистрации
 *  - быстрые пресеты (7 / 30 дней)
 *  - смена тарифа админом (с автоначислением минут или без)
 *  - ручное зачисление минут (с пресетами)
 *  - удаление пользователя (с подтверждением и каскадом по tenant)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Users, Search, Plus, Loader2, AlertCircle, CheckCircle, X, Gift, RefreshCw,
  Trash2, ChevronDown, CreditCard, Ban, RotateCcw, LogIn,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { AuroraInput } from '../../components/AuroraInput';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';
import { useAutoDismiss } from '../../hooks/useAutoDismiss';

interface UserRow {
  userId: string;
  email: string | null;
  role: string;
  googleId: string | null;
  registeredAt: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantStatus: string | null;
  stripeCustomerId: string | null;
  tier: string | null;
  subStatus: string | null;
  billingPeriod: string | null;
  balanceSeconds: number;
  rolloverSeconds: number;
  remainingMinutes: number;
  currentPeriodEnd: string | null;
  totalPaidMinutes: number;
  lastPaymentMinutes: number | null;
  lastPaymentAt: string | null;
  hasPaid: boolean;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledBy?: string | null;
  canceledAt?: string | null;
}

// Назначаемые суперадмином тарифы TrendTraffic. Только наши два полнодоступных тарифа
// (Premium / Enterprise) + «Без тарифа» для отзыва доступа (status=inactive → гейт на /billing).
// Легаси VibeVox (plus/standard/standard_yearly) убраны — больше не назначаются.
const TIER_OPTIONS: { value: string; label: string; minutes: number; color: string }[] = [
  { value: 'premium',    label: 'Premium (полный доступ)',     minutes: -1, color: '#6366f1' },
  { value: 'enterprise', label: 'Enterprise (полный доступ)',  minutes: -1, color: '#a78bfa' },
  { value: 'trial',      label: 'Без тарифа (нет доступа)',    minutes: 0,  color: '#94a3b8' },
];

// Подписи для отображения тарифа в таблице. Легаси-ключи оставлены, чтобы старые записи
// (если есть) показывались осмысленно, а не сырым значением.
const TIER_LABELS: Record<string, string> = {
  premium: 'Premium',
  enterprise: 'Enterprise',
  trial: 'Без тарифа',
  plus: 'Plus',
  standard: 'Standard',
  standard_yearly: 'Standard Yearly',
  monthly: 'Monthly',
  annual: 'Annual',
};

const TIER_COLORS: Record<string, string> = {
  premium: '#6366f1',
  enterprise: '#a78bfa',
  trial: '#94a3b8',
  plus: '#3b82f6',
  standard: '#10b981',
  standard_yearly: '#22d3ee',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return '—'; }
}

function todayMinus(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function UsersPage() {
  const { token, refreshBilling } = useAppStore();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<{ totalRegistered: number; totalPaid: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useAutoDismiss<string | null>(null, 4000);

  const [search, setSearch] = useState('');
  const [paidOnly, setPaidOnly] = useState(false);
  const [tierFilter, setTierFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // ── модал: зачисление минут ──
  const [creditUser, setCreditUser] = useState<UserRow | null>(null);
  const [creditMinutes, setCreditMinutes] = useState<string>('60');
  const [creditNote, setCreditNote] = useState('');
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  // ── модал: смена тарифа ──
  const [tierUser, setTierUser] = useState<UserRow | null>(null);
  const [tierValue, setTierValue] = useState<string>('premium');
  const [tierAddMinutes, setTierAddMinutes] = useState(true);
  const [tierSubmitting, setTierSubmitting] = useState(false);

  // ── модал: подтверждение удаления ──
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── v0.9.5: отмена/восстановление Stripe-подписки ──
  const [cancelingSubUserId, setCancelingSubUserId] = useState<string | null>(null);

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
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  });

  // Отмена in-flight запроса: при быстром вводе в поиск (debounce 250мс) ответы
  // могли приходить не по порядку и перезаписывать свежие. Паттерн «последний
  // запрос выигрывает» + только актуальный запрос управляет флагом loading.
  const loadAbortRef = useRef<AbortController | null>(null);

  const load = async () => {
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (paidOnly) params.set('paidOnly', '1');
      if (tierFilter) params.set('tier', tierFilter);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`/api/admin/users?${params.toString()}`, { headers: headers(), signal: ac.signal });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRows(data.users || []);
      setStats(data.stats || null);
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // ожидаемо при отмене — не ошибка
      setError(err.message || 'Не удалось загрузить пользователей');
    } finally {
      // setLoading(false) и сброс ref — только для актуального (последнего) запроса,
      // чтобы отменённый старый не «погасил» loader нового.
      if (loadAbortRef.current === ac) {
        loadAbortRef.current = null;
        setLoading(false);
      }
    }
  };

  useEffect(() => { load();   }, []);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, paidOnly, tierFilter, from, to]);

  // ── credit ──
  const openCredit = (user: UserRow) => {
    setCreditUser(user);
    setCreditMinutes('60');
    setCreditNote('');
  };
  const closeCredit = () => { setCreditUser(null); setCreditSubmitting(false); };
  const submitCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditUser) return;
    const minutes = parseInt(creditMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError('Введите положительное число минут');
      return;
    }
    setCreditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${creditUser.userId}/credit`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ minutes, note: creditNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSuccess(`Зачислено ${minutes} мин пользователю ${creditUser.email}.`);
      closeCredit();
      await load();
      refreshBilling(); // обновим sidebar (если админ зачислил минуты себе)
    } catch (err: any) {
      setError(err.message || 'Не удалось зачислить минуты');
    } finally {
      setCreditSubmitting(false);
    }
  };

  // ── tier ──
  const openTier = (user: UserRow) => {
    setTierUser(user);
    setTierValue(user.tier && TIER_OPTIONS.some(o => o.value === user.tier) ? user.tier : 'premium');
    setTierAddMinutes(true);
  };
  const closeTier = () => { setTierUser(null); setTierSubmitting(false); };
  const submitTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierUser) return;
    setTierSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${tierUser.userId}/tier`, {
        method: 'PATCH', headers: headers(),
        body: JSON.stringify({ tier: tierValue, addMinutes: tierAddMinutes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const tierLabel = TIER_LABELS[tierValue] || tierValue;
      setSuccess(`Тариф пользователя ${tierUser.email} изменён на ${tierLabel}${tierAddMinutes && data.minutesAdded ? ` (+${data.minutesAdded} мин)` : ''}.`);
      closeTier();
      await load();
    } catch (err: any) {
      setError(err.message || 'Не удалось изменить тариф');
    } finally {
      setTierSubmitting(false);
    }
  };

  // ── delete ──
  const openDelete = (user: UserRow) => setDeleteUser(user);
  const closeDelete = () => { setDeleteUser(null); setDeleteSubmitting(false); };
  const submitDelete = async () => {
    if (!deleteUser) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.userId}`, {
        method: 'DELETE', headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSuccess(`Пользователь ${deleteUser.email} удалён.`);
      closeDelete();
      await load();
    } catch (err: any) {
      setError(err.message || 'Не удалось удалить пользователя');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ── v0.9.5: cancel / resume Stripe subscription ──
  const handleCancelSub = (user: UserRow) => {
    const dateStr = user.currentPeriodEnd
      ? new Date(user.currentPeriodEnd).toLocaleDateString('ru-RU')
      : 'конца периода';
    setConfirmDialog({
      title: `Отменить подписку ${user.email}?`,
      message: `Деньги не возвращаются. Подписка останется активной до ${dateStr}, затем Stripe её закроет автоматически.`,
      confirmLabel: 'Отменить',
      variant: 'danger',
      onConfirm: async () => {
        setCancelingSubUserId(user.userId);
        try {
          const res = await fetch(`/api/admin/users/${user.userId}/cancel-subscription`, {
            method: 'POST', headers: headers(),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setSuccess(data.message || 'Подписка помечена на отмену');
          await load();
        } catch (err: any) {
          setError(err.message || 'Не удалось отменить подписку');
        } finally {
          setCancelingSubUserId(null);
        }
      },
    });
  };

  const handleResumeSub = (user: UserRow) => {
    setConfirmDialog({
      title: `Восстановить подписку ${user.email}?`,
      message: 'Автопродление возобновится.',
      confirmLabel: 'Восстановить',
      variant: 'primary',
      onConfirm: async () => {
        setCancelingSubUserId(user.userId);
        try {
          const res = await fetch(`/api/admin/users/${user.userId}/resume-subscription`, {
            method: 'POST', headers: headers(),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setSuccess(data.message || 'Подписка восстановлена');
          await load();
        } catch (err: any) {
          setError(err.message || 'Не удалось восстановить подписку');
        } finally {
          setCancelingSubUserId(null);
        }
      },
    });
  };

  // ── Войти в аккаунт пользователя (impersonation) ──
  // Суперадмин получает JWT целевого пользователя, ставит его в store (setAuth) и
  // перезагружает приложение — дальше работает как этот пользователь. Чтобы вернуться
  // в супер-админку, нужно выйти и войти снова под суперадмином.
  const handleImpersonate = async (u: UserRow) => {
    if (!window.confirm(
      `Войти в аккаунт «${u.email || u.tenantId}»?\n\n` +
      `Вы выйдете из супер-админки и продолжите работу как этот пользователь. ` +
      `Чтобы вернуться, выйдите из аккаунта и войдите снова под суперадмином.`
    )) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${u.userId}/impersonate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error || `HTTP ${res.status}`);
      // Сохраняем ТЕКУЩУЮ сессию суперадмина в sessionStorage (переживает reload в этой же
      // вкладке) — чтобы вернуться в админку одной кнопкой, без повторного логина.
      const cur = useAppStore.getState();
      if (cur.token && cur.user) {
        try {
          sessionStorage.setItem('tt_impersonation_backup', JSON.stringify({ token: cur.token, user: cur.user }));
        } catch { /* приватный режим — не критично */ }
      }
      // Ставим сессию целевого пользователя и делаем полную перезагрузку — приложение
      // переинициализируется под новым токеном (роутинг/гейт/биллинг подхватят тариф).
      useAppStore.getState().setAuth(data.token, data.user);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Не удалось войти в аккаунт пользователя');
    }
  };

  const totalRegistered = stats?.totalRegistered ?? rows.length;
  const totalPaid = stats?.totalPaid ?? rows.filter(r => r.hasPaid).length;

  const applyPreset = (days: number) => {
    setFrom(todayMinus(days));
    setTo(todayIso());
  };
  const clearDates = () => { setFrom(''); setTo(''); };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}>
          <Users size={20} color="#fff" />
        </div>
        <div>
          <h1 className="text-2xl font-700" style={{ color: 'var(--text-primary)' }}>Пользователи</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Зарегистрировано: <b>{totalRegistered}</b> · Платили: <b>{totalPaid}</b>
          </p>
        </div>
        <div className="ml-auto">
          <AuroraButton variant="ghost" onClick={load} disabled={loading} icon={loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}>
            Обновить
          </AuroraButton>
        </div>
      </div>

      {/* Тосты */}
      {success && (
        <AuroraCard className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} color="#10b981" />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{success}</span>
            <button type="button" onClick={() => setSuccess(null)} className="ml-auto"><X size={14} /></button>
          </div>
        </AuroraCard>
      )}
      {error && (
        <AuroraCard className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} color="#ef4444" />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </div>
        </AuroraCard>
      )}

      {/* Панель фильтров */}
      <AuroraCard className="p-4 sm:p-5">
        <div className="space-y-4">
          {/* Строка 1: поиск + чекбокс */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1 min-w-0">
              <AuroraInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по email, организации, tenant_id, Stripe Customer ID…"
                icon={<Search size={14} />}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none px-3 py-2.5 rounded-xl transition-all"
                   style={{
                     color: paidOnly ? '#10b981' : 'var(--text-secondary)',
                     border: `1px solid ${paidOnly ? 'rgba(16, 185, 129, 0.5)' : 'var(--border-medium)'}`,
                     background: paidOnly ? 'rgba(16, 185, 129, 0.10)' : 'var(--bg-tertiary)',
                   }}>
              <input
                type="checkbox"
                checked={paidOnly}
                onChange={(e) => setPaidOnly(e.target.checked)}
                style={{ accentColor: '#10b981' }}
              />
              <span className="whitespace-nowrap font-600">Только оплатившие</span>
            </label>
          </div>

          {/* Строка 2: тариф + диапазон дат + пресеты */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] gap-3 lg:items-end">
            <div className="min-w-0">
              <label className="text-xs font-600 uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                Тариф
              </label>
              <div className="relative">
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl text-sm appearance-none transition-colors focus:outline-none focus:border-[var(--brand)]"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">Все тарифы</option>
                  {TIER_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{TIER_LABELS[o.value] || o.value}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-600 uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                Дата с
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full sm:w-auto px-3 py-2.5 rounded-xl text-sm transition-colors focus:outline-none focus:border-[var(--brand)]"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label className="text-xs font-600 uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                По
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full sm:w-auto px-3 py-2.5 rounded-xl text-sm transition-colors focus:outline-none focus:border-[var(--brand)]"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div className="flex gap-1.5 sm:items-end">
              <button type="button" onClick={() => applyPreset(7)} className="flex-1 sm:flex-none text-xs px-3 py-2.5 rounded-xl font-600 transition-colors hover:bg-[var(--bg-secondary)]"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
                7 дн
              </button>
              <button type="button" onClick={() => applyPreset(30)} className="flex-1 sm:flex-none text-xs px-3 py-2.5 rounded-xl font-600 transition-colors hover:bg-[var(--bg-secondary)]"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
                30 дн
              </button>
              {(from || to) && (
                <button type="button" onClick={clearDates} className="flex-1 sm:flex-none text-xs px-3 py-2.5 rounded-xl font-600 transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                  Сброс
                </button>
              )}
            </div>
          </div>
        </div>
      </AuroraCard>

      {/* Таблица */}
      <AuroraCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="text-left px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Email / Организация</th>
                <th className="text-left px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Тариф</th>
                <th className="text-left px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Зарегистрирован</th>
                <th className="text-right px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center">
                  <Loader2 size={20} className="animate-spin inline-block mr-2" />
                  Загрузка…
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>
                  Пользователи не найдены
                </td></tr>
              )}
              {rows.map((u) => {
                const tierColor = TIER_COLORS[u.tier || ''] || 'var(--text-muted)';
                return (
                  <tr key={u.userId}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      className="hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-600" style={{ color: 'var(--text-primary)' }}>{u.email || '—'}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {u.tenantName || '—'} · <code className="text-[10px]">{u.tenantId ? `${u.tenantId.slice(0, 8)}…` : '—'}</code>
                        {u.googleId && <span className="ml-1 text-[10px]">· Google</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-xs font-600 px-2 py-1 rounded-full inline-block"
                              style={{
                                background: `${tierColor}1a`,
                                color: tierColor,
                                border: `1px solid ${tierColor}30`,
                              }}>
                          {TIER_LABELS[u.tier || ''] || u.tier || 'Триал'}
                        </span>
                        {u.cancelAtPeriodEnd && (
                          <span className="text-[10px] font-600 px-1.5 py-0.5 rounded"
                                style={{
                                  background: 'rgba(245, 158, 11, 0.10)',
                                  color: '#FBBF24',
                                  border: '1px solid rgba(245, 158, 11, 0.22)',
                                }}
                                title={`Будет отменена ${u.currentPeriodEnd ? new Date(u.currentPeriodEnd).toLocaleString('ru-RU') : ''}`}>
                            отмена · {u.currentPeriodEnd ? new Date(u.currentPeriodEnd).toLocaleDateString('ru-RU') : '—'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(u.registeredAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button"
                                onClick={() => openCredit(u)}
                                title="Зачислить минуты"
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                                style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--brand)', border: '1px solid rgba(99, 102, 241, 0.24)' }}>
                          <Gift size={14} />
                        </button>
                        <button type="button"
                                onClick={() => openTier(u)}
                                title="Сменить тариф"
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                                style={{ background: 'rgba(34, 211, 238, 0.12)', color: '#22d3ee', border: '1px solid rgba(34, 211, 238, 0.24)' }}>
                          <CreditCard size={14} />
                        </button>
                        <button type="button"
                                onClick={() => handleImpersonate(u)}
                                title="Войти в аккаунт пользователя (работать как он)"
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                                style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.24)' }}>
                          <LogIn size={14} />
                        </button>
                        {/* v0.9.5: маленькая, неприметная кнопка отмены/восстановления Stripe-подписки */}
                        {u.stripeSubscriptionId && !u.cancelAtPeriodEnd && (
                          <button type="button"
                                  onClick={() => handleCancelSub(u)}
                                  disabled={cancelingSubUserId === u.userId}
                                  title="Отменить автопродление подписки (до конца периода всё работает, деньги не возвращаются)"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
                                  style={{ background: 'transparent', color: 'var(--text-disabled)', border: '1px solid var(--border-subtle)' }}>
                            {cancelingSubUserId === u.userId
                              ? <Loader2 size={11} className="animate-spin" />
                              : <Ban size={11} strokeWidth={1.5} />}
                          </button>
                        )}
                        {u.stripeSubscriptionId && u.cancelAtPeriodEnd && (
                          <button type="button"
                                  onClick={() => handleResumeSub(u)}
                                  disabled={cancelingSubUserId === u.userId}
                                  title="Восстановить автопродление подписки"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
                                  style={{ background: 'rgba(245, 158, 11, 0.10)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                            {cancelingSubUserId === u.userId
                              ? <Loader2 size={11} className="animate-spin" />
                              : <RotateCcw size={11} strokeWidth={1.5} />}
                          </button>
                        )}
                        <button type="button"
                                onClick={() => openDelete(u)}
                                title="Удалить пользователя"
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                                style={{ background: 'rgba(239, 68, 68, 0.10)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.20)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AuroraCard>

      {/* ── Модал: добавить минуты ── */}
      {creditUser && (
        <Modal onClose={closeCredit}>
          <form onSubmit={submitCredit} className="space-y-5">
            <ModalHeader
              icon={<Gift size={18} color="var(--brand)" />}
              iconBg="rgba(99, 102, 241, 0.15)"
              title="Добавить минуты"
              subtitle={creditUser.email || creditUser.userId}
              onClose={closeCredit}
            />
            <div>
              <AuroraInput
                label="Сколько минут зачислить"
                type="number"
                min="1"
                max="100000"
                value={creditMinutes}
                onChange={(e) => setCreditMinutes(e.target.value)}
                autoFocus
              />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {[30, 60, 120, 300, 600].map(v => (
                  <button key={v} type="button"
                          onClick={() => setCreditMinutes(String(v))}
                          className="text-xs px-2.5 py-1.5 rounded-lg font-600 transition-all"
                          style={{
                            background: creditMinutes === String(v) ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-tertiary)',
                            border: `1px solid ${creditMinutes === String(v) ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                            color: creditMinutes === String(v) ? 'var(--brand)' : 'var(--text-secondary)',
                          }}>
                    +{v}
                  </button>
                ))}
              </div>
            </div>
            <AuroraInput
              label="Комментарий (необязательно)"
              value={creditNote}
              onChange={(e) => setCreditNote(e.target.value)}
              placeholder="Например: компенсация за инцидент"
            />
            <div className="flex gap-2 pt-2">
              <AuroraButton type="button" variant="ghost" onClick={closeCredit} disabled={creditSubmitting}>
                Отмена
              </AuroraButton>
              <AuroraButton type="submit" disabled={creditSubmitting} icon={creditSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}>
                Зачислить
              </AuroraButton>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Модал: смена тарифа ── */}
      {tierUser && (
        <Modal onClose={closeTier}>
          <form onSubmit={submitTier} className="space-y-5">
            <ModalHeader
              icon={<CreditCard size={18} color="#22d3ee" />}
              iconBg="rgba(34, 211, 238, 0.15)"
              title="Сменить тариф"
              subtitle={tierUser.email || tierUser.userId}
              onClose={closeTier}
            />
            <div className="text-xs px-3 py-2 rounded-xl"
                 style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              Текущий тариф: <b style={{ color: 'var(--text-primary)' }}>{TIER_LABELS[tierUser.tier || ''] || tierUser.tier || '—'}</b>
              {' · '}Осталось мин: <b style={{ color: 'var(--text-primary)' }}>{tierUser.remainingMinutes}</b>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-600 uppercase tracking-wider block" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                Новый тариф
              </label>
              {TIER_OPTIONS.map(o => (
                <label key={o.value}
                       className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                       style={{
                         background: tierValue === o.value ? `${o.color}14` : 'var(--bg-tertiary)',
                         border: `1px solid ${tierValue === o.value ? `${o.color}50` : 'var(--border-subtle)'}`,
                       }}>
                  <input type="radio"
                         name="tier"
                         value={o.value}
                         checked={tierValue === o.value}
                         onChange={() => setTierValue(o.value)}
                         style={{ accentColor: o.color }} />
                  <span className="text-sm font-600 flex-1" style={{ color: tierValue === o.value ? o.color : 'var(--text-primary)' }}>
                    {o.label}
                  </span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none"
                   style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox"
                     checked={tierAddMinutes}
                     onChange={(e) => setTierAddMinutes(e.target.checked)}
                     style={{ accentColor: '#10b981' }} />
              <span>Начислить минуты этого тарифа сразу</span>
            </label>
            <div className="flex gap-2 pt-2">
              <AuroraButton type="button" variant="ghost" onClick={closeTier} disabled={tierSubmitting}>
                Отмена
              </AuroraButton>
              <AuroraButton type="submit" disabled={tierSubmitting} icon={tierSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}>
                Применить
              </AuroraButton>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Модал: подтверждение удаления ── */}
      {deleteUser && (
        <Modal onClose={closeDelete}>
          <div className="space-y-5">
            <ModalHeader
              icon={<Trash2 size={18} color="#ef4444" />}
              iconBg="rgba(239, 68, 68, 0.15)"
              title="Удалить пользователя?"
              subtitle={deleteUser.email || deleteUser.userId}
              onClose={closeDelete}
            />
            <div className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
              <p>Будут удалены:</p>
              <ul className="list-disc pl-5 text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                <li>Учётная запись пользователя</li>
                <li>Арендатор (tenant) <code className="text-[10px]">{deleteUser.tenantId?.slice(0, 8) || '—'}…</code></li>
                <li>Подписка и баланс минут ({deleteUser.remainingMinutes} мин)</li>
              </ul>
              <p className="text-xs" style={{ color: '#ef4444' }}>Действие необратимо. Stripe-данные не затрагиваются.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <AuroraButton type="button" variant="ghost" onClick={closeDelete} disabled={deleteSubmitting}>
                Отмена
              </AuroraButton>
              <button type="button"
                      onClick={submitDelete}
                      disabled={deleteSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-700 transition-all"
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                      }}>
                {deleteSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Удалить навсегда</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

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

// ──────────────────────────────────────────────────────────────────────────
// Reusable modal building blocks (одностилевые модалы)
// ──────────────────────────────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  // Lock body scroll
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto animate-fade-in"
         style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
         onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md mx-4 my-4 sm:my-8"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* AuroraCard сам padding не даёт (см. .aurora-card в index.css), поэтому добавляем p-5/p-6 явно. */}
        <AuroraCard className="p-5 sm:p-6">
          {children}
        </AuroraCard>
      </div>
    </div>
  );
}

function ModalHeader({ icon, iconBg, title, subtitle, onClose }: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string | null;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
           style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-700 truncate" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        {subtitle && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]">
        <X size={16} style={{ color: 'var(--text-muted)' }} />
      </button>
    </div>
  );
}
