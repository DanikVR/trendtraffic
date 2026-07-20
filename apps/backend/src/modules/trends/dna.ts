/**
 * TrendTraffic — «ДНК тренда» (TrendDNA): мост Аналитика → TrendFlow (Фаза 1).
 *
 * Из данных, которые мы извлекаем с трендового видео (summary + комментарии +
 * ключевые слова), Claude собирает структурный «рецепт успеха» — нативный аналог
 * Viral Breakdown + Video Content Analysis из расширения. Результат сохраняется
 * ВМЕСТЕ с видео в Галерее (таблица video_analyses), чтобы при загрузке источника
 * в TrendFlow поля автоматически разложились по блокам (Фаза 2).
 *
 * Слои файла:
 *   • TrendDNA            — канонический тип-рецепт (общий контракт двух сторон);
 *   • generateTrendDNA()  — генератор (Claude, мягкая деградация → бросает понятную ошибку);
 *   • save/get TrendDNA   — persistence (PostgreSQL; в fallback деградирует в null).
 *
 * Ключ Claude: resolveAnthropicKey (per-tenant → системный). Модель: DEFAULT_DIRECTOR_MODEL.
 * Анализ строится по ТЕКСТОВЫМ сигналам (описание/хэштеги/музыка/метрики/комментарии);
 * Scene Beats — обоснованная реконструкция (Фаза 3 уточнит транскриптом/кадрами).
 */

import { randomUUID } from 'crypto';
import pool from '../../db/index.js';
import { resolveAnthropicKey, DEFAULT_DIRECTOR_MODEL } from '../render/director.js';
import { cacheCoverToDisk, isExpiringCover } from '../media/store_cover.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';
import { fetchOneVideo, extractOneVideoCover, fetchInstagramPostInfo, extractInstagramCover } from '../tikhub/tikhub_client.js';
import type { NormComment } from './analytics.js';

export type BeatIntensity = 'low' | 'mid' | 'high';
export interface SceneBeat { t: number; desc: string; intensity?: BeatIntensity }

/** Сегмент дословной расшифровки речи (video_insight) — источник субтитров .srt. */
export interface TranscriptSegment { start: number; end: number; text: string }

/** Снимок детерминированных метаданных тренда (из analyze summary) — для блоков и отбора. */
export interface TrendMeta {
  platform?: string;
  author?: string;
  durationSec?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  favorites?: number;
  engagementRate?: number;
  music?: string;
  hashtags?: string[];
  cover?: string;
}

/** Технические метрики качества оригинала → таргеты блоков audio/color/upscale/export. */
export interface TrendQuality {
  lufs?: number;        // целевая громкость микса (audio loudnorm)
  brightness?: number;  // ориентир яркости (color)
  vqScore?: number;     // оценка качества видео
  originW?: number;
  originH?: number;
  needUpscale?: boolean; // низкий VQ / <1080p → включить апскейл
}

/** Бенчмарк тренда — цель, которую должно превзойти наше видео (обратная связь, Фаза 3). */
export interface TrendBenchmark {
  engagementRate?: number;
  likeRate?: number;
  saveRate?: number;
}

/**
 * Канонический объект-рецепт. ОДИН контракт для аналитики (производит) и
 * TrendFlow (потребляет — раскладывает по блокам в Фазе 2).
 */
export interface TrendDNA {
  // — Viral Breakdown —
  hookType: string;          // тип хука, напр. "Visual Curiosity"
  whyItWorks: string;
  targetAudience: string;
  viralFactors: string[];
  copyReadyScript: string;   // → блок «Озвучка» (voiceover.text)
  howToAdapt: string[];
  // — Video Content Analysis —
  summary: string;
  sceneBeats: SceneBeat[];   // → блоки «Длина» (нарезка) и «B-roll» (тайминг вставок)
  hookAnalysis: string;
  visualStyle: string;       // → блок «Цветокор» (mood)
  audioDialogue: string;     // → блок «Аудио» (стратегия звука)
  whyResonates: string[];
  howToReplicate: string[];
  // — Производные машинные подсказки для автозаполнения TrendFlow —
  keywords: string[];        // suggested searches + хэштеги + ключи комментариев → research/broll
  brief: string;             // скомпилированный мастер-сценарий → flow.graph.brief (идёт во ВСЕ блоки)
  // — Снимок метаданных —
  meta: TrendMeta;
  // — Технические таргеты и бенчмарк (Фаза 3) —
  quality?: TrendQuality;
  benchmark?: TrendBenchmark;
  // — Покадровый видеоанализ (video_insight.ts): если есть — sceneBeats РЕАЛЬНЫЕ —
  visual?: {
    framesAnalyzed: true;
    hookVisual?: string;      // что визуально происходит в первые 3 сек
    textOverlays?: string[];  // надписи в кадре по порядку
    cutsCount?: number;       // число монтажных склеек
    transcript?: TranscriptSegment[]; // дословная речь с таймкодами → субтитры .srt
    model?: string;
  };
  // — Происхождение —
  model: string;
  generatedAt: string;       // ISO
  sourceUrl?: string;
}

function num(v: any): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.+-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
const round2 = (n: number) => Math.round(n * 100) / 100;
function strArr(v: any, max: number, cap = 280): string[] {
  return Array.isArray(v)
    ? v.map((x) => String(x ?? '').trim()).filter(Boolean).map((s) => s.slice(0, cap)).slice(0, max)
    : [];
}
function parseJsonLoose(txt: string): any {
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/** Снимок метаданных из analyze summary. */
function metaFromSummary(summary: Record<string, any>, platform?: string): TrendMeta {
  const s = summary || {};
  return {
    platform: platform || (typeof s.platform === 'string' ? s.platform : undefined),
    author: typeof s.author === 'string' ? s.author : undefined,
    durationSec: num(s.duration),
    views: num(s.views), likes: num(s.likes), comments: num(s.comments), shares: num(s.shares),
    favorites: num(s.favorites),
    engagementRate: num(s.engagementRate),
    music: typeof s.music === 'string' ? s.music : undefined,
    hashtags: Array.isArray(s.hashtags) ? s.hashtags.map((h: any) => String(h)).slice(0, 12) : [],
    cover: typeof s.cover === 'string' ? s.cover : undefined,
  };
}

/** Технические таргеты из summary.quality (+ решение об апскейле). */
function qualityFromSummary(summary: Record<string, any>): TrendQuality {
  const q = (summary?.quality && typeof summary.quality === 'object') ? summary.quality as Record<string, number> : {};
  const out: TrendQuality = {
    lufs: num(q.lufs), brightness: num(q.brightness), vqScore: num(q.vqScore),
    originW: num(q.originW), originH: num(q.originH),
  };
  out.needUpscale = (out.vqScore != null && out.vqScore < 55) || (out.originH != null && out.originH < 1080);
  return out;
}
/** Бенчмарк-цель из метрик (доли от просмотров). */
function benchmarkFromMeta(m: TrendMeta): TrendBenchmark {
  const v = m.views;
  return {
    engagementRate: m.engagementRate,
    likeRate: v && m.likes != null ? round2(m.likes / v * 100) : undefined,
    saveRate: v && m.favorites != null ? round2(m.favorites / v * 100) : undefined,
  };
}

/** Объединяет хэштеги + ключи комментариев + ключи от ИИ → уникальный список. */
function mergeKeywords(meta: TrendMeta, commentKeywords: { word: string }[], llm: string[]): string[] {
  const out = new Set<string>();
  for (const h of meta.hashtags || []) { const w = h.replace(/^#/, '').trim(); if (w) out.add(w); }
  for (const k of commentKeywords || []) { const w = String(k?.word || '').trim(); if (w) out.add(w); }
  for (const w of llm || []) { const v = String(w || '').trim(); if (v) out.add(v); }
  return [...out].slice(0, 24);
}

/** Скомпилированный бриф — высший рычаг: инъектится в КАЖДЫЙ LLM-шаг рендера. */
function compileBrief(d: Omit<TrendDNA, 'brief' | 'model' | 'generatedAt'>): string {
  const tech: string[] = [];
  if (d.quality?.lufs != null) tech.push(`громкость ≈ ${d.quality.lufs} LUFS`);
  if (d.quality?.brightness != null) tech.push(`яркость ~${Math.round(d.quality.brightness)}/255`);
  if (d.quality?.originH) tech.push(`разрешение ≥ ${d.quality.originH}p`);
  const lines = [
    'Цель: воспроизвести вирусную формулу тренда на нашем материале (не копировать исходник).',
    d.hookType && `Хук: ${d.hookType}${d.whyItWorks ? ` — ${d.whyItWorks}` : ''}`,
    d.targetAudience && `Аудитория: ${d.targetAudience}`,
    d.viralFactors?.length && `Факторы успеха: ${d.viralFactors.join('; ')}`,
    d.visualStyle && `Визуальный стиль: ${d.visualStyle}`,
    d.audioDialogue && `Звук/подача: ${d.audioDialogue}`,
    d.howToAdapt?.length && `Адаптировать: ${d.howToAdapt.join('; ')}`,
    d.keywords?.length && `Ключевые слова: ${d.keywords.join(', ')}`,
    tech.length && `Технические цели: ${tech.join(', ')}`,
    d.benchmark?.engagementRate != null && `Цель по вовлечённости: превзойти ER тренда ${d.benchmark.engagementRate}%.`,
  ].filter(Boolean);
  return lines.join('\n').slice(0, 2200);
}

function commentText(c: string | NormComment): string {
  return typeof c === 'string' ? c : String(c?.text || '');
}

export interface GenerateDNAInput {
  summary: Record<string, any>;
  comments?: Array<string | NormComment>;
  keywords?: Array<{ word: string; count?: number }>;
  platform?: string;
  sourceUrl?: string;
  /** Язык отчёта (значений полей). 2-буквенный код (ru/en/…); по умолчанию ru.
   *  Пока используем ru/en, но модель понимает и другие — задел под 108 языков. */
  lang?: string;
}

// Имя языка для инструкции модели: ru → Russian. Intl.DisplayNames покрывает все 108
// локалей приложения без таблицы; неизвестный код уходит моделью как есть (она понимает BCP-47).
function dnaLangName(code: string): string {
  const c = (code || '').toLowerCase().slice(0, 2);
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(c) || c;
  } catch {
    return c;
  }
}

/**
 * Генерирует TrendDNA из данных анализа. Бросает понятную ошибку при отсутствии
 * ключа Claude или неразборчивом ответе (вызывающий решает: показать/пропустить).
 */
export async function generateTrendDNA(tenantId: string, input: GenerateDNAInput): Promise<TrendDNA> {
  const summary = input.summary || {};
  const meta = metaFromSummary(summary, input.platform);
  const apiKey = await resolveAnthropicKey(tenantId);
  if (!apiKey) throw new Error('Ключ Claude не задан (Enterprise → Генерация → ИИ-режиссёр).');

  const comments = (input.comments || []).map(commentText).map((c) => c.trim()).filter(Boolean).slice(0, 60);
  const commentBlock = comments.length
    ? comments.map((c, i) => `${i + 1}. ${c.slice(0, 200)}`).join('\n')
    : '(комментарии недоступны)';
  const ckw = (input.keywords || []).map((k) => k.word).filter(Boolean).slice(0, 30).join(', ') || '(нет)';
  const facts = [
    meta.platform && `Платформа: ${meta.platform}`,
    meta.author && `Автор: ${meta.author}`,
    summary.desc && `Описание: ${String(summary.desc).slice(0, 600)}`,
    meta.hashtags?.length && `Хэштеги: ${meta.hashtags.join(' ')}`,
    meta.music && `Музыка/звук: ${meta.music}`,
    meta.durationSec != null && `Длительность, сек: ${meta.durationSec}`,
    `Метрики: views=${meta.views ?? '?'} likes=${meta.likes ?? '?'} comments=${meta.comments ?? '?'} shares=${meta.shares ?? '?'} ER=${meta.engagementRate ?? '?'}%`,
    `Ключи комментариев: ${ckw}`,
  ].filter(Boolean).join('\n');

  // По умолчанию отчёт СОБИРАЕТСЯ на английском (и дальше в работу идёт на английском);
  // перевод — по кнопке «Перевести» через translateTrendDNA.
  const langName = dnaLangName(input.lang || 'en');
  const system =
    'Ты — аналитик вирусного короткого видео (TikTok/Reels/Shorts). По метаданным, описанию ' +
    'и комментариям реконструируй «рецепт успеха» ролика: разбор вирусности и контент-анализ. ' +
    'Сцены (sceneBeats) восстанавливай как обоснованную реконструкцию по описанию/формату — ' +
    'кратко и реалистично. Пиши конкретно, без воды. ' +
    `ВАЖНО: все строковые значения полей пиши на языке: ${langName}. ` +
    'Отвечай СТРОГО одним JSON-объектом без markdown и без пояснений.';
  const user =
    `Данные тренда:\n${facts}\n\nКомментарии:\n${commentBlock}\n\n` +
    'Верни JSON ровно такого вида:\n' +
    '{\n' +
    '  "hookType": "<короткий тип хука, напр. Visual Curiosity>",\n' +
    '  "whyItWorks": "<1-2 предложения, почему хук цепляет>",\n' +
    '  "targetAudience": "<кто целевая аудитория>",\n' +
    '  "viralFactors": ["<3-5 факторов вирусности>"],\n' +
    '  "copyReadyScript": "<готовый текст озвучки 35-110 слов, разговорно, с сильным первым предложением>",\n' +
    '  "howToAdapt": ["<2-4 идеи как адаптировать под нас>"],\n' +
    '  "summary": "<2-3 предложения о содержании>",\n' +
    '  "sceneBeats": [{"t": <сек>, "desc": "<что происходит>", "intensity": "low|mid|high"}],\n' +
    '  "hookAnalysis": "<разбор первых секунд>",\n' +
    '  "visualStyle": "<визуальный стиль: план, свет, темп, палитра>",\n' +
    '  "audioDialogue": "<стратегия звука: оставить ориг. звук / музыка / закадр; роль диалога>",\n' +
    '  "whyResonates": ["<3-5 причин отклика аудитории>"],\n' +
    '  "howToReplicate": ["<3-5 шагов как повторить>"],\n' +
    '  "keywords": ["<5-10 ключевых слов/тегов для поиска B-roll и подписей>"]\n' +
    '}';

  const mod: any = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default || mod.Anthropic || mod;
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: DEFAULT_DIRECTOR_MODEL, max_tokens: 4000, thinking: { type: 'adaptive' },
    system, messages: [{ role: 'user', content: user }],
  });
  const txt = (res.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('');
  const j = parseJsonLoose(txt);
  if (!j) throw new Error('ИИ вернул неразборчивый ответ — повторите.');

  const sceneBeats: SceneBeat[] = Array.isArray(j.sceneBeats)
    ? j.sceneBeats.map((b: any) => {
        const t = num(b?.t) ?? 0;
        const intensity = ['low', 'mid', 'high'].includes(b?.intensity) ? (b.intensity as BeatIntensity) : undefined;
        return { t: Math.max(0, t), desc: String(b?.desc || '').slice(0, 200), intensity };
      }).filter((b: SceneBeat) => b.desc).slice(0, 20)
    : [];
  const keywords = mergeKeywords(meta, input.keywords || [], strArr(j.keywords, 12, 40));

  const core = {
    hookType: String(j.hookType || '').slice(0, 80),
    whyItWorks: String(j.whyItWorks || '').slice(0, 600),
    targetAudience: String(j.targetAudience || '').slice(0, 300),
    viralFactors: strArr(j.viralFactors, 6),
    copyReadyScript: String(j.copyReadyScript || '').slice(0, 1500),
    howToAdapt: strArr(j.howToAdapt, 6),
    summary: String(j.summary || '').slice(0, 800),
    sceneBeats,
    hookAnalysis: String(j.hookAnalysis || '').slice(0, 600),
    visualStyle: String(j.visualStyle || '').slice(0, 400),
    audioDialogue: String(j.audioDialogue || '').slice(0, 400),
    whyResonates: strArr(j.whyResonates, 6),
    howToReplicate: strArr(j.howToReplicate, 6),
    keywords,
    meta,
    quality: qualityFromSummary(summary),
    benchmark: benchmarkFromMeta(meta),
    sourceUrl: input.sourceUrl,
  };
  return { ...core, brief: compileBrief(core), model: DEFAULT_DIRECTOR_MODEL, generatedAt: new Date().toISOString() };
}

/**
 * Вливает покадровый видеоанализ (video_insight.ts) в текстовую ДНК: sceneBeats
 * заменяются РЕАЛЬНЫМИ (по кадрам), visualStyle/hookAnalysis уточняются, бриф
 * перекомпилируется. Возвращает НОВЫЙ объект (исходный не мутируется).
 */
export function applyVisualInsight(dna: TrendDNA, v: {
  sceneBeats: SceneBeat[]; visualStyle: string; hookVisual: string;
  textOverlays: string[]; cutsCount?: number; transcript?: TranscriptSegment[]; model: string;
}): TrendDNA {
  const merged: TrendDNA = {
    ...dna,
    sceneBeats: v.sceneBeats.length ? v.sceneBeats : dna.sceneBeats,
    visualStyle: v.visualStyle || dna.visualStyle,
    hookAnalysis: v.hookVisual
      ? `${dna.hookAnalysis ? dna.hookAnalysis + ' ' : ''}Визуально (по кадрам): ${v.hookVisual}`.slice(0, 800)
      : dna.hookAnalysis,
    visual: {
      framesAnalyzed: true,
      hookVisual: v.hookVisual || undefined,
      textOverlays: v.textOverlays?.length ? v.textOverlays : undefined,
      cutsCount: v.cutsCount,
      transcript: v.transcript?.length ? v.transcript : undefined,
      model: v.model,
    },
  };
  return { ...merged, brief: compileBrief(merged) };
}

// ── Persistence (video_analyses) ────────────────────────────────────────────

export interface StoredTrendDNA {
  id: string;
  mediaAssetId?: string;
  sourceVideoId?: string;
  platform?: string;
  externalId?: string;
  sourceUrl?: string;
  dna: TrendDNA;
  model?: string;
  createdAt?: string;
}

function mapRow(r: any): StoredTrendDNA {
  return {
    id: r.id,
    mediaAssetId: r.media_asset_id || undefined,
    sourceVideoId: r.source_video_id || undefined,
    platform: r.platform || undefined,
    externalId: r.external_id || undefined,
    sourceUrl: r.source_url || undefined,
    dna: r.dna as TrendDNA,
    model: r.model || undefined,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
  };
}

/**
 * Кэширует протухающую обложку разбора (dna.meta.cover) на диск ПЕРЕД сохранением.
 * TikTok/IG отдают подписанные CDN-ссылки (…-sign.tiktokcdn-eu.com/…?x-expires=…), подпись
 * которых истекает за часы-сутки: тогда /api/channels/cover получает 403 → <img> в «Тренды →
 * Анализ» становится битым (обложка «пропадает после анализа»). Скачиваем её к себе в
 * uploads/covers и подменяем dna.meta.cover на стабильный локальный URL — тот же приём, что у
 * source_videos (см. media/store_cover.ts + trends/service.ts). Best-effort: при сбое/мёртвой
 * ссылке оставляем исходную (лучше протухающая, чем никакой). ytimg/уже-локальные не трогаем.
 */
async function persistDnaCover(dna: TrendDNA): Promise<void> {
  const cover = dna?.meta?.cover;
  if (!isExpiringCover(cover)) return;
  try {
    const saved = await cacheCoverToDisk(cover!);
    dna.meta.cover = saved.mediaUrl;
  } catch { /* ссылка мертва/недоступна — оставляем исходную */ }
}

/**
 * Сохраняет ДНК (upsert по media_asset_id — одна актуальная аналитика на видео).
 * Деградирует в null при недоступной БД — основной сценарий (скачивание) не падает.
 */
export async function saveTrendDNA(
  tenantId: string,
  rec: { mediaAssetId?: string; sourceVideoId?: string; platform?: string; externalId?: string; sourceUrl?: string; dna: TrendDNA }
): Promise<StoredTrendDNA | null> {
  try {
    await persistDnaCover(rec.dna); // обложку — на диск, чтобы не протухла (см. persistDnaCover)
    const id = randomUUID();
    const r = await pool.query(
      `INSERT INTO video_analyses (id, tenant_id, media_asset_id, source_video_id, platform, external_id, source_url, dna, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (media_asset_id) WHERE media_asset_id IS NOT NULL
       DO UPDATE SET dna = EXCLUDED.dna, model = EXCLUDED.model, source_url = EXCLUDED.source_url, updated_at = CURRENT_TIMESTAMP
       RETURNING id, media_asset_id, source_video_id, platform, external_id, source_url, dna, model, created_at`,
      [id, tenantId, rec.mediaAssetId || null, rec.sourceVideoId || null, rec.platform || null,
       rec.externalId || null, rec.sourceUrl || null, JSON.stringify(rec.dna), rec.dna.model || null]
    );
    const saved = mapRow(r.rows[0]);
    // Сохранили с медиа-ассетом (напр. «Добавить в галерею») — убираем «лёгкий» авто-разбор
    // того же видео (без media_asset_id), чтобы карточка «Анализ» не задваивалась.
    if (rec.mediaAssetId && rec.externalId) {
      try { await pool.query('DELETE FROM video_analyses WHERE tenant_id = $1 AND external_id = $2 AND media_asset_id IS NULL', [tenantId, rec.externalId]); } catch { /* мягко */ }
    }
    return saved;
  } catch (e) {
    console.warn('[trends] saveTrendDNA failed:', (e as Error).message);
    return null;
  }
}

// Разборы, чьи обложки уже кэшируются прямо сейчас — чтобы параллельные открытия Галереи
// не дублировали скачивание одной и той же ссылки; nextTry — пауза после неудачного воскрешения.
const analysisCoverInFlight = new Set<string>();
const analysisCoverNextTry = new Map<string, number>();
const ANALYSIS_COVER_DEAD_MS = 6 * 60 * 60 * 1000; // мёртвую обложку не дёргаем чаще раза в 6 ч
const ANALYSIS_RESURRECT_MAX = 12;                 // потолок TikHub-запросов за один проход

/**
 * Свежая обложка мёртвого разбора через TikHub (по platform + external_id / shortcode из
 * source_url). Только TikTok и Instagram — ровно те площадки, чьи CDN-подписи истекают
 * (см. isExpiringCover); YouTube/X стабильны. Тот же приём, что service.fetchFreshCoverUrl.
 */
async function fetchFreshAnalysisCover(apiKey: string, a: StoredTrendDNA): Promise<string | undefined> {
  if (a.platform === 'tiktok' && a.externalId) {
    const r = await fetchOneVideo(apiKey, a.externalId);
    return r.ok ? extractOneVideoCover(r.data) : undefined;
  }
  if (a.platform === 'instagram') {
    const m = /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/.exec(a.sourceUrl || '');
    const code = m?.[1] || (a.externalId && !/^\d+$/.test(a.externalId) ? a.externalId : null);
    if (!code) return undefined;
    const r = await fetchInstagramPostInfo(apiKey, code);
    return r.ok ? extractInstagramCover(r.data) : undefined;
  }
  return undefined;
}

/**
 * Фоновое лечение обложек уже сохранённых разборов (самолечение, как у source_videos —
 * см. trends/service.ts). Разборы держат в dna.meta.cover подписанный CDN-URL:
 *   • ссылка ещё жива → скачиваем к себе в uploads/covers, переписываем dna в БД;
 *   • ссылка мертва (403 — подпись истекла) → воскрешаем через TikHub (по external_id/shortcode)
 *     и кэшируем свежую. После неудачи — пауза ANALYSIS_COVER_DEAD_MS, чтобы не долбить TikHub.
 * Так чинятся и старые битые карточки (напр. PxPhone/Autopak). Best-effort, ответ не блокирует.
 */
async function healAnalysisCovers(tenantId: string, rows: StoredTrendDNA[]): Promise<void> {
  const now = Date.now();
  const targets = rows.filter((a) =>
    a.id && isExpiringCover(a.dna?.meta?.cover)
    && !analysisCoverInFlight.has(a.id) && now >= (analysisCoverNextTry.get(a.id) || 0)
  );
  if (!targets.length) return;
  if (analysisCoverNextTry.size > 5000) analysisCoverNextTry.clear(); // не даём карте расти вечно
  for (const a of targets) analysisCoverInFlight.add(a.id!);

  // Ключ TikHub — один на проход (нужен только для воскрешения мёртвых ссылок).
  const tikhubKey = await getEffectiveTikHubKey(tenantId).catch(() => null);
  let tikhubBudget = tikhubKey ? ANALYSIS_RESURRECT_MAX : 0;

  const persist = async (a: StoredTrendDNA, url: string): Promise<void> => {
    const saved = await cacheCoverToDisk(url);
    a.dna!.meta!.cover = saved.mediaUrl;
    await pool.query('UPDATE video_analyses SET dna = $3 WHERE tenant_id = $1 AND id = $2', [tenantId, a.id, JSON.stringify(a.dna)]);
  };

  // Мёртвая ссылка, но то же видео есть в ленте трендов с уже локальной обложкой —
  // усыновляем её (без скачивания и без TikHub): просто переписываем dna.meta.cover.
  const adoptSourceCover = async (a: StoredTrendDNA): Promise<boolean> => {
    if (!a.externalId) return false;
    const r = await pool.query(
      `SELECT cover_url FROM source_videos
       WHERE tenant_id = $1 AND external_id = $2 AND ($3::text IS NULL OR platform = $3)
         AND cover_url LIKE '/uploads/%'
       ORDER BY updated_at DESC LIMIT 1`,
      [tenantId, a.externalId, a.platform || null]
    );
    const local = r.rows[0]?.cover_url as string | undefined;
    if (!local) return false;
    a.dna!.meta!.cover = local;
    await pool.query('UPDATE video_analyses SET dna = $3 WHERE tenant_id = $1 AND id = $2', [tenantId, a.id, JSON.stringify(a.dna)]);
    return true;
  };

  const CONC = 4;
  try {
    for (let i = 0; i < targets.length; i += CONC) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(targets.slice(i, i + CONC).map(async (a) => {
        try {
          await persist(a, a.dna!.meta!.cover!); // живая ссылка — просто кэшируем
          return;
        } catch { /* ссылка мертва (подпись истекла) — пробуем усыновить/воскресить */ }
        try {
          if (await adoptSourceCover(a)) return;
        } catch { /* БД шумит — идём в TikHub-ветку */ }
        if (tikhubBudget <= 0) { analysisCoverNextTry.set(a.id!, now + ANALYSIS_COVER_DEAD_MS); return; }
        tikhubBudget--;
        try {
          const fresh = await fetchFreshAnalysisCover(tikhubKey!, a);
          if (!fresh) { analysisCoverNextTry.set(a.id!, now + ANALYSIS_COVER_DEAD_MS); return; }
          await persist(a, fresh);
        } catch { analysisCoverNextTry.set(a.id!, now + ANALYSIS_COVER_DEAD_MS); }
      }));
    }
  } finally {
    for (const a of targets) analysisCoverInFlight.delete(a.id!);
  }
}

/** Лучшая обложка разбора: локальная (стабильная) важнее протухающей CDN-ссылки. */
function bestAnalysisCover(dnaCover?: string, svCover?: string): string | undefined {
  const isLocal = (u?: string) => !!u && u.startsWith('/uploads/');
  if (isLocal(dnaCover)) return dnaCover;
  if (isLocal(svCover)) return svCover;
  return dnaCover || svCover || undefined;
}

/**
 * Все сохранённые анализы тенанта — раздел «Тренды → Анализ» в Галерее.
 * Джойним media_assets: если видео сохранено в Галерею, отдаём его файл (превью/плеер).
 * Джойним source_videos (то же видео в ленте трендов): его cover_url самолечится на диск
 * (см. trends/service.ts), поэтому служит фолбэком обложки «лёгким» разборам, у которых
 * dna.meta.cover — мёртвая CDN-подпись или отсутствует вовсе.
 */
export async function listTrendDNA(tenantId: string, limit = 100): Promise<Array<StoredTrendDNA & { fileUrl?: string; title?: string; coverUrl?: string }>> {
  try {
    const r = await pool.query(
      `SELECT va.id, va.media_asset_id, va.source_video_id, va.platform, va.external_id, va.source_url,
              va.dna, va.model, va.created_at, ma.file_url AS ma_file_url, ma.original_name AS ma_name,
              sv.cover_url AS sv_cover
       FROM video_analyses va
       LEFT JOIN media_assets ma ON ma.id = va.media_asset_id AND ma.tenant_id = va.tenant_id
       LEFT JOIN LATERAL (
         SELECT s.cover_url FROM source_videos s
         WHERE s.tenant_id = va.tenant_id AND s.external_id = va.external_id
           AND (va.platform IS NULL OR s.platform = va.platform)
           AND s.cover_url IS NOT NULL
         ORDER BY (s.cover_url LIKE '/uploads/%') DESC, s.updated_at DESC
         LIMIT 1
       ) sv ON TRUE
       WHERE va.tenant_id = $1
       ORDER BY va.created_at DESC
       LIMIT $2`,
      [tenantId, Math.max(1, Math.min(300, limit))]
    );
    const rows = r.rows.map((row: any) => {
      const mapped = mapRow(row);
      return {
        ...mapped,
        fileUrl: row.ma_file_url || undefined,
        title: row.ma_name || undefined,
        coverUrl: bestAnalysisCover(mapped.dna?.meta?.cover, row.sv_cover || undefined),
      };
    });
    // В фоне закэшировать ещё живые обложки старых разборов — чтобы не протухли назавтра.
    void healAnalysisCovers(tenantId, rows);
    return rows;
  } catch (e) {
    console.warn('[trends] listTrendDNA failed:', (e as Error).message);
    return [];
  }
}

/** Возвращает сохранённую ДНК по видео Галереи (для автозаполнения TrendFlow). */
export async function getTrendDNAByAsset(tenantId: string, mediaAssetId: string): Promise<StoredTrendDNA | null> {
  try {
    const r = await pool.query(
      `SELECT id, media_asset_id, source_video_id, platform, external_id, source_url, dna, model, created_at
       FROM video_analyses WHERE tenant_id = $1 AND media_asset_id = $2 LIMIT 1`,
      [tenantId, mediaAssetId]
    );
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  } catch {
    return null;
  }
}

/** Разбор по его собственному id — когда берём ЧУЖОЙ разбор как контекст
 *  (напр. подпись к нашему ролику пишем по ДНК тренда, под который он снят). */
export async function getTrendDNAById(tenantId: string, id: string): Promise<StoredTrendDNA | null> {
  try {
    const r = await pool.query(
      `SELECT id, media_asset_id, source_video_id, platform, external_id, source_url, dna, model, created_at
       FROM video_analyses WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, id]
    );
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  } catch {
    return null;
  }
}

/** Удалить один сохранённый анализ (карточка «Тренды → Анализ» в Галерее). */
export async function deleteTrendDNA(tenantId: string, id: string): Promise<boolean> {
  try {
    const r = await pool.query('DELETE FROM video_analyses WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
    return (r.rowCount ?? 0) > 0;
  } catch (e) {
    console.warn('[trends] deleteTrendDNA failed:', (e as Error).message);
    return false;
  }
}

/** Массово удалить сохранённые анализы. Возвращает число удалённых строк. */
export async function deleteTrendDNABulk(tenantId: string, ids: string[]): Promise<number> {
  const clean = ids.filter((x) => typeof x === 'string' && x);
  if (clean.length === 0) return 0;
  try {
    const r = await pool.query('DELETE FROM video_analyses WHERE tenant_id = $1 AND id = ANY($2::uuid[])', [tenantId, clean]);
    return r.rowCount ?? 0;
  } catch (e) {
    console.warn('[trends] deleteTrendDNABulk failed:', (e as Error).message);
    return 0;
  }
}

/**
 * Перевод ПЛОСКОГО текста (транскрибация речи ролика и т.п.) на язык `lang`.
 * Тот же Claude, что и у перевода ДНК; возвращает только переведённый текст.
 */
export async function translatePlainText(tenantId: string, text: string, lang: string): Promise<string> {
  const apiKey = await resolveAnthropicKey(tenantId);
  if (!apiKey) throw new Error('Ключ Claude не задан (Enterprise → Генерация → ИИ-режиссёр).');
  const langName = dnaLangName(lang || 'ru');
  const system = `You are a professional translator. Translate the user's text into ${langName}. Preserve line breaks and paragraph structure. Return ONLY the translated text — no explanations, no quotes, no markdown fences.`;
  const mod: any = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default || mod.Anthropic || mod;
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: DEFAULT_DIRECTOR_MODEL, max_tokens: 6000,
    system, messages: [{ role: 'user', content: text.slice(0, 24_000) }],
  });
  const out = (res.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('').trim();
  if (!out) throw new Error('Не удалось перевести — повторите.');
  return out;
}

/**
 * Переводит текстовые поля готовой ДНК на язык `lang` (кнопка «Перевести»). Сам разбор
 * НЕ пересобирается — только перевод значений; keywords/meta/quality/тайминги не трогаем.
 */
export async function translateTrendDNA(tenantId: string, dna: any, lang: string): Promise<any> {
  const apiKey = await resolveAnthropicKey(tenantId);
  if (!apiKey) throw new Error('Ключ Claude не задан (Enterprise → Генерация → ИИ-режиссёр).');
  const langName = dnaLangName(lang || 'ru');
  const payload = {
    hookType: dna?.hookType || '', whyItWorks: dna?.whyItWorks || '', targetAudience: dna?.targetAudience || '',
    viralFactors: Array.isArray(dna?.viralFactors) ? dna.viralFactors : [], copyReadyScript: dna?.copyReadyScript || '',
    howToAdapt: Array.isArray(dna?.howToAdapt) ? dna.howToAdapt : [], summary: dna?.summary || '',
    hookAnalysis: dna?.hookAnalysis || '', visualStyle: dna?.visualStyle || '', audioDialogue: dna?.audioDialogue || '',
    whyResonates: Array.isArray(dna?.whyResonates) ? dna.whyResonates : [], howToReplicate: Array.isArray(dna?.howToReplicate) ? dna.howToReplicate : [],
    sceneBeats: Array.isArray(dna?.sceneBeats) ? dna.sceneBeats.map((b: any) => ({ desc: String(b?.desc || '') })) : [],
  };
  const system = `You are a professional translator. Translate ALL string values of the given JSON into ${langName}. Keep the JSON structure, array lengths and keys EXACTLY. Do NOT translate keys. Return STRICTLY one JSON object, no markdown, no explanations.`;
  const mod: any = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default || mod.Anthropic || mod;
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: DEFAULT_DIRECTOR_MODEL, max_tokens: 4000,
    system, messages: [{ role: 'user', content: JSON.stringify(payload) }],
  });
  const txt = (res.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('');
  const j = parseJsonLoose(txt);
  if (!j) throw new Error('Не удалось перевести — повторите.');
  const out: any = { ...dna };
  for (const k of ['hookType', 'whyItWorks', 'targetAudience', 'copyReadyScript', 'summary', 'hookAnalysis', 'visualStyle', 'audioDialogue']) {
    if (typeof j[k] === 'string' && j[k]) out[k] = j[k];
  }
  for (const k of ['viralFactors', 'howToAdapt', 'whyResonates', 'howToReplicate']) {
    if (Array.isArray(j[k])) out[k] = j[k].map((x: any) => String(x));
  }
  if (Array.isArray(j.sceneBeats) && Array.isArray(dna?.sceneBeats)) {
    out.sceneBeats = dna.sceneBeats.map((b: any, i: number) => ({ ...b, desc: typeof j.sceneBeats[i]?.desc === 'string' ? j.sceneBeats[i].desc : b.desc }));
  }
  return out;
}

/**
 * Авто-сохранение разбора БЕЗ скачивания видео (карточка сразу в «Тренды → Анализ»).
 * Дедуп по (tenant, external_id) среди записей без media_asset_id — повторный анализ
 * того же видео обновляет, а не плодит. «Добавить в галерею» (с media_asset_id) отдельно
 * подчищает такие «лёгкие» записи (см. saveTrendDNA cleanup).
 */
export async function saveTrendDNAAuto(
  tenantId: string,
  rec: { platform?: string; externalId?: string; sourceUrl?: string; dna: TrendDNA }
): Promise<StoredTrendDNA | null> {
  try {
    await persistDnaCover(rec.dna); // обложку — на диск, чтобы не протухла (см. persistDnaCover)
    const ext = rec.externalId || null;
    if (ext) {
      const ex = await pool.query(
        'SELECT id FROM video_analyses WHERE tenant_id = $1 AND external_id = $2 AND media_asset_id IS NULL LIMIT 1',
        [tenantId, ext]
      );
      if (ex.rows[0]) {
        const r = await pool.query(
          `UPDATE video_analyses SET dna = $3, model = $4, source_url = $5, platform = $6, updated_at = CURRENT_TIMESTAMP
           WHERE tenant_id = $1 AND id = $2
           RETURNING id, media_asset_id, source_video_id, platform, external_id, source_url, dna, model, created_at`,
          [tenantId, ex.rows[0].id, JSON.stringify(rec.dna), rec.dna.model || null, rec.sourceUrl || null, rec.platform || null]
        );
        return mapRow(r.rows[0]);
      }
    }
    const id = randomUUID();
    const r = await pool.query(
      `INSERT INTO video_analyses (id, tenant_id, platform, external_id, source_url, dna, model)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, media_asset_id, source_video_id, platform, external_id, source_url, dna, model, created_at`,
      [id, tenantId, rec.platform || null, ext, rec.sourceUrl || null, JSON.stringify(rec.dna), rec.dna.model || null]
    );
    return mapRow(r.rows[0]);
  } catch (e) {
    console.warn('[trends] saveTrendDNAAuto failed:', (e as Error).message);
    return null;
  }
}
