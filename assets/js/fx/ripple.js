/* ==========================================================================
   Вода: круг на воде из точки клика/тапа по кнопке или карточке.
   Вешается автоматически на .btn и всё с атрибутом data-ripple.
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
  };
})(window.EUF);
