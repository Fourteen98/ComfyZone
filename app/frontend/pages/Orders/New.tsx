import { Head, Link, router } from '@inertiajs/react'
import { ArrowLeft, FilePen, Trash2 } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import PageHeader from '@/components/ui/PageHeader'
import SaleCapture from '@/components/SaleCapture'
import type { Buyer, DraftState, SellableProduct } from '@/components/SaleCapture'
import type { SalesChannel } from '@/lib/orders'
import type { Locations } from '@/components/LocationFields'
import { confirmAction } from '@/lib/confirm'

type Draft = { id: number; label: string; by: string; at: string }

// Props from OrdersController#new
type Props = {
  products: SellableProduct[]
  buyers: Buyer[]
  channels: SalesChannel[]
  locations: Locations
  ways_to_pay: { value: string; label: string; reference?: boolean }[] | null // null = may not take payments
  drafts: Draft[] // sales saved halfway
  draft: { id: number; label: string; payload: Partial<DraftState> } | null // the one being finished (?draft=5)
}

// A sale made outside a live. The same capture screen, with no live attached.
// Sales saved halfway are listed on top; opening one fills the screen in.
export default function OrderNew({ products, buyers, channels, locations, ways_to_pay, drafts, draft }: Props) {
  const others = drafts.filter((entry) => entry.id !== draft?.id)

  async function discard(entry: Draft) {
    if (!(await confirmAction(`Delete the draft "${entry.label}"?`, { confirm: 'Delete', danger: true }))) return
    router.delete(`/admin/orders/drafts/${entry.id}`, { preserveScroll: true })
  }

  return (
    <AppLayout>
      <Head title={draft ? 'Finish a draft' : 'Record a sale'} />

      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-wine-800 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Orders
      </Link>
      <div className="mt-2">
        <PageHeader
          title={draft ? 'Finish a draft' : 'Record a sale'}
          description={
            draft
              ? `${draft.label}. Stock is checked again when you record it.`
              : 'For an order taken outside a live: WhatsApp, a call, someone at the door.'
          }
        />
      </div>

      {others.length > 0 && (
        <section aria-labelledby="drafts-title" className="mt-5 rounded-lg border border-taupe-200 bg-white">
          <h2 id="drafts-title" className="flex items-center gap-2 border-b border-taupe-200 px-5 py-3 font-medium">
            <FilePen className="size-5 text-wine-800" aria-hidden="true" />
            {draft ? 'Other drafts' : 'Saved drafts'}
            <span className="text-sm font-normal text-taupe-600">{others.length}</span>
          </h2>
          <ul className="divide-y divide-taupe-100">
            {others.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-5 py-2.5">
                <Link href="/admin/orders/new" data={{ draft: entry.id }} className="min-w-0 flex-1 hover:text-wine-800">
                  <span className="block truncate font-medium">{entry.label}</span>
                  <span className="block text-sm text-taupe-600">
                    {entry.at}, by {entry.by}
                  </span>
                </Link>
                <Link
                  href="/admin/orders/new"
                  data={{ draft: entry.id }}
                  className="min-h-10 rounded-md px-3 py-2 text-sm font-medium text-wine-800 hover:bg-taupe-100"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => discard(entry)}
                  aria-label={`Delete the draft ${entry.label}`}
                  className="flex size-10 items-center justify-center rounded-md text-taupe-600 hover:bg-red-50 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-wine-700"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6">
        {/* key: opening another draft builds the screen afresh from it. */}
        <SaleCapture
          key={draft?.id ?? 'new'}
          products={products}
          buyers={buyers}
          channels={channels}
          locations={locations}
          waysToPay={ways_to_pay}
          draft={draft}
        />
      </div>
    </AppLayout>
  )
}
