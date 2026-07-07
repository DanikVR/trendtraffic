/**
 * injected.js — работает в MAIN-мире страницы app.heygen.com (не в изолированном мире
 * расширения), поэтому видит НАСТОЯЩИЕ window.fetch / XMLHttpRequest, которыми студия
 * HeyGen общается со своим бэкендом.
 *
 * Две задачи:
 *   1) РАЗВЕДКА: логировать вызовы студии к её API (api.heygen.com, upload.heygen.com,
 *      resource*.heygen.ai, эндпоинты генерации/загрузки/статуса) — URL, метод, тело, статус.
 *      Это подтверждает ТОЧНЫЕ эндпоинты и то, что генерация идёт под сессией (= списывает
 *      подписку, а не API-кошелёк). Драйвер (content-heygen) повторяет ровно эти вызовы.
 *   2) Перехват Authorization: Bearer — session-токен студии. Драйвер шлёт его в свои
 *      прямые вызовы api.heygen.com (плюс cookies идут сами).
 *
 * НИЧЕГО не блокирует и не модифицирует — только наблюдает. Общение с изолированным
 * content-script — строго через window.postMessage с меткой source.
 */
(() => {
  'use strict';
  const TAG = 'tt-heygen-injected';
  if (window.__ttHeygenInjected) return;
  window.__ttHeygenInjected = true;

  // Хосты/пути, интересные для реверса эндпоинтов студии HeyGen.
  const INTERESTING = [
    'api.heygen.com',
    'upload.heygen.com',
    'heygen.ai',
    'resource',
    '/v2/video',
    '/v1/video',
    'talking_photo',
    'photo_avatar',
    'avatar_iv',
    'video/generate',
    'video_status',
    'remaining_quota',
    'generate',
    'upload',
  ];
  const isInteresting = (url) => {
    const s = String(url || '');
    return INTERESTING.some((k) => s.includes(k));
  };

  const post = (payload) => {
    try { window.postMessage({ source: TAG, ...payload }, window.location.origin); }
    catch { /* сериализация могла упасть — не критично */ }
  };

  // Достаём bearer-токен из заголовков запроса (Headers | plain object | array).
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
      if (typeof body === 'string') return body.slice(0, 4000);
      if (body instanceof URLSearchParams) return body.toString().slice(0, 4000);
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

  post({ kind: 'ready' });
})();
