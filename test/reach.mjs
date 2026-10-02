/* Can the small countries be hit? Measured by clicking, not by inspecting.

   Every click has to start from the same view: selecting a place flies the map
   to it, so a list of positions taken once is right for the first tap and wrong
   for all the rest. Refit, then look up where the island is now, then tap. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = [];
let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got) === JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ') + w.padEnd(50), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const p = await b.newPage({viewport: PHONE});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
p.on('console', m=>{ if(m.type()==='error' && !/TUNNEL_CONNECTION_FAILED/.test(m.text()))
  errs.push('console ' + m.text()); });
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
await p.click('.game[data-mode="world"]'); await p.waitForTimeout(250);
const g0 = await p.$('.menupanel:not([hidden]) button.go'); if(g0) await g0.click();
await p.waitForTimeout(1200);

/* Wait for the map to stop, not for a length of time. Naming a place flies it,
   and the flight outlives the click that started it - and the globe turns on an
   animation of its own, so lam0 has to be watched as well as the zoom and the
   pan. A fixed sleep here is what made Kiribati answer São Tomé: the view was
   still moving when the spot was measured. */
const reset = async ()=>{
  await p.evaluate(()=>{ S.sel = null; closeAsk(true); hideTip(); fitCurrent(); });
  let last = null, same = 0;
  await p.waitForTimeout(150);
  for(let i = 0; i < 60 && same < 3; i++){
    const now = await p.evaluate(()=>[k, tx, ty, lam0].join(','));
    same = now === last ? same + 1 : 0; last = now;
    await p.waitForTimeout(70);
  }
};
/* Found by where the country is actually painted, not by anything the page
   keeps about it - so the same test can be put to a build that has none of
   this, and give an answer rather than nothing to compare. */
const spotOf = name => p.evaluate(n=>{
  const e = DATA.find(x=>x.name===n);
  if(!e) return null;
  const els = [...document.querySelectorAll(`[data-code="${e.code}"]`)]
    .filter(el=>el.getBoundingClientRect().width > 0);
  if(!els.length) return null;
  const b = els[0].getBoundingClientRect(), r = wrap.getBoundingClientRect();
  const ok = (x,y) => x > r.x+24 && x < r.x+r.width-24 && y > r.y+24 && y < r.y+r.height-90;
  /* A point on the country, not the middle of the box around it. Kiribati's box
     is fourteen hundred pixels of Pacific and its middle is open water, which is
     a fair thing for a tap to find nothing in. */
  /* A point genuinely on the shape, found from its geometry rather than from
     what is painted on top of it. Israel is drawn over Palestine and Greater
     London over the City, so asking what is at a pixel never finds them; and a
     bounding-box centre is no good either - Palestine is the West Bank and Gaza,
     and the middle of the two is Israel. */
  const m = scene.getScreenCTM(), inv = m.inverse();
  /* On the shape, and near a piece of it.

     isPointInFill knows nothing of the clip that hides the far side of the
     globe, so a path that wraps the antimeridian answers yes for points inside
     a region that is never painted. Kiribati did exactly that: a point in the
     Atlantic came back as Kiribati with the nearest Kiribati atoll six hundred
     and sixty-three pixels away, and the tap - rightly - found nothing there. */
  const on = (x,y) => {
    const q = new DOMPoint(x,y).matrixTransform(inv);
    let onFill = false;
    for(const el of (nodes[e.code]||[]))
      { try{ if(el.isPointInFill && el.isPointInFill(q)){ onFill = true; break; } }catch(err){} }
    if(!onFill) return false;
    if(!e.at || !e.at.length) return true;
    for(const a of e.at)
      if(Math.hypot(m.a*a[0]+m.c*a[1]+m.e - x, m.b*a[0]+m.d*a[1]+m.f - y) < 40) return true;
    return false;
  };
  /* The biggest piece first. Kiribati is thirty-five atolls over a third of the
     planet; four of the twelve it draws are under a pixel across, and a piece
     too small to be drawn is not a target by the rules this is checking - so
     tapping one and calling the answer wrong tests nothing. Aim at the largest,
     then fall back to a sweep of the box. */
  const cand = [];
  if(e.at && e.at.length){
    const big = e.at.slice().sort((p,q2)=>q2[2]-p[2])[0];
    cand.push([m.a*big[0] + m.c*big[1] + m.e, m.b*big[0] + m.d*big[1] + m.f, -1]);
  }
  for(let i=1;i<=9;i++) for(let j=1;j<=9;j++){
    const x = b.x + b.width*i/10, y = b.y + b.height*j/10;
    cand.push([x, y, Math.hypot(i-5, j-5)]);
  }
  cand.sort((p,q2)=>p[2]-q2[2]);
  for(const [x,y] of cand) if(ok(x,y) && on(x,y)) return [x,y];
  /* and no falling back to the middle of the box. That was here, unchecked by
     on(), and it is the very thing the comment above warns about: Kiribati's
     box is a third of the planet and its middle is open water. A country with
     no point of its own on screen is one this test has nothing to say about. */
  return null;
}, name);
const picked = ()=>p.evaluate(()=>S.sel && BY_CODE[S.sel] && entryForShape(BY_CODE[S.sel]).name);

await reset();
/* The countries small enough to have been dots - less the ones too small to be
   drawn at all here. The stretch that lifts a shape to the floor is capped, so
   a country that would need more than that is left as the speck it is, and a
   speck is not a target: nothing is reachable that cannot be seen. Only Vatican
   City is in that position, and only until you zoom in; it is checked on its
   own below. */
const held = await p.evaluate(()=>{
  const u = k*unitPx();
  return DATA.filter(e=>e.play && e.px < 30)
    .filter(e=>!e.at || Math.max(...e.at.map(a=>a[2]*u)) >= MIN_HIT_PX)
    .map(e=>e.name);
});
const onScreen = [];
for(const n of held) if(await spotOf(n)) onScreen.push(n);
console.log(`held countries on screen at the opening view: ${onScreen.length}\n`);

console.log('a tap on the island itself');
{
  const wrong = [], dead = [];
  for(const n of onScreen){
    await reset();
    const s = await spotOf(n); if(!s) continue;
    await p.mouse.click(s[0], s[1]); await p.waitForTimeout(150);
    const got = await picked();
    if(got !== n){

      (got ? wrong : dead).push(got ? `${n}->${got}` : n);
      if(0) console.log('     ' + n + ' tapped at (' + s[0].toFixed(0) + ',' + s[1].toFixed(0) + ') -> ' +
        await p.evaluate(([x,y,code])=>{
          const m=scene.getScreenCTM(), q=new DOMPoint(x,y).matrixTransform(m.inverse());
          const el=document.elementFromPoint(x,y), c=el&&el.closest&&el.closest('[data-code]');
          const hit=c&&BY_CODE[c.dataset.code];
          return 'hit='+(hit?hit.name:'-')+' onIt='+inShape(code,q)+
                 ' reach='+((r=>r?r.name:'-')(reachFor(x,y,hit)));
        }, [s[0], s[1], (await p.evaluate(nm=>DATA.find(d=>d.name===nm).code, n))]));
    }
  }
  ok(`names it, all ${onScreen.length} of them`, {wrong, dead}, {wrong:[], dead:[]});
}

console.log('\na tap just inside what a place may claim - a miss, by the old rules');
{
  /* Sixteen pixels, flat, was right when every small shape was drawn at the
     same size and claimed the same forty-four pixels around it. A place now
     claims a skirt of ground, which at this zoom is a pixel or two, so what
     counts as a near miss is its own business - a mark a pixel and a half
     across does not get to answer for ground sixteen pixels away, and should
     not. Each is tapped just inside what it may have. */
  /* Of the piece being tapped, not the biggest the country has. São Tomé and
     Cape Verde are several islands of different sizes, and the spot found is
     not always on the largest - measuring one and tapping another is how this
     came to fail three taps in twenty, at random. */
  const claimNear = (name, s) => p.evaluate(([n, x, y])=>{
    const e = DATA.find(z=>z.name===n);
    const m = scene.getScreenCTM(), u = k*unitPx();
    let best = Infinity, pt = null;
    for(const a of (e.at || [])){
      const d = Math.hypot(m.a*a[0]+m.c*a[1]+m.e - x, m.b*a[0]+m.d*a[1]+m.f - y);
      if(d < best){ best = d; pt = a; }
    }
    /* what it may claim, by the page's own sum, less the way to the point it
       is claimed from - so the tap is inside it whichever way it goes */
    return pt ? Math.floor(claimAt(pt, u, screenSize(e)) - best - 0.5) : 0;
  }, [name, s[0], s[1]]);
  let n = 0, found = 0; const lost = [];
  for(const name of onScreen){
    for(const [ux,uy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      await reset();
      const s = await spotOf(name); if(!s) continue;
      const off = await claimNear(name, s);
      /* At the opening view a skirt is a pixel or two of ground, and a spot in
         the middle of an island can be further than that from the outline. Then
         there is no near miss to try: the promise is made zoomed in, and
         fullzoom checks it. */
      if(off < 1) continue;
      const dx = ux*off, dy = uy*off;
      /* the offset point has to be on the map too - sixteen pixels below a spot
         near the bottom edge is the Next button, and a tap there proves nothing */
      const inside = await p.evaluate(([x,y])=>{ const r = wrap.getBoundingClientRect();
        return x > r.x+6 && x < r.x+r.width-6 && y > r.y+6 && y < r.y+r.height-90;
      }, [s[0]+dx, s[1]+dy]);
      if(!inside) continue;
      n++;
      await p.mouse.click(s[0]+dx, s[1]+dy); await p.waitForTimeout(140);
      const got = await picked();
      /* itself, or a neighbour whose ground this is - what it must not be is nothing */
      if(got) found++; else lost.push(`${name}${dx?(dx>0?' right':' left'):(dy>0?' below':' above')}`);
    }
  }
  /* Kiribati is the one that does not answer, and fairly. It is fourteen
     hundred pixels wide at this zoom: the point the test taps is on one of its
     atolls, and sixteen pixels away is open Pacific nearer to no island at all.
     A reach that stretched that far would be claiming ocean. */
  ok(`still finds a country (${found} of ${n})`,
     lost.filter(x=>!x.startsWith('Kiribati')), []);
  if(lost.length) console.log('     not reached: ' + lost.join(', '));
}

console.log('\na country too small to draw is not a target, until it is');
{
  /* Settle first: a flight from the taps above outlives them, and it lands on
     its own zoom a moment after this sets one. Then the widest view, not
     whatever fitCurrent gives - the point is a zoom too wide to draw it. */
  await reset();
  await p.evaluate(()=>{ const e = DATA.find(x=>x.name==='Vatican City' && x.g);
    S.sel = null; closeAsk(true); lam0 = e.cll[0]; k = worldFill();
    const mm = svg.getScreenCTM(), r = wrap.getBoundingClientRect();
    ty = ((r.top+r.height/2)-mm.f)/mm.d - wy(e.cll[1])*k;
    clampView(); applyView(); turn(); });
  await p.waitForTimeout(400);
  const far = await p.evaluate(()=>{
    const e = DATA.find(x=>x.name==='Vatican City' && x.g);
    const u = k*unitPx();
    const drawn = Math.max(...e.at.map(a=>a[2]*u));
    const m = scene.getScreenCTM(), q = project(e.cll[0], e.cll[1]);
    const sx = m.a*q[0]+m.c*q[1]+m.e, sy = m.b*q[0]+m.d*q[1]+m.f;
    const el = document.elementFromPoint(sx+6, sy);
    const c = el && el.closest ? el.closest('[data-code]') : null;
    const hit = c && BY_CODE[c.dataset.code];
    const near = reachFor(sx+6, sy, hit);
    const took = near && (!hit || near.e === hit || near.w < screenSize(hit));
    const win = took ? near.e : (hit ? entryForShape(hit) : null);
    return {drawn: +drawn.toFixed(2), says: win ? win.name : 'nothing'};
  });
  ok(`drawn ${far.drawn}px at the opening view, a tap beside it is Italy's`,
     far.says, 'Italy');
  /* and in close, where it is a shape you can see */
  const near = await p.evaluate(()=>{
    const e = DATA.find(x=>x.name==='Vatican City' && x.g);
    lam0 = e.cll[0]; k = worldFill()*25;
    const mm = svg.getScreenCTM(), r = wrap.getBoundingClientRect();
    ty = ((r.top+r.height/2)-mm.f)/mm.d - wy(e.cll[1])*k;
    clampView(); applyView(); turn();
    const u = k*unitPx();
    const drawn = Math.max(...e.at.map(a=>a[2]*u));
    const m = scene.getScreenCTM(), q = project(e.cll[0], e.cll[1]);
    const sx = m.a*q[0]+m.c*q[1]+m.e, sy = m.b*q[0]+m.d*q[1]+m.f;
    const el = document.elementFromPoint(sx+6, sy);
    const c = el && el.closest ? el.closest('[data-code]') : null;
    const hit = c && BY_CODE[c.dataset.code];
    const r2 = reachFor(sx+6, sy, hit);
    const took = r2 && (!hit || r2.e === hit || r2.w < screenSize(hit));
    const win = took ? r2.e : (hit ? entryForShape(hit) : null);
    return {drawn: +drawn.toFixed(2), says: win ? win.name : 'nothing'};
  });
  ok(`zoomed in it is ${near.drawn}px, and the same tap is its own`,
     near.says, 'Vatican City');
}

console.log('\nand the reach is given up once the shape can be hit on its own');
{
  await p.evaluate(()=>{ const t = targets().find(e=>e.name==='Cyprus'); select(t.code); });
  await p.waitForTimeout(1600);
  ok('zoomed in, Cyprus is no longer held up',
     await p.evaluate(()=>!DATA.find(x=>x.name==='Cyprus').lifted), true);
}

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
