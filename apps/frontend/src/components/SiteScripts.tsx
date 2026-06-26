/**
 * SiteScripts — инжектор произвольного кода суперадмина (cookie-consent,
 * Google Analytics, Meta Pixel, верификация и т.п.).
 *
 * Берёт код из публичного эндпоинта GET /api/auth/site-scripts и вставляет его
 * в <head> и в конец <body> на всех страницах сайта.
 *
 * ПОЧЕМУ ТАК (а не в index.html):
 *  - backend не сервит index.html (только /api и /uploads), а пререндер фронта
 *    статичен (build-time) и не знает про динамический код суперадмина;
 *  - поэтому код подставляется в рантайме на клиенте. Для consent-менеджеров и
 *    аналитики это приемлемо (они и так грузятся асинхронно).
 *
 * ВАЖНО: <script>, вставленные через innerHTML, НЕ исполняются (спека HTML).
 * Поэтому каждый <script> пересоздаётся через document.createElement().
 */

import { useEffect } from 'react';

// Защита от повторного инжекта. Флаг ставится СИНХРОННО в начале эффекта
// (StrictMode в dev монтирует эффект дважды; смена роутов в SPA не должна
// плодить дубли скриптов). Сбрасывается только при полной перезагрузке страницы
// — что нам и нужно (инжектим один раз на загрузку документа).
let claimed = false;

/**
 * Вставляет произвольный HTML-фрагмент в target, пересоздавая <script> так,
 * чтобы они исполнились. Прочие узлы (noscript/meta/link/div баннера) клонируются.
 */
function injectHtml(rawHtml: string, target: HTMLElement, marker: string): void {
  if (!rawHtml || !rawHtml.trim()) return;

  const tpl = document.createElement('template');
  tpl.innerHTML = rawHtml;

  Array.from(tpl.content.childNodes).forEach((node) => {
    if (node.nodeName === 'SCRIPT') {
      const old = node as HTMLScriptElement;
      const script = document.createElement('script');
      // Переносим все атрибуты (src, type, async, defer, data-*, charset…).
      for (const attr of Array.from(old.attributes)) {
        script.setAttribute(attr.name, attr.value);
      }
      // Внешние скрипты без явного async/defer: динамически добавленный <script>
      // по умолчанию async=true → порядок исполнения не гарантирован. Форсим
      // последовательное исполнение (важно, напр., consent-менеджер ДО аналитики).
      if (old.src && !old.async && !old.defer) script.async = false;
      script.text = old.textContent || '';
      script.setAttribute(marker, '');
      target.appendChild(script);
    } else {
      const clone = node.cloneNode(true);
      if (clone.nodeType === Node.ELEMENT_NODE) {
        (clone as HTMLElement).setAttribute(marker, '');
      }
      target.appendChild(clone);
    }
  });
}

export function SiteScripts() {
  useEffect(() => {
    if (claimed) return;
    // HMR в dev перезагружает модуль (claimed → false), но DOM остаётся:
    // если коды уже вставлены — не дублируем.
    if (document.querySelector('[data-vibevox-head], [data-vibevox-body]')) {
      claimed = true;
      return;
    }
    claimed = true; // синхронный «захват»: второй mount StrictMode сразу выйдет выше

    // Инжект НЕ привязан к жизненному циклу компонента: это разовый глобальный
    // сайд-эффект, его нельзя отменять при размонтировании (иначе в StrictMode
    // первый mount отменит единственный fetch, а второй уже выйдет по claimed).
    (async () => {
      try {
        const res = await fetch('/api/auth/site-scripts');
        if (!res.ok) return;
        const data = await res.json();
        injectHtml(data?.headCode || '', document.head, 'data-vibevox-head');
        injectHtml(data?.bodyCode || '', document.body, 'data-vibevox-body');
      } catch {
        // нет кода / сеть недоступна — тихо игнорируем, сайт работает дальше
      }
    })();
  }, []);

  return null;
}
