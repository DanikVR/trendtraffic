/**
 * UgcLinesPanel — выдвижная панель «Реплики» над доком таймлайна UGC-студии (фаза 2).
 *
 * Быстрое редактирование диалога по голосам: фильтр «Все · Голос A · Голос B»,
 * правка текста, смена голоса кликом по бейджу A/B, объединение со следующей ⇣,
 * медиа реплики (чип с превью и длительностью, ⊞ — прикрепить), удаление.
 * Для диалога у реплики с видео длиннее фразы — подсказка «покажется целиком, +N с».
 * Данные — те же PodLine из ugc.script (общие с DialogueTimeline), правки через ugcMutate.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Combine, Image as ImageIcon, Play, X } from 'lucide-react';
import type { PodLine } from './dialogueTypes';
import type { UgcSpec } from './ugcTypes';

const ACC = '#a855f7';
const PINK = '#ec4899';

const isVideoUrl = (u?: string | null): boolean => !!u && /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i.test(u);
/* длительность реплики — та же эвристика, что в DialogueTimeline */
const lineDur = (l: PodLine): number => {
  const st = Number(l.start); const en = Number(l.end);
  if (Number.isFinite(st) && Number.isFinite(en) && en > st) return en - st;
  return Math.max(1.5, Math.min(12, (l.text || '').length * 0.06));
};

export interface UgcLinesPanelProps {
  ugc: UgcSpec;
  ugcMutate: (fn: (u: UgcSpec) => UgcSpec) => void;
  onPickMedia: (index: number) => void;   // открыть пикер «Медиа к реплике»
  onClose: () => void;
}

export default function UgcLinesPanel({ ugc, ugcMutate, onPickMedia, onClose }: UgcLinesPanelProps) {
  const { t } = useTranslation('common');
  const dialogueMode = ugc.dialogueEnabled;
  const lines = ugc.script;
  const [filter, setFilter] = useState<'all' | 'A' | 'B'>('all');
  const [sel, setSel] = useState<number | null>(null);

  const mutateLine = (i: number, patch: Partial<PodLine>) =>
    ugcMutate((u) => ({ ...u, script: u.script.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const removeLine = (i: number) => {
    ugcMutate((u) => ({ ...u, script: u.script.filter((_, j) => j !== i) }));
    setSel((s) => (s == null ? s : s === i ? null : s > i ? s - 1 : s));
  };
  /* объединение со следующей — логика 1:1 с DialogueTimeline.mergeLineDown */
  const mergeDown = (i: number) => {
    ugcMutate((u) => {
      const p = u.script;
      const a = p[i]; const b = p[i + 1]; if (!a || !b) return u;
      const starts = [a.start, b.start].filter((x): x is number => Number.isFinite(x));
      const ends = [a.end, b.end].filter((x): x is number => Number.isFinite(x));
      const merged: PodLine = {
        ...a, text: [a.text, b.text].map((x) => (x || '').trim()).filter(Boolean).join(' '),
        ...(starts.length ? { start: Math.min(...starts) } : {}), ...(ends.length ? { end: Math.max(...ends) } : {}),
        image: a.image || b.image, imageName: a.imageName || b.imageName, anim: a.anim || b.anim,
        holdSec: a.holdSec ?? b.holdSec,
      };
      return { ...u, script: [...p.slice(0, i), merged, ...p.slice(i + 2)] };
    });
    setSel((s) => (s == null ? s : s === i + 1 ? i : s > i + 1 ? s - 1 : s));
  };

  const spOf = (l: PodLine): 'A' | 'B' => (dialogueMode && l.speaker === 'B' ? 'B' : 'A');
  const cnt = { A: 0, B: 0 };
  lines.forEach((l) => { cnt[spOf(l)]++; });
  const filters: ['all' | 'A' | 'B', string][] = dialogueMode
    ? [['all', t('ugc.lines.filterAll', { count: lines.length })], ['A', t('ugc.lines.filterVoiceA', { count: cnt.A })], ['B', t('ugc.lines.filterVoiceB', { count: cnt.B })]]
    : [['all', t('ugc.lines.filterAll', { count: lines.length })]];

  return (
    <div className="absolute left-0 right-0 flex flex-col gap-2 px-3.5 pt-2.5 pb-3"
      style={{ bottom: '100%', zIndex: 30, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-medium)', boxShadow: '0 -14px 30px rgba(0,0,0,.25)', maxHeight: 300 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-[12px]" style={{ color: 'var(--text-primary)' }}>{t('ugc.lines.title')}</b>
        <span className="inline-flex gap-1">
          {filters.map(([f, lbl]) => (
            <button key={f} onClick={() => setFilter(f)} className="text-[10px] font-650 px-2.5 py-1 rounded-full"
              style={{ background: filter === f ? ACC : 'var(--bg-tertiary)', color: filter === f ? '#fff' : 'var(--text-muted)', border: `1px solid ${filter === f ? ACC : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
          ))}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
          {dialogueMode ? t('ugc.lines.hintDialogue') : t('ugc.lines.hintMerge')}
        </span>
        <button onClick={onClose} title={t('ugc.common.hide')} className="flex items-center justify-center rounded-lg"
          style={{ width: 26, height: 26, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={13} /></button>
      </div>

      <div className="overflow-y-auto flex flex-col gap-1.5 pr-1" style={{ minHeight: 0 }}>
        {lines.map((l, i) => {
          if (filter !== 'all' && spOf(l) !== filter) return null;
          const sp = spOf(l);
          const vid = isVideoUrl(l.image);
          const dur = lineDur(l);
          const hold = Number(l.holdSec) || 0;
          const holdNote = dialogueMode && vid && hold > dur + 0.05
            ? t('ugc.lines.holdNote', { sec: hold.toFixed(1), extra: (hold - dur).toFixed(1) })
            : null;
          return (
            <div key={i} onClick={() => setSel(i)} className="rounded-xl px-2 py-1.5"
              style={{ background: 'var(--bg-primary)', border: `1px solid ${sel === i ? ACC : 'var(--border-medium)'}`, cursor: 'default' }}>
              <div className="flex items-center gap-1.5">
                <button onClick={(e) => { e.stopPropagation(); if (dialogueMode) mutateLine(i, { speaker: sp === 'A' ? 'B' : 'A' }); }}
                  title={dialogueMode ? t('ugc.lines.swapVoice') : t('ugc.lines.hostVoice')}
                  className="flex-shrink-0 rounded-lg text-[11px] font-800 flex items-center justify-center"
                  style={{ width: 26, height: 26, background: sp === 'A' ? ACC : PINK, color: '#fff', border: 'none', cursor: dialogueMode ? 'pointer' : 'default' }}>{sp}</button>
                <input value={l.text} onChange={(e) => mutateLine(i, { text: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11.5px] outline-none"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                {l.image ? (
                  <span className="relative flex-shrink-0" style={{ width: 26, height: 26 }} title={l.imageName || t('ugc.lines.mediaReplace')}>
                    <button onClick={(e) => { e.stopPropagation(); onPickMedia(i); }} className="w-full h-full rounded-lg overflow-hidden flex items-center justify-center" style={{ border: `1px solid ${ACC}`, background: '#000', cursor: 'pointer', padding: 0 }}>
                      {vid
                        ? <><video src={l.image} muted preload="metadata" className="w-full h-full object-cover" /><Play size={10} fill="#fff" style={{ position: 'absolute', color: '#fff', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }} /></>
                        : <img src={l.image} alt="" className="w-full h-full object-cover" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); mutateLine(i, { image: undefined, imageName: undefined, holdSec: undefined }); }} title={t('ugc.lines.removeMedia')}
                      className="absolute flex items-center justify-center rounded-full"
                      style={{ top: -5, right: -5, width: 13, height: 13, background: 'rgba(0,0,0,.85)', color: '#fff', border: 'none', cursor: 'pointer', padding: 0 }}><X size={8} /></button>
                  </span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); onPickMedia(i); }} title={t('ugc.lines.attachMedia')}
                    className="flex-shrink-0 rounded-lg flex items-center justify-center"
                    style={{ width: 26, height: 26, background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}><ImageIcon size={12} /></button>
                )}
                {i < lines.length - 1 && filter === 'all' && (
                  <button onClick={(e) => { e.stopPropagation(); mergeDown(i); }} title={t('ugc.lines.mergeDown')}
                    className="flex-shrink-0 rounded-lg flex items-center justify-center"
                    style={{ width: 26, height: 26, background: 'var(--bg-tertiary)', color: ACC, border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Combine size={12} /></button>
                )}
                <button onClick={(e) => { e.stopPropagation(); removeLine(i); }} title={t('ugc.lines.removeLine')}
                  className="flex-shrink-0 rounded-lg flex items-center justify-center"
                  style={{ width: 26, height: 26, background: 'var(--bg-tertiary)', color: '#ef4444', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><X size={12} /></button>
              </div>
              {holdNote && (
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)', paddingLeft: 32 }}>
                  <b style={{ color: ACC }}>{holdNote}</b>
                </div>
              )}
            </div>
          );
        })}
        {lines.length === 0 && (
          <p className="text-center text-[11px] py-3" style={{ color: 'var(--text-muted)' }}>{t('ugc.lines.empty')}</p>
        )}
      </div>
    </div>
  );
}
