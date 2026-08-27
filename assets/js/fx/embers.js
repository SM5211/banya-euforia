/* ==========================================================================
   Огонь: редкие искры от дровяной печи + тёплое мерцание.
   Один сдержанный акцент в секции про русскую парную — не фейерверк.
   На слабых устройствах искр вдвое меньше.

   Использование: <canvas data-embers></canvas> (инициализирует app.js лениво)
   ========================================================================== */

(function (EUF) {
  'use strict';

  EUF.createEmbers = function (canvas, options) {
    if (!canvas || EUF.reducedMotion) return null;

    var opts = Object.assign({ count: EUF.isWeakDevice ? 14 : 28 }, options || {});
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = 0, h = 0, sparks = [], running = false, rafId = null, lastTime = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sparks = [];
      for (var i = 0; i < opts.count; i++) sparks.push(makeSpark(true));
    }

    function makeSpark(seeded) {
      var ttl = EUF.rand(2.6, 6);
      return {
        x: EUF.rand(0.05, 0.95) * w,
        y: seeded ? EUF.rand(0, h) : h + 10,
        r: EUF.rand(0.8, 2.1),
        vy: EUF.rand(18, 46),            // px/сек вверх
        drift: EUF.rand(-14, 14),
        phase: EUF.rand(0, Math.PI * 2),
        life: seeded ? EUF.rand(0, ttl * 0.7) : 0,
        ttl: ttl
      };
    }

    function step(time) {
      if (!running) return;
      var dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
      lastTime = time;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (var i = 0; i < sparks.length; i++) {
        var s = sparks[i];
        s.life += dt;
        s.y -= s.vy * dt;
        s.phase += dt * 2;
        s.x += (s.drift + Math.sin(s.phase) * 10) * dt;

        var t = s.life / s.ttl;
        if (t >= 1 || s.y < -10) { sparks[i] = makeSpark(false); continue; }

        /* искра ярко вспыхивает и гаснет, слегка мерцая */
        var flicker = 0.65 + Math.sin(s.phase * 3) * 0.35;
        var alpha = Math.sin(Math.PI * t) * flicker;

        var grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
        grad.addColorStop(0, 'rgba(255, 214, 150,' + (alpha * 0.95).toFixed(3) + ')');
        grad.addColorStop(0.4, 'rgba(224, 145, 63,' + (alpha * 0.5).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(168, 91, 30, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      rafId = requestAnimationFrame(step);
    }

    function start() { if (running) return; running = true; lastTime = 0; rafId = requestAnimationFrame(step); }
    function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    });
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    resize();
    EUF.observeVisibility(canvas, start, stop);
    canvas.classList.add('is-ready');

    return { start: start, stop: stop, resize: resize };
  };
})(window.EUF);
