import { Head, Link, router } from '@inertiajs/react'
import { PackageCheck, Pencil, Phone, Store, Trash2, Truck } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import Button, { ButtonLink } from '@/components/ui/Button'
import Chip from '@/components/ui/Chip'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import StatusBadge from '@/components/PurchaseStatusBadge'
import type { OptionValue } from '@/components/OptionValuesEditor'
import { formatMoney } from '@/lib/format'
import { useCan } from '@/lib/permissions'

type Item = {
  id: number
  product_id: number
  product: string
  variant: string
  option_values: (OptionValue & { name: string })[]
  quantity: number
  unit_cost_pesewas: number
  landed_unit_cost_pesewas: number | null // known once received
  line_total_pesewas: number
}

type Props = {
  purchase: {
    id: number
    purchased_on: string
    supplier: string | null
    supplier_phone: string | null
    delivery_method: 'pickup' | 'delivery'
    reference: string | null
    status: 'ordered' | 'received'
    units: number
    total_pesewas: number
    note: string | null
    recorded_by: string
    received_at: string | null
    goods_total_pesewas: number
    transport_cost_pesewas: number
    extra_costs_pesewas: number
    items: Item[]
  }
}

// Props from PurchasesController#show
export default function PurchaseShow({ purchase }: Props) {
  const manage = useCan()('purchases.manage')
  const ordered = purchase.status === 'ordered'
  const pickup = purchase.delivery_method === 'pickup'
  const Way = pickup ? Store : Truck

  // Lines arrive sorted by product; group them for display.
  const groups: { productId: number; product: string; items: Item[] }[] = []
  for (const item of purchase.items) {
    const last = groups[groups.length - 1]
    if (last && last.productId === item.product_id) last.items.push(item)
    else groups.push({ productId: item.product_id, product: item.product, items: [item] })
  }

  function receive() {
    const message = `Add ${purchase.units} ${purchase.units === 1 ? 'item' : 'items'} to stock? This can't be undone, so check the quantities first.`
    if (!window.confirm(message)) return
    router.patch(`/purchases/${purchase.id}/receive`) // -> PurchasesController#receive
  }

  function destroy() {
    if (!window.confirm('Delete this purchase? Nothing was added to stock, so nothing else changes.')) return
    router.delete(`/purchases/${purchase.id}`)
  }

  return (
    <AppLayout>
      <Head title={`Purchase, ${purchase.purchased_on}`} />

      <PageHeader
        title={purchase.supplier ?? 'Purchase'}
        description={`Bought ${purchase.purchased_on}. Recorded by ${purchase.recorded_by}.`}
        actions={
          manage &&
          ordered && (
            <>
              <ButtonLink href={`/purchases/${purchase.id}/edit`} variant="secondary">
                <Pencil className="size-5" aria-hidden="true" />
                Edit
              </ButtonLink>
              <Button type="button" variant="danger" onClick={destroy}>
                <Trash2 className="size-5" aria-hidden="true" />
                Delete
              </Button>
            </>
          )
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <StatusBadge status={purchase.status} />
        <p className="flex items-center gap-1.5 text-taupe-700">
          <Way className="size-4" aria-hidden="true" />
          {pickup ? 'Picked up' : 'Delivered'}
        </p>
        {/* tel: makes the number tappable to call on a phone. */}
        {purchase.supplier_phone && (
          <a
            href={`tel:${purchase.supplier_phone.replace(/[^\d+]/g, '')}`}
            className="flex items-center gap-1.5 font-medium text-wine-800 underline decoration-taupe-400 underline-offset-4 hover:decoration-wine-800"
          >
            <Phone className="size-4" aria-hidden="true" />
            {purchase.supplier_phone}
          </a>
        )}
        {purchase.received_at && <p className="text-taupe-700">Arrived {purchase.received_at}</p>}
        {purchase.reference && <p className="text-taupe-700">Ref {purchase.reference}</p>}
      </div>

      {ordered && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="max-w-xl text-amber-950">
            These goods are still on the way, so they are not in your stock yet.
            {manage ? ' When they arrive, check the quantities below and add them.' : ''}
          </p>
          {manage && (
            <Button type="button" onClick={receive}>
              <PackageCheck className="size-5" aria-hidden="true" />
              The goods have arrived
            </Button>
          )}
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-3">
        <Panel title="What was bought" className="xl:col-span-2">
          <div className="-mx-5 -my-5 divide-y divide-taupe-200">
            {groups.map((group) => (
              <section key={group.productId} className="px-5 py-4">
                <h3 className="font-medium">
                  <Link href={`/products/${group.productId}`} className="hover:text-wine-800 hover:underline">
                    {group.product}
                  </Link>
                </h3>
                <ul className="mt-2 space-y-2">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
                      <p className="flex min-w-32 flex-1 flex-wrap gap-1.5">
                        {item.option_values.length === 0 ? (
                          <span className="text-taupe-700">One item</span>
                        ) : (
                          item.option_values.map((value) => <Chip key={value.name} label={value.label} swatch={value.swatch} />)
                        )}
                      </p>
                      <p className="text-taupe-700">
                        {item.quantity} at {formatMoney(item.unit_cost_pesewas)}
                      </p>
                      <p className="w-32 text-right font-medium">{formatMoney(item.line_total_pesewas)}</p>
                      {item.landed_unit_cost_pesewas !== null &&
                        item.landed_unit_cost_pesewas !== item.unit_cost_pesewas && (
                          <p className="w-full text-right text-sm text-taupe-700">
                            Really cost {formatMoney(item.landed_unit_cost_pesewas)} each with {pickup ? 'the trip' : 'delivery'} and fees
                          </p>
                        )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Summary">
            <dl className="space-y-2 tabular-nums">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-taupe-700">{purchase.units === 1 ? '1 item' : `${purchase.units} items`}</dt>
                <dd>{formatMoney(purchase.goods_total_pesewas)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-taupe-700">{pickup ? 'Pick-up trip' : 'Delivery'}</dt>
                <dd>{formatMoney(purchase.transport_cost_pesewas)}</dd>
              </div>
              {purchase.extra_costs_pesewas > 0 && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-taupe-700">Other fees</dt>
                  <dd>{formatMoney(purchase.extra_costs_pesewas)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-taupe-200 pt-3">
                <dt className="font-medium">You paid</dt>
                <dd className="text-2xl font-semibold text-wine-800">{formatMoney(purchase.total_pesewas)}</dd>
              </div>
            </dl>
          </Panel>

          {purchase.note && (
            <Panel title="Note">
              <p className="whitespace-pre-line text-taupe-800">{purchase.note}</p>
            </Panel>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
