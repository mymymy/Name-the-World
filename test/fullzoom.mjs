/* Every small country is a finger across, at some zoom you can reach.

   The rule this guards, in the words it was asked for in: "as long as there is
   a 44px-across-ish tappable area at SOME zoom level, then we're good. It
   doesn't need to be tappable at every zoom level, especially fit view on a
   phone. Countries that are too small to click even at max zoom need
   compensating for."

   So four checks. At full zoom, centred on each held country, there has to be a
   point with forty-four pixels all round it - a disc, sampled - that answers to that
   country, or, where two small places are close enough to want the same ground,
   to the nearer of them. A neighbour that is itself small - Israel, Qatar -
   keeps most of its own ground. And at the opening view, nothing small takes more than a few pixels
   of anyone else's ground: the Gambia's reach once covered a fist's width of
   Senegal there, and the compensation is not owed at that zoom. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = []; let pass = 0, fail = 0;
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
await p.waitForTimeout(1500);

const RADIUS = 22;          // forty-four across, a finger
/* Except Palestine, which gets forty. Its target has to come out of Israel or
   the sea, and Israel - itself seventeen pixels wide at full zoom - can spare
   only so much; see SPARE. A choice, made knowingly: 44 for Palestine costs
   Israel its ground between Gaza and the West Bank. */
const RADIUS_FOR = {'Palestine': 20};

const held = await p.evaluate(()=>DATA.filter(e=>e.play && e.held && e.g).map(e=>e.name));
console.log(`${held.length} held countries, each at full zoom (k=${await p.evaluate(()=>ZOOM_MAX)})\n`);

const short = [];
for(const name of held){
  /* put it in the middle of the screen at full zoom, as the game does when it
     asks about it, and let the frame be drawn */
  await p.evaluate(n=>{ const e = DATA.find(x=>x.name===n && x.g);
    S.sel = null; closeAsk(true); hideTip();
    lam0 = e.cll[0]; k = ZOOM_MAX;
    const mm = svg.getScreenCTM(), r = wrap.getBoundingClientRect();
    ty = ((r.top+r.height/2)-mm.f)/mm.d - wy(e.cll[1])*k;
    clampView(); applyView(); turn(); }, name);
  await p.waitForTimeout(60);
  const res = await p.evaluate(([n, R])=>{
    const e = DATA.find(x=>x.name===n && x.g);
    const m = scene.getScreenCTM(), r = wrap.getBoundingClientRect();
    const say = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const c = el && el.closest ? el.closest('[data-code]') : null;
      const hit = c && BY_CODE[c.dataset.code];
      const near = reachFor(x, y, hit);
      const took = near && (!hit || near.e === hit || near.w < screenSize(hit));
      return took ? near.e : hit;
    };
    /* where to look: the middle of each piece, nearest the middle of the screen
       first - a piece's points are runs with the same size */
    const groups = [];
    let cur = null;
    for(const a of (e.at || [])){
      if(!cur || cur.sz !== a[2]){ cur = {sz: a[2], xs: 0, ys: 0, n: 0}; groups.push(cur); }
      cur.xs += m.a*a[0] + m.c*a[1] + m.e; cur.ys += m.b*a[0] + m.d*a[1] + m.f; cur.n++;
    }
    const mx = r.x + r.width/2, my = r.y + r.height/2;
    const cand = groups.map(g => [g.xs/g.n, g.ys/g.n])
      .filter(([x,y]) => x > r.x+R+4 && x < r.x+r.width-R-4 && y > r.y+R+4 && y < r.y+r.height-R-90)
      .sort((a,b)=>Math.hypot(a[0]-mx,a[1]-my) - Math.hypot(b[0]-mx,b[1]-my)).slice(0, 6);
    let best = 0, bestAt = null;
    for(const [x0, y0] of cand){
      /* a little search about the middle of the piece: a sliver's middle is not
         always on its axis */
      for(const [ox, oy] of [[0,0],[4,0],[-4,0],[0,4],[0,-4]]){
        const x = x0+ox, y = y0+oy;
        let good = 0, total = 0, shared = 0;
        for(const rr of [0, R/2, R]) for(let i = 0; i < (rr ? 24 : 1); i++){
          const a = i * Math.PI / 12;
          total++;
          /* Ground taken by another small country is ground shared, not lost:
             Antigua's Redonda sits thirty kilometres off Nevis, and between two
             places that both want the width the nearer one has it. */
          const w = say(x + rr*Math.cos(a), y + rr*Math.sin(a));
          if(w === e) good++;
          else if(w && w.held) shared++;
        }
        /* whole if nothing in the disc went to a big country or to nobody, and
           most of it is the country's own */
        const whole = good + shared === total && good >= total*0.85;
        const score = (whole ? 1 : 0) + good/total;
        if(score > best){ best = score; bestAt = [x, y]; }
        if(whole) break;
      }
      if(best > 1) break;
    }
    return {best, cands: cand.length};
  }, [name, RADIUS_FOR[name] || RADIUS]);
  if(res.best <= 1) short.push(`${name} ${(res.best*100).toFixed(0)}%${res.cands ? '' : ' (nothing on screen)'}`);
}
ok(`every one has ${RADIUS*2}px all round, at full zoom`, short, []);

/* And the ground it is given comes from somewhere. Israel is seventeen pixels
   wide at full zoom, as wide as the West Bank; given the West Bank's whole
   skirt, every tap from Tel Aviv south answered Palestine. Most of Israel in
   view must still answer to Israel. (Gaza's skirt does take the strip between
   it and the West Bank, which is a choice, not an accident.) */
const keeps = async (name, lon, lat) => {
  await p.evaluate(([lon, lat])=>{ S.sel = null; closeAsk(true); hideTip();
    lam0 = lon; k = ZOOM_MAX;
    const mm = svg.getScreenCTM(), r = wrap.getBoundingClientRect();
    ty = ((r.top+r.height/2)-mm.f)/mm.d - wy(lat)*k;
    clampView(); applyView(); turn(); }, [lon, lat]);
  await p.waitForTimeout(60);
  return p.evaluate(n=>{
    const own = DATA.find(x=>x.name===n);
    const r = wrap.getBoundingClientRect(), inv = scene.getScreenCTM().inverse();
    let ground = 0, kept = 0;
    for(let y = r.y + 60; y < r.y + r.height - 120; y += 2)
      for(let x = r.x + 10; x < r.x + r.width - 10; x += 2){
        if(!inShape(own.code, new DOMPoint(x, y).matrixTransform(inv))) continue;
        const el = document.elementFromPoint(x, y);
        const c = el && el.closest ? el.closest('[data-code]') : null;
        const hit = c && BY_CODE[c.dataset.code];
        if(hit !== own) continue;                 // drawn over by a small one
        ground++;
        const near = reachFor(x, y, hit);
        const took = near && (!hit || near.e === hit || near.w < screenSize(hit));
        if(!took || near.e === own) kept++;
      }
    return {ground, kept};
  }, name);
};
const israel = await keeps('Israel', 35.0, 31.9);
ok(`at full zoom, Israel keeps most of its own ground (${israel.kept}/${israel.ground})`,
   israel.ground > 100 && israel.kept / israel.ground >= 0.75, true);
/* Qatar, beside Bahrain: thirty-two pixels wide, and Bahrain's skirt once took
   twenty-two of them - 38% of Qatar in view. */
const qatar = await keeps('Qatar', 50.56, 26.03);
ok(`at full zoom, Qatar keeps most of its own ground (${qatar.kept}/${qatar.ground})`,
   qatar.ground > 100 && qatar.kept / qatar.ground >= 0.85, true);

/* and at the opening view, the compensation costs nobody anything */
await p.evaluate(()=>{ S.sel = null; closeAsk(true); fitCurrent(); });
await p.waitForTimeout(1500);
const wide = await p.evaluate(()=>{
  const u = k*unitPx(), out = [];
  for(const e of DATA){
    if(!e.play || !e.held || !e.at) continue;
    const c = Math.max(0, ...e.at.map(a => claimAt(a, u, screenSize(e))));
    if(c > 4) out.push(`${e.name} ${c.toFixed(1)}px`);
  }
  return out;
});
ok('at the opening view, no skirt is wider than 4px', wide, []);

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
