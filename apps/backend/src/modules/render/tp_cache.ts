/**
 * Кэш HeyGen talking_photo_id в БД: одно и то же фото грузится в HeyGen ОДИН раз за всю
 * жизнь, повторные сборки переиспользуют готовый фото-аватар (текст/озвучка передаются
 * отдельно на каждый рендер — аватар от этого не меняется).
 *
 * Зачем: тарифы HeyGen ограничивают ЧИСЛО ХРАНИМЫХ фото-аватаров в аккаунте (у базового —
 * 3); раньше каждый клик «Создать видео» заливал фото заново и выедал слот
 * («You have exceeded your limit of 3 photo avatars»).
 *
 * Ключ: tenant + sha256 БАЙТОВ фото (не URL — одно фото под разными URL) + отпечаток
 * HeyGen-ключа (talking_photo_id живёт в конкретном аккаунте HeyGen; смена ключа = другой
 * аккаунт, старые id там не существуют). Сам ключ в БД не храним — только хэш-отпечаток.
 * Ошибки БД не валят сборку (fail-open): промах кэша = поведение как раньше.
 */
import { createHash } from 'crypto';
import pool from '../../db/index.js';

// ── Таблица (inline-init, как heygen_ext_tasks) ─────────────────────────────
let tablesReady: Promise<void> | null = null;
async function ensureTables(): Promise<void> {
  if (tablesReady) return tablesReady;
  tablesReady = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS heygen_talking_photos (
        tenant_id        TEXT NOT NULL,
        photo_sha        TEXT NOT NULL,
        key_fp           TEXT NOT NULL,
        talking_photo_id TEXT NOT NULL,
        created_at       TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (tenant_id, photo_sha, key_fp)
      )`);
  })();
  // Транзиентный обрыв БД не должен навсегда заклинить модуль — пробуем заново.
  tablesReady.catch(() => { tablesReady = null; });
  return tablesReady;
}
ensureTables().catch((e) => console.warn('[tp-cache] init таблицы:', (e as Error).message));

/** sha256 содержимого фото — стабильный идентификатор картинки. */
export const photoSha = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

/** Отпечаток ключа HeyGen (различаем аккаунты, сам ключ не сохраняем). */
export const hgKeyFp = (apiKey: string): string => createHash('sha256').update(apiKey).digest('hex').slice(0, 16);

export async function getCachedTp(tenantId: string, sha: string, fp: string): Promise<string | null> {
  try {
    await ensureTables();
    const r = await pool.query(
      'SELECT talking_photo_id FROM heygen_talking_photos WHERE tenant_id=$1 AND photo_sha=$2 AND key_fp=$3',
      [tenantId, sha, fp]);
    return r.rows?.[0]?.talking_photo_id || null;
  } catch (e) { console.warn('[tp-cache] read:', (e as Error).message); return null; }
}

export async function putCachedTp(tenantId: string, sha: string, fp: string, tpId: string): Promise<void> {
  try {
    await ensureTables();
    await pool.query(
      `INSERT INTO heygen_talking_photos (tenant_id, photo_sha, key_fp, talking_photo_id) VALUES ($1,$2,$3,$4)
       ON CONFLICT (tenant_id, photo_sha, key_fp) DO UPDATE SET talking_photo_id = EXCLUDED.talking_photo_id`,
      [tenantId, sha, fp, tpId]);
  } catch (e) { console.warn('[tp-cache] write:', (e as Error).message); }
}

/** Выкинуть протухшую запись (аватар удалили в кабинете HeyGen) — перезальём заново. */
export async function dropCachedTp(tenantId: string, sha: string, fp: string): Promise<void> {
  try {
    await ensureTables();
    await pool.query(
      'DELETE FROM heygen_talking_photos WHERE tenant_id=$1 AND photo_sha=$2 AND key_fp=$3',
      [tenantId, sha, fp]);
  } catch (e) { console.warn('[tp-cache] drop:', (e as Error).message); }
}
