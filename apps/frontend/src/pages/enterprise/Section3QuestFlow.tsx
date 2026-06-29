/**
 * Section3QuestFlow → вкладка «AI».
 *
 * Фоновый ИИ + контент для ВСЕХ каналов (не только Telegram):
 *  1. Промт ИИ-диалогов  2. База знаний  3. Теги потребностей  4. Блоки обработки изображений
 *
 * API-ключи Quest Flow вынесены в раздел «API» (QuestFlowKeysEditor).
 * Раскладка: промт / база / теги — три колонки; блоки картинок — отдельной строкой.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Workflow, Loader2, Trash2, AlertCircle, CheckCircle2, Save, Upload, FileText, Tag as TagIcon,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { ConfirmModal } from '../../components/ConfirmModal';
import { TagsEditor } from '../../components/enterprise/TagsEditor';
import { ImagePresetsEditor } from '../../components/enterprise/ImagePresetsEditor';
import { useAppStore } from '../../store/useAppStore';

export function Section3QuestFlow() {
  const { t } = useTranslation('common');
  const { token } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);

  // Prompt + KB
  const [qfPrompt, setQfPrompt] = useState('');
  const [qfKb, setQfKb] = useState('');
  const [qfKbFilename, setQfKbFilename] = useState<string | null>(null);
  const [defaultQfPrompt, setDefaultQfPrompt] = useState<string>('');
  const [promptLoading, setPromptLoading] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [uploadingKb, setUploadingKb] = useState(false);

  // Common
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmLabel: string; onConfirm: () => void;
  } | null>(null);

  // Авто-рост textarea промта по содержимому
  const qfPromptRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const ta = qfPromptRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [qfPrompt]);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  const authHeader = (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

  // ── Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [p, d] = await Promise.all([
          fetch('/api/quest-flow/prompt', { headers: headers() }),
          fetch('/api/quest-flow/prompt/default-system-prompt', { headers: headers() }),
        ]);
        if (p.ok) {
          const data = await p.json();
          setQfPrompt(data.prompt || '');
          setQfKb(data.knowledgeBase || '');
          setQfKbFilename(data.kbFilename || null);
        }
        if (d.ok) {
          const data = await d.json();
          setDefaultQfPrompt(data.defaultPrompt || '');
        }
      } catch (e: any) {
        setError(e?.message || t('enterprise.questFlow.errLoad'));
      } finally {
        setPromptLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Prompt ───────────────────────────────────────────────────────
  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/quest-flow/prompt', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ prompt: qfPrompt.slice(0, 40_000) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      setSuccess(t('enterprise.questFlow.successPromptSaved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || t('enterprise.questFlow.errSave'));
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleUploadKb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingKb(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/quest-flow/prompt/upload', {
        method: 'POST',
        headers: authHeader(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setQfKbFilename(data.filename);
      const r = await fetch('/api/quest-flow/prompt', { headers: headers() });
      if (r.ok) {
        const d = await r.json();
        setQfKb(d.knowledgeBase || '');
      }
      setSuccess(t('enterprise.questFlow.successFileUploaded', {
        filename: data.filename,
        kbLength: data.kbLength.toLocaleString(),
      }));
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e?.message || t('enterprise.questFlow.errUpload'));
    } finally {
      setUploadingKb(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleClearKb = () => {
    setConfirmDialog({
      title: t('enterprise.questFlow.confirmKbDeleteTitle'),
      message: t('enterprise.questFlow.confirmKbDeleteBody'),
      confirmLabel: t('enterprise.questFlow.confirmKbDeleteCta'),
      onConfirm: async () => {
        try {
          const res = await fetch('/api/quest-flow/prompt/kb', { method: 'DELETE', headers: headers() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setQfKb('');
          setQfKbFilename(null);
          setSuccess(t('enterprise.questFlow.successKbCleared'));
          setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
          setError(e?.message || t('enterprise.common.genericError'));
        }
      },
    });
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
          <Workflow size={20} color="#fff" />
        </div>
        <div>
          <h2 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>
            {t('enterprise.questFlow.aiHeading', 'ИИ-ассистент')}
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('enterprise.questFlow.aiLead', 'Промт, база знаний, теги и обработка картинок — общие для всех каналов.')}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <AuroraCard className="p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} color="#10b981" />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{success}</span>
          </div>
        </AuroraCard>
      )}
      {error && (
        <AuroraCard className="p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} color="#ef4444" className="mt-[2px]" />
            <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        </AuroraCard>
      )}

      {/* Строка 1: Промт (2 колонки) + База знаний (1 колонка) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ──── ПРОМТ (две колонки) ──── */}
        <AuroraCard className="lg:col-span-2 p-5 space-y-3">
          <h3 className="text-sm font-700 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('enterprise.questFlow.promptHeading')}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('enterprise.questFlow.promptLead1')}
            <b> {t('enterprise.questFlow.promptLeadBold1')}</b> {t('enterprise.questFlow.promptLead2')}
            <b> {t('enterprise.questFlow.promptLeadBold2')}</b> {t('enterprise.questFlow.promptLead3')}
          </p>

          {defaultQfPrompt && (
            <details className="rounded-xl"
                     style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <summary className="text-xs cursor-pointer font-600 px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                {t('enterprise.questFlow.defaultSummary')}
              </summary>
              <pre className="px-3 pb-3 text-[11px] leading-relaxed whitespace-pre-wrap"
                   style={{ color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace' }}>
{defaultQfPrompt}
              </pre>
            </details>
          )}

          {promptLoading ? (
            <div className="py-4 text-center"><Loader2 size={18} className="animate-spin inline-block" /></div>
          ) : (
            <>
              <textarea
                ref={qfPromptRef}
                value={qfPrompt}
                onChange={(e) => setQfPrompt(e.target.value.slice(0, 40_000))}
                placeholder={t('enterprise.questFlow.promptPlaceholder')}
                rows={6}
                className="w-full min-h-[160px] p-3 rounded-xl text-sm leading-relaxed focus:outline-none focus:border-cyan-400 overflow-hidden"
                style={{
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace', resize: 'none',
                }}
              />
              <div className="flex justify-between items-center">
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {qfPrompt.length.toLocaleString()} / 40 000
                </span>
                <AuroraButton onClick={handleSavePrompt} disabled={savingPrompt}
                             icon={savingPrompt ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}>
                  {savingPrompt ? t('enterprise.questFlow.savingPromptLabel') : t('enterprise.questFlow.savePromptLabel')}
                </AuroraButton>
              </div>
            </>
          )}
        </AuroraCard>

        {/* ──── БАЗА ЗНАНИЙ ──── */}
        <AuroraCard className="p-5 space-y-3">
          <h3 className="text-sm font-700 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('enterprise.questFlow.kbHeadingV2', 'База знаний')}
          </h3>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('enterprise.questFlow.kbLeadV2', 'Документы — каталог услуг, прайс, FAQ. Загружайте TXT / Word / Excel / CSV. Если пусто — ИИ отвечает только из общих знаний. Лимит: 50 МБ файл / 500 000 символов.')}
          </p>

          {qfKbFilename && qfKb && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                 style={{ background: 'rgba(6, 182, 212, 0.10)', border: '1px solid rgba(6, 182, 212, 0.30)' }}>
              <FileText size={14} color="#06b6d4" />
              <span className="text-xs flex-1 truncate" style={{ color: '#06b6d4' }}>
                <b>{qfKbFilename}</b> · {qfKb.length.toLocaleString()} {t('enterprise.questFlow.kbCharsSuffix')}
              </span>
              <button onClick={handleClearKb}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(239,68,68,0.16)]"
                      style={{ color: '#ef4444' }} title={t('enterprise.questFlow.kbDeleteTitle')}>
                <Trash2 size={13} />
              </button>
            </div>
          )}

          <div>
            <input ref={fileRef} type="file"
                   accept=".txt,.docx,.xlsx,.xls,.csv,text/plain,text/csv"
                   onChange={handleUploadKb} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={uploadingKb}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-600 transition-colors disabled:opacity-60"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
              {uploadingKb ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>{uploadingKb ? t('enterprise.questFlow.kbUploading') : (qfKb ? t('enterprise.questFlow.kbReplaceFile') : t('enterprise.questFlow.kbUploadFile'))}</span>
            </button>
          </div>
        </AuroraCard>
      </div>

      {/* Строка 2: Теги потребностей + Блоки обработки изображений (по половине) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ──── ТЕГИ ──── */}
        <AuroraCard className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TagIcon size={16} color="var(--brand)" />
            <h3 className="text-sm font-700 uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {t('enterprise.questFlow.tagsHeading')}
            </h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('enterprise.questFlow.tagsLead')}
          </p>
          <TagsEditor />
        </AuroraCard>

        {/* ──── Блоки обработки изображений (половина строки) ──── */}
        <ImagePresetsEditor />
      </div>

      {/* In-app confirm-диалог (заменяет браузерный confirm()) */}
      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel || t('confirmModal.confirm')}
        variant="danger"
        onConfirm={() => {
          const cb = confirmDialog?.onConfirm;
          setConfirmDialog(null);
          cb?.();
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}

export default Section3QuestFlow;
