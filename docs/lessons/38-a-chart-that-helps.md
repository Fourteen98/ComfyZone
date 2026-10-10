# 38. A chart that helps decide things

## Two panels instead of one plain bar chart

**How sales moved** answers three questions at once:

| You see | It means |
|---|---|
| a bar's full height | that day's sales |
| the dark top of the bar | the **profit** in it |
| the light bottom | what the goods cost you |
| the dashed line | the **period before**, day 1 against day 1 |

- **Each day / Running total:** the running total turns it into a race. Your total
  so far against last time's, day by day: "18% ahead of last time".
- **Hover, tap or arrow keys:** a hairline finds the day, and a readout gives
  sales, orders, profit, cost and the same day last time. It sits *beside* the
  bar, never on top of it.
- **In words:** under the chart, "Best day: Tue 6 Oct, GH₵ 1,875. 19 days with no
  sales. 18% ahead of the period before." It's readable without touching anything.
- **Show as a table:** every number, for checking or copying.

**When people buy** shows orders by **day of the week** and by **hour** (Ghana
time), with the busiest of each named: "Busiest day: Tuesday · Busiest hour: 8pm
to 9pm". Use it to choose when to go live or post. Days of the week only appear
for a week or more, and the hours chart trims the empty night hours.

## Ideas worth knowing

**One axis, always.** Sales and last period's sales are both cedis, so they share
one scale, and the dashed line can be compared with the bars honestly. Two
different measures (say, cedis and orders) on two scales would let the chart say
anything. That's why orders live in the readout, not as a second line.

**Emphasis, not a rainbow.** Profit is the point, so it gets the brand colour, and
cost is the quiet grey under it. Two colours that mean something beat five that
don't.

**Lining up two periods (`previous_sales_pesewas`).** The controller asks
`SalesReport` for the period before (same length, see `ReportPeriod#previous`) and
attaches its day *i* to this period's day *i*. The browser adds up the running
totals itself, so switching views needs no new request.

**SQL does the counting.** `by_weekday` and `by_hour` use Postgres's
`EXTRACT(ISODOW ...)` and `EXTRACT(HOUR ...)` on the order time *converted to Ghana
time* (`LOCAL_TIME`), so an order at 8:30 pm counts as 8 pm here, not UTC.

**Drawn by hand in SVG.** No chart library: a bar with rounded top corners is one
`<path>`, the dashed line is one `<path>` with `stroke-dasharray`, and a
`ResizeObserver` redraws it to fit any screen. Invisible full-height buttons, one
per day, are the hit areas, so a finger doesn't have to land on a thin bar.
