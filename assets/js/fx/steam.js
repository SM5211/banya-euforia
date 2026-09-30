/* ==========================================================================
   Пар — главный тематический эффект сайта.
   Полупрозрачные клубы медленно поднимаются и рассеиваются поверх фото.
   Рисуется на canvas радиальными градиентами в режиме 'lighter' — дёшево
   для GPU, без blur-фильтров (они дорогие на мобильных).

   Использование:  EUF.createSteam(canvasEl, { density: 1, speed: 1 })
   Инициализируется лениво: только когда секция во вьюпорте.
   ========================================================================== */

(function (EUF) {
  'use strict';

  /* Радиус, в котором пар реагирует на палец (px) */
  var PTR_RADIUS = 150;

  EUF.createSteam = function (canvas, options) {
    if (!canvas || EUF.reducedMotion) return null;

    var opts = Object.assign({
      density: 1,        // множитель количества клубов
      speed: 1,          // множитель скорости подъёма
      tint: '232, 238, 240', // цвет пара (холодный туманно-белый)
      maxAlpha: 0.16
    }, options || {});

    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    /* dpr = 1 сознательно. Пар — размытые пятна без деталей, на удвоенном
       разрешении он выглядит так же, а пикселей рисуется вчетверо больше. */
    var dpr = 1;
    var w = 0, h = 0;
    var puffs = [];
    var running = false;
    var rafId = null;
    var lastTime = 0;

    /* Курсор (или палец) расталкивает пар — как ладонь над паром.
       Храним координаты в пикселях экрана, в координаты canvas переводим
       один раз за кадр: getBoundingClientRect в обработчике движения
       заставлял бы браузер пересчитывать раскладку на каждое шевеление. */
    var ptrClientX = null, ptrClientY = null, ptrIdle = 0;

    window.addEventListener('pointermove', function (e) {
      ptrClientX = e.clientX;
      ptrClientY = e.clientY;
      ptrIdle = 0;
    }, { passive: true });

    /* На мобильных и слабых машинах клубов заметно меньше */
    var baseCount = EUF.isWeakDevice ? 8 : 12;

    /* Клуб рисуется готовой картинкой, а не свежим градиентом каждый кадр.
       Раньше на каждый клуб создавался createRadialGradient и заливался круг
       радиусом до 400px с режимом lighter — на полноэкранном герое это
       десятки мегапикселей перерисовки в каждом кадре, отчего ноутбуки
       и захлёбывались. Спрайт готовится один раз и потом только
       растягивается — дешёвая операция даже без ускорения. */
    var sprite = (function () {
      var size = 128;
      var off = document.createElement('canvas');
      off.width = off.height = size;
      var octx = off.getContext('2d');
      var g = octx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(' + opts.tint + ',1)');
      g.addColorStop(0.45, 'rgba(' + opts.tint + ',0.35)');
      g.addColorStop(1, 'rgba(' + opts.tint + ',0)');
      octx.fillStyle = g;
      octx.fillRect(0, 0, size, size);
      return off;
    })();

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      var count = Math.round(baseCount * opts.density);
      puffs = [];
      for (var i = 0; i < count; i++) puffs.push(makePuff(true));
    }

    function makePuff(seeded) {
      var radius = EUF.rand(w * 0.14, w * 0.34);
      var ttl = EUF.rand(9, 18);
      return {
        x: EUF.rand(-0.1, 1.1) * w,
        /* seeded = стартовая раскладка по всей высоте, чтобы не ждать пара */
        y: seeded ? EUF.rand(0, h) : h + radius * 0.5,
        r: radius,
        vy: EUF.rand(6, 16) * opts.speed,          // px в секунду
        drift: EUF.rand(-9, 9),                    // боковой снос
        phase: EUF.rand(0, Math.PI * 2),
        wobble: EUF.rand(0.15, 0.4),
        /* стартовым клубам даём «возраст», иначе первые секунды пар не виден */
        life: seeded ? EUF.rand(0.25, 0.65) * ttl : 0,
        ttl: ttl,                                  // сек
        alpha: EUF.rand(0.5, 1)
      };
    }

    function step(time) {
      if (!running) return;

      /* Пар ползёт медленно, разницы между 30 и 60 кадрами глазом не видно,
         а работы ровно вдвое меньше. На ноутбуках это решает. */
      var dt = lastTime ? (time - lastTime) / 1000 : 0.033;
      if (lastTime && dt < 0.032) { rafId = requestAnimationFrame(step); return; }
      dt = Math.min(dt, 0.05);
      lastTime = time;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      /* Где сейчас палец относительно холста. Если им давно не двигали —
         влияние плавно сходит на нет, иначе пар «помнит» последнюю точку */
      var px = null, py = null, push = 0;
      if (ptrClientX !== null) {
        ptrIdle += dt;
        if (ptrIdle > 1.6) {
          ptrClientX = ptrClientY = null;
        } else {
          var box = canvas.getBoundingClientRect();
          px = ptrClientX - box.left;
          py = ptrClientY - box.top;
          push = ptrIdle < 1 ? 1 : (1.6 - ptrIdle) / 0.6;
          /* палец далеко за пределами секции — не трогаем */
          if (px < -PTR_RADIUS || px > w + PTR_RADIUS || py < -PTR_RADIUS || py > h + PTR_RADIUS) px = null;
        }
      }

      for (var i = 0; i < puffs.length; i++) {
        var p = puffs[i];
        p.life += dt;
        p.y -= p.vy * dt;
        p.phase += p.wobble * dt;
        p.x += (p.drift + Math.sin(p.phase) * 12) * dt;
        p.r += 6 * dt;

        if (px !== null) {
          var dx = p.x - px, dy = p.y - py;
          var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (dist < PTR_RADIUS) {
            /* сила падает к краю зоны; клуб отходит в сторону и чуть вверх */
            var force = (1 - dist / PTR_RADIUS) * push;
            p.x += (dx / dist) * force * 90 * dt;
            p.y += (dy / dist) * force * 40 * dt;
          }
        }

        /* плавное появление и растворение по краям жизни клуба */
        var t = p.life / p.ttl;
        var fade = t < 0.25 ? t / 0.25 : (t > 0.7 ? (1 - t) / 0.3 : 1);
        var alpha = Math.max(0, fade) * p.alpha * opts.maxAlpha;

        if (t >= 1 || p.y + p.r < -50) {
          puffs[i] = makePuff(false);
          continue;
        }

        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      rafId = requestAnimationFrame(step);
    }

    function start() {
      if (running) return;
      running = true;
      lastTime = 0;
      rafId = requestAnimationFrame(step);
    }

    function stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    });

    /* Вкладку свернули — гасим анимацию */
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    resize();
    /* Пар работает только пока его секция видна */
    EUF.observeVisibility(canvas, start, stop);
    canvas.classList.add('is-ready');

    return { start: start, stop: stop, resize: resize };
  };
})(window.EUF);
