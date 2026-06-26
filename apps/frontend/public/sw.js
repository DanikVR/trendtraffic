/**
 * VibeVox PWA — minimal no-op service worker.
 *
 * Назначение: Chrome требует наличие зарегистрированного service worker с
 * fetch-handler'ом для того, чтобы показать prompt установки PWA. Кэширование
 * нам сейчас не нужно (приложение SPA + всё статикой раздаётся nginx'ом),
 * поэтому SW просто проксирует все запросы в сеть без модификаций.
 *
 * В будущем сюда можно добавить precache-стратегию (например, через Workbox)
 * для offline-режима, но это отдельная задача — не для PWA-install MVP.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// fetch-handler нужен только для того, чтобы PWA-install prompt сработал.
// Просто отдаём запрос в сеть, ничего не кэшируем.
self.addEventListener('fetch', (event) => {
  // Никакой логики — браузер сам обработает запрос как обычно
});
