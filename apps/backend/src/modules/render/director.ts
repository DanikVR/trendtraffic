/**
 * TrendTraffic — ИИ-режиссёр (LLM director) для рендера «Собрать».
 *
 * «Мозг» умных шагов сценария на Claude:
 *  • voiceover (озвучка): по брифу пишет короткий сценарий → его озвучивает Piper;
 *  • research / news: веб-поиск + сбор материала/новости (server-tool web_search);
 *  • length (выбор момента): по транскрипту выбирает самый сильный отрезок.
 *
 * Ключ: per-tenant 'anthropic' (tenant_settings/provider_keys) с fallback на
 * системный ANTHROPIC_API_KEY (чтобы суперадмин мог протестировать). Модель по
 * умолчанию claude-opus-4-8; выбор — через node.choices.model. SDK подключается
 * ДИНАМИЧЕСКИ (как @google/genai в assistant/service.ts) — без ключа не грузится.
 *
 * Все функции деградируют мягко: нет ключа / ошибка / пустой ответ → возвращают
 * null + заметку, конвейер не падает (шаг идёт как обычный passthrough).
 */

import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { getRenderWorkerUrl } from '../../config/systemConfig.js';

export const DEFAULT_DIRECTOR_MODEL = 'claude-opus-4-8';
const ALLOWED_MODELS = new Set([
  'claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5',
]);

/** Выбранная для шага модель Claude (node.choices.model) либо дефолт. */
export function directorModel(params: Record<string, any> | undefined | null): string {
  const raw = (params as any)?.choices?.model ?? (params as any)?.model;
  const m = Array.isArray(raw) ? raw[0] : raw;
  return typeof m === 'string' && ALLOWED_MODELS.has(m) ? m : DEFAULT_DIRECTOR_MODEL;
}

/** Эффективный ключ Claude: tenant-ключ; если нет — для Премиум/Энтерпрайз (вкл. триал)
 *  НЕ падаем на наш платформенный ANTHROPIC_API_KEY (иначе несём их затраты, в т.ч. в
 *  пробный период) → null. Платформенный фолбэк остаётся только вне полного доступа
 *  (например superadmin-тенант 'global_admin' для теста). */
export async function resolveAnthropicKey(tenantId: string | null | undefined): Promise<string | null> {
  const tk = tenantId ? await getEffectiveProviderKey(tenantId, 'anthropic') : null;
  if (tk) return tk;
  if (tenantId && await hasEnterpriseAccess(tenantId)) return null;
  return process.env.ANTHROPIC_API_KEY || null;
}

// Клиент SDK кэшируем (конструктор), сам инстанс — на ключ.
let _Ctor: any = null;
async function getClient(apiKey: string): Promise<any> {
  if (!_Ctor) {
    const mod: any = await import('@anthropic-ai/sdk');
    _Ctor = mod.default || mod.Anthropic || mod;
  }
  return new _Ctor({ apiKey });
}

interface GenOpts {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  webSearch?: boolean;
  maxTokens?: number;
}

/** Один вызов Claude (adaptive thinking). Возвращает финальный текст. */
async function generateText(o: GenOpts): Promise<string> {
  const client = await getClient(o.apiKey);
  const tools = o.webSearch ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }] : undefined;
  const messages: any[] = [{ role: 'user', content: o.user }];
  let out = '';
  // web_search может вернуть pause_turn — продолжаем тот же ход (до 4 итераций).
  for (let i = 0; i < 4; i++) {
    const req: any = {
      model: o.model,
      max_tokens: o.maxTokens ?? 3000,
      thinking: { type: 'adaptive' },
      system: o.system,
      messages,
    };
    if (tools) req.tools = tools;
    const res = await client.messages.create(req);
    const txt = (res.content || [])
      .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('');
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content });
      continue;
    }
    out = txt;
    break;
  }
  return out.trim();
}

export interface DirectorTextResult { text: string | null; note: string }

/** Озвучка: по брифу (+опц. ресёрч-контекст) пишет короткий сценарий для TTS. */
export async function generateVoiceoverScript(opts: {
  tenantId: string; brief: string; notes?: string | null; model?: string;
}): Promise<DirectorTextResult> {
  const brief = (opts.brief || '').trim();
  if (!brief) return { text: null, note: 'озвучка: пустой бриф — нечего писать' };
  const apiKey = await resolveAnthropicKey(opts.tenantId);
  if (!apiKey) return { text: null, note: 'ИИ-режиссёр: ключ Claude не задан — озвучка по тексту как есть' };
  const system =
    'Ты — сценарист коротких вертикальных видео (TikTok/Reels/Shorts) на русском. ' +
    'Пиши живо, разговорно, с цепляющим первым предложением (hook). Без эмодзи, без ремарок ' +
    'и без сценических указаний — ТОЛЬКО текст, который произнесёт диктор. ' +
    'Объём — на 15–40 секунд речи (примерно 35–110 слов).';
  const user =
    `Бриф: ${brief}\n` +
    (opts.notes ? `\nМатериал для опоры:\n${String(opts.notes).slice(0, 4000)}\n` : '') +
    '\nНапиши готовый текст для озвучки.';
  try {
    const text = await generateText({ apiKey, model: opts.model || DEFAULT_DIRECTOR_MODEL, system, user, maxTokens: 2500 });
    return text
      ? { text, note: `сценарий ИИ (${text.length} симв.)` }
      : { text: null, note: 'ИИ-режиссёр: пустой ответ' };
  } catch (e: any) {
    return { text: null, note: `ИИ-режиссёр: ошибка — ${e?.message || e}` };
  }
}

/** Ресёрч темы через веб-поиск → краткий материал-опора. */
export async function runResearch(opts: {
  tenantId: string; topic: string; model?: string;
}): Promise<DirectorTextResult> {
  const topic = (opts.topic || '').trim();
  if (!topic) return { text: null, note: 'ресёрч: укажите тему в поле узла' };
  const apiKey = await resolveAnthropicKey(opts.tenantId);
  if (!apiKey) return { text: null, note: 'ИИ-режиссёр: ключ Claude не задан — ресёрч пропущен' };
  const system =
    'Ты — ресёрчер для коротких видео. Найди в вебе свежие, конкретные факты по теме и ' +
    'собери сжатый материал: 4–7 пунктов (факт + почему интересно), без воды. На русском.';
  try {
    const text = await generateText({
      apiKey, model: opts.model || DEFAULT_DIRECTOR_MODEL,
      system, user: `Тема: ${topic}`, webSearch: true, maxTokens: 6000,
    });
    return text
      ? { text, note: `ресёрч ИИ готов (${text.length} симв.)` }
      : { text: null, note: 'ресёрч: пустой ответ' };
  } catch (e: any) {
    return { text: null, note: `ресёрч: ошибка — ${e?.message || e}` };
  }
}

/** Новость по источнику/теме через веб-поиск → короткий новостной текст. */
export async function writeNews(opts: {
  tenantId: string; topic: string; model?: string;
}): Promise<DirectorTextResult> {
  const topic = (opts.topic || '').trim();
  if (!topic) return { text: null, note: 'новости: укажите источник/тему в поле узла' };
  const apiKey = await resolveAnthropicKey(opts.tenantId);
  if (!apiKey) return { text: null, note: 'ИИ-режиссёр: ключ Claude не задан — новости пропущены' };
  const system =
    'Ты — редактор новостей для коротких видео. Найди самую свежую новость по источнику/теме ' +
    'и напиши короткий новостной текст (3–5 предложений) для озвучки: суть, факты, без домыслов. На русском.';
  try {
    const text = await generateText({
      apiKey, model: opts.model || DEFAULT_DIRECTOR_MODEL,
      system, user: `Источник/тема: ${topic}`, webSearch: true, maxTokens: 5000,
    });
    return text
      ? { text, note: `новость ИИ готова (${text.length} симв.)` }
      : { text: null, note: 'новости: пустой ответ' };
  } catch (e: any) {
    return { text: null, note: `новости: ошибка — ${e?.message || e}` };
  }
}

// ── Подкаст: генерация диалога двух ведущих ───────────────────────────────────
export interface PodcastLine { speaker: 'A' | 'B'; text: string }
export interface PodcastDialogueResult { lines: PodcastLine[]; note: string }

/** Достаёт первый JSON-массив из ответа модели (на случай обрамляющего текста). */
function extractJsonArray(raw: string): any[] | null {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try { const v = JSON.parse(m[0]); return Array.isArray(v) ? v : null; } catch { return null; }
}

/**
 * По брифу/теме пишет диалог двух ведущих подкаста для озвучки на 2 голоса.
 * Возвращает реплики [{speaker:'A'|'B', text}]; деградирует мягко (пустой список + заметка).
 */
export async function generatePodcastDialogue(opts: {
  tenantId: string; brief: string; nameA?: string; nameB?: string; turns?: number; model?: string;
}): Promise<PodcastDialogueResult> {
  const brief = (opts.brief || '').trim();
  if (!brief) return { lines: [], note: 'диалог: пустой бриф — укажите тему подкаста' };
  const apiKey = await resolveAnthropicKey(opts.tenantId);
  if (!apiKey) return { lines: [], note: 'ИИ-режиссёр: ключ Claude не задан — диалог не сгенерирован' };
  const turns = Math.min(Math.max(opts.turns ?? 8, 2), 20);
  const A = (opts.nameA || 'Ведущий A').trim();
  const B = (opts.nameB || 'Ведущий B').trim();
  const system =
    'Ты — сценарист коротких подкастов на русском для вертикальных видео (Reels/Shorts). ' +
    `Пиши живой диалог ДВУХ ведущих: A (${A}) и B (${B}). Разговорно, по делу, с цепляющим стартом. ` +
    'Реплики короткие (1–2 предложения), чтобы хорошо звучали в озвучке. Без ремарок и эмодзи. ' +
    'Чередуй говорящих, начни с A. ' +
    `Верни СТРОГО JSON-массив из ~${turns} реплик и ничего больше: ` +
    '[{"speaker":"A","text":"…"},{"speaker":"B","text":"…"}, …].';
  try {
    const raw = await generateText({ apiKey, model: opts.model || DEFAULT_DIRECTOR_MODEL, system, user: `Тема подкаста: ${brief}`, maxTokens: 3000 });
    const arr = extractJsonArray(raw);
    if (!arr) return { lines: [], note: 'диалог: модель не вернула JSON — попробуйте ещё раз' };
    const lines: PodcastLine[] = arr
      .map((x: any) => ({ speaker: x?.speaker === 'B' ? 'B' : 'A', text: String(x?.text || '').trim() } as PodcastLine))
      .filter((l) => l.text);
    return lines.length
      ? { lines, note: `диалог ИИ: ${lines.length} реплик` }
      : { lines: [], note: 'диалог: пустой ответ' };
  } catch (e: any) {
    return { lines: [], note: `диалог: ошибка — ${e?.message || e}` };
  }
}

// ── Выбор лучшего момента (нужен транскрипт от рендер-воркера) ────────────────
function publicBase(): string {
  return String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
}
function toAbsolute(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = publicBase();
  return base ? base + (url.startsWith('/') ? url : '/' + url) : null;
}

interface TranscriptSeg { start: number; end: number; text: string }

/** Просит рендер-воркер транскрибировать вход (faster-whisper) и вернуть сегменты. */
async function fetchTranscript(absUrl: string): Promise<TranscriptSeg[] | null> {
  const worker = getRenderWorkerUrl();
  if (!worker) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 600_000);
  try {
    const r = await fetch(`${worker}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_url: absUrl }),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    const segs = (d as any)?.segments;
    return Array.isArray(segs) && segs.length ? segs : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export interface BestMomentResult { range: string | null; note: string }

/** По транскрипту выбирает самый сильный отрезок ~targetSec и отдаёт "start-end" (сек). */
export async function pickBestMoment(opts: {
  tenantId: string; sourceUrl: string | null; targetSec?: number; model?: string;
}): Promise<BestMomentResult> {
  const apiKey = await resolveAnthropicKey(opts.tenantId);
  if (!apiKey) return { range: null, note: 'ИИ-режиссёр: ключ Claude не задан — момент не выбран' };
  const abs = toAbsolute(opts.sourceUrl);
  if (!abs) return { range: null, note: 'выбор момента: нет публичного URL источника (PUBLIC_BASE_URL?)' };
  const segs = await fetchTranscript(abs);
  if (!segs) return { range: null, note: 'выбор момента: транскрипт недоступен — без ЛЛМ-обрезки' };
  const target = opts.targetSec && opts.targetSec > 0 ? opts.targetSec : 30;
  const transcript = segs
    .map((s) => `[${Number(s.start).toFixed(1)}-${Number(s.end).toFixed(1)}] ${String(s.text).trim()}`)
    .join('\n')
    .slice(0, 12000);
  const system =
    'Ты выбираешь самый «вирусный»/цепляющий непрерывный фрагмент видео по его транскрипту ' +
    'для вертикального шортса. Учитывай сильный хук, законченную мысль, эмоцию.';
  const user =
    `Транскрипт (тайминги в секундах):\n${transcript}\n\n` +
    `Выбери ОДИН непрерывный отрезок длиной около ${target} сек — самый сильный для шортса. ` +
    'Ответь СТРОГО в JSON и ничего больше: {"start": <число сек>, "end": <число сек>}.';
  try {
    const raw = await generateText({ apiKey, model: opts.model || DEFAULT_DIRECTOR_MODEL, system, user, maxTokens: 1500 });
    const m = raw.match(/\{[^{}]*"start"[^{}]*\}/);
    if (!m) return { range: null, note: 'выбор момента: модель не вернула JSON — без обрезки' };
    const obj = JSON.parse(m[0]);
    const s = Number(obj.start), e = Number(obj.end);
    if (!isFinite(s) || !isFinite(e) || e <= s) return { range: null, note: 'выбор момента: некорректный диапазон' };
    const a = Math.max(0, Math.floor(s)), b = Math.ceil(e);
    return { range: `${a}-${b}`, note: `ИИ выбрал момент ${a}–${b} сек` };
  } catch (e: any) {
    return { range: null, note: `выбор момента: ошибка — ${e?.message || e}` };
  }
}
