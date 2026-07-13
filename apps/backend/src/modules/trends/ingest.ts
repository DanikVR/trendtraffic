/**
 * TrendTraffic — ingestTrendVideo: «скачать тренд + проанализировать» одним вызовом.
 *
 * Вынос логики POST /api/social-ext/to-gallery в переиспользуемый сервис: тот же
 * код обслуживает и кнопку «Добавить в галерею» (HTTP-роут стал обёрткой), и
 * автопилот трендов (modules/trends/autopilot.ts), которому браузер недоступен.
 *
 * Цепочка: TikHub-разбор ссылки (analyzeUrl) → прямые CDN-ссылки → СКАЧИВАНИЕ файла
 * на диск (uploads/source-videos, hotlink не живёт — ссылки TikTok истекают) →
 * media_assets (folder='analyzed', «Из анализа») → TrendDNA (Claude, текстовые
 * сигналы) → покадровый Gemini-видеоанализ (video_insight) → video_analyses.
 *
 * awaitAnalysis: false (кнопка) — анализ fire-and-forget, ответ мгновенный;
 *                true (автопилот) — ждём анализ, возвращаем analysisId/dna.
 */

import { analyzeUrl, detectUrl } from './analytics.js';
import { generateTrendDNA, saveTrendDNA, applyVisualInsight, type TrendDNA, type StoredTrendDNA } from './dna.js';
import { analyzeVideoVisual } from './video_insight.js';
import { saveAnalysisArtifacts } from './analysis_files.js';
import { extractDownloadUrls, extractTwitterVideoUrls } from '../tikhub/tikhub_client.js';
import { downloadVideoToDisk } from '../media/store_video.js';
import { createAsset, ANALYZED_FOLDER, type MediaAsset } from '../media/assets.js';

export const REFERER_BY_PLATFORM: Record<string, string> = {
  tiktok: 'https://www.tiktok.com/', douyin: 'https://www.douyin.com/',
  instagram: 'https://www.instagram.com/', twitter: 'https://x.com/', bilibili: 'https://www.bilibili.com/',
};

export interface IngestResult {
  ok: true;
  fileUrl: string;
  asset: MediaAsset | null;
  platform: string;
  videoId: string;
  /** Заполнены только при awaitAnalysis: true. */
  analysis?: StoredTrendDNA | null;
  dna?: TrendDNA | null;
  /** Причина, по которой анализ не получился (сам файл при этом скачан). */
  analysisError?: string;
}

/** Ошибка с HTTP-статусом — роут-обёртка отдаёт её как раньше. */
export class IngestError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/**
 * Скачивает трендовое видео в Галерею («Из анализа») и строит анализ.
 * Бросает IngestError с понятным статусом (400/422/502) при невозможности скачать.
 */
export async function ingestTrendVideo(
  tenantId: string,
  url: string,
  opts?: { awaitAnalysis?: boolean; lang?: string },
): Promise<IngestResult> {
  const clean = String(url || '').trim();
  if (!clean) throw new IngestError(400, 'Передайте ссылку в поле url.');
  const det = detectUrl(clean);
  if (det?.platform === 'youtube') {
    // YouTube-скачивание отключено (подпись потоков TikHub ненадёжна).
    throw new IngestError(400, 'Скачивание YouTube недоступно.');
  }

  const result: any = await analyzeUrl(tenantId, clean);
  let dlUrls = extractDownloadUrls(result?.blocks?.video?.data);
  if (!dlUrls.length && (result?.detected?.platform || det?.platform) === 'twitter') {
    dlUrls = extractTwitterVideoUrls(result?.blocks?.video?.data);
  }
  if (!dlUrls.length) throw new IngestError(422, 'Не удалось получить прямую ссылку на видео для этой платформы.');

  const platform: string = result?.detected?.platform || det?.platform || 'tiktok';
  const vid: string = String(result?.detected?.videoId || det?.videoId || 'video');
  const stored = await downloadVideoToDisk(dlUrls, { referer: REFERER_BY_PLATFORM[platform] || REFERER_BY_PLATFORM.tiktok });

  const asset = await createAsset(tenantId, {
    kind: 'reference', mediaType: 'video',
    originalName: `${platform}-${vid}.mp4`,
    fileUrl: stored.mediaUrl, filePath: stored.filePath, mime: stored.mime, size: stored.size,
    folder: ANALYZED_FOLDER, // из аналитики → папка «Из анализа»
  });

  // Анализ: текстовая ДНК (Claude) + покадровый видеоанализ (Gemini, по скачанному
  // файлу) → video_analyses с привязкой к ассету. Best-effort: файл уже скачан.
  const buildAnalysis = async (): Promise<{ saved: StoredTrendDNA | null; dna: TrendDNA }> => {
    let dna = await generateTrendDNA(tenantId, {
      summary: result.summary, comments: result.normalized?.comments, keywords: result.normalized?.keywords,
      platform, sourceUrl: clean, lang: opts?.lang,
    });
    const visual = await analyzeVideoVisual(tenantId, stored.filePath);
    if (visual) dna = applyVisualInsight(dna, visual);
    const saved = await saveTrendDNA(tenantId, {
      mediaAssetId: asset?.id, platform, externalId: vid, sourceUrl: clean, dna,
    });
    // Пакет отдельных файлов для «Медиафайлы → Аналитика»: разбор .md + субтитры .srt.
    await saveAnalysisArtifacts(tenantId, { platform, videoId: vid, dna, sourceUrl: clean });
    return { saved, dna };
  };

  if (opts?.awaitAnalysis) {
    try {
      const { saved, dna } = await buildAnalysis();
      return { ok: true, fileUrl: stored.mediaUrl, asset, platform, videoId: vid, analysis: saved, dna };
    } catch (e) {
      return { ok: true, fileUrl: stored.mediaUrl, asset, platform, videoId: vid, analysis: null, dna: null, analysisError: (e as Error).message };
    }
  }

  void (async () => {
    try { await buildAnalysis(); }
    catch (e) { console.warn('[trends/ingest] анализ не построился:', (e as Error).message); }
  })();
  return { ok: true, fileUrl: stored.mediaUrl, asset, platform, videoId: vid };
}
