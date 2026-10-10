# 31. Choosing a variant step by step

## The problem

When an order was being recorded and a product was opened, every variant showed up as
a button: L / Wine, XL / Black, XL / Wine... even the ones with nothing left. A
dress in 3 colours and 5 sizes is 15 buttons, and half of them were dead ends.

## What it does now

`app/frontend/components/VariantChooser.tsx` asks one question at a time, using
**only what is in stock**:

```
Colour:  ● Black 8   ● Wine 2        <- only colours with any left
Size · tap to add:   M 6   L 2       <- only sizes left in Black
Sold out: ⌛ L / Wine  ⌛ XL / Black   <- one quiet line
```

- **Colour comes first** because that is what buyers say first on a live. The code
  doesn't hard-code "Colour": any option whose values have swatches goes first
  (`optionOrder`), and the rest follow in the product's own order.
- **Tapping the last question adds the item.** The colour stays chosen, so a second
  size in Black is one more tap.
- **Sold-out combinations are not buttons.** They are listed once at the bottom. On
  the live screen and Record a sale, tapping one puts the buyer on the waiting list
  for it (lesson 29).
- **Search still jumps ahead.** Typing "orange 3xl" shows that exact variant as a
  ready "+ add" button on top.

## Two ideas worth knowing

**1. Narrowing down a list (`possibleAt`).** Each step filters the in-stock variants
by the choices made *before* it:

```ts
const possibleAt = (i) => inStock.filter((v) => names.slice(0, i).every((n) => valueOf(v, n) === chosen[n]))
```

Step 0 sees every in-stock variant. Step 1 sees only the Black ones, and so on. The
buttons for each step are just the distinct values in that filtered list.

**2. Derived state instead of "fixing" state.** If she adds the last two Wine
dresses, Wine has nothing left. The saved choice `picks` still says "Wine", but we
never trust it blindly. On each render we work out `chosen`, which keeps a pick only
if it is still possible, and stop at the first one that isn't. There's no
`useEffect` to "clean up", and nothing can get out of sync. This rule is useful
everywhere in React: **store what the person did, and work out the rest.**
