/* What every test here needs and nothing else: a browser, and the address of
   the page under test.

   Both were written into each file once, pointing at one container's disk -
   a Playwright inside /opt and a page inside /home/user. Neither is true
   anywhere else, so both are worked out here instead: the page is found
   relative to this file, and Playwright is looked for where npm puts it
   before anywhere else. */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

/* the page beside this folder, as a file:// address */
export const PAGE = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html')).href;

async function find(){
  const tries = [
    process.env.NTW_PLAYWRIGHT,          // say where, if it is somewhere odd
    'playwright',                        // installed as a dependency, the usual case
    '/opt/node22/lib/node_modules/playwright/index.js'
  ].filter(Boolean);
  const why = [];
  for(const where of tries){
    try{
      const m = await import(where);
      const c = m.chromium || (m.default && m.default.chromium);
      if(c) return c;
      why.push(where + ': loaded but has no chromium');
    }catch(e){ why.push(where + ': ' + e.code || e.message); }
  }
  throw new Error('Playwright not found.\n  tried:\n    ' + why.join('\n    ') +
    '\n  fix: npm install --no-save playwright && npx playwright install chromium' +
    '\n  or:  NTW_PLAYWRIGHT=/path/to/playwright node test/run.mjs');
}
export const chromium = await find();

/* A phone, which is what this game is mostly played on and where every one of
   the problems these tests are about was first noticed. */
export const PHONE = {width: 390, height: 844};
