/**
 * TrendTraffic — «Таргет на ЦА»: декомпозиция аудитории в дерево микро-ниш и
 * кластеры ключевиков (Claude). Ядро лайфхака микро-таргетинга: вместо одного
 * широкого запроса — набор УЗКИХ тем-прокси, каждая ловит свою под-аудиторию.
 * Демографию (богатые / их жёны) нельзя запросить у площадки напрямую — её
 * «ловят» темой контента; здесь мы переводим «кого хочу» → «какие темы/ключевики
 * это ловят».
 *
 * buildAudienceMap() — генерация карты: Claude предлагает ниши, затем (Фаза 2)
 * ключевики каждой ниши ЗАЗЕМЛЯЮТСЯ реальными подсказками запросов TikHub
 * (get_query_suggestions по региону / YouTube suggestions), а ниши подсеваются
 * трендовыми хэштегами региона. Дальше фронт веерно сканирует кластеры через
 * /api/trends/scan. Ключ Claude: resolveAnthropicKey; ключ TikHub: getEffectiveTikHubKey.
 * Заземление грациозно деградирует: нет ключа/эндпоинт упал → работаем на приорах Claude.
 */

import { resolveAnthropicKey, DEFAULT_DIRECTOR_MODEL } from '../render/director.js';
import { getEffectiveTikHubKey } from '../tenant_settings/tikhub.js';
import {
  fetchTiktokQuerySuggestions, fetchTiktokKeywordSuggest, fetchYoutubeSuggestions,
  fetchTiktokTrendingHashtags, extractSuggestions,
} from '../tikhub/tikhub_client.js';
import { REGION_LANG } from '../tikhub/providers.js';

/** Одна микро-ниша: тема-прокси нужной под-аудитории + кластер ключевиков под поиск. */
export interface AudienceNiche {
  id: string;            // стабильный ключ для группировки выдачи на фронте
  name: string;          // «Гольф», «Конный спорт (жёны состоятельных)»
  emoji?: string;        // 🏌 — для плитки ниши
  branch?: string;       // верхнеуровневая ветка ЦА: «Кто зарабатывает» / «Их жёны»
  rationale: string;     // почему эта тема — прокси нужной аудитории
  angle: string;         // контент-угол: как встроить продукт в эту тему (готовый hook)
  keywords: string[];    // кластер ключевиков/хэштегов для скана (реальные запросы — первыми)
  realKeywords?: string[]; // подмножество keywords, подтверждённых реальными подсказками запросов
  grounded?: boolean;    // нашлись ли реальные запросы для этой ниши
}

export interface AudienceMap {
  product: string;
  audience: string;
  language?: string;
  region?: string;
  niches: AudienceNiche[];
  grounded?: boolean;        // заземлены ли ключевики реальными запросами (хоть одна ниша)
  groundingSource?: string;  // 'tiktok' | 'youtube' — откуда брали реальные подсказки
  trendingHashtags?: string[]; // трендовые хэштеги региона, подмешанные в генерацию (инфо)
  model: string;
  generatedAt: string;   // ISO
}

export interface BuildAudienceInput {
  product: string;
  audience: string;
  seedKeywords?: string[];
  platform?: string;     // площадка (влияет на стиль ключевиков: хэштеги vs фразы)
  language?: string;     // язык ключевиков (напр. «русский», «узбекский»)
  region?: string;       // ISO alpha-2 — подсказка локальных тем/площадок
  maxNiches?: number;    // потолок ниш (каждая = отдельный ОПЛАЧИВАЕМЫЙ скан!)
  ground?: boolean;      // заземлять ключевики реальными запросами TikHub (default true)
}

function parseJsonLoose(txt: string): any {
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
function strArr(v: any, max: number, cap = 80): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = String(x ?? '').trim().replace(/^#/, '').slice(0, cap);
      const k = s.toLowerCase();
      if (s && !seen.has(k)) { seen.add(k); out.push(s); }
      if (out.length >= max) break;
    }
  }
  return out;
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** «русский, английский» → ['русский','английский'] — язык приходит списком из мультиселекта фронта. */
function splitLangs(language?: string): string[] {
  const langs = String(language || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  return langs.length ? langs.slice(0, 6) : ['русский'];
}

const PLATFORM_HINT: Record<string, string> = {
  tiktok: 'TikTok — короткие фразы и хэштеги без решётки, разговорные, как их ищут в поиске TikTok.',
  instagram: 'Instagram Reels — темы и хэштеги (без решётки), lifestyle-формулировки.',
  youtube: 'YouTube — поисковые фразы целиком (как вводят в строку поиска), 2-5 слов.',
  twitter: 'X/Twitter — короткие тематические запросы и имена трендов.',
  reddit: 'Reddit — названия сабреддитов/тем на английском.',
};

/**
 * Строит карту ЦА: аудитория + продукт → дерево микро-ниш с кластерами ключевиков.
 * Бросает понятную ошибку при отсутствии ключа Claude / неразборчивом ответе.
 */
export async function buildAudienceMap(tenantId: string, input: BuildAudienceInput): Promise<AudienceMap> {
  const product = String(input.product || '').trim();
  const audience = String(input.audience || '').trim();
  if (!product) throw new Error('Заполните, что продвигаем (продукт/оффер).');
  if (!audience) throw new Error('Заполните базовую целевую аудиторию.');

  const apiKey = await resolveAnthropicKey(tenantId);
  if (!apiKey) throw new Error('Ключ Claude не задан (Enterprise → Генерация → ИИ-режиссёр).');

  const maxNiches = clamp(Math.round(input.maxNiches ?? 8), 3, 12);
  const platform = (input.platform || 'tiktok').toLowerCase();
  const langs = splitLangs(input.language); // мультиселект языков: «русский, английский» → на каждом
  const language = langs.join(', ');
  const seeds = strArr(input.seedKeywords, 20, 60);
  const platformHint = PLATFORM_HINT[platform] || PLATFORM_HINT.tiktok;

  // Заземление (Фаза 2): реальные данные запросов TikHub. Грациозно деградирует —
  // нет ключа / упал эндпоинт → работаем на приорах Claude (grounded=false).
  const ground = input.ground !== false;
  const canGroundPlatform = platform === 'tiktok' || platform === 'youtube';
  const tikKey = (ground && canGroundPlatform) ? await getEffectiveTikHubKey(tenantId).catch(() => null) : null;

  // Трендовые хэштеги региона (TikTok Creative Center) — подсев ниш актуальными темами. Best-effort.
  let trendingHashtags: string[] = [];
  if (tikKey && platform === 'tiktok') {
    try {
      const r = await fetchTiktokTrendingHashtags(tikKey, { countryCode: input.region || 'US', limit: 20 });
      if (r.ok) trendingHashtags = extractSuggestions(r.data, 20);
    } catch { /* не критично */ }
  }

  const system =
    'Ты — стратег по микро-таргетингу контента в соцсетях. Демографию (например «богатые люди» ' +
    'или «их жёны») НЕЛЬЗЯ таргетировать напрямую — алгоритм раздаёт ролик по ТЕМЕ. Поэтому ты ' +
    'раскладываешь базовую аудиторию на отдельные под-аудитории и их УЗКИЕ интересы-ниши, где ' +
    'каждая ниша — конкретная тема-прокси, у которой аудитория совпадает с нужной (пример: гольф, ' +
    'падл, конный спорт, элитные горнолыжные курорты, F1 — прокси состоятельной аудитории). Ниши ' +
    'должны быть РАЗНЫМИ и узкими (меньше конкуренции), а не синонимами одной темы. ' +
    'Отвечай СТРОГО одним JSON-объектом, без markdown и пояснений.';

  const user =
    `Продукт/оффер: ${product}\n` +
    `Базовая ЦА: ${audience}\n` +
    `Площадка: ${platform}. ${platformHint}\n` +
    (langs.length > 1
      ? `Языки ключевиков: ${language} — в кластере КАЖДОЙ ниши распредели ключевики по этим языкам (хотя бы по одному на каждом).\n`
      : `Язык ключевиков и текстов: ${language}.\n`) +
    (input.region ? `Регион приоритетно: ${input.region} (добавь локальные темы/площадки, где уместно).\n` : '') +
    (seeds.length ? `Затравочные ключевики пользователя (учти и расширь, не игнорируй): ${seeds.join(', ')}\n` : '') +
    (trendingHashtags.length ? `Актуально трендовые хэштеги в регионе (используй как подсказку, если релевантны нише): ${trendingHashtags.slice(0, 15).join(', ')}\n` : '') +
    `\nСделай РОВНО ${maxNiches} микро-ниш. Для каждой — кластер из ${langs.length > 1 ? '4-8' : '3-6'} поисковых ключевиков ` +
    (langs.length > 1 ? `на указанных языках (${language})` : `на языке «${language}»`) +
    ', которыми реально ищут контент этой ниши (без решёток). ' +
    'Верни JSON ровно такого вида:\n' +
    '{\n' +
    '  "niches": [\n' +
    '    {\n' +
    '      "name": "<короткое имя ниши>",\n' +
    '      "emoji": "<1 эмодзи темы>",\n' +
    '      "branch": "<ветка под-аудитории, напр. Кто зарабатывает / Их жёны / По интересам>",\n' +
    '      "rationale": "<1-2 предложения: почему эта тема ловит нужную аудиторию>",\n' +
    '      "angle": "<как встроить продукт в эту тему — готовая идея хука, 1-2 предложения>",\n' +
    '      "keywords": ["<3-6 поисковых ключевиков/фраз>"]\n' +
    '    }\n' +
    '  ]\n' +
    '}';

  const mod: any = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default || mod.Anthropic || mod;
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: DEFAULT_DIRECTOR_MODEL, max_tokens: 4000, thinking: { type: 'adaptive' },
    system, messages: [{ role: 'user', content: user }],
  });
  const txt = (res.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('');
  const j = parseJsonLoose(txt);
  const rawNiches = j && Array.isArray(j.niches) ? j.niches : null;
  if (!rawNiches) throw new Error('ИИ вернул неразборчивый ответ — повторите.');

  const niches: AudienceNiche[] = [];
  for (const n of rawNiches) {
    if (!n || typeof n !== 'object') continue;
    const name = String(n.name || '').trim().slice(0, 80);
    const keywords = strArr(n.keywords, langs.length > 1 ? 10 : 6, 60);
    if (!name || keywords.length === 0) continue; // ниша без имени/ключевиков бесполезна
    niches.push({
      id: `niche-${niches.length + 1}`,
      name,
      emoji: typeof n.emoji === 'string' ? n.emoji.trim().slice(0, 4) : undefined,
      branch: typeof n.branch === 'string' ? n.branch.trim().slice(0, 80) : undefined,
      rationale: String(n.rationale || '').trim().slice(0, 400),
      angle: String(n.angle || '').trim().slice(0, 400),
      keywords,
    });
    if (niches.length >= maxNiches) break;
  }
  if (niches.length === 0) throw new Error('Не удалось выделить ниши — уточните продукт и аудиторию.');

  // Заземление ключевиков реальными запросами (параллельно по нишам). На нишу — 1 лёгкий
  // suggest-запрос (это НЕ видео-скан, дёшево). Реальные подсказки встают ПЕРВЫМИ, затем
  // добиваются ИИ-ключевиками до 8; realKeywords помечает, что реально пришло из запросов.
  let groundingSource: string | undefined;
  if (tikKey) {
    const ytLang = REGION_LANG[(input.region || 'US').toUpperCase()] || 'en';
    await Promise.all(niches.map(async (n) => {
      const seed = (n.keywords[0] || n.name).slice(0, 60);
      let real: string[] = [];
      // Причину провала заземления логируем: без этого «ключевики от ИИ» в UI не
      // отличить от «эндпоинт подсказок недоступен/не в скоупе ключа», и обрыв связи
      // с TikHub выглядел так же, как честно пустые подсказки.
      let why = '';
      try {
        if (platform === 'youtube') {
          const r = await fetchYoutubeSuggestions(tikKey, seed, { region: input.region || 'US', language: ytLang });
          if (r.ok) real = extractSuggestions(r.data, 12); else why = r.error || `HTTP ${r.status}`;
        } else { // tiktok
          const r = await fetchTiktokQuerySuggestions(tikKey, seed, { countryCode: input.region || 'US' });
          if (r.ok) real = extractSuggestions(r.data, 12); else why = r.error || `HTTP ${r.status}`;
          // Пусто/упало → автокомплит поиска TikTok как фолбэк (без региона).
          if (!real.length) {
            const r2 = await fetchTiktokKeywordSuggest(tikKey, seed);
            if (r2.ok) real = extractSuggestions(r2.data, 12); else why = r2.error || `HTTP ${r2.status}`;
          }
        }
      } catch (e: any) { why = e?.message || String(e); }
      if (!real.length) console.warn(`[audience] заземление «${seed}» без подсказок${why ? `: ${why}` : ' (пустой ответ)'}`);
      if (real.length) {
        const low = new Set(real.map((x) => x.toLowerCase()));
        const merged = [...real];
        for (const k of n.keywords) if (!low.has(k.toLowerCase())) merged.push(k);
        n.keywords = merged.slice(0, langs.length > 1 ? 12 : 8);
        n.realKeywords = real.filter((x) => n.keywords.some((k) => k.toLowerCase() === x.toLowerCase()));
        n.grounded = true;
      } else {
        n.grounded = false;
      }
    }));
    if (niches.some((n) => n.grounded)) groundingSource = platform;
  }

  return {
    product, audience, language, region: input.region,
    niches, grounded: !!groundingSource, groundingSource,
    trendingHashtags: trendingHashtags.length ? trendingHashtags.slice(0, 15) : undefined,
    model: DEFAULT_DIRECTOR_MODEL, generatedAt: new Date().toISOString(),
  };
}

/** Подсказка ИИ по одному описанию продукта: базовая ЦА + затравочные ключевики (кнопка «Подсказать»). */
export interface AudienceSuggestion {
  audience: string;
  keywords: string[];
  model: string;
}

export interface SuggestAudienceInput {
  product: string;
  platform?: string;
  language?: string;  // язык(и) ключевиков — может прийти списком «русский, английский»
  region?: string;    // ISO alpha-2
}

/**
 * suggestAudience() — по описанию продукта Claude формулирует базовую ЦА (1-2 предложения,
 * редактируемо на фронте) и 8-12 затравочных ключевиков на выбранных языках. Один дешёвый
 * запрос ИИ, без TikHub. Бросает понятную ошибку при пустом продукте / отсутствии ключа.
 */
export async function suggestAudience(tenantId: string, input: SuggestAudienceInput): Promise<AudienceSuggestion> {
  const product = String(input.product || '').trim();
  if (!product) throw new Error('Сначала заполните «Что продвигаем» — по нему ИИ подскажет ЦА и ключевики.');

  const apiKey = await resolveAnthropicKey(tenantId);
  if (!apiKey) throw new Error('Ключ Claude не задан (Enterprise → Генерация → ИИ-режиссёр).');

  const platform = (input.platform || 'tiktok').toLowerCase();
  const langs = splitLangs(input.language);
  const platformHint = PLATFORM_HINT[platform] || PLATFORM_HINT.tiktok;

  const system =
    'Ты — маркетолог-стратег по продвижению в соцсетях. По описанию продукта/оффера ты определяешь, ' +
    'кому он на самом деле нужен (базовая целевая аудитория), и какие поисковые темы/ключевики эту ' +
    'аудиторию ловят. Отвечай СТРОГО одним JSON-объектом, без markdown и пояснений.';

  const user =
    `Продукт/оффер: ${product}\n` +
    `Площадка: ${platform}. ${platformHint}\n` +
    (input.region ? `Регион приоритетно: ${input.region}.\n` : '') +
    '\nСформулируй:\n' +
    '1) "audience" — базовая целевая аудитория: кто эти люди, их сегменты и мотивация. Кратко, 1-2 предложения ' +
    'на русском, в стиле «предприниматели 30-50 и их жёны; боятся потерять капитал, ищут пассивный доход».\n' +
    `2) "keywords" — 8-12 затравочных поисковых ключевиков/тем под эту аудиторию, без решёток` +
    (langs.length > 1 ? ` (распредели по языкам: ${langs.join(', ')}).` : ` на языке «${langs[0]}».`) + '\n' +
    '\nВерни JSON ровно такого вида:\n' +
    '{ "audience": "<1-2 предложения>", "keywords": ["<8-12 ключевиков>"] }';

  const mod: any = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default || mod.Anthropic || mod;
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: DEFAULT_DIRECTOR_MODEL, max_tokens: 1500, thinking: { type: 'adaptive' },
    system, messages: [{ role: 'user', content: user }],
  });
  const txt = (res.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('');
  const j = parseJsonLoose(txt);
  const audience = String(j?.audience || '').trim().slice(0, 500);
  const keywords = strArr(j?.keywords, 15, 60);
  if (!audience && !keywords.length) throw new Error('ИИ вернул неразборчивый ответ — повторите.');
  return { audience, keywords, model: DEFAULT_DIRECTOR_MODEL };
}
