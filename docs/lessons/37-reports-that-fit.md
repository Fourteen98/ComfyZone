# 37. Reports that fit

## What was wrong

- Six headline numbers sat in a four-wide grid, which left two empty boxes.
- *Best sellers* and *What makes money* listed the same products twice.
- Panels sat in a rigid grid, so a long one (Top places) left a big hole beside a
  short one (Lives). Empty panels still took up space.
- Lists of ten went on and on.

## What it is now

- **Headline:** two rows of three (three rows of two on a phone). The numbers are
  a size smaller on a phone, so GH₵ 3,861.00 stays on one line.
- **Products, one list:** sold, sales, profit and margin side by side.
  *By sales / By profit* re-ranks it, and the bar follows the ranking. On a phone,
  "15 sold, GH₵ 2,775" goes under the name and the profit stays on the right.
  People who may not see costs get the plain best-sellers list.
- **Everything else flows in columns** (two on a laptop, three on a big screen),
  so nothing leaves a hole. Lives, Expenses and Top customers only appear when
  they have something to show.
- **Where buyers are** holds the regions *and* the top places, in one panel.
- **Long lists show 5** with "Show all 10" (`BarList`'s new `limit`). It never hides
  just one row, because a button to reveal a single line is silly.

## Ideas worth knowing

**One table, two orders.** The server sends each product once (with sales *and*
profit). The page sorts that copy in the browser when she taps *By profit*, so
there's no new request and no wait.

**A grid instead of a `<table>`.** A real table sizes its columns from their
content, so long amounts squeezed the product names. A CSS grid with
`grid-cols-[minmax(0,1fr)_auto]` gives the name all the space that's left and lets
it shorten with "…" only when it truly has to. Wider screens switch to
`sm:grid-cols-[minmax(0,1fr)_4rem_8rem_8rem]` to add the Sold and Sales columns.

**`StatStrip` knows six.** Six boxes are two rows of three. Shared components get
better for every page that uses them: the dashboard benefits too.
