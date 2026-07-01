/**
 * HeyGen — аниматор ведущих (говорящие головы) для подкаста.
 *
 * Поток: фото ведущего → talking_photo (upload) → video/generate (текст+голос по полу,
 * опц. эмоция) → poll video_status → готовое видео. Каждый ведущий — своя голова, они
 * потом склеиваются в сплит-скрин (следующий шаг). Ключ HeyGen — тенантский (Настройки →
 * Генерация → HeyGen), проверено вживую: /v2/voices, /v2/user/remaining_quota, /v2/video/generate.
 */

const HG = 'https://api.heygen.com';
const HG_UPLOAD = 'https://upload.heygen.com';

/** Эмоции/подача HeyGen (для голосов с emotion_support). UI-пресеты маппятся сюда. */
export const HEYGEN_EMOTIONS = ['Excited', 'Friendly', 'Serious', 'Soothing', 'Broadcaster'] as const;

async function hgGet(apiKey: string, url: string): Promise<{ ok: boolean; status: number; d: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const r = await fetch(url, { headers: { 'x-api-key': apiKey, accept: 'application/json' }, signal: ctrl.signal });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, d };
  } finally { clearTimeout(t); }
}

/** Остаток кредитов HeyGen (или null). */
export async function heygenQuota(apiKey: string): Promise<number | null> {
  const { ok, d } = await hgGet(apiKey, `${HG}/v2/user/remaining_quota`);
  if (!ok) return null;
  const q = d?.data?.remaining_quota;
  return typeof q === 'number' ? q : null;
}

/** Валидна ли пара (ключ рабочий)? Быстрая проверка через remaining_quota, фолбэк — voices. */
export async function heygenCheck(apiKey: string): Promise<{ ok: boolean; quota: number | null; error?: string }> {
  const q = await hgGet(apiKey, `${HG}/v2/user/remaining_quota`);
  if (q.ok) { const v = q.d?.data?.remaining_quota; return { ok: true, quota: typeof v === 'number' ? v : null }; }
  const v = await hgGet(apiKey, `${HG}/v2/voices`);
  if (v.ok) return { ok: true, quota: null };
  return { ok: false, quota: null, error: `HTTP ${q.status}` };
}

/** Подобрать голос по полу: приоритет русский → английский → любой этого пола. */
export async function pickVoice(apiKey: string, gender: 'male' | 'female', wantEmotion = false): Promise<string | null> {
  const { ok, d } = await hgGet(apiKey, `${HG}/v2/voices`);
  if (!ok) return null;
  const voices: any[] = d?.data?.voices || [];
  const match = (lang: string, emo: boolean) => voices.find((v) =>
    v.gender === gender && String(v.language || '').includes(lang) && (!emo || v.emotion_support));
  const v = (wantEmotion && (match('Russian', true) || match('English', true)))
    || match('Russian', false) || match('English', false)
    || voices.find((x) => x.gender === gender) || voices[0];
  return v?.voice_id || null;
}

/** Загрузить фото как talking_photo → talking_photo_id. */
export async function uploadTalkingPhoto(apiKey: string, imageUrl: string): Promise<string> {
  const ir = await fetch(imageUrl);
  if (!ir.ok) throw new Error(`фото ведущего не скачалось (HTTP ${ir.status})`);
  const ct = (ir.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  const mime = ct.startsWith('image/') ? ct : 'image/jpeg';
  const buf = Buffer.from(await ir.arrayBuffer());
  if (buf.length < 1024) throw new Error('фото ведущего слишком маленькое/битое');
  const r = await fetch(`${HG_UPLOAD}/v1/talking_photo`, {
    method: 'POST', headers: { 'x-api-key': apiKey, 'Content-Type': mime }, body: buf,
  });
  const d: any = await r.json().catch(() => ({}));
  const id = d?.data?.talking_photo_id;
  if (!id) throw new Error(`HeyGen upload: ${d?.message || `HTTP ${r.status}`}`);
  return id;
}

/** Поставить рендер говорящей головы (текст+голос, опц. эмоция) → video_id. */
export async function submitTalkingPhotoVideo(apiKey: string, opts: {
  talkingPhotoId: string; voiceId: string; text: string; emotion?: string; width?: number; height?: number; speed?: number;
}): Promise<string> {
  const voice: any = { type: 'text', voice_id: opts.voiceId, input_text: opts.text };
  if (opts.emotion) voice.emotion = opts.emotion;
  if (opts.speed) voice.speed = opts.speed;
  const body = {
    video_inputs: [{ character: { type: 'talking_photo', talking_photo_id: opts.talkingPhotoId }, voice }],
    dimension: { width: opts.width || 720, height: opts.height || 1280 },
  };
  const r = await fetch(`${HG}/v2/video/generate`, {
    method: 'POST', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const d: any = await r.json().catch(() => ({}));
  const vid = d?.data?.video_id;
  if (!vid) throw new Error(`HeyGen generate: ${d?.error?.message || d?.message || `HTTP ${r.status}`}`);
  return vid;
}

/** Статус рендера видео HeyGen. */
export async function heygenVideoStatus(apiKey: string, videoId: string): Promise<{ status: string; url?: string; error?: string }> {
  const { ok, d } = await hgGet(apiKey, `${HG}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`);
  if (!ok) return { status: 'error', error: `HTTP` };
  const x = d?.data || {};
  return { status: x.status || 'unknown', url: x.video_url || undefined, error: x.error ? (x.error.message || JSON.stringify(x.error)) : undefined };
}
