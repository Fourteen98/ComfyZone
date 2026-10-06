import { Head, Link } from '@inertiajs/react'
import { Boxes, Radio, ReceiptText } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
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

// These props are exactly the hash passed to `render inertia: "Dashboard",
// props: { ... }` in DashboardController#show.
type Props = {
  today: string
  // Each number is null until the feature that produces it exists.
  stats: {
    sales_today: number | null // pesewas
    orders_to_pack: number | null
    low_stock: number | null
    money_owed: number | null // pesewas
  }
  // The most urgent few. null = this person may not see stock.
  low_stock:
    | {
        id: number
        product: string
        variant: string
        option_values: (OptionValue & { name: string })[]
        stock: number
        level: StockLevel
      }[]
    | null
  // The latest few. null = this person may not see orders.
  recent_orders: OrderSummary[] | null
  // Set while a live is running.
  live_now: { id: number; title: string } | null
}

export default function Dashboard({ today, stats, low_stock, recent_orders, live_now }: Props) {
  const money = (value: number | null) => (value === null ? null : formatMoney(value))
  const count = (value: number | null) => (value === null ? null : String(value))

  return (
    <AppLayout>
      {/* <Head> sets the browser tab title for this page. */}
      <Head title="Dashboard" />

      <PageHeader title={greeting()} description={today} />

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

      <div className="mt-6">
        <StatStrip
          stats={[
            { label: 'Sales today', value: money(stats.sales_today) },
            { label: 'Orders to pack', value: count(stats.orders_to_pack), href: stats.orders_to_pack === null ? undefined : '/orders?status=paid' },
            { label: 'Low on stock', value: count(stats.low_stock), href: stats.low_stock === null ? undefined : '/stock?show=low' },
            { label: 'Money owed to you', value: money(stats.money_owed), href: stats.money_owed === null ? undefined : '/orders?status=claimed' },
          ]}
        />
      </div>

      {/* One column on phones; on wide screens the orders panel takes two
          thirds and the side column takes one third. */}
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        {recent_orders !== null && (
          <Panel
            title="Recent orders"
            className="xl:col-span-2"
            action={
              recent_orders.length > 0 && (
                <Link href="/orders" className="text-sm font-medium text-wine-800 underline underline-offset-4">
                  See all
                </Link>
              )
            }
          >
            {recent_orders.length === 0 ? (
              <EmptyState icon={ReceiptText} title="No orders yet">
                Orders from your lives will show here, newest first.
              </EmptyState>
            ) : (
              <div className="-mx-5 -my-5">
                <OrderList orders={recent_orders} />
              </div>
            )}
          </Panel>
        )}

        <div className="space-y-6">
          {low_stock !== null && (
            <Panel
              title="Low on stock"
              action={
                <Link href="/stock?show=low" className="text-sm font-medium text-wine-800 underline underline-offset-4">
                  See all
                </Link>
              }
            >
              {low_stock.length === 0 ? (
                <EmptyState icon={Boxes} title="Nothing running low">
                  Items that drop to their warning level will be listed here.
                </EmptyState>
              ) : (
                <ul className="-mx-5 -my-5 divide-y divide-taupe-200">
                  {low_stock.map((item) => (
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
              )}
            </Panel>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
