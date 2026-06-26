/**
 * DialectsPage — AI Learning Hub Pro.
 *
 * Страница управления диалектами и наречиями для обучения Gemini Live API.
 * Включает: поиск языков, счетчики правил, CRUD глоссариев,
 * импорт CSV, компиляцию промпта и предпросмотр.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, Search, Plus, Trash2, Edit3, Upload, Terminal,
  Check, X, ChevronLeft, BookOpen, Languages, FileText,
  Sparkles, Save, Brain, ToggleLeft, ToggleRight, AlertTriangle,
  Loader2, Scissors,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import DialectPlayground from '../../components/DialectPlayground';
import { useAppStore } from '../../store/useAppStore';

// ─── Полный список языков (90+) ───────────────────────────────────
interface LangItem { code: string; name: string; nameEn: string; flag: string; }
const ALL_LANGUAGES: LangItem[] = [
  // Популярные
  { code: 'ru', name: 'Русский',       nameEn: 'Russian',      flag: '🇷🇺' },
  { code: 'en', name: 'English',       nameEn: 'English',      flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch',       nameEn: 'German',       flag: '🇩🇪' },
  { code: 'fr', name: 'Français',      nameEn: 'French',       flag: '🇫🇷' },
  { code: 'es', name: 'Español',       nameEn: 'Spanish',      flag: '🇪🇸' },
  { code: 'tr', name: 'Türkçe',        nameEn: 'Turkish',      flag: '🇹🇷' },
  { code: 'zh', name: '中文',           nameEn: 'Chinese',      flag: '🇨🇳' },
  { code: 'ar', name: 'العربية',       nameEn: 'Arabic',       flag: '🇸🇦' },
  { code: 'ja', name: '日本語',         nameEn: 'Japanese',     flag: '🇯🇵' },
  { code: 'ko', name: '한국어',         nameEn: 'Korean',       flag: '🇰🇷' },
  { code: 'pt', name: 'Português',     nameEn: 'Portuguese',   flag: '🇧🇷' },
  { code: 'it', name: 'Italiano',      nameEn: 'Italian',      flag: '🇮🇹' },
  { code: 'pl', name: 'Polski',        nameEn: 'Polish',       flag: '🇵🇱' },
  { code: 'uk', name: 'Українська',    nameEn: 'Ukrainian',    flag: '🇺🇦' },
  { code: 'nl', name: 'Nederlands',    nameEn: 'Dutch',        flag: '🇳🇱' },
  { code: 'sv', name: 'Svenska',       nameEn: 'Swedish',      flag: '🇸🇪' },
  // Центральная Азия
  { code: 'uz', name: 'Oʻzbekcha',     nameEn: 'Uzbek',        flag: '🇺🇿' },
  { code: 'kk', name: 'Қазақша',       nameEn: 'Kazakh',       flag: '🇰🇿' },
  { code: 'ky', name: 'Кыргызча',      nameEn: 'Kyrgyz',       flag: '🇰🇬' },
  { code: 'tg', name: 'Тоҷикӣ',       nameEn: 'Tajik',        flag: '🇹🇯' },
  { code: 'tk', name: 'Türkmençe',     nameEn: 'Turkmen',      flag: '🇹🇲' },
  { code: 'mn', name: 'Монгол',        nameEn: 'Mongolian',    flag: '🇲🇳' },
  // Кавказ
  { code: 'az', name: 'Azərbaycan',    nameEn: 'Azerbaijani',  flag: '🇦🇿' },
  { code: 'ka', name: 'ქართული',       nameEn: 'Georgian',     flag: '🇬🇪' },
  { code: 'hy', name: 'Հայերեն',       nameEn: 'Armenian',     flag: '🇦🇲' },
  // Ближний Восток и Южная Азия
  { code: 'he', name: 'עברית',         nameEn: 'Hebrew',       flag: '🇮🇱' },
  { code: 'fa', name: 'فارسی',         nameEn: 'Persian',      flag: '🇮🇷' },
  { code: 'hi', name: 'हिन्दी',          nameEn: 'Hindi',        flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা',          nameEn: 'Bengali',      flag: '🇧🇩' },
  { code: 'ur', name: 'اردو',          nameEn: 'Urdu',         flag: '🇵🇰' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ',         nameEn: 'Punjabi',      flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்',          nameEn: 'Tamil',        flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు',         nameEn: 'Telugu',       flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी',          nameEn: 'Marathi',      flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી',        nameEn: 'Gujarati',     flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ',          nameEn: 'Kannada',      flag: '🇮🇳' },
  { code: 'ml', name: 'മലയാളം',        nameEn: 'Malayalam',    flag: '🇮🇳' },
  { code: 'si', name: 'සිංහල',          nameEn: 'Sinhala',      flag: '🇱🇰' },
  { code: 'ne', name: 'नेपाली',         nameEn: 'Nepali',       flag: '🇳🇵' },
  // Юго-Восточная Азия
  { code: 'th', name: 'ไทย',           nameEn: 'Thai',         flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt',    nameEn: 'Vietnamese',   flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', nameEn: 'Indonesian', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu', nameEn: 'Malay',        flag: '🇲🇾' },
  { code: 'tl', name: 'Tagalog',       nameEn: 'Filipino',     flag: '🇵🇭' },
  { code: 'my', name: 'မြန်မာစာ',       nameEn: 'Burmese',      flag: '🇲🇲' },
  { code: 'km', name: 'ខ្មែរ',           nameEn: 'Khmer',        flag: '🇰🇭' },
  { code: 'lo', name: 'ລາວ',           nameEn: 'Lao',          flag: '🇱🇦' },
  // Европа (дополнительно)
  { code: 'da', name: 'Dansk',         nameEn: 'Danish',       flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi',         nameEn: 'Finnish',      flag: '🇫🇮' },
  { code: 'no', name: 'Norsk',         nameEn: 'Norwegian',    flag: '🇳🇴' },
  { code: 'is', name: 'Íslenska',      nameEn: 'Icelandic',    flag: '🇮🇸' },
  { code: 'et', name: 'Eesti',         nameEn: 'Estonian',     flag: '🇪🇪' },
  { code: 'lv', name: 'Latviešu',      nameEn: 'Latvian',      flag: '🇱🇻' },
  { code: 'lt', name: 'Lietuvių',      nameEn: 'Lithuanian',   flag: '🇱🇹' },
  { code: 'cs', name: 'Čeština',       nameEn: 'Czech',        flag: '🇨🇿' },
  { code: 'sk', name: 'Slovenčina',    nameEn: 'Slovak',       flag: '🇸🇰' },
  { code: 'sl', name: 'Slovenščina',   nameEn: 'Slovenian',    flag: '🇸🇮' },
  { code: 'hr', name: 'Hrvatski',      nameEn: 'Croatian',     flag: '🇭🇷' },
  { code: 'sr', name: 'Српски',        nameEn: 'Serbian',      flag: '🇷🇸' },
  { code: 'bs', name: 'Bosanski',      nameEn: 'Bosnian',      flag: '🇧🇦' },
  { code: 'mk', name: 'Македонски',    nameEn: 'Macedonian',   flag: '🇲🇰' },
  { code: 'bg', name: 'Български',     nameEn: 'Bulgarian',    flag: '🇧🇬' },
  { code: 'ro', name: 'Română',        nameEn: 'Romanian',     flag: '🇷🇴' },
  { code: 'hu', name: 'Magyar',        nameEn: 'Hungarian',    flag: '🇭🇺' },
  { code: 'el', name: 'Ελληνικά',      nameEn: 'Greek',        flag: '🇬🇷' },
  { code: 'sq', name: 'Shqip',         nameEn: 'Albanian',     flag: '🇦🇱' },
  { code: 'be', name: 'Беларуская',    nameEn: 'Belarusian',   flag: '🇧🇾' },
  { code: 'ga', name: 'Gaeilge',       nameEn: 'Irish',        flag: '🇮🇪' },
  { code: 'cy', name: 'Cymraeg',       nameEn: 'Welsh',        flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  { code: 'gl', name: 'Galego',        nameEn: 'Galician',     flag: '🇪🇸' },
  { code: 'ca', name: 'Català',        nameEn: 'Catalan',      flag: '🇪🇸' },
  { code: 'eu', name: 'Euskara',       nameEn: 'Basque',       flag: '🇪🇸' },
  { code: 'mt', name: 'Malti',         nameEn: 'Maltese',      flag: '🇲🇹' },
  { code: 'lb', name: 'Lëtzebuergesch', nameEn: 'Luxembourgish', flag: '🇱🇺' },
  // Африка
  { code: 'sw', name: 'Kiswahili',     nameEn: 'Swahili',      flag: '🇹🇿' },
  { code: 'am', name: 'አማርኛ',          nameEn: 'Amharic',      flag: '🇪🇹' },
  { code: 'ha', name: 'Hausa',         nameEn: 'Hausa',        flag: '🇳🇬' },
  { code: 'yo', name: 'Yorùbá',        nameEn: 'Yoruba',       flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo',          nameEn: 'Igbo',         flag: '🇳🇬' },
  { code: 'zu', name: 'isiZulu',       nameEn: 'Zulu',         flag: '🇿🇦' },
  { code: 'af', name: 'Afrikaans',     nameEn: 'Afrikaans',    flag: '🇿🇦' },
  { code: 'so', name: 'Soomaali',      nameEn: 'Somali',       flag: '🇸🇴' },
  { code: 'rw', name: 'Kinyarwanda',   nameEn: 'Kinyarwanda',  flag: '🇷🇼' },
  { code: 'mg', name: 'Malagasy',      nameEn: 'Malagasy',     flag: '🇲🇬' },
  // Латинская Америка / Креольские
  { code: 'ht', name: 'Kreyòl ayisyen', nameEn: 'Haitian Creole', flag: '🇭🇹' },
  { code: 'qu', name: 'Quechua',       nameEn: 'Quechua',      flag: '🇵🇪' },
  { code: 'gn', name: 'Avañeʼẽ',      nameEn: 'Guarani',      flag: '🇵🇾' },
  // Прочие
  { code: 'la', name: 'Latina',        nameEn: 'Latin',        flag: '🏛️' },
  { code: 'eo', name: 'Esperanto',     nameEn: 'Esperanto',    flag: '🌍' },
  { code: 'jv', name: 'Basa Jawa',     nameEn: 'Javanese',     flag: '🇮🇩' },
  { code: 'su', name: 'Basa Sunda',    nameEn: 'Sundanese',    flag: '🇮🇩' },
  { code: 'ceb', name: 'Cebuano',      nameEn: 'Cebuano',      flag: '🇵🇭' },
  { code: 'ny', name: 'Chichewa',      nameEn: 'Chichewa',     flag: '🇲🇼' },
  { code: 'sn', name: 'chiShona',      nameEn: 'Shona',        flag: '🇿🇼' },
  { code: 'ps', name: 'پښتو',          nameEn: 'Pashto',       flag: '🇦🇫' },
  { code: 'ku', name: 'Kurdî',         nameEn: 'Kurdish',      flag: '🇮🇶' },
  { code: 'sd', name: 'سنڌي',          nameEn: 'Sindhi',       flag: '🇵🇰' },
  { code: 'mi', name: 'Te Reo Māori',  nameEn: 'Maori',        flag: '🇳🇿' },
  { code: 'sm', name: 'Gagana Samoa',  nameEn: 'Samoan',       flag: '🇼🇸' },
  { code: 'haw', name: 'ʻŌlelo Hawaiʻi', nameEn: 'Hawaiian',  flag: '🇺🇸' },
];

// ─── API helper ───────────────────────────────────────────────────
const API_BASE = window.location.port === '3000'
  ? 'http://localhost:3001/api/admin/dialects'
  : '/api/admin/dialects';

// Базовый промпт обучения — зашит в программу (зеркало backend BASE_DIALECT_GUIDELINES).
// Используется в ЛОКАЛЬНОЙ компиляции, когда API недоступен. Поле «Подсказки для ИИ» —
// необязательное дополнение поверх этой базы, персонализируется именем языка в шапке.
const BASE_DIALECT_GUIDELINES = `Speakers may freely mix this dialect with related regional languages and with Russian, switching languages within a single sentence (code-switching). Transcribe exactly what is said and preserve the original meaning. Everyday, colloquial, contracted and slang forms often differ from the literary standard — interpret them by sense, not only by their dictionary form. When you hear a word or phrase close to an entry in the vocabulary glossary below, normalize it to that glossary entry's standard meaning. Always preserve numbers, dates, quantities, measurements, names, addresses and locations exactly — never round, guess or invent them. Pay close attention to status and aspect markers (for example: done / completed vs. in progress vs. remaining vs. delivered), because they change the meaning of the whole message. Do not add anything that is not present in the audio.`;

// ─── Типы ─────────────────────────────────────────────────────────
interface GlossaryEntry {
  dialectWord: string;
  officialTranslation: string;
  contextHint: string;
}

// Значение глоссария: новая форма {t: перевод, c: контекст} либо легаси-строка (только перевод).
type GlossaryValue = string | { t: string; c?: string };

interface DialectRule {
  id: string;
  language_code: string;
  dialect_name: string;
  prompt_hints: string;
  glossary: Record<string, GlossaryValue>;
  compiled_instruction: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ══════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function DialectsPage() {
  const navigate = useNavigate();
  const { user, token } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Данные ──
  const [rules, setRules] = useState<DialectRule[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // ── Фильтр ──
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [langSearch, setLangSearch] = useState('');

  // ── Форма ──
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLang, setFormLang] = useState('ru');
  const [formDialectName, setFormDialectName] = useState('');
  const [formPromptHints, setFormPromptHints] = useState('');
  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([
    { dialectWord: '', officialTranslation: '', contextHint: '' },
  ]);
  const [compiledInstruction, setCompiledInstruction] = useState('');
  const [isCompiled, setIsCompiled] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState(false);
  // Ошибка сохранения на СЕРВЕР (Postgres). На VPS сервер — источник истины: если
  // запись в API не прошла, правило живёт только в localStorage и бот его НЕ увидит.
  const [formError, setFormError] = useState('');

  // ── Поиск языка в форме ──
  const [formLangSearch, setFormLangSearch] = useState('');
  const [formLangDropdownOpen, setFormLangDropdownOpen] = useState(false);
  const formLangRef = useRef<HTMLDivElement>(null);

  // ── localStorage helpers ─────────────────────────────────────────
  const LS_KEY = 'vibevox_dialect_rules';

  const loadFromLS = (): DialectRule[] => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const saveToLS = (data: DialectRule[]) => {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  };

  const computeCounts = (allRules: DialectRule[]): Record<string, number> => {
    const c: Record<string, number> = {};
    allRules.filter(r => r.is_active).forEach(r => { c[r.language_code] = (c[r.language_code] || 0) + 1; });
    return c;
  };

  // ── Загрузка данных: API — источник истины, localStorage — офлайн-кэш ──
  // Прежняя «умная» мерж-логика (API rules + localOnly) создавала дубли:
  // после POST сервер присваивал СВОЙ UUID, а client-UUID из localStorage
  // считался «отдельным» правилом и добавлялся повторно. Теперь при успешном
  // ответе API мы просто берём данные оттуда и обновляем кэш.
  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      // API — источник истины (всегда пробуем первым)
      const url = selectedLang ? `${API_BASE}?language_code=${selectedLang}` : API_BASE;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) {
        const data = await res.json();
        const apiRules: DialectRule[] = data.rules || [];
        // Обновляем офлайн-кэш актуальными данными с сервера
        saveToLS(apiRules);
        setRules(apiRules);
        setCounts(data.counts ?? computeCounts(apiRules));
        setLoading(false);
        return;
      }
    } catch {
      // API недоступен → тихо переходим на localStorage
    }

    // Офлайн-фолбэк: только активные, из localStorage
    const localRules = loadFromLS().filter(r => r.is_active);
    const filtered = selectedLang ? localRules.filter(r => r.language_code === selectedLang) : localRules;
    setRules(filtered);
    setCounts(computeCounts(localRules));
    setLoading(false);
  }, [selectedLang, token]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // ── Фильтрация языков в селекторе ───────────────────────────────
  const filteredLanguages = useMemo(() => {
    const q = langSearch.toLowerCase().trim();
    if (!q) return ALL_LANGUAGES;
    return ALL_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.nameEn.toLowerCase().includes(q) || l.code.includes(q),
    );
  }, [langSearch]);

  // ── CSV Import ──────────────────────────────────────────────────
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const entries: GlossaryEntry[] = [];
      // Пропускаем заголовок, если есть
      const start = lines[0]?.toLowerCase().includes('dialect') ? 1 : 0;
      for (let i = start; i < lines.length; i++) {
        const parts = lines[i].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
        if (parts[0]) {
          entries.push({
            dialectWord: parts[0] || '',
            officialTranslation: parts[1] || '',
            contextHint: parts[2] || '',
          });
        }
      }
      if (entries.length > 0) {
        setGlossaryEntries(entries);
        setIsCompiled(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Компиляция промпта (API + локальный фолбэк) ──────────────────
  const handleCompile = async () => {
    setCompiling(true);
    const glossary: Record<string, string> = {};
    glossaryEntries.forEach((e) => {
      if (e.dialectWord.trim()) {
        const val = e.contextHint
          ? `${e.officialTranslation} (${e.contextHint})`
          : e.officialTranslation;
        glossary[e.dialectWord] = val;
      }
    });

    // Пробуем API
    try {
      const res = await fetch(`${API_BASE}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ language_code: formLang, dialect_name: formDialectName, prompt_hints: formPromptHints, glossary }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompiledInstruction(data.compiled_instruction || '');
        setIsCompiled(true);
        setCompiling(false);
        return;
      }
    } catch { /* API недоступен — компилируем локально */ }

    // Локальная компиляция (зеркало backend /compile): база всегда, подсказки — опционально.
    const langName = getLang(formLang)?.nameEn || formLang;
    const glossaryLines = Object.entries(glossary).map(([k, v]) => `- "${k}" → "${v}"`).join('\n');
    let compiled = `You are a real-time audio interpreter and transcriber. The speaker communicates in ${langName} and may use the regional dialect/variant "${formDialectName}".\n\nDIALECT GUIDELINES (base):\n${BASE_DIALECT_GUIDELINES}`;
    const extraHints = formPromptHints.trim();
    if (extraHints) {
      compiled += `\n\nADDITIONAL NOTES FOR THIS DIALECT (from the administrator — apply on top of the base guidelines):\n${extraHints}`;
    }
    if (glossaryLines) {
      compiled += `\n\nVOCABULARY GLOSSARY (dialect term → standard translation):\n${glossaryLines}\n\nWhen you detect these dialect expressions, apply the glossary mappings above for accurate translation.`;
    }
    setCompiledInstruction(compiled);
    setIsCompiled(true);
    setCompiling(false);
  };

  // ── Сохранение ───────────────────────────────────────────────────
  // ИСПРАВЛЕНО: раньше клиент генерировал UUID ДО запроса к API, из-за чего
  // localStorage и API хранили одно правило с РАЗНЫМИ UUID → двойной показ.
  // Теперь: для новых правил — сначала POST, берём серверный UUID, только потом
  // пишем в localStorage. Для обновлений — PUT по стабильному editingId.
  const handleSave = async () => {
    setSaving(true);
    setFormError('');
    try {
      const glossary: Record<string, { t: string; c: string }> = {};
      glossaryEntries.forEach((e) => {
        if (e.dialectWord.trim()) {
          glossary[e.dialectWord] = { t: e.officialTranslation, c: e.contextHint || '' };
        }
      });

      const body = {
        language_code: formLang,
        dialect_name: formDialectName,
        prompt_hints: formPromptHints,
        glossary,
        compiled_instruction: compiledInstruction,
      };
      const reqHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      const res = editingId
        ? await fetch(`${API_BASE}/${editingId}`, { method: 'PUT', headers: reqHeaders, body: JSON.stringify(body) })
        : await fetch(API_BASE, { method: 'POST', headers: reqHeaders, body: JSON.stringify(body) });

      if (!res.ok) {
        const errText = res.status === 401 || res.status === 403
          ? 'Сессия суперадмина истекла или нет прав. Перелогиньтесь и сохраните снова.'
          : `Сервер вернул ошибку ${res.status}. Правило не сохранено — попробуйте ещё раз.`;
        setFormError(errText);
        return; // форму НЕ закрываем
      }

      // Сервер вернул правило с его UUID → синхронизируем localStorage
      const serverRule: DialectRule = await res.json();
      const allRules = loadFromLS();
      if (editingId) {
        const idx = allRules.findIndex(r => r.id === editingId);
        if (idx !== -1) allRules[idx] = serverRule; else allRules.unshift(serverRule);
      } else {
        // Убираем возможные "висячие" записи того же диалекта с клиентскими UUID
        // (на случай если предыдущий сеанс сохранил без API-ответа).
        allRules.unshift(serverRule);
      }
      saveToLS(allRules);

      await fetchRules();
      resetForm();
    } catch {
      setFormError('Сервер недоступен. Правило не сохранено — проверьте соединение и попробуйте снова.');
    } finally {
      setSaving(false);
    }
  };

  // ── Удаление ────────────────────────────────────────────────────
  // ИСПРАВЛЕНО: раньше правило помечалось is_active=false, но оставалось в localStorage.
  // При следующем fetchRules мерж-логика добавляла его обратно (ID не совпадал с API).
  // Теперь: удаляем из localStorage ПОЛНОСТЬЮ, ждём API, при ошибке — возвращаем.
  const handleDelete = async (id: string) => {
    // Оптимистично убираем из UI и localStorage
    const prevRules = loadFromLS();
    saveToLS(prevRules.filter(r => r.id !== id));
    setRules(prev => prev.filter(r => r.id !== id));

    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok && res.status !== 404) {
        // Откатываем — возвращаем правило в localStorage и список
        saveToLS(prevRules);
        await fetchRules();
        return;
      }
    } catch {
      // Сеть недоступна — откатываем
      saveToLS(prevRules);
      await fetchRules();
      return;
    }

    // Успех: обновляем счётчики и localStorage от API
    await fetchRules();
  };

  // ── Редактирование ──────────────────────────────────────────────
  const handleEdit = (rule: DialectRule) => {
    setEditingId(rule.id);
    setFormLang(rule.language_code);
    setFormDialectName(rule.dialect_name);
    setFormPromptHints(rule.prompt_hints);
    const entries: GlossaryEntry[] = Object.entries(rule.glossary || {}).map(([k, v]) => {
      // Новая форма {t, c} → восстанавливаем перевод И контекст; легаси-строка → только перевод.
      if (v && typeof v === 'object') {
        return { dialectWord: k, officialTranslation: (v as { t?: string }).t || '', contextHint: (v as { c?: string }).c || '' };
      }
      return { dialectWord: k, officialTranslation: String(v), contextHint: '' };
    });
    setGlossaryEntries(entries.length > 0 ? entries : [{ dialectWord: '', officialTranslation: '', contextHint: '' }]);
    setCompiledInstruction(rule.compiled_instruction || '');
    setIsCompiled(!!rule.compiled_instruction);
    setFormError('');
    setShowForm(true);
  };

  // ── Сброс формы ─────────────────────────────────────────────────
  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormLang(selectedLang || 'ru');
    setFormDialectName('');
    setFormPromptHints('');
    setGlossaryEntries([{ dialectWord: '', officialTranslation: '', contextHint: '' }]);
    setCompiledInstruction('');
    setIsCompiled(false);
    setFormError('');
    setFormLangSearch('');
    setFormLangDropdownOpen(false);
  };

  // ── Фильтрованные языки в форме ─────────────────────────────────
  const formFilteredLangs = useMemo(() => {
    const q = formLangSearch.toLowerCase().trim();
    if (!q) return ALL_LANGUAGES;
    return ALL_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.nameEn.toLowerCase().includes(q) || l.code.includes(q),
    );
  }, [formLangSearch]);

  // ── Закрытие дропдауна при клике вне ─────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (formLangRef.current && !formLangRef.current.contains(e.target as Node)) {
        setFormLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Glossary row helpers ────────────────────────────────────────
  const addGlossaryRow = () => {
    setGlossaryEntries([...glossaryEntries, { dialectWord: '', officialTranslation: '', contextHint: '' }]);
  };

  const removeGlossaryRow = (idx: number) => {
    setGlossaryEntries(glossaryEntries.filter((_, i) => i !== idx));
    setIsCompiled(false);
  };

  const updateGlossaryRow = (idx: number, field: keyof GlossaryEntry, value: string) => {
    const copy = [...glossaryEntries];
    copy[idx] = { ...copy[idx], [field]: value };
    setGlossaryEntries(copy);
    setIsCompiled(false);
  };

  // ── Получить язык по коду ───────────────────────────────────────
  const getLang = (code: string) => ALL_LANGUAGES.find((l) => l.code === code);

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in dialects-page" style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>

      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .dialects-lang-chips {
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            padding-bottom: 8px;
          }
          .dialects-lang-chips::-webkit-scrollbar { display: none; }
          .dialects-modal-overlay {
            padding: 0 !important;
            align-items: flex-end !important;
            display: flex !important;
          }
          .dialects-modal-content {
            max-width: 100% !important;
            border-radius: 20px 20px 0 0 !important;
            max-height: 90vh !important;
            margin: 0 !important;
            animation: slideUpSheet 0.3s ease-out !important;
          }
          .dialects-glossary-desktop { display: none !important; }
          .dialects-glossary-mobile { display: flex !important; }
          .dialects-rule-card-inner { flex-direction: column; align-items: flex-start !important; gap: 10px !important; }
          .dialects-rule-actions { width: 100%; justify-content: flex-end; }
        }
        @media (min-width: 641px) {
          .dialects-glossary-mobile { display: none !important; }
        }
        @keyframes slideUpSheet {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
            }}
          >
            <Brain size={24} strokeWidth={1.5} color="#fff" />
          </div>
          <div>
            <h1
              style={{
                fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 700,
                color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0,
              }}
            >
              AI Learning Hub
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Обучение ИИ распознаванию диалектов и наречий для Gemini Live API
            </p>
          </div>
        </div>
      </div>

      {/* ── Language Selector ──────────────────────────────────── */}
      <AuroraCard>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Languages size={18} strokeWidth={1.5} style={{ color: 'var(--accent-orange)' }} />
            <span style={{
              fontSize: 13, fontWeight: 700, textTransform: 'uppercase' as const,
              letterSpacing: '0.08em', color: 'var(--text-muted)',
            }}>
              Фильтр по языку
            </span>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search
              size={16} strokeWidth={1.5}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              placeholder="Поиск языка..."
              value={langSearch}
              onChange={(e) => setLangSearch(e.target.value)}
              className="aurora-input"
              style={{ paddingLeft: 38, width: '100%', fontSize: 14 }}
            />
          </div>

          {/* Language Chips */}
          <div
            className="dialects-lang-chips"
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 8,
            }}
          >
            {/* "Все" chip */}
            <button
              onClick={() => setSelectedLang(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
                border: selectedLang === null ? '1.5px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                background: selectedLang === null ? 'rgba(52, 211, 153, 0.12)' : 'var(--bg-tertiary)',
                color: selectedLang === null ? 'var(--accent-green)' : 'var(--text-secondary)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Все
              <span style={{
                fontSize: 11, padding: '1px 6px', borderRadius: 10,
                background: selectedLang === null ? 'var(--accent-green)' : 'var(--bg-elevated, var(--bg-secondary))',
                color: selectedLang === null ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
              }}>
                {Object.values(counts).reduce((a, b) => a + b, 0)}
              </span>
            </button>

            {filteredLanguages.map((lang) => {
              const count = counts[lang.code] || 0;
              const isActive = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLang(isActive ? null : lang.code)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                    border: isActive ? '1.5px solid var(--accent-green)' : '1px solid var(--border-subtle)',
                    background: isActive ? 'rgba(52, 211, 153, 0.12)' : 'var(--bg-tertiary)',
                    color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                  {count > 0 && (
                    <span style={{
                      fontSize: 11, padding: '1px 6px', borderRadius: 10,
                      background: isActive ? 'var(--accent-green)' : 'var(--accent-orange)',
                      color: '#fff', fontWeight: 700, minWidth: 18, textAlign: 'center' as const,
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </AuroraCard>

      {/* ── Add Rule Button ────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '20px 0 12px' }}>
        <AuroraButton
          variant="primary"
          icon={<Plus size={18} />}
          onClick={() => { resetForm(); setShowForm(true); }}
          id="btn-add-dialect-rule"
        >
          Добавить правило
        </AuroraButton>
      </div>

      {/* ── Rules Table ────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader2 size={32} strokeWidth={1.5} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 12 }}>Загрузка правил…</p>
        </div>
      ) : rules.length === 0 ? (
        <AuroraCard>
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <BookOpen size={40} strokeWidth={1} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 15, fontWeight: 500 }}>
              {selectedLang
                ? `Для языка «${getLang(selectedLang)?.name || selectedLang}» ещё нет правил.`
                : 'Нет созданных правил обучения.'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Создайте первое правило обучения диалекту.
            </p>
          </div>
        </AuroraCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map((rule) => {
            const lang = getLang(rule.language_code);
            const glossaryCount = Object.keys(rule.glossary || {}).length;
            return (
              <AuroraCard key={rule.id}>
                <div className="dialects-rule-card-inner" style={{
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                  flexWrap: 'wrap',
                }}>
                  {/* Flag + info */}
                  <span style={{ fontSize: 28 }}>{lang?.flag || '🌐'}</span>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
                      {rule.dialect_name}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
                      {lang?.name || rule.language_code} · {glossaryCount} {glossaryCount === 1 ? 'слово' : 'слов'} в глоссарии
                    </p>
                  </div>

                  {/* Status */}
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: rule.is_active ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.05)',
                    color: rule.is_active ? 'var(--accent-green)' : 'var(--text-muted)',
                    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                  }}>
                    {rule.is_active ? 'Активно' : 'Отключено'}
                  </span>

                  {/* Actions */}
                  <div className="dialects-rule-actions" style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleEdit(rule)}
                      title="Редактировать"
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-tertiary)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)', transition: 'all 0.15s',
                      }}
                    >
                      <Edit3 size={15} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      title="Удалить"
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-tertiary)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#F87171', transition: 'all 0.15s',
                      }}
                    >
                      <Trash2 size={15} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </AuroraCard>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
       *  ADD / EDIT FORM (slide-down panel)
       * ══════════════════════════════════════════════════════════ */}
      {showForm && (
        <div
          className="animate-fade-in dialects-modal-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            overflowY: 'auto', padding: '40px 16px',
          }}
        >
          <div className="dialects-modal-content" style={{
            maxWidth: 720, margin: '0 auto',
            background: 'var(--card-bg, var(--bg-secondary))',
            border: '1px solid var(--card-border, var(--border-subtle))',
            borderRadius: 20, padding: 28,
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            overflowY: 'auto',
          }}>
            {/* Bottom Sheet drag handle (mobile) */}
            <div style={{ display: 'none', justifyContent: 'center', marginBottom: 12 }} className="dialects-modal-handle">
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-subtle)' }} />
            </div>
            {/* Form Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <GraduationCap size={20} color="#fff" />
                </div>
                <h2 style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700,
                  color: 'var(--text-primary)', margin: 0,
                }}>
                  {editingId ? 'Редактирование правила' : 'Новое правило обучения'}
                </h2>
              </div>
              <button
                onClick={resetForm}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Language Selector with Search */}
            <div style={{ marginBottom: 20 }} ref={formLangRef}>
              <label style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
                letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: 6,
              }}>
                Базовый язык
              </label>
              <div style={{ position: 'relative' }}>
                {/* Selected / Search input */}
                <div
                  onClick={() => setFormLangDropdownOpen(!formLangDropdownOpen)}
                  className="aurora-input"
                  style={{
                    width: '100%', fontSize: 14, padding: '10px 14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span>{getLang(formLang)?.flag} {getLang(formLang)?.name} ({getLang(formLang)?.nameEn})</span>
                  <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>

                {/* Dropdown */}
                {formLangDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
                    marginTop: 4, borderRadius: 12, overflow: 'hidden',
                    background: 'var(--card-bg, var(--bg-secondary))',
                    border: '1px solid var(--card-border, var(--border-subtle))',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                  }}>
                    {/* Search input */}
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ position: 'relative' }}>
                        <Search
                          size={14} strokeWidth={1.5}
                          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="Поиск языка..."
                          value={formLangSearch}
                          onChange={(e) => setFormLangSearch(e.target.value)}
                          className="aurora-input"
                          style={{ width: '100%', fontSize: 13, paddingLeft: 32, padding: '8px 10px 8px 32px' }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {/* Language list */}
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {formFilteredLangs.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                          Язык не найден
                        </div>
                      ) : formFilteredLangs.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => {
                            setFormLang(l.code);
                            setFormLangDropdownOpen(false);
                            setFormLangSearch('');
                            setIsCompiled(false);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '9px 14px', border: 'none', cursor: 'pointer',
                            background: formLang === l.code ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
                            color: formLang === l.code ? 'var(--accent-green)' : 'var(--text-primary)',
                            fontSize: 13, fontFamily: 'Inter, sans-serif', textAlign: 'left' as const,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = formLang === l.code ? 'rgba(52,211,153,0.15)' : 'var(--bg-tertiary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = formLang === l.code ? 'rgba(52,211,153,0.1)' : 'transparent')}
                        >
                          <span style={{ fontSize: 18 }}>{l.flag}</span>
                          <span style={{ flex: 1 }}>{l.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.nameEn}</span>
                          {formLang === l.code && <Check size={14} strokeWidth={2.5} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dialect Name */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
                letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: 6,
              }}>
                Название диалекта / наречия
              </label>
              <input
                type="text"
                placeholder="Напр.: Ташкентский диалект, Баварский немецкий..."
                value={formDialectName}
                onChange={(e) => { setFormDialectName(e.target.value); setIsCompiled(false); }}
                className="aurora-input"
                style={{ width: '100%', fontSize: 14, padding: '10px 14px' }}
              />
            </div>

            {/* Prompt Hints */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
                letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: 6,
              }}>
                Подсказки для ИИ — дополнение к базовому промпту (необязательно)
              </label>
              <textarea
                placeholder="Необязательно. Базовая инструкция уже встроена и подстраивается под выбранный язык. Здесь можно ДОПОЛНИТЬ её под конкретный диалект: фонетика, замена букв, особые конструкции, контекст домена…"
                value={formPromptHints}
                onChange={(e) => { setFormPromptHints(e.target.value); setIsCompiled(false); }}
                className="aurora-input"
                style={{
                  width: '100%', fontSize: 14, padding: '10px 14px',
                  minHeight: 80, resize: 'vertical',
                  fontFamily: 'Inter, sans-serif',
                }}
                rows={3}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Оставьте пустым — сработает встроенная база. Заполните — ваш текст добавится поверх базы.
              </p>
            </div>

            {/* ── Glossary Editor ─────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em', color: 'var(--text-muted)',
                }}>
                  Глоссарий (словарь диалекта)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', border: '1px dashed var(--border-medium)',
                      background: 'transparent', color: 'var(--accent-orange)',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <Upload size={13} /> Импорт CSV
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVImport}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Desktop: Table header + rows */}
              <div className="dialects-glossary-desktop">
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px',
                  gap: 8, marginBottom: 6,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                    Слово диалекта
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                    Официальный перевод
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                    Контекст / Подсказка
                  </span>
                  <span />
                </div>
                {glossaryEntries.map((entry, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 36px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input className="aurora-input" style={{ fontSize: 13, padding: '8px 10px' }} placeholder="напр.: кетмон" value={entry.dialectWord} onChange={(e) => updateGlossaryRow(idx, 'dialectWord', e.target.value)} />
                    <input className="aurora-input" style={{ fontSize: 13, padding: '8px 10px' }} placeholder="напр.: мотыга" value={entry.officialTranslation} onChange={(e) => updateGlossaryRow(idx, 'officialTranslation', e.target.value)} />
                    <input className="aurora-input" style={{ fontSize: 13, padding: '8px 10px' }} placeholder="контекст" value={entry.contextHint} onChange={(e) => updateGlossaryRow(idx, 'contextHint', e.target.value)} />
                    <button onClick={() => removeGlossaryRow(idx)} disabled={glossaryEntries.length <= 1} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: glossaryEntries.length <= 1 ? 'transparent' : 'rgba(248,113,113,0.1)', cursor: glossaryEntries.length <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: glossaryEntries.length <= 1 ? 'var(--border-subtle)' : '#F87171' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Mobile: Card-based glossary */}
              <div className="dialects-glossary-mobile" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
                {glossaryEntries.map((entry, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                      <button onClick={() => removeGlossaryRow(idx)} disabled={glossaryEntries.length <= 1} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: glossaryEntries.length <= 1 ? 'transparent' : 'rgba(248,113,113,0.1)', cursor: glossaryEntries.length <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: glossaryEntries.length <= 1 ? 'var(--border-subtle)' : '#F87171' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <input className="aurora-input" style={{ fontSize: 13, padding: '8px 10px', width: '100%', marginBottom: 6 }} placeholder="Слово диалекта" value={entry.dialectWord} onChange={(e) => updateGlossaryRow(idx, 'dialectWord', e.target.value)} />
                    <input className="aurora-input" style={{ fontSize: 13, padding: '8px 10px', width: '100%', marginBottom: 6 }} placeholder="Официальный перевод" value={entry.officialTranslation} onChange={(e) => updateGlossaryRow(idx, 'officialTranslation', e.target.value)} />
                    <input className="aurora-input" style={{ fontSize: 13, padding: '8px 10px', width: '100%' }} placeholder="Контекст / подсказка" value={entry.contextHint} onChange={(e) => updateGlossaryRow(idx, 'contextHint', e.target.value)} />
                  </div>
                ))}
              </div>

              <button onClick={addGlossaryRow} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
                <Plus size={14} /> Добавить строку
              </button>
            </div>

            {/* ── ИИ-Полигон (v0.3.0) ─────────────────────────── */}
            <div style={{ marginBottom: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <DialectPlayground
                dialectRuleId={editingId || undefined}
                languageCode={formLang}
                compiledInstruction={compiledInstruction}
              />
            </div>

            {/* ── Compile Button ──────────────────────────────── */}
            <div style={{ marginBottom: 20 }}>
              <AuroraButton
                variant="secondary"
                icon={compiling ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                onClick={handleCompile}
                loading={compiling}
                id="btn-compile-prompt"
              >
                Скомпилировать промпт обучения ИИ
              </AuroraButton>
            </div>

            {/* ── Compiled Instruction Preview ────────────────── */}
            {compiledInstruction && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Terminal size={14} style={{ color: 'var(--accent-green)' }} />
                  <label style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em', color: 'var(--text-muted)',
                  }}>
                    Итоговая системная инструкция для Gemini Live API (English)
                  </label>
                </div>
                <textarea
                  value={compiledInstruction}
                  onChange={(e) => setCompiledInstruction(e.target.value)}
                  className="aurora-input"
                  style={{
                    width: '100%', minHeight: 160, resize: 'vertical',
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: 12, lineHeight: 1.6, padding: '14px 16px',
                    color: 'var(--accent-green)',
                    background: 'rgba(0,0,0,0.3)',
                  }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Вы можете отредактировать промпт вручную перед сохранением.
                </p>
              </div>
            )}

            {/* ── Save Button ─────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <AuroraButton variant="ghost" onClick={resetForm} id="btn-cancel-dialect">
                Отмена
              </AuroraButton>
              <AuroraButton
                variant="primary"
                icon={saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                onClick={handleSave}
                loading={saving}
                id="btn-save-dialect"
                disabled={!isCompiled || !formDialectName.trim()}
              >
                Сохранить и активировать
              </AuroraButton>
            </div>

            {!isCompiled && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 14px',
                borderRadius: 10, background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)',
              }}>
                <AlertTriangle size={16} style={{ color: '#FBBF24', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#FBBF24', margin: 0 }}>
                  Сначала нажмите «Скомпилировать промпт обучения ИИ» для проверки и сохранения.
                </p>
              </div>
            )}

            {formError && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '10px 14px',
                borderRadius: 10, background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.25)',
              }}>
                <AlertTriangle size={16} style={{ color: '#F87171', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>
                  {formError}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
