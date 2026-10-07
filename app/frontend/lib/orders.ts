// Shared wording and types for orders.
import { formatMoney } from '@/lib/format'

export type OrderStatus = 'claimed' | 'paid' | 'packed' | 'delivered' | 'cancelled' | 'returned'

// Keep in step with the `status` enum in app/models/order.rb.
export const statusLabels: Record<OrderStatus, string> = {
  claimed: 'To be paid',
  paid: 'Paid',
  packed: 'Packed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
}

// The tabs on the orders page, in order. A tab is a status, or one of the
// two money views (OrdersController::VIEWS). Named for what she has to DO.
export const orderTabs: { key: string; label: string }[] = [
  { key: 'claimed', label: 'To be paid' },
  { key: 'paid', label: 'To pack' },
  { key: 'packed', label: 'To deliver' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'owing', label: 'Still owing' },
  { key: 'refunds', label: 'Refunds due' },
  { key: 'returned', label: 'Returned' },
  { key: 'cancelled', label: 'Cancelled' },
]

// What every order list and the live screen receive for one order.
// Built by `order_summary` in app/controllers/concerns/sale_capture.rb.
export type OrderSummary = {
  id: number
  customer: string
  status: OrderStatus
  total_pesewas: number // the goods
  due_pesewas: number // goods + delivery; 0 once cancelled or returned
  paid_pesewas: number
  balance_pesewas: number // > 0 they owe her, < 0 she owes them
  units: number
  at: string
  channel: string | null // where the sale came from, e.g. "WhatsApp"
  // quantity = what was sold; returned = how many of those came back.
  items: { id: number; name: string; quantity: number; returned: number; total_pesewas: number }[]
}

export function isOpen(status: OrderStatus): boolean {
  return status === 'claimed' || status === 'paid' || status === 'packed'
}

// A second badge about money, when the stage alone doesn't tell the story.
// Returns null when there is nothing worth adding.
export function moneyNote(order: OrderSummary): { tone: 'warning' | 'danger' | 'neutral'; label: string } | null {
  if (order.balance_pesewas < 0) {
    return { tone: 'danger', label: `${formatMoney(-order.balance_pesewas)} to give back` }
  }
  if (order.balance_pesewas === 0) return null
  if (order.status === 'packed' || order.status === 'delivered') {
    return { tone: 'warning', label: `Owes ${formatMoney(order.balance_pesewas)}` }
  }
  if (order.paid_pesewas > 0) {
    return { tone: 'neutral', label: `${formatMoney(order.paid_pesewas)} paid so far` }
  }
  return null
}

// A place sales come from (Settings > Sales channels).
//   social  buyers are known by a username
//   direct  buyers are known by name or phone number
export type SalesChannel = { id: number; name: string; kind: 'social' | 'direct' }
