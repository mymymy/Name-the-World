# Name the World

A map naming game. Click a country on the world map and name it.

- **Games:** the whole world, one continent at a time, or name the seven continents
- **Suggestions** on (a list to pick from as you type) or off (the whole name, from
  memory) — off is the harder game, and only spelling is forgiven
- 200 countries in play; small states have dot targets. Scroll or pinch to zoom, drag to pan.

A country's names are written down once. The flags game asks about the same
two hundred places in a different way, so a flag takes its country's name and
every other name that country answers to rather than keeping a copy; only the
code differs, which is what files the two games' answers apart.

Everything — map geometry, styles, logic — is in `index.html`. No build step, no
dependencies. Beside it sit the two things too big to inline: `flags/` and
`fonts/`, the latter holding Faculty Glyphic by Dylan Young (OFL, licence
included), which the whole page is set in — names, headings and all. Both are
served from here rather than fetched from anyone, and the service worker
precaches them with the page.

## lab/

Side experiments, not part of the game.

- **`lab/stitch-atlas.html`** — the world with every vertex snapped to a grid, which
  turns coastlines into something between pixel art and a needlework chart. Controls
  for cell size, centre meridian, scale and palette; saves an SVG. The page also
  explains the technique, including why snapping keeps neighbouring countries welded
  along their shared borders where thinning by index does not. Self-contained: open
  the file anywhere.
- **`lab/ball-pit.html`** — a different guessing game. Balls rain into the window,
  pile up and settle, and once nothing is moving you say how many there are. Every
  ball in a round is the same size, and the size is drawn afresh each time, so the
  pit is never twice the same and counting is the only way through. The piling is a
  small position-based solver: eight substeps a frame, a uniform grid one ball wide
  for finding contacts, and friction and bounce put back into the velocities
  afterwards. The friction between two balls is a rolling number and a low one,
  because these balls do not spin: give them a sliding number instead and they
  stand on one another's crowns rather than rolling off. `?debug` gives the answer
  away. Self-contained: open the file anywhere.

## server/

The leaderboard's other half, and the only part of this that is not the page.

Finishing a game gives you confetti and offers to put your name to the run. The
board that run belongs on has to live somewhere both you and everyone else can
reach, which a page served as static files cannot do on its own — there is
nowhere for a run written by one player to be read by another.

Until that somewhere exists the game keeps your runs on your own device and the
board says so, in as many words, rather than pretending to be a shared board
with one player on it.

**`server/leaderboard.js`** is that somewhere: a Cloudflare Worker over one D1
database — D1 is SQLite — free at any scale this game is likely to reach, and it
stops serving rather than billing you if it is not.

### Putting it up

```sh
cd server
npx wrangler d1 create name-the-world-board     # paste database_id into wrangler.toml
npx wrangler d1 execute name-the-world-board --remote --file=schema.sql
npx wrangler secret put ADMIN_KEY               # any long random string
npx wrangler secret put IP_SALT                 # another one
npx wrangler deploy                             # prints the address it answers on
```

Then set `BOARD_URL` in `index.html` to that address — one line, near the top of
the leaderboard section — and the board is shared from then on. Nothing else
changes: the page already falls back to the device when the server cannot be
reached, so it still works on a train.

### Written for the link getting shared further than intended

- **Reads come from the edge cache**, thirty seconds at a time. A thousand
  people opening the board at once is one query, not a thousand. A new run
  clears the cached copy so it is never stale for longer than it took to post.
- **Writes are rate limited** to twelve an hour per address, because the
  endpoint is as public as the page and posting to it is a five-line script.
  Addresses are stored as a salted hash — enough to count, not enough to be a
  record of who played.
- **One row per player per game**, keeping their best. A board of every attempt
  is mostly one keen person, and it hands anyone who wants to bury the others an
  easy way to do it.
- **Names are screened** for the obvious. It is a screen, not a filter: it
  catches the lazy cases, lets Scunthorpe and Dickinson play, and will miss
  anyone actually trying.
- **You can delete a row**, which is what actually handles the rest:

  ```sh
  curl -X DELETE https://YOUR-WORKER/runs/42 -H "Authorization: Bearer YOUR-ADMIN-KEY"
  ```

  The id is on each row in the board's own JSON: `curl https://YOUR-WORKER/runs?g=world/all`.

What none of it can do is know whether a score is honest. It is worked out on
the player's own machine, so a determined faker can claim anything the rules
allow. The checks keep out nonsense, not cheats.

One ceiling worth knowing: Cloudflare's free plan covers 100,000 worker requests
a day. Past that it stops answering until the next day rather than charging you.
If this game ever gets near it, the paid plan is $5 a month.

## What people find hard

The game knows something no analytics service could tell you: which places get
named first, which get named wrong, and which nobody ever reaches. The same
worker keeps count, and **`admin.html`** reads it back.

Counters, not events. The obvious shape is a row per answer, which for the world
game is two hundred rows a run and grows for ever — and a table of who named
what in which order is a record of a person's session, which is not a thing this
game should hold. So the page sends the run's arithmetic, the worker adds it to
a pile, and the report is discarded with the request. What is left is one row
per place per game: about seven hundred and thirty rows in total, however many
people play. There is no session, no address, and nothing to say two reports
came from the same person.

Three things it deliberately does not count:

- **Anything but a whole game.** A continent or a random ten is a different
  length each time, so a place in the order would not mean the same thing twice.
- **Anywhere but the game's own address.** Previews, forks and copies opened off
  disk all point at the same worker, and none of them are people playing.
- **Answers shown all at once** at the end, which are not places anybody
  reached.

To read it, open `/admin.html` and give it the `ADMIN_KEY`. The page is public;
the numbers behind it are not — they are the game's answer sheet, and more fun
to find out than to be told. `curl` works too:

```sh
curl https://YOUR-WORKER/picks?g=world/all -H "Authorization: Bearer YOUR-ADMIN-KEY"
```

Each place comes back with `got` (runs that reached it), `hit`, `miss`, `told`,
`opens` (runs that started there) and `mean` (its average place in the order).
A place with no row is one nobody has reached at all, which is its own kind of
hard: `got / runs` and `hit / got` are two different questions.

Alongside them, `mix` — what places get called instead, counted per pair. A
wrong answer that was then corrected still counts, and that is most of them:
somebody says Slovakia, sees it marked wrong and puts Slovenia. Reading it off
the answer's final state would show a clean right answer and lose every one.

Each game is two: with the list up and from memory. The mode rides on the end
of the game key (`world/all` and `world/all/hard`), so the runs, the counters
and the confusions all divide along the same line and none of them needed a
column adding.

If the board is already up, the new tables are added by running the schema
again — every statement in it is `IF NOT EXISTS`, so it leaves the runs alone:

```sh
cd server && npx wrangler d1 execute name-the-world-board --remote --file=schema.sql
```

## Hosting

Any static host will serve it. For GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.
