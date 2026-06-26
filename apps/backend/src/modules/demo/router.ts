/**
 * demo/router.ts — ПУБЛИЧНЫЙ (без авторизации) эндпоинт для аудио-песочницы лендинга.
 *
 * POST /api/demo/voice-translate
 *   body: { audio: base64 PCM16 16kHz mono, targetLanguage: ISO-код, voiceGender?: 'male'|'female' }
 *   resp: { audio: base64 PCM, sampleRate: number, mimeType: string }
 *
 * Один «выстрел» Gemini Live: открываем сессию, шлём записанный клип,
 * сигналим конец потока, собираем переведённое аудио до turnComplete, закрываем.
 * Без БД и без биллинга — использует ГЛОБАЛЬНЫЙ Gemini-ключ. Защищён rate-limit по IP.
 */

import { Router, type Request, type Response } from 'express';
import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai';
import { buildTranslationInstruction, VOICE_MAP, AUDIO_MIME_TYPE } from '../translation/config.js';
import { getGeminiApiKey, getGeminiLiveModel, getVoiceName } from '../../config/systemConfig.js';

const router = Router();

// ── Простой in-memory rate-limit по IP (демо публичное → бережём бюджет Gemini) ──
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const ipHits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    ipHits.set(ip, arr);
    return true;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  return false;
}

/** base64 PCM-клипа: ~3MB ≈ 2.2MB raw ≈ 70с @16kHz — с запасом, но ограниченно. */
const MAX_AUDIO_B64 = 3_000_000;
/** Таймаут одного «выстрела» перевода (меньше фронтового, чтобы сбой всплывал быстрее). */
const SHOT_TIMEOUT_MS = 12_000;

function rateFromMime(mime: string | undefined, fallback = 24000): number {
  const m = /rate=(\d+)/.exec(mime || '');
  return m ? parseInt(m[1], 10) : fallback;
}

router.post('/voice-translate', async (req: Request, res: Response) => {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Слишком много запросов. Подождите минуту.' });
  }

  const { audio, targetLanguage, voiceGender } = (req.body || {}) as {
    audio?: unknown;
    targetLanguage?: unknown;
    voiceGender?: unknown;
  };

  if (typeof audio !== 'string' || !audio) {
    return res.status(400).json({ error: 'Поле audio (base64 PCM16 16kHz) обязательно.' });
  }
  if (audio.length > MAX_AUDIO_B64) {
    return res.status(413).json({ error: 'Аудио слишком длинное для демо.' });
  }
  if (typeof targetLanguage !== 'string' || !targetLanguage) {
    return res.status(400).json({ error: 'Поле targetLanguage обязательно.' });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Демо временно недоступно.' });
  }

  const gender: 'male' | 'female' = voiceGender === 'male' ? 'male' : 'female';
  const voiceName = getVoiceName(gender) || VOICE_MAP[gender];
  const model = getGeminiLiveModel();
  const instruction = buildTranslationInstruction(targetLanguage);
  const ai = new GoogleGenAI({ apiKey });

  const chunks: Buffer[] = [];
  let outMime: string | undefined;

  try {
    const result = await new Promise<{ audio: string; sampleRate: number; mimeType: string }>(
      (resolve, reject) => {
        let session: Session | null = null;
        let settled = false;

        const timeout = setTimeout(() => {
          if (settled) return;
          // Если что-то уже накопили к таймауту — отдадим это, иначе ошибка.
          if (chunks.length) finish();
          else fail(new Error('timeout'));
        }, SHOT_TIMEOUT_MS);

        const cleanup = () => {
          clearTimeout(timeout);
          try {
            session?.close();
          } catch {
            /* noop */
          }
        };
        const finish = () => {
          if (settled) return;
          settled = true;
          cleanup();
          const buf = Buffer.concat(chunks);
          resolve({
            audio: buf.toString('base64'),
            sampleRate: rateFromMime(outMime, 24000),
            mimeType: outMime || 'audio/pcm;rate=24000',
          });
        };
        const fail = (err: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(err);
        };

        (async () => {
          try {
            session = await ai.live.connect({
              model,
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
                systemInstruction: { parts: [{ text: instruction }] },
              },
              callbacks: {
                onmessage: (msg: LiveServerMessage) => {
                  const content: any = (msg as any).serverContent;
                  const parts = content?.modelTurn?.parts;
                  if (Array.isArray(parts)) {
                    for (const p of parts) {
                      if (p?.inlineData?.data && String(p.inlineData.mimeType).startsWith('audio/')) {
                        outMime = p.inlineData.mimeType;
                        chunks.push(Buffer.from(p.inlineData.data, 'base64'));
                      }
                    }
                  }
                  if (content?.turnComplete) finish();
                },
                onerror: (e: any) => fail(new Error(e?.message || 'Gemini Live error')),
                onclose: () => {
                  // Закрытие после данных без turnComplete — отдадим накопленное.
                  if (!settled && chunks.length) finish();
                },
              },
            });

            // Отправляем клип чанками ~1с (16000 сэмплов * 2 байта = 32000 байт).
            const raw = Buffer.from(audio, 'base64');
            const CHUNK = 32000;
            for (let i = 0; i < raw.length; i += CHUNK) {
              const slice = raw.subarray(i, Math.min(i + CHUNK, raw.length));
              session.sendRealtimeInput({
                audio: { data: slice.toString('base64'), mimeType: AUDIO_MIME_TYPE },
              });
            }
            // Сигнал конца потока → Gemini формирует ответ. Не фатально:
            // при иной версии SDK сработает автоматический VAD по тишине в конце клипа.
            try {
              session.sendRealtimeInput({ audioStreamEnd: true } as any);
            } catch {
              /* полагаемся на VAD */
            }
          } catch (err) {
            fail(err as Error);
          }
        })();
      },
    );

    return res.json(result);
  } catch (err) {
    console.error('[demo/voice-translate]', (err as Error)?.message || err);
    return res.status(502).json({ error: 'Не удалось получить перевод. Попробуйте ещё раз.' });
  }
});

export default router;
