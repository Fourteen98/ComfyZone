import { Head, Link, router } from '@inertiajs/react'
import { Check, Hourglass, MessageCircle, PartyPopper, X } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import { formatPhone } from '@/lib/phone'
import { whatsappLink } from '@/lib/whatsapp'

type Request = {
  id: number
  customer_id: number
  customer: string
  phone: string | null
  product: string
  variant: string
  quantity: number
  since: string
  source: 'live' | 'sale' | 'shop' | 'manual'
  told: string | null
  message: string
}

type Props = {
  back: Request[]
  waiting: { variant_id: number; product: string; variant: string; wanted: number; people: Request[] }[]
  can_manage: boolean
}

const sources: Record<Request['source'], string> = { live: 'on a live', sale: 'when buying', shop: 'on the shop', manual: '' }

// Props from WaitingListController#index.
//   Top:    it's back. Tell each person (WhatsApp, message already written).
//   Below:  still sold out, most wanted first. That is what to buy.
export default function WaitingIndex({ back, waiting, can_manage }: Props) {
  const remove = (request: Request) => router.delete(`/admin/waiting/${request.id}`, { preserveScroll: true })
  const told = (request: Request) => router.patch(`/admin/waiting/${request.id}/told`, {}, { preserveScroll: true })

  return (
    <AppLayout>
      <Head title="Waiting list" />
      <PageHeader
        title="Waiting list"
        description="People who asked for something that was sold out. When it comes back, tell them here."
      />

      {back.length === 0 && waiting.length === 0 ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={Hourglass} title="Nobody is waiting">
            When someone asks for a size you don't have, add them from the sale screen, the stock page or their customer page.
            Shoppers can also ask on the shop.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
          <Panel title={`Back in stock${back.length ? ` (${back.length})` : ''}`}>
            {back.length === 0 ? (
              <p className="text-taupe-700">Nothing anyone asked for has come back yet.</p>
            ) : (
              <ul className="-mx-5 -my-5 divide-y divide-taupe-200">
                {back.map((request) => (
                  <li key={request.id} className={`px-5 py-4 ${request.told ? 'bg-taupe-50' : ''}`}>
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                      <PartyPopper className="mt-0.5 size-5 shrink-0 text-wine-700" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          <Link href={`/admin/customers/${request.customer_id}`} className="hover:underline">
                            {request.customer}
                          </Link>{' '}
                          wants {request.product}, {request.variant}
                          {request.quantity > 1 && ` ×${request.quantity}`}
                        </p>
                        <p className="text-sm text-taupe-700">
                          Asked {request.since} {sources[request.source]}
                          {request.phone ? ` · ${formatPhone(request.phone)}` : ' · no number saved'}
                        </p>
                      </div>
                      {request.told && <Badge tone="success">Told {request.told}</Badge>}
                    </div>

                    {can_manage && (
                      <div className="mt-3 flex flex-wrap gap-2 pl-8">
                        {request.phone && (
                          // Opens WhatsApp with the message written; marking
                          // "told" happens on the same tap, since that's what she did.
                          <a
                            href={whatsappLink(request.phone, request.message)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => !request.told && told(request)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-wine-800 px-3 font-medium text-white hover:bg-wine-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-700"
                          >
                            <MessageCircle className="size-4" aria-hidden="true" />
                            {request.told ? 'WhatsApp again' : 'Tell them on WhatsApp'}
                          </a>
                        )}
                        {!request.told && (
                          <button
                            type="button"
                            onClick={() => told(request)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-taupe-300 bg-white px-3 font-medium text-taupe-800 hover:border-wine-700"
                          >
                            <Check className="size-4" aria-hidden="true" />
                            Told them another way
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(request)}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-taupe-700 hover:bg-taupe-100"
                        >
                          <X className="size-4" aria-hidden="true" />
                          Off the list
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {back.length > 0 && (
              <p className="mt-8 text-sm text-taupe-700">When they buy it, they come off the list by themselves.</p>
            )}
          </Panel>

          <Panel title="Still sold out">
            {waiting.length === 0 ? (
              <p className="text-taupe-700">Nobody is waiting for anything that's still sold out.</p>
            ) : (
              <ul className="space-y-4">
                {waiting.map((group) => (
                  <li key={group.variant_id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/admin/stock/${group.variant_id}`} className="font-medium hover:text-wine-800 hover:underline">
                        {group.product}, {group.variant}
                      </Link>
                      <span className="shrink-0 text-sm font-semibold text-wine-800 tabular-nums">{group.wanted} wanted</span>
                    </div>
                    <p className="mt-0.5 text-sm text-taupe-700">
                      {group.people.map((person) => `${person.customer}${person.quantity > 1 ? ` ×${person.quantity}` : ''}`).join(', ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {waiting.length > 0 && (
              <p className="mt-5 border-t border-taupe-200 pt-4 text-sm text-taupe-700">
                These count in{' '}
                <Link href="/admin/stock/advice" className="font-medium text-wine-800 underline underline-offset-4">
                  What to buy next
                </Link>
                .
              </p>
            )}
          </Panel>
        </div>
      )}
    </AppLayout>
  )
}
