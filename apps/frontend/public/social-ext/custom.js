/*
 * custom.js — наши доработки UI рехостнутого расширения (НЕ трогаем бандл).
 * Загружается в iframe после polyfill+background. Текстовые селекторы +
 * MutationObserver, чтобы переживать ре-рендеры расширения.
 *
 *  • Прячем верхнюю панель (логотип TikHub + кэш + язык + шестерёнка).
 *  • Делаем липкой ленту вкладок Info / Comments / Analysis.
 *  • Переносим блоки «Metrics» и «Fake Views Detection» сразу после «Music».
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

  function reorderBlocks(doc) {
    var hMusic = h4ByText(doc, 'Music');
    var hMetrics = h4ByText(doc, 'Metrics');
    var hFake = h4ByText(doc, 'Fake Views Detection');
    if (!hMusic || (!hMetrics && !hFake)) return;
    // Общий контейнер-колонка: ближайший общий предок Music и одного из переносимых.
    var anc = []; var x = hMusic; while (x) { anc.push(x); x = x.parentElement; }
    var probe = hMetrics || hFake, col = null, y = probe;
    while (y) { if (anc.indexOf(y) >= 0) { col = y; break; } y = y.parentElement; }
    if (!col) return;
    function block(h) { var e = h; while (e && e.parentElement !== col) e = e.parentElement; return (e && e.parentElement === col) ? e : null; }
    var mb = block(hMusic), me = hMetrics ? block(hMetrics) : null, fb = hFake ? block(hFake) : null;
    if (!mb) return;
    // Идемпотентно: двигаем только если ещё не на месте (иначе бесконечный цикл наблюдателя).
    if (me && me !== mb && mb.nextElementSibling !== me) { col.insertBefore(me, mb.nextElementSibling); }
    var afterEl = (me && me.parentElement === col) ? me : mb;
    if (fb && fb !== mb && afterEl.nextElementSibling !== fb) { col.insertBefore(fb, afterEl.nextElementSibling); }
  }

  // Вставляем в раздел «Music» две кнопки: «Скачать музыку» (на устройство) и
  // «Скачать и посмотреть» (скачать + открыть трек). Клик → postMessage родителю
  // (он знает анализируемый URL и дёргает backend, который стримит аудио).
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
    function mk(label, action, primary) {
      var b = doc.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = 'flex:1;padding:9px 10px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;'
        + 'border:1px solid ' + (primary ? '#6366f1' : 'var(--color-border)') + ';'
        + 'background:' + (primary ? '#6366f1' : 'transparent') + ';color:' + (primary ? '#fff' : 'var(--color-foreground)') + ';';
      b.onclick = function () { try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'social-ext:music', action: action }, location.origin); } catch (e) {} };
      return b;
    }
    row.appendChild(mk('⬇ Скачать музыку', 'download', false));
    row.appendChild(mk('👁 Скачать и посмотреть', 'view', true));
    card.appendChild(row);
  }

  function apply() {
    try {
      hideTopBar(document);
      stickyTabs(document);
      musicButtons(document);
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
