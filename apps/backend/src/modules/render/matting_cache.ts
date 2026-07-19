/**
 * Кэш ИИ-вырезки фона (Replicate robust_video_matting): одно и то же видео-аватар
 * вырезается ОДИН раз — повторные сборки (в т.ч. в разных роликах) переиспользуют
 * готовый альфа-webm без нового запроса к Replicate (экономия центов и минут).
 *
 * Ключ: tenant + sha256 БАЙТОВ исходника (не URL — одно видео под разными URL).
 * Отпечаток ключа Replicate НЕ нужен: результат — наш локальный файл, не сущность
 * в чужом аккаунте (в отличие от heygen_talking_photos).
 *
 * Валидность: файл должен существовать на диске (рендеры могут чиститься) —
 * пропавший файл = промах кэша, вырезка перегоняется и строка обновляется.
 * Ошибки БД не валят сборку (fail-open) — поведение как без кэша.
 */
import { createHash } from 'crypto';
import fs from 'fs';
import pool from '../../db/index.js';

// ── Таблица (inline-init, как heygen_talking_photos) ────────────────────────
let tablesReady: Promise<void> | null = null;
async function ensureTables(): Promise<void> {
  if (tablesReady) return tablesReady;
  tablesReady = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ugc_matting_cache (
        tenant_id  TEXT NOT NULL,
        video_sha  TEXT NOT NULL,
        file_path  TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (tenant_id, video_sha)
      )`);
  })();
  tablesReady.catch(() => { tablesReady = null; });
  return tablesReady;
}
ensureTables().catch((e) => console.warn('[matting-cache] init таблицы:', (e as Error).message));

/** sha256 файла (потоково — исходники бывают десятки МБ). */
export function fileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    fs.createReadStream(filePath)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

/** Готовый альфа-webm для этого исходника, если он ещё жив на диске. */
export async function getCachedMatting(tenantId: string, sha: string): Promise<string | null> {
  try {
    await ensureTables();
    const r = await pool.query(
      'SELECT file_path FROM ugc_matting_cache WHERE tenant_id=$1 AND video_sha=$2',
      [tenantId, sha]);
    const p = r.rows?.[0]?.file_path || null;
    return p && fs.existsSync(p) ? p : null;
  } catch (e) { console.warn('[matting-cache] read:', (e as Error).message); return null; }
}

export async function putCachedMatting(tenantId: string, sha: string, filePath: string): Promise<void> {
  try {
    await ensureTables();
    await pool.query(
      `INSERT INTO ugc_matting_cache (tenant_id, video_sha, file_path) VALUES ($1,$2,$3)
       ON CONFLICT (tenant_id, video_sha) DO UPDATE SET file_path = EXCLUDED.file_path, created_at = now()`,
      [tenantId, sha, filePath]);
  } catch (e) { console.warn('[matting-cache] write:', (e as Error).message); }
}
