/* ==========================================================================
   Фоновое видео в hero.

   Логика бережная: фото в hero есть всегда, видео подгружается поверх него
   только если это уместно —
     • экран шире 780px (на телефоне трафик дороже, а фото и так красивое);
     • пользователь не просил «меньше движения»;
     • браузер не сообщает про экономию трафика или медленную сеть.
   Если файла видео нет или он не проигрался — остаётся фото, ничего не ломается.

   Как заменить видео: положить свой файл в assets/video/ и поправить
   data-src у <video> в index.html.
   ========================================================================== */

(function (EUF) {
  'use strict';

  EUF.initHeroVideo = function () {
    var video = document.querySelector('[data-hero-video]');
    if (!video) return;

    var src = video.dataset.src;
    if (!src) return;

    if (EUF.reducedMotion || EUF.isMobile) return;

    /* Экономия трафика и медленные сети — оставляем фото */
    var conn = navigator.connection;
    if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ''))) return;

    /* Ждём, пока hero окажется в зоне видимости (он и так первый, но так
       видео не начнёт грузиться раньше важных ресурсов страницы) */
    EUF.onEnterViewport(video, function () {
      video.src = src;
      video.load();

      video.addEventListener('canplay', function () { tryPlay(); }, { once: true });

      /* Браузер может отклонить автозапуск, если вкладка в фоне.
         Не выбрасываем видео — просто пробуем ещё раз, когда вкладку откроют. */
      function tryPlay() {
        var p = video.play();
        if (p && p.catch) {
          p.then(function () {
            video.classList.add('is-playing');
          }).catch(function () {
            document.addEventListener('visibilitychange', function onVis() {
              if (document.hidden) return;
              document.removeEventListener('visibilitychange', onVis);
              tryPlay();
            });
          });
        } else {
          video.classList.add('is-playing');
        }
      }

      /* Нет файла или кодек не поддержан — тихо убираем видео, остаётся фото */
      video.addEventListener('error', function () { video.remove(); }, { once: true });
    });
  };
})(window.EUF);
