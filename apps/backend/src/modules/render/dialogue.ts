/**
 * Планировщик режима «Диалоги» UGC: разбор записи на 2 голоса (A/B) → список сегментов, каждый
 * со своей раскладкой (кто/что на экране) и движком лица (HeyGen IV/III). Экономика — как в
 * [[retention]]: дорогой IV только на пики, обычные реплики — III, медиа-сегменты без лица = $0.
 *
 * Оси:
 *   layout — что на экране: closeup (крупный план говорящего) | twoshot (оба, верх-низ:
 *            говорящий + реакция второго) | media-full (только медиа) | media-bg-left/-right
 *            (медиа во весь кадр + говорящий маленьким слева/справа) | media-split (медиа + лицо)
 *   engine — движок лица: iv (Avatar IV, дорого) | iii (Avatar III, дёшево). Медиа-full лица нет.
 *
 * Ключевые правила (по ТЗ юзера):
 *  • Каждая реплика диалога = говорит СВОЙ аватар (A → фото A, B → фото B). НЕ смешиваем со SpatialReal.
 *  • Соседние реплики одного спикера без медиа склеиваются в один сегмент (экономия рендеров).
 *  • Медиа реплики: «Авто» (Claude решит раскладку) или принудительно full / фон-слева / фон-справа /
 *    сверху-снизу. 16:9 медиа кладётся полосой по центру (TikTok-стиль) — это делает композитор.
 *  • Растяжка медиа: holdSec > длины реплики → после речи медиа ДЕРЖИТСЯ ещё (holdSec−реплика) секунд,
 *    а ВСЕ последующие реплики сдвигаются на эту разницу (следующая речь не наложится). Во время
 *    держания играет звук самого видео (иначе тишина/музыка) — это тоже композитор.
 *  • Вовлечённость (engagement) = бюджет two-shot и IV: eco (почти всегда один) / bal (два-шот на
 *    пиках) / dyn (часто оба + врезки).
 */

export type DlgLayout =
  | 'closeup'
  | 'twoshot'
  | 'media-full'
  | 'media-bg-left'
  | 'media-bg-right'
  | 'media-split';
export type DlgEngine = 'iv' | 'iii';
export type DlgEngagement = 'eco' | 'bal' | 'dyn';
export type DlgMediaHint = 'auto' | 'media-full' | 'media-bg-left' | 'media-bg-right' | 'media-split';

/** Реплика на входе (из разбора записи; таймкоды — в ИСХОДНОЙ записи). */
export interface DlgLineIn {
  speaker: 'A' | 'B';
  text: string;
  start: number;
  end: number;
  image?: string | null;      // медиа реплики (URL) — фото или видео
  isVideo?: boolean;
  layoutHint?: DlgMediaHint;  // как показать медиа ('auto' → решит director/эвристика)
  holdSec?: number;           // полная длительность показа медиа, сек (>длины реплики → растяжка)
}

/** Готовый сегмент финального ролика. */
export interface DlgSeg {
  t0: number; t1: number;                 // финальный таймлайн (после сдвигов растяжки), сек
  srcT0: number | null; srcT1: number | null; // окно речи в ИСХОДНОЙ записи; null для держания медиа
  speaker: 'A' | 'B' | null;              // чьё лицо (говорящий); null для media-full / держания
  other: 'A' | 'B' | null;                // второе лицо для twoshot (реакция, молчит); иначе null
  layout: DlgLayout;
  engine: DlgEngine;                       // движок лица (для лицевых раскладок)
  image: string | null; isVideo: boolean; // медиа сегмента
  mediaFromSec: number;                    // с какой секунды медиа проигрывать (для держания = длина речи)
  mediaAuto: boolean;                      // раскладку медиа выбирал director (true) или задал юзер (false)
  kind: 'speech' | 'hold';                 // речь / держание медиа после речи
  text: string;                            // текст сегмента (для LLM/эвристики)
  reason?: string;
}

export interface DlgPreset { engagement: DlgEngagement; ivMax: number; twoshotMax: number }

const round2 = (n: number): number => Math.round(n * 100) / 100;
const other = (s: 'A' | 'B'): 'A' | 'B' => (s === 'A' ? 'B' : 'A');

// ── Маркеры для эвристики (без \b — в JS \b не дружит с кириллицей) ──
const HOOK_RE = /(\?|секрет|представ|а вы знали|вы знали|никто не|перестань|стоп[,! ]|внимание|топ-?\d|главн(ая|ое)|imagine|what if|the secret|nobody)/i;
const CTA_RE = /(подпишись|подписывайся|переходи|ссылк[аиуе]|в описании|жми|нажми|заказыв|link in bio|subscribe|follow)/i;
const REACT_RE = /(да[,!. ]|точно|именно|вот именно|согласен|ого|вау|серьёзно|правда\?|не может быть|ничего себе|ух ты|exactly|no way|really)/i;

/** Бюджеты по уровню вовлечённости. faceCount — сколько сегментов с лицом (можно поднять в IV/two-shot). */
export function dlgPreset(engagement: DlgEngagement, faceCount: number): DlgPreset {
  if (engagement === 'eco') return { engagement, ivMax: 1, twoshotMax: 0 };
  if (engagement === 'dyn') return { engagement, ivMax: Math.max(3, Math.round(faceCount * 0.3)), twoshotMax: Math.max(1, Math.round(faceCount * 0.35)) };
  return { engagement, ivMax: Math.max(2, Math.round(faceCount * 0.15)), twoshotMax: Math.max(1, Math.round(faceCount * 0.15)) };
}

function mapHint(h: DlgMediaHint | undefined): DlgLayout {
  if (h === 'media-full') return 'media-full';
  if (h === 'media-bg-left') return 'media-bg-left';
  if (h === 'media-bg-right') return 'media-bg-right';
  if (h === 'media-split') return 'media-split';
  return 'media-bg-right'; // 'auto' база — director/эвристика могут поменять
}

/**
 * Разбить реплики на сегменты финального таймлайна с учётом растяжки медиа. НЕ выбирает IV/two-shot —
 * это делает applyDlgBudget поверх (по скорам LLM directDialogue или эвристике). Границы сегментов
 * тайлят весь таймлайн без дыр (пауза между репликами = продление предыдущего сегмента).
 */
export function planDialogue(linesIn: DlgLineIn[], engagement: DlgEngagement): { segs: DlgSeg[]; preset: DlgPreset } {
  // 1) нормализуем: валидные таймкоды, сортировка по началу, срез наложений (последовательные реплики)
  const valid = linesIn
    .filter((l) => l && l.text && Number.isFinite(l.start) && Number.isFinite(l.end) && l.end > l.start)
    .map((l) => ({ ...l, speaker: (l.speaker === 'B' ? 'B' : 'A') as 'A' | 'B' }))
    .sort((a, b) => a.start - b.start);
  let prevEnd = 0;
  for (const l of valid) { if (l.start < prevEnd) l.start = prevEnd; if (l.end <= l.start) l.end = l.start + 0.4; prevEnd = l.end; }

  // 2) склейка соседних реплик одного спикера БЕЗ медиа → один рендер лица
  type Unit = { speaker: 'A' | 'B'; start: number; end: number; text: string; line?: DlgLineIn };
  const units: Unit[] = [];
  for (const l of valid) {
    const hasMedia = !!l.image;
    const last = units[units.length - 1];
    if (!hasMedia && last && !last.line && last.speaker === l.speaker) { last.end = l.end; last.text = `${last.text} ${l.text}`.trim(); continue; }
    units.push({ speaker: l.speaker, start: l.start, end: l.end, text: String(l.text || '').trim(), line: hasMedia ? l : undefined });
  }

  // 3) сегменты + сдвиг растяжки
  const segs: DlgSeg[] = [];
  let shift = 0;
  for (const u of units) {
    const lineDur = u.end - u.start;
    const fStart = round2(u.start + shift);
    if (u.line && u.line.image) {
      const hold = Number(u.line.holdSec) || 0;
      const extra = hold > lineDur ? round2(hold - lineDur) : 0;
      // сегмент речи с медиа
      segs.push({
        t0: fStart, t1: round2(fStart + lineDur), srcT0: u.start, srcT1: u.end,
        speaker: u.speaker, other: null, layout: mapHint(u.line.layoutHint), engine: 'iii',
        image: u.line.image, isVideo: !!u.line.isVideo, mediaFromSec: 0, mediaAuto: (u.line.layoutHint || 'auto') === 'auto',
        kind: 'speech', text: u.text, reason: 'реплика с медиа',
      });
      // держание медиа после речи (лица нет = бесплатно), последующие реплики сдвигаются
      if (extra > 0) {
        const hStart = round2(fStart + lineDur);
        segs.push({
          t0: hStart, t1: round2(hStart + extra), srcT0: null, srcT1: null,
          speaker: null, other: null, layout: 'media-full', engine: 'iii',
          image: u.line.image, isVideo: !!u.line.isVideo, mediaFromSec: round2(lineDur), mediaAuto: false,
          kind: 'hold', text: '', reason: `держим медиа ещё ${extra}с`,
        });
        shift = round2(shift + extra);
      }
    } else {
      // лицевой сегмент (крупный план говорящего; two-shot решит бюджет)
      segs.push({
        t0: fStart, t1: round2(fStart + lineDur), srcT0: u.start, srcT1: u.end,
        speaker: u.speaker, other: null, layout: 'closeup', engine: 'iii',
        image: null, isVideo: false, mediaFromSec: 0, mediaAuto: false, kind: 'speech', text: u.text, reason: 'реплика',
      });
    }
  }

  // 4) тайлим таймлайн без дыр: t1 сегмента = t0 следующего (пауза = продление кадра)
  for (let i = 0; i < segs.length - 1; i++) if (segs[i + 1].t0 > segs[i].t1) segs[i].t1 = segs[i + 1].t0;

  const faceCount = segs.filter((s) => s.kind === 'speech' && s.speaker && s.layout !== 'media-full').length;
  return { segs, preset: dlgPreset(engagement, faceCount) };
}

export interface DlgScore { i: number; engine?: DlgEngine; twoshot?: boolean; mediaLayout?: DlgLayout; score: number; why?: string }

/** Эвристический скоринг (когда LLM недоступен): крючок/призыв → IV; короткие реакции → two-shot. */
export function scoreDialogueHeuristic(segs: DlgSeg[]): DlgScore[] {
  const res: DlgScore[] = [];
  segs.forEach((s, i) => {
    if (s.kind !== 'speech' || !s.speaker) return;
    const t = s.text || '';
    let score = 0; let twoshot: boolean | undefined; const flags: string[] = [];
    if (i === 0) { score += 60; flags.push('крючок'); }
    if (i >= segs.length - 2) { score += 30; flags.push('финал'); }
    if (HOOK_RE.test(t)) { score += 45; flags.push('интрига'); }
    if (CTA_RE.test(t)) { score += 55; flags.push('призыв'); }
    if (s.image) { score += 15; flags.push('медиа'); }
    // короткая реакция/поддакивание → кандидат на two-shot (оба в кадре)
    if (s.layout === 'closeup' && REACT_RE.test(t) && t.length < 60) { score += 25; twoshot = true; flags.push('реакция'); }
    res.push({ i, score, twoshot, why: flags.join('+') || undefined });
  });
  return res;
}

/** Наложить бюджет: поднять top-ivMax сегментов в IV, назначить top-twoshotMax two-shot (только closeup). */
export function applyDlgBudget(segs: DlgSeg[], scores: DlgScore[], preset: DlgPreset): void {
  const byScore = scores.slice().sort((a, b) => b.score - a.score);
  // движок IV
  let iv = 0;
  for (const c of byScore) {
    const s = segs[c.i]; if (!s || s.kind !== 'speech' || !s.speaker || s.layout === 'media-full') continue;
    const wantIv = c.engine ? c.engine === 'iv' : iv < preset.ivMax;
    if (wantIv && iv < preset.ivMax) { s.engine = 'iv'; iv++; if (c.why) s.reason = `IV: ${c.why}`; }
  }
  // two-shot (оба в кадре) — только для closeup, у которого есть «второй» спикер в ролике
  const hasBoth = segs.some((s) => s.speaker === 'A') && segs.some((s) => s.speaker === 'B');
  if (!hasBoth) return;
  let ts = 0;
  for (const c of byScore) {
    const s = segs[c.i]; if (!s || s.kind !== 'speech' || !s.speaker || s.layout !== 'closeup') continue;
    const wantTs = c.twoshot != null ? c.twoshot : ts < preset.twoshotMax;
    if (wantTs && ts < preset.twoshotMax) { s.layout = 'twoshot'; s.other = other(s.speaker); ts++; }
  }
  // раскладка медиа от LLM — только там, где юзер оставил «Авто» (заданное вручную не трогаем)
  for (const c of byScore) {
    const s = segs[c.i]; if (!s || !s.image || !s.mediaAuto || !c.mediaLayout) continue;
    if (c.mediaLayout.startsWith('media-')) s.layout = c.mediaLayout;
  }
}

/** Полный план с эвристикой (без LLM). */
export function planDialogueHeuristic(linesIn: DlgLineIn[], engagement: DlgEngagement): DlgSeg[] {
  const { segs, preset } = planDialogue(linesIn, engagement);
  applyDlgBudget(segs, scoreDialogueHeuristic(segs), preset);
  return segs;
}
