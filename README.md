# Name the World

A map naming game. Click a country on the world map and name it.

- **Games:** the whole world, one continent at a time, or name the seven continents
- **Country list** on (filter as you type) or off (type the name from memory)
- **Checking** at the end (default) or as you go
- 200 countries in play; small states have dot targets. Scroll or pinch to zoom, drag to pan.

Everything — map geometry, styles, logic — is in `index.html`. No build step, no dependencies.

## lab/

Side experiments, not part of the game.

- **`lab/stitch-atlas.html`** — the world with every vertex snapped to a grid, which
  turns coastlines into something between pixel art and a needlework chart. Controls
  for cell size, centre meridian, scale and palette; saves an SVG. The page also
  explains the technique, including why snapping keeps neighbouring countries welded
  along their shared borders where thinning by index does not. Self-contained: open
  the file anywhere.

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

## Hosting

Any static host will serve it. For GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.
