/**
 * TrendAnalyticsPanel — «Аналитика по ссылке» (порт расширения TikHub в веб).
 *
 * Вставляешь ссылку на видео/пост или аккаунт (TikTok/Douyin/Instagram/X/Bilibili)
 * → backend (/api/trends/analyze) дёргает TikHub НАШИМ ключом → показываем сводку
 * (просмотры/лайки/комменты/шеры + ER), статусы вызовов и сырые данные с экспортом JSON.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Link2, Loader2, Search, Download, CheckCircle2, XCircle, Eye, Heart, MessageCircle, Share2, Users, BarChart3, Sparkles, FileText, FileSpreadsheet, Music2, Clock, MapPin, BadgeCheck, ExternalLink } from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { AuroraButton } from '../components/AuroraButton';

interface Block { ok: boolean; error?: string; data?: any; }
interface NormComment { author?: string; text: string; likes?: number; replies?: number; }
interface AnalyzeResult {
  detected: { platform: string; platformLabel: string; type: 'video' | 'account'; videoId?: string; username?: string };
  blocks: Record<string, Block>;
  summary: Record<string, any>;
  normalized: { comments: NormComment[]; posts: any[]; keywords: { word: string; count?: number }[] };
}
interface Sentiment {
  positive: number; negative: number; neutral: number;
  overall: string; themes: string[]; topPositive: string[]; topNegative: string[];
}

function fmt(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

const BLOCK_LABEL: Record<string, string> = {
  video: 'Видео / пост', metrics: 'Метрики', comments: 'Комментарии',
  commentKeywords: 'Ключевые слова', account: 'Аккаунт', posts: 'Лента публикаций',
};

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
function buildReportHtml(r: AnalyzeResult, words: { word: string; count: number }[], sentiment: Sentiment | null): string {
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
  const stat = (l: string, v: any) => `<div class="card"><div class="lbl">${l}</div><div class="val">${v == null ? '—' : esc(typeof v === 'number' ? v.toLocaleString('ru') : v)}</div></div>`;
  const sent = sentiment ? `
    <h2>Тональность (ИИ)</h2>
    <div class="sent"><span style="background:#10b981;width:${sentiment.positive}%">${sentiment.positive}%</span><span style="background:#94a3b8;width:${sentiment.neutral}%">${sentiment.neutral}%</span><span style="background:#ef4444;width:${sentiment.negative}%">${sentiment.negative}%</span></div>
    <p class="muted">Позитив · Нейтрально · Негатив</p>
    <p>${esc(sentiment.overall)}</p>
    ${sentiment.themes.length ? `<p><b>Темы:</b> ${sentiment.themes.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</p>` : ''}
  ` : '';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Отчёт · ${esc(r.detected.platformLabel)} · TrendTraffic</title>
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
<header><div class="logo">TT</div><div><h1>Отчёт о трендах — ${esc(r.detected.platformLabel)}</h1>
<div class="muted">${r.detected.type === 'video' ? 'Видео / пост' : 'Аккаунт'}${s.author ? ` · ${esc(s.author)}` : ''}</div></div></header>
${s.desc ? `<p>${esc(s.desc)}</p>` : ''}
<h2>Обзор</h2>
<div class="grid">${stat('Просмотры', s.views)}${stat('Лайки', s.likes)}${stat('Комментарии', s.comments)}${stat('Репосты', s.shares)}${r.detected.type === 'account' ? stat('Подписчики', s.followers) : stat('Вовлечённость', s.engagementRate != null ? s.engagementRate + '%' : '—')}</div>
${words.length ? `<h2>Облако слов в комментариях</h2><div class="cloud">${cloud}</div>` : ''}
${bars ? `<h2>Распределение лайков · топ-комментарии</h2>${bars}` : ''}
${sent}
<footer>Сгенерировано в TrendTraffic · данные Trend. Всего комментариев в выборке: ${r.normalized.comments.length}.</footer>
</div></body></html>`;
}

export default function TrendAnalyticsPanel({ token, initialUrl, initialCover }: { token: string | null; initialUrl?: string | null; initialCover?: string | null }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [cardCover, setCardCover] = useState<string | null>(null); // обложка, переданная с карточки тренда (грузится надёжно)
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentErr, setSentErr] = useState<string | null>(null);

  const analyze = async (override?: string) => {
    const u = (override ?? url).trim();
    if (!u) { setError('Вставьте ссылку на видео/пост или аккаунт.'); return; }
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
      setError(e instanceof TypeError ? 'Сервер недоступен. Обновите страницу.' : (e?.message || 'Ошибка анализа'));
    } finally { setLoading(false); }
  };

  // Клик «Аналитика» на карточке тренда → подставить ссылку (+ обложку) и сразу запустить анализ.
  useEffect(() => {
    if (initialUrl && initialUrl.trim()) { setUrl(initialUrl); setCardCover(initialCover || null); analyze(initialUrl); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl, initialCover]);

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
    } catch (e: any) { setError(e?.message || 'Не удалось скачать в Галерею'); }
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
        body: JSON.stringify({ comments: comments.map((c) => c.text) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSentiment(data);
    } catch (e: any) { setSentErr(e?.message || 'Ошибка анализа тональности'); }
    finally { setSentLoading(false); }
  };

  const baseName = result ? `${result.detected.platform}-${result.detected.videoId || result.detected.username || 'data'}` : 'data';
  const exportJson = () => result && downloadFile(`analytics-${baseName}.json`, JSON.stringify(result, null, 2), 'application/json');
  const exportCsv = () => comments.length && downloadFile(`comments-${baseName}.csv`, commentsCsv(comments), 'text/csv;charset=utf-8');
  const exportReport = () => result && downloadFile(`report-${baseName}.html`, buildReportHtml(result, words, sentiment), 'text/html;charset=utf-8');

  const fmtDate = (ts?: number) => { if (!ts) return ''; const ms = ts > 1e12 ? ts : ts * 1000; try { return new Date(ms).toLocaleDateString('ru'); } catch { return ''; } };
  const fmtDur = (sec?: number) => { if (!sec) return ''; const x = sec > 1000 ? Math.round(sec / 1000) : Math.round(sec); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };

  const s = result?.summary || {};
  const coverSrc = cardCover || s.cover;
  const isVideo = result?.detected.type === 'video';
  const stat = (icon: React.ReactNode, label: string, val?: number) => (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)' }}>
      <div className="flex items-center gap-1.5 text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{icon} {label}</div>
      <div className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>{fmt(val)}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <AuroraCard className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex-1 relative">
            <Link2 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') analyze(); }}
              placeholder="Ссылка: TikTok / Douyin / Instagram / X / Bilibili — видео или аккаунт"
              className="w-full pl-11 pr-3 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7300]/40"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
          </div>
          <AuroraButton onClick={() => { setCardCover(null); analyze(); }} disabled={loading} fullWidth className="sm:!w-auto"
            icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}>
            {loading ? 'Анализирую…' : 'Анализировать'}
          </AuroraButton>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Метрики видео, комментарии, профиль и история публикаций — через ваш ключ Trend. Каждый анализ тратит кредиты Trend.
        </p>
        {error && (
          <div className="flex items-start gap-2 text-sm rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
            <XCircle size={16} className="mt-[2px] flex-shrink-0" /><span>{error}</span>
          </div>
        )}
      </AuroraCard>

      {result && (
        <>
          {/* Распознано */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-700 px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,115,0,0.12)', color: '#ff7300' }}>
              {result.detected.platformLabel}
            </span>
            <span className="text-[12px] px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {result.detected.type === 'video' ? 'Видео / пост' : 'Аккаунт'}
            </span>
            {s.author && <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>· {String(s.author)}</span>}
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 flex-wrap">
              <AuroraButton variant="secondary" size="sm" onClick={exportReport} icon={<FileText size={14} />}>Отчёт HTML</AuroraButton>
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
                  {isVideo && (
                    <button onClick={saveToGallery} disabled={saving || saved} title="Скачать видео в Галерею"
                      className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-600 px-2 py-1 rounded-lg disabled:opacity-60"
                      style={{ background: saved ? 'rgba(16,185,129,0.15)' : 'var(--btn-primary-bg)', color: saved ? '#10b981' : '#ff7300', border: 'none', cursor: saving || saved ? 'default' : 'pointer' }}>
                      {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12} /> : <Download size={12} />}
                      {saving ? 'Скачиваю…' : saved ? 'В Галерее' : 'Скачать'}
                    </button>
                  )}
                  <a href={url || undefined} target="_blank" rel="noreferrer" className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><ExternalLink size={12} /> Открыть</a>
                </div>
                {s.desc && <p className="text-[13px] leading-snug mb-1.5" style={{ color: 'var(--text-secondary)' }}>{String(s.desc)}</p>}
                {Array.isArray(s.hashtags) && s.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1.5">{s.hashtags.map((h: string, i: number) => <span key={i} className="text-[11px] font-600" style={{ color: '#ff7300' }}>{h}</span>)}</div>
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
            {stat(<Eye size={12} />, 'Просмотры', s.views)}
            {stat(<Heart size={12} />, 'Лайки', s.likes)}
            {stat(<MessageCircle size={12} />, 'Комменты', s.comments)}
            {stat(<Share2 size={12} />, 'Шеры', s.shares)}
            {result.detected.type === 'account'
              ? stat(<Users size={12} />, 'Подписчики', s.followers)
              : (
                <div className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-center gap-1.5 text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}><BarChart3 size={12} /> Вовлечённость</div>
                  <div className="text-lg font-700" style={{ color: '#10b981' }}>{s.engagementRate != null ? `${s.engagementRate}%` : '—'}</div>
                </div>
              )}
          </div>

          {/* Ключевые слова (аналитика Trend) */}
          {result.normalized.keywords.length > 0 && (
            <div>
              <div className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>Ключевые слова</div>
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
                <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Комментарии · {comments.length}</span>
                <AuroraButton size="sm" onClick={runSentiment} disabled={sentLoading}
                  icon={sentLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
                  {sentLoading ? 'Анализирую…' : 'Тональность (ИИ)'}
                </AuroraButton>
              </div>

              {words.length > 0 && (
                <div>
                  <div className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>Облако слов</div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 items-baseline">
                    {words.map((w) => {
                      const sz = 11 + Math.round((w.count / (words[0]?.count || 1)) * 16);
                      return <span key={w.word} title={`${w.count}`} style={{ fontSize: sz, fontWeight: 700, color: '#ff7300', opacity: 0.55 + (w.count / (words[0]?.count || 1)) * 0.45 }}>{w.word}</span>;
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
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Позитив · Нейтрально · Негатив</div>
                  {sentiment.overall && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{sentiment.overall}</p>}
                  {sentiment.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sentiment.themes.map((t, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="text-[11px] font-600 mb-2" style={{ color: 'var(--text-muted)' }}>Топ-комментарии по лайкам</div>
                <div className="space-y-1.5">
                  {topComments.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-0.5 flex-shrink-0 font-700" style={{ color: '#ff7300' }}><Heart size={11} /> {fmt(c.likes)}</span>
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
              Не загрузилось: {Object.entries(result.blocks).filter(([, b]) => !b.ok).map(([k]) => BLOCK_LABEL[k] || k).join(', ')}. Полные данные — кнопкой «JSON».
            </p>
          )}
        </>
      )}
    </div>
  );
}
