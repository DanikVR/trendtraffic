/**
 * SocialExtensionPage — вкладка «Social Media Extension».
 *
 * Две секции (как на «Тренды»):
 *   1) «Поиск горячих видео» — переиспользуемый TrendSearch (тот же, что на «Тренды»).
 *   2) «Аналитика» — рехостнутое TikHub-расширение один-в-один в iframe (/social-ext).
 *
 * Поток: нашёл тренды → «Аналитика» на карточке (или «Анализировать выбранные»
 * массово) → переключаемся во вкладку «Аналитика» и скармливаем ссылку расширению
 * через postMessage (polyfill эмулирует переход таба). Массовый разбор — список
 * чипов над расширением, клик по чипу анализирует следующую ссылку.
 *
 * Доступ — только Enterprise (роут гейтится в router.tsx, прокси — на бэке).
 * AI-функции расширения (промпт из обложки, разборы) идут через наш ai-прокси на
 * ключе из настроек Enterprise (см. chrome-polyfill.js + backend social-ext).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, Search, X, Cpu, Check } from 'lucide-react';
import { AuroraButton } from '../components/AuroraButton';
import { useAppStore } from '../store/useAppStore';
import TrendSearch from '../components/TrendSearch';

type Tab = 'search' | 'analytics';
type AiMode = 'cloud' | 'own';

export default function SocialExtensionPage() {
  const { token } = useAppStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [tab, setTab] = useState<Tab>('search');
  const [url, setUrl] = useState('');
  const [queue, setQueue] = useState<{ url: string; cover?: string }[]>([]);
  const appliedRef = useRef<string>('');

  // «Конфигурация ИИ» (vision-модель: промпт из обложки). По умолчанию — облачный
  // ключ Enterprise; можно ввести свой (хранится локально, шлётся прямо провайдеру).
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>('cloud');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'anthropic'>('gemini');
  const [aiKey, setAiKey] = useState('');

  const postToIframe = useCallback((type: string, value?: string) => {
    const win = iframeRef.current?.contentWindow;
    if (win) win.postMessage({ type, url: value ?? '' }, window.location.origin);
  }, []);

  const saveAi = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (win) win.postMessage({ type: 'social-ext:set-ai', ai: { provider: aiProvider, apiKey: aiMode === 'own' ? aiKey.trim() : '' } }, window.location.origin);
    setAiOpen(false);
  }, [aiProvider, aiMode, aiKey]);

  const apply = useCallback((value: string) => {
    appliedRef.current = value;
    postToIframe('social-ext:set-url', value);
  }, [postToIframe]);

  // Анализ одной ссылки → переключиться в «Аналитику» и скормить расширению.
  const analyzeOne = useCallback((webUrl: string) => {
    setQueue([]);
    setUrl(webUrl);
    setTab('analytics');
    apply(webUrl);
  }, [apply]);

  // Массовый анализ → чипы + первая ссылка сразу в работу.
  const analyzeBulk = useCallback((items: { url: string; cover?: string }[]) => {
    if (!items.length) return;
    setQueue(items);
    setUrl(items[0].url);
    setTab('analytics');
    apply(items[0].url);
  }, [apply]);

  const handleAnalyzeInput = useCallback(() => {
    const v = url.trim();
    if (!v) return;
    setQueue([]);
    apply(v);
  }, [url, apply]);

  const handleClear = useCallback(() => {
    setUrl(''); setQueue([]); appliedRef.current = '';
    postToIframe('social-ext:clear-url');
  }, [postToIframe]);

  // Когда polyfill в iframe готов — (пере)отправляем текущий URL (гонка загрузки/reload).
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (ev.data?.type === 'social-ext:ready' && appliedRef.current) {
        postToIframe('social-ext:set-url', appliedRef.current);
      } else if (ev.data?.type === 'social-ext:open-settings') {
        setAiOpen(true); // шестерёнка внутри расширения → «Конфигурация ИИ»
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [postToIframe]);

  const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 36);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Шапка */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Boxes size={20} color="#fff" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-700 leading-tight" style={{ color: 'var(--text-primary)' }}>
            Social Media Extension
          </h1>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
            Поиск горячих видео + TikHub-аналитика TikTok / Douyin / Instagram / X по любой публичной ссылке.
          </p>
        </div>
      </div>

      {/* Переключатель секций */}
      <div className="grid grid-cols-2 sm:inline-grid sm:auto-cols-max sm:grid-flow-col gap-1 p-1 rounded-xl flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
        {([['search', '🔥 Поиск горячих видео'], ['analytics', '📊 Аналитика']] as [Tab, string][]).map(([v, lbl]) => (
          <button key={v} onClick={() => setTab(v)}
            className="px-4 py-2 rounded-lg text-sm font-600 transition-all whitespace-nowrap"
            style={{ background: tab === v ? 'var(--bg-secondary)' : 'transparent', color: tab === v ? '#ff7300' : 'var(--text-muted)', boxShadow: tab === v ? '0 1px 4px rgba(0,0,0,0.12)' : 'none' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Контент: обе секции смонтированы, скрытая прячется (iframe не перезагружается) */}
      <div className="flex-1 min-h-0 relative">
        {/* Поиск */}
        <div className={tab === 'search' ? 'h-full overflow-y-auto space-y-5 pr-0.5' : 'hidden'}>
          <TrendSearch token={token} onAnalyze={(u) => analyzeOne(u)} onAnalyzeBulk={analyzeBulk} />
        </div>

        {/* Аналитика (расширение) */}
        <div className={tab === 'analytics' ? 'h-full flex flex-col gap-2' : 'hidden'}>
          {/* Очередь массового разбора */}
          {queue.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
              <span className="text-[11px] font-600" style={{ color: 'var(--text-muted)' }}>Выбрано {queue.length}:</span>
              {queue.map((q, i) => {
                const active = q.url === appliedRef.current;
                return (
                  <button key={q.url + i} onClick={() => { setUrl(q.url); apply(q.url); }}
                    className="text-[11px] px-2 py-1 rounded-lg font-600 transition-colors truncate max-w-[200px]"
                    title={q.url}
                    style={{ background: active ? 'rgba(255,115,0,0.14)' : 'var(--bg-tertiary)', color: active ? '#ff7300' : 'var(--text-secondary)', border: `1px solid ${active ? '#ff7300' : 'var(--border-medium)'}` }}>
                    {i + 1}. {shortUrl(q.url)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Строка URL: эмулирует «открытый таб браузера» для расширения */}
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyzeInput(); }}
                placeholder="https://www.tiktok.com/@user/video/…  ·  instagram.com/p/…  ·  x.com/…"
                className="w-full pl-11 pr-10 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/40 transition-shadow"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
              />
              {url && (
                <button type="button" onClick={handleClear} title="Очистить"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ color: 'var(--text-muted)' }}>
                  <X size={15} />
                </button>
              )}
            </div>
            <AuroraButton onClick={handleAnalyzeInput} disabled={!url.trim()} className="sm:!w-auto" icon={<Search size={16} />}>
              Анализировать
            </AuroraButton>
            <AuroraButton variant="secondary" onClick={() => setAiOpen(true)} className="sm:!w-auto" icon={<Cpu size={16} />}>
              Конфигурация ИИ
            </AuroraButton>
          </div>

          {/* Само расширение — из собственной сборки в iframe */}
          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden"
               style={{ border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)' }}>
            <iframe
              ref={iframeRef}
              src="/social-ext/sidepanel.html"
              title="Social Media Extension"
              className="w-full h-full block"
              style={{ border: 0 }}
              allow="clipboard-read; clipboard-write; downloads"
            />
          </div>
        </div>
      </div>

      {/* ── Модалка «Конфигурация ИИ» (vision-модель: промпт из обложки) ── */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setAiOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-5 space-y-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                <Cpu size={18} color="#fff" />
              </div>
              <h2 className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Конфигурация ИИ</h2>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Модель машинного зрения извлекает подсказки для генерации изображений из обложек видео.
              Ваш API-ключ хранится локально и отправляется только выбранному поставщику — либо используйте
              облачный ключ из настроек Enterprise.
            </p>

            <div className="space-y-2">
              {([['cloud', 'Платформенный ключ (Enterprise)', 'Облако: ключ из настроек Enterprise → Генерация. Ничего вводить не нужно.'],
                 ['own', 'Свой ключ', 'Хранится локально в браузере, шлётся напрямую поставщику.']] as [AiMode, string, string][]).map(([m, lbl, sub]) => (
                <button key={m} type="button" onClick={() => setAiMode(m)}
                  className="w-full text-left rounded-xl p-3 flex items-start gap-2.5 transition-colors"
                  style={{ background: aiMode === m ? 'rgba(139,92,246,0.10)' : 'var(--bg-tertiary)', border: `1.5px solid ${aiMode === m ? '#8b5cf6' : 'var(--border-medium)'}` }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ border: `2px solid ${aiMode === m ? '#8b5cf6' : 'var(--border-medium)'}`, background: aiMode === m ? '#8b5cf6' : 'transparent' }}>
                    {aiMode === m && <Check size={12} color="#fff" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-700" style={{ color: 'var(--text-primary)' }}>{lbl}</span>
                    <span className="block text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</span>
                  </span>
                </button>
              ))}
            </div>

            {aiMode === 'own' && (
              <div className="space-y-2">
                <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Поставщик
                  <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value as any)}
                    className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/40"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}>
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  API-ключ
                  <input type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder="вставьте ключ поставщика"
                    className="h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/40"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
                </label>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <AuroraButton variant="secondary" onClick={() => setAiOpen(false)}>Отмена</AuroraButton>
              <AuroraButton onClick={saveAi} disabled={aiMode === 'own' && !aiKey.trim()}>Сохранить</AuroraButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
