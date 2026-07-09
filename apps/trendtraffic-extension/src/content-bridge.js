/**
 * content-bridge.js — работает на app.trendtraffic.pro (и localhost при разработке).
 * Мост между нашим SPA и расширением БЕЗ externally_connectable (у расширения,
 * раздаваемого .zip и ставящегося вручную, нестабильный ID) — общаемся через
 * window.postMessage:
 *
 *   SPA → расширение:  window.postMessage({ source:'trendtraffic', type:'connect', token, apiBase })
 *   расширение → SPA:  window.postMessage({ source:'tt-flow-ext', type:'connected'|'present'|'status', ... })
 *
 * АВТО-ПОДКЛЮЧЕНИЕ (v0.2.2): кнопку «Подключить» жать НЕ обязательно. Content-script
 * читает JWT из localStorage['vibevox_token'] той же страницы и сам отдаёт его в
 * background — пока вы залогинены в TrendTraffic (хоть в одной вкладке), расширение
 * подключено. Токен сменился/пропал (логин/логаут/протух) — реагируем сами.
 * Токен здесь только пробрасывается в background и НЕ хранится в этом content-script.
 */
(() => {
  'use strict';
  if (window.__ttFlowBridge) return;
  window.__ttFlowBridge = true;

  const OUT = 'tt-flow-ext';
  const IN = 'trendtraffic';
  const TOKEN_KEY = 'vibevox_token'; // ключ JWT в localStorage SPA (см. store/useAppStore.ts)
  const toPage = (m) => window.postMessage({ source: OUT, ...m }, window.location.origin);
  const toBg = (m) => { try { return chrome.runtime.sendMessage(m); } catch { return Promise.resolve(null); } };
  const readToken = () => { try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; } };

  // Авто-синк токена: пока в localStorage есть JWT — сами отдаём его расширению.
  let lastToken = null;
  async function syncToken() {
    const token = readToken();
    if (token && token !== lastToken) {
      lastToken = token;
      const apiBase = window.location.origin;
      const r = await toBg({ type: 'tt-connect', token, apiBase });
      toPage({ type: 'connected', ok: !!(r && r.ok), apiBase });
    } else if (!token && lastToken) {
      lastToken = null;
      await toBg({ type: 'tt-disconnect' });
      toPage({ type: 'disconnected' });
    }
  }

  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.source !== IN) return;

    if (d.type === 'connect') {
      // Ручное «Подключить» (фолбэк): берём токен из сообщения либо из localStorage.
      const apiBase = d.apiBase || window.location.origin;
      const token = d.token || readToken();
      lastToken = token;
      const r = await toBg({ type: 'tt-connect', token, apiBase });
      toPage({ type: 'connected', ok: !!(r && r.ok), apiBase });
    } else if (d.type === 'disconnect') {
      lastToken = null;
      await toBg({ type: 'tt-disconnect' });
      toPage({ type: 'disconnected' });
    } else if (d.type === 'status') {
      const r = await toBg({ type: 'tt-status' });
      toPage({ type: 'status', ...(r || { connected: false }) });
    } else if (d.type === 'push-to-flow') {
      // Из Галереи TrendTraffic: открыть Flow и залить туда медиа по URL.
      const r = await toBg({ type: 'push-to-flow', url: d.url, title: d.title, kind: d.kind });
      toPage({ type: 'push-to-flow-result', ok: !!(r && r.ok), error: r && (r.error || r.reason) });
    } else if (d.type === 'list-flow-projects') {
      // Вкладка «Google Flow» Галереи: снять готовые проекты Flow (карточки главной).
      const r = await toBg({ type: 'list-flow-projects' });
      toPage({ type: 'flow-projects', ok: !!(r && r.ok), projects: (r && r.projects) || [], loggedIn: !(r && r.loggedIn === false), error: r && (r.error || r.reason) });
    }
  });

  // Присутствие + авто-синк (сразу, при возврате фокуса и раз в 15с — ловим поздний логин/протух).
  const announce = () => toPage({ type: 'present', version: chrome.runtime.getManifest().version });
  announce(); syncToken();
  document.addEventListener('DOMContentLoaded', () => { announce(); syncToken(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncToken(); });
  window.addEventListener('focus', syncToken);
  setInterval(syncToken, 15000);
})();
