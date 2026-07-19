/**
 * Диаризация записи через Gemini (аудио-понимание): СКОЛЬКО голосов и кто где говорит.
 *
 * Почему Gemini, а не DSP на воркере: реальную речь двух дикторов (с музыкой, паузами,
 * перебиваниями) корректно разделяет только настоящая модель. Пороговые/кластерные
 * эвристики (F0+тембр) валятся на живом звуке. Gemini «слышит» тембр и пол голоса.
 *
 * Число голосов НЕ задаётся снаружи — модель определяет его сама (1 или 2) и возвращает
 * speakers[] с полом каждого. Подсказки hostAVoice/hostBVoice необязательны: если фронт
 * их прислал, они идут как подсказка, а не как утверждение (иначе монолог разрезался бы
 * на двух выдуманных собеседников). Фронт по speakers[] сам решает, включать ли режим
 * диалога и раскладывать ли реплики на дорожки A/B.
 *
 * Использует Gemini-ключ ТЕНАНТА (тот же, что и AI-ракурсы студии). Аудио заливается
 * через Files API, ответ — строгий JSON {speakerCount, speakers, segments}.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);
/** ffprobe рядом с ffmpeg (FFMPEG_PATH). На web-VPS = /usr/bin/ffprobe. */
function ffprobeBin(): string {
  const f = process.env.FFMPEG_PATH || 'ffmpeg';
  return f.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
}
/** Длительность аудио (сек) через ffprobe; 0 если не удалось (тогда без якоря длины). */
async function probeDurationSec(file: string): Promise<number> {
  try {
    const { stdout } = await execFileP(ffprobeBin(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nv=1', file]);
    const d = parseFloat(String(stdout).trim());
    return Number.isFinite(d) && d > 0 ? d : 0;
  } catch { return 0; }
}

export interface DiarLine {
  speaker: 'A' | 'B';
  text: string;
  start: number;
  end: number;
}

/** Голос, найденный в записи (пол — по тембру, для подсказки на фронте). */
export interface DiarSpeaker {
  id: 'A' | 'B';
  gender: 'male' | 'female' | 'unknown';
}

/** Модель Gemini для диаризации по умолчанию (аудио-capable, быстрая/дешёвая). */
export const DIARIZE_MODEL = 'gemini-2.5-flash';

const DIAR_SCHEMA = {
  type: 'object',
  properties: {
    speakerCount: { type: 'integer' },
    speakers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ['A', 'B'] },
          gender: { type: 'string', enum: ['male', 'female', 'unknown'] },
        },
        required: ['id', 'gender'],
      },
    },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['A', 'B'] },
          start: { type: 'number' },
          end: { type: 'number' },
          text: { type: 'string' },
        },
        required: ['speaker', 'start', 'end', 'text'],
      },
    },
  },
  required: ['speakerCount', 'speakers', 'segments'],
};

/** Подсказка о поле голоса — ТОЛЬКО если фронт её прислал (иначе пол определяет модель). */
function genderHint(id: 'A' | 'B', voice?: string): string {
  if (voice === 'male') return `Спикер ${id} — мужчина (низкий мужской голос). `;
  if (voice === 'female') return `Спикер ${id} — женщина (более высокий женский голос). `;
  return '';
}

function extForAudioMime(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('wav')) return '.wav';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return '.m4a';
  if (m.includes('ogg')) return '.ogg';
  if (m.includes('webm')) return '.webm';
  if (m.includes('flac')) return '.flac';
  return '.mp3';
}

async function fetchAudioToTemp(url: string): Promise<{ path: string; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`аудио не скачалось (HTTP ${r.status})`);
  const mime = (r.headers.get('content-type') || 'audio/mpeg').split(';')[0].trim();
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length) throw new Error('пустой аудиофайл');
  const p = path.join(os.tmpdir(), `diar-${randomUUID()}${extForAudioMime(mime)}`);
  fs.writeFileSync(p, buf);
  return { path: p, mime: mime.startsWith('audio/') || mime.startsWith('video/') ? mime : 'audio/mpeg' };
}

/**
 * Постобработка ответа модели → реплики + фактически найденные голоса.
 *
 * Голоса считаем ПО РЕПЛИКАМ, а не по speakerCount: модель бывает рассинхронена
 * (заявит два голоса, а разметит всё как A — или наоборот). Отдельный случай —
 * монолог, целиком помеченный как B: приводим к A, иначе фронт увидит «есть B»
 * и зря включит режим диалога.
 *
 * Экспортируется ради тестов: сам diarizeWithGemini ходит в сеть, эта часть — чистая.
 */
export function normalizeDiarization(parsed: any): { lines: DiarLine[]; speakers: DiarSpeaker[] } {
  const segs = Array.isArray(parsed?.segments) ? parsed.segments : Array.isArray(parsed) ? parsed : [];
  const lines: DiarLine[] = [];
  for (const s of segs) {
    const spk = String(s?.speaker || '').toUpperCase() === 'B' ? 'B' : 'A';
    const start = Number(s?.start);
    const end = Number(s?.end);
    const text = String(s?.text || '').trim();
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    lines.push({ speaker: spk, text, start, end });
  }
  lines.sort((a, b) => a.start - b.start);

  const genderOf = new Map<string, DiarSpeaker['gender']>();
  for (const s of (Array.isArray(parsed?.speakers) ? parsed.speakers : [])) {
    const id = String(s?.id || '').toUpperCase();
    const g = String(s?.gender || '').toLowerCase();
    if (id === 'A' || id === 'B') genderOf.set(id, g === 'male' || g === 'female' ? g : 'unknown');
  }
  if (lines.length && !lines.some((l) => l.speaker === 'A')) {
    for (const l of lines) l.speaker = 'A';
    if (genderOf.has('B') && !genderOf.has('A')) genderOf.set('A', genderOf.get('B')!);
    genderOf.delete('B');
  }
  const speakers: DiarSpeaker[] = (['A', 'B'] as const)
    .filter((id) => lines.some((l) => l.speaker === id))
    .map((id) => ({ id, gender: genderOf.get(id) || 'unknown' }));
  return { lines, speakers };
}

/**
 * Диаризует аудио по URL через Gemini. Возвращает реплики [{speaker,start,end,text}].
 * Бросает ошибку при неудаче (нет JSON / нет сегментов / модель недоступна).
 */
export async function diarizeWithGemini(opts: {
  apiKey: string;
  audioUrl: string;
  model?: string;
  hostAVoice?: string;
  hostBVoice?: string;
}): Promise<{ lines: DiarLine[]; speakers: DiarSpeaker[]; note: string }> {
  const model = opts.model || DIARIZE_MODEL;
  const { GoogleGenAI, createPartFromUri } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });

  const { path: tmp, mime } = await fetchAudioToTemp(opts.audioUrl);
  const durSec = await probeDurationSec(tmp); // якорь длины: не даём Gemini схлопнуть всё в начало
  let uploaded: any = null;
  try {
    let file: any = await ai.files.upload({ file: tmp, config: { mimeType: mime } });
    uploaded = file;
    const deadline = Date.now() + 120_000;
    while (file?.state === 'PROCESSING' && file?.name && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      file = await ai.files.get({ name: file.name });
    }
    if (!file || file.state !== 'ACTIVE' || !file.uri) {
      throw new Error('Files API: аудио не готово к обработке');
    }

    const prompt =
      'Это аудиозапись. СНАЧАЛА определи, сколько РАЗНЫХ людей в ней говорит — один или два.\n'
      + 'Если человек ОДИН: верни speakerCount=1, speakers=[{"id":"A",...}], все реплики со speaker="A". '
      + 'НЕ выдумывай второго собеседника: смена интонации, темпа, громкости, цитирование чужих слов '
      + 'или чтение по ролям одним и тем же человеком — это НЕ второй голос.\n'
      + 'Если людей ДВОЕ: верни speakerCount=2, speakers=[{"id":"A",...},{"id":"B",...}] и раздели реплики между A и B. '
      + 'Первым (A) считай того, кто заговорил в записи раньше.\n'
      + 'Для каждого найденного голоса укажи пол по тембру: "male" | "female" | "unknown".\n'
      + genderHint('A', opts.hostAVoice) + genderHint('B', opts.hostBVoice)
      + (opts.hostAVoice || opts.hostBVoice ? '(это подсказка пользователя — если слышишь иначе, верь своим ушам)\n' : '')
      + 'Разделяя голоса, опирайся именно на ТЕМБР и ВЫСОТУ голоса (мужской/женский, характер голоса), а не на смысл слов. '
      + 'Один и тот же голос — это всегда один и тот же спикер на всей записи (не путай их местами в середине). '
      + 'Дроби речь на короткие реплики по 2–8 секунд, по смыслу и по смене говорящего. '
      + 'Таймкоды — в СЕКУНДАХ (float) от начала записи, максимально точные, по возрастанию, без наложений. '
      + (durSec > 0
        ? `Длительность записи ≈ ${Math.round(durSec)} секунд — таймкоды ДОЛЖНЫ покрывать ВСЮ запись: первая реплика около 0с, последняя заканчивается около ${Math.round(durSec)}с. НЕ сжимай реплики в начало и НЕ используй крошечные значения (0.1, 0.2…) для всей записи. `
        : '')
      + 'Пустые/шумовые участки пропускай.\n'
      + 'Верни СТРОГО JSON: {"speakerCount":1|2,"speakers":[{"id":"A"|"B","gender":"male"|"female"|"unknown"}],'
      + '"segments":[{"speaker":"A"|"B","start":число,"end":число,"text":"..."}]}';

    // Жёсткий таймаут: без него зависший generateContent держит HTTP-запрос дольше
    // прокси-таймаута, и фолбэк на воркер не срабатывает вовсе.
    const GEN_TIMEOUT_MS = 240_000;
    const genPromise = ai.models.generateContent({
      model,
      contents: [
        { role: 'user', parts: [createPartFromUri(file.uri, file.mimeType || mime), { text: prompt }] },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: DIAR_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 65536,
      },
    });
    genPromise.catch(() => { /* поздний reject после таймаута не должен стать unhandled */ });
    let genTimer: ReturnType<typeof setTimeout> | undefined;
    let resp: any;
    try {
      resp = await Promise.race([
        genPromise,
        new Promise((_, rej) => { genTimer = setTimeout(() => rej(new Error(`Gemini не ответил за ${GEN_TIMEOUT_MS / 1000}с — фолбэк на воркер`)), GEN_TIMEOUT_MS); }),
      ]);
    } finally {
      clearTimeout(genTimer);
    }

    const txt =
      (typeof resp?.text === 'string' && resp.text)
      || (resp?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || '').join('')
      || '';
    let parsed: any;
    try {
      parsed = JSON.parse(txt);
    } catch {
      throw new Error('Gemini вернул не-JSON');
    }
    const { lines, speakers } = normalizeDiarization(parsed);
    if (!lines.length) throw new Error('Gemini не вернул реплик');
    // Валидация: если таймкоды не покрыли и половины записи — Gemini «схлопнул» их (баг 33с→<1с).
    // Бросаем → вызывающая сторона падает на воркер (whisper даёт реальные таймкоды по всей длине).
    const maxEnd = lines.reduce((m, l) => (l.end > m ? l.end : m), 0);
    if (durSec > 3 && maxEnd < durSec * 0.5) {
      throw new Error(`Gemini таймкоды не покрыли запись (макс ${maxEnd.toFixed(1)}с из ~${Math.round(durSec)}с) — фолбэк на воркер`);
    }
    return {
      lines,
      speakers,
      note: `диаризация: ${lines.length} реплик, голосов — ${speakers.length} (Gemini ${model}${durSec > 0 ? `, ~${Math.round(durSec)}с` : ''})`,
    };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best-effort */ }
    try { if (uploaded?.name) await ai.files.delete({ name: uploaded.name }); } catch { /* best-effort */ }
  }
}
