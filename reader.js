(() => {
  'use strict';

  let manifest = null;
  let manifestLoaded = false;
  let lastError = null;
  let dialog;
  let ui;
  let project = null;
  let pageElements = [];
  let pageButtons = [];
  let currentPage = 0;
  let observer = null;
  let generation = 0;
  let zoomed = false;
  let restoreTarget = null;
  let scrollLock = null;
  const pad = (value) => String(value).padStart(2, '0');
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function loadManifest() {
    try {
      if (window.PortfolioPageManifest && typeof window.PortfolioPageManifest === 'object') {
        manifest = window.PortfolioPageManifest;
        manifestLoaded = true;
        lastError = null;
        return manifest;
      }
      const response = await fetch('assets/pages.json', { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid page manifest');
      }
      manifest = data;
      manifestLoaded = true;
      lastError = null;
      return data;
    } catch (error) {
      manifestLoaded = false;
      lastError = `作品目录暂时无法加载（${error.message}）。`;
      return null;
    }
  }

  let manifestPromise = loadManifest();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function scrollViewport(top, left, behavior) {
    if (typeof ui.viewport.scrollTo === 'function') {
      try {
        ui.viewport.scrollTo({ top, left, behavior });
        return;
      } catch (_error) { /* Fall back to scroll offsets on older engines. */ }
    }
    ui.viewport.scrollTop = top;
    ui.viewport.scrollLeft = left;
  }

  function button(className, text, label) {
    const node = element('button', className, text);
    node.type = 'button';
    if (label) node.setAttribute('aria-label', label);
    return node;
  }

  function lockBackground() {
    if (scrollLock) return;
    const body = document.body;
    const html = document.documentElement;
    const gap = Math.max(0, window.innerWidth - html.clientWidth);
    scrollLock = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPadding: body.style.paddingRight
    };
    if (gap) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + gap}px`;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
  }

  function unlockBackground() {
    if (!scrollLock) return;
    document.documentElement.style.overflow = scrollLock.htmlOverflow;
    document.body.style.overflow = scrollLock.bodyOverflow;
    document.body.style.paddingRight = scrollLock.bodyPadding;
    scrollLock = null;
  }

  function finishClose() {
    if (dialog.open) return;
    generation += 1;
    if (observer) observer.disconnect();
    observer = null;
    unlockBackground();
    const target = restoreTarget;
    restoreTarget = null;
    requestAnimationFrame(() => {
      if (target && target.isConnected && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    });
  }

  function close() {
    if (!dialog || !dialog.open) return;
    dialog.close();
    finishClose();
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = element('dialog', 'pr-reader');
    dialog.setAttribute('aria-labelledby', 'pr-reader-title');
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = `
      <header class="pr-reader__header">
        <div class="pr-reader__identity">
          <p class="pr-reader__eyebrow">PROJECT READER <span aria-hidden="true">/</span> 作品阅读</p>
          <h2 class="pr-reader__title" id="pr-reader-title"></h2>
        </div>
        <div class="pr-reader__header-actions">
          <span class="pr-reader__count" aria-label="当前页码">00 <span>/</span> 00</span>
          <button class="pr-reader__close" type="button" aria-label="关闭作品阅读器"><span>关闭</span><span class="pr-reader__cross" aria-hidden="true">×</span></button>
        </div>
      </header>
      <div class="pr-reader__toolbar">
        <div class="pr-reader__page-controls">
          <button class="pr-reader__previous" type="button" aria-label="上一页"><span aria-hidden="true">←</span><span>上一页</span></button>
          <label class="pr-reader__mobile-pages"><span class="pr-reader__sr-only">跳转至作品页面</span><select aria-label="跳转至作品页面"></select></label>
          <button class="pr-reader__next" type="button" aria-label="下一页"><span>下一页</span><span aria-hidden="true">→</span></button>
        </div>
        <button class="pr-reader__zoom" type="button" aria-pressed="false"><span class="pr-reader__zoom-icon" aria-hidden="true">＋</span><span class="pr-reader__zoom-label">放大阅读</span></button>
      </div>
      <div class="pr-reader__layout">
        <aside class="pr-reader__sidebar"><p class="pr-reader__sidebar-label">CONTENTS <span>页码</span></p><nav aria-label="作品页码目录"><ol class="pr-reader__page-list"></ol></nav><p class="pr-reader__sidebar-note">向下滚动<br>继续阅读</p></aside>
        <div class="pr-reader__viewport" tabindex="0" aria-label="作品内容，可上下滚动阅读">
          <div class="pr-reader__pages"></div>
        </div>
      </div>`;
    document.body.append(dialog);
    const find = (selector) => dialog.querySelector(selector);
    ui = {
      title: find('.pr-reader__title'),
      count: find('.pr-reader__count'),
      close: find('.pr-reader__close'),
      previous: find('.pr-reader__previous'),
      next: find('.pr-reader__next'),
      zoom: find('.pr-reader__zoom'),
      zoomLabel: find('.pr-reader__zoom-label'),
      zoomIcon: find('.pr-reader__zoom-icon'),
      select: find('select'),
      pageList: find('.pr-reader__page-list'),
      viewport: find('.pr-reader__viewport'),
      pages: find('.pr-reader__pages')
    };
    ui.close.addEventListener('click', close);
    ui.previous.addEventListener('click', () => scrollToPage(currentPage - 1));
    ui.next.addEventListener('click', () => scrollToPage(currentPage + 1));
    ui.select.addEventListener('change', () => scrollToPage(Number(ui.select.value)));
    ui.zoom.addEventListener('click', () => setZoom(!zoomed));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener('close', finishClose);
    dialog.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target.closest('select, input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'PageDown' && pageElements.length) {
        event.preventDefault();
        scrollToPage(currentPage + 1);
      } else if (event.key === 'PageUp' && pageElements.length) {
        event.preventDefault();
        scrollToPage(currentPage - 1);
      }
    });
    window.addEventListener('resize', () => {
      if (dialog.open && zoomed) setZoomWidth();
    }, { passive: true });
  }

  function setCurrentPage(index) {
    const total = pageElements.length;
    if (!total) {
      currentPage = 0;
      ui.count.textContent = '— / —';
      ui.previous.disabled = true;
      ui.next.disabled = true;
      ui.zoom.disabled = true;
      ui.select.disabled = true;
      return;
    }
    currentPage = Math.max(0, Math.min(index, total - 1));
    ui.count.textContent = `${pad(currentPage + 1)} / ${pad(total)}`;
    ui.count.setAttribute('aria-label', `第 ${currentPage + 1} 页，共 ${total} 页`);
    ui.previous.disabled = currentPage === 0;
    ui.next.disabled = currentPage === total - 1;
    ui.zoom.disabled = false;
    ui.select.disabled = false;
    ui.select.value = String(currentPage);
    pageButtons.forEach((item, itemIndex) => {
      const selected = itemIndex === currentPage;
      item.classList.toggle('is-current', selected);
      if (selected) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    const selectedButton = pageButtons[currentPage];
    if (selectedButton) {
      const sidebar = selectedButton.closest('.pr-reader__sidebar');
      const bounds = selectedButton.getBoundingClientRect();
      const sideBounds = sidebar.getBoundingClientRect();
      if (bounds.bottom > sideBounds.bottom || bounds.top < sideBounds.top + 45) {
        sidebar.scrollTop += bounds.top - sideBounds.top - 80;
      }
    }
  }

  function scrollToPage(index) {
    if (!pageElements.length) return;
    const nextIndex = Math.max(0, Math.min(index, pageElements.length - 1));
    const target = pageElements[nextIndex];
    const top = target.getBoundingClientRect().top - ui.viewport.getBoundingClientRect().top + ui.viewport.scrollTop - 18;
    setCurrentPage(nextIndex);
    scrollViewport(top, ui.viewport.scrollLeft, reduceMotion() ? 'auto' : 'smooth');
  }

  function setZoomWidth() {
    const width = Math.max(1280, Math.min(2400, Math.round(ui.viewport.clientWidth * 1.65)));
    dialog.style.setProperty('--pr-zoom-width', `${width}px`);
  }

  function setZoom(value) {
    if (!ui) return;
    const anchor = pageElements[currentPage];
    const oldHeight = anchor ? anchor.offsetHeight : 0;
    const oldOffset = anchor ? ui.viewport.scrollTop - anchor.offsetTop : 0;
    zoomed = value;
    if (value) setZoomWidth();
    dialog.classList.toggle('is-zoomed', value);
    ui.zoom.setAttribute('aria-pressed', String(value));
    ui.zoomLabel.textContent = value ? '适应屏幕' : '放大阅读';
    ui.zoomIcon.textContent = value ? '−' : '＋';
    ui.viewport.setAttribute('aria-label', value ? '作品内容，已放大，可上下及左右滚动阅读' : '作品内容，可上下滚动阅读');
    if (!value) ui.viewport.scrollLeft = 0;
    if (anchor && oldHeight) {
      ui.viewport.scrollTop = anchor.offsetTop + oldOffset * anchor.offsetHeight / oldHeight;
    }
  }

  function addIntroduction(info) {
    const intro = element('section', 'pr-reader__intro');
    intro.setAttribute('aria-label', '项目简介');
    const kicker = [info.category, info.english].filter(Boolean).join(' / ');
    if (kicker) intro.append(element('p', 'pr-reader__intro-kicker', kicker));
    if (info.summary) intro.append(element('p', 'pr-reader__summary', info.summary));
    if (info.role) {
      const role = element('p', 'pr-reader__role');
      role.append(element('span', '', '我的角色'), document.createTextNode(info.role));
      intro.append(role);
    }
    const tags = Array.isArray(info.tags) ? info.tags.filter(Boolean) : [];
    if (tags.length) {
      const list = element('ul', 'pr-reader__tags');
      list.setAttribute('aria-label', '项目标签');
      tags.forEach((tag) => list.append(element('li', '', String(tag))));
      intro.append(list);
    }
    if (intro.childNodes.length) ui.pages.append(intro);
  }

  function showMessage(message, isError, onRetry) {
    const box = element('div', `pr-reader__message${isError ? ' is-error' : ''}`);
    box.setAttribute('role', isError ? 'alert' : 'status');
    if (!isError) box.append(element('span', 'pr-reader__loading-line'));
    box.append(element('p', '', message));
    if (onRetry) {
      const retry = button('pr-reader__retry', '重新加载');
      retry.addEventListener('click', onRetry);
      box.append(retry);
    }
    ui.pages.append(box);
    return box;
  }

  function observePages() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;
    const intersecting = new Set();
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) intersecting.add(entry.target);
        else intersecting.delete(entry.target);
      }
      if (!intersecting.size) return;
      const rootBounds = ui.viewport.getBoundingClientRect();
      const readingLine = rootBounds.top + Math.min(140, rootBounds.height * 0.2);
      let best = null;
      let bestDistance = Infinity;
      for (const node of intersecting) {
        const bounds = node.getBoundingClientRect();
        const distance = bounds.top <= readingLine && bounds.bottom >= readingLine ? 0 : Math.min(Math.abs(bounds.top - readingLine), Math.abs(bounds.bottom - readingLine));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = node;
        }
      }
      if (best) setCurrentPage(Number(best.dataset.page));
    }, { root: ui.viewport, rootMargin: '-10% 0px -55% 0px', threshold: 0 });
    pageElements.forEach((node) => observer.observe(node));
  }

  function renderPage(page, index, total, token) {
    const width = Number(page.width);
    const height = Number(page.height);
    if (!page.src || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error(`第 ${index + 1} 页的信息不完整。`);
    }
    const article = element('article', 'pr-reader__page');
    article.dataset.page = String(index);
    article.setAttribute('aria-label', `第 ${index + 1} 页，共 ${total} 页`);
    const caption = element('div', 'pr-reader__page-caption');
    caption.append(element('span', '', `PAGE ${pad(index + 1)}`), element('span', '', `${pad(index + 1)} / ${pad(total)}`));
    const sheet = element('figure', 'pr-reader__sheet');
    sheet.style.aspectRatio = `${width} / ${height}`;
    const image = element('img', 'pr-reader__image');
    image.alt = `${project.title || project.english || '作品'} · 第 ${index + 1} 页`;
    image.width = Math.round(width);
    image.height = Math.round(height);
    image.loading = index === 0 ? 'eager' : 'lazy';
    image.decoding = 'async';
    if (index === 0) image.fetchPriority = 'high';
    const error = element('div', 'pr-reader__image-error');
    error.hidden = true;
    error.setAttribute('role', 'status');
    error.append(element('p', '', `第 ${index + 1} 页暂时未能加载。`));
    const retry = button('pr-reader__retry', '重试此页');
    retry.addEventListener('click', () => {
      error.hidden = true;
      const url = new URL(page.src, document.baseURI);
      url.searchParams.set('_reader_retry', String(Date.now()));
      image.src = url.href;
    });
    error.append(retry);
    image.addEventListener('error', () => {
      if (token !== generation) return;
      lastError = `第 ${index + 1} 页图像加载失败。`;
      error.hidden = false;
    });
    image.addEventListener('load', () => {
      if (token !== generation) return;
      error.hidden = true;
      image.classList.add('is-loaded');
    });
    image.src = page.src;
    sheet.append(image, error);
    article.append(caption, sheet);
    return article;
  }

  async function openReader(info) {
    if (!document.body) {
      await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }
    ensureDialog();
    const token = ++generation;
    project = info && typeof info === 'object' ? info : {};
    lastError = null;
    if (observer) observer.disconnect();
    observer = null;
    pageElements = [];
    pageButtons = [];
    clear(ui.pageList);
    clear(ui.select);
    clear(ui.pages);
    setZoom(false);
    setCurrentPage(0);
    ui.title.textContent = project.title || project.english || '作品';
    addIntroduction(project);
    const loading = showMessage('正在展开作品，请稍候。', false);
    scrollViewport(0, 0, 'auto');
    if (!dialog.open) {
      restoreTarget = document.activeElement;
      lockBackground();
      dialog.showModal();
      ui.close.focus({ preventScroll: true });
    }
    const data = await manifestPromise;
    if (token !== generation || !dialog.open) return false;
    if (loading.parentNode) loading.parentNode.removeChild(loading);
    try {
      if (!data) throw new Error(lastError || '作品目录暂时无法加载。');
      const entry = data[project.id];
      if (!entry || !Array.isArray(entry.pages) || !entry.pages.length) {
        throw new Error('这份作品的页面尚未准备好。');
      }
      const fragment = document.createDocumentFragment();
      pageElements = entry.pages.map((page, index) => renderPage(page, index, entry.pages.length, token));
      pageElements.forEach((node) => fragment.append(node));
      ui.pages.append(fragment);
      entry.pages.forEach((page, index) => {
        const item = element('li');
        const jump = button('pr-reader__page-link', pad(index + 1), `跳至第 ${index + 1} 页`);
        jump.addEventListener('click', () => scrollToPage(index));
        item.append(jump);
        ui.pageList.append(item);
        pageButtons.push(jump);
        const option = element('option', '', `${pad(index + 1)} / ${pad(entry.pages.length)}`);
        option.value = String(index);
        ui.select.append(option);
      });
      lastError = null;
      setCurrentPage(0);
      observePages();
      return true;
    } catch (error) {
      pageElements = [];
      pageButtons = [];
      setCurrentPage(0);
      lastError = error.message;
      showMessage(error.message, true, () => {
        if (!manifestLoaded) manifestPromise = loadManifest();
        open(project);
      });
      return false;
    }
  }

  async function open(info) {
    if (typeof HTMLDialogElement === 'undefined' || typeof HTMLDialogElement.prototype.showModal !== 'function') {
      lastError = '当前浏览器暂不支持作品阅读器，请直接阅读 PDF 原稿。';
      return false;
    }
    try {
      return await openReader(info);
    } catch (error) {
      lastError = error.message || '作品阅读器暂时无法打开。';
      if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
      unlockBackground();
      return false;
    }
  }

  window.PortfolioReader = Object.freeze({
    open,
    async openAt(info, pageNumber) {
      const opened = await open(info);
      if (opened) {
        const requested = Number(pageNumber);
        scrollToPage(Number.isFinite(requested) ? Math.max(0, Math.trunc(requested) - 1) : 0);
      }
      return opened;
    },
    close,
    get loaded() { return manifestLoaded; },
    get error() { return lastError; },
    get isOpen() { return Boolean(dialog && dialog.open); },
    get currentPage() { return pageElements.length ? currentPage + 1 : 0; },
    get pageCount() { return pageElements.length; },
    get ready() { return manifestPromise; }
  });
})();
