/**
 * Раскрытый пост Публикатора — окно одного ролика со всеми его сетями.
 *
 * Главный сценарий (Ф6, ручной архив): человек кликает дату в календаре или карточку
 * в ленте → видит видео и ГОТОВЫЙ текст под каждую соцсеть → скачивает ролик и описание
 * этой сети → публикует руками. Поэтому текст здесь не «превью», а рабочий материал:
 * его можно править (у ручных постов и черновиков), копировать и сохранять в .txt.
 *
 * Посты, уже ушедшие в Blotato, открываются в режиме чтения — править их поздно.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  X, Download, Copy, Check, FileEdit, Calendar as CalendarIcon, ExternalLink, Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { downloadMedia } from '../../components/chat/MediaLightbox';
import { PLATFORM_META, PlatformMark, type PubPostRow } from './PublisherTab';

/** Имя файла без запрещённых символов — иначе браузер молча срежет расширение. */
const safeName = (s: string) => (s || 'post').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60);

/** Текст описания → .txt на устройство. */
function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Локальное «сейчас» в формате input[type=datetime-local] (он не понимает ISO с Z). */
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function PublisherPostModal({ rows, token, onClose, onChanged }: {
  /** Все строки одного ролика (одна group_id) — по строке на сеть. */
  rows: PubPostRow[];
  token: string | null;
  onClose: () => void;
  /** Дёргается после правки/удаления, чтобы лента и календарь перечитались. */
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState(rows[0]?.platform || '');
  const [edit, setEdit] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [when, setWhen] = useState(toLocalInput(rows[0]?.scheduled_at));

  const row = useMemo(() => rows.find((r) => r.platform === active) || rows[0], [rows, active]);
  const isManual = row?.status === 'manual';
  const isDraft = row?.status === 'draft';
  const canEdit = isManual || isDraft;
  const mediaUrl = rows.find((r) => r.media_url)?.media_url || '';
  const ytTitle = (row?.target as any)?.title || '';

  // Esc закрывает — окно модальное, кликать «×» мышью каждый раз неудобно.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Смена вкладки сети сбрасывает незавершённую правку — иначе текст «переедет» в чужую сеть.
  useEffect(() => { setEdit(false); setCopied(false); }, [active]);

  if (!row) return null;

  /** Полный текст сети: у YouTube заголовок — часть того, что вставляют руками. */
  const fullText = (r: PubPostRow): string => {
    const title = (r.target as any)?.title;
    const body = r.text || '';
    return r.platform === 'youtube' && title ? `${title}\n\n${body}` : body;
  };

  const startEdit = () => {
    setDraftText(row.text || '');
    setDraftTitle(ytTitle);
    setEdit(true);
  };

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const endpoint = isManual ? `/api/publisher/manual/${row.id}` : `/api/publisher/drafts/${row.id}`;
      const body: Record<string, unknown> = { text: draftText };
      if (row.platform === 'youtube') body.title = draftTitle;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || t('sec.publisher.saveFailed', 'Не удалось сохранить'));
      setEdit(false);
      onChanged();
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  /** Дата в календаре — двигаем ВЕСЬ ролик: сети одного поста живут одной датой. */
  const saveDate = async (value: string) => {
    setWhen(value);
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/publisher/manual/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ scheduledAt: value ? new Date(value).toISOString() : null, wholeGroup: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || t('sec.publisher.saveFailed', 'Не удалось сохранить'));
      onChanged();
    } catch (e: any) { setErr(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  const removePost = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/publisher/posts/delete-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ids: rows.map((r) => r.id) }),
      });
      if (!res.ok) throw new Error(t('sec.publisher.delFailed', 'Не удалось удалить'));
      onChanged();
      onClose();
    } catch (e: any) { setErr(e?.message || String(e)); setBusy(false); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText(row));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { setErr(t('sec.publisher.copyFailed', 'Буфер обмена недоступен — скачайте .txt')); }
  };

  const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
    background: bg, color, border: 'none', borderRadius: 10, padding: '8px 12px',
    fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl w-full"
        style={{
          maxWidth: 860, maxHeight: '92vh', overflowY: 'auto',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
        }}
      >
        {/* Шапка */}
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-medium)', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-700" style={{ color: 'var(--text-primary)' }}>
              {t('sec.publisher.postCard', 'Пост')}
            </span>
            {isManual && (
              <span className="text-[10px] px-2 py-[3px] rounded-full font-600"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                {t('sec.publisher.manualBadge', 'Вручную')}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Закрыть')}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-4 grid gap-4" style={{ gridTemplateColumns: 'minmax(0,220px) minmax(0,1fr)' }}>
          {/* Медиа + скачивание */}
          <div className="space-y-2">
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
              {mediaUrl && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(mediaUrl)
                ? <img src={mediaUrl} alt="" style={{ width: '100%', display: 'block' }} />
                : mediaUrl
                  ? <video src={mediaUrl} controls playsInline style={{ width: '100%', display: 'block', maxHeight: 360 }} />
                  : <div className="text-[12px] p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                      {t('sec.publisher.noMedia', 'Медиа не приложено')}
                    </div>}
            </div>
            {mediaUrl && (
              <button type="button" onClick={() => downloadMedia(mediaUrl)} style={{ ...btn('#6366f1'), width: '100%', justifyContent: 'center' }}>
                <Download size={14} /> {t('sec.publisher.dlVideo', 'Скачать видео')}
              </button>
            )}
            {isManual && (
              <label className="block text-[11px] space-y-1" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><CalendarIcon size={12} /> {t('sec.publisher.whenPublish', 'Дата публикации')}</span>
                <input
                  type="datetime-local" value={when} disabled={busy}
                  onChange={(e) => saveDate(e.target.value)}
                  className="w-full rounded-lg px-2 py-[6px] text-[12px]"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                />
              </label>
            )}
          </div>

          {/* Тексты по сетям */}
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              {rows.map((r) => (
                <button
                  key={r.id} type="button" onClick={() => setActive(r.platform)}
                  className="rounded-lg px-2 py-[6px] flex items-center gap-[6px]"
                  style={{
                    background: r.platform === active ? 'var(--bg-tertiary)' : 'transparent',
                    border: `1px solid ${r.platform === active ? 'var(--border-strong, var(--border-medium))' : 'transparent'}`,
                    cursor: 'pointer',
                  }}
                  title={PLATFORM_META[r.platform]?.label || r.platform}
                >
                  <PlatformMark platform={r.platform} size={18} />
                  <span className="text-[11px] font-600" style={{ color: 'var(--text-secondary)' }}>
                    {PLATFORM_META[r.platform]?.label || r.platform}
                  </span>
                </button>
              ))}
            </div>

            {row.platform === 'youtube' && (edit ? (
              <input
                value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}
                placeholder={t('sec.publisher.ytTitle', 'Название ролика')}
                className="w-full rounded-lg px-3 py-2 text-[13px] font-600"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
              />
            ) : ytTitle ? (
              <p className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{ytTitle}</p>
            ) : null)}

            {edit ? (
              <textarea
                value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={10}
                className="w-full rounded-xl px-3 py-2 text-[13px]"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', resize: 'vertical' }}
              />
            ) : (
              <div
                className="rounded-xl px-3 py-2 text-[13px]"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', minHeight: 140 }}
              >
                {row.text || <span style={{ color: 'var(--text-muted)' }}>{t('sec.publisher.noText', 'Текст пуст')}</span>}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {edit ? (
                <>
                  <button type="button" onClick={save} disabled={busy} style={btn('#16a34a')}>
                    <Check size={14} /> {t('common.save', 'Сохранить')}
                  </button>
                  <button type="button" onClick={() => setEdit(false)} disabled={busy}
                    style={btn('var(--bg-tertiary)', 'var(--text-secondary)')}>
                    {t('common.cancel', 'Отмена')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => downloadText(fullText(row), `${safeName(ytTitle || row.text?.split('\n')[0] || 'post')} — ${row.platform}`)}
                    style={btn('#6366f1')}
                  >
                    <Download size={14} /> {t('sec.publisher.dlText', 'Скачать описание')}
                  </button>
                  <button type="button" onClick={copy} style={btn('var(--bg-tertiary)', 'var(--text-secondary)')}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? t('common.copied', 'Скопировано') : t('common.copy', 'Копировать')}
                  </button>
                  {canEdit && (
                    <button type="button" onClick={startEdit} style={btn('var(--bg-tertiary)', 'var(--text-secondary)')}>
                      <FileEdit size={14} /> {t('common.edit', 'Править')}
                    </button>
                  )}
                  {row.post_url && (
                    <a href={row.post_url} target="_blank" rel="noreferrer" style={{ ...btn('var(--bg-tertiary)', 'var(--text-secondary)'), textDecoration: 'none' }}>
                      <ExternalLink size={14} /> {t('sec.publisher.openPost', 'Открыть публикацию')}
                    </a>
                  )}
                  {isManual && (
                    <button type="button" onClick={removePost} disabled={busy}
                      style={{ ...btn('transparent', '#ef4444'), marginLeft: 'auto' }}>
                      <Trash2 size={14} /> {t('common.delete', 'Удалить')}
                    </button>
                  )}
                </>
              )}
            </div>

            {err && <p className="text-[12px]" style={{ color: '#ef4444' }}>{err}</p>}
            {isManual && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {t('sec.publisher.manualHint', 'Пост никуда не отправляется: скачайте видео и описание нужной сети и опубликуйте вручную.')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
