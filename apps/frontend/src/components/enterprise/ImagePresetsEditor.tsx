/**
 * ImagePresetsEditor — «Блоки обработки изображений» для раздела Quest Flow.
 *
 * Каждый блок = пресет: функция из каталога + дополнение к промту + (опц.) референс-картинки.
 * Пресет вызывается ЖЁСТКО по presetKey: владелец вставляет этот ключ в кнопку Telegram-бота
 * (HTTP-блок Quest Flow), и при нажатии VibeVox преобразует картинку именно этим пресетом.
 *
 * Модель генерации выбирается ОДИН раз в разделе «Gemini API» — здесь она показана только
 * для справки.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Save,
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  Play,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AuroraCard } from '../AuroraCard';
import { AuroraButton } from '../AuroraButton';
import { ConfirmModal } from '../ConfirmModal';
import { useAppStore } from '../../store/useAppStore';

type ImageSourceMode = 'client' | 'last_generated' | 'none';

interface ImageFunctionMeta {
  key: string;
  label: string;
  hint: string;
  needsReference: boolean;
  clientImages: number;
  defaultSource: ImageSourceMode;
  defaultIntake: string;
}

interface ImagePreset {
  presetKey: string;
  label: string;
  function: string;
  promptExtra: string;
  intakePrompt: string;
  referenceImages: string[];
  imageSource: ImageSourceMode;
  replyCaption: string;
  enabled: boolean;
}

function slugify(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

/** Рекомендуемый максимум входных картинок для выбранной модели (Pro — 14, flash — ~5). */
function maxImagesForModel(model: string): number {
  return /pro-image/i.test(model) ? 14 : 5;
}

/** Единый лимит символов для сообщений клиенту (intake / подпись) — по самому строгому каналу (IG ~1000). */
const MAX_CLIENT_MSG = 1000;

export function ImagePresetsEditor() {
  const { t } = useTranslation('common');
  const { token } = useAppStore();

  const [functions, setFunctions] = useState<ImageFunctionMeta[]>([]);
  const [presets, setPresets] = useState<ImagePreset[]>([]);
  const [model, setModel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoState, setAutoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  // Пробный прогон блока (без Telegram/комнаты), ключ — индекс блока.
  interface TestState {
    running?: boolean;
    text: string;
    files: File[];
    result?: { imageDataUrl?: string | null; error?: string; promptUsed?: string };
  }
  const [testState, setTestState] = useState<Record<number, TestState>>({});
  const getTest = (idx: number): TestState => testState[idx] || { text: '', files: [] };
  const patchTest = (idx: number, patch: Partial<TestState>) =>
    setTestState((s) => ({ ...s, [idx]: { ...getTest(idx), ...patch } }));

  const refFileInput = useRef<HTMLInputElement>(null);
  const uploadTargetIdx = useRef<number | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });
  const authHeader = (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/quest-flow/image/config', { headers: headers() });
        if (r.ok) {
          const data = await r.json();
          setFunctions(data.functions || []);
          const loaded = Array.isArray(data.presets) ? data.presets : [];
          setPresets(loaded);
          setCollapsed(new Set(loaded.map((_: any, i: number) => i))); // загруженные блоки — сразу свёрнуты в строку
          setModel(data.model || '');
        } else {
          setError(t('enterprise.imagePresets.errLoad'));
        }
      } catch (e: any) {
        setError(e?.message || t('enterprise.imagePresets.errLoad'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fnMeta = (key: string): ImageFunctionMeta | undefined => functions.find((f) => f.key === key);

  const updatePreset = (idx: number, patch: Partial<ImagePreset>) => {
    setPresets((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const toggleCollapse = (idx: number) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });

  const handleAdd = () => {
    const def = functions[0];
    if (!def) return;
    const base: ImagePreset = {
      presetKey: '',
      label: '',
      function: def.key,
      promptExtra: '',
      intakePrompt: def.defaultIntake,
      referenceImages: [],
      imageSource: def.defaultSource,
      replyCaption: '',
      enabled: true,
    };
    setPresets((prev) => [...prev, base]);
  };

  const handleChangeFunction = (idx: number, fnKey: string) => {
    const meta = fnMeta(fnKey);
    updatePreset(idx, {
      function: fnKey,
      imageSource: meta ? meta.defaultSource : 'client',
      intakePrompt: presets[idx].intakePrompt || (meta ? meta.defaultIntake : ''),
    });
  };

  const handlePickReference = (idx: number) => {
    uploadTargetIdx.current = idx;
    refFileInput.current?.click();
  };

  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = uploadTargetIdx.current;
    if (!file || idx == null) return;
    setUploadingIdx(idx);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/quest-flow/image/reference', {
        method: 'POST',
        headers: authHeader(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setPresets((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, referenceImages: [...p.referenceImages, data.url] } : p))
      );
    } catch (e: any) {
      setError(e?.message || t('enterprise.imagePresets.errUploadRef'));
    } finally {
      setUploadingIdx(null);
      uploadTargetIdx.current = null;
      if (refFileInput.current) refFileInput.current.value = '';
    }
  };

  const removeReference = (idx: number, refIdx: number) => {
    setPresets((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, referenceImages: p.referenceImages.filter((_, j) => j !== refIdx) } : p
      )
    );
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch { /* clipboard может быть недоступен */ }
  };

  // Сохранение: пишем ВЕСЬ список блоков (API сохраняет массив целиком).
  const persist = async (list: ImagePreset[] = presets): Promise<boolean> => {
    setAutoState('saving');
    setError(null);
    try {
      const normalized = list.map((p) => ({
        ...p,
        presetKey: slugify(p.presetKey), // пусто → бэкенд сгенерит ключ сам
        label: p.label || (fnMeta(p.function)?.label ?? p.function),
      }));
      const res = await fetch('/api/quest-flow/image/presets', {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ presets: normalized }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${res.status}`); }
      setAutoState('saved');
      setTimeout(() => setAutoState('idle'), 2000);
      return true;
    } catch (e: any) {
      setAutoState('error');
      setError(e?.message || t('enterprise.imagePresets.errSave'));
      return false;
    }
  };

  // Кнопка «Сохранить» в блоке: пишем все блоки и сворачиваем этот (складываем в строку).
  const saveBlock = async (idx: number) => {
    const ok = await persist();
    if (ok) setCollapsed((prev) => new Set(prev).add(idx));
  };

  const handleRunTest = async (idx: number) => {
    const preset = presets[idx];
    const st = getTest(idx);
    patchTest(idx, { running: true, result: undefined });
    try {
      const fd = new FormData();
      fd.append('preset', JSON.stringify({
        ...preset,
        presetKey: slugify(preset.presetKey || preset.label || preset.function),
      }));
      if (st.text) fd.append('text', st.text);
      (st.files || []).forEach((f) => fd.append('files', f));
      const res = await fetch('/api/quest-flow/image/test', {
        method: 'POST',
        headers: authHeader(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      patchTest(idx, {
        running: false,
        result: data.ok
          ? { imageDataUrl: data.imageDataUrl, promptUsed: data.promptUsed }
          : { error: data.error || t('enterprise.imagePresets.errSave') },
      });
    } catch (e: any) {
      patchTest(idx, { running: false, result: { error: e?.message || t('enterprise.imagePresets.errSave') } });
    }
  };

  if (loading) {
    return (
      <div className="py-6 text-center">
        <Loader2 size={18} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <AuroraCard className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon size={16} color="#ec4899" />
        <h3 className="text-sm font-700 uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          {t('enterprise.imagePresets.heading')}
        </h3>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {t('enterprise.imagePresets.lead')}
      </p>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {t('enterprise.imagePresets.modelLabel')}: <code style={{ color: 'var(--text-secondary)' }}>{model || '—'}</code>
        {' · '}{t('enterprise.imagePresets.modelHint')}
      </p>

      {error && (
        <div className="flex items-start gap-2 text-sm" style={{ color: '#ef4444' }}>
          <AlertCircle size={15} className="mt-[2px]" /> <span className="flex-1">{error}</span>
        </div>
      )}

      {presets.length === 0 && (
        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
          {t('enterprise.imagePresets.empty')}
        </p>
      )}

      <div className="space-y-4">
        {presets.map((preset, idx) => {
          const meta = fnMeta(preset.function);
          const liveKey = slugify(preset.presetKey);
          const maxRef = maxImagesForModel(model);
          return (
            <div key={idx} className="rounded-xl p-4 space-y-3"
                 style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
              {/* Row: enabled + label + delete */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => toggleCollapse(idx)} title={collapsed.has(idx) ? 'Развернуть' : 'Свернуть'}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 }}>
                  {collapsed.has(idx) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer"
                       style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={preset.enabled}
                         onChange={(e) => updatePreset(idx, { enabled: e.target.checked })} />
                  {t('enterprise.imagePresets.enabled')}
                </label>
                <input
                  type="text"
                  value={preset.label}
                  onChange={(e) => updatePreset(idx, { label: e.target.value.slice(0, 120) })}
                  placeholder={t('enterprise.imagePresets.labelPlaceholder')}
                  className="flex-1 min-w-[180px] px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-pink-400"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                />
                <button onClick={() => setConfirmDelete(idx)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(239,68,68,0.16)]"
                        style={{ color: '#ef4444' }} title={t('enterprise.imagePresets.delete')}>
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-3" style={{ display: collapsed.has(idx) ? 'none' : undefined }}>
              {/* Function dropdown */}
              <div className="space-y-1">
                <label className="text-[11px] font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t('enterprise.imagePresets.functionLabel')}
                </label>
                <select
                  value={preset.function}
                  onChange={(e) => handleChangeFunction(idx, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                >
                  {functions.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                {meta && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{meta.hint}</p>}
              </div>

              {/* preset_key (для кнопки QF) */}
              <div className="space-y-1">
                <label className="text-[11px] font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t('enterprise.imagePresets.presetKeyLabel')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={preset.presetKey}
                    onChange={(e) => updatePreset(idx, { presetKey: e.target.value })}
                    onBlur={() => updatePreset(idx, { presetKey: slugify(preset.presetKey) })}
                    placeholder={t('enterprise.imagePresets.presetKeyPlaceholder')}
                    className="flex-1 px-3 py-2 rounded-lg text-xs focus:outline-none"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}
                  />
                  <button onClick={() => handleCopyKey(liveKey)}
                          className="px-2 py-2 rounded-lg text-xs font-600"
                          style={{ background: copiedKey === liveKey ? 'rgba(16,185,129,0.18)' : 'var(--bg-secondary)', color: copiedKey === liveKey ? '#10b981' : 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}
                          title={t('enterprise.imagePresets.copyKey')}>
                    {copiedKey === liveKey ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {t('enterprise.imagePresets.presetKeyHint', 'Необязательно — оставьте пустым, ключ создастся автоматически. Нужен, только если вставляете его в кнопку Quest Flow.')}
                </p>
              </div>

              {/* Prompt extra */}
              <div className="space-y-1">
                <label className="text-[11px] font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t('enterprise.imagePresets.promptExtraLabel')}
                </label>
                <textarea
                  value={preset.promptExtra}
                  onChange={(e) => updatePreset(idx, { promptExtra: e.target.value.slice(0, 8000) })}
                  placeholder={t('enterprise.imagePresets.promptExtraPlaceholder')}
                  rows={2}
                  className="w-full p-3 rounded-lg text-sm leading-relaxed focus:outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Intake prompt */}
              <div className="space-y-1">
                <label className="text-[11px] font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t('enterprise.imagePresets.intakeLabel')}
                </label>
                <input
                  type="text"
                  value={preset.intakePrompt}
                  onChange={(e) => updatePreset(idx, { intakePrompt: e.target.value.slice(0, MAX_CLIENT_MSG) })}
                  placeholder={t('enterprise.imagePresets.intakePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                />
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {t('enterprise.imagePresets.intakeHint', 'Что бот напишет клиенту, дойдя до этого блока — попросит нужные данные (напр. «Пришлите фото в полный рост»).')}
                </p>
                <div className="text-[10px] text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{preset.intakePrompt.length} / {MAX_CLIENT_MSG}</div>
              </div>

              {/* Reply caption */}
              <div className="space-y-1">
                <label className="text-[11px] font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t('enterprise.imagePresets.replyCaptionLabel')}
                </label>
                <input
                  type="text"
                  value={preset.replyCaption}
                  onChange={(e) => updatePreset(idx, { replyCaption: e.target.value.slice(0, MAX_CLIENT_MSG) })}
                  placeholder={t('enterprise.imagePresets.replyCaptionPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                />
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {t('enterprise.imagePresets.replyCaptionHint', 'Подпись, которая уйдёт клиенту вместе с готовой картинкой (можно оставить пустым).')}
                </p>
                <div className="text-[10px] text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{preset.replyCaption.length} / {MAX_CLIENT_MSG}</div>
              </div>

              {/* Reference images — только для функций, которым нужен референс */}
              {meta?.needsReference && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {t('enterprise.imagePresets.referenceLabel')}
                  </label>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {t('enterprise.imagePresets.referenceHint')}{' '}
                    {t('enterprise.imagePresets.referenceMaxHint', { max: maxRef })}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {preset.referenceImages.map((url, refIdx) => (
                      <div key={refIdx} className="relative">
                        <img src={url} alt="ref"
                             className="w-16 h-16 object-cover rounded-lg"
                             style={{ border: '1px solid var(--border-medium)' }} />
                        <button onClick={() => removeReference(idx, refIdx)}
                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: '#ef4444', color: '#fff' }}
                                title={t('enterprise.imagePresets.removeReference')}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                    {preset.referenceImages.length < maxRef && (
                      <button onClick={() => handlePickReference(idx)} disabled={uploadingIdx === idx}
                              className="w-16 h-16 rounded-lg flex items-center justify-center transition-colors"
                              style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-medium)', color: 'var(--text-muted)' }}
                              title={t('enterprise.imagePresets.uploadReference')}>
                        {uploadingIdx === idx ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Пробный прогон блока — без Telegram/комнаты */}
              <div className="space-y-2 pt-3" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
                <label className="text-[11px] font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t('enterprise.imagePresets.testLabel')}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="file" multiple accept="image/*"
                         onChange={(e) => patchTest(idx, { files: Array.from(e.target.files || []) })}
                         className="text-xs max-w-[220px]" style={{ color: 'var(--text-muted)' }} />
                  <input type="text" value={getTest(idx).text}
                         onChange={(e) => patchTest(idx, { text: e.target.value })}
                         placeholder={t('enterprise.imagePresets.testTextPlaceholder')}
                         className="flex-1 min-w-[160px] px-3 py-2 rounded-lg text-sm focus:outline-none"
                         style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  <AuroraButton onClick={() => handleRunTest(idx)} disabled={getTest(idx).running}
                               icon={getTest(idx).running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}>
                    {getTest(idx).running ? t('enterprise.imagePresets.testing') : t('enterprise.imagePresets.test')}
                  </AuroraButton>
                </div>
                {getTest(idx).result?.error && (
                  <div className="flex items-start gap-1.5 text-xs" style={{ color: '#ef4444' }}>
                    <AlertCircle size={13} className="mt-[2px]" /> <span className="flex-1">{getTest(idx).result!.error}</span>
                  </div>
                )}
                {getTest(idx).result?.imageDataUrl && (
                  <div className="space-y-1">
                    <img src={getTest(idx).result!.imageDataUrl as string} alt="result"
                         className="rounded-lg" style={{ maxHeight: 320, maxWidth: '100%', border: '1px solid var(--border-medium)' }} />
                    {getTest(idx).result?.promptUsed && (
                      <details className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <summary className="cursor-pointer">{t('enterprise.imagePresets.testPromptUsed')}</summary>
                        <pre className="whitespace-pre-wrap mt-1" style={{ fontFamily: 'ui-monospace, monospace' }}>{getTest(idx).result!.promptUsed}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-1">
                <AuroraButton onClick={() => saveBlock(idx)} disabled={autoState === 'saving'}
                             icon={autoState === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}>
                  {t('enterprise.imagePresets.save')}
                </AuroraButton>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <button onClick={handleAdd}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-600 transition-colors"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
          <Plus size={15} /> {t('enterprise.imagePresets.addBlock')}
        </button>
        <span className="text-xs flex items-center gap-1.5" style={{ color: autoState === 'error' ? '#ef4444' : 'var(--text-muted)' }}>
          {autoState === 'saving' ? <><Loader2 size={13} className="animate-spin" /> {t('enterprise.imagePresets.saving')}</>
            : autoState === 'saved' ? <><CheckCircle2 size={13} color="#10b981" /> {t('enterprise.imagePresets.saved')}</>
            : autoState === 'error' ? <><AlertCircle size={13} /> {t('enterprise.imagePresets.errSave')}</>
            : t('enterprise.imagePresets.perBlockSaveHint', 'Сохраняйте каждый блок его кнопкой «Сохранить»')}
        </span>
      </div>

      <input ref={refFileInput} type="file" accept="image/*" onChange={handleUploadReference} className="hidden" />

      <ConfirmModal
        open={confirmDelete !== null}
        title={t('enterprise.imagePresets.confirmDeleteTitle')}
        message={t('enterprise.imagePresets.confirmDeleteBody')}
        confirmLabel={t('enterprise.imagePresets.delete')}
        variant="danger"
        onConfirm={() => {
          const idx = confirmDelete;
          setConfirmDelete(null);
          if (idx !== null) {
            const next = presets.filter((_, i) => i !== idx);
            setPresets(next);
            void persist(next); // удаление сразу пишется
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </AuroraCard>
  );
}

export default ImagePresetsEditor;
