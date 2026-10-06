import { Link } from '@inertiajs/react'

export type BarRow = {
  key: string | number
  label: string
  value: number
  /** A quieter note after the label, e.g. "4 sold". */
  note?: string
  href?: string
}

type Props = {
  rows: BarRow[]
  format: (value: number) => string
  /** Shown when there are no rows. */
  empty: string
}

// A ranked list where each row carries a bar showing its share of the
// biggest. For "which of these is largest?" this beats a pie chart: the
// names are readable, the bars share one baseline, and the exact figure
// is printed on every row.
export default function BarList({ rows, format, empty }: Props) {
  if (rows.length === 0) return <p className="text-taupe-700">{empty}</p>

  const max = Math.max(...rows.map((row) => row.value), 1)

  return (
    <ol className="space-y-3">
      {rows.map((row) => {
        const name = row.href ? (
          <Link href={row.href} className="font-medium hover:text-wine-800 hover:underline">
            {row.label}
          </Link>
        ) : (
          <span className="font-medium">{row.label}</span>
        )

        return (
          <li key={row.key}>
            <div className="flex items-baseline gap-3">
              <span className="min-w-0 flex-1 truncate">
                {name}
                {row.note && <span className="text-sm text-taupe-600"> {row.note}</span>}
              </span>
              <span className="font-semibold tabular-nums">{format(row.value)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-taupe-100" aria-hidden="true">
              <div className="h-full rounded-full bg-wine-700" style={{ width: `${Math.max((row.value / max) * 100, 1)}%` }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
