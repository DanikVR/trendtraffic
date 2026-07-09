/**
 * MontageEditor — радиальный («паутина») холст сценария TrendFlow.
 *
 * В центре — исходное видео; вокруг — облачные блоки (перетаскиваемые узлы):
 * Omni Flash (+Комментатор), UGC, Hotebook, Редактор, Google Flow, Контент-план.
 * Блоки связываются стрелками; у каждого — своя панель настроек.
 *
 * Хранение — в flows.graph (JSONB): source, cloud, cloudEdges, omni, editor, ugc,
 * hotebook, flow.commentator, brief.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Video, Scissors, Crop, Type, Music, Mic, Image,
  UserRound, Search, Share2,
  Plus, Pencil, Trash2, X, Loader2, ArrowLeft, Sparkles, Paperclip, Save, Wand2, Check,
  Cloud, CalendarDays, Download, Link2, Film, Undo2, Redo2, Play, UploadCloud,
  BookOpen, Globe, FileText, Send, ListChecks, Table, Layers, Presentation, RefreshCw, AlertTriangle, ExternalLink,
  Clapperboard, Users,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import FlowExtPanel from './FlowExtPanel';
import { VideoViewer } from '../../components/VideoViewer';
import { AudioPlayer } from '../../components/AudioPlayer';
import { ConfirmModal } from '../../components/ConfirmModal';
import { GalleryPicker, type GalleryPickItem } from '../../components/GalleryPicker';
import DialogueTimeline from './DialogueTimeline';
import type { PodLine } from './dialogueTypes';
import UgcStudio from './UgcStudio';
import { HotebookStudio } from './HotebookStudio';
import { UGC_DEFAULT, type UgcSpec, type UgcPickTarget } from './ugcTypes';

// Облачные узлы графа (перетаскиваемые): Omni Flash, UGC, Hotebook, Редактор, Google Flow, Контент-план.
type CloudId = 'omni' | 'plan' | 'editor' | 'ugc' | 'hotebook' | 'flow';
const CLOUD: Record<CloudId, { label: string; icon: React.ReactNode; color: string; glow: string; def: { x: number; y: number } }> = {
  omni: { label: 'Omni Flash', icon: <Cloud size={24} />, color: '#4285F4', glow: 'rgba(66,133,244,.35)', def: { x: 85, y: 24 } },
  plan: { label: 'Контент-план', icon: <CalendarDays size={22} />, color: '#10b981', glow: 'rgba(16,185,129,.35)', def: { x: 85, y: 76 } },
  editor: { label: 'Редактор', icon: <Film size={22} />, color: '#f59e0b', glow: 'rgba(245,158,11,.35)', def: { x: 15, y: 24 } },
  ugc: { label: 'UGC', icon: <Video size={22} />, color: '#a855f7', glow: 'rgba(168,85,247,.35)', def: { x: 50, y: 12 } },
  hotebook: { label: 'Hotebook', icon: <BookOpen size={22} />, color: '#22d3ee', glow: 'rgba(34,211,238,.35)', def: { x: 50, y: 88 } },
  flow: { label: 'Google Flow', icon: <Clapperboard size={22} />, color: '#6366f1', glow: 'rgba(99,102,241,.35)', def: { x: 85, y: 50 } },
};

// ── Блок «Hotebook» (Google NotebookLM): источники + чат + студия артефактов ──
// Настройки генерации повторяют модалки NotebookLM 1:1 (формат-карточки, язык,
// длина, «на чём сделать акцент»). Ids полей = параметры бэкенда/воркера.
type HbType = 'audio' | 'video' | 'report' | 'quiz' | 'table' | 'infographic' | 'flashcards' | 'mindmap' | 'slides';
interface HbChatMsg { q: string; a: string; ts: number; cites?: number; pending?: boolean }
interface HbSpec { chat: HbChatMsg[]; settings: Partial<Record<HbType, Record<string, string>>>; name?: string }
const HB_DEFAULT: HbSpec = { chat: [], settings: {}, name: '' };

// Лёгкий Markdown-рендерер для ответов чата (**жирный**, списки «- », абзацы) — без внешних либ.
function HbMarkdown({ text }: { text: string }) {
  const inline = (s: string, key: number) => (
    <React.Fragment key={key}>
      {s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**'))
        ? <strong key={i} style={{ color: 'var(--text-primary)' }}>{p.slice(2, -2)}</strong>
        : <React.Fragment key={i}>{p}</React.Fragment>)}
    </React.Fragment>
  );
  const blocks = String(text || '').split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const bullets = lines.filter((l) => /^\s*[-•]\s+/.test(l));
        if (bullets.length && bullets.length === lines.length) {
          return (
            <ul key={bi} style={{ margin: bi ? '6px 0 0' : 0, paddingLeft: 18, listStyle: 'disc' }}>
              {bullets.map((l, li) => <li key={li} style={{ marginBottom: 3 }}>{inline(l.replace(/^\s*[-•]\s+/, ''), li)}</li>)}
            </ul>
          );
        }
        return <p key={bi} style={{ margin: bi ? '6px 0 0' : 0 }}>{lines.map((l, li) => <React.Fragment key={li}>{li ? <br /> : null}{inline(l, li)}</React.Fragment>)}</p>;
      })}
    </>
  );
}

const HB_LANGS: { v: string; label: string }[] = [
  { v: 'ru', label: 'русский' }, { v: 'en', label: 'английский' }, { v: 'uk', label: 'украинский' },
  { v: 'es', label: 'испанский' }, { v: 'de', label: 'немецкий' }, { v: 'fr', label: 'французский' },
  { v: 'it', label: 'итальянский' }, { v: 'pt', label: 'португальский' }, { v: 'pl', label: 'польский' },
  { v: 'tr', label: 'турецкий' }, { v: 'kk', label: 'казахский' }, { v: 'zh', label: 'китайский' },
  { v: 'ja', label: 'японский' }, { v: 'ko', label: 'корейский' }, { v: 'ar', label: 'арабский' }, { v: 'hi', label: 'хинди' },
];

interface HbField { id: string; label: string; kind: 'cards' | 'chips' | 'lang' | 'focus'; opts?: { v: string; label: string; hint?: string }[]; ph?: string }
const HB_FOCUS_PH = 'Вы можете попросить: пересказать определённый источник; осветить конкретную тему; объяснить материал для определённой аудитории…';
const HB_TYPES: { t: HbType; label: string; fields: HbField[] }[] = [
  {
    t: 'audio', label: 'Аудиопересказ', fields: [
      { id: 'format', label: 'Формат', kind: 'cards', opts: [
        { v: 'deep_dive', label: 'Подробный анализ', hint: 'Активная беседа двух ведущих, раскрывающая и связывающая темы из ваших источников.' },
        { v: 'brief', label: 'Краткий пересказ', hint: 'Небольшой обзор, который поможет быстро понять основные идеи источников.' },
        { v: 'critique', label: 'Рецензия', hint: 'Экспертная оценка ваших источников с конструктивными замечаниями, которые помогут улучшить материал.' },
        { v: 'debate', label: 'Дебаты', hint: 'Дискуссия между двумя ведущими, раскрывающая разные мнения о ваших источниках.' },
      ] },
      { id: 'length', label: 'Длина', kind: 'chips', opts: [{ v: 'short', label: 'Маленькая' }, { v: 'default', label: 'По умолчанию' }, { v: 'long', label: 'Длинная' }] },
      { id: 'language', label: 'Выберите язык', kind: 'lang' },
      { id: 'focus', label: 'На чём в этом выпуске должны сделать акцент ИИ-ведущие?', kind: 'focus', ph: HB_FOCUS_PH },
    ],
  },
  {
    t: 'video', label: 'Видеообзор', fields: [
      { id: 'format', label: 'Формат', kind: 'cards', opts: [
        { v: 'explainer', label: 'Объясняющий', hint: 'Подробный видеоролик с рассказчиком, слайдами и иллюстрациями по вашим источникам.' },
        { v: 'brief', label: 'Краткий', hint: 'Короткий видеообзор — только главные идеи источников.' },
        { v: 'cinematic', label: 'Кинематографичный', hint: 'Полностью анимированное видео (Veo). Требует план Google AI Ultra на аккаунте.' },
      ] },
      { id: 'style', label: 'Визуальный стиль', kind: 'chips', opts: [
        { v: 'auto_select', label: 'Авто' }, { v: 'classic', label: 'Классика' }, { v: 'whiteboard', label: 'Маркерная доска' },
        { v: 'watercolor', label: 'Акварель' }, { v: 'paper_craft', label: 'Аппликация' }, { v: 'anime', label: 'Аниме' },
        { v: 'kawaii', label: 'Кавай' }, { v: 'retro_print', label: 'Ретро-печать' }, { v: 'heritage', label: 'Гравюра' },
      ] },
      { id: 'language', label: 'Выберите язык', kind: 'lang' },
      { id: 'focus', label: 'На чём сделать акцент в этом видео?', kind: 'focus', ph: HB_FOCUS_PH },
    ],
  },
  {
    t: 'report', label: 'Отчёт', fields: [
      { id: 'format', label: 'Шаблон', kind: 'cards', opts: [
        { v: 'briefing_doc', label: 'Брифинг-документ', hint: 'Сжатая сводка ключевых фактов и выводов из источников.' },
        { v: 'study_guide', label: 'Учебное пособие', hint: 'Структурированный конспект для изучения материала.' },
        { v: 'blog_post', label: 'Блог-пост', hint: 'Готовая статья по мотивам источников — можно публиковать.' },
        { v: 'custom', label: 'Свой формат', hint: 'Опишите нужный формат в поле «акцент» ниже.' },
      ] },
      { id: 'language', label: 'Выберите язык', kind: 'lang' },
      { id: 'focus', label: 'О чём должен быть отчёт?', kind: 'focus', ph: HB_FOCUS_PH },
    ],
  },
  {
    t: 'quiz', label: 'Тест', fields: [
      { id: 'count', label: 'Количество вопросов', kind: 'chips', opts: [{ v: 'standard', label: 'Стандартно' }, { v: 'fewer', label: 'Поменьше' }] },
      { id: 'difficulty', label: 'Сложность', kind: 'chips', opts: [{ v: 'easy', label: 'Лёгкий' }, { v: 'medium', label: 'Средний' }, { v: 'hard', label: 'Сложный' }] },
      { id: 'language', label: 'Выберите язык', kind: 'lang' },
      { id: 'focus', label: 'По какому материалу составить тест?', kind: 'focus', ph: HB_FOCUS_PH },
    ],
  },
  {
    t: 'table', label: 'Таблица', fields: [
      { id: 'language', label: 'Выберите язык', kind: 'lang' },
      { id: 'focus', label: 'Что свести в таблицу?', kind: 'focus', ph: 'Например: сравнить все упомянутые инструменты по цене и функциям…' },
    ],
  },
  {
    t: 'infographic', label: 'Инфографика', fields: [
      { id: 'orientation', label: 'Ориентация', kind: 'chips', opts: [{ v: 'portrait', label: 'Вертикальная' }, { v: 'landscape', label: 'Горизонтальная' }, { v: 'square', label: 'Квадрат' }] },
      { id: 'detail', label: 'Детализация', kind: 'chips', opts: [{ v: 'standard', label: 'Стандартно' }, { v: 'concise', label: 'Минимум' }, { v: 'detailed', label: 'Максимум' }] },
      { id: 'style', label: 'Стиль', kind: 'chips', opts: [
        { v: 'auto_select', label: 'Авто' }, { v: 'sketch_note', label: 'Скетч' }, { v: 'professional', label: 'Деловой' },
        { v: 'bento_grid', label: 'Bento-сетка' }, { v: 'editorial', label: 'Журнальный' }, { v: 'instructional', label: 'Инструкция' },
        { v: 'bricks', label: 'Кирпичики' }, { v: 'clay', label: 'Пластилин' }, { v: 'anime', label: 'Аниме' }, { v: 'scientific', label: 'Научный' },
      ] },
      { id: 'language', label: 'Выберите язык', kind: 'lang' },
      { id: 'focus', label: 'Что показать на инфографике?', kind: 'focus', ph: HB_FOCUS_PH },
    ],
  },
  {
    t: 'flashcards', label: 'Карточки', fields: [
      { id: 'count', label: 'Количество карточек', kind: 'chips', opts: [{ v: 'standard', label: 'Стандартно' }, { v: 'fewer', label: 'Поменьше' }] },
      { id: 'language', label: 'Выберите язык', kind: 'lang' },
      { id: 'focus', label: 'Что вынести на карточки?', kind: 'focus', ph: HB_FOCUS_PH },
    ],
  },
  {
    t: 'mindmap', label: 'Ментальная карта', fields: [
      { id: 'language', label: 'Выберите язык', kind: 'lang' },
      { id: 'focus', label: 'Вокруг чего строить карту?', kind: 'focus', ph: HB_FOCUS_PH },
    ],
  },
  {
    t: 'slides', label: 'Презентация', fields: [
      { id: 'format', label: 'Формат', kind: 'cards', opts: [
        { v: 'detailed_deck', label: 'Подробные слайды', hint: 'Самодостаточная презентация — можно читать без выступающего.' },
        { v: 'presenter_slides', label: 'Для выступления', hint: 'Лаконичные слайды-опора под живой рассказ.' },
      ] },
      { id: 'length', label: 'Длина', kind: 'chips', opts: [{ v: 'short', label: 'Маленькая' }, { v: 'default', label: 'По умолчанию' }] },
      { id: 'language', label: 'Выберите язык', kind: 'lang' },
      { id: 'focus', label: 'О чём должна быть презентация?', kind: 'focus', ph: HB_FOCUS_PH },
    ],
  },
];
const HB_ICON: Record<HbType, React.ReactNode> = {
  audio: <Mic size={17} />, video: <Film size={17} />, report: <FileText size={17} />,
  quiz: <ListChecks size={17} />, table: <Table size={17} />, infographic: <Image size={17} />,
  flashcards: <Layers size={17} />, mindmap: <Share2 size={17} />, slides: <Presentation size={17} />,
};
const HB_LABEL: Record<HbType, string> = Object.fromEntries(HB_TYPES.map((x) => [x.t, x.label])) as Record<HbType, string>;
/** Дефолтные настройки генерации типа: первый вариант каждого поля, язык — русский. */
function hbDefaults(t: HbType): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of HB_TYPES.find((x) => x.t === t)!.fields) {
    if (f.kind === 'lang') out[f.id] = 'ru';
    else if (f.kind === 'focus') out[f.id] = '';
    else if (f.opts && f.opts.length) out[f.id] = f.opts[0].v;
  }
  // «По умолчанию» — осознанные дефолты (как в NotebookLM), не первый чип.
  if (out.length === 'short') out.length = 'default';
  if (out.detail === 'concise') out.detail = 'standard';
  return out;
}

/** Просмотр JSON-артефактов Hotebook прямо в панели: тест / карточки / менталка / таблица. */
function HbPayloadView({ job }: { job: any }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const raw = job?.payload;
  const data = raw && typeof raw === 'object' && 'data' in raw ? (raw as any).data : raw;
  const toggle = (set: React.Dispatch<React.SetStateAction<Set<number>>>, i: number) =>
    set((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const asArr = (...cands: any[]): any[] | null => { for (const c of cands) if (Array.isArray(c) && c.length) return c; return null; };
  const txt = (o: any, keys: string[]): string => {
    if (o == null) return '';
    if (typeof o === 'string') return o;
    for (const k of keys) if (typeof o?.[k] === 'string' && o[k]) return o[k];
    return '';
  };

  if (job?.type === 'quiz') {
    const qs = asArr(data?.questions, data?.items, data?.quiz, Array.isArray(data) ? data : null);
    if (qs) {
      return (
        <div className="space-y-2">
          {qs.map((q: any, i: number) => {
            const opts = asArr(q?.options, q?.answers, q?.choices) || [];
            const ans = txt(q, ['answer', 'correct_answer', 'correctAnswer', 'explanation'])
              || (typeof q?.answer_index === 'number' && opts[q.answer_index] ? (typeof opts[q.answer_index] === 'string' ? opts[q.answer_index] : txt(opts[q.answer_index], ['text', 'label'])) : '');
            return (
              <div key={i} className="rounded-xl p-2.5" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="text-xs font-700 mb-1" style={{ color: 'var(--text-primary)' }}>{i + 1}. {txt(q, ['question', 'prompt', 'q', 'text']) || '—'}</div>
                {opts.length > 0 && (
                  <ul className="space-y-0.5 mb-1">
                    {opts.map((o: any, j: number) => <li key={j} className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>· {typeof o === 'string' ? o : txt(o, ['text', 'label', 'option'])}</li>)}
                  </ul>
                )}
                <button onClick={() => toggle(setRevealed, i)} className="text-[11px] font-600" style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 0 }}>
                  {revealed.has(i) ? 'Скрыть ответ' : 'Показать ответ'}
                </button>
                {revealed.has(i) && <p className="text-[11px] mt-1" style={{ color: '#10b981', whiteSpace: 'pre-wrap' }}>{ans || JSON.stringify(q?.answer ?? '—')}</p>}
              </div>
            );
          })}
        </div>
      );
    }
  }
  if (job?.type === 'flashcards') {
    const cards = asArr(data?.cards, data?.flashcards, data?.items, Array.isArray(data) ? data : null);
    if (cards) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {cards.map((c: any, i: number) => (
            <button key={i} onClick={() => toggle(setFlipped, i)} className="rounded-xl p-3 text-left"
              style={{ background: flipped.has(i) ? 'rgba(34,211,238,0.10)' : 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', cursor: 'pointer', minHeight: 84 }}>
              <div className="text-[10px] font-700 mb-1" style={{ color: 'var(--text-muted)' }}>{flipped.has(i) ? 'ОТВЕТ' : `КАРТОЧКА ${i + 1} · нажмите`}</div>
              <div className="text-xs" style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {flipped.has(i) ? (txt(c, ['back', 'answer', 'definition', 'a']) || '—') : (txt(c, ['front', 'question', 'term', 'q']) || '—')}
              </div>
            </button>
          ))}
        </div>
      );
    }
  }
  if (job?.type === 'mindmap') {
    const root = data?.root || data?.mindmap || data;
    const renderNode = (n: any, d: number): React.ReactNode => {
      if (!n || typeof n !== 'object' || d > 6) return null;
      const kids = asArr(n?.children, n?.nodes, n?.branches) || [];
      return (
        <div style={{ marginLeft: d === 0 ? 0 : 14, borderLeft: d === 0 ? 'none' : '1.5px solid var(--border-medium)', paddingLeft: d === 0 ? 0 : 10, marginTop: 4 }}>
          <div className="text-xs" style={{ color: d === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: d === 0 ? 700 : 500 }}>
            {txt(n, ['title', 'name', 'label', 'text']) || '—'}
          </div>
          {kids.map((k: any, i: number) => <React.Fragment key={i}>{renderNode(k, d + 1)}</React.Fragment>)}
        </div>
      );
    };
    if (root && typeof root === 'object') return <div>{renderNode(root, 0)}</div>;
  }
  if (job?.type === 'table') {
    const rows = asArr(data?.rows, data?.data, Array.isArray(data) ? data : null);
    const heads = asArr(data?.headers, data?.columns);
    if (rows && typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
      const keys = Object.keys(rows[0] || {});
      return (
        <div style={{ overflowX: 'auto' }}>
          <table className="text-[11px]" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr>{keys.map((k) => <th key={k} className="text-left p-1.5" style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>{k}</th>)}</tr></thead>
            <tbody>{rows.map((r: any, i: number) => <tr key={i}>{keys.map((k) => <td key={k} className="p-1.5" style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>{String(r?.[k] ?? '')}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    if (rows && Array.isArray(rows[0])) {
      return (
        <div style={{ overflowX: 'auto' }}>
          <table className="text-[11px]" style={{ borderCollapse: 'collapse', width: '100%' }}>
            {heads && <thead><tr>{heads.map((h: any, i: number) => <th key={i} className="text-left p-1.5" style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>{typeof h === 'string' ? h : txt(h, ['label', 'title', 'name'])}</th>)}</tr></thead>}
            <tbody>{rows.map((r: any[], i: number) => <tr key={i}>{r.map((c, j) => <td key={j} className="p-1.5" style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}>{String(c ?? '')}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
  }
  return (
    <pre className="text-[10px] p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', maxHeight: 380, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
      {JSON.stringify(data ?? {}, null, 1)}
    </pre>
  );
}

// Пикер «Редактора» повторяет Галерею: те же вкладки-папки (тренды/референс/аудио/из анализа).
type EdCat = 'trends' | 'reference' | 'audio' | 'analyzed';
const ED_TABS: { key: EdCat; label: string; icon: React.ReactNode }[] = [
  { key: 'trends', label: 'Тренды', icon: <Video size={13} /> },
  { key: 'reference', label: 'Референс', icon: <Image size={13} /> },
  { key: 'audio', label: 'Аудио', icon: <Music size={13} /> },
  { key: 'analyzed', label: 'Из анализа', icon: <Sparkles size={13} /> },
];


// ── Преобразование исходного видео по таймлайну (узел Omni Flash) ──
// engine: 'omni' — сгенерировать новый клип (Veo 3.1, 4/6/8с, текст/кадр→видео);
//         'v2v'  — ре-стайл реального фрагмента (Runway Gen-4 / FAL-Kling).
type OmniEngine = 'omni' | 'v2v';
type V2VProvider = 'runway' | 'fal';
// Окно на ленте исходника. Длина = ширина окна (Omni Flash преобразует 10с за проход).
// Левый край окна = первый кадр, правый край = последний кадр для kadr→видео.
interface OmniSeg {
  id: string;
  start: number;          // доля таймлайна 0..1 (левый край / первый кадр)
  end: number;            // доля таймлайна 0..1 (правый край / последний кадр)
  engine: OmniEngine;
  prompt: string;         // «как преобразовать»
  seedFrame: boolean;     // (устар.) — заменён явным startFrame
  startFrame?: string | null; // omni: URL старт-кадра (первый кадр для image_to_video) — #3
  genJobId?: string | null;         // активная задача Omni (возобновляем поллинг после выхода/входа в сценарий)
  genUrl?: string | null;           // готовый клип — превью выживает выход/вход
  genInteractionId?: string | null; // interactionId готового клипа (для чат-правок)
  provider: V2VProvider;  // engine=v2v: чем ре-стайлить
}
interface OmniSpec { segments: OmniSeg[]; }
let omniSeq = 0;
const OMNI_MAX_SEC = 10;  // Omni Flash преобразует 10с за один проход
const newSeg = (start: number, end: number): OmniSeg =>
  ({ id: `seg${++omniSeq}`, start, end, engine: 'omni', prompt: '', seedFrame: true, provider: 'runway' });
const OMNI_DEFAULT: OmniSpec = { segments: [newSeg(0, 0.2)] };
const V2V_LABEL: Record<V2VProvider, string> = { runway: 'Runway Gen-4', fal: 'Kling (FAL)' };

export default function MontageEditor({ flowId, onBack, isNew, initialCloud, soloBlock }: { flowId: string; onBack: () => void; isNew?: boolean; initialCloud?: string | null; soloBlock?: boolean }) {
  const token = useAppStore((s) => s.token);
  const headers = useCallback((): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  const [name, setName] = useState('Сценарий');
  const [brief, setBrief] = useState('');          // сохраняется в graph.brief; UI-кнопки «Сценарий» убраны — фича не читалась бэком (ИИ-режиссёр вырезан в v2.0.0)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [media, setMedia] = useState<{ id: string; fileUrl: string; title: string; kind: string; folder: 'trends' | 'reference' | 'audio' | 'analyzed'; cover?: string }[]>([]);
  const [imgPick, setImgPick] = useState<string | null>(null);   // #3: segId, для которого выбираем старт-кадр из галереи картинок
  const [imgPickQ, setImgPickQ] = useState('');
  const imgUploadRef = useRef<HTMLInputElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [sources, setSources] = useState<{ url: string; name: string; thumb?: string; type: string; assetId?: string }[]>([]);
  const [srcUploading, setSrcUploading] = useState(false);   // загрузка своего видео прямо в пикер источника
  const srcUploadRef = useRef<HTMLInputElement | null>(null);
  const [srcTab, setSrcTab] = useState<'all' | 'analyzed' | 'trend' | 'reference'>('all'); // вкладка-папка пикера источника
  const [srcQuery, setSrcQuery] = useState('');
  const [srcNote, setSrcNote] = useState<string | null>(null); // ошибка загрузки видео в пикере источника
  // Источник (исходное видео): ассет для передачи в облачные блоки (Omni и др.).
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null);
  // Облачные узлы: позиции (%), связи-стрелки, режим связывания, панель.
  const [cloud, setCloud] = useState<Record<CloudId, { x: number; y: number }>>({ omni: { ...CLOUD.omni.def }, plan: { ...CLOUD.plan.def }, editor: { ...CLOUD.editor.def }, ugc: { ...CLOUD.ugc.def }, hotebook: { ...CLOUD.hotebook.def }, flow: { ...CLOUD.flow.def } });
  const [cloudEdges, setCloudEdges] = useState<{ from: string; to: string }[]>([]);
  const [pending, setPending] = useState<{ from: string; x: number; y: number } | null>(null); // тянем стрелку
  const pendingRef = useRef<{ from: string; x: number; y: number } | null>(null);
  const [cloudPanel, setCloudPanel] = useState<CloudId | null>(null);
  // Облако «Редактор»: выбранные видео-клипы, результат склейки, открытый просмотрщик, инлайн-пикер.
  const [editorClips, setEditorClips] = useState<{ url: string; name: string; type?: 'video' | 'audio' }[]>([]);
  const [editorResult, setEditorResult] = useState<{ url: string; name: string; type?: 'video' | 'audio' } | null>(null);
  const [editorView, setEditorView] = useState<{ url: string; name: string; type?: 'video' | 'audio' } | null>(null);
  const [editorPick, setEditorPick] = useState(false);
  const [editorGallery, setEditorGallery] = useState<{ url: string; name: string; cover?: string; type: 'video' | 'audio'; cat: EdCat }[]>([]);
  const [editorGalLoading, setEditorGalLoading] = useState(false);
  const [editorMerging, setEditorMerging] = useState(false);
  const [editorNote, setEditorNote] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<EdCat>('analyzed'); // вкладка пикера (как в Галерее)
  const [editorQuery, setEditorQuery] = useState('');            // поиск в пикере
  const [editorUploading, setEditorUploading] = useState(false); // загрузка «Медиа»/«Аудио» в пикере
  const edMediaInputRef = useRef<HTMLInputElement | null>(null);
  const edAudioInputRef = useRef<HTMLInputElement | null>(null);
  // Omni: спецификация преобразования исходного видео по таймлайну.
  const [omniSpec, setOmniSpec] = useState<OmniSpec>(OMNI_DEFAULT);
  // Omni Flash: генерация/правка видео по каждому сегменту (segId → состояние).
  const [omniGen, setOmniGen] = useState<Record<string, { busy?: boolean; note?: string | null; url?: string | null; interactionId?: string | null; edit?: string; sbBusy?: boolean; fbBusy?: boolean; frames?: string[]; seed?: string | null }>>({});
  const omniPollRef = useRef<Record<string, number>>({});
  // Omni-лента: перетаскивание окна (тело=сдвиг, края=длина) + живой предпросмотр исходника.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const srcVideoRef = useRef<HTMLVideoElement | null>(null);
  const omniDragRef = useRef<null | { id: string; handle: 'move' | 'start' | 'end'; s0: number; e0: number; x0: number }>(null);
  // «Комментатор» (блок Google Flow): состояние в graph.flow.commentator — переживает закрытие
  // панели, поллинг сборки живёт ЗДЕСЬ (не в панели) → крутит кольцо у узла и возобновляется.
  const [flowComm, setFlowComm] = useState<{ audioUrl?: string; audioName?: string; format?: '9:16' | '16:9'; lines?: PodLine[]; buildJobId?: string | null; resultUrl?: string | null }>({});
  const [commBusy, setCommBusy] = useState<null | 'diarize' | 'build'>(null);
  const [commFreshDone, setCommFreshDone] = useState(false); // ролик собрался — зелёная точка у узла
  const commPollRef = useRef<number | null>(null);
  // Компонент жив? Опросы переустанавливают setTimeout ПОСЛЕ await fetch — clearTimeout в cleanup
  // снимает только уже запланированный таймер, и без этого флага цикл «воскресал» после unmount.
  const pollAliveRef = useRef(true);
  // ── Блок «UGC / Аватары»: состояние + обработчики ──
  const [ugc, setUgc] = useState<UgcSpec>(UGC_DEFAULT);
  const [ugcBusy, setUgcBusy] = useState<null | 'dialogue' | 'diarize' | 'render' | 'compose' | 'avatars'>(null);
  const [ugcNote, setUgcNote] = useState<string | null>(null);
  const [ugcPick, setUgcPick] = useState<UgcPickTarget | null>(null);
  const [ugcLineIdx, setUgcLineIdx] = useState<number | null>(null); // реплика, к которой прикрепляем медиа
  const [ugcGallery, setUgcGallery] = useState<{ url: string; name: string; cover?: string; type: 'video' | 'audio' | 'image' }[]>([]);
  const [ugcGalLoading, setUgcGalLoading] = useState(false);
  // Коллекция аватаров (Галерея, папка 'avatars'): null = ещё не грузили, грузим по тапу на «Коллекция».
  const [ugcAvatars, setUgcAvatars] = useState<{ id: string; url: string; name: string }[] | null>(null);
  const [ugcAvLoading, setUgcAvLoading] = useState(false);
  const [ugcAvBrief, setUgcAvBrief] = useState('');
  const [ugcAvNote, setUgcAvNote] = useState<string | null>(null);
  // Фидбэк кнопки «Сохранить» в панели UGC: автосейв делает сохранение «невидимым» — показываем галку.
  const [ugcSavedFlash, setUgcSavedFlash] = useState(false);
  // Аспект готового ролика (из метаданных видео) — плеер под 9:16/16:9, а не пиллар-бокс.
  const [ugcResultAR, setUgcResultAR] = useState(9 / 16);
  // Аватар к удалению из коллекции (свой ConfirmModal вместо браузерного confirm).
  const [ugcDelAvatar, setUgcDelAvatar] = useState<{ id: string; url: string; name: string } | null>(null);
  // Присутствие/подключение единого расширения TrendTraffic (Flow · NotebookLM · HeyGen). Мост вещает
  // одну метку 'tt-flow-ext' для всех сервисов — её же слушают FlowExtPanel и Hotebook.
  const [hgExt, setHgExt] = useState<{ present: boolean | null; connected: boolean }>({ present: null, connected: false });
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const d = ev.data as { source?: string; type?: string; connected?: boolean; ok?: boolean };
      if (!d || d.source !== 'tt-flow-ext') return;
      if (d.type === 'present' || d.type === 'status') setHgExt((s) => ({ ...s, present: true }));
      if (d.type === 'status') setHgExt((s) => ({ ...s, connected: !!d.connected }));
      if (d.type === 'connected') setHgExt({ present: true, connected: !!d.ok });
    };
    window.addEventListener('message', onMsg);
    window.postMessage({ source: 'trendtraffic', type: 'status' }, window.location.origin);
    const t = window.setTimeout(() => setHgExt((s) => (s.present === null ? { ...s, present: false } : s)), 1400);
    return () => { window.removeEventListener('message', onMsg); window.clearTimeout(t); };
  }, []);
  const ugcSaveNow = async () => {
    await save();
    setUgcSavedFlash(true);
    window.setTimeout(() => setUgcSavedFlash(false), 1800);
  };
  const ugcMutate = (fn: (u: UgcSpec) => UgcSpec) => { setUgc((u) => fn(u)); setDirty(true); };
  /** «Выход» из студии: сохранить сценарий + апсертить шаблон (появляется в Галерее → UGC),
   *  один шаблон на ролик (templateId в спеке) — повторный выход обновляет его, а не плодит дубли. */
  const ugcExitWithTemplate = async () => {
    try {
      await save();   // сначала сам сценарий (авто-сейв гарантирован)
      // __flowId — карточка шаблона в Галерее открывает ИМЕННО этот сценарий (продолжить ролик).
      const tplSpec = { ...ugc, buildJobId: null, result: null, results: [], __flowId: flowId };
      const tplName = (name || '').trim() || 'UGC-ролик';
      // Пустой ролик в шаблоны не пишем (чтобы «зашёл-вышел» не плодил мусор); существующий — обновляем всегда.
      const hasContent = !!(ugc.avatarUrl || ugc.photoUrl || ugc.script.length || ugc.clip || ugc.clipImages.length || (ugc.brief || '').trim());
      if (!ugc.templateId && !hasContent) { setCloudPanel(null); return; }
      if (ugc.templateId) {
        // Обновляем существующий шаблон ролика (имя + спека).
        const r = await fetch(`/api/render/ugc/templates/${ugc.templateId}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ name: tplName, spec: tplSpec }) });
        if (r.status === 404) {  // шаблон удалили из Галереи — создаём заново
          const c = await fetch('/api/render/ugc/templates', { method: 'POST', headers: headers(), body: JSON.stringify({ name: tplName, spec: tplSpec }) });
          const cd = await c.json().catch(() => ({}));
          if (c.ok && cd?.id) { setUgc((u) => ({ ...u, templateId: String(cd.id) })); await save(); }
        }
      } else {
        const c = await fetch('/api/render/ugc/templates', { method: 'POST', headers: headers(), body: JSON.stringify({ name: tplName, spec: tplSpec }) });
        const cd = await c.json().catch(() => ({}));
        if (c.ok && cd?.id) {
          // Пишем templateId в спеку и сохраняем сценарий сразу (иначе id потеряется при закрытии).
          const withId = { ...ugc, templateId: String(cd.id) };
          setUgc(withId);
          await fetch(`/api/flows/${flowId}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ name, graph: { nodes: [], edges: [], source: sourceUrl ? { url: sourceUrl, name: sourceName || undefined, assetId: sourceAssetId || undefined } : null, cloud, cloudEdges, omni: omniSpec, editor: { clips: editorClips, result: editorResult }, ugc: withId, hotebook: hb, flow: { commentator: flowComm }, brief } }) });
        }
      }
    } catch { /* мягко: выход не блокируем ошибкой шаблона */ }
    finally { setCloudPanel(null); }
  };
  const ugcScriptSec = () => ugc.script.reduce((s, l) => {
    const st = Number(l.start); const en = Number(l.end);
    return s + (Number.isFinite(st) && Number.isFinite(en) && en > st ? en - st : Math.max(1.5, Math.min(12, (l.text || '').length * 0.06)));
  }, 0);
  // Пикер медиа для UGC (видео/фото/запись/музыка/аватар в коллекцию) из Галереи — как в «Редакторе».
  const openUgcPick = async (target: Exclude<UgcPickTarget, 'lineImage'>) => {
    setUgcPick(target); setUgcGalLoading(true); setUgcGallery([]);
    try {
      const [v, r, an, au] = await Promise.all([
        fetch('/api/trends/videos?downloaded=1&limit=200', { headers: headers() }),
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
        fetch('/api/trends/media?folder=analyzed', { headers: headers() }),
        fetch('/api/trends/media?kind=audio', { headers: headers() }),
      ]);
      const vids = v.ok ? ((await v.json()).videos || []) : [];
      const refs = r.ok ? ((await r.json()).assets || []) : [];
      const analyzed = an.ok ? ((await an.json()).assets || []) : [];
      const audios = au.ok ? ((await au.json()).assets || []) : [];
      const seen = new Set<string>();
      const list: { url: string; name: string; cover?: string; type: 'video' | 'audio' | 'image' }[] = [];
      const push = (url: string, name: string, type: 'video' | 'audio' | 'image', cover?: string) => { if (url && !seen.has(url)) { seen.add(url); list.push({ url, name, cover, type }); } };
      for (const x of vids) if (x.fileUrl) push(x.fileUrl, x.title || x.author || 'видео', 'video', x.coverUrl);
      for (const m of analyzed) if (m.fileUrl) push(m.fileUrl, m.originalName || 'медиа', m.mediaType === 'image' ? 'image' : 'video');
      for (const m of refs) if (m.fileUrl) push(m.fileUrl, m.originalName || 'медиа', m.mediaType === 'image' ? 'image' : 'video');
      for (const m of audios) if (m.fileUrl) push(m.fileUrl, m.originalName || 'аудио', 'audio');
      setUgcGallery(list);
    } catch { setUgcGallery([]); }
    finally { setUgcGalLoading(false); }
  };
  // Длительность видео/аудио по URL (для авто-растяжки медиа в диалоге). 0 при ошибке.
  const probeMediaDuration = (url: string): Promise<number> => new Promise((resolve) => {
    const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
    const done = (d: number) => { v.removeAttribute('src'); v.load?.(); resolve(d); };
    const to = window.setTimeout(() => done(0), 8000);
    v.onloadedmetadata = () => { window.clearTimeout(to); done(Number.isFinite(v.duration) ? v.duration : 0); };
    v.onerror = () => { window.clearTimeout(to); done(0); };
    v.src = url;
  });
  const pickUgcItem = (g: { url: string; name: string; type: 'video' | 'audio' | 'image' }) => {
    if (ugcPick === 'clip') ugcMutate((u) => ({ ...u, clip: { url: g.url, name: g.name } }));
    else if (ugcPick === 'photo') ugcMutate((u) => ({ ...u, photoUrl: g.url, photoName: g.name }));
    else if (ugcPick === 'photoB') ugcMutate((u) => ({ ...u, photoBUrl: g.url, photoBName: g.name }));
    else if (ugcPick === 'avatarVideo') ugcMutate((u) => ({ ...u, avatarVideoUrl: g.url, avatarVideoName: g.name, result: null }));
    else if (ugcPick === 'recording') ugcMutate((u) => (
      // Новая запись → старый разбор (реплики) и готовый ролик больше не относятся к ней: сбрасываем.
      u.recordingUrl === g.url ? { ...u, recordingUrl: g.url, recordingName: g.name }
        : { ...u, recordingUrl: g.url, recordingName: g.name, script: [], result: null }
    ));
    else if (ugcPick === 'music') ugcMutate((u) => ({ ...u, music: { url: g.url, name: g.name, volumePct: 20, durationSec: u.music?.durationSec ?? null } }));
    else if (ugcPick === 'intro') ugcMutate((u) => ({ ...u, intro: { url: g.url, name: g.name } }));
    else if (ugcPick === 'outro') ugcMutate((u) => ({ ...u, outro: { url: g.url, name: g.name } }));
    else if (typeof ugcPick === 'string' && ugcPick.startsWith('layer_')) {
      const fmt = ugcPick.slice('layer_'.length) as UgcSpec['formats'][number];
      ugcMutate((u) => ({ ...u, layers: { ...u.layers, [fmt]: { url: g.url, name: g.name } } }));
    }
    else if (ugcPick === 'avatarAdd') void addUgcAvatar(g.url, g.name);
    else if (ugcPick === 'lineImage') {
      const i = ugcLineIdx;
      if (i != null) {
        ugcMutate((u) => ({ ...u, script: u.script.map((l, j) => (j === i ? { ...l, image: g.url, imageName: g.name } : l)) }));
        // В диалоге: видео по умолчанию показываем ЦЕЛИКОМ (holdSec = его длина) → покажется всё,
        // а последующие реплики автоматически сдвинутся, если оно длиннее реплики.
        if (ugc.dialogueEnabled && g.type === 'video') void probeMediaDuration(g.url).then((dur) => {
          if (dur > 0.5) ugcMutate((u) => ({ ...u, script: u.script.map((l, j) => (j === i ? { ...l, holdSec: Math.round(dur * 10) / 10 } : l)) }));
        });
      }
      setUgcLineIdx(null);
    }
    setUgcPick(null);
  };
  // ── Коллекция аватаров: список/генерация/добавление/удаление (Галерея, папка 'avatars') ──
  const loadUgcAvatars = async (force = false) => {
    if (ugcAvLoading || (ugcAvatars !== null && !force)) return;
    setUgcAvLoading(true); setUgcAvNote(null);
    try {
      const r = await fetch('/api/render/ugc/avatars', { headers: headers() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `Ошибка ${r.status}`);
      setUgcAvatars(Array.isArray(d.avatars) ? d.avatars : []);
    } catch (e: any) { setUgcAvatars([]); setUgcAvNote(e?.message || 'Не удалось загрузить коллекцию аватаров.'); }
    finally { setUgcAvLoading(false); }
  };
  const genUgcAvatars = async () => {
    if (ugcBusy) return;
    setUgcBusy('avatars'); setUgcAvNote(null);
    try {
      const r = await fetch('/api/render/ugc/avatars/generate', { method: 'POST', headers: headers(), body: JSON.stringify({ count: 3, brief: ugcAvBrief.trim() || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `Ошибка ${r.status}`);
      const fresh: { id: string; url: string; name: string }[] = Array.isArray(d.avatars) ? d.avatars : [];
      setUgcAvatars((prev) => [...fresh, ...(prev || [])]);
      setUgcAvNote(d.note || `Готово: +${fresh.length}.`);
    } catch (e: any) { setUgcAvNote(e?.message || 'Не удалось сгенерировать аватары.'); }
    finally { setUgcBusy(null); }
  };
  const addUgcAvatar = async (url: string, name: string) => {
    setUgcAvNote(null);
    try {
      const r = await fetch('/api/render/ugc/avatars/add', { method: 'POST', headers: headers(), body: JSON.stringify({ url, name }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.avatar) throw new Error(d?.error || `Ошибка ${r.status}`);
      setUgcAvatars((prev) => [d.avatar, ...(prev || [])]);
      ugcMutate((u) => ({ ...u, avatarId: d.avatar.id, avatarUrl: d.avatar.url, avatarName: d.avatar.name, avatarProvider: 'gallery' }));
    } catch (e: any) { setUgcAvNote(e?.message || 'Не удалось добавить аватар в коллекцию.'); }
  };
  const pickUgcAvatar = (a: { id: string; url: string; name: string }) =>
    ugcMutate((u) => ({ ...u, avatarId: a.id, avatarUrl: a.url, avatarName: a.name, avatarProvider: 'gallery' }));
  // Крестик на плитке — открывает свой ConfirmModal (не браузерный confirm).
  const askDelUgcAvatar = (a: { id: string; url: string; name: string }, e: React.MouseEvent) => {
    e.stopPropagation(); setUgcDelAvatar(a);
  };
  const doDelUgcAvatar = async (a: { id: string; url: string; name: string }) => {
    setUgcDelAvatar(null);
    try {
      const r = await fetch(`/api/render/ugc/avatars/${encodeURIComponent(a.id)}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error();
      setUgcAvatars((prev) => (prev || []).filter((x) => x.id !== a.id));
      if (ugc.avatarProvider === 'gallery' && ugc.avatarId === a.id) ugcMutate((u) => ({ ...u, avatarId: null, avatarUrl: null, avatarName: null }));
    } catch { setUgcAvNote('Не удалось удалить аватар.'); }
  };
  // Открыли панель UGC на вкладке «Коллекция» — грузим коллекцию аватаров по тапу на узел.
  useEffect(() => {
    if (cloudPanel === 'ugc' && ugc.avatarSource === 'collection') { void loadUgcAvatars(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudPanel, ugc.avatarSource]);
  // ── Сборка UGC: аватар говорит (sr-capture) → склейка с видео + титры → Галерея ──
  const ugcPollRef = useRef<number | null>(null);
  const pollUgcBuild = (jobId: string) => {
    if (ugcPollRef.current) window.clearInterval(ugcPollRef.current);
    setUgcBusy('render');
    ugcPollRef.current = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/render/ugc/build/status?job=${encodeURIComponent(jobId)}`, { headers: headers() });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || `Ошибка ${r.status}`);
        if (d.status === 'done' && (d.fileUrl || (Array.isArray(d.results) && d.results.length))) {
          if (ugcPollRef.current) window.clearInterval(ugcPollRef.current); ugcPollRef.current = null;
          setUgcBusy(null);
          const results: { url: string; name: string }[] = Array.isArray(d.results) && d.results.length ? d.results : (d.fileUrl ? [{ url: d.fileUrl, name: 'ролик' }] : []);
          ugcMutate((u) => ({ ...u, buildJobId: null, result: results[0] || null, results }));
          setUgcNote(results.length > 1 ? `Готово! ${results.length} роликов в Галерее.` : 'Готово! Ролик сохранён в Галерею.');
        } else if (d.status === 'failed') {
          if (ugcPollRef.current) window.clearInterval(ugcPollRef.current); ugcPollRef.current = null;
          setUgcBusy(null);
          ugcMutate((u) => ({ ...u, buildJobId: null }));
          setUgcNote(`Сборка не удалась: ${d.error || 'неизвестная ошибка'}`);
        } else {
          setUgcNote(`Сборка: ${d.status}…`);
        }
      } catch (e: any) {
        if (ugcPollRef.current) window.clearInterval(ugcPollRef.current); ugcPollRef.current = null;
        setUgcBusy(null);
        ugcMutate((u) => ({ ...u, buildJobId: null }));
        setUgcNote(e?.message || 'Потеряна связь со сборкой.');
      }
    }, 3000);
  };
  const ugcBuildStart = async () => {
    if (ugcBusy) return;
    // «Без аватара — озвучка»: аватар/фото не нужны — только базовое видео и голос (текст/запись).
    const useVoiceover = !!ugc.noAvatar;
    // «Готовое видео-аватар»: свой ролик с говорящим человеком — HeyGen/голос не нужны (речь уже внутри).
    const useVideo = !useVoiceover && ugc.avatarSource === 'video';
    const useDialogue = !useVoiceover && ugc.avatarSource === 'photo' && ugc.dialogueEnabled;
    if (useVoiceover) {
      if (!ugc.clip && !ugc.clipImages.length) { setUgcNote('Выберите базовое видео или фото (шаг «Видеоряд») — в этом режиме они основа кадра.'); return; }
    } else if (useVideo) {
      if (!ugc.avatarVideoUrl) { setUgcNote('Загрузите готовое видео-аватар (вкладка «Готовое видео»).'); return; }
    } else if (useDialogue) {
      // Диалог: два фото + разбор записи двух голосов.
      if (!ugc.photoUrl || !ugc.photoBUrl) { setUgcNote('Для диалога загрузите два фото: «Спикер A» и «Спикер B».'); return; }
      if (!(ugc.source === 'diarize' && ugc.recordingUrl)) { setUgcNote('Для диалога разберите запись двух голосов (вкладка «Разобрать запись»).'); return; }
      if (!ugc.script.some((l) => l.text.trim())) { setUgcNote('Сначала разберите запись — реплик нет.'); return; }
    } else if (ugc.avatarSource === 'photo') {
      if (!ugc.photoUrl) { setUgcNote('Загрузите своё фото (портрет анфас) во вкладке «Своё фото».'); return; }
    } else if (!ugc.avatarId) {
      setUgcNote('Выберите аватара из коллекции или загрузите своё фото (вкладка «Своё фото»).'); return;
    }
    if (!useDialogue && !useVideo) {
      const hasVoice = (ugc.source === 'diarize' && ugc.recordingUrl) || ugc.script.some((l) => l.text.trim());
      if (!hasVoice) { setUgcNote('Нужен голос: разберите запись или сгенерируйте текст.'); return; }
    }
    const useRetention = !useVoiceover && !useDialogue && ugc.avatarSource === 'photo' && ugc.retentionPreset !== 'off';
    // «Использовать анализ»: снимок ДНК тренда для серверной режиссуры (Монтаж).
    // Скрипт/видео/титры анализ влияет ещё НА ЭТАПЕ настройки (генерация текста,
    // подстановка видео, wishes) — сюда едет только то, что решает сервер.
    const analysisForBuild = ugc.analysis && ugc.analysisUse.retention
      ? { use: ugc.analysisUse, brief: ugc.analysis.brief, hookAnalysis: ugc.analysis.hookAnalysis }
      : undefined;
    // Диалог → spec.dialogue; удержание → spec.retention (+ B-roll для батча); иначе обычная сборка.
    const spec = useDialogue
      ? { ...ugc, analysis: analysisForBuild, dialogue: { enabled: true, engagement: ugc.dialogueEngagement, cutout: ugc.dialogueCutout, photoA: ugc.photoUrl, photoB: ugc.photoBUrl } }
      : useRetention
        ? { ...ugc, analysis: analysisForBuild, retention: { preset: ugc.retentionPreset, brolls: ugc.retentionBrolls } }
        : { ...ugc, analysis: analysisForBuild };
    setUgcBusy('render'); setUgcNote(useDialogue ? 'Запускаю диалог (два аватара)…' : useRetention && ugc.retentionBrolls.length > 1 ? `Запускаю батч (${ugc.retentionBrolls.length} роликов)…` : 'Запускаю сборку…');
    try {
      const r = await fetch('/api/render/ugc/build', { method: 'POST', headers: headers(), body: JSON.stringify({ spec }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.jobId) throw new Error(d?.error || `Ошибка ${r.status}`);
      ugcMutate((u) => ({ ...u, buildJobId: d.jobId, result: null }));
      pollUgcBuild(d.jobId);
    } catch (e: any) { setUgcBusy(null); setUgcNote(e?.message || 'Не удалось запустить сборку.'); }
  };
  // Возобновление поллинга после перезахода в сценарий (сборка идёт на сервере).
  useEffect(() => {
    if (!loading && cloudPanel === 'ugc' && ugc.buildJobId && !ugc.result && !ugcPollRef.current) pollUgcBuild(ugc.buildJobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, cloudPanel, ugc.buildJobId]);
  useEffect(() => () => { if (ugcPollRef.current) window.clearInterval(ugcPollRef.current); }, []);
  // Скрипт аватара: генерация текста (переиспользуем /podcast/dialogue) → реплики одного спикера.
  // Галочка «Использовать анализ» (блок «Голос и текст»): в бриф подмешивается ДНК тренда —
  // формула успеха + готовый черновик озвучки из разбора, Claude пишет «по мотивам».
  const ugcGenScript = async () => {
    if (ugcBusy) return;
    setUgcBusy('dialogue'); setUgcNote(null);
    const dnaBrief = ugc.analysis && ugc.analysisUse.script
      ? [
        ugc.brief.trim(),
        '— Разбор вирусного тренда (следуй его формуле успеха): —',
        ugc.analysis.brief || '',
        ugc.analysis.copyReadyScript ? `Возьми за основу готовый скрипт тренда (перепиши под нас, не копируй дословно): «${ugc.analysis.copyReadyScript}»` : '',
      ].filter(Boolean).join('\n')
      : ugc.brief;
    try {
      const res = await fetch('/api/render/podcast/dialogue', { method: 'POST', headers: headers(), body: JSON.stringify({ brief: dnaBrief, turns: 6 }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Ошибка ${res.status}`);
      const lines: PodLine[] = Array.isArray(d.lines) ? d.lines.map((l: any) => ({ speaker: 'A' as const, text: String(l.text || '') })).filter((l: PodLine) => l.text.trim()) : [];
      ugcMutate((u) => ({ ...u, script: lines }));
      setUgcNote(d.note || `Готово: ${lines.length} реплик.`);
    } catch (e: any) { setUgcNote(e?.message || 'Не удалось сгенерировать текст.'); }
    finally { setUgcBusy(null); }
  };
  // Разбор записи → реплики (переиспользуем /podcast/diarize). В режиме «Диалоги» СОХРАНЯЕМ
  // спикеров A/B (два собеседника); иначе (1 аватар) схлопываем всё в спикера A.
  const ugcRunDiarize = async () => {
    if (ugcBusy || !ugc.recordingUrl) return;
    setUgcBusy('diarize'); setUgcNote(null);
    try {
      const res = await fetch('/api/render/podcast/diarize', { method: 'POST', headers: headers(), body: JSON.stringify({ recordingUrl: ugc.recordingUrl, hostAVoice: ugc.voice }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Ошибка ${res.status}`);
      const keepAB = ugc.dialogueEnabled;
      const lines: PodLine[] = Array.isArray(d.lines) ? d.lines.map((l: any) => ({ speaker: (keepAB && l.speaker === 'B' ? 'B' : 'A') as 'A' | 'B', text: String(l.text || ''), start: Number(l.start), end: Number(l.end) })).filter((l: PodLine) => l.text.trim()) : [];
      const speakers = new Set(lines.map((l) => l.speaker));
      ugcMutate((u) => ({ ...u, script: lines }));
      setUgcNote(d.note || `Разобрано: ${lines.length} реплик${keepAB && speakers.size > 1 ? ' (два голоса A/B)' : ''}.`);
    } catch (e: any) { setUgcNote(e?.message || 'Не удалось разобрать запись.'); }
    finally { setUgcBusy(null); }
  };
  const [nameEdit, setNameEdit] = useState(false); // инлайн-редактирование имени сценария
  // ── Блок «Hotebook» (NotebookLM): состояние панели ──
  const [hb, setHb] = useState<HbSpec>(HB_DEFAULT);
  const hbMutate = (fn: (h: HbSpec) => HbSpec) => { setHb((h) => fn(h)); setDirty(true); };
  const [hbStatus, setHbStatus] = useState<any>(null);              // статус подключения Google (плашка)
  const [hbSources, setHbSources] = useState<any[]>([]);
  const [hbJobs, setHbJobs] = useState<any[]>([]);
  const [hbCounters, setHbCounters] = useState<Record<string, number>>({});
  const [hbArtifactCounts, setHbArtifactCounts] = useState<Record<string, number>>({}); // готово за всё время по типам
  const [hbLoading, setHbLoading] = useState(false);
  const [hbNote, setHbNote] = useState<string | null>(null);
  const [hbOk, setHbOk] = useState<string | null>(null);           // зелёный фидбэк «источник добавлен»
  const [hbFreshDone, setHbFreshDone] = useState(false);            // готовый артефакт → зелёная точка на узле
  const [hbSrcUrl, setHbSrcUrl] = useState('');
  const [hbSrcBusy, setHbSrcBusy] = useState(false);
  const [hbTextOpen, setHbTextOpen] = useState(false);
  const [hbSrcText, setHbSrcText] = useState('');
  const [hbPickOpen, setHbPickOpen] = useState(false);              // пикер файла-источника из Галереи
  const [hbGallery, setHbGallery] = useState<{ id: string; name: string; type: string; cat: EdCat; url: string; cover?: string }[]>([]);
  const [hbPickedIds, setHbPickedIds] = useState<Set<string>>(new Set()); // добавленные из пикера (✓ на превью)
  const [hbGalLoading, setHbGalLoading] = useState(false);
  const [hbPickTab, setHbPickTab] = useState<EdCat>('analyzed');    // вкладка пикера (как в Галерее/Редакторе)
  const [hbPickQuery, setHbPickQuery] = useState('');               // поиск в пикере
  const [hbChatQ, setHbChatQ] = useState('');
  const [hbChatBusy, setHbChatBusy] = useState(false);
  const [hbSuggestions, setHbSuggestions] = useState<string[]>([]); // подсказки-чипы (из NotebookLM)
  const [hbGenOpen, setHbGenOpen] = useState<HbType | null>(null);  // модалка настроек генерации
  const [hbGenSet, setHbGenSet] = useState<Record<string, string>>({});
  const [hbGenBusy, setHbGenBusy] = useState(false);
  const [hbView, setHbView] = useState<any | null>(null);           // просмотр артефакта (тест/карточки/менталка/таблица)
  const [hbPlayId, setHbPlayId] = useState<string | null>(null);    // раскрытый инлайн-плеер аудио/видео артефакта
  const hbPollingRef = useRef(false);
  const hbJobsRef = useRef<any[]>([]);
  useEffect(() => { hbJobsRef.current = hbJobs; }, [hbJobs]);
  const hbActive = hbJobs.some((j) => j.status === 'queued' || j.status === 'running');
  const hbBusyAny = hbActive || hbChatBusy || hbSrcBusy || hbGenBusy;
  const [srcDuration, setSrcDuration] = useState<number>(0); // длительность исходника (Omni-лента)
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<CloudId | null>(null);
  const movedRef = useRef(false);

  // Deep-link из Галереи (/flow?open=…): авто-открыть облако-блок после загрузки графа.
  const initialCloudDone = useRef(false);
  useEffect(() => {
    if (loading || !initialCloud || initialCloudDone.current) return;
    if (!(['omni', 'plan', 'editor', 'ugc', 'hotebook', 'flow'] as string[]).includes(initialCloud)) return;
    initialCloudDone.current = true;
    if (initialCloud === 'hotebook') setHbFreshDone(false);
    if (initialCloud === 'flow') setCommFreshDone(false);
    setCloudPanel(initialCloud as CloudId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialCloud]);

  // СОЛО-РЕЖИМ (блок открыт оверлеем из Галереи/просмотрщика): показываем ТОЛЬКО панель
  // блока — без верхней панели и холста-паутины. Закрытие панели (× / клик по фону /
  // «Выход» студии) закрывает весь оверлей и возвращает туда, откуда пришли.
  const soloOpenedRef = useRef(false);
  useEffect(() => {
    if (!soloBlock || loading) return;
    if (cloudPanel) { soloOpenedRef.current = true; return; }
    if (soloOpenedRef.current) onBack(); // панель была открыта и закрылась → выходим
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloBlock, cloudPanel, loading]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/flows/${flowId}`, { headers: headers() });
        const d = await res.json();
        if (res.ok && d.flow) {
          setName(d.flow.name || 'Сценарий');
          if (typeof d.flow.graph?.brief === 'string') setBrief(d.flow.graph.brief);
          const src = d.flow.graph?.source;
          if (src && typeof src.url === 'string') {
            setSourceUrl(src.url); setSourceName(src.name || 'видео');
            if (typeof src.assetId === 'string' && src.assetId) setSourceAssetId(src.assetId);
          }
          if (d.flow.graph?.cloud && typeof d.flow.graph.cloud === 'object') setCloud((c) => ({ ...c, ...d.flow.graph.cloud }));
          if (Array.isArray(d.flow.graph?.cloudEdges)) {
            // Облако «Подкаст» убрано — старые связи с ним не рисуем и не копим.
            setCloudEdges(d.flow.graph.cloudEdges.filter((e: any) => e?.from !== 'podcast' && e?.to !== 'podcast'));
          }
          if (d.flow.graph?.omni && typeof d.flow.graph.omni === 'object') {
            const raw = Array.isArray(d.flow.graph.omni.segments) ? d.flow.graph.omni.segments : [];
            // Нормализуем старые сохранённые сегменты (могли нести legacy lenSec/mode или битые доли).
            const clamp01 = (v: unknown, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fb);
            const norm: OmniSeg[] = raw.map((x: any) => {
              const st = clamp01(x?.start, 0);
              const en = Math.max(st + 0.01, clamp01(x?.end, Math.min(1, st + 0.2)));
              return {
                id: typeof x?.id === 'string' ? x.id : `seg${++omniSeq}`,
                start: st, end: en,
                engine: x?.engine === 'v2v' ? 'v2v' : 'omni',
                prompt: typeof x?.prompt === 'string' ? x.prompt : '',
                seedFrame: x?.seedFrame !== false,
                startFrame: typeof x?.startFrame === 'string' ? x.startFrame : null,
                genJobId: typeof x?.genJobId === 'string' ? x.genJobId : null,
                genUrl: typeof x?.genUrl === 'string' ? x.genUrl : null,
                genInteractionId: typeof x?.genInteractionId === 'string' ? x.genInteractionId : null,
                provider: x?.provider === 'fal' ? 'fal' : 'runway',
              };
            });
            setOmniSpec({ segments: norm.length ? norm : [newSeg(0, 0.2)] });
            // Гидрация Omni: вернуть превью готовых клипов и ВОЗОБНОВИТЬ поллинг активных задач (фон переживает выход/вход).
            for (const sg of norm) {
              if (sg.genUrl) setOG(sg.id, { url: sg.genUrl, interactionId: sg.genInteractionId || null, note: 'Готово · в Галерее' });
              else if (sg.genJobId) { setOG(sg.id, { busy: true, note: 'Возобновляю…' }); pollOmni(sg.id, sg.genJobId); }
            }
          }
          if (d.flow.graph?.editor && typeof d.flow.graph.editor === 'object') {
            const ed = d.flow.graph.editor;
            if (Array.isArray(ed.clips)) setEditorClips(ed.clips.filter((c: any) => c && typeof c.url === 'string').map((c: any) => ({ url: c.url, name: c.name || 'видео', type: c.type === 'audio' ? 'audio' : 'video' })));
            if (ed.result && typeof ed.result.url === 'string') setEditorResult({ url: ed.result.url, name: ed.result.name || 'Результат', type: ed.result.type === 'audio' ? 'audio' : 'video' });
          }
          if (d.flow.graph?.ugc && typeof d.flow.graph.ugc === 'object') {
            const uu = d.flow.graph.ugc;
            setUgc({
              ...UGC_DEFAULT, ...uu,
              // Старое сохранённое 'spatialreal' не воскрешаем — провайдер теперь только 'gallery'.
              avatarProvider: 'gallery',
              script: Array.isArray(uu.script) ? uu.script : [],
              subtitles: { ...UGC_DEFAULT.subtitles, ...(uu.subtitles || {}) },
              clipImages: Array.isArray(uu.clipImages) ? uu.clipImages.filter((x: any) => x && typeof x.url === 'string') : [],
              analysisUse: { ...UGC_DEFAULT.analysisUse, ...(uu.analysisUse || {}) },
              // Кастомные позиции аватара-оверлея (драг на превью) — старые сценарии их не имеют.
              avatarRects: uu.avatarRects && typeof uu.avatarRects === 'object' ? uu.avatarRects : {},
            });
          }
          if (d.flow.graph?.hotebook && typeof d.flow.graph.hotebook === 'object') {
            const hh = d.flow.graph.hotebook;
            setHb({
              chat: Array.isArray(hh.chat) ? hh.chat.filter((m: any) => m && typeof m.q === 'string' && !m.pending) : [],
              settings: hh.settings && typeof hh.settings === 'object' ? hh.settings : {},
              name: typeof hh.name === 'string' ? hh.name : '',
            });
          }
          if (d.flow.graph?.flow?.commentator && typeof d.flow.graph.flow.commentator === 'object') {
            const fc = d.flow.graph.flow.commentator;
            setFlowComm({
              audioUrl: typeof fc.audioUrl === 'string' ? fc.audioUrl : undefined,
              audioName: typeof fc.audioName === 'string' ? fc.audioName : undefined,
              format: fc.format === '16:9' ? '16:9' : '9:16',
              lines: Array.isArray(fc.lines) ? fc.lines : [],
              buildJobId: fc.buildJobId || null,
              resultUrl: fc.resultUrl || null,
            });
          }
        }
      } catch { /* пусто */ }
      finally { setLoading(false); }
    })();
  }, [flowId, headers]);

  const save = async () => {
    setSaving(true);
    try {
      const source = sourceUrl ? { url: sourceUrl, name: sourceName || undefined, assetId: sourceAssetId || undefined } : null;
      await fetch(`/api/flows/${flowId}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ name, graph: { nodes: [], edges: [], source, cloud, cloudEdges, omni: omniSpec, editor: { clips: editorClips, result: editorResult }, ugc, hotebook: hb, flow: { commentator: flowComm }, brief } }) });
      setDirty(false);
    } catch { /* */ }
    finally { setSaving(false); }
  };
  // Авто-сохранение: любые правки сохраняются сами через ~1.6с —
  // выйдешь и вернёшься в сценарий → всё на месте. Ничего не теряется без кнопки «Сохранить».
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    if (!dirty || loading) return;
    const t = window.setTimeout(() => { void saveRef.current(); }, 1600);
    return () => clearTimeout(t);
  }, [dirty, loading]);

  // ── Undo/Redo: история снимков редактируемого «документа» ──────────────────────
  const histRef = useRef<{ stack: string[]; idx: number }>({ stack: [], idx: -1 });
  const restoringRef = useRef(false);
  const [, setHistTick] = useState(0);
  const docSnap = useCallback((): string => JSON.stringify({
    name, brief,
    // volatile gen-поля (genJobId/genUrl/genInteractionId) НЕ в undo-историю: их пишет фоновый поллинг, а не юзер.
    omniSpec: { segments: omniSpec.segments.map(({ genJobId, genUrl, genInteractionId, ...s }) => s) },
    // UGC-спека в истории БЕЗ одноразовых полей прогона (их пишет поллинг сборки, не юзер).
    ugc: { ...ugc, buildJobId: null, result: null, results: [] },
    cloud, cloudEdges, sourceUrl, sourceName, sourceAssetId,
  }), [name, brief, omniSpec, ugc, cloud, cloudEdges, sourceUrl, sourceName, sourceAssetId]);
  const applyDoc = (s: string) => {
    let d: any; try { d = JSON.parse(s); } catch { return; }
    restoringRef.current = true;
    setName(d.name); setBrief(d.brief);
    // omniSpec в истории без gen-полей → возвращаем их из ТЕКУЩЕГО состояния по id (не теряем активную задачу/превью).
    setOmniSpec((cur) => {
      const genById = new Map(cur.segments.map((sg) => [sg.id, { genJobId: sg.genJobId ?? null, genUrl: sg.genUrl ?? null, genInteractionId: sg.genInteractionId ?? null }]));
      const segs: OmniSeg[] = Array.isArray(d.omniSpec?.segments)
        ? d.omniSpec.segments.map((sg: any) => ({ ...sg, ...(genById.get(sg.id) || {}) }))
        : cur.segments;
      return { segments: segs };
    });
    // UGC: возвращаем спеку из истории, но volatile-поля прогона берём из ТЕКУЩЕГО состояния
    // (не теряем идущую сборку/готовый результат при undo/redo).
    if (d.ugc && typeof d.ugc === 'object') {
      setUgc((cur) => ({ ...cur, ...d.ugc, buildJobId: cur.buildJobId, result: cur.result, results: cur.results }));
    }
    setCloud(d.cloud); setCloudEdges(d.cloudEdges);
    setSourceUrl(d.sourceUrl); setSourceName(d.sourceName); setSourceAssetId(d.sourceAssetId);
    setDirty(true);
  };
  // захват снимка при изменениях (дебаунс; пропускаем, если это восстановление undo/redo).
  useEffect(() => {
    if (restoringRef.current) { restoringRef.current = false; return; }
    const h = setTimeout(() => {
      const snap = docSnap();
      const st = histRef.current;
      if (st.stack[st.idx] === snap) return;
      st.stack = st.stack.slice(0, st.idx + 1);
      st.stack.push(snap);
      if (st.stack.length > 120) st.stack.shift();
      st.idx = st.stack.length - 1;
      setHistTick((t) => t + 1);
    }, 350);
    return () => clearTimeout(h);
  }, [docSnap]);
  const undo = () => { const st = histRef.current; if (st.idx > 0) { st.idx -= 1; applyDoc(st.stack[st.idx]); setHistTick((t) => t + 1); } };
  const redo = () => { const st = histRef.current; if (st.idx < st.stack.length - 1) { st.idx += 1; applyDoc(st.stack[st.idx]); setHistTick((t) => t + 1); } };
  const canUndo = histRef.current.idx > 0;
  const canRedo = histRef.current.idx < histRef.current.stack.length - 1;
  // Ctrl/Cmd+Z — назад, Ctrl/Cmd+Shift+Z — вперёд (не мешаем, когда курсор в поле ввода).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Omni: редактирование спецификации преобразования ──
  const omniMutate = (fn: (s: OmniSpec) => OmniSpec) => { setOmniSpec((s) => fn(s)); setDirty(true); };
  // ── Omni Flash: генерация видео (Gemini Interactions API) ──
  const setOG = (id: string, patch: Partial<{ busy: boolean; note: string | null; url: string | null; interactionId: string | null; edit: string; sbBusy: boolean; fbBusy: boolean; frames: string[]; seed: string | null }>) =>
    setOmniGen((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  /** Раскадровка через Nano Banana 2 Lite — дешёвые кадры ДО дорогой видео-генерации. */
  const runStoryboard = async (g: OmniSeg) => {
    if (omniGen[g.id]?.sbBusy) return;
    if (!g.prompt.trim()) { setOG(g.id, { note: 'Впишите промт для раскадровки.' }); return; }
    setOG(g.id, { sbBusy: true, note: null });
    try {
      const res = await fetch('/api/render/omni/storyboard', { method: 'POST', headers: headers(), body: JSON.stringify({ prompt: g.prompt, count: 3 }) });
      const d = await res.json();
      if (!res.ok || !Array.isArray(d.frames) || !d.frames.length) { setOG(g.id, { sbBusy: false, note: d?.error || 'Не удалось сделать раскадровку.' }); return; }
      setOG(g.id, { sbBusy: false, frames: d.frames.map((f: any) => f.url), note: d.note });
    } catch { setOG(g.id, { sbBusy: false, note: 'Ошибка сети при раскадровке.' }); }
  };
  /** Понятное объяснение ошибок Omni/Nano — частый кейс это фильтр контента Gemini (400 Input blocked). */
  const friendlyOmniError = (raw?: string | null): string => {
    const s = (raw || '').toLowerCase();
    if (/input blocked|prohibited|could not be processed|not be processed|safety|content polic|deepfake|blocked/.test(s)) {
      return '⚠️ Gemini заблокировал запрос (фильтр контента). Чаще всего дело в «жёстком» промте (взрыв/насилие/оружие) или запрещённой теме — реже в связке «реальный человек + такое действие». Смягчите формулировку (напр. «бутылка эффектно раскрывается брызгами»); один реальный кадр-лицо сам по себе обычно проходит.';
    }
    return raw || 'Не удалось сгенерировать.';
  };
  const pollOmni = (id: string, jobId: string) => {
    const tick = async () => {
      try {
        const res = await fetch('/api/render/omni/status?jobId=' + jobId, { headers: headers() });
        if (res.status === 404) {  // задача пропала (сервер перезапустился) → мягко; готовый клип мог сохраниться в Галерею
          setOG(id, { busy: false, note: 'Прошлая генерация не найдена (сервер мог перезапуститься). Готовый клип ищите в Галерее.' });
          updateSeg(id, { genJobId: null });
          return;
        }
        const d = await res.json();
        if (res.ok && d.status && d.status !== 'processing') {
          if (d.status === 'done' && d.fileUrl) {
            setOG(id, { busy: false, url: d.fileUrl, interactionId: d.interactionId, note: `Готово${d.costUsd ? ` · ~$${d.costUsd}` : ''}${d.seconds ? ` · ${d.seconds}с` : ''} · в Галерее` });
            updateSeg(id, { genJobId: null, genUrl: d.fileUrl, genInteractionId: d.interactionId || null });  // результат → переживёт выход/вход
          } else {
            setOG(id, { busy: false, note: friendlyOmniError(d.error) });
            updateSeg(id, { genJobId: null });
          }
          return;
        }
      } catch { /* ретрай */ }
      omniPollRef.current[id] = window.setTimeout(tick, 6000);
    };
    tick();
  };
  const runOmniGen = async (g: OmniSeg) => {
    if (omniGen[g.id]?.busy) return;
    if (!g.prompt.trim()) { setOG(g.id, { note: 'Впишите промт «как сгенерировать».' }); return; }
    if (omniPollRef.current[g.id]) clearTimeout(omniPollRef.current[g.id]);
    setOG(g.id, { busy: true, note: null, url: null, interactionId: null });
    try {
      let seed = g.startFrame || omniGen[g.id]?.seed || undefined; // старт-кадр (#3) / кадр раскадровки
      // КОНТЕКСТ ВИДЕО: старт-кадр не задан вручную → берём кадр из ВЫДЕЛЕННОГО фрагмента (позиция окна).
      // Omni оживит реальный кадр сцены по промту (сохранит контекст), а не сгенерит клип с нуля.
      if (!seed && g.engine === 'omni' && sourceUrl && srcDuration > 0) {
        setOG(g.id, { note: `Беру кадр ${(g.start * srcDuration).toFixed(1)}с из выделенного фрагмента как контекст…` });
        try {
          const fr = await fetch('/api/render/omni/frame', { method: 'POST', headers: headers(), body: JSON.stringify({ videoUrl: sourceUrl, timeSec: g.start * srcDuration }) });
          const fd = await fr.json();
          if (fr.ok && fd.url) seed = fd.url;
        } catch { /* кадр не вышел — уйдём в текст→видео */ }
      }
      const res = await fetch('/api/render/omni/generate', { method: 'POST', headers: headers(), body: JSON.stringify({ prompt: g.prompt, aspect: '9:16', imageUrl: seed }) });
      const d = await res.json();
      if (!res.ok || !d.jobId) { setOG(g.id, { busy: false, note: d?.error ? friendlyOmniError(d.error) : 'Omni Flash недоступен.' }); return; }
      setOG(g.id, { note: d.note });
      updateSeg(g.id, { genJobId: d.jobId, genUrl: null, genInteractionId: null });  // активная задача → переживёт выход/вход
      pollOmni(g.id, d.jobId);
    } catch { setOG(g.id, { busy: false, note: 'Ошибка сети при генерации.' }); }
  };
  const runOmniEdit = async (g: OmniSeg) => {
    const st = omniGen[g.id]; if (!st?.interactionId || st.busy) return;
    const editPrompt = (st.edit || '').trim(); if (!editPrompt) return;
    if (omniPollRef.current[g.id]) clearTimeout(omniPollRef.current[g.id]);
    setOG(g.id, { busy: true, note: null });
    try {
      const res = await fetch('/api/render/omni/edit', { method: 'POST', headers: headers(), body: JSON.stringify({ previousInteractionId: st.interactionId, prompt: editPrompt, aspect: '9:16' }) });
      const d = await res.json();
      if (!res.ok || !d.jobId) { setOG(g.id, { busy: false, note: d?.error ? friendlyOmniError(d.error) : 'Ошибка правки.' }); return; }
      setOG(g.id, { note: d.note, edit: '' });
      updateSeg(g.id, { genJobId: d.jobId, genUrl: null, genInteractionId: null });  // правка = новая задача; старый результат сбрасываем, иначе гидрация не возобновит её
      pollOmni(g.id, d.jobId);
    } catch { setOG(g.id, { busy: false, note: 'Ошибка сети при правке.' }); }
  };
  const updateSeg = (id: string, patch: Partial<OmniSeg>) =>
    omniMutate((s) => ({ ...s, segments: s.segments.map((g) => g.id === id ? { ...g, ...patch } : g) }));
  const addSegment = (startFrame?: string | null): string | null => {
    const s = omniSpec;                                                   // committed состояние на момент клика
    if (s.segments.length >= 6) return null;
    const maxEnd = s.segments.reduce((m, x) => Math.max(m, x.end), 0);    // правый край самого правого окна
    const gap = s.segments.length ? 0.01 : 0;
    const free = 1 - (maxEnd + gap);                                      // свободный хвост справа
    const minW = srcDuration > 0 ? Math.min(0.5, srcDuration) / srcDuration : 0.03;
    if (free < minW) return null;                                         // места нет — окно не добавляем
    const w = Math.min(free, srcDuration > 0 ? Math.min(0.2, OMNI_MAX_SEC / srcDuration) : 0.2);
    const start = s.segments.length ? maxEnd + gap : 0;
    const seg: OmniSeg = { ...newSeg(start, Math.min(1, start + w)), startFrame: startFrame ?? null };
    omniMutate((prev) => ({ ...prev, segments: [...prev.segments, seg] }));  // чистый append, id известен синхронно
    return seg.id;
  };
  // ── #3 Старт-кадр (кадр из видео / загрузка / промт+картинка) + #4 продолжение по последнему кадру ──
  const runExtractFrame = async (g: OmniSeg) => {
    if (!sourceUrl) { setOG(g.id, { note: 'Сначала выберите исходное видео.' }); return; }
    if (omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy) return;
    setOG(g.id, { fbBusy: true, note: null });
    try {
      const timeSec = srcDuration > 0 ? g.start * srcDuration : 0;
      const res = await fetch('/api/render/omni/frame', { method: 'POST', headers: headers(), body: JSON.stringify({ videoUrl: sourceUrl, timeSec }) });
      const d = await res.json();
      if (!res.ok || !d.url) { setOG(g.id, { fbBusy: false, note: d?.error || 'Не удалось взять кадр.' }); return; }
      updateSeg(g.id, { startFrame: d.url });
      setOG(g.id, { fbBusy: false, note: 'Старт-кадр взят из видео (в Галерее).' });
    } catch { setOG(g.id, { fbBusy: false, note: 'Ошибка сети при извлечении кадра.' }); }
  };
  // #3 «Загрузить»: открыть галерею СВОИХ картинок для этого окна — выбрать существующую ИЛИ загрузить новую.
  const openStartFramePicker = (segId: string) => { setImgPick(segId); setImgPickQ(''); void loadMedia(); };
  const uploadStartFrame = async (segId: string, files: FileList | null): Promise<boolean> => {
    const f = files && files[0]; if (!f) return false;
    setOG(segId, { fbBusy: true, note: null });
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await fetch('/api/trends/media/upload?kind=reference', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.asset?.fileUrl) { setOG(segId, { fbBusy: false, note: d?.error || 'Не удалось загрузить картинку.' }); return false; }
      updateSeg(segId, { startFrame: d.asset.fileUrl });
      setOG(segId, { fbBusy: false, note: 'Своя картинка — старт-кадр.' });
      return true;
    } catch { setOG(segId, { fbBusy: false, note: 'Ошибка загрузки картинки.' }); return false; }
  };
  // Загрузка новой картинки из модалки галереи: грузим → ставим старт-кадром → обновляем галерею → закрываем.
  const uploadStartFrameFromPicker = async (segId: string, files: FileList | null) => {
    const ok = await uploadStartFrame(segId, files);
    if (ok) { await loadMedia(); setImgPick(null); }
  };
  const runPromptImage = async (g: OmniSeg) => {
    if (omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy) return;
    if (!g.startFrame) { setOG(g.id, { note: 'Сначала возьми кадр из видео или загрузи картинку.' }); return; }
    if (!g.prompt.trim()) { setOG(g.id, { note: 'Впиши промт — как изменить картинку.' }); return; }
    setOG(g.id, { fbBusy: true, note: null });
    try {
      const res = await fetch('/api/render/omni/storyboard', { method: 'POST', headers: headers(), body: JSON.stringify({ prompt: g.prompt, count: 1, imageUrl: g.startFrame }) });
      const d = await res.json();
      if (!res.ok || !Array.isArray(d.frames) || !d.frames.length) { setOG(g.id, { fbBusy: false, note: d?.error ? friendlyOmniError(d.error) : 'Не удалось перерисовать кадр.' }); return; }
      updateSeg(g.id, { startFrame: d.frames[0].url });
      setOG(g.id, { fbBusy: false, note: 'Старт-кадр перерисован по промту (Nano).' });
    } catch { setOG(g.id, { fbBusy: false, note: 'Ошибка сети при перерисовке.' }); }
  };
  const runContinue = async (g: OmniSeg) => {
    const url = omniGen[g.id]?.url; if (!url) return;
    if (omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy) return;
    setOG(g.id, { fbBusy: true, note: null });
    try {
      const res = await fetch('/api/render/omni/frame', { method: 'POST', headers: headers(), body: JSON.stringify({ videoUrl: url, last: true }) });
      const d = await res.json();
      if (!res.ok || !d.url) { setOG(g.id, { fbBusy: false, note: d?.error || 'Не удалось взять последний кадр.' }); return; }
      const newId = addSegment(d.url);
      setOG(g.id, { fbBusy: false, note: newId ? 'Добавил окно-продолжение: старт = последний кадр.' : 'Нет места на ленте для нового окна.' });
    } catch { setOG(g.id, { fbBusy: false, note: 'Ошибка сети при продолжении.' }); }
  };
  const removeSeg = (id: string) => {
    if (omniPollRef.current[id]) { clearTimeout(omniPollRef.current[id]); delete omniPollRef.current[id]; } // не оставляем висящий поллинг удалённого окна
    omniMutate((s) => (s.segments.length <= 1 ? s : { ...s, segments: s.segments.filter((g) => g.id !== id) }));
  };
  const fmtT = (frac: number) => srcDuration > 0 ? `${(frac * srcDuration).toFixed(1)}с` : `${Math.round(frac * 100)}%`;
  const winSecOf = (g: OmniSeg) => srcDuration > 0 ? (g.end - g.start) * srcDuration : 0;
  const omniGenSeconds = omniSpec.segments.filter((g) => g.engine === 'omni').reduce((a, g) => a + Math.min(OMNI_MAX_SEC, winSecOf(g)), 0);
  // Идёт генерация видео или подготовка кадра хотя бы по одному окну → анимируем узел «Omni Flash» (как «Подкаст»).
  const omniBusy = Object.values(omniGen).some((x) => !!(x?.busy || x?.fbBusy));

  // ── Интерактивная лента Omni: тянем окно (тело=сдвиг, края=длина), макс 10с у Omni, живой seek ──
  const omniMaxFrac = () => srcDuration > 0 ? Math.min(1, OMNI_MAX_SEC / srcDuration) : 1;
  const omniMinFrac = () => srcDuration > 0 ? Math.min(0.5, srcDuration) / srcDuration : 0.03;
  const seekSrc = (frac: number) => {
    const v = srcVideoRef.current; if (!v || !srcDuration) return;
    try { v.pause(); v.currentTime = Math.max(0, Math.min(srcDuration - 0.03, frac * srcDuration)); } catch { /* seek не готов */ }
  };
  const fracFromClientX = (clientX: number) => {
    const el = stripRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    return r.width > 0 ? Math.max(0, Math.min(1, (clientX - r.left) / r.width)) : 0;
  };
  const omniDragStart = (e: React.PointerEvent, g: OmniSeg, handle: 'move' | 'start' | 'end') => {
    e.preventDefault(); e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* нет capture */ }
    omniDragRef.current = { id: g.id, handle, s0: g.start, e0: g.end, x0: e.clientX };
    seekSrc(handle === 'end' ? g.end : g.start);
  };
  const omniDragMove = (e: React.PointerEvent) => {
    const d = omniDragRef.current; if (!d) return;
    e.stopPropagation();   // не даём событию всплыть с ручки на тело (двойной обработчик)
    const seg = omniSpec.segments.find((x) => x.id === d.id); if (!seg) return;
    const isOmni = seg.engine === 'omni';
    const maxF = isOmni ? omniMaxFrac() : 1;
    const minF = omniMinFrac();
    const others = omniSpec.segments.filter((x) => x.id !== d.id);
    const prevEnd = others.filter((x) => x.end <= d.s0 + 1e-4).reduce((m, x) => Math.max(m, x.end), 0);
    const nextStart = others.filter((x) => x.start >= d.e0 - 1e-4).reduce((m, x) => Math.min(m, x.start), 1);
    const cur = fracFromClientX(e.clientX);
    if (d.handle === 'move') {
      const w = d.e0 - d.s0;
      let s = d.s0 + (cur - fracFromClientX(d.x0));
      s = Math.max(prevEnd, Math.min(s, Math.min(1, nextStart) - w));
      updateSeg(d.id, { start: s, end: s + w });
      seekSrc(s);
    } else if (d.handle === 'start') {
      let s = Math.max(prevEnd, Math.min(cur, d.e0 - minF));
      if (isOmni && d.e0 - s > maxF) s = d.e0 - maxF;
      s = Math.max(0, s);
      updateSeg(d.id, { start: s, end: d.e0 });
      seekSrc(s);
    } else {
      let en = Math.min(nextStart, Math.max(cur, d.s0 + minF));
      if (isOmni && en - d.s0 > maxF) en = d.s0 + maxF;
      en = Math.min(1, en);
      updateSeg(d.id, { start: d.s0, end: en });
      seekSrc(en);
    }
  };
  const omniDragEnd = (e: React.PointerEvent) => {
    if (!omniDragRef.current) return;
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    omniDragRef.current = null;
  };

  // ── «Комментатор»: сборка + поллинг ЗДЕСЬ (переживает закрытие панели) ──
  const pollCommentatorBuild = (jobId: string) => {
    let ticks = 0;
    const tick = async () => {
      try {
        const res = await fetch('/api/render/commentator/compose/status?jobId=' + jobId, { headers: headers() });
        if (res.status === 404) { setCommBusy(null); setFlowComm((s) => ({ ...s, buildJobId: null })); setDirty(true); return; }
        const d = await res.json();
        if (res.ok && d.status && d.status !== 'processing') {
          setCommBusy(null);
          setFlowComm((s) => ({ ...s, buildJobId: null, resultUrl: d.fileUrl || s.resultUrl || null }));
          if (d.fileUrl) setCommFreshDone(true);
          setDirty(true);
          return;
        }
      } catch { /* ретрай */ }
      if (++ticks > 320) { setCommBusy(null); return; } // ~21 мин
      commPollRef.current = window.setTimeout(tick, 4000);
    };
    tick();
  };
  const startCommentatorBuild = async (payload: { audioUrl: string; format: string; lines: any[] }) => {
    if (commBusy) return;
    if (commPollRef.current) { clearTimeout(commPollRef.current); commPollRef.current = null; }
    setCommBusy('build');
    setFlowComm((s) => ({ ...s, resultUrl: null }));
    try {
      const res = await fetch('/api/render/commentator/compose', { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.jobId) { setCommBusy(null); return; }
      setFlowComm((s) => ({ ...s, buildJobId: d.jobId })); setDirty(true);
      pollCommentatorBuild(d.jobId);
    } catch { setCommBusy(null); }
  };
  // Диаризация «Комментатора» ЗДЕСЬ (переживает закрытие + крутит кольцо у узла flow).
  const startCommentatorDiarize = async (audioUrl: string) => {
    if (commBusy || !audioUrl) return;
    setCommBusy('diarize');
    try {
      const res = await fetch('/api/render/podcast/diarize', { method: 'POST', headers: headers(), body: JSON.stringify({ recordingUrl: audioUrl }) });
      const d = await res.json().catch(() => ({}));
      const raw = Array.isArray(d.lines) ? d.lines : [];
      const cl: PodLine[] = raw
        .filter((l: any) => Number.isFinite(Number(l?.start)))
        .map((l: any) => ({ speaker: (l?.speaker === 'B' ? 'B' : 'A') as 'A' | 'B', text: String(l?.text || '').trim(), start: Number(l.start), end: Number(l?.end ?? l.start), tStart: Number(l.start), mode: 'full' as const }));
      if (cl.length) { setFlowComm((s) => ({ ...s, lines: cl })); setDirty(true); }
    } catch { /* тихо */ }
    finally { setCommBusy(null); }
  };
  // Возобновление сборки после перезахода (джоб шёл в фоне): buildJobId есть, результата нет.
  useEffect(() => {
    if (flowComm.buildJobId && !flowComm.resultUrl && !commBusy && commPollRef.current == null) {
      setCommBusy('build'); pollCommentatorBuild(flowComm.buildJobId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowComm.buildJobId]);

  // Размонтаж: гасим фоновые опросы (Omni/Комментатор) — тикеры в полёте не переустановят таймеры.
  useEffect(() => () => {
    pollAliveRef.current = false;
    if (commPollRef.current) { clearTimeout(commPollRef.current); commPollRef.current = null; }
    Object.values(omniPollRef.current).forEach((t) => clearTimeout(t));
  }, []);
  // Вся Галерея с папками (как в разделе «Галерея»): тренды + референс + аудио + из анализа.
  const loadMedia = async () => {
    try {
      const [tr, r, a, an] = await Promise.all([
        fetch('/api/trends/videos?downloaded=1&limit=200', { headers: headers() }),
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
        fetch('/api/trends/media?kind=audio', { headers: headers() }),
        fetch('/api/trends/media?folder=analyzed', { headers: headers() }),
      ]);
      const trends = tr.ok ? (await tr.json()).videos || [] : [];
      const ref = r.ok ? (await r.json()).assets || [] : [];
      const aud = a.ok ? (await a.json()).assets || [] : [];
      const ana = an.ok ? (await an.json()).assets || [] : [];
      const seen = new Set<string>();
      const out: { id: string; fileUrl: string; title: string; kind: string; folder: 'trends' | 'reference' | 'audio' | 'analyzed'; cover?: string }[] = [];
      const push = (id: string, fileUrl: string, title: string, kind: string, folder: 'trends' | 'reference' | 'audio' | 'analyzed', cover?: string) => {
        if (fileUrl && !seen.has(fileUrl)) { seen.add(fileUrl); out.push({ id: id || fileUrl, fileUrl, title, kind, folder, cover }); }
      };
      for (const v of trends) if (v.fileUrl) push(v.id, v.fileUrl, v.title || v.author || 'видео', 'video', 'trends', v.coverUrl);
      for (const m of ref) push(m.id, m.fileUrl, m.originalName || 'файл', m.mediaType, 'reference');
      for (const m of aud) push(m.id, m.fileUrl, m.originalName || 'аудио', m.mediaType, 'audio');
      for (const m of ana) if (m.mediaType === 'video') push(m.id, m.fileUrl, m.originalName || 'видео', 'video', 'analyzed');
      setMedia(out);
    } catch { setMedia([]); }
  };

  // Загрузка файлов с устройства (или drag-and-drop) прямо из блока узла → в Галерею + привязка к узлу.
  /** Универсальная загрузка в Галерею для GalleryPicker: заливает файл(ы), отдаёт новые элементы (auto-pick делает пикер).
   *  kind не задан → определяем по типу файла (audio/* → «Аудио», иначе «Референс»). */
  const uploadToGallery = async (files: FileList | File[], kind?: 'reference' | 'audio'): Promise<GalleryPickItem[]> => {
    const list = Array.from(files).filter(Boolean);
    const out: GalleryPickItem[] = [];
    for (const f of list) {
      const k: 'reference' | 'audio' = kind || ((f.type || '').startsWith('audio/') ? 'audio' : 'reference');
      const fd = new FormData();
      fd.append('file', f);
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`/api/trends/media/upload?kind=${k}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (res.ok) {
        const d = await res.json();
        const a = d.asset;
        if (a?.fileUrl) out.push({ id: a.id || a.fileUrl, fileUrl: a.fileUrl, title: a.originalName || 'файл', type: a.mediaType || (k === 'audio' ? 'audio' : 'file'), cat: k === 'audio' ? 'audio' : 'reference' });
      }
    }
    return out;
  };

  // Пикер исходного видео: проанализированные (с ДНК) + скачанные тренды + видео-референсы.
  /** Загрузить список источников (как в Галерее): анализ + скачанные тренды + референс-видео. */
  const loadSources = async () => {
    try {
      const [an, v, r] = await Promise.all([
        fetch('/api/trends/media?folder=analyzed', { headers: headers() }),
        fetch('/api/trends/videos?downloaded=1', { headers: headers() }),
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
      ]);
      const analyzed = an.ok ? ((await an.json()).assets || []) : [];
      const vids = v.ok ? ((await v.json()).videos || []) : [];
      const refs = r.ok ? ((await r.json()).assets || []) : [];
      const list: { url: string; name: string; thumb?: string; type: string; assetId?: string }[] = [];
      // Проанализированные («Из анализа») первыми — у них есть ДНК для автозаполнения блоков.
      for (const m of analyzed) if (m.mediaType === 'video' && m.fileUrl) list.push({ url: m.fileUrl, name: m.originalName || 'видео', thumb: m.coverUrl || m.thumbUrl || undefined, type: 'analyzed', assetId: m.id });
      for (const x of vids) if (x.fileUrl) list.push({ url: x.fileUrl, name: String(x.description || x.authorName || x.author || 'Видео').slice(0, 40), thumb: x.coverUrl, type: 'trend' });
      for (const m of refs) if (m.mediaType === 'video' && m.fileUrl) list.push({ url: m.fileUrl, name: m.originalName || 'видео', thumb: m.coverUrl || m.thumbUrl || undefined, type: 'reference' });
      setSources(list);
    } catch { setSources([]); }
  };
  const openSourcePicker = async () => {
    setShowSource(true);
    setSrcNote(null); setSrcTab('all'); setSrcQuery('');
    await loadSources();
  };
  /** «Добавить видео» из пикера источника → грузим в Референс Галереи и перечитываем список. */
  const uploadSourceVideo = async (files: FileList | File[] | null) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setSrcUploading(true); setSrcNote(null);
    try {
      for (const f of list) {
        const fd = new FormData(); fd.append('file', f);
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch('/api/trends/media/upload?kind=reference', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      }
      await loadSources();
      setSrcTab('reference');   // загруженное лежит в «Референс»
    } catch (e: any) { setSrcNote(e?.message || 'Ошибка загрузки видео'); }
    finally { setSrcUploading(false); if (srcUploadRef.current) srcUploadRef.current.value = ''; }
  };

  // ── Выбор источника (исходное видео для облачных блоков) ──
  const selectSource = (s: { url: string; name: string; assetId?: string }) => {
    setSourceUrl(s.url); setSourceName(s.name); setSourceAssetId(s.assetId || null);
    setDirty(true); setShowSource(false);
  };
  const clearSource = () => {
    setSourceUrl(null); setSourceName(null); setSourceAssetId(null);
    setDirty(true); setShowSource(false);
  };

  // ── Облачные узлы: позиции, связи-стрелки, перетаскивание ──────────────────
  const cloudPoint = (id: string): { x: number; y: number } | null => {
    const base = id === 'center' ? { x: 50, y: 50 } : (id === 'omni' || id === 'plan' || id === 'editor') ? cloud[id] : null;
    // Точка соединения 🔗 — у верх-правого края узла (лента идёт от неё, не из центра).
    return base ? { x: base.x + 2.6, y: base.y - 3 } : null;
  };

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    setCloudEdges((es) => (es.some((e) => e.from === from && e.to === to) ? es : [...es, { from, to }]));
    setDirty(true);
  };

  const onCloudClick = (id: CloudId) => {
    if (movedRef.current) { movedRef.current = false; return; } // был drag узла — не открываем панель
    if (id === 'hotebook') setHbFreshDone(false); // открыли — зелёная точка погасла
    if (id === 'flow') setCommFreshDone(false);
    setCloudPanel(id);
  };

  // ── Облако «Редактор»: пикер видео из Галереи + склейка ──
  const loadEditorGallery = async () => {
    setEditorPick(true); setEditorGalLoading(true); setEditorNote(null); setEditorQuery('');
    try {
      // Как в Галерее: тренды + референс-видео + папка «Из анализа» + аудио — по вкладкам.
      const [v, r, an, au] = await Promise.all([
        fetch('/api/trends/videos?downloaded=1&limit=200', { headers: headers() }),
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
        fetch('/api/trends/media?folder=analyzed', { headers: headers() }),
        fetch('/api/trends/media?kind=audio', { headers: headers() }),
      ]);
      const vids = v.ok ? ((await v.json()).videos || []) : [];
      const refs = r.ok ? ((await r.json()).assets || []) : [];
      const analyzed = an.ok ? ((await an.json()).assets || []) : [];
      const audios = au.ok ? ((await au.json()).assets || []) : [];
      const seen = new Set<string>();
      const list: { url: string; name: string; cover?: string; type: 'video' | 'audio'; cat: EdCat }[] = [];
      const push = (url: string, name: string, type: 'video' | 'audio', cat: EdCat, cover?: string) => {
        if (url && !seen.has(url)) { seen.add(url); list.push({ url, name, cover, type, cat }); }
      };
      for (const x of vids) if (x.fileUrl) push(x.fileUrl, x.title || x.author || 'видео', 'video', 'trends', x.coverUrl);
      for (const m of analyzed) if (m.mediaType === 'video' && m.fileUrl) push(m.fileUrl, m.originalName || 'видео', 'video', 'analyzed');
      for (const m of refs) if (m.mediaType === 'video' && m.fileUrl) push(m.fileUrl, m.originalName || 'видео', 'video', 'reference');
      for (const m of audios) if (m.fileUrl) push(m.fileUrl, m.originalName || 'аудио', 'audio', 'audio');
      setEditorGallery(list);
      // Открыть первую непустую вкладку (приоритет — «Из анализа», где лежат проанализированные видео).
      const order: EdCat[] = ['analyzed', 'trends', 'reference', 'audio'];
      const firstNonEmpty = order.find((c) => list.some((it) => it.cat === c));
      if (firstNonEmpty) setEditorTab(firstNonEmpty);
    } catch { setEditorGallery([]); }
    finally { setEditorGalLoading(false); }
  };
  /** Загрузка «Медиа»/«Аудио» прямо из пикера — тот же эндпоинт, что в Галерее; затем перезагрузка списка. */
  const uploadEditorMedia = async (files: FileList | null, kind: 'reference' | 'audio') => {
    if (!files || files.length === 0) return;
    setEditorUploading(true); setEditorNote(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        // FormData: НЕ задаём Content-Type — браузер сам проставит boundary.
        // eslint-disable-next-line no-await-in-loop
        const res = await fetch(`/api/trends/media/upload?kind=${kind}`, {
          method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd,
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      }
      await loadEditorGallery();                                 // перезагрузить (как Галерея после аплоада)
      setEditorTab(kind === 'audio' ? 'audio' : 'reference');    // открыть вкладку, куда легло
    } catch (e: any) { setEditorNote(e?.message || 'Ошибка загрузки'); }
    finally {
      setEditorUploading(false);
      if (edMediaInputRef.current) edMediaInputRef.current.value = '';
      if (edAudioInputRef.current) edAudioInputRef.current.value = '';
    }
  };
  const addEditorClip = (c: { url: string; name: string; type?: 'video' | 'audio' }) => { setEditorClips((cs) => (cs.some((x) => x.url === c.url) ? cs : [...cs, c])); setDirty(true); };
  const removeEditorClip = (url: string) => { setEditorClips((cs) => cs.filter((x) => x.url !== url)); setDirty(true); };
  const mergeEditorClips = async () => {
    if (editorClips.length < 2 || editorMerging) return;
    if (editorClips.some((c) => c.type === 'audio')) { setEditorNote('Склейка — только для видео. Аудио редактируйте по одному (обрезка).'); return; }
    setEditorMerging(true); setEditorNote(null);
    try {
      const res = await fetch('/api/video-edit/merge', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ clips: editorClips.map((c) => ({ inputUrl: c.url })), name: name ? `Склейка — ${name}` : 'Склейка видео' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Ошибка ${res.status}`);
      setEditorResult({ url: d.fileUrl, name: 'Склейка видео', type: 'video' }); setDirty(true);
    } catch (e: any) { setEditorNote(e?.message || 'Не удалось склеить'); }
    finally { setEditorMerging(false); }
  };
  // Панель «Редактор» открыта → сразу показываем Галерею (пикер всегда виден снизу,
  // отдельная кнопка «Выбрать видео / аудио» не нужна — добавляем кликом по превью).
  useEffect(() => {
    if (cloudPanel === 'editor') loadEditorGallery();
    if (cloudPanel === 'hotebook') void hbLoadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudPanel]);

  // ── Блок «Hotebook»: загрузка сводки, источники, чат, генерации, поллинг ──
  const hbRefreshStatus = async (force = false) => {
    try {
      const r = await fetch(`/api/notebooklm/status${force ? '?force=1' : ''}`, { headers: headers() });
      if (r.ok) setHbStatus((await r.json()).status || null);
    } catch { /* статус обновится при следующем действии */ }
  };
  /** Поллинг активных джоб (4с): подтягивает статусы, зажигает зелёную точку на узле. */
  const hbPollLoop = async () => {
    if (hbPollingRef.current) return;
    hbPollingRef.current = true;
    try {
      while (pollAliveRef.current) {
        const act = hbJobsRef.current.filter((j) => j.status === 'queued' || j.status === 'running');
        if (act.length === 0) break;
        for (const j of act) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const r = await fetch(`/api/notebooklm/jobs/${j.id}`, { headers: headers() });
            if (r.ok) {
              // eslint-disable-next-line no-await-in-loop
              const nj = (await r.json()).job;
              if (nj) {
                setHbJobs((js) => js.map((x) => (x.id === nj.id ? nj : x)));
                if (nj.status === 'done') setHbFreshDone(true);
                if (nj.status === 'error' && (nj.errorKind === 'auth' || nj.errorKind === 'api_changed' || nj.errorKind === 'quota')) void hbRefreshStatus(true);
              }
            }
          } catch { /* сеть мигнула — следующий круг */ }
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, 4000));
      }
    } finally {
      hbPollingRef.current = false;
    }
  };
  /** Сводка панели: статус + блокнот + источники + джобы + счётчики. silent — фоновая гидрация. */
  const hbLoadOverview = async (silent = false) => {
    if (!silent) { setHbLoading(true); setHbNote(null); }
    try {
      const r = await fetch(`/api/notebooklm/flow/${flowId}/overview`, { headers: headers() });
      if (!r.ok) {
        if (!silent) setHbNote(r.status === 403 ? 'Блок «Hotebook» доступен на тарифе Enterprise.' : `Ошибка ${r.status}`);
        return;
      }
      const d = await r.json();
      setHbStatus(d.status || null);
      setHbSources(Array.isArray(d.sources) ? d.sources : []);
      // История чата из NotebookLM (плоский список user/assistant) → пары {q,a}; грузим ТОЛЬКО если
      // локальный чат сценария пуст (не затираем начатый диалог).
      if (Array.isArray(d.chat) && d.chat.length) {
        const paired: { q: string; a: string; ts: number; cites: number }[] = [];
        let pendingQ: string | null = null;
        for (const m of d.chat) {
          if (m?.role === 'user') { if (pendingQ != null) paired.push({ q: pendingQ, a: '', ts: 0, cites: 0 }); pendingQ = String(m.text || ''); }
          else if (m?.role === 'assistant') { paired.push({ q: pendingQ || '', a: String(m.text || ''), ts: 0, cites: 0 }); pendingQ = null; }
        }
        if (pendingQ != null) paired.push({ q: pendingQ, a: '', ts: 0, cites: 0 });
        if (paired.length) hbMutate((h: any) => (Array.isArray(h.chat) && h.chat.length ? h : { ...h, chat: paired }));
      }
      // Подсказки-продолжения (чипы) из блокнота — показываем кнопками под чатом.
      if (Array.isArray(d.suggestions)) setHbSuggestions(d.suggestions.filter((x: any) => typeof x === 'string'));
      setHbJobs(Array.isArray(d.jobs) ? d.jobs : []);
      setHbCounters(d.counters && typeof d.counters === 'object' ? d.counters : {});
      setHbArtifactCounts(d.artifactCounts && typeof d.artifactCounts === 'object' ? d.artifactCounts : {});
      if ((d.jobs || []).some((j: any) => j.status === 'queued' || j.status === 'running')) setTimeout(() => { void hbPollLoop(); }, 0);
    } catch { if (!silent) setHbNote('Бэкенд недоступен.'); }
    finally { if (!silent) setHbLoading(false); }
  };
  // Тихая гидрация после загрузки сценария: кольцо генерации на узле оживает без открытия панели.
  useEffect(() => {
    if (!loading) void hbLoadOverview(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);
  const hbErr = async (res: globalThis.Response): Promise<string> => {
    const d = await res.json().catch(() => ({} as any));
    if (d?.errorKind && ['ext_offline', 'ext_login', 'error'].includes(d.errorKind)) void hbRefreshStatus(true);
    return d?.error || `Ошибка ${res.status}`;
  };
  // После добавления источника: зелёный фидбэк + перечитать АВТОРИТЕТНЫЙ список из блокнота
  // (сколько бы их ни было — панель всегда показывает реальные, не «застревает» на одном).
  const hbAfterAdd = (label: string) => {
    setHbOk(`Источник добавлен: ${label}. Можно добавлять ещё.`);
    setTimeout(() => setHbOk(null), 6000);
    void hbLoadOverview(true);
  };
  const hbAddUrl = async () => {
    const url = hbSrcUrl.trim();
    if (!url || hbSrcBusy) return;
    if (!/^https?:\/\//i.test(url)) { setHbNote('Ссылка должна начинаться с http(s)://'); return; }
    setHbSrcBusy(true); setHbNote(null); setHbOk(null);
    try {
      const r = await fetch(`/api/notebooklm/flow/${flowId}/sources`, { method: 'POST', headers: headers(), body: JSON.stringify({ kind: 'url', url, flowName: name }) });
      if (!r.ok) throw new Error(await hbErr(r));
      const d = await r.json();
      if (d.source) setHbSources((s) => [...s, d.source]);
      setHbSrcUrl('');
      hbAfterAdd(d.source?.title || d.source?.url || url);
    } catch (e: any) { setHbNote(e?.message || 'Не удалось добавить источник'); }
    finally { setHbSrcBusy(false); }
  };
  const hbAddText = async () => {
    const content = hbSrcText.trim();
    if (!content || hbSrcBusy) return;
    setHbSrcBusy(true); setHbNote(null); setHbOk(null);
    try {
      const title = content.split('\n')[0].slice(0, 60) || 'Текст';
      const r = await fetch(`/api/notebooklm/flow/${flowId}/sources`, { method: 'POST', headers: headers(), body: JSON.stringify({ kind: 'text', title, content, flowName: name }) });
      if (!r.ok) throw new Error(await hbErr(r));
      const d = await r.json();
      if (d.source) setHbSources((s) => [...s, d.source]);
      setHbSrcText(''); setHbTextOpen(false);
      hbAfterAdd(title);
    } catch (e: any) { setHbNote(e?.message || 'Не удалось добавить текст'); }
    finally { setHbSrcBusy(false); }
  };
  /** Пикер источника-файла из Галереи (media_assets: референс/аудио/из анализа). */
  // Пикер источника = ВСЯ Галерея с вкладками-папками (как её видит юзер): TrendFlow
  // (референс) + Аудио + Из анализа. У «Из анализа» — доп. кнопка «＋ анализ» (описание).
  const hbOpenPick = async () => {
    setHbPickOpen(true); setHbGalLoading(true); setHbGallery([]); setHbPickQuery(''); setHbPickedIds(new Set());
    try {
      const [r, au, an] = await Promise.all([
        fetch('/api/trends/media?kind=reference', { headers: headers() }),
        fetch('/api/trends/media?kind=audio', { headers: headers() }),
        fetch('/api/trends/media?folder=analyzed', { headers: headers() }),
      ]);
      const out: { id: string; name: string; type: string; cat: EdCat; url: string; cover?: string }[] = [];
      const seen = new Set<string>();
      const push = (id: string, nm: string, type: string, cat: EdCat, url: string, cover?: string) => {
        const k = `${cat}:${id}`;
        if (id && !seen.has(k)) { seen.add(k); out.push({ id, name: nm, type, cat, url, cover }); }
      };
      const refs = r.ok ? ((await r.json()).assets || []) : [];
      for (const m of refs) if (m.id) push(m.id, m.originalName || 'файл', m.mediaType || 'file', 'reference', m.fileUrl, m.coverUrl);
      const auds = au.ok ? ((await au.json()).assets || []) : [];
      for (const m of auds) if (m.id) push(m.id, m.originalName || 'аудио', m.mediaType || 'audio', 'audio', m.fileUrl, m.coverUrl);
      const ana = an.ok ? ((await an.json()).assets || []) : [];
      for (const m of ana) if (m.id) push(m.id, m.originalName || 'файл', m.mediaType || 'file', 'analyzed', m.fileUrl, m.coverUrl);
      setHbGallery(out);
      const order: EdCat[] = ['analyzed', 'reference', 'audio'];
      const first = order.find((c) => out.some((x) => x.cat === c));
      if (first) setHbPickTab(first);
    } catch { setHbGallery([]); }
    finally { setHbGalLoading(false); }
  };
  const hbAddAsset = async (assetId: string) => {
    if (hbSrcBusy) return;
    setHbSrcBusy(true); setHbNote(null); setHbOk(null);
    try {
      const r = await fetch(`/api/notebooklm/flow/${flowId}/sources/asset`, { method: 'POST', headers: headers(), body: JSON.stringify({ assetId, flowName: name }) });
      if (!r.ok) throw new Error(await hbErr(r));
      const d = await r.json(); if (d.source) setHbSources((s) => [...s, d.source]);
      setHbPickedIds((p) => new Set(p).add(assetId)); // отметить ✓, пикер оставить открытым (можно добавить ещё)
      hbAfterAdd(d.source?.title || 'файл');
    } catch (e: any) { setHbNote(e?.message || 'Не удалось добавить файл'); }
    finally { setHbSrcBusy(false); }
  };
  // Собрать ПОЛНЫЙ текст анализа из сохранённой ДНК (video_analyses.dna) — тот же
  // разбор, что видно на вкладке «Аналитика»: Viral Breakdown + Video Content Analysis.
  const hbBuildAnalysisText = (dna: any): string => {
    if (!dna || typeof dna !== 'object') return '';
    const L: string[] = [];
    const line = (label: string, v: any) => { const s = String(v ?? '').trim(); if (s) L.push(`${label}: ${s}`); };
    const bullets = (label: string, arr: any) => {
      if (Array.isArray(arr) && arr.length) { L.push(`${label}:`); for (const x of arr) { const s = String(x ?? '').trim(); if (s) L.push(`• ${s}`); } }
    };
    L.push('=== ВИРАЛЬНЫЙ РАЗБОР ===');
    line('Тип хука', dna.hookType);
    line('Почему работает', dna.whyItWorks);
    line('Целевая аудитория', dna.targetAudience);
    bullets('Факторы виральности', dna.viralFactors);
    if (String(dna.copyReadyScript || '').trim()) { L.push('Готовый сценарий (copy-ready):'); L.push(String(dna.copyReadyScript).trim()); }
    bullets('Как адаптировать', dna.howToAdapt);
    L.push('');
    L.push('=== АНАЛИЗ СОДЕРЖАНИЯ ===');
    line('Краткое описание', dna.summary);
    if (Array.isArray(dna.sceneBeats) && dna.sceneBeats.length) {
      L.push('Сцены (тайминг):');
      for (const b of dna.sceneBeats) {
        const t = typeof b?.t === 'number' ? `${Math.floor(b.t / 60)}:${String(Math.floor(b.t % 60)).padStart(2, '0')}` : '';
        const desc = String(b?.desc ?? '').trim();
        if (desc) L.push(`• ${t ? t + ' — ' : ''}${desc}${b?.intensity ? ` [${b.intensity}]` : ''}`);
      }
    }
    line('Разбор хука', dna.hookAnalysis);
    line('Визуальный стиль', dna.visualStyle);
    line('Аудио/диалог', dna.audioDialogue);
    bullets('Почему заходит у зрителя', dna.whyResonates);
    bullets('Как повторить', dna.howToReplicate);
    if (Array.isArray(dna.keywords) && dna.keywords.length) line('Ключевые слова', dna.keywords.join(', '));
    if (dna.sourceUrl) line('Источник', dna.sourceUrl);
    const out = L.join('\n').trim();
    return out.length > 40 ? out : (dna.brief ? String(dna.brief) : (dna.summary ? String(dna.summary) : ''));
  };
  const hbAddSourceText = async (title: string, content: string) => {
    const r = await fetch(`/api/notebooklm/flow/${flowId}/sources`, { method: 'POST', headers: headers(), body: JSON.stringify({ kind: 'text', title, content, flowName: name }) });
    if (!r.ok) throw new Error(await hbErr(r));
    const d = await r.json(); if (d.source) setHbSources((s) => [...s, d.source]);
  };
  const hbFetchAnalysisText = async (assetId: string): Promise<string | null> => {
    const ar = await fetch(`/api/trends/media/${assetId}/analysis`, { headers: headers() });
    if (ar.status === 404) return null;
    if (!ar.ok) throw new Error(`Ошибка ${ar.status}`);
    return hbBuildAnalysisText((await ar.json()).analysis?.dna || {}) || null;
  };
  // «＋ анализ»: добавить ПОЛНЫЙ сохранённый анализ файла отдельным текст-источником.
  const hbAddAnalysis = async (assetId: string, fileName: string) => {
    if (hbSrcBusy) return;
    setHbSrcBusy(true); setHbNote(null); setHbOk(null);
    try {
      const content = await hbFetchAnalysisText(assetId);
      if (!content) { setHbNote('Для этого файла нет сохранённого анализа.'); return; }
      await hbAddSourceText(`Анализ: ${fileName}`, content);
      setHbPickedIds((p) => new Set(p).add(assetId));
      hbAfterAdd(`Анализ: ${fileName}`);
    } catch (e: any) { setHbNote(e?.message || 'Не удалось добавить анализ'); }
    finally { setHbSrcBusy(false); }
  };
  // «＋ видео + анализ»: одним кликом добавить и сам файл, и его анализ (отдельными источниками).
  const hbAddBoth = async (assetId: string, fileName: string) => {
    if (hbSrcBusy) return;
    setHbSrcBusy(true); setHbNote(null); setHbOk(null);
    try {
      const rv = await fetch(`/api/notebooklm/flow/${flowId}/sources/asset`, { method: 'POST', headers: headers(), body: JSON.stringify({ assetId, flowName: name }) });
      if (!rv.ok) throw new Error(await hbErr(rv));
      const dv = await rv.json(); if (dv.source) setHbSources((s) => [...s, dv.source]);
      let noAnalysis = false;
      try {
        const content = await hbFetchAnalysisText(assetId);
        if (content) await hbAddSourceText(`Анализ: ${fileName}`, content);
        else noAnalysis = true;
      } catch { noAnalysis = true; }
      setHbPickedIds((p) => new Set(p).add(assetId));
      hbAfterAdd(noAnalysis ? fileName : `${fileName} + анализ`);
      if (noAnalysis) setHbNote('Видео добавлено. Сохранённого анализа у него нет — добавилось только видео.');
    } catch (e: any) { setHbNote(e?.message || 'Не удалось добавить'); }
    finally { setHbSrcBusy(false); }
  };
  const hbDelSource = async (sid: string) => {
    try {
      const r = await fetch(`/api/notebooklm/flow/${flowId}/sources/${encodeURIComponent(sid)}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error(await hbErr(r));
      setHbSources((s) => s.filter((x) => (x.id || x.source_id) !== sid));
    } catch (e: any) { setHbNote(e?.message || 'Не удалось удалить источник'); }
  };
  const hbAsk = async () => {
    const q = hbChatQ.trim();
    if (!q || hbChatBusy) return;
    if (hbSources.length === 0) { setHbNote('Сначала добавьте хотя бы один источник.'); return; }
    setHbChatBusy(true); setHbNote(null);
    setHbChatQ('');
    // ОНЛАЙН: показываем вопрос СРАЗУ + «думает…», ответ приходит и заменяет плейсхолдер (раньше
    // ничего не появлялось до конца запроса → казалось, что чат не работает без переоткрытия).
    const pendingTs = Date.now();
    hbMutate((h) => ({ ...h, chat: [...h.chat, { q, a: '', ts: pendingTs, cites: 0, pending: true }] }));
    try {
      const r = await fetch(`/api/notebooklm/flow/${flowId}/chat`, { method: 'POST', headers: headers(), body: JSON.stringify({ question: q, flowName: name }) });
      if (!r.ok) throw new Error(await hbErr(r));
      const d = await r.json();
      const a = typeof d.answer === 'string' ? d.answer : JSON.stringify(d.answer ?? '');
      const cites = Array.isArray(d.citations) ? d.citations.length : 0;
      hbMutate((h) => ({ ...h, chat: h.chat.map((m) => (m.ts === pendingTs && m.pending ? { q, a, ts: pendingTs, cites } : m)) }));
      setHbSuggestions(Array.isArray(d.suggestions) ? d.suggestions.filter((x: any) => typeof x === 'string') : []);
    } catch (e: any) {
      setHbNote(e?.message || 'Чат не ответил');
      hbMutate((h) => ({ ...h, chat: h.chat.map((m) => (m.ts === pendingTs && m.pending ? { ...m, a: '⚠ ответ не пришёл — попробуйте ещё раз', pending: false } : m)) }));
    }
    finally { setHbChatBusy(false); }
  };
  const hbOpenGen = (t: HbType) => {
    setHbGenSet({ ...hbDefaults(t), ...((hb.settings[t] as Record<string, string>) || {}) });
    setHbGenOpen(t);
  };
  const hbGenerate = async () => {
    const t = hbGenOpen;
    if (!t || hbGenBusy) return;
    if (hbSources.length === 0) { setHbNote('Сначала добавьте хотя бы один источник.'); setHbGenOpen(null); return; }
    setHbGenBusy(true); setHbNote(null);
    try {
      const r = await fetch(`/api/notebooklm/flow/${flowId}/generate`, { method: 'POST', headers: headers(), body: JSON.stringify({ type: t, params: hbGenSet, name: (hb.name || '').trim(), flowName: name }) });
      if (!r.ok) throw new Error(await hbErr(r));
      const d = await r.json();
      if (d.job) {
        setHbJobs((js) => [d.job, ...js]);
        setHbCounters((c) => ({ ...c, [t]: (c[t] || 0) + 1 }));
        setTimeout(() => { void hbPollLoop(); }, 0);
      }
      hbMutate((h) => ({ ...h, settings: { ...h.settings, [t]: hbGenSet } })); // запомнить настройки
      setHbGenOpen(null);
    } catch (e: any) { setHbNote(e?.message || 'Не удалось запустить генерацию'); }
    finally { setHbGenBusy(false); }
  };

  const setPend = (v: { from: string; x: number; y: number } | null) => { pendingRef.current = v; setPending(v); };
  // Старт перетягивания СТРЕЛКИ от точки 🔗 узла.
  const startConnect = (from: string, e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    const p = cloudPoint(from);
    setPend({ from, x: p?.x ?? 50, y: p?.y ?? 50 });
  };

  // Перетаскивание САМОГО УЗЛА (Omni/Контент-план).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current || !canvasRef.current) return;
      movedRef.current = true;
      const r = canvasRef.current.getBoundingClientRect();
      const x = Math.max(5, Math.min(95, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.max(5, Math.min(95, ((e.clientY - r.top) / r.height) * 100));
      setCloud((c) => ({ ...c, [dragRef.current as CloudId]: { x, y } }));
    };
    const up = () => { if (dragRef.current && movedRef.current) setDirty(true); dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  // Перетаскивание СТРЕЛКИ: тянем от 🔗 — линия следует за курсором; отпустили на узле → связь.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!pendingRef.current || !canvasRef.current) return;
      const r = canvasRef.current.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      setPend({ ...pendingRef.current, x, y });
    };
    const up = (e: PointerEvent) => {
      if (!pendingRef.current) return;
      const from = pendingRef.current.from;
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const to = el?.closest('[data-node-id]')?.getAttribute('data-node-id') || null;
      if (to && to !== from) addEdge(from, to);
      setPend(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center" style={{ height: '70vh' }}><Loader2 size={26} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 8px)', position: 'relative' }}>
      <style>{`
        .me-node{transition:transform .18s cubic-bezier(.34,1.56,.64,1), filter .18s ease;}
        .me-line-flow{animation:meLineFlow 1.1s linear infinite;}
        @keyframes meLineFlow{to{stroke-dashoffset:9.2;}}
        .me-node:hover{transform:translate(-50%,-50%) scale(1.12);filter:brightness(1.3);}
        .me-node-in{animation:meNodeIn .45s cubic-bezier(.34,1.56,.64,1) backwards;}
        @keyframes meNodeIn{from{opacity:0;transform:translate(-50%,-50%) scale(.3)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        .me-pop-in{animation:mePop .2s ease;}
        @keyframes mePop{from{opacity:0;transform:translate(-50%,-50%) scale(.6)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
        /* центр — обработка */
        .me-build{animation:meBuildPulse 1.6s ease-in-out infinite!important;}
        @keyframes meBuildPulse{0%,100%{box-shadow:0 0 30px rgba(99,102,241,.5)}50%{box-shadow:0 0 64px rgba(99,102,241,1)}}
        .me-ring{position:absolute;left:50%;top:50%;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;border:3px solid transparent;border-top-color:var(--brand);border-right-color:rgba(99,102,241,.35);animation:meSpin 1s linear infinite;pointer-events:none;}
        @keyframes meSpin{to{transform:rotate(360deg)}}
        /* шиммер прогресса */
        .me-shimmer{background:linear-gradient(90deg,var(--brand),#c7d2fe,var(--brand));background-size:200% 100%;animation:meShimmer 1.3s linear infinite;}
        @keyframes meShimmer{to{background-position:-200% 0}}
        .me-fab{transition:transform .15s ease, filter .15s ease, box-shadow .15s ease;}
        .me-fab:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.06);box-shadow:0 12px 32px rgba(99,102,241,.6);}
        .me-fab:active:not(:disabled){transform:translateY(0) scale(.97);}
        /* нижнее поле */
        .me-addbar{transition:box-shadow .25s ease, transform .2s ease, border-color .25s ease;}
        .me-addbar:hover,.me-addbar:focus-within{transform:translateY(-2px);box-shadow:0 10px 30px rgba(99,102,241,.18);border-color:var(--brand)!important;}
        /* плавающая пилюля рендера */
        .me-float-in{animation:meFloatIn .3s cubic-bezier(.34,1.56,.64,1);}
        @keyframes meFloatIn{from{opacity:0;transform:translateY(14px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
        .me-dot{animation:meDot 1.4s ease-in-out infinite;}
        @keyframes meDot{0%,100%{opacity:.3}50%{opacity:1}}
        .me-ready{animation:meReady 1.1s ease-in-out infinite;}
        @keyframes meReady{0%,100%{box-shadow:0 8px 26px rgba(16,185,129,.4);transform:scale(1)}50%{box-shadow:0 10px 40px rgba(16,185,129,.95);transform:scale(1.05)}}
        /* контур генерации: ПОД иконкой (z-index:-1), переливается (hue-rotate) + циклически «дышит» (scale) */
        .me-busyring{position:absolute;width:74px;height:74px;border-radius:50%;top:-8px;left:50%;transform:translateX(-50%);background:conic-gradient(from 0deg,#ec4899,#818cf8,#34d399,#fbbf24,#f472b6,#ec4899);animation:meShine 2.6s linear infinite, mePulse 1.7s ease-in-out infinite;-webkit-mask:radial-gradient(farthest-side,#0000 calc(100% - 3px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,#0000 calc(100% - 3px),#000 calc(100% - 3px));pointer-events:none;z-index:-1;will-change:transform,filter;}
        @keyframes meShine{0%{filter:hue-rotate(0deg) saturate(1.15)}50%{filter:hue-rotate(180deg) saturate(1.5)}100%{filter:hue-rotate(360deg) saturate(1.15)}}
        @keyframes mePulse{0%,100%{transform:translateX(-50%) scale(.78);opacity:.7}50%{transform:translateX(-50%) scale(1.08);opacity:1}}
        /* всплывающая подсказка при наведении (ⓘ) */
        .me-tip{position:relative;display:inline-flex;align-items:center;}
        .me-tip-pop{display:none;position:absolute;bottom:calc(100% + 8px);right:0;width:290px;padding:10px 12px;border-radius:10px;background:var(--bg-secondary);border:1px solid var(--border-medium);color:var(--text-secondary);font-size:11px;line-height:1.5;z-index:96;box-shadow:0 10px 30px rgba(0,0,0,.35);white-space:normal;text-align:left;}
        .me-tip:hover .me-tip-pop,.me-tip:focus-within .me-tip-pop{display:block;}
        /* раскрытие — пружинка (быстро, мультяшно) */
        .me-grow{animation:meGrow .26s cubic-bezier(.34,1.7,.5,1);transform-origin:bottom center;}
        @keyframes meGrow{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
        /* веер иконок процессов из плавающей «+» */
        .me-fan-item{animation:meFan .28s cubic-bezier(.34,1.6,.64,1) backwards;transition:transform .12s ease, border-color .12s ease;}
        @keyframes meFan{from{opacity:0;transform:translate(-16px,-16px) scale(.4)}to{opacity:1;transform:translate(0,0) scale(1)}}
        .me-fan-item:hover{border-color:var(--brand)!important;transform:scale(1.1);}
      `}</style>

      {/* Верхняя панель (в соло-режиме скрыта — виден только блок) */}
      {!soloBlock && (
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-medium)' }}>
        <button onClick={async () => { if (dirty) { try { await save(); } catch { /* */ } } onBack(); }} title="Назад" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><ArrowLeft size={16} /></button>
        {nameEdit ? (
          <input autoFocus value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            onBlur={() => { setNameEdit(false); save(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setNameEdit(false); save(); } }}
            className="text-base font-700 px-2 py-1 rounded-lg outline-none"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--brand)', maxWidth: 320 }} />
        ) : (
          <button onClick={() => setNameEdit(true)} title="Переименовать сценарий"
            className="inline-flex items-center gap-1.5 text-base font-700"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
            {name} <Pencil size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
        <div className="flex-1" />
        <button onClick={undo} disabled={!canUndo} title="Назад (Ctrl+Z)"
          className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: canUndo ? 'pointer' : 'not-allowed' }}><Undo2 size={15} /></button>
        <button onClick={redo} disabled={!canRedo} title="Вперёд (Ctrl+Shift+Z)"
          className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: canRedo ? 'pointer' : 'not-allowed' }}><Redo2 size={15} /></button>
        {/* Кнопка «Сохранить» убрана из шапки: автосохранение пишет правки само ~1.6с (+ сейв при «Назад»). */}
      </div>
      )}

      {/* Холст-паутина (в соло-режиме скрыт — блок открывается чистой панелью над Галереей) */}
      <div ref={canvasRef} className="flex-1" style={{ position: 'relative', overflow: 'hidden',
        ...(soloBlock ? { display: 'none' } : {
          background: 'radial-gradient(circle at 50% 42%, rgba(99,102,241,0.05), transparent 60%), var(--bg-primary)',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }) }}>

        {/* Центральная кнопка «Сценарий ролика» убрана: фича brief не читалась бэком
            (ИИ-режиссёр вырезан в v2.0.0). Центр холста оставлен пустым. */}

        {/* ── Облачные узлы + связи-стрелки ── */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} aria-hidden="true">
          {cloudEdges.map((e, i) => {
            const p = cloudPoint(e.from), q = cloudPoint(e.to);
            if (!p || !q) return null;
            return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--brand)" strokeWidth="0.35" strokeDasharray="1.4 0.9" />;
          })}
          {pending && (() => { const p = cloudPoint(pending.from); return p ? <line x1={p.x} y1={p.y} x2={pending.x} y2={pending.y} stroke="var(--brand)" strokeWidth="0.4" strokeDasharray="1.4 0.9" /> : null; })()}
        </svg>
        {cloudEdges.map((e, i) => {
          const p = cloudPoint(e.from), q = cloudPoint(e.to);
          if (!p || !q) return null;
          const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          return (
            <button key={'ce' + i} onClick={() => { setCloudEdges((es) => es.filter((_, j) => j !== i)); setDirty(true); }} title="Удалить связь"
              style={{ position: 'absolute', left: `${mx}%`, top: `${my}%`, transform: 'translate(-50%,-50%)', zIndex: 6, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--brand)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <X size={11} />
            </button>
          );
        })}
        {/* «Контент-план» скрыт до реализации (этап C): узел был пустым стабом. */}
        {(['omni', 'editor', 'ugc', 'hotebook', 'flow'] as CloudId[]).map((id) => {
          const pos = cloud[id] || CLOUD[id].def; const cfg = CLOUD[id];
          return (
            <div key={id} data-node-id={id} onPointerDown={() => { dragRef.current = id; movedRef.current = false; }}
              style={{ position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)', zIndex: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'grab', touchAction: 'none', userSelect: 'none' }}>
              {id === 'omni' && omniBusy && <span className="me-busyring" />}
              {id === 'ugc' && !!ugcBusy && <span className="me-busyring" />}
              {id === 'hotebook' && hbBusyAny && <span className="me-busyring" />}
              {id === 'flow' && !!commBusy && <span className="me-busyring" />}
              <button onClick={() => onCloudClick(id)} title={cfg.label}
                style={{ width: 58, height: 58, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: pending?.from === id ? 'var(--btn-primary-bg)' : 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))',
                  border: `2px solid ${pending?.from === id ? 'var(--brand)' : cfg.color}`, color: cfg.color, boxShadow: `0 6px 22px ${cfg.glow}`, cursor: 'pointer' }}>
                {cfg.icon}
              </button>
              {id === 'hotebook' && hbFreshDone && !hbBusyAny && (
                <span className="me-dot" title="Артефакт готов — открыт блок и Галерея → Hotebook" style={{ position: 'absolute', top: -3, left: -3, width: 15, height: 15, borderRadius: '50%', background: '#10b981', border: '2px solid var(--bg-primary)', boxShadow: '0 0 10px #10b981' }} />
              )}
              {id === 'flow' && commFreshDone && !commBusy && (
                <span className="me-dot" title="Ролик собран — откройте блок и Галерею → Google Flow" style={{ position: 'absolute', top: -3, left: -3, width: 15, height: 15, borderRadius: '50%', background: '#10b981', border: '2px solid var(--bg-primary)', boxShadow: '0 0 10px #10b981' }} />
              )}
              <span className="text-[11px]" style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', background: 'var(--bg-primary)', padding: '0 5px', borderRadius: 5 }}>{cfg.label}</span>
              <button onPointerDown={(e) => startConnect(id, e)} title="Потяните, чтобы провести стрелку"
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: pending?.from === id ? 'var(--brand)' : 'var(--bg-secondary)', border: '1px solid var(--brand)', color: pending?.from === id ? '#fff' : 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair', padding: 0, touchAction: 'none' }}>
                <Link2 size={11} />
              </button>
            </div>
          );
        })}
        {pending && (
          <div style={{ position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)', zIndex: 12, background: 'var(--bg-secondary)', border: '1px solid var(--brand)', borderRadius: 999, padding: '4px 12px', fontSize: 12, color: 'var(--brand)', fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Тяните к узлу и отпустите, чтобы связать
          </div>
        )}
      </div>


      {/* Выбор исходного видео */}
      {showSource && (
        <div onClick={() => setShowSource(false)} style={{ position: 'absolute', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', overflow: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 16, transform: 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Исходное видео</span>
              <button onClick={() => setShowSource(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {sourceUrl && (
              <button onClick={clearSource} className="text-xs mb-3" style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕ Убрать источник</button>
            )}
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
              Выберите исходное видео — оно станет входом для облачных блоков (Omni и др.).
            </p>
            {(() => {
              const SRC_TABS = ([['all', 'Все'], ['analyzed', 'Из анализа'], ['trend', 'Тренды'], ['reference', 'Референс']] as const)
                .filter(([k]) => k === 'all' || sources.some((s) => s.type === k));
              const q = srcQuery.trim().toLowerCase();
              const shown = sources.filter((s) => (srcTab === 'all' || s.type === srcTab) && (!q || (s.name || '').toLowerCase().includes(q)));
              return (
                <>
                  {SRC_TABS.length > 2 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {SRC_TABS.map(([k, lbl]) => (
                        <button key={k} onClick={() => setSrcTab(k)} className="text-[11px] font-600 px-2.5 py-1 rounded-lg" style={{ background: srcTab === k ? 'var(--brand)' : 'var(--bg-tertiary)', color: srcTab === k ? 'var(--brand-contrast)' : 'var(--text-secondary)', border: `1px solid ${srcTab === k ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>{lbl}</button>
                      ))}
                    </div>
                  )}
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={srcQuery} onChange={(e) => setSrcQuery(e.target.value)} placeholder="Поиск по названию…"
                      className="w-full py-1.5 rounded-lg text-[12px] outline-none" style={{ paddingLeft: 26, paddingRight: 8, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                  </div>
                  <input ref={srcUploadRef} type="file" accept="video/*" multiple style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files?.length) void uploadSourceVideo(e.target.files); }} />
                  <button onClick={() => srcUploadRef.current?.click()} disabled={srcUploading}
                    className="w-full mb-2 py-2 rounded-lg text-[12px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--brand)', border: '1px dashed var(--brand)', cursor: srcUploading ? 'not-allowed' : 'pointer' }}>
                    {srcUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} {srcUploading ? 'Загружаю…' : 'Добавить видео'}
                  </button>
                  <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>Найдено: {shown.length}</div>
                  {shown.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Ничего не найдено. Нажмите «Добавить видео» выше или скачайте тренды.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {shown.map((s) => (
                  <button key={s.url} onClick={() => selectSource(s)} className="rounded-xl overflow-hidden text-left" style={{ position: 'relative', background: 'var(--bg-tertiary)', border: `2px solid ${sourceUrl === s.url ? 'var(--brand)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                    {s.assetId && (
                      <span title="Есть анализ" style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--brand)', color: 'var(--brand-contrast)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}><Sparkles size={11} /></span>
                    )}
                    <div style={{ aspectRatio: '1 / 1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {s.thumb
                        ? <img src={s.thumb} alt="" className="w-full h-full object-cover" />
                        : <video src={`${s.url}#t=0.1`} muted preload="metadata" playsInline className="w-full h-full object-cover" />}
                    </div>
                    <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }}>{s.name}</div>
                  </button>
                ))}
              </div>
            )}
                </>
              );
            })()}
            {srcNote && <p className="text-[11px] mt-2" style={{ color: '#f59e0b' }}>{srcNote}</p>}
          </div>
        </div>
      )}

      {/* #3 Галерея своих картинок для старт-кадра окна: выбрать существующую ИЛИ загрузить новую */}
      {imgPick !== null && (() => {
        const seg = imgPick;
        const curSF = omniSpec.segments.find((s) => s.id === seg)?.startFrame || null;
        return (
          <GalleryPicker
            open token={token}
            title="Старт-кадр — своё фото"
            note="Выберите картинку (предмет/фон) как первый кадр — Omni оживит именно её. Или загрузите новую."
            defaultTab="reference"
            pickedKeys={curSF ? new Set([curSF]) : undefined}
            onClose={() => setImgPick(null)}
            onUpload={(files) => uploadToGallery(files, 'reference')}
            uploadAccept="image/*"
            onPick={(it) => { updateSeg(seg, { startFrame: it.fileUrl }); setOG(seg, { seed: null, note: 'Старт-кадр из галереи.' }); }}
          />
        );
      })()}

      {/* Попап «Сценарий ролика» удалён вместе с кнопками (brief не читается бэком). */}

      {/* UGC — полноэкранная студия (вместо модалки): состояние остаётся здесь, студия — представление */}
      {cloudPanel === 'ugc' && (
        <UgcStudio
          token={token}
          ugc={ugc} ugcMutate={ugcMutate}
          saving={saving} ugcSavedFlash={ugcSavedFlash} ugcSaveNow={ugcSaveNow}
          ugcBusy={ugcBusy} ugcNote={ugcNote}
          ugcAvatars={ugcAvatars} ugcAvLoading={ugcAvLoading}
          ugcAvBrief={ugcAvBrief} setUgcAvBrief={setUgcAvBrief} ugcAvNote={ugcAvNote}
          loadUgcAvatars={loadUgcAvatars} genUgcAvatars={genUgcAvatars}
          pickUgcAvatar={pickUgcAvatar} askDelUgcAvatar={askDelUgcAvatar}
          ugcDelAvatar={ugcDelAvatar} setUgcDelAvatar={setUgcDelAvatar} doDelUgcAvatar={doDelUgcAvatar}
          hgExt={hgExt}
          ugcGenScript={ugcGenScript} ugcRunDiarize={ugcRunDiarize} ugcBuildStart={ugcBuildStart}
          ugcScriptSec={ugcScriptSec}
          ugcPick={ugcPick} setUgcPick={setUgcPick} setUgcLineIdx={setUgcLineIdx}
          openUgcPick={openUgcPick} pickUgcItem={pickUgcItem}
          uploadToGallery={uploadToGallery}
          ugcResultAR={ugcResultAR} setUgcResultAR={setUgcResultAR}
          onClose={() => setCloudPanel(null)}
          flowName={name} onRenameFlow={(v) => { setName(v); setDirty(true); }}
          undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
          onExitSave={ugcExitWithTemplate}
        />
      )}

      {/* Hotebook — ПОЛНОЭКРАННАЯ студия (как NotebookLM: Источники · Чат · Студия), не модалка.
          Состояние/обработчики остаются здесь, студия — представление (зеркало UgcStudio). */}
      {cloudPanel === 'hotebook' && (
        <HotebookStudio
          hb={hb} hbMutate={hbMutate}
          hbStatus={hbStatus} hbSources={hbSources} hbJobs={hbJobs}
          hbCounters={hbCounters} hbArtifactCounts={hbArtifactCounts} hbLoading={hbLoading}
          hbNote={hbNote} hbOk={hbOk} hbSuggestions={hbSuggestions}
          hbSrcUrl={hbSrcUrl} setHbSrcUrl={setHbSrcUrl} hbSrcBusy={hbSrcBusy}
          hbChatQ={hbChatQ} setHbChatQ={setHbChatQ} hbChatBusy={hbChatBusy}
          hbPlayId={hbPlayId} setHbPlayId={setHbPlayId}
          hbRefreshStatus={hbRefreshStatus}
          hbAddUrl={() => void hbAddUrl()}
          setHbTextOpen={setHbTextOpen}
          hbOpenPick={() => void hbOpenPick()}
          hbDelSource={(sid) => void hbDelSource(sid)}
          hbAsk={() => void hbAsk()}
          hbOpenGen={hbOpenGen}
          setHbView={setHbView}
          onClose={() => setCloudPanel(null)}
          hbTypes={HB_TYPES}
          hbIcon={HB_ICON}
          hbLabel={HB_LABEL}
        />
      )}

      {/* Панель облачного узла (Omni / Контент-план) — каркас */}
      {cloudPanel && cloudPanel !== 'ugc' && cloudPanel !== 'hotebook' && (
        <div onClick={() => setCloudPanel(null)} style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: cloudPanel === 'plan' ? 460 : cloudPanel === 'hotebook' ? 680 : 600, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: CLOUD[cloudPanel].color }}>{CLOUD[cloudPanel].icon}</span> {CLOUD[cloudPanel].label}
              </span>
              <button onClick={() => setCloudPanel(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {cloudPanel === 'flow' ? (
              <FlowExtPanel token={token} flowId={flowId} omniSegments={omniSpec.segments}
                commState={flowComm} onCommChange={setFlowComm} onCommBuild={startCommentatorBuild} onCommDiarize={startCommentatorDiarize} commBusy={commBusy} />
            ) : cloudPanel === 'omni' ? (
              <div className="space-y-3.5">
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Преобразование видео по ленте. <b style={{ color: '#4285F4' }}>Omni Flash</b> — генерирует новый клип
                  со звуком (Gemini Omni Flash, 720p). <b style={{ color: '#a855f7' }}>V2V</b> — ре-стайл реального фрагмента (Runway/Kling).
                  Ключи — в <b style={{ color: 'var(--text-secondary)' }}>Enterprise → Генерация</b>.
                </p>

                {!sourceUrl ? (
                  <button onClick={() => { setCloudPanel(null); openSourcePicker(); }}
                    className="w-full py-3 rounded-xl text-sm font-600 inline-flex items-center justify-center gap-2"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--brand)', border: '1px dashed var(--brand)', cursor: 'pointer' }}>
                    <Video size={16} /> Сначала выберите исходное видео →
                  </button>
                ) : (
                  <>
                    {/* Превью исходника + иконка «работает» поверх видео во время генерации */}
                    <div style={{ position: 'relative' }}>
                      <video ref={srcVideoRef} src={sourceUrl} controls preload="metadata"
                        onLoadedMetadata={(e) => setSrcDuration(e.currentTarget.duration || 0)}
                        style={{ width: '100%', maxHeight: 190, borderRadius: 10, background: '#000', display: 'block' }} />
                      {omniBusy && (
                        <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.42)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
                          <Loader2 size={30} className="animate-spin" style={{ color: '#fff' }} />
                          <span className="text-[11px] font-700" style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>Преобразование…</span>
                        </div>
                      )}
                    </div>

                    {/* Интерактивная лента: перетаскивай окно (тело=сдвиг, края=длина). Omni — макс 10с. Живой предпросмотр. */}
                    <div>
                      <div ref={stripRef} className="relative w-full" style={{ height: 46, borderRadius: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}>
                        {[0.25, 0.5, 0.75].map((t) => (
                          <div key={t} style={{ position: 'absolute', left: `${t * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--border-medium)' }} />
                        ))}
                        {omniSpec.segments.map((g, i) => {
                          const col = g.engine === 'omni' ? '#4285F4' : '#a855f7';
                          const over = g.engine === 'omni' && winSecOf(g) > OMNI_MAX_SEC + 0.05;
                          return (
                            <div key={g.id}
                              onPointerDown={(e) => omniDragStart(e, g, 'move')} onPointerMove={omniDragMove} onPointerUp={omniDragEnd} onPointerCancel={omniDragEnd}
                              title="Перетащи — сдвиг · за края — длина"
                              style={{ position: 'absolute', top: 4, bottom: 4, left: `${g.start * 100}%`, width: `${Math.max(1.5, (g.end - g.start) * 100)}%`,
                                background: over ? 'rgba(239,68,68,0.92)' : `${col}e6`, borderRadius: 7, cursor: 'grab', touchAction: 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, boxShadow: '0 1px 5px rgba(0,0,0,0.28)' }}>
                              <div onPointerDown={(e) => omniDragStart(e, g, 'start')} onPointerMove={omniDragMove} onPointerUp={omniDragEnd} onPointerCancel={omniDragEnd}
                                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 13, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 3, height: '55%', background: '#fff', borderRadius: 2, opacity: 0.9 }} />
                              </div>
                              <span style={{ pointerEvents: 'none' }}>{i + 1}</span>
                              <div onPointerDown={(e) => omniDragStart(e, g, 'end')} onPointerMove={omniDragMove} onPointerUp={omniDragEnd} onPointerCancel={omniDragEnd}
                                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 13, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 3, height: '55%', background: '#fff', borderRadius: 2, opacity: 0.9 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>0с</span>
                        <span style={{ opacity: 0.8 }}>тяни окно · края = длина · Omni макс 10с</span>
                        <span>{srcDuration > 0 ? `${srcDuration.toFixed(0)}с` : '—'}</span>
                      </div>
                      <button onClick={() => addSegment()} disabled={omniSpec.segments.length >= 6}
                        className="w-full mt-2 py-2 rounded-xl text-[12px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px dashed var(--border-medium)', cursor: 'pointer' }}>
                        <Plus size={14} /> Добавить окно ({omniSpec.segments.length})
                      </button>
                    </div>

                    {/* Карточки кусков */}
                    <div className="space-y-2.5">
                      {omniSpec.segments.map((g, i) => (
                        <div key={g.id} className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-700 inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                              <span style={{ width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', background: g.engine === 'omni' ? '#4285F4' : '#a855f7' }}>{i + 1}</span>
                              Окно {i + 1}
                            </span>
                            {omniSpec.segments.length > 1 && (
                              <button onClick={() => removeSeg(g.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-secondary)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={13} /></button>
                            )}
                          </div>

                          {/* Окно на ленте (тянется на полоске сверху) */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span style={{ color: 'var(--text-muted)' }}>Окно: <b style={{ color: 'var(--text-secondary)' }}>{fmtT(g.start)}–{fmtT(g.end)}</b></span>
                            {g.engine === 'omni' && (
                              <span style={{ color: winSecOf(g) > OMNI_MAX_SEC + 0.05 ? '#ef4444' : '#4285F4', fontWeight: 700 }}>
                                {srcDuration > 0 ? `${winSecOf(g).toFixed(1)}с из макс 10с` : 'макс 10с'}
                              </span>
                            )}
                          </div>

                          {/* Движок: Omni Flash / V2V */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {([['omni', 'Omni Flash', '#4285F4', <Sparkles size={13} key="s" />], ['v2v', 'Ре-стайл (V2V)', '#a855f7', <Scissors size={13} key="c" />]] as [OmniEngine, string, string, React.ReactNode][]).map(([eng, lbl, col, ic]) => (
                              <button key={eng} onClick={() => updateSeg(g.id, { engine: eng })}
                                className="py-2 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 transition-all"
                                style={{ background: g.engine === eng ? col : 'var(--bg-secondary)', color: g.engine === eng ? '#fff' : 'var(--text-muted)', border: `1px solid ${g.engine === eng ? col : 'var(--border-medium)'}` }}>
                                {ic} {lbl}
                              </button>
                            ))}
                          </div>

                          {/* Промт «как» */}
                          <textarea value={g.prompt} onChange={(e) => updateSeg(g.id, { prompt: e.target.value })}
                            placeholder={g.engine === 'omni' ? 'Как сгенерировать: «киношный закат над городом, медленный пролёт…»' : 'Как переделать фрагмент: «в стиле аниме», «зимняя ночь», «акварель…»'}
                            rows={2}
                            className="w-full px-2.5 py-2 rounded-lg text-[12px] focus:outline-none resize-none"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />

                          {/* Параметры движка */}
                          {g.engine === 'omni' ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Длина = ширина окна. Без старт-кадра Omni берёт кадр выделенного фрагмента как контекст (сцена сохранится). Полная покадровая перерисовка — «Ре-стайл (V2V)».</span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Провайдер</span>
                              {(['runway', 'fal'] as V2VProvider[]).map((p) => (
                                <button key={p} onClick={() => updateSeg(g.id, { provider: p })}
                                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center gap-1.5"
                                  style={{ background: g.provider === p ? 'rgba(168,85,247,0.16)' : 'var(--bg-secondary)', color: g.provider === p ? '#a855f7' : 'var(--text-muted)', border: `1px solid ${g.provider === p ? '#a855f7' : 'var(--border-medium)'}` }}>
                                  <Film size={12} /> {V2V_LABEL[p]}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Omni Flash: раскадровка (Nano) → выбор кадра → генерация видео + чат-правка */}
                          {g.engine === 'omni' && (
                            <div className="space-y-2">
                              {/* #3 Старт-кадр: кадр из видео / загрузка / промт+картинка (Nano). Первый кадр для image_to_video. */}
                              <div className="rounded-lg p-2 space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
                                <div className="text-[10px] font-600" style={{ color: 'var(--text-secondary)' }}>Старт-кадр (первый кадр для оживления):</div>
                                <div className="grid grid-cols-3 gap-1.5">
                                  <button onClick={() => runExtractFrame(g)} disabled={!sourceUrl || omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy}
                                    className="py-1.5 rounded-lg text-[10px] font-600 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}
                                    title={sourceUrl ? 'Взять кадр исходника в позиции окна' : 'Сначала выберите исходное видео'}>
                                    <Film size={12} /> Из кадра видео
                                  </button>
                                  <button onClick={() => openStartFramePicker(g.id)} disabled={omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy}
                                    className="py-1.5 rounded-lg text-[10px] font-600 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}
                                    title="Выбрать из своих картинок или загрузить новую">
                                    <UploadCloud size={12} /> Загрузить
                                  </button>
                                  <button onClick={() => runPromptImage(g)} disabled={!g.startFrame || !g.prompt.trim() || omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy}
                                    className="py-1.5 rounded-lg text-[10px] font-600 inline-flex items-center justify-center gap-1 disabled:opacity-50"
                                    style={{ background: 'var(--bg-tertiary)', color: '#4285F4', border: '1px solid rgba(66,133,244,0.4)', cursor: 'pointer' }}
                                    title="Перерисовать текущий старт-кадр по промту (Nano img2img)">
                                    <Sparkles size={12} /> Промт+картинка
                                  </button>
                                </div>
                                {omniGen[g.id]?.fbBusy && <div className="text-[10px] inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Loader2 size={11} className="animate-spin" /> Готовлю кадр…</div>}
                                {g.startFrame && (
                                  <div className="flex items-center gap-2">
                                    <img src={g.startFrame} alt="старт-кадр" style={{ width: 40, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 6, border: '2px solid #4285F4' }} />
                                    <span className="text-[10px]" style={{ color: '#4285F4', fontWeight: 700 }}>Старт-кадр задан</span>
                                    <button onClick={() => { updateSeg(g.id, { startFrame: null }); setOG(g.id, { seed: null }); }}
                                      className="ml-auto w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: '#ef4444', border: 'none', cursor: 'pointer' }} title="Убрать старт-кадр"><X size={12} /></button>
                                  </div>
                                )}
                              </div>
                              {/* Шаг 1: дешёвая раскадровка перед видео */}
                              <button onClick={() => runStoryboard(g)} disabled={omniGen[g.id]?.sbBusy || omniGen[g.id]?.busy}
                                className="w-full py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                                style={{ background: 'var(--bg-secondary)', color: '#4285F4', border: '1px solid rgba(66,133,244,0.4)', cursor: 'pointer' }}>
                                {omniGen[g.id]?.sbBusy ? <Loader2 size={13} className="animate-spin" /> : <Image size={13} />} {omniGen[g.id]?.sbBusy ? 'Рисую кадры…' : 'Раскадровка (Nano, ~$0.10) — увидеть до видео'}
                              </button>
                              {!!omniGen[g.id]?.frames?.length && (
                                <div>
                                  <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Выберите кадр — Omni оживит именно его:</div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {omniGen[g.id]!.frames!.map((f) => { const sel = omniGen[g.id]?.seed === f; return (
                                      <button key={f} onClick={() => { const nv = sel ? null : f; setOG(g.id, { seed: nv }); updateSeg(g.id, { startFrame: nv }); }} className="rounded-lg overflow-hidden" style={{ border: `2px solid ${sel ? '#4285F4' : 'var(--border-medium)'}`, cursor: 'pointer', padding: 0, position: 'relative' }}>
                                        <img src={f} alt="" className="w-full" style={{ aspectRatio: '9 / 16', objectFit: 'cover', display: 'block' }} />
                                        {sel && <span style={{ position: 'absolute', top: 2, right: 2, background: '#4285F4', color: '#fff', borderRadius: 6, padding: '0 4px', fontSize: 9, fontWeight: 700 }}>✓</span>}
                                      </button>
                                    ); })}
                                  </div>
                                </div>
                              )}
                              {/* Шаг 2: оживить (выбранный кадр = старт, иначе текст→видео) */}
                              <button onClick={() => runOmniGen(g)} disabled={omniGen[g.id]?.busy}
                                className="w-full py-2 rounded-lg text-[12px] font-700 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                                style={{ background: '#4285F4', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                {omniGen[g.id]?.busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {omniGen[g.id]?.busy ? 'Генерирую… (~30–60с)' : ((g.startFrame || omniGen[g.id]?.seed) ? 'Оживить старт-кадр (Omni Flash)' : 'Сгенерировать (Omni Flash)')}
                              </button>
                              {omniGen[g.id]?.note && <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{omniGen[g.id]?.note}</p>}
                              {omniGen[g.id]?.url && (
                                <>
                                  <video src={omniGen[g.id]!.url!} controls className="w-full rounded-lg" style={{ aspectRatio: '9 / 16', background: '#000', maxHeight: 320 }} />
                                  {omniGen[g.id]?.interactionId && (
                                    <div className="flex items-center gap-1.5">
                                      <input value={omniGen[g.id]?.edit || ''} onChange={(e) => setOG(g.id, { edit: e.target.value })}
                                        placeholder="Правка чатом: «поменяй цвет машины на красный»"
                                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] outline-none" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                                      <button onClick={() => runOmniEdit(g)} disabled={omniGen[g.id]?.busy || !(omniGen[g.id]?.edit || '').trim()}
                                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-700 disabled:opacity-50" style={{ background: '#4285F4', color: '#fff', border: 'none', cursor: 'pointer' }}>Править</button>
                                    </div>
                                  )}
                                  {/* #4: оставить последний кадр → новое окно (сшивка-продолжение следующих 10с) */}
                                  <button onClick={() => runContinue(g)} disabled={omniGen[g.id]?.fbBusy || omniGen[g.id]?.busy || omniSpec.segments.length >= 6}
                                    className="w-full py-1.5 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    style={{ background: 'var(--bg-secondary)', color: '#4285F4', border: '1px solid rgba(66,133,244,0.4)', cursor: 'pointer' }}
                                    title="Взять последний кадр клипа как старт нового окна — продолжение">
                                    {omniGen[g.id]?.fbBusy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Последний кадр → новое окно
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>

                    {/* Сводка + стоимость */}
                    <div className="rounded-xl p-3 text-[11px] space-y-1" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {omniGenSeconds > 0 && (
                        <div>Omni Flash: <b style={{ color: 'var(--text-secondary)' }}>{omniGenSeconds.toFixed(0)}с</b> ≈ ${(omniGenSeconds * 0.10).toFixed(2)} <span style={{ opacity: 0.7 }}>(Gemini Omni Flash, 720p, со звуком, ~$0.10/с)</span></div>
                      )}
                      {omniSpec.segments.some((g) => g.engine === 'v2v') && (
                        <div>V2V ре-стайл: по тарифу провайдера (Runway/Kling).</div>
                      )}
                      <div style={{ opacity: 0.8 }}>Спецификация сохраняется в сценарий. Реальная генерация (вызов Veo/Runway и склейка в монтаж) — следующий деплой; нужны ключи в Enterprise → Генерация.</div>
                    </div>

                    <button onClick={() => { save(); setCloudPanel(null); }}
                      className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2"
                      style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: '1px solid var(--brand)', cursor: 'pointer' }}>
                      <Save size={15} /> Сохранить преобразование
                    </button>
                  </>
                )}
              </div>
            ) : cloudPanel === 'editor' ? (
              <div className="space-y-3">
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Просмотр и обрезка видео или аудио: обрезать начало/конец, вырезать куски, повернуть (видео),
                  склеить несколько роликов. Сохранение неразрушающее — результат уходит в Галерею.
                </p>

                {editorClips.length > 0 && (
                  <div className="space-y-1.5">
                    {editorClips.map((c, i) => (
                      <div key={c.url} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <span className="text-[11px] font-700" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                        {c.type === 'audio' ? <Music size={13} style={{ color: 'var(--brand)', flexShrink: 0 }} /> : <Video size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-primary)' }} title={c.name}>{c.name}</span>
                        <button onClick={() => setEditorView(c)} title="Открыть в редакторе" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}><Scissors size={13} /></button>
                        <button onClick={() => removeEditorClip(c.url)} title="Убрать" className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {editorClips.length === 1 && (
                  <button onClick={() => setEditorView(editorClips[0])} className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2"
                    style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                    <Film size={16} /> Открыть редактор
                  </button>
                )}
                {editorClips.length >= 2 && (
                  <button onClick={mergeEditorClips} disabled={editorMerging} className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' }}>
                    {editorMerging ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />} Склеить {editorClips.length} видео
                  </button>
                )}
                {editorNote && <p className="text-[11px]" style={{ color: '#ef4444' }}>{editorNote}</p>}

                {editorResult && (
                  <div className="p-2.5 rounded-xl space-y-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                    <div className="text-xs font-600 inline-flex items-center gap-1.5" style={{ color: '#10b981' }}><Check size={14} /> Результат в Галерее</div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditorView(editorResult)} className="flex-1 py-2 rounded-lg text-xs font-600 inline-flex items-center justify-center gap-1.5" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}><Film size={13} /> Открыть</button>
                      <a href={editorResult.url} target="_blank" rel="noreferrer" className="flex-1 py-2 rounded-lg text-xs font-600 inline-flex items-center justify-center gap-1.5" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', textDecoration: 'none' }}><Download size={13} /> Скачать</a>
                    </div>
                  </div>
                )}

                {editorPick && (
                  <GalleryPicker
                    open multi token={token}
                    title="Из Галереи — добавить в редактор"
                    note="Клик добавляет клип; можно выбрать несколько. Видео и аудио."
                    defaultTab="reference"
                    pickedKeys={new Set(editorClips.map((c) => c.url))}
                    onClose={() => setEditorPick(false)}
                    onUpload={(files) => uploadToGallery(files)}
                    onPick={(it) => addEditorClip({ url: it.fileUrl, name: it.title, type: it.type === 'audio' ? 'audio' : 'video' })}
                  />
                )}
              </div>
            ) : cloudPanel === 'hotebook' ? (
              <div className="space-y-3">
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Google NotebookLM внутри сценария: добавьте <b style={{ color: '#22d3ee' }}>источники</b>, спрашивайте в чате
                  и собирайте артефакты — аудио, видео, отчёты, тесты… Готовое падает в <b>Галерею → «Hotebook»</b>.
                </p>

                {/* Название проекта: имя для всех сгенерированных файлов (аудио/презентация/…) */}
                <div>
                  <div className="text-[11px] font-600 mb-1" style={{ color: 'var(--text-muted)' }}>Название (им будут подписаны готовые файлы)</div>
                  <input value={hb.name || ''} onChange={(e) => hbMutate((h) => ({ ...h, name: e.target.value }))}
                    placeholder="Напр.: Обзор про WordPress"
                    className="w-full px-3 py-2 rounded-lg text-sm font-600 outline-none"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                  {(hb.name || '').trim() && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Файлы появятся как «{(hb.name || '').trim()} — Аудиопересказ», «{(hb.name || '').trim()} — Презентация» и т.д.
                    </p>
                  )}
                </div>

                {/* Плашка подключения расширения (ext_offline / ext_login) */}
                {hbStatus && !hbStatus.ok && (
                  <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.45)' }}>
                    <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-700" style={{ color: '#f59e0b' }}>
                        {hbStatus.errorKind === 'ext_offline' ? 'Расширение Hotebook не на связи'
                          : hbStatus.errorKind === 'ext_login' ? 'Нужен вход в Google (NotebookLM)'
                          : 'Синхронизация не работает'}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {hbStatus.errorKind === 'ext_offline' ? 'Установите единое расширение TrendTraffic (Настройки → «Генерация») и откройте вкладку notebooklm.google.com в этом браузере.'
                          : hbStatus.errorKind === 'ext_login' ? 'Расширение на связи, но вход в notebooklm.google.com не выполнен. Откройте сайт и войдите в свой Google-аккаунт.'
                          : 'Проверьте расширение и открытую вкладку NotebookLM, затем нажмите «Проверить».'}
                      </p>
                      <div className="flex gap-1.5 mt-1.5">
                        <button onClick={() => void hbRefreshStatus(true)} className="inline-flex items-center gap-1 text-[11px] font-600 px-2 py-1 rounded-lg"
                          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <RefreshCw size={11} /> Проверить
                        </button>
                        <button onClick={() => window.open('https://notebooklm.google.com', '_blank', 'noopener')} className="inline-flex items-center gap-1 text-[11px] font-600 px-2 py-1 rounded-lg"
                          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--brand)', cursor: 'pointer' }}>
                          <ExternalLink size={11} /> Открыть NotebookLM
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {hbStatus?.ok && (
                  <div className="text-[10px] inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Check size={11} style={{ color: '#10b981' }} /> Расширение подключено, NotebookLM открыт
                  </div>
                )}

                {/* Источники */}
                <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                  <div className="text-[11px] font-700 inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Globe size={13} style={{ color: '#22d3ee' }} /> ИСТОЧНИКИ {hbSources.length > 0 && `· ${hbSources.length}`}
                    {hbLoading && <Loader2 size={11} className="animate-spin" />}
                  </div>
                  {hbSources.length > 0 && (
                    <div className="space-y-1" style={{ maxHeight: 150, overflowY: 'auto' }}>
                      {hbSources.map((s: any, i: number) => {
                        const sid = s.id || s.source_id || String(i);
                        const title = s.title || s.name || s.url || 'источник';
                        return (
                          <div key={sid} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                            <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span className="text-[11px] truncate flex-1" style={{ color: 'var(--text-primary)' }} title={title}>{title}</span>
                            <button onClick={() => void hbDelSource(sid)} title="Удалить источник" className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: 'none', cursor: 'pointer' }}><X size={11} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <input value={hbSrcUrl} onChange={(e) => setHbSrcUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void hbAddUrl(); }}
                      placeholder="Ссылка: статья, сайт или YouTube…" className="flex-1 px-2.5 py-2 rounded-lg text-xs outline-none"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                    <button onClick={() => void hbAddUrl()} disabled={hbSrcBusy || !hbSrcUrl.trim()} title="Добавить ссылку"
                      className="px-3 rounded-lg text-xs font-700 inline-flex items-center gap-1 disabled:opacity-50"
                      style={{ background: '#22d3ee', color: '#083344', border: 'none', cursor: 'pointer' }}>
                      {hbSrcBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setHbTextOpen(true)} disabled={hbSrcBusy}
                      className="flex-1 py-2 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <Type size={12} /> Вставить текст
                    </button>
                    <button onClick={() => void hbOpenPick()} disabled={hbSrcBusy}
                      className="flex-1 py-2 rounded-lg text-[11px] font-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <Paperclip size={12} /> Файл из Галереи
                    </button>
                  </div>
                  {hbOk && (
                    <p className="text-[11px] inline-flex items-center gap-1.5" style={{ color: '#10b981' }}>
                      <Check size={12} /> {hbOk}
                    </p>
                  )}
                </div>

                {/* Чат по источникам */}
                <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-700 inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <Sparkles size={13} style={{ color: '#22d3ee' }} /> ЧАТ ПО ИСТОЧНИКАМ
                    </span>
                    {hb.chat.length > 0 && (
                      <button onClick={() => hbMutate((h) => ({ ...h, chat: [] }))} title="Очистить историю"
                        className="text-[10px] font-600" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>очистить</button>
                    )}
                  </div>
                  {hb.chat.length > 0 && (
                    <div className="space-y-2.5" style={{ maxHeight: '42vh', overflowY: 'auto' }}>
                      {hb.chat.map((m, i) => (
                        <div key={i} className="space-y-1">
                          <div className="text-xs px-3 py-2 rounded-xl ml-6" style={{ background: 'rgba(34,211,238,0.12)', color: 'var(--text-primary)' }}>{m.q}</div>
                          <div className="text-xs px-3 py-2 rounded-xl mr-2 leading-relaxed" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            {m.pending
                              ? <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}><Loader2 size={12} className="animate-spin" /> думает…</span>
                              : <><HbMarkdown text={m.a} />{!!m.cites && <div className="text-[10px] mt-1.5 font-700" style={{ color: '#22d3ee' }}>⌘ {m.cites} цитат из источников</div>}</>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Подсказки-продолжения из NotebookLM — клик подставляет вопрос в поле. */}
                  {hbSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {hbSuggestions.map((s, i) => (
                        <button key={i} type="button" onClick={() => setHbChatQ(s)} title="Подставить вопрос"
                          className="text-[11px] px-2.5 py-1.5 rounded-full text-left transition-opacity hover:opacity-80"
                          style={{ background: 'rgba(34,211,238,0.10)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.35)', cursor: 'pointer' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1.5 items-end">
                    <textarea value={hbChatQ} onChange={(e) => setHbChatQ(e.target.value)} rows={4}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void hbAsk(); } }}
                      placeholder={hbSources.length ? 'Спросите о ваших источниках… (Enter — отправить, Shift+Enter — новая строка)' : 'Сначала добавьте источники…'}
                      className="flex-1 px-3 py-2.5 rounded-lg text-xs outline-none resize-y leading-relaxed"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', minHeight: 88, maxHeight: 320 }} />
                    <button onClick={() => void hbAsk()} disabled={hbChatBusy || !hbChatQ.trim()} title="Спросить"
                      className="w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                      style={{ background: '#22d3ee', color: '#083344', border: 'none', cursor: 'pointer' }}>
                      {hbChatBusy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>

                {/* Студия: 9 типов артефактов */}
                <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-700 inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                      <Wand2 size={13} style={{ color: '#22d3ee' }} /> СТУДИЯ
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Сегодня: {Object.values(hbCounters).reduce((s, n) => s + (n || 0), 0)} генераций
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {HB_TYPES.map(({ t, label }) => {
                      const made = hbArtifactCounts[t] || 0; // готово за всё время
                      const gen = hbJobs.some((j: any) => j.type === t && (j.status === 'queued' || j.status === 'running'));
                      return (
                        <button key={t} onClick={() => hbOpenGen(t)} title={`Настроить и сгенерировать: ${label}${made ? ` · сделано: ${made}` : ''}`}
                          className="relative rounded-xl px-1.5 py-2.5 flex flex-col items-center gap-1"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <span style={{ color: '#22d3ee' }}>{HB_ICON[t]}</span>
                          <span className="text-[10px] font-600 leading-tight text-center">{label}</span>
                          {/* индикатор: «генерится» (спиннер) ИЛИ счётчик готовых за всё время */}
                          {gen
                            ? <span className="absolute top-1 right-1"><Loader2 size={11} className="animate-spin" style={{ color: '#22d3ee' }} /></span>
                            : made > 0 && <span className="absolute top-1 right-1 text-[9px] font-700 px-1 rounded" style={{ background: 'rgba(34,211,238,0.18)', color: '#22d3ee' }}>{made}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Артефакты сценария */}
                {hbJobs.length > 0 && (
                  <div className="rounded-xl p-2.5 space-y-1.5" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                    <div className="text-[11px] font-700" style={{ color: 'var(--text-muted)' }}>АРТЕФАКТЫ</div>
                    {hbJobs.map((j: any) => {
                      const jt = j.type as HbType;
                      const running = j.status === 'queued' || j.status === 'running';
                      const isJson = ['quiz', 'flashcards', 'mindmap', 'table'].includes(jt);
                      const isAudio = jt === 'audio';
                      const isVideo = jt === 'video';
                      const playable = (isAudio || isVideo) && j.status === 'done' && !!j.fileUrl;
                      const open = hbPlayId === j.id;
                      return (
                        <div key={j.id} className="rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                          <div className="flex items-center gap-2 px-2 py-1.5">
                            <span style={{ color: '#22d3ee', flexShrink: 0 }}>{HB_ICON[jt] || <FileText size={15} />}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-600 truncate" style={{ color: 'var(--text-primary)' }}>{HB_LABEL[jt] || jt}</div>
                              <div className="text-[9px]" style={{ color: j.status === 'error' ? '#ef4444' : 'var(--text-muted)' }} title={j.error || undefined}>
                                {running ? 'Генерируется… (можно закрыть панель)' : j.status === 'error' ? (j.error || 'Ошибка') : `Готово · ${new Date(j.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                              </div>
                            </div>
                            {running && <Loader2 size={14} className="animate-spin" style={{ color: '#22d3ee', flexShrink: 0 }} />}
                            {/* Аудио/видео — слушать/смотреть ПРЯМО ЗДЕСЬ (не в новой вкладке) */}
                            {playable && (
                              <button onClick={() => setHbPlayId(open ? null : j.id)} className="text-[10px] font-700 px-2 py-1 rounded-lg flex-shrink-0 inline-flex items-center gap-1"
                                style={{ background: open ? 'var(--bg-tertiary)' : '#22d3ee', color: open ? 'var(--text-secondary)' : '#083344', border: 'none', cursor: 'pointer' }}>
                                {open ? <><X size={11} /> Свернуть</> : <><Play size={11} /> {isAudio ? 'Слушать' : 'Смотреть'}</>}
                              </button>
                            )}
                            {j.status === 'done' && isJson && j.payload && (
                              <button onClick={() => setHbView(j)} className="text-[10px] font-700 px-2 py-1 rounded-lg flex-shrink-0"
                                style={{ background: '#22d3ee', color: '#083344', border: 'none', cursor: 'pointer' }}>Открыть</button>
                            )}
                            {j.status === 'done' && j.fileUrl && !isJson && !playable && (
                              <a href={j.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] font-700 px-2 py-1 rounded-lg flex-shrink-0"
                                style={{ background: '#22d3ee', color: '#083344', textDecoration: 'none' }}>Открыть</a>
                            )}
                            {j.status === 'done' && j.fileUrl && (
                              <a href={j.fileUrl} download className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" title="Скачать"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><Download size={11} /></a>
                            )}
                          </div>
                          {/* Инлайн-плеер */}
                          {playable && open && (
                            <div className="px-2 pb-2">
                              {isAudio
                                ? <AudioPlayer src={j.fileUrl} />
                                : <video src={j.fileUrl} controls autoPlay className="w-full rounded-lg" style={{ maxHeight: 260, background: '#000' }} />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Все готовые файлы также лежат в Галерее → вкладка «Hotebook».</p>
                  </div>
                )}

                {hbNote && <p className="text-[11px]" style={{ color: '#ef4444' }}>{hbNote}</p>}
              </div>
            ) : (
              <div className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <p><b>Контент-план</b> — расписание и публикация готовых роликов по соцсетям.</p>
                <p style={{ color: 'var(--text-muted)' }}>Календарь + публикатор — этап C. Сейчас узел можно связывать: по стрелке сюда попадёт готовое видео из цепочки.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hotebook: модалка настроек генерации — 1:1 как в NotebookLM (формат-карточки, длина, язык, акцент) */}
      {hbGenOpen && (() => {
        const cfg = HB_TYPES.find((x) => x.t === hbGenOpen)!;
        return (
          <div onClick={() => setHbGenOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
            <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 640, maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: '#22d3ee' }}>{HB_ICON[hbGenOpen]}</span> Настройка — {cfg.label}
                </span>
                <button onClick={() => setHbGenOpen(null)} title="Закрыть" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>
              <div className="space-y-3.5">
                {cfg.fields.map((f) => (
                  <div key={f.id}>
                    <div className="text-[12px] font-600 mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</div>
                    {f.kind === 'cards' && (
                      <div className="grid grid-cols-2 gap-2">
                        {f.opts!.map((o) => {
                          const sel = hbGenSet[f.id] === o.v;
                          return (
                            <button key={o.v} onClick={() => setHbGenSet((s) => ({ ...s, [f.id]: o.v }))}
                              className="rounded-xl p-3 text-left transition-colors"
                              style={{ background: sel ? 'rgba(34,211,238,0.10)' : 'var(--bg-tertiary)', border: `1.5px solid ${sel ? '#22d3ee' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                              <div className="text-xs font-700 inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                {o.label} {sel && <Check size={13} style={{ color: '#22d3ee' }} />}
                              </div>
                              {o.hint && <p className="text-[10px] mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>{o.hint}</p>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {f.kind === 'chips' && (
                      <div className="flex flex-wrap gap-1.5">
                        {f.opts!.map((o) => {
                          const sel = hbGenSet[f.id] === o.v;
                          return (
                            <button key={o.v} onClick={() => setHbGenSet((s) => ({ ...s, [f.id]: o.v }))}
                              className="inline-flex items-center gap-1 text-xs font-600 px-2.5 py-1.5 rounded-lg"
                              style={{ background: sel ? '#22d3ee' : 'var(--bg-tertiary)', color: sel ? '#083344' : 'var(--text-secondary)', border: `1px solid ${sel ? '#22d3ee' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                              {sel && <Check size={12} />}{o.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {f.kind === 'lang' && (
                      <select value={hbGenSet[f.id] || 'ru'} onChange={(e) => setHbGenSet((s) => ({ ...s, [f.id]: e.target.value }))}
                        className="px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', minWidth: 180 }}>
                        {HB_LANGS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
                      </select>
                    )}
                    {f.kind === 'focus' && (
                      <textarea value={hbGenSet[f.id] || ''} onChange={(e) => setHbGenSet((s) => ({ ...s, [f.id]: e.target.value }))}
                        rows={3} placeholder={f.ph || ''} className="w-full px-2.5 py-2 rounded-lg text-xs outline-none resize-none"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Сегодня этого типа: {hbCounters[hbGenOpen] || 0} · лимит зависит от плана Google-аккаунта
                </span>
                <button onClick={() => void hbGenerate()} disabled={hbGenBusy}
                  className="inline-flex items-center gap-2 text-sm font-700 px-4 py-2.5 rounded-xl disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#06b6d4,#22d3ee)', color: '#083344', border: 'none', cursor: 'pointer' }}>
                  {hbGenBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Сгенерировать
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hotebook: модалка «Вставить текст-источник» */}
      {hbTextOpen && (
        <div onClick={() => setHbTextOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Текст-источник</span>
              <button onClick={() => setHbTextOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <textarea value={hbSrcText} onChange={(e) => setHbSrcText(e.target.value)} rows={9} autoFocus
              placeholder="Вставьте текст: заметки, сценарий, статью…"
              className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none mb-3"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
            <button onClick={() => void hbAddText()} disabled={hbSrcBusy || !hbSrcText.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#22d3ee', color: '#083344', border: 'none', cursor: 'pointer' }}>
              {hbSrcBusy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Добавить в источники
            </button>
          </div>
        </div>
      )}

      {/* Hotebook: пикер файла-источника из Галереи */}
      {hbPickOpen && (
        <div onClick={() => setHbPickOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Файл из Галереи → источник</span>
              <button onClick={() => setHbPickOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>NotebookLM понимает PDF, текст, аудио, видео и изображения. Клик по имени — добавить сам файл. У файлов «Из анализа»: <b>видео + анализ</b> добавит и видео, и его разбор (двумя источниками), либо <b>анализ</b> — только разбор текстом.</p>
            {/* Вкладки-папки как в Галерее (TrendFlow / Аудио / Из анализа) */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg mb-2" style={{ background: 'var(--bg-tertiary)' }}>
              {([
                { key: 'reference' as EdCat, label: 'TrendFlow', icon: <Image size={13} /> },
                { key: 'audio' as EdCat, label: 'Аудио', icon: <Music size={13} /> },
                { key: 'analyzed' as EdCat, label: 'Из анализа', icon: <Sparkles size={13} /> },
              ]).map((tb) => {
                const n = hbGallery.filter((g) => g.cat === tb.key).length;
                const active = hbPickTab === tb.key;
                return (
                  <button key={tb.key} onClick={() => setHbPickTab(tb.key)}
                    className="inline-flex items-center justify-center gap-1 px-1 py-1.5 rounded-md text-[11px] font-600 whitespace-nowrap"
                    style={{ background: active ? '#22d3ee' : 'transparent', color: active ? '#083344' : 'var(--text-muted)' }}>
                    {tb.icon}<span className="truncate">{tb.label}</span>{n > 0 && <span style={{ opacity: 0.7 }}>{n}</span>}
                  </button>
                );
              })}
            </div>
            {/* Поиск */}
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input value={hbPickQuery} onChange={(e) => setHbPickQuery(e.target.value)} placeholder="Поиск по имени…"
                className="w-full pl-8 pr-2 py-2 rounded-lg text-xs outline-none"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
            </div>
            {hbGalLoading ? (
              <div className="py-8 text-center"><Loader2 size={18} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
            ) : (() => {
              const filtered = hbGallery.filter((g) => g.cat === hbPickTab
                && (!hbPickQuery.trim() || g.name.toLowerCase().includes(hbPickQuery.trim().toLowerCase())));
              if (filtered.length === 0) return <p className="text-[11px] py-6 text-center" style={{ color: 'var(--text-muted)' }}>{hbPickQuery.trim() ? 'Ничего не найдено.' : 'В этой папке пусто.'}</p>;
              return (
                <>
                  <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>Найдено: {filtered.length} · клик по превью — добавить файл</div>
                  <div className="grid grid-cols-3 gap-2" style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {filtered.map((g) => (
                      <div key={`${g.cat}:${g.id}`} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
                        {/* Превью — клик добавляет сам файл источником */}
                        <button onClick={() => void hbAddAsset(g.id)} disabled={hbSrcBusy} title={`Добавить файл: ${g.name}`}
                          className="block w-full text-left disabled:opacity-50" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          <div className="relative flex items-center justify-center" style={{ aspectRatio: '1 / 1', background: '#000' }}>
                            {g.type === 'audio'
                              ? <Music size={30} style={{ color: '#22d3ee' }} />
                              : g.type === 'image'
                                ? <img src={g.url} alt="" className="w-full h-full object-cover" />
                                : g.type === 'video'
                                  ? (g.cover ? <img src={g.cover} alt="" className="w-full h-full object-cover" /> : <video src={`${g.url}#t=0.1`} muted preload="metadata" className="w-full h-full object-cover" />)
                                  : <FileText size={28} style={{ color: '#22d3ee' }} />}
                            {g.type === 'audio' && <span className="absolute bottom-1 left-1 text-[8px] font-700 px-1 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>АУДИО</span>}
                            {g.cat === 'analyzed' && <span className="absolute top-1 left-1 text-[8px] font-700 px-1 rounded inline-flex items-center gap-0.5" style={{ background: 'rgba(34,211,238,0.92)', color: '#083344' }}><Sparkles size={9} /> анализ</span>}
                            {hbPickedIds.has(g.id) && <span className="absolute top-1 right-1 w-5 h-5 rounded-md flex items-center justify-center" style={{ background: '#10b981', color: '#fff' }}><Check size={12} /></span>}
                          </div>
                          <div className="text-[10px] px-1.5 py-1 truncate" style={{ color: 'var(--text-secondary)' }} title={g.name}>{g.name}</div>
                        </button>
                        {/* «Из анализа»: добавить видео+анализ или только анализ */}
                        {g.cat === 'analyzed' && (
                          <div className="flex gap-1 px-1.5 pb-1.5">
                            <button onClick={() => void hbAddBoth(g.id, g.name)} disabled={hbSrcBusy} title="Добавить видео + его анализ (двумя источниками)"
                              className="flex-1 text-[9px] font-700 py-1 rounded-md disabled:opacity-50 inline-flex items-center justify-center gap-0.5"
                              style={{ background: '#22d3ee', color: '#083344', border: 'none', cursor: 'pointer' }}>
                              <Sparkles size={9} /> видео+анализ
                            </button>
                            <button onClick={() => void hbAddAnalysis(g.id, g.name)} disabled={hbSrcBusy} title="Добавить только анализ (текстом)"
                              className="text-[9px] font-700 px-1.5 py-1 rounded-md disabled:opacity-50"
                              style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: 'none', cursor: 'pointer' }}>
                              анализ
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
            {/* Пикер не закрывается после добавления — можно добавить несколько; ✓ на добавленных */}
            <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid var(--border-medium)' }}>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{hbPickedIds.size > 0 ? `Добавлено: ${hbPickedIds.size}` : 'Можно добавить несколько файлов'}</span>
              <button onClick={() => setHbPickOpen(false)} className="text-xs font-700 px-4 py-2 rounded-lg" style={{ background: '#22d3ee', color: '#083344', border: 'none', cursor: 'pointer' }}>Готово</button>
            </div>
          </div>
        </div>
      )}

      {/* Hotebook: просмотр артефакта (тест / карточки / ментальная карта / таблица) */}
      {hbView && (
        <div onClick={() => setHbView(null)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div onClick={(e) => e.stopPropagation()} className="me-pop-in" style={{ width: '100%', maxWidth: 640, maxHeight: '86vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 18, transform: 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-2 text-base font-700" style={{ color: 'var(--text-primary)' }}>
                <span style={{ color: '#22d3ee' }}>{HB_ICON[hbView.type as HbType]}</span> {HB_LABEL[hbView.type as HbType] || 'Артефакт'}
              </span>
              <div className="flex items-center gap-1.5">
                {hbView.fileUrl && (
                  <a href={hbView.fileUrl} download className="w-8 h-8 rounded-lg flex items-center justify-center" title="Скачать файл"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><Download size={14} /></a>
                )}
                <button onClick={() => setHbView(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            </div>
            <HbPayloadView job={hbView} />
          </div>
        </div>
      )}

      {/* Единый просмотрщик-редактор видео (плеер + обрезка), вызывается из облака «Редактор» */}
      <VideoViewer
        open={!!editorView}
        url={editorView?.url || ''}
        title={editorView?.name}
        kind={editorView?.type}
        onClose={() => setEditorView(null)}
        onSaved={async (r) => {
          const t = editorView?.type === 'audio' ? 'audio' : 'video';
          setEditorResult({ url: r.fileUrl, name: t === 'audio' ? 'Обрезанное аудио' : 'Обрезанное видео', type: t }); setDirty(true);
          // Обновить Галерею в пикере, чтобы обрезанный файл сразу появился, и открыть его вкладку.
          await loadEditorGallery();
          setEditorTab(t === 'audio' ? 'audio' : 'reference');
        }}
      />

    </div>
  );
}
