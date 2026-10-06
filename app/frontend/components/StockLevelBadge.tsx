import Badge from '@/components/ui/Badge'
import type { StockLevel } from '@/lib/stock'

// "Low" or "Out" beside a stock number. Shows nothing when stock is fine,
// so the list only draws the eye to what needs attention.
// Colour is never the only signal: the word is always there too.
export default function StockLevelBadge({ level }: { level: StockLevel | null }) {
  if (level === 'out') return <Badge tone="danger">Out</Badge>
  if (level === 'low') return <Badge tone="warning">Low</Badge>
  return null
}
