/**
 * TrendTraffic — серверный ВИДЕОАНАЛИЗ тренда по кадрам (Gemini Files API).
 *
 * До этого TrendDNA строилась только по ТЕКСТОВЫМ сигналам (описание/метрики/
 * комментарии), а sceneBeats были LLM-реконструкцией. Настоящий покадровый разбор
 * жил лишь в браузерном расширении (iframe + Gemini из бандла) и в БД не попадал.
 * Здесь — его серверный эквивалент: скачанный файл видео (uploads/source-videos)
 * загружается в Gemini Files API (лимита inline 20МБ нет), модель смотрит РЕАЛЬНЫЕ
 * кадры и возвращает структурный визуальный разбор. Результат вливается в TrendDNA
 * через applyVisualInsight (dna.ts) — sceneBeats становятся настоящими.
 *
 * Мягкая деградация: нет ключа Gemini / файл пропал / таймаут → null (ДНК остаётся
 * текстовой, конвейер не падает). Паттерн Files API 1:1 с audio_diarize.ts.
 */

import fs from 'fs';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import type { SceneBeat } from './dna.js';

export const VIDEO_INSIGHT_MODEL = 'gemini-2.5-flash';

export interface VisualInsight {
  sceneBeats: SceneBeat[];   // реальные сцены по кадрам (таймкоды из видео)
  visualStyle: string;       // план/свет/темп/палитра — как СНЯТО на самом деле
  hookVisual: string;        // что происходит в первые 3 секунды (визуально)
  textOverlays: string[];    // надписи, появляющиеся в кадре (по порядку)
  cutsCount?: number;        // число монтажных склеек
  model: string;
}

const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    sceneBeats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          t: { type: 'number' },
          desc: { type: 'string' },
          intensity: { type: 'string', enum: ['low', 'mid', 'high'] },
        },
        required: ['t', 'desc'],
      },
    },
    visualStyle: { type: 'string' },
    hookVisual: { type: 'string' },
    textOverlays: { type: 'array', items: { type: 'string' } },
    cutsCount: { type: 'number' },
  },
  required: ['sceneBeats', 'visualStyle', 'hookVisual'],
};

/**
 * Покадровый разбор локального файла видео. null = анализ недоступен (нет ключа /
 * файла / модель не ответила) — вызывающий продолжает с текстовой ДНК.
 */
export async function analyzeVideoVisual(tenantId: string, filePath: string): Promise<VisualInsight | null> {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const apiKey = await getEffectiveGeminiKey(tenantId);
    if (!apiKey) return null;

    const { GoogleGenAI, createPartFromUri } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    let uploaded: any = null;
    try {
      let file: any = await ai.files.upload({ file: filePath, config: { mimeType: 'video/mp4' } });
      uploaded = file;
      const deadline = Date.now() + 120_000;
      while (file?.state === 'PROCESSING' && file?.name && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500));
        file = await ai.files.get({ name: file.name });
      }
      if (!file || file.state !== 'ACTIVE' || !file.uri) throw new Error('Files API: видео не готово к обработке');

      const prompt =
        'Это короткое вертикальное видео из соцсети (TikTok/Reels/Shorts). Посмотри его ЦЕЛИКОМ и сделай '
        + 'точный визуальный разбор по РЕАЛЬНЫМ кадрам (не выдумывай то, чего нет в видео):\n'
        + '1) sceneBeats — сцены/планы с таймкодами в секундах от начала: что видно в кадре, смена планов, '
        + 'действия; intensity = насколько момент цепляет (low/mid/high).\n'
        + '2) visualStyle — как снято: план (крупный/средний), свет, темп монтажа, палитра, вертикаль/горизонталь.\n'
        + '3) hookVisual — что ИМЕННО происходит визуально в первые 3 секунды (первый кадр, движение, надпись).\n'
        + '4) textOverlays — все надписи, появляющиеся в кадре, по порядку (если есть).\n'
        + '5) cutsCount — сколько монтажных склеек в ролике.\n'
        + 'Пиши на русском, конкретно. Верни СТРОГО JSON по схеме.';

      const GEN_TIMEOUT_MS = 240_000;
      const genPromise = ai.models.generateContent({
        model: VIDEO_INSIGHT_MODEL,
        contents: [{ role: 'user', parts: [createPartFromUri(file.uri, file.mimeType || 'video/mp4'), { text: prompt }] }],
        config: { responseMimeType: 'application/json', responseSchema: INSIGHT_SCHEMA, temperature: 0.1, maxOutputTokens: 16384 },
      });
      genPromise.catch(() => { /* поздний reject после таймаута не должен стать unhandled */ });
      let genTimer: ReturnType<typeof setTimeout> | undefined;
      let resp: any;
      try {
        resp = await Promise.race([
          genPromise,
          new Promise((_, rej) => { genTimer = setTimeout(() => rej(new Error(`Gemini не ответил за ${GEN_TIMEOUT_MS / 1000}с`)), GEN_TIMEOUT_MS); }),
        ]);
      } finally {
        clearTimeout(genTimer);
      }

      const txt =
        (typeof resp?.text === 'string' && resp.text)
        || (resp?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('')
        || '';
      const j = JSON.parse(txt);
      const beats: SceneBeat[] = (Array.isArray(j?.sceneBeats) ? j.sceneBeats : [])
        .map((b: any) => ({
          t: Math.max(0, Number(b?.t) || 0),
          desc: String(b?.desc || '').slice(0, 200),
          intensity: ['low', 'mid', 'high'].includes(b?.intensity) ? b.intensity : undefined,
        }))
        .filter((b: SceneBeat) => b.desc)
        .slice(0, 24);
      if (!beats.length) throw new Error('Gemini не вернул сцен');
      return {
        sceneBeats: beats,
        visualStyle: String(j?.visualStyle || '').slice(0, 400),
        hookVisual: String(j?.hookVisual || '').slice(0, 400),
        textOverlays: (Array.isArray(j?.textOverlays) ? j.textOverlays : []).map((s: any) => String(s || '').slice(0, 120)).filter(Boolean).slice(0, 20),
        cutsCount: Number.isFinite(Number(j?.cutsCount)) ? Math.max(0, Math.round(Number(j.cutsCount))) : undefined,
        model: VIDEO_INSIGHT_MODEL,
      };
    } finally {
      try { if (uploaded?.name) await ai.files.delete({ name: uploaded.name }); } catch { /* best-effort */ }
    }
  } catch (e) {
    console.warn('[trends] видеоанализ по кадрам недоступен:', (e as Error).message);
    return null;
  }
}
