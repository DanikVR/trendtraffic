#!/usr/bin/env node
/**
 * harvest-all-keys.mjs
 *
 * Как harvest-sec-keys.mjs, но ловит ЛЮБОЙ ключ вида t('key', 'default') со
 * строковым дефолтом (не только sec.*). Добавляет в ru/common.json только
 * ОТСУТСТВУЮЩИЕ ключи (существующие не трогает). Нужен чтобы подобрать строки,
 * которые агенты положили в чужой namespace (enterprise.*), и давние ключи
 * навигации (nav.*, moreSheet.*), которых никогда не было в источнике.
 *
 * --dry   только показать
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const RU = path.join(ROOT, 'public', 'locales', 'ru', 'common.json');
const DRY = process.argv.includes('--dry');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p));
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

// t('a.b.c', 'default')  — key must be dotted-ish, NOT namespaced (no ':'), default is a string literal.
const RE = /\bt\(\s*(['"])([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)\1\s*,\s*(['"])((?:\\.|(?!\3)[\s\S])*?)\3/g;

function unescape(s, q) {
  return s.replace(new RegExp(`\\\\${q}`, 'g'), q).replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}

function has(obj, dotted) {
  return dotted.split('.').reduce((o, p) => (o && typeof o === 'object' ? o[p] : undefined), obj) !== undefined;
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

async function main() {
  const files = await walk(SRC);
  const found = new Map();
  for (const f of files) {
    const src = await fs.readFile(f, 'utf-8');
    let m;
    while ((m = RE.exec(src))) {
      const key = m[2];
      if (key.startsWith('sec.')) continue; // уже собрано harvest-sec-keys
      const val = unescape(m[4], m[3]);
      if (!found.has(key)) found.set(key, val);
    }
  }
  const ru = JSON.parse(await fs.readFile(RU, 'utf-8'));
  const toAdd = [...found.entries()].filter(([k]) => !has(ru, k));
  console.log(`🔎 Found ${found.size} non-sec keyed t(...) defaults; ${toAdd.length} are MISSING from ru/common.json.`);
  for (const [k, v] of toAdd) console.log(`   + ${k} = ${JSON.stringify(v).slice(0, 70)}`);
  if (DRY) { console.log('(dry run)'); return; }
  for (const [k, v] of toAdd) setByPath(ru, k, v);
  await fs.writeFile(RU, JSON.stringify(ru, null, 2) + '\n', 'utf-8');
  console.log(`💾 Added ${toAdd.length} keys → ${path.relative(ROOT, RU)}`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
