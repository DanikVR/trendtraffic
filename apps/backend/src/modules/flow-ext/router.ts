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
import { createAsset, listAssets } from '../media/assets.js';
import { downloadVideoToDisk } from '../media/store_video.js';

/** Папка Галереи для готовых клипов Flow (вкладка «Google Flow»). */
export const FLOW_FOLDER = 'flow';

/** Referer для скачивания результата (Google-CDN капризен к источнику). */
const FLOW_REFERER = 'https://labs.google/';

/** Максимальная база64-заливка «В галерею» (расширение шлёт готовые видео/картинки base64).
 *  210mb ≈ под лимит nginx (210M): base64 раздувает ×1.37, т.е. реальный клип до ~150 МБ. */
const INGEST_JSON_LIMIT = '210mb';

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
  // Авто-разведка вёрстки живого Flow: расширение шлёт снимок (textarea/кнопки/file-input/
  // video/эндпоинты) — по одной последней записи на тенант. Помогает подстроить селекторы.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flow_ext_recon (
      tenant_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      url TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    )`);
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

/** Сохранить входящее видео (прямая CDN-ссылка ИЛИ base64 dataUrl) на диск. Общий код /ingest и /ingest-manual. */
async function storeIncomingVideo(sourceUrl: string, dataUrl: string): Promise<{ fileUrl: string; filePath: string; size: number; mime: string }> {
  if (sourceUrl && /^https?:/.test(sourceUrl)) {
    const s = await downloadVideoToDisk([sourceUrl], { referer: FLOW_REFERER });
    return { fileUrl: s.mediaUrl, filePath: s.filePath, size: s.size, mime: s.mime };
  }
  if (dataUrl.startsWith('data:')) return saveDataUrl(dataUrl);
  throw new Error('нет sourceUrl/dataUrl');
}

/** Скачать КАРТИНКУ (Flow-ассет: изображение/кадр) по прямой ссылке на диск. */
async function downloadImageToDisk(url: string): Promise<{ fileUrl: string; filePath: string; size: number; mime: string }> {
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: FLOW_REFERER, Accept: 'image/*,*/*' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const ct = resp.headers.get('content-type') || 'image/png';
  if (!/image\//i.test(ct)) throw new Error(`не картинка (${ct})`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < 128) throw new Error('пустая картинка');
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : ct.includes('avif') ? 'avif' : 'jpg';
  const name = `flow-${randomUUID()}.${ext}`;
  const filePath = path.join(FLOW_DIR, name);
  fs.writeFileSync(filePath, buf);
  return { fileUrl: `/uploads/source-videos/${name}`, filePath, size: buf.length, mime: ct };
}

/** Сохранить входящую КАРТИНКУ (base64 dataUrl ИЛИ прямая ссылка). */
async function storeIncomingImage(sourceUrl: string, dataUrl: string): Promise<{ fileUrl: string; filePath: string; size: number; mime: string }> {
  if (dataUrl.startsWith('data:image')) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
    if (!m) throw new Error('неверный dataUrl');
    const mime = m[1] || 'image/png';
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < 128) throw new Error('пустая картинка');
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : mime.includes('avif') ? 'avif' : 'jpg';
    const name = `flow-${randomUUID()}.${ext}`;
    const filePath = path.join(FLOW_DIR, name);
    fs.writeFileSync(filePath, buf);
    return { fileUrl: `/uploads/source-videos/${name}`, filePath, size: buf.length, mime };
  }
  if (sourceUrl && /^https?:/.test(sourceUrl)) return await downloadImageToDisk(sourceUrl);
  throw new Error('нет sourceUrl/dataUrl');
}

/** Абсолютная база сервиса (расширение качает байты из background — нужен полный URL). */
function absBase(req: AuthedRequest): string {
  const env = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}
const absUrl = (base: string, u?: string): string => (u && !/^https?:\/\//i.test(u) ? base + (u.startsWith('/') ? u : '/' + u) : (u || ''));

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
    const stored = await storeIncomingVideo(sourceUrl, dataUrl);

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

/**
 * Расширение (кнопка «Из Галереи» в живом Flow): список ВИДЕО тенанта для заливки в Flow
 * на переработку. Абсолютные URL — расширение качает байты из background (обход CORS страницы).
 */
router.get('/gallery', async (req: AuthedRequest, res: Response) => {
  try {
    const base = absBase(req);
    const all = await listAssets(req.tenantId!, 'reference');
    const isImg = (a: any) => String(a.mediaType || '').startsWith('image') || /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(a.fileUrl || '');
    const items = all
      .filter((a) => String(a.mediaType || '').startsWith('video') || isImg(a) || /\.(mp4|webm|mov|m4v|mkv)(\?|#|$)/i.test(a.fileUrl || ''))
      .slice(0, 150)
      .map((a) => ({ id: a.id, title: a.originalName || 'файл', fileUrl: absUrl(base, a.fileUrl), folder: a.folder || null, type: isImg(a) ? 'image' : 'video' }));
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * Расширение (кнопка «В галерею» в живом Flow): произвольный клип, собранный человеком прямо
 * в Flow (не из очереди), → Галерея folder='flow'. Без taskId. body: { sourceUrl?|dataUrl?, title? }.
 */
router.post('/ingest-manual', async (req: AuthedRequest, res: Response) => {
  const sourceUrl = req.body?.sourceUrl ? String(req.body.sourceUrl) : '';
  const dataUrl = req.body?.dataUrl ? String(req.body.dataUrl) : '';
  const title = req.body?.title ? String(req.body.title).slice(0, 120) : 'Flow';
  const kind = req.body?.kind === 'image' ? 'image' : req.body?.kind === 'video' ? 'video' : '';
  if (!sourceUrl && !dataUrl) return res.status(400).json({ error: 'нет sourceUrl/dataUrl' });
  // Картинка — если так сказало расширение, либо по mime dataUrl / расширению ссылки. Иначе видео.
  const isImage = kind === 'image'
    || dataUrl.startsWith('data:image')
    || (!kind && !!sourceUrl && /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(sourceUrl));
  try {
    const stored = isImage ? await storeIncomingImage(sourceUrl, dataUrl) : await storeIncomingVideo(sourceUrl, dataUrl);
    const imgExt = stored.mime.includes('png') ? 'png' : stored.mime.includes('webp') ? 'webp' : stored.mime.includes('gif') ? 'gif' : 'jpg';
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: isImage ? 'image' : 'video',
      originalName: (title || 'Flow').slice(0, 112) + (isImage ? '.' + imgExt : '.mp4'),
      fileUrl: stored.fileUrl, filePath: stored.filePath, mime: stored.mime, size: stored.size,
      folder: FLOW_FOLDER,
    });
    res.json({ ok: true, assetId: asset?.id || null, fileUrl: stored.fileUrl, mediaType: isImage ? 'image' : 'video' });
  } catch (e: any) {
    res.status(502).json({ error: 'не удалось сохранить медиа: ' + (e?.message || e) });
  }
});

/**
 * Авто-разведка: расширение шлёт снимок вёрстки живого Flow (кандидаты поля промпта, кнопки
 * генерации, input[type=file] для заливки, video-результата + виденные эндпоинты). По одной
 * последней записи на тенант — чтобы подстроить селекторы под текущий Flow, не прося HTML руками.
 */
router.post('/recon', async (req: AuthedRequest, res: Response) => {
  const data = req.body?.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'нет data' });
  const url = req.body?.url ? String(req.body.url).slice(0, 500) : null;
  try {
    await pool.query(
      `INSERT INTO flow_ext_recon (tenant_id, data, url, updated_at) VALUES ($1,$2,$3,now())
       ON CONFLICT (tenant_id) DO UPDATE SET data=EXCLUDED.data, url=EXCLUDED.url, updated_at=now()`,
      [req.tenantId, JSON.stringify(data), url]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/** Последний снимок разведки тенанта (для отладки селекторов). */
router.get('/recon', async (req: AuthedRequest, res: Response) => {
  const r = await pool.query(`SELECT data, url, updated_at FROM flow_ext_recon WHERE tenant_id=$1`, [req.tenantId]);
  if (!r.rowCount) return res.json({ recon: null });
  const row = r.rows[0];
  res.json({ recon: { data: row.data, url: row.url, updatedAt: row.updated_at } });
});

export const INGEST_LIMIT = INGEST_JSON_LIMIT;
export default router;
