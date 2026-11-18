import {demos} from './diagrams.mjs';
import {mountPlaygrounds} from './playgrounds.mjs';

mountPlaygrounds();

for (const figure of document.querySelectorAll('[data-demo]')) {
  const demo = demos[figure.dataset.demo];
  if (!demo) continue;
  const controls = figure.querySelector('[data-controls]');
  const update = value => {
    const result = demo.render(value);
    figure.querySelector('[data-canvas]').innerHTML = result.svg;
    figure.querySelector('[data-readout]').textContent = result.readout;
  };
  controls.hidden = false;
  const input = controls.querySelector('[data-input]');
  if (input) input.addEventListener('input', () => update(Number(input.value)));
  for (const button of controls.querySelectorAll('[data-value]')) {
    button.addEventListener('click', () => {
      for (const sibling of controls.querySelectorAll('[data-value]')) sibling.setAttribute('aria-pressed', String(sibling === button));
      const numeric = Number(button.dataset.value);
      update(Number.isNaN(numeric) ? button.dataset.value : numeric);
    });
  }
}
const filters = document.querySelector('[data-filters]');
const buttons = [...document.querySelectorAll('[data-filter]')];
const articles = [...document.querySelectorAll('.paper-explainer')];
function filter(category) {
  for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === category));
  for (const article of articles) article.hidden = category !== 'all' && article.dataset.category !== category;
  for (const link of document.querySelectorAll('[data-index-category]')) link.hidden = category !== 'all' && link.dataset.indexCategory !== category;
  const count = articles.filter(a => !a.hidden).length;
  document.querySelector('.filter-count').textContent = category === 'all' ? `Showing all ${count} papers` : `Showing ${count} papers`;
}
if (filters) {
  filters.hidden = false;
  for (const button of buttons) button.addEventListener('click', () => filter(button.dataset.filter));
}
function showHashTarget() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = articles.find(a => a.id === id);
  if (target?.hidden) { filter('all'); target.scrollIntoView({block: 'start'}); }
}
window.addEventListener('hashchange', showHashTarget);
showHashTarget();
