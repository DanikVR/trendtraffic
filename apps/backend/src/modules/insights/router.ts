/**
 * Insights — post-call анализ разговора через Gemini 3.5 Flash.
 *
 * Доступно ТОЛЬКО для creator'а комнаты на тарифе Enterprise.
 * При hangup фронт сначала POST'ит transcripts в /api/rooms/:id/transcripts,
 * затем POST /api/insights/analyze/:roomId → Gemini жуёт сводный текст и возвращает JSON.
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../../db/index.js';
import { GoogleGenAI } from '@google/genai';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { listMessages } from '../rooms/messages.js';
import { listAssignedTagsForRoom } from '../need_tags/service.js';
import { detectNeedTags, applyDetectedTags } from '../need_tags/detector.js';
import { send500 } from '../../utils/http_error.js';

const insightsRouter = Router();
import { JWT_SECRET } from '../../config/secrets.js';

function requireTenant(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    (req as any).tenantId = decoded.tenantId;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

insightsRouter.use(requireTenant);

const INSIGHTS_PROMPT = `You are analyzing a recorded translated business conversation. Output STRICTLY valid JSON, no markdown, no preamble.

Schema:
{
  "sentiment": { "label": "positive" | "neutral" | "negative", "score": 0-100, "reason": "1-sentence explanation" },
  "engagement": { "score": 0-100, "reason": "1-sentence explanation based on response length, turn-taking, interest signals" },
  "tags": ["short", "topic", "tags", "in", "russian"] (3-8 items, lowercase, single-word when possible),
  "leadScore": { "score": 0-100, "stage": "cold" | "warm" | "hot" | "qualified", "reason": "1-sentence" },
  "summary": "2-3 sentence neutral summary of what was discussed (in Russian)",
  "nextSteps": ["actionable", "next", "step", "items"] (1-5 short imperatives in Russian, e.g. "Назначить демо на следующей неделе")
}

Rules:
- Output ONLY the JSON object. No \`\`\` fences. No "Here is the analysis".
- If the conversation is too short or too noisy to analyze meaningfully, return: {"sentiment":{"label":"neutral","score":50,"reason":"Слишком короткий разговор для оценки."}, "engagement":{"score":0,"reason":"Недостаточно данных."},"tags":[],"leadScore":{"score":0,"stage":"cold","reason":"Недостаточно данных."},"summary":"Разговор слишком короткий для анализа.","nextSteps":[]}
- Russian for human-readable fields. English for enum values (sentiment.label, leadScore.stage).
`;

insightsRouter.post('/analyze/:roomId', async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { roomId } = req.params;

  try {
    // 1. Проверка: room существует + creator == tenantId
    const roomRes = await pool.query(
      'SELECT creator_tenant_id, transcripts, kind FROM rooms WHERE id = $1 LIMIT 1',
      [roomId]
    );
    const room: any = (roomRes.rows as any[])[0];
    if (!room) return res.status(404).json({ error: 'Комната не найдена.' });
    if (room.creator_tenant_id !== tenantId) {
      return res.status(403).json({ error: 'Анализ доступен только создателю комнаты.' });
    }

    // 2. Проверка: tier == enterprise
    const subRes = await pool.query('SELECT tier FROM subscriptions WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    const tier = (subRes.rows as any[])[0]?.tier;
    if (tier !== 'enterprise') {
      return res.status(402).json({
        error: 'Анализ разговора доступен только на тарифе Enterprise.',
        requiredTier: 'enterprise',
        currentTier: tier || null,
      });
    }

    // 3. ENTERPRISE v0.10.0: собираем контекст из 2 источников
    //   (a) rooms.transcripts — субтитры video-звонков (legacy)
    //   (b) room_messages — полный чат (telegram_chat + ручные сообщения + зеркало транскриптов)
    // Приоритет: room_messages (более широкий контекст).
    //
    // Admin-заметки (source='chat' from sender='admin') выделяются ОТДЕЛЬНО как
    // "AUTHORITATIVE NOTES" — это уточнения владельца, которые имеют приоритет
    // над любым другим контекстом (договорённости по цене, особые условия и т.д.).
    let lines: string[] = [];
    let adminNotes: string[] = [];

    // (b) room_messages
    try {
      const messages = await listMessages(roomId, 1500);
      for (const m of messages) {
        if (!m.content || !m.content.trim()) continue;
        if (m.sender === 'admin' && m.source === 'chat') {
          // Заметки админа — отдельный блок (приоритетный)
          const ts = new Date(m.createdAt).toLocaleString('ru-RU');
          adminNotes.push(`[${ts}] ${m.content}`);
        } else if (m.sender === 'client' || m.sender === 'ai' || m.sender === 'admin') {
          const role =
            m.sender === 'ai' ? 'AI' :
            m.sender === 'admin' ? 'ADMIN' :
            'CLIENT';
          lines.push(`[${role}]: ${m.content}`);
        }
      }
    } catch (err) {
      console.warn('[Insights] room_messages fetch failed, falling back to transcripts:', (err as Error).message);
    }

    // (a) fallback на legacy transcripts если room_messages пуст
    if (lines.length === 0) {
      let transcripts: any[] = [];
      const raw = room.transcripts;
      if (raw) {
        transcripts = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      if (Array.isArray(transcripts)) {
        lines = transcripts
          .filter((t: any) => t && t.isFinal && typeof t.text === 'string')
          .slice(-1500)
          .map((t: any) => `[${t.author || 'speaker'}]: ${t.text}`);
      }
    }

    if (lines.length < 2) {
      const minimal = {
        sentiment: { label: 'neutral', score: 50, reason: 'Слишком короткий разговор для оценки.' },
        engagement: { score: 0, reason: 'Недостаточно данных.' },
        tags: [],
        leadScore: { score: 0, stage: 'cold', reason: 'Недостаточно данных.' },
        summary: 'Разговор слишком короткий для анализа.',
        nextSteps: [],
      };
      try {
        await pool.query('UPDATE rooms SET insights = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [JSON.stringify(minimal), roomId]);
      } catch {}
      return res.json({ status: 'success', insights: minimal, lineCount: lines.length });
    }

    const conversation = lines.join('\n');

    // 4. ENTERPRISE v0.10.17: подмешиваем tenant promt + KB по строгому разделению зон:
    //   - telegram_chat комнаты → questflow_prompt + questflow_knowledge_base (Раздел 3)
    //   - video комнаты → НИЧЕГО (Раздел 2 «Подсказки» работает только для tone-explain)
    // Admin-заметки (см. ниже) идут для обоих типов как ПРИОРИТЕТНЫЙ контекст.
    let tenantContext = '';
    if (room.kind === 'telegram_chat') {
      try {
        const r = await pool.query(
          `SELECT questflow_prompt, questflow_knowledge_base FROM tenants WHERE id = $1 LIMIT 1`,
          [tenantId]
        );
        const t: any = (r.rows as any[])[0] || {};
        const promptShort = String(t.questflow_prompt || '').slice(0, 2000);
        const kbShort = String(t.questflow_knowledge_base || '').slice(0, 4000);
        if (promptShort) tenantContext += `\n\n# Контекст компании (учти при анализе):\n${promptShort}`;
        if (kbShort) tenantContext += `\n\n# Из базы знаний (фрагмент):\n${kbShort}`;
      } catch {}
    }

    // ПРИОРИТЕТНЫЕ заметки админа — должны перебивать промт/KB при конфликте.
    // Это договорённости по конкретному клиенту: цена, особые условия, скидки и т.д.
    if (adminNotes.length > 0) {
      const notesBlock = adminNotes.slice(-50).join('\n');
      tenantContext += `\n\n# ⚠️ ПРИОРИТЕТНЫЕ ЗАМЕТКИ ВЛАДЕЛЬЦА (override всего остального)
Эти заметки добавил владелец аккаунта вручную для этого конкретного клиента.
ОНИ ИМЕЮТ ВЫСШИЙ ПРИОРИТЕТ над «Контекстом компании» и «Базой знаний» — если есть
противоречие (например, владелец дал особую цену или условие), используй именно ЭТИ данные:
${notesBlock}`;
    }

    // Текущие присвоенные теги — даём Gemini понять что уже выявлено, чтобы он мог расширить
    try {
      const tags = await listAssignedTagsForRoom(roomId);
      if (tags.length > 0) {
        tenantContext += `\n\n# Уже присвоенные клиенту теги потребностей:\n${tags.map((t) => `- ${t.name}`).join('\n')}`;
      }
    } catch {}

    // 5. Gemini Flash (per-tenant key с fallback на глобальный)
    const apiKey = await getEffectiveGeminiKey(tenantId);
    if (!apiKey) return res.status(503).json({ error: 'Gemini API Key не настроен ни per-tenant, ни глобально.' });
    const ai = new GoogleGenAI({ apiKey });

    const resp = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `${INSIGHTS_PROMPT}${tenantContext}\n\nCONVERSATION:\n${conversation}` }],
      }],
    });

    const text = resp.text || '';
    let insights: any;
    try {
      const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      insights = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Не удалось распарсить ответ Gemini.', raw: text.slice(0, 500) });
    }

    // 6. Сохраняем
    try {
      await pool.query('UPDATE rooms SET insights = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [JSON.stringify(insights), roomId]);
    } catch {}

    // 7. ENTERPRISE v0.10.17: при анализе тоже запускаем детектор тегов потребностей.
    // Раньше теги детектились только для Quest Flow (на каждом сообщении). Теперь
    // для video-комнат теги тоже выявляются — когда владелец нажимает «Анализ».
    // Description каждого тега = инструкция владельца для AI «как распознать упоминание».
    let detectedTags: Array<{ tagId: string; tagName: string; confidence: number }> = [];
    let newTagsAdded = 0;
    try {
      const matches = await detectNeedTags(tenantId, conversation);
      if (matches.length > 0) {
        newTagsAdded = await applyDetectedTags(roomId, null, matches);
        detectedTags = matches.map((m) => ({
          tagId: m.tagId,
          tagName: m.tagName,
          confidence: m.confidence,
        }));
      }
    } catch (err) {
      console.warn('[Insights] tag detection failed (continuing):', (err as Error).message);
    }

    return res.json({
      status: 'success',
      insights,
      lineCount: lines.length,
      detectedTags,
      newTagsAdded,
    });
  } catch (err: any) {
    console.error('[Insights] analyze error:', err);
    return send500(res, err, 'insights');
  }
});

export default insightsRouter;
