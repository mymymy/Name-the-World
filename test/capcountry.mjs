/* Hit anywhere on France to be asked about Paris. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = []; let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got)===JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ')+w.padEnd(46), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const p = await b.newPage({viewport: PHONE});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
p.on('console', m=>{ if(m.type()==='error' && !/TUNNEL_CONNECTION_FAILED/.test(m.text()))
  errs.push('console ' + m.text()); });
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
await p.click('.game[data-mode="capitals"]'); await p.waitForTimeout(300);
const g0 = await p.$('.menupanel:not([hidden]) button.go'); if(g0) await g0.click();
await p.waitForTimeout(1600);
await p.evaluate(()=>{ S.sel=null; closeAsk(true); hideTip(); fitCurrent(); });
await p.waitForTimeout(1600);

/* Every point of every country on screen, sampled on a grid, put to the same
   question a tap asks - without clicking, so the map holds still. */
const sweep = await p.evaluate(()=>{
  const r = wrap.getBoundingClientRect();
  const m = scene.getScreenCTM(), inv = m.inverse();
  let n = 0, itsOwn = 0, aDot = 0, nothing = 0;
  const strays = []; const others = {};
  for(const e of DATA){
    if(!e.g || !BY_CODE['CAP-'+e.code]) continue;
    const els = nodes[e.code]; if(!els) continue;
    const bb = els[0].getBoundingClientRect();
    if(!bb.width) continue;
    for(let i=1;i<=5;i++) for(let j=1;j<=5;j++){
      const x = Math.round(bb.x + bb.width*i/6), y = Math.round(bb.y + bb.height*j/6);
      if(x<r.x+20 || x>r.x+r.width-20 || y<r.y+20 || y>r.y+r.height-100) continue;
      /* only points actually on this country */
      const q = new DOMPoint(x,y).matrixTransform(inv);
      if(!els.some(el=>el.isPointInFill && el.isPointInFill(q))) continue;
      const u = document.elementFromPoint(x,y);
      const c = u && u.closest ? u.closest('[data-code]') : null;
      const hit = c && BY_CODE[c.dataset.code];
      const near = reachFor(x, y, hit);
      const took = near && (!hit || near.e === hit || near.w < screenSize(hit));
      const win = took ? near.e : (hit ? entryForShape(hit) : null);
      n++;
      if(!win){ nothing++; if(strays.length<8) strays.push(e.name+' at ('+x+','+y+') -> nothing'); continue; }
      if(win.iso === e.code) itsOwn++;
      else if(win.isCap){ aDot++;
        const key = e.name + ' -> ' + win.name + ' (' + win.of + ')';
        others[key] = (others[key]||0) + 1; }
      else { if(strays.length<8) strays.push(e.name+' -> '+win.name); }
    }
  }
  return {n, itsOwn, aDot, nothing, strays, others};
});
console.log(`points sampled on countries that have a capital: ${sweep.n}`);
console.log(`  answer their own country's capital: ${sweep.itsOwn}`);
console.log(`  answer a neighbour's city (a nearer dot): ${sweep.aDot}`);
console.log(`  answer nothing: ${sweep.nothing}`);
{
  const rows = Object.entries(sweep.others).sort((a,b)=>b[1]-a[1]);
  console.log('  where they go, commonest first:');
  for(const [k,v] of rows.slice(0,14)) console.log('    ' + v + '  ' + k);
  console.log('    (' + rows.length + ' distinct pairs)\n');
}
ok('no point on such a country answers nothing', sweep.nothing, 0);
ok('nothing answers a non-city', sweep.strays.filter(s=>!/nothing/.test(s)), []);

console.log('\nclicked, in the middle of a few big countries');
{
  const wrong = [];
  for(const [country, capital] of [['France','Paris'], ['Brazil','Brasília'],
                                   ['Kazakhstan','Astana'], ['Algeria','Algiers']]){
    await p.evaluate(()=>{ S.sel=null; closeAsk(true); hideTip(); fitCurrent(); });
    let last=null, same=0;
    for(let j=0;j<50 && same<3;j++){ const now = await p.evaluate(()=>[k,tx,ty,lam0].join(','));
      same = now===last ? same+1 : 0; last=now; await p.waitForTimeout(70); }
    const s = await p.evaluate(n=>{
      const e = DATA.find(x=>x.name===n), els = nodes[e.code];
      const bb = els[0].getBoundingClientRect(), r = wrap.getBoundingClientRect();
      const m = scene.getScreenCTM(), inv = m.inverse();
      for(let i=1;i<=9;i++) for(let j=1;j<=9;j++){
        const x = Math.round(bb.x+bb.width*i/10), y = Math.round(bb.y+bb.height*j/10);
        if(x<r.x+30||x>r.x+r.width-30||y<r.y+30||y>r.y+r.height-140) continue;
        const q = new DOMPoint(x,y).matrixTransform(inv);
        if(els.some(el=>el.isPointInFill && el.isPointInFill(q))) return [x,y];
      }
      return null;
    }, country);
    if(!s) continue;
    await p.mouse.click(s[0], s[1]); await p.waitForTimeout(300);
    const got = await p.evaluate(()=>S.sel && BY_CODE[S.sel] && BY_CODE[S.sel].name);
    if(got !== capital) wrong.push(`${country}->${got||'nothing'}`);
  }
  ok('tapping the country asks about its capital', wrong, []);
}

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
