'use strict';

document.querySelectorAll('[data-project]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const projectId = link.dataset.project;
    const collection = window.PortfolioProjects;
    const project = collection && Object.prototype.hasOwnProperty.call(collection, projectId) ? collection[projectId] : null;
    const preview = window.PortfolioPreview;
    try {
      if (project && preview && typeof preview.open === 'function' && preview.open(project) === true) {
        event.preventDefault();
        return;
      }
    } catch (_error) {
      // Keep the real link usable when a preview dependency is unavailable.
    }
  });
});

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
  }), {threshold:0.08});
  document.querySelectorAll('.reveal').forEach(item => revealObserver.observe(item));
  const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('is-current', link.hash === `#${entry.target.id}`));
  }), {rootMargin:'-15% 0px -65% 0px', threshold:0});
  document.querySelectorAll('main > section[id]').forEach(section => navObserver.observe(section));
} else document.querySelectorAll('.reveal').forEach(item => item.classList.add('is-visible'));

let queued = false;
const pageProgress = document.querySelector('.page-progress i');
const siteHeader = document.querySelector('.site-header');
function updateScroll() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (pageProgress) pageProgress.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0})`;
  if (siteHeader) siteHeader.classList.toggle('is-scrolled', window.scrollY > 30);
  queued = false;
}
window.addEventListener('scroll', () => { if (!queued) { requestAnimationFrame(updateScroll); queued = true; } }, {passive:true});
updateScroll();
window.addEventListener('pageshow', () => document.body.classList.add('page-ready'));
document.body.classList.add('page-ready');
