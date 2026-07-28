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
 *                  → POST /ingest  (готовое видео → Галерея, раздел «Видео»)
 *   узел TrendFlow → GET  /list    (показать статусы задач)
 *
 * Таблица flow_ext_tasks (Postgres, inline-init как notebooklm_jobs).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import pool from '../../db/index.js';
import { createAsset, listAssets } from '../media/assets.js';
import { downloadVideoToDisk } from '../media/store_video.js';
import { composeAdVideo, type AdSegment } from '../render/ad_compose.js';
import { resolveAnthropicKey } from '../render/director.js';
import { callClaudeText, extractJson } from '../skills/claude.js';

/** Легаси-папка старых клипов Flow. Новые клипы сохраняются в «Видео» (без папки);
 *  константа оставлена для совместимости — listAssets('reference') всё равно включает эти клипы. */
export const FLOW_FOLDER = 'flow';

/** Referer для скачивания результата (Google-CDN капризен к источнику). */
const FLOW_REFERER = 'https://labs.google/';

/** Максимальная база64-заливка «В галерею» (расширение шлёт готовые видео/картинки base64).
 *  700mb: base64 раздувает ×1.37, т.е. реальный клип до ~500 МБ (nginx поднят до 700M в деплое). */
const INGEST_JSON_LIMIT = '700mb';

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
  // НАБЛЮДАЕМЫЕ генерации Flow: юзер запустил генерацию прямо в Flow (не через очередь) —
  // расширение шлёт «в проекте X сейчас генерится N клипов» → спиннер на карточке проекта в Галерее.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flow_ext_observed (
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      title TEXT,
      generating INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (tenant_id, project_id)
    )`);
  // Дедуп заливки клипов по ХЕШУ содержимого. Клиентский ключ клипа (blob-видео Flow) ненадёжен:
  // все клипы проекта одной длительности/размера → ключи совпадают/дрейфуют, из-за чего один и тот
  // же клип заливался повторно (6 одинаковых карточек). Хеш байтов ловит это железно.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flow_ext_ingest_dedup (
      tenant_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      asset_id TEXT,
      file_url TEXT,
      media_type TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (tenant_id, content_hash)
    )`);
  // ПАКЕТЫ «Сценарий → пакет» (Flow Booster): спека ролика (сцены/титры/тайминг) + реестр
  // доехавших клипов (index → asset). По готовности пакета Галерея предлагает «Собрать ролик».
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flow_batch_specs (
      tenant_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      title TEXT,
      total INT NOT NULL DEFAULT 0,
      spec JSONB,
      clips JSONB NOT NULL DEFAULT '{}'::jsonb,
      composed_asset_id TEXT,
      composed_file_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (tenant_id, batch_id)
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

/** Расширение присылает готовый клип → Галерея, раздел «Видео» (kind=reference, без папки),
 *  задача → done. Раньше клип падал в folder='flow'; теперь вкладка «Google Flow» показывает
 *  ПРОЕКТЫ Flow, а сохранённые клипы живут в «Видео» — так понятнее. */
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
      // Без папки → раздел «Видео» Галереи (не folder='flow', там теперь проекты Flow).
      origins: ['flow'],
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
 * в Flow (не из очереди), → Галерея, раздел «Видео» (без папки). Без taskId. body: { sourceUrl?|dataUrl?, title? }.
 */
/** Расширение: наблюдаемые генерации проекта Flow (спиннер на карточке проекта в Галерее). */
router.post('/observed', async (req: AuthedRequest, res: Response) => {
  const projectId = String(req.body?.projectId || '').trim();
  const title = req.body?.title ? String(req.body.title).slice(0, 120) : null;
  const generating = Math.max(0, Math.min(50, Number(req.body?.generating) || 0));
  if (!projectId) return res.status(400).json({ error: 'нет projectId' });
  try {
    await pool.query(
      `INSERT INTO flow_ext_observed (tenant_id, project_id, title, generating, updated_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (tenant_id, project_id) DO UPDATE SET title=EXCLUDED.title, generating=EXCLUDED.generating, updated_at=now()`,
      [req.tenantId, projectId, title, generating]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/** Фронт (Галерея → Google Flow): где сейчас идёт генерация (свежие наблюдения ≤ 2 мин). */
router.get('/observed', async (req: AuthedRequest, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT project_id, generating FROM flow_ext_observed
        WHERE tenant_id=$1 AND generating > 0 AND updated_at > now() - interval '2 minutes'`,
      [req.tenantId]
    );
    const observed: Record<string, number> = {};
    for (const row of r.rows) observed[row.project_id] = Number(row.generating) || 0;
    res.json({ observed });
  } catch { res.json({ observed: {} }); }
});

/** Клип пакета «Сценарий → пакет»: регистрируем index→asset в flow_batch_specs (upsert-стабом,
 *  если спека ещё не приехала). Ошибка регистрации НЕ валит ingest — только warn. */
async function registerBatchClip(tenantId: string, batch: any, assetId: string | null, fileUrl: string, mediaType: string): Promise<void> {
  try {
    const id = String(batch?.id || '').trim().slice(0, 80);
    const index = Math.max(0, Math.min(999, Math.round(Number(batch?.index) || 0)));
    if (!id || !index) return; // индексация 1-базная: 0 = «не пакетный клип»
    const total = Math.max(0, Math.min(999, Math.round(Number(batch?.total) || 0)));
    const title = batch?.title ? String(batch.title).slice(0, 160) : null;
    await pool.query(
      `INSERT INTO flow_batch_specs (tenant_id, batch_id, title, total, clips)
       VALUES ($1,$2,$3,$4, jsonb_build_object($5::text, $6::jsonb))
       ON CONFLICT (tenant_id, batch_id) DO UPDATE SET
         clips = flow_batch_specs.clips || EXCLUDED.clips,
         total = GREATEST(flow_batch_specs.total, EXCLUDED.total),
         title = COALESCE(flow_batch_specs.title, EXCLUDED.title),
         updated_at = now()`,
      [tenantId, id, title, total, String(index), JSON.stringify({ assetId, fileUrl, mediaType })]
    );
  } catch (e) {
    console.warn('[flow-ext] регистрация клипа пакета:', (e as Error).message);
  }
}

router.post('/ingest-manual', async (req: AuthedRequest, res: Response) => {
  const sourceUrl = req.body?.sourceUrl ? String(req.body.sourceUrl) : '';
  const dataUrl = req.body?.dataUrl ? String(req.body.dataUrl) : '';
  const title = req.body?.title ? String(req.body.title).slice(0, 120) : 'Flow';
  const kind = req.body?.kind === 'image' ? 'image' : req.body?.kind === 'video' ? 'video' : '';
  const batch = req.body?.batch && typeof req.body.batch === 'object' ? req.body.batch : null;
  if (!sourceUrl && !dataUrl) return res.status(400).json({ error: 'нет sourceUrl/dataUrl' });
  // Картинка — если так сказало расширение, либо по mime dataUrl / расширению ссылки. Иначе видео.
  const isImage = kind === 'image'
    || dataUrl.startsWith('data:image')
    || (!kind && !!sourceUrl && /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(sourceUrl));
  try {
    const stored = isImage ? await storeIncomingImage(sourceUrl, dataUrl) : await storeIncomingVideo(sourceUrl, dataUrl);
    // Дедуп по хешу байтов: тот же клип уже заливали (клиентский ключ ненадёжен) → отдаём готовый
    // ассет и УДАЛЯЕМ только что записанный дубль-файл (без плодяжа копий в «Видео»).
    let contentHash = '';
    try { contentHash = createHash('sha256').update(fs.readFileSync(stored.filePath)).digest('hex'); } catch { /* хеш best-effort */ }
    if (contentHash) {
      const dup = await pool.query(
        `SELECT asset_id, file_url, media_type FROM flow_ext_ingest_dedup WHERE tenant_id=$1 AND content_hash=$2`,
        [req.tenantId, contentHash]
      );
      if (dup.rowCount) {
        try { fs.unlinkSync(stored.filePath); } catch { /* */ }
        if (batch) await registerBatchClip(req.tenantId!, batch, dup.rows[0].asset_id, dup.rows[0].file_url, dup.rows[0].media_type || (isImage ? 'image' : 'video'));
        return res.json({ ok: true, assetId: dup.rows[0].asset_id, fileUrl: dup.rows[0].file_url, mediaType: dup.rows[0].media_type || (isImage ? 'image' : 'video'), dedup: true });
      }
    }
    const imgExt = stored.mime.includes('png') ? 'png' : stored.mime.includes('webp') ? 'webp' : stored.mime.includes('gif') ? 'gif' : 'jpg';
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: isImage ? 'image' : 'video',
      originalName: (title || 'Flow').slice(0, 112) + (isImage ? '.' + imgExt : '.mp4'),
      fileUrl: stored.fileUrl, filePath: stored.filePath, mime: stored.mime, size: stored.size,
      // Без папки → раздел «Видео» Галереи (вкладка «Google Flow» теперь показывает проекты).
      origins: ['flow'],
    });
    if (contentHash) {
      await pool.query(
        `INSERT INTO flow_ext_ingest_dedup (tenant_id, content_hash, asset_id, file_url, media_type)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id, content_hash) DO NOTHING`,
        [req.tenantId, contentHash, asset?.id || null, stored.fileUrl, isImage ? 'image' : 'video']
      );
    }
    if (batch) await registerBatchClip(req.tenantId!, batch, asset?.id || null, stored.fileUrl, isImage ? 'image' : 'video');
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

// ═══════════════ «Сценарий → пакет» → «Собрать ролик» (Flow Booster) ═══════════════
// Спека пакета: { title, format:'9x16'|..., qrText?, sfxTimes?:[сек], totalClips,
//   scenes:[{ idx, start, end, caption?, voice?, layout:'single'|'split',
//             clips:[{ index (1-базный глобальный), t0, t1, side?:'L'|'R', prompt }] }] }

const UPLOADS_PARENT = path.resolve(__dirname_f, '../../../..');
/** /uploads/…-URL → абсолютный путь на диске (с защитой от traversal). */
function localPathFromUrl(u: string): string | null {
  if (!u || !u.startsWith('/uploads/')) return null;
  const p = path.resolve(UPLOADS_PARENT, '.' + u);
  return p.startsWith(path.join(UPLOADS_PARENT, 'uploads')) ? p : null;
}

/** Панель прислала спеку пакета (до/во время генерации). Клипы, доехавшие раньше спеки, сохраняются. */
router.post('/batch-spec', async (req: AuthedRequest, res: Response) => {
  const batchId = String(req.body?.batchId || '').trim().slice(0, 80);
  const spec = req.body?.spec;
  if (!batchId || !spec || typeof spec !== 'object' || !Array.isArray(spec.scenes)) {
    return res.status(400).json({ error: 'нужны batchId и spec.scenes' });
  }
  const title = String(spec.title || req.body?.title || 'Пакет Flow').slice(0, 160);
  const total = Math.max(0, Math.min(999, Math.round(Number(spec.totalClips) || 0)));
  try {
    await pool.query(
      `INSERT INTO flow_batch_specs (tenant_id, batch_id, title, total, spec)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id, batch_id) DO UPDATE SET
         spec = EXCLUDED.spec, title = EXCLUDED.title,
         total = GREATEST(flow_batch_specs.total, EXCLUDED.total), updated_at = now()`,
      [req.tenantId, batchId, title, total, JSON.stringify(spec)]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/** Галерея: пакеты тенанта (прогресс клипов + собранный ролик, свежие сверху). */
router.get('/batches', async (req: AuthedRequest, res: Response) => {
  try {
    const r = await pool.query(`SELECT * FROM flow_batch_specs WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 20`, [req.tenantId]);
    res.json({
      batches: (r.rows as any[]).map((row) => ({
        batchId: row.batch_id, title: row.title || 'Пакет Flow',
        total: Number(row.total) || 0,
        ready: Object.keys(row.clips || {}).length,
        clips: row.clips || {}, spec: row.spec || null,
        composedAssetId: row.composed_asset_id || null,
        composedFileUrl: row.composed_file_url || null,
        updatedAt: row.updated_at,
      })),
    });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/** Аудио-ассеты тенанта — выбор дорожки голоса в форме «Собрать ролик». */
router.get('/audio', async (req: AuthedRequest, res: Response) => {
  try {
    const all = await listAssets(req.tenantId!, 'reference');
    const items = all
      .filter((a: any) => String(a.mediaType || '').startsWith('audio') || /\.(mp3|wav|m4a|aac|ogg|opus)(\?|#|$)/i.test(a.fileUrl || ''))
      .slice(0, 100)
      .map((a: any) => ({ id: a.id, title: a.originalName || 'аудио', fileUrl: a.fileUrl }));
    res.json({ items });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/** Санитайзер сцен из ответа ИИ → спека с нарезкой на куски ≤8с и глобальной 1-базной нумерацией. */
function buildSpecFromScenes(rawScenes: any[], defaults: { title: string; format: string; qrText?: string; sfxTimes?: number[] }) {
  const scenes: any[] = [];
  let g = 1;
  const clean = (rawScenes || []).slice(0, 12)
    .map((s: any) => ({
      start: Math.max(0, Number(s?.start) || 0),
      end: Math.max(0, Number(s?.end) || 0),
      caption: s?.caption ? String(s.caption).slice(0, 200) : '',
      voice: s?.voice ? String(s.voice).slice(0, 500) : '',
      layout: s?.layout === 'split' ? 'split' : 'single',
      prompts: Array.isArray(s?.prompts) ? s.prompts.map((p: any) => String(p || '').slice(0, 900)).filter(Boolean) : [],
      left: Array.isArray(s?.left) ? s.left.map((p: any) => String(p || '').slice(0, 900)).filter(Boolean) : [],
      right: Array.isArray(s?.right) ? s.right.map((p: any) => String(p || '').slice(0, 900)).filter(Boolean) : [],
    }))
    .filter((s: any) => s.end > s.start && (s.prompts.length || (s.left.length && s.right.length)))
    .sort((a: any, b: any) => a.start - b.start);

  clean.forEach((s: any, idx: number) => {
    const dur = Math.min(120, s.end - s.start);
    const nChunks = Math.max(1, Math.ceil(dur / 8 - 1e-6));
    const chunkDur = dur / nChunks;
    const split = s.layout === 'split' && s.left.length && s.right.length;
    const clips: any[] = [];
    for (let k = 0; k < nChunks; k++) {
      const t0 = s.start + k * chunkDur;
      const t1 = k === nChunks - 1 ? s.end : s.start + (k + 1) * chunkDur;
      if (split) {
        const pl = s.left[Math.min(k, s.left.length - 1)];
        const pr = s.right[Math.min(k, s.right.length - 1)];
        clips.push({ index: g++, t0, t1, side: 'L', prompt: pl });
        clips.push({ index: g++, t0, t1, side: 'R', prompt: pr });
      } else {
        const p = s.prompts[Math.min(k, s.prompts.length - 1)] || s.left[Math.min(k, s.left.length - 1)] || '';
        if (!p) continue;
        clips.push({ index: g++, t0, t1, prompt: p });
      }
    }
    if (clips.length) scenes.push({ idx, start: s.start, end: s.end, caption: s.caption, voice: s.voice, layout: split ? 'split' : 'single', clips });
  });

  const spec = {
    title: defaults.title, format: defaults.format,
    qrText: defaults.qrText || '', sfxTimes: (defaults.sfxTimes || []).slice(0, 6),
    totalClips: g - 1, scenes,
  };
  const items = scenes.flatMap((sc: any) => sc.clips.map((c: any) => ({
    index: c.index, prompt: c.prompt, sceneIdx: sc.idx, side: c.side || null,
    len: Math.min(8, Math.max(1, Math.round(c.t1 - c.t0))),
  })));
  return { spec, items };
}

/** ИИ-нарезка сценария (Enterprise, ключ Anthropic тенанта): сценарный план → сцены/промпты Veo (EN). */
router.post('/scenario-plan', async (req: AuthedRequest, res: Response) => {
  const scenario = String(req.body?.scenario || '').trim().slice(0, 14000);
  if (scenario.length < 40) return res.status(400).json({ error: 'сценарий слишком короткий' });
  let apiKey: string | null = null;
  try { apiKey = await resolveAnthropicKey(req.tenantId!); } catch { /* нет ключа */ }
  if (!apiKey) return res.status(400).json({ error: 'Нет ключа Anthropic — панель нарежет сценарий локально', code: 'no-key' });

  const system =
    'Ты — режиссёр коротких рекламных роликов и промпт-инженер Google Veo (Flow). '
    + 'Превращаешь сценарный план в JSON-раскадровку для пакетной генерации клипов длиной не более 8 секунд каждый. '
    + 'Правила промптов: АНГЛИЙСКИЙ язык, кинематографичные детали (свет, оптика, движение камеры), '
    + 'один и тот же герой описывается ОДИНАКОВОЙ короткой формулой в каждом промпте (консистентность), '
    + 'НИКАКОГО текста/логотипов/надписей в кадре — добавь в каждый промпт "no on-screen text, no logos, no text on clothing". '
    + 'Сцена длиннее 8с делится на ceil(длительность/8) кусков — по одному промпту на кусок (продолжение действия). '
    + 'Сплит-скрин сцена: массивы left и right (по куску на каждый), обычная сцена: массив prompts.';
  const user =
    `Сценарный план:\n"""\n${scenario}\n"""\n\n`
    + 'Верни ТОЛЬКО JSON без пояснений:\n'
    + '{"title":"короткое название ролика","format":"9x16|16x9","qrText":"ссылка для QR из сценария или пустая строка",'
    + '"sfxTimes":[секунды звуковых акцентов из сценария],'
    + '"scenes":[{"start":0,"end":8,"caption":"текст на экране ЯЗЫКОМ сценария","voice":"текст голоса за кадром","layout":"single|split",'
    + '"prompts":["EN prompt куска 1",...],"left":["EN prompt левой половины",...],"right":["EN prompt правой половины",...]}]}\n'
    + 'start/end — секунды из сценария. caption — краткий главный титр сцены (не абзац).';

  try {
    const raw = await callClaudeText({ apiKey, system, user, maxTokens: 6000 });
    const j = extractJson(raw);
    if (!j || !Array.isArray(j.scenes)) return res.status(502).json({ error: 'ИИ вернул неожиданный формат' });
    const fmt = ['9x16', '16x9', '1x1', '4x5'].includes(j.format) ? j.format : '9x16';
    const sfx = Array.isArray(j.sfxTimes) ? j.sfxTimes.map(Number).filter((t: number) => Number.isFinite(t) && t >= 0) : [];
    const { spec, items } = buildSpecFromScenes(j.scenes, {
      title: String(j.title || 'Рекламный ролик').slice(0, 120), format: fmt,
      qrText: j.qrText ? String(j.qrText).slice(0, 300) : '', sfxTimes: sfx,
    });
    if (!items.length) return res.status(502).json({ error: 'ИИ не дал ни одного промпта' });
    res.json({ ok: true, spec, items, planSource: 'claude' });
  } catch (e: any) {
    res.status(502).json({ error: 'ИИ-нарезка недоступна: ' + String(e?.message || e).slice(0, 200) });
  }
});

// ── Сборка ролика из пакета (джобы в памяти, по паттерну commentatorJobs) ──
const adJobs = new Map<string, { tenantId?: string; status: 'processing' | 'done' | 'failed'; fileUrl?: string; assetId?: string | null; warnings?: string[]; error?: string; ts: number }>();
function sweepAdJobs() {
  const cutoff = Date.now() - 2 * 3600_000;
  for (const [k, v] of adJobs) if (v.ts < cutoff) adJobs.delete(k);
}

/** Собрать рекламный ролик из готового пакета. body: { batchId, format?, captions?{sceneIdx:text},
 *  voiceUrl?, qrText?, clipVolume?, capPos?, sfxTimes? } → { jobId }. */
router.post('/compose-ad', async (req: AuthedRequest, res: Response) => {
  const batchId = String(req.body?.batchId || '').trim().slice(0, 80);
  if (!batchId) return res.status(400).json({ error: 'нет batchId' });
  const r = await pool.query(`SELECT * FROM flow_batch_specs WHERE tenant_id=$1 AND batch_id=$2`, [req.tenantId, batchId]);
  if (!r.rowCount) return res.status(404).json({ error: 'пакет не найден' });
  const row: any = r.rows[0];
  const spec: any = row.spec;
  if (!spec || !Array.isArray(spec.scenes) || !spec.scenes.length) {
    return res.status(400).json({ error: 'у пакета нет спеки сцен — соберите его через «Сценарий → пакет» в Flow Booster' });
  }
  const clips: Record<string, any> = row.clips || {};

  // все ли клипы доехали
  const missing: number[] = [];
  for (const sc of spec.scenes) for (const c of (sc.clips || [])) if (!clips[String(c.index)]?.fileUrl) missing.push(Number(c.index));
  if (missing.length) return res.status(409).json({ error: 'клипы ещё не в Галерее: №' + missing.sort((a, b) => a - b).join(', ') });

  // таймлайн: сегменты (пары L/R одного интервала → сплит-скрин) + титры сцен
  const shift = Math.min(...spec.scenes.map((s: any) => Number(s.start) || 0));
  const groups = new Map<string, { t0: number; t1: number; parts: { side: string; path: string }[] }>();
  for (const sc of spec.scenes) {
    for (const c of (sc.clips || [])) {
      const p = localPathFromUrl(String(clips[String(c.index)].fileUrl || ''));
      if (!p) return res.status(400).json({ error: `клип №${c.index}: не локальный файл` });
      const key = `${Number(c.t0).toFixed(2)}|${Number(c.t1).toFixed(2)}`;
      const gr = groups.get(key) || { t0: Number(c.t0) - shift, t1: Number(c.t1) - shift, parts: [] };
      gr.parts.push({ side: c.side === 'R' ? 'R' : 'L', path: p });
      groups.set(key, gr);
    }
  }
  const segments: AdSegment[] = [...groups.values()]
    .map((gr) => ({ t0: gr.t0, t1: gr.t1, clipPaths: gr.parts.sort((a, b) => a.side.localeCompare(b.side)).map((x) => x.path).slice(0, 2) }))
    .sort((a, b) => a.t0 - b.t0);

  const capOverrides = req.body?.captions && typeof req.body.captions === 'object' ? req.body.captions : {};
  const captions = spec.scenes
    .map((sc: any) => ({
      t0: (Number(sc.start) || 0) - shift, t1: (Number(sc.end) || 0) - shift,
      text: String(capOverrides[String(sc.idx)] ?? sc.caption ?? '').slice(0, 200),
    }))
    .filter((c: any) => c.text && c.t1 > c.t0);

  const fmt = ['9x16', '16x9', '1x1', '4x5'].includes(req.body?.format) ? req.body.format : (['9x16', '16x9', '1x1', '4x5'].includes(spec.format) ? spec.format : '9x16');
  const voiceUrl = typeof req.body?.voiceUrl === 'string' ? req.body.voiceUrl : '';
  const voicePath = voiceUrl ? localPathFromUrl(voiceUrl) : null;
  if (voiceUrl && !voicePath) return res.status(400).json({ error: 'дорожка голоса должна быть файлом из Галереи (/uploads/…)' });
  const qrText = typeof req.body?.qrText === 'string' ? req.body.qrText.slice(0, 300) : String(spec.qrText || '');
  const sfxSrc = Array.isArray(req.body?.sfxTimes) ? req.body.sfxTimes : (Array.isArray(spec.sfxTimes) ? spec.sfxTimes : []);
  const sfxTimes = sfxSrc.map(Number).filter((t: number) => Number.isFinite(t) && t >= 0).map((t: number) => t - shift).filter((t: number) => t >= 0);
  const capPos = ['bottom', 'center', 'top'].includes(req.body?.capPos) ? req.body.capPos : 'top';
  const clipVolume = Number.isFinite(Number(req.body?.clipVolume)) ? Math.max(0, Math.min(1, Number(req.body.clipVolume))) : undefined;

  const jobId = randomUUID();
  sweepAdJobs();
  adJobs.set(jobId, { tenantId: req.tenantId, status: 'processing', ts: Date.now() });
  const tenantId = req.tenantId!;
  void (async () => {
    try {
      const out = await composeAdVideo({ segments, captions, format: fmt as any, voicePath, sfxTimes, qrText: qrText || null, clipVolume, capPos: capPos as any });
      const asset = await createAsset(tenantId, {
        kind: 'reference', mediaType: 'video',
        originalName: (row.title || 'Рекламный ролик').slice(0, 110) + '.mp4',
        fileUrl: out.fileUrl, filePath: out.filePath, mime: 'video/mp4',
        size: (() => { try { return fs.statSync(out.filePath).size; } catch { return 0; } })(),
        origins: ['flow'],
      });
      await pool.query(
        `UPDATE flow_batch_specs SET composed_asset_id=$1, composed_file_url=$2, updated_at=now() WHERE tenant_id=$3 AND batch_id=$4`,
        [asset?.id || null, out.fileUrl, tenantId, batchId]
      );
      adJobs.set(jobId, { tenantId, status: 'done', fileUrl: out.fileUrl, assetId: asset?.id || null, warnings: out.warnings, ts: Date.now() });
    } catch (e: any) {
      adJobs.set(jobId, { tenantId, status: 'failed', error: String(e?.message || e).slice(0, 400), ts: Date.now() });
    }
  })();
  res.json({ ok: true, jobId });
});

/** Статус сборки ролика. */
router.get('/compose-ad/status', (req: AuthedRequest, res: Response) => {
  const jobId = String(req.query.jobId || '');
  const j = adJobs.get(jobId);
  if (!j || j.tenantId !== req.tenantId) return res.status(404).json({ error: 'джоба не найдена' });
  res.json({ status: j.status, fileUrl: j.fileUrl || null, assetId: j.assetId || null, warnings: j.warnings || [], error: j.error || null });
});

export const INGEST_LIMIT = INGEST_JSON_LIMIT;
export default router;
