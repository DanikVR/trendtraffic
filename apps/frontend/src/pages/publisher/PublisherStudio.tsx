/**
 * PublisherStudio — полноэкранная студия «Новый пост» (Публикатор, Ф1+Ф3).
 *
 * Ф1: медиа из Галереи (GalleryPicker), текст со счётчиками лимитов, аккаунты-тумблеры,
 * платформенные опции Blotato, «Когда»: Сейчас / Дата-время / Следующий слот (наш расчёт).
 * Ф3: Пост-движок — ✦ ИИ-подпись (Claude: тона, A/B, per-платформенные версии, хэштеги;
 * контекст = TrendDNA ролика, если есть разбор), вкладки текста «Все + per-платформа ✎»,
 * тред для X/Threads/Bluesky (пустая строка = новый пост треда), шаблоны текстов.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Loader2, Send, ImagePlus, X, Clock, CalendarClock, Zap, Check,
  AlertTriangle, ChevronDown, RefreshCw, ExternalLink, Sparkles, Save, ListPlus,
} from 'lucide-react';
import { GalleryPicker, type GalleryPickItem } from '../../components/GalleryPicker';
import { PLATFORM_META, PlatformMark, BLOTATO_SETTINGS_URL, type PubAccount } from './PublisherTab';

/** Практические лимиты подписи по сетям (для счётчиков; жёсткую валидацию делает сама сеть). */
const TEXT_LIMITS: Record<string, number> = {
  twitter: 280, threads: 500, bluesky: 300, instagram: 2200, tiktok: 2200,
  linkedin: 3000, facebook: 5000, youtube: 5000, pinterest: 500,
};
/** Этим сетям нужен файл — текстовый пост туда не уйдёт. */
const MEDIA_REQUIRED = new Set(['tiktok', 'instagram', 'youtube', 'pinterest']);
/** Треды поддерживают эти сети (additionalPosts). */
const THREAD_PLATFORMS = ['twitter', 'threads', 'bluesky'];

interface StudioInitial { assetId?: string; mediaUrl?: string; title?: string }
interface TargetResult { platform: string; ok: boolean; error?: string }
interface CaptionVariant { base: string; hashtags: string[]; platforms: Record<string, string>; youtubeTitle?: string }
interface TemplateRow { id: number; name: string; text: string }

export function PublisherStudio({ token, initial, onClose, onPublished }: {
  token: string | null;
  initial: StudioInitial;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { t } = useTranslation('common');
  const jsonHeaders = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

  const [media, setMedia] = useState<StudioInitial | null>(initial.mediaUrl ? initial : null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [text, setText] = useState('');
  // Ф3: per-платформенные версии текста + тред
  const [textTab, setTextTab] = useState<string>('all');
  const [pOverrides, setPOverrides] = useState<Record<string, string>>({});
  const [threadText, setThreadText] = useState('');

  const [accounts, setAccounts] = useState<PubAccount[]>([]);
  const [accLoading, setAccLoading] = useState(true);
  const [accErr, setAccErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [pOpts, setPOpts] = useState<Record<string, Record<string, any>>>({
    tiktok: { privacyLevel: 'PUBLIC_TO_EVERYONE', isAiGenerated: true },
    youtube: { privacyStatus: 'public', shouldNotifySubscribers: true },
    instagram: { mediaType: 'reel' },
  });
  const [aOpts, setAOpts] = useState<Record<string, Record<string, any>>>({});
  const [subs, setSubs] = useState<Record<string, { id: string; name: string }[]>>({});
  const [boards, setBoards] = useState<Record<string, { id: string; name: string }[]>>({});

  const [mode, setMode] = useState<'now' | 'time' | 'slot'>('now');
  const [when, setWhen] = useState<string>('');
  const [slotNext, setSlotNext] = useState<string | null | 'none'>(null);

  // Ф3: Пост-движок
  const [aiTone, setAiTone] = useState('engaging');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiVars, setAiVars] = useState<CaptionVariant[] | null>(null);
  // Ф3: шаблоны
  const [tplOpen, setTplOpen] = useState(false);
  const [tpls, setTpls] = useState<TemplateRow[] | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplSaving, setTplSaving] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<TargetResult[] | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setAccLoading(true);
      try {
        const r = await fetch('/api/publisher/accounts', { headers: jsonHeaders() });
        if (r.status === 409) { setAccErr(t('sec.publisher.errNoKey', 'Нет ключа Blotato — введите его в Настройки → Генерация → Blotato.')); return; }
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        setAccounts(((await r.json()).accounts || []) as PubAccount[]);
      } catch (e: any) { setAccErr(e?.message || t('sec.publisher.errLoadAccounts', 'Не удалось загрузить аккаунты')); }
      finally { setAccLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // «Следующий слот» — наш расчёт по «Моему расписанию»
  useEffect(() => {
    if (mode !== 'slot') return;
    (async () => {
      try {
        const r = await fetch('/api/publisher/slots/next?count=1', { headers: jsonHeaders() });
        const d = r.ok ? await r.json() : { next: [] };
        setSlotNext(d.next?.[0] || 'none');
      } catch { setSlotNext('none'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const selAccounts = useMemo(() => accounts.filter((a) => selected.has(a.id)), [accounts, selected]);
  const selPlatforms = useMemo(() => Array.from(new Set(selAccounts.map((a) => a.platform))), [selAccounts]);
  const threadOn = useMemo(() => selPlatforms.some((p) => THREAD_PLATFORMS.includes(p)), [selPlatforms]);

  useEffect(() => { if (textTab !== 'all' && !selPlatforms.includes(textTab)) setTextTab('all'); }, [selPlatforms, textTab]);

  const setPlatformOpt = (platform: string, key: string, value: any) =>
    setPOpts((prev) => ({ ...prev, [platform]: { ...(prev[platform] || {}), [key]: value } }));
  const setAccountOpt = (accountId: string, key: string, value: any) =>
    setAOpts((prev) => ({ ...prev, [accountId]: { ...(prev[accountId] || {}), [key]: value } }));

  const loadSubs = async (accountId: string) => {
    if (subs[accountId]) return;
    try {
      const r = await fetch(`/api/publisher/accounts/${encodeURIComponent(accountId)}/subaccounts`, { headers: jsonHeaders() });
      const items = r.ok ? ((await r.json()).items || []) : [];
      setSubs((p) => ({ ...p, [accountId]: items }));
      if (items.length === 1) setAccountOpt(accountId, 'pageId', items[0].id);
    } catch { setSubs((p) => ({ ...p, [accountId]: [] })); }
  };
  const loadBoards = async (accountId: string) => {
    if (boards[accountId]) return;
    try {
      const r = await fetch(`/api/publisher/pinterest/boards?accountId=${encodeURIComponent(accountId)}`, { headers: jsonHeaders() });
      const items = r.ok ? ((await r.json()).items || []) : [];
      setBoards((p) => ({ ...p, [accountId]: items }));
      if (items.length === 1) setAccountOpt(accountId, 'boardId', items[0].id);
    } catch { setBoards((p) => ({ ...p, [accountId]: [] })); }
  };

  const toggleAccount = (a: PubAccount) => {
    setResults(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(a.id)) next.delete(a.id);
      else {
        next.add(a.id);
        if (a.platform === 'facebook') void loadSubs(a.id);
        if (a.platform === 'pinterest') void loadBoards(a.id);
        if (a.platform === 'youtube' && !pOpts.youtube?.title) {
          const t = (media?.title || text.split('\n')[0] || '').trim().slice(0, 100);
          if (t) setPlatformOpt('youtube', 'title', t);
        }
      }
      return next;
    });
  };

  const pickFromGallery = (g: GalleryPickItem) => {
    if (g.type !== 'video' && g.type !== 'image') { setMediaNote(t('sec.publisher.mediaOnlyNote', 'Для постов подходят видео и фото.')); return; }
    setMediaNote(null);
    setMedia({ mediaUrl: g.fileUrl, title: g.title });
    setPickerOpen(false);
  };

  // ── Пост-движок ────────────────────────────────────────────────────────────
  const runAi = async () => {
    setAiBusy(true); setAiErr(null); setAiVars(null);
    try {
      const r = await fetch('/api/publisher/ai-caption', {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({
          title: media?.title || text.split('\n')[0] || undefined,
          assetId: media?.assetId || undefined,
          platforms: selPlatforms.length ? selPlatforms : ['tiktok', 'instagram'],
          tone: aiTone, count: 2, brief: text.trim() ? text.slice(0, 400) : undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setAiVars((d.variants || []) as CaptionVariant[]);
    } catch (e: any) { setAiErr(e?.message || t('sec.publisher.errAiGen', 'Не удалось сгенерировать')); }
    finally { setAiBusy(false); }
  };
  const applyVariant = (v: CaptionVariant) => {
    setText([v.base, v.hashtags.join(' ')].filter(Boolean).join('\n\n'));
    const ov: Record<string, string> = {};
    for (const [p, t] of Object.entries(v.platforms || {})) if (selPlatforms.includes(p) && t) ov[p] = t;
    setPOverrides(ov);
    if (v.youtubeTitle && selPlatforms.includes('youtube')) setPlatformOpt('youtube', 'title', v.youtubeTitle);
    setAiVars(null); setTextTab('all');
  };

  // ── Шаблоны ────────────────────────────────────────────────────────────────
  const loadTpls = async () => {
    try {
      const r = await fetch('/api/publisher/templates', { headers: jsonHeaders() });
      setTpls(r.ok ? (((await r.json()).templates || []) as TemplateRow[]) : []);
    } catch { setTpls([]); }
  };
  const saveTpl = async () => {
    const name = tplName.trim() || (text.split('\n')[0] || t('sec.publisher.tplDefaultName', 'Шаблон')).slice(0, 60);
    if (!text.trim()) return;
    setTplSaving(true);
    try {
      await fetch('/api/publisher/templates', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ name, text }) });
      setTplName(''); await loadTpls();
    } finally { setTplSaving(false); }
  };
  const delTpl = async (id: number) => {
    await fetch(`/api/publisher/templates/${id}`, { method: 'DELETE', headers: jsonHeaders() });
    await loadTpls();
  };

  // ── Валидация ──────────────────────────────────────────────────────────────
  const effText = (p: string) => (pOverrides[p] ?? text);
  const problems = useMemo(() => {
    const list: string[] = [];
    if (selAccounts.length === 0) list.push(t('sec.publisher.vSelectAccount', 'Выберите хотя бы один аккаунт.'));
    if (!media && selPlatforms.some((p) => MEDIA_REQUIRED.has(p))) {
      list.push(t('sec.publisher.vMediaRequired', 'TikTok / Instagram / YouTube / Pinterest требуют видео или фото — добавьте медиа.'));
    }
    if (!media && !text.trim()) list.push(t('sec.publisher.vMediaOrText', 'Добавьте медиа или текст поста.'));
    if (selPlatforms.includes('youtube') && !(pOpts.youtube?.title || '').trim()) list.push(t('sec.publisher.vYtTitle', 'YouTube: заполните название ролика.'));
    for (const a of selAccounts) {
      if (a.platform === 'facebook' && !aOpts[a.id]?.pageId) list.push(t('sec.publisher.vFbPage', 'Facebook ({{name}}): выберите страницу.', { name: a.name || a.username || a.id }));
      if (a.platform === 'pinterest' && !aOpts[a.id]?.boardId) list.push(t('sec.publisher.vPinBoard', 'Pinterest ({{name}}): выберите доску.', { name: a.name || a.username || a.id }));
    }
    if (mode === 'time' && !when) list.push(t('sec.publisher.vWhen', 'Укажите дату и время публикации.'));
    if (mode === 'slot' && slotNext === 'none') list.push(t('sec.publisher.noFreeSlots', 'Нет свободных слотов — добавьте времена в «Моё расписание» (вкладка Публикатора).'));
    for (const p of selPlatforms) {
      const lim = TEXT_LIMITS[p];
      if (lim && effText(p).length > lim) list.push(t('sec.publisher.vTooLong', '{{platform}}: текст длиннее лимита {{limit}}.', { platform: PLATFORM_META[p]?.label || p, limit: lim }));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selAccounts, selPlatforms, media, text, pOverrides, pOpts, aOpts, mode, when, slotNext]);

  const submit = async () => {
    if (problems.length > 0 || submitting) return;
    setSubmitting(true); setSubmitErr(null); setResults(null);
    try {
      const thread = threadText.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
      const targets = selAccounts.map((a) => ({
        accountId: a.id,
        platform: a.platform,
        options: {
          ...(pOpts[a.platform] || {}),
          ...(aOpts[a.id] || {}),
          accountName: a.username ? `@${a.username}` : (a.name || a.platform),
        },
        ...(pOverrides[a.platform] != null ? { textOverride: pOverrides[a.platform] } : {}),
        ...(thread.length && THREAD_PLATFORMS.includes(a.platform) ? { thread } : {}),
      }));
      const body: Record<string, any> = {
        assetId: media?.assetId || undefined,
        mediaUrl: media?.assetId ? undefined : media?.mediaUrl,
        title: media?.title || undefined,
        text, mode, targets,
      };
      if (mode === 'time') body.scheduledAt = new Date(when).toISOString();
      const r = await fetch('/api/publisher/posts', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok && !Array.isArray(d.results)) throw new Error(d.error || `HTTP ${r.status}`);
      const rs: TargetResult[] = (d.results || []).map((x: any) => ({ platform: x.platform, ok: !!x.ok, error: x.error }));
      setResults(rs);
      if (rs.length > 0 && rs.every((x) => x.ok)) setTimeout(() => onPublished(), 900);
    } catch (e: any) { setSubmitErr(e?.message || t('sec.publisher.errSubmit', 'Не удалось отправить')); }
    finally { setSubmitting(false); }
  };

  // ── Мелкие UI-примитивы ────────────────────────────────────────────────────
  const Tgl = ({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: React.ReactNode; hint?: string }) => (
    <button type="button" onClick={onClick} title={hint}
      className="w-full flex items-center justify-between gap-2 py-1.5 text-[12.5px]"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
      <span className="text-left">{label}</span>
      <span className="rounded-full flex-shrink-0 transition-colors" style={{ width: 32, height: 18, background: on ? 'var(--brand)' : 'var(--border-strong)', position: 'relative' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
    </button>
  );
  const Sel = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) => (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none text-[12.5px] font-600 rounded-lg pl-2.5 pr-7 py-1.5"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
    </div>
  );
  const OptCard = ({ platform, children }: { platform: string; children: React.ReactNode }) => (
    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
      <div className="flex items-center gap-2 mb-1"><PlatformMark platform={platform} size={18} />
        <span className="text-[12px] font-700" style={{ color: 'var(--text-primary)' }}>{PLATFORM_META[platform]?.label}</span>
      </div>
      {children}
    </div>
  );

  const overLimit = (p: string) => TEXT_LIMITS[p] && effText(p).length > TEXT_LIMITS[p];
  const fmtDT = (iso: string) => new Date(iso).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-[95] flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Топбар */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <button type="button" onClick={onClose}
          className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          <ArrowLeft size={15} /> {t('sec.publisher.close', 'Закрыть')}
        </button>
        <span className="inline-flex items-center gap-2 text-[15px] font-700" style={{ color: 'var(--text-primary)' }}>
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}><Send size={14} color="#fff" /></span>
          {t('sec.publisher.newPost', 'Новый пост')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {problems.length > 0 && selAccounts.length > 0 && (
            <span className="hidden sm:inline text-[11.5px]" style={{ color: '#f59e0b' }} title={problems.join('\n')}>
              <AlertTriangle size={12} className="inline mr-1" />{problems[0]}{problems.length > 1 ? ` (+${problems.length - 1})` : ''}
            </span>
          )}
          <button type="button" onClick={() => void submit()} disabled={problems.length > 0 || submitting}
            className="inline-flex items-center gap-2 text-[13.5px] font-700 px-5 py-2.5 rounded-xl disabled:opacity-40"
            style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            {mode === 'now' ? t('sec.publisher.publishBtn', 'Опубликовать') : t('sec.publisher.scheduleBtn', 'Запланировать')}{selAccounts.length > 0 ? ` · ${selAccounts.length}` : ''}
          </button>
        </div>
      </div>

      {/* Результат сабмита */}
      {(results || submitErr) && (
        <div className="px-4 py-2 flex items-center gap-2 flex-wrap flex-shrink-0" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          {submitErr && <span className="text-[12.5px] font-600" style={{ color: '#ef4444' }}><AlertTriangle size={13} className="inline mr-1" />{submitErr}</span>}
          {results?.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11.5px] font-600 px-2 py-1 rounded-lg"
              title={r.error} style={{ background: r.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)', color: r.ok ? '#10b981' : '#ef4444' }}>
              <PlatformMark platform={r.platform} size={16} /> {r.ok ? <Check size={12} /> : <X size={12} />} {r.ok ? t('sec.publisher.stSent', 'отправлено') : (r.error || t('sec.publisher.stFailed', 'ошибка'))}
            </span>
          ))}
          {results && results.every((r) => r.ok) && <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.doneOpening', 'Готово — открываю ленту Публикатора…')}</span>}
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto p-4">
          <div className="grid gap-4 items-start lg:grid-cols-[230px_minmax(0,1fr)_330px]">

            {/* ── Медиа ── */}
            <div className="space-y-2">
              <div className="text-[11px] font-700 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.mediaLbl', 'Медиа')}</div>
              <div className="rounded-2xl overflow-hidden relative" style={{ aspectRatio: '9 / 16', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', maxWidth: 230 }}>
                {media?.mediaUrl ? (
                  <>
                    {/\.(png|jpe?g|webp|gif)(\?|$)/i.test(media.mediaUrl)
                      ? <img src={media.mediaUrl} alt="" className="w-full h-full object-cover" />
                      : <video src={`${media.mediaUrl}#t=0.1`} muted preload="metadata" controls className="w-full h-full object-cover" />}
                    <button type="button" onClick={() => setMedia(null)} title={t('sec.publisher.removeMedia', 'Убрать медиа')}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                  </>
                ) : (
                  <button type="button" onClick={() => setPickerOpen(true)}
                    className="w-full h-full flex flex-col items-center justify-center gap-2"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <ImagePlus size={26} />
                    <span className="text-[12px] font-600">{t('sec.publisher.fromGallery', 'Из Галереи')}</span>
                  </button>
                )}
              </div>
              {media?.title && <div className="text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }} title={media.title}>{media.title}</div>}
              <button type="button" onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                <ImagePlus size={13} /> {media ? t('sec.publisher.replaceMedia', 'Заменить') : t('sec.publisher.chooseMedia', 'Выбрать')}
              </button>
              {mediaNote && <div className="text-[11.5px]" style={{ color: '#f59e0b' }}>{mediaNote}</div>}
            </div>

            {/* ── Текст ── */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[11px] font-700 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.postText', 'Текст поста')}</div>
                {/* Вкладки версий текста: Все + per-платформа (✎ = есть своя версия) */}
                {selPlatforms.length > 0 && (
                  <div className="inline-flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                    <button type="button" onClick={() => setTextTab('all')}
                      className="text-[11.5px] font-600 px-2 py-0.5 rounded-md"
                      style={{ background: textTab === 'all' ? 'var(--brand)' : 'transparent', color: textTab === 'all' ? 'var(--brand-contrast)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{t('sec.publisher.allTab', 'Все')}</button>
                    {selPlatforms.map((p) => (
                      <button key={p} type="button" onClick={() => setTextTab(p)}
                        className="text-[11.5px] font-600 px-2 py-0.5 rounded-md"
                        style={{ background: textTab === p ? 'var(--brand)' : 'transparent', color: textTab === p ? 'var(--brand-contrast)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                        {PLATFORM_META[p]?.mark || p}{pOverrides[p] != null ? ' ✎' : ''}
                      </button>
                    ))}
                  </div>
                )}
                {/* Шаблоны */}
                <div className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => { setTplOpen(!tplOpen); if (!tpls) void loadTpls(); }}
                    className="inline-flex items-center gap-1 text-[11.5px] font-600 px-2 py-1 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                    <ListPlus size={11} /> {t('sec.publisher.templates', 'Шаблоны')}
                  </button>
                </div>
              </div>

              {tplOpen && (
                <div className="rounded-xl p-2 space-y-1.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  {(tpls || []).map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => { setTextTab('all'); setText(t.text); setTplOpen(false); }}
                        className="flex-1 text-left text-[12px] font-600 px-2 py-1 rounded-md truncate"
                        title={t.text}
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer' }}>{t.name}</button>
                      <button type="button" onClick={() => void delTpl(t.id)} className="w-6 h-6 rounded-md" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={11} className="mx-auto" /></button>
                    </div>
                  ))}
                  {tpls && tpls.length === 0 && <p className="text-[11.5px] px-1" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.tplEmpty', 'Шаблонов пока нет.')}</p>}
                  <div className="flex items-center gap-1.5 pt-1" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
                    <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={t('sec.publisher.tplNamePh', 'Имя шаблона')}
                      className="flex-1 text-[12px] rounded-md px-2 py-1" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                    <button type="button" onClick={() => void saveTpl()} disabled={tplSaving || !text.trim()}
                      className="inline-flex items-center gap-1 text-[11.5px] font-700 px-2 py-1 rounded-md disabled:opacity-40"
                      style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                      {tplSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} {t('sec.publisher.tplSaveCurrent', 'Сохранить текущий')}
                    </button>
                  </div>
                </div>
              )}

              <textarea
                value={textTab === 'all' ? text : (pOverrides[textTab] ?? '')}
                onChange={(e) => {
                  setResults(null);
                  if (textTab === 'all') setText(e.target.value);
                  else setPOverrides((prev) => ({ ...prev, [textTab]: e.target.value }));
                }}
                placeholder={textTab === 'all'
                  ? t('sec.publisher.textPh', 'Подпись к посту: хук в первой строке, дальше суть и призыв…\n\n#хэштеги')
                  : t('sec.publisher.textPhPlatform', 'Своя версия для {{platform}} (пусто = используется общий текст)', { platform: PLATFORM_META[textTab]?.label || textTab })}
                className="w-full rounded-xl p-3 text-[13.5px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: 190, resize: 'vertical' }} />
              {textTab !== 'all' && pOverrides[textTab] != null && (
                <button type="button" onClick={() => setPOverrides((prev) => { const n = { ...prev }; delete n[textTab]; return n; })}
                  className="text-[11.5px] font-600" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                  {t('sec.publisher.backToCommon', '← вернуть общий текст для {{platform}}', { platform: PLATFORM_META[textTab]?.label || textTab })}
                </button>
              )}
              {selPlatforms.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {selPlatforms.map((p) => (
                    <span key={p} className="text-[11px] tabular-nums font-600" style={{ color: overLimit(p) ? '#ef4444' : 'var(--text-muted)' }}>
                      {PLATFORM_META[p]?.mark || p} {effText(p).length}/{TEXT_LIMITS[p] || '∞'}{overLimit(p) ? ' ✕' : ''}{pOverrides[p] != null ? ' ✎' : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* ✦ Пост-движок */}
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--brand)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] font-700 inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    <Sparkles size={13} style={{ color: 'var(--brand)' }} /> {t('sec.publisher.aiCaption', 'ИИ-подпись')}
                  </span>
                  <div className="inline-flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                    {([['engaging', t('sec.publisher.toneEngaging', 'Вовлекающий')], ['expert', t('sec.publisher.toneExpert', 'Экспертный')], ['selling', t('sec.publisher.toneSelling', 'Продающий')]] as [string, string][]).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setAiTone(k)}
                        className="text-[11.5px] font-600 px-2 py-1 rounded-md"
                        style={{ background: aiTone === k ? 'var(--brand)' : 'transparent', color: aiTone === k ? 'var(--brand-contrast)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{l}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => void runAi()} disabled={aiBusy}
                    className="inline-flex items-center gap-1.5 text-[12px] font-700 px-3 py-1.5 rounded-lg ml-auto"
                    style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                    {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {t('sec.publisher.genAb', 'Сгенерировать A/B')}
                  </button>
                </div>
                {aiErr && <p className="text-[11.5px]" style={{ color: '#ef4444' }}>{aiErr}</p>}
                {aiVars && aiVars.map((v, i) => (
                  <div key={i} className="rounded-lg p-2.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-700 px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}>{i === 0 ? 'A' : 'B'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{v.base}</p>
                        {v.hashtags.length > 0 && <p className="text-[11.5px] mt-1" style={{ color: 'var(--brand)' }}>{v.hashtags.join(' ')}</p>}
                        {Object.keys(v.platforms || {}).length > 0 && (
                          <p className="text-[10.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            {t('sec.publisher.aiPerPlatform', 'свои версии: {{list}}', { list: Object.keys(v.platforms).map((p) => PLATFORM_META[p]?.label || p).join(', ') })}
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => applyVariant(v)}
                        className="text-[11.5px] font-700 px-2.5 py-1 rounded-lg flex-shrink-0"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'none', cursor: 'pointer' }}>{t('sec.publisher.applyBtn', 'Применить')}</button>
                    </div>
                  </div>
                ))}
                <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                  {media?.assetId
                    ? t('sec.publisher.aiCtxDna', 'Контекст: название ролика + его разбор тренда (TrendDNA), если есть. Ключ Claude — «ИИ-режиссёр» в Настройках → Генерация.')
                    : t('sec.publisher.aiCtx', 'Контекст: название ролика. Ключ Claude — «ИИ-режиссёр» в Настройках → Генерация.')}
                </p>
              </div>

              {/* Тред */}
              {threadOn && (
                <div className="space-y-1">
                  <div className="text-[11px] font-700 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
                    {t('sec.publisher.threadLbl', 'Тред · X / Threads / Bluesky')} <span className="font-500 normal-case">{t('sec.publisher.threadHint', '(пустая строка = следующий пост треда)')}</span>
                  </div>
                  <textarea value={threadText} onChange={(e) => setThreadText(e.target.value)}
                    placeholder={t('sec.publisher.threadPh', 'Второй пост треда…\n\nТретий пост треда…')}
                    className="w-full rounded-xl p-3 text-[13px] leading-relaxed"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: 80, resize: 'vertical' }} />
                </div>
              )}

              {/* Когда публикуем */}
              <div className="pt-1 space-y-2">
                <div className="text-[11px] font-700 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.whenLbl', 'Когда')}</div>
                <div className="inline-flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                  {([['now', t('sec.publisher.whenNow', 'Сейчас'), <Zap key="z" size={13} />], ['time', t('sec.publisher.whenTime', 'Дата и время'), <CalendarClock key="c" size={13} />], ['slot', t('sec.publisher.whenSlot', 'Следующий слот'), <Clock key="s" size={13} />]] as ['now' | 'time' | 'slot', string, React.ReactNode][]).map(([k, l, ic]) => (
                    <button key={k} type="button" onClick={() => setMode(k)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-600"
                      style={{ background: mode === k ? 'var(--brand)' : 'transparent', color: mode === k ? 'var(--brand-contrast)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                      {ic} {l}
                    </button>
                  ))}
                </div>
                {mode === 'time' && (
                  <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                    className="block rounded-xl px-3 py-2 text-[13px]"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                )}
                {mode === 'slot' && (
                  <p className="text-[11.5px]" style={{ color: slotNext === 'none' ? '#f59e0b' : 'var(--text-muted)' }}>
                    {slotNext === null ? t('sec.publisher.slotCalc', 'Считаю ближайший слот…')
                      : slotNext === 'none' ? t('sec.publisher.noFreeSlots', 'Нет свободных слотов — добавьте времена в «Моё расписание» (вкладка Публикатора).')
                      : <>{t('sec.publisher.slotWillTake', 'Пост займёт ближайший свободный слот вашего расписания:')} <b style={{ color: 'var(--text-primary)' }}>{fmtDT(slotNext)}</b></>}
                  </p>
                )}
              </div>
            </div>

            {/* ── Аккаунты + опции ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-700 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.whereTo', 'Куда публикуем')}</div>
                <a href={BLOTATO_SETTINGS_URL} target="_blank" rel="noreferrer" className="text-[11px] font-600 inline-flex items-center gap-1" style={{ color: 'var(--brand)', textDecoration: 'none' }}>
                  <ExternalLink size={11} /> {t('sec.publisher.connectMore', 'подключить ещё')}
                </a>
              </div>

              {accLoading ? (
                <div className="py-6 text-center"><Loader2 size={18} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
              ) : accErr ? (
                <div className="text-[12.5px] rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>{accErr}</div>
              ) : accounts.length === 0 ? (
                <div className="text-[12.5px] rounded-xl p-3" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', color: 'var(--text-muted)' }}>
                  {t('sec.publisher.noNetsYet', 'Соцсети ещё не подключены. Откройте кабинет Blotato (ссылка выше), подключите сети и вернитесь.')}
                </div>
              ) : (
                <div className="rounded-xl px-3 py-1" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  {accounts.map((a) => (
                    <Tgl key={a.id} on={selected.has(a.id)} onClick={() => toggleAccount(a)}
                      label={<span className="inline-flex items-center gap-2"><PlatformMark platform={a.platform} size={20} />
                        <span className="font-600" style={{ color: 'var(--text-primary)' }}>{a.username ? `@${a.username}` : (a.name || PLATFORM_META[a.platform]?.label || a.platform)}</span></span>} />
                  ))}
                </div>
              )}

              {selPlatforms.includes('tiktok') && (
                <OptCard platform="tiktok">
                  <Sel value={pOpts.tiktok?.privacyLevel || 'PUBLIC_TO_EVERYONE'} onChange={(v) => setPlatformOpt('tiktok', 'privacyLevel', v)}
                    options={[['PUBLIC_TO_EVERYONE', t('sec.publisher.privPublic', 'Публичный')], ['MUTUAL_FOLLOW_FRIENDS', t('sec.publisher.privFriends', 'Друзья')], ['FOLLOWER_OF_CREATOR', t('sec.publisher.privFollowers', 'Подписчики')], ['SELF_ONLY', t('sec.publisher.privSelf', 'Только я')]]} />
                  <Tgl on={!pOpts.tiktok?.disabledComments} onClick={() => setPlatformOpt('tiktok', 'disabledComments', !pOpts.tiktok?.disabledComments)} label={t('sec.publisher.ttComments', 'Комментарии')} />
                  <Tgl on={!pOpts.tiktok?.disabledDuet} onClick={() => setPlatformOpt('tiktok', 'disabledDuet', !pOpts.tiktok?.disabledDuet)} label={t('sec.publisher.ttDuets', 'Дуэты')} />
                  <Tgl on={!pOpts.tiktok?.disabledStitch} onClick={() => setPlatformOpt('tiktok', 'disabledStitch', !pOpts.tiktok?.disabledStitch)} label={t('sec.publisher.ttStitches', 'Ститчи')} />
                  <Tgl on={!!pOpts.tiktok?.isBrandedContent} onClick={() => setPlatformOpt('tiktok', 'isBrandedContent', !pOpts.tiktok?.isBrandedContent)} label={t('sec.publisher.ttBranded', 'Брендированный контент')} hint={t('sec.publisher.ttBrandedHint', 'Платное партнёрство')} />
                  <Tgl on={!!pOpts.tiktok?.isYourBrand} onClick={() => setPlatformOpt('tiktok', 'isYourBrand', !pOpts.tiktok?.isYourBrand)} label={t('sec.publisher.ttYourBrand', 'Продвигаю свой бренд')} />
                  <Tgl on={pOpts.tiktok?.isAiGenerated !== false} onClick={() => setPlatformOpt('tiktok', 'isAiGenerated', pOpts.tiktok?.isAiGenerated === false)} label={t('sec.publisher.ttAiLabel', 'Метка «ИИ-контент»')} hint={t('sec.publisher.ttAiLabelHint', 'Обязательная честная метка для сгенерированных роликов')} />
                  <Tgl on={!!pOpts.tiktok?.isDraft} onClick={() => setPlatformOpt('tiktok', 'isDraft', !pOpts.tiktok?.isDraft)} label={t('sec.publisher.ttDraft', 'В черновики TikTok')} hint={t('sec.publisher.ttDraftHint', 'Пост попадёт в черновики приложения — опубликуете вручную после проверки')} />
                </OptCard>
              )}
              {selPlatforms.includes('youtube') && (
                <OptCard platform="youtube">
                  <input value={pOpts.youtube?.title || ''} onChange={(e) => setPlatformOpt('youtube', 'title', e.target.value)}
                    placeholder={t('sec.publisher.ytTitlePh', 'Название ролика (обязательно)')} maxLength={100}
                    className="w-full rounded-lg px-2.5 py-1.5 text-[12.5px] mb-1"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  <Sel value={pOpts.youtube?.privacyStatus || 'public'} onChange={(v) => setPlatformOpt('youtube', 'privacyStatus', v)}
                    options={[['public', t('sec.publisher.privPublic', 'Публичный')], ['unlisted', t('sec.publisher.ytUnlisted', 'По ссылке')], ['private', t('sec.publisher.ytPrivate', 'Приватный')]]} />
                  <Tgl on={pOpts.youtube?.shouldNotifySubscribers !== false} onClick={() => setPlatformOpt('youtube', 'shouldNotifySubscribers', pOpts.youtube?.shouldNotifySubscribers === false)} label={t('sec.publisher.ytNotifySubs', 'Уведомить подписчиков')} />
                  <Tgl on={!!pOpts.youtube?.isMadeForKids} onClick={() => setPlatformOpt('youtube', 'isMadeForKids', !pOpts.youtube?.isMadeForKids)} label={t('sec.publisher.ytMadeForKids', 'Для детей (madeForKids)')} />
                </OptCard>
              )}
              {selPlatforms.includes('instagram') && (
                <OptCard platform="instagram">
                  <Sel value={pOpts.instagram?.mediaType || 'reel'} onChange={(v) => setPlatformOpt('instagram', 'mediaType', v)}
                    options={[['reel', 'Reel'], ['post', t('sec.publisher.igFeedPost', 'Пост в ленту')], ['story', 'Story']]} />
                </OptCard>
              )}
              {selAccounts.filter((a) => a.platform === 'facebook').map((a) => (
                <OptCard key={a.id} platform="facebook">
                  <div className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{a.name || a.username || a.id} · {t('sec.publisher.fbPageWord', 'страница')} <span style={{ color: '#ef4444' }}>*</span></div>
                  {subs[a.id] === undefined ? (
                    <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}><Loader2 size={11} className="animate-spin inline mr-1" />{t('sec.publisher.pagesLoading', 'страницы…')}</div>
                  ) : (subs[a.id] || []).length === 0 ? (
                    <div className="text-[11.5px]" style={{ color: '#f59e0b' }}>{t('sec.publisher.fbNoPages', 'Страницы не найдены — проверьте подключение Facebook в кабинете Blotato.')}</div>
                  ) : (
                    <Sel value={aOpts[a.id]?.pageId || ''} onChange={(v) => setAccountOpt(a.id, 'pageId', v)}
                      options={[['', t('sec.publisher.fbChoosePage', '— выберите страницу —')], ...(subs[a.id] || []).map((s): [string, string] => [s.id, s.name])]} />
                  )}
                </OptCard>
              ))}
              {selAccounts.filter((a) => a.platform === 'pinterest').map((a) => (
                <OptCard key={a.id} platform="pinterest">
                  <div className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{a.name || a.username || a.id} · {t('sec.publisher.pinBoardWord', 'доска')} <span style={{ color: '#ef4444' }}>*</span></div>
                  {boards[a.id] === undefined ? (
                    <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}><Loader2 size={11} className="animate-spin inline mr-1" />{t('sec.publisher.boardsLoading', 'доски…')}</div>
                  ) : (boards[a.id] || []).length === 0 ? (
                    <div className="text-[11.5px]" style={{ color: '#f59e0b' }}>{t('sec.publisher.pinNoBoards', 'Доски не найдены — создайте доску в Pinterest.')}</div>
                  ) : (
                    <Sel value={aOpts[a.id]?.boardId || ''} onChange={(v) => setAccountOpt(a.id, 'boardId', v)}
                      options={[['', t('sec.publisher.pinChooseBoard', '— выберите доску —')], ...(boards[a.id] || []).map((b): [string, string] => [b.id, b.name])]} />
                  )}
                  <input value={aOpts[a.id]?.link || ''} onChange={(e) => setAccountOpt(a.id, 'link', e.target.value)}
                    placeholder={t('sec.publisher.pinLinkPh', 'Ссылка пина (необязательно)')}
                    className="w-full rounded-lg px-2.5 py-1.5 text-[12px] mt-1"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                </OptCard>
              ))}
              {selAccounts.filter((a) => a.platform === 'linkedin').map((a) => (
                <OptCard key={a.id} platform="linkedin">
                  <div className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.liPublishAs', 'Публикация от имени')}</div>
                  <Sel value={aOpts[a.id]?.pageId || ''} onChange={(v) => { setAccountOpt(a.id, 'pageId', v); if (!subs[a.id]) void loadSubs(a.id); }}
                    options={[['', t('sec.publisher.liPersonal', 'Личный профиль')], ...((subs[a.id] || []).map((s): [string, string] => [s.id, s.name]))]} />
                  {subs[a.id] === undefined && (
                    <button type="button" onClick={() => void loadSubs(a.id)} className="text-[11px] mt-1 inline-flex items-center gap-1"
                      style={{ background: 'transparent', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 0 }}>
                      <RefreshCw size={10} /> {t('sec.publisher.liLoadPages', 'загрузить страницы компаний')}
                    </button>
                  )}
                </OptCard>
              ))}
              {selPlatforms.includes('threads') && (
                <OptCard platform="threads">
                  <Sel value={pOpts.threads?.replyControl || 'everyone'} onChange={(v) => setPlatformOpt('threads', 'replyControl', v)}
                    options={[['everyone', t('sec.publisher.thReplyEveryone', 'Отвечают все')], ['accounts_you_follow', t('sec.publisher.thReplyFollowing', 'Только кого читаю')], ['mentioned_only', t('sec.publisher.thReplyMentioned', 'Только упомянутые')]]} />
                </OptCard>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Пикер медиа из Галереи (единый компонент сервиса) */}
      <GalleryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={pickFromGallery}
        title={t('sec.publisher.pickerTitle', 'Медиа для поста — из Галереи')}
        defaultTab="reference"
        token={token}
        note={t('sec.publisher.pickerNote', 'Подходят видео и фото. TikTok/Instagram/YouTube/Pinterest без медиа не публикуют.')}
        onlyType={['image', 'video']}
      />
    </div>
  );
}

export default PublisherStudio;
