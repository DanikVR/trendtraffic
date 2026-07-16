/**
 * HotebookStudio — ПОЛНОЭКРАННАЯ студия Hotebook (NotebookLM внутри TrendTraffic).
 *
 * Раскладка как у notebooklm.google.com: ИСТОЧНИКИ (слева) · ЧАТ (по центру) · СТУДИЯ (справа),
 * но в дизайне нашего сайта (токены var(--…), фирменный циан Hotebook #22d3ee).
 *
 * Представление: ВСЁ состояние и обработчики живут в MontageEditor и приходят пропсами
 * (зеркало UgcStudio) — так сохраняются персист в graph.hotebook, solo-режим (onBack),
 * поллинг джоб и 4 под-модалки (настройки генерации / вставка текста / пикер / просмотр
 * артефакта), которые MontageEditor рисует поверх этой студии по своему состоянию.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, ArrowLeft, RefreshCw, ExternalLink, AlertTriangle, Check, Globe, FileText, X,
  Plus, Type, Paperclip, Sparkles, Loader2, Send, Wand2, Play, Download,
} from 'lucide-react';
import { AudioPlayer } from '../../components/AudioPlayer';

// ── мини-Markdown (жирный/списки/абзацы), копия из MontageEditor — без внешних либ ──
function HbMarkdown({ text }: { text: string }) {
  const clean = String(text || '')
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, '')        // [1] / [1, 2] цитаты
    .replace(/ /g, ' ')
    .trim();
  const inline = (s: string, key: React.Key) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={key}>
        {parts.map((p, i) =>
          /^\*\*[^*]+\*\*$/.test(p)
            ? <b key={i} style={{ color: 'var(--text-primary)' }}>{p.slice(2, -2)}</b>
            : <React.Fragment key={i}>{p}</React.Fragment>
        )}
      </React.Fragment>
    );
  };
  const blocks = clean.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split('\n');
        const isList = lines.every((l) => /^\s*[-*•]\s+/.test(l)) && lines.length > 0;
        if (isList) {
          return (
            <ul key={bi} style={{ margin: bi ? '6px 0 0' : 0, paddingLeft: 18, listStyle: 'disc' }}>
              {lines.map((l, li) => <li key={li} style={{ margin: '2px 0' }}>{inline(l.replace(/^\s*[-*•]\s+/, ''), li)}</li>)}
            </ul>
          );
        }
        return <p key={bi} style={{ margin: bi ? '6px 0 0' : 0 }}>{lines.map((l, li) => <React.Fragment key={li}>{li ? <br /> : null}{inline(l, li)}</React.Fragment>)}</p>;
      })}
    </>
  );
}

export interface HotebookStudioProps {
  hb: { chat: { q: string; a: string; ts: number; cites?: number; pending?: boolean }[]; settings: any; name?: string };
  hbMutate: (fn: (h: any) => any) => void;
  hbStatus: any;
  hbSources: any[];
  hbJobs: any[];
  hbCounters: Record<string, number>;
  hbArtifactCounts: Record<string, number>;
  hbLoading: boolean;
  hbNote: string | null;
  hbOk: string | null;
  hbSuggestions: string[];
  hbSrcUrl: string; setHbSrcUrl: (v: string) => void; hbSrcBusy: boolean;
  hbChatQ: string; setHbChatQ: (v: string) => void; hbChatBusy: boolean;
  hbPlayId: string | null; setHbPlayId: (v: string | null) => void;
  hbRefreshStatus: (force?: boolean) => void;
  hbAddUrl: () => void;
  setHbTextOpen: (v: boolean) => void;
  hbOpenPick: () => void;
  hbDelSource: (sid: string) => void;
  hbAsk: () => void;
  hbOpenGen: (t: any) => void;
  setHbView: (j: any) => void;
  onClose: () => void;
  hbTypes: { t: string; label: string }[];
  hbIcon: Record<string, React.ReactNode>;
  hbLabel: Record<string, string>;
  hbNotebookId: string | null;
  onReload: () => void;
  hbStudioArts: { index: number; title: string; kind: string }[];
  hbStudioLoading: boolean;
  hbStudioDl: Set<number>;
  hbDownloadStudioArt: (art: { index: number; title: string; kind: string }) => void;
}

const CYAN = '#22d3ee';
const iconBtn: React.CSSProperties = {
  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)',
  cursor: 'pointer', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const colHead = 'text-[11px] font-700 inline-flex items-center gap-1.5 uppercase tracking-wide';

export function HotebookStudio(props: HotebookStudioProps) {
  const { t } = useTranslation('common');
  const {
    hb, hbMutate, hbStatus, hbSources, hbJobs, hbCounters, hbArtifactCounts, hbLoading, hbNote, hbOk, hbSuggestions,
    hbSrcUrl, setHbSrcUrl, hbSrcBusy, hbChatQ, setHbChatQ, hbChatBusy, hbPlayId, setHbPlayId,
    hbRefreshStatus, hbAddUrl, setHbTextOpen, hbOpenPick, hbDelSource, hbAsk, hbOpenGen, setHbView, onClose,
    hbTypes, hbIcon, hbLabel,
    hbNotebookId, onReload, hbStudioArts, hbStudioLoading, hbStudioDl, hbDownloadStudioArt,
  } = props;

  const genToday = Object.values(hbCounters).reduce((s, n) => s + (n || 0), 0);
  const noSources = hbSources.length === 0;
  const nbUrl = hbNotebookId ? `https://notebooklm.google.com/notebook/${hbNotebookId}` : 'https://notebooklm.google.com';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Верхняя панель ── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <button onClick={onClose} title={t('sec.hotebook.exitTitle', 'Выход в Галерею')}
          className="inline-flex items-center gap-1.5 text-[13px] font-600 px-2.5 py-1.5 rounded-lg"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          <ArrowLeft size={15} /> {t('sec.hotebook.exitBtn', 'Выход')}
        </button>
        <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#06b6d4,#22d3ee)', color: '#fff' }}>
          <BookOpen size={17} />
        </span>
        <input value={hb.name || ''} onChange={(e) => hbMutate((h) => ({ ...h, name: e.target.value }))}
          placeholder={t('sec.hotebook.namePh', 'Название блокнота — им подпишутся готовые файлы')}
          className="px-3 py-1.5 rounded-lg text-sm font-600 outline-none"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', width: 360, maxWidth: '38vw' }} />
        <div className="flex-1" />
        {hbStatus?.ok
          ? <span className="text-[11px] font-600 inline-flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}><Check size={12} /> {t('sec.hotebook.stOnline', 'на связи')}</span>
          : <span className="text-[11px] font-600 inline-flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.14)', color: '#f59e0b' }}><AlertTriangle size={12} /> {t('sec.hotebook.stOffline', 'не на связи')}</span>}
        <button onClick={onReload} title={t('sec.hotebook.refreshTitle', 'Обновить: статус, источники, чат и готовые работы')} style={iconBtn}>
          <RefreshCw size={14} className={hbLoading || hbStudioLoading ? 'animate-spin' : ''} />
        </button>
        <button onClick={() => window.open(nbUrl, '_blank', 'noopener')}
          title={hbNotebookId ? t('sec.hotebook.openThisNbTitle', 'Открыть ЭТОТ блокнот в NotebookLM') : t('sec.hotebook.openNbBtn', 'Открыть NotebookLM')}
          className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--brand)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
          <ExternalLink size={14} /> {t('sec.hotebook.openNbBtn', 'Открыть NotebookLM')}
        </button>
      </div>

      {/* ── Плашка «не на связи» (полная ширина под баром) ── */}
      {hbStatus && !hbStatus.ok && (
        <div className="flex items-start gap-2.5 px-4 py-2 flex-shrink-0" style={{ background: 'rgba(245,158,11,0.10)', borderBottom: '1px solid rgba(245,158,11,0.35)' }}>
          <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
          <p className="text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
            <b style={{ color: '#f59e0b' }}>
              {hbStatus.errorKind === 'ext_offline' ? t('sec.hotebook.errExtOffline', 'Расширение Hotebook не на связи.') : hbStatus.errorKind === 'ext_login' ? t('sec.hotebook.errLogin', 'Нужен вход в Google (NotebookLM).') : t('sec.hotebook.errSync', 'Синхронизация не работает.')}
            </b>{' '}
            {hbStatus.errorKind === 'ext_offline'
              ? t('sec.hotebook.hintExtOffline', 'Установите единое расширение TrendTraffic (Настройки → «Генерация») и откройте вкладку notebooklm.google.com в этом браузере, затем нажмите ↻ (Обновить) вверху.')
              : hbStatus.errorKind === 'ext_login'
                ? t('sec.hotebook.hintLogin', 'Откройте notebooklm.google.com и войдите в свой Google-аккаунт, затем нажмите ↻ (Обновить) вверху.')
                : t('sec.hotebook.hintSync', 'Проверьте расширение и открытую вкладку NotebookLM, затем нажмите ↻ (Обновить) вверху.')}
          </p>
        </div>
      )}

      {/* ── Тело: 3 колонки ── */}
      <div className="flex-1 min-h-0" style={{ display: 'flex', overflow: 'hidden' }}>

        {/* ===== Колонка 1: ИСТОЧНИКИ (шапка+ввод закреплены, СПИСОК скроллится) ===== */}
        <aside className="flex flex-col" style={{ width: 340, flexShrink: 0, borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div className="p-3.5 space-y-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className={colHead} style={{ color: 'var(--text-muted)' }}>
              <Globe size={13} style={{ color: CYAN }} /> {t('sec.hotebook.srcHead', 'Источники')} {hbSources.length > 0 && `· ${hbSources.length}`}
              {hbLoading && <Loader2 size={11} className="animate-spin" />}
            </div>
            <div className="flex gap-1.5">
              <input value={hbSrcUrl} onChange={(e) => setHbSrcUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') hbAddUrl(); }}
                placeholder={t('sec.hotebook.srcUrlPh', 'Ссылка: статья, сайт или YouTube…')} className="flex-1 min-w-0 px-2.5 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
              <button onClick={() => hbAddUrl()} disabled={hbSrcBusy || !hbSrcUrl.trim()} title={t('sec.hotebook.addUrlTitle', 'Добавить ссылку')}
                className="px-3 rounded-lg text-xs font-700 inline-flex items-center gap-1 disabled:opacity-50"
                style={{ background: CYAN, color: '#083344', border: 'none', cursor: 'pointer' }}>
                {hbSrcBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              </button>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => setHbTextOpen(true)} disabled={hbSrcBusy}
                className="flex-1 py-2 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <Type size={12} /> {t('sec.hotebook.pasteTextBtn', 'Вставить текст')}
              </button>
              <button onClick={() => hbOpenPick()} disabled={hbSrcBusy}
                className="flex-1 py-2 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <Paperclip size={12} /> {t('sec.hotebook.galleryFileBtn', 'Файл из Галереи')}
              </button>
            </div>
            {hbOk && <p className="text-[11px] inline-flex items-center gap-1.5" style={{ color: '#10b981' }}><Check size={12} /> {hbOk}</p>}
          </div>

          {/* СПИСОК источников — скроллится независимо (много источников: листаются вверх/вниз) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
            {hbSources.length > 0 ? hbSources.map((s: any, i: number) => {
              const sid = s.id || s.source_id || String(i);
              const title = s.title || s.name || s.url || t('sec.hotebook.srcUntitled', 'источник');
              return (
                <div key={sid} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                  <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span className="text-[11px] truncate flex-1" style={{ color: 'var(--text-primary)' }} title={title}>{title}</span>
                  <button onClick={() => hbDelSource(sid)} title={t('sec.hotebook.delSrcTitle', 'Удалить источник')} className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><X size={11} /></button>
                </div>
              );
            }) : (
              <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-medium)' }}>
                <FileText size={22} style={{ color: 'var(--text-disabled)', margin: '0 auto 6px' }} />
                <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{t('sec.hotebook.noSrcHint', 'Пока нет источников. Добавьте ссылку, текст или файл — тогда заработают чат и студия.')}</p>
              </div>
            )}
          </div>
        </aside>

        {/* ===== Колонка 2: ЧАТ ===== */}
        <section className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', minWidth: 380 }}>
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className={colHead} style={{ color: 'var(--text-muted)' }}><Sparkles size={13} style={{ color: CYAN }} /> {t('sec.hotebook.chatHead', 'Чат по источникам')}</span>
            {hb.chat.length > 0 && (
              <button onClick={() => hbMutate((h) => ({ ...h, chat: [] }))} title={t('sec.hotebook.clearHistTitle', 'Очистить историю')}
                className="text-[10px] font-600" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('sec.hotebook.clearHistBtn', 'очистить')}</button>
            )}
          </div>

          {/* лента сообщений */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            {hb.chat.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6" style={{ color: 'var(--text-muted)' }}>
                <span className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(34,211,238,0.10)', color: CYAN }}><Sparkles size={26} /></span>
                <div className="text-base font-700 mb-1" style={{ color: 'var(--text-secondary)' }}>{t('sec.hotebook.chatEmptyTitle', 'Спросите о ваших источниках')}</div>
                <p className="text-[12.5px]" style={{ maxWidth: 460 }}>
                  {noSources ? t('sec.hotebook.chatEmptyNoSrc', 'Сначала добавьте источники слева — ссылку, текст или файл из Галереи. Затем задавайте вопросы и собирайте артефакты в Студии справа.')
                    : t('sec.hotebook.chatEmptyHasSrc', 'Задайте вопрос по добавленным источникам — NotebookLM ответит с цитатами. Готовые артефакты (аудио, отчёты, тесты…) собираются в Студии справа.')}
                </p>
              </div>
            ) : (
              <div className="space-y-3" style={{ maxWidth: 760, margin: '0 auto' }}>
                {hb.chat.map((m, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="text-[13px] px-3.5 py-2 rounded-2xl ml-auto" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--text-primary)', maxWidth: '80%', width: 'fit-content' }}>{m.q}</div>
                    <div className="text-[13px] px-3.5 py-2.5 rounded-2xl leading-relaxed" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      {m.pending
                        ? <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}><Loader2 size={13} className="animate-spin" /> {t('sec.hotebook.thinking', 'думает…')}</span>
                        : <><HbMarkdown text={m.a} />{!!m.cites && <div className="text-[10px] mt-2 font-700" style={{ color: CYAN }}>{t('sec.hotebook.citesN', '⌘ {{n}} цитат из источников', { n: m.cites })}</div>}</>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* подсказки + ввод (низ) */}
          <div className="px-4 py-3 flex-shrink-0 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            {hbSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5" style={{ maxWidth: 760, margin: '0 auto' }}>
                {hbSuggestions.map((s, i) => (
                  <button key={i} type="button" onClick={() => setHbChatQ(s)} title={t('sec.hotebook.suggestTitle', 'Подставить вопрос')}
                    className="text-[11px] px-2.5 py-1.5 rounded-full text-left transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(34,211,238,0.10)', color: CYAN, border: '1px solid rgba(34,211,238,0.35)', cursor: 'pointer' }}>{s}</button>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end" style={{ maxWidth: 760, margin: '0 auto' }}>
              <textarea value={hbChatQ} onChange={(e) => setHbChatQ(e.target.value)} rows={2}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); hbAsk(); } }}
                placeholder={noSources ? t('sec.hotebook.chatPhNoSrc', 'Сначала добавьте источники…') : t('sec.hotebook.chatPh', 'Спросите о ваших источниках… (Enter — отправить, Shift+Enter — новая строка)')}
                className="flex-1 px-3.5 py-2.5 rounded-xl text-[13px] outline-none resize-y leading-relaxed"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: 52, maxHeight: 220 }} />
              <button onClick={() => hbAsk()} disabled={hbChatBusy || !hbChatQ.trim()} title={t('sec.hotebook.askTitle', 'Спросить')}
                className="w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                style={{ background: CYAN, color: '#083344', border: 'none', cursor: 'pointer' }}>
                {hbChatBusy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
            {hbNote && <p className="text-[11px] text-center" style={{ color: '#ef4444' }}>{hbNote}</p>}
          </div>
        </section>

        {/* ===== Колонка 3: СТУДИЯ ===== */}
        <aside className="p-3.5 space-y-3" style={{ width: 384, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between">
            <span className={colHead} style={{ color: 'var(--text-muted)' }}><Wand2 size={13} style={{ color: CYAN }} /> {t('sec.hotebook.studioHead', 'Студия')}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('sec.hotebook.todayGens', 'Сегодня: {{n}} генераций', { n: genToday })}</span>
          </div>

          {/* 9 плиток */}
          <div className="grid grid-cols-2 gap-2">
            {hbTypes.map(({ t: tileType, label }) => {
              const made = hbArtifactCounts[tileType] || 0;
              const gen = hbJobs.some((j: any) => j.type === tileType && (j.status === 'queued' || j.status === 'running'));
              return (
                <button key={tileType} onClick={() => hbOpenGen(tileType)} disabled={noSources}
                  title={noSources ? t('sec.hotebook.tileNoSrc', 'Сначала добавьте источники') : t('sec.hotebook.tileGen', 'Настроить и сгенерировать: {{label}}', { label }) + (made ? ' ' + t('sec.hotebook.tileMadeN', '· сделано: {{n}}', { n: made }) : '')}
                  className="relative rounded-xl px-2 py-3 flex flex-col items-center gap-1.5 disabled:opacity-40 transition-transform hover:-translate-y-0.5"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: noSources ? 'not-allowed' : 'pointer' }}>
                  <span style={{ color: CYAN }}>{hbIcon[tileType]}</span>
                  <span className="text-[11px] font-600 leading-tight text-center">{label}</span>
                  {gen
                    ? <span className="absolute top-1.5 right-1.5"><Loader2 size={12} className="animate-spin" style={{ color: CYAN }} /></span>
                    : made > 0 && <span className="absolute top-1.5 right-1.5 text-[9px] font-700 px-1 rounded" style={{ background: 'rgba(34,211,238,0.18)', color: CYAN }}>{made}</span>}
                </button>
              );
            })}
          </div>

          {/* Готовые работы, СДЕЛАННЫЕ В NotebookLM (не нами) — импорт в Галерею по кнопке «Загрузить» */}
          {(hbStudioArts.length > 0 || hbStudioLoading) && (
            <div className="pt-1">
              <div className="text-[11px] font-700 uppercase tracking-wide mb-1.5 inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                {t('sec.hotebook.nbReadyHead', 'Готовое в NotebookLM')} {hbStudioLoading && <Loader2 size={11} className="animate-spin" />}
              </div>
              <div className="space-y-1.5">
                {hbStudioArts.map((a) => {
                  const dl = hbStudioDl.has(a.index);
                  return (
                    <div key={a.index} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                      <span style={{ color: CYAN, flexShrink: 0 }}>{a.kind === 'media' ? <Play size={14} /> : <FileText size={14} />}</span>
                      <span className="text-[11px] font-600 truncate flex-1" style={{ color: 'var(--text-primary)' }} title={a.title}>{a.title}</span>
                      <button onClick={() => hbDownloadStudioArt(a)} disabled={dl} title={t('sec.hotebook.dlToGalleryTitle', 'Скачать в Галерею → Hotebook')}
                        className="text-[10px] font-700 px-2 py-1 rounded-lg flex-shrink-0 inline-flex items-center gap-1 disabled:opacity-60"
                        style={{ background: CYAN, color: '#083344', border: 'none', cursor: dl ? 'default' : 'pointer' }}>
                        {dl ? <><Loader2 size={11} className="animate-spin" /> {t('sec.hotebook.dlBusy', 'Загружаю…')}</> : <><Download size={11} /> {t('sec.hotebook.dlBtn', 'Загрузить')}</>}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('sec.hotebook.nbReadyHint', 'Работы, сделанные прямо в NotebookLM. «Загрузить» — скачает в Галерею → «Hotebook».')}</p>
            </div>
          )}

          {/* артефакты (наши джобы) */}
          <div className="pt-1">
            <div className="text-[11px] font-700 uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>{t('sec.hotebook.artsHead', 'Артефакты')}</div>
            {hbJobs.length === 0 ? (
              <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-medium)' }}>
                <Wand2 size={20} style={{ color: 'var(--text-disabled)', margin: '0 auto 6px' }} />
                <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{t('sec.hotebook.artsEmpty', 'Готовые аудио, видео, отчёты и другое появятся здесь. Также — в Галерее → «Hotebook».')}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {hbJobs.map((j: any) => {
                  const jt = j.type as string;
                  const running = j.status === 'queued' || j.status === 'running';
                  const isJson = ['quiz', 'flashcards', 'mindmap', 'table'].includes(jt);
                  const isAudio = jt === 'audio';
                  const isVideo = jt === 'video';
                  const playable = (isAudio || isVideo) && j.status === 'done' && !!j.fileUrl;
                  const open = hbPlayId === j.id;
                  return (
                    <div key={j.id} className="rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <span style={{ color: CYAN, flexShrink: 0 }}>{hbIcon[jt] || <FileText size={15} />}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-600 truncate" style={{ color: 'var(--text-primary)' }}>{hbLabel[jt] || jt}</div>
                          <div className="text-[9px]" style={{ color: j.status === 'error' ? '#ef4444' : 'var(--text-muted)' }} title={j.error || undefined}>
                            {running ? t('sec.hotebook.jobRunning', 'Генерируется… (можно закрыть студию)') : j.status === 'error' ? (j.error || t('sec.hotebook.jobError', 'Ошибка')) : t('sec.hotebook.jobDoneAt', 'Готово · {{date}}', { date: new Date(j.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) })}
                          </div>
                        </div>
                        {running && <Loader2 size={14} className="animate-spin" style={{ color: CYAN, flexShrink: 0 }} />}
                        {playable && (
                          <button onClick={() => setHbPlayId(open ? null : j.id)} className="text-[10px] font-700 px-2 py-1 rounded-lg flex-shrink-0 inline-flex items-center gap-1"
                            style={{ background: open ? 'var(--bg-secondary)' : CYAN, color: open ? 'var(--text-secondary)' : '#083344', border: 'none', cursor: 'pointer' }}>
                            {open ? <><X size={11} /> {t('sec.hotebook.collapseBtn', 'Свернуть')}</> : <><Play size={11} /> {isAudio ? t('sec.hotebook.listenBtn', 'Слушать') : t('sec.hotebook.watchBtn', 'Смотреть')}</>}
                          </button>
                        )}
                        {j.status === 'done' && isJson && j.payload && (
                          <button onClick={() => setHbView(j)} className="text-[10px] font-700 px-2 py-1 rounded-lg flex-shrink-0"
                            style={{ background: CYAN, color: '#083344', border: 'none', cursor: 'pointer' }}>{t('sec.hotebook.openBtn', 'Открыть')}</button>
                        )}
                        {j.status === 'done' && j.fileUrl && !isJson && !playable && (
                          <a href={j.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] font-700 px-2 py-1 rounded-lg flex-shrink-0"
                            style={{ background: CYAN, color: '#083344', textDecoration: 'none' }}>{t('sec.hotebook.openBtn', 'Открыть')}</a>
                        )}
                        {j.status === 'done' && j.fileUrl && (
                          <a href={j.fileUrl} download className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" title={t('sec.hotebook.dlFileTitle', 'Скачать')}
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}><Download size={11} /></a>
                        )}
                      </div>
                      {playable && open && (
                        <div className="px-2 pb-2">
                          {isAudio ? <AudioPlayer src={j.fileUrl} /> : <video src={j.fileUrl} controls autoPlay className="w-full rounded-lg" style={{ maxHeight: 220, background: '#000' }} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
