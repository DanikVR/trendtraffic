/**
 * TrendTraffic — ИИ-режиссёр (LLM director) на Claude:
 *  • подкаст-диалог двух ведущих (generatePodcastDialogue);
 *  • UGC-удержание: разметка сегментов на премиум-аватар (tagUgcRetention);
 *  • UGC-диалоги: per-turn раскладка/движок (directDialogue).
 *
 * Ключ: per-tenant 'anthropic' (tenant_settings/provider_keys) с fallback на
 * системный ANTHROPIC_API_KEY (чтобы суперадмин мог протестировать). Модель по
 * умолчанию claude-opus-4-8; выбор — через node.choices.model. SDK подключается
 * ДИНАМИЧЕСКИ (как @google/genai в assistant/service.ts) — без ключа не грузится.
 *
 * Все функции деградируют мягко: нет ключа / ошибка / пустой ответ → возвращают
 * пустой результат + заметку, конвейер не падает.
 */

import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import type { SegScore } from './retention.js';
import type { DlgScore, DlgLayout } from './dialogue.js';

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

// ── UGC-удержание: LLM решает, какие сегменты поднять на дорогой Avatar IV ────
/**
 * Оценивает, какие сегменты скрипта важнее всего показать на премиум-аватаре (IV): крючок,
 * ключевое действие/демо, призыв. Возвращает SegScore[] (индекс + балл + причина). Пусто →
 * вызывающий откатывается на эвристику (planRetention). Ключ Claude — как у режиссёра.
 */
export async function tagUgcRetention(opts: {
  tenantId: string; segments: string[]; ivMax: number; model?: string;
}): Promise<{ scores: SegScore[]; note: string }> {
  const segs = (opts.segments || []).map((t) => String(t || '').replace(/\s+/g, ' ').trim());
  if (!segs.length) return { scores: [], note: 'сегментов нет' };
  const apiKey = await resolveAnthropicKey(opts.tenantId);
  if (!apiKey) return { scores: [], note: 'LLM-разметка: ключ Claude не задан — эвристика' };
  const list = segs.map((t, i) => `${i}: ${t.slice(0, 180) || '(без текста)'}`).join('\n');
  const system =
    'Ты — режиссёр коротких вертикальных UGC-роликов. На вход — сегменты ОДНОГО скрипта по порядку. ' +
    'Оцени, какие сегменты важнее всего показать крупным планом на ПРЕМИУМ-аватаре (максимум доверия и качества): ' +
    'крючок в самом начале, момент реального ДЕЙСТВИЯ/демонстрации («показываю», «смотрите», «вот как»), и призыв в конце — высокий балл; ' +
    'связки, факты и общие фразы — низкий, их и так покажем на дешёвом аватаре или видео. ' +
    `Верни СТРОГО JSON-массив, максимум ${Math.max(1, opts.ivMax)} объектов (только реально важные), и ничего больше: ` +
    '[{"i":<индекс сегмента>,"role":"hook|action|cta","score":<0..100>}].';
  try {
    const raw = await generateText({ apiKey, model: opts.model || DEFAULT_DIRECTOR_MODEL, system, user: `Сегменты:\n${list}`, maxTokens: 700 });
    const arr = extractJsonArray(raw);
    if (!arr) return { scores: [], note: 'LLM-разметка: не JSON — эвристика' };
    const why = (r: string) => (r === 'hook' ? 'крючок → IV' : r === 'cta' ? 'призыв → IV' : 'ключевое действие → IV');
    const scores: SegScore[] = arr
      .map((x: any) => ({ i: Number(x?.i), score: Number(x?.score) || 0, why: why(String(x?.role || '')) }))
      .filter((s) => Number.isInteger(s.i) && s.i >= 0 && s.i < segs.length && s.score > 0);
    return scores.length ? { scores, note: `LLM-разметка: ${scores.length} сегм. на IV` } : { scores: [], note: 'LLM-разметка: пусто — эвристика' };
  } catch (e: any) {
    return { scores: [], note: `LLM-разметка: ошибка ${e?.message || e} — эвристика` };
  }
}

// ── UGC-диалоги: LLM решает раскладку и движок каждой реплики ─────────────────
/**
 * По репликам диалога (A/B, с пометкой «есть медиа») режиссёр решает per-turn:
 *  • engine — какие реплики поднять на дорогой Avatar IV (крючок, эмоция, призыв), в пределах ivMax;
 *  • twoshot — где показать ОБОИХ собеседников в кадре (реакция/спор), в пределах twoshotMax;
 *  • mediaLayout — для реплик с медиа: как показать (во весь кадр / фон+лицо слева-справа / сверху-снизу).
 * Пусто/ошибка → вызывающий откатывается на эвристику. Ключ Claude — как у режиссёра.
 */
export async function directDialogue(opts: {
  tenantId: string;
  turns: { i: number; speaker: 'A' | 'B'; text: string; hasMedia: boolean; mediaAuto: boolean }[];
  ivMax: number; twoshotMax: number; model?: string;
}): Promise<{ scores: DlgScore[]; note: string }> {
  const turns = (opts.turns || []).filter((t) => t && Number.isInteger(t.i));
  if (!turns.length) return { scores: [], note: 'реплик нет' };
  const apiKey = await resolveAnthropicKey(opts.tenantId);
  if (!apiKey) return { scores: [], note: 'диалог-режиссёр: ключ Claude не задан — эвристика' };
  const list = turns.map((t) => `${t.i}: [${t.speaker}]${t.hasMedia ? (t.mediaAuto ? '[медиа:авто]' : '[медиа:задано]') : ''} ${String(t.text || '').slice(0, 160) || '(без текста)'}`).join('\n');
  const system =
    'Ты — режиссёр коротких вертикальных UGC-диалогов ДВУХ собеседников (A и B) под одну дорожку голоса. ' +
    'На вход — реплики по порядку. Твоя задача — удержание внимания при экономии дорогого рендера. Реши по каждой важной реплике:\n' +
    `• "engine":"iv" — поднять на ПРЕМИУМ-аватар (максимум качества): крючок в начале, сильная эмоция/панчлайн, призыв в конце. Максимум ${Math.max(1, opts.ivMax)} реплик, остальные и так на дешёвом.\n` +
    `• "twoshot":true — показать ОБОИХ в кадре одновременно (яркая реакция, спор, поддакивание). Максимум ${Math.max(0, opts.twoshotMax)} реплик.\n` +
    '• "mediaLayout" — ТОЛЬКО для реплик с пометкой [медиа:авто]: "media-full" (медиа во весь кадр, если реплика про «смотрите/вот это»), "media-bg-left"/"media-bg-right" (медиа на фоне, говорящий маленьким сбоку — если человек комментирует), "media-split" (медиа и лицо поровну). Реплики [медиа:задано] НЕ трогай.\n' +
    'Верни СТРОГО JSON-массив (только значимые реплики) и ничего больше: ' +
    '[{"i":<индекс>,"engine":"iv","twoshot":true,"mediaLayout":"media-bg-right","score":<0..100>}]. Любое поле кроме i — опционально.';
  try {
    const raw = await generateText({ apiKey, model: opts.model || DEFAULT_DIRECTOR_MODEL, system, user: `Реплики:\n${list}`, maxTokens: 900 });
    const arr = extractJsonArray(raw);
    if (!arr) return { scores: [], note: 'диалог-режиссёр: не JSON — эвристика' };
    const okLayout = new Set<DlgLayout>(['media-full', 'media-bg-left', 'media-bg-right', 'media-split']);
    const scores: DlgScore[] = arr
      .map((x: any) => {
        const ml = String(x?.mediaLayout || '') as DlgLayout;
        return {
          i: Number(x?.i),
          engine: x?.engine === 'iv' ? ('iv' as const) : undefined,
          twoshot: typeof x?.twoshot === 'boolean' ? x.twoshot : undefined,
          mediaLayout: okLayout.has(ml) ? ml : undefined,
          score: Number(x?.score) || 50,
          why: x?.engine === 'iv' ? 'IV' : x?.twoshot ? 'два-шот' : undefined,
        } as DlgScore;
      })
      .filter((s) => Number.isInteger(s.i) && s.i >= 0);
    return scores.length ? { scores, note: `диалог-режиссёр: ${scores.length} решений` } : { scores: [], note: 'диалог-режиссёр: пусто — эвристика' };
  } catch (e: any) {
    return { scores: [], note: `диалог-режиссёр: ошибка ${e?.message || e} — эвристика` };
  }
}
