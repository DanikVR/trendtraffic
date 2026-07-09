/**
 * TrendTraffic — «Таргет на ЦА»: декомпозиция аудитории в дерево микро-ниш и
 * кластеры ключевиков (Claude). Ядро лайфхака микро-таргетинга: вместо одного
 * широкого запроса — набор УЗКИХ тем-прокси, каждая ловит свою под-аудиторию.
 * Демографию (богатые / их жёны) нельзя запросить у площадки напрямую — её
 * «ловят» темой контента; здесь мы переводим «кого хочу» → «какие темы/ключевики
 * это ловят».
 *
 * buildAudienceMap() — ЧИСТАЯ генерация карты (без вызовов TikHub). Фронт затем
 * веерно сканирует кластеры через существующий /api/trends/scan и группирует
 * выдачу по нишам. Ключ Claude: resolveAnthropicKey (per-tenant → системный),
 * модель DEFAULT_DIRECTOR_MODEL — как в dna.ts.
 */

import { resolveAnthropicKey, DEFAULT_DIRECTOR_MODEL } from '../render/director.js';

/** Одна микро-ниша: тема-прокси нужной под-аудитории + кластер ключевиков под поиск. */
export interface AudienceNiche {
  id: string;            // стабильный ключ для группировки выдачи на фронте
  name: string;          // «Гольф», «Конный спорт (жёны состоятельных)»
  emoji?: string;        // 🏌 — для плитки ниши
  branch?: string;       // верхнеуровневая ветка ЦА: «Кто зарабатывает» / «Их жёны»
  rationale: string;     // почему эта тема — прокси нужной аудитории
  angle: string;         // контент-угол: как встроить продукт в эту тему (готовый hook)
  keywords: string[];    // кластер ключевиков/хэштегов для скана площадки
}

export interface AudienceMap {
  product: string;
  audience: string;
  language?: string;
  region?: string;
  niches: AudienceNiche[];
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
  const language = (input.language || 'русский').trim();
  const seeds = strArr(input.seedKeywords, 20, 60);
  const platformHint = PLATFORM_HINT[platform] || PLATFORM_HINT.tiktok;

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
    `Язык ключевиков и текстов: ${language}.\n` +
    (input.region ? `Регион приоритетно: ${input.region} (добавь локальные темы/площадки, где уместно).\n` : '') +
    (seeds.length ? `Затравочные ключевики пользователя (учти и расширь, не игнорируй): ${seeds.join(', ')}\n` : '') +
    `\nСделай РОВНО ${maxNiches} микро-ниш. Для каждой — кластер из 3-6 поисковых ключевиков ` +
    `на языке «${language}», которыми реально ищут контент этой ниши (без решёток). ` +
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
    const keywords = strArr(n.keywords, 6, 60);
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

  return {
    product, audience, language, region: input.region,
    niches, model: DEFAULT_DIRECTOR_MODEL, generatedAt: new Date().toISOString(),
  };
}
