/**
 * Hotebook (Google NotebookLM) — публичный бэкенд блока «Hotebook» в TrendFlow.
 *
 * Архитектура (с v2.x): фронт → этот роутер → ОЧЕРЕДЬ → единое Chrome-расширение
 * (apps/trendtraffic-extension) в браузере клиента → NotebookLM. Сервера-воркера
 * (домашний ПК) больше НЕТ — автоматизация идёт в реальном браузере пользователя под
 * его живым входом в Google (как блок «Google Flow»).
 *
 * Публичный контракт /api/notebooklm/* СОХРАНЁН (фронт не меняется по сути):
 *   • синхронные действия (создать блокнот / источник / список / удаление / чат)
 *     кладутся в очередь notebooklm_ext_actions и ждут результата (long-poll внутри
 *     запроса — см. ext_bridge.waitAction); расширение выполняет их и рапортует;
 *   • генерация артефактов — джоба notebooklm_jobs (фронт поллит GET /jobs/:id);
 *     расширение забирает джобу, автоматизирует студию и шлёт файл в
 *     /api/notebooklm-ext/ingest → Галерея folder='hotebook'.
 *
 * Подключение ПЕР-ТЕНАНТНОЕ: у каждого Enterprise-тенанта свой браузер с расширением
 * и свой вход в Google. Статус /status питается присутствием расширения:
 *   error_kind = 'ext_offline' — расширение не на связи (не установлено/браузер закрыт);
 *                'ext_login'   — расширение на связи, но не залогинено в notebooklm.google.com.
 *
 * Доступ: JWT + Enterprise (как social-ext).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import pool from '../../db/index.js';
import {
  GEN_TYPES, type GenType,
  enqueueAction, waitAction, getConnectionStatus,
} from './ext_bridge.js';

/** Папка Галереи для артефактов Hotebook (вкладка «Hotebook»). Реэкспорт для совместимости. */
export const HOTEBOOK_FOLDER = 'hotebook';

interface AuthedRequest extends Request { tenantId?: string; userRole?: any; }

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Не авторизован' });
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch { return res.status(401).json({ error: 'Невалидный токен' }); }
}

async function requireEnterprise(req: AuthedRequest, res: Response, next: NextFunction) {
  try { if (await hasEnterpriseAccess(req.tenantId, req.userRole)) return next(); }
  catch (err) { console.warn('[hotebook] enterprise-гейт:', err); }
  return res.status(403).json({ error: 'Доступно только на тарифе Enterprise' });
}

// ── Таблицы состояния/джоб (inline-init; таблицы очереди — в ext_bridge) ──────
async function ensureTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notebooklm_state (
      tenant_id TEXT NOT NULL,
      flow_id   TEXT NOT NULL,
      notebook_id TEXT NOT NULL,
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (tenant_id, flow_id)
    )`);
  // Кэш списка источников блокнота (пишется расширением через completeAction) — чтобы
  // overview показывал источники без обязательного онлайна расширения.
  await pool.query(`ALTER TABLE notebooklm_state ADD COLUMN IF NOT EXISTS sources JSONB`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notebooklm_jobs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      flow_id TEXT,
      type TEXT NOT NULL,
      params JSONB,
      status TEXT NOT NULL DEFAULT 'queued',
      remote_task_id TEXT,
      asset_id TEXT,
      file_url TEXT,
      payload JSONB,
      error TEXT,
      error_kind TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      finished_at TIMESTAMPTZ
    )`);
  await pool.query(`ALTER TABLE notebooklm_jobs ADD COLUMN IF NOT EXISTS title TEXT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_nlm_jobs_tenant ON notebooklm_jobs(tenant_id, created_at DESC)`);
}
ensureTables().catch((e) => console.warn('[hotebook] init таблиц:', (e as Error).message));

// ── Ошибка «расширение не готово / действие не выполнено» с error_kind для плашки ─
class ExtError extends Error { kind: string; constructor(message: string, kind: string) { super(message); this.kind = kind; } }
function errPayload(e: any): { error: string; errorKind: string } {
  if (e instanceof ExtError) return { error: e.message, errorKind: e.kind };
  return { error: e?.message || 'Ошибка', errorKind: 'error' };
}

// ── Блокнот сценария ─────────────────────────────────────────────────────────
async function getNotebookId(tenantId: string, flowId: string): Promise<string | null> {
  const r = await pool.query(`SELECT notebook_id FROM notebooklm_state WHERE tenant_id=$1 AND flow_id=$2`, [tenantId, flowId]);
  return r.rows[0]?.notebook_id || null;
}

/** Блокнот сценария: вернуть существующий или enqueue-and-wait «создать блокнот» через расширение. */
async function ensureNotebook(tenantId: string, flowId: string, title?: string): Promise<string> {
  const existing = await getNotebookId(tenantId, flowId);
  if (existing) return existing;
  // Создание требует, чтобы расширение было на связи и залогинено — иначе быстрый отказ.
  const st = await getConnectionStatus(tenantId);
  if (!st.ok) {
    throw new ExtError(
      st.errorKind === 'ext_login'
        ? 'Войдите в notebooklm.google.com в браузере с расширением'
        : 'Откройте NotebookLM в браузере с установленным расширением Hotebook',
      st.errorKind || 'ext_offline'
    );
  }
  const name = (title || '').trim() || `TrendFlow · ${flowId.slice(0, 8)}`;
  const actionId = await enqueueAction(tenantId, flowId, null, 'create-notebook', { title: name });
  const r = await waitAction(tenantId, actionId, 90_000);
  if (!r.ok) throw new ExtError(r.error || 'не удалось создать блокнот', 'ext_offline');
  const nbId = (await getNotebookId(tenantId, flowId)) || r.result?.notebookId || null;
  if (!nbId) throw new ExtError('расширение не вернуло id блокнота (нужна разведка селекторов «создать»)', 'error');
  if (!(await getNotebookId(tenantId, flowId))) {
    await pool.query(
      `INSERT INTO notebooklm_state (tenant_id, flow_id, notebook_id, title) VALUES ($1,$2,$3,$4)
       ON CONFLICT (tenant_id, flow_id) DO UPDATE SET notebook_id=EXCLUDED.notebook_id, title=EXCLUDED.title`,
      [tenantId, flowId, String(nbId), name]
    );
  }
  return String(nbId);
}

// ── Джобы ─────────────────────────────────────────────────────────────────────
function mapJob(r: any): any {
  return {
    id: r.id, flowId: r.flow_id, type: r.type, status: r.status,
    params: r.params || {}, error: r.error || null, errorKind: r.error_kind || null,
    assetId: r.asset_id || null, fileUrl: r.file_url || null, payload: r.payload ?? null,
    createdAt: r.created_at, finishedAt: r.finished_at,
  };
}

async function todayCounters(tenantId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const r = await pool.query(
      `SELECT type, count(*)::int AS n FROM notebooklm_jobs
       WHERE tenant_id=$1 AND created_at >= date_trunc('day', now()) AND status <> 'error'
       GROUP BY type`, [tenantId]);
    for (const row of r.rows) out[row.type] = Number(row.n) || 0;
  } catch { /* пусто */ }
  return out;
}

// ── Абсолютный URL (расширение качает байты файла-источника из background) ─────
function absBase(req: AuthedRequest): string {
  const env = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}
const absUrl = (base: string, u?: string): string => (u && !/^https?:\/\//i.test(u) ? base + (u.startsWith('/') ? u : '/' + u) : (u || ''));

// ── Роутер ───────────────────────────────────────────────────────────────────
const router = Router();
router.use(requireAuth);
router.use(requireEnterprise);

/** Статус подключения расширения (плашка в блоке и в настройках). */
router.get('/status', async (req: AuthedRequest, res: Response) => {
  const st = await getConnectionStatus(req.tenantId!);
  res.json({ status: st });
});

/**
 * Список ВСЕХ блокнотов NotebookLM (для карточек на стороне TrendTraffic → Галерея → Hotebook).
 * Расширение снимает плитки главной. Если расширение не на связи/не залогинено — отдаём пусто
 * + статус (фронт покажет плашку), не 500.
 */
router.get('/notebooks', async (req: AuthedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const st = await getConnectionStatus(tenantId);
  if (!st.ok) return res.json({ notebooks: [], status: st });
  try {
    const actionId = await enqueueAction(tenantId, null, null, 'list-notebooks', {});
    const r = await waitAction(tenantId, actionId, 60_000);
    if (!r.ok) return res.json({ notebooks: [], status: st, error: r.error || null });
    const notebooks = Array.isArray(r.result?.notebooks) ? r.result.notebooks : [];
    res.json({ notebooks, status: st });
  } catch (e: any) {
    res.json({ notebooks: [], status: st, error: String(e?.message || e) });
  }
});

/**
 * Привязать существующий блокнот NotebookLM к сценарию (клик по карточке блокнота).
 * Записывает notebooklm_state(tenant, flow) = notebookId, чтобы попап работал с ним.
 */
router.post('/flow/:flowId/adopt', async (req: AuthedRequest, res: Response) => {
  const notebookId = String(req.body?.notebookId || '').trim();
  const title = String(req.body?.title || '').trim().slice(0, 120);
  if (!/^[a-z0-9-]{8,}$/i.test(notebookId)) return res.status(400).json({ error: 'notebookId обязателен' });
  try {
    await pool.query(
      `INSERT INTO notebooklm_state (tenant_id, flow_id, notebook_id, title) VALUES ($1,$2,$3,$4)
       ON CONFLICT (tenant_id, flow_id) DO UPDATE SET notebook_id=EXCLUDED.notebook_id, title=EXCLUDED.title`,
      [req.tenantId!, req.params.flowId, notebookId, title || null]
    );
    // Подтянуть существующие источники блокнота в кэш (completeAction пишет notebooklm_state.sources),
    // иначе попап покажет 0 источников и заблокирует чат/генерацию. Расширение наведёт вкладку на этот
    // блокнот. Ошибки/офлайн глотаем — блок всё равно откроется.
    const st = await getConnectionStatus(req.tenantId!);
    if (st.ok) {
      try {
        const aId = await enqueueAction(req.tenantId!, req.params.flowId, notebookId, 'list-sources', {});
        await waitAction(req.tenantId!, aId, 40_000);
      } catch { /* best-effort */ }
    }
    res.json({ ok: true, notebookId });
  } catch (e: any) { res.status(500).json(errPayload(e)); }
});

/** Сводка для панели блока: блокнот, источники (кэш), джобы, счётчики, статус. */
router.get('/flow/:flowId/overview', async (req: AuthedRequest, res: Response) => {
  const { flowId } = req.params;
  const tenantId = req.tenantId!;
  const [status, counters] = await Promise.all([getConnectionStatus(tenantId), todayCounters(tenantId)]);
  let notebookId: string | null = null;
  let sources: any[] = [];
  try {
    const s = await pool.query(`SELECT notebook_id, sources FROM notebooklm_state WHERE tenant_id=$1 AND flow_id=$2`, [tenantId, flowId]);
    notebookId = s.rows[0]?.notebook_id || null;
    sources = Array.isArray(s.rows[0]?.sources) ? s.rows[0].sources : [];
  } catch { /* пусто */ }
  let jobs: any[] = [];
  try {
    const r = await pool.query(`SELECT * FROM notebooklm_jobs WHERE tenant_id=$1 AND flow_id=$2 ORDER BY created_at DESC LIMIT 40`, [tenantId, flowId]);
    jobs = r.rows.map(mapJob);
  } catch { /* пусто */ }
  res.json({ notebookId, sources, jobs, counters, status });
});

/** Добавить источник: URL/YouTube или текст. */
router.post('/flow/:flowId/sources', async (req: AuthedRequest, res: Response) => {
  const { flowId } = req.params;
  const { kind, url, title, content } = req.body || {};
  if (kind !== 'url' && kind !== 'text') return res.status(400).json({ error: 'kind: url | text' });
  try {
    const nb = await ensureNotebook(req.tenantId!, flowId, req.body?.flowName);
    const payload = kind === 'url' ? { srcKind: 'url', url, title } : { srcKind: 'text', content, title };
    const actionId = await enqueueAction(req.tenantId!, flowId, nb, 'add-source', payload);
    const r = await waitAction(req.tenantId!, actionId, 180_000);
    if (!r.ok) throw new ExtError(r.error || 'источник не добавлен', 'error');
    res.json({ source: r.result?.source || null, notebookId: nb });
  } catch (e: any) { res.status(502).json(errPayload(e)); }
});

/** Добавить источник-файл из Галереи (media_assets). Расширение качает байты по URL. */
router.post('/flow/:flowId/sources/asset', async (req: AuthedRequest, res: Response) => {
  const { flowId } = req.params;
  const assetId = String(req.body?.assetId || '');
  if (!assetId) return res.status(400).json({ error: 'assetId обязателен' });
  try {
    const a = (await pool.query(`SELECT file_url, original_name, mime FROM media_assets WHERE tenant_id=$1 AND id=$2`, [req.tenantId!, assetId])).rows[0];
    if (!a?.file_url) return res.status(404).json({ error: 'Файл ассета не найден' });
    const nb = await ensureNotebook(req.tenantId!, flowId, req.body?.flowName);
    const fileUrl = absUrl(absBase(req), a.file_url);
    const payload = { srcKind: 'file', fileUrl, fileName: a.original_name || 'source', mime: a.mime || null, title: a.original_name };
    const actionId = await enqueueAction(req.tenantId!, flowId, nb, 'add-source', payload);
    const r = await waitAction(req.tenantId!, actionId, 300_000); // файл может грузиться долго
    if (!r.ok) throw new ExtError(r.error || 'файл не добавлен', 'error');
    res.json({ source: r.result?.source || null, notebookId: nb });
  } catch (e: any) { res.status(502).json(errPayload(e)); }
});

router.delete('/flow/:flowId/sources/:sourceId', async (req: AuthedRequest, res: Response) => {
  try {
    const nb = await getNotebookId(req.tenantId!, req.params.flowId);
    if (!nb) return res.status(404).json({ error: 'Блокнот ещё не создан' });
    const actionId = await enqueueAction(req.tenantId!, req.params.flowId, nb, 'delete-source', { sourceId: req.params.sourceId });
    const r = await waitAction(req.tenantId!, actionId, 60_000);
    if (!r.ok) throw new ExtError(r.error || 'источник не удалён', 'error');
    res.json({ ok: true });
  } catch (e: any) { res.status(502).json(errPayload(e)); }
});

/** Чат с блокнотом (ответ с цитатами; думает до пары минут — long-poll в рамках запроса). */
router.post('/flow/:flowId/chat', async (req: AuthedRequest, res: Response) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Пустой вопрос' });
  try {
    const nb = await ensureNotebook(req.tenantId!, req.params.flowId, req.body?.flowName);
    const actionId = await enqueueAction(req.tenantId!, req.params.flowId, nb, 'chat', { question });
    const r = await waitAction(req.tenantId!, actionId, 220_000);
    if (!r.ok) throw new ExtError(r.error || 'чат не ответил', 'error');
    res.json({ answer: r.result?.answer ?? null, citations: r.result?.citations ?? null });
  } catch (e: any) { res.status(502).json(errPayload(e)); }
});

/** Запуск генерации артефакта → джоба (фронт поллит GET /jobs/:id; расширение забирает /poll). */
router.post('/flow/:flowId/generate', async (req: AuthedRequest, res: Response) => {
  const { flowId } = req.params;
  const gtype = String(req.body?.type || '') as GenType;
  const params = (req.body?.params && typeof req.body.params === 'object') ? req.body.params : {};
  const title = String(req.body?.name || '').trim().slice(0, 120);
  if (!GEN_TYPES.includes(gtype)) return res.status(400).json({ error: `Неизвестный тип: ${gtype}` });
  try {
    const nb = await ensureNotebook(req.tenantId!, flowId, req.body?.flowName);
    void nb; // блокнот гарантированно есть; notebook_id джобе даст claimTask по flow_id
    const id = randomUUID();
    const r = await pool.query(
      `INSERT INTO notebooklm_jobs (id, tenant_id, flow_id, type, params, status, title)
       VALUES ($1,$2,$3,$4,$5,'queued',$6) RETURNING *`,
      [id, req.tenantId!, flowId, gtype, JSON.stringify(params), title || null]
    );
    res.json({ job: mapJob(r.rows[0]) });
  } catch (e: any) { res.status(502).json(errPayload(e)); }
});

/** Статус джобы (чистый select — расширение обновляет её через /api/notebooklm-ext). */
router.get('/jobs/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const r = await pool.query(`SELECT * FROM notebooklm_jobs WHERE tenant_id=$1 AND id=$2`, [req.tenantId!, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Джоба не найдена' });
    res.json({ job: mapJob(r.rows[0]) });
  } catch (e: any) { res.status(500).json(errPayload(e)); }
});

/** Счётчик генераций за сегодня (для бейджа в блоке). */
router.get('/counters', async (req: AuthedRequest, res: Response) => {
  res.json({ counters: await todayCounters(req.tenantId!) });
});

/**
 * GET /jobs?active=1 — джобы тенанта (не привязано к flow) для индикатора «генерится»
 * в Галерее → Hotebook. active=1 → только queued/running (плейсхолдер-карточки со спиннером).
 */
router.get('/jobs', async (req: AuthedRequest, res: Response) => {
  try {
    const activeOnly = req.query.active === '1' || req.query.active === 'true';
    const where = activeOnly ? `AND status IN ('queued','running')` : '';
    const r = await pool.query(
      `SELECT * FROM notebooklm_jobs WHERE tenant_id=$1 ${where} ORDER BY created_at DESC LIMIT 60`,
      [req.tenantId!]
    );
    res.json({ jobs: r.rows.map((row: any) => ({ ...mapJob(row), title: row.title || null })) });
  } catch (e: any) { res.status(500).json(errPayload(e)); }
});

export default router;
