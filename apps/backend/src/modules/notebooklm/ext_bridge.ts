/**
 * ext_bridge.ts — общий слой между публичным роутером «Hotebook» (`/api/notebooklm/*`,
 * которым пользуется фронт) и роутером расширения (`/api/notebooklm-ext/*`, которым
 * пользуется Chrome-расширение). Держит очередь синхронных действий, клейм задач
 * генерации, присутствие расширения и справочники типов артефактов.
 *
 * Модель (зеркало Google Flow, но NotebookLM — stateful-CRUD):
 *   • Синхронные действия (создать блокнот / источник / список / удаление / чат) —
 *     таблица notebooklm_ext_actions. Публичный роутер кладёт действие (enqueueAction)
 *     и long-poll'ит результат (waitAction). Расширение забирает (claimAction) через
 *     `/poll`, выполняет в браузере и рапортует (completeAction) через `/action-result`.
 *   • Генерация артефактов (async) — существующая таблица notebooklm_jobs. Расширение
 *     забирает джобу тем же `/poll` (claimTask) и по готовности шлёт файл в `/ingest`.
 *   • Присутствие расширения — notebooklm_ext_presence (питает плашку статуса вместо
 *     старого воркер-`/auth/status`).
 *
 * notebook_id в DOM нет: расширение выцарапывает /notebook/<uuid> из URL при создании
 * блокнота и рапортует его — completeAction пишет notebooklm_state.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import pool from '../../db/index.js';
import { createAsset, type MediaAsset } from '../media/assets.js';

const __dirname_b = path.dirname(fileURLToPath(import.meta.url));

/** Папка Галереи для артефактов Hotebook (вкладка «Hotebook»). */
export const HOTEBOOK_FOLDER = 'hotebook';
export const HOTEBOOK_DIR = path.resolve(__dirname_b, '../../../../uploads/hotebook');

/** Типы артефактов NotebookLM (совпадают с HB_TYPES на фронте). */
export const GEN_TYPES = ['audio', 'video', 'report', 'quiz', 'table', 'infographic', 'flashcards', 'mindmap', 'slides'] as const;
export type GenType = (typeof GEN_TYPES)[number];

export const RU_LABEL: Record<GenType, string> = {
  audio: 'Аудиопересказ', video: 'Видеообзор', report: 'Отчёт', quiz: 'Тест',
  table: 'Таблица', infographic: 'Инфографика', flashcards: 'Карточки',
  mindmap: 'Ментальная карта', slides: 'Презентация',
};

export const EXT_MEDIA: Record<string, string> = {
  '.mp3': 'audio', '.m4a': 'audio', '.wav': 'audio',
  '.mp4': 'video', '.webm': 'video',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image',
};
export const EXT_MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.md': 'text/markdown', '.json': 'application/json', '.csv': 'text/csv', '.html': 'text/html',
};

/** Расширение файла по имени/мим (для сохранения артефакта на диск). */
export function extOf(fileName: string | null, mime: string | null): string {
  const fromName = fileName ? path.extname(fileName).toLowerCase() : '';
  if (fromName && fromName.length <= 6) return fromName;
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

/** Сохранить base64-dataUrl артефакта в uploads/hotebook. */
export function saveHotebookDataUrl(dataUrl: string, id: string, extHint: string): { fileUrl: string; filePath: string; size: number; mime: string; ext: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('неверный dataUrl');
  const mime = m[1] || 'application/octet-stream';
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 16) throw new Error('пустой артефакт');
  const ext = extHint || extOf(null, mime);
  fs.mkdirSync(HOTEBOOK_DIR, { recursive: true });
  const name = `${id}${ext}`;
  const filePath = path.join(HOTEBOOK_DIR, name);
  fs.writeFileSync(filePath, buf);
  return { fileUrl: `/uploads/hotebook/${name}`, filePath, size: buf.length, mime, ext };
}

/**
 * Залить готовый артефакт (base64) в Галерею (folder='hotebook'). Аудио → kind='audio' (виден и в
 * «Видео → Аудио»). Используется и расширением (/ingest), и импортом готовых работ студии.
 */
// Тип работы студии → расширение/медиатип, когда mime/имя НЕ распознались. Подписанный
// googleusercontent-URL аудио/видео NotebookLM отдаётся как application/octet-stream и без имени →
// extOf вернул бы .bin и «file» (падало в «Видео» безымянным .bin). Раскладываем по gtype:
// аудиопересказ→Аудио, видеообзор→Видео, инфографика→Изображение.
const GTYPE_EXT: Record<string, string> = { audio: '.m4a', video: '.mp4', infographic: '.png', slides: '.pdf' };
const GTYPE_MEDIA: Record<string, string> = { audio: 'audio', video: 'video', infographic: 'image' };

export async function ingestHotebookArtifact(
  tenantId: string, opts: { dataUrl: string; fileName?: string | null; mime?: string | null; title?: string | null; gtype?: string }
): Promise<MediaAsset | null> {
  let ext = extOf(opts.fileName || null, opts.mime || null);
  if ((!ext || ext === '.bin') && opts.gtype && GTYPE_EXT[opts.gtype]) ext = GTYPE_EXT[opts.gtype]; // тип не распознан → по gtype
  const stored = saveHotebookDataUrl(opts.dataUrl, randomUUID(), ext);
  const mediaType = EXT_MEDIA[stored.ext] || (opts.gtype ? GTYPE_MEDIA[opts.gtype] : '') || 'file';
  return createAsset(tenantId, {
    kind: mediaType === 'audio' ? 'audio' : 'reference',
    mediaType,
    originalName: artifactFileName(opts.title || opts.fileName || null, opts.gtype || 'artifact', stored.ext),
    fileUrl: stored.fileUrl, filePath: stored.filePath, mime: EXT_MIME[stored.ext] || stored.mime, size: stored.size,
    folder: HOTEBOOK_FOLDER,
    origins: ['hotebook'],
  });
}

/** Имя файла артефакта в Галерее: «<Название> — <тип>.ext» либо «Hotebook — <тип> · дата.ext». */
export function artifactFileName(title: string | null | undefined, gtype: string, ext: string): string {
  const custom = String(title || '').trim();
  const label = RU_LABEL[gtype as GenType] || gtype;
  if (custom) return `${custom} — ${label}${ext}`;
  const when = new Date().toLocaleDateString('ru-RU');
  return `Hotebook — ${label} · ${when}${ext}`;
}

// ── Таблицы расширения (inline-init, как flow_ext_tasks) ─────────────────────
export async function ensureExtTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notebooklm_ext_actions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      flow_id TEXT,
      notebook_id TEXT,
      kind TEXT NOT NULL,
      payload JSONB,
      status TEXT NOT NULL DEFAULT 'queued',
      result JSONB,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_nlm_actions_tenant ON notebooklm_ext_actions(tenant_id, status, created_at)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notebooklm_ext_presence (
      tenant_id TEXT PRIMARY KEY,
      last_poll_at TIMESTAMPTZ,
      logged_in BOOLEAN DEFAULT false,
      notebook_open BOOLEAN DEFAULT false,
      updated_at TIMESTAMPTZ DEFAULT now()
    )`);
  // Кэш ПОСЛЕДНЕГО удачного списка блокнотов (per-tenant). Отдаём его, когда живой скрейп занят
  // генерацией / офлайн / пуст → лента не «пропадает» на перезагрузке и во время генерации.
  await pool.query(`ALTER TABLE notebooklm_ext_presence ADD COLUMN IF NOT EXISTS notebooks_cache JSONB`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notebooklm_ext_recon (
      tenant_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      url TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    )`);
}
ensureExtTables().catch((e) => console.warn('[notebooklm-ext] init таблиц:', (e as Error).message));

// ── Очередь синхронных действий ──────────────────────────────────────────────
export interface ExtAction { id: string; kind: string; payload: any; notebookId: string | null; flowId: string | null; }

/** Публичный роутер: положить действие в очередь (расширение его заберёт). */
export async function enqueueAction(
  tenantId: string, flowId: string | null, notebookId: string | null, kind: string, payload: any
): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO notebooklm_ext_actions (id, tenant_id, flow_id, notebook_id, kind, payload)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, tenantId, flowId, notebookId, kind, payload != null ? JSON.stringify(payload) : null]
  );
  return id;
}

/** Публичный роутер: дождаться результата действия (long-poll в рамках запроса). */
export async function waitAction(
  tenantId: string, actionId: string, timeoutMs: number
): Promise<{ ok: boolean; result: any; error: string | null }> {
  const deadline = Date.now() + timeoutMs;
  // Убеждаемся, что расширение вообще на связи — иначе не ждём весь таймаут зря.
  while (Date.now() < deadline) {
    const r = await pool.query(`SELECT status, result, error FROM notebooklm_ext_actions WHERE id=$1 AND tenant_id=$2`, [actionId, tenantId]);
    const row = r.rows[0];
    if (!row) return { ok: false, result: null, error: 'действие потеряно' };
    if (row.status === 'done') return { ok: true, result: row.result || {}, error: null };
    if (row.status === 'failed') return { ok: false, result: null, error: row.error || 'действие не выполнено' };
    await sleep(400);
  }
  // Таймаут: пометим действие как просроченное, чтобы оно не «висело» running.
  await pool.query(`UPDATE notebooklm_ext_actions SET status='failed', error=$2, updated_at=now() WHERE id=$1 AND status IN ('queued','running')`,
    [actionId, 'расширение не ответило вовремя (откройте NotebookLM и войдите)']).catch(() => {});
  return { ok: false, result: null, error: 'расширение не ответило вовремя' };
}

/** Расширение (`/poll`): атомарно забрать одно действие queued → running. */
export async function claimAction(tenantId: string): Promise<ExtAction | null> {
  const r = await pool.query(
    `UPDATE notebooklm_ext_actions SET status='running', updated_at=now()
      WHERE id IN (
        SELECT id FROM notebooklm_ext_actions
         WHERE tenant_id=$1 AND status='queued'
         ORDER BY created_at ASC LIMIT 1
         FOR UPDATE SKIP LOCKED
      ) RETURNING id, kind, payload, notebook_id, flow_id`,
    [tenantId]
  );
  const row = r.rows[0];
  if (!row) return null;
  return { id: row.id, kind: row.kind, payload: row.payload || {}, notebookId: row.notebook_id || null, flowId: row.flow_id || null };
}

/** Расширение (`/action-result`): записать результат действия. Для create-notebook — пишет state. */
export async function completeAction(
  tenantId: string, actionId: string, ok: boolean, result: any, error: string | null
): Promise<void> {
  const r = await pool.query(
    `UPDATE notebooklm_ext_actions SET status=$2, result=$3, error=$4, updated_at=now()
      WHERE id=$1 AND tenant_id=$5 RETURNING kind, flow_id, notebook_id`,
    [actionId, ok ? 'done' : 'failed', result != null ? JSON.stringify(result) : null, error, tenantId]
  );
  const row = r.rows[0];
  if (!row || !ok) return;
  // create-notebook → зафиксировать блокнот сценария.
  if (row.kind === 'create-notebook' && result?.notebookId && row.flow_id) {
    await pool.query(
      `INSERT INTO notebooklm_state (tenant_id, flow_id, notebook_id, title) VALUES ($1,$2,$3,$4)
       ON CONFLICT (tenant_id, flow_id) DO UPDATE SET notebook_id=EXCLUDED.notebook_id, title=EXCLUDED.title`,
      [tenantId, row.flow_id, String(result.notebookId), result.title || null]
    ).catch(() => {});
  }
  // Действия, вернувшие свежий список источников → обновить кэш в notebooklm_state.
  if (Array.isArray(result?.sources) && row.flow_id) {
    await pool.query(`UPDATE notebooklm_state SET sources=$3 WHERE tenant_id=$1 AND flow_id=$2`,
      [tenantId, row.flow_id, JSON.stringify(result.sources)]).catch(() => {});
  }
  // История чата блокнота → кэш (чтобы открытый блокнот сразу показал прошлый диалог).
  if (Array.isArray(result?.chat) && row.flow_id) {
    await pool.query(`UPDATE notebooklm_state SET chat=$3 WHERE tenant_id=$1 AND flow_id=$2`,
      [tenantId, row.flow_id, JSON.stringify(result.chat)]).catch(() => {});
  }
  // Подсказки-продолжения (чипы) → кэш (фронт покажет кнопками под чатом).
  if (Array.isArray(result?.suggestions) && row.flow_id) {
    await pool.query(`UPDATE notebooklm_state SET suggestions=$3 WHERE tenant_id=$1 AND flow_id=$2`,
      [tenantId, row.flow_id, JSON.stringify(result.suggestions)]).catch(() => {});
  }
  // Список ВСЕХ блокнотов (list-notebooks) → per-tenant кэш: лента переживёт офлайн/занятость/reload.
  if (row.kind === 'list-notebooks' && Array.isArray(result?.notebooks) && result.notebooks.length > 0) {
    await pool.query(`UPDATE notebooklm_ext_presence SET notebooks_cache=$2, updated_at=now() WHERE tenant_id=$1`,
      [tenantId, JSON.stringify(result.notebooks)]).catch(() => {});
  }
}

/** Последний удачный список блокнотов (кэш) — фолбэк, когда живой скрейп недоступен/пуст. */
export async function getCachedNotebooks(tenantId: string): Promise<any[]> {
  try {
    const r = await pool.query(`SELECT notebooks_cache FROM notebooklm_ext_presence WHERE tenant_id=$1`, [tenantId]);
    const c = r.rows[0]?.notebooks_cache;
    return Array.isArray(c) ? c : [];
  } catch { return []; }
}

// ── Клейм задач генерации (notebooklm_jobs) ──────────────────────────────────
export interface ExtTask { id: string; type: string; params: any; notebookId: string | null; title: string | null; }

/** Расширение (`/poll`): атомарно забрать одну джобу генерации queued/зависшую → running. */
export async function claimTask(tenantId: string): Promise<ExtTask | null> {
  const r = await pool.query(
    `UPDATE notebooklm_jobs j SET status='running'
      WHERE j.id IN (
        SELECT id FROM notebooklm_jobs
         WHERE tenant_id=$1
           AND flow_id IS NOT NULL -- наблюдаемые (flow_id NULL) НЕ раздаём как задачи генерации
           AND (status='queued' OR (status='running' AND created_at < now() - interval '15 minutes'))
         ORDER BY created_at ASC LIMIT 1
         FOR UPDATE SKIP LOCKED
      ) RETURNING j.id, j.type, j.params, j.flow_id, j.title`,
    [tenantId]
  );
  const row = r.rows[0];
  if (!row) return null;
  // notebook_id джобы — из notebooklm_state по flow_id.
  let notebookId: string | null = null;
  if (row.flow_id) {
    const s = await pool.query(`SELECT notebook_id FROM notebooklm_state WHERE tenant_id=$1 AND flow_id=$2`, [tenantId, row.flow_id]);
    notebookId = s.rows[0]?.notebook_id || null;
  }
  const params = { ...(row.params || {}), __name: row.title || undefined };
  return { id: row.id, type: row.type, params, notebookId, title: row.title || null };
}

// ── Присутствие расширения ───────────────────────────────────────────────────
export async function setPresence(tenantId: string, loggedIn: boolean, notebookOpen: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO notebooklm_ext_presence (tenant_id, last_poll_at, logged_in, notebook_open, updated_at)
     VALUES ($1, now(), $2, $3, now())
     ON CONFLICT (tenant_id) DO UPDATE SET last_poll_at=now(), logged_in=EXCLUDED.logged_in, notebook_open=EXCLUDED.notebook_open, updated_at=now()`,
    [tenantId, loggedIn, notebookOpen]
  ).catch(() => {});
}

/**
 * Статус подключения (для плашки). error_kind:
 *   'ext_offline' — расширение давно не выходило на связь (не установлено / браузер закрыт);
 *   'ext_login'   — расширение на связи, но не залогинено в notebook.google.com.
 */
export async function getConnectionStatus(tenantId: string): Promise<any> {
  try {
    const r = await pool.query(`SELECT last_poll_at, logged_in FROM notebooklm_ext_presence WHERE tenant_id=$1`, [tenantId]);
    const row = r.rows[0];
    // 150с (было 60с): во время генерации основной /poll занят задачей и не пингует присутствие,
    // но лёгкий /presence-хартбит по будильнику (~30с) держит last_poll_at свежим. Порог с запасом
    // на несколько пропущенных хартбитов, чтобы статус не мигал в ext_offline и списки не «пропадали».
    const online = !!row?.last_poll_at && (Date.now() - new Date(row.last_poll_at).getTime() < 150_000);
    const checkedAt = new Date().toISOString();
    if (!online) return { configured: true, ok: false, errorKind: 'ext_offline', email: null, error: null, checkedAt };
    if (!row.logged_in) return { configured: true, ok: false, errorKind: 'ext_login', email: null, error: null, checkedAt };
    return { configured: true, ok: true, errorKind: null, email: null, error: null, checkedAt };
  } catch (e: any) {
    return { configured: true, ok: false, errorKind: 'error', error: String(e?.message || e), checkedAt: new Date().toISOString() };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
