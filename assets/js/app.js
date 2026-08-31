/* ==========================================================================
   Точка входа: шапка, мобильное меню, плавающая кнопка связи,
   запуск плавного скролла, scroll-reveal и тематических эффектов.
   ========================================================================== */

(function (EUF) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initHeader();
    initMobileMenu();
    initFab();

    EUF.initSmoothScroll();
    EUF.initReveal();
    EUF.initRipple();
    EUF.initHeroVideo();
    initFxZones();

    /* Эти модули сами проверяют, есть ли на странице их разметка */
    EUF.initLightbox();
    EUF.initGalleryFilter();
    EUF.initBookingForm();
    EUF.initAnalytics();
  });

  /* --- Шапка: «стекло» после прокрутки ----------------------------------- */
  function initHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;

    var update = function () {
      header.classList.toggle('is-stuck', window.scrollY > 40);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* --- Бургер-меню -------------------------------------------------------- */
  function initMobileMenu() {
    var burger = document.querySelector('[data-burger]');
    var menu = document.querySelector('[data-mobile-menu]');
    if (!burger || !menu) return;

    var setOpen = function (open) {
      burger.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('is-locked', open);
      if (EUF.lenis) open ? EUF.lenis.stop() : EUF.lenis.start();
    };

    burger.addEventListener('click', function () {
      setOpen(burger.getAttribute('aria-expanded') !== 'true');
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        burger.focus();
      }
    });
  }

  /* --- Плавающая кнопка быстрой связи ------------------------------------ */
  function initFab() {
    var toggle = document.querySelector('[data-fab-toggle]');
    var list = document.querySelector('[data-fab-list]');
    if (!toggle || !list) return;

    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      list.classList.toggle('is-open', open);
    };

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-fab]')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  /* --- Пар и искры: инициализируем лениво, когда секция во вьюпорте ------- */
  function initFxZones() {
    document.querySelectorAll('[data-steam]').forEach(function (canvas) {
      EUF.onEnterViewport(canvas, function () {
        EUF.createSteam(canvas, {
          density: parseFloat(canvas.dataset.steamDensity) || 1,
          speed: parseFloat(canvas.dataset.steamSpeed) || 1
        });
      });
    });

    document.querySelectorAll('[data-embers]').forEach(function (canvas) {
      EUF.onEnterViewport(canvas, function () {
        EUF.createEmbers(canvas);
      });
    });
  }
})(window.EUF);
