/**
 * CommentatorPanel — режим «Комментатор» блока Google Flow. CONTROLLED: состояние (аудио, реплики,
 * jobId сборки, результат) живёт в graph.flow.commentator (MontageEditor) → переживает закрытие
 * панели, крутит кольцо у узла и возобновляет сборку, как подкаст. Сама сборка/поллинг — в
 * MontageEditor (onBuild); панель только редактирует и отражает состояние.
 *
 * Г1: загруженное аудио = голос; редактор — общий DialogueTimeline (тот же, что в подкасте).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Music, Wand2, Loader2, Film, Play, Trash2 } from 'lucide-react';
import DialogueTimeline from './DialogueTimeline';
import { PodLine } from './dialogueTypes';
import { GalleryPicker, type GalleryPickItem } from '../../components/GalleryPicker';
import { ConfirmModal } from '../../components/ConfirmModal';

export interface CommState {
  audioUrl?: string; audioName?: string;
  format?: '9:16' | '16:9';
  lines?: PodLine[];
  buildJobId?: string | null;
  resultUrl?: string | null;
}

const OMNI_CREDITS = 20;
const isVideoUrl = (u?: string): boolean => !!u && /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(u);
const posOf = (l: PodLine): number => (Number.isFinite(l.tStart) ? (l.tStart as number) : Number.isFinite(l.start) ? (l.start as number) : 0);

export default function CommentatorPanel({
  token, flowId, state, onChange, onBuild, onDiarize, commBusy,
}: {
  token: string | null;
  flowId?: string;
  state: CommState;
  onChange: (updater: (s: CommState) => CommState) => void;
  onBuild: (payload: { audioUrl: string; format: string; lines: any[] }) => void;
  onDiarize: (audioUrl: string) => void;
  commBusy?: 'diarize' | 'build' | null;
}) {
  const { t } = useTranslation('common');
  const audioUrl = state.audioUrl || '';
  const audioName = state.audioName || '';
  const format = state.format || '9:16';
  const lines = state.lines || [];
  const result = state.resultUrl || null;

  const [pickOpen, setPickOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const aliveRef = useRef(true);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImgLine = useRef<number | null>(null);

  const auth = useCallback((): HeadersInit => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const authJson = useCallback((): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);
  const patch = useCallback((p: Partial<CommState>) => onChange((s) => ({ ...s, ...p })), [onChange]);
  const setLines = useCallback((updater: (d: PodLine[]) => PodLine[]) => onChange((s) => ({ ...s, lines: updater(s.lines || []) })), [onChange]);
  const setLine = (i: number, p: Partial<PodLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const omniCount = useMemo(() => lines.filter((l) => isVideoUrl(l.image)).length, [lines]);
  const readyCount = useMemo(() => lines.filter((l) => l.image).length, [lines]);

  // ── аудио: единый пикер Галереи (как в подкасте) — выбрать готовое ИЛИ загрузить с устройства ──
  const onAudioUpload = useCallback(async (files: FileList | File[]): Promise<GalleryPickItem[]> => {
    const out: GalleryPickItem[] = [];
    for (const f of Array.from(files).filter(Boolean)) {
      const fd = new FormData(); fd.append('file', f);
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch('/api/trends/media/upload?kind=audio', { method: 'POST', headers: auth(), body: fd });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        const a = d?.asset;
        if (a?.fileUrl) out.push({ id: a.id || a.fileUrl, fileUrl: a.fileUrl, title: a.originalName || f.name, type: 'audio', cat: 'audio' });
      }
    }
    return out;
  }, [auth]);
  const onAudioPick = useCallback((it: GalleryPickItem) => {
    patch({ audioUrl: it.fileUrl, audioName: it.title, lines: [], resultUrl: null, buildJobId: null });
    setNote({ ok: true, text: t('sec.commentator.audioPicked', 'Аудио выбрано — нажмите «Разобрать запись».') });
  }, [patch, t]);
  // Удалить аудио → вместе с ним стираем таймлайн, все реплики и собранный ролик.
  const clearAudio = useCallback(() => {
    patch({ audioUrl: '', audioName: '', lines: [], resultUrl: null, buildJobId: null });
    setNote(null); setConfirmClear(false);
  }, [patch]);
  const askClearAudio = useCallback(() => {
    if ((state.lines || []).length > 0) setConfirmClear(true); else clearAudio();
  }, [state.lines, clearAudio]);

  // ── диаризация (в MontageEditor — переживает закрытие + кольцо у узла) ──
  const diarize = useCallback(() => { if (audioUrl) { setNote(null); onDiarize(audioUrl); } }, [audioUrl, onDiarize]);

  // ── картинка на реплику (Ken Burns) ──
  const pickImage = useCallback((i: number) => { pendingImgLine.current = i; imgInputRef.current?.click(); }, []);
  const onImgChosen = useCallback(async (files: FileList | null) => {
    const f = files && files[0]; const i = pendingImgLine.current;
    if (imgInputRef.current) imgInputRef.current.value = '';
    if (!f || i == null) return;
    setNote({ ok: true, text: t('sec.commentator.imgUploading', 'Загружаю картинку…') });
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/trends/media/upload?kind=reference', { method: 'POST', headers: auth(), body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.asset?.fileUrl) throw new Error(d?.error || t('sec.commentator.imgUploadFail', 'Не удалось загрузить картинку'));
      setLine(i, { image: d.asset.fileUrl, imageName: f.name, mode: 'full' });
      setNote({ ok: true, text: t('sec.commentator.imgAttached', 'Картинка привязана (Ken Burns).') });
    } catch (e: any) { setNote({ ok: false, text: e?.message || t('sec.commentator.imgUploadFail', 'Не удалось загрузить картинку') }); }
  }, [auth, t]);

  // ── Omni-клип на реплику ──
  const genOmni = useCallback(async (i: number) => {
    const line = (state.lines || [])[i];
    const raw = (line?.text || '').trim();
    if (!raw) { setNote({ ok: false, text: t('sec.commentator.omniNoText', 'В реплике нет текста для Omni.') }); return; }
    // Omni — генератор ВИДЕО: сырой текст реплики фильтр блокирует (400 Input blocked).
    // Оборачиваем в промпт-сцену b-roll, иллюстрирующую тему реплики.
    // НЕ i18n: это промпт для генератора (уходит на бэк), а не текст интерфейса.
    const scene = `Документальный кинематографичный b-roll без наложенного текста и без узнаваемых реальных лиц, визуально иллюстрирующий тему: «${raw.slice(0, 200)}». Плавное движение камеры, реалистичное освещение, атмосферно.`;
    setNote({ ok: true, text: t('sec.commentator.omniGenerating', 'Omni генерирует для реплики {{n}}…', { n: i + 1 }) });
    try {
      const res = await fetch('/api/render/omni/generate', { method: 'POST', headers: authJson(), body: JSON.stringify({ prompt: scene, aspect: format }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.jobId) throw new Error(d?.error || t('sec.commentator.omniUnavailable', 'Omni недоступен'));
      const jobId = d.jobId; const started = Date.now();
      const poll = async (): Promise<void> => {
        if (!aliveRef.current) return;
        const s = await fetch('/api/render/omni/status?jobId=' + jobId, { headers: auth() });
        const sd = await s.json().catch(() => ({}));
        if (sd?.status === 'done' && sd?.fileUrl) { setLine(i, { image: sd.fileUrl, mode: 'full' }); setNote({ ok: true, text: t('sec.commentator.omniReady', 'Omni-клип готов на реплику {{n}} ✓', { n: i + 1 }) }); return; }
        if (sd?.status === 'failed') { setNote({ ok: false, text: sd?.error || t('sec.commentator.omniFailed', 'Omni: не удалось сгенерировать клип') }); return; }
        if (Date.now() - started > 180_000) { setNote({ ok: false, text: t('sec.commentator.omniTimeout', 'Omni: таймаут генерации (3 мин)') }); return; }
        setTimeout(poll, 5000);
      };
      poll();
    } catch (e: any) { setNote({ ok: false, text: e?.message || t('sec.commentator.omniError', 'Omni: ошибка генерации') }); }
  }, [state.lines, authJson, auth, format, t]);

  // ── сборка (делегируем в MontageEditor — переживает закрытие) ──
  const build = useCallback(() => {
    if (!audioUrl) { setNote({ ok: false, text: t('sec.commentator.needAudio', 'Сначала выберите аудио.') }); return; }
    if (!lines.length) { setNote({ ok: false, text: t('sec.commentator.needDiarize', 'Сначала разберите запись.') }); return; }
    const payload = [...lines].sort((a, b) => posOf(a) - posOf(b)).map((l) => ({ start: posOf(l), end: posOf(l) + Math.max(0.4, (Number(l.end) - Number(l.start)) || 2), visualUrl: l.image || undefined, isVideo: isVideoUrl(l.image), text: (l.text || '').trim() || undefined }));
    onBuild({ audioUrl, format, lines: payload });
    setNote({ ok: true, text: t('sec.commentator.building', 'Собираю ролик… (можно закрыть — соберётся в фоне, кольцо у иконки)') });
  }, [audioUrl, lines, format, onBuild, t]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('sec.commentator.intro', 'Возьмите дорожку из Галереи (или загрузите туда) — это ваш голос. Разбор на сегменты, редактор-таймлайн как в подкасте (резать/двигать/наложить), на каждый сегмент — картинка (Ken Burns) или Omni-клип; без визуала — текст реплики на тёмном фоне. Ролик падает в Галерею → «Google Flow».')}</p>

      <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={(e) => onImgChosen(e.target.files)} />

      {/* аудио + формат */}
      <div className="rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPickOpen(true)}
            className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg" style={{ background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>
            <Music size={14} /> {t('sec.commentator.pickFromGallery', 'Выбрать из галереи')}
          </button>
          <span className="text-[11px] truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{audioName || t('sec.commentator.noAudio', 'аудио не выбрано')}</span>
          {audioUrl && (
            <button type="button" onClick={askClearAudio} disabled={!!commBusy}
              title={t('sec.commentator.clearAudioTitle', 'Удалить аудио вместе с таймлайном и репликами')}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 disabled:opacity-40"
              style={{ background: 'var(--bg-secondary)', color: '#ef4444', border: '1px solid var(--border-medium)', cursor: commBusy ? 'not-allowed' : 'pointer' }}>
              <Trash2 size={14} />
            </button>
          )}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-medium)' }}>
            {(['9:16', '16:9'] as const).map((f) => (
              <button key={f} onClick={() => patch({ format: f })} className="text-[11px] font-600 px-2 py-1" style={{ background: format === f ? '#6366f1' : 'transparent', color: format === f ? '#fff' : 'var(--text-muted)' }}>{f}</button>
            ))}
          </div>
        </div>
        <button onClick={diarize} disabled={!audioUrl || !!commBusy}
          className="inline-flex items-center justify-center gap-2 text-[12px] font-600 px-3 py-2 rounded-lg disabled:opacity-50"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}>
          {commBusy === 'diarize' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} {commBusy === 'diarize' ? t('sec.commentator.diarizing', 'Разбираю…') : t('sec.commentator.diarizeBtn', 'Разобрать запись')}
        </button>
      </div>

      {/* редактор-таймлайн (общий с подкастом) */}
      <DialogueTimeline dialogue={lines} setDialogue={setLines} recordingUrl={audioUrl} onPickImage={pickImage} onOmni={genOmni} accentA="#6366f1" accentB="#8b5cf6" />

      {lines.length > 0 && (
        <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span>{t('sec.commentator.visualsReady', 'Готово визуалов:')} <b style={{ color: 'var(--text-secondary)' }}>{readyCount}/{lines.length}</b> {t('sec.commentator.omniCredits', '· Omni: {{n}} ≈ {{cr}} кр', { n: omniCount, cr: omniCount * OMNI_CREDITS })}</span>
          <span>{t('sec.commentator.noImageHint', 'без картинки → текст реплики на тёмном фоне')}</span>
        </div>
      )}

      {lines.length > 0 && (
        <button onClick={build} disabled={!!commBusy}
          className="inline-flex items-center justify-center gap-2 text-[13px] font-700 px-4 py-2.5 rounded-xl disabled:opacity-50"
          style={{ background: '#6366f1', color: '#fff' }}>
          {commBusy === 'build' ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />} {commBusy === 'build' ? t('sec.commentator.buildingShort', 'Собираю ролик…') : t('sec.commentator.buildBtn', 'Собрать видео')}
        </button>
      )}

      {note && <div className="text-[12px] font-600" style={{ color: note.ok ? '#10b981' : '#ef4444' }}>{note.text}</div>}

      {result && (
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-700" style={{ color: '#10b981' }}>{t('sec.commentator.resultReady', '✓ Ролик собран — превью ниже, копия в Галерее → «Google Flow»')}</div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-medium)' }}>
            <video src={result} controls playsInline className="w-full block" style={{ maxHeight: 360, background: '#000' }} />
            <a href={result} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-[12px] font-600 py-2" style={{ color: '#6366f1' }}><Play size={13} /> {t('sec.commentator.openVideo', 'открыть ролик')}</a>
          </div>
        </div>
      )}

      {/* Единый пикер Галереи — открывается на «Аудио», можно листать все папки и загрузить с устройства */}
      <GalleryPicker
        open={pickOpen} token={token}
        title={t('sec.commentator.pickerTitle', 'Аудио — ваш голос')} defaultTab="audio"
        note={t('sec.commentator.pickerNote', 'Выберите готовую дорожку из Галереи или загрузите новую — она сразу попадёт в Галерею.')}
        uploadAccept="audio/*,video/*" uploadHint={t('sec.commentator.pickerUploadHint', 'аудио/видео с компьютера или телефона → попадёт в Галерею')}
        onlyType={['audio', 'video']}
        onClose={() => setPickOpen(false)}
        onUpload={onAudioUpload}
        onPick={onAudioPick}
      />

      <ConfirmModal
        open={confirmClear}
        title={t('sec.commentator.confirmClearTitle', 'Удалить аудио?')}
        message={t('sec.commentator.confirmClearMsg', 'Дорожка удалится вместе с таймлайном и всеми репликами ({{n}}). Собранный ролик тоже сбросится. Действие необратимо.', { n: (state.lines || []).length })}
        confirmLabel={t('sec.commentator.delete', 'Удалить')} cancelLabel={t('sec.commentator.cancel', 'Отмена')} variant="danger"
        onConfirm={clearAudio}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
