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
board keyed to that run has to live somewhere both you and everyone else can
reach, which a page served as static files cannot do on its own — there is
nowhere for a run written by one player to be read by another.

Until that somewhere exists the game keeps your runs on your own device and the
board says so, in as many words, rather than pretending to be a shared board
with one player on it.

**`server/leaderboard.js`** is that somewhere: a Cloudflare Worker over one KV
namespace, two endpoints, free at any scale this game will reach. To put it up:

```sh
cd server
npx wrangler kv namespace create BOARD   # paste the id it prints into wrangler.toml
npx wrangler deploy                      # prints the address it answers on
```

Then set `BOARD_URL` in `index.html` to that address — it is a single line near
the top of the leaderboard section — and the board is shared from then on. No
other change is needed; the page already falls back to the device when the
server is unreachable, so it still works on a train.

The worker re-checks every run it is given: a page anyone can open is a page
anyone can edit, so a run cannot claim more right than there were to name, a
total that is not that game's, or a time no human played. Names are stripped of
control characters and cut to 24. None of that stops a determined faker — it
keeps ordinary nonsense off the board.

## Hosting

Any static host will serve it. For GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.
