/* Gaza is a sliver of a country that is not small. Palestine was scored as one
   thing, so once the West Bank was big enough to hit, Gaza - three pixels of it
   between Israel and the sea - lost its reach with it. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = []; let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got)===JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ')+w.padEnd(46), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const p = await b.newPage({viewport: PHONE});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
await p.click('.game[data-mode="world"]'); await p.waitForTimeout(250);
const g0 = await p.$('.menupanel:not([hidden]) button.go'); if(g0) await g0.click();
await p.waitForTimeout(1400);
/* Palestine has to be in play for a tap to be able to name it */
await p.evaluate(()=>{ const e = DATA.find(x=>x.name==='Palestine');
  if(!targets().includes(e)){ S.pick = S.pick.slice(0,-1); S.pick.push(e.code); delete S.ans[e.code]; } });

const look = mult => p.evaluate(m=>{
  const e = DATA.find(x=>x.name==='Palestine');
  lam0 = e.cll[0]; k = m === 'max' ? ZOOM_MAX : worldFill()*m;
  const mm = svg.getScreenCTM(), r = wrap.getBoundingClientRect();
  ty = ((r.top+r.height/2)-mm.f)/mm.d - wy(e.cll[1])*k;
  clampView(); applyView(); turn();
  S.sel = null; closeAsk();
  /* Gaza is the smaller piece: its points are the ones with the smaller size.
     The claim runs out from the outline, so the tap is measured from Gaza's
     westernmost point on it, towards the sea. */
  const c = scene.getScreenCTM(), u = k*unitPx();
  const small = Math.min(...e.at.map(a => a[2]));
  const scr = e.at.filter(a => a[2] === small)
    .map(a => ({x: c.a*a[0] + c.c*a[1] + c.e, y: c.b*a[0] + c.d*a[1] + c.f, a}));
  const west = scr.reduce((p, q) => q.x < p.x ? q : p);
  return {x: west.x, y: west.y, w: small*u,
          /* how far out it may still answer for - the page's own sum */
          claim: claimAt(west.a, u, screenSize(e))};
}, mult);
const picked = ()=>p.evaluate(()=>S.sel && BY_CODE[S.sel] && BY_CODE[S.sel].name);

/* Naming a place flies the map to it, and the flight outlives the click that
   started it - set the view while one is still running and it lands on its own
   destination a moment later, putting the next tap in Egypt. Let it finish. */
const settle = async mult => { await p.evaluate(()=>{ S.sel = null; closeAsk(); });
  await p.waitForTimeout(1100); const g = await look(mult);
  await p.waitForTimeout(120); return g; };

/* what is at a point, if anything in play is */
const onGround = (x,y) => p.evaluate(([cx,cy])=>{
  const el = document.elementFromPoint(cx,cy);
  const c = el && el.closest ? el.closest('[data-code]') : null;
  const e = c && BY_CODE[c.dataset.code];
  return e && e.play ? e.name : null;
}, [x,y]);

for(const mult of [1, 2, 4, 6, 'max']){
  /* west of it, towards the sea - the side with nothing on it */
  for(const frac of [0, 0.5, 0.85]){
    const gz = await settle(mult);
    const dx = -Math.floor(gz.claim * frac);
    const x = gz.x + dx, y = gz.y;
    const ground = await onGround(x, y);
    const what = `${mult === 'max' ? 'full' : mult + 'x'} zoom, Gaza is ${gz.w.toFixed(1)}px, ` +
                 (dx ? `${-dx}px west of ${gz.claim.toFixed(0)}px` : 'on it');
    /* Open water is the case in question: nothing else there for the tap to
       be. Where the point lands on Sinai instead, Gaza may well take it - the
       skirt is ground and it is owed - but that is not what this is checking. */
    if(ground && ground !== 'Palestine'){ console.log(`  --   ${what}: on ${ground}, not open water`); continue; }
    await p.mouse.click(x, y); await p.waitForTimeout(200);
    ok(what, await picked(), 'Palestine');
  }
}
console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
