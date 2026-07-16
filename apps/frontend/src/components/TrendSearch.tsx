/**
 * TrendSearch — переиспользуемый блок «Поиск горячих видео» (TikHub).
 *
 * Выделен из TrendsPage, чтобы один и тот же поиск трендов работал и на странице
 * «Тренды» (анализ через TrendAnalyticsPanel), и во вкладке «Social Media Extension»
 * (анализ через рехостнутое расширение в iframe). Сам поиск/скачивание — через
 * /api/trends/*; что делать с «Аналитикой» — решает родитель через колбэки
 * onAnalyze / onAnalyzeBulk.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, Search, Loader2, Download, ExternalLink, CheckCircle2, XCircle, AlertCircle,
  Eye, Heart, MessageCircle, Play, CheckSquare, Square, Check, BarChart3, Trash2, X, RefreshCw, Globe,
} from 'lucide-react';
import { AuroraCard } from './AuroraCard';
import { AuroraButton } from './AuroraButton';
import { ConfirmModal } from './ConfirmModal';

type Kind = 'keyword' | 'trending';
type Source = 'tiktok' | 'instagram' | 'youtube' | 'twitter';

/**
 * Сигнатура i18next-t (ключ + русский фолбэк + опции). Справочники ниже —
 * ФУНКЦИИ от t: литеральные вызовы t('sec…', '…') собирает harvest-sec-keys,
 * а перевод происходит в момент рендера (не при импорте модуля).
 */
type TFn = (key: string, def: string, opts?: Record<string, unknown>) => string;
/** «Как есть»: русские дефолты без перевода — для модульных снапшотов данных. */
const ruT: TFn = (_key, def) => def;

/**
 * TikTok/Instagram отдают подписанные CDN-обложки (p16-…-sign.tiktokcdn-eu.com и т.п.),
 * которые браузер блокирует при прямой загрузке через <img> (ORB / 403 — нужен Referer
 * площадки). Гоним их через наш публичный прокси /api/channels/cover (он ставит нужный
 * Referer серверно). YouTube (ytimg) и прочие — напрямую. Тот же приём, что в «Каналах».
 */
export function coverSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/tiktokcdn|ibyteimg|byteimg|muscdn|tiktokv|pstatp|cdninstagram|fbcdn/i.test(url)) {
    return `/api/channels/cover?u=${encodeURIComponent(url)}`;
  }
  return url;
}

// Источники трендов. Дизайн: брендовый глиф в мягком тонированном «app-icon» чипе
// (currentColor → color, фон → tint), выбор источника — indigo-выделение пилюли.
// TikTok/X монохромны (color = текст темы), IG/YouTube — приглушённый бренд-акцент.
// Reddit убран (расширение его не анализирует); у X нет ленты «Горячее» — только поиск.
const PLATFORMS: { id: Source; name: string; color: string; tint: string; trending: boolean; icon: React.ReactNode }[] = [
  { id: 'tiktok', name: 'TikTok', color: 'var(--text-primary)', tint: 'var(--bg-elevated)', trending: true, icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.8c-.9-.6-1.5-1.6-1.7-2.8h-2.6v11.4c0 1.3-1 2.3-2.3 2.3s-2.3-1-2.3-2.3 1-2.3 2.3-2.3c.2 0 .5 0 .7.1v-2.7c-.2 0-.5-.1-.7-.1A5 5 0 1 0 14.9 14V8.7c1 .7 2.2 1.1 3.5 1.1V7.2c-.7 0-1.3-.2-1.8-.5z"/></svg>
  ) },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', tint: 'rgba(225,48,108,0.14)', trending: true, icon: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>
  ) },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', tint: 'rgba(255,0,0,0.12)', trending: true, icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.75-1.77C18.27 5 12 5 12 5s-6.27 0-7.85.43A2.5 2.5 0 0 0 2.4 7.2 26.2 26.2 0 0 0 2 12a26.2 26.2 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.75 1.77C5.73 19 12 19 12 19s6.27 0 7.85-.43a2.5 2.5 0 0 0 1.75-1.77A26.2 26.2 0 0 0 22 12a26.2 26.2 0 0 0-.4-4.8zM10 15V9l5.2 3-5.2 3z"/></svg>
  ) },
  { id: 'twitter', name: 'X', color: 'var(--text-primary)', tint: 'var(--bg-elevated)', trending: false, icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.3 8.3L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L1 2h7l4.8 6.3L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z"/></svg>
  ) },
];

interface FilterDef { key: string; label: string; def: string; options: { v: string; label: string }[] }
// Фильтры площадок — функция от t (подписи переводятся при рендере; key/def стабильны).
const buildPlatformFilters = (t: TFn): Partial<Record<Source, FilterDef[]>> => ({
  youtube: [
    { key: 'yt_kind', label: t('sec.trends.fltFormat', 'Формат'), def: 'video', options: [
      { v: 'video', label: t('sec.trends.fltFormatVideo', 'Видео') }, { v: 'shorts', label: 'Shorts' }] },
    { key: 'sort_by', label: t('sec.trends.sortLbl', 'Сортировка'), def: 'relevance', options: [
      { v: 'relevance', label: t('sec.trends.sortRelevance', 'По релевантности') }, { v: 'upload_date', label: t('sec.trends.ytSortNew', 'Новые') },
      { v: 'view_count', label: t('sec.trends.ytSortViews', 'Больше просмотров') }, { v: 'rating', label: t('sec.trends.ytSortRating', 'По рейтингу') }] },
    { key: 'upload_time', label: t('sec.trends.periodLbl', 'Период'), def: '', options: [
      { v: '', label: t('sec.trends.periodAll', 'Всё время') }, { v: 'hour', label: t('sec.trends.periodHour', 'Час') }, { v: 'today', label: t('sec.trends.periodToday', 'Сегодня') },
      { v: 'week', label: t('sec.trends.periodWeek', 'Неделя') }, { v: 'month', label: t('sec.trends.periodMonth', 'Месяц') }, { v: 'year', label: t('sec.trends.periodYear', 'Год') }] },
    { key: 'duration', label: t('sec.trends.fltDuration', 'Длительность'), def: '', options: [
      { v: '', label: t('sec.trends.durAny', 'Любая') }, { v: 'short', label: t('sec.trends.durShort', 'Короткие') }, { v: 'medium', label: t('sec.trends.durMedium', 'Средние') }, { v: 'long', label: t('sec.trends.durLong', 'Длинные') }] },
  ],
  twitter: [
    { key: 'search_type', label: t('sec.trends.fltType', 'Тип'), def: 'Top', options: [
      { v: 'Top', label: t('sec.trends.twTop', 'Топ') }, { v: 'Latest', label: t('sec.trends.twLatest', 'Свежие') }, { v: 'Media', label: t('sec.trends.twMedia', 'С медиа') }] },
  ],
});
// Русский снапшот — только ради key/def в defaultFilters (подписи тут не рендерятся).
const PLATFORM_FILTERS_RU = buildPlatformFilters(ruT);
const defaultFilters = (id: Source): Record<string, string> => {
  const out: Record<string, string> = {};
  (PLATFORM_FILTERS_RU[id] || []).forEach((f) => { if (f.def) out[f.key] = f.def; });
  return out;
};

// Регион выдачи (ISO-3166 alpha-2). '' = глобально (без гео-подсказки алгоритму).
// Подмешивается в поиск там, где API это поддерживает: TikTok «Умный поиск» и YouTube
// (там же под гео подтягивается язык региона). Сгруппировано; СНГ первыми — под аудиторию.
export interface Region { code: string; name: string; flag: string; group?: string }
// Группы — ДИСКРИМИНАТОРЫ (сравнение r.group === g): сами значения не переводим,
// отображаемые подписи групп даёт regionGroupNames(t) ниже.
const G_CIS = 'СНГ и соседи';
const G_EU = 'Европа';
const G_ME = 'Ближний Восток';
const G_ASIA = 'Азия';
const G_AM = 'Америка';
// Порядок групп для optgroup (первым идёт «Глобально» без группы).
export const REGION_GROUPS = [G_CIS, G_EU, G_ME, G_ASIA, G_AM];
/** Переводимые подписи групп региона (ключ = значение-дискриминатор из REGION_GROUPS). */
export const regionGroupNames = (t: TFn): Record<string, string> => ({
  [G_CIS]: t('sec.trends.regionGroupCis', 'СНГ и соседи'),
  [G_EU]: t('sec.trends.regionGroupEurope', 'Европа'),
  [G_ME]: t('sec.trends.regionGroupMideast', 'Ближний Восток'),
  [G_ASIA]: t('sec.trends.regionGroupAsia', 'Азия'),
  [G_AM]: t('sec.trends.regionGroupAmerica', 'Америка'),
});
/** Имена регионов по коду — ЕДИНСТВЕННЫЙ источник русских названий (литеральные
 *  t() собирает harvest-sec-keys → перевод). REGIONS ниже строится из снапшота. */
export const regionNames = (t: TFn): Record<string, string> => ({
  '': t('sec.trends.regionGlobal', 'Глобально (без региона)'),
  RU: t('sec.trends.regionRU', 'Россия'),
  UA: t('sec.trends.regionUA', 'Украина'),
  KZ: t('sec.trends.regionKZ', 'Казахстан'),
  UZ: t('sec.trends.regionUZ', 'Узбекистан'),
  BY: t('sec.trends.regionBY', 'Беларусь'),
  AZ: t('sec.trends.regionAZ', 'Азербайджан'),
  GE: t('sec.trends.regionGE', 'Грузия'),
  AM: t('sec.trends.regionAM', 'Армения'),
  KG: t('sec.trends.regionKG', 'Кыргызстан'),
  TJ: t('sec.trends.regionTJ', 'Таджикистан'),
  MD: t('sec.trends.regionMD', 'Молдова'),
  GB: t('sec.trends.regionGB', 'Великобритания'),
  DE: t('sec.trends.regionDE', 'Германия'),
  FR: t('sec.trends.regionFR', 'Франция'),
  IT: t('sec.trends.regionIT', 'Италия'),
  ES: t('sec.trends.regionES', 'Испания'),
  PL: t('sec.trends.regionPL', 'Польша'),
  NL: t('sec.trends.regionNL', 'Нидерланды'),
  TR: t('sec.trends.regionTR', 'Турция'),
  AE: t('sec.trends.regionAE', 'ОАЭ'),
  SA: t('sec.trends.regionSA', 'Саудовская Аравия'),
  EG: t('sec.trends.regionEG', 'Египет'),
  IN: t('sec.trends.regionIN', 'Индия'),
  ID: t('sec.trends.regionID', 'Индонезия'),
  TH: t('sec.trends.regionTH', 'Таиланд'),
  VN: t('sec.trends.regionVN', 'Вьетнам'),
  PH: t('sec.trends.regionPH', 'Филиппины'),
  JP: t('sec.trends.regionJP', 'Япония'),
  KR: t('sec.trends.regionKR', 'Корея'),
  US: t('sec.trends.regionUS', 'США'),
  CA: t('sec.trends.regionCA', 'Канада'),
  BR: t('sec.trends.regionBR', 'Бразилия'),
  MX: t('sec.trends.regionMX', 'Мексика'),
  AR: t('sec.trends.regionAR', 'Аргентина'),
});
const RU_REGION = regionNames(ruT);
export const REGIONS: Region[] = [
  { code: '', name: RU_REGION[''], flag: '🌐' },
  // СНГ и соседи
  { code: 'RU', name: RU_REGION.RU, flag: '🇷🇺', group: G_CIS },
  { code: 'UA', name: RU_REGION.UA, flag: '🇺🇦', group: G_CIS },
  { code: 'KZ', name: RU_REGION.KZ, flag: '🇰🇿', group: G_CIS },
  { code: 'UZ', name: RU_REGION.UZ, flag: '🇺🇿', group: G_CIS },
  { code: 'BY', name: RU_REGION.BY, flag: '🇧🇾', group: G_CIS },
  { code: 'AZ', name: RU_REGION.AZ, flag: '🇦🇿', group: G_CIS },
  { code: 'GE', name: RU_REGION.GE, flag: '🇬🇪', group: G_CIS },
  { code: 'AM', name: RU_REGION.AM, flag: '🇦🇲', group: G_CIS },
  { code: 'KG', name: RU_REGION.KG, flag: '🇰🇬', group: G_CIS },
  { code: 'TJ', name: RU_REGION.TJ, flag: '🇹🇯', group: G_CIS },
  { code: 'MD', name: RU_REGION.MD, flag: '🇲🇩', group: G_CIS },
  // Европа
  { code: 'GB', name: RU_REGION.GB, flag: '🇬🇧', group: G_EU },
  { code: 'DE', name: RU_REGION.DE, flag: '🇩🇪', group: G_EU },
  { code: 'FR', name: RU_REGION.FR, flag: '🇫🇷', group: G_EU },
  { code: 'IT', name: RU_REGION.IT, flag: '🇮🇹', group: G_EU },
  { code: 'ES', name: RU_REGION.ES, flag: '🇪🇸', group: G_EU },
  { code: 'PL', name: RU_REGION.PL, flag: '🇵🇱', group: G_EU },
  { code: 'NL', name: RU_REGION.NL, flag: '🇳🇱', group: G_EU },
  // Ближний Восток
  { code: 'TR', name: RU_REGION.TR, flag: '🇹🇷', group: G_ME },
  { code: 'AE', name: RU_REGION.AE, flag: '🇦🇪', group: G_ME },
  { code: 'SA', name: RU_REGION.SA, flag: '🇸🇦', group: G_ME },
  { code: 'EG', name: RU_REGION.EG, flag: '🇪🇬', group: G_ME },
  // Азия
  { code: 'IN', name: RU_REGION.IN, flag: '🇮🇳', group: G_ASIA },
  { code: 'ID', name: RU_REGION.ID, flag: '🇮🇩', group: G_ASIA },
  { code: 'TH', name: RU_REGION.TH, flag: '🇹🇭', group: G_ASIA },
  { code: 'VN', name: RU_REGION.VN, flag: '🇻🇳', group: G_ASIA },
  { code: 'PH', name: RU_REGION.PH, flag: '🇵🇭', group: G_ASIA },
  { code: 'JP', name: RU_REGION.JP, flag: '🇯🇵', group: G_ASIA },
  { code: 'KR', name: RU_REGION.KR, flag: '🇰🇷', group: G_ASIA },
  // Америка
  { code: 'US', name: RU_REGION.US, flag: '🇺🇸', group: G_AM },
  { code: 'CA', name: RU_REGION.CA, flag: '🇨🇦', group: G_AM },
  { code: 'BR', name: RU_REGION.BR, flag: '🇧🇷', group: G_AM },
  { code: 'MX', name: RU_REGION.MX, flag: '🇲🇽', group: G_AM },
  { code: 'AR', name: RU_REGION.AR, flag: '🇦🇷', group: G_AM },
];
// Где регион реально уходит в API (иначе — поиск глобальный, регион игнорируется).
// TikTok: только «Умный поиск» (app) по ключевику. YouTube: и поиск, и «Горячее».
function regionHonored(platform: Source, kind: Kind, mode: string): boolean {
  if (platform === 'youtube') return true;
  if (platform === 'tiktok') return kind === 'keyword' && mode === 'app';
  return false;
}
// Поддерживает ли площадка гео в принципе (для бейджа на плитке площадки).
const PLATFORM_HAS_GEO: Record<Source, boolean> = { tiktok: true, youtube: true, instagram: false, twitter: false };

export interface StoredVideo {
  id: string | null;
  externalId: string;
  platform: string;
  author: string;
  authorName?: string;
  description?: string;
  coverUrl?: string;
  videoUrl?: string;
  webUrl?: string;
  durationSec?: number;
  stats: { play?: number; like?: number; comment?: number; share?: number };
  status: string;
  fileUrl?: string | null;
}

function fmt(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function dur(s?: number): string {
  if (!s || s <= 0) return '';
  const t = Math.round(s); // Instagram отдаёт дробные секунды → округляем (иначе «0:32.972…»)
  const m = Math.floor(t / 60), sec = t % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// serverDown прокидывает компонент (см. errText) — уже переведённым.
function friendlyError(e: any, fallback: string, serverDown: string): string {
  const msg = typeof e?.message === 'string' ? e.message : '';
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed|err_connection/i.test(msg)) {
    return serverDown;
  }
  return msg || fallback;
}

export interface TrendSearchProps {
  token: string | null;
  /** Открыть аналитику по одной ссылке (видео/аккаунт). */
  onAnalyze: (webUrl: string, cover?: string | null) => void;
  /** Открыть аналитику по списку выбранных ссылок (массовый разбор). */
  onAnalyzeBulk?: (items: { url: string; cover?: string }[]) => void;
  /** Слот между карточкой поиска и лентой результатов (напр. переключатель секций). */
  sectionTabs?: React.ReactNode;
}

// «Запросы трендов» из Галереи (?q=слово): маркер обработанного запроса на уровне модуля —
// защита от повторного авто-скана при StrictMode/ремоунте (скан тратит кредиты TikHub).
let autoScanConsumed = '';

export default function TrendSearch({ token, onAnalyze, onAnalyzeBulk, sectionTabs }: TrendSearchProps) {
  const { t } = useTranslation('common');
  // Переведённые справочники: пересобираются каждый рендер — смена языка приходит
  // новым рендером через useTranslation, поэтому модульного кэша не нужно.
  const rn = regionNames(t);
  const rgn = regionGroupNames(t);
  const platformFilters = buildPlatformFilters(t);
  // Дружелюбный текст ошибки сети (см. friendlyError).
  const errText = (e: any, fallback: string) => friendlyError(e, fallback,
    t('sec.trends.serverDown', 'Сервер недоступен (нет связи с API). Проверьте подключение к интернету и обновите страницу; если ошибка повторяется — попробуйте позже.'));
  const [platform, setPlatform] = useState<Source>('tiktok');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<Kind>('keyword');
  const selectPlatform = (id: Source) => {
    setPlatform(id);
    setFilters(defaultFilters(id));
    setQuery(perPlatform[id]?.query ?? '');
    setPage(1); setSelected(new Set()); setNotice(null); setError(null);
    const p = PLATFORMS.find((x) => x.id === id);
    if (p && !p.trending && kind === 'trending') setKind('keyword');
  };
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(20);
  // Строковое зеркало count для поля ввода — чтобы цифра набиралась ПЛАВНО (можно очистить
  // поле, править середину), а клэмп в допустимый диапазон [1..30] происходил на blur, а не
  // на каждый keystroke (иначе пустое поле мгновенно превращалось в 1 и ввод «дёргался»).
  const [countStr, setCountStr] = useState('20');
  const clampCount = (n: number) => Math.min(30, Math.max(1, n));
  const pickCount = (n: number) => { const c = clampCount(n); setCount(c); setCountStr(String(c)); };
  const [mode, setMode] = useState<'video' | 'general' | 'app'>('app');
  const [sortType, setSortType] = useState<0 | 1 | 2>(0);
  const [publishTime, setPublishTime] = useState<0 | 1 | 7 | 30 | 90 | 180>(0);
  const [region, setRegion] = useState(''); // '' = глобально; ISO alpha-2 иначе
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanShape, setScanShape] = useState<any>(null);
  const [perPlatform, setPerPlatform] = useState<Record<string, { query: string; videos: StoredVideo[] }>>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const videos = perPlatform[platform]?.videos ?? [];
  const cardAspect = platform === 'youtube' ? (filters.yt_kind === 'shorts' ? '9 / 16' : '16 / 9') : '9 / 16';
  // Плотные карточки-изображения как в Галерее (текст/иконки поверх картинки, футера нет).
  // Сетка адаптивная (auto-fill/minmax) — размер карточки фиксирован ~150px, а количество в
  // ряду само подстраивается под ШИРИНУ правой колонки (слева широкая панель фильтров → в ряд
  // помещается меньше, как и просил юзер). Хелперы — зеркало Галереи.
  const cardScrimEl = (
    <span aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none z-[5]"
      style={{ height: '70%', background: 'linear-gradient(to top, rgba(0,0,0,0.94), rgba(0,0,0,0.5) 42%, transparent)' }} />
  );
  const OV_BTN = 'w-[26px] h-[26px] rounded-lg flex items-center justify-center flex-shrink-0 transition-transform hover:scale-110';
  const ovBtnStyle = (accent?: string): React.CSSProperties =>
    ({ background: 'rgba(0,0,0,0.55)', color: accent || '#fff', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer', backdropFilter: 'blur(3px)' });
  const setVideos = (updater: StoredVideo[] | ((prev: StoredVideo[]) => StoredVideo[])) =>
    setPerPlatform((s) => {
      const cur = s[platform] || { query: '', videos: [] };
      const next = typeof updater === 'function' ? (updater as (p: StoredVideo[]) => StoredVideo[])(cur.videos) : updater;
      return { ...s, [platform]: { query: cur.query, videos: next } };
    });
  const dedupVideos = (list: StoredVideo[]): StoredVideo[] => {
    const seen = new Set<string>(); const out: StoredVideo[] = [];
    for (const v of list) { const k = v.externalId || v.id || ''; if (!k || seen.has(k)) continue; seen.add(k); out.push(v); }
    return out;
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Подтверждение удаления — внутренняя модалка (вместо браузерного confirm).
  const [confirm, setConfirm] = useState<{ title: string; message?: string; onConfirm: () => void } | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // ── Автоанализ (конвейер тренд → анализ → UGC): watches тенанта. null = недоступен
  // (не Enterprise / 403) — панель не показываем вовсе. Enterprise-only: расходы
  // цепочки идут с ключей клиента.
  interface WatchRow { id: string; keyword: string; platform: string; intervalMinutes: number; enabled: boolean; dailyCap: number; nextRunAt?: string | null; lastError?: string | null }
  const [watches, setWatches] = useState<WatchRow[] | null>(null);
  const [watchInterval, setWatchInterval] = useState(1440);
  const [watchBusy, setWatchBusy] = useState(false);
  const [watchErr, setWatchErr] = useState<string | null>(null);
  const [watchRunsFor, setWatchRunsFor] = useState<string | null>(null);
  const [watchRuns, setWatchRuns] = useState<any[] | null>(null);
  const loadWatches = async () => {
    try {
      const r = await fetch('/api/trends/watches', { headers: headers() });
      if (r.status === 403) { setWatches(null); return; }
      const d = await r.json().catch(() => ({}));
      if (r.ok) setWatches(Array.isArray(d?.watches) ? d.watches : []);
    } catch { /* тихо */ }
  };
  useEffect(() => { void loadWatches(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const createWatch = async () => {
    if (!query.trim() || watchBusy) return;
    setWatchBusy(true); setWatchErr(null);
    try {
      const r = await fetch('/api/trends/watches', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          keyword: query.trim(), platform, intervalMinutes: watchInterval,
          scanParams: { mode, sortType, publishTime, filters },
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || t('sec.trends.errHttp', 'Ошибка {{status}}', { status: r.status }));
      await loadWatches();
    } catch (e: any) { setWatchErr(e?.message || t('sec.trends.watchCreateFailed', 'Не удалось включить автоанализ.')); }
    finally { setWatchBusy(false); }
  };
  const patchWatch = async (id: string, patch: Record<string, any>) => {
    try {
      const r = await fetch(`/api/trends/watches/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(patch) });
      if (r.ok) await loadWatches();
    } catch { /* тихо */ }
  };
  const deleteWatch = async (id: string) => {
    try {
      await fetch(`/api/trends/watches/${id}`, { method: 'DELETE', headers: headers() });
      if (watchRunsFor === id) { setWatchRunsFor(null); setWatchRuns(null); }
      await loadWatches();
    } catch { /* тихо */ }
  };
  const runWatchNow = async (id: string) => {
    setWatchErr(null);
    try {
      const r = await fetch(`/api/trends/watches/${id}/run`, { method: 'POST', headers: headers() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || t('sec.trends.errHttp', 'Ошибка {{status}}', { status: r.status }));
      if (watchRunsFor === id) await toggleWatchRuns(id, true);
      await loadWatches();
    } catch (e: any) { setWatchErr(e?.message || t('sec.trends.watchRunFailed', 'Не удалось запустить.')); }
  };
  const toggleWatchRuns = async (id: string, force = false) => {
    if (watchRunsFor === id && !force) { setWatchRunsFor(null); setWatchRuns(null); return; }
    setWatchRunsFor(id); setWatchRuns(null);
    try {
      const r = await fetch(`/api/trends/watches/${id}/runs?limit=6`, { headers: headers() });
      const d = await r.json().catch(() => ({}));
      setWatchRuns(r.ok && Array.isArray(d?.runs) ? d.runs : []);
    } catch { setWatchRuns([]); }
  };

  // Загрузка/обновление списка с сервера (источник истины). После удаления и при
  // фоновом скачивании UI приводим в соответствие с БД — без оптимистичных фантомов.
  const loadVideos = async () => {
    try {
      const res = await fetch('/api/trends/videos?limit=200', { headers: headers() });
      if (!res.ok) return;
      const d = await res.json();
      const buckets: Record<string, { query: string; videos: StoredVideo[] }> = {};
      for (const v of (d.videos || []) as StoredVideo[]) {
        const p = v.platform || 'tiktok';
        (buckets[p] = buckets[p] || { query: '', videos: [] }).videos.push(v);
      }
      setPerPlatform(buckets);
    } catch { /* тихо */ }
  };

  useEffect(() => { loadVideos(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // «Запросы трендов» из Галереи: /social-extension?q=слово[&platform=…] — префилл + авто-скан,
  // чтобы окно трендов с этим словом открывалось сразу готовым (без повторного набора).
  // Сам скан уходит через pendingScan на СЛЕДУЮЩЕМ рендере — когда platform/kind уже применились.
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingScan, setPendingScan] = useState<string | null>(null);
  useEffect(() => {
    const q = (searchParams.get('q') || '').trim();
    if (!q) return;
    const key = searchParams.toString();
    if (autoScanConsumed === key) return;
    autoScanConsumed = key;
    const p = searchParams.get('platform');
    if (p && PLATFORMS.some((x) => x.id === p)) selectPlatform(p as Source);
    setKind('keyword');
    setQuery(q);
    setSearchParams({}, { replace: true }); // F5 не должен пересканировать
    setPendingScan(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  useEffect(() => {
    if (!pendingScan) return;
    const q = pendingScan;
    setPendingScan(null);
    void handleScan(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScan]);

  // Фоновое скачивание идёт на сервере → опрашиваем статусы, пока что-то качается.
  const anyDownloading = Object.values(perPlatform).some((b) => b.videos.some((v) => v.status === 'downloading'));
  useEffect(() => {
    if (!anyDownloading) return;
    const t = setInterval(() => { loadVideos(); }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyDownloading]);

  // qOverride — готовый запрос из «Запросов трендов» Галереи (setQuery асинхронен, поэтому
  // авто-скан передаёт слово напрямую). unknown: onClick подсовывает MouseEvent — игнорируем.
  const handleScan = async (qOverride?: unknown) => {
    const q = typeof qOverride === 'string' ? qOverride.trim() : query.trim();
    if (kind === 'keyword' && !q) { setError(t('sec.trends.needKeyword', 'Введите ключевое слово')); return; }
    setScanning(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/trends/scan', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ kind, query: q, count, mode, sortType, publishTime, platform, filters, region }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const found: StoredVideo[] = data.videos || [];
      setPerPlatform((s) => {
        const cur = s[platform] || { query: '', videos: [] };
        return { ...s, [platform]: { query: q, videos: dedupVideos([...found, ...cur.videos]) } };
      });
      setPage(1);
      const fb = data.fellBackToApp ? ' ' + t('sec.trends.scanFellBack', 'Режим «Поиск по слову/Около-тематика» был нестабилен — поиск автоматически выполнен «Умным поиском».') : '';
      if ((data.count ?? 0) === 0) {
        setNotice(t('sec.trends.scanNoVideos', 'Сервис ответил, но видео не распознаны. Ключи ответа: [{{keys}}].', { keys: (data.rawKeys || []).join(', ') }) + fb);
        setScanShape(data.shape || null);
      } else {
        setNotice(t('sec.trends.scanFound', 'Найдено видео: {{n}}.', { n: data.count }) + fb);
        setScanShape(null);
      }
    } catch (e: any) { setError(errText(e, t('sec.trends.scanFailed', 'Ошибка сканирования'))); }
    finally { setScanning(false); }
  };

  // Скачивание идёт ФОНОВО на сервере (можно уйти со страницы) и попадает в Галерею.
  // Статус обновляет поллинг loadVideos. Здесь — только запуск + мгновенный отклик.
  const handleDownload = async (v: StoredVideo) => {
    if (!v.id) { setError(t('sec.trends.dlNotSavedErr', 'Видео не сохранено на сервере — повторите скан.')); return; }
    setError(null);
    setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'downloading' } : x));
    try {
      const res = await fetch(`/api/trends/videos/${v.id}/download`, { method: 'POST', headers: headers() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'failed' } : x));
      setError(errText(e, t('sec.trends.dlFailed', 'Не удалось скачать')));
    }
  };

  const cancelDownload = async (v: StoredVideo) => {
    if (!v.id) return;
    setVideos((prev) => prev.map((x) => x.id === v.id ? { ...x, status: 'discovered' } : x));
    try { await fetch(`/api/trends/videos/${v.id}/download/cancel`, { method: 'POST', headers: headers() }); } catch { /* тихо */ }
  };

  // Ключ выбора: БД-id, а если видео ещё не сохранено в БД (напр. Instagram) —
  // externalId. Так чекбокс работает на КАЖДОЙ карточке (выбор → массовая аналитика);
  // скачивание/удаление по-прежнему требуют БД-id (фильтруются ниже).
  const keyOf = (v: StoredVideo): string => v.id || v.externalId || '';
  const toggleSelect = (id: string | null) => {
    if (!id) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectableIds = videos.map(keyOf).filter(Boolean);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(selectableIds));

  const downloadSelected = async () => {
    const targets = videos.filter((v) => v.id && selected.has(keyOf(v)) && !v.fileUrl);
    if (targets.length === 0) return;
    setBulkDownloading(true);
    for (const v of targets) {
      // eslint-disable-next-line no-await-in-loop
      await handleDownload(v);
    }
    setBulkDownloading(false);
  };

  const doDeleteBulk = async (ids: string[]) => {
    setBulkDeleting(true); setError(null);
    try {
      const res = await fetch('/api/trends/videos/delete-bulk', { method: 'POST', headers: headers(), body: JSON.stringify({ ids }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      setSelected(new Set());
      await loadVideos(); // источник истины — БД (без оптимистичного удаления из UI)
      if ((d.deleted ?? 0) < ids.length) setNotice(t('sec.trends.deletedPartial', 'Удалено: {{done}} из {{total}}.', { done: d.deleted ?? 0, total: ids.length }));
    } catch (e: any) { setError(errText(e, t('sec.trends.deleteFailed', 'Не удалось удалить'))); }
    finally { setBulkDeleting(false); }
  };
  const deleteSelected = () => {
    const ids = videos.filter((v) => v.id && selected.has(keyOf(v))).map((v) => v.id as string);
    if (ids.length === 0) return;
    setConfirm({ title: t('sec.trends.deleteVideoQ', 'Удалить видео?'), message: t('sec.trends.deleteBulkMsg', 'Удалить выбранные видео из списка ({{n}})? Действие необратимо.', { n: ids.length }), onConfirm: () => { setConfirm(null); doDeleteBulk(ids); } });
  };
  const deleteOne = (v: StoredVideo) => {
    if (!v.id) return;
    setConfirm({ title: t('sec.trends.deleteVideoQ', 'Удалить видео?'), message: t('sec.trends.deleteOneMsg', 'Удалить это видео из списка?'), onConfirm: () => {
      setConfirm(null); setError(null);
      (async () => {
        try {
          const res = await fetch(`/api/trends/videos/${v.id}`, { method: 'DELETE', headers: headers() });
          if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${res.status}`); }
          await loadVideos();
        } catch (e: any) { setError(errText(e, t('sec.trends.deleteFailed', 'Не удалось удалить'))); }
      })();
    } });
  };

  const analyzeSelected = () => {
    // Аналитике нужен только webUrl — работает и для несохранённых (Instagram без БД-id).
    const items = videos.filter((v) => selected.has(keyOf(v)) && v.webUrl).map((v) => ({ url: v.webUrl as string, cover: v.coverUrl }));
    if (items.length === 0 || !onAnalyzeBulk) return;
    onAnalyzeBulk(items);
  };

  const selectedCount = videos.filter((v) => v.id && selected.has(keyOf(v)) && !v.fileUrl).length;

  return (
    <>
      {/* Раздел «Тренды» в стиле UGC-редактора: слева колонка (навигация разделов +
          блоки управления), справа поле результатов-карточек. На мобильном — стопкой. */}
      <div className="grid gap-4 items-start lg:grid-cols-[minmax(300px,360px)_1fr]">
        {/* ── ЛЕВАЯ КОЛОНКА: навигация + блоки управления ── */}
        <div className="space-y-3 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto lg:pr-1">

      {/* Навигация разделов (Поиск/Аналитика/Каналы) — вверху левой колонки */}
      {sectionTabs}

      {/* Блок «Источник» */}
      <AuroraCard className="p-4 space-y-3">
        <div className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.trends.sourceTitle', 'Источник')}</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {PLATFORMS.map((p) => {
            const on = platform === p.id;
            return (
              <button key={p.id} onClick={() => selectPlatform(p.id)} title={p.name}
                className="inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full transition-all duration-150"
                style={{
                  background: on ? 'rgba(99,102,241,0.10)' : 'var(--bg-tertiary)',
                  border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border-subtle)'}`,
                  boxShadow: on ? '0 1px 6px rgba(99,102,241,0.18)' : 'none',
                }}>
                <span className="w-[26px] h-[26px] rounded-[9px] flex items-center justify-center flex-shrink-0"
                      style={{ background: p.tint, color: p.color }}>{p.icon}</span>
                <span className="text-[12px] font-600" style={{ color: on ? 'var(--brand)' : 'var(--text-secondary)' }}>{p.name}</span>
                {/* Гео-бейдж: площадка поддерживает регион (у TikTok — только «Умный поиск»). */}
                {region && PLATFORM_HAS_GEO[p.id] && (
                  <span title={t('sec.trends.geoBadgeTitle', 'Площадка поддерживает регион выдачи (TikTok — только в «Умном поиске»)')} className="inline-flex flex-shrink-0">
                    <Globe size={11} style={{ color: on ? 'var(--brand)' : 'var(--text-muted)' }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </AuroraCard>

      {/* Блок «Поиск» */}
      <AuroraCard className="p-4 space-y-3">
        <div className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.trends.searchTitle', 'Поиск')}</div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl"
             style={{ background: 'var(--bg-tertiary)' }}>
          {(['keyword', 'trending'] as Kind[]).map((k) => {
            const disabled = k === 'trending' && !(PLATFORMS.find((p) => p.id === platform)?.trending);
            return (
            <button key={k} onClick={() => !disabled && setKind(k)} disabled={disabled}
              title={disabled ? t('sec.trends.noTrendingTitle', 'У этой площадки нет ленты «Горячее»') : undefined}
              className="px-4 py-2 rounded-lg text-sm font-600 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: kind === k ? 'var(--bg-secondary)' : 'transparent',
                color: kind === k ? 'var(--brand)' : 'var(--text-muted)',
                boxShadow: kind === k ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}>
              {k === 'keyword' ? t('sec.trends.kindKeyword', '🔍 По ключевику') : t('sec.trends.kindTrending', '🔥 Горячее')}
            </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5">
          {kind === 'keyword' && (
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
                placeholder={t('sec.trends.searchPh', 'например: morning routine, рецепт, gym…')}
                className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 transition-shadow"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
              />
            </div>
          )}
          <AuroraButton onClick={handleScan} disabled={scanning} fullWidth
            icon={scanning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {scanning ? t('sec.trends.scanningBtn', 'Сканирую…') : t('sec.trends.scanBtn', 'Сканировать')}
          </AuroraButton>
        </div>

        <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
          {/* Регион выдачи — гео-таргет исследования. Активный регион подсвечивается брендом. */}
          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span className="inline-flex items-center gap-1"><Globe size={12} /> {t('sec.trends.regionLbl', 'Регион выдачи')}</span>
            <div className="relative">
              <select value={region} onChange={(e) => setRegion(e.target.value)}
                aria-label={t('sec.trends.regionAria', 'Регион выдачи трендов')}
                className="h-10 pl-3 pr-8 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 transition-colors"
                style={{
                  minWidth: 186,
                  background: region ? 'rgba(99,102,241,0.10)' : 'var(--bg-tertiary)',
                  border: `1px solid ${region ? 'var(--brand)' : 'var(--border-medium)'}`,
                  color: 'var(--text-primary)',
                }}>
                <option value="">🌐 {rn['']}</option>
                {REGION_GROUPS.map((g) => (
                  <optgroup key={g} label={rgn[g]}>
                    {REGIONS.filter((r) => r.group === g).map((r) => (
                      <option key={r.code} value={r.code}>{r.flag} {rn[r.code] ?? r.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px]"
                    style={{ color: 'var(--text-muted)' }}>▾</span>
            </div>
          </label>

          <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('sec.trends.countLbl', 'Сколько видео')}
            <div className="flex items-center gap-1.5">
              {[10, 20, 30].map((n) => (
                <button key={n} type="button" onClick={() => pickCount(n)}
                  className="w-10 h-10 rounded-lg text-sm font-700 transition-colors"
                  style={{
                    background: count === n ? 'var(--brand)' : 'var(--bg-tertiary)',
                    color: count === n ? 'var(--brand-contrast)' : 'var(--text-muted)',
                    border: `1px solid ${count === n ? 'var(--brand)' : 'var(--border-medium)'}`,
                  }}>
                  {n}
                </button>
              ))}
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                value={countStr}
                onChange={(e) => {
                  // Только цифры, максимум 2 знака (потолок 30). Пустое поле разрешаем — не
                  // навязываем 1; count обновляем лишь на валидном числе, финальный клэмп — на blur.
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setCountStr(raw);
                  const n = parseInt(raw, 10);
                  if (Number.isFinite(n) && n >= 1) setCount(clampCount(n));
                }}
                onBlur={() => pickCount(parseInt(countStr, 10) || 20)}
                onFocus={(e) => e.currentTarget.select()}
                title={t('sec.trends.countCustomTitle', 'Своё количество (1–30)')}
                aria-label={t('sec.trends.countCustomAria', 'Своё количество видео (1–30)')}
                className="w-14 h-10 px-2 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
            </div>
          </label>

          {kind === 'keyword' && platform === 'tiktok' && (
            <label className="flex flex-col gap-1 text-[11px] flex-1 min-w-[150px]" style={{ color: 'var(--text-muted)' }}>
              {t('sec.trends.modeLbl', 'Тип поиска')}
              <select value={mode} onChange={(e) => setMode(e.target.value as any)}
                className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                <option value="app">{t('sec.trends.modeSmart', 'Умный поиск')}</option>
                <option value="video">{t('sec.trends.modeWord', 'Поиск по слову')}</option>
                <option value="general">{t('sec.trends.modeGeneral', 'Около-тематика')}</option>
              </select>
            </label>
          )}
          {kind === 'keyword' && platform === 'tiktok' && mode === 'app' && (
            <>
              <label className="flex flex-col gap-1 text-[11px] flex-1 min-w-[140px]" style={{ color: 'var(--text-muted)' }}>
                {t('sec.trends.sortLbl', 'Сортировка')}
                <select value={sortType} onChange={(e) => setSortType(Number(e.target.value) as any)}
                  className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                  <option value={0}>{t('sec.trends.sortRelevance', 'По релевантности')}</option>
                  <option value={1}>{t('sec.trends.sortLikes', 'Больше лайков')}</option>
                  <option value={2}>{t('sec.trends.sortNewest', 'Новее')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] flex-1 min-w-[130px]" style={{ color: 'var(--text-muted)' }}>
                {t('sec.trends.periodLbl', 'Период')}
                <select value={publishTime} onChange={(e) => setPublishTime(Number(e.target.value) as any)}
                  className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                  <option value={0}>{t('sec.trends.periodAll', 'Всё время')}</option>
                  <option value={1}>{t('sec.trends.period24h', '24 часа')}</option>
                  <option value={7}>{t('sec.trends.periodWeek', 'Неделя')}</option>
                  <option value={30}>{t('sec.trends.periodMonth', 'Месяц')}</option>
                  <option value={90}>{t('sec.trends.period3m', '3 месяца')}</option>
                  <option value={180}>{t('sec.trends.period6m', '6 месяцев')}</option>
                </select>
              </label>
            </>
          )}

          {kind === 'keyword' && platform !== 'tiktok' && (platformFilters[platform] || []).map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-[11px] flex-1 min-w-[140px]" style={{ color: 'var(--text-muted)' }}>
              {f.label}
              {f.options.length <= 2 ? (
                /* Мало вариантов (YouTube «Формат» Видео/Shorts) — сегмент-кнопки вместо выпадашки. */
                <div className="flex items-center gap-1.5">
                  {f.options.map((o) => {
                    const on = (filters[f.key] ?? f.def) === o.v;
                    return (
                      <button key={o.v} type="button" onClick={() => setFilters((s) => ({ ...s, [f.key]: o.v }))}
                        className="flex-1 h-10 px-3 rounded-lg text-sm font-600 transition-colors whitespace-nowrap"
                        style={{ background: on ? 'var(--brand)' : 'var(--bg-tertiary)', color: on ? 'var(--brand-contrast)' : 'var(--text-muted)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-medium)'}` }}>
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <select value={filters[f.key] ?? f.def} onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                  {f.options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              )}
            </label>
          ))}
          {kind === 'keyword' && platform === 'instagram' && (
            <p className="text-[11px] flex items-end pb-2.5" style={{ color: 'var(--text-muted)' }}>{t('sec.trends.igNoFilters', 'Instagram: фильтров нет — только поиск по ключевику.')}</p>
          )}
        </div>

        {/* Пояснение по региону: где он реально применяется, а где выдача глобальна. */}
        {region && (regionHonored(platform, kind, mode) ? (
          <div className="flex items-start gap-2 text-[12px] rounded-xl px-3 py-2"
               style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }}>
            <Globe size={14} className="mt-[2px] flex-shrink-0" style={{ color: 'var(--brand)' }} />
            <span>
              {t('sec.trends.geoHonoredPrefix', 'Тренды ищутся с приоритетом региона')}{' '}
              <b style={{ color: 'var(--text-primary)' }}>{REGIONS.find((r) => r.code === region)?.flag} {rn[region] ?? REGIONS.find((r) => r.code === region)?.name}</b>
              {' '}{t('sec.trends.geoHonoredSuffix', '— алгоритму подсказывается, контент какого региона показывать в выдаче.')}
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-[12px] rounded-xl px-3 py-2"
               style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            <AlertCircle size={14} className="mt-[2px] flex-shrink-0" />
            <span>
              {t('sec.trends.geoNotHonored', 'Для этого режима регион не поддерживается — поиск будет глобальным. Гео работает в')}{' '}
              <b style={{ color: 'var(--text-secondary)' }}>TikTok → {t('sec.trends.modeSmart', 'Умный поиск')}</b> {t('sec.trends.geoAndIn', 'и в')}{' '}
              <b style={{ color: 'var(--text-secondary)' }}>YouTube</b>.
            </span>
          </div>
        ))}

        {/* ── АВТОАНАЛИЗ (конвейер тренд → анализ → UGC), Enterprise-only ─────────────
            По расписанию сканирует этот ключевик и анализирует ОДНО новое видео
            (уже разобранные пропускаются; нет новых — период расширяется сам).
            Панель видна только если /api/trends/watches отвечает (не 403). ── */}
        {watches !== null && kind === 'keyword' && ['tiktok', 'instagram', 'twitter'].includes(platform) && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${watches.length ? 'var(--brand)' : 'var(--border-medium)'}` }}>
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[12px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <RefreshCw size={13} style={{ color: 'var(--brand)' }} /> {t('sec.trends.autoTitle', 'Автоанализ')}
              </b>
              <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                {t('sec.trends.autoSubtitle', 'по расписанию: скан → одно НОВОЕ видео → анализ в Галерею (+ролик по шаблону UGC)')}
              </span>
              <span className="flex items-center gap-1.5 ml-auto">
                <select value={watchInterval} onChange={(e) => setWatchInterval(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg text-[12px] focus:outline-none"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                  <option value={60}>{t('sec.trends.intEveryHour', 'каждый час')}</option>
                  <option value={180}>{t('sec.trends.intEvery3h', 'каждые 3 часа')}</option>
                  <option value={360}>{t('sec.trends.intEvery6h', 'каждые 6 часов')}</option>
                  <option value={720}>{t('sec.trends.intEvery12h', 'каждые 12 часов')}</option>
                  <option value={1440}>{t('sec.trends.intDaily', 'раз в сутки')}</option>
                  <option value={4320}>{t('sec.trends.intEvery3d', 'раз в 3 дня')}</option>
                  <option value={10080}>{t('sec.trends.intWeekly', 'раз в неделю')}</option>
                </select>
                <button type="button" onClick={() => void createWatch()} disabled={watchBusy || !query.trim()}
                  title={query.trim() ? t('sec.trends.autoEnableTitle', 'Включить автоанализ этого ключевика') : t('sec.trends.autoNeedKeyword', 'Сначала введите ключевик')}
                  className="h-8 px-3 rounded-lg text-[12px] font-700 disabled:opacity-50"
                  style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                  {watchBusy ? '…' : t('sec.trends.autoEnableBtn', '+ Включить')}
                </button>
              </span>
            </div>
            {watchErr && <p className="text-[11px]" style={{ color: '#ef4444' }}>{watchErr}</p>}
            {watches.length > 0 && (
              <div className="space-y-1.5">
                {watches.map((w) => (
                  <div key={w.id} className="rounded-lg p-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void patchWatch(w.id, { enabled: !w.enabled })}
                        title={w.enabled ? t('sec.trends.pauseTitle', 'Пауза') : t('sec.trends.enableTitle', 'Включить')}
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: w.enabled ? 'rgba(16,185,129,.14)' : 'var(--bg-tertiary)', color: w.enabled ? '#10b981' : 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                        {w.enabled ? '⏸' : '▶'}
                      </button>
                      <span className="flex-1 min-w-0">
                        <b className="text-[12px]" style={{ color: 'var(--text-primary)' }}>#{w.keyword}</b>
                        <span className="text-[10.5px] ml-1.5" style={{ color: 'var(--text-muted)' }}>
                          {w.platform} · {w.intervalMinutes >= 1440
                            ? t('sec.trends.watchEveryDays', 'кажд. {{n}} дн.', { n: Math.round(w.intervalMinutes / 1440) })
                            : t('sec.trends.watchEveryHours', 'кажд. {{n}} ч', { n: Math.round(w.intervalMinutes / 60) })}
                          {' · '}{t('sec.trends.watchDailyCap', 'до {{n}}/день', { n: w.dailyCap })}
                          {w.enabled && w.nextRunAt ? ' · ' + t('sec.trends.watchNextAt', 'следующий ~{{time}}', { time: new Date(w.nextRunAt).toLocaleTimeString().slice(0, 5) }) : !w.enabled ? ' · ' + t('sec.trends.watchPaused', 'ПАУЗА') : ''}
                        </span>
                        {w.lastError && <span className="block text-[10px]" style={{ color: '#ef4444' }}>{w.lastError}</span>}
                      </span>
                      <button type="button" onClick={() => void runWatchNow(w.id)} title={t('sec.trends.runNowTitle', 'Прогнать сейчас')}
                        className="h-7 px-2 rounded-lg text-[11px] font-600 flex-shrink-0"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                        {t('sec.trends.runNowBtn', 'Сейчас')}
                      </button>
                      <button type="button" onClick={() => void toggleWatchRuns(w.id)} title={t('sec.trends.runsTitle', 'Журнал прогонов')}
                        className="h-7 px-2 rounded-lg text-[11px] flex-shrink-0"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                        {watchRunsFor === w.id ? '▾' : '▸'} {t('sec.trends.runsBtn', 'журнал')}
                      </button>
                      <button type="button" onClick={() => setConfirm({ title: t('sec.trends.watchDeleteQ', 'Убрать автоанализ «{{kw}}»?', { kw: w.keyword }), message: t('sec.trends.watchDeleteMsg', 'Журнал его прогонов тоже удалится.'), onConfirm: () => { setConfirm(null); void deleteWatch(w.id); } })}
                        title={t('sec.trends.deleteBtn', 'Удалить')} className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                        <XCircle size={14} />
                      </button>
                    </div>
                    {watchRunsFor === w.id && (
                      <div className="mt-1.5 space-y-1">
                        {watchRuns === null ? (
                          <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{t('sec.trends.loading', 'Загружаю…')}</p>
                        ) : watchRuns.length === 0 ? (
                          <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{t('sec.trends.runsEmpty', 'Прогонов ещё не было.')}</p>
                        ) : watchRuns.map((r) => (
                          <p key={r.id} className="text-[10.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                            {new Date(r.startedAt).toLocaleString().slice(0, 17)} ·{' '}
                            <b style={{ color: r.status === 'done' ? '#10b981' : r.status === 'failed' ? '#ef4444' : 'var(--text-secondary)' }}>
                              {r.status === 'done' ? t('sec.trends.runDone', 'готово') : r.status === 'failed' ? t('sec.trends.runFailed', 'ошибка') : r.status}
                            </b>
                            {r.pickedUrl ? <> · <a href={r.pickedUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>{t('sec.trends.runVideoLink', 'видео')}</a></> : null}
                            {Array.isArray(r.resultUrls) && r.resultUrls.length ? ' · ' + t('sec.trends.runClips', 'роликов: {{n}}', { n: r.resultUrls.length }) : ''}
                            {r.error ? ` · ${r.error}` : r.note ? ` · ${r.note}` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {kind === 'keyword' && platform === 'tiktok' && (
          <details className="group/help text-[12px]">
            <summary className="inline-flex items-center gap-1.5 cursor-pointer select-none font-600 list-none"
                     style={{ color: 'var(--text-muted)' }}>
              <AlertCircle size={13} /> {t('sec.trends.modesHelpTitle', 'Чем отличаются типы поиска?')}
            </summary>
            <p className="mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              <b style={{ color: 'var(--text-secondary)' }}>{t('sec.trends.modeSmart', 'Умный поиск')}</b>{' '}
              {t('sec.trends.modesHelpSmart', '— по теме, устойчив к опечаткам («wordpres» → WordPress), с фильтрами «Период»/«Сортировка» и прямыми ссылками для скачивания')}
              <i> {t('sec.trends.modesHelpRecommended', '(рекомендуется)')}</i>. <b style={{ color: 'var(--text-secondary)' }}>{t('sec.trends.modeWord', 'Поиск по слову')}</b> {t('sec.trends.andWord', 'и')}{' '}
              <b style={{ color: 'var(--text-secondary)' }}>{t('sec.trends.modeGeneral', 'Около-тематика')}</b>{' '}
              {t('sec.trends.modesHelpWeb', '— Web-выдача без фильтров, шире охват, но иногда нестабильна.')}
            </p>
          </details>
        )}

        {notice && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={16} className="mt-[2px] flex-shrink-0" style={{ color: '#10b981' }} /><span>{notice}</span>
          </div>
        )}
        {scanShape && (
          <details className="text-[11px]">
            <summary className="inline-flex items-center gap-1.5 cursor-pointer select-none font-600" style={{ color: 'var(--text-muted)' }}>
              {t('sec.trends.shapeSummary', '🔧 Структура ответа (пришлите в поддержку — настроим разбор)')}
            </summary>
            <pre className="mt-2 p-3 rounded-lg overflow-auto" style={{ maxHeight: 360, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {JSON.stringify(scanShape, null, 1)}
            </pre>
          </details>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <XCircle size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
          </div>
        )}
      </AuroraCard>
        </div>

        {/* ── ПРАВАЯ КОЛОНКА: карточки результатов ── */}
        <div className="min-w-0 space-y-3">
      {/* Results */}
      {videos.length === 0 ? (
        <AuroraCard className="p-10 sm:p-14 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
               style={{ background: 'var(--bg-tertiary)' }}>
            <TrendingUp size={26} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-sm font-600" style={{ color: 'var(--text-secondary)' }}>{t('sec.trends.emptyTitle', 'Пока пусто')}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('sec.trends.emptyHint', 'Введите ключевик (или выберите «Горячее») и нажмите «Сканировать».')}
          </p>
        </AuroraCard>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                {t('sec.trends.listCount', 'В списке: {{n}}', { n: videos.length })}
              </span>
              <button type="button" onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {allSelected ? <CheckSquare size={15} color="var(--brand)" /> : <Square size={15} />}
                {allSelected ? t('sec.trends.deselectAll', 'Снять выделение') : t('sec.trends.selectAll', 'Выбрать всё')}{selected.size > 0 ? ` · ${selected.size}` : ''}
              </button>
              <button type="button" onClick={deleteSelected} disabled={selected.size === 0 || bulkDeleting}
                title={t('sec.trends.deleteSelTitle', 'Удалить выбранные из списка')}
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                {bulkDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {t('sec.trends.deleteBtn', 'Удалить')}{selected.size > 0 ? ` · ${selected.size}` : ''}
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {onAnalyzeBulk && (
                <AuroraButton variant="secondary" onClick={analyzeSelected} disabled={selected.size === 0}
                  icon={<BarChart3 size={16} />}>
                  {t('sec.trends.analyzeSelBtn', 'Анализировать выбранные') + (selected.size > 0 ? ` (${selected.size})` : '')}
                </AuroraButton>
              )}
              <AuroraButton onClick={downloadSelected} disabled={bulkDownloading || selectedCount === 0}
                icon={bulkDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}>
                {bulkDownloading ? t('sec.trends.downloadingBtn', 'Скачиваю…') : t('sec.trends.downloadSelBtn', 'Скачать выбранные') + (selectedCount > 0 ? ` (${selectedCount})` : '')}
              </AuroraButton>
            </div>
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {videos.slice(0, page * PAGE_SIZE).map((v) => {
            const isSel = !!(keyOf(v) && selected.has(keyOf(v)));
            return (
            <div key={v.id || v.externalId}
              className={`group relative rounded-xl overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg${isSel ? ' ring-2 ring-[var(--brand)] ring-inset' : ''}`}
              style={{ aspectRatio: cardAspect, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
              {/* Обложка на весь размер карточки */}
              {v.coverUrl ? (
                <img src={coverSrc(v.coverUrl)} alt="" referrerPolicy="no-referrer" loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center"><Play size={26} style={{ color: 'var(--text-muted)' }} /></div>
              )}
              {/* Ховер: открыть оригинал */}
              {v.webUrl && (
                <a href={v.webUrl} target="_blank" rel="noreferrer"
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-[6]"
                  style={{ background: 'rgba(0,0,0,0.28)' }} title={t('sec.trends.openOriginal', 'Открыть оригинал')}>
                  <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(4px)' }}>
                    <Play size={20} color="#fff" fill="#fff" />
                  </span>
                </a>
              )}
              {/* Чекбокс выбора */}
              {keyOf(v) && (
                <button type="button" onClick={() => toggleSelect(keyOf(v))} title={t('sec.trends.selectTitle', 'Выбрать')}
                  className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center z-20"
                  style={{ background: isSel ? 'var(--brand)' : 'rgba(0,0,0,0.5)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.75)', cursor: 'pointer', backdropFilter: 'blur(3px)' }}>
                  {isSel ? <Check size={14} /> : null}
                </button>
              )}
              {/* Бейдж «скачано» */}
              {v.status === 'downloaded' && (
                <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-md font-700 inline-flex items-center gap-1 z-20"
                  style={{ background: 'rgba(16,185,129,0.92)', color: '#fff' }}><CheckCircle2 size={10} /> {t('sec.trends.badgeDownloaded', 'скачано')}</span>
              )}
              {cardScrimEl}
              {/* Наложенные счётчики + автор + все иконки-действия */}
              <div className="absolute inset-x-0 bottom-0 p-1.5 z-10 flex flex-col gap-1 pointer-events-none">
                <div className="flex items-center gap-1.5 text-[10px] font-700 text-white flex-wrap" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}>
                  <span className="inline-flex items-center gap-0.5"><Eye size={11} /> {fmt(v.stats.play)}</span>
                  {v.stats.like != null && <span className="inline-flex items-center gap-0.5"><Heart size={10} /> {fmt(v.stats.like)}</span>}
                  {v.stats.comment != null && <span className="inline-flex items-center gap-0.5"><MessageCircle size={10} /> {fmt(v.stats.comment)}</span>}
                  {dur(v.durationSec) && <span className="ml-auto px-1 rounded" style={{ background: 'rgba(0,0,0,0.5)' }}>{dur(v.durationSec)}</span>}
                </div>
                <div className="text-[11px] font-700 leading-tight truncate text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }} title={v.authorName || v.author}>@{v.author}</div>
                <div className="flex items-center gap-1 pointer-events-auto">
                  {v.webUrl && (
                    <button type="button" onClick={() => onAnalyze(v.webUrl!, v.coverUrl)} title={t('sec.trends.analyzeTitle', 'Открыть в Аналитике')} className={OV_BTN} style={ovBtnStyle('#a5b4fc')}>
                      <BarChart3 size={13} />
                    </button>
                  )}
                  {v.webUrl && (
                    <a href={v.webUrl} target="_blank" rel="noreferrer" title={t('sec.trends.openOriginal', 'Открыть оригинал')} className={OV_BTN} style={ovBtnStyle()}>
                      <ExternalLink size={13} />
                    </a>
                  )}
                  {v.id && (
                    <button type="button" onClick={() => deleteOne(v)} title={t('sec.trends.deleteOneTitle', 'Удалить это видео из списка')} className={OV_BTN} style={ovBtnStyle('#fca5a5')}>
                      <Trash2 size={13} />
                    </button>
                  )}
                  {v.fileUrl ? (
                    <a href={v.fileUrl} target="_blank" rel="noreferrer" title={t('sec.trends.downloadedOpenFile', 'Скачано — открыть файл')} className={`${OV_BTN} ml-auto`} style={ovBtnStyle('#6ee7b7')}>
                      <CheckCircle2 size={14} />
                    </a>
                  ) : v.status === 'downloading' ? (
                    <button type="button" onClick={() => cancelDownload(v)} title={t('sec.trends.downloadingCancelTitle', 'Скачивается в фоне — нажмите, чтобы отменить')} className={`${OV_BTN} ml-auto group/dl`} style={ovBtnStyle('#fca5a5')}>
                      <Loader2 size={13} className="animate-spin group-hover/dl:hidden" />
                      <X size={14} className="hidden group-hover/dl:block" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleDownload(v)} disabled={!v.id}
                      title={!v.id ? t('sec.trends.dlNotSavedTitle', 'Видео не сохранено на сервере') : v.status === 'failed' ? t('sec.trends.dlRetryTitle', 'Ошибка скачивания — нажмите, чтобы повторить') : t('sec.trends.dlTitle', 'Скачать (в фоне → появится в Галерее)')}
                      className={`${OV_BTN} ml-auto disabled:opacity-40`}
                      style={{ background: v.status === 'failed' ? 'rgba(239,68,68,0.9)' : 'var(--brand)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer', backdropFilter: 'blur(3px)' }}>
                      {v.status === 'failed' ? <AlertCircle size={13} /> : <Download size={13} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })}
          </div>

          {videos.length > page * PAGE_SIZE && (
            <div className="flex justify-center pt-1">
              <AuroraButton variant="secondary" onClick={() => setPage((p) => p + 1)}>
                {t('sec.trends.showMore', 'Показать ещё ({{n}})', { n: videos.length - page * PAGE_SIZE })}
              </AuroraButton>
            </div>
          )}
        </>
      )}
        </div>
      </div>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message}
        variant="danger"
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
