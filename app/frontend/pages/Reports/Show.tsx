import { Head, Link, router } from '@inertiajs/react'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import AppLayout from '@/layouts/AppLayout'
import BarChart from '@/components/ui/BarChart'
import BarList from '@/components/ui/BarList'
import Button from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import StatStrip from '@/components/ui/StatStrip'
import TextField from '@/components/ui/TextField'
import { formatMoney } from '@/lib/format'

type Totals = { orders: number; units: number; sales_pesewas: number; cost_pesewas?: number; profit_pesewas?: number }
type Moment = { date: string; label: string; short: string; orders: number; sales_pesewas: number; profit_pesewas?: number }

// Props from ReportsController#show. profit_pesewas and cost_pesewas are
// simply absent for people who may not see costs.
type Props = {
  period: { key: string; label: string; days: number; from: string; to: string; today: string }
  presets: { key: string; label: string }[]
  totals: Totals
  previous: { sales_pesewas: number; orders: number }
  over_time: Moment[]
  top_products: { id: number; name: string; units: number; sales_pesewas: number; profit_pesewas?: number }[]
  channels: { name: string; orders: number; sales_pesewas: number }[]
  lives: { id: number; name: string; orders: number; sales_pesewas: number }[]
  customers: { id: number; name: string; orders: number; sales_pesewas: number }[] | null // null = may not see customers
  money_in: { name: string; amount_pesewas: number }[]
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
  const { period, presets, totals, previous, over_time, top_products, channels, lives, customers, money_in, sees_costs } = props
  const [from, setFrom] = useState(period.from)
  const [to, setTo] = useState(period.to)
  const [custom, setCustom] = useState(period.key === 'custom')

  function applyDates(event: FormEvent) {
    event.preventDefault()
    router.get('/reports', { range: 'custom', from, to }, { preserveScroll: true })
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
            href="/reports"
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
            <TextField id="from" label="From" type="date" required max={period.today} value={from} onChange={(e) => setFrom(e.target.value)} />
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

      {/* grid-cols-1 matters on phones: it is minmax(0, 1fr), which lets a
          column be NARROWER than its longest unbreakable content. Without
          it, one long product name would push the whole page sideways. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* A single day has nothing to chart. */}
        {over_time.length > 1 && (
          <Panel title="Sales over time" className="xl:col-span-3">
            <BarChart
              title={`Sales for ${period.label}`}
              valueLabel="Sales"
              format={formatMoney}
              bars={over_time.map((moment) => ({
                label: moment.label,
                short: moment.short,
                value: moment.sales_pesewas,
                details: [
                  orders(moment.orders),
                  ...(moment.profit_pesewas !== undefined ? [`${formatMoney(moment.profit_pesewas)} profit`] : []),
                ],
              }))}
            />
          </Panel>
        )}

        <Panel title="Best sellers" className="xl:col-span-2">
          <BarList
            empty="Nothing sold in this period."
            format={formatMoney}
            rows={top_products.map((row) => ({
              key: row.id,
              label: row.name,
              note: `${row.units} sold${sees_costs && row.profit_pesewas !== undefined ? `, ${formatMoney(row.profit_pesewas)} profit` : ''}`,
              value: row.sales_pesewas,
              href: `/products/${row.id}`,
            }))}
          />
        </Panel>

        <Panel title="Where sales came from">
          <BarList
            empty="Nothing sold in this period."
            format={formatMoney}
            rows={channels.map((row) => ({ key: row.name, label: row.name, note: orders(row.orders), value: row.sales_pesewas }))}
          />
        </Panel>

        <Panel title="Lives">
          <BarList
            empty="No sales from a live in this period."
            format={formatMoney}
            rows={lives.map((row) => ({ key: row.id, label: row.name, note: orders(row.orders), value: row.sales_pesewas, href: `/live/${row.id}` }))}
          />
        </Panel>

        {customers && (
          <Panel title="Top customers">
            <BarList
              empty="Nobody bought in this period."
              format={formatMoney}
              rows={customers.map((row) => ({ key: row.id, label: row.name, note: orders(row.orders), value: row.sales_pesewas }))}
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
              Payments recorded in these days, less refunds. It includes delivery fees, and money for older orders, so it
              won't match Sales exactly.
            </p>
          )}
        </Panel>
      </div>

      {/* ---------- Take it away ----------
          Plain <a> tags, not Inertia <Link>s: these are file downloads, and
          the browser must handle them itself. */}
      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold text-wine-800">Download for a spreadsheet</h2>
        <p className="mt-1 text-taupe-700">Every order or payment in {period.label}, one per row.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {[
            { kind: 'orders', label: 'Orders' },
            { kind: 'payments', label: 'Payments' },
          ].map((file) => (
            <a
              key={file.kind}
              href={`/reports/export/${file.kind}.csv?${query}`}
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
