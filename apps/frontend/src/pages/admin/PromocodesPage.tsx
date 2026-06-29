/**
 * /admin/promocodes — управление промокодами через Stripe.
 *
 * Создание coupon + promotion_code. Активные коды сверху, неактивные снизу.
 * Действия:
 *   - active → Деактивировать (soft) или Удалить навсегда (hard).
 *   - inactive → Возобновить или Удалить навсегда.
 *   - Edit (для active) → пересоздаёт код с новыми параметрами (Stripe не разрешает реальный edit).
 *
 * 100% percentOff = бесплатная активация тарифа.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag, Plus, Trash2, Loader2, Check, AlertCircle, Calendar, Percent,
  RefreshCw, RotateCcw, Pencil, X,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { AuroraInput } from '../../components/AuroraInput';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';
import { showToast } from '../../components/Toast';

interface PromoCode {
  id: string;
  code: string;
  active: boolean;
  percentOff: number | null;
  amountOff?: number | null;
  duration: string | null;
  durationInMonths?: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: string | null;
  createdAt: string;
  couponId?: string | null;
  appliesToProducts?: string[] | null;
  appliesToTiers?: string[] | null;
}

type FormState = {
  code: string;
  percent: number;
  duration: 'once' | 'forever' | 'repeating';
  durationMonths: number;
  maxRedemptions: string;
  expiresAt: string;
  tiers: string[];
};

const EMPTY_FORM: FormState = {
  code: '',
  percent: 25,
  duration: 'once',
  durationMonths: 3,
  maxRedemptions: '',
  expiresAt: '',
  tiers: [],
};

const TIER_OPTIONS = [
  { v: 'plus', label: 'Plus', color: '#3b82f6' },
  { v: 'standard', label: 'Standard (мес)', color: '#10b981' },
  { v: 'standard_yearly', label: 'Standard Yearly', color: '#22d3ee' },
] as const;

export default function PromocodesPage() {
  const { token } = useAppStore();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFrom, setEditingFrom] = useState<PromoCode | null>(null); // null = новый код, иначе — пересоздаём
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Кастомный confirm-диалог (вместо браузерного confirm())
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message?: React.ReactNode;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const toggleTier = (t: string) => {
    setForm((f) => ({ ...f, tiers: f.tiers.includes(t) ? f.tiers.filter((x) => x !== t) : [...f.tiers, t] }));
  };

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/promocodes', { headers: headers() });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCodes(data.codes || []);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить промокоды');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNewEditor = () => {
    setEditingFrom(null);
    setForm(EMPTY_FORM);
    setError(null);
    setEditorOpen(true);
  };

  const openEditFor = (c: PromoCode) => {
    setEditingFrom(c);
    setForm({
      code: c.code,
      percent: c.percentOff ?? 25,
      duration: (c.duration as any) ?? 'once',
      durationMonths: c.durationInMonths ?? 3,
      maxRedemptions: c.maxRedemptions ? String(c.maxRedemptions) : '',
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : '',
      tiers: c.appliesToTiers ?? [],
    });
    setError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingFrom(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Клиентская валидация — чтобы при редактировании не удалять старый код, если новый
    // заведомо не пройдёт серверную проверку.
    const codeTrim = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(codeTrim)) {
      setError('Код должен быть 3–40 символов: латиница, цифры, дефис, подчёркивание.');
      return;
    }
    if (form.percent < 1 || form.percent > 100) {
      setError('Скидка должна быть от 1 до 100.');
      return;
    }
    if (form.duration === 'repeating' && (!form.durationMonths || form.durationMonths < 1)) {
      setError('Для «N месяцев подряд» укажите количество месяцев.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Если редактируем существующий — сначала hard-delete старый, потом создаём новый.
      if (editingFrom) {
        const del = await fetch(`/api/admin/promocodes/${editingFrom.id}?hard=true`, {
          method: 'DELETE',
          headers: headers(),
        });
        const dtext = await del.text();
        let ddata: any = {};
        if (dtext.trim()) { try { ddata = JSON.parse(dtext); } catch { /* */ } }
        if (!del.ok) throw new Error(ddata.error || `Не удалось удалить старый промокод: HTTP ${del.status}`);
      }

      const body: any = {
        code: form.code.trim().toUpperCase(),
        percentOff: form.percent,
        duration: form.duration,
      };
      if (form.duration === 'repeating') body.durationInMonths = form.durationMonths;
      if (form.maxRedemptions) body.maxRedemptions = parseInt(form.maxRedemptions, 10);
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();
      if (form.tiers.length > 0 && form.tiers.length < 3) body.tiers = form.tiers;

      const res = await fetch('/api/admin/promocodes', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      closeEditor();
      await load();
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить промокод');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = (id: string) => {
    setConfirmDialog({
      title: 'Деактивировать промокод?',
      message: 'Использовать его клиенты больше не смогут. Можно потом возобновить.',
      confirmLabel: 'Деактивировать',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/promocodes/${id}`, { method: 'DELETE', headers: headers() });
          if (!res.ok) {
            const text = await res.text();
            let data: any = {};
            if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          await load();
        } catch (err: any) {
          showToast(err.message || 'Не удалось деактивировать', 'error');
        }
      },
    });
  };

  const handleReactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/promocodes/${id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) {
        const text = await res.text();
        let data: any = {};
        if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (err: any) {
      showToast(err.message || 'Не удалось возобновить', 'error');
    }
  };

  const handleHardDelete = (id: string, code: string) => {
    setConfirmDialog({
      title: `Удалить промокод ${code} навсегда?`,
      message: 'Действие необратимо.',
      confirmLabel: 'Удалить',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/promocodes/${id}?hard=true`, { method: 'DELETE', headers: headers() });
          const text = await res.text();
          let data: any = {};
          if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          if (data.status === 'partial') showToast(data.message || 'Удалось только деактивировать.', 'info');
          await load();
        } catch (err: any) {
          showToast(err.message || 'Не удалось удалить', 'error');
        }
      },
    });
  };

  // Активные сверху, остальные снизу (сервер уже отсортировал — оставляем как fallback)
  const sortedCodes = useMemo(() => {
    return [...codes].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [codes]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="section-title text-2xl mb-1">Промокоды</h1>
          <p className="section-subtitle">Создавайте скидочные коды для подписок. Через Stripe Coupons + Promotion Codes.</p>
        </div>
        <div className="flex gap-2">
          <AuroraButton variant="ghost" onClick={load} icon={<RefreshCw size={16} strokeWidth={1.5} />}>
            Обновить
          </AuroraButton>
          <AuroraButton onClick={openNewEditor} icon={<Plus size={16} strokeWidth={1.5} />}>
            Создать промокод
          </AuroraButton>
        </div>
      </div>

      {error && !editorOpen && (
        <AuroraCard className="p-4">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#FCA5A5' }}>
            <AlertCircle size={14} strokeWidth={1.5} />
            {error}
          </div>
        </AuroraCard>
      )}

      {editorOpen && (
        <AuroraCard className="p-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h2 className="section-title text-base">
                {editingFrom ? `Редактирование: ${editingFrom.code}` : 'Новый промокод'}
              </h2>
              {editingFrom && (
                <span className="text-[11px] px-2 py-1 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: '#FBBF24' }}>
                  Сохранение пересоздаст код в Stripe
                </span>
              )}
            </div>

            {error && (
              <div className="rounded-xl p-3 flex items-center gap-2 text-xs"
                   style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5' }}>
                <AlertCircle size={14} strokeWidth={1.5} />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AuroraInput
                label="Код (заглавные латиница/цифры/дефис)"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SUMMER25"
                inputId="promo-code"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  Скидка (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={form.percent}
                    onChange={(e) => setForm((f) => ({ ...f, percent: parseInt(e.target.value, 10) }))}
                    className="flex-1"
                  />
                  <span className="text-lg font-700 w-14 text-right" style={{ color: 'var(--text-primary)', fontFamily: 'Geist Sans, sans-serif' }}>
                    {form.percent}%
                  </span>
                </div>
                {form.percent === 100 && (
                  <p className="text-[11px]" style={{ color: '#34D399' }}>100% = бесплатная активация тарифа</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  Длительность скидки
                </label>
                <select
                  className="aurora-input py-3 text-sm"
                  style={{ color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value as any }))}
                >
                  <option value="once">Только на первый платёж</option>
                  <option value="repeating">N месяцев подряд</option>
                  <option value="forever">Навсегда (пока активна подписка)</option>
                </select>
              </div>
              {form.duration === 'repeating' && (
                <AuroraInput
                  label="Месяцев применять скидку"
                  type="number"
                  value={String(form.durationMonths)}
                  onChange={(e) => setForm((f) => ({ ...f, durationMonths: Math.max(1, parseInt(e.target.value || '1', 10)) }))}
                  placeholder="3"
                  inputId="promo-months"
                />
              )}
              <AuroraInput
                label="Макс. использований (пусто = без лимита)"
                type="number"
                value={form.maxRedemptions}
                onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value }))}
                placeholder="100"
                inputId="promo-max"
              />
              <AuroraInput
                label="Истекает (опционально)"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                inputId="promo-expires"
              />
            </div>

            <div>
              <label className="text-xs font-700 uppercase tracking-wider block mb-2"
                     style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                На какие тарифы действует
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TIER_OPTIONS.map((opt) => {
                  const active = form.tiers.includes(opt.v);
                  return (
                    <button key={opt.v} type="button"
                            onClick={() => toggleTier(opt.v)}
                            className="text-xs px-3 py-1.5 rounded-xl font-600 transition-all"
                            style={{
                              background: active ? `${opt.color}1a` : 'var(--bg-tertiary)',
                              border: `1px solid ${active ? `${opt.color}50` : 'var(--border-medium)'}`,
                              color: active ? opt.color : 'var(--text-secondary)',
                            }}>
                      {active ? '✓ ' : ''}{opt.label}
                    </button>
                  );
                })}
                <button type="button"
                        onClick={() => setForm((f) => ({ ...f, tiers: [] }))}
                        className="text-xs px-3 py-1.5 rounded-xl font-600 transition-all"
                        style={{
                          background: form.tiers.length === 0 ? 'rgba(99,102,241,0.18)' : 'var(--bg-tertiary)',
                          border: `1px solid ${form.tiers.length === 0 ? 'rgba(99,102,241,0.50)' : 'var(--border-medium)'}`,
                          color: form.tiers.length === 0 ? 'var(--brand)' : 'var(--text-secondary)',
                        }}>
                  {form.tiers.length === 0 ? '✓ ' : ''}На все тарифы
                </button>
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {form.tiers.length === 0
                  ? 'Промокод применяется ко всем подпискам и докупкам.'
                  : `Промокод действует только на: ${form.tiers.join(', ')}.`}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <AuroraButton type="submit" disabled={submitting} icon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2} />}>
                {submitting ? 'Сохраняем…' : (editingFrom ? 'Сохранить изменения' : 'Создать промокод')}
              </AuroraButton>
              <AuroraButton variant="ghost" onClick={closeEditor} type="button">
                Отмена
              </AuroraButton>
            </div>
          </form>
        </AuroraCard>
      )}

      {/* Список */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : sortedCodes.length === 0 ? (
        <AuroraCard className="p-8 text-center">
          <Tag size={32} strokeWidth={1} className="mx-auto mb-3" style={{ color: 'var(--text-disabled)' }} />
          <p className="text-sm font-500" style={{ color: 'var(--text-muted)' }}>Промокодов пока нет</p>
        </AuroraCard>
      ) : (
        <div className="space-y-2">
          {sortedCodes.map((c) => (
            <div key={c.id} style={{ opacity: c.active ? 1 : 0.72 }}>
            <AuroraCard className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: c.active ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.04)',
                      color: c.active ? '#34D399' : 'var(--text-disabled)',
                    }}
                  >
                    <Tag size={16} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-700 font-mono" style={{ color: 'var(--text-primary)' }}>
                        {c.code}
                      </p>
                      {!c.active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-700 uppercase tracking-wider"
                              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-disabled)' }}>
                          Неактивен
                        </span>
                      )}
                      {c.appliesToTiers && c.appliesToTiers.length > 0 && c.appliesToTiers.length < 3 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-600"
                              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--brand)' }}>
                          {c.appliesToTiers.join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-0.5 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1"><Percent size={11} strokeWidth={1.5} /> {c.percentOff}%</span>
                      <span>· {c.duration}{c.duration === 'repeating' && c.durationInMonths ? ` (${c.durationInMonths}м)` : ''}</span>
                      <span>· использовано {c.timesRedeemed}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}</span>
                      {c.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} strokeWidth={1.5} />
                          до {new Date(c.expiresAt).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {c.active && (
                    <>
                      <button type="button" onClick={() => openEditFor(c)}
                              className="px-3 py-2 rounded-xl text-xs font-600 transition-colors flex items-center gap-1.5"
                              style={{
                                background: 'rgba(99,102,241,0.10)',
                                color: 'var(--brand)',
                                border: '1px solid rgba(99,102,241,0.20)',
                              }}>
                        <Pencil size={12} strokeWidth={1.5} />
                        Редактировать
                      </button>
                      <button type="button" onClick={() => handleDeactivate(c.id)}
                              className="px-3 py-2 rounded-xl text-xs font-600 transition-colors flex items-center gap-1.5"
                              style={{
                                background: 'rgba(245,158,11,0.10)',
                                color: '#FBBF24',
                                border: '1px solid rgba(245,158,11,0.20)',
                              }}>
                        <X size={12} strokeWidth={2} />
                        Деактивировать
                      </button>
                    </>
                  )}
                  {!c.active && (
                    <button type="button" onClick={() => handleReactivate(c.id)}
                            className="px-3 py-2 rounded-xl text-xs font-600 transition-colors flex items-center gap-1.5"
                            style={{
                              background: 'rgba(16,185,129,0.10)',
                              color: '#34D399',
                              border: '1px solid rgba(16,185,129,0.25)',
                            }}>
                      <RotateCcw size={12} strokeWidth={1.5} />
                      Возобновить
                    </button>
                  )}
                  <button type="button" onClick={() => handleHardDelete(c.id, c.code)}
                          className="px-3 py-2 rounded-xl text-xs font-600 transition-colors flex items-center gap-1.5"
                          style={{
                            background: 'rgba(239,68,68,0.10)',
                            color: '#FCA5A5',
                            border: '1px solid rgba(239,68,68,0.20)',
                          }}>
                    <Trash2 size={12} strokeWidth={1.5} />
                    Удалить
                  </button>
                </div>
              </div>
            </AuroraCard>
            </div>
          ))}
        </div>
      )}

      {/* In-app confirm-диалог (заменяет браузерный confirm()) */}
      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        variant="danger"
        onConfirm={() => { const cb = confirmDialog?.onConfirm; setConfirmDialog(null); cb?.(); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
