/* Run them all, or the ones named.

     node test/run.mjs                  all of them
     node test/run.mjs reach spread     just those two
     node test/run.mjs --quick          the fast core, about two minutes

   Each test is its own program and says its own piece; this only starts them,
   one at a time - they all drive a browser and racing them makes the timings
   they depend on unreliable - and adds up what happened. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/* Ordered so the ones that fail loudest and quickest go first: a broken page
   fails smoke in fifteen seconds, and there is no sense spending ten minutes
   to be told again. */
const ALL = [
  ['smoke',      'every game starts, and a name can be given'],
  ['names',      'no alias quietly takes a name off another place'],
  ['scripts',    'a name can be typed in its own script'],
  ['ambig',      'a word naming two places names neither'],
  ['cardhead',   'the result card reads as it should'],
  ['enclaves',   'an enclave is not swallowed by its host'],
  ['ghosts',     'nothing is reachable where nothing is drawn'],
  ['reach',      'the small countries can be hit'],
  ['bigkeep',    'and the big ones keep their own taps'],
  ['caribbean',  'the Bahamas do not take taps inside Haiti'],
  ['gazareach',  'Gaza has a reach of its own, at every zoom'],
  ['boardreach', 'the same, on the counties, states and boroughs'],
  ['capreach',   'a capital is a 7px dot and has a touch area'],
  ['capcountry', 'and its country answers for it'],
  ['spread',     'two dots on one spot are parted, and stay home'],
];
const QUICK = ['smoke','names','scripts','ambig','enclaves','ghosts','reach'];

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const named = args.filter(a=>!a.startsWith('--'));
const pick = quick ? ALL.filter(([n])=>QUICK.includes(n))
           : named.length ? ALL.filter(([n])=>named.includes(n))
           : ALL;

if(!pick.length){
  console.error('no such test. known: ' + ALL.map(([n])=>n).join(' '));
  process.exit(2);
}

const run = name => new Promise(done=>{
  const t0 = Date.now();
  const kid = spawn(process.execPath, [join(HERE, name + '.mjs')], {stdio:['ignore','pipe','pipe']});
  let out = '';
  kid.stdout.on('data', d=>{ out += d; });
  kid.stderr.on('data', d=>{ out += d; });
  kid.on('close', code=>done({name, code, out, ms: Date.now()-t0}));
});

console.log(`running ${pick.length} test${pick.length>1?'s':''}\n`);
const results = [];
for(const [name, what] of pick){
  process.stdout.write(name.padEnd(12) + what.padEnd(48));
  const r = await run(name);
  results.push(r);
  const tally = (r.out.match(/(\d+) passed, (\d+) failed/) || [])[0] || '';
  process.stdout.write((r.code === 0 ? 'ok  ' : 'FAIL') +
    ('  ' + tally).padEnd(22) + (r.ms/1000).toFixed(0) + 's\n');
  if(r.code !== 0){
    for(const line of r.out.split('\n'))
      if(/FAIL|Error|errors: \[.+\]/.test(line)) console.log('             ' + line.trim());
  }
}
const bad = results.filter(r=>r.code !== 0);
const secs = (results.reduce((a,r)=>a+r.ms, 0)/1000).toFixed(0);
console.log(`\n${results.length - bad.length}/${results.length} passed in ${secs}s`);
if(bad.length) console.log('failed: ' + bad.map(r=>r.name).join(', '));
process.exit(bad.length ? 1 : 0);
