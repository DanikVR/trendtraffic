/**
 * Google Flow — бэкенд блока «Google Flow» в TrendFlow.
 *
 * Мы НЕ ходим в Flow сами (у Flow нет официального API). Работает Chrome-расширение
 * (apps/flow-extension) в браузере клиента: человек залогинен в свой Google Flow,
 * расширение забирает отсюда задачи, автоматизирует генерацию Veo 3.1 и присылает
 * готовые клипы обратно. Этот роутер — только очередь задач + приёмник результата.
 *
 * Пер-тенантно по своей природе: расширение крутится под Google-аккаунтом и
 * подпиской Flow самого клиента. Доступ к ручкам — JWT + Enterprise (как social-ext).
 *
 * Поток:
 *   узел TrendFlow → POST /enqueue (кладём сегменты в очередь)
 *   расширение     → GET  /tasks   (атомарно захватывает queued → running)
 *                  → POST /status  (running/retry/failed + заметка)
 *                  → POST /ingest  (готовое видео → Галерея folder='flow')
 *   узел TrendFlow → GET  /list    (показать статусы задач)
 *
 * Таблица flow_ext_tasks (Postgres, inline-init как notebooklm_jobs).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import pool from '../../db/index.js';
import { createAsset } from '../media/assets.js';
import { downloadVideoToDisk } from '../media/store_video.js';

/** Папка Галереи для готовых клипов Flow (вкладка «Google Flow»). */
export const FLOW_FOLDER = 'flow';

/** Referer для скачивания результата (Google-CDN капризен к источнику). */
const FLOW_REFERER = 'https://labs.google/';

/** Максимальная база64-заливка (fallback, когда прямой ссылки нет). Обычно
 *  расширение шлёт sourceUrl и сюда не попадает. */
const INGEST_JSON_LIMIT = '96mb';

const __dirname_f = path.dirname(fileURLToPath(import.meta.url));
const FLOW_DIR = path.resolve(__dirname_f, '../../../../uploads/source-videos');
try { fs.mkdirSync(FLOW_DIR, { recursive: true }); } catch { /* best-effort */ }

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: any;
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

/** Блок Google Flow — только Enterprise (+superadmin-bypass внутри hasEnterpriseAccess). */
async function requireEnterprise(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole)) return next();
  } catch (err) {
    console.warn('[flow-ext] enterprise-гейт:', err);
  }
  return res.status(403).json({ error: 'Доступно только на тарифе Enterprise' });
}

// ── Таблица (inline-init, как notebooklm_jobs) ──────────────────────────────
async function ensureTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flow_ext_tasks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      flow_id TEXT,
      prompt TEXT NOT NULL,
      refs JSONB,
      settings JSONB,
      title TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      note TEXT,
      asset_id TEXT,
      file_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_flow_tasks_tenant ON flow_ext_tasks(tenant_id, status, created_at DESC)`);
}
ensureTables().catch((e) => console.warn('[flow-ext] init таблиц:', (e as Error).message));

function mapTask(r: any) {
  return {
    id: r.id,
    prompt: r.prompt,
    title: r.title || null,
    references: Array.isArray(r.refs) ? r.refs : [],
    settings: r.settings || {},
    status: r.status,
    note: r.note || null,
    assetId: r.asset_id || null,
    fileUrl: r.file_url || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Сохранение видео результата ─────────────────────────────────────────────
/** data:video/mp4;base64,... → файл на диск (fallback, когда нет прямой ссылки). */
function saveDataUrl(dataUrl: string): { fileUrl: string; filePath: string; size: number; mime: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('неверный dataUrl');
  const mime = m[1] || 'video/mp4';
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 1024) throw new Error('пустое видео');
  const ext = mime.includes('webm') ? 'webm' : 'mp4';
  const name = `flow-${randomUUID()}.${ext}`;
  const filePath = path.join(FLOW_DIR, name);
  fs.writeFileSync(filePath, buf);
  return { fileUrl: `/uploads/source-videos/${name}`, filePath, size: buf.length, mime };
}

// ── Роутер ──────────────────────────────────────────────────────────────────
const router = Router();

/** Мягкий лимит на поллинг расширения (защита БД от runaway-циклов).
 *  Ключ — tenantId (requireAuth гарантирует его до этого middleware). НЕ req.ip:
 *  express-rate-limit иначе кидает ValidationError про обход лимита по IPv6. */
const pollLimiter = rateLimit({
  windowMs: 60_000, max: 240,
  keyGenerator: (req: AuthedRequest) => req.tenantId || 'anon',
  standardHeaders: true, legacyHeaders: false,
});

router.use(requireAuth, requireEnterprise);

/** Узел TrendFlow кладёт сегменты в очередь. */
router.post('/enqueue', async (req: AuthedRequest, res: Response) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const flowId = typeof req.body?.flowId === 'string' ? req.body.flowId : null;
  const clean = items
    .map((it: any) => ({
      prompt: String(it?.prompt || '').trim(),
      title: it?.title ? String(it.title).slice(0, 200) : null,
      references: Array.isArray(it?.references) ? it.references.filter((u: any) => typeof u === 'string').slice(0, 8) : [],
      settings: it?.settings && typeof it.settings === 'object' ? it.settings : {},
    }))
    .filter((it: any) => it.prompt);
  if (!clean.length) return res.status(400).json({ error: 'Нет задач с промптом' });

  const ids: string[] = [];
  for (const it of clean) {
    const id = randomUUID();
    ids.push(id);
    await pool.query(
      `INSERT INTO flow_ext_tasks (id, tenant_id, flow_id, prompt, refs, settings, title)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, req.tenantId, flowId, it.prompt, JSON.stringify(it.references), JSON.stringify(it.settings), it.title]
    );
  }
  res.json({ ok: true, enqueued: ids.length, ids });
});

/**
 * Расширение забирает задачи. Атомарно переводит queued (и «зависшие» running
 * старше 15 мин — реанимация после падения вкладки) в running и отдаёт их —
 * так одна задача не уйдёт двум поллам сразу.
 */
router.get('/tasks', pollLimiter, async (req: AuthedRequest, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '1'), 10) || 1, 1), 5);
  const r = await pool.query(
    `UPDATE flow_ext_tasks SET status='running', updated_at=now()
      WHERE id IN (
        SELECT id FROM flow_ext_tasks
         WHERE tenant_id=$1
           AND (status='queued' OR (status='running' AND updated_at < now() - interval '15 minutes'))
         ORDER BY created_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED
      )
      RETURNING *`,
    [req.tenantId, limit]
  );
  res.json({ tasks: (r.rows as any[]).map(mapTask) });
});

/** Расширение обновляет статус задачи (running/retry/failed + заметка). */
router.post('/status', async (req: AuthedRequest, res: Response) => {
  const taskId = String(req.body?.taskId || '');
  let status = String(req.body?.status || '');
  const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
  if (!taskId || !status) return res.status(400).json({ error: 'нет taskId/status' });
  // 'retry' (напр. троттлинг Flow) → возвращаем в очередь, чтобы забрать позже.
  if (status === 'retry') status = 'queued';
  const allowed = ['queued', 'running', 'done', 'failed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'неизвестный статус' });
  const r = await pool.query(
    `UPDATE flow_ext_tasks SET status=$1, note=$2, updated_at=now()
      WHERE id=$3 AND tenant_id=$4 RETURNING id`,
    [status, note, taskId, req.tenantId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'задача не найдена' });
  res.json({ ok: true });
});

/** Расширение присылает готовый клип → Галерея folder='flow', задача → done. */
router.post('/ingest', async (req: AuthedRequest, res: Response) => {
  const taskId = String(req.body?.taskId || '');
  const sourceUrl = req.body?.sourceUrl ? String(req.body.sourceUrl) : '';
  const dataUrl = req.body?.dataUrl ? String(req.body.dataUrl) : '';
  if (!taskId) return res.status(400).json({ error: 'нет taskId' });
  // Задача должна принадлежать тенанту.
  const t = await pool.query(`SELECT id, prompt, title FROM flow_ext_tasks WHERE id=$1 AND tenant_id=$2`, [taskId, req.tenantId]);
  if (!t.rowCount) return res.status(404).json({ error: 'задача не найдена' });
  const task = t.rows[0];

  try {
    let stored: { fileUrl: string; filePath: string; size: number; mime: string };
    if (sourceUrl && /^https?:/.test(sourceUrl)) {
      const s = await downloadVideoToDisk([sourceUrl], { referer: FLOW_REFERER });
      stored = { fileUrl: s.mediaUrl, filePath: s.filePath, size: s.size, mime: s.mime };
    } else if (dataUrl.startsWith('data:')) {
      stored = saveDataUrl(dataUrl);
    } else {
      return res.status(400).json({ error: 'нет sourceUrl/dataUrl' });
    }

    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: 'video',
      originalName: (task.title || task.prompt || 'flow').slice(0, 120) + '.mp4',
      fileUrl: stored.fileUrl, filePath: stored.filePath, mime: stored.mime, size: stored.size,
      folder: FLOW_FOLDER,
    });

    await pool.query(
      `UPDATE flow_ext_tasks SET status='done', asset_id=$1, file_url=$2, note=NULL, updated_at=now() WHERE id=$3`,
      [asset?.id || null, stored.fileUrl, taskId]
    );
    res.json({ ok: true, assetId: asset?.id || null, fileUrl: stored.fileUrl });
  } catch (e: any) {
    await pool.query(`UPDATE flow_ext_tasks SET status='failed', note=$1, updated_at=now() WHERE id=$2`, [String(e?.message || e).slice(0, 500), taskId]);
    res.status(502).json({ error: 'не удалось сохранить видео: ' + (e?.message || e) });
  }
});

/** Узел TrendFlow: список задач тенанта (статусы для UI). */
router.get('/list', async (req: AuthedRequest, res: Response) => {
  const flowId = req.query.flowId ? String(req.query.flowId) : null;
  const r = flowId
    ? await pool.query(`SELECT * FROM flow_ext_tasks WHERE tenant_id=$1 AND flow_id=$2 ORDER BY created_at DESC LIMIT 100`, [req.tenantId, flowId])
    : await pool.query(`SELECT * FROM flow_ext_tasks WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100`, [req.tenantId]);
  res.json({ tasks: (r.rows as any[]).map(mapTask) });
});

/** Узел TrendFlow: убрать завершённые/битые из списка. */
router.post('/clear', async (req: AuthedRequest, res: Response) => {
  await pool.query(`DELETE FROM flow_ext_tasks WHERE tenant_id=$1 AND status IN ('done','failed')`, [req.tenantId]);
  res.json({ ok: true });
});

export const INGEST_LIMIT = INGEST_JSON_LIMIT;
export default router;
