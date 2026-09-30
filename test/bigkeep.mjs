/* The reach must not take taps the big shapes should keep. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs=[]; let pass=0, fail=0;
const ok=(w,got,want)=>{const g=JSON.stringify(got)===JSON.stringify(want); g?pass++:fail++;
  console.log((g?'  ok   ':'  FAIL ')+w.padEnd(48), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);};
const start = async (p, mode)=>{
  await p.goto(PAGE);
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  for(let i=0;i<3;i++){ const back=await p.$('.menupanel:not([hidden]) .back');
    if(!back) break; await back.click(); await p.waitForTimeout(200); }
  if(['counties','states','boroughs'].includes(mode)){
    await p.click('button.more:has-text("For the locals")'); await p.waitForTimeout(250); }
  await p.click(`.game[data-mode="${mode}"]`); await p.waitForTimeout(300);
  const g=await p.$('.menupanel:not([hidden]) button.go'); if(g) await g.click();
  await p.waitForTimeout(1300);
};
for(const [mode, names] of [
  ['world', ['Brazil','Algeria','Kazakhstan','Australia','India','Argentina']],
  ['counties', ['North Yorkshire','Devon','Cumbria','Norfolk']],
  ['states', ['Texas','California','Montana','Nevada']],
  ['boroughs', ['Bromley','Hillingdon','Havering','Enfield']]]){
  const p = await b.newPage({viewport: PHONE});
  p.on('pageerror', e=>errs.push(mode+': '+e.stack.split('\n')[0]));
  await start(p, mode);
  const wrong=[];
  for(const n of names){
    await p.evaluate(()=>{ S.sel=null; closeAsk(); fitCurrent(); });
    await p.waitForTimeout(1000);
    const s = await p.evaluate(x=>{
      const e = targets().find(t=>t.name===x); if(!e) return null;
      const els=[...document.querySelectorAll(`[data-code="${e.code}"]`)]
        .filter(q=>q.getBoundingClientRect().width>0);
      if(!els.length) return null;
      /* a point actually inside the shape, not its bounding-box centre */
      const bb=els[0].getBoundingClientRect(), r=wrap.getBoundingClientRect();
      for(let i=0;i<400;i++){
        /* Whole pixels. A click event reports its coordinates truncated, so a
           point checked at x.7 is clicked at x - and a point that near a border
           is over it. Check the point that will actually be clicked. */
        const px=Math.round(bb.x+bb.width*(0.2+0.6*Math.random())),
              py=Math.round(bb.y+bb.height*(0.2+0.6*Math.random()));
        if(px<r.x+20||px>r.x+r.width-20||py<r.y+20||py>r.y+r.height-90) continue;
        const el=document.elementFromPoint(px,py);
        const c=el&&el.closest&&el.closest('[data-code]');
        if(c && c.dataset.code===e.code) return [px,py];
      }
      return null;
    }, n);
    if(!s) continue;
    await p.mouse.click(s[0], s[1]); await p.waitForTimeout(150);
    const got = await p.evaluate(()=>S.sel && entryForShape(BY_CODE[S.sel]).name);
    if(got !== n) wrong.push(`${n}->${got||'nothing'}`);
  }
  ok(`${mode}: big shapes keep their own taps`, wrong, []);
  await p.close();
}
console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail||errs.length?1:0);
