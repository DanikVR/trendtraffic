/**
 * chrome.tsx — общая обвязка публичного лендинга TrendTraffic (стиль «Dala»):
 * логотип, навигация, футер (реквизиты), прелоадер, reveal-хелперы
 * и лёгкий lerp-скролл. Всё скоупится классами .ttl-* (landing.css).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { CookieConsent, openCookieConsent } from '../../../components/CookieConsent';

export const APP_URL = 'https://app.trendtraffic.pro';

/* ────────────────────────── Логотип ────────────────────────── */

/** Фирменный логотип (цветной wordmark на тёмном). h — высота в px. */
export function TTLogo({ h = 38 }: { h?: number }) {
  return (
    <img
      className="ttl-logo-img"
      src="/vibevox-logo-dark.png"
      alt="TrendTraffic"
      style={{ height: `var(--ttl-logo-h, ${h}px)` }}
      decoding="async"
    />
  );
}

/* ────────────────────────── Reveal-хелперы ────────────────────────── */

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Заголовок из строк-«масок»: каждая строка выезжает снизу. */
export function RevealLines({
  lines, className, as: Tag = 'h2', delay = 0, animate,
}: {
  lines: React.ReactNode[];
  className?: string;
  as?: 'h1' | 'h2' | 'p' | 'div';
  delay?: number;
  /** Если задано — управляемый режим (герой ждёт прелоадер), иначе whileInView. */
  animate?: boolean;
}) {
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: delay } },
  };
  const line = {
    hidden: { y: '112%' },
    show: { y: '0%', transition: { duration: 0.95, ease: EASE } },
  };
  const controlled = typeof animate === 'boolean';
  return (
    <motion.div
      variants={container}
      initial="hidden"
      {...(controlled
        ? { animate: animate ? 'show' : 'hidden' }
        : { whileInView: 'show', viewport: { once: true, margin: '-12% 0px' } })}
    >
      <Tag className={className} style={{ margin: 0 }}>
        {lines.map((l, i) => (
          <span className="ttl-mask" key={i}>
            <motion.span style={{ display: 'block' }} variants={line}>{l}</motion.span>
          </span>
        ))}
      </Tag>
    </motion.div>
  );
}

/** Мягкий fade-up для лейблов, абзацев, кнопок. */
export function FadeUp({
  children, delay = 0, animate, style, className,
}: {
  children: React.ReactNode;
  delay?: number;
  animate?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const controlled = typeof animate === 'boolean';
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 26 }}
      {...(controlled
        ? { animate: animate ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 } }
        : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-10% 0px' } })}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ────────────────────────── Прелоадер ────────────────────────── */

export function Preloader({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setGone(true); onDoneRef.current(); return; }
    let raf = 0;
    let finished = false;
    let t0 = 0;
    const DUR = 1100;
    const finish = () => {
      if (finished) return;
      finished = true;
      setCount(100);
      setDone(true);
      onDoneRef.current();
      window.setTimeout(() => setGone(true), 900);
    };
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const p = Math.min(1, (now - t0) / DUR);
      setCount(Math.round(p * 100));
      if (p < 1) { raf = requestAnimationFrame(tick); return; }
      finish();
    };
    // rAF в скрытой вкладке не тикает — стартуем счётчик, когда вкладку видно.
    let visHandler: (() => void) | null = null;
    if (document.hidden) {
      visHandler = () => {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', visHandler!);
        visHandler = null;
        raf = requestAnimationFrame(tick);
      };
      document.addEventListener('visibilitychange', visHandler);
    } else {
      raf = requestAnimationFrame(tick);
    }
    // Жёсткий фолбэк: фоновые вкладки и боты не должны застрять под оверлеем.
    const failsafe = window.setTimeout(finish, 4000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(failsafe);
      if (visHandler) document.removeEventListener('visibilitychange', visHandler);
    };
  }, []);

  if (gone) return null;
  return (
    <div className={`ttl-preloader${done ? ' is-done' : ''}`} aria-hidden="true">
      {/* Логотип в начале экрана — как у хедера (после шторки нав-лого на том же месте) */}
      <div className="ttl-preloader-brand ttl-wrap">
        <TTLogo />
      </div>
      {/* И крупный фирменный логотип по центру экрана загрузки */}
      <img className="ttl-preloader-logo" src="/vibevox-logo-dark.png" alt="" />
      <div className="ttl-preloader-count">{count}</div>
    </div>
  );
}

/* ────────────────────────── Плавный скролл ────────────────────────── */

/**
 * Лёгкий lerp-скролл: контент фиксируется и «догоняет» window.scrollY.
 * Только точный указатель и без prefers-reduced-motion; на тач — натив.
 * Возвращает scrollToId для якорей (нативные якоря с transform не работают)
 * и posRef — текущий ВИЗУАЛЬНЫЙ скролл (лерпнутый cur либо window.scrollY),
 * к нему привязана хореография частиц (Constellation).
 */
export function useSmoothScroll(contentRef: React.RefObject<HTMLDivElement>) {
  const curRef = useRef(0);
  const posRef = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const activeRef = useRef(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) {
      // Натив-скролл: posRef зеркалит window.scrollY
      const onScroll = () => { posRef.current = window.scrollY; };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    activeRef.current = true;
    el.classList.add('ttl-smooth');
    const spacer = document.createElement('div');
    spacer.setAttribute('data-ttl-spacer', '');
    document.body.appendChild(spacer);

    let target = window.scrollY;
    let cur = target;
    let raf = 0;

    const setHeight = () => {
      // Общая высота прокрутки должна равняться ФАКТИЧЕСКОЙ высоте контента.
      // Контент на время smooth-скролла fixed, но его обёртки (#root и .ttl с
      // min-height:100vh) остаются в потоке и добавляют высоту вьюпорта —
      // без компенсации после футера остаётся пустой «хвост» на целый экран.
      const flowOther = document.body.scrollHeight - spacer.offsetHeight;
      spacer.style.height = `${Math.max(0, el.scrollHeight - flowOther)}px`;
    };
    const ro = new ResizeObserver(setHeight);
    ro.observe(el);
    setHeight();
    // Поздние шрифты/картинки и ресайз окна меняют и контент, и вклад 100vh-обёрток.
    window.addEventListener('resize', setHeight);
    document.fonts?.ready.then(setHeight).catch(() => {});

    const onScroll = () => { target = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });

    let last = 0;
    const loop = (now: number) => {
      if (!last) last = now;
      const dt = now - last;
      last = now;
      if (dt > 400) {
        cur = target; // вкладка была скрыта/лагала — догоняем мгновенно, без дрейфа
      } else {
        cur += (target - cur) * (1 - Math.exp(-dt * 0.006)); // ≈0.095 при 60fps, независимо от герц
      }
      if (Math.abs(target - cur) < 0.05) cur = target;
      curRef.current = cur;
      posRef.current = cur;
      el.style.transform = `translate3d(0, ${-cur}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      activeRef.current = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      spacer.remove();
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('scroll', onScroll);
      el.classList.remove('ttl-smooth');
      el.style.transform = '';
    };
  }, [contentRef]);

  const scrollToId = (id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    if (!activeRef.current || !contentRef.current) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // Абсолютный оффсет внутри контента: не зависит от текущей фазы lerp
    const top = node.getBoundingClientRect().top - contentRef.current.getBoundingClientRect().top - 8;
    window.scrollTo(0, Math.max(0, top));
  };

  return { scrollToId, posRef };
}

/* ────────────────────────── Навигация ────────────────────────── */

export function TTNav({
  onAnchor, minimal = false,
}: {
  /** Клик по якорю секции (лендинг с lerp-скроллом). */
  onAnchor?: (id: string) => void;
  /** Режим заглушек: без якорных ссылок. */
  minimal?: boolean;
}) {
  const { t } = useTranslation('common');
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 30);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const links: Array<[string, string]> = [
    ['features', t('sec.ttLanding.navFeatures', 'Возможности')],
    ['how', t('sec.ttLanding.navHow', 'Как работает')],
    ['savings', t('sec.ttLanding.navSavings', 'Экономия')],
    ['pricing', t('sec.ttLanding.navPricing', 'Тариф')],
  ];

  return (
    <header className={`ttl-nav${scrolled ? ' is-scrolled' : ''}`}>
      <div className="ttl-wrap ttl-nav-inner">
        <Link to="/landing" aria-label="TrendTraffic"><TTLogo /></Link>
        {!minimal && (
          <nav className="ttl-nav-links" aria-label="Sections">
            {links.map(([id, label]) => (
              <button key={id} type="button" className="ttl-nav-link" onClick={() => onAnchor?.(id)}>
                {label}
              </button>
            ))}
          </nav>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a className="ttl-ghost" href={`${APP_URL}/auth/login`}>
            {t('sec.ttLanding.navLogin', 'Войти')}
          </a>
          <a className="ttl-btn" href={`${APP_URL}/auth/register`}>
            <span className="ttl-btn-full">{t('sec.ttLanding.navStart', 'Начать бесплатно')}</span>
            <span className="ttl-btn-short">{t('sec.ttLanding.navStartShort', 'Начать')}</span>
          </a>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────── Футер ────────────────────────── */

export function TTFooter() {
  const { t } = useTranslation('common');
  return (
    <footer className="ttl-footer">
      <div className="ttl-wrap">
        {/* Копирайт — первым, в начале футера (пожелание владельца) */}
        <p className="ttl-caption ttl-footer-copy">© Trendtraffic.pro 2026</p>
        <div className="ttl-footer-grid">
          <div>
            <TTLogo h={46} />
            <p className="ttl-body ttl-footer-tagline">
              {t('sec.ttLanding.footerTagline', 'Автоматическое создание трендового видеоконтента с экономией на ИИ.')}
            </p>
            <a className="ttl-footer-mail" href="mailto:SEO@trendtraffic.pro">SEO@trendtraffic.pro</a>
          </div>
          <div>
            <h3 className="ttl-footer-col-title">{t('sec.ttLanding.footerColSections', 'Разделы')}</h3>
            <div className="ttl-footer-links">
              <a className="ttl-footer-link" href={`${APP_URL}/billing`}>{t('sec.ttLanding.footerPricing', 'Прайс')}</a>
              <Link className="ttl-footer-link" to="/wiki">{t('sec.ttLanding.footerWiki', 'Wiki')}</Link>
              <Link className="ttl-footer-link" to="/about">{t('sec.ttLanding.footerAbout', 'О проекте')}</Link>
            </div>
          </div>
          <div>
            <h3 className="ttl-footer-col-title">{t('sec.ttLanding.footerColLegal', 'Право')}</h3>
            <div className="ttl-footer-links">
              <Link className="ttl-footer-link" to="/privacy">{t('sec.ttLanding.footerPrivacy', 'Политика конфиденциальности')}</Link>
              <Link className="ttl-footer-link" to="/terms">{t('sec.ttLanding.footerTerms', 'Условия использования')}</Link>
              <Link className="ttl-footer-link" to="/cookies">{t('sec.ttLanding.footerCookies', 'Политика Cookie')}</Link>
              <button type="button" className="ttl-footer-link ttl-footer-linkbtn" onClick={openCookieConsent}>
                {t('sec.ttLanding.footerCookieSettings', 'Настройки cookie')}
              </button>
            </div>
          </div>
        </div>
        <div className="ttl-footer-bottom">
          <span className="ttl-caption">
            LARYSA DANYUK · woj. MAZOWIECKIE, pow. Warszawa, gm. Warszawa, miejsc. Warszawa,
            ul. Jana III Sobieskiego, nr 1, lok. 49, 02-957
          </span>
        </div>
      </div>
      {/* Плашка cookie-согласия (ЕС): фиксирована внизу, на всех маркетинговых страницах */}
      <CookieConsent />
    </footer>
  );
}
