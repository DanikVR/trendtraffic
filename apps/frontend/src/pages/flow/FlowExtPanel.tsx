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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
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
    if (!token) { setNote({ ok: false, text: t('sec.flowext.noSession', 'Нет сессии — перезайдите в аккаунт.') }); return; }
    postToExt('connect', { token, apiBase: window.location.origin });
    setNote({ ok: true, text: t('sec.flowext.connecting', 'Подключаю расширение — оно начнёт брать задачи из очереди.') });
    setTimeout(() => postToExt('status'), 500);
  }, [postToExt, token, t]);

  const takeFromOmni = useCallback(() => {
    const list = (omniSegments || []).map((s) => (s.prompt || '').trim()).filter(Boolean);
    if (!list.length) { setNote({ ok: false, text: t('sec.flowext.noOmniPrompts', 'В блоке Omni нет промптов для генерации.') }); return; }
    setPrompts((prev) => (prev.trim() ? prev.trim() + '\n' : '') + list.join('\n'));
  }, [omniSegments, t]);

  const enqueue = useCallback(async () => {
    const items = prompts.split('\n').map((p) => p.trim()).filter(Boolean).map((prompt) => ({ prompt }));
    if (!items.length) { setNote({ ok: false, text: t('sec.flowext.needPrompt', 'Впишите хотя бы один промпт (по строке — один клип).') }); return; }
    setBusy(true); setNote(null);
    try {
      const r = await fetch('/api/flow-ext/enqueue', { method: 'POST', headers: auth(), body: JSON.stringify({ flowId, items }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setPrompts('');
      setNote({ ok: true, text: t('sec.flowext.enqueuedN', 'В очередь добавлено: {{n}}.', { n: d.enqueued }) + ' ' + (connected ? t('sec.flowext.extWillStart', 'Расширение начнёт генерацию.') : t('sec.flowext.connectToStart', 'Подключите расширение, чтобы запустить.')) });
      loadList();
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || t('sec.flowext.enqueueFail', 'Не удалось поставить в очередь') });
    } finally { setBusy(false); }
  }, [prompts, auth, flowId, connected, loadList, t]);

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
          <button key={m} onClick={() => setMode(m)} className="text-[12px] font-600 py-1.5 rounded-lg" style={{ background: mode === m ? '#6366f1' : 'transparent', color: mode === m ? '#fff' : 'var(--text-muted)' }}>{m === 'clips' ? t('sec.flowext.tabClips', 'Клипы') : t('sec.flowext.tabCommentator', 'Комментатор')}</button>
        ))}
      </div>
      {mode === 'commentator' ? <CommentatorPanel token={token} flowId={flowId} state={commState} onChange={onCommChange} onBuild={onCommBuild} onDiarize={onCommDiarize} commBusy={commBusy} /> : (<>
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('sec.flowext.intro1', 'Человек работает в своём Google Flow сам — расширение подставляет промпты из очереди и возвращает готовые клипы в Галерею → вкладка «Google Flow». В панели расширения прямо на Flow — кнопки')} <b>{t('sec.flowext.introBtnToGallery', '«⬆ В галерею»')}</b> {t('sec.flowext.introAnd', 'и')} <b>{t('sec.flowext.introBtnFromGallery', '«⬇ Из Галереи»')}</b> {t('sec.flowext.intro2', 'для двустороннего обмена видео/картинками. Единое расширение TrendTraffic работает и на Flow, и на NotebookLM (блок «Hotebook»). Подключение')} <b>{t('sec.flowext.introAuto', 'автоматическое')}</b>{t('sec.flowext.intro3', ': пока вы залогинены здесь, расширение само берёт доступ — кнопка «Подключить» лишь на всякий случай.')}</p>

      {/* 1. Расширение */}
      <div className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-600" style={{ color: 'var(--text-secondary)' }}>
            {t('sec.flowext.extLabel', 'Расширение:')}{' '}
            <span style={{ color: extPresent === false ? '#ef4444' : connected ? '#10b981' : extPresent ? '#f59e0b' : 'var(--text-muted)' }}>
              {extPresent === null ? t('sec.flowext.stChecking', 'проверяю…') : extPresent === false ? t('sec.flowext.stMissing', 'не установлено') : connected ? t('sec.flowext.stConnected', 'подключено') : t('sec.flowext.stNotConnected', 'установлено, не подключено')}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => window.open('https://labs.google/flow', '_blank', 'noopener')}
              title={t('sec.flowext.openFlowTitle', 'Открыть Google Flow в новой вкладке')}
              className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
              <ExternalLink size={14} /> {t('sec.flowext.openFlowBtn', 'Открыть Flow')}
            </button>
            {extPresent === false ? (
              <a href="/trendtraffic-extension.zip" download className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg" style={{ background: '#6366f1', color: '#fff' }}>
                <Download size={14} /> {t('sec.flowext.downloadExtBtn', 'Скачать расширение')}
              </a>
            ) : (
              <button onClick={connect} disabled={connected}
                className="inline-flex items-center gap-1.5 text-[12px] font-600 px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={{ background: connected ? 'var(--bg-secondary)' : '#6366f1', color: connected ? 'var(--text-muted)' : '#fff', border: connected ? '1px solid var(--border-medium)' : 'none' }}>
                <Plug size={14} /> {connected ? t('sec.flowext.btnConnected', 'Подключено') : t('sec.flowext.btnConnect', 'Подключить')}
              </button>
            )}
          </div>
        </div>
        {extPresent === false && (
          <p className="text-[10.5px] mt-2" style={{ color: 'var(--text-muted)' }}>
            {t('sec.flowext.install1', 'Установите:')} <code>chrome://extensions</code> {t('sec.flowext.install2', '→ включите «Режим разработчика» → «Загрузить распакованное» → папка расширения. Затем откройте')} <b>labs.google/flow</b> {t('sec.flowext.install3', 'и войдите в свой Google.')}
          </p>
        )}
      </div>

      {/* Быстрый доступ к Галерее (готовые клипы Flow + исходники) */}
      <button onClick={() => window.open('/gallery', '_blank', 'noopener')}
        className="inline-flex items-center justify-center gap-2 text-[12px] font-600 px-3 py-2 rounded-xl"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)' }}>
        <Image size={14} /> {t('sec.flowext.openGalleryBtn', 'Открыть галерею')}
      </button>

      {/* 2. Промпты → очередь */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-600" style={{ color: 'var(--text-secondary)' }}>{t('sec.flowext.promptsLabel', 'Промпты (по строке — один клип)')}</span>
          {!!(omniSegments && omniSegments.length) && (
            <button onClick={takeFromOmni} className="text-[11px] font-600" style={{ color: '#6366f1' }}>{t('sec.flowext.takeFromOmniBtn', 'Взять из Omni')}</button>
          )}
        </div>
        <textarea value={prompts} onChange={(e) => setPrompts(e.target.value)} rows={4}
          placeholder={t('sec.flowext.promptsPh', 'киношный закат над городом, медленный пролёт…\nкрупный план капель дождя на стекле')}
          className="w-full rounded-xl px-3 py-2 text-[13px] resize-y"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
        <button onClick={enqueue} disabled={busy || !prompts.trim()}
          className="inline-flex items-center justify-center gap-2 text-[13px] font-600 px-4 py-2.5 rounded-xl disabled:opacity-50"
          style={{ background: '#6366f1', color: '#fff' }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t('sec.flowext.sendBtn', 'Отправить в Flow')}
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
              {t('sec.flowext.queueHead', 'Очередь')}{active > 0 ? ' ' + t('sec.flowext.queueLeft', '· осталось {{n}}', { n: active }) : ''}
            </span>
            <button onClick={clearDone} className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <Trash2 size={12} /> {t('sec.flowext.clearFinishedBtn', 'Очистить завершённые')}
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
            {tasks.map((t_) => (
              <div key={t_.id} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                {stIcon(t_.status)}
                <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-secondary)' }} title={t_.prompt}>{t_.title || t_.prompt}</span>
                {t_.status === 'failed' && t_.note && <span className="text-[10px]" style={{ color: '#ef4444' }} title={t_.note}>{t('sec.flowext.errBadge', 'ошибка')}</span>}
                {t_.status === 'done' && t_.fileUrl && (
                  <a href={t_.fileUrl} target="_blank" rel="noreferrer" className="text-[11px] font-600" style={{ color: '#6366f1' }}>{t('sec.flowext.openLink', 'открыть')}</a>
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
