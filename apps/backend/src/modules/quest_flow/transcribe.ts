/**
 * Транскрипция аудио от Quest Flow + детекция языка и диалекта.
 *
 * Используется в quest_flow/inbound, когда клиент пишет голосом через Telegram-бот.
 *
 * Реализация:
 *  1. Подаём аудио + промт в Gemini Flash multimodal → получаем {text, language, dialect}.
 *  2. Если detected language имеет dialect_rules в БД (созданные суперадмином в /admin/dialects),
 *     загружаем подходящее правило (где `is_active = true`) и возвращаем его инструкцию —
 *     responder подмешает в systemInstruction для более точного ответа.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import pool from '../../db/index.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';

export interface TranscribeResult {
  text: string;
  language: string | null;     // ISO-639-1 (ru, en, ...)
  dialect: string | null;      // например "Узбекско-русский (Ферганская долина)"
  dialectInstruction: string | null; // compiled_instruction из dialect_rules, если есть
}

const TRANSCRIBE_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash';

const TRANSCRIBE_PROMPT = `You are an audio transcriber. Listen to the provided audio and return STRICTLY valid JSON (no markdown, no preamble):

{
  "text": "<exact transcription in original language, preserve punctuation>",
  "language": "<ISO-639-1 code, e.g. ru, en, uz, kk, fr>",
  "dialect": "<short dialect/regional variant name in Russian if clearly detectable, e.g. 'Узбекско-русский смешанный', 'Кавказский русский', 'Бразильский португальский'; null if standard>"
}

If audio is silent or unintelligible, return {"text": "", "language": null, "dialect": null}.`;

export async function transcribeAudio(
  tenantId: string,
  audioBase64: string,
  mimeType: string = 'audio/ogg'
): Promise<TranscribeResult> {
  const apiKey = await getEffectiveGeminiKey(tenantId);
  if (!apiKey) {
    // Quest Flow — Enterprise-only: глобальный ключ суперадмина для него НЕ используется.
    throw new Error('Gemini API ключ не задан. На тарифе Enterprise укажите собственный ключ в Настройках (раздел «Gemini API»).');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const resp = await ai.models.generateContent({
    model: TRANSCRIBE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: TRANSCRIBE_PROMPT },
          {
            inlineData: {
              data: audioBase64,
              mimeType,
            },
          },
        ],
      },
    ],
  });

  const raw = (resp as any).text || '{}';
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { text: '', language: null, dialect: null, dialectInstruction: null };
  }

  const text = typeof parsed.text === 'string' ? parsed.text : '';
  const language = typeof parsed.language === 'string' ? parsed.language.toLowerCase() : null;
  const dialect = typeof parsed.dialect === 'string' && parsed.dialect ? parsed.dialect : null;

  // Подгружаем dialect instruction. ВАЖНО: для одного языка может быть НЕСКОЛЬКО
  // правил-диалектов (суперадмин добавляет их по отдельности). Раньше брался случайный
  // LIMIT 1 без ORDER BY — теперь ОБЪЕДИНЯЕМ все активные правила языка в одну инструкцию.
  let dialectInstruction: string | null = null;
  if (language) {
    try {
      const r = await pool.query(
        `SELECT dialect_name, compiled_instruction, prompt_hints
         FROM dialect_rules
         WHERE language_code = $1 AND is_active = TRUE
         ORDER BY updated_at DESC`,
        [language]
      );
      const rows = r.rows as any[];
      if (rows.length > 0) {
        const blocks = rows
          .map((row, i) => {
            const body = (row.compiled_instruction || row.prompt_hints || '').trim();
            if (!body) return '';
            const label = row.dialect_name ? `[Диалект: ${row.dialect_name}]` : `[Диалект ${i + 1}]`;
            return `${label}\n${body}`;
          })
          .filter(Boolean);
        dialectInstruction = blocks.length ? blocks.join('\n\n──────────\n\n') : null;
      }
    } catch (err) {
      console.warn('[quest_flow/transcribe] dialect_rules lookup failed:', (err as Error).message);
    }
  }

  return { text, language, dialect, dialectInstruction };
}

// ============================================================================
// V2: ДОСЛОВНАЯ речь из ВИДЕО через ffmpeg + наш ASR-пайплайн.
// Звук видео Gemini понимает и сам (Files API), но выделенный ASR точнее по дословности и
// даёт язык/диалект (→ dialect_rules). Fail-soft: если ffmpeg недоступен / нет дорожки —
// возвращаем null, и caller использует in-video transcript Gemini (V1). Биллинг НЕ списываем
// (Enterprise оплачивает Gemini своим ключом).
// ============================================================================

/** Путь к ffmpeg: env FFMPEG_PATH → бандл ffmpeg-static (если установлен) → системный 'ffmpeg'. */
async function resolveFfmpegPath(): Promise<string> {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    // Переменная-спецификатор: tsc не требует установленного пакета (он optional-зависимость).
    const pkg = 'ffmpeg-static';
    const mod: any = await import(pkg);
    const p = mod?.default ?? mod;
    if (typeof p === 'string' && p) return p;
  } catch { /* пакет не установлен — пробуем системный ffmpeg в PATH */ }
  return 'ffmpeg';
}

/** Запускает ffmpeg с args, резолвит true при коде выхода 0 (никогда не бросает). */
function runFfmpeg(ffmpegPath: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(ffmpegPath, args, { stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Извлекает аудио из видео в WAV (mono 16kHz — без внешних кодеков, максимально совместимо) и
 * возвращает base64. null, если ffmpeg недоступен, нет аудиодорожки (≈тишина) или ошибка/слишком
 * большой файл (>18МБ — лимит inline-аудио Gemini).
 */
async function extractVideoAudioBase64(videoPath: string): Promise<{ base64: string; mime: string } | null> {
  const ffmpeg = await resolveFfmpegPath();
  const outPath = `${videoPath}.audio.wav`;
  const ok = await runFfmpeg(ffmpeg, ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', outPath]);
  if (!ok) { try { fs.unlinkSync(outPath); } catch { /* noop */ } return null; }
  try {
    const size = fs.statSync(outPath).size;
    if (size <= 2048 || size > 18_000_000) { fs.unlinkSync(outPath); return null; } // ~тишина / слишком большое
    const base64 = fs.readFileSync(outPath).toString('base64');
    fs.unlinkSync(outPath);
    return { base64, mime: 'audio/wav' };
  } catch {
    try { fs.unlinkSync(outPath); } catch { /* noop */ }
    return null;
  }
}

/**
 * V2: извлекает аудио из видео (ffmpeg) и транскрибирует нашим ASR-пайплайном.
 * Возвращает {text, language, dialect, dialectInstruction} либо null (caller → in-video Gemini).
 */
export async function transcribeVideoAudio(tenantId: string, videoPath: string): Promise<TranscribeResult | null> {
  const audio = await extractVideoAudioBase64(videoPath);
  if (!audio) return null;
  return transcribeAudio(tenantId, audio.base64, audio.mime);
}
