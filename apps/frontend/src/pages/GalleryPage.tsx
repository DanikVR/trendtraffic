/**
 * GalleryPage — ГЛАВНЫЙ ЭКРАН TrendTraffic (медиа-хаб «всё через Галерею»).
 *
 * Раздел «TrendFlow» из меню убран (2026-07-08): блоки открываются ИЗ Галереи оверлеем
 * (FlowBlockOverlay поверх экрана) и закрываются ОБРАТНО в тот же раздел. Единый стиль:
 * первой в сетке каждой вкладки — плитка «+ Добавить» (открывает блок раздела).
 *
 * Вкладки:
 *  - Тренды      — сверху «Запросы трендов» (история сканов; клик → «Тренды» с готовой
 *                  выдачей), ниже «Анализ» (все сохранённые разборы video_analyses).
 *  - Hotebook    — артефакты NotebookLM; «+» открывает блок Hotebook.
 *  - Google Flow — готовые ПРОЕКТЫ Flow (снимает расширение с labs.google/…/tools/flow);
 *                  клик по карточке открывает проект «проектором». Сохранённые клипы → «Видео».
 *                  «+» открывает блок Flow (генерация клипов).
 *  - UGC         — рендеры студии (folder=ugc) + «Макеты» (бренд-киты); «+» открывает студию.
 *  - Видео       — все загрузки и продукция (kind=reference|audio) с фильтром «Видео | Аудио»;
 *                  кнопка «Медиа» принимает фото/видео/аудио и раскладывает по типу файла.
 *
 * Поиск, просмотр (VideoViewer), выбор, скачивание, удаление — как раньше.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Video, Music, Search, Loader2, Trash2, ExternalLink,
  CheckSquare, Square, Check, Eye, Heart, Image as ImageIcon, RefreshCw, UploadCloud, FileText, Sparkles,
  Download, Play, BookOpen, Clapperboard, ArrowRight, Plus, TrendingUp, Users, LayoutTemplate, X, Send,
  ChevronDown, ChevronUp, HelpCircle, Copy, Languages, Info, Link2,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { VideoViewer } from '../components/VideoViewer';
import { AudioPlayer } from '../components/AudioPlayer';
import { useAppStore } from '../store/useAppStore';
import { TT_EXT_VERSION } from '../components/AppVersion';
import { coverSrc } from '../components/TrendSearch';
import { FlowBlockOverlay, type FlowBlockRequest } from '../components/FlowBlockOverlay';
import { PublisherTab, type ChainDraft } from './publisher/PublisherTab';
import { PublisherStudio } from './publisher/PublisherStudio';

type Tab = 'trendhub' | 'hotebook' | 'flow' | 'ugc' | 'reference' | 'publisher';
/** Фильтр внутри вкладки «Видео»: медиа (изображения+видео, kind=reference) или аудио. */
type MediaKind = 'reference' | 'image' | 'audio';
const ALL_TABS: Tab[] = ['trendhub', 'ugc', 'flow', 'hotebook', 'reference', 'publisher'];

interface GalleryItem {
  id: string;
  mediaType: 'video' | 'image' | 'audio' | 'file';
  fileUrl: string;
  coverUrl?: string;
  title: string;       // @author или имя файла
  subtitle?: string;   // описание
  webUrl?: string;
  durationSec?: number;
  stats?: { play?: number; like?: number };
  isTrend: boolean;
  hasAnalysis?: boolean; // «Из анализа»: есть сохранённый разбор → бейдж + просмотр
}

// Порядок по фидбэку юзера (2026-07-08): блоки впереди, «Видео» (бывш. TrendFlow,
// объединённый с «Аудио» фильтром) — в конце строки. «Из анализа» убрана — разборы
// живут во вкладке «Тренды».
const TABS: { key: Tab; label: string }[] = [
  { key: 'trendhub', label: 'Тренды' },
  { key: 'ugc', label: 'UGC' },
  { key: 'flow', label: 'Google Flow' },
  { key: 'hotebook', label: 'Hotebook' },
  { key: 'reference', label: 'Видео' },
  { key: 'publisher', label: 'Публикатор' },
];

function tabIcon(key: Tab, size = 15) {
  if (key === 'reference') return <Video size={size} />;
  if (key === 'hotebook') return <BookOpen size={size} />;
  if (key === 'flow') return <Clapperboard size={size} />;
  if (key === 'ugc') return <Users size={size} />;
  if (key === 'trendhub') return <TrendingUp size={size} />;
  if (key === 'publisher') return <Send size={size} />;
  return <Sparkles size={size} />;
}

function fmt(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function dur(s?: number): string {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Строгое сравнение версий «a < b» (semver-подобно: 1.2.0 < 1.3.0). Для плашки «Обновите». */
function verLess(a?: string, b?: string): boolean {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

/** Готовый проект Google Flow (снят расширением с главной labs.google/…/tools/flow). */
interface FlowProject { id: string; url: string; title: string; thumb?: string }

// Язык отчёта анализа = язык интерфейса/браузера (пока ru/en; задел под 108 языков).
function galLang(): 'en' | 'ru' {
  try {
    const l = (localStorage.getItem('i18nextLng') || navigator.language || 'ru').toLowerCase();
    return l.startsWith('en') ? 'en' : 'ru';
  } catch { return 'ru'; }
}

// Имя нового UGC-ролика по умолчанию = дата и время создания («ДД.ММ.ГГГГ ЧЧ:ММ»).
// Дальше пользователь переименовывает как хочет (карандаш в шапке студии).
function newRollName(): string {
  try {
    return new Date().toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).replace(',', '');
  } catch { return 'UGC-ролик'; }
}

interface TrendAnalysisItem {
  id: string;
  mediaAssetId?: string;
  sourceUrl?: string;
  platform?: string;
  dna: any;
  fileUrl?: string;  // видео в Галерее (если сохранено)
  title?: string;
  createdAt?: string;
}

interface TrendQueryItem {
  id: string;
  query: string;
  platform: string;
  resultCount: number;
  createdAt: string;
}

interface BrandKit { id: string; name: string; data?: any }

interface HbJob { id: string; type: string; status: string; title?: string | null }

// Тип артефакта Hotebook → человекочитаемое имя (для карточки «генерится»).
const HB_JOB_LABEL: Record<string, string> = {
  audio: 'Аудиопересказ', video: 'Видеообзор', report: 'Отчёт', quiz: 'Тест',
  table: 'Таблица', infographic: 'Инфографика', flashcards: 'Карточки',
  mindmap: 'Ментальная карта', slides: 'Презентация',
};
// Эмодзи типов артефактов — для мини-бейджей на карточке блокнота.
const HB_ARTIFACT_EMOJI: Record<string, string> = {
  audio: '🎙️', video: '🎬', report: '📄', quiz: '❓',
  table: '📊', infographic: '📈', flashcards: '🃏', mindmap: '🧠', slides: '📑',
};

export default function GalleryPage() {
  const { token, user } = useAppStore();
  const navigate = useNavigate();
  // Вкладка синхронизирована с ?tab= — сайдбар/ссылки открывают нужный раздел; смена вкладки
  // пишет ?tab= (deeplink + подсветка пункта сайдбара).
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = (() => { const t = searchParams.get('tab') as Tab | null; return t && ALL_TABS.includes(t) ? t : 'trendhub'; })();
  const [tab, setTabState] = useState<Tab>(urlTab);
  const setTab = (t: Tab) => { setTabState(t); setSearchParams((prev) => { prev.set('tab', t); return prev; }, { replace: true }); };
  useEffect(() => { if (urlTab !== tab) setTabState(urlTab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [urlTab]);
  const [mediaKind, setMediaKind] = useState<MediaKind>('reference'); // фильтр «Видео | Аудио» внутри вкладки «Видео»
  const [blockReq, setBlockReq] = useState<FlowBlockRequest | null>(null); // блок TrendFlow поверх Галереи
  // Публикатор: полноэкранная студия поста (initial = медиа с карточки) + счётчик перезагрузки ленты.
  const [pubStudio, setPubStudio] = useState<{ assetId?: string; mediaUrl?: string; title?: string } | null>(null);
  const [pubReload, setPubReload] = useState(0);
  // Мультивыбор → «Опубликовать (N)»: черновик серии для цепочки Публикатора (Ф2/Ф3).
  const [pubChainDraft, setPubChainDraft] = useState<ChainDraft | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const [analysis, setAnalysis] = useState<{ title: string; dna: any } | null>(null); // просмотр сохранённого разбора
  const [analysisLoading, setAnalysisLoading] = useState(false);
  // «Тренды»: проанализированные видео + сохранённые запросы сканов.
  const [analyses, setAnalyses] = useState<TrendAnalysisItem[]>([]);
  const [trendQueries, setTrendQueries] = useState<TrendQueryItem[]>([]);
  // «UGC»: макеты (бренд-киты студии).
  const [kits, setKits] = useState<BrandKit[]>([]);
  // «UGC» → карточки сохранённых роликов (спека = превью + __flowId для «продолжить») + авто-ролики.
  const [ugcTpls, setUgcTpls] = useState<{ id: string; name: string; trendKeyword?: string; autopublish?: any; spec?: any }[]>([]);
  // Подфильтр вкладки UGC: «Ролики» (созданные нами) · «Авто» (конвейер) · «Макеты» (бренд-киты).
  const [ugcSub, setUgcSub] = useState<'rolls' | 'auto' | 'kits'>('rolls');
  const [autoUgc, setAutoUgc] = useState<GalleryItem[]>([]);
  // «Hotebook»: активные генерации (плейсхолдер-карточки со спиннером до готовности артефакта).
  const [hbJobs, setHbJobs] = useState<HbJob[]>([]);
  // «Hotebook»: ВСЕ блокноты NotebookLM (карточками) — расширение снимает плитки главной.
  const [hbNotebooks, setHbNotebooks] = useState<{ id: string; title: string; subtitle?: string; icon?: string; artifactCounts?: Record<string, number>; generating?: number }[]>([]);
  const [hbNbStatus, setHbNbStatus] = useState<{ ok: boolean; errorKind?: string | null } | null>(null);
  const [hbNbLoading, setHbNbLoading] = useState(false);
  const [hbNbOpening, setHbNbOpening] = useState<string | null>(null); // id блокнота, который открываем

  // Отправка медиа в Google Flow через Chrome-расширение (postMessage-мост, как в блоке Google Flow).
  const [extStatus, setExtStatus] = useState<'checking' | 'present' | 'absent'>('checking');
  const [extVersion, setExtVersion] = useState<string | null>(null); // версия установленного расширения (из present)
  const [extAccount, setExtAccount] = useState<string | null>(null); // аккаунт Google, под которым у расширения открыт NotebookLM
  const [extReconnecting, setExtReconnecting] = useState(false);     // идёт «Переподключить»
  const [extBridgeVersion, setExtBridgeVersion] = useState<string | null>(null); // версия РАБОТАЮЩЕГО на вкладке content-script (для детекта «обнови вкладку»)
  const [flowMsg, setFlowMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [extPopup, setExtPopup] = useState(false);
  const [extOpen, setExtOpen] = useState(false); // раскрытие инлайн-инструкции «Как установить» в плашке расширения
  const [copied, setCopied] = useState<string | null>(null); // подсветка «скопировано» для chrome://extensions
  const [videoPopup, setVideoPopup] = useState<GalleryItem | null>(null); // видео → скачать + инструкция
  // «Google Flow» → живые готовые проекты (снимает расширение с главной Flow).
  const [flowProjects, setFlowProjects] = useState<FlowProject[]>([]);
  const [flowProjLoading, setFlowProjLoading] = useState(false);
  const [flowProjError, setFlowProjError] = useState<string | null>(null);
  // Расширение установлено, но НЕ ответило ACK на list-flow-projects → оно СТАРОЕ (нет обработчика
  // проектов) → надо обновить. Так ловим устаревшую версию, даже если она не сообщает свой номер.
  const [extProbeStale, setExtProbeStale] = useState(false);
  const flowProjTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // таймаут ждущего результата
  const flowAckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);   // таймаут быстрого ACK (свежее ли расширение)
  const openNbFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // фолбэк window.open, если расширение не ответило на open-notebook
  // Наблюдаемые генерации Flow (юзер генерит прямо в Flow) → спиннер на карточке проекта.
  const [flowObserved, setFlowObserved] = useState<Record<string, number>>({});
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const d = ev.data;
      if (!d || d.source !== 'tt-flow-ext') return;
      if (d.type === 'present' || d.type === 'status' || d.type === 'connected') {
        setExtStatus('present');
        if (d.version) setExtVersion(String(d.version));
        // bridgeVersion шлёт ТОЛЬКО свежий content-bridge (≥1.3.13). Если его нет, а расширение
        // «present» — на вкладке крутится старый скрипт (обновили расширение, но не нажали F5).
        setExtBridgeVersion(d.bridgeVersion ? String(d.bridgeVersion) : null);
      }
      // Ответ tt-status несёт аккаунт NotebookLM (какой Google открыт у расширения).
      if (d.type === 'status') {
        setExtAccount(d.nlmAccount ? String(d.nlmAccount) : null);
        setExtReconnecting(false);
      }
      if (d.type === 'connected' || d.type === 'disconnected') setExtReconnecting(false);
      // Мгновенный ack: расширение взялось открывать вкладку NotebookLM → фолбэк window.open
      // отменяем СРАЗУ (само открытие может занять секунды — иначе была бы вторая вкладка).
      if (d.type === 'open-notebook-ack') {
        if (openNbFallbackTimer.current) { clearTimeout(openNbFallbackTimer.current); openNbFallbackTimer.current = null; }
      }
      if (d.type === 'open-notebook-result') {
        if (openNbFallbackTimer.current) { clearTimeout(openNbFallbackTimer.current); openNbFallbackTimer.current = null; }
        if (!d.ok) window.open(d.notebookId ? `https://notebooklm.google.com/notebook/${d.notebookId}` : 'https://notebooklm.google.com', '_blank', 'noopener');
        setHbNbOpening(null);
      }
      if (d.type === 'push-to-flow-result') {
        setFlowMsg(d.ok ? { ok: true, text: 'Отправлено в Google Flow — переключитесь на вкладку Flow.' } : { ok: false, text: 'Не удалось: ' + (d.error || 'ошибка') });
        setTimeout(() => setFlowMsg(null), 6000);
      }
      // Быстрый ACK от расширения = оно СВЕЖЕЕ и умеет проекты. Снимаем «устарело», ждём результат.
      if (d.type === 'flow-projects-ack') {
        if (flowAckTimer.current) { clearTimeout(flowAckTimer.current); flowAckTimer.current = null; }
        setExtProbeStale(false);
        if (d.version) setExtVersion(String(d.version));
      }
      if (d.type === 'flow-projects') {
        if (flowAckTimer.current) { clearTimeout(flowAckTimer.current); flowAckTimer.current = null; }
        if (flowProjTimer.current) { clearTimeout(flowProjTimer.current); flowProjTimer.current = null; }
        setFlowProjLoading(false); setExtProbeStale(false);
        if (d.ok) {
          const proj = Array.isArray(d.projects) ? d.projects : [];
          // ПУСТОЙ скрейп НЕ затирает уже показанные проекты (частый ложный 0: карточки Flow не
          // успели отрисоваться в фоновой вкладке / расширение занято). Показываем 0 только если и
          // раньше было пусто. Иначе — держим прежний список (как у блокнотов Hotebook).
          setFlowProjects((prev) => (proj.length === 0 && prev.length > 0 ? prev : proj));
          setFlowProjError(null);
        }
        else setFlowProjError(d.error || (d.loggedIn === false ? 'Войдите в Google на labs.google/flow — тогда покажутся ваши проекты.' : 'Не удалось получить проекты Flow.'));
      }
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ source: 'trendtraffic', type: 'status' }, window.location.origin);
    const t = setTimeout(() => setExtStatus((s) => (s === 'checking' ? 'absent' : s)), 1400);
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t); };
  }, []);

  // Запросить у расширения список готовых проектов Flow (ответ прилетит сообщением 'flow-projects').
  // Двойной таймер: (1) ACK ~6с — свежее ли расширение (умеет проекты); (2) результат ~70с — сам список.
  const loadFlowProjects = () => {
    if (extStatus === 'absent') { setFlowProjects([]); setFlowProjError('Расширение не найдено — установите его (кнопка «Скачать» в плашке выше).'); return; }
    setFlowProjLoading(true); setFlowProjError(null);
    window.postMessage({ source: 'trendtraffic', type: 'list-flow-projects' }, window.location.origin);
    if (flowAckTimer.current) clearTimeout(flowAckTimer.current);
    if (flowProjTimer.current) clearTimeout(flowProjTimer.current);
    // Нет ACK за 6с, а расширение «present» → оно СТАРОЕ (без обработчика проектов) → «Обновите».
    flowAckTimer.current = setTimeout(() => {
      setExtStatus((s) => {
        if (s === 'present') {
          setExtProbeStale(true);
          setFlowProjLoading(false);
          setFlowProjError(`Расширение устарело и не умеет загружать проекты. Обновите его до v${TT_EXT_VERSION}: нажмите «Скачать» и переустановите (chrome://extensions → удалить старое → «Загрузить распакованное»).`);
        }
        return s;
      });
    }, 6_000);
    // Свежее расширение ответит ACK, но скрейп Flow долгий (открыть вкладку + дождаться карточек) — ждём до 70с.
    flowProjTimer.current = setTimeout(() => {
      setFlowProjLoading(false);
      setFlowProjError((e) => e || 'Flow долго отвечает. Откройте labs.google/flow, войдите в Google и нажмите «Обновить».');
    }, 70_000);
  };
  // Автозагрузка проектов при заходе на вкладку «Google Flow» (как только известен статус расширения).
  useEffect(() => {
    if (tab === 'flow' && extStatus !== 'checking') loadFlowProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, extStatus]);

  // Пока открыта вкладка «Google Flow» — опрашиваем наблюдаемые генерации (юзер генерит прямо
  // в Flow): спиннер на карточке проекта, где сейчас идёт генерация.
  useEffect(() => {
    if (tab !== 'flow') return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/flow-ext/observed', { headers: jsonHeaders() });
        if (!alive || !r.ok) return;
        const d = await r.json();
        setFlowObserved(d.observed && typeof d.observed === 'object' ? d.observed : {});
      } catch { /* не критично */ }
    };
    poll();
    const iv = setInterval(poll, 10_000);
    return () => { alive = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Пока открыт Hotebook/Flow и расширение на связи — периодически спрашиваем статус,
  // чтобы аккаунт NotebookLM на плашке («приложение / NotebookLM») оставался живым.
  useEffect(() => {
    if (extStatus !== 'present' || (tab !== 'hotebook' && tab !== 'flow')) return;
    const ping = () => window.postMessage({ source: 'trendtraffic', type: 'status' }, window.location.origin);
    ping();
    const iv = setInterval(ping, 8000);
    return () => clearInterval(iv);
  }, [tab, extStatus]);

  // Скопировать текст (chrome://extensions — навигацию на chrome:// браузер блокирует, поэтому «скопировать и вставить в адрес»).
  const copyText = (t: string) => {
    try { navigator.clipboard?.writeText(t); } catch { /* clipboard best-effort */ }
    setCopied(t);
    setTimeout(() => setCopied((c) => (c === t ? null : c)), 1600);
  };
  // Крупный ЦЕНТРИРОВАННЫЙ индикатор загрузки (Google Flow / Hotebook) — бросается в глаза,
  // с мягким пульсирующим свечением. Показывается пока тянем список проектов/блокнотов.
  const renderCenterLoader = (text: string) => (
    <div className="w-full flex flex-col items-center justify-center gap-3 py-20">
      <span className="relative flex items-center justify-center" style={{ width: 76, height: 76 }}>
        <span className="absolute inset-0 rounded-full animate-pulse" aria-hidden="true"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.28), transparent 68%)' }} />
        <Loader2 size={46} className="animate-spin" style={{ color: 'var(--brand)', zIndex: 1 }} />
      </span>
      <span className="text-sm font-600" style={{ color: 'var(--text-secondary)' }}>{text}</span>
    </div>
  );
  const sendToFlow = (v: GalleryItem) => {
    // Видео: Flow НЕ принимает авто-вставкой (у Flow поле только image/*). Скачиваем файл + инструкция «залей вручную».
    if (v.mediaType === 'video') { downloadOne(v); setVideoPopup(v); return; }
    // Картинка: авто-вставка через расширение (нет расширения → поп-ап установки).
    if (extStatus !== 'present') { setExtPopup(true); return; }
    const abs = /^https?:/i.test(v.fileUrl) ? v.fileUrl : window.location.origin + (v.fileUrl.startsWith('/') ? v.fileUrl : '/' + v.fileUrl);
    window.postMessage({ source: 'trendtraffic', type: 'push-to-flow', url: abs, title: v.title, kind: 'image' }, window.location.origin);
    setFlowMsg({ ok: true, text: `Отправляю «${v.title}» в Google Flow…` });
    setTimeout(() => setFlowMsg(null), 6000);
  };

  const openAnalysis = async (v: GalleryItem) => {
    setAnalysis({ title: v.title, dna: null }); setAnalysisLoading(true);
    try {
      const r = await fetch(`/api/trends/media/${v.id}/analysis`, { headers: jsonHeaders() });
      if (r.ok) setAnalysis({ title: v.title, dna: (await r.json()).analysis?.dna || {} });
      else setAnalysis({ title: v.title, dna: { __error: r.status === 404 ? 'Анализ не найден.' : `Ошибка ${r.status}` } });
    } catch { setAnalysis({ title: v.title, dna: { __error: 'Не удалось загрузить анализ.' } }); }
    finally { setAnalysisLoading(false); }
  };

  const mediaInputRef = useRef<HTMLInputElement>(null);

  const authHeader = (): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {});
  const jsonHeaders = (): HeadersInit => ({ 'Content-Type': 'application/json', ...authHeader() });

  const load = async (which: Tab = tab, kindOverride?: MediaKind) => {
    // «Публикатор» — данные (ключ/аккаунты/лента) грузит сам компонент PublisherTab.
    if (which === 'publisher') { setItems([]); setLoading(false); setError(null); setSelected(new Set()); return; }
    setLoading(true); setError(null); setSelected(new Set());
    try {
      if (which === 'trendhub') {
        // «Тренды»: запросы сканов + разборы (video_analyses) — двумя запросами параллельно.
        setItems([]);
        const [ar, qr] = await Promise.all([
          fetch('/api/trends/analyses?limit=200', { headers: jsonHeaders() }),
          fetch('/api/trends/history?limit=60', { headers: jsonHeaders() }),
        ]);
        setAnalyses(ar.ok ? ((await ar.json()).analyses || []) : []);
        setTrendQueries(qr.ok ? ((await qr.json()).queries || []) : []);
      } else if (which === 'flow') {
        // «Google Flow» = готовые ПРОЕКТЫ Flow (снимает расширение, loadFlowProjects). Клипы,
        // сохранённые в Галерею, живут во вкладке «Видео» — здесь медиа не грузим.
        setItems([]);
      } else {
        // «Видео» → по kind (фильтр Видео|Изображение|Аудио); блоки → по folder.
        // Видео и Изображение лежат в kind='reference' (различаем по mediaType на клиенте,
        // см. displayItems); Аудио — kind='audio'.
        const mk = kindOverride ?? mediaKind;
        const FOLDER_TABS: Partial<Record<Tab, string>> = { hotebook: 'hotebook', ugc: 'ugc' };
        const qsMedia = FOLDER_TABS[which] ? `folder=${FOLDER_TABS[which]}` : `kind=${mk === 'audio' ? 'audio' : 'reference'}`;
        const res = await fetch(`/api/trends/media?${qsMedia}`, { headers: jsonHeaders() });
        if (res.ok) {
          const d = await res.json();
          setItems((d.assets || []).map((a: any): GalleryItem => ({
            id: a.id, mediaType: a.mediaType, fileUrl: a.fileUrl,
            title: a.originalName || 'файл', isTrend: false, hasAnalysis: !!a.hasAnalysis,
          })));
        }
        // «UGC»: рядом с рендерами — макеты (бренд-киты студии) + АВТО: шаблоны конвейера
        // (бейдж-ключевик сверху) и автоматические ролики (папка 'auto-ugc').
        if (which === 'ugc') {
          try {
            const kr = await fetch('/api/render/ugc/brandkits', { headers: jsonHeaders() });
            setKits(kr.ok ? ((await kr.json()).kits || []) : []);
          } catch { setKits([]); }
          try {
            const tr = await fetch('/api/render/ugc/templates', { headers: jsonHeaders() });
            setUgcTpls(tr.ok ? ((await tr.json()).templates || []) : []);
          } catch { setUgcTpls([]); }
          try {
            const ar2 = await fetch('/api/trends/media?folder=auto-ugc', { headers: jsonHeaders() });
            const da = ar2.ok ? await ar2.json() : { assets: [] };
            setAutoUgc((da.assets || []).map((a: any): GalleryItem => ({
              id: a.id, mediaType: a.mediaType, fileUrl: a.fileUrl,
              title: a.originalName || 'авто-ролик', isTrend: false,
            })));
          } catch { setAutoUgc([]); }
        }
        // «Hotebook»: активные генерации → карточки-плейсхолдеры со спиннером.
        if (which === 'hotebook') {
          try {
            const jr = await fetch('/api/notebooklm/jobs?active=1', { headers: jsonHeaders() });
            setHbJobs(jr.ok ? ((await jr.json()).jobs || []) : []);
          } catch { setHbJobs([]); }
        } else setHbJobs([]);
      }
    } catch (e: any) { setError(e?.message || 'Ошибка загрузки'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, mediaKind]);

  // Пока на Hotebook есть активные генерации — опрашиваем; спиннер «генерится» на КАРТОЧКЕ блокнота
  // (nb.generating из /notebooks), поэтому на каждом тике обновляем и список блокнотов; при завершении
  // перезагружаем артефакты (файл упал в Галерею) и блокноты (спиннер → счётчик ✨).
  useEffect(() => {
    if (tab !== 'hotebook' || hbJobs.length === 0) return;
    const t = setInterval(async () => {
      try {
        const jr = await fetch('/api/notebooklm/jobs?active=1', { headers: jsonHeaders() });
        const next: HbJob[] = jr.ok ? ((await jr.json()).jobs || []) : [];
        setHbJobs(next);
        // ЛЁГКИЙ статус (только БД, БЕЗ пере-скрейпа расширением — иначе навигация сломает генерацию):
        // обновляем спиннер «генерится»/счётчик прямо на карточках блокнотов.
        try {
          const sr = await fetch('/api/notebooklm/notebook-status', { headers: jsonHeaders() });
          if (sr.ok) {
            const st = (await sr.json()).statuses || {};
            setHbNotebooks((prev) => prev.map((nb) => ({ ...nb, generating: st[nb.id]?.generating ?? nb.generating ?? 0, artifactCounts: st[nb.id]?.artifactCounts ?? nb.artifactCounts })));
          }
        } catch { /* тихо */ }
        if (next.length < hbJobs.length) await load('hotebook'); // что-то завершилось → подтянуть готовые
      } catch { /* тихо */ }
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hbJobs.length]);

  // ── «Hotebook»: список ВСЕХ блокнотов NotebookLM (карточками) ──
  const loadNotebooks = async () => {
    setHbNbLoading(true);
    try {
      const r = await fetch('/api/notebooklm/notebooks', { headers: jsonHeaders() });
      const d = r.ok ? await r.json() : { notebooks: [], status: { ok: false } };
      const list = Array.isArray(d.notebooks) ? d.notebooks : [];
      // Пустой ответ НИКОГДА не затирает уже показанный список: во время генерации расширение
      // занято (busy-generating) и/или статус временно «не ок» (навигация вкладки) — вернётся 0,
      // но блокноты у нас есть → держим их (иначе «потерялись» при возврате из другой вкладки).
      if (list.length === 0 && hbNotebooks.length > 0) {
        // сохранить прежние карточки (статусы обновит отдельный лёгкий опрос)
      } else {
        setHbNotebooks(list);
      }
      // Статус-строку «Откройте notebooklm…» держим только когда блокнотов реально нет —
      // если карточки на экране есть, ошибочный статус не показываем (счётчик важнее).
      setHbNbStatus(list.length === 0 && hbNotebooks.length === 0 ? (d.status || null) : { ok: true });
    } catch { setHbNbStatus({ ok: false }); }
    finally { setHbNbLoading(false); }
  };
  useEffect(() => {
    if (tab === 'hotebook') void loadNotebooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Клик по карточке блокнота: открыть САМ NotebookLM на этом блокноте (юзер работает в сервисе;
  // готовые работы студии расширение само подхватывает в «Видео»/«Hotebook»). Открываем через
  // расширение (оно сохраняет authuser рабочей вкладки — не улетаем в чужой Google-аккаунт);
  // если расширение молчит — обычный window.open.
  const openNotebook = (nb: { id: string; title: string }) => {
    setHbNbOpening(nb.id);
    window.postMessage({ source: 'trendtraffic', type: 'open-notebook', notebookId: nb.id }, window.location.origin);
    if (openNbFallbackTimer.current) clearTimeout(openNbFallbackTimer.current);
    openNbFallbackTimer.current = setTimeout(() => {
      window.open(`https://notebooklm.google.com/notebook/${nb.id}`, '_blank', 'noopener');
      setHbNbOpening(null);
    }, 1200);
    // Страховка: ack отменил фолбэк, а result потерялся (SW умер) → спиннер карточки не виснет.
    setTimeout(() => setHbNbOpening(null), 10_000);
  };
  const openNotebookHome = () => {
    window.postMessage({ source: 'trendtraffic', type: 'open-notebook' }, window.location.origin);
    if (openNbFallbackTimer.current) clearTimeout(openNbFallbackTimer.current);
    openNbFallbackTimer.current = setTimeout(() => window.open('https://notebooklm.google.com', '_blank', 'noopener'), 1200);
  };

  // Диплинк ?openNotebook=… (кнопка «Открыть TrendTraffic» из NotebookLM): раньше открывал
  // встроенную студию — теперь достаточно вкладки Hotebook (юзер уже пришёл ИЗ блокнота).
  const openNbHandledRef = useRef(false);
  useEffect(() => {
    const nbId = searchParams.get('openNotebook');
    if (!nbId || openNbHandledRef.current) return;
    openNbHandledRef.current = true;
    setSearchParams((p) => { p.delete('openNotebook'); p.delete('title'); return p; }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // «В TrendFlow» из «Таргет на ЦА» открывает ?tab=ugc&openFlow=<id> → сразу открыть UGC-студию этого flow.
  const openFlowHandledRef = useRef(false);
  useEffect(() => {
    const flowId = searchParams.get('openFlow');
    if (!flowId || openFlowHandledRef.current) return;
    openFlowHandledRef.current = true;
    setSearchParams((p) => { p.delete('openFlow'); return p; }, { replace: true });
    setBlockReq({ cloud: 'ugc', flowId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── «+ Добавить» — первой плиткой каждого раздела ──
  // Блоки (Hotebook/Flow/UGC) открываются ОВЕРЛЕЕМ поверх Галереи: закрыл — вернулся
  // в этот же раздел. «Видео» — дублирует кнопку «Медиа» (файл сам решает, куда лечь).
  const addAction = (which: Tab): { label: string; hint: string; run: () => void } => {
    switch (which) {
      case 'hotebook': return { label: 'Добавить', hint: 'Открыть NotebookLM: создайте блокнот там — он появится здесь, а готовые работы сами попадут в «Видео»', run: openNotebookHome };
      case 'flow': return { label: 'Добавить', hint: 'Открыть блок «Google Flow» (Veo): генерация клипов', run: () => setBlockReq({ cloud: 'flow' }) };
      case 'ugc': return { label: 'Добавить', hint: 'Открыть UGC-студию: новый ролик (имя — дата и время, потом переименуете)', run: () => setBlockReq({ cloud: 'ugc', newName: newRollName() }) };
      case 'trendhub': return { label: 'Добавить', hint: 'Открыть «Тренды → Аналитика»: разобрать видео — разбор появится здесь', run: () => navigate('/social-extension?tab=analytics&from=gallery') };
      default: return { label: 'Добавить', hint: 'Загрузить фото, видео или аудио — файлы разложатся по «Видео»/«Аудио»', run: () => mediaInputRef.current?.click() };
    }
  };
  // Рендер-функция (не компонент — чтобы не перемонтировалась на каждый рендер страницы).
  const renderAddTile = (which: Tab) => {
    const a = addAction(which);
    return (
      <button type="button" onClick={a.run} title={a.hint}
        className="rounded-xl flex flex-col items-center justify-center gap-2 p-2 text-center transition-colors hover:border-[var(--border-stronger)]"
        style={{ aspectRatio: '9 / 16', background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        {/* Переливающийся «плюс в кружке» — привлекает внимание (по фидбэку: убрали кнопку
            «Добавить тренд», добавление теперь отсюда). Конический градиент + сдвиг оттенка
            (animate-iridescent) + пульс-свечение (animate-attract). */}
        <span className="relative w-11 h-11 rounded-full flex items-center justify-center animate-attract" style={{ boxShadow: '0 0 18px rgba(99,102,241,0.45)' }}>
          <span aria-hidden className="absolute inset-0 rounded-full animate-iridescent"
            style={{ background: 'conic-gradient(from 0deg, #6366f1, #22d3ee, #a855f7, #ec4899, #f59e0b, #6366f1)' }} />
          <Plus size={22} className="relative z-[1]" style={{ color: '#fff' }} />
        </span>
        <span className="text-[12px] font-600 leading-tight">{a.label}</span>
      </button>
    );
  };

  // Плашка расширения TrendTraffic (Google Flow / Hotebook):
  //  • «Google Flow» и «NotebookLM» в тексте — кликабельны (первая страница сервиса);
  //  • кнопка «Скачать» прямо на плашке + иконка (i) «Как установить» → раскрывает инструкцию
  //    с кликабельными chrome://extensions (копирование), labs.google/flow, notebooklm.google.com;
  //  • если установлена старая версия расширения — бейдж «Обновите».
  // «Переподключить»: расширение сбрасывает привязку и заново берёт токен ТЕКУЩЕГО аккаунта
  // приложения (из localStorage) — так после смены учётки расширение перецепляется без переустановки.
  const reconnectExt = () => {
    setExtReconnecting(true);
    setExtAccount(null);
    window.postMessage({ source: 'trendtraffic', type: 'reconnect' }, window.location.origin);
    // Подстрахуемся: через 1.2с ещё раз спросим статус (вдруг ответ на reconnect потерялся).
    setTimeout(() => window.postMessage({ source: 'trendtraffic', type: 'status' }, window.location.origin), 1200);
    setTimeout(() => setExtReconnecting(false), 4000);
  };

  const renderExtBanner = () => {
    const installed = extStatus === 'present';
    // Несовпадение: приложение открыто под одним Google/почтой, а NotebookLM у расширения — под другим.
    const appEmail = (user?.email || '').toLowerCase();
    const nlmEmail = (extAccount || '').toLowerCase();
    const mismatch = installed && !!appEmail && !!nlmEmail && appEmail !== nlmEmail;
    const outdated = installed && ((!!extVersion && verLess(extVersion, TT_EXT_VERSION)) || extProbeStale);
    // Старый content-script на вкладке: расширение обновлено (манифест новее), но эта вкладка
    // с прошлого сеанса держит УСТАРЕВШИЙ скрипт (нет reconnect и пр.) → нужен F5.
    const bridgeStale = installed && !!extVersion && (!extBridgeVersion || verLess(extBridgeVersion, extVersion));
    // Кликабельный chrome://extensions: браузер не даёт открыть chrome:// из веб-страницы,
    // поэтому по клику копируем в буфер и подсказываем вставить в адресную строку.
    const ChromeLink = () => (
      <button type="button" onClick={() => copyText('chrome://extensions')} title="Скопировать и вставить в адресную строку"
        className="font-mono" style={{ background: 'none', border: 'none', padding: 0, color: '#6366f1', cursor: 'pointer', textDecoration: 'underline' }}>
        chrome://extensions{copied === 'chrome://extensions' ? ' ✓ скопировано' : ''}
      </button>
    );
    const flowA = <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer" className="font-700 underline" style={{ color: '#6366f1' }}>labs.google/flow</a>;
    const nlmA = <a href="https://notebooklm.google.com" target="_blank" rel="noreferrer" className="font-700 underline" style={{ color: '#22d3ee' }}>notebooklm.google.com</a>;
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: `1px solid ${outdated ? 'rgba(245,158,11,0.5)' : 'var(--border-medium)'}` }}>
        <div className="flex items-center gap-3 p-3">
          <img src="/icons/nav-extension.png?v=tt3" alt="" width={38} height={38} draggable={false} className="flex-shrink-0" style={{ objectFit: 'contain' }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                {installed ? 'Расширение TrendTraffic' : 'Установите расширение TrendTraffic'}
              </span>
              <span className="text-[11px] font-700 px-2 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>v{TT_EXT_VERSION}</span>
              {installed && !outdated && (
                <span className="text-[11px] font-700 px-2 py-0.5 rounded-md inline-flex items-center gap-1" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                  <Check size={12} /> установлено{extVersion ? ` v${extVersion}` : ''}
                </span>
              )}
              {outdated && (
                <span className="text-[11px] font-700 px-2 py-0.5 rounded-md inline-flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.16)', color: '#f59e0b' }}>
                  Обновите{extVersion ? ` · у вас v${extVersion}` : ''}
                </span>
              )}
            </div>
            {/* Текст НЕ трогаем — только делаем «Google Flow» и «NotebookLM» кликабельными (первая страница). */}
            <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Единое расширение для{' '}
              <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer" className="font-700 underline" style={{ color: '#6366f1' }}>Google Flow</a>
              {' '}(Veo) и{' '}
              <a href="https://notebooklm.google.com" target="_blank" rel="noreferrer" className="font-700 underline" style={{ color: '#22d3ee' }}>NotebookLM</a>
              {' '}— {outdated ? 'скачайте новую версию и обновите в chrome://extensions.' : 'скачайте, установите и посмотрите, как это сделать.'}
            </div>
            {installed && (
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                {appEmail && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-600 px-2 py-0.5 rounded-md" title="Аккаунт приложения — к нему привязывается расширение"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
                    <Link2 size={11} style={{ color: '#6366f1' }} /> приложение: {appEmail}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[11px] font-600 px-2 py-0.5 rounded-md"
                  title={extAccount ? 'Google-аккаунт, под которым у расширения открыт NotebookLM — под ним идёт генерация и тратятся его лимиты' : 'Откройте notebooklm.google.com в этом браузере и войдите в нужный Google'}
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
                  <Clapperboard size={11} style={{ color: '#22d3ee' }} /> NotebookLM: {extAccount || 'не открыт'}
                </span>
                {mismatch && (
                  <span className="text-[11px] font-600" style={{ color: 'var(--text-muted)' }}>
                    · генерация идёт под Google-аккаунтом NotebookLM и его лимитами. Совпадать с аккаунтом приложения не обязательно; сменить Google можно в самом NotebookLM (аватар справа сверху).
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a href="/trendtraffic-extension.zip" download title={outdated ? 'Скачать новую версию' : 'Скачать расширение'}
              className="inline-flex items-center gap-1.5 text-[13px] font-700 px-3.5 py-2 rounded-xl"
              style={{ background: outdated ? '#f59e0b' : '#6366f1', color: '#fff', textDecoration: 'none' }}>
              <Download size={15} /> {outdated ? 'Обновить' : 'Скачать'}
            </a>
            {installed && !bridgeStale && (
              <button type="button" onClick={reconnectExt} disabled={extReconnecting}
                title="Переподключить связь расширения с текущим аккаунтом приложения (после смены учётной записи в приложении). Google-аккаунт NotebookLM это НЕ меняет."
                className="inline-flex items-center gap-1.5 text-[13px] font-700 px-3 py-2 rounded-xl"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: extReconnecting ? 'default' : 'pointer', opacity: extReconnecting ? 0.7 : 1 }}>
                <RefreshCw size={14} className={extReconnecting ? 'animate-spin' : ''} /> {extReconnecting ? 'Подключаю…' : 'Переподключить'}
              </button>
            )}
            <button type="button" onClick={() => setExtOpen((v) => !v)} title="Как установить" aria-label="Как установить"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:opacity-90"
              style={{ background: extOpen ? 'var(--brand)' : 'var(--bg-tertiary)', color: extOpen ? 'var(--brand-contrast)' : 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              <Info size={17} />
            </button>
          </div>
        </div>
        {bridgeStale && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.45)' }}>
              <RefreshCw size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span className="text-[12.5px] font-600 flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>
                Расширение обновилось до v{extVersion}, но на этой вкладке ещё работает старая версия{extBridgeVersion ? ` (v${extBridgeVersion})` : ''} — поэтому «Переподключить» не срабатывает. Обновите вкладку.
              </span>
              <button type="button" onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 text-[13px] font-700 px-3 py-1.5 rounded-lg flex-shrink-0"
                style={{ background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer' }}>
                <RefreshCw size={14} /> Обновить вкладку
              </button>
            </div>
          </div>
        )}
        {extOpen && (
          <div className="px-3 pb-3">
            <div className="text-[12.5px] leading-relaxed rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-1.5 font-700 mb-2" style={{ color: 'var(--text-primary)' }}>
                <HelpCircle size={15} style={{ color: 'var(--brand)' }} /> Как установить
              </div>
              <ol className="list-decimal ml-4 space-y-1.5">
                <li>Скачайте <b>.zip</b> (кнопка «Скачать») и <b>распакуйте</b> в отдельную папку.</li>
                <li>Откройте <ChromeLink /> → включите <b>«Режим разработчика»</b> (тумблер справа сверху).</li>
                <li>Нажмите <b>«Загрузить распакованное»</b> и выберите эту папку.</li>
                <li>Если раньше стояло <b>отдельное</b> расширение «Google Flow» — <b>удалите его</b>, чтобы не конфликтовали.</li>
                <li>Откройте нужный сайт и войдите в свой Google: {flowA} (Veo) или {nlmA} (Hotebook).</li>
                <li>Готово. <b>Подключение автоматическое</b> — пока вы залогинены в приложении.</li>
              </ol>
              <p className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                <b>Обновление версии:</b> скачайте новый .zip, замените папку и нажмите «Обновить» в <ChromeLink />, затем обновите вкладку app.trendtraffic.pro (F5).
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // «UGC»: удалить макет (бренд-кит студии).
  const deleteKit = async (k: BrandKit) => {
    try {
      const r = await fetch(`/api/render/ugc/brandkits/${k.id}`, { method: 'DELETE', headers: jsonHeaders() });
      if (r.ok) setKits((prev) => prev.filter((x) => x.id !== k.id));
    } catch { /* не критично */ }
  };

  // «Тренды»: убрать запрос из истории сканов.
  const deleteQuery = async (q: TrendQueryItem) => {
    try {
      const r = await fetch('/api/trends/history/delete', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ query: q.query }) });
      if (r.ok) setTrendQueries((prev) => prev.filter((x) => x.query.toLowerCase() !== q.query.toLowerCase()));
    } catch { /* не критично */ }
  };

  // Вкладка «Тренды»: раздел «Анализ» (разобранные видео с обложкой и данными) +
  // раздел «Запросы трендов» (клик — «Тренды» открываются с готовой выдачей по слову).
  const renderTrendHub = () => {
    const q = query.trim().toLowerCase();
    const fAn = q ? analyses.filter((a) =>
      (a.title || '').toLowerCase().includes(q) || (a.dna?.meta?.author || '').toLowerCase().includes(q) || (a.sourceUrl || '').toLowerCase().includes(q)) : analyses;
    const fQs = q ? trendQueries.filter((x) => x.query.toLowerCase().includes(q)) : trendQueries;
    const anTitle = (a: TrendAnalysisItem) => a.title || a.dna?.meta?.author || 'Видео';
    // Массовый выбор разборов (ключи `an:<id>` в общем наборе `selected`).
    const anKeys = fAn.map((a) => `an:${a.id}`);
    const anAllSel = anKeys.length > 0 && anKeys.every((k) => selected.has(k));
    const anSelCount = anKeys.filter((k) => selected.has(k)).length;
    const toggleAnAll = () => setSelected(anAllSel ? new Set() : new Set(anKeys));
    const askDeleteAnSelected = () => setConfirm({
      title: `Удалить выбранные разборы (${anSelCount})?`,
      message: 'Сохранённые анализы будут удалены. Видео в Галерее останутся.',
      onConfirm: () => { setConfirm(null); void doDeleteAnalyses(anKeys.filter((k) => selected.has(k)).map((k) => k.slice(3))); },
    });
    return (
      <>
        {/* Запросы трендов — СВЕРХУ (по фидбэку юзера): клик открывает готовую выдачу */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-sm font-700" style={{ color: 'var(--text-primary)' }}>
              <Search size={15} style={{ color: 'var(--brand)' }} /> Запросы трендов
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {fQs.length} — клик: «Тренды» откроются с готовой выдачей по этому слову</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Кнопка «Добавить тренд» убрана (по фидбэку) — добавление теперь через переливающийся
                плюс-в-кружке на плитке «Добавить» ниже (renderAddTile). */}
            {fQs.map((x) => (
              <span key={x.id} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-xl"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                <button type="button"
                  onClick={() => navigate(`/social-extension?q=${encodeURIComponent(x.query)}&platform=${encodeURIComponent(x.platform)}`)}
                  title={`Открыть «Тренды» с готовой выдачей: «${x.query}» (${x.platform})`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-600"
                  style={{ color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <TrendingUp size={13} style={{ color: 'var(--brand)' }} />
                  {x.query}
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>· {x.platform}{x.resultCount ? ` · ${x.resultCount}` : ''}</span>
                </button>
                <button type="button" onClick={() => void deleteQuery(x)} title="Убрать запрос из истории"
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:opacity-80"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
          {fQs.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Пока нет запросов. Сканируйте тренды по ключевому слову — запросы сохранятся здесь, чтобы не набирать их дважды.
            </p>
          )}
        </div>

        {/* Анализ */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-700" style={{ color: 'var(--text-primary)' }}>
              <Sparkles size={15} style={{ color: '#22d3ee' }} /> Анализ
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {fAn.length} — уже разобранные видео: обложка + данные анализа</span>
          </div>
          {/* Массовый выбор разборов */}
          {fAn.length > 0 && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <button type="button" onClick={toggleAnAll}
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {anAllSel ? <CheckSquare size={15} color="var(--brand)" /> : <Square size={15} />}
                {anAllSel ? 'Снять выделение' : 'Выбрать всё'}{anSelCount > 0 ? ` · ${anSelCount}` : ''}
              </button>
              <button type="button" onClick={askDeleteAnSelected} disabled={anSelCount === 0 || busy}
                title="Удалить выбранные разборы"
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Удалить{anSelCount > 0 ? ` · ${anSelCount}` : ''}
              </button>
            </div>
          )}
          <div className={CARD_GRID}>
            {renderAddTile('trendhub')}
            {fAn.map((a) => {
              const cover = a.dna?.meta?.cover as string | undefined;
              const title = anTitle(a);
              const openDna = () => setAnalysis({ title, dna: a.dna || {} });
              const anSel = selected.has(`an:${a.id}`);
              return (
                <div key={a.id} className={cardCls(anSel)} style={CARD_STYLE}>
                  {/* Медиа/обложка на весь размер карточки */}
                  {a.fileUrl ? (
                    <button type="button" onClick={() => setViewer({ url: a.fileUrl!, title })} className="group/vid absolute inset-0 w-full h-full" title="Открыть в просмотрщике (с обрезкой)">
                      <video src={`${a.fileUrl}#t=0.1`} poster={coverSrc(cover) || undefined} preload="metadata" muted className="w-full h-full object-cover pointer-events-none" />
                      <span className="absolute inset-0 flex items-center justify-center opacity-80 group-hover/vid:opacity-100">
                        <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(4px)' }}><Play size={18} className="ml-0.5" /></span>
                      </span>
                    </button>
                  ) : cover ? (
                    <button type="button" onClick={openDna} className="absolute inset-0 w-full h-full" title="Открыть разбор">
                      <img src={coverSrc(cover)} alt={title} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <button type="button" onClick={openDna} className="absolute inset-0 w-full h-full flex items-center justify-center" title="Открыть разбор"
                      style={{ color: '#22d3ee', cursor: 'pointer' }}><Sparkles size={30} /></button>
                  )}
                  {/* Чекбокс выбора */}
                  <button type="button" onClick={() => toggleSelect(`an:${a.id}`)} title="Выбрать"
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center z-20" style={ovCheckStyle(anSel)}>
                    {anSel ? <Check size={14} /> : null}
                  </button>
                  {/* Бейдж «Анализ» */}
                  <button type="button" onClick={(e) => { e.stopPropagation(); openDna(); }} title="Открыть разбор виральности этого видео"
                    className={`${ovBadge} inline-flex items-center gap-1 transition-transform hover:scale-105`}
                    style={{ background: 'rgba(34,211,238,0.92)', color: '#083344', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
                    <Sparkles size={10} /> Анализ
                  </button>
                  {cardScrim()}
                  {/* Наложенные название + иконки */}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 z-10 flex flex-col gap-1 pointer-events-none">
                    <div className="text-[11px] font-700 leading-tight line-clamp-2 text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }} title={title}>{title}</div>
                    <div className="flex items-center gap-1 pointer-events-auto">
                      {a.sourceUrl && (
                        <a href={a.sourceUrl} target="_blank" rel="noreferrer" title="Открыть оригинал" className={OV_BTN} style={ovBtnStyle()}>
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <button type="button" onClick={openDna} title="Открыть разбор" className={OV_BTN} style={ovBtnStyle('#67e8f9')}>
                        <Sparkles size={13} />
                      </button>
                      <button type="button" onClick={() => void doDeleteAnalyses([a.id])} disabled={busy} title="Удалить разбор"
                        className={`${OV_BTN} ml-auto disabled:opacity-40`} style={ovBtnStyle('#fca5a5')}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {fAn.length === 0 && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Пока нет разборов. Нажмите «+» и проанализируйте видео — разобранное появится здесь с обложкой и данными анализа.
            </p>
          )}
        </div>
      </>
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((v) => v.title.toLowerCase().includes(q) || (v.subtitle || '').toLowerCase().includes(q));
  }, [items, query]);
  // «Hotebook»: карточки блокнотов тоже фильтруются строкой поиска (по названию/подзаголовку).
  const hbNotebooksFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hbNotebooks;
    return hbNotebooks.filter((nb) => (nb.title || '').toLowerCase().includes(q) || (nb.subtitle || '').toLowerCase().includes(q));
  }, [hbNotebooks, query]);
  // «Google Flow»: карточки проектов тоже фильтруются строкой поиска (по названию) — раньше
  // поиск на этой вкладке был мёртвым (рендерился весь flowProjects без учёта query).
  const flowProjectsFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flowProjects;
    return flowProjects.filter((p) => (p.title || '').toLowerCase().includes(q));
  }, [flowProjects, query]);
  // «Видео»-вкладка: фильтр по mediaType под выбранную папку (Видео/Изображение/Аудио).
  // Видео и Изображение приезжают вместе (kind='reference'), поэтому режем на клиенте.
  const displayItems = useMemo(() => {
    if (tab !== 'reference') return filtered;
    if (mediaKind === 'image') return filtered.filter((v) => v.mediaType === 'image');
    if (mediaKind === 'audio') return filtered.filter((v) => v.mediaType === 'audio');
    return filtered.filter((v) => v.mediaType !== 'image' && v.mediaType !== 'audio'); // Видео/файлы
  }, [tab, mediaKind, filtered]);

  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const visibleIds = displayItems.map((v) => v.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds));

  const deleteBase = '/api/trends/media';

  const doDeleteOne = async (id: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${deleteBase}/${id}`, { method: 'DELETE', headers: jsonHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems((prev) => prev.filter((v) => v.id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e: any) { setError(e?.message || 'Не удалось удалить'); }
    finally { setBusy(false); }
  };
  const doDeleteSelected = async () => {
    const ids = visibleIds.filter((id) => selected.has(id));
    if (ids.length === 0) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${deleteBase}/delete-bulk`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ ids }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const idset = new Set(ids);
      setItems((prev) => prev.filter((v) => !idset.has(v.id)));
      setSelected(new Set());
    } catch (e: any) { setError(e?.message || 'Не удалось удалить'); }
    finally { setBusy(false); }
  };

  const askDeleteOne = (v: GalleryItem) => setConfirm({
    title: 'Удалить?', message: `${v.title} — файл будет удалён с диска безвозвратно.`,
    onConfirm: () => { setConfirm(null); doDeleteOne(v.id); },
  });
  const askDeleteSelected = () => setConfirm({
    title: `Удалить выбранные (${selected.size})?`, message: 'Все выбранные файлы будут удалены с диска безвозвратно.',
    onConfirm: () => { setConfirm(null); doDeleteSelected(); },
  });
  // Удалить сохранённый UGC-ролик (шаблон) из Галереи. Готовое видео (если собрано) не трогаем.
  const askDeleteTpl = (k: { id: string; name: string }) => setConfirm({
    title: 'Удалить ролик?', message: `«${k.name}» уберётся из Галереи. Собранное видео (если есть) останется.`,
    onConfirm: async () => {
      setConfirm(null);
      try { await fetch(`/api/render/ugc/templates/${k.id}`, { method: 'DELETE', headers: jsonHeaders() }); } catch { /* мягко */ }
      setUgcTpls((p) => p.filter((x) => x.id !== k.id));
    },
  });

  // ── UGC: массовый выбор/удаление и копирование ────────────────────────────
  // Ключи выбора кодируем типом (tpl:/media:/kit:) — в одном наборе `selected`
  // уживаются шаблоны-ролики, авто-ролики и макеты текущего подфильтра.
  const [copying, setCopying] = useState<string | null>(null);
  const ugcSelectableKeys = useMemo<string[]>(() => {
    if (tab !== 'ugc') return [];
    if (ugcSub === 'rolls') return [...ugcTpls.map((k) => `tpl:${k.id}`), ...filtered.map((v) => `media:${v.id}`)];
    if (ugcSub === 'auto') return autoUgc.map((v) => `media:${v.id}`);
    return kits.map((k) => `kit:${k.id}`);
  }, [tab, ugcSub, ugcTpls, filtered, autoUgc, kits]);
  const ugcAllSelected = ugcSelectableKeys.length > 0 && ugcSelectableKeys.every((k) => selected.has(k));
  const toggleSelectAllUGC = () => setSelected(ugcAllSelected ? new Set() : new Set(ugcSelectableKeys));
  const ugcSelCount = ugcSelectableKeys.filter((k) => selected.has(k)).length;

  const doDeleteUgcSelected = async () => {
    const keys = ugcSelectableKeys.filter((k) => selected.has(k));
    if (keys.length === 0) return;
    setBusy(true); setError(null);
    try {
      const mediaIds = keys.filter((k) => k.startsWith('media:')).map((k) => k.slice(6));
      const tplIds = keys.filter((k) => k.startsWith('tpl:')).map((k) => k.slice(4));
      const kitIds = keys.filter((k) => k.startsWith('kit:')).map((k) => k.slice(4));
      if (mediaIds.length) {
        const r = await fetch('/api/trends/media/delete-bulk', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ ids: mediaIds }) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      }
      for (const id of tplIds) { try { await fetch(`/api/render/ugc/templates/${id}`, { method: 'DELETE', headers: jsonHeaders() }); } catch { /* мягко */ } }
      for (const id of kitIds) { try { await fetch(`/api/render/ugc/brandkits/${id}`, { method: 'DELETE', headers: jsonHeaders() }); } catch { /* мягко */ } }
      const mset = new Set(mediaIds), tset = new Set(tplIds), kset = new Set(kitIds);
      setItems((p) => p.filter((v) => !mset.has(v.id)));
      setAutoUgc((p) => p.filter((v) => !mset.has(v.id)));
      setUgcTpls((p) => p.filter((k) => !tset.has(k.id)));
      setKits((p) => p.filter((k) => !kset.has(k.id)));
      setSelected(new Set());
    } catch (e: any) { setError(e?.message || 'Не удалось удалить'); }
    finally { setBusy(false); }
  };
  const askDeleteUgcSelected = () => setConfirm({
    title: `Удалить выбранные (${ugcSelCount})?`,
    message: ugcSub === 'kits' ? 'Выбранные макеты будут удалены.' : 'Выбранные ролики уберутся из Галереи. Собранные видео (файлы) удаляются с диска безвозвратно.',
    onConfirm: () => { setConfirm(null); doDeleteUgcSelected(); },
  });

  // Копия ролика: дублируем И шаблон, И его сценарий (иначе копия правила бы оригинал).
  const copyTpl = async (k: { id: string; name: string; trendKeyword?: string; spec?: any }) => {
    setCopying(k.id); setError(null);
    try {
      const srcFlowId = k.spec?.__flowId ? String(k.spec.__flowId) : null;
      let graph: any = {};
      if (srcFlowId) {
        const gr = await fetch(`/api/flows/${srcFlowId}`, { headers: jsonHeaders() });
        if (gr.ok) graph = (await gr.json())?.flow?.graph || {};
      }
      const newName = `${(k.name || 'UGC-ролик').trim()} (копия)`.slice(0, 120);
      const cf = await fetch('/api/flows', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ name: newName }) });
      const cfd = await cf.json().catch(() => ({}));
      if (!cf.ok || !cfd?.flow?.id) throw new Error(cfd?.error || 'Не удалось создать сценарий');
      const newFlowId = String(cfd.flow.id);
      const baseSpec = { ...(k.spec || {}) }; delete baseSpec.templateId;
      const tplSpec = { ...baseSpec, __flowId: newFlowId, buildJobId: null, result: null, results: [] };
      const ct = await fetch('/api/render/ugc/templates', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ name: newName, trendKeyword: k.trendKeyword, spec: tplSpec }) });
      const ctd = await ct.json().catch(() => ({}));
      if (!ct.ok || !ctd?.id) throw new Error(ctd?.error || 'Не удалось создать копию');
      const newTplId = String(ctd.id);
      const newUgc = { ...(graph.ugc || tplSpec), __flowId: newFlowId, templateId: newTplId, buildJobId: null, result: null, results: [] };
      await fetch(`/api/flows/${newFlowId}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify({ name: newName, graph: { ...graph, ugc: newUgc } }) });
      setUgcTpls((p) => [{ id: newTplId, name: newName, trendKeyword: k.trendKeyword, autopublish: undefined, spec: tplSpec }, ...p]);
    } catch (e: any) { setError(e?.message || 'Не удалось скопировать'); }
    finally { setCopying(null); }
  };

  // ── Тренды → «Анализ»: массовое удаление сохранённых разборов ──────────────
  const doDeleteAnalyses = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/trends/analyses/delete-bulk', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ ids }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const idset = new Set(ids);
      setAnalyses((p) => p.filter((a) => !idset.has(a.id)));
      setSelected(new Set());
    } catch (e: any) { setError(e?.message || 'Не удалось удалить'); }
    finally { setBusy(false); }
  };

  // Скачать один файл на устройство (статика /uploads — same-origin, без авторизации).
  const downloadOne = (v: GalleryItem) => {
    const a = document.createElement('a');
    a.href = v.fileUrl; a.download = ''; a.target = '_blank'; a.rel = 'noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  };
  // Скачать выбранные — по очереди со сдвигом (иначе браузер блокирует серию).
  const downloadSelected = () => {
    const targets = filtered.filter((v) => selected.has(v.id) && v.fileUrl);
    targets.forEach((v, i) => setTimeout(() => downloadOne(v), i * 350));
  };

  // Одна кнопка «Медиа» на все типы: kind каждого файла определяется по его MIME
  // (audio/* → «Аудио», изображения и видео → «Видео»). После загрузки открываем
  // вкладку «Видео» с фильтром по тому, что загрузилось.
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true); setError(null);
    try {
      let audioCount = 0;
      for (const file of Array.from(files)) {
        const kind: MediaKind = (file.type || '').startsWith('audio/') ? 'audio' : 'reference';
        if (kind === 'audio') audioCount++;
        const fd = new FormData();
        fd.append('file', file);
        // ВАЖНО: для FormData НЕ задаём Content-Type — браузер сам проставит boundary.
        const res = await fetch(`/api/trends/media/upload?kind=${kind}`, { method: 'POST', headers: authHeader(), body: fd });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      }
      // Все файлы — аудио → фильтр «Аудио», иначе «Видео». load() перезапустит эффект
      // [tab, mediaKind]; если ни tab, ни фильтр не сменились — перезагружаем явно.
      const nextKind: MediaKind = audioCount === files.length ? 'audio' : 'reference';
      const changed = tab !== 'reference' || mediaKind !== nextKind;
      setTab('reference'); setMediaKind(nextKind);
      if (!changed) await load('reference', nextKind);
    } catch (e: any) { setError(e?.message || 'Ошибка загрузки'); }
    finally {
      setUploading(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const selectedCount = selected.size;

  const renderPreview = (v: GalleryItem) => {
    if (v.mediaType === 'video') return (
      <button type="button" onClick={() => setViewer({ url: v.fileUrl, title: v.title })}
        className="group/vid block w-full h-full relative" title="Открыть в просмотрщике (с обрезкой)">
        <video src={`${v.fileUrl}#t=0.1`} poster={v.coverUrl || undefined} preload="metadata" muted
          className="w-full h-full object-cover pointer-events-none" />
        <span className="absolute inset-0 flex items-center justify-center transition-opacity opacity-90 group-hover/vid:opacity-100">
          <span className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <Play size={22} className="ml-0.5" />
          </span>
        </span>
      </button>
    );
    if (v.mediaType === 'image') return <img src={v.fileUrl} alt={v.title} loading="lazy" className="w-full h-full object-cover" />;
    if (v.mediaType === 'audio') return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-3" style={{ background: 'var(--bg-tertiary)' }}>
        <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)' }}><Music size={26} /></span>
        <AudioPlayer src={v.fileUrl} />
      </div>
    );
    // Файлы (pdf/pptx/md/json/csv — артефакты Hotebook и т.п.): клик открывает в новой вкладке.
    const ext = (v.fileUrl.split('.').pop() || '').toUpperCase().slice(0, 5);
    return (
      <a href={v.fileUrl} target="_blank" rel="noreferrer" title="Открыть файл"
        className="w-full h-full flex flex-col items-center justify-center gap-2.5" style={{ background: 'var(--bg-tertiary)' }}>
        <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}>
          <FileText size={26} />
        </span>
        {ext && <span className="text-[10px] font-700 px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.35)', color: 'var(--text-secondary)' }}>{ext}</span>}
      </a>
    );
  };

  // ── Единый вид карточек ВО ВСЕЙ Галерее (по фидбэку: как в поиске трендов) ──
  // Карточка = само изображение (портрет 9/16); название, счётчики и ВСЕ иконки-действия
  // НАКЛАДЫВАЮТСЯ поверх картинки (футера под карточкой нет); плотная сетка — 8 в ряд.
  const CARD_GRID = 'grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2';
  const cardCls = (sel = false) =>
    `group relative rounded-xl overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg${sel ? ' ring-2 ring-[var(--brand)] ring-inset' : ''}`;
  const CARD_STYLE: React.CSSProperties = { aspectRatio: '9 / 16', background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' };
  // Нижний градиент-скрим — под наложенные название/иконки (читаемость на любой картинке).
  const cardScrim = () => (
    <span aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none z-[5]"
      style={{ height: '70%', background: 'linear-gradient(to top, rgba(0,0,0,0.94), rgba(0,0,0,0.5) 42%, transparent)' }} />
  );
  // Наложенная иконка-действие (всегда видна поверх картинки).
  const OV_BTN = 'w-[26px] h-[26px] rounded-lg flex items-center justify-center flex-shrink-0 transition-transform hover:scale-110';
  const ovBtnStyle = (accent?: string): React.CSSProperties =>
    ({ background: 'rgba(0,0,0,0.55)', color: accent || '#fff', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer', backdropFilter: 'blur(3px)' });
  // Наложенный чекбокс выбора (верх-лево).
  const ovCheckStyle = (sel: boolean): React.CSSProperties =>
    ({ background: sel ? 'var(--brand)' : 'rgba(0,0,0,0.5)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.75)', cursor: 'pointer', backdropFilter: 'blur(3px)' });
  // Наложенный бейдж (платформа/тип/статус) — верх-право.
  const ovBadge = 'absolute top-1.5 right-1.5 z-20 text-[9px] font-700 px-1.5 py-0.5 rounded-md';
  // Заглушка для карточек БЕЗ изображения (аудио/notebook/UGC): тема-зависимый фон карточки
  // (светлый в светлой теме, тёмный в тёмной — на токенах) + МИНИМАЛЬНЫЙ ПРОЗРАЧНЫЙ арт-объект
  // поверх (один soft-glass предмет в индиго, сгенерён в OpenAI gpt-image-1 на прозрачном фоне).
  // Прозрачность → объект читается в обеих темах, а фон берётся от темы. Аккуратно, не ляписто.
  const placeholderArt = (name: 'audio' | 'notebook' | 'ugc') => (
    <>
      <span aria-hidden className="absolute inset-0 z-0" style={{ background: 'linear-gradient(158deg, var(--bg-tertiary), var(--bg-secondary))' }} />
      <img src={`/placeholders/${name}.webp`} alt="" aria-hidden loading="lazy"
        className="absolute inset-0 w-full h-full object-cover z-[1] pointer-events-none" />
    </>
  );

  return (
    <div className="max-w-[1760px] mx-auto py-2 sm:py-3 space-y-4">
      {/* Header: иконка + заголовок. Кнопки «Медиа»/«Обновить» убраны (по фидбэку): загрузка —
          через плитку «+ Добавить» в сетке «Видео»; данные обновляются при переключении вкладок. */}
      <div className="flex items-center gap-3">
        <img src="/icons/nav-gallery.png" alt="" draggable={false}
             className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0" style={{ objectFit: 'contain' }} />
        <h1 className="text-xl sm:text-2xl font-700 leading-tight min-w-0 flex-1" style={{ color: 'var(--text-primary)' }}>Галерея</h1>
        {/* Скрытый инпут загрузки — вызывается плиткой «+ Добавить» во вкладке «Видео». */}
        <input ref={mediaInputRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {/* Папки — сегмент-вкладки. ЛИПКАЯ строка: всегда сверху при скролле в любой вкладке (по фидбэку). */}
      <div className="sticky top-0 z-40 py-2" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto sm:w-fit" style={{ background: 'var(--bg-tertiary)' }}>
          {TABS.map((tb) => {
            const active = tab === tb.key;
            return (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-600 transition-all whitespace-nowrap flex-shrink-0"
                style={{ background: active ? 'var(--brand)' : 'transparent', color: active ? 'var(--brand-contrast)' : 'var(--text-muted)', boxShadow: active ? '0 2px 8px rgba(99,102,241,0.35)' : 'none' }}>
                {tabIcon(tb.key)} {tb.label}
                {/* Идёт генерация артефакта Hotebook — спиннер прямо на вкладке (фича параллельной сессии). */}
                {tb.key === 'hotebook' && hbJobs.length > 0 && <Loader2 size={13} className="animate-spin" style={{ color: active ? 'var(--brand-contrast)' : '#22d3ee' }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по имени / автору / описанию…"
          className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40 transition-shadow"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          <Trash2 size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
      ) : tab === 'publisher' ? (
        /* «Публикатор» (Ф1): постинг через Blotato (BYO-ключ) — плитки сетей, лента, студия поста */
        <PublisherTab token={token} reloadKey={pubReload} onNewPost={() => setPubStudio({})}
          chainDraft={pubChainDraft} onChainDraftConsumed={() => setPubChainDraft(null)} />
      ) : tab === 'trendhub' ? (
        renderTrendHub()
      ) : (
        <>
          {/* Google Flow / Hotebook: плашка «Установите расширение TrendTraffic» (инлайн-раскрытие) */}
          {(tab === 'flow' || tab === 'hotebook') && renderExtBanner()}

          {/* Hotebook: строка статуса блокнотов (когда НЕ грузим) — не залогинен/офлайн + «Обновить». */}
          {tab === 'hotebook' && !hbNbLoading && (
            <div className="flex items-center gap-2 text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
              {hbNbStatus && !hbNbStatus.ok ? (
                <span style={{ color: '#f59e0b' }}>
                  {hbNbStatus.errorKind === 'ext_login'
                    ? 'Войдите в notebooklm.google.com в браузере с расширением — тогда покажутся все ваши блокноты.'
                    : 'Откройте notebooklm.google.com в браузере с расширением TrendTraffic — тогда покажутся все ваши блокноты.'}
                </span>
              ) : (
                <><span>Блокнотов NotebookLM: {hbNotebooks.length}</span>
                  <button type="button" onClick={() => void loadNotebooks()} className="underline hover:opacity-80" style={{ cursor: 'pointer' }}>Обновить</button>
                  <span>· клик по блокноту откроет его в NotebookLM — работайте там: пока генерится, тут крутится индикатор, а готовые работы студии сами попадают в «Видео» (видео/аудио/изображения) и в «Hotebook». Встроенная студия TT остаётся в системе.</span></>
              )}
            </div>
          )}

          {/* «Google Flow»: строка статуса проектов (когда НЕ грузим) — ошибка / N проектов + «Обновить». */}
          {tab === 'flow' && !flowProjLoading && (
            <div className="flex items-center gap-2 text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>
              {flowProjError ? (
                <span style={{ color: '#f59e0b' }}>{flowProjError} <button type="button" onClick={loadFlowProjects} className="underline hover:opacity-80" style={{ cursor: 'pointer' }}>Обновить</button></span>
              ) : (
                <><span>Проектов Google Flow: {flowProjectsFiltered.length}{query.trim() && flowProjectsFiltered.length !== flowProjects.length ? ` из ${flowProjects.length}` : ''}</span>
                  <button type="button" onClick={loadFlowProjects} className="underline hover:opacity-80" style={{ cursor: 'pointer' }}>Обновить</button>
                  <span>· клик по проекту откроет его в Flow</span></>
              )}
            </div>
          )}

          {/* Крупный центрированный индикатор загрузки — Hotebook / Google Flow. */}
          {tab === 'hotebook' && hbNbLoading && renderCenterLoader('Загружаю блокноты NotebookLM…')}
          {tab === 'flow' && flowProjLoading && renderCenterLoader('Загружаю проекты Google Flow…')}

          {/* «Видео»: ВСЁ в одну строчку (по фидбэку) — фильтры Видео/Изображение/Аудио +
              Найдено + Выбрать всё + Удалить + Опубликовать + Скачать (на узких — гориз. прокрутка). */}
          {tab === 'reference' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <div className="inline-flex gap-1 p-1 rounded-xl flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
                {([['reference', 'Видео', <Video key="v" size={14} />], ['image', 'Изображение', <ImageIcon key="i" size={14} />], ['audio', 'Аудио', <Music key="a" size={14} />]] as [MediaKind, string, React.ReactNode][]).map(([k, lbl, ic]) => (
                  <button key={k} type="button" onClick={() => { setMediaKind(k); setSelected(new Set()); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-600 transition-all whitespace-nowrap"
                    style={{ background: mediaKind === k ? 'var(--brand)' : 'transparent', color: mediaKind === k ? 'var(--brand-contrast)' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                    {ic} {lbl}
                  </button>
                ))}
              </div>
              <span className="text-sm font-700 flex-shrink-0 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>Найдено: {displayItems.length}</span>
              <button type="button" onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-2.5 py-2 rounded-xl transition-colors flex-shrink-0 whitespace-nowrap"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {allSelected ? <CheckSquare size={15} color="var(--brand)" /> : <Square size={15} />}
                {allSelected ? 'Снять' : 'Выбрать всё'}{selectedCount > 0 ? ` · ${selectedCount}` : ''}
              </button>
              <button type="button" onClick={askDeleteSelected} disabled={selectedCount === 0 || busy} title="Удалить выбранные файлы"
                className="inline-flex items-center gap-1.5 text-[13px] font-600 px-2.5 py-2 rounded-xl transition-colors disabled:opacity-40 flex-shrink-0 whitespace-nowrap"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Удалить{selectedCount > 0 ? ` · ${selectedCount}` : ''}
              </button>
              <button type="button" disabled={selectedCount === 0}
                onClick={() => {
                  const chainItems = displayItems
                    .filter((v) => selected.has(v.id) && (v.mediaType === 'video' || v.mediaType === 'image'))
                    .map((v) => ({ assetId: v.id, mediaUrl: v.fileUrl, title: v.title }));
                  if (!chainItems.length) return;
                  setPubChainDraft({ items: chainItems });
                  setTab('publisher');
                }}
                title="Опубликовать выбранные серией: ролики займут слоты «Моего расписания» в Публикаторе"
                className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-600 px-2.5 py-2 rounded-xl transition-colors disabled:opacity-40 flex-shrink-0 whitespace-nowrap"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}>
                <Send size={15} /> Опубликовать{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </button>
              <button type="button" onClick={downloadSelected} disabled={selectedCount === 0} title="Скачать выбранные на устройство"
                className="inline-flex items-center gap-1.5 text-[13px] font-700 px-2.5 py-2 rounded-xl transition-transform hover:scale-105 disabled:opacity-40 flex-shrink-0 whitespace-nowrap"
                style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', cursor: 'pointer' }}>
                <Download size={15} /> Скачать{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </button>
            </div>
          )}

          {/* «UGC»: ВСЁ в одну строчку — подфильтр (Ролики/Авто/Макеты) + Всего + Выбрать всё + Удалить. */}
          {tab === 'ugc' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {([['rolls', 'Ролики', ugcTpls.length], ['auto', 'Авто', autoUgc.length], ['kits', 'Макеты', kits.length]] as const).map(([key, label, count]) => {
                const on = ugcSub === key;
                return (
                  <button key={key} type="button" onClick={() => { setUgcSub(key); setSelected(new Set()); }}
                    className="text-[12px] font-600 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition-colors flex-shrink-0 whitespace-nowrap"
                    style={{ background: on ? 'var(--brand)' : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)', border: `1px solid ${on ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                    {label}
                    {count > 0 && <span className="text-[10px] font-700 px-1.5 rounded-full" style={{ background: on ? 'rgba(255,255,255,.25)' : 'var(--bg-tertiary)', color: on ? '#fff' : 'var(--text-muted)' }}>{count}</span>}
                  </button>
                );
              })}
              {ugcSelectableKeys.length > 0 && <>
                <span className="text-sm font-700 flex-shrink-0 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>Всего: {ugcSelectableKeys.length}</span>
                <button type="button" onClick={toggleSelectAllUGC}
                  className="inline-flex items-center gap-1.5 text-[13px] font-600 px-2.5 py-2 rounded-xl transition-colors flex-shrink-0 whitespace-nowrap"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  {ugcAllSelected ? <CheckSquare size={15} color="var(--brand)" /> : <Square size={15} />}
                  {ugcAllSelected ? 'Снять' : 'Выбрать всё'}{ugcSelCount > 0 ? ` · ${ugcSelCount}` : ''}
                </button>
                <button type="button" onClick={askDeleteUgcSelected} disabled={ugcSelCount === 0 || busy} title="Удалить выбранные"
                  className="inline-flex items-center gap-1.5 text-[13px] font-600 px-2.5 py-2 rounded-xl transition-colors disabled:opacity-40 flex-shrink-0 whitespace-nowrap"
                  style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  Удалить{ugcSelCount > 0 ? ` · ${ugcSelCount}` : ''}
                </button>
              </>}
            </div>
          )}

          {/* Сетка карточек: первой — плитка «+ Добавить» (открывает блок раздела) */}
          <div className={CARD_GRID}>
            {renderAddTile(tab)}
            {/* «Google Flow»: готовые проекты Flow карточками — клик открывает проект «проектором» (новая вкладка). */}
            {tab === 'flow' && flowProjectsFiltered.map((p) => (
              <div key={`proj-${p.id}`} className={cardCls()} style={CARD_STYLE}>
                <a href={p.url} target="_blank" rel="noreferrer" title="Открыть проект в Google Flow (проектор)" className="absolute inset-0 w-full h-full block">
                  {/* Арт-заглушка под обложкой — остаётся, если thumb не загрузился (CDN Google за авторизацией). */}
                  {!p.thumb && placeholderArt('ugc')}
                  {p.thumb && (
                    <img src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </a>
                <span className={ovBadge} style={{ left: '0.375rem', right: 'auto', background: '#6366f1', color: '#fff' }}>Google Flow</span>
                {/* Идёт генерация ПРЯМО в Flow (наблюдает расширение): спиннер — готовый клип сам упадёт в «Видео». */}
                {(flowObserved[p.id] || 0) > 0 && (
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[7] inline-flex items-center gap-1.5 text-[10px] font-700 px-2 py-1 rounded-full pointer-events-none"
                    style={{ background: 'rgba(0,0,0,0.65)', color: '#a5b4fc' }}>
                    <Loader2 size={12} className="animate-spin" /> генерится
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-[6] pointer-events-none" style={{ background: 'rgba(0,0,0,0.35)' }}>
                  <span className="inline-flex items-center gap-1 text-[11px] font-700 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.95)', color: '#111' }}><ExternalLink size={12} /> Открыть</span>
                </span>
                {cardScrim()}
                <div className="absolute inset-x-0 bottom-0 p-1.5 z-10 flex flex-col gap-1 pointer-events-none">
                  <div className="text-[11px] font-700 leading-tight line-clamp-2 text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }} title={p.title}>{p.title}</div>
                  <div className="flex items-center gap-1 pointer-events-auto">
                    <a href={p.url} target="_blank" rel="noreferrer" title="Открыть в Google Flow" className={OV_BTN} style={ovBtnStyle('#a5b4fc')}>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
            {/* UGC · «Ролики»: сохранённые ролики карточками с превью; клик → продолжить в студии (тот же сценарий). */}
            {tab === 'ugc' && ugcSub === 'rolls' && ugcTpls.map((k) => {
              const spec = k.spec || {};
              const preview: string | null = spec.result?.url || spec.photoUrl || spec.avatarUrl
                || (Array.isArray(spec.clipImages) && spec.clipImages[0]?.url) || spec.clip?.url || null;
              const isVid = !!preview && /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(preview);
              const openTpl = () => setBlockReq({ cloud: 'ugc', ...(spec.__flowId ? { flowId: String(spec.__flowId) } : {}) });
              const selK = `tpl:${k.id}`;
              const isSel = selected.has(selK);
              return (
                <div key={`tpl-${k.id}`} className={cardCls(isSel)} style={CARD_STYLE}>
                  {!preview && placeholderArt('ugc')}
                  <button type="button" onClick={openTpl} title="Открыть ролик в UGC-студии" className="absolute inset-0 w-full h-full">
                    {preview && (
                      isVid
                        ? <video src={`${preview}#t=0.1`} muted preload="metadata" className="w-full h-full object-cover" />
                        : <img src={preview} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                  {/* Чекбокс выбора */}
                  <button type="button" onClick={() => toggleSelect(selK)} title="Выбрать"
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center z-20" style={ovCheckStyle(isSel)}>
                    {isSel ? <Check size={14} /> : null}
                  </button>
                  {k.autopublish?.enabled && <span className={ovBadge} style={{ background: 'rgba(16,185,129,.92)', color: '#fff' }}>авто</span>}
                  {cardScrim()}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 z-10 flex flex-col gap-1 pointer-events-none">
                    <div className="text-[11px] font-700 leading-tight line-clamp-2 text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }} title={k.name}>{k.name}</div>
                    {k.trendKeyword && <span className="text-[9px] font-700 px-1.5 py-0.5 rounded-full self-start text-white" style={{ background: 'rgba(168,85,247,0.85)' }}>#{k.trendKeyword}</span>}
                    <div className="flex items-center gap-1 pointer-events-auto">
                      <button type="button" onClick={openTpl} title="Открыть в UGC-студии" className={OV_BTN} style={ovBtnStyle('#d8b4fe')}>
                        <Play size={13} />
                      </button>
                      <button type="button" onClick={() => copyTpl(k)} disabled={copying === k.id} title="Скопировать ролик (создать копию)"
                        className={`${OV_BTN} disabled:opacity-50`} style={ovBtnStyle()}>
                        {copying === k.id ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                      </button>
                      <button type="button" onClick={() => askDeleteTpl(k)} title="Удалить ролик из Галереи" className={`${OV_BTN} ml-auto`} style={ovBtnStyle('#fca5a5')}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* UGC · «Авто»: ролики конвейера «тренд → анализ → UGC» (папка auto-ugc), карточками. */}
            {tab === 'ugc' && ugcSub === 'auto' && autoUgc.map((v) => {
              const selK = `media:${v.id}`;
              const isSel = selected.has(selK);
              return (
              <div key={`auto-${v.id}`} className={cardCls(isSel)} style={CARD_STYLE}>
                <button type="button" onClick={() => v.fileUrl && setViewer({ url: v.fileUrl, title: v.title })} className="absolute inset-0 w-full h-full">
                  {v.fileUrl && <video src={`${v.fileUrl}#t=0.1`} muted preload="metadata" className="w-full h-full object-cover" />}
                </button>
                <button type="button" onClick={() => toggleSelect(selK)} title="Выбрать"
                  className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center z-20" style={ovCheckStyle(isSel)}>
                  {isSel ? <Check size={14} /> : null}
                </button>
                <span className={ovBadge} style={{ background: 'rgba(16,185,129,.92)', color: '#fff' }}>авто</span>
                {cardScrim()}
                <div className="absolute inset-x-0 bottom-0 p-1.5 z-10 flex flex-col gap-1 pointer-events-none">
                  <div className="text-[11px] font-700 leading-tight line-clamp-2 text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }} title={v.title}>{v.title}</div>
                  <div className="flex items-center gap-1 pointer-events-auto">
                    <button type="button" onClick={() => askDeleteOne(v)} disabled={busy} title="Удалить авто-ролик"
                      className={`${OV_BTN} ml-auto disabled:opacity-40`} style={ovBtnStyle('#fca5a5')}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
            {/* UGC · «Макеты»: бренд-киты студии (оформление: слой/заставки/музыка/субтитры/голос). */}
            {tab === 'ugc' && ugcSub === 'kits' && kits.map((k) => {
              const selK = `kit:${k.id}`;
              const isSel = selected.has(selK);
              return (
              <div key={`kit-${k.id}`} className={cardCls(isSel)} style={CARD_STYLE}>
                <button type="button" onClick={() => setBlockReq({ cloud: 'ugc' })} title="Открыть UGC-студию — макет применяется в «Оформлении»"
                  className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <LayoutTemplate size={28} /><span className="text-[10px] font-600">Бренд-кит</span>
                </button>
                <button type="button" onClick={() => toggleSelect(selK)} title="Выбрать"
                  className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center z-20" style={ovCheckStyle(isSel)}>
                  {isSel ? <Check size={14} /> : null}
                </button>
                {cardScrim()}
                <div className="absolute inset-x-0 bottom-0 p-1.5 z-10 flex flex-col gap-1 pointer-events-none">
                  <div className="text-[11px] font-700 leading-tight line-clamp-2 text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }} title={k.name}>{k.name || 'Макет'}</div>
                  <div className="flex items-center gap-1 pointer-events-auto">
                    <button type="button" onClick={() => void deleteKit(k)} title="Удалить макет" className={`${OV_BTN} ml-auto`} style={ovBtnStyle('#fca5a5')}><X size={13} /></button>
                  </div>
                </div>
              </div>
              );
            })}
            {/* Hotebook: карточки ВСЕХ блокнотов NotebookLM — клик открывает блок на этом блокноте. */}
            {tab === 'hotebook' && hbNotebooksFiltered.map((nb) => (
              <button key={`nb-${nb.id}`} type="button" onClick={() => void openNotebook(nb)} disabled={hbNbOpening === nb.id}
                title={`Открыть в NotebookLM: ${nb.title} — работайте там, готовые работы студии сами попадут в «Видео»`} className={`${cardCls()} flex items-center justify-center`} style={CARD_STYLE}>
                {placeholderArt('notebook')}
                {/* Спиннер по центру, пока блокнот открывается (иконку даёт placeholderArt). */}
                {hbNbOpening === nb.id && <Loader2 size={26} className="animate-spin z-[2]" style={{ color: 'var(--brand)' }} />}
                <span className={ovBadge} style={{ left: '0.375rem', right: 'auto', background: '#22d3ee', color: '#04222a' }}>NotebookLM</span>
                {/* Бейдж: сколько готовых артефактов сделано в этом блокноте (наведение — по типам). */}
                {(() => {
                  const total = Object.values(nb.artifactCounts || {}).reduce((s, n) => s + (Number(n) || 0), 0);
                  return total > 0 ? (
                    <span className="absolute top-1.5 right-1.5 z-20 text-[9px] font-700 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(16,185,129,.92)', color: '#fff' }}
                      title={Object.entries(nb.artifactCounts || {}).map(([t, n]) => `${HB_JOB_LABEL[t] || t}: ${n}`).join(', ')}>✨ {total}</span>
                  ) : null;
                })()}
                {/* Идёт генерация артефакта В ЭТОМ блокноте — спиннер-пилюля по центру карточки. */}
                {(nb.generating || 0) > 0 && (
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[9px] font-700 px-2 py-0.5 rounded-full z-20 whitespace-nowrap" style={{ background: 'rgba(34,211,238,0.92)', color: '#04222a' }}>
                    <Loader2 size={10} className="animate-spin" /> генерится
                  </span>
                )}
                {cardScrim()}
                <div className="absolute inset-x-0 bottom-0 p-1.5 z-10 flex flex-col gap-0.5 text-left">
                  <div className="text-[11px] font-700 leading-tight line-clamp-2 text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }} title={nb.title}>{nb.title}</div>
                  {nb.subtitle && <div className="text-[9px] leading-tight line-clamp-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{nb.subtitle}</div>}
                  {/* Мини-разбивка по типам: 🎙️2 · 📄1 … */}
                  {Object.entries(nb.artifactCounts || {}).filter(([, n]) => Number(n) > 0).length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      {Object.entries(nb.artifactCounts || {}).filter(([, n]) => Number(n) > 0).map(([t, n]) => (
                        <span key={t} title={HB_JOB_LABEL[t] || t}>{HB_ARTIFACT_EMOJI[t] || '📦'}{Number(n) > 1 ? ` ${n}` : ''}</span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
            {/* Hotebook: активная генерация показывается СПИННЕРОМ на карточке блокнота (nb.generating),
                а не отдельной карточкой-плейсхолдером (по фидбэку). */}
            {/* UGC: готовые рендеры (папка ugc) — только в «Ролики»; в «Авто»/«Макеты» сетку не мешаем.
                «Google Flow» медиа не показывает (там — проекты; клипы живут во «Видео»). */}
            {tab !== 'flow' && (tab !== 'ugc' || ugcSub === 'rolls') && displayItems.map((v) => {
              const selK = tab === 'ugc' ? `media:${v.id}` : v.id;
              const isSel = selected.has(selK);
              // Аудио: карточка-заглушка (нет изображения) с ИНЛАЙН-плеером — играет прямо на
              // карточке, БЕЗ открытия нового экрана (по фидбэку).
              if (v.mediaType === 'audio') {
                return (
                  <div key={v.id} className={cardCls(isSel)} style={CARD_STYLE}>
                    {placeholderArt('audio')}
                    {cardScrim()}
                    <button type="button" onClick={() => toggleSelect(selK)} title="Выбрать"
                      className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center z-20" style={ovCheckStyle(isSel)}>
                      {isSel ? <Check size={14} /> : null}
                    </button>
                    <div className="absolute inset-x-0 bottom-0 p-2 z-10 flex flex-col gap-1.5">
                      <div className="text-[11px] font-700 leading-tight line-clamp-2 text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }} title={v.title}>{v.title}</div>
                      <AudioPlayer src={v.fileUrl} />
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => askDeleteOne(v)} disabled={busy} title="Удалить файл"
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80 disabled:opacity-40"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}><Trash2 size={14} /></button>
                        <button type="button" onClick={() => downloadOne(v)} title="Скачать на устройство"
                          className="w-7 h-7 rounded-lg flex items-center justify-center ml-auto transition-transform hover:scale-105"
                          style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', cursor: 'pointer' }}><Download size={14} /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={v.id} className={cardCls(isSel)} style={CARD_STYLE}>
                  {/* Медиа/превью на весь размер карточки */}
                  <div className="absolute inset-0">{renderPreview(v)}</div>
                  {/* Чекбокс выбора */}
                  <button type="button" onClick={() => toggleSelect(selK)} title="Выбрать"
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center z-20" style={ovCheckStyle(isSel)}>
                    {isSel ? <Check size={14} /> : null}
                  </button>
                  {/* Бейдж «Анализ» — у видео «Из анализа» с сохранённым разбором; клик → открыть разбор */}
                  {v.hasAnalysis && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); void openAnalysis(v); }}
                      title="Открыть сохранённый анализ этого видео"
                      className={`${ovBadge} inline-flex items-center gap-1 transition-transform hover:scale-105`}
                      style={{ background: 'rgba(34,211,238,0.92)', color: '#083344', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
                      <Sparkles size={10} /> Анализ
                    </button>
                  )}
                  {cardScrim()}
                  {/* Наложенные счётчики + название + все иконки-действия */}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 z-10 flex flex-col gap-1 pointer-events-none">
                    {(v.stats?.play != null || v.stats?.like != null || dur(v.durationSec)) && (
                      <div className="flex items-center gap-2 text-[10px] font-700 text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                        {v.stats?.play != null && <span className="inline-flex items-center gap-0.5"><Eye size={11} /> {fmt(v.stats.play)}</span>}
                        {v.stats?.like != null && <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(v.stats.like)}</span>}
                        {dur(v.durationSec) && <span className="ml-auto px-1 rounded" style={{ background: 'rgba(0,0,0,0.5)' }}>{dur(v.durationSec)}</span>}
                      </div>
                    )}
                    <div className="text-[11px] font-700 leading-tight line-clamp-2 text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }} title={v.title}>{v.title}</div>
                    <div className="flex flex-wrap items-center gap-1 pointer-events-auto">
                      {/* Открыть оригинал (тренды) или файл */}
                      <a href={v.webUrl || v.fileUrl} target="_blank" rel="noreferrer" title={v.webUrl ? 'Открыть оригинал' : 'Открыть файл'} className={OV_BTN} style={ovBtnStyle()}>
                        {v.webUrl ? <ExternalLink size={13} /> : <Play size={13} />}
                      </a>
                      {/* → Google Flow (видео/картинки) */}
                      {(v.mediaType === 'video' || v.mediaType === 'image') && (
                        <button type="button" onClick={() => sendToFlow(v)} title={v.mediaType === 'video' ? 'Скачать и загрузить в Google Flow (видео — вручную через «Загрузки»)' : 'Отправить картинку в Google Flow (Veo) через расширение'}
                          className={OV_BTN} style={ovBtnStyle('#a5b4fc')}>
                          <Clapperboard size={13} />
                        </button>
                      )}
                      {/* → Публикатор */}
                      {(v.mediaType === 'video' || v.mediaType === 'image') && (
                        <button type="button" onClick={() => setPubStudio({ assetId: v.id, mediaUrl: v.fileUrl, title: v.title })}
                          title="Опубликовать в соцсети (Публикатор)" className={OV_BTN} style={ovBtnStyle('#6ee7b7')}>
                          <Send size={13} />
                        </button>
                      )}
                      {/* Удалить */}
                      <button type="button" onClick={() => askDeleteOne(v)} disabled={busy} title="Удалить файл" className={`${OV_BTN} disabled:opacity-40`} style={ovBtnStyle('#fca5a5')}>
                        <Trash2 size={13} />
                      </button>
                      {/* Скачать на устройство */}
                      <button type="button" onClick={() => downloadOne(v)} title="Скачать на устройство" className={`${OV_BTN} ml-auto`}
                        style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: '1px solid var(--brand)', cursor: 'pointer' }}>
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Пусто: подсказка под плиткой «+» (не показываем для «Google Flow» — там свой статус проектов,
              и не показываем, если идёт генерация Hotebook) */}
          {tab !== 'flow' && (tab === 'ugc'
            ? (ugcSub === 'rolls' ? (ugcTpls.length + filtered.length === 0) : ugcSub === 'auto' ? autoUgc.length === 0 : kits.length === 0)
            : (displayItems.length === 0 && !(tab === 'hotebook' && hbJobs.length > 0))) && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              {tab === 'hotebook' ? 'Пока пусто. Нажмите «+» — откроется блок «Hotebook»: аудио, видео, отчёты и другие артефакты попадут сюда.'
                : tab === 'ugc' ? (ugcSub === 'auto' ? 'Пока нет авто-роликов. Их собирает конвейер «тренд → анализ → UGC» (автопилот в Трендах).'
                    : ugcSub === 'kits' ? 'Макетов пока нет. Сохраните бренд-кит в UGC-студии (кнопка «Бренд-кит» в шапке).'
                    : 'Пока пусто. Нажмите «+» — откроется UGC-студия; сохранённые ролики появятся здесь карточками.')
                : mediaKind === 'audio' ? 'Пока пусто. Загрузите аудио плиткой «+ Добавить» — аудиофайлы лягут сюда.'
                : mediaKind === 'image' ? 'Пока пусто. Загрузите изображения плиткой «+ Добавить» — картинки лягут сюда.'
                : 'Пока пусто. Загрузите фото/видео плиткой «+ Добавить»; здесь же появляется всё, что производят блоки.'}
            </p>
          )}

          {/* «Google Flow»: нет проектов (и не грузим/без ошибки) — подсказка. Готовые клипы → вкладка «Видео». */}
          {tab === 'flow' && !flowProjLoading && !flowProjError && flowProjects.length === 0 && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Проектов пока нет. Откройте <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer" className="underline" style={{ color: '#6366f1' }}>labs.google/flow</a>, войдите в Google — ваши проекты появятся здесь. Нажмите «+», чтобы создать клип. Сохранённые видео — во вкладке «Видео».
            </p>
          )}
        </>
      )}

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />

      {/* Единый просмотрщик-редактор видео (плеер + обрезка) */}
      <VideoViewer
        open={!!viewer}
        url={viewer?.url || ''}
        title={viewer?.title}
        onClose={() => setViewer(null)}
        onSaved={() => { void load(); }}
      />

      {/* Блок TrendFlow ПОВЕРХ Галереи: закрыл — вернулся в этот же раздел (+ обновляем его) */}
      {blockReq && <FlowBlockOverlay req={blockReq} onClose={() => { setBlockReq(null); void load(); }} />}

      {/* Публикатор: полноэкранная студия поста (из «Новый пост» или кнопки на карточке).
          После успешной отправки — во вкладку «Публикатор» со свежей лентой. */}
      {pubStudio && (
        <PublisherStudio
          token={token}
          initial={pubStudio}
          onClose={() => setPubStudio(null)}
          onPublished={() => { setPubStudio(null); setPubReload((x) => x + 1); if (tab !== 'publisher') setTab('publisher'); }}
        />
      )}

      {/* Просмотр сохранённого анализа видео (тот же разбор, что на вкладке «Аналитика») */}
      {analysis && (
        <div onClick={() => setAnalysis(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18 }}>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                <Sparkles size={16} style={{ color: '#22d3ee' }} /> {galLang() === 'en' ? 'Analysis' : 'Анализ'} · {analysis.title}
              </span>
              <button onClick={() => setAnalysis(null)} title="Закрыть" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            {analysisLoading ? (
              <div className="py-10 text-center"><Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
            ) : analysis.dna?.__error ? (
              <p className="text-sm py-6 text-center" style={{ color: '#ef4444' }}>{analysis.dna.__error}</p>
            ) : (
              <AnalysisView dna={analysis.dna} token={token} />
            )}
          </div>
        </div>
      )}

      {/* Тост-уведомление отправки в Flow */}
      {flowMsg && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 96, maxWidth: 360, padding: '10px 14px', borderRadius: 12, background: 'var(--bg-secondary)', border: `1px solid ${flowMsg.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, color: flowMsg.ok ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
          {flowMsg.text}
        </div>
      )}

      {/* Поп-ап «нужно расширение» — если расширение не установлено */}
      {extPopup && (
        <div onClick={() => setExtPopup(false)} style={{ position: 'fixed', inset: 0, zIndex: 97, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 470, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}><Clapperboard size={18} color="#fff" /></span>
              <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Нужно расширение Google Flow</span>
            </div>
            <p className="text-[13px] mb-3" style={{ color: 'var(--text-secondary)' }}>
              Чтобы отправлять медиа прямо в Google Flow, установите наше единое Chrome-расширение TrendTraffic (v{TT_EXT_VERSION}) — оно же работает и с NotebookLM. Один раз — дальше подключается автоматически.
            </p>
            <a href="/trendtraffic-extension.zip" download className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2.5 rounded-xl" style={{ background: '#6366f1', color: '#fff', textDecoration: 'none' }}>
              <Download size={15} /> Скачать расширение
            </a>
            <ol className="list-decimal ml-4 text-[12px] space-y-1 mt-3" style={{ color: 'var(--text-muted)' }}>
              <li>Распакуйте .zip в отдельную папку.</li>
              <li><code>chrome://extensions</code> → «Режим разработчика» → «Загрузить распакованное» → эта папка.</li>
              <li>Войдите в свой Google на <b>labs.google/flow</b>, вернитесь сюда и снова нажмите «→ Flow».</li>
            </ol>
            <div className="flex justify-end mt-3">
              <button onClick={() => setExtPopup(false)} className="text-[13px] font-600 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {/* Видео → Flow: файл скачивается + инструкция залить вручную в «Загрузки» (Flow видео авто-вставкой не берёт) */}
      {videoPopup && (
        <div onClick={() => setVideoPopup(null)} style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18 }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}><Clapperboard size={18} color="#fff" /></span>
              <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Видео → Google Flow</span>
            </div>
            <p className="text-[13px] mb-1" style={{ color: '#10b981', fontWeight: 600 }}>✓ Видео скачивается на устройство.</p>
            <p className="text-[12.5px] mb-1" style={{ color: 'var(--text-secondary)' }}>
              Google Flow принимает видео только вручную — через раздел «Загрузки». Авто-вставку видео Flow не поддерживает (только картинки).
            </p>

            {/* Точная стрелка: скачано → Flow «Загрузки» */}
            <div className="flex items-center justify-center gap-2 my-3 p-3 rounded-xl" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}><Download size={14} /> Скачано</span>
              <ArrowRight size={22} style={{ color: '#6366f1' }} />
              <span className="inline-flex items-center gap-1.5 text-[12px] font-600 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}><UploadCloud size={14} /> Flow → «Загрузки»</span>
            </div>

            <ol className="list-decimal ml-4 text-[12.5px] space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>Открой <b>Google Flow</b> (кнопка ниже).</li>
              <li>Слева выбери раздел <b>«Загрузки»</b>.</li>
              <li>Нажми <b>«Загрузить»</b> → выбери скачанный файл <b>«{videoPopup.title}»</b>.</li>
            </ol>

            <div className="flex items-center gap-2 mt-4">
              <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2.5 rounded-xl" style={{ background: '#6366f1', color: '#fff', textDecoration: 'none' }}>
                <ExternalLink size={15} /> Открыть Google Flow
              </a>
              <button onClick={() => downloadOne(videoPopup)} className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
                <Download size={15} /> Скачать ещё раз
              </button>
              <button onClick={() => setVideoPopup(null)} className="text-[13px] font-600 px-3 py-2.5 rounded-xl ml-auto" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Форматированный разбор из сохранённой TrendDNA (Viral Breakdown + Video Content Analysis).
 *  Разбор сохранён на английском; «Перевести» переводит показ на язык браузера (пока ru/en). */
function AnalysisView({ dna, token }: { dna: any; token: string | null }) {
  const [translated, setTranslated] = useState<any>(null);
  const [showLang, setShowLang] = useState<'en' | 'ru'>('en');
  const [translating, setTranslating] = useState(false);
  const [tErr, setTErr] = useState<string | null>(null);
  const target = galLang(); // 'en' | 'ru' — язык кнопки «Перевести»
  const d = showLang === 'en' ? dna : (translated || dna);
  const L = (ru: string, en: string) => (showLang === 'en' ? en : ru);
  const doTranslate = async () => {
    if (showLang !== 'en') { setShowLang('en'); return; }
    if (translated) { setShowLang(target); return; }
    setTranslating(true); setTErr(null);
    try {
      const res = await fetch('/api/trends/analyze/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ dna, lang: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setTranslated(data.dna); setShowLang(target);
    } catch (e: any) { setTErr(e?.message || 'Не удалось перевести'); }
    finally { setTranslating(false); }
  };
  const Sec = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-3">
      <div className="text-[10px] font-700 tracking-wide mb-1" style={{ color: '#22d3ee' }}>{title}</div>
      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{children}</div>
    </div>
  );
  const Bul = ({ items }: { items: any }) => Array.isArray(items) && items.length ? (
    <ul className="space-y-0.5">{items.map((x: any, i: number) => <li key={i}>• {String(x)}</li>)}</ul>
  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const beats = Array.isArray(d?.sceneBeats) ? d.sceneBeats : [];
  const fmtT = (t: any) => (typeof t === 'number' ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '');
  return (
    <div>
      {target !== 'en' && (
        <div className="flex justify-end mb-2">
          <button type="button" onClick={doTranslate} disabled={translating} title="Перевести разбор на язык браузера"
            className="inline-flex items-center gap-1 text-[11px] font-600 px-2.5 py-1 rounded-lg disabled:opacity-50"
            style={{ background: showLang === 'en' ? 'rgba(99,102,241,0.12)' : 'var(--bg-tertiary)', color: showLang === 'en' ? 'var(--brand)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
            {translating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
            {showLang === 'en' ? 'Перевести' : 'Оригинал (EN)'}
          </button>
        </div>
      )}
      {tErr && <p className="text-[11px] mb-2" style={{ color: '#ef4444' }}>{tErr}</p>}
      <div className="text-[11px] font-700 mb-2" style={{ color: 'var(--text-muted)' }}>{L('ВИРАЛЬНЫЙ РАЗБОР', 'VIRALITY BREAKDOWN')}</div>
      {d?.hookType && <Sec title={L('ТИП ХУКА', 'HOOK TYPE')}>{d.hookType}</Sec>}
      {d?.whyItWorks && <Sec title={L('ПОЧЕМУ РАБОТАЕТ', 'WHY IT WORKS')}>{d.whyItWorks}</Sec>}
      {d?.targetAudience && <Sec title={L('ЦЕЛЕВАЯ АУДИТОРИЯ', 'TARGET AUDIENCE')}>{d.targetAudience}</Sec>}
      {d?.viralFactors && <Sec title={L('ФАКТОРЫ ВИРАЛЬНОСТИ', 'VIRALITY FACTORS')}><Bul items={d.viralFactors} /></Sec>}
      {d?.copyReadyScript && <Sec title={L('ГОТОВЫЙ СЦЕНАРИЙ', 'READY SCRIPT')}><div className="p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', whiteSpace: 'pre-wrap' }}>{d.copyReadyScript}</div></Sec>}
      {d?.howToAdapt && <Sec title={L('КАК АДАПТИРОВАТЬ', 'HOW TO ADAPT')}><Bul items={d.howToAdapt} /></Sec>}
      <div className="text-[11px] font-700 mb-2 mt-4" style={{ color: 'var(--text-muted)' }}>{L('АНАЛИЗ СОДЕРЖАНИЯ', 'CONTENT ANALYSIS')}</div>
      {d?.summary && <Sec title={L('КРАТКОЕ ОПИСАНИЕ', 'SUMMARY')}>{d.summary}</Sec>}
      {beats.length > 0 && <Sec title={L('СЦЕНЫ (ТАЙМИНГ)', 'SCENES (TIMING)')}><ul className="space-y-0.5">{beats.map((b: any, i: number) => <li key={i}><span style={{ color: '#22d3ee' }}>{fmtT(b?.t)}</span> {b?.desc}{b?.intensity ? ` [${b.intensity}]` : ''}</li>)}</ul></Sec>}
      {d?.hookAnalysis && <Sec title={L('РАЗБОР ХУКА', 'HOOK BREAKDOWN')}>{d.hookAnalysis}</Sec>}
      {d?.visualStyle && <Sec title={L('ВИЗУАЛЬНЫЙ СТИЛЬ', 'VISUAL STYLE')}>{d.visualStyle}</Sec>}
      {d?.audioDialogue && <Sec title={L('АУДИО / ДИАЛОГ', 'AUDIO / DIALOGUE')}>{d.audioDialogue}</Sec>}
      {d?.whyResonates && <Sec title={L('ПОЧЕМУ ЗАХОДИТ', 'WHY IT RESONATES')}><Bul items={d.whyResonates} /></Sec>}
      {d?.howToReplicate && <Sec title={L('КАК ПОВТОРИТЬ', 'HOW TO REPLICATE')}><Bul items={d.howToReplicate} /></Sec>}
      {Array.isArray(d?.keywords) && d.keywords.length > 0 && <Sec title={L('КЛЮЧЕВЫЕ СЛОВА', 'KEYWORDS')}>{d.keywords.join(', ')}</Sec>}
    </div>
  );
}
