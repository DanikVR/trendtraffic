/**
 * FlowExtPanel — панель облака «Google Flow» в TrendFlow.
 *
 * Flow не встраивается (у него нет API и его нельзя во фрейме) — работает
 * Chrome-расширение (apps/flow-extension) в браузере клиента. Эта панель:
 *   1) подключает расширение (передаёт JWT через window.postMessage);
 *   2) ставит промпты в очередь (POST /api/flow-ext/enqueue) — можно взять из
 *      сегментов блока Omni;
 *   3) показывает статусы задач (GET /api/flow-ext/list, автo-поллинг). Готовые
 *      клипы падают в Галерею → вкладка «Google Flow».
 *
 * Связь с расширением — postMessage (без externally_connectable, т.к. у .zip-
 * расширения нестабильный ID): SPA шлёт {source:'trendtraffic',...},
 * content-bridge отвечает {source:'tt-flow-ext',...}. Наличие расширения
 * определяем по ответу на 'status' (нет ответа за ~1с → не установлено).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plug, Send, Loader2, Trash2, CheckCircle2, XCircle, Clock, Download, ExternalLink, Image } from 'lucide-react';
import CommentatorPanel, { type CommState } from './CommentatorPanel';

type Status = 'queued' | 'running' | 'done' | 'failed';
interface FlowTask {
  id: string; prompt: string; title: string | null;
  status: Status; note: string | null; assetId: string | null; fileUrl: string | null;
}
interface OmniSegment { prompt?: string; engine?: string }

const EXT_ORIGIN = 'trendtraffic';   // метка наших сообщений расширению
const EXT_REPLY = 'tt-flow-ext';     // метка ответов расширения

export default function FlowExtPanel({
  token, flowId, omniSegments, commState, onCommChange, onCommBuild, onCommDiarize, commBusy,
}: {
  token: string | null;
  flowId: string;
  omniSegments?: OmniSegment[];
  commState: CommState;
  onCommChange: (updater: (s: CommState) => CommState) => void;
  onCommBuild: (payload: { audioUrl: string; format: string; lines: any[] }) => void;
  onCommDiarize: (audioUrl: string) => void;
  commBusy?: 'diarize' | 'build' | null;
}) {
  const [extPresent, setExtPresent] = useState<boolean | null>(null); // null = проверяем
  const [connected, setConnected] = useState(false);
  const [prompts, setPrompts] = useState('');
  const [tasks, setTasks] = useState<FlowTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<'clips' | 'commentator'>('clips');

  const auth = useCallback((): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);
  const postToExt = useCallback((type: string, extra?: Record<string, unknown>) => {
    window.postMessage({ source: EXT_ORIGIN, type, ...(extra || {}) }, window.location.origin);
  }, []);

  // Слушаем ответы расширения + пробуем определить его присутствие.
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const d = ev.data;
      if (!d || d.source !== EXT_REPLY) return;
      if (d.type === 'present' || d.type === 'status') setExtPresent(true);
      if (d.type === 'status') setConnected(!!d.connected);
      if (d.type === 'connected') { setConnected(!!d.ok); setExtPresent(true); }
    };
    window.addEventListener('message', onMsg);
    postToExt('status');
    const t = setTimeout(() => setExtPresent((p) => (p === null ? false : p)), 1200);
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t); };
  }, [postToExt]);

  const loadList = useCallback(async () => {
    try {
      const r = await fetch(`/api/flow-ext/list?flowId=${encodeURIComponent(flowId)}`, { headers: auth() });
      if (r.ok) { const d = await r.json(); setTasks(Array.isArray(d.tasks) ? d.tasks : []); }
    } catch { /* тихо */ }
  }, [auth, flowId]);

  // Автo-поллинг очереди, пока есть незавершённые задачи.
  useEffect(() => {
    loadList();
    const iv = setInterval(loadList, 5000);
    return () => clearInterval(iv);
  }, [loadList]);

  const connect = useCallback(() => {
    if (!token) { setNote({ ok: false, text: 'Нет сессии — перезайдите в аккаунт.' }); return; }
    postToExt('connect', { token, apiBase: window.location.origin });
    setNote({ ok: true, text: 'Расширение подключено — начнёт брать задачи из очереди.' });
    setTimeout(() => postToExt('status'), 500);
  }, [postToExt, token]);

  const takeFromOmni = useCallback(() => {
    const list = (omniSegments || []).map((s) => (s.prompt || '').trim()).filter(Boolean);
    if (!list.length) { setNote({ ok: false, text: 'В блоке Omni нет промптов для генерации.' }); return; }
    setPrompts((prev) => (prev.trim() ? prev.trim() + '\n' : '') + list.join('\n'));
  }, [omniSegments]);

  const enqueue = useCallback(async () => {
    const items = prompts.split('\n').map((p) => p.trim()).filter(Boolean).map((prompt) => ({ prompt }));
    if (!items.length) { setNote({ ok: false, text: 'Впишите хотя бы один промпт (по строке — один клип).' }); return; }
    setBusy(true); setNote(null);
    try {
      const r = await fetch('/api/flow-ext/enqueue', { method: 'POST', headers: auth(), body: JSON.stringify({ flowId, items }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setPrompts('');
      setNote({ ok: true, text: `В очередь добавлено: ${d.enqueued}. ${connected ? 'Расширение начнёт генерацию.' : 'Подключите расширение, чтобы запустить.'}` });
      loadList();
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || 'Не удалось поставить в очередь' });
    } finally { setBusy(false); }
  }, [prompts, auth, flowId, connected, loadList]);

  const clearDone = useCallback(async () => {
    try { await fetch('/api/flow-ext/clear', { method: 'POST', headers: auth() }); loadList(); } catch { /* */ }
  }, [auth, loadList]);

  const active = tasks.filter((t) => t.status === 'queued' || t.status === 'running').length;
  const stIcon = (s: Status) =>
    s === 'done' ? <CheckCircle2 size={14} style={{ color: '#10b981' }} />
    : s === 'failed' ? <XCircle size={14} style={{ color: '#ef4444' }} />
    : s === 'running' ? <Loader2 size={14} className="animate-spin" style={{ color: '#6366f1' }} />
    : <Clock size={14} style={{ color: 'var(--text-muted)' }} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
        {(['clips', 'commentator'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className="text-[12px] font-600 py-1.5 rounded-lg" style={{ background: mode === m ? '#6366f1' : 'transparent', color: mode === m ? '#fff' : 'var(--text-muted)' }}>{m === 'clips' ? 'Клипы' : 'Комментатор'}</button>
        ))}
      </div>
      {mode === 'commentator' ? <CommentatorPanel token={token} flowId={flowId} state={commState} onChange={onCommChange} onBuild={onCommBuild} onDiarize={onCommDiarize} commBusy={commBusy} /> : (<>
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Человек работает в своём Google Flow сам — расширение подставляет промпты из очереди и возвращает готовые клипы в Галерею → вкладка «Google Flow».</p>

      {/* 1. Расширение */}
      <div className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-600" style={{ color: 'var(--text-secondary)' }}>
            Расширение:{' '}
            <span style={{ color: extPresent === false ? '#ef4444' : connected ? '#10b981' : extPresent ? '#f59e0b' : 'var(--text-muted)' }}>
              {extPresent === null ? 'проверяю…' : extPresent === false ? 'не установлено' : connected ? 'подключено' : 'установлено, не подключено'}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => window.open('https://labs.google/flow', '_blank', 'noopener')}
              title="Открыть Google Flow в новой вкладке"
              className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
              <ExternalLink size={14} /> Открыть Flow
            </button>
            {extPresent === false ? (
              <a href="/flow-extension.zip" download className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg" style={{ background: '#6366f1', color: '#fff' }}>
                <Download size={14} /> Скачать
              </a>
            ) : (
              <button onClick={connect} disabled={connected}
                className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={{ background: connected ? 'var(--bg-secondary)' : '#6366f1', color: connected ? 'var(--text-muted)' : '#fff', border: connected ? '1px solid var(--border-medium)' : 'none' }}>
                <Plug size={14} /> {connected ? 'Подключено' : 'Подключить'}
              </button>
            )}
          </div>
        </div>
        {extPresent === false && (
          <p className="text-[10.5px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Установите: <code>chrome://extensions</code> → включите «Режим разработчика» → «Загрузить распакованное» → папка расширения. Затем откройте <b>labs.google/flow</b> и войдите в свой Google.
          </p>
        )}
      </div>

      {/* Быстрый доступ к Галерее (готовые клипы Flow + исходники) */}
      <button onClick={() => window.open('/gallery', '_blank', 'noopener')}
        className="inline-flex items-center justify-center gap-2 text-[12px] font-600 px-3 py-2 rounded-xl"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
        <Image size={14} /> Открыть галерею
      </button>

      {/* 2. Промпты → очередь */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-600" style={{ color: 'var(--text-secondary)' }}>Промпты (по строке — один клип)</span>
          {!!(omniSegments && omniSegments.length) && (
            <button onClick={takeFromOmni} className="text-[11px] font-600" style={{ color: '#6366f1' }}>Взять из Omni</button>
          )}
        </div>
        <textarea value={prompts} onChange={(e) => setPrompts(e.target.value)} rows={4}
          placeholder={'киношный закат над городом, медленный пролёт…\nкрупный план капель дождя на стекле'}
          className="w-full rounded-xl px-3 py-2 text-[13px] resize-y"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
        <button onClick={enqueue} disabled={busy || !prompts.trim()}
          className="inline-flex items-center justify-center gap-2 text-[13px] font-600 px-4 py-2.5 rounded-xl disabled:opacity-50"
          style={{ background: '#6366f1', color: '#fff' }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Отправить в Flow
        </button>
      </div>

      {note && (
        <div className="text-[12px] font-600" style={{ color: note.ok ? '#10b981' : '#ef4444' }}>{note.text}</div>
      )}

      {/* 3. Очередь */}
      {tasks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-600" style={{ color: 'var(--text-secondary)' }}>
              Очередь {active > 0 ? `· в работе ${active}` : ''}
            </span>
            <button onClick={clearDone} className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <Trash2 size={12} /> Очистить готовые
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                {stIcon(t.status)}
                <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-secondary)' }} title={t.prompt}>{t.title || t.prompt}</span>
                {t.status === 'failed' && t.note && <span className="text-[10px]" style={{ color: '#ef4444' }} title={t.note}>ошибка</span>}
                {t.status === 'done' && t.fileUrl && (
                  <a href={t.fileUrl} target="_blank" rel="noreferrer" className="text-[11px] font-600" style={{ color: '#6366f1' }}>открыть</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
