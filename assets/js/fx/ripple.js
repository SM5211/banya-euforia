/* ==========================================================================
   Как кнопка отзывается на палец.

   1. Круг на воде из точки клика/тапа — на .btn и на всём с data-ripple.
   2. Притяжение: крупные кнопки «Забронировать» слегка тянутся к курсору,
      пока он рядом. Только для мыши: на тачскрине курсора нет, а pointermove
      там срабатывает при прокрутке — кнопки бы дёргались.
   ========================================================================== */

(function (EUF) {
  'use strict';

  EUF.initRipple = function () {
    if (EUF.reducedMotion) return;

    document.addEventListener('pointerdown', function (e) {
      var host = e.target.closest('.btn, [data-ripple]');
      if (!host) return;

      var rect = host.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 2.4;

      var ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left) + 'px';
      ripple.style.top = (e.clientY - rect.top) + 'px';

      host.appendChild(ripple);
      ripple.addEventListener('animationend', function () { ripple.remove(); });
    }, { passive: true });

    initMagnet();
  };

  /* --- Притяжение крупных кнопок ------------------------------------------ */

  var RADIUS = 170;   // с какого расстояния кнопка начинает тянуться
  var PULL_X = 0.16;  // доля смещения по горизонтали
  var PULL_Y = 0.2;   // по вертикали — чуть сильнее, движение читается лучше
  var LIMIT = 9;      // максимум смещения, px

  function initMagnet() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    /* Только крупные отдельно стоящие кнопки: у растянутых на всю ширину
       и у кнопки в шапке смещение выглядело бы дёрганьем */
    var buttons = Array.prototype.slice.call(
      document.querySelectorAll('.btn--primary:not(.btn--block):not(.header__cta)')
    );
    if (!buttons.length) return;

    var queued = false, clientX = 0, clientY = 0;

    window.addEventListener('pointermove', function (e) {
      clientX = e.clientX;
      clientY = e.clientY;
      if (queued) return;
      queued = true;
      requestAnimationFrame(apply);
    }, { passive: true });

    function apply() {
      queued = false;
      buttons.forEach(function (btn) {
        var r = btn.getBoundingClientRect();
        if (!r.width) return;
        var dx = clientX - (r.left + r.width / 2);
        var dy = clientY - (r.top + r.height / 2);
        if (Math.abs(dx) > RADIUS || Math.abs(dy) > RADIUS) {
          if (btn.style.transform) btn.style.transform = '';
          return;
        }
        var over = clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
        var tx = Math.max(-LIMIT, Math.min(LIMIT, dx * PULL_X));
        /* -2px повторяют подъём из .btn:hover — инлайновый transform его перебивает */
        var ty = Math.max(-LIMIT, Math.min(LIMIT, dy * PULL_Y)) - (over ? 2 : 0);
        btn.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px)';
      });
    }
  }
})(window.EUF);
