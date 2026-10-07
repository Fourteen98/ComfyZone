import { Link, router } from '@inertiajs/react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { OrderBadges } from '@/components/OrderStatusBadge'
import { formatMoney } from '@/lib/format'
import type { OrderSummary } from '@/lib/orders'
import { confirmAction } from '@/lib/confirm'

type Props = {
  orders: (OrderSummary & { live?: string | null })[]
  /** Show a remove button on each line (while an order is still "claimed"). */
  removable?: boolean
  /** Show the order's status badge. Off on the live screen, where all are claimed. */
  showStatus?: boolean
  /** A button to show on each order, e.g. "Packed" on the to-pack list. */
  action?: (order: OrderSummary) => ReactNode
}

// A list of orders with their lines. Used on the live screen ("Claims so
// far"), the orders page and the dashboard.
export default function OrderList({ orders, removable = false, showStatus = true, action }: Props) {
  async function remove(order: OrderSummary, item: OrderSummary['items'][number]) {
    if (!(await confirmAction(`Remove ${item.name} from ${order.customer}'s order? It goes back into stock.`, { confirm: 'Remove', danger: true }))) return
    // -> Orders::ItemsController#destroy
    router.delete(`/orders/${order.id}/items/${item.id}`, { preserveScroll: true })
  }

  return (
    <ul className="divide-y divide-taupe-200">
      {orders.map((order) => (
        <li key={order.id} className="px-5 py-3">
          {/* Name and amount share the first line; badges get their own,
              so a long badge can never squeeze the name out on a phone. */}
          <div className="flex items-baseline gap-3">
            <Link href={`/orders/${order.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-wine-800 hover:underline">
              {order.customer}
            </Link>
            {/* What the buyer pays, delivery included. A cancelled order
                has nothing due, so it shows what the goods came to. */}
            <span className="font-semibold tabular-nums">{formatMoney(order.due_pesewas || order.total_pesewas)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {showStatus && <OrderBadges order={order} />}
            <p className="text-sm text-taupe-600">
              {order.at}
              {/* The live it was claimed on, or else where the sale came from. */}
              {order.live ? `, ${order.live}` : order.channel ? `, ${order.channel}` : ''}
            </p>
          </div>
          <ul className="mt-1">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm text-taupe-800">
                <span className="min-w-0 flex-1 truncate">
                  {item.quantity > 1 && <span className="font-semibold tabular-nums">{item.quantity} × </span>}
                  {item.name}
                </span>
                {removable && order.status === 'claimed' && (
                  <button
                    type="button"
                    onClick={() => remove(order, item)}
                    aria-label={`Remove ${item.name} from ${order.customer}'s order`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-taupe-600 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-wine-700"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {action && <div className="mt-2">{action(order)}</div>}
        </li>
      ))}
    </ul>
  )
}
