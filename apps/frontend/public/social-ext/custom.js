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

  function apply() {
    try {
      hideTopBar(document);
      stickyTabs(document);
      musicButtons(document);
      enhanceDownloadRow(document);
      reorderBlocks(document);
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
