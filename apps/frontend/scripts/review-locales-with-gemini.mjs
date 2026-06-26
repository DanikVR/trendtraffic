#!/usr/bin/env node
/**
 * review-locales-with-gemini.mjs
 *
 * Safe-mode пост-ревью переводов через Gemini API. Цель: поймать ЯВНЫЕ
 * ошибки Google Translate (контекст, бренды, неверный смысл слова) для
 * каждого из 108 языков, БЕЗ полного переписывания (которое может зацепить
 * уже хорошие переводы).
 *
 * Поток:
 *   1. Читает public/locales/ru/common.json (источник истины).
 *   2. Читает public/locales/_glossary.json (бренды, preserve-список).
 *   3. Для каждого языка из SUPPORTED_LANGUAGES (кроме ru):
 *      a. Загружает текущий <lang>/common.json.
 *      b. Строит prompt: pairs {ru: source, current: translation}.
 *      c. Зовёт Gemini с responseMimeType=application/json + responseSchema.
 *      d. Получает {fixes: [{path, current, proposed, reason}]}.
 *      e. Если --apply: применяет фиксы in-place к <lang>/common.json.
 *      f. Пишет отчёт в reports/llm-review/<lang>.md (всегда, для аудита).
 *
 * Опции:
 *   --apply           применить фиксы к файлам (по умолчанию dry-run, только отчёт)
 *   --only=lang1,lang2  ограничить набор языков (тестовый прогон)
 *   --model=gemini-2.5-flash | gemini-2.5-pro   (по умолчанию: 2.5-flash)
 *   --concurrency=5   параллельные запросы к API
 *   --skip-if-fresh   пропустить языки, чей _meta.geminiSourceHash совпадает
 *                     с хэшем текущего ru/common.json (используется в predeploy
 *                     — гоняем Gemini только когда источник реально менялся,
 *                     экономит $ на каждом деплое)
 *
 * Стоимость (gemini-2.5-flash, ~810 ключей × 108 языков):
 *   • input  ~10–15k токенов на язык
 *   • output ~500–1500 токенов (только diff)
 *   • Полный прогон ~$0.30–1
 *
 * Ключ:
 *   • env GEMINI_API_KEY (рекомендую — отдельный ключ из aistudio.google.com)
 *   • fallback env GOOGLE_TRANSLATE_API_KEY (если на нём включён Generative
 *     Language API в том же GCP-проекте — работает; если нет — 403)
 *   • .env.local в apps/frontend/ тоже подхватывается
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'public', 'locales');
const REPORTS_DIR = path.join(ROOT, 'reports', 'llm-review');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;
const modelArg = args.find((a) => a.startsWith('--model='));
const MODEL = modelArg ? modelArg.slice('--model='.length) : 'gemini-2.5-flash';
const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = concurrencyArg ? Math.max(1, parseInt(concurrencyArg.slice('--concurrency='.length), 10)) : 5;
const SKIP_IF_FRESH = args.includes('--skip-if-fresh');

// ── Загружаем API-ключ ──────────────────────────────────────────────────────
async function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, source: 'env:GEMINI_API_KEY' };
  if (process.env.GOOGLE_TRANSLATE_API_KEY) return { key: process.env.GOOGLE_TRANSLATE_API_KEY, source: 'env:GOOGLE_TRANSLATE_API_KEY' };
  try {
    const envText = await fs.readFile(path.join(ROOT, '.env.local'), 'utf-8');
    const matchGemini = envText.match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (matchGemini) return { key: matchGemini[1].trim(), source: '.env.local:GEMINI_API_KEY' };
    const matchTr = envText.match(/^GOOGLE_TRANSLATE_API_KEY\s*=\s*(.+)$/m);
    if (matchTr) return { key: matchTr[1].trim(), source: '.env.local:GOOGLE_TRANSLATE_API_KEY' };
  } catch { /* ok */ }
  return null;
}

// ── Список целевых языков (берём из ru/common.json директорий) ──────────────
async function loadLanguageList() {
  const entries = await fs.readdir(LOCALES_DIR);
  return entries
    .filter((e) => !e.startsWith('.') && !e.startsWith('_'))
    .filter((e) => e !== 'ru'); // ru — источник
}

// ── Плоский обход вложенного JSON ──────────────────────────────────────────
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue; // _meta, _comment пропускаем
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, full, out);
    else if (typeof v === 'string') out[full] = v;
  }
  return out;
}

function setByPath(obj, dottedPath, value) {
  const parts = dottedPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

// ── Промт для одного языка ──────────────────────────────────────────────────
function buildPrompt(langCode, langName, ruFlat, targetFlat, glossary) {
  const pairs = {};
  for (const key of Object.keys(ruFlat)) {
    if (!(key in targetFlat)) continue;
    pairs[key] = { ru: ruFlat[key], current: targetFlat[key] };
  }

  const preserveList = (glossary.preserve || []).concat(glossary.preserveTiers || []).join(', ');
  const specialNotes = glossary._specialCases
    ? Object.entries(glossary._specialCases)
        .filter(([k]) => k !== 'comment')
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')
    : '';

  return `You are reviewing UI translations for VibeVox — a real-time AI voice translation app (video calls, SIP telephony, AI subtitles, Enterprise chat).

SOURCE LANGUAGE: Russian (ru)
TARGET LANGUAGE: ${langName} (${langCode})

PRESERVE THESE EXACTLY (do NOT translate):
${preserveList}

KNOWN FAILURE MODES TO LOOK FOR:
${specialNotes}

UI CONTEXT — strings are used in:
- nav.*, sidebar.*, moreSheet.* — short menu labels (typically 1-3 words)
- rooms.*, sip.*, enterprise.*, chat.* — section headings + button labels + form labels
- call.*, coach.*, postCallInsights.* — in-call UI, modals, AI assistant
- billingPage.* — pricing tiers + FAQ + marketing copy (can be 1-2 sentences)
- auth.* — login/register/forgot-password forms
- *.placeholder, *.label, *.hint — form metadata

YOUR TASK: Identify CLEAR translation errors in the target language and propose fixes. Be CONSERVATIVE — only flag a fix if you are confident the current value is wrong or significantly suboptimal. Do NOT flag stylistic preferences. Common errors to catch:

1. WRONG WORD SENSE: e.g. "Trial" translated as legal trial/court (محاكمة, Versuch, Duruşma) instead of subscription trial period.
2. BRAND/PRODUCT NAMES translated when they should be preserved (VibeVox, VibeAdd, Quest Flow, Stripe, etc.)
3. OBVIOUSLY WRONG GRAMMAR — incorrect plural form, wrong gender agreement, missing article.
4. EXCESSIVE LENGTH for button labels (nav, rooms.actions, common.cancel/save — should be short).
5. LITERAL WORD-BY-WORD translation of idioms that loses meaning.
6. PLACEHOLDER PRESERVATION: {{count}}, {{name}}, {{room}}, {{error}}, {{price}} etc. must remain intact in the proposed value.

DO NOT FLAG:
- Stylistic preferences ("could be more natural")
- Re-orderings without semantic improvement
- Subjective tone choices unless clearly wrong
- Strings that look fine even if you'd phrase differently

OUTPUT: Return ONLY a JSON object matching this schema:
{
  "fixes": [
    {
      "path": "dotted.key.path",
      "current": "the existing translation",
      "proposed": "your improved version",
      "reason": "short reason (max 80 chars)"
    }
  ]
}

If no fixes needed return {"fixes": []}.

HERE IS THE TRANSLATION TABLE (ru source → current ${langCode} translation):
${JSON.stringify(pairs, null, 2)}
`;
}

// ── Вызов Gemini с retry на 503/429/fetch-failures ─────────────────────────
async function callGeminiOnce(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          fixes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path:     { type: 'string' },
                current:  { type: 'string' },
                proposed: { type: 'string' },
                reason:   { type: 'string' },
              },
              required: ['path', 'current', 'proposed', 'reason'],
            },
          },
        },
        required: ['fixes'],
      },
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Gemini API ${res.status}: ${text.slice(0, 500)}`);
    err.status = res.status;
    err.retryable = res.status === 429 || res.status === 503 || res.status === 500 || res.status === 502 || res.status === 504;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const err = new Error('Gemini returned no text');
    err.retryable = true;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    const err = new Error(`Gemini returned non-JSON: ${text.slice(0, 300)}`);
    err.retryable = true; // Часто это обрезанный JSON — повторим
    throw err;
  }
}

async function callGemini(apiKey, model, prompt, maxRetries = 5) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callGeminiOnce(apiKey, model, prompt);
    } catch (e) {
      lastErr = e;
      // Retry на сетевых fetch-failures и 5xx/429
      const isFetchFail = (e.cause?.code === 'UND_ERR_SOCKET' || /fetch failed/i.test(e.message || ''));
      if (!e.retryable && !isFetchFail) break;
      if (attempt === maxRetries - 1) break;
      // Exponential backoff: 3s, 6s, 12s, 24s — Gemini обычно отходит от 503 за минуту.
      const wait = 3000 * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ── Имя языка для prompt (читаем из ru/common.json languagePicker.button + lang code) ─
const LANG_NAMES = {
  af: 'Afrikaans', sq: 'Albanian', am: 'Amharic', ar: 'Arabic', hy: 'Armenian',
  az: 'Azerbaijani', eu: 'Basque', be: 'Belarusian', bn: 'Bengali', bs: 'Bosnian',
  bg: 'Bulgarian', ca: 'Catalan', ceb: 'Cebuano', zh: 'Chinese', co: 'Corsican',
  hr: 'Croatian', cs: 'Czech', da: 'Danish', nl: 'Dutch', en: 'English',
  eo: 'Esperanto', et: 'Estonian', fi: 'Finnish', fr: 'French', fy: 'Frisian',
  gl: 'Galician', ka: 'Georgian', de: 'German', el: 'Greek', gu: 'Gujarati',
  ht: 'Haitian Creole', ha: 'Hausa', haw: 'Hawaiian', he: 'Hebrew', hi: 'Hindi',
  hmn: 'Hmong', hu: 'Hungarian', is: 'Icelandic', ig: 'Igbo', id: 'Indonesian',
  ga: 'Irish', it: 'Italian', ja: 'Japanese', jv: 'Javanese', kn: 'Kannada',
  kk: 'Kazakh', km: 'Khmer', rw: 'Kinyarwanda', ko: 'Korean', ku: 'Kurdish',
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

// ── Обработка одного языка ──────────────────────────────────────────────────
async function reviewLanguage({ apiKey, model, lang, ruFlat, glossary, sourceHash }) {
  const langName = LANG_NAMES[lang] || lang;
  const targetPath = path.join(LOCALES_DIR, lang, 'common.json');
  const targetRaw = await fs.readFile(targetPath, 'utf-8');
  const target = JSON.parse(targetRaw);

  // skip-if-fresh: если предыдущий ревью был для того же снапшота ru, и нет
  // needsRefresh — пропускаем. Сохраняем $ на повторных деплоях.
  if (SKIP_IF_FRESH
      && target._meta?.geminiSourceHash === sourceHash
      && !target._meta?.needsRefresh) {
    return { lang, langName, dt: '0.0', proposed: 0, valid: 0, applied: 0, skipped: true };
  }

  const targetFlat = flatten(target);

  const prompt = buildPrompt(lang, langName, ruFlat, targetFlat, glossary);
  const t0 = Date.now();
  const result = await callGemini(apiKey, model, prompt);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  const fixes = Array.isArray(result?.fixes) ? result.fixes : [];
  // Защита: не применяем фиксы, ломающие плейсхолдеры.
  const ruPlaceholders = (s) => Array.from(String(s).matchAll(/\{\{[^}]+\}\}/g)).map((m) => m[0]).sort();
  const validFixes = fixes.filter((f) => {
    const cur = targetFlat[f.path];
    if (cur === undefined) return false; // путь не существует
    if (cur === f.proposed) return false; // ничего не меняется
    // Сравниваем плейсхолдеры в исходной ru-строке и в proposed: должны совпадать.
    const ruVal = ruFlat[f.path] || '';
    const ruPH = ruPlaceholders(ruVal);
    const propPH = ruPlaceholders(f.proposed);
    if (ruPH.length && JSON.stringify(ruPH) !== JSON.stringify(propPH)) return false;
    return true;
  });

  // Пишем отчёт
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `${lang}.md`);
  const reportLines = [
    `# LLM Review: ${langName} (${lang})`,
    ``,
    `**Model:** ${model}  `,
    `**Took:** ${dt}s  `,
    `**Fixes proposed:** ${fixes.length} (valid after placeholder-check: ${validFixes.length})  `,
    `**Applied:** ${APPLY ? 'yes' : 'no (dry-run)'}`,
    ``,
  ];
  if (validFixes.length === 0) {
    reportLines.push('✅ No fixes needed.');
  } else {
    reportLines.push('| Path | Current | Proposed | Reason |');
    reportLines.push('|---|---|---|---|');
    for (const f of validFixes) {
      const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      reportLines.push(`| \`${esc(f.path)}\` | ${esc(f.current)} | **${esc(f.proposed)}** | ${esc(f.reason)} |`);
    }
  }
  if (validFixes.length < fixes.length) {
    reportLines.push('');
    reportLines.push(`⚠ ${fixes.length - validFixes.length} fix(es) skipped (no-op, missing path, or would break placeholders).`);
  }
  await fs.writeFile(reportPath, reportLines.join('\n') + '\n', 'utf-8');

  // Применяем
  if (APPLY && validFixes.length > 0) {
    for (const f of validFixes) {
      setByPath(target, f.path, f.proposed);
    }
    // Пометка в _meta что прошёл LLM-ревью + хэш источника для skip-if-fresh.
    target._meta = {
      ...(target._meta || {}),
      geminiReviewedAt: new Date().toISOString(),
      geminiModel: model,
      geminiFixCount: validFixes.length,
      geminiSourceHash: sourceHash,
    };
    // После Gemini-ревью считаем перевод «свежим» — снимаем needsRefresh если был.
    if (target._meta.needsRefresh) delete target._meta.needsRefresh;
    await fs.writeFile(targetPath, JSON.stringify(target, null, 2) + '\n', 'utf-8');
  }

  return { lang, langName, dt, proposed: fixes.length, valid: validFixes.length, applied: APPLY ? validFixes.length : 0 };
}

// ── Параллелим с ограничением ───────────────────────────────────────────────
async function runWithLimit(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        const r = await fn(items[idx]);
        results.push(r);
        if (r.skipped) {
          console.log(`  ⏭ ${r.lang.padEnd(4)} fresh (source hash unchanged)`);
        } else {
          console.log(`  ✓ ${r.lang.padEnd(4)} ${String(r.proposed).padStart(3)} proposed, ${String(r.valid).padStart(3)} valid, ${String(r.applied).padStart(3)} applied (${r.dt}s)`);
        }
      } catch (e) {
        console.error(`  ✗ ${items[idx]}: ${e.message?.slice(0, 200)}`);
        results.push({ lang: items[idx], error: e.message });
      }
    }
  }
  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const keyResult = await loadApiKey();
  if (!keyResult) {
    console.error('❌ API key not found. Set GEMINI_API_KEY (preferred) or GOOGLE_TRANSLATE_API_KEY in env or apps/frontend/.env.local');
    process.exit(1);
  }
  console.log(`🔑 Key source: ${keyResult.source}`);
  console.log(`🤖 Model: ${MODEL}`);
  console.log(`⚙ Apply: ${APPLY}, concurrency: ${CONCURRENCY}`);

  const ruRaw = await fs.readFile(path.join(LOCALES_DIR, 'ru', 'common.json'), 'utf-8');
  const ru = JSON.parse(ruRaw);
  const ruFlat = flatten(ru);
  const sourceHash = crypto.createHash('sha256').update(ruRaw).digest('hex').slice(0, 16);
  console.log(`📖 Source ru/common.json: ${Object.keys(ruFlat).length} flat keys (hash: ${sourceHash})`);

  const glossary = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, '_glossary.json'), 'utf-8'));

  let langs = await loadLanguageList();
  if (ONLY) {
    langs = langs.filter((l) => ONLY.includes(l));
    console.log(`🎯 Restricted to: ${langs.join(', ')}`);
  }
  console.log(`🌐 Languages to review: ${langs.length}`);
  console.log('');

  const t0 = Date.now();
  const results = await runWithLimit(
    langs,
    CONCURRENCY,
    (lang) => reviewLanguage({ apiKey: keyResult.key, model: MODEL, lang, ruFlat, glossary, sourceHash }),
  );
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('');
  console.log(`🎉 Done in ${dt}s.`);
  const ok = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const totalProposed = ok.reduce((s, r) => s + (r.proposed || 0), 0);
  const totalApplied = ok.reduce((s, r) => s + (r.applied || 0), 0);
  console.log(`   • OK: ${ok.length}, failed: ${failed.length}`);
  console.log(`   • Proposed fixes total: ${totalProposed}`);
  console.log(`   • Applied: ${totalApplied}`);
  console.log(`   • Reports → reports/llm-review/<lang>.md`);
  if (failed.length) {
    console.log('');
    console.log('Failed langs:');
    for (const f of failed) console.log(`   - ${f.lang}: ${f.error?.slice(0, 200)}`);
  }
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
