/**
 * TranscribePanel — «Транскрибация речи» проанализированного ролика.
 *
 * Один блок для ОБЕИХ панелей аналитики: нативной (TrendAnalyticsPanel — X/YouTube/Reddit)
 * и панели рехостнутого расширения (SocialExtensionPage — TikTok/Instagram/…). Иначе секция
 * была бы видна только на части площадок (так и случилось в первой версии).
 *
 * Поток: расшифровка речи → опц. перевод на выбранный язык → сохранение в Галерею
 * («Медиафайлы → Текст») → оттуда текст подставляется в озвучку UGC-студии.
 * В Галерею уходит ТО, что сейчас на экране (оригинал или перевод).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, RotateCw, XCircle, Languages, Download, CheckCircle2, FileText } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../config/i18n';

interface Props {
  token: string | null;
  /** Ссылка на разбираемое видео; пусто/не-видео → блок молчит. */
  url: string | null;
  /** Метка платформы для имени файла в Галерее. */
  platform?: string | null;
  /** Компактный режим для узкой колонки (панель расширения). */
  compact?: boolean;
}

/** Язык интерфейса (ISO-639-1) — предзаполняем им язык перевода. */
function uiLang(): string {
  try {
    const l = (localStorage.getItem('i18nextLng') || navigator.language || 'en').toLowerCase();
    return l.split('-')[0] || 'en';
  } catch { return 'en'; }
}

function downloadTxt(name: string, content: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function TranscribePanel({ token, url, platform, compact }: Props) {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);      // оригинал (язык ролика)
  const [lang, setLang] = useState<string | null>(null);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOrig, setShowOrig] = useState(true);
  const [target, setTarget] = useState<string>(uiLang());
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const shown = showOrig ? text : (translated || text);

  // Сменили ролик — прежняя расшифровка больше не про него.
  useEffect(() => {
    setText(null); setTranslated(null); setErr(null); setLang(null);
    setShowOrig(true); setSavedName(null);
  }, [url]);

  const auth = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

  const run = async () => {
    if (loading || !url) return;
    setLoading(true); setErr(null); setSavedName(null);
    try {
      const res = await fetch('/api/trends/analyze/transcribe', { method: 'POST', headers: auth(), body: JSON.stringify({ url }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setText(String(d.text || '')); setLang(d.language || null); setTranslated(null); setShowOrig(true);
    } catch (e: any) {
      setErr(e instanceof TypeError ? t('sec.tanalytics.serverDownShort', 'Сервер недоступен.') : (e?.message || t('sec.tanalytics.trFailed', 'Не удалось расшифровать речь')));
    } finally { setLoading(false); }
  };

  const translate = async () => {
    if (!text || translating) return;
    setTranslating(true); setErr(null);
    try {
      const res = await fetch('/api/trends/analyze/transcribe/translate', { method: 'POST', headers: auth(), body: JSON.stringify({ text, lang: target }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setTranslated(String(d.text || '')); setShowOrig(false); setSavedName(null);
    } catch (e: any) {
      setErr(e?.message || t('sec.tanalytics.trTranslateFailed', 'Не удалось перевести'));
    } finally { setTranslating(false); }
  };

  const save = async () => {
    if (!shown || saving) return;
    setSaving(true); setErr(null);
    try {
      const suffix = showOrig ? (lang ? ` (${lang})` : '') : ` (${target})`;
      const name = `${t('sec.tanalytics.trFileName', 'Транскрибация')} — ${platform || 'video'}${suffix}`;
      const res = await fetch('/api/trends/analyze/transcribe/save', { method: 'POST', headers: auth(), body: JSON.stringify({ text: shown, name }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setSavedName(d?.asset?.originalName || name);
    } catch (e: any) {
      setErr(e?.message || t('sec.tanalytics.trSaveFailed', 'Не удалось сохранить текст'));
    } finally { setSaving(false); }
  };

  if (!url) return null;

  return (
    <div className="rounded-2xl p-3 space-y-2.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <FileText size={15} style={{ color: 'var(--brand)' }} />
        <span className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.tanalytics.trTitle', 'Транскрибация речи')}</span>
        {lang && text && <span className="text-[10.5px] px-1.5 py-0.5 rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{t('sec.tanalytics.trLang', 'язык: {{l}}', { l: lang })}</span>}
      </div>

      {!text && (
        <>
          <button onClick={run} disabled={loading}
            className="w-full py-2 rounded-xl text-[12.5px] font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'rgba(99,102,241,0.14)', color: 'var(--brand)', border: '1px solid rgba(99,102,241,0.4)', cursor: 'pointer' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? t('sec.tanalytics.trRunning', 'Слушаю ролик…') : t('sec.tanalytics.trRun', 'Расшифровать речь')}
          </button>
          {!loading && !err && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('sec.tanalytics.trHint', 'Расшифрую речь из ролика, при желании переведу на нужный язык и сохраню в Галерею («Текст») — оттуда текст можно подставить в озвучку UGC-студии.')}</p>
          )}
        </>
      )}

      {err && (
        <div className="flex items-start gap-2 text-[11.5px] rounded-xl p-2" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          <XCircle size={13} className="mt-[2px] flex-shrink-0" /><span>{err}</span>
        </div>
      )}

      {text && (
        <>
          {translated && (
            <div className="inline-flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              {([[true, t('sec.tanalytics.trOrig', 'Оригинал')], [false, t('sec.tanalytics.trTrans', 'Перевод')]] as [boolean, string][]).map(([orig, label]) => (
                <button key={String(orig)} onClick={() => { setShowOrig(orig); setSavedName(null); }}
                  className="text-[11px] font-600 px-2.5 py-1 rounded-md"
                  style={{ background: showOrig === orig ? 'var(--brand)' : 'transparent', color: showOrig === orig ? 'var(--brand-contrast)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          <textarea readOnly value={shown || ''} rows={compact ? 5 : 7}
            className="w-full text-[12.5px] leading-snug rounded-xl p-2.5"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', resize: 'vertical' }} />

          <div className="flex items-center gap-1.5 flex-wrap">
            <select value={target} onChange={(e) => setTarget(e.target.value)}
              className="text-[11.5px] px-2 py-1.5 rounded-lg flex-1 min-w-0"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
            </select>
            <button onClick={translate} disabled={translating}
              className="inline-flex items-center gap-1 text-[11.5px] font-600 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
              {translating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
              {t('sec.tanalytics.trTranslateBtn', 'Перевести')}
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={run} disabled={loading}
              className="inline-flex items-center gap-1 text-[11.5px] font-600 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />} {t('sec.tanalytics.trRedo', 'Заново')}
            </button>
            <button onClick={() => downloadTxt('transcript.txt', shown || '')}
              className="inline-flex items-center gap-1 text-[11.5px] font-600 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
              <Download size={12} /> .txt
            </button>
            <button onClick={save} disabled={saving || !!savedName}
              className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 text-[11.5px] font-700 px-2.5 py-1.5 rounded-lg disabled:opacity-60"
              style={{ background: savedName ? 'rgba(16,185,129,0.14)' : 'rgba(99,102,241,0.14)', color: savedName ? '#10b981' : 'var(--brand)', border: `1px solid ${savedName ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.4)'}`, cursor: 'pointer' }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : savedName ? <CheckCircle2 size={13} /> : <Download size={13} />}
              {saving ? t('sec.tanalytics.trSaving', 'Сохраняю…') : savedName ? t('sec.tanalytics.trSaved', 'В Галерее') : t('sec.tanalytics.trSave', 'В Галерею («Текст»)')}
            </button>
          </div>

          {savedName && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {t('sec.tanalytics.trSavedHint', '«{{n}}» — в Галерее, вкладка «Медиафайлы» → «Текст». Оттуда текст можно подставить в озвучку UGC-студии.', { n: savedName })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
