/* ==========================================================================
   Появление блоков при скролле, параллакс фоновых фото и счётчики цифр.
   Разметка:
     data-reveal="up|fade|scale"   — как появляется блок
     data-reveal-delay="0.15"      — задержка, сек
     data-reveal-stagger           — на контейнере: дети появляются по очереди
     data-parallax="0.15"          — сила параллакса (доля высоты экрана)
     data-count="4.9" data-count-decimals="1" — анимированное число
   ========================================================================== */

(function (EUF) {
  'use strict';

  var PRESETS = {
    up:    { y: 46, opacity: 0 },
    fade:  { opacity: 0 },
    scale: { scale: 1.06, opacity: 0 }
  };

  EUF.initReveal = function () {
    var nodes = document.querySelectorAll('[data-reveal]');
    var counters = document.querySelectorAll('[data-count]');
    var parallax = document.querySelectorAll('[data-parallax]');

    /* Без GSAP или при reduced-motion просто показываем всё как есть */
    if (!EUF.gsapReady() || EUF.reducedMotion) {
      document.documentElement.classList.remove('js-reveal-ready');
      counters.forEach(function (el) { el.textContent = formatValue(el, Number(el.dataset.count)); });
      return;
    }

    var gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);

    nodes.forEach(function (el) {
      var from = PRESETS[el.dataset.reveal] || PRESETS.up;
      var delay = parseFloat(el.dataset.revealDelay) || 0;
      var targets = el.hasAttribute('data-reveal-stagger') ? el.children : el;

      /* Сначала снимаем стартовую прозрачность из CSS (она нужна была,
         чтобы блоки не мигнули до инициализации), потом отдаём анимацию GSAP */
      gsap.set(el, { opacity: 1 });
      gsap.set(targets, { opacity: 1 });

      gsap.from(targets, Object.assign({}, from, {
        duration: 0.95,
        delay: delay,
        ease: 'power3.out',
        stagger: el.hasAttribute('data-reveal-stagger') ? 0.1 : 0,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        clearProps: 'transform'
      }));
    });

    /* Параллакс: двигаем только transform, без перерасчёта раскладки */
    parallax.forEach(function (el) {
      var strength = parseFloat(el.dataset.parallax) || 0.12;
      gsap.to(el, {
        yPercent: strength * 100,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('[data-parallax-scope]') || el.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });

    /* Счётчики: 4.9 рейтинг, 299 оценок, 15 человек, 5000 ₽ */
    counters.forEach(function (el) {
      var end = Number(el.dataset.count);
      var obj = { v: 0 };
      el.textContent = formatValue(el, 0);
      gsap.to(obj, {
        v: end,
        duration: 1.8,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: function () { el.textContent = formatValue(el, obj.v); }
      });
    });
  };

  function formatValue(el, value) {
    var decimals = Number(el.dataset.countDecimals || 0);
    var num = value.toFixed(decimals);
    if (el.hasAttribute('data-count-space')) {
      num = num.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
    return num;
  }
})(window.EUF);
