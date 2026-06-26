/**
 * Section2Prompt — Раздел 2 страницы EnterpriseSettings.
 *
 * Кастомный prompt владельца + база знаний (TXT/DOCX/XLSX/CSV).
 * Также показывает список preset-тонов (для справки — реально используются в чате Enterprise-комнаты).
 *
 * Расширяет существующий /assistant-prompt UX:
 *  - Загрузка не только TXT — теперь и Word, Excel, CSV
 *  - Парсинг происходит на сервере (POST /api/tenant-prompt/upload)
 *  - Кнопка "Синхронизировать" подтверждает что данные доступны для bridge
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Upload,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  BrainCircuit,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAppStore } from '../../store/useAppStore';

const MAX_PROMPT_LEN = 40_000;
const MAX_KB_LEN = 500_000;

interface Preset {
  key: string;
  label: string;
  description: string;
}

export function Section2Prompt() {
  const { t } = useTranslation('common');
  const { token } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customPrompt, setCustomPrompt] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [knowledgeBaseFilename, setKnowledgeBaseFilename] = useState<string | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState<string>('');
  // Sync-блок удалён в v0.10.14 — см. ниже

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Кастомный confirm-диалог (вместо браузерного confirm())
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message?: React.ReactNode;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  const authHeader = (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

  // ── Initial load ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [main, p, d] = await Promise.all([
          fetch('/api/tenant-prompt', { headers: headers() }),
          fetch('/api/tenant-prompt/presets', { headers: headers() }),
          fetch('/api/tenant-prompt/default-system-prompt', { headers: headers() }),
        ]);
        if (main.ok) {
          const data = await main.json();
          setCustomPrompt(data.customPrompt || '');
          setKnowledgeBase(data.knowledgeBase || '');
          setKnowledgeBaseFilename(data.knowledgeBaseFilename || null);
        }
        if (p.ok) {
          const data = await p.json();
          setPresets(data.presets || []);
        }
        if (d.ok) {
          const data = await d.json();
          setDefaultSystemPrompt(data.defaultPrompt || '');
        }
      } catch (e: any) {
        setError(e?.message || t('enterprise.prompt.errLoadSettings'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save prompt ──────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/tenant-prompt', {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          customPrompt: customPrompt.slice(0, MAX_PROMPT_LEN),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setSuccess(t('enterprise.prompt.successPromptSaved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e?.message || t('enterprise.prompt.errSave'));
    } finally {
      setSaving(false);
    }
  };

  // ── Upload file (server-side parse) ──────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/tenant-prompt/upload', {
        method: 'POST',
        headers: authHeader(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setKnowledgeBaseFilename(data.filename);
      // Re-fetch KB to get full content (upload returns only preview)
      const r = await fetch('/api/tenant-prompt', { headers: headers() });
      if (r.ok) {
        const d = await r.json();
        setKnowledgeBase(d.knowledgeBase || '');
      }
      const formatLabel = ({ docx: 'Word', xlsx: 'Excel', csv: 'CSV', txt: 'TXT' } as any)[data.format] || data.format;
      setSuccess(
        t('enterprise.prompt.successFileUploaded', {
          filename: data.filename,
          format: formatLabel,
          kbLength: data.kbLength.toLocaleString(),
        }) +
        (data.truncated ? t('enterprise.prompt.successFileTruncated', { max: MAX_KB_LEN.toLocaleString() }) : '')
      );
      setTimeout(() => setSuccess(null), 6000);
    } catch (err: any) {
      setError(err?.message || t('enterprise.prompt.errLoadFile'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearKB = () => {
    setConfirmDialog({
      title: t('enterprise.prompt.confirmKbDeleteTitle'),
      message: t('enterprise.prompt.confirmKbDeleteBody'),
      confirmLabel: t('enterprise.prompt.confirmKbDeleteCta'),
      onConfirm: async () => {
        setSaving(true);
        try {
          const res = await fetch('/api/tenant-prompt/kb', { method: 'DELETE', headers: headers() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setKnowledgeBase('');
          setKnowledgeBaseFilename(null);
          setSuccess(t('enterprise.prompt.successKbCleared'));
          setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
          setError(e?.message || t('enterprise.prompt.errClearKb'));
        } finally {
          setSaving(false);
        }
      },
    });
  };

  // handleSync удалён в v0.10.14 — Save сам подтверждает что данные в БД

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
          <BrainCircuit size={20} color="#fff" />
        </div>
        <div>
          <h2 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>
            {t('enterprise.prompt.heading')}
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('enterprise.prompt.headerLeadPart1')} <b>{t('enterprise.prompt.headerLeadBold1')}</b> {t('enterprise.prompt.headerLeadPart2')} <b>{t('enterprise.prompt.headerLeadBold2')}</b>{t('enterprise.prompt.headerLeadPart3')}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <AuroraCard className="p-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} color="#10b981" />
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{success}</span>
          </div>
        </AuroraCard>
      )}
      {error && (
        <AuroraCard className="p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} color="#ef4444" className="mt-[2px] flex-shrink-0" />
            <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              <X size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        </AuroraCard>
      )}

      {/* Custom prompt */}
      <AuroraCard className="p-5">
        <div className="flex items-baseline justify-between mb-2 gap-3">
          <h3 className="text-sm font-700 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('enterprise.prompt.contextHeading')}
          </h3>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {customPrompt.length.toLocaleString()} / {MAX_PROMPT_LEN.toLocaleString()}
          </span>
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('enterprise.prompt.contextLeadPart1')}
          <b> {t('enterprise.prompt.contextLeadBold')}</b>{t('enterprise.prompt.contextLeadPart2')}
        </p>

        {/* Дефолтный системный промт — для понимания «что мы используем сейчас» */}
        {defaultSystemPrompt && (
          <details className="mb-3 rounded-xl"
                   style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
            <summary className="text-xs cursor-pointer font-600 px-3 py-2"
                     style={{ color: 'var(--text-muted)' }}>
              {t('enterprise.prompt.defaultSummary')}
            </summary>
            <pre className="px-3 pb-3 text-[11px] leading-relaxed whitespace-pre-wrap"
                 style={{ color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace' }}>
{defaultSystemPrompt}
            </pre>
          </details>
        )}

        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
          <b>{t('enterprise.prompt.extendNoteBold')}</b> {t('enterprise.prompt.extendNoteText')}
        </p>

        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value.slice(0, MAX_PROMPT_LEN))}
          placeholder={t('enterprise.prompt.promptPlaceholder')}
          className="w-full min-h-[160px] p-3 rounded-xl text-sm leading-relaxed resize-y transition-colors focus:outline-none focus:border-violet-400"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        />
        <div className="flex justify-end mt-3">
          <AuroraButton onClick={handleSave} disabled={saving}
                       icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}>
            {saving ? t('enterprise.prompt.savingPromptLabel') : t('enterprise.prompt.savePromptLabel')}
          </AuroraButton>
        </div>
      </AuroraCard>

      {/* Knowledge base */}
      <AuroraCard className="p-5">
        <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
          <h3 className="text-sm font-700 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {t('enterprise.prompt.kbHeading')}
          </h3>
          <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {knowledgeBase.length.toLocaleString()} / {MAX_KB_LEN.toLocaleString()}
          </span>
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('enterprise.prompt.kbLead')}
        </p>

        {knowledgeBaseFilename && knowledgeBase && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
               style={{ background: 'rgba(34, 211, 238, 0.10)', border: '1px solid rgba(34, 211, 238, 0.30)' }}>
            <FileText size={14} color="#22d3ee" />
            <span className="text-xs flex-1 truncate" style={{ color: '#22d3ee' }}>
              <b>{knowledgeBaseFilename}</b> · {knowledgeBase.length.toLocaleString()} {t('enterprise.prompt.kbCharsSuffix')}
            </span>
            <button type="button" onClick={handleClearKB} disabled={saving}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(239,68,68,0.16)]"
                    style={{ color: '#ef4444' }}
                    title={t('enterprise.prompt.kbDeleteTitle')}>
              <Trash2 size={14} />
            </button>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx,.xlsx,.xls,.csv,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-600 transition-colors disabled:opacity-60"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <span>{uploading ? t('enterprise.prompt.kbUploading') : (knowledgeBase ? t('enterprise.prompt.kbReplaceFile') : t('enterprise.prompt.kbUploadFile'))}</span>
          </button>
        </div>

        {knowledgeBase && (
          <details className="mt-3">
            <summary className="text-xs cursor-pointer font-600" style={{ color: 'var(--text-muted)' }}>
              {t('enterprise.prompt.kbPreviewSummary')}
            </summary>
            <pre className="mt-2 p-3 rounded-xl text-[10px] leading-relaxed overflow-auto max-h-40"
                 style={{
                   background: 'var(--bg-tertiary)',
                   border: '1px solid var(--border-subtle)',
                   color: 'var(--text-secondary)',
                   fontFamily: 'ui-monospace, monospace',
                   whiteSpace: 'pre-wrap',
                 }}>
              {knowledgeBase.slice(0, 500)}{knowledgeBase.length > 500 ? '…' : ''}
            </pre>
          </details>
        )}
      </AuroraCard>

      {/* Sync-блок удалён в v0.10.14 — кнопки «Сохранить промт» и «Загрузить файл»
          сами по себе подтверждают что данные в БД. Отдельная Синхронизация была избыточной. */}

      {/* Presets reference */}
      {presets.length > 0 && (
        <AuroraCard className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} color="#8B5CF6" />
            <h3 className="text-sm font-700 uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {t('enterprise.prompt.presetsHeading')}
            </h3>
          </div>
          <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('enterprise.prompt.presetsLeadPart1')} <b>{t('enterprise.prompt.presetsLeadBold')}</b> {t('enterprise.prompt.presetsLeadPart2')}
          </p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <div key={p.key}
                   className="px-3 py-1.5 rounded-full text-xs font-600"
                   title={p.description}
                   style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
                {p.label}
              </div>
            ))}
          </div>
        </AuroraCard>
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

export default Section2Prompt;
