/* The names the data offers in their own scripts have to be typeable, and
   nothing about the Latin ones may change. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = []; let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got)===JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ')+w.padEnd(44), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const p = await b.newPage({viewport: PHONE});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
await p.click('.game[data-mode="world"]'); await p.waitForTimeout(250);
const g0 = await p.$('.menupanel:not([hidden]) button.go'); if(g0) await g0.click();
await p.waitForTimeout(1300);

/* nothing in the data normalises away to nothing any more */
ok('no name normalises to nothing', await p.evaluate(()=>{
  const dead = [];
  for(const e of DATA){
    if(!e.play) continue;
    for(const s of (e.also||[]).concat(e.aliases||[]))
      if(typeof s === 'string' && !norm(s)) dead.push(e.name + ': ' + s);
  }
  return dead;
}), []);

/* each one, typed, names its country - asked of the matcher the box uses */
console.log('\ntyped in its own script');
{
  const wrong = [];
  const cases = await p.evaluate(()=>{
    const out = [];
    for(const e of DATA){
      if(!e.play) continue;
      for(const s of (e.also||[]))
        if(typeof s === 'string' && !/^[\x00-\x7f]*$/.test(s)) out.push([e.name, s]);
    }
    return out;
  });
  for(const [name, written] of cases){
    const got = await p.evaluate(([n, s])=>{
      const e = DATA.find(x=>x.name===n);
      if(!targets().includes(e)) return 'not in play';
      const r = rank(norm(s));
      return r.length ? r[0].e.name + '@' + r[0].s : 'nothing';
    }, [name, written]);
    /* A full official name is an exact-alias match, scoring 0.5 - or 0 where
       it strips down to the country's own name, as Táiwān and România do. */
    if(got !== `${name}@0.5` && got !== `${name}@0` && got !== 'not in play')
      wrong.push(`${written} -> ${got}`);
  }
  ok(`all ${cases.length} of them name their country`, wrong, []);
}

/* and hard mode, which only takes an exact name or an exact alias */
console.log('\nand hard mode accepts them');
ok('Российская Федерация resolves to Russia', await p.evaluate(()=>{
  const e = DATA.find(x=>x.name==='Russia');
  if(!targets().includes(e)) return 'not in play';
  const r = resolveStrict(norm('Российская Федерация'));
  return r ? r.name : 'nothing';
}), 'Russia');

/* the Latin side is untouched */
console.log('\nthe Latin names are unchanged');
{
  const cases = [['germany','Germany',0], ['deutschland','Germany',0.5],
                 ['holland','Netherlands',0.5], ['the gambia','Gambia',0],
                 ['cote d\'ivoire','Ivory Coast',0.5], ['republic of ireland','Ireland',0.5],
                 ['u s a','United States',0.5], ['germny','Germany',null]];
  const wrong = [];
  for(const [typed, want, score] of cases){
    const got = await p.evaluate(([q, w])=>{
      const e = DATA.find(x=>x.name===w);
      if(!targets().includes(e)) return 'not in play';
      const r = rank(norm(q));
      return r.length ? r[0].e.name + '@' + r[0].s : 'nothing';
    }, [typed, want]);
    if(got === 'not in play') continue;
    const okNow = score === null ? got.startsWith(want + '@') : got === `${want}@${score}`;
    if(!okNow) wrong.push(`"${typed}" -> ${got} (wanted ${want}${score===null?'':'@'+score})`);
  }
  ok('the usual spellings still rank as they did', wrong, []);
}

/* and the whole way through: pick the country, type the name in its own
   script into the box, press Enter, and see it marked right */
console.log('\nthrough the box, as a player would');
for(const [country, written] of [['Russia','Российская Федерация'],
                                 ['China','中华人民共和国'],
                                 ['Greece','Ελληνική Δημοκρατία']]){
  const there = await p.evaluate(n=>{
    const e = DATA.find(x=>x.name===n);
    if(!targets().includes(e)){ S.pick = S.pick.slice(0,-1).concat(e.code); }
    delete S.ans[e.code]; S.sel = null; closeAsk(); select(e.code); return true;
  }, country);
  if(!there) continue;
  await p.waitForTimeout(1400);
  await p.fill('#find', written);
  await p.waitForTimeout(200);
  await p.press('#find', 'Enter');
  await p.waitForTimeout(500);
  const got = await p.evaluate(n=>{
    const e = DATA.find(x=>x.name===n), a = S.ans[e.code];
    return !a ? 'no answer recorded' : (a.ok ? 'right' : (a.told ? 'told' : 'wrong'));
  }, country);
  ok(`typing "${written}" names ${country}`, got, 'right');
}

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
