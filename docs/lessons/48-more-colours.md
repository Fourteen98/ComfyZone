# 48. More colours: a bigger grid, and every colour by name

## What changed

- **The grid** grew from 38 to about 100 colours picked for clothes, in
  families: whites and neutrals, greys and blacks, browns, yellows and golds,
  oranges, reds, pinks, purples, blues, greens, metallics and prints.
  ("Dusty rose", "Champagne", "Bottle green", "Rose gold", "Leopard".)
- **Search** at the top of the grid: type "sage", "terracotta", "teal" and
  pick from the matches, out of about 32,000 named colours.
- **Typed names get their colour.** In Settings → Options, the product form
  and "Add a colour" on a purchase, a name like "pumpkin spice" gets its real
  colour instead of grey (if no colour of that exact name exists, it stays
  grey to be picked by hand).

## The library

[`color-name-list`](https://github.com/meodai/color-names) (MIT licence),
pinned to 14.77.0 in `package.json`. A long list of `{ name, hex }`. It has
a smaller "best of" edition, but that one is missing everyday clothing words
(navy, wine, burgundy, nude), so the full list is used, for searching only.
The grid stays hand-picked: 32,000 swatches are a list to search, not to tap.

After pulling: `npm install` (the server's build runs `npm ci` from
`package-lock.json`, so it picks it up by itself).

## Ideas worth knowing

**Lazy loading with `import()`.** The list is about 1.1 MB (325 KB
compressed): too much to make every page load. `import('color-name-list')`
written inside a function (not at the top of the file) tells Vite to put it
in a separate file, downloaded only the first time that function runs. After
that the browser has it. The build output shows it as its own
`colornames.esm-….js` while the main app bundle stays the same size.

**Load once, share the promise.** `loadEverything()` keeps the *promise*
(`everything ??= import(...)`), not the list. Ten searches typed before the
download finishes all wait on the same download instead of starting ten. If
it fails (no signal), the promise is forgotten so the next search tries again.

**Ranking matches.** Exact name first, then names starting with what she
typed, then names with a word starting with it, then anything containing it;
within each, shorter names first ("Teal" before "Teal Moiré Mystery"). The
shop's own grid colours always come first.

**Updating after an async answer, safely.** A typed "terracotta" is added at
once (grey), then its colour arrives a moment later. By then she may have
added more or changed things, so the code reads the list as it is *now*
(`latest.current`, a ref updated on every render) and only replaces the grey
if it is still grey, never undoing something she chose.

**Debouncing.** The search and the "colour for what's typed" wait 200–300 ms
after the last key before looking, so typing "terracotta" does one search, not ten.
