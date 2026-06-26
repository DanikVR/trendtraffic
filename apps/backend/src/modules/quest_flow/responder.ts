/**
 * AI Responder для Quest Flow-чатов.
 *
 * Генерирует ответ AI клиенту на основе:
 *  - History диалога (room_messages для конкретной комнаты)
 *  - tenants.questflow_prompt — отдельный промт для Quest Flow (не путать с custom_prompt видеокомнат)
 *  - tenants.questflow_knowledge_base — KB для Quest Flow
 *  - tenants.custom_prompt + knowledge_base — общий контекст (если questflow_* пустые, используем эти)
 *  - dialectInstruction — если транскрипция определила диалект
 *
 * Возвращает только текст. Аудио-ответ (если QF попросил) генерируется
 * отдельно в outbound.ts через voice synthesis.
 */

import pool from '../../db/index.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { getConversationContext, listMessages } from '../rooms/messages.js';

const RESPOND_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash';

// ENTERPRISE v0.10.14: лимиты увеличены в 10 раз (см. tenant_prompt/router.ts)
const MAX_PROMPT = 40_000;
const MAX_KB = 500_000;

/**
 * Дефолтный системный промт для AI в Quest Flow-диалогах.
 * Используется когда у tenant'а пусто в questflow_prompt.
 * Экспортируется для отображения в UI Section3 ("вот так AI общается по умолчанию").
 */
export const DEFAULT_QUEST_FLOW_SYSTEM_PROMPT = `Ты — AI-ассистент компании, общаешься с клиентами через Telegram.

Правила общения:
• Отвечай коротко и по делу. 2-5 предложений в обычном случае.
• Используй язык, на котором написал клиент (русский, английский, узбекский и т.д.).
• Будь вежлив, дружелюбен, но не фамильярен.
• Не выдумывай факты. Если не знаешь — честно скажи «уточню у менеджера» или попроси клиента подождать.
• Не давай медицинских / юридических / финансовых рекомендаций — предлагай связаться со специалистом.
• Сохраняй стиль из «Контекста компании» (если задан владельцем ниже).
• Если есть «База знаний» — цитируй из неё дословно/точно.
• Если владелец оставил «Заметки по этому клиенту» (в чате видео-комнаты) — они имеют ВЫСШИЙ приоритет над всем остальным (специальная цена, договорённости, особые условия).`;

interface TenantPromptBundle {
  questflowPrompt: string;
  questflowKnowledgeBase: string;
}

/**
 * ВАЖНО v0.10.15: Quest Flow использует ТОЛЬКО questflow_prompt / questflow_knowledge_base.
 * НЕ берём custom_prompt / knowledge_base из Раздела 2 — те предназначены строго
 * для расшифровки в видео-комнатах (кнопка «Согласно вашего промта» в чате).
 * Это разделение зон ответственности.
 */
async function loadTenantPromptBundle(tenantId: string): Promise<TenantPromptBundle> {
  try {
    const r = await pool.query(
      `SELECT questflow_prompt, questflow_knowledge_base
       FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );
    const row = (r.rows as any[])[0] || {};
    return {
      questflowPrompt: (row.questflow_prompt || '').slice(0, MAX_PROMPT),
      questflowKnowledgeBase: (row.questflow_knowledge_base || '').slice(0, MAX_KB),
    };
  } catch {
    return { questflowPrompt: '', questflowKnowledgeBase: '' };
  }
}

function buildSystemInstruction(
  bundle: TenantPromptBundle,
  dialectInstruction: string | null,
  adminNotes: string[]
): string {
  const parts: string[] = [];

  // ENTERPRISE v0.10.15: дефолтный системный промт VibeVox для Quest Flow.
  // Экспортируется ниже как DEFAULT_QUEST_FLOW_SYSTEM_PROMPT — фронт показывает его
  // в Section3 как «по умолчанию используется этот промт, если оставить пустым».
  parts.push(DEFAULT_QUEST_FLOW_SYSTEM_PROMPT);

  // ВАЖНО: используем ТОЛЬКО questflow_* (Раздел 3). custom_prompt из Раздела 2 — это
  // отдельная фича для расшифровки в видео-комнатах, она НЕ влияет на Quest Flow.
  if (bundle.questflowPrompt) {
    parts.push(`\n# Контекст компании (от владельца)\n${bundle.questflowPrompt}`);
  }

  if (bundle.questflowKnowledgeBase) {
    parts.push(`\n# База знаний (используй ПРИОРИТЕТНО для фактов)\n${bundle.questflowKnowledgeBase}`);
  }

  // ⚠️ Заметки админа — ВЫСШИЙ приоритет (выше промта и KB)
  if (adminNotes.length > 0) {
    const block = adminNotes.slice(-30).join('\n');
    parts.push(`\n# ⚠️ ПРИОРИТЕТНЫЕ ЗАМЕТКИ ВЛАДЕЛЬЦА для ЭТОГО клиента
Это персональные уточнения владельца аккаунта по конкретно этому клиенту
(цена, условия, скидка, договорённости). Они ПЕРЕБИВАЮТ информацию из «Контекста компании»
и «Базы знаний» — если есть противоречие, используй ЭТИ значения:
${block}`);
  }

  if (dialectInstruction) {
    parts.push(`\n# Особенности диалекта собеседника\n${dialectInstruction}`);
  }

  parts.push(
    `\n# Правила\n- Отвечай на том языке, на котором написал/сказал клиент.\n- Сохраняй стиль из «Контекста компании».\n- Если есть «ПРИОРИТЕТНЫЕ ЗАМЕТКИ ВЛАДЕЛЬЦА» по теме вопроса — используй ИХ.\n- Иначе если факт есть в «Базе знаний» — цитируй его дословно/точно.\n- Если ничего нет — честно скажи что не знаешь.\n- Будь лаконичен (2-5 предложений в обычном случае).`
  );

  return parts.join('\n');
}

/**
 * Подгружает заметки админа (sender='admin', source='chat') из истории комнаты.
 * Они становятся частью системного промта с высшим приоритетом.
 */
async function loadAdminNotes(roomId: string): Promise<string[]> {
  try {
    const messages = await listMessages(roomId, 1000);
    return messages
      .filter((m) => m.sender === 'admin' && m.source === 'chat' && m.content && m.content.trim())
      .map((m) => {
        const ts = new Date(m.createdAt).toLocaleString('ru-RU');
        return `[${ts}] ${m.content}`;
      });
  } catch {
    return [];
  }
}

export interface ResponderInput {
  tenantId: string;
  roomId: string;
  /** Последнее сообщение клиента — добавляется поверх contextHistory если ещё не сохранено */
  latestClientMessage?: string;
  dialectInstruction?: string | null;
  /**
   * Изображение от клиента (base64, можно с префиксом data:) для РАСПОЗНАВАНИЯ.
   * Если задано — картинка передаётся в Gemini (multimodal), а ЧТО с ней делать
   * (например «распознай ФИО с паспорта») определяет промт владельца (questflow_prompt).
   */
  imageBase64?: string | null;
  imageMime?: string | null;
  /**
   * Видео от клиента для РАСПОЗНАВАНИЯ — абсолютный путь к файлу на диске.
   * Видео слишком велико для inline base64 (лимит запроса Gemini ~20 МБ), поэтому
   * грузится через Gemini Files API. ЧТО делать с видео определяет промт владельца.
   */
  videoFilePath?: string | null;
  videoMime?: string | null;
  /** V2: точная расшифровка речи из видео (ffmpeg + ASR). Если задана — заземляет ответ и
   *  возвращается как transcript (точнее in-video ASR Gemini). */
  speechTranscript?: string | null;
}

export interface ResponderResult {
  text: string;
  systemInstruction: string;
  modelUsed: string;
  /** Полная расшифровка медиа для чата ВЛАДЕЛЬЦА: дословная речь + извлечённый визуал.
   *  null для текстовых сообщений. НЕ уходит клиенту — только в чат комнаты. */
  recognition?: { transcript: string; visual: string } | null;
}

/** Парсит строгий JSON медиа-ответа модели: {transcript, visual, clientReply}. null если не JSON. */
function parseRecognitionJson(raw: any): { transcript: string; visual: string; clientReply: string } | null {
  const s = typeof raw === 'string' ? raw : '';
  const cleaned = s.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  if (!cleaned) return null;
  try {
    const o = JSON.parse(cleaned);
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return {
        transcript: typeof o.transcript === 'string' ? o.transcript.trim() : '',
        visual: typeof o.visual === 'string' ? o.visual.trim() : '',
        clientReply: typeof o.clientReply === 'string' ? o.clientReply.trim() : '',
      };
    }
  } catch { /* не JSON — fail-soft */ }
  return null;
}

export async function respondToClient(input: ResponderInput): Promise<ResponderResult> {
  const apiKey = await getEffectiveGeminiKey(input.tenantId);
  if (!apiKey) {
    // Quest Flow — Enterprise-only: глобальный ключ суперадмина для него НЕ используется.
    throw new Error('Gemini API ключ не задан. На тарифе Enterprise укажите собственный ключ в Настройках (раздел «Gemini API»).');
  }

  const bundle = await loadTenantPromptBundle(input.tenantId);
  const adminNotes = await loadAdminNotes(input.roomId);
  const systemInstruction = buildSystemInstruction(bundle, input.dialectInstruction || null, adminNotes);

  const history = await getConversationContext(input.roomId, 30);
  const userMessageBlock = input.latestClientMessage
    ? `\n\nLATEST CLIENT MESSAGE (respond to this):\n${input.latestClientMessage}`
    : '';

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  // Если клиент прислал изображение — добавляем его в запрос как inlineData.
  // Инструкция ниже говорит модели «смотреть» картинку и действовать по промту
  // владельца (например: распознать ФИО с паспорта, прочитать чек, описать фото).
  const parts: any[] = [];
  let visionNote = '';
  let mediaAttached = false;
  if (input.imageBase64) {
    const cleaned = input.imageBase64.includes(',')
      ? input.imageBase64.slice(input.imageBase64.indexOf(',') + 1)
      : input.imageBase64;
    // Защита от слишком больших inline-картинок (лимит запроса Gemini ~20 МБ).
    if (cleaned.length <= 18_000_000) {
      parts.push({ inlineData: { data: cleaned, mimeType: input.imageMime || 'image/jpeg' } });
      mediaAttached = true;
      visionNote =
        `\n\n# ВЛОЖЕНИЕ: ИЗОБРАЖЕНИЕ ОТ КЛИЕНТА\n` +
        `К последнему сообщению клиента прикреплено изображение (оно передано тебе выше как картинка).\n` +
        `Внимательно рассмотри его и выполни то, что требуется согласно «Контексту компании» / «Базе знаний» владельца ` +
        `и/или запросу клиента (например: распознать ФИО и данные с документа, прочитать текст/чек, описать содержимое).\n` +
        `Если нужная информация на изображении не видна или нечитаема — честно сообщи об этом и попроси прислать чётче.`;
    }
  } else if (input.videoFilePath) {
    // Видео не влезает в inline base64 — грузим в Gemini Files API и ссылаемся по fileUri.
    const videoPart = await buildVideoPartViaFilesApi(ai, input.videoFilePath, input.videoMime || 'video/mp4');
    if (videoPart) {
      parts.push(videoPart);
      mediaAttached = true;
      visionNote =
        `\n\n# ВЛОЖЕНИЕ: ВИДЕО ОТ КЛИЕНТА\n` +
        `К последнему сообщению клиента прикреплено видео (оно передано тебе выше).\n` +
        `Внимательно просмотри его (кадры и звук) и выполни то, что требуется согласно «Контексту компании» / «Базе знаний» владельца ` +
        `и/или запросу клиента (например: опиши, что происходит на видео; распознай показанный объект/документ; извлеки нужные данные).\n` +
        `Если нужная информация на видео не видна/неразборчива — честно сообщи об этом и попроси прислать чётче или другой ракурс.`;
    }
  }

  // Gemini периодически отвечает 503 «high demand» / 429 (rate limit) — повторяем до 3 раз.
  let text = '';
  let recognition: { transcript: string; visual: string } | null = null;

  if (mediaAttached) {
    // МЕДИА (фото/видео/видео-кружок) — структурированный режим: ОДНИМ вызовом получаем
    // дословную расшифровку речи (звук видео идёт в Gemini через Files API) + извлечение
    // визуала (текст документов, показания рулетки/линейки, таблички) + ответ клиенту по
    // правилам владельца. transcript+visual → чат владельца; clientReply → клиенту в Telegram.
    // V2: если передан точный ASR-транскрипт (ffmpeg+transcribeAudio) — заземляем ответ на нём.
    const asrBlock = input.speechTranscript
      ? `\n\n# ТОЧНАЯ РАСШИФРОВКА РЕЧИ (ASR — источник истины о сказанном)\n${input.speechTranscript}\n` +
        `Опирайся на неё для ответа; в поле "transcript" верни ИМЕННО ЭТУ расшифровку.`
      : '';
    parts.push({
      text:
        `${systemInstruction}\n\n# Диалог до этого момента\n${history || '(пусто — это первое сообщение)'}${userMessageBlock}${visionNote}${asrBlock}\n\n` +
        `# ФОРМАТ ОТВЕТА — верни СТРОГО валидный JSON (без markdown и пояснений):\n` +
        `{\n` +
        `  "transcript": "<ДОСЛОВНАЯ расшифровка речи из вложения на языке оригинала; пустая строка, если речи нет>",\n` +
        `  "visual": "<что показано: текст документов, показания рулетки/линейки, надписи и таблички, цифры, объекты — полно, но без воды>",\n` +
        `  "clientReply": "<ответ КЛИЕНТУ строго по правилам «Контекста компании»/«Базы знаний» выше — именно они решают, что и показывать ли клиенту>"\n` +
        `}`,
    });
    const resp = await generateWithRetry(ai, parts, 3);
    const parsed = parseRecognitionJson((resp as any).text);
    if (parsed) {
      recognition = { transcript: parsed.transcript, visual: parsed.visual };
      text = parsed.clientReply;
    } else {
      // Модель не вернула валидный JSON — берём сырой текст как ответ клиенту (fail-soft).
      text = ((resp as any).text || '').trim();
    }
    // Если ответ клиенту пуст (напр. safety-фильтр на вложении) — повторный ТЕКСТОВЫЙ запрос
    // без медиа на ЯЗЫКЕ КЛИЕНТА, чтобы Quest Flow доставил осмысленный ответ, а не пустоту.
    if (!text) {
      try {
        const ackResp = await generateWithRetry(ai, [{
          text:
            `${systemInstruction}\n\n# Диалог до этого момента\n${history || '(пусто)'}${userMessageBlock}\n\n` +
            `# ВАЖНО\nКлиент прислал вложение, но распознать его содержимое не удалось. ` +
            `Ответь КРАТКО и на ЯЗЫКЕ КЛИЕНТА (определи по его сообщениям выше): вежливо подтверди, ` +
            `что вложение получено, и попроси кратко описать вопрос текстом.\n\nОтвет AI:`,
        }], 2);
        text = ((ackResp as any).text || '').trim();
      } catch {
        // не вышло — пусто; финальный статический фолбэк добавит inbound.ts
      }
    }
  } else {
    // Обычное текстовое сообщение — свободный ответ (как раньше).
    parts.push({
      text: `${systemInstruction}\n\n# Диалог до этого момента\n${history || '(пусто — это первое сообщение)'}${userMessageBlock}\n\nОтвет AI:`,
    });
    const resp = await generateWithRetry(ai, parts, 3);
    text = ((resp as any).text || '').trim();
  }

  return { text: text || '', systemInstruction, modelUsed: RESPOND_MODEL, recognition };
}

/** Признак временной перегрузки модели (503/429/UNAVAILABLE) — такие ошибки имеет смысл повторить. */
function isTransientGeminiError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return /\b(503|429)\b/.test(msg) || /UNAVAILABLE|high demand|overloaded|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg);
}

async function generateWithRetry(ai: any, parts: any[], maxAttempts: number): Promise<any> {
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent({
        model: RESPOND_MODEL,
        contents: [{ role: 'user', parts }],
      });
    } catch (err) {
      lastErr = err;
      // Повторяем только временные ошибки и только если попытки ещё остались.
      if (attempt < maxAttempts && isTransientGeminiError(err)) {
        const delayMs = 800 * attempt; // 0.8s, 1.6s
        console.warn(`[quest_flow/responder] Gemini ${RESPOND_MODEL} временно недоступен (попытка ${attempt}/${maxAttempts}), повтор через ${delayMs}ms`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Загружает видео в Gemini Files API и возвращает Part со ссылкой (fileUri) для
 * мультимодального запроса. Видео слишком велико для inline base64 (лимит запроса
 * Gemini ~20 МБ), поэтому только через Files API.
 *
 * Возвращает null, если видео не успело обработаться на стороне Google (PROCESSING
 * дольше дедлайна) или произошла ошибка — тогда AI отвечает БЕЗ распознавания видео
 * (клиент всё равно получит ответ, а владелец увидит сам файл в чате комнаты).
 */
async function buildVideoPartViaFilesApi(ai: any, filePath: string, mimeType: string): Promise<any | null> {
  try {
    const { createPartFromUri } = await import('@google/genai');
    let file = await ai.files.upload({ file: filePath, config: { mimeType } });
    // Google обрабатывает видео асинхронно (PROCESSING → ACTIVE). Ждём до 45с.
    const deadline = Date.now() + 45_000;
    while (file?.state === 'PROCESSING' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      file = await ai.files.get({ name: file.name });
    }
    if (!file || file.state !== 'ACTIVE' || !file.uri) {
      console.warn(`[quest_flow/responder] видео не готово к распознаванию (state=${file?.state}); отвечаем без него`);
      return null;
    }
    return createPartFromUri(file.uri, file.mimeType || mimeType);
  } catch (err) {
    console.warn('[quest_flow/responder] загрузка видео в Files API не удалась (отвечаем без распознавания):', (err as Error).message);
    return null;
  }
}
