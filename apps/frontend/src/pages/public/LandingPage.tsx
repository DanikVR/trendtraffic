/**
 * LandingPage — публичная первая страница TrendTraffic (trendtraffic.pro).
 *
 * Полный редизайн 16.07.2026 в стиле «Dala» (референс DESIGN.md):
 * чистый чёрный void, монолитная типографика Inter 400 на огромных кеглях
 * с отрицательным трекингом, body — ультралёгкий Inter 200, один фиолетовый
 * pill-CTA (#8052ff), янтарные акценты (#ffb829), созвездие треугольных
 * частиц как единственная hero-графика, lerp-скролл и line-mask ревилы.
 *
 * Изолирована от приложения: стили в landing/landing.css (скоуп .ttl),
 * обвязка в landing/chrome.tsx. Тексты — новые ключи sec.ttLanding.*
 * (русский эталон; прогон translate-pivot — после утверждения текстов).
 * Фото-слоты пустые (.ttl-media) — изображения зальёт владелец.
 */

import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  APP_URL, TTNav, TTFooter, Preloader, RevealLines, FadeUp, useSmoothScroll,
} from './landing/chrome';
import { Constellation } from './landing/Constellation';
import './landing/landing.css';

function Arrow() {
  return (
    <svg className="ttl-btn-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function LandingPage() {
  const { t } = useTranslation('common');
  const [started, setStarted] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const { scrollToId, posRef } = useSmoothScroll(pageRef);

  // Лендинг живёт на чистом чёрном — красим body на время визита.
  useEffect(() => {
    const prev = document.body.style.background;
    const prevX = document.body.style.overflowX;
    document.body.style.background = '#000';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.background = prev;
      document.body.style.overflowX = prevX;
    };
  }, []);

  const steps = [
    {
      n: '01',
      title: t('sec.ttLanding.step1Title', 'Находим тренды'),
      text: t('sec.ttLanding.step1Text', 'Сканер обходит TikTok, Instagram и YouTube по вашей нише, региону и языку. ИИ-таргетолог подбирает микро-ниши и ключевики и ранжирует их по реальному спросу.'),
    },
    {
      n: '02',
      title: t('sec.ttLanding.step2Title', 'Разбираем по кадрам'),
      text: t('sec.ttLanding.step2Text', 'Gemini-аналитика раскладывает вирусный ролик на хук, ритм и структуру. Вы получаете TrendDNA — рецепт, по которому студия соберёт ваше видео, плюс субтитры оригинала.'),
    },
    {
      n: '03',
      title: t('sec.ttLanding.step3Title', 'Собираем ролик'),
      text: t('sec.ttLanding.step3Text', 'UGC-студия делает видео с ИИ-аватаром: готовые луки или аватар по вашему фото, голоса ElevenLabs на 29 языках, врезки, субтитры, брендкит. Форматы 9:16 и 16:9.'),
    },
    {
      n: '04',
      title: t('sec.ttLanding.step4Title', 'Публикуем за вас'),
      text: t('sec.ttLanding.step4Text', 'Автопилот следит за трендами и собирает ролики по шаблону, а Публикатор раскладывает их по слотам на 35 дней вперёд: 9:16 — в TikTok, 16:9 — в YouTube.'),
    },
  ];

  const features = [
    {
      label: t('sec.ttLanding.f1Label', 'Поиск трендов'),
      title: t('sec.ttLanding.f1Title', 'Тренды — раньше всех'),
      text: t('sec.ttLanding.f1Text', 'Скан трёх платформ по нише и гео-региону выдачи. «Таргет на ЦА»: опишите продукт — ИИ сам заполнит аудиторию, подберёт ключевики на 29 языках и найдёт ниши с реальным спросом. Каналы конкурентов — в вотчлисте с историей метрик.'),
      ph: t('sec.ttLanding.f1Ph', 'Скриншот: лента трендов'),
    },
    {
      label: t('sec.ttLanding.f2Label', 'Аналитика · TrendDNA'),
      title: t('sec.ttLanding.f2Title', 'Рецепт вирусности — по кадрам'),
      text: t('sec.ttLanding.f2Text', 'Вставьте ссылку на любое видео TikTok, Instagram или YouTube — Gemini разберёт его покадрово: хук, ритм, структура, титры. Разбор и субтитры лягут в галерею, а «ДНК тренда» автоматически срежиссирует ваш будущий ролик.'),
      ph: t('sec.ttLanding.f2Ph', 'Скриншот: разбор видео'),
    },
    {
      label: t('sec.ttLanding.f3Label', 'UGC-студия'),
      title: t('sec.ttLanding.f3Title', 'Аватар говорит за вас'),
      text: t('sec.ttLanding.f3Text', 'Четыре режима: соло, диалог двоих, свой текст «как есть», режиссура по анализу тренда. Готовые луки HeyGen или аватар по вашему фото, все голоса ElevenLabs включая клоны, живые стили субтитров и брендкиты.'),
      ph: t('sec.ttLanding.f3Ph', 'Скриншот: студия'),
    },
    {
      label: t('sec.ttLanding.f4Label', 'Автопилот · Публикатор'),
      title: t('sec.ttLanding.f4Title', 'Контент-план на месяц — без вас'),
      text: t('sec.ttLanding.f4Text', 'Слежение за трендами превращает находки в готовые ролики по вашему шаблону. Цепочки автопубликации сами раскладывают форматы по площадкам и слотам — TikTok, YouTube и Instagram получают контент по расписанию.'),
      ph: t('sec.ttLanding.f4Ph', 'Скриншот: публикатор'),
    },
  ];

  const stats = [
    { v: '×4', l: t('sec.ttLanding.stat1', 'дешевле рендер аватара по подписке') },
    { v: '108', l: t('sec.ttLanding.stat2', 'языков интерфейса и переводов') },
    { v: '29', l: t('sec.ttLanding.stat3', 'языков озвучки ElevenLabs') },
    { v: '35', l: t('sec.ttLanding.stat4', 'дней контент-плана вперёд') },
  ];

  const priceIncludes = [
    t('sec.ttLanding.inc1', 'Тренды, ниши и каналы — без лимита сканов'),
    t('sec.ttLanding.inc2', 'Покадровая аналитика и TrendDNA'),
    t('sec.ttLanding.inc3', 'UGC-студия: аватары, голоса, субтитры'),
    t('sec.ttLanding.inc4', 'Автопилот и автопубликация в 3 платформы'),
    t('sec.ttLanding.inc5', 'Chrome-расширение: HeyGen, Google Flow, NotebookLM по подписке'),
  ];

  return (
    <div className="ttl">
      <Helmet>
        <title>{t('sec.ttLanding.pageTitle', 'TrendTraffic — трендовые видео на автопилоте')}</title>
        <meta name="description"
          content={t('sec.ttLanding.pageDescription', 'TrendTraffic находит вирусные тренды в TikTok, Instagram и YouTube, разбирает их по кадрам и собирает UGC-ролики с ИИ-аватарами — с публикацией по расписанию и экономией на ИИ до ×4.')} />
      </Helmet>

      <Preloader onDone={() => setStarted(true)} />
      {/* Сквозной слой частиц: фиксирован, живёт под контентом всю страницу */}
      <Constellation started={started} posRef={posRef} />
      <TTNav onAnchor={scrollToId} />

      <div ref={pageRef} className="ttl-page">
        <main>
          {/* ══════════ HERO ══════════ */}
          <section className="ttl-hero" id="top">
            <div className="ttl-wrap ttl-hero-grid">
              <div className="ttl-hero-copy">
                <FadeUp animate={started} delay={0.15}>
                  <p className="ttl-label">{t('sec.ttLanding.heroLabel', 'ИИ-фабрика трендового видео')}</p>
                </FadeUp>
                <RevealLines
                  as="h1"
                  className="ttl-display"
                  animate={started}
                  delay={0.25}
                  lines={[
                    t('sec.ttLanding.heroTitleL1', 'Тренды — в видео.'),
                    t('sec.ttLanding.heroTitleL2', 'На автопилоте.'),
                  ]}
                />
                <FadeUp animate={started} delay={0.55}>
                  <p className="ttl-body ttl-hero-sub">
                    {t('sec.ttLanding.heroSub', 'TrendTraffic находит вирусные тренды в TikTok, Instagram и YouTube, разбирает их по кадрам и собирает готовые UGC-ролики с ИИ-аватарами. Публикация — по расписанию, ИИ — ')}
                    <span className="ttl-amber">{t('sec.ttLanding.heroSubAccent', 'до ×4 дешевле')}</span>
                    {t('sec.ttLanding.heroSubTail', ' обычных API.')}
                  </p>
                </FadeUp>
                <FadeUp animate={started} delay={0.7}>
                  <div className="ttl-hero-ctas">
                    <a className="ttl-btn" href={`${APP_URL}/auth/register`}>
                      {t('sec.ttLanding.heroCtaStart', 'Начать бесплатно')} <Arrow />
                    </a>
                    <button type="button" className="ttl-ghost" onClick={() => scrollToId('pricing')}>
                      {t('sec.ttLanding.heroCtaPricing', 'Тариф — €49/мес')}
                    </button>
                  </div>
                  <p className="ttl-caption ttl-hero-note">
                    {t('sec.ttLanding.heroTrialNote', '7 дней бесплатно · отмена в любой момент')}
                  </p>
                </FadeUp>
              </div>
            </div>
          </section>

          {/* ══════════ STATEMENT ══════════ */}
          <section className="ttl-section">
            <div className="ttl-wrap">
              <RevealLines
                className="ttl-h-lg"
                lines={[
                  t('sec.ttLanding.stTitleL1', 'Один сервис —'),
                  <span className="ttl-amber" key="a">{t('sec.ttLanding.stTitleL2', 'вместо десяти ИИ-подписок.')}</span>,
                ]}
              />
              <FadeUp delay={0.2}>
                <p className="ttl-body" style={{ maxWidth: 560, marginTop: 34 }}>
                  {t('sec.ttLanding.stBody', 'Поиск трендов, разбор вирусных видео, аватары, озвучка, субтитры, автосборка роликов и автопостинг — в одном окне. Подключайте свои ключи или подписки сервисов и платите так, как выгоднее вам.')}
                </p>
              </FadeUp>
            </div>
          </section>

          {/* ══════════ КАК ЭТО РАБОТАЕТ ══════════ */}
          <section className="ttl-section-tight" id="how">
            <div className="ttl-wrap">
              <FadeUp>
                <p className="ttl-label">{t('sec.ttLanding.howLabel', 'Как это работает')}</p>
              </FadeUp>
              <div className="ttl-steps">
                {steps.map((s, i) => (
                  <div className="ttl-step" key={s.n}>
                    <div>
                      <FadeUp delay={0.05 * i}>
                        <span className="ttl-step-num">{s.n}</span>
                      </FadeUp>
                      <RevealLines className="ttl-h-lg" lines={[s.title]} />
                    </div>
                    <FadeUp delay={0.15}>
                      <p className="ttl-body">{s.text}</p>
                    </FadeUp>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ══════════ ВОЗМОЖНОСТИ (zigzag + фото-слоты) ══════════ */}
          <section className="ttl-section" id="features">
            <div className="ttl-wrap" style={{ display: 'grid', gap: 'clamp(80px, 10vw, 140px)' }}>
              {features.map((f, i) => {
                const media = (
                  <FadeUp key="m" delay={0.1}>
                    <div className="ttl-media"><span>{f.ph}</span></div>
                  </FadeUp>
                );
                const copy = (
                  <div key="c">
                    <FadeUp><p className="ttl-label">{f.label}</p></FadeUp>
                    <RevealLines className="ttl-h" lines={[f.title]} />
                    <FadeUp delay={0.15}><p className="ttl-body">{f.text}</p></FadeUp>
                  </div>
                );
                return (
                  <div className="ttl-cols" key={f.label}>
                    {i % 2 === 0 ? [copy, media] : [media, copy]}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ══════════ ЭКОНОМИЯ ══════════ */}
          <section className="ttl-section" id="savings">
            <div className="ttl-wrap">
              <FadeUp>
                <p className="ttl-label">{t('sec.ttLanding.savLabel', 'Экономия на ИИ')}</p>
              </FadeUp>
              <RevealLines
                className="ttl-h-lg"
                lines={[
                  t('sec.ttLanding.savTitleL1', 'Платите за подписки,'),
                  t('sec.ttLanding.savTitleL2', 'а не за дорогие API.'),
                ]}
              />
              <FadeUp delay={0.2}>
                <p className="ttl-body" style={{ maxWidth: 560, marginTop: 30 }}>
                  {t('sec.ttLanding.savBody', 'Фирменное Chrome-расширение подключает ИИ-сервисы по вашим обычным подпискам вместо тарификации за API-кредиты. А свои ключи (BYOK) — Gemini, ElevenLabs, TikHub, Blotato — работают напрямую, без наценки посредника.')}
                </p>
              </FadeUp>

              <div className="ttl-save-rows">
                {[
                  {
                    name: t('sec.ttLanding.savRow1Name', 'Рендер ИИ-аватара HeyGen'),
                    was: t('sec.ttLanding.savRow1Was', 'по API — $3–4 за минуту'),
                    now: t('sec.ttLanding.savRow1Now', 'по подписке — около $1 за минуту'),
                  },
                  {
                    name: t('sec.ttLanding.savRow2Name', 'Видеогенерация Veo 3.1'),
                    was: t('sec.ttLanding.savRow2Was', 'дорогие API-кредиты'),
                    now: t('sec.ttLanding.savRow2Now', 'ваша подписка Google Flow'),
                  },
                  {
                    name: t('sec.ttLanding.savRow3Name', 'Разборы и озвучка NotebookLM'),
                    was: t('sec.ttLanding.savRow3Was', 'платные токены'),
                    now: t('sec.ttLanding.savRow3Now', 'ваша подписка Google'),
                  },
                ].map((r, i) => (
                  <FadeUp key={r.name} delay={0.08 * i}>
                    <div className="ttl-save-row">
                      <span className="ttl-save-name">{r.name}</span>
                      <span className="ttl-save-vals">
                        <span className="ttl-save-was">{r.was}</span>
                        <span className="ttl-save-now">{r.now}</span>
                      </span>
                    </div>
                  </FadeUp>
                ))}
              </div>

              <div className="ttl-stats">
                {stats.map((s, i) => (
                  <FadeUp key={s.v} delay={0.07 * i}>
                    <div className="ttl-stat-v">{s.v}</div>
                    <div className="ttl-stat-l">{s.l}</div>
                  </FadeUp>
                ))}
              </div>
            </div>
          </section>

          {/* ══════════ ТАРИФ ══════════ */}
          <section className="ttl-section" id="pricing">
            <div className="ttl-wrap">
              <FadeUp>
                <p className="ttl-label">{t('sec.ttLanding.priceLabel', 'Тариф')}</p>
              </FadeUp>
              <RevealLines
                className="ttl-price-amount"
                lines={[t('sec.ttLanding.priceAmount', '€49/мес')]}
              />
              <FadeUp delay={0.15}>
                <p className="ttl-body" style={{ maxWidth: 560, marginTop: 26 }}>
                  {t('sec.ttLanding.priceBody', 'Premium — полный доступ ко всем модулям. Первые 7 дней бесплатно, списаний нет, отмена в любой момент.')}
                </p>
                <ul className="ttl-price-list">
                  {priceIncludes.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </FadeUp>
              <FadeUp delay={0.25}>
                <div className="ttl-hero-ctas">
                  <a className="ttl-btn" href={`${APP_URL}/billing`}>
                    {t('sec.ttLanding.priceCta', 'Смотреть прайс')} <Arrow />
                  </a>
                  <a className="ttl-ghost" href={`${APP_URL}/billing`}>
                    {t('sec.ttLanding.priceCalc', 'Калькулятор экономии')}
                  </a>
                </div>
              </FadeUp>
            </div>
          </section>

          {/* ══════════ ФИНАЛЬНЫЙ CTA ══════════ */}
          <section className="ttl-section" id="final">
            <div className="ttl-wrap">
              <RevealLines
                className="ttl-display"
                lines={[t('sec.ttLanding.finTitle', 'Пора в тренды.')]}
              />
              <FadeUp delay={0.2}>
                <p className="ttl-body" style={{ maxWidth: 480, marginTop: 30 }}>
                  {t('sec.ttLanding.finBody', 'Создайте аккаунт — первый готовый ролик уже сегодня.')}
                </p>
                <div className="ttl-hero-ctas">
                  <a className="ttl-btn" href={`${APP_URL}/auth/register`}>
                    {t('sec.ttLanding.finCta', 'Начать бесплатно')} <Arrow />
                  </a>
                  <a className="ttl-ghost" href={`${APP_URL}/auth/login`}>
                    {t('sec.ttLanding.finLogin', 'Войти')}
                  </a>
                </div>
              </FadeUp>
            </div>
          </section>
        </main>

        <TTFooter />
      </div>
    </div>
  );
}

export default LandingPage;
