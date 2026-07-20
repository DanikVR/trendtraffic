/**
 * TrendTraffic — HTTP-роутер анализатора трендов.
 *
 *  POST /api/trends/scan              — сканировать тренды (keyword|trending) → сохранить видео
 *  GET  /api/trends/videos            — список найденных видео тенанта
 *  POST /api/trends/videos/:id/download — скачать исходник на диск
 *
 * Все эндпоинты требуют JWT (tenant_id из токена). Изоляция — по tenant_id.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { JWT_SECRET } from '../../config/secrets.js';
import { scanTrends, listRecentVideos, getVideo, setVideoStatus, deleteVideo, deleteVideos, listScanQueries, deleteScanQueries, addVideoByUrl, type TrendKind } from './service.js';
import { analyzeUrl, detectUrl, analyzeCommentsSentiment, analyzeBulk } from './analytics.js';
import { generateTrendDNA, saveTrendDNA, getTrendDNAByAsset, listTrendDNA, applyVisualInsight, deleteTrendDNA, deleteTrendDNABulk, translateTrendDNA, translatePlainText, saveTrendDNAAuto } from './dna.js';
import { transcribeVideoAudio } from '../quest_flow/transcribe.js';
import { buildAudienceMap, suggestAudience } from './audience.js';
import { analyzeVideoVisual } from './video_insight.js';
import { saveAnalysisArtifacts, saveTranscriptAsset, readTextAssetFile } from './analysis_files.js';
import { listWatches, createWatch, updateWatch, deleteWatch, listRuns, runWatchNow, tenantAllowsAutopilot, MIN_INTERVAL_MINUTES } from './autopilot.js';
import { downloadVideoToDisk, downloadYoutubeToDisk } from '../media/store_video.js';
import { fetchOneVideo, extractDownloadUrls, fetchTweetDetail, extractTwitterVideoUrls, fetchInstagramPostInfo, extractInstagramMeta } from '../tikhub/tikhub_client.js';
import { REFERER_BY_PLATFORM } from './ingest.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { listAssets, listFolder, getAsset, createAsset, deleteAsset, deleteAssets, ANALYZED_FOLDER, TEXT_FOLDER, type MediaKind } from '../media/assets.js';

const router = Router();

// Загрузка референс-медиа/аудио в Галерею → отдельные папки uploads/reference и uploads/audio.
const __tr_dir = path.dirname(fileURLToPath(import.meta.url));
const REFERENCE_DIR = path.resolve(__tr_dir, '../../../../uploads/reference');
const AUDIO_DIR = path.resolve(__tr_dir, '../../../../uploads/audio');
try { fs.mkdirSync(REFERENCE_DIR, { recursive: true }); } catch { /* best-effort */ }
try { fs.mkdirSync(AUDIO_DIR, { recursive: true }); } catch { /* best-effort */ }
const kindFromReq = (req: Request): MediaKind => (req.query.kind === 'audio' ? 'audio' : 'reference');
/** Имя файла из multipart приходит в latin1 (busboy) → кириллица «кракозяблится». Восстанавливаем UTF-8. */
function fixUploadName(name: string | undefined | null): string {
  if (!name) return '';
  try {
    const utf8 = Buffer.from(name, 'latin1').toString('utf8');
    return utf8.includes('�') ? name : utf8; // невалидный UTF-8 (имя реально было latin1) → оставляем как есть
  } catch { return name; }
}
const uploadMedia = multer({
  storage: multer.diskStorage({
    // kind берём из query (?kind=audio|reference) — query доступен ДО парсинга тела.
    destination: (req, _file, cb) => cb(null, kindFromReq(req) === 'audio' ? AUDIO_DIR : REFERENCE_DIR),
    filename: (_req, file, cb) => cb(null, `med-${randomUUID()}${path.extname(file.originalname) || ''}`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 МБ — видео-референсы бывают крупные
});

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: string;
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

/** Полный доступ (Премиум/Энтерпрайз/триал/superadmin). Без него — 402: неоплаченный
 *  пользователь не должен дёргать платные API напрямую (защита нашего TikHub-бюджета). */
async function requireFullAccess(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole as any)) return next();
  } catch { /* ниже 402 */ }
  return res.status(402).json({ error: 'Доступно на тарифе Премиум или Энтерпрайз. Оформите подписку.' });
}

router.use(requireAuth);
router.use(requireFullAccess);

/** POST /analyze — { url } → аналитика по ссылке (видео/аккаунт) для TikTok/Douyin/IG/X/Bilibili. */
// YouTube: аналитика и скачивание отключены (TikHub не отдаёт надёжных потоков —
// подпись get_signed_stream_url ненадёжна). YouTube остаётся только для ПОИСКА трендов.
const YT_OFF = 'Анализ YouTube недоступен — YouTube доступен только для поиска трендов.';

router.post('/analyze', async (req: AuthedRequest, res: Response) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    if (!url.trim()) return res.status(400).json({ error: 'Передайте ссылку в поле url.' });
    if (detectUrl(url)?.platform === 'youtube') return res.status(400).json({ error: YT_OFF });
    const result = await analyzeUrl(req.tenantId!, url);
    res.json(result);
  } catch (err: any) {
    const msg = err?.message || 'Ошибка анализа';
    const code = /распозн|ключ|Укажите/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/** GET /analyze/detect?url= — только распознавание платформы/типа (без вызовов TikHub). */
router.get('/analyze/detect', (req: AuthedRequest, res: Response) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  res.json({ detected: detectUrl(url) });
});

/** POST /analyze/sentiment — { comments: string[] } → ИИ-анализ тональности (Claude). */
router.post('/analyze/sentiment', async (req: AuthedRequest, res: Response) => {
  try {
    const comments = Array.isArray(req.body?.comments) ? req.body.comments : [];
    const lang = typeof req.body?.lang === 'string' ? req.body.lang : undefined;
    const result = await analyzeCommentsSentiment(req.tenantId!, comments, lang);
    res.json(result);
  } catch (err: any) {
    const msg = err?.message || 'Ошибка анализа тональности';
    const code = /ключ|комментари|Укажите/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/**
 * POST /analyze/breakdown — нативный «рецепт успеха» тренда (TrendDNA).
 *   Принимает либо { url } (тогда сам соберёт данные через analyzeUrl),
 *   либо уже готовые { summary, comments, keywords, platform } (без повторных вызовов TikHub).
 */
router.post('/analyze/breakdown', async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    let summary = body.summary;
    let comments = Array.isArray(body.comments) ? body.comments : undefined;
    let keywords = Array.isArray(body.keywords) ? body.keywords : undefined;
    let platform: string | undefined = typeof body.platform === 'string' ? body.platform : undefined;
    let externalId: string | undefined = typeof body.externalId === 'string' ? body.externalId : undefined;
    const url = typeof body.url === 'string' ? body.url : '';
    const save = body.save === true || body.save === 1 || body.save === '1';
    if (!summary) {
      if (!url.trim()) return res.status(400).json({ error: 'Передайте url или summary.' });
      const a = await analyzeUrl(req.tenantId!, url);
      summary = a.summary;
      comments = a.normalized.comments;
      keywords = a.normalized.keywords;
      platform = a.detected.platform;
      externalId = externalId || (a.detected.videoId ? String(a.detected.videoId) : undefined);
    }
    const lang = typeof body.lang === 'string' ? body.lang : undefined;
    const dna = await generateTrendDNA(req.tenantId!, { summary, comments, keywords, platform, sourceUrl: url || undefined, lang });
    // save=1 → сразу карточка в «Тренды → Анализ» (без скачивания видео), дедуп по external_id.
    if (save) { try { await saveTrendDNAAuto(req.tenantId!, { platform, externalId, sourceUrl: url || undefined, dna }); } catch { /* мягко */ } }
    res.json({ dna });
  } catch (err: any) {
    const msg = err?.message || 'Ошибка разбора';
    const code = /ключ|распозн|Передайте|Укажите|неразборч/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/** POST /analyze/translate — { dna, lang } → перевод текстов готового разбора (кнопка «Перевести»). */
router.post('/analyze/translate', async (req: AuthedRequest, res: Response) => {
  try {
    const dna = req.body?.dna;
    const lang = typeof req.body?.lang === 'string' ? req.body.lang : '';
    if (!dna || typeof dna !== 'object') return res.status(400).json({ error: 'Передайте dna.' });
    if (!lang) return res.status(400).json({ error: 'Укажите lang.' });
    const translated = await translateTrendDNA(req.tenantId!, dna, lang);
    res.json({ dna: translated });
  } catch (err: any) {
    const msg = err?.message || 'Ошибка перевода';
    const code = /ключ|Передайте|Укажите|перевести/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/** POST /analyze/bulk — { urls: string[] } → массовая сводка (по одному вызову на ссылку). */
router.post('/analyze/bulk', async (req: AuthedRequest, res: Response) => {
  try {
    const urls: string[] = Array.isArray(req.body?.urls) ? req.body.urls : [];
    if (urls.length === 0) return res.status(400).json({ error: 'Передайте urls[].' });
    // YouTube не анализируем (без вызова TikHub) — сразу строка-ошибка; остальное как обычно.
    const isYt = (u: string) => detectUrl(u)?.platform === 'youtube';
    const okUrls = urls.filter((u) => !isYt(u));
    const okRows = okUrls.length ? await analyzeBulk(req.tenantId!, okUrls) : [];
    const byUrl = new Map(okRows.map((r: any) => [r.url, r]));
    const rows = urls.map((u) => isYt(u) ? { url: u, platform: 'youtube', summary: {}, error: YT_OFF } : (byUrl.get(u) || { url: u, platform: 'unknown', summary: {}, error: 'не обработано' }));
    res.json({ rows });
  } catch (err: any) {
    const msg = err?.message || 'Ошибка массового анализа';
    res.status(/ключ|Укажите/i.test(msg) ? 400 : 502).json({ error: msg });
  }
});

/**
 * Прямые mp4-ссылки проанализированного видео по площадке (TikTok — no-watermark
 * play_addr; X — лучший вариант твита; Instagram — video_url поста, как в ingest).
 * YouTube отключён (подпись потоков TikHub ненадёжна, см. YT_OFF).
 * Общий шаг для «Скачать в Галерею» и транскрибации — чтобы правила были в одном месте.
 */
async function resolveAnalyzedVideoUrls(
  key: string, platform: string, videoId: string, srcUrl: string,
): Promise<{ urls: string[]; referer: string } | { error: string; status: number }> {
  if (platform === 'tiktok') {
    const one = await fetchOneVideo(key, videoId);
    return { urls: one.ok ? extractDownloadUrls(one.data) : [], referer: srcUrl };
  }
  if (platform === 'twitter') {
    const one = await fetchTweetDetail(key, videoId);
    return { urls: one.ok ? extractTwitterVideoUrls(one.data) : [], referer: 'https://x.com/' };
  }
  if (platform === 'instagram') {
    const info = await fetchInstagramPostInfo(key, videoId);
    const v = info.ok ? extractInstagramMeta(info.data).videoUrl : null;
    return { urls: v ? [v] : [], referer: REFERER_BY_PLATFORM.instagram };
  }
  if (platform === 'youtube') return { error: 'Скачивание YouTube недоступно.', status: 400 };
  return { error: 'Скачивание пока поддержано для TikTok, Instagram и X.', status: 400 };
}

/** POST /analyze/save — { url } → скачать проанализированное видео в Галерею. */
router.post('/analyze/save', async (req: AuthedRequest, res: Response) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    const d = detectUrl(url);
    if (!d || d.type !== 'video') return res.status(400).json({ error: 'Нужна ссылка на видео/пост.' });
    const key = await getEffectiveTikHubKey(req.tenantId!);
    if (!key) return res.status(400).json({ error: 'Ключ Trend не задан.' });

    const src = await resolveAnalyzedVideoUrls(key, d.platform, String(d.videoId), url);
    if ('error' in src) return res.status(src.status).json({ error: src.error });
    if (src.urls.length === 0) return res.status(502).json({ error: 'Не удалось получить прямую ссылку на видео (для постов-картинок без видео скачивание недоступно).' });
    const file = await downloadVideoToDisk(src.urls, { referer: src.referer });
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: 'video', originalName: `${d.platform}-${d.videoId}.mp4`,
      fileUrl: file.mediaUrl, filePath: file.filePath, mime: file.mime || 'video/mp4', size: file.size,
      folder: ANALYZED_FOLDER, // сохранено из аналитики → папка «Из анализа»
      origins: ['analytics'],
    });
    if (!asset) return res.status(500).json({ error: 'Не удалось сохранить в Галерею.' });

    // ДНК тренда едет ВМЕСТЕ с видео: в фоне собираем рецепт и кладём в video_analyses,
    // привязав к этому ассету. Best-effort — скачивание уже успешно, анализ не должен его ронять.
    const tId = req.tenantId!, assetId = asset.id, dPlatform = d.platform, dVideoId = String(d.videoId), fPath = file.filePath;
    const sLang = typeof req.body?.lang === 'string' ? req.body.lang : undefined;
    void (async () => {
      try {
        const a = await analyzeUrl(tId, url);
        let dna = await generateTrendDNA(tId, {
          summary: a.summary, comments: a.normalized.comments, keywords: a.normalized.keywords,
          platform: a.detected.platform, sourceUrl: url, lang: sLang,
        });
        // Покадровый Gemini-видеоанализ по скачанному файлу: sceneBeats становятся
        // реальными (не LLM-реконструкцией). Мягкая деградация — null не ломает ДНК.
        const visual = await analyzeVideoVisual(tId, fPath);
        if (visual) dna = applyVisualInsight(dna, visual);
        await saveTrendDNA(tId, { mediaAssetId: assetId, platform: dPlatform, externalId: dVideoId, sourceUrl: url, dna });
        // Пакет отдельных файлов для «Медиафайлы → Аналитика»: разбор .md + субтитры .srt.
        await saveAnalysisArtifacts(tId, { platform: dPlatform, videoId: dVideoId, dna, sourceUrl: url });
      } catch (e) {
        console.warn('[trends] save→DNA:', (e as Error).message);
      }
    })();

    res.json({ ok: true, asset, fileUrl: file.mediaUrl, analyzing: true });
  } catch (err: any) {
    res.status(err?.status || 502).json({ error: err?.message || 'Ошибка скачивания' });
  }
});

/**
 * POST /analyze/transcribe — { url } → расшифровка речи ролика.
 * Качаем видео во временный файл → ffmpeg вынимает аудио → Gemini расшифровывает →
 * файл сразу удаляем (Галерею не засоряем: сохранение текста — отдельная кнопка).
 */
router.post('/analyze/transcribe', async (req: AuthedRequest, res: Response) => {
  let tmpPath: string | null = null;
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    const d = detectUrl(url);
    if (!d || d.type !== 'video') return res.status(400).json({ error: 'Нужна ссылка на видео/пост.' });
    const key = await getEffectiveTikHubKey(req.tenantId!);
    if (!key) return res.status(400).json({ error: 'Ключ Trend не задан.' });

    const src = await resolveAnalyzedVideoUrls(key, d.platform, String(d.videoId), url);
    if ('error' in src) return res.status(src.status).json({ error: `${src.error} Транскрибация доступна для TikTok, Instagram и X.` });
    if (src.urls.length === 0) return res.status(502).json({ error: 'Не удалось получить видео (у постов-картинок речи нет).' });

    const file = await downloadVideoToDisk(src.urls, { referer: src.referer });
    tmpPath = file.filePath;
    const r = await transcribeVideoAudio(req.tenantId!, file.filePath);
    if (!r) return res.status(422).json({ error: 'Не удалось разобрать речь: в ролике нет звуковой дорожки, либо она слишком длинная/тихая.' });
    if (!r.text.trim()) return res.status(422).json({ error: 'В ролике не распознана речь (музыка или тишина).' });
    res.json({ text: r.text, language: r.language, dialect: r.dialect });
  } catch (err: any) {
    res.status(err?.status || 502).json({ error: err?.message || 'Ошибка транскрибации' });
  } finally {
    if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch { /* временный файл мог не создаться */ } }
  }
});

/** POST /analyze/transcribe/translate — { text, lang } → перевод расшифровки на выбранный язык. */
router.post('/analyze/transcribe/translate', async (req: AuthedRequest, res: Response) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const lang = typeof req.body?.lang === 'string' ? req.body.lang : '';
    if (!text) return res.status(400).json({ error: 'Передайте text.' });
    if (!lang) return res.status(400).json({ error: 'Укажите lang.' });
    res.json({ text: await translatePlainText(req.tenantId!, text, lang) });
  } catch (err: any) {
    const msg = err?.message || 'Ошибка перевода';
    res.status(/ключ|Передайте|Укажите|перевести/i.test(msg) ? 400 : 502).json({ error: msg });
  }
});

/** POST /analyze/transcribe/save — { text, name? } → .txt в раздел Галереи «Текст». */
router.post('/analyze/transcribe/save', async (req: AuthedRequest, res: Response) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Нечего сохранять — текст пуст.' });
    const name = String(req.body?.name || '').trim().slice(0, 90) || 'Транскрибация';
    const asset = await saveTranscriptAsset(req.tenantId!, { text, name });
    if (!asset) return res.status(500).json({ error: 'Не удалось сохранить текст в Галерею.' });
    res.json({ ok: true, asset });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сохранения текста' });
  }
});

/** GET /texts — содержимое сохранённого текста (раздел «Текст») для подстановки в озвучку. */
router.get('/texts/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const items = await listFolder(req.tenantId!, TEXT_FOLDER);
    const a = items.find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: 'Текст не найден.' });
    const text = readTextAssetFile(String(a.fileUrl || ''));
    if (text == null) return res.status(404).json({ error: 'Файл текста не найден на диске.' });
    res.json({ text, name: a.originalName || 'Текст' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения текста' });
  }
});

/**
 * POST /audience-map — «Таргет на ЦА»: { product, audience, seedKeywords?, platform?, language?, region?, maxNiches?, ground? }
 *   → карта микро-ниш; Claude предлагает ниши, ключевики заземляются реальными подсказками
 *   запросов TikHub (ground!=false). Фронт затем веерно сканирует кластеры через /scan.
 *   Гейт — тот же (Премиум/Энтерпрайз).
 */
router.post('/audience-map', async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const product = typeof body.product === 'string' ? body.product : '';
    const audience = typeof body.audience === 'string' ? body.audience : '';
    // seedKeywords: массив ИЛИ строка «через запятую/перенос».
    const rawSeeds = Array.isArray(body.seedKeywords)
      ? body.seedKeywords
      : (typeof body.seedKeywords === 'string' ? body.seedKeywords.split(/[,\n;]+/) : []);
    const seedKeywords = rawSeeds.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 20);
    const platform = ['tiktok', 'instagram', 'youtube', 'twitter', 'reddit'].includes(body.platform) ? body.platform : 'tiktok';
    // язык — уже может быть СПИСКОМ из мультиселекта («русский, английский»), поэтому 120.
    const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim().slice(0, 120) : undefined;
    const region = typeof body.region === 'string' && /^[A-Za-z]{2}$/.test(body.region.trim())
      ? body.region.trim().toUpperCase() : undefined;
    const maxNiches = Number.isFinite(body.maxNiches) ? Number(body.maxNiches) : undefined;
    const ground = body.ground !== false; // по умолчанию заземляем реальными запросами
    const map = await buildAudienceMap(req.tenantId!, { product, audience, seedKeywords, platform, language, region, maxNiches, ground });
    res.json({ map });
  } catch (err: any) {
    const msg = err?.message || 'Ошибка построения карты ЦА';
    const code = /ключ|Заполните|Claude|неразборч|уточните/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/**
 * POST /audience-suggest — кнопка «Подсказать»: { product, platform?, language?, region? }
 *   → ИИ по описанию продукта формулирует базовую ЦА + затравочные ключевики; поля на
 *   фронте остаются редактируемыми. Один запрос Claude, без TikHub. Гейт — тот же.
 */
router.post('/audience-suggest', async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const product = typeof body.product === 'string' ? body.product : '';
    const platform = ['tiktok', 'instagram', 'youtube', 'twitter', 'reddit'].includes(body.platform) ? body.platform : 'tiktok';
    const language = typeof body.language === 'string' && body.language.trim() ? body.language.trim().slice(0, 120) : undefined;
    const region = typeof body.region === 'string' && /^[A-Za-z]{2}$/.test(body.region.trim())
      ? body.region.trim().toUpperCase() : undefined;
    const suggestion = await suggestAudience(req.tenantId!, { product, platform, language, region });
    res.json({ suggestion });
  } catch (err: any) {
    const msg = err?.message || 'Не удалось подсказать ЦА';
    const code = /ключ|Заполните|Сначала|Claude|неразборч/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/** POST /scan — { kind: 'keyword'|'trending', query?, count? } */
router.post('/scan', async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const kind: TrendKind = body.kind === 'trending' ? 'trending' : 'keyword';
    const platform = ['tiktok', 'instagram', 'youtube', 'twitter', 'reddit'].includes(body.platform) ? body.platform : 'tiktok';
    const filters: Record<string, string> = {};
    if (body.filters && typeof body.filters === 'object') {
      for (const [k, v] of Object.entries(body.filters)) {
        if (typeof v === 'string' && v && /^[\w-]{1,30}$/.test(k) && v.length <= 40) filters[k] = v;
      }
    }
    const query = typeof body.query === 'string' ? body.query : undefined;
    const count = Number.isFinite(body.count) ? Number(body.count) : undefined;
    const mode = ['video', 'general', 'app'].includes(body.mode) ? body.mode : 'app';
    const sortType = [0, 1, 2].includes(Number(body.sortType)) ? (Number(body.sortType) as 0 | 1 | 2) : 0;
    const publishTime = [0, 1, 7, 30, 90, 180].includes(Number(body.publishTime))
      ? (Number(body.publishTime) as 0 | 1 | 7 | 30 | 90 | 180) : 0;
    // Регион: только ISO alpha-2 (2 буквы) → UPPER. Пустое/невалидное → undefined (глобально).
    const region = typeof body.region === 'string' && /^[A-Za-z]{2}$/.test(body.region.trim())
      ? body.region.trim().toUpperCase() : undefined;
    if (kind === 'keyword' && !query?.trim()) {
      return res.status(400).json({ error: 'Для поиска по ключевому слову передайте query.' });
    }
    const result = await scanTrends(req.tenantId!, { kind, query, count, mode, sortType, publishTime, platform, filters, region });
    res.json(result);
  } catch (err: any) {
    const msg = err?.message || 'Ошибка сканирования';
    // Нет ключа / ошибка TikHub — клиентская (400), прочее — 502.
    const code = /ключ|query|Укажите/i.test(msg) ? 400 : 502;
    res.status(code).json({ error: msg });
  }
});

/** GET /history?limit=40 — история запросов сканирования («Запросы трендов» в Галерее). */
router.get('/history', async (req: AuthedRequest, res: Response) => {
  try {
    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 40;
    const queries = await listScanQueries(req.tenantId!, limit);
    res.json({ queries });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** POST /history/delete { query } — убрать запрос из истории (все сканы с этим словом). */
router.post('/history/delete', async (req: AuthedRequest, res: Response) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) return res.status(400).json({ error: 'Передайте query.' });
    const deleted = await deleteScanQueries(req.tenantId!, query);
    res.json({ ok: true, deleted });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

// ── Автопилот трендов («Автоанализ» ключевика) — строго Enterprise ───────────
// Расходы цепочки (TikHub/Claude/Gemini/ElevenLabs/HeyGen) идут с ключей клиента.

async function requireAutopilot(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (req.userRole === 'superadmin' || await tenantAllowsAutopilot(req.tenantId!)) return next();
  } catch { /* ниже 403 */ }
  return res.status(403).json({ error: 'Автоанализ доступен только на тарифе Enterprise.' });
}

/** GET /watches — список автоанализов тенанта (+ последние прогоны сводно). */
router.get('/watches', requireAutopilot, async (req: AuthedRequest, res: Response) => {
  try {
    const watches = await listWatches(req.tenantId!);
    res.json({ watches, minIntervalMinutes: MIN_INTERVAL_MINUTES });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** POST /watches — включить автоанализ ключевика.
 *  body: { keyword, platform?, intervalMinutes?, dailyCap?, scanParams? } */
router.post('/watches', requireAutopilot, async (req: AuthedRequest, res: Response) => {
  try {
    const b = req.body || {};
    const watch = await createWatch(req.tenantId!, {
      keyword: b.keyword, platform: b.platform,
      intervalMinutes: b.intervalMinutes, dailyCap: b.dailyCap,
      scanParams: b.scanParams,
    });
    res.json({ watch });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Не удалось создать автоанализ' });
  }
});

/** PATCH /watches/:id — пауза/включение, интервал, дневной лимит. */
router.patch('/watches/:id', requireAutopilot, async (req: AuthedRequest, res: Response) => {
  try {
    const w = await updateWatch(req.tenantId!, String(req.params.id), req.body || {});
    if (!w) return res.status(404).json({ error: 'Автоанализ не найден.' });
    res.json({ watch: w });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Не удалось обновить' });
  }
});

/** DELETE /watches/:id — убрать автоанализ (журнал прогонов удаляется каскадом). */
router.delete('/watches/:id', requireAutopilot, async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await deleteWatch(req.tenantId!, String(req.params.id));
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

/** POST /watches/:id/run — «Прогнать сейчас» (не ждёт: смотрите журнал прогонов). */
router.post('/watches/:id/run', requireAutopilot, async (req: AuthedRequest, res: Response) => {
  try {
    const r = await runWatchNow(req.tenantId!, String(req.params.id));
    if (!r.started && r.busy) return res.status(409).json({ error: 'Прогон этого автоанализа уже идёт — дождитесь завершения (см. журнал).' });
    if (!r.started) return res.status(404).json({ error: 'Автоанализ не найден.' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Не удалось запустить' });
  }
});

/** GET /watches/:id/runs — журнал прогонов watch (или все: GET /watches/runs/all). */
router.get('/watches/:id/runs', requireAutopilot, async (req: AuthedRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const runs = await listRuns(req.tenantId!, id === 'all' ? undefined : id, Number(req.query.limit) || 30);
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** GET /analyses — все сохранённые анализы тенанта («Тренды → Анализ» в Галерее). */
router.get('/analyses', async (req: AuthedRequest, res: Response) => {
  try {
    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 100;
    const analyses = await listTrendDNA(req.tenantId!, limit);
    res.json({ analyses });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** POST /analyses/delete-bulk { ids: string[] } — массовое удаление сохранённых анализов. */
router.post('/analyses/delete-bulk', async (req: AuthedRequest, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: any) => typeof x === 'string') : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Передайте ids[]' });
    res.json({ ok: true, deleted: await deleteTrendDNABulk(req.tenantId!, ids) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

/** DELETE /analyses/:id — удалить один сохранённый анализ. */
router.delete('/analyses/:id', async (req: AuthedRequest, res: Response) => {
  try {
    res.json({ ok: await deleteTrendDNA(req.tenantId!, req.params.id) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

/** GET /videos?limit=60 — последние найденные видео тенанта. */
router.get('/videos', async (req: AuthedRequest, res: Response) => {
  try {
    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 60;
    const downloaded = req.query.downloaded === '1' || req.query.downloaded === 'true';
    const byLink = req.query.bylink === '1' || req.query.bylink === 'true';
    const videos = await listRecentVideos(req.tenantId!, limit, downloaded, byLink);
    res.json({ videos });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** POST /videos/add-by-url — добавить видео ПРЯМОЙ ссылкой (TikTok / Instagram / YouTube):
 *  строка в source_videos (trend_id NULL = «по ссылке») + метаданные TikHub best-effort.
 *  Дальше карточка живёт как сканная: разбор в Аналитике, /videos/:id/download, удаление. */
router.post('/videos/add-by-url', async (req: AuthedRequest, res: Response) => {
  try {
    const url = String(req.body?.url || '').trim();
    if (!url) return res.status(400).json({ error: 'Не указана ссылка.' });
    const video = await addVideoByUrl(req.tenantId!, url);
    res.json({ ok: true, video });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Не удалось добавить видео по ссылке.' });
  }
});

// Реестр идущих скачиваний для отмены (ключ tenant:id → AbortController).
const downloadRegistry = new Map<string, AbortController>();

/** POST /videos/:id/download — ФОНОВОЕ скачивание исходника на диск + в Галерею. */
router.post('/videos/:id/download', async (req: AuthedRequest, res: Response) => {
  try {
    const tId = req.tenantId!, vId = req.params.id;
    const row = await getVideo(tId, vId);
    if (!row) return res.status(404).json({ error: 'Видео не найдено' });

    const key = `${tId}:${vId}`;
    if (downloadRegistry.has(key)) return res.json({ ok: true, status: 'downloading' }); // уже качается

    // YouTube: свой путь — TikHub streams → подписанные URL → ffmpeg-mux (downloadYoutubeToDisk).
    const isYt = row.platform === 'youtube';
    const ytKey = isYt ? await getEffectiveTikHubKey(tId) : null;
    if (isYt && !ytKey) return res.status(400).json({ error: 'Для скачивания YouTube нужен ключ Trend (TikHub).' });

    // Свежие ПРЯМЫЕ ссылки через App V3 (no-watermark, без cookie tt_chain_token).
    let urls: string[] = [];
    if (!isYt) {
      try {
        const apiKey = await getEffectiveTikHubKey(tId);
        if (apiKey && row.external_id) {
          const one = await fetchOneVideo(apiKey, String(row.external_id));
          if (one.ok) urls = extractDownloadUrls(one.data);
        }
      } catch { /* падаем на сохранённую ссылку ниже */ }
      if (urls.length === 0 && row.video_url) urls = [row.video_url];
      if (urls.length === 0) {
        return res.status(400).json({ error: 'Не удалось получить прямую ссылку (App V3 не вернул url).' });
      }
    }

    await setVideoStatus(tId, vId, { status: 'downloading', error: null });
    const ctrl = new AbortController();
    downloadRegistry.set(key, ctrl);
    const referer = row.web_url || undefined, platform = row.platform, extId = row.external_id;

    // Скачивание продолжается на сервере, даже если клиент ушёл со страницы.
    // По завершении — статус 'downloaded' + запись в Галерею (media_assets).
    // ⚠ YouTube-путь (streams+mux) отмену НЕ поддерживает — «отменить» лишь вернёт статус.
    void (async () => {
      try {
        const file = isYt
          ? await downloadYoutubeToDisk(ytKey!, String(extId))
          : await downloadVideoToDisk(urls, { referer, signal: ctrl.signal });
        await setVideoStatus(tId, vId, { status: 'downloaded', fileUrl: file.mediaUrl, filePath: file.filePath, error: null });
        try {
          await createAsset(tId, { kind: 'reference', mediaType: 'video', originalName: `${platform}-${extId || vId}.mp4`, fileUrl: file.mediaUrl, filePath: file.filePath, mime: file.mime, size: file.size, origins: ['trends'] });
        } catch (e) { console.warn('[trends] download→gallery createAsset:', (e as Error).message); }
      } catch (dlErr: any) {
        const aborted = dlErr?.name === 'AbortError';
        await setVideoStatus(tId, vId, { status: aborted ? 'discovered' : 'failed', error: aborted ? null : (dlErr?.message || 'download error') });
      } finally {
        downloadRegistry.delete(key);
      }
    })();

    res.json({ ok: true, status: 'downloading' }); // отвечаем сразу — идёт в фоне
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка' });
  }
});

/** POST /videos/:id/download/cancel — отменить идущее фоновое скачивание. */
router.post('/videos/:id/download/cancel', async (req: AuthedRequest, res: Response) => {
  const key = `${req.tenantId}:${req.params.id}`;
  const ctrl = downloadRegistry.get(key);
  if (ctrl) ctrl.abort();
  try { await setVideoStatus(req.tenantId!, req.params.id, { status: 'discovered', error: null }); } catch { /* noop */ }
  res.json({ ok: true, canceled: !!ctrl });
});

/** DELETE /videos/:id — удалить одно видео (файл + строку). */
router.delete('/videos/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await deleteVideo(req.tenantId!, req.params.id);
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

/** POST /videos/delete-bulk { ids: string[] } — массовое удаление. */
router.post('/videos/delete-bulk', async (req: AuthedRequest, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: any) => typeof x === 'string') : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Передайте ids[]' });
    const deleted = await deleteVideos(req.tenantId!, ids);
    res.json({ ok: true, deleted });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

// ── Медиа-ассеты Галереи (референс/аудио) ──────────────────────────────────

/** GET /media?kind=reference|audio  ИЛИ  ?folder=analyzed — список загруженных медиа. */
router.get('/media', async (req: AuthedRequest, res: Response) => {
  try {
    const folder = typeof req.query.folder === 'string' ? req.query.folder.trim() : '';
    const assets = folder
      ? await listFolder(req.tenantId!, folder)
      : await listAssets(req.tenantId!, kindFromReq(req));
    res.json({ assets });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** GET /media/:id/analysis — сохранённая ДНК тренда по видео Галереи (для автозаполнения TrendFlow). */
router.get('/media/:id/analysis', async (req: AuthedRequest, res: Response) => {
  try {
    const rec = await getTrendDNAByAsset(req.tenantId!, req.params.id);
    if (!rec) return res.status(404).json({ error: 'Анализ для этого видео не найден.' });
    res.json({ analysis: rec });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/**
 * POST /media/:id/analyze — разобрать СВОЙ ролик из Галереи (не чужой тренд по ссылке).
 *
 * Отличие от /analyze/save: у нашего видео нет ни ссылки на площадку, ни TikHub-метрик
 * (оно ещё не опубликовано) — единственный источник правды это сам файл. Поэтому сначала
 * покадровый Gemini-разбор (речь + надписи + сцены), а уже его результат подаём Claude
 * как «описание» вместо TikHub-summary. Метрики остаются пустыми, и это честно.
 *
 * Нужен для «ИИ-подписи» в Публикаторе: подпись пишется по РЕАЛЬНОМУ содержанию ролика,
 * а не по имени файла. Ответ мгновенный ({ analyzing: true }), готовность опрашивается
 * через GET /media/:id/analysis. Повторный вызов без ?force=1 отдаёт готовый разбор.
 */
router.post('/media/:id/analyze', async (req: AuthedRequest, res: Response) => {
  try {
    const tId = req.tenantId!, assetId = req.params.id;
    const force = req.query.force === '1' || req.body?.force === true;
    const existing = await getTrendDNAByAsset(tId, assetId);
    if (existing && !force) return res.json({ ok: true, analyzing: false, analysis: existing });

    const asset = await getAsset(tId, assetId);
    if (!asset) return res.status(404).json({ error: 'Видео не найдено в Галерее.' });
    if (asset.mediaType !== 'video') return res.status(400).json({ error: 'Разбирать можно только видео.' });
    if (!asset.filePath || !fs.existsSync(asset.filePath)) {
      return res.status(400).json({ error: 'Файл ролика недоступен на диске — перезалейте его в Галерею.' });
    }

    const fPath = asset.filePath, title = asset.originalName || 'Ролик';
    const sLang = typeof req.body?.lang === 'string' ? req.body.lang : undefined;
    void (async () => {
      try {
        const visual = await analyzeVideoVisual(tId, fPath);
        if (!visual) { console.warn('[trends] own-analyze: покадровый разбор недоступен (нет ключа Gemini?)'); return; }
        // Синтетический «summary» вместо TikHub: речь + надписи + как снято. Claude из этого
        // собирает ту же TrendDNA (хук, аудитория, ключи), что и для чужих трендов.
        const speech = (visual.transcript || []).map((s) => s.text).join(' ').trim();
        const desc = [
          speech && `Речь в ролике: ${speech}`,
          visual.textOverlays?.length && `Надписи в кадре: ${visual.textOverlays.join(' | ')}`,
          visual.hookVisual && `Первые секунды: ${visual.hookVisual}`,
          visual.visualStyle && `Как снято: ${visual.visualStyle}`,
        ].filter(Boolean).join('\n');
        let dna = await generateTrendDNA(tId, {
          summary: { desc: desc || title, author: title, duration: visual.sceneBeats?.at(-1)?.t },
          lang: sLang,
        });
        dna = applyVisualInsight(dna, visual);
        await saveTrendDNA(tId, { mediaAssetId: assetId, dna });
      } catch (e) {
        console.warn('[trends] own-analyze:', (e as Error).message);
      }
    })();

    res.json({ ok: true, analyzing: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Не удалось запустить разбор' });
  }
});

/** POST /media/upload?kind=reference|audio (multipart "file") — загрузить медиа. */
router.post('/media/upload', uploadMedia.single('file'), async (req: AuthedRequest, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: 'Файл не передан' });
    const kind = kindFromReq(req);
    const mime = file.mimetype || 'application/octet-stream';
    const mediaType = mime.startsWith('image/') ? 'image'
      : mime.startsWith('video/') ? 'video'
      : mime.startsWith('audio/') ? 'audio' : 'file';
    const subdir = kind === 'audio' ? 'audio' : 'reference';
    const fileUrl = `/uploads/${subdir}/${path.basename(file.path)}`;
    const asset = await createAsset(req.tenantId!, {
      kind, mediaType, originalName: fixUploadName(file.originalname), fileUrl, filePath: file.path, mime, size: file.size,
      origins: ['upload'],
    });
    if (!asset) {
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(500).json({ error: 'Не удалось сохранить ассет' });
    }
    res.status(201).json({ ok: true, asset });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка загрузки' });
  }
});

/** DELETE /media/:id — удалить ассет (файл + строку). */
router.delete('/media/:id', async (req: AuthedRequest, res: Response) => {
  try {
    res.json({ ok: await deleteAsset(req.tenantId!, req.params.id) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

/** POST /media/delete-bulk { ids: string[] } — массовое удаление ассетов. */
router.post('/media/delete-bulk', async (req: AuthedRequest, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: any) => typeof x === 'string') : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Передайте ids[]' });
    res.json({ ok: true, deleted: await deleteAssets(req.tenantId!, ids) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления' });
  }
});

export default router;
