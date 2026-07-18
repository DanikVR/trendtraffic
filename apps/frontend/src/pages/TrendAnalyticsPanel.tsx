/**
 * TrendAnalyticsPanel — «Аналитика по ссылке» (порт расширения TikHub в веб).
 *
 * Вставляешь ссылку на видео/пост или аккаунт (TikTok/Douyin/Instagram/X/Reddit/Bilibili)
 * → backend (/api/trends/analyze) дёргает TikHub эффективным ключом (свой ключ tenant'а,
 * иначе платформенный) → показываем сводку (просмотры/лайки/комменты/шеры + ER),
 * статусы вызовов и сырые данные с экспортом JSON. YouTube отключён (только поиск трендов).
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link2, Loader2, Search, Download, CheckCircle2, XCircle, Eye, Heart, MessageCircle, Share2, Users, BarChart3, Sparkles, FileText, FileSpreadsheet, Music2, Clock, MapPin, BadgeCheck, ExternalLink, RotateCw, Flame, Film, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../config/i18n';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';

interface Block { ok: boolean; error?: string; data?: any; }
interface NormComment { author?: string; text: string; likes?: number; replies?: number; }
interface AnalyzeResult {
  detected: { platform: string; platformLabel: string; type: 'video' | 'account'; videoId?: string; username?: string };
  blocks: Record<string, Block>;
  summary: Record<string, any>;
  normalized: { comments: NormComment[]; posts: any[]; keywords: { word: string; count?: number }[] };
  debug?: Record<string, any>;
}
interface Sentiment {
  positive: number; negative: number; neutral: number;
  overall: string; themes: string[]; topPositive: string[]; topNegative: string[];
}
// Разбор вирусности (ИИ) — нативный аналог Viral Breakdown + Video Content Analysis.
interface DnaBeat { t: number; desc: string; intensity?: 'low' | 'mid' | 'high' }
interface TrendDNA {
  hookType: string; whyItWorks: string; targetAudience: string; viralFactors: string[];
  copyReadyScript: string; howToAdapt: string[];
  summary: string; sceneBeats: DnaBeat[]; hookAnalysis: string; visualStyle: string;
  audioDialogue: string; whyResonates: string[]; howToReplicate: string[];
  keywords: string[];
}

function fmt(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// Язык отчёта аналитики = язык интерфейса/браузера (i18next → navigator). Двухбуквенный
// код: бэкенд разворачивает его в название языка (Intl.DisplayNames) — работают все 108 локалей.
function analysisLang(): string {
  try {
    const l = (localStorage.getItem('i18nextLng') || navigator.language || 'en').toLowerCase();
    return l.split('-')[0] || 'en';
  } catch { return 'en'; }
}

// Подпись блока ответа (переводится при каждом вызове — на текущем языке интерфейса).
function blockLabel(k: string): string {
  switch (k) {
    case 'video': return i18n.t('common:sec.tanalytics.videoPost', 'Видео / пост');
    case 'metrics': return i18n.t('common:sec.tanalytics.metrics', 'Метрики');
    case 'comments': return i18n.t('common:sec.tanalytics.comments', 'Комментарии');
    case 'commentKeywords': return i18n.t('common:sec.tanalytics.keywords', 'Ключевые слова');
    case 'account': return i18n.t('common:sec.tanalytics.account', 'Аккаунт');
    case 'posts': return i18n.t('common:sec.tanalytics.posts', 'Лента публикаций');
    default: return k;
  }
}

// ── Облако слов: частоты по текстам комментариев (RU+EN стоп-слова) ──
const STOPWORDS = new Set(('и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между the a an and or but is are was were be to of in on for it this that with you your i we they he she his her my me at as by from so not no yes do does did have has had will would can could just very more most all any out up off your про это эта эти').split(/\s+/));
function wordFreq(texts: string[], limit = 30): { word: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const t of texts) {
    for (const raw of String(t).toLowerCase().split(/[^a-zа-яё0-9#]+/i)) {
      const w = raw.trim();
      if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return [...freq.entries()].map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count).slice(0, limit);
}
function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function commentsCsv(comments: NormComment[]): string {
  const head = ['author', 'text', 'likes', 'replies'];
  const rows = comments.map((c) => [c.author || '', c.text, c.likes ?? '', c.replies ?? '']
    .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return '﻿' + [head.join(','), ...rows].join('\n'); // BOM для Excel
}

// Самодостаточный HTML-отчёт (обзор + ER + облако слов + распределение лайков + топ-комментарии + тональность).
// Тексты — через i18n.t (язык интерфейса на момент экспорта), значения экранируются esc().
function buildReportHtml(r: AnalyzeResult, words: { word: string; count: number }[], sentiment: Sentiment | null): string {
  // Локальный t: тот же неймспейс common, что и в компоненте (см. конвенцию sec.*-ключей).
  const t = (key: string, ru: string, opts?: Record<string, unknown>) => i18n.t(`common:${key}`, ru, opts) as string;
  const lng = i18n.language || 'ru';
  const s = r.summary || {};
  const top = [...r.normalized.comments].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10);
  const maxW = words[0]?.count || 1;
  const cloud = words.map((w) => {
    const sz = 13 + Math.round((w.count / maxW) * 30);
    const op = 0.55 + (w.count / maxW) * 0.45;
    return `<span style="font-size:${sz}px;opacity:${op.toFixed(2)};margin:2px 8px;display:inline-block;font-weight:700;color:#ff6a00">${esc(w.word)}</span>`;
  }).join('');
  const maxLike = Math.max(1, ...top.map((c) => c.likes || 0));
  const bars = top.map((c) => `<div class="row"><div class="meter"><div class="fill" style="width:${Math.round((c.likes || 0) / maxLike * 100)}%"></div></div><div class="ct"><b>${c.likes || 0} ♥</b> ${esc((c.text || '').slice(0, 90))}${c.author ? ` <i>— ${esc(c.author)}</i>` : ''}</div></div>`).join('');
  const stat = (l: string, v: any) => `<div class="card"><div class="lbl">${l}</div><div class="val">${v == null ? '—' : esc(typeof v === 'number' ? v.toLocaleString(lng) : v)}</div></div>`;
  const themesLabel = t('sec.tanalytics.rptThemes', 'Темы:');
  const cloudHeading = t('sec.tanalytics.rptCloud', 'Облако слов в комментариях');
  const likesHeading = t('sec.tanalytics.rptLikesDist', 'Распределение лайков · топ-комментарии');
  const sent = sentiment ? `
    <h2>${t('sec.tanalytics.sentimentAi', 'Тональность (ИИ)')}</h2>
    <div class="sent"><span style="background:#10b981;width:${sentiment.positive}%">${sentiment.positive}%</span><span style="background:#94a3b8;width:${sentiment.neutral}%">${sentiment.neutral}%</span><span style="background:#ef4444;width:${sentiment.negative}%">${sentiment.negative}%</span></div>
    <p class="muted">${t('sec.tanalytics.sentLegend', 'Позитив · Нейтрально · Негатив')}</p>
    <p>${esc(sentiment.overall)}</p>
    ${sentiment.themes.length ? `<p><b>${themesLabel}</b> ${sentiment.themes.map((th) => `<span class="tag">${esc(th)}</span>`).join(' ')}</p>` : ''}
  ` : '';
  return `<!doctype html><html lang="${esc(lng)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t('sec.tanalytics.rptTitle', 'Отчёт')} · ${esc(r.detected.platformLabel)} · TrendTraffic</title>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#0d0f14;color:#e7e9ee;padding:0}
.wrap{max-width:920px;margin:0 auto;padding:28px}
header{display:flex;align-items:center;gap:12px;border-bottom:1px solid #232733;padding-bottom:16px;margin-bottom:20px}
.logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#ff8a2b,#ff5e00);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff}
h1{font-size:20px;margin:0}h2{font-size:16px;margin:26px 0 12px;color:#ff8a2b}
.muted{color:#8a90a0;font-size:12px;margin:4px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.card{background:#161a22;border:1px solid #232733;border-radius:12px;padding:12px}
.lbl{font-size:11px;color:#8a90a0;margin-bottom:4px}.val{font-size:18px;font-weight:800}
.cloud{background:#161a22;border:1px solid #232733;border-radius:12px;padding:18px;line-height:2.1;text-align:center}
.row{margin:7px 0}.meter{height:7px;background:#232733;border-radius:5px;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,#ff8a2b,#ff5e00)}
.ct{font-size:12px;color:#c7ccd6;margin-top:3px}.ct i{color:#8a90a0}
.sent{display:flex;height:26px;border-radius:8px;overflow:hidden;font-size:11px;font-weight:700;color:#fff}
.sent span{display:flex;align-items:center;justify-content:center;min-width:0}
.tag{display:inline-block;background:#232733;border-radius:6px;padding:2px 8px;font-size:12px;margin:2px}
footer{margin-top:28px;border-top:1px solid #232733;padding-top:14px;color:#8a90a0;font-size:11px}
@media print{body{background:#fff;color:#111}.card,.cloud{background:#fafafa;border-color:#e5e5e5}}
</style></head><body><div class="wrap">
<header><div class="logo">TT</div><div><h1>${t('sec.tanalytics.rptHeader', 'Отчёт о трендах — {{platform}}', { platform: esc(r.detected.platformLabel) })}</h1>
<div class="muted">${r.detected.type === 'video' ? t('sec.tanalytics.videoPost', 'Видео / пост') : t('sec.tanalytics.account', 'Аккаунт')}${s.author ? ` · ${esc(s.author)}` : ''}</div></div></header>
${s.desc ? `<p>${esc(s.desc)}</p>` : ''}
<h2>${t('sec.tanalytics.rptOverview', 'Обзор')}</h2>
<div class="grid">${stat(t('sec.tanalytics.views', 'Просмотры'), s.views)}${stat(t('sec.tanalytics.likes', 'Лайки'), s.likes)}${stat(t('sec.tanalytics.comments', 'Комментарии'), s.comments)}${stat(t('sec.tanalytics.reposts', 'Репосты'), s.shares)}${r.detected.type === 'account' ? stat(t('sec.tanalytics.followers', 'Подписчики'), s.followers) : stat(t('sec.tanalytics.engagement', 'Вовлечённость'), s.engagementRate != null ? s.engagementRate + '%' : '—')}</div>
${words.length ? `<h2>${cloudHeading}</h2><div class="cloud">${cloud}</div>` : ''}
${bars ? `<h2>${likesHeading}</h2>${bars}` : ''}
${sent}
<footer>${t('sec.tanalytics.rptFooter', 'Сгенерировано в TrendTraffic · данные Trend. Всего комментариев в выборке: {{n}}.', { n: r.normalized.comments.length })}</footer>
</div></body></html>`;
}

interface BulkRow { url: string; cover?: string; platform?: string; type?: string; summary: Record<string, any>; error?: string }

export default function TrendAnalyticsPanel({ token, initialUrl, initialCover, bulkItems, hideSearch }: { token: string | null; initialUrl?: string | null; initialCover?: string | null; bulkItems?: { url: string; cover?: string }[] | null; hideSearch?: boolean }) {
  const { t } = useTranslation('common');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[] | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [cardCover, setCardCover] = useState<string | null>(null); // обложка, переданная с карточки тренда (грузится надёжно)
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentErr, setSentErr] = useState<string | null>(null);
  // Разбор вирусности (ИИ): авто-запуск в фоне после анализа видео + крутилка.
  const [breakdown, setBreakdown] = useState<TrendDNA | null>(null);
  const [bdLoading, setBdLoading] = useState(false);
  const [bdError, setBdError] = useState<string | null>(null);
  const bdReqRef = useRef(0); // токен запроса: применяем только результат последнего анализа
  // Разбор собирается на английском (в таком виде уходит в работу/TrendFlow), а показываем
  // его на языке интерфейса: перевод стартует автоматически сразу после сборки. Кнопка
  // рядом с заголовком переключает показ обратно на оригинал (EN) и назад.
  const [bdTranslated, setBdTranslated] = useState<TrendDNA | null>(null);
  const [bdShowLang, setBdShowLang] = useState<string>('en');
  const [bdTranslating, setBdTranslating] = useState(false);

  // Один путь перевода для авто-показа и для кнопки.
  const fetchTranslated = async (dna: TrendDNA, lang: string): Promise<TrendDNA> => {
    const res = await fetch('/api/trends/analyze/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ dna, lang }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data.dna as TrendDNA;
  };

  const analyze = async (override?: string) => {
    const u = (override ?? url).trim();
    if (!u) { setError(t('sec.tanalytics.urlRequired', 'Вставьте ссылку на видео/пост или аккаунт.')); return; }
    // YouTube: аналитика отключена — площадка доступна только для поиска трендов.
    if (/(?:youtube\.com|youtu\.be)/i.test(u)) {
      setLoading(false); setResult(null);
      setError(t('sec.tanalytics.ytOff', 'Анализ YouTube недоступен — YouTube доступен только для поиска трендов.'));
      return;
    }
    setLoading(true); setError(null); setResult(null); setSentiment(null); setSentErr(null); setSaved(false);
    try {
      const res = await fetch('/api/trends/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (e: any) {
      setError(e instanceof TypeError ? t('sec.tanalytics.serverDown', 'Сервер недоступен. Обновите страницу.') : (e?.message || t('sec.tanalytics.analyzeErr', 'Ошибка анализа')));
    } finally { setLoading(false); }
  };

  // Разбор вирусности (ИИ): дёргаем /analyze/breakdown по уже собранным данным (без повторного TikHub).
  const runBreakdown = async (r: AnalyzeResult, srcUrl: string) => {
    const myReq = ++bdReqRef.current;
    setBdLoading(true); setBdError(null); setBreakdown(null);
    setBdTranslated(null); setBdShowLang('en'); // новый разбор — сбрасываем перевод
    let dna: TrendDNA | null = null;
    try {
      const res = await fetch('/api/trends/analyze/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        // Разбор всегда на английском (идёт дальше в работу на EN); save=1 → карточка в «Тренды → Анализ».
        body: JSON.stringify({ summary: r.summary, comments: r.normalized.comments, keywords: r.normalized.keywords, platform: r.detected.platform, url: srcUrl || undefined, externalId: r.detected.videoId, save: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      dna = (data.dna as TrendDNA) || null;
    } catch (e: any) {
      if (bdReqRef.current === myReq) { setBdError(e instanceof TypeError ? t('sec.tanalytics.serverDownShort', 'Сервер недоступен.') : (e?.message || t('sec.tanalytics.bdFailed', 'Не удалось собрать разбор'))); setBdLoading(false); }
      return;
    }

    // Автоперевод на язык интерфейса — пользователь сразу видит разбор на своём языке.
    // Крутилку держим до конца перевода и показываем результат ОДНИМ состоянием, иначе
    // на секунду мелькает английский оригинал. Сбой перевода не ломает разбор: остаётся EN.
    const target = analysisLang();
    let translated: TrendDNA | null = null;
    if (dna && target !== 'en' && bdReqRef.current === myReq) {
      try { translated = await fetchTranslated(dna, target); } catch { /* тихо — покажем оригинал */ }
    }
    if (bdReqRef.current !== myReq) return;
    setBreakdown(dna);
    if (translated) { setBdTranslated(translated); setBdShowLang(target); }
    setBdLoading(false);
  };

  // Авто-запуск разбора в фоне, как только готов анализ ВИДЕО (без кнопки). Аккаунты — пропускаем.
  useEffect(() => {
    if (result && result.detected.type === 'video') runBreakdown(result, url);
    else { bdReqRef.current++; setBreakdown(null); setBdError(null); setBdLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Смена языка интерфейса → переводим уже показанный разбор на новый язык.
  // Сам разбор НЕ пересобираем (это лишний вызов ИИ) — только перевод текстов.
  useEffect(() => {
    const target = analysisLang();
    if (!breakdown) return;
    if (target === 'en') { setBdTranslated(null); setBdShowLang('en'); return; } // назад к оригиналу
    if (bdTranslated && bdShowLang === target) return; // уже переведено на текущий язык (сделал runBreakdown)
    let alive = true;
    const myReq = bdReqRef.current;
    setBdTranslating(true);
    fetchTranslated(breakdown, target)
      .then((tr) => { if (alive && bdReqRef.current === myReq) { setBdTranslated(tr); setBdShowLang(target); } })
      .catch(() => { /* остаётся текущий показ */ })
      .finally(() => { if (alive) setBdTranslating(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language, breakdown]);
  // Клик «Аналитика» на карточке тренда → подставить ссылку (+ обложку) и сразу запустить анализ.
  useEffect(() => {
    if (initialUrl && initialUrl.trim()) { setUrl(initialUrl); setCardCover(initialCover || null); setBulkRows(null); analyze(initialUrl); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl, initialCover]);

  // «Анализировать выбранные» → список сводок по всем выбранным видео.
  useEffect(() => {
    if (!bulkItems || bulkItems.length === 0) return;
    setResult(null); setError(null); setBulkLoading(true); setBulkRows(null);
    (async () => {
      try {
        const res = await fetch('/api/trends/analyze/bulk', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ urls: bulkItems.map((i) => i.url) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        const coverByUrl = new Map(bulkItems.map((i) => [i.url, i.cover]));
        setBulkRows((data.rows || []).map((r: BulkRow) => ({ ...r, cover: r.cover || coverByUrl.get(r.url) })));
      } catch (e: any) { setError(e?.message || t('sec.tanalytics.bulkErr', 'Ошибка массового анализа')); }
      finally { setBulkLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkItems]);

  // Открыть полную аналитику одной строки из списка.
  const openOne = (u: string, cover?: string) => { setUrl(u); setCardCover(cover || null); analyze(u); };

  // Скачать проанализированное видео в Галерею (как «Скачать» в трендах).
  const saveToGallery = async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/trends/analyze/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSaved(true);
    } catch (e: any) { setError(e?.message || t('sec.tanalytics.saveFailed', 'Не удалось скачать в Галерею')); }
    finally { setSaving(false); }
  };

  const comments = result?.normalized?.comments || [];
  const words = useMemo(() => wordFreq(comments.map((c) => c.text), 30), [comments]);
  const topComments = useMemo(() => [...comments].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 8), [comments]);

  const runSentiment = async () => {
    if (!comments.length) return;
    setSentLoading(true); setSentErr(null);
    try {
      const res = await fetch('/api/trends/analyze/sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ comments: comments.map((c) => c.text), lang: analysisLang() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSentiment(data);
    } catch (e: any) { setSentErr(e?.message || t('sec.tanalytics.sentimentErr', 'Ошибка анализа тональности')); }
    finally { setSentLoading(false); }
  };

  const baseName = result ? `${result.detected.platform}-${result.detected.videoId || result.detected.username || 'data'}` : 'data';
  const exportJson = () => result && downloadFile(`analytics-${baseName}.json`, JSON.stringify(result, null, 2), 'application/json');
  const exportCsv = () => comments.length && downloadFile(`comments-${baseName}.csv`, commentsCsv(comments), 'text/csv;charset=utf-8');
  const exportReport = () => result && downloadFile(`report-${baseName}.html`, buildReportHtml(result, words, sentiment), 'text/html;charset=utf-8');

  const fmtDate = (ts?: number) => { if (!ts) return ''; const ms = ts > 1e12 ? ts : ts * 1000; try { return new Date(ms).toLocaleDateString(i18n.language || 'ru'); } catch { return ''; } };
  const fmtDur = (sec?: number) => { if (!sec) return ''; const x = sec > 1000 ? Math.round(sec / 1000) : Math.round(sec); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };

  const s = result?.summary || {};
  const coverSrc = cardCover || s.cover;
  const isVideo = result?.detected.type === 'video';
  // Разбор ВСЕГДА собирается на английском; «Перевести» переключает показ на язык браузера.
  const bdTarget = analysisLang(); // 'en' | 'ru' — язык кнопки «Перевести»
  const shownBreakdown: TrendDNA | null = bdShowLang === 'en' ? breakdown : (bdTranslated || breakdown);
  // Подписи разбора: EN — вместе с оригиналом разбора, иначе — язык интерфейса
  // (в точках вызова ru-аргумент передаётся уже через t('sec…', 'ру-фолбэк')).
  const L = (ru: string, en: string) => (bdShowLang === 'en' ? en : ru);
  const translateBreakdown = async () => {
    if (!breakdown) return;
    if (bdShowLang !== 'en') { setBdShowLang('en'); return; }         // назад к оригиналу (EN)
    if (bdTranslated) { setBdShowLang(bdTarget); return; }             // уже переведено — просто показать
    setBdTranslating(true); setBdError(null);
    try {
      setBdTranslated(await fetchTranslated(breakdown, bdTarget)); setBdShowLang(bdTarget);
    } catch (e: any) { setBdError(e?.message || t('sec.tanalytics.translateFailed', 'Не удалось перевести')); }
    finally { setBdTranslating(false); }
  };
  const stat = (icon: React.ReactNode, label: string, val?: number) => (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)' }}>
      <div className="flex items-center gap-1.5 text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{icon} {label}</div>
      <div className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{fmt(val)}</div>
    </div>
  );

  // Блоки разбора вирусности (ИИ): подпись + абзац / маркированный список.
  const bdField = (label: string, text?: string) => (text ? (
    <div>
      <div className="text-[11px] font-700 mb-0.5" style={{ color: 'var(--brand)' }}>{label}</div>
      <p className="text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{text}</p>
    </div>
  ) : null);
  const bdList = (label: string, items?: string[]) => (items && items.length ? (
    <div>
      <div className="text-[11px] font-700 mb-1" style={{ color: 'var(--brand)' }}>{label}</div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[13px] leading-snug flex gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--brand)' }}>•</span><span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null);

  return (
    <div className="space-y-5">
      {/* hideSearch (встроено в «Тренды» для X): поле URL ведёт родитель; тут только ошибка + результат */}
      {hideSearch && (loading || error) && (
        <div className="flex items-center gap-2 text-sm rounded-xl p-3" style={{ background: error ? 'rgba(239,68,68,0.08)' : 'var(--bg-tertiary)', color: error ? '#ef4444' : 'var(--text-muted)' }}>
          {loading ? <><Loader2 size={16} className="animate-spin flex-shrink-0" /><span>{t('sec.tanalytics.analyzing', 'Анализирую…')}</span></> : <><XCircle size={16} className="flex-shrink-0" /><span>{error}</span></>}
        </div>
      )}
      {!hideSearch && (
      <AuroraCard className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <Link2 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') analyze(); }}
              placeholder={t('sec.tanalytics.urlPh', 'Ссылка: TikTok / Instagram / X / Reddit / Douyin / Bilibili — видео или аккаунт')}
              className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </div>
          <AuroraButton onClick={() => { setCardCover(null); analyze(); }} disabled={loading} fullWidth className="sm:!w-auto"
            icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {loading ? t('sec.tanalytics.analyzing', 'Анализирую…') : t('sec.tanalytics.analyzeBtn', 'Анализировать')}
          </AuroraButton>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {t('sec.tanalytics.keyHint', 'Метрики видео, комментарии, профиль и история публикаций — данные сервиса Trend. Каждый анализ тратит кредиты Trend (ваш ключ из настроек Enterprise, если задан).')}
        </p>
        {error && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <XCircle size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
          </div>
        )}
      </AuroraCard>
      )}

      {/* Массовый анализ выбранных — список */}
      {bulkLoading && (
        <div className="flex items-center justify-center gap-2 py-8" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> {t('sec.tanalytics.bulkAnalyzing', 'Анализирую выбранные…')}
        </div>
      )}
      {!result && bulkRows && (
        <>
          <div className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.tanalytics.bulkTitle', 'Анализ выбранных: {{n}}', { n: bulkRows.length })}</div>
          <div className="space-y-2">
            {bulkRows.map((r, i) => {
              const s = r.summary || {};
              return (
                <AuroraCard key={i} className="p-3 flex items-center gap-3">
                  <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 56, height: 56, background: 'var(--bg-tertiary)' }}>
                    {(r.cover || s.cover) ? <img src={r.cover || s.cover} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-600 truncate" style={{ color: 'var(--text-primary)' }}>{s.author || r.platform || '—'}</div>
                    {s.desc && <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{String(s.desc)}</div>}
                    <div className="flex items-center gap-2.5 text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-flex items-center gap-0.5"><Eye size={11} /> {fmt(s.views)}</span>
                      <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {fmt(s.likes)}</span>
                      <span className="inline-flex items-center gap-0.5"><MessageCircle size={11} /> {fmt(s.comments)}</span>
                      {s.engagementRate != null && <span style={{ color: '#10b981' }}>{s.engagementRate}% ER</span>}
                      {r.error && <span style={{ color: '#ef4444' }}>{r.error}</span>}
                    </div>
                  </div>
                  <AuroraButton size="sm" variant="secondary" onClick={() => openOne(r.url, r.cover)} icon={<BarChart3 size={14} />}>{t('sec.tanalytics.moreBtn', 'Подробно')}</AuroraButton>
                </AuroraCard>
              );
            })}
          </div>
        </>
      )}

      {result && (
        <>
          {bulkRows && (
            <button onClick={() => setResult(null)} className="inline-flex items-center gap-1.5 text-[12px] font-600" style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              {t('sec.tanalytics.backToList', '← К списку выбранных ({{n}})', { n: bulkRows.length })}
            </button>
          )}
          {/* Распознано */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-700 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--brand)' }}>
              {result.detected.platformLabel}
            </span>
            <span className="text-[12px] px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {result.detected.type === 'video' ? t('sec.tanalytics.videoPost', 'Видео / пост') : t('sec.tanalytics.account', 'Аккаунт')}
            </span>
            {s.author && <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>· {String(s.author)}</span>}
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <AuroraButton variant="secondary" size="sm" onClick={exportReport} icon={<FileText size={14} />}>{t('sec.tanalytics.reportBtn', 'Отчёт HTML')}</AuroraButton>
              {comments.length > 0 && <AuroraButton variant="secondary" size="sm" onClick={exportCsv} icon={<FileSpreadsheet size={14} />}>CSV</AuroraButton>}
              <AuroraButton variant="secondary" size="sm" onClick={exportJson} icon={<Download size={14} />}>JSON</AuroraButton>
            </div>
          </div>

          {/* Карточка поста / профиля */}
          <AuroraCard className="p-4">
            <div className="flex gap-4">
              {coverSrc && (
                <a href={url || undefined} target="_blank" rel="noreferrer" className="flex-shrink-0 block rounded-xl overflow-hidden" style={{ width: 92 }}>
                  <img src={coverSrc} alt="" referrerPolicy="no-referrer" loading="lazy"
                    className="w-full object-cover" style={{ aspectRatio: '9 / 16', background: 'var(--bg-tertiary)' }}
                    onError={(e) => { const p = (e.currentTarget.parentElement as HTMLElement); if (p) p.style.display = 'none'; }} />
                </a>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  {s.avatar && <img src={s.avatar} referrerPolicy="no-referrer" alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                  <div className="min-w-0">
                    <div className="text-sm font-700 truncate inline-flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                      {s.author || s.handle || '—'}{s.verified && <BadgeCheck size={14} style={{ color: '#3b82f6' }} />}
                    </div>
                    {s.handle && <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>@{String(s.handle)}</div>}
                  </div>
                  <div className="flex-1" />
                  {/* Скачивание в Галерею: TikTok (no-watermark) и X (mp4-вариант твита).
                      YouTube отключён (ненадёжная подпись потоков). Для остальных — скрыто. */}
                  {isVideo && ['tiktok', 'twitter'].includes(result.detected.platform) && (
                    <button onClick={saveToGallery} disabled={saving || saved} title={t('sec.tanalytics.saveTitle', 'Скачать видео в Галерею')}
                      className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-600 px-2 py-1 rounded-lg disabled:opacity-60"
                      style={{ background: saved ? 'rgba(16,185,129,0.15)' : 'var(--brand)', color: saved ? '#10b981' : 'var(--brand-contrast)', border: 'none', cursor: saving || saved ? 'default' : 'pointer' }}>
                      {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12} /> : <Download size={12} />}
                      {saving ? t('sec.tanalytics.savingBtn', 'Скачиваю…') : saved ? t('sec.tanalytics.savedBtn', 'В Галерее') : t('sec.tanalytics.saveBtn', 'Скачать')}
                    </button>
                  )}
                  <a href={url || undefined} target="_blank" rel="noreferrer" className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><ExternalLink size={12} /> {t('sec.tanalytics.openBtn', 'Открыть')}</a>
                </div>
                {s.desc && <p className="text-[13px] leading-snug mb-1.5" style={{ color: 'var(--text-secondary)' }}>{String(s.desc)}</p>}
                {Array.isArray(s.hashtags) && s.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1.5">{s.hashtags.map((h: string, i: number) => <span key={i} className="text-[11px] font-600" style={{ color: 'var(--brand)' }}>{h}</span>)}</div>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {s.music && <span className="inline-flex items-center gap-1 min-w-0"><Music2 size={11} /><span className="truncate" style={{ maxWidth: 160 }}>{String(s.music)}</span></span>}
                  {fmtDur(s.duration) && <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmtDur(s.duration)}</span>}
                  {fmtDate(s.createTime) && <span>{fmtDate(s.createTime)}</span>}
                  {s.region && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {String(s.region)}</span>}
                </div>
              </div>
            </div>
          </AuroraCard>

          {/* Метрики */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {stat(<Eye size={12} />, t('sec.tanalytics.views', 'Просмотры'), s.views)}
            {stat(<Heart size={12} />, t('sec.tanalytics.likes', 'Лайки'), s.likes)}
            {stat(<MessageCircle size={12} />, t('sec.tanalytics.commentsShort', 'Комменты'), s.comments)}
            {stat(<Share2 size={12} />, t('sec.tanalytics.sharesShort', 'Шеры'), s.shares)}
            {result.detected.type === 'account'
              ? stat(<Users size={12} />, t('sec.tanalytics.followers', 'Подписчики'), s.followers)
              : (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-1.5 text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}><BarChart3 size={12} /> {t('sec.tanalytics.engagement', 'Вовлечённость')}</div>
                  <div className="text-lg font-700" style={{ color: '#10b981' }}>{s.engagementRate != null ? `${s.engagementRate}%` : '—'}</div>
                </div>
              )}
          </div>

          {/* Разбор вирусности (ИИ): Viral Breakdown + Контент-анализ — авто-запуск в фоне, крутилка пока не готово */}
          {isVideo && (bdLoading || bdError || breakdown) && (
            <AuroraCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles size={16} style={{ color: 'var(--brand)' }} />
                <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{L(t('sec.tanalytics.bdTitleAi', 'Разбор вирусности (ИИ)'), 'Virality breakdown (AI)')}</span>
                {bdLoading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--brand)' }} />}
                <div className="flex-1" />
                {/* «Перевести»: разбор всегда EN → перевод на язык браузера по клику (для RU-браузера) */}
                {!bdLoading && breakdown && bdTarget !== 'en' && (
                  <button onClick={translateBreakdown} disabled={bdTranslating} title={t('sec.tanalytics.translateTitle', 'Перевести разбор на язык браузера')}
                    className="inline-flex items-center gap-1 text-[11px] font-600 px-2 py-1 rounded-lg disabled:opacity-50"
                    style={{ background: bdShowLang === 'en' ? 'rgba(99,102,241,0.12)' : 'var(--bg-tertiary)', color: bdShowLang === 'en' ? 'var(--brand)' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                    {bdTranslating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={12} />}
                    {bdShowLang === 'en' ? t('sec.tanalytics.translateBtn', 'Перевести') : t('sec.tanalytics.translateOrig', 'Оригинал (EN)')}
                  </button>
                )}
                {!bdLoading && (bdError || breakdown) && (
                  <button onClick={() => runBreakdown(result, url)} className="inline-flex items-center gap-1 text-[11px] font-600 px-2 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                    <RotateCw size={12} /> {L(t('sec.tanalytics.bdRegen', 'Пересобрать'), 'Regenerate')}
                  </button>
                )}
              </div>

              {bdLoading && !breakdown && (
                <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 size={14} className="animate-spin flex-shrink-0" />
                  {L(t('sec.tanalytics.bdBuilding', 'Собираю разбор: хук, аудитория, сценарий озвучки, сцены, как повторить…'), 'Building the breakdown: hook, audience, voiceover script, scenes, how to replicate…')}
                </div>
              )}

              {bdError && !bdLoading && (
                <div className="flex items-start gap-2 text-[12px] rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                  <XCircle size={14} className="mt-[2px] flex-shrink-0" /><span>{bdError}</span>
                </div>
              )}

              {shownBreakdown && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Viral Breakdown */}
                  <div className="rounded-xl p-3.5 space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="inline-flex items-center gap-1.5 text-[12px] font-700" style={{ color: 'var(--text-primary)' }}><Flame size={14} style={{ color: 'var(--brand)' }} /> {L(t('sec.tanalytics.bdViral', 'Разбор вирусности'), 'Virality breakdown')}</div>
                    {bdField(L(t('sec.tanalytics.bdHook', 'Хук'), 'Hook') + (shownBreakdown.hookType ? ` · ${shownBreakdown.hookType}` : ''), shownBreakdown.whyItWorks)}
                    {bdField(L(t('sec.tanalytics.bdAudience', 'Целевая аудитория'), 'Target audience'), shownBreakdown.targetAudience)}
                    {bdList(L(t('sec.tanalytics.bdFactors', 'Факторы вирусности'), 'Virality factors'), shownBreakdown.viralFactors)}
                    {shownBreakdown.copyReadyScript && (
                      <div>
                        <div className="text-[11px] font-700 mb-1" style={{ color: 'var(--brand)' }}>{L(t('sec.tanalytics.bdScript', 'Готовый скрипт озвучки'), 'Ready voiceover script')}</div>
                        <p className="text-[13px] leading-snug rounded-lg p-2.5" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{shownBreakdown.copyReadyScript}</p>
                      </div>
                    )}
                    {bdList(L(t('sec.tanalytics.bdAdapt', 'Как адаптировать под нас'), 'How to adapt for us'), shownBreakdown.howToAdapt)}
                  </div>

                  {/* Video Content Analysis */}
                  <div className="rounded-xl p-3.5 space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="inline-flex items-center gap-1.5 text-[12px] font-700" style={{ color: 'var(--text-primary)' }}><Film size={14} style={{ color: 'var(--brand)' }} /> {L(t('sec.tanalytics.bdContent', 'Контент-анализ'), 'Content analysis')}</div>
                    {bdField(L(t('sec.tanalytics.bdSummary', 'Кратко о видео'), 'Video summary'), shownBreakdown.summary)}
                    {bdField(L(t('sec.tanalytics.bdFirstSec', 'Разбор первых секунд'), 'First seconds breakdown'), shownBreakdown.hookAnalysis)}
                    {bdField(L(t('sec.tanalytics.bdVisual', 'Визуальный стиль'), 'Visual style'), shownBreakdown.visualStyle)}
                    {bdField(L(t('sec.tanalytics.bdAudio', 'Звук и подача'), 'Audio & delivery'), shownBreakdown.audioDialogue)}
                    {shownBreakdown.sceneBeats && shownBreakdown.sceneBeats.length > 0 && (
                      <div>
                        <div className="text-[11px] font-700 mb-1" style={{ color: 'var(--brand)' }}>{L(t('sec.tanalytics.bdScenes', 'Сцены'), 'Scenes')}</div>
                        <div className="space-y-1">
                          {shownBreakdown.sceneBeats.map((b, i) => (
                            <div key={i} className="flex gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                              <span className="font-700 tabular-nums flex-shrink-0" style={{ color: 'var(--brand)' }}>{fmtDur(b.t) || t('sec.tanalytics.secShort', '{{s}}с', { s: b.t })}</span>
                              <span>{b.desc}{b.intensity ? <span style={{ color: 'var(--text-muted)' }}> · {b.intensity}</span> : null}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {bdList(L(t('sec.tanalytics.bdResonates', 'Почему резонирует'), 'Why it resonates'), shownBreakdown.whyResonates)}
                    {bdList(L(t('sec.tanalytics.bdReplicate', 'Как повторить'), 'How to replicate'), shownBreakdown.howToReplicate)}
                  </div>
                </div>
              )}
            </AuroraCard>
          )}

          {/* Ключевые слова (аналитика Trend) */}
          {result.normalized.keywords.length > 0 && (
            <div>
              <div className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>{t('sec.tanalytics.keywords', 'Ключевые слова')}</div>
              <div className="flex flex-wrap gap-1.5">
                {result.normalized.keywords.map((k, i) => (
                  <span key={i} className="text-[12px] px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{k.word}{k.count ? ` ·${k.count}` : ''}</span>
                ))}
              </div>
            </div>
          )}

          {/* Облако слов + тональность + топ-комментарии */}
          {comments.length > 0 && (
            <AuroraCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.tanalytics.commentsCount', 'Комментарии · {{n}}', { n: comments.length })}</span>
                <AuroraButton size="sm" onClick={runSentiment} disabled={sentLoading}
                  icon={sentLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
                  {sentLoading ? t('sec.tanalytics.analyzing', 'Анализирую…') : t('sec.tanalytics.sentimentAi', 'Тональность (ИИ)')}
                </AuroraButton>
              </div>

              {words.length > 0 && (
                <div>
                  <div className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>{t('sec.tanalytics.cloud', 'Облако слов')}</div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 items-baseline">
                    {words.map((w) => {
                      const sz = 11 + Math.round((w.count / (words[0]?.count || 1)) * 16);
                      return <span key={w.word} title={`${w.count}`} style={{ fontSize: sz, fontWeight: 700, color: 'var(--brand)', opacity: 0.55 + (w.count / (words[0]?.count || 1)) * 0.45 }}>{w.word}</span>;
                    })}
                  </div>
                </div>
              )}

              {sentErr && <div className="text-[12px]" style={{ color: '#ef4444' }}>{sentErr}</div>}
              {sentiment && (
                <div className="space-y-2">
                  <div className="flex h-6 rounded-lg overflow-hidden text-[10px] font-700" style={{ color: '#fff' }}>
                    {sentiment.positive > 0 && <div className="flex items-center justify-center" style={{ width: `${sentiment.positive}%`, background: '#10b981' }}>{sentiment.positive}%</div>}
                    {sentiment.neutral > 0 && <div className="flex items-center justify-center" style={{ width: `${sentiment.neutral}%`, background: '#94a3b8' }}>{sentiment.neutral}%</div>}
                    {sentiment.negative > 0 && <div className="flex items-center justify-center" style={{ width: `${sentiment.negative}%`, background: '#ef4444' }}>{sentiment.negative}%</div>}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('sec.tanalytics.sentLegend', 'Позитив · Нейтрально · Негатив')}</div>
                  {sentiment.overall && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{sentiment.overall}</p>}
                  {sentiment.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sentiment.themes.map((t2, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{t2}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>{t('sec.tanalytics.topComments', 'Топ-комментарии по лайкам')}</div>
                <div className="space-y-1.5">
                  {topComments.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-0.5 flex-shrink-0 font-700" style={{ color: 'var(--brand)' }}><Heart size={11} /> {fmt(c.likes)}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{c.text}{c.author ? <span style={{ color: 'var(--text-muted)' }}> — {c.author}</span> : null}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AuroraCard>
          )}

          {/* Если какой-то источник не ответил — компактная заметка (без сырого JSON) */}
          {Object.entries(result.blocks).some(([, b]) => !b.ok) && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {t('sec.tanalytics.blocksFailed', 'Не загрузилось: {{list}}. Полные данные — кнопкой «JSON».', {
                list: Object.entries(result.blocks).filter(([, b]) => !b.ok).map(([k]) => blockLabel(k)).join(', '),
              })}
            </p>
          )}

          {/* Диагностика: структура ответа (имена полей + типы, без значений) */}
          {result.debug && (
            <details className="text-[11px]">
              <summary className="inline-flex items-center gap-1.5 cursor-pointer select-none font-600" style={{ color: 'var(--text-muted)' }}>
                {t('sec.tanalytics.debugSummary', '🔧 Структура ответа (для разработчика)')}
              </summary>
              <pre className="mt-2 p-3 rounded-lg overflow-auto" style={{ maxHeight: 360, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {JSON.stringify(result.debug, null, 1)}
              </pre>
              <p className="mt-1" style={{ color: 'var(--text-muted)' }}>{t('sec.tanalytics.debugHint', 'Скопируйте и пришлите — точно настрою извлечение полей этой площадки.')}</p>
            </details>
          )}
        </>
      )}
    </div>
  );
}
