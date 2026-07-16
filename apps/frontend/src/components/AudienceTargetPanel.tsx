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
  Download, CheckCircle2, AlertCircle, XCircle, ChevronRight, ChevronDown, Check, Film, Wand2, Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../config/i18n';
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
  realKeywords?: string[]; // ключевики, подтверждённые реальными подсказками запросов
  grounded?: boolean;
}
interface AudienceMap {
  product: string;
  audience: string;
  language?: string;
  region?: string;
  niches: AudienceNiche[];
  grounded?: boolean;
  groundingSource?: string;   // 'tiktok' | 'youtube'
  trendingHashtags?: string[];
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

// Регион (ISO alpha-2) → язык ключевиков по умолчанию (название на русском). Поле
// «Язык ключевиков» подставляется из региона при его выборе, но остаётся редактируемым.
// В СНГ, где контент массово на русском (RU/BY/KZ/KG), — «русский»; иначе титульный язык.
// ⚠ Значения — КАНОНИЧЕСКИЕ (русские): они уходят на бэкенд как спецификация языка
// ключевиков и сравниваются со списком KEYWORD_LANGS. В UI переводится только подпись
// (см. LANG_LABELS в компоненте) — сами значения НЕ переводить.
const REGION_LANG_NAME: Record<string, string> = {
  '': 'русский',
  RU: 'русский', BY: 'русский', KZ: 'русский', KG: 'русский',
  UA: 'украинский', UZ: 'узбекский', AZ: 'азербайджанский', GE: 'грузинский',
  AM: 'армянский', TJ: 'таджикский', MD: 'румынский',
  GB: 'английский', US: 'английский', CA: 'английский',
  DE: 'немецкий', FR: 'французский', IT: 'итальянский', ES: 'испанский',
  PL: 'польский', NL: 'нидерландский', TR: 'турецкий',
  AE: 'арабский', SA: 'арабский', EG: 'арабский',
  IN: 'хинди', ID: 'индонезийский', TH: 'тайский', VN: 'вьетнамский',
  BR: 'португальский', MX: 'испанский', AR: 'испанский', JP: 'японский', KR: 'корейский',
};

// Список языков для мультиселекта «Язык ключевиков» (частые — первыми). Можно выбрать
// несколько: ключевики строятся на каждом. Свой язык добавляется через «Другой язык…».
// ⚠ Тоже канонические значения — не переводить (см. комментарий у REGION_LANG_NAME).
const KEYWORD_LANGS = [
  'русский', 'английский', 'украинский', 'узбекский', 'казахский', 'киргизский',
  'азербайджанский', 'грузинский', 'армянский', 'таджикский', 'белорусский', 'румынский',
  'польский', 'немецкий', 'французский', 'испанский', 'итальянский', 'португальский',
  'нидерландский', 'турецкий', 'арабский', 'иврит', 'хинди', 'индонезийский',
  'вьетнамский', 'тайский', 'японский', 'корейский', 'китайский',
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
  if (med == null) return { label: i18n.t('common:sec.audience.demandNone', 'нет данных'), color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' };
  if (med >= 100_000) return { label: i18n.t('common:sec.audience.demandHigh', '🔥 высокий спрос'), color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  if (med >= 10_000) return { label: i18n.t('common:sec.audience.demandMid', '👍 средний спрос'), color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  return { label: i18n.t('common:sec.audience.demandLow', '💤 низкий спрос'), color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' };
}

function friendlyError(e: any, fallback: string): string {
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return i18n.t('common:sec.audience.netErr', 'Сервер недоступен — нет связи с API. Обновите страницу и попробуйте ещё раз.');
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
  const { t } = useTranslation('common');
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [seeds, setSeeds] = useState('');
  const [platform, setPlatform] = useState<Source>('tiktok');
  const [region, setRegion] = useState('');
  // Языки ключевиков — мультиселект (не ручной ввод): один или несколько, бэку уходят строкой.
  const [languages, setLanguages] = useState<string[]>(['русский']);
  const [langOpen, setLangOpen] = useState(false);
  const [customLang, setCustomLang] = useState('');
  const langBoxRef = useRef<HTMLDivElement | null>(null);
  const language = languages.join(', ');
  const [maxNiches, setMaxNiches] = useState(8);
  const [perNiche, setPerNiche] = useState(6); // видео на нишу при скане
  const [ground, setGround] = useState(true); // заземлять ключевики реальными запросами TikHub

  const [building, setBuilding] = useState(false);
  const [map, setMap] = useState<AudienceMap | null>(null);
  const [scans, setScans] = useState<Record<string, NicheScan>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rankOrder, setRankOrder] = useState<string[] | null>(null); // ниши, отсортированные по спросу
  const navigate = useNavigate();

  // Подписи языков в UI (значения остаются каноническими русскими — уходят на бэкенд).
  const LANG_LABELS: Record<string, string> = {
    'русский': t('sec.audience.langRu', 'русский'),
    'английский': t('sec.audience.langEn', 'английский'),
    'украинский': t('sec.audience.langUk', 'украинский'),
    'узбекский': t('sec.audience.langUz', 'узбекский'),
    'казахский': t('sec.audience.langKk', 'казахский'),
    'киргизский': t('sec.audience.langKy', 'киргизский'),
    'азербайджанский': t('sec.audience.langAz', 'азербайджанский'),
    'грузинский': t('sec.audience.langKa', 'грузинский'),
    'армянский': t('sec.audience.langHy', 'армянский'),
    'таджикский': t('sec.audience.langTg', 'таджикский'),
    'белорусский': t('sec.audience.langBe', 'белорусский'),
    'румынский': t('sec.audience.langRo', 'румынский'),
    'польский': t('sec.audience.langPl', 'польский'),
    'немецкий': t('sec.audience.langDe', 'немецкий'),
    'французский': t('sec.audience.langFr', 'французский'),
    'испанский': t('sec.audience.langEs', 'испанский'),
    'итальянский': t('sec.audience.langIt', 'итальянский'),
    'португальский': t('sec.audience.langPt', 'португальский'),
    'нидерландский': t('sec.audience.langNl', 'нидерландский'),
    'турецкий': t('sec.audience.langTr', 'турецкий'),
    'арабский': t('sec.audience.langAr', 'арабский'),
    'иврит': t('sec.audience.langHe', 'иврит'),
    'хинди': t('sec.audience.langHi', 'хинди'),
    'индонезийский': t('sec.audience.langId', 'индонезийский'),
    'вьетнамский': t('sec.audience.langVi', 'вьетнамский'),
    'тайский': t('sec.audience.langTh', 'тайский'),
    'японский': t('sec.audience.langJa', 'японский'),
    'корейский': t('sec.audience.langKo', 'корейский'),
    'китайский': t('sec.audience.langZh', 'китайский'),
  };
  const langLabel = (l: string) => LANG_LABELS[l] || l;

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // Мультиселект языков: клик по языку добавляет/убирает (последний не убираем — хотя бы один нужен).
  const toggleLang = (l: string) => {
    setLanguages((cur) => cur.includes(l) ? (cur.length > 1 ? cur.filter((x) => x !== l) : cur) : [...cur, l]);
  };
  const addCustomLang = () => {
    const l = customLang.trim().toLowerCase().slice(0, 30);
    if (!l) return;
    setLanguages((cur) => (cur.some((x) => x.toLowerCase() === l) ? cur : [...cur, l]));
    setCustomLang('');
  };
  // Выбранные кастомные языки показываем в списке вместе со стандартными.
  const allLangs = [...KEYWORD_LANGS, ...languages.filter((l) => !KEYWORD_LANGS.includes(l))];
  useEffect(() => {
    if (!langOpen) return;
    const onDown = (e: MouseEvent) => {
      if (langBoxRef.current && !langBoxRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [langOpen]);

  // ── «Подсказать»: ИИ по описанию продукта заполняет «Базовая ЦА» и «Ключевые слова» (редактируемо) ──
  const [suggesting, setSuggesting] = useState(false);
  const suggest = async () => {
    if (!product.trim()) { setError(t('sec.audience.suggestNeedProduct', 'Сначала опишите, что продвигаем — ИИ подскажет ЦА и ключевики.')); return; }
    setSuggesting(true); setError(null);
    try {
      const res = await fetch('/api/trends/audience-suggest', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ product: product.trim(), platform, region, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const s = data.suggestion || {};
      if (s.audience) setAudience(s.audience);
      if (Array.isArray(s.keywords) && s.keywords.length) setSeeds(s.keywords.join(', '));
      setNotice(t('sec.audience.suggestDone', 'ИИ подсказал ЦА и ключевики — поправьте под себя и жмите «Построить карту ЦА».'));
    } catch (e: any) { setError(friendlyError(e, t('sec.audience.suggestFailed', 'Не удалось подсказать ЦА'))); }
    finally { setSuggesting(false); }
  };

  // ── Один клик: построить карту → СРАЗУ найти ролики по всем нишам → ранжировать по спросу ──
  const buildMap = async () => {
    if (!product.trim() || !audience.trim()) { setError(t('sec.audience.needProductAudience', 'Заполните продукт и базовую ЦА — или опишите продукт и нажмите «Подсказать».')); return; }
    setBuilding(true); setError(null); setNotice(null); setMap(null); setScans({}); setRankOrder(null);
    try {
      const res = await fetch('/api/trends/audience-map', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ product: product.trim(), audience: audience.trim(), seedKeywords: seeds, platform, region, language, maxNiches, ground }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMap(data.map);
      setNotice([
        t('sec.audience.mapReady', 'Готово: {{n}} ниш.', { n: data.map?.niches?.length ?? 0 }),
        data.map?.grounded ? t('sec.audience.groundedSuffix', 'Ключевики — по реальным запросам.') : '',
        t('sec.audience.autoScanNote', 'Ищу ролики и ранжирую по спросу…'),
      ].filter(Boolean).join(' '));
      void runAllAndRank(data.map.niches); // авто: сканим все ниши и сортируем по спросу
    } catch (e: any) { setError(friendlyError(e, t('sec.audience.mapFailed', 'Не удалось построить карту ЦА'))); }
    finally { setBuilding(false); }
  };

  // Скан одной ниши по ключевику. Возвращает найденные видео (для ранжирования).
  const scanNiche = async (niche: AudienceNiche, keyword?: string): Promise<StoredVideo[]> => {
    const kw = (keyword || niche.keywords[0] || niche.name).trim();
    setScans((s) => ({ ...s, [niche.id]: { videos: s[niche.id]?.videos || [], scanning: true, keyword: kw } }));
    try {
      const res = await fetch('/api/trends/scan', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ kind: 'keyword', query: kw, count: perNiche, mode: 'app', platform, region, filters: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const vids: StoredVideo[] = data.videos || [];
      setScans((s) => ({ ...s, [niche.id]: { videos: vids, scanning: false, keyword: kw } }));
      return vids;
    } catch (e: any) {
      setScans((s) => ({ ...s, [niche.id]: { videos: s[niche.id]?.videos || [], scanning: false, error: friendlyError(e, t('sec.audience.scanFailed', 'Ошибка скана')), keyword: kw } }));
      return [];
    }
  };

  // Сканит все ниши подряд и ранжирует по спросу (медиана просмотров) — лучшие сверху.
  const [scanningAll, setScanningAll] = useState(false);
  const runAllAndRank = async (niches: AudienceNiche[]) => {
    setScanningAll(true);
    const demand: Record<string, number> = {};
    for (const n of niches) {
      // eslint-disable-next-line no-await-in-loop
      const vids = await scanNiche(n);
      const med = median(vids.map((v) => v.stats?.play ?? 0));
      demand[n.id] = vids.length ? (med ?? 0) : -1; // без результатов — в конец
    }
    setRankOrder([...niches].sort((a, b) => (demand[b.id] ?? -1) - (demand[a.id] ?? -1)).map((n) => n.id));
    setScanningAll(false);
    setNotice(t('sec.audience.rankedNotice', 'Ранжировано по спросу — ниши с бóльшим спросом сверху. На нужной нажмите «В TrendFlow».'));
  };
  const scanAll = () => { if (map) void runAllAndRank(map.niches); };

  // ── Один клик «В TrendFlow»: создаём сценарий с темой/идеей/ключевиками/референсом и открываем ──
  const [flowBusy, setFlowBusy] = useState<string | null>(null);
  const nicheBrief = (n: AudienceNiche): string => {
    const ref = scans[n.id]?.videos?.find((v) => v.webUrl)?.webUrl;
    return [
      t('sec.audience.briefProduct', 'Продукт/оффер: {{v}}', { v: map?.product || product }),
      t('sec.audience.briefNiche', 'Ниша (тема-прокси ЦА): {{v}}', { v: `${n.name}${n.branch ? ` — ${n.branch}` : ''}` }),
      n.rationale && t('sec.audience.briefWhy', 'Почему ловит аудиторию: {{v}}', { v: n.rationale }),
      n.angle && t('sec.audience.briefAngle', 'Идея/хук: {{v}}', { v: n.angle }),
      n.keywords?.length && t('sec.audience.briefKeywords', 'Ключевики: {{v}}', { v: n.keywords.join(', ') }),
      ref && t('sec.audience.briefRef', 'Референс-ролик: {{v}}', { v: ref }),
      t('sec.audience.briefTask', 'Задача: снять ролик на эту тему и встроить продукт под идею.'),
    ].filter(Boolean).join('\n');
  };
  const toTrendFlow = async (n: AudienceNiche) => {
    setFlowBusy(n.id); setError(null);
    try {
      const brief = nicheBrief(n);
      const cr = await fetch('/api/flows', { method: 'POST', headers: headers(), body: JSON.stringify({ name: t('sec.audience.flowName', 'ЦА · {{name}}', { name: n.name }).slice(0, 120) }) });
      const cd = await cr.json();
      if (!cr.ok || !cd.flow?.id) throw new Error(cd?.error || `HTTP ${cr.status}`);
      const id = cd.flow.id;
      // Сид сценария: brief на верхнем уровне (идёт во все блоки рендера) + ugc.brief (студия мержит с дефолтом).
      await fetch(`/api/flows/${id}`, {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ graph: { nodes: [], edges: [], brief, ugc: { source: 'gen', brief } } }),
      });
      navigate(`/gallery?tab=ugc&openFlow=${encodeURIComponent(id)}`);
    } catch (e: any) {
      setError(friendlyError(e, t('sec.audience.flowFailed', 'Не удалось создать сценарий в TrendFlow')));
      setFlowBusy(null);
    }
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
    if (!v.id) { setError(t('sec.audience.vidNotSaved', 'Видео не сохранилось — нажмите «Найти ролики» ещё раз.')); return; }
    setScans((s) => ({ ...s, [nicheId]: { ...s[nicheId], videos: s[nicheId].videos.map((x) => x.id === v.id ? { ...x, status: 'downloading' } : x) } }));
    try {
      const res = await fetch(`/api/trends/videos/${v.id}/download`, { method: 'POST', headers: headers() });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${res.status}`); }
    } catch (e: any) {
      setScans((s) => ({ ...s, [nicheId]: { ...s[nicheId], videos: s[nicheId].videos.map((x) => x.id === v.id ? { ...x, status: 'failed' } : x) } }));
      setError(friendlyError(e, t('sec.audience.dlFailed', 'Не удалось скачать')));
    }
  };

  const totalScans = map ? map.niches.length : 0;
  const cardAspect = platform === 'youtube' ? '16 / 9' : '9 / 16';
  // Ниши в порядке ранга по спросу (после авто-скана); до ранжирования — как есть.
  const orderedNiches = map ? (rankOrder ? [...map.niches].sort((a, b) => rankOrder.indexOf(a.id) - rankOrder.indexOf(b.id)) : map.niches) : [];

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
            <h2 className="text-base font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.audience.title', 'Таргет на целевую аудиторию')}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t('sec.audience.intro', 'Опишите продукт и аудиторию — ИИ разложит её на узкие ниши-темы и подберёт ключевики, а мы найдём под каждую реальные ролики. Меньше конкуренции, точнее попадание. Не знаете аудиторию — опишите продукт и нажмите «Подсказать»: ИИ заполнит ЦА и ключевики сам.')}
            </p>
            <p className="text-[11px] mt-1 font-600" style={{ color: 'var(--brand)' }}>
              {t('sec.audience.oneClickHint', 'Один клик: строим ниши → находим ролики → ранжируем по спросу. Дальше — «В TrendFlow» на нужной нише.')}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center justify-between gap-2">
              <span>{t('sec.audience.productLabel', 'Что продвигаем (продукт / оффер / смысл)')}</span>
              <button type="button" onClick={(e) => { e.preventDefault(); void suggest(); }} disabled={suggesting || !product.trim()}
                title={t('sec.audience.suggestTitle', 'ИИ по описанию продукта сам заполнит «Базовая ЦА» и «Ключевые слова» — потом их можно править и дополнять')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-600 transition-colors disabled:opacity-45"
                style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)', border: '1px solid rgba(99,102,241,0.35)', cursor: 'pointer' }}>
                {suggesting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {suggesting ? t('sec.audience.suggesting', 'Подсказываю…') : t('sec.audience.suggestBtn', 'Подсказать')}
              </button>
            </span>
            <textarea value={product} onChange={(e) => setProduct(e.target.value)} rows={2}
              placeholder={t('sec.audience.productPh', 'напр.: онлайн-школа инвестиций для предпринимателей')}
              className="px-3 py-2 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </label>
          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('sec.audience.audienceLabel', 'Базовая целевая аудитория')}
            <textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={2}
              placeholder={t('sec.audience.audiencePh', 'напр.: богатые люди / предприниматели и их жёны')}
              className="px-3 py-2 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {t('sec.audience.seedsLabel', 'Ваши ключевые слова (необязательно — ИИ учтёт и расширит; через запятую)')}
          <input value={seeds} onChange={(e) => setSeeds(e.target.value)}
            placeholder={t('sec.audience.seedsPh', 'напр.: гольф, падл, конный спорт, F1, горные лыжи')}
            className="px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
        </label>

        <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('sec.audience.platformLabel', 'Площадка')}
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Source)}
              className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
              {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="inline-flex items-center gap-1"><Globe size={12} /> {t('sec.audience.regionLabel', 'Регион')}</span>
            <select value={region} onChange={(e) => { const r = e.target.value; setRegion(r); setLanguages([REGION_LANG_NAME[r] || 'русский']); }}
              className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ minWidth: 170, background: region ? 'rgba(99,102,241,0.10)' : 'var(--bg-tertiary)', border: `1px solid ${region ? 'var(--brand)' : 'var(--border-medium)'}`, color: 'var(--text-primary)' }}>
              <option value="">{t('sec.audience.regionGlobal', '🌐 Глобально')}</option>
              {REGION_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {REGIONS.filter((r) => r.group === g).map((r) => <option key={r.code} value={r.code}>{r.flag} {r.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>

          <div ref={langBoxRef} className="relative flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span title={t('sec.audience.langLabelTitle', 'Подставляется из региона автоматически — можно выбрать один или несколько языков')}>{t('sec.audience.langLabel', 'Язык ключевиков')}</span>
            <button type="button" onClick={() => setLangOpen((o) => !o)} aria-expanded={langOpen}
              title={t('sec.audience.langBtnTitle', 'Выберите язык(и) из списка — ключевики будут на каждом выбранном')}
              className="h-10 px-3 rounded-lg text-sm inline-flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ minWidth: 150, maxWidth: 210, background: 'var(--bg-tertiary)', border: `1px solid ${langOpen ? 'var(--brand)' : 'var(--border-medium)'}`, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <span className="truncate">{langLabel(languages[0])}{languages.length > 1 ? ` +${languages.length - 1}` : ''}</span>
              <ChevronDown size={14} className="flex-shrink-0 transition-transform" style={{ transform: langOpen ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)' }} />
            </button>
            {langOpen && (
              <div className="absolute z-50 top-full left-0 mt-1 w-60 rounded-xl shadow-xl p-2"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}>
                <div className="text-[10px] px-1 pb-1.5" style={{ color: 'var(--text-muted)' }}>
                  {t('sec.audience.langMultiHint', 'Можно выбрать несколько — ключевики будут на каждом языке')}
                </div>
                <div className="max-h-60 overflow-y-auto pr-0.5">
                  {allLangs.map((l) => {
                    const sel = languages.includes(l);
                    return (
                      <button key={l} type="button" onClick={() => toggleLang(l)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: sel ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                        <span className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: sel ? 'var(--brand)' : 'var(--bg-tertiary)', border: `1px solid ${sel ? 'var(--brand)' : 'var(--border-medium)'}` }}>
                          {sel && <Check size={11} strokeWidth={3} style={{ color: 'var(--brand-contrast)' }} />}
                        </span>
                        {langLabel(l)}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1.5 pt-1.5 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <input value={customLang} onChange={(e) => setCustomLang(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomLang(); } }}
                    placeholder={t('sec.audience.langCustomPh', 'Другой язык…')}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  <button type="button" onClick={addCustomLang} disabled={!customLang.trim()} title={t('sec.audience.langAddTitle', 'Добавить язык')}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-40"
                    style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', cursor: 'pointer' }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('sec.audience.nichesLabel', 'Ниш')}
            <select value={maxNiches} onChange={(e) => setMaxNiches(Number(e.target.value))}
              className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
              {[4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('sec.audience.perNicheLabel', 'Видео / нишу')}
            <select value={perNiche} onChange={(e) => setPerNiche(Number(e.target.value))}
              className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
              {[4, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <AuroraButton onClick={buildMap} disabled={building}
            icon={building ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}>
            {building ? t('sec.audience.building', 'Строю карту…') : t('sec.audience.buildBtn', 'Построить карту ЦА')}
          </AuroraButton>
        </div>

        {/* Заземление ключевиков — тумблер-НАСТРОЙКА (отдельной строкой, не путать с кнопкой действия). */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button type="button" role="switch" aria-checked={ground} onClick={() => setGround((g) => !g)}
            title={t('sec.audience.groundToggleTitle', 'Берём ключевики из реальных поисковых запросов TikTok/YouTube вместо чистых догадок ИИ. Это дешёвая проверка: видео не сканируются.')}
            className="inline-flex items-center gap-2 text-[12px] font-600 px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <span className="relative inline-block w-8 h-[18px] rounded-full transition-colors flex-shrink-0"
                  style={{ background: ground ? 'var(--brand)' : 'var(--border-strong)' }}>
              <span className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all"
                    style={{ left: ground ? 16 : 2, background: '#fff' }} />
            </span>
            {t('sec.audience.groundToggle', '🔎 Проверять ключевики реальными запросами')}
          </button>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {ground ? t('sec.audience.groundOn', 'вкл. — берём реальные запросы TikTok/YouTube вместо догадок ИИ (дёшево)') : t('sec.audience.groundOff', 'выкл. — ключевики только от ИИ (быстрее, но непроверенные)')}
          </span>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {t('sec.audience.costPrefix', 'В один клик: 1 запрос ИИ на карту')}{ground ? ` ${t('sec.audience.costGround', '+ по 1 подсказке-запросу на нишу (дёшево)')}` : ''} {t('sec.audience.costScan', '+ по 1 скану на нишу (до {{n}} — они и ранжируют ниши по спросу).', { n: maxNiches })}
          {' '}{t('sec.audience.costRegion', 'Регион и реальные запросы работают в TikTok и YouTube.')}
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
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                {t('sec.audience.nichesCount', 'Микро-ниши: {{n}}', { n: map.niches.length })}
              </div>
              {map.grounded ? (
                <span className="text-[11px] px-2 py-1 rounded-full font-600 inline-flex items-center gap-1"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                  title={t('sec.audience.groundedBadgeTitle', 'Ключевики взяты из реальных подсказок запросов, а не догадка ИИ')}>
                  <Search size={11} /> {t('sec.audience.groundedBadge', 'Реальные запросы')} · {map.groundingSource === 'youtube' ? 'YouTube' : 'TikTok'}{map.region ? ` · ${map.region}` : ''}
                </span>
              ) : (
                <span className="text-[11px] px-2 py-1 rounded-full font-600"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                  title={t('sec.audience.aiOnlyTitle', 'Ключевики сгенерированы ИИ без проверки реальными запросами — включите «Проверять ключевики реальными запросами» (работает в TikTok и YouTube)')}>
                  {t('sec.audience.aiOnlyBadge', 'ключевики от ИИ')}
                </span>
              )}
              {rankOrder && (
                <span className="text-[11px] px-2 py-1 rounded-full font-600" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  title={t('sec.audience.rankBadgeTitle', 'Ниши отсортированы: с бóльшим спросом — сверху')}>{t('sec.audience.rankBadge', '↓ по спросу')}</span>
              )}
            </div>
            <AuroraButton variant="secondary" onClick={scanAll} disabled={scanningAll}
              icon={scanningAll ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
              {scanningAll ? t('sec.audience.scanningAllBtn', 'Ищу по нишам… ({{n}})', { n: totalScans }) : t('sec.audience.rescanBtn', 'Пересканировать ({{n}})', { n: totalScans })}
            </AuroraButton>
          </div>

          <div className="space-y-4">
            {orderedNiches.map((n, idx) => {
              const sc = scans[n.id];
              const views = (sc?.videos || []).map((v) => v.stats?.play ?? 0);
              const med = median(views);
              const tier = demandTier(sc && sc.videos.length ? med : undefined);
              return (
                <AuroraCard key={n.id} className="p-4">
                  {/* Заголовок ниши */}
                  <div className="flex items-start gap-3 flex-wrap">
                    {rankOrder && (
                      <span className="text-[11px] font-700 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: idx < 3 ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)', color: idx < 3 ? '#10b981' : 'var(--text-muted)' }}
                        title={t('sec.audience.rankPosTitle', 'Позиция по спросу')}>#{idx + 1}</span>
                    )}
                    <div className="text-2xl leading-none mt-0.5">{n.emoji || '🎯'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{n.name}</h3>
                        {n.branch && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-600" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{n.branch}</span>
                        )}
                        {sc && sc.videos.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-700" style={{ background: tier.bg, color: tier.color }}>
                            {tier.label} · {t('sec.audience.median', 'медиана')} {fmt(med)}
                          </span>
                        )}
                      </div>
                      {n.rationale && <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{n.rationale}</p>}
                      {n.angle && (
                        <p className="text-[12px] mt-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }}>
                          <b style={{ color: 'var(--brand)' }}>{t('sec.audience.angleLabel', 'Идея:')}</b> {n.angle}
                        </p>
                      )}
                      {/* Кластер ключевиков — кликом сканируем нишу по конкретному слову */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {n.keywords.map((kw) => {
                          const active = sc?.keyword === kw;
                          const isReal = (n.realKeywords || []).some((x) => x.toLowerCase() === kw.toLowerCase());
                          return (
                            <button key={kw} type="button" onClick={() => scanNiche(n, kw)} disabled={sc?.scanning}
                              title={isReal ? t('sec.audience.kwRealTitle', 'Реальный запрос (из подсказок поиска площадки) — искать по нему') : t('sec.audience.kwAiTitle', 'Ключевик от ИИ — искать по нему')}
                              className="text-[11px] px-2 py-1 rounded-full font-600 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                              style={{
                                background: active ? 'var(--brand)' : (isReal ? 'rgba(16,185,129,0.10)' : 'var(--bg-tertiary)'),
                                color: active ? 'var(--brand-contrast)' : (isReal ? '#10b981' : 'var(--text-secondary)'),
                                border: `1px solid ${active ? 'var(--brand)' : (isReal ? 'rgba(16,185,129,0.4)' : 'var(--border-subtle)')}`,
                              }}>
                              {isReal && !active && <Check size={10} strokeWidth={3} />}{kw}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button type="button" onClick={() => scanNiche(n)} disabled={sc?.scanning}
                        className="inline-flex items-center justify-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                        style={{ background: 'var(--brand)', color: 'var(--brand-contrast)' }}>
                        {sc?.scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        {t('sec.audience.findBtn', 'Найти ролики')}
                      </button>
                      <button type="button" onClick={() => toTrendFlow(n)} disabled={flowBusy === n.id}
                        title={t('sec.audience.toFlowTitle', 'Создать сценарий в TrendFlow, заполненный темой/идеей/ключевиками этой ниши (+ референс), и открыть его')}
                        className="inline-flex items-center justify-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)', border: '1px solid rgba(99,102,241,0.35)' }}>
                        {flowBusy === n.id ? <Loader2 size={14} className="animate-spin" /> : <Film size={14} />}
                        {t('sec.audience.toFlowBtn', 'В TrendFlow')}
                      </button>
                    </div>
                  </div>

                  {/* Результаты ниши */}
                  {sc?.error && (
                    <div className="flex items-start gap-2 text-[12px] rounded-lg p-2 mt-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                      <AlertCircle size={14} className="mt-[1px] flex-shrink-0" /><span>{sc.error}</span>
                    </div>
                  )}
                  {sc && !sc.scanning && !sc.error && sc.videos.length === 0 && (
                    <p className="text-[12px] mt-3" style={{ color: 'var(--text-muted)' }}>{t('sec.audience.nicheEmpty', 'По этой нише ничего не нашлось — попробуйте другой ключевик.')}</p>
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
                                <button type="button" onClick={() => onAnalyze(v.webUrl!, v.coverUrl)} title={t('sec.audience.analyzeTitle', 'Аналитика')}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                                  style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)' }}>
                                  <BarChart3 size={13} />
                                </button>
                              )}
                              {v.webUrl && (
                                <a href={v.webUrl} target="_blank" rel="noreferrer" title={t('sec.audience.openOrigTitle', 'Открыть оригинал')}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                  <ExternalLink size={13} />
                                </a>
                              )}
                              {v.fileUrl ? (
                                <a href={v.fileUrl} target="_blank" rel="noreferrer" title={t('sec.audience.downloadedTitle', 'Скачано — открыть файл')}
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
                                  title={platform === 'youtube' ? t('sec.audience.ytDlOff', 'Скачивание YouTube недоступно') : t('sec.audience.dlTitle', 'Скачать (в фоне → Галерея)')}
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
            <span>{t('sec.audience.footerHint', '«В TrendFlow» на нужной нише — создаёт сценарий с её темой/идеей/ключевиками и открывает студию. Или «Аналитика»/«Скачать» по конкретному ролику-референсу.')}</span>
          </div>
        </>
      )}
    </>
  );
}
