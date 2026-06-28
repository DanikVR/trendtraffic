/*
 * chrome-polyfill.js — мост, позволяющий собранному TikHub-расширению (sidepanel +
 * background) работать БЕЗ ИЗМЕНЕНИЙ внутри обычной веб-страницы (iframe вкладки
 * «Social Media Extension»).
 *
 * Загружается КЛАССИЧЕСКИМ <script> до module-бандла, поэтому определяет
 * window.chrome и подменяет fetch ДО старта расширения.
 *
 * Что делает:
 *  1. chrome.storage.local/sync  → localStorage (одинаковый origin с приложением).
 *  2. Засев settings = { apiKey, apiBaseUrl } → онбординг пропускается, проверка
 *     base-url проходит. Реальный ключ TikHub подставляет backend-прокси.
 *  3. chrome.runtime messaging (sendMessage/onMessage) — внутри-страничный мост:
 *     sidepanel ↔ background живут в одном окне, сообщения доставляются напрямую.
 *  4. tabs/permissions/sidePanel/i18n/downloads — заглушки/нативные эквиваленты.
 *  5. fetch к api.tikhub.io|dev → same-origin /api/social-ext/proxy с JWT приложения
 *     (из localStorage['vibevox_token']). Прочие запросы — без изменений.
 *
 * Это НАШ адаптер; код самого расширения не правится.
 */
(function () {
  'use strict';
  if (window.chrome && window.chrome.__tt_social_ext) return;

  var EXT_BASE = '/social-ext/';
  var PROXY_PREFIX = '/api/social-ext/proxy';
  var AI_PROXY_PREFIX = '/api/social-ext/ai-proxy';
  var MEDIA_PREFIX = '/api/social-ext/media';
  var TIKHUB_HOSTS = { 'api.tikhub.io': 1, 'api.tikhub.dev': 1 };
  var AI_HOSTS = { 'generativelanguage.googleapis.com': 1, 'api.openai.com': 1, 'api.anthropic.com': 1 };
  var AI_PLACEHOLDER = 'managed-by-trendtraffic'; // settings.ai.apiKey == это → «облачный» режим (ключ Enterprise)
  // Хосты CDN изображений/видео (НЕ сами сайты) — их fetch роутим через медиа-прокси (Referer + same-origin).
  var CDN_SUFFIXES = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'tiktokv.us', 'tiktokv.com',
    'ibyteimg.com', 'byteimg.com', 'muscdn.com', 'bytecdntp.com', 'bytedance.com', 'bdstatic.com', 'zjcdn.com', 'snssdk.com',
    'douyinpic.com', 'douyincdn.com', 'douyinstatic.com', 'cdninstagram.com', 'fbcdn.net', 'twimg.com',
    'hdslb.com', 'biliimg.com', 'bilivideo.com'];
  var TOKEN_KEY = 'vibevox_token';
  var SETTINGS_KEY = 'sx_local_settings'; // localStorage-ключ объекта settings
  function appToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function readSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } }
  // «Облако» по умолчанию: ai.apiKey пуст/плейсхолдер → AI идёт через наш ai-прокси (ключ Enterprise).
  function aiIsCloud() { var s = readSettings(); return !s.ai || !s.ai.apiKey || s.ai.apiKey === AI_PLACEHOLDER; }
  function isCdnHost(host) { host = (host || '').toLowerCase(); for (var i = 0; i < CDN_SUFFIXES.length; i++) { var s = CDN_SUFFIXES[i]; if (host === s || host.slice(-(s.length + 1)) === '.' + s) return true; } return false; }

  // ── Событие в стиле chrome.* (addListener/removeListener/hasListener + _emit) ──
  function makeEvent() {
    var ls = [];
    return {
      addListener: function (fn) { if (typeof fn === 'function' && ls.indexOf(fn) < 0) ls.push(fn); },
      removeListener: function (fn) { var i = ls.indexOf(fn); if (i >= 0) ls.splice(i, 1); },
      hasListener: function (fn) { return ls.indexOf(fn) >= 0; },
      hasListeners: function () { return ls.length > 0; },
      _emit: function () { var a = arguments; ls.slice().forEach(function (fn) { try { fn.apply(null, a); } catch (e) { console.error('[social-ext] listener error', e); } }); },
      _listeners: ls,
    };
  }

  // ── storage area поверх localStorage ──
  function makeStorageArea(prefix, onChanged) {
    function k(name) { return prefix + name; }
    function readOne(name) {
      var raw = localStorage.getItem(k(name));
      if (raw == null) return undefined;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    }
    function allKeys() {
      var out = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(prefix) === 0) out.push(key.slice(prefix.length));
      }
      return out;
    }
    function resolve(keys) {
      var res = {};
      if (keys == null) { allKeys().forEach(function (n) { res[n] = readOne(n); }); return res; }
      if (typeof keys === 'string') { var v = readOne(keys); if (v !== undefined) res[keys] = v; return res; }
      if (Array.isArray(keys)) { keys.forEach(function (n) { var v = readOne(n); if (v !== undefined) res[n] = v; }); return res; }
      // объект с дефолтами
      Object.keys(keys).forEach(function (n) { var v = readOne(n); res[n] = v === undefined ? keys[n] : v; });
      return res;
    }
    function finish(cb, value) { if (typeof cb === 'function') { try { cb(value); } catch (e) { console.error(e); } return undefined; } return Promise.resolve(value); }

    return {
      get: function (keys, cb) { if (typeof keys === 'function') { cb = keys; keys = null; } return finish(cb, resolve(keys)); },
      set: function (items, cb) {
        var changes = {};
        Object.keys(items || {}).forEach(function (n) {
          var oldVal = readOne(n);
          try { localStorage.setItem(k(n), JSON.stringify(items[n])); } catch (e) { console.error('[social-ext] storage.set', e); }
          changes[n] = { oldValue: oldVal, newValue: items[n] };
        });
        if (onChanged && Object.keys(changes).length) onChanged(changes);
        return finish(cb, undefined);
      },
      remove: function (keys, cb) {
        var arr = Array.isArray(keys) ? keys : [keys]; var changes = {};
        arr.forEach(function (n) { var oldVal = readOne(n); localStorage.removeItem(k(n)); changes[n] = { oldValue: oldVal, newValue: undefined }; });
        if (onChanged) onChanged(changes);
        return finish(cb, undefined);
      },
      clear: function (cb) {
        var changes = {}; allKeys().forEach(function (n) { changes[n] = { oldValue: readOne(n), newValue: undefined }; localStorage.removeItem(k(n)); });
        if (onChanged) onChanged(changes);
        return finish(cb, undefined);
      },
    };
  }

  var onChangedEvt = makeEvent();
  var localArea = makeStorageArea('sx_local_', function (changes) { onChangedEvt._emit(changes, 'local'); });
  var syncArea = makeStorageArea('sx_sync_', function (changes) { onChangedEvt._emit(changes, 'sync'); });

  // ── Засев settings (один раз): пропускаем онбординг (TikHub) + включаем AI на
  //    «облачном» (Enterprise) ключе. Реальные ключи подставляют наши прокси. ──
  try {
    localArea.get('settings', function (r) {
      var prev = (r && r.settings) || {};
      var changed = false;
      if (!prev.apiKey) { prev.apiKey = AI_PLACEHOLDER; changed = true; }
      if (prev.apiBaseUrl !== 'https://api.tikhub.io') { prev.apiBaseUrl = 'https://api.tikhub.io'; changed = true; }
      // Расширение читает ключ из ai.apiKeys[provider] и ai.geminiVideoKey (видео-анализ),
      // а не из ai.apiKey. Засеваем ВСЕ поля плейсхолдером (реальный ключ ставит ai-прокси).
      var ai = prev.ai || {};
      if (!ai.apiKey || !(ai.apiKeys && ai.apiKeys.gemini) || !ai.geminiVideoKey) {
        ai.provider = ai.provider || 'gemini';
        if (typeof ai.model !== 'string') ai.model = '';
        ai.apiKey = ai.apiKey || AI_PLACEHOLDER;
        ai.apiKeys = Object.assign({ gemini: '', openai: '', anthropic: '' }, ai.apiKeys || {});
        if (!ai.apiKeys.gemini) ai.apiKeys.gemini = AI_PLACEHOLDER;
        if (!ai.geminiVideoKey) ai.geminiVideoKey = AI_PLACEHOLDER;
        prev.ai = ai; changed = true;
      }
      if (changed) localArea.set({ settings: prev });
    });
  } catch (e) { console.error('[social-ext] seed settings', e); }

  // Записать AI-настройки извне (модалка «Конфигурация ИИ» родителя): cloud (placeholder) или свой ключ.
  function setAiSettings(ai) {
    try {
      localArea.get('settings', function (r) {
        var s = (r && r.settings) || {};
        s.ai = Object.assign({ provider: 'gemini', model: '' }, s.ai || {}, ai || {});
        if (!s.ai.apiKey) s.ai.apiKey = AI_PLACEHOLDER;
        localArea.set({ settings: s });
      });
    } catch (e) { console.error('[social-ext] setAiSettings', e); }
  }

  // ── runtime messaging: внутри-страничный мост (sidepanel ↔ background) ──
  var onMessageEvt = makeEvent();
  var onMessageExternalEvt = makeEvent();

  function dispatchMessage(message, listeners, callback) {
    var sender = { id: runtime.id, url: location.href, origin: location.origin };
    var settled = false, willRespond = false;
    function sendResponse(resp) { if (settled) return; settled = true; if (callback) { try { callback(resp); } catch (e) { console.error(e); } } else if (pResolve) pResolve(resp); }
    var pResolve = null, promise = null;
    if (!callback) { promise = new Promise(function (res) { pResolve = res; }); }
    listeners.slice().forEach(function (fn) {
      if (settled && !willRespond) return;
      try {
        var ret = fn(message, sender, sendResponse);
        if (ret === true) willRespond = true;
        else if (ret && typeof ret.then === 'function') { willRespond = true; ret.then(sendResponse, function (err) { console.error('[social-ext] handler rejected', err); sendResponse(undefined); }); }
      } catch (e) { console.error('[social-ext] onMessage handler error', e); }
    });
    if (!willRespond && !settled) sendResponse(undefined);
    return promise;
  }

  function sendMessage() {
    var args = Array.prototype.slice.call(arguments);
    var cb = (typeof args[args.length - 1] === 'function') ? args.pop() : null;
    // Поддержка форм: (message) | (message, options) | (extensionId, message, options)
    var message = args.length >= 2 && typeof args[0] === 'string' ? args[1] : args[0];
    return dispatchMessage(message, onMessageEvt._listeners, cb);
  }

  // ── runtime ──
  var runtime = {
    id: 'trendtraffic-social-ext',
    lastError: undefined,
    getURL: function (p) { return EXT_BASE + String(p || '').replace(/^\/+/, ''); },
    getManifest: function () { return { version: '0.8.18', manifest_version: 3, name: 'TikHub - Social Media Toolkit' }; },
    getPlatformInfo: function (cb) { var info = { os: 'win', arch: 'x86-64', nacl_arch: 'x86-64' }; return cb ? cb(info) : Promise.resolve(info); },
    openOptionsPage: function (cb) { try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'social-ext:open-settings' }, location.origin); } catch (e) {} if (cb) cb(); return Promise.resolve(); },
    sendMessage: sendMessage,
    connect: function () { return { name: '', postMessage: function () {}, disconnect: function () {}, onMessage: makeEvent(), onDisconnect: makeEvent() }; },
    onMessage: onMessageEvt,
    onMessageExternal: onMessageExternalEvt,
    onInstalled: makeEvent(),
    onStartup: makeEvent(),
    onConnect: makeEvent(),
    onSuspend: makeEvent(),
  };

  // ── tabs ──
  // В веб-вкладке нет настоящего хост-таба. Поэтому «текущий таб» — это URL, который
  // пользователь вводит в строку родительской страницы (SocialExtensionPage). Родитель
  // присылает его через postMessage, а мы эмулируем переход таба (onActivated/onUpdated),
  // чтобы расширение реагировало РОВНО как на навигацию реального браузерного таба.
  var currentTab = { id: 1, index: 0, active: true, highlighted: true, windowId: 1, url: '', title: '', status: 'complete' };
  function snapTab() { return Object.assign({}, currentTab); }

  var tabs = {
    query: function (q, cb) { var res = [snapTab()]; return cb ? cb(res) : Promise.resolve(res); },
    get: function (id, cb) { var t = snapTab(); return cb ? cb(t) : Promise.resolve(t); },
    getCurrent: function (cb) { var t = snapTab(); return cb ? cb(t) : Promise.resolve(t); },
    // update БЕЗ url (напр. tabs.update(tabId,{active:true})) — no-op; с url — открыть в новой вкладке.
    update: function (a, b, c) { var props = (typeof a === 'object') ? a : b; var cb = (typeof c === 'function') ? c : (typeof b === 'function' ? b : null); try { if (props && props.url) window.open(props.url, '_blank', 'noopener'); } catch (e) {} var t = snapTab(); return cb ? cb(t) : Promise.resolve(t); },
    create: function (props, cb) { try { if (props && props.url) window.open(props.url, '_blank', 'noopener'); } catch (e) {} var t = { id: 2, active: true, url: props && props.url }; return cb ? cb(t) : Promise.resolve(t); },
    sendMessage: function (tabId, message, optsOrCb, cb) { var c = (typeof optsOrCb === 'function') ? optsOrCb : cb; return c ? c(undefined) : Promise.resolve(undefined); },
    onUpdated: makeEvent(),
    onActivated: makeEvent(),
    onRemoved: makeEvent(),
  };

  // Установить «текущий URL таба» и эмулировать переход (как навигация реального таба).
  function setCurrentUrl(url) {
    url = String(url || '');
    if (url === currentTab.url) {
      // тот же URL — всё равно перевыпустим событие, чтобы расширение перезапросило аналитику
    }
    currentTab.url = url; currentTab.title = url; currentTab.status = 'complete';
    try { tabs.onActivated._emit({ tabId: currentTab.id, windowId: currentTab.windowId }); } catch (e) {}
    try { tabs.onUpdated._emit(currentTab.id, { status: 'loading', url: url }, snapTab()); } catch (e) {}
    try { tabs.onUpdated._emit(currentTab.id, { status: 'complete', url: url }, snapTab()); } catch (e) {}
  }
  window.__ttSocialExtSetUrl = setCurrentUrl; // для отладки/прямого вызова

  // ── permissions ──
  var permissions = {
    contains: function (p, cb) { return cb ? cb(true) : Promise.resolve(true); },
    request: function (p, cb) { return cb ? cb(true) : Promise.resolve(true); },
    remove: function (p, cb) { return cb ? cb(true) : Promise.resolve(true); },
    getAll: function (cb) { var all = { permissions: [], origins: [] }; return cb ? cb(all) : Promise.resolve(all); },
    onAdded: makeEvent(),
    onRemoved: makeEvent(),
  };

  // ── sidePanel (no-op) ──
  var sidePanel = {
    setPanelBehavior: function (o, cb) { return cb ? cb() : Promise.resolve(); },
    open: function (o, cb) { return cb ? cb() : Promise.resolve(); },
    setOptions: function (o, cb) { return cb ? cb() : Promise.resolve(); },
    getOptions: function (o, cb) { var r = {}; return cb ? cb(r) : Promise.resolve(r); },
  };

  // ── i18n (у бандла своя i18next; здесь безопасные заглушки) ──
  var i18n = {
    getMessage: function () { return ''; },
    getUILanguage: function () { return (navigator.language || 'en'); },
    getAcceptLanguages: function (cb) { var l = navigator.languages || [navigator.language || 'en']; return cb ? cb(l) : Promise.resolve(l); },
    languages: navigator.languages || [navigator.language || 'en'],
  };

  // ── downloads ──
  // Экспорт отчётов/CSV/JSON — это blob: (same-origin) → прямой anchor, имя применяется.
  // Видео/обложки — кросс-доменный CDN: anchor-атрибут download для cross-origin
  // игнорируется (имя теряется, может открыться вкладкой). Поэтому тянем через серверный
  // медиа-прокси (Referer + same-origin blob) с JWT приложения — имя файла сохраняется.
  var dlId = 0;
  function anchorDownload(href, filename, revoke) {
    var a = document.createElement('a');
    a.href = href; a.rel = 'noopener';
    if (filename) a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { try { a.remove(); } catch (e) {} if (revoke) { try { URL.revokeObjectURL(href); } catch (e) {} } }, 0);
  }
  var downloads = {
    download: function (options, cb) {
      var id = ++dlId;
      var done = function () { return cb ? cb(id) : Promise.resolve(id); };
      try {
        var url = (options && options.url) ? String(options.url) : '';
        var u = new URL(url, location.href);
        var sameOrigin = (u.origin === location.origin) || u.protocol === 'blob:' || u.protocol === 'data:';
        if (sameOrigin) { anchorDownload(url, options.filename); return done(); }
        var token = ''; try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
        var proxied = '/api/social-ext/media?url=' + encodeURIComponent(url) + (options.filename ? '&filename=' + encodeURIComponent(options.filename) : '');
        window.fetch(proxied, { headers: { Authorization: 'Bearer ' + token }, credentials: 'same-origin' })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
          .then(function (b) { anchorDownload(URL.createObjectURL(b), options.filename, true); })
          .catch(function (e) { console.error('[social-ext] media download via proxy failed, direct fallback', e); anchorDownload(url, options.filename); });
        return done();
      } catch (e) { console.error('[social-ext] downloads.download', e); return done(); }
    },
    onChanged: makeEvent(),
    onCreated: makeEvent(),
  };

  // ── собираем chrome ──
  window.chrome = window.chrome || {};
  var c = window.chrome;
  c.__tt_social_ext = true;
  c.runtime = runtime;
  c.storage = { local: localArea, sync: syncArea, onChanged: onChangedEvt };
  c.tabs = tabs;
  c.permissions = permissions;
  c.sidePanel = sidePanel;
  c.i18n = i18n;
  c.downloads = downloads;
  c.action = c.action || { onClicked: makeEvent(), setBadgeText: function () { return Promise.resolve(); }, setIcon: function () { return Promise.resolve(); } };

  // ── fetch-override: переписываем запросы расширения на наши same-origin прокси ──
  //   • api.tikhub.io|dev            → /api/social-ext/proxy        (TikHub API, наш ключ)
  //   • AI-хосты (в облачном режиме)  → /api/social-ext/ai-proxy/... (ключ Enterprise)
  //   • CDN изображений/видео         → /api/social-ext/media?url=   (Referer на сервере)
  //  Ко всем добавляем JWT приложения. Остальное — без изменений.
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  if (_fetch) {
    window.fetch = function (input, init) {
      try {
        var url = (typeof input === 'string') ? input : (input && input.url ? input.url : String(input));
        var u = new URL(url, location.href);
        var host = u.hostname;
        var proxied = null, mediaGet = false;
        if (TIKHUB_HOSTS[host]) {
          proxied = PROXY_PREFIX + u.pathname + u.search;
        } else if (AI_HOSTS[host] && aiIsCloud()) {
          proxied = AI_PROXY_PREFIX + '/' + host + u.pathname + u.search;
        } else if (isCdnHost(host)) {
          proxied = MEDIA_PREFIX + '?url=' + encodeURIComponent(u.href);
          mediaGet = true;
        }
        if (proxied) {
          var token = appToken();
          if (mediaGet) {
            // картинка/видео с CDN → простой GET через медиа-прокси (Referer ставит сервер)
            return _fetch(proxied, { headers: { Authorization: 'Bearer ' + token }, credentials: 'same-origin', mode: 'same-origin' });
          }
          if (input && typeof input === 'object' && input.url) {
            var headers = new Headers(input.headers || {});
            headers.set('Authorization', 'Bearer ' + token);
            var hasBody = input.method && ['GET', 'HEAD'].indexOf(input.method.toUpperCase()) < 0;
            var reqInit = { method: input.method || 'GET', headers: headers, mode: 'same-origin', credentials: 'same-origin', cache: input.cache, redirect: input.redirect };
            if (hasBody) { reqInit.body = input.body; reqInit.duplex = 'half'; }
            return _fetch(new Request(proxied, reqInit));
          }
          init = init ? Object.assign({}, init) : {};
          var h = new Headers((init && init.headers) || {});
          h.set('Authorization', 'Bearer ' + token);
          init.headers = h; init.mode = 'same-origin'; init.credentials = 'same-origin';
          return _fetch(proxied, init);
        }
      } catch (e) { /* не наш запрос — пропускаем как есть */ }
      return _fetch(input, init);
    };
  }

  // ── Мост с родительской страницей: получаем URL для анализа и эмулируем переход таба ──
  try {
    window.addEventListener('message', function (ev) {
      if (window.parent && ev.source !== window.parent) return; // только от родителя-обёртки
      var d = ev.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'social-ext:set-url') { setCurrentUrl(d.url); }
      else if (d.type === 'social-ext:clear-url') { setCurrentUrl(''); }
      else if (d.type === 'social-ext:set-ai') { setAiSettings(d.ai); }
    });
    // Сообщаем родителю, что polyfill готов — пусть пришлёт текущий URL (гонка загрузки).
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: 'social-ext:ready' }, location.origin); } catch (e) {}
    }
  } catch (e) { console.error('[social-ext] postMessage bridge', e); }
})();
