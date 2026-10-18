(function () {
  'use strict';

  const instances = new WeakMap();
  const DURATION = 1400;
  const HALO_DURATION = 850;
  const PADDING_Y = 18;
  const TAU = Math.PI * 2;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function seededRandom(text) {
    let seed = 2166136261;
    for (const char of text) seed = Math.imul(seed ^ char.codePointAt(0), 16777619);
    return function () {
      seed = Math.imul(seed ^ seed >>> 15, 1 | seed);
      seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed);
      return ((seed ^ seed >>> 14) >>> 0) / 4294967296;
    };
  }

  function mount(host, title) {
    if (!(host instanceof HTMLElement)) return { play() {}, destroy() {} };
    if (instances.has(host)) instances.get(host).destroy();

    host.classList.add('pv-title-button');
    let label = host.querySelector('.pv-title-text');
    if (!label) {
      label = document.createElement('span');
      label.className = 'pv-title-text';
      while (host.firstChild) label.appendChild(host.firstChild);
      host.appendChild(label);
    }
    if (typeof title === 'string' && label.textContent !== title) label.textContent = title;

    const canvas = document.createElement('canvas');
    canvas.className = 'title-particles';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    const context = canvas.getContext('2d');
    if (!context) {
      canvas.remove();
      return { play() {}, destroy() {} };
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let points = [];
    let halo = [];
    let frame = 0;
    let measureFrame = 0;
    let start = 0;
    let mode = 'still';
    let hasPlayed = false;
    let intersecting = true;
    let ink = '38,41,35';
    let accent = '163,76,54';

    function stopFrame() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    function measure() {
      const bounds = host.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2 || disposed) return false;
      width = bounds.width;
      height = bounds.height + PADDING_Y * 2;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const raster = document.createElement('canvas');
      raster.width = Math.ceil(width);
      raster.height = Math.ceil(height);
      const rasterContext = raster.getContext('2d', { willReadFrequently: true });
      if (!rasterContext) return false;
      rasterContext.fillStyle = '#000';
      rasterContext.textBaseline = 'alphabetic';

      // DOM character positions preserve the real responsive wrapping, kerning,
      // and letter spacing. Only ink samples become particles; no second text
      // layer is displayed over the accessible, live HTML title.
      const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let node;
      while ((node = walker.nextNode())) {
        const style = getComputedStyle(node.parentElement || label);
        rasterContext.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
        const metrics = rasterContext.measureText('Hg国');
        const fontSize = parseFloat(style.fontSize) || 40;
        const ascent = metrics.fontBoundingBoxAscent || fontSize * .88;
        const descent = metrics.fontBoundingBoxDescent || fontSize * .22;
        let index = 0;
        for (const char of node.data) {
          range.setStart(node, index);
          index += char.length;
          range.setEnd(node, index);
          if (!char.trim()) continue;
          const rect = range.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          const baseline = rect.top - bounds.top + PADDING_Y + (rect.height - ascent - descent) / 2 + ascent;
          rasterContext.fillText(char, rect.left - bounds.left, baseline);
        }
      }
      const pixels = rasterContext.getImageData(0, 0, raster.width, raster.height).data;
      const candidates = [];
      const spacing = width < 370 ? 2.7 : 3.1;
      for (let y = 1; y < raster.height - 1; y += spacing) {
        for (let x = 1; x < raster.width - 1; x += spacing) {
          const pixel = (Math.floor(y) * raster.width + Math.floor(x)) * 4;
          if (pixels[pixel + 3] > 105) candidates.push({ x, y });
        }
      }
      const random = seededRandom(label.textContent || 'Portfolio');
      const step = Math.max(1, Math.ceil(candidates.length / 1050));
      const centerX = width / 2;
      const centerY = height / 2;
      const radiusX = Math.max(12, width / 2 - 8);
      const radiusY = Math.max(16, height / 2 - 4);
      points = [];
      for (let i = 0; i < candidates.length; i += step) {
        const angle = random() * TAU;
        const spread = .76 + random() * .23;
        points.push({
          x: candidates[i].x, y: candidates[i].y,
          fromX: centerX + Math.cos(angle) * radiusX * spread,
          fromY: centerY + Math.sin(angle) * radiusY * spread,
          bend: (random() - .5) * 20,
          size: .55 + random() * .65,
          alpha: .26 + random() * .55,
          warm: random() < .17
        });
      }
      halo = Array.from({ length: width < 350 ? 22 : 30 }, (_, i) => ({
        angle: i / (width < 350 ? 22 : 30) * TAU + random() * .08,
        size: .5 + random() * .65,
        alpha: .14 + random() * .19,
        radius: .91 + random() * .07
      }));
      return true;
    }

    function drawHalo(turn, intensity) {
      const centerX = width / 2;
      const centerY = height / 2;
      const radiusX = Math.max(12, width / 2 - 6);
      const radiusY = Math.max(16, height / 2 - 3);
      for (const dot of halo) {
        const angle = dot.angle + turn;
        const x = centerX + Math.cos(angle) * radiusX * dot.radius;
        const y = centerY + Math.sin(angle) * radiusY * dot.radius;
        context.fillStyle = 'rgba(' + accent + ',' + (dot.alpha * intensity).toFixed(3) + ')';
        context.beginPath();
        context.arc(x, y, dot.size, 0, TAU);
        context.fill();
      }
    }

    function drawStill() {
      context.clearRect(0, 0, width, height);
      drawHalo(.1, .72);
    }

    function finish() {
      stopFrame();
      mode = 'still';
      host.classList.remove('is-particle-playing');
      drawStill();
    }

    function tick(now) {
      frame = 0;
      if (disposed || !intersecting || document.hidden) return finish();
      const duration = mode === 'intro' ? DURATION : HALO_DURATION;
      const progress = clamp((now - start) / duration, 0, 1);
      context.clearRect(0, 0, width, height);
      if (mode === 'intro') {
        const arrival = ease(clamp(progress / .84, 0, 1));
        const cloudOpacity = progress < .68 ? .45 + progress * .6 : Math.pow((1 - progress) / .32, 1.6);
        const bend = Math.sin(arrival * Math.PI);
        for (const dot of points) {
          const x = dot.fromX + (dot.x - dot.fromX) * arrival + dot.bend * bend;
          const y = dot.fromY + (dot.y - dot.fromY) * arrival - dot.bend * bend * .45;
          const size = dot.size + (1 - arrival) * 1.1;
          context.fillStyle = 'rgba(' + (dot.warm ? accent : ink) + ',' + (dot.alpha * cloudOpacity).toFixed(3) + ')';
          context.beginPath();
          context.arc(x, y, size, 0, TAU);
          context.fill();
        }
        drawHalo(.1 * progress, .5 + .22 * progress);
      } else {
        drawHalo(.1 + Math.sin(progress * Math.PI) * .1, .72 + Math.sin(progress * Math.PI) * .55);
      }
      if (progress >= 1) finish();
      else frame = requestAnimationFrame(tick);
    }

    function play() {
      if (disposed) return;
      stopFrame();
      if (!measure()) return;
      hasPlayed = true;
      if (motion.matches || document.hidden) return finish();
      host.classList.remove('is-particle-playing');
      // Restart the short CSS reveal in sync with the one-shot canvas motion.
      void label.offsetWidth;
      host.classList.add('is-particle-playing');
      mode = 'intro';
      start = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function awakenHalo() {
      if (disposed || motion.matches || mode === 'intro' || document.hidden || !intersecting) return;
      stopFrame();
      mode = 'halo';
      start = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function queueMeasure() {
      if (disposed || measureFrame) return;
      measureFrame = requestAnimationFrame(() => {
        measureFrame = 0;
        const bounds = host.getBoundingClientRect();
        // ResizeObserver's initial delivery must not cancel a just-started
        // entrance. Rebuild only when its actual responsive geometry changed.
        if (Math.abs(bounds.width - width) < .5 && Math.abs(bounds.height + PADDING_Y * 2 - height) < .5) return;
        if (!measure()) return;
        // Resizing settles to readable HTML instead of restarting the entrance.
        if (hasPlayed) finish();
        else drawStill();
      });
    }

    function onMotionChange() { if (motion.matches) finish(); }
    function onVisibility() { if (document.hidden) finish(); }
    host.addEventListener('pointerenter', awakenHalo);
    host.addEventListener('focusin', awakenHalo);
    document.addEventListener('visibilitychange', onVisibility);
    motion.addEventListener('change', onMotionChange);
    const resize = new ResizeObserver(queueMeasure);
    resize.observe(host);
    const visible = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      intersecting = entries[0].isIntersecting;
      if (!intersecting) finish();
    }) : null;
    if (visible) visible.observe(host);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!disposed) queueMeasure(); });

    const api = {
      play,
      destroy() {
        if (disposed) return;
        disposed = true;
        stopFrame();
        if (measureFrame) cancelAnimationFrame(measureFrame);
        resize.disconnect();
        if (visible) visible.disconnect();
        host.removeEventListener('pointerenter', awakenHalo);
        host.removeEventListener('focusin', awakenHalo);
        document.removeEventListener('visibilitychange', onVisibility);
        motion.removeEventListener('change', onMotionChange);
        host.classList.remove('is-particle-playing');
        canvas.remove();
        instances.delete(host);
      }
    };
    instances.set(host, api);
    return api;
  }

  window.PortfolioTitleParticles = Object.freeze({ mount });
}());
