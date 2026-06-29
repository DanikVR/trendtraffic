/**
 * SocialExtensionPage — вкладка «Тренды» (рехостинг TikHub-расширения).
 *
 * Две секции:
 *   1) «Поиск горячих видео» — переиспользуемый TrendSearch.
 *   2) «Аналитика» — рехостнутое TikHub-расширение один-в-один в iframe (/social-ext).
 *      Пока ссылка не выбрана — вместо экрана расширения «Open a supported platform»
 *      показываем плитку недавних видео (клик → анализ).
 *
 * Поток: нашёл тренды → «Аналитика» на карточке (или «Анализировать выбранные»
 * массово → чипы) → ссылка уходит расширению через postMessage (polyfill эмулирует
 * переход таба). Доступ — только Enterprise (роут — router.tsx, прокси — на бэке).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, ImagePlus, Loader2, Play, Eye } from 'lucide-react';
import { AuroraButton } from '../components/AuroraButton';
import { useAppStore } from '../store/useAppStore';
import TrendSearch, { type StoredVideo } from '../components/TrendSearch';
import TrendAnalyticsPanel from './TrendAnalyticsPanel';

type Tab = 'search' | 'analytics';

function fmt(n?: number): string {
  if (n == null) return '';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

/** X (Twitter): анализ ведём в НАШЕЙ нативной панели, а не в iframe-расширении
 *  (расширение требует обложку и падает «Ошибкой» на твитах). */
function isXUrl(u?: string | null): boolean {
  return /(?:^https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\b/i.test((u || '').trim());
}

/** Скачать blob как файл на устройство. */
function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

export default function SocialExtensionPage() {
  const { token } = useAppStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [tab, setTab] = useState<Tab>('search');
  const [url, setUrl] = useState('');
  const [queue, setQueue] = useState<{ url: string; cover?: string }[]>([]);
  const appliedRef = useRef<string>('');
  const [appliedUrl, setAppliedUrl] = useState('');
  const [recent, setRecent] = useState<StoredVideo[]>([]);

  // «Добавить в галерею» — текущее анализируемое видео в Галерею (media_assets).
  const [adding, setAdding] = useState(false);
  const [galleryNote, setGalleryNote] = useState<{ ok: boolean; text: string } | null>(null);

  // Недавние видео для плитки пустого состояния аналитики.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/trends/videos?limit=60', { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (res.ok) { const d = await res.json(); setRecent(((d.videos || []) as StoredVideo[]).filter((v) => v.webUrl)); }
      } catch { /* тихо */ }
    })();
  }, [token]);

  const postToIframe = useCallback((type: string, value?: string) => {
    const win = iframeRef.current?.contentWindow;
    if (win) win.postMessage({ type, url: value ?? '' }, window.location.origin);
  }, []);

  const addToGallery = useCallback(async () => {
    const target = appliedRef.current || url.trim();
    if (!target) return;
    setAdding(true); setGalleryNote(null);
    try {
      const res = await fetch('/api/social-ext/to-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: target }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setGalleryNote({ ok: true, text: 'Добавлено в Галерею ✓' });
    } catch (e: any) {
      setGalleryNote({ ok: false, text: e?.message || 'Не удалось добавить в галерею' });
    } finally {
      setAdding(false);
      setTimeout(() => setGalleryNote(null), 6000);
    }
  }, [url, token]);

  // Кнопки раздела Music расширения (через postMessage):
  //  • 'download' — скачать трек на устройство;
  //  • 'view'     — скачать на устройство И открыть его (послушать) в новой вкладке;
  //  • 'open'     — только открыть трек в новой вкладке.
  const handleMusic = useCallback(async (action: 'open' | 'download' | 'view') => {
    const target = appliedRef.current;
    if (!target) return;
    const authJson = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    try {
      if (action === 'open') {
        const res = await fetch('/api/social-ext/music', { method: 'POST', headers: authJson, body: JSON.stringify({ url: target, action: 'open' }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
        if (d.url) window.open(d.url, '_blank', 'noopener'); else throw new Error('Ссылка на музыку не найдена');
        return;
      }
      // download | view → бэкенд стримит аудио как attachment (+ заголовок X-Music-Url)
      setGalleryNote({ ok: true, text: action === 'view' ? 'Скачиваю и открываю музыку…' : 'Скачиваю музыку…' });
      const res = await fetch('/api/social-ext/music', { method: 'POST', headers: authJson, body: JSON.stringify({ url: target, action: 'download' }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${res.status}`); }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename="?([^"]+)"?/.exec(cd);
      downloadBlob(blob, (m && m[1]) || 'music.mp3');
      if (action === 'view') {
        const musicUrl = res.headers.get('X-Music-Url');
        if (musicUrl) window.open(musicUrl, '_blank', 'noopener');
      }
      setGalleryNote({ ok: true, text: 'Музыка скачана ✓' });
      setTimeout(() => setGalleryNote(null), 5000);
    } catch (e: any) {
      setGalleryNote({ ok: false, text: e?.message || 'Не удалось обработать музыку' });
      setTimeout(() => setGalleryNote(null), 6000);
    }
  }, [token]);

  const apply = useCallback((value: string) => {
    appliedRef.current = value;
    setAppliedUrl(value);
    postToIframe('social-ext:set-url', value);
  }, [postToIframe]);

  const analyzeOne = useCallback((webUrl: string) => {
    setQueue([]); setUrl(webUrl); setTab('analytics'); apply(webUrl);
  }, [apply]);

  const analyzeBulk = useCallback((items: { url: string; cover?: string }[]) => {
    if (!items.length) return;
    setQueue(items); setUrl(items[0].url); setTab('analytics'); apply(items[0].url);
  }, [apply]);

  const handleAnalyzeInput = useCallback(() => {
    const v = url.trim(); if (!v) return;
    setQueue([]); apply(v);
  }, [url, apply]);

  const handleClear = useCallback(() => {
    setUrl(''); setQueue([]); appliedRef.current = ''; setAppliedUrl('');
    postToIframe('social-ext:clear-url');
  }, [postToIframe]);

  // Когда polyfill в iframe готов — (пере)отправляем текущий URL (гонка загрузки/reload).
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (ev.data?.type === 'social-ext:ready' && appliedRef.current) {
        postToIframe('social-ext:set-url', appliedRef.current);
      } else if (ev.data?.type === 'social-ext:music') {
        const a = ev.data.action;
        handleMusic(a === 'download' || a === 'view' ? a : 'open');
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [postToIframe, handleMusic]);

  const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 36);

  // Переключатель секций. Рендерим функцией, чтобы вставить в две точки: в режиме «Поиск»
  // он встроен в TrendSearch (под карточкой фильтров, перед лентой видео), в режиме
  // «Аналитика» — сверху, над строкой URL. Так строка вкладок ушла из самого верха страницы.
  const renderTabs = () => (
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
      {([['search', '🔥 Поиск горячих видео'], ['analytics', '📊 Аналитика']] as [Tab, string][]).map(([v, lbl]) => (
        <button key={v} onClick={() => setTab(v)}
          className="px-4 py-2 rounded-lg text-sm font-600 transition-all whitespace-nowrap"
          style={{ background: tab === v ? 'var(--brand)' : 'transparent', color: tab === v ? 'var(--brand-contrast)' : 'var(--text-muted)', boxShadow: tab === v ? '0 2px 8px rgba(99,102,241,0.35)' : 'none' }}>
          {lbl}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Контент: обе секции смонтированы, скрытая прячется (iframe не перезагружается).
          Переключатель секций (renderTabs) встроен в каждую секцию: в «Поиске» — под
          карточкой фильтров перед лентой, в «Аналитике» — сверху над строкой URL. */}
      <div className="flex-1 min-h-0 relative">
        {/* Поиск */}
        <div className={tab === 'search' ? 'h-full overflow-y-auto space-y-5 pr-0.5' : 'hidden'}>
          <TrendSearch token={token} sectionTabs={renderTabs()} onAnalyze={(u) => analyzeOne(u)} onAnalyzeBulk={analyzeBulk} />
        </div>

        {/* Аналитика (расширение) */}
        <div className={tab === 'analytics' ? 'h-full flex flex-col gap-2' : 'hidden'}>
          {renderTabs()}
          {/* Очередь массового разбора */}
          {queue.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
              <span className="text-[11px] font-600" style={{ color: 'var(--text-muted)' }}>Выбрано {queue.length}:</span>
              {queue.map((q, i) => {
                const active = q.url === appliedRef.current;
                return (
                  <button key={q.url + i} onClick={() => { setUrl(q.url); apply(q.url); }}
                    className="text-[11px] px-2 py-1 rounded-lg font-600 transition-colors truncate max-w-[200px]"
                    title={q.url}
                    style={{ background: active ? 'rgba(99,102,241,0.14)' : 'var(--bg-tertiary)', color: active ? 'var(--brand)' : 'var(--text-secondary)', border: `1px solid ${active ? 'rgba(99,102,241,1)' : 'var(--border-medium)'}` }}>
                    {i + 1}. {shortUrl(q.url)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Строка URL: эмулирует «открытый таб браузера» для расширения */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyzeInput(); }}
                placeholder="https://www.tiktok.com/@user/video/…  ·  instagram.com/p/…  ·  x.com/…"
                className="w-full pl-11 pr-10 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(99,102,241,0.4)] transition-shadow"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
              />
              {url && (
                <button type="button" onClick={handleClear} title="Очистить"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ color: 'var(--text-muted)' }}>
                  <X size={15} />
                </button>
              )}
            </div>
            <AuroraButton onClick={handleAnalyzeInput} disabled={!url.trim()} className="sm:!w-auto" icon={<Search size={16} />}>
              Анализировать
            </AuroraButton>
            <AuroraButton variant="secondary" onClick={addToGallery} disabled={!appliedUrl || adding} className="sm:!w-auto"
              icon={adding ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}>
              Добавить в галерею
            </AuroraButton>
          </div>
          {galleryNote && (
            <div className="text-[12px] font-600 flex-shrink-0" style={{ color: galleryNote.ok ? '#10b981' : '#ef4444' }}>
              {galleryNote.text}
            </div>
          )}

          {isXUrl(appliedUrl) ? (
            /* X (Twitter): НАША нативная панель аналитики вместо iframe-расширения */
            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl p-3 sm:p-4"
                 style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)' }}>
              <TrendAnalyticsPanel token={token} initialUrl={appliedUrl} hideSearch />
            </div>
          ) : (
          /* Остальные площадки — рехостнутое расширение в iframe; пока ссылка не выбрана — плитка недавних видео поверх */
          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden relative"
               style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)' }}>
            <iframe
              ref={iframeRef}
              src="/social-ext/sidepanel.html"
              title="Тренды — аналитика"
              className="w-full h-full block"
              style={{ border: 0 }}
              allow="clipboard-read; clipboard-write"
            />
            {!appliedUrl && (
              <div className="absolute inset-0 overflow-y-auto p-3" style={{ background: 'var(--bg-secondary)' }}>
                {recent.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-1 px-6">
                    <Play size={26} style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm font-600" style={{ color: 'var(--text-secondary)' }}>Вставьте ссылку выше</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>или найдите видео во вкладке «Поиск горячих видео» — оно появится здесь.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>Видео из поиска — нажмите, чтобы проанализировать:</p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {recent.map((v) => (
                        <button key={v.id || v.externalId} type="button" onClick={() => analyzeOne(v.webUrl!)}
                          title={v.description || v.author}
                          className="relative rounded-lg overflow-hidden group transition-transform hover:-translate-y-0.5"
                          style={{ aspectRatio: '9 / 16', background: 'var(--bg-tertiary)' }}>
                          {v.coverUrl ? (
                            <img src={v.coverUrl} alt="" referrerPolicy="no-referrer" loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Play size={18} style={{ color: 'var(--text-muted)' }} /></div>
                          )}
                          <span className="absolute inset-x-0 bottom-0 h-8 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
                          <span className="absolute bottom-1 left-1 text-[10px] font-700 inline-flex items-center gap-0.5" style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>
                            <Eye size={10} /> {fmt(v.stats?.play)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
