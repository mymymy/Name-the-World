/* A word that names two places names neither on its own. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = []; let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got)===JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ')+w.padEnd(50), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const p = await b.newPage({viewport: PHONE});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
await p.click('.game[data-mode="world"]'); await p.waitForTimeout(250);
const g0 = await p.$('.menupanel:not([hidden]) button.go'); if(g0) await g0.click();
await p.waitForTimeout(1400);

/* put a country up to be named, with a clean slate */
const askAbout = name => p.evaluate(n=>{
  const e = DATA.find(x=>x.name===n);
  if(!targets().includes(e)) S.pick = S.pick.slice(0,-1).concat(e.code);
  delete S.ans[e.code]; S.sel = null; closeAsk(); S.list = true; select(e.code);
}, name);
const answered = name => p.evaluate(n=>{
  const a = S.ans[DATA.find(x=>x.name===n).code];
  return !a ? null : (a.ok ? 'right' : (a.told ? 'told' : 'wrong'));
}, name);
const rowsNow = ()=>p.evaluate(()=>[...document.querySelectorAll('#sug .row')]
  .map(r=>r.querySelector('span').textContent));

console.log('typing an ambiguous word and pressing Enter');
for(const [word, target] of [['Korea','South Korea'], ['United','United Kingdom']]){
  await askAbout(target); await p.waitForTimeout(1300);
  await p.fill('#find', word); await p.waitForTimeout(250);
  await p.press('#find', 'Enter'); await p.waitForTimeout(350);
  ok(`"${word}" alone does not answer for ${target}`, await answered(target), null);
  ok(`"${word}" says which one`,
     await p.evaluate(()=>$('#asknote').textContent), 'Which one?');
}

console.log('\nand both are offered');
await askAbout('South Korea'); await p.waitForTimeout(1300);
await p.fill('#find', 'Korea'); await p.waitForTimeout(250);
ok('the list has North Korea and South Korea',
   (await rowsNow()).filter(n=>/Korea/.test(n)).sort(), ['North Korea','South Korea']);

console.log('\npicking one deliberately still works');
await p.press('#find', 'ArrowDown'); await p.waitForTimeout(150);
const picked = (await rowsNow())[1];
await p.press('#find', 'Enter'); await p.waitForTimeout(400);
ok(`arrowing to "${picked}" and pressing Enter answers`,
   await p.evaluate(n=>{ const a = S.ans[DATA.find(x=>x.name===n).code];
     return a ? 'answered' : 'nothing'; }, picked), 'answered');

console.log('\na clear winner is still taken on Enter');
for(const [typed, want] of [['ger','Germany'], ['sudan','Sudan'],
                            ['guinea','Guinea'], ['congo','Republic of the Congo']]){
  await askAbout(want); await p.waitForTimeout(1300);
  await p.fill('#find', typed); await p.waitForTimeout(250);
  await p.press('#find', 'Enter'); await p.waitForTimeout(350);
  ok(`"${typed}" still names ${want}`, await answered(want), 'right');
}

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
