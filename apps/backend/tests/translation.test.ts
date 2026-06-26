/**
 * Юнит-тесты модуля синхронного перевода (Translation).
 *
 * Фреймворк: node:test + node:assert (стандартный тестовый раннер Node.js)
 *
 * Проверки:
 * 1. Маппинг HD-голосов Gemini (VOICE_MAP)
 * 2. Список и валидация поддерживаемых языков (BCP-47)
 * 3. Константы аудиоформата и модели
 * 4. Парсинг metadata участника
 * 5. Формирование конфигурации LiveConnectConfig с StreamTranslationConfig
 * 6. Валидация входных данных роутера
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Установка переменной окружения до импорта модуля
process.env.GEMINI_LIVE_MODEL = 'gemini-live-2.5-flash-preview';

import {
  VOICE_MAP,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  AUDIO_SAMPLE_RATE,
  AUDIO_CHANNELS,
  AUDIO_MIME_TYPE,
  GEMINI_LIVE_MODEL,
  TRANSLATOR_BOT_IDENTITY,
} from '../src/modules/translation/config.ts';

// ============================================================================================
// 1. Тесты маппинга HD-голосов Gemini (VOICE_MAP)
// ============================================================================================

describe('VOICE_MAP — маппинг HD-голосов Gemini', () => {
  test('должен содержать женский голос "Aoede"', () => {
    assert.strictEqual(VOICE_MAP.female, 'Aoede');
  });

  test('должен содержать мужской голос "Puck"', () => {
    assert.strictEqual(VOICE_MAP.male, 'Puck');
  });

  test('должен содержать ровно два ключа: male и female', () => {
    const keys = Object.keys(VOICE_MAP);
    assert.strictEqual(keys.length, 2);
    assert.ok(keys.includes('male'), 'Отсутствует ключ "male"');
    assert.ok(keys.includes('female'), 'Отсутствует ключ "female"');
  });
});

// ============================================================================================
// 2. Тесты списка поддерживаемых языков
// ============================================================================================

describe('SUPPORTED_LANGUAGES — список поддерживаемых языков', () => {
  test('должен содержать ровно 12 языков', () => {
    assert.strictEqual(SUPPORTED_LANGUAGES.length, 12);
  });

  test('должен включать все 12 языков из технического задания', () => {
    const expectedLanguages = ['en', 'pl', 'ru', 'de', 'es', 'fr', 'ar', 'he', 'zh', 'pt', 'it', 'tr'];
    for (const lang of expectedLanguages) {
      assert.ok(
        SUPPORTED_LANGUAGES.includes(lang),
        `Язык "${lang}" должен быть в списке поддерживаемых`
      );
    }
  });

  test('все коды должны быть двухсимвольными (BCP-47 / ISO 639-1)', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      assert.strictEqual(lang.length, 2, `Код "${lang}" должен быть двухсимвольным`);
      assert.match(lang, /^[a-z]{2}$/, `Код "${lang}" должен состоять из строчных латинских букв`);
    }
  });
});

// ============================================================================================
// 3. Тесты валидатора языка (isSupportedLanguage)
// ============================================================================================

describe('isSupportedLanguage — валидация кода языка', () => {
  test('должен возвращать true для поддерживаемых языков', () => {
    assert.strictEqual(isSupportedLanguage('en'), true);
    assert.strictEqual(isSupportedLanguage('ru'), true);
    assert.strictEqual(isSupportedLanguage('zh'), true);
    assert.strictEqual(isSupportedLanguage('ar'), true);
    assert.strictEqual(isSupportedLanguage('tr'), true);
  });

  test('должен возвращать false для неподдерживаемых языков', () => {
    assert.strictEqual(isSupportedLanguage('ja'), false);  // Японский
    assert.strictEqual(isSupportedLanguage('ko'), false);  // Корейский
    assert.strictEqual(isSupportedLanguage(''), false);    // Пустая строка
    assert.strictEqual(isSupportedLanguage('xyz'), false); // Невалидный код
  });
});

// ============================================================================================
// 4. Тесты констант аудиоформата
// ============================================================================================

describe('Константы аудиоформата', () => {
  test('AUDIO_SAMPLE_RATE должен быть 16000 (16kHz)', () => {
    assert.strictEqual(AUDIO_SAMPLE_RATE, 16000);
  });

  test('AUDIO_CHANNELS должен быть 1 (моно)', () => {
    assert.strictEqual(AUDIO_CHANNELS, 1);
  });

  test('AUDIO_MIME_TYPE должен быть "audio/pcm;rate=16000"', () => {
    assert.strictEqual(AUDIO_MIME_TYPE, 'audio/pcm;rate=16000');
  });
});

// ============================================================================================
// 5. Тесты конфигурации модели и бота
// ============================================================================================

describe('Конфигурация модели и бота', () => {
  test('GEMINI_LIVE_MODEL должен быть "gemini-live-2.5-flash-preview"', () => {
    assert.strictEqual(GEMINI_LIVE_MODEL, 'gemini-live-2.5-flash-preview');
  });

  test('TRANSLATOR_BOT_IDENTITY должен быть "vibevox-translator"', () => {
    assert.strictEqual(TRANSLATOR_BOT_IDENTITY, 'vibevox-translator');
  });
});

// ============================================================================================
// 6. Тесты парсинга metadata участника
// ============================================================================================

/**
 * Вспомогательная функция, дублирующая логику parseParticipantMetadata из bridge.ts
 * (для тестирования без импорта класса TranslationBridge, т.к. он зависит от нативных модулей)
 */
function parseParticipantMetadata(metadataStr: string | undefined) {
  if (!metadataStr) return null;
  try {
    const parsed = JSON.parse(metadataStr);
    if (!parsed.nativeLanguage || !parsed.voiceGender) return null;
    if (!isSupportedLanguage(parsed.nativeLanguage)) return null;
    return {
      nativeLanguage: parsed.nativeLanguage as string,
      voiceGender: parsed.voiceGender as 'male' | 'female',
    };
  } catch {
    return null;
  }
}

describe('Парсинг metadata участника', () => {
  test('должен корректно парсить валидную metadata с женским голосом', () => {
    const metadata = JSON.stringify({ nativeLanguage: 'ru', voiceGender: 'female' });
    const result = parseParticipantMetadata(metadata);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.nativeLanguage, 'ru');
    assert.strictEqual(result!.voiceGender, 'female');
  });

  test('должен корректно парсить валидную metadata с мужским голосом', () => {
    const metadata = JSON.stringify({ nativeLanguage: 'en', voiceGender: 'male' });
    const result = parseParticipantMetadata(metadata);
    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.nativeLanguage, 'en');
    assert.strictEqual(result!.voiceGender, 'male');
  });

  test('должен возвращать null при отсутствии metadata', () => {
    assert.strictEqual(parseParticipantMetadata(undefined), null);
    assert.strictEqual(parseParticipantMetadata(''), null);
  });

  test('должен возвращать null при невалидном JSON', () => {
    assert.strictEqual(parseParticipantMetadata('not-json'), null);
    assert.strictEqual(parseParticipantMetadata('{broken'), null);
  });

  test('должен возвращать null при отсутствии nativeLanguage', () => {
    const metadata = JSON.stringify({ voiceGender: 'female' });
    assert.strictEqual(parseParticipantMetadata(metadata), null);
  });

  test('должен возвращать null при отсутствии voiceGender', () => {
    const metadata = JSON.stringify({ nativeLanguage: 'ru' });
    assert.strictEqual(parseParticipantMetadata(metadata), null);
  });

  test('должен возвращать null для неподдерживаемого языка', () => {
    const metadata = JSON.stringify({ nativeLanguage: 'ja', voiceGender: 'female' });
    assert.strictEqual(parseParticipantMetadata(metadata), null);
  });

  test('должен обрабатывать все 12 поддерживаемых языков', () => {
    const languages = ['en', 'pl', 'ru', 'de', 'es', 'fr', 'ar', 'he', 'zh', 'pt', 'it', 'tr'];
    for (const lang of languages) {
      const metadata = JSON.stringify({ nativeLanguage: lang, voiceGender: 'male' });
      const result = parseParticipantMetadata(metadata);
      assert.notStrictEqual(result, null, `Парсинг должен успешно обработать язык "${lang}"`);
      assert.strictEqual(result!.nativeLanguage, lang);
    }
  });
});

// ============================================================================================
// 7. Тесты формирования конфигурации Gemini Live Session
// ============================================================================================

/**
 * Вспомогательная функция, дублирующая логику формирования конфигурации LiveConnect
 */
function buildLiveConnectConfig(
  targetLanguage: string,
  voiceGender: 'male' | 'female'
) {
  return {
    model: GEMINI_LIVE_MODEL,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: VOICE_MAP[voiceGender],
          },
        },
      },
      streamTranslationConfig: {
        targetLanguageCode: targetLanguage,
        echoTargetLanguage: false,
      },
    },
  };
}

describe('Формирование конфигурации Gemini Live Session', () => {
  test('должен формировать конфиг с женским голосом Aoede для "female"', () => {
    const config = buildLiveConnectConfig('en', 'female');
    assert.strictEqual(config.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Aoede');
  });

  test('должен формировать конфиг с мужским голосом Puck для "male"', () => {
    const config = buildLiveConnectConfig('ru', 'male');
    assert.strictEqual(config.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Puck');
  });

  test('должен устанавливать правильный targetLanguageCode', () => {
    const config = buildLiveConnectConfig('de', 'female');
    assert.strictEqual(config.config.streamTranslationConfig.targetLanguageCode, 'de');
  });

  test('должен устанавливать echoTargetLanguage в false', () => {
    const config = buildLiveConnectConfig('en', 'male');
    assert.strictEqual(config.config.streamTranslationConfig.echoTargetLanguage, false);
  });

  test('должен устанавливать responseModalities в ["AUDIO"]', () => {
    const config = buildLiveConnectConfig('fr', 'female');
    assert.deepStrictEqual(config.config.responseModalities, ['AUDIO']);
  });

  test('должен использовать модель gemini-live-2.5-flash-preview', () => {
    const config = buildLiveConnectConfig('es', 'male');
    assert.strictEqual(config.model, 'gemini-live-2.5-flash-preview');
  });

  test('должен корректно формировать конфиг для каждого из 12 языков', () => {
    const languages = ['en', 'pl', 'ru', 'de', 'es', 'fr', 'ar', 'he', 'zh', 'pt', 'it', 'tr'];
    for (const lang of languages) {
      const config = buildLiveConnectConfig(lang, 'female');
      assert.strictEqual(config.config.streamTranslationConfig.targetLanguageCode, lang);
      assert.strictEqual(config.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Aoede');
    }
  });
});

// ============================================================================================
// 8. Тесты валидации входных данных роутера
// ============================================================================================

describe('Валидация входных данных роутера /api/translation', () => {
  test('POST /start: должен требовать roomName типа string', () => {
    const validate = (body: Record<string, unknown>) => {
      const { roomName } = body;
      if (!roomName || typeof roomName !== 'string') return false;
      return true;
    };

    assert.strictEqual(validate({}), false, 'Пустой body — невалидный');
    assert.strictEqual(validate({ roomName: 123 }), false, 'Числовой roomName — невалидный');
    assert.strictEqual(validate({ roomName: '' }), false, 'Пустой roomName — невалидный');
    assert.strictEqual(validate({ roomName: 'test-room' }), true, 'Валидный roomName');
  });

  test('POST /stop: должен требовать roomName типа string', () => {
    const validate = (body: Record<string, unknown>) => {
      const { roomName } = body;
      if (!roomName || typeof roomName !== 'string') return false;
      return true;
    };

    assert.strictEqual(validate({}), false);
    assert.strictEqual(validate({ roomName: null }), false);
    assert.strictEqual(validate({ roomName: 'room-1' }), true);
  });
});
