/**
 * TrendTraffic — исполнитель-обёртка ИИ-режиссёра (decorator над базовым).
 *
 * Перехватывает «умные» шаги ДО инструмента OpenMontage:
 *  • news → честный источник (RSS / t.me / сайт, news_fetch) → материал+фото в
 *    ctx.scratchpad; при ✨ Claude переписывает материал в текст для озвучки.
 *  • research (+ЛЛМ) → Claude собирает текст → в ctx.scratchpad.
 *  • voiceover (+ЛЛМ) → Claude пишет сценарий → подменяет params.text → базовый
 *    исполнитель прогоняет tts (Piper озвучивает уже готовый сценарий).
 *  • length (+ЛЛМ) → Claude по транскрипту выбирает момент → проставляет
 *    params.text="start-end" → базовый video_trimmer режет именно его.
 *  • broll → подбор клипов в стоках (Pexels/Pixabay, broll.ts) → params.clips →
 *    воркер вставляет перебивки; фото новости из scratchpad идёт первым.
 *  • avatar → движок heygen (облако, avatar_step.ts) или sadtalker (GPU-воркер);
 *    сценарий: текст узла → ЛЛМ по брифу → материал research/news.
 *
 * Всё остальное — без изменений уходит базовому исполнителю. Без ключей /
 * при ошибке — мягкая деградация (passthrough с заметкой), конвейер не падает.
 */

import type { RenderStep } from './types.js';
import type { StepContext, StepResult, StepExecutor } from './executor.js';
import {
  directorModel, generateVoiceoverScript, runResearch, writeNews, pickBestMoment, pickBrollKeywords,
} from './director.js';
import { fetchNewsFromSource, looksLikeNewsSource } from './news_fetch.js';
import { resolveBrollClips } from './broll.js';
import { runAvatarHeyGen } from './avatar_step.js';

/** Целевая длительность для «выбора момента» из choices.duration (15/30/60 → сек, иначе 30). */
function targetSeconds(params: Record<string, any>): number {
  const d = (params?.choices?.duration || [])[0];
  return d === '15' || d === '30' || d === '60' ? Number(d) : 30;
}

function joinNotes(...parts: Array<string | undefined | null>): string | undefined {
  return parts.filter(Boolean).join(' · ') || undefined;
}

function choice(params: Record<string, any>, id: string, def: string): string {
  const v = (params?.choices?.[id] || [])[0];
  return typeof v === 'string' && v ? v : def;
}

/** Относительный /uploads/... → абсолютный URL (для внешних сервисов/воркера). */
function toAbsolute(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  return base ? base + (url.startsWith('/') ? url : '/' + url) : null;
}

/** Тайминги перебивок из текста узла: «Тайминг по ритму: 0:05, 0:12» → секунды. */
function parseTimings(text: string): number[] {
  const m = text.match(/тайминг[^:]*:\s*([\d:.,\s]+)/i);
  if (!m) return [];
  return m[1].split(/[,\s]+/).filter(Boolean).map((t) => {
    const p = t.trim().split(':');
    return p.length === 2 ? Number(p[0]) * 60 + Number(p[1]) : Number(t);
  }).filter((n) => isFinite(n) && n >= 0);
}

export class DirectorExecutor implements StepExecutor {
  constructor(private base: StepExecutor) {}

  async execute(step: RenderStep, ctx: StepContext): Promise<StepResult> {
    const scratch = ctx.scratchpad || {};
    const model = directorModel(step.params);
    const text = String(step.params?.text || '').trim();
    // Главный промт (общий сценарий ролика) — общий контекст для всех ЛЛМ-шагов.
    const scenario = String((step.params as any)?.brief || ctx.brief || '').trim();
    const withScenario = (t: string) =>
      scenario ? (t ? `Общий сценарий ролика: ${scenario}\n\nЗадача этого шага: ${t}` : `Общий сценарий ролика: ${scenario}`) : t;

    // news → честный источник (RSS/t.me/сайт); ✨ — Claude переписывает материал/ищет по теме
    if (step.kind === 'news') {
      const notes: string[] = [];
      let material: string | null = null;
      if (looksLikeNewsSource(text)) {
        const f = await fetchNewsFromSource({ source: text, type: choice(step.params, 'type', '') });
        material = f.text;
        if (f.imageUrl) scratch.newsImage = f.imageUrl;               // подхватит B-roll/озвучка
        if (f.images?.length) scratch.newsImages = f.images;          // все кадры поста (альбом)
        notes.push(f.note);
      }
      if (step.llm) {
        const r = await writeNews({ tenantId: ctx.tenantId, topic: withScenario(text), material, model });
        scratch.news = r.text || material || undefined;
        notes.push(r.note);
      } else {
        scratch.news = material || undefined;
        if (!material) notes.push('новости: включите ✨ или дайте прямую ссылку на источник');
      }
      return { outputUrl: ctx.currentUrl, note: joinNotes(...notes) };
    }

    // research → текст в scratchpad, видео не меняем
    if (step.kind === 'research' && step.llm) {
      const r = await runResearch({ tenantId: ctx.tenantId, topic: withScenario(text), model });
      if (r.text) scratch.research = r.text;
      return { outputUrl: ctx.currentUrl, note: r.note };
    }

    // voiceover: ✨ → Claude пишет сценарий; без ✨/без ключа — материал news/research
    // из scratchpad идёт в TTS как есть (пресет «Новости» работает и без ключа Claude).
    // Без исходника (currentUrl=null) воркер соберёт базовое видео с нуля — передаём
    // ему фото новости (scratch.newsImage) для кен-бёрнс-подложки.
    if (step.kind === 'voiceover') {
      const material = String(scratch.news || scratch.research || '').trim();
      const baseImages = !ctx.currentUrl && typeof scratch.newsImage === 'string' ? { images: [scratch.newsImage] } : {};
      if (step.llm) {
        const r = await generateVoiceoverScript({
          tenantId: ctx.tenantId, brief: withScenario(text), notes: scratch.research || scratch.news, model,
        });
        const script = r.text || (!text ? material : '');
        if (script) scratch.voiceover = script; // пригодится аватару как сценарий
        const enriched = { ...step, params: { ...step.params, ...(script ? { text: script } : {}), ...baseImages } };
        const base = await this.base.execute(enriched, ctx);
        return { ...base, note: joinNotes(r.note, !r.text && script ? 'озвучка: читаем материал источника как есть' : undefined, base.note) };
      }
      if (!text && material) scratch.voiceover = material;
      const plainText = text || material;
      const enriched = { ...step, params: { ...step.params, ...(plainText ? { text: plainText } : {}), ...baseImages } };
      const base = await this.base.execute(enriched, ctx);
      return { ...base, note: joinNotes(!text && material ? 'озвучка: текст из блока Новости/Исследование' : undefined, base.note) };
    }

    // length: выбор момента, если включён ЛЛМ ИЛИ выбрана длительность «Лучший момент»,
    // и в тексте нет явного диапазона (явный диапазон — приоритетнее ЛЛМ).
    const wantsBest = step.llm || (step.params?.choices?.duration || []).includes('best');
    if (step.kind === 'length' && wantsBest && !/\d\s*[-–—]\s*\d/.test(text)) {
      const r = await pickBestMoment({
        tenantId: ctx.tenantId, sourceUrl: ctx.currentUrl, targetSec: targetSeconds(step.params), model,
      });
      const enriched = r.range ? { ...step, params: { ...step.params, text: r.range } } : step;
      const base = await this.base.execute(enriched, ctx);
      return { ...base, note: joinNotes(r.note, base.note) };
    }

    // broll → клипы из стоков/референса/кадров источника → воркер вставляет перебивки
    if (step.kind === 'broll') {
      const notes: string[] = [];
      const src = choice(step.params, 'src', 'stock'); // 'ai' (легаси) считаем стоками
      const clips: string[] = [];
      const newsImgs: string[] = Array.isArray(scratch.newsImages) && scratch.newsImages.length
        ? scratch.newsImages
        : (typeof scratch.newsImage === 'string' ? [scratch.newsImage] : []);
      if (src === 'source') {
        // Ограничение юзера: ТОЛЬКО кадры источника (фото поста/статьи), без стоков.
        clips.push(...newsImgs);
        if (step.params?.mediaUrl) { const abs = toAbsolute(step.params.mediaUrl); if (abs) clips.push(abs); }
        if (!clips.length) {
          return { outputUrl: ctx.currentUrl, note: 'b-roll: у источника нет кадров (блок «Новости» не дал фото) — перебивки пропущены' };
        }
        notes.push(`b-roll: только кадры источника (${clips.length})`);
      } else if (newsImgs.length) clips.push(newsImgs[0]); // фото новости — первая перебивка
      if (src === 'source') {
        // клипы уже собраны выше
      } else if (src === 'reference' && step.params?.mediaUrl) {
        const abs = toAbsolute(step.params.mediaUrl);
        if (abs) clips.push(abs);
      } else {
        // Запрос: текст узла (DNA пишет «Вставки по теме: …») → ЛЛМ-подбор → бриф.
        let query = text.replace(/вставки по теме:/i, '').split('·')[0].trim();
        if ((!query || step.llm) && (scenario || scratch.voiceover || scratch.news || scratch.research)) {
          const ctxText = [scenario, scratch.voiceover, scratch.news, scratch.research, query].filter(Boolean).join('\n').slice(0, 3000);
          const kw = await pickBrollKeywords({ tenantId: ctx.tenantId, context: ctxText, model });
          if (kw.text) { query = kw.text; notes.push(kw.note); }
        }
        if (query) {
          const r = await resolveBrollClips({ tenantId: ctx.tenantId, query, count: 3 });
          clips.push(...r.clips);
          notes.push(r.note);
        } else {
          notes.push('b-roll: не из чего подобрать запрос (заполните текст узла или бриф)');
        }
      }
      if (!clips.length) return { outputUrl: ctx.currentUrl, note: joinNotes(...notes) || 'b-roll: клипы не подобраны' };
      const enriched = { ...step, params: { ...step.params, clips, timings: parseTimings(text) } };
      const base = await this.base.execute(enriched, ctx);
      return { ...base, note: joinNotes(...notes, base.note) };
    }

    // avatar → HeyGen (облако) или SadTalker (GPU-воркер)
    if (step.kind === 'avatar') {
      const notes: string[] = [];
      // Сценарий: текст узла → ЛЛМ по брифу (с опорой) → материал research/news.
      let script = text;
      if (!script && step.llm && scenario) {
        const r = await generateVoiceoverScript({
          tenantId: ctx.tenantId, brief: withScenario(''), notes: scratch.research || scratch.news, model,
        });
        if (r.text) { script = r.text; notes.push(r.note); }
      }
      if (!script) script = String(scratch.voiceover || scratch.news || scratch.research || '');
      const engine = choice(step.params, 'engine', 'heygen');
      const enriched = { ...step, params: { ...step.params, text: script } };
      if (engine === 'sadtalker') {
        const base = await this.base.execute(enriched, ctx); // GPU-воркер (или skip с заметкой)
        return { ...base, note: joinNotes(...notes, base.note) };
      }
      const photo = toAbsolute(step.params?.mediaUrl);
      const r = await runAvatarHeyGen({
        tenantId: ctx.tenantId,
        photoUrl: photo || '',
        text: script,
        gender: choice(step.params, 'voice', 'female') === 'male' ? 'male' : 'female',
      });
      if (r.outputUrl) return { outputUrl: r.outputUrl, note: joinNotes(...notes, r.note) };
      // Облако не вышло → пробуем GPU-воркер, если подключён; иначе passthrough с причиной.
      const base = await this.base.execute(enriched, ctx);
      return { ...base, note: joinNotes(...notes, r.note, base.note) };
    }

    return this.base.execute(step, ctx);
  }
}
