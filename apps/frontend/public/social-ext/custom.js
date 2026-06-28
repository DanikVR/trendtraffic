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
    if (tb && tb.tagName === 'DIV') {
      tb.style.position = 'sticky';
      tb.style.top = '0';
      tb.style.zIndex = '20';
      tb.style.paddingTop = '8px';
      tb.style.paddingBottom = '8px';
      if (!tb.style.backgroundColor) tb.style.backgroundColor = 'var(--color-background)';
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

  function apply() {
    try {
      hideTopBar(document);
      stickyTabs(document);
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
