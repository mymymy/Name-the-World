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

## Hosting

Any static host will serve it. For GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.
