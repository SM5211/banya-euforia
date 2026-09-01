/* ==========================================================================
   Лайтбокс галереи: плавное открытие/закрытие, стрелки, свайп, Esc.
   Работает с любой разметкой вида:
     <button class="gallery__item" data-lightbox data-caption="Подпись"> … </button>
   Внутри может быть <img>, <video> или плейсхолдер — лайтбокс клонирует
   содержимое, поэтому после замены плейсхолдеров на реальные фото менять
   ничего не нужно.
   ========================================================================== */

(function (EUF) {
  'use strict';

  EUF.initLightbox = function () {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
    if (!items.length) return;

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML =
      '<div class="lightbox__backdrop" data-close></div>' +
      /* data-lenis-prevent — иначе плавная прокрутка перехватывает жест
         и внутри лайтбокса ничего не листается */
      '<div class="lightbox__dialog" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Просмотр фото">' +
        '<button class="lightbox__close" type="button" data-close aria-label="Закрыть">✕</button>' +
        '<button class="lightbox__nav lightbox__nav--prev" type="button" data-prev aria-label="Предыдущее фото">‹</button>' +
        '<figure class="lightbox__figure"><div class="lightbox__media"></div><figcaption class="lightbox__caption"></figcaption></figure>' +
        '<button class="lightbox__nav lightbox__nav--next" type="button" data-next aria-label="Следующее фото">›</button>' +
      '</div>';
    document.body.appendChild(box);

    var media = box.querySelector('.lightbox__media');
    var caption = box.querySelector('.lightbox__caption');
    var current = 0;
    var lastFocused = null;

    function show(index) {
      /* список считаем заново: часть карточек может быть скрыта фильтром */
      var visible = items.filter(function (i) { return i.offsetParent !== null; });
      if (!visible.length) return;
      current = (index + visible.length) % visible.length;
      var item = visible[current];

      media.innerHTML = '';
      var source = item.querySelector('img, video, .media-ph');
      if (source) {
        var clone = source.cloneNode(true);
        clone.removeAttribute('loading');
        if (clone.tagName === 'VIDEO') { clone.controls = true; clone.autoplay = true; }
        media.appendChild(clone);
      }
      caption.textContent = item.dataset.caption || '';
      box.dataset.index = current;
    }

    function open(index) {
      lastFocused = document.activeElement;
      show(index);
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-locked');
      if (EUF.lenis) EUF.lenis.stop();
      box.querySelector('.lightbox__close').focus();
    }

    function close() {
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-locked');
      media.innerHTML = '';
      if (EUF.lenis) EUF.lenis.start();
      if (lastFocused) lastFocused.focus();
    }

    items.forEach(function (item, i) {
      item.addEventListener('click', function () {
        var visible = items.filter(function (x) { return x.offsetParent !== null; });
        open(visible.indexOf(item) === -1 ? i : visible.indexOf(item));
      });
    });

    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) close();
      if (e.target.closest('[data-prev]')) show(current - 1);
      if (e.target.closest('[data-next]')) show(current + 1);
    });

    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });

    /* Свайп пальцем на мобильном */
    var startX = null;
    box.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 60) show(current + (dx < 0 ? 1 : -1));
      startX = null;
    }, { passive: true });
  };

  /* --- Фильтр категорий галереи ------------------------------------------ */
  EUF.initGalleryFilter = function () {
    var buttons = document.querySelectorAll('[data-filter]');
    var cards = document.querySelectorAll('[data-category]');
    if (!buttons.length || !cards.length) return;

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.dataset.filter;

        buttons.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        cards.forEach(function (card) {
          var match = value === 'all' || card.dataset.category === value;
          card.hidden = !match;
        });

        if (EUF.gsapReady() && window.ScrollTrigger) window.ScrollTrigger.refresh();
      });
    });
  };
})(window.EUF);
