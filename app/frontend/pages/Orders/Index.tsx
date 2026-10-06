import { Head, Link, router } from '@inertiajs/react'
import { Plus, ReceiptText } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import OrderList from '@/components/OrderList'
import { orderTabs } from '@/lib/orders'
import { useCan } from '@/lib/permissions'
import type { OrderStatus, OrderSummary } from '@/lib/orders'

type Props = {
  orders: (OrderSummary & { live: string | null })[]
  filters: { status: string } // a status, "owing", "refunds", or "" for all
  // How many orders in each status, plus the two money views.
  counts: Partial<Record<OrderStatus | 'owing' | 'refunds', number>>
  can_create: boolean
}

// Props from OrdersController#index
export default function OrdersIndex({ orders, filters, counts, can_create }: Props) {
  const can = useCan()
  const tally = counts as Record<string, number | undefined>
  const statuses: OrderStatus[] = ['claimed', 'paid', 'packed', 'delivered', 'cancelled', 'returned']
  const everything = statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0)
  const active = everything - (counts.cancelled ?? 0) - (counts.returned ?? 0)

  // "All" means everything still counting as a sale. Other tabs appear only
  // once there is something in them (or while she is looking at one).
  const tabs = [
    { key: '', label: 'All', count: active },
    ...orderTabs
      .filter((tab) => (tally[tab.key] ?? 0) > 0 || filters.status === tab.key)
      .map((tab) => ({ ...tab, count: tally[tab.key] ?? 0 })),
  ]

  // On the "To pack" and "To deliver" tabs each order gets one big button,
  // so a packer can work down the list without opening every order.
  const next = filters.status === 'paid' ? 'packed' : filters.status === 'packed' ? 'delivered' : null
  function move(order: OrderSummary) {
    // -> Orders::StagesController#update
    router.patch(`/orders/${order.id}/stage`, { to: next }, { preserveScroll: true })
  }

  return (
    <AppLayout>
      <Head title="Orders" />

      <PageHeader
        title="Orders"
        actions={
          can_create && (
            <ButtonLink href="/orders/new">
              <Plus className="size-5" aria-hidden="true" />
              Record a sale
            </ButtonLink>
          )
        }
      />

      {everything === 0 ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={ReceiptText} title="No orders yet">
            Orders appear here as soon as something is claimed on a live, or when you record a sale.
          </EmptyState>
        </div>
      ) : (
        <>
          <nav aria-label="Show" className="mt-5 flex gap-1 overflow-x-auto border-b border-taupe-200">
            {tabs.map((tab) => {
              const on = filters.status === tab.key
              return (
                <Link
                  key={tab.key || 'all'}
                  href="/orders"
                  data={{ status: tab.key || undefined }}
                  aria-current={on ? 'page' : undefined}
                  className={`-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 font-medium ${
                    on ? 'border-wine-800 text-wine-800' : 'border-transparent text-taupe-700 hover:border-taupe-300 hover:text-wine-800'
                  }`}
                >
                  {tab.label}
                  <span className="text-sm font-normal tabular-nums opacity-70">{tab.count}</span>
                </Link>
              )
            })}
          </nav>

          {orders.length === 0 ? (
            <p className="mt-8 text-center text-taupe-700">Nothing here.</p>
          ) : (
            <div className="mt-5 overflow-hidden rounded-lg border border-taupe-200 bg-white">
              <OrderList
                orders={orders}
                action={
                  next && can('orders.fulfil')
                    ? (order) => (
                        <Button type="button" variant="secondary" onClick={() => move(order)}>
                          {next === 'packed' ? 'Mark as packed' : 'Mark as delivered'}
                        </Button>
                      )
                    : undefined
                }
              />
            </div>
          )}
        </>
      )}
    </AppLayout>
  )
}
