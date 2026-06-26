/**
 * AI Coach — приватный помощник переговорщика.
 *
 * POST /api/coach/explain — принимает реплику собеседника и опциональный «пром»
 * пользователя (тон, стиль, глубина), стримит ответ Gemini Flash обратно
 * через text/plain chunked encoding.
 *
 * Подсказку видит только сам пользователь (фронт держит её в приватной
 * янтарной плашке). Другому собеседнику она не отправляется.
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';

const coachRouter = Router();
import { JWT_SECRET } from '../../config/secrets.js';

/**
 * Опционально извлекает tenantId из Bearer-токена (если передан).
 * Coach используется и creator'ом (с токеном), и гостями (без токена) —
 * поэтому JWT не обязателен. Для creator'а с Enterprise-аккаунтом
 * получим per-tenant Gemini ключ, для остальных — глобальный.
 */
function extractOptionalTenantId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    return (decoded?.tenantId as string) || null;
  } catch {
    return null;
  }
}

// ─── Маппинг кода языка → English name (для системного промпта) ──────
const LANG_NAME: Record<string, string> = {
  ru: 'Russian', en: 'English', de: 'German', fr: 'French', es: 'Spanish',
  tr: 'Turkish', zh: 'Chinese', ar: 'Arabic', ja: 'Japanese', ko: 'Korean',
  pt: 'Portuguese', it: 'Italian', pl: 'Polish', uk: 'Ukrainian', nl: 'Dutch',
  uz: 'Uzbek', kk: 'Kazakh', he: 'Hebrew', fa: 'Persian', hi: 'Hindi',
};

function langName(code: string): string {
  return LANG_NAME[code?.toLowerCase()] || code || 'the same language';
}

/**
 * POST /api/coach/explain
 * Body:
 *   {
 *     subtitleText: string,         // реплика собеседника (перевод на мой язык)
 *     speakerLanguage?: string,     // исходный язык собеседника (ISO-639-1)
 *     myLanguage: string,           // мой язык — на нём вернём подсказку
 *     customPrompt?: string         // мои пожелания: тон, глубина, стиль
 *   }
 * Response: text/plain stream (chunked) — текст подсказки по словам.
 */
coachRouter.post('/explain', async (req: Request, res: Response) => {
  const { subtitleText, speakerLanguage, myLanguage, customPrompt } = req.body || {};

  if (!subtitleText || typeof subtitleText !== 'string') {
    return res.status(400).json({ error: 'subtitleText обязателен' });
  }
  if (!myLanguage || typeof myLanguage !== 'string') {
    return res.status(400).json({ error: 'myLanguage обязателен' });
  }

  // ENTERPRISE v0.10.0: per-tenant Gemini ключ с fallback на глобальный
  const tenantId = extractOptionalTenantId(req);
  const apiKey = await getEffectiveGeminiKey(tenantId);
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key не настроен (ни per-tenant, ни глобально)' });
  }

  // Системный промпт. Лаконичный, чтобы Gemini не разводил воду.
  const systemPrompt = `You are a personal AI assistant for a live negotiation. The other party just said something (translated into the user's language). Your job is to help the user respond.

Always reply in ${langName(myLanguage)} (the user's native language).

Format:
1. A one-sentence explanation of what the other party means, including subtext if relevant.
2. 2-3 concise response variants the user can speak out loud.

Keep it short. The user is in the middle of a conversation and reads this in real time.`;

  const userPrompt = `The other party (speaking ${langName(speakerLanguage || 'unknown')}) said:

"${subtitleText}"

${customPrompt && customPrompt.trim()
    ? `User's request for your reply style or depth: ${customPrompt.trim()}`
    : ''}

Now provide the explanation and response variants.`;

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // Заголовки streaming-ответа — text/plain UTF-8, без буферизации
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        temperature: 0.85,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) res.write(text);
    }
    res.end();
  } catch (err: any) {
    console.error('[Coach] Ошибка Gemini Flash:', err);
    // Если заголовки уже отправлены — просто завершаем поток с пометкой
    if (res.headersSent) {
      try {
        res.write(`\n\n[ошибка: ${err.message || String(err)}]`);
        res.end();
      } catch { /* ignore */ }
    } else {
      res.status(502).json({ error: `Ошибка Gemini Flash: ${err.message || String(err)}` });
    }
  }
});

export default coachRouter;
