/**
 * StoryboardTab — вкладка «Сториборд» в Галерее-хабе: проекты автомонтажа карточками.
 *
 * Канон карточек Галереи: плюс-плитка ПЕРВОЙ (создать из видео Галереи), карточки
 * ~150px с видимыми кнопками. Клик по карточке → полноэкранная студия /storyboard/:id.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, Trash2, Clapperboard, Play, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { GalleryPicker, type GalleryPickItem } from '../../components/GalleryPicker';
import { ConfirmModal } from '../../components/ConfirmModal';

interface SbCard {
  id: string; name: string; status: string;
  sourceUrl?: string | null; resultUrl?: string | null; error?: string | null;
  cover?: string | null; chunksCount: number;
  createdAt?: string; busy?: { stage: string } | null;
}

export function StoryboardTab() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const token = useAppStore((s) => s.token);
  const [items, setItems] = useState<SbCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState<SbCard | null>(null);

  const auth = (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/storyboard', { headers: auth() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Не удалось загрузить');
      setItems(Array.isArray(d.items) ? d.items : []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  /** Плюс-плитка: выбрать говорящее видео (Галерея/загрузка/ссылка через Тренды) → создать проект. */
  const onPickSource = async (g: GalleryPickItem) => {
    if (creating) return;
    setCreating(true);
    try {
      const r = await fetch('/api/storyboard', {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: g.title?.slice(0, 80) || undefined, sourceUrl: g.fileUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Не удалось создать проект');
      setPickerOpen(false);
      navigate(`/storyboard/${d.id}?autostart=1`);
    } catch (e: any) {
      setError(e?.message || 'Не удалось создать проект');
    } finally {
      setCreating(false);
    }
  };

  const onUpload = async (files: FileList | File[]): Promise<GalleryPickItem[]> => {
    const out: GalleryPickItem[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('video/')) continue;
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch('/api/trends/media/upload?kind=reference', { method: 'POST', headers: auth(), body: fd });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.asset?.fileUrl) {
        out.push({ id: d.asset.id, fileUrl: d.asset.fileUrl, title: d.asset.originalName || f.name, type: 'video', cat: 'reference' });
      }
    }
    return out;
  };

  const del = async (c: SbCard) => {
    try {
      await fetch(`/api/storyboard/${c.id}`, { method: 'DELETE', headers: auth() });
      setItems((p) => p.filter((x) => x.id !== c.id));
    } catch { /* тихо */ }
    setConfirmDel(null);
  };

  const statusLabel = (c: SbCard): string => {
    if (c.busy) return t('sec.storyboard.stBusy', 'Обрабатывается…');
    if (c.status === 'done') return t('sec.storyboard.stDone', 'Готово');
    if (c.status === 'failed') return t('sec.storyboard.stFailed', 'Ошибка');
    if (c.status === 'analyzing') return t('sec.storyboard.stAnalyzing', 'Расшифровка…');
    if (c.status === 'rendering') return t('sec.storyboard.stRendering', 'Рендер…');
    if (c.status === 'planned') return t('sec.storyboard.stPlanned', 'Раскадровка готова');
    return t('sec.storyboard.stDraft', 'Черновик');
  };

  return (
    <div>
      <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
        {t('sec.storyboard.tabIntro', 'Автомонтаж рилса из говорящего видео: расшифровка → раскадровка из 6 панелей на кусок → рендер и склейка. Возьмите свой дубль из Галереи или загрузите с устройства.')}
      </p>
      {error && (
        <div className="mb-3 px-3 py-2 rounded-xl text-[12px] flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {/* Плюс-плитка ПЕРВОЙ (канон) */}
        <button type="button" onClick={() => setPickerOpen(true)} disabled={creating}
          className="rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors"
          style={{ aspectRatio: '3 / 4', border: '1.5px dashed var(--border-strong)', background: 'var(--bg-tertiary)', color: 'var(--brand)', cursor: 'pointer' }}>
          {creating ? <Loader2 size={22} className="animate-spin" /> : <Plus size={24} />}
          <span className="text-[12px] font-600" style={{ color: 'var(--text-secondary)' }}>
            {t('sec.storyboard.addTile', 'Новый сториборд')}
          </span>
          <span className="text-[10px] px-3 text-center" style={{ color: 'var(--text-muted)' }}>
            {t('sec.storyboard.addTileHint', 'из видео Галереи или с устройства')}
          </span>
        </button>

        {loading && !items.length && (
          <div className="rounded-2xl flex items-center justify-center" style={{ aspectRatio: '3 / 4', background: 'var(--bg-tertiary)' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        )}

        {items.map((c) => (
          <div key={c.id} className="rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={() => navigate(`/storyboard/${c.id}`)}
              className="relative flex items-center justify-center"
              style={{ aspectRatio: '3 / 3', background: '#000', cursor: 'pointer', border: 'none', padding: 0 }}>
              {c.cover ? (
                <img src={c.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : c.sourceUrl ? (
                <video src={`${c.sourceUrl}#t=0.1`} muted preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <Clapperboard size={26} style={{ color: 'var(--text-muted)' }} />
              )}
              {c.busy && (
                <span className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: '#fff' }} />
                </span>
              )}
            </button>
            <div className="p-2 flex flex-col gap-1 flex-1">
              <div className="text-[11px] font-600 truncate" style={{ color: 'var(--text-primary)' }} title={c.name}>{c.name}</div>
              <div className="text-[10px]" style={{ color: c.status === 'failed' ? '#f87171' : 'var(--text-muted)' }}>
                {statusLabel(c)}{c.chunksCount ? ` · ${t('sec.storyboard.chunksN', '{{n}} куск.', { n: c.chunksCount })}` : ''}
              </div>
              {/* Ряд видимых кнопок (канон): открыть / результат / удалить */}
              <div className="flex items-center gap-1 mt-auto pt-1">
                <button type="button" onClick={() => navigate(`/storyboard/${c.id}`)}
                  title={t('sec.storyboard.btnOpen', 'Открыть студию')}
                  className="w-[25px] h-[25px] rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--brand)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                  <Clapperboard size={13} />
                </button>
                {c.resultUrl && (
                  <a href={c.resultUrl} target="_blank" rel="noreferrer"
                    title={t('sec.storyboard.btnResult', 'Открыть готовый ролик')}
                    className="w-[25px] h-[25px] rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--bg-elevated)', color: '#34d399', border: '1px solid var(--border-subtle)' }}>
                    <Play size={13} />
                  </a>
                )}
                <button type="button" onClick={() => setConfirmDel(c)}
                  title={t('sec.storyboard.btnDelete', 'Удалить проект')}
                  className="w-[25px] h-[25px] rounded-lg flex items-center justify-center ml-auto"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && !items.length && (
        <p className="text-[11px] mt-4" style={{ color: 'var(--text-muted)' }}>
          {t('sec.storyboard.empty', 'Пока нет проектов. Нажмите «Новый сториборд» и выберите говорящее видео (вертикаль, 15–60 секунд, чистая речь).')}
        </p>
      )}

      <GalleryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onPickSource}
        token={token}
        title={t('sec.storyboard.pickerTitle', 'Видео для сториборда')}
        note={t('sec.storyboard.pickerNote', 'Говорящее видео: вертикаль 9:16, 15–60 секунд, чистая речь. Ссылку TikTok/IG/YouTube можно скачать во вкладке «Тренды» → «По ссылке».')}
        onlyType="video"
        onUpload={onUpload}
        uploadAccept="video/*"
      />

      <ConfirmModal
        open={!!confirmDel}
        title={t('sec.storyboard.delTitle', 'Удалить проект?')}
        message={t('sec.storyboard.delMsg', '«{{name}}» и его рабочие файлы будут удалены. Готовый ролик в Галерее останется.', { name: confirmDel?.name || '' })}
        confirmLabel={t('sec.storyboard.delConfirm', 'Удалить')}
        onConfirm={() => confirmDel && del(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

export default StoryboardTab;
