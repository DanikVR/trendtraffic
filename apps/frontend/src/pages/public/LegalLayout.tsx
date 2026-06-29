/**
 * LegalLayout — общий каркас правовых страниц VibeVox (Конфиденциальность,
 * Условия, Cookie). Тёмная тема, шапка/футер публичных страниц, читаемая
 * типографика для длинного текста. Изолирован от приложения.
 */

import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

const LEGAL_STYLES = `
.legal h2 { font-family: 'Geist Sans', sans-serif; font-weight: 700; font-size: 1.35rem; color:#fff; margin-top: 2.6rem; margin-bottom: 0.2rem; scroll-margin-top: 5rem; }
.legal h3 { font-weight: 700; font-size: 1.05rem; color: rgba(255,255,255,0.92); margin-top: 1.4rem; }
.legal p  { color: rgba(255,255,255,0.6); line-height: 1.75; margin-top: 0.85rem; }
.legal ul { margin-top: 0.7rem; padding-left: 1.25rem; list-style: disc; }
.legal li { color: rgba(255,255,255,0.6); line-height: 1.7; margin-top: 0.4rem; }
.legal a  { color: var(--brand); text-decoration: none; }
.legal a:hover { text-decoration: underline; }
.legal strong { color: #fff; font-weight: 600; }
`;

interface LegalLayoutProps {
  title: string;
  updated: string;
  intro?: ReactNode;
  children: ReactNode;
  metaDescription: string;
}

export function LegalLayout({ title, updated, intro, children, metaDescription }: LegalLayoutProps) {
  return (
    <div className="dark relative min-h-screen text-white" style={{ background: '#0A0A0B' }}>
      <Helmet>
        <title>{`${title} — VibeVox`}</title>
        <meta name="description" content={metaDescription} />
        <style>{LEGAL_STYLES}</style>
      </Helmet>

      <PublicHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex items-center gap-3 mb-5">
          <span className="h-px w-8" style={{ background: 'rgba(99,102,241,0.6)' }} />
          <span className="text-xs font-700 uppercase tracking-[0.2em] text-white/50">Правовая информация</span>
        </div>
        <h1 className="font-display font-800 text-3xl sm:text-5xl tracking-[-0.02em] mb-3">{title}</h1>
        <p className="text-sm text-white/40 mb-8">Последнее обновление: {updated}</p>

        {intro && <div className="legal mb-2">{intro}</div>}

        <article className="legal">{children}</article>

        <div className="mt-12 pt-6 text-sm text-white/45" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          По всем вопросам: <a href="mailto:SEO@vibevox.pro" style={{ color: 'var(--brand)' }}>SEO@vibevox.pro</a>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default LegalLayout;
