# Lesson 28: "orange 3xl", search by size and colour

Searches used to look only at the product's name. Now every search box that
finds stock understands sizes and colours, in any order:

```
orange 3xl     3xl orange     kaftan orange 3xl     maxi 3
```

## The rule

Split what was typed into words. **Every** word must be found somewhere in
the variant: the product's name, one of its choices (size, colour, length)
or its SKU. Each match scores points, and the best match comes first:

| The word is... | Points |
| --- | --- |
| exactly one of the variant's choices ("3xl" = 3XL) | 4 |
| exactly a word of the product name ("kaftan") | 3 |
| the start of a choice or of a name word ("3" for 3XL, "maxi" for Maxi) | 2 |
| somewhere in the SKU | 1 |
| nowhere | the variant doesn't match at all |

Words are matched from their **start**, so "xl" finds XL but not 3XL or
XXL. Matching anywhere inside ("contains") would make "xl" find all three
and "m" find every product with an m in it.

## Two copies of one rule

- `app/frontend/lib/search.ts` for searches done in the browser: the
  purchase form, the sale screen, the stock take. Their product lists are
  already on the page, so filtering there is instant.
- `app/models/variant_search.rb` for the stock page, which searches on the
  server.

Same rule, two languages. Each file says where its twin is, and both have
tests. When a rule has to exist on both sides, writing it as a small
scoring table, as above, makes the two easy to keep in step.

Why not do it in SQL? Per-word scoring, with "every word must match", is
awkward in SQL and the whole active catalogue is a few hundred rows that
the stock page loads anyway. When that stops being true (tens of thousands
of variants), Postgres full-text search is the next step.

## Where it is used

- **Stock page.** The best match comes first with its "update stock" form
  already open on "Found more": type the search, type the number, save. The
  slider button on any other matched row opens its own form. After saving
  you stay on the same search (`back: "list"` tells
  `Stock::AdjustmentsController` where to return).
- **Purchase form.** "black l" shows "Ankara wrap dress, Add L / Black";
  tapping it adds the product with 1 of that variant already filled in. If
  the product is already on the purchase, it adds one more instead.
- **Record a sale / live screen.** The top product opens by itself with the
  sizes it pointed at outlined.
- **Stock take.** The list narrows to just the matching sizes and colours.

## A reusable form, pulled out

The "correct the count" form lived inside the item's page. To use it on
the stock list too it became `components/StockAdjustForm.tsx`, used in both
places. Pulling it out first, then using it twice, is how a component stays
the one place that behaviour is defined.
