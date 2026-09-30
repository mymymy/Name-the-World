/* The same reach, on the boards that are not the globe.

   Rhode Island is 7px on the states, Bristol 8 on the counties, the City of
   London 1. These are not islands in a sea - they tile, each against its
   neighbours - so nothing is magnified here: a shape grown over its neighbour
   would be drawing a border that is not there. Only the reach applies. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = [];
let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got) === JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ') + w.padEnd(48), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
for(const mode of ['counties','states','boroughs']){
  const p = await b.newPage({viewport: PHONE});
  p.on('pageerror', e=>errs.push(mode+': '+e.stack.split('\n')[0]));
  p.on('console', m=>{ if(m.type()==='error' && !/TUNNEL_CONNECTION_FAILED/.test(m.text()))
    errs.push(mode+' console: '+m.text()); });
  await p.goto(PAGE);
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  for(let i=0;i<3;i++){ const back=await p.$('.menupanel:not([hidden]) .back');
    if(!back) break; await back.click(); await p.waitForTimeout(200); }
  await p.click('button.more:has-text("For the locals")'); await p.waitForTimeout(250);
  await p.click(`.game[data-mode="${mode}"]`); await p.waitForTimeout(300);
  const g=await p.$('.menupanel:not([hidden]) button.go'); if(g) await g.click();
  await p.waitForTimeout(1300);

  const reset = async ()=>{ await p.evaluate(()=>{ S.sel=null; closeAsk(); fitCurrent(); });
    await p.waitForTimeout(900); };
  const spotOf = name => p.evaluate(n=>{
    const e = targets().find(x=>x.name===n); if(!e) return null;
    const els=[...document.querySelectorAll(`[data-code="${e.code}"]`)]
      .filter(x=>x.getBoundingClientRect().width>0);
    if(!els.length) return null;
    const b=els[0].getBoundingClientRect(), r=wrap.getBoundingClientRect();
    const ok=(x,y)=>x>r.x+24 && x<r.x+r.width-24 && y>r.y+24 && y<r.y+r.height-90;
    /* on the shape itself, by its geometry - a county's bounding-box centre is
       often in its neighbour, and a borough drawn under another is never what a
       pixel reports */
    const m=scene.getScreenCTM(), inv=m.inverse();
    const on=(x,y)=>{ const q=new DOMPoint(x,y).matrixTransform(inv);
      for(const el of (nodes[e.code]||[]))
        { try{ if(el.isPointInFill && el.isPointInFill(q)) return true; }catch(err){} }
      return false; };
    const cand=[];
    for(let i=1;i<=9;i++) for(let j=1;j<=9;j++)
      cand.push([b.x+b.width*i/10, b.y+b.height*j/10, Math.hypot(i-5,j-5)]);
    cand.sort((p,q2)=>p[2]-q2[2]);
    for(const [x,y] of cand) if(ok(x,y) && on(x,y)) return [x,y];
    const cx=b.x+b.width/2, cy=b.y+b.height/2;
    return ok(cx,cy) ? [cx,cy] : null;
  }, name);
  const picked = ()=>p.evaluate(()=>S.sel && BY_CODE[S.sel] && entryForShape(BY_CODE[S.sel]).name);

  await reset();
  /* the ten smallest on this board, which is where the trouble is */
  const small = await p.evaluate(()=>targets().map(e=>{
      const els=[...document.querySelectorAll(`[data-code="${e.code}"]`)]
        .filter(x=>x.getBoundingClientRect().width>0);
      const r = els.length ? els[0].getBoundingClientRect() : null;
      return {n:e.name, w:r?Math.max(r.width,r.height):0};
    }).filter(x=>x.w>0).sort((a,b)=>a.w-b.w).slice(0,10).map(x=>x.n));

  let hit = 0, tries = 0; const missed = [];
  for(const n of small){
    await reset();
    const s = await spotOf(n); if(!s) continue;
    tries++;
    await p.mouse.click(s[0], s[1]); await p.waitForTimeout(150);
    if(await picked() === n) hit++; else missed.push(n + '->' + (await picked() || 'nothing'));
  }
  ok(`${mode}: the ten smallest all answer a tap (${hit}/${tries})`, missed, []);
  await p.close();
}
console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
