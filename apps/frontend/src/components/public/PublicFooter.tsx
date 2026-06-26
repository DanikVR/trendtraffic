/**
 * PublicFooter — футер публичных страниц VibeVox.
 * Навигация, правовые ссылки и обязательный юридический блок (в одну строку).
 */

const COLS = [
  { title: 'Продукт', links: ['Возможности', 'Тарифы', 'Демо-звонок', 'Интеграции'] },
  { title: 'Решения', links: ['Видеовстречи', 'SIP-телефония', 'Телемедицина', 'Юриспруденция'] },
  { title: 'Компания', links: ['О VibeVox', 'Сравнение', 'Контакты', 'Документация'] },
];

const LEGAL = [
  { href: '/privacy', label: 'Политика конфиденциальности' },
  { href: '/terms', label: 'Условия использования' },
  { href: '/cookies', label: 'Политика использования файлов cookie' },
];

export function PublicFooter() {
  return (
    <footer className="relative border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <img src="/vibevox-logo.png" alt="VibeVox" className="h-6 w-auto mb-4" />
            <p className="text-sm text-white/45 leading-relaxed max-w-xs">
              Синхронный ИИ-перевод видеовстреч и звонков на 100+ языков. €0.17/мин, без сгорания минут.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="font-700 text-white/85 text-sm mb-3">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-white/45 hover:text-neon-orange transition-colors">{l}</a>
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
