/* Every name the game answers to still points at the place it belongs to.
   An alias is a claim on a string, and the strings are shared: the sweep is
   what stops a new one quietly taking a name off somewhere else. */
import { chromium, PAGE, PHONE } from './lib.mjs';
const b = await chromium.launch();
const errs = [];
let pass = 0, fail = 0;
const ok = (w, got, want)=>{ const g = JSON.stringify(got) === JSON.stringify(want);
  g ? pass++ : fail++;
  console.log((g?'  ok   ':'  FAIL ') + w.padEnd(48), g?'':`got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const p = await b.newPage({viewport:{width:900, height:800}});
p.on('pageerror', e=>errs.push(e.stack.split('\n')[0]));
p.on('console', m=>{ if(m.type()==='error' && !/TUNNEL_CONNECTION_FAILED/.test(m.text()))
  errs.push('console ' + m.text()); });
await p.goto(PAGE);
await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
await p.click('.game[data-mode="world"]'); await p.waitForTimeout(250);
const g = await p.$('.menupanel:not([hidden]) button.go'); if(g) await g.click();
await p.waitForTimeout(800);

console.log('every name in the data resolves to its own place');
const sweep = await p.evaluate(()=>{
  const bad = {name:[], alias:[], also:[], hard:[]};
  let blank = 0;
  for(const e of targets()){
    const soft = n => { const r = resolve(n); return r && r.code === e.code; };
    const firm = n => { const r = resolveStrict(n); return r && r.code === e.code; };
    if(!soft(e.name)) bad.name.push(e.name);
    if(!firm(e.name)) bad.hard.push(e.name);
    for(const a of (e.aliases || [])){
      if(!soft(a)) bad.alias.push(`${a} -> ${e.name}`);
      /* an alias matched in full is worth 0.5, which the hard game takes */
      if(!firm(a)) bad.hard.push(`${a} -> ${e.name}`);
    }
    /* Twenty of these are formal names in Cyrillic, Chinese, Thai, Greek,
       Korean, Amharic or Devanagari, and norm() keeps only [a-z0-9 ] - so they
       come out as the empty string and can never be typed. Inert rather than
       dangerous: rank() answers nothing to an empty query, checked separately.
       They are not names the game can be asked, so they are not swept. */
    for(const a of (e.exact ? [...e.exact] : [])){
      if(!a) { blank++; continue; }
      if(!soft(a)) bad.also.push(`${a} -> ${e.name}`);
    }
  }
  bad.blank = blank;
  return bad;
});
ok('every country name', sweep.name, []);
ok('every alias', sweep.alias, []);
ok('every formal name that can be typed', sweep.also, []);
/* and the ones that cannot are harmless: nothing answers an empty query */
ok('a name that normalises to nothing matches nothing',
   await p.evaluate(()=>['###','   ','你好'].map(q=>{
     const r = resolve(q); return r ? r.name : null; })), [null, null, null]);
ok('and all of them in the hard game too', sweep.hard, []);

console.log('\nthe one just added');
const look = q => p.evaluate(s=>{
  const r = rank(s), e = resolve(s), h = resolveStrict(s);
  return {top: r.length ? r[0].e.name + ':' + r[0].s : null,
          n: r.length, easy: e && e.name, hard: h && h.name};
}, q);
{
  const full = await look('republic of ireland');
  ok('typed in full it is Ireland', [full.easy, full.hard], ['Ireland', 'Ireland']);
  ok('and scores as a name, not a near miss', full.top, 'Ireland:0.5');
}
for(const q of ['republic of i', 'republic of irel', 'republic of irelan']){
  const r = await look(q);
  ok(`"${q}" offers it while you type`, r.easy, 'Ireland');
}
/* the hard game asks for the whole name, and a part of one is not it */
ok('a part of it is still refused from memory',
   (await look('republic of irel')).hard, null);
/* it must not have taken the Republics' letters away from them */
{
  const r = await p.evaluate(()=>rank('republic of').map(h=>h.e.name));
  ok('the Congos still lead on "republic of"', r[0], 'Republic of the Congo');
  ok('and Ireland is among them, not instead of them',
     r.includes('Ireland') && r.includes('Democratic Republic of the Congo'), true);
}

console.log('\nerrors:', [...new Set(errs)]);
console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail || errs.length ? 1 : 0);
