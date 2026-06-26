#!/usr/bin/env node
/**
 * find-cyrillic.mjs
 *
 * Сканирует apps/frontend/src/**\/*.{ts,tsx} и ищет все литералы, содержащие
 * кириллицу: JSX текст, JSX-атрибуты (title/aria-label/placeholder/alt),
 * аргументы alert()/throw new Error(), confirm-диалоги, тосты.
 *
 * Отсекает мусор:
 *   • /** комментарии (включая многострочные)
 *   • // однострочные комментарии
 *   • console.log/warn/error
 *   • APP_VERSION история (в AppVersion.tsx после export const)
 *   • Уже-обёрнутые t('...'), useTranslation('...')
 *   • Строки в i18next.changeLanguage / detectLanguage
 *
 * Вывод:
 *   - human-readable: сгруппированный по файлам список «строка → context»
 *   - --json: машинно-читаемый список для последующей автогенерации ключей
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

const args = new Set(process.argv.slice(2));
const JSON_OUT = args.has('--json');
const VERBOSE = args.has('--verbose');

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Удаляет /* ... *\/ и // ... комментарии из source, заменяя их пробелами
 *  той же длины — чтобы line/column в исходном файле не сдвинулись. */
function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  let inString = null; // ', ", `
  let inTemplate = 0;  // depth of ${...}
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    if (!inString) {
      if (c === '/' && next === '/') {
        // line comment
        while (i < n && source[i] !== '\n') { out += ' '; i++; }
        continue;
      }
      if (c === '/' && next === '*') {
        // block comment
        out += '  '; i += 2;
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
          out += source[i] === '\n' ? '\n' : ' ';
          i++;
        }
        if (i < n) { out += '  '; i += 2; }
        continue;
      }
      if (c === "'" || c === '"' || c === '`') {
        inString = c;
        out += c; i++;
        continue;
      }
    } else {
      // inside string
      if (c === '\\' && i + 1 < n) { out += c + source[i+1]; i += 2; continue; }
      if (c === inString) { inString = null; out += c; i++; continue; }
    }
    out += c; i++;
  }
  return out;
}

const CYR = /[А-Яа-яЁё]/;

/** Возвращает строку:номер и контекст для каждого найденного литерала. */
function findInFile(filePath, cleaned, raw) {
  const findings = [];
  const lines = cleaned.split('\n');
  const rawLines = raw.split('\n');

  // Двойные/одинарные/тимплейтные кавычки с кириллицей внутри.
  const stringRe = /(['"`])((?:\\.|(?!\1).)*?)\1/g;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // Пропускаем строки, где явно идёт t('...') / useTranslation('...').
    // Найдём ВСЕ литералы и для каждого решим, JSX-text это или не-t-вызов.
    let m;
    while ((m = stringRe.exec(line)) !== null) {
      const literal = m[2];
      if (!CYR.test(literal)) continue;
      // Контекст: что слева от литерала
      const before = line.slice(0, m.index);
      // Пропускаем литералы внутри t('...'), useTranslation, console.log etc.
      // — пропускаем если перед литералом идёт идентификатор t/Trans/i18n/console.
      const beforeTail = before.slice(-40);
      if (/\bt\s*\(\s*$/.test(beforeTail)) continue;
      if (/useTranslation\s*\(\s*$/.test(beforeTail)) continue;
      if (/console\.(log|warn|error|debug|info)\s*\(\s*$/.test(beforeTail)) continue;
      if (/\bdebug\s*[:=]\s*$/.test(beforeTail)) continue;
      // Пропускаем import './локаль'
      if (/import.*from\s*$/.test(beforeTail)) continue;
      // Пропускаем data-test и aria-roledescription
      // (не имеет смысла переводить — это для тестов)
      if (/\b(data-testid|data-test|key)\s*=\s*$/.test(beforeTail)) continue;
      // Пропускаем regex (`.replace(/.../`) — но кириллица в regex редкая
      // Имя файла import './foo.tsx'
      if (/^[a-z./_-]+$/.test(literal)) continue;
      // SVG paths etc.
      if (literal.length < 2) continue;

      findings.push({
        line: lineNum,
        column: m.index,
        literal,
        context: rawLines[idx]?.trim().slice(0, 140),
      });
    }
  });

  return findings;
}

async function main() {
  const files = await walk(SRC_DIR);
  const results = {};
  let totalLiterals = 0;

  for (const f of files) {
    const raw = await fs.readFile(f, 'utf-8');
    const cleaned = stripComments(raw);
    const findings = findInFile(f, cleaned, raw);

    // Пропускаем AppVersion.tsx (история версий — это умышленный кириллический комментарий)
    // и LanguagePicker.tsx (имена языков на родных — это контент, не UI).
    // Уже отфильтрованы stripComments'ом, но history — это STRING литерал в комментариях
    // которые stripComments удаляет. Удостоверимся.
    if (/AppVersion\.tsx$/i.test(f)) continue;

    if (findings.length === 0) continue;
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    results[rel] = findings;
    totalLiterals += findings.length;
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ totalLiterals, totalFiles: Object.keys(results).length, results }, null, 2));
  } else {
    console.log(`📊 Найдено ${totalLiterals} кириллических литералов в ${Object.keys(results).length} файлах:\n`);
    const sortedFiles = Object.keys(results).sort((a, b) => results[b].length - results[a].length);
    for (const f of sortedFiles) {
      console.log(`\n━━ ${f}  (${results[f].length})`);
      const seen = new Set();
      for (const item of results[f]) {
        if (seen.has(item.literal)) continue;
        seen.add(item.literal);
        const lit = item.literal.length > 60 ? item.literal.slice(0, 57) + '...' : item.literal;
        console.log(`   ${String(item.line).padStart(4)}: ${JSON.stringify(lit)}`);
        if (VERBOSE) console.log(`         │ ${item.context}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
