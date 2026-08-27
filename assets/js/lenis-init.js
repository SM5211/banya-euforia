/* ==========================================================================
   Плавный скролл (Lenis) + связка с GSAP ScrollTrigger.
   При prefers-reduced-motion не включается вовсе — остаётся нативный скролл.
   ========================================================================== */

(function (EUF) {
  'use strict';

  EUF.initSmoothScroll = function () {
    if (EUF.reducedMotion || typeof window.Lenis === 'undefined') return null;

    var lenis = new window.Lenis({
      duration: 1.1,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });

    document.documentElement.classList.add('has-lenis');
    EUF.lenis = lenis;

    if (EUF.gsapReady()) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (time) { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }

    /* Якорные ссылки внутри страницы ведём через Lenis, чтобы не дёргалось */
    document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -70 });
      });
    });

    return lenis;
  };
})(window.EUF);
