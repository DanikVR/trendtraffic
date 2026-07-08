/**
 * PublisherStudio — полноэкранная студия «Новый пост» (Публикатор, Ф1).
 *
 * Решение В4 (08.07.2026): не модалка, а фулскрин-оверлей в духе UGC-студии.
 * Слева — медиа из Галереи (GalleryPicker) с превью 9:16; в центре — текст поста
 * со счётчиками лимитов по выбранным сетям; справа — аккаунты Blotato (тумблеры)
 * + платформенные опции (обязательные поля TikTok/YouTube всегда на виду,
 * Facebook требует страницу, Pinterest — доску) + «Когда»: Сейчас / Дата и время /
 * Следующий слот расписания Blotato.
 *
 * Сабмит: POST /api/publisher/posts — по вызову на каждый включённый аккаунт
 * (лимит Blotato 30 постов/мин бэкенд бережёт паузами). Частичные ошибки
 * показываются по-платформенно, успех закрывает студию в ленту Публикатора.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Loader2, Send, ImagePlus, X, Clock, CalendarClock, Zap, Check,
  AlertTriangle, ChevronDown, RefreshCw, ExternalLink,
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

interface StudioInitial { assetId?: string; mediaUrl?: string; title?: string }

interface TargetResult { platform: string; ok: boolean; error?: string }

export function PublisherStudio({ token, initial, onClose, onPublished }: {
  token: string | null;
  initial: StudioInitial;
  onClose: () => void;
  onPublished: () => void;
}) {
  const jsonHeaders = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

  const [media, setMedia] = useState<StudioInitial | null>(initial.mediaUrl ? initial : null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaNote, setMediaNote] = useState<string | null>(null);
  const [text, setText] = useState('');

  const [accounts, setAccounts] = useState<PubAccount[]>([]);
  const [accLoading, setAccLoading] = useState(true);
  const [accErr, setAccErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // accountId

  // Опции: per-платформа (общие) + per-аккаунт (страница FB / доска Pinterest / страница LinkedIn).
  const [pOpts, setPOpts] = useState<Record<string, Record<string, any>>>({
    tiktok: { privacyLevel: 'PUBLIC_TO_EVERYONE', isAiGenerated: true },
    youtube: { privacyStatus: 'public', shouldNotifySubscribers: true },
    instagram: { mediaType: 'reel' },
  });
  const [aOpts, setAOpts] = useState<Record<string, Record<string, any>>>({});
  const [subs, setSubs] = useState<Record<string, { id: string; name: string }[]>>({}); // accountId → страницы/плейлисты
  const [boards, setBoards] = useState<Record<string, { id: string; name: string }[]>>({}); // accountId → доски Pinterest

  const [mode, setMode] = useState<'now' | 'time' | 'slot'>('now');
  const [when, setWhen] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<TargetResult[] | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setAccLoading(true);
      try {
        const r = await fetch('/api/publisher/accounts', { headers: jsonHeaders() });
        if (r.status === 409) { setAccErr('Нет ключа Blotato — введите его в Настройки → Генерация → Blotato.'); return; }
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        setAccounts(((await r.json()).accounts || []) as PubAccount[]);
      } catch (e: any) { setAccErr(e?.message || 'Не удалось загрузить аккаунты'); }
      finally { setAccLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc закрывает студию (как в остальных оверлеях).
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const selAccounts = useMemo(() => accounts.filter((a) => selected.has(a.id)), [accounts, selected]);
  const selPlatforms = useMemo(() => Array.from(new Set(selAccounts.map((a) => a.platform))), [selAccounts]);

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
      // Единственная страница — подставляем сразу (меньше кликов).
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
        // Заголовок YouTube — из имени файла/первой строки текста, если пусто.
        if (a.platform === 'youtube' && !pOpts.youtube?.title) {
          const t = (media?.title || text.split('\n')[0] || '').trim().slice(0, 100);
          if (t) setPlatformOpt('youtube', 'title', t);
        }
      }
      return next;
    });
  };

  const pickFromGallery = (g: GalleryPickItem) => {
    if (g.type !== 'video' && g.type !== 'image') { setMediaNote('Для постов подходят видео и фото.'); return; }
    setMediaNote(null);
    setMedia({ mediaUrl: g.fileUrl, title: g.title });
    setPickerOpen(false);
  };

  // ── Валидация перед сабмитом ────────────────────────────────────────────────
  const problems = useMemo(() => {
    const list: string[] = [];
    if (selAccounts.length === 0) list.push('Выберите хотя бы один аккаунт.');
    if (!media && selPlatforms.some((p) => MEDIA_REQUIRED.has(p))) {
      list.push('TikTok / Instagram / YouTube / Pinterest требуют видео или фото — добавьте медиа.');
    }
    if (!media && !text.trim()) list.push('Добавьте медиа или текст поста.');
    if (selPlatforms.includes('youtube') && !(pOpts.youtube?.title || '').trim()) list.push('YouTube: заполните название ролика.');
    for (const a of selAccounts) {
      if (a.platform === 'facebook' && !aOpts[a.id]?.pageId) list.push(`Facebook (${a.name || a.username || a.id}): выберите страницу.`);
      if (a.platform === 'pinterest' && !aOpts[a.id]?.boardId) list.push(`Pinterest (${a.name || a.username || a.id}): выберите доску.`);
    }
    if (mode === 'time' && !when) list.push('Укажите дату и время публикации.');
    for (const p of selPlatforms) {
      const lim = TEXT_LIMITS[p];
      if (lim && text.length > lim) list.push(`${PLATFORM_META[p]?.label || p}: текст длиннее лимита ${lim}.`);
    }
    return list;
  }, [selAccounts, selPlatforms, media, text, pOpts, aOpts, mode, when]);

  const submit = async () => {
    if (problems.length > 0 || submitting) return;
    setSubmitting(true); setSubmitErr(null); setResults(null);
    try {
      const targets = selAccounts.map((a) => ({
        accountId: a.id,
        platform: a.platform,
        options: {
          ...(pOpts[a.platform] || {}),
          ...(aOpts[a.id] || {}),
          accountName: a.username ? `@${a.username}` : (a.name || a.platform),
        },
      }));
      const body: Record<string, any> = {
        assetId: media?.assetId || undefined,
        mediaUrl: media?.assetId ? undefined : media?.mediaUrl,
        text, mode, targets,
      };
      if (mode === 'time') body.scheduledAt = new Date(when).toISOString();
      const r = await fetch('/api/publisher/posts', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok && !Array.isArray(d.results)) throw new Error(d.error || `HTTP ${r.status}`);
      const rs: TargetResult[] = (d.results || []).map((x: any) => ({ platform: x.platform, ok: !!x.ok, error: x.error }));
      setResults(rs);
      if (rs.length > 0 && rs.every((x) => x.ok)) setTimeout(() => onPublished(), 900);
    } catch (e: any) { setSubmitErr(e?.message || 'Не удалось отправить'); }
    finally { setSubmitting(false); }
  };

  // ── Мелкие UI-примитивы студии ─────────────────────────────────────────────
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

  const overLimit = (p: string) => TEXT_LIMITS[p] && text.length > TEXT_LIMITS[p];

  return (
    <div className="fixed inset-0 z-[95] flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Топбар */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <button type="button" onClick={onClose}
          className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Закрыть
        </button>
        <span className="inline-flex items-center gap-2 text-[15px] font-700" style={{ color: 'var(--text-primary)' }}>
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}><Send size={14} color="#fff" /></span>
          Новый пост
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
            {mode === 'now' ? 'Опубликовать' : 'Запланировать'}{selAccounts.length > 0 ? ` · ${selAccounts.length}` : ''}
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
              <PlatformMark platform={r.platform} size={16} /> {r.ok ? <Check size={12} /> : <X size={12} />} {r.ok ? 'отправлено' : (r.error || 'ошибка')}
            </span>
          ))}
          {results && results.every((r) => r.ok) && <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Готово — открываю ленту Публикатора…</span>}
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto p-4 grid gap-4 items-start" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
          <div className="grid gap-4 items-start lg:grid-cols-[230px_minmax(0,1fr)_330px]">

            {/* ── Медиа ── */}
            <div className="space-y-2">
              <div className="text-[11px] font-700 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Медиа</div>
              <div className="rounded-2xl overflow-hidden relative" style={{ aspectRatio: '9 / 16', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', maxWidth: 230 }}>
                {media?.mediaUrl ? (
                  <>
                    {/\.(png|jpe?g|webp|gif)(\?|$)/i.test(media.mediaUrl)
                      ? <img src={media.mediaUrl} alt="" className="w-full h-full object-cover" />
                      : <video src={`${media.mediaUrl}#t=0.1`} muted preload="metadata" controls className="w-full h-full object-cover" />}
                    <button type="button" onClick={() => setMedia(null)} title="Убрать медиа"
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                  </>
                ) : (
                  <button type="button" onClick={() => setPickerOpen(true)}
                    className="w-full h-full flex flex-col items-center justify-center gap-2"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <ImagePlus size={26} />
                    <span className="text-[12px] font-600">Из Галереи</span>
                  </button>
                )}
              </div>
              {media?.title && <div className="text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }} title={media.title}>{media.title}</div>}
              <button type="button" onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                <ImagePlus size={13} /> {media ? 'Заменить' : 'Выбрать'}
              </button>
              {mediaNote && <div className="text-[11.5px]" style={{ color: '#f59e0b' }}>{mediaNote}</div>}
            </div>

            {/* ── Текст ── */}
            <div className="space-y-2 min-w-0">
              <div className="text-[11px] font-700 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Текст поста</div>
              <textarea value={text} onChange={(e) => { setText(e.target.value); setResults(null); }}
                placeholder={'Подпись к посту: хук в первой строке, дальше суть и призыв…\n\n#хэштеги'}
                className="w-full rounded-xl p-3 text-[13.5px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: 220, resize: 'vertical' }} />
              {selPlatforms.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {selPlatforms.map((p) => (
                    <span key={p} className="text-[11px] tabular-nums font-600" style={{ color: overLimit(p) ? '#ef4444' : 'var(--text-muted)' }}>
                      {PLATFORM_META[p]?.mark || p} {text.length}/{TEXT_LIMITS[p] || '∞'}{overLimit(p) ? ' ✕' : ''}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Один текст на все сети (Ф1). Персональные версии под каждый аккаунт и ИИ-подписи с хэштегами — следующий этап.
              </p>

              {/* Когда публикуем */}
              <div className="pt-2 space-y-2">
                <div className="text-[11px] font-700 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Когда</div>
                <div className="inline-flex gap-1 p-1 rounded-xl flex-wrap" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                  {([['now', 'Сейчас', <Zap key="z" size={13} />], ['time', 'Дата и время', <CalendarClock key="c" size={13} />], ['slot', 'Следующий слот', <Clock key="s" size={13} />]] as ['now' | 'time' | 'slot', string, React.ReactNode][]).map(([k, l, ic]) => (
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
                  <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                    Пост займёт ближайший свободный слот вашего расписания в Blotato (настраивается в их кабинете; на части тарифов Blotato слоты недоступны — тогда придёт ошибка).
                  </p>
                )}
              </div>
            </div>

            {/* ── Аккаунты + опции ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-700 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Куда публикуем</div>
                <a href={BLOTATO_SETTINGS_URL} target="_blank" rel="noreferrer" className="text-[11px] font-600 inline-flex items-center gap-1" style={{ color: 'var(--brand)', textDecoration: 'none' }}>
                  <ExternalLink size={11} /> подключить ещё
                </a>
              </div>

              {accLoading ? (
                <div className="py-6 text-center"><Loader2 size={18} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
              ) : accErr ? (
                <div className="text-[12.5px] rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>{accErr}</div>
              ) : accounts.length === 0 ? (
                <div className="text-[12.5px] rounded-xl p-3" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', color: 'var(--text-muted)' }}>
                  Соцсети ещё не подключены. Откройте кабинет Blotato (ссылка выше), подключите сети и вернитесь.
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

              {/* Платформенные опции — только для выбранных сетей */}
              {selPlatforms.includes('tiktok') && (
                <OptCard platform="tiktok">
                  <Sel value={pOpts.tiktok?.privacyLevel || 'PUBLIC_TO_EVERYONE'} onChange={(v) => setPlatformOpt('tiktok', 'privacyLevel', v)}
                    options={[['PUBLIC_TO_EVERYONE', 'Публичный'], ['MUTUAL_FOLLOW_FRIENDS', 'Друзья'], ['FOLLOWER_OF_CREATOR', 'Подписчики'], ['SELF_ONLY', 'Только я']]} />
                  <Tgl on={!pOpts.tiktok?.disabledComments} onClick={() => setPlatformOpt('tiktok', 'disabledComments', !pOpts.tiktok?.disabledComments)} label="Комментарии" />
                  <Tgl on={!pOpts.tiktok?.disabledDuet} onClick={() => setPlatformOpt('tiktok', 'disabledDuet', !pOpts.tiktok?.disabledDuet)} label="Дуэты" />
                  <Tgl on={!pOpts.tiktok?.disabledStitch} onClick={() => setPlatformOpt('tiktok', 'disabledStitch', !pOpts.tiktok?.disabledStitch)} label="Ститчи" />
                  <Tgl on={!!pOpts.tiktok?.isBrandedContent} onClick={() => setPlatformOpt('tiktok', 'isBrandedContent', !pOpts.tiktok?.isBrandedContent)} label="Брендированный контент" hint="Платное партнёрство" />
                  <Tgl on={!!pOpts.tiktok?.isYourBrand} onClick={() => setPlatformOpt('tiktok', 'isYourBrand', !pOpts.tiktok?.isYourBrand)} label="Продвигаю свой бренд" />
                  <Tgl on={pOpts.tiktok?.isAiGenerated !== false} onClick={() => setPlatformOpt('tiktok', 'isAiGenerated', pOpts.tiktok?.isAiGenerated === false)} label="Метка «ИИ-контент»" hint="Обязательная честная метка для сгенерированных роликов" />
                  <Tgl on={!!pOpts.tiktok?.isDraft} onClick={() => setPlatformOpt('tiktok', 'isDraft', !pOpts.tiktok?.isDraft)} label="В черновики TikTok" hint="Пост попадёт в черновики приложения — опубликуете вручную после проверки" />
                </OptCard>
              )}
              {selPlatforms.includes('youtube') && (
                <OptCard platform="youtube">
                  <input value={pOpts.youtube?.title || ''} onChange={(e) => setPlatformOpt('youtube', 'title', e.target.value)}
                    placeholder="Название ролика (обязательно)" maxLength={100}
                    className="w-full rounded-lg px-2.5 py-1.5 text-[12.5px] mb-1"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  <Sel value={pOpts.youtube?.privacyStatus || 'public'} onChange={(v) => setPlatformOpt('youtube', 'privacyStatus', v)}
                    options={[['public', 'Публичный'], ['unlisted', 'По ссылке'], ['private', 'Приватный']]} />
                  <Tgl on={pOpts.youtube?.shouldNotifySubscribers !== false} onClick={() => setPlatformOpt('youtube', 'shouldNotifySubscribers', pOpts.youtube?.shouldNotifySubscribers === false)} label="Уведомить подписчиков" />
                  <Tgl on={!!pOpts.youtube?.isMadeForKids} onClick={() => setPlatformOpt('youtube', 'isMadeForKids', !pOpts.youtube?.isMadeForKids)} label="Для детей (madeForKids)" />
                </OptCard>
              )}
              {selPlatforms.includes('instagram') && (
                <OptCard platform="instagram">
                  <Sel value={pOpts.instagram?.mediaType || 'reel'} onChange={(v) => setPlatformOpt('instagram', 'mediaType', v)}
                    options={[['reel', 'Reel'], ['post', 'Пост в ленту'], ['story', 'Story']]} />
                </OptCard>
              )}
              {selAccounts.filter((a) => a.platform === 'facebook').map((a) => (
                <OptCard key={a.id} platform="facebook">
                  <div className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{a.name || a.username || a.id} · страница <span style={{ color: '#ef4444' }}>*</span></div>
                  {subs[a.id] === undefined ? (
                    <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}><Loader2 size={11} className="animate-spin inline mr-1" />страницы…</div>
                  ) : (subs[a.id] || []).length === 0 ? (
                    <div className="text-[11.5px]" style={{ color: '#f59e0b' }}>Страницы не найдены — проверьте подключение Facebook в кабинете Blotato.</div>
                  ) : (
                    <Sel value={aOpts[a.id]?.pageId || ''} onChange={(v) => setAccountOpt(a.id, 'pageId', v)}
                      options={[['', '— выберите страницу —'], ...(subs[a.id] || []).map((s): [string, string] => [s.id, s.name])]} />
                  )}
                </OptCard>
              ))}
              {selAccounts.filter((a) => a.platform === 'pinterest').map((a) => (
                <OptCard key={a.id} platform="pinterest">
                  <div className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{a.name || a.username || a.id} · доска <span style={{ color: '#ef4444' }}>*</span></div>
                  {boards[a.id] === undefined ? (
                    <div className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}><Loader2 size={11} className="animate-spin inline mr-1" />доски…</div>
                  ) : (boards[a.id] || []).length === 0 ? (
                    <div className="text-[11.5px]" style={{ color: '#f59e0b' }}>Доски не найдены — создайте доску в Pinterest.</div>
                  ) : (
                    <Sel value={aOpts[a.id]?.boardId || ''} onChange={(v) => setAccountOpt(a.id, 'boardId', v)}
                      options={[['', '— выберите доску —'], ...(boards[a.id] || []).map((b): [string, string] => [b.id, b.name])]} />
                  )}
                  <input value={aOpts[a.id]?.link || ''} onChange={(e) => setAccountOpt(a.id, 'link', e.target.value)}
                    placeholder="Ссылка пина (необязательно)"
                    className="w-full rounded-lg px-2.5 py-1.5 text-[12px] mt-1"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                </OptCard>
              ))}
              {selAccounts.filter((a) => a.platform === 'linkedin').map((a) => (
                <OptCard key={a.id} platform="linkedin">
                  <div className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Публикация от имени</div>
                  <Sel value={aOpts[a.id]?.pageId || ''} onChange={(v) => { setAccountOpt(a.id, 'pageId', v); if (!subs[a.id]) void loadSubs(a.id); }}
                    options={[['', 'Личный профиль'], ...((subs[a.id] || []).map((s): [string, string] => [s.id, s.name]))]} />
                  {subs[a.id] === undefined && (
                    <button type="button" onClick={() => void loadSubs(a.id)} className="text-[11px] mt-1 inline-flex items-center gap-1"
                      style={{ background: 'transparent', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 0 }}>
                      <RefreshCw size={10} /> загрузить страницы компаний
                    </button>
                  )}
                </OptCard>
              ))}
              {selPlatforms.includes('threads') && (
                <OptCard platform="threads">
                  <Sel value={pOpts.threads?.replyControl || 'everyone'} onChange={(v) => setPlatformOpt('threads', 'replyControl', v)}
                    options={[['everyone', 'Отвечают все'], ['accounts_you_follow', 'Только кого читаю'], ['mentioned_only', 'Только упомянутые']]} />
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
        title="Медиа для поста — из Галереи"
        defaultTab="reference"
        token={token}
        note="Подходят видео и фото. TikTok/Instagram/YouTube/Pinterest без медиа не публикуют."
      />
    </div>
  );
}

export default PublisherStudio;
