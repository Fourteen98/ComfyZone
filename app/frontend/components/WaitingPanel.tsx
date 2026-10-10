import { Link, router } from '@inertiajs/react'
import { MessageCircle, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import Panel from '@/components/ui/Panel'
import BuyerPicker from '@/components/BuyerPicker'
import type { Buyer, BuyerChoice } from '@/components/BuyerPicker'
import { whatsappLink } from '@/lib/whatsapp'

export type WaitingEntry = {
  id: number
  customer_id: number
  customer: string
  phone: string | null
  quantity: number
  since: string
  told: boolean
  message: string
}

type Props = {
  variantId: number
  inStock: boolean
  waiting: WaitingEntry[]
  /** Customers to pick from; null = may not add people. */
  buyers: Buyer[] | null
}

// "Who's waiting for this?" on an item's stock page: everyone who asked
// while it was sold out, a WhatsApp tap each once it's back, and a way to
// add someone who just asked.
export default function WaitingPanel({ variantId, inStock, waiting, buyers }: Props) {
  const [adding, setAdding] = useState(false)
  const [choice, setChoice] = useState<BuyerChoice | null>(null)

  function add() {
    if (!choice) return
    const who = 'id' in choice ? { customer_id: choice.id } : { buyer: choice }
    router.post('/admin/waiting', { variant_id: variantId, ...who }, { preserveScroll: true, onSuccess: () => setAdding(false) })
  }

  return (
    <Panel title={waiting.length ? `Waiting for this (${waiting.length})` : 'Waiting for this'}>
      {waiting.length === 0 ? (
        <p className="text-taupe-700">Nobody has asked for it.</p>
      ) : (
        <ul className="divide-y divide-taupe-200">
          {waiting.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/customers/${entry.customer_id}`} className="font-medium hover:underline">
                  {entry.customer}
                </Link>
                {entry.quantity > 1 && <span className="text-taupe-600"> ×{entry.quantity}</span>}
                <p className="text-sm text-taupe-700">
                  Asked {entry.since}
                  {entry.told ? ', told it is back' : ''}
                </p>
              </div>
              {inStock && entry.phone && (
                <a
                  href={whatsappLink(entry.phone, entry.message)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => !entry.told && router.patch(`/admin/waiting/${entry.id}/told`, {}, { preserveScroll: true })}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-wine-800 px-3 text-sm font-medium text-white hover:bg-wine-900"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  Tell them
                </a>
              )}
              {buyers && (
                <button
                  type="button"
                  onClick={() => router.delete(`/admin/waiting/${entry.id}`, { preserveScroll: true })}
                  aria-label={`Take ${entry.customer} off the list`}
                  className="flex size-10 items-center justify-center rounded-md text-taupe-600 hover:bg-taupe-100"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {buyers &&
        (adding ? (
          <div className="mt-4 space-y-3 border-t border-taupe-200 pt-4">
            <BuyerPicker buyers={buyers} usernameFirst={false} onChange={(next) => setChoice(next)} />
            <div className="flex gap-2">
              <Button type="button" onClick={add} disabled={!choice}>
                Add to the list
              </Button>
              <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="secondary" className="mt-4" onClick={() => setAdding(true)}>
            <UserPlus className="size-5" aria-hidden="true" />
            Someone asked for it
          </Button>
        ))}
    </Panel>
  )
}
