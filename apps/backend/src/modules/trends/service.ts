/**
 * TrendTraffic — сервис анализатора трендов (TikHub).
 *
 * scanTrends() сканирует тренды через TikHub, нормализует ответ (см.
 * tikhub_client.normalizeVideos — оборонительный разбор) и сохраняет найденные
 * видео в source_videos с дедупом по (tenant_id, platform, external_id).
 *
 * Ключ берётся через getEffectiveTikHubKey (Enterprise — свой, иначе платформенный).
 * Только PostgreSQL: в fallback-режиме запись деградирует (try/catch), но
 * нормализованные видео всё равно возвращаются вызывающему.
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import pool from '../../db/index.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';
import { searchVideos, type NormalizedVideo } from '../tikhub/tikhub_client.js';
import { TREND_PROVIDERS, isTrendPlatform, type TrendPlatform } from '../tikhub/providers.js';
import { shapeOf } from './analytics.js';

export type TrendKind = 'keyword' | 'trending';

export interface ScanParams {
  kind: TrendKind;
  query?: string;
  count?: number;
  region?: string;
  /** Источник трендов: tiktok | instagram | youtube | twitter | reddit. По умолчанию tiktok. */
  platform?: TrendPlatform;
  /** Расширенные фильтры площадки (youtube: sort_by/upload_time/duration; x: search_type; reddit: sort/time_range). */
  filters?: Record<string, string>;
  /** Тип поиска: video (web), general (web общий), app (App V3 с фильтрами). */
  mode?: 'video' | 'general' | 'app';
  /** Только для mode='app': 0 релевантность, 1 больше лайков, 2 новее. */
  sortType?: 0 | 1 | 2;
  /** Только для mode='app': 0 всё время, 1 24ч, 7 неделя, 30 месяц, 90 3мес, 180 6мес. */
  publishTime?: 0 | 1 | 7 | 30 | 90 | 180;
}

export interface StoredVideo {
  id: string | null;
  externalId: string;
  platform: string;
  author: string;
  authorName?: string;
  description?: string;
  coverUrl?: string;
  videoUrl?: string;
  webUrl?: string;
  durationSec?: number;
  stats: { play?: number; like?: number; comment?: number; share?: number };
  status: string;
  fileUrl?: string | null;
}

export interface ScanResult {
  trendId: string | null;
  count: number;
  videos: StoredVideo[];
  /** debug: верхнеуровневые ключи сырого ответа — помогает доводить нормализатор. */
  rawKeys: string[];
  /** true, если выбранный web-режим упал и мы молча переключились на App V3. */
  fellBackToApp?: boolean;
  /** Скелет структуры ответа (имена полей + типы) — показываем, когда ничего не распозналось. */
  shape?: any;
}

function num(v: any): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function mapRow(r: any): StoredVideo {
  return {
    id: r.id,
    externalId: r.external_id,
    platform: r.platform,
    author: r.author,
    authorName: r.author_name || undefined,
    description: r.description || undefined,
    coverUrl: r.cover_url || undefined,
    videoUrl: r.video_url || undefined,
    webUrl: r.web_url || undefined,
    durationSec: r.duration_sec ?? undefined,
    stats: { play: num(r.play_count), like: num(r.like_count), comment: num(r.comment_count), share: num(r.share_count) },
    status: r.status,
    fileUrl: r.file_url || null,
  };
}

/** Сканирует тренды и сохраняет видео. Бросает понятную ошибку при проблемах с ключом/TikHub. */
export async function scanTrends(tenantId: string, params: ScanParams): Promise<ScanResult> {
  const key = await getEffectiveTikHubKey(tenantId);
  if (!key) {
    throw new Error('Ключ Trend не задан. Укажите платформенный ключ в админке или свой в настройках Enterprise.');
  }

  const platform: TrendPlatform = isTrendPlatform(params.platform) ? params.platform : 'tiktok';
  const provider = TREND_PROVIDERS[platform];
  const count = Math.min(Math.max(params.count ?? 20, 1), 30);
  let resp;
  let fellBackToApp = false;
  if (params.kind === 'keyword') {
    const q = (params.query || '').trim();
    if (!q) throw new Error('Укажите ключевое слово для поиска.');
    if (platform === 'tiktok') {
      // App-поиск всегда тянет по релевантности (опечатко-устойчивый матч). Чтобы
      // «Новее»/«Больше лайков» пересортировывались осмысленно, тянем ПОЛНЫЙ пул
      // (одна оплата за запрос — count не влияет на цену), потом режем до count.
      const fetchCount = params.mode === 'app' ? 30 : count;
      resp = await searchVideos(key, q, { count: fetchCount, mode: params.mode, publishTime: params.publishTime });
      // Web-эндпоинты (Видео/Общий) периодически нестабильны — молча падаем на App V3.
      if (!resp.ok && params.mode !== 'app') {
        const fb = await searchVideos(key, q, { count: 30, mode: 'app', publishTime: params.publishTime });
        if (fb.ok) { resp = fb; fellBackToApp = true; }
      }
    } else {
      resp = await provider.search(key, q, { count, filters: params.filters });
    }
  } else {
    if (!provider.hasTrending) {
      throw new Error('У этой площадки нет ленты «Горячее» — переключитесь на «По ключевику».');
    }
    resp = await provider.trending(key, { count });
  }

  if (!resp.ok) {
    throw new Error(`Trend вернул ошибку: ${resp.error || `HTTP ${resp.status}`}`);
  }

  // Клиентская сортировка (для TikTok app-поиска): 2 — новее, 1 — больше лайков, 0 — как есть.
  let normalized: NormalizedVideo[] = provider.normalize(resp.data);
  if (params.kind === 'keyword' && params.sortType === 2) {
    normalized = [...normalized].sort((a, b) => (b.createTime ?? 0) - (a.createTime ?? 0));
  } else if (params.kind === 'keyword' && params.sortType === 1) {
    normalized = [...normalized].sort((a, b) => (b.stats.like ?? 0) - (a.stats.like ?? 0));
  }
  // Честный «Кол-во»: web-эндпоинты игнорируют count и отдают свою страницу,
  // app-режим мы намеренно перетянули пулом — обрезаем до запрошенного числа.
  const videos: NormalizedVideo[] = normalized.slice(0, count);
  const rawKeys = resp.data && typeof resp.data === 'object'
    ? Object.keys((resp.data as any).data && typeof (resp.data as any).data === 'object' ? (resp.data as any).data : resp.data)
    : [];

  // Запись журнала скана (best-effort).
  let trendId: string | null = randomUUID();
  try {
    await pool.query(
      `INSERT INTO trends (id, tenant_id, platform, query_kind, query_value, region, result_count, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [trendId, tenantId, platform, params.kind, params.query || null, params.region || null, videos.length, JSON.stringify(resp.data ?? null)]
    );
  } catch (e) {
    console.warn('[trends] не удалось записать trend (fallback?):', (e as Error).message);
    trendId = null;
  }

  // Апсерт видео (дедуп по уникальному индексу).
  const stored: StoredVideo[] = [];
  for (const v of videos) {
    try {
      const r = await pool.query(
        `INSERT INTO source_videos
           (id, tenant_id, trend_id, platform, external_id, author, author_name, description,
            cover_url, video_url, web_url, duration_sec, play_count, like_count, comment_count, share_count, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (tenant_id, platform, external_id) DO UPDATE SET
           trend_id = EXCLUDED.trend_id,
           author = EXCLUDED.author,
           author_name = EXCLUDED.author_name,
           description = EXCLUDED.description,
           cover_url = EXCLUDED.cover_url,
           video_url = EXCLUDED.video_url,
           web_url = EXCLUDED.web_url,
           duration_sec = EXCLUDED.duration_sec,
           play_count = EXCLUDED.play_count,
           like_count = EXCLUDED.like_count,
           comment_count = EXCLUDED.comment_count,
           share_count = EXCLUDED.share_count,
           payload = EXCLUDED.payload,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, platform, external_id, author, author_name, description, cover_url, video_url,
                   web_url, duration_sec, play_count, like_count, comment_count, share_count, status, file_url`,
        [
          randomUUID(), tenantId, trendId, v.platform, v.externalId, v.author, v.authorName || null,
          v.description || null, v.coverUrl || null, v.videoUrl || null, v.webUrl || null,
          v.durationSec ?? null, v.stats.play ?? null, v.stats.like ?? null, v.stats.comment ?? null,
          v.stats.share ?? null, JSON.stringify(v.raw ?? null),
        ]
      );
      stored.push(mapRow(r.rows[0]));
    } catch (e) {
      // Не падаем на одном видео — возвращаем нормализованное без БД-id.
      console.warn('[trends] upsert видео не удался:', (e as Error).message);
      stored.push({
        id: null, externalId: v.externalId, platform: v.platform, author: v.author,
        authorName: v.authorName, description: v.description, coverUrl: v.coverUrl,
        videoUrl: v.videoUrl, webUrl: v.webUrl, durationSec: v.durationSec, stats: v.stats,
        status: 'discovered', fileUrl: null,
      });
    }
  }

  const shape = videos.length === 0 ? shapeOf(resp.data) : undefined;
  if (videos.length === 0) {
    try { console.log(`[TREND_SHAPE] scan ${platform}/${params.kind} ${JSON.stringify(shape).slice(0, 6000)}`); } catch { /* */ }
  }
  return { trendId, count: videos.length, videos: stored, rawKeys, fellBackToApp, shape };
}

export async function listRecentVideos(tenantId: string, limit = 60, downloadedOnly = false): Promise<StoredVideo[]> {
  const lim = Math.min(Math.max(limit, 1), 500);
  const where = downloadedOnly ? `AND status = 'downloaded' AND file_url IS NOT NULL` : '';
  try {
    const r = await pool.query(
      `SELECT id, platform, external_id, author, author_name, description, cover_url, video_url,
              web_url, duration_sec, play_count, like_count, comment_count, share_count, status, file_url
       FROM source_videos WHERE tenant_id = $1 ${where} ORDER BY created_at DESC LIMIT $2`,
      [tenantId, lim]
    );
    return (r.rows as any[]).map(mapRow);
  } catch {
    return [];
  }
}

/** Удаляет видео: стирает файл с диска (если скачан) и строку из БД. */
export async function deleteVideo(tenantId: string, id: string): Promise<boolean> {
  // 1. Файл с диска — best-effort и ИЗОЛИРОВАННО: ошибка чтения file_path не должна
  //    мешать удалению строки (раньше SELECT и DELETE были в одном try → сбой SELECT
  //    тихо отменял DELETE, и видео «воскресало» после перезагрузки).
  try {
    const r = await pool.query(`SELECT file_path FROM source_videos WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    const fp = r.rows[0]?.file_path;
    if (fp) { try { fs.unlinkSync(fp); } catch { /* файла может не быть */ } }
  } catch (e) {
    console.warn('[trends] deleteVideo: чтение file_path не удалось (продолжаем):', (e as Error).message);
  }
  // 2. Удаление строки — КРИТИЧНО, со своей обработкой ошибок.
  try {
    const d = await pool.query(`DELETE FROM source_videos WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return (d.rowCount || 0) > 0;
  } catch (e) {
    console.warn('[trends] deleteVideo: DELETE не удался:', (e as Error).message);
    return false;
  }
}

/** Массовое удаление. Возвращает число удалённых. */
export async function deleteVideos(tenantId: string, ids: string[]): Promise<number> {
  let n = 0;
  for (const id of ids) { if (await deleteVideo(tenantId, id)) n++; }
  return n;
}

export async function getVideo(tenantId: string, id: string): Promise<any | null> {
  try {
    const r = await pool.query(`SELECT * FROM source_videos WHERE tenant_id = $1 AND id = $2 LIMIT 1`, [tenantId, id]);
    return (r.rows as any[])[0] || null;
  } catch {
    return null;
  }
}

export async function setVideoStatus(
  tenantId: string,
  id: string,
  patch: { status?: string; fileUrl?: string | null; filePath?: string | null; error?: string | null }
): Promise<void> {
  try {
    await pool.query(
      `UPDATE source_videos
       SET status = COALESCE($3, status),
           file_url = COALESCE($4, file_url),
           file_path = COALESCE($5, file_path),
           error = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id, patch.status ?? null, patch.fileUrl ?? null, patch.filePath ?? null, patch.error ?? null]
    );
  } catch (e) {
    console.warn('[trends] setVideoStatus failed:', (e as Error).message);
  }
}
