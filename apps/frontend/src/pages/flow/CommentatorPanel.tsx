/**
 * CommentatorPanel — режим «Комментатор» блока Google Flow.
 *
 * Г1: загруженное аудио = финальный голос; на каждый диаризованный сегмент — полноэкранный
 * визуал: картинка (бесплатный Ken Burns) ЛИБО Omni-клип (кредиты/API) ЛИБО видео. Сборка —
 * бэкенд `/commentator/compose` (локальный ffmpeg), готовый ролик падает в Галерею «Google Flow».
 *
 * Диаризацию берём из `/podcast/diarize`, Omni-клипы — из `/omni/generate` (тот же, что «Omni Flash»).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, Wand2, Image as ImageIcon, Loader2, Film, Play, Trash2, Sparkles } from 'lucide-react';

type Mode = 'none' | 'image' | 'omni';
interface CLine {
  id: string; text: string; start: number; end: number;
  mode: Mode;
  visualUrl?: string;   // картинка (Ken Burns) или готовый Omni/видео клип
  isVideo?: boolean;    // true = клип (cover), false = картинка (Ken Burns)
  omniPrompt?: string;
  omniBusy?: boolean;
  omniNote?: string | null;
}

const OMNI_CREDITS = 20; // ориентир: Omni≈Fast-клип ~20 кр (на Ultra ~10)

export default function CommentatorPanel({ token }: { token: string | null }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [audioName, setAudioName] = useState('');
  const [format, setFormat] = useState<'9:16' | '16:9'>('9:16');
  const [lines, setLines] = useState<CLine[]>([]);
  const [audioBusy, setAudioBusy] = useState(false);
  const [diarBusy, setDiarBusy] = useState(false);
  const [buildBusy, setBuildBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const auth = useCallback((): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const authJson = useCallback((): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);
  const setLine = (id: string, patch: Partial<CLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const omniCount = useMemo(() => lines.filter((l) => l.mode === 'omni' && l.visualUrl).length, [lines]);
  const readyCount = useMemo(() => lines.filter((l) => l.visualUrl).length, [lines]);

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
      const cl: CLine[] = raw
        .filter((l: any) => Number.isFinite(Number(l?.start)))
        .map((l: any, i: number) => ({ id: 'l' + i + '_' + Math.random().toString(36).slice(2, 6), text: String(l?.text || '').trim(), start: Number(l.start), end: Number(l?.end ?? l.start), mode: 'none' as Mode }));
      setLines(cl);
      setNote({ ok: cl.length > 0, text: cl.length ? `Разобрано сегментов: ${cl.length}. Привяжите картинки/Omni и соберите.` : 'Не удалось разобрать запись (нужен Gemini-ключ).' });
    } catch (e: any) { setNote({ ok: false, text: e?.message || 'Ошибка разбора' }); }
    finally { setDiarBusy(false); }
  }, [audioUrl, authJson]);

  // ── картинка на строку (Ken Burns) ──
  const uploadLineImage = useCallback(async (id: string, files: FileList | null) => {
    const f = files && files[0]; if (!f) return;
    setLine(id, { omniBusy: true, omniNote: null });
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/trends/media/upload?kind=reference', { method: 'POST', headers: auth(), body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.asset?.fileUrl) throw new Error(d?.error || 'ошибка');
      setLine(id, { mode: 'image', visualUrl: d.asset.fileUrl, isVideo: false, omniBusy: false, omniNote: null });
    } catch (e: any) { setLine(id, { omniBusy: false, omniNote: e?.message || 'ошибка' }); }
  }, [auth]);

  // ── Omni-клип на строку (через /omni/generate + поллинг /omni/status) ──
  const genOmni = useCallback(async (id: string) => {
    const line = lines.find((l) => l.id === id);
    const prompt = (line?.omniPrompt || '').trim();
    if (!prompt) { setLine(id, { omniNote: 'Впишите, что сгенерировать.' }); return; }
    setLine(id, { omniBusy: true, omniNote: 'Omni генерирует…' });
    try {
      const res = await fetch('/api/render/omni/generate', { method: 'POST', headers: authJson(), body: JSON.stringify({ prompt, aspect: format }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.jobId) throw new Error(d?.error || 'Omni недоступен');
      const jobId = d.jobId; const started = Date.now();
      const poll = async (): Promise<void> => {
        if (!aliveRef.current) return;
        const s = await fetch('/api/render/omni/status?jobId=' + jobId, { headers: auth() });
        const sd = await s.json().catch(() => ({}));
        if (sd?.status === 'done' && sd?.fileUrl) { setLine(id, { mode: 'omni', visualUrl: sd.fileUrl, isVideo: true, omniBusy: false, omniNote: 'клип готов ✓' }); return; }
        if (sd?.status === 'failed') { setLine(id, { omniBusy: false, omniNote: sd?.error || 'Omni не смог' }); return; }
        if (Date.now() - started > 180_000) { setLine(id, { omniBusy: false, omniNote: 'таймаут Omni' }); return; }
        setTimeout(poll, 5000);
      };
      poll();
    } catch (e: any) { setLine(id, { omniBusy: false, omniNote: e?.message || 'ошибка Omni' }); }
  }, [lines, authJson, auth, format]);

  const clearLineVisual = (id: string) => setLine(id, { mode: 'none', visualUrl: undefined, isVideo: false, omniNote: null });

  // ── сборка ──
  const build = useCallback(async () => {
    if (!audioUrl) { setNote({ ok: false, text: 'Сначала загрузите аудио.' }); return; }
    if (!lines.length) { setNote({ ok: false, text: 'Сначала разберите запись.' }); return; }
    setBuildBusy(true); setNote(null); setResult(null);
    try {
      const payload = lines.map((l) => ({ start: l.start, end: l.end, visualUrl: l.visualUrl || undefined, isVideo: !!l.isVideo }));
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

  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Загрузите дорожку — это ваш голос. Разбор на сегменты, на каждый — картинка (бесплатный Ken Burns) или Omni-клип. Собранный ролик падает в Галерею → «Google Flow».</p>

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

      {/* строки */}
      {lines.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-0.5">
          {lines.map((l, i) => (
            <div key={l.id} className="rounded-lg px-2.5 py-2 flex flex-col gap-1.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-700 tabular-nums" style={{ color: 'var(--text-muted)', minWidth: 34 }}>{fmtT(l.start)}</span>
                <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-secondary)' }} title={l.text}>{l.text || '—'}</span>
                {l.visualUrl && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-600" style={{ color: l.isVideo ? '#6366f1' : '#10b981' }}>
                    {l.isVideo ? <Film size={11} /> : <ImageIcon size={11} />}{l.isVideo ? 'Omni' : 'фото'}
                  </span>
                )}
                <label className="w-7 h-7 rounded-md inline-flex items-center justify-center cursor-pointer" title="Картинка (Ken Burns)" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-medium)' }}>
                  {l.omniBusy && l.mode !== 'omni' ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                  <input type="file" accept="image/*" hidden onChange={(e) => uploadLineImage(l.id, e.target.files)} />
                </label>
                <button onClick={() => setLine(l.id, { mode: l.mode === 'omni' ? 'none' : 'omni' })} title="Omni-клип" className="w-7 h-7 rounded-md inline-flex items-center justify-center" style={{ background: l.mode === 'omni' ? 'rgba(99,102,241,0.16)' : 'var(--bg-secondary)', color: l.mode === 'omni' ? '#6366f1' : 'var(--text-muted)', border: '1px solid var(--border-medium)' }}><Sparkles size={12} /></button>
                {l.visualUrl && <button onClick={() => clearLineVisual(l.id)} title="Убрать" className="w-7 h-7 rounded-md inline-flex items-center justify-center" style={{ background: 'var(--bg-secondary)', color: '#ef4444', border: '1px solid var(--border-medium)' }}><Trash2 size={12} /></button>}
              </div>
              {l.mode === 'omni' && (
                <div className="flex items-center gap-1.5">
                  <input value={l.omniPrompt || ''} onChange={(e) => setLine(l.id, { omniPrompt: e.target.value })} placeholder="сцена для Omni: «медленный пролёт над городом на закате…»"
                    className="flex-1 text-[11px] px-2 py-1 rounded-md" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  <button onClick={() => genOmni(l.id)} disabled={l.omniBusy} className="text-[11px] font-600 px-2 py-1 rounded-md disabled:opacity-50" style={{ background: '#6366f1', color: '#fff' }}>
                    {l.omniBusy ? <Loader2 size={12} className="animate-spin" /> : 'Сген.'}
                  </button>
                </div>
              )}
              {l.omniNote && <span className="text-[10px]" style={{ color: l.omniNote.includes('✓') ? '#10b981' : 'var(--text-muted)' }}>{l.omniNote}</span>}
            </div>
          ))}
        </div>
      )}

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
          <a href={result} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-[12px] font-600 py-2" style={{ color: '#6366f1' }}>
            <Play size={13} /> открыть ролик
          </a>
        </div>
      )}
    </div>
  );
}
