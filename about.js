/* Scroll-driven page turns for the experience timeline. */
(() => {
  'use strict';

  function initialize() {
    const section = document.querySelector('#about.about-exhibition');
    if (!section) return;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const supportsObserver = 'IntersectionObserver' in window;
    const values = new WeakMap();
    let entries = [];
    let visible = false;
    let reduced = motionPreference.matches;
    let frame = 0;
    let forceNextFrame = false;

    const clamp = value => Math.max(0, Math.min(1, value));

    function layoutTop(element) {
      let top = 0;
      for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
      return top;
    }

    function writeEntry(entry, turn, lift, opacity) {
      const next = [turn.toFixed(3), lift.toFixed(3), opacity.toFixed(3)];
      const previous = values.get(entry);
      if (previous && next.every((value, index) => value === previous[index])) return;
      entry.style.setProperty('--page-turn', `${next[0]}deg`);
      entry.style.setProperty('--page-lift', `${next[1]}px`);
      entry.style.setProperty('--page-opacity', next[2]);
      values.set(entry, next);
    }

    function update() {
      frame = 0;
      const forced = forceNextFrame;
      forceNextFrame = false;
      if (document.hidden) return;

      if (reduced) {
        entries.forEach(entry => writeEntry(entry, 0, 0, 1));
        return;
      }
      if (supportsObserver && !visible && !forced) return;

      // Complete all geometry reads before applying any transforms.
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const sectionRect = section.getBoundingClientRect();
      visible = sectionRect.bottom > 0 && sectionRect.top < viewportHeight;
      if (!visible) return;
      // Measure layout offsets, so an entry's own rotation cannot feed back
      // into the next frame's progress or react to a card's hover transform.
      const sectionLayoutTop = layoutTop(section);
      const positions = entries.map(entry => {
        const top = sectionRect.top + layoutTop(entry) - sectionLayoutTop;
        return { entry, rect: { top, bottom: top + entry.offsetHeight } };
      });
      const entryStart = viewportHeight * 0.68;
      const entryRange = Math.max(1, viewportHeight - entryStart);
      const exitStart = viewportHeight * 0.14;

      const updates = positions.map(({ entry, rect }) => {
        let turn = 0;
        let lift = 0;
        let opacity = 1;

        if (rect.top > entryStart) {
          const progress = clamp((rect.top - entryStart) / entryRange);
          turn = 16 * progress;
          lift = 10 * progress;
          opacity = 1 - 0.06 * progress;
        } else if (rect.bottom < exitStart) {
          const progress = clamp((exitStart - rect.bottom) / Math.max(1, exitStart));
          turn = -5 * progress;
          lift = -3 * progress;
        }

        return { entry, turn, lift, opacity };
      });
      updates.forEach(({ entry, turn, lift, opacity }) => writeEntry(entry, turn, lift, opacity));
    }

    function schedule(force = false) {
      if (document.hidden || (reduced && !force)) return;
      if (supportsObserver && !visible && !force) return;
      forceNextFrame = forceNextFrame || force;
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    function refresh() {
      entries = Array.from(section.querySelectorAll('.experience-timeline > .timeline-entry[data-scroll-card]'));
      schedule(true);
    }

    if (supportsObserver) {
      const observer = new IntersectionObserver(records => {
        visible = records.some(record => record.isIntersecting);
        if (visible) schedule(true);
      }, { threshold: 0 });
      observer.observe(section);
    }

    function handleMotionChange(event) {
      reduced = event.matches;
      schedule(true);
    }

    if (typeof motionPreference.addEventListener === 'function') {
      motionPreference.addEventListener('change', handleMotionChange);
    } else if (typeof motionPreference.addListener === 'function') {
      motionPreference.addListener(handleMotionChange);
    }

    window.addEventListener('scroll', () => schedule(), { passive: true });
    window.addEventListener('resize', () => schedule(true), { passive: true });
    window.addEventListener('hashchange', () => schedule(true));
    window.addEventListener('pageshow', () => schedule(true));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) schedule(true);
    });

    window.PortfolioAboutMotion = Object.freeze({
      refresh,
      get active() { return visible; },
      get reducedMotion() { return reduced; }
    });

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
