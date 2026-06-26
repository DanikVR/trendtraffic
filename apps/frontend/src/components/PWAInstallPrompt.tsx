/**
 * PWAInstallPrompt — React-обёртка над `<pwa-install>` web-component
 * из пакета @khmyznikov/pwa-install.
 *
 * Архитектура:
 *  - Сам компонент монтируется ОДИН раз в MainLayout (на корне SPA),
 *    отображается невидимо до явного триггера.
 *  - Авто-показ диалога ВКЛЮЧЁН: на Chromium библиотека сама перехватит
 *    `beforeinstallprompt` и покажет диалог; на iOS Safari покажет
 *    инструкцию с шагами "Поделиться → На экран Домой".
 *  - `useLocalStorage` запоминает отказ юзера — повторно не показываем.
 *  - В Telegram Mini App не монтируем вовсе.
 *  - В уже установленной PWA (standalone) сама библиотека ничего не показывает.
 *
 * Тексты name / description / install-description берутся из i18n (ключ
 * `pwaInstall.*` в namespace `common`). Эти три строки покрывают 108
 * языков через нашу обычную пропагацию переводов. Системные кнопки
 * библиотеки ("Install", "Cancel", заголовки секций iOS-инструкции)
 * локализованы силами библиотеки на 28 встроенных языков; для остальных
 * 80 — fallback на EN. Подробно — docs/pwa-install.md §5.
 *
 * Внешний API: хук `usePWAInstall()` возвращает { showInstallDialog }
 * для вызова из любых кнопок UI.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PWAInstall from '@khmyznikov/pwa-install/react-legacy';
import type { PWAInstallElement } from '@khmyznikov/pwa-install';
import { useAppStore } from '../store/useAppStore';

// ─── Module-level singleton ref ──────────────────────────────────────────────
// PWAInstallPrompt монтируется ОДИН раз в дереве React (в MainLayout),
// поэтому module-level переменная корректно ссылается на единственный экземпляр.
// Альтернатива через Context API избыточна для одиночного web-component.
let elementRef: PWAInstallElement | null = null;

export function PWAInstallPrompt() {
  const { t } = useTranslation('common');
  const isMiniApp = useAppStore((s) => s.isMiniApp);
  const ref = useRef<PWAInstallElement>(null);

  useEffect(() => {
    elementRef = ref.current;
    return () => {
      elementRef = null;
    };
  }, []);

  // В Telegram WebView установка PWA недоступна — не монтируем компонент
  if (isMiniApp) return null;

  return (
    <PWAInstall
      ref={ref}
      manifestUrl="/manifest.json"
      name={t('pwaInstall.name')}
      description={t('pwaInstall.description')}
      installDescription={t('pwaInstall.installCta')}
      disableScreenshots
      useLocalStorage
    />
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
/**
 * Возвращает методы и состояние для управления установкой PWA из любых UI-кнопок.
 *
 * - `showInstallDialog()` — открывает диалог принудительно (даже если юзер
 *   ранее отказался и `useLocalStorage` запомнил это).
 * - `isStandalone` — приложение уже запущено в режиме установленной PWA.
 *   В этом состоянии кнопки "Установить" обычно скрывают.
 * - `isAvailable` — общий флаг "имеет смысл показывать кнопку".
 *   Скрывает кнопку в Telegram WebView и в уже установленной PWA.
 */
export function usePWAInstall() {
  const isMiniApp = useAppStore((s) => s.isMiniApp);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      // iOS Safari ставит navigator.standalone когда запустили с home screen
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    // addEventListener поддерживается в современных браузерах;
    // в старых fallback на addListener.
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } else if ((mq as any).addListener) {
      (mq as any).addListener(onChange);
      return () => (mq as any).removeListener(onChange);
    }
  }, []);

  const showInstallDialog = useCallback(() => {
    // showDialog(true) форсирует показ даже если юзер ранее закрыл диалог
    // и `use-local-storage` запомнил это. Это нужное поведение для кнопки
    // ручного триггера — иначе кнопка переставала бы работать после первого
    // отказа.
    elementRef?.showDialog(true);
  }, []);

  const isAvailable = !isStandalone && !isMiniApp;

  return { showInstallDialog, isStandalone, isAvailable };
}

export default PWAInstallPrompt;
