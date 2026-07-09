/**
 * AudienceTargetPanel — «🎯 Таргет на ЦА»: микро-таргетинг через контент-ниши.
 *
 * Идея (лайфхак): демографию нельзя запросить у площадки — её ловят ТЕМОЙ ролика.
 * Пользователь описывает продукт + базовую ЦА → Claude раскладывает это на дерево
 * узких ниш-прокси с кластерами ключевиков (POST /api/trends/audience-map) → мы
 * веерно сканируем каждую нишу через существующий /api/trends/scan и показываем
 * выдачу, СГРУППИРОВАННУЮ по нишам, с сигналом спроса. Дальше — «Аналитика»/
 * «Скачать» (как в обычном поиске) → продакшн в TrendFlow.
 *
 * Отдельная секция страницы «Тренды» (таб рядом с «Поиском» и «Аналитикой»).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Target, Loader2, Search, Sparkles, Globe, Eye, Heart, Play, ExternalLink, BarChart3,
  Download, CheckCircle2, AlertCircle, XCircle, ChevronRight,
} from 'lucide-react';
import { AuroraCard } from './AuroraCard';
import { AuroraButton } from './AuroraButton';
import { REGIONS, REGION_GROUPS, type StoredVideo } from './TrendSearch';

type Source = 'tiktok' | 'instagram' | 'youtube' | 'twitter';

interface AudienceNiche {
  id: string;
  name: string;
  emoji?: string;
  branch?: string;
  rationale: string;
  angle: string;
  keywords: string[];
}
interface AudienceMap {
  product: string;
  audience: string;
  language?: string;
  region?: string;
  niches: AudienceNiche[];
  model: string;
  generatedAt: string;
}

// Состояние скана одной ниши.
interface NicheScan {
  videos: StoredVideo[];
  scanning: boolean;
  error?: string;
  keyword?: string; // по какому ключевику сканировали
}

const PLATFORMS: { id: Source; name: string }[] = [
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'twitter', name: 'X' },
];

function coverSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/tiktokcdn|ibyteimg|byteimg|muscdn|tiktokv|pstatp|cdninstagram|fbcdn/i.test(url)) {
    return `/api/channels/cover?u=${encodeURIComponent(url)}`;
  }
  return url;
}
function fmt(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function median(nums: number[]): number | undefined {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return undefined;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}
// Сигнал спроса по медиане просмотров топ-выдачи ниши (честно: это спрос, не абсолютная конкуренция).
function demandTier(med?: number): { label: string; color: string; bg: string } {
  if (med == null) return { label: 'нет данных', color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' };
  if (med >= 100_000) return { label: '🔥 высокий спрос', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  if (med >= 10_000) return { label: '👍 средний спрос', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  return { label: '💤 низкий спрос', color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' };
}

function friendlyError(e: any, fallback: string): string {
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Сервер недоступен (нет связи с API). Проверьте backend/frontend и обновите страницу.';
  }
  return msg || fallback;
}

export interface AudienceTargetPanelProps {
  token: string | null;
  sectionTabs?: React.ReactNode;
  onAnalyze: (webUrl: string, cover?: string | null) => void;
  onAnalyzeBulk?: (items: { url: string; cover?: string }[]) => void;
}

export default function AudienceTargetPanel({ token, sectionTabs, onAnalyze }: AudienceTargetPanelProps) {
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [seeds, setSeeds] = useState('');
  const [platform, setPlatform] = useState<Source>('tiktok');
  const [region, setRegion] = useState('');
  const [language, setLanguage] = useState('русский');
  const [maxNiches, setMaxNiches] = useState(8);
  const [perNiche, setPerNiche] = useState(6); // видео на нишу при скане

  const [building, setBuilding] = useState(false);
  const [map, setMap] = useState<AudienceMap | null>(null);
  const [scans, setScans] = useState<Record<string, NicheScan>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // ── Шаг 1: построить карту ниш ────────────────────────────────────────────
  const buildMap = async () => {
    if (!product.trim() || !audience.trim()) { setError('Заполните продукт и базовую ЦА.'); return; }
    setBuilding(true); setError(null); setNotice(null); setMap(null); setScans({});
    try {
      const res = await fetch('/api/trends/audience-map', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ product: product.trim(), audience: audience.trim(), seedKeywords: seeds, platform, region, language, maxNiches }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMap(data.map);
      setNotice(`Готово: ${data.map?.niches?.length ?? 0} микро-ниш. Найдите ролики по нужным (или сразу по всем).`);
    } catch (e: any) { setError(friendlyError(e, 'Не удалось построить карту ЦА')); }
    finally { setBuilding(false); }
  };

  // ── Шаг 2: скан одной ниши по ключевику ───────────────────────────────────
  const scanNiche = async (niche: AudienceNiche, keyword?: string) => {
    const kw = (keyword || niche.keywords[0] || niche.name).trim();
    setScans((s) => ({ ...s, [niche.id]: { videos: s[niche.id]?.videos || [], scanning: true, keyword: kw } }));
    try {
      const res = await fetch('/api/trends/scan', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ kind: 'keyword', query: kw, count: perNiche, mode: 'app', platform, region, filters: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setScans((s) => ({ ...s, [niche.id]: { videos: data.videos || [], scanning: false, keyword: kw } }));
    } catch (e: any) {
      setScans((s) => ({ ...s, [niche.id]: { videos: s[niche.id]?.videos || [], scanning: false, error: friendlyError(e, 'Ошибка скана'), keyword: kw } }));
    }
  };

  // Скан всех ниш подряд (последовательно — не долбим API залпом; каждый скан платный).
  const [scanningAll, setScanningAll] = useState(false);
  const scanAll = async () => {
    if (!map) return;
    setScanningAll(true); setError(null);
    for (const n of map.niches) {
      // eslint-disable-next-line no-await-in-loop
      await scanNiche(n);
    }
    setScanningAll(false);
  };

  // ── Фоновое скачивание: статусы обновляем поллингом /videos, пока что-то качается ──
  const anyDownloading = Object.values(scans).some((sc) => sc.videos.some((v) => v.status === 'downloading'));
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (!anyDownloading) return;
    const reconcile = async () => {
      try {
        const res = await fetch('/api/trends/videos?limit=200', { headers: headers() });
        if (!res.ok) return;
        const d = await res.json();
        const byId = new Map<string, StoredVideo>();
        for (const v of (d.videos || []) as StoredVideo[]) if (v.id) byId.set(v.id, v);
        setScans((s) => {
          const next: Record<string, NicheScan> = {};
          for (const [k, sc] of Object.entries(s)) {
            next[k] = { ...sc, videos: sc.videos.map((v) => (v.id && byId.get(v.id)) ? { ...v, ...byId.get(v.id)! } : v) };
          }
          return next;
        });
      } catch { /* тихо */ }
    };
    pollRef.current = window.setInterval(reconcile, 3000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyDownloading]);

  const download = async (nicheId: string, v: StoredVideo) => {
    if (!v.id) { setError('Видео не сохранено в БД — повторите скан.'); return; }
    setScans((s) => ({ ...s, [nicheId]: { ...s[nicheId], videos: s[nicheId].videos.map((x) => x.id === v.id ? { ...x, status: 'downloading' } : x) } }));
    try {
      const res = await fetch(`/api/trends/videos/${v.id}/download`, { method: 'POST', headers: headers() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${res.status}`); }
    } catch (e: any) {
      setScans((s) => ({ ...s, [nicheId]: { ...s[nicheId], videos: s[nicheId].videos.map((x) => x.id === v.id ? { ...x, status: 'failed' } : x) } }));
      setError(friendlyError(e, 'Не удалось скачать'));
    }
  };

  const totalScans = map ? map.niches.length : 0;
  const cardAspect = platform === 'youtube' ? '16 / 9' : '9 / 16';

  return (
    <>
      {sectionTabs}

      {/* Форма */}
      <AuroraCard className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.12)' }}>
            <Target size={18} style={{ color: 'var(--brand)' }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Таргет на целевую аудиторию</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Опишите продукт и аудиторию — ИИ разложит её на узкие ниши-темы и подберёт ключевики,
              а мы найдём под каждую реальные ролики. Меньше конкуренции, точнее попадание.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Что продвигаем (продукт / оффер / смысл)
            <textarea value={product} onChange={(e) => setProduct(e.target.value)} rows={2}
              placeholder="напр.: онлайн-школа инвестиций для предпринимателей"
              className="px-3 py-2 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </label>
          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Базовая целевая аудитория
            <textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={2}
              placeholder="напр.: богатые люди / предприниматели и их жёны"
              className="px-3 py-2 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Ваши ключевые слова (необязательно — ИИ учтёт и расширит; через запятую)
          <input value={seeds} onChange={(e) => setSeeds(e.target.value)}
            placeholder="напр.: гольф, падл, конный спорт, F1, горные лыжи"
            className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
        </label>

        <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Площадка
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Source)}
              className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
              {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="inline-flex items-center gap-1"><Globe size={12} /> Регион</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)}
              className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ minWidth: 170, background: region ? 'rgba(99,102,241,0.10)' : 'var(--bg-tertiary)', border: `1px solid ${region ? 'var(--brand)' : 'var(--border-medium)'}`, color: 'var(--text-primary)' }}>
              <option value="">🌐 Глобально</option>
              {REGION_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {REGIONS.filter((r) => r.group === g).map((r) => <option key={r.code} value={r.code}>{r.flag} {r.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Язык ключевиков
            <input value={language} onChange={(e) => setLanguage(e.target.value)}
              className="h-10 px-3 rounded-lg text-sm w-[130px] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </label>

          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Ниш
            <select value={maxNiches} onChange={(e) => setMaxNiches(Number(e.target.value))}
              className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
              {[4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Видео / нишу
            <select value={perNiche} onChange={(e) => setPerNiche(Number(e.target.value))}
              className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
              {[4, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <AuroraButton onClick={buildMap} disabled={building}
            icon={building ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}>
            {building ? 'Строю карту…' : 'Построить карту ЦА'}
          </AuroraButton>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Стоимость: 1 запрос ИИ на карту + по 1 скану на нишу при поиске (до {maxNiches} сканов). Регион применяется в TikTok (Умный поиск) и YouTube.
        </p>

        {notice && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={16} className="mt-[2px] flex-shrink-0" style={{ color: '#10b981' }} /><span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <XCircle size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
          </div>
        )}
      </AuroraCard>

      {/* Карта ниш */}
      {map && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
              Микро-ниши: {map.niches.length}
            </div>
            <AuroraButton onClick={scanAll} disabled={scanningAll}
              icon={scanningAll ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
              {scanningAll ? 'Ищу по всем…' : `Найти ролики по всем нишам (${totalScans})`}
            </AuroraButton>
          </div>

          <div className="space-y-4">
            {map.niches.map((n) => {
              const sc = scans[n.id];
              const views = (sc?.videos || []).map((v) => v.stats?.play ?? 0);
              const med = median(views);
              const tier = demandTier(sc && sc.videos.length ? med : undefined);
              return (
                <AuroraCard key={n.id} className="p-4">
                  {/* Заголовок ниши */}
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="text-2xl leading-none mt-0.5">{n.emoji || '🎯'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{n.name}</h3>
                        {n.branch && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-600" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{n.branch}</span>
                        )}
                        {sc && sc.videos.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-700" style={{ background: tier.bg, color: tier.color }}>
                            {tier.label} · медиана {fmt(med)}
                          </span>
                        )}
                      </div>
                      {n.rationale && <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{n.rationale}</p>}
                      {n.angle && (
                        <p className="text-[12px] mt-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }}>
                          <b style={{ color: 'var(--brand)' }}>Идея:</b> {n.angle}
                        </p>
                      )}
                      {/* Кластер ключевиков — кликом сканируем нишу по конкретному слову */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {n.keywords.map((kw) => {
                          const active = sc?.keyword === kw;
                          return (
                            <button key={kw} type="button" onClick={() => scanNiche(n, kw)} disabled={sc?.scanning}
                              title="Искать по этому ключевику"
                              className="text-[11px] px-2 py-1 rounded-full font-600 transition-colors disabled:opacity-50"
                              style={{ background: active ? 'var(--brand)' : 'var(--bg-tertiary)', color: active ? 'var(--brand-contrast)' : 'var(--text-secondary)', border: `1px solid ${active ? 'var(--brand)' : 'var(--border-subtle)'}` }}>
                              {kw}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button type="button" onClick={() => scanNiche(n)} disabled={sc?.scanning}
                      className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors flex-shrink-0 disabled:opacity-50"
                      style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}>
                      {sc?.scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                      Найти ролики
                    </button>
                  </div>

                  {/* Результаты ниши */}
                  {sc?.error && (
                    <div className="flex items-start gap-2 text-[12px] rounded-lg p-2 mt-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                      <AlertCircle size={14} className="mt-[1px] flex-shrink-0" /><span>{sc.error}</span>
                    </div>
                  )}
                  {sc && !sc.scanning && !sc.error && sc.videos.length === 0 && (
                    <p className="text-[12px] mt-3" style={{ color: 'var(--text-muted)' }}>По этой нише ничего не нашлось — попробуйте другой ключевик.</p>
                  )}
                  {sc && sc.videos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 mt-3">
                      {sc.videos.map((v) => (
                        <div key={v.id || v.externalId} className="group rounded-xl overflow-hidden flex flex-col"
                          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                          <div className="relative w-full" style={{ aspectRatio: cardAspect, background: 'var(--bg-secondary)' }}>
                            {v.coverUrl ? (
                              <img src={coverSrc(v.coverUrl)} alt="" referrerPolicy="no-referrer" loading="lazy"
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Play size={24} style={{ color: 'var(--text-muted)' }} /></div>
                            )}
                            <span className="absolute bottom-1.5 left-1.5 text-[10px] font-700 inline-flex items-center gap-1"
                              style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
                              <Eye size={11} /> {fmt(v.stats?.play)}
                            </span>
                            {v.status === 'downloaded' && (
                              <span className="absolute top-1.5 right-1.5 text-[9px] px-1 py-0.5 rounded font-700 inline-flex items-center gap-0.5"
                                style={{ background: 'rgba(16,185,129,0.92)', color: '#fff' }}><CheckCircle2 size={10} /></span>
                            )}
                          </div>
                          <div className="p-2 flex flex-col gap-1.5 flex-1">
                            <div className="text-[11px] font-700 truncate" style={{ color: 'var(--text-primary)' }}>@{v.author}</div>
                            {(v.stats?.like != null) && (
                              <div className="text-[10px] inline-flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
                                <Heart size={10} /> {fmt(v.stats.like)}
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-auto pt-0.5">
                              {v.webUrl && (
                                <button type="button" onClick={() => onAnalyze(v.webUrl!, v.coverUrl)} title="Аналитика"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                                  style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)' }}>
                                  <BarChart3 size={13} />
                                </button>
                              )}
                              {v.webUrl && (
                                <a href={v.webUrl} target="_blank" rel="noreferrer" title="Открыть оригинал"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                  <ExternalLink size={13} />
                                </a>
                              )}
                              {v.fileUrl ? (
                                <a href={v.fileUrl} target="_blank" rel="noreferrer" title="Скачано — открыть файл"
                                  className="w-7 h-7 rounded-lg flex items-center justify-center ml-auto"
                                  style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                  <CheckCircle2 size={13} />
                                </a>
                              ) : v.status === 'downloading' ? (
                                <span className="w-7 h-7 rounded-lg flex items-center justify-center ml-auto"
                                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                  <Loader2 size={13} className="animate-spin" />
                                </span>
                              ) : (
                                <button type="button" onClick={() => download(n.id, v)} disabled={!v.id || platform === 'youtube'}
                                  title={platform === 'youtube' ? 'Скачивание YouTube недоступно' : 'Скачать (в фоне → Галерея)'}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center ml-auto transition-colors disabled:opacity-40"
                                  style={{ background: v.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'var(--brand)', color: v.status === 'failed' ? '#ef4444' : 'var(--brand-contrast)' }}>
                                  {v.status === 'failed' ? <AlertCircle size={13} /> : <Download size={13} />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AuroraCard>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[12px] rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            <ChevronRight size={14} className="flex-shrink-0" style={{ color: 'var(--brand)' }} />
            <span>Дальше: «Аналитика» разбирает выбранный ролик, «Скачать» кладёт его в Галерею — оттуда в TrendFlow, где встраиваете свой продукт под идею ниши.</span>
          </div>
        </>
      )}
    </>
  );
}
