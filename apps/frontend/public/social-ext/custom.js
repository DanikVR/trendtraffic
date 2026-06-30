/*
 * custom.js — наши доработки UI рехостнутого расширения (НЕ трогаем бандл).
 * Загружается в iframe после polyfill+background. Текстовые селекторы +
 * MutationObserver, чтобы переживать ре-рендеры расширения.
 *
 *  • Прячем верхнюю панель (логотип TikHub + кэш + язык + шестерёнка).
 *  • Делаем липкой ленту вкладок Info / Comments / Analysis.
 *  • Кнопку «Download video» перехватываем → скачивание БЕЗ водяного знака (родитель).
 *  • В строку скачивания добавляем кнопку «Скачать аудио».
 *  • В разделе «Music» — одна кнопка «Скачать» (аудио-дорожка на устройство).
 *  • «Cover variants» переносим ПЕРЕД блоком скачивания, «Metrics» (+«Fake Views
 *    Detection») — сразу ПОСЛЕ блока скачивания.
 *  • Instagram (отдельные секции MEDIA/AUDIO): кнопка «Скачать медиа (макс.
 *    качество)» под галереей — качает ТЕКУЩИЙ элемент карусели (видео/фото) — и
 *    кнопка «Скачать аудио» в разделе AUDIO. Прямые ссылки резолвит родитель
 *    через /api/social-ext/ig-manifest, стрим — через /api/social-ext/media.
 *  • «Quality variants» (IG/X): прячем длинный URL-текст строки и нативную копию,
 *    добавляем тройку кнопок: открыть по ссылке · скачать (через медиа-прокси
 *    родителя) · скопировать ссылку.
 */
(function () {
  'use strict';

  function hideTopBar(doc) {
    // Верхняя панель: единственный sticky-блок с z-30, текст начинается с «TikHub».
    var bars = doc.querySelectorAll('div');
    for (var i = 0; i < bars.length; i++) {
      var el = bars[i];
      var cls = (el.className && el.className.toString) ? el.className.toString() : '';
      if (/z-30/.test(cls) && /^TikHub/.test((el.textContent || '').trim())) {
        if (el.style.display !== 'none') el.style.display = 'none';
        return;
      }
    }
  }

  function stickyTabs(doc) {
    var btns = doc.querySelectorAll('button');
    var info = null;
    for (var i = 0; i < btns.length; i++) { if (btns[i].textContent.trim() === 'Info') { info = btns[i]; break; } }
    if (!info) return;
    var tb = info;
    for (var j = 0; j < 6 && tb; j++) {
      if (tb.tagName === 'DIV' && /Comments/.test(tb.textContent) && /Analysis/.test(tb.textContent)) break;
      tb = tb.parentElement;
    }
    if (!tb || tb.tagName !== 'DIV') return;
    var s = tb.style;
    // !important — чтобы перебить собственное позиционирование расширения (оно вешало
    // на ленту вкладок sticky с отступом под скрытую нами верхнюю панель).
    s.setProperty('position', 'sticky', 'important');
    s.setProperty('top', '0px', 'important');
    s.setProperty('z-index', '40', 'important');
    s.setProperty('margin-top', '0', 'important');
    s.paddingTop = '8px';
    s.paddingBottom = '8px';
    s.backgroundColor = 'var(--color-background)';
    s.boxShadow = '0 6px 12px -8px rgba(0,0,0,0.35)';
    // sticky ломается, если предок между лентой и скроллером клиппит overflow.
    // Снимаем клип у предков ДО первого скроллера (его не трогаем).
    var p = tb.parentElement, hops = 0;
    while (p && hops < 5) {
      var cs = window.getComputedStyle(p);
      if (/auto|scroll/.test(cs.overflowY)) break;
      if (/hidden|clip/.test(cs.overflowY)) p.style.setProperty('overflow-y', 'visible', 'important');
      p = p.parentElement; hops++;
    }
  }

  function h4ByText(doc, text) {
    var hs = doc.querySelectorAll('h4');
    for (var i = 0; i < hs.length; i++) { if (hs[i].textContent.trim() === text) return hs[i]; }
    return null;
  }

  function buttonByText(doc, text) {
    var bs = doc.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) { if (bs[i].textContent.trim() === text) return bs[i]; }
    return null;
  }

  // Ближайший общий предок двух узлов.
  function lca(a, b) {
    var anc = []; var x = a; while (x) { anc.push(x); x = x.parentElement; }
    var y = b; while (y) { if (anc.indexOf(y) >= 0) return y; y = y.parentElement; }
    return null;
  }
  // Прямой ребёнок col на пути к node (сам «блок-секция» в колонке).
  function childOf(col, node) { var e = node; while (e && e.parentElement !== col) e = e.parentElement; return (e && e.parentElement === col) ? e : null; }

  // Переупорядочиваем секции вокруг блока скачивания: «Cover variants» — ПЕРЕД ним,
  // «Metrics» (+ «Fake Views Detection») — сразу ПОСЛЕ. Колонку выводим из общего
  // предка заголовка «Music» и нативной кнопки «Download video» (оба есть всегда).
  function reorderBlocks(doc) {
    var hMusic = h4ByText(doc, 'Music');
    var dlBtn = buttonByText(doc, 'Download video');
    if (!hMusic || !dlBtn) return;
    var col = lca(hMusic, dlBtn);
    if (!col) return;
    var dlBlock = childOf(col, dlBtn);
    if (!dlBlock) return;

    // (4) Cover variants → перед блоком скачивания.
    var hCover = h4ByText(doc, 'Cover variants');
    var coverBlock = hCover ? childOf(col, hCover) : null;
    if (coverBlock && coverBlock !== dlBlock && dlBlock.previousElementSibling !== coverBlock) {
      col.insertBefore(coverBlock, dlBlock);
    }

    // (5) Metrics (+ Fake Views Detection) → сразу после блока скачивания.
    var hMetrics = h4ByText(doc, 'Metrics');
    var metricsBlock = hMetrics ? childOf(col, hMetrics) : null;
    var hFake = h4ByText(doc, 'Fake Views Detection');
    var fakeBlock = hFake ? childOf(col, hFake) : null;
    // Идемпотентно: двигаем только если ещё не на месте (иначе бесконечный цикл наблюдателя).
    if (metricsBlock && metricsBlock !== dlBlock && dlBlock.nextElementSibling !== metricsBlock) {
      col.insertBefore(metricsBlock, dlBlock.nextElementSibling);
    }
    var afterEl = (metricsBlock && metricsBlock.parentElement === col) ? metricsBlock : dlBlock;
    if (fakeBlock && fakeBlock !== dlBlock && afterEl.nextElementSibling !== fakeBlock) {
      col.insertBefore(fakeBlock, afterEl.nextElementSibling);
    }
  }

  // Просим родителя скачать аудио-дорожку (он знает анализируемый URL и стримит её).
  function postMusicDownload() {
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'social-ext:music', action: 'download' }, location.origin); } catch (e) {}
  }

  // Раздел «Music»: одна кнопка «Скачать» — скачивает аудио-дорожку на устройство.
  function musicButtons(doc) {
    var hMusic = h4ByText(doc, 'Music');
    if (!hMusic) return;
    var card = hMusic;
    for (var i = 0; i < 5 && card.parentElement; i++) { card = card.parentElement; if (/rounded-xl/.test((card.className || '').toString())) break; }
    if (!card) card = hMusic.parentElement;
    if (!card || card.querySelector('[data-tt-music]')) return; // уже добавили
    var row = doc.createElement('div');
    row.setAttribute('data-tt-music', '1');
    row.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
    var b = doc.createElement('button');
    b.type = 'button'; b.textContent = '⬇ Скачать';
    b.style.cssText = 'flex:1;padding:9px 10px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;'
      + 'border:1px solid #6366f1;background:#6366f1;color:#fff;';
    b.onclick = postMusicDownload;
    row.appendChild(b);
    card.appendChild(row);
  }

  // Строка скачивания (нативные «Download video» + «Download cover»):
  //  • «Download video» перехватываем → родитель качает видео БЕЗ водяного знака;
  //  • добавляем третью кнопку «Скачать аудио» (1:1 со стилем нативных кнопок).
  function enhanceDownloadRow(doc) {
    var dlBtn = buttonByText(doc, 'Download video');
    if (!dlBtn) return;

    // (1) Перехват «Download video» (bubble на самой кнопке → раньше делегированного
    //     onClick расширения; stopImmediatePropagation не пускает событие к React-корню).
    if (!dlBtn.hasAttribute('data-tt-nowm')) {
      dlBtn.setAttribute('data-tt-nowm', '1');
      dlBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'social-ext:download-video' }, location.origin); } catch (e2) {}
      });
    }

    // (2) Кнопка «Скачать аудио» в той же строке.
    var row = dlBtn.parentElement;
    if (!row || row.querySelector('[data-tt-audio]')) return; // уже добавили
    var coverBtn = buttonByText(doc, 'Download cover');
    var audio = doc.createElement('button');
    audio.type = 'button';
    audio.setAttribute('data-tt-audio', '1');
    audio.className = (coverBtn || dlBtn).className; // стиль 1:1 с нативной кнопкой
    audio.textContent = '⬇ Скачать аудио';
    audio.onclick = postMusicDownload;
    // Строка была 2-колоночной (grid-cols-2) — расширяем до 3 равных колонок.
    try { row.style.setProperty('grid-template-columns', 'repeat(3, minmax(0, 1fr))', 'important'); } catch (e) {}
    row.appendChild(audio);
  }

  // ── Instagram: кнопки «Скачать» (медиа макс. качества + аудио) ──────────────
  // IG-аналитика — отдельный компонент бандла (секции MEDIA/AUDIO, а НЕ Music/
  // Download video, как у TikTok). Прямые ссылки знает только бэкенд → шлём в
  // родитель тип элемента: текущий индекс карусели (из бейджа «N / M») или audio.
  // Родитель тянет манифест (один вызов TikHub на пост) и стримит файл.

  function postIg(kind, index) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'social-ext:ig-download', kind: kind, index: index | 0 }, location.origin);
      }
    } catch (e) { /* тихо */ }
  }

  // Текущий индекс карусели из бейджа «N / M» внутри карточки; -1 если бейджа нет.
  function igCurrentIndex(card) {
    var divs = card.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      if (divs[i].children.length === 0) {
        var m = /^(\d+)\s*\/\s*(\d+)$/.exec((divs[i].textContent || '').trim());
        if (m) return parseInt(m[1], 10) - 1;
      }
    }
    return -1;
  }

  // Секция IG = карточка .rounded-xl, внутри <h4> с заголовком (matchRe).
  function igCardByH4(doc, matchRe) {
    var hs = doc.querySelectorAll('h4');
    for (var i = 0; i < hs.length; i++) {
      if (matchRe.test((hs[i].textContent || '').trim())) {
        var card = hs[i];
        for (var j = 0; j < 4 && card.parentElement; j++) {
          card = card.parentElement;
          if (/rounded-xl/.test((card.className || '').toString())) return card;
        }
      }
    }
    return null;
  }

  // Это карточка медиа именно Instagram? (CDN-ссылка IG внутри или бейдж карусели)
  function isIgMediaCard(card) {
    var nodes = card.querySelectorAll('img,a');
    for (var i = 0; i < nodes.length; i++) {
      var v = (nodes[i].getAttribute('src') || '') + ' ' + (nodes[i].getAttribute('href') || '');
      if (/cdninstagr|fbcdn|instagram/i.test(v)) return true;
    }
    return igCurrentIndex(card) >= 0;
  }

  function igDlButton(doc, label) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'display:block;width:100%;margin-top:10px;padding:9px 10px;border-radius:10px;'
      + 'font-size:12px;font-weight:600;cursor:pointer;border:1px solid #6366f1;background:#6366f1;color:#fff;';
    return b;
  }

  // MEDIA: кнопка «Скачать текущее медиа (макс. качество)» под галереей. Индекс
  // читаем В МОМЕНТ КЛИКА (из бейджа) — при листании карусели качается тот, что виден.
  function igMediaButton(doc) {
    var card = igCardByH4(doc, /^media/i);
    if (!card || !isIgMediaCard(card) || card.querySelector('[data-tt-ig-media]')) return;
    var b = igDlButton(doc, '⬇ Скачать медиа (макс. качество)');
    b.setAttribute('data-tt-ig-media', '1');
    b.onclick = function () { var idx = igCurrentIndex(card); postIg('media', idx < 0 ? 0 : idx); };
    card.appendChild(b);
  }

  // AUDIO: кнопка «Скачать аудио» (оригинальный звук; лицензионный трек может быть недоступен).
  function igAudioButton(doc) {
    var card = igCardByH4(doc, /^audio$/i);
    if (!card || card.querySelector('[data-tt-ig-audio]')) return;
    var b = igDlButton(doc, '⬇ Скачать аудио');
    b.setAttribute('data-tt-ig-audio', '1');
    b.onclick = function () { postIg('audio', 0); };
    card.appendChild(b);
  }

  // ── Quality variants (IG/X): прячем сам URL, даём три кнопки ─────────────────
  // Каждая строка варианта (разрешение · type · URL · нативная «копировать»)
  // показывает прямой CDN-URL текстом — длинный и бесполезный в UI. Прячем строку
  // URL и нативную копию, добавляем компактную тройку: открыть · скачать · копировать.
  // «Скачать» стримит ссылку родителем через медиа-прокси (allow-list + Referer).

  function postMediaUrl(url, filename) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'social-ext:media-url', url: url, filename: filename }, location.origin);
      }
    } catch (e) { /* тихо */ }
  }

  // Имя файла из разрешения и типа варианта: instagram-720x1280-101.mp4
  function qvFilename(res, type) {
    var r = (res || '').replace(/\s*×\s*/, 'x').replace(/[^\dx]/g, '');
    var t = (type || '').replace(/\D/g, '');
    return 'instagram-' + (r || 'video') + (t ? '-' + t : '') + '.mp4';
  }

  function qvIconBtn(doc, label, title, onClick) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.title = title;
    b.textContent = label;
    b.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;'
      + 'width:26px;height:26px;flex-shrink:0;border-radius:8px;font-size:13px;line-height:1;cursor:pointer;'
      + 'border:1px solid var(--color-border);background:var(--color-card);color:var(--color-foreground);';
    b.onclick = onClick;
    return b;
  }

  function enhanceQualityVariants(doc) {
    // Строка варианта = <span class="truncate"> c текстом-URL внутри flex-строки,
    // где рядом есть <span> с разрешением «WxH» (так не заденем прочие ссылки UI).
    var spans = doc.querySelectorAll('span.truncate');
    for (var i = 0; i < spans.length; i++) {
      var urlSpan = spans[i];
      var url = (urlSpan.textContent || '').trim();
      if (!/^https?:\/\//i.test(url)) continue;
      var row = urlSpan.parentElement;
      if (!row || row.getAttribute('data-tt-qv') === '1') continue;
      var res = '', type = '', kids = row.children;
      for (var j = 0; j < kids.length; j++) {
        var txt = (kids[j].textContent || '').trim();
        if (/^\d+\s*×\s*\d+$/.test(txt)) res = txt;
        else if (/type/i.test(txt) && /\d/.test(txt)) type = txt;
      }
      if (!res) continue; // не строка варианта качества
      row.setAttribute('data-tt-qv', '1');
      urlSpan.style.display = 'none';                       // прячем сам URL
      var nativeCopy = row.querySelector('button');
      if (nativeCopy) nativeCopy.style.display = 'none';    // прячем нативную «копировать» (заменим тройкой)
      var fname = qvFilename(res, type);
      var wrap = doc.createElement('div');
      wrap.style.cssText = 'display:flex;gap:6px;margin-left:auto;flex-shrink:0;';
      wrap.appendChild(qvIconBtn(doc, '↗', 'Открыть по ссылке',
        (function (u) { return function () { try { window.open(u, '_blank', 'noopener'); } catch (e) {} }; })(url)));
      wrap.appendChild(qvIconBtn(doc, '⬇', 'Скачать',
        (function (u, f) { return function () { postMediaUrl(u, f); }; })(url, fname)));
      wrap.appendChild(qvIconBtn(doc, '⧉', 'Скопировать ссылку',
        (function (u) { return function () { try { navigator.clipboard.writeText(u); } catch (e) {} }; })(url)));
      row.appendChild(wrap);
    }
  }

  function apply() {
    try {
      hideTopBar(document);
      stickyTabs(document);
      musicButtons(document);
      enhanceDownloadRow(document);
      reorderBlocks(document);
      igMediaButton(document);
      igAudioButton(document);
      enhanceQualityVariants(document);
    } catch (e) { /* тихо */ }
  }

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(apply, 100); }

  function start() {
    try {
      var obs = new MutationObserver(schedule);
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    apply();
    setTimeout(apply, 400);
    setTimeout(apply, 1200);
  }

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
