import { Head, Link, router, usePage } from '@inertiajs/react'
import { Boxes, ChevronRight, ClipboardList, Lightbulb, Search, Shirt, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import { ButtonLink } from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import StatStrip from '@/components/ui/StatStrip'
import StockLevelBadge from '@/components/StockLevelBadge'
import StockAdjustForm from '@/components/StockAdjustForm'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { formatMoney } from '@/lib/format'
import { useCan } from '@/lib/permissions'
import type { StockLevel } from '@/lib/stock'

type VariantRow = {
  id: number
  name: string
  option_values: (OptionValue & { name: string })[]
  stock: number
  level: StockLevel
  value_pesewas: number | null // null = may not see costs
  no_cost: boolean // in stock, but the app was never told what it cost
}

type Group = {
  id: number
  name: string
  low_stock_at: number
  thumb_url: string | null
  sells_for_pesewas: number // these pieces, at their selling prices
  variants: VariantRow[]
}

// If everything on hand sells (StockLedger.sales_estimate). Profits are null
// for people who may not see costs; bulk is null when no stock has a lower bulk price.
type Estimate = {
  sells_for_pesewas: number
  profit_pesewas: number | null
  bulk: { sells_for_pesewas: number; profit_pesewas: number | null } | null
}

type Props = {
  groups: Group[]
  filters: { show: 'all' | 'low' | 'out' | 'uncosted'; q: string }
  // uncosted: null = may not see costs
  counts: { all: number; low: number; out: number; uncosted: number | null }
  totals: { units: number; value_pesewas: number | null }
  estimate: Estimate
  /** While searching: the best match, whose quick form opens by itself. */
  focus_id: number | null
}

// Props from StockController#index
export default function StockIndex({ groups, filters, counts, totals, estimate, focus_id }: Props) {
  const can = useCan()
  const [query, setQuery] = useState(filters.q)
  const errors = usePage().props.errors as Record<string, string[] | undefined>

  // Type "orange 3xl" and that item comes first with its "update stock"
  // form already open: find it, type the number, done. Other rows open
  // theirs with the Adjust button. A failed save comes back open.
  const searching = filters.q !== '' && can('stock.adjust')
  const [openId, setOpenId] = useState<number | null>(searching ? Number(errors.adjusting?.[0]) || focus_id : null)
  useEffect(() => {
    if (searching) setOpenId(Number(errors.adjusting?.[0]) || focus_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus_id, filters.q])

  const params = (show: string, q = filters.q) => ({ show: show === 'all' ? undefined : show, q: q || undefined })

  // Search as she types, after a short pause. See Products/Index for notes.
  useEffect(() => {
    if (query === filters.q) return
    const timer = setTimeout(() => {
      router.get('/admin/stock', params(filters.show, query), { preserveState: true, replace: true })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const tabs = [
    { key: 'all', label: 'Everything', count: counts.all },
    { key: 'low', label: 'Running low', count: counts.low },
    { key: 'out', label: 'Out of stock', count: counts.out },
    // Only there while something needs a cost; it disappears once all are set.
    ...(counts.uncosted ? [{ key: 'uncosted', label: 'No cost yet', count: counts.uncosted }] : []),
  ]

  const stats = [
    { label: 'Items on hand', value: totals.units.toLocaleString() },
    ...(totals.value_pesewas !== null ? [{ label: 'What it cost you', value: formatMoney(totals.value_pesewas) }] : []),
    { label: 'Running low', value: String(counts.low) },
    { label: 'Out of stock', value: String(counts.out) },
  ]

  return (
    <AppLayout>
      <Head title="Stock" />
      <PageHeader
        title="Stock"
        description="What you have on hand right now. Tap any item to see its history or correct its count."
        actions={
          <>
            <ButtonLink href="/admin/stock/advice" variant="secondary">
              <Lightbulb className="size-5" aria-hidden="true" />
              What to buy next
            </ButtonLink>
            {can('stock.adjust') && counts.all > 0 && (
              <ButtonLink href="/admin/stock/count" variant="secondary">
                <ClipboardList className="size-5" aria-hidden="true" />
                Stock take
              </ButtonLink>
            )}
          </>
        }
      />

      {counts.all === 0 && !filters.q ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={Boxes} title="Nothing to count yet">
            Add products, then record a purchase. Stock appears here when the goods arrive.
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <StatStrip stats={stats} />
          </div>

          {estimate.sells_for_pesewas > 0 && (
            <EstimateCard estimate={estimate} costsOf={totals.value_pesewas} uncosted={counts.uncosted ?? 0} />
          )}

          {/* Why "What it cost you" may look too low, and where to fix it. */}
          {counts.uncosted ? (
            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
              {counts.uncosted === 1 ? '1 item is' : `${counts.uncosted} items are`} in stock with no cost recorded, so{' '}
              {counts.uncosted === 1 ? 'it counts' : 'they count'} as GH₵ 0 in "What it cost you" and in profit.{' '}
              <Link href="/admin/stock" data={params('uncosted')} className="font-medium underline underline-offset-4">
                Show {counts.uncosted === 1 ? 'it' : 'them'}
              </Link>
              , then open each one to say what it cost.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-taupe-200">
            <nav aria-label="Show" className="flex gap-1 overflow-x-auto">
              {tabs.map((tab) => {
                const active = filters.show === tab.key
                return (
                  <Link
                    key={tab.key}
                    href="/admin/stock"
                    data={params(tab.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 font-medium ${
                      active
                        ? 'border-wine-800 text-wine-800'
                        : 'border-transparent text-taupe-700 hover:border-taupe-300 hover:text-wine-800'
                    }`}
                  >
                    {tab.label}
                    <span className="text-sm font-normal tabular-nums opacity-70">{tab.count}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="relative mb-2 w-full sm:w-72">
              <Search className="pointer-events-none absolute top-3 left-3 size-5 text-taupe-500" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search stock"
                placeholder="Product, size or colour: orange 3xl"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block min-h-11 w-full rounded-md border-taupe-300 bg-white pr-3 pl-10 text-base placeholder:text-taupe-400 focus:border-wine-700 focus:ring-1 focus:ring-wine-700"
              />
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="mt-8 text-center text-taupe-700">
              {filters.q
                ? `Nothing matches "${filters.q}".`
                : filters.show === 'low'
                  ? 'Nothing is running low.'
                  : 'Nothing is out of stock.'}
            </p>
          ) : (
            // Two columns of products on wide screens, one on phones.
            <div className="mt-5 grid items-start gap-5 2xl:grid-cols-2">
              {groups.map((group) => (
                <section key={group.id} className="overflow-hidden rounded-lg border border-taupe-200 bg-white">
                  <header className="flex items-center gap-3 border-b border-taupe-200 px-4 py-3">
                    <span className="flex aspect-[4/5] w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-taupe-200 text-taupe-500">
                      {group.thumb_url ? (
                        <img src={group.thumb_url} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <Shirt className="size-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-2xl font-semibold text-wine-800">
                        <Link href={`/admin/products/${group.id}`} className="hover:underline">
                          {group.name}
                        </Link>
                      </h2>
                      {group.sells_for_pesewas > 0 && (
                        <p className="text-sm text-taupe-600 tabular-nums">Sells for {formatMoney(group.sells_for_pesewas)}</p>
                      )}
                    </div>
                    <p className="text-sm text-taupe-700 tabular-nums">
                      {group.variants.reduce((sum, variant) => sum + Math.max(variant.stock, 0), 0)} here
                    </p>
                  </header>

                  <ul className="divide-y divide-taupe-200">
                    {group.variants.map((variant) => (
                      <li key={variant.id} className={variant.id === openId ? 'bg-wine-50/60' : ''}>
                        <div className="flex items-stretch">
                          <Link
                            href={`/admin/stock/${variant.id}`}
                            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                          >
                            <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                              {variant.option_values.length === 0 ? (
                                <span className="text-taupe-700">One item</span>
                              ) : (
                                variant.option_values.map((value) => <Chip key={value.name} label={value.label} swatch={value.swatch} />)
                              )}
                            </span>
                            <StockLevelBadge level={variant.level} />
                            {variant.value_pesewas !== null && variant.stock > 0 && (
                              <span className="hidden w-28 text-right text-sm text-taupe-700 tabular-nums sm:block">
                                {variant.no_cost ? 'No cost yet' : formatMoney(variant.value_pesewas)}
                              </span>
                            )}
                            <span
                              className={`w-10 text-right text-xl font-semibold tabular-nums ${
                                variant.level === 'out' ? 'text-taupe-400' : 'text-ink'
                              }`}
                            >
                              {variant.stock}
                            </span>
                            <ChevronRight className="size-5 shrink-0 text-taupe-400" aria-hidden="true" />
                          </Link>
                          {searching && (
                            <button
                              type="button"
                              onClick={() => setOpenId(openId === variant.id ? null : variant.id)}
                              aria-expanded={openId === variant.id}
                              aria-label={`Adjust stock for ${group.name}, ${variant.name}`}
                              className="flex w-14 shrink-0 items-center justify-center border-l border-taupe-200 text-wine-800 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                            >
                              <SlidersHorizontal className="size-5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        {searching && openId === variant.id && (
                          <div className="border-t border-taupe-200 px-4 py-4">
                            {/* Starts on "Found more" (adding); she can switch to counting or taking off. */}
                            <StockAdjustForm
                              key={variant.id}
                              variant={variant}
                              reason="found"
                              back={{ q: filters.q, show: filters.show }}
                              idPrefix={`v${variant.id}_`}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </AppLayout>
  )
}

// "If it all sells": what the stock on hand should bring in, and the profit
// in it. An estimate: no delivery fees, discounts or deals typed by hand.
function EstimateCard({ estimate, costsOf, uncosted }: { estimate: Estimate; costsOf: number | null; uncosted: number }) {
  const margin = (profit: number, sells: number) => (sells > 0 ? Math.round((profit / sells) * 100) : 0)
  const row = (label: string, sells: number, profit: number | null, main: boolean) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <dt className={main ? 'text-taupe-800' : 'text-sm text-taupe-700'}>{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-3 tabular-nums">
        <span className={main ? 'text-2xl font-semibold text-wine-800' : 'font-semibold'}>{formatMoney(sells)}</span>
        {profit !== null && (
          <span className={`text-sm ${profit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
            {formatMoney(profit)} profit ({margin(profit, sells)}%)
          </span>
        )}
      </dd>
    </div>
  )

  return (
    <section aria-labelledby="estimate-title" className="mt-4 rounded-lg border border-taupe-200 bg-white px-5 py-4">
      <h2 id="estimate-title" className="font-medium">
        If everything on hand sells
      </h2>
      <dl className="mt-2 space-y-2">
        {row('At your selling prices', estimate.sells_for_pesewas, estimate.profit_pesewas, true)}
        {estimate.bulk && row('If it all went at bulk prices', estimate.bulk.sells_for_pesewas, estimate.bulk.profit_pesewas, false)}
      </dl>
      <p className="mt-3 text-sm text-taupe-600">
        An estimate{costsOf !== null ? `, against the ${formatMoney(costsOf)} it cost you` : ''}. Delivery fees, discounts and deals agreed
        by hand aren't in it.
        {estimate.profit_pesewas !== null && uncosted > 0 && ' Items with no cost yet make the profit look bigger than it is.'}
      </p>
    </section>
  )
}
