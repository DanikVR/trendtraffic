/**
 * Tenant Prompt — кастомный prompt владельца и база знаний.
 *
 * Каждый tenant может задать (по желанию):
 *  - custom_prompt — короткий текст с тематикой/терминологией звонка.
 *  - knowledge_base — большой текстовый файл (загружается), ограничен 50 000 символов.
 *
 * Эти значения подмешиваются bridge'ом в systemInstruction Gemini Live при создании сессии,
 * с приоритетом ВЫШЕ дефолтного промпта (но НЕ ВЫШЕ глоссариев из AI Learning Hub Pro).
 *
 * Endpoints (требуют tenant JWT):
 *   GET  /api/tenant-prompt          → { customPrompt, knowledgeBase, knowledgeBaseFilename, kbLength }
 *   PUT  /api/tenant-prompt          → body { customPrompt, knowledgeBase?, knowledgeBaseFilename? }
 *   DELETE /api/tenant-prompt/kb     → очистить базу знаний
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import pool from '../../db/index.js';
import { parseFile, UnsupportedFileFormatError } from './parsers/index.js';
import { TONE_PRESETS } from './presets.js';
import { DEFAULT_CUSTOM_TONE_PROMPT } from '../enterprise_chat/tone_response.js';
import { send500 } from '../../utils/http_error.js';

const tenantPromptRouter = Router();
import { JWT_SECRET } from '../../config/secrets.js';
// ENTERPRISE v0.10.14: лимиты увеличены в 10 раз. Технических причин держать меньше нет —
// Gemini 2.5 Flash context window = 1M токенов (≈4M символов). Промт и KB подмешиваются
// в каждый Gemini-запрос, так что трафик/латентность вырастут — но это компромисс,
// который владелец Enterprise аккаунта может сделать сам.
const MAX_PROMPT_LEN = 40_000;       // было 4_000
const MAX_KB_LEN = 500_000;          // было 50_000 (≈125k токенов)
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB (было 5 MB)

// In-memory upload (мы парсим в plain text и сохраняем в БД — не нужен диск).
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

function requireTenant(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    if (!decoded.tenantId) return res.status(401).json({ error: 'tenantId отсутствует в токене' });
    (req as any).tenantId = decoded.tenantId;
    next();
  } catch (err: any) {
    const name = err?.name || 'Error';
    return res.status(401).json({ error: name === 'TokenExpiredError' ? 'Сессия истекла' : 'Невалидный токен' });
  }
}

tenantPromptRouter.use(requireTenant);

tenantPromptRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  try {
    const r = await pool.query(
      'SELECT custom_prompt, knowledge_base, knowledge_base_filename FROM tenants WHERE id = $1 LIMIT 1',
      [tenantId]
    );
    const row = (r.rows as any[])[0] || {};
    return res.json({
      customPrompt: row.custom_prompt || '',
      knowledgeBase: row.knowledge_base || '',
      knowledgeBaseFilename: row.knowledge_base_filename || null,
      kbLength: (row.knowledge_base || '').length,
    });
  } catch (err: any) {
    return send500(res, err, 'tenantPrompt');
  }
});

tenantPromptRouter.put('/', async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  let { customPrompt, knowledgeBase, knowledgeBaseFilename } = req.body || {};

  if (typeof customPrompt !== 'string') customPrompt = '';
  customPrompt = customPrompt.slice(0, MAX_PROMPT_LEN);

  // knowledgeBase: undefined → не трогаем; null/'' → очистка; string → сохраняем (с лимитом).
  let kbUpdate: { update: boolean; value: string | null; filename: string | null } = { update: false, value: null, filename: null };
  if (knowledgeBase !== undefined) {
    if (!knowledgeBase) {
      kbUpdate = { update: true, value: null, filename: null };
    } else if (typeof knowledgeBase === 'string') {
      const trimmed = knowledgeBase.slice(0, MAX_KB_LEN);
      kbUpdate = { update: true, value: trimmed, filename: (typeof knowledgeBaseFilename === 'string' ? knowledgeBaseFilename.slice(0, 250) : null) };
    }
  }

  try {
    if (kbUpdate.update) {
      await pool.query(
        'UPDATE tenants SET custom_prompt = $1, knowledge_base = $2, knowledge_base_filename = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [customPrompt, kbUpdate.value, kbUpdate.filename, tenantId]
      );
    } else {
      await pool.query(
        'UPDATE tenants SET custom_prompt = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [customPrompt, tenantId]
      );
    }
    return res.json({ status: 'success' });
  } catch (err: any) {
    return send500(res, err, 'tenantPrompt');
  }
});

tenantPromptRouter.delete('/kb', async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  try {
    await pool.query(
      'UPDATE tenants SET knowledge_base = NULL, knowledge_base_filename = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [tenantId]
    );
    return res.json({ status: 'success' });
  } catch (err: any) {
    return send500(res, err, 'tenantPrompt');
  }
});

/**
 * ENTERPRISE v0.10.0: загрузка knowledge base из TXT/DOCX/XLSX/CSV.
 *
 * Файл парсится на сервере (mammoth / xlsx) → plain text → сохраняется в БД.
 * Возвращает извлечённый текст и его длину, чтобы клиент мог его показать в
 * preview без второго запроса.
 *
 * POST /api/tenant-prompt/upload (multipart/form-data, field name: "file")
 */
tenantPromptRouter.post('/upload', uploadMemory.single('file'), async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'Файл не передан (form field "file")' });

  try {
    const parsed = await parseFile(file.buffer, file.mimetype, file.originalname);
    const trimmed = parsed.text.slice(0, MAX_KB_LEN);
    const filename = file.originalname.slice(0, 250);

    await pool.query(
      `UPDATE tenants
       SET knowledge_base = $1, knowledge_base_filename = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [trimmed, filename, tenantId]
    );

    return res.json({
      status: 'success',
      format: parsed.format,
      filename,
      kbLength: trimmed.length,
      truncated: parsed.text.length > MAX_KB_LEN,
      // Превью первых 500 символов — клиент может показать сразу
      preview: trimmed.slice(0, 500),
    });
  } catch (err: any) {
    if (err instanceof UnsupportedFileFormatError) {
      return res.status(400).json({ error: err.message });
    }
    return send500(res, err, 'tenantPrompt');
  }
});

/**
 * Проверка синхронизации: читает custom_prompt + knowledge_base из БД
 * и подтверждает, что они доступны (bridge получит их на следующей сессии).
 *
 * POST /api/tenant-prompt/sync-check
 * Returns: { synced: true, promptLength, kbLength, kbFilename }
 */
tenantPromptRouter.post('/sync-check', async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  try {
    const r = await pool.query(
      'SELECT custom_prompt, knowledge_base, knowledge_base_filename FROM tenants WHERE id = $1 LIMIT 1',
      [tenantId]
    );
    const row = (r.rows as any[])[0] || {};
    return res.json({
      synced: true,
      promptLength: (row.custom_prompt || '').length,
      kbLength: (row.knowledge_base || '').length,
      kbFilename: row.knowledge_base_filename || null,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return send500(res, err, 'tenantPrompt');
  }
});

/**
 * Статический список пресет-тонов для чата Enterprise.
 * GET /api/tenant-prompt/presets
 */
tenantPromptRouter.get('/presets', (_req: Request, res: Response) => {
  return res.json({
    presets: TONE_PRESETS.map((p) => ({
      key: p.key,
      label: p.label,
      description: p.description,
      // systemPrompt — не отдаём клиенту, он используется только на сервере.
      hasSystemPrompt: !!p.systemPrompt,
    })),
  });
});

/**
 * Дефолтный системный промт для tone='custom' — показывается в UI как «вот так
 * AI расшифровывает по умолчанию, можете дополнить своими пожеланиями ниже».
 * GET /api/tenant-prompt/default-system-prompt
 */
tenantPromptRouter.get('/default-system-prompt', (_req: Request, res: Response) => {
  return res.json({ defaultPrompt: DEFAULT_CUSTOM_TONE_PROMPT });
});

// (v0.10.17) Удалён мёртвый getTenantPromptForBridge: bridge.ts больше не
// подмешивает custom_prompt/knowledge_base. Раздел «Подсказки» работает только
// для tone-explain в чате видео-комнаты; вызовов функции в коде не осталось.

export default tenantPromptRouter;
