/**
 * /admin/partners — суперадминская панель «Партнёры».
 *
 * Состоит из двух блоков:
 *  1. Карточка «Условия партнёрской программы»: textarea + поле WhatsApp + кнопка «Сохранить».
 *  2. Таблица партнёров с агрегатами (переходы / регистрации / оплатили / минуты привлечённых).
 *     Действия: включить/отключить, сохранить заметку.
 *
 * Доступ: только superadmin (бэк сам проверит JWT).
 */

import React, { useEffect, useState } from 'react';
import {
  HeartHandshake, Loader2, RefreshCw, AlertCircle, CheckCircle, X,
  Save, Copy, Power, Phone, Users as UsersIcon, Search, StickyNote,
  RotateCcw, Trash2,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { AuroraInput } from '../../components/AuroraInput';
import { useAppStore } from '../../store/useAppStore';

interface PartnerRow {
  id: string;
  code: string;
  status: 'active' | 'disabled';
  notes: string | null;
  createdAt: string | null;
  userId: string;
  email: string | null;
  tenantId: string | null;
  clicks: number;
  registrations: number;
  paidUsers: number;
  paidMinutes: number;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return '—'; }
}

export default function PartnersPage() {
  const { token } = useAppStore();

  // Программа
  const [termsText, setTermsText] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [savingProgram, setSavingProgram] = useState(false);
  const [programLoaded, setProgramLoaded] = useState(false);

  // Партнёры
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Поиск по email / коду партнёра
  const [search, setSearch] = useState('');

  // Приватные заметки суперадмина по партнёру (видны только суперадмину)
  const [notesPartner, setNotesPartner] = useState<PartnerRow | null>(null);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Сброс статистики / удаление партнёра (id строки, по которой идёт действие)
  const [actioning, setActioning] = useState<string | null>(null);
  // Внутренний модал подтверждения (вместо браузерного window.confirm)
  const [pendingAction, setPendingAction] = useState<{ partner: PartnerRow; type: 'reset' | 'delete' } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  });

  const loadProgram = async () => {
    try {
      const res = await fetch('/api/admin/partners/program', { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTermsText(data.termsText || '');
      setWhatsapp(data.whatsappContact || '');
      setProgramLoaded(true);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить условия программы');
    }
  };

  const loadPartners = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/partners', { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRows(data.partners || []);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить список партнёров');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgram();
    loadPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProgram = async () => {
    setSavingProgram(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/partners/program', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ termsText, whatsappContact: whatsapp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSuccess('Условия программы сохранены');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить условия');
    } finally {
      setSavingProgram(false);
    }
  };

  const toggleStatus = async (p: PartnerRow) => {
    const newStatus = p.status === 'active' ? 'disabled' : 'active';
    setToggling(p.id);
    try {
      const res = await fetch(`/api/admin/partners/${p.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRows(prev => prev.map(r => r.id === p.id ? { ...r, status: newStatus } : r));
      setSuccess(`Партнёр ${p.email} ${newStatus === 'active' ? 'включён' : 'отключён'}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Не удалось изменить статус');
    } finally {
      setToggling(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setSuccess(`Код ${code} скопирован`);
    setTimeout(() => setSuccess(null), 2000);
  };

  const openNotes = (p: PartnerRow) => {
    setNotesPartner(p);
    setNotesText(p.notes || '');
  };

  const saveNotes = async () => {
    if (!notesPartner) return;
    setSavingNotes(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partners/${notesPartner.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ notes: notesText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRows(prev => prev.map(r => r.id === notesPartner.id ? { ...r, notes: notesText } : r));
      setNotesPartner(null);
      setSuccess('Заметка сохранена');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить заметку');
    } finally {
      setSavingNotes(false);
    }
  };

  // Исполнители (без подтверждения — оно во внутреннем модале pendingAction).
  const doReset = async (p: PartnerRow) => {
    setActioning(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partners/${p.id}/reset`, { method: 'POST', headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRows(prev => prev.map(r => r.id === p.id
        ? { ...r, clicks: 0, registrations: 0, paidUsers: 0, paidMinutes: 0 }
        : r));
      setSuccess(`Статистика партнёра ${p.email || p.code} сброшена`);
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Не удалось сбросить статистику');
    } finally {
      setActioning(null);
    }
  };

  const doDelete = async (p: PartnerRow) => {
    setActioning(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partners/${p.id}`, { method: 'DELETE', headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRows(prev => prev.filter(r => r.id !== p.id));
      setSuccess(`Партнёр ${p.email || p.code} удалён`);
      setTimeout(() => setSuccess(null), 2500);
    } catch (err: any) {
      setError(err.message || 'Не удалось удалить партнёра');
    } finally {
      setActioning(null);
    }
  };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    const { partner, type } = pendingAction;
    setPendingAction(null);
    if (type === 'reset') await doReset(partner);
    else await doDelete(partner);
  };

  // Поиск по email или коду (регистронезависимо)
  const q = search.trim().toLowerCase();
  const filteredRows = q
    ? rows.filter(r => (r.email || '').toLowerCase().includes(q) || (r.code || '').toLowerCase().includes(q))
    : rows;

  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalRegs = rows.reduce((s, r) => s + r.registrations, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paidUsers, 0);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)' }}>
          <HeartHandshake size={20} color="#fff" />
        </div>
        <div>
          <h1 className="text-2xl font-700" style={{ color: 'var(--text-primary)' }}>Партнёры</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Партнёров: <b>{rows.length}</b> · Переходы: <b>{totalClicks}</b> · Регистрации: <b>{totalRegs}</b> · Оплатили: <b>{totalPaid}</b>
          </p>
        </div>
        <div className="ml-auto">
          <AuroraButton variant="ghost" onClick={() => { loadProgram(); loadPartners(); }} disabled={loading}
                       icon={loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}>
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

      {/* Карточка: Условия программы */}
      <AuroraCard className="p-5 sm:p-6">
        <h2 className="text-lg font-700 mb-1" style={{ color: 'var(--text-primary)' }}>Условия партнёрской программы</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Этот текст видят партнёры в своих настройках по кнопке «Условия сотрудничества».
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-600 uppercase tracking-wider block mb-1.5"
                   style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              Текст условий (plain text, переносы строк сохраняются)
            </label>
            <textarea
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              rows={10}
              placeholder={programLoaded ? 'Опишите условия партнёрства: что получает партнёр, как происходят выплаты, сроки…' : 'Загрузка…'}
              className="w-full px-3 py-2.5 rounded-xl text-sm transition-colors focus:outline-none focus:border-[var(--brand)] resize-y"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                minHeight: '180px',
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AuroraInput
              label="WhatsApp для связи"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+380637610482"
              icon={<Phone size={14} />}
            />
            <div className="flex items-end">
              <AuroraButton onClick={saveProgram} disabled={savingProgram}
                            icon={savingProgram ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
                Сохранить условия
              </AuroraButton>
            </div>
          </div>
        </div>
      </AuroraCard>

      {/* Таблица: Партнёры */}
      <AuroraCard className="!p-0 overflow-hidden">
        {/* Поиск по email / коду партнёра */}
        <div className="p-3 sm:p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по email или коду партнёра…"
              className="w-full pl-9 pr-9 py-2 rounded-xl text-sm transition-colors focus:outline-none focus:border-[var(--brand)]"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} title="Очистить"
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                      style={{ color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            )}
          </div>
          {q && (
            <div className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Найдено: <b>{filteredRows.length}</b> из {rows.length}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="text-left px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Email</th>
                <th className="text-left px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Код</th>
                <th className="text-right px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Переходы</th>
                <th className="text-right px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Регистрации</th>
                <th className="text-right px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Оплатили</th>
                <th className="text-right px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Куплено мин</th>
                <th className="text-left px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Создан</th>
                <th className="text-left px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Статус</th>
                <th className="text-right px-4 py-3 font-600" style={{ color: 'var(--text-muted)' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center">
                  <Loader2 size={20} className="animate-spin inline-block mr-2" />
                  Загрузка…
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>
                  <UsersIcon size={32} className="inline-block mb-2 opacity-40" />
                  <div>Партнёры появятся автоматически, как только пользователи откроют «Партнёрскую программу» в настройках.</div>
                </td></tr>
              )}
              {!loading && rows.length > 0 && filteredRows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>
                  <Search size={28} className="inline-block mb-2 opacity-40" />
                  <div>По запросу «{search}» ничего не найдено.</div>
                </td></tr>
              )}
              {filteredRows.map((p) => {
                const isActive = p.status === 'active';
                return (
                  <tr key={p.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      className="hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-600" style={{ color: 'var(--text-primary)' }}>{p.email || '—'}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <code>{p.tenantId ? `${p.tenantId.slice(0, 8)}…` : '—'}</code>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button"
                              onClick={() => copyCode(p.code)}
                              title="Скопировать код"
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-colors hover:bg-[var(--bg-tertiary)]"
                              style={{
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                              }}>
                        <code>{p.code}</code>
                        <Copy size={11} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.clicks}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.registrations}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span style={{ color: p.paidUsers > 0 ? '#10b981' : 'var(--text-muted)' }}>
                        {p.paidUsers}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.paidMinutes}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-600 px-2 py-1 rounded-full inline-block"
                            style={{
                              background: isActive ? 'rgba(16, 185, 129, 0.10)' : 'rgba(148, 163, 184, 0.10)',
                              color: isActive ? '#10b981' : '#94a3b8',
                              border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.25)'}`,
                            }}>
                        {isActive ? 'Активен' : 'Отключён'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button"
                                onClick={() => openNotes(p)}
                                title={p.notes ? 'Заметка (есть) — открыть' : 'Добавить заметку'}
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                                style={{
                                  background: p.notes ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-tertiary)',
                                  color: p.notes ? '#f59e0b' : 'var(--text-muted)',
                                  border: `1px solid ${p.notes ? 'rgba(245, 158, 11, 0.25)' : 'var(--border-subtle)'}`,
                                }}>
                          <StickyNote size={14} />
                        </button>
                        <button type="button"
                                onClick={() => setPendingAction({ partner: p, type: 'reset' })}
                                disabled={actioning === p.id}
                                title="Сбросить статистику (переходы/регистрации/оплаты) — например, после выплаты"
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
                                style={{
                                  background: 'rgba(99, 102, 241, 0.10)',
                                  color: 'var(--brand)',
                                  border: '1px solid rgba(99, 102, 241, 0.20)',
                                }}>
                          {actioning === p.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        </button>
                        <button type="button"
                                onClick={() => toggleStatus(p)}
                                disabled={toggling === p.id}
                                title={isActive ? 'Отключить партнёра' : 'Включить партнёра'}
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
                                style={{
                                  background: isActive ? 'rgba(239, 68, 68, 0.10)' : 'rgba(16, 185, 129, 0.10)',
                                  color: isActive ? '#ef4444' : '#10b981',
                                  border: `1px solid ${isActive ? 'rgba(239, 68, 68, 0.20)' : 'rgba(16, 185, 129, 0.20)'}`,
                                }}>
                          {toggling === p.id ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                        </button>
                        <button type="button"
                                onClick={() => setPendingAction({ partner: p, type: 'delete' })}
                                disabled={actioning === p.id}
                                title="Удалить партнёра полностью"
                                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.10)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.20)',
                                }}>
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

      {/* Модал приватной заметки о партнёре (видна ТОЛЬКО суперадмину) */}
      {notesPartner && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
             onClick={() => { if (!savingNotes) setNotesPartner(null); }}>
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <AuroraCard className="p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <StickyNote size={18} style={{ color: '#f59e0b' }} />
                <h3 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>Заметка о партнёре</h3>
                <button type="button" onClick={() => setNotesPartner(null)} disabled={savingNotes}
                        className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-70 disabled:opacity-40"
                        style={{ color: 'var(--text-muted)' }} title="Закрыть">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                {notesPartner.email || '—'} · <code>{notesPartner.code}</code>
                <br />
                Видно только суперадминам — партнёр свою заметку не видит.
              </p>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={6}
                autoFocus
                placeholder="Например: договорённость по выплате, контакт, контекст по этому партнёру…"
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[var(--brand)] resize-y"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  minHeight: '120px',
                }}
              />
              <div className="flex items-center justify-end gap-2 mt-4">
                <AuroraButton variant="ghost" onClick={() => setNotesPartner(null)} disabled={savingNotes}>
                  Отмена
                </AuroraButton>
                <AuroraButton onClick={saveNotes} disabled={savingNotes}
                              icon={savingNotes ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
                  Сохранить заметку
                </AuroraButton>
              </div>
            </AuroraCard>
          </div>
        </div>
      )}

      {/* Внутренний модал подтверждения (сброс / удаление) — вместо браузерного window.confirm */}
      {pendingAction && (() => {
        const isDelete = pendingAction.type === 'delete';
        const p = pendingAction.partner;
        const accent = isDelete ? '#ef4444' : 'var(--brand)';
        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4"
               style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
               onClick={() => setPendingAction(null)}>
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <AuroraCard className="p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                       style={{ background: isDelete ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)' }}>
                    {isDelete ? <Trash2 size={18} style={{ color: accent }} /> : <RotateCcw size={18} style={{ color: accent }} />}
                  </div>
                  <h3 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>
                    {isDelete ? 'Удалить партнёра?' : 'Сбросить статистику?'}
                  </h3>
                  <button type="button" onClick={() => setPendingAction(null)}
                          className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-70"
                          style={{ color: 'var(--text-muted)' }} title="Закрыть">
                    <X size={16} />
                  </button>
                </div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                  Партнёр: <b>{p.email || '—'}</b> · <code>{p.code}</code>
                </p>
                <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                  {isDelete
                    ? 'Будут удалены его записи (переходы, регистрации, привязки) и сам профиль. Восстановить нельзя.'
                    : 'Переходы, регистрации и оплаты обнулятся (например, после выплаты вознаграждения). Сам партнёр останется активным. Действие необратимо.'}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <AuroraButton variant="ghost" onClick={() => setPendingAction(null)}>Отмена</AuroraButton>
                  <button type="button" onClick={runPendingAction}
                          className="px-4 py-2 rounded-xl text-sm font-600 text-white transition-opacity hover:opacity-90"
                          style={{ background: accent }}>
                    {isDelete ? 'Удалить' : 'Сбросить'}
                  </button>
                </div>
              </AuroraCard>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
