import { Head, Link } from '@inertiajs/react'
import { ArrowLeft, Hourglass, Lightbulb, Snail, TrendingUp } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import Badge from '@/components/ui/Badge'
import BarList from '@/components/ui/BarList'
import Chip from '@/components/ui/Chip'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import { formatMoney } from '@/lib/format'

type Row = {
  variant_id: number
  product_id: number
  product: string
  variant: string
  option_values: { name: string; label: string; swatch?: string | null }[]
  sold: number
  per_week: number
  on_hand: number
  weeks_left: number | null
  waiting: number
  unit_cost_pesewas: number | null
}

type Props = {
  days: number
  cover: number
  windows: number[]
  covers: number[]
  sees_costs: boolean
  buy: (Row & { suggest: number; estimate_pesewas: number | null })[]
  slow: (Row & { tied_pesewas: number | null })[]
  slow_total_pesewas: number | null
  best_options: { option: string; labels: { label: string; units: number }[] }[]
}

// Props from Stock::AdviceController#show (RestockAdvisor).
export default function StockAdvice({ days, cover, windows, covers, sees_costs, buy, slow, slow_total_pesewas, best_options }: Props) {
  const total = buy.reduce((sum, row) => sum + (row.estimate_pesewas ?? 0), 0)
  const units = buy.reduce((sum, row) => sum + row.suggest, 0)

  // Group the buy list by product, keeping the most urgent product first.
  const groups: { id: number; name: string; rows: Props['buy'] }[] = []
  for (const row of buy) {
    let group = groups.find((entry) => entry.id === row.product_id)
    if (!group) groups.push((group = { id: row.product_id, name: row.product, rows: [] }))
    group.rows.push(row)
  }

  const pill = (active: boolean) =>
    `flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium ${
      active ? 'border-wine-800 bg-wine-800 text-white' : 'border-taupe-300 bg-white text-taupe-800 hover:border-wine-700'
    }`

  return (
    <AppLayout>
      <Head title="What to buy next" />
      <Link href="/admin/stock" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Stock
      </Link>
      <div className="mt-2">
        <PageHeader
          title="What to buy next"
          description="Worked out from how fast each size and colour has sold, plus everyone on the waiting list."
        />
      </div>

      {/* The two dials: how far back to look, and how long the stock should last. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-taupe-700">Based on the last</span>
          {windows.map((value) => (
            <Link key={value} href="/admin/stock/advice" data={{ days: value, cover }} preserveScroll className={pill(value === days)}>
              {value} days
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-taupe-700">Enough to last</span>
          {covers.map((value) => (
            <Link key={value} href="/admin/stock/advice" data={{ days, cover: value }} preserveScroll className={pill(value === cover)}>
              {value} weeks
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <Panel title="Buy these" className="xl:col-span-2">
          {buy.length === 0 ? (
            <p className="flex items-center gap-2 text-taupe-700">
              <Lightbulb className="size-5 text-wine-700" aria-hidden="true" />
              Nothing needs buying: at the pace things have sold, you have enough for {cover} weeks, and nobody is waiting.
            </p>
          ) : (
            <>
              <p className="text-taupe-800">
                <strong>{units}</strong> {units === 1 ? 'piece' : 'pieces'} across {groups.length} {groups.length === 1 ? 'product' : 'products'}
                {sees_costs && total > 0 && (
                  <>
                    , about <strong>{formatMoney(total)}</strong> at what they cost you last
                  </>
                )}
                .
              </p>
              <div className="mt-4 space-y-5">
                {groups.map((group) => (
                  <section key={group.id}>
                    <h3 className="font-display text-xl font-semibold text-wine-800">
                      <Link href={`/admin/products/${group.id}`} className="hover:underline">
                        {group.name}
                      </Link>
                    </h3>
                    <ul className="mt-2 divide-y divide-taupe-200 rounded-lg border border-taupe-200">
                      {group.rows.map((row) => (
                        <li key={row.variant_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                          <span className="flex min-w-32 flex-1 flex-wrap gap-1.5">
                            {row.option_values.length === 0 ? (
                              <span className="text-taupe-700">One kind</span>
                            ) : (
                              row.option_values.map((value) => <Chip key={value.name} label={value.label} swatch={value.swatch} />)
                            )}
                          </span>
                          <span className="text-sm text-taupe-700 tabular-nums">
                            {row.sold} sold, {row.on_hand} left
                            {row.weeks_left !== null && row.on_hand > 0 && `, lasts about ${row.weeks_left} wk`}
                          </span>
                          {row.waiting > 0 && (
                            <Badge tone="warning">
                              <Hourglass className="mr-1 size-3.5" aria-hidden="true" />
                              {row.waiting} waiting
                            </Badge>
                          )}
                          <span className="w-20 text-right text-lg font-semibold text-wine-800 tabular-nums">+{row.suggest}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <p className="mt-5 text-sm text-taupe-700">
                Each number is enough for {cover} weeks at the pace it sold over the last {days} days, plus anyone waiting, less what is
                on the shelf. A guide, not an order: you know what's coming up.
              </p>
            </>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="What your buyers wear">
            {best_options.length === 0 ? (
              <p className="text-taupe-700">Nothing sold in the last {days} days.</p>
            ) : (
              <div className="space-y-5">
                {best_options.map((group) => (
                  <div key={group.option}>
                    <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-taupe-800">
                      <TrendingUp className="size-4" aria-hidden="true" />
                      {group.option}, by pieces sold
                    </h3>
                    <BarList
                      empty=""
                      format={(value) => String(value)}
                      rows={group.labels.map((entry) => ({ key: entry.label, label: entry.label, value: entry.units }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Not moving">
            {slow.length === 0 ? (
              <p className="text-taupe-700">Everything on the shelf has sold at least once in the last {days} days.</p>
            ) : (
              <>
                <p className="flex items-start gap-2 text-taupe-800">
                  <Snail className="mt-0.5 size-5 shrink-0 text-taupe-600" aria-hidden="true" />
                  <span>
                    Not one sold in {days} days
                    {sees_costs && slow_total_pesewas !== null && slow_total_pesewas > 0 && (
                      <>
                        : <strong>{formatMoney(slow_total_pesewas)}</strong> sitting on the shelf
                      </>
                    )}
                    . Show them on a live, or bundle them.
                  </span>
                </p>
                <ul className="mt-3 divide-y divide-taupe-200">
                  {slow.map((row) => (
                    <li key={row.variant_id} className="flex items-center gap-3 py-2">
                      <Link href={`/admin/stock/${row.variant_id}`} className="min-w-0 flex-1 truncate hover:text-wine-800 hover:underline">
                        {row.product}, {row.variant}
                      </Link>
                      <span className="text-sm text-taupe-700 tabular-nums">{row.on_hand} left</span>
                      {sees_costs && row.tied_pesewas !== null && (
                        <span className="w-24 text-right text-sm font-medium tabular-nums">{formatMoney(row.tied_pesewas)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>
      </div>
    </AppLayout>
  )
}
