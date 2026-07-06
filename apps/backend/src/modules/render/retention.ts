/**
 * Планировщик удержания UGC-ролика: скрипт (реплики с таймкодами) + пресет → список сегментов,
 * у каждого своя техника показа (layout) и движок рендера лица (engine).
 *
 * Оси (см. документ «Удержание в шортах»):
 *   layout — что на экране: split (верх-низ) | closeup (крупный) | broll (только видео) | pip (аватар поверх)
 *   engine — чем рендерим лицо: iv (HeyGen Avatar IV, дорого) | iii (HeyGen Avatar III, дёшево) | free (лица нет)
 *
 * Пресет задаёт РИТМ (сколько сегментов, их длины в % и базовую раскладку/движок). Дальше
 * планировщик УТОЧНЯЕТ движок ПО ТЕКСТУ: крючок и финал-призыв → IV; момент действия («показываю»,
 * «смотрите», «вот как») → IV или врезка-видео; связки → III. Границы сегментов притягиваются к
 * паузам между фразами, чтобы не рвать слово. Всё в процентах от длины — масштабируется на любой ролик.
 *
 * Движки НЕ смешиваем со SpatialReal (решение юзера) — удержание работает только на HeyGen (IV/III),
 * потому что вся экономика построена на паре IV/III.
 */

export type RetLayout = 'split' | 'closeup' | 'broll' | 'pip';
export type RetEngine = 'iv' | 'iii' | 'free';

/** Строка скрипта с таймкодами (из «Разобрать речь» или из TTS с таймингами). */
export interface RetLine { text: string; start: number; end: number }

/** Готовый сегмент: окно времени + техника + движок + текст, попавший в окно. */
export interface RetSegment {
  t0: number; t1: number;
  layout: RetLayout;
  engine: RetEngine;
  text: string;
  reason?: string; // почему такой движок (для лога/подсказки)
}

interface PresetSeg { pct: number; layout: RetLayout; engine: RetEngine }
/** ivMax — бюджет: сколько сегментов максимум может быть на дорогом IV (крючок/действие/призыв).
 *  LLM (или эвристика) выбирает, какие именно, не превышая бюджет — так пресеты реально
 *  отличаются по цене. */
export interface RetPreset { key: string; name: string; desc: string; ivMax: number; segs: PresetSeg[] }

/** Три пресета — по документу «Удержание в шортах». */
export const RETENTION_PRESETS: RetPreset[] = [
  {
    key: 'eco', name: 'Эконом', desc: 'IV только на крючок и призыв, максимум «только видео». Самый дешёвый.', ivMax: 2,
    segs: [
      { pct: 8, layout: 'closeup', engine: 'iv' },
      { pct: 22, layout: 'broll', engine: 'free' },
      { pct: 15, layout: 'pip', engine: 'iii' },
      { pct: 25, layout: 'broll', engine: 'free' },
      { pct: 18, layout: 'split', engine: 'iii' },
      { pct: 12, layout: 'broll', engine: 'free' },
    ],
  },
  {
    key: 'bal', name: 'Баланс', desc: 'IV на крючок, одно действие и призыв; III на связки, много врезок. Золотая середина.', ivMax: 3,
    segs: [
      { pct: 8, layout: 'closeup', engine: 'iv' },
      { pct: 14, layout: 'split', engine: 'iii' },
      { pct: 16, layout: 'broll', engine: 'free' },
      { pct: 12, layout: 'pip', engine: 'iii' },
      { pct: 16, layout: 'broll', engine: 'free' },
      { pct: 14, layout: 'split', engine: 'iii' },
      { pct: 10, layout: 'broll', engine: 'free' },
      { pct: 10, layout: 'closeup', engine: 'iv' },
    ],
  },
  {
    key: 'prem', name: 'Премиум', desc: 'IV на крючок, ключевое действие, доп. лицо и призыв; больше лица.', ivMax: 4,
    segs: [
      { pct: 10, layout: 'closeup', engine: 'iv' },
      { pct: 16, layout: 'split', engine: 'iv' },
      { pct: 14, layout: 'broll', engine: 'free' },
      { pct: 15, layout: 'split', engine: 'iii' },
      { pct: 13, layout: 'broll', engine: 'free' },
      { pct: 14, layout: 'pip', engine: 'iii' },
      { pct: 8, layout: 'split', engine: 'iii' },
      { pct: 10, layout: 'closeup', engine: 'iv' },
    ],
  },
];

export function getRetentionPreset(key: string): RetPreset {
  return RETENTION_PRESETS.find((p) => p.key === key) || RETENTION_PRESETS[1];
}

// ── Текстовые маркеры для авто-разметки движка (RU + EN) ──
// ВАЖНО: без \b — в JS \b не работает с кириллицей (кирилл. буквы = «не-слово» для \b),
// поэтому маркеры даём как подстроки. Слова достаточно характерные, ложных срабатываний мало.
const CTA_RE = /(подпишись|подписывайся|переходи|переходите|ссылк[аиуе]|в описании|жми|нажми на ссылк|кликай|заказыв|оставь заявк|напиши в директ|link in bio|subscribe|follow me|check the link|swipe up|comment below)/i;
const HOOK_RE = /(\?|секрет|представ|что если|а вы знали|вы знали|никто не|перестань|стоп[,! ]|внимание|топ-?\d|главн(ая|ое) ошибк|imagine|what if|stop doing|the secret|nobody tells)/i;
// «человек что-то делает» — показать лицо/действие → IV (правило юзера)
const ACTION_RE = /(показыва|покажу|смотри|вот как|вот так|давайте (я|сделаю)|сейчас (я |по)?сделаю|нажимаю|открываю|запускаю|пробую|тестирую|let me show|watch me|here'?s how|i'?ll show|look at)/i;

/** Текст, попавший в окно [t0,t1] (по перекрытию реплик). */
function textInWindow(lines: RetLine[], t0: number, t1: number): string {
  return lines
    .filter((l) => Number.isFinite(l.start) && Number.isFinite(l.end) && l.end > t0 && l.start < t1)
    .map((l) => String(l.text || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/** Ближайшая пауза между фразами к времени t (чтобы не резать слово). Возвращает t, если пауз рядом нет. */
function snapToGap(lines: RetLine[], t: number, maxShift: number): number {
  let best = t; let bestD = maxShift + 1e-6;
  for (let i = 0; i < lines.length - 1; i++) {
    const gap = (lines[i].end + lines[i + 1].start) / 2; // середина паузы
    const d = Math.abs(gap - t);
    if (d < bestD) { bestD = d; best = gap; }
  }
  return best;
}

/**
 * Разбить дорожку на окна-сегменты БЕЗ выбора дорогого IV: границы по % (с притягиванием к
 * паузам), «лицевые» сегменты → III, broll → free, + текст окна. Дальше поверх накладывается
 * бюджет IV (эвристикой planRetention ИЛИ LLM-скорингом через applyIvBudget).
 */
export function planWindows(lines: RetLine[], preset: RetPreset, totalSec: number): RetSegment[] {
  const segs = preset.segs;
  const n = segs.length;
  const usable = lines.filter((l) => Number.isFinite(l.start) && Number.isFinite(l.end) && l.end > l.start);
  const maxShift = Math.min(1.2, totalSec / (n * 3));

  const bounds: number[] = [0];
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    acc += segs[i].pct;
    let t = (acc / 100) * totalSec;
    if (usable.length) t = snapToGap(usable, t, maxShift);
    bounds.push(Math.max(bounds[i] + 0.4, Math.min(totalSec - 0.4, t)));
  }
  bounds.push(totalSec);

  const out: RetSegment[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = bounds[i]; const t1 = bounds[i + 1];
    const text = usable.length ? textInWindow(usable, t0, t1) : '';
    // база: лицевой сегмент пресета → дешёвый III, broll → free (лица нет)
    const engine: RetEngine = segs[i].engine === 'free' ? 'free' : 'iii';
    out.push({ t0: round2(t0), t1: round2(t1), layout: segs[i].layout, engine, text, reason: 'пресет' });
  }
  return out;
}

/**
 * Полный план с ЭВРИСТИЧЕСКОЙ разметкой IV (без LLM). totalSec — длина голоса.
 * Для LLM-пути: planWindows(...) → tagUgcRetention(...) → applyIvBudget(...).
 */
export function planRetention(lines: RetLine[], preset: RetPreset, totalSec: number): RetSegment[] {
  const out = planWindows(lines, preset, totalSec);
  if (out.some((s) => s.text)) applyIvBudget(out, scoreSegmentsHeuristic(out, out.length), preset.ivMax);
  return out;
}

/** Эвристический скоринг «важности» сегмента для IV (крючок/призыв/действие). LLM даёт аналог. */
export interface SegScore { i: number; score: number; why: string }
function scoreSegmentsHeuristic(out: RetSegment[], n: number): SegScore[] {
  const res: SegScore[] = [];
  for (let i = 0; i < n; i++) {
    const t = out[i].text; if (!t) continue;
    if (i === 0 && HOOK_RE.test(t)) { res.push({ i, score: 100, why: 'крючок → IV' }); continue; }
    if (i >= Math.floor(n * 0.6) && CTA_RE.test(t)) { res.push({ i, score: 90, why: 'призыв → IV' }); continue; }
    const m = t.match(new RegExp(ACTION_RE.source, 'gi'));
    if (m && m.length) res.push({ i, score: 50 + m.length, why: 'ключевое действие → IV' });
  }
  return res;
}

/** Поднять в IV до ivMax самых высокооценённых сегментов (broll → closeup, чтобы лицо было видно). */
export function applyIvBudget(out: RetSegment[], scores: SegScore[], ivMax: number): void {
  scores.slice().sort((a, b) => b.score - a.score).slice(0, Math.max(0, ivMax)).forEach((c) => {
    if (c.i < 0 || c.i >= out.length) return;
    out[c.i].engine = 'iv'; out[c.i].reason = c.why;
    if (out[c.i].layout === 'broll') out[c.i].layout = 'closeup';
  });
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

/** Сводка стоимости плана: минуты IV/III/free и цена по ставкам ($/мин). */
export function retentionCost(segs: RetSegment[], ivRate: number, iiiRate: number): {
  ivSec: number; iiiSec: number; freeSec: number; costUsd: number;
} {
  let iv = 0, iii = 0, free = 0;
  for (const s of segs) {
    const d = Math.max(0, s.t1 - s.t0);
    if (s.engine === 'iv') iv += d; else if (s.engine === 'iii') iii += d; else free += d;
  }
  const costUsd = (iv / 60) * ivRate + (iii / 60) * iiiRate;
  return { ivSec: round2(iv), iiiSec: round2(iii), freeSec: round2(free), costUsd: Math.round(costUsd * 100) / 100 };
}
