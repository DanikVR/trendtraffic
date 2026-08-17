/**
 * nlm-text.js — ЧИСТЫЕ текстовые матчеры NotebookLM (без DOM, без chrome.*).
 *
 * Зачем отдельный файл: все хрупкие места content-notebook.js — это «найти элемент по тексту».
 * Google переписывает подписи при каждом редизайне, а вёрстка вдобавок ОБРЕЗАЕТ их многоточием
 * («Аудиопе…», «Менталь…»). Угадывать новые селекторы бессмысленно — вместо этого сопоставление
 * сделано устойчивым, а сюда вынесено всё, что можно проверить БЕЗ браузера
 * (см. test/nlm-text.test.mjs — гоняется в node, живой NotebookLM не нужен).
 *
 * Грузится ПЕРВЫМ в content_scripts (см. manifest) и кладёт себя в globalThis.TT_NLM_TEXT.
 * content-notebook.js берёт его оттуда и имеет локальный фолбэк на случай, если файл не подгрузился.
 */
(() => {
  'use strict';

  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  /** Убрать многоточие-обрезку в конце подписи: «Аудиопе…» → «Аудиопе». */
  const stripEllipsis = (s) => String(s || '').replace(/(…|\.\.\.)\s*$/, '').trim();

  // Минимальная длина огрызка, которому мы верим. 3 и меньше — слишком много ложных совпадений
  // («ауд…» подошло бы и к «аудитория»), 4 — рабочий компромисс.
  const MIN_TRUNC = 4;

  /**
   * Текст `hay` содержит `needle` — с поправкой на ОБРЕЗАННЫЕ вёрсткой подписи.
   *
   * Обычное вхождение проверяется первым. Если его нет, ищем в hay куски вида «слово…» и
   * считаем совпадением случай, когда искомое СОДЕРЖИТ такой огрызок:
   * hay «аудиопе…» + needle «аудиопересказ» → true.
   *
   * Почему именно «содержит», а не «начинается с»: подпись кнопки настройки обрезается как
   * «Настроить аудиопе…», и огрызок «аудиопе» стоит в СЕРЕДИНЕ искомого «настроить аудиопересказ».
   *
   * ВАЖНО: берётся последнее слово перед многоточием, а не весь фрагмент до него — иначе
   * «создаю аудиопе…» не сматчилось бы ни с чем.
   *
   * Порог MIN_TRUNC держит ложные срабатывания в узде: огрызки короче 4 символов игнорируются.
   */
  function looseIncludes(hay, needle) {
    const h = norm(hay);
    const n = norm(needle);
    if (!h || !n) return false;
    if (h.includes(n)) return true;
    for (const m of h.matchAll(/([^\s…]+)(?:…|\.\.\.)/g)) {
      const tail = m[1];
      if (tail.length >= MIN_TRUNC && n.includes(tail)) return true;
    }
    return false;
  }

  /** Любое из слов содержится в тексте (с учётом обрезки). */
  const looseIncludesAny = (hay, words) => (words || []).some((w) => looseIncludes(hay, w));

  // ── типы артефактов студии ────────────────────────────────────────────────
  // Матчим ОСНОВАМИ, а не полными словами: подпись «Аудиопересказ» в новой вёрстке приходит
  // как «Аудиопе…», и полное слово по ней уже не найдётся. Основы подобраны так, чтобы
  // оставаться однозначными (в интерфейсе блокнота нет других слов на «аудиопе»/«инфогра»/…).
  const ARTKIND_RE = new RegExp([
    // RU, основы (переживают обрезку)
    'аудиопе', 'видеопе', 'инфогра', 'менталь', 'презент', 'таблиц', 'карточк', 'отч[её]т', 'тест',
    // RU, форматы аудиообзора и старые названия
    'подробный анализ', 'краткий обзор', 'дебаты', 'рецензи', 'пояснительн', 'поясня', 'обзор',
    // EN
    'audio overview', 'video overview', 'mind ?map', 'infograph', 'flashcard', 'quiz',
    'report', 'slide', 'data table', 'study guide',
  ].join('|'), 'i');

  const DUR_RE = /\b\d{1,2}:\d\d\b/;

  /**
   * Текст = «идёт генерация», а не готовая работа.
   * Гейт !DUR_RE: у ГОТОВОЙ работы всегда есть длительность m:ss, у плейсхолдера — нет,
   * поэтому карточка с глаголом в названии («Создаю бренд 6:46») не ловится ложно.
   */
  const GEN_PLACEHOLDER_RE = /вернитесь через|вернитесь позже|может занять|\bgenerating\b|\bpreparing\b|\bcheck back\b|this (may|might|can) take|генериру[ею]тся|в процессе создания/i;
  const GEN_VERB_RE = /(генераци|создаю|создаё?тся|создаё?м|создается|готовим|готовлю|обрабатыва|creating|building)/i;
  const isGeneratingText = (t) => !DUR_RE.test(t) && (GEN_PLACEHOLDER_RE.test(t) || (GEN_VERB_RE.test(t) && ARTKIND_RE.test(t)));

  // ── форма входа Google ────────────────────────────────────────────────────
  // «sign in to notebook» покрывает и старое «Sign in to NotebookLM», и новое «Sign in to Notebook»
  // под брендом Gemini Notebook — проверка идёт вхождением, а не равенством.
  const SIGNIN_WORDS = [
    'sign in with google', 'sign in to notebook', 'sign in to gemini', 'sign in to continue',
    'войдите в аккаунт', 'войти в google', 'вход в аккаунт google', 'войдите, чтобы продолжить',
  ];

  // ── диалог «Добавить источники» ───────────────────────────────────────────
  // Его НЕЛЬЗЯ трогать чипом «9:16»: заголовок-реклама там упоминает видеообзоры, а textarea —
  // это ПОИСК источников. Живой баг 15.07: чип уезжал в поле поиска и ломал добавление.
  const SRC_DLG_RE = /перетащить файлы|загрузить файлы|скопированный текст|найдите новые источники|добавьте источник|выберите файлы|drag (and|&) drop|upload (a )?file|choose file|copied text|discover sources/i;

  // ── правила чипа «9:16» ───────────────────────────────────────────────────
  // Основы, а не полные слова — заголовок диалога тоже может быть обрезан.
  const V916 = [
    { re: /видеооб|видеопе|\bvideo\b/i, prompt: 'Generate the video in a vertical 9:16 aspect ratio optimized for mobile screens and TikTok. Ensure clear text placement and dynamic visuals.' },
    { re: /инфогра|infograph/i, prompt: 'Create a vertical infographic optimized for mobile view in 9:16 aspect ratio. Arrange the information architecture from top to bottom.' },
    { re: /презент|\bslide/i, prompt: 'Create a presentation tailored for mobile devices in 9:16 vertical format.' },
    { re: /отч[её]т|report|брифинг|briefing/i, prompt: 'Format as a short briefing with vertical, mobile-friendly spacing and bullet points.' },
  ];

  /** Пункт меню ⋮ «Скачать» (но НЕ «Скачать блокнот»). */
  const isDownloadItem = (t) => /скачать|сохранить|save_alt|download|\bsave\b/i.test(norm(t)) && !/блокнот|notebook/i.test(norm(t));

  /**
   * Заголовок карточки артефакта из её полного текста.
   * Чистим: длительность, snake_case-лигатуры Material-иконок (они попадают в textContent),
   * склейки plain-лигатур («sharedownload»), нашу кнопку ⬇TT и её состояния.
   * Без этого заголовок «плывёт» между сканами → базлайн не совпадает → дубликаты в Галерее.
   */
  function cardTitle(full) {
    let title = clean(full).split(/·|\s{2,}/)[0]
      .replace(DUR_RE, '')
      .replace(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g, '')
      .replace(/sharedownload|share|download|subscriptions|fullscreen|pause|посмотреть запрос.*$/gi, '')
      .replace(/more_vert|play_arrow|воспроизвести|ещё|⬇TT|…|✓|⚠/gi, '')
      .trim();
    if (!title || title.length < 2) title = 'Артефакт NotebookLM';
    return title.slice(0, 120);
  }

  const API = {
    norm, clean, stripEllipsis, looseIncludes, looseIncludesAny,
    ARTKIND_RE, DUR_RE, isGeneratingText, GEN_PLACEHOLDER_RE, GEN_VERB_RE,
    SIGNIN_WORDS, SRC_DLG_RE, V916, isDownloadItem, cardTitle, MIN_TRUNC,
  };

  try { globalThis.TT_NLM_TEXT = API; } catch { /* */ }
  // для node-теста (в браузере module не определён)
  try { if (typeof module !== 'undefined' && module.exports) module.exports = API; } catch { /* */ }
})();
