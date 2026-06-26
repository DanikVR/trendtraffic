/**
 * i18n инициализация VibeVox.
 *
 * Поддерживаются 100+ языков. Существующие модульные неймспейсы
 * (auth/billing/room/sip/assistant) для 12 базовых языков бандлятся в JS-код.
 * Общий неймспейс `common` (новые ключи навигации/общих кнопок) лежит
 * в /public/locales/{lng}/common.json и подгружается через HTTP-backend
 * лениво — это позволяет добавлять языки скриптом без пересборки.
 *
 * Порядок выбора языка при старте:
 *   1. localStorage (`i18nextLng`)
 *   2. <html lang>
 *   3. navigator.language
 *   4. fallback → 'en'
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

// ── Модульные локали (бандл) — auth/billing/room/sip/assistant ──────────────
import authEn from '../modules/auth/locales/en.json' assert { type: 'json' };
import authPl from '../modules/auth/locales/pl.json' assert { type: 'json' };
import authRu from '../modules/auth/locales/ru.json' assert { type: 'json' };
import authDe from '../modules/auth/locales/de.json' assert { type: 'json' };
import authEs from '../modules/auth/locales/es.json' assert { type: 'json' };
import authFr from '../modules/auth/locales/fr.json' assert { type: 'json' };
import authAr from '../modules/auth/locales/ar.json' assert { type: 'json' };
import authHe from '../modules/auth/locales/he.json' assert { type: 'json' };
import authZh from '../modules/auth/locales/zh.json' assert { type: 'json' };
import authPt from '../modules/auth/locales/pt.json' assert { type: 'json' };
import authIt from '../modules/auth/locales/it.json' assert { type: 'json' };
import authTr from '../modules/auth/locales/tr.json' assert { type: 'json' };

import billingEn from '../modules/billing/locales/en.json' assert { type: 'json' };
import billingPl from '../modules/billing/locales/pl.json' assert { type: 'json' };
import billingRu from '../modules/billing/locales/ru.json' assert { type: 'json' };
import billingDe from '../modules/billing/locales/de.json' assert { type: 'json' };
import billingEs from '../modules/billing/locales/es.json' assert { type: 'json' };
import billingFr from '../modules/billing/locales/fr.json' assert { type: 'json' };
import billingAr from '../modules/billing/locales/ar.json' assert { type: 'json' };
import billingHe from '../modules/billing/locales/he.json' assert { type: 'json' };
import billingZh from '../modules/billing/locales/zh.json' assert { type: 'json' };
import billingPt from '../modules/billing/locales/pt.json' assert { type: 'json' };
import billingIt from '../modules/billing/locales/it.json' assert { type: 'json' };
import billingTr from '../modules/billing/locales/tr.json' assert { type: 'json' };

import roomEn from '../modules/room/locales/en.json' assert { type: 'json' };
import roomPl from '../modules/room/locales/pl.json' assert { type: 'json' };
import roomRu from '../modules/room/locales/ru.json' assert { type: 'json' };
import roomDe from '../modules/room/locales/de.json' assert { type: 'json' };
import roomEs from '../modules/room/locales/es.json' assert { type: 'json' };
import roomFr from '../modules/room/locales/fr.json' assert { type: 'json' };
import roomAr from '../modules/room/locales/ar.json' assert { type: 'json' };
import roomHe from '../modules/room/locales/he.json' assert { type: 'json' };
import roomZh from '../modules/room/locales/zh.json' assert { type: 'json' };
import roomPt from '../modules/room/locales/pt.json' assert { type: 'json' };
import roomIt from '../modules/room/locales/it.json' assert { type: 'json' };
import roomTr from '../modules/room/locales/tr.json' assert { type: 'json' };

import sipEn from '../modules/sip/locales/en.json' assert { type: 'json' };
import sipPl from '../modules/sip/locales/pl.json' assert { type: 'json' };
import sipRu from '../modules/sip/locales/ru.json' assert { type: 'json' };
import sipDe from '../modules/sip/locales/de.json' assert { type: 'json' };
import sipEs from '../modules/sip/locales/es.json' assert { type: 'json' };
import sipFr from '../modules/sip/locales/fr.json' assert { type: 'json' };
import sipAr from '../modules/sip/locales/ar.json' assert { type: 'json' };
import sipHe from '../modules/sip/locales/he.json' assert { type: 'json' };
import sipZh from '../modules/sip/locales/zh.json' assert { type: 'json' };
import sipPt from '../modules/sip/locales/pt.json' assert { type: 'json' };
import sipIt from '../modules/sip/locales/it.json' assert { type: 'json' };
import sipTr from '../modules/sip/locales/tr.json' assert { type: 'json' };

import assistantEn from '../modules/assistant/locales/en.json' assert { type: 'json' };
import assistantPl from '../modules/assistant/locales/pl.json' assert { type: 'json' };
import assistantRu from '../modules/assistant/locales/ru.json' assert { type: 'json' };
import assistantDe from '../modules/assistant/locales/de.json' assert { type: 'json' };
import assistantEs from '../modules/assistant/locales/es.json' assert { type: 'json' };
import assistantFr from '../modules/assistant/locales/fr.json' assert { type: 'json' };
import assistantAr from '../modules/assistant/locales/ar.json' assert { type: 'json' };
import assistantHe from '../modules/assistant/locales/he.json' assert { type: 'json' };
import assistantZh from '../modules/assistant/locales/zh.json' assert { type: 'json' };
import assistantPt from '../modules/assistant/locales/pt.json' assert { type: 'json' };
import assistantIt from '../modules/assistant/locales/it.json' assert { type: 'json' };
import assistantTr from '../modules/assistant/locales/tr.json' assert { type: 'json' };

// Языки с письмом справа налево.
export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'];

// ─────────────────────────────────────────────────────────────────────────────
// Полный реестр поддерживаемых языков (100+, совместим с Google Translate).
// Используется LanguagePicker'ом + переводным скриптом.
// ─────────────────────────────────────────────────────────────────────────────
export interface SupportedLanguage {
  code: string;       // ISO-639-1 (или -2 где нужно)
  nativeName: string; // как пишут носители
  englishName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'af', nativeName: 'Afrikaans', englishName: 'Afrikaans' },
  { code: 'sq', nativeName: 'Shqip', englishName: 'Albanian' },
  { code: 'am', nativeName: 'አማርኛ', englishName: 'Amharic' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
  { code: 'hy', nativeName: 'Հայերեն', englishName: 'Armenian' },
  { code: 'az', nativeName: 'Azərbaycan', englishName: 'Azerbaijani' },
  { code: 'eu', nativeName: 'Euskara', englishName: 'Basque' },
  { code: 'be', nativeName: 'Беларуская', englishName: 'Belarusian' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali' },
  { code: 'bs', nativeName: 'Bosanski', englishName: 'Bosnian' },
  { code: 'bg', nativeName: 'Български', englishName: 'Bulgarian' },
  { code: 'ca', nativeName: 'Català', englishName: 'Catalan' },
  { code: 'ceb', nativeName: 'Cebuano', englishName: 'Cebuano' },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese' },
  { code: 'co', nativeName: 'Corsu', englishName: 'Corsican' },
  { code: 'hr', nativeName: 'Hrvatski', englishName: 'Croatian' },
  { code: 'cs', nativeName: 'Čeština', englishName: 'Czech' },
  { code: 'da', nativeName: 'Dansk', englishName: 'Danish' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch' },
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'eo', nativeName: 'Esperanto', englishName: 'Esperanto' },
  { code: 'et', nativeName: 'Eesti', englishName: 'Estonian' },
  { code: 'fi', nativeName: 'Suomi', englishName: 'Finnish' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'fy', nativeName: 'Frysk', englishName: 'Frisian' },
  { code: 'gl', nativeName: 'Galego', englishName: 'Galician' },
  { code: 'ka', nativeName: 'ქართული', englishName: 'Georgian' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'el', nativeName: 'Ελληνικά', englishName: 'Greek' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati' },
  { code: 'ht', nativeName: 'Kreyòl Ayisyen', englishName: 'Haitian Creole' },
  { code: 'ha', nativeName: 'Hausa', englishName: 'Hausa' },
  { code: 'haw', nativeName: 'ʻŌlelo Hawaiʻi', englishName: 'Hawaiian' },
  { code: 'he', nativeName: 'עברית', englishName: 'Hebrew' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'hmn', nativeName: 'Hmoob', englishName: 'Hmong' },
  { code: 'hu', nativeName: 'Magyar', englishName: 'Hungarian' },
  { code: 'is', nativeName: 'Íslenska', englishName: 'Icelandic' },
  { code: 'ig', nativeName: 'Igbo', englishName: 'Igbo' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian' },
  { code: 'ga', nativeName: 'Gaeilge', englishName: 'Irish' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  { code: 'jv', nativeName: 'Basa Jawa', englishName: 'Javanese' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'kk', nativeName: 'Қазақша', englishName: 'Kazakh' },
  { code: 'km', nativeName: 'ខ្មែរ', englishName: 'Khmer' },
  { code: 'rw', nativeName: 'Kinyarwanda', englishName: 'Kinyarwanda' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean' },
  { code: 'ku', nativeName: 'Kurdî', englishName: 'Kurdish' },
  { code: 'ky', nativeName: 'Кыргызча', englishName: 'Kyrgyz' },
  { code: 'lo', nativeName: 'ລາວ', englishName: 'Lao' },
  { code: 'la', nativeName: 'Latina', englishName: 'Latin' },
  { code: 'lv', nativeName: 'Latviešu', englishName: 'Latvian' },
  { code: 'lt', nativeName: 'Lietuvių', englishName: 'Lithuanian' },
  { code: 'lb', nativeName: 'Lëtzebuergesch', englishName: 'Luxembourgish' },
  { code: 'mk', nativeName: 'Македонски', englishName: 'Macedonian' },
  { code: 'mg', nativeName: 'Malagasy', englishName: 'Malagasy' },
  { code: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam' },
  { code: 'mt', nativeName: 'Malti', englishName: 'Maltese' },
  { code: 'mi', nativeName: 'Māori', englishName: 'Maori' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi' },
  { code: 'mn', nativeName: 'Монгол', englishName: 'Mongolian' },
  { code: 'my', nativeName: 'မြန်မာ', englishName: 'Myanmar (Burmese)' },
  { code: 'ne', nativeName: 'नेपाली', englishName: 'Nepali' },
  { code: 'no', nativeName: 'Norsk', englishName: 'Norwegian' },
  { code: 'ny', nativeName: 'Chichewa', englishName: 'Nyanja (Chichewa)' },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia (Oriya)' },
  { code: 'ps', nativeName: 'پښتو', englishName: 'Pashto' },
  { code: 'fa', nativeName: 'فارسی', englishName: 'Persian' },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese' },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi' },
  { code: 'ro', nativeName: 'Română', englishName: 'Romanian' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'sm', nativeName: 'Gagana Samoa', englishName: 'Samoan' },
  { code: 'gd', nativeName: 'Gàidhlig', englishName: 'Scots Gaelic' },
  { code: 'sr', nativeName: 'Српски', englishName: 'Serbian' },
  { code: 'st', nativeName: 'Sesotho', englishName: 'Sesotho' },
  { code: 'sn', nativeName: 'ChiShona', englishName: 'Shona' },
  { code: 'sd', nativeName: 'سنڌي', englishName: 'Sindhi' },
  { code: 'si', nativeName: 'සිංහල', englishName: 'Sinhala' },
  { code: 'sk', nativeName: 'Slovenčina', englishName: 'Slovak' },
  { code: 'sl', nativeName: 'Slovenščina', englishName: 'Slovenian' },
  { code: 'so', nativeName: 'Soomaali', englishName: 'Somali' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'su', nativeName: 'Basa Sunda', englishName: 'Sundanese' },
  { code: 'sw', nativeName: 'Kiswahili', englishName: 'Swahili' },
  { code: 'sv', nativeName: 'Svenska', englishName: 'Swedish' },
  { code: 'tl', nativeName: 'Tagalog', englishName: 'Tagalog (Filipino)' },
  { code: 'tg', nativeName: 'Тоҷикӣ', englishName: 'Tajik' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil' },
  { code: 'tt', nativeName: 'Татарча', englishName: 'Tatar' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu' },
  { code: 'th', nativeName: 'ไทย', englishName: 'Thai' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish' },
  { code: 'tk', nativeName: 'Türkmen', englishName: 'Turkmen' },
  { code: 'uk', nativeName: 'Українська', englishName: 'Ukrainian' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu' },
  { code: 'ug', nativeName: 'Uyghur', englishName: 'Uyghur' },
  { code: 'uz', nativeName: 'Oʻzbek', englishName: 'Uzbek' },
  { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese' },
  { code: 'cy', nativeName: 'Cymraeg', englishName: 'Welsh' },
  { code: 'xh', nativeName: 'isiXhosa', englishName: 'Xhosa' },
  { code: 'yi', nativeName: 'ייִדיש', englishName: 'Yiddish' },
  { code: 'yo', nativeName: 'Yorùbá', englishName: 'Yoruba' },
  { code: 'zu', nativeName: 'isiZulu', englishName: 'Zulu' },
];

// Список языков с inline-бандл-локалями
const INLINE_LANGUAGES = ['en', 'pl', 'ru', 'de', 'es', 'fr', 'ar', 'he', 'zh', 'pt', 'it', 'tr'] as const;

const inlineResources: Record<string, Record<string, any>> = {
  en: { auth: authEn, billing: billingEn, room: roomEn, sip: sipEn, assistant: assistantEn },
  pl: { auth: authPl, billing: billingPl, room: roomPl, sip: sipPl, assistant: assistantPl },
  ru: { auth: authRu, billing: billingRu, room: roomRu, sip: sipRu, assistant: assistantRu },
  de: { auth: authDe, billing: billingDe, room: roomDe, sip: sipDe, assistant: assistantDe },
  es: { auth: authEs, billing: billingEs, room: roomEs, sip: sipEs, assistant: assistantEs },
  fr: { auth: authFr, billing: billingFr, room: roomFr, sip: sipFr, assistant: assistantFr },
  ar: { auth: authAr, billing: billingAr, room: roomAr, sip: sipAr, assistant: assistantAr },
  he: { auth: authHe, billing: billingHe, room: roomHe, sip: sipHe, assistant: assistantHe },
  zh: { auth: authZh, billing: billingZh, room: roomZh, sip: sipZh, assistant: assistantZh },
  pt: { auth: authPt, billing: billingPt, room: roomPt, sip: sipPt, assistant: assistantPt },
  it: { auth: authIt, billing: billingIt, room: roomIt, sip: sipIt, assistant: assistantIt },
  tr: { auth: authTr, billing: billingTr, room: roomTr, sip: sipTr, assistant: assistantTr },
};

// Custom path-segment language detector: вытаскивает /:lang/ из URL,
// e.g., "/es/billing" → "es". Регистрируем как пользовательский детектор.
const pathLanguageDetector = {
  name: 'pathSegment',
  lookup() {
    if (typeof window === 'undefined') return undefined;
    const first = window.location.pathname.split('/').filter(Boolean)[0];
    if (!first) return undefined;
    if (SUPPORTED_LANGUAGES.some((l) => l.code === first)) return first;
    return undefined;
  },
  cacheUserLanguage() { /* nothing — мы сами обновляем URL */ },
};

// Custom query-string detector: ?lang=es
const queryLanguageDetector = {
  name: 'querystring',
  lookup() {
    if (typeof window === 'undefined') return undefined;
    const m = window.location.search.match(/[?&]lang=([a-z\-]+)/i);
    if (!m) return undefined;
    const code = m[1].toLowerCase().split('-')[0];
    return SUPPORTED_LANGUAGES.some((l) => l.code === code) ? code : undefined;
  },
  cacheUserLanguage() { /* nothing */ },
};

const detectorInstance = new LanguageDetector();
detectorInstance.addDetector(pathLanguageDetector);
detectorInstance.addDetector(queryLanguageDetector);

i18n
  .use(HttpBackend)
  .use(detectorInstance)
  .use(initReactI18next)
  .init({
    // Префиллим existing 12 языков inline-ресурсами. HTTP-backend подгрузит
    // common.json (и другие неймспейсы) лениво для всех языков.
    resources: inlineResources,
    fallbackLng: 'en',
    // Поддерживаемые языки — расширенный список (из SUPPORTED_LANGUAGES).
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true,
    ns: ['common', 'auth', 'billing', 'room', 'sip', 'assistant'],
    defaultNS: 'room',
    interpolation: { escapeValue: false },
    detection: {
      // Порядок приоритета:
      //   1. /:lang/ префикс в URL (важно для SEO с prerendered страницами)
      //   2. ?lang=xx query-параметр (для shared ссылок)
      //   3. localStorage (запомненный выбор пользователя)
      //   4. язык браузера (navigator.language) — ПЕРВЫЙ ВИЗИТ
      //   5. <html lang> как последний fallback (на prerendered en-странице
      //      htmlTag='en' — если бы стоял раньше navigator, английский всегда
      //      побеждал бы родной язык юзера на первой загрузке).
      order: ['pathSegment', 'querystring', 'localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    backend: {
      // JSON-файлы переводов в public/locales/{lng}/{ns}.json — генерируются
      // скриптом npm run translate:locales через Google Translate API.
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    // Don't break if a namespace doesn't exist at the backend — мы инлайним
    // только 12 языков для 5 namespaces. common подтянется лениво.
    partialBundledLanguages: true,
    react: {
      useSuspense: false,
    },
  });

/** Управляет глобальным направлением текста (LTR / RTL) + <html lang>. */
export const handleLanguageDirection = (lng: string) => {
  const code = (lng || 'en').split('-')[0];
  const isRtl = RTL_LANGUAGES.includes(code);
  if (typeof document !== 'undefined') {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  }
};

i18n.on('languageChanged', (lng) => {
  handleLanguageDirection(lng);
});

handleLanguageDirection(i18n.language);

export default i18n;
