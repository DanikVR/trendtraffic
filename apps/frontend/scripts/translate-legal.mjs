#!/usr/bin/env node
/**
 * translate-legal.mjs — перевод правовых документов (public/locales/en/legal.json)
 * на все локали Gemini-ом в юридическом регистре «native legal translator».
 *
 * Отличия от translate-pivot.mjs (UI-строки):
 *   • Значения — длинные HTML-абзацы: чанки пакуются по объёму символов,
 *     а не по числу ключей; поддержаны массивы (sections[i].h/b).
 *   • Жёсткая валидация каждого значения:
 *       - последовательность HTML-тегов (с атрибутами!) обязана совпасть 1:1;
 *       - реквизиты (NIP/REGON/email/телефон/имя) обязаны сохраниться;
 *       - запрещённые вставки (<script, javascript:, on*=) → брак.
 *     Брак → одиночный ретрай ключа → фолбэк на EN + лог.
 *   • Промпт: официальный юридический язык, локальные официальные названия
 *     актов ЕС (RODO/DSGVO…), бренды и идентификаторы — verbatim.
 *
 * Ключ: GEMINI_API_KEY (env или apps/frontend/.env.local).
 * Опции: --targets=de,fr --model=gemini-2.5-flash --concurrency=8 --refresh-all
 *        (без --refresh-all языки с готовым валидным legal.json пропускаются)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const PROGRESS_LOG = path.join(ROOT, 'scripts', '_legal_progress.log');

const args = process.argv.slice(2);
const getArg = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const TARGETS = getArg('targets', '') ? getArg('targets', '').split(',').map((s) => s.trim()).filter(Boolean) : null;
const MODEL = getArg('model', 'gemini-2.5-flash');
const CONCURRENCY = Math.max(1, parseInt(getArg('concurrency', '8'), 10));
const REFRESH_ALL = args.includes('--refresh-all');
const CHUNK_CHARS = Math.max(2000, parseInt(getArg('chunk-chars', '6000'), 10));

const LANG_NAMES = {
  af: 'Afrikaans', sq: 'Albanian', am: 'Amharic', ar: 'Arabic', hy: 'Armenian',
  az: 'Azerbaijani', eu: 'Basque', be: 'Belarusian', bn: 'Bengali', bs: 'Bosnian',
  bg: 'Bulgarian', ca: 'Catalan', ceb: 'Cebuano', zh: 'Chinese (Simplified)', co: 'Corsican',
  hr: 'Croatian', cs: 'Czech', da: 'Danish', nl: 'Dutch', en: 'English',
  eo: 'Esperanto', et: 'Estonian', fi: 'Finnish', fr: 'French', fy: 'Frisian',
  gl: 'Galician', ka: 'Georgian', de: 'German', el: 'Greek', gu: 'Gujarati',
  ht: 'Haitian Creole', ha: 'Hausa', haw: 'Hawaiian', he: 'Hebrew', hi: 'Hindi',
  hmn: 'Hmong', hu: 'Hungarian', is: 'Icelandic', ig: 'Igbo', id: 'Indonesian',
  ga: 'Irish', it: 'Italian', ja: 'Japanese', jv: 'Javanese', kn: 'Kannada',
  kk: 'Kazakh', km: 'Khmer', rw: 'Kinyarwanda', ko: 'Korean', ku: 'Kurdish (Kurmanji)',
  ky: 'Kyrgyz', lo: 'Lao', la: 'Latin', lv: 'Latvian', lt: 'Lithuanian',
  lb: 'Luxembourgish', mk: 'Macedonian', mg: 'Malagasy', ms: 'Malay', ml: 'Malayalam',
  mt: 'Maltese', mi: 'Maori', mr: 'Marathi', mn: 'Mongolian', my: 'Burmese',
  ne: 'Nepali', no: 'Norwegian', ny: 'Chichewa', or: 'Odia', ps: 'Pashto',
  fa: 'Persian', pl: 'Polish', pt: 'Portuguese', pa: 'Punjabi', ro: 'Romanian',
  ru: 'Russian', sm: 'Samoan', gd: 'Scots Gaelic', sr: 'Serbian', st: 'Sesotho',
  sn: 'Shona', sd: 'Sindhi', si: 'Sinhala', sk: 'Slovak', sl: 'Slovenian',
  so: 'Somali', es: 'Spanish', su: 'Sundanese', sw: 'Swahili', sv: 'Swedish',
  tl: 'Tagalog', tg: 'Tajik', ta: 'Tamil', tt: 'Tatar', te: 'Telugu',
  th: 'Thai', tr: 'Turkish', tk: 'Turkmen', uk: 'Ukrainian', ur: 'Urdu',
  ug: 'Uyghur', uz: 'Uzbek', vi: 'Vietnamese', cy: 'Welsh', xh: 'Xhosa',
  yi: 'Yiddish', yo: 'Yoruba', zu: 'Zulu',
};

// Идентификаторы, обязанные пережить перевод БУКВАЛЬНО (проверяем, если были в исходнике)
const MUST_SURVIVE = [
  'LARYSA DANYUK', '5214137319', '543026074', 'SEO@trendtraffic.pro',
  '+48 532 875 937', 'trendtraffic.pro', 'vibevox_token', 'vibevox_user',
  'tt_cookie_consent', 'i18nextLng', 'vibevox_theme', '__stripe_mid', '__stripe_sid',
  '2024/1689', '2016/679', '2011/83', '2019/770', '2002/58', '593/2008',
];

const PRESERVE_BRANDS = [
  'TrendTraffic', 'TikTok', 'Instagram', 'YouTube', 'HeyGen', 'ElevenLabs',
  'Google', 'Gemini', 'Anthropic', 'Claude', 'OpenAI', 'FAL.ai', 'Blotato',
  'TikHub', 'Stripe', 'NotebookLM', 'Google Flow', 'Chrome', 'MCP', 'JWT',
  'API', 'BYOK', 'Hostinger', 'UODO', 'Stripe', 'Local Storage',
];

async function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envText = await fs.readFile(path.join(ROOT, '.env.local'), 'utf-8');
    const m = envText.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (m && m[1].trim()) return m[1].trim();
  } catch { /* ok */ }
  return null;
}

/** Плоский обход с поддержкой массивов: privacy.sections.3.b */
function flatten(node, prefix = '', out = {}) {
  if (typeof node === 'string') { out[prefix] = node; return out; }
  if (Array.isArray(node)) {
    node.forEach((v, i) => flatten(v, prefix ? `${prefix}.${i}` : String(i), out));
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

/** Сборка структуры по образцу исходника (форма 1:1, значения из map). */
function rebuild(shape, map, prefix = '') {
  if (typeof shape === 'string') return map[prefix];
  if (Array.isArray(shape)) return shape.map((v, i) => rebuild(v, map, prefix ? `${prefix}.${i}` : String(i)));
  const out = {};
  for (const [k, v] of Object.entries(shape)) out[k] = rebuild(v, map, prefix ? `${prefix}.${k}` : k);
  return out;
}

/** Последовательность HTML-тегов (полные теги с атрибутами) — инвариант перевода. */
const tagSeq = (s) => (String(s).match(/<[^>]+>/g) || []);

function validateValue(src, val) {
  if (typeof val !== 'string' || !val.trim()) return 'empty';
  const low = val.toLowerCase();
  if (low.includes('<script') || low.includes('javascript:') || /<[^>]+\son\w+\s*=/i.test(val)) return 'unsafe';
  const a = tagSeq(src), b = tagSeq(val);
  if (a.length !== b.length || a.some((t, i) => t !== b[i])) return 'tags';
  for (const id of MUST_SURVIVE) {
    if (src.includes(id) && !val.includes(id)) return `id:${id}`;
  }
  return null;
}

function buildPrompt(langCode, langName, batch) {
  return `You are a professional sworn legal translator and a NATIVE SPEAKER of ${langName}. You are translating the official legal documents (Privacy Policy / Terms of Service / Cookie Policy) of TrendTraffic — an EU-based SaaS platform for social-media trend analytics and AI video creation.

TASK: Translate the following English legal texts into ${langName} (${langCode}).

STRICT RULES:
1. Use the formal LEGAL REGISTER of ${langName}, exactly as a qualified lawyer drafting terms of service in ${langName} would write. Natural and idiomatic — never a word-for-word calque.
2. HTML: every value may contain HTML tags (<p>, <ul>, <li>, <b>, <br>, <a href="...">, <i>). Copy every tag VERBATIM — same tags, same attributes, same order, same count. Translate ONLY the human-readable text between tags. Never add, drop, merge or reorder tags. Never translate anything inside attribute values (href, mailto).
3. Keep UNTRANSLATED (verbatim): brand and product names (${PRESERVE_BRANDS.join(', ')}), personal and legal identifiers (LARYSA DANYUK, NIP, REGON and their numbers, postal address lines, phone numbers), email addresses, URLs, technical identifiers (vibevox_token, vibevox_user, tt_cookie_consent, i18nextLng, vibevox_theme, __stripe_mid, __stripe_sid).
4. EU legal acts: use the OFFICIAL name/abbreviation customary in ${langName} legal practice (e.g. GDPR → RODO in Polish, DSGVO in German), keeping the official numbers like "Regulation (EU) 2024/1689", "2016/679", "2011/83/EU", "(EU) 2019/770" intact. On first mention you may keep the English abbreviation in parentheses if that is customary.
5. Dates like "17 July 2026" → natural ${langName} date format. Currency "€49" stays as is. Legal-entity terms (Data Controller, Processor, consumer, withdrawal right) must use the established statutory terminology of ${langName}.
5a. CRITICAL: digits in legal citations (2024/1689, 2016/679, 2011/83, 2019/770, 2002/58, 593/2008), NIP/REGON numbers, phone numbers, cookie lifetimes and technical identifiers must remain WESTERN ARABIC NUMERALS (0-9) exactly as in the source. Never convert these digits to local numeral scripts (Devanagari, Bengali, Burmese, Khmer, Eastern Arabic etc.), even if dates elsewhere use local numerals.
6. Translate EVERY key. Do not add, drop or rename keys. Return ONLY a JSON object mapping each key to its ${langName} translation.

INPUT (key → English):
${JSON.stringify(batch, null, 2)}`;
}

async function callGeminiOnce(apiKey, model, prompt, keys) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const properties = {};
  for (const k of keys) properties[k] = { type: 'string' };
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: { type: 'object', properties, required: keys },
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
    err.retryable = [429, 500, 502, 503, 504].includes(res.status);
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) { const e = new Error('empty'); e.retryable = true; throw e; }
  try { return JSON.parse(text); }
  catch { const e = new Error('non-JSON'); e.retryable = true; throw e; }
}

async function callGemini(apiKey, model, prompt, keys, maxRetries = 6) {
  let last;
  for (let a = 0; a < maxRetries; a++) {
    try { return await callGeminiOnce(apiKey, model, prompt, keys); }
    catch (e) {
      last = e;
      const fetchFail = e.cause?.code === 'UND_ERR_SOCKET' || /fetch failed/i.test(e.message || '');
      if (!e.retryable && !fetchFail) break;
      if (a === maxRetries - 1) break;
      await new Promise((r) => setTimeout(r, 2500 * Math.pow(2, a) + Math.random() * 1000));
    }
  }
  throw last;
}

async function appendProgress(line) {
  try { await fs.appendFile(PROGRESS_LOG, `${new Date().toISOString()} ${line}\n`, 'utf-8'); } catch { /* ok */ }
}

/** Чанки по объёму: секция (h+b) — неделимая единица, meta/ui — по одному ключу. */
function buildChunks(srcFlat) {
  const keys = Object.keys(srcFlat);
  const units = [];
  const seen = new Set();
  for (const k of keys) {
    const m = k.match(/^(.*\.sections)\.(\d+)\.(h|b)$/);
    if (m) {
      const base = `${m[1]}.${m[2]}`;
      if (seen.has(base)) continue;
      seen.add(base);
      units.push([`${base}.h`, `${base}.b`]);
    } else {
      units.push([k]);
    }
  }
  const chunks = [];
  let cur = [];
  let curLen = 0;
  for (const u of units) {
    const len = u.reduce((s, k) => s + srcFlat[k].length, 0);
    if (cur.length && curLen + len > CHUNK_CHARS) { chunks.push(cur); cur = []; curLen = 0; }
    cur.push(...u);
    curLen += len;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Существующий файл валиден? (для пропуска без --refresh-all) */
function isComplete(srcFlat, obj) {
  if (!obj) return false;
  const flat = flatten(obj);
  return Object.keys(srcFlat).every((k) => typeof flat[k] === 'string' && flat[k].trim());
}

async function translateLang({ apiKey, lang, srcShape, srcFlat, chunks }) {
  const langName = LANG_NAMES[lang] || lang;
  const targetPath = path.join(LOCALES_DIR, lang, 'legal.json');

  if (!REFRESH_ALL) {
    try {
      const existing = JSON.parse(await fs.readFile(targetPath, 'utf-8'));
      if (isComplete(srcFlat, existing)) return { lang, langName, translated: 0, skipped: true };
    } catch { /* нет файла — переводим */ }
  }

  const out = {};
  let fellBack = 0;
  const badKeys = [];

  // До 3 чанков одного языка параллельно
  const CHUNK_PAR = 3;
  let ci = 0;
  const chunkResults = new Array(chunks.length);
  await Promise.all(Array.from({ length: Math.min(CHUNK_PAR, chunks.length) }, async () => {
    while (ci < chunks.length) {
      const my = ci++;
      const chunkKeys = chunks[my];
      const batch = {};
      for (const k of chunkKeys) batch[k] = srcFlat[k];
      const prompt = buildPrompt(lang, langName, batch);
      chunkResults[my] = await callGemini(apiKey, MODEL, prompt, chunkKeys);
    }
  }));

  chunks.forEach((chunkKeys, idx) => {
    const res = chunkResults[idx] || {};
    for (const k of chunkKeys) {
      const err = validateValue(srcFlat[k], res[k]);
      if (err) badKeys.push([k, err]);
      else out[k] = res[k];
    }
  });

  // Одиночный ретрай бракованных ключей мини-чанками
  if (badKeys.length) {
    const retryKeys = badKeys.map(([k]) => k);
    for (let i = 0; i < retryKeys.length; i += 4) {
      const part = retryKeys.slice(i, i + 4);
      const batch = {};
      for (const k of part) batch[k] = srcFlat[k];
      try {
        const res = await callGemini(apiKey, MODEL, buildPrompt(lang, langName, batch), part, 3);
        for (const k of part) {
          const err = validateValue(srcFlat[k], res[k]);
          if (!err) out[k] = res[k];
        }
      } catch { /* остаются фолбэком */ }
    }
  }

  for (const k of Object.keys(srcFlat)) {
    if (typeof out[k] !== 'string' || !out[k].trim()) {
      out[k] = srcFlat[k];
      fellBack++;
      await appendProgress(`FALLBACK ${lang} ${k}`);
    }
  }

  const result = rebuild(srcShape, out);
  result._meta = { translatedAt: new Date().toISOString(), source: 'en', model: MODEL, fellBack };
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  return { lang, langName, translated: Object.keys(srcFlat).length, fellBack };
}

async function runWithLimit(items, limit, fn, onEach) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { const r = await fn(items[idx]); results.push(r); await onEach(r, results.length); }
      catch (e) { const r = { lang: items[idx], error: e.message }; results.push(r); await onEach(r, results.length); }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) { console.error('❌ GEMINI_API_KEY not found'); process.exit(1); }

  const srcShape = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, 'en', 'legal.json'), 'utf-8'));
  delete srcShape._meta;
  const srcFlat = flatten(srcShape);
  const chunks = buildChunks(srcFlat);

  const allDirs = (await fs.readdir(LOCALES_DIR)).filter((e) => !e.startsWith('.') && !e.startsWith('_') && e !== 'en');
  let langs = allDirs;
  if (TARGETS) langs = allDirs.filter((l) => TARGETS.includes(l));

  const totalChars = Object.values(srcFlat).reduce((s, v) => s + v.length, 0);
  console.log(`🤖 Model: ${MODEL} | concurrency: ${CONCURRENCY} | refreshAll: ${REFRESH_ALL}`);
  console.log(`📖 en/legal.json: ${Object.keys(srcFlat).length} strings, ${(totalChars / 1024).toFixed(1)} KB, ${chunks.length} chunks/lang`);
  console.log(`🌐 Target languages (${langs.length}): ${langs.join(',')}`);
  await appendProgress(`START targets=${langs.length} keys=${Object.keys(srcFlat).length} chunks=${chunks.length} refreshAll=${REFRESH_ALL}`);

  const t0 = Date.now();
  const results = await runWithLimit(langs, CONCURRENCY,
    (lang) => translateLang({ apiKey, lang, srcShape, srcFlat, chunks }),
    async (r, count) => {
      const line = r.error
        ? `✗ ${r.lang} ERROR: ${String(r.error).slice(0, 140)}`
        : r.skipped
          ? `⏭ ${r.lang} up to date`
          : `✓ ${r.lang} (${r.langName})${r.fellBack ? ` [fallback ${r.fellBack}]` : ''}`;
      console.log(`  ${line}  [${count}/${langs.length}]`);
      await appendProgress(`${line} [${count}/${langs.length}]`);
    });

  const ok = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const fellBack = ok.reduce((s, r) => s + (r.fellBack || 0), 0);
  console.log(`\n🎉 Done in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${ok.length} ok, ${failed.length} failed, EN-fallback values: ${fellBack}.`);
  await appendProgress(`DONE ok=${ok.length} failed=${failed.length} fallback=${fellBack} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (failed.length) { console.log('Failed:'); for (const f of failed) console.log(`   - ${f.lang}: ${String(f.error).slice(0, 160)}`); }
  process.exit(failed.length ? 2 : 0);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
