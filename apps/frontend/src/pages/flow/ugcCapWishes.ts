/**
 * Разбор «Пожеланий к стилю» субтитров в детерминированные оверрайды стиля.
 * Понимает цвета (слова RU/EN + hex #rrggbb), роль цвета по соседним словам
 * (обводка/контур → обводка; подложка/плашка/фон → плашка; подсветка/выделение → цвет),
 * размер шрифта (крупнее/мелче/«120%»/«шрифт 80») и толщину обводки («без обводки»,
 * «толстая обводка», «обводка 6»). Разбор мгновенный — живой пример в превью красится
 * на каждый ввод, и ТОТ ЖЕ разбор применяет рендер (ASS-титры), чтобы превью не врало.
 * КОПИЯ живёт на бэке: apps/backend/src/modules/render/cap_wishes.ts — правки синхронизировать!
 */
export interface UgcCapWish {
  color: string | null;         // #rrggbb — цвет текста (word/plain) или подсветки (karaoke)
  outlineColor: string | null;  // #rrggbb — цвет обводки
  outlineWidth: number | null;  // толщина обводки в ASS-px (0 = без обводки; null = дефолт)
  sizePct: number | null;       // размер шрифта в % от дефолта (50..250; null = 100)
  bg: string | null;            // #rrggbb — подложка-плашка под текстом
}

/* Стемы цветов (текст заранее приводится к lower + ё→е). RU — по началу слова, EN — тоже
   (yellowish и т.п. не страшны). Порядок важен: «голуб» раньше «син» не обязателен —
   стемы не пересекаются по началу слова. */
const COLOR_STEMS: [string[], string][] = [
  [['красн', 'алый', 'red'], '#ff3b3b'],
  [['оранжев', 'orange'], '#ff9500'],
  [['желт', 'yellow'], '#ffd60a'],
  [['золот', 'gold'], '#ffd700'],
  [['салатов', 'lime'], '#a3e635'],
  [['зелен', 'green'], '#30d158'],
  [['бирюзов', 'turquoise', 'teal'], '#2dd4bf'],
  [['голуб', 'cyan', 'sky'], '#38bdf8'],
  [['син', 'blue'], '#3b82f6'],
  [['фиолетов', 'сиренев', 'лилов', 'purple', 'violet'], '#a855f7'],
  [['розов', 'pink'], '#ec4899'],
  [['малинов', 'crimson', 'magenta'], '#e11d48'],
  [['бел', 'white'], '#ffffff'],
  [['черн', 'black'], '#111111'],
  [['сер', 'gray', 'grey'], '#9ca3af'],
  [['коричнев', 'brown'], '#a16207'],
];
const ROLE_OUTLINE = ['обводк', 'обведен', 'контур', 'окантовк', 'stroke', 'outline'];
const ROLE_BG = ['подложк', 'плашк', 'фон', 'подкладк', 'background', 'backdrop', 'box'];
const ROLE_TEXT = ['подсветк', 'заливк', 'выделен', 'highlight', 'цвет', 'текст', 'буквы', 'слов', 'color', 'text', 'font', 'шрифт'];
const SIZE_KEY = ['шрифт', 'размер', 'кегл', 'font', 'size', 'высот'];

const startsAny = (w: string, stems: string[]) => stems.some((s) => w.startsWith(s));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const hex6 = (h: string) => (h.length === 3 ? h.split('').map((c) => c + c).join('') : h);

/** null — в пожеланиях не распознано ничего управляемого (стиль остаётся дефолтным). */
export function parseCapWishes(wishes: string): UgcCapWish | null {
  const norm = String(wishes || '').toLowerCase().replace(/ё/g, 'е');
  if (!norm.trim()) return null;
  // Токены: слова/числа/hex + номер клаузы (между запятыми/точками) — роль цвета ищем
  // только внутри своей клаузы, чтобы «фиолетовым, обводка тонкая» не красило обводку.
  const tokens: string[] = [];
  const clause: number[] = [];
  const re = /[#a-zа-я0-9%]+|[,.;!?]/g;
  let cl0 = 0;
  for (let m = re.exec(norm); m; m = re.exec(norm)) {
    if (/^[,.;!?]$/.test(m[0])) { cl0++; continue; }
    tokens.push(m[0]); clause.push(cl0);
  }

  const out: UgcCapWish = { color: null, outlineColor: null, outlineWidth: null, sizePct: null, bg: null };
  const freeColors: string[] = [];

  const roleAt = (i: number): 'outline' | 'bg' | 'text' | null => {
    // Роль цвета — по ближайшему соседу в пределах 2 токенов той же клаузы
    // («красная обводка», «фон черный»).
    for (const d of [1, -1, 2, -2]) {
      const w = tokens[i + d];
      if (!w || clause[i + d] !== clause[i]) continue;
      if (startsAny(w, ROLE_OUTLINE)) return 'outline';
      if (startsAny(w, ROLE_BG)) return 'bg';
      if (startsAny(w, ROLE_TEXT)) return 'text';
    }
    return null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];

    // hex-цвет
    const hx = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(w);
    // словарный цвет
    const named = hx ? null : COLOR_STEMS.find(([stems]) => startsAny(w, stems));
    if (hx || named) {
      const c = hx ? `#${hex6(hx[1])}` : named![1];
      const role = roleAt(i);
      if (role === 'outline' && !out.outlineColor) out.outlineColor = c;
      else if (role === 'bg' && !out.bg) out.bg = c;
      else if (role === 'text' && !out.color) out.color = c;
      else freeColors.push(c);
      continue;
    }

    // «120%» — размер в процентах
    const pct = /^(\d{2,3})%$/.exec(w);
    if (pct) { out.sizePct = clamp(Number(pct[1]), 50, 250); continue; }

    // голое число: рядом «обводка» → толщина, рядом «шрифт/размер» → px (дефолт титров ≈ 62px)
    const num = /^(\d{1,3})$/.exec(w);
    if (num) {
      const n = Number(num[1]);
      const sameCl = (d: number) => clause[i + d] === clause[i] ? (tokens[i + d] || '') : '';
      const prev = sameCl(-1), prev2 = sameCl(-2);
      if (startsAny(prev, ROLE_OUTLINE) || startsAny(prev2, ROLE_OUTLINE)) out.outlineWidth = clamp(n, 0, 12);
      else if ((startsAny(prev, SIZE_KEY) || startsAny(prev2, SIZE_KEY)) && n >= 20 && n <= 200) out.sizePct = clamp(Math.round((n / 62) * 100), 50, 250);
      continue;
    }

    // размер словами (явные «120%»/«шрифт 80» приоритетнее — они пишутся без ??)
    if (/(огромн|громадн|huge)/.test(w)) out.sizePct = out.sizePct ?? 165;
    else if (/(крупн|больш|big|larg)/.test(w)) out.sizePct = out.sizePct ?? 135;
    else if (/(крошечн|tiny)/.test(w)) out.sizePct = out.sizePct ?? 60;
    else if (/(мелк|маленьк|small)/.test(w)) out.sizePct = out.sizePct ?? 78;

    // толщина обводки словами / «без обводки»
    if (startsAny(w, ROLE_OUTLINE)) {
      const around = [tokens[i - 1] || '', tokens[i + 1] || ''];
      if ((tokens[i - 1] || '') === 'без' || around.some((x) => x === 'no' || x.startsWith('убер') || x.startsWith('нет'))) out.outlineWidth = 0;
      else if (around.some((x) => x.startsWith('толст') || x.startsWith('жирн') || x.startsWith('thick'))) out.outlineWidth = out.outlineWidth ?? 7;
      else if (around.some((x) => x.startsWith('тонк') || x.startsWith('thin'))) out.outlineWidth = out.outlineWidth ?? 2;
    }
  }

  // Цвета без явной роли: первый — текст, второй — обводка («белые с черной обводкой» и так
  // поймается ролью, это фолбэк для «белый, черный»).
  for (const c of freeColors) {
    if (!out.color) out.color = c;
    else if (!out.outlineColor) out.outlineColor = c;
  }

  return (out.color || out.outlineColor || out.outlineWidth != null || out.sizePct != null || out.bg) ? out : null;
}
