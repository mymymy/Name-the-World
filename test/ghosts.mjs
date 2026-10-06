/* Nothing can be reached for that is not drawn.

   A country turned away from is cleared from the map, because what it holds was
   projected for the meridian it was last drawn at. Where it can be grabbed was
   not cleared with it, so a country off the far side of the globe kept the
   screen position it had when it was last seen - and with the map over the
   Caribbean, seven European microstates held ground in the North Atlantic. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs=[]; let pass=0, fail=0;
const ok=(w,got,want)=>{const g=JSON.stringify(got)===JSON.stringify(want); g?pass++:fail++;
  console.log((g?'  ok   ':'  FAIL ')+w.padEnd(50), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);};
const p = await b.newPage({viewport: PHONE});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
p.on('console', m=>{ if(m.type()==='error' && !/TUNNEL_CONNECTION_FAILED/.test(m.text()))
  errs.push('console '+m.text()); });
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
await p.click('.game[data-mode="world"]'); await p.waitForTimeout(250);
const g=await p.$('.menupanel:not([hidden]) button.go'); if(g) await g.click();
await p.waitForTimeout(1500);

const look = ()=>p.evaluate(()=>{
  const stray = [], adrift = [];
  for(const e of DATA){
    if(!e.held || !e.at || !e.at.length) continue;
    const el = document.querySelector(`path.c[data-code="${e.code}"]`);
    /* it offers itself to be grabbed, so it must be on the map */
    if(!el || !el.hasAttribute('d')) { stray.push(e.name); continue; }
    /* and where it is grabbed must be where it is drawn */
    const m = scene.getScreenCTM(), bb = el.getBoundingClientRect();
    const [bx,by] = e.at[0];
    const x = m.a*bx+m.c*by+m.e, y = m.b*bx+m.d*by+m.f;
    const pad = 40;
    if(x < bb.left-pad || x > bb.right+pad || y < bb.top-pad || y > bb.bottom+pad)
      adrift.push(e.name);
  }
  return {stray, adrift};
});

/* turn the globe right around, looking after each move */
for(const [name, lon] of [['the Caribbean', -61], ['Europe', 10], ['the Pacific', 175],
                          ['east Asia', 120], ['back west', -100]]){
  await p.evaluate(l=>{ lam0 = l; k = worldFill()*2.2; ty = 0; settleView(); }, lon);
  await p.waitForTimeout(500);
  const r = await look();
  ok(`over ${name}: nothing reachable that is not drawn`, r.stray, []);
  ok(`over ${name}: and nothing reachable away from its shape`, r.adrift, []);
}
/* And nothing is drawn where it is not. A small country on the map's edge used
   to have some of its points wrap to the left side and some to the right, and
   was drawn - halo and all - as a line clean across the world. Turned all the
   way round in small steps, still and moving, no outline but Antarctica's may
   span more than half the board. */
const across = await p.evaluate(()=>{ S.sel = null; closeAsk(true); fitCurrent();
  const bad = new Set();
  for(const mv of [false, true]) for(let L = -180; L < 180; L += 0.37){
    lam0 = L; moving = mv; drawWorld();
    for(const [e, pp] of worldPaths){ if(e.code === 'ATA') continue; const d = pp.getAttribute('d'); if(!d) continue;
      for(const seg of d.split('M')){ const xs = (seg.match(/-?[\d.]+(?=,)/g) || []).map(Number);
        if(xs.length > 1 && Math.max(...xs) - Math.min(...xs) > 1000) bad.add(e.name); } } }
  moving = false; return [...bad]; });
ok('no outline is drawn across the world, at any turn', across, []);

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail||errs.length?1:0);
