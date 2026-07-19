import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeDiarization } from '../src/modules/render/audio_diarize.js';

// Разбор речи должен САМ понимать, сколько голосов в записи: от этого фронт решает,
// включать ли «Диалог двоих» и раскладывать ли реплики на дорожки A/B.

test('Два голоса: разметка A/B сохраняется, пол берётся из speakers', () => {
  const { lines, speakers } = normalizeDiarization({
    speakerCount: 2,
    speakers: [{ id: 'A', gender: 'female' }, { id: 'B', gender: 'male' }],
    segments: [
      { speaker: 'A', start: 0, end: 2, text: 'Привет' },
      { speaker: 'B', start: 2, end: 4, text: 'И тебе привет' },
    ],
  });

  assert.strictEqual(lines.length, 2);
  assert.deepStrictEqual(lines.map((l) => l.speaker), ['A', 'B']);
  assert.deepStrictEqual(speakers, [{ id: 'A', gender: 'female' }, { id: 'B', gender: 'male' }]);
});

test('Монолог: один голос — второй не выдумывается', () => {
  const { lines, speakers } = normalizeDiarization({
    speakerCount: 1,
    speakers: [{ id: 'A', gender: 'male' }],
    segments: [
      { speaker: 'A', start: 0, end: 2, text: 'Раз' },
      { speaker: 'A', start: 2, end: 4, text: 'Два' },
    ],
  });

  assert.strictEqual(speakers.length, 1, 'ровно один голос');
  assert.strictEqual(speakers[0].id, 'A');
  assert.ok(lines.every((l) => l.speaker === 'A'));
});

test('speakerCount врёт (заявлено 2, размечен только A) — верим разметке', () => {
  const { speakers } = normalizeDiarization({
    speakerCount: 2,
    speakers: [{ id: 'A', gender: 'female' }, { id: 'B', gender: 'male' }],
    segments: [
      { speaker: 'A', start: 0, end: 2, text: 'Раз' },
      { speaker: 'A', start: 2, end: 4, text: 'Два' },
    ],
  });

  assert.strictEqual(speakers.length, 1, 'голос один — режим диалога включать нельзя');
  assert.strictEqual(speakers[0].id, 'A');
});

test('Монолог, целиком помеченный как B → приводится к A (с его полом)', () => {
  const { lines, speakers } = normalizeDiarization({
    speakerCount: 1,
    speakers: [{ id: 'B', gender: 'male' }],
    segments: [{ speaker: 'B', start: 0, end: 2, text: 'Один говорю' }],
  });

  assert.ok(lines.every((l) => l.speaker === 'A'), 'одинокий B нормализуется в A');
  assert.deepStrictEqual(speakers, [{ id: 'A', gender: 'male' }], 'пол не теряется при переносе');
});

test('Мусор в ответе: битые таймкоды и пустой текст отбрасываются, порядок по времени', () => {
  const { lines } = normalizeDiarization({
    segments: [
      { speaker: 'A', start: 5, end: 7, text: 'Вторая' },
      { speaker: 'A', start: 0, end: 2, text: 'Первая' },
      { speaker: 'B', start: 3, end: 3, text: 'Нулевая длина' },
      { speaker: 'A', start: 8, end: 9, text: '   ' },
      { speaker: 'B', start: NaN, end: 12, text: 'Без таймкода' },
    ],
  });

  assert.deepStrictEqual(lines.map((l) => l.text), ['Первая', 'Вторая']);
});

test('Пустой/чужой JSON не роняет разбор', () => {
  assert.deepStrictEqual(normalizeDiarization({}), { lines: [], speakers: [] });
  assert.deepStrictEqual(normalizeDiarization(null), { lines: [], speakers: [] });
});
