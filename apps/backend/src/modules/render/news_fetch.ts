/**
 * TrendTraffic — честный источник блока «Новости»: RSS / Telegram / сайт → текст+фото.
 *
 * Без ЛЛМ: берём ПОСЛЕДНЮЮ запись источника как материал. Если у узла включён ✨,
 * Claude потом переписывает материал в текст для озвучки (writeNews c опорой).
 * Фото записи уходит в scratchpad → блок B-roll вставит его перебивкой.
 *
 * Деградация мягкая: не распознали источник / сеть упала → null + заметка,
 * дальше отрабатывает прежний путь (Claude web-search по теме).
 */

export interface NewsItem {
  text: string | null;      // заголовок + суть последней записи
  imageUrl: string | null;  // картинка записи (og:image / enclosure / фото поста)
  note: string;
}

const UA = 'Mozilla/5.0 (compatible; TrendTraffic/1.0; +https://app.trendtraffic.pro)';

async function fetchText(url: string, timeoutMs = 20_000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Снять CDATA/теги/сущности, ужать пробелы. */
function stripHtml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? stripHtml(m[1]) : null;
}

/** RSS 2.0 / Atom: первая (свежая) запись → заголовок+описание+картинка. */
function parseFeed(xml: string): NewsItem | null {
  const item = xml.match(/<item[\s>][\s\S]*?<\/item>/i)?.[0]
    || xml.match(/<entry[\s>][\s\S]*?<\/entry>/i)?.[0];
  if (!item) return null;
  const title = tag(item, 'title');
  const desc = tag(item, 'description') || tag(item, 'summary') || tag(item, 'content:encoded') || tag(item, 'content');
  const img = item.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i)?.[1]
    || item.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i)?.[1]
    || item.match(/<img[^>]+src="(https?:[^"]+)"/i)?.[1]
    || null;
  const text = [title, desc && desc !== title ? desc : null].filter(Boolean).join('. ').slice(0, 2500);
  if (!text) return null;
  return { text, imageUrl: img, note: 'новость из RSS' };
}

/** Публичный Telegram-канал через t.me/s/<name>: последний пост → текст+фото. */
function parseTelegram(html: string): NewsItem | null {
  // Посты идут хронологически — берём ПОСЛЕДНИЙ содержательный.
  const texts = [...html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)]
    .map((m) => stripHtml(m[1])).filter((s) => s.length > 40);
  const text = texts[texts.length - 1] || null;
  const photos = [...html.matchAll(/class="tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/g)]
    .map((m) => m[1]);
  if (!text) return null;
  return { text: text.slice(0, 2500), imageUrl: photos[photos.length - 1] || null, note: 'пост из Telegram' };
}

/** Обычная страница: OpenGraph → заголовок+описание+картинка. */
function parseSite(html: string): NewsItem | null {
  const meta = (prop: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1]
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1]
    || null;
  const title = meta('og:title') || stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const desc = meta('og:description') || meta('description');
  const img = meta('og:image');
  const text = [title, desc].filter(Boolean).join('. ').slice(0, 2500);
  if (!text) return null;
  return { text: stripHtml(text), imageUrl: img, note: 'материал со страницы' };
}

/** Похоже ли поле узла на конкретный источник (а не тему для веб-поиска)? */
export function looksLikeNewsSource(s: string): boolean {
  const t = (s || '').trim();
  return /^https?:\/\//i.test(t) || /^@[\w\d_]{3,}$/.test(t) || /(^|\/)t\.me\//i.test(t);
}

/** Главная точка: источник (URL/@канал) → последняя запись. */
export async function fetchNewsFromSource(opts: { source: string; type?: string | null }): Promise<NewsItem> {
  const src = (opts.source || '').trim();
  const type = (opts.type || '').trim();
  if (!src) return { text: null, imageUrl: null, note: 'новости: источник не указан' };

  // Telegram: @name или t.me/name → веб-превью t.me/s/name
  const tg = src.match(/^@([\w\d_]{3,})$/) || src.match(/t\.me\/(?:s\/)?([\w\d_]{3,})/i);
  if (tg && (type === 'telegram' || !type || tg[0].startsWith('@') || /t\.me/i.test(src))) {
    const html = await fetchText(`https://t.me/s/${tg[1]}`);
    const parsed = html ? parseTelegram(html) : null;
    return parsed || { text: null, imageUrl: null, note: `Telegram @${tg[1]}: посты не прочитались (канал приватный?)` };
  }

  if (!/^https?:\/\//i.test(src)) return { text: null, imageUrl: null, note: 'новости: это тема, а не ссылка — ищем через ИИ' };

  const body = await fetchText(src);
  if (!body) return { text: null, imageUrl: null, note: 'новости: источник не открылся' };

  // RSS/Atom — по типу узла, по расширению или по содержимому.
  const isFeed = type === 'rss' || /\.(xml|rss)(\?|$)/i.test(src) || /<(rss|feed)[\s>]/i.test(body.slice(0, 600));
  if (isFeed) {
    const parsed = parseFeed(body);
    if (parsed) return parsed;
  }
  // Сайт/рубрика: если на странице есть ссылка на RSS — пробуем её, иначе OpenGraph.
  const feedHref = body.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i)?.[1];
  if (feedHref) {
    const feedUrl = /^https?:/i.test(feedHref) ? feedHref : new URL(feedHref, src).toString();
    const feedBody = await fetchText(feedUrl);
    const parsed = feedBody ? parseFeed(feedBody) : null;
    if (parsed) return { ...parsed, note: 'новость из RSS сайта' };
  }
  return parseSite(body) || { text: null, imageUrl: null, note: 'новости: на странице не нашлось текста' };
}
