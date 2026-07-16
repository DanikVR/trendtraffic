#!/usr/bin/env node
/**
 * translate-sections-gemini.mjs
 *
 * Полный перевод недостающих ключей public/locales/ru/common.json на все
 * поддерживаемые языки через Gemini (Generative Language API). В отличие от
 * translate-locales.mjs (Google Translate v2, полная перезапись) этот скрипт:
 *   • НЕ трогает уже существующие хорошие переводы — переводит только КЛЮЧИ,
 *     которых нет в целевом языке (в первую очередь новый namespace sec.* —
 *     извлечённые из компонентов строки разделов).
 *   • Использует Gemini для естественных, коротких UI-формулировок.
 *   • Сохраняет плейсхолдеры {{var}} и бренд-термины из _glossary.json.
 *   • English (en) переводится как обычный целевой язык — получаем читаемый
 *     естественный английский вместо русского фолбэка.
 *   • Печатает прогресс и сводку каждые 10 языков.
 *
 * Ключ: GEMINI_API_KEY (env или apps/frontend/.env.local).
 *
 * Опции:
 *   --only=en,de,fr        только эти языки
 *   --model=gemini-2.5-flash | gemini-2.5-pro   (default 2.5-flash)
 *   --concurrency=6        параллельные языки
 *   --refresh-sec          переперевести ВСЕ sec.* ключи, даже если уже есть
 *   --refresh-all          переперевести всё (осторожно — перезапишет ручные правки)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;
const modelArg = args.find((a) => a.startsWith('--model='));
const MODEL = modelArg ? modelArg.slice('--model='.length) : 'gemini-2.5-flash';
const concArg = args.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = concArg ? Math.max(1, parseInt(concArg.slice('--concurrency='.length), 10)) : 6;
const REFRESH_SEC = args.includes('--refresh-sec');
const REFRESH_ALL = args.includes('--refresh-all');

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
  sm: 'Samoan', gd: 'Scots Gaelic', sr: 'Serbian', st: 'Sesotho',
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

function buildPrompt(langCode, langName, batch, preserveList) {
  return `You are a professional UI localizer for TrendTraffic — a web app for finding social-media trends and generating short-form videos (TikTok / YouTube Shorts / Reels): trend search & analytics, an AI UGC/avatar video studio, a montage/flow editor, a media gallery, and a social publisher.

TASK: Translate the following Russian UI strings into ${langName} (${langCode}).

RULES:
- Natural, idiomatic ${langName} as a native speaker would write app UI — NOT literal word-for-word.
- Keep it SHORT: these are buttons, tab labels, menu items, tooltips, headings and short messages. Match the length/register of app UI.
- Preserve EXACTLY every placeholder token like {{count}}, {{n}}, {{name}} — same tokens, do not translate or reorder their names.
- Keep these brand / product / technical terms UNTRANSLATED (verbatim): ${preserveList}.
- Preserve leading/trailing punctuation and symbols (·, :, —, %, €, emoji) where they belong.
- Return translation for EVERY key. Do not add, drop, or rename keys.

Return ONLY a JSON object mapping each key to its ${langName} translation.

INPUT (key → Russian):
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

async function translateLang({ apiKey, lang, ruFlat, ruObj, preserveList }) {
  const langName = LANG_NAMES[lang] || lang;
  const targetPath = path.join(LOCALES_DIR, lang, 'common.json');
  let target = {};
  try { target = JSON.parse(await fs.readFile(targetPath, 'utf-8')); } catch { /* new file */ }
  const targetFlat = flatten(target);

  // Which keys to translate for this language.
  const keys = Object.keys(ruFlat).filter((k) => {
    if (REFRESH_ALL) return true;
    if (k.startsWith('sec.')) {
      if (REFRESH_SEC) return true;
      // sec.* is new: translate if missing OR still equal to the Russian fallback.
      return !(k in targetFlat) || targetFlat[k] === ruFlat[k];
    }
    return !(k in targetFlat); // otherwise: only fill genuine gaps
  });

  if (keys.length === 0) return { lang, langName, translated: 0, skipped: true };

  const CHUNK = 60;
  let translatedCount = 0;
  const result = JSON.parse(JSON.stringify(target)); // clone, keep existing
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunkKeys = keys.slice(i, i + CHUNK);
    const batch = {};
    for (const k of chunkKeys) batch[k] = ruFlat[k];
    const prompt = buildPrompt(lang, langName, batch, preserveList);
    const out = await callGemini(apiKey, MODEL, prompt, chunkKeys);
    for (const k of chunkKeys) {
      let val = out?.[k];
      if (typeof val !== 'string' || !val.trim()) val = ruFlat[k]; // fall back to Russian source
      // Placeholder guard: if ru had placeholders and translation lost/changed them, keep ru.
      const ruPH = phVariants(ruFlat[k]);
      if (ruPH.length && JSON.stringify(ruPH) !== JSON.stringify(phVariants(val))) val = ruFlat[k];
      setByPath(result, k, val);
      translatedCount++;
    }
  }

  // Ensure structural parity for sec.* (so nested shape matches ru).
  result._meta = { ...(result._meta || {}), geminiSectionsAt: new Date().toISOString(), geminiModel: MODEL };
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
  return { lang, langName, translated: translatedCount };
}

async function runWithLimit(items, limit, fn, onEach) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { const r = await fn(items[idx]); results.push(r); onEach(r, results.length); }
      catch (e) { const r = { lang: items[idx], error: e.message }; results.push(r); onEach(r, results.length); }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) { console.error('❌ GEMINI_API_KEY not found'); process.exit(1); }

  const ruObj = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, 'ru', 'common.json'), 'utf-8'));
  const ruFlat = flatten(ruObj);
  const glossary = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, '_glossary.json'), 'utf-8'));
  const preserveList = (glossary.preserve || []).concat(glossary.preserveTiers || []).join(', ');

  const allDirs = (await fs.readdir(LOCALES_DIR)).filter((e) => !e.startsWith('.') && !e.startsWith('_'));
  let langs = allDirs.filter((l) => l !== 'ru');
  if (ONLY) langs = langs.filter((l) => ONLY.includes(l));

  const secCount = Object.keys(ruFlat).filter((k) => k.startsWith('sec.')).length;
  console.log(`🤖 Model: ${MODEL} | concurrency: ${CONCURRENCY}`);
  console.log(`📖 ru/common.json: ${Object.keys(ruFlat).length} keys (sec.* new: ${secCount})`);
  console.log(`🌐 Target languages: ${langs.length}`);
  console.log('');

  const t0 = Date.now();
  let done = 0, okCount = 0;
  const results = await runWithLimit(langs, CONCURRENCY,
    (lang) => translateLang({ apiKey, lang, ruFlat, ruObj, preserveList }),
    (r, count) => {
      done = count;
      if (!r.error) okCount++;
      if (r.error) console.log(`  ✗ ${String(r.lang).padEnd(5)} ERROR: ${r.error?.slice(0, 120)}`);
      else if (r.skipped) console.log(`  ⏭ ${r.lang.padEnd(5)} up to date`);
      else console.log(`  ✓ ${r.lang.padEnd(5)} ${r.langName.padEnd(20)} +${r.translated} keys`);
      if (done % 10 === 0) {
        console.log(`  ── progress: ${done}/${langs.length} languages (${okCount} ok) · ${((Date.now() - t0) / 1000).toFixed(0)}s ──`);
      }
    });

  const ok = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const totalKeys = ok.reduce((s, r) => s + (r.translated || 0), 0);
  console.log('');
  console.log(`🎉 Done in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${ok.length} ok, ${failed.length} failed, ${totalKeys} keys translated.`);
  if (failed.length) { console.log('Failed:'); for (const f of failed) console.log(`   - ${f.lang}: ${f.error?.slice(0, 160)}`); }
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
