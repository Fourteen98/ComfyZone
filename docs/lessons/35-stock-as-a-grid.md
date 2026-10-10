# 35. Stock as folding cards and a size × colour grid

## The problem

A product in 6 sizes and 10 colours is 60 variants. Listed one per row, the
palazzo alone was a page and a half, mostly rows saying "0, Out". On a phone it
was worse.

## What it does now (`Stock/Index.tsx` + `components/StockGrid.tsx`)

**In "Everything", each product is a folded card.** The header says what matters
at a glance: *8 here, sells for GH₵ 1,760*, plus *7 low* and *53 out*. Tap to open,
or use "Open all" / "Fold all". Which cards are open is remembered on that phone.

**Open, the card is a grid, not a list:**

```
              M   L   XL  2XL 3XL 4XL
● Black       –   1   –   –   –   –
● Orange      –   –   1   –   2   1
```

- Colour goes down the side (the option with swatches) and size goes across.
- A dash is out of stock. Amber is running low. Every number opens that item's
  page, where she can see its history or correct the count.
- On a phone, long colour names are shortened, and the colour column stays put
  if the table scrolls sideways.
- A product with only one choice that varies (just colours) shows tiles:
  `● Black 8`.
- Options that are the same for every item ("One size", "Maxi") are said once in
  the header instead of on every row.

**Search and the filtered tabs keep the row list.** "Orange 3xl", Running low,
Out of stock and No cost yet are already short lists, and search opens the quick
"add stock" form on the best match, as before.

The "If it all sells" card is now one line (the total and its profit). Tap it for
the bulk-price row and the small print.

## Ideas worth knowing

**Choosing rows and columns from the data.** `varyingOptions` keeps only the
options with more than one value. Two options make a table, one makes tiles, and
none makes a single tile. Nothing is hard-coded to "Size" or "Colour", so a product
with lengths and fabrics works too.

**CSS columns for uneven cards.** A two-column *grid* lines cards up in rows, so a
tall open card leaves a hole beside its short neighbour. CSS `columns-2` flows
cards down each column like a newspaper instead, with no holes.
`break-inside-avoid` stops a card being split across the two columns.

**Remembering a preference in the browser.** Which cards are open is kept in
`localStorage`, wrapped in `try/catch`: in a private window storage can be
blocked, and then the page simply starts folded.
