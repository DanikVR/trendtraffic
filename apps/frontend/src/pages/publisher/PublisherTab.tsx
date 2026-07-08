/**
 * PublisherTab — вкладка «Публикатор» в Галерее (Ф1, вместо заглушки «скоро»).
 *
 * Провайдер — Blotato, BYO: у КАЖДОГО пользователя свой аккаунт my.blotato.com и свой
 * API-ключ (вводится в Настройки → Ключи → Blotato, там же реальная «Проверить»).
 * Подключение соцсетей у Blotato возможно только в их кабинете (API для этого нет) —
 * поэтому плитки сетей ведут сразу на нужную страницу кабинета.
 *
 * Состав: онбординг без ключа → плитки 9 сетей со статусами подключения → стат-карточки
 * → лента постов (очередь/опубликовано/ошибки) с «Повторить»/«Отменить». Пока есть
 * посты «в полёте» — мягкий поллинг 8с (синк статусов ленивый, на бэке).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, RefreshCw, Loader2, ExternalLink, Plus, Check, Clock, RotateCcw, Trash2,
  Ban, KeyRound, AlertTriangle, Link2,
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

interface PubPostRow {
  id: string; group_id: string; asset_id?: string | null; media_url?: string | null; text?: string | null;
  platform: string; account_id: string; account_name?: string | null; mode: string;
  scheduled_at?: string | null; status: string; post_url?: string | null; error?: string | null; created_at: string;
}

type KeyState = 'loading' | 'none' | 'bad' | 'ok';

export function PublisherTab({ token, reloadKey, onNewPost }: {
  token: string | null;
  /** Бамп после публикации из студии — перезагрузить ленту. */
  reloadKey: number;
  onNewPost: () => void;
}) {
  const navigate = useNavigate();
  const [keyState, setKeyState] = useState<KeyState>('loading');
  const [accounts, setAccounts] = useState<PubAccount[]>([]);
  const [accLoading, setAccLoading] = useState(false);
  const [posts, setPosts] = useState<PubPostRow[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

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
      const r = await fetch('/api/publisher/posts?limit=200', { headers: jsonHeaders() });
      if (r.ok) setPosts(((await r.json()).posts || []) as PubPostRow[]);
    } catch { /* тихо — лента не критична */ }
    finally { if (!silent) setPostsLoading(false); }
  };

  const loadAll = async () => {
    setErr(null);
    try {
      const r = await fetch('/api/publisher/status', { headers: jsonHeaders() });
      const d = r.ok ? await r.json() : { hasKey: false };
      if (!d.hasKey) { setKeyState('none'); setPosts([]); return; }
      await Promise.all([loadAccounts(false), loadPosts(false)]);
    } catch (e: any) { setErr(e?.message || 'Публикатор недоступен'); }
  };

  useEffect(() => { void loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [reloadKey]);

  // Поллинг, пока есть посты «в полёте» (submitted/scheduled с submission) — бэк лениво синкает статусы.
  const pendingCount = useMemo(() => posts.filter((p) => p.status === 'submitted' || p.status === 'scheduled').length, [posts]);
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (keyState === 'ok' && pendingCount > 0) {
      pollRef.current = window.setInterval(() => { void loadPosts(true); }, 8000);
    }
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyState, pendingCount > 0]);

  // Группировка строк-таргетов в карточки публикаций.
  const groups = useMemo(() => {
    const map = new Map<string, PubPostRow[]>();
    for (const p of posts) {
      const arr = map.get(p.group_id) || [];
      arr.push(p); map.set(p.group_id, arr);
    }
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
      return <span className={base} title={row.error || undefined} style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}><AlertTriangle size={11} /> ошибка</span>;
    }
    if (row.status === 'canceled') {
      return <span className={base} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}><Ban size={11} /> отменён</span>;
    }
    const when = row.scheduled_at ? new Date(row.scheduled_at).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : row.mode === 'slot' ? 'слот Blotato' : 'публикуется…';
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

  // ── Основной экран ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {err && (
        <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          <AlertTriangle size={16} className="mt-[2px] flex-shrink-0" /><span>{err}</span>
        </div>
      )}

      {/* Плитки сетей: подключено (✓ @handle) / «Подключить →» — клик открывает СРАЗУ нужную страницу кабинета Blotato */}
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

      {/* Стат-карточки */}
      <div className="flex gap-2.5 flex-wrap">
        {[
          { v: counts.queued, l: 'в очереди', c: '#f59e0b' },
          { v: counts.published, l: 'опубликовано', c: '#10b981' },
          { v: counts.failed, l: 'ошибки', c: counts.failed > 0 ? '#ef4444' : 'var(--text-muted)' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl px-4 py-2.5 min-w-[110px]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
            <div className="text-lg font-700 tabular-nums" style={{ color: s.c }}>{s.v}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Лента публикаций */}
      {postsLoading ? (
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
            const created = new Date(first.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return (
              <div key={first.group_id} className="rounded-xl p-3 flex gap-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                <div className="w-[44px] h-[72px] rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
                  {first.media_url && (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(first.media_url)
                    ? <img src={first.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    : <video src={`${first.media_url}#t=0.1`} muted preload="metadata" className="w-full h-full object-cover" />)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-600 truncate" style={{ color: 'var(--text-primary)' }}>
                    {(first.text || '').split('\n')[0] || 'Без текста'}
                  </div>
                  <div className="text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>{created}</div>
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
      )}

      <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        <Link2 size={12} /> Публикация — через ваш аккаунт Blotato; лимит их API — 30 постов/мин. История хранится у нас без ограничения по сроку.
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
