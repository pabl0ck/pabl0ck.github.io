// Two-dimensional geometry and projection algorithms, independent of the UI.
// A3PM follows Definition 3.1 / Algorithm A3PM in arXiv:2506.15895.
// Both approximate projection phases use P_hat(x) = eps*x + (1-eps)*P(x).
// Thus dist(P_hat(x), C) = eps*dist(x,C), and the separating half-space
// still contains C. Exact P is inexpensive for these educational 2D sets.
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, t) => a.map(v => v * t);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = a => Math.hypot(...a);
export const distance = (a, b) => norm(sub(a, b));
export const mix = (a, b, t) => add(mul(a, 1 - t), mul(b, t));

export function projectSet(x, set) {
  if (set.type === 'disk') {
    const d = distance(x, set.c);
    return d <= set.r ? [...x] : add(set.c, mul(sub(x, set.c), set.r / d));
  }
  if (set.type === 'box') return x.map((v, i) => Math.max(set.lo[i], Math.min(set.hi[i], v)));
  const excess = dot(set.n, x) - set.b;
  return excess <= 0 ? [...x] : sub(x, mul(set.n, excess / dot(set.n, set.n)));
}
export const violation = (x, sets) => Math.max(0, ...sets.map(s => distance(x, projectSet(x, s))));
function boundaries(sets) {
  return sets.flatMap(s => s.type === 'box' ? [
    {type: 'halfplane', n: [1, 0], b: s.hi[0]}, {type: 'halfplane', n: [-1, 0], b: -s.lo[0]},
    {type: 'halfplane', n: [0, 1], b: s.hi[1]}, {type: 'halfplane', n: [0, -1], b: -s.lo[1]}
  ] : [s]);
}
function boundaryProjection(x, set) {
  if (set.type !== 'disk') return sub(x, mul(set.n, (dot(set.n, x) - set.b) / dot(set.n, set.n)));
  const d = distance(x, set.c);
  return d < 1e-14 ? [set.c[0] + set.r, set.c[1]] : add(set.c, mul(sub(x, set.c), set.r / d));
}
function intersections(a, b) {
  if (a.type !== 'disk' && b.type !== 'disk') {
    const det = a.n[0] * b.n[1] - a.n[1] * b.n[0];
    if (Math.abs(det) < 1e-12 * norm(a.n) * norm(b.n)) return [];
    return [[(a.b * b.n[1] - a.n[1] * b.b) / det, (a.n[0] * b.b - a.b * b.n[0]) / det]];
  }
  if (a.type !== 'disk') return intersections(b, a);
  if (b.type !== 'disk') {
    const nn = norm(b.n), signed = (dot(b.n, a.c) - b.b) / nn;
    if (Math.abs(signed) > a.r + 1e-10) return [];
    const foot = sub(a.c, mul(b.n, signed / nn));
    const t = [-b.n[1] / nn, b.n[0] / nn], h = Math.sqrt(Math.max(0, a.r ** 2 - signed ** 2));
    return [add(foot, mul(t, h)), sub(foot, mul(t, h))];
  }
  const d = distance(a.c, b.c);
  if (d < 1e-12 || d > a.r + b.r + 1e-10 || d < Math.abs(a.r - b.r) - 1e-10) return [];
  const u = mul(sub(b.c, a.c), 1 / d), t = [-u[1], u[0]];
  const along = (a.r ** 2 - b.r ** 2 + d * d) / (2 * d);
  const middle = add(a.c, mul(u, along)), h = Math.sqrt(Math.max(0, a.r ** 2 - along ** 2));
  return [add(middle, mul(t, h)), sub(middle, mul(t, h))];
}
// In R^2 a closest point is the input itself, a projection onto one active
// boundary, or an intersection of two active boundaries. Boxes supply four
// line boundaries. No iterative baseline is used as the reference answer.
export function projectIntersection(x, sets) {
  if (!sets.length || violation(x, sets) <= 1e-12) return [...x];
  const edges = boundaries(sets), candidates = edges.map(s => boundaryProjection(x, s));
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) candidates.push(...intersections(edges[i], edges[j]));
  return candidates.filter(p => p.every(Number.isFinite) && violation(p, sets) <= 2e-10)
    .sort((a, b) => distance(a, x) - distance(b, x))[0] || null;
}

export function a3pmStep(x, sets, eps = .1) {
  const approximations = sets.map(s => mix(projectSet(x, s), x, eps));
  const cuts = approximations.map(p => {
    const direction = sub(x, p), length = norm(direction);
    const n = length > 1e-12 ? mul(direction, 1 / length) : [0, 0];
    return {type: 'halfplane', n, b: dot(n, p)};
  }).filter(s => norm(s.n) > .5);
  const projected = projectIntersection(x, cuts);
  if (!projected) throw new Error('Inconsistent supporting half-spaces');
  return {point: mix(projected, x, eps), cuts, approximations};
}
export function projectionRun(kind, sets, start, {eps = .1, steps = 200} = {}) {
  const target = projectIntersection(start, sets);
  if (!sets.length || !target) return {target, series: [], sets, start, steps, eps, kind};
  const methods = kind === 'halpern' ? [
    {id: 'halpern-a3pm', name: 'Halpern–A3PM', color: '#38d9ed'},
    {id: 'dykstra', name: 'Dykstra', color: '#f8cb65'}
  ] : [
    {id: 'a3pm', name: 'A3PM', color: '#38d9ed'},
    {id: 'map', name: 'MAP', color: '#b49aff'},
    {id: 'cimmino', name: 'Cimmino', color: '#f8cb65'}
  ];
  const series = methods.map(method => {
    let x = [...start];
    const corrections = sets.map(() => [0, 0]), points = [x], errors = [], violations = [], moves = [];
    for (let k = 0; k <= steps; k++) {
      violations.push(violation(x, sets)); errors.push(kind === 'halpern' ? distance(x, target) : violations[k]);
      if (k === steps) break;
      const old = x;
      if (method.id === 'dykstra') {
        for (let i = 0; i < sets.length; i++) {
          const y = add(x, corrections[i]), next = projectSet(y, sets[i]);
          corrections[i] = sub(y, next); x = next;
        }
      } else if (method.id === 'map') {
        for (const set of sets) x = projectSet(x, set);
      } else if (method.id === 'cimmino') {
        x = mul(sets.map(s => projectSet(x, s)).reduce(add, [0, 0]), 1 / sets.length);
      } else {
        const update = a3pmStep(x, sets, eps).point;
        // Zero-based form of alpha_k = 1/k, with the first nontrivial
        // update using alpha = 1/2. The anchor stays equal to x_0.
        x = method.id === 'halpern-a3pm' ? mix(update, start, 1 / (k + 2)) : update;
      }
      moves.push(distance(old, x)); points.push(x);
    }
    return {...method, points, errors, violations, moves};
  });
  return {target, series, sets, start, steps, eps, kind};
}
export const projectionPresets = {
  lens: {label: 'Narrow lens', start: [-.55, 2.7], sets: [{type: 'disk', c: [-1.24, 0], r: 1.25}, {type: 'disk', c: [1.24, 0], r: 1.25}]},
  curved: {label: 'Three curved sets', start: [-2.8, 2.4], sets: [{type: 'disk', c: [-.95, -.2], r: 1.5}, {type: 'disk', c: [.95, -.2], r: 1.5}, {type: 'disk', c: [0, -1.1], r: 1.6}]},
  mixed: {label: 'Disks + box', start: [-2.6, 2.5], sets: [{type: 'disk', c: [-.8, 0], r: 1.6}, {type: 'disk', c: [.8, 0], r: 1.6}, {type: 'box', lo: [-.75, -.5], hi: [.75, .9]}]}
};

// P-CRM for two lines in R^3. Their common intersection is the origin.
// The out-of-plane component makes the circumcenter iteration nontrivial.
export function circumcenter(points) {
  const x = points[0], vectors = points.slice(1).map(p => sub(p, x)).filter(v => norm(v) > 1e-13);
  if (!vectors.length) return [...x];
  const u = vectors[0], uu = dot(u, u), b1 = -dot(x, u);
  if (vectors.length === 1) return add(x, mul(u, b1 / uu));
  const v = vectors[1], uv = dot(u, v), vv = dot(v, v), det = uu * vv - uv * uv, b2 = -dot(x, v);
  if (det <= 1e-12 * uu * vv) return add(x, mul(u, b1 / uu));
  return add(x, add(mul(u, (b1 * vv - b2 * uv) / det), mul(v, (b2 * uu - b1 * uv) / det)));
}
export function affineRun(angle = 30, steps = 35) {
  const theta = angle * Math.PI / 180;
  const u = [1, 0, 0], v = [Math.cos(theta), Math.sin(theta), 0], start = [2.2, 1.15, 2.05];
  const lineProjection = (p, direction) => mul(direction, dot(p, direction));
  let x = [...start], y = [...start];
  const pcrm = [x], map = [y], reflections = [];
  for (let k = 0; k <= steps; k++) {
    const ru = sub(mul(lineProjection(x, u), 2), x), rv = sub(mul(lineProjection(x, v), 2), x);
    reflections.push([ru, rv]);
    if (k === steps) break;
    x = circumcenter([x, ru, rv]);
    if (norm(x) < 1e-12) x = [0, 0, 0];
    y = lineProjection(lineProjection(y, u), v);
    pcrm.push(x); map.push(y);
  }
  return {u, v, start, pcrm, map, reflections, angle, steps};
}
