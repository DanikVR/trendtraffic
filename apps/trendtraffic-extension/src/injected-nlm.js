/**
 * injected-nlm.js — работает в MAIN-мире страницы NotebookLM (не в изолированном
 * мире расширения), поэтому видит НАСТОЯЩИЕ window.fetch / XMLHttpRequest,
 * которыми NotebookLM общается со своим бэкендом (batchexecute / _/LabsTailwind…).
 *
 * Задачи (по образцу injected.js для Flow, но со своим набором «интересных» путей
 * и своей меткой source, чтобы content-notebook.js не путал их с Flow-разведкой):
 *   1) РАЗВЕДКА: логировать запросы NotebookLM к его внутреннему API (URL/метод/статус).
 *   2) Перехват Authorization: Bearer — токен сессии.
 * НИЧЕГО не блокирует — только наблюдает. Общение с content-script — через
 * window.postMessage с меткой source='tt-nlm-injected'.
 */
(() => {
  'use strict';
  const TAG = 'tt-nlm-injected';
  if (window.__ttNlmInjected) return;
  window.__ttNlmInjected = true;

  // Хосты/пути, интересные для реверса эндпоинтов NotebookLM.
  const INTERESTING = [
    'notebooklm.google.com/_/',
    'batchexecute',
    'LabsTailwind',
    'assistant.google',
    'generativelanguage.googleapis.com',
    ':generate',
    'wiz_batch',
  ];
  const isInteresting = (url) => {
    const s = String(url || '');
    return INTERESTING.some((k) => s.includes(k));
  };

  const post = (payload) => {
    try {
      window.postMessage({ source: TAG, ...payload }, window.location.origin);
    } catch { /* сериализация могла упасть — не критично */ }
  };

  const grabBearer = (headers) => {
    try {
      let auth = '';
      if (!headers) return '';
      if (headers instanceof Headers) auth = headers.get('authorization') || '';
      else if (Array.isArray(headers)) {
        const h = headers.find((p) => String(p[0]).toLowerCase() === 'authorization');
        auth = h ? h[1] : '';
      } else if (typeof headers === 'object') {
        for (const k of Object.keys(headers)) {
          if (k.toLowerCase() === 'authorization') { auth = headers[k]; break; }
        }
      }
      if (auth && /^bearer /i.test(auth)) return auth;
    } catch { /* игнор */ }
    return '';
  };

  const trimBody = (body) => {
    try {
      if (body == null) return undefined;
      if (typeof body === 'string') return body.slice(0, 2000);
      if (body instanceof URLSearchParams) return body.toString().slice(0, 2000);
      return `[${body.constructor ? body.constructor.name : typeof body}]`;
    } catch { return undefined; }
  };

  // --- перехват fetch ---
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || (input && input.method) || 'GET';
    const reqHeaders = (init && init.headers) || (input && input.headers);
    const bearer = grabBearer(reqHeaders);
    if (bearer) post({ kind: 'bearer', token: bearer });

    const p = origFetch.apply(this, arguments);
    if (isInteresting(url)) {
      const started = Date.now();
      p.then((res) => {
        post({ kind: 'api', via: 'fetch', url, method, status: res.status, ms: Date.now() - started, reqBody: trimBody(init && init.body) });
      }).catch((e) => {
        post({ kind: 'api', via: 'fetch', url, method, status: 0, error: String(e && e.message || e) });
      });
    }
    return p;
  };

  // --- перехват XHR ---
  const XO = XMLHttpRequest.prototype.open;
  const XS = XMLHttpRequest.prototype.send;
  const XH = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__tt = { method, url, headers: {} };
    return XO.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      if (this.__tt) this.__tt.headers[name] = value;
      if (String(name).toLowerCase() === 'authorization' && /^bearer /i.test(value)) {
        post({ kind: 'bearer', token: value });
      }
    } catch { /* игнор */ }
    return XH.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const meta = this.__tt;
    if (meta && isInteresting(meta.url)) {
      const started = Date.now();
      this.addEventListener('loadend', () => {
        post({ kind: 'api', via: 'xhr', url: meta.url, method: meta.method, status: this.status, ms: Date.now() - started, reqBody: trimBody(body) });
      });
    }
    return XS.apply(this, arguments);
  };

  // --- ПЕРЕХВАТ СКАЧИВАНИЯ АРТЕФАКТА (blob) ---
  // Готовый аудио/видео NotebookLM отдаёт как Blob → URL.createObjectURL → клик по <a download>.
  // chrome.downloads в service worker такой blob: НЕ стянет (нет доступа к blob другого контекста).
  // MAIN-мир СВОЙ blob видит → читаем байты здесь и отдаём content-скрипту base64-ом.
  const blobByUrl = new Map();
  const origCreateObjURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (obj) {
    const u = origCreateObjURL(obj);
    try {
      if (obj instanceof Blob) {
        blobByUrl.set(u, obj);
        if (blobByUrl.size > 24) blobByUrl.delete(blobByUrl.keys().next().value);
      }
    } catch { /* игнор */ }
    return u;
  };
  async function captureDownload(href, fileName) {
    try {
      let blob = blobByUrl.get(href);
      if (!blob) { const r = await origFetch.call(window, href, { credentials: 'include' }); blob = await r.blob(); }
      if (!blob || blob.size < 64) return;
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      const mime = blob.type || 'application/octet-stream';
      post({ kind: 'artifact-blob', mime, size: blob.size, fileName: fileName || '', dataUrl: 'data:' + mime + ';base64,' + btoa(bin) });
    } catch (e) { post({ kind: 'artifact-blob-error', error: String((e && e.message) || e) }); }
  }
  const origAClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    try {
      const href = this.href || '';
      const dl = this.getAttribute('download');
      // Скачивание артефакта: <a download> ИЛИ blob:/googleusercontent-ссылка.
      if (href && (dl != null || /^blob:|googleusercontent|\.mp3|\.mp4|\.m4a|\.wav/i.test(href))) captureDownload(href, dl || '');
    } catch { /* игнор */ }
    return origAClick.apply(this, arguments);
  };

  post({ kind: 'ready' });
})();
