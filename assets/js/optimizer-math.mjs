// Global, non-EMA FlexGrad, Algorithm 1 in arXiv:2610.09203, lambda_k=1.
// Compare the same dual-averaging update family with AdaGrad's sqrt scaling.
// Both methods evaluate their own gradients and use the same start and D.
import {add, sub, mul, norm} from './projection-math.mjs';
const softplus = x => Math.max(0, x) + Math.log1p(Math.exp(-Math.abs(x)));
const huber = x => Math.abs(x) <= 1 ? x * x / 2 : Math.abs(x) - .5;
const huberGradient = x => Math.max(-1, Math.min(1, x));
let logisticMinimum = 0;
for (let i = 0; i < 30; i++) {
  const p = 1 / (1 + Math.exp(logisticMinimum));
  logisticMinimum -= (.04 * logisticMinimum - p) / (.04 + p * (1 - p));
}
export const objectives = {
  huber: {label: 'Huber valley', formula: 'f(x,y) = Huber₁(x) + 0.25y²', start: [-4.1, 1.4], minimizer: [0, 0],
    value: ([x, y]) => huber(x) + .25 * y * y,
    gradient: ([x, y]) => [huberGradient(x), .5 * y],
    levels: [.04, .12, .3, .65, 1.2, 2.2, 3.8, 5.6],
    explanation: 'Far from the minimum, the Huber term has a constant slope: a long stretch of gradients can keep pointing in the same direction.'},
  logistic: {label: 'Regularized logistic', formula: 'f(x,y) = log(1 + e⁻ˣ) + 0.02x² + 0.25y²', start: [-4.1, 1.4], minimizer: [logisticMinimum, 0],
    value: ([x, y]) => softplus(-x) + .02 * x * x + .25 * y * y,
    gradient: ([x, y]) => [-1 / (1 + Math.exp(x)) + .04 * x, .5 * y],
    levels: [.04, .12, .3, .65, 1.2, 2.2, 3.8, 5.6],
    explanation: 'A confident wrong prediction produces gradients with a persistent direction. The regularizer gives this logistic example a finite minimizer.'},
  quadratic: {label: 'Tilted quadratic', formula: 'f = 0.03u² + 0.8v² · axes rotated by 25°', start: [-4, -1.4], minimizer: [0, 0],
    value: ([x, y]) => {const c = Math.cos(25 * Math.PI / 180), s = Math.sin(25 * Math.PI / 180); return .03 * (c * x + s * y) ** 2 + .8 * (-s * x + c * y) ** 2;},
    gradient: ([x, y]) => {const c = Math.cos(25 * Math.PI / 180), s = Math.sin(25 * Math.PI / 180), u = c * x + s * y, v = -s * x + c * y; return [.06 * u * c - 1.6 * v * s, .06 * u * s + 1.6 * v * c];},
    levels: [.02, .06, .15, .35, .8, 1.6, 3.2, 6.4],
    explanation: 'An elongated, rotated bowl tests a different geometry. Gradient alignment changes as the iterates enter the narrow valley.'}
};
export function optimizerRun(objectiveId = 'huber', start = null, scale = .28, steps = 180) {
  const f = objectives[objectiveId], origin = start || f.start, optimum = f.value(f.minimizer), c = 1e-12;
  const series = [{id: 'flexgrad', name: 'FlexGrad', color: '#38d9ed'}, {id: 'adagrad', name: 'AdaGrad · dual averaging', color: '#f8cb65'}].map(method => {
    let x = [...origin], sum = [0, 0], energy = 0, gradientLength = 0, pointSum = [...x];
    const points = [x], averages = [x], currentErrors = [], averageErrors = [], coherence = [], rates = [];
    for (let k = 0; k <= steps; k++) {
      currentErrors.push(Math.max(0, f.value(x) - optimum));
      averageErrors.push(Math.max(0, f.value(averages[k]) - optimum));
      coherence.push(gradientLength === 0 ? 0 : norm(sum) / gradientLength);
      if (k === steps) break;
      const g = f.gradient(x);
      sum = add(sum, g); energy += norm(g) ** 2; gradientLength += norm(g);
      const rate = method.id === 'flexgrad' ? scale * norm(sum) / (energy + c) : scale / Math.sqrt(energy + c);
      rates.push(rate);
      x = sub(origin, mul(sum, rate));
      if (!x.every(Number.isFinite)) throw new Error(`Non-finite ${method.id} iterate`);
      points.push(x); pointSum = add(pointSum, x); averages.push(mul(pointSum, 1 / (k + 2)));
    }
    return {...method, points, averages, currentErrors, averageErrors, coherence, rates};
  });
  return {objectiveId, objective: f, series, start: origin, scale, steps};
}
