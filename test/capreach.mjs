/* A capital is a seven-pixel dot - the smallest target in the game, and the
   only one the reach never covered. */
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

console.log('a capital is ' + await p.evaluate(()=>{
  const el = document.querySelector('circle.dot');
  return el ? el.getBoundingClientRect().width.toFixed(1) : '?';
}) + 'px across at the opening view\n');

/* Asked of reachFor, which is the function the click itself calls, and asked
   without clicking anything: naming a place flies the map and turns the globe,
   so a test that taps its way through two hundred cities spends its time
   chasing the view rather than measuring the rule. */
const off = await p.evaluate(()=>{
  const r = wrap.getBoundingClientRect();
  const inMap = (x,y)=> x>r.x+26 && x<r.x+r.width-26 && y>r.y+26 && y<r.y+r.height-100;
  let n = 0, found = 0, itself = 0; const dead = [];
  for(const e of targets()){
    const el = document.querySelector(`circle.dot[data-code="${e.code}"]`);
    if(!el) continue;
    const bb = el.getBoundingClientRect();
    const cx = Math.round(bb.x+bb.width/2), cy = Math.round(bb.y+bb.height/2);
    if(!inMap(cx, cy)) continue;
    for(const [dx,dy] of [[12,0],[-12,0],[0,12],[0,-12]]){
      if(!inMap(cx+dx, cy+dy)) continue;
      n++;
      const q = document.elementFromPoint(cx+dx, cy+dy);
      const c = q && q.closest ? q.closest('[data-code]') : null;
      const hit = c && BY_CODE[c.dataset.code];
      const near = reachFor(cx+dx, cy+dy, hit);
      /* the whole of what a tap decides, not the reach alone - over land the
         country now answers for the city in it, and the reach never sees it */
      const took = near && (!hit || near.e === hit || near.w < screenSize(hit));
      const win = took ? near.e : (hit ? entryForShape(hit) : null);
      if(!win){ dead.push(e.name + ' ' + dx + ',' + dy); continue; }
      found++; if(win === e) itself++;
    }
  }
  return {n, found, itself, dead: dead.slice(0,10)};
});
console.log('a tap 12px off a dot - a miss, by the old rules');
ok(`finds a city every time (${off.found} of ${off.n})`, off.dead, []);
console.log(`     ${off.itself} of ${off.found} answer the dot they were aimed at;` +
            ` the rest go to a nearer neighbour`);

/* and the whole way through, on a handful - two cities drawn within a dot's
   width of each other are not distinguishable here and the nearer one wins,
   which is the rule, so they are left out */
console.log('\nand a tap on the dot names that city');
const clean = await p.evaluate(()=>{
  const r = wrap.getBoundingClientRect();
  const spot = e => { const el = document.querySelector(`circle.dot[data-code="${e.code}"]`);
    if(!el) return null; const bb = el.getBoundingClientRect();
    return [Math.round(bb.x+bb.width/2), Math.round(bb.y+bb.height/2)]; };
  const out = [];
  for(const e of targets()){
    const s = spot(e); if(!s) continue;
    if(s[0]<r.x+40 || s[0]>r.x+r.width-40 || s[1]<r.y+40 || s[1]>r.y+r.height-140) continue;
    let crowded = false;
    for(const o of targets()){
      if(o === e) continue;
      const t = spot(o); if(!t) continue;
      if(Math.hypot(t[0]-s[0], t[1]-s[1]) < 10){ crowded = true; break; }
    }
    if(!crowded) out.push(e.name);
  }
  return out;
});
{
  const wrong = [];
  for(const name of clean.slice(0, 12)){
    await p.evaluate(()=>{ S.sel=null; closeAsk(true); hideTip(); fitCurrent(); });
    /* wait for the map to stop - k, the pan and the meridian, which flies on
       its own animation - and then for the dot to say the same thing twice */
    let s = null;
    for(let i = 0; i < 3 && !s; i++){
      let last = null, same = 0;
      for(let j = 0; j < 50 && same < 3; j++){
        const now = await p.evaluate(()=>[k, tx, ty, lam0].join(','));
        same = now === last ? same+1 : 0; last = now;
        await p.waitForTimeout(70);
      }
      /* and on screen when the tap happens, not when the list was made -
         fitCurrent() on this mode does not put the world back as it was, so
         Ankara had wandered off to (1397,-1359) by the time it was tapped */
      const where = n => p.evaluate(nm=>{
        const e = targets().find(x=>x.name===nm);
        const el = document.querySelector(`circle.dot[data-code="${e.code}"]`);
        if(!el) return null;
        const bb = el.getBoundingClientRect(), r = wrap.getBoundingClientRect();
        const x = Math.round(bb.x+bb.width/2), y = Math.round(bb.y+bb.height/2);
        if(x<r.x+40 || x>r.x+r.width-40 || y<r.y+40 || y>r.y+r.height-140) return null;
        const a = document.querySelector('#ask');
        if(a && getComputedStyle(a).display !== 'none'){
          const ab = a.getBoundingClientRect();
          if(ab.width && x>ab.x-8 && x<ab.x+ab.width+8 && y>ab.y-8 && y<ab.y+ab.height+8) return null;
        }
        return [x, y];
      }, n);
      const a = await where(name); if(!a) break;
      await p.waitForTimeout(140);
      const c = await where(name); if(!c) break;
      if(a[0]===c[0] && a[1]===c[1]) s = a;
    }
    if(!s) continue;
    await p.mouse.click(s[0], s[1]); await p.waitForTimeout(250);
    const got = await p.evaluate(()=>S.sel && BY_CODE[S.sel] && BY_CODE[S.sel].name);
    if(got !== name) wrong.push(`${name}->${got||'nothing'}`);
  }
  ok('clicked, each names its own city', wrong, []);
}

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
