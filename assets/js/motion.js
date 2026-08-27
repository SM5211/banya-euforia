/* ==========================================================================
   Общие утилиты анимации. Подключается первым — от него зависят остальные.
   Всё живёт в глобальном объекте EUF, чтобы работало без сборщика и модулей.
   ========================================================================== */

window.EUF = window.EUF || {};

(function (EUF) {
  'use strict';

  /* Пользователь просил «поменьше движения» в системных настройках */
  var reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  EUF.reducedMotion = reducedQuery.matches;
  reducedQuery.addEventListener('change', function (e) {
    EUF.reducedMotion = e.matches;
  });

  /* Мобильный/слабый девайс: тяжёлые canvas-эффекты урезаем */
  EUF.isMobile = window.matchMedia('(max-width: 780px)').matches;
  EUF.isWeakDevice = EUF.isMobile || (navigator.hardwareConcurrency || 8) <= 4;

  /* Запускает callback, когда элемент впервые попал во вьюпорт.
     Нужен для ленивой инициализации canvas-эффектов. */
  EUF.onEnterViewport = function (el, cb, options) {
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          io.disconnect();
          cb();
        }
      });
    }, Object.assign({ rootMargin: '120px' }, options || {}));
    io.observe(el);
  };

  /* Пока секция вне экрана — эффект стоит на паузе (экономим батарею) */
  EUF.observeVisibility = function (el, onShow, onHide) {
    if (!('IntersectionObserver' in window)) { onShow(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.isIntersecting ? onShow() : onHide();
      });
    }, { threshold: 0.01 });
    io.observe(el);
  };

  EUF.rand = function (min, max) { return min + Math.random() * (max - min); };

  EUF.gsapReady = function () {
    return typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  };
})(window.EUF);
