/**
 * BillingPage — тарифы TrendTraffic.
 *
 * Позиционирование: простой сервис, который автоматизирует создание видеоконтента
 * и сводит оплату ИИ к минимуму. Вы платите за оболочку (Premium €49/мес, Stripe),
 * а тяжёлая генерация идёт через Хром-расширение по ВАШИМ подпискам Google Flow,
 * NotebookLM и HeyGen — по цене подписки, а не API (альтернатива — свои API-ключи).
 *
 * Два тарифа:
 *   • Premium (€49/мес, Stripe) — полный самостоятельный доступ ко ВСЕМ функциям.
 *   • Enterprise (по запросу) — то же + индивидуальная настройка и массовое ведение
 *     соцсетей «под ключ» через наш API.
 *
 * На странице: сравнительная таблица «секунда через API vs по подписке» и
 * интерактивный калькулятор экономии (ползунки: длительность × количество).
 * Сохранены: промокоды, Stripe Checkout (триал 7 дней с обязательной картой),
 * управление подпиской (отмена/возобновление) в карточке «Ваш тариф».
 * Тексты — через t('sec.billing.*') с русским фолбэком (EN — базовый язык локалей).
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  Check, ArrowRight, Crown, Sparkles, TrendingUp, BarChart3, Image as ImageIcon,
  Workflow, Send, KeyRound, MessageSquare, Tags, Loader2, X, Ban, RotateCcw,
  Calendar, Settings, Headphones, Gauge, Layers, Plug, Target, Chrome, Bot,
  Wallet, PiggyBank, Zap, Clapperboard, Puzzle, Film,
} from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { Constellation } from './public/landing/Constellation';
import { AuroraButton } from '../components/AuroraButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { ClaudeLogo } from '../components/ClaudeLogo';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../components/Toast';

// ─────────────────────────────────────────────
// Данные тарифов (списки фич собираются внутри компонентов — тексты через t())
// ─────────────────────────────────────────────
interface PlanFeature { icon: React.ReactNode; text: string; strong?: boolean }

// Список провайдеров для блока «свои API-ключи» (альтернативный путь генерации).
const GEN_PROVIDERS = 'Google Veo / Omni · FAL / Kling · Runway · OpenAI · ElevenLabs · HeyGen · Anthropic Claude';

const WHATSAPP_NUMBER = '380637610482';

// ─────────────────────────────────────────────
// Экономика: API vs подписки через расширение
// (официальные прайсы провайдеров, июль 2026)
// ─────────────────────────────────────────────
const FX_USD_PER_EUR = 1.08;                 // ≈ курс $ за €1 — для перевода долларовых прайсов
const usdToEur = (v: number) => v / FX_USD_PER_EUR;

// $/сек генерации через API (Gemini API: Veo 3.1; HeyGen API: pay-as-you-go)
const API_EUR_PER_SEC = {
  heygenIV: usdToEur(0.05),    // Avatar IV (фото-аватар) — $3/мин
  veoFast: usdToEur(0.10),     // Veo 3.1 Fast, 720p
  veoQuality: usdToEur(0.40),  // Veo 3.1 Quality
};

interface SubPlan { name: string; eur: number; capSec: number }

// Ёмкость подписок в СЕКУНДАХ готового видео в месяц (при полном использовании кредитов).
// HeyGen: Avatar IV = 20 кредитов/мин → Creator 600 кр = 30 мин.
const HEYGEN_PLANS: SubPlan[] = [
  { name: 'HeyGen Creator', eur: usdToEur(29), capSec: 1800 },
  { name: 'HeyGen Pro', eur: usdToEur(49), capSec: 3000 },
  { name: 'HeyGen Business', eur: usdToEur(149), capSec: 4500 },
];
// Google Flow: Veo Fast 8с = 20 кр (10 кр на Ultra); Quality 8с = 100 кр.
const VEO_PLANS_FAST: SubPlan[] = [
  { name: 'Google AI Pro', eur: 21.99, capSec: 400 },
  { name: 'Google AI Ultra 5×', eur: 99.99, capSec: 8000 },
  { name: 'Google AI Ultra 20×', eur: 219.99, capSec: 20000 },
];
const VEO_PLANS_QUALITY: SubPlan[] = [
  { name: 'Google AI Pro', eur: 21.99, capSec: 80 },
  { name: 'Google AI Ultra 5×', eur: 99.99, capSec: 800 },
  { name: 'Google AI Ultra 20×', eur: 219.99, capSec: 2000 },
];

/** Самая дешёвая подписка (или ×N подписок), покрывающая нужные секунды. */
function cheapestPlan(plans: SubPlan[], seconds: number): { cost: number; label: string | null } {
  if (seconds <= 0) return { cost: 0, label: null };
  let best: { cost: number; label: string } | null = null;
  for (const p of plans) {
    const n = Math.ceil(seconds / p.capSec);
    const cost = n * p.eur;
    if (!best || cost < best.cost) best = { cost, label: n > 1 ? `${p.name} ×${n}` : p.name };
  }
  return best!;
}

const fmtEur = (v: number) =>
  v >= 100 ? `€${Math.round(v).toLocaleString('ru-RU')}` : `€${v.toFixed(2)}`;

// ─────────────────────────────────────────────
// Калькулятор экономии (ползунки)
// ─────────────────────────────────────────────
type VideoKind = 'avatar' | 'veo' | 'mix';
type VeoQuality = 'fast' | 'quality';

function SavingsCalculator() {
  const { t } = useTranslation('common');
  const [durationSec, setDurationSec] = useState(60);
  const [countPerMonth, setCountPerMonth] = useState(30);
  const [kind, setKind] = useState<VideoKind>('avatar');
  const [veoQuality, setVeoQuality] = useState<VeoQuality>('fast');

  const calc = useMemo(() => {
    const totalSec = durationSec * countPerMonth;
    const avatarSec = kind === 'avatar' ? totalSec : kind === 'mix' ? totalSec / 2 : 0;
    const veoSec = kind === 'veo' ? totalSec : kind === 'mix' ? totalSec / 2 : 0;

    const veoApiRate = veoQuality === 'quality' ? API_EUR_PER_SEC.veoQuality : API_EUR_PER_SEC.veoFast;
    const apiCost = avatarSec * API_EUR_PER_SEC.heygenIV + veoSec * veoApiRate;

    const heygenSub = cheapestPlan(HEYGEN_PLANS, avatarSec);
    const veoSub = cheapestPlan(veoQuality === 'quality' ? VEO_PLANS_QUALITY : VEO_PLANS_FAST, veoSec);
    const subCost = heygenSub.cost + veoSub.cost;
    const subLabels = [heygenSub.label, veoSub.label].filter(Boolean) as string[];

    const savings = apiCost - subCost;                  // €49 за оболочку одинакова в обоих путях
    const apiTotal = 49 + apiCost;
    const subTotal = 49 + subCost;
    const pct = apiTotal > 0 ? Math.round((savings / apiTotal) * 100) : 0;
    return { totalSec, apiCost, subCost, subLabels, savings, apiTotal, subTotal, pct };
  }, [durationSec, countPerMonth, kind, veoQuality]);

  const maxBar = Math.max(calc.apiTotal, calc.subTotal, 1);
  const showVeoQuality = kind !== 'avatar';

  const segBtn = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(99,102,241,0.16)' : 'var(--bg-tertiary)',
    border: `1px solid ${active ? 'rgba(99,102,241,0.55)' : 'var(--border-medium)'}`,
    color: active ? 'var(--brand)' : 'var(--text-muted)',
  });

  return (
    <AuroraCard className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <PiggyBank size={16} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
        <h3 className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
          {t('sec.billing.calc49Title', 'Калькулятор экономии: сколько вы сохраняете на подписках вместо API')}
        </h3>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        {t('sec.billing.calc49Sub', 'Задайте длительность ролика и сколько роликов в месяц вы делаете — и двигайте ползунки.')}
      </p>

      {/* Тип контента */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {([
          ['avatar', t('sec.billing.calc49KindAvatar', 'Аватар-ролики (HeyGen)')],
          ['veo', t('sec.billing.calc49KindVeo', 'Генерация видео (Veo)')],
          ['mix', t('sec.billing.calc49KindMix', 'Микс 50/50')],
        ] as [VideoKind, string][]).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className="text-[11px] font-600 px-2.5 py-1.5 rounded-xl transition-all" style={segBtn(kind === k)}>
            {label}
          </button>
        ))}
        {showVeoQuality && (
          <div className="flex gap-1.5 ml-auto">
            {([['fast', 'Veo Fast'], ['quality', 'Veo Quality']] as [VeoQuality, string][]).map(([q, label]) => (
              <button key={q} type="button" onClick={() => setVeoQuality(q)}
                className="text-[11px] font-600 px-2.5 py-1.5 rounded-xl transition-all" style={segBtn(veoQuality === q)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ползунки */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-600" style={{ color: 'var(--text-secondary)' }}>{t('sec.billing.calc49Duration', 'Длительность ролика')}</span>
            <span className="text-sm font-700 tabular-nums" style={{ color: 'var(--text-primary)' }}>{t('sec.billing.calc49Sec', '{{n}} сек', { n: durationSec })}</span>
          </div>
          <input type="range" min={15} max={180} step={5} value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value))}
            className="w-full" style={{ accentColor: 'var(--brand)' }} />
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-600" style={{ color: 'var(--text-secondary)' }}>{t('sec.billing.calc49Count', 'Роликов в месяц')}</span>
            <span className="text-sm font-700 tabular-nums" style={{ color: 'var(--text-primary)' }}>{countPerMonth}</span>
          </div>
          <input type="range" min={1} max={100} step={1} value={countPerMonth}
            onChange={(e) => setCountPerMonth(Number(e.target.value))}
            className="w-full" style={{ accentColor: 'var(--brand)' }} />
        </div>
      </div>

      {/* Итоги: два бара */}
      <div className="space-y-2.5 mb-4">
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-600" style={{ color: 'var(--text-secondary)' }}>
              {t('sec.billing.calc49ApiLabel', 'Через API')}{' '}
              <span style={{ color: 'var(--text-muted)' }}>{t('sec.billing.calc49ApiNote', '(€49 сервис + оплата API)')}</span>
            </span>
            <span className="text-sm font-700 tabular-nums" style={{ color: '#f87171' }}>{t('sec.billing.calc49PerMonth', '{{eur}}/мес', { eur: fmtEur(calc.apiTotal) })}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="h-full rounded-full" style={{ width: `${(calc.apiTotal / maxBar) * 100}%`, background: 'linear-gradient(90deg,#ef4444,#f87171)' }} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-xs font-600" style={{ color: 'var(--text-secondary)' }}>
              {t('sec.billing.calc49SubLabel', 'По подпискам через расширение')}{' '}
              {calc.subLabels.length > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>
                  {t('sec.billing.calc49SubNote', '(€49 сервис + {{plans}})', { plans: calc.subLabels.join(' + ') })}
                </span>
              )}
            </span>
            <span className="text-sm font-700 tabular-nums" style={{ color: '#34d399' }}>{t('sec.billing.calc49PerMonth', '{{eur}}/мес', { eur: fmtEur(calc.subTotal) })}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="h-full rounded-full" style={{ width: `${(calc.subTotal / maxBar) * 100}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
          </div>
        </div>
      </div>

      {/* Экономия */}
      {calc.savings > 0.5 ? (
        <div className="rounded-2xl p-4 flex items-center gap-3 flex-wrap"
             style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)' }}>
          <PiggyBank size={22} strokeWidth={1.5} style={{ color: '#10b981', flexShrink: 0 }} />
          <div>
            <p className="text-lg font-800" style={{ color: '#10b981', fontFamily: 'Geist Sans, sans-serif' }}>
              {t('sec.billing.calc49Savings', 'Экономия ≈ {{eur}} в месяц', { eur: fmtEur(calc.savings) })}{' '}
              <span className="text-sm font-700">{t('sec.billing.calc49SavingsPct', '(−{{pct}}% расходов)', { pct: calc.pct })}</span>
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {t('sec.billing.calc49Volume', '{{min}} мин контента/мес: {{api}} по ценам API против {{sub}} по подпискам.',
                { min: Math.round(calc.totalSec / 60), api: fmtEur(calc.apiCost), sub: fmtEur(calc.subCost) })}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-4 flex items-start gap-3"
             style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <Zap size={18} strokeWidth={1.5} style={{ color: '#FBBF24', flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('sec.billing.calc49ApiCheaper', 'При таком объёме дешевле работать напрямую через API — TrendTraffic поддерживает и этот путь (свои ключи в настройках). Подписки начинают выигрывать с ростом объёма — подвиньте ползунки.')}
          </p>
        </div>
      )}

      <p className="text-[10px] leading-relaxed mt-3" style={{ color: 'var(--text-muted)' }}>
        {t('sec.billing.calc49Footnote', 'Официальные прайсы провайдеров, июль 2026; $ переведены в € по курсу ≈1.08 $/€. Цена секунды по подписке — при полном использовании месячных кредитов (кредиты Flow не переносятся на следующий месяц). Калькулятор — оценка, не оферта: тарифы провайдеров могут меняться.')}
      </p>
    </AuroraCard>
  );
}

// ─────────────────────────────────────────────
// Сравнительная таблица «секунда через API vs по подписке»
// ─────────────────────────────────────────────
function PriceComparisonTable() {
  const { t } = useTranslation('common');
  const rows: { engine: string; api: string; sub: string; gain: string }[] = [
    {
      engine: 'Google Flow · Veo 3.1 Fast',
      api: t('sec.billing.cmp49R1Api', '$0.10/сек'),
      sub: t('sec.billing.cmp49R1Sub', '$0.01–0.05/сек (Ultra…Pro)'),
      gain: t('sec.billing.cmp49R1Gain', 'до 10×'),
    },
    {
      engine: 'Google Flow · Veo 3.1 Quality',
      api: t('sec.billing.cmp49R2Api', '$0.40/сек'),
      sub: t('sec.billing.cmp49R2Sub', '$0.10–0.25/сек'),
      gain: t('sec.billing.cmp49R2Gain', 'до 4×'),
    },
    {
      engine: t('sec.billing.cmp49R3Engine', 'HeyGen · фото-аватар (Avatar IV)'),
      api: t('sec.billing.cmp49R3Api', '$0.05/сек · $3/мин'),
      sub: t('sec.billing.cmp49R3Sub', '≈$0.013–0.016/сек · ≈$1/мин (Creator)'),
      gain: t('sec.billing.cmp49R3Gain', '≈3×'),
    },
    {
      engine: 'HeyGen · Avatar III',
      api: t('sec.billing.cmp49R4Api', '$0.017/сек · $1/мин'),
      sub: t('sec.billing.cmp49R4Sub', '≈$0.0024/сек (Creator)'),
      gain: t('sec.billing.cmp49R4Gain', '≈7×'),
    },
    {
      engine: t('sec.billing.cmp49R5Engine', 'NotebookLM · подкасты и видеообзоры'),
      api: t('sec.billing.cmp49R5Api', 'публичного API нет'),
      sub: t('sec.billing.cmp49R5Sub', 'входит в Google AI Pro: до 20 аудио- и 20 видеообзоров в день'),
      gain: t('sec.billing.cmp49R5Gain', 'только по подписке'),
    },
  ];
  return (
    <AuroraCard className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={16} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
        <h3 className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
          {t('sec.billing.cmp49Title', 'Сколько стоит секунда видео: API против подписки через расширение')}
        </h3>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        {t('sec.billing.cmp49Sub', 'Одни и те же ИИ-движки. Разница только в том, КАК вы за них платите.')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th className="text-left font-600 py-2 pr-3" style={{ borderBottom: '1px solid var(--border-medium)' }}>{t('sec.billing.cmp49ColEngine', 'ИИ-движок')}</th>
              <th className="text-left font-600 py-2 pr-3" style={{ borderBottom: '1px solid var(--border-medium)' }}>{t('sec.billing.cmp49ColApi', 'Через API')}</th>
              <th className="text-left font-600 py-2 pr-3" style={{ borderBottom: '1px solid var(--border-medium)' }}>{t('sec.billing.cmp49ColSub', 'По подписке через расширение')}</th>
              <th className="text-left font-600 py-2" style={{ borderBottom: '1px solid var(--border-medium)' }}>{t('sec.billing.cmp49ColGain', 'Выгода')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.engine}>
                <td className="py-2.5 pr-3 font-600" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>{r.engine}</td>
                <td className="py-2.5 pr-3" style={{ color: '#f87171', borderBottom: '1px solid var(--border-subtle)' }}>{r.api}</td>
                <td className="py-2.5 pr-3" style={{ color: '#34d399', borderBottom: '1px solid var(--border-subtle)' }}>{r.sub}</td>
                <td className="py-2.5 font-700" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>{r.gain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] leading-relaxed mt-3" style={{ color: 'var(--text-muted)' }}>
        {t('sec.billing.cmp49Footnote', 'Официальные прайсы, июль 2026: Gemini API (Veo 3.1, 720p, с аудио), прайс HeyGen API pay-as-you-go, подписки Google AI Pro/Ultra и HeyGen Creator. Секунда по подписке — при полном использовании месячных кредитов плана.')}
      </p>
    </AuroraCard>
  );
}

// ─────────────────────────────────────────────
// Полный перечень возможностей (6 групп)
// ─────────────────────────────────────────────
function FeatureGroupsSection() {
  const { t } = useTranslation('common');
  const groups: { icon: React.ReactNode; title: string; items: string[] }[] = [
    {
      icon: <TrendingUp size={16} strokeWidth={1.5} />,
      title: t('sec.billing.fg49G1T', 'Тренды — поиск вирусного контента'),
      items: [
        t('sec.billing.fg49G1I1', 'Поиск по TikTok, Instagram, YouTube, X — по ключевику и лента «Горячее»'),
        t('sec.billing.fg49G1I2', 'Регион выдачи: ~35 стран (гео-таргет TikTok и YouTube)'),
        t('sec.billing.fg49G1I3', 'Фильтры: формат (видео/Shorts), период, длительность, сортировка'),
        t('sec.billing.fg49G1I4', '«По ссылке»: любой ролик TikTok/Instagram/YouTube — разбор и скачивание'),
        t('sec.billing.fg49G1I5', '«Каналы»: ссылка на канал → все его видео + вотчлист с историей метрик и приростами'),
        t('sec.billing.fg49G1I6', 'Скачивание находок в Галерею без водяного знака'),
      ],
    },
    {
      icon: <Target size={16} strokeWidth={1.5} />,
      title: t('sec.billing.fg49G2T', 'Таргет на целевую аудиторию'),
      items: [
        t('sec.billing.fg49G2I1', 'ИИ раскладывает ваш продукт и ЦА на дерево узких микро-ниш'),
        t('sec.billing.fg49G2I2', 'Ключевики заземляются РЕАЛЬНЫМИ подсказками поиска TikTok/YouTube'),
        t('sec.billing.fg49G2I3', 'Один клик: построить ниши → просканировать → ранжировать по спросу (#1/#2/#3)'),
        t('sec.billing.fg49G2I4', 'Кнопка «Подсказать»: ИИ сам заполняет ЦА и ключевики по описанию продукта'),
        t('sec.billing.fg49G2I5', 'Ключевики сразу на 29 языках (мультиселект)'),
        t('sec.billing.fg49G2I6', 'Кнопка «В TrendFlow» — из ниши сразу в сценарий ролика'),
      ],
    },
    {
      icon: <BarChart3 size={16} strokeWidth={1.5} />,
      title: t('sec.billing.fg49G3T', 'Аналитика — функции разбора'),
      items: [
        t('sec.billing.fg49G3I1', 'Разбор по ссылке: TikTok, Instagram, X, Douyin, Bilibili, Reddit'),
        t('sec.billing.fg49G3I2', 'Метрики: просмотры, лайки, комментарии, репосты, подписчики, ER (вовлечённость)'),
        t('sec.billing.fg49G3I3', 'ИИ-тональность комментариев: позитив/негатив, темы, топ-комментарии'),
        t('sec.billing.fg49G3I4', 'TrendDNA: тип хука, почему завирусилось, вирус-факторы, готовый copy-ready сценарий, «как адаптировать»'),
        t('sec.billing.fg49G3I5', 'Покадровый ИИ-разбор видео: сцены с таймкодами, хук первых 3 секунд, надписи в кадре, склейки'),
        t('sec.billing.fg49G3I6', 'Дословный транскрипт на языке оригинала → субтитры .srt'),
        t('sec.billing.fg49G3I7', 'Пакет анализа в Галерею: видео + разбор .md + субтитры .srt'),
        t('sec.billing.fg49G3I8', 'Массовый анализ пачки ссылок + экспорт HTML-отчёта, перевод разбора'),
      ],
    },
    {
      icon: <Clapperboard size={16} strokeWidth={1.5} />,
      title: t('sec.billing.fg49G4T', 'UGC-студия — режимы и форматы'),
      items: [
        t('sec.billing.fg49G4I1', '4 режима ролика: «Один ведущий» · «Динамичный монтаж» · «Диалог двоих» · «Озвучка без аватара»'),
        t('sec.billing.fg49G4I2', 'Форматы 9:16, 16:9, 1:1, 4:5 — несколько сразу за один рендер'),
        t('sec.billing.fg49G4I3', 'Аватары: ваше фото (HeyGen Avatar IV), готовые луки/Personal Model, ИИ-генерация аватаров'),
        t('sec.billing.fg49G4I4', 'Все голоса вашего ElevenLabs (включая клоны) + серия ролика сразу на 29 языках'),
        t('sec.billing.fg49G4I5', 'Субтитры: по словам / караоке / строкой; стиль настраивается «пожеланиями» простым текстом'),
        t('sec.billing.fg49G4I6', 'Врезки медиа к репликам, «аватар поверх», ИИ-вырезка фона, бренд-киты, музыка и заставки'),
        t('sec.billing.fg49G4I7', '«Режиссура по анализу»: ДНК тренда управляет монтажом — хук, пики, ритм оригинала'),
        t('sec.billing.fg49G4I8', 'Ролики и шаблоны — карточками в Галерее, продолжение сценария в один клик'),
      ],
    },
    {
      icon: <Chrome size={16} strokeWidth={1.5} />,
      title: t('sec.billing.fg49G5T', 'Хром-расширение — ИИ по подписке'),
      items: [
        t('sec.billing.fg49G5I1', 'Одно расширение на три сервиса: Google Flow · NotebookLM · HeyGen — работает в вашем браузере с вашими аккаунтами'),
        t('sec.billing.fg49G5I2', 'Google Flow: очередь промптов → готовые Veo-клипы сами падают в Галерею'),
        t('sec.billing.fg49G5I3', 'Обмен файлами «⬆ В галерею / ⬇ Из галереи» прямо на странице Flow'),
        t('sec.billing.fg49G5I4', 'NotebookLM: подкасты (аудиопересказы), видеообзоры, отчёты, тесты, таблицы, инфографика, карточки, ментальные карты, презентации'),
        t('sec.billing.fg49G5I5', 'Чип «9:16» — вертикальные видеообзоры для Shorts/TikTok'),
        t('sec.billing.fg49G5I6', 'HeyGen: рендер аватаров по вашей подписке вместо API-кредитов (≈в 3 раза дешевле)'),
        t('sec.billing.fg49G5I7', 'Индикаторы генерации и загрузка готовых работ в Галерею по клику'),
      ],
    },
    {
      icon: <Send size={16} strokeWidth={1.5} />,
      title: t('sec.billing.fg49G6T', 'Публикатор и автопилот'),
      items: [
        t('sec.billing.fg49G6I1', '9 соцсетей через ваш Blotato: TikTok, Instagram, YouTube, X, Facebook, LinkedIn, Threads, Bluesky, Pinterest'),
        t('sec.billing.fg49G6I2', 'Контент-план: слоты «Моё расписание» + календарь публикаций на 35 дней вперёд, перенос постов drag-ом'),
        t('sec.billing.fg49G6I3', 'Авто-цепочки по форматам: 9:16 → TikTok/Reels, 16:9 → YouTube — без конкуренции за файлы'),
        t('sec.billing.fg49G6I4', 'ИИ-подписи: A/B-варианты, хэштеги, заголовок YouTube — с учётом ДНК ролика'),
        t('sec.billing.fg49G6I5', 'Автопилот трендов: вотч ключевика → автоанализ нового видео → автосборка UGC по шаблону → публикация по слотам'),
        t('sec.billing.fg49G6I6', 'Статусы постов, история, авто-ретраи, аналитика опубликованного'),
      ],
    },
    {
      icon: <ClaudeLogo size={16} />,
      title: t('sec.billing.fg49G7T', 'MCP-коннектор — Claude управляет сервисом'),
      items: [
        t('sec.billing.fg49G7I1', 'Персональный MCP-ключ у каждой учётки — создаётся в Настройках в один клик, с готовыми сниппетами подключения'),
        t('sec.billing.fg49G7I2', 'Claude Desktop и Claude Code подключаются за минуту (Streamable HTTP + Bearer-ключ)'),
        t('sec.billing.fg49G7I3', 'Команды из чата: сканировать тренды по нише и региону, подсказать ЦА и ключевики, показать галерею и сценарии UGC'),
        t('sec.billing.fg49G7I4', 'Публикатор под контролем: слоты расписания, свободные времена, цепочки автопубликации'),
        t('sec.billing.fg49G7I5', 'Права по скоупам: «читающий» и «действующий» ключи можно разделить; ключ отзывается в один клик'),
        t('sec.billing.fg49G7I6', 'Работает и с другими MCP-клиентами: ChatGPT-коннекторы, n8n, свои агенты'),
      ],
    },
  ];
  return (
    <div className="space-y-3">
      <h2 className="section-title text-lg">{t('sec.billing.fg49Title', 'Что входит в подписку — полный перечень')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((g) => (
          <AuroraCard key={g.title} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(99,102,241,0.10)', color: 'var(--brand)' }}>
                {g.icon}
              </div>
              <h3 className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{g.title}</h3>
            </div>
            <ul className="space-y-1.5">
              {g.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check size={12} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--brand)' }} />
                  <span className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{it}</span>
                </li>
              ))}
            </ul>
          </AuroraCard>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════
export function BillingPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { subscriptionTier, subscriptionTierName, token, refreshBilling } = useAppStore();

  // ── Ambient-частицы лендинга (подложка). Только тёмная тема: палитра
  // Constellation (кость/индиго/янтарь) рассчитана на чёрный фон.
  const fxContentRef = useRef<HTMLDivElement>(null);
  const fxPosRef = useRef(0);
  const fxTotalRef = useRef(0);
  const [fxDark, setFxDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const html = document.documentElement;
    const mo = new MutationObserver(() => setFxDark(html.classList.contains('dark')));
    mo.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  // Скролл и полный пробег — через rect контента: /billing скроллится window-ом
  // (публичная обвязка) ЛИБО внутренним #main-scroll (лейаут с сайдбаром) —
  // capture-слушатель ловит оба, rect не зависит от того, кто скроллит.
  useEffect(() => {
    if (!fxDark) return;
    const el = fxContentRef.current;
    if (!el) return;
    let baseTop: number | null = null;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (baseTop === null) baseTop = r.top;
      fxPosRef.current = Math.max(0, baseTop - r.top);
      fxTotalRef.current = Math.max(r.height - window.innerHeight, 1);
    };
    update();
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [fxDark]);
  // v2.3.8: /billing публичный — аноним видит витрину тарифов; оплату начинаем с регистрации.
  const isAnon = !token;
  // null = простой; 'paid' = оформляет сразу; 'trial' = оформляет 7-дневный триал.
  const [checkoutMode, setCheckoutMode] = useState<null | 'paid' | 'trial'>(null);
  const checkoutLoading = checkoutMode !== null;

  const PREMIUM_FEATURES: PlanFeature[] = [
    { icon: <Chrome size={14} />, text: t('sec.billing.pf49Ext', 'Хром-расширение: Google Flow (Veo), NotebookLM, HeyGen работают по ВАШИМ подпискам — генерация в разы дешевле API'), strong: true },
    { icon: <TrendingUp size={14} />, text: t('sec.billing.pf49Trends', 'Тренды: поиск по TikTok, Instagram, YouTube, X + лента «Горячее», регион выдачи (~35 стран)') },
    { icon: <Target size={14} />, text: t('sec.billing.pf49Audience', '«Таргет на ЦА»: ИИ строит микро-ниши, проверяет их реальными запросами и ранжирует по спросу') },
    { icon: <BarChart3 size={14} />, text: t('sec.billing.pf49Analytics', 'Аналитика: метрики и ER, тональность комментариев, TrendDNA-разбор, покадровый ИИ-анализ, транскрипт + .srt') },
    { icon: <Clapperboard size={14} />, text: t('sec.billing.pf49Ugc', 'UGC-студия: 4 режима ролика, форматы 9:16 · 16:9 · 1:1 · 4:5, аватары из вашего фото, серия сразу на 29 языках') },
    { icon: <Film size={14} />, text: t('sec.billing.pf49Storyboard', 'Сториборд: рилс из одного дубля — ИИ-раскадровка до 6 панелей на кусок, 3 движка рендера (в т.ч. бесплатный), субтитры, бейдж канала и CTA-слово') },
    { icon: <Send size={14} />, text: t('sec.billing.pf49Publisher', 'Публикатор: 9 соцсетей через ваш Blotato, слоты и календарь на 35 дней, ИИ-подписи с хэштегами') },
    { icon: <Bot size={14} />, text: t('sec.billing.pf49Autopilot', 'Автопилот: тренд → автоанализ → автосборка UGC → публикация по расписанию, без вашего участия') },
    { icon: <ImageIcon size={14} />, text: t('sec.billing.pf49Gallery', 'Галерея-хаб + скачивание видео без водяного знака (TikTok, Instagram, X)') },
    { icon: <Plug size={14} />, text: t('sec.billing.pf49Byo', 'Альтернатива подпискам — свои API-ключи: Veo, FAL/Kling, Runway, OpenAI, ElevenLabs, HeyGen, Claude') },
    { icon: <ClaudeLogo size={14} />, text: t('sec.billing.pf49Mcp', 'MCP-коннектор для Claude: управляйте сервисом из чата ИИ — тренды, ЦА, галерея, публикатор; персональный ключ в Настройках') },
    { icon: <Tags size={14} />, text: t('sec.billing.pf49Promo', 'Промокоды и реферальная система') },
  ];

  const ENTERPRISE_FEATURES: PlanFeature[] = [
    { icon: <Check size={14} />, text: t('sec.billing.efAllPremium', 'Всё из тарифа Premium') },
    { icon: <Plug size={14} />, text: t('sec.billing.efByoApi', 'Подключение ваших API для генерации (платные и бесплатные)') },
    { icon: <Settings size={14} />, text: t('sec.billing.efCustom', 'Индивидуальная настройка сервиса под ваш бренд и задачи') },
    { icon: <Layers size={14} />, text: t('sec.billing.efManaged', 'Массовое ведение соцсетей «под ключ» через наш API — ведём аккаунты за вас') },
    { icon: <KeyRound size={14} />, text: t('sec.billing.efIntegrations', 'Индивидуальные интеграции и доработки под ваш пайплайн') },
    { icon: <Gauge size={14} />, text: t('sec.billing.efPriority', 'Приоритетная очередь генерации и рендера') },
    { icon: <Headphones size={14} />, text: t('sec.billing.efSupport', 'Выделенная поддержка и персональный менеджер') },
  ];

  // Текущий тариф для показа в карточке статуса.
  const tierDisplay = (() => {
    const raw = (subscriptionTierName || subscriptionTier || '').toLowerCase();
    if (raw === 'premium') return 'Premium';
    if (raw === 'enterprise') return 'Enterprise';
    if (raw === 'plus') return 'Plus';
    if (raw === 'standard') return 'Standard';
    if (raw === 'standard_yearly') return t('sec.billing.tierStandardYearly', 'Standard (год)');
    if (raw === 'trial' || raw === '') return t('sec.billing.tierInactive', 'Подписка не активна');
    return subscriptionTierName || subscriptionTier || t('sec.billing.tierInactive', 'Подписка не активна');
  })();

  // ── Управление подпиской (отмена/возобновление) ──
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message?: React.ReactNode; confirmLabel?: string; variant?: 'primary' | 'danger'; onConfirm: () => void;
  } | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null; hasActiveStripeSub: boolean;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/billing/me', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (data?.subscription) {
          setSubscriptionInfo({
            cancelAtPeriodEnd: !!data.subscription.cancelAtPeriodEnd,
            currentPeriodEnd: data.subscription.currentPeriodEnd || null,
            hasActiveStripeSub: !!data.subscription.hasActiveStripeSub,
          });
        } else setSubscriptionInfo(null);
      } catch { if (!cancelled) setSubscriptionInfo(null); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleCancelSubscription = () => {
    const periodEndStr = subscriptionInfo?.currentPeriodEnd
      ? new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()
      : t('sec.billing.periodEndFallback', 'конца оплаченного периода');
    setConfirmDialog({
      title: t('sec.billing.cancelTitle', 'Отключить автопродление подписки?'),
      message: (
        <ul className="list-disc pl-5 space-y-1">
          <li>{t('sec.billing.cancelLi1', 'Деньги за текущий период не возвращаются.')}</li>
          <li>{t('sec.billing.cancelLi2', 'Доступ сохранится до {{date}}.', { date: periodEndStr })}</li>
          <li>{t('sec.billing.cancelLi3', 'После этой даты подписка закроется автоматически.')}</li>
        </ul>
      ),
      confirmLabel: t('sec.billing.cancelConfirmBtn', 'Отключить'),
      variant: 'danger',
      onConfirm: async () => {
        setCancelBusy(true); setCancelMessage(null);
        try {
          const res = await fetch('/api/billing/cancel-subscription', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setCancelMessage({ kind: 'success', text: data.message || t('sec.billing.cancelOkFallback', 'Автопродление отключено.') });
          setSubscriptionInfo((s) => s ? { ...s, cancelAtPeriodEnd: true, currentPeriodEnd: data.currentPeriodEnd || s.currentPeriodEnd } : s);
          refreshBilling();
        } catch (e: any) {
          setCancelMessage({ kind: 'error', text: e.message || t('sec.billing.cancelErrFallback', 'Не удалось отключить автопродление.') });
        } finally { setCancelBusy(false); }
      },
    });
  };

  const handleResumeSubscription = () => {
    setConfirmDialog({
      title: t('sec.billing.resumeTitle', 'Возобновить автопродление?'),
      message: t('sec.billing.resumeMsg', 'Подписка снова будет продлеваться автоматически. Ближайшее списание — в конце текущего периода.'),
      confirmLabel: t('sec.billing.resumeBtn', 'Возобновить'),
      variant: 'primary',
      onConfirm: async () => {
        setCancelBusy(true); setCancelMessage(null);
        try {
          const res = await fetch('/api/billing/resume-subscription', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setCancelMessage({ kind: 'success', text: data.message || t('sec.billing.resumeOkFallback', 'Автопродление возобновлено.') });
          setSubscriptionInfo((s) => s ? { ...s, cancelAtPeriodEnd: false } : s);
          refreshBilling();
        } catch (e: any) {
          setCancelMessage({ kind: 'error', text: e.message || t('sec.billing.resumeErrFallback', 'Не удалось возобновить.') });
        } finally { setCancelBusy(false); }
      },
    });
  };

  // ── Промокод ──
  const [promoCode, setPromoCode] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    promotionCodeId: string; code: string; percentOff: number | null; amountOff: number | null;
    summary: string; appliesToTiers: string[] | null;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoApplying(true); setPromoError(null);
    try {
      const res = await fetch('/api/billing/promo-validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) { setPromoError(data.error || t('sec.billing.promoInvalid', 'Промокод недействителен.')); setAppliedPromo(null); return; }
      setAppliedPromo({
        promotionCodeId: data.promotionCodeId, code: data.code, percentOff: data.percentOff,
        amountOff: data.amountOff, summary: data.summary, appliesToTiers: data.appliesToTiers ?? null,
      });
    } catch (e: any) { setPromoError(e.message || t('sec.billing.netError', 'Ошибка сети.')); }
    finally { setPromoApplying(false); }
  };
  const removePromo = () => { setAppliedPromo(null); setPromoCode(''); setPromoError(null); };

  const promoAppliesToPremium = (): boolean => {
    if (!appliedPromo) return false;
    if (!appliedPromo.appliesToTiers || appliedPromo.appliesToTiers.length === 0) return true;
    return appliedPromo.appliesToTiers.includes('premium');
  };

  const PREMIUM_EUR = 49;
  const discounted = (() => {
    if (!appliedPromo || !promoAppliesToPremium()) return { final: PREMIUM_EUR, applied: false };
    if (appliedPromo.percentOff) return { final: PREMIUM_EUR * (1 - appliedPromo.percentOff / 100), applied: true };
    if (appliedPromo.amountOff) return { final: Math.max(0, PREMIUM_EUR - appliedPromo.amountOff / 100), applied: true };
    return { final: PREMIUM_EUR, applied: false };
  })();
  const fmtPrice = (eur: number) => Number.isInteger(eur) ? `€${eur}` : `€${eur.toFixed(2)}`;

  // ── Stripe Checkout (Premium) ──
  // trial=true → 7 дней бесплатно с обязательным подтверждением карты; списание €49 после.
  const handleCheckout = async (trial = false) => {
    // Аноним: сначала бесплатная регистрация — после входа неоплаченного
    // RequirePaid сам вернёт на /billing, и оплата продолжится в один клик.
    if (isAnon) { navigate('/auth/register'); return; }
    setCheckoutMode(trial ? 'trial' : 'paid');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ tier: 'premium', currency: 'eur', promotionCodeId: appliedPromo?.promotionCodeId, trial }),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else throw new Error(t('sec.billing.stripeNoUrl', 'Stripe не вернул ссылку на оплату.'));
    } catch (err: any) {
      showToast(t('sec.billing.checkoutFailToast', 'Не удалось открыть оплату: {{msg}}', { msg: err.message || String(err) }), 'error');
      setCheckoutMode(null);
    }
  };

  const handleContactEnterprise = () => {
    const msg = t('sec.billing.waEnterpriseMsg', 'Здравствуйте! Хочу узнать про тариф Enterprise в TrendTraffic (индивидуальная настройка и ведение соцсетей).');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  // ═══════════════════════════════════════════════
  return (
    <div className="animate-fade-in">
      {/* Подложка-частицы лендинга (ambient). Sticky-обёртка высотой в вьюпорт
          «прилипает» при скролле и window, и #main-scroll; transform делает её
          containing block-ом для position:fixed канваса (.ttl-fx) — частицы
          живут в колонке контента и не лезут под сайдбар приложения. */}
      {fxDark && (
        <div aria-hidden style={{
          position: 'sticky', top: 0, height: '100dvh', marginBottom: '-100dvh',
          zIndex: 0, pointerEvents: 'none', transform: 'translateZ(0)',
        }}>
          <Constellation started posRef={fxPosRef} ambient ambientTotalRef={fxTotalRef} />
        </div>
      )}
      <div ref={fxContentRef} className="space-y-8 pb-12" style={{ position: 'relative', zIndex: 1 }}>
      {/* SEO: /billing публичный — свой title/description по локали */}
      <Helmet defer={false}>
        <title>{t('sec.billing.seoTitle', 'Тариф Premium €49/мес — TrendTraffic')}</title>
        <meta name="description"
          content={t('sec.billing.seoDesc', 'Подписка TrendTraffic Premium за €49/мес: поиск вирусных трендов, аналитика соцсетей, UGC-студия с ИИ-аватарами и автопубликация. 7 дней бесплатно, отмена в один клик.')} />
      </Helmet>
      {/* Заголовок */}
      <div>
        <h1 className="section-title text-2xl mb-1">{t('sec.billing.pageTitle', 'Тарифы')}</h1>
        <p className="section-subtitle max-w-3xl">
          {t('sec.billing.hero49Sub', 'TrendTraffic — простой сервис, который автоматизирует создание видеоконтента и сводит оплату искусственного интеллекта к минимуму. Вы платите за оболочку — €49/мес, а тяжёлый ИИ (Google Flow, NotebookLM, HeyGen) работает через Хром-расширение по вашим подпискам: в разы дешевле, чем те же движки через API.')}
        </p>
      </div>

      {/* Текущий тариф + управление подпиской — только авторизованным (аноним видит витрину) */}
      {!isAnon && (
      <AuroraCard className="p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(99,102,241,0.10)', color: 'var(--brand)' }}>
              <Crown size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs uppercase font-600" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                {t('sec.billing.yourTier', 'Ваш тариф')}
              </p>
              <p className="text-2xl font-700" style={{ color: 'var(--text-primary)', fontFamily: 'Geist Sans, sans-serif' }}>
                {tierDisplay}
              </p>
              {subscriptionInfo?.currentPeriodEnd && !subscriptionInfo.cancelAtPeriodEnd && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('sec.billing.renewsOn', 'Продлевается {{date}}', { date: new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString() })}
                </p>
              )}
            </div>
          </div>
          {subscriptionInfo?.hasActiveStripeSub && !subscriptionInfo.cancelAtPeriodEnd && (
            <button type="button" onClick={handleCancelSubscription} disabled={cancelBusy}
              className="text-xs font-600 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
              style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
              {cancelBusy ? <Loader2 size={12} className="animate-spin inline mr-1" /> : <Ban size={12} strokeWidth={1.5} className="inline mr-1" />}
              {t('sec.billing.cancelAutoBtn', 'Отключить автопродление')}
            </button>
          )}
          {subscriptionInfo?.hasActiveStripeSub && subscriptionInfo.cancelAtPeriodEnd && (
            <button type="button" onClick={handleResumeSubscription} disabled={cancelBusy}
              className="text-xs font-600 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
              style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)', color: '#10b981' }}>
              {cancelBusy ? <Loader2 size={12} className="animate-spin inline mr-1" /> : <RotateCcw size={12} strokeWidth={1.5} className="inline mr-1" />}
              {t('sec.billing.resumeBtn', 'Возобновить')}
            </button>
          )}
        </div>
        {cancelMessage && (
          <div className="mt-4 rounded-2xl p-3 text-xs flex items-start gap-2"
               style={{ background: cancelMessage.kind === 'success' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        border: `1px solid ${cancelMessage.kind === 'success' ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}`,
                        color: cancelMessage.kind === 'success' ? '#10b981' : '#ef4444' }}>
            {cancelMessage.kind === 'success' ? <Check size={14} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" /> : <X size={14} className="flex-shrink-0 mt-0.5" />}
            <span className="leading-relaxed">{cancelMessage.text}</span>
            <button type="button" onClick={() => setCancelMessage(null)} className="ml-auto flex-shrink-0"><X size={12} /></button>
          </div>
        )}
        {subscriptionInfo?.cancelAtPeriodEnd && subscriptionInfo.currentPeriodEnd && (
          <div className="mt-4 rounded-2xl p-3.5 flex items-start gap-2.5"
               style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.22)' }}>
            <Calendar size={16} strokeWidth={1.5} style={{ color: '#FBBF24', marginTop: 1, flexShrink: 0 }} />
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <p className="font-700 mb-0.5" style={{ color: '#FBBF24' }}>
                {t('sec.billing.canceledUntil', 'Автопродление отключено · доступ до {{date}}', { date: new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString() })}
              </p>
              <p style={{ color: 'var(--text-muted)' }}>{t('sec.billing.canResumeHint', 'Можно возобновить в любой момент до этой даты.')}</p>
            </div>
          </div>
        )}
      </AuroraCard>
      )}

      {/* Промокод — только авторизованным (валидация требует аккаунт; скидка применяется при оплате) */}
      {!isAnon && (
      <AuroraCard className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Tags size={14} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-xs font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{t('sec.billing.promoTitle', 'Промокод')}</h3>
        </div>
        {appliedPromo ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
               style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.32)' }}>
            <Check size={14} strokeWidth={2.5} color="#10b981" />
            <span className="text-sm font-700" style={{ color: '#10b981' }}>{appliedPromo.code}</span>
            <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>· {appliedPromo.summary}</span>
            <button type="button" onClick={removePromo} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>{t('sec.billing.promoRemoveBtn', 'Убрать')}</button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="text" value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplyPromo(); }}
              placeholder={t('sec.billing.promoPh', 'ВАШ-ПРОМОКОД')}
              className="flex-1 px-3 py-2.5 rounded-xl text-sm font-600 outline-none focus:border-indigo-400"
              style={{ background: 'var(--bg-tertiary)', border: `1px solid ${promoError ? 'rgba(239,68,68,0.45)' : 'var(--border-medium)'}`,
                       color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }} />
            <button type="button" onClick={handleApplyPromo} disabled={promoApplying || !promoCode.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-700 transition-opacity disabled:opacity-50"
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--bg-primary)' }}>
              {promoApplying ? <Loader2 size={14} className="animate-spin inline" /> : t('sec.billing.promoApplyBtn', 'Применить')}
            </button>
          </div>
        )}
        {promoError && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{promoError}</p>}
        <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>{t('sec.billing.promoHint', 'Скидка применится к подписке Premium при оплате.')}</p>
      </AuroraCard>
      )}

      {/* Карточки тарифов */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Premium ── */}
        <div className="relative rounded-3xl p-6 flex flex-col"
             style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.06) 0%, var(--card-bg) 100%)',
                      border: '1.5px solid rgba(99,102,241,0.40)', boxShadow: '0 16px 48px rgba(99,102,241,0.10)' }}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-700 uppercase tracking-wider"
               style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', letterSpacing: '0.08em', boxShadow: '0 4px 14px rgba(99,102,241,0.40)' }}>
            {t('sec.billing.popularBadge', 'Популярный')}
          </div>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={20} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
              <h3 className="text-lg font-700" style={{ fontFamily: 'Geist Sans, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Premium</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {t('sec.billing.premiumDesc49', 'Оболочка-автопилот видеоконтента: полный доступ ко всем функциям. ИИ-генерация — по вашим подпискам через расширение или по вашим API-ключам.')}
            </p>
          </div>
          <div className="mb-5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl font-800" style={{ fontFamily: 'Geist Sans, sans-serif', color: discounted.applied ? '#10b981' : 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                {fmtPrice(discounted.applied ? discounted.final : PREMIUM_EUR)}
              </span>
              {discounted.applied && (
                <span className="text-base font-600 line-through" style={{ color: 'var(--text-disabled)', fontFamily: 'Geist Sans, sans-serif' }}>€{PREMIUM_EUR}</span>
              )}
              <span className="text-sm font-500" style={{ color: 'var(--text-muted)' }}>{t('sec.billing.perMonth', '/ мес')}</span>
            </div>
            {discounted.applied && appliedPromo && (
              <div className="text-[11px] mt-2 font-700 inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                   style={{ background: 'rgba(16,185,129,0.14)', color: '#34D399' }}>
                <Check size={10} strokeWidth={2.5} /> {t('sec.billing.promoChip', 'Промокод {{code}}', { code: appliedPromo.code })}
              </div>
            )}
          </div>
          <ul className="space-y-2 mb-6 flex-1">
            {PREMIUM_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: f.strong ? 'rgba(99,102,241,0.14)' : 'rgba(255,255,255,0.04)', color: f.strong ? 'var(--brand)' : 'var(--text-muted)' }}>
                  {f.icon}
                </div>
                <span className={`text-xs leading-relaxed ${f.strong ? 'font-600' : 'font-500'}`} style={{ color: f.strong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-2.5">
            {/* Главный CTA — 7 дней бесплатно (карта обязательна, без списания в триал) */}
            <AuroraButton fullWidth onClick={() => handleCheckout(true)} disabled={checkoutLoading}
              iconRight={checkoutMode === 'trial' ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={2} />}
              id="billing-cta-premium-trial">
              {checkoutMode === 'trial' ? t('sec.billing.openingStripe', 'Открываю Stripe…') : t('sec.billing.trialBtn', 'Попробовать 7 дней бесплатно')}
            </AuroraButton>
            {/* Вторичный — оформить сразу без пробного периода */}
            <button type="button" onClick={() => handleCheckout(false)} disabled={checkoutLoading}
              className="w-full text-xs font-700 py-2.5 rounded-xl transition-all disabled:opacity-50"
              style={{ background: 'transparent', border: '1px solid rgba(99,102,241,0.35)', color: 'var(--brand)' }}
              id="billing-cta-premium">
              {checkoutMode === 'paid'
                ? t('sec.billing.openingStripe', 'Открываю Stripe…')
                : t('sec.billing.buyNowBtn', 'Оформить сразу — {{price}}/мес', { price: fmtPrice(discounted.applied ? discounted.final : PREMIUM_EUR) })}
            </button>
            <p className="text-[11px] leading-relaxed text-center" style={{ color: 'var(--text-muted)' }}>
              {t('sec.billing.trialFootnote', 'При оформлении нужно подтвердить банковскую карту. Первые 7 дней — бесплатно, списаний нет. Затем автоматически {{price}}/мес. Отмена в любой момент до конца пробного периода.', { price: fmtPrice(discounted.applied ? discounted.final : PREMIUM_EUR) })}
            </p>
          </div>
        </div>

        {/* ── Enterprise ── */}
        <div className="relative rounded-3xl p-6 flex flex-col" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown size={20} strokeWidth={1.5} style={{ color: '#FBBF24' }} />
              <h3 className="text-lg font-700" style={{ fontFamily: 'Geist Sans, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Enterprise</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {t('sec.billing.enterpriseDesc', 'Всё из Premium + индивидуальная настройка и ведение соцсетей «под ключ».')}
            </p>
          </div>
          <div className="mb-5">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl font-800" style={{ fontFamily: 'Geist Sans, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{t('sec.billing.onRequest', 'По запросу')}</span>
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('sec.billing.onRequestHint', 'Индивидуальные условия под объём задач.')}</div>
          </div>
          <ul className="space-y-2 mb-6 flex-1">
            {ENTERPRISE_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: f.strong ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.04)', color: f.strong ? '#FBBF24' : 'var(--text-muted)' }}>
                  {f.icon}
                </div>
                <span className={`text-xs leading-relaxed ${f.strong ? 'font-600' : 'font-500'}`} style={{ color: f.strong ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
          <AuroraButton fullWidth variant="ghost" icon={<MessageSquare size={16} strokeWidth={1.5} />} onClick={handleContactEnterprise} id="billing-cta-enterprise">
            {t('sec.billing.contactWaBtn', 'Связаться (WhatsApp)')}
          </AuroraButton>
        </div>
      </div>

      {/* Как устроена экономия: оболочка + подписки через расширение (или свои API) */}
      <AuroraCard className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Puzzle size={16} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
          <h3 className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.billing.eco49Title', 'Как устроена экономия')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Workflow size={14} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
              <p className="text-xs font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.billing.eco49S1T', '1 · Оболочка — €49/мес')}</p>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('sec.billing.eco49S1B', 'Весь конвейер: тренды → таргет на ЦА → аналитика → сценарий → сборка ролика → публикация и контент-план. Плюс Галерея, автопилот и хранение результатов.')}
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.30)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Chrome size={14} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
              <p className="text-xs font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.billing.eco49S2T', '2 · Расширение + ваши подписки')}</p>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('sec.billing.eco49S2B', 'Хром-расширение подключает ваши подписки Google Flow (Veo), NotebookLM и HeyGen — генерация идёт по цене подписки, а не API: в 2–10 раз дешевле (таблица ниже). Достаточно Google AI Pro (€21.99) + HeyGen Creator ($29).')}
            </p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Plug size={14} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
              <p className="text-xs font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.billing.eco49S3T', '3 · Или свои API-ключи')}</p>
            </div>
            <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'var(--text-secondary)' }}>
              {t('sec.billing.eco49S3B', 'Классический путь для объёмов и автоматизации без браузера: подключите ключи — сервис генерирует ими напрямую. Оба пути можно совмещать.')}
            </p>
            <div className="flex flex-wrap gap-1">
              {GEN_PROVIDERS.split(' · ').map((p) => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-md font-600"
                      style={{ background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          {t('sec.billing.genApiBaseHint', 'Базовая обработка (монтаж, формат, субтитры, озвучка Piper, экспорт) работает без внешних ключей.')}
        </p>
      </AuroraCard>

      {/* Сравнительная таблица цен за секунду */}
      <PriceComparisonTable />

      {/* Калькулятор экономии */}
      <SavingsCalculator />

      {/* Полный перечень возможностей */}
      <FeatureGroupsSection />

      {/* FAQ */}
      <div className="space-y-3">
        <h2 className="section-title text-lg">{t('sec.billing.faqTitle', 'Частые вопросы')}</h2>
        {[
          { q: t('sec.billing.faq49Q1', 'Как работает пробный период 7 дней?'), a: t('sec.billing.faq49A1', 'При оформлении нужно подтвердить банковскую карту через Stripe — это обязательно, но в течение 7 дней деньги не списываются, а доступ полностью открыт. По окончании пробного периода автоматически спишется €49/мес. Если отменить подписку до конца 7 дней — списаний не будет вовсе.') },
          { q: t('sec.billing.faq49Q2', 'Что именно я оплачиваю за €49 в месяц?'), a: t('sec.billing.faq49A2', 'Оболочку-автопилот: поиск и аналитику трендов, таргет на ЦА, UGC-студию, Хром-расширение, Публикатор с контент-планом, автопилот и Галерею. Сама ИИ-генерация в стоимость не входит — она работает через ваши подписки (Google Flow, NotebookLM, HeyGen) или ваши API-ключи, и вы платите провайдерам напрямую по их ценам.') },
          { q: t('sec.billing.faq49Q3', 'Почему через подписки дешевле, чем через API?'), a: t('sec.billing.faq49A3', 'Провайдеры продают подписочные кредиты значительно дешевле, чем те же секунды по API: Veo по подписке Google AI — в 2–10 раз дешевле, аватары HeyGen — примерно в 3 раза. А NotebookLM по публичному API вообще недоступен — только по подписке. Расширение автоматизирует работу в ваших аккаунтах, и вы получаете API-удобство по подписочной цене. Точные цифры — в таблице и калькуляторе выше.') },
          { q: t('sec.billing.faq49Q4', 'Какие подписки мне понадобятся?'), a: t('sec.billing.faq49A4', 'Для старта достаточно двух: Google AI Pro (€21.99/мес — Flow-видео + NotebookLM с расширенными лимитами) и HeyGen Creator ($29/мес — около 30 минут аватара Avatar IV). У всех сервисов есть и бесплатные лимиты (Flow — 50 кредитов/день, NotebookLM — 3 обзора/день, HeyGen — 3 видео/мес) — конвейер можно попробовать вообще без подписок.') },
          { q: t('sec.billing.faq49Q5', 'Можно ли работать только через API-ключи?'), a: t('sec.billing.faq49A5', 'Да. Подключите свои ключи (Google Veo, FAL/Kling, Runway, OpenAI, ElevenLabs, HeyGen, Claude) в настройках — сервис будет генерировать ими напрямую, без расширения. Оплата этим сервисам идёт по их тарифам. Пути можно совмещать: например, аватары по подписке, а озвучку по API.') },
          { q: t('sec.billing.faq49Q6', 'Как отменить подписку? Где кнопка?'), a: t('sec.billing.faq49A6', 'Вверху этой страницы, в карточке «Ваш тариф», при активной подписке появляется кнопка «Отключить автопродление». Деньги за оплаченный период не возвращаются, но доступ сохраняется до его конца. Если отключить во время пробного периода — списаний не будет совсем. Возобновить можно в один клик до конца периода.') },
          { q: t('sec.billing.faq49Q7', 'Действуют ли промокоды?'), a: t('sec.billing.faq49A7', 'Да. Введите промокод выше — скидка применится при оформлении Premium через Stripe.') },
        ].map((item, idx) => (
          <AuroraCard key={idx} className="p-4">
            <p className="text-sm font-600 mb-1" style={{ color: 'var(--text-primary)' }}>{item.q}</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.a}</p>
          </AuroraCard>
        ))}
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t('sec.billing.disclaimer49', 'TrendTraffic не аффилирован с Google, HeyGen, ElevenLabs или Blotato. Расширение автоматизирует работу в ваших собственных аккаунтах — соблюдайте условия использования провайдеров. Цены провайдеров указаны по официальным прайсам на июль 2026 и могут меняться.')}
        </p>
      </div>

      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant || 'danger'}
        onConfirm={() => { const cb = confirmDialog?.onConfirm; setConfirmDialog(null); cb?.(); }}
        onCancel={() => setConfirmDialog(null)}
      />
      </div>{/* /контент поверх частиц (fxContentRef, z1) */}
    </div>
  );
}
