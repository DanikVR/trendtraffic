/**
 * SocialExtensionPage — вкладка «Social Media Extension».
 *
 * Запускает ОДИН-В-ОДИН открытое TikHub-расширение (его собственные собранные
 * sidepanel + background), рехостнутое в /social-ext/ (apps/frontend/public).
 * Внутри iframe работает chrome-polyfill, который:
 *   • переписывает запросы к api.tikhub.io на наш backend-прокси
 *     /api/social-ext/proxy с JWT приложения (ключ TikHub подставляет сервер);
 *   • эмулирует «текущий таб браузера» по URL, который пользователь вводит здесь.
 * Сам код расширения НЕ меняется — дизайн и логика идентичны.
 *
 * Расширение анализирует «активный таб». В вебе таба нет, поэтому строка ниже
 * отправляет URL в iframe через postMessage, а polyfill эмулирует переход таба —
 * расширение реагирует так же, как если бы вы открыли эту ссылку в браузере.
 *
 * Доступ — только Enterprise (роут гейтится в router.tsx, прокси — на бэке).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, Search, X } from 'lucide-react';
import { AuroraButton } from '../components/AuroraButton';

export default function SocialExtensionPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [url, setUrl] = useState('');
  const appliedRef = useRef<string>('');

  const postToIframe = useCallback((type: string, value?: string) => {
    const win = iframeRef.current?.contentWindow;
    if (win) win.postMessage({ type, url: value ?? '' }, window.location.origin);
  }, []);

  const apply = useCallback((value: string) => {
    appliedRef.current = value;
    postToIframe('social-ext:set-url', value);
  }, [postToIframe]);

  const handleAnalyze = useCallback(() => {
    const v = url.trim();
    if (!v) return;
    apply(v);
  }, [url, apply]);

  const handleClear = useCallback(() => {
    setUrl('');
    appliedRef.current = '';
    postToIframe('social-ext:clear-url');
  }, [postToIframe]);

  // Когда polyfill в iframe сообщит о готовности — (пере)отправляем текущий URL
  // (закрывает гонку: iframe мог загрузиться после ввода ссылки или при reload).
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      if (ev.data?.type === 'social-ext:ready' && appliedRef.current) {
        postToIframe('social-ext:set-url', appliedRef.current);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [postToIframe]);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Компактная шапка приложения (chrome вкладки, не часть расширения) */}
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
            TikHub-аналитика TikTok / Douyin / Instagram / X — вставьте публичную ссылку на видео или аккаунт.
          </p>
        </div>
      </div>

      {/* Строка URL: эмулирует «открытый таб браузера» для расширения */}
      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
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
        <AuroraButton onClick={handleAnalyze} disabled={!url.trim()} className="sm:!w-auto" icon={<Search size={16} />}>
          Анализировать
        </AuroraButton>
      </div>

      {/* Само расширение — рендерится из собственной сборки в iframe */}
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
  );
}
