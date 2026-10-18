(() => {
  'use strict';

  const gallery = document.getElementById('works-gallery');
  const cards = Array.from(document.querySelectorAll('.orbit-card[data-orbit-index]'))
    .sort((a, b) => Number(a.dataset.orbitIndex) - Number(b.dataset.orbitIndex));
  if (!gallery || !cards.length) return;

  const count = cards.length;
  const dots = Array.from(document.querySelectorAll('.works-dot[data-work-index]'));
  const currentNumber = document.getElementById('works-current-index');
  const currentTitle = document.getElementById('works-current-title');
  const currentCategory = document.getElementById('works-current-category');
  const currentSummary = document.getElementById('works-current-summary');
  const openButton = document.getElementById('works-open');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  let phase = 0;
  let targetPhase = 0;
  let currentIndex = 0;
  let ready = false;
  let frame = 0;
  let previousTime = 0;
  let geometry = null;

  function paint() {
    if (!geometry) return;
    const { width, height, radius, centerX, sizes } = geometry;
    cards.forEach((card, index) => {
      const offset = mod(index - phase + count / 2, count) - count / 2;
      const distance = Math.abs(offset);
      const angle = offset * Math.PI / 5;
      const x = centerX + Math.cos(angle) * radius;
      const y = height / 2 + Math.sin(angle) * radius;
      const scale = 1 - Math.min(distance, 2.3) * 0.075;
      const opacity = distance <= 1
        ? 1 - distance * 0.26
        : clamp((2.45 - distance) / 1.45, 0, 1) * 0.74;
      const outside = distance >= 2.4;
      card.style.transform = `translate3d(${(x - sizes[index].width / 2).toFixed(2)}px, ${(y - sizes[index].height / 2).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(100 - Math.round(distance * 20));
      card.style.visibility = outside ? 'hidden' : 'visible';
      card.style.pointerEvents = outside ? 'none' : 'auto';
      card.setAttribute('aria-hidden', String(outside));
      card.tabIndex = index === currentIndex && !outside ? 0 : -1;
    });
    gallery.style.setProperty('--orbit-phase', phase.toFixed(5));
    gallery.style.setProperty('--orbit-stage-width', `${width}px`);
  }

  function animate(time) {
    frame = 0;
    const elapsed = previousTime ? clamp(time - previousTime, 1, 64) : 16;
    previousTime = time;
    phase += (targetPhase - phase) * (1 - Math.exp(-elapsed / 105));
    if (Math.abs(targetPhase - phase) < 0.001) phase = targetPhase;
    paint();
    if (phase !== targetPhase) frame = requestAnimationFrame(animate);
    else previousTime = 0;
  }

  function requestPaint(immediate = false) {
    if (reducedMotion.matches || immediate) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      phase = targetPhase;
      paint();
    } else if (!frame) {
      previousTime = 0;
      frame = requestAnimationFrame(animate);
    }
  }

  function updateCurrent() {
    currentIndex = mod(Math.round(targetPhase), count);
    const activeCard = cards[currentIndex];
    const projectId = activeCard.dataset.project;
    const project = window.PortfolioProjects && window.PortfolioProjects[projectId];
    if (currentNumber) currentNumber.textContent = String(currentIndex + 1).padStart(2, '0');
    if (project) {
      if (currentTitle) currentTitle.textContent = project.title;
      if (currentCategory) currentCategory.textContent = project.category;
      if (currentSummary) currentSummary.textContent = project.summary;
    }
    if (openButton) {
      openButton.dataset.project = projectId;
      openButton.href = (project && project.pdf) || activeCard.getAttribute('href');
      openButton.setAttribute('aria-label', `查看作品：${project ? project.title : projectId}`);
    }
    cards.forEach((card, index) => {
      const active = index === currentIndex;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-current', active ? 'true' : 'false');
    });
    dots.forEach(dot => {
      const active = Number(dot.dataset.workIndex) === currentIndex;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-pressed', String(active));
    });
    gallery.dispatchEvent(new CustomEvent('portfolio:workchange', {
      detail: { index: currentIndex, projectId }
    }));
  }

  function move(direction) {
    targetPhase += direction < 0 ? -1 : 1;
    // Keep long visits numerically stable without changing the visible positions.
    if (Math.abs(targetPhase) > 100000) {
      const turns = Math.trunc(targetPhase / count) * count;
      targetPhase -= turns;
      phase -= turns;
    }
    updateCurrent();
    requestPaint();
    return currentIndex;
  }

  function select(index) {
    const number = Number(index);
    if (!Number.isFinite(number)) return currentIndex;
    const wanted = mod(Math.round(number), count);
    let distance = wanted - mod(Math.round(targetPhase), count);
    if (distance > count / 2) distance -= count;
    if (distance < -count / 2) distance += count;
    targetPhase += distance;
    updateCurrent();
    requestPaint();
    return currentIndex;
  }

  function measure() {
    gallery.classList.add('orbit-ready');
    const width = gallery.clientWidth;
    const height = gallery.clientHeight;
    if (!width || !height) return;
    const radius = height * 0.56;
    const sizes = cards.map(card => ({ width: card.offsetWidth, height: card.offsetHeight }));
    const rightExtent = Math.max(...cards.map((card, index) => {
      const label = card.querySelector('.orbit-label');
      return label ? label.offsetLeft + label.offsetWidth - sizes[index].width / 2 : sizes[index].width / 2;
    }));
    // Keep the upright name beside the active cover inside narrow viewports.
    const rightInset = width < 340 ? 4 : 14;
    const activeX = Math.min(width * 0.45, width - rightExtent - rightInset);
    const centerX = activeX - radius;
    geometry = {
      width, height, radius, centerX,
      sizes
    };
    gallery.style.setProperty('--orbit-radius', `${radius}px`);
    gallery.style.setProperty('--orbit-center-x', `${centerX}px`);
    ready = true;
    paint();
  }

  const previousButton = document.getElementById('works-prev');
  const nextButton = document.getElementById('works-next');
  if (previousButton) previousButton.addEventListener('click', () => move(-1));
  if (nextButton) nextButton.addEventListener('click', () => move(1));
  dots.forEach(dot => dot.addEventListener('click', () => select(dot.dataset.workIndex)));

  gallery.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const navigationKeys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
    if (!navigationKeys.includes(event.key)) return;
    event.preventDefault();
    if (event.repeat) return;
    const followCardFocus = event.target instanceof Element && Boolean(event.target.closest('.orbit-card'));
    if (event.key === 'Home') select(0);
    else if (event.key === 'End') select(count - 1);
    else move(event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1);
    if (followCardFocus) cards[currentIndex].focus({ preventScroll: true });
  });

  let wheelAmount = 0;
  let lastWheelAt = 0;
  let lastWheelStepAt = -Infinity;
  let wheelDirection = 0;
  let wheelSteps = 0;
  let releaseWheel = false;

  function wheelEligible() {
    const rect = gallery.getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    const visibleWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    return visibleHeight >= Math.min(rect.height, innerHeight) * 0.6 &&
      visibleWidth >= Math.min(rect.width, innerWidth) * 0.6;
  }

  gallery.addEventListener('wheel', event => {
    if (event.ctrlKey || event.defaultPrevented) return;
    if (!wheelEligible()) {
      wheelAmount = 0;
      wheelSteps = 0;
      releaseWheel = false;
      return;
    }
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? gallery.clientHeight : 1;
    const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * unit;
    if (Math.abs(delta) < 0.3) return;
    const now = performance.now();
    const direction = Math.sign(delta);
    const gap = now - lastWheelAt;
    lastWheelAt = now;
    if (gap > 220) wheelAmount = 0;
    if (direction !== wheelDirection || (releaseWheel && gap > 900)) {
      wheelDirection = direction;
      wheelSteps = 0;
      releaseWheel = false;
      wheelAmount = 0;
    }
    // After one full circuit, let continued scrolling leave this section.
    if (releaseWheel) return;
    event.preventDefault();
    if (now - lastWheelStepAt < 360) return;
    wheelAmount += clamp(delta, -120, 120);
    if (Math.abs(wheelAmount) < 48) return;
    move(direction);
    lastWheelStepAt = now;
    wheelAmount = 0;
    wheelSteps += 1;
    if (wheelSteps >= count) releaseWheel = true;
  }, { passive: false });

  // Vertical touch gestures remain page scrolling; horizontal swipes browse works.
  let pointer = null;
  let suppressClickUntil = 0;
  gallery.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
  }, { passive: true });
  gallery.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.horizontal && Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      pointer.horizontal = true;
      if (typeof gallery.setPointerCapture === 'function') gallery.setPointerCapture(event.pointerId);
    }
    if (pointer.horizontal && event.cancelable) event.preventDefault();
  }, { passive: false });
  gallery.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (pointer.horizontal && Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy)) {
      move(dx < 0 ? 1 : -1);
      suppressClickUntil = performance.now() + 400;
    }
    pointer = null;
  }, { passive: true });
  gallery.addEventListener('pointercancel', () => { pointer = null; }, { passive: true });
  gallery.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(gallery);
    cards.forEach(card => resizeObserver.observe(card));
  } else window.addEventListener('resize', measure, { passive: true });
  if (typeof reducedMotion.addEventListener === 'function') reducedMotion.addEventListener('change', () => requestPaint(true));
  else if (typeof reducedMotion.addListener === 'function') reducedMotion.addListener(() => requestPaint(true));
  window.PortfolioCarousel = {
    next: () => move(1),
    previous: () => move(-1),
    select,
    get index() { return currentIndex; },
    get phase() { return phase; },
    get ready() { return ready; }
  };
  updateCurrent();
  measure();
})();
