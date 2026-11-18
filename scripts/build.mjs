import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname, relative} from 'node:path';
import {demos} from '../assets/js/diagrams.mjs';
import {experimentIds, experimentMarkup} from '../assets/js/playground-view.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const papers = JSON.parse(await read('content/papers.json'));
const ids = new Set();
for (const p of papers) {
  if (!/^[a-z][a-z0-9-]*$/.test(p.id) || ids.has(p.id)) throw new Error(`Invalid or duplicate paper id: ${p.id}`);
  ids.add(p.id);
  if (!demos[p.diagram] && !experimentIds.has(p.diagram)) throw new Error(`Missing diagram for ${p.id}`);
  for (const l of p.links) if (!l.url.startsWith('https://')) throw new Error(`Expected HTTPS source for ${p.id}`);
}
const authors = p => p.authors.map(a => a === 'P. Barros' ? `<strong>${escape(a)}</strong>` : escape(a)).join(', ') + '.';
const links = p => p.links.map(l => `<a href="${escape(l.url)}">${escape(l.label)}</a>`).join(' · ');
const status = p => [escape(p.status), links(p)].filter(Boolean).join(' · ');

function publications() {
  let group = '';
  return papers.map((p, i) => {
    const heading = group === p.group ? '' : `<div class="pub-group-title">${escape(p.group)}</div>\n`;
    group = p.group;
    return `${heading}<article class="pub-card">
  <div class="pub-icon">${String(i + 1).padStart(2, '0')}</div>
  <div><h3><a class="publication-title" href="research.html#${p.id}">${escape(p.title)}</a></h3>
    <p>${authors(p)}</p><span class="pub-tag">${status(p)}</span></div>
  <a class="pub-explain" href="research.html#${p.id}" aria-label="Read the explanation of ${escape(p.title)}">Explore</a>
</article>`;
  }).join('\n');
}
function controls(id) {
  const d = demos[id];
  if (d.type === 'range') return `<label class="demo-range" for="control-${id}"><span>${escape(d.label)}</span><input id="control-${id}" type="range" min="${d.min}" max="${d.max}" value="${d.value}" data-input></label>`;
  return `<div class="demo-toggles" role="group" aria-label="${id === 'completion' ? 'Matrix display' : 'Gradient pattern'}">${d.options.map(o => `<button type="button" data-value="${o.value}" aria-pressed="${o.value === d.value}">${escape(o.label)}</button>`).join('')}</div>`;
}
function explainers() {
  return papers.map(p => {
    const expanded = experimentIds.has(p.diagram);
    const initial = expanded ? null : demos[p.diagram].render(demos[p.diagram].value);
    const overview = `
    <div class="paper-topic">${escape(p.topic)}</div>
    <h2 id="heading-${p.id}">${escape(p.shortTitle)}</h2>
    <p class="paper-full-title">${escape(p.title)}</p>
    <p class="paper-authors">${authors(p)}</p>
    <div class="paper-status">${escape(p.group === 'In Preparation' ? p.status : p.group === 'Published' ? p.status : 'Preprint · Under review')}</div>`;
    const detail = `
    <p class="paper-question">${escape(p.question)}</p>
    <p>${escape(p.idea)}</p>
    <div class="paper-result"><h3>${p.group === 'In Preparation' ? 'Research direction' : 'Main result'}</h3><p>${escape(p.result)}</p></div>
    <div class="paper-application"><div class="application-kicker">Where it matters</div><h3>${escape(p.applicationLabel)}</h3><p>${escape(p.application)}</p></div>
    ${p.links.length ? `<div class="paper-source-links">${links(p)}</div>` : ''}`;
    const visual = expanded ? experimentMarkup(p.diagram) : `
    <div class="visual-label">${p.diagram === 'completion' ? 'Explore the application' : 'Explore the idea'}</div>
    <div class="demo-canvas" data-canvas>${initial.svg}</div>
    <div class="demo-controls" data-controls hidden>${controls(p.diagram)}</div>
    <p class="demo-readout" data-readout aria-live="polite" aria-atomic="true">${escape(initial.readout)}</p>`;
    return `<article class="paper-explainer${expanded ? ' has-playground' : ''}" id="${p.id}" data-category="${p.category}" aria-labelledby="heading-${p.id}">
  <div class="paper-copy">
    ${expanded ? `<div class="paper-overview">${overview}</div><div class="paper-detail">${detail}</div>` : overview + detail}
  </div>
  <figure class="paper-visual${expanded ? ' experiment-visual' : ''}" ${expanded ? '' : `data-demo="${p.diagram}"`}>
    ${visual}
    <div class="paper-formula" aria-label="Mathematical idea">${escape(p.formula)}</div>
    <figcaption>${escape(p.caption)}</figcaption>
    <p class="visual-source-note">${escape(p.sourceNote)}</p>
  </figure>
</article>`;
  }).join('\n');
}
const shortNames = ['Halpern iteration', 'P-CRM', '3PM / A3PM', 'Deep centralization', 'FlexGrad', 'Dual dynamic programming', 'Bidirectional SDDP', 'Moving equilibria', 'Regularized SDDP'];
const common = {
  publications: publications(),
  explainers: explainers(),
  paper_index: papers.map((p, i) => `<a href="#${p.id}" data-index-category="${p.category}">${escape(shortNames[i])}</a>`).join('\n')
};
async function render(path, values, stack = []) {
  if (stack.includes(path)) throw new Error(`Circular HTML include: ${path}`);
  let html = await read(path);
  const includes = [...html.matchAll(/\{\{> ([a-z0-9/-]+)\}\}/g)];
  for (const match of includes) html = html.replace(match[0], await render(`src/${match[1]}.html`, values, [...stack, path]));
  html = html.replace(/\{\{([a-z_]+)\}\}/g, (_, name) => {
    if (!(name in values)) throw new Error(`Unknown placeholder: ${name} in ${path}`);
    return values[name];
  });
  return html;
}
for (const [page, values] of Object.entries({
  index: {title: 'Pablock', description: 'Pablo Barros — optimization, machine learning, and decisions under uncertainty. Papers, research, experience, and teaching.', page_styles: '', explained_current: ''},
  research: {title: 'Research, explained | Pablo Barros', description: 'Explore the ideas, applications, and interactive visualizations behind Pablo Barros’s nine research papers in optimization, machine learning, and stochastic programming.', page_styles: '<link rel="stylesheet" href="assets/css/research.css">', explained_current: 'aria-current="page"'}
})) {
  const output = resolve(root, `${page}.html`);
  const html = await render(`src/pages/${page}.html`, {...common, ...Object.fromEntries(Object.entries(values).map(([k,v]) => [k, ['title','description'].includes(k) ? escape(v) : v]))});
  await writeFile(output, `<!-- Generated by node scripts/build.mjs. Edit src/, content/, and assets/; see README.md. -->\n${html.replace(/[ \t]+$/gm, '')}`);
  console.log(`Built ${relative(root, output)}`);
}
