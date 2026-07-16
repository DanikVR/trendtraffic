/**
 * GalleryPicker — ЕДИНЫЙ пикер «из Галереи» для всех блоков сценария.
 *
 * По просьбе юзера: везде, где добавляем из Галереи, — один и тот же вид:
 *  • ПОЛНАЯ Галерея вкладками (Медиафайлы / Аудио / Аналитика / Тренды / Hotebook);
 *  • поиск; сетка квадратных превью (кадр видео/обложка, картинка, файл);
 *  • у аудио — встроенный проигрыватель (слушать прямо в пикере, как в Галерее);
 *  • открывается на нужной вкладке (defaultTab), но можно листать все;
 *  • multi=true — не закрывается после выбора (✓ на выбранных), для наборов;
 *  • onUpload задан — сверху зона «Загрузить с устройства» + drag-and-drop;
 *    загруженные файлы попадают в Галерею и сразу «выбираются» (через onPick).
 *
 * «Умный» режим (onlyType, один тип или список): пикер показывает ТОЛЬКО файлы,
 * которые реально можно поставить в этот слот (фото → только картинки, музыка →
 * только аудио, реплики → фото/видео). Папки, где такого типа не бывает
 * (Тренды = видео, Аудио = звук), прячутся; если стартовая папка пуста —
 * пикер сам перескакивает на первую папку, где подходящие файлы есть.
 *
 * Загружает Галерею сам (нужен только token). onPick отдаёт выбранный элемент —
 * вызывающий кладёт его в своё поле (фото ведущего, музыка, клип, источник…).
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Loader2, X, Music, Video, FileText, Check, Play, Pause, Plus } from 'lucide-react';

export type GalleryCat = 'trends' | 'reference' | 'audio' | 'analyzed' | 'hotebook';
export type GalleryPickType = 'image' | 'video' | 'audio';
export interface GalleryPickItem { id: string; fileUrl: string; title: string; type: string; cat: GalleryCat; cover?: string }

// Русские ярлыки папок живут в pickerTabLabel() внутри компонента (t() с ru-дефолтом);
// здесь label только у непереводимого имени блока. Имена = как в самой Галерее
// (раньше висели легаси «TrendFlow» / «Из анализа» — теперь «Медиафайлы» / «Аналитика»).
const TABS: { key: GalleryCat; label?: string }[] = [
  { key: 'reference' },
  { key: 'audio' },
  { key: 'analyzed' },
  { key: 'trends' },
  { key: 'hotebook', label: 'Hotebook' },
];

/** Какие типы файлов вообще бывают в папке: Тренды — только скачанные видео, Аудио — только
 *  звук; остальные смешанные (загрузки с устройства, рендеры, артефакты Hotebook — там есть всё). */
const FOLDER_TYPES: Record<GalleryCat, readonly string[]> = {
  trends: ['video'],
  audio: ['audio'],
  reference: ['image', 'video', 'audio', 'file'],
  analyzed: ['image', 'video', 'audio', 'file'],
  hotebook: ['image', 'video', 'audio', 'file'],
};

/** Мини-плеер аудио для карточки пикера (на CSS-переменных, тёмная/светлая тема). */
function CardAudio({ url }: { url: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  useEffect(() => {
    const a = ref.current; if (!a) return;
    const t = () => setCur(a.currentTime); const d = () => setDur(a.duration || 0);
    const e = () => setPlaying(false); const p = () => setPlaying(true); const ps = () => setPlaying(false);
    a.addEventListener('timeupdate', t); a.addEventListener('loadedmetadata', d);
    a.addEventListener('ended', e); a.addEventListener('play', p); a.addEventListener('pause', ps);
    return () => { a.removeEventListener('timeupdate', t); a.removeEventListener('loadedmetadata', d); a.removeEventListener('ended', e); a.removeEventListener('play', p); a.removeEventListener('pause', ps); };
  }, []);
  const fmt = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
  const pct = dur > 0 ? (cur / dur) * 100 : 0;
  return (
    <div onClick={(e) => e.stopPropagation()} className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <audio ref={ref} src={url} preload="none" />
      <button type="button" onClick={() => { const a = ref.current; if (!a) return; a.paused ? a.play().catch(() => {}) : a.pause(); }}
        className="flex-shrink-0" style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--brand)', color: 'var(--brand-contrast)' }}>
        {playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
      </button>
      <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand)' }} />
      </div>
      <span className="text-[8px] tabular-nums flex-shrink-0" style={{ color: '#fff' }}>{fmt(cur)}</span>
    </div>
  );
}

export function GalleryPicker({
  open, onClose, onPick, title, defaultTab = 'reference', multi = false, pickedKeys,
  token, note, onUpload, uploadAccept = 'image/*,video/*,audio/*', uploadHint, onlyType,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: GalleryPickItem) => void | Promise<void>;
  title?: string;
  defaultTab?: GalleryCat;
  multi?: boolean;
  pickedKeys?: Set<string>;      // fileUrl'ы уже выбранных (для ✓); если не задан — компонент ведёт свой набор в multi
  token?: string | null;
  note?: string;                 // подсказка под заголовком
  /** Загрузка с устройства: заливает файл(ы) в Галерею и возвращает новые элементы. Если не задан — зоны загрузки нет. */
  onUpload?: (files: FileList | File[]) => Promise<GalleryPickItem[]>;
  uploadAccept?: string;         // accept для input (по умолчанию любое медиа)
  uploadHint?: string;           // подпись в зоне загрузки
  /** Показывать ТОЛЬКО эти типы: один ('image') или несколько (['audio','video']).
   *  Аватар = картинки, музыка = аудио, запись = аудио/видео, медиа реплики = фото/видео. */
  onlyType?: GalleryPickType | GalleryPickType[];
}) {
  const { t } = useTranslation('common');
  // Ярлыки папок пикера = как вкладки самой Галереи; «Hotebook» — имя блока, не переводим.
  const pickerTabLabel = (key: GalleryCat, fallback?: string): string => {
    if (key === 'reference') return t('sec.picker.tabMedia', 'Медиафайлы');
    if (key === 'audio') return t('sec.picker.tabAudio', 'Аудио');
    if (key === 'analyzed') return t('sec.picker.tabAnalytics', 'Аналитика');
    if (key === 'trends') return t('sec.picker.tabTrends', 'Тренды');
    return fallback || key;
  };
  // Человекочитаемый тип файла — для подсказок «нужно фото / видео / аудио».
  const typeLabel = (k: string): string =>
    k === 'image' ? t('sec.picker.typeImage', 'фото')
      : k === 'video' ? t('sec.picker.typeVideo', 'видео')
      : k === 'audio' ? t('sec.picker.typeAudio', 'аудио') : k;
  const [items, setItems] = useState<GalleryPickItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<GalleryCat>(defaultTab);
  const [query, setQuery] = useState('');
  const [ownPicked, setOwnPicked] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const tabTouched = useRef(false);   // юзер сам кликал по вкладкам → автопереход выключаем

  const allow = useMemo(() => {
    const arr = !onlyType ? [] : Array.isArray(onlyType) ? onlyType : [onlyType];
    return arr.length ? new Set<string>(arr) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(onlyType) ? onlyType.join(',') : onlyType]);
  const fits = useCallback((g: GalleryPickItem) => !allow || allow.has(g.type), [allow]);
  const allowLabel = allow ? Array.from(allow).map(typeLabel).join(' / ') : '';

  /* Видимые папки: прячем те, где нужный тип не встречается в принципе
     (страховка items.some — вдруг файл нужного типа всё же лежит в «несвойственной» папке). */
  const tabs = useMemo(() => TABS.filter((tb) => !allow
    || FOLDER_TYPES[tb.key].some((t) => allow.has(t))
    || items.some((g) => g.cat === tb.key && fits(g))), [allow, items, fits]);

  const headers = (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tr, r, a, an, hb] = await Promise.all([
        fetch('/api/trends/videos?downloaded=1&limit=200', { headers: headers() }),
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
        fetch('/api/trends/media?kind=audio', { headers: headers() }),
        fetch('/api/trends/media?folder=analyzed', { headers: headers() }),
        fetch('/api/trends/media?folder=hotebook', { headers: headers() }),
      ]);
      const out: GalleryPickItem[] = [];
      const seen = new Set<string>();
      const push = (id: string, fileUrl: string, title2: string, type: string, cat: GalleryCat, cover?: string) => {
        const k = `${cat}:${fileUrl}`;
        if (fileUrl && !seen.has(k)) { seen.add(k); out.push({ id: id || fileUrl, fileUrl, title: title2, type, cat, cover }); }
      };
      if (tr.ok) for (const v of (await tr.json()).videos || []) if (v.fileUrl) push(v.id, v.fileUrl, v.title || v.author || t('sec.picker.typeVideo', 'видео'), 'video', 'trends', v.coverUrl);
      if (r.ok) for (const m of (await r.json()).assets || []) push(m.id, m.fileUrl, m.originalName || t('sec.picker.fileFallback', 'файл'), m.mediaType || 'file', 'reference', m.coverUrl);
      if (a.ok) for (const m of (await a.json()).assets || []) push(m.id, m.fileUrl, m.originalName || t('sec.picker.typeAudio', 'аудио'), m.mediaType || 'audio', 'audio', m.coverUrl);
      if (an.ok) for (const m of (await an.json()).assets || []) push(m.id, m.fileUrl, m.originalName || t('sec.picker.fileFallback', 'файл'), m.mediaType || 'file', 'analyzed', m.coverUrl);
      if (hb.ok) for (const m of (await hb.json()).assets || []) push(m.id, m.fileUrl, m.originalName || t('sec.picker.fileFallback', 'файл'), m.mediaType || 'file', 'hotebook', m.coverUrl);
      setItems(out);
    } catch { setItems([]); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!open) return;
    setTab(defaultTab); setQuery(''); setOwnPicked(new Set()); setItems([]);
    tabTouched.current = false;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTab]);

  /* «Умная» стартовая папка: если текущая вкладка скрыта фильтром — уходим на первую видимую;
     если после загрузки в стартовой папке нет подходящих файлов, а в другой есть —
     перескакиваем туда (пока юзер сам не потрогал вкладки). */
  useEffect(() => {
    if (!open || loading) return;
    if (!tabs.some((tb) => tb.key === tab)) { setTab(tabs[0]?.key || defaultTab); return; }
    if (tabTouched.current || !items.length) return;
    const count = (cat: GalleryCat) => items.filter((g) => g.cat === cat && fits(g)).length;
    if (count(tab) > 0) return;
    const first = tabs.find((tb) => count(tb.key) > 0);
    if (first) setTab(first.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, items, tabs, tab]);

  const filtered = useMemo(() => items.filter((g) => g.cat === tab
    && fits(g)
    && (!query.trim() || g.title.toLowerCase().includes(query.trim().toLowerCase()))), [items, tab, query, fits]);

  const isPicked = (g: GalleryPickItem) => (pickedKeys ? pickedKeys.has(g.fileUrl) : ownPicked.has(g.fileUrl));

  const pick = async (g: GalleryPickItem) => {
    if (busyKey) return;
    setBusyKey(g.fileUrl);
    try {
      await onPick(g);
      if (multi) setOwnPicked((p) => new Set(p).add(g.fileUrl));
      else onClose();
    } finally { setBusyKey(null); }
  };

  const doUpload = async (files: FileList | File[]) => {
    if (!onUpload || uploading) return;
    const list = Array.from(files).filter(Boolean);
    if (!list.length) return;
    setUploading(true);
    try {
      const added = await onUpload(list);
      await load();
      if (added && added.length) {
        if (multi) {
          for (const it of added) { await onPick(it); setOwnPicked((p) => new Set(p).add(it.fileUrl)); }
        } else {
          await onPick(added[added.length - 1]);
          onClose();
        }
      }
    } catch { /* тихо */ }
    finally { setUploading(false); }
  };

  if (!open) return null;
  const pickedCount = pickedKeys ? undefined : ownPicked.size;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div onClick={(e) => e.stopPropagation()}
        onDragOver={onUpload ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
        onDragLeave={onUpload ? (e) => { e.preventDefault(); setDragOver(false); } : undefined}
        onDrop={onUpload ? (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.files?.length) void doUpload(e.dataTransfer.files); } : undefined}
        style={{ width: '100%', maxWidth: 640, maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: `1px solid ${dragOver ? 'var(--brand)' : 'var(--border-medium)'}`, borderRadius: 16, padding: 16, outline: dragOver ? '2px dashed var(--brand)' : 'none', outlineOffset: -6 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>{title || t('sec.picker.title', 'Из Галереи')}</span>
          <button onClick={onClose} title={t('sec.picker.btnClose', 'Закрыть')} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
        </div>
        {note && <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>{note}</p>}

        {/* Зона загрузки с устройства (если разрешена) */}
        {onUpload && (
          <>
            <input ref={fileRef} type="file" multiple accept={uploadAccept} style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.length) void doUpload(e.target.files); e.currentTarget.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full mb-2 rounded-xl flex flex-col items-center justify-center gap-1 py-4 transition-colors"
              style={{ background: dragOver ? 'rgba(99,102,241,0.08)' : 'var(--bg-tertiary)', border: `1.5px dashed ${dragOver ? 'var(--brand)' : 'var(--border-strong)'}`, color: dragOver ? 'var(--brand)' : 'var(--text-secondary)', cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--brand)' }} /> : <Plus size={18} style={{ color: 'var(--brand)' }} />}
              <span className="text-[12px] font-600">{uploading ? t('sec.picker.uploading', 'Загружаю…') : t('sec.picker.uploadBtn', 'Загрузить с устройства')}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{uploadHint || t('sec.picker.uploadHintDefault', 'с компьютера/телефона или перетащите сюда → попадёт в Галерею')}</span>
            </button>
          </>
        )}

        {/* Вкладки-папки (только те, где нужный тип файлов бывает) */}
        <div className="gap-1 p-1 rounded-lg mb-2" style={{ background: 'var(--bg-tertiary)', display: 'grid', gridTemplateColumns: `repeat(${tabs.length || 1}, 1fr)` }}>
          {tabs.map((tb) => {
            const n = items.filter((g) => g.cat === tb.key && fits(g)).length;
            const active = tab === tb.key;
            return (
              <button key={tb.key} onClick={() => { tabTouched.current = true; setTab(tb.key); }}
                className="inline-flex items-center justify-center gap-1 px-1 py-1.5 rounded-md text-[11px] font-600 whitespace-nowrap"
                style={{ background: active ? 'var(--brand)' : 'transparent', color: active ? 'var(--brand-contrast)' : 'var(--text-muted)' }}>
                <span className="truncate">{pickerTabLabel(tb.key, tb.label)}</span>{n > 0 && <span style={{ opacity: 0.7 }}>{n}</span>}
              </button>
            );
          })}
        </div>

        {/* Поиск */}
        <div className="relative mb-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('sec.picker.searchPh', 'Поиск по имени…')}
            className="w-full pl-8 pr-2 py-2 rounded-lg text-xs outline-none"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
        </div>

        {loading ? (
          <div className="py-10 text-center"><Loader2 size={20} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-[11px] py-8 text-center" style={{ color: 'var(--text-muted)' }}>
            {query.trim() ? t('sec.picker.notFound', 'Ничего не найдено.')
              : allow && items.some((g) => g.cat === tab) ? t('sec.picker.noFitFolder', 'В этой папке нет подходящих файлов — нужно {{types}}.', { types: allowLabel })
              : allow ? t('sec.picker.noFitAll', 'Подходящих файлов ({{types}}) в Галерее пока нет.', { types: allowLabel })
              : t('sec.picker.emptyFolder', 'В этой папке пусто.')}
            {!query.trim() && onUpload ? ' ' + t('sec.picker.uploadCta', 'Загрузите с устройства — кнопка сверху.') : ''}
          </p>
        ) : (
          <>
            <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('sec.picker.foundCount', 'Найдено: {{n}}', { n: filtered.length })}{' · '}{multi ? t('sec.picker.pickHintMulti', 'клик — добавить, можно несколько') : t('sec.picker.pickHintSingle', 'клик — выбрать')}</div>
            <div className="grid grid-cols-3 gap-2" style={{ maxHeight: '54vh', overflowY: 'auto' }}>
              {filtered.map((g) => {
                const sel = isPicked(g);
                const busy = busyKey === g.fileUrl;
                return (
                  <button key={`${g.cat}:${g.fileUrl}`} onClick={() => void pick(g)} disabled={!!busyKey} title={g.title}
                    className="rounded-xl overflow-hidden text-left disabled:opacity-60" style={{ background: 'var(--bg-tertiary)', border: sel ? '2px solid var(--brand)' : '1px solid var(--border-medium)', cursor: 'pointer', padding: 0 }}>
                    <div className="relative flex flex-col items-center justify-center gap-1.5 p-1" style={{ aspectRatio: '1 / 1', background: g.type === 'audio' ? 'var(--bg-tertiary)' : '#000' }}>
                      {g.type === 'audio' ? (
                        <>
                          <Music size={24} style={{ color: 'var(--brand)' }} />
                          <div className="w-full mt-auto"><CardAudio url={g.fileUrl} /></div>
                        </>
                      ) : g.type === 'image' ? (
                        <img src={g.fileUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : g.type === 'video' ? (
                        g.cover ? <img src={g.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          : <video src={`${g.fileUrl}#t=0.1`} muted preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <FileText size={26} style={{ color: 'var(--brand)' }} />
                      )}
                      {g.type === 'video' && <span className="absolute bottom-1 left-1 z-10"><Video size={12} style={{ color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }} /></span>}
                      {busy && <span className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}><Loader2 size={18} className="animate-spin" style={{ color: '#fff' }} /></span>}
                      {sel && <span className="absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center z-10" style={{ background: 'var(--brand)', color: '#fff' }}><Check size={12} /></span>}
                    </div>
                    <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{g.title}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {multi && (
          <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid var(--border-medium)' }}>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{pickedCount ? t('sec.picker.addedCount', 'Добавлено: {{n}}', { n: pickedCount }) : t('sec.picker.multiHint', 'Можно выбрать несколько')}</span>
            <button onClick={onClose} className="text-xs font-700 px-4 py-2 rounded-lg" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>{t('sec.picker.done', 'Готово')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GalleryPicker;
