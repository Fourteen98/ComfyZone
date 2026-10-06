import Badge from '@/components/ui/Badge'

// Used by the purchase list and the purchase page, so the wording never drifts.
export default function PurchaseStatusBadge({ status }: { status: 'ordered' | 'received' }) {
  return status === 'received' ? <Badge tone="success">In stock</Badge> : <Badge tone="warning">On the way</Badge>
}
