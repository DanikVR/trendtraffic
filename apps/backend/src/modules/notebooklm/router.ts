/**
 * Hotebook (Google NotebookLM) — бэкенд блока «Hotebook» в TrendFlow.
 *
 * Архитектура: фронт → этот роутер → Hotebook-воркер (notebooklm-worker,
 * FastAPI-обёртка notebooklm-py по Tailscale) → NotebookLM. Готовые артефакты
 * (mp3/mp4/pdf/png/md/json) скачиваются с воркера в uploads/hotebook и
 * регистрируются в media_assets (folder='hotebook') — их показывает раздел
 * «Hotebook» Галереи.
 *
 * ПОДКЛЮЧЕНИЕ ПЕР-ТЕНАНТНОЕ: у каждого Enterprise-тенанта СВОЙ Google-аккаунт
 * (профиль notebooklm-py на воркере = tenantId → ?profile= на всех вызовах);
 * свои лимиты и блокноты. Подключение (вставка storage_state.json) доступно
 * любому Enterprise-тенанту; окно входа на машине воркера — только superadmin.
 *
 * Доступ: JWT + Enterprise (как social-ext).
 *
 * Статус /status питает «плашку синхронизации»: error_kind =
 *   'auth'           — сессия Google протухла, нужно переподключение;
 *   'api_changed'    — Google поменял внутренние эндпоинты (ждать обновления библиотеки);
 *   'quota'          — упёрлись в суточный лимит аккаунта;
 *   'network'        — сеть между воркером и Google;
 *   'offline'        — воркер недоступен (машина выключена);
 *   'not_configured' — NOTEBOOKLM_WORKER_URL не задан.
 * Дежурный алерт владельцу в Telegram — раз в 12ч при auth/api_changed.
 *
 * Джобы генерации: notebooklm_jobs (Postgres). Схема поллинга как у подкаста:
 * фронт опрашивает GET /jobs/:id, а этот эндпоинт сам подтягивает состояние
 * задачи с воркера и при готовности забирает файл (никакого фонового шедулера).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { getNotebookWorkerUrl } from '../../config/systemConfig.js';
import pool from '../../db/index.js';
import { createAsset, type MediaAsset } from '../media/assets.js';
import { sendOwnerNotification } from '../tenant_settings/owner_telegram.js';

const __dirname_n = path.dirname(fileURLToPath(import.meta.url));
const HOTEBOOK_DIR = path.resolve(__dirname_n, '../../../../uploads/hotebook');

/** Папка Галереи для артефактов Hotebook (вкладка «Hotebook»). */
export const HOTEBOOK_FOLDER = 'hotebook';

/** Типы артефактов NotebookLM, которые умеет воркер (см. GEN_SPEC в main.py). */
const GEN_TYPES = ['audio', 'video', 'report', 'quiz', 'table', 'infographic', 'flashcards', 'mindmap', 'slides'] as const;
type GenType = (typeof GEN_TYPES)[number];

const RU_LABEL: Record<GenType, string> = {
  audio: 'Аудиопересказ', video: 'Видеообзор', report: 'Отчёт', quiz: 'Тест',
  table: 'Таблица', infographic: 'Инфографика', flashcards: 'Карточки',
  mindmap: 'Ментальная карта', slides: 'Презентация',
};

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

/** Блок Hotebook — только Enterprise (+superadmin-bypass внутри hasEnterpriseAccess). */
async function requireEnterprise(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole)) return next();
  } catch (err) {
    console.warn('[hotebook] enterprise-гейт:', err);
  }
  return res.status(403).json({ error: 'Доступно только на тарифе Enterprise' });
}

// ── Таблицы (inline-инициализация, как tenant_provider_keys) ────────────────
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
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_nlm_jobs_tenant ON notebooklm_jobs(tenant_id, created_at DESC)`);
}
ensureTables().catch((e) => console.warn('[hotebook] init таблиц:', (e as Error).message));

// ── HTTP к воркеру ───────────────────────────────────────────────────────────
class WorkerOffline extends Error {}
class WorkerApiError extends Error {
  kind: string;
  constructor(message: string, kind: string) { super(message); this.kind = kind; }
}

function workerBase(): string {
  return getNotebookWorkerUrl();
}

/**
 * Вызов воркера. prof — имя профиля notebooklm-py (= tenantId), добавляется как
 * ?profile=<prof> → у каждого Enterprise-тенанта свой Google-аккаунт на воркере.
 */
async function wfetch(pathname: string, init: RequestInit = {}, timeoutMs = 30_000, prof?: string): Promise<any> {
  const base = workerBase();
  if (!base) throw new WorkerApiError('Hotebook-воркер не настроен (NOTEBOOKLM_WORKER_URL)', 'not_configured');
  let url = `${base}${pathname}`;
  if (prof) url += (pathname.includes('?') ? '&' : '?') + `profile=${encodeURIComponent(prof)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  let r: globalThis.Response;
  try {
    r = await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    clearTimeout(t);
    throw new WorkerOffline(e?.name === 'AbortError' ? 'Hotebook-воркер не ответил вовремя' : 'Hotebook-воркер недоступен (машина воркера выключена?)');
  }
  clearTimeout(t);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Воркер оборачивает ошибки NotebookLM в 502 {detail:{error, error_kind}}.
    const det = (data as any)?.detail;
    const msg = (typeof det === 'object' ? det?.error : det) || (data as any)?.error || `воркер вернул HTTP ${r.status}`;
    const kind = (typeof det === 'object' && det?.error_kind) || 'api_changed';
    throw new WorkerApiError(String(msg), String(kind));
  }
  return data;
}

function errPayload(e: any): { error: string; errorKind: string } {
  if (e instanceof WorkerApiError) return { error: e.message, errorKind: e.kind };
  if (e instanceof WorkerOffline) return { error: e.message, errorKind: 'offline' };
  return { error: e?.message || 'Ошибка', errorKind: 'error' };
}

// ── Статус подключения ПЕР-ТЕНАНТ (кэш 30с на тенанта) + алерт владельцу ──────
const statusCache = new Map<string, { at: number; data: any }>();
const lastAlertAt = new Map<string, number>();
const adopted = new Set<string>(); // тенанты, для кого уже пробовали перенести сессию 'default'

/**
 * Статус подключения Google этого тенанта (профиль = tenantId).
 * Для суперадмина один раз пробуем перенести старую платформенную сессию
 * 'default' в его профиль (он логинился до перехода на пер-тенантную схему).
 */
async function connectionStatus(tenantId: string, opts: { force?: boolean; role?: string } = {}): Promise<any> {
  if (!workerBase()) return { configured: false, ok: false, errorKind: 'not_configured', checkedAt: new Date().toISOString() };
  const cached = statusCache.get(tenantId);
  if (!opts.force && cached && Date.now() - cached.at < 30_000) return cached.data;
  // Суперадмин: перенести сессию default → его профиль (идемпотентно, один раз).
  if (opts.role === 'superadmin' && !adopted.has(tenantId)) {
    adopted.add(tenantId);
    try { await wfetch('/auth/adopt-default', { method: 'POST' }, 20_000, tenantId); } catch { /* нет default — не страшно */ }
  }
  let data: any;
  try {
    const s = await wfetch('/auth/status', {}, 15_000, tenantId);
    data = { configured: true, ok: !!s.ok, errorKind: s.error_kind || null, email: s.email || null, error: s.error || null, checkedAt: new Date().toISOString() };
  } catch (e: any) {
    const p = errPayload(e);
    data = { configured: true, ok: false, errorKind: p.errorKind, error: p.error, checkedAt: new Date().toISOString() };
  }
  statusCache.set(tenantId, { at: Date.now(), data });
  return data;
}

/** Разовый алерт владельцу тенанта при поломке синхронизации (не чаще раза в 12ч). */
async function maybeAlertOwner(tenantId: string, st: any): Promise<void> {
  if (st?.ok || !['auth', 'api_changed'].includes(String(st?.errorKind))) return;
  if (Date.now() - (lastAlertAt.get(tenantId) || 0) < 12 * 3600_000) return;
  lastAlertAt.set(tenantId, Date.now());
  const why = st.errorKind === 'auth'
    ? 'сессия вашего Google-аккаунта протухла — переподключите аккаунт в Настройках Enterprise → Hotebook'
    : 'Google изменил внутренний API NotebookLM — нужно обновить библиотеку на воркере';
  try {
    await sendOwnerNotification(tenantId, `⚠️ <b>Hotebook: синхронизация с Google нарушена</b>\n${why}`);
  } catch { /* best-effort */ }
}

// ── Блокнот сценария ─────────────────────────────────────────────────────────
async function getNotebookId(tenantId: string, flowId: string): Promise<string | null> {
  const r = await pool.query(`SELECT notebook_id FROM notebooklm_state WHERE tenant_id=$1 AND flow_id=$2`, [tenantId, flowId]);
  return r.rows[0]?.notebook_id || null;
}

async function ensureNotebook(tenantId: string, flowId: string, title?: string): Promise<string> {
  const existing = await getNotebookId(tenantId, flowId);
  if (existing) return existing;
  const name = (title || '').trim() || `TrendFlow · ${flowId.slice(0, 8)}`;
  const d = await wfetch('/notebooks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: name }),
  }, 60_000, tenantId);
  const nb = d?.notebook || {};
  const nbId = nb.id || nb.notebook_id || nb.notebookId;
  if (!nbId || typeof nbId !== 'string') throw new WorkerApiError('NotebookLM не вернул id блокнота', 'api_changed');
  await pool.query(
    `INSERT INTO notebooklm_state (tenant_id, flow_id, notebook_id, title) VALUES ($1,$2,$3,$4)
     ON CONFLICT (tenant_id, flow_id) DO UPDATE SET notebook_id = EXCLUDED.notebook_id, title = EXCLUDED.title`,
    [tenantId, flowId, nbId, name]
  );
  return nbId;
}

// ── Джобы ────────────────────────────────────────────────────────────────────
function mapJob(r: any): any {
  return {
    id: r.id, flowId: r.flow_id, type: r.type, status: r.status,
    params: r.params || {}, error: r.error || null, errorKind: r.error_kind || null,
    assetId: r.asset_id || null, fileUrl: r.file_url || null, payload: r.payload ?? null,
    createdAt: r.created_at, finishedAt: r.finished_at,
  };
}

const EXT_MEDIA: Record<string, string> = {
  '.mp3': 'audio', '.m4a': 'audio', '.wav': 'audio',
  '.mp4': 'video', '.webm': 'video',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image',
};
const EXT_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.md': 'text/markdown', '.json': 'application/json', '.csv': 'text/csv', '.html': 'text/html',
};

/** Финализация: скачиваем готовый файл с воркера → uploads/hotebook → media_assets. */
const finalizing = new Set<string>();
async function finalizeJob(tenantId: string, row: any, task: any): Promise<void> {
  if (finalizing.has(row.id)) return;
  finalizing.add(row.id);
  try {
    const remoteName = String(task.file_name || '');
    const ext = (path.extname(remoteName) || '.bin').toLowerCase();
    fs.mkdirSync(HOTEBOOK_DIR, { recursive: true });
    const localName = `${row.id}${ext}`;
    const localPath = path.join(HOTEBOOK_DIR, localName);
    const base = workerBase();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 900_000);
    try {
      const r = await fetch(`${base}/files/${encodeURIComponent(remoteName)}`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`скачивание артефакта: HTTP ${r.status}`);
      fs.writeFileSync(localPath, Buffer.from(await r.arrayBuffer()));
    } finally {
      clearTimeout(t);
    }
    const fileUrl = `/uploads/hotebook/${localName}`;
    const gtype = row.type as GenType;
    const when = new Date().toLocaleDateString('ru-RU');
    const asset: MediaAsset | null = await createAsset(tenantId, {
      kind: 'reference',
      mediaType: EXT_MEDIA[ext] || 'file',
      originalName: `Hotebook — ${RU_LABEL[gtype] || gtype} · ${when}${ext}`,
      fileUrl,
      filePath: localPath,
      mime: EXT_MIME[ext],
      size: fs.statSync(localPath).size,
      folder: HOTEBOOK_FOLDER,
    });
    await pool.query(
      `UPDATE notebooklm_jobs SET status='done', asset_id=$2, file_url=$3, payload=$4, finished_at=now(), error=NULL, error_kind=NULL WHERE id=$1`,
      [row.id, asset?.id || null, fileUrl, task.payload != null ? JSON.stringify(task.payload) : null]
    );
  } finally {
    finalizing.delete(row.id);
  }
}

/** Опрос воркера по активной джобе (вызывается из GET /jobs/:id — поллинг фронта). */
async function refreshJob(tenantId: string, row: any): Promise<any> {
  if (row.status !== 'queued' && row.status !== 'running') return row;
  if (!row.remote_task_id) {
    await pool.query(`UPDATE notebooklm_jobs SET status='error', error=$2, error_kind='error', finished_at=now() WHERE id=$1`, [row.id, 'потерян id задачи воркера']);
  } else {
    try {
      const d = await wfetch(`/tasks/${encodeURIComponent(row.remote_task_id)}`, {}, 20_000);
      const task = d?.task || {};
      if (task.status === 'done') {
        await finalizeJob(tenantId, row, task);
      } else if (task.status === 'error') {
        await pool.query(
          `UPDATE notebooklm_jobs SET status='error', error=$2, error_kind=$3, finished_at=now() WHERE id=$1`,
          [row.id, String(task.error || 'ошибка генерации'), String(task.error_kind || 'error')]
        );
        if (task.error_kind === 'auth' || task.error_kind === 'api_changed') statusCache.delete(tenantId); // плашка узнает сразу
      } else if (row.status === 'queued') {
        await pool.query(`UPDATE notebooklm_jobs SET status='running' WHERE id=$1`, [row.id]);
      }
    } catch (e: any) {
      if (e instanceof WorkerApiError && (e as any).message?.includes('не найдена')) {
        await pool.query(`UPDATE notebooklm_jobs SET status='error', error=$2, error_kind='error', finished_at=now() WHERE id=$1`, [row.id, 'воркер перезапускался — задача потеряна, запустите генерацию заново']);
      }
      // offline/сетевые сбои — молча ждём следующего опроса
    }
  }
  const rr = await pool.query(`SELECT * FROM notebooklm_jobs WHERE tenant_id=$1 AND id=$2`, [tenantId, row.id]);
  return rr.rows[0] || row;
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

// ── Роутер ───────────────────────────────────────────────────────────────────
const router = Router();
router.use(requireAuth);
router.use(requireEnterprise);

/** Статус подключения Google этого тенанта (плашка в блоке и в настройках). ?force=1 — без кэша. */
router.get('/status', async (req: AuthedRequest, res: Response) => {
  const st = await connectionStatus(req.tenantId!, { force: req.query.force === '1', role: req.userRole });
  void maybeAlertOwner(req.tenantId!, st);
  res.json({ status: st });
});

/** Открыть окно входа Google на машине воркера (WSLg) — только superadmin (его ПК = воркер). */
router.post('/auth/login-window', async (req: AuthedRequest, res: Response) => {
  if (req.userRole !== 'superadmin') return res.status(403).json({ error: 'Окно входа доступно только суперадмину (на машине воркера). Клиенты подключают аккаунт вставкой сессии storage_state.json.' });
  try {
    const d = await wfetch('/auth/login-window', { method: 'POST' }, 30_000, req.tenantId!);
    statusCache.delete(req.tenantId!); // после входа «Проверить» должен увидеть свежую сессию
    res.json({ started: !!d.started, note: d.note || null });
  } catch (e: any) {
    res.status(502).json(errPayload(e));
  }
});

/** Импорт кук Google (storage_state.json) в СВОЙ профиль — любой Enterprise-тенант. */
router.post('/auth/import', async (req: AuthedRequest, res: Response) => {
  try {
    let ss = req.body?.storageState ?? req.body?.storage_state;
    if (typeof ss === 'string') { try { ss = JSON.parse(ss); } catch { return res.status(400).json({ error: 'Это не JSON. Вставьте содержимое storage_state.json целиком.' }); } }
    if (!ss || !Array.isArray(ss.cookies) || ss.cookies.length === 0) {
      return res.status(400).json({ error: 'Ожидается storage_state.json с массивом cookies (его создаёт «notebooklm login»)' });
    }
    const d = await wfetch('/auth/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storage_state: ss }) }, 60_000, req.tenantId!);
    statusCache.delete(req.tenantId!);
    res.json({ status: { configured: true, ok: !!d.ok, errorKind: d.error_kind || null, email: d.email || null, error: d.error || null, checkedAt: new Date().toISOString() } });
  } catch (e: any) {
    res.status(502).json(errPayload(e));
  }
});

/** Сводка для панели блока: блокнот, источники, джобы, счётчики, статус. */
router.get('/flow/:flowId/overview', async (req: AuthedRequest, res: Response) => {
  const { flowId } = req.params;
  const tenantId = req.tenantId!;
  const [status, counters] = await Promise.all([connectionStatus(tenantId, { role: req.userRole }), todayCounters(tenantId)]);
  void maybeAlertOwner(tenantId, status);
  const notebookId = await getNotebookId(tenantId, flowId).catch(() => null);
  let sources: any[] = [];
  if (notebookId && status?.ok) {
    try { sources = (await wfetch(`/notebooks/${encodeURIComponent(notebookId)}/sources`, {}, 30_000, tenantId))?.sources || []; }
    catch { /* источники недоступны — покажем пусто, плашка объяснит */ }
  }
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
    const d = await wfetch(`/notebooks/${encodeURIComponent(nb)}/sources`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, url, title, content }),
    }, 180_000, req.tenantId!);
    res.json({ source: d?.source || null, notebookId: nb });
  } catch (e: any) {
    res.status(502).json(errPayload(e));
  }
});

/** Добавить источник-файл из Галереи (media_assets). */
router.post('/flow/:flowId/sources/asset', async (req: AuthedRequest, res: Response) => {
  const { flowId } = req.params;
  const assetId = String(req.body?.assetId || '');
  if (!assetId) return res.status(400).json({ error: 'assetId обязателен' });
  try {
    const r = await pool.query(`SELECT file_path, original_name, mime FROM media_assets WHERE tenant_id=$1 AND id=$2`, [req.tenantId!, assetId]);
    const a = r.rows[0];
    if (!a?.file_path || !fs.existsSync(a.file_path)) return res.status(404).json({ error: 'Файл ассета не найден на диске' });
    const nb = await ensureNotebook(req.tenantId!, flowId, req.body?.flowName);
    const buf = fs.readFileSync(a.file_path);
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: a.mime || 'application/octet-stream' }), a.original_name || path.basename(a.file_path));
    const d = await wfetch(`/notebooks/${encodeURIComponent(nb)}/sources/file`, { method: 'POST', body: fd as any }, 600_000, req.tenantId!);
    res.json({ source: d?.source || null, notebookId: nb });
  } catch (e: any) {
    res.status(502).json(errPayload(e));
  }
});

router.delete('/flow/:flowId/sources/:sourceId', async (req: AuthedRequest, res: Response) => {
  try {
    const nb = await getNotebookId(req.tenantId!, req.params.flowId);
    if (!nb) return res.status(404).json({ error: 'Блокнот ещё не создан' });
    await wfetch(`/notebooks/${encodeURIComponent(nb)}/sources/${encodeURIComponent(req.params.sourceId)}`, { method: 'DELETE' }, 60_000, req.tenantId!);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(502).json(errPayload(e));
  }
});

/** Чат с блокнотом (ответ с цитатами; может думать до пары минут). */
router.post('/flow/:flowId/chat', async (req: AuthedRequest, res: Response) => {
  const question = String(req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Пустой вопрос' });
  try {
    const nb = await ensureNotebook(req.tenantId!, req.params.flowId, req.body?.flowName);
    const d = await wfetch(`/notebooks/${encodeURIComponent(nb)}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }),
    }, 240_000, req.tenantId!);
    res.json({ answer: d?.answer ?? null, citations: d?.citations ?? null });
  } catch (e: any) {
    res.status(502).json(errPayload(e));
  }
});

/** Запуск генерации артефакта → джоба (фронт поллит GET /jobs/:id). */
router.post('/flow/:flowId/generate', async (req: AuthedRequest, res: Response) => {
  const { flowId } = req.params;
  const gtype = String(req.body?.type || '') as GenType;
  const params = (req.body?.params && typeof req.body.params === 'object') ? req.body.params : {};
  if (!GEN_TYPES.includes(gtype)) return res.status(400).json({ error: `Неизвестный тип: ${gtype}` });
  try {
    const nb = await ensureNotebook(req.tenantId!, flowId, req.body?.flowName);
    const d = await wfetch(`/notebooks/${encodeURIComponent(nb)}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: gtype, params }),
    }, 60_000, req.tenantId!);
    const remote = String(d?.task_id || '');
    if (!remote) throw new WorkerApiError('воркер не вернул task_id', 'api_changed');
    const id = randomUUID();
    const r = await pool.query(
      `INSERT INTO notebooklm_jobs (id, tenant_id, flow_id, type, params, status, remote_task_id)
       VALUES ($1,$2,$3,$4,$5,'queued',$6) RETURNING *`,
      [id, req.tenantId!, flowId, gtype, JSON.stringify(params), remote]
    );
    res.json({ job: mapJob(r.rows[0]) });
  } catch (e: any) {
    res.status(502).json(errPayload(e));
  }
});

/** Статус джобы (сам подтягивает состояние с воркера и финализирует готовое). */
router.get('/jobs/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const r = await pool.query(`SELECT * FROM notebooklm_jobs WHERE tenant_id=$1 AND id=$2`, [req.tenantId!, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Джоба не найдена' });
    const row = await refreshJob(req.tenantId!, r.rows[0]);
    res.json({ job: mapJob(row) });
  } catch (e: any) {
    res.status(500).json(errPayload(e));
  }
});

/** Счётчик генераций за сегодня (для бейджа в блоке). */
router.get('/counters', async (req: AuthedRequest, res: Response) => {
  res.json({ counters: await todayCounters(req.tenantId!) });
});

export default router;
