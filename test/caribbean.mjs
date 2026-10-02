/* The Bahamas must not take taps that landed inside Haiti.

   Reported from a phone: "At this scale, if I click on Cuba or Haiti, I might
   hit Bahamas instead." It was true - five of forty-five points inside Haiti
   answered to the Bahamas, because the reach was settled by a flat ten pixels
   and the Bahamas' southern islets sit closer than that to Haiti's north
   coast. It was fixed by asking whether the small place stood on the ground
   that was hit; it is kept fixed now by the skirt being ground rather than
   pixels, so at this zoom the Bahamas claim a few pixels and no more.

   This is the framing of that report: the Caribbean at the zoom the screenshot
   was taken at, every point on the five countries in question, put to the same
   question a tap asks. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = []; let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got) === JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ') + w.padEnd(48), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const p = await b.newPage({viewport: PHONE});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
p.on('console', m=>{ if(m.type()==='error' && !/TUNNEL_CONNECTION_FAILED/.test(m.text()))
  errs.push('console ' + m.text()); });
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
await p.click('.game[data-mode="world"]'); await p.waitForTimeout(250);
const g0 = await p.$('.menupanel:not([hidden]) button.go'); if(g0) await g0.click();
await p.waitForTimeout(1500);
/* the view from the screenshot: the Caribbean, a little way in */
await p.evaluate(()=>{ lam0 = -70; k = worldFill()*1.4;
  const m = svg.getScreenCTM(), r = wrap.getBoundingClientRect();
  ty = ((r.top+r.height/2)-m.f)/m.d - wy(20)*k; settleView(); });
await p.waitForTimeout(1200);

const rows = await p.evaluate(()=>{
  const out = [], r = wrap.getBoundingClientRect();
  for(const n of ['Cuba','Haiti','Dominican Republic','Jamaica','Honduras']){
    const e = targets().find(x=>x.name===n);
    const el = document.querySelector(`path.c[data-code="${e.code}"]`);
    if(!el || !el.getBoundingClientRect().width){ out.push({n, off:true}); continue; }
    const bb = el.getBoundingClientRect();
    let tried = 0, stolen = 0; const by = {};
    for(let i=1;i<10;i++) for(let j=1;j<10;j++){
      const x = bb.x + bb.width*i/10, y = bb.y + bb.height*j/10;
      if(x<r.x || x>r.x+r.width || y<r.y || y>r.y+r.height) continue;
      const q = document.elementFromPoint(x, y);
      const c = q && q.closest ? q.closest('[data-code]') : null;
      if(!c || c.dataset.code !== e.code) continue;      // only points truly on it
      tried++;
      const hit = BY_CODE[c.dataset.code];
      /* exactly what the click decides, weighed the same way */
      const near = reachFor(x, y, hit);
      const took = near && (!hit || near.e === hit || near.w < screenSize(hit));
      const win = took ? near.e : hit;
      if(win !== e){ stolen++; by[win.name] = (by[win.name]||0) + 1; }
    }
    out.push({n, tried, stolen, by});
  }
  return out;
});

let points = 0;
for(const r of rows){
  if(r.off){ console.log('  --   ' + r.n + ': not on screen'); continue; }
  points += r.tried;
  console.log('       ' + r.n.padEnd(20) + r.tried + ' points on it, ' + r.stolen +
    ' answer to someone else' +
    (r.stolen ? '  (' + Object.entries(r.by).map(([k,v])=>k+' x'+v).join(', ') + ')' : ''));
}
console.log('');
ok(`no country loses a tap on itself (${points} points)`,
   rows.filter(r=>!r.off && r.stolen).map(r=>r.n + ' -> ' + Object.keys(r.by).join('/')), []);
ok('all five were on screen to be measured', rows.filter(r=>r.off).map(r=>r.n), []);

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
