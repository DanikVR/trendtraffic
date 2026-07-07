/**
 * HeyGen по подписке — бэкенд моста «говорящих голов» через расширение браузера.
 *
 * ЗАЧЕМ. Наш обычный UGC-путь (modules/render/avatar.ts) ходит в HeyGen по API-ключу
 * (x-api-key) → списывается API-кошелёк pay-as-you-go (~$3/мин Avatar IV). Веб-студия
 * HeyGen (app.heygen.com) те же головы делает по ПОДПИСКЕ (Creator/Pro/Business), где
 * минута Avatar IV втрое дешевле. Кредиты подписки НЕ работают через API (пулы раздельны),
 * поэтому единственный способ гнать по подписке автоматически — расширение в браузере
 * клиента, залогиненного в свою подписку HeyGen: оно повторяет ровно те вызовы, что шлёт
 * сама студия со своей session-авторизацией → списывается подписка.
 *
 * ЧТО ЗДЕСЬ. Только очередь задач-«голов» + приёмник результата + авто-разведка API студии.
 * В HeyGen мы отсюда НЕ ходим — это делает расширение (apps/heygen-extension).
 *
 * Пер-тенантно: расширение крутится под подпиской HeyGen самого клиента, доступ к ручкам —
 * JWT + Enterprise (как flow-ext / social-ext).
 *
 * Поток:
 *   /ugc/build (тот же процесс) → enqueueHeygenHeads(...) кладёт головы в очередь и ждёт
 *   расширение → GET  /tasks   (атомарно queued → running)
 *              → POST /status  (running/retry/failed + заметка)
 *              → POST /ingest  (готовая голова mp4 → на диск, задача → done)
 *   /ugc/build → waitHeygenHeads(...) видит done и забирает локальный путь головы → склейка
 *
 * Таблица heygen_ext_tasks (Postgres, inline-init как flow_ext_tasks).
 *
 * ВАЖНО (риск, снимается разведкой): точные эндпоинты/авторизация загрузки фото и генерации
 * в веб-студии и то, что генерация через сессию реально списывает ПОДПИСКУ — подтверждается
 * авто-разведкой (/recon: injected.js снимает fetch/XHR живой студии) уже после установки
 * расширения клиентом. Драйвер повторяет документированный v2-контракт как первую ставку.
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

/** Готовые головы кладём в ту же uploads/renders, что и остальной рендер-пайплайн —
 *  UGC-джоб берёт локальный путь напрямую, без лишней перекачки. */
const __dirname_h = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__dirname_h, '../../../../uploads');
const RENDERS_DIR = path.join(UPLOADS_ROOT, 'renders');
try { fs.mkdirSync(RENDERS_DIR, { recursive: true }); } catch { /* best-effort */ }

/** Голова = короткий сегмент 1080×1920; base64 раздувает ×1.37. 200mb с запасом. */
const INGEST_JSON_LIMIT = '200mb';

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

/** HeyGen-по-подписке — только Enterprise (+superadmin-bypass внутри hasEnterpriseAccess). */
async function requireEnterprise(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole)) return next();
  } catch (err) {
    console.warn('[heygen-ext] enterprise-гейт:', err);
  }
  return res.status(403).json({ error: 'Доступно только на тарифе Enterprise' });
}

// ── Таблица (inline-init, как flow_ext_tasks) ───────────────────────────────
let tablesReady: Promise<void> | null = null;
async function ensureTables(): Promise<void> {
  if (tablesReady) return tablesReady;
  tablesReady = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS heygen_ext_tasks (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        job_id TEXT,
        seg_index INT,
        photo_url TEXT NOT NULL,
        audio_url TEXT,
        script_text TEXT,
        voice_id TEXT,
        use_iv BOOLEAN NOT NULL DEFAULT true,
        width INT NOT NULL DEFAULT 1080,
        height INT NOT NULL DEFAULT 1920,
        bg_color TEXT,
        expressive BOOLEAN NOT NULL DEFAULT true,
        emotion TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        note TEXT,
        file_url TEXT,
        file_path TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_heygen_tasks_tenant ON heygen_ext_tasks(tenant_id, status, created_at ASC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_heygen_tasks_job ON heygen_ext_tasks(job_id)`);
    // Авто-разведка API живой студии HeyGen: расширение (injected.js) шлёт снимок виденных
    // fetch/XHR (эндпоинты генерации/загрузки/статуса + был ли Bearer). По одной записи на тенант.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS heygen_ext_recon (
        tenant_id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        url TEXT,
        updated_at TIMESTAMPTZ DEFAULT now()
      )`);
  })();
  // Сбой инициализации (транзиентный обрыв БД) не должен навсегда заклинить модуль —
  // сбрасываем кеш промиса, чтобы следующий вызов попробовал заново.
  tablesReady.catch(() => { tablesReady = null; });
  return tablesReady;
}
ensureTables().catch((e) => console.warn('[heygen-ext] init таблиц:', (e as Error).message));

function mapTask(r: any) {
  return {
    id: r.id,
    photoUrl: r.photo_url,
    audioUrl: r.audio_url || null,
    text: r.script_text || null,
    voiceId: r.voice_id || null,
    useIV: r.use_iv !== false,
    width: r.width || 1080,
    height: r.height || 1920,
    bgColor: r.bg_color || null,
    expressive: r.expressive !== false,
    emotion: r.emotion || null,
    status: r.status,
    note: r.note || null,
    fileUrl: r.file_url || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── Сохранение готовой головы (mp4) ─────────────────────────────────────────
/** data:video/mp4;base64,... → файл в uploads/renders. */
function saveDataUrl(dataUrl: string): { fileUrl: string; filePath: string; size: number } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('неверный dataUrl');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 1024) throw new Error('пустое видео');
  const name = `hghead-${randomUUID()}.mp4`;
  const filePath = path.join(RENDERS_DIR, name);
  fs.writeFileSync(filePath, buf);
  return { fileUrl: `/uploads/renders/${name}`, filePath, size: buf.length };
}

/** Скачать готовую голову по прямой ссылке (CDN HeyGen) в uploads/renders. */
async function downloadToRenders(url: string): Promise<{ fileUrl: string; filePath: string; size: number }> {
  const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'video/*,*/*' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < 1024) throw new Error('пустое видео');
  const name = `hghead-${randomUUID()}.mp4`;
  const filePath = path.join(RENDERS_DIR, name);
  fs.writeFileSync(filePath, buf);
  return { fileUrl: `/uploads/renders/${name}`, filePath, size: buf.length };
}

// ── Роутер ──────────────────────────────────────────────────────────────────
const router = Router();

/** Мягкий лимит на поллинг расширения. Ключ — tenantId (не IP: express-rate-limit ругается на IPv6). */
const pollLimiter = rateLimit({
  windowMs: 60_000, max: 240,
  keyGenerator: (req: AuthedRequest) => req.tenantId || 'anon',
  standardHeaders: true, legacyHeaders: false,
});

router.use(requireAuth, requireEnterprise);

/**
 * Расширение забирает задачи-головы. Атомарно переводит queued (и «зависшие» running старше
 * 20 мин — реанимация после падения вкладки) в running и отдаёт их — так одна голова не уйдёт
 * двум поллам сразу.
 */
router.get('/tasks', pollLimiter, async (req: AuthedRequest, res: Response) => {
  await ensureTables();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '1'), 10) || 1, 1), 3);
  const r = await pool.query(
    `UPDATE heygen_ext_tasks SET status='running', updated_at=now()
      WHERE id IN (
        SELECT id FROM heygen_ext_tasks
         WHERE tenant_id=$1
           AND (status='queued' OR (status='running' AND updated_at < now() - interval '20 minutes'))
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
  await ensureTables();
  const taskId = String(req.body?.taskId || '');
  let status = String(req.body?.status || '');
  const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
  if (!taskId || !status) return res.status(400).json({ error: 'нет taskId/status' });
  // 'retry' (напр. нет вкладки студии / троттлинг) → возвращаем в очередь.
  if (status === 'retry') status = 'queued';
  const allowed = ['queued', 'running', 'done', 'failed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'неизвестный статус' });
  const r = await pool.query(
    `UPDATE heygen_ext_tasks SET status=$1, note=$2, updated_at=now()
      WHERE id=$3 AND tenant_id=$4 RETURNING id`,
    [status, note, taskId, req.tenantId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'задача не найдена' });
  res.json({ ok: true });
});

/** Расширение присылает готовую голову → uploads/renders, задача → done (file_url/file_path). */
router.post('/ingest', async (req: AuthedRequest, res: Response) => {
  await ensureTables();
  const taskId = String(req.body?.taskId || '');
  const sourceUrl = req.body?.sourceUrl ? String(req.body.sourceUrl) : '';
  const dataUrl = req.body?.dataUrl ? String(req.body.dataUrl) : '';
  if (!taskId) return res.status(400).json({ error: 'нет taskId' });
  const t = await pool.query(`SELECT id FROM heygen_ext_tasks WHERE id=$1 AND tenant_id=$2`, [taskId, req.tenantId]);
  if (!t.rowCount) return res.status(404).json({ error: 'задача не найдена' });

  try {
    const stored = sourceUrl && /^https?:/.test(sourceUrl)
      ? await downloadToRenders(sourceUrl)
      : dataUrl.startsWith('data:') ? saveDataUrl(dataUrl)
      : (() => { throw new Error('нет sourceUrl/dataUrl'); })();
    await pool.query(
      `UPDATE heygen_ext_tasks SET status='done', file_url=$1, file_path=$2, note=NULL, updated_at=now() WHERE id=$3`,
      [stored.fileUrl, stored.filePath, taskId]
    );
    res.json({ ok: true, fileUrl: stored.fileUrl });
  } catch (e: any) {
    await pool.query(`UPDATE heygen_ext_tasks SET status='failed', note=$1, updated_at=now() WHERE id=$2`, [String(e?.message || e).slice(0, 500), taskId]);
    res.status(502).json({ error: 'не удалось сохранить голову: ' + (e?.message || e) });
  }
});

/**
 * Авто-разведка API живой студии HeyGen: расширение шлёт снимок виденных fetch/XHR (эндпоинты
 * загрузки фото/генерации/статуса, был ли Authorization: Bearer). По одной записи на тенант —
 * чтобы подтвердить эндпоинты и то, что генерация идёт под сессией (= списывает подписку).
 */
router.post('/recon', async (req: AuthedRequest, res: Response) => {
  await ensureTables();
  const data = req.body?.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'нет data' });
  const url = req.body?.url ? String(req.body.url).slice(0, 500) : null;
  try {
    await pool.query(
      `INSERT INTO heygen_ext_recon (tenant_id, data, url, updated_at) VALUES ($1,$2,$3,now())
       ON CONFLICT (tenant_id) DO UPDATE SET data=EXCLUDED.data, url=EXCLUDED.url, updated_at=now()`,
      [req.tenantId, JSON.stringify(data), url]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/** Последний снимок разведки тенанта (для отладки эндпоинтов студии). */
router.get('/recon', async (req: AuthedRequest, res: Response) => {
  await ensureTables();
  const r = await pool.query(`SELECT data, url, updated_at FROM heygen_ext_recon WHERE tenant_id=$1`, [req.tenantId]);
  if (!r.rowCount) return res.json({ recon: null });
  const row = r.rows[0];
  res.json({ recon: { data: row.data, url: row.url, updatedAt: row.updated_at } });
});

/** Узел UGC/страница расширения: список задач тенанта (статусы для UI подключения). */
router.get('/list', async (req: AuthedRequest, res: Response) => {
  await ensureTables();
  const r = await pool.query(
    `SELECT * FROM heygen_ext_tasks WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [req.tenantId]
  );
  res.json({ tasks: (r.rows as any[]).map(mapTask) });
});

/** Убрать завершённые/битые из списка. */
router.post('/clear', async (req: AuthedRequest, res: Response) => {
  await ensureTables();
  await pool.query(`DELETE FROM heygen_ext_tasks WHERE tenant_id=$1 AND status IN ('done','failed')`, [req.tenantId]);
  res.json({ ok: true });
});

// ── Внутренний API для UGC-пайплайна (тот же процесс, без HTTP) ──────────────

/** Одна голова на рендер: фото + (аудио-драйв ИЛИ текст) + движок/размеры. */
export interface HeadSpec {
  segIndex: number;      // индекс сегмента (для сопоставления в джобе)
  photoUrl: string;      // абсолютный URL фото
  audioUrl?: string;     // абсолютный URL аудио-сегмента (свой голос / ElevenLabs)
  text?: string;         // ИЛИ текст (HeyGen TTS) — если нет аудио
  voiceId?: string;
  useIV?: boolean;       // Avatar IV (дорого/выразительно) vs III
  width?: number;
  height?: number;
  bgColor?: string;      // хромакей (для раскладок «фон+лицо сбоку»)
  expressive?: boolean;
  emotion?: string;
}

/** Положить головы в очередь расширения → массив task-id в порядке heads. */
export async function enqueueHeygenHeads(tenantId: string, jobId: string, heads: HeadSpec[]): Promise<string[]> {
  await ensureTables();
  const ids: string[] = [];
  for (const h of heads) {
    const id = randomUUID();
    ids.push(id);
    await pool.query(
      `INSERT INTO heygen_ext_tasks
         (id, tenant_id, job_id, seg_index, photo_url, audio_url, script_text, voice_id, use_iv, width, height, bg_color, expressive, emotion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, tenantId, jobId, h.segIndex, h.photoUrl, h.audioUrl || null, h.text || null, h.voiceId || null,
        h.useIV !== false, h.width || 1080, h.height || 1920, h.bgColor || null, h.expressive !== false, h.emotion || null]
    );
  }
  return ids;
}

export interface HeadResult { id: string; segIndex: number; filePath: string; fileUrl: string }

/**
 * Ждать, пока расширение выполнит все головы (poll таблицы). Возвращает результаты в порядке ids.
 * Бросает при первой failed-голове или таймауте. onProgress(done,total) — для статуса джоба.
 */
export async function waitHeygenHeads(
  tenantId: string,
  ids: string[],
  opts: { timeoutMs?: number; pollMs?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<HeadResult[]> {
  if (!ids.length) return [];
  await ensureTables();
  const timeoutMs = opts.timeoutMs ?? 45 * 60_000; // расширение работает человекоподобно (паузы) → щедрый потолок
  const pollMs = opts.pollMs ?? 4000;
  const deadline = Date.now() + timeoutMs;
  const idSet = new Set(ids);
  while (Date.now() < deadline) {
    const r = await pool.query(
      `SELECT id, seg_index, status, note, file_url, file_path FROM heygen_ext_tasks WHERE id = ANY($1) AND tenant_id=$2`,
      [ids, tenantId]
    );
    const rows = r.rows as any[];
    const failed = rows.find((x) => x.status === 'failed');
    if (failed) throw new Error(`HeyGen-расширение: голова #${failed.seg_index} не удалась${failed.note ? ` (${failed.note})` : ''}`);
    const done = rows.filter((x) => x.status === 'done' && x.file_path);
    opts.onProgress?.(done.length, idSet.size);
    if (done.length >= idSet.size) {
      const byId = new Map(rows.map((x) => [x.id, x]));
      return ids.map((id) => {
        const x = byId.get(id)!;
        return { id, segIndex: x.seg_index, filePath: x.file_path, fileUrl: x.file_url };
      });
    }
    await new Promise((res) => setTimeout(res, pollMs));
  }
  throw new Error('HeyGen-расширение не прислало все головы вовремя (проверьте, что вкладка студии HeyGen открыта и подписка активна)');
}

/** Есть ли у тенанта хоть один свежий сигнал живого расширения (задачи брались в работу за 10 мин)?
 *  Грубая эвристика «расширение на связи» для UI/преполёта. */
export async function heygenExtRecentlyActive(tenantId: string): Promise<boolean> {
  try {
    await ensureTables();
    const r = await pool.query(
      `SELECT 1 FROM heygen_ext_tasks WHERE tenant_id=$1 AND status IN ('running','done') AND updated_at > now() - interval '10 minutes' LIMIT 1`,
      [tenantId]
    );
    return !!r.rowCount;
  } catch { return false; }
}

export const INGEST_LIMIT = INGEST_JSON_LIMIT;
export default router;
