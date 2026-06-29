/**
 * VoiceSandbox — интерактивная аудио-песочница лендинга (РЕАЛЬНЫЙ перевод).
 *
 * Цепочка: запись с микрофона → авто-стоп по тишине (VAD) → PCM16 16кГц →
 * POST /api/demo/voice-translate (Gemini Live one-shot) → проигрываем перевод
 * HD-голосом. Пол голоса определяется по высоте речи (мужской/женский).
 * Запись и воспроизведение кормят общий визуализатор Aura.
 */

import { useEffect, useRef, useState } from 'react';
import { Mic, Loader2, Sparkles, RotateCcw, Play, AlertCircle } from 'lucide-react';

type SandboxState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

interface VoiceSandboxProps {
  onActiveChange?: (active: boolean) => void;
  onAnalyserChange?: (a: AnalyserNode | null) => void;
}

const TARGETS = [
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'ar', flag: '🇸🇦', label: 'العربية' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
];

const MAX_REC_MS = 8000;        // потолок записи
const SILENCE_MS = 750;         // авто-стоп после паузы в речи
const MIN_SPEECH_MS = 250;      // минимальная длительность речи
const VOICE_RMS = 0.014;        // порог «есть речь»
const REQUEST_TIMEOUT_MS = 20000;
const ORANGE = '99,102,241';

// ── Аудио-утилиты ──
function concatFloat32(parts: Float32Array[]): Float32Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Float32Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate <= 16000) return input;
  const ratio = inputRate / 16000;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0, c = 0;
    for (let j = start; j < end; j++) { sum += input[j]; c++; }
    out[i] = c ? sum / c : input[start] || 0;
  }
  return out;
}
function floatToInt16Bytes(f32: Float32Array): Uint8Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return new Uint8Array(i16.buffer);
}
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH) as unknown as number[]);
  }
  return btoa(bin);
}
function base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const usable = bytes.length - (bytes.length % 2);
  const i16 = new Int16Array(bytes.buffer, 0, usable / 2);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x8000;
  return f32;
}
/** Оценка основной частоты (автокорреляция) → пол голоса. */
function estimateGender(buf: Float32Array, sr: number): 'male' | 'female' {
  const size = 1024;
  if (buf.length < size) return 'female';
  // окно с максимальной энергией (наиболее «озвученное»)
  let bestStart = 0, bestE = -1;
  for (let s = 0; s + size <= buf.length; s += size) {
    let e = 0;
    for (let i = 0; i < size; i++) { const v = buf[s + i]; e += v * v; }
    if (e > bestE) { bestE = e; bestStart = s; }
  }
  const w = buf.subarray(bestStart, bestStart + size);
  const minLag = Math.floor(sr / 300); // 300 Гц
  const maxLag = Math.floor(sr / 70);  // 70 Гц
  let bestLag = -1, best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < size - lag; i++) corr += w[i] * w[i + lag];
    if (corr > best) { best = corr; bestLag = lag; }
  }
  if (bestLag <= 0) return 'female';
  const pitch = sr / bestLag;
  return pitch < 168 ? 'male' : 'female';
}

export function VoiceSandbox({ onActiveChange, onAnalyserChange }: VoiceSandboxProps) {
  const [state, setState] = useState<SandboxState>('idle');
  const [target, setTarget] = useState(TARGETS[0]);
  const [errMsg, setErrMsg] = useState('');

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodesRef = useRef<{ source?: MediaStreamAudioSourceNode; processor?: ScriptProcessorNode; sink?: GainNode }>({});
  const recordedRef = useRef<Float32Array[]>([]);
  const inputRateRef = useRef(48000);
  const playSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const resultRef = useRef<{ samples: Float32Array; sampleRate: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  // VAD
  const finishedRef = useRef(false);
  const speechStartedRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastVoiceAtRef = useRef(0);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };
  const stopCapture = () => {
    const { source, processor, sink } = nodesRef.current;
    try { if (processor) processor.onaudioprocess = null; } catch { /* noop */ }
    try { source?.disconnect(); } catch { /* noop */ }
    try { processor?.disconnect(); } catch { /* noop */ }
    try { sink?.disconnect(); } catch { /* noop */ }
    nodesRef.current = {};
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  const stopPlayback = () => {
    try { playSrcRef.current?.stop(); } catch { /* noop */ }
    playSrcRef.current = null;
  };
  const abortRequest = () => {
    try { abortRef.current?.abort(); } catch { /* noop */ }
    abortRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearTimers();
      abortRequest();
      stopCapture();
      stopPlayback();
      try { ctxRef.current?.close(); } catch { /* noop */ }
      onActiveChange?.(false);
      onAnalyserChange?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureCtx = async (): Promise<AudioContext> => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === 'suspended') await ctxRef.current.resume();
    return ctxRef.current;
  };

  const startRecording = async () => {
    // полный сброс перед новым стартом — гарантия повторяемости
    setErrMsg('');
    clearTimers();
    abortRequest();
    stopPlayback();
    stopCapture();
    recordedRef.current = [];
    finishedRef.current = false;
    speechStartedRef.current = false;

    let ctx: AudioContext;
    let stream: MediaStream;
    try {
      ctx = await ensureCtx();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrMsg('Нужен доступ к микрофону, чтобы услышать перевод своего голоса.');
      setState('error');
      return;
    }
    streamRef.current = stream;
    inputRateRef.current = ctx.sampleRate;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    onAnalyserChange?.(analyser);

    const processor = ctx.createScriptProcessor(4096, 1, 1);
    startedAtRef.current = Date.now();
    lastVoiceAtRef.current = Date.now();
    processor.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      recordedRef.current.push(new Float32Array(data));
      // RMS для VAD
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      if (rms > VOICE_RMS) {
        speechStartedRef.current = true;
        lastVoiceAtRef.current = now;
      }
      // авто-стоп: была речь и пауза дольше SILENCE_MS
      if (
        speechStartedRef.current &&
        now - startedAtRef.current > MIN_SPEECH_MS &&
        now - lastVoiceAtRef.current > SILENCE_MS
      ) {
        finishRecording();
      }
    };
    const sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(processor);
    processor.connect(sink);
    sink.connect(ctx.destination);
    nodesRef.current = { source, processor, sink };

    setState('recording');
    onActiveChange?.(true);
    // потолок длительности
    timersRef.current.push(window.setTimeout(() => finishRecording(), MAX_REC_MS));
  };

  const finishRecording = async () => {
    if (finishedRef.current) return; // единственный вызов
    finishedRef.current = true;
    clearTimers();
    onActiveChange?.(false);
    onAnalyserChange?.(null);
    const inputRate = inputRateRef.current;
    stopCapture();

    const flat = concatFloat32(recordedRef.current);
    recordedRef.current = [];
    if (flat.length < inputRate * 0.3) {
      setErrMsg('Слишком тихо или коротко. Скажите фразу вслух.');
      setState('error');
      return;
    }
    const ds = downsampleTo16k(flat, inputRate);
    const gender = estimateGender(ds, 16000);
    const b64 = bytesToBase64(floatToInt16Bytes(ds));

    setState('processing');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const to = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch('/api/demo/voice-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: b64, targetLanguage: target.code, voiceGender: gender }),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error || 'Ошибка перевода');
      }
      const data = await resp.json();
      const samples = base64ToFloat32(data.audio);
      const sampleRate = Number(data.sampleRate) || 24000;
      if (!samples.length) throw new Error('Перевод не распознан. Скажите фразу чётче.');
      resultRef.current = { samples, sampleRate };
      setState('done');
      void playResult();
    } catch (err) {
      const aborted = (err as any)?.name === 'AbortError' || ctrl.signal.aborted;
      setErrMsg(aborted ? 'Перевод занял слишком долго. Попробуйте короче.' : (err as Error).message);
      setState('error');
    } finally {
      window.clearTimeout(to);
      abortRef.current = null;
    }
  };

  const playResult = async () => {
    const res = resultRef.current;
    if (!res) return;
    const ctx = await ensureCtx();
    stopPlayback();
    const buf = ctx.createBuffer(1, res.samples.length, res.sampleRate);
    buf.getChannelData(0).set(res.samples);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    onAnalyserChange?.(analyser);
    onActiveChange?.(true);
    src.onended = () => {
      onActiveChange?.(false);
      onAnalyserChange?.(null);
      playSrcRef.current = null;
    };
    playSrcRef.current = src;
    src.start();
  };

  const reset = () => {
    clearTimers();
    abortRequest();
    stopCapture();
    stopPlayback();
    onActiveChange?.(false);
    onAnalyserChange?.(null);
    finishedRef.current = false;
    setErrMsg('');
    setState('idle');
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
        {TARGETS.map((tg) => {
          const on = tg.code === target.code;
          return (
            <button
              key={tg.code}
              type="button"
              onClick={() => { reset(); setTarget(tg); }}
              className="px-3 py-1.5 rounded-full text-sm font-600 transition-all border"
              style={{
                background: on ? `rgba(${ORANGE},0.16)` : 'rgba(255,255,255,0.04)',
                borderColor: on ? `rgba(${ORANGE},0.6)` : 'rgba(255,255,255,0.1)',
                color: on ? 'var(--brand)' : 'rgba(255,255,255,0.6)',
                boxShadow: on ? `0 0 20px rgba(${ORANGE},0.3)` : 'none',
              }}
            >
              <span className="mr-1">{tg.flag}</span>
              {tg.label}
            </button>
          );
        })}
      </div>

      {(state === 'idle' || state === 'error') && (
        <>
          <button
            type="button"
            onClick={startRecording}
            className="group w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl font-700 text-white transition-all hover:brightness-110"
            style={{ background: 'var(--brand)', boxShadow: `0 10px 34px rgba(${ORANGE},0.4)` }}
          >
            <Mic size={20} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
            {state === 'error' ? 'Попробовать снова' : 'Записать голос'}
          </button>
          {state === 'error' && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/65">
              <AlertCircle size={16} className="text-magenta-400 shrink-0" /> {errMsg}
            </div>
          )}
        </>
      )}

      {state === 'recording' && (
        <button
          type="button"
          onClick={() => finishRecording()}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-700 text-white"
          style={{ background: `rgba(${ORANGE},0.14)`, border: `1px solid rgba(${ORANGE},0.55)`, boxShadow: `0 0 32px rgba(${ORANGE},0.3)` }}
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--brand)' }} />
            <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: 'var(--brand)' }} />
          </span>
          Слушаю… говорите фразу
          <span className="text-xs font-500 opacity-70">или нажмите, чтобы перевести</span>
        </button>
      )}

      {state === 'processing' && (
        <div className="space-y-2">
          <div
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-600 text-white"
            style={{ background: `rgba(${ORANGE},0.1)`, border: `1px solid rgba(${ORANGE},0.35)` }}
          >
            <Loader2 size={20} className="animate-spin" />
            ИИ переводит ваш голос…
          </div>
          <button type="button" onClick={reset} className="w-full text-center text-xs text-white/45 hover:text-white/70 transition-colors py-1">
            Отменить
          </button>
        </div>
      )}

      {state === 'done' && (
        <div
          className="w-full rounded-2xl p-5 text-center animate-scale-in"
          style={{ background: `rgba(${ORANGE},0.08)`, border: `1px solid rgba(${ORANGE},0.4)`, boxShadow: `0 0 40px rgba(${ORANGE},0.15)` }}
        >
          <div className="flex items-center justify-center gap-2 font-700 mb-1.5" style={{ color: 'var(--brand)' }}>
            <Sparkles size={18} />
            Ваш голос переведён на {target.flag} {target.label}
          </div>
          <p className="text-sm text-white/75 mb-4">Озвучено HD-голосом. Нажмите, чтобы прослушать снова.</p>
          <div className="flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={playResult}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 text-white"
              style={{ background: `rgba(${ORANGE},0.2)`, border: `1px solid rgba(${ORANGE},0.5)` }}
            >
              <Play size={16} /> Прослушать перевод
            </button>
            <button
              type="button"
              onClick={() => { reset(); void startRecording(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-600 text-white/70"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <RotateCcw size={16} /> Ещё раз
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-white/40 mt-3">
        Живое демо. Скажите короткую фразу — услышите её перевод.
      </p>
    </div>
  );
}

export default VoiceSandbox;
