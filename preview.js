(() => {
  'use strict';

  let dialog = null;
  let ui = null;
  let restoreTarget = null;
  let scrollLock = null;
  let titleMotion = null;
  const pad = (value) => String(value).padStart(2, '0');

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function textValue(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(' / ');
    return '';
  }

  function getCollection() {
    const source = window.PortfolioProjects;
    if (Array.isArray(source)) return source;
    if (source && typeof source === 'object') {
      if (Array.isArray(source.projects)) return source.projects;
      return Object.values(source).filter((item) => item && typeof item === 'object' && item.id);
    }
    return [];
  }

  function lockBackground() {
    if (scrollLock) return;
    const body = document.body;
    const html = document.documentElement;
    const gap = Math.max(0, window.innerWidth - html.clientWidth);
    scrollLock = {
      x: window.scrollX,
      y: window.scrollY,
      htmlOverflow: html.style.overflow,
      htmlScrollBehavior: html.style.scrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPadding: body.style.paddingRight
    };
    if (gap) body.style.paddingRight = `${(parseFloat(getComputedStyle(body).paddingRight) || 0) + gap}px`;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
  }

  function unlockBackground() {
    if (!scrollLock) return;
    const state = scrollLock;
    scrollLock = null;
    const html = document.documentElement;
    html.style.overflow = state.htmlOverflow;
    document.body.style.overflow = state.bodyOverflow;
    document.body.style.paddingRight = state.bodyPadding;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(state.x, state.y);
    html.style.scrollBehavior = state.htmlScrollBehavior;
  }

  function afterClose() {
    if (dialog && dialog.open) return;
    if (titleMotion) titleMotion.destroy();
    titleMotion = null;
    unlockBackground();
    const target = restoreTarget;
    restoreTarget = null;
    if (target && target.isConnected && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  }

  function createDialog() {
    if (dialog) return;
    dialog = element('dialog', 'pv-dialog');
    dialog.setAttribute('aria-labelledby', 'pv-title');
    dialog.setAttribute('aria-describedby', 'pv-summary');
    dialog.innerHTML = `
      <header class="pv-header">
        <span class="pv-signature">YAO XINGRAN<span>SELECTED WORKS</span></span>
        <span class="pv-header-label">PROJECT OVERVIEW</span>
        <button class="pv-close" type="button" aria-label="关闭作品简介" autofocus><span class="pv-close-label">关闭</span><span class="pv-close-icon" aria-hidden="true"></span></button>
      </header>
      <div class="pv-layout">
        <figure class="pv-visual">
          <div class="pv-image-stage"><img class="pv-image" alt=""><span class="pv-image-error" hidden>作品图像暂时无法显示</span></div>
          <figcaption class="pv-caption"><span class="pv-caption-title"></span><span class="pv-caption-number"></span></figcaption>
        </figure>
        <section class="pv-content">
          <div class="pv-intro">
            <div class="pv-kicker"><span class="pv-category"></span><span class="pv-count"></span></div>
            <h2 class="pv-title" id="pv-title"><a class="pv-title-button" aria-describedby="pv-title-hint"><span class="pv-title-text"></span></a></h2>
            <p class="pv-title-hint" id="pv-title-hint">点击作品名称 · 阅读 PDF <span aria-hidden="true">↗</span><a class="pv-pdf-download" download>下载 PDF</a></p>
            <div class="pv-video" hidden>
              <img class="pv-video-qr" src="assets/soul/video-qr.png" width="360" height="360" alt="Soul Island 原稿中的视频二维码，扫描观看作品视频" loading="lazy">
              <div class="pv-video-copy"><p class="pv-video-label">扫码观看视频</p><span>SOUL ISLAND · VIDEO</span></div>
            </div>
            <p class="pv-english"></p>
            <p class="pv-summary" id="pv-summary"></p>
            <p class="pv-description"></p>
            <div class="pv-role"><span class="pv-fact-label">我的参与</span><p class="pv-role-text"></p></div>
            <dl class="pv-facts"></dl>
            <div class="pv-tags" aria-label="项目关键词"></div>
          </div>
          <div class="pv-action">
            <a class="pv-project-link" href="project.html"><span>View Live Project</span><span class="pv-link-arrow" aria-hidden="true">↗</span></a>
            <p class="pv-action-note">探索完整的设计过程</p>
          </div>
        </section>
      </div>`;
    document.body.append(dialog);
    ui = {
      close: dialog.querySelector('.pv-close'),
      image: dialog.querySelector('.pv-image'),
      imageError: dialog.querySelector('.pv-image-error'),
      category: dialog.querySelector('.pv-category'),
      count: dialog.querySelector('.pv-count'),
      title: dialog.querySelector('.pv-title'),
      titleLink: dialog.querySelector('.pv-title-button'),
      download: dialog.querySelector('.pv-pdf-download'),
      titleText: dialog.querySelector('.pv-title-text'),
      video: dialog.querySelector('.pv-video'),
      english: dialog.querySelector('.pv-english'),
      summary: dialog.querySelector('.pv-summary'),
      description: dialog.querySelector('.pv-description'),
      role: dialog.querySelector('.pv-role'),
      roleText: dialog.querySelector('.pv-role-text'),
      facts: dialog.querySelector('.pv-facts'),
      tags: dialog.querySelector('.pv-tags'),
      link: dialog.querySelector('.pv-project-link'),
      captionTitle: dialog.querySelector('.pv-caption-title'),
      captionNumber: dialog.querySelector('.pv-caption-number'),
      content: dialog.querySelector('.pv-content')
    };
    ui.close.addEventListener('click', close);
    ui.link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      close();
      // Release the lock before navigation so Back restores the natural Works position.
      afterClose();
    });
    dialog.addEventListener('close', afterClose);
    ui.image.addEventListener('error', () => {
      ui.image.hidden = true;
      ui.imageError.hidden = false;
    });
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const controls = [ui.close, ui.titleLink, ui.download, ui.link];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function factsFor(info) {
    if (Array.isArray(info.facts)) {
      return info.facts.map((fact) => {
        if (fact && typeof fact === 'object') return { label: textValue(fact.label), value: textValue(fact.value) };
        return { label: '项目细节', value: textValue(fact) };
      }).filter((fact) => fact.value).slice(0, 4);
    }
    if (info.facts && typeof info.facts === 'object') {
      return Object.entries(info.facts).map(([label, value]) => ({ label, value: textValue(value) })).filter((fact) => fact.value).slice(0, 4);
    }
    return [
      { label: '项目方向', value: textValue(info.category) },
      { label: '完整作品', value: Number(info.pageCount) > 0 ? `${Number(info.pageCount)} 页` : '' }
    ].filter((fact) => fact.value);
  }

  function openPreview(info) {
    if (!info || typeof info !== 'object' || Array.isArray(info) || !textValue(info.id) || !textValue(info.title)) return false;
    if (typeof HTMLDialogElement === 'undefined' || typeof HTMLDialogElement.prototype.showModal !== 'function') return false;
    createDialog();
    const collection = getCollection();
    const found = collection.findIndex((item) => item.id === info.id);
    const total = collection.length || 5;
    const index = found >= 0 ? found + 1 : (Number(info.index) > 0 ? Number(info.index) : 1);
    const title = textValue(info.title);
    const summary = textValue(info.summary);
    const description = textValue(info.introduction);
    const role = textValue(info.role);
    ui.category.textContent = textValue(info.category) || 'SELECTED PROJECT';
    ui.count.textContent = `${pad(index)} / ${pad(total)}`;
    if (titleMotion) titleMotion.destroy();
    titleMotion = null;
    ui.titleText.textContent = title;
    ui.titleLink.href = textValue(info.pdf);
    ui.titleLink.setAttribute('aria-label', `打开 ${title} 的 PDF 作品集`);
    ui.download.href = textValue(info.pdf);
    ui.download.download = `${info.id}.pdf`;
    ui.download.textContent = Number(info.pdfBytes) > 0 ? `下载 PDF · ${(Number(info.pdfBytes) / 1000000).toFixed(1)} MB` : '下载 PDF';
    ui.video.hidden = info.id !== 'soul';
    ui.english.textContent = textValue(info.english);
    ui.english.hidden = !ui.english.textContent || ui.english.textContent === title;
    ui.summary.textContent = summary;
    ui.summary.hidden = !summary;
    ui.description.textContent = description;
    ui.description.hidden = !description || description === summary;
    ui.roleText.textContent = role;
    ui.role.hidden = !role;
    ui.captionTitle.textContent = textValue(info.english) || title;
    ui.captionNumber.textContent = `PROJECT ${pad(index)}`;
    ui.image.hidden = false;
    ui.imageError.hidden = true;
    ui.image.alt = `${title}，作品封面`;
    ui.image.src = textValue(info.cover) || `assets/${encodeURIComponent(info.id)}/cover.webp`;
    ui.link.href = info.detailUrl || `project.html?project=${encodeURIComponent(info.id)}`;
    clear(ui.facts);
    for (const fact of factsFor(info)) {
      const group = element('div', 'pv-fact');
      group.append(element('dt', 'pv-fact-label', fact.label), element('dd', 'pv-fact-value', fact.value));
      ui.facts.append(group);
    }
    ui.facts.hidden = !ui.facts.childElementCount;
    clear(ui.tags);
    const tags = Array.isArray(info.tags) ? info.tags : [];
    for (const tag of tags) {
      const value = textValue(tag);
      if (value) ui.tags.append(element('span', 'pv-tag', value));
    }
    ui.tags.hidden = !ui.tags.childElementCount;
    if (!dialog.open) {
      restoreTarget = document.activeElement;
      lockBackground();
      try {
        dialog.showModal();
      } catch (error) {
        afterClose();
        return false;
      }
    }
    dialog.scrollTop = 0;
    ui.content.scrollTop = 0;
    ui.close.focus({ preventScroll: true });
    if (window.PortfolioTitleParticles) {
      try {
        titleMotion = window.PortfolioTitleParticles.mount(ui.titleLink, title);
        titleMotion.play();
      } catch (_error) {
        // The title remains a working PDF link if this decorative effect fails.
        titleMotion = null;
      }
    }
    return true;
  }

  function open(info) {
    try {
      return openPreview(info);
    } catch (_error) {
      // Return control to the card's native PDF link on unsupported browsers.
      if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
      afterClose();
      return false;
    }
  }

  function close() {
    if (!dialog || !dialog.open) return false;
    dialog.close();
    return true;
  }

  window.PortfolioPreview = { open, close, get isOpen() { return Boolean(dialog && dialog.open); } };
})();
