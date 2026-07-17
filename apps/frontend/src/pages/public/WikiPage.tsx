/**
 * WikiPage — «Вики / Документация» TrendTraffic (/wiki).
 *
 * Стиль лендинга «Dala»: тот же TTNav/TTFooter, подложка Constellation (ambient)
 * и lerp-скролл. Организация в духе Википедии: крупный поиск, «Содержание»
 * сбоку, статьи → секции-«темы», у каждой темы — практические примеры.
 *
 * Тексты — ленивый i18n-неймспейс `wiki` (public/locales/<lng>/wiki.json,
 * EN — база, RU — для носителей; остальные языки падают на EN-фолбэк).
 * СТРУКТУРА (порядок секций, скриншоты, ссылки на разделы настроек) живёт здесь
 * в TS и не переводится; переводится только ТЕКСТ по ключам.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, X, ExternalLink, KeyRound, ArrowUpRight, ChevronRight, BookOpen } from 'lucide-react';
import { TTNav, TTFooter, FadeUp, RevealLines, useSmoothScroll, APP_URL } from './landing/chrome';
import { Constellation } from './landing/Constellation';
import './landing/landing.css';

/* ── Структура вики (язык-нейтральная): порядок, скриншоты, ссылки ── */

interface WikiSectionMeta {
  id: string;
  /** Метка вкладки в настройках — для alt скриншота. */
  tab?: string;
  /** Скриншот в public/wiki/. */
  image?: string;
  /** Deep-link на конкретный раздел Enterprise settings (на app-хосте). */
  open?: string;
  /** Внешняя ссылка «где взять ключ». */
  keyHref?: string;
}
interface WikiArticleMeta {
  id: string;
  category: string;
  sections: WikiSectionMeta[];
}

const ES = `${APP_URL}/settings/enterprise`;

const ARTICLES: WikiArticleMeta[] = [
  {
    id: 'first-launch',
    category: 'start',
    sections: [
      { id: 'intro', open: ES },
      { id: 'api', tab: 'API', image: '/wiki-shots/api.png', open: `${ES}?section=gemini`, keyHref: 'https://aistudio.google.com/app/apikey' },
      // Скрин юзера 17.07: вкладка Enterprise → MCP (создание ключа со скоупами);
      // блок «Способ 1 + Скачать MCP» теперь есть и там, и в /settings.
      { id: 'mcp', tab: 'MCP', image: '/wiki-shots/mcp.png', open: `${APP_URL}/settings` },
      { id: 'tikhub', tab: 'Tikhub', image: '/wiki-shots/tikhub.png', open: `${ES}?section=tikhub`, keyHref: 'https://tikhub.io' },
      { id: 'generation', tab: 'Generation', image: '/wiki-shots/generation.png', open: `${ES}?section=openmontage` },
      { id: 'hotebook', tab: 'Hotebook', open: `${ES}?section=hotebook`, keyHref: 'https://notebooklm.google.com' },
    ],
  },
];

/* ── Хелперы ── */

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const anchorId = (artId: string, secId: string) => `w-${artId}-${secId}`;

/** Подсветка первого поискового термина в plain-тексте (безопасно — не HTML). */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const out: ReactNode[] = [];
  const low = text.toLowerCase();
  const tl = term.toLowerCase();
  let i = 0;
  let n = 0;
  while (i <= text.length) {
    const idx = low.indexOf(tl, i);
    if (idx < 0) { out.push(text.slice(i)); break; }
    out.push(text.slice(i, idx));
    out.push(<mark className="ttl-wiki-mark" key={n++}>{text.slice(idx, idx + tl.length)}</mark>);
    i = idx + tl.length;
  }
  return <>{out}</>;
}

export function WikiPage() {
  const { t, ready, i18n } = useTranslation('wiki');
  const pageRef = useRef<HTMLDivElement>(null);
  const { scrollToId, posRef } = useSmoothScroll(pageRef);
  const [query, setQuery] = useState('');

  // Страница на чистом чёрном (как лендинг) — красим body на время визита.
  useEffect(() => {
    const prev = document.body.style.background;
    const prevX = document.body.style.overflowX;
    document.body.style.background = '#000';
    document.body.style.overflowX = 'hidden';
    return () => { document.body.style.background = prev; document.body.style.overflowX = prevX; };
  }, []);

  // Плоский индекс для поиска: строка на каждую секцию.
  const index = useMemo(() => {
    if (!ready) return [] as Array<{
      artId: string; articleTitle: string; secId: string; meta: WikiSectionMeta;
      title: string; body: string; plain: string;
    }>;
    const rows = [];
    for (const art of ARTICLES) {
      const articleTitle = t(`articles.${art.id}.title`);
      for (const meta of art.sections) {
        const base = `articles.${art.id}.sections.${meta.id}`;
        const title = t(`${base}.title`);
        const body = t(`${base}.body`);
        const rawEx = t(`${base}.examples`, { returnObjects: true });
        const examples = Array.isArray(rawEx) ? (rawEx as string[]) : [];
        const plain = `${stripHtml(body)} ${examples.join(' ')}`;
        rows.push({ artId: art.id, articleTitle, secId: meta.id, meta, title, body, plain });
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, i18n.language]);

  const q = query.trim();
  const firstTerm = q.split(/\s+/)[0] || '';
  const results = useMemo(() => {
    if (!q) return null;
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return index.filter((r) => {
      const hay = `${r.title} ${r.articleTitle} ${r.plain}`.toLowerCase();
      return terms.every((term) => hay.includes(term));
    });
  }, [q, index]);

  const metaTitle = ready ? `${t('ui.title')} — TrendTraffic` : 'Wiki — TrendTraffic';

  const openResult = (artId: string, secId: string) => {
    setQuery('');
    // Ждём перерисовку статьи, затем скроллим к секции.
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToId(anchorId(artId, secId))));
  };

  return (
    <div className="ttl">
      <Helmet defer={false}>
        <title>{metaTitle}</title>
        <meta name="description" content={ready ? t('ui.subtitle') : 'TrendTraffic documentation and guides.'} />
        <link rel="canonical" href="https://trendtraffic.pro/wiki" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://trendtraffic.pro/wiki" />
        <meta property="og:site_name" content="TrendTraffic" />
      </Helmet>

      <Constellation started posRef={posRef} ambient />
      <TTNav minimal />

      <div ref={pageRef} className="ttl-page">
        <main className="ttl-wrap ttl-wiki-main">
          {/* ── Шапка + поиск ── */}
          <FadeUp animate>
            <p className="ttl-label">{ready ? t('ui.kicker', 'Documentation') : 'Documentation'}</p>
          </FadeUp>
          <RevealLines as="h1" className="ttl-h-lg" animate delay={0.08} lines={[ready ? t('ui.title', 'Wiki') : 'Wiki']} />
          <FadeUp animate delay={0.2}>
            <p className="ttl-body ttl-wiki-sub">{ready ? t('ui.subtitle') : ''}</p>

            <div className="ttl-wiki-search">
              <Search size={20} className="ttl-wiki-search-ico" aria-hidden />
              <input
                type="search"
                className="ttl-wiki-search-input"
                placeholder={ready ? t('ui.searchPh', 'Search…') : 'Search…'}
                aria-label={ready ? t('ui.searchAria', 'Search the wiki') : 'Search'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              {q && (
                <button type="button" className="ttl-wiki-search-clear" onClick={() => setQuery('')}
                        aria-label={t('ui.clearSearch', 'Clear')}>
                  <X size={16} />
                </button>
              )}
            </div>
          </FadeUp>

          {!ready ? (
            <div className="ttl-wiki-loading" aria-hidden />
          ) : results ? (
            /* ── Результаты поиска ── */
            <div className="ttl-wiki-results">
              <p className="ttl-caption ttl-wiki-results-count">
                {results.length === 0
                  ? t('ui.noResultsTitle', 'Nothing found')
                  : results.length === 1
                    ? t('ui.resultsOne', { q })
                    : t('ui.resultsMany', { n: results.length, q })}
              </p>

              {results.length === 0 ? (
                <p className="ttl-body ttl-wiki-noresults">{t('ui.noResultsBody', { q })}</p>
              ) : (
                <ul className="ttl-wiki-result-list">
                  {results.map((r) => {
                    const idx = r.plain.toLowerCase().indexOf(firstTerm.toLowerCase());
                    const start = Math.max(0, idx - 55);
                    let snippet = r.plain.slice(start, start + 190).trim();
                    if (start > 0) snippet = `… ${snippet}`;
                    if (start + 190 < r.plain.length) snippet = `${snippet} …`;
                    return (
                      <li key={`${r.artId}-${r.secId}`}>
                        <button type="button" className="ttl-wiki-result" onClick={() => openResult(r.artId, r.secId)}>
                          <span className="ttl-wiki-result-crumb">{t('ui.inArticle', { article: r.articleTitle })}</span>
                          <span className="ttl-wiki-result-title"><Highlight text={r.title} term={firstTerm} /></span>
                          <span className="ttl-wiki-result-snippet"><Highlight text={snippet} term={firstTerm} /></span>
                          <span className="ttl-wiki-result-more">{t('ui.readMore', 'Read section')} <ArrowUpRight size={14} /></span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            /* ── Портал: содержание + статья ── */
            <div className="ttl-wiki-layout">
              {/* Содержание (sticky) */}
              <aside className="ttl-wiki-toc" aria-label={t('ui.contents', 'Contents')}>
                <p className="ttl-caption ttl-wiki-toc-title">{t('ui.contents', 'Contents')}</p>
                {ARTICLES.map((art) => (
                  <nav key={art.id} className="ttl-wiki-toc-group">
                    <p className="ttl-wiki-toc-cat">{t(`categories.${art.category}.title`)}</p>
                    <ul>
                      {art.sections.map((s) => (
                        <li key={s.id}>
                          <button type="button" onClick={() => scrollToId(anchorId(art.id, s.id))}>
                            {t(`articles.${art.id}.sections.${s.id}.title`)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ))}
              </aside>

              {/* Статьи */}
              <div className="ttl-wiki-articles">
                {ARTICLES.map((art) => (
                  <article key={art.id} className="ttl-wiki-article">
                    <p className="ttl-wiki-cat-chip">
                      <BookOpen size={13} /> {t('ui.categoryLabel', 'Topic')}: {t(`categories.${art.category}.title`)}
                    </p>
                    <h2 className="ttl-wiki-article-title">{t(`articles.${art.id}.title`)}</h2>
                    <div className="ttl-wiki-lead" dangerouslySetInnerHTML={{ __html: t(`articles.${art.id}.lead`) }} />

                    {art.sections.map((s) => {
                      const base = `articles.${art.id}.sections.${s.id}`;
                      const rawEx = t(`${base}.examples`, { returnObjects: true });
                      const examples = Array.isArray(rawEx) ? (rawEx as string[]) : [];
                      return (
                        <section key={s.id} id={anchorId(art.id, s.id)} className="ttl-wiki-sec">
                          <h3 className="ttl-wiki-sec-title">{t(`${base}.title`)}</h3>
                          <div className="ttl-wiki-sec-body" dangerouslySetInnerHTML={{ __html: t(`${base}.body`) }} />

                          {s.image && (
                            <figure className="ttl-wiki-shot">
                              <img src={s.image} alt={t('ui.screenshotAlt', { tab: s.tab || '' })}
                                   loading="lazy" decoding="async" />
                            </figure>
                          )}

                          {(s.keyHref || s.open) && (
                            <div className="ttl-wiki-links">
                              {s.keyHref && (
                                <a className="ttl-wiki-link ttl-wiki-link-key" href={s.keyHref} target="_blank" rel="noreferrer noopener">
                                  <KeyRound size={14} /> {t(`${base}.keyLabel`, t('ui.whereToGetKey', 'Where to get the key'))}
                                  <ExternalLink size={12} />
                                </a>
                              )}
                              {s.open && (
                                <a className="ttl-wiki-link ttl-wiki-link-open" href={s.open} target="_blank" rel="noreferrer noopener">
                                  {t('ui.openInSettings', 'Open in settings')} <ArrowUpRight size={13} />
                                </a>
                              )}
                            </div>
                          )}

                          {examples.length > 0 && (
                            <div className="ttl-wiki-examples">
                              <p className="ttl-wiki-examples-title">{t('ui.examples', 'Practical examples')}</p>
                              <ol>
                                {examples.map((ex, i) => (
                                  <li key={i}><ChevronRight size={14} className="ttl-wiki-ex-ico" /><span>{ex}</span></li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </article>
                ))}

                {/* Помощь */}
                <div className="ttl-wiki-help">
                  <p className="ttl-wiki-help-title">{t('ui.helpTitle', "Didn't find an answer?")}</p>
                  <p className="ttl-caption">
                    {t('ui.helpBody', 'Write to us and we\'ll add the topic to the wiki.')}{' '}
                    <a href="mailto:SEO@trendtraffic.pro">SEO@trendtraffic.pro</a>
                  </p>
                  <Link className="ttl-ghost ttl-wiki-back" to="/landing">← {t('ui.backHome', 'Back to home')}</Link>
                </div>
              </div>
            </div>
          )}
        </main>

        <TTFooter />
      </div>
    </div>
  );
}

export default WikiPage;
