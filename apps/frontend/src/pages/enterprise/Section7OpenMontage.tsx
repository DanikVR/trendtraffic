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
import { useTranslation } from 'react-i18next';
import { Wand2, Save, Loader2, CheckCircle2, XCircle, AlertTriangle, Trash2, ExternalLink, Download, ChevronDown, ChevronUp, Clapperboard, HelpCircle } from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ApiKeyField } from '../../components/enterprise/ApiKeyField';
import { useAppStore } from '../../store/useAppStore';
import { TT_EXT_VERSION } from '../../components/AppVersion';

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
  const { t } = useTranslation('common');
  const base = 'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-600';
  if (!p.hasKey) return <span className={base} style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>{t('sec.ent.keys.statusNotSet', 'Не задан')}</span>;
  if (p.status === 'active') return <span className={base} style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}><CheckCircle2 size={12} /> {t('sec.ent.keys.statusActive', 'Активен')}</span>;
  if (p.status === 'invalid') return <span className={base} style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}><XCircle size={12} /> {t('sec.ent.keys.statusInvalid', 'Невалиден')}</span>;
  if (p.status === 'quota_exceeded') return <span className={base} style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}><AlertTriangle size={12} /> {t('sec.ent.keys.statusQuota', 'Нет баланса')}</span>;
  if (p.status === 'unknown') return <span className={base} style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>{t('sec.ent.keys.statusSavedUnchecked', 'Сохранён (без проверки)')}</span>;
  return <span className={base} style={{ background: 'rgba(148,163,184,0.10)', color: 'var(--text-muted)' }}>{t('sec.ent.keys.statusUnchecked', 'Не проверен')}</span>;
}

function ProviderCard({ p, token, onChanged }: { p: ProviderInfo; token: string | null; onChanged: (id: string, info: Partial<ProviderInfo>) => void }) {
  const { t } = useTranslation('common');
  const [keyInput, setKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const flash = (type: 'ok' | 'err', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 6000); };

  const save = async () => {
    if (!keyInput.trim()) { flash('err', t('sec.ent.keys.errEnterKey', 'Введите ключ')); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/tenant-settings/provider-keys/${p.id}`, {
        method: 'PUT', headers: authHeaders(token), body: JSON.stringify({ apiKey: keyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onChanged(p.id, data);
      setKeyInput('');
      flash('ok', data.validation?.message || t('sec.ent.keys.keySaved', 'Ключ сохранён'));
    } catch (e: any) { flash('err', e?.message || t('sec.ent.keys.genericError', 'Ошибка')); }
    finally { setSaving(false); }
  };

  const validate = async () => {
    setValidating(true);
    try {
      const res = await fetch(`/api/tenant-settings/provider-keys/${p.id}/validate`, { method: 'POST', headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onChanged(p.id, data);
      flash(data.validation?.ok ? 'ok' : 'err', data.validation?.message || t('sec.ent.keys.checkDone', 'Проверка выполнена'));
    } catch (e: any) { flash('err', e?.message || t('sec.ent.keys.genericError', 'Ошибка')); }
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
      flash('ok', t('sec.ent.keys.keyDeleted', 'Ключ удалён'));
    } catch (e: any) { flash('err', e?.message || t('sec.ent.keys.genericError', 'Ошибка')); }
    finally { setDeleting(false); }
  };

  return (
    <AuroraCard className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="text-sm font-700 truncate" style={{ color: 'var(--text-primary)' }}>{p.label}</div>
          {p.help && (
            <a href={p.help} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-accent, #ec4899)' }}>
              {t('sec.ent.keys.whereToGet', 'где взять ключ')} <ExternalLink size={10} />
            </a>
          )}
        </div>
        <StatusPill p={p} />
      </div>

      <ApiKeyField value={keyInput} onChange={setKeyInput} hasSaved={p.hasKey} savedPrefix={p.prefix} placeholder={t('sec.ent.keys.pasteKeyPh', 'вставьте ключ...')} showCopyButton={false} />

      {p.lastCheckAt && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('sec.ent.keys.lastCheckLabel', 'Проверка:')} {new Date(p.lastCheckAt).toLocaleString()}</p>
      )}
      {msg && (
        <p className="text-[12px]" style={{ color: msg.type === 'ok' ? '#10b981' : '#ef4444' }}>{msg.text}</p>
      )}

      <div className="flex gap-2 flex-wrap">
        <AuroraButton onClick={save} disabled={saving || !keyInput.trim()} icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
          {saving ? '...' : t('sec.ent.keys.saveBtn', 'Сохранить')}
        </AuroraButton>
        {p.hasKey && (
          <>
            <AuroraButton variant="secondary" onClick={validate} disabled={validating} icon={validating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}>
              {validating ? '...' : t('sec.ent.keys.validateBtn', 'Проверить')}
            </AuroraButton>
            <AuroraButton variant="secondary" onClick={() => setConfirmOpen(true)} disabled={deleting} icon={deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}>
              {t('sec.ent.keys.deleteBtn', 'Удалить')}
            </AuroraButton>
          </>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={t('sec.ent.keys.confirmDeleteTitle', 'Удалить ключ {{label}}?', { label: p.label })}
        message={t('sec.ent.keys.confirmDeleteBody', 'Рендер от имени этого тенанта перестанет использовать этот провайдер.')}
        confirmLabel={t('sec.ent.keys.deleteBtn', 'Удалить')}
        variant="danger"
        onConfirm={del}
        onCancel={() => setConfirmOpen(false)}
      />
    </AuroraCard>
  );
}

/** Карточка «Скачать единое Chrome-расширение TrendTraffic» (Flow + NotebookLM) + версия +
 *  инструкция. Страница настроек = «энциклопедия»: отсюда всегда качается свежая версия. */
function TtExtensionCard() {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  return (
    <AuroraCard className="p-4 space-y-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#22d3ee)' }}>
          <Clapperboard size={18} color="#fff" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.ent.ext.cardTitle', 'Расширение TrendTraffic для Google (Flow + NotebookLM)')}</span>
            <span className="text-[11px] font-700 px-2 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>v{TT_EXT_VERSION}</span>
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {t('sec.ent.ext.lead1', 'Одно расширение — работает и на')} <b>Google Flow</b> {t('sec.ent.ext.lead2', '(Veo: очередь промптов + обмен видео/картинками с Галереей), и на')} <b>Google NotebookLM</b> {t('sec.ent.ext.lead3', '(блок «Hotebook»: источники, чат, генерация артефактов → Галерея). Ставится один раз, подключается автоматически, пока вы залогинены здесь.')}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <a href="/trendtraffic-extension.zip" download
          className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2 rounded-xl"
          style={{ background: '#6366f1', color: '#fff', textDecoration: 'none' }}>
          <Download size={15} /> {t('sec.ent.ext.downloadBtn', 'Скачать расширение')}
        </a>
        <button onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          <HelpCircle size={15} /> {t('sec.ent.ext.howToInstall', 'Как установить')} {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <div className="text-[12.5px] leading-relaxed rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
          <ol className="list-decimal ml-4 space-y-1.5">
            <li>{t('sec.ent.ext.step1a', 'Скачайте')} <b>.zip</b> {t('sec.ent.ext.step1b', '(кнопка выше) и распакуйте в отдельную папку.')}</li>
            <li>{t('sec.ent.ext.step2a', 'Откройте')} <code>chrome://extensions</code> {t('sec.ent.ext.step2b', '→ включите «Режим разработчика» (справа сверху).')}</li>
            <li>{t('sec.ent.ext.step3a', 'Нажмите')} <b>{t('sec.ent.ext.step3b', '«Загрузить распакованное»')}</b> {t('sec.ent.ext.step3c', '→ выберите папку с расширением.')}</li>
            <li>{t('sec.ent.ext.step4', 'Если раньше стояло отдельное расширение «Google Flow» — удалите его (иначе задачи Flow задвоятся).')}</li>
            <li>{t('sec.ent.ext.step5a', 'Откройте нужный сайт и войдите в свой Google:')} <b>labs.google/flow</b> {t('sec.ent.ext.step5b', '(для «Google Flow») или')} <b>notebooklm.google.com</b> {t('sec.ent.ext.step5c', '(для «Hotebook»). Справа снизу появится панель — когда «бежит лента», всё работает.')}</li>
            <li>{t('sec.ent.ext.step6a', 'Готово.')} <b>{t('sec.ent.ext.step6b', 'Подключение автоматическое')}</b>{t('sec.ent.ext.step6c', ', пока вы залогинены в TrendTraffic — кнопку «Подключить» жать не нужно.')}</li>
          </ol>
          <p className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
            <b>{t('sec.ent.ext.updateA', 'Обновление версии:')}</b> {t('sec.ent.ext.updateB', 'удалите старую карточку в')} <code>chrome://extensions</code>{t('sec.ent.ext.updateC', ', повторите с новым .zip, затем обновите вкладку app.trendtraffic.pro (F5).')}
          </p>
        </div>
      )}
    </AuroraCard>
  );
}

export function Section7OpenMontage() {
  const { t } = useTranslation('common');
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
        setError(e?.message || t('sec.ent.keys.errLoad', 'Не удалось загрузить'));
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
          <h2 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.ent.keys.heading', 'Ключи генерации')}</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('sec.ent.keys.lead', 'Ваши ключи платных/облачных шагов рендера (ИИ-видео, картинки, озвучка, аватары). Бесплатная CPU-цепочка ключей не требует.')}
          </p>
        </div>
      </div>

      <TtExtensionCard />

      {isSuperadmin && (
        <AuroraCard className="p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} color="#f59e0b" className="mt-[2px]" />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('sec.ent.keys.saNotice1', 'Вы суперадмин — эти ключи задаёт')} <b>{t('sec.ent.keys.saNotice2', 'Enterprise-тенант')}</b> {t('sec.ent.keys.saNotice3', 'у себя. У суперадмина нет tenant-аккаунта, поэтому сохранение здесь недоступно.')}
            </span>
          </div>
        </AuroraCard>
      )}
      {error && (
        <AuroraCard className="p-3"><div className="flex items-start gap-2"><XCircle size={16} color="#ef4444" className="mt-[2px]" /><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{error}</span></div></AuroraCard>
      )}

      {llm.length > 0 && (
        <div>
          <h3 className="text-xs font-700 uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{t('sec.ent.keys.groupLlm', 'ИИ-режиссёр (ЛЛМ)')}</h3>
          <p className="text-[12px] mb-2" style={{ color: 'var(--text-muted)' }}>
            {t('sec.ent.keys.groupLlmHint', '«Мозг» умных шагов сценария — ресёрч, выбор лучшего момента, генерация сценария и новостей. Модель по умолчанию — Claude Opus 4.8 (выбор модели — при настройке ✨ЛЛМ-узлов). Базовый монтаж (обрезка/формат/субтитры/экспорт) этого ключа НЕ требует.')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {llm.map((p) => <ProviderCard key={p.id} p={p} token={token} onChanged={onChanged} />)}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-700 uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{t('sec.ent.keys.groupPaid', 'Платные провайдеры')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {paid.map((p) => <ProviderCard key={p.id} p={p} token={token} onChanged={onChanged} />)}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-700 uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{t('sec.ent.keys.groupStock', 'Бесплатные сток-источники')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stock.map((p) => <ProviderCard key={p.id} p={p} token={token} onChanged={onChanged} />)}
        </div>
      </div>
    </div>
  );
}

export default Section7OpenMontage;
