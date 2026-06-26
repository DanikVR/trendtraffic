/**
 * Детектор тегов потребностей — определяет, какие теги владельца совпали
 * с входящим сообщением клиента (через Gemini Flash).
 *
 * Используется:
 *  - quest_flow/ — на каждом входящем сообщении от Telegram-клиента
 *  - enterprise_chat/ — по запросу владельца (кнопка «Анализ») или автоматически
 *
 * Возвращает массив объектов с tagId + confidence. Caller сохраняет в client_tag_assignments.
 *
 * Lightweight подход: не вызываем Gemini если у tenant'а нет тегов. Промт компактный
 * (тегов обычно немного), один вызов Gemini Flash на сообщение.
 */

import pool from '../../db/index.js';
import { listTags } from './service.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';

export interface DetectedTagMatch {
  tagId: string;
  tagName: string;
  confidence: number;
}

/**
 * Основная функция детекции. Принимает массив сообщений (контекст диалога) и tenantId.
 * Возвращает массив совпавших тегов с confidence 0..1.
 *
 * Если у tenant'а нет тегов — возвращает [] без вызова Gemini.
 *
 * Best-effort: ошибки Gemini → [] (не валим caller'а).
 */
export async function detectNeedTags(
  tenantId: string,
  conversationContext: string
): Promise<DetectedTagMatch[]> {
  const tags = await listTags(tenantId);
  if (tags.length === 0) return [];

  const apiKey = await getEffectiveGeminiKey(tenantId);
  if (!apiKey) {
    console.warn('[need_tags/detector] Gemini ключ не задан, skipping detection');
    return [];
  }

  // Промт: для каждого тега описание — это ИНСТРУКЦИЯ от владельца «как распознать,
  // что эта потребность упомянута клиентом». Gemini должна следовать ИМЕННО этим
  // инструкциям, а не своему представлению о тегах.
  const tagsBlock = tags
    .map((t, i) => {
      const instruction = t.description?.trim()
        ? `  Инструкция владельца (как распознать): ${t.description.trim()}`
        : `  (владелец не дал инструкцию — используй смысл названия тега)`;
      return `${i + 1}. [${t.id}] Тег: «${t.name}»\n${instruction}`;
    })
    .join('\n\n');

  const prompt = `Ты — анализатор клиентских потребностей.
Владелец аккаунта определил список тегов потребностей. Для каждого тега он дал ИНСТРУКЦИЮ,
как распознать упоминание этой потребности в разговоре с клиентом.

ТВОЯ ЗАДАЧА:
Внимательно прочитай диалог с клиентом. Для каждого тега проверь: соответствует ли что-то
в словах клиента ИНСТРУКЦИИ владельца. Не используй своё общее представление о тегах —
следуй именно инструкциям владельца.

Совпадение должно быть содержательным (не по одному случайному слову).
Низкая уверенность (<0.5) → не включай.

СПИСОК ТЕГОВ С ИНСТРУКЦИЯМИ:
${tagsBlock}

ДИАЛОГ С КЛИЕНТОМ:
${conversationContext.slice(0, 8000)}

Верни СТРОГО валидный JSON-массив (без markdown, без префиксов). Каждый элемент:
{ "tagId": "<id из списка выше>", "confidence": 0.5..1.0, "reason": "1 предложение почему" }

Если ни один тег не подходит — верни пустой массив [].`;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const resp = await ai.models.generateContent({
      model: process.env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const raw = (resp as any).text || '[]';
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    const tagMap = new Map(tags.map((t) => [t.id, t]));
    const out: DetectedTagMatch[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const t = tagMap.get(item.tagId);
      const conf = Number(item.confidence);
      if (t && conf >= 0.5 && conf <= 1) {
        out.push({ tagId: t.id, tagName: t.name, confidence: conf });
      }
    }
    return out;
  } catch (err) {
    console.warn('[need_tags/detector] Ошибка детекции:', (err as Error).message);
    return [];
  }
}

/**
 * Применяет результат детекции: вставляет client_tag_assignments
 * для каждого нового тега. Existing ассоциации (tag_id, room_id) не дублируются.
 * Возвращает количество ВНОВЬ добавленных тегов.
 */
export async function applyDetectedTags(
  roomId: string,
  messageId: string | null,
  matches: DetectedTagMatch[]
): Promise<number> {
  let added = 0;
  for (const m of matches) {
    try {
      const res = await pool.query(
        `INSERT INTO client_tag_assignments (tag_id, room_id, detected_in_message_id, confidence)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tag_id, room_id) DO NOTHING`,
        [m.tagId, roomId, messageId, m.confidence]
      );
      if ((res.rowCount || 0) > 0) added++;
    } catch (err) {
      console.warn('[need_tags/detector] applyDetectedTags failed for', m.tagId, err);
    }
  }
  return added;
}
