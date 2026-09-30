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

const reset = async ()=>{ await p.evaluate(()=>{ S.sel = null; closeAsk(); fitCurrent(); });
  await p.waitForTimeout(1000); };
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
  const on = (x,y) => {
    const q = new DOMPoint(x,y).matrixTransform(inv);
    for(const el of (nodes[e.code]||[]))
      { try{ if(el.isPointInFill && el.isPointInFill(q)) return true; }catch(err){} }
    return false;
  };
  const cand = [];
  for(let i=1;i<=9;i++) for(let j=1;j<=9;j++){
    const x = b.x + b.width*i/10, y = b.y + b.height*j/10;
    cand.push([x, y, Math.hypot(i-5, j-5)]);
  }
  cand.sort((p,q2)=>p[2]-q2[2]);
  for(const [x,y] of cand) if(ok(x,y) && on(x,y)) return [x,y];
  const cx = b.x + b.width/2, cy = b.y + b.height/2;
  return ok(cx,cy) ? [cx,cy] : null;
}, name);
const picked = ()=>p.evaluate(()=>S.sel && BY_CODE[S.sel] && entryForShape(BY_CODE[S.sel]).name);

await reset();
/* the same set on either build: the countries small enough to have been dots */
const held = await p.evaluate(()=>DATA.filter(e=>e.play && e.px < 30).map(e=>e.name));
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

console.log('\na tap 16px off the mark - a miss, by the old rules');
{
  let n = 0, found = 0; const lost = [];
  for(const name of onScreen){
    for(const [dx,dy] of [[16,0],[-16,0],[0,16],[0,-16]]){
      await reset();
      const s = await spotOf(name); if(!s) continue;
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
