import {defaultState, compute, renderParts, scene} from './playground-view.mjs';
import {projectionPresets, add, sub, mul, distance} from './projection-math.mjs';
import {objectives} from './optimizer-math.mjs';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = value => structuredClone(value);
const hints = {
  disk: 'Drag from a center to its boundary to draw a disk; a tap adds a standard-size disk.',
  box: 'Drag between opposite corners to draw a box; a tap adds a standard-size box.',
  move: 'Drag the center handle of a constraint to move it. The numerical editor also lets you resize it.',
  start: 'Click or tap the plot to choose the shared starting point. Halpern keeps this point as its anchor.'
};

export function mountPlaygrounds() {
  for (const root of document.querySelectorAll('[data-experiment]')) {
    const state = defaultState(root.dataset.experiment), drawing = ['halpern', 'polyhedral'].includes(state.id);
    let run = compute(state), playing = false, frame = 0, lastFrame = 0, drag = null, selected = 0;
    const history = [], host = root.querySelector('[data-scene]'), result = root.querySelector('[data-results]');
    const one = selector => root.querySelector(selector);
    for (const el of root.querySelectorAll('[data-interactive]')) el.hidden = false;
    function stop() {
      playing = false; cancelAnimationFrame(frame);
      one('[data-action="run"]').textContent = 'Run comparison';
    }
    function render() {
      const parts = renderParts(state, run);
      host.innerHTML = parts.scene; result.innerHTML = parts.metrics;
      one('[data-experiment-status]').textContent = parts.readout;
      one('[data-iteration]').value = state.iteration;
      one('[data-step-output]').textContent = state.iteration;
      if (drawing) {
        host.dataset.tool = state.mode;
        for (const button of root.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
        for (const button of root.querySelectorAll('[data-action="run"], [data-action="step"]')) button.disabled = !run.target || !state.sets.length;
        one('[data-action="undo"]').disabled = history.length === 0;
        one('[data-eps-output]').textContent = state.eps.toFixed(2);
      } else if (state.id === 'flexgrad') {
        one('[data-objective-formula]').textContent = objectives[state.objective].formula;
        one('[data-scale-output]').textContent = state.scale.toFixed(2);
      } else one('[data-angle-output]').textContent = `${state.angle}°`;
    }
    function refresh(reset = true) {
      stop(); if (reset) state.iteration = 0;
      run = compute(state); render(); if (drawing) syncEditor();
    }
    function remember() { history.push({sets: clone(state.sets), start: [...state.start]}); if (history.length > 30) history.shift(); }
    function syncEditor() {
      const select = one('[data-set-select]');
      selected = clamp(selected, 0, Math.max(0, state.sets.length - 1));
      select.innerHTML = state.sets.map((s, i) => `<option value="${i}">C${i + 1} · ${s.type === 'disk' ? 'disk' : 'box'}</option>`).join('');
      select.value = selected;
      const set = state.sets[selected], box = set?.type === 'box';
      for (const el of root.querySelectorAll('[data-center-x], [data-center-y], [data-radius], [data-width], [data-height], [data-action="apply-set"]')) el.disabled = !set;
      one('[data-radius-label]').hidden = box;
      one('[data-width-label]').hidden = !box; one('[data-height-label]').hidden = !box;
      if (set) {
        const c = box ? mul(add(set.lo, set.hi), .5) : set.c;
        one('[data-center-x]').value = Number(c[0].toFixed(3)); one('[data-center-y]').value = Number(c[1].toFixed(3));
        if (box) {one('[data-width]').value = Number((set.hi[0] - set.lo[0]).toFixed(3)); one('[data-height]').value = Number((set.hi[1] - set.lo[1]).toFixed(3));}
        else one('[data-radius]').value = Number(set.r.toFixed(3));
      }
      one('[data-start-x]').value = Number(state.start[0].toFixed(3)); one('[data-start-y]').value = Number(state.start[1].toFixed(3));
    }
    function done() {
      if (drawing) return run.series.length > 0 && run.series.every(s => s.errors[state.iteration] <= 1e-6);
      if (state.id === 'pcrm') return distance(run.pcrm[state.iteration], [0, 0, 0]) < 1e-6 && distance(run.map[state.iteration], [0, 0, 0]) < 1e-6;
      const key = state.metric === 'average' ? 'averageErrors' : 'currentErrors';
      return run.series.every(s => s[key][state.iteration] <= 1e-6);
    }
    function advance() { if (state.iteration < state.max) {state.iteration++; render();} }
    function animate(time) {
      if (!playing) return;
      if (time - lastFrame >= (state.id === 'pcrm' ? 190 : 65)) {
        advance(); lastFrame = time;
        if (state.iteration >= state.max || done()) {stop();return;}
      }
      frame = requestAnimationFrame(animate);
    }
    root.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button || !root.contains(button)) return;
      if (button.dataset.mode) {stop();state.mode = button.dataset.mode;one('[data-hint]').textContent = hints[state.mode];render();return;}
      const action = button.dataset.action;
      if (action === 'run') {
        if (playing) {stop();return;}
        if (state.iteration >= state.max) state.iteration = 0;
        playing = true; button.textContent = 'Pause'; lastFrame = 0; frame = requestAnimationFrame(animate);
      } else if (action === 'step') {stop();advance();}
      else if (action === 'reset') {stop();state.iteration = 0;render();}
      else if (action === 'undo') {
        const previous = history.pop(); if (!previous) return;
        state.sets = previous.sets; state.start = previous.start; refresh();
      } else if (action === 'clear') {remember();state.sets = [];refresh();}
      else if (action === 'add-disk' || action === 'add-box') {
        if (state.sets.length >= 8) {one('[data-experiment-status]').textContent = 'This playground supports up to eight constraints.';return;}
        remember();state.sets.push(action === 'add-disk' ? {type:'disk',c:[0,0],r:1.25} : {type:'box',lo:[-1,-.8],hi:[1,.8]});selected = state.sets.length-1;refresh();
      } else if (action === 'apply-start') {
        const p = [Number(one('[data-start-x]').value), Number(one('[data-start-y]').value)];
        if (!p.every(Number.isFinite)) return;
        remember();state.start = [clamp(p[0],-4.5,4.5),clamp(p[1],-2.7,2.7)];refresh();
      } else if (action === 'apply-set') {
        const current = state.sets[selected]; if (!current) return;
        const x = Number(one('[data-center-x]').value), y = Number(one('[data-center-y]').value);
        const radius = Number(one('[data-radius]').value), width = Number(one('[data-width]').value), height = Number(one('[data-height]').value);
        if (![x,y,radius,width,height].every(Number.isFinite)) return;
        const c = [clamp(x,-4.5,4.5),clamp(y,-2.7,2.7)];
        remember();
        state.sets[selected] = current.type === 'disk' ? {type:'disk',c,r:clamp(radius,.15,5)} : {type:'box',lo:sub(c,[clamp(width,.3,9)/2,clamp(height,.3,5.6)/2]),hi:add(c,[clamp(width,.3,9)/2,clamp(height,.3,5.6)/2])};
        refresh();
      }
    });
    one('[data-iteration]').addEventListener('input', event => {stop();state.iteration=Number(event.target.value);render();});
    if (drawing) {
      one('[data-preset]').addEventListener('change', event => {remember();state.preset=event.target.value;const p=projectionPresets[state.preset];state.sets=clone(p.sets);state.start=[...p.start];selected=0;refresh();});
      one('[data-eps]').addEventListener('input', event => {state.eps=Number(event.target.value)/100;refresh();});
      one('[data-cuts]').addEventListener('change', event => {state.showCuts=event.target.checked;render();});
      one('[data-set-select]').addEventListener('change', event => {selected=Number(event.target.value);syncEditor();});
    } else if (state.id === 'pcrm') {
      one('[data-angle]').addEventListener('input', event => {state.angle=Number(event.target.value);refresh();});
      one('[data-yaw]').addEventListener('input', event => {state.yaw=Number(event.target.value);render();});
    } else {
      one('[data-objective]').addEventListener('change', event => {state.objective=event.target.value;state.start=[...objectives[state.objective].start];refresh();});
      one('[data-scale]').addEventListener('input', event => {state.scale=Number(event.target.value)/100;refresh();});
      one('[data-metric]').addEventListener('change', event => {state.metric=event.target.value;render();});
    }
    function position(event) {
      const rect=host.querySelector('svg').getBoundingClientRect();
      return [clamp(((event.clientX-rect.left)/rect.width*scene.width-scene.cx)/scene.scale,-4.6,4.6),clamp((scene.cy-(event.clientY-rect.top)/rect.height*scene.height)/scene.scale,-2.8,2.8)];
    }
    if (drawing) {
      host.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        stop(); const p=position(event);
        let index=-1;
        if(state.mode==='move') {
          let best=.75;
          state.sets.forEach((s,i)=>{const c=s.type==='disk'?s.c:mul(add(s.lo,s.hi),.5),d=distance(c,p);if(d<best){best=d;index=i;}});
          if(index<0){one('[data-hint]').textContent='Choose a constraint by its center handle, then drag.';return;}
        }
        drag={origin:p,index,pointerId:event.pointerId}; host.setPointerCapture(event.pointerId);event.preventDefault();
      });
      host.addEventListener('pointermove', event => {
        if (!drag) return;
        const p=position(event),a=drag.origin;
        if(state.mode==='disk')state.draft={type:'disk',c:a,r:Math.max(.05,distance(a,p))};
        if(state.mode==='box')state.draft={type:'box',lo:[Math.min(a[0],p[0]),Math.min(a[1],p[1])],hi:[Math.max(a[0],p[0]),Math.max(a[1],p[1])]};
        if(state.mode==='move'){
          const s=clone(state.sets[drag.index]),delta=sub(p,a);
          if(s.type==='disk')s.c=add(s.c,delta);else{s.lo=add(s.lo,delta);s.hi=add(s.hi,delta);}state.draft=s;
        }
        if(state.draft) host.innerHTML=renderParts(state,run).scene;
      });
      host.addEventListener('pointerup', event => {
        if(!drag)return;
        const p=position(event),a=drag.origin;
        if(state.mode==='start'){remember();state.start=p;}
        else if(state.mode==='move') {if(state.draft){remember();state.sets[drag.index]=state.draft;selected=drag.index;}}
        else if(state.sets.length<8) {
          remember();
          if(state.mode==='disk')state.sets.push({type:'disk',c:a,r:distance(a,p)<.15?.85:Math.min(5,distance(a,p))});
          else {const tap=distance(a,p)<.2;state.sets.push(tap?{type:'box',lo:sub(a,[.8,.65]),hi:add(a,[.8,.65])}:{type:'box',lo:[Math.min(a[0],p[0]),Math.min(a[1],p[1])],hi:[Math.max(a[0],p[0])+.001,Math.max(a[1],p[1])+.001]});}
          selected=state.sets.length-1;
        }
        if(host.hasPointerCapture(event.pointerId))host.releasePointerCapture(event.pointerId);
        delete state.draft;drag=null;refresh();
      });
      host.addEventListener('pointercancel',()=>{delete state.draft;drag=null;render();});
      syncEditor();
    } else if (state.id==='flexgrad') {
      host.tabIndex = 0;
      host.setAttribute('aria-label', 'Optimization landscape. Click to place the start, or use arrow keys to move it by 0.1.');
      host.addEventListener('click',event=>{state.start=position(event);refresh();});
      host.addEventListener('keydown',event=>{
        const shifts={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,.1],ArrowDown:[0,-.1]};
        if(!shifts[event.key])return;
        event.preventDefault();const p=add(state.start,shifts[event.key]);state.start=[clamp(p[0],-4.6,4.6),clamp(p[1],-2.8,2.8)];refresh();
      });
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();},{threshold:0}).observe(root);
    root.addEventListener('keydown',event=>{if(event.key==='Escape')stop();});
    render();
  }
}
