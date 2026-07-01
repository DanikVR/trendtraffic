/**
 * TrendTraffic — облачный путь блока «Аватар» (HeyGen talking photo).
 *
 * Пока домашний GPU-воркер (SadTalker) не подключён, блок «Аватар» исполняется
 * в облаке HeyGen: фото узла → talking_photo → video/generate (HeyGen TTS по
 * тексту сценария) → poll → скачиваем в uploads/renders. Ключ — тенантский
 * 'heygen' (Настройки → Генерация), затрат платформы нет.
 *
 * Деградация мягкая: нет ключа/фото/текста или ошибка → outputUrl=null + заметка,
 * вызывающий может отдать шаг GPU-воркеру или пропустить.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';
import { heygenVideoStatus, pickVoice, submitTalkingPhotoVideo, uploadTalkingPhoto } from './avatar.js';

const __dirname_a = path.dirname(fileURLToPath(import.meta.url));
const RENDERS_DIR = path.resolve(__dirname_a, '../../../../uploads/renders');

export interface AvatarStepResult { outputUrl: string | null; note: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Фото + текст → говорящая голова HeyGen (готовый mp4 в /uploads/renders). */
export async function runAvatarHeyGen(opts: {
  tenantId: string;
  photoUrl: string;           // абсолютный URL фото
  text: string;               // сценарий для озвучки (HeyGen TTS)
  gender?: 'male' | 'female';
  emotion?: string;           // Friendly/Excited/… (только для голосов с emotion_support)
  timeoutMs?: number;
}): Promise<AvatarStepResult> {
  const text = (opts.text || '').trim();
  if (!opts.photoUrl) return { outputUrl: null, note: 'аватар: прикрепите фото к узлу' };
  if (!text) return { outputUrl: null, note: 'аватар: нет текста сценария' };
  const apiKey = await getEffectiveProviderKey(opts.tenantId, 'heygen');
  if (!apiKey) return { outputUrl: null, note: 'аватар: ключ HeyGen не задан (Настройки → Генерация)' };

  try {
    const photoId = await uploadTalkingPhoto(apiKey, opts.photoUrl);
    const voiceId = await pickVoice(apiKey, opts.gender || 'female', !!opts.emotion);
    if (!voiceId) return { outputUrl: null, note: 'аватар: HeyGen не отдал голоса (ключ без доступа к /voices?)' };
    const videoId = await submitTalkingPhotoVideo(apiKey, {
      talkingPhotoId: photoId, voiceId, text: text.slice(0, 1400),
      emotion: opts.emotion, useIV: true, width: 720, height: 1280,
    });

    // Опрос: HeyGen рендерит минуты; потолок по умолчанию 15 мин.
    const deadline = Date.now() + (opts.timeoutMs ?? 15 * 60_000);
    let url: string | null = null;
    while (Date.now() < deadline) {
      await sleep(10_000);
      const st = await heygenVideoStatus(apiKey, videoId);
      if (st.status === 'completed' && st.url) { url = st.url; break; }
      if (st.status === 'failed' || st.error) {
        return { outputUrl: null, note: `аватар: HeyGen ошибка — ${st.error || st.status}` };
      }
    }
    if (!url) return { outputUrl: null, note: 'аватар: HeyGen не успел за отведённое время' };

    fs.mkdirSync(RENDERS_DIR, { recursive: true });
    const name = `avatar-${Date.now().toString(36)}.mp4`;
    const r = await fetch(url);
    if (!r.ok) return { outputUrl: null, note: `аватар: результат не скачался (HTTP ${r.status})` };
    fs.writeFileSync(path.join(RENDERS_DIR, name), Buffer.from(await r.arrayBuffer()));
    return { outputUrl: `/uploads/renders/${name}`, note: 'аватар: говорящая голова (HeyGen)' };
  } catch (e: any) {
    return { outputUrl: null, note: `аватар: ${e?.message || e}` };
  }
}
