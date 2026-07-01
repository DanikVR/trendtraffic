/**
 * TrendTraffic — HTTP-роутер рендера «Собрать».
 *
 *  POST /api/render/flow/:flowId  — поставить сборку сценария в очередь
 *  GET  /api/render               — список задач рендера тенанта
 *  GET  /api/render/:id           — одна задача (для поллинга статуса)
 *  GET  /api/render/config/gpu    — текущая цель GPU (для подписи в UI)
 *
 * Все эндпоинты требуют JWT. Изоляция — по tenant_id из токена (как в trends).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/secrets.js';
import { getRenderGpuTarget, getRenderWorkerUrl, getRenderGpuWorkerUrl } from '../../config/systemConfig.js';
import { getFlow } from '../flows/service.js';
import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';
import { getEffectiveGeminiKey } from '../tenant_settings/gemini.js';
import { generateImage } from '../quest_flow/image_gen.js';
import { createAsset } from '../media/assets.js';
import { createPodcastJob, createRenderJob, getRenderJob, listRenderJobs } from './service.js';
import { generatePodcastDialogue } from './director.js';
import { diarizeWithGemini } from './audio_diarize.js';
import { heygenVideoStatus, pickVoice, submitTalkingPhotoVideo, uploadTalkingPhoto } from './avatar.js';
import { buildHostAudio, elevenTTS } from './podcast_voice.js';
import { composeHeads, downloadToRenders } from './podcast_compose.js';
import { generateOmniVideo, editOmniVideo, OMNI_VIDEO_USD_PER_SEC } from './video_gen.js';
import { extractFrame } from './frame_extract.js';

// Задачи склейки сплит-скрина (в памяти процесса): jobId → статус/результат.
const composeJobs = new Map<string, { status: 'processing' | 'done' | 'failed'; fileUrl?: string; assetId?: string | null; error?: string; ts: number }>();
// Задачи генерации/правки видео Omni Flash (в памяти): jobId → статус/результат (+ interactionId для чат-правок).
const omniJobs = new Map<string, { status: 'processing' | 'done' | 'failed'; fileUrl?: string; interactionId?: string; seconds?: number; costUsd?: number; assetId?: string | null; error?: string; ts: number }>();
// Omni-студия подкаста (в памяти): jobId → статусы 2 клипов (по ведущему), для сплит-скрина/чат-правок.
const omniPodJobs = new Map<string, { status: 'processing' | 'done' | 'failed'; hosts?: Array<{ host: 'A' | 'B'; name: string; url?: string; interactionId?: string | null; seconds?: number | null; costUsd?: number | null; assetId?: string | null; error?: string }>; error?: string; ts: number }>();

const router = Router();

// ── AI-ракурсы студии (Gemini Nano Banana Pro, image-to-image) ────────────────
/** Топовая image-модель Gemini (Nano Banana Pro) — макс. качество, сохранение лиц/студии. */
const PODCAST_ANGLE_MODEL = 'gemini-3-pro-image';
const ANGLE_PROMPTS: Record<string, string> = {
  left: 'с камеры, смещённой влево (вид немного слева)',
  right: 'с камеры, смещённой вправо (вид немного справа)',
  up: 'с более высокой точки (лёгкий верхний ракурс, камера сверху)',
  down: 'с более низкой точки (лёгкий нижний ракурс, камера снизу)',
  back: 'из-за спин ведущих (вид со спины/сбоку, видно студию перед ними)',
  closeup: 'более крупным планом обоих ведущих',
  wide: 'общим широким планом всей студии',
};
function anglePrompt(preset: string, custom: string): string {
  // Свой промт — основная инструкция от пользователя + сохранение личности/студии.
  if (preset === 'custom') {
    return 'На фото — студия и те же люди. '
      + (custom || 'Покажи сцену с другого ракурса') + '. '
      + 'Сохрани те же лица, причёски, одежду, студию, освещение и цветовую гамму. '
      + 'Фотореалистично, высокое качество. Верни только изображение.';
  }
  const a = ANGLE_PROMPTS[preset] || 'с другого ракурса';
  return `На фото — студия подкаста и два ведущих. Перерисуй ЭТУ ЖЕ сцену ${a}, как другой ракурс той же съёмки. `
    + 'Строго сохрани те же лица, причёски, одежду, телосложение, студию, мебель, технику, освещение и цветовую гамму. '
    + 'Фотореалистично, высокое качество, кинематографично. Верни только изображение.'
    + (custom ? ` Дополнительно: ${custom}.` : '');
}
async function fetchImageBase64(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const mime = r.headers.get('content-type') || 'image/jpeg';
    return { base64: Buffer.from(await r.arrayBuffer()).toString('base64'), mime };
  } catch { return null; }
}

/** Пресеты подачи/эмоции из UI → эмоция голоса HeyGen (для голосов с emotion_support). */
const HEYGEN_EMOTION_MAP: Record<string, string> = {
  friendly: 'Friendly', confident: 'Broadcaster', excited: 'Excited', calm: 'Soothing', serious: 'Serious',
};

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

/** POST /flow/:flowId — собрать сценарий → задача в очередь. body: { inputUrl? } */
router.post('/flow/:flowId', async (req: AuthedRequest, res: Response) => {
  try {
    const flow = await getFlow(req.tenantId!, req.params.flowId);
    if (!flow) return res.status(404).json({ error: 'Сценарий не найден' });
    const inputUrl = typeof req.body?.inputUrl === 'string' ? req.body.inputUrl : null;
    const { job, error } = await createRenderJob(req.tenantId!, { flow, inputUrl });
    if (error) return res.status(400).json({ error });
    res.status(201).json({ job });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка постановки в очередь' });
  }
});

// ── Подкаст-сцена (2 ведущих) ─────────────────────────────────────────────────
// Спец-роуты ('/podcast/dialogue', '/podcast/diarize') регистрируем ДО '/podcast/:flowId',
// иначе параметрический маршрут перехватит их (flowId='dialogue').

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

/** POST /podcast/diarize — разобрать запись подкаста на 2 голоса.
 *  Приоритет: Gemini (аудио-понимание тенант-ключом, качественно, с подсказкой пола) →
 *  воркер (акустическая кластеризация / pyannote при HF-ключе / паузы). */
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

    // 1) Gemini — качественная диаризация тенант-ключом (тот же, что и AI-ракурсы).
    const geminiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (geminiKey && /^https?:\/\//i.test(absUrl)) {
      try {
        const g = await diarizeWithGemini({ apiKey: geminiKey, audioUrl: absUrl, hostAVoice, hostBVoice });
        if (g.lines.length) return res.json({ lines: g.lines, tracks: [], note: g.note });
      } catch (e: any) {
        console.warn('[podcast/diarize] Gemini не справился, фолбэк на воркер:', e?.message || e);
      }
    }

    // 2) Фолбэк — рендер-воркер (кластеризация / pyannote / паузы).
    const worker = getRenderGpuWorkerUrl() || getRenderWorkerUrl();
    if (!worker) {
      return res.status(503).json({ error: geminiKey
        ? 'Gemini не смог разобрать запись, а рендер-воркер не подключён.'
        : 'Подключите Gemini-ключ (Настройки → Gemini API) для точного разбора, либо рендер-воркер.' });
    }
    const hfToken = await getEffectiveProviderKey(req.tenantId!, 'hf');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 600_000);
    try {
      const r = await fetch(`${worker}/diarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_url: recordingUrl, base_url: base, hf_token: hfToken || null }),
        signal: ctrl.signal,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(502).json({ error: (d as any)?.error || `воркер вернул HTTP ${r.status}` });
      res.json({ lines: (d as any)?.lines || [], tracks: (d as any)?.tracks || [], note: (d as any)?.note || null });
    } finally {
      clearTimeout(t);
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка разбора записи' });
  }
});

/** POST /podcast/angle — AI-ракурс студии (Gemini Nano Banana Pro, image-to-image).
 *  body: { imageUrl, preset?, prompt? } → { mediaUrl, assetId }. */
router.post('/podcast/angle', async (req: AuthedRequest, res: Response) => {
  try {
    const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
    const preset = typeof req.body?.preset === 'string' ? req.body.preset : 'left';
    const custom = typeof req.body?.prompt === 'string' ? req.body.prompt.slice(0, 400) : '';
    if (!imageUrl) return res.status(400).json({ error: 'Не указано исходное фото (imageUrl).' });
    const apiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!apiKey) return res.status(400).json({ error: 'Подключите свой Gemini-ключ (Настройки → Gemini API) — ракурсы рисует Gemini.' });
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const abs = /^https?:\/\//i.test(imageUrl) ? imageUrl : (base ? base + (imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl) : imageUrl);
    const img = await fetchImageBase64(abs);
    if (!img) return res.status(400).json({ error: 'Не удалось загрузить исходное фото.' });
    const gen = await generateImage({
      apiKey, model: PODCAST_ANGLE_MODEL,
      prompt: anglePrompt(preset, custom),
      inputImages: [{ base64: img.base64, mime: img.mime }],
    });
    const asset = await createAsset(req.tenantId!, {
      kind: 'reference', mediaType: 'image', originalName: `Ракурс студии (${preset})`,
      fileUrl: gen.mediaUrl, filePath: gen.filePath, mime: gen.mediaMime, size: gen.mediaSize,
    });
    res.json({ mediaUrl: gen.mediaUrl, assetId: asset?.id || null });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка генерации ракурса' });
  }
});

/** POST /podcast/animate — ЗАПУСТИТЬ рендер говорящих голов ведущих у выбранного провайдера.
 *  body: { provider, mode:'standard'|'iv', voiceSource:'heygen'|'record'|'elevenlabs', emotion?, spec }.
 *  HeyGen: грузим фото каждого ведущего → talking_photo → video/generate (текст его реплик,
 *  голос по полу, эмоция-пресет). Возвращаем video_id по каждому ведущему — фронт опрашивает
 *  /podcast/animate/status. Сабмит быстрый (укладывается в таймаут), сам рендер идёт у HeyGen. */
router.post('/podcast/animate', async (req: AuthedRequest, res: Response) => {
  try {
    const provider = ['heygen', 'did', 'gpu'].includes(req.body?.provider) ? req.body.provider : 'heygen';
    const spec = req.body?.spec && typeof req.body.spec === 'object' ? req.body.spec : {};
    const dialogue: any[] = Array.isArray(spec.dialogue) ? spec.dialogue : [];
    const seconds = dialogue.reduce((s, l) => {
      const st = Number(l?.start); const en = Number(l?.end);
      return s + (Number.isFinite(st) && Number.isFinite(en) && en > st ? en - st : Math.max(1.5, Math.min(12, String(l?.text || '').length * 0.06)));
    }, 0);
    const minsR = Math.round(Math.max(0.1, seconds / 60) * 10) / 10;

    if (provider === 'gpu') {
      const gpu = getRenderGpuWorkerUrl();
      if (!gpu) return res.status(400).json({ error: 'GPU-воркер (SadTalker) не подключён. Подключите домашний RTX/облачный GPU в Настройки → Генерация → Рендер — тогда анимация будет без оплаты за минуту.' });
      return res.json({ note: `GPU-воркер подключён — анимация (SadTalker) без оплаты за минуту (${minsR} мин). Рендер голов на GPU подключу следующим шагом.` });
    }
    if (provider === 'did') {
      return res.json({ note: 'D-ID / Hedra: сейчас НЕ подключены (ключей нет). Получите ключ D-ID (studio.d-id.com) или Hedra и добавьте в Настройки → Генерация — тогда включу их этим же аниматором. Пока рекомендую HeyGen.' });
    }
    // HeyGen — основной провайдер.
    const key = await getEffectiveProviderKey(req.tenantId!, 'heygen');
    if (!key) return res.status(400).json({ error: 'Добавьте ключ HeyGen в Настройки → Генерация (раздел «Платные», HeyGen). Получить ключ: app.heygen.com/settings/api.' });
    const hostA = spec.hostA || {}; const hostB = spec.hostB || {};
    if (!hostA.photoUrl || !hostB.photoUrl) return res.status(400).json({ error: 'Нужны фото обоих ведущих (студия лиц / ракурсы).' });
    if (!dialogue.some((l) => String(l?.text || '').trim())) return res.status(400).json({ error: 'Нужен диалог: сгенерируйте, загрузите или разберите запись.' });

    const emotion = HEYGEN_EMOTION_MAP[String(req.body?.emotion || '')] || undefined;
    const useIV = req.body?.mode === 'iv';
    const voiceSource = ['heygen', 'record', 'elevenlabs'].includes(req.body?.voiceSource) ? req.body.voiceSource : 'heygen';
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const abs = (u: string) => /^https?:\/\//i.test(u) ? u : (base ? base + (u.startsWith('/') ? u : '/' + u) : u);
    const textFor = (spk: 'A' | 'B') => dialogue.filter((l) => (l?.speaker === 'B' ? 'B' : 'A') === spk)
      .map((l) => String(l?.text || '').trim()).filter(Boolean).join(' ').slice(0, 1500);
    const segsFor = (spk: 'A' | 'B') => dialogue.filter((l) => (l?.speaker === 'B' ? 'B' : 'A') === spk)
      .map((l) => ({ start: Number(l?.start), end: Number(l?.end) }))
      .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);

    if (voiceSource === 'record' && !spec.recordingUrl) {
      return res.status(400).json({ error: 'Для «Из записи» нужна загруженная запись подкаста (вкладка «Разобрать запись»).' });
    }
    let elevenKey: string | null = null;
    if (voiceSource === 'elevenlabs') {
      elevenKey = await getEffectiveProviderKey(req.tenantId!, 'elevenlabs');
      if (!elevenKey) return res.status(400).json({ error: 'Добавьте ключ ElevenLabs в Настройки → Генерация.' });
    }

    // Общая длина диалога (макс. конец) — чтобы дорожки ведущих были на всю длину.
    const totalSec = dialogue.reduce((m, l) => { const e = Number(l?.end); return Number.isFinite(e) && e > m ? e : m; }, 0);
    const jobs: any[] = [];
    for (const [spk, host] of [['A', hostA], ['B', hostB]] as const) {
      const gender: 'male' | 'female' = host.voice === 'male' ? 'male' : 'female';
      const text = textFor(spk) || `Реплики ведущего ${spk}.`;
      // Голос: реальная запись → нарезка сегментов; ElevenLabs → TTS; иначе HeyGen TTS (текст).
      let audioUrl: string | undefined;
      let voiceId: string | undefined;
      if (voiceSource === 'record') {
        const segs = segsFor(spk);
        if (!segs.length) throw new Error(`нет сегментов записи для ведущего ${spk} (разберите запись на 2 голоса)`);
        audioUrl = abs(await buildHostAudio(spec.recordingUrl, base, segs, totalSec));
      } else if (voiceSource === 'elevenlabs') {
        audioUrl = abs(await elevenTTS(elevenKey!, text, gender, host.elevenVoiceId));
      } else {
        voiceId = (await pickVoice(key, gender, !!emotion)) || undefined;
        if (!voiceId) throw new Error('не удалось подобрать голос HeyGen');
      }
      const tpId = await uploadTalkingPhoto(key, abs(host.photoUrl));
      const videoId = await submitTalkingPhotoVideo(key, { talkingPhotoId: tpId, voiceId, text, audioUrl, emotion, useIV });
      jobs.push({ host: spk, name: host.name || `Ведущий ${spk}`, videoId });
    }
    const src = voiceSource === 'record' ? 'реальные голоса из записи' : voiceSource === 'elevenlabs' ? 'голос ElevenLabs' : 'голос HeyGen';
    return res.json({ jobs, note: `HeyGen${useIV ? ' (Avatar IV)' : ''}: запущен рендер 2 голов, ${src} (~1–3 мин). Опрашиваю статус…` });
  } catch (err: any) {
    res.status(400).json({ error: `HeyGen: ${err?.message || 'ошибка запуска рендера'}` });
  }
});

// Головы, уже сохранённые в Галерею (videoId → fileUrl), чтобы не качать повторно на каждом опросе.
const savedHeads = new Map<string, string>();

/** GET /podcast/animate/status?ids=v1,v2 — статусы рендеров HeyGen; готовые скачиваем в Галерею по порядку. */
router.get('/podcast/animate/status', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await getEffectiveProviderKey(req.tenantId!, 'heygen');
    if (!key) return res.status(400).json({ error: 'Ключ HeyGen не найден.' });
    const ids = String(req.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
    const statuses = await Promise.all(ids.map(async (id) => {
      const st = await heygenVideoStatus(key, id);
      let assetUrl: string | null = savedHeads.get(id) || null;
      if (st.status === 'completed' && st.url && !assetUrl) {
        try {
          const dl = await downloadToRenders(st.url, 'podhead');
          const asset = await createAsset(req.tenantId!, {
            kind: 'reference', mediaType: 'video', originalName: 'Аватар-ведущий (HeyGen)',
            fileUrl: dl.fileUrl, filePath: dl.filePath, mime: 'video/mp4', size: dl.size,
          });
          assetUrl = dl.fileUrl; savedHeads.set(id, dl.fileUrl);
          void asset;
        } catch { assetUrl = null; }
      }
      // отдаём наш сохранённый URL (постоянный) если есть, иначе временную ссылку HeyGen
      return { id, status: st.status, url: assetUrl || st.url || null, assetUrl, error: st.error || null };
    }));
    res.json({ statuses });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка статуса аниматора' });
  }
});

/** POST /podcast/compose — склеить две головы в сплит-скрин (+ запись как аудио, + фон-музыка).
 *  body: { headA, headB, audioUrl?, musicUrl?, musicVolume? } → { jobId }. Идёт в фоне (poll status). */
router.post('/podcast/compose', async (req: AuthedRequest, res: Response) => {
  try {
    const headA = typeof req.body?.headA === 'string' ? req.body.headA : '';
    const headB = typeof req.body?.headB === 'string' ? req.body.headB : '';
    if (!headA || !headB) return res.status(400).json({ error: 'Нужны обе готовые головы (headA, headB).' });
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const abs = (u?: string) => (u && !/^https?:\/\//i.test(u) && base) ? base + (u.startsWith('/') ? u : '/' + u) : u;
    const audioUrl = abs(typeof req.body?.audioUrl === 'string' ? req.body.audioUrl : undefined);
    const musicUrl = abs(typeof req.body?.musicUrl === 'string' ? req.body.musicUrl : undefined);
    const musicVolume = Number.isFinite(Number(req.body?.musicVolume)) ? Number(req.body.musicVolume) : 20;
    const jobId = 'cmp_' + Math.random().toString(36).slice(2, 10);
    composeJobs.set(jobId, { status: 'processing', ts: Date.now() });
    const tenantId = req.tenantId!;
    // Фоновая задача: склейка может занять минуты (не блокируем ответ / прокси).
    (async () => {
      try {
        const fileUrl = await composeHeads({ headA: abs(headA)!, headB: abs(headB)!, audioUrl, musicUrl, musicVolume });
        let assetId: string | null = null;
        try {
          const asset = await createAsset(tenantId, {
            kind: 'reference', mediaType: 'video', originalName: 'Подкаст сплит-скрин (аватары)',
            fileUrl, mime: 'video/mp4',
          });
          assetId = asset?.id || null;
        } catch { /* Галерея опц. */ }
        composeJobs.set(jobId, { status: 'done', fileUrl, assetId, ts: Date.now() });
      } catch (e: any) {
        composeJobs.set(jobId, { status: 'failed', error: e?.message || 'ошибка склейки', ts: Date.now() });
      }
    })();
    res.json({ jobId, note: 'Склеиваю сплит-скрин — идёт в фоне, опрашиваю статус…' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка склейки' });
  }
});

/** GET /podcast/compose/status?jobId=... — статус склейки сплит-скрина. */
router.get('/podcast/compose/status', (req: AuthedRequest, res: Response) => {
  const jobId = String(req.query.jobId || '');
  const j = composeJobs.get(jobId);
  if (!j) return res.status(404).json({ error: 'Задача склейки не найдена' });
  res.json({ status: j.status, fileUrl: j.fileUrl || null, assetId: j.assetId || null, error: j.error || null });
});

// ── Omni Flash: генерация/правка видео (Gemini gemini-omni-flash-preview, Interactions API) ──
/** Запустить генерацию/правку Omni Flash в фоне (в память → poll). Общая для generate/edit. */
async function runOmniJob(tenantId: string, jobId: string, work: () => Promise<{ fileUrl: string; interactionId?: string; seconds?: number; costUsd?: number }>) {
  omniJobs.set(jobId, { status: 'processing', ts: Date.now() });
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
  if (!j) return res.status(404).json({ error: 'Задача Omni не найдена' });
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

// ── Omni-студия подкаста ──
// ПРИОРИТЕТ: если есть ОБЩЕЕ фото студии (groupPhotoUrl) → один image_to_video оживляет ЦЕЛУЮ сцену
// (оба ведущих в одном кадре — проверено вживую, single-image так НЕ блокируется). Иначе фолбэк —
// по ведущему отдельно (2 клипа) + склейка composeHeads. Omni НЕ принимает аудио на вход и блокирует
// СКЛЕЙКУ двух РАЗНЫХ фото (reference_to_video → "prohibited content"). Реальный голос — ветка HeyGen.
// Правки — /omni/edit по interactionId клипа (диалоговое редактирование во главе).
function omniHostPrompt(name: string, gender: 'male' | 'female', lines: string): string {
  const who = gender === 'male' ? 'мужчина' : 'женщина';
  const say = lines
    ? ` Он(а) естественно, синхронно двигая губами, произносит по-русски: «${lines.slice(0, 600)}».`
    : ' Он(а) смотрит в камеру и естественно говорит по-русски.';
  return `Вертикальное видео 9:16. Человек с фотографии — ведущий подкаста (${who}, ${name}), в уютной студии. `
    + `Живая мимика и лёгкие движения головы, тёплый студийный свет, фотореалистично.${say}`;
}
/** Промт для ЦЕЛОЙ сцены из общего фото студии (оба ведущих в одном кадре). */
function omniScenePrompt(nameA: string, nameB: string, dialogueText: string): string {
  const convo = dialogueText ? ` Они оживлённо обсуждают по-русски: «${dialogueText.slice(0, 700)}».` : '';
  return `Вертикальное видео 9:16. На фотографии — студия подкаста с двумя ведущими (${nameA} слева и ${nameB} справа). `
    + `Оба ведущих в кадре ЖИВО разговаривают: смотрят друг на друга и в камеру, естественная мимика, синхронные движения губ, лёгкие жесты.${convo} `
    + `Тёплый студийный свет, фотореалистично, единый цельный кадр (НЕ сплит-скрин).`;
}

/** POST /podcast/omni-animate — оживить подкаст через Omni Flash: общее фото → ЦЕЛАЯ сцена, иначе по ведущему. body: { spec, aspect? } → { jobId }. */
router.post('/podcast/omni-animate', async (req: AuthedRequest, res: Response) => {
  try {
    const apiKey = await getEffectiveGeminiKey(req.tenantId!);
    if (!apiKey) return res.status(400).json({ error: 'Подключите Gemini-ключ (Настройки → Gemini API) — Omni-студия работает на нём.' });
    const spec = req.body?.spec && typeof req.body.spec === 'object' ? req.body.spec : {};
    const hostA = spec.hostA || {}; const hostB = spec.hostB || {};
    const groupPhotoUrl = typeof spec.groupPhotoUrl === 'string' && spec.groupPhotoUrl ? spec.groupPhotoUrl : '';
    if (!groupPhotoUrl && (!hostA.photoUrl || !hostB.photoUrl)) return res.status(400).json({ error: 'Нужно общее фото студии (студия лиц) или фото обоих ведущих.' });
    const dialogue: any[] = Array.isArray(spec.dialogue) ? spec.dialogue : [];
    const aspect = req.body?.aspect === '16:9' ? '16:9' : '9:16';
    const base = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
    const abs = (u: string) => /^https?:\/\//i.test(u) ? u : (base ? base + (u.startsWith('/') ? u : '/' + u) : u);
    const textFor = (spk: 'A' | 'B') => dialogue.filter((l) => (l?.speaker === 'B' ? 'B' : 'A') === spk)
      .map((l) => String(l?.text || '').trim()).filter(Boolean).join(' ');
    const jobId = 'omnipod_' + Math.random().toString(36).slice(2, 10);
    omniPodJobs.set(jobId, { status: 'processing', ts: Date.now() });
    const tenantId = req.tenantId!;
    const nameA = hostA.name || 'Ведущий A'; const nameB = hostB.name || 'Ведущий B';
    // Фон: синхронные вызовы Omni (~40с каждый) > таймаут прокси → в фоне, poll status.
    (async () => {
      const hosts: any[] = [];
      if (groupPhotoUrl) {
        // ПРИОРИТЕТ: одна ЦЕЛАЯ сцена из общего фото студии (оба ведущих в кадре, без сплит-скрина).
        const name = 'Студийная сцена';
        try {
          const img = await fetchImageBase64(abs(groupPhotoUrl));
          if (!img) { hosts.push({ host: 'scene', name, error: 'не удалось загрузить общее фото студии' }); }
          else {
            const allText = dialogue.map((l) => String(l?.text || '').trim()).filter(Boolean).join(' ');
            const gen = await generateOmniVideo({ apiKey, prompt: omniScenePrompt(nameA, nameB, allText), inputImage: { base64: img.base64, mime: img.mime }, aspect });
            let assetId: string | null = null;
            try {
              const asset = await createAsset(tenantId, { kind: 'reference', mediaType: 'video', originalName: 'Omni-студия: сцена', fileUrl: gen.fileUrl, mime: 'video/mp4' });
              assetId = asset?.id || null;
            } catch { /* Галерея опц. */ }
            hosts.push({ host: 'scene', name, url: gen.fileUrl, interactionId: gen.interactionId || null, seconds: gen.seconds || null, costUsd: gen.costUsd || null, assetId });
          }
        } catch (e: any) {
          hosts.push({ host: 'scene', name, error: e?.message || 'ошибка Omni' });
        }
      } else {
        // Фолбэк: по ведущему отдельно (2 клипа) — Omni не совмещает 2 РАЗНЫХ фото в одном кадре.
        for (const [spk, host] of [['A', hostA], ['B', hostB]] as const) {
          const gender: 'male' | 'female' = host.voice === 'male' ? 'male' : 'female';
          const name = host.name || `Ведущий ${spk}`;
          try {
            const img = await fetchImageBase64(abs(host.photoUrl));
            if (!img) { hosts.push({ host: spk, name, error: 'не удалось загрузить фото' }); continue; }
            const gen = await generateOmniVideo({ apiKey, prompt: omniHostPrompt(name, gender, textFor(spk)), inputImage: { base64: img.base64, mime: img.mime }, aspect });
            let assetId: string | null = null;
            try {
              const asset = await createAsset(tenantId, { kind: 'reference', mediaType: 'video', originalName: `Omni-ведущий ${name}`, fileUrl: gen.fileUrl, mime: 'video/mp4' });
              assetId = asset?.id || null;
            } catch { /* Галерея опц. */ }
            hosts.push({ host: spk, name, url: gen.fileUrl, interactionId: gen.interactionId || null, seconds: gen.seconds || null, costUsd: gen.costUsd || null, assetId });
          } catch (e: any) {
            hosts.push({ host: spk, name, error: e?.message || 'ошибка Omni' });
          }
        }
      }
      const anyOk = hosts.some((h) => h.url);
      omniPodJobs.set(jobId, { status: anyOk ? 'done' : 'failed', hosts, error: anyOk ? undefined : (hosts.find((h) => h.error)?.error || 'не удалось оживить'), ts: Date.now() });
    })();
    res.json({ jobId, note: groupPhotoUrl
      ? `Omni оживляет ЦЕЛУЮ сцену из общего фото студии (~30–60с, ≈$${(10 * OMNI_VIDEO_USD_PER_SEC).toFixed(2)}). Опрашиваю…`
      : `Omni оживляет фото ведущих по одному (~30–60с каждый, ≈$${(20 * OMNI_VIDEO_USD_PER_SEC).toFixed(2)} за 2 клипа). Опрашиваю…` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка Omni-студии' });
  }
});

/** GET /podcast/omni-animate/status?jobId=... — статусы 2 Omni-клипов ведущих (+ interactionId для правок). */
router.get('/podcast/omni-animate/status', (req: AuthedRequest, res: Response) => {
  const j = omniPodJobs.get(String(req.query.jobId || ''));
  if (!j) return res.status(404).json({ error: 'Задача Omni-студии не найдена' });
  res.json({ status: j.status, hosts: j.hosts || [], error: j.error || null });
});

/** POST /podcast/:flowId — собрать подкаст-сцену → задача в очередь. body: { spec? } */
router.post('/podcast/:flowId', async (req: AuthedRequest, res: Response) => {
  try {
    const flow = await getFlow(req.tenantId!, req.params.flowId);
    if (!flow) return res.status(404).json({ error: 'Сценарий не найден' });
    const spec = req.body?.spec && typeof req.body.spec === 'object' ? req.body.spec : null;
    const { job, error } = await createPodcastJob(req.tenantId!, { flow, spec });
    if (error) return res.status(400).json({ error });
    res.status(201).json({ job });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка постановки в очередь' });
  }
});

/** GET / — последние задачи рендера тенанта. */
router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const limit = Number.isFinite(Number(req.query.limit)) ? Number(req.query.limit) : 50;
    res.json({ jobs: await listRenderJobs(req.tenantId!, limit), gpuTarget: getRenderGpuTarget() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

/** GET /config/gpu — текущая цель GPU (home|cloud|off). */
router.get('/config/gpu', (_req: AuthedRequest, res: Response) => {
  res.json({ gpuTarget: getRenderGpuTarget() });
});

/** GET /:id — одна задача (поллинг статуса). */
router.get('/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const job = await getRenderJob(req.tenantId!, req.params.id);
    if (!job) return res.status(404).json({ error: 'Задача не найдена' });
    res.json({ job });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Ошибка чтения' });
  }
});

export default router;
