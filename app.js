'use strict';
const projects = window.PortfolioProjects;

document.querySelectorAll('[data-project]').forEach(button => {
  button.addEventListener('click', () => window.PortfolioPreview.open(projects[button.dataset.project]));
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
function updateScroll() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  document.querySelector('.page-progress i').style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0})`;
  document.querySelector('.site-header').classList.toggle('is-scrolled', window.scrollY > 30);
  queued = false;
}
window.addEventListener('scroll', () => { if (!queued) { requestAnimationFrame(updateScroll); queued = true; } }, {passive:true});
updateScroll();
window.addEventListener('pageshow', () => document.body.classList.add('page-ready'));
document.body.classList.add('page-ready');
