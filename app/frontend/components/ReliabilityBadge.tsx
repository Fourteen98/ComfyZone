import { ShieldAlert, ShieldCheck } from 'lucide-react'

// From Customer::Reliability: do they pay for what they claim? null = too
// little to say (nothing left unpaid, fewer than 3 paid).
export type Reliability = { paid: number; unpaid: number; tone: 'good' | 'mixed' | 'risky'; label: string } | null

// "Didn't pay 3 of 5" in red, "Didn't pay 1 of 6" in amber, "Paid all 7" in
// green. Shown wherever she decides whether to trust a claim: picking a
// buyer, the live screen, an order, a customer.
export default function ReliabilityBadge({ reliability, long = false }: { reliability: Reliability | undefined; long?: boolean }) {
  if (!reliability) return null
  const { tone, label } = reliability
  const style =
    tone === 'risky' ? 'bg-red-100 text-red-900' : tone === 'mixed' ? 'bg-amber-100 text-amber-950' : 'bg-emerald-50 text-emerald-900'
  const Icon = tone === 'good' ? ShieldCheck : ShieldAlert
  const extra = long && tone === 'risky' ? ': ask for payment first' : ''

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
      title="Orders paid, and orders released because they never paid"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
      {extra}
    </span>
  )
}
