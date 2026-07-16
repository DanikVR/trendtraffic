#!/usr/bin/env node
/**
 * translate-ext-runtime.mjs — локали ЕДИНОГО Chrome-расширения TrendTraffic.
 *
 * 1) Харвестит T('key','русский фолбэк') из apps/trendtraffic-extension/src/*.js
 *    (+ 3 метаданных манифеста: extName/extDesc/extTitle — русские источники здесь).
 * 2) Пишет _locales/ru/messages.json (источник).
 * 3) Переводит ru → en (нативная база), затем en → остальные локали Chrome.
 *
 * ВАЖНО: Chrome принимает ТОЛЬКО свой список кодов локалей (~54; папка с левым
 * кодом валит установку распакованного расширения) — поэтому здесь фиксированный
 * список CHROME_LOCALES, а не 108 языков приложения.
 *
 * Ключ: GEMINI_API_KEY (env или apps/frontend/.env.local).
 * Опции: --only=de,fr  --model=gemini-2.5-flash  --skip-translate (только harvest+ru)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FE_ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(FE_ROOT, '..', '..');
const EXT = path.join(REPO, 'apps', 'trendtraffic-extension');
const SRC_FILES = ['background.js', 'content-flow.js', 'content-heygen.js', 'content-notebook.js']
  .map((f) => path.join(EXT, 'src', f));

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice(7).split(',').map((s) => s.trim()) : null;
const MODEL = (args.find((a) => a.startsWith('--model=')) || '--model=gemini-2.5-flash').slice(8);
const SKIP_TRANSLATE = args.includes('--skip-translate');

// Русские метаданные манифеста (источник; сам manifest.json уже на __MSG__).
const META_RU = {
  extName: 'TrendTraffic — помощник (Flow · NotebookLM · HeyGen)',
  extDesc: 'Единое расширение TrendTraffic: мост с Google Flow (Veo), Google NotebookLM (Hotebook) и HeyGen (говорящие головы UGC по вашей подписке). Очередь задач в реальном браузере, автоматизация генераций и обмен с Галереей. Ставится один раз — панель включается на том сервисе, где открыта вкладка.',
  extTitle: 'TrendTraffic — помощник (Flow · NotebookLM · HeyGen)',
};

// Официальный список локалей chrome.i18n (en_* варианты опущены — покрывает en).
const CHROME_LOCALES = {
  en: 'English', ru: 'Russian', ar: 'Arabic', am: 'Amharic', bg: 'Bulgarian', bn: 'Bengali',
  ca: 'Catalan', cs: 'Czech', da: 'Danish', de: 'German', el: 'Greek',
  es: 'Spanish', es_419: 'Latin American Spanish', et: 'Estonian', fa: 'Persian',
  fi: 'Finnish', fil: 'Filipino', fr: 'French', gu: 'Gujarati', he: 'Hebrew',
  hi: 'Hindi', hr: 'Croatian', hu: 'Hungarian', id: 'Indonesian', it: 'Italian',
  ja: 'Japanese', kn: 'Kannada', ko: 'Korean', lt: 'Lithuanian', lv: 'Latvian',
  ml: 'Malayalam', mr: 'Marathi', ms: 'Malay', nl: 'Dutch', no: 'Norwegian',
  pl: 'Polish', pt_BR: 'Brazilian Portuguese', pt_PT: 'European Portuguese', ro: 'Romanian',
  sk: 'Slovak', sl: 'Slovenian', sr: 'Serbian', sv: 'Swedish', sw: 'Swahili',
  ta: 'Tamil', te: 'Telugu', th: 'Thai', tr: 'Turkish', uk: 'Ukrainian',
  vi: 'Vietnamese', zh_CN: 'Simplified Chinese', zh_TW: 'Traditional Chinese',
};

const PRESERVE = 'TrendTraffic, Google Flow, Flow, NotebookLM, Hotebook, HeyGen, Veo, TikTok, YouTube, Instagram, UGC';

async function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envText = await fs.readFile(path.join(FE_ROOT, '.env.local'), 'utf-8').catch(() => '');
  const m = envText.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

// T('key', 'фолбэк') | TT_('key', 'фолбэк') — фолбэк в одинарных/двойных кавычках.
const T_RE = /\bTT?_?\(\s*(['"])([a-zA-Z0-9_]+)\1\s*,\s*(['"])((?:\\.|(?!\3)[\s\S])*?)\3\s*\)/g;
const unesc = (s, q) => s.replace(new RegExp(`\\\\${q}`, 'g'), q).replace(/\\n/g, '\n').replace(/\\\\/g, '\\');

async function harvest() {
  const map = { ...META_RU };
  for (const f of SRC_FILES) {
    const src = await fs.readFile(f, 'utf-8');
    let m;
    while ((m = T_RE.exec(src))) {
      const key = m[2];
      const val = unesc(m[4], m[3]);
      if (!(key in map)) map[key] = val;
      else if (map[key] !== val) console.warn(`⚠ конфликт дефолтов ключа ${key}: "${map[key]}" vs "${val}" (взят первый)`);
    }
  }
  return map;
}

async function callGemini(apiKey, langName, code, source, srcName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const keys = Object.keys(source);
  const prompt = `You are a professional native-speaker localizer. Translate these Chrome extension UI strings (panel buttons, statuses, toasts, store metadata) from ${srcName} into ${langName} (${code}).
Rules: natural native app-UI phrasing, keep it short; keep brand names verbatim: ${PRESERVE}; preserve arrows/symbols (↔ ⬇ · —) and emoji; do not add or drop keys.
Return ONLY a JSON object mapping each key to its ${langName} translation.
INPUT:
${JSON.stringify(source, null, 2)}`;
  const properties = {}; for (const k of keys) properties[k] = { type: 'string' };
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3, responseMimeType: 'application/json',
      responseSchema: { type: 'object', properties, required: keys },
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  for (let a = 0; a < 6; a++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { if ([429, 500, 502, 503, 504].includes(res.status)) { await new Promise((r) => setTimeout(r, 2000 * 2 ** a)); continue; } throw new Error(`HTTP ${res.status}`); }
      const data = await res.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (e) { if (a === 5) throw e; await new Promise((r) => setTimeout(r, 2000 * 2 ** a)); }
  }
}

const messagesObj = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { message: v }]));

// Перевод карты целиком, но чанками по 60 ключей (schema на 180+ полей ловит HTTP 400).
async function translateMap(apiKey, langName, code, source, srcName) {
  const keys = Object.keys(source);
  const out = {};
  for (let i = 0; i < keys.length; i += 60) {
    const chunkKeys = keys.slice(i, i + 60);
    const batch = {};
    for (const k of chunkKeys) batch[k] = source[k];
    const part = await callGemini(apiKey, langName, code, batch, srcName);
    Object.assign(out, part);
  }
  return out;
}

async function writeLocale(code, map) {
  const p = path.join(EXT, '_locales', code, 'messages.json');
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(messagesObj(map), null, 2) + '\n', 'utf-8');
}

async function main() {
  const ru = await harvest();
  const n = Object.keys(ru).length;
  console.log(`🔎 Harvested ${n} keys (incl. 3 manifest meta) from ${SRC_FILES.length} files`);
  await writeLocale('ru', ru);
  console.log('💾 _locales/ru/messages.json');
  if (SKIP_TRANSLATE) return;

  const apiKey = await loadApiKey();
  if (!apiKey) { console.error('❌ GEMINI_API_KEY not found'); process.exit(1); }

  // ru → en (база)
  const en = await translateMap(apiKey, 'English', 'en', ru, 'Russian');
  for (const k of Object.keys(ru)) if (typeof en[k] !== 'string' || !en[k].trim()) en[k] = ru[k];
  await writeLocale('en', en);
  console.log('✓ en (база, с русского)');

  // en → остальные
  let codes = Object.keys(CHROME_LOCALES).filter((c) => c !== 'en' && c !== 'ru');
  if (ONLY) codes = codes.filter((c) => ONLY.includes(c));
  let done = 0, failed = [];
  const queue = [...codes];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const code = queue.shift();
      try {
        const out = await translateMap(apiKey, CHROME_LOCALES[code], code, en, 'English');
        for (const k of Object.keys(en)) if (typeof out[k] !== 'string' || !out[k].trim()) out[k] = en[k];
        await writeLocale(code, out);
        done++;
        console.log(`  ✓ ${code} (${CHROME_LOCALES[code]}) [${done}/${codes.length}]`);
      } catch (e) { failed.push(code); console.log(`  ✗ ${code}: ${e.message}`); }
    }
  }));
  console.log(`🎉 ext locales: en+ru+${done} ok, ${failed.length} failed${failed.length ? ' (' + failed.join(',') + ')' : ''}`);
  process.exit(failed.length ? 2 : 0);
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
