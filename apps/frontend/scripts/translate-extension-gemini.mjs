#!/usr/bin/env node
/**
 * translate-extension-gemini.mjs
 *
 * Генерирует _locales/<code>/messages.json (Chrome i18n) для расширений на все
 * поддерживаемые языки через Gemini. Метаданные (имя + описание) — то, что видно
 * в chrome://extensions и в сторе.
 *
 *   • social-ext  — источник уже английский (_locales/en/messages.json).
 *   • flow-ext    — источник задаём здесь (английские name/description); скрипт
 *                   также умеет проставить default_locale и __MSG__ в manifest
 *                   при флаге --wire-flow-manifest.
 *
 * Ключ: GEMINI_API_KEY. Опции: --only=de,fr  --model=gemini-2.5-flash  --wire-flow-manifest
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FE_ROOT = path.resolve(__dirname, '..');                 // apps/frontend
const REPO = path.resolve(FE_ROOT, '..', '..');                // repo root
const SOCIAL = path.join(FE_ROOT, 'public', 'social-ext');
const FLOW = path.join(REPO, 'apps', 'flow-extension');

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : null;
const modelArg = args.find((a) => a.startsWith('--model='));
const MODEL = modelArg ? modelArg.slice('--model='.length) : 'gemini-2.5-flash';
const WIRE_FLOW = args.includes('--wire-flow-manifest');

// Chrome uses ISO-639-1; our full code set (matches SUPPORTED_LANGUAGES).
const CODES = ['af','sq','am','ar','hy','az','eu','be','bn','bs','bg','ca','ceb','zh','co','hr','cs','da','nl','en','eo','et','fi','fr','fy','gl','ka','de','el','gu','ht','ha','haw','he','hi','hmn','hu','is','ig','id','ga','it','ja','jv','kn','kk','km','rw','ko','ku','ky','lo','la','lv','lt','lb','mk','mg','ms','ml','mt','mi','mr','mn','my','ne','no','ny','or','ps','fa','pl','pt','pa','ro','sm','gd','sr','st','sn','sd','si','sk','sl','so','es','su','sw','sv','tl','tg','ta','tt','te','th','tr','tk','uk','ur','ug','uz','vi','cy','xh','yi','yo','zu','ru'];

const LANG_NAMES = { af:'Afrikaans',sq:'Albanian',am:'Amharic',ar:'Arabic',hy:'Armenian',az:'Azerbaijani',eu:'Basque',be:'Belarusian',bn:'Bengali',bs:'Bosnian',bg:'Bulgarian',ca:'Catalan',ceb:'Cebuano',zh:'Chinese',co:'Corsican',hr:'Croatian',cs:'Czech',da:'Danish',nl:'Dutch',en:'English',eo:'Esperanto',et:'Estonian',fi:'Finnish',fr:'French',fy:'Frisian',gl:'Galician',ka:'Georgian',de:'German',el:'Greek',gu:'Gujarati',ht:'Haitian Creole',ha:'Hausa',haw:'Hawaiian',he:'Hebrew',hi:'Hindi',hmn:'Hmong',hu:'Hungarian',is:'Icelandic',ig:'Igbo',id:'Indonesian',ga:'Irish',it:'Italian',ja:'Japanese',jv:'Javanese',kn:'Kannada',kk:'Kazakh',km:'Khmer',rw:'Kinyarwanda',ko:'Korean',ku:'Kurdish',ky:'Kyrgyz',lo:'Lao',la:'Latin',lv:'Latvian',lt:'Lithuanian',lb:'Luxembourgish',mk:'Macedonian',mg:'Malagasy',ms:'Malay',ml:'Malayalam',mt:'Maltese',mi:'Maori',mr:'Marathi',mn:'Mongolian',my:'Burmese',ne:'Nepali',no:'Norwegian',ny:'Chichewa',or:'Odia',ps:'Pashto',fa:'Persian',pl:'Polish',pt:'Portuguese',pa:'Punjabi',ro:'Romanian',ru:'Russian',sm:'Samoan',gd:'Scots Gaelic',sr:'Serbian',st:'Sesotho',sn:'Shona',sd:'Sindhi',si:'Sinhala',sk:'Slovak',sl:'Slovenian',so:'Somali',es:'Spanish',su:'Sundanese',sw:'Swahili',sv:'Swedish',tl:'Tagalog',tg:'Tajik',ta:'Tamil',tt:'Tatar',te:'Telugu',th:'Thai',tr:'Turkish',tk:'Turkmen',uk:'Ukrainian',ur:'Urdu',ug:'Uyghur',uz:'Uzbek',vi:'Vietnamese',cy:'Welsh',xh:'Xhosa',yi:'Yiddish',yo:'Yoruba',zu:'Zulu' };

const PRESERVE = 'TrendTraffic, Google Flow, TikHub, TikTok, Douyin, Instagram, Bilibili, X, Veo';

async function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envText = await fs.readFile(path.join(FE_ROOT, '.env.local'), 'utf-8').catch(() => '');
  const m = envText.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

async function callGemini(apiKey, langName, langCode, source) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const prompt = `Translate these Chrome extension store metadata strings into ${langName} (${langCode}). Keep brand/product names verbatim: ${PRESERVE}. Keep it concise and natural. Preserve the arrow symbol ↔ and ⬇ if present.\n\nInput JSON (key → English):\n${JSON.stringify(source, null, 2)}\n\nReturn ONLY a JSON object with the same keys, values translated.`;
  const keys = Object.keys(source);
  const properties = {}; for (const k of keys) properties[k] = { type: 'string' };
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema: { type: 'object', properties, required: keys } } };
  for (let a = 0; a < 5; a++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { if ([429,500,502,503,504].includes(res.status)) { await new Promise(r=>setTimeout(r,2000*2**a)); continue; } throw new Error(`${res.status}`); }
      const data = await res.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (e) { if (a === 4) throw e; await new Promise(r=>setTimeout(r,2000*2**a)); }
  }
}

// Build a Chrome messages.json object from flat {msgKey: text} + descriptions.
function messagesObj(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) out[k] = { message: v };
  return out;
}

async function generateFor(name, dir, source, apiKey) {
  const localesDir = path.join(dir, '_locales');
  let codes = CODES;
  if (ONLY) codes = codes.filter((c) => ONLY.includes(c));
  console.log(`\n📦 ${name}: ${codes.length} locales → ${path.relative(REPO, localesDir)}`);
  let done = 0, failed = 0;
  for (const code of codes) {
    const target = path.join(localesDir, code, 'messages.json');
    try {
      let map;
      if (code === 'en') map = source;
      else map = await callGemini(apiKey, LANG_NAMES[code] || code, code, source);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(messagesObj(map), null, 3) + '\n', 'utf-8');
      done++;
    } catch (e) { failed++; console.log(`   ✗ ${code}: ${e.message}`); }
    if ((done + failed) % 10 === 0) console.log(`   ── ${done + failed}/${codes.length} (${done} ok, ${failed} failed) ──`);
  }
  console.log(`   ✓ ${name}: ${done} ok, ${failed} failed`);
}

async function main() {
  const apiKey = await loadApiKey();
  if (!apiKey) { console.error('❌ GEMINI_API_KEY not found'); process.exit(1); }
  console.log(`🤖 ${MODEL}`);

  // social-ext source: existing English messages.
  const socialSrc = JSON.parse(await fs.readFile(path.join(SOCIAL, '_locales', 'en', 'messages.json'), 'utf-8'));
  const socialFlat = Object.fromEntries(Object.entries(socialSrc).map(([k, v]) => [k, v.message]));
  await generateFor('social-ext', SOCIAL, socialFlat, apiKey);

  // flow-extension source: English name/description (manifest is Russian today).
  const flowFlat = {
    extName: 'TrendTraffic ↔ Google Flow',
    extDescription: 'Bridge between TrendTraffic and Google Flow: injects data from the service, automates generation (Veo 3.1) and returns finished videos to the Gallery.',
  };
  await generateFor('flow-extension', FLOW, flowFlat, apiKey);

  if (WIRE_FLOW) {
    const mfPath = path.join(FLOW, 'manifest.json');
    const mf = JSON.parse(await fs.readFile(mfPath, 'utf-8'));
    mf.default_locale = 'en';
    mf.name = '__MSG_extName__';
    mf.description = '__MSG_extDescription__';
    await fs.writeFile(mfPath, JSON.stringify(mf, null, 2) + '\n', 'utf-8');
    console.log('🔧 flow-extension manifest wired to __MSG__ + default_locale=en');
  }
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
