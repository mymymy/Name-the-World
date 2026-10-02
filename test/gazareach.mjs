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
  lam0 = e.cll[0]; k = worldFill()*m;
  const mm = svg.getScreenCTM(), r = wrap.getBoundingClientRect();
  ty = ((r.top+r.height/2)-mm.f)/mm.d - wy(e.cll[1])*k;
  clampView(); applyView(); turn();
  S.sel = null; closeAsk();
  /* Gaza is the second ring; where it sits now, and how wide it really is */
  const c = scene.getScreenCTM(), u = k*unitPx();
  const [bx, by, sz] = e.at[1];
  return {x: c.a*bx + c.c*by + c.e, y: c.b*bx + c.d*by + c.f, w: sz*u,
          /* how far out it may still answer for - its own business now, not a
             flat forty-four pixels, and measured across the sliver rather than
             along it */
          claim: claimOf(sz*u, e.at[1][3] === undefined ? undefined : e.at[1][3]*u)};
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

for(const mult of [1, 2, 4, 6]){
  /* west of it, towards the sea - the side with nothing on it */
  for(const frac of [0, 0.5, 0.85]){
    const gz = await settle(mult);
    const dx = -Math.round(gz.claim * frac);
    const x = gz.x + dx, y = gz.y;
    const ground = await onGround(x, y);
    const what = `${mult}x zoom, Gaza is ${gz.w.toFixed(1)}px, ` +
                 (dx ? `${-dx}px west of ${gz.claim.toFixed(0)}px` : 'on it');
    /* Open water is nobody's and a reach may have all of it. Another country's
       ground is already someone's, and a tap that far inside Egypt is Egypt's -
       the same rule that keeps the Bahamas out of Haiti. At the world view a
       point fourteen pixels west of Gaza is the north coast of Sinai. */
    if(ground && ground !== 'Palestine'){ console.log(`  --   ${what}: on ${ground}, not open water`); continue; }
    await p.mouse.click(x, y); await p.waitForTimeout(200);
    ok(what, await picked(), 'Palestine');
  }
}
console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
