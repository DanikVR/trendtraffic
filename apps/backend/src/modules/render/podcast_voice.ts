/**
 * Дорожки голоса для аниматора подкаста: реальный голос из записи (нарезка сегментов
 * ведущего через ffmpeg) и TTS через ElevenLabs. Результат — mp3 в uploads/renders,
 * его публичный URL отдаётся HeyGen как audio_url (HeyGen синхронизирует губы по аудио).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import ffmpegStatic from 'ffmpeg-static';

const __d = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.resolve(__d, '../../../../uploads'); // та же база, что и статика /uploads
const RENDERS_DIR = path.join(UPLOADS_ROOT, 'renders');
const FFMPEG_BIN: string = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string) || 'ffmpeg';

function ffmpeg(args: string[], timeoutMs = 300_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => { err += d.toString(); });
    const timer = setTimeout(() => { try { ff.kill('SIGKILL'); } catch { /* */ } reject(new Error('ffmpeg: таймаут')); }, timeoutMs);
    ff.on('error', (e) => { clearTimeout(timer); reject(new Error(`ffmpeg недоступен: ${e.message}`)); });
    ff.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`ffmpeg код ${code}: ${err.slice(-300)}`)); });
  });
}

function resolveLocal(fileUrl: string): string | null {
  if (!fileUrl.startsWith('/uploads/')) return null;
  const abs = path.resolve(UPLOADS_ROOT, fileUrl.slice('/uploads/'.length));
  return abs.startsWith(UPLOADS_ROOT) ? abs : null;
}

async function ensureRecordingLocal(recordingUrl: string, base: string): Promise<string> {
  const local = resolveLocal(recordingUrl);
  if (local && fs.existsSync(local)) return local;
  const url = /^https?:\/\//i.test(recordingUrl) ? recordingUrl : (base ? base + (recordingUrl.startsWith('/') ? recordingUrl : '/' + recordingUrl) : recordingUrl);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`запись не скачалась (HTTP ${r.status})`);
  const ext = path.extname(new URL(url, 'http://x').pathname) || '.mp3';
  const tmp = path.join(os.tmpdir(), `rec-${randomUUID()}${ext}`);
  fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
  return tmp;
}

/** Вырезать+склеить сегменты одного ведущего из записи → mp3 в uploads/renders → fileUrl. */
export async function buildHostAudio(recordingUrl: string, base: string, segments: { start: number; end: number }[]): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const rec = await ensureRecordingLocal(recordingUrl, base);
  const segs = segments
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .slice(0, 200);
  if (!segs.length) throw new Error('нет сегментов для голоса этого ведущего');
  const trims = segs.map((s, i) => `[0:a]atrim=${Number(s.start).toFixed(3)}:${Number(s.end).toFixed(3)},asetpts=N/SR/TB[a${i}]`).join(';');
  const concat = segs.map((_, i) => `[a${i}]`).join('') + `concat=n=${segs.length}:v=0:a=1[out]`;
  const out = `podvoice-${randomUUID().slice(0, 8)}.mp3`;
  const outPath = path.join(RENDERS_DIR, out);
  await ffmpeg(['-y', '-i', rec, '-filter_complex', `${trims};${concat}`, '-map', '[out]', '-c:a', 'libmp3lame', '-q:a', '4', outPath]);
  return `/uploads/renders/${out}`;
}

/** Дефолтные мультиязычные голоса ElevenLabs (пока голос не задан вручную). */
const EL_DEFAULT_VOICE: Record<'male' | 'female', string> = {
  female: 'EXAVITQu4vr4xnSDxMaL', // Sarah
  male: 'JBFqnCBsd6RMkjVDRZzb',   // George
};

/** ElevenLabs TTS → mp3 в uploads/renders → fileUrl. voiceId настраивается на стороне ElevenLabs. */
export async function elevenTTS(apiKey: string, text: string, gender: 'male' | 'female', voiceId?: string): Promise<string> {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });
  const vid = (voiceId && voiceId.trim()) || EL_DEFAULT_VOICE[gender];
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: text.slice(0, 2500), model_id: 'eleven_multilingual_v2' }),
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`ElevenLabs: HTTP ${r.status} ${t.slice(0, 120)}`); }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 512) throw new Error('ElevenLabs вернул пустое аудио');
  const out = `podeleven-${randomUUID().slice(0, 8)}.mp3`;
  fs.writeFileSync(path.join(RENDERS_DIR, out), buf);
  return `/uploads/renders/${out}`;
}
