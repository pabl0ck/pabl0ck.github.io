// Pure SVG renderers: shared by the static build and the interactive page.
// Every chart is an explicitly described toy instance, not benchmark data.
const C = { cyan: '#38d9ed', purple: '#b49aff', gold: '#f8cb65', white: '#eef3ff', muted: '#a7b3cb', pink: '#f58fb1' };
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const n = value => Number(value.toFixed(3));
const X = x => n(280 + 52 * x);
const Y = y => n(170 - 52 * y);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, t) => [a[0] * t, a[1] * t];
const text = (x, y, label, color = C.muted, extra = '') => `<text x="${n(x)}" y="${n(y)}" fill="${color}" ${extra}>${esc(label)}</text>`;
const label = (p, s, color = C.white, dx = 10, dy = -10) => text(X(p[0]) + dx, Y(p[1]) + dy, s, color);
const line = (a, b, color = C.muted, extra = '') => `<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="${color}" ${extra}/>`;
const path = (pts, color, extra = '') => `<polyline points="${pts.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" ${extra}/>`;
const point = (p, color = C.cyan, r = 5) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="${r}" fill="${color}" stroke="#0c1327" stroke-width="2"/>`;
const disk = (c, r, color) => `<circle cx="${X(c[0])}" cy="${Y(c[1])}" r="${n(52 * r)}" fill="${color}" fill-opacity=".07" stroke="${color}" stroke-width="1.6"/>`;
const axes = () => line([-4.5, 0], [4.5, 0], '#6d7c98', 'opacity=".3"') + line([0, -3], [0, 3], '#6d7c98', 'opacity=".3"');
function svg(id, title, description, inner) {
  return `<svg viewBox="0 0 560 350" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${esc(title)}</title><desc id="${id}-desc">${esc(description)}</desc><defs><pattern id="${id}-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#a7b3cb" stroke-opacity=".07"/></pattern></defs><rect x="0" y="0" width="560" height="350" fill="url(#${id}-grid)"/>${inner}</svg>`;
}
function projectDisk(p, c, r) {
  const d = dist(p, c);
  return d <= r ? [...p] : add(c, mul(sub(p, c), r / d));
}
function diskIntersectionProjection(p, a, ra, b, rb) {
  const candidates = [projectDisk(p, a, ra), projectDisk(p, b, rb)];
  const delta = sub(b, a), d = dist(a, b), u = mul(delta, 1 / d);
  const along = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - along * along));
  const mid = add(a, mul(u, along)), v = [-u[1], u[0]];
  candidates.push(add(mid, mul(v, h)), add(mid, mul(v, -h)));
  return candidates.filter(q => dist(q, a) <= ra + 1e-8 && dist(q, b) <= rb + 1e-8).sort((q, r) => dist(q, p) - dist(r, p))[0];
}
function halpern(k = 18) {
  const a = [-.7, 0], b = [.7, .2], ra = 1.7, rb = 1.6, anchor = [-2.8, 2.45];
  const target = diskIntersectionProjection(anchor, a, ra, b, rb);
  let x = anchor, pts = [x];
  for (let i = 0; i < k; i++) {
    const t = projectDisk(projectDisk(x, a, ra), b, rb), alpha = 1 / (i + 2);
    x = add(mul(anchor, alpha), mul(t, 1 - alpha)); pts.push(x);
  }
  const inner = disk(a, ra, C.purple) + disk(b, rb, C.cyan) + label([-1.8, -.6], 'C₁', C.purple) + label([1.2, .7], 'C₂', C.cyan)
    + line(anchor, target, C.gold, 'stroke-dasharray="5 6" opacity=".45"') + path(pts, C.cyan)
    + pts.slice(1).map((q, i) => point(q, C.cyan, i === pts.length - 2 ? 5 : 2.5)).join('')
    + point(anchor, C.gold, 6) + label(anchor, 'anchor x₀', C.gold, -5, -15)
    + point(target, C.white, 6) + label(target, 'closest feasible point', C.white, 9, 23)
    + text(28, 327, 'ANCHOR + FEASIBILITY OPERATOR', C.muted, 'class="svg-kicker"');
  return {svg: svg('halpern', 'Anchored projection toward an intersection', `Iteration ${k}. Distance to the nearest feasible point is ${dist(x, target).toFixed(3)}.`, inner), readout: `Iteration ${k} · distance to the closest feasible point: ${dist(x, target).toFixed(3)}`};
}
function pcrm(angle = 55) {
  const theta = angle * Math.PI / 180, u = [Math.cos(theta), Math.sin(theta)], x = [2.1, 1.6];
  const pu = [x[0], 0], pv = mul(u, dot(x, u)), ru = sub(mul(pu, 2), x), rv = sub(mul(pv, 2), x);
  let inner = axes() + line([-4, 0], [4, 0], C.cyan, 'stroke-width="2"') + line(mul(u, -3.2), mul(u, 3.2), C.purple, 'stroke-width="2"');
  inner += disk([0, 0], dist(x, [0, 0]), C.gold) + path([x, ru, rv, x], C.muted, 'stroke-dasharray="5 5" opacity=".65"')
    + line(x, ru, C.cyan, 'stroke-dasharray="3 4" opacity=".6"') + line(x, rv, C.purple, 'stroke-dasharray="3 4" opacity=".6"')
    + point(x, C.gold) + label(x, 'x', C.gold) + point(ru, C.cyan) + label(ru, 'Rᵤ(x)', C.cyan)
    + point(rv, C.purple) + label(rv, 'Rᵥ(x)', C.purple, -60, -12) + point([0, 0], C.white, 7) + label([0, 0], 'circumcenter', C.white, -40, 26)
    + label([3.5, 0], 'U', C.cyan, 5, -10) + label(mul(u, 3), 'V', C.purple)
    + text(28, 327, 'INDEPENDENT REFLECTIONS · ONE GEOMETRIC COMBINATION', C.muted, 'class="svg-kicker"');
  return {svg: svg('pcrm', 'Circumcenter of parallel reflections across two lines', 'The original point and its two reflections are equally distant from the common intersection.', inner), readout: `Angle between subspaces: ${angle}° · all three points share the same circumcenter`};
}
function clip(poly, a, b) {
  const output = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], fp = dot(a, p) - b, fq = dot(a, q) - b;
    if (fp <= 1e-9) output.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) output.push(add(p, mul(sub(q, p), fp / (fp - fq))));
  }
  return output;
}
function projectHalfspaces(x, cuts) {
  const feasible = q => cuts.every(c => dot(c.a, q) <= c.b + 1e-8);
  const candidates = feasible(x) ? [x] : [];
  for (const c of cuts) candidates.push(sub(x, mul(c.a, (dot(c.a, x) - c.b) / dot(c.a, c.a))));
  for (let i = 0; i < cuts.length; i++) for (let j = i + 1; j < cuts.length; j++) {
    const p = cuts[i], q = cuts[j], det = p.a[0] * q.a[1] - p.a[1] * q.a[0];
    if (Math.abs(det) > 1e-12) candidates.push([(p.b * q.a[1] - p.a[1] * q.b) / det, (p.a[0] * q.b - p.b * q.a[0]) / det]);
  }
  return candidates.filter(feasible).sort((p, q) => dist(p, x) - dist(q, x))[0] || x;
}
function polyhedral(k = 0) {
  const sets = [{c: [-.6, 0], r: 1.8}, {c: [.8, 0], r: 1.6}, {c: [0, 1.1], r: 1.45}];
  let x = [-3.2, 2.5], pts = [x], cuts, projections;
  for (let i = 0; i <= k; i++) {
    projections = sets.map(s => projectDisk(x, s.c, s.r));
    cuts = projections.map(p => ({a: sub(x, p), b: dot(sub(x, p), p), p})).filter(c => dot(c.a, c.a) > 1e-16);
    if (i < k) { x = projectHalfspaces(x, cuts); pts.push(x); }
  }
  const next = projectHalfspaces(x, cuts);
  let polygon = [[-4.7, -3.3], [4.7, -3.3], [4.7, 3.3], [-4.7, 3.3]];
  for (const c of cuts) polygon = clip(polygon, c.a, c.b);
  let inner = sets.map((s, i) => disk(s.c, s.r, [C.cyan, C.purple, C.pink][i])).join('');
  inner += `<polygon points="${polygon.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="${C.gold}" fill-opacity=".08"/>`;
  for (const c of cuts) {
    const v = mul([-c.a[1], c.a[0]], 8 / Math.hypot(...c.a));
    inner += line(sub(c.p, v), add(c.p, v), C.gold, 'stroke-dasharray="6 5" opacity=".75"') + line(x, c.p, C.muted, 'stroke-dasharray="2 5" opacity=".5"') + point(c.p, C.gold, 4);
  }
  inner += path(pts, C.cyan) + line(x, next, C.white, 'stroke-width="2"') + point(x, C.white, 6) + label(x, 'xₖ', C.white, -27, -12) + point(next, C.cyan, 6) + label(next, 'next', C.cyan, 10, 21)
    + text(28, 327, 'PARALLEL PROJECTIONS · SUPPORTING HALF-SPACES', C.muted, 'class="svg-kicker"');
  const violation = Math.max(...sets.map(s => Math.max(0, dist(x, s.c) - s.r)));
  return {svg: svg('polyhedral', 'A polyhedral outer approximation of three convex disks', `At iteration ${k}, the maximum disk violation is ${violation.toFixed(4)}.`, inner), readout: `Iteration ${k} · maximum constraint violation: ${violation.toFixed(4)}`};
}
function completion(reveal = 0) {
  const size = 8, cell = 29, gap = 3, originX = 33, originY = 48;
  const v = Array.from({length: size}, (_, i) => [Math.cos(i * .57), Math.sin(i * .57)]);
  let inner = '';
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
    const observed = i === j || (i + j) % 3 === 0 || Math.abs(i - j) === 1;
    const value = dot(v[i], v[j]), fill = observed ? C.cyan : reveal ? C.purple : '#29334b';
    inner += `<rect x="${originX + j * (cell + gap)}" y="${originY + i * (cell + gap)}" width="${cell}" height="${cell}" rx="4" fill="${fill}" fill-opacity="${observed || reveal ? (.24 + .65 * (value + 1) / 2).toFixed(2) : '.65'}"/>`;
    if (!observed && !reveal) inner += text(originX + j * (cell + gap) + 10, originY + i * (cell + gap) + 20, '·', '#8190aa');
  }
  inner += text(33, 31, reveal ? 'ONE FEASIBLE COMPLETION' : 'PARTIALLY OBSERVED MATRIX', C.white, 'class="svg-kicker"');
  for (const [y, title, note, color] of [[75, 'Observed entries', 'Match the measurements', C.cyan], [159, 'PSD structure', 'Nonnegative eigenvalues', C.purple], [244, 'Common solution', 'Satisfy both constraints', C.gold]]) {
    inner += `<circle cx="328" cy="${y - 4}" r="4" fill="${color}"/>` + text(343, y, title, color) + text(343, y + 23, note, C.muted, 'class="svg-detail"');
  }
  inner += text(33, 331, 'CYAN: OBSERVED', C.cyan, 'class="svg-kicker"') + text(260, 331, 'PURPLE: COMPLETED', C.purple, 'class="svg-kicker"');
  return {svg: svg('completion', 'Positive-semidefinite matrix completion', 'An eight by eight rank-two Gram matrix. Cyan cells are observed; purple cells reveal a compatible completion.', inner), readout: reveal ? 'A compatible rank-two PSD completion is visible.' : 'Known entries constrain the answer; PSD structure connects the missing entries.'};
}
function flexgrad(mode = 'persistent') {
  const g = Array.from({length: 12}, (_, i) => mode === 'persistent' ? 1 : i % 2 === 0 ? 1 : -1);
  let sum = 0;
  const sums = [0, ...g.map(x => sum += x)], x = i => 52 + i * 38, y = s => 265 - s * 10;
  let inner = text(30, 30, 'SAME MAGNITUDE. DIFFERENT DIRECTION.', C.white, 'class="svg-kicker"');
  for (let i = 0; i < g.length; i++) {
    const cx = 54 + i * 41, cy = 79, down = g[i] < 0;
    inner += `<path d="M ${cx} ${cy + (down ? -12 : 12)} V ${cy + (down ? 12 : -12)} m -5 ${down ? -5 : 5} l 5 ${down ? 5 : -5} l 5 ${down ? -5 : 5}" fill="none" stroke="${down ? C.purple : C.cyan}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  inner += `<line x1="52" y1="265" x2="515" y2="265" stroke="#46546e"/>`;
  for (const level of [0, 6, 12]) inner += text(26, y(level) + 5, level, C.muted, 'class="svg-detail"');
  inner += `<polyline points="${sums.map((s, i) => `${x(i)},${y(s)}`).join(' ')}" fill="none" stroke="${C.cyan}" stroke-width="3"/>`;
  inner += `<polyline points="${Array.from({length: 13}, (_, i) => `${x(i)},${y(i)}`).join(' ')}" fill="none" stroke="${C.gold}" stroke-width="2" stroke-dasharray="5 5"/>`;
  inner += text(53, 304, 'Σgₜ  cumulative direction', C.cyan, 'class="svg-detail"') + text(303, 304, 'Σgₜ²  gradient energy', C.gold, 'class="svg-detail"');
  inner += text(52, 333, '12 SYNTHETIC GRADIENTS', C.muted, 'class="svg-kicker"');
  return {svg: svg('flexgrad', 'Gradient direction versus gradient energy', `The signed sum is ${sum} and the sum of squared gradients is 12.`, inner), readout: `Signed gradient sum: ${sum} · squared-gradient sum: 12`};
}
function ddp(count = 3) {
  const f = s => .48 * (s - .7) ** 2 + .4, df = s => .96 * (s - .7);
  const locations = [-2.7, 2.7, 0, 1.5, -.9, .75].slice(0, count);
  const cuts = locations.map(t => s => f(t) + df(t) * (s - t));
  const curve = fn => Array.from({length: 101}, (_, i) => { const s = -3.25 + i * .065; return [s, fn(s) - 2]; });
  let inner = axes();
  inner += path(curve(f), C.white);
  for (const c of cuts) inner += path(curve(c), C.purple, 'stroke-width="1.2" opacity=".35"');
  inner += path(curve(s => Math.max(...cuts.map(c => c(s)))), C.cyan, 'stroke-width="3"');
  for (const t of locations) inner += point([t, f(t) - 2], C.gold, 4);
  inner += text(30, 29, 'LEARNING A COST-TO-GO FUNCTION', C.white, 'class="svg-kicker"') + text(30, 320, 'TRUE COST', C.white, 'class="svg-kicker"') + text(167, 320, 'AFFINE CUTS', C.purple, 'class="svg-kicker"') + text(329, 320, 'LOWER MODEL', C.cyan, 'class="svg-kicker"');
  const probe = .5, gap = f(probe) - Math.max(...cuts.map(c => c(probe)));
  return {svg: svg('ddp', 'Supporting affine cuts approximate a convex future cost', `${count} affine cuts. The model remains below the true cost.`, inner), readout: `${count} supporting ${count === 1 ? 'cut' : 'cuts'} · model gap at state 0.5: ${gap.toFixed(3)}`};
}
const sequence = ['LL', 'LR', 'RL', 'LL', 'RL', 'LR', 'LL', 'RR'];
function bsddp(sample = 0) {
  const active = sequence[sample], previous = sequence.slice(0, sample).lastIndexOf(active);
  const nodes = {'': [83, 166], L: [260, 100], R: [260, 235], LL: [451, 53], LR: [451, 139], RL: [451, 221], RR: [451, 306]};
  let inner = text(28, 28, 'REVISITING A FULL SCENARIO PATH', C.white, 'class="svg-kicker"');
  for (const child of ['L', 'R', 'LL', 'LR', 'RL', 'RR']) {
    const a = nodes[child.slice(0, -1)], b = nodes[child], selected = active.startsWith(child);
    inner += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${selected ? previous >= 0 ? C.gold : C.cyan : '#34415b'}" stroke-width="${selected ? 3 : 1.5}"/>`;
  }
  for (const [key, p] of Object.entries(nodes)) {
    const selected = active.startsWith(key);
    inner += `<circle cx="${p[0]}" cy="${p[1]}" r="${key.length === 2 ? 8 : 10}" fill="${selected ? previous >= 0 ? C.gold : C.cyan : '#28364f'}" stroke="#10182d" stroke-width="3"/>`;
    if (key.length === 2) inner += text(p[0] + 17, p[1] + 5, key, selected ? C.white : C.muted);
  }
  inner += text(55, 206, 'today', C.muted) + text(227, 282, 'stage 2', C.muted) + text(414, 340, 'stage 3', C.muted);
  return {svg: svg('bsddp', 'Scenario tree and repeated path update', `Sample ${sample + 1}: path ${active}. ${previous >= 0 ? `Previously sampled at visit ${previous + 1}.` : 'This is its first visit.'}`, inner), readout: previous >= 0 ? `Visit ${sample + 1}: ${active} repeats visit ${previous + 1} · stored trial points activate a model update` : `Visit ${sample + 1}: ${active} · first visit stores trial points`};
}
function equilibria(drift = 40) {
  const points = [], targets = [], speed = .025 + drift * .0026, eta = .4;
  let x = 0;
  for (let i = 0; i <= 80; i++) {
    const target = 1.35 * Math.sin(speed * i);
    targets.push([-4 + i * .1, target]); points.push([-4 + i * .1, x]);
    const probe = x - eta * (x - target);
    x -= eta * (probe - target);
  }
  let inner = axes() + path(targets, C.gold, 'stroke-dasharray="6 5"') + path(points, C.cyan);
  inner += text(28, 30, 'A MOVING TARGET, A TRACKING ALGORITHM', C.white, 'class="svg-kicker"')
    + text(28, 302, 'EQUILIBRIUM', C.gold, 'class="svg-kicker"') + text(245, 302, 'EXTRAGRADIENT ITERATE', C.cyan, 'class="svg-kicker"')
    + text(233, 335, 'time', C.muted);
  const lag = Math.sqrt(points.reduce((s, p, i) => s + (p[1] - targets[i][1]) ** 2, 0) / points.length);
  return {svg: svg('equilibria', 'Extragradient tracking of a moving scalar equilibrium', `A sinusoidal equilibrium and a scalar extragradient tracker. Root-mean-square tracking error is ${lag.toFixed(3)}.`, inner), readout: `Target drift: ${drift}% · toy example RMS tracking error: ${lag.toFixed(3)}`};
}
function trustRegion(radius = 12) {
  const delta = radius / 10, center = 1.9, q = s => Math.max(-.6 * s + 1.1, .5 * s + .1);
  const objective = s => .36 * (s - .3) ** 2 + q(s), lo = center - delta, hi = center + delta;
  let trial = lo;
  for (let i = 0; i <= 1000; i++) { const s = lo + (hi - lo) * i / 1000; if (objective(s) < objective(trial)) trial = s; }
  const curve = fn => Array.from({length: 101}, (_, i) => { const s = -2.8 + .06 * i; return [s, fn(s) - 2]; });
  let inner = `<rect x="${X(lo)}" y="42" width="${n(52 * 2 * delta)}" height="246" fill="${C.purple}" fill-opacity=".12"/>`;
  inner += line([lo, -2.5], [lo, 2.7], C.purple, 'stroke-dasharray="5 5"') + line([hi, -2.5], [hi, 2.7], C.purple, 'stroke-dasharray="5 5"')
    + path(curve(q), C.muted, 'opacity=".65" stroke-dasharray="4 5"') + path(curve(objective), C.white)
    + line([center, -2.5], [center, objective(center) - 2], C.gold, 'stroke-dasharray="3 4"')
    + point([center, objective(center) - 2], C.gold, 6) + label([center, objective(center) - 2], 'reference', C.gold, -60, -14)
    + point([trial, objective(trial) - 2], C.cyan, 6) + label([trial, objective(trial) - 2], 'trial decision', C.cyan, -75, 25)
    + text(28, 29, 'A CONTROLLED NEIGHBORHOOD FOR THE NEXT STEP', C.white, 'class="svg-kicker"')
    + text(28, 320, 'STAGE OBJECTIVE', C.white, 'class="svg-kicker"') + text(265, 320, 'ALLOWED REGION', C.purple, 'class="svg-kicker"');
  return {svg: svg('trust-region', 'Trust region stabilizes a toy planning subproblem', `Radius ${delta.toFixed(1)}. The trial decision is ${trial.toFixed(2)}.`, inner), readout: `Trust-region radius: ${delta.toFixed(1)} · trial decision: ${trial.toFixed(2)}`};
}

export const demos = {
  halpern: {render: halpern, type: 'range', min: 0, max: 80, value: 18, label: 'Iteration'},
  pcrm: {render: pcrm, type: 'range', min: 45, max: 80, value: 55, label: 'Angle between lines'},
  polyhedral: {render: polyhedral, type: 'range', min: 0, max: 10, value: 0, label: '3PM iteration'},
  completion: {render: completion, type: 'toggle', options: [{value: 0, label: 'Observed entries'}, {value: 1, label: 'Reveal completion'}], value: 0},
  flexgrad: {render: flexgrad, type: 'toggle', options: [{value: 'persistent', label: 'Persistent gradients'}, {value: 'noisy', label: 'Alternating gradients'}], value: 'persistent'},
  ddp: {render: ddp, type: 'range', min: 1, max: 6, value: 3, label: 'Number of supporting cuts'},
  bsddp: {render: bsddp, type: 'range', min: 0, max: 7, value: 0, label: 'Sampled path visit'},
  equilibria: {render: equilibria, type: 'range', min: 0, max: 100, value: 40, label: 'Target drift'},
  'trust-region': {render: trustRegion, type: 'range', min: 2, max: 25, value: 12, label: 'Trust-region radius'}
};
