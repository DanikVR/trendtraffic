/**
 * Каналы — Фаза 2: отслеживаемые каналы (watchlist) + история метрик и дельты.
 *
 * Идея: канал из watchlist периодически (ночью + по кнопке «Обновить сейчас»)
 * пере-анализируется через analyzeChannel; при обновлении ТЕКУЩИЕ метрики видео/канала
 * сдвигаются в prev_* (для мгновенной дельты «было→стало»), и пишется снимок в *_metric_snapshots
 * (полная история по датам — для будущих графиков).
 *
 * Дельта = текущее − prev_* (изменение со времени ПРЕДЫДУЩЕГО обновления). На самом
 * первом обновлении prev = NULL (дельты ещё нет — это база). Так и есть по природе данных:
 * историю можно начать копить только с момента старта отслеживания.
 */

import pool from '../../db/index.js';
import { analyzeChannel, detectChannel } from './service.js';

export interface WatchedChannel {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  url: string | null;
  verified: boolean;
  followers: number | null;
  prevFollowers: number | null;
  videosCount: number;
  enabled: boolean;
  lastRefreshedAt: string | null;
  prevRefreshedAt: string | null;
  lastError: string | null;
}
export interface WatchedVideo {
  externalId: string;
  platform: string;
  isShort: boolean | null;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
  webUrl: string | null;
  durationSec: number | null;
  createTime: number | null;
  stats: { play: number | null; like: number | null; comment: number | null; share: number | null };
  prev: { play: number | null; like: number | null; comment: number | null; share: number | null };
  prevSnapshotAt: string | null;
}

function mapChannel(r: any): WatchedChannel {
  return {
    id: r.id, platform: r.platform, handle: r.handle,
    displayName: r.display_name, avatarUrl: r.avatar_url, url: r.url,
    verified: !!r.verified,
    followers: r.followers == null ? null : Number(r.followers),
    prevFollowers: r.prev_followers == null ? null : Number(r.prev_followers),
    videosCount: r.videos_count ?? 0,
    enabled: !!r.enabled,
    lastRefreshedAt: r.last_refreshed_at ? new Date(r.last_refreshed_at).toISOString() : null,
    prevRefreshedAt: r.prev_refreshed_at ? new Date(r.prev_refreshed_at).toISOString() : null,
    lastError: r.last_error || null,
  };
}
const bn = (v: any): number | null => (v == null ? null : Number(v));
/** Целое для INT/BIGINT-колонок: округляем (Instagram отдаёт дробную длительность видео,
 *  напр. 70.008 → 70). Иначе Postgres падает «invalid input syntax for type integer». */
const I = (v: any): number | null => { if (v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) ? n : null; };

/** Список отслеживаемых каналов тенанта (со сводными дельтами подписчиков). */
export async function listWatchedChannels(tenantId: string): Promise<WatchedChannel[]> {
  const res = await pool.query(`SELECT * FROM watched_channels WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]);
  return res.rows.map(mapChannel);
}

/** Канал + его видео с метриками и предыдущими значениями (фронт считает дельту). */
export async function getWatchedChannel(tenantId: string, channelId: string): Promise<{ channel: WatchedChannel; videos: WatchedVideo[] } | null> {
  const c = await pool.query(`SELECT * FROM watched_channels WHERE id = $1 AND tenant_id = $2`, [channelId, tenantId]);
  if (!c.rows[0]) return null;
  const v = await pool.query(
    `SELECT * FROM channel_videos WHERE channel_id = $1 AND tenant_id = $2 ORDER BY play_count DESC NULLS LAST LIMIT 500`,
    [channelId, tenantId]
  );
  const videos: WatchedVideo[] = v.rows.map((r: any) => ({
    externalId: r.external_id, platform: r.platform, isShort: r.is_short ?? null, author: r.author_name || r.author,
    description: r.description, coverUrl: r.cover_url, webUrl: r.web_url,
    durationSec: r.duration_sec, createTime: r.create_time == null ? null : Number(r.create_time),
    stats: { play: bn(r.play_count), like: bn(r.like_count), comment: bn(r.comment_count), share: bn(r.share_count) },
    prev: { play: bn(r.prev_play_count), like: bn(r.prev_like_count), comment: bn(r.prev_comment_count), share: bn(r.prev_share_count) },
    prevSnapshotAt: r.prev_snapshot_at ? new Date(r.prev_snapshot_at).toISOString() : null,
  }));
  return { channel: mapChannel(c.rows[0]), videos };
}

export async function removeWatchedChannel(tenantId: string, channelId: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM watched_channels WHERE id = $1 AND tenant_id = $2`, [channelId, tenantId]);
  return (r.rowCount ?? 0) > 0;
}

/** Добавить канал в watchlist (по ссылке) и сразу собрать базовый снимок. */
export async function addWatchedChannel(tenantId: string, url: string): Promise<WatchedChannel> {
  const det = detectChannel(url);
  if (!det) throw new Error('Не распознал ссылку на канал (TikTok/Instagram/YouTube).');
  const existing = await pool.query(
    `SELECT id FROM watched_channels WHERE tenant_id = $1 AND platform = $2 AND handle = $3`,
    [tenantId, det.platform, det.handle]
  );
  let channelId: string;
  if (existing.rows[0]) {
    channelId = existing.rows[0].id;
  } else {
    const ins = await pool.query(
      `INSERT INTO watched_channels (tenant_id, platform, handle, url) VALUES ($1,$2,$3,$4) RETURNING id`,
      [tenantId, det.platform, det.handle, url]
    );
    channelId = ins.rows[0].id;
  }
  await refreshWatchedChannel(tenantId, channelId);   // первый сбор = база (дельт ещё нет)
  const c = await pool.query(`SELECT * FROM watched_channels WHERE id = $1`, [channelId]);
  return mapChannel(c.rows[0]);
}

/**
 * Пере-собрать ОДИН канал: analyzeChannel → сдвинуть current→prev по каналу и каждому видео,
 * записать новые значения + снимок дня. Используется кнопкой «Обновить сейчас» и планировщиком.
 */
export async function refreshWatchedChannel(tenantId: string, channelId: string): Promise<{ ok: boolean; videos: number; error?: string }> {
  const c = await pool.query(`SELECT * FROM watched_channels WHERE id = $1 AND tenant_id = $2`, [channelId, tenantId]);
  const row = c.rows[0];
  if (!row) throw new Error('Канал не найден.');
  const url = row.url || `https://www.${row.platform === 'youtube' ? 'youtube.com/channel/' : (row.platform + '.com/@')}${row.handle}`;

  let analysis;
  try {
    analysis = await analyzeChannel(tenantId, url, { maxVideos: 150 });
  } catch (err: any) {
    // На сбое тоже двигаем last_refreshed_at, чтобы планировщик не дёргал канал каждый
    // час (иначе при стойкой ошибке — тугой ретрай-цикл, жгущий ключ). Ручная кнопка работает.
    await pool.query(`UPDATE watched_channels SET last_error = $1, last_refreshed_at = NOW(), updated_at = NOW() WHERE id = $2`, [String(err?.message || err).slice(0, 400), channelId]);
    return { ok: false, videos: 0, error: err?.message || String(err) };
  }

  const p = analysis.profile;
  const totalViews = analysis.videos.reduce((a, v) => a + (v.stats.play || 0), 0);
  const totalLikes = analysis.videos.reduce((a, v) => a + (v.stats.like || 0), 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Канал: current → prev (followers + время), запись новых значений.
    await client.query(
      `UPDATE watched_channels SET
         prev_followers = followers,
         prev_refreshed_at = last_refreshed_at,
         followers = $1, display_name = COALESCE($2, display_name), avatar_url = COALESCE($3, avatar_url),
         verified = $4, videos_count = $5, last_error = NULL,
         last_refreshed_at = NOW(), updated_at = NOW()
       WHERE id = $6`,
      [I(p.followers), p.displayName ?? null, p.avatarUrl ?? null, !!p.verified, analysis.videos.length, channelId]
    );
    // Видео: upsert с переносом current→prev; + снимок дня для каждого.
    for (const v of analysis.videos) {
      const up = await client.query(
        `INSERT INTO channel_videos
           (tenant_id, channel_id, platform, external_id, author, author_name, description, cover_url, web_url,
            duration_sec, create_time, play_count, like_count, comment_count, share_count, is_short, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, NOW())
         ON CONFLICT (channel_id, external_id) DO UPDATE SET
           prev_play_count = channel_videos.play_count,
           prev_like_count = channel_videos.like_count,
           prev_comment_count = channel_videos.comment_count,
           prev_share_count = channel_videos.share_count,
           prev_snapshot_at = channel_videos.last_seen_at,
           play_count = EXCLUDED.play_count, like_count = EXCLUDED.like_count,
           comment_count = EXCLUDED.comment_count, share_count = EXCLUDED.share_count,
           is_short = EXCLUDED.is_short,
           description = COALESCE(EXCLUDED.description, channel_videos.description),
           cover_url = COALESCE(EXCLUDED.cover_url, channel_videos.cover_url),
           web_url = COALESCE(EXCLUDED.web_url, channel_videos.web_url),
           duration_sec = COALESCE(EXCLUDED.duration_sec, channel_videos.duration_sec),
           last_seen_at = NOW()
         RETURNING id`,
        [tenantId, channelId, v.platform, v.externalId, v.author ?? null, v.authorName ?? null, v.description ?? null,
         v.coverUrl ?? null, v.webUrl ?? null, I(v.durationSec), I(v.createTime),
         I(v.stats.play), I(v.stats.like), I(v.stats.comment), I(v.stats.share), v.isShort ?? null]
      );
      const vid = up.rows[0].id;
      await client.query(
        `INSERT INTO video_metric_snapshots (tenant_id, channel_id, video_id, snapshot_date, play_count, like_count, comment_count, share_count)
         VALUES ($1,$2,$3, CURRENT_DATE, $4,$5,$6,$7)
         ON CONFLICT (video_id, snapshot_date) DO UPDATE SET
           play_count = EXCLUDED.play_count, like_count = EXCLUDED.like_count,
           comment_count = EXCLUDED.comment_count, share_count = EXCLUDED.share_count`,
        [tenantId, channelId, vid, I(v.stats.play), I(v.stats.like), I(v.stats.comment), I(v.stats.share)]
      );
    }
    // Снимок канала за день.
    await client.query(
      `INSERT INTO channel_metric_snapshots (tenant_id, channel_id, snapshot_date, followers, videos_count, total_views, total_likes)
       VALUES ($1,$2, CURRENT_DATE, $3,$4,$5,$6)
       ON CONFLICT (channel_id, snapshot_date) DO UPDATE SET
         followers = EXCLUDED.followers, videos_count = EXCLUDED.videos_count,
         total_views = EXCLUDED.total_views, total_likes = EXCLUDED.total_likes`,
      [tenantId, channelId, I(p.followers), analysis.videos.length, I(totalViews), I(totalLikes)]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { ok: true, videos: analysis.videos.length };
}

/**
 * Планировщик: пере-собрать все каналы, у которых включено авто-обновление и которые
 * не обновлялись > ~20ч (т.е. раз в сутки). Идём по тенантам, последовательно, с паузой —
 * щадим ключи TikHub. Потолок за тик, чтобы не выгрести квоту разом.
 */
export async function refreshDueChannels(maxPerRun = 20): Promise<{ refreshed: number; failed: number }> {
  let refreshed = 0, failed = 0;
  const due = await pool.query(
    `SELECT id, tenant_id FROM watched_channels
     WHERE enabled = true AND (last_refreshed_at IS NULL OR last_refreshed_at < NOW() - INTERVAL '20 hours')
     ORDER BY last_refreshed_at ASC NULLS FIRST
     LIMIT $1`,
    [maxPerRun]
  );
  for (const r of due.rows) {
    try {
      const res = await refreshWatchedChannel(r.tenant_id, r.id);
      if (res.ok) refreshed++; else failed++;
    } catch (err) {
      failed++;
      console.warn(`[channels-scheduler] refresh ${r.id} failed:`, (err as any)?.message || err);
      // Бэк-офф и приброшенной ошибке (напр. сбой транзакции): двигаем last_refreshed_at,
      // чтобы не ретраить канал каждый тик. Ошибка одного канала не валит весь проход.
      try { await pool.query(`UPDATE watched_channels SET last_error = $1, last_refreshed_at = NOW(), updated_at = NOW() WHERE id = $2`, [String((err as any)?.message || err).slice(0, 400), r.id]); } catch { /* best-effort */ }
    }
    await new Promise((res) => setTimeout(res, 1500));   // пауза между каналами
  }
  if (due.rows.length) console.log(`[channels-scheduler] tick: due=${due.rows.length} refreshed=${refreshed} failed=${failed}`);
  return { refreshed, failed };
}
