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

    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = 0, h = 0;
    var puffs = [];
    var running = false;
    var rafId = null;
    var lastTime = 0;

    /* На мобильных и слабых машинах клубов заметно меньше */
    var baseCount = EUF.isWeakDevice ? 9 : 18;

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
      var dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
      lastTime = time;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (var i = 0; i < puffs.length; i++) {
        var p = puffs[i];
        p.life += dt;
        p.y -= p.vy * dt;
        p.phase += p.wobble * dt;
        p.x += (p.drift + Math.sin(p.phase) * 12) * dt;
        p.r += 6 * dt;

        /* плавное появление и растворение по краям жизни клуба */
        var t = p.life / p.ttl;
        var fade = t < 0.25 ? t / 0.25 : (t > 0.7 ? (1 - t) / 0.3 : 1);
        var alpha = Math.max(0, fade) * p.alpha * opts.maxAlpha;

        if (t >= 1 || p.y + p.r < -50) {
          puffs[i] = makePuff(false);
          continue;
        }

        var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, 'rgba(' + opts.tint + ',' + alpha.toFixed(4) + ')');
        grad.addColorStop(0.45, 'rgba(' + opts.tint + ',' + (alpha * 0.35).toFixed(4) + ')');
        grad.addColorStop(1, 'rgba(' + opts.tint + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

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
