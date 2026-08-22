/* Name the World - the leaderboard's other half.

   The game is a single page served as static files, which is why it works with
   no connection and why it cannot, on its own, hold a board everyone shares:
   there is nowhere for a run written by one player to be read by another. This
   is that somewhere. It is a Cloudflare Worker with one KV namespace behind it,
   it does two things, and it is free at any scale this game will reach.

       GET  /runs?g=world/all   -> the best runs at that game, best first
       POST /runs               -> add one, as {g, n, s, t, ms}

   See the README for putting it up. Once it is up, set BOARD_URL in index.html
   to the address it answers on and the board is shared from then on.

   What it will not do: believe the client about anything it does not have to.
   Scores arrive from a page anyone can open and edit, so they are checked for
   shape and sanity here as well - a run cannot claim more right than there were
   to name, or a time no human played. None of that makes a determined faker
   honest; it keeps ordinary nonsense off the board. */

const GAMES = {                      // how many there are to name in each game
  'continents/all': 7,   'world/all': 200,    'capitals/all': 198,
  'flags/all': 199,      'counties/all': 48,  'boroughs/all': 33,
  'states/all': 50
};
const KEEP = 100;                    // runs kept per game
const MIN_MS_EACH = 400;             // nobody names a country in under this
const MAX_MS = 24 * 3600 * 1000;

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400'
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, 'content-type': 'application/json'}});

/* Names are shown to other players, so they are cut back to something plain:
   no control characters, no runs of whitespace, nothing long enough to break
   the layout. The page escapes them again when it draws them. */
function cleanName(v) {
  const s = String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
  return s || 'Anonymous';
}

function cleanRun(r) {
  if (!r || typeof r !== 'object') return null;
  const g = String(r.g || '');
  const total = GAMES[g];
  if (!total) return null;                            // a game we do not know
  const s = Number(r.s), ms = Number(r.ms), t = Number(r.t);
  if (!Number.isFinite(s) || !Number.isFinite(ms) || !Number.isFinite(t)) return null;
  if (t !== total) return null;                       // not the game it claims
  if (s < 0 || s > total) return null;
  if (ms < s * MIN_MS_EACH || ms > MAX_MS) return null;
  return {g, n: cleanName(r.n), s: Math.round(s), t: total, ms: Math.round(ms), at: Date.now()};
}

const byRank = (a, b) => b.s - a.s || a.ms - b.ms || a.at - b.at;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (url.pathname !== '/runs') return json({error: 'not found'}, 404);
    if (!env.BOARD) return json({error: 'no KV namespace bound as BOARD'}, 500);

    if (request.method === 'GET') {
      const g = url.searchParams.get('g') || '';
      if (!GAMES[g]) return json([]);
      const runs = JSON.parse((await env.BOARD.get('g:' + g)) || '[]');
      return json(runs);
    }

    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({error: 'bad json'}, 400); }
      const run = cleanRun(body);
      if (!run) return json({error: 'bad run'}, 400);

      /* One player finishing twice at once would otherwise read the same list
         twice and one of the two writes would be lost. KV has no transaction,
         so this narrows the window rather than closing it - which for a board
         of best runs is the right trade against the cost of a durable object. */
      const key = 'g:' + run.g;
      const runs = JSON.parse((await env.BOARD.get(key)) || '[]');
      runs.push(run);
      runs.sort(byRank);
      await env.BOARD.put(key, JSON.stringify(runs.slice(0, KEEP)));
      return json({ok: true, run});
    }

    return json({error: 'method not allowed'}, 405);
  }
};
