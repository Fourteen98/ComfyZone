import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '@/lib/format'

export type SalesPoint = {
  label: string // "Tue 6 Oct"
  short: string // "6"
  orders: number
  sales_pesewas: number
  profit_pesewas?: number // absent for people who may not see costs
  previous_sales_pesewas: number // the same day of the period before
}

type Mode = 'daily' | 'running'

// How sales moved, in one chart that answers three questions at once:
//
//   How much each day?          the bar's full height
//   How much of it was profit?  the dark top of the bar (the light bottom
//                               is what the goods cost her)
//   Better than last time?      the dashed line: the period before, day 1
//                               against day 1
//
// "Running total" turns it into a race: this period's total so far against
// the last one's, day by day. One axis only (always cedis), so the two
// lines can be compared honestly.
//
// Drawn as SVG by hand (no chart library): the page stays small, and every
// mark is ours to label. Hover, tap or keyboard shows every number for that
// day; the same numbers are in the table under "Show as a table".
export default function SalesChart({ points, previousLabel }: { points: SalesPoint[]; previousLabel: string }) {
  const [mode, setMode] = useState<Mode>('daily')
  const [active, setActive] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)

  const showsProfit = points.some((point) => point.profit_pesewas !== undefined)
  const running = mode === 'running'

  // Running totals, worked out once.
  const totals = points.reduce<{ now: number[]; before: number[] }>(
    (sum, point, i) => {
      sum.now.push((sum.now[i - 1] ?? 0) + point.sales_pesewas)
      sum.before.push((sum.before[i - 1] ?? 0) + point.previous_sales_pesewas)
      return sum
    },
    { now: [], before: [] },
  )
  const current = (i: number) => (running ? totals.now[i] : points[i].sales_pesewas)
  const previous = (i: number) => (running ? totals.before[i] : points[i].previous_sales_pesewas)

  // ---- geometry ----
  const height = 260
  const pad = { top: 12, right: 8, bottom: 28, left: 56 }
  const plotW = Math.max(width - pad.left - pad.right, 10)
  const plotH = height - pad.top - pad.bottom
  const top = niceMax(Math.max(...points.map((_, i) => Math.max(current(i), previous(i))), 1))
  const y = (value: number) => pad.top + plotH - (Math.max(value, 0) / top) * plotH
  const band = plotW / points.length
  const barW = Math.max(Math.min(band * 0.68, 36), 2)
  const x = (i: number) => pad.left + band * i + band / 2 // centre of day i
  const every = Math.ceil(points.length / Math.max(Math.floor(plotW / 44), 1)) // x labels that fit
  const ticks = [0, top / 3, (top * 2) / 3, top]

  const line = (values: (i: number) => number) =>
    points.map((_, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(values(i)).toFixed(1)}`).join(' ')
  const hasPrevious = points.some((point) => point.previous_sales_pesewas > 0)

  // A short story under the chart: the best day, and how this period compares.
  const best = points.reduce((winner, point, i) => (point.sales_pesewas > points[winner].sales_pesewas ? i : winner), 0)
  const quiet = points.filter((point) => point.orders === 0).length
  const sum = totals.now[points.length - 1] ?? 0
  const sumBefore = totals.before[points.length - 1] ?? 0

  if (sum === 0 && sumBefore === 0) return <p className="py-10 text-center text-taupe-700">Nothing sold in this period.</p>

  const point = active === null ? null : points[active]

  return (
    <div>
      {/* Which view, and what the marks mean. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div role="group" aria-label="Show" className="flex gap-1 rounded-full bg-taupe-100 p-1">
          {(
            [
              ['daily', 'Each day'],
              ['running', 'Running total'],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
              className={`min-h-9 rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-wine-700 ${
                mode === key ? 'bg-white text-wine-800 shadow-sm' : 'text-taupe-700 hover:text-wine-800'
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-taupe-700">
          {running ? (
            <li className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-wine-700" aria-hidden="true" />
              This period
            </li>
          ) : showsProfit ? (
            <>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-wine-700" aria-hidden="true" />
                Profit
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-taupe-300" aria-hidden="true" />
                What the goods cost
              </li>
            </>
          ) : null}
          {hasPrevious && (
            <li className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-taupe-500" aria-hidden="true" />
              {previousLabel}
            </li>
          )}
        </ul>
      </div>

      {/* The chart. Touch and mouse both move the readout; arrow keys too. */}
      <div ref={box} className="relative mt-4 select-none" onPointerLeave={() => setActive(null)}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Sales ${running ? 'running total' : 'by day'}, with ${previousLabel.toLowerCase()} dashed`}
          >
            {/* Recessive grid: three hairlines, labelled on the left. */}
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className="stroke-taupe-200"
                  strokeDasharray={tick ? '2 4' : undefined}
                />
                <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-taupe-500 text-[11px] tabular-nums">
                  {compactMoney(tick)}
                </text>
              </g>
            ))}

            {/* Each day: a bar (cost below, profit on top, 2px gap between), or
                in running mode an area under this period's line. */}
            {running ? (
              <>
                <path
                  d={`${line((i) => totals.now[i])} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
                  className="fill-wine-700/10"
                />
                <path d={line((i) => totals.now[i])} fill="none" className="stroke-wine-700" strokeWidth={2} strokeLinejoin="round" />
              </>
            ) : (
              points.map((p, i) => {
                const left = x(i) - barW / 2
                const total = p.sales_pesewas
                if (total <= 0) return null
                const profit = showsProfit ? Math.max(Math.min(p.profit_pesewas ?? 0, total), 0) : total
                const cost = total - profit
                const dim = active !== null && active !== i
                return (
                  <g key={i} opacity={dim ? 0.7 : 1}>
                    {cost > 0 && (
                      <path d={roundedTop(left, y(cost), barW, y(0) - y(cost), profit > 0 ? 0 : 3)} className="fill-taupe-300" />
                    )}
                    {profit > 0 && (
                      <path
                        d={roundedTop(left, y(total), barW, Math.max(y(cost) - y(total) - (cost > 0 ? 2 : 0), 1), 3)}
                        className="fill-wine-700"
                      />
                    )}
                  </g>
                )
              })
            )}

            {/* The period before, dashed, on the same scale. */}
            {hasPrevious && (
              <path
                d={line(previous)}
                fill="none"
                className="stroke-taupe-500"
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinejoin="round"
              />
            )}

            {/* The day being read: a hairline, and dots where the lines cross it. */}
            {active !== null && (
              <g>
                <line x1={x(active)} x2={x(active)} y1={pad.top} y2={y(0)} className="stroke-taupe-400" />
                {running && (
                  <circle cx={x(active)} cy={y(totals.now[active])} r={4.5} className="fill-wine-700 stroke-white" strokeWidth={2} />
                )}
                {hasPrevious && (
                  <circle cx={x(active)} cy={y(previous(active))} r={4} className="fill-white stroke-taupe-500" strokeWidth={2} />
                )}
              </g>
            )}

            {/* Day labels along the bottom, as many as fit. */}
            {points.map((p, i) =>
              i % every === 0 ? (
                <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-taupe-600 text-[11px] tabular-nums">
                  {p.short}
                </text>
              ) : null,
            )}
          </svg>
        )}

        {/* Hit areas: one per day, the full height, wider than any mark. */}
        <div className="absolute inset-y-0 flex" style={{ left: pad.left, width: plotW }}>
          {points.map((p, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${p.label}: ${formatMoney(current(i))}${running ? ' so far' : ''}`}
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onKeyDown={(e) => {
                const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                if (step) {
                  e.preventDefault()
                  const next = Math.min(Math.max(i + step, 0), points.length - 1)
                  ;(e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus()
                }
              }}
              className="h-full flex-1 cursor-crosshair focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
            />
          ))}
        </div>

        {/* The readout: every number for the day, values first. */}
        {point && active !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-56 rounded-lg bg-ink px-3 py-2.5 text-sm text-taupe-50 shadow-lg"
            // Beside the hairline, never on top of the bar being read: to its
            // right on the left half of the chart, to its left on the right half.
            style={
              x(active) < width / 2 ? { left: Math.min(x(active) + 12, Math.max(width - 224, 0)) } : { left: Math.max(x(active) - 236, 0) }
            }
          >
            <p className="text-xs text-taupe-300">{point.label}</p>
            {running ? (
              <>
                <Row value={formatMoney(totals.now[active])} label="so far" swatch="bg-wine-300" />
                {hasPrevious && <Row value={formatMoney(totals.before[active])} label="last time, same day" dashed />}
                {hasPrevious && totals.before[active] > 0 && (
                  <p className="mt-1 text-xs text-taupe-300">{ahead(totals.now[active], totals.before[active])}</p>
                )}
              </>
            ) : (
              <>
                <Row
                  value={formatMoney(point.sales_pesewas)}
                  label={point.orders === 1 ? 'sales, 1 order' : `sales, ${point.orders} orders`}
                />
                {point.profit_pesewas !== undefined && point.sales_pesewas > 0 && (
                  <>
                    <Row value={formatMoney(point.profit_pesewas)} label="profit" swatch="bg-wine-300" />
                    <Row value={formatMoney(point.sales_pesewas - point.profit_pesewas)} label="goods cost" swatch="bg-taupe-300" />
                  </>
                )}
                {hasPrevious && <Row value={formatMoney(point.previous_sales_pesewas)} label="same day last time" dashed />}
              </>
            )}
          </div>
        )}
      </div>

      {/* The story in words, for everyone, before anyone hovers. */}
      <p className="mt-3 text-sm text-taupe-700">
        {points[best].sales_pesewas > 0 && (
          <>
            Best day: <strong className="font-semibold text-ink">{points[best].label}</strong>, {formatMoney(points[best].sales_pesewas)}
            .{' '}
          </>
        )}
        {quiet > 0 && points.length > 1 && <>{quiet === 1 ? '1 day' : `${quiet} days`} with no sales. </>}
        {hasPrevious && sumBefore > 0 && <>{ahead(sum, sumBefore, true)}</>}
      </p>

      <details className="mt-2">
        <summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-medium text-wine-800">Show as a table</summary>
        <div className="mt-2 max-h-80 overflow-auto rounded-md border border-taupe-200">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-taupe-50 text-left text-taupe-700">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Day
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Orders
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Sales
                </th>
                {showsProfit && (
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Profit
                  </th>
                )}
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Last time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-taupe-100">
              {points.map((p, i) => (
                <tr key={i}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    {p.label}
                  </th>
                  <td className="px-3 py-1.5 text-right">{p.orders}</td>
                  <td className="px-3 py-1.5 text-right">{formatMoney(p.sales_pesewas)}</td>
                  {showsProfit && <td className="px-3 py-1.5 text-right">{formatMoney(p.profit_pesewas ?? 0)}</td>}
                  <td className="px-3 py-1.5 text-right text-taupe-600">{formatMoney(p.previous_sales_pesewas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function Row({ value, label, swatch, dashed }: { value: string; label: string; swatch?: string; dashed?: boolean }) {
  return (
    <p className="mt-1 flex items-center gap-2">
      {dashed ? (
        <span className="w-3 border-t-2 border-dashed border-taupe-300" aria-hidden="true" />
      ) : swatch ? (
        <span className={`h-0.5 w-3 rounded ${swatch}`} aria-hidden="true" />
      ) : null}
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-taupe-300">{label}</span>
    </p>
  )
}

// "12% ahead of last time" / "8% behind".
function ahead(now: number, before: number, sentence = false): string {
  const percent = Math.round(((now - before) / before) * 100)
  if (percent === 0) return sentence ? 'Level with the period before.' : 'level with last time'
  const words = `${Math.abs(percent)}% ${percent > 0 ? 'ahead of' : 'behind'} ${sentence ? 'the period before' : 'last time'}`
  return sentence ? `${words.charAt(0).toUpperCase()}${words.slice(1)}.` : words
}

// GH₵ 1.5k for the axis, where space is tight. Full amounts are in the readout.
function compactMoney(pesewas: number): string {
  const cedis = pesewas / 100
  if (cedis >= 1000) return `GH₵ ${(cedis / 1000).toFixed(cedis >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`
  return `GH₵ ${Math.round(cedis)}`
}

// A round number just above the top value, so the gridlines land on 0, 1/3,
// 2/3 and that: e.g. 1,875 -> 2,100 (700 a step).
function niceMax(value: number): number {
  const step = value / 3
  const power = 10 ** Math.floor(Math.log10(step))
  const nice = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10].map((n) => n * power).find((n) => n >= step) ?? step
  return nice * 3
}

// A bar with its top corners rounded (the data end); the baseline stays square.
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h)
  return `M${x},${y + h} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h} Z`
}

// The width of an element, kept up to date as the screen turns or resizes.
function useWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
