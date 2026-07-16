/**
 * PublicFooter — футер публичных страниц VibeVox.
 * Навигация, правовые ссылки и обязательный юридический блок (в одну строку).
 * Тексты — через t() с русским фолбэком; колонки собираются внутри компонента.
 */

import { useTranslation } from 'react-i18next';

export function PublicFooter() {
  const { t } = useTranslation('common');

  const COLS = [
    {
      title: t('sec.pub.colProduct', 'Продукт'),
      links: [
        { label: t('sec.pub.linkFeatures', 'Возможности'), href: '/landing#features' },
        { label: t('sec.pub.linkPricing', 'Тарифы'), href: '/landing#pricing' },
        { label: t('sec.pub.linkDemoCall', 'Демо-звонок'), href: '#' },
        { label: t('sec.pub.linkIntegrations', 'Интеграции'), href: '#' },
      ],
    },
    {
      title: t('sec.pub.colSolutions', 'Решения'),
      links: [
        { label: t('sec.pub.linkVideoMeet', 'Видеовстречи'), href: '#' },
        { label: t('sec.pub.linkSip', 'SIP-телефония'), href: '#' },
        { label: t('sec.pub.linkTelemed', 'Телемедицина'), href: '#' },
        { label: t('sec.pub.linkLaw', 'Юриспруденция'), href: '#' },
      ],
    },
    {
      title: t('sec.pub.colCompany', 'Компания'),
      links: [
        { label: t('sec.pub.linkAbout', 'О VibeVox'), href: '#' },
        { label: t('sec.pub.linkCompare', 'Сравнение'), href: '/landing#compare' },
        { label: t('sec.pub.linkContacts', 'Контакты'), href: 'mailto:SEO@vibevox.pro' },
        { label: t('sec.pub.linkDocs', 'Документация'), href: '#' },
      ],
    },
  ];

  const LEGAL = [
    { href: '/privacy', label: t('sec.pub.privacyTitle', 'Политика конфиденциальности') },
    { href: '/terms', label: t('sec.pub.termsTitle', 'Условия использования') },
    { href: '/cookies', label: t('sec.pub.cookiesTitle', 'Политика использования файлов cookie') },
  ];

  return (
    <footer className="relative border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <img src="/vibevox-logo.png" alt="VibeVox" className="h-6 w-auto mb-4" />
            <p className="text-sm text-white/45 leading-relaxed max-w-xs">
              {t('sec.pub.footerAbout', 'Синхронный ИИ-перевод видеовстреч и звонков на 100+ языков. €0.17/мин, без сгорания минут.')}
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="font-700 text-white/85 text-sm mb-3">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-white/45 hover:text-neon-orange transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Правовые ссылки */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-6 mb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {LEGAL.map((l) => (
            <a key={l.href} href={l.href} className="text-xs font-500 text-white/55 hover:text-neon-orange transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        {/* Юридический блок — каждая строка без переноса */}
        <div className="text-xs leading-relaxed text-white/40 overflow-x-auto">
          <p className="whitespace-nowrap">© VibeVox.pro 2026 LARYSA DANYUK.</p>
          <p className="whitespace-nowrap mt-1">
            woj. MAZOWIECKIE, pow. Warszawa, gm. Warszawa, miejsc. Warszawa, ul. Jana III Sobieskiego, nr 1, lok. 49, 02-957.
          </p>
          <p className="whitespace-nowrap mt-1">
            <a href="mailto:SEO@vibevox.pro" className="text-white/55 hover:text-neon-orange transition-colors">SEO@vibevox.pro</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
