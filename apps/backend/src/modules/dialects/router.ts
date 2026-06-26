/**
 * Dialects Router — CRUD для dialect_rules + компиляция промпта + счетчики.
 *
 * Эндпоинты:
 * GET    /                        — список правил + агрегированные счетчики по языкам
 * GET    /?language_code=uz       — фильтр по языку
 * POST   /                        — создать правило
 * PUT    /:id                     — обновить правило
 * DELETE /:id                     — soft delete (is_active = false)
 * POST   /compile                 — скомпилировать системный промпт на английском
 * GET    /instruction/:langCode   — получить готовую инструкцию для TranslationBridge
 */

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import pool from '../../db/index.js';
import { getGeminiApiKey } from '../../config/systemConfig.js';
import { JWT_SECRET } from '../../config/secrets.js';

const router = Router();

// ─── Автоматическое создание таблицы ──────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS dialect_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language_code VARCHAR(10) NOT NULL,
    dialect_name VARCHAR(100) NOT NULL,
    prompt_hints TEXT DEFAULT '',
    glossary JSONB DEFAULT '{}',
    compiled_instruction TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`).then(() => {
  console.log('[DB] Таблица dialect_rules проверена/создана успешно');
}).catch((err: Error) => {
  console.warn('[DB] Предупреждение при автосоздании таблицы dialect_rules:', err.message);
});

// ─── Автоматическое создание таблицы dialect_audio_samples ────────
pool.query(`
  CREATE TABLE IF NOT EXISTS dialect_audio_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dialect_rule_id UUID REFERENCES dialect_rules(id) ON DELETE CASCADE,
    audio_filename TEXT NOT NULL,
    expected_transcript TEXT DEFAULT '',
    expected_translation TEXT DEFAULT '',
    ai_transcript TEXT DEFAULT '',
    ai_translation TEXT DEFAULT '',
    clip_start_ms INTEGER DEFAULT 0,
    clip_end_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`).then(() => {
  console.log('[DB] Таблица dialect_audio_samples проверена/создана успешно');
}).catch((err: Error) => {
  console.warn('[DB] Предупреждение при автосоздании таблицы dialect_audio_samples:', err.message);
});

// ─── Multer: хранилище аудио-семплов ──────────────────────────────
const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);
const uploadsDir = path.resolve(__dirname_local, '../../../../uploads/dialects/audio');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ─── Маппинг language_code → English name (90+) ──────────────────
const LANGUAGE_MAP: Record<string, string> = {
  ru: 'Russian', en: 'English', de: 'German', fr: 'French', es: 'Spanish',
  tr: 'Turkish', zh: 'Chinese', ar: 'Arabic', ja: 'Japanese', ko: 'Korean',
  pt: 'Portuguese', it: 'Italian', pl: 'Polish', uk: 'Ukrainian', nl: 'Dutch',
  sv: 'Swedish', uz: 'Uzbek', kk: 'Kazakh', ky: 'Kyrgyz', tg: 'Tajik',
  tk: 'Turkmen', mn: 'Mongolian', az: 'Azerbaijani', ka: 'Georgian', hy: 'Armenian',
  he: 'Hebrew', fa: 'Persian', hi: 'Hindi', bn: 'Bengali', ur: 'Urdu',
  pa: 'Punjabi', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
  kn: 'Kannada', ml: 'Malayalam', si: 'Sinhala', ne: 'Nepali',
  th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay', tl: 'Filipino',
  my: 'Burmese', km: 'Khmer', lo: 'Lao',
  da: 'Danish', fi: 'Finnish', no: 'Norwegian', is: 'Icelandic',
  et: 'Estonian', lv: 'Latvian', lt: 'Lithuanian',
  cs: 'Czech', sk: 'Slovak', sl: 'Slovenian', hr: 'Croatian', sr: 'Serbian',
  bs: 'Bosnian', mk: 'Macedonian', bg: 'Bulgarian', ro: 'Romanian', hu: 'Hungarian',
  el: 'Greek', sq: 'Albanian', be: 'Belarusian',
  ga: 'Irish', cy: 'Welsh', gl: 'Galician', ca: 'Catalan', eu: 'Basque',
  mt: 'Maltese', lb: 'Luxembourgish',
  sw: 'Swahili', am: 'Amharic', ha: 'Hausa', yo: 'Yoruba', ig: 'Igbo',
  zu: 'Zulu', af: 'Afrikaans', so: 'Somali', rw: 'Kinyarwanda', mg: 'Malagasy',
  ht: 'Haitian Creole', qu: 'Quechua', gn: 'Guarani',
  la: 'Latin', eo: 'Esperanto', jv: 'Javanese', su: 'Sundanese', ceb: 'Cebuano',
  ny: 'Chichewa', sn: 'Shona', ps: 'Pashto', ku: 'Kurdish', sd: 'Sindhi',
  mi: 'Maori', sm: 'Samoan', haw: 'Hawaiian',
};

// ─── Авторизация: только суперадмин (JWT role='superadmin') ────────
// Раньше роутер был ОТКРЫТ — кто угодно мог читать/менять правила и жечь
// глобальный Gemini-ключ через /test-sample. Теперь весь /api/admin/dialects
// под охраной, как соседние админ-роутеры (users/promocodes/notifications/partners).
function requireSuperAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован: требуется доступ суперадмина.' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as { role?: string };
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ error: 'Только суперадмин может управлять диалектами.' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный или истёкший токен. Перелогиньтесь.' });
  }
}
router.use(requireSuperAdmin);

// ─── Базовый промпт обучения (зашит в программу) ──────────────────
// Применяется к ЛЮБОМУ языку/диалекту автоматически и персонализируется именем
// языка в шапке compiled_instruction. Поле «Подсказки для ИИ» в админке —
// НЕОБЯЗАТЕЛЬНОЕ дополнение поверх этой базы.
const BASE_DIALECT_GUIDELINES = `Speakers may freely mix this dialect with related regional languages and with Russian, switching languages within a single sentence (code-switching). Transcribe exactly what is said and preserve the original meaning. Everyday, colloquial, contracted and slang forms often differ from the literary standard — interpret them by sense, not only by their dictionary form. When you hear a word or phrase close to an entry in the vocabulary glossary below, normalize it to that glossary entry's standard meaning. Always preserve numbers, dates, quantities, measurements, names, addresses and locations exactly — never round, guess or invent them. Pay close attention to status and aspect markers (for example: done / completed vs. in progress vs. remaining vs. delivered), because they change the meaning of the whole message. Do not add anything that is not present in the audio.`;

// ─── GET / — все правила + счетчики ───────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { language_code } = req.query;

    // Фильтрованные правила
    let rulesQuery = 'SELECT * FROM dialect_rules WHERE is_active = TRUE';
    const params: string[] = [];
    if (language_code && typeof language_code === 'string') {
      rulesQuery += ' AND language_code = $1';
      params.push(language_code);
    }
    rulesQuery += ' ORDER BY created_at DESC';

    const rulesResult = await pool.query(rulesQuery, params);

    // Агрегированные счетчики по всем языкам
    const countsResult = await pool.query(
      `SELECT language_code, COUNT(*)::int AS count
       FROM dialect_rules
       WHERE is_active = TRUE
       GROUP BY language_code`
    );

    const counts: Record<string, number> = {};
    for (const row of countsResult.rows) {
      counts[row.language_code] = row.count;
    }

    return res.json({ rules: rulesResult.rows, counts });
  } catch (err) {
    console.error('[Dialects] Ошибка GET /:', err);
    return res.status(500).json({ error: 'Ошибка получения правил' });
  }
});

// ─── POST /compile — компиляция системного промпта ────────────────
router.post('/compile', async (req: Request, res: Response) => {
  try {
    const { language_code, dialect_name, prompt_hints, glossary } = req.body;

    if (!language_code || !dialect_name) {
      return res.status(400).json({ error: 'language_code и dialect_name обязательны' });
    }

    const langName = LANGUAGE_MAP[language_code] || language_code;

    // Формируем глоссарий
    let glossaryLines = '';
    if (glossary && typeof glossary === 'object') {
      const entries = Object.entries(glossary as Record<string, string>);
      if (entries.length > 0) {
        glossaryLines = entries
          .map(([dialectWord, translation]) => `- "${dialectWord}" → "${translation}"`)
          .join('\n');
      }
    }

    // Собираем итоговый системный промпт на английском.
    // База (BASE_DIALECT_GUIDELINES) зашита в программу и работает даже с ПУСТЫМ
    // полем «Подсказки для ИИ»; сами подсказки — необязательное дополнение поверх базы.
    let compiled = `You are a real-time audio interpreter and transcriber. The speaker communicates in ${langName} and may use the regional dialect/variant "${dialect_name}".

DIALECT GUIDELINES (base):
${BASE_DIALECT_GUIDELINES}`;

    const extraHints = (prompt_hints || '').trim();
    if (extraHints) {
      compiled += `\n\nADDITIONAL NOTES FOR THIS DIALECT (from the administrator — apply on top of the base guidelines):\n${extraHints}`;
    }

    if (glossaryLines) {
      compiled += `\n\nVOCABULARY GLOSSARY (dialect term → standard translation):\n${glossaryLines}\n\nWhen you detect these dialect expressions, apply the glossary mappings above for accurate translation.`;
    }

    // Инъекция фонетических корректировок (AI Learning Hub Pro v0.3.0)
    try {
      const correctionsRes = await pool.query(
        `SELECT das.expected_transcript, das.expected_translation, das.ai_transcript, das.ai_translation
         FROM dialect_audio_samples das
         JOIN dialect_rules dr ON das.dialect_rule_id = dr.id
         WHERE dr.language_code = $1 AND dr.is_active = TRUE
           AND das.expected_transcript != '' AND das.expected_transcript != das.ai_transcript`,
        [language_code]
      );
      if (correctionsRes.rows.length > 0) {
        const fixLines = correctionsRes.rows.map((r: any) =>
          `- When AI hears "${r.ai_transcript}", the correct interpretation is "${r.expected_transcript}"${r.expected_translation ? ` (translate as: "${r.expected_translation}")` : ''}`
        ).join('\n');
        compiled += `\n\nPRONUNCIATION FIXES (learned from audio analysis):\n${fixLines}`;
      }
    } catch {
      // БД недоступна — пропускаем фонетические коррекции
    }

    return res.json({ compiled_instruction: compiled.trim() });
  } catch (err) {
    console.error('[Dialects] Ошибка POST /compile:', err);
    return res.status(500).json({ error: 'Ошибка компиляции промпта' });
  }
});

// ─── GET /instruction/:langCode — для TranslationBridge ───────────
// Мёржим ВСЕ активные правила языка: глоссарии объединяются в один,
// prompt_hints из каждого правила добавляются отдельными блоками.
// (Исправлено: ранее был LIMIT 1 — учитывалось только одно правило.)
router.get('/instruction/:langCode', async (req: Request, res: Response) => {
  try {
    const { langCode } = req.params;

    const result = await pool.query(
      `SELECT compiled_instruction, dialect_name, glossary, prompt_hints
       FROM dialect_rules
       WHERE language_code = $1 AND is_active = TRUE AND compiled_instruction != ''
       ORDER BY updated_at DESC`,
      [langCode]
    );

    if (result.rows.length === 0) {
      return res.json({ compiled_instruction: null });
    }

    // Одно правило — возвращаем как есть (без изменений поведения).
    if (result.rows.length === 1) {
      return res.json({ compiled_instruction: result.rows[0].compiled_instruction });
    }

    // Несколько правил — собираем мёрж: общий глоссарий + все dialect_name.
    const langName = LANGUAGE_MAP[langCode] || langCode;
    const dialectNames = result.rows.map((r: any) => r.dialect_name).filter(Boolean);

    // Объединяем глоссарии (последнее по updated_at переопределяет дубликаты).
    const mergedGlossary: Record<string, string> = {};
    for (const row of [...result.rows].reverse()) {
      try {
        const g = typeof row.glossary === 'object' ? row.glossary : JSON.parse(row.glossary || '{}');
        for (const [k, v] of Object.entries(g as Record<string, any>)) {
          const val = v && typeof v === 'object' ? `${v.t}${v.c ? ` (${v.c})` : ''}` : String(v);
          mergedGlossary[k] = val;
        }
      } catch { /* некорректный JSON глоссария — пропускаем */ }
    }

    const glossaryLines = Object.entries(mergedGlossary)
      .map(([k, v]) => `- "${k}" → "${v}"`)
      .join('\n');

    // Собираем дополнительные подсказки (только непустые и уникальные).
    const extraHints = result.rows
      .map((r: any) => (r.prompt_hints || '').trim())
      .filter(Boolean)
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
      .join('\n');

    let merged = `You are a real-time audio interpreter and transcriber. The speaker communicates in ${langName} and may use any of the following regional dialects/variants: ${dialectNames.join(', ')}.

DIALECT GUIDELINES (base):
${BASE_DIALECT_GUIDELINES}`;

    if (extraHints) {
      merged += `\n\nADDITIONAL NOTES FOR THESE DIALECTS (from the administrator):\n${extraHints}`;
    }

    if (glossaryLines) {
      merged += `\n\nVOCABULARY GLOSSARY (dialect term → standard translation):\n${glossaryLines}\n\nWhen you detect these dialect expressions, apply the glossary mappings above for accurate translation.`;
    }

    // Фонетические коррекции по всем активным правилам языка.
    try {
      const correctionsRes = await pool.query(
        `SELECT das.expected_transcript, das.expected_translation, das.ai_transcript
         FROM dialect_audio_samples das
         JOIN dialect_rules dr ON das.dialect_rule_id = dr.id
         WHERE dr.language_code = $1 AND dr.is_active = TRUE
           AND das.expected_transcript != '' AND das.expected_transcript != das.ai_transcript`,
        [langCode]
      );
      if (correctionsRes.rows.length > 0) {
        const fixLines = correctionsRes.rows.map((r: any) =>
          `- When AI hears "${r.ai_transcript}", the correct interpretation is "${r.expected_transcript}"${r.expected_translation ? ` (translate as: "${r.expected_translation}")` : ''}`
        ).join('\n');
        merged += `\n\nPRONUNCIATION FIXES (learned from audio analysis):\n${fixLines}`;
      }
    } catch { /* БД недоступна */ }

    return res.json({ compiled_instruction: merged.trim() });
  } catch (err) {
    console.error('[Dialects] Ошибка GET /instruction:', err);
    return res.status(500).json({ error: 'Ошибка получения инструкции' });
  }
});

// ─── POST / — создать правило ─────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { language_code, dialect_name, prompt_hints, glossary, compiled_instruction } = req.body;

    if (!language_code || !dialect_name) {
      return res.status(400).json({ error: 'language_code и dialect_name обязательны' });
    }

    const result = await pool.query(
      `INSERT INTO dialect_rules (language_code, dialect_name, prompt_hints, glossary, compiled_instruction)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [language_code, dialect_name, prompt_hints || '', JSON.stringify(glossary || {}), compiled_instruction || '']
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Dialects] Ошибка POST /:', err);
    return res.status(500).json({ error: 'Ошибка создания правила' });
  }
});

// ─── PUT /:id — обновить правило ──────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { language_code, dialect_name, prompt_hints, glossary, compiled_instruction, is_active } = req.body;

    const result = await pool.query(
      `UPDATE dialect_rules SET
        language_code = COALESCE($1, language_code),
        dialect_name = COALESCE($2, dialect_name),
        prompt_hints = COALESCE($3, prompt_hints),
        glossary = COALESCE($4, glossary),
        compiled_instruction = COALESCE($5, compiled_instruction),
        is_active = COALESCE($6, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [language_code, dialect_name, prompt_hints, glossary ? JSON.stringify(glossary) : null, compiled_instruction, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Правило не найдено' });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[Dialects] Ошибка PUT /:id:', err);
    return res.status(500).json({ error: 'Ошибка обновления правила' });
  }
});

// ─── DELETE /:id — soft delete ────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE dialect_rules SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Правило не найдено' });
    }

    return res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('[Dialects] Ошибка DELETE /:id:', err);
    return res.status(500).json({ error: 'Ошибка удаления правила' });
  }
});

// ─── POST /upload-sample — загрузка аудио-семпла ──────────────────
router.post('/upload-sample', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не передан. Используйте поле "audio".' });
    }

    const { dialectRuleId } = req.body;

    // Сохраняем в БД
    try {
      const result = await pool.query(
        `INSERT INTO dialect_audio_samples (dialect_rule_id, audio_filename)
         VALUES ($1, $2) RETURNING *`,
        [dialectRuleId || null, file.filename]
      );
      return res.status(201).json({
        id: result.rows[0].id,
        audioUrl: `/uploads/dialects/audio/${file.filename}`,
        filename: file.filename,
      });
    } catch (dbErr) {
      // БД недоступна — возвращаем только файловую информацию
      console.warn('[Dialects] БД недоступна при сохранении семпла:', dbErr);
      return res.status(201).json({
        id: null,
        audioUrl: `/uploads/dialects/audio/${file.filename}`,
        filename: file.filename,
      });
    }
  } catch (err) {
    console.error('[Dialects] Ошибка POST /upload-sample:', err);
    return res.status(500).json({ error: 'Ошибка загрузки аудио-семпла' });
  }
});

// ─── POST /test-sample — тестирование аудио через Gemini ──────────
router.post('/test-sample', async (req: Request, res: Response) => {
  try {
    const { audioFilename, dialectRuleId, clipStartMs, clipEndMs } = req.body;

    if (!audioFilename) {
      return res.status(400).json({ error: 'audioFilename обязателен' });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'Google Gemini API Key не настроен в системных настройках.' });
    }

    // Загружаем скомпилированную инструкцию диалекта
    let systemInstruction = '';
    if (dialectRuleId) {
      try {
        const ruleRes = await pool.query(
          'SELECT compiled_instruction FROM dialect_rules WHERE id = $1 AND is_active = TRUE',
          [dialectRuleId]
        );
        if (ruleRes.rows.length > 0) {
          systemInstruction = ruleRes.rows[0].compiled_instruction || '';
        }
      } catch { /* БД недоступна — тестируем без инструкции */ }
    }

    // Читаем аудио-файл
    const audioPath = path.join(uploadsDir, audioFilename);
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: `Аудио-файл не найден: ${audioFilename}` });
    }
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBase64 = audioBuffer.toString('base64');

    // Определяем MIME по расширению
    const ext = path.extname(audioFilename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
      '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.flac': 'audio/flac',
    };
    const mimeType = mimeMap[ext] || 'audio/wav';

    // Формируем промпт
    let prompt = 'Listen to this audio and provide:\n1. TRANSCRIPT: The exact words spoken (in the original language)\n2. TRANSLATION: English translation of what was said\n\nFormat your response as:\nTRANSCRIPT: [text]\nTRANSLATION: [text]';
    if (clipStartMs !== undefined && clipEndMs !== undefined) {
      prompt += `\n\nNote: Focus on the audio segment from ${clipStartMs}ms to ${clipEndMs}ms.`;
    }

    // Вызов Gemini API
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: prompt },
          ],
        },
      ],
      ...(systemInstruction ? {
        config: { systemInstruction: { parts: [{ text: systemInstruction }] } },
      } : {}),
    });

    const responseText = result.text ?? '';

    // Парсим ответ
    const transcriptMatch = responseText.match(/TRANSCRIPT:\s*(.+?)(?:\n|$)/i);
    const translationMatch = responseText.match(/TRANSLATION:\s*(.+?)(?:\n|$)/i);

    const transcript = transcriptMatch?.[1]?.trim() || responseText;
    const translation = translationMatch?.[1]?.trim() || '';

    // Обновляем в БД если есть dialectRuleId
    if (dialectRuleId && audioFilename) {
      try {
        await pool.query(
          `UPDATE dialect_audio_samples
           SET ai_transcript = $1, ai_translation = $2, clip_start_ms = $3, clip_end_ms = $4
           WHERE audio_filename = $5`,
          [transcript, translation, clipStartMs || 0, clipEndMs || 0, audioFilename]
        );
      } catch { /* БД недоступна */ }
    }

    return res.json({ transcript, translation, rawResponse: responseText });
  } catch (err: any) {
    console.error('[Dialects] Ошибка POST /test-sample:', err);
    return res.status(502).json({
      error: `Ошибка Gemini API: ${err.message || String(err)}`,
    });
  }
});

// ─── POST /save-correction — сохранение коррекции админа ──────────
router.post('/save-correction', async (req: Request, res: Response) => {
  try {
    const { audioFilename, expectedTranscript, expectedTranslation } = req.body;
    if (!audioFilename) {
      return res.status(400).json({ error: 'audioFilename обязателен' });
    }

    try {
      await pool.query(
        `UPDATE dialect_audio_samples
         SET expected_transcript = $1, expected_translation = $2
         WHERE audio_filename = $3`,
        [expectedTranscript || '', expectedTranslation || '', audioFilename]
      );
    } catch { /* БД недоступна */ }

    return res.json({ success: true });
  } catch (err) {
    console.error('[Dialects] Ошибка POST /save-correction:', err);
    return res.status(500).json({ error: 'Ошибка сохранения коррекции' });
  }
});

export default router;
