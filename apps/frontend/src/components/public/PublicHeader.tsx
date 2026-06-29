/**
 * PublicHeader — шапка публичных (маркетинговых/SEO) страниц VibeVox.
 * Логотип-картинка, якорная навигация, переключатель языков и CTA.
 * Только для новых публичных страниц.
 */

import { LanguageSwitcher } from '../LanguageSwitcher';

const NAV = [
  { href: '/landing#features', label: 'Возможности' },
  { href: '/landing#pricing', label: 'Тарифы' },
  { href: '/landing#compare', label: 'Сравнение' },
];

export function PublicHeader() {
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl"
      style={{ background: 'rgba(10,10,12,0.72)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href="/landing#top" className="flex items-center shrink-0" aria-label="VibeVox">
          <img src="/vibevox-logo.png" alt="VibeVox" className="h-6 sm:h-7 w-auto" />
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-sm font-500 text-white/60 hover:text-white transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <LanguageSwitcher />
          <a
            href="/"
            className="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm font-700 text-white transition-all hover:brightness-110"
            style={{ background: 'var(--brand)', boxShadow: '0 6px 22px rgba(99,102,241,0.35)' }}
          >
            Создать демо-комнату
          </a>
        </div>
      </div>
    </header>
  );
}

export default PublicHeader;
