(() => {
  'use strict';

  const projectId = new URLSearchParams(window.location.search).get('project');
  const projects = window.PortfolioProjects || {};
  const project = Object.prototype.hasOwnProperty.call(projects, projectId) ? projects[projectId] : null;
  const page = document.getElementById('detail-page');
  const error = document.getElementById('detail-error');
  const status = document.getElementById('detail-status');
  const scroll = document.getElementById('detail-scroll');
  const gallery = document.getElementById('project-gallery');
  const previous = document.getElementById('detail-prev');
  const next = document.getElementById('detail-next');
  const progress = document.getElementById('detail-progress');
  const position = document.getElementById('detail-position');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const pad = (value) => String(value).padStart(2, '0');
  let cards = [];
  let currentIndex = 0;
  let ready = false;
  let target = 0;
  let animation = 0;
  let lastTime = 0;
  let paintFrame = 0;
  let lastDirection = 0;

  window.PortfolioProjectPage = Object.freeze({
    get id() { return project ? project.id : null; },
    get cardCount() { return cards.length; },
    get ready() { return ready; }
  });

  function report(message) {
    if (status) status.textContent = message;
  }

  function fail(message) {
    if (page) page.hidden = true;
    if (error) error.hidden = false;
    report(message);
    document.title = '未找到作品 — 姚星冉';
  }

  if (!project || !Array.isArray(project.gallery) || !project.gallery.length) {
    fail('未找到这份作品，请返回作品目录重新选择。');
    return;
  }
  if (!page || !scroll || !gallery) {
    fail('作品页面暂时无法显示，请返回目录重试。');
    return;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function fill(id, text) {
    const node = document.getElementById(id);
    if (node) node.textContent = text || '';
  }

  async function readProject(pageNumber) {
    const reader = window.PortfolioReader;
    if (!reader || typeof reader.open !== 'function') {
      report('作品阅读器暂时不可用，请稍后刷新重试。');
      return;
    }
    report('');
    try {
      if (pageNumber && typeof reader.openAt === 'function') {
        await reader.openAt(project, pageNumber);
      } else {
        await reader.open(project);
      }
    } catch (_error) {
      report('完整作品暂时无法打开，请稍后重试。');
    }
  }

  fill('project-title', project.title);
  fill('project-english', project.english);
  fill('project-category', project.category);
  fill('project-summary', project.summary);
  fill('project-number', pad(Object.keys(projects).indexOf(projectId) + 1));
  fill('project-page-count', String(project.pageCount || ''));
  document.title = `${project.title} — 姚星冉 · Selected Works`;

  const introduction = document.getElementById('project-introduction');
  if (introduction) {
    introduction.replaceChildren(...(project.introduction || []).map((text) => element('p', '', text)));
  }
  const facts = document.getElementById('project-facts');
  if (facts) {
    const nodes = [];
    (project.facts || []).forEach((fact) => {
      nodes.push(element('dt', '', fact.label), element('dd', '', fact.value));
    });
    facts.replaceChildren(...nodes);
  }
  const tags = document.getElementById('project-tags');
  if (tags) tags.replaceChildren(...(project.tags || []).map((tag) => element('span', '', tag)));

  const menu = document.getElementById('detail-menu');
  if (menu) {
    menu.replaceChildren(...Object.values(projects).map((item) => {
      const option = element('option', '', item.title);
      option.value = item.id;
      option.selected = item.id === projectId;
      return option;
    }));
    menu.addEventListener('change', () => {
      if (!Object.prototype.hasOwnProperty.call(projects, menu.value)) return;
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('project', menu.value);
      url.hash = '';
      window.location.assign(url.href);
    });
  }

  function attachParallax(button) {
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      button.style.setProperty('--parallax-x', '0px');
      button.style.setProperty('--parallax-y', '0px');
    };
    button.addEventListener('pointermove', (event) => {
      if (reducedMotion.matches || !finePointer.matches || event.pointerType === 'touch') return;
      const bounds = button.getBoundingClientRect();
      x = clamp((event.clientX - bounds.left) / bounds.width - 0.5, -0.5, 0.5) * 10;
      y = clamp((event.clientY - bounds.top) / bounds.height - 0.5, -0.5, 0.5) * 10;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        button.style.setProperty('--parallax-x', `${x.toFixed(2)}px`);
        button.style.setProperty('--parallax-y', `${y.toFixed(2)}px`);
      });
    });
    button.addEventListener('pointerleave', reset);
    button.addEventListener('pointercancel', reset);
    reducedMotion.addEventListener('change', reset);
    finePointer.addEventListener('change', reset);
  }

  const fragment = document.createDocumentFragment();
  project.gallery.slice(0, 6).forEach((item, index) => {
    const shape = ['wide', 'portrait', 'square'].includes(item.shape) ? item.shape : 'wide';
    const figure = element('figure', `detail-card detail-card--${shape}`);
    figure.dataset.cardIndex = String(index);
    const button = element('button', 'detail-image');
    button.type = 'button';
    button.setAttribute('aria-label', `查看原稿第 ${item.page} 页：${item.title}`);
    const image = element('img');
    image.src = item.src;
    image.alt = item.title;
    image.loading = index < 2 ? 'eager' : 'lazy';
    image.decoding = 'async';
    if (index === 0) image.fetchPriority = 'high';
    const metadata = window.PortfolioPageManifest?.[projectId]?.pages?.[Number(item.page) - 1];
    if (metadata?.width && metadata?.height) {
      image.width = metadata.width;
      image.height = metadata.height;
    }
    image.style.objectPosition = item.position || '50% 50%';
    image.style.transformOrigin = item.position || '50% 50%';
    image.style.setProperty('--crop-scale', String(clamp(Number(item.scale) || 1, 1, 2)));
    image.addEventListener('load', schedulePaint, { once: true });
    image.addEventListener('error', () => {
      button.classList.add('has-image-error');
      button.setAttribute('aria-label', `预览加载失败，点击查看原稿第 ${item.page} 页`);
    }, { once: true });
    button.append(image);
    button.addEventListener('click', () => readProject(Number(item.page)));
    attachParallax(button);
    const caption = element('figcaption', 'detail-card-copy');
    caption.append(
      element('span', 'detail-card-index', pad(index + 1)),
      element('h2', 'detail-card-title', item.title),
      element('p', 'detail-card-caption', item.caption),
      element('span', 'detail-card-page', `原稿 P.${pad(item.page)}`)
    );
    figure.append(button, caption);
    fragment.append(figure);
  });
  gallery.replaceChildren(fragment);
  cards = Array.from(gallery.children);
  const fullReader = document.getElementById('project-full-reader');
  if (fullReader) fullReader.addEventListener('click', () => readProject());

  function maximum() {
    return Math.max(0, scroll.scrollWidth - scroll.clientWidth);
  }

  function paint() {
    paintFrame = 0;
    if (!cards.length) return;
    const max = maximum();
    const ratio = max > 0 ? clamp(scroll.scrollLeft / max, 0, 1) : 0;
    let closest = Infinity;
    let closestIndex = 0;
    const bounds = scroll.getBoundingClientRect();
    const middle = bounds.left + scroll.clientWidth / 2;
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - middle);
      if (distance < closest) { closest = distance; closestIndex = index; }
    });
    currentIndex = scroll.scrollLeft <= 1 ? 0 : scroll.scrollLeft >= max - 1 ? cards.length - 1 : closestIndex;
    if (position) position.textContent = `${pad(currentIndex + 1)} / ${pad(cards.length)}`;
    if (progress) {
      const bar = progress.matches('span') ? progress : progress.querySelector('span');
      if (bar) bar.style.transform = `scaleX(${ratio.toFixed(5)})`;
      progress.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    }
    if (previous) previous.disabled = scroll.scrollLeft <= 1;
    if (next) next.disabled = scroll.scrollLeft >= max - 1;
  }

  function schedulePaint() {
    if (!paintFrame) paintFrame = requestAnimationFrame(paint);
  }

  function stopAnimation() {
    if (animation) cancelAnimationFrame(animation);
    animation = 0;
    lastTime = 0;
    target = scroll.scrollLeft;
    lastDirection = 0;
  }

  function animate(time) {
    animation = 0;
    const elapsed = lastTime ? clamp(time - lastTime, 1, 64) : 16;
    lastTime = time;
    target = clamp(target, 0, maximum());
    const distance = target - scroll.scrollLeft;
    if (Math.abs(distance) <= 1 || reducedMotion.matches) {
      scroll.scrollLeft = target;
      lastTime = 0;
      schedulePaint();
      return;
    }
    const previousLeft = scroll.scrollLeft;
    scroll.scrollLeft = previousLeft + distance * (1 - Math.exp(-elapsed / 115));
    // Browser zoom can quantize a small eased step to the same scroll offset.
    if (Math.abs(scroll.scrollLeft - previousLeft) < 0.01) {
      scroll.scrollLeft = target;
      lastTime = 0;
      schedulePaint();
      return;
    }
    schedulePaint();
    animation = requestAnimationFrame(animate);
  }

  function moveTo(value) {
    target = clamp(value, 0, maximum());
    if (reducedMotion.matches) {
      if (animation) cancelAnimationFrame(animation);
      animation = 0;
      lastTime = 0;
      scroll.scrollLeft = target;
      schedulePaint();
    } else if (!animation) {
      lastTime = 0;
      animation = requestAnimationFrame(animate);
    }
  }

  scroll.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.defaultPrevented) return;
    // Let a horizontal trackpad gesture use the browser's native scrolling.
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      stopAnimation();
      return;
    }
    if (!event.deltaY) return;
    const multiplier = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? scroll.clientWidth : 1;
    const delta = event.deltaY * multiplier;
    const max = maximum();
    if (max <= 1) return;
    const direction = Math.sign(delta);
    if ((direction < 0 && scroll.scrollLeft <= 1) || (direction > 0 && scroll.scrollLeft >= max - 1)) {
      stopAnimation();
      return;
    }
    event.preventDefault();
    if (!animation || (lastDirection && direction !== lastDirection)) target = scroll.scrollLeft;
    lastDirection = direction;
    moveTo(target + delta);
  }, { passive: false });

  scroll.addEventListener('scroll', () => {
    if (!animation) target = scroll.scrollLeft;
    schedulePaint();
  }, { passive: true });
  scroll.addEventListener('pointerdown', stopAnimation, { passive: true });
  scroll.addEventListener('focusin', stopAnimation);

  scroll.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    const base = animation ? target : scroll.scrollLeft;
    const step = scroll.clientWidth * 0.75;
    let value;
    if (event.key === 'ArrowRight') value = base + Math.min(220, step);
    else if (event.key === 'ArrowLeft') value = base - Math.min(220, step);
    else if (event.key === 'PageDown') value = base + step;
    else if (event.key === 'PageUp') value = base - step;
    else if (event.key === 'Home') value = 0;
    else if (event.key === 'End') value = maximum();
    else return;
    event.preventDefault();
    moveTo(value);
  });

  function step(direction) {
    moveTo((animation ? target : scroll.scrollLeft) + direction * scroll.clientWidth * 0.75);
  }
  if (previous) previous.addEventListener('click', () => step(-1));
  if (next) next.addEventListener('click', () => step(1));

  function resize() {
    stopAnimation();
    target = clamp(scroll.scrollLeft, 0, maximum());
    schedulePaint();
  }
  window.addEventListener('resize', resize, { passive: true });
  reducedMotion.addEventListener('change', () => {
    const destination = target;
    stopAnimation();
    if (reducedMotion.matches) moveTo(destination);
  });
  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(scroll);
    resizeObserver.observe(gallery);
  }

  if (error) error.hidden = true;
  page.hidden = false;
  ready = true;
  document.body.classList.add('page-ready');
  report('');
  requestAnimationFrame(() => {
    target = scroll.scrollLeft;
    paint();
  });
})();
