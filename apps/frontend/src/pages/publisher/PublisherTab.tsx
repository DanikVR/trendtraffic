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
import { useTranslation } from 'react-i18next';
import {
  Send, RefreshCw, Loader2, ExternalLink, Plus, Check, Clock, RotateCcw, Trash2,
  Ban, KeyRound, AlertTriangle, Link2, CalendarDays, ListChecks, BarChart3, Timer,
  ChevronLeft, ChevronRight, Zap, X, Sparkles, FileEdit, CheckSquare, Square,
} from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PublisherPostModal } from './PublisherPostModal';

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

// Настоящие бренд-глифы соцсетей (белые, поверх фирменной плитки). viewBox 24×24.
const PLATFORM_ICON: Record<string, React.ReactNode> = {
  tiktok: <path d="M16.6 5.8c-.9-.6-1.5-1.6-1.7-2.8h-2.6v11.4c0 1.3-1 2.3-2.3 2.3s-2.3-1-2.3-2.3 1-2.3 2.3-2.3c.2 0 .5 0 .7.1v-2.7c-.2 0-.5-.1-.7-.1A5 5 0 1 0 14.9 14V8.7c1 .7 2.2 1.1 3.5 1.1V7.2c-.7 0-1.3-.2-1.8-.5z" fill="currentColor" />,
  instagram: <g fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5.2" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" /></g>,
  youtube: <path d="M21.6 7.2a2.5 2.5 0 0 0-1.75-1.77C18.27 5 12 5 12 5s-6.27 0-7.85.43A2.5 2.5 0 0 0 2.4 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.75 1.77C5.73 19 12 19 12 19s6.27 0 7.85-.43a2.5 2.5 0 0 0 1.75-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.4-4.8zM10 15V9l5.2 3-5.2 3z" fill="currentColor" />,
  twitter: <path d="M18.9 2H22l-7.3 8.3L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L1 2h7l4.8 6.3L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z" fill="currentColor" />,
  facebook: <path d="M15.12 5.32H17V2.14A26.1 26.1 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7v2.6H6.6v3.56h3.08V22h3.68v-9.14h3.06l.46-3.56h-3.52V7.05c0-1.03.28-1.73 1.77-1.73z" fill="currentColor" />,
  linkedin: <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95C21.4 8.75 22 11 22 14.1V21h-4v-6.1c0-1.45-.03-3.32-2.02-3.32-2.02 0-2.33 1.58-2.33 3.21V21h-4z" fill="currentColor" />,
  threads: <path d="M12.5 22C7 22 4 18.4 4 12S7.3 2 12.4 2c3.4 0 5.9 1.4 7.1 3.9l-1.8.9C16.8 5 15 4 12.4 4 8.5 4 6 6.9 6 12s2.6 8 6.5 8c3.3 0 5.1-1.9 5.1-4.7 0-.3 0-.6-.05-.9-.5 1.4-1.9 2.3-3.75 2.3-2 0-3.5-1.1-3.5-2.9 0-1.9 1.6-3 3.7-3 1 0 1.9.2 2.5.6-.1-1.3-1-2.1-2.5-2.1-1.1 0-1.85.4-2.35 1.1l-1.6-.9c.9-1.3 2.2-2 3.95-2 2.7 0 4.4 1.8 4.4 4.9v.3C21.6 19.4 18.5 22 12.5 22zm2-8c-1 0-1.8.4-1.8 1.2 0 .7.7 1.1 1.6 1.1 1.4 0 2.4-.9 2.6-2.1-.6-.15-1.4-.2-2.4-.2z" fill="currentColor" />,
  bluesky: <path d="M6.3 3.9C8.6 5.6 11 9 12 10.9c1-1.9 3.4-5.3 5.7-7 1.7-1.2 4.3-2.2 4.3.9 0 .6-.35 5-.55 5.7-.7 2.4-3.1 3-5.2 2.65 3.7.6 4.65 2.7 2.6 4.8-3.9 3.9-5.6-1-6-2.25l-.35-1-.35 1c-.4 1.25-2.1 6.15-6 2.25-2.05-2.1-1.1-4.2 2.6-4.8-2.1.35-4.5-.25-5.2-2.65C2 8.4 1.65 4 1.65 3.4c0-3.1 2.6-2.1 4.3-.9z" fill="currentColor" />,
  pinterest: <path d="M12.14 2C6.9 2 4 5.5 4 9.2c0 1.7.9 3.85 2.4 4.55.2.1.35.05.4-.16.03-.13.12-.5.16-.65.05-.2.03-.27-.12-.45-.42-.5-.68-1.15-.68-2.07 0-2.66 2-5.05 5.2-5.05 2.84 0 4.4 1.74 4.4 4.06 0 3.05-1.35 5.63-3.35 5.63-1.1 0-1.93-.92-1.66-2.04.32-1.34.94-2.79.94-3.76 0-.87-.47-1.59-1.43-1.59-1.13 0-2.05 1.17-2.05 2.74 0 1 .34 1.68.34 1.68l-1.36 5.75c-.4 1.7-.06 3.79-.03 4 .02.12.17.15.24.06.1-.13 1.37-1.7 1.8-3.27.12-.44.7-2.73.7-2.73.35.66 1.36 1.24 2.44 1.24 3.21 0 5.39-2.93 5.39-6.85C20.1 5.2 17.16 2 12.14 2z" fill="currentColor" />,
};

export function PlatformMark({ platform, size = 26 }: { platform: string; size?: number }) {
  const m = PLATFORM_META[platform] || { mark: '?', bg: 'var(--border-strong)' };
  const icon = PLATFORM_ICON[platform];
  return (
    <span className="rounded-lg flex items-center justify-center flex-shrink-0 font-700"
      style={{ width: size, height: size, background: m.bg, color: '#fff', fontSize: Math.max(8, Math.round(size * 0.34)) }}>
      {icon
        ? <svg viewBox="0 0 24 24" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} aria-hidden="true">{icon}</svg>
        : m.mark}
    </span>
  );
}

export interface PubPostRow {
  id: string; group_id: string; chain_id?: string | null; asset_id?: string | null; media_url?: string | null; text?: string | null;
  platform: string; account_id: string; account_name?: string | null; mode: string;
  /** Платформенные опции поста (JSONB): у YouTube здесь title, у FB pageId и т.п. */
  target?: Record<string, any> | null;
  scheduled_at?: string | null; status: string; post_url?: string | null; error?: string | null;
  retries?: number; next_retry_at?: string | null; created_at: string;
}

interface SlotRow { id: number; dow: number; hh: number; mm: number }
interface ChainRow {
  id: string; name: string; kind: 'manual' | 'auto'; items: any[]; targets: any[];
  caption: any; daily_cap: number; enabled: boolean; cursor: number; fail_streak: number;
  format_filter?: string | null;
  last_error?: string | null; last_run_at?: string | null; created_at: string;
  stats?: Record<string, number>;
}

export interface ChainDraft { items: { assetId?: string; mediaUrl?: string; title?: string }[] }

type KeyState = 'loading' | 'none' | 'bad' | 'ok';
type SubTab = 'feed' | 'calendar' | 'schedule' | 'analytics';
/** Папки ленты: вручную (архив) · черновики (в соцсети НЕ ушли) · очередь · опубликованные · ошибки.
 *  ВАЖНО: статус без записи в FOLDER_OF пропадает из ленты молча — добавляя статус, добавляйте и сюда. */
export type PubFolder = 'manual' | 'drafts' | 'queue' | 'published' | 'failed';
const FOLDER_OF: Record<string, PubFolder> = {
  manual: 'manual',
  draft: 'drafts', scheduled: 'queue', submitted: 'queue',
  published: 'published', failed: 'failed', canceled: 'failed',
};

// Единый вид карточек — тот же, что в «Трендах» и во всей Галерее (GalleryPage.tsx):
// карточка = само видео (портрет 9/16), текст и ВСЕ кнопки накладываются поверх.
const CARD_GRID = 'grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2';
const cardCls = (sel = false) =>
  `group relative rounded-xl overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg${sel ? ' ring-2 ring-[var(--brand)] ring-inset' : ''}`;
const CARD_STYLE: React.CSSProperties = { aspectRatio: '9 / 16', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' };

const CHAIN_FMT_LABEL: Record<string, string> = { '9x16': '9:16', '16x9': '16:9', '1x1': '1:1', '4x5': '4:5' };
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

export function PublisherTab({ token, reloadKey, onNewPost, chainDraft, onChainDraftConsumed, openFolder, onOpenFolderConsumed }: {
  token: string | null;
  reloadKey: number;
  onNewPost: () => void;
  /** Черновик серии из мультивыбора Галереи («Опубликовать N») — открывает форму цепочки. */
  chainDraft?: ChainDraft | null;
  onChainDraftConsumed?: () => void;
  /** Открыть ленту сразу на нужной папке (после массовой обработки — «Черновики»). */
  openFolder?: PubFolder | null;
  onOpenFolderConsumed?: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  /** Подписи дней недели (индекс = JS getDay). */
  const dowLabel = [
    t('sec.publisher.dowSun', 'Вс'), t('sec.publisher.dowMon', 'Пн'), t('sec.publisher.dowTue', 'Вт'),
    t('sec.publisher.dowWed', 'Ср'), t('sec.publisher.dowThu', 'Чт'), t('sec.publisher.dowFri', 'Пт'),
    t('sec.publisher.dowSat', 'Сб'),
  ];
  /** Форматы UGC-сборки — фильтр авто-цепочки (9:16 → TikTok, 16:9 → YouTube и т.п.). */
  const chainFmtOptions: [string, string][] = [
    ['9x16', t('sec.publisher.fmt9x16', '9:16 вертикальный')], ['16x9', t('sec.publisher.fmt16x9', '16:9 горизонтальный')],
    ['1x1', t('sec.publisher.fmt1x1', '1:1 квадрат')], ['4x5', t('sec.publisher.fmt4x5', '4:5 портрет')],
  ];
  const [sub, setSub] = useState<SubTab>('feed');
  const [keyState, setKeyState] = useState<KeyState>('loading');
  const [accounts, setAccounts] = useState<PubAccount[]>([]);
  const [accLoading, setAccLoading] = useState(false);
  const [posts, setPosts] = useState<PubPostRow[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  // Папки ленты + работа с черновиками (мультивыбор, правка текста, публикация пачкой).
  const [folder, setFolder] = useState<PubFolder>('queue');
  const [draftSel, setDraftSel] = useState<Set<string>>(new Set());
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);

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
    format: string; // авто: '' = любой формат, иначе ключ '9x16' | '16x9' | '1x1' | '4x5'
  }>(null);

  // Ф2: календарь
  /** Смещение показываемого месяца от текущего (0 = этот месяц). */
  const [monthOff, setMonthOff] = useState(0);
  /** group_id раскрытого поста (окно с видео и описаниями по сетям); null = закрыто. */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
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
    } catch (e: any) { setErr(e?.message || t('sec.publisher.errLoadAccounts', 'Не удалось загрузить аккаунты')); }
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
    } catch (e: any) { setErr(e?.message || t('sec.publisher.errUnavailable', 'Публикатор недоступен')); }
  };

  useEffect(() => { void loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [reloadKey]);

  // Первая загрузка: если черновики есть, а очередь пуста — открываем «Черновики»
  // (иначе человек видит пустую папку и думает, что обработка не сработала).
  const folderAutoRef = useRef(false);
  useEffect(() => {
    if (folderAutoRef.current || !posts.length) return;
    folderAutoRef.current = true;
    const drafts = posts.filter((p) => p.status === 'draft').length;
    const queued = posts.filter((p) => p.status === 'scheduled' || p.status === 'submitted').length;
    if (drafts > 0 && queued === 0) setFolder('drafts');
  }, [posts]);

  // Пришли из Галереи после массовой обработки — открыть нужную папку ленты.
  useEffect(() => {
    if (!openFolder) return;
    setSub('feed'); setFolder(openFolder); setDraftSel(new Set());
    onOpenFolderConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFolder]);

  // Черновик серии из Галереи → открыть форму ручной цепочки
  useEffect(() => {
    if (chainDraft && chainDraft.items?.length) {
      setSub('schedule');
      setChainForm({
        kind: 'manual', name: t('sec.publisher.chainDraftName', 'Серия из Галереи ({{n}})', { n: chainDraft.items.length }), items: chainDraft.items,
        accIds: new Set(), captionMode: 'ai', captionText: '', tone: 'engaging', dailyCap: 3, format: '',
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

  // Лента группируется по ролику (group_id) ВНУТРИ выбранной папки: ролик с двумя
  // опубликованными сетями и одной упавшей виден и в «Опубликованных», и в «Ошибках»
  // — каждая карточка показывает только свои строки.
  const groups = useMemo(() => {
    const map = new Map<string, PubPostRow[]>();
    for (const p of posts) {
      if (FOLDER_OF[p.status] !== folder) continue;
      const arr = map.get(p.group_id) || []; arr.push(p); map.set(p.group_id, arr);
    }
    return Array.from(map.values());
  }, [posts, folder]);

  const counts = useMemo(() => ({
    manual: posts.filter((p) => p.status === 'manual').length,
    drafts: posts.filter((p) => p.status === 'draft').length,
    queued: posts.filter((p) => p.status === 'scheduled' || p.status === 'submitted').length,
    published: posts.filter((p) => p.status === 'published').length,
    failed: posts.filter((p) => p.status === 'failed' || p.status === 'canceled').length,
  }), [posts]);

  // ── Черновики: выбор, правка текста, публикация пачкой ──────────────────────
  const draftIdsVisible = useMemo(() => groups.flatMap((rows) => rows.map((r) => r.id)), [groups]);
  const toggleDraftGroup = (rows: PubPostRow[]) => setDraftSel((s) => {
    const n = new Set(s);
    const all = rows.every((r) => n.has(r.id));
    for (const r of rows) { all ? n.delete(r.id) : n.add(r.id); }
    return n;
  });
  const allDraftsSelected = draftIdsVisible.length > 0 && draftIdsVisible.every((id) => draftSel.has(id));
  const publishDraftSel = async (mode: 'slot' | 'now') => {
    if (draftBusy || !draftSel.size) return;
    setDraftBusy(true); setDraftNote(null); setErr(null);
    try {
      const r = await fetch('/api/publisher/drafts/publish', {
        method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ ids: [...draftSel], mode }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || t('sec.publisher.errPublishDrafts', 'Не удалось отправить черновики')); return; }
      setDraftSel(new Set());
      setDraftNote(mode === 'slot'
        ? t('sec.publisher.draftsScheduled', 'Запланировано: {{ok}} · ошибок: {{failed}}. Смотрите папку «Опубликовать» и Календарь.', { ok: d.ok, failed: d.failed })
        : t('sec.publisher.draftsSentNow', 'Отправлено сейчас: {{ok}} · ошибок: {{failed}}.', { ok: d.ok, failed: d.failed }));
      setFolder(d.ok > 0 ? 'queue' : 'failed');
      await loadPosts(true);
    } catch (e: any) { setErr(e?.message || t('sec.publisher.errPublishDrafts', 'Не удалось отправить черновики')); }
    finally { setDraftBusy(false); }
  };
  const deleteSelected = () => {
    if (!draftSel.size) return;
    setConfirm({
      title: t('sec.publisher.delSelTitle', 'Удалить выбранные?'),
      message: t('sec.publisher.delSelMsg', 'Будет удалено записей: {{n}}. Сами видео в Галерее останутся.', { n: draftSel.size }),
      onConfirm: async () => {
        setConfirm(null); setDraftBusy(true);
        try {
          await fetch('/api/publisher/posts/delete-bulk', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ ids: [...draftSel] }) });
          setDraftSel(new Set());
          await loadPosts(true);
        } finally { setDraftBusy(false); }
      },
    });
  };

  const byPlatform = useMemo(() => {
    const m = new Map<string, PubAccount[]>();
    for (const a of accounts) { const arr = m.get(a.platform) || []; arr.push(a); m.set(a.platform, arr); }
    return m;
  }, [accounts]);

  const retry = async (row: PubPostRow) => {
    setRowBusy(row.id);
    try {
      const r = await fetch(`/api/publisher/posts/${row.id}/retry`, { method: 'POST', headers: jsonHeaders() });
      if (!r.ok) setErr((await r.json().catch(() => ({}))).error || t('sec.publisher.errRetry', 'Не удалось повторить'));
      await loadPosts(true);
    } finally { setRowBusy(null); }
  };
  const removeRow = (row: PubPostRow) => {
    const isSched = row.status === 'scheduled';
    setConfirm({
      title: isSched ? t('sec.publisher.cancelPostTitle', 'Отменить публикацию?') : t('sec.publisher.removeRowTitle', 'Убрать запись из истории?'),
      message: isSched
        ? t('sec.publisher.cancelPostMsg', 'Запланированный пост в {{platform}} будет снят из очереди Blotato.', { platform: PLATFORM_META[row.platform]?.label || row.platform })
        : t('sec.publisher.removeRowMsg', 'Сам пост в соцсети (если он опубликован) не удаляется — только запись в ленте Публикатора.'),
      onConfirm: async () => {
        setConfirm(null); setRowBusy(row.id);
        try {
          const r = await fetch(`/api/publisher/posts/${row.id}`, { method: 'DELETE', headers: jsonHeaders() });
          if (!r.ok) setErr((await r.json().catch(() => ({}))).error || t('sec.publisher.errDelete', 'Не удалось удалить'));
          await loadPosts(true);
        } finally { setRowBusy(null); }
      },
    });
  };
  const movePost = async (row: PubPostRow) => {
    if (!moveVal) return;
    setRowBusy(row.id);
    try {
      // Ручной пост в Blotato не отправлялся — двигаем его своим маршрутом и целиком
      // группой (все сети ролика живут одной датой). Очередь Blotato — как раньше.
      const manual = row.status === 'manual';
      const r = await fetch(`/api/publisher/${manual ? 'manual' : 'posts'}/${row.id}`, {
        method: 'PATCH', headers: jsonHeaders(),
        body: JSON.stringify({
          scheduledAt: new Date(moveVal).toISOString(),
          ...(manual ? { wholeGroup: true } : {}),
        }),
      });
      if (!r.ok) setErr((await r.json().catch(() => ({}))).error || t('sec.publisher.errMove', 'Не удалось перенести'));
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
      if (!r.ok) setErr((await r.json().catch(() => ({}))).error || t('sec.publisher.errAddSlot', 'Не удалось добавить слот'));
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
    if (!accs.length) { setErr(t('sec.publisher.errChainAccounts', 'Выберите аккаунты для цепочки')); return; }
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
      if (chainForm.kind === 'auto' && chainForm.format) body.formatFilter = chainForm.format;
      const r = await fetch('/api/publisher/chains', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || t('sec.publisher.errChainCreate', 'Не удалось создать цепочку')); return; }
      setChainForm(null);
      await Promise.all([loadChains(), loadPosts(true), loadSlots()]);
    } finally { setChainBusy(false); }
  };
  const toggleChain = async (c: ChainRow) => {
    await fetch(`/api/publisher/chains/${c.id}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ enabled: !c.enabled }) });
    await loadChains();
  };
  const deleteChain = (c: ChainRow) => setConfirm({
    title: t('sec.publisher.delChainTitle', 'Удалить цепочку «{{name}}»?', { name: c.name }),
    message: t('sec.publisher.delChainMsg', 'Её запланированные посты будут сняты из очереди. Уже опубликованное не трогаем.'),
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
    } catch (e: any) { setAnaErr(e?.message || t('sec.publisher.errLoad', 'Не удалось загрузить')); setAna([]); }
    finally { setAnaLoading(false); }
  };
  useEffect(() => { if (sub === 'analytics' && ana === null && keyState === 'ok') void loadAnalytics(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sub, keyState]);

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
              <p className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.publisher.onbTitle', 'Подключите Blotato — и публикуйте из Галереи')}</p>
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.onbSubtitle', 'TikTok, Instagram, YouTube, X, Facebook, LinkedIn, Threads, Bluesky, Pinterest — одним ключом.')}</p>
            </div>
          </div>
          {keyState === 'bad' && (
            <div className="flex items-start gap-2 text-[13px] rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
              <AlertTriangle size={15} className="mt-[1px] flex-shrink-0" />
              <span>{t('sec.publisher.onbBadKey', 'Blotato отверг сохранённый ключ (401). Проверьте ключ в Настройках — возможно, он перевыпущен или на тарифе Blotato нет доступа к API.')}</span>
            </div>
          )}
          <ol className="space-y-2.5">
            {[
              t('sec.publisher.onbStep1', 'Заведите свой аккаунт на my.blotato.com — у каждого пользователя TrendTraffic он свой (тариф Blotato с доступом к API).'),
              t('sec.publisher.onbStep2', 'В кабинете Blotato подключите соцсети: Settings → Social Accounts (пароли вводятся только в окнах самих платформ).'),
              t('sec.publisher.onbStep3', 'Создайте API-ключ (Settings → API) и вставьте его у нас: Настройки → Генерация → Blotato → «Проверить».'),
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
              <ExternalLink size={15} /> {t('sec.publisher.onbOpenBlotato', 'Открыть кабинет Blotato')}
            </a>
            <button type="button" onClick={() => navigate('/settings/enterprise?section=openmontage')}
              className="inline-flex items-center gap-2 text-[13px] font-600 px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              <KeyRound size={15} /> {t('sec.publisher.onbEnterKey', 'Ввести ключ в Настройках')}
            </button>
            <button type="button" onClick={() => void loadAll()}
              className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2.5 rounded-xl ml-auto"
              style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              <RefreshCw size={14} /> {t('sec.publisher.onbRecheck', 'Проверить снова')}
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
  /** Календарь на МЕСЯЦ: 6 недель сеткой, сверху перелистывание месяцев. */
  const renderCalendar = () => {
    const now = new Date();
    const view = new Date(now.getFullYear(), now.getMonth() + monthOff, 1);
    // Сетка всегда начинается с понедельника и держит 6 строк: месяц не «прыгает»
    // по высоте при переключении, а хвосты соседних месяцев видно приглушёнными.
    const firstCell = new Date(view.getFullYear(), view.getMonth(), 1 - ((view.getDay() + 6) % 7));
    const days = Array.from({ length: 42 }, (_, i) =>
      new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + i));

    // В календаре живут и очередь Blotato ('scheduled'), и ручной архив ('manual'):
    // для человека это одна доска дат, различает их значок «M» на карточке.
    const sched = posts.filter((p) => (p.status === 'scheduled' || p.status === 'manual') && p.scheduled_at);
    const sameDay = (t: Date, d: Date) =>
      t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth() && t.getDate() === d.getDate();
    const byDay = (d: Date) => sched
      .filter((p) => sameDay(new Date(p.scheduled_at!), d))
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    const inMonth = days.filter((d) => d.getMonth() === view.getMonth());
    const monthCount = inMonth.reduce((n, d) => n + byDay(d).length, 0);

    const navBtn: React.CSSProperties = {
      background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)',
      color: 'var(--text-secondary)', cursor: 'pointer',
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setMonthOff(monthOff - 1)} title={t('sec.publisher.prevMonth', 'Предыдущий месяц')}
            className="w-8 h-8 rounded-lg flex items-center justify-center" style={navBtn}><ChevronLeft size={15} /></button>
          <span className="text-[13.5px] font-700 capitalize" style={{ color: 'var(--text-primary)', minWidth: 150, textAlign: 'center' }}>
            {view.toLocaleDateString([], { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" onClick={() => setMonthOff(monthOff + 1)} title={t('sec.publisher.nextMonth', 'Следующий месяц')}
            className="w-8 h-8 rounded-lg flex items-center justify-center" style={navBtn}><ChevronRight size={15} /></button>
          {monthOff !== 0 && (
            <button type="button" onClick={() => setMonthOff(0)} className="text-[12px] font-600 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {t('sec.publisher.today', 'Сегодня')}
            </button>
          )}
          <span className="text-[11.5px] ml-auto" style={{ color: 'var(--text-muted)' }}>
            {t('sec.publisher.monthPlanned', 'Запланировано в этом месяце: {{n}}', { n: monthCount })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: 760 }}>
            {/* Шапка дней недели */}
            <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {[1, 2, 3, 4, 5, 6, 0].map((dw) => (
                <div key={dw} className="text-[11px] font-700 text-center" style={{ color: 'var(--text-muted)' }}>{dowLabel[dw]}</div>
              ))}
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {days.map((d, i) => {
                const items = byDay(d);
                const isToday = sameDay(now, d);
                const otherMonth = d.getMonth() !== view.getMonth();
                return (
                  <div key={i} className="rounded-lg p-1.5 flex flex-col gap-1"
                    style={{
                      background: otherMonth ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                      border: `1px solid ${isToday ? 'var(--brand)' : 'var(--border-medium)'}`,
                      minHeight: 96, opacity: otherMonth ? 0.55 : 1,
                    }}>
                    <div className="text-[11px] font-700 flex items-center justify-between" style={{ color: isToday ? 'var(--brand)' : 'var(--text-muted)' }}>
                      <span>{d.getDate()}</span>
                      {items.length > 0 && (
                        <span className="text-[9.5px] px-1 rounded" style={{ background: 'rgba(99,102,241,0.14)', color: 'var(--brand)' }}>{items.length}</span>
                      )}
                    </div>
                    {items.map((p) => (
                      <div key={p.id}>
                        {moveId === p.id ? (
                          <div className="space-y-1">
                            <input type="datetime-local" value={moveVal} onChange={(e) => setMoveVal(e.target.value)}
                              className="w-full rounded-md px-1 py-0.5 text-[10px]"
                              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                            <div className="flex gap-1">
                              <button type="button" onClick={() => void movePost(p)} disabled={rowBusy === p.id || !moveVal}
                                className="flex-1 text-[10px] font-700 py-0.5 rounded-md"
                                style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>OK</button>
                              <button type="button" onClick={() => { setMoveId(null); setMoveVal(''); }}
                                className="flex-1 text-[10px] font-600 py-0.5 rounded-md"
                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>×</button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-md px-1 py-0.5 flex items-center gap-1"
                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                            {/* Клик раскрывает пост: видео, тексты по сетям, скачивание, дата */}
                            <button type="button" onClick={() => setOpenGroup(p.group_id)}
                              title={p.text || t('sec.publisher.openPostTitle', 'Открыть пост')}
                              className="flex items-center gap-1 min-w-0 flex-1"
                              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
                              <PlatformMark platform={p.platform} size={13} />
                              <span className="text-[10px] font-700 tabular-nums flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                                {pad2(new Date(p.scheduled_at!).getHours())}:{pad2(new Date(p.scheduled_at!).getMinutes())}
                              </span>
                              {p.status === 'manual' && (
                                <span className="text-[8.5px] px-0.5 rounded font-700 flex-shrink-0" style={{ background: 'rgba(129,140,248,0.18)', color: '#818cf8' }}>M</span>
                              )}
                              {p.chain_id && <Link2 size={9} className="flex-shrink-0" style={{ color: 'var(--brand)' }} />}
                            </button>
                            <button type="button" onClick={() => { setMoveId(p.id); setMoveVal(''); }} title={t('sec.publisher.moveTitle', 'Перенести')}
                              className="flex-shrink-0" style={{ background: 'transparent', border: 'none', color: 'var(--brand)', cursor: 'pointer', lineHeight: 0 }}>
                              <Timer size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.calHintMonth', 'Время местное. Значок «M» — пост ручного архива: он никуда не отправляется, дата нужна только вам. Перенос обычного поста обновляет время в очереди Blotato.')}</p>
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
              <Clock size={15} /> {t('sec.publisher.slotsTitle', 'Слоты публикаций')} <span className="text-[11px] font-500" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.slotsSub', '— время местное; «Следующий слот» и цепочки берут времена отсюда')}</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <select value={slotDow} onChange={(e) => setSlotDow(Number(e.target.value))}
                className="text-[12.5px] font-600 rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                {DOW_ORDER.map((d) => <option key={d} value={d}>{dowLabel[d]}</option>)}
              </select>
              <input type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)}
                className="text-[12.5px] rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
              <button type="button" onClick={() => void addSlot()} disabled={slotBusy}
                className="inline-flex items-center gap-1 text-[12.5px] font-700 px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                {slotBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} {t('sec.publisher.addSlotBtn', 'Слот')}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', minWidth: 900 }}>
              {DOW_ORDER.map((dw) => (
                <div key={dw} className="rounded-xl p-2" style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-medium)', minHeight: 72 }}>
                  <div className="text-[11px] font-700 mb-1.5 text-center" style={{ color: 'var(--text-muted)' }}>{dowLabel[dw]}</div>
                  <div className="flex flex-col gap-1">
                    {slotsLocal.filter((s) => s.local.dow === dw).sort((a, b) => a.local.hh * 60 + a.local.mm - b.local.hh * 60 - b.local.mm).map((s) => (
                      <span key={s.id} className="inline-flex items-center justify-between gap-1 text-[11.5px] font-700 px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)' }}>
                        {pad2(s.local.hh)}:{pad2(s.local.mm)}
                        <button type="button" onClick={() => void delSlot(s.id)} title={t('sec.publisher.delSlotTitle', 'Удалить слот')}
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
              ? t('sec.publisher.noSlots', 'Слотов пока нет — добавьте хотя бы один: без них не работают «Следующий слот» и цепочки.')
              : <>{t('sec.publisher.nextFreeLbl', 'Ближайшие свободные:')} <b style={{ color: 'var(--text-primary)' }}>{nextFree.slice(0, 3).map(fmtDT).join(' · ') || '—'}</b></>}
          </div>
        </div>

        {/* Цепочки */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <span className="text-[13.5px] font-700 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Link2 size={15} /> {t('sec.publisher.chainsTitle', 'Цепочки контента')}
              <span className="text-[11px] font-500" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.chainsSub', '— серия из Галереи по слотам или автопубликация роликов автопилота')}</span>
            </span>
            <button type="button" onClick={() => setChainForm({ kind: 'auto', name: t('sec.publisher.autoChainDefName', 'Авто: ролики конвейера трендов'), items: [], accIds: new Set(), captionMode: 'ai', captionText: '', tone: 'engaging', dailyCap: 3, format: '' })}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-700 px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              <Zap size={13} /> {t('sec.publisher.autoChainBtn', 'Авто-цепочка')}
            </button>
          </div>

          {chainForm && (
            <div className="rounded-xl p-3 mb-3 space-y-2.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--brand)' }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-700 px-2 py-0.5 rounded-full" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}>
                  {chainForm.kind === 'manual' ? t('sec.publisher.chainBadgeManual', 'Серия · {{n}} роликов', { n: chainForm.items.length }) : t('sec.publisher.autoChainBtn', 'Авто-цепочка')}
                </span>
                <input value={chainForm.name} onChange={(e) => setChainForm({ ...chainForm, name: e.target.value })}
                  className="flex-1 min-w-[200px] text-[13px] font-600 rounded-lg px-2.5 py-1.5"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                <button type="button" onClick={() => setChainForm(null)} className="w-7 h-7 rounded-lg" style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={13} className="mx-auto" /></button>
              </div>
              {chainForm.kind === 'auto' && (
                <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                  {t('sec.publisher.autoChainSrcHint', 'Источник: свежие ролики автопилота трендов (Галерея → UGC → «Авто»), которые ещё не публиковались. Планировщик раз в минуту ставит очередной ролик в ближайший свободный слот; после 3 ошибок подряд цепочка встаёт на паузу.')}
                </p>
              )}
              <div>
                <div className="text-[11px] font-700 mb-1 uppercase" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.whereTo', 'Куда публикуем')}</div>
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
                  {accounts.length === 0 && <span className="text-[12px]" style={{ color: '#f59e0b' }}>{t('sec.publisher.noAccounts', 'Нет подключённых аккаунтов')}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                  {([['ai', t('sec.publisher.captionAi', '✦ Подпись ИИ')], ['fixed', t('sec.publisher.captionOwn', 'Свой текст')]] as ['ai' | 'fixed', string][]).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setChainForm({ ...chainForm, captionMode: k })}
                      className="text-[12px] font-600 px-2.5 py-1 rounded-md"
                      style={{ background: chainForm.captionMode === k ? 'var(--brand)' : 'transparent', color: chainForm.captionMode === k ? 'var(--brand-contrast)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>{l}</button>
                  ))}
                </div>
                {chainForm.captionMode === 'ai' ? (
                  <select value={chainForm.tone} onChange={(e) => setChainForm({ ...chainForm, tone: e.target.value })}
                    className="text-[12px] font-600 rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                    <option value="engaging">{t('sec.publisher.toneEngaging', 'Вовлекающий')}</option><option value="expert">{t('sec.publisher.toneExpert', 'Экспертный')}</option><option value="selling">{t('sec.publisher.toneSelling', 'Продающий')}</option>
                  </select>
                ) : (
                  <input value={chainForm.captionText} onChange={(e) => setChainForm({ ...chainForm, captionText: e.target.value })}
                    placeholder={t('sec.publisher.captionPh', 'Текст для всех постов серии')}
                    className="flex-1 min-w-[220px] text-[12.5px] rounded-lg px-2.5 py-1.5"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                )}
                {chainForm.kind === 'auto' && (
                  <label className="text-[12px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    {t('sec.publisher.perDayLbl', 'в день ≤')}
                    <input type="number" min={1} max={20} value={chainForm.dailyCap}
                      onChange={(e) => setChainForm({ ...chainForm, dailyCap: Math.max(1, Math.min(20, Number(e.target.value) || 3)) })}
                      className="w-14 text-[12.5px] rounded-lg px-2 py-1" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  </label>
                )}
                {chainForm.kind === 'auto' && (
                  <select value={chainForm.format} onChange={(e) => setChainForm({ ...chainForm, format: e.target.value })}
                    title={t('sec.publisher.fmtFilterTitle', 'Брать из «Авто» только ролики этого формата — например, 9:16 в TikTok, а вторая цепочка 16:9 в YouTube. Шаблон UGC должен собирать эти форматы.')}
                    className="text-[12px] font-600 rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                    <option value="">{t('sec.publisher.anyFormat', 'Любой формат')}</option>
                    {chainFmtOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                )}
                <button type="button" onClick={() => void submitChain()} disabled={chainBusy || chainForm.accIds.size === 0}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-700 px-4 py-1.5 rounded-lg ml-auto disabled:opacity-40"
                  style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                  {chainBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {chainForm.kind === 'manual' ? t('sec.publisher.chainSubmitManual', 'Распланировать по слотам') : t('sec.publisher.chainSubmitAuto', 'Включить авто-цепочку')}
                </button>
              </div>
              {chainForm.kind === 'manual' && (
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {t('sec.publisher.manualChainHint', 'Каждый ролик серии займёт свой ближайший свободный слот. Если ИИ-подпись недоступна (нет ключа Claude) — подпись соберётся из названия и ключевых слов разбора.')}
                </p>
              )}
            </div>
          )}

          {chains.length === 0 && !chainForm ? (
            <p className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
              {t('sec.publisher.noChains', 'Цепочек пока нет. Серия вручную: выделите ролики в Галерее → «Опубликовать (N)». Автопилот: кнопка «Авто-цепочка» выше.')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {chains.map((c) => (
                <div key={c.id} className="rounded-xl p-2.5 flex items-center gap-2.5 flex-wrap" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                  <span className="text-[11px] font-700 px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: c.kind === 'auto' ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)', color: c.kind === 'auto' ? 'var(--brand)' : 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
                    {c.kind === 'auto' ? t('sec.publisher.chainKindAuto', '⚡ авто') : t('sec.publisher.chainKindManual', 'серия')}
                  </span>
                  <span className="text-[13px] font-600 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                  <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    ⏳{c.stats?.scheduled || 0} · ✓{c.stats?.published || 0}{(c.stats?.failed || 0) > 0 ? <span style={{ color: '#ef4444' }}> · ✗{c.stats?.failed}</span> : null}
                    {c.kind === 'auto' ? ' · ' + t('sec.publisher.perDayShort', '≤{{n}}/день', { n: c.daily_cap }) + (c.format_filter ? ` · ${CHAIN_FMT_LABEL[c.format_filter] || c.format_filter}` : '') : ` · ${c.cursor}/${(c.items || []).length}`}
                  </span>
                  {c.last_error && <span className="text-[11px] truncate max-w-[260px]" title={c.last_error} style={{ color: '#ef4444' }}>{c.last_error}</span>}
                  <span className="ml-auto flex items-center gap-1.5">
                    {c.kind === 'auto' && (
                      <button type="button" onClick={() => void toggleChain(c)}
                        className="text-[11.5px] font-700 px-2.5 py-1 rounded-lg"
                        style={{ background: c.enabled ? 'rgba(16,185,129,0.12)' : 'var(--bg-secondary)', color: c.enabled ? '#10b981' : 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                        {c.enabled ? t('sec.publisher.chainActive', 'активна') : t('sec.publisher.chainPaused', 'на паузе')}
                      </button>
                    )}
                    <button type="button" onClick={() => deleteChain(c)} title={t('sec.publisher.delChainBtnTitle', 'Удалить цепочку (снимет её запланированные посты)')}
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
        <span className="text-[11px] font-700 px-2 py-1 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{t('sec.publisher.anaTikhubChip', 'TikTok · YouTube — раздел «Каналы» (TikHub)')}</span>
        <button type="button" onClick={() => void loadAnalytics()} disabled={anaLoading}
          className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg ml-auto"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          <RefreshCw size={12} className={anaLoading ? 'animate-spin' : ''} /> {t('sec.publisher.refresh', 'Обновить')}
        </button>
      </div>
      {anaLoading ? (
        <div className="py-10 text-center"><Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
      ) : anaErr ? (
        <div className="text-[13px] rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}>{anaErr}</div>
      ) : !ana || ana.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)' }}>
          <BarChart3 size={22} className="inline-block mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>{t('sec.publisher.anaEmptyTitle', 'Метрик пока нет')}</p>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.anaEmptyBody', 'Blotato снимает статистику постов через некоторое время после публикации (X, Instagram, Facebook, Threads, Bluesky). Для TikTok и YouTube — «Тренды → Каналы».')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-medium)' }}>
          <table className="w-full text-[12.5px]" style={{ minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {[t('sec.publisher.thPlatform', 'Платформа'), t('sec.publisher.thPost', 'Пост'), t('sec.publisher.thViews', 'Просмотры'), t('sec.publisher.thLikes', 'Лайки'), t('sec.publisher.thComments', 'Коммент.'), t('sec.publisher.thReach', 'Охват'), ''].map((h, i) => (
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
                      {url && <a href={String(url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-600" style={{ color: 'var(--brand)', textDecoration: 'none' }}>{t('sec.publisher.postLink', 'пост')} <ExternalLink size={10} /></a>}
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
  const isDrafts = folder === 'drafts';
  const renderFeed = () => (
    <div className="space-y-2.5">
      {/* Панель действий над выбранными черновиками */}
      {isDrafts && groups.length > 0 && (
        <div className="rounded-xl p-2.5 flex items-center gap-2 flex-wrap" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
          <button type="button" onClick={() => setDraftSel(allDraftsSelected ? new Set() : new Set(draftIdsVisible))}
            className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
            {allDraftsSelected ? <CheckSquare size={13} /> : <Square size={13} />}
            {allDraftsSelected ? t('sec.publisher.unselectAll', 'Снять выбор') : t('sec.publisher.selectAll', 'Выбрать всё')}
          </button>
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            {t('sec.publisher.draftsSelected', 'Выбрано: {{n}}', { n: draftSel.size })}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" onClick={deleteSelected} disabled={!draftSel.size || draftBusy}
              className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: 'none', cursor: draftSel.size ? 'pointer' : 'default', opacity: draftSel.size ? 1 : 0.5 }}>
              <Trash2 size={13} /> {t('sec.publisher.delete', 'Удалить')}
            </button>
            <button type="button" onClick={() => void publishDraftSel('now')} disabled={!draftSel.size || draftBusy}
              className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: draftSel.size ? 'pointer' : 'default', opacity: draftSel.size ? 1 : 0.5 }}>
              <Zap size={13} /> {t('sec.publisher.publishNow', 'Опубликовать сейчас')}
            </button>
            <button type="button" onClick={() => void publishDraftSel('slot')} disabled={!draftSel.size || draftBusy}
              className="inline-flex items-center gap-1.5 text-[13px] font-700 px-3.5 py-1.5 rounded-lg"
              style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: draftSel.size ? 'pointer' : 'default', opacity: draftSel.size ? 1 : 0.5 }}>
              {draftBusy ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
              {t('sec.publisher.scheduleBySlots', 'Запланировать по слотам')}
            </button>
          </div>
          {slots.length === 0 && (
            <p className="text-[11px] w-full" style={{ color: '#f59e0b' }}>
              <AlertTriangle size={11} className="inline" /> {t('sec.publisher.noSlotsHint', 'В «Моём расписании» нет слотов — планировать некуда. Добавьте времена или публикуйте сейчас.')}
            </p>
          )}
        </div>
      )}
      {draftNote && (
        <p className="text-[12px] rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}>{draftNote}</p>
      )}
      {postsLoading ? (
      <div className="py-10 text-center"><Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
    ) : groups.length === 0 ? (
      <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)' }}>
        <p className="text-sm font-600 mb-1" style={{ color: 'var(--text-primary)' }}>
          {isDrafts ? t('sec.publisher.draftsEmptyTitle', 'Черновиков нет') : t('sec.publisher.feedEmptyTitle', 'Пока ни одного поста')}
        </p>
        <p className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          {isDrafts
            ? t('sec.publisher.draftsEmptySub', 'Выделите ролики в Галерее и нажмите «В Публикатор» — описания и хэштеги напишет ИИ, а посты лягут сюда.')
            : <>{t('sec.publisher.feedEmptyA', 'Нажмите «Новый пост» или кнопку')} <Send size={11} className="inline" /> {t('sec.publisher.feedEmptyB', 'на карточке любого видео в Галерее.')}</>}
        </p>
      </div>
    ) : (
      <div className={CARD_GRID}>
        {/* Плитка «+» — как в Трендах: первым делом добавить новый пост */}
        <button type="button" onClick={onNewPost} title={t('sec.publisher.newPostHint', 'Собрать пост: медиа из Галереи, текст под каждую сеть, дата')}
          className="rounded-xl flex flex-col items-center justify-center gap-2 p-2 text-center transition-colors hover:border-[var(--border-stronger)]"
          style={{ aspectRatio: '9 / 16', background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <span className="relative w-11 h-11 rounded-full flex items-center justify-center animate-attract" style={{ boxShadow: '0 0 18px rgba(99,102,241,0.45)' }}>
            <span aria-hidden className="absolute inset-0 rounded-full animate-iridescent"
              style={{ background: 'conic-gradient(from 0deg, #6366f1, #22d3ee, #a855f7, #ec4899, #f59e0b, #6366f1)' }} />
            <Plus size={22} className="relative z-[1]" style={{ color: '#fff' }} />
          </span>
          <span className="text-[12px] font-600 leading-tight">{t('sec.publisher.newPost', 'Новый пост')}</span>
        </button>

        {groups.map((rows) => {
          const first = rows[0];
          const groupChecked = isDrafts && rows.every((r) => draftSel.has(r.id));
          // Дата поста = дата любой его сети: они всегда живут одним днём.
          const when = rows.find((r) => r.scheduled_at)?.scheduled_at || null;
          const failed = rows.filter((r) => r.status === 'failed');
          const title = (first.text || '').split('\n')[0] || t('sec.publisher.noText', 'Без текста');
          const isImg = !!first.media_url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(first.media_url);
          return (
            <div key={first.group_id} className={cardCls(groupChecked)} style={CARD_STYLE}>
              {/* Вся карточка — кнопка: раскрывает пост (видео, тексты по сетям, скачивание) */}
              <button type="button" onClick={() => setOpenGroup(first.group_id)}
                title={t('sec.publisher.openPostTitle', 'Открыть пост')}
                className="absolute inset-0 w-full h-full"
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
                {first.media_url ? (isImg
                  ? <img src={first.media_url} alt="" loading="lazy" className="w-full h-full object-cover pointer-events-none" />
                  : <video src={`${first.media_url}#t=0.1`} muted preload="metadata" className="w-full h-full object-cover pointer-events-none" />)
                  : <span className="w-full h-full flex items-center justify-center"><Send size={20} style={{ color: 'var(--text-muted)' }} /></span>}
              </button>

              {/* Статус — верх слева */}
              <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-700 px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(0,0,0,.55)', color: '#fff' }}>
                {first.status === 'manual' ? t('sec.publisher.manualBadge', 'Вручную')
                  : first.status === 'draft' ? t('sec.publisher.stDraft', 'черновик')
                  : first.status === 'published' ? t('sec.publisher.stPublished', 'опубликован')
                  : failed.length ? t('sec.publisher.stFailed', 'ошибка')
                  : t('sec.publisher.stQueued', 'в очереди')}
                {first.chain_id ? ' · ⛓' : ''}
              </span>

              {/* Выбор черновика пачкой — верх справа */}
              {isDrafts && (
                <button type="button" onClick={() => toggleDraftGroup(rows)} title={t('sec.publisher.pickGroup', 'Выбрать ролик целиком')}
                  className="absolute top-1.5 right-1.5 z-20 w-[25px] h-[25px] rounded-md flex items-center justify-center"
                  style={{ background: groupChecked ? 'var(--brand)' : 'rgba(0,0,0,.55)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                  {groupChecked ? <CheckSquare size={13} /> : <Square size={13} />}
                </button>
              )}

              {/* Подвал: текст, КУДА публикуется и КОГДА, действия — всё видно без ховера */}
              <div className="absolute inset-x-0 bottom-0 p-1.5 pt-6" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.80))' }}>
                <div className="text-[11px] font-600 leading-tight mb-1"
                  style={{ color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                  title={first.text || ''}>{title}</div>

                <div className="flex items-center gap-1 mb-1 flex-wrap">
                  {rows.map((r) => (
                    <span key={`pm-${r.id}`} title={PLATFORM_META[r.platform]?.label || r.platform}><PlatformMark platform={r.platform} size={16} /></span>
                  ))}
                  <span className="text-[10px] font-700 tabular-nums ml-auto px-1.5 py-0.5 rounded-md"
                    style={{ background: when ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.45)', color: when ? '#111' : '#fff' }}>
                    {when ? fmtDT(when) : t('sec.publisher.stNoDate', 'без даты')}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {failed.length > 0 && (
                    <button type="button" onClick={() => void retry(failed[0])} disabled={rowBusy === failed[0].id}
                      title={failed[0].error || t('sec.publisher.retryTitle', 'Повторить')}
                      className="w-[25px] h-[25px] rounded-md flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,.92)', color: '#111', border: 'none', cursor: 'pointer' }}>
                      {rowBusy === failed[0].id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    </button>
                  )}
                  <button type="button" onClick={() => setOpenGroup(first.group_id)} title={t('sec.publisher.openPostTitle', 'Открыть пост')}
                    className="w-[25px] h-[25px] rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,.92)', color: '#111', border: 'none', cursor: 'pointer' }}>
                    <FileEdit size={13} />
                  </button>
                  <button type="button" onClick={() => removeRow(first)} disabled={rowBusy === first.id}
                    title={first.status === 'scheduled' ? t('sec.publisher.cancelPub', 'Отменить публикацию') : t('sec.publisher.removeRec', 'Убрать запись')}
                    className="w-[25px] h-[25px] rounded-md flex items-center justify-center ml-auto"
                    style={{ background: 'rgba(239,68,68,.9)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
    </div>
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
          <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.publisher.socialNets', 'Соцсети')}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadAccounts(true)} disabled={accLoading}
              className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              <RefreshCw size={13} className={accLoading ? 'animate-spin' : ''} /> {t('sec.publisher.refresh', 'Обновить')}
            </button>
            <button type="button" onClick={onNewPost}
              className="inline-flex items-center gap-1.5 text-[13px] font-700 px-3.5 py-1.5 rounded-lg"
              style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
              <Plus size={15} /> {t('sec.publisher.newPost', 'Новый пост')}
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
                title={connected ? t('sec.publisher.tileManage', 'Управлять подключением — кабинет Blotato') : t('sec.publisher.tileConnect', 'Подключить в кабинете Blotato (откроется сразу нужная страница)')}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:opacity-90"
                style={{ background: 'var(--bg-secondary)', border: connected ? '1px solid var(--border-medium)' : '1px dashed var(--border-strong)', textDecoration: 'none' }}>
                <PlatformMark platform={pk} />
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-700 leading-tight" style={{ color: 'var(--text-primary)' }}>{meta.label}</span>
                  {connected ? (
                    <span className="block text-[11px] truncate leading-tight" style={{ color: '#10b981' }}>
                      ✓ {accs.map((a) => a.username ? `@${a.username}` : (a.name || t('sec.publisher.connected', 'подключено'))).join(', ')}
                    </span>
                  ) : (
                    <span className="block text-[11px] leading-tight" style={{ color: 'var(--brand)' }}>{t('sec.publisher.connectArrow', 'Подключить →')}</span>
                  )}
                </span>
              </a>
            );
          })}
        </div>
        {accounts.length === 0 && !accLoading && (
          <p className="text-[12px] mt-2" style={{ color: 'var(--text-muted)' }}>
            {t('sec.publisher.keyActiveNoNets', 'Ключ активен, но соцсети ещё не подключены — нажмите любую плитку: откроется кабинет Blotato, после подключения вернитесь и нажмите «Обновить».')}
          </p>
        )}
      </div>

      {/* Папки ленты (они же счётчики — клик переключает) + саб-вкладки */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {([
          { k: 'manual' as PubFolder, v: counts.manual, l: t('sec.publisher.folderManual', 'Вручную'), c: '#818cf8' },
          { k: 'drafts' as PubFolder, v: counts.drafts, l: t('sec.publisher.folderDrafts', 'Черновики'), c: 'var(--brand)' },
          { k: 'queue' as PubFolder, v: counts.queued, l: t('sec.publisher.folderQueue', 'Опубликовать'), c: '#f59e0b' },
          { k: 'published' as PubFolder, v: counts.published, l: t('sec.publisher.folderPublished', 'Опубликованные'), c: '#10b981' },
          { k: 'failed' as PubFolder, v: counts.failed, l: t('sec.publisher.folderFailed', 'Ошибки'), c: counts.failed > 0 ? '#ef4444' : 'var(--text-muted)' },
        ]).map((s) => {
          const active = sub === 'feed' && folder === s.k;
          return (
            <button key={s.k} type="button" onClick={() => { setSub('feed'); setFolder(s.k); setDraftSel(new Set()); setDraftNote(null); }}
              className="rounded-xl px-4 py-2 text-left"
              style={{ background: active ? 'rgba(99,102,241,0.10)' : 'var(--bg-secondary)', border: `1px solid ${active ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
              <span className="text-base font-700 tabular-nums mr-1.5" style={{ color: s.c }}>{s.v}</span>
              <span className="text-[11px]" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.l}</span>
            </button>
          );
        })}
        <div className="inline-flex gap-1 p-1 rounded-xl ml-auto" style={{ background: 'var(--bg-tertiary)' }}>
          {([['feed', t('sec.publisher.tabFeed', 'Лента'), <ListChecks key="f" size={13} />], ['calendar', t('sec.publisher.tabCalendar', 'Календарь'), <CalendarDays key="c" size={13} />], ['schedule', t('sec.publisher.tabSchedule', 'Моё расписание'), <Clock key="s" size={13} />], ['analytics', t('sec.publisher.tabAnalytics', 'Аналитика'), <BarChart3 key="a" size={13} />]] as [SubTab, string, React.ReactNode][]).map(([k, l, ic]) => (
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
        <Sparkles size={12} /> {t('sec.publisher.footerNote', 'Публикация — через ваш аккаунт Blotato (лимит их API — 30 постов/мин). История, слоты и цепочки хранятся у нас; упавшие посты автоповторяются (2→4→8 мин, до 3 раз).')}
      </p>

      {openGroup && (() => {
        const rows = posts.filter((p) => p.group_id === openGroup);
        // Пост могли удалить в другой вкладке — тогда просто закрываем окно.
        if (!rows.length) { setOpenGroup(null); return null; }
        return (
          <PublisherPostModal
            rows={rows}
            token={token}
            onClose={() => setOpenGroup(null)}
            onChanged={() => { void loadPosts(true); }}
          />
        );
      })()}

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message}
        confirmLabel={t('sec.publisher.confirmYes', 'Да')}
        variant="danger"
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export default PublisherTab;
