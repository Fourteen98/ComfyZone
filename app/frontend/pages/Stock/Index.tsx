import { Head, Link, router } from '@inertiajs/react'
import { Boxes, ChevronRight, Search, Shirt } from 'lucide-react'
import { useEffect, useState } from 'react'
import AppLayout from '@/layouts/AppLayout'
import Chip from '@/components/ui/Chip'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import StatStrip from '@/components/ui/StatStrip'
import StockLevelBadge from '@/components/StockLevelBadge'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { formatMoney } from '@/lib/format'
import type { StockLevel } from '@/lib/stock'

type VariantRow = {
  id: number
  name: string
  option_values: (OptionValue & { name: string })[]
  stock: number
  level: StockLevel
  value_pesewas: number | null // null = may not see costs
}

type Group = { id: number; name: string; low_stock_at: number; thumb_url: string | null; variants: VariantRow[] }

type Props = {
  groups: Group[]
  filters: { show: 'all' | 'low' | 'out'; q: string }
  counts: { all: number; low: number; out: number }
  totals: { units: number; value_pesewas: number | null }
}

// Props from StockController#index
export default function StockIndex({ groups, filters, counts, totals }: Props) {
  const [query, setQuery] = useState(filters.q)

  const params = (show: string, q = filters.q) => ({ show: show === 'all' ? undefined : show, q: q || undefined })

  // Search as she types, after a short pause. See Products/Index for notes.
  useEffect(() => {
    if (query === filters.q) return
    const timer = setTimeout(() => {
      router.get('/stock', params(filters.show, query), { preserveState: true, replace: true })
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const tabs = [
    { key: 'all', label: 'Everything', count: counts.all },
    { key: 'low', label: 'Running low', count: counts.low },
    { key: 'out', label: 'Out of stock', count: counts.out },
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
      <PageHeader title="Stock" description="What you have on hand right now. Tap any item to see its history or correct its count." />

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

          <div className="mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-taupe-200">
            <nav aria-label="Show" className="flex gap-1 overflow-x-auto">
              {tabs.map((tab) => {
                const active = filters.show === tab.key
                return (
                  <Link
                    key={tab.key}
                    href="/stock"
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
                placeholder="Search by product"
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
                    <h2 className="min-w-0 flex-1 truncate font-display text-2xl font-semibold text-wine-800">
                      <Link href={`/products/${group.id}`} className="hover:underline">
                        {group.name}
                      </Link>
                    </h2>
                    <p className="text-sm text-taupe-700 tabular-nums">
                      {group.variants.reduce((sum, variant) => sum + Math.max(variant.stock, 0), 0)} here
                    </p>
                  </header>

                  <ul className="divide-y divide-taupe-200">
                    {group.variants.map((variant) => (
                      <li key={variant.id}>
                        <Link
                          href={`/stock/${variant.id}`}
                          className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
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
                              {formatMoney(variant.value_pesewas)}
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
