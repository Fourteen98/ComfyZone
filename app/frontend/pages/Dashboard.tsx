import { Head, Link } from '@inertiajs/react'
import { Boxes, Radio, ReceiptText, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import AppLayout from '@/layouts/AppLayout'
import BarChart from '@/components/ui/BarChart'
import BarList from '@/components/ui/BarList'
import { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import StatStrip from '@/components/ui/StatStrip'
import Chip from '@/components/ui/Chip'
import StockLevelBadge from '@/components/StockLevelBadge'
import type { OptionValue } from '@/components/OptionValuesEditor'
import type { StockLevel } from '@/lib/stock'
import OrderList from '@/components/OrderList'
import type { OrderSummary } from '@/lib/orders'
import { formatMoney, greeting } from '@/lib/format'
import { useCan } from '@/lib/permissions'

type Tile = {
  key: string
  label: string
  format: 'money' | 'count'
  href: string | null
  value: number
}

type LowStockItem = {
  id: number
  product: string
  variant: string
  option_values: (OptionValue & { name: string })[]
  stock: number
  level: StockLevel
}

// A panel arrives as { key, title, wide, data }, and the shape of `data`
// depends on the key. This is a "discriminated union": once TypeScript
// knows panel.key is 'low_stock', it knows panel.data is LowStockItem[].
type PanelBase = { title: string; wide: boolean }
type DashboardPanel = PanelBase &
  (
    | { key: 'recent_orders'; data: OrderSummary[] }
    | { key: 'low_stock'; data: LowStockItem[] }
    | { key: 'week_sales'; data: { label: string; short: string; orders: number; sales_pesewas: number }[] }
    | { key: 'top_products'; data: { id: number; name: string; units: number; sales_pesewas: number }[] }
    | { key: 'channels'; data: { name: string; orders: number; sales_pesewas: number }[] }
  )

// These props are exactly the hash passed to `render inertia: "Dashboard",
// props: { ... }` in DashboardController#show. Rails decides what is on
// the dashboard (the person's own choice, limited by their permissions);
// this page draws whatever arrives, in the order it arrives.
type Props = {
  today: string
  tiles: Tile[]
  panels: DashboardPanel[]
  // Set while a live is running.
  live_now: { id: number; title: string } | null
}

const seeAll = 'text-sm font-medium text-wine-800 underline underline-offset-4'

// What goes inside each kind of panel, and its "See all" link.
function panelParts(panel: DashboardPanel, canSeeReports: boolean): { action?: ReactNode; body: ReactNode } {
  switch (panel.key) {
    case 'recent_orders':
      return {
        action: panel.data.length > 0 && (
          <Link href="/orders" className={seeAll}>
            See all
          </Link>
        ),
        body:
          panel.data.length === 0 ? (
            <EmptyState icon={ReceiptText} title="No orders yet">
              Orders from your lives will show here, newest first.
            </EmptyState>
          ) : (
            <div className="-mx-5 -my-5">
              <OrderList orders={panel.data} />
            </div>
          ),
      }

    case 'low_stock':
      return {
        action: (
          <Link href="/stock?show=low" className={seeAll}>
            See all
          </Link>
        ),
        body:
          panel.data.length === 0 ? (
            <EmptyState icon={Boxes} title="Nothing running low">
              Items that drop to their warning level will be listed here.
            </EmptyState>
          ) : (
            <ul className="-mx-5 -my-5 divide-y divide-taupe-200">
              {panel.data.map((item) => (
                <li key={item.id}>
                  <Link href={`/stock/${item.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-taupe-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.product}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {item.option_values.map((value) => (
                          <Chip key={value.name} label={value.label} swatch={value.swatch} />
                        ))}
                      </span>
                    </span>
                    <StockLevelBadge level={item.level} />
                    <span className="w-8 text-right text-xl font-semibold tabular-nums">{item.stock}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ),
      }

    case 'week_sales':
      return {
        action: canSeeReports && (
          <Link href="/reports" className={seeAll}>
            Reports
          </Link>
        ),
        body: (
          <BarChart
            title="Sales on each of the last 7 days"
            valueLabel="Sales"
            format={formatMoney}
            bars={panel.data.map((day) => ({
              label: day.label,
              short: day.label.slice(0, 3), // "Mon"
              value: day.sales_pesewas,
              details: [day.orders === 1 ? '1 order' : `${day.orders} orders`],
            }))}
          />
        ),
      }

    case 'top_products':
      return {
        body: (
          <BarList
            empty="Nothing sold in the last 30 days."
            format={formatMoney}
            rows={panel.data.map((row) => ({
              key: row.id,
              label: row.name,
              note: `${row.units} sold`,
              value: row.sales_pesewas,
              href: `/products/${row.id}`,
            }))}
          />
        ),
      }

    case 'channels':
      return {
        body: (
          <BarList
            empty="Nothing sold in the last 30 days."
            format={formatMoney}
            rows={panel.data.map((row) => ({
              key: row.name,
              label: row.name,
              note: row.orders === 1 ? '1 order' : `${row.orders} orders`,
              value: row.sales_pesewas,
            }))}
          />
        ),
      }
  }
}

export default function Dashboard({ today, tiles, panels, live_now }: Props) {
  const can = useCan()

  return (
    <AppLayout>
      {/* <Head> sets the browser tab title for this page. */}
      <Head title="Dashboard" />

      <PageHeader
        title={greeting()}
        description={today}
        actions={
          <ButtonLink href="/dashboard/edit" variant="secondary">
            <SlidersHorizontal className="size-5" aria-hidden="true" />
            Customise
          </ButtonLink>
        }
      />

      {live_now && (
        <Link
          href={`/live/${live_now.id}`}
          className="mt-5 flex items-center gap-3 rounded-lg bg-wine-800 px-5 py-4 text-taupe-50 hover:bg-wine-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700"
        >
          <Radio className="size-6 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">You are live: {live_now.title}</span>
            <span className="block text-sm text-taupe-200">Tap to record claims.</span>
          </span>
        </Link>
      )}

      {tiles.length > 0 && (
        <div className="mt-6">
          <StatStrip
            stats={tiles.map((tile) => ({
              label: tile.label,
              value: tile.format === 'money' ? formatMoney(tile.value) : String(tile.value),
              href: tile.href ?? undefined,
            }))}
          />
        </div>
      )}

      {/* Phones: one column, in her order.
          Wide screens: wide panels stack in a main column (two thirds) and
          narrow ones in a side column (one third), each keeping her order.
          Two independent stacks, so a short panel never leaves a hole
          beside a tall one. If she chose only one kind, it gets the full
          width. `contents` makes the two wrappers vanish on phones, where
          `order` puts every panel back into her single sequence. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {[true, false].map((wide) => {
          const mine = panels.filter((panel) => panel.wide === wide)
          if (mine.length === 0) return null
          const alone = mine.length === panels.length
          return (
            <div
              key={String(wide)}
              className={`contents xl:grid xl:items-start xl:gap-6 ${
                alone ? `xl:col-span-3 ${wide ? '' : 'xl:grid-cols-3'}` : wide ? 'xl:col-span-2' : ''
              }`}
            >
              {mine.map((panel) => {
                const { action, body } = panelParts(panel, can('reports.view'))
                return (
                  <div key={panel.key} className="min-w-0" style={{ order: panels.indexOf(panel) }}>
                    <Panel title={panel.title} action={action}>
                      {body}
                    </Panel>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {tiles.length === 0 && panels.length === 0 && (
        <p className="mt-10 text-center text-taupe-700">
          Your dashboard is empty.{' '}
          <Link href="/dashboard/edit" className="font-medium text-wine-800 underline underline-offset-4">
            Choose what to show
          </Link>
        </p>
      )}
    </AppLayout>
  )
}
