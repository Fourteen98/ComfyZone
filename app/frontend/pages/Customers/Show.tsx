import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, Clock, Hourglass, Pencil, X } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import Badge from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import StatStrip from '@/components/ui/StatStrip'
import BarList from '@/components/ui/BarList'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import PhoneLinks from '@/components/PhoneLinks'
import VariantFinder from '@/components/VariantFinder'
import type { FindableProduct } from '@/components/VariantFinder'
import { formatMoney } from '@/lib/format'
import type { OrderStatus } from '@/lib/orders'

type Props = {
  customer: {
    id: number
    display_name: string
    name: string | null
    handle: string | null
    phone: string | null
    where: string | null
    note: string | null
    since: string
  }
  summary: {
    orders: number
    spent_pesewas: number
    average_pesewas: number
    units: number
    first_at: string | null
    last_at: string | null
    days_since_last: number | null
    every_days: number | null
    owing_pesewas: number
    cancelled: number
    returned: number
    quiet: boolean
  }
  favourites: { option: string; labels: { label: string; units: number }[] }[]
  top_products: { id: number; name: string; units: number; spent_pesewas: number }[]
  pays: { label: string; hours: number; orders: number; slow: boolean } | null
  orders: { id: number; at: string; status: OrderStatus; channel: string | null; total_pesewas: number; balance_pesewas: number; items: string }[]
  waiting: { id: number; product: string; variant: string; quantity: number; since: string; in_stock: boolean; told: boolean }[]
  /** For "add to the waiting list". Only sent to people who may manage customers. */
  products: FindableProduct[] | null
  can_manage: boolean
}

const ago = (days: number) => (days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`)

// Props from CustomersController#show: everything the shop knows about one buyer.
export default function CustomerShow({ customer, summary, favourites, top_products, pays, orders, waiting, products, can_manage }: Props) {
  const details = [customer.handle && customer.name ? `@${customer.handle}` : null, customer.where].filter(Boolean).join(' · ')

  return (
    <AppLayout>
      <Head title={customer.display_name} />

      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Customers
      </Link>
      <div className="mt-2">
        <PageHeader
          title={customer.display_name}
          description={details || undefined}
          actions={
            can_manage && (
              <ButtonLink href={`/admin/customers/${customer.id}/edit`} variant="secondary">
                <Pencil className="size-5" aria-hidden="true" />
                Edit
              </ButtonLink>
            )
          }
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {customer.phone && <PhoneLinks phone={customer.phone} />}
        {summary.quiet && <Badge tone="warning">Gone quiet</Badge>}
        {pays && <Badge tone={pays.slow ? 'warning' : 'success'}>{pays.label}</Badge>}
        {summary.owing_pesewas > 0 && <Badge tone="danger">Owes {formatMoney(summary.owing_pesewas)}</Badge>}
      </div>

      <div className="mt-6">
        <StatStrip
          stats={[
            { label: 'Spent with you', value: formatMoney(summary.spent_pesewas), hint: `${summary.units} ${summary.units === 1 ? 'piece' : 'pieces'}` },
            { label: 'Orders', value: String(summary.orders), hint: summary.orders ? `about ${formatMoney(summary.average_pesewas)} each` : undefined },
            {
              label: 'Last bought',
              value: summary.days_since_last === null ? 'Never' : ago(summary.days_since_last),
              hint: summary.last_at ?? undefined,
            },
            {
              label: 'Buys every',
              value: summary.every_days === null ? '–' : `${summary.every_days} days`,
              hint: summary.every_days === null ? 'needs two orders to tell' : `since ${summary.first_at}`,
            },
          ]}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <Panel title="What they like">
            {favourites.length === 0 ? (
              <p className="text-taupe-700">Nothing bought yet.</p>
            ) : (
              <dl className="space-y-4">
                {favourites.map((group) => (
                  <div key={group.option}>
                    <dt className="text-sm font-medium text-taupe-800">Usual {group.option.toLowerCase()}</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-2">
                      {group.labels.map((entry, index) => (
                        <span
                          key={entry.label}
                          className={`rounded-full px-3 py-1 text-sm ${index === 0 ? 'bg-wine-800 text-white' : 'bg-taupe-100 text-taupe-800'}`}
                        >
                          {entry.label} <span className="opacity-75">×{entry.units}</span>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {top_products.length > 0 && (
              <div className="mt-5 border-t border-taupe-200 pt-4">
                <BarList
                  empty=""
                  format={formatMoney}
                  rows={top_products.map((row) => ({
                    key: row.id,
                    label: row.name,
                    note: `${row.units} bought`,
                    value: row.spent_pesewas,
                    href: `/admin/products/${row.id}`,
                  }))}
                />
              </div>
            )}
            {(summary.returned > 0 || summary.cancelled > 0) && (
              <p className="mt-4 text-sm text-taupe-700">
                {[summary.returned ? `${summary.returned} returned` : null, summary.cancelled ? `${summary.cancelled} cancelled` : null]
                  .filter(Boolean)
                  .join(', ')}
                .
              </p>
            )}
          </Panel>

          <Panel title="Waiting for">
            {waiting.length === 0 ? (
              <p className="text-taupe-700">Nothing on the waiting list.</p>
            ) : (
              <ul className="divide-y divide-taupe-200">
                {waiting.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 py-2.5">
                    <Hourglass className="size-5 shrink-0 text-taupe-500" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {entry.product}, {entry.variant}
                        {entry.quantity > 1 && <span className="text-taupe-600"> ×{entry.quantity}</span>}
                      </p>
                      <p className="text-sm text-taupe-700">
                        Asked {entry.since}.{' '}
                        {entry.in_stock ? <strong className="text-emerald-800">Back in stock{entry.told ? ', told' : ''}.</strong> : 'Still sold out.'}
                      </p>
                    </div>
                    {can_manage && (
                      <button
                        type="button"
                        onClick={() => router.delete(`/admin/waiting/${entry.id}`, { preserveScroll: true })}
                        aria-label={`Take ${customer.display_name} off the list for ${entry.product}, ${entry.variant}`}
                        className="flex size-10 items-center justify-center rounded-md text-taupe-600 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:outline-wine-700"
                      >
                        <X className="size-5" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {can_manage && products && (
              <div className="mt-4 border-t border-taupe-200 pt-4">
                <VariantFinder
                  id="waiting_find"
                  label="Asked for something you don't have?"
                  products={products}
                  onPick={(_, variant) => router.post('/admin/waiting', { variant_id: variant.id, customer_id: customer.id }, { preserveScroll: true })}
                />
              </div>
            )}
          </Panel>

          {customer.note && (
            <Panel title="Note">
              <p className="whitespace-pre-line text-taupe-800">{customer.note}</p>
            </Panel>
          )}
        </div>

        <Panel title="Orders" className="xl:col-span-2">
          {orders.length === 0 ? (
            <p className="text-taupe-700">No orders yet. Customer since {customer.since}.</p>
          ) : (
            <ul className="-mx-5 -my-5 divide-y divide-taupe-200">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="block px-5 py-3 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-medium">Order {order.id}</p>
                      <OrderStatusBadge status={order.status} />
                      <p className="ml-auto font-semibold tabular-nums">{formatMoney(order.total_pesewas)}</p>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-taupe-700">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {[order.at, order.channel].filter(Boolean).join(', ')}
                      {order.balance_pesewas > 0 && order.status !== 'cancelled' && (
                        <span className="text-red-800"> · owes {formatMoney(order.balance_pesewas)}</span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-taupe-800">{order.items}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppLayout>
  )
}
