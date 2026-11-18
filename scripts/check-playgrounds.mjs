import assert from 'node:assert/strict';
import {projectSet, projectIntersection, a3pmStep, projectionRun, projectionPresets, affineRun, circumcenter, dot, sub, norm, distance} from '../assets/js/projection-math.mjs';
import {objectives, optimizerRun} from '../assets/js/optimizer-math.mjs';
import {experimentIds, defaultState, compute, renderParts, experimentMarkup} from '../assets/js/playground-view.mjs';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
near(distance(projectSet([3,4],{type:'disk',c:[0,0],r:1}),[.6,.8]),0);
assert.deepEqual(projectSet([3,-4],{type:'box',lo:[-1,-2],hi:[1,2]}),[1,-2]);
const disk = {type:'disk',c:[0,0],r:1}, box = {type:'box',lo:[.5,-1],hi:[1.5,1]};
const closest = projectIntersection([-2,2],[disk,box]);
near(distance(closest,[.5,Math.sqrt(.75)]),0);
assert.equal(projectIntersection([0,2],[{type:'disk',c:[-2,0],r:1},{type:'disk',c:[2,0],r:1}]),null);
near(norm(projectIntersection([0,2],[{type:'disk',c:[-1,0],r:1},{type:'disk',c:[1,0],r:1}])),0);

// A3PM's approximate-projection definition: relative distance and a containing
// separating half-space. Fejer decrease is checked against known feasible 0.
let seed=4811;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let trial=0;trial<50;trial++) {
  const sets=Array.from({length:2+trial%4},()=>{
    const c=[random()*2-1,random()*2-1];return {type:'disk',c,r:norm(c)+.3+random()};
  });
  if(trial%2===0)sets.push({type:'box',lo:[-1.2,-.8],hi:[.9,1.1]});
  const x=[random()*8-4,random()*6-3],eps=[0,.1,.3,.6][trial%4],step=a3pmStep(x,sets,eps);
  step.approximations.forEach((p,i)=>{
    near(distance(p,projectSet(p,sets[i])),eps*distance(x,projectSet(x,sets[i])),1e-7);
    assert.ok(dot(sub(x,p),sub([0,0],p))<=1e-8);
  });
  const exact=projectIntersection(x,step.cuts);
  near(distance(step.point,projectIntersection(step.point,step.cuts)),eps*distance(x,exact),1e-7);
  assert.ok(norm(step.point)<=norm(x)+1e-8,'A3PM must be Fejer decreasing toward a feasible point');
  for(const method of projectionRun('polyhedral',sets,x,{eps,steps:30}).series) {
    method.points.forEach((p,k)=>{
      assert.ok(p.every(Number.isFinite));
      if(k)assert.ok(norm(p)<=norm(method.points[k-1])+2e-8,`${method.id} violates Fejer decrease`);
    });
  }
}
for(const preset of Object.values(projectionPresets)) {
  const run=projectionRun('halpern',preset.sets,preset.start,{steps:1500});
  assert.ok(run.series[1].errors.at(-1)<.003,'Dykstra should approach the independent geometric projection');
  const short=projectionRun('halpern',preset.sets,preset.start,{steps:20});
  assert.ok(run.series[0].errors.at(-1)<short.series[0].errors.at(-1),'Anchored A3PM should approach the best approximation');
}
const lens=projectionPresets.lens;
const feasible=projectionRun('polyhedral',lens.sets,lens.start,{steps:25});
assert.ok(feasible.series[0].errors[1]>.01&&feasible.series[0].errors[5]>1e-4,'The default example must require multiple meaningful steps');
assert.ok(feasible.series.every(s=>s.errors[20]<s.errors[1]));

for(const angle of [12,30,55,70]) {
  const r=affineRun(angle,35);
  assert.ok(norm(r.pcrm[1])>.01,'The 3D example must not collapse in one step');
  for(let k=0;k<r.steps;k++) {
    const p=[r.pcrm[k],...r.reflections[k]],c=circumcenter(p),radii=p.map(x=>distance(x,c));
    for(const radius of radii)near(radius,radii[0],1e-7);
    assert.ok(norm(r.pcrm[k+1])<=norm(r.pcrm[k])+1e-8);
  }
}
for(const [id,f] of Object.entries(objectives)) {
  for(const p of [[-3.1,1.2],[2.1,-.7],[.3,.5]]) {
    const g=f.gradient(p),h=1e-5;
    for(let i=0;i<2;i++) {const a=[...p],b=[...p];a[i]+=h;b[i]-=h;near(g[i],(f.value(a)-f.value(b))/(2*h),1e-6);}
  }
  assert.ok(norm(f.gradient(f.minimizer))<1e-9);
  for(const scale of [.05,.28,.8])for(const start of [[-4,2],[4,-2],[0,0]]) {
    const r=optimizerRun(id,start,scale,180);
    for(const s of r.series) {
      assert.ok(s.points.every(p=>p.every(Number.isFinite)));
      assert.ok(s.coherence.every(c=>c>=0&&c<=1+1e-12));
      for(let k of [0,1,30,180])near(s.currentErrors[k],Math.max(0,f.value(s.points[k])-f.value(f.minimizer)),1e-10);
    }
  }
}
// Fixed-gradient region of Huber: the paper's global update must advance
// by D*k, while the matching AdaGrad dual-averaging update advances D*sqrt(k).
const constant=optimizerRun('huber',[-4,0],.1,3);
near(constant.series[0].points[2][0],-3.8,1e-10);
near(constant.series[1].points[2][0],-4+.1*Math.sqrt(2),1e-10);

for(const id of experimentIds) {
  const state=defaultState(id),run=compute(state);
  for(const k of [0,state.iteration,state.max]) {
    state.iteration=k;
    const view=renderParts(state,run);
    assert.ok(!/NaN|Infinity|undefined/.test(view.scene+view.metrics+view.readout),`${id} has an invalid rendered value`);
  }
  assert.ok(experimentMarkup(id).includes('data-experiment'));
}
console.log('Passed: geometric references, empty intersections, admissible A3PM approximations, Fejer decrease, Dykstra corrections, 3D circumcenters, objective gradients, FlexGrad/AdaGrad scaling, and all rendered endpoints.');
