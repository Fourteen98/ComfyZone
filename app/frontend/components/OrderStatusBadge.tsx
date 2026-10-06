import Badge from '@/components/ui/Badge'
import { moneyNote, statusLabels } from '@/lib/orders'
import type { OrderStatus, OrderSummary } from '@/lib/orders'

const tones = {
  claimed: 'warning',
  paid: 'success',
  packed: 'success',
  delivered: 'neutral',
  cancelled: 'muted',
  returned: 'muted',
} as const

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={tones[status]}>{statusLabels[status]}</Badge>
}

// The stage, plus a note about money when there is one ("Owes GH₵ 50").
export function OrderBadges({ order }: { order: OrderSummary }) {
  const note = moneyNote(order)

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <OrderStatusBadge status={order.status} />
      {note && <Badge tone={note.tone}>{note.label}</Badge>}
    </span>
  )
}
