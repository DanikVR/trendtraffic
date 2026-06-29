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
import type { NormComment } from './analytics.js';

export type BeatIntensity = 'low' | 'mid' | 'high';
export interface SceneBeat { t: number; desc: string; intensity?: BeatIntensity }

/** Снимок детерминированных метаданных тренда (из analyze summary) — для блоков и отбора. */
export interface TrendMeta {
  platform?: string;
  author?: string;
  durationSec?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagementRate?: number;
  music?: string;
  hashtags?: string[];
  cover?: string;
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
  // — Происхождение —
  model: string;
  generatedAt: string;       // ISO
  sourceUrl?: string;
}

function num(v: any): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^\d.-]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}
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
    engagementRate: num(s.engagementRate),
    music: typeof s.music === 'string' ? s.music : undefined,
    hashtags: Array.isArray(s.hashtags) ? s.hashtags.map((h: any) => String(h)).slice(0, 12) : [],
    cover: typeof s.cover === 'string' ? s.cover : undefined,
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
  const lines = [
    'Цель: воспроизвести вирусную формулу тренда на нашем материале (не копировать исходник).',
    d.hookType && `Хук: ${d.hookType}${d.whyItWorks ? ` — ${d.whyItWorks}` : ''}`,
    d.targetAudience && `Аудитория: ${d.targetAudience}`,
    d.viralFactors?.length && `Факторы успеха: ${d.viralFactors.join('; ')}`,
    d.visualStyle && `Визуальный стиль: ${d.visualStyle}`,
    d.audioDialogue && `Звук/подача: ${d.audioDialogue}`,
    d.howToAdapt?.length && `Адаптировать: ${d.howToAdapt.join('; ')}`,
    d.keywords?.length && `Ключевые слова: ${d.keywords.join(', ')}`,
  ].filter(Boolean);
  return lines.join('\n').slice(0, 2000);
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

  const system =
    'Ты — аналитик вирусного короткого видео (TikTok/Reels/Shorts). По метаданным, описанию ' +
    'и комментариям реконструируй «рецепт успеха» ролика: разбор вирусности и контент-анализ. ' +
    'Сцены (sceneBeats) восстанавливай как обоснованную реконструкцию по описанию/формату — ' +
    'кратко и реалистично. Пиши на русском, конкретно, без воды. ' +
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
    sourceUrl: input.sourceUrl,
  };
  return { ...core, brief: compileBrief(core), model: DEFAULT_DIRECTOR_MODEL, generatedAt: new Date().toISOString() };
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
 * Сохраняет ДНК (upsert по media_asset_id — одна актуальная аналитика на видео).
 * Деградирует в null при недоступной БД — основной сценарий (скачивание) не падает.
 */
export async function saveTrendDNA(
  tenantId: string,
  rec: { mediaAssetId?: string; sourceVideoId?: string; platform?: string; externalId?: string; sourceUrl?: string; dna: TrendDNA }
): Promise<StoredTrendDNA | null> {
  try {
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
    return mapRow(r.rows[0]);
  } catch (e) {
    console.warn('[trends] saveTrendDNA failed:', (e as Error).message);
    return null;
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
