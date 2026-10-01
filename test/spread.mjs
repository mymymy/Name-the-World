/* Where two dots land on each other, half of each must still show - and no dot
   may be moved onto a country it does not belong to. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = []; let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got)===JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ')+w.padEnd(50), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const p = await b.newPage({viewport: PHONE});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
p.on('console', m=>{ if(m.type()==='error' && !/TUNNEL_CONNECTION_FAILED/.test(m.text()))
  errs.push('console ' + m.text()); });
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
await p.click('.game[data-mode="capitals"]'); await p.waitForTimeout(300);
const g0 = await p.$('.menupanel:not([hidden]) button.go'); if(g0) await g0.click();
await p.waitForTimeout(1600);

const survey = await p.evaluate(()=>{
  const out = [];
  const base = worldFill();
  for(const mult of [1, 2, 4, 8, 16]){
    /* centred on Rome, so Italy and the Vatican are actually on screen - a
       country off the edge is not drawn, and a dot cannot be asked to stand on
       a shape that is not there */
    k = base*mult; lam0 = 12.5;
    const mm = svg.getScreenCTM(), rr = wrap.getBoundingClientRect();
    ty = ((rr.top+rr.height/2)-mm.f)/mm.d - wy(41.9)*k;
    clampView(); applyView(); turn();
    const u = k*unitPx(), need = DOT_GAP*DOT_PX;
    /* as drawn, on screen */
    const m = scene.getScreenCTM();
    const P = [];
    for(const [e, c] of worldDots){
      const x = +c.getAttribute('cx'), y = +c.getAttribute('cy');
      P.push({e, x: m.a*x+m.c*y+m.e, y: m.b*x+m.d*y+m.f});
    }
    /* A pair still too close is only fair if neither of them could have gone
       any further without stepping off its own country. Asked by trying. */
    const inv0 = m.inverse();
    const couldMove = (e, sx, sy, awayX, awayY) => {
      if(!e.iso || !nodes[e.iso]) return false;
      const c = document.querySelector(`circle.dot[data-code="${e.code}"]`);
      const bx = +c.getAttribute('cx'), by = +c.getAttribute('cy');
      const step = 0.6/(k*unitPx());           // 0.6px further out, in board units
      const q = new DOMPoint(bx + awayX*step, by + awayY*step);
      try{ return inShape(e.iso, q); }catch(err){ return false; }
    };
    let tooClose = 0, worst = Infinity, pair = null, unfair = 0; const unfairNames = [];
    for(let i=0;i<P.length;i++) for(let j=i+1;j<P.length;j++){
      const dx = P[j].x-P[i].x, dy = P[j].y-P[i].y;
      const d = Math.hypot(dx, dy);
      if(d >= need - 0.05) continue;
      tooClose++;
      if(d < worst){ worst = d; pair = [P[i].e.name, P[j].e.name]; }
      const ux = d < 1e-9 ? 1 : dx/d, uy = d < 1e-9 ? 0 : dy/d;
      if(couldMove(P[i].e, P[i].x, P[i].y, -ux, -uy) ||
         couldMove(P[j].e, P[j].x, P[j].y, ux, uy)){
        unfair++;
        if(unfairNames.length < 4) unfairNames.push(P[i].e.name + '/' + P[j].e.name);
      }
    }
    /* and is every dot still standing on its own country? */
    const inv = m.inverse();
    let strays = 0; const strayNames = [];
    for(const [e, c] of worldDots){
      const x = +c.getAttribute('cx'), y = +c.getAttribute('cy');
      const q = new DOMPoint(x, y);
      if(!e.iso || !nodes[e.iso]) continue;
      const own = inShape(e.iso, q);
      if(own) continue;
      /* it may simply be that the country is not drawn here, or that the true
         position is off its own coarse outline - so only count dots we moved */
      const t = project(e.cll[0], e.cll[1]);
      if(Math.abs(t[0]-x) < 0.01 && Math.abs(t[1]-y) < 0.01) continue;
      /* moved, and now off its own country - unless it was off it to start */
      if(!inShape(e.iso, new DOMPoint(t[0], t[1]))) continue;
      strays++; if(strayNames.length < 5) strayNames.push(e.name);
    }
    out.push({mult, tooClose, worst: worst===Infinity?null:+worst.toFixed(2), pair,
              strays, strayNames, unfair, unfairNames});
  }
  return out;
});
console.log('zoom   still too close   closest pair                  had room to part   off own country');
for(const r of survey)
  console.log(String(r.mult).padStart(4)+'x' + String(r.tooClose).padStart(14) +
    '   ' + (r.pair ? (r.pair.join(' / ') + ' @' + r.worst + 'px').padEnd(36) : '-'.padEnd(36)) +
    String(r.unfair).padStart(8) + String(r.strays).padStart(18) +
    (r.unfairNames.length ? '   could part: ' + r.unfairNames.join(', ') : '') +
    (r.strayNames.length ? '   strayed: ' + r.strayNames.join(', ') : ''));
console.log('');
ok('every pair still touching had nowhere left to go',
   survey.filter(r=>r.unfair>0).map(r=>r.mult+'x: '+r.unfairNames.join(', ')), []);
ok('no dot is moved onto another country', survey.filter(r=>r.strays>0).map(r=>r.mult+'x'), []);

/* the Vatican and Rome: the pair no zoom can part */
const vr = await p.evaluate(()=>{
  const base = worldFill();
  k = base; lam0 = 12; clampView(); applyView(); turn();
  const m = scene.getScreenCTM();
  const get = n => { const e = targets().find(x=>x.name===n);
    const c = document.querySelector(`circle.dot[data-code="${e.code}"]`);
    const x = +c.getAttribute('cx'), y = +c.getAttribute('cy');
    const t = project(e.cll[0], e.cll[1]);
    return {drawn: [m.a*x+m.c*y+m.e, m.b*x+m.d*y+m.f],
            truly: [m.a*t[0]+m.c*t[1]+m.e, m.b*t[0]+m.d*t[1]+m.f]};
  };
  const a = get('Vatican City'), b = get('Rome');
  return {apart: +Math.hypot(a.drawn[0]-b.drawn[0], a.drawn[1]-b.drawn[1]).toFixed(2),
          wasApart: +Math.hypot(a.truly[0]-b.truly[0], a.truly[1]-b.truly[1]).toFixed(2),
          vatMoved: +Math.hypot(a.drawn[0]-a.truly[0], a.drawn[1]-a.truly[1]).toFixed(2),
          romeMoved: +Math.hypot(b.drawn[0]-b.truly[0], b.drawn[1]-b.truly[1]).toFixed(2)};
});
console.log(`\nVatican City and Rome at the opening view: ${vr.wasApart}px apart, now ${vr.apart}px`);
console.log(`  the Vatican moved ${vr.vatMoved}px, Rome ${vr.romeMoved}px`);
ok('the Vatican and Rome are parted', vr.apart >= 2.85, true);

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
