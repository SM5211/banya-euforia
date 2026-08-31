/* ==========================================================================
   Яндекс.Метрика и цели — то, на что опирается реклама в Яндекс.Директе.

   ЧТО СДЕЛАТЬ, ЧТОБЫ ЗАРАБОТАЛО (один раз, 5 минут):
   1. Завести счётчик на metrika.yandex.ru → «Добавить счётчик».
   2. Скопировать его номер (8 цифр, например 98765432).
   3. Вписать номер в строку ниже вместо null:
          var METRIKA_ID = 98765432;
   4. Залить сайт заново — счётчик подключится сам, вставлять код
      с сайта Яндекса никуда не нужно.

   Пока номер не вписан, файл ничего не делает и ничего не грузит.

   ЦЕЛИ, которые начнут считаться автоматически:
      call            — нажали на телефон
      whatsapp        — открыли WhatsApp
      telegram        — открыли Telegram
      instagram       — перешли в Instagram
      booking_open    — нажали «Забронировать» (любую кнопку)
      booking_sent    — заполнили и отправили форму заявки
   В Метрике их нужно один раз добавить как цели типа «JavaScript-событие»
   с этими же названиями, а в Директе выбрать целью booking_sent —
   реклама будет оптимизироваться под заявки.
   ========================================================================== */

(function (EUF) {
  'use strict';

  var METRIKA_ID = null;   // ← сюда номер счётчика Яндекс.Метрики

  /* Отправка цели. Работает, только если счётчик подключён. */
  EUF.goal = function (name) {
    if (!METRIKA_ID || typeof window.ym !== 'function') return;
    window.ym(METRIKA_ID, 'reachGoal', name);
  };

  EUF.initAnalytics = function () {
    if (METRIKA_ID) loadMetrika(METRIKA_ID);

    /* Все клики ловим одним обработчиком — так ничего не забудется
       при добавлении новых кнопок */
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;
      var href = link.getAttribute('href') || '';

      if (href.indexOf('tel:') === 0) EUF.goal('call');
      else if (href.indexOf('wa.me') > -1) EUF.goal('whatsapp');
      else if (href.indexOf('t.me') > -1) EUF.goal('telegram');
      else if (href.indexOf('instagram.com') > -1) EUF.goal('instagram');
      else if (href.indexOf('vk.com') > -1) EUF.goal('vk');
      else if (/contact\/$|#booking$/.test(href) && link.classList.contains('btn')) EUF.goal('booking_open');
    }, { passive: true });
  };

  /* Стандартный код счётчика Яндекса, только подключается по номеру из настройки выше */
  function loadMetrika(id) {
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      for (var j = 0; j < e.scripts.length; j++) { if (e.scripts[j].src === r) return; }
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

    window.ym(id, 'init', {
      ssr: true,
      webvisor: true,
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true
    });
  }
})(window.EUF);
