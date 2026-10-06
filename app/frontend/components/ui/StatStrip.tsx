import { Link } from '@inertiajs/react'

type Stat = {
  label: string
  /** Already formatted for display. null = nothing to show yet. */
  value: string | null
  /** A short note under the number. */
  hint?: string
  /** Makes the whole tile a link, e.g. to the list behind the number. */
  href?: string
}

// Tailwind only generates classes it can see written out in full, so the
// column counts are listed here instead of being built from a number.
const columns: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 xl:grid-cols-4',
}

// A row of headline numbers, joined into one band.
// Two per row on phones, all in one row on desktop.
export default function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className={`grid gap-px overflow-hidden rounded-lg border border-taupe-200 bg-taupe-200 ${columns[stats.length] ?? columns[4]}`}>
      {stats.map((stat) => {
        const body = (
          <>
            <dt className="text-sm text-taupe-700">{stat.label}</dt>
            {/* Numbers use the sans font: its digits are all one height and
                width (tabular-nums), so amounts are easy to read and compare.
                The serif's old-style digits suit headings, not money. */}
            <dd className="mt-1 text-3xl font-semibold text-wine-800 tabular-nums">
              {stat.value ?? <span className="text-taupe-300">–</span>}
            </dd>
            {stat.hint && <p className="mt-0.5 text-sm text-taupe-600">{stat.hint}</p>}
          </>
        )

        return stat.href ? (
          <Link
            key={stat.label}
            href={stat.href}
            className="block bg-white px-5 py-4 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
          >
            {body}
          </Link>
        ) : (
          <div key={stat.label} className="bg-white px-5 py-4">
            {body}
          </div>
        )
      })}
    </dl>
  )
}
