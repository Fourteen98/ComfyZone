import { Head, Link, router } from '@inertiajs/react'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import BarChart from '@/components/ui/BarChart'
import SalesChart from '@/components/SalesChart'
import BarList from '@/components/ui/BarList'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import StatStrip from '@/components/ui/StatStrip'
import TextField from '@/components/ui/TextField'
import { formatMoney } from '@/lib/format'

type Totals = { orders: number; units: number; sales_pesewas: number; cost_pesewas?: number; profit_pesewas?: number }
type Slot = { label: string; short: string; orders: number; sales_pesewas: number }
type Moment = { date: string; label: string; short: string; orders: number; sales_pesewas: number; profit_pesewas?: number }

// Props from ReportsController#show. profit_pesewas and cost_pesewas are
// simply absent for people who may not see costs.
type Props = {
  period: { key: string; label: string; days: number; from: string; to: string; today: string }
  presets: { key: string; label: string }[]
  totals: Totals
  previous: { sales_pesewas: number; orders: number }
  over_time: (Moment & { previous_sales_pesewas: number })[]
  by_weekday: Slot[]
  by_hour: Slot[]
  top_products: { id: number; name: string; units: number; sales_pesewas: number; profit_pesewas?: number }[]
  channels: { name: string; orders: number; sales_pesewas: number }[]
  regions: { name: string; orders: number; sales_pesewas: number }[]
  places: { id: number; name: string; region: string; orders: number; sales_pesewas: number }[]
  lives: {
    id: number
    name: string
    orders: number
    sales_pesewas: number
    cost_pesewas?: number
    expenses_pesewas?: number
    profit_pesewas?: number
  }[]
  /** What makes money, per product. null = may not see costs. */
  product_profit:
    | { id: number; name: string; units: number; sales_pesewas: number; profit_pesewas: number; margin: number; unknown_cost: boolean }[]
    | null
  customers: { id: number; name: string; orders: number; sales_pesewas: number }[] | null // null = may not see customers
  money_in: { name: string; amount_pesewas: number }[]
  expenses: { total_pesewas: number; by_category: { name: string; amount_pesewas: number }[] } | null // null = may not see
  sees_costs: boolean
}

const orders = (count: number) => (count === 1 ? '1 order' : `${count} orders`)

// "Up 12% on the 7 days before", in words and with an icon, never by
// colour alone. Says nothing when there is nothing to compare with.
function Change({ now, before, days }: { now: number; before: number; days: number }) {
  if (before === 0) return null
  const percent = Math.round(((now - before) / before) * 100)
  const span = days === 1 ? 'the day before' : `the ${days} days before`
  if (percent === 0) return <p className="mt-3 text-taupe-700">About the same as {span}.</p>

  const Icon = percent > 0 ? TrendingUp : TrendingDown
  return (
    <p className="mt-3 flex items-center gap-2 text-taupe-800">
      <Icon className={`size-5 ${percent > 0 ? 'text-emerald-700' : 'text-red-700'}`} aria-hidden="true" />
      Sales {percent > 0 ? 'up' : 'down'} {Math.abs(percent)}% on {span} ({formatMoney(before)}).
    </p>
  )
}

export default function ReportsShow(props: Props) {
  const {
    period,
    presets,
    totals,
    previous,
    over_time,
    by_weekday,
    by_hour,
    top_products,
    channels,
    regions,
    places,
    lives,
    customers,
    money_in,
    expenses,
    product_profit,
  } = props
  const [from, setFrom] = useState(period.from)
  const [to, setTo] = useState(period.to)
  const [custom, setCustom] = useState(period.key === 'custom')

  function applyDates(event: FormEvent) {
    event.preventDefault()
    router.get('/admin/reports', { range: 'custom', from, to }, { preserveScroll: true })
  }

  // The same period, as a query string, for the download links.
  const query = new URLSearchParams(period.key === 'custom' ? { range: 'custom', from: period.from, to: period.to } : { range: period.key })
  const tab = (on: boolean) =>
    `flex min-h-11 shrink-0 items-center rounded-full border px-4 font-medium ${
      on ? 'border-wine-800 bg-wine-800 text-taupe-50' : 'border-taupe-300 bg-white hover:border-wine-700'
    }`

  const stats = [
    { label: 'Sales', value: formatMoney(totals.sales_pesewas) },
    ...(totals.profit_pesewas !== undefined ? [{ label: 'Profit', value: formatMoney(totals.profit_pesewas) }] : []),
    { label: 'Orders', value: String(totals.orders), hint: totals.units === 1 ? '1 item' : `${totals.units} items` },
    { label: 'Average order', value: formatMoney(totals.orders === 0 ? 0 : Math.round(totals.sales_pesewas / totals.orders)) },
    // Expenses, and what is really left, for those allowed to see them.
    ...(expenses ? [{ label: 'Expenses', value: formatMoney(expenses.total_pesewas), href: '/admin/expenses' }] : []),
    ...(expenses && totals.profit_pesewas !== undefined
      ? [{ label: 'Net profit', value: formatMoney(totals.profit_pesewas - expenses.total_pesewas), hint: 'Profit less expenses' }]
      : []),
  ]

  return (
    <AppLayout>
      <Head title="Reports" />
      <PageHeader title="Reports" description={period.label} />

      {/* ---------- Which days ---------- */}
      <nav aria-label="Period" className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {presets.map((preset) => (
          <Link
            key={preset.key}
            href="/admin/reports"
            data={{ range: preset.key }}
            preserveScroll
            aria-current={period.key === preset.key ? 'page' : undefined}
            className={tab(period.key === preset.key)}
          >
            {preset.label}
          </Link>
        ))}
        <button type="button" onClick={() => setCustom(!custom)} aria-expanded={custom} className={tab(period.key === 'custom')}>
          Choose dates
        </button>
      </nav>

      {custom && (
        <form onSubmit={applyDates} className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-44">
            <TextField
              id="from"
              label="From"
              type="date"
              required
              max={period.today}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="w-44">
            <TextField id="to" label="To" type="date" required max={period.today} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button type="submit" variant="secondary">
            Show
          </Button>
        </form>
      )}

      {/* ---------- Headline ---------- */}
      <div className="mt-6">
        <StatStrip stats={stats} />
        <Change now={totals.sales_pesewas} before={previous.sales_pesewas} days={period.days} />
      </div>

      {/* A single day has nothing to chart over time; "When people buy" still helps. */}
      {over_time.length > 1 && (
        <Panel title="How sales moved" className="mt-6">
          <SalesChart points={over_time} previousLabel={period.days === 1 ? 'The day before' : `The ${period.days} days before`} />
        </Panel>
      )}

      <WhenPeopleBuy weekdays={by_weekday} hours={by_hour} days={period.days} />

      {/* Best sellers and what makes money, in one table: sold, sales, profit, margin. */}
      <ProductsPanel top={top_products} profit={product_profit} />

      {/* The rest flow down two (or three) columns like a newspaper, so a long
          panel never leaves a hole beside a short one. Empty ones are left out. */}
      <div className="mt-6 gap-6 lg:columns-2 2xl:columns-3 [&>*]:mb-6 [&>*]:break-inside-avoid">
        <Panel title="Where sales came from">
          <BarList
            empty="Nothing sold in this period."
            format={formatMoney}
            rows={channels.map((row) => ({ key: row.name, label: row.name, note: orders(row.orders), value: row.sales_pesewas }))}
          />
        </Panel>

        {(regions.length > 0 || places.length > 0) && (
          <Panel title="Where buyers are">
            <BarList
              empty="Nothing sold in this period."
              limit={5}
              format={formatMoney}
              rows={regions.map((row) => ({ key: row.name, label: row.name, note: orders(row.orders), value: row.sales_pesewas }))}
            />
            {places.length > 0 && (
              <>
                <h3 className="mt-6 mb-3 text-sm font-medium text-taupe-700">Top places</h3>
                <BarList
                  empty=""
                  limit={5}
                  format={formatMoney}
                  rows={places.map((row) => ({
                    key: row.id,
                    label: row.name,
                    note: `${row.region}, ${orders(row.orders)}`,
                    value: row.sales_pesewas,
                  }))}
                />
              </>
            )}
          </Panel>
        )}

        {customers && customers.length > 0 && (
          <Panel title="Top customers">
            <BarList
              empty=""
              limit={5}
              format={formatMoney}
              rows={customers.map((row) => ({
                key: row.id,
                label: row.name,
                note: orders(row.orders),
                value: row.sales_pesewas,
                href: `/admin/customers/${row.id}`,
              }))}
            />
          </Panel>
        )}

        {lives.length > 0 && (
          <Panel title="Lives">
            <BarList
              empty=""
              limit={5}
              format={formatMoney}
              rows={lives.map((row) => ({
                key: row.id,
                label: row.name,
                // With costs: what the live really made, after the goods and any costs pinned to it.
                note:
                  row.profit_pesewas !== undefined
                    ? `${orders(row.orders)}, ${formatMoney(row.profit_pesewas)} profit${row.expenses_pesewas ? ` after ${formatMoney(row.expenses_pesewas)} live costs` : ''}`
                    : orders(row.orders),
                value: row.sales_pesewas,
                href: `/admin/live/${row.id}`,
              }))}
            />
          </Panel>
        )}

        <Panel title="Money received">
          <BarList
            empty="No payments were recorded in this period."
            format={formatMoney}
            rows={money_in.map((row) => ({ key: row.name, label: row.name, value: row.amount_pesewas }))}
          />
          {money_in.length > 0 && (
            <p className="mt-4 text-sm text-taupe-700">
              Payments recorded in these days, less refunds. It includes delivery fees, and money for older orders, so it won't match Sales
              exactly.
            </p>
          )}
        </Panel>

        {expenses && expenses.by_category.length > 0 && (
          <Panel title="Expenses">
            <BarList
              empty=""
              format={formatMoney}
              rows={expenses.by_category.map((row) => ({ key: row.name, label: row.name, value: row.amount_pesewas }))}
            />
          </Panel>
        )}
      </div>

      {/* ---------- Take it away ----------
          Plain <a> tags, not Inertia <Link>s: these are file downloads, and
          the browser must handle them itself. */}
      <section className="mt-2">
        <h2 className="font-display text-2xl font-semibold text-wine-800">Download for a spreadsheet</h2>
        <p className="mt-1 text-taupe-700">Every order or payment in {period.label}, one per row.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {[
            { kind: 'orders', label: 'Orders' },
            { kind: 'payments', label: 'Payments' },
          ].map((file) => (
            <a
              key={file.kind}
              href={`/admin/reports/export/${file.kind}.csv?${query}`}
              className="inline-flex min-h-12 items-center gap-2 rounded-md border border-taupe-300 bg-white px-5 font-medium text-wine-800 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700"
            >
              <Download className="size-5" aria-hidden="true" />
              {file.label} (CSV)
            </a>
          ))}
        </div>
      </section>
    </AppLayout>
  )
}

type TopProduct = Props['top_products'][number]
type ProductProfit = NonNullable<Props['product_profit']>[number]

// One table for "what sold" and "what made money". With costs, each product
// shows sold, sales, profit and margin, ranked by sales or by profit (her
// choice). Without costs, a simple ranked list of sales.
function ProductsPanel({ top, profit }: { top: TopProduct[]; profit: ProductProfit[] | null }) {
  const [by, setBy] = useState<'sales' | 'profit'>('sales')
  const [all, setAll] = useState(false)

  if (!profit) {
    return (
      <Panel title="Best sellers" className="mt-6">
        <BarList
          empty="Nothing sold in this period."
          limit={5}
          format={formatMoney}
          rows={top.map((row) => ({
            key: row.id,
            label: row.name,
            note: `${row.units} sold`,
            value: row.sales_pesewas,
            href: `/admin/products/${row.id}`,
          }))}
        />
      </Panel>
    )
  }

  const rows = [...profit].sort((a, b) => (by === 'sales' ? b.sales_pesewas - a.sales_pesewas : b.profit_pesewas - a.profit_pesewas))
  const shown = all || rows.length <= 6 ? rows : rows.slice(0, 5)
  const max = Math.max(...rows.map((row) => (by === 'sales' ? row.sales_pesewas : row.profit_pesewas)), 1)
  const pill = (on: boolean) =>
    `min-h-9 rounded-full px-3 text-sm font-medium ${on ? 'bg-wine-800 text-taupe-50' : 'text-taupe-800 hover:bg-taupe-100'}`

  return (
    <Panel
      title="Products"
      className="mt-6"
      action={
        <div role="group" aria-label="Rank by" className="flex gap-1">
          <button type="button" aria-pressed={by === 'sales'} onClick={() => setBy('sales')} className={pill(by === 'sales')}>
            By sales
          </button>
          <button type="button" aria-pressed={by === 'profit'} onClick={() => setBy('profit')} className={pill(by === 'profit')}>
            By profit
          </button>
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="text-taupe-700">Nothing sold in this period.</p>
      ) : (
        <>
          {/* A list laid out as a grid: on a phone, the product (with what it
              sold) on the left and the profit on the right; wider, Sold and
              Sales get columns of their own. */}
          <div className="-mt-2 tabular-nums">
            <div className="hidden grid-cols-[1fr_4rem_8rem_8rem] gap-3 py-2 text-sm font-medium text-taupe-600 sm:grid">
              <span>Product</span>
              <span className="text-right">Sold</span>
              <span className="text-right">Sales</span>
              <span className="text-right">Profit</span>
            </div>
            <ol className="divide-y divide-taupe-100">
              {shown.map((row) => {
                const value = by === 'sales' ? row.sales_pesewas : row.profit_pesewas
                return (
                  <li
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_4rem_8rem_8rem]"
                  >
                    <div className="min-w-0">
                      <Link href={`/admin/products/${row.id}`} className="block truncate font-medium hover:text-wine-800 hover:underline">
                        {row.name}
                      </Link>
                      <span className="block text-sm text-taupe-600 sm:hidden">
                        {row.units} sold, {formatMoney(row.sales_pesewas)}
                      </span>
                      {/* The bar shows the ranking chosen above. */}
                      <div className="mt-1 h-1.5 rounded-full bg-taupe-100" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-wine-700"
                          style={{ width: `${Math.max((Math.max(value, 0) / max) * 100, 1)}%` }}
                        />
                      </div>
                    </div>
                    <span className="hidden text-right sm:block">{row.units}</span>
                    <span className="hidden text-right whitespace-nowrap sm:block">{formatMoney(row.sales_pesewas)}</span>
                    <span className="text-right whitespace-nowrap">
                      {row.unknown_cost ? (
                        <span className="text-sm text-amber-800">No cost yet</span>
                      ) : (
                        <>
                          <span className="block font-semibold">{formatMoney(row.profit_pesewas)}</span>
                          <span className="block text-sm text-taupe-600">{row.margin}% margin</span>
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
          {rows.length > 6 && (
            <button
              type="button"
              onClick={() => setAll(!all)}
              className="mt-2 min-h-10 rounded-md text-sm font-medium text-wine-800 hover:underline focus-visible:outline-2 focus-visible:outline-wine-700"
            >
              {all ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
          <p className="mt-3 text-sm text-taupe-600">
            Profit after what the pieces cost you, transport and purchase fees included. Margin is the share of each sale you keep: a best
            seller with a thin margin can make less than a quiet piece with a fat one.
          </p>
        </>
      )}
    </Panel>
  )
}

// When people buy: by day of the week and by hour, to plan lives and posts
// around. Counted in orders (how many people), with the money in the readout.
function WhenPeopleBuy({ weekdays, hours, days }: { weekdays: Slot[]; hours: Slot[]; days: number }) {
  const total = hours.reduce((sum, slot) => sum + slot.orders, 0)
  if (total === 0) return null

  const busiest = (slots: Slot[]) => slots.reduce((best, slot) => (slot.orders > best.orders ? slot : best), slots[0])
  // Late-night hours with nothing in them only waste space: show from the
  // first hour anything happened to the last.
  const used = hours.map((slot, i) => (slot.orders > 0 ? i : -1)).filter((i) => i >= 0)
  const shownHours = hours.slice(Math.max(used[0] - 1, 0), Math.min(used[used.length - 1] + 2, 24))
  const bars = (slots: Slot[]) =>
    slots.map((slot) => ({
      label: slot.label,
      short: slot.short,
      value: slot.orders,
      details: [formatMoney(slot.sales_pesewas)],
    }))
  const count = (n: number) => (n === 1 ? '1 order' : `${n} orders`)
  // A week or more is needed before days of the week mean anything.
  const showDays = days >= 7

  return (
    <Panel title="When people buy" className="mt-6">
      <div className={`grid gap-8 ${showDays ? 'lg:grid-cols-2' : ''}`}>
        {showDays && (
          <div>
            <p className="text-sm text-taupe-700">
              Busiest day: <strong className="font-semibold text-ink">{busiest(weekdays).label}</strong>, {count(busiest(weekdays).orders)}
            </p>
            <div className="mt-3">
              <BarChart title="Orders by day of the week" valueLabel="Orders" format={String} bars={bars(weekdays)} />
            </div>
          </div>
        )}
        <div>
          <p className="text-sm text-taupe-700">
            Busiest hour: <strong className="font-semibold text-ink">{busiest(hours).label}</strong>, {count(busiest(hours).orders)}
          </p>
          <div className="mt-3">
            <BarChart title="Orders by hour of the day" valueLabel="Orders" format={String} bars={bars(shownHours)} />
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-taupe-600">
        Ghana time. Going live or posting just before the busy hours puts you in front of people when they are ready to buy.
      </p>
    </Panel>
  )
}
