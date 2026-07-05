/**
 * «Иллюстратор» — автоподбор видеоряда (b-roll) под реплики подкаста/рассказа.
 *
 * Идея (как в новостях): пока ведущие говорят, кадр иллюстрируется материалами из
 * Галереи пользователя — фото (Ken Burns) и видео-референсами (фрагменты). Подбор:
 *   1) кандидаты = Галерея (референсы + «Из анализа») + скачанные тренды;
 *   2) картинкам один раз генерируются короткие описания (Gemini vision, кэш в БД);
 *   3) LLM-раскадровка: реплики с таймингами + каталог описаний → «какой ассет на
 *      какую реплику, каким планом (карточка/во весь кадр), с каким заголовком»;
 *   4) без Gemini-ключа — детерминированный фолбэк: пересечение слов реплики и
 *      описания (как keyword-матчинг в MoneyPrinterTurbo), без заголовков.
 *
 * Результат пишется в существующие поля реплик (dialogue[i].image/anim) + новые
 * mode/title — их понимают обе склейки (студийная и воркерный сплит-скрин).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import pool from '../../db/index.js';
import { listAssets, listFolder, ANALYZED_FOLDER } from '../media/assets.js';
import { listRecentVideos } from '../trends/service.js';

const FFMPEG_BIN: string = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || 'ffmpeg';

/** Реплика на входе подбора (idx = позиция в dialogue). */
export interface IllusLine { idx: number; speaker: 'A' | 'B'; text: string; dur: number }
/** Кандидат-ассет каталога. */
export interface IllusCandidate { id: string; url: string; type: 'image' | 'video'; caption: string; durationSec?: number }
/** Назначение иллюстрации реплике. */
export interface IllusShot { idx: number; image: string; imageName?: string; anim: string; mode: 'card' | 'full'; title?: string }

const CAPTION_MODEL = 'gemini-2.5-flash';
const SHOTLIST_MODEL = 'gemini-2.5-flash';

// ── Кандидаты ─────────────────────────────────────────────────────────────────

/** Собрать каталог кандидатов тенанта: референсы + «Из анализа» + скачанные тренды. */
export async function gatherCandidates(tenantId: string): Promise<IllusCandidate[]> {
  const [refs, analyzed, trends] = await Promise.all([
    listAssets(tenantId, 'reference'),
    listFolder(tenantId, ANALYZED_FOLDER),
    listRecentVideos(tenantId, 80, true),
  ]);
  const out: IllusCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: IllusCandidate) => { if (c.url && !seen.has(c.url)) { seen.add(c.url); out.push(c); } };
  for (const a of [...refs, ...analyzed]) {
    if (a.mediaType !== 'image' && a.mediaType !== 'video') continue;
    push({ id: `m_${a.id}`, url: a.fileUrl, type: a.mediaType as 'image' | 'video', caption: (a.originalName || '').trim() });
  }
  for (const v of trends) {
    if (!v.fileUrl) continue;
    const caption = [(v.description || '').trim(), v.authorName ? `автор: ${v.authorName}` : ''].filter(Boolean).join('; ');
    push({ id: `t_${v.id}`, url: v.fileUrl, type: 'video', caption: caption || 'видео из трендов', durationSec: v.durationSec });
  }
  // потолки: картинки важнее описывать все, видео и так с описаниями
  const imgs = out.filter((c) => c.type === 'image').slice(0, 48);
  const vids = out.filter((c) => c.type === 'video').slice(0, 48);
  return [...imgs, ...vids];
}

// ── Кэш описаний (asset_captions) ─────────────────────────────────────────────

async function getCachedCaptions(tenantId: string, urls: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!urls.length) return map;
  try {
    const r = await pool.query(
      `SELECT url, caption FROM asset_captions WHERE tenant_id = $1 AND url = ANY($2)`,
      [tenantId, urls]
    );
    for (const row of r.rows as any[]) map.set(row.url, row.caption);
  } catch { /* таблицы может не быть в fallback-режиме — просто без кэша */ }
  return map;
}

async function saveCaption(tenantId: string, url: string, caption: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO asset_captions (tenant_id, url, caption) VALUES ($1,$2,$3)
       ON CONFLICT (tenant_id, url) DO UPDATE SET caption = EXCLUDED.caption`,
      [tenantId, url, caption]
    );
  } catch { /* best-effort */ }
}

// ── Vision-описания картинок (Gemini, батчем, с уменьшением до превью) ────────

/** Уменьшить картинку до превью (jpeg ≤384px) — инлайним в запрос без мегабайтов. */
async function thumbBase64(absUrl: string): Promise<{ base64: string; mime: string } | null> {
  let tmpIn: string | null = null;
  const tmpOut = path.join(os.tmpdir(), `illus-${randomUUID().slice(0, 8)}.jpg`);
  try {
    const r = await fetch(absUrl);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) return null;
    tmpIn = path.join(os.tmpdir(), `illus-in-${randomUUID().slice(0, 8)}`);
    fs.writeFileSync(tmpIn, buf);
    await new Promise<void>((resolve, reject) => {
      const ff = spawn(FFMPEG_BIN, ['-y', '-i', tmpIn!, '-vf', 'scale=384:-2', '-frames:v', '1', '-q:v', '6', tmpOut], { stdio: ['ignore', 'ignore', 'pipe'] });
      const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } reject(new Error('thumb timeout')); }, 20_000);
      ff.on('error', (e) => { clearTimeout(timer); reject(e); });
      ff.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('thumb ffmpeg ' + code)); });
    });
    return { base64: fs.readFileSync(tmpOut).toString('base64'), mime: 'image/jpeg' };
  } catch {
    return null;
  } finally {
    try { if (tmpIn) fs.unlinkSync(tmpIn); } catch { /* */ }
    try { fs.unlinkSync(tmpOut); } catch { /* */ }
  }
}

/** Человеческое объяснение типовых отказов Gemini (квота/биллинг/доступ) для заметки в UI. */
function geminiProblem(e: unknown): string | null {
  const s = String((e as any)?.message || e || '');
  if (/RESOURCE_EXHAUSTED|credits are depleted|"code"\s*:\s*429|status.*429/i.test(s)) {
    return 'Gemini-ключ исчерпан (429): пополните биллинг в AI Studio (ai.studio/projects) или вставьте другой ключ в Настройки → Gemini API';
  }
  if (/PERMISSION_DENIED|API key not valid|"code"\s*:\s*403/i.test(s)) {
    return 'Gemini-ключ не принят (403): проверьте ключ в Настройки → Gemini API';
  }
  return null;
}

const CAPTIONS_SCHEMA = {
  type: 'object',
  properties: {
    captions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { n: { type: 'number' }, caption: { type: 'string' } },
        required: ['n', 'caption'],
      },
    },
  },
  required: ['captions'],
};

/** Описать картинки батчем (≤16 за вызов). Возвращает Map url→caption только для удавшихся
 *  + problem (человеческое объяснение, если Gemini отказал по квоте/ключу). */
async function captionImages(apiKey: string, items: Array<{ url: string; absUrl: string }>, deadline: number): Promise<{ caps: Map<string, string>; problem: string | null }> {
  const out = new Map<string, string>();
  let problem: string | null = null;
  if (!items.length) return { caps: out, problem };
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  for (let i = 0; i < items.length; i += 16) {
    if (Date.now() > deadline) break; // не выходим за бюджет ответа — остальные опишем в другой раз
    const batch = items.slice(i, i + 16);
    const thumbs = await Promise.all(batch.map((b) => thumbBase64(b.absUrl)));
    const parts: any[] = [];
    const idxMap: number[] = []; // номер в промте → индекс в batch
    thumbs.forEach((t, k) => {
      if (!t) return;
      idxMap.push(k);
      parts.push({ text: `Изображение №${idxMap.length}:` });
      parts.push({ inlineData: { mimeType: t.mime, data: t.base64 } });
    });
    if (!idxMap.length) continue;
    parts.push({
      text: 'Опиши КАЖДОЕ пронумерованное изображение одной короткой фразой по-русски (до 15 слов): '
        + 'что изображено — объекты, люди, место, действие, настроение. Без вступлений. '
        + 'Верни СТРОГО JSON: {"captions":[{"n":номер,"caption":"..."}]}',
    });
    try {
      const genPromise = ai.models.generateContent({
        model: CAPTION_MODEL,
        contents: [{ role: 'user', parts }],
        config: { responseMimeType: 'application/json', responseSchema: CAPTIONS_SCHEMA, temperature: 0.2, maxOutputTokens: 4096 },
      });
      genPromise.catch(() => { /* поздний reject после гонки не должен стать unhandled */ });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const resp: any = await Promise.race([
        genPromise,
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('caption timeout')), Math.max(5_000, deadline - Date.now())); }),
      ]).finally(() => clearTimeout(timer));
      const txt = (typeof resp?.text === 'string' && resp.text)
        || (resp?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('') || '';
      const parsed = JSON.parse(txt);
      for (const c of (Array.isArray(parsed?.captions) ? parsed.captions : [])) {
        const n = Number(c?.n);
        const cap = String(c?.caption || '').trim();
        const k = idxMap[n - 1];
        if (k !== undefined && cap) out.set(batch[k].url, cap.slice(0, 200));
      }
    } catch (e: any) {
      console.warn('[illustrate] описания картинок не удались (батч):', e?.message || e);
      problem = problem || geminiProblem(e);
      if (problem) break; // квота/ключ — дальнейшие батчи бессмысленны
    }
  }
  return { caps: out, problem };
}

// ── Раскадровка LLM ───────────────────────────────────────────────────────────

const SHOTLIST_SCHEMA = {
  type: 'object',
  properties: {
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line: { type: 'number' },
          asset: { type: 'string' },   // id кандидата; пустая строка = без иллюстрации
          mode: { type: 'string', enum: ['card', 'full'] },
          title: { type: 'string' },   // короткий заголовок для плашки (может быть пустым)
        },
        required: ['line', 'asset', 'mode'],
      },
    },
  },
  required: ['assignments'],
};

async function shotlistWithGemini(apiKey: string, lines: IllusLine[], candidates: IllusCandidate[], brief: string): Promise<Map<number, { asset: IllusCandidate; mode: 'card' | 'full'; title?: string }>> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const linesTxt = lines.map((l) => `${l.idx}. [${l.speaker}, ~${Math.round(l.dur)}с] ${l.text}`).join('\n');
  const candTxt = candidates.map((c) => `${c.id} (${c.type === 'video' ? 'видео' : 'фото'}${c.durationSec ? `, ${c.durationSec}с` : ''}): ${c.caption || 'без описания'}`).join('\n');
  const prompt =
    'Ты — выпускающий редактор новостного видео. Ведущие озвучивают реплики, а ты подбираешь ВИДЕОРЯД '
    + '(перебивки/b-roll) из каталога материалов, чтобы зритель видел иллюстрацию к тому, о чём говорят.\n'
    + (brief ? `Тема выпуска: ${brief.slice(0, 500)}\n` : '')
    + `\nРЕПЛИКИ (по порядку, с номерами):\n${linesTxt}\n`
    + `\nКАТАЛОГ МАТЕРИАЛОВ (id: описание):\n${candTxt}\n`
    + '\nПравила режиссуры:\n'
    + '1. Иллюстрация обязана соответствовать СУТИ реплики. Если подходящего материала нет — asset="" (без иллюстрации, в кадре ведущие). НЕ притягивай за уши.\n'
    + '2. Первая реплика — всегда asset="" (зритель должен увидеть ведущих).\n'
    + '3. Не ставь один и тот же материал на соседние реплики. Один материал можно использовать повторно не раньше чем через 3 реплики.\n'
    + '4. Примерно каждая третья-четвёртая реплика — без иллюстрации (возврат к ведущим, чтобы зритель не терял их).\n'
    + '5. mode="full" — материал во весь кадр (главные факты, сильные кадры); mode="card" — карточкой поверх сцены (уточнения, детали). Полноэкранных должно быть больше.\n'
    + '6. Для mode="full" придумай title — заголовок плашки, 2–5 слов, по-русски, суть реплики (как бегущая строка новостей). Для card — title="".\n'
    + 'Верни СТРОГО JSON {"assignments":[{"line":номер,"asset":"id или пусто","mode":"card"|"full","title":"..."}]} — по одному объекту на КАЖДУЮ реплику.';
  const genPromise = ai.models.generateContent({
    model: SHOTLIST_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', responseSchema: SHOTLIST_SCHEMA, temperature: 0.25, maxOutputTokens: 16384 },
  });
  genPromise.catch(() => { /* поздний reject после гонки */ });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resp: any = await Promise.race([
    genPromise,
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Gemini-раскадровка: таймаут')), 45_000); }),
  ]).finally(() => clearTimeout(timer));
  const txt = (typeof resp?.text === 'string' && resp.text)
    || (resp?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('') || '';
  const parsed = JSON.parse(txt);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const res = new Map<number, { asset: IllusCandidate; mode: 'card' | 'full'; title?: string }>();
  for (const a of (Array.isArray(parsed?.assignments) ? parsed.assignments : [])) {
    const li = Number(a?.line);
    const cand = byId.get(String(a?.asset || '').trim());
    if (!Number.isFinite(li) || !cand) continue;
    if (!lines.some((l) => l.idx === li)) continue;
    const mode: 'card' | 'full' = a?.mode === 'card' ? 'card' : 'full';
    const title = String(a?.title || '').trim().slice(0, 60);
    res.set(li, { asset: cand, mode, title: mode === 'full' && title ? title : undefined });
  }
  return res;
}

// ── Фолбэк: keyword-матчинг (без LLM-ключа) ───────────────────────────────────

/** Огрубление слова до «стема»: кириллица/латиница, ≥4 символов, первые 5 букв. */
function stems(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of String(text).toLowerCase().replace(/[^a-zа-яё0-9\s]/gi, ' ').split(/\s+/)) {
    if (w.length >= 4) out.add(w.slice(0, 5));
  }
  return out;
}

function keywordShotlist(lines: IllusLine[], candidates: IllusCandidate[]): Map<number, { asset: IllusCandidate; mode: 'card' | 'full'; title?: string }> {
  const res = new Map<number, { asset: IllusCandidate; mode: 'card' | 'full'; title?: string }>();
  const candStems = candidates.map((c) => ({ c, s: stems(c.caption) }));
  const lastUse = new Map<string, number>(); // id → номер реплики последнего показа
  let sinceHosts = 0;
  for (const l of lines) {
    if (l.idx === 0) { sinceHosts = 0; continue; }        // первая — ведущие
    if (sinceHosts >= 3) { sinceHosts = 0; continue; }    // возврат к ведущим
    const ls = stems(l.text);
    let best: { c: IllusCandidate; score: number } | null = null;
    for (const { c, s } of candStems) {
      const last = lastUse.get(c.id);
      if (last !== undefined && l.idx - last < 3) continue; // не повторять слишком часто
      let score = 0;
      for (const st of ls) if (s.has(st)) score++;
      if (score > 0 && (!best || score > best.score)) best = { c, score };
    }
    if (best) {
      res.set(l.idx, { asset: best.c, mode: best.score >= 2 ? 'full' : 'card' });
      lastUse.set(best.c.id, l.idx);
      sinceHosts++;
    }
  }
  return res;
}

// ── Публичная функция подбора ─────────────────────────────────────────────────

/** Автоподбор иллюстраций к репликам. apiKey (Gemini) необязателен — без него фолбэк. */
export async function illustrateDialogue(opts: {
  tenantId: string;
  apiKey?: string | null;
  lines: IllusLine[];
  brief?: string;
  publicBase?: string;
}): Promise<{ shots: IllusShot[]; note: string }> {
  const lines = opts.lines.filter((l) => (l.text || '').trim());
  if (!lines.length) return { shots: [], note: 'нет реплик для подбора' };
  const candidates = await gatherCandidates(opts.tenantId);
  if (!candidates.length) {
    return { shots: [], note: 'в Галерее нет материалов (фото/видео/тренды) — загрузите или скачайте, из чего собирать видеоряд' };
  }
  const abs = (u: string) => /^https?:\/\//i.test(u) ? u : (opts.publicBase ? opts.publicBase + (u.startsWith('/') ? u : '/' + u) : u);

  // Описания картинок: кэш → vision (в бюджете ~35с) → имя файла.
  let visionCount = 0;
  let keyProblem: string | null = null; // квота/невалидный ключ — показываем пользователю прямо в заметке
  const images = candidates.filter((c) => c.type === 'image');
  const cached = await getCachedCaptions(opts.tenantId, images.map((c) => c.url));
  for (const c of images) { const hit = cached.get(c.url); if (hit) c.caption = hit; }
  const need = images.filter((c) => !cached.get(c.url));
  if (opts.apiKey && need.length) {
    const fresh = await captionImages(opts.apiKey, need.map((c) => ({ url: c.url, absUrl: abs(c.url) })), Date.now() + 35_000);
    visionCount = fresh.caps.size;
    keyProblem = fresh.problem;
    for (const c of need) {
      const cap = fresh.caps.get(c.url);
      if (cap) { c.caption = cap; void saveCaption(opts.tenantId, c.url, cap); }
    }
  }
  for (const c of candidates) if (!c.caption) c.caption = c.type === 'video' ? 'видео без описания' : 'изображение без описания';

  // Раскадровка: LLM → фолбэк на ключевые слова.
  let assigned: Map<number, { asset: IllusCandidate; mode: 'card' | 'full'; title?: string }>;
  let engine = 'ключевые слова';
  if (opts.apiKey) {
    try {
      assigned = await shotlistWithGemini(opts.apiKey, lines, candidates, opts.brief || '');
      engine = `Gemini ${SHOTLIST_MODEL}`;
      if (!assigned.size) throw new Error('пустая раскадровка');
    } catch (e: any) {
      console.warn('[illustrate] LLM-раскадровка не удалась, фолбэк на ключевые слова:', e?.message || e);
      keyProblem = keyProblem || geminiProblem(e);
      assigned = keywordShotlist(lines, candidates);
      engine = keyProblem ? 'ключевые слова' : 'ключевые слова (Gemini не ответил)';
    }
  } else {
    assigned = keywordShotlist(lines, candidates);
    engine = 'ключевые слова (нет Gemini-ключа — подключите в Настройки → Gemini API для умного подбора)';
  }

  // Пост-валидация: не дублировать ассет в соседних репликах, первая — без иллюстрации.
  let prevAsset: string | null = null;
  const shots: IllusShot[] = [];
  const sorted = [...assigned.entries()].sort((a, b) => a[0] - b[0]);
  for (const [idx, a] of sorted) {
    if (idx === 0 && lines.length > 1) continue;
    if (prevAsset === a.asset.id) continue;
    prevAsset = a.asset.id;
    const name = a.asset.caption.slice(0, 48) || 'иллюстрация';
    shots.push({
      idx,
      image: a.asset.url,
      imageName: name,
      anim: a.mode === 'full' ? 'fade' : 'auto',
      mode: a.mode,
      title: a.title,
    });
  }
  const full = shots.filter((s) => s.mode === 'full').length;
  let note = `иллюстрации: ${shots.length} из ${lines.length} реплик (во весь кадр ${full}, карточкой ${shots.length - full}); `
    + `каталог ${candidates.length} (фото ${images.length}, видео ${candidates.length - images.length})`
    + (visionCount ? `, новых описаний ${visionCount}` : '')
    + `; подбор: ${engine}`;
  if (keyProblem) note += `. ⚠ ${keyProblem}`;
  if (!shots.length && engine.startsWith('ключевые слова')) {
    note += '. Совет: грубый подбор по словам почти не совпадает — восстановите Gemini-ключ и нажмите ещё раз, либо прикрепите медиа вручную (иконка картинки у реплики; там же есть загрузка файлов).';
  }
  return { shots, note };
}
