# 45. The colour grid

## What changed

Everywhere a colour can be set, tapping the colour square opens a **grid of
ready-made colours**: Black, Cream, Nude, Mustard, Wine, Emerald, and so on.
On a phone it opens along the bottom of the screen; on a computer, under the
square. The shop's own colours come first ("Your colours"), then the rest.
"Another colour…" at the bottom still opens the full colour picker, and the
hex box still takes a pasted code.

It is in all three places a colour is added:

| Where | Before | Now |
|---|---|---|
| Settings → Options → a colour list | picker and hex only | grid; a typed name the grid knows ("Peach") gets its colour straight away |
| Product form, "Not in the list?" | no colour at all (new colours had no dot) | grid beside the box; "army green" gets Olive's colour |
| Purchase form, "+ Add a colour" | picker, hex, used colours | grid; tapping one with the name empty fills the name in too |

## The pieces

- `lib/colours.ts`: the list of grid colours (`PALETTE`), each with a name, a
  hex code and other names it goes by (`also`: "burgundy" is Wine).
  `paletteHex("army green")` finds a colour by name. **To change the grid, edit
  this one list.**
- `components/ui/ColourField.tsx`: the field every colour box uses. The grid
  was added here, so every form that already used the field got it at once.

## Ideas worth knowing

**Fix it in the shared component, not in each page.** Two of the three places
already used `ColourField`. Putting the grid inside it gave both the grid
without touching them; the third place (the product form) just started using
the field. One component, one behaviour, everywhere.

**Optional callbacks keep a component reusable.** The grid knows a colour's
*name* as well as its code. Some forms want the name ("fill in the name box if
it's empty"), others don't. So the field takes an optional `onPickName`. Forms
that don't pass it are unaffected.

**Closing a popup on an outside tap.** While the grid is open, a
`pointerdown` listener on the window checks whether the tap landed inside the
field (`box.contains(target)`); if not, it closes. The listener is added only
while open and removed in the effect's clean-up, so closed fields cost nothing.

**One element, two layouts.** The same `div` is `fixed` along the bottom on a
phone and `sm:absolute` under the square on larger screens. Tailwind's `sm:`
prefix switches the positioning at 640px.

**Choosing a readable tick.** The tick on the chosen colour is dark on light
colours and white on dark ones. Brightness is estimated from red, green and
blue weighted by how bright each looks to the eye (0.299, 0.587, 0.114).
