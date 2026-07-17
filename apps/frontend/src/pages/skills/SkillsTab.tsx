/**
 * SkillsTab — вкладка «Скиллы» в Галерее-хабе: три инструмента по механике aicube.
 *
 *  1. Найди виралку — find-only поиск виральных роликов (TikHub) → таблица ссылок
 *     с метриками + честная сноска охвата.
 *  2. Антиклише — зачистка текста от нейросетевых штампов (11 категорий) →
 *     чистый текст + таблица правок «Было/Стало».
 *  3. Формула подписи — caption по структуре «хук → личный опыт → CTA с кодовым
 *     словом» + 3 варианта хука на выбор.
 *
 * Всё входит в подписку; Claude/TikHub — BYO-ключи из Настроек. Ошибки — видимым
 * текстом под кнопками (канон), включая «нет ключа — добавьте в Настройках».
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Eraser, MessageSquareQuote, Loader2, Copy, Check, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

function CopyBtn({ text }: { text: string }) {
  const { t } = useTranslation('common');
  const [done, setDone] = useState(false);
  return (
    <button type="button"
      onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
      title={t('sec.skills.copy', 'Скопировать')}
      className="w-[25px] h-[25px] rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: 'var(--bg-elevated)', color: done ? '#34d399' : 'var(--text-muted)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

const nfmt = (n: number | null) => (n == null ? 'n/a' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(n));

export function SkillsTab() {
  const { t } = useTranslation('common');
  const token = useAppStore((s) => s.token);
  const auth = (): HeadersInit => ({ ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' });

  // ── найди-виралку ──
  const [fvTopic, setFvTopic] = useState('');
  const [fvDays, setFvDays] = useState('');
  const [fvViews, setFvViews] = useState('');
  const [fvBusy, setFvBusy] = useState(false);
  const [fvErr, setFvErr] = useState<string | null>(null);
  const [fvRes, setFvRes] = useState<{ items: any[]; coverage: string } | null>(null);

  const runFind = async () => {
    if (fvBusy || fvTopic.trim().length < 2) { setFvErr(t('sec.skills.fvNeedTopic', 'Укажите тему поиска.')); return; }
    setFvBusy(true); setFvErr(null);
    try {
      const r = await fetch('/api/skills/find-viral', {
        method: 'POST', headers: auth(),
        body: JSON.stringify({
          topic: fvTopic.trim(),
          days: fvDays ? Number(fvDays) : undefined,
          minViews: fvViews ? Number(fvViews) : undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Поиск не удался');
      setFvRes({ items: d.items || [], coverage: d.coverage || '' });
    } catch (e: any) { setFvErr(e?.message); setFvRes(null); }
    finally { setFvBusy(false); }
  };

  // ── антиклише ──
  const [acText, setAcText] = useState('');
  const [acBusy, setAcBusy] = useState(false);
  const [acErr, setAcErr] = useState<string | null>(null);
  const [acRes, setAcRes] = useState<{ clean: boolean; verdict: string; cleaned: string; changes: any[]; questions: string[] } | null>(null);

  const runAc = async () => {
    if (acBusy || acText.trim().length < 20) { setAcErr(t('sec.skills.acNeedText', 'Вставьте текст (от 20 символов).')); return; }
    setAcBusy(true); setAcErr(null);
    try {
      const r = await fetch('/api/skills/anticliche', { method: 'POST', headers: auth(), body: JSON.stringify({ text: acText }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Не удалось обработать текст');
      setAcRes(d);
    } catch (e: any) { setAcErr(e?.message); setAcRes(null); }
    finally { setAcBusy(false); }
  };

  // ── формула подписи ──
  const [cpTopic, setCpTopic] = useState('');
  const [cpWord, setCpWord] = useState('');
  const [cpLink, setCpLink] = useState('');
  const [cpBusy, setCpBusy] = useState(false);
  const [cpErr, setCpErr] = useState<string | null>(null);
  const [cpRes, setCpRes] = useState<{ caption: string; hooks: string[]; hashtags: string[]; codeWord: string } | null>(null);

  const runCp = async () => {
    if (cpBusy || cpTopic.trim().length < 3) { setCpErr(t('sec.skills.cpNeedTopic', 'Опишите тему поста.')); return; }
    setCpBusy(true); setCpErr(null);
    try {
      const r = await fetch('/api/skills/caption', {
        method: 'POST', headers: auth(),
        body: JSON.stringify({ topic: cpTopic.trim(), codeWord: cpWord.trim() || undefined, link: cpLink.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || 'Не удалось сгенерировать подпись');
      setCpRes(d);
    } catch (e: any) { setCpErr(e?.message); setCpRes(null); }
    finally { setCpBusy(false); }
  };

  /** Заменить первую строку подписи выбранным хуком. */
  const swapHook = (hook: string) => {
    if (!cpRes) return;
    const parts = cpRes.caption.split('\n');
    let i = 0;
    while (i < parts.length && !parts[i].trim()) i++;
    parts[i] = hook;
    setCpRes({ ...cpRes, caption: parts.join('\n') });
  };

  const card: React.CSSProperties = { background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' };
  const inputStyle: React.CSSProperties = { background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' };
  const btnPrimary: React.CSSProperties = { background: 'var(--brand)', color: 'var(--brand-contrast)', border: 'none', cursor: 'pointer' };
  const errBox = (msg: string) => (
    <div className="px-3 py-2 rounded-xl text-[12px] flex items-start gap-2"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
      <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> <span>{msg}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
        {t('sec.skills.intro', 'Три скилла контент-конвейера. Работают на ваших ключах из Настроек: поиск — TikHub, тексты — Claude (Anthropic). Эти же скиллы доступны Claude через наш MCP-коннектор (скоуп «skills:use»).')}
      </p>

      {/* ═══ 1. Найди виралку ═══ */}
      <div className="rounded-2xl p-4 flex flex-col gap-3" style={card}>
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}><Search size={17} /></span>
          <div>
            <div className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.skills.fvTitle', 'Найди виралку')}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('sec.skills.fvSub', 'По теме находит виральные ролики и отдаёт ссылки. Только находит — ничего не скачивает.')}</div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input value={fvTopic} onChange={(e) => setFvTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runFind(); }}
            placeholder={t('sec.skills.fvTopicPh', 'Тема или ниша: «нейросети для бизнеса»')}
            className="flex-1 min-w-[180px] text-[12px] rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
          <input value={fvDays} onChange={(e) => setFvDays(e.target.value.replace(/\D/g, ''))} placeholder={t('sec.skills.fvDaysPh', 'дней')}
            className="w-[76px] text-[12px] rounded-xl px-3 py-2.5 outline-none" style={inputStyle} title={t('sec.skills.fvDaysHint', 'Свежесть в днях')} />
          <input value={fvViews} onChange={(e) => setFvViews(e.target.value.replace(/\D/g, ''))} placeholder={t('sec.skills.fvViewsPh', 'мин. просмотров')}
            className="w-[130px] text-[12px] rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
          <button type="button" onClick={() => void runFind()} disabled={fvBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-700 disabled:opacity-50" style={btnPrimary}>
            {fvBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} {t('sec.skills.fvRun', 'Найти')}
          </button>
        </div>
        {fvErr && errBox(fvErr)}
        {fvRes && (
          <div className="flex flex-col gap-2">
            {!fvRes.items.length && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{t('sec.skills.fvEmpty', 'Ничего не нашлось под критерии — ослабьте фильтры.')}</p>}
            {fvRes.items.map((v) => (
              <a key={v.rank} href={v.url} target="_blank" rel="noreferrer"
                className="rounded-xl p-2.5 flex items-center gap-3"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}>
                <span className="text-[11px] font-700 w-5 text-center flex-shrink-0" style={{ color: 'var(--brand)' }}>{v.rank}</span>
                {v.cover ? <img src={v.cover} alt="" className="w-9 h-12 rounded-lg object-cover flex-shrink-0" /> : null}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] truncate" style={{ color: 'var(--text-primary)' }}>{v.title || v.author || v.url}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {v.platform} · @{v.author} · {nfmt(v.views)} {t('sec.skills.views', 'просм.')} · {nfmt(v.likes)} ♥ · {v.publishedAt || 'n/a'}
                  </div>
                </div>
                <ExternalLink size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              </a>
            ))}
            {fvRes.coverage && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fvRes.coverage}</p>}
          </div>
        )}
      </div>

      {/* ═══ 2. Антиклише ═══ */}
      <div className="rounded-2xl p-4 flex flex-col gap-3" style={card}>
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}><Eraser size={17} /></span>
          <div>
            <div className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.skills.acTitle', 'Антиклише')}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('sec.skills.acSub', 'Вычищает нейросетевые штампы, чтобы текст звучал по-человечески. Факты не выдумывает.')}</div>
          </div>
        </div>
        <textarea value={acText} onChange={(e) => setAcText(e.target.value)} rows={5}
          placeholder={t('sec.skills.acPh', 'Вставьте текст поста, подписи или сценария…')}
          className="w-full text-[12px] rounded-xl px-3 py-2.5 outline-none resize-y" style={inputStyle} />
        <button type="button" onClick={() => void runAc()} disabled={acBusy}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-700 self-start disabled:opacity-50" style={btnPrimary}>
          {acBusy ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />} {t('sec.skills.acRun', 'Прогнать через антиклише')}
        </button>
        {acErr && errBox(acErr)}
        {acRes && (
          <div className="flex flex-col gap-2">
            {acRes.verdict && (
              <p className="text-[11px]" style={{ color: acRes.clean ? '#34d399' : 'var(--text-secondary)' }}>{acRes.verdict}</p>
            )}
            <div className="rounded-xl p-3 flex gap-2" style={{ background: 'var(--bg-tertiary)' }}>
              <p className="text-[12px] whitespace-pre-wrap flex-1" style={{ color: 'var(--text-primary)' }}>{acRes.cleaned}</p>
              <CopyBtn text={acRes.cleaned} />
            </div>
            {acRes.changes.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="text-[10px] font-700 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('sec.skills.acChanges', 'Было → стало')}</div>
                {acRes.changes.map((c, i) => (
                  <div key={i} className="text-[11px] rounded-lg px-2.5 py-1.5" style={{ background: 'var(--bg-tertiary)' }}>
                    <span style={{ color: '#f87171', textDecoration: 'line-through' }}>{c.before}</span>
                    <span style={{ color: 'var(--text-muted)' }}> → </span>
                    <span style={{ color: '#34d399' }}>{c.after || t('sec.skills.acRemoved', '(удалено)')}</span>
                    <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{c.type}</span>
                  </div>
                ))}
              </div>
            )}
            {acRes.questions.length > 0 && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {t('sec.skills.acQuestions', 'Автору: ')} {acRes.questions.join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ═══ 3. Формула подписи ═══ */}
      <div className="rounded-2xl p-4 flex flex-col gap-3" style={card}>
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,92,255,0.12)', color: '#7c5cff' }}><MessageSquareQuote size={17} /></span>
          <div>
            <div className="text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{t('sec.skills.cpTitle', 'Формула подписи')}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t('sec.skills.cpSub', 'Caption по структуре: хук → личный опыт → что решает → CTA с кодовым словом. До 1000 символов.')}</div>
          </div>
        </div>
        <textarea value={cpTopic} onChange={(e) => setCpTopic(e.target.value)} rows={3}
          placeholder={t('sec.skills.cpTopicPh', 'О чём пост: тема, продукт, главная мысль, что получит зритель…')}
          className="w-full text-[12px] rounded-xl px-3 py-2.5 outline-none resize-y" style={inputStyle} />
        <div className="flex gap-2 flex-wrap">
          <input value={cpWord} onChange={(e) => setCpWord(e.target.value)} placeholder={t('sec.skills.cpWordPh', 'Кодовое слово (или придумает сам)')}
            className="flex-1 min-w-[160px] text-[12px] rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
          <input value={cpLink} onChange={(e) => setCpLink(e.target.value)} placeholder={t('sec.skills.cpLinkPh', 'Ссылка (опц.)')}
            className="flex-1 min-w-[160px] text-[12px] rounded-xl px-3 py-2.5 outline-none" style={inputStyle} />
          <button type="button" onClick={() => void runCp()} disabled={cpBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-700 disabled:opacity-50" style={btnPrimary}>
            {cpBusy ? <Loader2 size={14} className="animate-spin" /> : <MessageSquareQuote size={14} />} {t('sec.skills.cpRun', 'Написать подпись')}
          </button>
        </div>
        {cpErr && errBox(cpErr)}
        {cpRes && (
          <div className="flex flex-col gap-2">
            <div className="rounded-xl p-3 flex gap-2" style={{ background: 'var(--bg-tertiary)' }}>
              <p className="text-[12px] whitespace-pre-wrap flex-1" style={{ color: 'var(--text-primary)' }}>{cpRes.caption}</p>
              <CopyBtn text={cpRes.caption} />
            </div>
            {cpRes.hooks.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="text-[10px] font-700 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{t('sec.skills.cpHooks', '3 варианта хука — клик заменит первую строку')}</div>
                {cpRes.hooks.map((h, i) => (
                  <button key={i} type="button" onClick={() => swapHook(h)}
                    className="text-left text-[11px] rounded-lg px-2.5 py-1.5"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    {i + 1}. {h}
                  </button>
                ))}
              </div>
            )}
            {cpRes.hashtags.length > 0 && (
              <p className="text-[11px]" style={{ color: 'var(--brand)' }}>{cpRes.hashtags.join(' ')}</p>
            )}
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {t('sec.skills.cpCtaNote', 'Кодовое слово {{w}} — используйте его же в финальной CTA-панели Сториборда.', { w: cpRes.codeWord || '—' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SkillsTab;
