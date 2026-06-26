/**
 * Точка входа React-приложения VibeVox.
 *
 * Выполняет:
 * 1. Инициализацию i18next (12 языков с поддержкой RTL)
 * 2. Инициализацию Telegram WebApp SDK (с fallback для обычного браузера)
 * 3. Рендер корневого компонента <App />
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './config/i18n'; // Инициализация i18next (побочный эффект)
import { useAppStore } from './store/useAppStore';

// ============================================================================================
// Инициализация Telegram Mini App SDK
// ============================================================================================

/**
 * Безопасная инициализация Telegram WebApp.
 * Если приложение запущено вне Telegram — SDK не будет доступен,
 * обрабатываем это gracefully для dev-окружения.
 */
function initTelegramWebApp(): boolean {
  try {
    // Проверяем наличие Telegram WebApp в глобальном контексте
    const tg = (window as any).Telegram?.WebApp;

    if (tg && tg.initData) {
      // Сообщаем Telegram, что приложение готово
      tg.ready();
      tg.expand(); // Раскрываем на весь экран

      // Настраиваем тему под Telegram
      if (tg.colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
      }

      console.log('[VibeVox] Telegram Mini App инициализирован');
      return true;
    }
  } catch (err) {
    console.warn('[VibeVox] Telegram WebApp SDK недоступен (режим браузера):', err);
  }

  return false;
}

// Определяем контекст запуска
const isMiniApp = initTelegramWebApp();
useAppStore.getState().setMiniApp(isMiniApp);

// ============================================================================================
// Инициализация темы
// ============================================================================================

/**
 * Тёмная тема — по умолчанию.
 * Пользователь может переключить в SettingsPage (сохраняется в localStorage).
 */
function initTheme() {
  const saved = localStorage.getItem('vibevox_theme');
  // Если пользователь явно выбрал светлую тему — оставляем без .dark
  if (saved === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // Иначе всегда dark (включая 'dark', null — первый запуск)
    document.documentElement.classList.add('dark');
    if (!saved) localStorage.setItem('vibevox_theme', 'dark');
  }
}
initTheme();

// ============================================================================================
// Рендер React-приложения
// ============================================================================================

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Критическая ошибка: элемент #root не найден в DOM!');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ============================================================================================
// Service Worker регистрация (только в production, иначе ломает Vite HMR)
// ============================================================================================
// Service worker нужен для того, чтобы Chrome показал prompt установки PWA
// (по требованиям Chromium). В dev-режиме Vite сам обслуживает запросы, поэтому
// регистрация SW мешает: после второй перезагрузки SW перехватывает HMR-пуш.
// В production SW лежит на /sw.js (apps/frontend/public/sw.js — no-op,
// ничего не кэширует).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[VibeVox] Service worker зарегистрирован, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[VibeVox] Не удалось зарегистрировать service worker:', err);
      });
  });
}
