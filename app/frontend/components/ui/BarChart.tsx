import { useState } from 'react'

export type Bar = {
  /** Full name of the bar, for the tooltip and screen readers: "Mon 5 Oct". */
  label: string
  /** What goes under the bar when there is room: "5". */
  short: string
  value: number
  /** Extra lines for the tooltip, e.g. "3 orders". */
  details?: string[]
}

type Props = {
  /** What the chart shows, in a sentence. Read out by screen readers. */
  title: string
  bars: Bar[]
  /** Turns a value into text: formatMoney for pesewas, String for counts. */
  format: (value: number) => string
  /** The heading of the value column in the table for screen readers. */
  valueLabel: string
}

// One series of columns over time. Built from plain divs and CSS, with no
// chart library: a bar is a div whose height is a percentage.
//
// What makes it more than decoration:
//   - every bar shows its exact figure on hover, tap or keyboard focus
//   - the scale is stated (the top line is labelled with its value)
//   - the same numbers are in a real <table> for screen readers
//   - one colour, because there is one thing being measured
export default function BarChart({ title, bars, format, valueLabel }: Props) {
  const [active, setActive] = useState<number | null>(null)

  const max = Math.max(...bars.map((bar) => bar.value), 0)
  // Label every bar when there are few; every 2nd, 5th... when there are many.
  const every = Math.ceil(bars.length / 8)

  if (max === 0) {
    return <p className="py-10 text-center text-taupe-700">Nothing sold in this period.</p>
  }

  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>

      {/* aria-hidden: screen readers get the table below, not 30 divs. */}
      <div aria-hidden="true">
        <p className="border-b border-dashed border-taupe-300 pb-1 text-xs text-taupe-600 tabular-nums">{format(max)}</p>
        <div className="flex h-44 items-end gap-0.5 border-b border-taupe-400 pt-1 sm:gap-1">
          {bars.map((bar, index) => (
            <div
              key={bar.label}
              className="relative flex h-full min-w-0 flex-1 cursor-default items-end"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              // A tap on a phone shows the same tooltip a mouse would.
              onClick={() => setActive(active === index ? null : index)}
            >
              <div
                className={`w-full rounded-t ${active === index ? 'bg-wine-900' : 'bg-wine-700'}`}
                // At least 2px when there is any value, so a small day is
                // still visible beside a big one.
                style={{ height: bar.value === 0 ? 0 : `max(2px, ${(bar.value / max) * 100}%)` }}
              />
              {active === index && (
                <div
                  // Pinned to the left, middle or right of the bar so it
                  // never hangs off the edge of the chart.
                  className={`pointer-events-none absolute bottom-full z-10 mb-1 w-max max-w-48 rounded-md bg-ink px-3 py-2 text-sm text-taupe-50 shadow-lg ${
                    index < bars.length / 3 ? 'left-0' : index >= (bars.length * 2) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  <span className="block text-taupe-200">{bar.label}</span>
                  <span className="block font-semibold tabular-nums">{format(bar.value)}</span>
                  {bar.details?.map((line) => (
                    <span key={line} className="block tabular-nums">
                      {line}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-0.5 overflow-hidden text-xs text-taupe-600 sm:gap-1">
          {bars.map((bar, index) => (
            <span key={bar.label} className="w-0 flex-1 overflow-visible text-center whitespace-nowrap">
              {index % every === 0 ? bar.short : ''}
            </span>
          ))}
        </div>
      </div>

      {/* The wrapper is what hides it: a <table> itself refuses to be
          squeezed to 1px, and would widen the page on a phone. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.label}>
                <th scope="row">{bar.label}</th>
                <td>
                  {format(bar.value)}
                  {bar.details?.length ? `, ${bar.details.join(', ')}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
