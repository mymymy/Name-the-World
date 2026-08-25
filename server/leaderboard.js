/* Name the World - the leaderboard's other half.

   The game is a single page served as static files, which is why it works with
   no connection and why it cannot, on its own, hold a board everyone shares:
   there is nowhere for a run written by one player to be read by another. This
   is that somewhere. A Cloudflare Worker over one D1 database - D1 is SQLite -
   which is free at any scale this game is likely to reach and stops serving
   rather than billing you if it is not.

       GET    /runs?g=world/all   the board for one game, best first
       POST   /runs               add a run, as {g, n, s, t, ms}
       DELETE /runs/123           remove one, with the admin key
       POST   /picks              report what a run reached, as {g, o, p}
       GET    /picks?g=world/all  which places are hard, with the admin key

   Written on the assumption that the link gets shared further than intended.
   That means three things beyond storing rows:

   - Reads are answered from the edge cache, so a thousand people opening the
     board at once is one query, not a thousand.
   - Writes are rate limited per address, because the endpoint is as public as
     the page and posting to it is a five-line script.
   - There is a way to delete a row, because a public board with free-text
     names will eventually have something on it you want gone.

   What it cannot do is know whether a score is honest. It is worked out on the
   player's own machine, so a determined faker can claim anything the rules
   below allow. These checks keep out nonsense, not cheats. */

const GAMES = {                      // how many there are to name in each game
  'continents/all': 7,   'world/all': 200,    'capitals/all': 198,
  'flags/all': 199,      'counties/all': 48,  'boroughs/all': 33,
  'states/all': 50
};
const KEEP        = 100;             // rows kept per game
const SHOW        = 100;             // rows sent to the page
const MIN_MS_EACH = 400;             // nobody names a place faster than this
const MAX_MS      = 24 * 3600 * 1000;
const RATE_N      = 12;              // runs one address may post
const RATE_WINDOW = 3600 * 1000;     // ... per hour
const CACHE_S     = 30;              // how long the edge may hold a board
/* A player may report more than once in a game - on finishing, on leaving it,
   on closing the tab - and may well play several games in a sitting, so this
   is far looser than the board's. It is here to stop a script, not a player. */
const BEAT_N      = 60;              // reports one address may send per hour

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400'
};
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body),
  {status, headers: {...cors, 'content-type': 'application/json', ...extra}});

/* Names are shown to everyone else, so they are cut back to something plain:
   no control characters - which includes the right-to-left overrides people use
   to scramble a line - no runs of whitespace, and nothing long enough to break
   the layout. The page escapes them again when it draws them. */
function cleanName(v) {
  const s = String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return s || 'Anonymous';
}

/* A screen, not a filter. It catches the lazy cases and will miss anyone
   trying; the delete endpoint is what actually handles the rest.

   Three lists, because one rule cannot serve them all. Matching anywhere in a
   word catches fuckface but also Scunthorpe; matching whole words only spares
   Scunthorpe but lets fuckface through. So: terms that are never innocent
   inside another word are matched anywhere, ones that are only ever innocent
   in the middle are matched at either end of a word, and the ones that are
   somebody's surname have to be the whole word on their own. Dickinson,
   Penistone, Cockburn and Scunthorpe all get to play. */
const ANYWHERE = ['nigger','nigga','faggot','paedophile','pedophile','rapist',
                  'wanker','bollock','arsehole','motherfuck','dickhead',
                  'cockhead','shithead','bellend'];
const EDGE     = ['fuck','shit','cunt','wank','twat','slut','whore','retard','bastard'];
/* Dick and Cock are somebody's name often enough that they are left out
   altogether: their rude uses are compounds, which the list above catches. */
const WHOLE    = ['fag','prick','knob','nazi','hitler','rape',
                  'pedo','paedo','kys','minge','tits','wog','spastic'];
const LEET = {'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','@':'a','$':'s','!':'i'};
function foldName(s) {
  return s.toLowerCase().replace(/[0134578@$!]/g, c => LEET[c] || c)
          .replace(/[^a-z0-9]+/g, ' ').trim();
}
function tooRude(name) {
  const folded = foldName(name);
  if (ANYWHERE.some(r => folded.includes(r))) return true;
  return folded.split(' ').some(w =>
    WHOLE.includes(w) || EDGE.some(r => w.startsWith(r) || w.endsWith(r)));
}

function cleanRun(r) {
  if (!r || typeof r !== 'object') return null;
  const game = String(r.g || '');
  const total = GAMES[game];
  if (!total) return null;                              // a game we do not know
  const score = Number(r.s), ms = Number(r.ms), claimed = Number(r.t);
  if (![score, ms, claimed].every(Number.isFinite)) return null;
  if (claimed !== total) return null;                   // not the game it claims
  if (score < 0 || score > total) return null;
  if (ms < score * MIN_MS_EACH || ms > MAX_MS) return null;
  const name = cleanName(r.n);
  if (tooRude(name)) return null;
  return {game, name, fold: foldName(name) || name.toLowerCase(),
          score: Math.round(score), total, ms: Math.round(ms), at: Date.now()};
}

/* Addresses are kept as a salted hash: enough to count what one person has
   posted in the last hour, not enough to be a record of who played. */
async function hashIp(ip, salt) {
  const bytes = new TextEncoder().encode((salt || 'name-the-world') + '|' + (ip || 'unknown'));
  const sum = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(sum)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

const row = r => ({g: r.game, n: r.name, s: r.score, t: r.total, ms: r.ms, at: r.at, id: r.id});

/* What a report is allowed to say.

   It arrives as {g, o, p}: the game, whether this is the run's opening report,
   and the places taken, each as [code, outcome, position]. Everything is
   checked and bounded before it goes near the database - the endpoint is as
   public as the page, and the whole point of counters is that nobody can put
   a row in them that costs anything.

   A place may appear once. Codes are bounded in length and count, positions
   are bounded by the size of the game, and an outcome is one of three letters.
   Anything malformed loses that entry rather than the whole report: a report
   is not worth refusing over one bad row, and a partial count is still true
   about the rows it kept. */
const OUTCOME = {h: 'hit', m: 'miss', t: 'told'};
function cleanBeat(b) {
  if (!b || typeof b !== 'object') return null;
  const game = String(b.g || '');
  const total = GAMES[game];
  if (!total) return null;
  const list = Array.isArray(b.p) ? b.p : [];
  if (!list.length || list.length > total) return null;
  const seen = new Set();
  const picks = [];
  for (const item of list) {
    if (!Array.isArray(item) || item.length !== 3) continue;
    const code = String(item[0] || '');
    const what = OUTCOME[item[1]];
    const posn = Number(item[2]);
    if (!code || code.length > 48 || seen.has(code)) continue;
    if (!what) continue;
    if (!Number.isInteger(posn) || posn < 1 || posn > total) continue;
    seen.add(code);
    picks.push({code, what, posn});
  }
  if (!picks.length) return null;
  return {game, opening: !!b.o, picks};
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    /* Answer at /runs and at /api/runs alike. On its own workers.dev address
       the first is the natural shape; routed under a domain that also serves
       the game - namethe.world/api/* - the second means the page is asking its
       own origin, so the browser has nothing to check and no permission to ask
       for first. Same worker either way. */
    const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (!env.DB) return json({error: 'no D1 database bound as DB'}, 500);

    /* ---- the board ---- */
    if (request.method === 'GET' && path === '/runs') {
      const game = url.searchParams.get('g') || '';
      if (!GAMES[game]) return json([]);

      /* A board changes slowly and is read far more than it is written, so the
         edge answers most of the time and the database sees one query however
         many people are looking. */
      const cache = caches.default;
      const key = new Request(url.origin + '/runs?g=' + encodeURIComponent(game), {method: 'GET'});
      const hit = await cache.match(key);
      if (hit) return hit;

      const {results} = await env.DB.prepare(
        'SELECT id, game, name, score, total, ms, at FROM runs' +
        ' WHERE game = ?1 ORDER BY score DESC, ms ASC, at ASC LIMIT ?2'
      ).bind(game, SHOW).all();

      const res = json((results || []).map(row), 200,
                       {'cache-control': `public, max-age=${CACHE_S}`});
      ctx && ctx.waitUntil(cache.put(key, res.clone()));
      return res;
    }

    /* ---- adding one ---- */
    if (request.method === 'POST' && path === '/runs') {
      let body;
      try { body = await request.json(); } catch (e) { return json({error: 'bad json'}, 400); }
      const run = cleanRun(body);
      if (!run) return json({error: 'bad run'}, 400);

      const ip = await hashIp(request.headers.get('cf-connecting-ip'), env.IP_SALT);
      const since = Date.now() - RATE_WINDOW;
      const recent = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM runs WHERE ip = ?1 AND at > ?2').bind(ip, since).first();
      if (recent && recent.n >= RATE_N)
        return json({error: 'too many runs from here for now'}, 429, {'retry-after': '3600'});

      /* One row per player per game, and only if this run beat the last one -
         so finishing again never pushes anyone else down the board. */
      await env.DB.prepare(
        'INSERT INTO runs (game, name, fold, score, total, ms, at, ip)' +
        ' VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)' +
        ' ON CONFLICT(game, fold) DO UPDATE SET' +
        '   name = excluded.name, score = excluded.score, ms = excluded.ms,' +
        '   at = excluded.at, ip = excluded.ip' +
        ' WHERE excluded.score > runs.score' +
        '    OR (excluded.score = runs.score AND excluded.ms < runs.ms)'
      ).bind(run.game, run.name, run.fold, run.score, run.total, run.ms, run.at, ip).run();

      /* keep the table to the size of the board */
      await env.DB.prepare(
        'DELETE FROM runs WHERE game = ?1 AND id NOT IN' +
        ' (SELECT id FROM runs WHERE game = ?1 ORDER BY score DESC, ms ASC, at ASC LIMIT ?2)'
      ).bind(run.game, KEEP).run();

      const best = await env.DB.prepare(
        'SELECT id, game, name, score, total, ms, at FROM runs WHERE game = ?1 AND fold = ?2'
      ).bind(run.game, run.fold).first();

      /* the board just changed, so the copy at the edge is wrong */
      const cache = caches.default;
      const key = new Request(url.origin + '/runs?g=' + encodeURIComponent(run.game), {method: 'GET'});
      ctx && ctx.waitUntil(cache.delete(key));

      return json({ok: true, run: best ? row(best) : null,
                   kept: !!best && best.ms === run.ms && best.score === run.score});
    }

    /* ---- taking one off ---- */
    if (request.method === 'DELETE' && path.startsWith('/runs/')) {
      const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!env.ADMIN_KEY || given !== env.ADMIN_KEY) return json({error: 'no'}, 401);
      const id = Number(path.slice(6));
      if (!Number.isInteger(id)) return json({error: 'bad id'}, 400);
      const gone = await env.DB.prepare('SELECT game FROM runs WHERE id = ?1').bind(id).first();
      await env.DB.prepare('DELETE FROM runs WHERE id = ?1').bind(id).run();
      if (gone) {
        const cache = caches.default;
        const key = new Request(url.origin + '/runs?g=' + encodeURIComponent(gone.game), {method: 'GET'});
        ctx && ctx.waitUntil(cache.delete(key));
      }
      return json({ok: true, deleted: !!gone});
    }

    /* ---- what people found hard ----

       A report is fire-and-forget: the page sends it with sendBeacon on the way
       out and never learns what happened to it, so this answers quickly and
       says little. Nothing it stores is tied to anyone - the counters go up,
       the sequence that moved them is discarded with the request. */
    if (request.method === 'POST' && path === '/picks') {
      let body;
      try { body = await request.json(); } catch (e) { return json({error: 'bad json'}, 400); }
      const beat = cleanBeat(body);
      if (!beat) return json({error: 'bad report'}, 400);

      const now = Date.now();
      const ip = await hashIp(request.headers.get('cf-connecting-ip'), env.IP_SALT);
      const since = now - RATE_WINDOW;
      const recent = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM beats WHERE ip = ?1 AND at > ?2').bind(ip, since).first();
      if (recent && recent.n >= BEAT_N) return json({ok: true, counted: 0});

      const bump = env.DB.prepare(
        'INSERT INTO picks (game, code, got, hit, miss, told, opens, posn, at)' +
        ' VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, ?7, ?8)' +
        ' ON CONFLICT(game, code) DO UPDATE SET' +
        '   got = got + 1, hit = hit + ?3, miss = miss + ?4, told = told + ?5,' +
        '   opens = opens + ?6, posn = posn + ?7, at = ?8');
      const work = beat.picks.map(p => bump.bind(
        beat.game, p.code,
        p.what === 'hit' ? 1 : 0, p.what === 'miss' ? 1 : 0, p.what === 'told' ? 1 : 0,
        p.posn === 1 ? 1 : 0, p.posn, now));

      /* Only the first report of a run counts as a run. The ones that follow
         carry what was named since, so the places they name are new but the
         run they belong to is not. */
      if (beat.opening) work.push(env.DB.prepare(
        'INSERT INTO games (game, runs, at) VALUES (?1, 1, ?2)' +
        ' ON CONFLICT(game) DO UPDATE SET runs = runs + 1, at = ?2').bind(beat.game, now));

      work.push(env.DB.prepare('INSERT INTO beats (ip, at) VALUES (?1, ?2)').bind(ip, now));
      work.push(env.DB.prepare('DELETE FROM beats WHERE at < ?1').bind(since));
      await env.DB.batch(work);
      return json({ok: true, counted: beat.picks.length});
    }

    /* ---- and the reading of it ----

       Behind the admin key. The counters say nothing about any one person, but
       they are the game's answer sheet: which places are missed, and in what
       order everybody walks the map. Published, they would be a guide to
       playing it, and the sort of thing that is more fun to find out. */
    if (request.method === 'GET' && path === '/picks') {
      const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!env.ADMIN_KEY || given !== env.ADMIN_KEY) return json({error: 'no'}, 401);
      const game = url.searchParams.get('g') || '';
      if (!GAMES[game]) return json({error: 'no such game', games: Object.keys(GAMES)}, 400);

      const tally = await env.DB.prepare(
        'SELECT runs, at FROM games WHERE game = ?1').bind(game).first();
      const {results} = await env.DB.prepare(
        'SELECT code, got, hit, miss, told, opens, posn FROM picks' +
        ' WHERE game = ?1 ORDER BY got DESC').bind(game).all();

      return json({
        game, total: GAMES[game],
        runs: tally ? tally.runs : 0,
        at: tally ? tally.at : 0,
        picks: (results || []).map(p => ({
          code: p.code, got: p.got, hit: p.hit, miss: p.miss, told: p.told,
          opens: p.opens,
          /* the average place in the order, to one decimal - the sum on its own
             means nothing without the count it was summed over */
          mean: p.got ? Math.round(10 * p.posn / p.got) / 10 : 0
        }))
      }, 200, {'cache-control': 'no-store'});
    }

    return json({error: 'not found'}, 404);
  }
};
