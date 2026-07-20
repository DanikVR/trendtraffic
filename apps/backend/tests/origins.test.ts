import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { dedupeChain, ORIGIN_KEYS } from '../src/modules/media/origins.js';

test('dedupeChain: одиночная метка и мусор на входе', () => {
  assert.deepStrictEqual(dedupeChain(['flow']), ['flow']);
  assert.deepStrictEqual(dedupeChain([]), []);
  assert.deepStrictEqual(dedupeChain([null, undefined, '', 'не-метка']), [],
    'неизвестные ключи отбрасываются, а не падают');
});

test('dedupeChain: собственная метка замыкает цепочку', () => {
  assert.deepStrictEqual(dedupeChain(['flow', 'ugc']), ['flow', 'ugc']);
  assert.deepStrictEqual(dedupeChain(['ugc', 'montage', 'ugc']), ['montage', 'ugc'],
    'пересобрали в UGC уже смонтированный файл → UGC снова текущее состояние');
});

test('dedupeChain: склейка исходников НЕ ломает хронологию', () => {
  // Регресс: клип А прошёл Flow→UGC, клип Б — только Flow, склеили монтажом.
  // Старая реализация (повтор → в конец) отдавала ['ugc','flow','montage'] —
  // Галерея показывала UGC раньше Flow, хотя файл родился в Flow.
  assert.deepStrictEqual(
    dedupeChain(['flow', 'ugc', 'flow', 'montage']),
    ['flow', 'ugc', 'montage']
  );
  assert.deepStrictEqual(
    dedupeChain(['trends', 'analytics', 'trends', 'storyboard']),
    ['trends', 'analytics', 'storyboard']
  );
});

test('ORIGIN_KEYS: бэкенд и фронт описывают один и тот же набор меток', () => {
  // mediaOrigins.tsx рендерит подписи через t(`sec.origins.${key}`) — шаблонный ключ,
  // которого не видит ни check-i18n-coverage.mjs, ни harvest-sec-keys.mjs. Ключ,
  // разошедшийся с фронтом или с локалью, молча теряет иконку/подпись — ловим тестом.
  const front = fs.readFileSync(
    path.resolve(import.meta.dirname, '../../frontend/src/lib/mediaOrigins.tsx'), 'utf-8');
  const declared = Array.from(front.matchAll(/^\s*\{\s*key:\s*'([a-z]+)'/gm)).map((m) => m[1]);
  assert.deepStrictEqual([...declared].sort(), [...ORIGIN_KEYS].sort(),
    'ORIGINS в mediaOrigins.tsx разошёлся с ORIGIN_KEYS в origins.ts');

  const ru = JSON.parse(fs.readFileSync(
    path.resolve(import.meta.dirname, '../../frontend/public/locales/ru/common.json'), 'utf-8'));
  const missing = ORIGIN_KEYS.filter((k) => typeof ru?.sec?.origins?.[k] !== 'string');
  assert.deepStrictEqual(missing, [], `нет подписи sec.origins.* в ru/common.json: ${missing}`);
});
