/**
 * LandingPage — заглавная публичная страница VibeVox.
 *
 * НОВАЯ страница, изолирована от существующего приложения (своя обёртка,
 * свои компоненты, тёплый оранжевый акцент #ff7300). Не меняет общие токены
 * и готовые страницы. Контент пока на русском (эталон для отладки).
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  Zap, RefreshCw, Waves, GraduationCap, MessagesSquare, KeyRound,
  Share2, ArrowRight, Check, X,
} from 'lucide-react';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const STATS = [
  { v: '€0.17', l: 'за минуту' },
  { v: '107', l: 'языков' },
  { v: '<0.5 с', l: 'задержка перевода' },
  { v: '0%', l: 'сгорания минут' },
];

// ─── 107 языков VibeVox ─── country = ISO 3166-1 alpha-2 для flagcdn.com ───
const LANG_LIST = [
  // ── Европа ──
  { code:'en', country:'gb',     name:'English' },
  { code:'de', country:'de',     name:'Deutsch' },
  { code:'fr', country:'fr',     name:'Français' },
  { code:'es', country:'es',     name:'Español' },
  { code:'it', country:'it',     name:'Italiano' },
  { code:'pt', country:'br',     name:'Português' },
  { code:'pl', country:'pl',     name:'Polski' },
  { code:'nl', country:'nl',     name:'Nederlands' },
  { code:'sv', country:'se',     name:'Svenska' },
  { code:'da', country:'dk',     name:'Dansk' },
  { code:'no', country:'no',     name:'Norsk' },
  { code:'fi', country:'fi',     name:'Suomi' },
  { code:'cs', country:'cz',     name:'Čeština' },
  { code:'sk', country:'sk',     name:'Slovenčina' },
  { code:'hu', country:'hu',     name:'Magyar' },
  { code:'ro', country:'ro',     name:'Română' },
  { code:'bg', country:'bg',     name:'Български' },
  { code:'hr', country:'hr',     name:'Hrvatski' },
  { code:'sl', country:'si',     name:'Slovenščina' },
  { code:'sr', country:'rs',     name:'Српски' },
  { code:'uk', country:'ua',     name:'Українська' },
  { code:'ru', country:'ru',     name:'Русский' },
  { code:'be', country:'by',     name:'Беларуская' },
  { code:'mk', country:'mk',     name:'Македонски' },
  { code:'bs', country:'ba',     name:'Bosanski' },
  { code:'el', country:'gr',     name:'Ελληνικά' },
  { code:'et', country:'ee',     name:'Eesti' },
  { code:'lv', country:'lv',     name:'Latviešu' },
  { code:'lt', country:'lt',     name:'Lietuvių' },
  { code:'sq', country:'al',     name:'Shqip' },
  { code:'is', country:'is',     name:'Íslenska' },
  { code:'ga', country:'ie',     name:'Gaeilge' },
  { code:'cy', country:'gb-wls', name:'Cymraeg' },
  { code:'mt', country:'mt',     name:'Malti' },
  { code:'eu', country:'es',     name:'Euskara' },
  { code:'ca', country:'ad',     name:'Català' },
  { code:'gl', country:'es',     name:'Galego' },
  { code:'lb', country:'lu',     name:'Lëtzebuergesch' },
  { code:'co', country:'fr',     name:'Corsu' },
  { code:'eo', country:null,     name:'Esperanto' },
  // ── Ближний Восток / Кавказ ──
  { code:'ar', country:'sa',     name:'العربية' },
  { code:'he', country:'il',     name:'עברית' },
  { code:'fa', country:'ir',     name:'فارسی' },
  { code:'ur', country:'pk',     name:'اردو' },
  { code:'tr', country:'tr',     name:'Türkçe' },
  { code:'az', country:'az',     name:'Azərbaycan' },
  { code:'ka', country:'ge',     name:'ქართული' },
  { code:'hy', country:'am',     name:'Հայերեն' },
  { code:'ku', country:'iq',     name:'Kurdî' },
  { code:'yi', country:'il',     name:'ייִדיש' },
  // ── Центральная Азия ──
  { code:'kk', country:'kz',     name:'Қазақша' },
  { code:'uz', country:'uz',     name:"O'zbek" },
  { code:'tg', country:'tj',     name:'Тоҷикӣ' },
  { code:'ky', country:'kg',     name:'Кыргызча' },
  // ── Восточная Азия ──
  { code:'zh', country:'cn',     name:'中文' },
  { code:'ja', country:'jp',     name:'日本語' },
  { code:'ko', country:'kr',     name:'한국어' },
  { code:'mn', country:'mn',     name:'Монгол' },
  { code:'tk', country:'tm',     name:'Türkmen' },
  // ── Южная Азия ──
  { code:'hi', country:'in',     name:'हिन्दी' },
  { code:'bn', country:'bd',     name:'বাংলা' },
  { code:'pa', country:'in',     name:'ਪੰਜਾਬੀ' },
  { code:'gu', country:'in',     name:'ગુજરાતી' },
  { code:'mr', country:'in',     name:'मराठी' },
  { code:'ta', country:'in',     name:'தமிழ்' },
  { code:'te', country:'in',     name:'తెలుగు' },
  { code:'ml', country:'in',     name:'മലയാളം' },
  { code:'kn', country:'in',     name:'ಕನ್ನಡ' },
  { code:'ne', country:'np',     name:'नेपाली' },
  { code:'si', country:'lk',     name:'සිංහල' },
  { code:'ps', country:'af',     name:'پښتو' },
  { code:'sd', country:'pk',     name:'سنڌي' },
  // ── Юго-Восточная Азия ──
  { code:'th', country:'th',     name:'ภาษาไทย' },
  { code:'vi', country:'vn',     name:'Tiếng Việt' },
  { code:'id', country:'id',     name:'Bahasa Indonesia' },
  { code:'ms', country:'my',     name:'Bahasa Melayu' },
  { code:'fil', country:'ph',    name:'Filipino' },
  { code:'tl', country:'ph',     name:'Tagalog' },
  { code:'km', country:'kh',     name:'ខ្មែរ' },
  { code:'lo', country:'la',     name:'ລາວ' },
  { code:'my', country:'mm',     name:'မြန်မာ' },
  { code:'jv', country:'id',     name:'Basa Jawa' },
  { code:'su', country:'id',     name:'Basa Sunda' },
  { code:'ceb', country:'ph',    name:'Cebuano' },
  // ── Африка ──
  { code:'af', country:'za',     name:'Afrikaans' },
  { code:'sw', country:'ke',     name:'Kiswahili' },
  { code:'am', country:'et',     name:'አማርኛ' },
  { code:'so', country:'so',     name:'Soomaali' },
  { code:'yo', country:'ng',     name:'Yorùbá' },
  { code:'ig', country:'ng',     name:'Igbo' },
  { code:'ha', country:'ng',     name:'Hausa' },
  { code:'zu', country:'za',     name:'isiZulu' },
  { code:'xh', country:'za',     name:'isiXhosa' },
  { code:'st', country:'ls',     name:'Sesotho' },
  { code:'sn', country:'zw',     name:'Shona' },
  { code:'rw', country:'rw',     name:'Kinyarwanda' },
  { code:'mg', country:'mg',     name:'Malagasy' },
  { code:'ny', country:'mw',     name:'Chichewa' },
  { code:'om', country:'et',     name:'Afaan Oromoo' },
  { code:'ln', country:'cd',     name:'Lingala' },
  { code:'tw', country:'gh',     name:'Twi' },
  // ── Америка / Пацифик / Прочее ──
  { code:'ht', country:'ht',     name:'Haitian Creole' },
  { code:'haw', country:'us',    name:'ʻŌlelo Hawaiʻi' },
  { code:'mi', country:'nz',     name:'Māori' },
  { code:'sm', country:'ws',     name:'Gagana Samoa' },
  { code:'hmn', country:'la',    name:'Hmong' },
  { code:'la', country:'va',     name:'Latina' },
];
// Ровно 107 языков. Делим для двух строк бегущей строки.
const ROW1 = LANG_LIST.slice(0, 54);   // 54 — европейские + ближний восток + ЦА
const ROW2 = LANG_LIST.slice(54);      // 53 — азиатские + африканские + прочие

const FEATURES = [
  {
    icon: Share2,
    title: 'Ссылка вместо установки',
    text: 'Отправьте ссылку в WhatsApp или Telegram — собеседник подключается прямо из браузера. Никакого App Store, IT-отдела и настроек. Работает на любом устройстве.',
  },
  {
    icon: Zap,
    title: '€0.17 за минуту — в 5–15 раз дешевле',
    text: 'Самая низкая розничная цена на рынке синхронного перевода. Оплата только за реально переведённые минуты — без подписки и годового контракта.',
  },
  {
    icon: RefreshCw,
    title: 'Минуты не сгорают никогда',
    text: 'Неиспользованный остаток автоматически переходит на следующий месяц. Заплатили — минуты ваши без дедлайна.',
  },
  {
    icon: Waves,
    title: 'Живой голос, не робот',
    text: 'HD-голоса Aoede и Charon. Gemini переводит аудио сразу в аудио — без цепочки STT→текст→TTS. Задержка менее 0.5 секунды, разговор идёт в естественном ритме.',
  },
  {
    icon: GraduationCap,
    title: 'Понимает ваш сленг и диалекты',
    text: 'AI Learning Hub адаптируется под терминологию вашей ниши и 96 региональных диалектов — египетский арабский, латиноамериканский испанский. За 1 час использования.',
  },
  {
    icon: KeyRound,
    title: 'Свой ключ Gemini — звонки бесплатно',
    text: 'Enterprise BYOK: подключите собственный API-ключ Google и проводите встречи, оплачивая только инфраструктуру по себестоимости.',
  },
];

const COMPARE = [
  { name: 'Palabra.ai', them: '$0.85–1.20 / мин · минуты сгорают · только веб', us: '€0.17/мин · перенос минут · SIP + веб' },
  { name: 'Interprefy', them: 'от $2.50 / мин · запуск через техподдержку', us: 'Запуск комнаты в 1 клик · BYOK · экономия до 93%' },
  { name: 'Sanas.ai', them: 'не переводит между языками · только Enterprise', us: 'Перевод между 107 языками · самообслуживание' },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: 'easeOut' as const },
};

/** Флаг через flagcdn.com/w{width} — поддерживает любую ширину (не фиксированные пары). */
function LangFlag({ country, w = 20 }: { country: string | null; w?: number }) {
  if (!country) {
    return <span style={{ fontSize: 14, lineHeight: 1, display: 'inline-block', width: w, textAlign: 'center' as const }}>🌐</span>;
  }
  return (
    <img
      src={`https://flagcdn.com/w${w}/${country}.png`}
      srcSet={`https://flagcdn.com/w${w * 2}/${country}.png 2x`}
      width={w}
      alt=""
      loading="lazy"
      decoding="async"
      style={{ borderRadius: 2, objectFit: 'cover', display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, aspectRatio: '4/3' }}
    />
  );
}

// ─── Динамический заголовок от языка браузера ───
const BROWSER_LANG_MAP: Record<string, { name: string; country: string }> = {
  ru: { name: 'русского', country: 'ru' },
  en: { name: 'English', country: 'gb' },
  de: { name: 'Deutsch', country: 'de' },
  fr: { name: 'français', country: 'fr' },
  es: { name: 'español', country: 'es' },
  it: { name: 'italiano', country: 'it' },
  pt: { name: 'português', country: 'br' },
  pl: { name: 'polski', country: 'pl' },
  uk: { name: 'українська', country: 'ua' },
  nl: { name: 'Nederlands', country: 'nl' },
  tr: { name: 'Türkçe', country: 'tr' },
  ar: { name: 'العربية', country: 'sa' },
  zh: { name: '中文', country: 'cn' },
  ja: { name: '日本語', country: 'jp' },
  ko: { name: '한국어', country: 'kr' },
  hi: { name: 'हिन्दी', country: 'in' },
  sv: { name: 'svenska', country: 'se' },
  da: { name: 'dansk', country: 'dk' },
  no: { name: 'norsk', country: 'no' },
  fi: { name: 'suomi', country: 'fi' },
  cs: { name: 'čeština', country: 'cz' },
  el: { name: 'ελληνικά', country: 'gr' },
  he: { name: 'עברית', country: 'il' },
  th: { name: 'ภาษาไทย', country: 'th' },
  vi: { name: 'tiếng Việt', country: 'vn' },
  id: { name: 'bahasa Indonesia', country: 'id' },
  ro: { name: 'română', country: 'ro' },
  hu: { name: 'magyar', country: 'hu' },
  bg: { name: 'български', country: 'bg' },
  ka: { name: 'ქართული', country: 'ge' },
  az: { name: 'Azərbaycan', country: 'az' },
  kk: { name: 'қазақша', country: 'kz' },
  uz: { name: "o'zbek", country: 'uz' },
};
function detectBrowserLang(): { name: string; country: string } {
  const raw = navigator.language || (navigator as any).userLanguage || 'en';
  const short = raw.split('-')[0].toLowerCase();
  return BROWSER_LANG_MAP[short] || BROWSER_LANG_MAP['en'];
}

/** Полная таблица 107 языков с поиском (имеет собственный state). */
function LanguageGrid() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? LANG_LIST.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q))
    : LANG_LIST;
  return (
    <div className="rounded-[2rem] p-6 sm:p-8" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Поиск */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск языка..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
          />
        </div>
        <p className="text-xs text-white/35 shrink-0">
          Проверьте, поддерживает ли он ваш язык →
        </p>
      </div>
      {/* Сетка */}
      {filtered.length === 0 ? (
        <p className="text-center text-white/40 text-sm py-6">Язык не найден</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {filtered.map((l) => (
            <div key={l.code}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all hover:-translate-y-px"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <LangFlag country={l.country} w={20} />
              <span className="text-white/75 truncate font-500 leading-tight">{l.name}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-white/25 mt-5">
        {filtered.length} из {LANG_LIST.length} языков
      </p>
    </div>
  );
}

function SectionLabel({ n, children }: { n: string; children: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-display font-700 text-sm tabular-nums" style={{ color: '#ff7300' }}>{n}</span>
      <span className="h-px w-8" style={{ background: 'rgba(255,115,0,0.55)' }} />
      <span className="text-xs font-700 uppercase tracking-[0.2em] text-white/50">{children}</span>
    </div>
  );
}

export function LandingPage() {
  const [browserLang, setBrowserLang] = useState<{ name: string; country: string }>({ name: 'русского', country: 'ru' });
  useEffect(() => { setBrowserLang(detectBrowserLang()); }, []);

  return (
    <div id="top" className="dark relative min-h-screen overflow-x-hidden text-white" style={{ background: '#0A0A0B' }}>
      <Helmet>
        <title>VibeVox — синхронный ИИ-перевод видеовстреч и звонков за €0.17/мин</title>
        <meta
          name="description"
          content="VibeVox: мгновенный двусторонний ИИ-перевод видеовстреч и SIP-звонков на 107 языков. HD-голоса, задержка менее 0.5 секунды, €0.17 за минуту, минуты не сгорают."
        />
        <style>{`
          @keyframes vv-mq-l { from { transform: translateX(0) } to { transform: translateX(-50%) } }
          @keyframes vv-mq-r { from { transform: translateX(-50%) } to { transform: translateX(0) } }
        `}</style>
      </Helmet>

      {/* Тёплые ambient-пятна */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 h-[40rem] w-[55rem] rounded-full blur-[150px] animate-aurora-drift"
             style={{ background: 'radial-gradient(circle, rgba(255,115,0,0.16), transparent 70%)' }} />
        <div className="absolute top-1/3 -right-40 h-[34rem] w-[34rem] rounded-full blur-[150px] animate-float"
             style={{ background: 'radial-gradient(circle, rgba(255,77,0,0.10), transparent 70%)' }} />
        <div className="absolute bottom-0 -left-32 h-[30rem] w-[30rem] rounded-full blur-[140px]"
             style={{ background: 'radial-gradient(circle, rgba(255,181,71,0.08), transparent 70%)' }} />
      </div>
      {/* Зерно */}
      <div className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035]" aria-hidden="true"
           style={{ backgroundImage: NOISE, mixBlendMode: 'overlay' }} />

      <div className="relative z-10">
        <PublicHeader />

        {/* ===== HERO ===== */}
        <section className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-12 text-center">
          <motion.div {...fadeUp} className="flex items-center justify-center gap-3 mb-7">
            <span className="h-px w-6" style={{ background: 'rgba(255,115,0,0.6)' }} />
            <span className="text-xs font-700 uppercase tracking-[0.22em]" style={{ color: '#ff8a2b' }}>
              Синхронный ИИ-перевод видеозвонков
            </span>
            <span className="h-px w-6" style={{ background: 'rgba(255,115,0,0.6)' }} />
          </motion.div>

          <motion.h1 {...fadeUp} transition={{ duration: 0.6, delay: 0.05 }}
            className="font-display font-800 tracking-[-0.03em] text-[2.65rem] leading-[1.04] sm:text-6xl lg:text-[4.75rem] mb-6">
            Стираем языковые барьеры<br />
            <span style={{ color: '#ff7300' }}>в реальном времени</span>
          </motion.h1>

          <motion.p {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-2xl mx-auto text-lg sm:text-xl text-white/60 leading-relaxed mb-9">
            Мгновенный двусторонний перевод видеовстреч и SIP-звонков на 100+ языков.
            HD-голоса, задержка менее 0.5 секунды, всего <b className="text-white">€0.17</b> за минуту.
          </motion.p>

          <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <a href="/" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-700 text-white transition-all hover:brightness-110 w-full sm:w-auto justify-center"
               style={{ background: '#ff7300', boxShadow: '0 12px 40px rgba(255,115,0,0.4)' }}>
              Создать демо-комнату <ArrowRight size={18} />
            </a>
            <a href="#pricing" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-700 text-white/85 transition-all hover:bg-white/5 w-full sm:w-auto justify-center"
               style={{ border: '1px solid rgba(255,255,255,0.16)' }}>
              Смотреть тарифы
            </a>
          </motion.div>

          {/* Editorial-статистика */}
          <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {STATS.map((s) => (
              <div key={s.l} className="px-4 py-5" style={{ background: '#0A0A0B' }}>
                <div className="font-display font-800 text-2xl sm:text-3xl" style={{ color: '#ff7300' }}>{s.v}</div>
                <div className="text-xs text-white/45 mt-1">{s.l}</div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ===== ВОЗМОЖНОСТИ ===== */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <motion.div {...fadeUp} className="mb-12">
            <SectionLabel n="01">Возможности</SectionLabel>
            <h2 className="font-display font-800 text-3xl sm:text-5xl tracking-[-0.02em] max-w-3xl mb-5">
              Без приложений. Без настроек.<br className="hidden sm:block" />
              <span style={{ color: '#ff7300' }}>Просто поделитесь ссылкой.</span>
            </h2>
            <p className="text-white/55 max-w-2xl text-lg leading-relaxed">
              VibeVox работает прямо в браузере. Создайте переговорную комнату за 1 клик,
              скопируйте ссылку и отправьте собеседнику в WhatsApp или Telegram —
              он подключается мгновенно, и оба слышат перевод друг друга на родном языке.
              Регистрация партнёру не нужна.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} {...fadeUp} transition={{ duration: 0.5, delay: (i % 3) * 0.07 }}
                className="group relative rounded-2xl p-6 transition-all hover:-translate-y-1 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: '#ff7300' }} />
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl mb-4"
                     style={{ background: 'rgba(255,115,0,0.12)', border: '1px solid rgba(255,115,0,0.28)' }}>
                  <f.icon size={20} style={{ color: '#ff8a2b' }} strokeWidth={1.9} />
                </div>
                <h3 className="font-700 text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.text}</p>
              </motion.div>
            ))}

            <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}
              className="sm:col-span-2 lg:col-span-3 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
              style={{ background: 'linear-gradient(135deg, rgba(255,115,0,0.08), rgba(255,77,0,0.04))', border: '1px solid rgba(255,115,0,0.2)' }}>
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                   style={{ background: 'rgba(255,115,0,0.18)', border: '1px solid rgba(255,115,0,0.32)' }}>
                <MessagesSquare size={20} style={{ color: '#ff8a2b' }} strokeWidth={1.9} />
              </div>
              <div>
                <h3 className="font-700 text-lg mb-1.5">Умные подсказки прямо во время звонка</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  В SIP-телефонии ИИ транскрибирует диалог в реальном времени и выводит менеджеру
                  готовые ответы на экран. После звонка — боли, триггеры и теги автоматически уходят в CRM
                  (Chatwoot, Questflow). Подключайтесь к АТС Zadarma, Twilio и любому SIP-шлюзу.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ===== 107 ЯЗЫКОВ ===== */}
        <section id="languages" className="relative py-20 overflow-hidden">
          {/* Фоновый акцент */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,115,0,0.06) 0%, transparent 70%)' }} />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 mb-12 text-center">
            <motion.div {...fadeUp}>
              <SectionLabel n="02">Охват языков</SectionLabel>
              <h2 className="font-display font-800 tracking-[-0.03em] text-4xl sm:text-6xl lg:text-[4.2rem] mb-5">
                Безупречный перевод{' '}
                <span className="inline-flex items-center gap-2 align-middle">
                  <LangFlag country={browserLang.country} w={40} />
                  <span style={{ color: '#ff7300' }}>{browserLang.name}</span>
                </span>
                <br />
                на 107 языков мира — и обратно.
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto text-lg leading-relaxed mb-7">
                Вы говорите на своём языке — собеседник слышит перевод на своём. Он отвечает —
                вы мгновенно слышите его на {browserLang.name}. Синхронно, без задержки, без акцента.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {[
                  '107 языков',
                  'Оба участника — на родном',
                  '< 0.5 с задержка',
                  'Региональные диалекты',
                ].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-600"
                    style={{ background: 'rgba(255,115,0,0.1)', border: '1px solid rgba(255,115,0,0.3)', color: '#ffb574' }}>
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ── Бегущие строки ── */}
          {/* Маска: плавное исчезновение по краям */}
          <div className="mb-3" style={{
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 7%, black 93%, transparent 100%)',
            maskImage: 'linear-gradient(90deg, transparent 0%, black 7%, black 93%, transparent 100%)',
          }}>
            {/* Строка 1 — едет влево */}
            <div style={{ display: 'flex', width: 'max-content', animation: 'vv-mq-l 55s linear infinite' }}>
              {[...ROW1, ...ROW1].map((l, i) => (
                <span key={`r1-${i}`}
                  className="inline-flex items-center gap-2 mx-1.5 px-4 py-2.5 rounded-full text-sm font-500 whitespace-nowrap shrink-0"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.82)' }}>
                  <LangFlag country={l.country} w={20} />
                  <span>{l.name}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="mb-12" style={{
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 7%, black 93%, transparent 100%)',
            maskImage: 'linear-gradient(90deg, transparent 0%, black 7%, black 93%, transparent 100%)',
          }}>
            {/* Строка 2 — едет вправо */}
            <div style={{ display: 'flex', width: 'max-content', animation: 'vv-mq-r 48s linear infinite' }}>
              {[...ROW2, ...ROW2].map((l, i) => (
                <span key={`r2-${i}`}
                  className="inline-flex items-center gap-2 mx-1.5 px-4 py-2.5 rounded-full text-sm font-500 whitespace-nowrap shrink-0"
                  style={{ background: 'rgba(255,115,0,0.07)', border: '1px solid rgba(255,115,0,0.22)', color: 'rgba(255,255,255,0.82)' }}>
                  <LangFlag country={l.country} w={20} />
                  <span>{l.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* ── Полная таблица 107 языков с поиском ── */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <LanguageGrid />
          </div>
        </section>

        {/* ===== ЧЕСТНЫЙ БИЛЛИНГ ===== */}
        <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <motion.div {...fadeUp} className="rounded-[2rem] p-8 sm:p-12"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <SectionLabel n="03">Честный биллинг</SectionLabel>
                <h2 className="font-display font-800 text-3xl sm:text-4xl tracking-[-0.02em] mb-4">Минуты не сгорают</h2>
                <p className="text-white/55 mb-6 leading-relaxed">
                  У классических SaaS неиспользованные минуты сгорают каждый месяц. VibeVox бережно переносит
                  их на следующий — вы не теряете ни секунды оплаченного времени.
                </p>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="font-display font-800 text-5xl" style={{ color: '#ff7300' }}>€0.17</span>
                  <span className="text-white/45">/ минута</span>
                </div>
                <a href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-700 text-white transition-all hover:brightness-110"
                   style={{ background: '#ff7300', boxShadow: '0 10px 32px rgba(255,115,0,0.35)' }}>
                  Купить пакет минут <ArrowRight size={18} />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center gap-2 font-700 mb-3 text-white/60"><X size={18} className="text-magenta-400" /> Конкуренты</div>
                  <ul className="space-y-2 text-sm text-white/45">
                    <li className="flex gap-2"><X size={15} className="text-magenta-400 shrink-0 mt-0.5" /> Минуты сгорают в конце месяца</li>
                    <li className="flex gap-2"><X size={15} className="text-magenta-400 shrink-0 mt-0.5" /> Годовые контракты на тысячи $</li>
                    <li className="flex gap-2"><X size={15} className="text-magenta-400 shrink-0 mt-0.5" /> До $1.20–2.50 за минуту</li>
                  </ul>
                </div>
                <div className="rounded-2xl p-5" style={{ background: 'rgba(255,115,0,0.07)', border: '1px solid rgba(255,115,0,0.3)' }}>
                  <div className="flex items-center gap-2 font-700 mb-3" style={{ color: '#ff8a2b' }}><RefreshCw size={18} /> VibeVox</div>
                  <ul className="space-y-2 text-sm text-white/75">
                    <li className="flex gap-2"><Check size={15} className="shrink-0 mt-0.5" style={{ color: '#ff8a2b' }} /> Перенос минут (roll-over)</li>
                    <li className="flex gap-2"><Check size={15} className="shrink-0 mt-0.5" style={{ color: '#ff8a2b' }} /> Оплата по факту, без контрактов</li>
                    <li className="flex gap-2"><Check size={15} className="shrink-0 mt-0.5" style={{ color: '#ff8a2b' }} /> €0.17 за минуту</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ===== СРАВНЕНИЕ ===== */}
        <section id="compare" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <motion.div {...fadeUp} className="mb-12">
            <SectionLabel n="04">Сравнение</SectionLabel>
            <h2 className="font-display font-800 text-3xl sm:text-5xl tracking-[-0.02em] max-w-2xl">
              Дешевле и быстрее новой волны
            </h2>
          </motion.div>

          <div className="space-y-3">
            {COMPARE.map((c, i) => (
              <motion.div key={c.name} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.07 }}
                className="rounded-2xl p-5 grid md:grid-cols-[160px_1fr_1fr] gap-4 items-center"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="font-700 text-white/85">{c.name}</div>
                <div className="flex items-start gap-2 text-sm text-white/45">
                  <X size={16} className="text-magenta-400 shrink-0 mt-0.5" /> {c.them}
                </div>
                <div className="flex items-start gap-2 text-sm text-white/80">
                  <Check size={16} className="shrink-0 mt-0.5" style={{ color: '#ff8a2b' }} /> {c.us}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ===== ФИНАЛЬНЫЙ CTA ===== */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <motion.div {...fadeUp} className="rounded-[2rem] p-10 sm:p-16 text-center relative overflow-hidden"
            style={{ background: 'rgba(255,115,0,0.07)', border: '1px solid rgba(255,115,0,0.28)' }}>
            <div className="absolute inset-0 blur-[110px] opacity-50" aria-hidden="true"
                 style={{ background: 'radial-gradient(ellipse at center, rgba(255,115,0,0.3), transparent 70%)' }} />
            <div className="relative">
              <h2 className="font-display font-800 text-3xl sm:text-5xl tracking-[-0.02em] mb-4">
                Говорите на одном языке со всем миром
              </h2>
              <p className="text-white/60 max-w-xl mx-auto mb-8 text-lg">
                Запуск комнаты за 1 клик. Без регистрации для демо.
              </p>
              <a href="/" className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-700 text-white transition-all hover:brightness-110"
                 style={{ background: '#ff7300', boxShadow: '0 12px 44px rgba(255,115,0,0.45)' }}>
                Создать демо-комнату <ArrowRight size={20} />
              </a>
            </div>
          </motion.div>
        </section>

        <PublicFooter />
      </div>
    </div>
  );
}

export default LandingPage;
