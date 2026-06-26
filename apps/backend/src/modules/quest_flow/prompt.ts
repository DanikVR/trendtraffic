/**
 * CRUD для tenants.questflow_prompt и tenants.questflow_knowledge_base.
 *
 * Эти поля используются ОТДЕЛЬНО от общего custom_prompt/knowledge_base —
 * они задают как AI общается с Telegram-клиентами через Quest Flow.
 *
 * Если questflow_* пусты, responder.ts fallback'ит на общие custom_prompt/knowledge_base.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import pool from '../../db/index.js';
import { parseFile, UnsupportedFileFormatError } from '../tenant_prompt/parsers/index.js';
import { DEFAULT_QUEST_FLOW_SYSTEM_PROMPT } from './responder.js';
import {
  requireEnterprise,
  EnterpriseFeatureRequiredError,
  type UserRole,
} from '../billing/feature_gate.js';

const router = Router();
import { JWT_SECRET } from '../../config/secrets.js';
// ENTERPRISE v0.10.14: лимиты увеличены в 10 раз (см. tenant_prompt/router.ts)
const MAX_PROMPT_LEN = 40_000;
const MAX_KB_LEN = 500_000;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: UserRole;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

async function ensureEnterprise(req: AuthedRequest, res: Response, feature: string): Promise<boolean> {
  try {
    await requireEnterprise(req.tenantId, req.userRole, feature);
    return true;
  } catch (err) {
    if (err instanceof EnterpriseFeatureRequiredError) {
      res.status(402).json({ error: err.message, feature: err.feature });
      return false;
    }
    res.status(500).json({ error: (err as Error).message });
    return false;
  }
}

router.use(requireAuth);

// GET /api/quest-flow/prompt
router.get('/', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-prompt'))) return;
  try {
    const r = await pool.query(
      `SELECT questflow_prompt, questflow_knowledge_base, questflow_kb_filename
       FROM tenants WHERE id = $1 LIMIT 1`,
      [req.tenantId!]
    );
    const row = (r.rows as any[])[0] || {};
    res.json({
      prompt: row.questflow_prompt || '',
      knowledgeBase: row.questflow_knowledge_base || '',
      kbFilename: row.questflow_kb_filename || null,
      kbLength: (row.questflow_knowledge_base || '').length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

// PUT /api/quest-flow/prompt — обновить только prompt
router.put('/', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-prompt'))) return;
  try {
    let { prompt } = req.body || {};
    if (typeof prompt !== 'string') prompt = '';
    prompt = prompt.slice(0, MAX_PROMPT_LEN);
    await pool.query(
      `UPDATE tenants SET questflow_prompt = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [prompt, req.tenantId!]
    );
    res.json({ ok: true, promptLength: prompt.length });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения' });
  }
});

// POST /api/quest-flow/prompt/upload — загрузка KB
router.post('/upload', uploadMemory.single('file'), async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-prompt'))) return;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: 'Файл не передан (form field "file")' });
  try {
    const parsed = await parseFile(file.buffer, file.mimetype, file.originalname);
    const trimmed = parsed.text.slice(0, MAX_KB_LEN);
    const filename = file.originalname.slice(0, 250);
    await pool.query(
      `UPDATE tenants
       SET questflow_prompt = COALESCE(questflow_prompt, ''),
           questflow_knowledge_base = $1,
           questflow_kb_filename = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [trimmed, filename, req.tenantId!]
    );
    res.json({
      status: 'success',
      format: parsed.format,
      filename,
      kbLength: trimmed.length,
      truncated: parsed.text.length > MAX_KB_LEN,
      preview: trimmed.slice(0, 500),
    });
  } catch (err: any) {
    if (err instanceof UnsupportedFileFormatError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err?.message || 'Ошибка загрузки' });
  }
});

/**
 * Дефолтный системный промт Quest Flow — показывается в UI как «вот как AI общается
 * по умолчанию, если ничего не задано». Раздел 2 «Подсказки» НЕ используется здесь.
 * GET /api/quest-flow/prompt/default-system-prompt
 */
router.get('/default-system-prompt', (_req: AuthedRequest, res: Response) => {
  return res.json({ defaultPrompt: DEFAULT_QUEST_FLOW_SYSTEM_PROMPT });
});

// DELETE /api/quest-flow/prompt/kb
router.delete('/kb', async (req: AuthedRequest, res: Response) => {
  if (!(await ensureEnterprise(req, res, 'quest-flow-prompt'))) return;
  try {
    await pool.query(
      `UPDATE tenants SET questflow_knowledge_base = NULL, questflow_kb_filename = NULL,
                          updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [req.tenantId!]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка очистки' });
  }
});

export default router;
