/**
 * PublisherBulkModal — массовая обработка выделенного в Галерее: N роликов → черновики
 * постов с ОТДЕЛЬНЫМ текстом под каждую сеть (YouTube Shorts / Instagram / TikTok …).
 *
 * Подписи и хэштеги пишет Пост-движок (Claude ключом тенанта, контекст — ДНК тренда
 * ролика): один вызов на ролик отдаёт версии под все выбранные сети + заголовок YouTube.
 * Ролики в соцсети НЕ уходят: всё падает в папку «Черновики» Публикатора — там смотрят,
 * правят и планируют по слотам.
 *
 * Обработка идёт ФОНОВОЙ задачей на бэке (20 роликов = десятки секунд): POST /drafts/bulk
 * отдаёт jobId, окно опрашивает /drafts/bulk/status и показывает прогресс.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X, Sparkles, AlertTriangle, Check } from 'lucide-react';
import { PLATFORM_META, PLATFORM_ORDER, PlatformMark, BLOTATO_SETTINGS_URL, type PubAccount } from './PublisherTab';

export interface BulkItem { assetId?: string; mediaUrl?: string; title?: string }

export function PublisherBulkModal({ token, items, onClose, onDone }: {
  token: string | null;
  items: BulkItem[];
  onClose: () => void;
  /** Обработка завершилась — открыть Публикатор на папке «Черновики». */
  onDone: (info: { groups: number; rows: number }) => void;
}) {
  const { t, i18n } = useTranslation('common');
  const headers = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

  const [accounts, setAccounts] = useState<PubAccount[] | null>(null);
  const [accErr, setAccErr] = useState<string | null>(null);
  const [selAcc, setSelAcc] = useState<Set<string>>(new Set());
  const [ai, setAi] = useState(true);
  const [tone, setTone] = useState<'engaging' | 'expert' | 'selling'>('engaging');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; note?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/publisher/accounts', { headers: headers() });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setAccErr(d.message || d.error || `HTTP ${r.status}`); setAccounts([]); return; }
        const list: PubAccount[] = d.accounts || [];
        setAccounts(list);
        // По умолчанию отмечаем ровно то, что просили: короткие вертикальные площадки.
        const pref = ['tiktok', 'instagram', 'youtube'];
        const auto = new Set<string>();
        for (const p of pref) { const a = list.find((x) => x.platform === p); if (a) auto.add(a.id); }
        setSelAcc(auto);
      } catch (e: any) { setAccErr(e?.message || 'Blotato недоступен'); setAccounts([]); }
    })();
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byPlatform = useMemo(() => {
    const m = new Map<string, PubAccount[]>();
    for (const a of accounts || []) { const arr = m.get(a.platform) || []; arr.push(a); m.set(a.platform, arr); }
    return m;
  }, [accounts]);

  const toggleAcc = (id: string) => setSelAcc((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const run = async () => {
    if (busy || !selAcc.size) return;
    setBusy(true); setErr(null); setWarnings([]);
    const targets = (accounts || []).filter((a) => selAcc.has(a.id)).map((a) => ({
      accountId: a.id, platform: a.platform,
      options: { accountName: a.username ? `@${a.username}` : (a.name || a.platform) },
    }));
    try {
      const r = await fetch('/api/publisher/drafts/bulk', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ items, targets, ai, tone, language: (i18n.language || 'ru').split('-')[0] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.jobId) { setErr(d.error || t('sec.pubBulk.errStart', 'Не удалось запустить обработку')); setBusy(false); return; }
      setProgress({ done: 0, total: d.total || items.length });
      pollRef.current = window.setInterval(async () => {
        try {
          const pr = await fetch(`/api/publisher/drafts/bulk/status?job=${encodeURIComponent(d.jobId)}`, { headers: headers() });
          const pd = await pr.json().catch(() => ({}));
          if (!pr.ok) throw new Error(pd.error || `HTTP ${pr.status}`);
          setProgress({ done: pd.done || 0, total: pd.total || items.length, note: pd.note });
          if (pd.status === 'done') {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null; setBusy(false);
            setWarnings(Array.isArray(pd.errors) ? pd.errors : []);
            onDone({ groups: pd.groups || 0, rows: pd.rows || 0 });
          } else if (pd.status === 'failed') {
            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null; setBusy(false);
            setErr(pd.error || t('sec.pubBulk.errRun', 'Обработка не удалась'));
          }
        } catch (e: any) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null; setBusy(false);
          setErr(e?.message || t('sec.pubBulk.errRun', 'Обработка не удалась'));
        }
      }, 2500);
    } catch (e: any) { setErr(e?.message || t('sec.pubBulk.errStart', 'Не удалось запустить обработку')); setBusy(false); }
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div onClick={busy ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 97, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-2xl p-4 space-y-3"
        style={{ width: 'min(560px, 96vw)', maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: '0 16px 40px rgba(0,0,0,.45)' }}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--brand)' }} />
          <b className="text-[14px] flex-1" style={{ color: 'var(--text-primary)' }}>
            {t('sec.pubBulk.title', 'В Публикатор: {{n}} роликов', { n: items.length })}
          </b>
          {!busy && (
            <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
          )}
        </div>
        <p className="text-[12px] leading-snug" style={{ color: 'var(--text-muted)' }}>
          {t('sec.pubBulk.sub', 'ИИ напишет описание и хэштеги ОТДЕЛЬНО под каждую сеть (для YouTube — ещё и заголовок). Посты лягут в папку «Черновики» — в соцсети ничего не уйдёт, пока вы сами не запланируете.')}
        </p>

        {/* Куда постим */}
        <div className="space-y-1.5">
          <span className="text-[12px] font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.pubBulk.where', 'Куда постим')}</span>
          {accounts === null ? (
            <p className="text-[12px] py-2" style={{ color: 'var(--text-muted)' }}><Loader2 size={13} className="animate-spin inline" /> {t('sec.pubBulk.loadingAcc', 'Загружаю аккаунты…')}</p>
          ) : accounts.length === 0 ? (
            <p className="text-[12px] rounded-lg p-2.5" style={{ background: 'rgba(245,158,11,.10)', color: '#f59e0b' }}>
              <AlertTriangle size={12} className="inline" />{' '}
              {accErr || t('sec.pubBulk.noAcc', 'Соцсети ещё не подключены.')}{' '}
              <a href={BLOTATO_SETTINGS_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>{t('sec.pubBulk.connect', 'Подключить в Blotato →')}</a>
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {PLATFORM_ORDER.flatMap((pk) => (byPlatform.get(pk) || []).map((a) => {
                const on = selAcc.has(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggleAcc(a.id)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left"
                    style={{ background: on ? 'rgba(99,102,241,.10)' : 'var(--bg-primary)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                    <PlatformMark platform={a.platform} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-650 leading-tight" style={{ color: 'var(--text-primary)' }}>{PLATFORM_META[a.platform]?.label || a.platform}</span>
                      <span className="block text-[10.5px] truncate leading-tight" style={{ color: 'var(--text-muted)' }}>{a.username ? `@${a.username}` : (a.name || '')}</span>
                    </span>
                    {on && <Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} />}
                  </button>
                );
              }))}
            </div>
          )}
        </div>

        {/* Тексты */}
        <div className="space-y-1.5">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--brand)' }} />
            <span className="text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
              <b style={{ color: 'var(--text-primary)' }}>{t('sec.pubBulk.aiOn', 'Писать описания и хэштеги ИИ')}</b>
              <br />{t('sec.pubBulk.aiHint', 'Контекст — разбор тренда этого ролика (хук, аудитория, ключевые слова). Без галочки текстом станет название ролика.')}
            </span>
          </label>
          {ai && (
            <div className="flex items-center gap-2">
              <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{t('sec.pubBulk.tone', 'Тон')}</span>
              {([['engaging', t('sec.pubBulk.toneEngaging', 'вовлекающий')], ['expert', t('sec.pubBulk.toneExpert', 'экспертный')], ['selling', t('sec.pubBulk.toneSelling', 'продающий')]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTone(k as any)} className="text-[11.5px] font-600 px-2.5 py-1 rounded-lg"
                  style={{ background: tone === k ? 'var(--brand)' : 'var(--bg-tertiary)', color: tone === k ? 'var(--brand-contrast)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          )}
        </div>

        {progress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              <span>{t('sec.pubBulk.progress', 'Обработано {{done}} из {{total}}', { done: progress.done, total: progress.total })}</span>
              <span className="truncate ml-2" style={{ maxWidth: '55%' }}>{progress.note || ''}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand)', transition: 'width .3s' }} />
            </div>
          </div>
        )}
        {err && <p className="text-[12px]" style={{ color: '#ef4444' }}><AlertTriangle size={12} className="inline" /> {err}</p>}
        {warnings.length > 0 && (
          <div className="text-[11px] space-y-0.5" style={{ color: '#f59e0b' }}>
            {warnings.slice(0, 6).map((w, i) => <div key={i} className="truncate" title={w}>{w}</div>)}
          </div>
        )}

        <div className="flex items-center gap-2 pt-0.5">
          <button type="button" onClick={onClose} disabled={busy} className="text-[12.5px] px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {t('sec.pubBulk.close', 'Закрыть')}
          </button>
          <button type="button" onClick={() => void run()} disabled={busy || !selAcc.size}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-700 px-3 py-2 rounded-lg"
            style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: (busy || !selAcc.size) ? 'default' : 'pointer', opacity: (busy || !selAcc.size) ? 0.6 : 1 }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {busy
              ? t('sec.pubBulk.running', 'Обрабатываю…')
              : t('sec.pubBulk.run', 'Обработать {{n}} роликов', { n: items.length })}
          </button>
        </div>
        <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
          {t('sec.pubBulk.note', 'Один ролик = один пост на каждую отмеченную сеть. Тексты потом можно править в «Черновиках».')}
        </p>
      </div>
    </div>
  );
}

export default PublisherBulkModal;
