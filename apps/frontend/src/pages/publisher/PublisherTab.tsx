/**
 * PublisherTab — вкладка «Публикатор» в Галерее (Ф1–Ф5).
 *
 * Саб-разделы: Лента (посты со статусами) · Календарь (неделя, перенос/отмена) ·
 * Моё расписание (СВОИ слоты + цепочки: ручные серии и авто из роликов автопилота) ·
 * Аналитика (Blotato: X/IG/FB/Threads/Bluesky; TikTok/YouTube — «Каналы»/TikHub).
 *
 * Провайдер — Blotato BYO: у каждого пользователя свой аккаунт и ключ (Настройки → Ключи,
 * живая «Проверить»). Плитки сетей ведут сразу на нужную страницу кабинета Blotato.
 * Слоты хранятся в UTC (бэкенд), UI показывает и принимает МЕСТНОЕ время.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, RefreshCw, Loader2, ExternalLink, Plus, Check, Clock, RotateCcw, Trash2,
  Ban, KeyRound, AlertTriangle, Link2, CalendarDays, ListChecks, BarChart3, Timer,
  ChevronLeft, ChevronRight, Zap, X, Sparkles,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

/** Кабинет Blotato — соцсети подключаются там; открываем сразу нужную страницу. */
export const BLOTATO_SETTINGS_URL = 'https://my.blotato.com/settings';

export interface PubAccount { id: string; platform: string; name?: string; username?: string }

export const PLATFORM_META: Record<string, { label: string; mark: string; bg: string }> = {
  tiktok:    { label: 'TikTok',      mark: 'TT',  bg: '#0F766E' },
  instagram: { label: 'Instagram',   mark: 'IG',  bg: 'linear-gradient(135deg,#F58529,#DD2A7B 60%,#8134AF)' },
  youtube:   { label: 'YouTube',     mark: 'YT',  bg: '#DC2626' },
  twitter:   { label: 'X (Twitter)', mark: 'X',   bg: '#3F3F46' },
  facebook:  { label: 'Facebook',    mark: 'FB',  bg: '#1877F2' },
  linkedin:  { label: 'LinkedIn',    mark: 'LI',  bg: '#0A66C2' },
  threads:   { label: 'Threads',     mark: 'TH',  bg: '#52525B' },
  bluesky:   { label: 'Bluesky',     mark: 'BS',  bg: '#0285FF' },
  pinterest: { label: 'Pinterest',   mark: 'PIN', bg: '#B91C1C' },
};
export const PLATFORM_ORDER = ['tiktok', 'instagram', 'youtube', 'twitter', 'facebook', 'linkedin', 'threads', 'bluesky', 'pinterest'];

export function PlatformMark({ platform, size = 26 }: { platform: string; size?: number }) {
  const m = PLATFORM_META[platform] || { mark: '?', bg: 'var(--border-strong)' };
  return (
    <span className="rounded-lg flex items-center justify-center flex-shrink-0 font-700"
      style={{ width: size, height: size, background: m.bg, color: '#fff', fontSize: Math.max(8, Math.round(size * 0.34)) }}>
      {m.mark}
    </span>
  );
}

export interface PubPostRow {
  id: string; group_id: string; chain_id?: string | null; asset_id?: string | null; media_url?: string | null; text?: string | null;
  platform: string; account_id: string; account_name?: string | null; mode: string;
  scheduled_at?: string | null; status: string; post_url?: string | null; error?: string | null;
  retries?: number; next_retry_at?: string | null; created_at: string;
}

interface SlotRow { id: number; dow: number; hh: number; mm: number }
interface ChainRow {
  id: string; name: string; kind: 'manual' | 'auto'; items: any[]; targets: any[];
  caption: any; daily_cap: number; enabled: boolean; cursor: number; fail_streak: number;
  last_error?: string | null; last_run_at?: string | null; created_at: string;
  stats?: Record<string, number>;
}

export interface ChainDraft { items: { assetId?: string; mediaUrl?: string; title?: string }[] }

type KeyState = 'loading' | 'none' | 'bad' | 'ok';
type SubTab = 'feed' | 'calendar' | 'schedule' | 'analytics';

const DOW_LABEL = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Пн..Вс (JS getDay)
const pad2 = (n: number) => String(n).padStart(2, '0');

/** UTC-слот → как он выглядит в местном времени (для показа). */
function slotToLocal(s: { dow: number; hh: number; mm: number }): { dow: number; hh: number; mm: number } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), s.hh, s.mm, 0));
  d.setUTCDate(d.getUTCDate() + ((s.dow - d.getUTCDay() + 7) % 7));
  return { dow: d.getDay(), hh: d.getHours(), mm: d.getMinutes() };
}
/** Местные день/время → UTC-слот (для сохранения). */
function localToSlot(dowLocal: number, hh: number, mm: number): { dow: number; hh: number; mm: number } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0);
  d.setDate(d.getDate() + ((dowLocal - d.getDay() + 7) % 7));
  return { dow: d.getUTCDay(), hh: d.getUTCHours(), mm: d.getUTCMinutes() };
}
const fmtDT = (iso: string) => new Date(iso).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function PublisherTab({ token, reloadKey, onNewPost, chainDraft, onChainDraftConsumed }: {
  token: string | null;
  reloadKey: number;
  onNewPost: () => void;
  /** Черновик серии из мультивыбора Галереи («Опубликовать N») — открывает форму цепочки. */
  chainDraft?: ChainDraft | null;
  onChainDraftConsumed?: () => void;
}) {
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubTab>('feed');
  const [keyState, setKeyState] = useState<KeyState>('loading');
  const [accounts, setAccounts] = useState<PubAccount[]>([]);
  const [accLoading, setAccLoading] = useState(false);
  const [posts, setPosts] = useState<PubPostRow[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // Ф2: слоты + цепочки
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [nextFree, setNextFree] = useState<string[]>([]);
  const [slotDow, setSlotDow] = useState(1);
  const [slotTime, setSlotTime] = useState('18:30');
  const [slotBusy, setSlotBusy] = useState(false);
  const [chains, setChains] = useState<ChainRow[]>([]);
  const [chainBusy, setChainBusy] = useState(false);
  // форма цепочки (ручная — из chainDraft; авто — кнопкой)
  const [chainForm, setChainForm] = useState<null | {
    kind: 'manual' | 'auto'; name: string; items: ChainDraft['items'];
    accIds: Set<string>; captionMode: 'ai' | 'fixed'; captionText: string; tone: string; dailyCap: number;
  }>(null);

  // Ф2: календарь
  const [weekOff, setWeekOff] = useState(0);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveVal, setMoveVal] = useState('');

  // Ф5: аналитика
  const [ana, setAna] = useState<any[] | null>(null);
  const [anaLoading, setAnaLoading] = useState(false);
  const [anaErr, setAnaErr] = useState<string | null>(null);

  const jsonHeaders = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

  const loadAccounts = async (refresh = false) => {
    setAccLoading(true);
    try {
      const r = await fetch(`/api/publisher/accounts${refresh ? '?refresh=1' : ''}`, { headers: jsonHeaders() });
      if (r.status === 409) {
        const d = await r.json().catch(() => ({}));
        setKeyState(d.error === 'bad_key' ? 'bad' : 'none');
        setAccounts([]);
        return;
      }
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      setKeyState('ok');
      setAccounts(((await r.json()).accounts || []) as PubAccount[]);
    } catch (e: any) { setErr(e?.message || 'Не удалось загрузить аккаунты'); }
    finally { setAccLoading(false); }
  };

  const loadPosts = async (silent = false) => {
    if (!silent) setPostsLoading(true);
    try {
      const r = await fetch('/api/publisher/posts?limit=300', { headers: jsonHeaders() });
      if (r.ok) setPosts(((await r.json()).posts || []) as PubPostRow[]);
    } catch { /* тихо */ }
    finally { if (!silent) setPostsLoading(false); }
  };

  const loadSlots = async () => {
    try {
      const r = await fetch('/api/publisher/slots', { headers: jsonHeaders() });
      if (r.ok) { const d = await r.json(); setSlots(d.slots || []); setNextFree(d.next || []); }
    } catch { /* тихо */ }
  };
  const loadChains = async () => {
    try {
      const r = await fetch('/api/publisher/chains', { headers: jsonHeaders() });
      if (r.ok) setChains(((await r.json()).chains || []) as ChainRow[]);
    } catch { /* тихо */ }
  };

  const loadAll = async () => {
    setErr(null);
    try {
      const r = await fetch('/api/publisher/status', { headers: jsonHeaders() });
      const d = r.ok ? await r.json() : { hasKey: false };
      if (!d.hasKey) { setKeyState('none'); setPosts([]); return; }
      await Promise.all([loadAccounts(false), loadPosts(false), loadSlots(), loadChains()]);
    } catch (e: any) { setErr(e?.message || 'Публикатор недоступен'); }
  };

  useEffect(() => { void loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [reloadKey]);

  // Черновик серии из Галереи → открыть форму ручной цепочки
  useEffect(() => {
    if (chainDraft && chainDraft.items?.length) {
      setSub('schedule');
      setChainForm({
        kind: 'manual', name: `Серия из Галереи (${chainDraft.items.length})`, items: chainDraft.items,
        accIds: new Set(), captionMode: 'ai', captionText: '', tone: 'engaging', dailyCap: 3,
      });
      onChainDraftConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainDraft]);

  // Поллинг, пока есть посты «в полёте».
  const pendingCount = useMemo(() => posts.filter((p) => p.status === 'submitted' || (p.status === 'scheduled' && p.scheduled_at && new Date(p.scheduled_at).getTime() < Date.now() + 120000)).length, [posts]);
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (keyState === 'ok' && pendingCount > 0) {
      pollRef.current = window.setInterval(() => { void loadPosts(true); }, 8000);
    }
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyState, pendingCount > 0]);

  const groups = useMemo(() => {
    const map = new Map<string, PubPostRow[]>();
    for (const p of posts) { const arr = map.get(p.group_id) || []; arr.push(p); map.set(p.group_id, arr); }
    return Array.from(map.values());
  }, [posts]);

  const counts = useMemo(() => ({
    queued: posts.filter((p) => p.status === 'scheduled' || p.status === 'submitted').length,
    published: posts.filter((p) => p.status === 'published').length,
    failed: posts.filter((p) => p.status === 'failed').length,
  }), [posts]);

  const byPlatform = useMemo(() => {
    const m = new Map<string, PubAccount[]>();
    for (const a of accounts) { const arr = m.get(a.platform) || []; arr.push(a); m.set(a.platform, arr); }
    return m;
  }, [accounts]);

  const retry = async (row: PubPostRow) => {
    setRowBusy(row.id);
    try {
      const r = await fetch(`/api/publisher/posts/${row.id}/retry`, { method: 'POST', headers: jsonHeaders() });
      if (!r.ok) setErr((await r.json().catch(() => ({}))).error || 'Не удалось повторить');
      await loadPosts(true);
    } finally { setRowBusy(null); }
  };
  const removeRow = (row: PubPostRow) => {
    const isSched = row.status === 'scheduled';
    setConfirm({
      title: isSched ? 'Отменить публикацию?' : 'Убрать запись из истории?',
      message: isSched
        ? `Запланированный пост в ${PLATFORM_META[row.platform]?.label || row.platform} будет снят из очереди Blotato.`
        : 'Сам пост в соцсети (если он опубликован) не удаляется — только запись в ленте Публикатора.',
      onConfirm: async () => {
        setConfirm(null); setRowBusy(row.id);
        try {
          const r = await fetch(`/api/publisher/posts/${row.id}`, { method: 'DELETE', headers: jsonHeaders() });
          if (!r.ok) setErr((await r.json().catch(() => ({}))).error || 'Не удалось удалить');
          await loadPosts(true);
        } finally { setRowBusy(null); }
      },
    });
  };
  const movePost = async (row: PubPostRow) => {
    if (!moveVal) return;
    setRowBusy(row.id);
    try {
      const r = await fetch(`/api/publisher/posts/${row.id}`, {
        method: 'PATCH', headers: jsonHeaders(),
        body: JSON.stringify({ scheduledAt: new Date(moveVal).toISOString() }),
      });
      if (!r.ok) setErr((await r.json().catch(() => ({}))).error || 'Не удалось перенести');
      setMoveId(null); setMoveVal('');
      await loadPosts(true);
    } finally { setRowBusy(null); }
  };

  // ── Слоты ──────────────────────────────────────────────────────────────────
  const addSlot = async () => {
    const [hh, mm] = slotTime.split(':').map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
    setSlotBusy(true);
    try {
      const utc = localToSlot(slotDow, hh, mm);
      const r = await fetch('/api/publisher/slots', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ slots: [utc] }) });
      if (!r.ok) setErr((await r.json().catch(() => ({}))).error || 'Не удалось добавить слот');
      await loadSlots();
    } finally { setSlotBusy(false); }
  };
  const delSlot = async (id: number) => {
    setSlotBusy(true);
    try { await fetch(`/api/publisher/slots/${id}`, { method: 'DELETE', headers: jsonHeaders() }); await loadSlots(); }
    finally { setSlotBusy(false); }
  };

  // ── Цепочки ────────────────────────────────────────────────────────────────
  const submitChain = async () => {
    if (!chainForm) return;
    const accs = accounts.filter((a) => chainForm.accIds.has(a.id));
    if (!accs.length) { setErr('Выберите аккаунты для цепочки'); return; }
    setChainBusy(true); setErr(null);
    try {
      const body: any = {
        kind: chainForm.kind, name: chainForm.name,
        targets: accs.map((a) => ({ accountId: a.id, platform: a.platform, options: { accountName: a.username ? `@${a.username}` : (a.name || a.platform) } })),
        caption: chainForm.captionMode === 'ai'
          ? { mode: 'ai', tone: chainForm.tone }
          : { mode: 'fixed', text: chainForm.captionText },
        dailyCap: chainForm.dailyCap,
      };
      if (chainForm.kind === 'manual') body.items = chainForm.items;
      const r = await fetch('/api/publisher/chains', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || 'Не удалось создать цепочку'); return; }
      setChainForm(null);
      await Promise.all([loadChains(), loadPosts(true), loadSlots()]);
    } finally { setChainBusy(false); }
  };
  const toggleChain = async (c: ChainRow) => {
    await fetch(`/api/publisher/chains/${c.id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ enabled: !c.enabled }) });
    await loadChains();
  };
  const deleteChain = (c: ChainRow) => setConfirm({
    title: `Удалить цепочку «${c.name}»?`,
    message: 'Её запланированные посты будут сняты из очереди. Уже опубликованное не трогаем.',
    onConfirm: async () => {
      setConfirm(null);
      await fetch(`/api/publisher/chains/${c.id}`, { method: 'DELETE', headers: jsonHeaders() });
      await Promise.all([loadChains(), loadPosts(true)]);
    },
  });

  // ── Аналитика ──────────────────────────────────────────────────────────────
  const loadAnalytics = async () => {
    setAnaLoading(true); setAnaErr(null);
    try {
      const r = await fetch('/api/publisher/analytics?days=30', { headers: jsonHeaders() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAnaErr(d.error || `HTTP ${r.status}`); setAna([]); return; }
      setAna(Array.isArray(d.items) ? d.items : []);
    } catch (e: any) { setAnaErr(e?.message || 'Не удалось загрузить'); setAna([]); }
    finally { setAnaLoading(false); }
  };
  useEffect(() => { if (sub === 'analytics' && ana === null && keyState === 'ok') void loadAnalytics(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sub, keyState]);

  const statusChip = (row: PubPostRow) => {
    const base = 'inline-flex items-center gap-1 text-[10.5px] font-700 px-2 py-0.5 rounded-full';
    if (row.status === 'published') {
      return row.post_url
        ? <a href={row.post_url} target="_blank" rel="noreferrer" className={base} title="Открыть пост"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', textDecoration: 'none' }}>
            <Check size={11} /> опубликован <ExternalLink size={10} />
          </a>
        : <span className={base} style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}><Check size={11} /> опубликован</span>;
    }
    if (row.status === 'failed') {
      const willRetry = row.next_retry_at && new Date(row.next_retry_at).getTime() > Date.now();
      return <span className={base} title={row.error || undefined} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
        <AlertTriangle size={11} /> ошибка{willRetry ? ` · повтор ${fmtDT(row.next_retry_at!)}` : ''}
      </span>;
    }
    if (row.status === 'canceled') {
      return <span className={base} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}><Ban size={11} /> отменён</span>;
    }
    const when = row.scheduled_at ? fmtDT(row.scheduled_at) : 'публикуется…';
    return <span className={base} style={{ background: 'rgba(245,158,11,0.13)', color: '#f59e0b' }}><Clock size={11} /> {when}</span>;
  };

  // ── Онбординг: ключа нет / ключ отклонён ──────────────────────────────────
  if (keyState === 'none' || keyState === 'bad') {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <Send size={22} color="#fff" />
            </span>
            <div>
              <p className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>Подключите Blotato — и публикуйте из Галереи</p>
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>TikTok, Instagram, YouTube, X, Facebook, LinkedIn, Threads, Bluesky, Pinterest — одним ключом.</p>
            </div>
          </div>
          {keyState === 'bad' && (
            <div className="flex items-start gap-2 text-[13px] rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
              <AlertTriangle size={15} className="mt-[1px] flex-shrink-0" />
              <span>Blotato отверг сохранённый ключ (401). Проверьте ключ в Настройках — возможно, он перевыпущен или на тарифе Blotato нет доступа к API.</span>
            </div>
          )}
          <ol className="space-y-2.5">
            {[
              <>Заведите <b>свой</b> аккаунт на <b>my.blotato.com</b> — у каждого пользователя TrendTraffic он свой (тариф Blotato с доступом к API).</>,
              <>В кабинете Blotato подключите соцсети: Settings → Social Accounts (пароли вводятся только в окнах самих платформ).</>,
              <>Создайте API-ключ (Settings → API) и вставьте его у нас: Настройки → Генерация → <b>Blotato</b> → «Проверить».</>,
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-[13.5px]" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 font-700 text-[12px]"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}>{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <a href={BLOTATO_SETTINGS_URL} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', textDecoration: 'none' }}>
              <ExternalLink size={15} /> Открыть кабинет Blotato
            </a>
            <button type="button" onClick={() => navigate('/settings/enterprise?section=openmontage')}
              className="inline-flex items-center gap-2 text-[13px] font-600 px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              <KeyRound size={15} /> Ввести ключ в Настройках
            </button>
            <button type="button" onClick={() => void loadAll()}
              className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2.5 rounded-xl ml-auto"
              style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              <RefreshCw size={14} /> Проверить снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (keyState === 'loading') {
    return <div className="py-16 text-center"><Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  // ── Календарь недели ────────────────────────────────────────────────────────
  const renderCalendar = () => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + weekOff * 7);
    const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    const sched = posts.filter((p) => p.status === 'scheduled' && p.scheduled_at);
    const byDay = (d: Date) => sched
      .filter((p) => { const t = new Date(p.scheduled_at!); return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() && t.getDate() === d.getDate(); })
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setWeekOff(weekOff - 1)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}><ChevronLeft size={15} /></button>
          <span className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>
            {days[0].toLocaleDateString([], { day: '2-digit', month: '2-digit' })} — {days[6].toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
          </span>
          <button type="button" onClick={() => setWeekOff(weekOff + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}><ChevronRight size={15} /></button>
          {weekOff !== 0 && <button type="button" onClick={() => setWeekOff(0)} className="text-[12px] font-600 px-2.5 py-1.5 rounded-lg" style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', cursor: 'pointer' }}>Сегодня</button>}
          <span className="text-[11.5px] ml-auto" style={{ color: 'var(--text-muted)' }}>Запланировано на неделю: {days.reduce((n, d) => n + byDay(d).length, 0)}</span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', minWidth: 1080 }}>
            {days.map((d, i) => {
              const items = byDay(d);
              const isToday = weekOff === 0 && d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
              return (
                <div key={i} className="rounded-xl p-2 space-y-1.5" style={{ background: 'var(--bg-secondary)', border: `1px solid ${isToday ? 'var(--brand)' : 'var(--border-medium)'}`, minHeight: 140 }}>
                  <div className="text-[11px] font-700 flex items-center justify-between" style={{ color: isToday ? 'var(--brand)' : 'var(--text-muted)' }}>
                    <span>{DOW_LABEL[d.getDay()]}</span><span>{pad2(d.getDate())}.{pad2(d.getMonth() + 1)}</span>
                  </div>
                  {items.map((p) => (
                    <div key={p.id} className="rounded-lg p-1.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-1.5">
                        <PlatformMark platform={p.platform} size={16} />
                        <span className="text-[11px] font-700 tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {pad2(new Date(p.scheduled_at!).getHours())}:{pad2(new Date(p.scheduled_at!).getMinutes())}
                        </span>
                        {p.chain_id && <span title="Пост цепочки"><Link2 size={10} style={{ color: 'var(--brand)' }} /></span>}
                      </div>
                      <div className="text-[10.5px] truncate mt-0.5" style={{ color: 'var(--text-secondary)' }} title={p.text || ''}>{(p.text || '').split('\n')[0] || '—'}</div>
                      {moveId === p.id ? (
                        <div className="mt-1 space-y-1">
                          <input type="datetime-local" value={moveVal} onChange={(e) => setMoveVal(e.target.value)}
                            className="w-full rounded-md px-1.5 py-1 text-[10.5px]"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                          <div className="flex gap-1">
                            <button type="button" onClick={() => void movePost(p)} disabled={rowBusy === p.id || !moveVal}
                              className="flex-1 text-[10.5px] font-700 py-1 rounded-md" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>OK</button>
                            <button type="button" onClick={() => { setMoveId(null); setMoveVal(''); }}
                              className="flex-1 text-[10.5px] font-600 py-1 rounded-md" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>×</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1 mt-1">
                          <button type="button" onClick={() => { setMoveId(p.id); setMoveVal(''); }} title="Перенести"
                            className="flex-1 text-[10px] font-600 py-0.5 rounded-md inline-flex items-center justify-center gap-1"
                            style={{ background: 'rgba(99,102,241,0.10)', color: 'var(--brand)', border: 'none', cursor: 'pointer' }}>
                            <Timer size={10} /> перенести
                          </button>
                          <button type="button" onClick={() => removeRow(p)} title="Отменить публикацию"
                            className="w-6 text-[10px] py-0.5 rounded-md" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>×</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {!items.length && <div className="text-[10.5px] text-center pt-6" style={{ color: 'var(--text-disabled)' }}>—</div>}
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Время местное. Перенос уходит в Blotato (PATCH расписания); отмена снимает пост из очереди.</p>
      </div>
    );
  };

  // ── «Моё расписание»: слоты + цепочки ──────────────────────────────────────
  const renderSchedule = () => {
    const slotsLocal = slots.map((s) => ({ ...s, local: slotToLocal(s) }));
    return (
      <div className="space-y-5">
        {/* Слоты */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <span className="text-[13.5px] font-700 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Clock size={15} /> Слоты публикаций <span className="text-[11px] font-500" style={{ color: 'var(--text-muted)' }}>— время местное; «Следующий слот» и цепочки берут времена отсюда</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <select value={slotDow} onChange={(e) => setSlotDow(Number(e.target.value))}
                className="text-[12.5px] font-600 rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                {DOW_ORDER.map((d) => <option key={d} value={d}>{DOW_LABEL[d]}</option>)}
              </select>
              <input type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)}
                className="text-[12.5px] rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
              <button type="button" onClick={() => void addSlot()} disabled={slotBusy}
                className="inline-flex items-center gap-1 text-[12.5px] font-700 px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                {slotBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Слот
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', minWidth: 900 }}>
              {DOW_ORDER.map((dw) => (
                <div key={dw} className="rounded-xl p-2" style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-medium)', minHeight: 72 }}>
                  <div className="text-[11px] font-700 mb-1.5 text-center" style={{ color: 'var(--text-muted)' }}>{DOW_LABEL[dw]}</div>
                  <div className="flex flex-col gap-1">
                    {slotsLocal.filter((s) => s.local.dow === dw).sort((a, b) => a.local.hh * 60 + a.local.mm - b.local.hh * 60 - b.local.mm).map((s) => (
                      <span key={s.id} className="inline-flex items-center justify-between gap-1 text-[11.5px] font-700 px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)' }}>
                        {pad2(s.local.hh)}:{pad2(s.local.mm)}
                        <button type="button" onClick={() => void delSlot(s.id)} title="Удалить слот"
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, lineHeight: 1 }}><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[12px] mt-2.5" style={{ color: 'var(--text-muted)' }}>
            {slots.length === 0
              ? 'Слотов пока нет — добавьте хотя бы один: без них не работают «Следующий слот» и цепочки.'
              : <>Ближайшие свободные: <b style={{ color: 'var(--text-primary)' }}>{nextFree.slice(0, 3).map(fmtDT).join(' · ') || '—'}</b></>}
          </div>
        </div>

        {/* Цепочки */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <span className="text-[13.5px] font-700 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Link2 size={15} /> Цепочки контента
              <span className="text-[11px] font-500" style={{ color: 'var(--text-muted)' }}>— серия из Галереи по слотам или автопубликация роликов автопилота</span>
            </span>
            <button type="button" onClick={() => setChainForm({ kind: 'auto', name: 'Авто: ролики конвейера трендов', items: [], accIds: new Set(), captionMode: 'ai', captionText: '', tone: 'engaging', dailyCap: 3 })}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-700 px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              <Zap size={13} /> Авто-цепочка
            </button>
          </div>

          {chainForm && (
            <div className="rounded-xl p-3 mb-3 space-y-2.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--brand)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-700 px-2 py-0.5 rounded-full" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}>
                  {chainForm.kind === 'manual' ? `Серия · ${chainForm.items.length} роликов` : 'Авто-цепочка'}
                </span>
                <input value={chainForm.name} onChange={(e) => setChainForm({ ...chainForm, name: e.target.value })}
                  className="flex-1 min-w-[200px] text-[13px] font-600 rounded-lg px-2.5 py-1.5"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                <button type="button" onClick={() => setChainForm(null)} className="w-7 h-7 rounded-lg" style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={13} className="mx-auto" /></button>
              </div>
              {chainForm.kind === 'auto' && (
                <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                  Источник: свежие ролики автопилота трендов (Галерея → UGC → «Авто»), которые ещё не публиковались. Тик раз в минуту ставит их в ближайший свободный слот; автопауза после 3 ошибок подряд.
                </p>
              )}
              <div>
                <div className="text-[11px] font-700 mb-1" style={{ color: 'var(--text-muted)' }}>КУДА ПУБЛИКУЕМ</div>
                <div className="flex flex-wrap gap-1.5">
                  {accounts.map((a) => {
                    const on = chainForm.accIds.has(a.id);
                    return (
                      <button key={a.id} type="button" onClick={() => {
                        const next = new Set(chainForm.accIds);
                        on ? next.delete(a.id) : next.add(a.id);
                        setChainForm({ ...chainForm, accIds: next });
                      }}
                        className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2 py-1 rounded-lg"
                        style={{ background: on ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-medium)'}`, color: on ? 'var(--brand)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                        <PlatformMark platform={a.platform} size={16} /> {a.username ? `@${a.username}` : (a.name || a.platform)} {on && <Check size={11} />}
                      </button>
                    );
                  })}
                  {accounts.length === 0 && <span className="text-[12px]" style={{ color: '#f59e0b' }}>Нет подключённых аккаунтов</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  {([['ai', '✦ Подпись ИИ'], ['fixed', 'Свой текст']] as ['ai' | 'fixed', string][]).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setChainForm({ ...chainForm, captionMode: k })}
                      className="text-[12px] font-600 px-2.5 py-1 rounded-md"
                      style={{ background: chainForm.captionMode === k ? 'var(--brand)' : 'transparent', color: chainForm.captionMode === k ? 'var(--brand-contrast)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{l}</button>
                  ))}
                </div>
                {chainForm.captionMode === 'ai' ? (
                  <select value={chainForm.tone} onChange={(e) => setChainForm({ ...chainForm, tone: e.target.value })}
                    className="text-[12px] font-600 rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                    <option value="engaging">Вовлекающий</option><option value="expert">Экспертный</option><option value="selling">Продающий</option>
                  </select>
                ) : (
                  <input value={chainForm.captionText} onChange={(e) => setChainForm({ ...chainForm, captionText: e.target.value })}
                    placeholder="Текст для всех постов серии"
                    className="flex-1 min-w-[220px] text-[12.5px] rounded-lg px-2.5 py-1.5"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                )}
                {chainForm.kind === 'auto' && (
                  <label className="text-[12px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    в день ≤
                    <input type="number" min={1} max={20} value={chainForm.dailyCap}
                      onChange={(e) => setChainForm({ ...chainForm, dailyCap: Math.max(1, Math.min(20, Number(e.target.value) || 3)) })}
                      className="w-14 text-[12.5px] rounded-lg px-2 py-1" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  </label>
                )}
                <button type="button" onClick={() => void submitChain()} disabled={chainBusy || chainForm.accIds.size === 0}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-700 px-4 py-1.5 rounded-lg ml-auto disabled:opacity-40"
                  style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                  {chainBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {chainForm.kind === 'manual' ? 'Распланировать по слотам' : 'Включить авто-цепочку'}
                </button>
              </div>
              {chainForm.kind === 'manual' && (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Каждый ролик серии займёт свой ближайший свободный слот. Если ИИ-подпись недоступна (нет ключа Claude) — подпись соберётся из названия и ключевых слов разбора.
                </p>
              )}
            </div>
          )}

          {chains.length === 0 && !chainForm ? (
            <p className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
              Цепочек пока нет. Серия вручную: выделите ролики в Галерее → «Опубликовать (N)». Автопилот: кнопка «Авто-цепочка» выше.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {chains.map((c) => (
                <div key={c.id} className="rounded-xl p-2.5 flex items-center gap-2.5 flex-wrap" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                  <span className="text-[11px] font-700 px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: c.kind === 'auto' ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)', color: c.kind === 'auto' ? 'var(--brand)' : 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
                    {c.kind === 'auto' ? '⚡ авто' : 'серия'}
                  </span>
                  <span className="text-[13px] font-600 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    ⏳{c.stats?.scheduled || 0} · ✓{c.stats?.published || 0}{(c.stats?.failed || 0) > 0 ? <span style={{ color: '#ef4444' }}> · ✗{c.stats?.failed}</span> : null}
                    {c.kind === 'auto' ? ` · ≤${c.daily_cap}/день` : ` · ${c.cursor}/${(c.items || []).length}`}
                  </span>
                  {c.last_error && <span className="text-[11px] truncate max-w-[260px]" title={c.last_error} style={{ color: '#ef4444' }}>{c.last_error}</span>}
                  <span className="ml-auto flex items-center gap-1.5">
                    {c.kind === 'auto' && (
                      <button type="button" onClick={() => void toggleChain(c)}
                        className="text-[11.5px] font-700 px-2.5 py-1 rounded-lg"
                        style={{ background: c.enabled ? 'rgba(16,185,129,0.12)' : 'var(--bg-secondary)', color: c.enabled ? '#10b981' : 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                        {c.enabled ? 'активна' : 'на паузе'}
                      </button>
                    )}
                    <button type="button" onClick={() => deleteChain(c)} title="Удалить цепочку (снимет её запланированные посты)"
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Аналитика ──────────────────────────────────────────────────────────────
  const num = (v: any): string => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
    if (!Number.isFinite(n)) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  };
  const pick = (o: any, keys: string[]): any => { for (const k of keys) { if (o?.[k] != null) return o[k]; } return null; };
  const renderAnalytics = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-700 px-2 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)' }}>X · IG · FB · Threads · Bluesky — Blotato</span>
        <span className="text-[11px] font-700 px-2 py-1 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>TikTok · YouTube — раздел «Каналы» (TikHub)</span>
        <button type="button" onClick={() => void loadAnalytics()} disabled={anaLoading}
          className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          <RefreshCw size={12} className={anaLoading ? 'animate-spin' : ''} /> Обновить
        </button>
      </div>
      {anaLoading ? (
        <div className="py-10 text-center"><Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
      ) : anaErr ? (
        <div className="text-[13px] rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}>{anaErr}</div>
      ) : !ana || ana.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)' }}>
          <BarChart3 size={22} className="inline-block mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>Метрик пока нет</p>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-muted)' }}>Blotato собирает статистику по чекпоинтам после публикаций (X, Instagram, Facebook, Threads, Bluesky). Для TikTok и YouTube — «Тренды → Каналы».</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-medium)' }}>
          <table className="w-full text-[12.5px]" style={{ minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {['Платформа', 'Пост', 'Просмотры', 'Лайки', 'Коммент.', 'Охват', ''].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 text-[10.5px] font-700 uppercase tracking-wide" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-medium)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ana.slice(0, 50).map((it: any, i: number) => {
                const platform = String(pick(it, ['platform']) || '').toLowerCase();
                const url = pick(it, ['postUrl', 'url', 'post_url']);
                return (
                  <tr key={i} style={{ background: 'var(--bg-secondary)' }}>
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {platform ? <span className="inline-flex items-center gap-1.5"><PlatformMark platform={platform} size={18} /><span style={{ color: 'var(--text-secondary)' }}>{PLATFORM_META[platform]?.label || platform}</span></span> : '—'}
                    </td>
                    <td className="px-3 py-2 max-w-[320px] truncate" title={pick(it, ['text', 'title']) || ''} style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {String(pick(it, ['text', 'title']) || '—').split('\n')[0]}
                    </td>
                    {[['viewsCount', 'views', 'impressionsCount'], ['likesCount', 'likes'], ['commentsCount', 'comments'], ['reachCount', 'reach']].map((keys, j) => (
                      <td key={j} className="px-3 py-2 tabular-nums" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>{num(pick(it, keys))}</td>
                    ))}
                    <td className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {url && <a href={String(url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-600" style={{ color: 'var(--brand)', textDecoration: 'none' }}>пост <ExternalLink size={10} /></a>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Лента ──────────────────────────────────────────────────────────────────
  const renderFeed = () => (
    postsLoading ? (
      <div className="py-10 text-center"><Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
    ) : groups.length === 0 ? (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)' }}>
        <p className="text-sm font-600 mb-1" style={{ color: 'var(--text-primary)' }}>Пока ни одного поста</p>
        <p className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          Нажмите «Новый пост» или кнопку <Send size={11} className="inline" /> на карточке любого видео в Галерее.
        </p>
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        {groups.map((rows) => {
          const first = rows[0];
          return (
            <div key={first.group_id} className="rounded-xl p-3 flex gap-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
              <div className="w-[44px] h-[72px] rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
                {first.media_url && (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(first.media_url)
                  ? <img src={first.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <video src={`${first.media_url}#t=0.1`} muted preload="metadata" className="w-full h-full object-cover" />)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-600 truncate" style={{ color: 'var(--text-primary)' }}>
                  {first.chain_id && <Link2 size={11} className="inline mr-1" style={{ color: 'var(--brand)' }} />}
                  {(first.text || '').split('\n')[0] || 'Без текста'}
                </div>
                <div className="text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>{fmtDT(first.created_at)}</div>
                <div className="flex flex-wrap gap-1.5">
                  {rows.map((row) => (
                    <span key={row.id} className="inline-flex items-center gap-1.5 rounded-lg pl-1 pr-1 py-1" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                      <PlatformMark platform={row.platform} size={20} />
                      {statusChip(row)}
                      {row.status === 'failed' && (
                        <button type="button" onClick={() => void retry(row)} disabled={rowBusy === row.id} title={row.error ? `Повторить · ${row.error}` : 'Повторить'}
                          className="w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)', border: 'none', cursor: 'pointer' }}>
                          {rowBusy === row.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        </button>
                      )}
                      {(row.status === 'scheduled' || row.status === 'failed' || row.status === 'published' || row.status === 'canceled') && (
                        <button type="button" onClick={() => removeRow(row)} disabled={rowBusy === row.id}
                          title={row.status === 'scheduled' ? 'Отменить публикацию' : 'Убрать запись'}
                          className="w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {rows.some((r) => r.status === 'failed' && r.error) && (
                  <div className="text-[11px] mt-1.5 space-y-0.5" style={{ color: '#ef4444' }}>
                    {rows.filter((r) => r.status === 'failed' && r.error).map((r) => (
                      <div key={r.id} className="truncate" title={r.error || undefined}>
                        {PLATFORM_META[r.platform]?.label || r.platform}: {r.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )
  );

  // ── Основной экран ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {err && (
        <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          <AlertTriangle size={16} className="mt-[2px] flex-shrink-0" /><span className="flex-1">{err}</span>
          <button type="button" onClick={() => setErr(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {/* Плитки сетей */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Соцсети</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadAccounts(true)} disabled={accLoading}
              className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              <RefreshCw size={13} className={accLoading ? 'animate-spin' : ''} /> Обновить
            </button>
            <button type="button" onClick={onNewPost}
              className="inline-flex items-center gap-1.5 text-[13px] font-700 px-3.5 py-1.5 rounded-lg"
              style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
              <Plus size={15} /> Новый пост
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {PLATFORM_ORDER.map((pk) => {
            const meta = PLATFORM_META[pk];
            const accs = byPlatform.get(pk) || [];
            const connected = accs.length > 0;
            return (
              <a key={pk} href={BLOTATO_SETTINGS_URL} target="_blank" rel="noreferrer"
                title={connected ? 'Управлять подключением — кабинет Blotato' : 'Подключить в кабинете Blotato (откроется сразу нужная страница)'}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:opacity-90"
                style={{ background: 'var(--bg-secondary)', border: connected ? '1px solid var(--border-medium)' : '1px dashed var(--border-strong)', textDecoration: 'none' }}>
                <PlatformMark platform={pk} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-700 leading-tight" style={{ color: 'var(--text-primary)' }}>{meta.label}</span>
                  {connected ? (
                    <span className="block text-[11px] truncate leading-tight" style={{ color: '#10b981' }}>
                      ✓ {accs.map((a) => a.username ? `@${a.username}` : (a.name || 'подключено')).join(', ')}
                    </span>
                  ) : (
                    <span className="block text-[11px] leading-tight" style={{ color: 'var(--brand)' }}>Подключить →</span>
                  )}
                </span>
              </a>
            );
          })}
        </div>
        {accounts.length === 0 && !accLoading && (
          <p className="text-[12px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Ключ активен, но соцсети ещё не подключены — нажмите любую плитку: откроется кабинет Blotato, после подключения вернитесь и нажмите «Обновить».
          </p>
        )}
      </div>

      {/* Стат-карточки + саб-вкладки */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {[
          { v: counts.queued, l: 'в очереди', c: '#f59e0b' },
          { v: counts.published, l: 'опубликовано', c: '#10b981' },
          { v: counts.failed, l: 'ошибки', c: counts.failed > 0 ? '#ef4444' : 'var(--text-muted)' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl px-4 py-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
            <span className="text-base font-700 tabular-nums mr-1.5" style={{ color: s.c }}>{s.v}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.l}</span>
          </div>
        ))}
        <div className="inline-flex gap-1 p-1 rounded-xl ml-auto" style={{ background: 'var(--bg-tertiary)' }}>
          {([['feed', 'Лента', <ListChecks key="f" size={13} />], ['calendar', 'Календарь', <CalendarDays key="c" size={13} />], ['schedule', 'Моё расписание', <Clock key="s" size={13} />], ['analytics', 'Аналитика', <BarChart3 key="a" size={13} />]] as [SubTab, string, React.ReactNode][]).map(([k, l, ic]) => (
            <button key={k} type="button" onClick={() => setSub(k)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-600 whitespace-nowrap"
              style={{ background: sub === k ? 'var(--brand)' : 'transparent', color: sub === k ? 'var(--brand-contrast)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
              {ic} {l}
            </button>
          ))}
        </div>
      </div>

      {sub === 'feed' && renderFeed()}
      {sub === 'calendar' && renderCalendar()}
      {sub === 'schedule' && renderSchedule()}
      {sub === 'analytics' && renderAnalytics()}

      <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        <Sparkles size={12} /> Публикация — через ваш аккаунт Blotato (лимит их API — 30 постов/мин). История, слоты и цепочки хранятся у нас; упавшие посты автоповторяются (2→4→8 мин, до 3 раз).
      </p>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message}
        confirmLabel="Да"
        variant="danger"
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export default PublisherTab;
