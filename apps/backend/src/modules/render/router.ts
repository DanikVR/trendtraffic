/**
 * TrendTraffic — HTTP-роутер рендера «Собрать».
 *
 *  POST /api/render/ugc/build        — сборка UGC-ролика (своё фото/HeyGen, удержание, диалоги)
 *  POST /api/render/omni/generate    — генерация видео Omni Flash
 *  POST /api/render/commentator/compose — сборка ролика «Комментатор»
 *  POST /api/render/podcast/dialogue — сгенерировать диалог двух ведущих
 *  POST /api/render/podcast/diarize  — разобрать запись на 2 голоса (Gemini)
 *
 * Все эндпоинты требуют JWT. Изоляция — по tenant_id из токена (как в trends).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../../db/index.js';
import { JWT_SECRET } from '../../config/secrets.js';
import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { generateImage, isTransientGenError } from '../quest_flow/image_gen.js';
import { createAsset, deleteAsset, listFolder } from '../media/assets.js';
import { generatePodcastDialogue, tagUgcRetention, directDialogue, translateUgcScript } from './director.js';
import { diarizeWithGemini } from './audio_diarize.js';
import { heygenVideoStatus, submitTalkingPhotoVideo, uploadTalkingPhoto } from './avatar.js';
import { enqueueHeygenHeads, waitHeygenHeads, type HeadSpec } from '../heygen-ext/router.js';
import { elevenTTS } from './podcast_voice.js';
import { composeCommentator, composeUgc, composeVoiceover, composeRetentionVideo, composeDialogueVideo, composeSlideshow, concatBumpers, buildDialogueVoice, sliceAudioToRenders, mediaDuration, downloadToRenders, UGC_FORMATS, type UgcCaption, type RetComposeSeg, type DlgComposeSeg, type DlgVoicePart, type FrameDims, type UgcFormatKey, type UgcInsert } from './podcast_compose.js';
import { parseCapWishes } from './cap_wishes.js';
import { getRetentionPreset, planWindows, planRetention, applyIvBudget, type RetLine, type RetSegment } from './retention.js';
import { planDialogue, applyDlgBudget, scoreDialogueHeuristic, type DlgLineIn, type DlgEngagement } from './dialogue.js';
import { generateOmniVideo, editOmniVideo, OMNI_VIDEO_USD_PER_SEC } from './video_gen.js';
import { extractFrame } from './frame_extract.js';

// Задачи генерации/правки видео Omni Flash (в памяти): jobId → статус/результат (+ interactionId для чат-правок).
const omniJobs = new Map<string, { tenantId?: string; status: 'processing' | 'done' | 'failed'; fileUrl?: string; interactionId?: string; seconds?: number; costUsd?: number; assetId?: string | null; error?: string; ts: number }>();

// TTL-эвикция in-memory задач: без неё Map-ы растут до рестарта процесса.
const JOB_TTL_MS = 6 * 3600_000;
function sweepJobs<T extends { ts: number }>(map: Map<string, T>): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [k, v] of map) { if (v.ts < cutoff) map.delete(k); }
}

const router = Router();

// ── Топовая image-модель Gemini (Nano Banana Pro) — макс. качество, сохранение лиц ──
const PODCAST_ANGLE_MODEL = 'gemini-3-pro-image';
async function fetchImageBase64(url: string): Promise<{ base64: string; mime: string } | null> {
  // 3 попытки: сетевой чих на самофетче /uploads ронял весь рендер («не удалось загрузить фото»).
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const mime = r.headers.get('content-type') || 'image/jpeg';
        return { base64: Buffer.from(await r.arrayBuffer()).toString('base64'), mime };
      }
    } catch { /* транзиентный сбой — ретрай ниже */ }
    if (attempt < 3) await new Promise((res) => setTimeout(res, 700 * attempt));
  }
  return null;
}

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

router.use(requireAuth);

// ── Подкаст-сцена (2 ведущих) ─────────────────────────────────────────────────

/** POST /podcast/dialogue — сгенерировать диалог двух ведущих по брифу. */
router.post('/podcast/dialogue', async (req: AuthedRequest, res: Response) => {
  try {
    const { brief, nameA, nameB, turns } = req.body || {};
    const r = await generatePodcastDialogue({
      tenantId: req.tenantId!,
      brief: typeof brief === 'string' ? brief : '',
      nameA: typeof nameA === 'string' ? nameA : undefined,
      nameB: typeof nameB === 'string' ? nameB : undefined,
      turns: Number.isFinite(Number(turns)) ? Number(turns) : undefined,
    });
    res.json({ lines: r.lines, note: r.note });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка генерации диалога' });
  }
});

/** POST /podcast/diarize — разобрать запись подкаста на 2 голоса (Gemini, тенант-ключом). */
router.post('/podcast/diarize', async (req: AuthedRequest, res: Response) => {
  try {
    const recordingUrl = typeof req.body?.recordingUrl === 'string' ? req.body.recordingUrl : '';
    if (!recordingUrl) return res.status(400).json({ error: 'Не указана запись (recordingUrl).' });
    const hostAVoice = typeof req.body?.hostAVoice === 'string' ? req.body.hostAVoice : undefined;
    const hostBVoice = typeof req.body?.hostBVoice === 'string' ? req.body.hostBVoice : undefined;
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const absUrl = /^https?:\/\//i.test(recordingUrl)
      ? recordingUrl
      : (base ? base + (recordingUrl.startsWith('/') ? recordingUrl : '/' + recordingUrl) : recordingUrl);

    // Gemini — качественная диаризация тенант-ключом (тот же, что и AI-ракурсы).
    const geminiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!geminiKey) {
      return res.status(400).json({ error: 'Подключите Gemini-ключ (Настройки → Gemini API) — им разбираем запись на голоса.' });
    }
    if (!/^https?:\/\//i.test(absUrl)) {
      return res.status(400).json({ error: 'PUBLIC_BASE_URL не настроен — Gemini не сможет скачать запись по относительной ссылке.' });
    }
    const g = await diarizeWithGemini({ apiKey: geminiKey, audioUrl: absUrl, hostAVoice, hostBVoice });
    if (!g.lines.length) {
      return res.status(502).json({ error: 'Gemini не смог разобрать запись — попробуйте другую запись или повторите.' });
    }
    res.json({ lines: g.lines, tracks: [], note: g.note });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка разбора записи' });
  }
});

// ── Коллекция аватаров UGC — папка 'avatars' в Галерее ───────────────────────
// Аватар = портрет анфас (вход EchoMimic-v2). Коллекция пер-тенантная: генерация
// Gemini кладёт файлы сюда, «Из Галереи» добавляет ссылку на уже существующий файл.
const UGC_AVATARS_FOLDER = 'avatars';
const UGC_AVATAR_PERSONAS = [
  'девушка 22–28 лет, дружелюбная улыбка, casual-стиль',
  'мужчина 27–35 лет, уверенный, smart casual',
  'женщина 30–40 лет, деловой стиль, лёгкая улыбка',
  'парень 18–24 лет, стритвир, живая мимика',
  'женщина 45–55 лет, тёплая улыбка, уютный свитер',
  'мужчина 38–50 лет, аккуратная борода, рубашка',
];
function ugcAvatarPrompt(persona: string, variantIdx: number): string {
  return `Фотореалистичный вертикальный портрет для UGC-видео: ${persona}. `
    + 'Один человек в кадре, лицо строго анфас, смотрит прямо в камеру, план по грудь. '
    + 'Нейтральный чистый фон, мягкий ровный свет, качество как у хорошего селфи на смартфон. '
    + (variantIdx >= 0 ? `Вариант №${variantIdx + 1} — заметно другая внешность, причёска и одежда. ` : '')
    + 'Без текста и водяных знаков. Верни только изображение.';
}

/** GET /ugc/avatars — список коллекции аватаров тенанта. */
// ── Голоса ElevenLabs: список из аккаунта клиента (включая клоны) для выбора озвучки ──
const elevenVoicesCache = new Map<string, { ts: number; items: { id: string; name: string; preview: string | null; category: string | null; labels: Record<string, string> }[] }>();
/** GET /ugc/voices — голоса ElevenLabs по ключу тенанта (кэш 1 час). → { voices: [{id,name,preview,category,labels}] } */
router.get('/ugc/voices', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await getEffectiveProviderKey(req.tenantId!, 'elevenlabs');
    if (!key) return res.json({ voices: [], note: 'Ключ ElevenLabs не задан (Настройки → Генерация) — используются голоса по умолчанию.' });
    // Кэш-ключ включает хвост API-ключа: смена ключа тенантом сразу сбрасывает кэш.
    // ?fresh=1 (кнопка «Обновить») пропускает чтение кэша — новый клон подтянется сразу.
    const cacheKey = `${req.tenantId}:${key.slice(-8)}`;
    const fresh = String(req.query.fresh || '') === '1';
    const cached = elevenVoicesCache.get(cacheKey);
    if (!fresh && cached && Date.now() - cached.ts < 3600_000) return res.json({ voices: cached.items });
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
    if (!r.ok) return res.status(502).json({ error: `ElevenLabs: HTTP ${r.status}` });
    const d: any = await r.json().catch(() => ({}));
    const items = (Array.isArray(d?.voices) ? d.voices : []).slice(0, 80).map((v: any) => ({
      id: String(v?.voice_id || ''),
      name: String(v?.name || 'голос'),
      preview: v?.preview_url ? String(v.preview_url) : null,
      category: v?.category ? String(v.category) : null,
      labels: (v?.labels && typeof v.labels === 'object') ? v.labels : {},
    })).filter((v: any) => v.id);
    elevenVoicesCache.set(cacheKey, { ts: Date.now(), items });
    res.json({ voices: items });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось получить голоса ElevenLabs' });
  }
});

// ── Бренд-киты: сохранённый набор оформления (слой, заставки, музыка, субтитры, голос) ──
/** GET /ugc/brandkits → { kits: [{id,name,data}] } (данные тенанта, новые сверху). */
router.get('/ugc/brandkits', async (req: AuthedRequest, res: Response) => {
  try {
    const r = await pool.query('SELECT id, name, data FROM brand_kits WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50', [req.tenantId]);
    res.json({ kits: r.rows.map((x: any) => ({ id: String(x.id), name: x.name, data: x.data })) });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Бренд-киты недоступны' }); }
});
/** POST /ugc/brandkits — сохранить набор. body: { name, data: {layers?,intro?,outro?,music?,subtitles?,voiceId?,progressBar?} }. */
router.post('/ugc/brandkits', async (req: AuthedRequest, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 120) || 'Мой бренд';
    const data = req.body?.data && typeof req.body.data === 'object' ? req.body.data : {};
    const r = await pool.query('INSERT INTO brand_kits (tenant_id, name, data) VALUES ($1,$2,$3) RETURNING id', [req.tenantId, name, JSON.stringify(data)]);
    // В fallback-режиме БД (без Postgres) вставка тихо возвращает пусто — честно скажем об этом.
    if (!r.rows?.[0]?.id) return res.status(500).json({ error: 'Бренд-киты требуют базу данных (Postgres) — сохранение недоступно.' });
    res.json({ id: String(r.rows[0].id), name });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось сохранить бренд-кит' }); }
});
/** DELETE /ugc/brandkits/:id — убрать набор (только своего тенанта). */
router.delete('/ugc/brandkits/:id', async (req: AuthedRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM brand_kits WHERE tenant_id = $1 AND id = $2', [req.tenantId, Number(req.params.id) || 0]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось удалить бренд-кит' }); }
});

// ── Шаблоны UGC (автоматические): ПОЛНЫЙ снимок спеки + ключевик тренда + автопубликация ──
// В отличие от бренд-китов (только оформление), шаблон хранит всю настройку ролика:
// режим, форматы, титры, музыку, галочки «Использовать анализ» (spec.analysisUse) и
// autopublish { enabled, source:{type:'trend_watch',id}, language, dailyCap } — конвейер
// autopilot.ts собирает по нему ролики автоматически (папка Галереи 'auto-ugc').

/** GET /ugc/templates — шаблоны тенанта. */
router.get('/ugc/templates', async (req: AuthedRequest, res: Response) => {
  try {
    const r = await pool.query('SELECT id, name, trend_keyword, spec, autopublish, created_at FROM ugc_templates WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50', [req.tenantId]);
    res.json({ templates: r.rows.map((x: any) => ({ id: String(x.id), name: x.name, trendKeyword: x.trend_keyword || '', spec: x.spec || {}, autopublish: x.autopublish || {}, createdAt: x.created_at })) });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Шаблоны недоступны' }); }
});
/** POST /ugc/templates — сохранить шаблон. body: { name, trendKeyword?, spec, autopublish? }. */
router.post('/ugc/templates', async (req: AuthedRequest, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 120) || 'Мой шаблон';
    const trendKeyword = String(req.body?.trendKeyword || '').trim().slice(0, 120) || null;
    const specIn = req.body?.spec && typeof req.body.spec === 'object' ? { ...req.body.spec } : {};
    // Одноразовые поля прогона в шаблоне не живут.
    delete specIn.buildJobId; delete specIn.result; delete specIn.results; delete specIn.recordingUrl; delete specIn.recordingName;
    const autopublish = req.body?.autopublish && typeof req.body.autopublish === 'object' ? req.body.autopublish : {};
    const r = await pool.query(
      'INSERT INTO ugc_templates (tenant_id, name, trend_keyword, spec, autopublish) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [req.tenantId, name, trendKeyword, JSON.stringify(specIn), JSON.stringify(autopublish)]
    );
    if (!r.rows?.[0]?.id) return res.status(500).json({ error: 'Шаблоны требуют базу данных (Postgres) — сохранение недоступно.' });
    res.json({ id: String(r.rows[0].id), name });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось сохранить шаблон' }); }
});
/** PATCH /ugc/templates/:id — правка имени/ключевика/автопубликации (spec целиком — POST-ом заново). */
router.patch('/ugc/templates/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const sets: string[] = []; const vals: any[] = [req.tenantId, Number(req.params.id) || 0];
    if (typeof req.body?.name === 'string') sets.push(`name = $${vals.push(req.body.name.trim().slice(0, 120) || 'Мой шаблон')}`);
    if (typeof req.body?.trendKeyword === 'string') sets.push(`trend_keyword = $${vals.push(req.body.trendKeyword.trim().slice(0, 120) || null)}`);
    if (req.body?.autopublish && typeof req.body.autopublish === 'object') sets.push(`autopublish = $${vals.push(JSON.stringify(req.body.autopublish))}`);
    if (req.body?.spec && typeof req.body.spec === 'object') sets.push(`spec = $${vals.push(JSON.stringify(req.body.spec))}`);
    if (!sets.length) return res.status(400).json({ error: 'Нечего обновлять.' });
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    const r = await pool.query(`UPDATE ugc_templates SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING id`, vals);
    if (!r.rows?.[0]?.id) return res.status(404).json({ error: 'Шаблон не найден.' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось обновить шаблон' }); }
});
/** DELETE /ugc/templates/:id — убрать шаблон. */
router.delete('/ugc/templates/:id', async (req: AuthedRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM ugc_templates WHERE tenant_id = $1 AND id = $2', [req.tenantId, Number(req.params.id) || 0]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось удалить шаблон' }); }
});

router.get('/ugc/avatars', async (req: AuthedRequest, res: Response) => {
  try {
    const items = await listFolder(req.tenantId!, UGC_AVATARS_FOLDER);
    const avatars = items.filter((a) => a.mediaType === 'image' && a.fileUrl)
      .map((a) => ({ id: a.id, url: a.fileUrl, name: a.originalName || 'Аватар' }));
    res.json({ avatars });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка загрузки коллекции аватаров' });
  }
});

/** POST /ugc/avatars/generate — догенерировать готовых аватаров (Gemini Nano Banana Pro).
 *  body: { count?: 1..4, brief?: string } → { avatars: [{id,url,name}], note? }. */
router.post('/ugc/avatars/generate', async (req: AuthedRequest, res: Response) => {
  try {
    const count = Math.max(1, Math.min(4, Number(req.body?.count) || 3));
    const brief = typeof req.body?.brief === 'string' ? req.body.brief.trim().slice(0, 300) : '';
    const apiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!apiKey) return res.status(400).json({ error: 'Подключите Gemini-ключ (Настройки → Gemini API) — аватары рисует Gemini.' });
    const shift = Math.floor(Math.random() * UGC_AVATAR_PERSONAS.length);
    const made: { id: string; url: string; name: string }[] = [];
    let failNote = '';
    // До count*2 попыток: транзиентный чих Gemini не должен срывать весь набор.
    for (let i = 0; i < count * 2 && made.length < count; i++) {
      const persona = brief || UGC_AVATAR_PERSONAS[(shift + i) % UGC_AVATAR_PERSONAS.length];
      try {
        const gen = await generateImage({ apiKey, model: PODCAST_ANGLE_MODEL, prompt: ugcAvatarPrompt(persona, brief && count > 1 ? i : -1) });
        const name = `Аватар — ${persona.split(',')[0]}`;
        const asset = await createAsset(req.tenantId!, {
          kind: 'reference', mediaType: 'image', originalName: name,
          fileUrl: gen.mediaUrl, filePath: gen.filePath, mime: gen.mediaMime, size: gen.mediaSize,
          folder: UGC_AVATARS_FOLDER,
        });
        made.push({ id: asset?.id || gen.mediaUrl, url: gen.mediaUrl, name });
      } catch (e: any) {
        failNote = e?.message || 'ошибка генерации';
        if (!isTransientGenError(e)) break; // ключ/фильтр/квота — дальнейшие попытки бессмысленны
      }
    }
    if (!made.length) return res.status(502).json({ error: `Gemini не вернул ни одного аватара${failNote ? ` (${failNote})` : ''}.` });
    res.json({ avatars: made, note: made.length < count ? `Готово ${made.length} из ${count}${failNote ? ` — ${failNote}` : ''}.` : undefined });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка генерации аватаров' });
  }
});

/** POST /ugc/avatars/add — добавить картинку из Галереи в коллекцию.
 *  body: { url, name? } → { avatar }. Без filePath: удаление из коллекции не тронет исходный файл. */
router.post('/ugc/avatars/add', async (req: AuthedRequest, res: Response) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    const name = (typeof req.body?.name === 'string' ? req.body.name.trim() : '').slice(0, 200) || 'Аватар';
    if (!url || !(url.startsWith('/') || /^https?:\/\//i.test(url))) return res.status(400).json({ error: 'Не указана картинка (url).' });
    // Аватар = фото анфас. Аудио/видео в коллекцию не пускаем (иначе «битая картинка» + рендер упадёт).
    if (/\.(mp3|wav|m4a|aac|ogg|flac|opus|mp4|mov|webm|mkv|avi|m4v)(\?|#|$)/i.test(url)) {
      return res.status(400).json({ error: 'В коллекцию аватаров можно добавить только фото (анфас), не аудио/видео.' });
    }
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: 'image', originalName: name, fileUrl: url, folder: UGC_AVATARS_FOLDER,
    });
    if (!asset) return res.status(500).json({ error: 'Не удалось сохранить аватар в коллекцию.' });
    res.json({ avatar: { id: asset.id, url: asset.fileUrl, name: asset.originalName || name } });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка добавления аватара' });
  }
});

/** DELETE /ugc/avatars/:id — убрать аватар из коллекции. */
router.delete('/ugc/avatars/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const ok = await deleteAsset(req.tenantId!, String(req.params.id || ''));
    if (!ok) return res.status(404).json({ error: 'Аватар не найден.' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка удаления аватара' });
  }
});

// ── Сборка UGC: аватар говорит скрипт → склейка с видео + титры ───
// composeUgc: vstack (сверху/снизу) или маленький аватар ПОВЕРХ видео
// (overlay-left/right, альфа = виден только человек).
const ugcJobs = new Map<string, {
  tenantId?: string; status: string; error?: string; fileUrl?: string; assetId?: string | null; ts: number;
  results?: { url: string; name: string }[]; total?: number; note?: string;
}>();

/** Реплики с таймкодами для планировщика удержания: если у скрипта нет валидных таймкодов
 *  (генерация текста), раскидываем по длине пропорционально длине текста. */
function linesForRetention(script: any[], durSec: number): RetLine[] {
  const raw = (Array.isArray(script) ? script : []).map((l) => ({ text: String(l?.text || '').trim(), start: Number(l?.start), end: Number(l?.end) })).filter((l) => l.text);
  if (!raw.length) return [];
  const haveTC = raw.every((l) => Number.isFinite(l.start) && Number.isFinite(l.end) && l.end > l.start);
  if (haveTC) return raw as RetLine[];
  const totalChars = raw.reduce((s, l) => s + l.text.length + 1, 0) || 1;
  let t = 0; const out: RetLine[] = [];
  for (const l of raw) { const d = durSec * ((l.text.length + 1) / totalChars); out.push({ text: l.text, start: t, end: t + d }); t += d; }
  return out;
}

/**
 * Отрендерить «говорящие головы» одним из двух путей и вернуть segIndex → локальный filePath.
 *  - 'api'  : HeyGen API (x-api-key, pay-as-you-go ~$3/мин) — как было всегда.
 *  - 'ext'  : очередь расширения (HeyGen по ПОДПИСКЕ клиента, втрое дешевле; enqueue → wait).
 * Обе ветки принимают один список HeadSpec — так три сценария (photo/удержание/диалоги)
 * рендерят лица единообразно, а выбор провайдера — один флаг. Каждая голова: своё фото +
 * аудио-сегмент (свой голос/ElevenLabs) + движок IV/III + размеры (+опц. хромакей).
 */
async function renderTalkingHeads(opts: {
  tenantId: string;
  jobId: string;
  provider: 'api' | 'ext';
  hgKey: string | null;                 // нужен только для 'api'
  heads: HeadSpec[];                    // photoUrl/audioUrl — уже АБСОЛЮТНЫЕ
  onProgress?: (done: number, total: number) => void;
}): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  if (!opts.heads.length) return out;

  // Подписочный путь: кладём головы в очередь расширения и ждём готовые mp4.
  if (opts.provider === 'ext') {
    const ids = await enqueueHeygenHeads(opts.tenantId, opts.jobId, opts.heads);
    const results = await waitHeygenHeads(opts.tenantId, ids, { onProgress: opts.onProgress });
    for (const r of results) out[r.segIndex] = r.filePath;
    return out;
  }

  // API-путь: talking_photo кэшируем по фото (одно фото = один upload), сабмит + поллинг.
  if (!opts.hgKey) throw new Error('нет ключа HeyGen');
  const tpCache = new Map<string, string>();
  const submitted: { segIndex: number; videoId: string }[] = [];
  for (const h of opts.heads) {
    let tpId = tpCache.get(h.photoUrl);
    if (!tpId) { tpId = await uploadTalkingPhoto(opts.hgKey, h.photoUrl); tpCache.set(h.photoUrl, tpId); }
    const videoId = await submitTalkingPhotoVideo(opts.hgKey, {
      talkingPhotoId: tpId, useIV: h.useIV !== false, expressive: h.expressive !== false,
      width: h.width || 1080, height: h.height || 1920, audioUrl: h.audioUrl,
      ...(h.bgColor ? { bgColor: h.bgColor } : {}),
    });
    submitted.push({ segIndex: h.segIndex, videoId });
  }
  const deadline = Date.now() + 30 * 60_000;
  const pending = new Set(submitted.map((x) => x.segIndex));
  while (pending.size && Date.now() < deadline) {
    await new Promise((r2) => setTimeout(r2, 5000));
    for (const { segIndex, videoId } of submitted) {
      if (!pending.has(segIndex)) continue;
      const st = await heygenVideoStatus(opts.hgKey, videoId);
      if (st.status === 'failed' || st.status === 'error') throw new Error(`HeyGen сегмент ${segIndex}: ${st.error || 'ошибка'}`);
      if (st.status === 'completed' && st.url) { const dl = await downloadToRenders(st.url, 'head'); out[segIndex] = dl.filePath; pending.delete(segIndex); }
    }
    opts.onProgress?.(submitted.length - pending.size, submitted.length);
  }
  if (pending.size) throw new Error('часть сегментов HeyGen не уложилась в 30 минут');
  return out;
}

/** POST /ugc/build — запустить сборку. body: { spec: UgcSpec-подмножество }. → { jobId }. */
router.post('/ugc/build', async (req: AuthedRequest, res: Response) => {
  try {
    const spec = req.body?.spec && typeof req.body.spec === 'object' ? req.body.spec : {};
    const script: any[] = Array.isArray(spec.script) ? spec.script : [];
    const placement: string = ['top', 'bottom', 'overlay-left', 'overlay-right'].includes(spec.placement) ? spec.placement : 'top';
    // Кастомные позиции аватара (драг на превью студии): per-format доли кадра 0..1.
    // oy — вертикальный сдвиг КАРТИНКИ внутри бокса (object-position Y, 0..1, деф. 0.5).
    const avatarRects: Partial<Record<UgcFormatKey, { x: number; y: number; w: number; h: number; oy: number }>> = {};
    if (spec.avatarRects && typeof spec.avatarRects === 'object') {
      const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
      for (const k of Object.keys(spec.avatarRects)) {
        if (!(k in UGC_FORMATS)) continue;
        const r = spec.avatarRects[k];
        const x = Number(r?.x), y = Number(r?.y), w = Number(r?.w), h = Number(r?.h);
        if (![x, y, w, h].every(Number.isFinite)) continue;
        const cw = cl(w, 0.05, 1), chh = cl(h, 0.05, 1);
        const oy = Number.isFinite(Number(r?.oy)) ? cl(Number(r.oy), 0, 1) : 0.5;
        avatarRects[k as UgcFormatKey] = { x: cl(x, 0, 1 - cw), y: cl(y, 0, 1 - chh), w: cw, h: chh, oy };
      }
    }
    // Дефолт по раскладке (ТА ЖЕ логика, что во фронте ugcTypes.avatarDefaultRect): раскладка =
    // стартовая позиция бокса. Соло всегда рендерится оверлеем по этому rect — превью == рендер.
    const defaultAvatarRect = (pl: string): { x: number; y: number; w: number; h: number; oy: number } => {
      if (pl === 'top') return { x: 0.06, y: 0.04, w: 0.88, h: 0.46, oy: 0.5 };
      if (pl === 'bottom') return { x: 0.06, y: 0.50, w: 0.88, h: 0.46, oy: 0.5 };
      if (pl === 'overlay-right') return { x: 0.52, y: 0.58, w: 0.44, h: 0.40, oy: 0.5 };
      return { x: 0.04, y: 0.58, w: 0.44, h: 0.40, oy: 0.5 };   // overlay-left и дефолт
    };
    const avatarRectFor = (k: UgcFormatKey) => avatarRects[k] || defaultAvatarRect(placement);
    const isPhoto = spec.avatarSource === 'photo';
    // Провайдер рендера лица: 'ext' = HeyGen по ПОДПИСКЕ через расширение браузера (втрое дешевле,
    // но нужна открытая вкладка студии HeyGen у клиента); иначе 'api' — HeyGen API (x-api-key).
    const faceProvider: 'api' | 'ext' = spec.faceProvider === 'heygen_ext' ? 'ext' : 'api';
    // «Коллекция» = выбранный аватар из Галереи; его картинка идёт в HeyGen как обычное фото.
    const galleryAvatarUrl = spec.avatarSource === 'collection' ? String(spec.avatarUrl || '') : '';
    const avatarPhotoUrl = String(spec.photoUrl || galleryAvatarUrl || '');
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const abs = (u: string) => /^https?:\/\//i.test(u) ? u : (base ? base + (u.startsWith('/') ? u : '/' + u) : u);
    const gender: 'male' | 'female' = spec.voice === 'male' ? 'male' : 'female';
    const voiceIdSpec: string | undefined = String(spec.voiceId || '').trim() || undefined;   // голос ElevenLabs из аккаунта клиента
    // Языки серии (перевод Claude → TTS multilingual): 'ru' — основной; работает для ИИ-текста
    // в ветках «Один ведущий» и «Без аватара» (запись не переводим — там свой голос).
    const langsSpec: string[] = Array.isArray(spec.langs)
      ? [...new Set((spec.langs as any[]).map((x) => String(x || '').toLowerCase().trim()).filter((x) => /^[a-z]{2,3}$/.test(x)))]
      : [];
    const voiceLangs: string[] = ['ru', ...langsSpec.filter((l) => l !== 'ru')];
    const scriptText = script.map((l) => String(l?.text || '').trim()).filter(Boolean).join(' ');
    const capStyle: 'none' | 'word' | 'karaoke' | 'plain' = ['none', 'word', 'karaoke', 'plain'].includes(spec.subtitles?.style) ? spec.subtitles.style : 'word';
    const capPos: 'bottom' | 'center' | 'top' = ['bottom', 'center', 'top'].includes(spec.subtitles?.pos) ? spec.subtitles.pos : 'bottom';
    // «Пожелания к стилю» титров: тот же детерминированный разбор, что красит живой пример
    // в превью студии (цвет/обводка/размер/подложка) — рендер обязан совпадать с превью.
    const capWish = parseCapWishes(String(spec.subtitles?.wishes || ''));
    const captions: UgcCaption[] = script
      .map((l) => ({ t0: Number(l?.start), t1: Number(l?.end), text: String(l?.text || '') }))
      .filter((c) => Number.isFinite(c.t0) && Number.isFinite(c.t1) && c.t1 > c.t0 && c.text.trim());
    // Форматы вывода: 9:16 / 16:9 / 1:1 / 4:5, любые сочетания. Аватар рендерим 1 раз, склейку — на каждый формат.
    const FMT_LABEL: Record<UgcFormatKey, string> = { '9x16': '9:16', '16x9': '16:9', '1x1': '1:1', '4x5': '4:5' };
    const fmtKeys: UgcFormatKey[] = (Array.isArray(spec.formats) ? spec.formats : []).filter((f: any): f is UgcFormatKey => f in UGC_FORMATS);
    const outFormats: { key: UgcFormatKey; dims: FrameDims; label: string }[] = (fmtKeys.length ? fmtKeys : (['9x16'] as UgcFormatKey[]))
      .map((k) => ({ key: k, dims: UGC_FORMATS[k], label: FMT_LABEL[k] }));
    // Музыка: играть первые N секунд (иначе весь ролик) — общий парс для всех веток.
    const musicDurSec: number | null = Number(spec.music?.durationSec) > 0 ? Number(spec.music.durationSec) : null;
    // Верхний PNG-слой (свой на каждый формат) + полоса прогресса + заставки до/после.
    const layerUrlFor = (key: UgcFormatKey): string => String(spec.layers?.[key]?.url || '');
    const progressBar = !!spec.progressBar;
    // Автопилот/шаблоны: папка результата ('auto-ugc' у автоматических) + своё имя ролика.
    const outFolder: string = spec.outFolder === 'auto-ugc' ? 'auto-ugc' : 'ugc';
    const titlePrefix: string = String(spec.title || '').trim().slice(0, 90);
    const nameFor = (fallback: string): string => titlePrefix || fallback;
    // «Использовать анализ»: ДНК тренда для режиссуры (retention/диалог) — передаётся
    // готовым объектом (brief/sceneBeats/hookAnalysis), БД в сборке не дёргаем.
    const analysisSpec: { brief?: string; hookAnalysis?: string } | null =
      spec.analysis && typeof spec.analysis === 'object'
        ? { brief: String(spec.analysis.brief || '').slice(0, 2200), hookAnalysis: String(spec.analysis.hookAnalysis || '').slice(0, 600) }
        : null;
    const trendBriefForDirector = analysisSpec
      ? [analysisSpec.brief, analysisSpec.hookAnalysis && `Разбор первых секунд оригинала: ${analysisSpec.hookAnalysis}`].filter(Boolean).join('\n')
      : undefined;
    const introUrl = String(spec.intro?.url || '');
    const outroUrl = String(spec.outro?.url || '');
    // Врезки медиа реплик (для соло и «Без аватара»): нужны валидные таймкоды разбора.
    const insertSpecs: { url: string; isVideo: boolean; t0: number; t1: number }[] = script
      .filter((l) => l?.image && Number.isFinite(Number(l?.start)) && Number.isFinite(Number(l?.end)) && Number(l.end) > Number(l.start))
      .slice(0, 12)
      .map((l) => ({ url: String(l.image), isVideo: /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(String(l.image)), t0: Number(l.start), t1: Number(l.end) }));
    // «Видеоряд из фото»: изображения → слайдшоу-клип (1 фото = статичный кадр,
    // несколько = перелистывание по кругу с кроссфейдом), дальше ВЕСЬ конвейер
    // (все 4 ветки) видит обычный spec.clip — ветки не трогаем. Видео приоритетнее фото.
    // Битые картинки пропускаем (слайдшоу из остальных); совсем пусто → честный 400.
    const clipImages: string[] = Array.isArray(spec.clipImages)
      ? (spec.clipImages as any[]).map((x) => String(x?.url || '')).filter(Boolean).slice(0, 12)
      : [];
    if (!spec.clip?.url && clipImages.length) {
      const imgPaths: string[] = [];
      for (const u of clipImages) {
        try { imgPaths.push((await downloadToRenders(abs(u), 'ugcimg')).filePath); }
        catch { /* одна битая картинка не должна ронять весь запуск */ }
      }
      if (!imgPaths.length) return res.status(400).json({ error: 'Ни одно фото слайдшоу не удалось загрузить — проверьте файлы в Галерее.' });
      // Размер кадра — КРУПНЕЙШИЙ из выбранных форматов: остальные получают cover-кроп
      // из максимума пикселей (а не апскейл узкой полосы).
      const bigDims = outFormats.reduce((a, b) => (b.dims.W * b.dims.H > a.dims.W * a.dims.H ? b : a)).dims;
      try {
        const slide = await composeSlideshow({ imagePaths: imgPaths, dims: bigDims });
        spec.clip = { url: slide.fileUrl, name: `слайдшоу · ${imgPaths.length} фото` };
      } catch (e: any) {
        return res.status(400).json({ error: `Не удалось собрать слайдшоу из фото: ${String(e?.message || e).slice(0, 200)}` });
      }
    }
    // Общие загрузчики: слои per-format, заставки, врезки (кэш по url) — используются ветками ниже.
    const dlLayers = async (): Promise<Partial<Record<UgcFormatKey, string>>> => {
      const out: Partial<Record<UgcFormatKey, string>> = {};
      for (const f of outFormats) {
        const u = layerUrlFor(f.key);
        if (u) out[f.key] = (await downloadToRenders(abs(u), 'ugclyr')).filePath;
      }
      return out;
    };
    const dlBumpers = async (): Promise<{ intro: string | null; outro: string | null }> => ({
      intro: introUrl ? (await downloadToRenders(abs(introUrl), 'ugcin')).filePath : null,
      outro: outroUrl ? (await downloadToRenders(abs(outroUrl), 'ugcout')).filePath : null,
    });
    const dlInserts = async (): Promise<{ path: string; isVideo: boolean; t0: number; t1: number }[]> => {
      const cache = new Map<string, string>();
      const out: { path: string; isVideo: boolean; t0: number; t1: number }[] = [];
      for (const ins of insertSpecs) {
        if (!cache.has(ins.url)) cache.set(ins.url, (await downloadToRenders(abs(ins.url), ins.isVideo ? 'ugcinsv' : 'ugcinsi')).filePath);
        out.push({ path: cache.get(ins.url)!, isVideo: ins.isVideo, t0: ins.t0, t1: ins.t1 });
      }
      return out;
    };

    // ── Ветка «Без аватара — озвучка» ────────────────────────────────────────────
    // Ваше видео + голос (своя запись как есть ИЛИ текст → ElevenLabs). HeyGen не участвует:
    // цена ≈ только озвучка. Врезки медиа реплик (по таймкодам разбора), слой, прогресс,
    // субтитры, музыка и заставки — как в остальных ветках. loudnorm ровняет свою запись.
    if (spec.noAvatar) {
      const useRecording = spec.source === 'diarize' && spec.recordingUrl;
      if (!useRecording && !scriptText) return res.status(400).json({ error: 'Нет текста: сгенерируйте скрипт или загрузите запись.' });
      const elevenKey = useRecording ? null : await getEffectiveProviderKey(req.tenantId!, 'elevenlabs');
      if (!useRecording && !elevenKey) return res.status(400).json({ error: 'Для озвучки текста нужен ключ ElevenLabs (Настройки → Генерация), либо используйте свою запись.' });
      const loudnormOn = !!useRecording && spec.loudnorm !== false;

      // Языки серии — только для ИИ-текста (свою запись не переводим).
      const langs = useRecording ? ['ru'] : voiceLangs;
      const jobId = `ugc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      sweepJobs(ugcJobs);
      ugcJobs.set(jobId, { tenantId: req.tenantId, status: 'запуск', ts: Date.now(), total: outFormats.length * langs.length, results: [] });
      res.json({ jobId });

      void (async () => {
        const j = ugcJobs.get(jobId)!;
        try {
          const clip = spec.clip?.url ? await downloadToRenders(abs(String(spec.clip.url)), 'ugcclip') : null;
          const music = spec.music?.url ? await downloadToRenders(abs(String(spec.music.url)), 'ugcmusic') : null;
          const layers = await dlLayers();
          const bmp = await dlBumpers();
          const inserts = await dlInserts();
          let made = 0; const skippedLangs: string[] = [];
          // У ИИ-текста нет таймкодов разбора → субтитры строим примерно: реплики (или предложения
          // перевода) раскладываются по длительности голоса пропорционально длине текста.
          const approxCaps = (text: string, srcLines: string[], D: number): UgcCaption[] => {
            const parts = (srcLines.length ? srcLines : text.split(/(?<=[.!?…])\s+/))
              .map((s) => s.trim()).filter(Boolean).slice(0, 60);
            const totalChars = parts.reduce((s2, p2) => s2 + p2.length, 0) || 1;
            let t0 = 0; const out: UgcCaption[] = [];
            for (const p2 of parts) {
              const d = Math.max(0.8, (p2.length / totalChars) * D);
              out.push({ t0, t1: Math.min(D, t0 + d), text: p2 });
              t0 += d;
            }
            return out.filter((c) => c.t1 > c.t0 + 0.2);
          };

          for (const lang of langs) {
            // 1) текст на языке серии (Claude) — 'ru' идёт как есть; провал перевода = пропуск языка.
            let text = scriptText;
            if (lang !== 'ru') {
              j.status = `перевод · ${lang.toUpperCase()}`;
              const tr = await translateUgcScript({ tenantId: j.tenantId!, text: scriptText, lang });
              if (!tr) { skippedLangs.push(lang); continue; }
              text = tr;
            }
            // 2) голос: запись как есть ИЛИ TTS на языке (ElevenLabs multilingual).
            j.status = useRecording ? 'готовлю запись' : `озвучка (ElevenLabs${lang !== 'ru' ? ` · ${lang.toUpperCase()}` : ''})`;
            const voiceUrl = useRecording ? abs(String(spec.recordingUrl)) : abs(await elevenTTS(elevenKey!, text.slice(0, 2500), gender, voiceIdSpec));
            const voice = await downloadToRenders(voiceUrl, 'ugcvoice');
            const langSuffix = lang !== 'ru' ? ` · ${lang.toUpperCase()}` : '';
            // 3) субтитры: точные таймкоды разбора; иначе — примерная раскладка по голосу.
            let capsForLang = captions;
            if (!capsForLang.length && capStyle !== 'none' && scriptText) {
              const Dv = await mediaDuration(voice.filePath);
              if (Dv > 1) capsForLang = approxCaps(text, lang === 'ru' ? script.map((l) => String(l?.text || '')) : [], Dv);
            }

            for (let f = 0; f < outFormats.length; f++) {
              const fmt = outFormats[f];
              made++;
              j.status = `склейка ${fmt.label}${langSuffix} (${made}/${j.total})`;
              let fileUrl = await composeVoiceover({
                clipPath: clip?.filePath || null,
                clipFit: spec.clipFit === 'contain' ? 'contain' : 'cover',
                clipMuted: spec.clipMuted !== false,
                voicePath: voice.filePath,
                loudnorm: loudnormOn,
                musicPath: music?.filePath || null,
                musicVolumePct: Number(spec.music?.volumePct) || 20,
                musicDurationSec: musicDurSec,
                captions: capsForLang, capStyle: capsForLang.length ? capStyle : 'none', capPos, capWish, dims: fmt.dims,
                inserts: inserts as UgcInsert[],
                layerPath: layers[fmt.key] || null,
                progressBar,
              });
              if (bmp.intro || bmp.outro) {
                j.status = 'приклеиваю заставки';
                fileUrl = await concatBumpers({ mainPath: fileUrl, introPath: bmp.intro, outroPath: bmp.outro, dims: fmt.dims });
              }
              const asset = await createAsset(j.tenantId!, {
                kind: 'reference', mediaType: 'video',
                originalName: `${nameFor('UGC — озвучка без аватара')}${outFormats.length > 1 ? ` · ${fmt.label}` : ''}${langSuffix}`,
                fileUrl, mime: 'video/mp4', folder: outFolder,
              });
              j.results!.push({ url: fileUrl, name: asset?.originalName || 'ролик' });
              if (!j.fileUrl) { j.fileUrl = fileUrl; j.assetId = asset?.id || null; }
            }
          }
          if (!j.results!.length) throw new Error(skippedLangs.length ? `перевод не удался (${skippedLangs.join(', ')}) — проверьте ключ Claude` : 'нет результатов');
          j.note = skippedLangs.length ? `пропущены языки: ${skippedLangs.join(', ')} (перевод недоступен)` : undefined;
          j.status = 'done';
        } catch (e: any) {
          j.status = 'failed'; j.error = String(e?.message || e).slice(0, 400);
          console.warn('[ugc/build voiceover] FAILED:', j.error);
        }
      })();
      return;
    }

    // ── Ветка «Диалоги» (два аватара HeyGen под одну запись) ────────────────────
    // Разбор записи на 2 голоса (A/B) → каждый говорит своим лицом. Claude решает per-turn:
    // крупный план / оба в кадре / врезка медиа + движок IV/III (экономия). Медиа реплики умно:
    // раскладка «Авто» (Claude) или задана; растяжка медиа сдвигает последующие реплики.
    if (spec.dialogue?.enabled) {
      if (!isPhoto) return res.status(400).json({ error: 'Диалоги работают в режиме «Своё фото» (HeyGen).' });
      const useRecording = spec.source === 'diarize' && spec.recordingUrl;
      if (!useRecording) return res.status(400).json({ error: 'Для диалога разберите запись двух голосов (вкладка «Разобрать запись»).' });
      const photoA: string = String(spec.dialogue.photoA || spec.photoUrl || '');
      const photoB: string = String(spec.dialogue.photoB || '');
      if (!photoA || !photoB) return res.status(400).json({ error: 'Загрузите два фото: «Спикер A» и «Спикер B».' });
      const hgKey = faceProvider === 'api' ? await getEffectiveProviderKey(req.tenantId!, 'heygen') : null;
      if (faceProvider === 'api' && !hgKey) return res.status(400).json({ error: 'Для диалога нужен ключ HeyGen (Avatar IV/III) — Настройки → Генерация, либо переключите провайдер на «HeyGen по подписке».' });
      if (!base) return res.status(400).json({ error: 'PUBLIC_BASE_URL не настроен — HeyGen не скачает аудио.' });
      const engagement: DlgEngagement = ['eco', 'bal', 'dyn'].includes(spec.dialogue.engagement) ? spec.dialogue.engagement : 'bal';
      const cutout = !!spec.dialogue.cutout; // вырезать фон аватара в раскладке «фон+лицо сбоку»
      const isBgLayout = (l: string) => l === 'media-bg-left' || l === 'media-bg-right';
      const isVid = (u: string) => /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(u);

      const jobId = `ugc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      sweepJobs(ugcJobs);
      ugcJobs.set(jobId, { tenantId: req.tenantId, status: 'запуск', ts: Date.now(), total: outFormats.length, results: [] });
      res.json({ jobId });

      void (async () => {
        const j = ugcJobs.get(jobId)!;
        try {
          // 1) запись (мастер-голос двух спикеров) + два фото + два talking_photo
          j.status = 'готовлю голос';
          const rec = await downloadToRenders(abs(String(spec.recordingUrl)), 'dlgrec');
          const Drec = await mediaDuration(rec.filePath);
          if (!(Drec > 1)) throw new Error('запись пустая/короткая');
          j.status = 'готовлю фото спикеров';
          // pA/pB — локальные копии фото для two-shot (второй спикер статичным фото). Загрузку
          // talking_photo в HeyGen делает renderTalkingHeads (кэш по фото — каждое грузится 1 раз).
          const [pA, pB] = await Promise.all([downloadToRenders(abs(photoA), 'dlgpa'), downloadToRenders(abs(photoB), 'dlgpb')]);

          // 2) план сегментов + LLM-режиссура (движок IV/III, two-shot, раскладка медиа)
          j.status = 'план диалога (LLM)';
          const linesIn: DlgLineIn[] = script.map((l: any) => ({
            speaker: l?.speaker === 'B' ? 'B' : 'A', text: String(l?.text || ''),
            start: Number(l?.start), end: Number(l?.end),
            image: l?.image ? String(l.image) : null, isVideo: l?.image ? isVid(String(l.image)) : false,
            layoutHint: ['auto', 'media-full', 'media-bg-left', 'media-bg-right', 'media-split'].includes(l?.layoutHint) ? l.layoutHint : 'auto',
            holdSec: Number(l?.holdSec) || 0,
          }));
          const { segs, preset } = planDialogue(linesIn, engagement);
          if (!segs.length) throw new Error('нет реплик — разберите запись');
          const faceSpeech = segs.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'speech' && x.s.speaker);
          const dir = await directDialogue({
            tenantId: j.tenantId!,
            turns: faceSpeech.map((x) => ({ i: x.i, speaker: x.s.speaker as 'A' | 'B', text: x.s.text, hasMedia: !!x.s.image, mediaAuto: x.s.mediaAuto })),
            ivMax: preset.ivMax, twoshotMax: preset.twoshotMax,
          });
          if (dir.scores.length) applyDlgBudget(segs, dir.scores, preset);
          else applyDlgBudget(segs, scoreDialogueHeuristic(segs), preset);
          const ivN = segs.filter((s) => s.engine === 'iv').length;
          const tsN = segs.filter((s) => s.layout === 'twoshot').length;
          j.note = `${dir.note}; IV ${ivN}, два-шот ${tsN}`;

          // 3) медиа реплик — качаем локально (по одному разу)
          const mediaCache = new Map<string, string>();
          for (const s of segs) if (s.image && !mediaCache.has(s.image)) {
            const dl = await downloadToRenders(abs(s.image), s.isVideo ? 'dlgmv' : 'dlgmi'); mediaCache.set(s.image, dl.filePath);
          }

          // 4) рендер лиц: только там, где лицо видно (media-full/держание — без лица = дёшево).
          // Каждая голова — фото своего спикера (A/B), движок IV/III; 'ext' = по подписке через расширение.
          j.status = faceProvider === 'ext' ? 'рендер лиц по подписке (открой вкладку студии HeyGen)' : 'рендер лиц (HeyGen)';
          const faceSegs = segs.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'speech' && x.s.speaker && x.s.layout !== 'media-full' && x.s.srcT0 != null && x.s.srcT1 != null);
          const photoAabs = abs(photoA), photoBabs = abs(photoB);
          const heads: HeadSpec[] = [];
          for (const { s, i } of faceSegs) {
            const slice = await sliceAudioToRenders(rec.filePath, s.srcT0 as number, s.srcT1 as number, 'dlgseg');
            heads.push({
              segIndex: i, photoUrl: s.speaker === 'A' ? photoAabs : photoBabs,
              audioUrl: abs(slice.fileUrl), useIV: s.engine === 'iv', width: 1080, height: 1920, expressive: true,
              // фон+лицо сбоку + вырезка → рендерим на зелёном (HeyGen матирует фото), потом chroma-key
              ...(cutout && isBgLayout(s.layout) ? { bgColor: '#00FF00' } : {}),
            });
          }
          const avatarPaths = await renderTalkingHeads({
            tenantId: j.tenantId!, jobId, provider: faceProvider, hgKey, heads,
            onProgress: (d, t) => { j.status = `рендер лиц (${d}/${t})`; },
          });

          // 5) склейка: голос (с растяжкой) + видео сегментов + титры + музыка
          j.status = 'склейка голоса';
          const voiceParts: DlgVoicePart[] = segs.map((s) => ({
            dur: s.t1 - s.t0, srcT0: s.srcT0, srcT1: s.srcT1, kind: s.kind,
            mediaPath: s.image ? mediaCache.get(s.image) || null : null, isVideo: s.isVideo, mediaFromSec: s.mediaFromSec,
          }));
          const voice = await buildDialogueVoice({ recordingPath: rec.filePath, parts: voiceParts });
          const composeSegs: DlgComposeSeg[] = segs.map((s, i) => ({
            dur: s.t1 - s.t0, layout: s.layout,
            avatarPath: (s.layout === 'media-full' || s.kind === 'hold') ? null : (avatarPaths[i] || null),
            avatar2Path: s.layout === 'twoshot' ? (s.speaker === 'A' ? pB.filePath : pA.filePath) : null, avatar2IsImage: true,
            avatarChroma: cutout && isBgLayout(s.layout) ? '0x00FF00' : null,
            mediaPath: s.image ? mediaCache.get(s.image) || null : null, isVideo: s.isVideo, mediaFromSec: s.mediaFromSec,
          }));
          const caps: UgcCaption[] = segs.filter((s) => s.kind === 'speech' && s.text.trim()).map((s) => ({ t0: s.t0, t1: s.t1, text: s.text }));
          const music = spec.music?.url ? await downloadToRenders(abs(String(spec.music.url)), 'dlgmusic') : null;
          const layers = await dlLayers();
          const bmp = await dlBumpers();
          // склейка в каждый формат (аватар уже отрендерен один раз — форматы почти бесплатны)
          for (let f = 0; f < outFormats.length; f++) {
            const fmt = outFormats[f];
            j.status = outFormats.length > 1 ? `склейка ${fmt.label} (${f + 1}/${outFormats.length})` : 'финальная склейка';
            let fileUrl = await composeDialogueVideo({
              segments: composeSegs, voicePath: voice.filePath,
              musicPath: music?.filePath || null, musicVolumePct: Number(spec.music?.volumePct) || 20,
              musicDurationSec: musicDurSec,
              layerPath: layers[fmt.key] || null, progressBar,
              captions: caps, capStyle: caps.length ? capStyle : 'none', capPos, capWish, dims: fmt.dims,
            });
            if (bmp.intro || bmp.outro) {
              j.status = 'приклеиваю заставки';
              fileUrl = await concatBumpers({ mainPath: fileUrl, introPath: bmp.intro, outroPath: bmp.outro, dims: fmt.dims });
            }
            const asset = await createAsset(j.tenantId!, {
              kind: 'reference', mediaType: 'video', originalName: `${nameFor(`UGC-диалог (${engagement})`)}${outFormats.length > 1 ? ` · ${fmt.label}` : ''}`, fileUrl, mime: 'video/mp4', folder: outFolder,
            });
            j.results!.push({ url: fileUrl, name: asset?.originalName || 'ролик' });
            if (f === 0) { j.fileUrl = fileUrl; j.assetId = asset?.id || null; }
          }
          j.status = 'done';
        } catch (e: any) {
          j.status = 'failed'; j.error = String(e?.message || e).slice(0, 400);
          console.warn('[ugc/build dialogue] FAILED:', j.error);
        }
      })();
      return;
    }

    // ── Ветка «Удержание» (сегментный конвейер, HeyGen IV/III) ──────────────────
    // Голос/скрипт один → аватар рендерим ОДИН РАЗ (посегментно IV/III), а склейку гоним по
    // каждому B-roll. Значит батч из N видео = стоимость HeyGen как за один ролик (меняется
    // только фон). Только HeyGen (IV/III) — SpatialReal не мешаем.
    if (spec.retention?.preset && isPhoto) {
      if (!spec.photoUrl) return res.status(400).json({ error: 'Загрузите своё фото (портрет анфас) во вкладке «Своё фото».' });
      const hgKey = faceProvider === 'api' ? await getEffectiveProviderKey(req.tenantId!, 'heygen') : null;
      if (faceProvider === 'api' && !hgKey) return res.status(400).json({ error: 'Для удержания нужен ключ HeyGen (Avatar IV/III) — Настройки → Генерация, либо переключите провайдер на «HeyGen по подписке».' });
      const useRecording = spec.source === 'diarize' && spec.recordingUrl;
      const elevenKey = useRecording ? null : await getEffectiveProviderKey(req.tenantId!, 'elevenlabs');
      if (!useRecording && !scriptText) return res.status(400).json({ error: 'Нет текста: сгенерируйте скрипт или разберите запись.' });
      if (!useRecording && !elevenKey) return res.status(400).json({ error: 'Для озвучки текста нужен ключ ElevenLabs, либо используйте «Разобрать запись».' });
      if (!base) return res.status(400).json({ error: 'PUBLIC_BASE_URL не настроен — HeyGen не скачает аудио.' });

      const brolls: { url: string; name: string }[] = Array.isArray(spec.retention.brolls) && spec.retention.brolls.length
        ? spec.retention.brolls.filter((b: any) => b?.url).map((b: any) => ({ url: String(b.url), name: String(b.name || 'видео') }))
        : (spec.clip?.url ? [{ url: String(spec.clip.url), name: String(spec.clip.name || 'видео') }] : [{ url: '', name: '' }]);
      const preset = getRetentionPreset(String(spec.retention.preset));
      const clipFit: 'cover' | 'contain' = spec.clipFit === 'contain' ? 'contain' : 'cover';

      const jobId = `ugc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      sweepJobs(ugcJobs);
      ugcJobs.set(jobId, { tenantId: req.tenantId, status: 'запуск', ts: Date.now(), total: brolls.length * outFormats.length, results: [] });
      res.json({ jobId });

      void (async () => {
        const j = ugcJobs.get(jobId)!;
        try {
          // 1) непрерывный голос + локальный файл + длина
          j.status = 'готовлю голос';
          const voiceUrl = useRecording ? String(spec.recordingUrl) : await elevenTTS(elevenKey!, scriptText.slice(0, 2500), gender, voiceIdSpec);
          const voice = await downloadToRenders(abs(voiceUrl), 'retvoice');
          const D = await mediaDuration(voice.filePath);
          if (!(D > 1)) throw new Error('голос пустой/короткий');

          // 2) план сегментов + LLM-разметка IV
          j.status = 'план удержания (LLM)';
          const lines = linesForRetention(script, D);
          const windows = planWindows(lines, preset, D);
          const tag = await tagUgcRetention({ tenantId: j.tenantId!, segments: windows.map((w) => w.text), ivMax: preset.ivMax, trendBrief: trendBriefForDirector });
          let segsPlan: RetSegment[] = windows;
          if (tag.scores.length) applyIvBudget(segsPlan, tag.scores, preset.ivMax);
          else segsPlan = planRetention(lines, preset, D); // фолбэк-эвристика
          const faceCount = segsPlan.filter((s) => s.engine !== 'free').length;
          j.note = `${tag.note}; лицевых сегментов ${faceCount}`;

          // 3) нарезка аудио под лицевые сегменты + рендер голов (посегментно IV/III).
          // Одно фото на все головы (хелпер кэширует talking_photo). 'ext' = по подписке через расширение.
          j.status = faceProvider === 'ext' ? 'рендер лица по подписке (открой вкладку студии HeyGen)' : 'рендер лица (HeyGen)';
          const faceIdx = segsPlan.map((s, i) => ({ s, i })).filter((x) => x.s.engine !== 'free');
          const photoAbs = abs(String(spec.photoUrl));
          const heads: HeadSpec[] = [];
          for (const { s, i } of faceIdx) {
            const slice = await sliceAudioToRenders(voice.filePath, s.t0, s.t1, 'retseg');
            heads.push({ segIndex: i, photoUrl: photoAbs, audioUrl: abs(slice.fileUrl), useIV: s.engine === 'iv', width: 1080, height: 1920, expressive: true });
          }
          const avatarPaths = await renderTalkingHeads({
            tenantId: j.tenantId!, jobId, provider: faceProvider, hgKey, heads,
            onProgress: (d, t) => { j.status = `рендер лица (${d}/${t})`; },
          });

          // 5) склейка по каждому B-roll (аватар переиспользуем — батч дешёвый)
          const composeSegs = (segsPlan.map((s, i) => ({
            dur: s.t1 - s.t0, layout: s.layout, placement: (s.layout === 'split' && i % 2 === 1) ? 'bottom' : 'top',
            avatarPath: s.engine === 'free' ? null : (avatarPaths[i] || null),
          })) as RetComposeSeg[]);
          const capStyleR: 'none' | 'word' | 'karaoke' | 'plain' = capStyle;
          const caps: UgcCaption[] = lines.map((l) => ({ t0: l.start, t1: l.end, text: l.text })).filter((c) => c.t1 > c.t0 && c.text.trim());
          const music = spec.music?.url ? await downloadToRenders(abs(String(spec.music.url)), 'retmusic') : null;
          const layers = await dlLayers();
          const bmp = await dlBumpers();

          const totalOut = brolls.length * outFormats.length;
          for (let b = 0; b < brolls.length; b++) {
            const clip = brolls[b].url ? await downloadToRenders(abs(brolls[b].url), 'retclip') : null;
            for (let f = 0; f < outFormats.length; f++) {
              const fmt = outFormats[f]; const n = b * outFormats.length + f + 1;
              j.status = totalOut > 1 ? `склейка ${n}/${totalOut}` : 'склейка + титры';
              let fileUrl = await composeRetentionVideo({
                segments: composeSegs, brollPath: clip?.filePath || null, voicePath: voice.filePath,
                clipFit, musicPath: music?.filePath || null, musicVolumePct: Number(spec.music?.volumePct) || 20,
                musicDurationSec: musicDurSec,
                layerPath: layers[fmt.key] || null, progressBar,
                captions: caps, capStyle: caps.length ? capStyleR : 'none', capPos, capWish, dims: fmt.dims,
              });
              if (bmp.intro || bmp.outro) {
                j.status = 'приклеиваю заставки';
                fileUrl = await concatBumpers({ mainPath: fileUrl, introPath: bmp.intro, outroPath: bmp.outro, dims: fmt.dims });
              }
              const asset = await createAsset(j.tenantId!, {
                kind: 'reference', mediaType: 'video',
                originalName: `${nameFor(`UGC-удержание ${preset.name}`)}${brolls.length > 1 ? ` — ${brolls[b].name}` : ''}${outFormats.length > 1 ? ` · ${fmt.label}` : ''}`,
                fileUrl, mime: 'video/mp4', folder: outFolder,
              });
              j.results!.push({ url: fileUrl, name: asset?.originalName || 'ролик' });
              if (b === 0 && f === 0) { j.fileUrl = fileUrl; j.assetId = asset?.id || null; }
            }
          }
          j.status = 'done';
        } catch (e: any) {
          j.status = 'failed'; j.error = String(e?.message || e).slice(0, 400);
          console.warn('[ugc/build retention] FAILED:', j.error);
        }
      })();
      return;
    }

    // ── Ветка «Своё фото» / «Коллекция» → HeyGen Avatar IV (галерейный аватар = то же фото) ──
    // Озвучка: своя запись (diarize) ИЛИ текст → ElevenLabs (11 Labs) → HeyGen поёт наше аудио.
    if (isPhoto || galleryAvatarUrl) {
      if (!avatarPhotoUrl) return res.status(400).json({ error: 'Выберите аватара из коллекции или загрузите своё фото (вкладка «Своё фото»).' });
      const hgKey = faceProvider === 'api' ? await getEffectiveProviderKey(req.tenantId!, 'heygen') : null;
      if (faceProvider === 'api' && !hgKey) return res.status(400).json({ error: 'Для оживления фото добавьте ключ HeyGen в Настройки → Генерация (Avatar IV), либо переключите провайдер на «HeyGen по подписке».' });
      const useRecording = spec.source === 'diarize' && spec.recordingUrl;
      if (!useRecording && !scriptText) return res.status(400).json({ error: 'Нет текста: сгенерируйте скрипт или разберите запись.' });
      const elevenKey = useRecording ? null : await getEffectiveProviderKey(req.tenantId!, 'elevenlabs');
      if (!useRecording && !elevenKey) return res.status(400).json({ error: 'Для озвучки текста нужен ключ ElevenLabs (Настройки → Генерация), либо используйте «Разобрать запись».' });
      if (!base) return res.status(400).json({ error: 'PUBLIC_BASE_URL не настроен — HeyGen не скачает аудио.' });

      // Языки серии — только для ИИ-текста; ВНИМАНИЕ: аватар HeyGen рендерится на КАЖДЫЙ язык (дороже).
      const langs = useRecording ? ['ru'] : voiceLangs;
      const jobId = `ugc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      sweepJobs(ugcJobs);
      ugcJobs.set(jobId, { tenantId: req.tenantId, status: 'запуск', ts: Date.now(), total: outFormats.length * langs.length, results: [] });
      res.json({ jobId });

      void (async () => {
        const j = ugcJobs.get(jobId)!;
        try {
          const clip = spec.clip?.url ? await downloadToRenders(abs(String(spec.clip.url)), 'ugcclip') : null;
          const music = spec.music?.url ? await downloadToRenders(abs(String(spec.music.url)), 'ugcmusic') : null;
          const layers = await dlLayers();
          const bmp = await dlBumpers();
          const inserts = await dlInserts();   // врезки медиа реплик (только при таймкодах разбора)
          let made = 0; const skippedLangs: string[] = [];

          for (const lang of langs) {
            let text = scriptText;
            if (lang !== 'ru') {
              j.status = `перевод · ${lang.toUpperCase()}`;
              const tr = await translateUgcScript({ tenantId: j.tenantId!, text: scriptText, lang });
              if (!tr) { skippedLangs.push(lang); continue; }
              text = tr;
            }
            const langSuffix = lang !== 'ru' ? ` · ${lang.toUpperCase()}` : '';
            j.status = useRecording ? 'готовлю запись' : `озвучка (ElevenLabs${langSuffix})`;
            const voiceUrl = useRecording ? abs(String(spec.recordingUrl)) : abs(await elevenTTS(elevenKey!, text.slice(0, 2500), gender, voiceIdSpec));
            // Голова: цельный Avatar IV на всю дорожку голоса. 'ext' = по подписке через расширение.
            j.status = faceProvider === 'ext' ? 'аватар по подписке (открой вкладку студии HeyGen)' : `генерирую аватар (Avatar IV${langSuffix})`;
            const heads = await renderTalkingHeads({
              tenantId: j.tenantId!, jobId: `${jobId}${lang !== 'ru' ? `-${lang}` : ''}`, provider: faceProvider, hgKey,
              heads: [{ segIndex: 0, photoUrl: abs(avatarPhotoUrl), audioUrl: voiceUrl, useIV: true, width: 1080, height: 1920, expressive: true }],
              onProgress: (d, t2) => { j.status = faceProvider === 'ext' ? `аватар по подписке (${d}/${t2})` : `генерирую аватар (Avatar IV${langSuffix})`; },
            });
            const avatarPath = heads[0];
            if (!avatarPath) throw new Error('HeyGen не отдал видео');

            for (let f = 0; f < outFormats.length; f++) {
              const fmt = outFormats[f];
              made++;
              j.status = `склейка ${fmt.label}${langSuffix} (${made}/${j.total})`;
              let fileUrl = await composeUgc({
                avatarPath, avatarKind: 'opaque',
                voicePath: avatarPath, // голос уже в mp4 HeyGen — берём его аудио
                clipPath: clip?.filePath || null,
                clipFit: spec.clipFit === 'contain' ? 'contain' : 'cover',
                clipMuted: spec.clipMuted !== false,
                placement: placement as any,
                avatarRect: avatarRectFor(fmt.key),   // соло всегда оверлеем: кастом ИЛИ дефолт раскладки (== превью)
                musicPath: music?.filePath || null,
                musicVolumePct: Number(spec.music?.volumePct) || 20,
                musicDurationSec: musicDurSec,
                inserts: inserts as UgcInsert[],
                layerPath: layers[fmt.key] || null, progressBar,
                captions, capStyle: captions.length ? capStyle : 'none', capPos, capWish, dims: fmt.dims,
              });
              if (bmp.intro || bmp.outro) {
                j.status = 'приклеиваю заставки';
                fileUrl = await concatBumpers({ mainPath: fileUrl, introPath: bmp.intro, outroPath: bmp.outro, dims: fmt.dims });
              }
              const asset = await createAsset(j.tenantId!, {
                kind: 'reference', mediaType: 'video', originalName: `${nameFor(`UGC — своё фото (Avatar IV${faceProvider === 'ext' ? ', подписка' : ''})`)}${outFormats.length > 1 ? ` · ${fmt.label}` : ''}${langSuffix}`, fileUrl, mime: 'video/mp4', folder: outFolder,
              });
              j.results!.push({ url: fileUrl, name: asset?.originalName || 'ролик' });
              if (!j.fileUrl) { j.fileUrl = fileUrl; j.assetId = asset?.id || null; }
            }
          }
          if (!j.results!.length) throw new Error(skippedLangs.length ? `перевод не удался (${skippedLangs.join(', ')}) — проверьте ключ Claude` : 'нет результатов');
          j.note = skippedLangs.length ? `пропущены языки: ${skippedLangs.join(', ')} (перевод недоступен)` : undefined;
          j.status = 'done';
        } catch (e: any) {
          j.status = 'failed'; j.error = String(e?.message || e).slice(0, 400);
          console.warn('[ugc/build photo] FAILED:', j.error);
        }
      })();
      return;
    }

    // Ни одна ветка не подошла (не «Своё фото», не «Удержание», не «Диалоги»).
    return res.status(400).json({ error: 'Загрузите своё фото (вкладка «Своё фото») — сборка идёт через HeyGen.' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка запуска сборки UGC' });
  }
});

/** GET /ugc/build/status?job= — статус сборки. */
router.get('/ugc/build/status', (req: AuthedRequest, res: Response) => {
  const j = ugcJobs.get(String(req.query.job || ''));
  if (!j || (j.tenantId && j.tenantId !== req.tenantId)) return res.status(404).json({ error: 'Задача не найдена (возможно, сервер перезапускался — запустите сборку заново).' });
  res.json({ status: j.status, error: j.error, fileUrl: j.fileUrl, assetId: j.assetId, results: j.results, total: j.total, note: j.note });
});

// ── «Комментатор»: единая дорожка = голос, полноэкранный визуал на сегмент (Ken Burns/Omni/видео) ──
const commentatorJobs = new Map<string, { tenantId?: string; status: 'processing' | 'done' | 'failed'; fileUrl?: string; assetId?: string | null; error?: string; ts: number }>();

/** POST /commentator/compose — собрать ролик «Комментатор». Визуалы уже готовы (картинки для Ken Burns,
 *  Omni/видео-клипы через /omni/generate). body: { audioUrl, format?, lines:[{start,end?,visualUrl?,isVideo?}], musicUrl?, musicVolume? } → { jobId }. */
router.post('/commentator/compose', async (req: AuthedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const abs = (u?: string) => (u && !/^https?:\/\//i.test(u) && base) ? base + (u.startsWith('/') ? u : '/' + u) : u;
    const audioUrl = abs(typeof body.audioUrl === 'string' ? body.audioUrl : '');
    if (!audioUrl) return res.status(400).json({ error: 'Нужна загруженная аудиодорожка.' });
    const format = body.format === '16:9' ? '16:9' : '9:16';
    const lines = (Array.isArray(body.lines) ? body.lines : [])
      .map((l: any) => ({ start: Number(l?.start), end: Number(l?.end), visualUrl: abs(typeof l?.visualUrl === 'string' ? l.visualUrl : '') || undefined, isVideo: !!l?.isVideo, text: typeof l?.text === 'string' ? l.text : undefined }))
      .filter((l: any) => Number.isFinite(l.start));
    if (!lines.length) return res.status(400).json({ error: 'Нет сегментов — разберите запись.' });
    const musicUrl = abs(typeof body.musicUrl === 'string' ? body.musicUrl : undefined);
    const musicVolume = Number.isFinite(Number(body.musicVolume)) ? Number(body.musicVolume) : 20;
    const jobId = 'comm_' + Math.random().toString(36).slice(2, 10);
    sweepJobs(commentatorJobs);
    const tenantId = req.tenantId!;
    commentatorJobs.set(jobId, { tenantId, status: 'processing', ts: Date.now() });
    (async () => {
      try {
        const fileUrl = await composeCommentator({ audioUrl: audioUrl!, format, lines, musicUrl: musicUrl || undefined, musicVolume });
        let assetId: string | null = null;
        try {
          const asset = await createAsset(tenantId, { kind: 'reference', mediaType: 'video', originalName: 'Комментатор', fileUrl, mime: 'video/mp4', folder: 'flow' });
          assetId = asset?.id || null;
        } catch { /* Галерея опц. */ }
        commentatorJobs.set(jobId, { tenantId, status: 'done', fileUrl, assetId, ts: Date.now() });
      } catch (e: any) {
        commentatorJobs.set(jobId, { tenantId, status: 'failed', error: e?.message || 'ошибка сборки', ts: Date.now() });
      }
    })();
    res.json({ jobId, note: 'Собираю ролик «Комментатор» — идёт в фоне, опрашиваю статус…' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка сборки' });
  }
});

/** GET /commentator/compose/status?jobId=... */
router.get('/commentator/compose/status', (req: AuthedRequest, res: Response) => {
  const jobId = String(req.query.jobId || '');
  const j = commentatorJobs.get(jobId);
  if (!j || (j.tenantId && j.tenantId !== req.tenantId)) return res.status(404).json({ error: 'Задача не найдена' });
  res.json({ status: j.status, fileUrl: j.fileUrl || null, assetId: j.assetId || null, error: j.error || null });
});

// ── Omni Flash: генерация/правка видео (Gemini gemini-omni-flash-preview, Interactions API) ──
/** Запустить генерацию/правку Omni Flash в фоне (в память → poll). Общая для generate/edit. */
async function runOmniJob(tenantId: string, jobId: string, work: () => Promise<{ fileUrl: string; interactionId?: string; seconds?: number; costUsd?: number }>) {
  sweepJobs(omniJobs);
  omniJobs.set(jobId, { tenantId, status: 'processing', ts: Date.now() });
  try {
    const r = await work();
    let assetId: string | null = null;
    try {
      const asset = await createAsset(tenantId, { kind: 'reference', mediaType: 'video', originalName: 'Omni Flash видео', fileUrl: r.fileUrl, mime: 'video/mp4' });
      assetId = asset?.id || null;
    } catch { /* Галерея опц. */ }
    omniJobs.set(jobId, { status: 'done', fileUrl: r.fileUrl, interactionId: r.interactionId, seconds: r.seconds, costUsd: r.costUsd, assetId, ts: Date.now() });
  } catch (e: any) {
    omniJobs.set(jobId, { status: 'failed', error: e?.message || 'ошибка Omni Flash', ts: Date.now() });
  }
}

/** POST /omni/generate — сгенерировать видео (Omni Flash). body: { prompt, imageUrl?, aspect? } → { jobId }. */
router.post('/omni/generate', async (req: AuthedRequest, res: Response) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) return res.status(400).json({ error: 'Опишите, что сгенерировать (промт).' });
    const apiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!apiKey) return res.status(400).json({ error: 'Подключите Gemini-ключ (Настройки → Gemini API) — Omni Flash работает на нём.' });
    const aspect = req.body?.aspect === '16:9' ? '16:9' : '9:16';
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    let inputImage: { base64: string; mime: string } | undefined;
    if (typeof req.body?.imageUrl === 'string' && req.body.imageUrl) {
      const abs = /^https?:\/\//i.test(req.body.imageUrl) ? req.body.imageUrl : (base ? base + (req.body.imageUrl.startsWith('/') ? req.body.imageUrl : '/' + req.body.imageUrl) : req.body.imageUrl);
      const img = await fetchImageBase64(abs);
      if (img) inputImage = { base64: img.base64, mime: img.mime };
    }
    const jobId = 'omni_' + Math.random().toString(36).slice(2, 10);
    const tenantId = req.tenantId!;
    void runOmniJob(tenantId, jobId, () => generateOmniVideo({ apiKey, prompt, inputImage, aspect }));
    res.json({ jobId, note: `Omni Flash генерирует видео (~30–60с, ~$${(10 * OMNI_VIDEO_USD_PER_SEC).toFixed(2)} за 10с). Опрашиваю статус…` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка Omni Flash' });
  }
});

/** POST /omni/edit — чат-правка видео Omni Flash. body: { previousInteractionId, prompt, aspect? } → { jobId }. */
router.post('/omni/edit', async (req: AuthedRequest, res: Response) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const previousInteractionId = typeof req.body?.previousInteractionId === 'string' ? req.body.previousInteractionId : '';
    if (!prompt) return res.status(400).json({ error: 'Опишите правку.' });
    if (!previousInteractionId) return res.status(400).json({ error: 'Нет id предыдущей генерации для правки.' });
    const apiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!apiKey) return res.status(400).json({ error: 'Подключите Gemini-ключ.' });
    const aspect = req.body?.aspect === '16:9' ? '16:9' : '9:16';
    const jobId = 'omni_' + Math.random().toString(36).slice(2, 10);
    const tenantId = req.tenantId!;
    void runOmniJob(tenantId, jobId, () => editOmniVideo({ apiKey, previousInteractionId, prompt, aspect }));
    res.json({ jobId, note: 'Omni Flash правит видео (это новая генерация — тот же ценник). Опрашиваю…' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка правки Omni Flash' });
  }
});

/** GET /omni/status?jobId=... — статус генерации/правки Omni Flash. */
router.get('/omni/status', (req: AuthedRequest, res: Response) => {
  const j = omniJobs.get(String(req.query.jobId || ''));
  if (!j || (j.tenantId && j.tenantId !== req.tenantId)) return res.status(404).json({ error: 'Задача Omni не найдена' });
  res.json({ status: j.status, fileUrl: j.fileUrl || null, interactionId: j.interactionId || null, seconds: j.seconds || null, costUsd: j.costUsd || null, error: j.error || null });
});

/** POST /omni/storyboard — раскадровка: N дешёвых кадров через Nano Banana 2 Lite (перед генерацией видео).
 *  body: { prompt, count? } → { frames:[{url,assetId}] }. Пользователь выбирает кадр → он идёт стартом в Omni. */
const NANO_LITE_MODEL = 'gemini-3.1-flash-lite-image';
router.post('/omni/storyboard', async (req: AuthedRequest, res: Response) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) return res.status(400).json({ error: 'Опишите сцену для раскадровки (промт).' });
    const apiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!apiKey) return res.status(400).json({ error: 'Подключите Gemini-ключ (Настройки → Gemini API).' });
    const count = Math.max(1, Math.min(4, Number(req.body?.count) || 3));
    const tenantId = req.tenantId!;
    // Опц. вход-картинка (#3 «промт+картинка» → img2img): перерисовать свой кадр под сцену.
    let inputImages: Array<{ base64: string; mime: string }> | undefined;
    if (typeof req.body?.imageUrl === 'string' && req.body.imageUrl) {
      const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
      const abs = /^https?:\/\//i.test(req.body.imageUrl) ? req.body.imageUrl : (base ? base + (req.body.imageUrl.startsWith('/') ? req.body.imageUrl : '/' + req.body.imageUrl) : req.body.imageUrl);
      const img = await fetchImageBase64(abs);
      if (img) inputImages = [{ base64: img.base64, mime: img.mime }];
    }
    // Кадры генерим параллельно (Nano Lite ~4с каждый) — вписываемся в таймаут.
    const results = await Promise.all(Array.from({ length: count }, async () => {
      try {
        const gen = await generateImage({ apiKey, model: NANO_LITE_MODEL, prompt, inputImages });
        const asset = await createAsset(tenantId, {
          kind: 'reference', mediaType: 'image', originalName: 'Раскадровка Omni Flash',
          fileUrl: gen.mediaUrl, filePath: gen.filePath, mime: gen.mediaMime, size: gen.mediaSize,
        });
        return { url: gen.mediaUrl, assetId: asset?.id || null };
      } catch { return null; }
    }));
    const frames = results.filter(Boolean);
    if (!frames.length) return res.status(400).json({ error: 'Не удалось сгенерировать кадры (проверьте доступ ключа к модели изображений).' });
    res.json({ frames, note: `${frames.length} кадр(а) раскадровки (~$${(frames.length * 0.034).toFixed(2)}). Выберите кадр → «Сгенерировать» оживит именно его.` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка раскадровки' });
  }
});

/** POST /omni/frame — извлечь кадр из видео (ffmpeg) → в Галерею.
 *  body: { videoUrl, timeSec?, last? } → { url, assetId }.
 *  #3 старт-кадр: videoUrl=исходник, timeSec=позиция окна. #4 продолжение: videoUrl=клип, last=true. */
router.post('/omni/frame', async (req: AuthedRequest, res: Response) => {
  try {
    const videoUrl = typeof req.body?.videoUrl === 'string' ? req.body.videoUrl : '';
    if (!videoUrl) return res.status(400).json({ error: 'Нет видео для извлечения кадра.' });
    const timeSecRaw = Number(req.body?.timeSec);
    const last = req.body?.last === true;
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const f = await extractFrame({ videoUrl, timeSec: Number.isFinite(timeSecRaw) ? timeSecRaw : 0, last, publicBase: base });
    let assetId: string | null = null;
    try {
      const asset = await createAsset(req.tenantId!, {
        kind: 'reference', mediaType: 'image', originalName: last ? 'Последний кадр Omni Flash' : 'Кадр из видео',
        fileUrl: f.fileUrl, filePath: f.filePath, mime: f.mime, size: f.size,
      });
      assetId = asset?.id || null;
    } catch { /* Галерея опц. */ }
    res.json({ url: f.fileUrl, assetId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Не удалось извлечь кадр' });
  }
});

export default router;
