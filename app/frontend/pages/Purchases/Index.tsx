import { Head, Link } from '@inertiajs/react'
import { Pencil, Plus, Truck } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import StatusBadge from '@/components/PurchaseStatusBadge'
import Button from '@/components/ui/Button'
import Drawer, { DrawerFab, DrawerLoading, loadDrawerData } from '@/components/ui/Drawer'
import PurchaseForm from '@/components/PurchaseForm'
import type { PurchaseFormProps } from '@/components/PurchaseForm'
import { useCallback, useState } from 'react'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import { formatMoney } from '@/lib/format'
import { useCan } from '@/lib/permissions'

type PurchaseRow = {
  id: number
  purchased_on: string
  supplier: string | null
  reference: string | null
  status: 'ordered' | 'received'
  units: number
  total_pesewas: number
}

type Props = {
  purchases: PurchaseRow[]
  filters: { status: 'all' | 'ordered' }
  counts: { all: number; ordered: number }
  can_record: boolean
  // Only once the drawer asks for it (optional prop): what the purchase form needs.
  purchase_form?: PurchaseFormProps | null
}

// Props from PurchasesController#index
export default function PurchasesIndex({ purchases, filters, counts, can_record }: Props) {
  // "Record a purchase" slides over the list. Its data is fetched the first
  // time it opens, and again after a colour is added to a product.
  const [recording, setRecording] = useState(false)
  const [formData, setFormData] = useState<PurchaseFormProps | null>(null)
  const reload = () => loadDrawerData<PurchaseFormProps>('purchase_form', setFormData)
  function start() {
    setRecording(true)
    if (!formData) reload()
  }
  const stop = useCallback(() => setRecording(false), [])

  const can = useCan()
  const tabs = [
    { key: 'all', label: 'All', count: counts.all, href: '/admin/purchases' },
    { key: 'ordered', label: 'On the way', count: counts.ordered, href: '/admin/purchases?status=ordered' },
  ]

  return (
    <AppLayout>
      <Head title="Purchases" />

      <PageHeader
        title="Purchases"
        description="Every restock. Stock goes up when a purchase arrives."
        actions={
          can('purchases.manage') && (
            <Button type="button" onClick={start}>
              <Plus className="size-5" aria-hidden="true" />
              Record a purchase
            </Button>
          )
        }
      />

      {counts.all === 0 ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={Truck} title="No purchases yet">
            Record what you buy to stock up. The app adds it to your stock and works out what each item really cost you.
          </EmptyState>
        </div>
      ) : (
        <>
          <nav aria-label="Show" className="mt-5 flex gap-1 border-b border-taupe-200">
            {tabs.map((tab) => {
              const active = filters.status === tab.key
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-4 font-medium ${
                    active
                      ? 'border-wine-800 text-wine-800'
                      : 'border-transparent text-taupe-700 hover:border-taupe-300 hover:text-wine-800'
                  }`}
                >
                  {tab.label}
                  <span className="text-sm font-normal tabular-nums opacity-70">{tab.count}</span>
                </Link>
              )
            })}
          </nav>

          {purchases.length === 0 ? (
            <p className="mt-8 text-center text-taupe-700">Nothing on the way. Everything you bought has arrived.</p>
          ) : (
            <ul className="mt-5 divide-y divide-taupe-200 rounded-lg border border-taupe-200 bg-white">
              {purchases.map((purchase) => (
                <li key={purchase.id} className="flex items-stretch">
                  {/* Name and date on the left, money and status stacked on the
                      right, so nothing gets squeezed on a phone. */}
                  <Link
                    href={`/admin/purchases/${purchase.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700 sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{purchase.supplier ?? 'No supplier'}</p>
                      <p className="text-sm text-taupe-700">
                        {purchase.purchased_on} · {purchase.units} {purchase.units === 1 ? 'item' : 'items'}
                        {purchase.reference && ` · ref ${purchase.reference}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="font-semibold tabular-nums">{formatMoney(purchase.total_pesewas)}</p>
                      <StatusBadge status={purchase.status} />
                    </div>
                  </Link>
                  {/* Mistakes happen: straight to the form, one tap. */}
                  {can('purchases.manage') && (
                    <Link
                      href={`/admin/purchases/${purchase.id}/edit`}
                      aria-label={`Edit purchase from ${purchase.supplier ?? 'no supplier'}, ${purchase.purchased_on}`}
                      className="flex w-14 shrink-0 items-center justify-center border-l border-taupe-200 text-wine-800 hover:bg-taupe-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                    >
                      <Pencil className="size-5" aria-hidden="true" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {can_record && (
        <>
          <DrawerFab label="Record a purchase" onClick={start} hidden={recording} />
          <Drawer open={recording} onClose={stop} title="Record a purchase">
            {formData ? <PurchaseForm {...formData} inDrawer onCancel={stop} onProductsStale={reload} /> : <DrawerLoading />}
          </Drawer>
        </>
      )}
    </AppLayout>
  )
}
