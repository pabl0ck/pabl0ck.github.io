// Static and live rendering share the same computed trajectories.
import {projectionRun, projectionPresets, affineRun, a3pmStep, circumcenter, add, sub, mul, dot, norm, distance} from './projection-math.mjs';
import {objectives, optimizerRun} from './optimizer-math.mjs';
export const experimentIds = new Set(['halpern', 'polyhedral', 'pcrm', 'flexgrad']);
export const scene = {width: 640, height: 400, cx: 320, cy: 200, scale: 62};
export const sx = x => scene.cx + scene.scale * x;
export const sy = y => scene.cy - scene.scale * y;
export const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const num = value => Number(value.toFixed(3));
export const format = value => value === 0 ? '0' : value < .001 || value >= 1000 ? value.toExponential(2) : value.toFixed(3);
const palette = ['#ae9bfa', '#7dd7d0', '#f4a9c5', '#9bbcf9', '#e7bc73', '#d598f4', '#91d0a0', '#ec9c7b'];
const line = (a, b, color, extra = '') => `<line x1="${num(a[0])}" y1="${num(a[1])}" x2="${num(b[0])}" y2="${num(b[1])}" stroke="${color}" ${extra}/>`;
const txt = (x, y, value, color = '#a9bad2', extra = '') => `<text x="${num(x)}" y="${num(y)}" fill="${color}" ${extra}>${escape(value)}</text>`;
const polyline = (points, color, extra = '') => `<polyline points="${points.map(p => p.map(num).join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const pin = (p, color, radius = 5) => `<circle cx="${num(p[0])}" cy="${num(p[1])}" r="${radius}" fill="${color}" stroke="#0a1121" stroke-width="2"/>`;
function svg(id, title, description, inner, height = 400) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${height}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${escape(title)}</title><desc id="${id}-desc">${escape(description)}</desc><defs><pattern id="${id}-grid" width="31" height="31" patternUnits="userSpaceOnUse"><path d="M31 0H0V31" stroke="#96aaca" stroke-opacity=".085" fill="none"/></pattern></defs><rect width="640" height="${height}" fill="#0a1121"/><rect width="640" height="${height}" fill="url(#${id}-grid)"/>${inner}</svg>`;
}
function clipPolygon(polygon, cut) {
  const next = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = dot(cut.n, a) - cut.b, db = dot(cut.n, b) - cut.b;
    if (da <= 0) next.push(a);
    if (da * db < 0) next.push(add(a, mul(sub(b, a), da / (da - db))));
  }
  return next;
}
function shape(set, extra = '') {
  if (set.type === 'disk') return `<circle cx="${num(sx(set.c[0]))}" cy="${num(sy(set.c[1]))}" r="${num(set.r * scene.scale)}" ${extra}/>`;
  if (set.type === 'box') return `<rect x="${num(sx(set.lo[0]))}" y="${num(sy(set.hi[1]))}" width="${num((set.hi[0] - set.lo[0]) * scene.scale)}" height="${num((set.hi[1] - set.lo[1]) * scene.scale)}" ${extra}/>`;
  const p = clipPolygon([[-6,-4],[6,-4],[6,4],[-6,4]], set);
  return `<polygon points="${p.map(p => `${num(sx(p[0]))},${num(sy(p[1]))}`).join(' ')}" ${extra}/>`;
}
const center = set => set.type === 'disk' ? set.c : mul(add(set.lo, set.hi), .5);
function projectionScene(state, run) {
  const id = `${state.id}-scene`, k = state.iteration;
  let inner = line([15, sy(0)], [625, sy(0)], '#263750') + line([sx(0), 15], [sx(0), 385], '#263750');
  inner += `<defs>${state.sets.map((s, i) => `<clipPath id="${id}-set-${i}">${shape(s)}</clipPath>`).join('')}</defs>`;
  if (state.sets.length) {
    let common = '<rect width="640" height="400" fill="#9eece7" fill-opacity=".13"/>';
    for (let i = 0; i < state.sets.length; i++) common = `<g clip-path="url(#${id}-set-${i})">${common}</g>`;
    inner += common;
  }
  state.sets.forEach((s, i) => {
    const color = palette[i % palette.length], c = center(s);
    inner += shape(s, `fill="${color}" fill-opacity=".035" stroke="${color}" stroke-opacity=".7" stroke-width="1.8"`);
    inner += pin([sx(c[0]), sy(c[1])], color, 3) + txt(sx(c[0]) + 8, sy(c[1]) - 8, `C${i + 1}`, color, 'class="scene-set-name"');
  });
  if (run.series.length && state.showCuts) {
    const current = run.series[0].points[k];
    const {cuts} = a3pmStep(current, state.sets, state.eps);
    let polygon = [[-5.2,-3.2],[5.2,-3.2],[5.2,3.2],[-5.2,3.2]];
    for (const cut of cuts) {
      polygon = clipPolygon(polygon, cut);
      const c = mul(cut.n, cut.b), tangent = [-cut.n[1] * 10, cut.n[0] * 10];
      inner += line([sx(c[0] - tangent[0]), sy(c[1] - tangent[1])], [sx(c[0] + tangent[0]), sy(c[1] + tangent[1])], '#e6bd70', 'stroke-width="1.2" stroke-dasharray="6 6" opacity=".6"');
    }
    if (cuts.length) inner += `<polygon points="${polygon.map(p => `${num(sx(p[0]))},${num(sy(p[1]))}`).join(' ')}" fill="#f8cb65" fill-opacity=".035"/>`;
  }
  for (const series of [...run.series].reverse()) {
    inner += polyline(series.points.slice(0, k + 1).map(p => [sx(p[0]), sy(p[1])]), series.color);
    const p = series.points[k]; inner += pin([sx(p[0]), sy(p[1])], series.color, 5.5);
  }
  if (run.target && state.id === 'halpern') {
    inner += `<circle cx="${num(sx(run.target[0]))}" cy="${num(sy(run.target[1]))}" r="8" fill="none" stroke="#eef4ff" stroke-width="1.7"/>`;
    inner += txt(sx(run.target[0]) + 13, sy(run.target[1]) + 20, 'closest feasible point', '#dce8fa', 'class="scene-small"');
  }
  inner += pin([sx(state.start[0]), sy(state.start[1])], '#eef4ff', 5) + txt(sx(state.start[0]) + 10, sy(state.start[1]) - 11, 'start / anchor', '#edf3ff', 'class="scene-small"');
  if (state.draft) inner += shape(state.draft, 'fill="#d1c3ff" fill-opacity=".08" stroke="#e2d4ff" stroke-width="1.5" stroke-dasharray="5 4"');
  inner += txt(615, sy(0) - 8, 'x', '#7185a3') + txt(sx(0) + 9, 22, 'y', '#7185a3');
  return svg(id, 'Draw convex constraints and compare projection trajectories', `${state.sets.length} constraints. Sweep ${k}.${state.id === 'halpern' ? ' The white ring marks the best approximation.' : ' Compare A3PM, MAP, and Cimmino trajectories.'}`, inner);
}
function errorChart(id, series, iteration, metric = 'errors', title = 'Error', floor = 1e-10) {
  const left = 67, right = 619, top = 26, bottom = 166, end = Math.max(20, iteration);
  const initial = Math.max(floor * 10, ...series.map(s => (s[metric] || [0])[0]));
  const shown = series.flatMap(s => (s[metric] || []).slice(0, iteration + 1));
  const smallest = Math.max(floor, Math.min(...shown));
  const high = Math.max(-1, Math.ceil(Math.log10(initial)));
  const low = Math.max(Math.log10(floor), Math.min(high - 2, Math.floor(Math.log10(smallest)) - 1));
  const xx = k => left + (right - left) * k / end;
  const yy = e => bottom - (bottom - top) * (Math.log10(Math.max(floor, e)) - low) / (high - low);
  let inner = '';
  for (const exponent of [high, Math.round((high + low) / 2), low]) {
    const y = yy(10 ** exponent);
    inner += line([left, y], [right, y], '#2c3d56', 'stroke-opacity=".7"') + txt(left - 10, y + 5, `10${superscript(Math.round(exponent))}`, '#8fa4c0', 'text-anchor="end" class="chart-axis"');
  }
  for (const x of [0, Math.floor(end / 2), end]) inner += txt(xx(x), 190, x, '#8fa4c0', 'text-anchor="middle" class="chart-axis"');
  for (const s of series) {
    const values = s[metric] || [];
    inner += polyline(values.slice(0, iteration + 1).map((e, k) => [xx(k), yy(e)]), s.color, s.id === 'dykstra' || s.id === 'adagrad' ? 'stroke-dasharray="6 4"' : '');
    if (values.length) inner += pin([xx(iteration), yy(values[iteration])], s.color, 3.5);
  }
  inner += txt(69, 17, `${title} · logarithmic scale`, '#b5c8e2', 'class="chart-axis"') + txt(620, 210, 'outer sweeps / iterations', '#8fa4c0', 'text-anchor="end" class="chart-axis"');
  return svg(`${id}-chart`, `${title} comparison`, `Log-scale errors over iterations. Values smaller than ${floor} are shown at the chart floor.`, inner, 220);
}
function superscript(value) {const chars = {'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'}; return String(value).split('').map(c => chars[c]).join('');}
function legend(series) {return `<div class="experiment-legend">${series.map(s => `<span><i style="background:${s.color}"></i>${escape(s.name)}</span>`).join('')}</div>`;}
function projectionMetrics(state, run) {
  const k = state.iteration, title = state.id === 'halpern' ? 'Distance to projection' : 'Max. constraint violation';
  if (!run.series.length) return `<div class="experiment-empty">${!state.sets.length ? 'Draw a disk or box to create your problem.' : 'These sets have no common point. Undo an edit, move a set, or load a preset.'}</div>`;
  return `${legend(run.series)}${errorChart(state.id, run.series, k, 'errors', title)}<div class="experiment-table-wrap"><table class="experiment-table"><caption class="sr-only">Current ${escape(title.toLowerCase())} and set-projection counts</caption><thead><tr><th scope="col">Method</th><th scope="col">${state.id === 'halpern' ? 'Distance' : 'Violation'}</th><th scope="col">Set projections</th></tr></thead><tbody>${run.series.map(s => `<tr><th scope="row"><i style="background:${s.color}"></i>${escape(s.name)}</th><td>${format(s.errors[k])}</td><td>${k * state.sets.length}</td></tr>`).join('')}</tbody></table></div><p class="experiment-footnote">One sweep uses one projection onto each set. A3PM additionally combines separating half-spaces. Values below 10⁻¹⁰ sit at the chart floor.</p>`;
}
export function defaultState(id) {
  if (id === 'halpern' || id === 'polyhedral') {
    const preset = projectionPresets.lens;
    return {id, preset: 'lens', sets: structuredClone(preset.sets), start: [...preset.start], eps: .1, iteration: id === 'halpern' ? 12 : 3, max: id === 'halpern' ? 240 : 160, mode: 'disk', showCuts: false};
  }
  if (id === 'pcrm') return {id, angle: 30, yaw: -32, iteration: 2, max: 35};
  return {id, objective: 'huber', start: [...objectives.huber.start], scale: .28, metric: 'average', iteration: 12, max: 180};
}
export function compute(state) {
  if (state.id === 'halpern' || state.id === 'polyhedral') return projectionRun(state.id, state.sets, state.start, {eps: state.eps, steps: state.max});
  if (state.id === 'pcrm') return affineRun(state.angle, state.max);
  return optimizerRun(state.objective, state.start, state.scale, state.max);
}
function playback(state) {
  return `<div class="experiment-playback" data-interactive hidden><button type="button" data-action="run">Run comparison</button><button type="button" data-action="step">Step</button><button type="button" data-action="reset">Reset steps</button><label for="${state.id}-iteration">${state.id === 'halpern' || state.id === 'polyhedral' ? 'Sweep' : 'Iteration'} <output data-step-output>${state.iteration}</output></label><input id="${state.id}-iteration" data-iteration type="range" min="0" max="${state.max}" value="${state.iteration}" aria-label="${state.id} iteration"></div>`;
}
function numericEditor(state) {
  return `<details class="constraint-editor" data-interactive hidden><summary>Edit constraints and starting point with numbers</summary><div class="constraint-fields"><label>Constraint<select data-set-select aria-label="${state.id} selected constraint"></select></label><label>Center x<input data-center-x type="number" min="-4.5" max="4.5" step="0.1" value="0"></label><label>Center y<input data-center-y type="number" min="-2.7" max="2.7" step="0.1" value="0"></label><label data-radius-label>Radius<input data-radius type="number" min="0.15" max="5" step="0.1" value="1"></label><label data-width-label hidden>Width<input data-width type="number" min="0.3" max="9" step="0.1" value="2"></label><label data-height-label hidden>Height<input data-height type="number" min="0.3" max="5.6" step="0.1" value="2"></label><button type="button" data-action="apply-set">Update constraint</button><button type="button" data-action="add-disk">Add disk</button><button type="button" data-action="add-box">Add box</button></div><div class="start-fields"><label>Start x<input data-start-x type="number" step="0.1" min="-4.5" max="4.5" value="${state.start[0]}"></label><label>Start y<input data-start-y type="number" step="0.1" min="-2.7" max="2.7" value="${state.start[1]}"></label><button type="button" data-action="apply-start">Set starting point</button></div></details>`;
}
function projectionControls(state) {
  return `<div class="experiment-setup" data-interactive hidden><label>Example<select data-preset aria-label="${state.id} example">${Object.entries(projectionPresets).map(([id,p]) => `<option value="${id}">${escape(p.label)}</option>`).join('')}</select></label><label class="accuracy-control">Approximation ε <output data-eps-output>0.10</output><input data-eps type="range" min="0" max="60" value="10" aria-label="${state.id} approximation accuracy"></label><label class="cut-control"><input data-cuts type="checkbox">Show separating half-spaces</label></div>`;
}
function drawingToolbar(state) {
  return `<div class="drawing-toolbar" data-interactive hidden role="group" aria-label="${state.id} drawing tools">${[['disk','Draw disk'],['box','Draw box'],['move','Move set'],['start','Start point']].map(([mode,label]) => `<button type="button" data-mode="${mode}" aria-pressed="${mode === state.mode}">${label}</button>`).join('')}<button type="button" data-action="undo">Undo</button><button type="button" data-action="clear">Clear sets</button></div>`;
}
function pcrmScene(state, run) {
  const k = state.iteration, x = run.pcrm[k], refs = run.reflections[k], c = run.pcrm[k + 1] || circumcenter([x, ...refs]);
  const yaw = state.yaw * Math.PI / 180, elevation = 24 * Math.PI / 180;
  const project = p => [320 + 56 * (Math.cos(yaw) * p[0] - Math.sin(yaw) * p[1]), 200 - 56 * (Math.sin(elevation) * (Math.sin(yaw) * p[0] + Math.cos(yaw) * p[1]) + Math.cos(elevation) * p[2])];
  let inner = `<polygon points="${[[-3,-2.5,0],[3,-2.5,0],[3,2.5,0],[-3,2.5,0]].map(p=>project(p).map(num).join(',')).join(' ')}" fill="#8b94cd" fill-opacity=".045"/>`;
  for (let i = -3; i <= 3; i++) {
    inner += line(project([i,-3,0]),project([i,3,0]),'#445375','stroke-opacity=".3"');
    inner += line(project([-3,i,0]),project([3,i,0]),'#445375','stroke-opacity=".3"');
  }
  inner += line(project([0,0,0]),project([0,0,3.1]),'#6984aa','stroke-opacity=".5" stroke-dasharray="3 6"');
  inner += line(project(mul(run.u,-3.6)),project(mul(run.u,3.6)),'#c1a7ff','stroke-width="2"') + line(project(mul(run.v,-3.6)),project(mul(run.v,3.6)),'#f29cbc','stroke-width="2"');
  const radius = distance(x,c);
  if (radius > 1e-8) {
    const e1 = mul(sub(x,c),1/radius), raw = sub(refs[0],c), ortho = sub(raw,mul(e1,dot(raw,e1))), length = norm(ortho);
    if (length > 1e-9) {
      const e2 = mul(ortho,1/length), circle = Array.from({length:81},(_,i)=>project(add(c,add(mul(e1,radius*Math.cos(i*Math.PI/40)),mul(e2,radius*Math.sin(i*Math.PI/40))))));
      inner += polyline(circle,'#f8cb65','stroke-width="1.4" opacity=".5"');
    }
    inner += polyline([x,...refs,x].map(project),'#9dafcc','stroke-width="1.4" stroke-dasharray="5 5" opacity=".6"');
    for(const p of refs) inner += line(project(p),project(c),'#f8cb65','stroke-dasharray="2 5" opacity=".35"');
  }
  inner += polyline(run.map.slice(0,state.iteration+1).map(project),'#b49aff','stroke-dasharray="5 4" opacity=".8"') + polyline(run.pcrm.slice(0,state.iteration+1).map(project),'#38d9ed');
  inner += pin(project(x),'#38d9ed',6);
  if(norm(x)>.07) inner += txt(project(x)[0]+10,project(x)[1]-10,'xₖ','#8ceaf5','class="scene-small"');
  refs.forEach((p,i)=> {inner += pin(project(p),['#c1a7ff','#f29cbc'][i],4.5);});
  inner += pin(project(c),'#f8cb65',5);
  if(norm(x)>.07) inner += txt(project(c)[0]+10,project(c)[1]+19,'next circumcenter','#f8cb65','class="scene-small"');
  inner += pin(project([0,0,0]),'#fff',4) + txt(project([0,0,0])[0]-17,project([0,0,0])[1]+35,'U ∩ V','#e1eafb','class="scene-small"');
  inner += txt(project(mul(run.u,3.5))[0]+4,project(mul(run.u,3.5))[1]-8,'U','#c1a7ff') + txt(project(mul(run.v,3.5))[0]+5,project(mul(run.v,3.5))[1]-8,'V','#f29cbc');
  inner += txt(22,28,'TWO LINES IN 3D · OUT-OF-PLANE START','#a4b8d3','class="scene-small"');
  return svg('pcrm-scene','P-CRM on two intersecting lines in three dimensions','The current point and its independent reflections span a triangle in three dimensions. Its circumcenter gives the next iterate. The two lines meet at the origin.',inner);
}
function pcrmMetrics(state, run) {
  const k=state.iteration, series=[{id:'pcrm',name:'P-CRM',color:'#38d9ed',errors:run.pcrm.map(norm)},{id:'map',name:'MAP',color:'#b49aff',errors:run.map.map(norm)}];
  const x=run.pcrm[k], refs=run.reflections[k];
  const vector=p=>p.map(v=>v.toFixed(2)).join(', ');
  return `${legend(series)}${errorChart('pcrm',series,k,'errors','Distance to intersection')}<div class="parallel-lanes"><div><span>Independent reflection</span><strong>Rᵤ(xₖ)</strong><code>(${vector(refs[0])})</code></div><div><span>Independent reflection</span><strong>Rᵥ(xₖ)</strong><code>(${vector(refs[1])})</code></div></div><div class="circumcenter-result"><span>Combine by circumcenter</span><strong>‖xₖ‖ = ${format(norm(x))}</strong></div><p class="experiment-footnote">The numerical trajectories are computed in ℝ³; the display is a rotatable 2D view. The reflection operations are independent. No processor speedup is simulated.</p>`;
}
const contourCache = new Map();
function contourLines(id) {
  if(contourCache.has(id)) return contourCache.get(id);
  const f=objectives[id], min=f.value(f.minimizer), lines=[], nx=75,ny=50;
  const xx=i=>-5+i*10/nx, yy=j=>-3+j*6/ny;
  const values=Array.from({length:ny+1},(_,j)=>Array.from({length:nx+1},(_,i)=>f.value([xx(i),yy(j)])-min));
  for(const [levelIndex,level] of f.levels.entries()) {
    let d='';
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++) {
      const vertices=[[xx(i),yy(j)],[xx(i+1),yy(j)],[xx(i+1),yy(j+1)],[xx(i),yy(j+1)]], v=[values[j][i],values[j][i+1],values[j+1][i+1],values[j+1][i]], crossings=[];
      for(let e=0;e<4;e++) {const next=(e+1)%4;if((v[e]<level)!==(v[next]<level)){const t=(level-v[e])/(v[next]-v[e]);crossings.push(add(vertices[e],mul(sub(vertices[next],vertices[e]),t)));}}
      for(let z=0;z+1<crossings.length;z+=2) d+=`M${num(sx(crossings[z][0]))},${num(sy(crossings[z][1]))}L${num(sx(crossings[z+1][0]))},${num(sy(crossings[z+1][1]))}`;
    }
    lines.push(`<path d="${d}" stroke="#b59bfa" stroke-opacity="${.17+levelIndex*.045}" stroke-width="1.2" fill="none"/>`);
  }
  const result=lines.join('');contourCache.set(id,result);return result;
}
function optimizerScene(state, run) {
  let inner=contourLines(state.objective);
  for(const s of [...run.series].reverse()) {
    inner+=polyline(s.points.slice(0,state.iteration+1).map(p=>[sx(p[0]),sy(p[1])]),s.color,s.id==='adagrad'?'stroke-dasharray="6 4"':'');
    const p=s.points[state.iteration];inner+=pin([sx(p[0]),sy(p[1])],s.color,6);
    if(state.metric==='average') {const a=s.averages[state.iteration];inner+=`<rect x="${num(sx(a[0])-4)}" y="${num(sy(a[1])-4)}" width="8" height="8" fill="${s.color}" stroke="#11192e" stroke-width="1.5"/>`;}
  }
  const m=run.objective.minimizer;
  inner+=`<circle cx="${num(sx(m[0]))}" cy="${num(sy(m[1]))}" r="8" fill="none" stroke="#fff" stroke-width="1.6"/>`+txt(sx(m[0])+12,sy(m[1])+19,'minimum','#e0eafa','class="scene-small"');
  inner+=pin([sx(state.start[0]),sy(state.start[1])],'#fff',5)+txt(sx(state.start[0])+9,sy(state.start[1])-12,'shared start','#e3ecfa','class="scene-small"');
  inner+=txt(22,28,'CLICK THE LANDSCAPE TO CHOOSE A NEW START','#abc1dd','class="scene-small"');
  return svg('flexgrad-scene',`FlexGrad versus AdaGrad on ${run.objective.label}`,'Contours of the chosen objective with actual optimizer trajectories. Dots are current iterates; squares are running averages when the average view is selected.',inner);
}
function optimizerMetrics(state, run) {
  const k=state.iteration, metric=state.metric==='average'?'averageErrors':'currentErrors';
  return `${legend(run.series)}${errorChart('flexgrad',run.series,k,metric,state.metric==='average'?'Averaged objective gap':'Current objective gap')}<div class="experiment-table-wrap"><table class="experiment-table"><caption class="sr-only">Optimizer objective gaps and directional persistence</caption><thead><tr><th scope="col">Method</th><th scope="col">Objective gap</th><th scope="col">Persistence</th></tr></thead><tbody>${run.series.map(s=>`<tr><th scope="row"><i style="background:${s.color}"></i>${s.id==='flexgrad'?'FlexGrad':'AdaGrad DA'}</th><td>${format(s[metric][k])}</td><td>${s.coherence[k].toFixed(2)}</td></tr>`).join('')}</tbody></table></div><p class="experiment-footnote">Persistence = ‖Σg‖ / Σ‖g‖, ranging from 0 to 1. Both methods use their own gradients, the same D, λₖ = 1, and dual averaging. Dots show iterates; squares show averages.</p><div class="optimizer-insight">${escape(run.objective.explanation)}</div>`;
}
export function renderParts(state, run) {
  if(state.id==='halpern'||state.id==='polyhedral')return {scene:projectionScene(state,run),metrics:projectionMetrics(state,run),readout:!state.sets.length?'Add a constraint to begin.':!run.target?'Empty intersection: edit the constraints before running.':`${state.sets.length} convex sets · sweep ${state.iteration} · ${state.id==='halpern'?'anchor fixed at the starting point':'measuring maximum distance to an individual set'}`};
  if(state.id==='pcrm')return {scene:pcrmScene(state,run),metrics:pcrmMetrics(state,run),readout:`Iteration ${state.iteration} · angle ${state.angle}° · P-CRM distance ${format(norm(run.pcrm[state.iteration]))}`};
  return {scene:optimizerScene(state,run),metrics:optimizerMetrics(state,run),readout:`${run.objective.label} · iteration ${state.iteration} · shared step scale D = ${state.scale.toFixed(2)}`};
}
export function experimentMarkup(id) {
  const state=defaultState(id),run=compute(state),parts=renderParts(state,run),drawing=id==='halpern'||id==='polyhedral';
  const titles={halpern:'Draw a best-approximation problem',polyhedral:'Draw a convex feasibility problem',pcrm:'Explore circumcenter geometry in 3D',flexgrad:'Explore an optimization landscape'};
  let setup=drawing?projectionControls(state):id==='pcrm'?`<div class="experiment-setup" data-interactive hidden><label>Angle between lines <output data-angle-output>${state.angle}°</output><input data-angle type="range" min="12" max="70" value="${state.angle}" aria-label="Angle between affine lines"></label><label>Rotate the 3D view<input data-yaw type="range" min="-80" max="80" value="${state.yaw}" aria-label="Rotate affine geometry"></label></div>`:`<div class="experiment-setup optimizer-setup" data-interactive hidden><label>Objective<select data-objective aria-label="Optimization objective">${Object.entries(objectives).map(([id,f])=>`<option value="${id}">${f.label}</option>`).join('')}</select></label><label>Step scale D <output data-scale-output>${state.scale.toFixed(2)}</output><input data-scale type="range" min="5" max="80" value="${Math.round(state.scale*100)}" aria-label="Optimizer step scale"></label><label>Compare<select data-metric aria-label="Objective gap measurement"><option value="average">Averaged iterates</option><option value="current">Current iterates</option></select></label></div>`;
  const tip=drawing?'Drag from the center to the edge to draw a disk. Up to eight sets; the numerical editor also supports keyboard input.':id==='pcrm'?'Change the angle, rotate the view, and step through the actual 3D circumcenter iterates.':'Choose a function, click to move the shared starting point, and run both optimizers.';
  return `<div class="experiment" data-experiment="${id}"><div class="experiment-heading"><div><span class="experiment-eyebrow">Interactive mathematics</span><h3>${titles[id]}</h3></div><span class="experiment-badge">${drawing?'Draw · Run · Compare':'Explore · Run · Compare'}</span></div>${setup}<div class="experiment-columns"><div class="experiment-drawing">${drawing?drawingToolbar(state):''}<p class="drawing-hint" data-hint>${tip}</p><div class="experiment-scene ${drawing?'draw-surface':id==='flexgrad'?'optimizer-surface':''}" data-scene>${parts.scene}</div>${playback(state)}${drawing?numericEditor(state):''}</div><div class="experiment-results" data-results>${parts.metrics}</div></div><p class="experiment-status" data-experiment-status role="status">${escape(parts.readout)}</p>${id==='flexgrad'?`<p class="objective-formula" data-objective-formula>${escape(run.objective.formula)}</p>`:''}</div>`;
}
