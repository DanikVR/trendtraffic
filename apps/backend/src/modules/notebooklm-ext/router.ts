/**
 * NotebookLM-расширение — бэкенд-очередь блока «Hotebook» (зеркало flow-ext).
 *
 * Мы НЕ ходим в NotebookLM сами: работает единое Chrome-расширение
 * (apps/trendtraffic-extension) в браузере клиента — человек залогинен в свой Google,
 * расширение выполняет действия (источники/чат) и генерации артефактов и присылает
 * результат сюда. Этот роутер — приёмник для расширения:
 *
 *   расширение → GET  /poll          (long-poll: следующее действие ИЛИ джоба генерации)
 *              → POST /action-result (результат синхронного действия → разблокирует long-poll фронта)
 *              → POST /status        (статус джобы генерации: running/retry/failed)
 *              → POST /ingest        (готовый артефакт → Галерея folder='hotebook', джоба done)
 *              → POST /recon         (снимок вёрстки NotebookLM для подстройки селекторов)
 *              → GET  /gallery       (файлы Галереи для источника-из-файла)
 *
 * Публичный роутер (`/api/notebooklm/*`, фронт) кладёт действия/джобы в те же таблицы
 * (см. ext_bridge.ts). Пер-тенантно + JWT + Enterprise (как flow-ext).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import pool from '../../db/index.js';
import { createAsset, listAssets, type MediaAsset } from '../media/assets.js';
import { downloadVideoToDisk } from '../media/store_video.js';
import { createHash } from 'crypto';
import {
  HOTEBOOK_FOLDER, HOTEBOOK_DIR, EXT_MEDIA, EXT_MIME, artifactFileName,
  claimAction, claimTask, completeAction, setPresence, ingestHotebookArtifact,
  GEN_TYPES, type GenType,
} from '../notebooklm/ext_bridge.js';

/** База64-заливка артефактов (audio/video/pdf приходят base64) — как во flow-ext. */
const INGEST_JSON_LIMIT = '700mb';

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
  catch (err) { console.warn('[notebooklm-ext] enterprise-гейт:', err); }
  return res.status(403).json({ error: 'Доступно только на тарифе Enterprise' });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Сохранение артефакта ─────────────────────────────────────────────────────
function extOf(fileName: string | null, mime: string | null): string {
  const fromName = fileName ? path.extname(fileName).toLowerCase() : '';
  if (fromName) return fromName;
  const m = String(mime || '').toLowerCase();
  if (m.includes('mpeg') || m.includes('mp3')) return '.mp3';
  if (m.includes('mp4')) return m.includes('audio') ? '.m4a' : '.mp4';
  if (m.includes('webm')) return '.webm';
  if (m.includes('png')) return '.png';
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  if (m.includes('pdf')) return '.pdf';
  if (m.includes('csv')) return '.csv';
  if (m.includes('markdown')) return '.md';
  if (m.includes('json')) return '.json';
  return '.bin';
}

function saveDataUrl(dataUrl: string, jobId: string, extHint: string): { fileUrl: string; filePath: string; size: number; mime: string; ext: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('неверный dataUrl');
  const mime = m[1] || 'application/octet-stream';
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 16) throw new Error('пустой артефакт');
  const ext = extHint || extOf(null, mime);
  fs.mkdirSync(HOTEBOOK_DIR, { recursive: true });
  const name = `${jobId}${ext}`;
  const filePath = path.join(HOTEBOOK_DIR, name);
  fs.writeFileSync(filePath, buf);
  return { fileUrl: `/uploads/hotebook/${name}`, filePath, size: buf.length, mime, ext };
}

async function saveSourceUrl(sourceUrl: string, jobId: string, extHint: string): Promise<{ fileUrl: string; filePath: string; size: number; mime: string; ext: string }> {
  // Прямая CDN-ссылка (fallback, когда расширение не смогло прочитать байты). Часто за
  // Google-авторизацией → может не скачаться на сервере; тогда честно падаем.
  const s = await downloadVideoToDisk([sourceUrl], { referer: 'https://notebooklm.google.com/' });
  const ext = extHint || path.extname(s.filePath).toLowerCase() || extOf(null, s.mime);
  return { fileUrl: s.mediaUrl, filePath: s.filePath, size: s.size, mime: s.mime, ext };
}

function absBase(req: AuthedRequest): string {
  const env = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}
const absUrl = (base: string, u?: string): string => (u && !/^https?:\/\//i.test(u) ? base + (u.startsWith('/') ? u : '/' + u) : (u || ''));

// ── Роутер ────────────────────────────────────────────────────────────────────
const router = Router();

const pollLimiter = rateLimit({
  windowMs: 60_000, max: 120,
  keyGenerator: (req: AuthedRequest) => req.tenantId || 'anon',
  standardHeaders: true, legacyHeaders: false,
});

router.use(requireAuth, requireEnterprise);

/**
 * Расширение: long-poll очереди. Возвращает СЛЕДУЮЩУЮ единицу работы —
 * синхронное действие (приоритет) ИЛИ джобу генерации; если за `wait` секунд ничего
 * не появилось — пусто. Заодно обновляет присутствие (питает плашку статуса).
 */
router.get('/poll', pollLimiter, async (req: AuthedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const waitS = Math.min(Math.max(parseInt(String(req.query.wait || '20'), 10) || 20, 0), 25);
  void setPresence(tenantId, req.query.loggedIn === '1', req.query.open === '1');
  const deadline = Date.now() + waitS * 1000;
  try {
    do {
      const action = await claimAction(tenantId);
      if (action) return res.json({ kind: 'action', action });
      const task = await claimTask(tenantId);
      if (task) return res.json({ kind: 'task', task });
      if (Date.now() >= deadline) break;
      await sleep(500);
    } while (Date.now() < deadline);
    res.json({ kind: null });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * Расширение: ЛЁГКИЙ пинг присутствия (не занимает /poll задачей). Основной long-poll во время
 * генерации артефакта заблокирован на 6–12 минут (runNlmTask) и не обновляет присутствие → статус
 * ошибочно уходит в ext_offline и списки «пропадают». Этот эндпоинт зовётся по будильнику каждые
 * ~30с НЕЗАВИСИМО от генерации и держит last_poll_at свежим.
 */
router.post('/presence', async (req: AuthedRequest, res: Response) => {
  void setPresence(req.tenantId!, req.body?.loggedIn !== false, req.body?.open === true);
  res.json({ ok: true });
});

/**
 * НАБЛЮДАЕМЫЕ генерации: юзер запустил генерацию ПРЯМО в NotebookLM (не через приложение).
 * Расширение каждые ~20с шлёт текущий список «генерируется…» открытого блокнота. Мы upsert-им
 * их как джобы (flow_id NULL, notebook_id прямой) → индикаторы на карточках/вкладке/сайдбаре
 * работают из коробки. Пропавшие из списка running-джобы закрываем (генерация кончилась —
 * готовый файл придёт отдельно через /observed-ingest).
 */
const obsId = (tenantId: string, notebookId: string, title: string) =>
  'obs-' + createHash('md5').update(`${tenantId}:${notebookId}:${String(title).trim().toLowerCase()}`).digest('hex').slice(0, 24);

router.post('/observed', async (req: AuthedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const notebookId = String(req.body?.notebookId || '').trim();
  const generating: { title?: string; gtype?: string }[] = Array.isArray(req.body?.generating) ? req.body.generating : [];
  if (!/^[a-z0-9-]{8,}$/i.test(notebookId)) return res.status(400).json({ error: 'notebookId обязателен' });
  try {
    const ids: string[] = [];
    for (const g of generating.slice(0, 12)) {
      const title = String(g?.title || 'Генерация NotebookLM').slice(0, 120);
      const type = GEN_TYPES.includes(String(g?.gtype) as GenType) ? String(g?.gtype) : 'audio';
      const id = obsId(tenantId, notebookId, title);
      ids.push(id);
      await pool.query(
        `INSERT INTO notebooklm_jobs (id, tenant_id, flow_id, notebook_id, type, params, status, title)
         VALUES ($1,$2,NULL,$3,$4,'{}','running',$5)
         ON CONFLICT (id) DO UPDATE SET status='running', finished_at=NULL, updated_at=now()`,
        [id, tenantId, notebookId, type, title]
      );
    }
    // Наблюдаемые running этого блокнота, которых больше нет в студии → УДАЛИТЬ. Это чистые
    // индикаторы («…генерируется» с временным заголовком): счётчик ✨ питает ТОЛЬКО строка
    // /observed-ingest с готовым файлом. Оставлять их done = фантомный +1 (в т.ч. при отмене).
    await pool.query(
      `DELETE FROM notebooklm_jobs
        WHERE tenant_id=$1 AND notebook_id=$2 AND flow_id IS NULL AND status='running' AND asset_id IS NULL
          AND id <> ALL($3::text[])`,
      [tenantId, notebookId, ids.length ? ids : ['-']]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/**
 * Готовая работа студии NotebookLM → Галерея. Зовётся расширением: (а) автоматически, когда
 * наблюдаемая генерация завершилась; (б) по кнопке «в Галерею», которую расширение подставляет
 * рядом с готовыми работами в самом NotebookLM. Аудио → kind='audio' («Видео → Аудио»),
 * видео/картинки → reference («Видео»/«Изображение»); всё также в ленте «Hotebook» (folder).
 */
router.post('/observed-ingest', async (req: AuthedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const notebookId = String(req.body?.notebookId || '').trim();
  const title = String(req.body?.title || 'Артефакт NotebookLM').slice(0, 120);
  const gtype = GEN_TYPES.includes(String(req.body?.gtype) as GenType) ? String(req.body?.gtype) : 'audio';
  const dataUrl = String(req.body?.dataUrl || '');
  const mime = req.body?.mime ? String(req.body.mime) : null;
  if (!dataUrl.startsWith('data:')) return res.status(400).json({ error: 'нет dataUrl' });
  try {
    // Дедуп АТОМАРНО (иначе тот же артефакт из двух вкладок/устройств оба пройдут SELECT и зальются
    // дважды). Id БЕЗ суффикса: одна строка на артефакт. Схема: сначала КЛЕЙМ строки-плейсхолдера
    // (INSERT ... ON CONFLICT DO NOTHING) — кто вставил, тот и грузит файл; остальные видят готовый
    // ассет или «в процессе». Крашнувшийся клейм старше 2 мин перезабираем (иначе артефакт не зальётся).
    const dupId = obsId(tenantId, notebookId || 'nb', title);
    const claim = await pool.query(
      `INSERT INTO notebooklm_jobs (id, tenant_id, flow_id, notebook_id, type, params, status, title)
       VALUES ($1,$2,NULL,$3,$4,'{}','running',$5) ON CONFLICT (id) DO NOTHING`,
      [dupId, tenantId, notebookId || null, gtype, title]
    );
    if (!claim.rowCount) {
      const ex = await pool.query(`SELECT asset_id, file_url, updated_at FROM notebooklm_jobs WHERE id=$1 AND tenant_id=$2`, [dupId, tenantId]);
      const row = ex.rows[0];
      if (row && row.asset_id) {
        // Дедуп — только если ассет ЖИВ. Если юзер удалил его (напр. чтобы исправить старую .bin-
        // классификацию) — перезаливаем заново, а не возвращаем ссылку на удалённый.
        const alive = await pool.query(`SELECT 1 FROM media_assets WHERE id=$1 AND tenant_id=$2`, [row.asset_id, tenantId]);
        if (alive.rowCount) return res.json({ ok: true, assetId: row.asset_id, fileUrl: row.file_url, dedup: true });
      } else {
        // строка есть, но без файла: либо параллельная заливка идёт (свежая → «в процессе»), либо
        // клейм крашнулся (старая → перезабираем себе и грузим).
        const stale = !row || !row.updated_at || (Date.now() - new Date(row.updated_at).getTime() > 120_000);
        if (!stale) return res.json({ ok: true, dedup: true, pending: true });
      }
      await pool.query(`UPDATE notebooklm_jobs SET status='running', updated_at=now() WHERE id=$1 AND tenant_id=$2`, [dupId, tenantId]);
    }
    const asset = await ingestHotebookArtifact(tenantId, { dataUrl, fileName: title, mime, title, gtype });
    // Заполняем клеймнутую строку (питает счётчики ✨ на карточке блокнота).
    await pool.query(
      `UPDATE notebooklm_jobs SET status='done', asset_id=$3, file_url=$4, finished_at=now(), updated_at=now()
        WHERE id=$1 AND tenant_id=$2`,
      [dupId, tenantId, asset?.id || null, asset?.fileUrl || null]
    );
    res.json({ ok: true, assetId: asset?.id || null, fileUrl: asset?.fileUrl || null });
  } catch (e: any) { res.status(502).json({ error: 'не удалось сохранить артефакт: ' + (e?.message || e) }); }
});

/** Расширение: результат синхронного действия → разблокирует long-poll публичного роутера. */
router.post('/action-result', async (req: AuthedRequest, res: Response) => {
  const actionId = String(req.body?.actionId || '');
  if (!actionId) return res.status(400).json({ error: 'нет actionId' });
  const ok = !!req.body?.ok;
  const result = (req.body?.result && typeof req.body.result === 'object') ? req.body.result : null;
  const error = req.body?.error ? String(req.body.error).slice(0, 500) : null;
  try {
    await completeAction(req.tenantId!, actionId, ok, result, error);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/** Расширение: статус джобы генерации (running/retry/failed). done — через /ingest. */
router.post('/status', async (req: AuthedRequest, res: Response) => {
  const taskId = String(req.body?.taskId || '');
  let status = String(req.body?.status || '');
  const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
  if (!taskId || !status) return res.status(400).json({ error: 'нет taskId/status' });
  if (status === 'retry') status = 'queued';
  if (status === 'failed') status = 'error';
  if (!['queued', 'running', 'error'].includes(status)) return res.status(400).json({ error: 'неизвестный статус' });
  const isErr = status === 'error';
  const r = await pool.query(
    `UPDATE notebooklm_jobs SET status=$1, error=$2, error_kind=$3${isErr ? ', finished_at=now()' : ''} WHERE id=$4 AND tenant_id=$5 RETURNING id`,
    [status, isErr ? note : null, isErr ? 'error' : null, taskId, req.tenantId]
  );
  if (!r.rowCount) return res.status(404).json({ error: 'джоба не найдена' });
  res.json({ ok: true });
});

/** Расширение: готовый артефакт → Галерея folder='hotebook', джоба → done. */
router.post('/ingest', async (req: AuthedRequest, res: Response) => {
  const taskId = String(req.body?.taskId || '');
  const dataUrl = req.body?.dataUrl ? String(req.body.dataUrl) : '';
  const sourceUrl = req.body?.sourceUrl ? String(req.body.sourceUrl) : '';
  const fileName = req.body?.fileName ? String(req.body.fileName) : null;
  const mime = req.body?.mime ? String(req.body.mime) : null;
  const payload = (req.body?.payload !== undefined && req.body?.payload !== null) ? req.body.payload : null;
  if (!taskId) return res.status(400).json({ error: 'нет taskId' });

  const t = await pool.query(`SELECT id, type, title, flow_id, status, asset_id, file_url FROM notebooklm_jobs WHERE id=$1 AND tenant_id=$2`, [taskId, req.tenantId]);
  if (!t.rowCount) return res.status(404).json({ error: 'джоба не найдена' });
  const job = t.rows[0];
  // Идемпотентность: артефакт может прийти ДВАЖДЫ (осн. путь + резервный wake-месседж контента,
  // если SW умер во время генерации). Уже готовую джобу повторно НЕ заливаем.
  if (job.status === 'done' && job.asset_id) return res.json({ ok: true, assetId: job.asset_id, fileUrl: job.file_url || null, dedup: true });
  // Имя файла = «Название» джобы ИЛИ имя блокнота (по требованию юзера — как называется блокнот).
  let nameBase: string | null = job.title || null;
  if (!nameBase && job.flow_id) {
    try {
      const s = await pool.query(`SELECT title FROM notebooklm_state WHERE tenant_id=$1 AND flow_id=$2`, [req.tenantId, job.flow_id]);
      nameBase = (s.rows[0]?.title || '').trim() || null;
    } catch { /* пусто */ }
  }

  try {
    const extHint = extOf(fileName, mime);
    const stored = dataUrl.startsWith('data:')
      ? saveDataUrl(dataUrl, job.id, extHint)
      : await saveSourceUrl(sourceUrl, job.id, extHint);

    const artMediaType = EXT_MEDIA[stored.ext] || 'file';
    const asset: MediaAsset | null = await createAsset(req.tenantId!, {
      // Аудио-артефакты пишем kind='audio' → попадают И в «Видео → Аудио» (фильтр по kind),
      // И остаются в «Hotebook» (лента по folder='hotebook', kind-независима). По просьбе юзера
      // готовое аудио NotebookLM должно быть в аудио-разделе, а не только в Hotebook.
      kind: artMediaType === 'audio' ? 'audio' : 'reference',
      mediaType: artMediaType,
      originalName: artifactFileName(nameBase, job.type, stored.ext),
      fileUrl: stored.fileUrl, filePath: stored.filePath,
      mime: EXT_MIME[stored.ext] || stored.mime, size: stored.size,
      folder: HOTEBOOK_FOLDER,
      origins: ['hotebook'],
    });

    await pool.query(
      `UPDATE notebooklm_jobs SET status='done', asset_id=$2, file_url=$3, payload=$4, error=NULL, error_kind=NULL, finished_at=now() WHERE id=$1`,
      [job.id, asset?.id || null, stored.fileUrl, payload != null ? JSON.stringify(payload) : null]
    );
    res.json({ ok: true, assetId: asset?.id || null, fileUrl: stored.fileUrl });
  } catch (e: any) {
    await pool.query(`UPDATE notebooklm_jobs SET status='error', error=$2, error_kind='error', finished_at=now() WHERE id=$1`,
      [job.id, String(e?.message || e).slice(0, 500)]);
    res.status(502).json({ error: 'не удалось сохранить артефакт: ' + (e?.message || e) });
  }
});

/**
 * Расширение (источник-из-файла): список файлов Галереи тенанта с АБСОЛЮТНЫМИ URL —
 * расширение качает байты из background (обход CORS страницы) и вставляет в NotebookLM.
 */
router.get('/gallery', async (req: AuthedRequest, res: Response) => {
  try {
    const base = absBase(req);
    const ref = await listAssets(req.tenantId!, 'reference');
    const aud = await listAssets(req.tenantId!, 'audio');
    const items = [...ref, ...aud].slice(0, 200).map((a) => ({
      id: a.id, title: a.originalName || 'файл', fileUrl: absUrl(base, a.fileUrl),
      folder: a.folder || null, mediaType: a.mediaType || 'file',
    }));
    res.json({ items });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/** Расширение: снимок вёрстки NotebookLM (подстройка селекторов). Одна запись на тенант. */
router.post('/recon', async (req: AuthedRequest, res: Response) => {
  const data = req.body?.data;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'нет data' });
  const url = req.body?.url ? String(req.body.url).slice(0, 500) : null;
  try {
    await pool.query(
      `INSERT INTO notebooklm_ext_recon (tenant_id, data, url, updated_at) VALUES ($1,$2,$3,now())
       ON CONFLICT (tenant_id) DO UPDATE SET data=EXCLUDED.data, url=EXCLUDED.url, updated_at=now()`,
      [req.tenantId, JSON.stringify(data), url]
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

/** Последний снимок разведки тенанта (для отладки селекторов). */
router.get('/recon', async (req: AuthedRequest, res: Response) => {
  const r = await pool.query(`SELECT data, url, updated_at FROM notebooklm_ext_recon WHERE tenant_id=$1`, [req.tenantId]);
  if (!r.rowCount) return res.json({ recon: null });
  const row = r.rows[0];
  res.json({ recon: { data: row.data, url: row.url, updatedAt: row.updated_at } });
});

export const INGEST_LIMIT = INGEST_JSON_LIMIT;
export default router;
