/* An enclave drawn under its host is swallowed by it: invisible while both are
   the colour of paper, and wearing the host's green the moment the host is
   named - an answer that was never given. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = []; let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got)===JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ')+w.padEnd(52), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const p = await b.newPage({viewport: PHONE});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
await p.click('.game[data-mode="world"]'); await p.waitForTimeout(250);
const g0 = await p.$('.menupanel:not([hidden]) button.go'); if(g0) await g0.click();
await p.waitForTimeout(1500);

const PAIRS = [['Vatican City','Italy'], ['San Marino','Italy'], ['Monaco','France'],
               ['Liechtenstein','Austria'], ['Singapore','Malaysia'],
               ['Palestine','Israel'], ['Andorra','Spain'], ['Lesotho','South Africa']];

/* nothing of the small one is left showing, so it can wear the host's colour */
const buried = await p.evaluate(pairs=>pairs.filter(([a,h])=>{
  const A = DATA.find(x=>x.name===a), H = DATA.find(x=>x.name===h);
  const ea = document.querySelector(`#land path.c[data-code="${A.code}"]`);
  const eh = document.querySelector(`#land path.c[data-code="${H.code}"]`);
  const kids = [...ea.parentNode.children];
  return kids.indexOf(ea) < kids.indexOf(eh);
}).map(x=>x[0]), PAIRS);
ok('none is painted under its host', buried, []);

/* and a point on the shape as drawn answers for the enclave, not the host.

   Asked of the drawn shape, not of e.at - that records where an island truly
   is, which for a country of several islands is not where it is painted. A
   group is magnified about its own middle, so the pieces move apart; what you
   reach for stays put on purpose. */
const wrong = [];
for(const [a] of PAIRS){
  const got = await p.evaluate(n=>{
    const e = DATA.find(x=>x.name===n);
    const els = (nodes[e.code]||[]).filter(el=>el.getBBox && el.getBBox().width > 0);
    if(!els.length) return 'not drawn';
    const bb = els[0].getBBox(), m = scene.getScreenCTM();
    /* and on screen: Singapore sits past the right edge at the opening view,
       where elementFromPoint answers null for every shape there is */
    const r = wrap.getBoundingClientRect();
    for(let i=1;i<=9;i++) for(let j=1;j<=9;j++){
      const q = new DOMPoint(bb.x + bb.width*i/10, bb.y + bb.height*j/10);
      if(!els.some(el=>el.isPointInFill && el.isPointInFill(q))) continue;
      const sx = m.a*q.x + m.c*q.y + m.e, sy = m.b*q.x + m.d*q.y + m.f;
      if(sx < r.x || sx > r.x+r.width || sy < r.y || sy > r.y+r.height) continue;
      const el = document.elementFromPoint(sx, sy);
      const c = el && el.closest ? el.closest('[data-code]') : null;
      return c ? BY_CODE[c.dataset.code].name : 'nothing';
    }
    return 'off screen';
  }, a);
  if(got !== a && got !== 'off screen') wrong.push(`${a}->${got}`);
}
ok('a point on each one answers for itself', wrong, []);

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
