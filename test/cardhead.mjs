/* The top of the result card: two things, centred, in the order the run is
   judged in. The board sorts by score and only uses the clock to separate runs
   that tied, so the score leads and is the larger of the two - and a time on
   its own says nothing anyway, four minutes being a triumph over two hundred
   and nothing at all over three. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = [];
let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got) === JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ') + w.padEnd(50), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
async function played({mode='world', hard=false, right=0, wrong=0, help=0} = {}){
  const p = await b.newPage({viewport: PHONE});
  p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
  p.on('console', m=>{ if(m.type()==='error' && !/TUNNEL_CONNECTION_FAILED/.test(m.text()))
    errs.push('console ' + m.text()); });
  await p.goto(PAGE);
  await p.evaluate(()=>localStorage.clear());
  await p.reload(); await p.waitForTimeout(300);
  await p.click(`.game[data-mode="${mode}"]`); await p.waitForTimeout(250);
  const g = await p.$('.menupanel:not([hidden]) button.go'); if(g) await g.click();
  await p.waitForTimeout(800);
  await p.evaluate(o=>{
    S.list = !o.hard; render();
    const t = targets();
    for(let i=0;i<o.right;i++){ select(t[i].code); answer(t[i].name); }
    for(let i=0;i<o.help;i++) S.ans[t[i].code].aid = true;
    for(let i=o.right;i<o.right+o.wrong;i++) reveal(t[i].code);
    if(o.right + o.wrong < t.length) openSheet();
  }, {hard, right, wrong, help});
  await p.waitForTimeout(1600);
  /* a finished game raises the card by itself, on a delay; anything short of
     finished has to be asked. Either way, do not start measuring until it is up */
  if(!await p.$eval('#sheet', n=>n.classList.contains('on'))){
    await p.evaluate(()=>openSheet()); await p.waitForTimeout(500);
  }
  return p;
}
const txt = (p, s) => p.$eval(s, n=>n.textContent.replace(/\s+/g,' ').trim());

console.log('what it says, and only that');
{
  const p = await played({hard:true, right:188, wrong:12, help:3});
  ok('the score is the count and nothing else', await txt(p, '#score'), '188 of 200');
  ok('with its label underneath', await txt(p, '#scorewhat'), 'named correctly');
  ok('and the time under that', /^in \d+:\d\d$/.test(await txt(p, '#sheettime')), true);
  ok('the help taken is an aside, not part of the score',
     await txt(p, '#scoreaside'), '3 with suggestions');
  await p.close();
}
{
  const p = await played({mode:'continents', right:7});
  ok('a clean run has nothing to add', await txt(p, '#scoreaside'), '');
  ok('and the aside takes no room', await p.$eval('#scoreaside',
     n=>n.getBoundingClientRect().height), 0);
  await p.close();
}

console.log('\nthe order, and the weight');
{
  const p = await played({hard:true, right:188, wrong:12, help:3});
  ok('score, then label, then time, then the aside',
     await p.$$eval('#sheethead p', n=>n.map(x=>x.id)),
     ['score', 'scorewhat', 'sheettime', 'scoreaside']);
  const size = s => p.$eval(s, n=>parseFloat(getComputedStyle(n).fontSize));
  const [sc, ti, as] = [await size('#score'), await size('#sheettime'), await size('#scoreaside')];
  ok('the score is the biggest thing on the card', sc > ti, true);
  /* second, and plainly second - the qualifier, not the claim */
  ok('the time is second and clearly so', ti > as && ti < sc * 0.7, true);
  await p.close();
}

console.log('\nand it is centred');
{
  const p = await played({hard:true, right:188, wrong:12, help:3});
  const off = await p.evaluate(()=>{
    const h = document.querySelector('#sheethead').getBoundingClientRect();
    const mid = h.left + h.width/2;
    return ['#scoretitle','#score','#scorewhat','#sheettime','#scoreaside'].map(s=>{
      const r = document.querySelector(s).getBoundingClientRect();
      /* a block fills the width, so measure the ink by its own range */
      const n = document.querySelector(s);
      const rg = document.createRange(); rg.selectNodeContents(n);
      const b = rg.getBoundingClientRect();
      return {s, off: +((b.left + b.width/2) - mid).toFixed(1)};
    });
  });
  console.log('     ' + off.map(o=>`${o.s} ${o.off}`).join('   '));
  ok('every line sits on the middle', off.every(o=>Math.abs(o.off) <= 1), true);
  await p.close();
}

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
