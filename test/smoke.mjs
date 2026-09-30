/* Every game starts, draws, and lets a place be named. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = [];
let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got) === JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ') + w.padEnd(46), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
for(const mode of ['world','continents','flags','counties','states','boroughs']){
  const p = await b.newPage({viewport: PHONE});
  p.on('pageerror', e=>errs.push(mode+': '+e.stack.split('\n')[0]));
  p.on('console', m=>{ if(m.type()==='error' && !/TUNNEL_CONNECTION_FAILED/.test(m.text()))
    errs.push(mode+' console: ' + m.text()); });
  await p.goto(PAGE);
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  for(let i=0;i<3;i++){ const back = await p.$('.menupanel:not([hidden]) .back');
    if(!back) break; await back.click(); await p.waitForTimeout(200); }
  if(['counties','states','boroughs'].includes(mode)){
    await p.click('button.more:has-text("For the locals")'); await p.waitForTimeout(250); }
  await p.click(`.game[data-mode="${mode}"]`); await p.waitForTimeout(300);
  const g = await p.$('.menupanel:not([hidden]) button.go'); if(g) await g.click();
  await p.waitForTimeout(1000);
  const r = await p.evaluate(()=>{
    const t = targets(); select(t[0].code); return {n:t.length, first:t[0].name};
  });
  await p.waitForTimeout(900);
  await p.evaluate(n=>answer(n), r.first);
  await p.waitForTimeout(600);
  const got = await p.evaluate(()=>{ const a = S.ans[Object.keys(S.ans)[0]]; return a && a.ok; });
  ok(`${mode}: ${r.n} targets, named one`, got, true);
  await p.close();
}
console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
