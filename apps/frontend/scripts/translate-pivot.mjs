#!/usr/bin/env node
/**
 * translate-pivot.mjs — перевод локалей с ПИВОТОМ через английский.
 *
 * Схема (16.07.2026): ru/common.json — исходник (русские тексты из кода).
 *   Шаг 1: --source=ru --targets=en --refresh-all   → нативный английский (БАЗА).
 *   Шаг 2: --source=en --refresh-all                → все остальные языки С АНГЛИЙСКОГО
 *          (по умолчанию targets = все папки локалей, кроме source и ru).
 *
 * Отличия от translate-sections-gemini.mjs:
 *   • Источник параметризован (--source=ru|en).
 *   • Усиленный промпт «native speaker, продуктовый UI-копирайт».
 *   • Прогресс пишется и в stdout, и в _pivot_progress.log (по языку на строку).
 *
 * Ключ: GEMINI_API_KEY (env или apps/frontend/.env.local).
 * Опции: --source=en --targets=de,fr --exclude=ru --model=gemini-2.5-flash
 *        --concurrency=8 --chunk=60 --refresh-all (иначе только недостающие ключи)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const PROGRESS_LOG = path.join(ROOT, 'scripts', '_pivot_progress.log');

const args = process.argv.slice(2);
const getArg = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const SOURCE = getArg('source', 'en');
const TARGETS = getArg('targets', '') ? getArg('targets', '').split(',').map((s) => s.trim()).filter(Boolean) : null;
const EXCLUDE = new Set((getArg('exclude', 'ru') || '').split(',').map((s) => s.trim()).filter(Boolean));
const MODEL = getArg('model', 'gemini-2.5-flash');
const CONCURRENCY = Math.max(1, parseInt(getArg('concurrency', '8'), 10));
const CHUNK = Math.max(10, parseInt(getArg('chunk', '60'), 10));
const REFRESH_ALL = args.includes('--refresh-all');
// Файл локали: common.json по умолчанию; social-ext.json — подписи рехостнутого расширения.
const FILE = getArg('file', 'common.json');

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

async function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envText = await fs.readFile(path.join(ROOT, '.env.local'), 'utf-8');
    const m = envText.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (m && m[1].trim()) return m[1].trim();
  } catch { /* ok */ }
  return null;
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, full, out);
    else if (typeof v === 'string') out[full] = v;
  }
  return out;
}

function setByPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const phVariants = (s) => Array.from(String(s).matchAll(/\{\{[^}]+\}\}/g)).map((m) => m[0]).sort();

function buildPrompt(langCode, langName, srcName, batch, preserveList) {
  const enBase = langCode === 'en'
    ? `\nSPECIAL: You are writing the PRIMARY English base copy of the product (English is the app's base language; all other languages will be translated FROM your output). Write it as a senior product copywriter at a US SaaS company would: crisp, concrete, sentence case for buttons/labels (not Title Case), no awkward calques from Russian.`
    : '';
  return `You are a professional native-speaker UI localizer for TrendTraffic — a web app for finding social-media trends and generating short-form videos (TikTok / YouTube Shorts / Reels): trend search & analytics, audience targeting, an AI UGC/avatar video studio (HeyGen avatars, ElevenLabs voices), a montage/flow editor, NotebookLM-powered content studio, a media gallery, and a social publisher.${enBase}

TASK: Translate the following ${srcName} UI strings into ${langName} (${langCode}).

RULES:
- Natural, idiomatic ${langName} exactly as a NATIVE SPEAKER would write app UI — never literal word-for-word.
- Keep it SHORT: buttons, tab labels, menu items, tooltips, headings, toasts. Match the register of polished app UI.
- Preserve EXACTLY every placeholder like {{count}}, {{n}}, {{name}} — same tokens, do not translate, rename or reorder them.
- Keep these brand / product / technical terms UNTRANSLATED (verbatim): ${preserveList}.
- Preserve leading/trailing punctuation and symbols (·, :, —, %, €, emoji) where they belong.
- Return a translation for EVERY key. Do not add, drop, or rename keys.

Return ONLY a JSON object mapping each key to its ${langName} translation.

INPUT (key → ${srcName}):
${JSON.stringify(batch, null, 2)}`;
}

async function callGeminiOnce(apiKey, model, prompt, keys) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const properties = {};
  for (const k of keys) properties[k] = { type: 'string' };
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: { type: 'object', properties, required: keys },
      // Переводу «рассуждения» не нужны — без этого каждый батч думает ~10с.
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

async function translateLang({ apiKey, lang, srcFlat, srcName, preserveList }) {
  const langName = LANG_NAMES[lang] || lang;
  const targetPath = path.join(LOCALES_DIR, lang, FILE);
  let target = {};
  try { target = JSON.parse(await fs.readFile(targetPath, 'utf-8')); } catch { /* new file */ }
  const targetFlat = flatten(target);

  const keys = Object.keys(srcFlat).filter((k) => REFRESH_ALL ? true : !(k in targetFlat));
  if (keys.length === 0) return { lang, langName, translated: 0, skipped: true };

  let translatedCount = 0;
  let fellBack = 0;
  const result = JSON.parse(JSON.stringify(target));
  const chunks = [];
  for (let i = 0; i < keys.length; i += CHUNK) chunks.push(keys.slice(i, i + CHUNK));
  // До 3 батчей одного языка летят параллельно — иначе язык тянется цепочкой.
  const CHUNK_PAR = 3;
  let ci = 0;
  const chunkResults = new Array(chunks.length);
  await Promise.all(Array.from({ length: Math.min(CHUNK_PAR, chunks.length) }, async () => {
    while (ci < chunks.length) {
      const my = ci++;
      const chunkKeys = chunks[my];
      const batch = {};
      for (const k of chunkKeys) batch[k] = srcFlat[k];
      const prompt = buildPrompt(lang, langName, srcName, batch, preserveList);
      chunkResults[my] = await callGemini(apiKey, MODEL, prompt, chunkKeys);
    }
  }));
  chunks.forEach((chunkKeys, idx) => {
    const out = chunkResults[idx];
    for (const k of chunkKeys) {
      let val = out?.[k];
      if (typeof val !== 'string' || !val.trim()) { val = srcFlat[k]; fellBack++; }
      const srcPH = phVariants(srcFlat[k]);
      if (srcPH.length && JSON.stringify(srcPH) !== JSON.stringify(phVariants(val))) { val = srcFlat[k]; fellBack++; }
      setByPath(result, k, val);
      translatedCount++;
    }
  });

  result._meta = { ...(result._meta || {}), pivotAt: new Date().toISOString(), pivotSource: SOURCE, pivotModel: MODEL };
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  return { lang, langName, translated: translatedCount, fellBack };
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

  const srcObj = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, SOURCE, FILE), 'utf-8'));
  const srcFlat = flatten(srcObj);
  const srcName = LANG_NAMES[SOURCE] || SOURCE;
  const glossary = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, '_glossary.json'), 'utf-8'));
  const preserveList = (glossary.preserve || []).concat(glossary.preserveTiers || []).join(', ');

  const allDirs = (await fs.readdir(LOCALES_DIR)).filter((e) => !e.startsWith('.') && !e.startsWith('_'));
  let langs = allDirs.filter((l) => l !== SOURCE && !EXCLUDE.has(l));
  if (TARGETS) langs = allDirs.filter((l) => TARGETS.includes(l));

  console.log(`🤖 Model: ${MODEL} | source: ${SOURCE} (${srcName}) | concurrency: ${CONCURRENCY} | refreshAll: ${REFRESH_ALL}`);
  console.log(`📖 ${SOURCE}/${FILE}: ${Object.keys(srcFlat).length} keys`);
  console.log(`🌐 Target languages (${langs.length}): ${langs.join(',')}`);
  await appendProgress(`START source=${SOURCE} targets=${langs.length} keys=${Object.keys(srcFlat).length} refreshAll=${REFRESH_ALL}`);

  const t0 = Date.now();
  let okCount = 0;
  const results = await runWithLimit(langs, CONCURRENCY,
    (lang) => translateLang({ apiKey, lang, srcFlat, srcName, preserveList }),
    async (r, count) => {
      if (!r.error) okCount++;
      const line = r.error
        ? `✗ ${r.lang} ERROR: ${String(r.error).slice(0, 140)}`
        : r.skipped
          ? `⏭ ${r.lang} up to date`
          : `✓ ${r.lang} (${r.langName}) +${r.translated} keys${r.fellBack ? ` [fallback ${r.fellBack}]` : ''}`;
      console.log(`  ${line}  [${count}/${langs.length}]`);
      await appendProgress(`${line} [${count}/${langs.length}]`);
    });

  const ok = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const totalKeys = ok.reduce((s, r) => s + (r.translated || 0), 0);
  console.log(`\n🎉 Done in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${ok.length} ok, ${failed.length} failed, ${totalKeys} keys translated.`);
  await appendProgress(`DONE ok=${ok.length} failed=${failed.length} keys=${totalKeys} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (failed.length) { console.log('Failed:'); for (const f of failed) console.log(`   - ${f.lang}: ${String(f.error).slice(0, 160)}`); }
  process.exit(failed.length ? 2 : 0);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
