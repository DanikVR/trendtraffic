/**
 * content-bridge.js — работает на app.trendtraffic.pro (и localhost при разработке).
 * Мост между нашим SPA и расширением БЕЗ externally_connectable (у расширения,
 * раздаваемого .zip и ставящегося вручную, нестабильный ID) — общаемся через
 * window.postMessage:
 *
 *   SPA → расширение:  window.postMessage({ source:'trendtraffic', type:'connect', token, apiBase })
 *   расширение → SPA:  window.postMessage({ source:'tt-flow-ext', type:'connected'|'present'|'status', ... })
 *
 * SPA передаёт JWT текущего пользователя один раз («Подключить расширение» в блоке
 * Google Flow), дальше background сам опрашивает бэкенд. Токен здесь только
 * пробрасывается в background и НЕ хранится в этом content-script.
 */
(() => {
  'use strict';
  if (window.__ttFlowBridge) return;
  window.__ttFlowBridge = true;

  const OUT = 'tt-flow-ext';
  const IN = 'trendtraffic';
  const toPage = (m) => window.postMessage({ source: OUT, ...m }, window.location.origin);
  const toBg = (m) => { try { return chrome.runtime.sendMessage(m); } catch { return Promise.resolve(null); } };

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.source !== IN) return;

    if (d.type === 'connect') {
      const apiBase = d.apiBase || window.location.origin;
      const r = await toBg({ type: 'tt-connect', token: d.token, apiBase });
      toPage({ type: 'connected', ok: !!(r && r.ok), apiBase });
    } else if (d.type === 'disconnect') {
      await toBg({ type: 'tt-disconnect' });
      toPage({ type: 'disconnected' });
    } else if (d.type === 'status') {
      const r = await toBg({ type: 'tt-status' });
      toPage({ type: 'status', ...(r || { connected: false }) });
    }
  });

  // Объявляем присутствие расширения, чтобы SPA показал «установлено» и открыл UI подключения.
  const announce = () => toPage({ type: 'present', version: chrome.runtime.getManifest().version });
  announce();
  document.addEventListener('DOMContentLoaded', announce);
})();
