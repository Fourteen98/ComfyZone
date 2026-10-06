import { Head, Link } from '@inertiajs/react'
import { Plus, Truck } from 'lucide-react'
import AppLayout from '@/layouts/AppLayout'
import StatusBadge from '@/components/PurchaseStatusBadge'
import { ButtonLink } from '@/components/ui/Button'
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
}

// Props from PurchasesController#index
export default function PurchasesIndex({ purchases, filters, counts }: Props) {
  const can = useCan()
  const tabs = [
    { key: 'all', label: 'All', count: counts.all, href: '/purchases' },
    { key: 'ordered', label: 'On the way', count: counts.ordered, href: '/purchases?status=ordered' },
  ]

  return (
    <AppLayout>
      <Head title="Purchases" />

      <PageHeader
        title="Purchases"
        description="Every restock. Stock goes up when a purchase arrives."
        actions={
          can('purchases.manage') && (
            <ButtonLink href="/purchases/new">
              <Plus className="size-5" aria-hidden="true" />
              Record a purchase
            </ButtonLink>
          )
        }
      />

      {counts.all === 0 ? (
        <div className="mt-6 rounded-lg border border-taupe-200 bg-white">
          <EmptyState icon={Truck} title="No purchases yet">
            Record what you buy to stock up. The app adds it to your stock and works out what each item really cost
            you.
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
                <li key={purchase.id}>
                  <Link
                    href={`/purchases/${purchase.id}`}
                    className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-taupe-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-wine-700"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{purchase.supplier ?? 'No supplier'}</p>
                      <p className="text-sm text-taupe-700">
                        {purchase.purchased_on}, {purchase.units} {purchase.units === 1 ? 'item' : 'items'}
                        {purchase.reference && `, ref ${purchase.reference}`}
                      </p>
                    </div>
                    <StatusBadge status={purchase.status} />
                    <p className="w-32 text-right font-semibold tabular-nums">{formatMoney(purchase.total_pesewas)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppLayout>
  )
}
