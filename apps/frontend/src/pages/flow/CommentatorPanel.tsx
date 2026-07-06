/**
 * CommentatorPanel — режим «Комментатор» блока Google Flow.
 *
 * Г1: загруженное аудио = финальный голос; редактор диалога — ОБЩИЙ таймлайн (DialogueTimeline,
 * тот же, что в подкасте): наложение голосов, резать/двигать/сплитить сегменты, картинка (Ken Burns)
 * или Omni-клип на реплику. Сборка — `/commentator/compose` (локальный ffmpeg), ролик → Галерея «Google Flow».
 *
 * Этап 1: редактор-таймлайн подключён. Пересбор аудио из перемещённых/вырезанных сегментов —
 * следующий этап (пока аудио берётся целиком, таймлайн задаёт тайминг ВИЗУАЛОВ).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, Wand2, Loader2, Film, Play } from 'lucide-react';
import DialogueTimeline from './DialogueTimeline';
import { PodLine } from './dialogueTypes';

const OMNI_CREDITS = 20;
const isVideoUrl = (u?: string): boolean => !!u && /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(u);
const posOf = (l: PodLine): number => (Number.isFinite(l.tStart) ? (l.tStart as number) : Number.isFinite(l.start) ? (l.start as number) : 0);

export default function CommentatorPanel({ token }: { token: string | null }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [audioName, setAudioName] = useState('');
  const [format, setFormat] = useState<'9:16' | '16:9'>('9:16');
  const [lines, setLines] = useState<PodLine[]>([]);
  const [audioBusy, setAudioBusy] = useState(false);
  const [diarBusy, setDiarBusy] = useState(false);
  const [buildBusy, setBuildBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const aliveRef = useRef(true);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImgLine = useRef<number | null>(null);

  const auth = useCallback((): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const authJson = useCallback((): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);
  const setLine = (i: number, patch: Partial<PodLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const omniCount = useMemo(() => lines.filter((l) => isVideoUrl(l.image)).length, [lines]);
  const readyCount = useMemo(() => lines.filter((l) => l.image).length, [lines]);

  // ── аудио ──
  const uploadAudio = useCallback(async (files: FileList | null) => {
    const f = files && files[0]; if (!f) return;
    setAudioBusy(true); setNote(null);
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/trends/media/upload?kind=audio', { method: 'POST', headers: auth(), body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.asset?.fileUrl) throw new Error(d?.error || 'Не удалось загрузить аудио');
      setAudioUrl(d.asset.fileUrl); setAudioName(f.name); setLines([]); setResult(null);
      setNote({ ok: true, text: 'Аудио загружено — нажмите «Разобрать запись».' });
    } catch (e: any) { setNote({ ok: false, text: e?.message || 'Ошибка загрузки аудио' }); }
    finally { setAudioBusy(false); }
  }, [auth]);

  // ── диаризация ──
  const diarize = useCallback(async () => {
    if (!audioUrl) return;
    setDiarBusy(true); setNote(null);
    try {
      const res = await fetch('/api/render/podcast/diarize', { method: 'POST', headers: authJson(), body: JSON.stringify({ recordingUrl: audioUrl }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || `HTTP ${res.status}`);
      const raw = Array.isArray(d.lines) ? d.lines : [];
      const cl: PodLine[] = raw
        .filter((l: any) => Number.isFinite(Number(l?.start)))
        .map((l: any) => ({ speaker: (l?.speaker === 'B' ? 'B' : 'A') as 'A' | 'B', text: String(l?.text || '').trim(), start: Number(l.start), end: Number(l?.end ?? l.start), tStart: Number(l.start), mode: 'full' as const }));
      setLines(cl);
      setNote({ ok: cl.length > 0, text: cl.length ? `Разобрано сегментов: ${cl.length}. Правьте на таймлайне и привяжите визуалы.` : 'Не удалось разобрать запись (нужен Gemini-ключ).' });
    } catch (e: any) { setNote({ ok: false, text: e?.message || 'Ошибка разбора' }); }
    finally { setDiarBusy(false); }
  }, [audioUrl, authJson]);

  // ── картинка на реплику (Ken Burns) — через скрытый file input ──
  const pickImage = useCallback((i: number) => { pendingImgLine.current = i; imgInputRef.current?.click(); }, []);
  const onImgChosen = useCallback(async (files: FileList | null) => {
    const f = files && files[0]; const i = pendingImgLine.current;
    if (imgInputRef.current) imgInputRef.current.value = '';
    if (!f || i == null) return;
    setNote({ ok: true, text: 'Загружаю картинку…' });
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/trends/media/upload?kind=reference', { method: 'POST', headers: auth(), body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.asset?.fileUrl) throw new Error(d?.error || 'ошибка');
      setLine(i, { image: d.asset.fileUrl, imageName: f.name, mode: 'full' });
      setNote({ ok: true, text: 'Картинка привязана (Ken Burns).' });
    } catch (e: any) { setNote({ ok: false, text: e?.message || 'Не удалось загрузить картинку' }); }
  }, [auth]);

  // ── Omni-клип на реплику ──
  const genOmni = useCallback(async (i: number) => {
    const line = lines[i];
    const prompt = (line?.text || '').trim();
    if (!prompt) { setNote({ ok: false, text: 'В реплике нет текста для Omni.' }); return; }
    setNote({ ok: true, text: `Omni генерирует для реплики ${i + 1}…` });
    try {
      const res = await fetch('/api/render/omni/generate', { method: 'POST', headers: authJson(), body: JSON.stringify({ prompt, aspect: format }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.jobId) throw new Error(d?.error || 'Omni недоступен');
      const jobId = d.jobId; const started = Date.now();
      const poll = async (): Promise<void> => {
        if (!aliveRef.current) return;
        const s = await fetch('/api/render/omni/status?jobId=' + jobId, { headers: auth() });
        const sd = await s.json().catch(() => ({}));
        if (sd?.status === 'done' && sd?.fileUrl) { setLine(i, { image: sd.fileUrl, mode: 'full' }); setNote({ ok: true, text: `Omni-клип готов на реплику ${i + 1} ✓` }); return; }
        if (sd?.status === 'failed') { setNote({ ok: false, text: sd?.error || 'Omni не смог' }); return; }
        if (Date.now() - started > 180_000) { setNote({ ok: false, text: 'таймаут Omni' }); return; }
        setTimeout(poll, 5000);
      };
      poll();
    } catch (e: any) { setNote({ ok: false, text: e?.message || 'ошибка Omni' }); }
  }, [lines, authJson, auth, format]);

  // ── сборка ──
  const build = useCallback(async () => {
    if (!audioUrl) { setNote({ ok: false, text: 'Сначала загрузите аудио.' }); return; }
    if (!lines.length) { setNote({ ok: false, text: 'Сначала разберите запись.' }); return; }
    setBuildBusy(true); setNote(null); setResult(null);
    try {
      const payload = [...lines].sort((a, b) => posOf(a) - posOf(b)).map((l) => ({ start: posOf(l), end: posOf(l) + Math.max(0.4, (Number(l.end) - Number(l.start)) || 2), visualUrl: l.image || undefined, isVideo: isVideoUrl(l.image) }));
      const res = await fetch('/api/render/commentator/compose', { method: 'POST', headers: authJson(), body: JSON.stringify({ audioUrl, format, lines: payload }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.jobId) throw new Error(d?.error || 'Не удалось запустить сборку');
      const jobId = d.jobId; const started = Date.now();
      setNote({ ok: true, text: 'Собираю ролик…' });
      const poll = async (): Promise<void> => {
        if (!aliveRef.current) return;
        const s = await fetch('/api/render/commentator/compose/status?jobId=' + jobId, { headers: auth() });
        if (s.status === 404) { setBuildBusy(false); setNote({ ok: false, text: 'Сборка не найдена (сервер мог перезапуститься). Ищите ролик в Галерее.' }); return; }
        const sd = await s.json().catch(() => ({}));
        if (sd?.status === 'done' && sd?.fileUrl) { setBuildBusy(false); setResult(sd.fileUrl); setNote({ ok: true, text: 'Готово! Ролик в Галерее → «Google Flow».' }); return; }
        if (sd?.status === 'failed') { setBuildBusy(false); setNote({ ok: false, text: sd?.error || 'Сборка не удалась' }); return; }
        if (Date.now() - started > 20 * 60_000) { setBuildBusy(false); setNote({ ok: false, text: 'Таймаут сборки — ищите ролик в Галерее.' }); return; }
        setTimeout(poll, 4000);
      };
      poll();
    } catch (e: any) { setBuildBusy(false); setNote({ ok: false, text: e?.message || 'Ошибка сборки' }); }
  }, [audioUrl, lines, format, authJson, auth]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Загрузите дорожку — это ваш голос. Разбор на сегменты, редактор-таймлайн как в подкасте (резать/двигать/наложить), на каждый сегмент — картинка (Ken Burns) или Omni-клип. Ролик падает в Галерею → «Google Flow».</p>

      <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={(e) => onImgChosen(e.target.files)} />

      {/* аудио + формат */}
      <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: '#6366f1', color: '#fff' }}>
            {audioBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Загрузить аудио
            <input type="file" accept="audio/*" hidden onChange={(e) => uploadAudio(e.target.files)} />
          </label>
          <span className="text-[11px] truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{audioName || 'файл не выбран'}</span>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-medium)' }}>
            {(['9:16', '16:9'] as const).map((f) => (
              <button key={f} onClick={() => setFormat(f)} className="text-[11px] font-600 px-2 py-1" style={{ background: format === f ? '#6366f1' : 'transparent', color: format === f ? '#fff' : 'var(--text-muted)' }}>{f}</button>
            ))}
          </div>
        </div>
        <button onClick={diarize} disabled={!audioUrl || diarBusy}
          className="inline-flex items-center justify-center gap-2 text-[12px] font-600 px-3 py-2 rounded-lg disabled:opacity-50"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}>
          {diarBusy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Разобрать запись
        </button>
      </div>

      {/* редактор-таймлайн (общий с подкастом) */}
      <DialogueTimeline dialogue={lines} setDialogue={setLines} recordingUrl={audioUrl} onPickImage={pickImage} onOmni={genOmni} accentA="#6366f1" accentB="#8b5cf6" />

      {lines.length > 0 && (
        <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>Готово визуалов: <b style={{ color: 'var(--text-secondary)' }}>{readyCount}/{lines.length}</b> · Omni: {omniCount} ≈ {omniCount * OMNI_CREDITS} кр</span>
          <span>без картинки → тёмный кадр</span>
        </div>
      )}

      {lines.length > 0 && (
        <button onClick={build} disabled={buildBusy}
          className="inline-flex items-center justify-center gap-2 text-[13px] font-700 px-4 py-2.5 rounded-xl disabled:opacity-50"
          style={{ background: '#6366f1', color: '#fff' }}>
          {buildBusy ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />} Собрать видео
        </button>
      )}

      {note && <div className="text-[12px] font-600" style={{ color: note.ok ? '#10b981' : '#ef4444' }}>{note.text}</div>}

      {result && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-medium)' }}>
          <video src={result} controls playsInline className="w-full block" style={{ maxHeight: 360, background: '#000' }} />
          <a href={result} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-[12px] font-600 py-2" style={{ color: '#6366f1' }}><Play size={13} /> открыть ролик</a>
        </div>
      )}
    </div>
  );
}
